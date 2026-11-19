const assert = require("node:assert/strict");
const test = require("node:test");

const {
  cataloguePolicyDecision,
  assertCataloguePolicyAllowsRecords,
  assessVariantCompatibility,
  normalizeFlavour,
  parseVariantIdentity,
  rowIdentityKey,
  productFamilyKey,
} = require("./feed-variant-guards");

const POWDER_FAMILY_CASES = [
  ["Optimum Nutrition Gold Standard 100% Whey Protein Chocolate Hazelnut 2.27kg", "Optimum Nutrition Gold Standard 100% Whey 2.27kg", "Chocolate Hazelnut", 2270],
  ["Optimum Nutrition Gold Standard 100% Whey Protein Strawberry 450g", "Optimum Nutrition Gold Standard 100% Whey 2.27kg", "Delicious Strawberry", 450],
  ["Optimum Nutrition Gold Standard 100% Whey Protein Double Rich Chocolate 465g", "Optimum Nutrition Gold Standard 100% Whey 2.27kg", "Double Rich Chocolate", 465],
  ["Optimum Nutrition Gold Standard 100% Whey Powder French Vanilla Crème 2.28kg", "Optimum Nutrition Gold Standard 100% Whey 2.27kg", "French Vanilla Crème", 2280],
  ["Applied Nutrition ISO XP Whey Protein Isolate Chocolate 450 g", "Applied Nutrition ISO-XP 1.8kg", "Chocolate Dessert", 450],
  ["Applied Nutrition Critical Whey Protein Powder Vanilla 825g", "Applied Nutrition Critical Whey 2kg", "Vanilla Ice Cream", 825],
];

test("exact serving variants inherit the independent physical count from their canonical parent", () => {
  for (const [id, variantId, name, servings] of [
    [508, 2975, "GYM HIGH Shred Mode 60 Capsules", 60],
    [413, 2970, "GYM HIGH ZMB 60 Capsules", 60],
    [427, 2968, "GYM HIGH BCAA 120 Capsules", 30],
    [429, 2967, "GYM HIGH Testo Pro 180 Capsules", 60],
  ]) {
    const product = { id, name, brand: "GYM HIGH", product_format: "capsule" };
    const variant = { id: variantId, product_id: id, display_name: `${servings} Servings`, size_value: servings,
      size_unit: "servings", pack_count: 1, product_format: null, is_active: true, is_default: false };
    const row = { product_id: String(id), product_variant_id: String(variantId), product_name: name,
      brand: "GYM HIGH", product_format: "capsule", size: String(servings), size_unit: "servings", pack_count: "1" };
    assert.equal(assessVariantCompatibility(row, product, variant).compatible, true, name);
    for (const patch of [{ product_id: "999" }, { product_variant_id: "999" }, { pack_count: "2" },
      { size: String(servings * 2) }, { product_format: "tablet" }, { product_name: name.replace(/\d+ Capsules/, "999 Capsules") }]) {
      assert.equal(assessVariantCompatibility({ ...row, ...patch }, product, variant).compatible, false, JSON.stringify(patch));
    }
    assert.equal(assessVariantCompatibility(row, { ...product, name: name.replace(/\d+ Capsules/, "Capsules") }, variant).compatible, false);
    assert.equal(assessVariantCompatibility(row, product, { ...variant, display_name: "60 Tablets", size_unit: "tablets" }).compatible, false);
  }
});

test("counted tablet and capsule families ignore only the bottle count", () => {
  for (const brand of ["Solgar", "Example"]) {
    for (const [left, right] of [
      [`${brand} Magnesium Citrate 60 Tablets`, `${brand} Magnesium Citrate 120 Tabs`],
      [`${brand} Biotin 5000µg 50 Vegi Capsules`, `${brand} Biotin 5000 mcg 100 Vegetable Capsules`],
      [`${brand} Gentle Iron 20 mg 90 Vege Capsules`, "Gentle Iron 20mg Vegetable 180 Capsules"],
      [`${brand} Calcium Magnesium plus Zinc 100 Tablets`, `${brand} Calcium Magnesium plus Zinc 250 Tablets`],
    ]) assert.equal(productFamilyKey(left, brand), productFamilyKey(right, brand), left);
  }
});

test("count normalization preserves potency, mineral compound, release type and dosage form", () => {
  const cases = [
    ["Example Biotin 5000µg 100 Capsules", "Example Biotin 1000µg 100 Capsules"],
    ["Example Iron 20mg 90 Capsules", "Example Iron 25mg 180 Capsules"],
    ["Example D3 1000IU 60 Tablets", "Example D3 4000IU 120 Tablets"],
    ["Example Magnesium Citrate 60 Tablets", "Example Magnesium Bisglycinate 120 Tablets"],
    ["Example Magnesium Citrate 60 Tablets", "Example Calcium Magnesium plus Zinc 60 Tablets"],
    ["Example Iron Slow Release 60 Tablets", "Example Iron 60 Tablets"],
    ["Example Iron 60 Tablets", "Example Iron 60 Capsules"],
    ["Example B-Complex 50 100 Capsules", "Example B-Complex 100 100 Capsules"],
    ["Example Formula v1 60 Tablets", "Example Formula v2 120 Tablets"],
    ["Example Iron 60 Vegetable Capsules", "Example Iron 60 Gelatin Capsules"],
  ];
  for (const [left, right] of cases) assert.notEqual(productFamilyKey(left), productFamilyKey(right), left);
});

