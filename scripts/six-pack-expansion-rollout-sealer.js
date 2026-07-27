const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("csv-parse/sync");
const approval = require("../config/retailers/six-pack-reviewed-expansion-batch-v2.json");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_CSV = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-reviewed-expansion-35.csv");
const DEFAULT_REPORT = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-reviewed-expansion-35-import-report.json");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-production-expansion-v4.json");

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(csv|report|output)=(.*)$/);
    if (!match || values[match[1]]) fail(`Invalid argument ${argument}`);
    values[match[1]] = path.resolve(match[2]);
  }
  const options = {
    csv: values.csv || DEFAULT_CSV,
    report: values.report || DEFAULT_REPORT,
    output: values.output || DEFAULT_OUTPUT,
  };
  const relative = path.relative(path.join(ROOT, "tmp"), options.output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return options;
}

function build(csvBytes, report) {
  const rows = parse(csvBytes, { columns: true, skip_empty_lines: true, trim: true });
  const approvedIds = approval.rows.map((row) => String(row.external_variant_id)).sort();
  const csvIds = rows.map((row) => String(row.external_variant_id)).sort();
  const plans = report.plans || [];
  if (
    approval.approved !== true ||
    approval.rows.length !== 35 ||
    rows.length !== 35 ||
    JSON.stringify(csvIds) !== JSON.stringify(approvedIds) ||
    report.blockedRows?.length !== 0 ||
    report.failedRows?.length !== 0 ||
    plans.length !== 35 ||
    plans.some((plan) =>
      plan.product?.action !== "existing" ||
      plan.product_variant?.action !== "existing" ||
      plan.retailer?.action !== "existing" ||
      plan.retailer_product?.action !== "create" ||
      plan.offer?.action !== "create" ||
      plan.price_history?.action !== "create"
    )
  ) fail("Importer review is not the exact approved 35-row expansion");

  const expectedBindings = plans.map((plan) => {
    const mapping = plan.retailer_product.values;
    const offer = plan.offer.values;
    return {
      external_product_id: String(mapping.external_product_id),
      external_variant_id: String(mapping.external_variant_id),
      product_id: String(plan.product.id),
      product_variant_id: String(plan.product_variant.id),
      price: Number(offer.price).toFixed(2),
      shipping_cost: Number(offer.shipping_cost).toFixed(2),
      total_price: Number(offer.total_price).toFixed(2),
      in_stock: Boolean(offer.in_stock),
      external_url: offer.url,
    };
  });
  const rollout = {
    schema_version: 1,
    kind: "six-pack-production-expansion-v4",
    approved: true,
    approval_source: "USER_EXPLICIT_CHAT_CONFIRMATION",
    approved_at: "2026-07-27",
    target_environment: "PRODUCTION",
    target_project_ref: "aftboxmrdgyhizicfsfu",
    retailer_slug: "6-pack-supplements",
    row_count: 35,
    expected_created_variant_count: 0,
    csv_path: "config/retailers/six-pack-production-expansion-v4.csv",
    csv_sha256: sha256(csvBytes),
    expected_external_variant_ids: approvedIds,
    expected_bindings: expectedBindings,
    database_writes_before_execution: 0,
    execution: {
      mode: "PROTECTED_GITHUB_ACTIONS_ONLY",
      approval_role: "retailer_catalogue_production_approver",
      executor_role: "retailer_catalogue_production_executor",
      direct_csv_writes: false,
      post_apply_idempotency_required: true
    },
    rollout_fingerprint: null
  };
  rollout.rollout_fingerprint = sha256(JSON.stringify(rollout));
  return rollout;
}

function run(options) {
  const csvBytes = fs.readFileSync(options.csv);
  const report = JSON.parse(fs.readFileSync(options.report, "utf8"));
  const rollout = build(csvBytes, report);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(rollout, null, 2)}\n`);
  return {
    result: "PASS",
    database_writes: 0,
    row_count: rollout.row_count,
    csv_sha256: rollout.csv_sha256,
    rollout_fingerprint: rollout.rollout_fingerprint,
    output: path.relative(ROOT, options.output)
  };
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(run(parseArgs(process.argv.slice(2))), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { build, parseArgs };
