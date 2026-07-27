const assert = require("node:assert/strict");
const test = require("node:test");
const shippingRollout = require("../config/retailers/six-pack-production-shipping-v1.json");
const { build, parseArgs, shippingFor } = require("./six-pack-shipping-rollout-builder");

test("shipping builder binds all approved mappings to the confirmed delivery rule", () => {
  const result = build();
  assert.equal(result.rows.length, shippingRollout.row_count);
  assert.equal(result.rows.every((row) => row.shipping_known === "true"), true);
  assert.equal(result.rows.every((row) => row.shipping_cost === "4.99"), true);
});

test("shipping rule becomes free exactly at £99.99", () => {
  assert.equal(shippingFor("99.98"), "4.99");
  assert.equal(shippingFor("99.99"), "0.00");
  assert.throws(() => parseArgs(["--output=outside.csv"]), /inside repository tmp/);
});
