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
    const mod = new Module(filename, module);
    modules.set(filename, mod);
    mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = (name) => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === "server-only") return {};
      if (name === "next/link") return { __esModule: true, default: ({ children, href, ...props }) => React.createElement("a", { href, ...props }, children) };
      if (name === "next/cache") return { unstable_cache: (read) => read };
      if (name.endsWith("/supabase")) return { supabase: { from: () => { throw new Error("Unexpected live read in test"); } } };
      if (name.endsWith("/supabaseAdmin")) return { supabaseAdmin: {} };
      if (name.endsWith("/reviewedPreWorkoutFacts.server")) return { loadAppliedPreWorkoutFacts: async () => new Map() };
      if (name.startsWith(".")) {
        const candidate = path.resolve(path.dirname(filename), name);
        for (const extension of [".ts", ".tsx"]) if (fs.existsSync(candidate + extension)) return compile(candidate + extension);
      }
      return Module.prototype.require.call(mod, name);
    };
    const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: {
      esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    mod._compile(output, filename);
    return mod.exports;
  }
  return compile(path.join(root, file));
}
const guides = load("app/lib/buyingGuides.ts");
const now = new Date("2026-11-17T12:00:00Z");
const deliveryFile = "app/guides/supplement-prices-including-delivery/page.tsx";
const proteinFile = "app/guides/cost-per-25g-protein/page.tsx";

function product(target, { nutrition = true, price = 46.99, shipping = 3.99 } = {}) {
  const cnp = target.id === "865";
  const efectiv = target.id === "746";
  return {
    id: target.id, slug: target.slug, name: "Fixture " + target.slug, brand: "Fixture",
    category: target.id === guides.DELIVERY_PRODUCT.id ? "Creatine" : "Whey Protein", image: null,
    product_format: "powder", net_weight_g: target.grams, net_volume_ml: null, unit_count: null, unit_type: null,
    serving_count_verified: cnp ? 35 : 60, serving_size_g: cnp ? 65 : 30,
    protein_per_serving_g: cnp ? 47 : 25, creatine_per_serving_g: null,
    nutrition_verified: true, unit_pricing_verified: true, is_active: true, merged_into_product_id: null, merged_at: null,
    offers: [{
      id: 1, retailer_product_id: 101, price, shipping_cost: shipping, in_stock: true,
      last_checked_at: "2026-11-17T11:00:00Z", url: "https://retailer.example/item",
      retailer: { id: 10, name: "Jon's Supplements", slug: "jon-s-supplements" },
      variant_resolution: "resolved",
      product_variant: {
        id: target.variantId, product_id: target.id, display_name: (target.flavour || "") + " / " + target.grams + "g",
        flavour_label: target.flavour, size_value: target.grams, size_unit: "g", pack_count: 1,
        product_format: "powder", is_active: true,
        nutrition_override: nutrition ? {
          serving_count_verified: cnp ? 35 : efectiv ? 66 : 60, serving_size_g: cnp ? 65 : 30,
          protein_per_serving_g: cnp ? 47 : efectiv ? 27 : 25, nutrition_verified: true, unit_pricing_verified: true,
          source_type: "manufacturer_product_page", source_url: "https://manufacturer.example/label",
          evidence: "Synthetic reviewed-label fixture for exact flavour and pack.",
        } : {},
      },
    }],
  };
}
function deliveryProduct() {
  const row = product(guides.DELIVERY_PRODUCT, { nutrition: false, price: 22.99 });
  row.offers.push({
    ...row.offers[0], id: 2, retailer_product_id: 102, price: 24.99, shipping_cost: 0,
    retailer: { id: 11, name: "6 Pack Supplements", slug: "6-pack-supplements" },
  });
  return row;
}
function html(file, result, time = now) {
  const page = load(file);
  const Component = file === deliveryFile ? page.DeliveryGuideContent : page.ProteinGuideContent;
  return renderToStaticMarkup(React.createElement(Component, { result, now: time }));
}

