const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("csv-parse/sync");
const approval = require("../config/retailers/six-pack-reviewed-missing-variants-batch-v3.json");
const ROOT = path.resolve(__dirname, "..");
function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function parseArgs(argv) {
  const out = {};
  for (const argument of argv) {
    const match = argument.match(/^--(csv|report|output)=(.*)$/);
    if (!match || out[match[1]]) fail(`Invalid argument ${argument}`);
    out[match[1]] = path.resolve(match[2]);
  }
  for (const key of ["csv", "report", "output"]) if (!out[key]) fail(`Required --${key}=<path>`);
  const relative = path.relative(path.join(ROOT, "tmp"), out.output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return out;
}
function build(csvBytes, report) {
  const rows = parse(csvBytes, { columns: true, skip_empty_lines: true, trim: true });
  const ids = approval.rows.map((row) => String(row.external_variant_id)).sort();
  const plans = report.plans || [];
  if (
    approval.approved !== true || rows.length !== 17 || plans.length !== 17 ||
    JSON.stringify(rows.map((row) => row.external_variant_id).sort()) !== JSON.stringify(ids) ||
    report.blockedRows?.length !== 0 || report.failedRows?.length !== 0 ||
    plans.some((plan) => plan.product?.action !== "existing" || plan.product_variant?.action !== "existing" ||
      plan.retailer?.action !== "existing" || plan.retailer_product?.action !== "create" ||
      plan.offer?.action !== "create" || plan.price_history?.action !== "create")
  ) fail("Importer review is not the exact approved 17-row missing-variant rollout");
  const expectedBindings = plans.map((plan) => ({
    external_product_id: String(plan.retailer_product.values.external_product_id),
    external_variant_id: String(plan.retailer_product.values.external_variant_id),
    product_id: String(plan.product.id),
    product_variant_id: String(plan.product_variant.id),
    created_variant_identity: null,
    price: Number(plan.offer.values.price).toFixed(2),
    shipping_cost: Number(plan.offer.values.shipping_cost).toFixed(2),
    total_price: Number(plan.offer.values.total_price).toFixed(2),
    in_stock: Boolean(plan.offer.values.in_stock),
    external_url: plan.offer.values.url
  }));
  const rollout = {
    schema_version: 1, kind: "six-pack-production-expansion-v5", approved: true,
    approval_source: "USER_EXPLICIT_CHAT_CONFIRMATION", approved_at: "2026-07-27",
    target_environment: "PRODUCTION", target_project_ref: "aftboxmrdgyhizicfsfu",
    retailer_slug: "6-pack-supplements", row_count: 17, expected_created_variant_count: 0,
    csv_path: "config/retailers/six-pack-production-expansion-v5.csv",
    csv_sha256: sha256(csvBytes), expected_external_variant_ids: ids, expected_bindings: expectedBindings,
    database_writes_before_execution: 0,
    execution: { mode: "PROTECTED_GITHUB_ACTIONS_ONLY", approval_role: "retailer_catalogue_production_approver", executor_role: "retailer_catalogue_production_executor", direct_csv_writes: false, post_apply_idempotency_required: true },
    rollout_fingerprint: null
  };
  rollout.rollout_fingerprint = sha256(JSON.stringify(rollout));
  return rollout;
}
function run(options) {
  const csv = fs.readFileSync(options.csv);
  const rollout = build(csv, JSON.parse(fs.readFileSync(options.report, "utf8")));
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(rollout, null, 2)}\n`);
  return { result: "PASS", row_count: 17, csv_sha256: rollout.csv_sha256, rollout_fingerprint: rollout.rollout_fingerprint };
}
if (require.main === module) {
  try { console.log(JSON.stringify(run(parseArgs(process.argv.slice(2))), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { build, parseArgs };
