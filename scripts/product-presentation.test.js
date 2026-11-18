const assert = require("node:assert/strict");
const fs = require("fs");
const Module = require("module");
const path = require("path");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function loadProductPresentationModule() {
  const filename = path.join(
    process.cwd(),
    "app",
    "lib",
    "productPresentation.ts"
  );
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const mod = new Module(filename, module);

  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(outputText, filename);

  return mod.exports;
}

function loadReviewedPreWorkoutFactsComponent() {
  const factsFilename = path.join(process.cwd(), "app", "lib", "reviewedPreWorkoutFacts.ts");
  const componentFilename = path.join(process.cwd(), "app", "components", "ReviewedPreWorkoutFacts.tsx");
  const compile = (filename, jsx) => ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}),
    },
    fileName: filename,
  }).outputText;
  const factsModule = new Module(factsFilename, module);
  factsModule.filename = factsFilename;
  factsModule.paths = Module._nodeModulePaths(path.dirname(factsFilename));
  factsModule._compile(compile(factsFilename, false), factsFilename);

  const componentModule = new Module(componentFilename, module);
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (parent === componentModule && request === "../lib/reviewedPreWorkoutFacts") {
      return factsModule.exports;
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    componentModule.filename = componentFilename;
    componentModule.paths = Module._nodeModulePaths(path.dirname(componentFilename));
    componentModule._compile(compile(componentFilename, true), componentFilename);
  } finally {
    Module._load = originalLoad;
  }
  return componentModule.exports.default;
}

const {
  buildProductKeyFacts,
  buildProductMetadataDescription,
  buildProductSummary,
  isMyproteinClearWheyProduct,
  isStandardAbeProduct,
  selectedVariantPresentation,
} = loadProductPresentationModule();

function product(overrides = {}) {
  return {
    id: "999",
    name: "Example Complete Protein",
    brand: "Example Nutrition",
    category: "Protein",
    product_format: "powder",
    net_weight_g: null,
    net_volume_ml: null,
    serving_count_verified: null,
    unit_count: null,
    unit_type: null,
    serving_size_g: null,
    serving_size_ml: null,
    protein_per_serving_g: null,
    creatine_per_serving_g: null,
    nutrition_verified: false,
    ...overrides,
  };
}

test("standard ABE buying context requires the exact owner-reviewed product identity", () => {
  const abe = product({ id: "215", slug: "applied-nutrition-abe-ultimate-pre-workout-315g", name: "Applied Nutrition ABE Ultimate Pre-Workout 315g", brand: "Applied Nutrition", category: "Pre Workout", product_format: "powder" });
  assert.equal(isStandardAbeProduct(abe), true);
  assert.equal(isStandardAbeProduct({ ...abe, id: 215 }), true);
  assert.equal(isStandardAbeProduct({ ...abe, product_format: null }), true, "the exact canonical product currently has a legacy null format; no catalogue write is needed");
  for (const override of [
    { id: "481", slug: "applied-nutrition-abe-pump-500g", name: "Applied Nutrition ABE Pump 500g" },
    { id: "1467", slug: "applied-nutrition-abe-ultimate-pre-workout-shot" },
    { id: "900", name: "Applied Nutrition ABE Energy RTD Drink" },
    { slug: null }, { slug: "copied-abe-slug" }, { id: "999" },
    { name: "Applied Nutrition ABE Ultimate Pre-Workout 330g" },
    { brand: "Another brand" }, { category: "Whey Protein" }, { product_format: "liquid" },
  ]) assert.equal(isStandardAbeProduct({ ...abe, ...override }), false, JSON.stringify(override));
});

