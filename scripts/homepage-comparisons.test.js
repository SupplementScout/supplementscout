const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

// TEST ONLY catalogue. No network or database access, including through cache.
function load(relativePath, overrides = {}) {
  const cache = new Map();
  function compile(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const source = fs.readFileSync(filename, "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: filename,
    });
    const mod = new Module(filename, module);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = (request) => {
      if (Object.hasOwn(overrides, request)) return overrides[request];
      if (request === "server-only" || request.endsWith(".css")) return {};
      if (request === "next/cache") return { unstable_cache: (fn) => fn };
      if (request === "next/link") return { __esModule: true, default: ({ href, children, ...props }) => {
        delete props.prefetch;
        return React.createElement("a", { ...props, href: typeof href === "string" ? href : `${href.pathname}?${new URLSearchParams(href.query)}` }, children);
      } };
      if (request === "next/image") return { getImageProps: require("next/image").getImageProps };
      if (request.startsWith(".")) {
        const base = path.resolve(path.dirname(filename), request);
        const resolved = [base, `${base}.ts`, `${base}.tsx`].find((file) => fs.existsSync(file));
        if (resolved) return compile(resolved);
      }
      return require(request);
    };
    mod._compile(outputText, filename);
    return mod.exports;
  }
  return compile(path.join(process.cwd(), relativePath));
}

const now = new Date();
const checkedAt = new Date(now.getTime() - 60_000).toISOString();
const inaccessible = { from: () => { throw new Error("TEST ONLY: database access forbidden"); } };
const dataOverrides = { "./supabase": { supabase: inaccessible }, "./supabaseAdmin": { supabaseAdmin: inaccessible } };
const deals = load("app/lib/dealsPriceIntelligence.ts", dataOverrides);
const homeData = load("app/lib/homepageData.ts", dataOverrides);
const components = load("app/home-comparisons.tsx");

function offer(retailerId, price, overrides = {}) {
  return {
    id: retailerId + 100, product_id: 1, retailer_id: retailerId, retailer_product_id: retailerId,
    price, shipping_cost: 2, in_stock: true, last_checked_at: checkedAt, url: "https://test-only.example/product",
    retailer: { id: retailerId, name: `TEST ONLY Store ${retailerId}`, slug: `test-only-${retailerId}` },
    product: { id: 1, name: "TEST ONLY Supplement", slug: "test-only-supplement", brand: "TEST ONLY", image: null, is_active: true, merged_into_product_id: null },
    retailer_product: {
      id: retailerId, product_id: 1, product_variant_id: 10, external_product_id: "test-product", external_variant_id: "test-variant",
      product_variant: { id: 10, product_id: 1, pack_count: 1, size_value: 500, size_unit: "g", is_active: true },
    },
    ...overrides,
  };
}
function result(raw = [offer(1, 20), offer(2, 25)]) { return deals.buildDealsResult(raw, now); }
function featured(comparisons) { return renderToStaticMarkup(React.createElement(components.HomeFeaturedComparison, { comparisons })); }

test("homepage preserves the canonical deal order, caps at four and never selects a named brand", () => {
  const base = result();
  const rows = Array.from({ length: 8 }, (_, i) => ({ ...base.rows[0], id: String(i + 1), brand: `TEST ONLY ${i}` }));
  const selected = homeData.selectHomepageComparisons({ ...base, rows }, now);
  assert.equal(selected.state, "ready");
  assert.deepEqual(selected.rows, rows.slice(0, 4));
});

test("unknown delivery, stale prices, unresolved identity and single retailers cannot become hero claims", () => {
  for (const invalid of [
    { shipping_cost: null }, { in_stock: false },
    { last_checked_at: new Date(now.getTime() - 25 * 3600_000).toISOString() },
    { retailer_product: null },
  ]) {
    const selected = homeData.selectHomepageComparisons(result([offer(1, 20), offer(2, 25, invalid)]), now);
    assert.equal(selected.state, "empty");
    assert.equal(selected.rows.length, 0);
  }
});

test("cached offers must stay fresh through the next homepage revalidation", () => {
  const nearlyExpired = new Date(now.getTime() - 23.5 * 3600_000).toISOString();
  const current = result([offer(1, 20), offer(2, 25, { last_checked_at: nearlyExpired })]);
  assert.equal(current.rows.length, 1, "still current for the canonical deals hub");
  assert.equal(homeData.selectHomepageComparisons(current, now).state, "empty");
});

test("an unchanged cached snapshot stops producing price claims after offers expire", () => {
  const cached = result();
  assert.equal(homeData.selectHomepageComparisons(cached, now).state, "ready");
  const later = new Date(now.getTime() + 25 * 3600_000);
  const expired = homeData.selectHomepageComparisons(cached, later);
  assert.equal(expired.state, "empty");
  assert.doesNotMatch(featured(expired), /In stock|Lowest listed|Save /);
});

test("featured card renders exact variant links, known delivery, real totals and next-retailer saving in HTML", () => {
  const html = featured(homeData.selectHomepageComparisons(result(), now));
  assert.match(html, /Featured comparison/);
  assert.match(html, /TEST ONLY Supplement/);
  assert.match(html, /500g/);
  assert.match(html, /\?variant=10/);
  assert.match(html, /£22\.00/);
  assert.match(html, /£20\.00 product \+ £2\.00 delivery/);
  assert.match(html, /Save £5\.00 vs the next listed retailer/);
  assert.match(html, /href="\/go\/101\?source=product_best_offer"/);
  assert.match(html, /rel="sponsored nofollow noopener noreferrer"/);
  assert.match(html, /<time dateTime=/);
  assert.doesNotMatch(html, /best value|RRP|price drop|cost per serving|protein per|<script/i);
});

