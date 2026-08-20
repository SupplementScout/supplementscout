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
const pricing = compileModule(path.join(root, "app/lib/pricing.ts"));
const offerFreshness = compileModule(path.join(root, "app/lib/offerFreshness.ts"));
const freshness = compileModule(path.join(root, "app/lib/creatineLaunch.ts"), {
  mocks: { "./offerFreshness": offerFreshness },
});
const categoryComparison = compileModule(
  path.join(root, "app/lib/categoryComparison.ts"),
  { mocks: { "./creatineLaunch": freshness, "./pricing": pricing } }
);
const retailerPath = path.join(root, "app/lib/ebayUKRetailer.ts");
const pagePath = path.join(root, "app/retailers/ebay-uk/page.tsx");
const fixtureNow = new Date("2026-08-20T12:00:00.000Z");

function rawOffer(overrides = {}) {
  return {
    id: 11,
    retailer_product_id: 101,
    price: 24,
    shipping_cost: 4.99,
    in_stock: true,
    last_checked_at: "2026-08-20T11:00:00.000Z",
    url: "https://www.ebay.co.uk/itm/123",
    retailer: { id: 12, name: "eBay UK", slug: "ebay-uk" },
    ...overrides,
  };
}

function rawProduct(overrides = {}) {
  return {
    id: 1,
    slug: "tracked-ebay-product-1",
    name: "Tracked eBay Product 1",
    brand: "Example Brand",
    category: "Whey Protein",
    image: "https://example.test/product.png",
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

function loadRetailer(mockSupabase = {}) {
  return compileModule(retailerPath, {
    mocks: {
      "./categoryComparison": categoryComparison,
      "./supabase": { supabase: mockSupabase },
    },
  });
}

function passingResult() {
  const categories = ["Whey Protein", "Creatine", "Pre Workout", "Amino Acids", "Vitamins"];
  const products = Array.from({ length: 20 }, (_, index) => {
    const offers = [rawOffer({ id: index * 4 + 1 })];
    if (index < 10) {
      offers.push(
        rawOffer({ id: index * 4 + 2, retailer: { id: 3, name: "Whey Okay", slug: "whey-okay" }, url: "https://wheyokay.example/product" }),
        rawOffer({ id: index * 4 + 3, retailer: { id: 9, name: "Fit House", slug: "fit-house" }, url: "https://fithouse.example/product" }),
        rawOffer({ id: index * 4 + 4, retailer: { id: 11, name: "6 Pack Supplements", slug: "6-pack-supplements" }, url: "https://sixpack.example/product" })
      );
    }
    return rawProduct({
      id: index + 1,
      slug: `tracked-ebay-product-${index + 1}`,
      name: `Tracked eBay Product ${index + 1}`,
      brand: `Brand ${index % 6}`,
      category: categories[index % categories.length],
      offers,
    });
  });
  return { ...loadRetailer().normalizeEbayUKRetailer(products, { now: fixtureNow }), error: false };
}

function Link({ href, children, ...props }) {
  return React.createElement("a", { href: typeof href === "string" ? href : href.pathname, ...props }, children);
}

function loadPage(result = passingResult()) {
  let calls = 0;
  const retailer = loadRetailer();
  const page = compileModule(pagePath, {
    mocks: {
      "next/link": { __esModule: true, default: Link },
      "../../components/ComparisonProductVisuals": require("./test-helpers/comparison-product-visuals"),
      "../../components/CategoryViewAnalytics": { __esModule: true, default: () => null },
      "../../components/ComparisonTransparencyLinks": { __esModule: true, default: () => null },
      "../../lib/pricing": pricing,
      "../../lib/ebayUKRetailer": {
        getEbayUKRetailer: async () => { calls += 1; return result; },
        evaluateEbayUKIndexability: retailer.evaluateEbayUKIndexability,
      },
    },
  });
  return { page, calls: () => calls };
}

test("retailer scope keeps only active products with a current exact eBay UK offer", () => {
  const retailer = loadRetailer();
  const result = retailer.normalizeEbayUKRetailer([
    rawProduct(),
    rawProduct({ id: 2, slug: "other-only", offers: [rawOffer({ retailer: { id: 3, name: "Whey Okay", slug: "whey-okay" } })] }),
    rawProduct({ id: 3, slug: "stale-ebay", offers: [rawOffer({ last_checked_at: "2026-08-18T00:00:00Z" })] }),
    rawProduct({ id: 4, slug: "inactive-ebay", is_active: false }),
  ], { now: fixtureNow });
  assert.deepEqual(result.rows.map((row) => row.id), ["1"]);
  assert.equal(result.rows[0].bestEbayOffer.retailer.id, "12");
});

test("retailer normalization ranks comparable products first and reports the translated gate", () => {
  const result = passingResult();
  assert.equal(result.summary.visibleProducts, 20);
  assert.equal(result.summary.targetFreshOffers, 20);
  assert.equal(result.summary.productsWithMultipleFreshRetailers, 10);
  assert.equal(result.summary.freshRetailersAcrossComparisons, 4);
  assert.equal(result.summary.freshOffers, 50);
  assert.equal(result.categories.length, 5);
  assert.ok(result.rows.slice(0, 10).every((row) => row.bestAlternativeOffer));
  assert.ok(result.rows.slice(10).every((row) => !row.bestAlternativeOffer));
});

test("retailer indexability fails closed across coverage and structured-data gates", () => {
  const retailer = loadRetailer();
  const result = passingResult();
  assert.deepEqual(retailer.evaluateEbayUKIndexability(result, true), { indexable: true, blockers: [] });
  const failed = retailer.evaluateEbayUKIndexability({
    ...result,
    categories: result.categories.slice(0, 4),
    summary: {
      ...result.summary,
      visibleProducts: 19,
      productsWithMultipleFreshRetailers: 9,
      freshRetailersAcrossComparisons: 2,
      freshOffers: 49,
    },
  }, false);
  for (const blocker of [
    "insufficient_visible_products",
    "insufficient_comparable_products",
    "insufficient_retailers_across_comparisons",
    "insufficient_fresh_offers_across_visible_products",
    "insufficient_visible_categories",
    "structured_data_invalid",
  ]) assert.ok(failed.blockers.includes(blocker));
});

test("production query uses the exact retailer, a bounded target scope and current canonical products", () => {
  const source = fs.readFileSync(retailerPath, "utf8");
  assert.match(source, /EBAY_UK_RETAILER_ID = "12"/);
  assert.match(source, /\.from\("offers"\)[\s\S]*\.eq\("retailer_id", Number\(EBAY_UK_RETAILER_ID\)\)/);
  assert.match(source, /\.range\(0, QUERY_LIMIT - 1\)/);
  assert.match(source, /\.in\("id", productIds\)/);
  assert.match(source, /\.is\("merged_into_product_id", null\)/);
  assert.match(source, /FRESHNESS_MS = 24 \* 60 \* 60 \* 1000/);
});

test("metadata, JSON-LD and visible copy satisfy the retailer-page contract", async () => {
  const { page } = loadPage();
  const metadata = await page.generateMetadata();
  assert.equal(metadata.robots.index, true);
  assert.equal(metadata.alternates.canonical, "/retailers/ebay-uk");
  const result = passingResult();
  assert.equal(page.isEbayUKStructuredDataValid(result.rows), true);
  const json = JSON.stringify(page.buildEbayUKStructuredData(result.rows));
  assert.match(json, /CollectionPage/);
  assert.match(json, /ItemList/);
  assert.match(json, /BreadcrumbList/);
  assert.doesNotMatch(json, /"@type":"Product"|seller|rating|review/i);
  const html = renderToStaticMarkup(React.createElement(page.EbayUKPageContent, { result }));
  assert.match(html, /Compare eBay UK Supplement Prices/);
  assert.match(html, /Tracked eBay UK offer/);
  assert.match(html, /Best other current offer/);
  assert.match(html, /checked within 24 hours/);
  assert.match(html, /eBay is a marketplace for independent sellers/);
  assert.match(html, /does not[\s\S]*verify seller quality or endorse a listing/);
  assert.match(html, /never browses arbitrary eBay listings/);
});

test("data failure noindexes and does not emit stale structured data", async () => {
  const base = passingResult();
  const failed = {
    ...base,
    rows: [],
    categories: [],
    summary: {
      ...base.summary,
      visibleProducts: 0,
      freshOffers: 0,
      productsWithMultipleFreshRetailers: 0,
      freshRetailersAcrossComparisons: 0,
    },
    error: true,
  };
  const { page } = loadPage(failed);
  const metadata = await page.generateMetadata();
  assert.equal(metadata.robots.index, false);
  assert.equal(metadata.robots.follow, true);
  const html = renderToStaticMarkup(React.createElement(page.EbayUKPageContent, { result: failed }));
  assert.doesNotMatch(html, /application\/ld\+json/);
  assert.match(html, /Current retailer data is unavailable/);
});

test("eBay UK route has bounded sitemap, homepage, product and analytics discovery", () => {
  const sitemap = fs.readFileSync(path.join(root, "app/sitemap.ts"), "utf8");
  const home = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
  const product = fs.readFileSync(path.join(root, "app/product/[id]/page.tsx"), "utf8");
  const page = fs.readFileSync(pagePath, "utf8");
  assert.equal((sitemap.match(/retailers\/ebay-uk/g) || []).length, 1);
  assert.match(home, /eBay UK prices.*\/retailers\/ebay-uk/);
  assert.match(product, /group\.retailer\?\.id\) === "12"[\s\S]*\/retailers\/ebay-uk/);
  assert.match(page, /sourcePage="ebay_uk_retailer"/);
});

test("default Server Component loads the retailer comparison once", async () => {
  const loaded = loadPage();
  await loaded.page.default();
  assert.equal(loaded.calls(), 1);
});
