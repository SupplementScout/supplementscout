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
const approval = require("../config/retailers/six-pack-reviewed-family-batch-v1.json");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-source-snapshot.json");
const MATCH_REPORT = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-match-report.json");
const TEMPLATE = path.join(ROOT, "data", "templates", "retailer-feed-template.csv");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-reviewed-family-21.csv");

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseArgs(argv) {
  if (argv.length > 1 || (argv[0] && !argv[0].startsWith("--output="))) fail("Usage: --output=<tmp path>");
  const output = path.resolve(argv[0]?.slice("--output=".length) || DEFAULT_OUTPUT);
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return { output };
}

function displaySize(value, unit) {
  const amount = Number(value);
  if (unit === "g" && amount >= 1000 && amount % 100 === 0) return `${amount / 1000}kg`;
  return `${value}${unit}`;
}

function syntheticVariant(row) {
  return {
    id: null,
    product_id: row.product_id,
    display_name: `${row.flavour} / ${displaySize(row.size, row.size_unit)}`,
    flavour_code: row.flavour.toLowerCase().replaceAll("&", "and"),
    flavour_label: row.flavour,
    size_value: row.size,
    size_unit: row.size_unit,
    pack_count: 1,
    product_format: row.product_format,
    is_active: true,
    is_default: false,
  };
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

async function run(options, dependencies = {}) {
  if (
    approval.approved !== true ||
    approval.rows.length !== 21 ||
    approval.decisions.tongkat_alias_confirmed !== true ||
    approval.decisions.csv_flavour_variants_confirmed !== true ||
    approval.decisions.gym_high_2100g_identity_confirmed !== true ||
    approval.decisions.apple_cinnamon_jam !== "EXCLUDE_FOOD"
  ) fail("Reviewed family approval is incomplete");
  const sourceSnapshot = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
  const matchReport = JSON.parse(fs.readFileSync(MATCH_REPORT, "utf8"));
  if (
    sourceSnapshot.snapshot_fingerprint !== approval.source_snapshot_fingerprint ||
    matchReport.source_snapshot_fingerprint !== approval.source_snapshot_fingerprint ||
    matchReport.database_writes !== 0
  ) fail("Reviewed family source binding mismatch");
  const sourceById = new Map(sourceSnapshot.records.map((row) => [String(row.source_record_id), row]));
  const matchById = new Map(matchReport.rows.map((row) => [String(row.external_variant_id), row]));
  const client = dependencies.client || loadClient();
  let existingMappingIds = dependencies.existingExternalVariantIds;
  if (!existingMappingIds) {
    const mappingResult = await client
      .from("retailer_products")
      .select("external_variant_id")
      .eq("retailer_id", config.automation.retailer_id);
    if (mappingResult.error) throw mappingResult.error;
    existingMappingIds = mappingResult.data.map((row) => String(row.external_variant_id));
  }
  if (approval.rows.some((row) => existingMappingIds.includes(row.external_variant_id))) {
    fail("Reviewed family batch overlaps an existing retailer mapping");
  }
  const productIds = [...new Set(approval.rows.map((row) => row.product_id))];
  const variantIds = [...new Set(approval.rows.map((row) => row.product_variant_id).filter(Boolean))];
  const [products, variants] = await Promise.all([
    dependencies.products || exactRows(client, "products", productIds, "id,name,slug,brand,category,product_format,is_active,merged_into_product_id"),
    dependencies.variants || exactRows(client, "product_variants", variantIds, "id,product_id,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default"),
  ]);
  const productById = new Map(products.map((row) => [String(row.id), row]));
  const variantById = new Map(variants.map((row) => [String(row.id), row]));
  const readLive = dependencies.readLive || ((productId) => readWooCommerceProductPage({
    storeUrl: config.retailer.website,
    productId,
  }));
  const liveByProduct = new Map();
  const outputRows = [];
  const expectedCreates = [];
  for (const reviewed of approval.rows) {
    const source = sourceById.get(reviewed.external_variant_id);
    const matched = matchById.get(reviewed.external_variant_id);
    const product = productById.get(reviewed.product_id);
    const variant = reviewed.product_variant_id
      ? variantById.get(reviewed.product_variant_id)
      : syntheticVariant(reviewed);
    if (
      !source ||
      !matched ||
      !product ||
      !variant ||
      source.policy_state !== "ELIGIBLE" ||
      String(matched.canonical_product_id) !== reviewed.product_id ||
      product.is_active !== true ||
      product.merged_into_product_id != null ||
      (variant.id != null && (variant.is_active !== true || String(variant.product_id) !== reviewed.product_id))
    ) fail(`Reviewed identity mismatch for ${reviewed.external_variant_id}`);
    let live = liveByProduct.get(source.external_product_id);
    if (!live) {
      live = await readLive(source.external_product_id);
      liveByProduct.set(source.external_product_id, live);
    }
    const drift = liveIdentityDrift(source, live);
    if (drift) fail(`Live identity drift for ${reviewed.external_variant_id}: ${drift.code}`);
    const offer = currentOffer(source, live);
    if (!offer.active || (!offer.in_stock && source.in_stock)) {
      fail(`Live commerce state is unsafe for ${reviewed.external_variant_id}`);
    }
    outputRows.push(canonicalFeedRow(source, product, variant, live, new Date().toISOString()));
    if (variant.id == null) {
      expectedCreates.push({
        external_variant_id: reviewed.external_variant_id,
        product_id: reviewed.product_id,
        display_name: variant.display_name,
        flavour: variant.flavour_label,
        size_value: String(variant.size_value),
        size_unit: variant.size_unit,
        product_format: variant.product_format,
      });
    }
  }
  const templateHeader = fs.readFileSync(TEMPLATE, "utf8").split(/\r?\n/, 1)[0].split(",");
  const csv = serializeCsv([...templateHeader, ...EXTRA_COLUMNS], outputRows);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, csv);
  const report = {
    schema_version: 1,
    kind: "six-pack-reviewed-family-feed",
    result: "PASS",
    database_writes: 0,
    row_count: outputRows.length,
    existing_variant_binding_count: outputRows.length - expectedCreates.length,
    expected_variant_create_count: expectedCreates.length,
    expected_variant_creates: expectedCreates,
    live_product_page_count: liveByProduct.size,
    csv_sha256: sha256(csv),
    approval_sha256: sha256(fs.readFileSync(path.join(ROOT, "config", "retailers", "six-pack-reviewed-family-batch-v1.json"))),
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

module.exports = { displaySize, parseArgs, syntheticVariant };
