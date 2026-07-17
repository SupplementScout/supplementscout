const assert = require("node:assert/strict");
const test = require("node:test");
const { buildCanonicalCatalogueSnapshot } = require("./canonical-snapshot");
const { validateCanonicalSnapshot } = require("./validators");
const { duplicates } = require("./source-snapshot");

test("canonical snapshot builds all read-only indexes and reports collisions", () => {
  const input = { products: [{ id: 1, name: "Brand Whey", slug: "brand-whey", brand: "Brand", product_format: "powder", is_active: true }, { id: 2, name: "Brand Whey", slug: "brand-whey", brand: "Brand", product_format: "powder", is_active: false }], product_variants: [{ id: 10, product_id: 1, variant_key: "berry-500g", flavour_label: "Berry", size_value: "500", size_unit: "g", pack_count: "1", is_active: true }], retailers: [{ id: 5, name: "Retailer" }], retailer_products: [{ id: 20, retailer_id: 5, product_id: 1, product_variant_id: 10, external_product_id: "100", external_variant_id: "101", external_sku: "SKU", external_url: "https://example.com/a" }], offers: [{ id: 30, retailer_product_id: 20, price: "10.00", url: "https://example.com/a" }] };
  const { snapshot, collisions } = buildCanonicalCatalogueSnapshot(input);
  assert.equal(validateCanonicalSnapshot(snapshot), true); assert.deepEqual(snapshot.indexes.external_variant_id["5|101"], ["20"]); assert.deepEqual(snapshot.inactive_records, ["2"]); assert.ok(collisions.product_slug);
  assert.equal(typeof snapshot.products[0].id, "string"); assert.equal(typeof snapshot.mappings[0].product_id, "string");
});
test("duplicate helper reports values without Number coercion", () => {
  const result = duplicates([{ source_record_id: "1", key: "9007199254740993" }, { source_record_id: "2", key: "9007199254740993" }], (row) => row.key);
  assert.deepEqual(result, [{ value: "9007199254740993", record_ids: ["1", "2"] }]);
});
