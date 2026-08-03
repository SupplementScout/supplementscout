const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");
const {
  animalSignal,
  indexShopify,
  readAwinFeed,
  reconcile,
  shippingFor,
  shopifyIdentity,
} = require("./simply-supplements-reconciliation");

function settings(animalExclusions = [], approvedRekeys = []) {
  return {
    kind: "test-simply-reconciliation",
    retailer: { id: 7, slug: "simply-supplements", store_url: "https://www.simplysupplements.co.uk" },
    shopify: { market_country: "GB", minimum_product_count: 1, minimum_variant_count: 1 },
    shipping: { free_from_gbp: 20, standard_gbp: 1.99 },
    policy: { mode: "READ_ONLY_RECONCILIATION", missing_variant: "BLOCK_NOT_OOS" },
    animal_exclusions: animalExclusions,
    approved_awin_rekeys: { rows: approvedRekeys },
  };
}

function snapshot(products) {
  return {
    captured_at: "2026-08-03T12:00:00.000Z",
    market_country: "GB",
    products,
    pages: [{ page: 1, count: products.length }, { page: 2, count: 0 }],
    raw_source_fingerprint: "a".repeat(64),
    semantic_source_fingerprint: "b".repeat(64),
    source_diagnostic: { pagination_completed: true, pagination_completion: "empty-page" },
  };
}

function awinRow(overrides = {}) {
  return {
    merchant_product_id: "C1",
    aw_product_id: "AW1",
    shopify_variant_id: "11",
    handle: "human-product",
    title: "Human Product",
    brand: "Simply Supplements",
    category: "Vitamins",
    ean: "5050000000001",
    direct_url: "https://www.simplysupplements.co.uk/products/human-product?variant=11",
    affiliate_url: "https://www.awin1.com/pclick.php?p=AW1&a=1&m=5959",
    awin_price_evidence: "99.99",
    awin_in_stock_evidence: "1",
    ...overrides,
  };
}

test("animal policy catches the hidden dog oil but not dog rose for humans", () => {
  assert.equal(animalSignal({ title: "Salmon Oil (500ml)", category: "Fish Oil", handle: "salmon-oil-dogs" }), true);
  assert.equal(animalSignal({ title: "Dog Rose Extract", category: "Herbal Supplements", handle: "dog-rose-extract" }), false);
  assert.equal(animalSignal({ title: "DentaSupport Treats", category: "Dog Treats", handle: "dental-treats" }), true);
});

test("shipping preserves the existing Simply threshold policy", () => {
  assert.equal(shippingFor(19.99, settings()), 1.99);
  assert.equal(shippingFor(20, settings()), 0);
  assert.throws(() => shippingFor(0, settings()), /positive Shopify price/);
});

test("reconciliation uses Shopify only for price and stock and keeps Awin affiliate identity", () => {
  const source = snapshot([{ id: 1, handle: "human-product", title: "Human Product", variants: [{ id: 11, title: "Default Title", sku: "SKU-1", price: "9.99", compare_at_price: "99.99", available: false }] }]);
  const row = awinRow();
  const report = reconcile({ awin: { rows: [row], evidence: { row_count: 1 } }, snapshot: source, approvedSeeds: [{ merchant_product_id: "C1", price: "99.99", in_stock: "true" }], settings: settings() });
  assert.equal(report.state, "READ_ONLY_READY");
  assert.equal(report.counts.approved_scope_ready, 1);
  assert.equal(report.approved_scope[0].price, "9.99");
  assert.equal(report.approved_scope[0].in_stock, false);
  assert.equal(report.approved_scope[0].shipping_cost, "1.99");
  assert.equal(report.approved_scope[0].total_price, "11.98");
  assert.equal(report.approved_scope[0].affiliate_url, row.affiliate_url);
  assert.equal(report.approved_scope[0].price_changed, true);
  assert.equal(report.approved_scope[0].compare_at_price, "99.99");
  assert.equal(report.counts.approved_scope_price_changes_matching_compare_at, 1);
  assert.equal(report.approved_scope[0].stock_changed, true);
  assert.equal(report.counts.database_writes, 0);
});

test("a missing Shopify variant blocks identity and never becomes OOS", () => {
  const source = snapshot([{ id: 2, handle: "other", title: "Other", variants: [{ id: 22, title: "Default", price: "10.00", available: true }] }]);
  const report = reconcile({ awin: { rows: [awinRow()], evidence: {} }, snapshot: source, approvedSeeds: [{ merchant_product_id: "C1", price: "99.99", in_stock: "true" }], settings: settings() });
  assert.equal(report.state, "REVIEW_REQUIRED");
  assert.equal(report.counts.approved_scope_blocked, 1);
  assert.equal(report.missing_shopify_variants[0].reason, "MISSING_SHOPIFY_VARIANT_BLOCK_NOT_OOS");
  assert.equal(Object.hasOwn(report.missing_shopify_variants[0], "in_stock"), false);
});

