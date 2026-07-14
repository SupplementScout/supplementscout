const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { parse } = require("csv-parse/sync");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const {
  normalizeFlavour,
  parseSize,
} = require("../import-products");
const {
  FULL_REPORT_PATH,
  NORMALIZED_FULL_PATH,
  RAW_FULL_PATH,
  validateSourceConfig,
} = require("./discount-supplements-shopify");
const { atomicWrite } = require("./kior-shopify");

const ROOT = path.resolve(__dirname, "../..");
const CONFIG_PATH = path.join(ROOT, "config/retailers/discount-supplements-shopify.json");
const OUTPUT_DIR = path.join(ROOT, "tmp/retailer-feeds/discount-supplements");
const CLASSIFICATION_JSON_PATH = path.join(OUTPUT_DIR, "discount-supplements-stage1-classification.json");
const CLASSIFICATION_CSV_PATH = path.join(OUTPUT_DIR, "discount-supplements-stage1-classification.csv");
const IMPORT_CSV_PATH = path.join(OUTPUT_DIR, "discount-supplements-stage1-existing-mappings.csv");
const RUN_REPORT_PATH = path.join(OUTPUT_DIR, "discount-supplements-stage1-report.json");

const BASELINE_PRODUCTS = 342;
const BASELINE_VARIANTS = 1007;
const MAX_COUNT_DROP_RATIO = 0.2;
const RETAILER_ID = 4;
const PAGE_SIZE = 1000;
const IMPORT_TIMEOUT_MS = 5 * 60 * 1000;
const CLASSIFICATIONS = [
  "NO_CHANGE",
  "SAFE_UPDATE",
  "NEW_VARIANT_REVIEW",
  "NEW_PRODUCT_REVIEW",
  "IDENTITY_CONFLICT",
  "SOURCE_ERROR",
  "OUT_OF_STOCK",
  "MISSING_FROM_SOURCE",
];
const ALLOWED_CHANGE_FIELDS = new Set([
  "price",
  "shipping_cost",
  "total_price",
  "in_stock",
  "external_url",
  "external_sku",
  "external_options",
  "external_gtin",
  "source_updated_at",
]);
const IMPORT_HEADER = [
  "retailer_name", "retailer_website", "external_product_id", "external_variant_id",
  "external_sku", "external_options", "product_name", "variant_name", "brand",
  "category", "description", "image", "slug", "external_url", "affiliate_url",
  "external_gtin", "price", "shipping_known", "shipping_cost", "in_stock",
  "is_for_sale", "size", "size_unit", "flavour", "product_format", "pack_count",
  "source_updated_at",
];
const CLASSIFICATION_HEADER = [
  "classification", "block_reason", "retailer_product_id", "offer_id", "product_id",
  "product_variant_id", "external_product_id", "external_variant_id", "product_name",
  "variant_name", "in_stock", "price", "changes", "external_url",
];

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function serializeCsv(header, rows) {
  const lines = [header, ...rows.map((row) => header.map((key) => row[key] ?? ""))];
  return `${lines.map((line) => line.map(csvCell).join(",")).join("\n")}\n`;
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
}

function equal(left, right) {
  return JSON.stringify(sortJson(left ?? null)) === JSON.stringify(sortJson(right ?? null));
}

function optional(value) {
  const result = String(value ?? "").trim();
  return result || null;
}

function exactBoolean(value, field) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  fail(`Invalid ${field}: ${JSON.stringify(value)}`);
}

function money(value, field) {
  const normalized = String(value ?? "").trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) {
    fail(`Invalid ${field}: ${JSON.stringify(value)}`);
  }
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
}

function positiveMoney(value, field) {
  const result = money(value, field);
  if (result <= 0n) fail(`Invalid ${field}: value must be greater than zero`);
  return result;
}

function formatMoney(cents) {
  const whole = cents / 100n;
  const fraction = String(cents % 100n).padStart(2, "0");
  return `${whole}.${fraction}`;
}

