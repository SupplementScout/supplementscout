const assert = require("node:assert/strict");
const test = require("node:test");
const expected = require("../config/retailers/six-pack-reviewed-large-family-batch-v7.json");
const {
  build,
  parseArgs,
} = require("./six-pack-large-family-approval-builder");

test("large family approval is deterministic for the bound source snapshot", () => {
  const source = {
    snapshot_fingerprint: expected.source_snapshot_fingerprint,
    records: expected.families.flatMap((family) =>
      family.variants.map((variant) => ({
        source_record_id: variant.external_variant_id,
        external_product_id: family.external_product_id,
        external_variant_id: variant.external_variant_id,
        external_options: { Flavour: variant.source_flavour },
        in_stock: variant.in_stock,
        image_url: family.image || null,
        price: family.price || "1.00",
      }))
    ),
  };
  assert.deepEqual(build(source), expected);
  assert.equal(expected.row_count, 77);
  assert.equal(expected.new_product_count, 6);
});

test("large family approval output is confined to tmp", () => {
  assert.throws(
    () => parseArgs(["--output=config/retailers/unsafe.json"]),
    /inside repository tmp/
  );
});
