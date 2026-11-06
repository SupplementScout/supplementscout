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
    if (request.endsWith("/indexabilityLifecycle")) {
      return compileModule(path.join(process.cwd(), "app/lib/indexabilityLifecycle.ts"));
    }
    if (request.endsWith("/lifecycleDataCache")) {
      return { createLifecycleDataLoader: (_path, _version, load) => load };
    }
    if (request.endsWith("/categoryControls")) {
      return compileModule(path.join(process.cwd(), "app/lib/categoryControls.ts"));
    }
    if (request.endsWith("/categoryCoverage")) {
      return compileModule(path.join(process.cwd(), "app/lib/categoryCoverage.ts"));
    }
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

const root = process.cwd();
const pricing = compileModule(path.join(root, "app/lib/pricing.ts"));
const offerFreshness = compileModule(path.join(root, "app/lib/offerFreshness.ts"));
const freshness = compileModule(path.join(root, "app/lib/creatineLaunch.ts"), {
  mocks: { "./offerFreshness": offerFreshness },
});
const categoryComparison = compileModule(
  path.join(root, "app/lib/categoryComparison.ts"),
  {
    mocks: {
      "./creatineLaunch": freshness,
      "./offerFreshness": offerFreshness,
      "./pricing": pricing,
    },
  }
);
const categoryCoverage = compileModule(path.join(root, "app/lib/categoryCoverage.ts"));
const categoryDecision = compileModule(path.join(root, "app/lib/categoryDecision.ts"));
const comparisonPath = path.join(root, "app/lib/carbohydratesComparison.ts");
const pagePath = path.join(root, "app/carbohydrates/page.tsx");
const FIXTURE_NOW = new Date("2026-11-04T12:00:00.000Z");

function rawOffer(overrides = {}) {
  return {
    id: 11,
    retailer_product_id: 101,
    price: 18.99,
    shipping_cost: 2.99,
    in_stock: true,
    last_checked_at: "2026-11-04T11:00:00.000Z",
    url: "https://retailer.example/carbohydrates",
    retailer: { id: 1, name: "Retailer One", slug: "retailer-one" },
    ...overrides,
  };
}

function rawProduct(overrides = {}) {
  return {
    id: 1,
    slug: "example-carbohydrate-powder",
    name: "Example Carbohydrate Powder 1kg",
    brand: "Example Nutrition",
    category: "Health Supplements",
    description: null,
    image: null,
    product_format: "powder",
    net_weight_g: 1000,
    net_volume_ml: null,
    unit_count: null,
    unit_type: null,
    serving_count_verified: 20,
    serving_size_g: 50,
    protein_per_serving_g: null,
    unit_pricing_verified: true,
    nutrition_verified: false,
    is_active: true,
    merged_into_product_id: null,
    merged_at: null,
    offers: [rawOffer()],
    ...overrides,
  };
}

function loadComparison(mockSupabase = {}) {
  return compileModule(comparisonPath, {
    mocks: {
      "./categoryComparison": categoryComparison,
      "./categoryCoverage": categoryCoverage,
      "./supabase": { supabase: mockSupabase },
    },
  });
}

