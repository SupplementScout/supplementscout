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
    if (request.endsWith("/categoryControls")) return compileModule(path.join(process.cwd(), "app/lib/categoryControls.ts"));
    if (request.endsWith("/categoryCoverage")) return compileModule(path.join(process.cwd(), "app/lib/categoryCoverage.ts"));
    if (request.endsWith("/CategoryComparisonControls")) return () => null;
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

const pricingPath = path.join(process.cwd(), "app", "lib", "pricing.ts");
const offerFreshnessPath = path.join(process.cwd(), "app", "lib", "offerFreshness.ts");
const creatineLaunchPath = path.join(process.cwd(), "app", "lib", "creatineLaunch.ts");
const comparisonPath = path.join(process.cwd(), "app", "lib", "hydrationComparison.ts");
const categoryComparisonPath = path.join(process.cwd(), "app", "lib", "categoryComparison.ts");
const categoryDecision = compileModule(path.join(process.cwd(), "app", "lib", "categoryDecision.ts"));
const pagePath = path.join(process.cwd(), "app", "hydration", "page.tsx");
const sitemapPath = path.join(process.cwd(), "app", "sitemap.ts");
const pricing = compileModule(pricingPath);
const offerFreshness = compileModule(offerFreshnessPath);
const creatineLaunch = compileModule(creatineLaunchPath, { mocks: { "./offerFreshness": offerFreshness } });
const FIXTURE_NOW = new Date("2026-07-22T10:00:00.000Z");

function rawOffer(overrides = {}) {
  return {
    id: 11,
    retailer_product_id: 101,
    price: 18.99,
    shipping_cost: 2.99,
    in_stock: true,
    last_checked_at: "2026-07-22T09:00:00.000Z",
    url: "https://retailer.example/products/hydration",
    retailer: { id: 1, name: "Retailer One", slug: "retailer-one" },
    ...overrides,
  };
}

function rawProduct(overrides = {}) {
  return {
    id: 1,
    slug: "example-electrolytes-300g",
    name: "Example Hydration Electrolytes 300g",
    brand: "Example Nutrition",
    category: "Health Supplements",
    description: "",
    image: "https://example.test/hydration.png",
    product_format: "powder",
    net_weight_g: 300,
    net_volume_ml: null,
    unit_count: null,
    unit_type: null,
    serving_count_verified: 30,
    is_active: true,
    merged_into_product_id: null,
    merged_at: null,
    offers: [rawOffer()],
    ...overrides,
  };
}

function loadComparison(mockSupabase = {}) {
  const categoryComparison = compileModule(categoryComparisonPath, {
    mocks: {
      "./creatineLaunch": creatineLaunch,
      "./offerFreshness": offerFreshness,
      "./pricing": pricing,
    },
  });
  return compileModule(comparisonPath, {
    mocks: {
      "./categoryComparison": categoryComparison,
      "./creatineLaunch": creatineLaunch,
      "./pricing": pricing,
      "./supabase": { supabase: mockSupabase },
    },
  });
}

function fixtureResult() {
  const comparison = loadComparison();
  return {
    ...comparison.normalizeHydrationComparison(
      [
        rawProduct(),
        rawProduct({
          id: 2,
          slug: "many-current-flavours",
          name: "Many Current Flavours Hydrate 210g",
          offers: [
            rawOffer({ id: 21, price: 20 }),
            rawOffer({ id: 22, price: 19.5 }),
            rawOffer({ id: 23, price: 21 }),
          ],
        }),
        rawProduct({
          id: 3,
          name: "Stale Electrolytes 20 Tablets",
          offers: [rawOffer({ id: 31, last_checked_at: "2026-07-20T08:00:00.000Z", price: 99 })],
        }),
      ],
      { now: FIXTURE_NOW }
    ),
    error: false,
  };
}

function Link({ href, children, ...props }) {
  return React.createElement("a", { href, ...props }, children);
}

