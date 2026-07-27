const assert = require("node:assert/strict");
const test = require("node:test");
const { displaySize, parseArgs, syntheticVariant } = require("./six-pack-reviewed-family-builder");

test("reviewed family variants preserve approved flavour and normalized commercial size", () => {
  const variant = syntheticVariant({
    product_id: "126",
    flavour: "Strawberries & Cream",
    size: "5400",
    size_unit: "g",
    product_format: "powder",
  });
  assert.equal(variant.display_name, "Strawberries & Cream / 5.4kg");
  assert.equal(variant.size_value, "5400");
  assert.equal(displaySize("2000", "g"), "2kg");
});

test("reviewed family builder confines generated artifacts to tmp", () => {
  assert.throws(() => parseArgs(["--output=outside.csv"]), /inside repository tmp/);
});
