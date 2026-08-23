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
  "./pricing": pricing,
});
const comparisonPath = path.join(process.cwd(), "app/lib/veganProteinComparison.ts");
const pagePath = path.join(process.cwd(), "app/vegan-protein/page.tsx");
const FIXTURE_NOW = new Date("2026-08-04T12:00:00.000Z");

function rawOffer(id, retailerId, overrides = {}) {
  return {
    id,
    retailer_product_id: id + 100,
    price: 25,
    shipping_cost: 3.99,
    in_stock: true,
    last_checked_at: "2026-08-04T11:00:00.000Z",
    url: `https://retailer.example/${id}`,
    retailer: { id: retailerId, name: `Retailer ${retailerId}`, slug: `retailer-${retailerId}` },
    retailer_product: { external_name: "Example Vegan Protein 1kg" },
    ...overrides,
  };
}

function rawProduct(id, name = "Example Vegan Protein 1kg", offers = [rawOffer(id * 10, 1)], overrides = {}) {
  return {
    id,
    slug: `product-${id}`,
    name,
    brand: "Example Nutrition",
    category: "Protein",
    image: null,
    product_format: "powder",
    net_weight_g: 1000,
    net_volume_ml: null,
    unit_count: null,
    unit_type: null,
    serving_count_verified: 40,
    serving_size_g: 25,
    protein_per_serving_g: 20,
    unit_pricing_verified: true,
    nutrition_verified: true,
    is_active: true,
    merged_into_product_id: null,
    merged_at: null,
    offers,
    ...overrides,
  };
}

function loadComparison(mockSupabase = {}) {
  return compileModule(comparisonPath, {
    react: { cache: (fn) => fn },
    "./categoryComparison": categoryComparison,
    "./categoryComparisonVariants": { resolveCategoryComparisonVariants: async (products) => products },
    "./nutritionMetrics": nutritionMetrics,
    "./proteinSubtypes": proteinSubtypes,
    "./supabase": { supabase: mockSupabase },
  });
}

function fixtureResult() {
  const comparison = loadComparison();
  return {
    ...comparison.normalizeVeganProteinComparison([
      rawProduct(1),
      rawProduct(2, "Example Plant-Based Protein 900g", [rawOffer(21, 1), rawOffer(22, 2)]),
    ], { now: FIXTURE_NOW }),
    error: false,
  };
}

function Link({ href, children, ...props }) {
  return React.createElement("a", { href: typeof href === "string" ? href : href.pathname, ...props }, children);
}

function loadPage(result = fixtureResult()) {
  const comparison = loadComparison();
  return compileModule(pagePath, {
    "next/link": { __esModule: true, default: Link },
    "../components/ComparisonProductVisuals": require("./test-helpers/comparison-product-visuals"),
    "../components/CategoryViewAnalytics": { __esModule: true, default: () => null },
    "../components/ComparisonTransparencyLinks": { __esModule: true, default: () => null },
    "../lib/pricing": pricing,
    "../lib/veganProteinComparison": {
      getVeganProteinComparison: async () => result,
      evaluateVeganProteinIndexability: comparison.evaluateVeganProteinIndexability,
      VEGAN_PROTEIN_INDEX_GATE: comparison.VEGAN_PROTEIN_INDEX_GATE,
    },
  });
}

test("reviewed scope requires explicit plant protein and rejects food or animal conflicts", () => {
  const { isVeganProteinProduct } = loadComparison();
  for (const name of ["Example Vegan Protein 1kg", "Plant-Based Protein 900g", "Pea Protein Powder 1kg", "Rice Protein 500g", "Hemp Protein 750g"]) {
    assert.equal(isVeganProteinProduct(rawProduct(1, name)), true, name);
  }
  for (const name of ["Vegan Protein Bar 55g", "Plant Protein Cookie", "Vegan Meal Protein 1kg", "Vegan Whey Protein 1kg", "Plant Collagen Protein 500g"]) {
    assert.equal(isVeganProteinProduct(rawProduct(1, name)), false, name);
  }
  assert.equal(isVeganProteinProduct(rawProduct(1, "Vegan Protein 1kg", [rawOffer(1, 1, { retailer_product: { external_name: "Vegan Whey Protein" } })])), false);
  assert.equal(isVeganProteinProduct(rawProduct(1, "Vegan Protein Drink", [], { product_format: "liquid" })), false);
});

