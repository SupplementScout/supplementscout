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
const launchPath = path.join(process.cwd(), "app", "lib", "creatineLaunch.ts");
const comparisonPath = path.join(process.cwd(), "app", "lib", "creatineComparison.ts");
const pagePath = path.join(process.cwd(), "app", "creatine", "page.tsx");
const homepagePath = path.join(process.cwd(), "app", "page.tsx");
const categoryRoutesPath = path.join(process.cwd(), "app", "lib", "categoryRoutes.ts");
const sitemapPath = path.join(process.cwd(), "app", "sitemap.ts");

const pricing = compileModule(pricingPath);
const categoryDecision = compileModule(path.join(process.cwd(), "app", "lib", "categoryDecision.ts"));
const offerFreshness = compileModule(offerFreshnessPath);
const launch = compileModule(launchPath, { mocks: { "./offerFreshness": offerFreshness } });
const nutritionMetrics = compileModule(path.join(process.cwd(), "app/lib/nutritionMetrics.ts"));
const FIXTURE_NOW = new Date("2026-07-16T21:00:00.000Z");

function queryMock(result) {
  const calls = [];
  const query = {
    select(value) {
      calls.push(["select", value]);
      return query;
    },
    eq(...args) {
      calls.push(["eq", ...args]);
      return query;
    },
    is(...args) {
      calls.push(["is", ...args]);
      return query;
    },
    ilike(...args) {
      calls.push(["ilike", ...args]);
      return query;
    },
    gt(...args) {
      calls.push(["gt", ...args]);
      return query;
    },
    order(...args) {
      calls.push(["order", ...args]);
      return query;
    },
    range(...args) {
      calls.push(["range", ...args]);
      return Promise.resolve(result);
    },
  };

  return { query, calls };
}

function rawProduct(overrides = {}) {
  return {
    id: 1,
    slug: "verified-creatine",
    name: "Verified Creatine 250g",
    brand: "Example Nutrition",
    category: "Creatine",
    image: "https://example.test/creatine.png",
    net_weight_g: 250,
    serving_count_verified: 50,
    serving_size_g: 5,
    creatine_per_serving_g: 5,
    product_format: "powder",
    nutrition_verified: true,
    unit_pricing_verified: true,
    offers: [
      {
        id: 11,
        price: 12,
        shipping_cost: 3,
        in_stock: true,
        last_checked_at: "2026-07-16T20:48:02.382Z",
        retailer: { id: 1, name: "Retailer One", slug: "retailer-one" },
      },
      {
        id: 12,
        price: 13,
        shipping_cost: 1,
        in_stock: true,
        last_checked_at: "2026-07-16T19:00:00.000Z",
        retailer: [{ id: 2, name: "Retailer Two", slug: "retailer-two" }],
      },
    ],
    ...overrides,
  };
}

function loadComparison(mockSupabase, resolveVariants = async (products) => products) {
  return compileModule(comparisonPath, {
    mocks: {
      "./creatineLaunch": launch,
      "./offerFreshness": offerFreshness,
      "./pricing": pricing,
      "./supabase": { supabase: mockSupabase },
      "./nutritionMetrics": nutritionMetrics,
      "./categoryComparisonVariants": { resolveCategoryComparisonVariants: resolveVariants },
    },
  });
}

function comparisonFixture() {
  const { normalizeCreatineComparison } = loadComparison({});
  const normalized = normalizeCreatineComparison(
    [
      rawProduct(),
      rawProduct({
        id: 2,
        slug: "shipping-unknown",
        name: "Shipping Unknown Creatine",
        brand: "Careful Brand",
        nutrition_verified: false,
        unit_pricing_verified: false,
        creatine_per_serving_g: null,
        offers: [
          {
            id: 21,
            price: 8.99,
            shipping_cost: null,
            in_stock: true,
            last_checked_at: "2026-07-16T20:30:00.000Z",
            retailer: { id: 1, name: "Retailer One", slug: "retailer-one" },
          },
        ],
      }),
      rawProduct({
        id: 3,
        slug: "no-offer-creatine",
        name: "No Offer Creatine",
        offers: [],
      }),
    ],
    { now: FIXTURE_NOW }
  );

  return { ...normalized, error: false };
}

