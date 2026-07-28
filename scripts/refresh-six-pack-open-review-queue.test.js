const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const {
  ANIMAL_FLEX,
  confirmation,
  parseArgs,
  stableSource,
} = require("./refresh-six-pack-open-review-queue");

test("refresh is confined to a tmp artifact and exact production mode", () => {
  const parsed = parseArgs([
    "--input=tmp/review.json",
    "--mode=rehearse",
    "--target=production",
  ]);
  assert.equal(parsed.input, path.resolve("tmp/review.json"));
  assert.equal(parsed.mode, "rehearse");
  assert.throws(
    () =>
      parseArgs([
        "--input=review.json",
        "--mode=rehearse",
        "--target=production",
      ]),
    /inside tmp/
  );
});

test("Animal Flex correction is frozen to the reviewed existing target", () => {
  assert.deepEqual(ANIMAL_FLEX, {
    reviewItemId: 2,
    sourceRecordId: "3087",
    expectedDecision: "DEFER_POLICY",
    productId: 956,
    variantId: 1863,
  });
});

test("refresh confirmation and stable source identity are deterministic", () => {
  const artifact = { artifact_fingerprint: "a".repeat(64) };
  assert.match(confirmation(artifact), /^[0-9a-f]{16}$/);
  assert.deepEqual(
    stableSource({
      source_record_id: 1,
      retailer: "Retailer",
      product_title: "Product",
      variant_title: null,
      source_sku: null,
      source_gtin: null,
      source_weight: "44 packs",
      source_price: "49.9",
      source_url: "https://example.com",
    }),
    {
      source_record_id: "1",
      retailer: "Retailer",
      product_title: "Product",
      variant_title: "",
      source_sku: "",
      source_gtin: "",
      source_weight: "44 packs",
      source_price: "49.90",
      source_url: "https://example.com",
    }
  );
});
