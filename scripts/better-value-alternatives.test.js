const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function compileModule(filename, mocks = {}) {
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
    if (parent === mod && Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
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

const featurePath = path.join(
  process.cwd(),
  "app",
  "lib",
  "betterValueAlternatives.ts"
);
const featureSource = fs.readFileSync(featurePath, "utf8");
const productPageSource = fs.readFileSync(
  path.join(process.cwd(), "app", "product", "[id]", "page.tsx"),
  "utf8"
);
const analyticsSource = fs.readFileSync(
  path.join(process.cwd(), "app", "components", "ProductAnalytics.tsx"),
  "utf8"
);

const { selectBetterValueAlternatives } = compileModule(featurePath, {
  "server-only": {},
  react: { cache: (fn) => fn },
  "./categoryComparison": { normalizeCategoryComparison: () => ({ rows: [] }) },
  "./categoryComparisonVariants": {
    resolveCategoryComparisonVariants: async (products) => products,
  },
  "./nutritionMetrics": { getEffectiveNutritionMetrics: (product) => product },
  "./supabase": { supabase: {} },
});

function row(id, overrides = {}) {
  return {
    id: String(id),
    name: `Product ${id}`,
    brand: "Example",
    category: "Whey Protein",
    image: null,
    productUrl: `/product/${id}`,
    productFormat: "powder",
    presentationState: "LIVE",
    bestOffer: {
      variantResolution: "resolved",
      deliveredPrice: { productPrice: 20, shippingCost: 0, totalPrice: 20 },
    },
    costPer25gProtein: null,
    pricePerServing: null,
    pricePerKg: null,
    pricePerUnit: null,
    ...overrides,
  };
}

const options = {
  currentProductId: "current",
  category: "Whey Protein",
  productFormat: "powder",
};

test("selects at most three cheaper alternatives on one shared verified basis", () => {
  const result = selectBetterValueAlternatives(
    [
      row("current", { costPer25gProtein: 1 }),
      row("d", { costPer25gProtein: 0.8 }),
      row("b", { costPer25gProtein: 0.6 }),
      row("c", { costPer25gProtein: 0.7 }),
      row("a", { costPer25gProtein: 0.6, name: "Alpha" }),
      row("higher", { costPer25gProtein: 1.1 }),
    ],
    options
  );

  assert.equal(result.basis, "cost_per_25g_protein");
  assert.equal(result.currentValue, 1);
  assert.deepEqual(result.rows.map((candidate) => candidate.id), ["a", "b", "c"]);
  assert.ok(result.rows.every((candidate) => candidate.value < result.currentValue));
});

test("excludes stale, unavailable, unresolved, mismatched and incomparable candidates", () => {
  const result = selectBetterValueAlternatives(
    [
      row("current", { pricePerServing: 2 }),
      row("valid", { pricePerServing: 1.5 }),
      row("stale", { pricePerServing: 1, presentationState: "RECHECK" }),
      row("unavailable", { pricePerServing: 1, presentationState: "UNAVAILABLE" }),
      row("unresolved", {
        pricePerServing: 1,
        bestOffer: { variantResolution: "unresolved", deliveredPrice: { totalPrice: 10 } },
      }),
      row("unknown-delivery", {
        pricePerServing: 1,
        bestOffer: { variantResolution: "resolved", deliveredPrice: null },
      }),
      row("category", { pricePerServing: 1, category: "Creatine" }),
      row("format", { pricePerServing: 1, productFormat: "capsule" }),
      row("incomparable", { pricePerKg: 1 }),
    ],
    options
  );

  assert.equal(result.basis, "price_per_serving");
  assert.deepEqual(result.rows.map((candidate) => candidate.id), ["valid"]);
});

test("falls through to the first basis with a cheaper comparable candidate", () => {
  const result = selectBetterValueAlternatives(
    [
      row("current", {
        costPer25gProtein: 1,
        pricePerServing: 2,
        pricePerKg: 30,
      }),
      row("protein-higher", {
        costPer25gProtein: 1.1,
        pricePerServing: 1.5,
        pricePerKg: 20,
      }),
      row("kg-only", { pricePerKg: 10 }),
    ],
    options
  );

  assert.equal(result.basis, "price_per_serving");
  assert.deepEqual(result.rows.map((candidate) => candidate.id), ["protein-higher"]);
});

test("unit comparisons require the same verified unit type", () => {
  const capsuleOptions = { ...options, productFormat: "capsule" };
  const result = selectBetterValueAlternatives(
    [
      row("current", {
        productFormat: "capsule",
        pricePerUnit: { price: 0.5, unitType: "capsule" },
      }),
      row("tablet", {
        productFormat: "capsule",
        pricePerUnit: { price: 0.2, unitType: "tablet" },
      }),
      row("capsule", {
        productFormat: "capsule",
        pricePerUnit: { price: 0.3, unitType: "capsule" },
      }),
    ],
    capsuleOptions
  );

  assert.equal(result.basis, "price_per_unit");
  assert.deepEqual(result.rows.map((candidate) => candidate.id), ["capsule"]);
});

test("fails closed when the current product lacks a resolved current offer", () => {
  for (const current of [
    row("current", { presentationState: "RECHECK", pricePerKg: 20 }),
    row("current", {
      pricePerKg: 20,
      bestOffer: { variantResolution: "unresolved", deliveredPrice: { totalPrice: 20 } },
    }),
  ]) {
    assert.deepEqual(
      selectBetterValueAlternatives([current, row("candidate", { pricePerKg: 10 })], options),
      { basis: null, currentValue: null, rows: [] }
    );
  }
});

test("loader reuses comparison contracts, paginates completely and has no write path", () => {
  assert.match(featureSource, /normalizeCategoryComparison/);
  assert.match(featureSource, /resolveCategoryComparisonVariants/);
  assert.match(featureSource, /getEffectiveNutritionMetrics/);
  assert.match(featureSource, /\{ count: "exact" \}/);
  assert.match(featureSource, /\.eq\("category", category\)/);
  assert.match(featureSource, /\.eq\("product_format", productFormat\)/);
  assert.match(featureSource, /\.range\(from, from \+ BETTER_VALUE_PAGE_SIZE - 1\)/);
  assert.doesNotMatch(featureSource, /\.(?:insert|update|upsert|delete)\(/);
});

test("product page renders only the bounded section and tracks impressions and clicks", () => {
  assert.match(productPageSource, /betterValueAlternatives\.rows\.length > 0/);
  assert.match(productPageSource, /Better-value alternatives/);
  assert.match(productPageSource, /Compare ingredients and serving directions/);
  assert.match(productPageSource, /BetterValueAlternativesImpression/);
  assert.match(productPageSource, /BetterValueAlternativeLink/);
  assert.match(analyticsSource, /view_better_value_alternatives/);
  assert.match(analyticsSource, /select_better_value_alternative/);
  assert.doesNotMatch(analyticsSource, /preventDefault/);
});
