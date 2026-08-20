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
const pricingPath = path.join(root, "app/lib/pricing.ts");
const freshnessPath = path.join(root, "app/lib/creatineLaunch.ts");
const categoryComparisonPath = path.join(root, "app/lib/categoryComparison.ts");
const brandPath = path.join(root, "app/lib/appliedNutritionBrand.ts");
const pagePath = path.join(root, "app/brands/applied-nutrition/page.tsx");
const pricing = compileModule(pricingPath);
const offerFreshness = compileModule(path.join(root, "app/lib/offerFreshness.ts"));
const freshness = compileModule(freshnessPath, {
  mocks: { "./offerFreshness": offerFreshness },
});
const categoryComparison = compileModule(categoryComparisonPath, {
  mocks: { "./creatineLaunch": freshness, "./pricing": pricing },
});
const fixtureNow = new Date("2026-08-20T12:00:00.000Z");

function rawOffer(overrides = {}) {
  return {
    id: 11,
    retailer_product_id: 101,
    price: 24,
    shipping_cost: 4.99,
    in_stock: true,
    last_checked_at: "2026-08-20T11:00:00.000Z",
    url: "https://retailer.example/products/applied",
    retailer: { id: 1, name: "Retailer One", slug: "retailer-one" },
    ...overrides,
  };
}

function rawProduct(overrides = {}) {
  return {
    id: 1,
    slug: "applied-nutrition-example-1kg",
    name: "Applied Nutrition Example 1kg",
    brand: "Applied Nutrition",
    category: "Whey Protein",
    image: "https://example.test/applied.png",
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
  const rows = [];
  const categories = [
    "Whey Protein",
    "Creatine",
    "Pre Workout",
    "Amino Acids",
    "Vitamins",
  ];
  for (let index = 0; index < 20; index += 1) {
    rows.push(rawProduct({
      id: index + 1,
      slug: `applied-nutrition-product-${index + 1}`,
      name: `Applied Nutrition Product ${index + 1}`,
      category: categories[index % categories.length],
      offers: index < 15
        ? [
            rawOffer({ id: index * 3 + 1, retailer: { id: 1, name: "One", slug: "one" } }),
            rawOffer({ id: index * 3 + 2, retailer: { id: 2, name: "Two", slug: "two" } }),
            rawOffer({ id: index * 3 + 3, retailer: { id: 3, name: "Three", slug: "three" } }),
          ]
        : [rawOffer({ id: index * 3 + 1, retailer: { id: 1, name: "One", slug: "one" } })],
    }));
  }
  const brand = loadBrand();
  return {
    ...brand.normalizeAppliedNutritionBrand(rows, { now: fixtureNow }),
    error: false,
  };
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
      "../../components/CategoryViewAnalytics": { __esModule: true, default: () => null },
      "../../components/ComparisonTransparencyLinks": { __esModule: true, default: () => null },
      "../../lib/pricing": pricing,
      "../../lib/appliedNutritionBrand": {
        getAppliedNutritionBrand: async () => { calls += 1; return result; },
        evaluateAppliedNutritionIndexability: brand.evaluateAppliedNutritionIndexability,
      },
    },
  });
  return { page, calls: () => calls };
}

test("Applied Nutrition scope is exact and rejects aliases, inactive and merged products", () => {
  const { isAppliedNutritionProduct } = loadBrand();
  assert.equal(isAppliedNutritionProduct(rawProduct()), true);
  assert.equal(isAppliedNutritionProduct(rawProduct({ brand: "APPLIED NUTRITION" })), false);
  assert.equal(isAppliedNutritionProduct(rawProduct({ brand: "Unknown" })), false);
  assert.equal(isAppliedNutritionProduct(rawProduct({ is_active: false })), false);
  assert.equal(isAppliedNutritionProduct(rawProduct({ merged_into_product_id: 9 })), false);
  assert.equal(isAppliedNutritionProduct(rawProduct({ merged_at: "2026-08-20T00:00:00Z" })), false);
});

test("brand normalization reuses fresh mapped offers and produces category breadth", () => {
  const { normalizeAppliedNutritionBrand } = loadBrand();
  const result = normalizeAppliedNutritionBrand([
    rawProduct({ offers: [rawOffer(), rawOffer({ id: 12, retailer: { id: 2, name: "Two", slug: "two" } })] }),
    rawProduct({ id: 2, slug: "applied-creatine", category: "Creatine", offers: [rawOffer({ id: 21 })] }),
    rawProduct({ id: 3, slug: "stale", offers: [rawOffer({ id: 31, last_checked_at: "2026-07-20T00:00:00Z" })] }),
  ], { now: fixtureNow });
  assert.equal(result.summary.visibleProducts, 2);
  assert.equal(result.summary.productsWithMultipleFreshRetailers, 1);
  assert.equal(result.summary.freshOffers, 3);
  assert.deepEqual(result.categories.map((row) => row.name), ["Whey Protein", "Creatine"]);
});

