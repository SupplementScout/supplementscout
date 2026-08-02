const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("csv-parse/sync");

const ARTIFACT_KIND = "nutrition-candidate-artifact-v2";
const INPUT_KIND = "nutrition-candidate-source-snapshot-v1";
const INPUT_KIND_V2 = "nutrition-candidate-source-snapshot-v2";
const STATUS = "CANDIDATE_REQUIRES_REVIEW";
const MODE = "OFFLINE_READ_ONLY";
const MAX_RECORDS = 100;
const MAX_SNAPSHOT_BYTES = 2_000_000;
const MAX_EVIDENCE_LENGTH = 300;
const FIELDS = Object.freeze([
  "protein_per_serving_g",
  "creatine_per_serving_g",
  "serving_size_g",
  "serving_count_verified",
  "net_weight_g",
  "net_volume_ml",
  "serving_size_ml",
]);
const FIELD_SET = new Set(FIELDS);
const CONTENT_TYPES = new Set(["text/html", "application/json"]);
const SOURCE_TYPES = new Set([
  "retailer_product_page",
  "retailer_feed",
  "manufacturer_product_page",
]);
const IDENTITY_BINDINGS = new Set([
  "EXACT_VARIANT",
  "EXACT_PRODUCT",
  "LEGACY_PRODUCT_URL",
  "UNMAPPED_SOURCE",
]);
const MANIFEST_KEYS = Object.freeze([
  "schema_version",
  "kind",
  "mode",
  "captured_at",
  "records",
]);
const RECORD_KEYS_V1 = Object.freeze([
  "source_record_id",
  "product_id",
  "product_variant_id",
  "retailer_id",
  "retailer_product_id",
  "source_url",
  "source_type",
  "identity_binding",
  "snapshot_file",
  "snapshot_sha256",
  "content_type",
  "current_values",
]);
const RECORD_KEYS_V2 = Object.freeze([
  "source_record_id",
  "product_id",
  "product_variant_id",
  "retailer_id",
  "retailer_product_id",
  "product_name",
  "brand",
  "manufacturer",
  "source_url",
  "source_type",
  "identity_binding",
  "snapshot_file",
  "source_snapshot_ref",
  "snapshot_sha256",
  "content_type",
  "current_values",
]);
const CSV_COLUMNS = Object.freeze([
  "candidate_id",
  "run_id",
  "source_record_id",
  "product_name",
  "brand",
  "manufacturer",
  "product_id",
  "product_variant_id",
  "retailer_id",
  "retailer_product_id",
  "field_name",
  "value_numeric",
  "unit",
  "basis",
  "source_url",
  "source_file",
  "source_type",
  "parser",
  "evidence_text",
  "evidence_locator",
  "captured_at",
  "source_sha256",
  "identity_confidence",
  "extraction_confidence",
  "overall_confidence",
  "flags",
  "current_value",
  "candidate_status",
  "review_status",
  "candidate_fingerprint",
]);

class NutritionCandidateError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = "NutritionCandidateError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, message, detail) {
  throw new NutritionCandidateError(code, message, detail);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(prefix, value) {
  return sha256(`SupplementScout-Nutrition-Candidate:1\n${prefix}\n${canonical(value)}`);
}

function exactKeys(value, expected) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function positiveId(value) {
  return typeof value === "string" && /^[1-9][0-9]*$/.test(value);
}

function optionalPositiveId(value) {
  return value === null || positiveId(value);
}

function boundedText(value, maximum) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validateSourceUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("NCE_SOURCE_SCHEMA_MISMATCH", "source_url must be a valid URL");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    fail("NCE_SOURCE_SCHEMA_MISMATCH", "source_url must be credential-free HTTPS");
  }
  if (url.hash) {
    fail("NCE_SOURCE_SCHEMA_MISMATCH", "source_url fragments are forbidden");
  }
  for (const key of url.searchParams.keys()) {
    if (/token|secret|signature|password|auth|api[_-]?key|credential|x-amz|x-goog|^(?:key|sig|code)$/i.test(key)) {
      fail("NCE_SOURCE_SCHEMA_MISMATCH", `source_url contains forbidden sensitive parameter ${key}`);
    }
  }
  return url.href;
}

function validateCurrentValues(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("NCE_SOURCE_SCHEMA_MISMATCH", `${label} current_values must be an object`);
  }
  for (const [key, current] of Object.entries(value)) {
    if (!FIELD_SET.has(key)) {
      fail("NCE_SOURCE_SCHEMA_MISMATCH", `${label} current_values contains unsupported field ${key}`);
    }
    if (current !== null && (typeof current !== "number" || !Number.isFinite(current))) {
      fail("NCE_SOURCE_SCHEMA_MISMATCH", `${label} current value ${key} must be finite or null`);
    }
  }
}

