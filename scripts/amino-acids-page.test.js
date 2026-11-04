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

const pricing = compileModule(path.join(process.cwd(), "app", "lib", "pricing.ts"));
const offerFreshness = compileModule(path.join(process.cwd(), "app", "lib", "offerFreshness.ts"));
const freshness = compileModule(path.join(process.cwd(), "app", "lib", "creatineLaunch.ts"), {
  mocks: { "./offerFreshness": offerFreshness },
});
const categoryComparison = compileModule(
  path.join(process.cwd(), "app", "lib", "categoryComparison.ts"),
  { mocks: { "./creatineLaunch": freshness, "./offerFreshness": offerFreshness, "./pricing": pricing } }
);
const categoryCoverage = compileModule(
  path.join(process.cwd(), "app", "lib", "categoryCoverage.ts")
);
const categoryDecision = compileModule(path.join(process.cwd(), "app", "lib", "categoryDecision.ts"));
const comparisonPath = path.join(process.cwd(), "app", "lib", "aminoAcidsComparison.ts");
const pagePath = path.join(process.cwd(), "app", "amino-acids", "page.tsx");
const FIXTURE_NOW = new Date("2026-08-01T12:00:00.000Z");

function rawOffer(overrides = {}) {
  return {
    id: 11,
    retailer_product_id: 101,
    price: 24,
    shipping_cost: 4.99,
    in_stock: true,
    last_checked_at: "2026-08-01T11:00:00.000Z",
    url: "https://retailer.example/amino",
    retailer: { id: 1, name: "Retailer One", slug: "retailer-one" },
    ...overrides,
  };
}

