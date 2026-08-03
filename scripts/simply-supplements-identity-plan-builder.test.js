const assert = require("node:assert/strict");
const test = require("node:test");
const { buildRow, parseArgs, stateKind } = require("./simply-supplements-identity-plan-builder");

test("identity plan builder requires an exact target and tmp paths", () => {
  assert.equal(parseArgs(["--target=staging"]).target, "staging");
  assert.throws(() => parseArgs([]), /target/);
  assert.throws(() => parseArgs(["--target=other"]), /target/);
  assert.throws(() => parseArgs(["--target=staging", "--output=../outside"]), /inside tmp/);
});

test("identity state distinguishes legacy, complete and drift", () => {
  const approved = { external_product_id: "10", external_variant_id: "20", external_sku: "SKU" };
  assert.equal(stateKind({ external_product_id: null, external_variant_id: null, external_sku: null }, approved), "LEGACY");
  assert.equal(stateKind({ external_product_id: "10", external_variant_id: "20", external_sku: "SKU" }, approved), "COMPLETE");
  assert.equal(stateKind({ external_product_id: "10", external_variant_id: "21", external_sku: "SKU" }, approved), "DRIFT");
});

test("identity row preserves URLs and offer values while opting into the narrow path", () => {
  const row = buildRow({
    identityRow: { approved_identity: { external_product_id: "10", external_variant_id: "20", external_sku: "SKU", external_options: { Size: "120 Capsules", Subscription: "[Multibuy 1]" } } },
    mapping: { id: 1, external_url: "https://direct.example/p", external_gtin: null, updated_at: "2026-08-03T00:00:00Z" },
    offer: { url: "https://awin.example/p", price: "9.99", shipping_cost: null, in_stock: true },
    product: { id: 2, name: "Product", slug: "product", brand: "Brand", category: "Vitamins", image: null, product_format: "capsule" },
    variant: { id: 3, display_name: "Default", size_value: null, size_unit: null, flavour_label: null, pack_count: 1, product_format: "capsule" },
    retailer: { name: "Simply Supplements", website: "https://www.simplysupplements.co.uk" },
  });
  assert.equal(row.external_url, "https://direct.example/p");
  assert.equal(row.affiliate_url, "https://awin.example/p");
  assert.equal(row.legacy_mapping_identity_only, "true");
  assert.equal(row.external_options, JSON.stringify({ Size: "120 Capsules", Subscription: "[Multibuy 1]" }));
  assert.equal(row.shipping_known, "false");
});
