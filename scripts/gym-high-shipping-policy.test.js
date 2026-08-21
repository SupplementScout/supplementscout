const assert = require("node:assert/strict");
const test = require("node:test");
const { POLICY, shippingCostForPrice, shippingCostTextForPrice } = require("./gym-high-shipping-policy");

test("GYM HIGH delivery is GBP 3.99 below GBP 50 and free from GBP 50", () => {
  assert.equal(POLICY.evidence, "OWNER_CONFIRMED_2026_08_21");
  assert.equal(shippingCostForPrice("49.99"), 3.99);
  assert.equal(shippingCostForPrice("50.00"), 0);
  assert.equal(shippingCostForPrice("69.99"), 0);
  assert.equal(shippingCostTextForPrice("23.99"), "3.99");
  assert.equal(shippingCostTextForPrice("55.99"), "0");
  assert.throws(() => shippingCostForPrice(""), /positive price/);
});
