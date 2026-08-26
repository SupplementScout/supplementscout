const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

function compileModule(filename, mocks = {}) {
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
    if (parent === mod && Object.hasOwn(mocks, request)) return mocks[request];
    if (request.endsWith("/indexabilityLifecycle")) {
      return compileModule(path.join(process.cwd(), "app/lib/indexabilityLifecycle.ts"));
    }
    if (request.endsWith("/lifecycleDataCache")) {
      return { createLifecycleDataLoader: (_path, _version, load) => load };
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
const creatineLaunch = compileModule(path.join(root, "app/lib/creatineLaunch.ts"), {
  "./offerFreshness": offerFreshness,
});
const nutritionMetrics = compileModule(path.join(root, "app/lib/nutritionMetrics.ts"));
const categoryComparison = compileModule(path.join(root, "app/lib/categoryComparison.ts"), {
  "./creatineLaunch": creatineLaunch,
  "./pricing": pricing,
});
const comparisonPath = path.join(root, "app/lib/twoProductComparison.ts");

function loadComparison(overrides = {}) {
  return compileModule(comparisonPath, {
    react: { cache: (fn) => fn },
    "./categoryComparison": categoryComparison,
    "./categoryComparisonVariants": {
      resolveCategoryComparisonVariants: async (products) => products,
    },
    "./nutritionMetrics": nutritionMetrics,
    "./pricing": pricing,
    "./supabase": { supabase: { from: () => ({}) } },
    ...overrides,
  });
}

const NOW = new Date("2026-08-26T12:00:00.000Z");

function offer(id, overrides = {}) {
  return {
    id,
    retailer_product_id: id + 1000,
    price: 20,
    shipping_cost: 3.99,
    in_stock: true,
    last_checked_at: "2026-08-26T11:00:00.000Z",
    url: `https://retailer.example/${id}`,
    retailer: { id: 1, name: "Retailer One", slug: "retailer-one" },
    product_variant: {
      id: id + 2000,
      display_name: "500g",
      flavour_label: null,
      pack_count: 1,
      size_value: 500,
      size_unit: "g",
      product_format: "powder",
      nutrition_override: null,
      is_active: true,
    },
    variant_resolution: "resolved",
    ...overrides,
  };
}

function product(id, offers = [offer(id * 10)], overrides = {}) {
  return {
    id,
    slug: `product-${id}`,
    name: `Product ${id}`,
    brand: "Example",
    category: "Protein",
    image: null,
    product_format: "powder",
    net_weight_g: 9999,
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
    offers,
    ...overrides,
  };
}

test("exact pack identity never assumes one pack or falls back to product fields", () => {
  const comparison = loadComparison();
  assert.equal(comparison.exactPackLabel(offer(1)), "500g");
  assert.equal(
    comparison.exactPackLabel(
      offer(2, { product_variant: { ...offer(2).product_variant, pack_count: 2 } })
    ),
    "2 x 500g"
  );
  for (const missing of ["pack_count", "size_value", "size_unit"]) {
    const variant = { ...offer(3).product_variant };
    variant[missing] = null;
    assert.equal(comparison.exactPackLabel(offer(3, { product_variant: variant })), null, missing);
  }
  assert.equal(comparison.exactPackLabel(offer(4, { variant_resolution: "unresolved" })), null);
  assert.equal(comparison.exactPackLabel(offer(5, { product_variant: { ...offer(5).product_variant, is_active: false } })), null);
});

test("normalization includes only fresh exact packs with known delivered totals", () => {
  const comparison = loadComparison();
  const result = comparison.normalizeTwoProductComparison([
    product(1),
    product(2, [offer(20, { shipping_cost: null })]),
    product(3, [offer(30, { variant_resolution: "unresolved" })]),
    product(4, [offer(40, { last_checked_at: "2026-08-25T11:59:59.000Z" })]),
  ], { now: NOW });
  assert.deepEqual(result.rows.map((row) => row.id), ["1"]);
  assert.equal(result.rows[0].exactPackLabel, "500g");
  assert.ok(Math.abs(result.rows[0].bestOffer.deliveredPrice.totalPrice - 23.99) < 0.001);
  assert.equal(result.rows[0].netWeightG, 500);
});

test("one product card never mixes offers from different canonical variants", () => {
  const comparison = loadComparison();
  const wideVariant = { ...offer(1).product_variant, id: 7001, size_value: 500 };
  const smallVariant = { ...offer(1).product_variant, id: 7002, size_value: 250 };
  const result = comparison.normalizeTwoProductComparison([
    product(1, [
      offer(10, { product_variant: wideVariant }),
      offer(11, {
        product_variant: wideVariant,
        retailer: { id: 2, name: "Retailer Two", slug: "retailer-two" },
      }),
      offer(12, { price: 5, product_variant: smallVariant }),
    ]),
  ], { now: NOW });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].exactPackLabel, "500g");
  assert.equal(result.rows[0].offerCount, 2);
  assert.equal(result.rows[0].retailerCount, 2);
  assert.deepEqual(result.rows[0].offers.map((candidate) => candidate.id), ["10", "11"]);
});

