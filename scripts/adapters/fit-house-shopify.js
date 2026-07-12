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
const EXPECTED_PRODUCT_COUNT = 73;
const BATCH_ONE_COUNT = 10;
const BATCH_TWO_COUNT = 12;
const BATCH_THREE_COUNT = 16;
const BATCH_FOUR_COUNT = 14;
const BATCH_FIVE_COUNT = 20;
const BATCH_THREE_START = BATCH_ONE_COUNT + BATCH_TWO_COUNT;
const BATCH_FOUR_START = BATCH_THREE_START + BATCH_THREE_COUNT;
const BATCH_FIVE_START = BATCH_FOUR_START + BATCH_FOUR_COUNT;
const EXISTING_CANONICAL_ADDITIONS_START = BATCH_FIVE_START + BATCH_FIVE_COUNT;
const EXISTING_CANONICAL_ADDITIONS_COUNT = 1;

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
  const batchFour = config.products.slice(BATCH_FOUR_START, BATCH_FIVE_START);
  if (batchFour.length !== BATCH_FOUR_COUNT || batchFour.some((item) => item.canonical_product_id !== null)) {
    fail("Batch four must contain exactly 14 new canonical product mappings");
  }
  const batchFive = config.products.slice(BATCH_FIVE_START, EXISTING_CANONICAL_ADDITIONS_START);
  if (batchFive.length !== BATCH_FIVE_COUNT || batchFive.some((item) => item.canonical_product_id !== null)) {
    fail("Batch five must contain exactly 20 new canonical product mappings");
  }
  const existingCanonicalAdditions = config.products.slice(EXISTING_CANONICAL_ADDITIONS_START);
  const shredMode = existingCanonicalAdditions[0];
  if (
    existingCanonicalAdditions.length !== EXISTING_CANONICAL_ADDITIONS_COUNT ||
    shredMode.shopify_product_id !== "9673951019248" ||
    shredMode.shopify_variant_id !== "48121139658992" ||
    shredMode.expected_handle !== "gym-high-shred-mode-60-capsules" ||
    shredMode.canonical_product_id !== 508 ||
    shredMode.canonical_slug !== "gym-high-shred-mode-60-capsules" ||
    shredMode.canonical_name !== "GYM HIGH Shred Mode 60 Capsules" ||
    shredMode.brand !== "GYM HIGH" ||
    shredMode.category !== "Health Supplements" ||
    shredMode.product_format !== "capsule" ||
    shredMode.variant_name !== "60 Capsules" ||
    shredMode.size !== null ||
    shredMode.size_unit !== null ||
    shredMode.flavour !== null ||
    shredMode.pack_count !== 1 ||
    shredMode.is_for_sale !== true ||
    shredMode.approved_price !== 39.99 ||
    shredMode.approved_in_stock !== true
  ) {
    fail("Unexpected Shred Mode existing canonical mapping");
  }
  const blockedProductIds = new Set([
    "8816846504176", "8693101330672", "8271509946608", "8968956084464",
    "8262988988656", "10081729544432", "10028522373360",
  ]);
  if (batchFour.some((item) => blockedProductIds.has(item.shopify_product_id))) {
    fail("Batch four contains a blocked product");
  }
  const fenugreek = batchFour.find((item) => item.shopify_product_id === "8479801114864");
  if (fenugreek?.canonical_name !== "Osavi Fenugreek 550mg 60 Capsules" || fenugreek.canonical_slug !== "osavi-fenugreek-550mg-60-capsules") {
    fail("Unexpected batch-four Fenugreek identity");
  }
  const colostrum = batchFour.find((item) => item.shopify_product_id === "8333749092592");
  if (colostrum?.canonical_name !== "Osavi Colostrum Powder 100g" || colostrum.canonical_slug !== "osavi-colostrum-powder-100g" || /1200mg/i.test(`${colostrum.canonical_name} ${colostrum.canonical_slug}`)) {
    fail("Unexpected batch-four Colostrum identity");
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

function validateGeneratedRows(rows, templateHeader) {
  if (rows.length !== EXPECTED_PRODUCT_COUNT) {
    fail(`Expected exactly ${EXPECTED_PRODUCT_COUNT} canonical rows, got ${rows.length}`);
  }
  assertUnique(rows, "external_url", "generated external URL");
  const allowed = new Set(templateHeader);
  if (rows.some((row) => Object.keys(row).some((key) => !allowed.has(key)) || templateHeader.some((key) => !Object.hasOwn(row, key)))) {
    fail("Generated row does not exactly match canonical template");
  }
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
  validateGeneratedRows(rows, templateHeader);
  return { rows, ...report, csv: serializeCsv(templateHeader, rows) };
}

function importerCommand(csvPath) {
  return [process.execPath, path.join(ROOT, "scripts/import-products.js"), "--mode=feed", "--safe-create", "--dry-run", `--csv=${csvPath}`];
}

function runImporter(csvPath, spawn = spawnSync) {
  const command = importerCommand(csvPath);
  const runId = crypto.randomUUID();
  const importReportPath = path.join(OUTPUT_DIR, `fit-house-import-report-${runId}.json`);
  fs.rmSync(importReportPath, { force: true });
  const result = spawn(command[0], command.slice(1), {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      SUPPLEMENTSCOUT_IMPORT_REPORT_PATH: importReportPath,
      SUPPLEMENTSCOUT_IMPORT_RUN_ID: runId,
    },
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if (result.status !== 0) fail(`Importer safe-create dry-run failed (${result.status}):\n${output}`);
  if (!output.includes("Dry run: no database writes performed.")) fail("Importer did not confirm zero database writes");
  if (!fs.existsSync(importReportPath)) fail("Importer did not create its row-level JSON report");
  let machineReport;
  try {
    machineReport = JSON.parse(fs.readFileSync(importReportPath, "utf8"));
  } catch {
    fail("Importer row-level JSON report is empty or invalid");
  } finally {
    fs.rmSync(importReportPath, { force: true });
  }
  if (machineReport?.runId !== runId) fail("Importer row-level report is stale or belongs to another run");
  return { command, status: result.status, output, rowLevelOffers: machineReport.rowLevelOffers, database_writes: 0 };
}

function importerCount(output, label) {
  const match = output.match(new RegExp(`^\\s*${label}:\\s*(\\d+)\\s*$`, "mi"));
  if (!match) fail(`Importer output is missing counter: ${label}`);
  return Number(match[1]);
}

function batchOfferCounts(config, rowLevelOffers) {
  if (!Array.isArray(rowLevelOffers)) fail("Importer row-level offer report is missing");
  const approvedSlugs = config.products.map((item) => item.canonical_slug);
  const approved = new Set(approvedSlugs);
  const bySlug = new Map();
  for (const item of rowLevelOffers) {
    if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).sort().join(",") !== "offerAction,rowNumber,slug") {
      fail("Importer row-level result must contain exactly rowNumber, slug, and offerAction");
    }
    if (!Number.isInteger(item.rowNumber) || item.rowNumber < 2) fail(`Invalid rowNumber for ${item.slug}`);
    if (!approved.has(item.slug)) fail(`Importer row-level report contains unknown slug: ${item.slug}`);
    if (bySlug.has(item.slug)) fail(`Importer row-level report contains duplicate slug: ${item.slug}`);
    if (!["create", "update", "unchanged"].includes(item.offerAction)) fail(`Invalid offerAction for ${item.slug}`);
    bySlug.set(item.slug, item.offerAction);
  }
  for (const slug of approvedSlugs) {
    if (!bySlug.has(slug)) fail(`Importer row-level report is missing approved slug: ${slug}`);
  }
  if (rowLevelOffers.length !== approvedSlugs.length) fail("Importer row-level result count does not match approved rows");
  const count = (slugs) => {
    const result = { offers_created: 0, offers_updated: 0, offers_unchanged: 0 };
    const keys = {
      create: "offers_created",
      update: "offers_updated",
      unchanged: "offers_unchanged",
    };
    for (const slug of slugs) result[keys[bySlug.get(slug)]] += 1;
    return result;
  };
  return {
    batch_1: count(approvedSlugs.slice(0, BATCH_ONE_COUNT)),
    batch_2: count(approvedSlugs.slice(BATCH_ONE_COUNT, BATCH_THREE_START)),
    batch_3: count(approvedSlugs.slice(BATCH_THREE_START, BATCH_FOUR_START)),
    batch_4: count(approvedSlugs.slice(BATCH_FOUR_START, BATCH_FIVE_START)),
    batch_5: count(approvedSlugs.slice(BATCH_FIVE_START, EXISTING_CANONICAL_ADDITIONS_START)),
    existing_canonical_additions: count(approvedSlugs.slice(EXISTING_CANONICAL_ADDITIONS_START)),
  };
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
  const importerCounts = {
    new_products: importerCount(importer.output, "new products would be created"),
    retailer_products_created: importerCount(importer.output, "retailer_products would be created"),
    offers_created: importerCount(importer.output, "offers would be created"),
    offers_updated: importerCount(importer.output, "offers would be updated"),
    offers_unchanged: importerCount(importer.output, "offers unchanged"),
    price_history_created: importerCount(importer.output, "price_history rows would be created"),
  };
  const batchOffers = batchOfferCounts(config, importer.rowLevelOffers);
  for (const key of ["offers_created", "offers_updated", "offers_unchanged"]) {
    if (batchOffers.batch_1[key] + batchOffers.batch_2[key] + batchOffers.batch_3[key] + batchOffers.batch_4[key] + batchOffers.batch_5[key] + batchOffers.existing_canonical_additions[key] !== importerCounts[key]) {
      fail(`Batch offer count mismatch for ${key}`);
    }
  }
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
    batches: {
      batch_1: {
        configured: BATCH_ONE_COUNT,
        mapped: built.rows.slice(0, BATCH_ONE_COUNT).length,
        existing_products: BATCH_ONE_COUNT,
        ...batchOffers.batch_1,
      },
      batch_2: {
        configured: BATCH_TWO_COUNT,
        mapped: built.rows.slice(BATCH_ONE_COUNT, BATCH_THREE_START).length,
        existing_products: BATCH_TWO_COUNT,
        ...batchOffers.batch_2,
      },
      batch_3: {
        configured: BATCH_THREE_COUNT,
        mapped: built.rows.slice(BATCH_THREE_START, BATCH_FOUR_START).length,
        existing_canonical_mappings: config.products.slice(BATCH_THREE_START, BATCH_FOUR_START).filter((item) => item.canonical_product_id !== null).length,
        ...batchOffers.batch_3,
      },
      batch_4: {
        configured: BATCH_FOUR_COUNT,
        mapped: built.rows.slice(BATCH_FOUR_START, BATCH_FIVE_START).length,
        ...batchOffers.batch_4,
      },
      batch_5: {
        configured: BATCH_FIVE_COUNT,
        mapped: built.rows.slice(BATCH_FIVE_START, EXISTING_CANONICAL_ADDITIONS_START).length,
        new_products_planned: importerCounts.new_products,
        new_retailer_products_planned: importerCounts.retailer_products_created - batchOffers.existing_canonical_additions.offers_created,
        new_offers_planned: importerCounts.offers_created - batchOffers.existing_canonical_additions.offers_created,
        new_price_history_rows_planned: importerCounts.price_history_created - batchOffers.existing_canonical_additions.offers_created,
        ...batchOffers.batch_5,
      },
      existing_canonical_additions: {
        configured: EXISTING_CANONICAL_ADDITIONS_COUNT,
        mapped: built.rows.slice(EXISTING_CANONICAL_ADDITIONS_START).length,
        canonical_product_id: 508,
        existing_canonical_mappings: 1,
        new_products_planned: 0,
        new_retailer_products_planned: batchOffers.existing_canonical_additions.offers_created,
        new_offers_planned: batchOffers.existing_canonical_additions.offers_created,
        new_price_history_rows_planned: batchOffers.existing_canonical_additions.offers_created,
        ...batchOffers.existing_canonical_additions,
      },
    },
    database_writes: importer.database_writes,
    success: true,
  };
  atomicWrite(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(importer.output);
  return { report, importer, csv: built.csv };
}

if (require.main === module) {
  main().catch((error) => { console.error(`Fit House adapter failed: ${error.message}`); process.exitCode = 1; });
}

module.exports = { CSV_PATH, REPORT_PATH, batchOfferCounts, buildCanonical, importerCommand, main, runImporter, sha256, validateConfig, validateGeneratedRows };
