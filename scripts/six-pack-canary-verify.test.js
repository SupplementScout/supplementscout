const assert = require("node:assert/strict");
const test = require("node:test");
const { verifyState } = require("./six-pack-canary-verify");

function fixture() {
  const rollout = {
    retailer_slug: "6-pack-supplements",
    row_count: 1,
    expected_bindings: [{
      external_product_id: "10",
      external_variant_id: "11",
      product_id: "20",
      product_variant_id: "21",
      price: "9.99",
      in_stock: true,
      external_url: "https://6pack-supplements.co.uk/product/example/",
    }],
  };
  const retailer = { id: 30, name: "6 Pack Supplements", slug: "6-pack-supplements", website: "https://6pack-supplements.co.uk" };
  const mappings = [{ id: 40, retailer_id: 30, product_id: 20, product_variant_id: 21, external_product_id: "10", external_variant_id: "11", external_url: rollout.expected_bindings[0].external_url }];
  const offers = [{ id: 50, retailer_id: 30, retailer_product_id: 40, product_id: 20, product_variant_id: 21, price: 9.99, shipping_cost: null, total_price: null, in_stock: true, url: rollout.expected_bindings[0].external_url }];
  const idempotency = { blockedRows: [], failedRows: [], rowLevelOffers: [{}], plans: [{ retailer: { action: "existing" }, offer: { action: "noop" }, price_history: { action: "noop" } }] };
  return { rollout, retailer, mappings, offers, idempotency };
}

test("verifier binds each exact mapping and offer and requires an idempotent dry-run", () => {
  const input = fixture();
  assert.deepEqual(verifyState(input.rollout, input.retailer, input.mappings, input.offers, input.idempotency), {
    retailer_id: "30",
    mapping_count: 1,
    offer_count: 1,
    idempotent_plan_count: 1,
  });
  input.offers[0].price = 10.99;
  assert.throws(() => verifyState(input.rollout, input.retailer, input.mappings, input.offers, input.idempotency), /Offer verification/);
});

test("verifier accepts a newly allocated variant ID only when mapping and offer agree", () => {
  const input = fixture();
  input.rollout.expected_bindings[0].product_variant_id = null;
  assert.doesNotThrow(() =>
    verifyState(
      input.rollout,
      input.retailer,
      input.mappings,
      input.offers,
      input.idempotency
    )
  );
  input.offers[0].product_variant_id = 999;
  assert.throws(
    () =>
      verifyState(
        input.rollout,
        input.retailer,
        input.mappings,
        input.offers,
        input.idempotency
      ),
    /Offer verification/
  );
});