function fixtureResult() {
  const comparison = loadComparison();
  return {
    ...comparison.normalizeCarbohydratesComparison(
      [
        rawProduct(),
        rawProduct({
          id: 2,
          slug: "example-cream-of-rice",
          name: "Example Cream of Rice 2kg",
          net_weight_g: 2000,
          offers: [
            rawOffer({ id: 21, price: 22 }),
            rawOffer({
              id: 22,
              price: 21,
              shipping_cost: 0,
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
  return {
    page: compileModule(pagePath, {
      mocks: {
        "next/link": { __esModule: true, default: Link },
        "../components/ComparisonProductVisuals": require("./test-helpers/comparison-product-visuals"),
        "../components/CategoryViewAnalytics": { __esModule: true, default: () => null },
        "../components/CategoryDecisionPanel": {
          __esModule: true,
          default: ({ answers }) =>
            answers.length
              ? React.createElement("section", null, `Quick decision ${answers.length}`)
              : null,
        },
        "../components/ComparisonTransparencyLinks": { __esModule: true, default: () => null },
        "../lib/pricing": pricing,
        "../lib/categoryDecision": categoryDecision,
        "../lib/categorySearchIntent": {
          categoryCoverageRawSearchHref: (query) =>
            `/search?q=${encodeURIComponent(query)}&search_mode=raw`,
        },
        "../lib/carbohydratesComparison": {
          getCarbohydratesComparison: async () => {
            calls += 1;
            return result;
          },
        },
      },
    }),
    calls: () => calls,
  };
}

test("Carbohydrates comparison delegates strong-only membership to shared Category Coverage", () => {
  const comparison = loadComparison();
  assert.equal(
    comparison.evaluateCarbohydratesCoverage(rawProduct()).classification,
    "INCLUDE_STRONG"
  );
  assert.equal(
    comparison.isCarbohydratesProduct(rawProduct({ category: "Health Supplements" })),
    true
  );
  assert.equal(
    comparison.isCarbohydratesProduct(rawProduct({
      name: "High5 Energy Gel",
      description: "A carbohydrate source for sport.",
    })),
    false
  );
  assert.equal(
    comparison.isCarbohydratesProduct(rawProduct({
      name: "Carb Killa Protein Bar",
      category: "Protein Bars",
    })),
    false
  );
  assert.equal(comparison.isCarbohydratesProduct(rawProduct({ is_active: false })), false);
  assert.equal(
    comparison.isCarbohydratesProduct(rawProduct({ merged_at: "2026-11-04T00:00:00Z" })),
    false
  );
});

test("normalization keeps strong rows only and preserves freshness and known delivered-price behavior", () => {
  const comparison = loadComparison();
  const result = comparison.normalizeCarbohydratesComparison(
    [
      rawProduct({
        offers: [
          rawOffer({ id: 1, price: 25, shipping_cost: null }),
          rawOffer({ id: 2, price: 26, shipping_cost: 0 }),
          rawOffer({ id: 3, price: 1, last_checked_at: "2026-11-01T11:00:00Z" }),
          rawOffer({ id: 4, retailer_product_id: null }),
        ],
      }),
      rawProduct({ id: 2, name: "Whey Protein", category: "Whey Protein" }),
    ],
    { now: FIXTURE_NOW }
  );

  assert.equal(result.summary.scopedProducts, 1);
  assert.equal(result.summary.freshOffers, 2);
  assert.equal(result.rows[0].bestOffer.id, "2");
  assert.equal(result.rows[0].pricePerKg, 26);
  assert.equal(result.summary.staleOrUnusableOffersExcluded, 2);
});

test("candidate retrieval crosses categories, selects semantic and commercial fields, and paginates to exhaustion", async () => {
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
    const page = args[0] === 0
      ? Array.from({ length: 1000 }, (_, index) =>
          rawProduct({ id: index + 1, offers: [] })
        )
      : [
          rawProduct({
            id: 1001,
            name: "Cross-category Cream of Rice",
            category: "Health Supplements",
            offers: [],
          }),
        ];
    return Promise.resolve({ data: page, error: null });
  };

  const result = await loadComparison({ from: () => query }).getCarbohydratesComparison();
  assert.equal(result.error, false);
  assert.ok(calls.some((call) => call[0] === "select" && /description/.test(call[1]) && /product_format/.test(call[1]) && /offers/.test(call[1])));
  assert.ok(calls.some((call) => call[0] === "or" && /category\.eq\.Carbohydrates/.test(call[1]) && /cream of rice/.test(call[1]) && /description\.ilike/.test(call[1])));
  assert.equal(calls.some((call) => call[0] === "eq" && call[1] === "category"), false);
  assert.deepEqual(
    calls.filter((call) => call[0] === "range").map((call) => call.slice(1)),
    [[0, 999], [1000, 1999]]
  );
  assert.deepEqual(
    calls.find((call) => call[0] === "order").slice(1),
    ["id", { ascending: true }]
  );
  assert.equal(result.summary.scopedProducts, 1001);
});

test("a later candidate page failure aborts instead of publishing partial Carbohydrates results", async () => {
  const query = {};
  for (const method of ["select", "eq", "is", "or", "order"]) {
    query[method] = () => query;
  }
  query.range = (from) => Promise.resolve(
    from === 0
      ? {
          data: Array.from({ length: 1000 }, (_, index) =>
            rawProduct({ id: index + 1, offers: [] })
          ),
          error: null,
        }
      : { data: null, error: { message: "page two failed" } }
  );

  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await loadComparison({ from: () => query }).getCarbohydratesComparison();
    assert.equal(result.error, true);
    assert.equal(result.rows.length, 0);
    assert.equal(result.summary.scopedProducts, 0);
  } finally {
    console.error = originalError;
  }
});

test("planned Carbohydrates metadata is canonical and noindex for base and parameter states", async () => {
  const page = loadPage().page;
  const base = await page.generateMetadata();
  assert.equal(base.alternates.canonical, "/carbohydrates");
  assert.deepEqual(base.robots, { index: false, follow: true });
  const parameterized = await page.generateMetadata({
    searchParams: Promise.resolve({ sort: "delivered_total" }),
  });
  assert.deepEqual(parameterized.robots, { index: false, follow: true });
});

test("Carbohydrates structured data and server HTML stay factual and expose the raw Search escape", () => {
  const page = loadPage().page;
  const result = fixtureResult();
  const data = page.buildCarbohydratesStructuredData(result.rows);
  assert.deepEqual(
    data["@graph"].map((item) => item["@type"]),
    ["CollectionPage", "ItemList", "BreadcrumbList"]
  );
  assert.equal(JSON.stringify(data).includes('"@type":"Product"'), false);

  const html = renderToStaticMarkup(
    React.createElement(page.CarbohydratesPageContent, { result })
  );
  assert.match(html, /Compare Carbohydrate Supplement Prices UK/);
  assert.match(html, /Cream of Rice/);
  assert.match(html, /not necessarily nutritionally or functionally equivalent/i);
  assert.match(html, /coverage-first price comparison/i);
  assert.match(html, /Includes known delivery/);
  assert.match(html, /Delivered price \/ kg/);
  assert.match(html, /search_mode=raw/);
  assert.doesNotMatch(html, /best carbohydrate|healthiest carb|best for muscle growth|best performance carb/i);
});

test("default route loads once and generic controls preserve strong-only rows", async () => {
  const loaded = loadPage();
  const element = await loaded.page.default({
    searchParams: Promise.resolve({ sort: "delivered_total" }),
  });
  assert.equal(loaded.calls(), 1);
  assert.equal(element.type, loaded.page.CarbohydratesPageContent);
  assert.equal(element.props.controlView.controls.sort, "delivered_total");
  assert.equal(element.props.result.rows.length, 2);
});

test("Carbohydrates uses one shared semantic owner and creates no subtype routes", () => {
  const comparisonSource = fs.readFileSync(comparisonPath, "utf8");
  const pageSource = fs.readFileSync(pagePath, "utf8");
  assert.match(comparisonSource, /getCategoryCoverageDefinition\("carbohydrates"\)/);
  assert.match(comparisonSource, /evaluateCategoryCoverage\(carbohydratesCoverageDefinition, product\)/);
  assert.doesNotMatch(comparisonSource, /INCLUDE_STRONG.*(?:Cream of Rice|Vitargo)|product\.id|product\.slug/i);
  assert.match(pageSource, /"carbohydrates-comparison-v1"/);
  assert.match(pageSource, /sourcePage="carbohydrates_comparison"/);
  for (const route of ["cream-of-rice", "carb-powder", "sports-drinks", "dextrose", "vitargo"]) {
    assert.equal(fs.existsSync(path.join(root, "app", route, "page.tsx")), false, route);
  }
});

test("Carbohydrates is one planned lifecycle/sitemap candidate and homepage routing remains generic", () => {
  const lifecycle = compileModule(path.join(root, "app/lib/indexabilityLifecycle.ts"));
  const categoryRoutes = compileModule(path.join(root, "app/lib/categoryRoutes.ts"), {
    mocks: {
      "./proteinSubtypes": {
        hasReviewedVeganProteinIdentity: () => false,
        hasReviewedWheyIsolateIdentity: () => false,
      },
      "./categoryCoverage": categoryCoverage,
    },
  });
  const sitemap = fs.readFileSync(path.join(root, "app/sitemap.ts"), "utf8");
  const home = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
  assert.equal(lifecycle.getLifecycleStatus("/carbohydrates"), "planned");
  assert.deepEqual(lifecycle.getLifecycleRobots("/carbohydrates"), {
    index: false,
    follow: true,
  });
  assert.equal(lifecycle.isLifecycleSitemapEligible("/carbohydrates"), false);
  assert.equal((sitemap.match(/`\$\{siteUrl\}\/carbohydrates`/g) || []).length, 1);
  assert.equal(categoryRoutes.categoryBrowseHref("Carbohydrates"), "/carbohydrates");
  assert.match(home, /categoryBrowseHref\(category\)/);
  assert.doesNotMatch(home, /Carbohydrates", href: "\/carbohydrates"/);
});

test("homepage deduplicates the production Carbohydrates label and sends its single category entry to the semantic route", async () => {
  const categoryRoutes = compileModule(path.join(root, "app/lib/categoryRoutes.ts"), {
    mocks: {
      "./proteinSubtypes": {
        hasReviewedVeganProteinIdentity: () => false,
        hasReviewedWheyIsolateIdentity: () => false,
      },
      "./categoryCoverage": categoryCoverage,
    },
  });
  const HomeCategories = () => null;
  const Noop = () => null;
  const home = compileModule(path.join(root, "app/page.tsx"), {
    mocks: {
      "next/link": { __esModule: true, default: Link },
      "./components/ComparisonTransparencyLinks": { __esModule: true, default: Noop },
      "./components/HomeCategories": { __esModule: true, default: HomeCategories },
      "./home-comparisons": { HomeFeaturedComparison: () => null, HomeCurrentComparisons: () => null },
      "./home.css": {},
      "./components/HomeHeader": { __esModule: true, default: Noop },
      "./components/SearchInput": { __esModule: true, default: Noop },
      "./components/StatusBadge": { __esModule: true, default: Noop },
      "./components/SupplementScoutIcon": { __esModule: true, default: Noop },
      "./lib/categoryRoutes": categoryRoutes,
      "./lib/categoryCoverage": categoryCoverage,
      "./lib/homepageData": {
        getHomepageData: async () => ({
          categories: ["Carbohydrates", "Hydration", "Carbohydrates"],
          latestOfferCheckAt: null,
          comparisons: { state: "empty", rows: [] },
          productCount: 1357,
          retailerCount: 10,
        }),
      },
    },
  });
  const tree = await home.default();
  const stack = [tree];
  let categoryNode = null;
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (node.type === HomeCategories) categoryNode = node;
    const children = node.props?.children;
    if (Array.isArray(children)) stack.push(...children);
    else if (children) stack.push(children);
  }
  assert.ok(categoryNode);
  const carbohydrateItems = categoryNode.props.items.filter(
    (item) => item.label === "Carbohydrates"
  );
  assert.deepEqual(carbohydrateItems, [
    { label: "Carbohydrates", href: "/carbohydrates" },
  ]);
});
