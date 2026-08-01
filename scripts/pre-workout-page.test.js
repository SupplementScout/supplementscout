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
const freshnessPath = path.join(process.cwd(), "app", "lib", "creatineLaunch.ts");
const categoryComparisonPath = path.join(
  process.cwd(),
  "app",
  "lib",
  "categoryComparison.ts"
);
const preWorkoutComparisonPath = path.join(
  process.cwd(),
  "app",
  "lib",
  "preWorkoutComparison.ts"
);
const pagePath = path.join(
  process.cwd(),
  "app",
  "pre-workout",
  "page.tsx"
);
const pricing = compileModule(pricingPath);
const freshness = compileModule(freshnessPath);
const categoryComparison = compileModule(categoryComparisonPath, {
  mocks: {
    "./creatineLaunch": freshness,
    "./pricing": pricing,
  },
});
const FIXTURE_NOW = new Date("2026-08-01T12:00:00.000Z");

function rawOffer(overrides = {}) {
  return {
    id: 11,
    retailer_product_id: 101,
    price: 24,
    shipping_cost: 4.99,
    in_stock: true,
    last_checked_at: "2026-08-01T11:00:00.000Z",
    url: "https://retailer.example/products/pre-workout",
    retailer: { id: 1, name: "Retailer One", slug: "retailer-one" },
    ...overrides,
  };
}

