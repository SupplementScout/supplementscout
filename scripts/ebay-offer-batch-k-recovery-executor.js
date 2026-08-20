const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { loadDryRunArtifact } = require("./import-products");
const { executePlan } = require("./ebay-offer-canary-executor");
const { CONFIRMATION, validateLiveSources } = require("./ebay-offer-batch-k-executor");

const ROOT = path.resolve(__dirname, "..");
const KIND = "ebay-offer-batch-k-exact-9-recovery-v1";
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const FINGERPRINT = "588635592338e684adea1a50ca01f9f8e2756e295e980a2ec1465a4c0071d273";
const ROLLOUT_PATH = path.join(ROOT, "docs", "rollouts", "ebay-offer-canary", "batch-k-recovery-rollout.json");
const EXPECTED_IDENTITIES = Object.freeze([
  "14:1725:v1|323304007010|512368831135", "77:1630:v1|354815561341|624134728917",
  "24:1004:v1|167879148689|467421651918", "27:1588:v1|227339481694|526541817001",
  "520:1700:v1|407021140091|677211935189", "789:1091:v1|236709473396|537300103237",
  "423:1048:v1|227187131642|0", "124:1754:v1|315768710740|614309055150",
  "470:445:v1|406431647826|676750282316",
]);
function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function evidenceValue(value) { return value == null ? null : String(value); }
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
  if (rollout.schema_version !== 1 || rollout.kind !== KIND || rollout.approved !== true || rollout.owner_confirmation !== CONFIRMATION || rollout.recovery_owner_words !== "tak" || rollout.authority_scope !== "remaining_nine_of_owner_approved_exact_twenty_with_two_exact_parent_exceptions" || rollout.reviewed_parent_exception_contract !== "ebay-reviewed-cross-product-parent-batch-k-v1" || rollout.target_project_ref !== PROJECT_REF || rollout.verified_existing_count !== 11 || rollout.create_count !== 9 || rollout.rollout_fingerprint !== FINGERPRINT || fingerprint !== FINGERPRINT || JSON.stringify(identities) !== JSON.stringify(EXPECTED_IDENTITIES)) fail("Batch K recovery approval, target, scope or fingerprint mismatch");
  const csvPath = path.resolve(ROOT, rollout.csv), artifactPath = path.resolve(ROOT, rollout.artifact), directory = path.dirname(ROLLOUT_PATH);
  for (const file of [csvPath, artifactPath]) { const relative = path.relative(directory, file); if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Batch K recovery input escaped reviewed directory"); }
  const loaded = loadDryRunArtifact(artifactPath);
  if (sha256(fs.readFileSync(csvPath)) !== rollout.csv_sha256 || loaded.artifactSha256 !== rollout.artifact_sha256 || loaded.artifact.source_file_sha256 !== rollout.csv_sha256 || loaded.artifact.plans.length !== 20 || loaded.artifact.blocked_rows.length !== 0) fail("Batch K recovery artifact mismatch");
  const noops = loaded.artifact.plans.filter((entry) => entry.resolved_plan.retailer_product.action === "noop" && entry.resolved_plan.offer.action === "noop" && entry.resolved_plan.price_history.action === "noop");
  const creates = loaded.artifact.plans.filter((entry) => entry.resolved_plan.retailer_product.action === "create" && entry.resolved_plan.offer.action === "create" && entry.resolved_plan.price_history.action === "create");
  if (noops.length !== 11 || creates.length !== 9) fail("Batch K recovery must partition to eleven no-ops and nine creates");
  const entries = creates.map((entry, index) => {
    const approved = rollout.entries[index], plan = entry.resolved_plan, evidence = plan.product_variant?.evidence || {};
    if (entry.plan_fingerprint !== approved.plan_fingerprint || entry.source_row_fingerprint !== approved.source_row_fingerprint || entry.plan_kind !== "manual" || String(entry.retailer_id) !== "12" || String(plan.product.id) !== approved.product_id || plan.product.action !== "existing" || String(plan.product_variant.id) !== approved.product_variant_id || plan.product_variant.action !== "existing" || evidenceValue(evidence.flavour) !== approved.flavour || evidenceValue(evidence.size_value) !== approved.size_value || evidenceValue(evidence.size_unit) !== approved.size_unit || evidenceValue(evidence.pack_count) !== approved.pack_count || evidenceValue(evidence.product_format) !== approved.product_format || plan.retailer.action !== "existing" || String(plan.retailer.id) !== "12" || !plan.retailer_product.values.external_product_id || plan.retailer_product.values.external_product_id !== approved.external_product_id || plan.retailer_product.values.external_variant_id !== approved.external_variant_id || plan.retailer_product.values.external_gtin !== approved.gtin || plan.offer.values.price !== approved.price || plan.offer.values.shipping_cost !== approved.shipping_cost || plan.offer.values.total_price !== approved.total_price || plan.offer.values.in_stock !== true || !/[?&]campid=\d+/.test(plan.offer.values.url || "")) fail(`Batch K recovery plan ${index + 1} drift`);
    return { loaded, entry, approved };
  });
  return { rollout, entries, noops };
}
async function run(options, dependencies = {}) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" || process.env.EBAY_CANARY_OWNER_CONFIRMATION !== CONFIRMATION) fail("Batch K recovery requires exact owner-approved GitHub Actions dispatch on main");
  const validated = validateRollout(), rows = [];
  if (options.mode === "apply") for (const item of validated.entries) rows.push(await (dependencies.executePlan || executePlan)(item, KIND));
  const report = { schema_version: 1, kind: `${KIND}-${options.mode}`, rollout_fingerprint: FINGERPRINT, validated_create_count: validated.entries.length, verified_existing_count: validated.noops.length, executed_plan_count: rows.length, rows, completed_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(options.output), { recursive: true }); fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`); return report;
}
if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify({ result: "PASS", existing: report.verified_existing_count, executed: report.executed_plan_count }))).catch((error) => { console.error(error.message); process.exit(1); });
module.exports = { EXPECTED_IDENTITIES, FINGERPRINT, parseArgs, run, validateRollout, validateLiveSources };