function Link({ href, children, ...props }) {
  return React.createElement("a", { href, ...props }, children);
}

function loadPage(result = comparisonFixture()) {
  let loaderCalls = 0;
  const page = compileModule(pagePath, {
    mocks: {
      "next/link": { __esModule: true, default: Link },
      "../components/ComparisonProductVisuals": require("./test-helpers/comparison-product-visuals"),
      "../components/CategoryDecisionPanel": {
        __esModule: true,
        default: ({ answers }) => React.createElement("section", null, `Quick decision ${answers.length}`),
      },
      "../components/ComparisonTransparencyLinks": {
        __esModule: true,
        default: () => null,
      },
      "../lib/creatineComparison": {
        selectCreatineUnder20: loadComparison({}).selectCreatineUnder20,
        getCreatineComparison: async () => {
          loaderCalls += 1;
          return result;
        },
      },
      "../lib/creatineLaunch": launch,
      "../lib/offerFreshness": offerFreshness,
      "../lib/pricing": pricing,
      "../lib/categoryDecision": categoryDecision,
    },
  });

  return { page, loaderCalls: () => loaderCalls };
}

function structuredDataItemList(data) {
  return data["@graph"].find((entry) => entry["@type"] === "ItemList");
}

function structuredDataProducts(data) {
  return structuredDataItemList(data).itemListElement
    .map((item) => item.item)
    .filter((item) => item["@type"] === "Product");
}

