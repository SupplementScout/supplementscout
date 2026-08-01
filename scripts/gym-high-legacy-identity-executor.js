const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { loadDryRunArtifact } = require("./import-products");
const { UPGRADES } = require("./gym-high-legacy-identity-feed-builder");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const APPROVAL_FINGERPRINT = "feda6c5cc6f03556dbadfb2e56dc7216150d502a70cee03b1880ec35ec37ad59";
function fail(message) { throw new Error(message); }
function parseArgs(argv) {
  const out = {};
  for (const argument of argv) {
    const match = argument.match(/^--(mode|report|artifacts|output)=(.*)$/);
    if (!match || out[match[1]] !== undefined) fail(`Invalid argument ${argument}`);
    out[match[1]] = match[2];
  }
  if (!["validate", "apply"].includes(out.mode)) fail("Required --mode=validate|apply");
  for (const key of ["report", "artifacts", "output"]) if (!out[key]) fail(`Required --${key}=<path>`); else out[key] = path.resolve(out[key]);
  const relative = path.relative(path.join(ROOT, "tmp"), out.output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return out;
}
function credential(kind) {
  const value = process.env[`GYM_HIGH_${kind.toUpperCase()}_DATABASE_URL`];
  if (!value) fail(`Missing GYM_HIGH_${kind.toUpperCase()}_DATABASE_URL`);
  const parsed = new URL(value); parsed.searchParams.delete("sslmode");
  if (parsed.href.includes("hxnrsyyqffztlvcrtgbf")) fail(`${kind} credential points to staging`);
  return parsed.href;
}
async function roleCall(kind, callback) {
  const client = new Client({ connectionString: credential(kind), ssl: { rejectUnauthorized: false }, application_name: `gym-high-legacy-identity-${kind}`, options: "-c statement_timeout=120000" });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)");
    await client.query(`set role retailer_catalogue_production_${kind}`);
    const identity = (await client.query("select current_user")).rows[0].current_user;
    if (identity !== `retailer_catalogue_production_${kind}`) fail(`${kind} role mismatch`);
    const result = await callback(client); await client.query("commit"); return result;
  } catch (error) { await client.query("rollback").catch(() => {}); throw error; } finally { await client.end(); }
}
function validateInputs(options) {
  const report = JSON.parse(fs.readFileSync(options.report, "utf8"));
  if (report.result !== "PASS" || report.kind !== "gym-high-legacy-identity-feed" || report.database_writes !== 0 || report.reviewed_scope_count !== 21 || report.approval_fingerprint !== APPROVAL_FINGERPRINT || report.row_artifact_count !== report.remaining_upgrade_count || report.remaining_upgrade_count + report.completed_mapping_count !== 21) fail("GYM HIGH identity builder report mismatch");
  const expected = new Map(UPGRADES.map((row) => [String(row.mappingId), row]));
  const loaded = [];
  for (const rowArtifact of report.row_artifacts) {
    const spec = expected.get(String(rowArtifact.mapping_id));
    if (!spec) fail(`Unapproved mapping ${rowArtifact.mapping_id}`);
    const artifactPath = path.join(options.artifacts, rowArtifact.filename.replace(/\.csv$/i, ".json"));
    const value = loadDryRunArtifact(artifactPath);
    const artifact = value.artifact;
    if (artifact.source_file_sha256 !== rowArtifact.sha256 || artifact.plans.length !== 1 || artifact.blocked_rows.length !== 0) fail(`Artifact contract mismatch for mapping ${spec.mappingId}`);
    const entry = artifact.plans[0], plan = entry.resolved_plan, source = artifact.source_rows[0]?.normalized_source_row || {};
    const expectedOfferAction = String(entry.before?.product_variant_id) === spec.variantId ? "noop" : "identity_update";
    if (entry.operation_type !== "legacy_mapping_upgrade" || String(entry.retailer_id) !== "1" || String(entry.retailer_product_id) !== String(spec.mappingId) || String(plan.product?.id) !== String(spec.productId) || String(plan.product_variant?.id) !== spec.variantId || plan.product?.action !== "existing" || plan.product_variant?.action !== "existing" || plan.retailer?.action !== "existing" || plan.retailer_product?.action !== "update" || plan.offer?.action !== expectedOfferAction || String(plan.offer?.id) !== String(spec.offerId) || plan.price_history?.action !== "noop" || source.legacy_mapping_upgrade !== "true" || source.external_product_id !== spec.externalProductId || source.external_variant_id !== spec.externalVariantId) fail(`Resolved plan mismatch for mapping ${spec.mappingId}`);
    loaded.push({ spec, ...value, entry });
  }
  if (new Set([...loaded.map((row) => String(row.spec.mappingId)), ...(report.completed_mapping_ids || []).map(String)]).size !== 21) fail("GYM HIGH execution scope is incomplete");
  return { report, loaded };
}
async function execute(row) {
  const { artifact, artifactSha256, entry } = row, plan = entry.resolved_plan;
  const approval = await roleCall("approver", async (client) => (await client.query("select public.approve_product_import_plan($1::jsonb,$2,$3,$4,now()+interval '15 minutes') result", [plan, artifactSha256, artifact.run_id, "gym-high-reviewed-full-catalogue-v1"])).rows[0].result);
  if (approval.status !== "approved" || approval.artifact_sha256 !== artifactSha256 || approval.plan_fingerprint !== entry.plan_fingerprint || approval.source_row_fingerprint !== entry.source_row_fingerprint || approval.run_id !== artifact.run_id) fail(`Approval mismatch for mapping ${row.spec.mappingId}`);
  const result = await roleCall("executor", async (client) => (await client.query("select public.apply_approved_product_import_plan($1::uuid,$2,$3,$4,$5::bigint,$6,$7) result", [approval.approval_id, artifactSha256, entry.plan_fingerprint, entry.source_row_fingerprint, entry.retailer_id, entry.plan_kind, artifact.run_id])).rows[0].result);
  if (result.approval_status !== "consumed" || result.plan_fingerprint !== entry.plan_fingerprint || result.source_row_fingerprint !== entry.source_row_fingerprint || String(result.retailer_product_id) !== String(row.spec.mappingId) || String(result.offer_id) !== String(row.spec.offerId) || result.price_history_id != null) fail(`Execution mismatch for mapping ${row.spec.mappingId}`);
  return { mapping_id: String(row.spec.mappingId), approval_id: approval.approval_id, consumed_at: result.consumed_at, offer_id: String(result.offer_id) };
}
async function run(options) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" || process.env.GYM_HIGH_APPROVAL_FINGERPRINT !== APPROVAL_FINGERPRINT) fail("GYM HIGH identity execution requires the exact manual GitHub approval on main");
  const validated = validateInputs(options), rows = [];
  if (options.mode === "apply") for (const row of validated.loaded) rows.push(await execute(row));
  const report = { schema_version: 1, kind: "gym-high-legacy-identity-execution", result: "PASS", mode: options.mode, target_project_ref: PROJECT_REF, approval_fingerprint: APPROVAL_FINGERPRINT, validated_plan_count: validated.loaded.length, previously_completed_count: validated.report.completed_mapping_count, executed_plan_count: rows.length, rows, completed_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(options.output), { recursive: true }); fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`); return report;
}
if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify({ result: report.result, mode: report.mode, validated: report.validated_plan_count, executed: report.executed_plan_count }, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { parseArgs, validateInputs };
