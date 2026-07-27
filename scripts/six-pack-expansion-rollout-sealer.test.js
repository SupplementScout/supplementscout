const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { parse } = require("csv-parse/sync");
const { build, parseArgs } = require("./six-pack-expansion-rollout-sealer");

test("seals the exact reviewed expansion dry-run", () => {
  const csv = fs.readFileSync("config/retailers/six-pack-production-expansion-v4.csv");
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  const report = {
    blockedRows: [],
    failedRows: [],
    plans: rows.map((row) => ({
      product: { action: "existing", id: Number(row.product_id) },
      product_variant: { action: "existing", id: Number(row.product_variant_id) },
      retailer: { action: "existing", id: 11 },
      retailer_product: {
        action: "create",
        values: {
          external_product_id: row.external_product_id,
          external_variant_id: row.external_variant_id
        }
      },
      offer: {
        action: "create",
        values: {
          price: Number(row.price),
          shipping_cost: Number(row.shipping_cost),
          total_price: Number(row.price) + Number(row.shipping_cost),
          in_stock: row.in_stock === "true",
          url: row.affiliate_url
        }
      },
      price_history: { action: "create" }
    }))
  };
  const rollout = build(csv, report);
  assert.equal(rollout.row_count, 35);
  assert.equal(rollout.expected_created_variant_count, 0);
  assert.equal(rollout.expected_bindings.length, 35);
  assert.match(rollout.rollout_fingerprint, /^[0-9a-f]{64}$/);
});

test("sealer output is confined to tmp", () => {
  assert.match(parseArgs([]).output, /six-pack-production-expansion-v4\.json$/);
  assert.throws(() => parseArgs(["--output=config/no.json"]), /inside repository tmp/);
});