test("delivery example uses the same reviewed variant, known delivery and exact penny totals", () => {
  const result = guides.deliveryExample([deliveryProduct()], now);
  assert.equal(result.reversed, true);
  assert.deepEqual(result.offers.map((offer) => offer.deliveredPrice.totalPrice), [24.99, 26.98]);
  assert.equal(result.variant.id, "2015");
  assert.equal(result.packLabel, "250g");
});
test("a changed price order is described neutrally, not as the historical reversal", () => {
  const row = deliveryProduct(); row.offers[0].price = 10;
  const result = { rows: [row], error: false };
  assert.equal(guides.deliveryExample(result.rows, now).reversed, false);
  assert.match(html(deliveryFile, result), /do not reverse the item-price order/);
});
test("unknown shipping, stale stock and out-of-stock offers never form a delivery comparison", () => {
  for (const patch of [{ shipping_cost: null }, { in_stock: false }, { last_checked_at: "2026-11-15T00:00:00Z" }, { last_checked_at: null }]) {
    const row = deliveryProduct(); Object.assign(row.offers[0], patch);
    const result = guides.deliveryExample([row], now);
    assert.equal(result.offers.length, 0);
    const rendered = html(deliveryFile, { rows: [row], error: false });
    assert.match(rendered, /No current matched example/);
    assert.doesNotMatch(rendered, /£24\.99|£26\.98/);
  }
});
test("different flavour, size, pack count, parent product and unresolved bindings cannot be combined", () => {
  for (const patch of [{ id: 999 }, { flavour_label: "Other flavour" }, { size_value: 500 }, { pack_count: 2 }, { product_id: 999 }, { is_active: false }]) {
    const row = deliveryProduct(); row.offers[1].product_variant = { ...row.offers[1].product_variant, ...patch };
    assert.equal(guides.deliveryExample([row], now).offers.length, 0);
  }
  const row = deliveryProduct(); row.offers[1].variant_resolution = "unresolved";
  assert.equal(guides.deliveryExample([row], now).offers.length, 0);
});
test("two listings from one retailer do not masquerade as two retailers", () => {
  const row = deliveryProduct(); row.offers[1].retailer = row.offers[0].retailer;
  assert.equal(guides.deliveryExample([row], now).offers.length, 0);
});
test("cached raw examples are rechecked for freshness at every render", () => {
  assert.equal(guides.deliveryExample([deliveryProduct()], now).offers.length, 2);
  const later = new Date("2026-11-18T12:00:00Z");
  assert.equal(guides.deliveryExample([deliveryProduct()], later).offers.length, 0);
  assert.doesNotMatch(html(proteinFile, { rows: [product(guides.PROTEIN_PRODUCTS[0])], error: false }, later), /£50\.98|£0\.85/);
});
test("protein examples use the existing verified denominator and round only the displayed result", () => {
  const row = product(guides.PROTEIN_PRODUCTS[0]);
  const second = product(guides.PROTEIN_PRODUCTS[1], { price: 65.99 });
  second.offers[0].id = 2;
  const rows = [row, second];
  const examples = guides.proteinExamples(rows, now);
  assert.deepEqual(examples.map((example) => example.totalProteinG), [1500, 1782]);
  assert.ok(Math.abs(examples[0].row.costPer25gProtein - 50.98 / 1500 * 25) < 1e-12);
  const rendered = html(proteinFile, { rows, error: false });
  assert.match(rendered, /£0\.85/); assert.match(rendered, /£0\.98/);
  assert.match(rendered, /1,500/); assert.match(rendered, /1,782/);
  assert.match(rendered, /£50\.98.*?1,500.*?25.*?£0\.85/s);
  assert.match(rendered, /different whey isolate products/);
});

