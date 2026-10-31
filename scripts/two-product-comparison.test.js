const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

function compileModule(filename, mocks = {}) {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const mod = new Module(filename, module);
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (parent === mod && Object.hasOwn(mocks, request)) return mocks[request];
    if (request.endsWith("/indexabilityLifecycle")) {
      return compileModule(path.join(process.cwd(), "app/lib/indexabilityLifecycle.ts"));
    }
    if (request.endsWith("/lifecycleDataCache")) {
      return { createLifecycleDataLoader: (_path, _version, load) => load };
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

const root = process.cwd();
const pricing = compileModule(path.join(root, "app/lib/pricing.ts"));
const offerFreshness = compileModule(path.join(root, "app/lib/offerFreshness.ts"));
const creatineLaunch = compileModule(path.join(root, "app/lib/creatineLaunch.ts"), {
  "./offerFreshness": offerFreshness,
});
const nutritionMetrics = compileModule(path.join(root, "app/lib/nutritionMetrics.ts"));
const categoryComparison = compileModule(path.join(root, "app/lib/categoryComparison.ts"), {
  "./creatineLaunch": creatineLaunch,
  "./offerFreshness": offerFreshness,
  "./pricing": pricing,
});
const productOfferPresentation = compileModule(
  path.join(root, "app/lib/productOfferPresentation.ts"),
  { "./pricing": pricing }
);
const productComparisonMetrics = compileModule(
  path.join(root, "app/lib/productComparisonMetrics.ts"),
  { "./pricing": pricing }
);
const comparisonPath = path.join(root, "app/lib/twoProductComparison.ts");

function loadComparison(overrides = {}) {
  return compileModule(comparisonPath, {
    react: { cache: (fn) => fn },
    "./categoryComparison": categoryComparison,
    "./categoryComparisonVariants": {
      resolveCategoryComparisonVariants: async (products) => products,
    },
    "./nutritionMetrics": nutritionMetrics,
    "./pricing": pricing,
    "./reviewedPreWorkoutFacts.server": {
      loadAppliedPreWorkoutFacts: async () => new Map(),
    },
    "./supabase": { supabase: { from: () => ({}) } },
    ...overrides,
  });
}

const NOW = new Date("2026-08-26T12:00:00.000Z");

function offer(id, overrides = {}) {
  return {
    id,
    retailer_product_id: id + 1000,
    price: 20,
    shipping_cost: 3.99,
    in_stock: true,
    last_checked_at: "2026-08-26T11:00:00.000Z",
    url: `https://retailer.example/${id}`,
    retailer: { id: 1, name: "Retailer One", slug: "retailer-one" },
    product_variant: {
      id: id + 2000,
      display_name: "500g",
      flavour_label: null,
      pack_count: 1,
      size_value: 500,
      size_unit: "g",
      product_format: "powder",
      nutrition_override: null,
      is_active: true,
    },
    variant_resolution: "resolved",
    ...overrides,
  };
}

function product(id, offers = [offer(id * 10)], overrides = {}) {
  return {
    id,
    slug: `product-${id}`,
    name: `Product ${id}`,
    brand: "Example",
    category: "Protein",
    image: null,
    product_format: "powder",
    net_weight_g: 9999,
    net_volume_ml: null,
    unit_count: null,
    unit_type: null,
    serving_count_verified: null,
    serving_size_g: null,
    protein_per_serving_g: null,
    creatine_per_serving_g: null,
    unit_pricing_verified: false,
    nutrition_verified: false,
    is_active: true,
    merged_into_product_id: null,
    merged_at: null,
    offers,
    ...overrides,
  };
}

test("exact pack identity never assumes one pack or falls back to product fields", () => {
  const comparison = loadComparison();
  assert.equal(comparison.exactPackLabel(offer(1)), "500g");
  assert.equal(
    comparison.exactPackLabel(
      offer(2, { product_variant: { ...offer(2).product_variant, pack_count: 2 } })
    ),
    "2 x 500g"
  );
  for (const missing of ["pack_count", "size_value", "size_unit"]) {
    const variant = { ...offer(3).product_variant };
    variant[missing] = null;
    assert.equal(comparison.exactPackLabel(offer(3, { product_variant: variant })), null, missing);
  }
  assert.equal(comparison.exactPackLabel(offer(4, { variant_resolution: "unresolved" })), null);
  assert.equal(comparison.exactPackLabel(offer(5, { product_variant: { ...offer(5).product_variant, is_active: false } })), null);
});

test("normalization ranks only fresh exact packs but retains active unavailable products", () => {
  const comparison = loadComparison();
  const result = comparison.normalizeTwoProductComparison([
    product(1),
    product(2, [offer(20, { shipping_cost: null })]),
    product(3, [offer(30, { variant_resolution: "unresolved" })]),
    product(4, [offer(40, { last_checked_at: "2026-08-25T11:59:59.000Z" })]),
  ], { now: NOW });
  assert.deepEqual(result.rows.map((row) => row.id), ["1", "2", "3", "4"]);
  assert.equal(result.rows[0].exactPackLabel, "500g");
  assert.ok(Math.abs(result.rows[0].bestOffer.deliveredPrice.totalPrice - 23.99) < 0.001);
  assert.equal(result.rows[0].netWeightG, 500);
  assert.equal(result.rows[1].bestOffer.deliveredPrice, null);
  assert.equal(result.rows[1].bestOffer.productPrice, 20);
  assert.equal(result.rows[2].bestOffer, null);
  assert.equal(result.rows[3].bestOffer, null);
  assert.equal(result.rows[3].presentationState, "RECENT");
});

test("one product card never mixes offers from different canonical variants", () => {
  const comparison = loadComparison();
  const wideVariant = { ...offer(1).product_variant, id: 7001, size_value: 500 };
  const smallVariant = { ...offer(1).product_variant, id: 7002, size_value: 250 };
  const result = comparison.normalizeTwoProductComparison([
    product(1, [
      offer(10, { product_variant: wideVariant }),
      offer(11, {
        product_variant: wideVariant,
        retailer: { id: 2, name: "Retailer Two", slug: "retailer-two" },
      }),
      offer(12, { price: 5, product_variant: smallVariant }),
    ]),
  ], { now: NOW });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].exactPackLabel, "500g");
  assert.equal(result.rows[0].offerCount, 2);
  assert.equal(result.rows[0].retailerCount, 2);
  assert.deepEqual(result.rows[0].offers.map((candidate) => candidate.id), ["10", "11"]);
});

