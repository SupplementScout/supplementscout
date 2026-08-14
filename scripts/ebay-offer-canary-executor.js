const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { loadDryRunArtifact } = require("./import-products");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const KIND = "ebay-offer-canary-bootstrap-v1";
const CONFIRMATION = "OWNER_APPROVED_EBAY_BATCH_A_BOOTSTRAP_1";
const ROLLOUT_PATH = path.join(ROOT, "docs", "rollouts", "ebay-offer-canary", "rollout.json");
const EXPECTED_SCOPE = {
  product_id: "10",
  product_variant_id: "1704",
  gtin: "5999076263851",
  external_product_id: "323304007010",
  external_variant_id: "v1|323304007010|515705810394",
  retailer_action: "create",
  retailer_product_action: "create",
  offer_action: "create",
};

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }

function parseArgs(argv) {
  const options = {};
  for (const argument of argv) {
    const match = argument.match(/^--(mode|output)=(.*)$/);
    if (!match || options[match[1]] !== undefined) fail(`Invalid argument ${argument}`);
    options[match[1]] = match[2];
  }
  if (!new Set(["validate", "apply"]).has(options.mode)) fail("Required --mode=validate|apply");
  if (!options.output) fail("Required --output=<path>");
  options.output = path.resolve(options.output);
  const relative = path.relative(path.join(ROOT, "tmp"), options.output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return options;
}

function validateRollout() {
  const rollout = JSON.parse(fs.readFileSync(ROLLOUT_PATH, "utf8"));
  const fingerprint = sha256(JSON.stringify({ ...rollout, rollout_fingerprint: null }));
  if (
    rollout.schema_version !== 1 || rollout.kind !== KIND || rollout.approved !== true ||
    rollout.owner_confirmation !== CONFIRMATION || rollout.target_project_ref !== PROJECT_REF ||
    rollout.rollout_fingerprint !== fingerprint || JSON.stringify(rollout.scope) !== JSON.stringify(EXPECTED_SCOPE)
  ) fail("Rollout approval, target, scope or fingerprint mismatch");

  const csvPath = path.resolve(ROOT, rollout.csv);
  const artifactPath = path.resolve(ROOT, rollout.artifact);
  const reviewedDirectory = path.join(ROOT, "docs", "rollouts", "ebay-offer-canary");
  for (const resolved of [csvPath, artifactPath]) {
    const relative = path.relative(reviewedDirectory, resolved);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Inputs must remain inside the reviewed rollout directory");
  }
  const loaded = loadDryRunArtifact(artifactPath);
  const csvSha = sha256(fs.readFileSync(csvPath));
  if (
    loaded.artifactSha256 !== rollout.artifact_sha256 || csvSha !== rollout.csv_sha256 ||
    loaded.artifact.source_file_sha256 !== csvSha || loaded.artifact.plans.length !== 1 ||
    loaded.artifact.blocked_rows.length !== 0
  ) fail("Artifact or source hash mismatch");

  const entry = loaded.artifact.plans[0];
  const plan = entry.resolved_plan;
  if (
    entry.plan_fingerprint !== rollout.plan_fingerprint ||
    entry.source_row_fingerprint !== rollout.source_row_fingerprint || entry.plan_kind !== "manual" ||
    entry.retailer_id !== null || String(plan.product?.id) !== EXPECTED_SCOPE.product_id || plan.product?.action !== "existing" ||
    String(plan.product_variant?.id) !== EXPECTED_SCOPE.product_variant_id || plan.product_variant?.action !== "existing" ||
    plan.product_variant?.evidence?.flavour !== "vanilla" || String(plan.product_variant?.evidence?.size_value) !== "1816" ||
    plan.product_variant?.evidence?.size_unit !== "g" || String(plan.product_variant?.evidence?.pack_count) !== "1" ||
    plan.product_variant?.evidence?.product_format !== "powder" || plan.retailer?.action !== EXPECTED_SCOPE.retailer_action ||
    plan.retailer?.values?.slug !== "ebay-uk" || plan.retailer_product?.action !== EXPECTED_SCOPE.retailer_product_action ||
    plan.retailer_product?.values?.external_gtin !== EXPECTED_SCOPE.gtin ||
    plan.retailer_product?.values?.external_product_id !== EXPECTED_SCOPE.external_product_id ||
    plan.retailer_product?.values?.external_variant_id !== EXPECTED_SCOPE.external_variant_id ||
    plan.retailer_product?.values?.match_method !== "gtin" || String(plan.retailer_product?.values?.match_confidence) !== "100" ||
    plan.offer?.action !== EXPECTED_SCOPE.offer_action || plan.offer?.values?.price !== "77.99" ||
    plan.offer?.values?.shipping_cost !== "0" || plan.offer?.values?.total_price !== "77.99" ||
    plan.offer?.values?.in_stock !== true || !/[?&]campid=\d+/.test(plan.offer?.values?.url || "")
  ) fail("Reviewed plan identity or mutation scope mismatch");
  return { rollout, loaded, entry };
}

function credential(kind) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY must not be present");
  const value = process.env[`EBAY_CANARY_${kind.toUpperCase()}_DATABASE_URL`];
  if (!value) fail(`Missing EBAY_CANARY_${kind.toUpperCase()}_DATABASE_URL`);
  const parsed = new URL(value);
  parsed.searchParams.delete("sslmode");
  if (parsed.href.includes("hxnrsyyqffztlvcrtgbf")) fail(`${kind} credential points to staging`);
  return parsed.href;
}

