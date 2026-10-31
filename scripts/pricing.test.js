const assert = require("node:assert/strict");
const fs = require("fs");
const Module = require("module");
const path = require("path");
const test = require("node:test");
const ts = require("typescript");

function loadPricingModule() {
  const filename = path.join(process.cwd(), "app", "lib", "pricing.ts");
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

const pricingModule = loadPricingModule();
const nutritionMetricsModule = (() => {
  const filename = path.join(process.cwd(), "app", "lib", "nutritionMetrics.ts");
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
})();
const offerFreshnessModule = (() => {
  const filename = path.join(process.cwd(), "app", "lib", "offerFreshness.ts");
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(outputText, filename);
  return mod.exports;
})();

function loadProductsModule() {
  const filename = path.join(process.cwd(), "app", "lib", "products.ts");
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const mod = new Module(filename, module);
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (parent === mod && request === "./pricing") {
      return pricingModule;
    }

    if (parent === mod && request === "./nutritionMetrics") {
      return nutritionMetricsModule;
    }

    if (parent === mod && request === "./offerFreshness") {
      return offerFreshnessModule;
    }

    if (parent === mod && request === "./supabase") {
      return { supabase: {} };
    }

    if (parent === mod && request === "./reviewedPreWorkoutFacts.server") {
      return { loadAppliedPreWorkoutFacts: async () => new Map() };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(outputText, filename);
  } finally {
    Module._load = originalLoad;
  }

  return mod.exports;
}

const {
  getDeliveredPrice,
  getKnownProductPrice,
  getVerifiedCostPer5gCreatine,
  getVerifiedCostPer25gProtein,
  getVerifiedPricePerKg,
  getVerifiedPricePerLitre,
  getVerifiedPricePerServing,
  getVerifiedPricePerUnit,
  formatUnitPrice,
} = pricingModule;
const {
  attachProductVariants,
  isReviewedLandingProductMatch,
  isVitaminLandingProductMatch,
  normalizeSearchOffers,
} = loadProductsModule();

test("variant nutrition enrichment uses one exact ID binding", () => {
  const products = [{
    id: 10,
    offers: [
      { id: 1, product_variant_id: 100 },
      { id: 2, product_variant_id: 200 },
    ],
  }];
  const variants = [{
    id: 100,
    size_value: 1000,
    size_unit: "g",
    product_format: "powder",
    nutrition_override: { protein_per_serving_g: 22 },
  }];
  const enriched = attachProductVariants(products, variants);

  assert.equal(enriched[0].offers[0].product_variant.id, 100);
  assert.equal(enriched[0].offers[1].product_variant, null);
  assert.equal(products[0].offers[0].product_variant, undefined);
});

test("500 ml liquid at 24.98 returns 49.96 per litre", () => {
  const deliveredPrice = getDeliveredPrice({ price: 24.98, shipping_cost: 0 });

  assert.equal(
    getVerifiedPricePerLitre(deliveredPrice, 500, "liquid", true),
    49.96
  );
});

test("verified capsule and tablet unit pricing uses delivered total", () => {
  const deliveredPrice = getDeliveredPrice({ price: 6.69, shipping_cost: 1.99 });

  assert.deepEqual(getVerifiedPricePerUnit(deliveredPrice, 180, "tablet", true), {
    price: 8.68 / 180,
    unitType: "tablet",
  });
  assert.deepEqual(getVerifiedPricePerUnit(deliveredPrice, "60", "capsule", true), {
    price: 8.68 / 60,
    unitType: "capsule",
  });
});

test("serving price uses delivered total without requiring unit pricing verification", () => {
  const deliveredPrice = getDeliveredPrice({ price: 13.99, shipping_cost: 1.99 });

  assert.equal(getVerifiedPricePerServing(deliveredPrice, 40), 15.98 / 40);
  assert.equal(getVerifiedPricePerServing(deliveredPrice, 40, false), 15.98 / 40);
});

test("serving price supports serving-only products while unit price stays hidden", () => {
  const deliveredPrice = getDeliveredPrice({ price: 13.99, shipping_cost: 1.99 });

  assert.equal(getVerifiedPricePerServing(deliveredPrice, 60), 15.98 / 60);
  assert.equal(getVerifiedPricePerUnit(deliveredPrice, null, null, false), null);
});

test("creatine cost uses reviewed serving count without broad unit verification", () => {
  const deliveredPrice = getDeliveredPrice({ price: 20, shipping_cost: 0 });

  assert.equal(
    getVerifiedCostPer5gCreatine(
      deliveredPrice,
      100,
      5,
      false,
      true,
      null,
      null,
      null
    ),
    0.2
  );
});

test("protein cost uses reviewed serving count without broad unit verification", () => {
  const deliveredPrice = getDeliveredPrice({ price: 40, shipping_cost: 0 });

  assert.equal(
    getVerifiedCostPer25gProtein(deliveredPrice, 80, 25, false, true),
    0.5
  );
});

test("protein exact-serving path fails closed for unreviewed or invalid facts", () => {
  const deliveredPrice = getDeliveredPrice({ price: 40, shipping_cost: 0 });
  const calculate = (servings, protein, nutritionVerified = true) =>
    getVerifiedCostPer25gProtein(
      deliveredPrice,
      servings,
      protein,
      false,
      nutritionVerified
    );

  assert.equal(calculate(80, 25, false), null);
  for (const invalid of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(calculate(invalid, 25), null);
  }
  for (const invalid of [null, "", 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(calculate(80, invalid), null);
  }
});

test("creatine exact-serving path uses the same review and validity matrix", () => {
  const deliveredPrice = getDeliveredPrice({ price: 20, shipping_cost: 0 });
  const calculate = (servings, creatine, nutritionVerified = true) =>
    getVerifiedCostPer5gCreatine(
      deliveredPrice,
      servings,
      creatine,
      false,
      nutritionVerified,
      null,
      null,
      null
    );

  assert.equal(calculate(100, 5), 0.2);
  assert.equal(calculate(100, 5, false), null);
  assert.equal(calculate(0, 5), null);
  assert.equal(calculate(100, 0), null);
});

test("protein cost can use verified powder weight and serving composition", () => {
  const deliveredPrice = getDeliveredPrice({ price: 40, shipping_cost: 0 });
  const result = getVerifiedCostPer25gProtein(
    deliveredPrice,
    null,
    24,
    true,
    true,
    2000,
    30,
    "powder"
  );

  assert.ok(Math.abs(result - (40 / 1600) * 25) < 1e-12);
});

test("protein powder fallback fails closed for invalid or unverified inputs", () => {
  const deliveredPrice = getDeliveredPrice({ price: 40, shipping_cost: 0 });
  const calculate = (
    unitVerified,
    nutritionVerified,
    netWeight,
    servingSize,
    protein,
    format = "powder"
  ) => getVerifiedCostPer25gProtein(
    deliveredPrice,
    null,
    protein,
    unitVerified,
    nutritionVerified,
    netWeight,
    servingSize,
    format
  );

  assert.equal(calculate(false, true, 2000, 30, 24), null);
  assert.equal(calculate(true, false, 2000, 30, 24), null);
  assert.equal(calculate(true, true, null, 30, 24), null);
  assert.equal(calculate(true, true, 2000, null, 24), null);
  assert.equal(calculate(true, true, 2000, 30, 31), null);
  assert.equal(calculate(true, true, 2000, 30, 24, "bar"), null);
});

test("Batch 01 exact post-apply fixture unlocks only serving-based nutrition metrics", () => {
  const fixtures = [
    { variantId: 3273, netWeight: 510, delivered: 24.48, servings: 17, servingSize: 30, protein: 22.5, expectedServing: 1.44, expectedProtein: 1.6 },
    { variantId: 3376, netWeight: 510, delivered: 24.48, servings: 17, servingSize: 30, protein: 22.5, expectedServing: 1.44, expectedProtein: 1.6 },
    { variantId: 3377, netWeight: 510, delivered: 24.48, servings: 17, servingSize: 30, protein: 22.5, expectedServing: 1.44, expectedProtein: 1.6 },
    { variantId: 3379, netWeight: 510, delivered: 24.48, servings: 17, servingSize: 30, protein: 22.5, expectedServing: 1.44, expectedProtein: 1.6 },
    { variantId: 3385, netWeight: 510, delivered: 24.48, servings: 17, servingSize: 30, protein: 22.5, expectedServing: 1.44, expectedProtein: 1.6 },
    { variantId: 3386, netWeight: 510, delivered: 24.48, servings: 17, servingSize: 30, protein: 22.5, expectedServing: 1.44, expectedProtein: 1.6 },
    { variantId: 3387, netWeight: 510, delivered: 24.48, servings: 17, servingSize: 30, protein: 22.5, expectedServing: 1.44, expectedProtein: 1.6 },
    { variantId: 3388, netWeight: 510, delivered: 24.48, servings: 17, servingSize: 30, protein: 22.5, expectedServing: 1.44, expectedProtein: 1.6 },
    { variantId: 3390, netWeight: 510, delivered: 24.48, servings: 17, servingSize: 30, protein: 22.5, expectedServing: 1.44, expectedProtein: 1.6 },
    { variantId: 3391, netWeight: 2100, delivered: 50.98, servings: 70, servingSize: 30, protein: 22.5, expectedServing: 0.7282857142857142, expectedProtein: 0.8092063492063493 },
    { variantId: 3393, netWeight: 2100, delivered: 50.94, servings: 70, servingSize: 30, protein: 22.5, expectedServing: 0.7277142857142856, expectedProtein: 0.8085714285714285 },
    { variantId: 3395, netWeight: 2100, delivered: 56.98, servings: 70, servingSize: 30, protein: 22.5, expectedServing: 0.814, expectedProtein: 0.9044444444444444 },
    { variantId: 3407, netWeight: 2100, delivered: 56.98, servings: 70, servingSize: 30, protein: 22.5, expectedServing: 0.814, expectedProtein: 0.9044444444444444 },
    { variantId: 3649, netWeight: 600, delivered: 30.94, servings: 20, servingSize: 30, protein: 24, expectedServing: 1.5470000000000002, expectedProtein: 1.6114583333333334 },
    { variantId: 3650, netWeight: 640, delivered: 49.98, servings: 20, servingSize: 32, protein: 25, expectedServing: 2.4989999999999997, expectedProtein: 2.4989999999999997 },
    { variantId: 3691, netWeight: 640, delivered: 49.98, servings: 20, servingSize: 32, protein: 25, expectedServing: 2.4989999999999997, expectedProtein: 2.4989999999999997 },
    { variantId: 3696, netWeight: 1600, delivered: 125.48, servings: 40, servingSize: 40, protein: 30, expectedServing: 3.137, expectedProtein: 2.6141666666666667 },
    { variantId: 3697, netWeight: 1000, delivered: 34.98, servings: 31, servingSize: 32, protein: 20, expectedServing: 1.1283870967741934, expectedProtein: 1.4104838709677416 },
    { variantId: 3700, netWeight: 500, delivered: 28.98, servings: 15, servingSize: 33, protein: 25, expectedServing: 1.932, expectedProtein: 1.932 },
    { variantId: 3702, netWeight: 1350, delivered: 64.98, servings: 45, servingSize: 30, protein: 22, expectedServing: 1.4440000000000002, expectedProtein: 1.640909090909091 },
    { variantId: 3973, netWeight: 454, delivered: 21.98, servings: 16, servingSize: 28, protein: 21, expectedServing: 1.37375, expectedProtein: 1.6354166666666665 },
    { variantId: 3988, netWeight: 454, delivered: 21.98, servings: 16, servingSize: 28, protein: 21, expectedServing: 1.37375, expectedProtein: 1.6354166666666665 },
    { variantId: 3989, netWeight: 454, delivered: 21.98, servings: 16, servingSize: 28, protein: 21, expectedServing: 1.37375, expectedProtein: 1.6354166666666665 },
    { variantId: 3990, netWeight: 454, delivered: 21.98, servings: 16, servingSize: 28, protein: 21, expectedServing: 1.37375, expectedProtein: 1.6354166666666665 },
    { variantId: 4120, netWeight: 900, delivered: 40.98, servings: 30, servingSize: 30, protein: 22, expectedServing: 1.3659999999999999, expectedProtein: 1.5522727272727272 },
  ];

  for (const fixture of fixtures) {
    const effective = nutritionMetricsModule.getEffectiveNutritionMetrics(
      {
        net_weight_g: fixture.netWeight,
        serving_count_verified: null,
        serving_size_g: null,
        protein_per_serving_g: null,
        creatine_per_serving_g: null,
        product_format: "powder",
        unit_pricing_verified: false,
        nutrition_verified: false,
      },
      {
        size_value: fixture.netWeight,
        size_unit: "g",
        product_format: "powder",
        nutrition_override: {
          serving_count_verified: fixture.servings,
          serving_size_g: fixture.servingSize,
          protein_per_serving_g: fixture.protein,
          nutrition_verified: true,
        },
      }
    );
    const deliveredPrice = getDeliveredPrice({
      price: fixture.delivered,
      shipping_cost: 0,
    });
    const pricePerServing = getVerifiedPricePerServing(
      deliveredPrice,
      effective.serving_count_verified
    );
    const costPer25gProtein = getVerifiedCostPer25gProtein(
      deliveredPrice,
      effective.serving_count_verified,
      effective.protein_per_serving_g,
      effective.unit_pricing_verified,
      effective.nutrition_verified,
      effective.net_weight_g,
      effective.serving_size_g,
      effective.product_format
    );

    assert.equal(effective.unit_pricing_verified, false, fixture.variantId);
    assert.equal(effective.nutrition_verified, true, fixture.variantId);
    assert.ok(Math.abs(pricePerServing - fixture.expectedServing) < 1e-12, fixture.variantId);
    assert.ok(Math.abs(costPer25gProtein - fixture.expectedProtein) < 1e-12, fixture.variantId);
    assert.equal(
      getVerifiedPricePerKg(
        deliveredPrice,
        effective.net_weight_g,
        effective.product_format,
        effective.unit_pricing_verified
      ),
      null,
      fixture.variantId
    );
    assert.equal(
      getVerifiedPricePerUnit(deliveredPrice, null, null, effective.unit_pricing_verified),
      null,
      fixture.variantId
    );
  }
});

test("creatine cost can use verified powder weight and serving composition", () => {
  const deliveredPrice = getDeliveredPrice({ price: 27.98, shipping_cost: 0 });
  const result = getVerifiedCostPer5gCreatine(
    deliveredPrice,
    null,
    3,
    true,
    true,
    317,
    3,
    "powder"
  );

  assert.ok(Math.abs(result - (27.98 / 317) * 5) < 1e-12);
});

test("powder fallback accounts for creatine concentration per serving", () => {
  const deliveredPrice = getDeliveredPrice({ price: 25, shipping_cost: 0 });

  assert.equal(
    getVerifiedCostPer5gCreatine(
      deliveredPrice,
      null,
      5,
      true,
      true,
      500,
      10,
      "powder"
    ),
    0.5
  );
});

test("powder fallback requires verification flags and package inputs", () => {
  const deliveredPrice = getDeliveredPrice({ price: 25, shipping_cost: 0 });
  const calculate = (unitVerified, nutritionVerified, netWeight, servingSize) =>
    getVerifiedCostPer5gCreatine(
      deliveredPrice,
      null,
      5,
      unitVerified,
      nutritionVerified,
      netWeight,
      servingSize,
      "powder"
    );

  assert.equal(calculate(true, false, 500, 10), null);
  assert.equal(calculate(false, true, 500, 10), null);
  assert.equal(calculate(true, true, 500, null), null);
  assert.equal(calculate(true, true, null, 10), null);
});

test("powder fallback rejects creatine exceeding the serving size", () => {
  const deliveredPrice = getDeliveredPrice({ price: 25, shipping_cost: 0 });

  assert.equal(
    getVerifiedCostPer5gCreatine(
      deliveredPrice,
      null,
      11,
      true,
      true,
      500,
      10,
      "powder"
    ),
    null
  );
});

test("serving-count-free creatine cost is limited to powders", () => {
  const deliveredPrice = getDeliveredPrice({ price: 25, shipping_cost: 0 });

  for (const format of ["capsule", "tablet", "liquid"]) {
    assert.equal(
      getVerifiedCostPer5gCreatine(
        deliveredPrice,
        null,
        5,
        true,
        true,
        500,
        10,
        format
      ),
      null,
      format
    );
  }
});

test("powder fallback rejects zero, negative, NaN and infinite inputs", () => {
  const deliveredPrice = getDeliveredPrice({ price: 25, shipping_cost: 0 });
  const calculate = (netWeight, servingSize, creatine) =>
    getVerifiedCostPer5gCreatine(
      deliveredPrice,
      null,
      creatine,
      true,
      true,
      netWeight,
      servingSize,
      "powder"
    );

  for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(calculate(invalid, 10, 5), null);
    assert.equal(calculate(500, invalid, 5), null);
    assert.equal(calculate(500, 10, invalid), null);
  }
});

test("powder fallback rejects invalid delivered totals", () => {
  const calculate = (totalPrice) =>
    getVerifiedCostPer5gCreatine(
      { productPrice: totalPrice, shippingCost: 0, totalPrice },
      null,
      5,
      true,
      true,
      500,
      10,
      "powder"
    );

  for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(calculate(invalid), null);
  }
});