test("selection parsing is strict and all neutral states are explicit", () => {
  const comparison = loadComparison();
  const rows = comparison.normalizeTwoProductComparison([product(1), product(2)], { now: NOW }).rows;
  assert.equal(comparison.normalizeComparisonProductId("01"), null);
  assert.equal(comparison.normalizeComparisonProductId(["1"]), null);
  assert.equal(comparison.selectTwoProducts(rows, null, null).state, "empty");
  assert.equal(comparison.selectTwoProducts(rows, "1", null).state, "partial");
  assert.equal(comparison.selectTwoProducts(rows, "1", "1").state, "duplicate");
  assert.equal(comparison.selectTwoProducts(rows, "1", "999").state, "not_found");
  assert.equal(comparison.selectTwoProducts(rows, "1", "2").state, "ready");
});

test("known delivery produces an objective winner while unknown delivery never does", () => {
  const comparison = loadComparison();
  const knownRows = comparison.normalizeTwoProductComparison([
    product(1, [offer(10, { price: 20, shipping_cost: 3 })]),
    product(2, [offer(20, { price: 25, shipping_cost: 4 })]),
  ], { now: NOW }).rows;
  const knownMetrics = productComparisonMetrics.buildProductComparisonMetrics(
    knownRows[0],
    knownRows[1]
  );
  assert.equal(
    knownMetrics.find((metric) => metric.key === "delivered_total").outcome,
    "left"
  );

  const uncertainRows = comparison.normalizeTwoProductComparison([
    product(1, [offer(10, { price: 20, shipping_cost: 3 })]),
    product(2, [offer(20, { price: 19, shipping_cost: null })]),
  ], { now: NOW }).rows;
  const uncertainMetrics = productComparisonMetrics.buildProductComparisonMetrics(
    uncertainRows[0],
    uncertainRows[1]
  );
  const delivered = uncertainMetrics.find((metric) => metric.key === "delivered_total");
  assert.equal(delivered.label, "Known delivered total");
  assert.equal(delivered.outcome, null);
  assert.equal(delivered.right.display, "Delivery calculated by retailer");
});

test("lower cost per serving wins, equal displayed values tie, and missing rows stay hidden", () => {
  const comparison = loadComparison();
  const rows = comparison.normalizeTwoProductComparison([product(1), product(2)], { now: NOW }).rows;
  const left = { ...rows[0], pricePerServing: 0.995 };
  const right = { ...rows[1], pricePerServing: 1.25 };
  const metrics = productComparisonMetrics.buildProductComparisonMetrics(left, right);
  const perServing = metrics.find((metric) => metric.key === "price_per_serving");
  assert.equal(perServing.outcome, "left");
  assert.ok(
    productComparisonMetrics.buildQuickComparisonVerdict(metrics).left.includes(
      "Lower cost per serving"
    )
  );

  const tied = productComparisonMetrics.buildProductComparisonMetrics(
    { ...left, pricePerServing: 1.001 },
    { ...right, pricePerServing: 1.004 }
  ).find((metric) => metric.key === "price_per_serving");
  assert.equal(tied.outcome, "tie");
  assert.equal(tied.tieLabel, "Same cost per serving");

  const missing = productComparisonMetrics.buildProductComparisonMetrics(
    { ...rows[0], proteinPerServingG: null, costPer25gProtein: null },
    { ...rows[1], proteinPerServingG: null, costPer25gProtein: null }
  );
  assert.equal(missing.some((metric) => metric.key === "protein_per_serving"), false);
  assert.equal(missing.some((metric) => metric.key === "cost_per_25g_protein"), false);
});