async function roleCall(kind, callback) {
  const client = new Client({
    connectionString: credential(kind),
    ssl: { rejectUnauthorized: false },
    application_name: `ebay-offer-canary-${kind}`,
    options: "-c statement_timeout=120000",
  });
  await client.connect();
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
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

async function executePlan(item) {
  const { loaded, entry } = item;
  const approval = await roleCall("approver", async (client) => (await client.query(
    "select public.approve_product_import_plan($1::jsonb,$2,$3,$4,now()+interval '15 minutes') result",
    [entry.resolved_plan, loaded.artifactSha256, loaded.artifact.run_id, KIND]
  )).rows[0].result);
  if (
    approval?.status !== "approved" || approval.artifact_sha256 !== loaded.artifactSha256 ||
    approval.plan_fingerprint !== entry.plan_fingerprint || approval.source_row_fingerprint !== entry.source_row_fingerprint
  ) fail("Approval metadata mismatch");
  const applied = await roleCall("executor", async (client) => (await client.query(
    "select public.apply_approved_product_import_plan($1::uuid,$2,$3,$4,$5::bigint,$6,$7) result",
    [approval.approval_id, loaded.artifactSha256, entry.plan_fingerprint, entry.source_row_fingerprint, null, entry.plan_kind, loaded.artifact.run_id]
  )).rows[0].result);
  if (applied?.approval_status !== "consumed" || applied.plan_fingerprint !== entry.plan_fingerprint) fail("Apply metadata mismatch");
  return {
    approval_id: approval.approval_id,
    consumed_at: applied.consumed_at,
    retailer_id: applied.retailer_id,
    retailer_product_id: applied.retailer_product_id,
    offer_id: applied.offer_id,
    price_history_id: applied.price_history_id,
  };
}

async function run(options) {
  if (
    process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" ||
    process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    process.env.EBAY_CANARY_OWNER_CONFIRMATION !== CONFIRMATION
  ) fail("Production canary requires the exact owner-approved manual GitHub Actions dispatch on main");
  const item = validateRollout();
  const rows = options.mode === "apply" ? [await executePlan(item)] : [];
  const report = {
    schema_version: 1,
    kind: `${KIND}-${options.mode}`,
    rollout_fingerprint: item.rollout.rollout_fingerprint,
    validated_plan_count: 1,
    executed_plan_count: rows.length,
    rows,
    completed_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2)))
    .then((report) => console.log(JSON.stringify({ result: "PASS", validated: report.validated_plan_count, executed: report.executed_plan_count })))
    .catch((error) => { console.error(error.message); process.exit(1); });
}

module.exports = { CONFIRMATION, EXPECTED_SCOPE, parseArgs, validateRollout };
