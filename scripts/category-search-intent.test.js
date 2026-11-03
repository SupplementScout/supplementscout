const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function compileModule(filename, mocks = {}) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.hasOwn(mocks, request)) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    instance._compile(output, filename);
    return instance.exports;
  } finally {
    Module._load = originalLoad;
  }
}

const root = process.cwd();
const resolverPath = path.join(root, "app/lib/categorySearchIntent.ts");
const categoryCoverage = compileModule(
  path.join(root, "app/lib/categoryCoverage.ts")
);
const lifecycle = compileModule(
  path.join(root, "app/lib/indexabilityLifecycle.ts")
);
const resolver = compileModule(resolverPath, {
  "./categoryCoverage": categoryCoverage,
  "./indexabilityLifecycle": lifecycle,
});

function componentMock() {
  return { __esModule: true, default: () => null };
}

function loadSearchPage() {
  const calls = {
    intentPlan: 0,
    searchProducts: 0,
    analytics: 0,
    redirect: 0,
  };
  const intentState = {
    servingsMin: null,
    proteinMinG: null,
    caffeineMaxMg: null,
    format: null,
    ingredients: [],
  };
  const intentPlan = {
    textQuery: "Collagen",
    sort: "relevance",
    filters: { caffeineFree: false },
    appliedConstraints: [],
    unsupportedClauses: [],
    valueMetric: null,
  };
  const emptySearchResult = {
    results: [],
    facets: { categories: [], brands: [], retailers: [], caffeine: [] },
    totalCount: 0,
    unfilteredCount: 0,
    page: 1,
    totalPages: 1,
    startResult: 0,
    endResult: 0,
    resultLimit: 24,
    metadata: {
      originalQuery: "Collagen",
      appliedQuery: "Collagen",
      correctedQuery: null,
      queryVariants: ["Collagen"],
      matchStatus: "exact",
      searchMode: "standard_ilike",
    },
    valueMetricAvailable: false,
    error: null,
  };
  const page = compileModule(path.join(root, "app/search/page.tsx"), {
    "next/navigation": {
      redirect: (href) => {
        calls.redirect += 1;
        throw new Error(`REDIRECT:${href}`);
      },
    },
    "../components/ActiveSearchFilters": componentMock(),
    "../components/ProductResultCard": componentMock(),
    "../components/SupplementScoutIcon": componentMock(),
    "../components/SearchInput": componentMock(),
    "../components/SearchPagination": componentMock(),
    "../components/SearchAnalyticsEvents": componentMock(),
    "../components/SearchResultsLayout": componentMock(),
    "../components/SearchResultSelectionAnalytics": componentMock(),
    "../lib/categorySearchIntent": resolver,
    "../lib/products": {
      normalizeSearchQuery: (value) =>
        (Array.isArray(value) ? value[0] : value || "").trim(),
      normalizeSearchFilters: () => ({
        category: "",
        brand: "",
        retailer: "",
        caffeine: "",
      }),
      normalizeSearchPage: () => 1,
      normalizeSearchSort: () => "relevance",
      searchProducts: async () => {
        calls.searchProducts += 1;
        return emptySearchResult;
      },
    },
    "../lib/searchIntent": {
      buildSearchIntentPlan: () => {
        calls.intentPlan += 1;
        return intentPlan;
      },
      canonicalIntentQuery: () => "Collagen",
      intentUrlStateFromPlan: () => intentState,
      normalizeSearchIntentUrlState: () => intentState,
    },
    "../lib/searchAnalytics": {
      logSearchResultsEvent: async () => {
        calls.analytics += 1;
      },
    },
    "../lib/searchUrl": { searchUrl: () => "/search?q=Collagen" },
  });

  return { calls, page };
}

test("clean exact public Category Coverage labels resolve case-insensitively", () => {
  const cases = [
    ["Testosterone Boosters", "/testosterone-boosters"],
    ["testosterone boosters", "/testosterone-boosters"],
    ["TESTOSTERONE BOOSTERS", "/testosterone-boosters"],
    [" \t Testosterone   Boosters \n", "/testosterone-boosters"],
    ["Fat Burners", "/fat-burners"],
    ["fat burners", "/fat-burners"],
    ["Collagen", "/collagen"],
    ["COLLAGEN", "/collagen"],
    ["  Collagen  ", "/collagen"],
  ];

  for (const [query, href] of cases) {
    assert.equal(resolver.resolveExactCategorySearchIntent({ q: query }).href, href);
  }
});

test("nonexact, fuzzy and comparison-category queries remain normal Search", () => {
  for (const query of [
    "Testosterone",
    "Testosterone Booster",
    "Testo Pro",
    "Fat Burner",
    "fat burning",
    "Collagen Peptides",
    "Marine Collagen",
    "Best Collagen",
    "Collagen under £30",
    "best fat burners",
    "test boosters",
    "random category",
    "Creatine",
    "Whey Protein",
  ]) {
    assert.equal(resolver.resolveExactCategorySearchIntent({ q: query }), null, query);
  }
});

