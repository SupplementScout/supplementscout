const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");

function load(file, overrides = {}) {
  const modules = new Map();
  function compile(filename) {
    filename = path.resolve(filename);
    if (modules.has(filename)) return modules.get(filename).exports;
    const mod = new Module(filename, module); modules.set(filename, mod);
    mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = (name) => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === "server-only") return {};
      if (name === "next/link") return { __esModule: true, default: ({ children, href, ...props }) => React.createElement("a", { href, ...props }, children) };
      if (name === "next/cache") return { unstable_cache: (read) => read };
      if (name.endsWith("/supabase")) return { supabase: { from: () => { throw new Error("Unexpected live read in test"); } } };
      if (name.endsWith("/supabaseAdmin")) return { supabaseAdmin: { from: () => { throw new Error("Unexpected privileged read in test"); } } };
      if (name.startsWith(".")) {
        const target = path.resolve(path.dirname(filename), name);
        for (const ext of [".ts", ".tsx"]) if (fs.existsSync(target + ext)) return compile(target + ext);
      }
      return Module.prototype.require.call(mod, name);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: {
      esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText, filename);
    return mod.exports;
  }
  return compile(path.join(root, file));
}
const budget = load("app/lib/proteinBudgetGuide.ts"), caffeine = load("app/lib/caffeineFreeGuide.ts");
const budgetFile = "app/guides/protein-powder-under-30/page.tsx", caffeineFile = "app/guides/caffeine-free-pre-workout/page.tsx";
const now = new Date("2026-11-17T16:00:00Z");

// Explicit TEST ONLY quantities/offers, separate from production-source evidence.
function product(target, { price = 20, shipping = 3.99, nutrition = false } = {}) {
  return { id: target.id, slug: target.slug, name: "Fixture Whey Protein", brand: "Fixture", category: "Whey Protein", image: null,
    product_format: "powder", net_weight_g: target.grams, net_volume_ml: null, unit_count: null, unit_type: null,
    serving_count_verified: 10, serving_size_g: target.grams / 10, protein_per_serving_g: 20,
    creatine_per_serving_g: null, nutrition_verified: true, unit_pricing_verified: true,
    is_active: true, merged_at: null, merged_into_product_id: null,
    offers: [{ id: 1, retailer_product_id: 101, price, shipping_cost: shipping, in_stock: true,
      last_checked_at: "2026-11-17T15:00:00Z", url: "https://retailer.example/item",
      retailer: { id: 10, name: "Fixture retailer", slug: "fixture-retailer" }, variant_resolution: "resolved",
      product_variant: { id: target.variantId, product_id: target.id, display_name: `${target.flavour} / ${target.grams}g`,
        flavour_label: target.flavour, pack_count: 1, size_value: target.grams, size_unit: "g", is_active: true, product_format: "powder",
        nutrition_override: nutrition ? { serving_count_verified: 10, serving_size_g: target.grams / 10, protein_per_serving_g: 20,
          nutrition_verified: true, unit_pricing_verified: true, creatine_per_serving_g: null,
          source_type: "manufacturer_product_page", source_url: "https://manufacturer.example/label", evidence: "TEST ONLY exact flavour label fixture; not production evidence." } : {} },
    }],
  };
}
function facts(target) {
  return { productId: target.id, productVariantId: target.variantId, caffeineFreeConfirmed: true,
    facts: [{ key: "caffeine", informationState: "confirmed_absent", amountPerServingMg: null,
      servingSizeValue: null, servingSizeUnit: null, servingBasisText: null, ingredientForm: null,
      ingredientRatio: null, sourceKinds: ["manufacturer_source"] }] };
}
function caffeineResult() {
  return { rows: caffeine.CAFFEINE_FREE_PRODUCTS.map((target) => product(target)), error: false,
    appliedFacts: Object.fromEntries(caffeine.CAFFEINE_FREE_PRODUCTS.map((target) => [target.variantId, facts(target)])) };
}
function html(file, result, time = now) {
  const page = load(file), Component = file === budgetFile ? page.ProteinBudgetGuideContent : page.CaffeineFreeGuideContent;
  return renderToStaticMarkup(React.createElement(Component, { result, now: time }));
}