test("reviewed protein variants accept an explicitly null unrelated creatine field", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/verified/variant-nutrition-reviewed-batch-1-v2.json"), "utf8"));
  for (const [index, target] of guides.PROTEIN_PRODUCTS.entries()) {
    const approved = manifest.changes.find((change) => change.variant_id === target.variantId);
    assert.equal(approved.product_id, target.id);
    const row = product(target, index === 0 ? { price: 81.53 } : { price: 64.99, shipping: 0 });
    row.offers[0].product_variant.nutrition_override = approved.after_nutrition_override;
    assert.equal(approved.after_nutrition_override.creatine_per_serving_g, null);
    const example = guides.proteinExamples([row], now)[0];
    assert.equal(example.nutritionApproved, true);
    const totalProtein = index === 0 ? 1584 : 1782, delivered = index === 0 ? 85.52 : 64.99;
    assert.equal(example.totalProteinG, totalProtein);
    assert.ok(Math.abs(example.row.costPer25gProtein - delivered / totalProtein * 25) < 1e-12);
    assert.match(html(proteinFile, { rows: [row], error: false }), index === 0 ? /£1\.35/ : /£0\.91/);
  }
});
test("product-level verification cannot stand in for exact-flavour nutrition evidence", () => {
  const row = product(guides.PROTEIN_PRODUCTS[0], { nutrition: false });
  const result = guides.proteinExamples([row], now)[0];
  assert.equal(result.nutritionApproved, false);
  assert.equal(result.row.costPer25gProtein, null);
  assert.equal(result.totalProteinG, null);
  const rendered = html(proteinFile, { rows: [row], error: false });
  assert.match(rendered, /Exact-flavour nutrition has not yet been verified/);
  assert.doesNotMatch(rendered, /<dt>Protein per serving|£0\.85/);
});
test("unreviewed, invalid and mismatched nutrition data never produce a protein unit cost", () => {
  for (const patch of [
    { nutrition_verified: false }, { source_url: null }, { evidence: "" },
    { serving_count_verified: 0 }, { serving_size_g: 0 }, { protein_per_serving_g: 100 },
    { protein_per_serving_g: null }, { serving_count_verified: 5 }, { source_type: "retailer_claim" },
    { creatine_per_serving_g: 1000 },
  ]) {
    const row = product(guides.PROTEIN_PRODUCTS[0]);
    Object.assign(row.offers[0].product_variant.nutrition_override, patch);
    assert.equal(guides.proteinExamples([row], now)[0].row.costPer25gProtein, null);
  }
});
test("another flavour cannot inherit the selected flavour's protein facts", () => {
  const row = product(guides.PROTEIN_PRODUCTS[0]);
  row.offers[0].product_variant.flavour_label = "Salted Caramel";
  assert.deepEqual(guides.proteinExamples([row], now), []);
});
test("protein cost stays blank without known delivery even with reviewed nutrition", () => {
  const row = product(guides.PROTEIN_PRODUCTS[0], { shipping: null });
  assert.equal(guides.proteinExamples([row], now)[0].row.costPer25gProtein, null);
  assert.doesNotMatch(html(proteinFile, { rows: [row], error: false }), /£0\.85|<dt>Delivered total/);
});
test("SSR includes full answers, exact variant links, check times and honest empty states", () => {
  const delivery = html(deliveryFile, { rows: [deliveryProduct()], error: false });
  assert.match(delivery, /higher product price can be cheaper after delivery/);
  assert.match(delivery, /\?variant=2015/);
  assert.match(delivery, /dateTime="2026-11-17T11:00:00Z"/);
  assert.match(delivery, /Free-delivery thresholds/);
  assert.match(html(deliveryFile, { rows: [], error: false }), /No current matched example/);
  assert.match(html(proteinFile, { rows: [], error: false }), /No price or protein amount has been estimated/);
  for (const href of ["/how-we-compare", "/deals", "/data-freshness"]) assert.ok(delivery.includes('href="' + href + '"'));
  const protein = html(proteinFile, { rows: [], error: false });
  for (const href of ["/whey-protein", "/whey-isolate", "/compare", "/how-we-compare"]) assert.ok(protein.includes('href="' + href + '"'));
  assert.match(protein, /rounded to the nearest penny/);
});
test("both approved guide bases are indexable with clean canonicals and noindex parameter states", async () => {
  for (const [file, route, title] of [
    [deliveryFile, guides.DELIVERY_GUIDE_PATH, "Supplement Prices Including Delivery: A UK Comparison"],
    [proteinFile, guides.PROTEIN_GUIDE_PATH, "Cost per 25g Protein: Compare UK Whey Prices Fairly"],
  ]) {
    const page = load(file);
    const metadata = await page.generateMetadata();
    assert.equal(metadata.title, title); assert.equal(metadata.alternates.canonical, route);
    assert.deepEqual(metadata.robots, { index: true, follow: true });
    assert.deepEqual((await page.generateMetadata({ searchParams: Promise.resolve({ sort: "price" }) })).robots, { index: false, follow: true });
    const script = html(file, { rows: [], error: false }).match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1];
    const schema = JSON.parse(script);
    assert.deepEqual(schema["@graph"].map((entry) => entry["@type"]), ["WebPage", "BreadcrumbList"]);
    assert.equal(schema["@graph"][0].url, "https://www.supplementscout.co.uk" + route);
    assert.doesNotMatch(script, /Article|FAQPage|ratingValue|datePublished|author/);
  }
});
test("guide failures abort instead of producing a success with missing examples", async () => {
  for (const file of [deliveryFile, proteinFile]) {
    const page = load(file, { "../../lib/buyingGuideData": { getBuyingGuideProducts: async () => ({ rows: [], error: true }) } });
    await assert.rejects(page.default(), /temporarily unavailable/);
  }
});
test("the bounded loader batches product selection and reuses the single strict variant resolver", async () => {
  const calls = [];
  const query = Object.fromEntries(["select", "in", "eq", "is"].map((name) => [name, (...args) => { calls.push([name, ...args]); return query; }]));
  query.limit = async (limit) => { calls.push(["limit", limit]); return { data: [product(guides.PROTEIN_PRODUCTS[0])], count: 1, error: null }; };
  let batches = 0;
  const loader = load("app/lib/buyingGuideData.ts", {
    "./supabase": { supabase: { from: () => query } },
    "./categoryComparisonVariants": { resolveCategoryComparisonVariants: async (rows, options) => { batches++; assert.equal(options.failOnError, true); return rows; } },
  });
  assert.equal((await loader.getBuyingGuideProducts(["one", "two"])).error, false);
  assert.equal(batches, 1); assert.deepEqual(calls.find(([method]) => method === "limit"), ["limit", 3]);
  assert.deepEqual(calls.find(([method]) => method === "in"), ["in", "slug", ["one", "two"]]);
});
test("partial reads, base-query failures and variant-query failures fail closed", async () => {
  for (const response of [{ data: [], count: 1, error: null }, { data: [], count: null, error: null }, { data: null, count: null, error: {} }]) {
    const query = {}; for (const name of ["select", "in", "eq", "is"]) query[name] = () => query;
    query.limit = async () => response;
    const loader = load("app/lib/buyingGuideData.ts", { "./supabase": { supabase: { from: () => query } } });
    assert.deepEqual(await loader.getBuyingGuideProducts(["one"]), { rows: [], error: true });
  }
  const query = {}; for (const name of ["select", "in", "eq", "is"]) query[name] = () => query;
  query.limit = async () => ({ data: [], count: 0, error: null });
  const loader = load("app/lib/buyingGuideData.ts", {
    "./supabase": { supabase: { from: () => query } },
    "./categoryComparisonVariants": { resolveCategoryComparisonVariants: async () => { throw new Error("read failed"); } },
  });
  assert.deepEqual(await loader.getBuyingGuideProducts(["one"]), { rows: [], error: true });
});
test("both approved routes are sitemap eligible exactly once and retain isolated shared caches", () => {
  const registry = load("app/lib/indexabilityLifecycle.ts");
  const sitemap = fs.readFileSync(path.join(root, "app/sitemap.ts"), "utf8");
  for (const route of [guides.DELIVERY_GUIDE_PATH, guides.PROTEIN_GUIDE_PATH]) {
    assert.equal(registry.getLifecycleStatus(route), "live_verified");
    assert.equal(registry.isLifecycleSitemapEligible(route), true);
    assert.equal(sitemap.split(route).length - 1, 1);
  }
  const sources = [deliveryFile, proteinFile].map((file) => fs.readFileSync(path.join(root, file), "utf8"));
  assert.match(sources[0], /"delivery-guide-example-v2"/);
  assert.match(sources[1], /"protein-guide-examples-v3"/);
  assert.ok(sources.every((source) => !source.includes('"use client"') && source.includes("createLifecycleDataLoader")));
  assert.ok(sources.every((source) => !/£(?:22\.99|24\.99|26\.98|50\.98|69\.98)/.test(source)));
});

