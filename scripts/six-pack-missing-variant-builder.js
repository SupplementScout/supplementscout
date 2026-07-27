const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { readWooCommerceProductPage } = require("./lib/woocommerce-product-page-reader");
const { EXTRA_COLUMNS, canonicalFeedRow, currentOffer, liveIdentityDrift, serializeCsv } = require("./six-pack-canary-builder");
const config = require("../config/retailers/six-pack-supplements-woocommerce.json");
const approval = require("../config/retailers/six-pack-reviewed-missing-variants-batch-v3.json");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-source-snapshot.json");
const MATCH_REPORT = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-match-report.json");
const TEMPLATE = path.join(ROOT, "data", "templates", "retailer-feed-template.csv");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-missing-variants-17.csv");

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function normalize(value) { return String(value || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim(); }
function variantKey(row) { return `${normalize(row.flavour)}-${row.size}${row.size_unit}`.replace(/\s+/g, "-"); }
function semanticKey(row) { return [String(row.product_id), normalize(row.flavour_label || row.flavour), Number(row.size_value ?? row.size), String(row.size_unit).toLowerCase(), Number(row.pack_count || 1)].join(":"); }

function parseArgs(argv) {
  if (argv.length > 1 || (argv[0] && !argv[0].startsWith("--output="))) fail("Usage: --output=<tmp path>");
  const output = path.resolve(argv[0]?.slice("--output=".length) || DEFAULT_OUTPUT);
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return { output };
}

function syntheticVariant(row) {
  return {
    id: null,
    product_id: row.product_id,
    variant_key: variantKey(row),
    display_name: `${row.flavour} / ${Number(row.size) >= 1000 ? `${Number(row.size) / 1000}kg` : `${row.size}${row.size_unit}`}`,
    flavour_code: normalize(row.flavour),
    flavour_label: row.flavour,
    size_value: row.size,
    size_unit: row.size_unit,
    pack_count: 1,
    product_format: row.product_format,
    is_active: true,
    is_default: false
  };
}

function assertApproval() {
  const ids = approval.rows.map((row) => String(row.external_variant_id));
  if (
    approval.approved !== true || approval.rows.length !== 17 || new Set(ids).size !== 17 ||
    approval.policy.dated_products !== "EXCLUDE" || approval.policy.sarms !== "EXCLUDE" ||
    approval.policy.peptides !== "EXCLUDE" || approval.policy.food !== "EXCLUDE" ||
    approval.policy.existing_products_only !== true || approval.policy.missing_flavour_variants_only !== true
  ) fail("Missing-variant approval is incomplete");
}

function client() {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || new URL(url).hostname.split(".")[0] !== approval.target_project_ref) fail("Production read credential mismatch");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function run(options, dependencies = {}) {
  assertApproval();
  const sourceSnapshot = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
  const matchReport = JSON.parse(fs.readFileSync(MATCH_REPORT, "utf8"));
  if (sourceSnapshot.snapshot_fingerprint !== approval.source_snapshot_fingerprint || matchReport.source_snapshot_fingerprint !== approval.source_snapshot_fingerprint) {
    fail("Source binding mismatch");
  }
  const sourceById = new Map(sourceSnapshot.records.map((row) => [String(row.source_record_id), row]));
  const matchById = new Map(matchReport.rows.map((row) => [String(row.external_variant_id), row]));
  const db = dependencies.client || client();
  const productIds = [...new Set(approval.rows.map((row) => Number(row.product_id)))];
  const [productsResult, variantsResult, mappingsResult] = await Promise.all([
    db.from("products").select("id,name,slug,brand,category,product_format,is_active,merged_into_product_id").in("id", productIds),
    db.from("product_variants").select("id,product_id,flavour_label,size_value,size_unit,pack_count,is_active").in("product_id", productIds),
    db.from("retailer_products").select("external_variant_id").eq("retailer_id", config.automation.retailer_id)
  ]);
  for (const result of [productsResult, variantsResult, mappingsResult]) if (result.error) throw result.error;
  const productById = new Map(productsResult.data.map((row) => [String(row.id), row]));
  const existingKeys = new Set(variantsResult.data.filter((row) => row.is_active !== false).map(semanticKey));
  const mappedIds = new Set(mappingsResult.data.map((row) => String(row.external_variant_id)));
  const readLive = dependencies.readLive || ((productId) => readWooCommerceProductPage({ storeUrl: config.retailer.website, productId }));
  const liveByProduct = new Map();
  const outputRows = [];
  for (const reviewed of approval.rows) {
    const source = sourceById.get(String(reviewed.external_variant_id));
    const matched = matchById.get(String(reviewed.external_variant_id));
    const product = productById.get(String(reviewed.product_id));
    const variant = syntheticVariant(reviewed);
    const rawFlavour = reviewed.source_flavour || reviewed.flavour;
    const sourceFlavours = Object.values(source?.external_options || {}).map(normalize);
    if (
      !source || !matched || !product || source.policy_state !== "ELIGIBLE" ||
      String(matched.candidates?.[0]?.product_id) !== String(reviewed.product_id) ||
      Number(matched.candidates?.[0]?.score) < 69 || product.is_active !== true ||
      product.merged_into_product_id != null || mappedIds.has(String(reviewed.external_variant_id)) ||
      !sourceFlavours.includes(normalize(rawFlavour)) || existingKeys.has(semanticKey(variant))
    ) fail(`Reviewed missing-variant identity mismatch for ${reviewed.external_variant_id}`);
    let live = liveByProduct.get(String(source.external_product_id));
    if (!live) {
      live = await readLive(source.external_product_id);
      liveByProduct.set(String(source.external_product_id), live);
    }
    const drift = liveIdentityDrift(source, live);
    if (drift) fail(`Live identity drift for ${reviewed.external_variant_id}: ${drift.code}`);
    const offer = currentOffer(source, live);
    if (!offer.active || (!offer.in_stock && source.in_stock)) fail(`Unsafe commerce state for ${reviewed.external_variant_id}`);
    const row = canonicalFeedRow(source, product, variant, live, new Date().toISOString());
    row.external_options = JSON.stringify({
      Flavour: reviewed.flavour,
      "Retailer Flavour": rawFlavour
    });
    outputRows.push(row);
  }
  const header = [...fs.readFileSync(TEMPLATE, "utf8").split(/\r?\n/, 1)[0].split(","), ...EXTRA_COLUMNS];
  const csv = serializeCsv(header, outputRows);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, csv);
  const report = {
    schema_version: 1, kind: "six-pack-missing-variant-feed-v3", result: "PASS", database_writes: 0,
    row_count: outputRows.length, existing_product_count: productIds.length, expected_variant_create_count: outputRows.length,
    live_product_page_count: liveByProduct.size, csv_sha256: sha256(csv), output: path.relative(ROOT, options.output)
  };
  fs.writeFileSync(options.output.replace(/\.csv$/i, "-builder-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify(report, null, 2))).catch((error) => {
    console.error(error.message); process.exitCode = 1;
  });
}

module.exports = { assertApproval, normalize, parseArgs, semanticKey, syntheticVariant };
