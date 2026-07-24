const assert = require("node:assert/strict");
const fs = require("fs");
const Module = require("module");
const path = require("path");
const test = require("node:test");
const ts = require("typescript");

function loadProductPresentationModule() {
  const filename = path.join(
    process.cwd(),
    "app",
    "lib",
    "productPresentation.ts"
  );
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const mod = new Module(filename, module);

  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(outputText, filename);

  return mod.exports;
}

const {
  buildProductKeyFacts,
  buildProductMetadataDescription,
  buildProductSummary,
} = loadProductPresentationModule();

function product(overrides = {}) {
  return {
    id: "999",
    name: "Example Complete Protein",
    brand: "Example Nutrition",
    category: "Protein",
    product_format: "powder",
    net_weight_g: null,
    net_volume_ml: null,
    serving_count_verified: null,
    unit_count: null,
    unit_type: null,
    serving_size_g: null,
    serving_size_ml: null,
    protein_per_serving_g: null,
    creatine_per_serving_g: null,
    nutrition_verified: false,
    ...overrides,
  };
}

test("buildProductSummary uses only neutral identity and verified facts", () => {
  assert.equal(
    buildProductSummary(
      product({
        name: "Example Formula",
        category: "Whey Protein",
        net_weight_g: 600,
        serving_count_verified: 20,
      })
    ),
    "Example Formula is a protein powder from Example Nutrition. This 600 g product contains 20 verified servings."
  );
});

test("summary falls back to category when format is unavailable", () => {
  assert.equal(
    buildProductSummary(
      product({ name: "Example Formula", product_format: null })
    ),
    "Example Formula is a protein supplement from Example Nutrition."
  );
});

test("summary remains complete without weight or servings", () => {
  assert.equal(
    buildProductSummary(product()),
    "Example Complete Protein is a supplement from Example Nutrition."
  );
});

test("summary handles missing brand and category without nullish text", () => {
  const summary = buildProductSummary(
    product({ brand: null, category: null, product_format: null })
  );

  assert.equal(summary, "Example Complete Protein is a supplement.");
  assert.doesNotMatch(summary, /null|undefined/i);
});

test("summary ignores legacy servings, description claims, and values in name", () => {
  const summary = buildProductSummary(
    product({
      name: "Example Powder 5kg 100 Servings",
      servings: 100,
      description: "Cure anxiety\\n✓ detox",
    })
  );

  assert.equal(
    summary,
    "Example Powder 5kg 100 Servings is a protein supplement from Example Nutrition."
  );
  assert.doesNotMatch(summary, /cure|anxiety|detox|✓|\\n/i);
});

test("category and format mappings use natural supplement language", () => {
  const cases = [
    [
      { name: "Example Formula", category: "Whey Protein", product_format: "powder" },
      "Example Formula is a protein powder from Example Nutrition.",
    ],
    [
      { name: "Example Formula", category: "Creatine", product_format: "powder" },
      "Example Formula is a creatine powder from Example Nutrition.",
    ],
    [
      { name: "Example Formula", category: "Pre Workout", product_format: "powder" },
      "Example Formula is a pre-workout powder from Example Nutrition.",
    ],
    [
      { name: "Daily Formula", category: "Vitamins", product_format: "capsule" },
      "Daily Formula is a vitamin supplement in capsule form from Example Nutrition.",
    ],
    [
      { name: "Daily Formula", category: "Vitamins", product_format: "tablet" },
      "Daily Formula is a vitamin supplement in tablet form from Example Nutrition.",
    ],
    [
      { name: "Example Formula", category: "Health Supplements", product_format: "liquid" },
      "Example Formula is a liquid supplement from Example Nutrition.",
    ],
    [
      { name: "Steel Shaker", category: "Accessories", product_format: null },
      "Steel Shaker is an accessory from Example Nutrition.",
    ],
    [
      { name: "Training T-Shirt", category: "Clothing", product_format: null },
      "Training T-Shirt is a clothing item from Example Nutrition.",
    ],
    [
      { name: "Training Back Pack", category: "Health Supplements", product_format: null },
      "Training Back Pack is an accessory from Example Nutrition.",
    ],
    [
      { name: "Cream of Rice", category: "Health Supplements", product_format: "powder" },
      "Cream of Rice is a food product from Example Nutrition.",
    ],
    [
      { name: "Daily Formula", category: "Health Supplements", product_format: null },
      "Daily Formula is a health supplement from Example Nutrition.",
    ],
  ];

  for (const [overrides, expected] of cases) {
    assert.equal(buildProductSummary(product(overrides)), expected);
  }
});

