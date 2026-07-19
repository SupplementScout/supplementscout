const assert = require("node:assert/strict");
const test = require("node:test");
const { assertSemanticShopifySnapshot, compareShopifySnapshots, semanticShopifySnapshot, shopifySnapshotFingerprints } = require("./shopify-snapshot-reader");

function snapshot() {
  return {
    captured_at: "2026-07-18T12:00:00.000Z",
    store_origin: "https://example.myshopify.com",
    pages: [{ page: 1, count: 2, sha256: "a".repeat(64) }],
    products: [
      { id: 20, handle: "second", title: "Second", updated_at: "2026-07-18T11:00:00Z", variants: [{ id: 202, sku: "SKU-202", price: "20.00", available: false, updated_at: "2026-07-18T11:00:00Z" }] },
      { id: 10, handle: "first", title: "First", updated_at: "2026-07-18T10:00:00Z", variants: [{ id: 102, sku: "SKU-102", price: "10.00", available: true, updated_at: "2026-07-18T10:00:00Z" }, { id: 101, sku: "SKU-101", price: "9.00", available: true, updated_at: "2026-07-18T10:00:00Z" }] },
    ],
  };
}
const clone = (value) => structuredClone(value);

test("identical Shopify data has identical raw and semantic fingerprints", () => {
  const comparison = compareShopifySnapshots(snapshot(), snapshot());
  assert.equal(comparison.raw_match, true); assert.equal(comparison.semantic_match, true); assert.equal(comparison.non_semantic_raw_drift, false);
});

test("product updated_at-only drift is non-semantic and remains in raw audit", () => {
  const before = snapshot(), after = clone(before); after.products[0].updated_at = "2026-07-19T01:00:00Z";
  const comparison = assertSemanticShopifySnapshot(before, after);
  assert.equal(comparison.raw_match, false); assert.equal(comparison.semantic_match, true); assert.equal(comparison.non_semantic_raw_drift, true);
  assert.equal(after.products[0].updated_at, "2026-07-19T01:00:00Z"); assert.equal("updated_at" in semanticShopifySnapshot(after).products[1], false);
});

test("variant updated_at-only drift is non-semantic", () => {
  const before = snapshot(), after = clone(before); after.products[0].variants[0].updated_at = "2026-07-19T01:00:00Z";
  assert.equal(assertSemanticShopifySnapshot(before, after).non_semantic_raw_drift, true);
});

test("combined product and variant updated_at-only drift is non-semantic", () => {
  const before = snapshot(), after = clone(before); after.products.forEach((product) => { product.updated_at = "2026-07-19T01:00:00Z"; product.variants.forEach((variant) => { variant.updated_at = "2026-07-19T01:00:00Z"; }); });
  const comparison = assertSemanticShopifySnapshot(before, after); assert.equal(comparison.raw_match, false); assert.equal(comparison.semantic_match, true);
});

test("commercial, URL and identity changes fail the semantic guard", async (t) => {
  const scenarios = [
    ["price", (value) => { value.products[0].variants[0].price = "21.00"; }],
    ["stock", (value) => { value.products[0].variants[0].available = true; }],
    ["URL", (value) => { value.products[0].handle = "changed-handle"; }],
    ["product ID", (value) => { value.products[0].id = 21; }],
    ["variant ID", (value) => { value.products[0].variants[0].id = 203; }],
    ["SKU", (value) => { value.products[0].variants[0].sku = "CHANGED"; }],
    ["source collapse", (value) => { value.products.pop(); }],
    ["missing source record", (value) => { value.products[0].variants.pop(); }],
  ];
  for (const [name, mutate] of scenarios) await t.test(name, () => { const before = snapshot(), after = clone(before); mutate(after); assert.throws(() => assertSemanticShopifySnapshot(before, after), /Semantic Shopify source drift/); });
});

test("product and variant reordering preserves the deterministic semantic result", () => {
  const before = snapshot(), after = clone(before); after.products.reverse(); after.products.forEach((product) => product.variants.reverse());
  const comparison = compareShopifySnapshots(before, after); assert.equal(comparison.raw_match, false); assert.equal(comparison.semantic_match, true);
  assert.equal(shopifySnapshotFingerprints(before).semantic_source_fingerprint, shopifySnapshotFingerprints(after).semantic_source_fingerprint);
});

test("semantic projection rejects duplicate identities even across products", () => {
  const duplicateProduct = snapshot(); duplicateProduct.products[1].id = duplicateProduct.products[0].id;
  assert.throws(() => semanticShopifySnapshot(duplicateProduct), /duplicate product ID/);
  const duplicateVariant = snapshot(); duplicateVariant.products[1].variants[0].id = duplicateVariant.products[0].variants[0].id;
  assert.throws(() => semanticShopifySnapshot(duplicateVariant), /duplicate variant ID/);
});
