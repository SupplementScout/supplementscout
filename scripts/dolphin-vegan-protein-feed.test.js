const assert = require("node:assert/strict");
const test = require("node:test");
const { parseProductPage, readDolphinSnapshot } = require("./dolphin-vegan-protein-feed");

function html(overrides = {}) {
  const product = {
    "@type": "ProductGroup", productGroupID: "193943", hasVariant: [{
      "@type": "Product", sku: "193943-VANILLA",
      url: "https://www.dolphinfitness.co.uk/en/optimum-nutrition-gold-standard-100-percent-plant-684g/193943/vanilla",
      name: "Optimum Nutrition Gold Standard 100% Plant 684g Vanilla",
      offers: { price: "21.95", priceCurrency: "GBP", availability: "http://schema.org/InStock", seller: { name: "Dolphin Fitness" } },
      ...overrides,
    }],
  };
  return `<title>Optimum Nutrition Gold Standard 100% Plant 684g Vanilla</title><script type="application/ld+json">${JSON.stringify(product)}</script>`;
}

test("parses only the exact approved Dolphin variant", () => {
  const row = parseProductPage(html(), "2026-08-03T20:00:00.000Z");
  assert.equal(row.price, "21.95");
  assert.equal(row.in_stock, "true");
  assert.equal(row.product_id, "70");
  assert.equal(row.product_variant_id, "1623");
  assert.equal(row.retailer_product_id, "2676");
  assert.equal(row.offer_id, "2490");
});

test("fails closed on identity, currency and availability drift", () => {
  assert.throws(() => parseProductPage(html({ sku: "WRONG" })), /ProductGroup is missing|variant identity drift/);
  assert.throws(() => parseProductPage(html({ offers: { price: "21.95", priceCurrency: "USD", availability: "http://schema.org/InStock", seller: { name: "Dolphin Fitness" } } })), /identity drift/);
  assert.throws(() => parseProductPage(html({ offers: { price: "21.95", priceCurrency: "GBP", availability: "http://schema.org/PreOrder", seller: { name: "Dolphin Fitness" } } })), /availability is invalid/);
});

test("builds one deterministic exact-source snapshot without catalogue writes", async () => {
  const response = new Response(html(), { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  const snapshot = await readDolphinSnapshot({ fetchImpl: async () => response, capturedAt: "2026-08-04T08:00:00.000Z" });
  assert.equal(snapshot.products.length, 1);
  assert.equal(snapshot.products[0].variants.length, 1);
  assert.equal(snapshot.products[0].variants[0].id, "193943-VANILLA");
  assert.match(snapshot.semantic_source_fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(snapshot.source_diagnostic.pagination_completed, true);
});