test("category-aware facts are evidence-backed and information-only amounts never win", () => {
  const comparison = loadComparison();
  const rows = comparison.normalizeTwoProductComparison([product(1), product(2)], { now: NOW }).rows;
  const proteinMetrics = productComparisonMetrics.buildProductComparisonMetrics(
    { ...rows[0], category: "Protein", proteinPerServingG: 20 },
    { ...rows[1], category: "Whey Protein", proteinPerServingG: 25 }
  );
  assert.equal(
    proteinMetrics.find((metric) => metric.key === "protein_per_serving").outcome,
    "right"
  );

  const creatineMetrics = productComparisonMetrics.buildProductComparisonMetrics(
    { ...rows[0], category: "Creatine", creatinePerServingG: 5 },
    { ...rows[1], category: "Creatine", creatinePerServingG: 3 }
  );
  const creatine = creatineMetrics.find((metric) => metric.key === "creatine_per_serving");
  assert.equal(creatine.direction, "INFORMATION_ONLY");
  assert.equal(creatine.outcome, null);

  const preWorkoutMetrics = productComparisonMetrics.buildProductComparisonMetrics(
    {
      ...rows[0],
      category: "Pre Workout",
      preWorkoutFacts: {
        productId: "1",
        productVariantId: "2010",
        caffeineFreeConfirmed: false,
        facts: [{
          key: "caffeine",
          informationState: "present_with_amount",
          amountPerServingMg: 250,
          servingSizeValue: 10,
          servingSizeUnit: "g",
          servingBasisText: "One scoop",
          ingredientForm: null,
          ingredientRatio: null,
          sourceKinds: ["product_label"],
        }],
      },
    },
    {
      ...rows[1],
      category: "Pre Workout",
      preWorkoutFacts: {
        productId: "2",
        productVariantId: "2020",
        caffeineFreeConfirmed: true,
        facts: [{
          key: "caffeine",
          informationState: "confirmed_absent",
          amountPerServingMg: null,
          servingSizeValue: null,
          servingSizeUnit: null,
          servingBasisText: null,
          ingredientForm: null,
          ingredientRatio: null,
          sourceKinds: ["product_label"],
        }],
      },
    }
  );
  const caffeine = preWorkoutMetrics.find((metric) => metric.key === "caffeine_per_serving");
  assert.equal(caffeine.direction, "INFORMATION_ONLY");
  assert.equal(caffeine.outcome, null);
  assert.equal(caffeine.right.display, "Confirmed absent");
});

test("cross-category comparison keeps universal metrics and suppresses incompatible facts", () => {
  const comparison = loadComparison();
  const rows = comparison.normalizeTwoProductComparison([product(1), product(2)], { now: NOW }).rows;
  const left = { ...rows[0], category: "Protein", proteinPerServingG: 25 };
  const right = { ...rows[1], category: "Creatine", creatinePerServingG: 5 };
  const metrics = productComparisonMetrics.buildProductComparisonMetrics(left, right);
  assert.equal(productComparisonMetrics.isCrossCategoryComparison(left, right), true);
  assert.ok(metrics.some((metric) => metric.key === "product_price"));
  assert.equal(metrics.some((metric) => metric.key === "protein_per_serving"), false);
  assert.equal(metrics.some((metric) => metric.key === "creatine_per_serving"), false);
});

test("out-of-stock exact variants remain identifiable without a stale current price", () => {
  const comparison = loadComparison();
  const [row] = comparison.normalizeTwoProductComparison([
    product(1, [offer(10, { in_stock: false })]),
  ], { now: NOW }).rows;
  assert.equal(row.presentationState, "OUT_OF_STOCK");
  assert.equal(row.bestOffer, null);
  assert.equal(row.exactVariantLabel, "500g");
});

test("price history summary ignores invalid values and reports the comparable period", () => {
  const comparison = loadComparison();
  const summary = comparison.summarizeComparisonPriceHistory([
    { offer_id: 1, total_price: 24.99, checked_at: "2026-08-01T10:00:00.000Z" },
    { offer_id: 1, total_price: 20.5, checked_at: "2026-08-03T10:00:00.000Z" },
    { offer_id: 1, total_price: null, checked_at: "2026-08-04T10:00:00.000Z" },
    { offer_id: 1, total_price: 19, checked_at: "invalid" },
  ]);
  assert.deepEqual(summary, {
    lowestDeliveredPrice: 20.5,
    firstRecordedAt: "2026-08-01T10:00:00.000Z",
    lastRecordedAt: "2026-08-03T10:00:00.000Z",
    recordCount: 2,
  });
});

