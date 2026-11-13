const assert = require("node:assert/strict");
const test = require("node:test");
const { getSafeCreateExclusionReasons } = require("./lib/feed-variant-guards");
const { createStateClient } = require("./lib/reviewed-catalogue-state");
const { runImportRows, setSupabaseForTests } = require("./import-products");

const exact = { exactExistingProductVariant: true, canonicalCategory: "Whey Protein" };
function protein(overrides = {}) {
  return {
    product_name: "Example Whey Protein Vanilla Ice Cream 780g",
    category: "Whey Protein", product_format: "powder", size: "780g",
    ...overrides,
  };
}

test("existing protein powders recognise cream flavour phrases without changing their names", () => {
  for (const flavour of ["Vanilla Ice Cream", "Cookies & Cream", "Cookies N' Cream",
    "Strawberries and Cream", "Raspberry & Cream", "Peaches & Cream", "Custard Cream",
    "Banana Cream", "Chocolate Cream"]) {
    const row = protein({ product_name: `Example Protein ${flavour} 780g` });
    const original = JSON.stringify(row);
    assert.deepEqual(getSafeCreateExclusionReasons(row, exact), [], flavour);
    assert.equal(JSON.stringify(row), original);
  }
  assert.deepEqual(getSafeCreateExclusionReasons(protein({ product_name: "Example Protein Powder 780g",
    external_name: "Example Protein Vanilla Ice Cream 780g",
    description: "Cookies & Cream flavour protein powder." }), exact), []);
});

test("cream flavour recognition does not widen category, format or unknown cream identity", () => {
  assert.deepEqual(getSafeCreateExclusionReasons(protein()), ["category is not allowed for safe-create"]);
  assert.deepEqual(getSafeCreateExclusionReasons(protein({ category: "whey protein" }), exact),
    ["category is not allowed for safe-create"]);
  assert.deepEqual(getSafeCreateExclusionReasons(protein({ product_format: "liquid" }), exact),
    ["excluded product type"]);
  assert.deepEqual(getSafeCreateExclusionReasons(protein({ product_name: "Example Protein Cream 780g" }), exact),
    ["excluded product type"]);
  assert.deepEqual(getSafeCreateExclusionReasons(protein({ product_name: "Example Ice Cream 780g" }), exact),
    ["excluded product type"]);
  assert.deepEqual(getSafeCreateExclusionReasons(protein({ category: "Skincare" }), exact),
    ["category is not allowed for safe-create"]);
  assert.deepEqual(getSafeCreateExclusionReasons(protein({ category: "Protein Bars", product_format: "bar" }), exact),
    ["category is not allowed for safe-create"]);
  assert.deepEqual(getSafeCreateExclusionReasons({ product_name: "Cream Of Rice 2kg",
    category: "Health Supplements", product_format: "powder", size: "2kg" }), []);
});

test("cosmetic evidence and a remaining cream word still exclude products with flavour-like names", () => {
  for (const patch of [
    { product_name: "Example Protein Vanilla Ice Cream Face Cream 120g" },
    { product_name: "Example Protein Cookies & Cream Facial Moisturizer 120g" },
    { product_name: "Example Whey Protein Vanilla Ice Cream 780g", raw_category: "Skincare" },
    { description: "Skin cream for external use." },
    { description: "Face moisturiser." },
    { product_name: "Example Protein Vanilla Ice Cream Hand Cream 120g" },
    { product_name: "Example Protein Custard Cream Body Cream 120g" },
    { product_name: "Example Protein Vanilla Ice Cream 780g", evidence_name: "Cosmetic cream" },
  ]) assert.deepEqual(getSafeCreateExclusionReasons(protein(patch), exact), ["excluded product type"]);
  assert.deepEqual(getSafeCreateExclusionReasons({ product_name: "Generic Skin Cream 120g",
    category: "Health Supplements", product_format: "powder", size: "120g" }), ["excluded product type"]);
  assert.deepEqual(getSafeCreateExclusionReasons({ product_name: "Vanilla Ice Cream Face Moisturiser 120g",
    category: "Skincare", product_format: "cream", size: "120g" }), ["category is not allowed for safe-create"]);
});

