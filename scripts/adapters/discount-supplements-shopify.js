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
const RAW_FULL_PATH = path.join(OUTPUT_DIR, "discount-supplements-raw-full.json");
const NORMALIZED_FULL_PATH = path.join(OUTPUT_DIR, "discount-supplements-normalized-full.csv");
const FULL_REPORT_PATH = path.join(OUTPUT_DIR, "discount-supplements-full-run-report.json");
const EXPECTED_COUNT = 3;
// A public Shopify catalog listing may remain for sale while its current inventory is unavailable.
const CATALOG_LISTING_IS_FOR_SALE = "true";
const EXPECTED_ACTIONS = new Map([
  ["cnp-creatine-monohydrate-250g", "unchanged"],
  ["applied-nutrition-creatine-120-capsules", "create"],
  ["tbjp-berberine-60-capsules", "create"],
]);

function fail(message) { throw new Error(message); }
function id(value, label) { const result = String(value ?? "").trim(); if (!/^\d+$/.test(result)) fail(`Invalid ${label}: ${value}`); return result; }
function evidence(value) { return value === null || value === undefined || String(value).trim() === "" ? null : String(value).trim(); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function csvCell(value) { const text = value === null || value === undefined ? "" : String(value); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function serializeCsv(header, rows) { return `${[header, ...rows.map((row) => header.map((key) => row[key] ?? ""))].map((line) => line.map(csvCell).join(",")).join("\n")}\n`; }
function validHttps(value, hostname) { try { const url = new URL(value); return url.protocol === "https:" && (!hostname || url.hostname === hostname); } catch { return false; } }

const APPROVED = [
  { shopify_product_id: "6788065329348", shopify_variant_id: "54879874810234", expected_variant_count: 1, expected_handle: "cnp-pro-creatine-250g", expected_product_title: "CNP Creatine Monohydrate 250g", expected_variant_title: "250g / Unflavoured", expected_option1: "250g", expected_option2: "Unflavoured", expected_option3: null, expected_sku: "CNP-0508", expected_barcode: null, expected_unit_count: null, expected_row_action: "unchanged", canonical_product_id: 407, canonical_name: "CNP Creatine Monohydrate 250g", canonical_slug: "cnp-creatine-monohydrate-250g", brand: "CNP", category: "Creatine", product_format: "powder", variant_name: "250g / Unflavoured", size: 250, size_unit: "g", flavour: "Unflavoured", pack_count: 1, is_for_sale: true, approved_price: 12.99, approved_in_stock: true },
  { shopify_product_id: "4670583111727", shopify_variant_id: "54863968076154", expected_variant_count: 1, expected_handle: "applied-nutrition-creatine-3000-120-caps", expected_product_title: "Applied Nutrition Creatine 3000 120 Caps", expected_variant_title: "120 Caps", expected_option1: "120 Caps", expected_option2: null, expected_option3: null, expected_sku: "APNU-0090", expected_barcode: null, expected_unit_count: 120, expected_row_action: "create", canonical_product_id: 426, canonical_name: "Applied Nutrition Creatine 120 Capsules", canonical_slug: "applied-nutrition-creatine-120-capsules", brand: "Applied Nutrition", category: "Creatine", product_format: "capsule", variant_name: "120 Capsules", size: null, size_unit: null, flavour: null, pack_count: 1, is_for_sale: true, approved_price: 9.99, approved_in_stock: true },
  { shopify_product_id: "16106741498234", shopify_variant_id: "56887361470842", expected_variant_count: 1, expected_handle: "trained-by-jp-berberine-60-caps", expected_product_title: "Trained By JP TBJP Berberine 60 Caps", expected_variant_title: "60 Caps", expected_option1: "60 Caps", expected_option2: null, expected_option3: null, expected_sku: "TBJP-0100", expected_barcode: null, expected_unit_count: 60, expected_row_action: "create", canonical_product_id: 688, canonical_name: "TBJP Berberine 60 Capsules", canonical_slug: "tbjp-berberine-60-capsules", brand: "TBJP", category: "Health Supplements", product_format: "capsule", variant_name: "60 Capsules", size: null, size_unit: null, flavour: null, pack_count: 1, is_for_sale: true, approved_price: 12.99, approved_in_stock: true },
];

function validateSourceConfig(config) {
  if (config?.schema_version !== 1 || config.source_url !== "https://www.discount-supplements.co.uk/products.json?limit=250") fail("Unexpected config schema or Shopify source URL");
  if (config.guardrails?.fetch_timeout_ms !== 15000 || config.guardrails.max_response_bytes !== 5242880 || config.guardrails.max_pages !== 20) fail("Unexpected fetch guardrails");
  const retailer = config.retailer;
  if (retailer?.id !== 4 || retailer.name !== "Discount Supplements" || retailer.slug !== "discount-supplements" || retailer.website !== "https://www.discount-supplements.co.uk") fail("Unexpected retailer identity");
}

function validateConfig(config) {
  validateSourceConfig(config);
  const retailer = config.retailer;
  if (JSON.stringify(retailer.vendor_aliases) !== JSON.stringify(["CNP", "Applied Nutrition", "TBJP"])) fail("Unexpected vendor aliases");
  if (config.shipping?.known !== true || config.shipping.cost !== 4.99 || config.shipping.free_shipping_threshold !== 80 || !config.shipping.approval_note) fail("Unexpected shipping config");
  if (!Array.isArray(config.products) || config.products.length !== EXPECTED_COUNT) fail(`Config must contain exactly ${EXPECTED_COUNT} approved products`);
  for (let index = 0; index < APPROVED.length; index += 1) {
    const item = config.products[index], approved = APPROVED[index];
    id(item?.shopify_product_id, "Shopify product ID"); id(item?.shopify_variant_id, "Shopify variant ID");
    for (const [key, value] of Object.entries(approved)) if (item[key] !== value) fail(`Unexpected ${key} for mapping ${index + 1}`);
    if (item.expected_unit_count !== null && item.expected_option1 !== `${item.expected_unit_count} Caps`) fail(`Unexpected capsule count evidence for mapping ${index + 1}`);
  }
  for (const key of ["shopify_product_id", "shopify_variant_id", "canonical_product_id", "canonical_slug", "expected_handle"]) {
    if (new Set(config.products.map((item) => String(item[key]))).size !== EXPECTED_COUNT) fail(`Duplicate ${key}`);
  }
}

async function fetchCatalog(config, fetchImpl) {
  const products = [], required = new Set(config.products.map((item) => item.shopify_product_id));
  for (let page = 1; page <= config.guardrails.max_pages; page += 1) {
    const payload = await fetchJson(`${config.source_url}&page=${page}`, { timeoutMs: config.guardrails.fetch_timeout_ms, maxBytes: config.guardrails.max_response_bytes, fetchImpl });
    if (!payload || !Array.isArray(payload.products)) fail(`Invalid Shopify products page ${page}`);
    products.push(...payload.products);
    for (const product of payload.products) required.delete(String(product.id));
    if (required.size === 0 || payload.products.length < 250) break;
  }
  return { products };
}

async function fetchFullCatalog(config, fetchImpl) {
  const products = [], pageProductCounts = [];
  let complete = false;
  for (let page = 1; page <= config.guardrails.max_pages; page += 1) {
    let payload;
    try {
      payload = await fetchJson(`${config.source_url}&page=${page}`, {
        timeoutMs: config.guardrails.fetch_timeout_ms,
        maxBytes: config.guardrails.max_response_bytes,
        fetchImpl,
      });
    } catch (error) {
      if (page > 1 && error?.message === "Shopify products array is empty") {
        pageProductCounts.push(0);
        complete = true;
        break;
      }
      throw error;
    }
    if (!payload || !Array.isArray(payload.products)) fail(`Invalid Shopify products page ${page}`);
    pageProductCounts.push(payload.products.length);
    products.push(...payload.products);
    if (payload.products.length < 250) {
      complete = true;
      break;
    }
  }
  if (!complete) fail(`Full catalog pagination exceeded ${config.guardrails.max_pages} pages`);
  if (products.length < 10) fail(`Suspiciously low full catalog product count: ${products.length}`);
  const productIds = products.map((product) => id(product?.id, "Shopify product ID"));
  if (new Set(productIds).size !== productIds.length) fail("Duplicate Shopify product ID across pages");
  return { products, pageProductCounts };
}

const NORMALIZED_FULL_HEADER = [
  "retailer_name", "retailer_website", "external_product_id", "external_variant_id",
  "external_sku", "external_options", "external_gtin", "product_name", "variant_name",
  "brand", "category", "handle", "external_url", "price", "in_stock", "is_for_sale",
  "image", "product_updated_at", "variant_updated_at",
];

function normalizePrice(value, variantId) {
  const normalized = String(value ?? "").trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized) || !/[1-9]/.test(normalized)) {
    fail(`Invalid Shopify price for variant ${variantId}: ${JSON.stringify(normalized)}`);
  }
  return normalized;
}

