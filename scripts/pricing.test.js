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

    if (parent === mod && request === "./supabase") {
      return { supabase: {} };
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
  getVerifiedPricePerKg,
  getVerifiedPricePerLitre,
  getVerifiedPricePerServing,
  getVerifiedPricePerUnit,
  formatUnitPrice,
} = pricingModule;
const { isVitaminLandingProductMatch, normalizeSearchOffers } = loadProductsModule();

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

test("search offer ranking prefers known delivered total over null shipping", () => {
  const offers = normalizeSearchOffers([
    {
      id: "unknown-delivery",
      price: 10,
      shipping_cost: null,
      url: "https://retailer.example/unknown",
      in_stock: true,
      retailer: { id: "1", name: "Retailer One", slug: "retailer-one" },
    },
    {
      id: "known-delivery",
      price: 12,
      shipping_cost: 1.99,
      url: "https://retailer.example/known",
      in_stock: true,
      retailer: { id: "2", name: "Retailer Two", slug: "retailer-two" },
    },
  ]);

  assert.equal(getDeliveredPrice({ price: 10, shipping_cost: null }), null);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].id, "known-delivery");
  assert.equal(offers[0].deliveredPrice.totalPrice, 13.99);
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
