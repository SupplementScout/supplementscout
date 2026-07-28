const assert = require("node:assert/strict");
const test = require("node:test");
const {
  parseArgs,
} = require("./six-pack-reviewed-food-family-approval-builder");

const approval = require("../config/retailers/six-pack-reviewed-large-family-batch-v12.json");

test("reviewed food decision builds 65 offers and three aliases", () => {
  assert.equal(approval.family_count, 15);
  assert.equal(approval.new_product_count, 12);
  assert.equal(approval.row_count, 65);
  assert.equal(approval.source_candidate_count, 68);
  assert.equal(approval.source_aliases.length, 3);
  assert.equal(
    new Set(
      approval.families.flatMap((family) =>
        family.variants.map((variant) => variant.external_variant_id)
      )
    ).size,
    65
  );
});

test("reviewed bar packs retain distinct source identities", () => {
  const warrior = approval.families.find(
    (family) => family.name === "Warrior Crunch Protein Bar 64g"
  );
  assert.equal(warrior.variants.length, 15);
  assert.equal(
    warrior.variants.filter((variant) => variant.pack_count === 12)
      .length,
    7
  );
  assert.equal(
    warrior.variants.filter((variant) => !variant.pack_count).length,
    8
  );
});

test("approval output remains inside tmp", () => {
  assert.throws(
    () => parseArgs(["--output=config/unsafe.json"]),
    /inside repository tmp/
  );
});
