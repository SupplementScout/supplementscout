const assert = require("node:assert/strict");
const test = require("node:test");
const { fingerprint } = require("./lib/retailer-offer-sync/artifacts");
const {
  buildScopedSourceEvidence,
  mappedSourceRows,
  reverseUnmappedSourceDelta,
} = require("./lib/retailer-offer-sync/reviewed-mixed-change");
const {
  projectShopifyVariants,
  semanticShopifySnapshot,
  sha256,
} = require("./lib/shopify-snapshot-reader");

const STORE = "https://example.myshopify.com";

function variant(id, { sku = `SKU-${id}`, barcode = `GTIN-${id}`, price = "10.00", available = true } = {}) {
  return { id: String(id), title: `Variant ${id}`, sku, barcode, price, available };
}

function product(id, variants, { handle = `product-${id}`, title = `Product ${id}` } = {}) {
  return { id: String(id), title, handle, variants };
}

function snapshot(products) {
  return { store_origin: STORE, products };
}

function record(productId = "1", variantId = "11", overrides = {}) {
  return {
    mapping: {
      external_product_id: String(productId),
      external_variant_id: String(variantId),
      ...overrides,
    },
  };
}

function sources(value) {
  return projectShopifyVariants(value, { shippingCost: "3.99" });
}

function semanticProduct(value, productId) {
  return semanticShopifySnapshot(value).products.find((row) => String(row.id) === String(productId));
}

function semanticVariant(value, productId, variantId) {
  return semanticProduct(value, productId).variants.find((row) => String(row.id) === String(variantId));
}

function delta(overrides = {}) {
  return {
    added_products: [],
    removed_products: [],
    added_variants: [],
    removed_variants: [],
    ...overrides,
  };
}

function reviewed({ baseline, live, records, unmappedDelta, expectedMappedSnapshot = baseline }) {
  const mapped = mappedSourceRows({
    snapshot: expectedMappedSnapshot,
    sourceVariants: sources(expectedMappedSnapshot),
    records,
    storeUrl: STORE,
  });
  const contract = {
    schema_version: 1,
    reviewed_full_source_fingerprint: sha256(semanticShopifySnapshot(baseline)),
    observed_full_source_fingerprint: sha256(semanticShopifySnapshot(live)),
    reviewed_product_count: baseline.products.length,
    reviewed_variant_count: baseline.products.reduce((sum, row) => sum + row.variants.length, 0),
    observed_product_count: live.products.length,
    observed_variant_count: live.products.reduce((sum, row) => sum + row.variants.length, 0),
    mapped_scope_row_count: mapped.length,
    mapped_scope_fingerprint: fingerprint(mapped),
    unmapped_source_delta: unmappedDelta,
    unmapped_source_delta_hash: fingerprint(unmappedDelta),
  };
  return { manifest: { scoped_source_contract: contract } };
}

function evidence({ baseline, live, records, unmappedDelta, expectedMappedSnapshot = baseline }) {
  return buildScopedSourceEvidence({
    reviewed: reviewed({ baseline, live, records, unmappedDelta, expectedMappedSnapshot }),
    snapshot: live,
    sourceVariants: sources(live),
    records,
    storeUrl: STORE,
  });
}

const base = snapshot([
  product("1", [variant("11")]),
  product("2", [variant("21")]),
]);
const mapped = [record()];

test("identical full feed passes with empty unmapped delta", () => {
  const result = evidence({ baseline: base, live: base, records: mapped, unmappedDelta: delta() });
  assert.equal(result.mapped_scope_row_count, 1);
  assert.equal(result.full_source_fingerprint, result.reviewed_full_source_fingerprint);
});

test("one unrelated new product is reverse-proved and accepted", () => {
  const live = snapshot([...base.products, product("3", [variant("31")])]);
  const added = semanticProduct(live, "3");
  const result = evidence({
    baseline: base,
    live,
    records: mapped,
    unmappedDelta: delta({ added_products: [{ product_id: "3", semantic_product: added }] }),
  });
  assert.equal(result.collision_checks, "PASS");
  assert.equal(sha256(reverseUnmappedSourceDelta(live, result.unmapped_source_delta)), sha256(semanticShopifySnapshot(base)));
});

