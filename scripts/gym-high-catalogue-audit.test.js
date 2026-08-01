const assert = require("node:assert/strict");
const test = require("node:test");
const { buildCatalogueAudit, classification, mapLimit } = require("./gym-high-catalogue-audit");
const { loadScope } = require("./gym-high-source-monitor");

function catalogue(products) { return { captured_at: "2026-08-01T12:00:00.000Z", products }; }
function product(id, name, type, variations = [], categories = ["Protein Powder"]) { return { external_product_id: String(id), name, slug: `p-${id}`, type, permalink: `https://gymhigh.co.uk/product/p-${id}/`, sku: null, categories, variations }; }
function page(item) {
  return { external_product_id: item.external_product_id, canonical_url: item.permalink, product_name: item.name, product_offer: item.type === "simple" ? { price: "10.00", in_stock: true } : null, variations: item.variations.map((row) => ({ external_variant_id: row.external_variant_id, attributes: { attribute_pa_flavour: row.attributes.Flavour }, price: "20.00", regular_price: "20.00", in_stock: true, purchasable: true, active: true, sku: null })) };
}

test("full audit expands simple and variable products and classifies non-catalogue items", async () => {
  const approved = product(703, "GYM HIGH Vegan Plant-Based-Protein Blend", "variable", [{ external_variant_id: "704", attributes: { Flavour: "berry-bliss" } }, { external_variant_id: "705", attributes: { Flavour: "vanilla" } }]);
  const simple = product(632, "GYM HIGH CREA-4", "simple");
  const accessory = product(712, "GYM HIGH Wrist Wraps", "simple", [], ["Gym Accessories & Clothing"]);
  const gift = product(3449, "GYM HIGH Gift Cards", "variable", [{ external_variant_id: "3452", attributes: { Denominations: "£50" } }], ["GymHigh"]);
  const products = [approved, simple, accessory, gift];
  const scope = loadScope();
  scope.config.source.minimum_parent_products = 1;
  const report = await buildCatalogueAudit(scope, { readCatalogue: async () => catalogue(products), readPage: async ({ productId }) => page(products.find((row) => row.external_product_id === productId)) });
  assert.equal(report.parent_product_count, 4);
  assert.equal(report.source_row_count, 5);
  assert.equal(report.classification_counts.APPROVED_EXISTING_MAPPING, 1);
  assert.equal(report.classification_counts.REVIEW_SUPPLEMENT, 2);
  assert.equal(report.classification_counts.REVIEW_ACCESSORY, 1);
  assert.equal(report.classification_counts.EXCLUDE_GIFT_CARD, 1);
  assert.equal(report.production_writes, 0);
});

test("full audit blocks catalogue collapse and variation coverage drift", async () => {
  const scope = loadScope();
  await assert.rejects(() => buildCatalogueAudit(scope, { readCatalogue: async () => catalogue([]) }), /collapsed/);
  scope.config.source.minimum_parent_products = 1;
  const item = product(703, "GYM HIGH Vegan Plant-Based-Protein Blend", "variable", [{ external_variant_id: "704", attributes: { Flavour: "berry-bliss" } }]);
  await assert.rejects(() => buildCatalogueAudit(scope, { readCatalogue: async () => catalogue([item]), readPage: async () => ({ ...page(item), variations: [] }) }), /coverage drift/);
});

test("classification policy and bounded concurrency are deterministic", async () => {
  assert.equal(classification(product(1, "Gift Card", "simple")), "EXCLUDE_GIFT_CARD");
  assert.equal(classification(product(2, "Belt", "simple", [], ["Accessories"])), "REVIEW_ACCESSORY");
  let active = 0; let maximum = 0;
  const results = await mapLimit([1, 2, 3, 4, 5], 2, async (value) => { active += 1; maximum = Math.max(maximum, active); await new Promise((resolve) => setImmediate(resolve)); active -= 1; return value * 2; });
  assert.deepEqual(results, [2, 4, 6, 8, 10]);
  assert.equal(maximum, 2);
});