test("placeholder Unknown brand is omitted", () => {
  assert.equal(
    buildProductSummary(product({ name: "Example Formula", brand: "Unknown" })),
    "Example Formula is a protein powder."
  );
  assert.equal(
    buildProductKeyFacts(product({ brand: "Unknown", product_format: null })).some(
      (fact) => fact.label === "Brand"
    ),
    false
  );
});

test("summaries avoid legacy awkward category phrases", () => {
  for (const overrides of [
    { name: "Daily Formula", category: "Vitamins", product_format: null },
    { name: "Workout Formula", category: "Pre Workout", product_format: null },
  ]) {
    const summary = buildProductSummary(product(overrides));

    assert.doesNotMatch(summary, /Vitamins product|Pre Workout product/);
  }
});

test("buildProductKeyFacts formats all supported verified values", () => {
  assert.deepEqual(
    buildProductKeyFacts(
      product({
        product_format: "powder",
        net_weight_g: 1800,
        net_volume_ml: 500,
        serving_count_verified: 20,
        serving_size_g: 30,
        unit_count: 180,
        unit_type: "tablet",
        protein_per_serving_g: 24,
        creatine_per_serving_g: 5,
        nutrition_verified: true,
      })
    ),
    [
      { label: "Brand", value: "Example Nutrition" },
      { label: "Category", value: "Protein" },
      { label: "Product format", value: "Powder" },
      { label: "Net weight", value: "1.8 kg" },
      { label: "Net volume", value: "500 ml" },
      { label: "Verified servings", value: "20 servings" },
      { label: "Serving size", value: "30 g" },
      { label: "Unit count", value: "180 tablets" },
      { label: "Protein per serving", value: "24 g protein per serving" },
      { label: "Creatine per serving", value: "5 g creatine per serving" },
    ]
  );
});

test("partial Key facts omit unavailable rows", () => {
  assert.deepEqual(buildProductKeyFacts(product({ product_format: null })), [
    { label: "Brand", value: "Example Nutrition" },
    { label: "Category", value: "Protein" },
  ]);
});

test("nutrition facts require nutrition_verified", () => {
  const unverified = buildProductKeyFacts(
    product({
      protein_per_serving_g: 24,
      creatine_per_serving_g: 5,
      nutrition_verified: false,
    })
  );
  const verified = buildProductKeyFacts(
    product({
      protein_per_serving_g: 24,
      creatine_per_serving_g: 5,
      nutrition_verified: true,
    })
  );

  assert.equal(unverified.some((fact) => fact.label.includes("per serving")), false);
  assert.equal(verified.some((fact) => fact.value === "24 g protein per serving"), true);
  assert.equal(verified.some((fact) => fact.value === "5 g creatine per serving"), true);
});

test("Key facts never contain null or undefined", () => {
  const facts = buildProductKeyFacts(
    product({
      brand: null,
      category: undefined,
      product_format: null,
      unit_count: 180,
      unit_type: null,
    })
  );

  assert.equal(JSON.stringify(facts).includes("null"), false);
  assert.equal(JSON.stringify(facts).includes("undefined"), false);
});