test("equal counted families keep exact count, bottle pack, brand and format guards", () => {
  const row = { product_name: "Example Magnesium Citrate 120 Tablets", brand: "Example",
    product_format: "tablet", pack_count: "1", variant: "pack of 1" };
  const product = { name: "Example Magnesium Citrate 60 Tablets", brand: "Example", product_format: "tablet" };
  const variant = { display_name: "Unflavoured / 120 tablets", pack_count: 1,
    product_format: "tablet", is_default: false, is_active: true };
  assert.equal(assessVariantCompatibility(row, product, variant).compatible, true);
  for (const patch of [{ display_name: "Unflavoured / 60 tablets" }, { display_name: "Unflavoured / 120 capsules" },
    { display_name: "Unflavoured" }, { pack_count: 2 }, { product_format: "capsule" }]) {
    assert.equal(assessVariantCompatibility(row, product, { ...variant, ...patch }).compatible, false, JSON.stringify(patch));
  }
  assert.equal(assessVariantCompatibility(row, { ...product, brand: "Another" }, variant).compatible, false);
  assert.equal(assessVariantCompatibility(row, product, { ...variant, display_name: "Default", is_default: true }).compatible, false);
  assert.notEqual(rowIdentityKey(row), rowIdentityKey({ ...row, product_name: "Example Magnesium Citrate 60 Tablets" }));
  assert.notEqual(rowIdentityKey(row), rowIdentityKey({ ...row, variant: "pack of 2", pack_count: "2" }));
});

test("liquid meal descriptors match RTD families for single bottles and retail packs", () => {
  for (const brand of ["Huel", "Example"]) {
    for (const [line, flavour, pack] of [["Lite", "Strawberry", 1], ["Lite", "Chocolate", 6],
      ["Lite", "Vanilla Matcha", 1], ["Lite", "Mango", 6], ["", "Banana", 4]]) {
      const source = `${brand} ${line} ${flavour} Nutritionally Complete Meals ${pack} x 500ml`;
      assert.equal(productFamilyKey(source), productFamilyKey(`${brand} ${line} Ready-to-Drink 8 x 500ml`), source);
      assert.equal(productFamilyKey(source.replace("Nutritionally Complete Meals", "Complete Meal")),
        productFamilyKey(source));
    }
  }
});

test("Vanilla Matcha remains a distinct parsed flavour and variant identity", () => {
  const matcha = { product_name: "Example Lite Vanilla Matcha Nutritionally Complete Meal 500ml" };
  const vanilla = { product_name: "Example Lite Vanilla Nutritionally Complete Meal 500ml" };
  assert.equal(parseVariantIdentity(matcha).flavour, "vanilla matcha");
  assert.equal(parseVariantIdentity(vanilla).flavour, "vanilla");
  assert.notEqual(rowIdentityKey(matcha), rowIdentityKey(vanilla));
  assert.notEqual(rowIdentityKey({ ...matcha, flavour: "Mango" }), rowIdentityKey(vanilla));
});

test("liquid meal normalization preserves formula lines, versions and meaningful matcha", () => {
  const regular = productFamilyKey("Example Ready-to-Drink 500ml");
  const lite = productFamilyKey("Example Lite Ready-to-Drink 500ml");
  for (const line of ["Lite", "Black Edition", "Essential", "Complete Protein", "Daily Greens",
    "v1.0", "v2.0", "with Creatine", "Unknown Formula"]) {
    assert.notEqual(productFamilyKey(`Example ${line} Complete Meal Vanilla 500ml`), regular, line);
  }
  assert.notEqual(lite, regular);
  assert.notEqual(productFamilyKey("Example Lite Complete Meal v1.0 500ml"),
    productFamilyKey("Example Lite Complete Meal v2.0 500ml"));
  for (const name of ["Example Matcha Complete Meal 500ml", "Example Matcha Extract 500ml",
    "Example Vanilla Matcha Protein Powder 500g", "Example Nutritionally Complete Meal Powder 500g"]) {
    assert.match(productFamilyKey(name), /matcha|complete meal/, name);
  }
  assert.match(productFamilyKey("Example Lite Unknown Flavour Complete Meal 500ml"), /unknown flavour/);
});

