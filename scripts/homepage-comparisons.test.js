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
const presentation = load("app/lib/homepageComparisonDetails.ts");

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

function nutritionFixture() {
  return {
    product: { id: "1", category: "Whey Protein", is_active: true, merged_into_product_id: null, net_weight_g: 500, serving_count_verified: 20, serving_size_g: 25, protein_per_serving_g: 20, creatine_per_serving_g: null, product_format: "powder", unit_pricing_verified: true, nutrition_verified: true },
    variant: { id: "10", product_id: "1", pack_count: 1, size_value: 500, size_unit: "g", flavour_label: "Chocolate", nutrition_override: {}, product_format: "powder", is_active: true },
  };
}

test("hero metrics reuse verified exact-pack calculations with delivery included", () => {
  const { product, variant } = nutritionFixture();
  const row = { ...result().rows[0], image: "https://test-only.example/product.webp" };
  const details = presentation.buildHomepageComparisonDetails(row, product, variant);
  assert.deepEqual(details.metrics, [{ value: "£1.10", label: "per serving" }, { value: "£1.38", label: "per 25g protein" }, { value: "20", label: "servings" }]);
  const html = featured({ state: "ready", rows: [row], details: { "10": details } });
  assert.match(html, /Chocolate/);
  assert.match(html, /Unit costs include known delivery/);
  assert.match(html, /\(18\.5%\)/, "saving percentage uses the next retailer's delivered total of 27");
  assert.match(html, /loading="eager"/);
});

test("missing, unverified, mismatched and multipack nutrition cannot invent nutrient prices", () => {
  const { product, variant } = nutritionFixture();
  const row = result().rows[0];
  for (const [p, v] of [[undefined, variant], [product, undefined], [product, { ...variant, id: "99" }], [product, { ...variant, product_id: "99" }], [product, { ...variant, size_value: 1000 }], [product, { ...variant, pack_count: 2 }]]) {
    assert.deepEqual(presentation.buildHomepageComparisonDetails(row, p, v).metrics, []);
  }
  const unverified = presentation.buildHomepageComparisonDetails(row, { ...product, nutrition_verified: false }, variant);
  assert.ok(unverified.metrics.every((metric) => metric.label !== "per 25g protein"));
  const preWorkout = presentation.buildHomepageComparisonDetails(row, { ...product, category: "Pre Workout" }, variant);
  assert.ok(preWorkout.metrics.every((metric) => !metric.label.includes("protein")));
});

test("creatine metrics use verified nutrient mass rather than scoop weight", () => {
  const { product, variant } = nutritionFixture();
  const metrics = presentation.buildHomepageComparisonDetails(result().rows[0], { ...product, category: "Creatine", protein_per_serving_g: null, creatine_per_serving_g: 3 }, variant).metrics;
  assert.deepEqual(metrics.find((metric) => metric.label === "per 5g creatine"), { value: "£1.83", label: "per 5g creatine" });
});

test("quality ordering prefers complete data, keeps deterministic ties and diversifies secondary categories", () => {
  const base = result().rows[0];
  const rows = ["1", "2", "3", "4", "5"].map((id) => ({ ...base, id, variantId: id, image: "https://test-only.example/image.webp" }));
  const details = { "1": { category: "Pre Workout", metrics: [] }, "2": { category: "Pre Workout", metrics: [] }, "3": { category: "Whey Protein", metrics: [{ label: "per 25g protein", value: "£1" }] }, "4": { category: "Creatine", metrics: [] } };
  assert.deepEqual(presentation.orderHomepageComparisons(rows, details).map((row) => row.id), ["3", "1", "4", "2"]);
  assert.deepEqual(presentation.orderHomepageComparisons(rows, {}).map((row) => row.id), ["1", "2", "3", "4"]);
});