test("the /creatine route exists and is a Server Component", () => {
  const source = fs.readFileSync(pagePath, "utf8");
  assert.equal(fs.existsSync(pagePath), true);
  assert.equal(source.includes('"use client"'), false);
  assert.match(source, /await getCachedCreatineComparison\(\)/);
  assert.match(
    source,
    /createLifecycleDataLoader\(\s*pagePath,\s*"creatine-comparison-v3"/,
    "the exact-variant row shape must not reuse the previous production cache"
  );
});

test("Creatine metadata is unique, canonical and stable after live verification", async () => {
  const { page } = loadPage();
  const metadata = await page.generateMetadata();
  assert.equal(metadata.title, "Compare Creatine Prices UK");
  assert.equal(
    metadata.description,
    "Compare current creatine prices from UK retailers, including known delivery costs. Check exact products, pack sizes and verified unit costs where available.",
  );
  assert.equal(metadata.alternates.canonical, "/creatine");
  assert.deepEqual(metadata.robots, { index: true, follow: true });
  assert.equal(metadata.openGraph.url, "/creatine");
  assert.equal(metadata.twitter.card, "summary");
  assert.equal(metadata.openGraph.title, "Compare Creatine Prices UK | SupplementScout");
  assert.equal(metadata.twitter.title, metadata.openGraph.title);
  assert.equal(metadata.openGraph.description, metadata.description);
  assert.equal(metadata.twitter.description, metadata.description);
  const layout = fs.readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8");
  assert.match(layout, /template: "%s \| SupplementScout"/);
  assert.ok(metadata.openGraph.title.length <= 60, "keep the generated branded title concise");
  for (const params of [{ sort: "delivered_total" }, { sort: "verified_value" }, { brand: "example" }, { retailer: "1" }, { utm_source: "example" }]) {
    const parameterized = await page.generateMetadata({ searchParams: Promise.resolve(params) });
    assert.deepEqual(parameterized, { ...metadata, robots: { index: false, follow: true } });
  }
  const collection = page.buildCreatineStructuredData([], null)["@graph"][0];
  assert.equal(collection.name, metadata.title);
  assert.equal(collection.description, metadata.description);
});

test("fresh-offer launch status includes Creatine in the sitemap", () => {
  const sitemapSource = fs.readFileSync(sitemapPath, "utf8");
  assert.equal(launch.CREATINE_LAUNCH_STATUS.allowIndexing, true);
  assert.equal(launch.CREATINE_LAUNCH_STATUS.includeInSitemap, true);
  assert.equal(sitemapSource.includes("/creatine"), true);
});

test("launch readiness reports implementation ready but stale launch blocked", () => {
  const result = launch.evaluateCreatineLaunchReadiness({
    activeProducts: 41,
    activeOffers: 61,
    retailers: 6,
    productsWithMultipleRetailers: 6,
    latestOfferCheckedAt: "2026-06-16T20:48:02.382Z",
    implementationChecks: {
      metadata: true,
      structuredData: true,
      methodology: true,
      provenance: true,
    },
    now: new Date("2026-07-18T10:42:41.600Z"),
  });

  assert.equal(result.pageImplementationReady, true);
  assert.equal(result.indexLaunchAllowed, false);
  assert.deepEqual(result.blockers, ["offers_stale"]);
});

test("fresh launch-ready data enables indexing", () => {
  const result = launch.evaluateCreatineLaunchReadiness({
    activeProducts: 41,
    activeOffers: 61,
    retailers: 6,
    productsWithMultipleRetailers: 6,
    latestOfferCheckedAt: "2026-07-18T10:00:00.000Z",
    implementationChecks: {
      metadata: true,
      structuredData: true,
      methodology: true,
      provenance: true,
    },
    now: new Date("2026-07-18T10:42:41.600Z"),
  });

  assert.deepEqual(result.blockers, []);
  assert.equal(result.indexLaunchAllowed, true);
});

test("thin-content readiness fails closed across coverage and content checks", () => {
  const result = launch.evaluateCreatineLaunchReadiness({
    activeProducts: 2,
    activeOffers: 1,
    retailers: 1,
    productsWithMultipleRetailers: 0,
    latestOfferCheckedAt: null,
    implementationChecks: {
      metadata: true,
      structuredData: false,
      methodology: true,
      provenance: false,
    },
  });

  assert.equal(result.pageImplementationReady, false);
  assert.equal(result.indexLaunchAllowed, false);
  assert.ok(result.blockers.includes("implementation_contract_incomplete"));
  assert.ok(result.blockers.includes("insufficient_products"));
  assert.ok(result.blockers.includes("insufficient_offers"));
  assert.ok(result.blockers.includes("insufficient_retailers"));
  assert.ok(result.blockers.includes("insufficient_multi_retailer_coverage"));
  assert.ok(result.blockers.includes("offer_freshness_unavailable"));
});

test("comparison query is one exact-category request with no N+1 calls", async () => {
  const mock = queryMock({ data: [rawProduct()], error: null });
  let fromCalls = 0;
  const { getCreatineComparison } = loadComparison({
    from(table) {
      fromCalls += 1;
      assert.equal(table, "products");
      return mock.query;
    },
  });
  const result = await getCreatineComparison();

  assert.equal(fromCalls, 1);
  assert.equal(result.error, false);
  assert.equal(result.rows.length, 1);
  assert.ok(mock.calls.some((call) => call[0] === "ilike" && call[1] === "category" && call[2] === "creatine"));
  assert.ok(!mock.calls.some((call) => call[0] === "eq" && call[1] === "offers.in_stock"));
  assert.match(mock.calls.find((call) => call[0] === "select")[1], /last_checked_at/);
  assert.match(mock.calls.find((call) => call[0] === "select")[1], /retailer:retailers/);
});

test("comparison normalization uses known delivered price and shared verified cost", () => {
  const result = comparisonFixture();
  const verified = result.rows.find((row) => row.id === "1");

  assert.equal(verified.bestOffer.id, "12");
  assert.equal(verified.bestOffer.deliveredPrice.totalPrice, 14);
  assert.equal(verified.bestOffer.shippingCost, 1);
  assert.equal(verified.retailerCount, 2);
  assert.equal(verified.offerCount, 2);
  assert.equal(verified.verifiedCostPer5g, 0.28);
  assert.equal(verified.lastCheckedAt, "2026-07-16T20:48:02.382Z");
  assert.equal(result.summary.latestOfferCheckedAt, "2026-07-16T20:48:02.382Z");
});

test("unknown shipping never becomes free delivery or a verified cost", () => {
  const result = comparisonFixture();
  const unknown = result.rows.find((row) => row.id === "2");

  assert.equal(unknown.bestOffer.productPrice, 8.99);
  assert.equal(unknown.bestOffer.shippingCost, null);
  assert.equal(unknown.bestOffer.deliveredPrice, null);
  assert.equal(unknown.verifiedCostPer5g, null);
});

function budgetProduct(overrides = {}, offerOverrides = {}, variantOverrides = {}) {
  const product = rawProduct(overrides);
  product.offers = [{
    ...rawProduct().offers[0],
    retailer_product_id: 101,
    url: "https://retailer.example/creatine",
    price: 16.01,
    shipping_cost: 3.99,
    variant_resolution: "resolved",
    ...offerOverrides,
    product_variant: {
      id: 201, product_id: product.id, display_name: "Unflavoured",
      size_value: 250, size_unit: "g", pack_count: 1,
      product_format: "powder", is_active: true,
      ...variantOverrides,
    },
  }];
  return product;
}

function budgetRows(products) {
  return loadComparison({}).normalizeCreatineComparison(products, { now: FIXTURE_NOW }).rows;
}

test("under-20 examples include the exact £20 delivered boundary and free shipping", () => {
  const { selectCreatineUnder20 } = loadComparison({});
  const rows = budgetRows([
    budgetProduct(),
    budgetProduct({ id: 2 }, { price: 19, shipping_cost: 0 }),
    budgetProduct({ id: 3 }, { price: 16.02 }),
    budgetProduct({ id: 4 }, { price: 1, shipping_cost: null }),
    budgetProduct({ id: 5 }, { in_stock: false }),
    budgetProduct({ id: 6 }, { last_checked_at: "2026-07-14T20:00:00Z" }),
  ]);
  const examples = selectCreatineUnder20(rows, FIXTURE_NOW);
  assert.deepEqual(examples.map(({ row }) => row.id), ["2", "1"]);
  assert.equal(examples[1].offer.deliveredPrice.totalPrice, 20);
  assert.equal(examples[1].offer.verifiedCostPer5g, 0.4);
  assert.equal(examples[1].offer.packLabel, "250 g");
});

test("budget examples require resolved active variants belonging to the exact product and known packs", () => {
  const products = [
    budgetProduct({ id: 1 }, { variant_resolution: "unresolved" }),
    budgetProduct({ id: 2 }, { retailer_product_id: null }),
    budgetProduct({ id: 3 }, {}, { product_id: 999 }),
    budgetProduct({ id: 4 }, {}, { is_active: false }),
    budgetProduct({ id: 5 }, {}, { size_value: null }),
    budgetProduct({ id: 6 }, {}, { size_unit: null }),
    budgetProduct({ id: 7 }, {}, { pack_count: null }),
    budgetProduct({ id: 8 }, {}, { display_name: "", flavour_label: null }),
    budgetProduct({ id: 9 }, { retailer: null }),
  ];
  assert.deepEqual(loadComparison({}).selectCreatineUnder20(budgetRows(products), FIXTURE_NOW), []);
});

test("cached budget offers age out at render time without affecting route indexability", async () => {
  const { selectCreatineUnder20 } = loadComparison({});
  const rows = budgetRows([budgetProduct()]);
  assert.equal(selectCreatineUnder20(rows, FIXTURE_NOW).length, 1);
  assert.deepEqual(selectCreatineUnder20(rows, new Date("2026-07-18T00:00:00Z")), []);
  const { page } = loadPage();
  assert.deepEqual((await page.generateMetadata()).robots, { index: true, follow: true });
});

test("variant nutrition cannot inherit another pack's verified unit price", () => {
  const rows = budgetRows([
    budgetProduct({ id: 1 }, {}, { size_value: 500 }),
    budgetProduct({ id: 2 }, {}, {
      size_value: 500,
      nutrition_override: {
        serving_count_verified: 100, serving_size_g: 5, creatine_per_serving_g: 5,
        nutrition_verified: true, unit_pricing_verified: true,
      },
    }),
    budgetProduct({ id: 3 }, {}, { pack_count: 2 }),
    budgetProduct({ id: 4, nutrition_verified: false }),
    budgetProduct({ id: 5, serving_count_verified: null, unit_pricing_verified: false }),
    budgetProduct({ id: 6 }, {}, { size_unit: "capsules", size_value: 120 }),
    budgetProduct({ id: 7, unit_pricing_verified: false }),
  ]);
  const offers = new Map(rows.map((row) => [row.id, row.budgetOffers[0]]));
  assert.equal(offers.get("1").verifiedCostPer5g, null);
  assert.equal(offers.get("2").verifiedCostPer5g, 0.2);
  assert.equal(offers.get("3").verifiedCostPer5g, null);
  assert.equal(offers.get("4").verifiedCostPer5g, null);
  assert.equal(offers.get("5").verifiedCostPer5g, null);
  assert.equal(offers.get("6").verifiedCostPer5g, null);
  // The shared helper can use explicitly verified servings without a weight fallback.
  assert.equal(offers.get("7").verifiedCostPer5g, 0.4);
});

test("budget examples keep at most three products and select each product's cheapest eligible variant", () => {
  const products = Array.from({ length: 5 }, (_, index) => budgetProduct({ id: index + 1 }, { price: 10 + index }));
  products[0].offers.push(budgetProduct({}, { id: 99, price: 9 }).offers[0]);
  const examples = loadComparison({}).selectCreatineUnder20(budgetRows(products), FIXTURE_NOW);
  assert.deepEqual(examples.map(({ row }) => row.id), ["1", "2", "3"]);
  assert.equal(examples[0].offer.id, "99");
});

test("budget SSR contains exact variant links, delivered breakdown, checked time and honest zero state", () => {
  const { page } = loadPage();
  const rows = budgetRows([budgetProduct(), budgetProduct({ id: 2 }, {}, { size_value: 500 })]);
  const html = renderToStaticMarkup(React.createElement(page.CreatineBudgetSection, { rows, now: FIXTURE_NOW }));
  assert.match(html, /id="under-20"/);
  assert.match(html, /Variant: Unflavoured\. Pack: 250 g/);
  assert.match(html, /href="\/product\/verified-creatine\?variant=201"/);
  assert.match(html, /Delivered total/);
  assert.match(html, /£20\.00/);
  assert.match(html, /£3\.99/);
  assert.match(html, /Not yet verified/);
  assert.match(html, /<time dateTime="2026-07-16T20:48:02.382Z">/);
  assert.match(html, /priority=lowest_delivered_price/);
  assert.match(html, /not a serving recommendation or an effectiveness score/);
  const empty = renderToStaticMarkup(React.createElement(page.CreatineBudgetSection, { rows, now: new Date("2026-07-18T00:00:00Z") }));
  assert.match(empty, /cannot currently show an exact-variant/);
  assert.doesNotMatch(empty, /£20\.00|£3\.99|<dl/);
});

test("the shared variant resolver is called once for the existing category batch", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: FIXTURE_NOW.getTime() });
  const mock = queryMock({ data: [budgetProduct({}, { last_checked_at: FIXTURE_NOW.toISOString() })], error: null });
  let batches = 0;
  const { getCreatineComparison } = loadComparison({ from: () => mock.query }, async (products) => {
    batches += 1;
    assert.equal(products.length, 1);
    assert.equal(products[0].offers[0].retailer_product_id, 101);
    return products;
  });
  const result = await getCreatineComparison();
  assert.equal(batches, 1);
  assert.equal(result.rows[0].budgetOffers.length, 1);
  assert.match(mock.calls.find((call) => call[0] === "select")[1], /retailer_product_id/);
});

