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
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const mod = new Module(filename, module);
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (parent === mod && Object.hasOwn(mocks, request)) return mocks[request];
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

const pricing = compileModule(path.join(process.cwd(), "app/lib/pricing.ts"));
const freshness = compileModule(path.join(process.cwd(), "app/lib/offerFreshness.ts"));
const dealsPath = path.join(process.cwd(), "app/lib/dealsPriceIntelligence.ts");

function loadDeals(rows = []) {
  const builder = { select: () => builder, eq: () => builder, gt: () => builder, order: () => builder, range: () => ({ data: rows, error: null }) };
  return compileModule(dealsPath, {
    "server-only": {},
    react: { cache: (fn) => fn },
    "./offerFreshness": freshness,
    "./pricing": pricing,
    "./supabaseAdmin": { supabaseAdmin: { from: () => builder } },
  });
}

const NOW = new Date("2026-08-24T12:00:00.000Z");
function rawOffer(id, productId, variantId, retailerId, overrides = {}) {
  const product = {
    id: productId, name: `Product ${productId}`, slug: `product-${productId}`,
    brand: "Example", image: null, is_active: true, merged_into_product_id: null,
  };
  const variant = {
    id: variantId, product_id: productId,
    pack_count: 1, size_value: 500, size_unit: "g", is_active: true,
  };
  return {
    id, product_id: productId, retailer_id: retailerId, retailer_product_id: id + 1000,
    price: 20 + retailerId, shipping_cost: 0, in_stock: true,
    last_checked_at: "2026-08-24T11:00:00.000Z", url: `https://retailer.example/${id}`,
    retailer: { id: retailerId, name: `Retailer ${retailerId}`, slug: `retailer-${retailerId}` },
    product,
    retailer_product: { id: id + 1000, product_id: productId, product_variant_id: variantId, external_product_id: `product-${productId}`, external_variant_id: `variant-${variantId}`, product_variant: variant },
    ...overrides,
  };
}

test("selector fails closed unless identity, exact pack, freshness and delivered price agree", () => {
  const deals = loadDeals();
  const rows = [
    rawOffer(1, 1, 101, 1),
    rawOffer(2, 1, 101, 2),
    rawOffer(3, 2, 201, 1),
    rawOffer(4, 2, 202, 2),
    rawOffer(5, 3, 301, 1),
    rawOffer(6, 3, 301, 2, { shipping_cost: null }),
    rawOffer(7, 4, 401, 1),
    rawOffer(8, 4, 401, 2, { last_checked_at: "2026-08-23T11:59:59.000Z" }),
    rawOffer(9, 5, 501, 1),
    rawOffer(10, 5, 501, 2, { retailer_product: { id: 1010, product_id: 999, product_variant_id: 501, external_product_id: "p", external_variant_id: "v", product_variant: { id: 501, product_id: 5, pack_count: 1, size_value: 500, size_unit: "g", is_active: true } } }),
  ];
  const result = deals.normalizeDeals(rows, NOW);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "1");
  assert.equal(result[0].retailerCount, 2);
  assert.equal(result[0].packLabel, "500g");
});

test("one product selects one deterministic exact variant and one lowest offer per retailer", () => {
  const deals = loadDeals();
  const rows = deals.normalizeDeals([
    rawOffer(11, 1, 101, 1, { price: 25 }),
    rawOffer(12, 1, 101, 1, { price: 20 }),
    rawOffer(13, 1, 101, 2, { price: 22 }),
    rawOffer(14, 1, 102, 1, { price: 15 }),
    rawOffer(15, 1, 102, 2, { price: 16 }),
  ], NOW);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].offerCount, 2);
  assert.equal(rows[0].variantId, "102");
  assert.equal(rows[0].bestOffer.id, "14");
});

test("gate counts every qualifying exact-variant offer before one-row product reduction", () => {
  const deals = loadDeals();
  const result = deals.buildDealsResult([
    rawOffer(21, 1, 101, 1), rawOffer(22, 1, 101, 2),
    rawOffer(23, 1, 102, 1), rawOffer(24, 1, 102, 2),
  ], NOW);
  assert.equal(result.rows.length, 1);
  assert.equal(result.summary.qualifyingOffers, 4);
  assert.equal(result.summary.productsWithMultipleFreshRetailers, 1);
});

