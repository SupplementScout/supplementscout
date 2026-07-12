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
const EXPECTED_COUNT = 11;

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

function normalizeEvidence(value) {
  const normalized = String(value ?? "").trim();
  return normalized === "" ? null : normalized;
}

function normalizeCsvSku(value) {
  const normalized = String(value ?? "").trim().replace(/^'/, "");
  return normalized === "" ? null : normalized;
}

function validateEvidence(item, key, productId) {
  if (!Object.hasOwn(item, key)) fail(`Missing config field ${key} for ${productId}`);
  if (item[key] !== null && (typeof item[key] !== "string" || item[key].trim() === "")) {
    fail(`Invalid config field ${key} for ${productId}`);
  }
}

function validateConfig(config) {
  if (config.schema_version !== 1) fail("Unsupported config schema_version");
  if (!config.retailer?.name || !config.retailer?.website) fail("Incomplete retailer config");
  if (!Array.isArray(config.retailer.vendor_aliases) || !config.retailer.vendor_aliases.length) fail("Missing vendor aliases");
  const shipping = config.shipping;
  if (shipping?.known !== true || !Number.isFinite(shipping.cost) || shipping.cost < 0 || !Number.isFinite(shipping.free_shipping_threshold) || shipping.free_shipping_threshold <= 0 || !shipping.approval_note) fail("Incomplete shipping config");
  if (!Array.isArray(config.products) || config.products.length !== EXPECTED_COUNT) fail(`Config must contain exactly ${EXPECTED_COUNT} approved products`);
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
    validateEvidence(item, "expected_sku", productId);
    validateEvidence(item, "expected_barcode", productId);
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

function validHttpsUrl(value, hostname) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (!hostname || url.hostname === hostname);
  } catch {
    return false;
  }
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

function buildCanonical({ config, shopify, exportGroups = null, templateHeader }) {
  validateConfig(config);
  const indexed = indexShopifyProducts(shopify.products);
  const configuredIds = new Set(config.products.map((item) => String(item.shopify_product_id)));
  const report = {
    unmappedProducts: shopify.products.filter((product) => !configuredIds.has(String(product.id))).map((product) => ({ product_id: String(product.id), title: product.title, handle: product.handle })),
    missingConfiguredProducts: [], priceChanges: [], stockChanges: [], handleChanges: [], vendorMismatches: [],
    invalidImages: [], invalidUrls: [], skuDrifts: [], barcodeDrifts: [],
  };
  const rows = [];

  for (const item of config.products) {
    const productId = String(item.shopify_product_id);
    const product = indexed.get(productId);
    if (!product) { report.missingConfiguredProducts.push(productId); continue; }
    if (product.handle !== item.expected_handle) report.handleChanges.push({ product_id: productId, expected: item.expected_handle, actual: product.handle });
    if (!config.retailer.vendor_aliases.includes(product.vendor)) report.vendorMismatches.push({ product_id: productId, actual: product.vendor });
    if (product.variants.length !== 1) fail(`Configured product ${productId} must have exactly one Shopify variant`);
    const variant = product.variants.find((candidate) => String(candidate.id) === String(item.shopify_variant_id));
    if (!variant) fail(`Configured variant ${item.shopify_variant_id} is missing for product ${productId}`);

    const jsonSku = normalizeEvidence(variant.sku);
    if (jsonSku !== item.expected_sku) report.skuDrifts.push({ product_id: productId, source: "json", expected: item.expected_sku, actual: jsonSku });
    const jsonBarcode = normalizeEvidence(variant.barcode);
    if (jsonBarcode !== null && jsonBarcode !== item.expected_barcode) report.barcodeDrifts.push({ product_id: productId, source: "json", expected: item.expected_barcode, actual: jsonBarcode });

    if (exportGroups) {
      const exportRow = selectExportRow(exportGroups.get(product.handle), product.handle);
      const csvSku = normalizeCsvSku(exportRow["Variant SKU"]);
      const csvBarcode = normalizeEvidence(exportRow["Variant Barcode"]);
      if (csvSku !== item.expected_sku) report.skuDrifts.push({ product_id: productId, source: "csv", expected: item.expected_sku, actual: csvSku });
      if (csvBarcode !== item.expected_barcode) report.barcodeDrifts.push({ product_id: productId, source: "csv", expected: item.expected_barcode, actual: csvBarcode });
    }

    const price = Number(variant.price);
    if (!Number.isFinite(price) || price <= 0) fail(`Invalid live price for product ${productId}`);
    const pricePercent = Math.abs(price - Number(item.approved_price)) / Number(item.approved_price) * 100;
    if (price !== Number(item.approved_price)) report.priceChanges.push({ product_id: productId, approved: Number(item.approved_price), live: price, percent: pricePercent });
    if (Boolean(variant.available) !== item.approved_in_stock) report.stockChanges.push({ product_id: productId, approved: item.approved_in_stock, live: Boolean(variant.available) });
    const url = `${config.retailer.website}/products/${product.handle}?variant=${variant.id}`;
    if (!validHttpsUrl(url, "kior.uk")) report.invalidUrls.push({ product_id: productId, url });
    const image = getImage(product, variant);
    if (!validHttpsUrl(image)) report.invalidImages.push({ product_id: productId, image });
    rows.push({
      retailer_name: config.retailer.name, retailer_website: config.retailer.website,
      external_product_id: productId, external_variant_id: String(variant.id), product_name: item.canonical_name,
      variant_name: item.variant_name, brand: config.retailer.name, category: item.category, description: "",
      image, slug: item.canonical_slug, external_url: url, affiliate_url: url,
      external_gtin: item.expected_barcode ?? "", price: variant.price,
      shipping_known: "true", shipping_cost: config.shipping.cost, in_stock: String(Boolean(variant.available)),
      is_for_sale: String(item.is_for_sale), size: "", size_unit: "", flavour: "", product_format: item.product_format,
      pack_count: item.pack_count, source_updated_at: variant.updated_at || product.updated_at || "",
    });
  }

  rows.sort((a, b) => BigInt(a.external_product_id) < BigInt(b.external_product_id) ? -1 : BigInt(a.external_product_id) > BigInt(b.external_product_id) ? 1 : BigInt(a.external_variant_id) < BigInt(b.external_variant_id) ? -1 : 1);
  if (report.missingConfiguredProducts.length) fail(`Missing configured Shopify products: ${report.missingConfiguredProducts.join(", ")}`);
  if (report.handleChanges.length) fail(`Shopify handle changes detected: ${JSON.stringify(report.handleChanges)}`);
  if (report.vendorMismatches.length) fail(`Shopify vendor mismatches detected: ${JSON.stringify(report.vendorMismatches)}`);
  if (report.skuDrifts.length) fail(`Shopify SKU drifts detected: ${JSON.stringify(report.skuDrifts)}`);
  if (report.barcodeDrifts.length) fail(`Shopify barcode drifts detected: ${JSON.stringify(report.barcodeDrifts)}`);
  if (report.invalidImages.length) fail(`Invalid Shopify images detected: ${JSON.stringify(report.invalidImages)}`);
  if (report.invalidUrls.length) fail(`Invalid KIOR URLs detected: ${JSON.stringify(report.invalidUrls)}`);
  const excessivePrices = report.priceChanges.filter((change) => change.percent > config.guardrails.max_price_change_percent);
  if (excessivePrices.length) fail(`Price change exceeds threshold: ${JSON.stringify(excessivePrices)}`);
  const stockPercent = report.stockChanges.length / config.products.length * 100;
  if (report.stockChanges.length > config.guardrails.max_stock_changes || stockPercent > config.guardrails.max_stock_change_percent) fail(`Stock change threshold exceeded: ${report.stockChanges.length} (${stockPercent.toFixed(2)}%)`);
  if (rows.length !== EXPECTED_COUNT) fail(`Expected ${EXPECTED_COUNT} canonical rows, got ${rows.length}`);
  return { rows, ...report, csv: serializeCsv(templateHeader, rows) };
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

function outputCount(output, label) {
  const match = output.match(new RegExp(`^\\s*${label}:\\s*(\\d+)\\s*$`, "mi"));
  if (!match) fail(`Importer output is missing counter: ${label}`);
  return Number(match[1]);
}

function runImporter(csvPath, spawn = spawnSync) {
  const args = [path.join(ROOT, "scripts/import-products.js"), "--mode=feed", "--dry-run", `--csv=${csvPath}`];
  const runId = crypto.randomUUID();
  const importReportPath = path.join(OUTPUT_DIR, `kior-import-report-${runId}.json`);
  fs.rmSync(importReportPath, { force: true });
  const result = spawn(process.execPath, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, SUPPLEMENTSCOUT_IMPORT_REPORT_PATH: importReportPath, SUPPLEMENTSCOUT_IMPORT_RUN_ID: runId },
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  let machineReport;
  try {
    if (result.status !== 0) fail(`Importer dry-run failed (${result.status}):\n${output}`);
    if (!output.includes("Dry run: no database writes performed.")) fail("Importer did not confirm zero database writes");
    if (!fs.existsSync(importReportPath)) fail("Importer did not create its row-level JSON report");
    try {
      machineReport = JSON.parse(fs.readFileSync(importReportPath, "utf8"));
    } catch {
      fail("Importer row-level JSON report is empty or invalid");
    }
  } finally {
    fs.rmSync(importReportPath, { force: true });
  }
  if (machineReport?.runId !== runId) fail("Importer row-level report is stale or belongs to another run");
  const summary = {
    approved_rows: outputCount(output, "approved rows"),
    invalid_rows: outputCount(output, "invalid rows"),
    ambiguous_rows: outputCount(output, "ambiguous rows"),
    new_retailers: outputCount(output, "new retailers would be created"),
    new_products: outputCount(output, "new products would be created"),
    retailer_products_created: outputCount(output, "retailer_products would be created"),
    offers_created: outputCount(output, "offers would be created"),
    offers_updated: outputCount(output, "offers would be updated"),
    offers_unchanged: outputCount(output, "offers unchanged"),
    price_history_created: outputCount(output, "price_history rows would be created"),
    skipped_for_review: outputCount(output, "Skipped for review"),
    failed: outputCount(output, "Failed"),
  };
  if (summary.approved_rows !== EXPECTED_COUNT || machineReport?.rowLevelOffers?.length !== EXPECTED_COUNT) fail(`Importer approved row count must be ${EXPECTED_COUNT}`);
  if (summary.skipped_for_review !== 0) fail("Importer skipped rows for review");
  if (summary.failed !== 0) fail("Importer reported failed rows");
  return { args, runId, output, summary, database_writes: 0 };
}

async function main(deps = {}) {
  const argv = deps.argv ?? process.argv.slice(2);
  if (argv.length !== 0) fail("KIOR adapter does not accept CLI arguments");
  fs.rmSync(REPORT_PATH, { force: true });
  const configText = fs.readFileSync(CONFIG_PATH, "utf8");
  const config = JSON.parse(configText);
  validateConfig(config);
  const shopify = await fetchJson(config.source_url, { timeoutMs: config.guardrails.fetch_timeout_ms, maxBytes: config.guardrails.max_response_bytes, fetchImpl: deps.fetchImpl });
  const exportPath = deps.exportPath ?? EXPORT_PATH;
  const csvEnrichmentUsed = fs.existsSync(exportPath);
  const exportGroups = csvEnrichmentUsed ? parseExport(fs.readFileSync(exportPath, "utf8")) : null;
  const templateHeader = fs.readFileSync(TEMPLATE_PATH, "utf8").split(/\r?\n/, 1)[0].split(",");
  const built = buildCanonical({ config, shopify, exportGroups, templateHeader });
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const canonicalValidator = deps.validateCanonical || validateCanonicalMappings;
  const client = deps.supabase || (deps.validateCanonical ? null : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "", { auth: { persistSession: false, autoRefreshToken: false } }));
  await canonicalValidator(config, client);
  const csvHash = sha256(built.csv);
  atomicWrite(CSV_PATH, built.csv);
  const importer = (deps.runImporter || runImporter)(CSV_PATH);
  if (importer.database_writes !== 0) fail("Importer database_writes must be zero");
  const report = {
    run_timestamp: new Date().toISOString(), runId: importer.runId, source_url: config.source_url,
    configured_products: config.products.length, mapped_products: built.rows.length,
    unmapped_products: built.unmappedProducts, canonical_rows: built.rows.length,
    csv_enrichment_used: csvEnrichmentUsed,
    ...(csvEnrichmentUsed ? { csv_enrichment_path: exportPath } : {}),
    sku_drifts: built.skuDrifts, barcode_drifts: built.barcodeDrifts,
    price_changes: built.priceChanges, stock_changes: built.stockChanges,
    handle_changes: built.handleChanges, vendor_mismatches: built.vendorMismatches,
    invalid_images: built.invalidImages, invalid_urls: built.invalidUrls,
    generated_csv_sha256: csvHash, importer_summary: importer.summary,
    database_writes: 0, success: true,
  };
  atomicWrite(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(importer.output);
  return { report, importer, csv: built.csv };
}

if (require.main === module) main().catch((error) => { console.error(`KIOR adapter failed: ${error.message}`); process.exitCode = 1; });

module.exports = {
  CSV_PATH, REPORT_PATH, atomicWrite, buildCanonical, fetchJson, main, normalizeCsvSku,
  normalizeEvidence, parseExport, runImporter, sha256, validateCanonicalMappings, validateConfig,
};