test("exact GYM HIGH id and name activate the confirmed summary", () => {
  const expected =
    "GYM HIGH Whey Pro Synergy Dynamic is a 600 g protein powder made with 50% whey isolate and 50% micellar casein. It provides 20 servings and includes added probiotics.";

  assert.equal(
    buildProductSummary(
      product({ id: "510", name: "GYM HIGH Whey Pro Synergy Dynamic 600g" })
    ),
    expected
  );
  assert.notEqual(
    buildProductSummary(
      product({ id: "510", name: "GYM HIGH Whey Pro Synergy Dynamic 1kg" })
    ),
    expected
  );
  assert.notEqual(
    buildProductSummary(
      product({ id: "511", name: "GYM HIGH Whey Pro Synergy Dynamic 600g" })
    ),
    expected
  );
});

test("raw retailer description cannot enter summary or metadata", () => {
  const input = product({
    description: "Treat anxiety\\n✔ Fat burning detox claims",
  });
  const summary = buildProductSummary(input);
  const metadata = buildProductMetadataDescription(input);

  assert.doesNotMatch(summary, /treat|anxiety|fat burning|detox|✔|\\n/i);
  assert.doesNotMatch(metadata, /treat|anxiety|fat burning|detox|✔|\\n/i);
});

test("metadata descriptions stay within limit without cutting a word", () => {
  const metadata = buildProductMetadataDescription(
    product({ name: `${"Complete Protein Information ".repeat(10)}Ending` })
  );

  assert.ok(metadata.length <= 160);
  assert.match(metadata, /…$/);
  assert.doesNotMatch(metadata, /informat…$/i);

  const gymMetadata = buildProductMetadataDescription(
    product({ id: "510", name: "GYM HIGH Whey Pro Synergy Dynamic 600g" })
  );
  assert.ok(gymMetadata.length <= 160);
});

test("product page does not render or select the raw description for metadata", () => {
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "product", "[id]", "page.tsx"),
    "utf8"
  );

  assert.doesNotMatch(pageSource, /product\.description/);
  assert.doesNotMatch(
    pageSource,
    /name, slug, brand, category, description, image/
  );
});

test("product page constrains mobile offer cards and long content without horizontal overflow", () => {
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "product", "[id]", "page.tsx"),
    "utf8"
  );
  const retailerOfferCardSource = fs.readFileSync(
    path.join(process.cwd(), "app", "components", "RetailerOfferCard.tsx"),
    "utf8"
  );

  assert.match(pageSource, /grid-cols-\[minmax\(0,1fr\)\]/);
  assert.match(pageSource, /overflow-x-clip/);
  assert.match(
    pageSource,
    /<RetailerOfferCard[\s\S]*key=\{group\.retailerKey\}[\s\S]*group=\{group\}[\s\S]*product=\{productAnalytics\}[\s\S]*position=\{index \+ 1\}/
  );
  assert.match(pageSource, /break-words[^\"]*\[overflow-wrap:anywhere\]/);
  assert.doesNotMatch(pageSource, /className="flex items-center gap-4"/);
  assert.match(pageSource, /className="contents lg:block"/);
  assert.match(pageSource, /data-product-purchase[\s\S]*order-1[\s\S]*lg:order-none/);
  assert.match(pageSource, /data-product-image[\s\S]*order-2[\s\S]*h-\[220px\]/);
  assert.match(pageSource, /data-product-details[\s\S]*order-3[\s\S]*lg:order-none/);
  assert.match(pageSource, /max-h-\[170px\][^\"]*object-contain/);
  assert.match(retailerOfferCardSource, /<article className="w-full min-w-0 max-w-full/);
  assert.match(retailerOfferCardSource, /flex min-w-0 flex-col gap-4 sm:flex-row/);
  assert.match(retailerOfferCardSource, /w-full min-w-0 max-w-full shrink-0 items-center justify-center rounded-xl/);
  assert.match(retailerOfferCardSource, /break-words[^\"]*\[overflow-wrap:anywhere\]/);
});
