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
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const mod = new Module(filename, module);
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (parent === mod && Object.hasOwn(mocks, request)) return mocks[request];
    if (request.endsWith("/indexabilityLifecycle")) return compileModule(path.join(process.cwd(), "app/lib/indexabilityLifecycle.ts"));
    if (request.endsWith("/lifecycleDataCache")) return { createLifecycleDataLoader: (_path, _version, load) => load };
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

const pricing = compileModule(path.join(process.cwd(), "app/lib/pricing.ts"));
const offerFreshness = compileModule(path.join(process.cwd(), "app/lib/offerFreshness.ts"));
const creatineLaunch = compileModule(path.join(process.cwd(), "app/lib/creatineLaunch.ts"), { "./offerFreshness": offerFreshness });
const nutritionMetrics = compileModule(path.join(process.cwd(), "app/lib/nutritionMetrics.ts"));
const proteinSubtypes = compileModule(path.join(process.cwd(), "app/lib/proteinSubtypes.ts"));
const categoryComparison = compileModule(path.join(process.cwd(), "app/lib/categoryComparison.ts"), {
  "./creatineLaunch": creatineLaunch,
  "./offerFreshness": offerFreshness,
  "./pricing": pricing,
});
const comparisonPath = path.join(process.cwd(), "app/lib/wheyIsolateComparison.ts");

function loadComparison(rows = []) {
  const builder = {
    select: () => builder, eq: () => builder, is: () => builder,
    gt: () => builder, order: () => builder,
    range: () => ({ data: rows, error: null }),
  };
  return compileModule(comparisonPath, {
    react: { cache: (fn) => fn },
    "./categoryComparison": categoryComparison,
    "./categoryComparisonVariants": { resolveCategoryComparisonVariants: async (products) => products },
    "./nutritionMetrics": nutritionMetrics,
    "./proteinSubtypes": proteinSubtypes,
    "./supabase": { supabase: { from: () => builder } },
  });
}

const FIXTURE_NOW = new Date("2026-08-01T12:00:00.000Z");
function rawOffer(id, retailerId, overrides = {}) {
  return {
    id, retailer_product_id: id + 100, price: 30, shipping_cost: 3.99,
    in_stock: true, last_checked_at: "2026-08-01T11:00:00.000Z",
    url: `https://retailer.example/${id}`,
    retailer: { id: retailerId, name: `Retailer ${retailerId}`, slug: `retailer-${retailerId}` },
    ...overrides,
  };
}
function rawProduct(id, name, offers = [rawOffer(id * 10, 1)], overrides = {}) {
  return {
    id, slug: `product-${id}`, name, brand: "Example Nutrition", category: "Whey Protein",
    image: null, product_format: "powder", net_weight_g: 1000, net_volume_ml: null,
    unit_count: null, unit_type: null, serving_count_verified: 40, serving_size_g: 25,
    protein_per_serving_g: 22, unit_pricing_verified: true, nutrition_verified: true,
    is_active: true, merged_into_product_id: null, merged_at: null, offers, ...overrides,
  };
}

test("Whey Isolate scope requires canonical category and explicit isolate identity", () => {
  const { isWheyIsolateProduct } = loadComparison();
  assert.equal(isWheyIsolateProduct(rawProduct(1, "Applied Nutrition ISO-XP 1kg")), true);
  assert.equal(isWheyIsolateProduct(rawProduct(2, "Example WPI 1kg")), true);
  assert.equal(isWheyIsolateProduct(rawProduct(3, "Example Whey Blend Isolate 1kg")), false);
  assert.equal(isWheyIsolateProduct(rawProduct(4, "Beef Isolate 1kg")), false);
  assert.equal(isWheyIsolateProduct(rawProduct(5, "Whey Isolate 1kg", [], { category: "Health Supplements" })), false);
  assert.equal(isWheyIsolateProduct(rawProduct(6, "Whey Protein 1kg")), false);
});

test("normalization keeps only fresh offers and measures distinct retailer overlap", () => {
  const { normalizeWheyIsolateComparison } = loadComparison();
  const products = [
    rawProduct(1, "Whey Isolate One", [rawOffer(10, 1), rawOffer(11, 2), rawOffer(12, 2)]),
    rawProduct(2, "Whey Isolate Two", [rawOffer(20, 1), rawOffer(21, 2, { last_checked_at: "2026-07-07T11:59:59.000Z" })]),
  ];
  const result = normalizeWheyIsolateComparison(products, { now: FIXTURE_NOW });
  assert.equal(result.summary.visibleProducts, 2);
  assert.equal(result.summary.freshOffers, 4);
  assert.equal(result.summary.productsWithMultipleFreshRetailers, 1);
  assert.equal(result.rows[0].name, "Whey Isolate One");
});

