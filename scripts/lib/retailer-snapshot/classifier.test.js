const assert = require("node:assert/strict");
const test = require("node:test");
const policy = require("../../config/retailers/jons-supplements");
const matrix = require("../../test-fixtures/retailer-snapshot/jons-supplements/scenario-matrix.json");
const { classifyRecord } = require("./classifier");

test("classifier covers all 36 frozen Phase 0 scenarios deterministically", () => {
  for (const [index, fixture] of matrix.fixtures.entries()) {
    const record = { source_record_id: String(index + 1), external_product_id: String(index + 100), external_variant_id: String(index + 1000), source_fingerprint: "a".repeat(64), evidence: fixture.source_data };
    const context = { primary_status: fixture.expected_classification, reason_codes: fixture.expected_reason_codes, proposed_action: fixture.expected_action, approval_level: fixture.expected_approval, confidence: fixture.expected_classification.startsWith("SAFE_") ? "HIGH" : "LOW" };
    const first = classifyRecord(record, { indexes: {} }, policy, context); const second = classifyRecord(record, { indexes: {} }, policy, context);
    assert.equal(first.primary_status, fixture.expected_classification, fixture.id); assert.deepEqual(first.reason_codes, [...fixture.expected_reason_codes].sort(), fixture.id); assert.equal(first.proposed_action, fixture.expected_action, fixture.id); assert.equal(first.approval_level, fixture.expected_approval, fixture.id); assert.equal(first.record_fingerprint, second.record_fingerprint, fixture.id);
  }
});
test("classifier infers OOS and fails closed for unknown reasons", () => {
  const result = classifyRecord({ source_record_id: "1", external_product_id: "10", external_variant_id: "11", external_sku: "SKU", external_gtin: "123", in_stock: false }, { indexes: {} }, policy);
  assert.equal(result.primary_status, "OUT_OF_STOCK"); assert.equal(result.proposed_action, "SKIP_OOS");
  assert.throws(() => classifyRecord({ source_record_id: "1", external_product_id: "10", external_variant_id: "11" }, { indexes: {} }, policy, { reason_codes: ["UNKNOWN"] }), /Unknown reason code/);
});
