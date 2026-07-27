const assert = require("node:assert/strict");
const test = require("node:test");
const {
  canonicalFeedRow,
  commercialIdentityTokens,
  liveIdentityDrift,
  orderedCandidates,
  parseArgs,
} = require("./six-pack-canary-builder");

test("live identity guard blocks changed dosage while tolerating capsule wording", () => {
  assert.deepEqual(commercialIdentityTokens("Melatonin 1 mg 60 Capsules"), ["1mg", "60capsule"]);
  assert.equal(
    liveIdentityDrift(
      { source_record_id: "simple:4110", product_name: "Melatonin 1mg 60 Capsules" },
      { product_name: "Melatonin 1mg 60 caps" }
    ),
    null
  );
  assert.equal(
    liveIdentityDrift(
      { source_record_id: "simple:4110", product_name: "Melatonin 1mg 60 Capsules" },
      { product_name: "Melatonin 4mg 60 caps" }
    ).code,
    "CSV_LIVE_IDENTITY_DRIFT"
  );
});

test("canary builder requires an explicit target and a 5..20 row boundary", () => {
  assert.throws(() => parseArgs([]), /Required --target/);
  assert.throws(() => parseArgs(["--target=production", "--limit=4"]), /5..20/);
  assert.equal(parseArgs(["--target=production", "--limit=10"]).limit, 10);
  assert.equal(parseArgs(["--target=production", "--limit=20", "--exclude-existing=true"]).excludeExisting, true);
  assert.throws(() => parseArgs(["--target=production", "--exclude-existing=yes"]), /true\|false/);
});

test("selection prefers safe in-stock simple rows then one row per variant family", () => {
  const row = (id, type, product, extra = {}) => ({
    status: "SAFE_EXISTING_VARIANT",
    source_in_stock: true,
    source_type: type,
    external_product_id: product,
    external_variant_id: id,
    ...extra,
  });
  const ordered = orderedCandidates([
    row("13", "variation", "10"),
    row("14", "variation", "10"),
    row("21", "variation", "20"),
    row("5", "simple", "5"),
    row("6", "simple", "6", { source_in_stock: false }),
  ]);
  assert.deepEqual(ordered.map((item) => item.external_variant_id), ["5", "13", "21", "14"]);
});

test("canonical feed row binds shared parent URL to explicit canonical IDs", () => {
  const source = {
    external_product_id: "20",
    external_variant_id: "21",
    external_sku: null,
    external_gtin: null,
    external_options: { Flavour: "Cherry" },
    description: "Description",
    image_url: "https://shop.example/image.jpg",
    source_type: "variation",
  };
  const product = { id: 100, name: "Example Creatine 500g", slug: "example-creatine-500g", brand: "Example", category: "Creatine", product_format: "powder" };
  const variant = { id: 101, product_id: 100, display_name: "Cherry / 500g", flavour_label: "Cherry", size_value: 500, size_unit: "g", pack_count: 1, product_format: "powder" };
  const live = {
    canonical_url: "https://shop.example/product/example/",
    product_offer: null,
    variations: [{ external_variant_id: "21", price: "19.99", in_stock: true, active: true, purchasable: true, image_url: null }],
  };
  const row = canonicalFeedRow(source, product, variant, live, "2026-07-27T12:00:00.000Z");
  assert.equal(row.product_id, "100");
  assert.equal(row.product_variant_id, "101");
  assert.equal(row.external_url, "https://shop.example/product/example/");
  assert.equal(row.shipping_known, "true");
  assert.equal(row.shipping_cost, "4.99");
  assert.equal(row.price, "19.99");
});