test("selection parsing is strict and all neutral states are explicit", () => {
  const comparison = loadComparison();
  const rows = comparison.normalizeTwoProductComparison([product(1), product(2)], { now: NOW }).rows;
  assert.equal(comparison.normalizeComparisonProductId("01"), null);
  assert.equal(comparison.normalizeComparisonProductId(["1"]), null);
  assert.equal(comparison.selectTwoProducts(rows, null, null).state, "empty");
  assert.equal(comparison.selectTwoProducts(rows, "1", null).state, "partial");
  assert.equal(comparison.selectTwoProducts(rows, "1", "1").state, "duplicate");
  assert.equal(comparison.selectTwoProducts(rows, "1", "999").state, "not_found");
  assert.equal(comparison.selectTwoProducts(rows, "1", "2").state, "ready");
});

test("complete catalogue query is paginated and exact variant resolution is strict", async () => {
  const calls = [];
  const rows = [product(1, [offer(10, { last_checked_at: new Date().toISOString() })])];
  const builder = new Proxy({}, {
    get: (_target, name) => (...args) => {
      calls.push([name, ...args]);
      return name === "range" ? { data: rows, error: null, count: 1 } : builder;
    },
  });
  let resolverOptions;
  const comparison = loadComparison({
    "./categoryComparisonVariants": {
      resolveCategoryComparisonVariants: async (products, options) => {
        resolverOptions = options;
        return products;
      },
    },
    "./supabase": {
      supabase: { from: (table) => { calls.push(["from", table]); return builder; } },
    },
  });
  const result = await comparison.getTwoProductComparison();
  assert.equal(result.error, false);
  assert.deepEqual(resolverOptions, { failOnError: true });
  assert.ok(calls.some((call) => call[0] === "range" && call[1] === 0 && call[2] === 199));
  assert.ok(calls.some((call) => call[0] === "select" && call[2]?.count === "exact"));
});

test("live-verified base is indexable while parameters stay noindex and no winner is claimed", async () => {
  const comparison = loadComparison();
  const normalized = comparison.normalizeTwoProductComparison([product(1), product(2)], { now: NOW });
  const result = { ...normalized, error: false };
  const Link = ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children);
  const page = compileModule(path.join(root, "app/compare/page.tsx"), {
    next: {},
    "next/link": { __esModule: true, default: Link },
    "../components/CategoryViewAnalytics": { __esModule: true, default: () => null },
    "../components/ComparisonProductVisuals": require("./test-helpers/comparison-product-visuals"),
    "../components/ComparisonTransparencyLinks": { __esModule: true, default: () => React.createElement("a", { href: "/how-we-compare" }, "Method") },
    "../lib/pricing": pricing,
    "../lib/twoProductComparison": { ...comparison, getTwoProductComparison: async () => result },
  });
  const baseMetadata = await page.generateMetadata();
  assert.deepEqual(baseMetadata.robots, { index: true, follow: true });
  assert.equal(baseMetadata.alternates.canonical, "/compare");
  const parameterMetadata = await page.generateMetadata({ searchParams: Promise.resolve({ left: "1", right: "2" }) });
  assert.deepEqual(parameterMetadata.robots, { index: false, follow: true });
  const html = renderToStaticMarkup(React.createElement(page.TwoProductComparisonPageContent, {
    result,
    params: { left: "1", right: "2" },
  }));
  assert.match(html, /Compare two supplements side by side/);
  assert.match(html, /Exact variant: 500g/);
  assert.match(html, /Lowest known delivered total/);
  assert.match(html, /no product is declared a winner/i);
  assert.doesNotMatch(html, /is the winner|best product|recommended product/i);
  assert.deepEqual(page.buildTwoProductComparisonStructuredData()["@graph"].map((node) => node["@type"]), ["WebPage", "BreadcrumbList"]);
});
