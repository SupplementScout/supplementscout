const assert = require("node:assert/strict");
const test = require("node:test");
const { parseArgs, isAcceptedValidation } = require("./simply-supplements-identity-plan-executor");

test("identity executor requires target, mode and tmp artifacts", () => {
  const parsed = parseArgs(["--target=staging", "--mode=validate", "--report=tmp/r.json", "--artifacts=tmp/a", "--output=tmp/o.json"]);
  assert.equal(parsed.target, "staging");
  assert.equal(parsed.mode, "validate");
  assert.throws(() => parseArgs(["--target=production", "--mode=write", "--report=tmp/r", "--artifacts=tmp/a", "--output=tmp/o"]), /mode/);
});

test("identity executor accepts the existing guarded validator response only for the exact row scope", () => {
  const row = { entry: { retailer_id: "7", plan_kind: "feed" } };
  assert.equal(isAcceptedValidation({ retailer_id: 7, plan_kind: "feed" }, row), true);
  assert.equal(isAcceptedValidation({ valid: true }, row), true);
  assert.equal(isAcceptedValidation({ retailer_id: 8, plan_kind: "feed" }, row), false);
  assert.equal(isAcceptedValidation({ retailer_id: 7, plan_kind: "manual" }, row), false);
  assert.equal(isAcceptedValidation({}, row), false);
});
