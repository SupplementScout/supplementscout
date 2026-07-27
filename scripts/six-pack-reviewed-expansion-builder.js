const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { readWooCommerceProductPage } = require("./lib/woocommerce-product-page-reader");
const {
  EXTRA_COLUMNS,
  canonicalFeedRow,
  currentOffer,
  liveIdentityDrift,
  serializeCsv,
} = require("./six-pack-canary-builder");
const config = require("../config/retailers/six-pack-supplements-woocommerce.json");
const approval = require("../config/retailers/six-pack-reviewed-expansion-batch-v2.json");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-source-snapshot.json");
const MATCH_REPORT = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-match-report.json");
const TEMPLATE = path.join(ROOT, "data", "templates", "retailer-feed-template.csv");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-reviewed-expansion-35.csv");

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

function parseArgs(argv) {
  if (argv.length > 1 || (argv[0] && !argv[0].startsWith("--output="))) fail("Usage: --output=<tmp path>");
  const output = path.resolve(argv[0]?.slice("--output=".length) || DEFAULT_OUTPUT);
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return { output };
}

async function exactRows(client, table, ids, columns) {
  const { data, error } = await client.from(table).select(columns).in("id", ids);
  if (error) throw error;
  return data || [];
}

function loadClient() {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || new URL(url).hostname.split(".")[0] !== approval.target_project_ref) {
    fail("Production read credential mismatch");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function sourceFlavourValues(source) {
  return Object.values(source.external_options || {}).map(normalize).filter(Boolean);
}

function assertApproval() {
  const ids = approval.rows.map((row) => String(row.external_variant_id));
  if (
    approval.approved !== true ||
    approval.rows.length !== 35 ||
    new Set(ids).size !== ids.length ||
    approval.policy.dated_products !== "EXCLUDE" ||
    approval.policy.sarms !== "EXCLUDE" ||
    approval.policy.peptides !== "EXCLUDE" ||
    approval.policy.food !== "EXCLUDE" ||
    approval.policy.new_canonical_products !== "DEFER" ||
    approval.policy.existing_products_only !== true ||
    approval.policy.existing_variants_only !== true
  ) fail("Reviewed expansion approval is incomplete");
}

async function run(options, dependencies = {}) {
  assertApproval();
  const sourceSnapshot = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
  const matchReport = JSON.parse(fs.readFileSync(MATCH_REPORT, "utf8"));
  if (
    sourceSnapshot.snapshot_fingerprint !== approval.source_snapshot_fingerprint ||
    matchReport.source_snapshot_fingerprint !== approval.source_snapshot_fingerprint ||
    matchReport.database_writes !== 0
  ) fail("Reviewed expansion source binding mismatch");
  const sourceById = new Map(sourceSnapshot.records.map((row) => [String(row.source_record_id), row]));
  const matchById = new Map(matchReport.rows.map((row) => [String(row.external_variant_id), row]));
  const client = dependencies.client || loadClient();
  let existingExternalVariantIds = dependencies.existingExternalVariantIds;
  if (!existingExternalVariantIds) {
    const result = await client.from("retailer_products").select("external_variant_id").eq("retailer_id", config.automation.retailer_id);
    if (result.error) throw result.error;
    existingExternalVariantIds = result.data.map((row) => String(row.external_variant_id));
  }
  const overlap = approval.rows.find((row) => existingExternalVariantIds.includes(String(row.external_variant_id)));
  if (overlap) fail(`Reviewed expansion overlaps existing mapping ${overlap.external_variant_id}`);

  const productIds = [...new Set(approval.rows.map((row) => row.product_id))];
  const variantIds = [...new Set(approval.rows.map((row) => row.product_variant_id))];
  const [products, variants] = await Promise.all([
    dependencies.products || exactRows(client, "products", productIds, "id,name,slug,brand,category,product_format,is_active,merged_into_product_id"),
    dependencies.variants || exactRows(client, "product_variants", variantIds, "id,product_id,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default"),
  ]);
  const productById = new Map(products.map((row) => [String(row.id), row]));
  const variantById = new Map(variants.map((row) => [String(row.id), row]));
  const readLive = dependencies.readLive || ((productId) => readWooCommerceProductPage({ storeUrl: config.retailer.website, productId }));
  const liveByProduct = new Map();
  const outputRows = [];
  for (const reviewed of approval.rows) {
    const source = sourceById.get(String(reviewed.external_variant_id));
    const matched = matchById.get(String(reviewed.external_variant_id));
    const product = productById.get(String(reviewed.product_id));
    const variant = variantById.get(String(reviewed.product_variant_id));
    const topCandidate = matched?.candidates?.[0];
    if (
      !source || !matched || !product || !variant ||
      source.policy_state !== "ELIGIBLE" ||
      String(topCandidate?.product_id) !== String(reviewed.product_id) ||
      Number(topCandidate.score) < 69 ||
      product.is_active !== true ||
      product.merged_into_product_id != null ||
      variant.is_active !== true ||
      String(variant.product_id) !== String(reviewed.product_id)
    ) fail(`Reviewed identity mismatch for ${reviewed.external_variant_id}`);
    if (reviewed.source_flavour && !sourceFlavourValues(source).includes(normalize(reviewed.source_flavour))) {
      fail(`Retailer flavour evidence mismatch for ${reviewed.external_variant_id}`);
    }
    let live = liveByProduct.get(String(source.external_product_id));
    if (!live) {
      live = await readLive(source.external_product_id);
      liveByProduct.set(String(source.external_product_id), live);
    }
    const drift = liveIdentityDrift(source, live);
    if (drift) fail(`Live identity drift for ${reviewed.external_variant_id}: ${drift.code}`);
    const offer = currentOffer(source, live);
    if (!offer.active || (!offer.in_stock && source.in_stock)) {
      fail(`Live commerce state is unsafe for ${reviewed.external_variant_id}`);
    }
    const row = canonicalFeedRow(source, product, variant, live, new Date().toISOString());
    row.external_options = reviewed.source_flavour
      ? JSON.stringify({ "Retailer Flavour": reviewed.source_flavour })
      : "{}";
    outputRows.push(row);
  }
  const templateHeader = fs.readFileSync(TEMPLATE, "utf8").split(/\r?\n/, 1)[0].split(",");
  const csv = serializeCsv([...templateHeader, ...EXTRA_COLUMNS], outputRows);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, csv);
  const report = {
    schema_version: 1,
    kind: "six-pack-reviewed-expansion-feed-v2",
    result: "PASS",
    database_writes: 0,
    row_count: outputRows.length,
    existing_product_count: productIds.length,
    existing_variant_binding_count: variantIds.length,
    live_product_page_count: liveByProduct.size,
    csv_sha256: sha256(csv),
    approval_sha256: sha256(fs.readFileSync(path.join(ROOT, "config", "retailers", "six-pack-reviewed-expansion-batch-v2.json"))),
    output: path.relative(ROOT, options.output),
  };
  fs.writeFileSync(options.output.replace(/\.csv$/i, "-builder-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2)))
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = { assertApproval, normalize, parseArgs, sourceFlavourValues };