function productContext(productId, title) {
  const safeTitle = String(title ?? "").trim().slice(0, 160);
  return safeTitle ? `${productId} (${JSON.stringify(safeTitle)})` : productId;
}

function buildNormalizedFull({ config, shopify }) {
  if (!shopify || !Array.isArray(shopify.products)) fail("Invalid full Shopify catalog");
  const rows = [], variantIds = new Set(), productVariantCounts = [];
  for (const product of shopify.products) {
    const productId = id(product?.id, "Shopify product ID");
    const context = productContext(productId, product?.title);
    const handle = String(product.handle || "").trim();
    if (!handle) fail(`Missing Shopify handle for product ${productId}`);
    if (!Array.isArray(product.variants) || product.variants.length === 0) fail(`Missing or empty Shopify variants for product ${context}`);
    productVariantCounts.push({ product_id: productId, variant_count: product.variants.length });
    for (const variant of product.variants) {
      const variantId = id(variant?.id, "Shopify variant ID");
      if (variantIds.has(variantId)) fail(`Duplicate Shopify variant ID: ${variantId}`);
      variantIds.add(variantId);
      if (String(variant.product_id ?? product.id) !== productId) fail(`Shopify variant ownership mismatch: ${variantId}`);
      const price = normalizePrice(variant.price, variantId);
      const url = `${config.retailer.website}/products/${handle}?variant=${variantId}`;
      if (!validHttps(url, "www.discount-supplements.co.uk") || new URL(url).searchParams.get("variant") !== variantId) fail(`Invalid direct variant URL for ${variantId}`);
      const options = {};
      for (let position = 1; position <= 3; position += 1) {
        const value = evidence(variant[`option${position}`]);
        if (value === null) continue;
        const option = (product.options || []).find((candidate) => Number(candidate?.position) === position) || product.options?.[position - 1];
        const name = String(option?.name || `Option${position}`).trim();
        options[name] = value;
      }
      const image = String(variant.featured_image?.src || variant.featured_image || product.image?.src || product.images?.[0]?.src || "").trim();
      rows.push({
        retailer_name: config.retailer.name,
        retailer_website: config.retailer.website,
        external_product_id: productId,
        external_variant_id: variantId,
        external_sku: evidence(variant.sku) || "",
        external_options: JSON.stringify(options),
        external_gtin: evidence(variant.barcode) || "",
        product_name: String(product.title || "").trim(),
        variant_name: String(variant.title || "").trim(),
        brand: String(product.vendor || "").trim(),
        category: String(product.product_type || "").trim(),
        handle,
        external_url: url,
        price,
        in_stock: String(Boolean(variant.available)),
        is_for_sale: CATALOG_LISTING_IS_FOR_SALE,
        image,
        product_updated_at: String(product.updated_at || "").trim(),
        variant_updated_at: String(variant.updated_at || "").trim(),
      });
    }
  }
  if (rows.length !== variantIds.size) fail("Full snapshot did not preserve every unique Shopify variant");
  return { rows, productVariantCounts, invalidRecordCount: 0, csv: serializeCsv(NORMALIZED_FULL_HEADER, rows) };
}