function rawProduct(overrides = {}) {
  return {
    id: 1,
    slug: "example-pre-workout-300g",
    name: "Example Pre Workout 300g",
    brand: "Example Nutrition",
    category: "Pre Workout",
    image: "https://example.test/pre-workout.png",
    product_format: "powder",
    net_weight_g: 300,
    net_volume_ml: null,
    unit_count: null,
    unit_type: null,
    serving_count_verified: 30,
    serving_size_g: 10,
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

function loadPreWorkoutComparison(mockSupabase = {}) {
  return compileModule(preWorkoutComparisonPath, {
    mocks: {
      "./categoryComparison": categoryComparison,
      "./supabase": { supabase: mockSupabase },
    },
  });
}

function fixtureResult() {
  const preWorkout = loadPreWorkoutComparison();
  return {
    ...preWorkout.normalizePreWorkoutComparison(
      [
        rawProduct(),
        rawProduct({
          id: 2,
          slug: "many-retailers-pre-workout-400g",
          name: "Many Retailers Pre Workout 400g",
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
  const preWorkout = loadPreWorkoutComparison();
  const page = compileModule(pagePath, {
    mocks: {
      "next/link": { __esModule: true, default: Link },
      "../components/CategoryViewAnalytics": {
        __esModule: true,
        default: () => null,
      },
      "../lib/pricing": pricing,
      "../lib/preWorkoutComparison": {
        getPreWorkoutComparison: async () => {
          calls += 1;
          return result;
        },
        evaluatePreWorkoutIndexability:
          preWorkout.evaluatePreWorkoutIndexability,
        PRE_WORKOUT_INDEX_GATE: preWorkout.PRE_WORKOUT_INDEX_GATE,
      },
    },
  });
  return { page, calls: () => calls };
}

test("Pre Workout scope uses the reviewed category and excludes bundles", () => {
  const { isPreWorkoutProduct } = loadPreWorkoutComparison();

  assert.equal(isPreWorkoutProduct(rawProduct()), true);
  assert.equal(
    isPreWorkoutProduct(rawProduct({ name: "PEScience Prolific 280g" })),
    true
  );
  assert.equal(
    isPreWorkoutProduct(
      rawProduct({ name: "PEScience Pre-Workout + Pump Bundle" })
    ),
    false
  );
  assert.equal(
    isPreWorkoutProduct(rawProduct({ category: "Health Supplements" })),
    false
  );
  assert.equal(isPreWorkoutProduct(rawProduct({ is_active: false })), false);
  assert.equal(
    isPreWorkoutProduct(rawProduct({ merged_into_product_id: 99 })),
    false
  );
});

test("normalization keeps fresh mapped offers and ranks known delivery", () => {
  const { normalizePreWorkoutComparison } = loadPreWorkoutComparison();
  const result = normalizePreWorkoutComparison(
    [
      rawProduct({
        offers: [
          rawOffer({ id: 1, price: 25, shipping_cost: null }),
          rawOffer({ id: 2, price: 26, shipping_cost: 0 }),
          rawOffer({
            id: 3,
            price: 1,
            last_checked_at: "2026-07-30T00:00:00.000Z",
          }),
          rawOffer({ id: 4, retailer_product_id: null }),
        ],
      }),
    ],
    { now: FIXTURE_NOW }
  );

  assert.equal(result.rows.length, 1);
  assert.equal(result.summary.freshOffers, 2);
  assert.equal(result.rows[0].bestOffer.id, "2");
  assert.equal(result.rows[0].bestOffer.deliveredPrice.totalPrice, 26);
  assert.equal(result.summary.staleOrUnusableOffersExcluded, 2);
});

test("verified Pre Workout value metrics do not invent protein values", () => {
  const { normalizePreWorkoutComparison } = loadPreWorkoutComparison();
  const result = normalizePreWorkoutComparison([rawProduct()], {
    now: FIXTURE_NOW,
  });
  const row = result.rows[0];

  assert.ok(Math.abs(row.pricePerKg - 28.99 / 0.3) < 1e-10);
  assert.ok(Math.abs(row.pricePerServing - 28.99 / 30) < 1e-10);
  assert.equal(row.costPer25gProtein, null);
});

test("the indexability gate fails closed when comparison coverage falls", () => {
  const preWorkout = loadPreWorkoutComparison();
  const result = fixtureResult();
  assert.equal(
    preWorkout.evaluatePreWorkoutIndexability(result.summary, true).indexable,
    false
  );

  const ready = preWorkout.evaluatePreWorkoutIndexability(
    {
      ...result.summary,
      freshOffers: 100,
      productsWithMultipleFreshRetailers: 13,
      freshRetailersAcrossComparisons: 5,
    },
    true
  );
  assert.deepEqual(ready, { indexable: true, blockers: [] });
});

test("the production query is bounded and uses the exact category", async () => {
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

  const preWorkout = loadPreWorkoutComparison({ from: () => query });
  const result = await preWorkout.getPreWorkoutComparison();
  assert.equal(result.error, false);
  assert.ok(
    calls.some(
      (call) =>
        call[0] === "eq" &&
        call[1] === "category" &&
        call[2] === "Pre Workout"
    )
  );
  assert.ok(
    calls.some(
      (call) => call[0] === "range" && call[1] === 0 && call[2] === 999
    )
  );
});

test("metadata is canonical and indexability follows current coverage", async () => {
  const readyResult = fixtureResult();
  readyResult.summary = {
    ...readyResult.summary,
    freshOffers: 100,
    productsWithMultipleFreshRetailers: 13,
    freshRetailersAcrossComparisons: 5,
  };
  const readyMetadata = await loadPage(readyResult).page.generateMetadata();
  assert.equal(readyMetadata.alternates.canonical, "/pre-workout");
  assert.deepEqual(readyMetadata.robots, { index: true, follow: true });

  const failedMetadata = await loadPage({
    ...readyResult,
    error: true,
  }).page.generateMetadata();
  assert.deepEqual(failedMetadata.robots, { index: false, follow: true });
});

test("structured data describes a collection without fake Product entities", () => {
  const { page } = loadPage();
  const data = page.buildPreWorkoutStructuredData(fixtureResult().rows);
  const types = data["@graph"].map((item) => item["@type"]);
  const itemList = data["@graph"].find(
    (item) => item["@type"] === "ItemList"
  );

  assert.deepEqual(types, ["CollectionPage", "ItemList", "BreadcrumbList"]);
  assert.equal(itemList.numberOfItems, fixtureResult().rows.length);
  assert.equal(JSON.stringify(data).includes('"@type":"Product"'), false);
});

test("server HTML explains coverage, delivery and formulation limits", () => {
  const { page } = loadPage();
  const html = renderToStaticMarkup(
    React.createElement(page.PreWorkoutPageContent, {
      result: fixtureResult(),
    })
  );

  assert.match(html, /Compare Pre Workout Prices UK/);
  assert.match(html, /Includes known delivery/);
  assert.match(html, /coverage-first comparison/i);
  assert.match(html, /does not infer stimulant status or ingredient suitability/i);
  assert.match(html, /not a claim that the first product has a better formulation or effect/i);
  assert.match(html, /application\/ld\+json/);
  assert.doesNotMatch(html, /Pre-Workout \+ Pump Bundle/);
});

test("Pre Workout has one sitemap URL and prominent internal links", () => {
  const sitemap = fs.readFileSync(
    path.join(process.cwd(), "app", "sitemap.ts"),
    "utf8"
  );
  const home = fs.readFileSync(
    path.join(process.cwd(), "app", "page.tsx"),
    "utf8"
  );
  const whey = fs.readFileSync(
    path.join(process.cwd(), "app", "whey-protein", "page.tsx"),
    "utf8"
  );
  const creatine = fs.readFileSync(
    path.join(process.cwd(), "app", "creatine", "page.tsx"),
    "utf8"
  );
  const hydration = fs.readFileSync(
    path.join(process.cwd(), "app", "hydration", "page.tsx"),
    "utf8"
  );

  assert.equal(
    (sitemap.match(/`\$\{siteUrl\}\/pre-workout`/g) || []).length,
    1
  );
  assert.match(home, /Pre Workout", href: "\/pre-workout"/);
  assert.match(whey, /href="\/pre-workout"/);
  assert.match(creatine, /href="\/pre-workout"/);
  assert.match(hydration, /href="\/pre-workout"/);
});

test("the page uses the consent-aware category analytics component", () => {
  const source = fs.readFileSync(pagePath, "utf8");
  assert.match(source, /category="Pre Workout"/);
  assert.match(source, /sourcePage="pre_workout_comparison"/);
});

test("the default route loads comparison data once", async () => {
  const loaded = loadPage();
  const element = await loaded.page.default();
  assert.equal(loaded.calls(), 1);
  assert.equal(element.type, loaded.page.PreWorkoutPageContent);
});