test("brand indexability is fail-closed across products, retailers, offers and categories", () => {
  const brand = loadBrand();
  const result = passingResult();
  assert.deepEqual(brand.evaluateAppliedNutritionIndexability(result, true), { indexable: true, blockers: [] });
  const failed = brand.evaluateAppliedNutritionIndexability({ ...result, categories: result.categories.slice(0, 4), summary: { ...result.summary, visibleProducts: 19, freshOffers: 49, productsWithMultipleFreshRetailers: 9, freshRetailersAcrossComparisons: 2 } }, false);
  assert.equal(failed.indexable, false);
  for (const blocker of ["insufficient_visible_products", "insufficient_multi_retailer_products", "insufficient_comparison_retailers", "insufficient_fresh_offers", "insufficient_visible_categories", "structured_data_invalid"]) assert.ok(failed.blockers.includes(blocker));
});

test("production query is exact, bounded and has no dynamic brand route", () => {
  const source = fs.readFileSync(brandPath, "utf8");
  assert.match(source, /\.eq\("brand", BRAND\)/);
  assert.match(source, /const BRAND = "Applied Nutrition"/);
  assert.match(source, /\.range\(0, QUERY_LIMIT - 1\)/);
  assert.match(source, /\.is\("merged_into_product_id", null\)/);
  assert.equal(fs.existsSync(path.join(root, "app/brands/[slug]")), false);
});

test("metadata, JSON-LD and visible page pass the brand quality contract", async () => {
  const { page } = loadPage();
  const metadata = await page.generateMetadata();
  assert.equal(metadata.robots.index, true);
  assert.equal(metadata.alternates.canonical, "/brands/applied-nutrition");
  const result = passingResult();
  assert.equal(page.isAppliedNutritionStructuredDataValid(result.rows), true);
  const json = JSON.stringify(page.buildAppliedNutritionStructuredData(result.rows));
  assert.match(json, /CollectionPage/);
  assert.match(json, /ItemList/);
  assert.match(json, /BreadcrumbList/);
  assert.doesNotMatch(json, /\"@type\":\"Product\"|seller|rating|review/i);
  const html = renderToStaticMarkup(React.createElement(page.AppliedNutritionPageContent, { result }));
  assert.match(html, /Applied Nutrition Products &amp; Prices UK/);
  assert.match(html, /What products can you compare\?/);
  assert.match(html, /independent comparison service/);
  assert.match(html, /checked within 24 days/);
  assert.match(html, /https:\/\/appliednutrition\.uk\/products/);
  assert.match(html, /\/product\/applied-nutrition-product-1/);
});

test("data failure noindexes the page and renders no stale structured data", async () => {
  const failed = { ...categoryComparison.emptyCategoryComparisonResult(), categories: [] };
  const { page } = loadPage(failed);
  const metadata = await page.generateMetadata();
  assert.equal(metadata.robots.index, false);
  assert.equal(metadata.robots.follow, true);
  const html = renderToStaticMarkup(React.createElement(page.AppliedNutritionPageContent, { result: failed }));
  assert.doesNotMatch(html, /application\/ld\+json/);
  assert.match(html, /Current brand data is unavailable/);
});

test("the first brand page has sitemap, homepage, product and analytics links", () => {
  const sitemap = fs.readFileSync(path.join(root, "app/sitemap.ts"), "utf8");
  const home = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
  const product = fs.readFileSync(path.join(root, "app/product/[id]/page.tsx"), "utf8");
  const page = fs.readFileSync(pagePath, "utf8");
  assert.equal((sitemap.match(/brands\/applied-nutrition/g) || []).length, 1);
  assert.match(home, /Applied Nutrition.*\/brands\/applied-nutrition/);
  assert.match(product, /product\.brand === "Applied Nutrition"[\s\S]*href="\/brands\/applied-nutrition"/);
  assert.match(page, /sourcePage="applied_nutrition_brand"/);
});

test("the default Server Component loads the brand comparison once", async () => {
  const loaded = loadPage();
  await loaded.page.default();
  assert.equal(loaded.calls(), 1);
});
