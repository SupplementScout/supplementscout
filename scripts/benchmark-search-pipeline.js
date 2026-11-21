const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "..");
const BASELINE = "ab24fc203f89297dce424468b62c0184198ec875";
const SORTS = ["relevance", "price_asc", "price_desc", "price_per_serving_asc", "cost_per_25g_protein_asc", "cost_per_5g_creatine_asc"];

function scenario({ name, products: count, variantsPerProduct = 1, structuredEvery = 1, category = "Pre Workout" }) {
  const products = [], variants = [], candidates = [];
  const fresh = new Date().toISOString();
  const stale = new Date(Date.now() - 48 * 3600000).toISOString();
  const retailer = (id) => ({ id, name: `Fixture shop ${id}`, slug: `shop-${id}`, logo: null });
  const candidate = (productId, variantId, field, value, unit, extras = {}) => ({
    product_id: productId, product_variant_id: variantId, proposed_field: field,
    proposed_value: value, proposed_unit: unit, approved_value: value, status: "approved",
    information_state: null, source_quantity_value: null, source_quantity_unit: null,
    quantity_basis: null, serving_basis_value: null, serving_basis_unit: null, serving_basis_text: null,
    ingredient_form: null, ingredient_ratio: null, warning_flags: [], source_locator: `image:fixture-${variantId}`,
    source_type: "manufacturer_product_page", source_url: "https://example.test/fixture",
    source_file_sha256: "a".repeat(64), source_archive_uri: "supabase-storage://nutrition-sources/fixture/label.jpg", ...extras,
  });
  for (let index = 0; index < count; index++) {
    const id = 10000 + index;
    const creatine = category === "Creatine";
    const packWeight = creatine ? 1000 : 400;
    const servingSize = creatine ? 5 : 10;
    const servingCount = packWeight / servingSize;
    const product = {
      id, slug: `fixture-${index}`, name: `Supplement ${category} ${String(index).padStart(4, "0")}`,
      brand: `Fixture brand ${index % 7}`, category, image: null,
      net_weight_g: packWeight, net_volume_ml: null, product_format: "powder", serving_size_g: servingSize,
      serving_size_ml: null, protein_per_serving_g: null, creatine_per_serving_g: creatine ? 5 : 3,
      serving_count_verified: servingCount, nutrition_verified: true, unit_pricing_verified: true, offers: [],
    };
    for (let variantIndex = 0; variantIndex < variantsPerProduct; variantIndex++) {
      const variantId = 20000 + index * variantsPerProduct + variantIndex;
      const override = structuredEvery && index % structuredEvery === 0 ? { serving_size_g: servingSize } : null;
      const variant = { id: variantId, product_id: id, display_name: `Flavour ${variantIndex} / ${packWeight} g`, flavour_label: `Flavour ${variantIndex}`, size_value: packWeight, size_unit: "g", pack_count: 1, product_format: "powder", nutrition_override: override };
      variants.push(variant);
      if (override) {
        candidates.push(candidate(id, variantId, "serving_size_g", servingSize, "g"));
        for (const [field, key, amount, form] of creatine ? [] : [
          ["caffeine_per_serving_mg", "caffeine", 150, null],
          ["beta_alanine_per_serving_mg", "beta_alanine", 3200, null],
          ["citrulline_per_serving_mg", "citrulline", 6000, "l_citrulline"],
          ["creatine_declared_form_per_serving_mg", "creatine", 3000, "creatine_monohydrate"],
        ]) {
          const absent = key === "caffeine" && variantIndex % 2 === 0;
          const applied = absent ? { information_state: "confirmed_absent" } : {
            information_state: "present_with_amount", amount_per_serving_mg: amount,
            source_quantity_value: amount, source_quantity_unit: "mg", quantity_basis: "per_serving",
            serving_basis_value: 10, serving_basis_unit: "g", serving_basis_text: "Per 10 g serving",
            ...(form ? { ingredient_form: form } : {}), ...(key === "creatine" ? { amount_subject: "declared_ingredient_form" } : {}),
          };
          override[key] = applied;
          candidates.push(candidate(id, variantId, field, absent ? null : amount, absent ? null : "mg", {
            information_state: applied.information_state, source_quantity_value: absent ? null : amount,
            source_quantity_unit: absent ? null : "mg", quantity_basis: absent ? null : "per_serving",
            serving_basis_value: absent ? null : 10, serving_basis_unit: absent ? null : "g",
            serving_basis_text: absent ? null : "Per 10 g serving", ingredient_form: absent ? null : form,
          }));
        }
      }
      // Real product-scoped reads also include unrelated scalar/parent evidence.
      candidates.push(candidate(id, variantId, "serving_count_verified", servingCount, "count"));
      for (let shop = 1; shop <= 3; shop++) product.offers.push({
        id: 30000 + index * 10 + variantIndex * 3 + shop, product_variant_id: variantId,
        price: 10 + index % 29 + shop + variantIndex, shipping_cost: index % 11 === 0 ? null : shop === 1 ? 3.99 : 0,
        url: "https://example.test/offer", in_stock: index % 17 !== 0,
        last_checked_at: index % 19 === 0 ? stale : fresh, retailer: retailer(shop),
      });
    }
    candidates.push(candidate(id, null, "serving_count_verified", servingCount, "count"));
    products.push(product);
  }
  return { name, products, variants, candidates, query: category.toLowerCase() };
}