function liquidMealFixture({ flavour = "Vanilla Matcha", pack = 1, line = "Lite" } = {}) {
  const parent = { id: "101", name: `Example ${line} Ready-to-Drink 8 x 500ml`, brand: "Example",
    category: "Weight Management", slug: "example-liquid-meal", product_format: "liquid",
    is_active: true, merged_into_product_id: null, gtin: null };
  const row = { retailer_name: "Example Shop", retailer_website: "https://shop.example.test",
    external_product_id: "meal-1", external_variant_id: "meal-1", external_sku: "meal-1",
    external_gtin: "4006381333931", product_id: "101", product_variant_id: "",
    product_name: `Example ${line} ${flavour} Nutritionally Complete Meal ${pack > 1 ? `${pack} x ` : ""}500ml`,
    brand: "Example", category: parent.category, slug: parent.slug,
    variant_name: `${flavour} / ${pack > 1 ? `${pack} x ` : ""}500ml`, flavour, size: "500", size_unit: "ml",
    pack_count: String(pack), product_format: "liquid", price: "3.50", shipping_known: "true",
    shipping_cost: "3.49", in_stock: "true", is_for_sale: "true",
    image: "https://shop.example.test/meal.png", external_url: "https://shop.example.test/meal-1",
    affiliate_url: "https://shop.example.test/meal-1" };
  const variant = { id: "202", product_id: "101", variant_key: "vanilla-matcha-500ml",
    display_name: row.variant_name, flavour_code: normalizeFlavour(flavour), flavour_label: flavour,
    size_value: "500", size_unit: "ml", pack_count: pack, product_format: "liquid", gtin: null,
    is_active: true, is_default: false };
  return { row, parent, variant };
}

async function liquidMealDryRun(rows, parent, variants = [], extraState = {}) {
  const importer = require("../import-products");
  const { createStateClient } = require("./reviewed-catalogue-state");
  importer.setSupabaseForTests(createStateClient({
    retailer: { id: "7", name: "Example Shop", slug: "example-shop", website: "https://shop.example.test" },
    products: [parent], product_variants: variants, retailer_products: [], offers: [], price_history: [], ...extraState,
  }));
  const reviewedCatalogueProfile = rows.every(row => !row.product_variant_id) ? {
    manifest: { retailer: { slug: "example-shop" } },
    profile: { row_count: rows.length, rows: rows.map((row, index) => ({
      review_row: index + 1, external_product_id: row.external_product_id,
      external_variant_id: row.external_variant_id, external_sku: row.external_sku,
      action: "create_variant_on_existing_product", product_id: Number(row.product_id),
      product_variant_id: null, product_name: row.product_name, variant_name: row.variant_name,
      brand: row.brand, category: row.category, flavour: row.flavour, size_value: row.size,
      size_unit: row.size_unit, pack_count: row.pack_count, product_format: row.product_format,
      external_url: row.external_url,
    })) },
  } : undefined;
  return importer.runImportRows(rows, { mode: "feed", safeCreate: true, dryRun: true, reviewedCatalogueProfile });
}

test("liquid meal dry-run creates exact missing 1, 4 and 6 packs beneath the existing parent", async () => {
  for (const options of [{ flavour: "Strawberry" }, { flavour: "Chocolate", pack: 6 },
    { flavour: "Vanilla Matcha" }, { flavour: "Mango", pack: 6 }, { flavour: "Banana", pack: 4, line: "" }]) {
    const { row, parent, variant } = liquidMealFixture(options);
    const result = await liquidMealDryRun([row], parent, [{ ...variant, pack_count: 8,
      display_name: `${options.flavour} / 8 x 500ml`, variant_key: "eight-bottles" }]);
    assert.equal(result.report.approvedRows.length, 1, JSON.stringify(result.report.blockedRows));
    const plan = result.report.approvedRows[0].importPlan;
    assert.equal(plan.product.action, "existing");
    assert.equal(plan.product.id, "101");
    assert.equal(plan.product_variant.action, "create_variant");
    assert.equal(plan.product_variant.values.pack_count, String(options.pack || 1));
    assert.equal(plan.product_variant.values.size_value, "500");
    assert.equal(plan.product_variant.values.size_unit, "ml");
    assert.equal(plan.product_variant.values.flavour_code, normalizeFlavour(options.flavour));
    assert.notEqual(plan.product_variant.values.variant_key, "default");
    assert.notEqual(plan.product_variant.values.display_name, "Default");
    assert.equal(plan.product_variant.values.gtin ?? null, null);
    assert.equal(result.report.newProductsToCreate.length, 0);
  }
});

