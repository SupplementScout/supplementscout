const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { loadDryRunArtifact } = require("./import-products");
const { executePlan } = require("./ebay-offer-canary-executor");
const { CONFIRMATION, validateLiveSources } = require("./ebay-offer-batch-h-executor");

const ROOT = path.resolve(__dirname, "..");
const KIND = "ebay-offer-batch-h-exact-4-recovery-v1";
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const FINGERPRINT = "e8ce3c1d9491e83e0d3bf0a279120bd717119d7652d6e47eea297f9dc5a3889a";
const ROLLOUT_PATH = path.join(ROOT, "docs", "rollouts", "ebay-offer-canary", "batch-h-recovery-rollout.json");
const EXPECTED_IDENTITIES = Object.freeze([
  "1126:2459:v1|134504071381|433990375237", "1126:2461:v1|134504071381|433990375234",
  "1126:2463:v1|134504071381|433990375233", "1126:2465:v1|134504071381|433990375235",
]);
function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function parseArgs(argv) {
  const options = {};
  for (const argument of argv) { const match = argument.match(/^--(mode|output)=(.*)$/); if (!match || options[match[1]] !== undefined) fail(`Invalid argument ${argument}`); options[match[1]] = match[2]; }
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
  const identities = rollout.entries.map((row) => `${row.product_id}:${row.product_variant_id}:${row.external_variant_id}`);
  if (rollout.schema_version !== 1 || rollout.kind !== KIND || rollout.approved !== true || rollout.owner_confirmation !== CONFIRMATION || rollout.authority_scope !== "remaining_four_of_owner_approved_exact_eleven" || rollout.target_project_ref !== PROJECT_REF || rollout.rollout_fingerprint !== FINGERPRINT || fingerprint !== FINGERPRINT || JSON.stringify(identities) !== JSON.stringify(EXPECTED_IDENTITIES)) fail("Batch H recovery approval, target, scope or fingerprint mismatch");
  const csvPath = path.resolve(ROOT, rollout.csv), artifactPath = path.resolve(ROOT, rollout.artifact), directory = path.dirname(ROLLOUT_PATH);
  for (const file of [csvPath, artifactPath]) { const relative = path.relative(directory, file); if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Batch H recovery input escaped reviewed directory"); }
  const loaded = loadDryRunArtifact(artifactPath);
  if (sha256(fs.readFileSync(csvPath)) !== rollout.csv_sha256 || loaded.artifactSha256 !== rollout.artifact_sha256 || loaded.artifact.plans.length !== 11 || loaded.artifact.blocked_rows.length !== 0) fail("Batch H recovery artifact mismatch");
  const noops = loaded.artifact.plans.filter((entry) => entry.resolved_plan.retailer_product.action === "noop" && entry.resolved_plan.offer.action === "noop" && entry.resolved_plan.price_history.action === "noop");
  const creates = loaded.artifact.plans.filter((entry) => entry.resolved_plan.retailer_product.action === "create");
  if (noops.length !== 7 || creates.length !== 4) fail("Batch H recovery must partition to seven no-ops and four creates");
  const entries = creates.map((entry, index) => {
    const approved = rollout.entries[index], plan = entry.resolved_plan;
    if (entry.plan_fingerprint !== approved.plan_fingerprint || entry.source_row_fingerprint !== approved.source_row_fingerprint || entry.plan_kind !== "manual" || String(plan.product.id) !== approved.product_id || String(plan.product_variant.id) !== approved.product_variant_id || plan.product_variant.evidence.product_format !== "ready-to-drink" || plan.retailer_product.values.external_variant_id !== approved.external_variant_id || plan.retailer_product.values.external_gtin !== approved.gtin || plan.offer.values.price !== approved.price || plan.offer.values.shipping_cost !== approved.shipping_cost || plan.offer.values.total_price !== approved.total_price) fail(`Batch H recovery plan ${index + 1} drift`);
    return { loaded, entry };
  });
  return { rollout, entries, noops };
}
async function run(options) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" || process.env.EBAY_CANARY_OWNER_CONFIRMATION !== CONFIRMATION) fail("Batch H recovery requires exact owner-approved GitHub Actions dispatch on main");
  const validated = validateRollout(), rows = [];
  if (options.mode === "apply") for (const item of validated.entries) rows.push(await executePlan(item, KIND));
  const report = { schema_version: 1, kind: `${KIND}-${options.mode}`, rollout_fingerprint: FINGERPRINT, validated_create_count: validated.entries.length, verified_existing_count: validated.noops.length, executed_plan_count: rows.length, rows, completed_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(options.output), { recursive: true }); fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`); return report;
}
if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify({ result: "PASS", existing: report.verified_existing_count, executed: report.executed_plan_count }))).catch((error) => { console.error(error.message); process.exit(1); });
module.exports = { EXPECTED_IDENTITIES, FINGERPRINT, parseArgs, run, validateRollout, validateLiveSources };