test("an exact owner-approved Awin rekey preserves the old outbound identity", () => {
  const source = snapshot([{ id: 1, handle: "human-product", title: "Human Product", variants: [{ id: 11, title: "Default", price: "10.00", available: true }] }]);
  const current = awinRow({ merchant_product_id: "NEW-C1", aw_product_id: "NEW-AW1", affiliate_url: "https://www.awin1.com/pclick.php?p=NEW-AW1&a=1&m=5959" });
  const seed = { merchant_product_id: "C1", aw_product_id: "AW1", product_name: "Human Product", direct_url: "https://www.simplysupplements.co.uk/products/human-product?variant=11", affiliate_url: "https://www.awin1.com/pclick.php?p=AW1&a=1&m=5959", price: "10.00", in_stock: "true" };
  const rekey = { merchant_product_id: "C1", aw_product_id: "AW1", shopify_variant_id: "11", handle: "human-product", title: "Human Product", affiliate_url: seed.affiliate_url, current_merchant_product_id: "NEW-C1", current_aw_product_id: "NEW-AW1", current_affiliate_url: current.affiliate_url };
  const report = reconcile({ awin: { rows: [current], evidence: {} }, snapshot: source, approvedSeeds: [seed], settings: settings([], [rekey]) });
  assert.equal(report.approved_scope_state, "READY_FOR_MANIFEST");
  assert.equal(report.approved_scope[0].status, "READY_OWNER_APPROVED_AWIN_REKEY");
  assert.equal(report.approved_scope[0].affiliate_url, seed.affiliate_url);
  assert.equal(report.approved_scope[0].current_awin_rekey.merchant_product_id, "NEW-C1");
  assert.equal(report.counts.approved_awin_rekeys, 1);
});

test("reviewed animal identity is excluded and cannot drift silently", () => {
  const pet = awinRow({ merchant_product_id: "V129", aw_product_id: "45010750678", shopify_variant_id: "63499328946525", handle: "salmon-oil-dogs", title: "Salmon Oil (500ml)", category: "Fish Oil" });
  const exclusion = { merchant_product_id: "V129", aw_product_id: "45010750678", shopify_variant_id: "63499328946525", handle: "salmon-oil-dogs", title: "Salmon Oil (500ml)" };
  const source = snapshot([{ id: 1, handle: "unrelated", title: "Unrelated", variants: [{ id: 1, title: "Default", price: "10", available: true }] }]);
  const report = reconcile({ awin: { rows: [pet], evidence: {} }, snapshot: source, approvedSeeds: [], settings: settings([exclusion]) });
  assert.equal(report.counts.owner_excluded_animal_products, 1);
  assert.equal(report.counts.awin_missing_shopify, 0);
  assert.equal(report.owner_excluded_animals[0].reason, "OWNER_EXCLUDED_ANIMAL_PRODUCT");
  assert.throws(() => reconcile({ awin: { rows: [{ ...pet, title: "Changed" }], evidence: {} }, snapshot: source, approvedSeeds: [], settings: settings([exclusion]) }), /animal exclusion drift/);
});

test("Simply snapshot requires an empty terminal page and explicit boolean availability", () => {
  const valid = snapshot([{ id: 1, handle: "p", variants: [{ id: 2, price: "10", available: true }] }]);
  assert.equal(indexShopify(valid, settings()).size, 1);
  assert.throws(() => indexShopify({ ...valid, pages: [{ page: 1, count: 1 }] }, settings()), /empty page/);
  assert.throws(() => indexShopify(snapshot([{ id: 1, handle: "p", variants: [{ id: 2, price: "10" }] }]), settings()), /availability must be boolean/);
});

test("parses and validates the selected Awin source contract", () => {
  const header = ["aw_deep_link", "product_name", "aw_product_id", "merchant_product_id", "search_price", "merchant_name", "merchant_id", "currency", "merchant_deep_link", "data_feed_id", "brand_name", "merchant_category", "in_stock", "is_for_sale", "ean"];
  const row = ["https://www.awin1.com/pclick.php?p=123&a=1&m=5959", "Product", "123", "C1", "9.99", "Simply Supplements", "5959", "GBP", "https://www.simplysupplements.co.uk/products/product?variant=11", "115748", "Simply Supplements", "Vitamins", "1", "1", "5050000000001"];
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "simply-awin-test-"));
  const file = path.join(directory, "feed.csv.gz");
  try {
    fs.writeFileSync(file, zlib.gzipSync(`${header.join(",")}\n${row.join(",")}\n`));
    const parsed = readAwinFeed(file);
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0].shopify_variant_id, "11");
    assert.match(parsed.evidence.compressed_sha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(shopifyIdentity(parsed.rows[0].direct_url), { handle: "product", variant_id: "11" });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