test("readiness gate requires 12 products, 30 offers, 4 retailers and two retailers per row", () => {
  const { DEALS_INDEX_GATE, evaluateDealsIndexability } = loadDeals();
  assert.deepEqual(DEALS_INDEX_GATE, { minimumProducts: 12, minimumOffers: 30, minimumRetailers: 4, minimumRetailersPerProduct: 2 });
  const summary = { visibleProducts: 12, qualifyingOffers: 30, freshRetailers: 4, productsWithMultipleFreshRetailers: 12, latestOfferCheckedAt: null };
  assert.equal(evaluateDealsIndexability(summary, true).indexable, true);
  assert.equal(evaluateDealsIndexability({ ...summary, visibleProducts: 11, productsWithMultipleFreshRetailers: 11 }, true).indexable, false);
  assert.equal(evaluateDealsIndexability({ ...summary, qualifyingOffers: 29 }, true).indexable, false);
  assert.equal(evaluateDealsIndexability(summary, false).indexable, false);
});

test("launch gate remains monitoring evidence and does not control stable base-page indexing", async () => {
  const deals = loadDeals();
  const Link = ({ href, children, ...props }) => React.createElement("a", { href: typeof href === "string" ? href : "#", ...props }, children);
  for (const visibleProducts of [12, 11, 5, 0]) {
    const result = {
      ...deals.emptyDealsResult(false),
      summary: {
        visibleProducts,
        qualifyingOffers: visibleProducts * 2,
        freshRetailers: visibleProducts ? 2 : 0,
        productsWithMultipleFreshRetailers: visibleProducts,
        latestOfferCheckedAt: null,
      },
    };
    const page = compileModule(path.join(process.cwd(), "app/deals/page.tsx"), {
      next: {}, "next/link": { __esModule: true, default: Link },
      "../components/ComparisonProductVisuals": require("./test-helpers/comparison-product-visuals"),
      "../components/CategoryViewAnalytics": { __esModule: true, default: () => null },
      "../components/ComparisonTransparencyLinks": { __esModule: true, default: () => null },
      "../lib/pricing": pricing,
      "../lib/dealsPriceIntelligence": { ...deals, getDeals: async () => result },
    });
    assert.deepEqual((await page.generateMetadata()).robots, { index: true, follow: true });
    assert.deepEqual((await page.generateMetadata({ searchParams: Promise.resolve({ sort: "price" }) })).robots, { index: false, follow: true });
    assert.equal((await page.generateMetadata()).alternates.canonical, "/deals");
  }
});

test("production query is bounded and uses the central offers identity path", async () => {
  const calls = [];
  const builder = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); return name === "range" ? { data: [], error: null } : builder; } });
  const deals = compileModule(dealsPath, {
    "server-only": {}, react: { cache: (fn) => fn }, "./offerFreshness": freshness, "./pricing": pricing,
    "./supabaseAdmin": { supabaseAdmin: { from: (table) => { calls.push(["from", table]); return builder; } } },
  });
  await deals.getDeals();
  assert.ok(calls.some((call) => call[0] === "from" && call[1] === "offers"));
  assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "in_stock" && call[2] === true));
  assert.ok(calls.some((call) => call[0] === "range" && call[1] === 0 && call[2] === 999));
});

test("production query fails closed instead of publishing a truncated maximum result", async () => {
  let pages = 0;
  const fullPage = Array.from({ length: 1000 }, (_, index) => ({ id: index + 1 }));
  const builder = { select: () => builder, eq: () => builder, gt: () => builder, order: () => builder, range: () => { pages += 1; return { data: fullPage, error: null }; } };
  const deals = compileModule(dealsPath, {
    "server-only": {}, react: { cache: (fn) => fn }, "./offerFreshness": freshness, "./pricing": pricing,
    "./supabaseAdmin": { supabaseAdmin: { from: () => builder } },
  });
  const result = await deals.getDeals();
  assert.equal(pages, 10);
  assert.equal(result.error, true);
  assert.equal(result.rows.length, 0);
});