test("liquid meal exact mapping rejects wrong flavour, pack, volume, format, brand and parent", async () => {
  const { row, parent, variant } = liquidMealFixture();
  const mapped = { ...row, product_variant_id: variant.id };
  for (const patch of [{}, { flavour_code: "vanilla", flavour_label: "Vanilla" },
    { flavour_code: "mango", flavour_label: "Mango" }, { pack_count: 8 }, { size_value: "250" },
    { size_unit: "g" }, { product_format: "powder" }, { product_id: "999" }, { is_active: false },
    { is_default: true, variant_key: "default", display_name: "Default", flavour_code: null,
      flavour_label: null, size_value: null, size_unit: null, pack_count: null }]) {
    const result = await liquidMealDryRun([mapped], parent, [{ ...variant, ...patch }]);
    assert.equal(result.report.approvedRows.length, Object.keys(patch).length ? 0 : 1,
      `${JSON.stringify(patch)}: ${JSON.stringify(result.report.blockedRows)}`);
  }
  for (const patch of [{ brand: "Different" }, { name: "Example Black Edition Ready-to-Drink 500ml" },
    { product_format: "powder" }, { is_active: false }, { merged_into_product_id: "999" }]) {
    const result = await liquidMealDryRun([mapped], { ...parent, ...patch }, [variant]);
    assert.equal(result.report.approvedRows.length, 0, JSON.stringify(patch));
  }
});

test("liquid meal create retains GTIN collision and duplicate-plan guards", async () => {
  const { row, parent, variant } = liquidMealFixture();
  const collision = await liquidMealDryRun([row], parent, [{ ...variant, id: "909", product_id: "999",
    gtin: row.external_gtin }]);
  assert.equal(collision.report.approvedRows.length, 0);
  assert.match(JSON.stringify(collision.report), /GTIN conflict|collision/i);
  const duplicate = await liquidMealDryRun([row, { ...row, external_product_id: "meal-2",
    external_variant_id: "meal-2", external_sku: "meal-2", external_gtin: "" }], parent);
  assert.equal(duplicate.report.approvedRows.length, 0);
  assert.match(JSON.stringify(duplicate.report), /duplicate|collision/i);
});

test("family keys remove complete decimal and multipack sizes before punctuation normalization", () => {
  for (const size of ["2.27kg", "2,27 kg", "1.8kg", "0.45kg", "450g", "12 x 0.055kg"]) {
    assert.equal(productFamilyKey(`Example Whey ${size}`), "example whey", size);
  }
  assert.notEqual(productFamilyKey("Example BCAA 2:1:1 500g"), productFamilyKey("Example BCAA 4:1:1 500g"));
});

test("the six expanded protein labels preserve their exact existing family keys", () => {
  for (const [source, parent] of POWDER_FAMILY_CASES) {
    assert.equal(productFamilyKey(source), productFamilyKey(parent), source);
  }
  assert.equal(productFamilyKey("Example Whey French Vanilla Creme 1kg"), productFamilyKey("Example Whey 500g"));
  assert.equal(productFamilyKey("Example ISO-XP Whey Protein Isolate 450g"), productFamilyKey("Example ISO-XP 1.8kg"));
});

test("powder label normalization retains formula, line and unknown ingredient distinctions", () => {
  for (const line of ["Isolate", "Concentrate", "Hydrolysed", "Plant", "Vegan", "Diet", "Clear", "Mass", "Casein", "Collagen"]) {
    assert.notEqual(productFamilyKey(`Example ${line} Whey Protein Chocolate Hazelnut 500g`),
      productFamilyKey("Example Whey 500g"), line);
  }
  for (const descriptor of ["Whey Protein Concentrate", "Plant Protein Isolate", "Whey Protein Isolate Hydrolysed", "Whey Protein Isolate with Creatine"]) {
    assert.notEqual(productFamilyKey(`Example ISO-XP ${descriptor} 500g`), productFamilyKey("Example ISO-XP 500g"), descriptor);
  }
  for (const qualifier of ["Plant", "Casein Blend", "Diet", "Hydrolysed", "with Creatine", "Unknown Formula"]) {
    assert.notEqual(productFamilyKey(`Example ISO-XP Whey Protein Isolate ${qualifier} 500g`),
      productFamilyKey(`Example ISO-XP ${qualifier} 500g`), qualifier);
  }
  for (const word of ["Hazelnut", "French", "Double Rich", "Rocky Road", "Cashew", "Unknown Flavour"]) {
    assert.notEqual(productFamilyKey(`Example ${word} Protein Powder 500g`), productFamilyKey("Example Protein Powder 500g"), word);
  }
  assert.notEqual(productFamilyKey("Example Chocolate Hazelnut Oil 500ml"), productFamilyKey("Example Oil 500ml"));
  assert.notEqual(productFamilyKey("Example Chocolate Hazelnut Creatine Powder 500g"), productFamilyKey("Example Creatine Powder 500g"));
  assert.notEqual(productFamilyKey("Example Whey Protein Chocolate Hazelnut 500ml"), productFamilyKey("Example Whey 500ml"));
});

