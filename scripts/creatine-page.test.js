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

const pricingPath = path.join(process.cwd(), "app", "lib", "pricing.ts");
const launchPath = path.join(process.cwd(), "app", "lib", "creatineLaunch.ts");
const comparisonPath = path.join(process.cwd(), "app", "lib", "creatineComparison.ts");
const pagePath = path.join(process.cwd(), "app", "creatine", "page.tsx");
const homepagePath = path.join(process.cwd(), "app", "page.tsx");
const sitemapPath = path.join(process.cwd(), "app", "sitemap.ts");

const pricing = compileModule(pricingPath);
const launch = compileModule(launchPath);
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

function loadComparison(mockSupabase) {
  return compileModule(comparisonPath, {
    mocks: {
      "./creatineLaunch": launch,
      "./pricing": pricing,
      "./supabase": { supabase: mockSupabase },
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
      "../lib/creatineComparison": {
        getCreatineComparison: async () => {
          loaderCalls += 1;
          return result;
        },
      },
      "../lib/creatineLaunch": launch,
      "../lib/pricing": pricing,
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
  assert.match(source, /await getCreatineComparison\(\)/);
});

test("Creatine metadata is unique, canonical and index follow after fresh-offer launch", () => {
  const { page } = loadPage();
  assert.match(page.metadata.title, /Compare Creatine Supplements/);
  assert.match(page.metadata.description, /delivery costs/);
  assert.equal(page.metadata.alternates.canonical, "/creatine");
  assert.deepEqual(page.metadata.robots, { index: true, follow: true });
  assert.equal(page.metadata.openGraph.url, "/creatine");
  assert.equal(page.metadata.twitter.card, "summary");
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
    latestOfferCheckedAt: "2026-07-16T20:48:02.382Z",
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
  assert.ok(mock.calls.some((call) => call[0] === "eq" && call[1] === "offers.in_stock" && call[2] === true));
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
  assert.equal(verified.lastCheckedAt, "2026-07-16T19:00:00.000Z");
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
            last_checked_at: "2026-07-14T20:00:00.000Z",
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

test("SSR content includes direct answer, comparison fields, stale catalogue rows and verified fallback", () => {
  const { page } = loadPage();
  const html = renderToStaticMarkup(React.createElement(page.CreatinePageContent, { result: comparisonFixture() }));

  assert.match(html, /Compare Creatine Supplements UK/);
  assert.match(html, /This page compares creatine products available from UK supplement retailers/);
  for (const heading of ["Product", "Brand", "Best available retailer", "Product price", "Delivered price", "Retailer count", "Cost per 5 g", "Stock\/status"]) {
    assert.match(html, new RegExp(heading));
  }
  assert.match(html, /Not yet verified/);
  assert.match(html, /Delivery not known/);
  assert.match(html, /No recently verified offer/);
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
              last_checked_at: "2026-07-14T20:00:00.000Z",
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
  assert.match(html, /No recently verified offer/);
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

test("comparison table has an explicit mobile overflow guard", () => {
  const { page } = loadPage();
  const html = renderToStaticMarkup(React.createElement(page.CreatinePageContent, { result: comparisonFixture() }));
  assert.match(html, /overflow-x-auto/);
  assert.match(html, /data-mobile-overflow="controlled"/);
  assert.match(html, /<table/);
  assert.match(html, /<caption/);
});

test("homepage provides contextual discovery links to /creatine", () => {
  const source = fs.readFileSync(homepagePath, "utf8");
  assert.match(source, /href="\/creatine"/);
  assert.match(source, /item === "Creatine" \? "\/creatine"/);
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