test("the £30 boundary includes delivery, exactly £30 and distinct pinned products", () => {
  const rows = budget.PROTEIN_BUDGET_PRODUCTS.map((target) => product(target, { price: 26.01 }));
  const examples = budget.proteinBudgetExamples(rows, now);
  assert.equal(examples.length, 3); assert.equal(new Set(examples.map(e => e.row.id)).size, 3);
  assert.ok(examples.every(e => e.offer.deliveredPrice.totalPrice === 30));
  rows[0].offers[0].price = 26.02;
  assert.equal(budget.proteinBudgetExamples(rows, now).length, 2);
});
test("unknown shipping is excluded and a recorded zero is allowed", () => {
  const row = product(budget.PROTEIN_BUDGET_PRODUCTS[0], { price: 30, shipping: null });
  assert.deepEqual(budget.proteinBudgetExamples([row], now), []);
  row.offers[0].shipping_cost = 0;
  assert.equal(budget.proteinBudgetExamples([row], now)[0].offer.deliveredPrice.totalPrice, 30);
});
test("budget selection rejects wrong flavour, size, pack, parent, active state and unresolved mapping", () => {
  for (const patch of [{ id: 999 }, { product_id: 999 }, { flavour_label: "Other" }, { size_value: 999 }, { size_unit: "kg" }, { pack_count: 2 }, { is_active: false }, { product_format: "bar" }]) {
    const row = product(budget.PROTEIN_BUDGET_PRODUCTS[0]); Object.assign(row.offers[0].product_variant, patch);
    assert.deepEqual(budget.proteinBudgetExamples([row], now), []);
  }
  const row = product(budget.PROTEIN_BUDGET_PRODUCTS[0]); row.offers[0].variant_resolution = "unresolved";
  assert.deepEqual(budget.proteinBudgetExamples([row], now), []);
});
test("stale, unavailable, invalid-timestamp and inactive/merged products cannot supply current budget prices", () => {
  for (const patch of [{ in_stock: false }, { last_checked_at: null }, { last_checked_at: "2026-11-15T00:00:00Z" }, { last_checked_at: "invalid" }]) {
    const row = product(budget.PROTEIN_BUDGET_PRODUCTS[0]); Object.assign(row.offers[0], patch);
    assert.deepEqual(budget.proteinBudgetExamples([row], now), []);
  }
  for (const patch of [{ is_active: false }, { merged_at: "2026-11-01" }, { merged_into_product_id: 999 }]) {
    const row = product(budget.PROTEIN_BUDGET_PRODUCTS[0]); Object.assign(row, patch);
    assert.deepEqual(budget.proteinBudgetExamples([row], now), []);
  }
});
test("protein taxonomy excludes non-powder foods and bundles instead of trusting a protein category", () => {
  for (const patch of [{ name: "Whey Protein Shaker Bundle" }, { product_format: "bar" }, { name: "Protein Meal Replacement" }]) {
    const row = product(budget.PROTEIN_BUDGET_PRODUCTS[0]); Object.assign(row, patch);
    assert.deepEqual(budget.proteinBudgetExamples([row], now), []);
  }
});
test("a cheaper headline offer with unknown shipping cannot replace a known delivered offer", () => {
  const row = product(budget.PROTEIN_BUDGET_PRODUCTS[0]); row.offers.push({ ...row.offers[0], id: 2, price: 1, shipping_cost: null });
  assert.equal(budget.proteinBudgetExamples([row], now)[0].offer.deliveredPrice.totalPrice, 23.99);
});
test("verified protein unit cost uses the existing denominator; missing exact-flavour facts remain blank", () => {
  const target = budget.PROTEIN_BUDGET_PRODUCTS[0], row = product(target, { price: 20.01, nutrition: true });
  const example = budget.proteinBudgetExamples([row], now)[0];
  assert.equal(example.totalProteinG, 200); assert.equal(example.row.costPer25gProtein, 3);
  assert.match(html(budgetFile, { rows: [row], error: false }), /£3\.00/);
  row.offers[0].product_variant.nutrition_override = {};
  assert.equal(budget.proteinBudgetExamples([row], now)[0].row.costPer25gProtein, null);
  const rendered = html(budgetFile, { rows: [row], error: false });
  assert.match(rendered, /not yet verified for this exact flavour/); assert.match(rendered, /£24\.00/);
});
test("caffeine examples require approved-applied DTO identity, confirmed absence and source kind", () => {
  const result = caffeineResult(); assert.equal(caffeine.caffeineFreeExamples(result, now).length, 2);
  const id = caffeine.CAFFEINE_FREE_PRODUCTS[0].variantId;
  for (const patch of [{ productId: "999" }, { productVariantId: "999" }, { caffeineFreeConfirmed: false }]) {
    const value = caffeineResult(); Object.assign(value.appliedFacts[id], patch);
    assert.equal(caffeine.caffeineFreeExamples(value, now).length, 1);
  }
  for (const state of ["present_with_amount", "present_amount_not_disclosed", "no_information", "conflicting_information", null]) {
    const value = caffeineResult(); value.appliedFacts[id].facts[0].informationState = state;
    assert.equal(caffeine.caffeineFreeExamples(value, now).length, 1);
  }
  const value = caffeineResult(); value.appliedFacts[id].facts[0].sourceKinds = [];
  assert.equal(caffeine.caffeineFreeExamples(value, now).length, 1);
});
test("marketing wording, raw zero and unproved applied data cannot establish caffeine absence", () => {
  const value = caffeineResult(); value.appliedFacts = {};
  for (const row of value.rows) { row.name = "Caffeine-free stimulant-free non-stim"; row.offers[0].product_variant.nutrition_override = { caffeine_per_serving_mg: 0 }; }
  assert.deepEqual(caffeine.caffeineFreeExamples(value, now), []);
  assert.match(html(caffeineFile, value), /No current selected example passes/);
});
test("caffeine price examples reject different flavours, packs, unknown shipping, OOS and stale offers", () => {
  for (const patch of [{ flavour_label: "Other" }, { product_id: 999 }, { size_value: 999 }, { pack_count: 2 }, { product_format: "capsule" }]) {
    const value = caffeineResult(); Object.assign(value.rows[0].offers[0].product_variant, patch);
    assert.equal(caffeine.caffeineFreeExamples(value, now).length, 1);
  }
  for (const patch of [{ shipping_cost: null }, { in_stock: false }, { last_checked_at: "2026-11-15T00:00:00Z" }]) {
    const value = caffeineResult(); Object.assign(value.rows[0].offers[0], patch);
    assert.equal(caffeine.caffeineFreeExamples(value, now).length, 1);
  }
});
test("cached raw offers age out at render time without changing route indexability", () => {
  const later = new Date("2026-11-18T16:00:00Z");
  assert.deepEqual(budget.proteinBudgetExamples([product(budget.PROTEIN_BUDGET_PRODUCTS[0])], later), []);
  assert.deepEqual(caffeine.caffeineFreeExamples(caffeineResult(), later), []);
});
test("the caffeine loader batches its two exact fact bindings through the existing strict reader", async () => {
  const result = caffeineResult(); let productReads = 0, factReads = 0;
  const loader = load("app/lib/caffeineFreeGuideData.ts", {
    "./buyingGuideData": { getBuyingGuideProducts: async slugs => { productReads++; assert.equal(slugs.length, 2); return { rows: result.rows, error: false }; } },
    "./reviewedPreWorkoutFacts.server": { loadAppliedPreWorkoutFacts: async (variants, options) => { factReads++; assert.equal(variants.length, 2); assert.equal(options.failOnError, true); return new Map(Object.entries(result.appliedFacts)); } },
  });
  assert.equal((await loader.getCaffeineFreeGuideData()).error, false); assert.equal(productReads, 1); assert.equal(factReads, 1);
});
test("caffeine fact-read failures abort rather than becoming a successful empty cached guide", async () => {
  const loader = load("app/lib/caffeineFreeGuideData.ts", {
    "./buyingGuideData": { getBuyingGuideProducts: async () => ({ rows: caffeineResult().rows, error: false }) },
    "./reviewedPreWorkoutFacts.server": { loadAppliedPreWorkoutFacts: async () => { throw new Error("Fixture read failure"); } },
  });
  assert.deepEqual(await loader.getCaffeineFreeGuideData(), { rows: [], appliedFacts: {}, error: true });
  const page = load(caffeineFile, { "../../lib/caffeineFreeGuideData": { getCaffeineFreeGuideData: async () => ({ rows: [], appliedFacts: {}, error: true }) } });
  await assert.rejects(page.default(), /temporarily unavailable/);
});
test("the shared applied-fact reader preserves its existing default and supports strict failures", async () => {
  const query = {}; for (const method of ["select", "eq", "in", "order"]) query[method] = () => query;
  query.range = async () => ({ data: null, error: { message: "Fixture failure" } });
  const reader = load("app/lib/reviewedPreWorkoutFacts.server.ts", { "./supabaseAdmin": { supabaseAdmin: { from: () => query } } });
  const variants = [{ id: "763", product_id: "481", nutrition_override: {} }];
  await assert.rejects(reader.loadAppliedPreWorkoutFacts(variants, { failOnError: true }), /Unable to verify/);
  const original = console.error; console.error = () => {};
  try { assert.equal((await reader.loadAppliedPreWorkoutFacts(variants)).size, 0); } finally { console.error = original; }
});
test("SSR exposes prices, exact links, check times, evidence and honest empty states", () => {
  const a = html(budgetFile, { rows: budget.PROTEIN_BUDGET_PRODUCTS.map(t => product(t)), error: false });
  assert.equal((a.match(/<h1\b/g) || []).length, 1); assert.match(a, /£23\.99/); assert.match(a, /variant=949/);
  assert.match(a, /dateTime="2026-11-17T15:00:00Z"/); assert.match(a, /Low upfront cost/);
  const b = html(caffeineFile, caffeineResult()); assert.equal((b.match(/<h1\b/g) || []).length, 1);
  assert.match(b, /Caffeine: confirmed absent/); assert.match(b, /variant=763/); assert.match(b, /Missing caffeine information/);
  assert.match(html(budgetFile, { rows: [], error: false }), /No current selected variant meets all checks/);
  assert.match(html(caffeineFile, { rows: [], appliedFacts: {}, error: false }), /No current selected example passes/);
  for (const href of ["/whey-protein", "/help-me-choose", "/guides/cost-per-25g-protein"]) assert.ok(a.includes('href="' + href + '"'));
  assert.ok(b.includes('href="/search?q=pre%20workout&amp;caffeine=free"'));
});
test("new metadata is database-free, planned/noindex, self-canonical and factual JSON-LD", async () => {
  for (const [file, route, result] of [[budgetFile, budget.PROTEIN_BUDGET_PATH, { rows: [], error: false }], [caffeineFile, caffeine.CAFFEINE_FREE_PATH, { rows: [], appliedFacts: {}, error: false }]]) {
    const page = load(file), metadata = await page.generateMetadata();
    assert.equal(metadata.alternates.canonical, route); assert.deepEqual(metadata.robots, { index: false, follow: true });
    assert.deepEqual((await page.generateMetadata({ searchParams: Promise.resolve({ sort: "price", page: "2" }) })).robots, metadata.robots);
    const schema = JSON.parse(html(file, result).match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.deepEqual(schema["@graph"].map(n => n["@type"]), ["WebPage", "BreadcrumbList"]);
    assert.equal(schema["@graph"][0].url, "https://www.supplementscout.co.uk" + route);
    assert.doesNotMatch(JSON.stringify(schema), /Article|FAQPage|ratingValue|datePublished|author/);
  }
});
test("new sitemap candidates remain excluded; existing guides stay live and caches are isolated", () => {
  const lifecycle = load("app/lib/indexabilityLifecycle.ts"), sitemap = fs.readFileSync(path.join(root, "app/sitemap.ts"), "utf8");
  for (const route of [budget.PROTEIN_BUDGET_PATH, caffeine.CAFFEINE_FREE_PATH]) { assert.equal(lifecycle.getLifecycleStatus(route), "planned"); assert.equal(lifecycle.isLifecycleSitemapEligible(route), false); assert.equal(sitemap.split(route).length - 1, 1); }
  for (const route of ["/creatine", "/brands/per4m", "/guides/cost-per-25g-protein", "/guides/supplement-prices-including-delivery"]) assert.equal(lifecycle.getLifecycleStatus(route), "live_verified");
  assert.match(fs.readFileSync(path.join(root, budgetFile), "utf8"), /"protein-budget-examples-v1"/);
  assert.match(fs.readFileSync(path.join(root, caffeineFile), "utf8"), /"caffeine-free-examples-v1"/);
});

module.exports = { load, product, facts, caffeineResult, now, budgetFile, caffeineFile };