test("indexability uses the unchanged 3-product, 2-retailer and 20-offer gate", () => {
  const { evaluateWheyIsolateIndexability, WHEY_ISOLATE_INDEX_GATE } = loadComparison();
  assert.deepEqual(WHEY_ISOLATE_INDEX_GATE, {
    minimumProductsWithMultipleFreshRetailers: 3,
    minimumFreshRetailersAcrossComparisons: 2,
    minimumFreshOffers: 20,
  });
  assert.equal(evaluateWheyIsolateIndexability({ visibleProducts: 16, freshOffers: 78, freshRetailers: 4, productsWithMultipleFreshRetailers: 3, latestOfferCheckedAt: "2026-08-01T11:00:00Z", staleOrUnusableOffersExcluded: 0 }, true).indexable, true);
  assert.equal(evaluateWheyIsolateIndexability({ visibleProducts: 16, freshOffers: 78, freshRetailers: 4, productsWithMultipleFreshRetailers: 2, latestOfferCheckedAt: "2026-08-01T11:00:00Z", staleOrUnusableOffersExcluded: 0 }, true).indexable, false);
});

test("production query stays bounded to active Whey Protein products", async () => {
  const calls = [];
  const builder = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); return name === "range" ? { data: [], error: null } : builder; } });
  const comparison = compileModule(comparisonPath, {
    react: { cache: (fn) => fn },
    "./categoryComparison": categoryComparison,
    "./categoryComparisonVariants": { resolveCategoryComparisonVariants: async (products) => products },
    "./nutritionMetrics": nutritionMetrics,
    "./proteinSubtypes": proteinSubtypes,
    "./supabase": { supabase: { from: (table) => { calls.push(["from", table]); return builder; } } },
  });
  await comparison.getWheyIsolateComparison();
  assert.ok(calls.some((row) => row[0] === "eq" && row[1] === "category" && row[2] === "Whey Protein"));
  assert.ok(calls.some((row) => row[0] === "range" && row[1] === 0 && row[2] === 999));
});

test("page metadata, SSR, structured data and discovery links use one canonical", async () => {
  const comparison = loadComparison();
  const normalized = comparison.normalizeWheyIsolateComparison([
    rawProduct(1, "Whey Isolate One", [rawOffer(10, 1), rawOffer(11, 2)]),
  ], { now: FIXTURE_NOW });
  const result = { ...normalized, error: false };
  const Link = ({ href, children, ...props }) => React.createElement("a", { href: typeof href === "string" ? href : "#", ...props }, children);
  const page = compileModule(path.join(process.cwd(), "app/whey-isolate/page.tsx"), {
    next: {}, "next/link": { __esModule: true, default: Link },
    "../components/ComparisonProductVisuals": require("./test-helpers/comparison-product-visuals"),
    "../components/CategoryViewAnalytics": { __esModule: true, default: () => null },
    "../components/ComparisonTransparencyLinks": { __esModule: true, default: () => React.createElement("a", { href: "/how-we-compare" }, "Method") },
    "../lib/pricing": pricing,
    "../lib/wheyIsolateComparison": { ...comparison, getWheyIsolateComparison: async () => result },
  });
  const metadata = await page.generateMetadata();
  assert.equal(metadata.alternates.canonical, "/whey-isolate");
  assert.equal(metadata.title, "Whey Isolate Prices UK – Delivered Cost");
  const html = renderToStaticMarkup(React.createElement(page.WheyIsolatePageContent, { result }));
  assert.match(html, /Whey Isolate Prices UK – Compare Delivered Cost/);
  assert.match(html, /explicit isolate, ISO or WPI identity/);
  assert.match(html, /coverage and price ordering, not a nutritional or health ranking/);
  assert.match(html, /Lowest known delivered Whey Isolate prices/);
  assert.match(html, /Which Whey Isolate has the lowest known delivered price\?/);
  assert.match(html, /has the lowest delivered total at £33\.99/);
  const lowestRows = page.getLowestDeliveredWheyIsolateRows([
    { ...result.rows[0], id: 2, name: "Higher price", bestOffer: { ...result.rows[0].bestOffer, deliveredPrice: { totalPrice: 40, shippingCost: 10 } } },
    result.rows[0],
  ]);
  assert.deepEqual(lowestRows.map((row) => row.name), ["Whey Isolate One", "Higher price"]);
  const schema = page.buildWheyIsolateStructuredData(result.rows);
  assert.deepEqual(schema["@graph"].map((node) => node["@type"]), ["CollectionPage", "ItemList", "BreadcrumbList"]);
  const sitemap = fs.readFileSync(path.join(process.cwd(), "app/sitemap.ts"), "utf8");
  const home = fs.readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8");
  const whey = fs.readFileSync(path.join(process.cwd(), "app/whey-protein/page.tsx"), "utf8");
  assert.equal((sitemap.match(/\/whey-isolate/g) || []).length, 1);
  assert.match(home, /Whey isolate", href: "\/whey-isolate"/);
  assert.match(whey, /href="\/whey-isolate"/);
});