async function fullSnapshotMain(deps = {}) {
  const config = deps.config ?? JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); validateSourceConfig(config);
  const rawPath = deps.rawPath ?? RAW_FULL_PATH;
  const normalizedPath = deps.normalizedPath ?? NORMALIZED_FULL_PATH;
  const reportPath = deps.reportPath ?? FULL_REPORT_PATH;
  const startedAt = new Date().toISOString();
  const shopify = await (deps.fetchFullCatalog || fetchFullCatalog)(config, deps.fetchImpl);
  const built = buildNormalizedFull({ config, shopify });
  const raw = `${JSON.stringify({ source_url: config.source_url, page_product_counts: shopify.pageProductCounts, products: shopify.products }, null, 2)}\n`;
  const rowsWithSku = built.rows.filter((row) => row.external_sku).length;
  const rowsWithGtin = built.rows.filter((row) => row.external_gtin).length;
  const rowsWithOptions = built.rows.filter((row) => row.external_options !== "{}").length;
  const inStock = built.rows.filter((row) => row.in_stock === "true").length;
  const reportBase = {
    source_url: config.source_url,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    page_count: shopify.pageProductCounts.length,
    page_product_counts: shopify.pageProductCounts,
    shopify_product_count: shopify.products.length,
    shopify_variant_count: built.rows.length,
    in_stock_count: inStock,
    out_of_stock_count: built.rows.length - inStock,
    with_sku_count: rowsWithSku,
    with_gtin_count: rowsWithGtin,
    with_options_count: rowsWithOptions,
    invalid_record_count: built.invalidRecordCount,
    duplicate_external_variant_id_count: 0,
    product_variant_counts: built.productVariantCounts,
    output_hashes: {
      raw_json_sha256: sha256(raw),
      normalized_csv_sha256: sha256(built.csv),
    },
    database_writes: 0,
    importer_run: false,
  };
  const report = reportBase;
  atomicWrite(rawPath, raw);
  atomicWrite(normalizedPath, built.csv);
  atomicWrite(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  // The final report file hash is emitted after writing; embedding it in that file would be cyclic.
  (deps.log ?? console.log)(JSON.stringify({ ...report, report_file_sha256: sha256(fs.readFileSync(reportPath)) }, null, 2));
  return { rawPath, normalizedPath, reportPath, report, rows: built.rows };
}

