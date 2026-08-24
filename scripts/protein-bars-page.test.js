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
const categoryComparison = compileModule(path.join(process.cwd(), "app/lib/categoryComparison.ts"), { "./creatineLaunch": creatineLaunch, "./pricing": pricing });
const comparisonPath = path.join(process.cwd(), "app/lib/proteinBarsComparison.ts");

function loadComparison(rows = []) {
  const builder = { select: () => builder, eq: () => builder, is: () => builder, gt: () => builder, order: () => builder, range: () => ({ data: rows, error: null }) };
  return compileModule(comparisonPath, {
    react: { cache: (fn) => fn },
    "./categoryComparison": categoryComparison,
    "./categoryComparisonVariants": { resolveCategoryComparisonVariants: async (products) => products },
    "./supabase": { supabase: { from: () => builder } },
  });
}

const FIXTURE_NOW = new Date("2026-08-23T12:00:00.000Z");
function variant(id, packCount, overrides = {}) {
  return { id, size_value: 60, size_unit: "g", pack_count: packCount, product_format: "snack", is_active: true, is_default: false, ...overrides };
}
function rawOffer(id, retailerId, packCount, overrides = {}) {
  return {
    id, retailer_product_id: id + 100, price: 24, shipping_cost: 3.99,
    in_stock: true, last_checked_at: "2026-08-23T11:00:00.000Z",
    url: `https://retailer.example/${id}`,
    retailer: { id: retailerId, name: `Retailer ${retailerId}`, slug: `retailer-${retailerId}` },
    product_variant: { pack_count: packCount, size_value: 60, size_unit: "g", product_format: "snack", nutrition_override: {}, is_active: true },
    variant_resolution: "resolved",
    ...overrides,
  };
}
function rawProduct(id, name, offers = [rawOffer(id * 10, 1, 12)], overrides = {}) {
  return {
    id, slug: `product-${id}`, name, brand: "Example Nutrition", category: "Protein Bars",
    image: null, product_format: "snack", net_weight_g: null, net_volume_ml: null,
    unit_count: null, unit_type: null, serving_count_verified: null,
    serving_size_g: null, protein_per_serving_g: null, unit_pricing_verified: false,
    nutrition_verified: false, is_active: true, merged_into_product_id: null,
    merged_at: null, product_variants: [variant(id * 100, 12)], offers, ...overrides,
  };
}

test("Protein Bars scope requires explicit identity, reviewed format and one exact pack", () => {
  const { isProteinBarsProduct, getProteinBarsPackCount } = loadComparison();
  assert.equal(isProteinBarsProduct(rawProduct(1, "Example Protein Bar 60g")), true);
  assert.equal(getProteinBarsPackCount(rawProduct(2, "Example Bar", [], { product_variants: [variant(201, 1), variant(202, 12)] })), null);
  assert.equal(isProteinBarsProduct(rawProduct(3, "Critical Cookie 85g")), false);
  assert.equal(isProteinBarsProduct(rawProduct(4, "Example Protein Bar", [], { product_format: "spread" })), false);
  assert.equal(isProteinBarsProduct(rawProduct(5, "Example Protein Bar", [], { category: "Health Supplements" })), false);
  assert.equal(isProteinBarsProduct(rawProduct(6, "Example Protein Bar", [], { is_active: false })), false);
});

test("exact-pack normalization excludes mismatches, unresolved variants and stale offers", () => {
  const { normalizeProteinBarsComparison } = loadComparison();
  const product = rawProduct(1, "Example Protein Bars Box", [
    rawOffer(10, 1, 12),
    rawOffer(11, 2, 1),
    rawOffer(12, 2, 12, { variant_resolution: "unresolved" }),
    rawOffer(13, 2, 12, { last_checked_at: "2026-08-22T11:59:59.000Z" }),
  ]);
  const result = normalizeProteinBarsComparison([product], { now: FIXTURE_NOW });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].packCount, 12);
  assert.equal(result.rows[0].offerCount, 1);
  assert.equal(result.summary.freshOffers, 1);
  assert.equal(result.summary.productsWithMultipleFreshRetailers, 0);
  assert.equal(result.summary.staleOrUnusableOffersExcluded, 3);
});

test("indexability retains the unchanged 3-product, 2-retailer and 20-offer gate", () => {
  const { evaluateProteinBarsIndexability, PROTEIN_BARS_INDEX_GATE } = loadComparison();
  assert.deepEqual(PROTEIN_BARS_INDEX_GATE, { minimumProductsWithMultipleFreshRetailers: 3, minimumFreshRetailersAcrossComparisons: 2, minimumFreshOffers: 20 });
  const summary = { scopedProducts: 10, visibleProducts: 4, freshOffers: 27, freshRetailers: 3, productsWithOneFreshRetailer: 1, productsWithMultipleFreshRetailers: 3, freshRetailersAcrossComparisons: 2, staleOrUnusableOffersExcluded: 0, latestOfferCheckedAt: "2026-08-23T11:00:00Z" };
  assert.equal(evaluateProteinBarsIndexability(summary, true).indexable, true);
  assert.equal(evaluateProteinBarsIndexability({ ...summary, productsWithMultipleFreshRetailers: 2 }, true).indexable, false);
  assert.equal(evaluateProteinBarsIndexability({ ...summary, freshOffers: 19 }, true).indexable, false);
});