// Exercise the actual async page and its existing offer/fact renderers. These
// fixtures are synthetic regression inputs, never production price evidence.
async function renderProductPage({ productOverrides = {}, variantId = "1672", variantOverrides = {}, extraVariants = [], extraOffers = [], enrichmentOverrides = {}, offerOverrides = {}, empty = false, failure = false, facts = true } = {}) {
  const base = product({ id: "215", slug: "applied-nutrition-abe-ultimate-pre-workout-315g", name: "Applied Nutrition ABE Ultimate Pre-Workout 315g", brand: "Applied Nutrition", category: "Pre Workout", product_format: "powder", net_weight_g: 315, is_active: true, merged_into_product_id: null, image: null, unit_pricing_verified: false, ...productOverrides });
  const variant = { id: "1672", product_id: "215", display_name: "Baddy Berry / 315g", flavour_label: "Baddy Berry", size_value: 315, size_unit: "g", pack_count: 1, product_format: "powder", is_default: false, is_active: true, nutrition_override: {}, ...variantOverrides };
  const offer = { id: "11", retailer_product_id: "101", product_variant_id: "1672", retailer_id: "10", price: 17, shipping_cost: 4, in_stock: true, last_checked_at: new Date().toISOString(), url: "https://retailer.example/abe", retailer: { id: "10", name: "Fixture retailer", slug: "fixture", logo: null, website: "https://retailer.example" }, ...offerOverrides };
  const reads = [];
  const variants = [variant, ...extraVariants];
  const pageOffers = [offer, ...extraOffers];
  const client = { from(table) {
    reads.push(table);
    const filters = {};
    const query = { select() { return this; }, eq(key, value) { filters[key] = value; return this; }, in() { return this; }, order() { return this; }, maybeSingle() { return Promise.resolve({ data: base, error: null }); }, then(resolve, reject) {
      const data = table === "offers" ? (empty || failure ? [] : pageOffers) : table === "product_variants" ? variants.filter(v => filters.id === undefined || String(v.id) === String(filters.id)) : table === "retailer_products" ? pageOffers.map(o => ({ id: o.retailer_product_id, product_variant: { ...variants.find(v => String(v.id) === String(o.product_variant_id)), ...enrichmentOverrides } })) : [];
      return Promise.resolve({ data: failure && table !== "products" ? null : data, error: failure ? { message: "Fixture source failure" } : null }).then(resolve, reject);
    } }; return query;
  } };
  const modules = new Map();
  function compile(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const mod = new Module(filename, module); modules.set(filename, mod);
    mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => {
      if (name === "server-only") return {};
      if (name.endsWith("/supabase")) return { supabase: client };
      if (name.endsWith("/supabaseAdmin")) return { supabaseAdmin: client };
      if (name.endsWith("/betterValueAlternatives")) return { getBetterValueAlternatives: async () => ({ basis: null, rows: [] }) };
      if (name.endsWith("/reviewedPreWorkoutFacts.server")) return { loadAppliedPreWorkoutFacts: async () => facts ? new Map([["1672", { productId: "215", productVariantId: "1672", caffeineFreeConfirmed: false, facts: [{ key: "caffeine", informationState: "present_with_amount", amountPerServingMg: 200, servingSizeValue: 10.5, servingSizeUnit: "g", servingBasisText: "Fixture exact-variant serving of 10.5 g", ingredientForm: null, ingredientRatio: null, sourceKinds: ["manufacturer_source"] }] }]]) : new Map() };
      if (name.endsWith("/PriceHistoryChart") || name.endsWith("/SaveToMySupplementsButton")) return { __esModule: true, default: () => null };
      if (name === "next/navigation") return { notFound() { throw new Error("404"); }, permanentRedirect() { throw new Error("redirect"); } };
      if (name === "next/image") return { __esModule: true, default: () => null };
      if (name === "next/link") return { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { ...props, href: typeof href === "string" ? href : href.pathname + "?" + new URLSearchParams(href.query) }, children) };
      if (name.startsWith(".")) {
        const candidate = path.resolve(path.dirname(filename), name);
        for (const ext of [".ts", ".tsx"]) if (fs.existsSync(candidate + ext)) return compile(candidate + ext);
      }
      return Module.prototype.require.call(mod, name);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
    return mod.exports;
  }
  const page = compile(path.join(process.cwd(), "app/product/[id]/page.tsx"));
  const props = { params: Promise.resolve({ id: base.slug }), searchParams: Promise.resolve({ variant: variantId }) };
  const metadata = await page.generateMetadata(props);
  return { html: renderToStaticMarkup(await page.default(props)), metadata, reads };
}

test("ABE buying copy preserves exact variant, dynamic delivered prices, tracked links and metadata", async () => {
  const a = await renderProductPage();
  assert.match(a.html, /Compare UK retailer offers for the standard ABE/);
  assert.match(a.html, /Standard ABE or ABE Pump\?/);
  assert.match(a.html, /Baddy Berry \/ 315g/);
  assert.match(a.html, /200 mg[\s\S]*10\.5 g/);
  assert.match(a.html, /£21\.00/);
  assert.match(a.html, /\/go\/11\?source=product_best_offer/);
  assert.match(a.html, /href="\/compare\?left=215&amp;right=481"/);
  assert.match(a.html, /href="\/product\/applied-nutrition-abe-pump-500g"/);
  assert.equal(a.metadata.title, "Applied Nutrition ABE Ultimate Pre-Workout 315g");
  assert.equal(a.metadata.alternates.canonical, "https://www.supplementscout.co.uk/product/applied-nutrition-abe-ultimate-pre-workout-315g");
  assert.equal(a.metadata.robots, undefined);
  assert.doesNotMatch(a.html, /£[\d.]+ per serving|30 verified servings/);
  const b = await renderProductPage({ offerOverrides: { price: 23, shipping_cost: 5 } });
  assert.match(b.html, /£28\.00/);
  assert.equal(b.metadata.description, a.metadata.description);
  assert.deepEqual(b.reads, a.reads, "copy adds no query or per-retailer query");
});