test("normalization keeps fresh mapped offers and counts distinct retailer overlap", () => {
  const { isVeganProteinOfferFresh, normalizeVeganProteinComparison } = loadComparison();
  assert.equal(isVeganProteinOfferFresh("2026-08-03T12:00:00.000Z", FIXTURE_NOW), true);
  assert.equal(isVeganProteinOfferFresh("2026-08-03T11:59:59.999Z", FIXTURE_NOW), false);
  const result = normalizeVeganProteinComparison([
    rawProduct(1, undefined, [rawOffer(10, 1), rawOffer(11, 2), rawOffer(12, 2)]),
    rawProduct(2, undefined, [rawOffer(20, 1), rawOffer(21, 2, { last_checked_at: "2026-08-03T11:59:59Z" })]),
  ], { now: FIXTURE_NOW });
  assert.equal(result.summary.visibleProducts, 2);
  assert.equal(result.summary.freshOffers, 4);
  assert.equal(result.summary.productsWithMultipleFreshRetailers, 1);
});

test("indexability uses the unchanged shared quality gate", () => {
  const comparison = loadComparison();
  assert.deepEqual(comparison.VEGAN_PROTEIN_INDEX_GATE, {
    minimumProductsWithMultipleFreshRetailers: 3,
    minimumFreshRetailersAcrossComparisons: 2,
    minimumFreshOffers: 20,
  });
  const summary = { ...fixtureResult().summary, freshOffers: 20, productsWithMultipleFreshRetailers: 3, freshRetailersAcrossComparisons: 2 };
  assert.deepEqual(comparison.evaluateVeganProteinIndexability(summary, true), { indexable: true, blockers: [] });
  assert.equal(comparison.evaluateVeganProteinIndexability({ ...summary, productsWithMultipleFreshRetailers: 2 }, true).indexable, false);
});

test("production query is bounded to explicit plant identity candidates", async () => {
  const calls = [];
  const query = {};
  for (const method of ["select", "eq", "is", "or", "gt", "order"]) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  query.range = (...args) => { calls.push(["range", ...args]); return Promise.resolve({ data: [], error: null }); };
  await loadComparison({ from: () => query }).getVeganProteinComparison();
  assert.ok(calls.some((call) => call[0] === "or" && String(call[1]).includes("name.ilike.%vegan%")));
  assert.ok(calls.some((call) => call[0] === "range" && call[1] === 0 && call[2] === 999));
});

test("metadata fails closed and uses one canonical", async () => {
  const ready = fixtureResult();
  ready.summary = { ...ready.summary, freshOffers: 20, productsWithMultipleFreshRetailers: 3, freshRetailersAcrossComparisons: 2 };
  const metadata = await loadPage(ready).generateMetadata();
  assert.equal(metadata.alternates.canonical, "/vegan-protein");
  assert.deepEqual(metadata.robots, { index: true, follow: true });
  assert.deepEqual((await loadPage({ ...ready, error: true }).generateMetadata()).robots, { index: false, follow: true });
});

test("server HTML and structured data explain the reviewed boundary", () => {
  const page = loadPage();
  const result = fixtureResult();
  const html = renderToStaticMarkup(React.createElement(page.VeganProteinPageContent, { result }));
  assert.match(html, /Compare Vegan Protein Prices UK/);
  assert.match(html, /Reviewed inclusion boundary/);
  assert.match(html, /Bars, bites, cookies, snacks/);
  assert.match(html, /checked within 24 hours/);
  assert.match(html, /not a ranking of taste, formulation/i);
  const schema = page.buildVeganProteinStructuredData(result.rows);
  assert.deepEqual(schema["@graph"].map((item) => item["@type"]), ["CollectionPage", "ItemList", "BreadcrumbList"]);
  assert.equal(JSON.stringify(schema).includes('"@type":"Product"'), false);
});

test("route has one sitemap URL and intentional internal links", () => {
  const sitemap = fs.readFileSync(path.join(process.cwd(), "app/sitemap.ts"), "utf8");
  const home = fs.readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8");
  const categoryRoutes = fs.readFileSync(
    path.join(process.cwd(), "app/lib/categoryRoutes.ts"),
    "utf8"
  );
  assert.equal((sitemap.match(/`\$\{siteUrl\}\/vegan-protein`/g) || []).length, 1);
  assert.match(home, /COMPARISON_CATEGORY_LINKS/);
  assert.match(categoryRoutes, /Vegan Protein", href: "\/vegan-protein"/);
  for (const route of ["whey-protein", "whey-isolate"]) {
    const source = fs.readFileSync(path.join(process.cwd(), "app", route, "page.tsx"), "utf8");
    assert.match(source, /href="\/vegan-protein"/, route);
  }
});

test("page uses consent-aware category analytics", () => {
  const source = fs.readFileSync(pagePath, "utf8");
  assert.match(source, /category="Vegan Protein"/);
  assert.match(source, /sourcePage="vegan_protein_comparison"/);
});
