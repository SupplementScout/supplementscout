const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeMarketCountry, projectShopifyVariants, readShopifySnapshot } = require("./shopify-snapshot-reader");

function response(body, { status = 200, contentType = "application/json; charset=utf-8" } = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    redirected: false,
    url: "https://example.myshopify.com/products.json",
    headers: { get: (name) => name.toLowerCase() === "content-type" ? contentType : name.toLowerCase() === "content-length" ? String(Buffer.byteLength(text)) : null },
    text: async () => text,
  };
}

test("reads all Shopify pages and seals a deterministic manifest", async () => {
  const payloads = [[{ id: 1, variants: [{ id: 11 }] }, { id: 2, variants: [{ id: 22 }] }], [{ id: 3, variants: [{ id: 33 }] }]];
  const fetchImpl = async (url) => response({ products: payloads[Number(url.searchParams.get("page")) - 1] });
  const result = await readShopifySnapshot({ storeUrl: "https://example.myshopify.com", fetchImpl, pageLimit: 2, capturedAt: "2026-07-18T12:00:00.000Z" });
  assert.equal(result.products.length, 3); assert.equal(result.pages.length, 2); assert.match(result.snapshot_sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.snapshot_sha256, result.raw_source_fingerprint); assert.match(result.semantic_source_fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(result.source_diagnostic.pagination_completed, true); assert.equal(result.source_diagnostic.pages_fetched, 2);
  assert.equal(result.source_diagnostic.final_http_status, 200); assert.match(result.source_diagnostic.final_content_type, /application\/json/);
  assert.deepEqual(projectShopifyVariants({ products: [{ id: 1, handle: "p", variants: [{ id: 2, price: "9.99", available: true }] }] }, { shippingCost: "3.99" })[0], { external_product_id: "1", external_variant_id: "2", product_handle: "p", external_sku: null, price: "9.99", shipping_cost: "3.99", in_stock: true, source_updated_at: null });
});

test("optionally requests a single explicit Shopify market country", async () => {
  const urls = [];
  const fetchImpl = async (url, options) => {
    urls.push({ url: new URL(url.href), headers: options.headers });
    return response({ products: [] });
  };
  const result = await readShopifySnapshot({ storeUrl: "https://example.myshopify.com", fetchImpl, marketCountry: "gb", noCache: true, capturedAt: "2026-07-18T12:00:00.000Z" });
  assert.equal(result.market_country, "GB");
  assert.equal(urls.length, 1);
  assert.equal(urls[0].url.searchParams.getAll("country").length, 1);
  assert.equal(urls[0].url.searchParams.get("country"), "GB");
  assert.equal(urls[0].url.searchParams.get("limit"), "250");
  assert.equal(urls[0].url.searchParams.get("page"), "1");
  assert.equal(urls[0].url.searchParams.has("_ss_no_cache"), true);
  assert.equal(urls[0].headers["cache-control"], "no-cache");
  assert.equal(urls[0].headers["user-agent"], "SupplementScout-Retailer-Refresh/1.0");
  assert.equal(normalizeMarketCountry("gb"), "GB");
  assert.throws(() => normalizeMarketCountry("gbr"), /two-letter ISO/);
});

test("rejects non-200, HTML, malformed or truncated JSON and pagination overflow with source codes", async () => {
  await assert.rejects(readShopifySnapshot({ storeUrl: "http://bad.test", fetchImpl() {} }), /HTTPS/);
  await assert.rejects(readShopifySnapshot({ storeUrl: "https://x.test", maximumAttempts: 1, fetchImpl: async () => response({}, { status: 503 }) }), (error) => error.code === "SOURCE_UNAVAILABLE" && /503/.test(error.message));
  await assert.rejects(readShopifySnapshot({ storeUrl: "https://x.test", fetchImpl: async () => response("<html>challenge</html>", { contentType: "text/html" }) }), (error) => error.code === "SOURCE_INVALID_RESPONSE" && /non-JSON/.test(error.message));
  await assert.rejects(readShopifySnapshot({ storeUrl: "https://x.test", fetchImpl: async () => response('{"products":[', { contentType: "application/json" }) }), (error) => error.code === "SOURCE_INVALID_RESPONSE" && /truncated/.test(error.message));
  await assert.rejects(readShopifySnapshot({ storeUrl: "https://x.test", fetchImpl: async () => response({ nope: [] }) }), (error) => error.code === "SOURCE_INVALID_RESPONSE" && /Malformed/.test(error.message));
  await assert.rejects(readShopifySnapshot({ storeUrl: "https://x.test", maximumPageBytes: 2, fetchImpl: async () => response({ products: [] }) }), /byte limit/);
  await assert.rejects(readShopifySnapshot({ storeUrl: "https://x.test", pageLimit: 2, fetchImpl: async () => response({ products: [{ id: 1, variants: [{ id: 1 }] }, { id: 2, variants: [{ id: 2 }] }] }), maximumPages: 1 }), (error) => error.code === "SOURCE_INCOMPLETE" && /maximum/.test(error.message));
});

test("bounded retry recovers from one transient source failure and records it", async () => {
  let calls = 0;
  const result = await readShopifySnapshot({
    storeUrl: "https://x.test",
    retryBaseDelayMs: 0,
    sleepImpl: async () => {},
    fetchImpl: async () => ++calls === 1 ? response({}, { status: 503 }) : response({ products: [{ id: 1, variants: [{ id: 2 }] }] }),
  });
  assert.equal(calls, 2);
  assert.equal(result.products.length, 1);
  assert.equal(result.source_diagnostic.retry_count, 1);
  assert.deepEqual(result.source_diagnostic.pages.map((page) => page.result), ["HTTP_ERROR", "PASS"]);
});
