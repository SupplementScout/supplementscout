const assert = require("node:assert/strict");
const test = require("node:test");
const { readWooCommerceStoreCatalogue } = require("./woocommerce-store-api-reader");

function response(body, headers = {}) {
  return { status: 200, headers: { get: (name) => ({ "content-type": "application/json", "x-wp-total": "2", "x-wp-totalpages": "1", ...headers })[name.toLowerCase()] || null }, text: async () => JSON.stringify(body) };
}

const simple = { id: 10, name: "Simple", slug: "simple", type: "simple", permalink: "https://gymhigh.co.uk/product/simple/", sku: "", prices: { currency_code: "GBP", currency_minor_unit: 2 }, categories: [], variations: [] };
const variable = { id: 20, name: "Variable", slug: "variable", type: "variable", permalink: "https://gymhigh.co.uk/product/variable/", sku: "", prices: { currency_code: "GBP", currency_minor_unit: 2 }, categories: [{ name: "Protein &amp; Powder" }], variations: [{ id: 21, attributes: [{ name: "Flavour", value: "berry" }] }] };

test("reads a complete bounded WooCommerce Store API catalogue", async () => {
  const result = await readWooCommerceStoreCatalogue({ storeUrl: "https://gymhigh.co.uk", fetchImpl: async () => response([simple, variable]) });
  assert.equal(result.declared_total, 2);
  assert.equal(result.products[1].variations[0].external_variant_id, "21");
  assert.deepEqual(result.products[1].categories, ["Protein & Powder"]);
});

test("blocks an oversized Store API page", async () => {
  await assert.rejects(() => readWooCommerceStoreCatalogue({ storeUrl: "https://gymhigh.co.uk", maximumBytesPerPage: 10, fetchImpl: async () => response([simple, variable]) }), /byte limit/);
});

test("fails closed on count, identity, currency and host drift", async () => {
  const cases = [
    { rows: [simple], headers: {}, reason: /count/ },
    { rows: [simple, { ...variable, permalink: "https://evil.example/product/variable/" }], headers: {}, reason: /origin/ },
    { rows: [simple, { ...variable, prices: { currency_code: "USD", currency_minor_unit: 2 } }], headers: {}, reason: /GBP/ },
    { rows: [simple, { ...variable, variations: [] }], headers: {}, reason: /no variations/ }
  ];
  for (const item of cases) await assert.rejects(() => readWooCommerceStoreCatalogue({ storeUrl: "https://gymhigh.co.uk", fetchImpl: async () => response(item.rows, item.headers) }), item.reason);
});