test("history requires a proven exact current-check anchor and never mixes identity series", () => {
  const row = result().rows[0];
  const record = { offer_id: row.bestOffer.id, product_id: row.id, identity_series_id: "9007199254740999", price: 20, shipping_cost: 2, total_price: 22, checked_at: row.bestOffer.lastCheckedAt, evidence_status: "proven", currency: "GBP", in_stock: true, anomaly_flags: [] };
  const previousDate = new Date(Date.parse(record.checked_at) - 86400_000).toISOString();
  const previous = { ...record, checked_at: previousDate, price: 23, total_price: 25 };
  const otherSeries = { ...previous, identity_series_id: "2", price: 5, total_price: 7 };
  assert.deepEqual(presentation.buildHomepageHistory(row, [otherSeries, record, previous]), [{ date: previousDate.slice(0, 10), price: 25 }, { date: record.checked_at.slice(0, 10), price: 22 }]);
  assert.deepEqual(presentation.buildHomepageHistory(row, [previous, otherSeries]), []);
  for (const invalid of [{ evidence_status: null }, { anomaly_flags: ["identity_changed"] }, { currency: "USD" }, { in_stock: false }, { offer_id: "2" }, { shipping_cost: null }, { identity_series_id: null }, { total_price: 1 }, { price: 19, total_price: 21 }]) {
    assert.deepEqual(presentation.buildHomepageHistory(row, [{ ...record, ...invalid }]), []);
  }
});

test("optional enrichment uses two bounded reads and a single bounded history read, failing safely", async () => {
  const calls = [];
  const { product, variant } = nutritionFixture();
  const db = { from(table) { const call = { table, operations: [] }; calls.push(call); const builder = new Proxy({}, { get: (_, key) => key === "then" ? (resolve) => resolve({ error: null, data: table === "products" ? [product] : table === "product_variants" ? [variant] : [] }) : (...args) => { call.operations.push([key, ...args]); return builder; } }); return builder; } };
  const readers = load("app/lib/homepageComparisonDetails.server.ts", { "./supabaseAdmin": { supabaseAdmin: db } });
  const row = result().rows[0];
  const details = await readers.getHomepageComparisonDetails(Array(30).fill(row));
  assert.equal(details["10"].metrics.length, 3);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.operations.some(([name, limit]) => name === "limit" && limit === 16)));
  assert.ok(calls.every((call) => call.operations.find(([name]) => name === "in")[2].length === 16));
  assert.deepEqual(await readers.getHomepagePriceHistory(row), []);
  assert.equal(calls[2].table, "price_history");
  assert.ok(calls[2].operations.some(([name, limit]) => name === "limit" && limit === 120));
});

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

test("product images render native lazy HTML with a reserved fill box and readable fallback alt for both navigation modes", () => {
  const { ComparisonProductHeroImage } = load("app/components/ComparisonProductVisuals.tsx");
  for (const nativeNavigation of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(ComparisonProductHeroImage, {
      image: "https://test-only.example/product.jpg", name: "TEST ONLY Supplement", productUrl: "/product/test-only?variant=10", nativeNavigation,
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

test("secondary comparisons have real variant links and explicitly scoped current-retailer savings", () => {
  const rows = result().rows;
  const html = renderToStaticMarkup(React.createElement(components.HomeCurrentComparisons, { rows }));
  assert.match(html, /href="\/product\/test-only-supplement\?variant=10"/);
  assert.match(html, /£22\.00/);
  assert.match(html, /Compare 2 stores/);
  assert.match(html, /Save £5\.00/);
  assert.match(html, /Compared with the next listed retailer, including delivery/);
  assert.doesNotMatch(html, /<del|<s\b|RRP/);
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
    "./supabaseAdmin": { supabaseAdmin: inaccessible },
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
  assert.match(html.replace(/<[^>]*>/g, " "), /Find the right\s+supplement/);
  assert.match(html, /UK supplement price comparison/);
  assert.match(html, /action="\/search"/);
  assert.match(html, /name="q"/);
  assert.match(html, /aria-label="Search supplements, brands or categories"/);
  for (const href of ["/creatine", "/whey-protein", "/pre-workout", "/vitamins", "/compare", "/deals", "/help-me-choose", "/brands/per4m", "/data-freshness", "/privacy"]) assert.ok(html.includes(`href="${href}"`), href);
  assert.deepEqual(page.metadata.alternates, { canonical: "/" });
  assert.equal(page.dynamic, "force-dynamic", "ISR must not serve expired commercial claims before background regeneration");
});
