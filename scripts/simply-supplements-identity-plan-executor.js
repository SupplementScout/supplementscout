const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { loadDryRunArtifact } = require("./import-products");
const authorization = require("../config/retailers/simply-supplements-complete-identity-authorization-2026-08-03.json");

const ROOT = path.resolve(__dirname, "..");
const TARGETS = Object.freeze({
  staging: { ref: "hxnrsyyqffztlvcrtgbf", prefix: "SUPPLEMENTSCOUT_STAGING", file: (kind) => path.join(ROOT, `.env.staging.${kind}.local`) },
  production: { ref: "aftboxmrdgyhizicfsfu", prefix: "SIMPLY_IDENTITY_PRODUCTION", file: (kind) => path.join(process.env.USERPROFILE || "", ".supplementscout", "credentials", `production-${kind}.env`) },
});

function fail(message) { throw new Error(message); }
function loadEnv(file) {
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}
function parseArgs(argv) {
  const out = {};
  for (const argument of argv) {
    const match = argument.match(/^--(target|mode|report|artifacts|output)=(.+)$/);
    if (!match || out[match[1]] !== undefined) fail(`invalid argument: ${argument}`);
    out[match[1]] = match[2];
  }
  if (!TARGETS[out.target]) fail("required --target=staging|production");
  if (!new Set(["validate", "apply"]).has(out.mode)) fail("required --mode=validate|apply");
  for (const key of ["report", "artifacts", "output"]) {
    if (!out[key]) fail(`required --${key}=<path>`);
    out[key] = path.resolve(out[key]);
    const relative = path.relative(path.join(ROOT, "tmp"), out[key]);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("executor paths must be inside tmp");
  }
  return out;
}
function roleCredential(target, kind) {
  const contract = TARGETS[target];
  const file = contract.file(kind);
  if (!fs.existsSync(file)) fail(`${target} ${kind} credential missing`);
  const values = loadEnv(file);
  const expectedRole = `retailer_catalogue_${target}_${kind}`;
  const urlKey = target === "staging" ? `${contract.prefix}_${kind.toUpperCase()}_DATABASE_URL` : Object.keys(values).find((key) => key.endsWith(`${kind.toUpperCase()}_DATABASE_URL`) || key.endsWith("DATABASE_URL"));
  const roleKey = target === "staging" ? `${contract.prefix}_${kind.toUpperCase()}_ROLE` : Object.keys(values).find((key) => key.endsWith(`${kind.toUpperCase()}_ROLE`) || key.endsWith("ROLE"));
  const raw = values[urlKey];
  if (!raw || (values[roleKey] && values[roleKey] !== expectedRole)) fail(`${target} ${kind} credential contract mismatch`);
  const url = new URL(raw); url.searchParams.delete("sslmode");
  if (!url.href.includes(contract.ref) || Object.values(TARGETS).some((other) => other.ref !== contract.ref && url.href.includes(other.ref))) fail(`${target} ${kind} target mismatch`);
  return { url: url.href, role: expectedRole };
}
async function roleCall(target, kind, callback) {
  const credential = roleCredential(target, kind);
  const client = new Client({ connectionString: credential.url, ssl: { rejectUnauthorized: false }, application_name: `simply-identity-${target}-${kind}`, options: "-c statement_timeout=120000" });
  await client.connect();
  try {
    await client.query("begin");
    const marker = target === "staging" ? "app.retailer_catalogue_staging_marker" : "app.retailer_catalogue_production_marker";
    await client.query("select set_config($1,'1',true),set_config('app.retailer_catalogue_allow','1',true)", [marker]);
    await client.query(`set role ${credential.role}`);
    const current = (await client.query("select current_user")).rows[0].current_user;
    if (current !== credential.role) fail(`${target} ${kind} role mismatch`);
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally { await client.end(); }
}
function validateInputs(options) {
  const report = JSON.parse(fs.readFileSync(options.report, "utf8"));
  if (report.kind !== "simply-supplements-complete-identity-plan-set-v2" || report.result !== "PASS"
      || report.target_environment !== options.target.toUpperCase() || report.target_project_ref !== TARGETS[options.target].ref
      || report.approval_fingerprint !== authorization.artifact_fingerprint || report.reviewed_scope_count !== 120
      || report.remaining_plan_count + report.completed_mapping_count !== 120 || report.database_writes !== 0
      || report.expected_deltas?.mapping_identity_updates !== report.remaining_plan_count
      || report.expected_deltas?.mapping_external_options_updates !== report.remaining_plan_count
      || report.expected_deltas?.mapping_url_updates !== 0 || report.expected_deltas?.offer_updates !== 0
      || report.expected_deltas?.price_history_inserts !== 0 || report.expected_deltas?.row_creates !== 0 || report.expected_deltas?.row_deletes !== 0) {
    fail("Simply identity builder report mismatch");
  }
  const loaded = [];
  for (const expected of report.plans) {
    const value = loadDryRunArtifact(path.join(options.artifacts, expected.file));
    const artifact = value.artifact;
    if (value.artifactSha256 !== expected.artifact_sha256 || artifact.plans.length !== 1 || artifact.blocked_rows.length !== 0 || artifact.environment_marker !== options.target) fail(`artifact mismatch ${expected.mapping_id}`);
    const entry = artifact.plans[0], plan = entry.resolved_plan, source = artifact.source_rows[0]?.normalized_source_row || {};
    if (entry.operation_type !== "legacy_mapping_upgrade" || String(entry.retailer_id) !== "7" || String(entry.retailer_product_id) !== expected.mapping_id
        || entry.plan_fingerprint !== expected.plan_fingerprint || entry.source_row_fingerprint !== expected.source_row_fingerprint
        || plan.product?.action !== "existing" || plan.product_variant?.action !== "existing" || plan.retailer?.action !== "existing"
        || plan.retailer_product?.action !== "update" || plan.offer?.action !== "noop" || plan.price_history?.action !== "noop"
        || String(plan.offer?.id) !== expected.offer_id || source.legacy_mapping_upgrade !== "true" || source.legacy_mapping_identity_only !== "true"
        || source.legacy_duplicate_source_listing !== "false" || source.legacy_identity_drift !== "false"
        || plan.expected_state?.retailer_product?.external_product_id !== null || plan.expected_state?.retailer_product?.external_variant_id !== null
        || plan.expected_state?.retailer_product?.external_sku !== null || plan.expected_state?.retailer_product?.external_options !== null
        || JSON.stringify(plan.retailer_product?.values?.external_options) !== source.external_options
        || plan.retailer_product?.values?.external_product_id !== source.external_product_id
        || plan.retailer_product?.values?.external_variant_id !== source.external_variant_id
        || plan.retailer_product?.values?.external_sku !== source.external_sku
        || plan.retailer_product?.values?.external_url !== plan.expected_state?.retailer_product?.external_url
        || plan.offer?.values?.url !== plan.expected_state?.offer?.url
        || plan.offer?.values?.price !== plan.expected_state?.offer?.price
        || plan.offer?.values?.shipping_cost !== plan.expected_state?.offer?.shipping_cost
        || plan.offer?.values?.total_price !== plan.expected_state?.offer?.total_price
        || plan.offer?.values?.in_stock !== plan.expected_state?.offer?.in_stock) fail(`resolved plan mismatch ${expected.mapping_id}`);
    loaded.push({ expected, ...value, entry });
  }
  if (new Set([...loaded.map((row) => row.expected.mapping_id), ...report.completed_mapping_ids.map(String)]).size !== 120) fail("Simply identity execution scope incomplete");
  return { report, loaded };
}
async function validatePlan(target, row) {
  return roleCall(target, "validator", async (client) => (await client.query("select public.validate_product_import_plan_read_only($1::jsonb) result", [row.entry.resolved_plan])).rows[0].result);
}
function isAcceptedValidation(validation, row) {
  return validation?.valid === true || (
    String(validation?.retailer_id) === String(row.entry.retailer_id)
    && validation?.plan_kind === row.entry.plan_kind
  );
}
async function executePlan(target, row) {
  const plan = row.entry.resolved_plan;
  const approval = await roleCall(target, "approver", async (client) => (await client.query("select public.approve_product_import_plan($1::jsonb,$2,$3,$4,now()+interval '15 minutes') result", [plan, row.artifactSha256, row.artifact.run_id, `simply-identity-${authorization.artifact_fingerprint.slice(0, 12)}`])).rows[0].result);
  if (approval.status !== "approved" || approval.artifact_sha256 !== row.artifactSha256 || approval.plan_fingerprint !== row.entry.plan_fingerprint || approval.source_row_fingerprint !== row.entry.source_row_fingerprint || approval.run_id !== row.artifact.run_id) fail(`approval mismatch ${row.expected.mapping_id}`);
  const result = await roleCall(target, "executor", async (client) => (await client.query("select public.apply_approved_product_import_plan($1::uuid,$2,$3,$4,$5::bigint,$6,$7) result", [approval.approval_id, row.artifactSha256, row.entry.plan_fingerprint, row.entry.source_row_fingerprint, row.entry.retailer_id, row.entry.plan_kind, row.artifact.run_id])).rows[0].result);
  if (result.approval_status !== "consumed" || result.plan_fingerprint !== row.entry.plan_fingerprint || String(result.retailer_product_id) !== row.expected.mapping_id || String(result.offer_id) !== row.expected.offer_id || result.price_history_id != null || result.offer_action !== "noop") fail(`execution mismatch ${row.expected.mapping_id}`);
  return { mapping_id: row.expected.mapping_id, offer_id: row.expected.offer_id, approval_id: approval.approval_id, consumed_at: result.consumed_at };
}
async function run(options) {
  const validated = validateInputs(options), rows = [];
  for (const row of validated.loaded) {
    const validation = await validatePlan(options.target, row);
    if (!isAcceptedValidation(validation, row)) fail(`validator rejected mapping ${row.expected.mapping_id}: ${JSON.stringify(validation)}`);
    if (options.mode === "apply") rows.push(await executePlan(options.target, row));
  }
  const report = { schema_version: 1, kind: "simply-supplements-identity-execution-v1", result: "PASS", mode: options.mode, target_environment: options.target.toUpperCase(), target_project_ref: TARGETS[options.target].ref, approval_fingerprint: authorization.artifact_fingerprint, validated_plan_count: validated.loaded.length, previously_completed_count: validated.report.completed_mapping_count, executed_plan_count: rows.length, rows, completed_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  return report;
}
if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify({ result: report.result, target: report.target_environment, mode: report.mode, validated: report.validated_plan_count, executed: report.executed_plan_count }, null, 2))).catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
module.exports = { parseArgs, roleCredential, validateInputs, isAcceptedValidation };
