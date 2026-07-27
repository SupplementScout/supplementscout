const assert = require("node:assert/strict");
const test = require("node:test");
const {
  classifyState,
  intendedVariants,
  parseArgs,
} = require("./six-pack-family-variant-bootstrap");
const reviewedFamilyMapV4 = require("../config/retailers/six-pack-reviewed-family-map-batch-v4.json");
const familyV6Bootstrap = require("../config/retailers/six-pack-production-family-v6-bootstrap.json");

test("variant bootstrap binds the exact 14 reviewed WooCommerce variants", () => {
  const intended = intendedVariants();
  assert.equal(intended.length, 14);
  assert.equal(new Set(intended.map((row) => row.variant_key)).size, 14);
  assert.deepEqual(
    [...new Set(intended.map((row) => row.product_id))].sort(),
    [126, 743, 954]
  );
  assert.equal(classifyState([], intended).state, "EMPTY");
  const existing = intended.map((row, index) => ({
    ...row,
    id: index + 1,
  }));
  assert.equal(classifyState(existing, intended).state, "COMPLETE");
  assert.throws(
    () => classifyState(existing.slice(0, 1), intended),
    /partial canonical state/
  );
});

test("variant bootstrap reuses the shared contract for the five V6 family variants", () => {
  const intended = intendedVariants(reviewedFamilyMapV4, familyV6Bootstrap);
  assert.equal(intended.length, 5);
  assert.deepEqual(
    intended.map((row) => row.product_id).sort((left, right) => left - right),
    [407, 769, 899, 899, 949]
  );
  assert.equal(new Set(intended.map((row) => `${row.product_id}:${row.variant_key}`)).size, 5);
});

test("variant bootstrap output remains inside tmp", () => {
  assert.throws(
    () => parseArgs(["--output=config/retailers/unsafe.json"]),
    /inside repository tmp/
  );
});