test("a variant read error preserves the comparison but never produces inferred budget examples", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: FIXTURE_NOW.getTime() });
  const resolve = compileModule(path.join(process.cwd(), "app/lib/categoryComparisonVariants.ts"), {
    mocks: {
      "server-only": {},
      "./supabaseAdmin": { supabaseAdmin: {
        from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: "read failed" } }) }) }),
      } },
    },
  });
  const mock = queryMock({ data: [budgetProduct({}, { last_checked_at: FIXTURE_NOW.toISOString() })], error: null });
  const comparison = loadComparison({ from: () => mock.query }, resolve.resolveCategoryComparisonVariants);
  const result = await comparison.getCreatineComparison();
  assert.equal(result.error, false);
  assert.equal(result.rows.length, 1);
  assert.ok(result.rows[0].bestOffer);
  assert.deepEqual(result.rows[0].budgetOffers, []);
});

test("exact category matching excludes broader category strings and keeps no-offer products", () => {
  const { normalizeCreatineComparison } = loadComparison({});
  const result = normalizeCreatineComparison(
    [
      rawProduct({ category: " Creatine " }),
      rawProduct({ id: 2, category: "Creatine Blend" }),
      rawProduct({ id: 3, name: "No Offer", offers: [] }),
    ],
    { now: FIXTURE_NOW }
  );

  assert.equal(result.rows.length, 2);
  assert.ok(result.rows.some((row) => row.id === "3" && row.bestOffer === null));
});

