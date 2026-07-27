const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("csv-parse/sync");
const manifest = require("../config/retailers/six-pack-approved-offer-manifest.json");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_CSV = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-shipping-15.csv");
const DEFAULT_REPORT = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-shipping-15-import-report.json");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-production-shipping-v1.json");

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
  const rows = parse(csvBytes, { columns: true, skip_empty_lines: true });
  const bindings = new Map(manifest.rows.map((row) => [row.external_variant_id, row]));
  if (
    rows.length !== manifest.approved_mapping_count ||
    report.blockedRows?.length !== 0 ||
    report.failedRows?.length !== 0 ||
    report.plans?.length !== rows.length ||
    report.plans.some((plan) =>
      plan.product?.action !== "existing" ||
      plan.product_variant?.action !== "existing" ||
      plan.retailer_product?.action !== "noop" ||
      plan.offer?.action !== "update" ||
      plan.price_history?.action !== "create"
    )
  ) fail("Importer review is not an exact shipping-only update");
  const expectedBindings = rows.map((row) => {
    const binding = bindings.get(String(row.external_variant_id));
    const plan = report.plans.find((candidate) =>
      String(candidate.retailer_product?.values?.external_variant_id) === String(row.external_variant_id)
    );
    if (
      !binding ||
      !plan ||
      Number(plan.offer.values.price).toFixed(2) !== Number(row.price).toFixed(2) ||
      Number(plan.offer.values.shipping_cost).toFixed(2) !== Number(row.shipping_cost).toFixed(2)
    ) fail(`Shipping review identity mismatch for ${row.external_variant_id}`);
    return {
      external_product_id: binding.external_product_id,
      external_variant_id: binding.external_variant_id,
      product_id: binding.canonical_product_id,
      product_variant_id: binding.canonical_variant_id,
      price: Number(plan.offer.values.price).toFixed(2),
      shipping_cost: Number(plan.offer.values.shipping_cost).toFixed(2),
      total_price: Number(plan.offer.values.total_price).toFixed(2),
      in_stock: Boolean(plan.offer.values.in_stock),
      external_url: plan.offer.values.url,
    };
  });
  const rollout = {
    schema_version: 1,
    kind: "six-pack-production-shipping-v1",
    approved: true,
    approval_source: "USER_EXPLICIT_CHAT_CONFIRMATION",
    approved_at: "2026-07-27",
    target_environment: "PRODUCTION",
    target_project_ref: "aftboxmrdgyhizicfsfu",
    retailer_slug: "6-pack-supplements",
    row_count: rows.length,
    csv_path: "config/retailers/six-pack-production-shipping-v1.csv",
    csv_sha256: sha256(csvBytes),
    expected_external_variant_ids: expectedBindings.map((row) => row.external_variant_id).sort(),
    expected_bindings: expectedBindings,
    database_writes_before_execution: 0,
    execution: {
      mode: "PROTECTED_GITHUB_ACTIONS_ONLY",
      approval_role: "retailer_catalogue_production_approver",
      executor_role: "retailer_catalogue_production_executor",
      direct_csv_writes: false,
      post_apply_idempotency_required: true,
    },
    rollout_fingerprint: null,
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
    output: path.relative(ROOT, options.output),
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
