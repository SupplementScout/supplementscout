const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { buildReviewedBatch } = require("./lib/six-pack-reviewed-owner-approval");

const ROOT = path.resolve(__dirname, "..");
function fail(message) { throw new Error(message); }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const match = arg.match(/^--(report|manifest|implementation-commit-sha|output)=(.*)$/);
    if (!match || out[match[1]]) fail(`Invalid argument ${arg}`);
    out[match[1]] = match[2];
  }
  for (const key of ["report", "manifest", "implementation-commit-sha", "output"]) if (!out[key]) fail(`Required --${key}`);
  if (!/^[0-9a-f]{40}$/.test(out["implementation-commit-sha"])) fail("implementation-commit-sha must be exact");
  out.report = path.resolve(out.report); out.manifest = path.resolve(out.manifest); out.output = path.resolve(out.output);
  const relative = path.relative(path.join(ROOT, "tmp"), out.output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return out;
}

function build(options) {
  const report = JSON.parse(fs.readFileSync(options.report, "utf8"));
  const manifestBytes = fs.readFileSync(options.manifest);
  const manifest = JSON.parse(manifestBytes);
  if (report.result !== "PASS_WITH_REVIEW" || report.block_reason != null || report.review_row_count !== report.review_rows.length) fail("Input is not an isolated PASS_WITH_REVIEW report");
  if (report.review_rows.some((row) => row.reason !== "MASS_OOS" || !["UPDATE_PRICE", "UPDATE_STOCK", "UPDATE_PRICE_AND_STOCK"].includes(row.original_action))) fail("Only isolated MASS_OOS price/stock rows can form a reviewed batch");
  const binding = new Map(manifest.rows.map((row) => [String(row.offer_id), row]));
  const rows = report.review_rows.map((row) => {
    const item = binding.get(String(row.offer_id));
    if (!item || String(item.mapping_id) !== String(row.mapping_id) || String(item.external_product_id) !== String(row.external_product_id) || String(item.external_variant_id) !== String(row.external_variant_id)) fail("Review row escaped approved manifest identity");
    return {
      offer_id: String(row.offer_id), product_id: String(item.canonical_product_id), product_variant_id: String(item.canonical_variant_id),
      retailer_product_id: String(item.mapping_id), external_product_id: String(item.external_product_id), external_variant_id: String(item.external_variant_id),
      operation_type: row.original_action,
      before: {
        price: row.current_offer.price, shipping_cost: row.current_offer.shipping_cost, total_price: row.current_offer.total_price,
        in_stock: row.current_offer.in_stock, url: row.current_offer.url, last_checked_at: row.current_offer.last_checked_at,
      },
      after: {
        price: row.proposed_offer.price, shipping_cost: row.proposed_offer.shipping_cost, total_price: row.proposed_offer.total_price,
        in_stock: row.proposed_offer.in_stock, url: row.proposed_offer.url, last_checked_at: report.source_captured_at,
      },
    };
  });
  const capturedAt = report.source_captured_at;
  const batch = buildReviewedBatch({ rows, implementationCommitSha: options["implementation-commit-sha"], manifestSha256: sha256(manifestBytes), sourceCapturedAt: capturedAt, expiresAt: new Date(Date.parse(capturedAt) + 24 * 60 * 60 * 1000).toISOString() });
  fs.mkdirSync(path.dirname(options.output), { recursive: true }); fs.writeFileSync(options.output, `${JSON.stringify(batch, null, 2)}\n`);
  return batch;
}

if (require.main === module) { try { console.log(JSON.stringify(build(parseArgs(process.argv.slice(2))), null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { build, parseArgs };
