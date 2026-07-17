const assert = require("node:assert/strict");
const test = require("node:test");
const policy = require("../../config/retailers/jons-supplements");
const { APPROVAL_LEVELS, CHILD_STATUSES, CONFIDENCE_LEVELS, CONTRACT_NAMES, PRIMARY_STATUSES, PROPOSED_ACTIONS, ROW_ACTIONS, assertIdString, validateContract } = require("./schemas");
const { ERROR_CODES } = require("./errors");

test("frozen contracts and enums have exact closed counts", () => {
  assert.equal(CONTRACT_NAMES.length, 10); assert.equal(PRIMARY_STATUSES.length, 9); assert.equal(PROPOSED_ACTIONS.length, 10);
  assert.equal(APPROVAL_LEVELS.length, 5); assert.equal(CONFIDENCE_LEVELS.length, 5); assert.equal(ROW_ACTIONS.length, 6); assert.equal(CHILD_STATUSES.length, 8); assert.equal(ERROR_CODES.length, 20);
});
test("policy guardrails satisfy the frozen policy contract", () => assert.equal(validateContract("RetailerBulkImportPolicyConfig", { schema_version: 1, ...policy.guardrails }).valid, true));
test("validators fail closed with stable JSON path and preserve bigint IDs as strings", () => {
  assert.equal(assertIdString("9007199254740993"), "9007199254740993");
  assert.throws(() => assertIdString(9007199254740993, "$.id"), (error) => error.code === "RSBI_SOURCE_SCHEMA_MISMATCH" && error.path === "$.id");
  const invalid = validateContract("RetailerBulkImportPolicyConfig", { schema_version: 1, surprise: true }, { throwOnError: false });
  assert.equal(invalid.valid, false); assert.ok(invalid.errors.some((error) => error.path === "$.preferred_batch_size")); assert.ok(invalid.errors.some((error) => error.path === "$.surprise"));
});
