const assert = require("node:assert/strict");
const test = require("node:test");
const matrix = require("../../test-fixtures/retailer-snapshot/jons-supplements/scenario-matrix.json");
const { REASON_CODES, REASON_CODE_ENUM, getReason, validateRegistry } = require("./reason-codes");

test("reason registry contains exactly 64 complete unique frozen definitions", () => {
  assert.equal(validateRegistry(), true); assert.equal(REASON_CODES.length, 64); assert.equal(new Set(REASON_CODE_ENUM).size, 64);
  for (const reason of REASON_CODES) { assert.ok(reason.category); assert.ok(reason.severity); assert.ok(reason.default_primary_status); assert.ok(reason.default_approval_level); assert.ok(reason.message); assert.ok(reason.remediation); assert.equal(typeof reason.overrideable, "boolean"); assert.ok(Array.isArray(reason.required_evidence)); }
});
test("all 36 fixture reason references are registered and free-form additions are rejected", () => {
  assert.equal(matrix.fixtures.length, 36); for (const fixture of matrix.fixtures) for (const code of fixture.expected_reason_codes) assert.equal(getReason(code).code, code);
  assert.throws(() => getReason("FREE_FORM_REASON"), /Unknown reason code/);
});