function buildCanonical({ config, shopify, templateHeader }) {
  validateConfig(config);
  if (!shopify || !Array.isArray(shopify.products)) fail("Invalid Shopify catalog");
  const rows = [], seenProducts = new Set();
  for (const item of config.products) {
    const matches = shopify.products.filter((product) => String(product.id) === item.shopify_product_id);
    if (matches.length !== 1 || seenProducts.has(item.shopify_product_id)) fail(`Missing or duplicate Shopify product ${item.shopify_product_id}`);
    seenProducts.add(item.shopify_product_id);
    const product = matches[0];
    if (product.title !== item.expected_product_title || product.handle !== item.expected_handle) fail(`Shopify product identity drift for ${item.shopify_product_id}`);
    if (product.vendor !== item.brand || !config.retailer.vendor_aliases.includes(product.vendor)) fail(`Shopify vendor drift for ${item.shopify_product_id}`);
    if (!Array.isArray(product.variants) || product.variants.length !== item.expected_variant_count) fail(`Shopify variant count drift for ${item.shopify_product_id}`);
    const expectedOptions = [{ name: "Size", position: 1, values: [item.expected_option1] }];
    if (item.expected_option2 !== null) expectedOptions.push({ name: "Flavour", position: 2, values: [item.expected_option2] });
    if (JSON.stringify(product.options || []) !== JSON.stringify(expectedOptions)) fail(`Shopify option drift for ${item.shopify_product_id}`);
    const variant = product.variants.find((candidate) => String(candidate.id) === item.shopify_variant_id);
    if (!variant || String(variant.product_id ?? product.id) !== item.shopify_product_id) fail(`Shopify variant identity drift for ${item.shopify_product_id}`);
    for (const [key, expected] of [["title", item.expected_variant_title], ["option1", item.expected_option1], ["option2", item.expected_option2], ["option3", item.expected_option3]]) if ((variant[key] ?? null) !== expected) fail(`Shopify variant ${key} drift for ${item.shopify_product_id}`);
    if (evidence(variant.sku) !== item.expected_sku || evidence(variant.barcode) !== item.expected_barcode) fail(`Shopify SKU or barcode drift for ${item.shopify_product_id}`);
    if (Number(variant.price) !== item.approved_price || Boolean(variant.available) !== item.approved_in_stock) fail(`Shopify price or stock drift for ${item.shopify_product_id}`);
    const image = String(variant.featured_image?.src || variant.featured_image || product.images?.[0]?.src || "").trim();
    if (!validHttps(image, "cdn.shopify.com")) fail(`Invalid Shopify CDN image for ${item.shopify_product_id}`);
    const url = `${config.retailer.website}/products/${product.handle}?variant=${item.shopify_variant_id}`;
    if (!validHttps(url, "www.discount-supplements.co.uk") || new URL(url).searchParams.get("variant") !== item.shopify_variant_id) fail(`Invalid direct variant URL for ${item.shopify_product_id}`);
    const sourceUpdatedAt = variant.updated_at || product.updated_at;
    if (!sourceUpdatedAt || !Number.isFinite(Date.parse(sourceUpdatedAt))) fail(`Invalid source updated_at for ${item.shopify_product_id}`);
    const row = {
      retailer_name: config.retailer.name, retailer_website: config.retailer.website, external_product_id: item.shopify_product_id, external_variant_id: item.shopify_variant_id,
      product_name: item.canonical_name, variant_name: item.variant_name, brand: item.brand, category: item.category, description: "", image, slug: item.canonical_slug,
      external_url: url, affiliate_url: url, external_gtin: item.expected_barcode ?? "", price: String(variant.price), shipping_known: "true", shipping_cost: String(config.shipping.cost),
      in_stock: String(Boolean(variant.available)), is_for_sale: String(item.is_for_sale), size: item.size ?? "", size_unit: item.size_unit ?? "", flavour: item.flavour ?? "",
      product_format: item.product_format, pack_count: String(item.pack_count), source_updated_at: sourceUpdatedAt,
    };
    if (Object.keys(row).some((key) => !templateHeader.includes(key)) || templateHeader.some((key) => !Object.hasOwn(row, key))) fail("Generated row does not match canonical template");
    rows.push(row);
  }
  if (rows.length !== EXPECTED_COUNT) fail(`Expected ${EXPECTED_COUNT} canonical rows`);
  return { rows, csv: serializeCsv(templateHeader, rows), unmappedProducts: shopify.products.filter((product) => !seenProducts.has(String(product.id))).map((product) => ({ product_id: String(product.id), title: product.title, handle: product.handle })) };
}

