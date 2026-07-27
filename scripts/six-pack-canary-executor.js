const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { loadDryRunArtifact } = require("./import-products");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const EXPECTED_RETAILER_SLUG = "6-pack-supplements";
const APPROVED_ROLLOUT_KINDS = new Map([
  ["six-pack-production-canary-v1", 6],
  ["six-pack-production-expansion-v1", 9],
  ["six-pack-production-expansion-v2", 7],
  ["six-pack-production-family-v3", 21],
  ["six-pack-production-expansion-v4", 35],
  ["six-pack-production-expansion-v5", 17],
  ["six-pack-production-expansion-v6", 19],
  ["six-pack-production-expansion-v7", 75],
  ["six-pack-production-shipping-v1", 15],
]);

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseArgs(argv) {
  const out = {};
  const allowed = new Set(["artifact", "csv", "rollout", "mode", "output"]);
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.*)$/);
    if (!match || !allowed.has(match[1]) || out[match[1]] !== undefined) fail(`Invalid argument ${argument}`);
    out[match[1]] = match[2];
  }
  if (!["bootstrap", "all"].includes(out.mode)) fail("Required --mode=bootstrap|all");
  for (const key of ["artifact", "csv", "rollout", "output"]) {
    if (!out[key]) fail(`Required --${key}=<path>`);
    out[key] = path.resolve(out[key]);
  }
  const relative = path.relative(path.join(ROOT, "tmp"), out.output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return out;
}

function validateRollout(options, loaded) {
  const csv = fs.readFileSync(options.csv);
  const rollout = JSON.parse(fs.readFileSync(options.rollout, "utf8"));
  const fingerprint = sha256(JSON.stringify({ ...rollout, rollout_fingerprint: null }));
  const expectedCount = APPROVED_ROLLOUT_KINDS.get(rollout.kind);
  if (
    rollout.approved !== true ||
    !expectedCount ||
    rollout.target_project_ref !== PROJECT_REF ||
    rollout.retailer_slug !== EXPECTED_RETAILER_SLUG ||
    rollout.row_count !== expectedCount ||
    rollout.csv_sha256 !== sha256(csv) ||
    rollout.csv_sha256 !== loaded.artifact.source_file_sha256 ||
    rollout.rollout_fingerprint !== fingerprint
  ) fail("Rollout approval, target, source hash or fingerprint mismatch");
  const artifactIds = loaded.artifact.source_rows
    .map((row) => String(row.normalized_source_row.external_variant_id))
    .sort();
  if (
    loaded.artifact.plans.length !== expectedCount ||
    JSON.stringify(artifactIds) !== JSON.stringify(rollout.expected_external_variant_ids)
  ) fail(`Dry-run artifact does not contain the exact approved ${expectedCount}-row scope`);
  return rollout;
}

function plansForMode(artifact, mode) {
  const plans = [...artifact.plans].sort((left, right) => Number(left.row_number) - Number(right.row_number));
  const retailerActions = new Set(plans.map((entry) => entry.resolved_plan?.retailer?.action));
  if (mode === "bootstrap") {
    if (retailerActions.size === 1 && retailerActions.has("existing")) return [];
    if (retailerActions.size !== 1 || !retailerActions.has("create")) fail("Bootstrap artifact has mixed or unexpected retailer actions");
    const slugs = new Set(plans.map((entry) => entry.resolved_plan.retailer.values?.slug));
    if (slugs.size !== 1 || !slugs.has(EXPECTED_RETAILER_SLUG)) fail("Bootstrap retailer identity mismatch");
    return plans.slice(0, 1);
  }
  if (retailerActions.size !== 1 || !retailerActions.has("existing")) {
    fail("Full execution requires a fresh artifact with the retailer already present");
  }
  const retailerIds = new Set(plans.map((entry) => String(entry.resolved_plan.retailer.id)));
  if (retailerIds.size !== 1) fail("Full execution contains multiple retailer identities");
  return plans;
}