test("recognising cream flavours preserves every existing non-cream exclusion", () => {
  for (const description of ["CBD", "hemp", "pet", "dog", "cat", "puppy", "kitten",
    "medical test", "test kit", "bundle", "stack", "with free shaker", "plus free shaker",
    "BBE", "dated", "best before", "massage", "topical", "lotion", "gel"]) {
    assert.deepEqual(getSafeCreateExclusionReasons(protein({ description }), exact),
      ["excluded product type"], description);
  }
  for (const name of ["Melatonin", "Ostarine", "BPC-157"]) {
    assert.notDeepEqual(getSafeCreateExclusionReasons(protein({
      product_name: `Example Protein Vanilla Ice Cream ${name} 780g`,
    }), exact), [], name);
  }
});

test("cream flavour mapping retains existing canonical identity protections in a read-only dry-run", async () => {
  const row = {
    ...protein(), retailer_name: "Example Shop", retailer_website: "https://shop.example.test",
    external_product_id: "protein-1", external_variant_id: "protein-vanilla-1", external_sku: "vanilla-1",
    external_gtin: "4006381333931", product_id: "101", product_variant_id: "202",
    brand: "Example", slug: "example-protein-780g", variant_name: "Vanilla Ice Cream / 780g",
    flavour: "Vanilla Ice Cream", size: "780", size_unit: "g", pack_count: "1",
    price: "30.00", shipping_known: "true", shipping_cost: "0.00", in_stock: "true",
    is_for_sale: "true", external_url: "https://shop.example.test/products/protein-1",
    affiliate_url: "https://shop.example.test/products/protein-1",
    image: "https://shop.example.test/images/protein.jpg",
  };
  const product = { id: "101", name: row.product_name, brand: "Example", category: "Whey Protein",
    slug: row.slug, gtin: null, product_format: "powder", is_active: true, merged_into_product_id: null };
  const variant = { id: "202", product_id: "101", variant_key: "vanilla-ice-cream-780g",
    display_name: row.variant_name, flavour_code: "vanilla ice cream", flavour_label: "Vanilla Ice Cream",
    size_value: "780", size_unit: "g", pack_count: 1, product_format: "powder",
    gtin: "4006381333931", is_active: true, is_default: false };
  for (const scenario of [
    { name: "exact existing identity", allow: true },
    { name: "missing product binding", row: { product_id: "" } },
    { name: "missing variant binding", row: { product_variant_id: "" } },
    { name: "inactive product", product: { is_active: false } },
    { name: "inactive variant", variant: { is_active: false } },
    { name: "foreign variant", variant: { product_id: "999" } },
    { name: "wrong flavour", variant: { flavour_code: "chocolate", flavour_label: "Chocolate" } },
    { name: "wrong size", variant: { size_value: "500" } },
    { name: "wrong pack", variant: { pack_count: 8 } },
    { name: "wrong format", variant: { product_format: "capsule" } },
    { name: "wrong brand", product: { brand: "Another Brand" } },
    { name: "wrong category", row: { category: "Health Supplements" } },
  ]) {
    setSupabaseForTests(createStateClient({
      retailer: { id: "7", name: "Example Shop", slug: "example-shop", website: row.retailer_website },
      products: [{ ...product, ...scenario.product }], product_variants: [{ ...variant, ...scenario.variant }],
      retailer_products: [], offers: [], price_history: [],
    }));
    const result = await runImportRows([{ ...row, ...scenario.row }], { mode: "feed", safeCreate: true, dryRun: true });
    assert.equal(result.report.approvedRows.length, scenario.allow ? 1 : 0,
      `${scenario.name}: ${JSON.stringify(result.report.blockedRows)}`);
    if (scenario.allow) {
      const plan = result.report.approvedRows[0].importPlan;
      assert.equal(plan.product.action, "existing");
      assert.equal(plan.product_variant.action, "existing");
      assert.equal(plan.retailer_product.values.external_name, row.product_name);
    }
  }
});
