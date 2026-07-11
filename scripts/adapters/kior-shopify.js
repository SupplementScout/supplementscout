const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { parse } = require("csv-parse/sync");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.resolve(__dirname, "../..");
const CONFIG_PATH = path.join(ROOT, "config/retailers/kior-shopify.json");
const EXPORT_PATH = path.join(ROOT, "data/feeds/kior/products_export.csv");
const TEMPLATE_PATH = path.join(ROOT, "data/templates/retailer-feed-template.csv");
const OUTPUT_DIR = path.join(ROOT, "tmp/retailer-feeds/kior");
const CSV_PATH = path.join(OUTPUT_DIR, "kior-canonical-generated.csv");
const REPORT_PATH = path.join(OUTPUT_DIR, "kior-adapter-report.json");

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function id(value, label) {
  const result = String(value ?? "").trim();
  if (!/^\d+$/.test(result)) fail(`Invalid ${label}: ${value}`);
  return result;
}

function validateConfig(config) {
  if (config.schema_version !== 1) fail("Unsupported config schema_version");
  if (!config.retailer?.name || !config.retailer?.website) fail("Incomplete retailer config");
  if (!Array.isArray(config.retailer.vendor_aliases) || !config.retailer.vendor_aliases.length) fail("Missing vendor aliases");
  const shipping = config.shipping;
  if (shipping?.known !== true || !Number.isFinite(shipping.cost) || shipping.cost < 0 || !Number.isFinite(shipping.free_shipping_threshold) || shipping.free_shipping_threshold <= 0 || !shipping.approval_note) fail("Incomplete shipping config");
  if (!Array.isArray(config.products) || config.products.length !== 11) fail("Config must contain exactly 11 approved products");
  const products = new Set();
  const variants = new Set();
  for (const item of config.products) {
    const productId = id(item.shopify_product_id, "configured product ID");
    const variantId = id(item.shopify_variant_id, "configured variant ID");
    if (products.has(productId) || variants.has(variantId)) fail("Duplicate ID in config");
    products.add(productId); variants.add(variantId);
    for (const key of ["expected_handle", "canonical_product_id", "canonical_name", "canonical_slug", "category", "product_format", "variant_name", "pack_count", "is_for_sale", "approved_price", "approved_in_stock"]) {
      if (item[key] === undefined || item[key] === null || item[key] === "") fail(`Missing config field ${key} for ${productId}`);
    }
  }
}

async function fetchJson(url, { timeoutMs, maxBytes, fetchImpl = fetch }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { method: "GET", signal: controller.signal, headers: { accept: "application/json" } });
    if (response.status !== 200) fail(`Shopify fetch returned HTTP ${response.status}`);
    const contentLength = Number(response.headers?.get?.("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) fail("Shopify response exceeds maximum size");
    let body;
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) { await reader.cancel(); fail("Shopify response exceeds maximum size"); }
        chunks.push(Buffer.from(value));
      }
      body = Buffer.concat(chunks).toString("utf8");
    } else {
      body = await response.text();
      if (Buffer.byteLength(body) > maxBytes) fail("Shopify response exceeds maximum size");
    }
    let json;
    try { json = JSON.parse(body); } catch { fail("Shopify response is not valid JSON"); }
    if (!Array.isArray(json.products)) fail("Shopify response is missing products array");
    if (!json.products.length) fail("Shopify products array is empty");
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function indexShopifyProducts(products) {
  const productIds = new Set();
  const variantIds = new Set();
  const byId = new Map();
  for (const product of products) {
    const productId = id(product.id, "Shopify product ID");
    if (productIds.has(productId)) fail(`Duplicate Shopify product ID: ${productId}`);
    productIds.add(productId);
    if (!Array.isArray(product.variants)) fail(`Missing variants for Shopify product ${productId}`);
    for (const variant of product.variants) {
      const variantId = id(variant.id, "Shopify variant ID");
      if (variantIds.has(variantId)) fail(`Duplicate Shopify variant ID: ${variantId}`);
      variantIds.add(variantId);
    }
    byId.set(productId, product);
  }
  return byId;
}

function parseExport(csvText) {
  const rows = parse(csvText, { columns: true, skip_empty_lines: true, relax_column_count: true });
  const groups = new Map();
  for (const row of rows) {
    const handle = String(row.Handle || "").trim();
    if (!handle) continue;
    const group = groups.get(handle) || [];
    group.push(row); groups.set(handle, group);
  }
  return groups;
}