test("comparison sorting puts known delivered totals before unknown and unavailable rows", () => {
  const result = comparisonFixture();
  assert.deepEqual(result.rows.map((row) => row.id), ["1", "2", "3"]);
});

test("stale offers are excluded from current ranking, retailer counts and verified costs", () => {
  const { normalizeCreatineComparison } = loadComparison({});
  const result = normalizeCreatineComparison(
    [
      rawProduct({
        offers: [
          {
            id: 10,
            price: 1,
            shipping_cost: 1,
            in_stock: true,
            last_checked_at: "2026-06-14T20:00:00.000Z",
            retailer: { id: 1, name: "Stale Cheap Retailer", slug: "stale" },
          },
          {
            id: 11,
            price: 12,
            shipping_cost: 3,
            in_stock: true,
            last_checked_at: "2026-07-16T20:30:00.000Z",
            retailer: { id: 2, name: "Fresh Retailer", slug: "fresh" },
          },
        ],
      }),
    ],
    { now: FIXTURE_NOW }
  );

  const row = result.rows[0];
  assert.equal(row.bestOffer.id, "11");
  assert.equal(row.bestOffer.retailer.name, "Fresh Retailer");
  assert.equal(row.offerCount, 1);
  assert.equal(row.retailerCount, 1);
  assert.equal(row.verifiedCostPer5g, 0.3);
  assert.equal(result.summary.activeOffers, 1);
  assert.equal(result.summary.staleOffersExcluded, 1);
});