test("family equality preserves distinct flavour identities and exact size, pack, brand and format checks", () => {
  for (const [source, parentName, flavour, size] of POWDER_FAMILY_CASES) {
    const brand = source.startsWith("Optimum") ? "Optimum Nutrition" : "Applied Nutrition";
    const row = { product_name: source, brand, flavour, size: `${size}g`, variant: "pack of 1", pack_count: "1", product_format: "powder" };
    const parent = { name: parentName, brand, product_format: "powder" };
    const variant = { flavour_code: normalizeFlavour(flavour), flavour_label: flavour, size_value: size,
      size_unit: "g", pack_count: 1, product_format: "powder", is_active: true, is_default: false };
    assert.equal(assessVariantCompatibility(row, parent, variant).compatible, true, source);
    for (const patch of [{ size_value: size + 1 }, { size_unit: "ml" }, { pack_count: 12 }]) {
      assert.equal(assessVariantCompatibility(row, parent, { ...variant, ...patch }).compatible, false, JSON.stringify(patch));
    }
    assert.equal(assessVariantCompatibility(row, { ...parent, brand: "Another Brand" }, variant).compatible, false);
    assert.equal(assessVariantCompatibility({ ...row, product_format: "capsule" }, parent, variant).compatible, false);
    assert.notEqual(rowIdentityKey(row), rowIdentityKey({ ...row, flavour: "Salted Caramel" }));
    assert.notEqual(rowIdentityKey(row), rowIdentityKey({ ...row,
      product_name: source.replace(/\b\d+(?:[.,]\d+)?\s*(kg|g)\b/gi, `${size + 1}g`), size: `${size + 1}g` }));
  }
});

test("expanded powder dry-run retains explicit target, flavour and inactive-variant guards", async () => {
  const importer = require("../import-products");
  const { createStateClient } = require("./reviewed-catalogue-state");
  const row = { retailer_name: "Example Shop", retailer_website: "https://shop.example.test",
    external_product_id: "powder-1", external_variant_id: "powder-1", external_sku: "powder-1",
    external_gtin: "4006381333931", product_id: "101", product_variant_id: "202",
    product_name: "Example Whey Protein Chocolate Hazelnut 500g", brand: "Example", category: "Whey Protein",
    slug: "example-whey", variant_name: "Chocolate Hazelnut /500g", flavour: "Chocolate Hazelnut",
    size: "500", size_unit: "g", pack_count: "1", product_format: "powder", price: "20.00",
    shipping_known: "true", shipping_cost: "0.00", in_stock: "true", is_for_sale: "true",
    image: "https://shop.example.test/powder.png", external_url: "https://shop.example.test/powder-1",
    affiliate_url: "https://shop.example.test/powder-1" };
  const product = { id: "101", name: "Example Whey 500g", brand: "Example", category: "Whey Protein",
    slug: "example-whey", product_format: "powder", is_active: true, merged_into_product_id: null, gtin: null };
  const variant = { id: "202", product_id: "101", variant_key: "chocolate-hazelnut-500g",
    display_name: row.variant_name, flavour_code: "chocolate hazelnut", flavour_label: "Chocolate Hazelnut",
    size_value: "500", size_unit: "g", pack_count: 1, product_format: "powder", gtin: null,
    is_active: true, is_default: false };
  for (const patch of [{}, { flavour_code: "salted caramel", flavour_label: "Salted Caramel" },
    { size_value: "600" }, { size_unit: "ml" }, { pack_count: 12 }, { product_id: "999" }, { is_active: false }]) {
    importer.setSupabaseForTests(createStateClient({ retailer: { id: "7", name: row.retailer_name,
      slug: "example-shop", website: row.retailer_website }, products: [product],
      product_variants: [{ ...variant, ...patch }], retailer_products: [], offers: [], price_history: [] }));
    const result = await importer.runImportRows([row], { mode: "feed", safeCreate: true, dryRun: true });
    assert.equal(result.report.approvedRows.length, Object.keys(patch).length === 0 ? 1 : 0,
      `${JSON.stringify(patch)}: ${JSON.stringify(result.report.blockedRows)}`);
  }
});

test("compound bar flavours do not become families or erase meaningful non-bar words", () => {
  for (const brand of ["Barebells", "Example"]) {
    for (const flavour of ["Caramel Cashew", "Rocky Road"]) {
      assert.equal(productFamilyKey(`${brand} Protein Bar ${flavour} 12 x 55g`),
        productFamilyKey(`${brand} Protein Bar 55g`));
    }
  }
  for (const family of ["Soft", "Vegan", "Milkshake", "Another Formula"]) {
    assert.notEqual(productFamilyKey(`Example ${family} Protein Bar Rocky Road 55g`),
      productFamilyKey("Example Protein Bar 55g"));
  }
  assert.match(productFamilyKey("Example Cashew Protein Powder 500g"), /cashew/);
  assert.match(productFamilyKey("Example Rocky Road Protein Powder 500g"), /rocky road/);
  assert.match(productFamilyKey("Example Unknown Flavour Protein Bar 55g"), /unknown flavour/);
});

