const assert = require("node:assert/strict");
const test = require("node:test");

const {
  coverageCounts,
  isPublicOffer,
} = require("./audit-market-coverage");

function offer(overrides = {}) {
  return {
    id: overrides.id || "offer-1",
    product_id: overrides.product_id || "product-1",
    retailer_id: overrides.retailer_id || "retailer-1",
    product_variant_id: overrides.product_variant_id || "variant-1",
    in_stock: overrides.in_stock ?? true,
    price: overrides.price ?? 20,
    shipping_cost: overrides.shipping_cost ?? 0,
  };
}

test("one retailer with two variants has raw offer count 2 and coverage 1", () => {
  const result = coverageCounts([
    offer({ id: "offer-1", product_variant_id: "variant-1" }),
    offer({ id: "offer-2", product_variant_id: "variant-2" }),
  ]);
  assert.deepEqual(result, {
    active_offer_count: 2,
    active_retailer_count: 1,
    has_2_plus_retailers: false,
    has_3_plus_retailers: false,
  });
});

test("two retailers with multiple variants have coverage 2", () => {
  const result = coverageCounts([
    offer({ id: "offer-1", retailer_id: "retailer-1", product_variant_id: "variant-1" }),
    offer({ id: "offer-2", retailer_id: "retailer-1", product_variant_id: "variant-2" }),
    offer({ id: "offer-3", retailer_id: "retailer-2", product_variant_id: "variant-1" }),
    offer({ id: "offer-4", retailer_id: "retailer-2", product_variant_id: "variant-2" }),
  ]);
  assert.equal(result.active_offer_count, 4);
  assert.equal(result.active_retailer_count, 2);
  assert.equal(result.has_2_plus_retailers, true);
  assert.equal(result.has_3_plus_retailers, false);
});

test("three distinct retailers have coverage 3", () => {
  const result = coverageCounts([
    offer({ id: "offer-1", retailer_id: "retailer-1" }),
    offer({ id: "offer-2", retailer_id: "retailer-2" }),
    offer({ id: "offer-3", retailer_id: "retailer-3" }),
  ]);
  assert.equal(result.active_offer_count, 3);
  assert.equal(result.active_retailer_count, 3);
  assert.equal(result.has_2_plus_retailers, true);
  assert.equal(result.has_3_plus_retailers, true);
});

test("out-of-stock variants and offers for inactive products do not increase coverage", () => {
  const activeProductIds = new Set(["product-1"]);
  const rows = [
    offer({ id: "offer-1", product_id: "product-1", retailer_id: "retailer-1" }),
    offer({ id: "offer-2", product_id: "product-1", retailer_id: "retailer-2", in_stock: false }),
    offer({ id: "offer-3", product_id: "inactive-product", retailer_id: "retailer-3" }),
  ];
  const visible = rows.filter((row) => isPublicOffer(row, activeProductIds));
  const result = coverageCounts(visible);
  assert.equal(result.active_offer_count, 1);
  assert.equal(result.active_retailer_count, 1);
  assert.equal(result.has_2_plus_retailers, false);
});