test("creatine fallback does not change serving or kilogram pricing", () => {
  const deliveredPrice = getDeliveredPrice({ price: 27.98, shipping_cost: 0 });

  assert.equal(getVerifiedPricePerServing(deliveredPrice, null), null);
  assert.equal(
    getVerifiedPricePerKg(deliveredPrice, 317, "powder", true),
    27.98 / 0.317
  );
});

test("unit pricing is hidden unless verified with a valid capsule or tablet count", () => {
  const deliveredPrice = getDeliveredPrice({ price: 6.69, shipping_cost: 1.99 });

  assert.equal(getVerifiedPricePerUnit(deliveredPrice, 180, "tablet", false), null);
  assert.equal(getVerifiedPricePerUnit(deliveredPrice, null, "tablet", true), null);
  assert.equal(getVerifiedPricePerUnit(deliveredPrice, 0, "tablet", true), null);
  assert.equal(getVerifiedPricePerUnit(deliveredPrice, 180.5, "tablet", true), null);
  assert.equal(getVerifiedPricePerUnit(deliveredPrice, 180, "gummy", true), null);
  assert.equal(getVerifiedPricePerUnit(null, 180, "tablet", true), null);
});

test("vitamin d can show serving and verified tablet prices independently", () => {
  const deliveredPrice = getDeliveredPrice({ price: 6.69, shipping_cost: 1.99 });

  assert.equal(getVerifiedPricePerServing(deliveredPrice, 180), 8.68 / 180);
  assert.deepEqual(getVerifiedPricePerUnit(deliveredPrice, 180, "tablet", true), {
    price: 8.68 / 180,
    unitType: "tablet",
  });
});