test("the two distinct products share one loader call and retain their exact variant links", async () => {
  let selectedSlugs, calls = 0;
  const cacheKeys = [];
  const page = load(proteinFile, {
    "../../lib/buyingGuideData": { getBuyingGuideProducts: async (slugs) => { calls++; selectedSlugs = slugs; return { rows: [], error: false }; } },
    "next/cache": { unstable_cache: (read, keys, options) => { cacheKeys.push({ keys, options }); return read; } },
  });
  await page.default();
  assert.equal(calls, 1);
  assert.deepEqual(selectedSlugs, guides.PROTEIN_PRODUCTS.map(target => target.slug));
  assert.notEqual(guides.PROTEIN_PRODUCTS[0].id, guides.PROTEIN_PRODUCTS[1].id);
  assert.notEqual(guides.PROTEIN_PRODUCTS[0].variantId, guides.PROTEIN_PRODUCTS[1].variantId);
  assert.deepEqual(cacheKeys, [{ keys: ["lifecycle-hub-data-v1", guides.PROTEIN_GUIDE_PATH, "protein-guide-examples-v3"], options: { revalidate: 3600, tags: ["lifecycle-hub:" + guides.PROTEIN_GUIDE_PATH] } }]);
});

// TEST ONLY offers at a fixed clock; prices here are not evidence of live availability.
function reviewedProteinRows(prices = [81.53, 64.99], shipping = [3.99, 0]) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/verified/variant-nutrition-reviewed-batch-1-v2.json"), "utf8"));
  return guides.PROTEIN_PRODUCTS.map((target, index) => {
    const row = product(target, { price: prices[index], shipping: shipping[index] });
    row.offers[0].product_variant.nutrition_override = structuredClone(manifest.changes.find(c => c.variant_id === target.variantId).after_nutrition_override);
    return row;
  });
}

