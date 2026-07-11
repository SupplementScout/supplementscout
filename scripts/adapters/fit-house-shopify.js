const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { atomicWrite, fetchJson } = require("./kior-shopify");

const ROOT = path.resolve(__dirname, "../..");
const CONFIG_PATH = path.join(ROOT, "config/retailers/fit-house-shopify.json");
const TEMPLATE_PATH = path.join(ROOT, "data/templates/retailer-feed-template.csv");
const OUTPUT_DIR = path.join(ROOT, "tmp/retailer-feeds/fit-house");
const CSV_PATH = path.join(OUTPUT_DIR, "fit-house-canonical-generated.csv");
const REPORT_PATH = path.join(OUTPUT_DIR, "fit-house-adapter-report.json");
const EXPECTED_PRODUCT_COUNT = 10;

function fail(message) {
  throw new Error(message);
}

function normalizeId(value, label) {
  const result = String(value ?? "").trim();
  if (!/^\d+$/.test(result)) fail(`Invalid ${label}: ${value}`);
  return result;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function assertUnique(items, key, label) {
  const seen = new Set();
  for (const item of items) {
    const value = String(item[key] ?? "").trim();
    if (!value || seen.has(value)) fail(`Duplicate or missing ${label}: ${value}`);
    seen.add(value);
  }
}

function validateConfig(config) {
  if (config?.schema_version !== 1) fail("Unsupported config schema_version");
  if (config?.retailer?.name !== "Fit House" || config.retailer.website !== "https://fithouse.uk") {
    fail("Unexpected Fit House retailer identity");
  }
  if (!Array.isArray(config.retailer.vendor_aliases) || config.retailer.vendor_aliases.length === 0) {
    fail("Missing vendor aliases");
  }
  if (config.shipping?.known !== true || config.shipping.cost !== 3.99) fail("Unexpected shipping config");
  if (!Array.isArray(config.products) || config.products.length !== EXPECTED_PRODUCT_COUNT) {
    fail(`Config must contain exactly ${EXPECTED_PRODUCT_COUNT} approved products`);
  }
  assertUnique(config.products, "shopify_product_id", "configured Shopify product ID");
  assertUnique(config.products, "shopify_variant_id", "configured Shopify variant ID");
  assertUnique(config.products, "canonical_slug", "canonical slug");
  assertUnique(config.products, "expected_handle", "expected handle");
  for (const item of config.products) {
    normalizeId(item.shopify_product_id, "configured product ID");
    normalizeId(item.shopify_variant_id, "configured variant ID");
    for (const key of ["canonical_name", "brand", "category", "product_format", "variant_name", "approved_price", "approved_in_stock", "is_for_sale", "pack_count"]) {
      if (item[key] === undefined || item[key] === null || item[key] === "") {
        fail(`Missing config field ${key} for ${item.shopify_product_id}`);
      }
    }
    if (!Number.isFinite(item.approved_price) || item.approved_price <= 0) fail(`Invalid approved price for ${item.shopify_product_id}`);
    if (item.pack_count !== 1) fail(`Fit House pack_count must be 1 for ${item.shopify_product_id}`);
  }
}

function indexSource(products) {
  const byId = new Map();
  const variantIds = new Set();
  for (const product of products) {
    const productId = normalizeId(product.id, "Shopify product ID");
    if (byId.has(productId)) fail(`Duplicate Shopify product ID: ${productId}`);
    if (!Array.isArray(product.variants)) fail(`Missing variants for Shopify product ${productId}`);
    for (const variant of product.variants) {
      const variantId = normalizeId(variant.id, "Shopify variant ID");
      if (variantIds.has(variantId)) fail(`Duplicate Shopify variant ID: ${variantId}`);
      variantIds.add(variantId);
    }
    byId.set(productId, product);
  }
  return byId;
}

function validHttpsUrl(value, hostname) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (!hostname || url.hostname === hostname);
  } catch {
    return false;
  }
}

function validIsoTimestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

