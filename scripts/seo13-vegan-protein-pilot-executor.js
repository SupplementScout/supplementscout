const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { loadDryRunArtifact } = require("./import-products");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const KIND = "seo13-vegan-protein-production-pilot-v1";
const EXPECTED_SCOPE = [
  { retailer_id: "1", product_id: "390", product_variant_id: "1064", retailer_product_action: "update", offer_action: "identity_update" },
  { retailer_id: "5", product_id: "70", product_variant_id: "1623", retailer_product_action: "create", offer_action: "create" },
];

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }

function parseArgs(argv) {
  const options = {};
  const allowed = new Set(["mode", "scope", "rollout", "output"]);
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.*)$/);
    if (!match || !allowed.has(match[1]) || options[match[1]] !== undefined) fail(`Invalid argument ${argument}`);
    options[match[1]] = match[2];
  }
  if (!new Set(["validate", "apply"]).has(options.mode)) fail("Required --mode=validate|apply");
  if (!new Set(["dolphin", "all"]).has(options.scope)) fail("Required --scope=dolphin|all");
  for (const key of ["rollout", "output"]) {
    if (!options[key]) fail(`Required --${key}=<path>`);
    options[key] = path.resolve(options[key]);
  }
  const relativeOutput = path.relative(path.join(ROOT, "tmp"), options.output);
  if (!relativeOutput || relativeOutput.startsWith("..") || path.isAbsolute(relativeOutput)) fail("Output must be inside repository tmp");
  return options;
}

function validateRollout(rolloutPath) {
  const rollout = JSON.parse(fs.readFileSync(rolloutPath, "utf8"));
  const fingerprint = sha256(JSON.stringify({ ...rollout, rollout_fingerprint: null }));
  if (
    rollout.schema_version !== 1 || rollout.kind !== KIND || rollout.approved !== true ||
    rollout.target_project_ref !== PROJECT_REF || rollout.rollout_fingerprint !== fingerprint ||
    !Array.isArray(rollout.entries) || rollout.entries.length !== EXPECTED_SCOPE.length
  ) fail("Rollout approval, target, scope or fingerprint mismatch");

  const plans = rollout.entries.map((entry, index) => {
    const expected = EXPECTED_SCOPE[index];
    for (const [key, value] of Object.entries(expected)) {
      if (String(entry[key]) !== value) fail(`Entry ${index + 1} scope mismatch for ${key}`);
    }
    const artifactPath = path.resolve(ROOT, entry.artifact);
    const csvPath = path.resolve(ROOT, entry.csv);
    for (const resolved of [artifactPath, csvPath]) {
      const relative = path.relative(path.join(ROOT, "docs", "rollouts", "seo13-vegan-protein-pilot"), resolved);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Pilot inputs must remain inside the reviewed rollout directory");
    }
    const loaded = loadDryRunArtifact(artifactPath);
    const csvSha = sha256(fs.readFileSync(csvPath));
    if (
      loaded.artifactSha256 !== entry.artifact_sha256 || csvSha !== entry.csv_sha256 ||
      loaded.artifact.source_file_sha256 !== csvSha || loaded.artifact.plans.length !== 1 ||
      loaded.artifact.blocked_rows.length !== 0
    ) fail(`Entry ${index + 1} artifact or source hash mismatch`);
    const planEntry = loaded.artifact.plans[0];
    const plan = planEntry.resolved_plan;
    if (
      planEntry.plan_fingerprint !== entry.plan_fingerprint ||
      String(planEntry.retailer_id) !== expected.retailer_id ||
      String(plan.product?.id) !== expected.product_id || plan.product?.action !== "existing" ||
      String(plan.product_variant?.id) !== expected.product_variant_id || plan.product_variant?.action !== "existing" ||
      plan.retailer_product?.action !== expected.retailer_product_action ||
      plan.offer?.action !== expected.offer_action
    ) fail(`Entry ${index + 1} plan identity or mutation scope mismatch`);
    return { loaded, entry: planEntry };
  });
  return { rollout, plans };
}

function credential(kind) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY must not be present");
  const value = process.env[`SEO13_SYNC_${kind.toUpperCase()}_DATABASE_URL`];
  if (!value) fail(`Missing SEO13_SYNC_${kind.toUpperCase()}_DATABASE_URL`);
  const parsed = new URL(value);
  parsed.searchParams.delete("sslmode");
  if (parsed.href.includes("hxnrsyyqffztlvcrtgbf")) fail(`${kind} credential points to staging`);
  return parsed.href;
}

async function roleCall(kind, callback) {
  const client = new Client({
    connectionString: credential(kind), ssl: { rejectUnauthorized: false },
    application_name: `seo13-vegan-protein-${kind}`, options: "-c statement_timeout=120000",
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
  } finally { await client.end(); }
}

async function executePlan(item) {
  const { loaded, entry } = item;
  const approval = await roleCall("approver", async (client) => {
    const response = await client.query(
      "select public.approve_product_import_plan($1::jsonb,$2,$3,$4,now()+interval '15 minutes') result",
      [entry.resolved_plan, loaded.artifactSha256, loaded.artifact.run_id, KIND]
    );
    return response.rows[0].result;
  });
  if (
    approval?.status !== "approved" || approval.artifact_sha256 !== loaded.artifactSha256 ||
    approval.plan_fingerprint !== entry.plan_fingerprint || approval.source_row_fingerprint !== entry.source_row_fingerprint
  ) fail("Approval metadata mismatch");
  const applied = await roleCall("executor", async (client) => {
    const response = await client.query(
      "select public.apply_approved_product_import_plan($1::uuid,$2,$3,$4,$5::bigint,$6,$7) result",
      [approval.approval_id, loaded.artifactSha256, entry.plan_fingerprint, entry.source_row_fingerprint, entry.retailer_id, entry.plan_kind, loaded.artifact.run_id]
    );
    return response.rows[0].result;
  });
  if (applied?.approval_status !== "consumed" || applied.plan_fingerprint !== entry.plan_fingerprint) fail("Apply metadata mismatch");
  return { approval_id: approval.approval_id, consumed_at: applied.consumed_at, retailer_id: applied.retailer_id, retailer_product_id: applied.retailer_product_id, offer_id: applied.offer_id, price_history_id: applied.price_history_id };
}

async function run(options) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch") {
    fail("Production pilot is restricted to a manual GitHub Actions dispatch on main");
  }
  const { rollout, plans } = validateRollout(options.rollout);
  const selectedPlans = options.scope === "dolphin" ? plans.slice(1, 2) : plans;
  const rows = [];
  if (options.mode === "apply") {
    for (const item of selectedPlans) rows.push(await executePlan(item));
  }
  const report = { schema_version: 1, kind: `${KIND}-${options.mode}`, scope: options.scope, rollout_fingerprint: rollout.rollout_fingerprint, validated_plan_count: selectedPlans.length, executed_plan_count: rows.length, rows, completed_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify({ result: "PASS", mode: report.kind, validated: report.validated_plan_count, executed: report.executed_plan_count }))).catch((error) => { console.error(error.message); process.exit(1); });
}

module.exports = { EXPECTED_SCOPE, parseArgs, validateRollout };
