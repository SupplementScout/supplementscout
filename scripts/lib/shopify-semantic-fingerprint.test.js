const assert = require("node:assert/strict");
const test = require("node:test");
const { assertSemanticShopifySnapshot, classifyShopifySourceRowDrift, compareShopifySnapshots, semanticShopifySnapshot, shopifySnapshotFingerprints } = require("./shopify-snapshot-reader");

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
  assert.equal(comparison.status, "PASS");
  assert.equal(comparison.reason_code, null);
  assert.deepEqual(comparison.timestamp_drift, { product_count: 0, variant_count: 0, invalid_count: 0, transitions: [] });
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
  const classified = compareShopifySnapshots(before, after);
  assert.equal(classified.status, "PASS_WITH_TIMESTAMP_ONLY_DRIFT");
  assert.equal(classified.reason_code, "TIMESTAMP_ONLY_SOURCE_DRIFT");
  assert.equal(classified.timestamp_drift.product_count, 2);
  assert.equal(classified.timestamp_drift.variant_count, 3);
  assert.equal(classified.timestamp_drift.invalid_count, 0);
  assert.deepEqual(classified.timestamp_drift.transitions, [{
    bound: "2026-07-18T11:00:00Z", fresh: "2026-07-19T01:00:00Z", product_count: 1, variant_count: 1,
  }, {
    bound: "2026-07-18T10:00:00Z", fresh: "2026-07-19T01:00:00Z", product_count: 1, variant_count: 2,
  }]);
});

test("commercial, URL and identity changes fail the semantic guard", async (t) => {
  const scenarios = [
    ["price", (value) => { value.products[0].variants[0].price = "21.00"; }],
    ["compare-at price", (value) => { value.products[0].variants[0].compare_at_price = "25.00"; }],
    ["stock", (value) => { value.products[0].variants[0].available = true; }],
    ["title", (value) => { value.products[0].title = "Changed"; }],
    ["URL", (value) => { value.products[0].handle = "changed-handle"; }],
    ["product ID", (value) => { value.products[0].id = 21; }],
    ["variant ID", (value) => { value.products[0].variants[0].id = 203; }],
    ["SKU", (value) => { value.products[0].variants[0].sku = "CHANGED"; }],
    ["product options", (value) => { value.products[0].options = [{ name: "Size", position: 1 }]; }],
    ["additional variant field", (value) => { value.products[0].variants[0].requires_shipping = true; }],
    ["source collapse", (value) => { value.products.pop(); }],
    ["missing source record", (value) => { value.products[0].variants.pop(); }],
  ];
  for (const [name, mutate] of scenarios) await t.test(name, () => {
    const before = snapshot(), after = clone(before); mutate(after);
    assert.throws(() => assertSemanticShopifySnapshot(before, after), /Semantic Shopify source drift/);
    const classified = compareShopifySnapshots(before, after);
    assert.equal(classified.status, "BLOCKED_MATERIAL_SOURCE_DRIFT");
    assert.equal(classified.reason_code, "SEMANTIC_SOURCE_DRIFT");
  });
});

test("invalid timestamp changes remain blocked", () => {
  const before = snapshot(), after = clone(before); after.products[0].updated_at = "not-a-timestamp";
  const classified = compareShopifySnapshots(before, after);
  assert.equal(classified.status, "BLOCKED_MATERIAL_SOURCE_DRIFT");
  assert.equal(classified.reason_code, "INVALID_TIMESTAMP_DRIFT");
});

test("reviewed Shopify source rows allow only a valid source_updated_at change", () => {
  const before = { external_product_id: "10", external_variant_id: "101", price: "9.00", in_stock: true, source_updated_at: "2026-07-18T10:00:00Z" };
  assert.deepEqual(classifyShopifySourceRowDrift(before, clone(before)), { status: "PASS", reason_code: null, timestamp_drift: null });
  const timestampOnly = { ...before, source_updated_at: "2026-07-19T01:00:00Z" };
  assert.equal(classifyShopifySourceRowDrift(before, timestampOnly).status, "PASS_WITH_TIMESTAMP_ONLY_DRIFT");
  assert.equal(classifyShopifySourceRowDrift(before, timestampOnly).reason_code, "TIMESTAMP_ONLY_SOURCE_DRIFT");
  assert.equal(classifyShopifySourceRowDrift(before, { ...timestampOnly, price: "10.00" }).reason_code, "SOURCE_ROW_DRIFT");
  assert.equal(classifyShopifySourceRowDrift(before, { ...timestampOnly, external_variant_id: "102" }).reason_code, "SOURCE_ROW_DRIFT");
  assert.equal(classifyShopifySourceRowDrift(before, { ...before, source_updated_at: null }).reason_code, "INVALID_TIMESTAMP_DRIFT");
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