test("unit price formatting uses pence under one pound", () => {
  assert.equal(formatUnitPrice(8.68 / 180), "4.8p");
  assert.equal(formatUnitPrice(1.25), "£1.25");
});

test("null or blank shipping has unknown delivered price", () => {
  assert.equal(getDeliveredPrice({ price: 24.98, shipping_cost: null }), null);
  assert.equal(getDeliveredPrice({ price: 24.98, shipping_cost: "" }), null);
});

test("zero shipping remains valid free delivery", () => {
  assert.deepEqual(getDeliveredPrice({ price: 24.98, shipping_cost: 0 }), {
    productPrice: 24.98,
    shippingCost: 0,
    totalPrice: 24.98,
  });
});

test("delivered price uses exact penny arithmetic for decimal product and shipping prices", () => {
  assert.deepEqual(getDeliveredPrice({ price: 23.49, shipping_cost: 3.99 }), {
    productPrice: 23.49,
    shippingCost: 3.99,
    totalPrice: 27.48,
  });
});

test("search offer ranking keeps unknown shipping visible after known delivered totals", () => {
  const offers = normalizeSearchOffers([
    {
      id: "unknown-delivery",
      price: 10,
      shipping_cost: null,
      url: "https://retailer.example/unknown",
      in_stock: true,
      last_checked_at: new Date().toISOString(),
      retailer: { id: "1", name: "Retailer One", slug: "retailer-one" },
    },
    {
      id: "known-delivery",
      price: 12,
      shipping_cost: 1.99,
      url: "https://retailer.example/known",
      in_stock: true,
      last_checked_at: new Date().toISOString(),
      retailer: { id: "2", name: "Retailer Two", slug: "retailer-two" },
    },
  ]);

  assert.equal(getDeliveredPrice({ price: 10, shipping_cost: null }), null);
  assert.deepEqual(offers.map((offer) => offer.id), [
    "known-delivery",
    "unknown-delivery",
  ]);
  assert.equal(offers[0].deliveredPrice.totalPrice, 13.99);
  assert.equal(offers[1].productPrice, 10);
  assert.equal(offers[1].deliveredPrice, null);
});

