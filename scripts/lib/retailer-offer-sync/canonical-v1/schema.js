const FIELD_STATES = Object.freeze(["PRESENT", "UNKNOWN", "MISSING", "INVALID"]);
const SOURCE_PRESENCE = Object.freeze(["PRESENT", "MISSING_FROM_SOURCE"]);
const AVAILABILITY_STATES = Object.freeze(["IN_STOCK", "OUT_OF_STOCK", "UNKNOWN", "MISSING", "INVALID", "SOURCE_MISSING"]);
const SOURCE_TYPES = Object.freeze(["CSV", "JSON", "XML", "HTML", "API", "FIXTURE"]);

const nullableString = { anyOf: [{ type: "string", maxLength: 2048 }, { type: "null" }] };
const evidenceValue = {
  type: "object", additionalProperties: false, required: ["state", "value"],
  properties: { state: { enum: FIELD_STATES }, value: nullableString },
};
const money = {
  type: "object", additionalProperties: false, required: ["state", "amount_minor", "currency"],
  properties: {
    state: { enum: FIELD_STATES },
    amount_minor: { anyOf: [{ type: "string", pattern: "^(0|[1-9][0-9]{0,15})$" }, { type: "null" }] },
    currency: { anyOf: [{ type: "string", pattern: "^[A-Z]{3}$" }, { type: "null" }] },
  },
};

const CANONICAL_RECORD_V1_SCHEMA = Object.freeze({
  type: "object", additionalProperties: false,
  required: ["contract_version", "source", "run_id", "captured_at", "source_fingerprint", "source_record_id", "source_presence", "external_product_id", "external_variant_id", "sku", "gtin", "product_name", "brand", "variant", "source_url", "price", "availability", "provenance", "identity_evidence", "normalization_warnings", "validation_result", "record_fingerprint"],
  properties: {
    contract_version: { const: "v1" },
    source: {
      type: "object", additionalProperties: false, required: ["retailer_ref", "source_ref", "source_type"],
      properties: {
        retailer_ref: { type: "string", minLength: 1, maxLength: 128 },
        source_ref: { type: "string", minLength: 1, maxLength: 128 },
        source_type: { enum: SOURCE_TYPES },
      },
    },
    run_id: { type: "string", minLength: 1, maxLength: 128 },
    captured_at: { type: "string", format: "date-time" },
    source_fingerprint: { type: "string", pattern: "^[0-9a-f]{64}$" },
    source_record_id: { type: "string", minLength: 1, maxLength: 256 },
    source_presence: { enum: SOURCE_PRESENCE },
    external_product_id: evidenceValue,
    external_variant_id: evidenceValue,
    sku: evidenceValue,
    gtin: evidenceValue,
    product_name: evidenceValue,
    brand: evidenceValue,
    variant: evidenceValue,
    source_url: evidenceValue,
    price: money,
    availability: { enum: AVAILABILITY_STATES },
    provenance: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["field", "source_path", "evidence_type", "observed_at"],
        properties: {
          field: { type: "string", minLength: 1, maxLength: 128 },
          source_path: { type: "string", minLength: 1, maxLength: 512 },
          evidence_type: { enum: ["DIRECT", "DERIVED", "SYNTHETIC_MISSING"] },
          observed_at: { type: "string", format: "date-time" },
        },
      },
    },
    identity_evidence: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["kind", "value", "confidence"],
        properties: {
          kind: { enum: ["EXTERNAL_PRODUCT_ID", "EXTERNAL_VARIANT_ID", "SKU", "GTIN", "URL"] },
          value: { type: "string", minLength: 1, maxLength: 2048 },
          confidence: { enum: ["EXACT", "SUPPORTING", "WEAK"] },
        },
      },
    },
    normalization_warnings: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["code", "path"],
        properties: { code: { type: "string", pattern: "^[A-Z0-9_]+$" }, path: { type: "string", minLength: 1, maxLength: 512 } },
      },
    },
    validation_result: {
      type: "object", additionalProperties: false, required: ["status", "reason_codes"],
      properties: {
        status: { enum: ["VALID", "INVALID"] },
        reason_codes: { type: "array", uniqueItems: true, items: { type: "string", pattern: "^[A-Z0-9_]+$" } },
      },
    },
    record_fingerprint: { type: "string", pattern: "^[0-9a-f]{64}$" },
  },
});

module.exports = { AVAILABILITY_STATES, CANONICAL_RECORD_V1_SCHEMA, FIELD_STATES, SOURCE_PRESENCE, SOURCE_TYPES };