function loadPage(result = fixtureResult()) {
  let calls = 0;
  const page = compileModule(pagePath, {
    mocks: {
      "next/link": { __esModule: true, default: Link },
      "../components/ComparisonProductVisuals": require("./test-helpers/comparison-product-visuals"),
      "../components/CategoryViewAnalytics": {
        __esModule: true,
        default: () => null,
      },
      "../components/CategoryDecisionPanel": {
        __esModule: true,
        default: ({ answers }) => answers.length ? React.createElement("section", null, `Quick decision ${answers.length}`) : null,
      },
      "../components/ComparisonTransparencyLinks": {
        __esModule: true,
        default: () => null,
      },
      "../lib/hydrationComparison": {
        getHydrationComparison: async () => {
          calls += 1;
          return result;
        },
        evaluateHydrationIndexability:
          loadComparison().evaluateHydrationIndexability,
        HYDRATION_INDEX_GATE: loadComparison().HYDRATION_INDEX_GATE,
      },
      "../lib/pricing": pricing,
      "../lib/categoryDecision": categoryDecision,
    },
  });
  return { page, calls: () => calls };
}

test("the live-verified /hydration route is canonical and stable across coverage", async () => {
  const result = fixtureResult();
  const { page } = loadPage(result);
  const source = fs.readFileSync(pagePath, "utf8");
  assert.equal(source.includes('"use client"'), false);
  const lowCoverage = await page.generateMetadata();
  assert.equal(lowCoverage.alternates.canonical, "/hydration");
  assert.deepEqual(lowCoverage.robots, { index: true, follow: true });
  assert.match(lowCoverage.title, /Hydration & Electrolyte/);

  const ready = {
    ...result,
    summary: {
      ...result.summary,
      freshOffers: 20,
      freshRetailersAcrossComparisons: 2,
      productsWithMultipleFreshRetailers: 3,
    },
  };
  const readyMetadata = await loadPage(ready).page.generateMetadata();
  assert.deepEqual(readyMetadata.robots, { index: true, follow: true });
});

test("hydration loader delegates semantic truth to shared Category Coverage", () => {
  const comparison = loadComparison();
  assert.equal(comparison.evaluateHydrationCoverage(rawProduct()).classification, "INCLUDE_STRONG");
  assert.equal(comparison.evaluateHydrationCoverage(rawProduct({ name: "BCAA Amino Hydrate 450g" })).classification, "INCLUDE_STRONG");
  assert.equal(comparison.evaluateHydrationCoverage(rawProduct({ name: "7Nutrition Isotonic Gold 1000g", category: "Carbohydrates" })).classification, "INCLUDE_STRONG");
  assert.equal(comparison.evaluateHydrationCoverage(rawProduct({ name: "Creatine Monohydrate 500g", category: "Creatine" })).classification, "EXCLUDE_STRONG");
  assert.equal(comparison.evaluateHydrationCoverage(rawProduct({ name: "Alkaline Water", category: "Hydration", product_format: "liquid" })).classification, "EXCLUDE_STRONG");
  const source = fs.readFileSync(comparisonPath, "utf8");
  assert.doesNotMatch(source, /function isHydrationCategoryProduct|explicitHydrationNamePattern|VITAMIN_WATER_AMBIGUITY/);
  assert.match(source, /evaluateCategoryCoverage\(hydrationDefinition, product\)/);
});

test("inactive and merged hydration products are excluded", () => {
  const { normalizeHydrationComparison } = loadComparison();
  const result = normalizeHydrationComparison([
    rawProduct({ id: 1, is_active: false }),
    rawProduct({ id: 2, merged_into_product_id: 99 }),
    rawProduct({ id: 3, merged_at: "2026-07-21T00:00:00Z" }),
  ], { now: FIXTURE_NOW });
  assert.equal(result.rows.length, 0);
});

test("Electrolytes annotations include only shared strong subtype members", () => {
  const { normalizeHydrationComparison } = loadComparison();
  const result = normalizeHydrationComparison([
    rawProduct({ id: 1, name: "Hydration Formula" }),
    rawProduct({ id: 2, name: "Electrolytes Formula" }),
    rawProduct({ id: 3, name: "Energy Gel Electrolyte", category: "Electrolytes", product_format: "sachet" }),
  ], { now: FIXTURE_NOW });
  assert.deepEqual(result.rows.map((row) => [row.id, row.semanticSubtypes]), [
    ["2", ["electrolytes"]],
    ["1", []],
  ]);
});