test("invalid offer prices are not treated as displayable product prices", () => {
  assert.equal(getKnownProductPrice(null), null);
  assert.equal(getKnownProductPrice(""), null);
  assert.equal(getKnownProductPrice("NaN"), null);
  assert.equal(getKnownProductPrice("Infinity"), null);
  assert.equal(getKnownProductPrice("0"), null);
  assert.equal(getKnownProductPrice("-1"), null);
  assert.equal(getKnownProductPrice("10"), 10);
});

test("vitamins landing excludes BCAA drinks with only description vitamin matches", () => {
  assert.equal(
    isVitaminLandingProductMatch({
      name: "Nocco BCAA Drink 330ml",
      brand: "NOCCO",
      category: "Amino Acids",
      description: "Sugar-free Added vitamins 180mg caffeine 3000mg BCAA's",
    }),
    false
  );
});

test("reviewed category landing rules reject known leakage and keep clear identities", () => {
  const cases = [
    {
      category: "magnesium",
      included: ["Magnesium Bisglycinate 1500mg", "BioTech USA ZMAttack 60 Capsules"],
      excluded: [
        "Children's Chewable Multivitamins Orange Flavour",
        "Chromium Complex",
      ],
    },
    {
      category: "glucosamine",
      included: [
        "Glucosamine Sulphate 1,500mg Tablets",
        "Glucosamine 500mg & Chondroitin",
      ],
      excluded: ["Vitamin C 500mg Capsules", "Omega 3 Capsules 500mg"],
    },
    {
      category: "vitamin-d",
      included: ["Vitamin D3 Tablets 2,000iu", "Per4m D3 & K2 120 Tablets"],
      excluded: ["Cod Liver Oil Capsules 550mg", "Vitamin C 500mg Capsules"],
    },
    {
      category: "omega-3",
      included: [
        "High Strength Omega 3 Fish Oil 1500mg",
        "Cod Liver Oil Liquid",
        "Strom Sports Flaxseed Oil 60 Softgels",
      ],
      excluded: [
        "Evening Primrose Oil 1500mg",
        "Starflower Oil Capsules 1000mg",
        "Nordic Naturals Omega-3 Cat - 60 ml",
      ],
    },
  ];

  for (const fixture of cases) {
    for (const name of fixture.included) {
      assert.equal(
        isReviewedLandingProductMatch(fixture.category, {
          name,
          brand: "Example Brand",
          category: "Health Supplements",
          description: null,
        }),
        true,
        `${fixture.category} should include ${name}`
      );
    }

    for (const name of fixture.excluded) {
      assert.equal(
        isReviewedLandingProductMatch(fixture.category, {
          name,
          brand: "Example Brand",
          category: "Vitamins",
          description:
            "Contains magnesium, glucosamine, Vitamin D and Omega 3 wording.",
        }),
        false,
        `${fixture.category} should exclude ${name}`
      );
    }
  }
});