test("the selected exact pair uses its own reviewed records: 72×22 and 66×27, never powder grams", () => {
  assert.deepEqual(guides.PROTEIN_PRODUCTS, [
    { id: "178", slug: "applied-nutrition-iso-xp-18kg", variantId: "735", flavour: "Vanilla", grams: 1800 },
    { id: "746", slug: "efectiv-nutrition-grass-fed-whey-protein-isolate-2kg", variantId: "1196", flavour: "Strawberry Milkshake", grams: 2000 },
  ]);
  const rows = reviewedProteinRows(), examples = guides.proteinExamples(rows, now);
  assert.deepEqual(examples.map(e => [e.row.verifiedServingCount, e.row.proteinPerServingG, e.totalProteinG]), [[72, 22, 1584], [66, 27, 1782]]);
  assert.deepEqual(examples.map(e => e.row.bestOffer.deliveredPrice.totalPrice), [85.52, 64.99]);
  assert.ok(Math.abs(examples[0].row.costPer25gProtein - 85.52 / 1584 * 25) < 1e-12);
  assert.ok(Math.abs(examples[1].row.costPer25gProtein - 64.99 / 1782 * 25) < 1e-12);
  const rendered = html(proteinFile, { rows, error: false });
  for (const amount of [/£1\.35/, /£0\.91/, /£0\.44/, /1,584/, /1,782/]) assert.match(rendered, amount);
  for (const target of guides.PROTEIN_PRODUCTS) assert.ok(rendered.includes(`href="/product/${target.slug}?variant=${target.variantId}"`));
  assert.match(rendered, /efectiv[^<]*<\/strong> currently costs less/i);
  assert.match(rendered, /not a ranking of the whole UK market/);
  assert.match(rendered, /does not establish better quality, taste, effectiveness or suitability/);
});

test("current delivered prices can reverse or tie the result without changing the nutrition denominator", () => {
  const reversed = html(proteinFile, { rows: reviewedProteinRows([20, 64.99]), error: false });
  assert.match(reversed, /iso-xp[^<]*<\/strong> currently costs less/i);
  const tied = html(proteinFile, { rows: reviewedProteinRows([63.36, 71.28], [0, 0]), error: false });
  assert.match(tied, /same verified cost per 25 g/);
  assert.doesNotMatch(tied, /currently costs less/);
});

test("the comparison uses unrounded unit costs even when displayed prices both round to one pound", () => {
  const rows = reviewedProteinRows([63.36, 71.27], [0, 0]);
  const examples = guides.proteinExamples(rows, now);
  assert.ok(examples[1].row.costPer25gProtein < examples[0].row.costPer25gProtein);
  const rendered = html(proteinFile, { rows, error: false });
  assert.match(rendered, /efectiv[^<]*<\/strong> currently costs less/i);
  assert.match(rendered, /unrounded difference is less than one penny/);
  assert.doesNotMatch(rendered, /difference is £0\.00/);
});

test("either product loses only its own price calculation when shipping, stock or freshness fails", () => {
  for (const index of [0, 1]) for (const patch of [
    { shipping_cost: null }, { in_stock: false }, { last_checked_at: null },
    { last_checked_at: "invalid" }, { last_checked_at: "2026-11-15T11:00:00Z" },
    { last_checked_at: "2026-11-18T11:00:00Z" },
  ]) {
    const rows = reviewedProteinRows(); Object.assign(rows[index].offers[0], patch);
    const examples = guides.proteinExamples(rows, now);
    assert.equal(examples[index].row.costPer25gProtein, null);
    assert.ok(examples[1 - index].row.costPer25gProtein > 0);
    const rendered = html(proteinFile, { rows, error: false });
    assert.equal((rendered.match(/<dt>Cost per 25 g protein<\/dt>/g) || []).length, 1);
    assert.doesNotMatch(rendered, /currently costs less|same verified cost/);
  }
});