test("query errors return a safe empty result", async () => {
  const mock = queryMock({ data: null, error: { message: "database detail" } });
  const { getCreatineComparison } = loadComparison({ from: () => mock.query });
  const originalError = console.error;
  console.error = () => {};

  try {
    const result = await getCreatineComparison();
    assert.equal(result.error, true);
    assert.deepEqual(result.rows, []);
    assert.equal(result.summary.latestOfferCheckedAt, null);
  } finally {
    console.error = originalError;
  }
});

test("SSR content includes quick decisions, comparison fields, stale catalogue rows and verified fallback", () => {
  const { page } = loadPage();
  const html = renderToStaticMarkup(React.createElement(page.CreatinePageContent, { result: comparisonFixture() }));

  assert.match(html, /Compare Creatine Supplements UK/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /Compare current creatine prices from UK retailers, including known delivery costs/);
  assert.match(html, /Check the exact variant, pack and formulation, including for creatine monohydrate/);
  assert.match(html, /Powders, capsules, gummies and blends can differ/);
  assert.match(html, /Cost per 5 g needs verified pack and creatine data/);
  assert.match(html, /Quick decision 1/);
  assert.match(html, /href="\/product\/verified-creatine"/);
  for (const heading of ["Product", "Brand", "Best available retailer", "Product price", "Delivered price", "Retailer count", "Cost per 5 g", "Stock\/status"]) {
    assert.match(html, new RegExp(heading));
  }
  assert.match(html, /Not yet verified/);
  assert.match(html, /Delivery not known/);
  assert.match(html, /Availability being rechecked/);
  assert.match(html, /No Offer Creatine/);
  assert.match(html, /250 g/);
  assert.match(html, /50 verified servings/);
  assert.match(html, /5 g creatine \/ serving/);
  assert.match(html, /href="\/product\/verified-creatine"/);
});