test("ABE content does not turn missing delivery, stale offers or failed sources into a current price", async () => {
  const unknown = await renderProductPage({ offerOverrides: { shipping_cost: null }, facts: false });
  assert.match(unknown.html, /[Dd]elivery[^<]*unknown|[Uu]nknown delivery/);
  assert.match(unknown.html, /No reviewed ingredient facts are available for this exact/);
  assert.doesNotMatch(unknown.html, /200 mg|£21\.00/);
  for (const state of [{ empty: true }, { failure: true }, { offerOverrides: { last_checked_at: "2000-01-01T00:00:00Z" } }, { offerOverrides: { in_stock: false } }]) {
    const { html } = await renderProductPage(state);
    assert.match(html, /Price unavailable/);
    assert.doesNotMatch(html, /href="\/go\/11|£21\.00|"@type":"Product"/);
  }
});

test("ABE context cannot leak onto Pump or unrelated cards", async () => {
  for (const overrides of [
    { id: "481", slug: "applied-nutrition-abe-pump-500g", name: "Applied Nutrition ABE Pump 500g" },
    { id: "12", slug: "per4m-whey-protein-2kg", name: "Per4m Whey Protein 2kg", brand: "Per4m", category: "Whey Protein" },
    { id: "999", slug: "another-product", name: "Another product" },
  ]) {
    const { html } = await renderProductPage({ productOverrides: overrides, variantId: undefined, facts: false });
    assert.doesNotMatch(html, /Standard ABE or ABE Pump\?|Compare UK retailer offers for the standard ABE|Compare ABE and ABE Pump/);
  }
});

const clearWheyIdentity = { id: "1470", slug: "myprotein-clear-whey-protein-isolate", name: "Myprotein Clear Whey Protein Isolate", brand: "Myprotein", category: "Whey Protein", product_format: "powder" };
const clearWheyMetadataDescription = "Compare Myprotein Clear Whey Protein Isolate prices in the UK. Check available flavours, exact pack sizes, retailer offers and known delivery costs.";
function renderClearWhey(options = {}) {
  const { productOverrides, variantOverrides, offerOverrides, ...rest } = options;
  return renderProductPage({
    variantId: null, facts: false,
    productOverrides: { ...clearWheyIdentity, net_weight_g: null, ...productOverrides },
    variantOverrides: { id: "4649", product_id: "1470", display_name: "Peach Tea / 244 g", flavour_label: "Peach Tea", size_value: 244, ...variantOverrides },
    offerOverrides: { product_variant_id: "4649", ...offerOverrides },
    ...rest,
  });
}
function clearWheySummary(html) {
  return html.match(/<h2[^>]*>Product summary<\/h2>([\s\S]*?)<\/section>/)?.[1] || "";
}

test("Clear Whey copy requires every exact catalogue identity field, including powder format", () => {
  assert.equal(isMyproteinClearWheyProduct(clearWheyIdentity), true);
  assert.equal(isMyproteinClearWheyProduct({ ...clearWheyIdentity, id: 1470 }), true);
  for (const override of [{ id: "1471" }, { slug: null }, { slug: "myprotein-impact-whey-protein" }, { name: "Myprotein Impact Whey Isolate" }, { brand: "Another brand" }, { category: "Vegan Protein" }, { product_format: "liquid" }, { product_format: null }]) {
    assert.equal(isMyproteinClearWheyProduct({ ...clearWheyIdentity, ...override }), false, JSON.stringify(override));
  }
});

test("Clear Whey server summary reports two exact packs as one retailer, without assuming 500g or nutrition", async () => {
  const orange = { id: "4633", product_id: "1470", display_name: "Orange Mango / 261 g", flavour_label: "Orange Mango", size_value: 261, size_unit: "g", pack_count: 1, product_format: "powder", nutrition_override: {}, is_active: true, is_default: false };
  const extra = { id: "12", retailer_product_id: "102", product_variant_id: "4633", retailer_id: "10", price: 19, shipping_cost: 4, in_stock: true, last_checked_at: new Date().toISOString(), retailer: { id: "10", name: "Fixture retailer", slug: "fixture" }, url: "https://retailer.example/orange" };
  const result = await renderClearWhey({ extraVariants: [orange], extraOffers: [extra] });
  const summary = clearWheySummary(result.html);
  assert.match(summary, /whey isolate protein powder/);
  assert.match(summary, /Peach Tea \/ 244 g; Orange Mango \/ 261 g/);
  assert.match(summary, /1 tracked UK retailer\. This is a single-retailer listing/);
  assert.match(summary, /Nutrition has not been verified for this exact flavour and pack/);
  assert.match(summary, /href="\/whey-isolate"/);
  assert.match(result.html, /href="\/go\/11\?source=product_best_offer"/);
  assert.match(result.html, /href="\/go\/11\?source=product_offer_list"/);
  const selectedOrange = await renderClearWhey({ variantId: "4633", extraVariants: [orange], extraOffers: [extra] });
  assert.match(selectedOrange.html, /href="\/go\/12\?source=product_best_offer"/);
  assert.doesNotMatch(clearWheySummary(selectedOrange.html), /Peach Tea \/ 244 g/);
  assert.doesNotMatch(result.html, /500\s?g|£[\d.]+ per 25g|"@type":"Product"/);
  assert.equal((result.html.match(/<h1\b/g) || []).length, 1);
});

test("Clear Whey copy reuses dynamic totals and preserves metadata while exact Product schema stays variant-bound", async () => {
  const a = await renderClearWhey({ variantId: "4649" });
  const b = await renderClearWhey({ variantId: "4649", offerOverrides: { price: 31, shipping_cost: 6 } });
  assert.match(a.html, /£21\.00/);
  assert.match(b.html, /£37\.00/);
  assert.deepEqual(b.metadata, a.metadata);
  assert.equal(a.metadata.title, clearWheyIdentity.name);
  assert.equal(a.metadata.description, clearWheyMetadataDescription);
  assert.equal(a.metadata.openGraph.description, clearWheyMetadataDescription);
  assert.equal(a.metadata.twitter.description, clearWheyMetadataDescription);
  assert.equal(a.metadata.alternates.canonical, "https://www.supplementscout.co.uk/product/myprotein-clear-whey-protein-isolate");
  assert.equal(a.metadata.robots, undefined);
  assert.match(a.html, /"@type":"Product"/);
  assert.match(a.html, /is a whey isolate protein powder/);
  assert.deepEqual(b.reads, a.reads, "copy adds no data call or per-retailer read");
});

test("Clear Whey approved metadata description requires the complete exact identity and leaves summary unchanged", () => {
  const p = product(clearWheyIdentity);
  assert.equal(buildProductMetadataDescription(p), clearWheyMetadataDescription);
  assert.equal(buildProductSummary(p), "Myprotein Clear Whey Protein Isolate is a supplement.");
  for (const override of [{ id: "999" }, { slug: undefined }, { slug: null }, { slug: "another-slug" }, { name: "Myprotein Impact Whey Isolate" }, { brand: "Another brand" }, { category: "Vegan Protein" }, { product_format: null }, { product_format: "liquid" }]) {
    const other = { ...p, ...override };
    assert.equal(buildProductMetadataDescription(other), buildProductSummary(other), JSON.stringify(override));
  }
});

test("generateMetadata preserves ABE, PER4M and other products across description, Open Graph and Twitter", async () => {
  for (const identity of [
    { id: "215", slug: "applied-nutrition-abe-ultimate-pre-workout-315g", name: "Applied Nutrition ABE Ultimate Pre-Workout 315g", brand: "Applied Nutrition", category: "Pre Workout" },
    { id: "12", slug: "per4m-whey-protein-2kg", name: "Per4m Whey Protein 2kg", brand: "Per4m" },
    { id: "1469", slug: "myprotein-impact-whey-isolate-powder", name: "Myprotein Impact Whey Isolate Powder" },
    { id: "338", slug: "applied-nutrition-clear-whey-protein-875g", name: "Applied Nutrition Clear Whey Protein 875g", brand: "Applied Nutrition" },
    { id: "999", slug: "unrelated-product", name: "Unrelated Product", brand: "Example Nutrition" },
  ]) {
    const expected = buildProductSummary(product({ ...clearWheyIdentity, ...identity }));
    const { metadata, html } = await renderClearWhey({ productOverrides: identity });
    assert.equal(metadata.description, expected, identity.slug);
    assert.equal(metadata.openGraph.description, expected);
    assert.equal(metadata.twitter.description, expected);
    assert.equal(metadata.title, identity.name);
    assert.equal(metadata.alternates.canonical, `https://www.supplementscout.co.uk/product/${identity.slug}`);
    assert.doesNotMatch(html, /Compare Myprotein Clear Whey Protein Isolate prices in the UK/);
  }
  const { html } = await renderClearWhey({ variantId: "4649" });
  assert.match(clearWheySummary(html), /is a whey isolate protein powder/);
  assert.doesNotMatch(html, /Compare Myprotein Clear Whey Protein Isolate prices in the UK/);
});

test("Clear Whey current coverage excludes stale, OOS, missing-price and failed-source offers", async () => {
  for (const options of [{ empty: true }, { failure: true }, { offerOverrides: { in_stock: false } }, { offerOverrides: { last_checked_at: "2000-01-01T00:00:00Z" } }, { offerOverrides: { price: null } }]) {
    const result = await renderClearWhey(options), summary = clearWheySummary(result.html);
    assert.match(summary, /No current, identified flavour-and-pack offer is available/);
    assert.doesNotMatch(summary, /Currently listed|1 tracked|Peach Tea \/ 244 g/);
    assert.doesNotMatch(result.html, /£21\.00|"@type":"Product"/);
    assert.match(summary, /whey isolate protein powder/);
  }
  const unknown = await renderClearWhey({ offerOverrides: { shipping_cost: null } });
  assert.match(clearWheySummary(unknown.html), /When delivery is unknown/);
  assert.match(unknown.html, /Product price/);
  assert.doesNotMatch(unknown.html, /£21\.00|£[\d.]+ per 25g/);
});

test("Clear Whey summary never guesses a label from an unresolved, wrong or incomplete mapped pack", async () => {
  for (const enrichmentOverrides of [{ id: "999" }, { size_value: null }, { size_unit: null }, { pack_count: null }, { product_format: "liquid" }, { is_default: true }]) {
    const { html } = await renderClearWhey({ enrichmentOverrides });
    assert.match(clearWheySummary(html), /No current, identified flavour-and-pack offer is available/);
    assert.doesNotMatch(clearWheySummary(html), /Currently listed|1 tracked/);
  }
});

test("Clear Whey selection does not borrow another pack and multiple retailers do not become a single-store claim", async () => {
  const secondStore = { id: "12", retailer_product_id: "102", product_variant_id: "4649", retailer_id: "20", price: 22, shipping_cost: 4, in_stock: true, last_checked_at: new Date().toISOString(), retailer: { id: "20", name: "Second fixture retailer", slug: "second" }, url: "https://retailer.example/second" };
  const result = await renderClearWhey({ variantId: "4649", extraOffers: [secondStore] });
  assert.match(clearWheySummary(result.html), /2 tracked UK retailers/);
  assert.doesNotMatch(clearWheySummary(result.html), /single-retailer|Orange Mango|261 g|500 g/);
});

test("Clear Whey description cannot leak to other Myprotein products, brands, ABE or PER4M", async () => {
  for (const productOverrides of [
    { id: "100", slug: "myprotein-impact-whey-protein", name: "Myprotein Impact Whey Protein" },
    { id: "101", slug: "myprotein-impact-whey-isolate", name: "Myprotein Impact Whey Isolate" },
    { id: "338", slug: "applied-nutrition-clear-whey-protein-875g", name: "Applied Nutrition Clear Whey Protein 875g", brand: "Applied Nutrition" },
    { id: "215", slug: "applied-nutrition-abe-ultimate-pre-workout-315g", name: "Applied Nutrition ABE Ultimate Pre-Workout 315g", brand: "Applied Nutrition", category: "Pre Workout" },
    { id: "12", slug: "per4m-whey-protein-2kg", name: "Per4m Whey Protein 2kg", brand: "Per4m" },
    { product_format: null },
  ]) {
    const { html } = await renderClearWhey({ productOverrides });
    assert.doesNotMatch(clearWheySummary(html), /Currently listed for this selection|This is a single-retailer listing|Flavours can have different pack weights/);
  }
});

test("buildProductSummary uses only neutral identity and verified facts", () => {
  assert.equal(
    buildProductSummary(
      product({
        name: "Example Formula",
        category: "Whey Protein",
        net_weight_g: 600,
        serving_count_verified: 20,
      })
    ),
    "Example Formula is a protein powder from Example Nutrition. This 600 g product contains 20 verified servings."
  );
});

test("carton key facts expose per-bar packaging and total mass without changing single/unknown packs", () => {
  const base = product({ product_format: "bar", net_weight_g: 660 });
  const variant = { size_value: 55, size_unit: "g", pack_count: 12, product_format: "bar" };
  const facts = buildProductKeyFacts(base, variant);
  assert.deepEqual(facts.find(f=>f.label === "Net weight"), { label: "Net weight", value: "660 g" });
  assert.deepEqual(facts.find(f=>f.label === "Pack size"), { label: "Pack size", value: "12 × 55 g (660 g total)" });
  for (const pack_count of [1, null, undefined, 0, -1, 1.5]) {
    const single = buildProductKeyFacts(product({ product_format: "bar", net_weight_g: 55 }), { ...variant, pack_count });
    assert.equal(single.find(f=>f.label === "Net weight").value, "55 g");
    assert.equal(single.some(f=>f.label === "Pack size"), false);
  }
  assert.equal(buildProductKeyFacts(base, { ...variant, size_unit: "ml" }).some(f=>f.label === "Pack size"), false);
  const page = fs.readFileSync("app/product/[id]/page.tsx", "utf8");
  assert.match(page, /buildProductKeyFacts\(selectedPresentation, selectedVariant\)/);
  assert.equal((page.match(/size_unit,\s*pack_count,/g) || []).length, 3);
});

test("summary falls back to category when format is unavailable", () => {
  assert.equal(
    buildProductSummary(
      product({ name: "Example Formula", product_format: null })
    ),
    "Example Formula is a protein supplement from Example Nutrition."
  );
});

test("summary remains complete without weight or servings", () => {
  assert.equal(
    buildProductSummary(product()),
    "Example Complete Protein is a supplement from Example Nutrition."
  );
});

test("summary handles missing brand and category without nullish text", () => {
  const summary = buildProductSummary(
    product({ brand: null, category: null, product_format: null })
  );

  assert.equal(summary, "Example Complete Protein is a supplement.");
  assert.doesNotMatch(summary, /null|undefined/i);
});

test("summary ignores legacy servings, description claims, and values in name", () => {
  const summary = buildProductSummary(
    product({
      name: "Example Powder 5kg 100 Servings",
      servings: 100,
      description: "Cure anxiety\\n✓ detox",
    })
  );

  assert.equal(
    summary,
    "Example Powder 5kg 100 Servings is a protein supplement from Example Nutrition."
  );
  assert.doesNotMatch(summary, /cure|anxiety|detox|✓|\\n/i);
});

test("category and format mappings use natural supplement language", () => {
  const cases = [
    [
      { name: "Example Formula", category: "Whey Protein", product_format: "powder" },
      "Example Formula is a protein powder from Example Nutrition.",
    ],
    [
      { name: "Example Formula", category: "Creatine", product_format: "powder" },
      "Example Formula is a creatine powder from Example Nutrition.",
    ],
    [
      { name: "Example Formula", category: "Pre Workout", product_format: "powder" },
      "Example Formula is a pre-workout powder from Example Nutrition.",
    ],
    [
      { name: "Daily Formula", category: "Vitamins", product_format: "capsule" },
      "Daily Formula is a vitamin supplement in capsule form from Example Nutrition.",
    ],
    [
      { name: "Daily Formula", category: "Vitamins", product_format: "tablet" },
      "Daily Formula is a vitamin supplement in tablet form from Example Nutrition.",
    ],
    [
      { name: "Example Formula", category: "Health Supplements", product_format: "liquid" },
      "Example Formula is a liquid supplement from Example Nutrition.",
    ],
    [
      { name: "Steel Shaker", category: "Accessories", product_format: null },
      "Steel Shaker is an accessory from Example Nutrition.",
    ],
    [
      { name: "Training T-Shirt", category: "Clothing", product_format: null },
      "Training T-Shirt is a clothing item from Example Nutrition.",
    ],
    [
      { name: "Training Back Pack", category: "Health Supplements", product_format: null },
      "Training Back Pack is an accessory from Example Nutrition.",
    ],
    [
      { name: "Cream of Rice", category: "Health Supplements", product_format: "powder" },
      "Cream of Rice is a food product from Example Nutrition.",
    ],
    [
      { name: "Daily Formula", category: "Health Supplements", product_format: null },
      "Daily Formula is a health supplement from Example Nutrition.",
    ],
  ];

  for (const [overrides, expected] of cases) {
    assert.equal(buildProductSummary(product(overrides)), expected);
  }
});

test("placeholder Unknown brand is omitted", () => {
  assert.equal(
    buildProductSummary(product({ name: "Example Formula", brand: "Unknown" })),
    "Example Formula is a protein powder."
  );
  assert.equal(
    buildProductKeyFacts(product({ brand: "Unknown", product_format: null })).some(
      (fact) => fact.label === "Brand"
    ),
    false
  );
});

test("summaries avoid legacy awkward category phrases", () => {
  for (const overrides of [
    { name: "Daily Formula", category: "Vitamins", product_format: null },
    { name: "Workout Formula", category: "Pre Workout", product_format: null },
  ]) {
    const summary = buildProductSummary(product(overrides));

    assert.doesNotMatch(summary, /Vitamins product|Pre Workout product/);
  }
});

test("buildProductKeyFacts formats all supported verified values", () => {
  assert.deepEqual(
    buildProductKeyFacts(
      product({
        product_format: "powder",
        net_weight_g: 1800,
        net_volume_ml: 500,
        serving_count_verified: 20,
        serving_size_g: 30,
        unit_count: 180,
        unit_type: "tablet",
        protein_per_serving_g: 24,
        creatine_per_serving_g: 5,
        nutrition_verified: true,
      })
    ),
    [
      { label: "Brand", value: "Example Nutrition" },
      { label: "Category", value: "Protein" },
      { label: "Product format", value: "Powder" },
      { label: "Net weight", value: "1.8 kg" },
      { label: "Net volume", value: "500 ml" },
      { label: "Verified servings", value: "20 servings" },
      { label: "Serving size", value: "30 g" },
      { label: "Unit count", value: "180 tablets" },
      { label: "Protein per serving", value: "24 g protein per serving" },
      { label: "Creatine per serving", value: "5 g creatine per serving" },
    ]
  );
});

test("partial Key facts omit unavailable rows", () => {
  assert.deepEqual(buildProductKeyFacts(product({ product_format: null })), [
    { label: "Brand", value: "Example Nutrition" },
    { label: "Category", value: "Protein" },
  ]);
});

test("nutrition facts require nutrition_verified", () => {
  const unverified = buildProductKeyFacts(
    product({
      protein_per_serving_g: 24,
      creatine_per_serving_g: 5,
      nutrition_verified: false,
    })
  );
  const verified = buildProductKeyFacts(
    product({
      protein_per_serving_g: 24,
      creatine_per_serving_g: 5,
      nutrition_verified: true,
    })
  );

  assert.equal(unverified.some((fact) => fact.label.includes("per serving")), false);
  assert.equal(verified.some((fact) => fact.value === "24 g protein per serving"), true);
  assert.equal(verified.some((fact) => fact.value === "5 g creatine per serving"), true);
});

test("selected variant presentation is the only source for variant-sensitive facts", () => {
  const baseProduct = product({
    product_format: "powder",
    net_weight_g: 500,
    net_volume_ml: 750,
    serving_count_verified: 88,
    serving_size_g: 5.68,
    serving_size_ml: 10,
    unit_count: 88,
    unit_type: "scoop",
    protein_per_serving_g: 20,
    creatine_per_serving_g: 3,
    nutrition_verified: true,
  });
  const selected = selectedVariantPresentation(baseProduct, {
    product_format: "powder",
    net_weight_g: 600,
    serving_count_verified: 100,
    serving_size_g: 6,
    protein_per_serving_g: 27,
    creatine_per_serving_g: 5,
    nutrition_verified: true,
  });
  const facts = buildProductKeyFacts(selected);

  assert.equal(facts.some((fact) => fact.value === "100 servings"), true);
  assert.equal(facts.some((fact) => fact.value === "27 g protein per serving"), true);
  assert.equal(facts.some((fact) => fact.value === "5 g creatine per serving"), true);
  assert.equal(facts.some((fact) => /88 servings|20 g protein/.test(fact.value)), false);
  assert.equal(facts.some((fact) => fact.label === "Net volume"), false);
  assert.equal(facts.some((fact) => fact.label === "Unit count"), false);
  assert.match(
    buildProductSummary(selected, { allowCuratedSummary: false }),
    /600 g product contains 100 verified servings/
  );
});

test("selected variant presentation stays fail-closed when protein proof is missing", () => {
  const selected = selectedVariantPresentation(
    product({ protein_per_serving_g: 24, nutrition_verified: true }),
    {
      product_format: "powder",
      net_weight_g: 500,
      serving_count_verified: 20,
      serving_size_g: 25,
      protein_per_serving_g: null,
      creatine_per_serving_g: null,
      nutrition_verified: true,
    }
  );

  assert.equal(
    buildProductKeyFacts(selected).some((fact) => fact.label === "Protein per serving"),
    false
  );
});

test("PDP derives facts and scoped offers from the requested selected variant", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app", "product", "[id]", "page.tsx"),
    "utf8"
  );

  assert.match(source, /requestedVariant[\s\S]+offer\.product_variant_id[\s\S]+requestedVariant\.id/);
  assert.match(source, /const selectedVariant = requestedVariant \|\|/);
  assert.match(source, /getEffectiveNutritionMetrics\(\s*product,\s*selectedVariant\s*\)/);
  assert.match(source, /selectedVariantPresentation\(product, effectiveMetrics\)/);
  assert.match(source, /buildProductKeyFacts\(selectedPresentation, selectedVariant\)/);
  assert.match(source, /"Protein per serving"/);
  assert.doesNotMatch(source, /buildProductKeyFacts\(product\)/);
});

