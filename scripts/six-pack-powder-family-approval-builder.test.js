const assert = require("node:assert/strict");
const test = require("node:test");
const approval = require("../config/retailers/six-pack-reviewed-large-family-batch-v10.json");
const {
  parseArgs,
  sourceFlavour,
} = require("./six-pack-powder-family-approval-builder");

test("powder approval binds 13 safe families and 32 offers", () => {
  assert.equal(approval.kind, "six-pack-reviewed-large-family-batch-v10");
  assert.equal(approval.approved, true);
  assert.equal(approval.family_count, 13);
  assert.equal(approval.new_product_count, 13);
  assert.equal(approval.row_count, 32);
  assert.equal(
    approval.families.flatMap((family) => family.variants).length,
    32
  );
  assert.equal(approval.policy.food, "EXCLUDE");
  assert.equal(approval.policy.sarms, "EXCLUDE");
  assert.equal(approval.policy.peptides, "EXCLUDE");
  assert.equal(approval.policy.hormonal_and_high_risk_stimulants, "DEFER");
  assert.equal(approval.policy.conflicting_brand_identity, "DEFER");
});

test("retailer flavour keys are handled without product-specific adapters", () => {
  assert.equal(
    sourceFlavour({
      source_record_id: "x",
      external_options: { Flavor: "Blue Burst" },
    }),
    "Blue Burst"
  );
  assert.equal(
    sourceFlavour({
      source_record_id: "y",
      external_options: { Flavours: "Milk Chocolate" },
    }),
    "Milk Chocolate"
  );
});

test("approval output remains inside tmp", () => {
  assert.throws(
    () => parseArgs(["--output=config/unsafe.json"]),
    /inside repository tmp/
  );
});