test("missing image, logos, nutrition and price history have an honest server fallback", () => {
  const html = featured(homeData.selectHomepageComparisons(result(), now));
  assert.match(html, /Image unavailable/);
  assert.doesNotMatch(html, /<img|NaN|undefined|null/);
  assert.equal((html.match(/class="home-offer-row"/g) || []).length, 2);
});

test("product images render native lazy HTML with Next sizing and readable fallback alt for both navigation modes", () => {
  const { ComparisonProductHeroImage } = load("app/components/ComparisonProductVisuals.tsx");
  for (const nativeNavigation of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(ComparisonProductHeroImage, {
      image: "https://test-only.example/product.jpg", name: "TEST ONLY Supplement", productUrl: "/product/test-only?variant=10", sizes: "96px", nativeNavigation,
    }));
    assert.match(html, /src="https:\/\/test-only\.example\/product\.jpg"/);
    assert.match(html, /alt="TEST ONLY Supplement"/);
    assert.match(html, /loading="lazy"/);
    assert.match(html, /decoding="async"/);
    assert.match(html, /position:absolute/);
    assert.match(html, /color:inherit/);
    assert.match(html, /href="\/product\/test-only\?variant=10"/);
  }
});

test("ties do not claim savings and free delivery is distinguished from unknown delivery", () => {
  const html = featured(homeData.selectHomepageComparisons(result([offer(1, 20, { shipping_cost: 0 }), offer(2, 20, { shipping_cost: 0 })]), now));
  assert.match(html, /free delivery/);
  assert.doesNotMatch(html, /Save £/);
});

test("valid empty and failed comparison reads produce distinct fallback copy without invented prices", () => {
  for (const [state, pattern] of [["empty", /No multi-store comparison/], ["unavailable", /temporarily unavailable/]]) {
    const html = featured({ state, rows: [] });
    assert.match(html, pattern);
    assert.match(html, /href="\/how-we-compare"/);
    assert.doesNotMatch(html, /£|<time|In stock|Lowest listed/);
  }
  assert.deepEqual(homeData.selectHomepageComparisons({ ...result(), error: true }, now), { state: "unavailable", rows: [] });
});

test("secondary comparisons have real crawlable variant links and no invented historical savings", () => {
  const rows = result().rows;
  const html = renderToStaticMarkup(React.createElement(components.HomeCurrentComparisons, { rows }));
  assert.match(html, /href="\/product\/test-only-supplement\?variant=10"/);
  assert.match(html, /£22\.00/);
  assert.match(html, /Compare 2 stores/);
  assert.doesNotMatch(html, /<del|<s\b|Save|RRP/);
  assert.equal(renderToStaticMarkup(React.createElement(components.HomeCurrentComparisons, { rows: [] })), "");
});

test("a failed shared loader does not suppress independently successful statistics or cache false prices", async () => {
  const db = {
    from(table) {
      let head = false, column;
      const builder = new Proxy({}, { get: (_, key) => {
        if (key === "then") return (resolve) => resolve({ data: table === "offers" ? [{ last_checked_at: checkedAt }] : head ? null : [{ category: "Creatine" }], count: table === "products" ? 42 : 3, error: null });
        return (...args) => { if (key === "select") { column = args[0]; head = args[1]?.head; } void column; return builder; };
      } });
      return builder;
    },
  };
  const data = load("app/lib/homepageData.ts", {
    "./supabase": { supabase: db },
    "./dealsPriceIntelligence": { getCachedDeals: async () => { throw new Error("TEST ONLY loader failure"); } },
  });
  const previousError = console.error;
  const errors = [];
  console.error = (message) => errors.push(message);
  try {
    const read = await data.getHomepageData();
    assert.equal(read.productCount, 42);
    assert.equal(read.retailerCount, 3);
    assert.equal(read.latestOfferCheckAt, checkedAt);
    assert.deepEqual(read.categories, ["Creatine"]);
    assert.deepEqual(read.comparisons, { state: "unavailable", rows: [] });
    assert.equal(errors.length, 1);
  } finally { console.error = previousError; }
});

test("homepage retains server copy, one H1 and every canonical catalogue path when comparisons are empty", async () => {
  const page = load("app/page.tsx", {
    "./lib/homepageData": { getHomepageData: async () => ({ categories: [], productCount: 42, retailerCount: 3, latestOfferCheckAt: checkedAt, comparisons: { state: "empty", rows: [] } }) },
  });
  const html = renderToStaticMarkup(await page.default());
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /Find the right supplement/);
  assert.match(html, /UK supplement price comparison/);
  assert.match(html, /action="\/search"/);
  assert.match(html, /name="q"/);
  assert.match(html, /aria-label="Search supplements, brands or categories"/);
  for (const href of ["/creatine", "/whey-protein", "/pre-workout", "/vitamins", "/compare", "/deals", "/help-me-choose", "/brands/per4m", "/data-freshness", "/privacy"]) assert.ok(html.includes(`href="${href}"`), href);
  assert.deepEqual(page.metadata.alternates, { canonical: "/" });
  assert.equal(page.dynamic, "force-dynamic", "ISR must not serve expired commercial claims before background regeneration");
});