function credential(kind) {
  const value = process.env[`SIX_PACK_${kind.toUpperCase()}_DATABASE_URL`];
  if (!value) fail(`Missing SIX_PACK_${kind.toUpperCase()}_DATABASE_URL`);
  const parsed = new URL(value);
  parsed.searchParams.delete("sslmode");
  const oppositeRef = "hxnrsyyqffztlvcrtgbf";
  if (parsed.href.includes(oppositeRef)) fail(`${kind} credential points to staging`);
  return parsed.href;
}

async function roleCall(kind, callback) {
  const client = new Client({
    connectionString: credential(kind),
    ssl: { rejectUnauthorized: false },
    application_name: `six-pack-canary-${kind}`,
    options: "-c statement_timeout=120000",
  });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)");
    await client.query(`set role retailer_catalogue_production_${kind}`);
    const identity = (await client.query("select current_user,session_user")).rows[0];
    if (identity.current_user !== `retailer_catalogue_production_${kind}`) fail(`${kind} role mismatch`);
    const result = await callback(client);
    await client.query("commit");
    return { identity, result };
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

async function executeEntry(entry, artifactSha256, runId, rolloutKind) {
  const plan = entry.resolved_plan;
  const approved = await roleCall("approver", async (client) => {
    const response = await client.query(
      "select public.approve_product_import_plan($1::jsonb,$2,$3,$4,now()+interval '15 minutes') result",
      [plan, artifactSha256, runId, rolloutKind]
    );
    return response.rows[0].result;
  });
  const approval = approved.result;
  if (
    approval.status !== "approved" ||
    approval.artifact_sha256 !== artifactSha256 ||
    approval.plan_fingerprint !== entry.plan_fingerprint ||
    approval.source_row_fingerprint !== entry.source_row_fingerprint ||
    approval.run_id !== runId
  ) fail(`Approval metadata mismatch for row ${entry.row_number}`);
  const executed = await roleCall("executor", async (client) => {
    const response = await client.query(
      "select public.apply_approved_product_import_plan($1::uuid,$2,$3,$4,$5::bigint,$6,$7) result",
      [
        approval.approval_id,
        artifactSha256,
        entry.plan_fingerprint,
        entry.source_row_fingerprint,
        entry.retailer_id,
        entry.plan_kind,
        runId,
      ]
    );
    return response.rows[0].result;
  });
  if (
    executed.result.approval_status !== "consumed" ||
    executed.result.plan_fingerprint !== entry.plan_fingerprint ||
    executed.result.source_row_fingerprint !== entry.source_row_fingerprint
  ) fail(`Execution metadata mismatch for row ${entry.row_number}`);
  return {
    row_number: entry.row_number,
    plan_fingerprint: entry.plan_fingerprint,
    approval_id: approval.approval_id,
    consumed_at: executed.result.consumed_at,
    retailer_id: executed.result.retailer_id,
    retailer_product_id: executed.result.retailer_product_id,
    offer_id: executed.result.offer_id,
    price_history_id: executed.result.price_history_id,
  };
}

async function run(options) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main") {
    fail("Production canary execution is restricted to GitHub Actions on main");
  }
  const loaded = loadDryRunArtifact(options.artifact);
  const rollout = validateRollout(options, loaded);
  const selected = plansForMode(loaded.artifact, options.mode);
  const rows = [];
  for (const entry of selected) {
    rows.push(await executeEntry(entry, loaded.artifactSha256, loaded.artifact.run_id, rollout.kind));
  }
  const report = {
    schema_version: 1,
    kind: "six-pack-production-canary-execution",
    mode: options.mode,
    target_project_ref: PROJECT_REF,
    rollout_fingerprint: rollout.rollout_fingerprint,
    artifact_sha256: loaded.artifactSha256,
    selected_plan_count: selected.length,
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
    .then((report) => console.log(JSON.stringify({
      result: "PASS",
      mode: report.mode,
      executed_plan_count: report.executed_plan_count,
      output: path.relative(ROOT, parseArgs(process.argv.slice(2)).output),
    }, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  parseArgs,
  plansForMode,
  validateRollout,
};