function rawProduct(overrides = {}) {
  return {
    id: 1,
    slug: "example-eaa-300g",
    name: "Example EAA 300g",
    brand: "Example Nutrition",
    category: "Amino Acids",
    description: null,
    image: null,
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
    ...comparison.normalizeAminoAcidsComparison(
      [
        rawProduct(),
        rawProduct({
          id: 2,
          slug: "example-bcaa-400g",
          name: "Example BCAA 400g",
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
  return React.createElement("a", { href: typeof href === "string" ? href : href.pathname, ...props }, children);
}

function loadPage(result = fixtureResult()) {
  const comparison = loadComparison();
  return compileModule(pagePath, {
    mocks: {
      "next/link": { __esModule: true, default: Link },
      "../components/ComparisonProductVisuals": require("./test-helpers/comparison-product-visuals"),
      "../components/CategoryViewAnalytics": { __esModule: true, default: () => null },
      "../components/CategoryDecisionPanel": { __esModule: true, default: ({ answers }) => answers.length ? React.createElement("section", null, `Quick decision ${answers.length}`) : null },
      "../components/ComparisonTransparencyLinks": { __esModule: true, default: () => null },
      "../lib/pricing": pricing,
      "../lib/categoryDecision": categoryDecision,
      "../lib/categorySearchIntent": {
        categoryCoverageRawSearchHref: (query) =>
          `/search?q=${encodeURIComponent(query)}&search_mode=raw`,
      },
      "../lib/aminoAcidsComparison": {
        getAminoAcidsComparison: async () => result,
        evaluateAminoAcidsIndexability: comparison.evaluateAminoAcidsIndexability,
        AMINO_ACIDS_INDEX_GATE: comparison.AMINO_ACIDS_INDEX_GATE,
      },
    },
  });
}

test("shared semantic scope is strong-only and independent of canonical category", () => {
  const { evaluateAminoAcidsCoverage, isAminoAcidsProduct } = loadComparison();
  for (const name of ["Example EAA 300g", "Example EAAs 300g", "Example BCAA 300g", "Example AminoX 300g", "L-Glutamine 500g", "Beta Alanine 250g", "L-Carnitine 500ml", "Creatine + HMB"]) {
    const product = rawProduct({ name, category: "Health Supplements" });
    assert.equal(evaluateAminoAcidsCoverage(product).classification, "INCLUDE_STRONG", name);
    assert.equal(isAminoAcidsProduct(product), true, name);
  }

  const opaqueSupported = rawProduct({
    name: "Opaque Formula",
    description: "An essential amino acids and BCAA formula.",
  });
  assert.equal(isAminoAcidsProduct(opaqueSupported), true);

  for (const product of [
    rawProduct({ name: "The Grind 480g", description: null }),
    rawProduct({ name: "No Code mTOR 394g" }),
    rawProduct({ name: "TIME 4 Intra-Workout 490g" }),
    rawProduct({ name: "Hydro Amino 2-Pack" }),
    rawProduct({ name: "NAC 300mg" }),
    rawProduct({ name: "5-HTP 200mg" }),
    rawProduct({ name: "Glutathione 500mg" }),
    rawProduct({ name: "Caffeine + Taurine", category: "Energy Supplements" }),
  ]) {
    assert.equal(isAminoAcidsProduct(product), false, product.name);
  }

  assert.equal(isAminoAcidsProduct(rawProduct({ is_active: false })), false);
  assert.equal(isAminoAcidsProduct(rawProduct({ merged_at: "2026-11-04T00:00:00Z" })), false);
});

test("normalization keeps fresh mapped offers and ranks known delivery", () => {
  const { normalizeAminoAcidsComparison } = loadComparison();
  const result = normalizeAminoAcidsComparison([
    rawProduct({ offers: [
      rawOffer({ id: 1, price: 25, shipping_cost: null }),
      rawOffer({ id: 2, price: 26, shipping_cost: 0 }),
      rawOffer({ id: 3, price: 1, last_checked_at: "2026-07-07T11:59:59Z" }),
      rawOffer({ id: 4, retailer_product_id: null }),
    ] }),
  ], { now: FIXTURE_NOW });
  assert.equal(result.summary.freshOffers, 2);
  assert.equal(result.rows[0].bestOffer.id, "2");
  assert.equal(result.summary.staleOrUnusableOffersExcluded, 2);
});

test("comparison normalization exposes strong products only", () => {
  const { normalizeAminoAcidsComparison } = loadComparison();
  const result = normalizeAminoAcidsComparison([
    rawProduct({ id: 1, name: "Example EAA 300g", category: "Health Supplements" }),
    rawProduct({ id: 2, name: "Opaque Catalyst", category: "Amino Acids" }),
    rawProduct({ id: 3, name: "Soma NAC 300mg", category: "Amino Acids" }),
  ], { now: FIXTURE_NOW });

  assert.equal(result.summary.scopedProducts, 1);
  assert.deepEqual(result.rows.map((row) => row.id), ["1"]);
});

test("indexability fails closed and passes only at the shared gate", () => {
  const comparison = loadComparison();
  const summary = fixtureResult().summary;
  assert.equal(comparison.evaluateAminoAcidsIndexability(summary, true).indexable, false);
  assert.deepEqual(comparison.evaluateAminoAcidsIndexability({
    ...summary,
    freshOffers: 20,
    productsWithMultipleFreshRetailers: 3,
    freshRetailersAcrossComparisons: 2,
  }, true), { indexable: true, blockers: [] });
});

test("production query crosses categories, selects descriptions and paginates to exhaustion", async () => {
  const calls = [];
  const query = {};
  for (const method of ["select", "eq", "is", "or", "order"]) {
    query[method] = (...args) => { calls.push([method, ...args]); return query; };
  }
  query.range = (...args) => {
    calls.push(["range", ...args]);
    const page = args[0] === 0
      ? Array.from({ length: 1000 }, (_, index) => rawProduct({ id: index + 1, offers: [] }))
      : [rawProduct({ id: 1001, name: "Cross-category Taurine", category: "Health Supplements", offers: [] })];
    return Promise.resolve({ data: page, error: null });
  };
  const result = await loadComparison({ from: () => query }).getAminoAcidsComparison();
  assert.equal(result.error, false);
  assert.ok(calls.some((call) => call[0] === "select" && /description/.test(call[1])));
  assert.ok(calls.some((call) => call[0] === "or" && /category\.eq\.Amino Acids/.test(call[1]) && /carnitine/.test(call[1]) && /intra-workout/.test(call[1])));
  assert.equal(calls.some((call) => call[0] === "eq" && call[1] === "category"), false);
  assert.deepEqual(calls.filter((call) => call[0] === "range").map((call) => call.slice(1)), [[0, 999], [1000, 1999]]);
  assert.equal(result.summary.scopedProducts, 1001);
});

test("a later candidate page failure aborts instead of publishing a partial result", async () => {
  const query = {};
  for (const method of ["select", "eq", "is", "or", "order"]) {
    query[method] = () => query;
  }
  query.range = (from) => Promise.resolve(
    from === 0
      ? { data: Array.from({ length: 1000 }, (_, index) => rawProduct({ id: index + 1, offers: [] })), error: null }
      : { data: null, error: { message: "page two failed" } }
  );

  const result = await loadComparison({ from: () => query }).getAminoAcidsComparison();
  assert.equal(result.error, true);
  assert.equal(result.rows.length, 0);
  assert.equal(result.summary.scopedProducts, 0);
});

test("live-verified metadata is stable across coverage and uses one canonical", async () => {
  const ready = fixtureResult();
  ready.summary = { ...ready.summary, freshOffers: 20, productsWithMultipleFreshRetailers: 3, freshRetailersAcrossComparisons: 2 };
  const metadata = await loadPage(ready).generateMetadata();
  assert.equal(metadata.alternates.canonical, "/amino-acids");
  assert.deepEqual(metadata.robots, { index: true, follow: true });
  const failed = await loadPage({ ...ready, error: true }).generateMetadata();
  assert.deepEqual(failed.robots, { index: true, follow: true });
});

test("structured data is a collection without invented Product entities", () => {
  const page = loadPage();
  const data = page.buildAminoAcidsStructuredData(fixtureResult().rows);
  assert.deepEqual(data["@graph"].map((item) => item["@type"]), ["CollectionPage", "ItemList", "BreadcrumbList"]);
  assert.equal(JSON.stringify(data).includes('"@type":"Product"'), false);
});

test("server HTML explains taxonomy, delivery and ranking limits", () => {
  const page = loadPage();
  const html = renderToStaticMarkup(React.createElement(page.AminoAcidsPageContent, { result: fixtureResult() }));
  assert.match(html, /Compare Amino Acid, BCAA &amp; EAA Prices UK/);
  assert.match(html, /Reviewed inclusion boundary/);
  assert.match(html, /product evidence clearly identifies BCAA or EAA/i);
  assert.match(html, /Ambiguous blends, bundles/);
  assert.doesNotMatch(html, /must be active in the reviewed Amino Acids category/i);
  assert.match(html, /Includes known delivery/);
  assert.match(html, /not a ranking of formulation/i);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /search_mode=raw/);
});

test("route has one sitemap URL, homepage entry and priority links", () => {
  const sitemap = fs.readFileSync(path.join(process.cwd(), "app", "sitemap.ts"), "utf8");
  const home = fs.readFileSync(path.join(process.cwd(), "app", "page.tsx"), "utf8");
  assert.equal((sitemap.match(/`\$\{siteUrl\}\/amino-acids`/g) || []).length, 1);
  assert.match(home, /Amino Acids", href: "\/amino-acids"/);
  for (const route of ["whey-protein", "pre-workout", "hydration", "creatine"]) {
    const source = fs.readFileSync(path.join(process.cwd(), "app", route, "page.tsx"), "utf8");
    assert.match(source, /href="\/amino-acids"/, route);
  }
  for (const route of ["bcaa", "eaa", "amino-acid"]) {
    assert.equal(fs.existsSync(path.join(process.cwd(), "app", route, "page.tsx")), false, route);
  }
});

test("route bumps only its semantic cache version and delegates membership to Category Coverage", () => {
  const comparisonSource = fs.readFileSync(comparisonPath, "utf8");
  const pageSource = fs.readFileSync(pagePath, "utf8");

  assert.match(comparisonSource, /getCategoryCoverageDefinition\("amino-acids"\)/);
  assert.match(comparisonSource, /evaluateCategoryCoverage\(aminoAcidsCoverageDefinition, product\)/);
  assert.doesNotMatch(comparisonSource, /EXPLICIT_AMINO_PRODUCT|NON_COMPARABLE_AMINO_PRODUCT/);
  assert.match(pageSource, /"amino-acids-comparison-v2"/);
  assert.doesNotMatch(pageSource, /"amino-acids-comparison-v1"/);
});

test("page uses consent-aware category analytics", () => {
  const source = fs.readFileSync(pagePath, "utf8");
  assert.match(source, /category="Amino Acids"/);
  assert.match(source, /sourcePage="amino_acids_comparison"/);
});