test("legacy coverage definitions outside the public lifecycle do not redirect", () => {
  for (const query of [
    "Glucosamine",
    "Magnesium",
    "Omega 3",
    "Vitamin D",
    "Vitamins",
  ]) {
    assert.ok(categoryCoverage.categoryCoverageDefinitionForLabel(query), query);
    assert.equal(resolver.resolveExactCategorySearchIntent({ q: query }), null, query);
  }
});

test("every supplied Search state key makes exact queries fail closed", () => {
  const states = {
    sort: "price_asc",
    category: "Collagen",
    brand: "Example",
    retailer: "Example",
    caffeine: "free",
    servings_min: "20",
    protein_min_g: "15",
    caffeine_max_mg: "100",
    format: "powder",
    ingredient: "vitamin c",
    page: "2",
  };

  for (const [key, value] of Object.entries(states)) {
    assert.equal(
      resolver.resolveExactCategorySearchIntent({ q: "Collagen", [key]: value }),
      null,
      key
    );
  }
});

test("repeated or malformed query values fail closed to normal Search", () => {
  assert.equal(
    resolver.resolveExactCategorySearchIntent({ q: ["Collagen", "Creatine"] }),
    null
  );
  assert.equal(
    resolver.resolveExactCategorySearchIntent({ q: ["Collagen", "Collagen"] }),
    null
  );
  assert.equal(resolver.resolveExactCategorySearchIntent({ q: undefined }), null);
  assert.equal(resolver.resolveExactCategorySearchIntent({ q: "" }), null);
});

test("one shared raw Search escape bypasses category navigation without filters", () => {
  assert.equal(
    resolver.categoryCoverageRawSearchHref("Fat Burners"),
    "/search?q=Fat+Burners&search_mode=raw"
  );
  assert.equal(
    resolver.resolveExactCategorySearchIntent({
      q: "Fat Burners",
      search_mode: "raw",
    }),
    null
  );
});

test("SearchPage redirects before planning, data loading and Search analytics", async () => {
  const { calls, page } = loadSearchPage();

  await assert.rejects(
    page.default({ searchParams: Promise.resolve({ q: "Collagen" }) }),
    /REDIRECT:\/collagen/
  );
  assert.deepEqual(calls, {
    intentPlan: 0,
    searchProducts: 0,
    analytics: 0,
    redirect: 1,
  });
});

test("raw mode renders ordinary Search and retains Search analytics", async () => {
  const { calls, page } = loadSearchPage();

  const result = await page.default({
    searchParams: Promise.resolve({ q: "Collagen", search_mode: "raw" }),
  });
  assert.ok(result);
  assert.deepEqual(calls, {
    intentPlan: 1,
    searchProducts: 1,
    analytics: 1,
    redirect: 0,
  });

  const ordinaryMetadata = await page.generateMetadata({
    searchParams: Promise.resolve({ q: "Collagen" }),
  });
  const rawMetadata = await page.generateMetadata({
    searchParams: Promise.resolve({ q: "Collagen", search_mode: "raw" }),
  });
  assert.deepEqual(rawMetadata, ordinaryMetadata);
});

test("resolver architecture has one registry, generic form and generic raw link", () => {
  const resolverSource = fs.readFileSync(resolverPath, "utf8");
  const pageSource = fs.readFileSync(
    path.join(root, "app/search/page.tsx"),
    "utf8"
  );
  const inputSource = fs.readFileSync(
    path.join(root, "app/components/SearchInput.tsx"),
    "utf8"
  );
  const landingSource = fs.readFileSync(
    path.join(root, "app/components/CategoryCoverageLandingPage.tsx"),
    "utf8"
  );
  const suggestionSource = fs.readFileSync(
    path.join(root, "app/api/search-suggestions/route.ts"),
    "utf8"
  );

  assert.match(resolverSource, /categoryCoverageDefinitionForLabel\(query\)/);
  assert.match(resolverSource, /PUBLIC_INDEXABILITY_LIFECYCLE/);
  assert.doesNotMatch(
    resolverSource,
    /testosterone-boosters|fat-burners|\/collagen/
  );
  assert.match(pageSource, /resolveExactCategorySearchIntent\(params\)/);
  assert.ok(
    pageSource.indexOf("resolveExactCategorySearchIntent(params)") <
      pageSource.indexOf("buildSearchIntentPlan(query")
  );
  assert.match(inputSource, /action="\/search"/);
  assert.doesNotMatch(inputSource, /categorySearchIntent|search_mode/);
  assert.match(landingSource, /categoryCoverageRawSearchHref\(presentation\.searchQuery\)/);
  assert.doesNotMatch(landingSource, /search_mode|testosterone|fat-burners|collagen/i);
  assert.match(suggestionSource, /getSearchSuggestions\(query, limit\)/);
  assert.doesNotMatch(suggestionSource, /categorySearchIntent|search_mode/);
});
