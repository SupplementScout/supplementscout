const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

function compileModule(filename, options = {}) {
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
    if (parent === mod && Object.hasOwn(options.mocks || {}, request)) {
      return options.mocks[request];
    }
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

const root = process.cwd();
const pricing = compileModule(path.join(root, "app/lib/pricing.ts"));
const offerFreshness = compileModule(path.join(root, "app/lib/offerFreshness.ts"));
const freshness = compileModule(path.join(root, "app/lib/creatineLaunch.ts"), {
  mocks: { "./offerFreshness": offerFreshness },
});
const categoryComparison = compileModule(
  path.join(root, "app/lib/categoryComparison.ts"),
  { mocks: { "./creatineLaunch": freshness, "./offerFreshness": offerFreshness, "./pricing": pricing } }
);
const brandPath = path.join(root, "app/lib/per4mBrand.ts");
const pagePath = path.join(root, "app/brands/per4m/page.tsx");
const fixtureNow = new Date("2026-08-20T12:00:00.000Z");

function rawOffer(overrides = {}) {
  return {
    id: 11,
    retailer_product_id: 101,
    price: 24,
    shipping_cost: 4.99,
    in_stock: true,
    last_checked_at: "2026-08-20T11:00:00.000Z",
    url: "https://retailer.example/products/per4m",
    retailer: { id: 1, name: "Retailer One", slug: "retailer-one" },
    ...overrides,
  };
}

function rawProduct(overrides = {}) {
  return {
    id: 1,
    slug: "per4m-example-1kg",
    name: "Per4m Example 1kg",
    brand: "Per4m",
    category: "Whey Protein",
    image: "https://example.test/per4m.png",
    product_format: "powder",
    net_weight_g: 1000,
    net_volume_ml: null,
    unit_count: null,
    unit_type: null,
    serving_count_verified: null,
    serving_size_g: null,
    protein_per_serving_g: null,
    unit_pricing_verified: false,
    nutrition_verified: false,
    is_active: true,
    merged_into_product_id: null,
    merged_at: null,
    offers: [rawOffer()],
    ...overrides,
  };
}

function loadBrand(mockSupabase = {}) {
  return compileModule(brandPath, {
    mocks: {
      "./categoryComparison": categoryComparison,
      "./supabase": { supabase: mockSupabase },
    },
  });
}

function passingResult() {
  const categories = [
    "Whey Protein",
    "Creatine",
    "Pre Workout",
    "Amino Acids",
    "Vitamins",
  ];
  const products = Array.from({ length: 20 }, (_, index) =>
    rawProduct({
      id: index + 1,
      slug: `per4m-product-${index + 1}`,
      name: `Per4m Product ${index + 1}`,
      category: categories[index % categories.length],
      offers:
        index < 15
          ? [
              rawOffer({ id: index * 3 + 1, retailer: { id: 1, name: "One", slug: "one" } }),
              rawOffer({ id: index * 3 + 2, retailer: { id: 2, name: "Two", slug: "two" } }),
              rawOffer({ id: index * 3 + 3, retailer: { id: 3, name: "Three", slug: "three" } }),
            ]
          : [rawOffer({ id: index * 3 + 1 })],
    })
  );
  return { ...loadBrand().normalizePer4mBrand(products, { now: fixtureNow }), error: false };
}

function Link({ href, children, ...props }) {
  return React.createElement(
    "a",
    { href: typeof href === "string" ? href : href.pathname, ...props },
    children
  );
}

function loadPage(result = passingResult()) {
  let calls = 0;
  const brand = loadBrand();
  const page = compileModule(pagePath, {
    mocks: {
      "next/link": { __esModule: true, default: Link },
      "../../components/ComparisonProductVisuals": require("./test-helpers/comparison-product-visuals"),
      "../../components/CategoryViewAnalytics": { __esModule: true, default: () => null },
      "../../components/ComparisonTransparencyLinks": { __esModule: true, default: () => null },
      "../../lib/pricing": pricing,
      "../../lib/per4mBrand": {
        getPer4mBrand: async () => { calls += 1; return result; },
        evaluatePer4mIndexability: brand.evaluatePer4mIndexability,
        per4mDisplayCategory: brand.per4mDisplayCategory,
      },
    },
  });
  return { page, calls: () => calls };
}

test("Per4m scope is exact and rejects aliases, inactive and merged products", () => {
  const { isPer4mProduct } = loadBrand();
  assert.equal(isPer4mProduct(rawProduct()), true);
  assert.equal(isPer4mProduct(rawProduct({ brand: "PER4M" })), false);
  assert.equal(isPer4mProduct(rawProduct({ brand: "Unknown" })), false);
  assert.equal(isPer4mProduct(rawProduct({ is_active: false })), false);
  assert.equal(isPer4mProduct(rawProduct({ merged_into_product_id: 9 })), false);
  assert.equal(isPer4mProduct(rawProduct({ merged_at: "2026-08-20T00:00:00Z" })), false);
});

test("page-only category display groups are bounded to the two approved products", () => {
  const brand = loadBrand();
  assert.equal(brand.per4mDisplayCategory({ id: 328, category: "Health Supplements" }), "Whey Isolate");
  assert.equal(brand.per4mDisplayCategory({ id: 1010, category: "Whey Protein" }), "Plant Protein");
  assert.equal(brand.per4mDisplayCategory({ id: 999, category: "Whey Protein" }), "Whey Protein");
  const result = brand.normalizePer4mBrand([
    rawProduct({ id: 328, category: "Health Supplements" }),
    rawProduct({ id: 1010, slug: "per4m-plant", category: "Whey Protein" }),
  ], { now: fixtureNow });
  assert.deepEqual(result.categories.map((row) => row.name).sort(), ["Plant Protein", "Whey Isolate"]);
});

test("brand normalization reuses current mapped offers", () => {
  const result = loadBrand().normalizePer4mBrand([
    rawProduct({ offers: [rawOffer(), rawOffer({ id: 12, retailer: { id: 2, name: "Two", slug: "two" } })] }),
    rawProduct({ id: 2, slug: "per4m-creatine", category: "Creatine", offers: [rawOffer({ id: 21 })] }),
    rawProduct({ id: 3, slug: "stale", offers: [rawOffer({ id: 31, last_checked_at: "2026-07-20T00:00:00Z" })] }),
  ], { now: fixtureNow });
  assert.equal(result.summary.visibleProducts, 3);
  assert.equal(result.summary.productsWithMultipleFreshRetailers, 1);
  assert.equal(result.summary.freshOffers, 3);
  assert.equal(result.rows.find((row) => row.id === "3").bestOffer, null);
  assert.equal(result.rows.find((row) => row.id === "3").presentationState, "UNVERIFIED");
});

test("brand indexability fails closed across all coverage gates", () => {
  const brand = loadBrand();
  const result = passingResult();
  assert.deepEqual(brand.evaluatePer4mIndexability(result, true), { indexable: true, blockers: [] });
  const failed = brand.evaluatePer4mIndexability({
    ...result,
    categories: result.categories.slice(0, 4),
    summary: {
      ...result.summary,
      visibleProducts: 19,
      freshOffers: 49,
      productsWithMultipleFreshRetailers: 9,
      freshRetailersAcrossComparisons: 2,
    },
  }, false);
  for (const blocker of [
    "insufficient_visible_products",
    "insufficient_multi_retailer_products",
    "insufficient_comparison_retailers",
    "insufficient_fresh_offers",
    "insufficient_visible_categories",
    "structured_data_invalid",
  ]) assert.ok(failed.blockers.includes(blocker));
});

test("production query is exact and bounded", () => {
  const source = fs.readFileSync(brandPath, "utf8");
  assert.match(source, /const BRAND = "Per4m"/);
  assert.match(source, /\.eq\("brand", BRAND\)/);
  assert.match(source, /\.range\(0, QUERY_LIMIT - 1\)/);
  assert.match(source, /\.is\("merged_into_product_id", null\)/);
});

test("metadata, JSON-LD and visible page pass the brand quality contract", async () => {
  const { page } = loadPage();
  const metadata = await page.generateMetadata();
  assert.equal(metadata.robots.index, true);
  assert.equal(metadata.alternates.canonical, "/brands/per4m");
  const result = passingResult();
  assert.equal(page.isPer4mStructuredDataValid(result.rows), true);
  const json = JSON.stringify(page.buildPer4mStructuredData(result.rows));
  assert.match(json, /CollectionPage/);
  assert.match(json, /ItemList/);
  assert.match(json, /BreadcrumbList/);
  assert.doesNotMatch(json, /\"@type\":\"Product\"|seller|rating|review/i);
  const html = renderToStaticMarkup(React.createElement(page.Per4mPageContent, { result }));
  assert.match(html, /Per4m Products &amp; Prices UK/);
  assert.match(html, /independent comparison service/);
  assert.match(html, /checked within 24 hours/);
  assert.match(html, /https:\/\/per4mbetter\.com\/collections\/all/);
  assert.match(html, /unsupported performance, health or formulation claims/);
  assert.match(html, /\/product\/per4m-product-1/);
});

test("data failure preserves lifecycle metadata and aborts the route without stale data", async () => {
  const failed = { ...categoryComparison.emptyCategoryComparisonResult(), categories: [] };
  const { page } = loadPage(failed);
  const metadata = await page.generateMetadata();
  assert.equal(metadata.robots.index, true);
  assert.equal(metadata.robots.follow, true);
  const html = renderToStaticMarkup(React.createElement(page.Per4mPageContent, { result: failed }));
  assert.doesNotMatch(html, /application\/ld\+json/);
  assert.match(html, /Current brand data is unavailable/);
  await assert.rejects(page.default(), /Current comparison data is temporarily unavailable/);
});

test("Per4m has bounded sitemap, homepage, product and analytics links", () => {
  const sitemap = fs.readFileSync(path.join(root, "app/sitemap.ts"), "utf8");
  const home = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
  const product = fs.readFileSync(path.join(root, "app/product/[id]/page.tsx"), "utf8");
  const page = fs.readFileSync(pagePath, "utf8");
  assert.equal((sitemap.match(/brands\/per4m/g) || []).length, 1);
  assert.match(home, /Per4m.*\/brands\/per4m/);
  assert.match(product, /product\.brand === "Per4m"[\s\S]*"\/brands\/per4m"/);
  assert.match(page, /sourcePage="per4m_brand"/);
});

test("the default Server Component loads the brand comparison once", async () => {
  const loaded = loadPage();
  await loaded.page.default();
  assert.equal(loaded.calls(), 1);
});
