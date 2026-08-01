const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { loadDryRunArtifact } = require("./import-products");
const { assertApproval, inspectVariants } = require("./gym-high-reviewed-catalogue-bootstrap");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const APPROVAL_FINGERPRINT = "feda6c5cc6f03556dbadfb2e56dc7216150d502a70cee03b1880ec35ec37ad59";
const APPROVAL = path.join(ROOT, "config", "retailers", "gym-high-reviewed-full-catalogue-2026-08-01.json");

function fail(message) { throw new Error(message); }

function parseArgs(argv) {
  const out = {};
  for (const argument of argv) {
    const match = argument.match(/^--(mode|report|artifact|output)=(.*)$/);
    if (!match || out[match[1]] !== undefined) fail(`Invalid argument ${argument}`);
    out[match[1]] = match[2];
  }
  if (!["validate", "apply"].includes(out.mode)) fail("Required --mode=validate|apply");
  for (const key of ["report", "artifact", "output"]) {
    if (!out[key]) fail(`Required --${key}=<path>`);
    out[key] = path.resolve(out[key]);
  }
  const relative = path.relative(path.join(ROOT, "tmp"), out.output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return out;
}

function credential(kind) {
  const value = process.env[`GYM_HIGH_${kind.toUpperCase()}_DATABASE_URL`];
  if (!value) fail(`Missing GYM_HIGH_${kind.toUpperCase()}_DATABASE_URL`);
  const parsed = new URL(value);
  parsed.searchParams.delete("sslmode");
  if (parsed.href.includes("hxnrsyyqffztlvcrtgbf")) fail(`${kind} credential points to staging`);
  return parsed.href;
}

async function openRoleClient(kind) {
  const client = new Client({
    connectionString: credential(kind),
    ssl: { rejectUnauthorized: false },
    application_name: `gym-high-full-catalogue-${kind}`,
    options: "-c statement_timeout=120000",
  });
  await client.connect();
  return client;
}

async function roleTransaction(client, kind, callback) {
  try {
    await client.query("begin");
    await client.query("select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)");
    await client.query(`set role retailer_catalogue_production_${kind}`);
    const identity = (await client.query("select current_user")).rows[0].current_user;
    if (identity !== `retailer_catalogue_production_${kind}`) fail(`${kind} role mismatch`);
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  }
}

function validateInputs(options, dependencies = {}) {
  const approval = assertApproval(dependencies.approval || JSON.parse(fs.readFileSync(APPROVAL, "utf8")));
  const report = dependencies.report || JSON.parse(fs.readFileSync(options.report, "utf8"));
  const loaded = dependencies.loaded || loadDryRunArtifact(options.artifact);
  const artifact = loaded.artifact;
  if (
    report.result !== "PASS" || report.kind !== "gym-high-reviewed-full-catalogue-feed" || report.database_writes !== 0 ||
    report.target_project_ref !== PROJECT_REF || report.approval_fingerprint !== APPROVAL_FINGERPRINT ||
    report.approved_row_count !== 66 || report.row_artifact_count !== 66 ||
    report.existing_mapping_count + report.mapping_create_count !== 66 ||
    report.existing_offer_count + report.offer_create_count !== 66 ||
    artifact.environment_marker !== "local" || artifact.plans.length !== 66 || artifact.source_rows.length !== 66 ||
    artifact.blocked_rows.length !== 0 || artifact.source_file_sha256 !== report.csv_sha256
  ) fail("GYM HIGH full-catalogue report or artifact mismatch");

  const approved = new Map();
  for (const family of approval.families) for (const variant of family.variants) {
    approved.set(`${family.external_product_id}:${variant.external_variant_id}`, { family, variant });
  }
  const sourceByRow = new Map(artifact.source_rows.map((row) => [String(row.row_number), row.normalized_source_row]));
  const variantsByFamily = new Map();
  const seen = new Set();
  const plans = [];
  for (const entry of artifact.plans) {
    const source = sourceByRow.get(String(entry.row_number));
    const plan = entry.resolved_plan;
    const key = `${source?.external_product_id}:${source?.external_variant_id}`;
    const spec = approved.get(key);
    if (!spec || seen.has(key)) fail(`Unapproved or duplicate source row ${key}`);
    let url;
    try { url = new URL(plan.offer?.values?.url); } catch { fail(`Invalid offer URL for ${key}`); }
    if (
      entry.operation_type !== "standard_import" || entry.plan_kind !== "feed" || String(entry.retailer_id) !== "1" ||
      plan.product?.action !== "existing" || String(plan.product.id) !== String(spec.family.product_id) ||
      plan.product_variant?.action !== "existing" || String(plan.product_variant.id) !== String(source.product_variant_id) ||
      plan.retailer?.action !== "existing" || String(plan.retailer.id) !== "1" ||
      !["create", "update", "noop"].includes(plan.retailer_product?.action) ||
      !["create", "update", "verify_no_change", "noop"].includes(plan.offer?.action) ||
      !["create", "noop"].includes(plan.price_history?.action) ||
      String(source.product_id) !== String(spec.family.product_id) || source.product_name !== spec.family.expected_name ||
      source.retailer_name !== "GYM HIGH" || source.retailer_website !== "https://gymhigh.co.uk" ||
      source.shipping_known !== "false" || source.shipping_cost != null || source.is_for_sale !== "true" ||
      url.protocol !== "https:" || url.hostname !== "gymhigh.co.uk"
    ) fail(`Unsafe resolved plan for ${key}`);
    const expected = plan.expected_state?.product_variant;
    if (!expected || String(expected.id) !== String(plan.product_variant.id) || String(expected.product_id) !== String(spec.family.product_id) || expected.is_active !== true) fail(`Canonical variant evidence mismatch for ${key}`);
    if (!variantsByFamily.has(String(spec.family.external_product_id))) variantsByFamily.set(String(spec.family.external_product_id), []);
    variantsByFamily.get(String(spec.family.external_product_id)).push(expected);
    if (plan.retailer_product.action === "create" && plan.expected_state?.retailer_product != null) fail(`Mapping create precondition mismatch for ${key}`);
    if (plan.offer.action === "create" && plan.expected_state?.offer != null) fail(`Offer create precondition mismatch for ${key}`);
    seen.add(key);
    plans.push(entry);
  }
  if (seen.size !== 66) fail("GYM HIGH execution scope is incomplete");
  for (const family of approval.families) {
    const inspected = inspectVariants(family, variantsByFamily.get(String(family.external_product_id)) || []);
    if (inspected.length !== family.variants.length || inspected.some((row) => row.action === "CREATE_VARIANT")) fail(`Canonical family binding mismatch for ${family.external_product_id}`);
  }
  return { loaded, plans: plans.sort((a, b) => Number(a.row_number) - Number(b.row_number)) };
}

function validateScheduledPlans(validated, report) {
  if (report.existing_mapping_count !== 66 || report.mapping_create_count !== 0 || report.existing_offer_count !== 66 || report.offer_create_count !== 0) fail("Scheduled refresh cannot create catalogue state");
  let changed = 0;
  let priceChanged = 0;
  let newOutOfStock = 0;
  let currentOutOfStock = 0;
  let previousOutOfStock = 0;
  for (const entry of validated.plans) {
    const plan = entry.resolved_plan;
    const beforeMapping = plan.expected_state?.retailer_product;
    const before = plan.expected_state?.offer;
    const after = plan.offer?.values;
    if (!beforeMapping || !before || !after || !["update", "noop"].includes(plan.retailer_product.action) || !["update", "verify_no_change", "noop"].includes(plan.offer.action)) fail(`Scheduled refresh contains a create for row ${entry.row_number}`);
    if ((before.shipping_cost ?? null) !== (after.shipping_cost ?? null)) fail(`Scheduled refresh changed unverified shipping for row ${entry.row_number}`);
    let url;
    try { url = new URL(after.url); } catch { fail(`Scheduled refresh URL is invalid for row ${entry.row_number}`); }
    if (url.protocol !== "https:" || url.hostname !== "gymhigh.co.uk") fail(`Scheduled refresh URL escaped GYM HIGH for row ${entry.row_number}`);
    const priceChange = Number(before.price) !== Number(after.price);
    const stockChange = before.in_stock !== after.in_stock;
    const urlChange = before.url !== after.url;
    if (priceChange || stockChange || urlChange) changed += 1;
    if (priceChange) {
      priceChanged += 1;
      const absolute = Math.abs(Number(after.price) - Number(before.price));
      const ratio = absolute / Math.max(0.01, Number(before.price));
      if (ratio >= 0.6 || absolute >= 20) fail(`Scheduled refresh hard price anomaly for row ${entry.row_number}`);
    }
    if (before.in_stock === true && after.in_stock === false) newOutOfStock += 1;
    if (before.in_stock === false) previousOutOfStock += 1;
    if (after.in_stock === false) currentOutOfStock += 1;
  }
  const total = validated.plans.length;
  if (changed / total > 0.2 || priceChanged / total >= 0.1 || newOutOfStock >= 4 || currentOutOfStock / total > 0.35 || (currentOutOfStock - previousOutOfStock) / total > 0.05) fail("Scheduled refresh violates batch anomaly guardrails");
}

async function executeEntry(entry, artifactSha256, runId, clients) {
  const approval = await roleTransaction(clients.approver, "approver", async (client) => (await client.query(
    "select public.approve_product_import_plan($1::jsonb,$2,$3,$4,now()+interval '15 minutes') result",
    [entry.resolved_plan, artifactSha256, runId, "gym-high-reviewed-full-catalogue-v1"]
  )).rows[0].result);
  if (approval.status !== "approved" || approval.artifact_sha256 !== artifactSha256 || approval.plan_fingerprint !== entry.plan_fingerprint || approval.source_row_fingerprint !== entry.source_row_fingerprint || approval.run_id !== runId) fail(`Approval mismatch for row ${entry.row_number}`);
  const result = await roleTransaction(clients.executor, "executor", async (client) => (await client.query(
    "select public.apply_approved_product_import_plan($1::uuid,$2,$3,$4,$5::bigint,$6,$7) result",
    [approval.approval_id, artifactSha256, entry.plan_fingerprint, entry.source_row_fingerprint, entry.retailer_id, entry.plan_kind, runId]
  )).rows[0].result);
  if (result.approval_status !== "consumed" || result.plan_fingerprint !== entry.plan_fingerprint || result.source_row_fingerprint !== entry.source_row_fingerprint || result.retailer_product_id == null || result.offer_id == null) fail(`Execution mismatch for row ${entry.row_number}`);
  return { row_number: entry.row_number, approval_id: approval.approval_id, retailer_product_id: String(result.retailer_product_id), offer_id: String(result.offer_id), price_history_id: result.price_history_id == null ? null : String(result.price_history_id) };
}

async function run(options) {
  const event = process.env.GITHUB_EVENT_NAME;
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_REPOSITORY !== "SupplementScout/supplementscout" || !["workflow_dispatch", "schedule"].includes(event) || process.env.GYM_HIGH_APPROVAL_FINGERPRINT !== APPROVAL_FINGERPRINT) fail("GYM HIGH full-catalogue execution requires the protected GitHub context on main");
  const validated = validateInputs(options);
  const builderReport = JSON.parse(fs.readFileSync(options.report, "utf8"));
  if (event === "schedule") {
    if (options.mode !== "apply") fail("Scheduled GYM HIGH refresh must use guarded apply mode");
    validateScheduledPlans(validated, builderReport);
  }
  const rows = [];
  const clients = {};
  try {
    if (options.mode === "apply") {
      clients.approver = await openRoleClient("approver");
      clients.executor = await openRoleClient("executor");
      for (const entry of validated.plans) rows.push(await executeEntry(entry, validated.loaded.artifactSha256, validated.loaded.artifact.run_id, clients));
    }
  } finally {
    await Promise.allSettled(Object.values(clients).map((client) => client.end()));
  }
  const report = { schema_version: 1, kind: "gym-high-reviewed-full-catalogue-execution", result: "PASS", mode: options.mode, target_project_ref: PROJECT_REF, approval_fingerprint: APPROVAL_FINGERPRINT, validated_plan_count: validated.plans.length, executed_plan_count: rows.length, rows, completed_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify({ result: report.result, mode: report.mode, validated: report.validated_plan_count, executed: report.executed_plan_count }, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { parseArgs, validateInputs, validateScheduledPlans };