test("page metadata, SSR, schema, sitemap and links use one guarded /deals URL", async () => {
  const deals = loadDeals();
  const raw = [];
  for (let product = 1; product <= 12; product += 1) {
    for (let retailer = 1; retailer <= 3; retailer += 1) raw.push(rawOffer(product * 10 + retailer, product, product * 100, retailer));
  }
  const rows = deals.normalizeDeals(raw, NOW);
  const result = {
    rows,
    summary: { visibleProducts: 12, qualifyingOffers: 36, freshRetailers: 3, productsWithMultipleFreshRetailers: 12, latestOfferCheckedAt: "2026-08-24T11:00:00.000Z" },
    error: false,
  };
  result.summary.freshRetailers = 4;
  const Link = ({ href, children, ...props }) => React.createElement("a", { href: typeof href === "string" ? href : "#", ...props }, children);
  const page = compileModule(path.join(process.cwd(), "app/deals/page.tsx"), {
    next: {}, "next/link": { __esModule: true, default: Link },
    "../components/ComparisonProductVisuals": require("./test-helpers/comparison-product-visuals"),
    "../components/CategoryViewAnalytics": { __esModule: true, default: () => null },
    "../components/ComparisonTransparencyLinks": { __esModule: true, default: () => React.createElement("a", { href: "/how-we-compare" }, "Method") },
    "../lib/pricing": pricing,
    "../lib/dealsPriceIntelligence": { ...deals, getDeals: async () => result },
  });
  const metadata = await page.generateMetadata();
  assert.equal(page.dynamic, "force-dynamic");
  assert.equal(metadata.alternates.canonical, "/deals");
  assert.deepEqual(metadata.robots, { index: true, follow: true });
  assert.deepEqual((await page.generateMetadata({ searchParams: Promise.resolve({ sort: "price" }) })).robots, { index: false, follow: true });
  const html = renderToStaticMarkup(React.createElement(page.DealsPageContent, { result }));
  assert.match(html, /Best Supplement Prices Today/);
  assert.match(html, /Lowest current delivered price/);
  assert.match(html, /same exact variant and pack/);
  assert.match(html, /\/go\/\d+\?source=product_best_offer/);
  assert.doesNotMatch(html, /was price|price drop|save £|lowest ever/i);
  assert.equal(page.isDealsStructuredDataValid(page.buildDealsStructuredData(rows)), true);
  assert.deepEqual(page.buildDealsStructuredData(rows)["@graph"].map((node) => node["@type"]), ["CollectionPage", "ItemList", "BreadcrumbList"]);
  const sitemap = fs.readFileSync(path.join(process.cwd(), "app/sitemap.ts"), "utf8");
  const readiness = fs.readFileSync(path.join(process.cwd(), "app/lib/sitemapReadiness.ts"), "utf8");
  const homeHeader = fs.readFileSync(path.join(process.cwd(), "app/components/HomeHeader.tsx"), "utf8");
  const home = fs.readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8");
  const whey = fs.readFileSync(path.join(process.cwd(), "app/whey-protein/page.tsx"), "utf8");
  const bars = fs.readFileSync(path.join(process.cwd(), "app/protein-bars/page.tsx"), "utf8");
  assert.equal((sitemap.match(/siteUrl}\/deals/g) || []).length, 1);
  assert.doesNotMatch(readiness, /path: "\/deals"/);
  for (const source of [homeHeader, home, whey, bars]) assert.match(source, /\/deals/);
});

test("query errors abort page rendering instead of returning a false 200/noindex list", async () => {
  const deals = loadDeals();
  const result = deals.emptyDealsResult(true);
  const page = compileModule(path.join(process.cwd(), "app/deals/page.tsx"), {
    next: {}, "next/link": { __esModule: true, default: () => null },
    "../components/ComparisonProductVisuals": require("./test-helpers/comparison-product-visuals"),
    "../components/CategoryViewAnalytics": { __esModule: true, default: () => null },
    "../components/ComparisonTransparencyLinks": { __esModule: true, default: () => null },
    "../lib/pricing": pricing,
    "../lib/dealsPriceIntelligence": { ...deals, getDeals: async () => result },
  });
  assert.deepEqual((await page.generateMetadata()).robots, { index: true, follow: true });
  await assert.rejects(page.default(), /Deals data is temporarily unavailable/);
  assert.throws(() => page.DealsPageContent({ result }), /Deals data is temporarily unavailable/);
  const errorSource = fs.readFileSync(path.join(process.cwd(), "app/deals/error.tsx"), "utf8");
  assert.match(errorSource, /Current prices are temporarily unavailable/);
  assert.match(errorSource, /unstable_retry/);
});
