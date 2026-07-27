const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { build, parseArgs } = require("./six-pack-family-rollout-sealer");

const ROOT = path.resolve(__dirname, "..");
const CSV = path.join(
  ROOT,
  "config",
  "retailers",
  "six-pack-production-family-v3.csv"
);
const ROLLOUT = path.join(
  ROOT,
  "config",
  "retailers",
  "six-pack-production-family-v3.json"
);

test("family rollout sealer binds 21 rows and exactly 14 variant creates", () => {
  const expected = JSON.parse(fs.readFileSync(ROLLOUT, "utf8"));
  const report = {
    blockedRows: [],
    failedRows: [],
    plans: expected.expected_bindings.map((binding) => ({
      product: { action: "existing", id: binding.product_id },
      product_variant: binding.created_variant_identity
        ? {
            action: "create_variant",
            values: binding.created_variant_identity,
          }
        : {
            action: "existing",
            id: binding.product_variant_id,
          },
      retailer: { action: "existing", id: "11" },
      retailer_product: {
        action: "create",
        values: {
          external_product_id: binding.external_product_id,
          external_variant_id: binding.external_variant_id,
        },
      },
      offer: {
        action: "create",
        values: {
          price: binding.price,
          shipping_cost: binding.shipping_cost,
          total_price: binding.total_price,
          in_stock: binding.in_stock,
          url: binding.external_url,
        },
      },
      price_history: { action: "create" },
    })),
  };
  const rollout = build(
    fs.readFileSync(CSV),
    report
  );
  assert.deepEqual(rollout, expected);
  assert.equal(rollout.row_count, 21);
  assert.equal(rollout.expected_created_variant_count, 14);
  assert.equal(
    rollout.expected_bindings.filter(
      (row) => row.product_variant_id === null
    ).length,
    14
  );
  assert.equal(new Set(rollout.expected_external_variant_ids).size, 21);
});

test("family rollout output remains inside tmp", () => {
  assert.throws(
    () => parseArgs(["--output=config/retailers/unsafe.json"]),
    /inside repository tmp/
  );
});