test("two stale offers retain the method without any stale price or invented ranking", () => {
  const rows = reviewedProteinRows();
  for (const row of rows) row.offers[0].last_checked_at = "2026-11-15T11:00:00Z";
  const rendered = html(proteinFile, { rows, error: false });
  assert.match(rendered, /delivered pack price ÷ total verified protein/);
  assert.doesNotMatch(rendered, /£85\.52|£64\.99|£1\.35|£0\.91|currently costs less|same verified cost/);
  assert.equal((rendered.match(/No fresh in-stock offer with known delivery/g) || []).length, 2);
});

test("changed product, slug, variant, flavour, pack or unresolved mapping cannot become a selected example", () => {
  for (const index of [0, 1]) {
    for (const patch of [{ id: "999" }, { slug: "wrong-product" }, { is_active: false }, { merged_at: "2026-11-01" }, { merged_into_product_id: "999" }]) {
      const rows = reviewedProteinRows(); Object.assign(rows[index], patch);
      assert.equal(guides.proteinExamples(rows, now).length, 1);
    }
    for (const patch of [{ id: "999" }, { product_id: "999" }, { flavour_label: "Other" }, { size_value: 500 }, { size_unit: "kg" }, { pack_count: 2 }, { is_active: false }]) {
      const rows = reviewedProteinRows(); Object.assign(rows[index].offers[0].product_variant, patch);
      assert.equal(guides.proteinExamples(rows, now).length, 1);
    }
    const rows = reviewedProteinRows(); rows[index].offers[0].variant_resolution = "unresolved";
    assert.equal(guides.proteinExamples(rows, now).length, 1);
    assert.doesNotMatch(html(proteinFile, { rows, error: false }), /currently costs less|same verified cost/);
  }
});

test("missing, unreviewed, malformed and other-pack provenance cannot be priced as the selected nutrition", () => {
  for (const index of [0, 1]) {
    for (const patch of [{ nutrition_verified: false }, { serving_count_verified: null }, { source_type: "retailer_claim" }, { source_url: "http://manufacturer.example/old" }, { source_url: null }, { evidence: "old" }, { serving_count_verified: 5 }, { protein_per_serving_g: null }, { protein_per_serving_g: 1000 }]) {
      const rows = reviewedProteinRows(); Object.assign(rows[index].offers[0].product_variant.nutrition_override, patch);
      assert.equal(guides.proteinExamples(rows, now)[index].row.costPer25gProtein, null, JSON.stringify({ index, patch }));
      assert.doesNotMatch(html(proteinFile, { rows, error: false }), /currently costs less|same verified cost/);
    }
    const rows = reviewedProteinRows(); rows[index].offers[0].product_variant.nutrition_override = structuredClone(rows[1 - index].offers[0].product_variant.nutrition_override);
    assert.equal(guides.proteinExamples(rows, now)[index].row.costPer25gProtein, null);
    rows[index].offers[0].product_variant.nutrition_override = {};
    assert.equal(guides.proteinExamples(rows, now)[index].row.costPer25gProtein, null);
  }
});

test("the lowest current known delivered price wins within a variant and OOS cannot undercut it", () => {
  const rows = reviewedProteinRows(), offer = rows[0].offers[0];
  rows[0].offers.push({ ...offer, id: 2, retailer: { id: 11, name: "Fixture alternate", slug: "fixture-alternate" }, price: 80, shipping_cost: 1 });
  rows[0].offers.push({ ...offer, id: 3, price: 1, shipping_cost: 0, in_stock: false });
  rows[0].offers.push({ ...offer, id: 4, price: 2, shipping_cost: null });
  const example = guides.proteinExamples(rows, now)[0];
  assert.equal(example.row.bestOffer.id, "2");
  assert.equal(example.row.bestOffer.deliveredPrice.totalPrice, 81);
  assert.ok(Math.abs(example.row.costPer25gProtein - 81 / 1584 * 25) < 1e-12);
});

module.exports = { load, product, deliveryProduct, guides, now, html, deliveryFile, proteinFile };
