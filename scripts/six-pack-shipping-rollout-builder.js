const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("csv-parse/sync");
const { serializeCsv } = require("./six-pack-canary-builder");
const { sha256 } = require("./lib/woocommerce-product-page-reader");
const config = require("../config/retailers/six-pack-supplements-woocommerce.json");
const shippingRollout = require("../config/retailers/six-pack-production-shipping-v1.json");

const ROOT = path.resolve(__dirname, "..");
const INPUTS = [
  path.join(ROOT, "config", "retailers", "six-pack-production-canary-v1.csv"),
  path.join(ROOT, "config", "retailers", "six-pack-production-expansion-v1.csv"),
];
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-shipping-15.csv");

function fail(message) {
  throw new Error(message);
}

function shippingFor(price) {
  const amount = Number(price);
  const threshold = Number(config.shipping_policy.free_shipping_threshold);
  const cost = amount < threshold
    ? Number(config.shipping_policy.below_threshold)
    : Number(config.shipping_policy.at_or_above_threshold);
  if (!Number.isFinite(amount) || !Number.isFinite(threshold) || !Number.isFinite(cost)) {
    fail("Invalid shipping policy or offer price");
  }
  return cost.toFixed(2);
}

function build(inputPaths = INPUTS) {
  const rows = inputPaths.flatMap((file) => parse(fs.readFileSync(file, "utf8"), {
    columns: true,
    skip_empty_lines: true,
  }));
  const expected = [...shippingRollout.expected_external_variant_ids].sort();
  const actual = [...rows.map((row) => String(row.external_variant_id))].sort();
  if (
    rows.length !== shippingRollout.row_count ||
    new Set(actual).size !== actual.length ||
    JSON.stringify(actual) !== JSON.stringify(expected)
  ) fail("Shipping rollout source does not match the immutable shipping scope");
  const updated = rows.map((row) => ({
    ...row,
    shipping_known: "true",
    shipping_cost: shippingFor(row.price),
  }));
  return {
    rows: updated,
    csv: serializeCsv(Object.keys(updated[0]), updated),
  };
}

function parseArgs(argv) {
  if (argv.length > 1 || (argv[0] && !argv[0].startsWith("--output="))) fail("Usage: --output=<tmp path>");
  const output = path.resolve(argv[0]?.slice("--output=".length) || DEFAULT_OUTPUT);
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return { output };
}

function run(options) {
  const result = build();
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, result.csv);
  return {
    result: "PASS",
    database_writes: 0,
    row_count: result.rows.length,
    shipping_cost_counts: result.rows.reduce((counts, row) => {
      counts[row.shipping_cost] = (counts[row.shipping_cost] || 0) + 1;
      return counts;
    }, {}),
    csv_sha256: sha256(result.csv),
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

module.exports = { build, parseArgs, shippingFor };