test("production query is bounded to active unmerged Protein Bars", async () => {
  const calls = [];
  const builder = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); return name === "range" ? { data: [], error: null } : builder; } });
  const comparison = compileModule(comparisonPath, { react: { cache: (fn) => fn }, "./categoryComparison": categoryComparison, "./categoryComparisonVariants": { resolveCategoryComparisonVariants: async (products) => products }, "./supabase": { supabase: { from: (table) => { calls.push(["from", table]); return builder; } } } });
  await comparison.getProteinBarsComparison();
  assert.ok(calls.some((row) => row[0] === "eq" && row[1] === "category" && row[2] === "Protein Bars"));
  assert.ok(calls.some((row) => row[0] === "eq" && row[1] === "is_active" && row[2] === true));
  assert.ok(calls.some((row) => row[0] === "range" && row[1] === 0 && row[2] === 999));
});

test("page metadata, SSR, schema and discovery use one Protein Bars canonical", async () => {
  const comparison = loadComparison();
  const products = [1, 2, 3].map((id) => rawProduct(id, `Example Protein Bar ${id}`, Array.from({ length: 7 }, (_, index) => rawOffer(id * 100 + index, index % 2 ? 1 : 2, 12))));
  const normalized = comparison.normalizeProteinBarsComparison(products, { now: FIXTURE_NOW });
  const result = { ...normalized, error: false };
  const Link = ({ href, children, ...props }) => React.createElement("a", { href: typeof href === "string" ? href : "#", ...props }, children);
  const page = compileModule(path.join(process.cwd(), "app/protein-bars/page.tsx"), {
    next: {}, "next/link": { __esModule: true, default: Link },
    "../components/ComparisonProductVisuals": require("./test-helpers/comparison-product-visuals"),
    "../components/CategoryViewAnalytics": { __esModule: true, default: () => null },
    "../components/ComparisonTransparencyLinks": { __esModule: true, default: () => React.createElement("a", { href: "/how-we-compare" }, "Method") },
    "../lib/pricing": pricing,
    "../lib/proteinBarsComparison": { ...comparison, getProteinBarsComparison: async () => result },
  });
  const metadata = await page.generateMetadata();
  assert.equal(metadata.alternates.canonical, "/protein-bars");
  assert.deepEqual(metadata.robots, { index: true, follow: true });
  const html = renderToStaticMarkup(React.createElement(page.ProteinBarsPageContent, { result }));
  assert.match(html, /Compare Protein Bar Prices UK/);
  assert.match(html, /without mixing single bars and boxes/);
  assert.match(html, /Exact pack: 12 bars/);
  assert.match(html, /checked within 24 hours/);
  assert.doesNotMatch(html, /Delivered price \/ bar|Cost \/ 25 g protein/);
  const schema = page.buildProteinBarsStructuredData(result.rows);
  assert.deepEqual(schema["@graph"].map((node) => node["@type"]), ["CollectionPage", "ItemList", "BreadcrumbList"]);
  const sitemap = fs.readFileSync(path.join(process.cwd(), "app/sitemap.ts"), "utf8");
  const home = fs.readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8");
  const whey = fs.readFileSync(path.join(process.cwd(), "app/whey-protein/page.tsx"), "utf8");
  const vegan = fs.readFileSync(path.join(process.cwd(), "app/vegan-protein/page.tsx"), "utf8");
  assert.equal((sitemap.match(/\/protein-bars/g) || []).length, 1);
  assert.match(home, /Protein bars", href: "\/protein-bars"/);
  assert.match(whey, /href="\/protein-bars"/);
  assert.match(vegan, /href="\/protein-bars"/);
});

test("live-verified metadata remains indexable when exact-pack coverage falls", async () => {
  const comparison = loadComparison();
  const empty = { ...categoryComparison.emptyCategoryComparisonResult(), error: false };
  const page = compileModule(path.join(process.cwd(), "app/protein-bars/page.tsx"), {
    next: {}, "next/link": { __esModule: true, default: () => null },
    "../components/ComparisonProductVisuals": require("./test-helpers/comparison-product-visuals"),
    "../components/CategoryViewAnalytics": { __esModule: true, default: () => null },
    "../components/ComparisonTransparencyLinks": { __esModule: true, default: () => null },
    "../lib/pricing": pricing,
    "../lib/proteinBarsComparison": { ...comparison, getProteinBarsComparison: async () => empty },
  });
  assert.deepEqual((await page.generateMetadata()).robots, { index: true, follow: true });
});
