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
const V8_CSV = path.join(ROOT, "config", "retailers", "six-pack-production-expansion-v8.csv");
const V8_ROLLOUT = path.join(ROOT, "config", "retailers", "six-pack-production-expansion-v8.json");
const V8_APPROVAL = require("../config/retailers/six-pack-reviewed-large-family-batch-v8.json");
const V9_CSV = path.join(ROOT, "config", "retailers", "six-pack-production-expansion-v9.csv");
const V9_ROLLOUT = path.join(ROOT, "config", "retailers", "six-pack-production-expansion-v9.json");
const V9_APPROVAL = require("../config/retailers/six-pack-reviewed-large-family-batch-v9.json");
const V10_CSV = path.join(ROOT, "config", "retailers", "six-pack-production-expansion-v10.csv");
const V10_ROLLOUT = path.join(ROOT, "config", "retailers", "six-pack-production-expansion-v10.json");
const V10_APPROVAL = require("../config/retailers/six-pack-reviewed-large-family-batch-v10.json");
const V11_CSV = path.join(ROOT, "config", "retailers", "six-pack-production-expansion-v11.csv");
const V11_ROLLOUT = path.join(ROOT, "config", "retailers", "six-pack-production-expansion-v11.json");
const V11_APPROVAL = require("../config/retailers/six-pack-reviewed-large-family-batch-v11.json");
const V12_CSV = path.join(ROOT, "config", "retailers", "six-pack-production-expansion-v12.csv");
const V12_ROLLOUT = path.join(ROOT, "config", "retailers", "six-pack-production-expansion-v12.json");
const V12_APPROVAL = require("../config/retailers/six-pack-reviewed-large-family-batch-v12.json");

function reportFromRollout(expected) {
  const resumedIds = new Set(
    expected.resumed_external_variant_ids || []
  );
  return {
    blockedRows: [],
    failedRows: [],
    plans: expected.expected_bindings.map((binding) => {
      const resumed = resumedIds.has(binding.external_variant_id);
      return {
      product: { action: "existing", id: binding.product_id },
      product_variant: binding.created_variant_identity
        ? { action: "create_variant", values: binding.created_variant_identity }
        : { action: "existing", id: binding.product_variant_id },
      retailer: { action: "existing", id: "11" },
      retailer_product: {
        action: resumed ? "noop" : "create",
        values: {
          external_product_id: binding.external_product_id,
          external_variant_id: binding.external_variant_id,
        },
      },
      offer: {
        action: resumed ? "noop" : "create",
        values: {
          price: binding.price,
          shipping_cost: binding.shipping_cost,
          total_price: binding.total_price,
          in_stock: binding.in_stock,
          url: binding.external_url,
        },
      },
      price_history: { action: resumed ? "noop" : "create" },
    };
    }),
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

test("large V8 rollout binds all 34 offers without aliases or variant creates", () => {
  const expected = JSON.parse(fs.readFileSync(V8_ROLLOUT, "utf8"));
  const rollout = build(
    fs.readFileSync(V8_CSV),
    reportFromRollout(expected),
    V8_APPROVAL,
    {
    kind: "six-pack-production-expansion-v8",
    csvPath: "config/retailers/six-pack-production-expansion-v8.csv",
    }
  );
  assert.deepEqual(rollout, expected);
  assert.equal(rollout.row_count, 34);
  assert.equal(rollout.approved_scope_row_count, 34);
  assert.deepEqual(rollout.covered_duplicate_aliases, []);
  assert.deepEqual(rollout.resumed_external_variant_ids, []);
  assert.equal(rollout.expected_created_variant_count, 0);
  assert.equal(rollout.expected_bindings.length, 34);
});

test("large V9 rollout binds all 36 counted supplement offers", () => {
  const expected = JSON.parse(fs.readFileSync(V9_ROLLOUT, "utf8"));
  const rollout = build(
    fs.readFileSync(V9_CSV),
    reportFromRollout(expected),
    V9_APPROVAL,
    {
      kind: "six-pack-production-expansion-v9",
      csvPath: "config/retailers/six-pack-production-expansion-v9.csv",
    }
  );
  assert.deepEqual(rollout, expected);
  assert.equal(rollout.row_count, 36);
  assert.equal(rollout.approved_scope_row_count, 36);
  assert.deepEqual(rollout.covered_duplicate_aliases, []);
  assert.deepEqual(rollout.resumed_external_variant_ids, []);
  assert.equal(rollout.expected_created_variant_count, 0);
});

test("large V10 rollout binds all 32 unambiguous powder offers", () => {
  const expected = JSON.parse(fs.readFileSync(V10_ROLLOUT, "utf8"));
  const rollout = build(
    fs.readFileSync(V10_CSV),
    reportFromRollout(expected),
    V10_APPROVAL,
    {
      kind: "six-pack-production-expansion-v10",
      csvPath: "config/retailers/six-pack-production-expansion-v10.csv",
    }
  );
  assert.deepEqual(rollout, expected);
  assert.equal(rollout.row_count, 32);
  assert.equal(rollout.approved_scope_row_count, 32);
  assert.deepEqual(rollout.covered_duplicate_aliases, []);
  assert.equal(rollout.expected_created_variant_count, 0);
});

test("large V11 rollout binds all 19 reviewed multi-page offers", () => {
  const expected = JSON.parse(fs.readFileSync(V11_ROLLOUT, "utf8"));
  const rollout = build(
    fs.readFileSync(V11_CSV),
    reportFromRollout(expected),
    V11_APPROVAL,
    {
      kind: "six-pack-production-expansion-v11",
      csvPath: "config/retailers/six-pack-production-expansion-v11.csv",
    }
  );
  assert.deepEqual(rollout, expected);
  assert.equal(rollout.row_count, 19);
  assert.equal(rollout.approved_scope_row_count, 19);
  assert.deepEqual(rollout.covered_duplicate_aliases, []);
  assert.equal(rollout.expected_created_variant_count, 0);
});

test("large V12 rollout binds 65 food offers and audits three aliases", () => {
  const expected = JSON.parse(fs.readFileSync(V12_ROLLOUT, "utf8"));
  const rollout = build(
    fs.readFileSync(V12_CSV),
    reportFromRollout(expected),
    V12_APPROVAL,
    {
      kind: "six-pack-production-expansion-v12",
      csvPath:
        "config/retailers/six-pack-production-expansion-v12.csv",
    }
  );
  assert.deepEqual(rollout, expected);
  assert.equal(rollout.row_count, 65);
  assert.equal(rollout.approved_scope_row_count, 68);
  assert.equal(rollout.reviewed_source_aliases.length, 3);
  assert.equal(rollout.expected_created_variant_count, 0);
});

test("family rollout output remains inside tmp", () => {
  assert.throws(
    () => parseArgs(["--output=config/retailers/unsafe.json"]),
    /inside repository tmp/
  );
});
