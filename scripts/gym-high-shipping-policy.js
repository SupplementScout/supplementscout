const config = require("../config/retailers/gym-high-woocommerce.json");

const POLICY = Object.freeze({ ...config.shipping_policy });

function fail(message) { throw new Error(message); }

function shippingCostForPrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) fail("GYM HIGH shipping policy requires a positive price");
  return price >= POLICY.free_shipping_threshold_gbp ? 0 : POLICY.standard_shipping_cost_gbp;
}

function shippingCostTextForPrice(value) {
  const cost = shippingCostForPrice(value);
  return cost === 0 ? "0" : cost.toFixed(2);
}

module.exports = { POLICY, shippingCostForPrice, shippingCostTextForPrice };