test("vitamins landing excludes combination products whose primary identity is elsewhere", () => {
  const excludedProducts = [
    "Glucosamine 1,000mg with Vitamin C Tablets",
    "Omega 3 Capsules 500mg",
    "Collagen with Vitamin C",
    "Whey Protein with Vitamins",
  ];

  for (const name of excludedProducts) {
    assert.equal(
      isReviewedLandingProductMatch("vitamins", {
        name,
        brand: "Example Brand",
        category: "Vitamins",
        description: "Contains vitamins and minerals.",
      }),
      false,
      name
    );
  }
});

test("vitamins landing includes clear vitamin and mineral products", () => {
  const includedProducts = [
    "Vitamin C 500mg Capsules",
    "Vitamin D3 1000IU Tablets",
    "Zinc 15mg Tablets",
    "Magnesium Citrate Capsules",
    "Multivitamin A-Z Tablets",
  ];

  for (const name of includedProducts) {
    assert.equal(
      isVitaminLandingProductMatch({
        name,
        brand: "Example Brand",
        category: "Vitamins & Minerals",
        description: null,
      }),
      true,
      name
    );
  }
});

test("liquid does not return price per kg", () => {
  const deliveredPrice = getDeliveredPrice({ price: 24.98, shipping_cost: 0 });

  assert.equal(getVerifiedPricePerKg(deliveredPrice, 500, "liquid", true), null);
});

test("unverified liquid returns no price per litre", () => {
  const deliveredPrice = getDeliveredPrice({ price: 24.98, shipping_cost: 0 });

  assert.equal(
    getVerifiedPricePerLitre(deliveredPrice, 500, "liquid", false),
    null
  );
});

test("liquid with missing volume returns no price per litre", () => {
  const deliveredPrice = getDeliveredPrice({ price: 24.98, shipping_cost: 0 });

  assert.equal(
    getVerifiedPricePerLitre(deliveredPrice, null, "liquid", true),
    null
  );
});

test("liquid with zero or negative volume returns no price per litre", () => {
  const deliveredPrice = getDeliveredPrice({ price: 24.98, shipping_cost: 0 });

  assert.equal(getVerifiedPricePerLitre(deliveredPrice, 0, "liquid", true), null);
  assert.equal(
    getVerifiedPricePerLitre(deliveredPrice, -500, "liquid", true),
    null
  );
});