test("bar flavour family matching retains exact flavour, pack, weight and unit identities", () => {
  const base = { product_name: "Example Protein Bar Caramel Cashew 55g", brand: "Example",
    flavour: "Caramel Cashew", size: "55g", product_format: "bar", pack_count: "1" };
  const differentFlavour = { ...base, flavour: "Rocky Road" };
  assert.notEqual(rowIdentityKey(base), rowIdentityKey(differentFlavour));
  for (const [title, size, pack] of [["Example Protein Bar Caramel Cashew 60g", "60g", 1],
    ["Example Protein Bar Caramel Cashew 12 x 55g", "12 x 55g", 12],
    ["Example Protein Bar Caramel Cashew 55ml", "55ml", 1]]) {
    const result = assessVariantCompatibility({ ...base, product_name: title, size, pack_count: String(pack) },
      { name: "Example Protein Bar 55g", brand: "Example", product_format: "bar" },
      { size_value: 55, size_unit: "g", pack_count: 1, product_format: "bar", is_default: false, is_active: true });
    assert.equal(result.compatible, false, title);
    assert(result.reasons.some(reason => /size|pack-count/.test(reason)), title);
  }
});

test("bar dry-run retains exact existing variant and flavour protections", async () => {
  const importer = require("../import-products");
  const { createStateClient } = require("./reviewed-catalogue-state");
  const row = { retailer_name: "Example Shop", retailer_website: "https://shop.example.test",
    external_product_id: "bar-1", external_variant_id: "bar-1", external_sku: "bar-1",
    external_gtin: "4006381333931", product_id: "101", product_variant_id: "202",
    product_name: "Example Protein Bar Caramel Cashew 55g", brand: "Example", category: "Protein Bars",
    slug: "example-bar", variant_name: "Caramel Cashew /55g", flavour: "Caramel Cashew",
    size: "55", size_unit: "g", pack_count: "1", product_format: "bar", price: "2.95",
    shipping_known: "true", shipping_cost: "3.49", in_stock: "true", is_for_sale: "true",
    image: "https://shop.example.test/bar.png",
    external_url: "https://shop.example.test/bar-1", affiliate_url: "https://shop.example.test/bar-1" };
  const product = { id: "101", name: "Example Protein Bar 55g", brand: "Example", category: "Protein Bars",
    slug: "example-bar", product_format: "bar", is_active: true, merged_into_product_id: null, gtin: null };
  const variant = { id: "202", product_id: "101", variant_key: "caramel-cashew-55g",
    display_name: row.variant_name, flavour_code: "caramel cashew", flavour_label: "Caramel Cashew",
    size_value: "55", size_unit: "g", pack_count: 1, product_format: "bar", gtin: null, is_active: true, is_default: false };
  for (const patch of [{}, { flavour_code: "rocky road", flavour_label: "Rocky Road" },
    { size_value: "60" }, { size_unit: "ml" }, { pack_count: 12 }, { product_id: "999" }]) {
    importer.setSupabaseForTests(createStateClient({ retailer: { id: "7", name: row.retailer_name,
      slug: "example-shop", website: row.retailer_website }, products: [product],
      product_variants: [{ ...variant, ...patch }], retailer_products: [], offers: [], price_history: [] }));
    const result = await importer.runImportRows([row], { mode: "feed", safeCreate: true, dryRun: true });
    assert.equal(result.report.approvedRows.length, Object.keys(patch).length === 0 ? 1 : 0,
      `${JSON.stringify(patch)}: ${JSON.stringify(result.report.blockedRows)}`);
  }
});

test("owner melatonin exclusion covers every dose and has no reviewed 1mg exception", () => {
  for (const name of ["7Nutrition Melatonin 1mg 60 Capsules", "Soma Melatonin 4 mg", "Melatonin 0.3mg",
    "Melatonin 5mg Gummies", "Melatonin Sleep Blend", "Melatonina 1 mg",
    "Melatonin 1mg with melatonin-free herbs"]) {
    const row = { product_name: name, __reviewed_catalogue_identity: { approved: true } };
    assert.equal(cataloguePolicyDecision(row).state, "EXCLUDE");
    assert.equal(cataloguePolicyDecision(row).code, "EXCLUDE_MELATONIN");
  }
  assert.equal(cataloguePolicyDecision({ product_name: "Melatonin 1mg", external_name: "Melatonin-free alias" }).state, "EXCLUDE");
});

test("owner policy excludes named research compounds without excluding ordinary nutrition peptides", () => {
  for (const name of ["SARMs", "Selective Androgen Receptor Modulators", "Research Peptides", "Pharmacological Peptide",
    "Ostarine MK-2866", "RAD-140", "BPC-157", "TB-500", "Selank", "Semax"]) {
    assert.equal(cataloguePolicyDecision({ product_name: name }).state, "EXCLUDE", name);
  }
  for (const name of ["Collagen Peptides", "CNP Peptide Whey Protein Blend", "L-Theanine 200mg", "Creatine 300g",
    "L-Tryptophan", "Pharma Grade EAA", "Ashwagandha", "Generic Nootropic", "Pre Workout 30 Servings", "Melatonin-free Sleep Blend"]) {
    assert.equal(cataloguePolicyDecision({ product_name: name }), null, name);
  }
  assert.equal(cataloguePolicyDecision({ product_name: "Peptide complex" }).state, "DEFER");
  assert.equal(cataloguePolicyDecision({ product_name: "L-Tryptophan", description: "Supports endogenous melatonin production" }).state, "DEFER");
  assert.equal(cataloguePolicyDecision({ product_name: "Other title", evidence_name: "BPC-157" }).state, "EXCLUDE");
  assert.equal(cataloguePolicyDecision({ product_name: "Other title", evidence_format: "BPC-157" }).state, "DEFER");
});

