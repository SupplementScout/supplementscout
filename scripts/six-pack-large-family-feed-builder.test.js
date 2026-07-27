const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseArgs,
  productIdentityMatches,
} = require("./six-pack-large-family-feed-builder");

test("large family feed output is confined to tmp", () => {
  assert.match(parseArgs([]).output, /six-pack-large-family-77\.csv$/);
  assert.throws(
    () => parseArgs(["--output=config/no.csv"]),
    /inside repository tmp/
  );
});

test("new family product identity is exact", () => {
  const family = {
    kind: "NEW_CANONICAL_PRODUCT",
    name: "Product",
    slug: "product",
    brand: "Brand",
    category: "Whey Protein",
    product_format: "powder",
  };
  const product = {
    id: 1,
    ...family,
    is_active: true,
    merged_into_product_id: null,
  };
  assert.equal(productIdentityMatches(product, family), true);
  assert.equal(
    productIdentityMatches({ ...product, category: "Other" }, family),
    false
  );
});