test("search and product pages expose secondary compare entry points without bypassing tracked offers", () => {
  const searchCard = fs.readFileSync(path.join(root, "app/components/ProductResultCard.tsx"), "utf8");
  const productPage = fs.readFileSync(path.join(root, "app/product/[id]/page.tsx"), "utf8");
  const comparePage = fs.readFileSync(path.join(root, "app/compare/page.tsx"), "utf8");
  for (const source of [searchCard, productPage]) {
    assert.match(source, /pathname:\s*"\/compare"/);
    assert.match(source, /query:\s*\{\s*left:/);
    assert.match(source, />\s*Compare\s*</);
  }
  assert.match(comparePage, /#retailer-offers/);
  assert.doesNotMatch(comparePage, /href=\{row\.bestOffer\.url\}/);
  assert.match(comparePage, /overflow-x-clip/);
  assert.match(comparePage, /grid-cols-2/);
});

test("complete catalogue query is paginated and exact variant resolution is strict", async () => {
  const calls = [];
  const rows = [product(1, [offer(10, { last_checked_at: new Date().toISOString() })])];
  const builder = new Proxy({}, {
    get: (_target, name) => (...args) => {
      calls.push([name, ...args]);
      return name === "range" ? { data: rows, error: null, count: 1 } : builder;
    },
  });
  let resolverOptions;
  const comparison = loadComparison({
    "./categoryComparisonVariants": {
      resolveCategoryComparisonVariants: async (products, options) => {
        resolverOptions = options;
        return products;
      },
    },
    "./supabase": {
      supabase: { from: (table) => { calls.push(["from", table]); return builder; } },
    },
  });
  const result = await comparison.getTwoProductComparison();
  assert.equal(result.error, false);
  assert.deepEqual(resolverOptions, { failOnError: true });
  assert.ok(calls.some((call) => call[0] === "range" && call[1] === 0 && call[2] === 199));
  assert.ok(calls.some((call) => call[0] === "select" && call[2]?.count === "exact"));
});

test("live-verified base is indexable while parameters stay noindex and no winner is claimed", async () => {
  const comparison = loadComparison();
  const normalized = comparison.normalizeTwoProductComparison([product(1), product(2)], { now: NOW });
  const result = { ...normalized, error: false };
  const Link = ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children);
  const page = compileModule(path.join(root, "app/compare/page.tsx"), {
    next: {},
    "next/link": { __esModule: true, default: Link },
    "../components/CategoryViewAnalytics": { __esModule: true, default: () => null },
    "../components/ComparisonCompletionAnalytics": { __esModule: true, default: () => null },
    "../components/ComparisonProductVisuals": require("./test-helpers/comparison-product-visuals"),
    "../components/ComparisonTransparencyLinks": { __esModule: true, default: () => React.createElement("a", { href: "/how-we-compare" }, "Method") },
    "../components/StatusBadge": { __esModule: true, default: ({ children }) => React.createElement("span", null, children) },
    "../components/SupplementScoutIcon": { __esModule: true, default: () => React.createElement("span", { "aria-hidden": "true" }) },
    "../lib/offerFreshness": offerFreshness,
    "../lib/productComparisonMetrics": productComparisonMetrics,
    "../lib/productOfferPresentation": productOfferPresentation,
    "../lib/twoProductComparison": { ...comparison, getTwoProductComparison: async () => result },
  });
  const baseMetadata = await page.generateMetadata();
  assert.deepEqual(baseMetadata.robots, { index: true, follow: true });
  assert.equal(baseMetadata.alternates.canonical, "/compare");
  const parameterMetadata = await page.generateMetadata({ searchParams: Promise.resolve({ left: "1", right: "2" }) });
  assert.deepEqual(parameterMetadata.robots, { index: false, follow: true });
  const html = renderToStaticMarkup(React.createElement(page.TwoProductComparisonPageContent, {
    result,
    params: { left: "1", right: "2" },
  }));
  assert.match(html, /Compare two supplements side by side/);
  assert.match(html, /Selected variant: 500g/);
  assert.match(html, /Total delivered price/);
  assert.match(html, /not an overall score or a quality recommendation/i);
  assert.doesNotMatch(html, /is the winner|best product|recommended product/i);
  assert.deepEqual(page.buildTwoProductComparisonStructuredData()["@graph"].map((node) => node["@type"]), ["WebPage", "BreadcrumbList"]);
});