test("normalization accepts only fresh valid mapped in-stock offers", () => {
  const { normalizeHydrationComparison } = loadComparison();
  const result = normalizeHydrationComparison(
    [
      rawProduct({
        offers: [
          rawOffer(),
          rawOffer({ id: 12, last_checked_at: "2026-06-27T09:59:59Z", price: 1 }),
          rawOffer({ id: 13, in_stock: false }),
          rawOffer({ id: 14, price: null }),
          rawOffer({ id: 15, retailer_product_id: null }),
          rawOffer({ id: 16, url: "not-a-url" }),
          rawOffer({ id: 17, retailer: null }),
        ],
      }),
    ],
    { now: FIXTURE_NOW }
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.summary.freshOffers, 1);
  assert.equal(result.summary.staleOrUnusableOffersExcluded, 4);
  assert.equal(result.rows[0].bestOffer.productPrice, 18.99);
});

test("ranking prefers fresh retailer depth then offer count and completeness", () => {
  const { normalizeHydrationComparison } = loadComparison();
  const result = normalizeHydrationComparison(
    [
      rawProduct({ id: 1, name: "One Retailer Hydration", offers: [rawOffer(), rawOffer({ id: 12 })] }),
      rawProduct({ id: 2, name: "Two Retailer Electrolytes", offers: [rawOffer({ id: 21 }), rawOffer({ id: 22, retailer: { id: 2, name: "Retailer Two", slug: "two" } })] }),
    ],
    { now: FIXTURE_NOW }
  );
  assert.equal(result.rows[0].name, "Two Retailer Electrolytes");
  assert.equal(result.rows[0].retailerCount, 2);
});

test("future indexability gate remains closed without multi-retailer products", () => {
  const comparison = loadComparison();
  const result = fixtureResult();
  const readiness = comparison.evaluateHydrationIndexability(result.summary, true);
  assert.equal(readiness.indexable, false);
  assert.ok(readiness.blockers.includes("insufficient_multi_retailer_products"));
  assert.ok(readiness.blockers.includes("insufficient_comparison_retailers"));
});

test("live hydration coverage satisfies the existing indexability gate", () => {
  const comparison = loadComparison();
  const summary = {
    ...fixtureResult().summary,
    freshOffers: 37,
    freshRetailersAcrossComparisons: 3,
    productsWithMultipleFreshRetailers: 5,
  };
  assert.deepEqual(comparison.evaluateHydrationIndexability(summary, true), {
    indexable: true,
    blockers: [],
  });
});

test("hydration appears exactly once in the sitemap", () => {
  const sitemap = fs.readFileSync(sitemapPath, "utf8");
  assert.equal((sitemap.match(/`\$\{siteUrl\}\/hydration`/g) || []).length, 1);
  assert.equal((sitemap.match(/\/electrolytes/g) || []).length, 0);
});

test("structured data contains CollectionPage, ItemList and Breadcrumb but no Product", () => {
  const { page } = loadPage();
  const data = page.buildHydrationStructuredData(fixtureResult().rows);
  const itemList = data["@graph"].find((item) => item["@type"] === "ItemList");
  const breadcrumb = data["@graph"].find((item) => item["@type"] === "BreadcrumbList");
  assert.deepEqual(data["@graph"].map((item) => item["@type"]), [
    "CollectionPage",
    "ItemList",
    "BreadcrumbList",
  ]);
  assert.equal(itemList.numberOfItems, fixtureResult().rows.length);
  assert.equal(itemList.itemListElement.every((item) => item["@type"] === "ListItem" && item.url), true);
  assert.equal(breadcrumb.itemListElement.length, 2);
  assert.equal(JSON.stringify(data).includes('"@type":"Product"'), false);
});

test("SSR shows current availability without a misleading comparison label", () => {
  const { page } = loadPage();
  const html = renderToStaticMarkup(
    React.createElement(page.HydrationPageContent, { result: fixtureResult() })
  );
  assert.match(html, /Hydration &amp; Electrolyte Supplements UK/);
  assert.match(html, /Current available price/);
  assert.doesNotMatch(html, /Best price|Cheapest/i);
  assert.match(html, /No product currently has recently checked offers from multiple retailers/);
  assert.doesNotMatch(html, /£99\.00/);
  assert.match(html, /How are hydration products different from EAA or pre-workout/);
  assert.match(html, /application\/ld\+json/);
});

