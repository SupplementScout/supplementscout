const assert = require("node:assert/strict");
const test = require("node:test");
const { assertSource, buildFeedRow, parseArgs, reviewedOptions } = require("./gym-high-full-catalogue-feed-builder");
const approval = require("../config/retailers/gym-high-reviewed-full-catalogue-2026-08-01.json");

test("full catalogue output is confined to tmp", () => {
  assert.match(parseArgs(["--source=tmp/source.json", "--output=tmp/gym-high/full.csv"]).output, /tmp[\\/]gym-high[\\/]full\.csv$/);
  assert.throws(() => parseArgs(["--output=outside.csv"]), /inside repository tmp/);
});

test("reviewed options preserve the approved commercial tuple", () => {
  assert.deepEqual(reviewedOptions({ external_product_id: "719" }, { external_variant_id: "720", canonical_label: "L" }), { Fit: "L" });
  assert.deepEqual(reviewedOptions({ external_product_id: "708" }, { external_variant_id: "709", canonical_label: "Black" }), { Colour: "Black" });
  assert.deepEqual(reviewedOptions({ external_product_id: "3955", size_value: "500", size_unit: "ml" }, { external_variant_id: "3957", canonical_label: "Orange" }), { Flavour: "Orange", Size: "500ml" });
  assert.equal(reviewedOptions({ external_product_id: "702" }, { external_variant_id: "702", canonical_label: null }), null);
});

test("source binding contains exactly 66 approved rows and five reviewed omissions", () => {
  const rows = approval.families.flatMap((family) => family.variants.map((variant) => ({ external_product_id: family.external_product_id, external_variant_id: variant.external_variant_id })));
  for (const key of [...approval.excluded_source_rows, ...approval.exception_source_rows]) {
    const [external_product_id, external_variant_id] = key.split(":");
    rows.push({ external_product_id, external_variant_id });
  }
  const source = { result: "PASS", production_writes: 0, source_row_count: 71, source_identity_fingerprint: approval.source_identity_fingerprint, captured_at: "2026-08-01T12:00:00.000Z", rows };
  assert.equal(assertSource(approval, source, new Date("2026-08-01T13:00:00.000Z")).size, 71);
});

test("all offers use the owner-confirmed threshold shipping policy", () => {
  const binding = { family: { external_product_id: "3955" }, reviewed: { external_variant_id: "3957", canonical_label: "Orange" }, product: { id: 527, name: "GYM HIGH L-Carnitine Liquid 500 ml", slug: "gym-high-l-carnitine-liquid-500-ml", brand: "GYM HIGH", category: "Amino Acids", product_format: "liquid", image: null }, variant: { id: 2711, display_name: "Orange / 500ml", flavour_label: "Orange", size_value: 500, size_unit: "ml", pack_count: 1, product_format: "liquid" } };
  const row = buildFeedRow(binding, { canonical_url: "https://gymhigh.co.uk/product/gym-high-l-carnitine-liquid/", price_gbp: "23.99", in_stock: true, sku: null }, null, null, "2026-08-01T12:00:00.000Z");
  assert.equal(row.shipping_known, "true");
  assert.equal(row.shipping_cost, "3.99");
  assert.equal(buildFeedRow(binding, { canonical_url: "https://gymhigh.co.uk/product/test/", price_gbp: "50.00", in_stock: true, sku: null }, null, null, "2026-08-01T12:00:00.000Z").shipping_cost, "0");
  assert.equal(row.product_id, "527");
  assert.equal(row.product_variant_id, "2711");
});
