const assert = require("node:assert/strict");
const test = require("node:test");
const {
  canonicalFeedRow,
  commercialIdentity,
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
      { source_record_id: "simple:3899", product_name: "Zinc Citrate 100 Capsules" },
      { product_name: "Zinc Citrate 15mg 100 caps" }
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

test("capsule counts retain vegetarian kind for review without equating doses, tablets or servings", () => {
  for (const name of ["Example 90 Caps", "Example 90 Vege Caps", "Example 90 Vegetarian Capsules"]) {
    assert.deepEqual(commercialIdentityTokens(name), ["90capsule"]);
  }
  assert.deepEqual(commercialIdentity("Example 90 Vege Caps").capsule_qualifiers, ["vegetarian"]);
  assert.deepEqual(commercialIdentity("Example 90 Caps").capsule_qualifiers, []);
  assert.ok(liveIdentityDrift({ product_name: "Example 90 Caps" }, { product_name: "Example 90 Vege Caps" }));
  assert.equal(liveIdentityDrift({ product_name: "Example 90 Vege Caps" }, { product_name: "Example 90 Vegetarian Capsules" }), null);
  for (const [left, right] of [["90 Vege Caps", "120 Vege Caps"], ["90 Caps", "90 Tablets"],
    ["60 Servings", "90 Servings"], ["1mg 90 Caps", "4mg 90 Vege Caps"], ["1kg", "1.5kg"]]) {
    assert.ok(liveIdentityDrift({ product_name: `Example ${left}` }, { product_name: `Example ${right}` }));
  }
});

test("commercial packaging uses exact existing kg/g normalization without changing product names", () => {
  for (const [left, right] of [["1kg", "1000g"], ["0.5 kg", "500 g"], ["1,5kg", "1500g"],
    ["2kg", "2000g"], ["0.100000000000000001kg", "100.000000000000001g"]]) {
    const source = { source_record_id: "example", product_name: `Example Vanilla ${left}` };
    const live = { product_name: `Example Vanilla ${right}` };
    const before = structuredClone({ source, live });
    assert.deepEqual(commercialIdentityTokens(source.product_name), commercialIdentityTokens(live.product_name));
    assert.equal(liveIdentityDrift(source, live), null);
    assert.equal(liveIdentityDrift({ ...source, product_name: live.product_name }, { product_name: source.product_name }), null);
    assert.deepEqual({ source, live }, before);
  }
});

test("unit equivalence cannot authorize different sizes, counts, packs, flavours or names", () => {
  for (const [left, right] of [["1kg", "1g"], ["1kg", "1.5kg"], ["500g", "500mg"],
    ["60 capsules", "120 caps"], ["1 box", "12 boxes"], ["1kg", "2 x 500g"],
    ["500g", "2x500g"], ["1kg", "1kg pack of 2"], ["1kg box of 1", "1kg box of 12"],
    ["1kg", "1oz"], ["1kg", "1 k"], ["1kg", "1-1000g"]]) {
    assert.equal(liveIdentityDrift({ product_name: `Example ${left}` }, { product_name: `Example ${right}` }).code,
      "CSV_LIVE_IDENTITY_DRIFT", `${left} must not match ${right}`);
  }
  for (const name of ["Other Brand Vanilla 1000g", "Example Chocolate 1000g", "Example Vanilla 1000g pack of 2"]) {
    assert.ok(liveIdentityDrift({ product_name: "Example Vanilla 1kg" }, { product_name: name }), name);
  }
  assert.ok(liveIdentityDrift({ product_name: "Example Vanilla 1.00kg" }, { product_name: "Example Chocolate 1kg" }));
  assert.deepEqual(commercialIdentityTokens("Example 2 × 0.5kg"), ["2x500g"]);
  assert.equal(liveIdentityDrift({ product_name: "Example 2 x 0.5kg" }, { product_name: "Example 2x500g" }), null);
});

test("canary builder requires an explicit target and a 5..20 row boundary", () => {
  assert.throws(() => parseArgs([]), /Required --target/);
  assert.throws(() => parseArgs(["--target=production", "--limit=4"]), /5..20/);
  assert.equal(parseArgs(["--target=production", "--limit=10"]).limit, 10);
  assert.equal(parseArgs(["--target=production", "--limit=20", "--exclude-existing=true"]).excludeExisting, true);
  assert.equal(parseArgs(["--target=production", "--include-out-of-stock=true"]).includeOutOfStock, true);
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

test("out-of-stock safe rows require the explicit expansion flag", () => {
  const rows = [
    { status: "SAFE_EXISTING_VARIANT", source_in_stock: false, source_type: "simple", external_variant_id: "1" },
  ];
  assert.equal(orderedCandidates(rows).length, 0);
  assert.equal(orderedCandidates(rows, { includeOutOfStock: true }).length, 1);
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
  assert.equal(row.description, "");
  assert.equal(row.shipping_known, "true");
  assert.equal(row.shipping_cost, "4.99");
  assert.equal(row.price, "19.99");
});