async function validateProductionTargets(config, client) {
  const { data: retailer, error: retailerError } = await client.from("retailers").select("id, name, slug, website").eq("slug", config.retailer.slug).maybeSingle();
  if (retailerError) throw retailerError;
  if (!retailer || retailer.id !== 4 || retailer.name !== config.retailer.name || retailer.slug !== config.retailer.slug || retailer.website !== config.retailer.website) fail("Retailer identity drift");
  const ids = config.products.map((item) => item.canonical_product_id);
  const { data, error } = await client.from("products").select("id, slug, is_active, merged_into_product_id, merged_at").in("id", ids);
  if (error) throw error;
  const byId = new Map((data || []).map((row) => [String(row.id), row]));
  for (const item of config.products) { const product = byId.get(String(item.canonical_product_id)); if (!product || product.slug !== item.canonical_slug || product.is_active !== true || product.merged_into_product_id !== null || product.merged_at !== null) fail(`Canonical identity drift for ${item.canonical_product_id}`); }
}

function count(output, label) { const match = output.match(new RegExp(`^\\s*${label}:\\s*(\\d+)\\s*$`, "mi")); if (!match) fail(`Importer output is missing counter: ${label}`); return Number(match[1]); }
function runImporter(csvPath, spawn = spawnSync) {
  const args = [path.join(ROOT, "scripts/import-products.js"), "--mode=feed", "--dry-run", `--csv=${csvPath}`];
  const runId = crypto.randomUUID(), helperPath = path.join(OUTPUT_DIR, `discount-supplements-import-report-${runId}.json`);
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
  if (helper?.runId !== runId || helper?.rowLevelOffers?.length !== EXPECTED_COUNT) fail("Invalid or stale importer row-level report");
  const bySlug = new Map();
  for (const row of helper.rowLevelOffers) {
    if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).sort().join(",") !== "offerAction,rowNumber,slug" || !EXPECTED_ACTIONS.has(row.slug) || bySlug.has(row.slug)) fail("Invalid, extra, or duplicate importer row result");
    if (row.offerAction !== EXPECTED_ACTIONS.get(row.slug)) fail(`Unexpected row action for ${row.slug}: ${row.offerAction}`);
    bySlug.set(row.slug, row);
  }
  if (bySlug.size !== EXPECTED_ACTIONS.size || [...EXPECTED_ACTIONS.keys()].some((slug) => !bySlug.has(slug))) fail("Missing importer row result");
  const summary = {
    approved_rows: count(output, "approved rows"), invalid_rows: count(output, "invalid rows"), ambiguous_rows: count(output, "ambiguous rows"), new_retailers: count(output, "new retailers would be created"),
    new_products: count(output, "new products would be created"), retailer_products_created: count(output, "retailer_products would be created"), offers_created: count(output, "offers would be created"),
    offers_updated: count(output, "offers would be updated"), offers_unchanged: count(output, "offers unchanged"), price_history_created: count(output, "price_history rows would be created"),
    skipped_for_review: count(output, "Skipped for review"), failed: count(output, "Failed"),
  };
  const expected = { approved_rows: 3, invalid_rows: 0, ambiguous_rows: 0, new_retailers: 0, new_products: 0, retailer_products_created: 2, offers_created: 2, offers_updated: 0, offers_unchanged: 1, price_history_created: 2, skipped_for_review: 0, failed: 0 };
  for (const [key, value] of Object.entries(expected)) if (summary[key] !== value) fail(`Unexpected importer ${key}: ${summary[key]}`);
  return { args, runId, lifecycleState: "MIXED_BATCH", summary, rowLevelOffers: helper.rowLevelOffers, output, database_writes: 0 };
}

