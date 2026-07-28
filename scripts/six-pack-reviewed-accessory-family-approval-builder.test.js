const assert = require("node:assert/strict");
const test = require("node:test");
const {
  parseArgs,
} = require("./six-pack-reviewed-accessory-family-approval-builder");

const approval = require("../config/retailers/six-pack-reviewed-large-family-batch-v13.json");

test("reviewed accessory decision binds exact 16-offer scope", () => {
  assert.equal(approval.family_count, 11);
  assert.equal(approval.new_product_count, 9);
  assert.equal(approval.row_count, 16);
  assert.equal(approval.source_candidate_count, 16);
  assert.equal(approval.source_aliases.length, 0);
  assert.equal(approval.policy.accessories, "ALLOW");
  assert.equal(
    new Set(
      approval.families.flatMap((family) =>
        family.variants.map((variant) => variant.external_variant_id)
      )
    ).size,
    16
  );
});

test("only exact audited products reuse existing catalogue identities", () => {
  const existing = approval.families.filter(
    (family) => family.kind === "EXISTING_CANONICAL_PRODUCT"
  );
  assert.deepEqual(
    existing.map((family) => family.product_id).sort(),
    ["82", "83"]
  );
  assert.ok(
    existing.every(
      (family) =>
        family.category === "Accessories" &&
        family.existing_match_evidence
    )
  );
});

test("unrelated deferred products remain deferred", () => {
  for (const key of [
    "melatonin_5mg",
    "nmn",
    "limitlesss_nootropic_brain_booster",
    "vitamin_d3_8000_iu",
  ]) {
    assert.equal(approval.policy[key], "DEFER");
  }
});

test("approval output remains inside tmp", () => {
  assert.throws(
    () => parseArgs(["--output=config/unsafe.json"]),
    /inside repository tmp/
  );
});