test("existing Limitless owner DEFER survives spelling and canonical-title differences", () => {
  for (const name of ["Ultra Nutrio Limitless Nootropic 100 Capsules", "Limitlesss Nootropic Brain Booster 100 caps - Ultra Nutrio"]) {
    assert.equal(cataloguePolicyDecision({ product_name: name }).code, "DEFER_OWNER_NAMED_PRODUCT");
  }
  assert.equal(cataloguePolicyDecision({ product_name: "Ordinary Nootropic 100 Capsules" }), null);
});

test("revoked scope fails closed using names, aliases and variants without mutating or shrinking authority", () => {
  const records = [
    { product: { id: "random", name: "Melatonin 1mg" }, mapping: { id: "m1", external_name: "Other alias" }, offer: { id: "o1" } },
    { product: { id: "another", name: "Other canonical" }, mapping: { id: "m2", external_name: "Melatonin 4mg" }, offer: { id: "o2" } },
    { product: { id: "third", name: "Sleep Blend" }, variant: { display_name: "with Melatonin" }, mapping: { id: "m3" }, offer: { id: "o3" } },
    { product: { name: "Ultra Nutrio Limitless Nootropic" }, mapping: { id: "m4" }, offer: { id: "o4" } },
  ];
  const before = structuredClone(records);
  assert.throws(() => assertCataloguePolicyAllowsRecords(records), error => {
    assert.equal(error.code, "CATALOGUE_POLICY_SCOPE_BLOCKED");
    assert.equal(error.detail.blocked_records.length, 4);
    assert.equal(error.detail.automatic_scope_reduction, false);
    return true;
  });
  assert.deepEqual(records, before);
  assert.doesNotThrow(() => assertCataloguePolicyAllowsRecords([{ product: { name: "Collagen Peptides" } }]));
});

test("existing commercial and freshness plan entrypoints cannot recreate excluded or deferred authority", () => {
  const { buildExistingOfferUpdatePlan } = require("./retailer-offer-sync/existing-offer-plan");
  const { buildVerifiedNoChangePlan } = require("../verified-no-change-offer-refresh");
  for (const name of ["Melatonin 1mg", "BPC-157", "Ultra Nutrio Limitless Nootropic 100 Capsules"]) {
    const state = { product: { name }, mapping: { id: "any" }, offer: { id: "any" }, variant: { id: "any" } };
    assert.throws(() => buildExistingOfferUpdatePlan(state), error => error.code === "CATALOGUE_POLICY_SCOPE_BLOCKED");
    assert.throws(() => buildVerifiedNoChangePlan({ target: { product: state.product,
      retailer_product: state.mapping, product_variant: state.variant, offer: state.offer } }),
    error => error.code === "CATALOGUE_POLICY_SCOPE_BLOCKED");
  }
});

test("reviewed shaker identity remains an accessory despite ml capacity", () => {
  const result = assessVariantCompatibility(
    {
      product_name: "BioTech USA Wave Shaker 600ml",
      brand: "BioTech USA",
      size: "600",
      size_unit: "ml",
      flavour: "Blue",
      product_format: "accessory",
      pack_count: "1",
      __reviewed_six_pack_family_identity: {
        canonical_product_variant_id: "2364",
        size_value: "600",
        size_unit: "ml",
        product_format: "accessory",
      },
    },
    {
      name: "BioTech USA Wave Shaker 600ml",
      brand: "BioTech USA",
      product_format: null,
    }
  );
  assert.equal(result.compatible, true);
  assert.deepEqual(result.reasons, []);
});

test("reviewed Six Pack resin is a valid exact product format", () => {
  const result = assessVariantCompatibility(
    {
      product_name: "Good Guru Gold Shilajit Resin 30g",
      brand: "Good Guru",
      size: "30",
      size_unit: "g",
      product_format: "resin",
      pack_count: "1",
      __reviewed_six_pack_family_identity: {
        canonical_product_variant_id: "2379",
        size_value: "30",
        size_unit: "g",
        pack_count: "1",
        product_format: "resin",
      },
    },
    {
      name: "Good Guru Gold Shilajit Resin 30g",
      brand: "Good Guru",
      product_format: "resin",
    }
  );
  assert.equal(result.compatible, true);
  assert.deepEqual(result.reasons, []);
});

