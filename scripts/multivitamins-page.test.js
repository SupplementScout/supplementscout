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
  } finally { Module._load = originalLoad; }
  return mod.exports;
}

const pricing = compileModule(path.join(process.cwd(), "app/lib/pricing.ts"));
const offerFreshness = compileModule(path.join(process.cwd(), "app/lib/offerFreshness.ts"));
const creatineLaunch = compileModule(path.join(process.cwd(), "app/lib/creatineLaunch.ts"), { "./offerFreshness": offerFreshness });
const categoryComparison = compileModule(path.join(process.cwd(), "app/lib/categoryComparison.ts"), { "./creatineLaunch": creatineLaunch, "./pricing": pricing });
const comparisonPath = path.join(process.cwd(), "app/lib/multivitaminsComparison.ts");

function loadComparison(rows = []) {
  const builder = { select: () => builder, eq: () => builder, is: () => builder, in: () => builder, gt: () => builder, order: () => builder, range: () => ({ data: rows, error: null }) };
  return compileModule(comparisonPath, {
    react: { cache: (fn) => fn },
    "./categoryComparison": categoryComparison,
    "./supabase": { supabase: { from: () => builder } },
  });
}

const FIXTURE_NOW = new Date("2026-08-11T12:00:00.000Z");
function rawOffer(id, retailerId, overrides = {}) {
  return { id, retailer_product_id: id + 100, price: 15, shipping_cost: 3.99, in_stock: true, last_checked_at: "2026-08-11T11:00:00.000Z", url: `https://retailer.example/${id}`, retailer: { id: retailerId, name: `Retailer ${retailerId}`, slug: `retailer-${retailerId}` }, ...overrides };
}
function rawProduct(id, name, offers = [rawOffer(id * 10, 1)], overrides = {}) {
  return { id, slug: `product-${id}`, name, brand: "Example Nutrition", category: "Vitamins", image: null, product_format: "capsule", net_weight_g: null, net_volume_ml: null, unit_count: 60, unit_type: "capsule", serving_count_verified: null, serving_size_g: null, protein_per_serving_g: null, unit_pricing_verified: false, nutrition_verified: false, is_active: true, merged_into_product_id: null, merged_at: null, offers, ...overrides };
}

test("Multivitamins scope uses the exact reviewed name and category boundary", () => {
  const { isMultivitaminsProduct } = loadComparison();
  assert.equal(isMultivitaminsProduct(rawProduct(1, "Example Multivitamin 60 Capsules")), true);
  assert.equal(isMultivitaminsProduct(rawProduct(2, "Example Multi-Vitamins 60 Tablets")), true);
  assert.equal(isMultivitaminsProduct(rawProduct(3, "Strom MultiMAX Multivitamins 180 Tabs", [], { category: "Health Supplements" })), true);
  assert.equal(isMultivitaminsProduct(rawProduct(4, "Multi Mineral Complex")), false);
  assert.equal(isMultivitaminsProduct(rawProduct(5, "Example Multivitamin", [], { category: "Pre Workout" })), false);
  assert.equal(isMultivitaminsProduct(rawProduct(6, "Old Multivitamin", [], { is_active: false })), false);
});

test("normalization uses the strict 24-hour window and retailer overlap", () => {
  const { normalizeMultivitaminsComparison } = loadComparison();
  const products = [
    rawProduct(1, "Multivitamin One", [rawOffer(10, 1), rawOffer(11, 2)]),
    rawProduct(2, "Multivitamin Two", [rawOffer(20, 1), rawOffer(21, 2, { last_checked_at: "2026-08-10T11:59:59.000Z" })]),
  ];
  const result = normalizeMultivitaminsComparison(products, { now: FIXTURE_NOW });
  assert.equal(result.summary.visibleProducts, 2);
  assert.equal(result.summary.freshOffers, 3);
  assert.equal(result.summary.productsWithMultipleFreshRetailers, 1);
});

test("indexability retains the unchanged 3-product, 2-retailer and 20-offer gate", () => {
  const { evaluateMultivitaminsIndexability, MULTIVITAMINS_INDEX_GATE } = loadComparison();
  assert.deepEqual(MULTIVITAMINS_INDEX_GATE, { minimumProductsWithMultipleFreshRetailers: 3, minimumFreshRetailersAcrossComparisons: 2, minimumFreshOffers: 20 });
  const summary = { scopedProducts: 18, visibleProducts: 16, freshOffers: 20, freshRetailers: 4, productsWithOneFreshRetailer: 12, productsWithMultipleFreshRetailers: 4, freshRetailersAcrossComparisons: 4, staleOrUnusableOffersExcluded: 0, latestOfferCheckedAt: "2026-08-11T11:00:00Z" };
  assert.equal(evaluateMultivitaminsIndexability(summary, true).indexable, true);
  assert.equal(evaluateMultivitaminsIndexability({ ...summary, freshOffers: 19 }, true).indexable, false);
});

test("production query remains bounded and applies the reviewed scope in code", async () => {
  const calls = [];
  const builder = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); return name === "range" ? { data: [], error: null } : builder; } });
  const comparison = compileModule(comparisonPath, { react: { cache: (fn) => fn }, "./categoryComparison": categoryComparison, "./supabase": { supabase: { from: (table) => { calls.push(["from", table]); return builder; } } } });
  await comparison.getMultivitaminsComparison();
  assert.ok(calls.some((row) => row[0] === "in" && row[1] === "category" && row[2].join(",") === "Vitamins,Health Supplements"));
  assert.ok(calls.some((row) => row[0] === "range" && row[1] === 0 && row[2] === 999));
});

test("page metadata, SSR, structured data and discovery links use one canonical", async () => {
  const comparison = loadComparison();
  const normalized = comparison.normalizeMultivitaminsComparison([rawProduct(1, "Multivitamin One", [rawOffer(10, 1), rawOffer(11, 2)])], { now: FIXTURE_NOW });
  const result = { ...normalized, error: false };
  const Link = ({ href, children, ...props }) => React.createElement("a", { href: typeof href === "string" ? href : "#", ...props }, children);
  const page = compileModule(path.join(process.cwd(), "app/multivitamins/page.tsx"), {
    next: {}, "next/link": { __esModule: true, default: Link },
    "../components/ComparisonProductVisuals": require("./test-helpers/comparison-product-visuals"),
    "../components/CategoryViewAnalytics": { __esModule: true, default: () => null },
    "../components/ComparisonTransparencyLinks": { __esModule: true, default: () => React.createElement("a", { href: "/how-we-compare" }, "Method") },
    "../lib/pricing": pricing,
    "../lib/multivitaminsComparison": { ...comparison, getMultivitaminsComparison: async () => result },
  });
  const metadata = await page.generateMetadata();
  assert.equal(metadata.alternates.canonical, "/multivitamins");
  const html = renderToStaticMarkup(React.createElement(page.MultivitaminsPageContent, { result }));
  assert.match(html, /Compare Multivitamin Prices UK/);
  assert.match(html, /coverage-first price comparison, not a ranking/);
  assert.match(html, /checked within 24 hours/);
  const schema = page.buildMultivitaminsStructuredData(result.rows);
  assert.deepEqual(schema["@graph"].map((node) => node["@type"]), ["CollectionPage", "ItemList", "BreadcrumbList"]);
  const sitemap = fs.readFileSync(path.join(process.cwd(), "app/sitemap.ts"), "utf8");
  const home = fs.readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8");
  assert.equal((sitemap.match(/\/multivitamins/g) || []).length, 1);
  assert.match(home, /Multivitamins", href: "\/multivitamins"/);
});