function parseObject(value, field) {
  let parsed;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    fail(`Invalid ${field} JSON`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail(`${field} must be a JSON object`);
  }
  return parsed;
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) fail(`${label} is missing: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    fail(`${label} is not valid JSON`);
  }
}

function validateSourceRow(row, index) {
  const rowNumber = index + 2;
  const productId = optional(row.external_product_id);
  const variantId = optional(row.external_variant_id);
  if (!productId || !/^\d+$/.test(productId)) fail(`SOURCE_ERROR row ${rowNumber}: invalid external_product_id`);
  if (!variantId || !/^\d+$/.test(variantId)) fail(`SOURCE_ERROR row ${rowNumber}: invalid external_variant_id`);
  positiveMoney(row.price, `SOURCE_ERROR row ${rowNumber} price`);
  exactBoolean(row.in_stock, `SOURCE_ERROR row ${rowNumber} in_stock`);
  exactBoolean(row.is_for_sale, `SOURCE_ERROR row ${rowNumber} is_for_sale`);
  parseObject(row.external_options, `SOURCE_ERROR row ${rowNumber} external_options`);
  let url;
  try {
    url = new URL(String(row.external_url || ""));
  } catch {
    fail(`SOURCE_ERROR row ${rowNumber}: invalid external_url`);
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "www.discount-supplements.co.uk" ||
    url.searchParams.get("variant") !== variantId
  ) {
    fail(`SOURCE_ERROR row ${rowNumber}: external_url does not bind the variant identity`);
  }
}

function validateSnapshotArtifacts(options = {}) {
  const rawPath = options.rawPath || RAW_FULL_PATH;
  const normalizedPath = options.normalizedPath || NORMALIZED_FULL_PATH;
  const fullReportPath = options.fullReportPath || FULL_REPORT_PATH;
  const baselineProducts = options.baselineProducts ?? BASELINE_PRODUCTS;
  const baselineVariants = options.baselineVariants ?? BASELINE_VARIANTS;
  const maxDropRatio = options.maxDropRatio ?? MAX_COUNT_DROP_RATIO;
  const report = readJson(fullReportPath, "Full snapshot report");
  const raw = readJson(rawPath, "Raw full snapshot");
  if (!fs.existsSync(normalizedPath)) fail(`Normalized full snapshot is missing: ${normalizedPath}`);
  const normalizedBytes = fs.readFileSync(normalizedPath);
  let rows;
  try {
    rows = parse(normalizedBytes, { columns: true, skip_empty_lines: true, trim: true });
  } catch {
    fail("Normalized full snapshot is not valid CSV");
  }
  if (!Array.isArray(raw.products) || raw.products.length === 0) fail("Raw snapshot has zero products");
  if (!Array.isArray(rows) || rows.length === 0) fail("Normalized snapshot has zero variants");
  if (report.source_url !== "https://www.discount-supplements.co.uk/products.json?limit=250") fail("Unexpected snapshot source endpoint");
  if (report.database_writes !== 0 || report.importer_run !== false) fail("Full snapshot report is not read-only");
  if (report.invalid_record_count !== 0 || report.duplicate_external_variant_id_count !== 0) fail("Full snapshot contains invalid or duplicate variants");
  if (report.shopify_product_count !== raw.products.length) fail("Snapshot product count mismatch");
  if (report.shopify_variant_count !== rows.length) fail("Snapshot variant count mismatch");
  if (report.in_stock_count + report.out_of_stock_count !== rows.length) fail("Snapshot stock counts do not add up");
  if (report.output_hashes?.raw_json_sha256 !== fileSha256(rawPath)) fail("Raw snapshot SHA-256 mismatch");
  if (report.output_hashes?.normalized_csv_sha256 !== sha256(normalizedBytes)) fail("Normalized snapshot SHA-256 mismatch");
  const pageCounts = report.page_product_counts;
  if (!Array.isArray(pageCounts) || pageCounts.length === 0 || report.page_count !== pageCounts.length) fail("Snapshot pagination report is invalid");
  if (pageCounts.some((count) => !Number.isInteger(count) || count < 0 || count > 250)) fail("Snapshot page count is invalid");
  if (pageCounts.slice(0, -1).some((count) => count !== 250) || pageCounts.at(-1) >= 250) fail("Snapshot pagination is incomplete");
  if (pageCounts.reduce((sum, count) => sum + count, 0) !== raw.products.length) fail("Snapshot pagination total mismatch");
  const minimumRatio = 1 - maxDropRatio;
  if (!Number.isFinite(minimumRatio) || minimumRatio <= 0 || minimumRatio > 1) fail("Snapshot count drop ratio is invalid");
  if (!Number.isInteger(baselineProducts) || baselineProducts <= 0) fail("Snapshot product baseline is invalid");
  if (!Number.isInteger(baselineVariants) || baselineVariants <= 0) fail("Snapshot variant baseline is invalid");
  if (raw.products.length / baselineProducts < minimumRatio) fail(`Snapshot product count drop exceeds ${maxDropRatio * 100}%`);
  if (rows.length / baselineVariants < minimumRatio) fail(`Snapshot variant count drop exceeds ${maxDropRatio * 100}%`);
  const variantIds = new Set();
  rows.forEach((row, index) => {
    validateSourceRow(row, index);
    const variantId = String(row.external_variant_id).trim();
    if (variantIds.has(variantId)) fail(`Duplicate external_variant_id in normalized snapshot: ${variantId}`);
    variantIds.add(variantId);
  });
  return { report, raw, rows, rawPath, normalizedPath, fullReportPath };
}

async function readAll(client, table, columns) {
  const rows = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await client.from(table).select(columns).range(start, start + PAGE_SIZE - 1);
    if (error) throw error;
    if (!Array.isArray(data)) fail(`Read-only query for ${table} did not return an array`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchProductionState(client) {
  const [retailers, retailerProducts, offers, products, productVariants] = await Promise.all([
    readAll(client, "retailers", "id, name, slug, website"),
    readAll(client, "retailer_products", "id, retailer_id, product_id, product_variant_id, external_name, external_slug, external_gtin, external_url, external_product_id, external_variant_id, external_sku, external_options, match_method, match_confidence, updated_at"),
    readAll(client, "offers", "id, product_id, retailer_id, retailer_product_id, product_variant_id, price, shipping_cost, total_price, in_stock, url, last_checked_at"),
    readAll(client, "products", "id, name, slug, brand, category, product_format, is_active, merged_into_product_id"),
    readAll(client, "product_variants", "id, product_id, variant_key, display_name, flavour_code, flavour_label, size_value, size_unit, pack_count, product_format, is_active, is_default"),
  ]);
  return { retailers, retailerProducts, offers, products, productVariants };
}

function optionValue(options, names) {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const matches = Object.entries(options)
    .filter(([name, value]) => wanted.has(String(name).trim().toLowerCase()) && optional(value))
    .map(([, value]) => String(value).trim());
  return [...new Set(matches)];
}

function sizeMatches(sourceValue, variant) {
  if (!sourceValue) return true;
  const parsed = parseSize(sourceValue);
  if (!parsed || variant.size_value === null || variant.size_value === undefined || !variant.size_unit) return false;
  const canonical = parseSize(`${variant.size_value}${variant.size_unit}`);
  return Boolean(
    canonical && parsed.unit === canonical.unit && parsed.dimension === canonical.dimension &&
    Number(parsed.value) === Number(canonical.value)
  );
}

function variantIdentityErrors(row, mapping, variant, variantsForProduct) {
  const errors = [];
  const options = parseObject(row.external_options, "external_options");
  const flavours = optionValue(options, ["flavour", "flavor"]);
  const sizes = optionValue(options, ["size"]);
  if (flavours.length > 1 || sizes.length > 1) errors.push("ambiguous Shopify option identity");
  if (variant.is_default === true) {
    const hasActiveNonDefault = variantsForProduct.some((item) => item.is_active === true && item.is_default !== true);
    if (hasActiveNonDefault && (flavours.length || sizes.length)) {
      errors.push("variant evidence cannot remain on the default variant when active non-default variants exist");
    }
  } else {
    if (flavours.length) {
      const sourceFlavour = normalizeFlavour(flavours[0]);
      const canonicalFlavours = [variant.flavour_code, variant.flavour_label]
        .map(normalizeFlavour)
        .filter(Boolean);
      if (!canonicalFlavours.includes(sourceFlavour)) errors.push("Shopify flavour does not match canonical variant");
    }
    if (sizes.length && !sizeMatches(sizes[0], variant)) errors.push("Shopify size does not match canonical variant");
  }
  if (String(mapping.product_id) !== String(variant.product_id)) errors.push("mapping and canonical variant product_id differ");
  return errors;
}

function importRow(row, mapping, offer, product, variant, config) {
  const sourceTimestamp = optional(row.variant_updated_at) || optional(row.product_updated_at) || "";
  return {
    retailer_name: config.retailer.name,
    retailer_website: config.retailer.website,
    external_product_id: String(row.external_product_id),
    external_variant_id: String(row.external_variant_id),
    external_sku: optional(row.external_sku) || "",
    external_options: JSON.stringify(parseObject(row.external_options, "external_options")),
    product_name: mapping.external_name,
    variant_name: variant.is_default ? "" : variant.display_name,
    brand: product.brand,
    category: product.category,
    description: "",
    image: optional(row.image) || "",
    slug: mapping.external_slug,
    external_url: row.external_url,
    affiliate_url: row.external_url,
    external_gtin: optional(row.external_gtin) || "",
    price: formatMoney(positiveMoney(row.price, "price")),
    shipping_known: "true",
    shipping_cost: formatMoney(money(config.shipping.cost, "shipping cost")),
    in_stock: String(exactBoolean(row.in_stock, "in_stock")),
    is_for_sale: String(exactBoolean(row.is_for_sale, "is_for_sale")),
    size: variant.is_default || variant.size_value === null ? "" : String(variant.size_value),
    size_unit: variant.is_default ? "" : optional(variant.size_unit) || "",
    flavour: variant.is_default ? "" : optional(variant.flavour_label) || optional(variant.flavour_code) || "",
    product_format: optional(variant.product_format) || optional(product.product_format) || "",
    pack_count: variant.is_default || variant.pack_count === null ? "" : String(variant.pack_count),
    source_updated_at: sourceTimestamp,
  };
}

function entryBase(row) {
  return {
    classification: null,
    block_reason: null,
    retailer_product_id: null,
    offer_id: null,
    product_id: null,
    product_variant_id: null,
    external_product_id: optional(row?.external_product_id),
    external_variant_id: optional(row?.external_variant_id),
    product_name: optional(row?.product_name),
    variant_name: optional(row?.variant_name),
    in_stock: row ? exactBoolean(row.in_stock, "in_stock") : null,
    price: optional(row?.price),
    changes: [],
    external_url: optional(row?.external_url),
  };
}

function countClassifications(entries) {
  const counts = Object.fromEntries(CLASSIFICATIONS.map((name) => [name, 0]));
  for (const entry of entries) counts[entry.classification] += 1;
  return counts;
}

function classifyCatalog({ rows, state, config }) {
  const retailer = state.retailers.filter((item) => Number(item.id) === RETAILER_ID);
  if (
    retailer.length !== 1 || retailer[0].name !== config.retailer.name ||
    retailer[0].slug !== config.retailer.slug || retailer[0].website !== config.retailer.website
  ) fail("Discount Supplements retailer identity drift");
  const allMappingsByVariant = new Map();
  const mappingsByUrl = new Map();
  for (const mapping of state.retailerProducts) {
    const variantId = optional(mapping.external_variant_id);
    if (variantId) {
      if (!allMappingsByVariant.has(variantId)) allMappingsByVariant.set(variantId, []);
      allMappingsByVariant.get(variantId).push(mapping);
    }
    const url = optional(mapping.external_url);
    if (url) {
      if (!mappingsByUrl.has(url)) mappingsByUrl.set(url, []);
      mappingsByUrl.get(url).push(mapping);
    }
  }
  const retailerMappings = state.retailerProducts.filter((item) => Number(item.retailer_id) === RETAILER_ID);
  const retailerExternalProductIds = new Set(retailerMappings.map((item) => optional(item.external_product_id)).filter(Boolean));
  const offersByMapping = new Map();
  for (const offer of state.offers.filter((item) => Number(item.retailer_id) === RETAILER_ID)) {
    const key = String(offer.retailer_product_id);
    if (!offersByMapping.has(key)) offersByMapping.set(key, []);
    offersByMapping.get(key).push(offer);
  }
  const productsById = new Map(state.products.map((item) => [String(item.id), item]));
  const variantsById = new Map(state.productVariants.map((item) => [String(item.id), item]));
  const variantsByProduct = new Map();
  for (const variant of state.productVariants) {
    const key = String(variant.product_id);
    if (!variantsByProduct.has(key)) variantsByProduct.set(key, []);
    variantsByProduct.get(key).push(variant);
  }
  const entries = [];
  const importRows = [];
  const seenSourceVariantIds = new Set();
  const shipping = money(config.shipping.cost, "shipping cost");
  for (const row of rows) {
    const variantId = String(row.external_variant_id).trim();
    seenSourceVariantIds.add(variantId);
    const base = entryBase(row);
    const exactMappings = allMappingsByVariant.get(variantId) || [];
    const urlMappings = mappingsByUrl.get(row.external_url) || [];
    if (exactMappings.length === 0) {
      if (urlMappings.some((mapping) => optional(mapping.external_variant_id) !== variantId)) {
        entries.push({ ...base, classification: "IDENTITY_CONFLICT", block_reason: "variant URL belongs to a different mapping identity" });
      } else if (retailerExternalProductIds.has(String(row.external_product_id))) {
        entries.push({ ...base, classification: "NEW_VARIANT_REVIEW", block_reason: "external_product_id exists but external_variant_id is not mapped" });
      } else {
        entries.push({ ...base, classification: "NEW_PRODUCT_REVIEW", block_reason: "external product and variant are not mapped" });
      }
      continue;
    }
    if (exactMappings.length !== 1 || Number(exactMappings[0].retailer_id) !== RETAILER_ID) {
      entries.push({ ...base, classification: "IDENTITY_CONFLICT", block_reason: "external_variant_id is not unique to Discount Supplements" });
      continue;
    }
    const mapping = exactMappings[0];
    const product = productsById.get(String(mapping.product_id));
    const variant = variantsById.get(String(mapping.product_variant_id));
    const mappingOffers = offersByMapping.get(String(mapping.id)) || [];
    const identityErrors = [];
    if (optional(mapping.external_product_id) !== String(row.external_product_id)) identityErrors.push("external_product_id drift");
    if (!mapping.external_name || !mapping.external_slug) identityErrors.push("mapping name or slug is missing");
    if (mapping.match_method !== "slug" || Number(mapping.match_confidence) !== 90) identityErrors.push("mapping match identity cannot be preserved by the feed contract");
    if (!product || product.is_active !== true || product.merged_into_product_id !== null) identityErrors.push("canonical product is missing, inactive, or merged");
    if (!variant || variant.is_active !== true) identityErrors.push("canonical product variant is missing or inactive");
    if (String(mapping.product_id) !== String(product?.id)) identityErrors.push("mapping product_id drift");
    if (mappingOffers.length !== 1) identityErrors.push("mapping must have exactly one offer");
    const offer = mappingOffers[0];
    if (offer && (
      String(offer.product_id) !== String(mapping.product_id) ||
      String(offer.product_variant_id) !== String(mapping.product_variant_id) ||
      String(offer.retailer_product_id) !== String(mapping.id) ||
      Number(offer.retailer_id) !== RETAILER_ID
    )) identityErrors.push("offer identity differs from mapping identity");
    if (variant) identityErrors.push(...variantIdentityErrors(row, mapping, variant, variantsByProduct.get(String(mapping.product_id)) || []));
    if (urlMappings.some((candidate) => String(candidate.id) !== String(mapping.id))) identityErrors.push("variant URL collides with another mapping");
    if (identityErrors.length) {
      entries.push({
        ...base,
        retailer_product_id: mapping.id,
        offer_id: offer?.id ?? null,
        product_id: mapping.product_id,
        product_variant_id: mapping.product_variant_id,
        classification: "IDENTITY_CONFLICT",
        block_reason: identityErrors.join("; "),
      });
      continue;
    }
    const options = parseObject(row.external_options, "external_options");
    const changes = [];
    if (optional(mapping.external_sku) !== optional(row.external_sku)) changes.push("external_sku");
    if (!equal(mapping.external_options, options)) changes.push("external_options");
    if (optional(mapping.external_gtin) !== optional(row.external_gtin)) changes.push("external_gtin");
    if (mapping.external_url !== row.external_url || offer.url !== row.external_url) changes.push("external_url");
    if (money(offer.price, "offer price") !== positiveMoney(row.price, "source price")) changes.push("price");
    if (offer.shipping_cost === null || money(offer.shipping_cost, "offer shipping_cost") !== shipping) changes.push("shipping_cost");
    const delivered = positiveMoney(row.price, "source price") + shipping;
    if (offer.total_price === null || money(offer.total_price, "offer total_price") !== delivered) changes.push("total_price");
    const sourceStock = exactBoolean(row.in_stock, "in_stock");
    if (offer.in_stock !== sourceStock) changes.push("in_stock");
    if (changes.some((field) => !ALLOWED_CHANGE_FIELDS.has(field))) fail(`Internal classification produced a forbidden change field: ${changes.join(", ")}`);
    const classification = !sourceStock
      ? "OUT_OF_STOCK"
      : changes.length
        ? "SAFE_UPDATE"
        : "NO_CHANGE";
    const importReady = importRow(row, mapping, offer, product, variant, config);
    entries.push({
      ...base,
      retailer_product_id: mapping.id,
      offer_id: offer.id,
      product_id: mapping.product_id,
      product_variant_id: mapping.product_variant_id,
      product_name: mapping.external_name,
      variant_name: variant.display_name,
      classification,
      changes,
    });
    importRows.push(importReady);
  }
  const sourceVariantClassificationTotal = entries.length;
  if (sourceVariantClassificationTotal !== rows.length) {
    fail("Every source variant must have exactly one classification");
  }
  for (const mapping of retailerMappings) {
    const variantId = optional(mapping.external_variant_id);
    if (variantId && !seenSourceVariantIds.has(variantId)) {
      const mappingOffers = offersByMapping.get(String(mapping.id)) || [];
      entries.push({
        ...entryBase(null),
        classification: "MISSING_FROM_SOURCE",
        block_reason: "existing external_variant_id is absent from the complete source snapshot",
        retailer_product_id: mapping.id,
        offer_id: mappingOffers.length === 1 ? mappingOffers[0].id : null,
        product_id: mapping.product_id,
        product_variant_id: mapping.product_variant_id,
        external_product_id: optional(mapping.external_product_id),
        external_variant_id: variantId,
        product_name: mapping.external_name,
        external_url: mapping.external_url,
      });
    }
  }
  entries.sort((left, right) =>
    String(left.external_variant_id || "").localeCompare(String(right.external_variant_id || ""), "en", { numeric: true }) ||
    String(left.retailer_product_id || "").localeCompare(String(right.retailer_product_id || ""), "en", { numeric: true })
  );
  const counts = countClassifications(entries);
  const missingFromSourceCount = counts.MISSING_FROM_SOURCE;
  return {
    entries,
    importRows,
    counts,
    sourceVariantClassificationTotal,
    snapshotVariantCount: rows.length,
    missingFromSourceCount,
    totalReportRows: entries.length,
    existingMappingsChecked: retailerMappings.filter((mapping) => optional(mapping.external_variant_id)).length,
  };
}

function assertReadOnlyImporterArgs(args) {
  const normalized = args.map((arg) => String(arg).toLowerCase());
  const forbidden = ["--approve-plan", "--pilot-apply", "--approval-id", "db push", "migration"];
  if (forbidden.some((token) => normalized.some((arg) => arg.includes(token)))) fail(`Forbidden Stage 1 importer argument: ${args.join(" ")}`);
  if (
    args.length !== 5 || args[1] !== "--mode=feed" || args[2] !== "--dry-run" ||
    !args[3].startsWith("--csv=") || !args[4].startsWith("--artifact=")
  ) fail("Stage 1 importer command must be the fixed feed dry-run command");
}

function outputCount(output, label) {
  const match = String(output || "").match(new RegExp(`^\\s*${label}:\\s*(\\d+)\\s*$`, "mi"));
  if (!match) fail(`Importer output is missing counter: ${label}`);
  return Number(match[1]);
}

function runImporterDryRun(csvPath, options = {}) {
  const runId = options.runId || crypto.randomUUID();
  const artifactPath = options.artifactPath || path.join(OUTPUT_DIR, `discount-supplements-stage1-plan-${runId}.json`);
  const machineReportPath = options.machineReportPath || path.join(OUTPUT_DIR, `discount-supplements-stage1-import-report-${runId}.json`);
  const args = [path.join(ROOT, "scripts/import-products.js"), "--mode=feed", "--dry-run", `--csv=${csvPath}`, `--artifact=${artifactPath}`];
  assertReadOnlyImporterArgs(args);
  const spawn = options.spawn || spawnSync;
  const result = spawn(process.execPath, args, {
    cwd: ROOT,
    encoding: "utf8",
    timeout: options.timeoutMs || IMPORT_TIMEOUT_MS,
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      SUPPLEMENTSCOUT_IMPORT_REPORT_PATH: machineReportPath,
      SUPPLEMENTSCOUT_IMPORT_RUN_ID: runId,
    },
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if (result.error) throw result.error;
  if (result.status !== 0) fail(`Importer dry-run failed (${result.status}):\n${output}`);
  if (!output.includes("Dry run: no database writes performed.")) fail("Importer did not confirm zero database writes");
  const artifact = readJson(artifactPath, "Importer dry-run artifact");
  const machineReport = readJson(machineReportPath, "Importer machine report");
  const sidecarPath = `${artifactPath}.sha256`;
  if (!fs.existsSync(sidecarPath)) fail("Importer artifact SHA-256 sidecar is missing");
  const artifactSha256 = fileSha256(artifactPath);
  if (fs.readFileSync(sidecarPath, "utf8").trim() !== artifactSha256) fail("Importer artifact SHA-256 mismatch");
  if (machineReport.runId !== runId) fail("Importer machine report run ID mismatch");
  const deduplicated = outputCount(output, "deduplicated identical rows");
  return {
    runId,
    args,
    output,
    artifact,
    artifactPath,
    artifactSha256,
    sidecarPath,
    machineReport,
    machineReportPath,
    deduplicated,
  };
}

function validateDryRun(dryRun, expectedRows) {
  const plans = dryRun.artifact.plans || [];
  const blockedRows = dryRun.artifact.blocked_rows || [];
  if (plans.length !== expectedRows || blockedRows.length !== 0 || dryRun.deduplicated !== 0) {
    fail(`Stage 1 dry-run must produce ${expectedRows} plans, zero blocked rows and zero deduplicated rows`);
  }
  const actionCounts = {
    mapping_update: 0, mapping_noop: 0,
    offer_update: 0, offer_noop: 0,
    price_history_create: 0, price_history_noop: 0,
  };
  for (const entry of plans) {
    const plan = entry.resolved_plan;
    if (
      entry.operation_type !== "standard_import" || plan.meta.operation_type !== "standard_import" ||
      plan.product.action !== "existing" || plan.product_variant.action !== "existing" ||
      plan.retailer.action !== "existing" || !["update", "noop"].includes(plan.retailer_product.action) ||
      !["update", "noop"].includes(plan.offer.action) || !["create", "noop"].includes(plan.price_history.action)
    ) fail("Importer dry-run attempted an action outside existing-mapping Stage 1 scope");
    actionCounts[`mapping_${plan.retailer_product.action}`] += 1;
    actionCounts[`offer_${plan.offer.action}`] += 1;
    actionCounts[`price_history_${plan.price_history.action}`] += 1;
  }
  return actionCounts;
}

function classificationCsv(entries) {
  return serializeCsv(CLASSIFICATION_HEADER, entries.map((entry) => ({
    ...entry,
    changes: entry.changes.join("|"),
  })));
}

function changeCounts(entries) {
  const result = {
    price_changes: 0,
    stock_changes: 0,
    shipping_changes: 0,
    url_changes: 0,
    total_only_changes: 0,
    stock_only_changes: 0,
    url_only_changes: 0,
    mapping_metadata_changes: 0,
  };
  for (const entry of entries) {
    if (entry.changes.includes("price")) result.price_changes += 1;
    if (entry.changes.includes("in_stock")) result.stock_changes += 1;
    if (entry.changes.includes("shipping_cost")) result.shipping_changes += 1;
    if (entry.changes.includes("external_url")) result.url_changes += 1;
    if (entry.changes.length === 1 && entry.changes[0] === "total_price") result.total_only_changes += 1;
    if (entry.changes.length === 1 && entry.changes[0] === "in_stock") result.stock_only_changes += 1;
    if (entry.changes.length === 1 && entry.changes[0] === "external_url") result.url_only_changes += 1;
    if (entry.changes.some((field) => ["external_sku", "external_options", "external_gtin", "source_updated_at"].includes(field))) {
      result.mapping_metadata_changes += 1;
    }
  }
  return result;
}

function summaryCount(value, label) {
  if (!Number.isInteger(value) || value < 0) fail(`Stage 1 summary metric is unavailable: ${label}`);
  return value;
}

function renderSummary(report) {
  const c = report.classification_counts;
  const d = report.dry_run;
  const a = d?.actions;
  const changes = report.change_counts;
  if (!c || !d || !a || !changes) fail("Stage 1 summary metrics are unavailable");
  const sourceClassificationTotal = CLASSIFICATIONS
    .filter((name) => name !== "MISSING_FROM_SOURCE")
    .reduce((sum, name) => sum + summaryCount(c[name], name), 0);
  if (
    sourceClassificationTotal !== report.source_variant_classification_total ||
    report.source_variant_classification_total !== report.snapshot_variant_count ||
    summaryCount(c.MISSING_FROM_SOURCE, "MISSING_FROM_SOURCE") !== report.missing_from_source_count ||
    report.total_report_rows !== report.source_variant_classification_total + report.missing_from_source_count
  ) fail("Stage 1 classification totals are inconsistent");
  return [
    "## Discount Supplements — Stage 1 read-only",
    "",
    "| Metric | Value |",
    "|---|---:|",
    `| Snapshot products | ${summaryCount(report.snapshot?.products, "snapshot products")} |`,
    `| Snapshot variants | ${summaryCount(report.snapshot?.variants, "snapshot variants")} |`,
    `| In stock | ${summaryCount(report.snapshot?.in_stock, "in stock")} |`,
    `| Out of stock | ${summaryCount(report.snapshot?.out_of_stock, "out of stock")} |`,
    `| Existing mappings checked | ${summaryCount(report.existing_mappings_checked, "existing mappings checked")} |`,
    `| Source variant classification total | ${summaryCount(report.source_variant_classification_total, "source variant classification total")} |`,
    `| Snapshot variant count | ${summaryCount(report.snapshot_variant_count, "snapshot variant count")} |`,
    ...CLASSIFICATIONS.filter((name) => name !== "MISSING_FROM_SOURCE").map((name) => `| ${name} | ${summaryCount(c[name], name)} |`),
    `| Missing from source (database-only) | ${summaryCount(report.missing_from_source_count, "missing from source count")} |`,
    `| Total report rows | ${summaryCount(report.total_report_rows, "total report rows")} |`,
    `| Price changes | ${summaryCount(changes.price_changes, "price changes")} |`,
    `| Shipping changes | ${summaryCount(changes.shipping_changes, "shipping changes")} |`,
    `| Total-only changes | ${summaryCount(changes.total_only_changes, "total-only changes")} |`,
    `| Stock-only changes | ${summaryCount(changes.stock_only_changes, "stock-only changes")} |`,
    `| URL-only changes | ${summaryCount(changes.url_only_changes, "URL-only changes")} |`,
    `| Mapping metadata changes | ${summaryCount(changes.mapping_metadata_changes, "mapping metadata changes")} |`,
    `| Dry-run plans | ${summaryCount(d.plans, "dry-run plans")} |`,
    `| Retailer product update | ${summaryCount(a.mapping_update, "retailer product update")} |`,
    `| Retailer product noop | ${summaryCount(a.mapping_noop, "retailer product noop")} |`,
    `| Offer update | ${summaryCount(a.offer_update, "offer update")} |`,
    `| Offer noop | ${summaryCount(a.offer_noop, "offer noop")} |`,
    `| Price history create | ${summaryCount(a.price_history_create, "price history create")} |`,
    `| Price history noop | ${summaryCount(a.price_history_noop, "price history noop")} |`,
    `| Blocked rows | ${summaryCount(d.blocked_rows, "blocked rows")} |`,
    `| Deduplicated rows | ${summaryCount(d.deduplicated_rows, "deduplicated rows")} |`,
    `| Database writes | ${summaryCount(report.database_writes, "database writes")} |`,
    "",
    "> Stage 1 generated review artifacts only. Approval and production apply were not invoked.",
    "",
  ].join("\n");
}

function assertReadOnlyEnvironment(env = process.env) {
  if (String(env.SUPPLEMENTSCOUT_STAGE1_READ_ONLY || "").toLowerCase() !== "true") {
    fail("SUPPLEMENTSCOUT_STAGE1_READ_ONLY=true is required");
  }
  if (!String(env.NEXT_PUBLIC_SUPABASE_URL || "").trim()) fail("NEXT_PUBLIC_SUPABASE_URL is required");
  if (!String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim()) fail("SUPABASE_SERVICE_ROLE_KEY is required");
}

async function main(options = {}) {
  const argv = options.argv || process.argv.slice(2);
  const reportPath = options.runReportPath || RUN_REPORT_PATH;
  if (argv.length === 1 && argv[0] === "--summary") {
    const report = readJson(reportPath, "Discount Supplements Stage 1 report");
    const summary = renderSummary(report);
    (options.log || console.log)(summary);
    return { report, summary };
  }
  if (argv.length !== 0) fail("Discount Supplements Stage 1 does not accept operational CLI arguments");
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const env = options.env || process.env;
  assertReadOnlyEnvironment(env);
  const startedAt = new Date().toISOString();
  const config = options.config || readJson(CONFIG_PATH, "Discount Supplements config");
  validateSourceConfig(config);
  if (config.shipping?.known !== true || money(config.shipping.cost, "shipping cost") < 0n) fail("Discount Supplements shipping config is invalid");
  const snapshot = validateSnapshotArtifacts(options.snapshotOptions);
  const client = options.client || createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const state = options.state || await fetchProductionState(client);
  const classified = classifyCatalog({ rows: snapshot.rows, state, config });
  const classificationDocument = {
    schema_version: 1,
    retailer_id: RETAILER_ID,
    generated_at: new Date().toISOString(),
    counts: classified.counts,
    source_variant_classification_total: classified.sourceVariantClassificationTotal,
    snapshot_variant_count: classified.snapshotVariantCount,
    missing_from_source_count: classified.missingFromSourceCount,
    total_report_rows: classified.totalReportRows,
    entries: classified.entries,
  };
  const classificationJson = `${JSON.stringify(classificationDocument, null, 2)}\n`;
  const classificationCsvBytes = classificationCsv(classified.entries);
  const importCsv = serializeCsv(IMPORT_HEADER, classified.importRows);
  const classificationJsonPath = options.classificationJsonPath || CLASSIFICATION_JSON_PATH;
  const classificationCsvPath = options.classificationCsvPath || CLASSIFICATION_CSV_PATH;
  const importCsvPath = options.importCsvPath || IMPORT_CSV_PATH;
  atomicWrite(classificationJsonPath, classificationJson);
  atomicWrite(classificationCsvPath, classificationCsvBytes);
  atomicWrite(importCsvPath, importCsv);
  const dryRun = (options.runImporter || runImporterDryRun)(importCsvPath, options.importerOptions);
  const actions = validateDryRun(dryRun, classified.importRows.length);
  const report = {
    schema_version: 1,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    retailer_id: RETAILER_ID,
    retailer: config.retailer.name,
    read_only: true,
    database_writes: 0,
    snapshot: {
      products: snapshot.report.shopify_product_count,
      variants: snapshot.report.shopify_variant_count,
      in_stock: snapshot.report.in_stock_count,
      out_of_stock: snapshot.report.out_of_stock_count,
      page_count: snapshot.report.page_count,
      page_product_counts: snapshot.report.page_product_counts,
      baseline_products: BASELINE_PRODUCTS,
      baseline_variants: BASELINE_VARIANTS,
      maximum_drop_ratio: MAX_COUNT_DROP_RATIO,
    },
    existing_mappings_checked: classified.existingMappingsChecked,
    classification_counts: classified.counts,
    source_variant_classification_total: classified.sourceVariantClassificationTotal,
    snapshot_variant_count: classified.snapshotVariantCount,
    missing_from_source_count: classified.missingFromSourceCount,
    total_report_rows: classified.totalReportRows,
    change_counts: changeCounts(classified.entries),
    dry_run: {
      run_id: dryRun.runId,
      plans: dryRun.artifact.plans.length,
      blocked_rows: dryRun.artifact.blocked_rows.length,
      deduplicated_rows: dryRun.deduplicated,
      actions,
      artifact_path: path.relative(ROOT, dryRun.artifactPath).replace(/\\/g, "/"),
      artifact_sha256: dryRun.artifactSha256,
      artifact_sidecar_path: path.relative(ROOT, dryRun.sidecarPath).replace(/\\/g, "/"),
      machine_report_path: path.relative(ROOT, dryRun.machineReportPath).replace(/\\/g, "/"),
    },
    outputs: {
      raw_snapshot_path: path.relative(ROOT, snapshot.rawPath).replace(/\\/g, "/"),
      normalized_snapshot_path: path.relative(ROOT, snapshot.normalizedPath).replace(/\\/g, "/"),
      full_snapshot_report_path: path.relative(ROOT, snapshot.fullReportPath).replace(/\\/g, "/"),
      classification_json_path: path.relative(ROOT, classificationJsonPath).replace(/\\/g, "/"),
      classification_csv_path: path.relative(ROOT, classificationCsvPath).replace(/\\/g, "/"),
      import_csv_path: path.relative(ROOT, importCsvPath).replace(/\\/g, "/"),
      hashes: {
        classification_json_sha256: sha256(classificationJson),
        classification_csv_sha256: sha256(classificationCsvBytes),
        import_csv_sha256: sha256(importCsv),
      },
    },
    automatic_approval: false,
    automatic_apply: false,
  };
  atomicWrite(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  (options.log || console.log)(JSON.stringify(report, null, 2));
  return { report, classified, dryRun };
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Discount Supplements Stage 1 failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  ALLOWED_CHANGE_FIELDS,
  BASELINE_PRODUCTS,
  BASELINE_VARIANTS,
  CLASSIFICATIONS,
  IMPORT_HEADER,
  RUN_REPORT_PATH,
  assertReadOnlyEnvironment,
  assertReadOnlyImporterArgs,
  classifyCatalog,
  fetchProductionState,
  main,
  renderSummary,
  runImporterDryRun,
  serializeCsv,
  validateDryRun,
  validateSnapshotArtifacts,
};