test("query is bounded and filters inactive and merged products", async () => {
  const calls = [];
  const query = {};
  for (const method of ["select", "eq", "is", "or", "order"]) {
    query[method] = (...args) => {
      calls.push([method, ...args]);
      return query;
    };
  }
  query.range = (...args) => {
    calls.push(["range", ...args]);
    return Promise.resolve({ data: [], error: null });
  };
  const comparison = loadComparison({ from: () => query });
  const result = await comparison.getHydrationComparison();
  assert.equal(result.error, false);
  assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "is_active" && call[2] === true));
  assert.ok(calls.some((call) => call[0] === "is" && call[1] === "merged_into_product_id"));
  assert.ok(calls.some((call) => call[0] === "is" && call[1] === "merged_at"));
  assert.ok(calls.some((call) => call[0] === "range" && call[1] === 0 && call[2] === 999));
  assert.ok(calls.some((call) => call[0] === "or" && String(call[1]).includes("description.ilike")));
});

test("candidate loading paginates deterministically beyond the first 1,000 rows", async () => {
  const ranges = [];
  const query = {};
  for (const method of ["select", "eq", "is", "or", "order"]) {
    query[method] = () => query;
  }
  query.range = (from, to) => {
    ranges.push([from, to]);
    return Promise.resolve({
      data: from === 0
        ? Array.from({ length: 1000 }, (_, index) => rawProduct({ id: index + 1, name: `Hydration ${index + 1}`, offers: [] }))
        : [],
      error: null,
    });
  };
  const comparison = loadComparison({ from: () => query });
  const result = await comparison.getHydrationComparison();
  assert.equal(result.error, false);
  assert.deepEqual(ranges, [[0, 999], [1000, 1999]]);
});

test("a later-page retrieval error fails closed instead of publishing partial data", async () => {
  const query = {};
  for (const method of ["select", "eq", "is", "or", "order"]) {
    query[method] = () => query;
  }
  query.range = (from) => Promise.resolve(
    from === 0
      ? { data: Array.from({ length: 1000 }, (_, index) => rawProduct({ id: index + 1, name: `Hydration ${index + 1}`, offers: [] })), error: null }
      : { data: null, error: { message: "later page failed" } }
  );
  const comparison = loadComparison({ from: () => query });
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await comparison.getHydrationComparison();
    assert.equal(result.error, true);
    assert.deepEqual(result.rows, []);
    assert.equal(result.summary.scopedProducts, 0);
  } finally {
    console.error = originalError;
  }
});

test("default route loads hydration data once", async () => {
  const loaded = loadPage();
  const element = await loaded.page.default();
  assert.equal(loaded.calls(), 1);
  assert.equal(element.type, loaded.page.HydrationPageContent);
});

test("Electrolytes subtype composes with the shared server-side controls", async () => {
  const loaded = loadPage();
  const element = await loaded.page.default({
    searchParams: Promise.resolve({ subtype: "electrolytes" }),
  });
  assert.equal(element.props.controlView.controls.subtype, "electrolytes");
  assert.equal(element.props.controlView.facets.subtypes.length, 1);
  assert.equal(
    element.props.result.rows.every((row) =>
      row.semanticSubtypes.includes("electrolytes")
    ),
    true
  );
});

test("Electrolytes remains an internal subtype without an app route", () => {
  assert.equal(
    fs.existsSync(path.join(process.cwd(), "app", "electrolytes")),
    false
  );
});

test("hydration uses consent-aware category analytics", () => {
  const source = fs.readFileSync(pagePath, "utf8");
  assert.match(source, /category="Hydration"/);
  assert.match(source, /sourcePage="hydration_comparison"/);
  assert.match(source, /hydration-comparison-v2/);
  assert.match(source, /subtypes: row\.semanticSubtypes\.includes\("electrolytes"\)/);
});