test("one unrelated new variant is reverse-proved and accepted", () => {
  const live = snapshot([
    base.products[0],
    product("2", [...base.products[1].variants, variant("22")]),
  ]);
  const added = semanticVariant(live, "2", "22");
  const result = evidence({
    baseline: base,
    live,
    records: mapped,
    unmappedDelta: delta({
      added_variants: [{
        product_id: "2",
        variant_id: "22",
        semantic_variant: added,
        url: `${STORE}/products/product-2?variant=22`,
      }],
    }),
  });
  assert.equal(result.collision_checks, "PASS");
});

test("one removed unrelated variant is reverse-proved and accepted", () => {
  const baseline = snapshot([
    base.products[0],
    product("2", [variant("21"), variant("22")]),
  ]);
  const live = base;
  const removed = semanticVariant(baseline, "2", "22");
  const result = evidence({
    baseline,
    live,
    records: mapped,
    unmappedDelta: delta({
      removed_variants: [{
        product_id: "2",
        variant_id: "22",
        semantic_variant: removed,
        url: `${STORE}/products/product-2?variant=22`,
      }],
    }),
  });
  assert.equal(result.collision_checks, "PASS");
});

for (const [name, changed] of [
  ["stock", variant("11", { available: false })],
  ["price", variant("11", { price: "11.00" })],
]) {
  test(`an additional mapped ${name} change is blocked`, () => {
    const live = snapshot([product("1", [changed]), base.products[1]]);
    assert.throws(
      () => evidence({ baseline: base, live, records: mapped, unmappedDelta: delta() }),
      /scoped reviewed source fingerprint mismatch/,
    );
  });
}

test("a mapped URL handle change is blocked", () => {
  const live = snapshot([product("1", [variant("11")], { handle: "changed" }), base.products[1]]);
  assert.throws(
    () => evidence({ baseline: base, live, records: mapped, unmappedDelta: delta() }),
    /scoped reviewed source fingerprint mismatch/,
  );
});

test("mapped SKU and Shopify identity changes are blocked", () => {
  const sku = snapshot([product("1", [variant("11", { sku: "OTHER" })]), base.products[1]]);
  assert.throws(
    () => evidence({ baseline: base, live: sku, records: mapped, unmappedDelta: delta() }),
    /scoped reviewed source fingerprint mismatch/,
  );
  const identity = snapshot([product("9", [variant("11")]), base.products[1]]);
  assert.throws(
    () => evidence({ baseline: base, live: identity, records: mapped, unmappedDelta: delta() }),
    /mapped Shopify identity/,
  );
});

for (const [name, addedVariant] of [
  ["SKU", variant("31", { sku: "SKU-11", barcode: "GTIN-31" })],
  ["GTIN", variant("31", { sku: "SKU-31", barcode: "GTIN-11" })],
]) {
  test(`an unrelated addition colliding by ${name} is blocked`, () => {
    const live = snapshot([...base.products, product("3", [addedVariant])]);
    assert.throws(
      () => evidence({
        baseline: base,
        live,
        records: mapped,
        unmappedDelta: delta({
          added_products: [{ product_id: "3", semantic_product: semanticProduct(live, "3") }],
        }),
      }),
      /collides with mapped Shopify identity/,
    );
  });
}

test("a missing mapped variant and duplicate source identity fail closed", () => {
  const missing = snapshot([base.products[1]]);
  assert.throws(
    () => evidence({ baseline: base, live: missing, records: mapped, unmappedDelta: delta() }),
    /mapped Shopify identity/,
  );
  const duplicate = snapshot([base.products[0], product("2", [variant("11")])]);
  assert.throws(
    () => evidence({ baseline: base, live: duplicate, records: mapped, unmappedDelta: delta() }),
    /missing or duplicate variant ID/,
  );
});

test("undeclared semantic source drift is a source parse/evidence mismatch", () => {
  const live = snapshot([base.products[0], product("2", [variant("21")], { title: "Changed" })]);
  assert.throws(
    () => evidence({ baseline: base, live, records: mapped, unmappedDelta: delta() }),
    /does not reconstruct reviewed full source/,
  );
});