function loadSearch(data, { ref = null, profile = false, countCandidates = false } = {}) {
  const modules = new Map(), wires = new Map(), calls = [], stages = {};
  const stats = { candidateInspections: 0 };
  const record = (name, elapsed) => { const item = stages[name] ||= { ms: 0, calls: 0 }; item.ms += elapsed; item.calls++; };
  function database() {
    return { from(table) {
      assert.ok(["products", "product_variants", "nutrition_candidates"].includes(table), "Only isolated fixture SELECTs are supported");
      const shape = { table }; const builder = {
        select: (select) => { shape.select = select; return builder; },
        eq: (key, value) => { (shape.eq ||= []).push([key, value]); return builder; },
        is: (key, value) => { (shape.is ||= []).push([key, value]); return builder; },
        or: (filter) => { shape.or = filter; return builder; },
        order: (key, options) => { shape.order = [key, options]; return builder; },
        in: (key, ids) => { shape.in = [key, ids]; return builder; },
        range: (from, to) => { shape.range = [from, to]; return builder; },
        then(resolve, reject) {
          const key = JSON.stringify(shape);
          let wire = wires.get(key);
          if (!wire) {
            let rows = table === "products" ? data.products : table === "product_variants" ? data.variants : data.candidates;
            if (shape.in) { const ids = new Set(shape.in[1].map(String)); rows = rows.filter(row => ids.has(String(row[shape.in[0]]))); }
            for (const [column, value] of shape.eq || []) if (column === "status") rows = rows.filter(row => row[column] === value);
            if (shape.range) rows = rows.slice(shape.range[0], shape.range[1] + 1);
            // Prepared fixture transport excludes imaginary database serialization
            // CPU, but every invocation pays JSON.parse just like a fresh read.
            wire = { text: JSON.stringify(rows), rows: rows.length }; wire.bytes = Buffer.byteLength(wire.text); wires.set(key, wire);
          }
          const start = profile ? performance.now() : 0;
          const rows = JSON.parse(wire.text);
          if (profile) {
            record(`deserialize:${table}`, performance.now() - start);
          }
          if (countCandidates && table === "nutrition_candidates") for (const row of rows) {
            const productId = row.product_id;
            Object.defineProperty(row, "product_id", { enumerable: true, get() { stats.candidateInspections++; return productId; } });
          }
          calls.push({ ...shape, rows: wire.rows, bytes: wire.bytes });
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
      }; return builder;
    } };
  }
  function compile(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    if (path.basename(filename) === "supabase.ts") return { supabase: database() };
    if (path.basename(filename) === "supabaseAdmin.ts") return { supabaseAdmin: database() };
    const mod = new Module(filename); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); modules.set(filename, mod);
    const nativeRequire = mod.require.bind(mod);
    mod.require = request => {
      if (request === "server-only") return {};
      const resolved = path.resolve(path.dirname(filename), request + ".ts");
      return request.startsWith(".") && fs.existsSync(resolved) ? compile(resolved) : nativeRequire(request);
    };
    const relative = path.relative(ROOT, filename).replaceAll(path.sep, "/");
    const source = ref
      ? execFileSync("git", ["show", `${ref}:${relative}`], { cwd: ROOT, encoding: "utf8" }) : fs.readFileSync(filename, "utf8");
    let js = ts.transpileModule(source, { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    if (profile) {
      mod.__record = record;
      js += `\nconst __record = module.__record;
const __sync = (name,fn) => function(...args){const t=performance.now();try{return fn(...args)}finally{__record(name,performance.now()-t)}};
const __async = (name,fn) => async function(...args){const t=performance.now();try{return await fn(...args)}finally{__record(name,performance.now()-t)}};`;
      if (relative === "app/lib/products.ts") js += "\nloadProductVariants=__async('enrichment',loadProductVariants);normalizeProduct=__sync('normalize',normalizeProduct);buildFacets=__sync('facets',buildFacets);applyProductFilters=__sync('filters',applyProductFilters);sortResults=__sync('sort',sortResults);";
      if (relative === "app/lib/reviewedPreWorkoutFacts.server.ts") js += "\nexports.loadAppliedPreWorkoutFacts=__async('proofLoader',loadAppliedPreWorkoutFacts);";
      if (relative === "app/lib/reviewedPreWorkoutFacts.ts") js += "\nexports.resolveAppliedPreWorkoutFacts=__sync('proofResolver',resolveAppliedPreWorkoutFacts);";
    }
    mod._compile(js, filename); return mod.exports;
  }
  const search = compile(path.join(ROOT, "app/lib/products.ts")).searchProducts;
  return { calls, stages, stats, async run({ sort = "relevance", retailer = "", caffeine = "", page = 1, budget = false } = {}) {
    calls.length = 0; for (const key of Object.keys(stages)) delete stages[key]; stats.candidateInspections = 0;
    return search(data.query + (budget ? " under 25" : ""), sort, { category: "", brand: "", retailer, caffeine }, page);
  } };
}

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
async function compare(data, before, after, samples = 15) {
  assert.deepEqual(await before.run(), await after.run(), "Complete search result parity");
  assert.deepEqual(before.calls, after.calls, "Query shape/row/byte parity");
  for (const runner of [before, after]) {
    const start = performance.now();
    do { await runner.run(); } while (performance.now() - start < 1000);
  }
  const pilotStart = performance.now(); await after.run();
  // Windows CPU accounting is coarse. Keep batches long enough to avoid zero
  // measurements for small requests; no timing threshold is used as a test gate.
  const iterations = Math.max(3, Math.min(300, Math.ceil(300 / (performance.now() - pilotStart))));
  const timing = { before: { cpuMs: [], wallMs: [] }, after: { cpuMs: [], wallMs: [] } };
  for (let sample = 0; sample < samples; sample++) for (const revision of sample % 2 ? ["after", "before"] : ["before", "after"]) {
    const cpu = process.cpuUsage(), start = performance.now();
    for (let i = 0; i < iterations; i++) await (revision === "before" ? before : after).run();
    timing[revision].wallMs.push((performance.now() - start) / iterations);
    const elapsed = process.cpuUsage(cpu); timing[revision].cpuMs.push((elapsed.user + elapsed.system) / 1000 / iterations);
  }
  return { name: data.name, products: data.products.length, variants: data.variants.length, offers: data.products.reduce((sum, p) => sum + p.offers.length, 0), candidates: data.candidates.length,
    queries: before.calls.map(({ table, rows, bytes }) => ({ table, rows, bytes })), parity: "PASS", iterationsPerSample: iterations,
    median: Object.fromEntries(Object.entries(timing).map(([key, value]) => [key, { cpuMs: median(value.cpuMs), wallMs: median(value.wallMs) }])), samples: timing };
}

async function main() {
  const ref = process.argv[2] || BASELINE; assert.match(ref, /^[a-f0-9]{40}$/);
  const specifications = [
    { name: "small-creatine", products: 90, structuredEvery: 4, category: "Creatine" },
    { name: "broad-1000-quarter-reviewed", products: 1000, structuredEvery: 4 },
    { name: "proof-rich-preworkout", products: 200, variantsPerProduct: 3 },
    { name: "no-applied-overrides", products: 90, structuredEvery: 0, category: "Creatine" },
  ];
  const results = [];
  for (const spec of specifications) {
    const data = scenario(spec); const before = loadSearch(data, { ref }); const after = loadSearch(data);
    const result = await compare(data, before, after);
    const profile = {};
    for (const [revision, options] of [["before", { ref }], ["after", {}]]) {
      const measured = loadSearch(data, { ...options, profile: true }); await measured.run();
      const counted = loadSearch(data, { ...options, countCandidates: true }); await counted.run();
      profile[revision] = { stages: measured.stages, candidateInspections: counted.stats.candidateInspections };
    }
    results.push({ ...result, profile });
  }
  console.log(JSON.stringify({ baseline: ref, at: new Date().toISOString(), node: process.version,
    samplesPerRevision: 15, warmupMsPerRevision: 1000, targetBatchMs: 300,
    scope: "Offline full searchProducts including actual pricing/nutrition/freshness/proof modules and fresh fixture JSON deserialization. Synthetic scenarios, not sampled production data. No network, database, SSR, React rendering, or Vercel CPU measurements. Timings uninstrumented; separate instrumented stage profiles overlap (proofLoader is inside enrichment). Candidate inspections use a third run, separate from timing and stage profiles.", results }, null, 2));
}
module.exports = { scenario, loadSearch, compare, SORTS };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