test("SSR content includes methodology, provenance, freshness, limitations and internal links", () => {
  const { page } = loadPage();
  const html = renderToStaticMarkup(React.createElement(page.CreatinePageContent, { result: comparisonFixture() }));

  assert.match(html, /How this creatine comparison works/);
  assert.match(html, /Data sources and freshness/);
  assert.match(html, /Latest retailer check:/);
  assert.match(html, /Comparison limitations/);
  assert.match(html, /href="\/affiliate-disclosure"/);
  assert.match(html, /href="\/contact"/);
  assert.match(html, /href="\/search\?q=Creatine"/);
  assert.match(html, /href="\/about"/);
  assert.match(html, /href="\/"/);
});

test("structured data contains CollectionPage, matching ItemList and BreadcrumbList", () => {
  const { page } = loadPage();
  const result = comparisonFixture();
  const data = page.buildCreatineStructuredData(result.rows, result.summary.latestOfferCheckedAt);
  const graphByType = new Map(data["@graph"].map((entry) => [entry["@type"], entry]));
  const collection = graphByType.get("CollectionPage");
  const itemList = graphByType.get("ItemList");
  const breadcrumb = graphByType.get("BreadcrumbList");
  const freshRows = result.rows.filter((row) => row.bestOffer !== null);

  assert.equal(collection.url, "https://www.supplementscout.co.uk/creatine");
  assert.equal(itemList.numberOfItems, freshRows.length);
  assert.deepEqual(itemList.itemListElement.map((item) => item.name), freshRows.map((row) => row.name));
  assert.equal(itemList.itemListElement[0].item.offers.price, "13.00");
  assert.equal(itemList.itemListElement[0].item.offers.availability, "https://schema.org/InStock");
  assert.equal(itemList.itemListElement.some((item) => item.name === "No Offer Creatine"), false);
  assert.deepEqual(itemList.itemListElement.map((item) => item.position), [1, 2]);
  assert.deepEqual(breadcrumb.itemListElement.map((item) => item.name), ["Home", "Creatine"]);
  assert.equal(JSON.stringify(data).includes("ratingValue"), false);
  assert.equal(JSON.stringify(data).includes("reviewCount"), false);
});

test("Product structured data is emitted only for products with fresh current offers", () => {
  const { page } = loadPage();
  const result = comparisonFixture();
  const data = page.buildCreatineStructuredData(result.rows, result.summary.latestOfferCheckedAt);
  const products = structuredDataProducts(data);

  assert.equal(products.length, 2);
  assert.deepEqual(products.map((product) => product.name), [
    "Verified Creatine 250g",
    "Shipping Unknown Creatine",
  ]);
  assert.equal(products.some((product) => product.name === "No Offer Creatine"), false);

  for (const product of products) {
    assert.ok(product.offers || product.review || product.aggregateRating);
    assert.equal(product.offers["@type"], "Offer");
    assert.equal(product.offers.priceCurrency, "GBP");
    assert.match(product.offers.price, /^\d+\.\d{2}$/);
    assert.equal(product.offers.availability, "https://schema.org/InStock");
  }
});

test("stale-only products stay visible in HTML but stale prices do not enter JSON-LD", () => {
  const { normalizeCreatineComparison } = loadComparison({});
  const { page } = loadPage();
  const result = {
    ...normalizeCreatineComparison(
      [
        rawProduct({
          id: 100,
          slug: "stale-only-creatine",
          name: "Stale Only Creatine",
          offers: [
            {
              id: 1001,
              price: 1.23,
              shipping_cost: 0,
              in_stock: true,
              last_checked_at: "2026-06-14T20:00:00.000Z",
              retailer: { id: 100, name: "Old Retailer", slug: "old-retailer" },
            },
          ],
        }),
      ],
      { now: FIXTURE_NOW }
    ),
    error: false,
  };

  const data = page.buildCreatineStructuredData(result.rows, result.summary.latestOfferCheckedAt);
  const html = renderToStaticMarkup(React.createElement(page.CreatinePageContent, { result }));
  const json = JSON.stringify(data);

  assert.match(html, /Stale Only Creatine/);
  assert.match(html, /Availability being rechecked/);
  assert.equal(structuredDataProducts(data).length, 0);
  assert.equal(json.includes("Stale Only Creatine"), false);
  assert.equal(json.includes("1.23"), false);
});