test("reviewed Six Pack variant identity overrides pack wording in the product title", () => {
  const result = assessVariantCompatibility(
    {
      product_name: "Animal Pak 44 Packs",
      brand: "Animal",
      product_format: "pack",
      pack_count: "1",
      __reviewed_six_pack_family_identity: {
        canonical_product_variant_id: "2395",
        size_value: null,
        size_unit: null,
        pack_count: "1",
        product_format: "pack",
      },
    },
    {
      name: "Animal Pak 44 Packs",
      brand: "Animal",
      product_format: "pack",
    }
  );
  assert.equal(result.compatible, true);
  assert.deepEqual(result.reasons, []);
});

test("reviewed Six Pack multi-pack compares canonical size per unit", () => {
  const result = assessVariantCompatibility(
    {
      product_name: "Applied Nutrition High Protein Shake 500ml",
      brand: "Applied Nutrition",
      size: "500 ml",
      product_format: "ready-to-drink",
      pack_count: "8",
      __reviewed_six_pack_family_identity: {
        canonical_product_variant_id: "2459",
        size_value: "500",
        size_unit: "ml",
        product_format: "ready-to-drink",
      },
    },
    {
      name: "Applied Nutrition High Protein Shake 500ml",
      brand: "Applied Nutrition",
      product_format: "ready-to-drink",
    }
  );
  assert.equal(result.compatible, true);
  assert.deepEqual(result.reasons, []);
});

test("gummies and sachets are explicit catalogue formats", () => {
  assert.equal(parseVariantIdentity({ product_format: "gummy" }).productFormat, "gummy");
  assert.equal(parseVariantIdentity({ product_format: "sachet" }).productFormat, "sachet");
});

test("explicit multi-word flavours keep their complete normalized identity", () => {
  const flavours = [
    "Fruit Burst",
    "Fruit Fusion",
    "Fruit Punch",
    "Fruit Salad",
    "Blue Raspberry",
    "Icy Blue Razz",
    "Cola Millions",
    "Pineapple Millions",
  ];

  assert.deepEqual(flavours.map(normalizeFlavour), [
    "fruit burst",
    "fruit fusion",
    "fruit punch",
    "fruit salad",
    "blue raspberry",
    "icy blue razz",
    "cola millions",
    "pineapple millions",
  ]);
  assert.equal(new Set(flavours.map(normalizeFlavour)).size, flavours.length);
});

test("external_options flavour takes priority in parsed variant identity", () => {
  const identity = parseVariantIdentity({
    product_name: "Applied Nutrition Pump Pre Workout 375g",
    external_options: JSON.stringify({ Size: "375g", Flavour: "Rainbow Unicorn" }),
    product_format: "powder",
  });

  assert.equal(identity.flavour, "rainbow unicorn");
  assert.equal(identity.size.value, "375");
  assert.equal(identity.size.unit, "g");
});

test("exact canonical variant size overrides an ambiguous numeric product title", () => {
  const product = {
    name: "Applied Nutrition Pump 3G Pre-Workout 375g",
    brand: "Applied Nutrition",
    product_format: "powder",
  };
  const canonicalVariant = {
    size_value: "375",
    size_unit: "g",
    pack_count: 1,
    product_format: "powder",
    is_active: true,
    is_default: false,
  };

  const compatible = assessVariantCompatibility(
    {
      product_name: "Applied Nutrition Pump Pre Workout 375g",
      brand: "Applied Nutrition",
      size: "375 g",
      size_unit: "g",
      product_format: "powder",
      pack_count: "1",
    },
    product,
    canonicalVariant
  );
  assert.equal(compatible.compatible, true);
  assert.deepEqual(compatible.reasons, []);

  const wrongSize = assessVariantCompatibility(
    {
      product_name: "Applied Nutrition Pump Pre Workout 400g",
      brand: "Applied Nutrition",
      size: "400 g",
      size_unit: "g",
      product_format: "powder",
      pack_count: "1",
    },
    product,
    canonicalVariant
  );
  assert.equal(wrongSize.compatible, false);
  assert.ok(wrongSize.reasons.includes("size conflict"));
});

test("variant row identity is retailer-scoped and uses external_variant_id", () => {
  const base = {
    retailer_name: "Discount Supplements",
    retailer_website: "https://www.discount-supplements.co.uk",
    product_name: "Applied Nutrition Amino Fuel EAA 390g",
  };
  const fruitBurst = rowIdentityKey({
    ...base,
    external_variant_id: "variant-fruit-burst",
    flavour: "Fruit Burst",
  });
  const fruitSalad = rowIdentityKey({
    ...base,
    external_variant_id: "variant-fruit-salad",
    flavour: "Fruit Salad",
  });

  assert.notEqual(fruitBurst, fruitSalad);
  assert.match(fruitBurst, /external-variant\|discount supplements\|/);
  assert.match(fruitBurst, /\|variant-fruit-burst$/);
});
