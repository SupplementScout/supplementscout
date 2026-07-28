const assert = require("node:assert/strict");
const test = require("node:test");
const approval = require("../config/retailers/six-pack-reviewed-large-family-batch-v11.json");
const {
  parseArgs,
} = require("./six-pack-reviewed-multipage-family-approval-builder");

test("reviewed decisions build five families across nineteen source pages", () => {
  assert.equal(approval.kind, "six-pack-reviewed-large-family-batch-v11");
  assert.equal(approval.family_count, 5);
  assert.equal(approval.new_product_count, 3);
  assert.equal(approval.row_count, 19);
  assert.equal(
    new Set(
      approval.families.flatMap((family) =>
        family.variants.map((variant) => variant.external_product_id)
      )
    ).size,
    18
  );
  const pump = approval.families.find((family) => family.external_product_id === "6312");
  assert.equal(pump.name, "Applied Nutrition Pump 3G Pre-Workout 375g");
  assert.equal(pump.kind, "EXISTING_CANONICAL_PRODUCT");
  assert.equal(pump.product_id, "1062");
  assert.equal(pump.size, "375");
  assert.doesNotMatch(pump.name, /Zero Stim/i);
});

test("approval output remains inside tmp", () => {
  assert.throws(
    () => parseArgs(["--output=config/unsafe.json"]),
    /inside repository tmp/
  );
});
