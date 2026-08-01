const assert = require("node:assert/strict");
const test = require("node:test");
const { UPGRADES, buildRow, controls, mappingState, optionEvidence, parseArgs } = require("./gym-high-legacy-identity-feed-builder");

test("legacy identity scope contains exactly 21 reviewed non-accessory upgrades", () => {
  assert.equal(UPGRADES.length, 21);
  assert.equal(new Set(UPGRADES.map((row) => row.mappingId)).size, 21);
  for (const blocked of [121, 122, 143, 549]) assert.equal(UPGRADES.some((row) => row.mappingId === blocked), false);
});
test("option and control evidence distinguishes standalone and optioned rows", () => {
  assert.equal(optionEvidence({ external_product_id: "632" }, { external_variant_id: "632" }), null);
  assert.deepEqual(optionEvidence({ external_product_id: "703", size_value: "600", size_unit: "g" }, { external_variant_id: "704", canonical_label: "Berry Bliss" }), { Flavour: "Berry Bliss", Size: "600g" });
  assert.equal(controls({ externalProductId: "632", externalVariantId: "632", mappingId: 1 }, { updated_at: "2026-01-01" }, {}).legacy_mapping_standalone, "true");
  assert.equal(controls({ externalProductId: "703", externalVariantId: "704", mappingId: 78 }, { updated_at: "2026-01-01" }, {}).legacy_mapping_optioned, "true");
});
test("identity row preserves existing commerce and old URL", () => {
  const row = buildRow({ spec: { mappingId: 78, externalProductId: "703", externalVariantId: "704" }, family: { external_product_id: "703", size_value: "600", size_unit: "g" }, reviewed: { external_variant_id: "704", canonical_label: "Berry Bliss" }, source: {}, product: { id: 390, name: "P", slug: "p", brand: "B", category: "C", image: "https://example.test/p.jpg", product_format: "powder" }, variant: { id: 1064, display_name: "Berry Bliss / 600g", flavour_label: "Berry Bliss", size_value: 600, size_unit: "g", pack_count: 1, product_format: "powder" }, mapping: { updated_at: "2026-01-01", external_url: "https://gymhigh.co.uk/?post_type=product&p=703" }, offer: { price: 21.99, shipping_cost: 3.99, in_stock: true, url: "https://gymhigh.co.uk/?post_type=product&p=703" }, capturedAt: "2026-08-01T00:00:00Z" });
  assert.equal(row.price, "21.99"); assert.equal(row.shipping_cost, "3.99"); assert.equal(row.in_stock, "true");
  assert.equal(row.external_url, "https://gymhigh.co.uk/?post_type=product&p=703");
  assert.equal(row.image, "https://example.test/p.jpg");
});
test("output is confined to tmp", () => {
  assert.match(parseArgs([]).output, /legacy-identity-upgrade\.csv$/);
  assert.throws(() => parseArgs(["--output=config/feed.csv"]), /inside repository tmp/);
});
test("mapping state is resumable but rejects partial drift", () => {
  const spec = { mappingId: 1, offerId: 1, productId: 1, externalProductId: "632", externalVariantId: "632", variantId: "559" };
  const family = { external_product_id: "632" }, reviewed = { external_variant_id: "632" };
  const offer = { retailer_id: 1, retailer_product_id: 1, product_id: 1, product_variant_id: 559 };
  const legacy = { id: 1, retailer_id: 1, product_id: 1, product_variant_id: 559, external_product_id: null, external_variant_id: null, external_sku: null, external_options: null };
  assert.equal(mappingState(spec, family, reviewed, legacy, offer), "LEGACY");
  const complete = { ...legacy, external_product_id: "632", external_variant_id: "632" };
  assert.equal(mappingState(spec, family, reviewed, complete, offer), "COMPLETE");
  assert.equal(mappingState(spec, family, reviewed, { ...complete, external_variant_id: "999" }, offer), "DRIFT");
});