function validateManifest(manifest) {
  const isV1 = manifest?.schema_version === 1 && manifest?.kind === INPUT_KIND;
  const isV2 = manifest?.schema_version === 2 && manifest?.kind === INPUT_KIND_V2;
  if (!exactKeys(manifest, MANIFEST_KEYS) || (!isV1 && !isV2) || manifest.mode !== "OFFLINE" ||
      !validTimestamp(manifest.captured_at) || !Array.isArray(manifest.records) ||
      manifest.records.length < 1 || manifest.records.length > MAX_RECORDS) {
    fail("NCE_SOURCE_SCHEMA_MISMATCH", "Invalid offline source manifest");
  }
  const sourceIds = new Set();
  for (const [index, record] of manifest.records.entries()) {
    const label = `record ${index + 1}`;
    const expectedKeys = isV2 ? RECORD_KEYS_V2 : RECORD_KEYS_V1;
    const manufacturerSource = record.source_type === "manufacturer_product_page";
    if (!exactKeys(record, expectedKeys) || typeof record.source_record_id !== "string" ||
        !record.source_record_id.trim() || record.source_record_id.length > 200 ||
        !optionalPositiveId(record.product_id) || !optionalPositiveId(record.product_variant_id) ||
        !optionalPositiveId(record.retailer_id) || !optionalPositiveId(record.retailer_product_id) ||
        !SOURCE_TYPES.has(record.source_type) || !IDENTITY_BINDINGS.has(record.identity_binding) ||
        typeof record.snapshot_file !== "string" || !record.snapshot_file.trim() ||
        !/^[0-9a-f]{64}$/.test(record.snapshot_sha256) ||
        !CONTENT_TYPES.has(record.content_type)) {
      fail("NCE_SOURCE_SCHEMA_MISMATCH", `${label} has an invalid schema`);
    }
    if (isV2 && (!boundedText(record.product_name, 300) || !boundedText(record.brand, 200) ||
        !boundedText(record.manufacturer, 200) || !boundedText(record.source_snapshot_ref, 500) ||
        path.isAbsolute(record.source_snapshot_ref) || record.source_snapshot_ref.split(/[\\/]/).includes("..") ||
        !record.source_snapshot_ref.replaceAll("\\", "/").startsWith("tmp/"))) {
      fail("NCE_SOURCE_SCHEMA_MISMATCH", `${label} has invalid manufacturer provenance metadata`);
    }
    if (manufacturerSource && (record.retailer_id !== null || record.retailer_product_id !== null)) {
      fail("NCE_SOURCE_SCHEMA_MISMATCH", `${label} manufacturer sources cannot invent retailer identities`);
    }
    if (!manufacturerSource && (!positiveId(record.product_id) || !positiveId(record.retailer_id) ||
        !positiveId(record.retailer_product_id))) {
      fail("NCE_SOURCE_SCHEMA_MISMATCH", `${label} retailer sources require mapped product and retailer identities`);
    }
    if (record.identity_binding === "EXACT_VARIANT" && (!positiveId(record.product_id) || record.product_variant_id === null)) {
      fail("NCE_SOURCE_SCHEMA_MISMATCH", `${label} exact variant binding requires product_variant_id`);
    }
    if (["EXACT_PRODUCT", "LEGACY_PRODUCT_URL"].includes(record.identity_binding) && !positiveId(record.product_id)) {
      fail("NCE_SOURCE_SCHEMA_MISMATCH", `${label} mapped identity binding requires product_id`);
    }
    if (record.identity_binding === "UNMAPPED_SOURCE" && record.product_id !== null) {
      fail("NCE_SOURCE_SCHEMA_MISMATCH", `${label} unmapped source cannot claim product_id`);
    }
    if (sourceIds.has(record.source_record_id)) {
      fail("NCE_DUPLICATE_IDENTITY", `Duplicate source_record_id ${record.source_record_id}`);
    }
    sourceIds.add(record.source_record_id);
    validateSourceUrl(record.source_url);
    validateCurrentValues(record.current_values, label);
  }
  return manifest;
}

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#039;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function plainText(value) {
  return decodeHtmlEntities(String(value).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function visibleTextLines(html) {
  return decodeHtmlEntities(String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "\n")
    .replace(/<\/(?:p|div|li|section|article|h[1-6]|tr|table|dl|dt|dd)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0 && line.length <= MAX_EVIDENCE_LENGTH);
}

function htmlAttribute(tag, name) {
  const match = String(tag).match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  return match ? decodeHtmlEntities(match[2]).replace(/\s+/g, " ").trim() : null;
}

function manufacturerMetaDescriptions(html) {
  const descriptions = [];
  for (const tag of String(html).match(/<meta\b[^>]*>/gi) || []) {
    const name = htmlAttribute(tag, "name")?.toLowerCase();
    const property = htmlAttribute(tag, "property")?.toLowerCase();
    if (name !== "description" && property !== "og:description") continue;
    const content = htmlAttribute(tag, "content");
    if (content && content.length <= MAX_EVIDENCE_LENGTH) descriptions.push(content);
  }
  return [...new Set(descriptions)];
}

function manufacturerPrimaryProductHtml(html) {
  const source = String(html);
  const primary = source.match(/<(?:main|article|div)\b[^>]*(?:data-elementor-type=["']product["']|class=["'][^"']*\btype-product\b[^"']*["'])[^>]*>/i);
  const body = source.match(/<body\b[^>]*>/i);
  const start = primary?.index ?? (body?.index == null ? 0 : body.index + body[0].length);
  const productHtml = source.slice(start);
  const stopPatterns = [
    /<(?:section|div)\b[^>]*class=["'][^"']*\brelated\s+products\b[^"']*["'][^>]*>/i,
    /<(?:section|div)\b[^>]*class=["'][^"']*\b(?:upsells|up-sells|cross-sells)\b[^"']*["'][^>]*>/i,
    /<div\b[^>]*id=["']reviews["'][^>]*>/i,
    /<div\b[^>]*class=["'][^"']*\bwoocommerce-Reviews\b[^"']*["'][^>]*>/i,
    /<footer\b/i,
  ];
  const stop = stopPatterns
    .map((pattern) => productHtml.search(pattern))
    .filter((index) => index >= 0)
    .reduce((lowest, index) => Math.min(lowest, index), productHtml.length);
  return productHtml.slice(0, stop);
}

function explicitEvidenceLines(html) {
  const lines = manufacturerMetaDescriptions(html).map((text, index) => ({
    text,
    locator: `manufacturer:meta-description:${index + 1}`,
  }));
  const primary = manufacturerPrimaryProductHtml(html);
  visibleTextLines(primary).forEach((text, index) => {
    lines.push({ text, locator: `manufacturer:primary-text:${index + 1}` });
  });
  return lines;
}

function normalizeNumberText(value) {
  const text = String(value).trim().replace(/\s+/g, "");
  if (/^\d{1,3}(?:,\d{3})+$/.test(text)) return text.replace(/,/g, "");
  if (/^\d+,\d+$/.test(text)) return text.replace(",", ".");
  return text;
}

function parseQuantity(raw, dimension) {
  const text = plainText(raw)
    .replace(/[.。]+$/, "")
    .trim();
  const match = text.match(/^(?:(approximately|approx\.?|about|around|circa|~)\s*)?([0-9]+(?:[.,][0-9]+)?|[0-9]{1,3}(?:,[0-9]{3})+)(?:\s*)(kg|g|mg|mcg|µg|l|ml|servings?|serves?)?$/i);
  if (!match) return null;
  const value = Number(normalizeNumberText(match[2]));
  if (!Number.isFinite(value)) return null;
  const rawUnit = (match[3] || "").toLowerCase();
  const flags = match[1] ? ["APPROXIMATE_VALUE"] : [];
  if (dimension === "count") {
    if (rawUnit && !/^(?:servings?|serves?)$/.test(rawUnit)) return null;
    if (!Number.isInteger(value) || value <= 0) return null;
    return { value, unit: "count", flags };
  }
  if (dimension === "weight") {
    if (!rawUnit || !["kg", "g", "mg", "mcg", "µg"].includes(rawUnit) || value <= 0) return null;
    const multiplier = { kg: 1000, g: 1, mg: 0.001, mcg: 0.000001, "µg": 0.000001 }[rawUnit];
    return { value: value * multiplier, unit: "g", flags };
  }
  if (dimension === "volume") {
    if (!rawUnit || !["l", "ml"].includes(rawUnit) || value <= 0) return null;
    return { value: value * (rawUnit === "l" ? 1000 : 1), unit: "ml", flags };
  }
  return null;
}

function normalizeLabel(value) {
  return plainText(value)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[_/]+/g, " ")
    .replace(/[^a-z0-9\s()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldDefinition(label, inheritedBasis = null) {
  const text = normalizeLabel(label);
  if (/\bnet\s+weight\b|\bpack(?:age)?\s+weight\b/.test(text)) {
    return { field_name: "net_weight_g", dimension: "weight", basis: "PACKAGE" };
  }
  if (/\bnet\s+volume\b|\bpack(?:age)?\s+volume\b/.test(text)) {
    return { field_name: "net_volume_ml", dimension: "volume", basis: "PACKAGE" };
  }
  if (/\bservings?\s+per\s+(?:container|pack(?:age)?|tub|bottle)\b|\bnumber\s+of\s+servings?\b|^servings?$/.test(text)) {
    return { field_name: "serving_count_verified", dimension: "count", basis: "PACKAGE" };
  }
  if (/\bserving\s+size\b|\bsize\s+of\s+(?:one|a)\s+serving\b/.test(text)) {
    return { field_name: "serving_size_g", dimension: "weight", basis: "PER_SERVING" };
  }
  const perServing = /\bper\s+(?:one\s+)?serv(?:e|ing)\b/.test(text) || inheritedBasis === "PER_SERVING";
  if (/\bprotein\b/.test(text) && perServing) {
    return { field_name: "protein_per_serving_g", dimension: "weight", basis: "PER_SERVING" };
  }
  if (/\bcreatine\s+monohydrate\b/.test(text) && !/\bof\s+which\s+creatine\b/.test(text)) return null;
  if (/\bcreatine\b/.test(text) && perServing) {
    return { field_name: "creatine_per_serving_g", dimension: "weight", basis: "PER_SERVING" };
  }
  return null;
}

function resolveDefinitionQuantity(definition, rawValue) {
  if (!definition) return null;
  const quantity = parseQuantity(rawValue, definition.dimension);
  if (quantity) return { definition, quantity };
  if (definition.field_name === "serving_size_g") {
    const volume = parseQuantity(rawValue, "volume");
    if (volume) {
      return {
        definition: { ...definition, field_name: "serving_size_ml", dimension: "volume" },
        quantity: volume,
      };
    }
  }
  return null;
}

function strictParentheticalServingSize(rawValue) {
  const text = plainText(rawValue).trim();
  if (/\b(?:approximately|approx\.?|about|around|circa|or)\b|~|[0-9]\s*[-/\u2013\u2014]\s*[0-9]/i.test(text)) {
    return null;
  }
  const parenthetical = [...text.matchAll(/\(([^()]*)\)/g)];
  if (parenthetical.length !== 1) return null;
  const value = parenthetical[0][1].trim();
  if (!/^[0-9]+(?:[.,][0-9]+)?\s*g$/i.test(value)) return null;
  const start = parenthetical[0].index || 0;
  const outside = `${text.slice(0, start)} ${text.slice(start + parenthetical[0][0].length)}`;
  if (/[0-9]+(?:[.,][0-9]+)?\s*(?:kg|g|mg)\b/i.test(outside)) return null;
  const quantity = parseQuantity(value, "weight");
  return quantity && quantity.flags.length === 0 ? quantity : null;
}

function observation(definition, quantity, parser, evidenceText, evidenceLocator, extraFlags = []) {
  if (!definition || !quantity) return null;
  return {
    field_name: definition.field_name,
    value_numeric: quantity.value,
    unit: quantity.unit,
    basis: definition.basis,
    parser,
    evidence_text: String(evidenceText).slice(0, MAX_EVIDENCE_LENGTH),
    evidence_locator: String(evidenceLocator).slice(0, 300),
    flags: [...new Set([...quantity.flags, ...extraFlags])].sort(),
  };
}

function jsonLdBlocks(html) {
  const blocks = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const [index, match] of [...String(html).matchAll(pattern)].entries()) {
    try {
      blocks.push({ index: index + 1, value: JSON.parse(decodeHtmlEntities(match[1]).trim()) });
    } catch {
      // Malformed unrelated JSON-LD is ignored. Other parsers can still supply candidates.
    }
  }
  return blocks;
}

function jsonKeyDefinition(key, parent) {
  const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
  const direct = {
    netweight: { field_name: "net_weight_g", dimension: "weight", basis: "PACKAGE" },
    netweightg: { field_name: "net_weight_g", dimension: "weight", basis: "PACKAGE", implicit_unit: "g" },
    netvolume: { field_name: "net_volume_ml", dimension: "volume", basis: "PACKAGE" },
    netvolumeml: { field_name: "net_volume_ml", dimension: "volume", basis: "PACKAGE", implicit_unit: "ml" },
    servingcount: { field_name: "serving_count_verified", dimension: "count", basis: "PACKAGE", implicit_unit: "count" },
    servingspercontainer: { field_name: "serving_count_verified", dimension: "count", basis: "PACKAGE", implicit_unit: "count" },
    numberofservings: { field_name: "serving_count_verified", dimension: "count", basis: "PACKAGE", implicit_unit: "count" },
    servingsize: { field_name: "serving_size_g", dimension: "weight", basis: "PER_SERVING" },
    servingsizeg: { field_name: "serving_size_g", dimension: "weight", basis: "PER_SERVING", implicit_unit: "g" },
    servingsizeml: { field_name: "serving_size_ml", dimension: "volume", basis: "PER_SERVING", implicit_unit: "ml" },
    proteinperserving: { field_name: "protein_per_serving_g", dimension: "weight", basis: "PER_SERVING" },
    proteinperservingg: { field_name: "protein_per_serving_g", dimension: "weight", basis: "PER_SERVING", implicit_unit: "g" },
    creatineperserving: { field_name: "creatine_per_serving_g", dimension: "weight", basis: "PER_SERVING" },
    creatineperservingg: { field_name: "creatine_per_serving_g", dimension: "weight", basis: "PER_SERVING", implicit_unit: "g" },
  }[normalized];
  if (direct) return direct;
  const hasServingSize = parent && typeof parent === "object" &&
    Object.keys(parent).some((name) => /^serving[_ -]?size$/i.test(name));
  if (normalized === "proteincontent" && hasServingSize) {
    return { field_name: "protein_per_serving_g", dimension: "weight", basis: "PER_SERVING" };
  }
  if (normalized === "creatinecontent" && hasServingSize) {
    return { field_name: "creatine_per_serving_g", dimension: "weight", basis: "PER_SERVING" };
  }
  return null;
}

function quantityFromJsonValue(value, definition) {
  const { dimension, implicit_unit: implicitUnit } = definition;
  if (typeof value === "number") {
    if (!implicitUnit && dimension !== "count") return null;
    return parseQuantity(`${value}${dimension === "count" ? "" : ` ${implicitUnit}`}`, dimension);
  }
  if (typeof value === "string") {
    const parsed = parseQuantity(value, dimension);
    if (parsed) return parsed;
    return implicitUnit ? parseQuantity(`${value} ${implicitUnit}`, dimension) : null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const numeric = value.value ?? value.amount ?? value.valueReference;
  const unit = value.unitText ?? value.unitCode ?? value.unit ?? "";
  return parseQuantity(`${numeric ?? ""} ${unit}`.trim(), dimension);
}

function observationFromJsonValue(definition, value, parser, evidence, locator) {
  if (!definition) return null;
  const quantity = quantityFromJsonValue(value, definition);
  if (quantity) return observation(definition, quantity, parser, evidence, locator);
  if (definition.field_name !== "serving_size_g") return null;
  const volumeDefinition = { ...definition, field_name: "serving_size_ml", dimension: "volume" };
  return observation(
    volumeDefinition,
    quantityFromJsonValue(value, volumeDefinition),
    parser,
    evidence,
    locator,
  );
}

function parseJsonObject(root, parser, locatorRoot) {
  const observations = [];
  function walk(value, jsonPath) {
    if (Array.isArray(value)) {
      value.forEach((child, index) => walk(child, `${jsonPath}[${index}]`));
      return;
    }
    if (!value || typeof value !== "object") return;
    if (typeof value.name === "string" && Object.prototype.hasOwnProperty.call(value, "value")) {
      const definition = fieldDefinition(value.name);
      const item = observationFromJsonValue(definition, value.value, parser, `${value.name}: ${String(value.value)}`, `${locatorRoot}${jsonPath}`);
      if (item) observations.push(item);
    }
    for (const [key, child] of Object.entries(value)) {
      const definition = jsonKeyDefinition(key, value);
      const item = observationFromJsonValue(definition, child, parser, `${key}: ${typeof child === "object" ? canonical(child) : String(child)}`, `${locatorRoot}${jsonPath}.${key}`);
      if (item) observations.push(item);
      walk(child, `${jsonPath}.${key}`);
    }
  }
  walk(root, "$" );
  return observations;
}

function parseJsonLd(html) {
  const nodes = [];
  function collectProducts(value, locator) {
    if (Array.isArray(value)) {
      value.forEach((child, index) => collectProducts(child, `${locator}[${index}]`));
      return;
    }
    if (!value || typeof value !== "object") return;
    const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
    if (types.includes("Product")) {
      nodes.push({ value, locator });
      return;
    }
    for (const [key, child] of Object.entries(value)) collectProducts(child, `${locator}.${key}`);
  }
  const blocks = jsonLdBlocks(html);
  for (const block of blocks) collectProducts(block.value, `jsonld:${block.index}:$`);
  const targets = nodes;
  const observations = targets.flatMap((target) => parseJsonObject(target.value, "JSON_LD", target.locator));
  if (nodes.length > 1) {
    for (const item of observations) item.flags = [...new Set([...item.flags, "MULTIPLE_JSON_LD_PRODUCTS"])].sort();
  }
  return observations;
}

function tableCells(rowHtml) {
  return [...String(rowHtml).matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((match) => plainText(match[1]));
}

function parseTables(html) {
  const observations = [];
  const tables = [...String(html).matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)];
  tables.forEach((tableMatch, tableIndex) => {
    const rows = [...tableMatch[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => tableCells(match[1])).filter((cells) => cells.length >= 2);
    let perServingColumn = -1;
    rows.forEach((cells, rowIndex) => {
      cells.forEach((cell, columnIndex) => {
        if (columnIndex > 0 && /\bper\s+(?:one\s+)?serv(?:e|ing)\b/i.test(cell)) {
          perServingColumn = columnIndex;
          const sizeMatch = cell.match(/(?:\(|\b)(approximately\s+|approx\.?\s+|~\s*)?([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|mg)(?:\)|\b)/i);
          if (sizeMatch) {
            const definition = { field_name: "serving_size_g", dimension: "weight", basis: "PER_SERVING" };
            const quantity = parseQuantity(`${sizeMatch[1] || ""}${sizeMatch[2]} ${sizeMatch[3]}`, "weight");
            const item = observation(definition, quantity, "TABLE", cell, `table:${tableIndex + 1}/row:${rowIndex + 1}/column:${columnIndex + 1}`);
            if (item) observations.push(item);
          }
        }
      });
    });
    rows.forEach((cells, rowIndex) => {
      const label = cells[0];
      const explicit = fieldDefinition(label);
      const inherited = perServingColumn > 0 ? fieldDefinition(label, "PER_SERVING") : null;
      const definition = explicit || inherited;
      if (!definition) return;
      const valueIndex = definition.basis === "PER_SERVING" && perServingColumn > 0 ? perServingColumn : 1;
      if (valueIndex >= cells.length) return;
      const resolved = resolveDefinitionQuantity(definition, cells[valueIndex]);
      const evidence = [label, cells[valueIndex]].join(" | ");
      const item = observation(resolved?.definition, resolved?.quantity, "TABLE", evidence, `table:${tableIndex + 1}/row:${rowIndex + 1}/column:${valueIndex + 1}`);
      if (item) observations.push(item);
    });
  });
  return observations;
}

function parseText(html) {
  const observations = [];
  for (const [index, line] of visibleTextLines(html).entries()) {
    const exactServingSize = line.match(/^serving\s+size\s*:\s*(.{1,160})$/i);
    if (exactServingSize) {
      let definition = { field_name: "serving_size_g", dimension: "weight", basis: "PER_SERVING" };
      const directWeight = parseQuantity(exactServingSize[1], "weight");
      const directVolume = parseQuantity(exactServingSize[1], "volume");
      let quantity = directWeight?.flags.length === 0
        ? directWeight
        : strictParentheticalServingSize(exactServingSize[1]);
      if (!quantity && directVolume?.flags.length === 0) {
        definition = { ...definition, field_name: "serving_size_ml", dimension: "volume" };
        quantity = directVolume;
      }
      const item = observation(definition, quantity, "TEXT_LABEL", line, `text:line:${index + 1}`);
      if (item) observations.push(item);
      const servingCountMatch = line.match(/\bservings?\s+per\s+(?:container|pack(?:age)?|tub|bottle)\s*:\s*([0-9]+)\b/i);
      if (servingCountMatch) {
        const countDefinition = { field_name: "serving_count_verified", dimension: "count", basis: "PACKAGE" };
        const count = parseQuantity(servingCountMatch[1], "count");
        const countItem = observation(countDefinition, count, "TEXT_LABEL", line, `text:line:${index + 1}`);
        if (countItem) observations.push(countItem);
      }
      continue;
    }
    const match = line.match(/^(.{2,120}?)(?:\s*[:–—-]\s*|\s+is\s+)([^:]{1,80})$/i);
    if (!match) continue;
    const definition = fieldDefinition(match[1]);
    const resolved = resolveDefinitionQuantity(definition, match[2]);
    const item = observation(resolved?.definition, resolved?.quantity, "TEXT_LABEL", line, `text:line:${index + 1}`);
    if (item) observations.push(item);
  }
  return observations;
}

function parseExplicitManufacturerText(html) {
  const observations = [];
  const parser = "MANUFACTURER_EXPLICIT_TEXT";
  const proseFlags = ["EXPLICIT_PROSE_EVIDENCE"];

  function unsafeQualifier(match) {
    const prefix = String(match.input || "").slice(Math.max(0, (match.index || 0) - 24), match.index || 0);
    return /(?:up\s+to|as\s+much\s+as|more\s+than|less\s+than|at\s+least|under|over|between)\s*$/i.test(prefix) ||
      /(?:\bbetween\b.{0,16}\band|\bfrom\b.{0,16}\bto)\s*$/i.test(prefix) ||
      /[0-9]\s*[-/\u2013\u2014]\s*$/.test(prefix);
  }

  function add(definition, rawValue, match, locator) {
    if (unsafeQualifier(match)) return;
    const resolved = resolveDefinitionQuantity(definition, rawValue);
    const item = observation(
      resolved?.definition,
      resolved?.quantity,
      parser,
      match[0].replace(/\s+/g, " ").trim(),
      locator,
      proseFlags,
    );
    if (item) observations.push(item);
  }

  function addPackage(rawValue, match, locator) {
    if (unsafeQualifier(match)) return;
    const weight = parseQuantity(rawValue, "weight");
    const volume = weight ? null : parseQuantity(rawValue, "volume");
    const definition = weight
      ? { field_name: "net_weight_g", dimension: "weight", basis: "PACKAGE" }
      : { field_name: "net_volume_ml", dimension: "volume", basis: "PACKAGE" };
    const item = observation(
      definition,
      weight || volume,
      parser,
      match[0].replace(/\s+/g, " ").trim(),
      locator,
      proseFlags,
    );
    if (item) observations.push(item);
  }

  for (const { text: line, locator } of explicitEvidenceLines(html)) {
    for (const match of line.matchAll(/\b([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|mg)\s+(?:of\s+)?protein\s+per\s+([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|mg)\s+serv(?:e|ing)\b/gi)) {
      add({ field_name: "protein_per_serving_g", dimension: "weight", basis: "PER_SERVING" }, `${match[1]} ${match[2]}`, match, locator);
      add({ field_name: "serving_size_g", dimension: "weight", basis: "PER_SERVING" }, `${match[3]} ${match[4]}`, match, locator);
    }
    for (const match of line.matchAll(/\b([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|mg)\s+(?:of\s+)?protein\s+per\s+(?:one\s+)?serv(?:e|ing)\b/gi)) {
      add({ field_name: "protein_per_serving_g", dimension: "weight", basis: "PER_SERVING" }, `${match[1]} ${match[2]}`, match, locator);
    }
    for (const match of line.matchAll(/\bprotein(?:\s+content)?\s*(?:is|[:=]|\u2013|\u2014|-)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|mg)\s+per\s+(?:one\s+)?serv(?:e|ing)\b/gi)) {
      add({ field_name: "protein_per_serving_g", dimension: "weight", basis: "PER_SERVING" }, `${match[1]} ${match[2]}`, match, locator);
    }
    for (const match of line.matchAll(/\b([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|mg)\s+(?:of\s+)?creatine\s+per\s+(?:one\s+)?serv(?:e|ing)\b/gi)) {
      add({ field_name: "creatine_per_serving_g", dimension: "weight", basis: "PER_SERVING" }, `${match[1]} ${match[2]}`, match, locator);
    }
    for (const match of line.matchAll(/\bcreatine\s*(?:is|[:=]|\u2013|\u2014|-)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|mg)\s+per\s+(?:one\s+)?serv(?:e|ing)\b/gi)) {
      add({ field_name: "creatine_per_serving_g", dimension: "weight", basis: "PER_SERVING" }, `${match[1]} ${match[2]}`, match, locator);
    }
    for (const pattern of [
      /\b([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|mg|ml|l)\s+serv(?:e|ing)\s+size\b/gi,
      /\b(?:each|every|recommended)\s+([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|mg|ml|l)\s+serv(?:e|ing)\b/gi,
      /(?:^|[.;:|]\s*)([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|mg|ml|l)\s+serv(?:e|ing)\b/gi,
      /\b(?:measured|used)\s+at\s+(?:the\s+recommended\s+)?([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|mg|ml|l)\s+per\s+serv(?:e|ing)\b/gi,
    ]) {
      for (const match of line.matchAll(pattern)) {
        add({ field_name: "serving_size_g", dimension: "weight", basis: "PER_SERVING" }, `${match[1]} ${match[2]}`, match, locator);
      }
    }
    const servingCountPatterns = locator.startsWith("manufacturer:meta-description:")
      ? [/\b((?:approximately|approx\.?|about|around|circa|~)\s*)?([0-9]+)\s+servings?\b/gi]
      : [
        /\b((?:approximately|approx\.?|about|around|circa|~)\s*)?([0-9]+)\s+servings?\s+(?:per|in)\s+(?:every|each|one|a|the)?\s*(?:[0-9]+(?:[.,][0-9]+)?\s*(?:kg|g|ml|l)\s+)?(?:container|tub|bottle|bag|pouch|pack(?:age)?)\b/gi,
        /\b(?:container|tub|bottle|bag|pouch|pack(?:age)?)\s+(?:provides|contains|has)\s+((?:approximately|approx\.?|about|around|circa|~)\s*)?([0-9]+)\s+servings?\b/gi,
      ];
    for (const pattern of servingCountPatterns) {
      for (const match of line.matchAll(pattern)) {
        add({ field_name: "serving_count_verified", dimension: "count", basis: "PACKAGE" }, `${match[1] || ""}${match[2]} servings`, match, locator);
      }
    }
    for (const match of line.matchAll(/\b([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|ml|l)\s+(?:tub|bag|pouch|bottle|pack(?:age)?)\b/gi)) {
      addPackage(`${match[1]} ${match[2]}`, match, locator);
    }
  }
  return observations;
}

function parseSnapshot(content, contentType, options = {}) {
  if (contentType === "application/json") {
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      fail("NCE_SOURCE_SCHEMA_MISMATCH", "JSON snapshot is invalid", { cause: error.message });
    }
    return parseJsonObject(parsed, "JSON_FEED", "json:");
  }
  const manufacturerSource = options.sourceType === "manufacturer_product_page";
  const scopedHtml = manufacturerSource ? manufacturerPrimaryProductHtml(content) : content;
  return [
    ...parseJsonLd(content),
    ...parseTables(scopedHtml),
    ...parseText(scopedHtml),
    ...(manufacturerSource ? parseExplicitManufacturerText(content) : []),
  ];
}

function confidenceRank(value) {
  return { LOW: 1, MEDIUM: 2, HIGH: 3 }[value];
}

function minimumConfidence(...values) {
  return values.reduce((lowest, value) => confidenceRank(value) < confidenceRank(lowest) ? value : lowest, "HIGH");
}

function identityConfidence(binding) {
  return { EXACT_VARIANT: "HIGH", EXACT_PRODUCT: "MEDIUM", LEGACY_PRODUCT_URL: "LOW", UNMAPPED_SOURCE: "LOW" }[binding];
}

function extractionConfidence(item) {
  let confidence = ["TEXT_LABEL", "MANUFACTURER_EXPLICIT_TEXT"].includes(item.parser) ? "MEDIUM" : "HIGH";
  if (item.flags.includes("APPROXIMATE_VALUE")) confidence = "MEDIUM";
  return confidence;
}

function observationKey(item) {
  return `${item.field_name}|${item.value_numeric}|${item.unit}|${item.basis}`;
}

function deduplicateObservations(observations) {
  const byKey = new Map();
  for (const item of observations) {
    const key = observationKey(item);
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, { ...item });
      continue;
    }
    const parsers = new Set([...current.parser.split("+"), ...item.parser.split("+")]);
    current.parser = [...parsers].sort().join("+");
    current.flags = [...new Set([
      ...current.flags,
      ...item.flags,
      ...(parsers.size > 1 ? ["MULTIPLE_PARSER_EVIDENCE"] : []),
    ])].sort();
    if (item.evidence_text !== current.evidence_text) {
      if (parsers.has("MANUFACTURER_EXPLICIT_TEXT")) {
        current.evidence_text = [current.evidence_text, item.evidence_text]
          .sort((left, right) => right.length - left.length)[0]
          .slice(0, 160);
      } else {
        current.evidence_text = `${current.evidence_text} || ${item.evidence_text}`.slice(0, MAX_EVIDENCE_LENGTH);
      }
    }
    if (item.evidence_locator !== current.evidence_locator) {
      current.evidence_locator = `${current.evidence_locator} | ${item.evidence_locator}`.slice(0, 300);
    }
  }
  return [...byKey.values()];
}

function applyConsistencyFlags(observations) {
  const valuesByField = new Map();
  for (const item of observations) {
    if (!valuesByField.has(item.field_name)) valuesByField.set(item.field_name, new Set());
    valuesByField.get(item.field_name).add(String(item.value_numeric));
  }
  for (const item of observations) {
    if (valuesByField.get(item.field_name).size > 1) item.flags.push("CONFLICTING_SOURCE_VALUES");
  }
  const first = (field) => observations.find((item) => item.field_name === field && valuesByField.get(field)?.size === 1)?.value_numeric;
  const servingSize = first("serving_size_g");
  const servingCount = first("serving_count_verified");
  const netWeight = first("net_weight_g");
  for (const field of ["protein_per_serving_g", "creatine_per_serving_g"]) {
    if (servingSize != null) {
      for (const item of observations.filter((candidate) => candidate.field_name === field && candidate.value_numeric > servingSize)) {
        item.flags.push("NUTRIENT_EXCEEDS_SERVING_SIZE");
      }
    }
  }
  if (servingSize != null && servingCount != null && netWeight != null &&
      Math.abs(netWeight - servingSize * servingCount) > servingSize) {
    for (const item of observations.filter((candidate) => ["net_weight_g", "serving_count_verified", "serving_size_g"].includes(candidate.field_name))) {
      item.flags.push("PACKAGE_SERVING_MISMATCH");
    }
  }
  for (const item of observations) item.flags = [...new Set(item.flags)].sort();
  return observations;
}

function buildCandidates(record, observations, runId, capturedAt) {
  const identity = identityConfidence(record.identity_binding);
  return observations.map((item) => {
    const extraction = extractionConfidence(item);
    const risky = item.flags.some((flag) => [
      "CONFLICTING_SOURCE_VALUES",
      "NUTRIENT_EXCEEDS_SERVING_SIZE",
      "PACKAGE_SERVING_MISMATCH",
      "MULTIPLE_JSON_LD_PRODUCTS",
    ].includes(flag));
    const overall = risky ? "LOW" : minimumConfidence(identity, extraction);
    const core = {
      run_id: runId,
      source_record_id: record.source_record_id,
      product_name: record.product_name || `Product ${record.product_id}`,
      brand: record.brand || "Unknown",
      manufacturer: record.manufacturer || "Unknown",
      product_id: record.product_id,
      product_variant_id: record.product_variant_id,
      retailer_id: record.retailer_id,
      retailer_product_id: record.retailer_product_id,
      field_name: item.field_name,
      value_numeric: item.value_numeric,
      unit: item.unit,
      basis: item.basis,
      source_url: record.source_url,
      source_file: record.source_snapshot_ref || record.snapshot_file,
      source_type: record.source_type,
      parser: item.parser,
      evidence_text: item.evidence_text,
      evidence_locator: item.evidence_locator,
      captured_at: capturedAt,
      source_sha256: record.snapshot_sha256,
      identity_confidence: identity,
      extraction_confidence: extraction,
      overall_confidence: overall,
      flags: item.flags,
      current_value: Object.prototype.hasOwnProperty.call(record.current_values, item.field_name)
        ? record.current_values[item.field_name]
        : null,
      candidate_status: STATUS,
      review_status: "PENDING",
    };
    return sealCandidate(core);
  }).sort((left, right) => (left.product_id || "").localeCompare(right.product_id || "", undefined, { numeric: true }) ||
    (left.product_variant_id || "").localeCompare(right.product_variant_id || "", undefined, { numeric: true }) ||
    left.field_name.localeCompare(right.field_name) || left.value_numeric - right.value_numeric);
}

function sealCandidate(core) {
  const candidateFingerprint = fingerprint("CANDIDATE", core);
  return {
    candidate_id: `NC1-${candidateFingerprint.slice(0, 24)}`,
    ...core,
    candidate_fingerprint: candidateFingerprint,
  };
}

function applyCrossSourceConflicts(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const key = [
      candidate.product_id || `SOURCE:${candidate.source_record_id}`,
      candidate.product_variant_id || "PRODUCT",
      candidate.field_name,
    ].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(candidate);
  }
  for (const group of groups.values()) {
    const sources = new Set(group.map((row) => row.source_record_id));
    const values = new Set(group.map((row) => `${row.value_numeric}|${row.unit}|${row.basis}`));
    if (sources.size < 2 || values.size < 2) continue;
    for (const candidate of group) {
      const core = { ...candidate };
      delete core.candidate_id;
      delete core.candidate_fingerprint;
      core.flags = [...new Set([...core.flags, "CROSS_SOURCE_CONFLICT"])].sort();
      core.overall_confidence = "LOW";
      Object.assign(candidate, sealCandidate(core));
    }
  }
  return candidates;
}

function resolveSnapshotPath(manifestPath, snapshotFile) {
  const base = path.dirname(path.resolve(manifestPath));
  const resolved = path.resolve(base, snapshotFile);
  const relative = path.relative(base, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("NCE_PATH_OUTSIDE_MANIFEST", `snapshot_file escapes manifest directory: ${snapshotFile}`);
  }
  if (fs.existsSync(resolved)) {
    const realBase = fs.realpathSync.native(base);
    const realResolved = fs.realpathSync.native(resolved);
    const realRelative = path.relative(realBase, realResolved);
    if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
      fail("NCE_PATH_OUTSIDE_MANIFEST", `snapshot_file resolves outside manifest directory: ${snapshotFile}`);
    }
  }
  return resolved;
}

function loadSnapshot(manifestPath, record) {
  const file = resolveSnapshotPath(manifestPath, record.snapshot_file);
  const stats = fs.statSync(file);
  if (!stats.isFile() || stats.size > MAX_SNAPSHOT_BYTES) {
    fail("NCE_SOURCE_TOO_LARGE", `Snapshot ${record.snapshot_file} is missing or exceeds ${MAX_SNAPSHOT_BYTES} bytes`);
  }
  const bytes = fs.readFileSync(file);
  const actual = sha256(bytes);
  if (actual !== record.snapshot_sha256) {
    fail("NCE_SOURCE_HASH_MISMATCH", `Snapshot hash mismatch for ${record.source_record_id}`);
  }
  return bytes.toString("utf8");
}

function selectRecords(records, filters = {}) {
  const productIds = new Set(filters.product_ids || []);
  const retailerIds = new Set(filters.retailer_ids || []);
  const selected = records.filter((record) =>
    (!productIds.size || productIds.has(record.product_id)) &&
    (!retailerIds.size || retailerIds.has(record.retailer_id))
  );
  if (!selected.length) fail("NCE_EMPTY_SCOPE", "No source records matched the requested IDs");
  return selected;
}

function buildArtifact({ manifest, manifestBytes, manifestPath, filters = {}, generatedAt = null }) {
  validateManifest(manifest);
  const artifactGeneratedAt = generatedAt || manifest.captured_at;
  if (!validTimestamp(artifactGeneratedAt)) fail("NCE_SOURCE_SCHEMA_MISMATCH", "generatedAt is invalid");
  const selected = selectRecords(manifest.records, filters);
  const sourceManifestSha256 = sha256(manifestBytes);
  const runCore = {
    source_manifest_sha256: sourceManifestSha256,
    product_ids: [...new Set(filters.product_ids || [])].sort(),
    retailer_ids: [...new Set(filters.retailer_ids || [])].sort(),
    source_record_ids: selected.map((record) => record.source_record_id).sort(),
  };
  const runId = `NCR1-${fingerprint("RUN", runCore).slice(0, 24)}`;
  const candidates = [];
  const exclusions = [];
  for (const record of selected) {
    const snapshot = loadSnapshot(manifestPath, record);
    const parsed = applyConsistencyFlags(deduplicateObservations(parseSnapshot(
      snapshot,
      record.content_type,
      { sourceType: record.source_type },
    )));
    if (!parsed.length) {
      exclusions.push({
        source_record_id: record.source_record_id,
        product_id: record.product_id,
        retailer_id: record.retailer_id,
        reason_code: "NO_SUPPORTED_NUMERIC_FACTS",
      });
      continue;
    }
    candidates.push(...buildCandidates(record, parsed, runId, manifest.captured_at));
  }
  applyCrossSourceConflicts(candidates);
  candidates.sort((left, right) => left.candidate_id.localeCompare(right.candidate_id));
  exclusions.sort((left, right) => left.source_record_id.localeCompare(right.source_record_id));
  const summary = {
    selected_source_records: selected.length,
    candidate_facts: candidates.length,
    excluded_source_records: exclusions.length,
    high_confidence_candidates: candidates.filter((row) => row.overall_confidence === "HIGH").length,
    medium_confidence_candidates: candidates.filter((row) => row.overall_confidence === "MEDIUM").length,
    low_confidence_candidates: candidates.filter((row) => row.overall_confidence === "LOW").length,
    database_writes: 0,
    network_requests: 0,
  };
  const core = {
    schema_version: 2,
    kind: ARTIFACT_KIND,
    status: STATUS,
    mode: MODE,
    run_id: runId,
    generated_at: new Date(artifactGeneratedAt).toISOString(),
    source_manifest_sha256: sourceManifestSha256,
    filters: {
      product_ids: runCore.product_ids,
      retailer_ids: runCore.retailer_ids,
    },
    summary,
    candidates,
    exclusions,
  };
  return { ...core, artifact_fingerprint: fingerprint("ARTIFACT", { ...core, generated_at: null }) };
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCandidateCsv(candidates) {
  const rows = candidates.map((candidate) => CSV_COLUMNS.map((column) => {
    if (column === "flags") return csvCell(candidate.flags.join("|"));
    return csvCell(candidate[column]);
  }).join(","));
  return `${CSV_COLUMNS.join(",")}\n${rows.join("\n")}${rows.length ? "\n" : ""}`;
}

function parseCandidateCsv(content) {
  const header = String(content).split(/\r?\n/, 1)[0];
  if (header !== CSV_COLUMNS.join(",")) fail("NCE_SOURCE_SCHEMA_MISMATCH", "Candidate CSV header differs from frozen schema");
  return parse(content, { columns: true, bom: true, skip_empty_lines: true });
}

function assertRealPathInsideRoot(rootDirectory, targetDirectory) {
  const root = path.resolve(rootDirectory);
  const target = path.resolve(targetDirectory);
  const lexicalRelative = path.relative(root, target);
  if (lexicalRelative.startsWith("..") || path.isAbsolute(lexicalRelative)) {
    fail("NCE_PATH_OUTSIDE_OUTPUT_ROOT", "Candidate output escapes its allowed root");
  }
  fs.mkdirSync(root, { recursive: true });
  const realRoot = fs.realpathSync.native(root);
  const realParent = fs.realpathSync.native(path.dirname(root));
  if (path.relative(path.join(realParent, path.basename(root)), realRoot) !== "") {
    fail("NCE_PATH_OUTSIDE_OUTPUT_ROOT", "Candidate output root cannot be a symbolic link or junction");
  }
  let current = root;
  for (const component of lexicalRelative.split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    if (!fs.existsSync(current)) break;
    const realCurrent = fs.realpathSync.native(current);
    const realRelative = path.relative(realRoot, realCurrent);
    if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
      fail("NCE_PATH_OUTSIDE_OUTPUT_ROOT", "Candidate output resolves outside its allowed root");
    }
  }
  return { root, target, realRoot };
}

function writeArtifactFiles(artifact, outputDirectory, allowedRoot) {
  if (!allowedRoot) fail("NCE_PATH_OUTSIDE_OUTPUT_ROOT", "Candidate output root is required");
  const checked = assertRealPathInsideRoot(allowedRoot, outputDirectory);
  const directory = path.resolve(outputDirectory);
  fs.mkdirSync(directory, { recursive: true });
  const realDirectory = fs.realpathSync.native(directory);
  const realRelative = path.relative(checked.realRoot, realDirectory);
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
    fail("NCE_PATH_OUTSIDE_OUTPUT_ROOT", "Candidate output resolves outside its allowed root");
  }
  const base = `nutrition-candidates-${artifact.run_id.toLowerCase()}`;
  const jsonPath = path.join(directory, `${base}.json`);
  const csvPath = path.join(directory, `${base}.csv`);
  const json = `${JSON.stringify(artifact, null, 2)}\n`;
  const csv = exportCandidateCsv(artifact.candidates);
  for (const [file, content] of [[jsonPath, json], [csvPath, csv]]) {
    if (fs.existsSync(file)) {
      if (fs.readFileSync(file, "utf8") !== content) fail("NCE_OUTPUT_COLLISION", `Existing artifact differs: ${file}`);
    } else {
      fs.writeFileSync(file, content, { flag: "wx" });
    }
  }
  return { jsonPath, csvPath };
}

module.exports = {
  ARTIFACT_KIND,
  CSV_COLUMNS,
  FIELDS,
  INPUT_KIND,
  INPUT_KIND_V2,
  MAX_SNAPSHOT_BYTES,
  MODE,
  NutritionCandidateError,
  STATUS,
  applyCrossSourceConflicts,
  applyConsistencyFlags,
  assertRealPathInsideRoot,
  buildArtifact,
  decodeHtmlEntities,
  deduplicateObservations,
  exportCandidateCsv,
  fieldDefinition,
  fingerprint,
  htmlAttribute,
  manufacturerPrimaryProductHtml,
  parseCandidateCsv,
  parseExplicitManufacturerText,
  parseJsonLd,
  parseJsonObject,
  parseQuantity,
  parseSnapshot,
  parseTables,
  parseText,
  resolveSnapshotPath,
  selectRecords,
  sealCandidate,
  sha256,
  validateManifest,
  validateSourceUrl,
  writeArtifactFiles,
};
