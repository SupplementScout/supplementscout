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
const V6_CSV = path.join(ROOT, "config", "retailers", "six-pack-production-family-v6-bootstrap.csv");
const V6_ROLLOUT = path.join(ROOT, "config", "retailers", "six-pack-production-family-v6-bootstrap.json");
const V6_APPROVAL = require("../config/retailers/six-pack-reviewed-family-map-batch-v4.json");
const V6_FINAL_CSV = path.join(ROOT, "config", "retailers", "six-pack-production-expansion-v6.csv");
const V6_FINAL_ROLLOUT = path.join(ROOT, "config", "retailers", "six-pack-production-expansion-v6.json");
const V6_FINAL_APPROVAL = require("../config/retailers/six-pack-reviewed-family-map-batch-v5.json");
const V7_CSV = path.join(ROOT, "config", "retailers", "six-pack-production-expansion-v7.csv");
const V7_ROLLOUT = path.join(ROOT, "config", "retailers", "six-pack-production-expansion-v7.json");
const V7_APPROVAL = require("../config/retailers/six-pack-reviewed-large-family-batch-v7.json");

function reportFromRollout(expected) {
  return {
    blockedRows: [],
    failedRows: [],
    plans: expected.expected_bindings.map((binding) => ({
      product: { action: "existing", id: binding.product_id },
      product_variant: binding.created_variant_identity
        ? { action: "create_variant", values: binding.created_variant_identity }
        : { action: "existing", id: binding.product_variant_id },
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
}

test("family rollout sealer binds 21 rows and exactly 14 variant creates", () => {
  const expected = JSON.parse(fs.readFileSync(ROLLOUT, "utf8"));
  const report = reportFromRollout(expected);
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

test("family rollout sealer binds the reviewed V6 family batch without a new adapter", () => {
  const expected = JSON.parse(fs.readFileSync(V6_ROLLOUT, "utf8"));
  const rollout = build(
    fs.readFileSync(V6_CSV),
    reportFromRollout(expected),
    V6_APPROVAL,
    {
      kind: "six-pack-production-family-v6-bootstrap",
      csvPath: "config/retailers/six-pack-production-family-v6-bootstrap.csv",
    }
  );
  assert.deepEqual(rollout, expected);
  assert.equal(rollout.row_count, 19);
  assert.equal(rollout.expected_created_variant_count, 5);
});

test("family rollout sealer binds all 19 V6 offers to explicit variants", () => {
  const expected = JSON.parse(fs.readFileSync(V6_FINAL_ROLLOUT, "utf8"));
  const rollout = build(
    fs.readFileSync(V6_FINAL_CSV),
    reportFromRollout(expected),
    V6_FINAL_APPROVAL,
    {
      kind: "six-pack-production-expansion-v6",
      csvPath: "config/retailers/six-pack-production-expansion-v6.csv",
    }
  );
  assert.deepEqual(rollout, expected);
  assert.equal(rollout.expected_created_variant_count, 0);
  assert.equal(rollout.expected_bindings.every((row) => row.product_variant_id), true);
});

test("large V7 rollout binds 75 new offers and audits two covered aliases", () => {
  const expected = JSON.parse(fs.readFileSync(V7_ROLLOUT, "utf8"));
  const rollout = build(
    fs.readFileSync(V7_CSV),
    reportFromRollout(expected),
    V7_APPROVAL,
    {
      kind: "six-pack-production-expansion-v7",
      csvPath: "config/retailers/six-pack-production-expansion-v7.csv",
    }
  );
  assert.deepEqual(rollout, expected);
  assert.equal(rollout.row_count, 75);
  assert.equal(rollout.approved_scope_row_count, 77);
  assert.equal(rollout.covered_duplicate_aliases.length, 2);
  assert.equal(rollout.expected_created_variant_count, 0);
});

test("family rollout output remains inside tmp", () => {
  assert.throws(
    () => parseArgs(["--output=config/retailers/unsafe.json"]),
    /inside repository tmp/
  );
});
