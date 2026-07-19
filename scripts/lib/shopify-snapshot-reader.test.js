const assert = require("node:assert/strict");
const test = require("node:test");
const { projectShopifyVariants, readShopifySnapshot } = require("./shopify-snapshot-reader");

test("reads all Shopify pages and seals a deterministic manifest", async () => {
  const payloads = [[{ id: 1, variants: [{ id: 11 }] }, { id: 2, variants: [{ id: 22 }] }], [{ id: 3, variants: [{ id: 33 }] }]];
  const fetchImpl = async (url) => ({ ok: true, json: async () => ({ products: payloads[Number(url.searchParams.get("page")) - 1] }) });
  const result = await readShopifySnapshot({ storeUrl: "https://example.myshopify.com", fetchImpl, pageLimit: 2, capturedAt: "2026-07-18T12:00:00.000Z" });
  assert.equal(result.products.length, 3); assert.equal(result.pages.length, 2); assert.match(result.snapshot_sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.snapshot_sha256, result.raw_source_fingerprint); assert.match(result.semantic_source_fingerprint, /^[0-9a-f]{64}$/);
  assert.deepEqual(projectShopifyVariants({ products: [{ id: 1, handle: "p", variants: [{ id: 2, price: "9.99", available: true }] }] }, { shippingCost: "3.99" })[0], { external_product_id: "1", external_variant_id: "2", product_handle: "p", external_sku: null, price: "9.99", shipping_cost: "3.99", in_stock: true, source_updated_at: null });
});
test("rejects errors, malformed payloads, duplicate variants and pagination overflow", async () => {
  await assert.rejects(readShopifySnapshot({ storeUrl: "http://bad.test", fetchImpl() {} }), /HTTPS/);
  await assert.rejects(readShopifySnapshot({ storeUrl: "https://x.test", fetchImpl: async () => ({ ok: false, status: 503 }) }), /503/);
  await assert.rejects(readShopifySnapshot({ storeUrl: "https://x.test", fetchImpl: async () => ({ ok: true, json: async () => ({ nope: [] }) }) }), /Malformed/);
  await assert.rejects(readShopifySnapshot({ storeUrl: "https://x.test", maximumPageBytes: 2, fetchImpl: async () => ({ ok: true, text: async () => "{}" }) }), /Malformed|byte limit/);
  await assert.rejects(readShopifySnapshot({ storeUrl: "https://x.test", pageLimit: 2, fetchImpl: async () => ({ ok: true, json: async () => ({ products: [{ variants: [{ id: 1 }] }, { variants: [{ id: 1 }] }] }) }), maximumPages: 1 }), /maximum/);
});