test("Key facts never contain null or undefined", () => {
  const facts = buildProductKeyFacts(
    product({
      brand: null,
      category: undefined,
      product_format: null,
      unit_count: 180,
      unit_type: null,
    })
  );

  assert.equal(JSON.stringify(facts).includes("null"), false);
  assert.equal(JSON.stringify(facts).includes("undefined"), false);
});

test("exact GYM HIGH id and name activate the confirmed summary", () => {
  const expected =
    "GYM HIGH Whey Pro Synergy Dynamic is a 600 g protein powder made with 50% whey isolate and 50% micellar casein. It provides 20 servings and includes added probiotics.";

  assert.equal(
    buildProductSummary(
      product({ id: "510", name: "GYM HIGH Whey Pro Synergy Dynamic 600g" })
    ),
    expected
  );
  assert.notEqual(
    buildProductSummary(
      product({ id: "510", name: "GYM HIGH Whey Pro Synergy Dynamic 1kg" })
    ),
    expected
  );
  assert.notEqual(
    buildProductSummary(
      product({ id: "511", name: "GYM HIGH Whey Pro Synergy Dynamic 600g" })
    ),
    expected
  );
});

test("raw retailer description cannot enter summary or metadata", () => {
  const input = product({
    description: "Treat anxiety\\n✔ Fat burning detox claims",
  });
  const summary = buildProductSummary(input);
  const metadata = buildProductMetadataDescription(input);

  assert.doesNotMatch(summary, /treat|anxiety|fat burning|detox|✔|\\n/i);
  assert.doesNotMatch(metadata, /treat|anxiety|fat burning|detox|✔|\\n/i);
});

