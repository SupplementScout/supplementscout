const crypto = require("node:crypto");
const { parse } = require("csv-parse/sync");

const REQUIRED_HEADERS = Object.freeze([
  "ID",
  "Type",
  "SKU",
  "Name",
  "Published",
  "In stock?",
  "Sale price",
  "Regular price",
  "Categories",
  "Images",
  "Parent",
]);

const PRODUCT_TYPES = new Set(["simple", "variable", "variation"]);

function fail(message) {
  throw new Error(message);
}

function text(value) {
  return String(value ?? "").trim();
}

function normalized(value) {
  return text(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function positiveId(value, label) {
  const result = text(value);
  if (!/^[1-9]\d*$/.test(result)) fail(`Invalid ${label}: ${JSON.stringify(value)}`);
  return result;
}

function optional(value) {
  const result = text(value);
  return result || null;
}

function booleanFlag(value, label) {
  const result = text(value);
  if (result === "1") return true;
  if (result === "0") return false;
  fail(`Invalid ${label}: ${JSON.stringify(value)}`);
}

function money(value, label) {
  const result = text(value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(result) || Number(result) <= 0) {
    fail(`Invalid ${label}: ${JSON.stringify(value)}`);
  }
  return Number(result).toFixed(2);
}

function splitList(value) {
  return text(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function categorySegments(value) {
  return splitList(value)
    .flatMap((category) => category.split(">").map((part) => part.trim()))
    .filter(Boolean);
}

function attributeEntries(row) {
  const result = {};
  for (let index = 1; index <= 3; index += 1) {
    const name = text(row[`Attribute ${index} name`]);
    const value = text(row[`Attribute ${index} value(s)`]);
    if (!name || !value) continue;
    result[name] = value;
  }
  return result;
}

function attributeValue(row, names) {
  const wanted = new Set(names.map(normalized));
  return Object.entries(attributeEntries(row)).find(([name]) => wanted.has(normalized(name)))?.[1] || null;
}

function resolveBrand(row, parent) {
  return (
    optional(row.Brands) ||
    optional(parent?.Brands) ||
    attributeValue(row, ["Brands", "Brand"]) ||
    attributeValue(parent || {}, ["Brands", "Brand"])
  );
}

function resolveParentReference(value, parentsById, parentsBySku) {
  const reference = text(value);
  if (!reference) return null;
  const idMatch = reference.match(/^id:(\d+)$/i);
  if (idMatch) return parentsById.get(idMatch[1]) || null;
  return parentsBySku.get(reference) || null;
}

function parseMonthYear(day, month, year) {
  const fullYear = Number(year) < 100 ? 2000 + Number(year) : Number(year);
  const numericMonth = Number(month);
  const numericDay = day == null ? null : Number(day);
  if (fullYear < 2000 || fullYear > 2200 || numericMonth < 1 || numericMonth > 12) return null;
  if (numericDay != null && (numericDay < 1 || numericDay > 31)) return null;
  const expiresAt = numericDay == null
    ? new Date(Date.UTC(fullYear, numericMonth, 0, 23, 59, 59, 999))
    : new Date(Date.UTC(fullYear, numericMonth - 1, numericDay, 23, 59, 59, 999));
  if (Number.isNaN(expiresAt.getTime())) return null;
  return expiresAt;
}

function expiryEvidence(row, parent, capturedAt) {
  const evidence = [
    row.Name,
    row["Short description"],
    row.Description,
    row.Tags,
    parent?.Name,
    parent?.["Short description"],
    parent?.Description,
    parent?.Tags,
  ].filter(Boolean).join(" ");
  const lower = evidence.toLowerCase();
  if (/\bexpired\b/.test(lower)) return { expired: true, marker: "expired", expires_at: null };
  const marker = "(?:bbe|best\\s+before|expiry|expires|use\\s+by)";
  const fullDate = lower.match(new RegExp(`\\b${marker}\\s*[:\\-]?\\s*(\\d{1,2})[\\/.\\-](\\d{1,2})[\\/.\\-](\\d{2,4})\\b`, "i"));
  const monthYear = fullDate ? null : lower.match(new RegExp(`\\b${marker}\\s*[:\\-]?\\s*(\\d{1,2})[\\/.\\-](\\d{2,4})\\b`, "i"));
  const expiresAt = fullDate
    ? parseMonthYear(fullDate[1], fullDate[2], fullDate[3])
    : monthYear
      ? parseMonthYear(null, monthYear[1], monthYear[2])
      : null;
  if (!expiresAt) return null;
  return {
    expired: expiresAt.getTime() < new Date(capturedAt).getTime(),
    marker: fullDate?.[0] || monthYear?.[0] || null,
    expires_at: expiresAt.toISOString(),
  };
}

function policyDecision({ row, parent, categories, capturedAt }) {
  const normalizedCategories = new Set(categories.map(normalized));
  if (normalizedCategories.has("sarms") || normalizedCategories.has("sarm")) {
    return { state: "EXCLUDED", code: "EXCLUDE_SARM" };
  }
  if (normalizedCategories.has("peptides") || normalizedCategories.has("peptide")) {
    return { state: "EXCLUDED", code: "EXCLUDE_PEPTIDE" };
  }
  const expiry = expiryEvidence(row, parent, capturedAt);
  if (expiry?.expired) return { state: "EXCLUDED", code: "EXCLUDE_EXPIRED", evidence: expiry };
  if (expiry && !expiry.expired) return { state: "ELIGIBLE", code: "ELIGIBLE", evidence: expiry };
  if (normalizedCategories.has("accessories") || normalizedCategories.has("accessory")) {
    return { state: "DEFERRED", code: "DEFER_ACCESSORY" };
  }
  return { state: "ELIGIBLE", code: "ELIGIBLE" };
}

function parseWooCommerceCsv(bytes, options = {}) {
  const capturedAt = options.capturedAt || new Date().toISOString();
  if (!Number.isFinite(Date.parse(capturedAt))) fail("capturedAt must be an ISO timestamp");
  const csv = Buffer.isBuffer(bytes) ? bytes.toString("utf8") : String(bytes);
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    // Native WooCommerce exports omit trailing empty cells on many rows.
    // Required named fields are still validated below.
    relax_column_count: true,
  });
  if (!rows.length) fail("WooCommerce CSV is empty");
  const headers = Object.keys(rows[0]);
  for (const header of REQUIRED_HEADERS) if (!headers.includes(header)) fail(`Missing WooCommerce header ${header}`);

  const ids = new Set();
  const parents = [];
  const variations = [];
  for (const row of rows) {
    const id = positiveId(row.ID, "WooCommerce row ID");
    if (ids.has(id)) fail(`Duplicate WooCommerce row ID ${id}`);
    ids.add(id);
    const type = text(row.Type).toLowerCase();
    if (!PRODUCT_TYPES.has(type)) fail(`Unsupported WooCommerce product type ${JSON.stringify(row.Type)}`);
    if (type === "variation") variations.push(row);
    else parents.push(row);
  }

  const parentsById = new Map();
  const parentsBySku = new Map();
  for (const parent of parents) {
    const id = positiveId(parent.ID, "WooCommerce parent ID");
    parentsById.set(id, parent);
    const sku = optional(parent.SKU);
    if (!sku) continue;
    if (parentsBySku.has(sku)) fail(`Duplicate WooCommerce parent SKU ${sku}`);
    parentsBySku.set(sku, parent);
  }

  const records = [];
  const issues = [];
  const addIssue = (row, code, detail = {}) => issues.push({
    source_record_id: positiveId(row.ID, "WooCommerce issue row ID"),
    code,
    ...detail,
  });

  function buildRecord(row, parent) {
    const type = text(row.Type).toLowerCase();
    const sourceRecordId = positiveId(row.ID, "WooCommerce source record ID");
    const externalProductId = positiveId(parent.ID, "WooCommerce external product ID");
    const externalVariantId = type === "variation" ? sourceRecordId : externalProductId;
    const productName = text(parent.Name);
    const variantName = type === "variation" ? text(row.Name) : productName;
    if (!productName || !variantName) {
      addIssue(row, "BLOCK_MISSING_NAME");
      return;
    }
    if (!booleanFlag(row.Published, `Published for ${sourceRecordId}`)) {
      addIssue(row, "EXCLUDE_UNPUBLISHED");
      return;
    }
    const priceText = optional(row["Sale price"]) || optional(row["Regular price"]);
    if (!priceText) {
      addIssue(row, "BLOCK_MISSING_PRICE");
      return;
    }
    let price;
    try {
      price = money(priceText, `price for ${sourceRecordId}`);
    } catch (error) {
      addIssue(row, "BLOCK_INVALID_PRICE", { detail: error.message });
      return;
    }
    const categories = categorySegments(parent.Categories);
    const policy = policyDecision({ row, parent, categories, capturedAt });
    const optionsMap = attributeEntries(row);
    const sourceUrl = new URL("/", options.storeUrl);
    sourceUrl.searchParams.set("p", externalProductId);
    const images = splitList(parent.Images);
    records.push({
      source_record_id: sourceRecordId,
      immutable_source_identity: `${externalProductId}:${externalVariantId}`,
      source_type: type,
      external_product_id: externalProductId,
      external_variant_id: externalVariantId,
      external_sku: optional(row.SKU),
      external_gtin: optional(row["GTIN, UPC, EAN, or ISBN"]) || optional(row.EAN) || optional(row["Meta: _wpm_gtin_code"]),
      product_name: productName,
      variant_name: variantName,
      brand: resolveBrand(row, parent),
      categories,
      description: optional(parent.Description) || optional(parent["Short description"]),
      image_url: images[0] || null,
      external_options: optionsMap,
      product_url: sourceUrl.href,
      variant_url: sourceUrl.href,
      regular_price: optional(row["Regular price"]),
      sale_price: optional(row["Sale price"]),
      price,
      in_stock: booleanFlag(row["In stock?"], `stock for ${sourceRecordId}`),
      published: true,
      policy_state: policy.state,
      policy_code: policy.code,
      policy_evidence: policy.evidence || null,
      source_fingerprint: null,
    });
    const record = records.at(-1);
    record.source_fingerprint = sha256(JSON.stringify(record));
  }

  for (const row of parents) {
    if (text(row.Type).toLowerCase() === "simple") buildRecord(row, row);
  }
  for (const row of variations) {
    const parent = resolveParentReference(row.Parent, parentsById, parentsBySku);
    if (!parent) {
      addIssue(row, "BLOCK_ORPHAN_VARIATION", { parent_reference: optional(row.Parent) });
      continue;
    }
    buildRecord(row, parent);
  }

  const counts = {
    csv_rows: rows.length,
    simple_products: parents.filter((row) => text(row.Type).toLowerCase() === "simple").length,
    variable_products: parents.filter((row) => text(row.Type).toLowerCase() === "variable").length,
    variation_rows: variations.length,
    normalized_records: records.length,
    eligible_records: records.filter((record) => record.policy_state === "ELIGIBLE").length,
    excluded_records: records.filter((record) => record.policy_state === "EXCLUDED").length,
    deferred_records: records.filter((record) => record.policy_state === "DEFERRED").length,
    issue_records: issues.length,
    in_stock_records: records.filter((record) => record.in_stock).length,
    out_of_stock_records: records.filter((record) => !record.in_stock).length,
  };
  const result = {
    schema_version: 1,
    source_type: "WOOCOMMERCE_NATIVE_CSV",
    source_sha256: sha256(Buffer.isBuffer(bytes) ? bytes : Buffer.from(csv)),
    captured_at: capturedAt,
    counts,
    records,
    issues,
    snapshot_fingerprint: null,
  };
  result.snapshot_fingerprint = sha256(JSON.stringify(result));
  return result;
}

module.exports = {
  REQUIRED_HEADERS,
  attributeEntries,
  categorySegments,
  expiryEvidence,
  parseWooCommerceCsv,
  policyDecision,
  resolveParentReference,
  sha256,
};
