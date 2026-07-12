const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

const { atomicWrite, fetchJson } = require("./kior-shopify");

const ROOT = path.resolve(__dirname, "../..");
const CONFIG_PATH = path.join(ROOT, "config/retailers/discount-supplements-shopify.json");
const TEMPLATE_PATH = path.join(ROOT, "data/templates/retailer-feed-template.csv");
const OUTPUT_DIR = path.join(ROOT, "tmp/retailer-feeds/discount-supplements");
const CSV_PATH = path.join(OUTPUT_DIR, "discount-supplements-canonical-generated.csv");
const REPORT_PATH = path.join(OUTPUT_DIR, "discount-supplements-adapter-report.json");
const EXPECTED_COUNT = 1;

function fail(message) { throw new Error(message); }
function id(value, label) {
  const result = String(value ?? "").trim();
  if (!/^\d+$/.test(result)) fail(`Invalid ${label}: ${value}`);
  return result;
}
function evidence(value) { return value === null || value === undefined || String(value).trim() === "" ? null : String(value).trim(); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function serializeCsv(header, rows) {
  return `${[header, ...rows.map((row) => header.map((key) => row[key] ?? ""))].map((line) => line.map(csvCell).join(",")).join("\n")}\n`;
}
function validHttps(value, hostname) {
  try { const url = new URL(value); return url.protocol === "https:" && (!hostname || url.hostname === hostname); } catch { return false; }
}

function validateConfig(config) {
  if (config?.schema_version !== 1) fail("Unsupported config schema_version");
  if (config.source_url !== "https://www.discount-supplements.co.uk/products.json?limit=250") fail("Unexpected Shopify source URL");
  if (config.guardrails?.fetch_timeout_ms !== 15000 || config.guardrails.max_response_bytes !== 5242880 || config.guardrails.max_pages !== 20) fail("Unexpected fetch guardrails");
  const retailer = config.retailer;
  if (retailer?.id !== 4 || retailer.name !== "Discount Supplements" || retailer.slug !== "discount-supplements" || retailer.website !== "https://www.discount-supplements.co.uk") fail("Unexpected retailer identity");
  if (config.shipping?.known !== true || config.shipping.cost !== 4.99 || config.shipping.free_shipping_threshold !== 80 || !config.shipping.approval_note) fail("Unexpected shipping config");
  if (!Array.isArray(config.products) || config.products.length !== EXPECTED_COUNT) fail("Config must contain exactly one approved product");
  const item = config.products[0];
  if (id(item.shopify_product_id, "Shopify product ID") !== "6788065329348" || id(item.shopify_variant_id, "Shopify variant ID") !== "54879874810234") fail("Unexpected approved Shopify identity");
  const exact = {
    expected_variant_count: 1, expected_handle: "cnp-pro-creatine-250g", expected_product_title: "CNP Creatine Monohydrate 250g", expected_variant_title: "250g / Unflavoured",
    expected_option1: "250g", expected_option2: "Unflavoured", expected_option3: null, expected_sku: "CNP-0508", expected_barcode: null,
    canonical_product_id: 407, canonical_name: "CNP Creatine Monohydrate 250g", canonical_slug: "cnp-creatine-monohydrate-250g",
    brand: "CNP", category: "Creatine", product_format: "powder", variant_name: "250g / Unflavoured",
    size: 250, size_unit: "g", flavour: "Unflavoured", pack_count: 1, is_for_sale: true, approved_price: 12.99, approved_in_stock: true,
  };
  for (const [key, value] of Object.entries(exact)) if (item[key] !== value) fail(`Unexpected ${key}`);
  if (JSON.stringify(retailer.vendor_aliases) !== JSON.stringify(["CNP"])) fail("Unexpected approved vendor aliases");
}

async function fetchCatalog(config, fetchImpl) {
  const products = [];
  const requiredIds = new Set(config.products.map((item) => String(item.shopify_product_id)));
  for (let page = 1; page <= config.guardrails.max_pages; page += 1) {
    const separator = config.source_url.includes("?") ? "&" : "?";
    const payload = await fetchJson(`${config.source_url}${separator}page=${page}`, {
      timeoutMs: config.guardrails.fetch_timeout_ms, maxBytes: config.guardrails.max_response_bytes, fetchImpl,
    });
    if (!payload || !Array.isArray(payload.products)) fail(`Invalid Shopify products page ${page}`);
    products.push(...payload.products);
    for (const product of payload.products) requiredIds.delete(String(product.id));
    if (requiredIds.size === 0 || payload.products.length < 250) break;
  }
  return { products };
}

function buildCanonical({ config, shopify, templateHeader }) {
  validateConfig(config);
  const item = config.products[0];
  const product = shopify.products.find((candidate) => String(candidate.id) === item.shopify_product_id);
  if (!product) fail(`Missing configured Shopify product ${item.shopify_product_id}`);
  if (product.title !== item.expected_product_title) fail("Shopify product title drift detected");
  if (product.handle !== item.expected_handle) fail("Shopify handle drift detected");
  if (!config.retailer.vendor_aliases.includes(product.vendor) || product.vendor !== item.brand) fail("Shopify vendor drift detected");
  if (!Array.isArray(product.variants) || product.variants.length !== item.expected_variant_count) fail("Shopify variant count drift detected");
  const options = product.options || [];
  const expectedOptions = [{ name: "Size", position: 1, values: [item.expected_option1] }, { name: "Flavour", position: 2, values: [item.expected_option2] }];
  if (JSON.stringify(options) !== JSON.stringify(expectedOptions)) fail("Shopify product option drift detected");
  const variant = product.variants.find((candidate) => String(candidate.id) === item.shopify_variant_id);
  if (!variant) fail(`Configured variant ${item.shopify_variant_id} is missing`);
  if (String(variant.product_id ?? product.id) !== item.shopify_product_id) fail("Shopify variant product ID drift detected");
  for (const [key, expected] of [["title", item.expected_variant_title], ["option1", item.expected_option1], ["option2", item.expected_option2], ["option3", item.expected_option3]]) {
    if ((variant[key] ?? null) !== expected) fail(`Shopify variant ${key} drift detected`);
  }
  if (evidence(variant.sku) !== item.expected_sku) fail("Shopify SKU drift detected");
  if (evidence(variant.barcode) !== item.expected_barcode) fail("Shopify barcode drift detected");
  if (Number(variant.price) !== item.approved_price) fail("Shopify price drift detected");
  if (Boolean(variant.available) !== item.approved_in_stock) fail("Shopify stock drift detected");
  if (item.size !== 250 || item.size_unit !== "g" || item.flavour !== "Unflavoured" || item.product_format !== "powder" || item.pack_count !== 1) fail("Approved variant identity drift detected");
  const image = String(variant.featured_image?.src || variant.featured_image || product.images?.[0]?.src || "").trim();
  if (!validHttps(image, "cdn.shopify.com")) fail("Missing or invalid Shopify CDN HTTPS product image");
  const url = `${config.retailer.website}/products/${product.handle}?variant=${item.shopify_variant_id}`;
  if (!validHttps(url, "www.discount-supplements.co.uk") || new URL(url).searchParams.get("variant") !== item.shopify_variant_id) fail("Invalid direct variant URL");
  const sourceUpdatedAt = variant.updated_at || product.updated_at;
  if (!sourceUpdatedAt || !Number.isFinite(Date.parse(sourceUpdatedAt))) fail("Invalid source updated_at");
  const row = {
    retailer_name: config.retailer.name, retailer_website: config.retailer.website,
    external_product_id: item.shopify_product_id, external_variant_id: item.shopify_variant_id,
    product_name: item.canonical_name, variant_name: item.variant_name, brand: item.brand, category: item.category,
    description: "", image, slug: item.canonical_slug, external_url: url, affiliate_url: url, external_gtin: "",
    price: String(variant.price), shipping_known: "true", shipping_cost: "4.99", in_stock: "true", is_for_sale: "true",
    size: "250", size_unit: "g", flavour: "Unflavoured", product_format: "powder", pack_count: "1", source_updated_at: sourceUpdatedAt,
  };
  const allowed = new Set(templateHeader);
  if (Object.keys(row).some((key) => !allowed.has(key)) || templateHeader.some((key) => !Object.hasOwn(row, key))) fail("Generated row does not match canonical template");
  return { rows: [row], csv: serializeCsv(templateHeader, [row]), sourceProducts: shopify.products.length };
}

async function validateProductionTargets(config, client) {
  const { data: retailer, error: retailerError } = await client.from("retailers").select("id, name, slug, website").eq("slug", config.retailer.slug).maybeSingle();
  if (retailerError) throw retailerError;
  if (!retailer || retailer.id !== 4 || retailer.name !== config.retailer.name || retailer.slug !== config.retailer.slug || retailer.website !== config.retailer.website) fail("Retailer ID, slug, name, or website drift detected");
  const item = config.products[0];
  const { data: product, error: productError } = await client.from("products").select("id, slug, is_active, merged_into_product_id, merged_at").eq("id", item.canonical_product_id).maybeSingle();
  if (productError) throw productError;
  if (!product || product.id !== 407 || product.slug !== item.canonical_slug || product.is_active !== true || product.merged_into_product_id !== null || product.merged_at !== null) fail("Canonical product ID, slug, or active identity drift detected");
}

function count(output, label) {
  const match = output.match(new RegExp(`^\\s*${label}:\\s*(\\d+)\\s*$`, "mi"));
  if (!match) fail(`Importer output is missing counter: ${label}`);
  return Number(match[1]);
}
function runImporter(csvPath, spawn = spawnSync) {
  const args = [path.join(ROOT, "scripts/import-products.js"), "--mode=feed", "--dry-run", `--csv=${csvPath}`];
  const runId = crypto.randomUUID();
  const helperPath = path.join(OUTPUT_DIR, `discount-supplements-import-report-${runId}.json`);
  fs.rmSync(helperPath, { force: true });
  const result = spawn(process.execPath, args, { cwd: ROOT, encoding: "utf8", env: { ...process.env, SUPPLEMENTSCOUT_IMPORT_REPORT_PATH: helperPath, SUPPLEMENTSCOUT_IMPORT_RUN_ID: runId } });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  let helper;
  try {
    if (result.status !== 0) fail(`Importer dry-run failed (${result.status}):\n${output}`);
    if (!output.includes("Dry run: no database writes performed.")) fail("Importer did not confirm zero database writes");
    if (!fs.existsSync(helperPath)) fail("Importer did not create a fresh helper report");
    helper = JSON.parse(fs.readFileSync(helperPath, "utf8"));
  } finally { fs.rmSync(helperPath, { force: true }); }
  if (helper?.runId !== runId || helper?.rowLevelOffers?.length !== 1) fail("Invalid or stale importer row-level report");
  const rowResult = helper.rowLevelOffers[0];
  if (!rowResult || typeof rowResult !== "object" || Array.isArray(rowResult) || Object.keys(rowResult).sort().join(",") !== "offerAction,rowNumber,slug" || rowResult.rowNumber !== 2 || rowResult.slug !== "cnp-creatine-monohydrate-250g" || !["create", "unchanged"].includes(rowResult.offerAction)) fail("Invalid importer row-level result");
  const summary = {
    approved_rows: count(output, "approved rows"), invalid_rows: count(output, "invalid rows"), ambiguous_rows: count(output, "ambiguous rows"),
    new_retailers: count(output, "new retailers would be created"), new_products: count(output, "new products would be created"),
    retailer_products_created: count(output, "retailer_products would be created"), offers_created: count(output, "offers would be created"),
    offers_updated: count(output, "offers would be updated"), offers_unchanged: count(output, "offers unchanged"),
    price_history_created: count(output, "price_history rows would be created"), skipped_for_review: count(output, "Skipped for review"), failed: count(output, "Failed"),
  };
  const common = { approved_rows: 1, invalid_rows: 0, ambiguous_rows: 0, new_retailers: 0, new_products: 0, offers_updated: 0, skipped_for_review: 0, failed: 0 };
  for (const [key, value] of Object.entries(common)) if (summary[key] !== value) fail(`Unexpected importer ${key}: ${summary[key]}`);
  const initialCreate = summary.retailer_products_created === 1 && summary.offers_created === 1 && summary.offers_unchanged === 0 && summary.price_history_created === 1 && rowResult.offerAction === "create";
  const steadyState = summary.retailer_products_created === 0 && summary.offers_created === 0 && summary.offers_unchanged === 1 && summary.price_history_created === 0 && rowResult.offerAction === "unchanged";
  const lifecycleState = initialCreate ? "INITIAL_CREATE" : steadyState ? "STEADY_STATE" : null;
  if (!lifecycleState) fail(`Unexpected importer lifecycle state: ${JSON.stringify({ summary, rowResult })}`);
  return { args, runId, lifecycleState, summary, rowLevelOffers: helper.rowLevelOffers, output, database_writes: 0 };
}

async function main(deps = {}) {
  const argv = deps.argv ?? process.argv.slice(2);
  if (argv.length) fail("Discount Supplements adapter does not accept CLI arguments");
  const csvPath = deps.csvPath ?? CSV_PATH;
  const reportPath = deps.reportPath ?? REPORT_PATH;
  fs.rmSync(reportPath, { force: true });
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  validateConfig(config);
  const shopify = await (deps.fetchCatalog || fetchCatalog)(config, deps.fetchImpl);
  const header = fs.readFileSync(TEMPLATE_PATH, "utf8").split(/\r?\n/, 1)[0].split(",");
  const built = buildCanonical({ config, shopify, templateHeader: header });
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const validator = deps.validateProduction || validateProductionTargets;
  const client = deps.supabase || (deps.validateProduction ? null : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "", { auth: { persistSession: false, autoRefreshToken: false } }));
  await validator(config, client);
  atomicWrite(csvPath, built.csv);
  const importer = (deps.runImporter || runImporter)(csvPath);
  if (importer.database_writes !== 0) fail("Importer database_writes must be zero");
  const report = {
    run_timestamp: new Date().toISOString(), runId: importer.runId, source_url: config.source_url,
    retailer_id: 4, canonical_product_id: 407, configured_products: 1, mapped_products: 1, canonical_rows: 1,
    shipping_known: true, shipping_cost: 4.99, free_shipping_threshold: 80, delivered_price: Number(config.products[0].approved_price) + Number(config.shipping.cost),
    product_drifts: [], variant_drifts: [], price_changes: [], stock_changes: [], handle_changes: [], vendor_mismatches: [], sku_drifts: [], barcode_drifts: [], invalid_images: [], invalid_urls: [],
    generated_csv_sha256: sha256(built.csv), lifecycle_state: importer.lifecycleState, importer_summary: importer.summary, importer_row_results: importer.rowLevelOffers, database_writes: 0, success: true,
  };
  atomicWrite(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(importer.output);
  return { report, importer, csv: built.csv };
}

if (require.main === module) main().catch((error) => { console.error(`Discount Supplements adapter failed: ${error.message}`); process.exitCode = 1; });

module.exports = { CSV_PATH, REPORT_PATH, buildCanonical, fetchCatalog, main, runImporter, validateConfig, validateProductionTargets };
