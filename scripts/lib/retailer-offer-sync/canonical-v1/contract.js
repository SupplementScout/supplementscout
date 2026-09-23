const { fingerprint } = require("../artifacts");
const { validateSchemaValue } = require("../../retailer-snapshot/schemas");
const { CANONICAL_RECORD_V1_SCHEMA } = require("./schema");
const { getReason } = require("./taxonomy");

const CONTRACT_VERSION = "v1";
const PRICE_PATTERN = /^(0|[1-9][0-9]*)(?:\.([0-9]{1,2}))?$/;

function evidenceValue(raw, key) {
  if (!Object.hasOwn(raw, key)) return { state: "MISSING", value: null };
  if (raw[key] === null || raw[key] === "") return { state: "UNKNOWN", value: null };
  return { state: "PRESENT", value: String(raw[key]).trim() };
}

function moneyValue(value, currency) {
  if (value === undefined) return { state: "MISSING", amount_minor: null, currency: currency || null };
  if (value === null || value === "") return { state: "UNKNOWN", amount_minor: null, currency: currency || null };
  if (typeof value !== "string" || !PRICE_PATTERN.test(value)) return { state: "INVALID", amount_minor: null, currency: currency || null };
  const [, , fraction = ""] = value.match(PRICE_PATTERN);
  const whole = value.split(".")[0];
  return { state: "PRESENT", amount_minor: (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0") || "0")).toString(), currency: currency || null };
}

function identityEvidence(record) {
  return [
    ["external_product_id", "EXTERNAL_PRODUCT_ID", "EXACT"],
    ["external_variant_id", "EXTERNAL_VARIANT_ID", "EXACT"],
    ["sku", "SKU", "SUPPORTING"],
    ["gtin", "GTIN", "SUPPORTING"],
    ["source_url", "URL", "SUPPORTING"],
  ].filter(([field]) => record[field].state === "PRESENT").map(([field, kind, confidence]) => ({ kind, value: record[field].value, confidence }));
}

function semanticErrors(record) {
  const errors = [];
  for (const key of ["external_product_id", "external_variant_id", "sku", "gtin", "product_name", "brand", "variant", "source_url"]) {
    const value = record[key];
    if (value.state === "PRESENT" && !value.value) errors.push({ code: "CANONICAL_SOURCE_INVALID", path: `$.${key}`, message: "Present field requires a value" });
    if (value.state !== "PRESENT" && value.value !== null) errors.push({ code: "CANONICAL_SOURCE_INVALID", path: `$.${key}`, message: "Non-present field must use null" });
  }
  if (record.price.state === "PRESENT" && (record.price.amount_minor === null || record.price.currency === null)) errors.push({ code: "CANONICAL_SOURCE_INVALID", path: "$.price", message: "Present money requires minor units and currency" });
  if (record.price.state !== "PRESENT" && record.price.amount_minor !== null) errors.push({ code: "CANONICAL_SOURCE_INVALID", path: "$.price.amount_minor", message: "Non-present money cannot contain an amount" });
  if (record.source_presence === "MISSING_FROM_SOURCE" && record.availability !== "SOURCE_MISSING") errors.push({ code: "CANONICAL_SOURCE_INVALID", path: "$.availability", message: "Missing source must remain distinct from out of stock" });
  return errors;
}

function validateCanonicalRecord(record, { throwOnError = false } = {}) {
  const schema = validateSchemaValue(CANONICAL_RECORD_V1_SCHEMA, record, { throwOnError: false });
  const errors = [...schema.errors.map((error) => ({ ...error, code: "CANONICAL_SOURCE_INVALID" })), ...semanticErrors(record)];
  const expectedFingerprint = fingerprint({ ...record, record_fingerprint: null });
  if (record.record_fingerprint !== expectedFingerprint) errors.push({ code: "CANONICAL_SOURCE_INVALID", path: "$.record_fingerprint", message: "Canonical record fingerprint mismatch" });
  if (throwOnError && errors.length) {
    const error = new Error(errors[0].message);
    error.code = errors[0].code;
    error.path = errors[0].path;
    error.errors = errors;
    throw error;
  }
  return { valid: errors.length === 0, reason_codes: errors.length ? ["CANONICAL_SOURCE_INVALID"] : [], errors };
}

function createCanonicalRecord(raw, context) {
  const sourcePresence = raw.source_presence || "PRESENT";
  const price = moneyValue(raw.price, raw.currency === undefined ? null : String(raw.currency).toUpperCase());
  const normalizationReasons = [];
  const warnings = [];
  if (price.state === "INVALID") {
    normalizationReasons.push("CANONICAL_SOURCE_INVALID");
    warnings.push({ code: "INVALID_PRICE", path: "$.price" });
  }
  const record = {
    contract_version: CONTRACT_VERSION,
    source: { retailer_ref: String(context.retailer_ref), source_ref: String(context.source_ref), source_type: context.source_type },
    run_id: String(context.run_id), captured_at: context.captured_at,
    source_fingerprint: context.source_fingerprint,
    source_record_id: String(raw.source_record_id), source_presence: sourcePresence,
    external_product_id: evidenceValue(raw, "external_product_id"),
    external_variant_id: evidenceValue(raw, "external_variant_id"),
    sku: evidenceValue(raw, "sku"), gtin: evidenceValue(raw, "gtin"),
    product_name: evidenceValue(raw, "product_name"), brand: evidenceValue(raw, "brand"),
    variant: evidenceValue(raw, "variant"), source_url: evidenceValue(raw, "source_url"),
    price, availability: sourcePresence === "MISSING_FROM_SOURCE" ? "SOURCE_MISSING" : (raw.availability || "UNKNOWN"),
    provenance: Object.keys(raw).filter((key) => !["source_record_id", "source_presence"].includes(key)).sort().map((field) => ({ field, source_path: `$.${field}`, evidence_type: "DIRECT", observed_at: context.captured_at })),
    identity_evidence: [], normalization_warnings: warnings,
    validation_result: { status: normalizationReasons.length ? "INVALID" : "VALID", reason_codes: normalizationReasons },
    record_fingerprint: null,
  };
  if (sourcePresence === "MISSING_FROM_SOURCE") record.provenance.push({ field: "source_presence", source_path: "$.expected_state", evidence_type: "SYNTHETIC_MISSING", observed_at: context.captured_at });
  record.identity_evidence = identityEvidence(record);
  record.record_fingerprint = fingerprint({ ...record, record_fingerprint: null });
  const validation = validateCanonicalRecord(record);
  if (!validation.valid && record.validation_result.status === "VALID") {
    record.validation_result = { status: "INVALID", reason_codes: ["CANONICAL_SOURCE_INVALID"] };
    record.record_fingerprint = fingerprint({ ...record, record_fingerprint: null });
  }
  getReason(record.validation_result.status === "VALID" ? "CANONICAL_SOURCE_VALID" : "CANONICAL_SOURCE_INVALID");
  return Object.freeze(record);
}

module.exports = { CONTRACT_VERSION, createCanonicalRecord, evidenceValue, moneyValue, validateCanonicalRecord };