function imageFor(product, variant) {
  const image = String(variant.featured_image?.src || variant.featured_image || product.images?.[0]?.src || "").trim();
  if (!validHttpsUrl(image)) fail(`Invalid image URL for Shopify product ${product.id}`);
  return image;
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function serializeCsv(header, rows) {
  const lines = [header, ...rows.map((row) => header.map((key) => row[key] ?? ""))];
  return `${lines.map((line) => line.map(csvCell).join(",")).join("\n")}\n`;
}

function buildCanonical({ config, shopify, templateHeader }) {
  validateConfig(config);
  if (!shopify || !Array.isArray(shopify.products) || shopify.products.length === 0) fail("Shopify products array is empty");
  const indexed = indexSource(shopify.products);
  const configuredIds = new Set(config.products.map((item) => String(item.shopify_product_id)));
  const report = {
    unmapped_products: shopify.products.filter((product) => !configuredIds.has(String(product.id))).map((product) => ({ product_id: String(product.id), title: product.title, handle: product.handle })),
    missing_configured_products: [], price_changes: [], stock_changes: [], handle_changes: [], vendor_mismatches: [], invalid_images: [], invalid_urls: [], duplicate_ids: [],
  };
  const rows = [];

  for (const item of config.products) {
    const productId = String(item.shopify_product_id);
    const product = indexed.get(productId);
    if (!product) { report.missing_configured_products.push(productId); continue; }
    if (String(product.id) !== productId) fail(`Shopify product ID mismatch for ${productId}`);
    if (product.handle !== item.expected_handle) report.handle_changes.push({ product_id: productId, expected: item.expected_handle, actual: product.handle });
    if (!config.retailer.vendor_aliases.includes(product.vendor)) report.vendor_mismatches.push({ product_id: productId, approved_brand: item.brand, actual: product.vendor });
    const variant = product.variants.find((candidate) => String(candidate.id) === String(item.shopify_variant_id));
    if (!variant) fail(`Configured variant ${item.shopify_variant_id} is missing for product ${productId}`);
    if (String(variant.product_id ?? product.id) !== productId) fail(`Shopify variant product ID mismatch for ${item.shopify_variant_id}`);
    const price = Number(variant.price);
    if (!Number.isFinite(price) || price <= 0) fail(`Invalid live price for product ${productId}`);
    const percent = Math.abs(price - item.approved_price) / item.approved_price * 100;
    if (price !== item.approved_price) report.price_changes.push({ product_id: productId, approved: item.approved_price, live: price, percent });
    if (Boolean(variant.available) !== item.approved_in_stock) report.stock_changes.push({ product_id: productId, approved: item.approved_in_stock, live: Boolean(variant.available) });
    const url = `${config.retailer.website}/products/${product.handle}?variant=${item.shopify_variant_id}`;
    if (!validHttpsUrl(url, "fithouse.uk")) report.invalid_urls.push({ product_id: productId, url });
    let image;
    try { image = imageFor(product, variant); } catch (error) { report.invalid_images.push({ product_id: productId, error: error.message }); continue; }
    const sourceUpdatedAt = variant.updated_at || product.updated_at || "";
    if (!validIsoTimestamp(sourceUpdatedAt)) fail(`Invalid source_updated_at for Shopify product ${productId}`);
    rows.push({
      retailer_name: "Fit House", retailer_website: "https://fithouse.uk", external_product_id: productId,
      external_variant_id: String(item.shopify_variant_id), product_name: item.canonical_name, variant_name: item.variant_name,
      brand: item.brand, category: item.category, description: "", image, slug: item.canonical_slug,
      external_url: url, affiliate_url: url, external_gtin: "", price: String(variant.price), shipping_known: "true",
      shipping_cost: "3.99", in_stock: String(Boolean(variant.available)), is_for_sale: String(item.is_for_sale),
      size: item.size ?? "", size_unit: item.size_unit ?? "", flavour: item.flavour ?? "", product_format: item.product_format,
      pack_count: "1", source_updated_at: sourceUpdatedAt,
    });
  }

  if (report.missing_configured_products.length) fail(`Missing configured Shopify products: ${report.missing_configured_products.join(", ")}`);
  if (report.handle_changes.length) fail(`Shopify handle changes detected: ${JSON.stringify(report.handle_changes)}`);
  if (report.vendor_mismatches.length) fail(`Shopify vendor mismatches detected: ${JSON.stringify(report.vendor_mismatches)}`);
  if (report.invalid_images.length) fail(`Invalid Shopify images detected: ${JSON.stringify(report.invalid_images)}`);
  if (report.invalid_urls.length) fail(`Invalid Fit House URLs detected: ${JSON.stringify(report.invalid_urls)}`);
  const excessive = report.price_changes.filter((change) => change.percent > 25);
  if (excessive.length) fail(`Price change exceeds 25%: ${JSON.stringify(excessive)}`);
  if (rows.length !== EXPECTED_PRODUCT_COUNT) fail(`Expected exactly ${EXPECTED_PRODUCT_COUNT} canonical rows, got ${rows.length}`);
  const allowed = new Set(templateHeader);
  if (rows.some((row) => Object.keys(row).some((key) => !allowed.has(key)) || templateHeader.some((key) => !Object.hasOwn(row, key)))) fail("Generated row does not exactly match canonical template");
  return { rows, ...report, csv: serializeCsv(templateHeader, rows) };
}

function importerCommand(csvPath) {
  return [process.execPath, path.join(ROOT, "scripts/import-products.js"), "--mode=feed", "--safe-create", "--dry-run", `--csv=${csvPath}`];
}

function runImporter(csvPath, spawn = spawnSync) {
  const command = importerCommand(csvPath);
  const result = spawn(command[0], command.slice(1), { cwd: ROOT, encoding: "utf8", env: process.env });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if (result.status !== 0) fail(`Importer safe-create dry-run failed (${result.status}):\n${output}`);
  if (!output.includes("Dry run: no database writes performed.")) fail("Importer did not confirm zero database writes");
  return { command, status: result.status, output, database_writes: 0 };
}

async function main(deps = {}) {
  const argv = deps.argv ?? process.argv.slice(2);
  if (argv.length !== 0) fail("Fit House adapter does not accept CLI arguments");
  const configText = fs.readFileSync(CONFIG_PATH, "utf8");
  const config = JSON.parse(configText);
  validateConfig(config);
  const shopify = await fetchJson(config.source_url, { timeoutMs: 15000, maxBytes: 5242880, fetchImpl: deps.fetchImpl });
  const templateHeader = fs.readFileSync(TEMPLATE_PATH, "utf8").split(/\r?\n/, 1)[0].split(",");
  const built = buildCanonical({ config, shopify, templateHeader });
  const csvHash = sha256(built.csv);
  atomicWrite(CSV_PATH, built.csv);
  const importer = (deps.runImporter || runImporter)(CSV_PATH);
  const report = {
    run_timestamp: new Date().toISOString(), source_url: config.source_url,
    source_products_count: shopify.products.length,
    source_variants_count: shopify.products.reduce((total, product) => total + product.variants.length, 0),
    configured_products_count: config.products.length, mapped_count: built.rows.length,
    unmapped_products_count: built.unmapped_products.length, unmapped_products: built.unmapped_products,
    canonical_rows_count: built.rows.length,
    in_stock_count: built.rows.filter((row) => row.in_stock === "true").length,
    out_of_stock_count: built.rows.filter((row) => row.in_stock === "false").length,
    missing_configured_products: built.missing_configured_products, price_changes: built.price_changes,
    stock_changes: built.stock_changes, handle_changes: built.handle_changes, vendor_mismatches: built.vendor_mismatches,
    duplicate_ids: built.duplicate_ids, invalid_images: built.invalid_images, invalid_urls: built.invalid_urls,
    generated_csv_sha256: csvHash, importer_command: importer.command, importer_result: importer,
    database_writes: importer.database_writes,
  };
  atomicWrite(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(importer.output);
  return { report, importer, csv: built.csv };
}

if (require.main === module) {
  main().catch((error) => { console.error(`Fit House adapter failed: ${error.message}`); process.exitCode = 1; });
}

module.exports = { CSV_PATH, REPORT_PATH, buildCanonical, importerCommand, main, runImporter, sha256, validateConfig };
