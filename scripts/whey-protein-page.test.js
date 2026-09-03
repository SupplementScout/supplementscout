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

const pricingPath = path.join(process.cwd(), "app", "lib", "pricing.ts");
const freshnessPath = path.join(process.cwd(), "app", "lib", "creatineLaunch.ts");
const categoryComparisonPath = path.join(
  process.cwd(),
  "app",
  "lib",
  "categoryComparison.ts"
);
const wheyComparisonPath = path.join(
  process.cwd(),
  "app",
  "lib",
  "wheyComparison.ts"
);
const pagePath = path.join(
  process.cwd(),
  "app",
  "whey-protein",
  "page.tsx"
);
const sitemapPath = path.join(process.cwd(), "app", "sitemap.ts");
const homePath = path.join(process.cwd(), "app", "page.tsx");
const analyticsTrackerPath = path.join(
  process.cwd(),
  "app",
  "components",
  "CategoryViewAnalytics.tsx"
);
const pricing = compileModule(pricingPath);
const offerFreshness = compileModule(path.join(process.cwd(), "app", "lib", "offerFreshness.ts"));
const freshness = compileModule(freshnessPath, {
  mocks: { "./offerFreshness": offerFreshness },
});
const nutritionMetrics = compileModule(path.join(process.cwd(), "app", "lib", "nutritionMetrics.ts"));
const categoryComparison = compileModule(categoryComparisonPath, {
  mocks: {
    "./creatineLaunch": freshness,
    "./offerFreshness": offerFreshness,
    "./pricing": pricing,
  },
});
const FIXTURE_NOW = new Date("2026-07-29T12:00:00.000Z");

function rawOffer(overrides = {}) {
  return {
    id: 11,
    retailer_product_id: 101,
    price: 24,
    shipping_cost: 4.99,
    in_stock: true,
    last_checked_at: "2026-07-29T11:00:00.000Z",
    url: "https://retailer.example/products/whey",
    retailer: { id: 1, name: "Retailer One", slug: "retailer-one" },
    ...overrides,
  };
}

function rawProduct(overrides = {}) {
  return {
    id: 1,
    slug: "example-whey-protein-1kg",
    name: "Example Whey Protein 1kg",
    brand: "Example Nutrition",
    category: "Whey Protein",
    image: "https://example.test/whey.png",
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
    offers: [rawOffer()],
    ...overrides,
  };
}

function loadWheyComparison(mockSupabase = {}) {
  return compileModule(wheyComparisonPath, {
    mocks: {
      "./categoryComparison": categoryComparison,
      "./categoryComparisonVariants": { resolveCategoryComparisonVariants: async (products) => products },
      "./nutritionMetrics": nutritionMetrics,
      "./supabase": { supabase: mockSupabase },
    },
  });
}