test("metadata descriptions stay within limit without cutting a word", () => {
  const metadata = buildProductMetadataDescription(
    product({ name: `${"Complete Protein Information ".repeat(10)}Ending` })
  );

  assert.ok(metadata.length <= 160);
  assert.match(metadata, /…$/);
  assert.doesNotMatch(metadata, /informat…$/i);

  const gymMetadata = buildProductMetadataDescription(
    product({ id: "510", name: "GYM HIGH Whey Pro Synergy Dynamic 600g" })
  );
  assert.ok(gymMetadata.length <= 160);
});

test("product page does not render or select the raw description for metadata", () => {
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "product", "[id]", "page.tsx"),
    "utf8"
  );

  assert.doesNotMatch(pageSource, /product\.description/);
  assert.doesNotMatch(
    pageSource,
    /name, slug, brand, category, description, image/
  );
});

test("product page constrains mobile offer cards and long content without horizontal overflow", () => {
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "product", "[id]", "page.tsx"),
    "utf8"
  );
  const retailerOfferCardSource = fs.readFileSync(
    path.join(process.cwd(), "app", "components", "RetailerOfferCard.tsx"),
    "utf8"
  );

  assert.match(pageSource, /grid-cols-\[minmax\(0,1fr\)\]/);
  assert.match(pageSource, /overflow-x-clip/);
  assert.match(
    pageSource,
    /<RetailerOfferCard[\s\S]*key=\{group\.retailerKey\}[\s\S]*group=\{group\}[\s\S]*product=\{productAnalytics\}[\s\S]*position=\{index \+ 1\}/
  );
  assert.match(pageSource, /break-words[^\"]*\[overflow-wrap:anywhere\]/);
  assert.doesNotMatch(pageSource, /className="flex items-center gap-4"/);
  assert.match(pageSource, /className="contents lg:block"/);
  assert.match(pageSource, /data-product-purchase[\s\S]*order-1[\s\S]*lg:order-none/);
  assert.match(pageSource, /data-product-image[\s\S]*order-2[\s\S]*h-\[220px\]/);
  assert.match(pageSource, /data-product-details[\s\S]*order-3[\s\S]*lg:order-none/);
  assert.match(
    pageSource,
    /data-product-image[\s\S]*<Image[\s\S]*fill[\s\S]*sizes="\(max-width: 1023px\) 100vw, 50vw"[\s\S]*object-contain/
  );
  assert.match(retailerOfferCardSource, /<article className="w-full min-w-0 max-w-full/);
  assert.match(retailerOfferCardSource, /flex min-w-0 flex-col gap-4 sm:flex-row/);
  assert.match(retailerOfferCardSource, /w-full min-w-0 max-w-full shrink-0 items-center justify-center rounded-xl/);
  assert.match(retailerOfferCardSource, /break-words[^\"]*\[overflow-wrap:anywhere\]/);
});

test("reviewed pre-workout facts render exact states, forms and public source kinds", () => {
  const Component = loadReviewedPreWorkoutFactsComponent();
  const html = renderToStaticMarkup(React.createElement(Component, {
    variantName: "Electric Red / 425g",
    facts: {
      productId: "411",
      productVariantId: "1047",
      caffeineFreeConfirmed: true,
      facts: [
        { key: "serving_size_g", informationState: null, amountPerServingMg: null, servingSizeValue: 17, servingSizeUnit: "g", servingBasisText: "Serving Size:17g (2 scoops)", ingredientForm: null, ingredientRatio: null, sourceKinds: ["product_label"] },
        { key: "caffeine", informationState: "confirmed_absent", amountPerServingMg: null, servingSizeValue: null, servingSizeUnit: null, servingBasisText: null, ingredientForm: null, ingredientRatio: null, sourceKinds: ["brand_owner_statement"] },
        { key: "citrulline", informationState: "present_with_amount", amountPerServingMg: 5000, servingSizeValue: 15, servingSizeUnit: "g", servingBasisText: "Serving Size: 2 Scoops (15 g)", ingredientForm: "citrulline_malate", ingredientRatio: "2:1", sourceKinds: ["product_label"] },
        { key: "creatine", informationState: "present_with_amount", amountPerServingMg: 3000, servingSizeValue: 15, servingSizeUnit: "g", servingBasisText: "Serving Size: 2 Scoops (15 g)", ingredientForm: "creatine_monohydrate", ingredientRatio: null, sourceKinds: ["product_label"] },
        { key: "beta_alanine", informationState: "conflicting_information", amountPerServingMg: null, servingSizeValue: null, servingSizeUnit: null, servingBasisText: null, ingredientForm: null, ingredientRatio: null, sourceKinds: ["manufacturer_source"] },
      ],
    },
  }));

  assert.match(html, /Serving Size:17g \(2 scoops\)/);
  assert.match(html, /Confirmed absent/);
  assert.match(html, /Brand owner statement/);
  assert.match(html, /Citrulline malate 2:1 \(declared malate mass\)/);
  assert.match(html, /Creatine monohydrate \(declared form mass\)/);
  assert.match(html, /Not resolved; sources conflict/);
  assert.match(html, /does not verify the entire formulation/);
  assert.doesNotMatch(html, /supabase-storage|source_archive_uri|approved_by/);
});

test("reviewed pre-workout facts render liquid servings as ml", () => {
  const Component = loadReviewedPreWorkoutFactsComponent();
  const html = renderToStaticMarkup(React.createElement(Component, {
    variantName: "Liquid / 25 servings",
    facts: {
      productId: "973",
      productVariantId: "3185",
      caffeineFreeConfirmed: true,
      facts: [{ key: "serving_size_ml", informationState: null, amountPerServingMg: null, servingSizeValue: 40, servingSizeUnit: "ml", servingBasisText: null, ingredientForm: null, ingredientRatio: null, sourceKinds: ["product_label"] }],
    },
  }));

  assert.match(html, /40 ml per serving/);
  assert.doesNotMatch(html, /40 g per serving/);
});

test("reviewed citrulline blend components render separately without implying a pure total", () => {
  const Component = loadReviewedPreWorkoutFactsComponent();
  const html = renderToStaticMarkup(React.createElement(Component, {
    variantName: "TEST ONLY blend",
    facts: {
      productId: "1283",
      productVariantId: "3763",
      caffeineFreeConfirmed: false,
      facts: [
        { key: "citrulline_component", informationState: "present_with_amount", amountPerServingMg: 2500, servingSizeValue: 17, servingSizeUnit: "g", servingBasisText: "Approx. 2 scoops (17 g)", ingredientForm: "citrulline_malate", ingredientRatio: "2:1", sourceKinds: ["manufacturer_source"] },
        { key: "citrulline_component", informationState: "present_with_amount", amountPerServingMg: 500, servingSizeValue: 17, servingSizeUnit: "g", servingBasisText: "Approx. 2 scoops (17 g)", ingredientForm: "l_citrulline", ingredientRatio: null, sourceKinds: ["manufacturer_source"] },
      ],
    },
  }));

  assert.equal((html.match(/Citrulline blend component/g) || []).length, 2);
  assert.match(html, /2,500 mg of Citrulline malate 2:1 \(declared malate mass\)/);
  assert.match(html, /500 mg of L-citrulline \(free form\)/);
  assert.match(html, /Approx\. 2 scoops \(17 g\)/);
  assert.doesNotMatch(html, /3,000 mg|pure L-citrulline|supabase-storage|source_archive_uri/);
});

test("product page validates and scopes the exact requested pre-workout variant", () => {
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "product", "[id]", "page.tsx"),
    "utf8"
  );
  assert.match(pageSource, /\^\[1-9\]\[0-9\]\*\$/);
  assert.match(pageSource, /productVariants\.find\(\(variant\) => String\(variant\.id\) === requestedVariantId\)/);
  assert.match(pageSource, /String\(offer\.product_variant_id\) === String\(requestedVariant\.id\)/);
  assert.match(pageSource, /href=\{`\/product\/\$\{product\.slug \|\| product\.id\}\?variant=/);
  assert.match(pageSource, /No reviewed ingredient facts are available for this exact/);
});