async function main(deps = {}) {
  const argv = deps.argv ?? process.argv.slice(2);
  if (argv.length === 1 && argv[0] === "--full-snapshot") return fullSnapshotMain(deps);
  if (argv.length) fail("Discount Supplements adapter does not accept CLI arguments other than --full-snapshot");
  const csvPath = deps.csvPath ?? CSV_PATH, reportPath = deps.reportPath ?? REPORT_PATH; fs.rmSync(reportPath, { force: true });
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); validateConfig(config);
  const shopify = await (deps.fetchCatalog || fetchCatalog)(config, deps.fetchImpl);
  const header = fs.readFileSync(TEMPLATE_PATH, "utf8").split(/\r?\n/, 1)[0].split(",");
  const built = buildCanonical({ config, shopify, templateHeader: header });
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const validator = deps.validateProduction || validateProductionTargets;
  const client = deps.supabase || (deps.validateProduction ? null : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "", { auth: { persistSession: false, autoRefreshToken: false } }));
  await validator(config, client); atomicWrite(csvPath, built.csv);
  const importer = (deps.runImporter || runImporter)(csvPath); if (importer.database_writes !== 0) fail("Importer database_writes must be zero");
  const report = {
    run_timestamp: new Date().toISOString(), runId: importer.runId, source_url: config.source_url, retailer_id: 4, configured_products: EXPECTED_COUNT, mapped_products: built.rows.length, canonical_rows: built.rows.length,
    shipping_known: true, shipping_cost: 4.99, free_shipping_threshold: 80,
    delivered_prices: config.products.map((item) => ({ canonical_product_id: item.canonical_product_id, delivered_price: Number((item.approved_price + config.shipping.cost).toFixed(2)) })),
    product_drifts: [], variant_drifts: [], price_changes: [], stock_changes: [], handle_changes: [], vendor_mismatches: [], sku_drifts: [], barcode_drifts: [], invalid_images: [], invalid_urls: [],
    generated_csv_sha256: sha256(built.csv), lifecycle_state: importer.lifecycleState, importer_summary: importer.summary, importer_row_results: importer.rowLevelOffers, database_writes: 0, success: true,
  };
  atomicWrite(reportPath, `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify(report, null, 2)); console.log(importer.output); return { report, importer, csv: built.csv };
}

if (require.main === module) main().catch((error) => { console.error(`Discount Supplements adapter failed: ${error.message}`); process.exitCode = 1; });
module.exports = {
  CSV_PATH, FULL_REPORT_PATH, NORMALIZED_FULL_PATH, RAW_FULL_PATH, REPORT_PATH,
  buildCanonical, buildNormalizedFull, fetchCatalog, fetchFullCatalog, fullSnapshotMain,
  main, normalizePrice, runImporter, validateConfig, validateProductionTargets, validateSourceConfig,
};