test("rendered JSON-LD is sanitized and present after index launch", () => {
  const { page } = loadPage();
  const result = comparisonFixture();
  result.rows[0].name = "Safe <Creatine>";
  const html = renderToStaticMarkup(React.createElement(page.CreatinePageContent, { result }));
  const script = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1];

  assert.equal(script.includes("<Creatine>"), false);
  assert.equal(script.includes("\\u003cCreatine>"), true);
  assert.equal(JSON.parse(script)["@context"], "https://schema.org");
});

test("empty and degraded states remain useful and do not expose prices", () => {
  const { page } = loadPage();
  const empty = { rows: [], summary: { activeProducts: 0, activeOffers: 0, retailers: 0, productsWithMultipleRetailers: 0, latestOfferCheckedAt: null, staleOffersExcluded: 0 }, error: false };
  const failed = { ...empty, error: true };
  const emptyHtml = renderToStaticMarkup(React.createElement(page.CreatinePageContent, { result: empty }));
  const failedHtml = renderToStaticMarkup(React.createElement(page.CreatinePageContent, { result: failed }));

  assert.match(emptyHtml, /No Creatine products are available to compare/);
  assert.match(emptyHtml, /No retailer check time is available/);
  assert.match(failedHtml, /comparison is temporarily unavailable/);
  assert.match(failedHtml, /No prices have been estimated or reused/);
  assert.doesNotMatch(failedHtml, /£0/);
});

test("comparison scroll region contains absolute accessibility labels without clipping the page", () => {
  const { page } = loadPage();
  const html = renderToStaticMarkup(React.createElement(page.CreatinePageContent, { result: comparisonFixture() }));
  const main = html.match(/<main\b[^>]*>/)[0];
  const region = html.match(/<div\b[^>]*data-mobile-overflow="controlled"[^>]*>/)[0];
  const classes = region.match(/class="([^"]+)"/)[1].split(" ");
  assert.ok(classes.includes("relative"), "absolute sr-only labels must use the scrolling region as their containing block");
  assert.ok(classes.includes("overflow-x-auto"));
  assert.match(region, /role="region"/);
  assert.match(region, /aria-labelledby="comparison-heading"/);
  assert.match(region, /tabindex="0"/i);
  assert.match(html, /id="comparison-heading"/);
  assert.doesNotMatch(main, /overflow-(?:x-)?hidden|clip-path|scale-/);
  assert.match(html, /<table[^>]*min-w-\[1120px\]/);
  assert.equal((html.match(/<th\s+scope="col"/g) || []).length, 9);
  assert.match(html, /<caption[^>]*class="sr-only"[^>]*>Creatine supplement retailer and delivered-price comparison<\/caption>/);
  assert.match(html, /<span class="sr-only">Compare or view details<\/span>/);
});

test("homepage provides contextual discovery links to /creatine", () => {
  const source = fs.readFileSync(homepagePath, "utf8");
  const categoryRoutesSource = fs.readFileSync(categoryRoutesPath, "utf8");
  const configuredCreatineLinks =
    `${source}\n${categoryRoutesSource}`.match(
      /\{ label: "Creatine", href: "\/creatine" \}/g
    ) || [];

  assert.ok(configuredCreatineLinks.length >= 2);
  assert.match(source, /href=\{itemHref\(item\)\}/);
  assert.match(source, /href: categoryBrowseHref\(category\)/);
  assert.match(source, /COMPARISON_CATEGORY_LINKS/);
  assert.match(source, /<HomeCategories items=\{categoryLinks\}/);
});

test("page copy avoids unsupported ranking, rating and medical claims", () => {
  const source = fs.readFileSync(pagePath, "utf8").toLowerCase();
  assert.equal(source.includes("best creatine in the uk"), false);
  assert.equal(source.includes("ratingvalue"), false);
  assert.equal(source.includes("reviewcount"), false);
  assert.equal(source.includes("clinically proven"), false);
  assert.equal(source.includes("guaranteed results"), false);
});

test("default route loads comparison data once and returns renderable SSR content", async () => {
  const loaded = loadPage();
  const element = await loaded.page.default();
  const html = renderToStaticMarkup(element);
  assert.equal(loaded.loaderCalls(), 1);
  assert.match(html, /Compare Creatine Supplements UK/);
});
