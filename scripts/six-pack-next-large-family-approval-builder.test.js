const test = require("node:test");
const assert = require("node:assert/strict");
const approval = require("../config/retailers/six-pack-reviewed-large-family-batch-v8.json");
const {
  flavourFor,
  parseArgs,
} = require("./six-pack-next-large-family-approval-builder");

test("next large family approval binds 34 non-food supplement offers", () => {
  assert.equal(
    approval.kind,
    "six-pack-reviewed-large-family-batch-v8"
  );
  assert.equal(approval.approved, true);
  assert.equal(approval.family_count, 8);
  assert.equal(approval.new_product_count, 8);
  assert.equal(approval.row_count, 34);
  assert.equal(
    approval.families.flatMap((family) => family.variants).length,
    34
  );
  assert.equal(approval.policy.food, "EXCLUDE");
  assert.equal(approval.policy.peptides, "EXCLUDE");
  assert.equal(approval.policy.sarms, "EXCLUDE");
  assert.equal(approval.policy.dated_products, "EXCLUDE");
  assert.equal(approval.policy.collagen_supplements, "ALLOW");
  assert.equal(approval.policy.one_shared_automation, true);
});

test("retailer flavour aliases remain explicit", () => {
  assert.deepEqual(
    flavourFor({
      source_record_id: "x",
      external_options: { FLAVOUR: "cookie cream" },
    }),
    {
      source_flavour: "cookie cream",
      flavour: "Cookies & Cream",
    }
  );
});

test("approval output is confined to tmp", () => {
  assert.throws(
    () => parseArgs(["--output=config/unsafe.json"]),
    /inside repository tmp/
  );
});