function selectExportRow(rows, handle) {
  if (!rows?.length) fail(`No Shopify CSV rows for handle ${handle}`);
  const candidates = rows.filter((row) => ["Variant SKU", "Variant Price", "Variant Inventory Qty", "Variant Barcode"].some((key) => String(row[key] || "").trim() !== ""));
  if (candidates.length !== 1) fail(`Ambiguous Shopify CSV join for handle ${handle}: ${candidates.length} main rows`);
  return candidates[0];
}

function getImage(product, variant) {
  return String(variant.featured_image?.src || variant.featured_image || product.images?.[0]?.src || "").trim();
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function serializeCsv(header, rows) {
  return `${[header, ...rows.map((row) => header.map((key) => row[key] ?? ""))].map((line) => line.map(csvCell).join(",")).join("\n")}\n`;
}

function buildCanonical({ config, shopify, exportGroups, templateHeader }) {
  validateConfig(config);
  const indexed = indexShopifyProducts(shopify.products);
  const configuredIds = new Set(config.products.map((item) => String(item.shopify_product_id)));
  const unmappedProducts = shopify.products.filter((product) => !configuredIds.has(String(product.id))).map((product) => ({ product_id: String(product.id), title: product.title, handle: product.handle }));
  const missingConfiguredProducts = [];
  const stockChanges = [];
  const priceChanges = [];
  const handleChanges = [];
  const skuMismatches = [];
  const rows = [];

  for (const item of config.products) {
    const productId = String(item.shopify_product_id);
    const product = indexed.get(productId);
    if (!product) { missingConfiguredProducts.push(productId); continue; }
    if (product.handle !== item.expected_handle) handleChanges.push({ product_id: productId, expected: item.expected_handle, actual: product.handle });
    if (!config.retailer.vendor_aliases.includes(product.vendor)) fail(`Unexpected vendor for ${productId}: ${product.vendor}`);
    if (product.variants.length !== 1) fail(`Configured product ${productId} must have exactly one Shopify variant`);
    const variant = product.variants.find((candidate) => String(candidate.id) === String(item.shopify_variant_id));
    if (!variant) fail(`Configured variant ${item.shopify_variant_id} is missing for product ${productId}`);
    const exportRow = selectExportRow(exportGroups.get(product.handle), product.handle);
    const jsonSku = String(variant.sku || "").trim().replace(/^'/, "");
    const csvSku = String(exportRow["Variant SKU"] || "").trim().replace(/^'/, "");
    if (jsonSku && csvSku && jsonSku !== csvSku) skuMismatches.push({ product_id: productId, json_sku: jsonSku, csv_sku: csvSku });
    const price = Number(variant.price);
    if (!Number.isFinite(price) || price <= 0) fail(`Invalid live price for product ${productId}`);
    const pricePercent = Math.abs(price - Number(item.approved_price)) / Number(item.approved_price) * 100;
    if (price !== Number(item.approved_price)) priceChanges.push({ product_id: productId, approved: Number(item.approved_price), live: price, percent: pricePercent });
    if (Boolean(variant.available) !== item.approved_in_stock) stockChanges.push({ product_id: productId, approved: item.approved_in_stock, live: Boolean(variant.available) });
    const url = `${config.retailer.website}/products/${product.handle}?variant=${variant.id}`;
    rows.push({
      retailer_name: config.retailer.name, retailer_website: config.retailer.website,
      external_product_id: productId, external_variant_id: String(variant.id), product_name: item.canonical_name,
      variant_name: item.variant_name, brand: config.retailer.name, category: item.category, description: "",
      image: getImage(product, variant), slug: item.canonical_slug, external_url: url, affiliate_url: url,
      external_gtin: String(exportRow["Variant Barcode"] || "").trim(), price: variant.price,
      shipping_known: "true", shipping_cost: config.shipping.cost, in_stock: String(Boolean(variant.available)),
      is_for_sale: String(item.is_for_sale), size: "", size_unit: "", flavour: "", product_format: item.product_format,
      pack_count: item.pack_count, source_updated_at: variant.updated_at || product.updated_at || ""
    });
  }
  rows.sort((a, b) => BigInt(a.external_product_id) < BigInt(b.external_product_id) ? -1 : BigInt(a.external_product_id) > BigInt(b.external_product_id) ? 1 : BigInt(a.external_variant_id) < BigInt(b.external_variant_id) ? -1 : 1);
  if (missingConfiguredProducts.length) fail(`Missing configured Shopify products: ${missingConfiguredProducts.join(", ")}`);
  if (handleChanges.length) fail(`Shopify handle changes detected: ${JSON.stringify(handleChanges)}`);
  if (skuMismatches.length) fail(`Shopify SKU mismatches detected: ${JSON.stringify(skuMismatches)}`);
  const excessivePrices = priceChanges.filter((change) => change.percent > config.guardrails.max_price_change_percent);
  if (excessivePrices.length) fail(`Price change exceeds threshold: ${JSON.stringify(excessivePrices)}`);
  const stockPercent = stockChanges.length / config.products.length * 100;
  if (stockChanges.length > config.guardrails.max_stock_changes || stockPercent > config.guardrails.max_stock_change_percent) fail(`Stock change threshold exceeded: ${stockChanges.length} (${stockPercent.toFixed(2)}%)`);
  if (rows.length !== 11) fail(`Expected 11 canonical rows, got ${rows.length}`);
  return { rows, unmappedProducts, missingConfiguredProducts, stockChanges, priceChanges, handleChanges, skuMismatches, csv: serializeCsv(templateHeader, rows) };
}

async function validateCanonicalMappings(config, client) {
  const ids = config.products.map((item) => item.canonical_product_id);
  const { data, error } = await client.from("products").select("id, slug").in("id", ids);
  if (error) throw error;
  const byId = new Map((data || []).map((row) => [String(row.id), row.slug]));
  const invalid = config.products.filter((item) => byId.get(String(item.canonical_product_id)) !== item.canonical_slug);
  if (invalid.length) fail(`Canonical ID/slug validation failed: ${invalid.map((item) => `${item.canonical_product_id}:${item.canonical_slug}`).join(", ")}`);
}

function atomicWrite(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try { fs.writeFileSync(temporary, content, { encoding: "utf8", flag: "wx" }); fs.renameSync(temporary, filePath); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

function runImporter(csvPath, spawn = spawnSync) {
  const args = [path.join(ROOT, "scripts/import-products.js"), "--mode=feed", "--dry-run", `--csv=${csvPath}`];
  const result = spawn(process.execPath, args, { cwd: ROOT, encoding: "utf8", env: process.env });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if (result.status !== 0) fail(`Importer dry-run failed (${result.status}):\n${output}`);
  return { args, output };
}

async function main(deps = {}) {
  const configText = fs.readFileSync(CONFIG_PATH, "utf8");
  const config = JSON.parse(configText);
  validateConfig(config);
  const shopify = await fetchJson(config.source_url, { timeoutMs: config.guardrails.fetch_timeout_ms, maxBytes: config.guardrails.max_response_bytes, fetchImpl: deps.fetchImpl });
  const exportGroups = parseExport(fs.readFileSync(EXPORT_PATH, "utf8"));
  const templateHeader = fs.readFileSync(TEMPLATE_PATH, "utf8").split(/\r?\n/, 1)[0].split(",");
  const built = buildCanonical({ config, shopify, exportGroups, templateHeader });
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const canonicalValidator = deps.validateCanonical || validateCanonicalMappings;
  const client = deps.supabase || (deps.validateCanonical ? null : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "", { auth: { persistSession: false, autoRefreshToken: false } }));
  await canonicalValidator(config, client);
  const csvHash = sha256(built.csv);
  const report = {
    fetch_time: new Date().toISOString(), source_product_count: shopify.products.length, mapped_count: built.rows.length,
    unmapped_count: built.unmappedProducts.length, unmapped_products: built.unmappedProducts,
    missing_configured_products: built.missingConfiguredProducts, stock_changes: built.stockChanges,
    price_changes: built.priceChanges, handle_changes: built.handleChanges, sku_mismatches: built.skuMismatches,
    config_sha256: sha256(configText), generated_csv_sha256: csvHash,
    output_paths: { canonical_csv: CSV_PATH, adapter_report: REPORT_PATH }
  };
  atomicWrite(CSV_PATH, built.csv);
  atomicWrite(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  const importer = (deps.runImporter || runImporter)(CSV_PATH);
  console.log(JSON.stringify(report, null, 2));
  console.log(importer.output);
  return { report, importer, csv: built.csv };
}

if (require.main === module) main().catch((error) => { console.error(`KIOR adapter failed: ${error.message}`); process.exitCode = 1; });

module.exports = { atomicWrite, buildCanonical, fetchJson, parseExport, runImporter, validateCanonicalMappings };