function fixtureResult() {
  const whey = loadWheyComparison();
  return {
    ...whey.normalizeWheyComparison(
      [
        rawProduct(),
        rawProduct({
          id: 2,
          slug: "many-retailers-whey-2kg",
          name: "Many Retailers Whey Protein 2kg",
          offers: [
            rawOffer({ id: 21, price: 29 }),
            rawOffer({
              id: 22,
              price: 28,
              retailer: { id: 2, name: "Retailer Two", slug: "two" },
            }),
          ],
        }),
      ],
      { now: FIXTURE_NOW }
    ),
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

function loadPage(result = fixtureResult()) {
  let calls = 0;
  const whey = loadWheyComparison();
  const page = compileModule(pagePath, {
    mocks: {
      "next/link": { __esModule: true, default: Link },
      "../components/ComparisonProductVisuals": require("./test-helpers/comparison-product-visuals"),
      "../components/CategoryViewAnalytics": {
        __esModule: true,
        default: () => null,
      },
      "../components/ComparisonTransparencyLinks": {
        __esModule: true,
        default: () => null,
      },
      "../lib/pricing": pricing,
      "../lib/wheyComparison": {
        getWheyComparison: async () => {
          calls += 1;
          return result;
        },
        evaluateWheyIndexability: whey.evaluateWheyIndexability,
        WHEY_INDEX_GATE: whey.WHEY_INDEX_GATE,
      },
    },
  });
  return { page, calls: () => calls };
}

test("Whey scope includes reviewed dairy whey and excludes broad protein leaks", () => {
  const { isWheyProteinProduct } = loadWheyComparison();

  assert.equal(isWheyProteinProduct(rawProduct()), true);
  assert.equal(
    isWheyProteinProduct(rawProduct({ name: "Applied Nutrition ISO-XP 1.8kg" })),
    true
  );
  assert.equal(
    isWheyProteinProduct(rawProduct({ name: "Dymatize ISO 100 2.27kg" })),
    true
  );
  assert.equal(
    isWheyProteinProduct(rawProduct({ name: "Rule1 R1 Protein 29 Servings" })),
    true
  );
  assert.equal(
    isWheyProteinProduct(rawProduct({ name: "Critical Plant Protein 1.8kg" })),
    false
  );
  assert.equal(
    isWheyProteinProduct(rawProduct({ name: "BEEF-XP Protein Isolate 1.8kg" })),
    false
  );
  assert.equal(
    isWheyProteinProduct(rawProduct({ name: "Micellar Casein 1kg" })),
    false
  );
  assert.equal(
    isWheyProteinProduct(rawProduct({ name: "Whey Pro Synergy BCAA Bundle" })),
    false
  );
  assert.equal(
    isWheyProteinProduct(rawProduct({ name: "Axe DemoDay Powder 930g" })),
    false
  );
});

test("inactive, merged and wrongly categorised products are excluded", () => {
  const { isWheyProteinProduct } = loadWheyComparison();
  assert.equal(isWheyProteinProduct(rawProduct({ is_active: false })), false);
  assert.equal(
    isWheyProteinProduct(rawProduct({ merged_into_product_id: 99 })),
    false
  );
  assert.equal(
    isWheyProteinProduct(
      rawProduct({ merged_at: "2026-07-29T00:00:00.000Z" })
    ),
    false
  );
  assert.equal(
    isWheyProteinProduct(rawProduct({ category: "Pre Workout" })),
    false
  );
});

test("normalization keeps only fresh mapped offers and ranks known delivery", () => {
  const { normalizeWheyComparison } = loadWheyComparison();
  const result = normalizeWheyComparison(
    [
      rawProduct({
        offers: [
          rawOffer({ id: 1, price: 25, shipping_cost: null }),
          rawOffer({ id: 2, price: 26, shipping_cost: 0 }),
          rawOffer({
            id: 3,
            price: 1,
            last_checked_at: "2026-07-04T11:59:59.000Z",
          }),
          rawOffer({ id: 4, retailer_product_id: null }),
          rawOffer({ id: 5, url: "not-a-url" }),
          rawOffer({ id: 6, in_stock: false }),
        ],
      }),
    ],
    { now: FIXTURE_NOW }
  );

  assert.equal(result.rows.length, 1);
  assert.equal(result.summary.freshOffers, 2);
  assert.equal(result.rows[0].bestOffer.id, "2");
  assert.equal(result.rows[0].bestOffer.deliveredPrice.totalPrice, 26);
  assert.equal(result.summary.staleOrUnusableOffersExcluded, 3);
});

test("active canonical products remain visible when no offer is current", () => {
  const { normalizeWheyComparison } = loadWheyComparison();
  const recent = rawProduct({
    id: 41,
    name: "Recent unavailable Whey Protein",
    offers: [rawOffer({ last_checked_at: "2026-07-27T12:00:00.000Z" })],
  });
  const unverified = rawProduct({
    id: 42,
    name: "Old unavailable Whey Protein",
    offers: [rawOffer({ last_checked_at: "2026-07-20T12:00:00.000Z" })],
  });
  const live = rawProduct({ id: 43, name: "Live Whey Protein" });
  const result = normalizeWheyComparison([unverified, recent, live], { now: FIXTURE_NOW });

  assert.equal(result.summary.scopedProducts, 3);
  assert.equal(result.summary.visibleProducts, 3);
  assert.deepEqual(result.rows.map((row) => row.id), ["43", "42", "41"]);
  assert.equal(result.rows[0].presentationState, "LIVE");
  assert.equal(result.rows[1].presentationState, "UNVERIFIED");
  assert.equal(result.rows[2].presentationState, "RECENT");
  for (const row of result.rows.slice(1)) {
    assert.equal(row.bestOffer, null);
    assert.equal(row.offerCount, 0);
    assert.equal(row.pricePerKg, null);
    assert.equal(row.pricePerServing, null);
    assert.equal(row.costPer25gProtein, null);
  }
});

test("verified value metrics use delivered price and disappear without verification", () => {
  const { normalizeWheyComparison } = loadWheyComparison();
  const result = normalizeWheyComparison(
    [
      rawProduct(),
      rawProduct({
        id: 2,
        name: "Unverified Whey Protein 1kg",
        unit_pricing_verified: false,
        nutrition_verified: false,
      }),
    ],
    { now: FIXTURE_NOW }
  );
  const verified = result.rows.find((row) => row.id === "1");
  const unverified = result.rows.find((row) => row.id === "2");

  assert.ok(Math.abs(verified.pricePerKg - 28.99) < 1e-10);
  assert.ok(Math.abs(verified.pricePerServing - 28.99 / 40) < 1e-10);
  assert.ok(
    Math.abs(verified.costPer25gProtein - (28.99 / 800) * 25) < 1e-10
  );
  assert.equal(unverified.pricePerKg, null);
  assert.equal(unverified.costPer25gProtein, null);
});

test("comparison metrics fail closed for an unresolved or unapproved pack mismatch", () => {
  const { normalizeWheyComparison } = loadWheyComparison();
  const [row] = normalizeWheyComparison(
    [
      rawProduct({
        net_weight_g: 2270,
        offers: [
          rawOffer({
            product_variant: {
              size_value: 2000,
              size_unit: "g",
              product_format: "powder",
              nutrition_override: {},
            },
            variant_resolution: "resolved",
          }),
        ],
      }),
    ],
    { now: FIXTURE_NOW }
  ).rows;

  assert.equal(row.netWeightG, 2000);
  assert.ok(row.pricePerKg > 0);
  assert.equal(row.verifiedServingCount, null);
  assert.equal(row.pricePerServing, null);
  assert.equal(row.costPer25gProtein, null);
  assert.equal(row.nutritionVerified, false);

  const [unresolved] = normalizeWheyComparison(
    [
      rawProduct({
        offers: [rawOffer({ variant_resolution: "unresolved" })],
      }),
    ],
    { now: FIXTURE_NOW }
  ).rows;
  assert.equal(unresolved.pricePerServing, null);
  assert.equal(unresolved.costPer25gProtein, null);
  assert.equal(unresolved.nutritionVerified, false);
});

test("coverage-first ranking prefers products with more distinct retailers", () => {
  const result = fixtureResult();
  assert.equal(result.rows[0].name, "Many Retailers Whey Protein 2kg");
  assert.equal(result.rows[0].retailerCount, 2);
});

test("the indexability gate closes safely when comparison coverage falls", () => {
  const whey = loadWheyComparison();
  const result = fixtureResult();
  const blocked = whey.evaluateWheyIndexability(result.summary, true);
  assert.equal(blocked.indexable, false);
  assert.ok(blocked.blockers.includes("insufficient_multi_retailer_products"));

  const ready = whey.evaluateWheyIndexability(
    {
      ...result.summary,
      freshOffers: 100,
      productsWithMultipleFreshRetailers: 12,
      freshRetailersAcrossComparisons: 5,
    },
    true
  );
  assert.deepEqual(ready, { indexable: true, blockers: [] });
});

test("the production query is bounded and requires the exact Whey category", async () => {
  const calls = [];
  const query = {};
  for (const method of ["select", "eq", "is", "gt", "order"]) {
    query[method] = (...args) => {
      calls.push([method, ...args]);
      return query;
    };
  }
  query.range = (...args) => {
    calls.push(["range", ...args]);
    return Promise.resolve({ data: [], error: null });
  };

  const whey = loadWheyComparison({ from: () => query });
  const result = await whey.getWheyComparison();
  assert.equal(result.error, false);
  assert.ok(
    calls.some(
      (call) =>
        call[0] === "eq" &&
        call[1] === "category" &&
        call[2] === "Whey Protein"
    )
  );
  assert.ok(
    calls.some(
      (call) => call[0] === "range" && call[1] === 0 && call[2] === 999
    )
  );
});

test("live-verified metadata is canonical and stable across live coverage", async () => {
  const readyResult = fixtureResult();
  readyResult.summary = {
    ...readyResult.summary,
    freshOffers: 100,
    productsWithMultipleFreshRetailers: 12,
    freshRetailersAcrossComparisons: 5,
  };
  const readyPage = loadPage(readyResult);
  const readyMetadata = await readyPage.page.generateMetadata();
  assert.equal(readyMetadata.title, "Compare Whey Protein Prices UK");
  assert.equal(
    readyMetadata.description,
    "Compare current Whey Protein prices from UK supplement retailers, including known delivery, retailer coverage and verified value metrics.",
  );
  assert.equal(readyMetadata.alternates.canonical, "/whey-protein");
  assert.deepEqual(readyMetadata.robots, { index: true, follow: true });

  const failedPage = loadPage({ ...readyResult, error: true });
  const failedMetadata = await failedPage.page.generateMetadata();
  assert.deepEqual(failedMetadata.robots, { index: true, follow: true });
});

test("structured data describes the collection and breadcrumbs without fake Product entities", () => {
  const { page } = loadPage();
  const data = page.buildWheyStructuredData(fixtureResult().rows);
  const types = data["@graph"].map((item) => item["@type"]);
  const itemList = data["@graph"].find(
    (item) => item["@type"] === "ItemList"
  );

  assert.deepEqual(types, [
    "CollectionPage",
    "ItemList",
    "BreadcrumbList",
  ]);
  assert.equal(itemList.numberOfItems, fixtureResult().rows.length);
  assert.equal(
    itemList.itemListElement.every(
      (item) => item["@type"] === "ListItem" && item.url
    ),
    true
  );
  assert.equal(JSON.stringify(data).includes('"@type":"Product"'), false);
});

test("server-rendered page explains ranking, delivery and verification limits", () => {
  const { page } = loadPage();
  const html = renderToStaticMarkup(
    React.createElement(page.WheyProteinPageContent, {
      result: fixtureResult(),
    })
  );

  assert.match(html, /Compare Whey Protein Prices UK/);
  assert.match(html, /What is the lowest current Whey Protein delivered price\?/);
  assert.match(html, /Across 2 Whey Protein products with recently checked offers/);
  assert.match(html, /lowest known delivered price is <strong>£28\.99<\/strong>/);
  assert.match(html, /href="\/product\/example-whey-protein-1kg"/);
  assert.match(html, /not a claim about every UK seller/);
  assert.match(html, /Includes known delivery/);
  assert.match(html, /coverage-first comparison/i);
  assert.match(html, /not a claim that the first product is nutritionally superior/i);
  assert.match(html, /Plant, beef, collagen, egg and casein-only products are excluded/);
  assert.match(html, /application\/ld\+json/);
  assert.doesNotMatch(html, /Critical Plant Protein|BEEF-XP/);
  assert.match(html, /Search whey/);
});

test("Whey has one sitemap URL and prominent internal links", () => {
  const sitemap = fs.readFileSync(sitemapPath, "utf8");
  const home = fs.readFileSync(homePath, "utf8");
  const creatine = fs.readFileSync(
    path.join(process.cwd(), "app", "creatine", "page.tsx"),
    "utf8"
  );
  const hydration = fs.readFileSync(
    path.join(process.cwd(), "app", "hydration", "page.tsx"),
    "utf8"
  );

  assert.equal(
    (sitemap.match(/`\$\{siteUrl\}\/whey-protein`/g) || []).length,
    1
  );
  assert.match(home, /Whey protein", href: "\/whey-protein"/);
  assert.match(creatine, /href="\/whey-protein"/);
  assert.match(hydration, /href="\/whey-protein"/);
});

test("comparison view analytics uses the consent-aware category event", () => {
  const source = fs.readFileSync(analyticsTrackerPath, "utf8");
  assert.match(source, /sendAnalyticsEvent\("view_category"/);
  assert.match(source, /ANALYTICS_READY_EVENT/);
  assert.match(source, /sent\.current/);
});

test("the default route loads comparison data once", async () => {
  const loaded = loadPage();
  const element = await loaded.page.default();
  assert.equal(loaded.calls(), 1);
  assert.equal(element.type, loaded.page.WheyProteinPageContent);
});
