const test = require("node:test");
const assert = require("node:assert/strict");
const { buildManifest, parseArgs } = require("./six-pack-approved-manifest-builder");

const retailer = {
  id: 11,
  name: "6 Pack Supplements",
  slug: "6-pack-supplements",
  website: "https://6pack-supplements.co.uk"
};

test("builds a complete manifest and enforces shipping on both sides of threshold", () => {
  const manifest = buildManifest({
    retailer,
    mappings: [
      { id: 1, product_id: 10, product_variant_id: 11, external_product_id: "100", external_variant_id: "101" },
      { id: 2, product_id: 20, product_variant_id: 21, external_product_id: "200", external_variant_id: "201" }
    ],
    offers: [
      { id: 3, retailer_product_id: 1, product_id: 10, product_variant_id: 11, price: 20, shipping_cost: 4.99, total_price: 24.99 },
      { id: 4, retailer_product_id: 2, product_id: 20, product_variant_id: 21, price: 100, shipping_cost: 0, total_price: 100 }
    ]
  });
  assert.equal(manifest.approved_mapping_count, 2);
  assert.deepEqual(manifest.rows.map((row) => row.mapping_id), ["1", "2"]);
});

test("blocks incomplete offer scope and shipping drift", () => {
  assert.throws(() => buildManifest({ retailer, mappings: [{ id: 1 }], offers: [] }), /scope mismatch/);
  assert.throws(() => buildManifest({
    retailer,
    mappings: [{ id: 1, product_id: 10, product_variant_id: 11, external_product_id: "100", external_variant_id: "101" }],
    offers: [{ id: 3, retailer_product_id: 1, product_id: 10, product_variant_id: 11, price: 20, shipping_cost: 0, total_price: 20 }]
  }), /shipping drift/);
});

test("builder output is confined to tmp", () => {
  assert.match(parseArgs([]).output, /six-pack-approved-offer-manifest-expanded\.json$/);
  assert.throws(() => parseArgs(["--output=config/no.json"]), /inside repository tmp/);
});
