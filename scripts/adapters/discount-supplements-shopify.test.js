const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const adapter = require("./discount-supplements-shopify");

const ROOT = path.resolve(__dirname, "../..");
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config/retailers/discount-supplements-shopify.json"), "utf8"));
const header = fs.readFileSync(path.join(ROOT, "data/templates/retailer-feed-template.csv"), "utf8").split(/\r?\n/, 1)[0].split(",");

function productFixture(item) {
  const options = [{ name: "Size", position: 1, values: [item.expected_option1] }];
  if (item.expected_option2 !== null) options.push({ name: "Flavour", position: 2, values: [item.expected_option2] });
  return {
    id: Number(item.shopify_product_id), title: item.expected_product_title, handle: item.expected_handle, vendor: item.brand,
    updated_at: "2026-07-12T14:06:16+01:00", options,
    images: [{ src: `https://cdn.shopify.com/s/files/1/discount/${item.shopify_product_id}.webp` }],
    variants: [{ id: Number(item.shopify_variant_id), product_id: Number(item.shopify_product_id), title: item.expected_variant_title, option1: item.expected_option1, option2: item.expected_option2, option3: item.expected_option3, sku: item.expected_sku, available: item.approved_in_stock, price: String(item.approved_price), updated_at: "2026-07-12T14:06:16+01:00" }],
  };
}
const catalog = () => ({ products: config.products.map(productFixture) });
const build = (shopify = catalog(), customConfig = config) => adapter.buildCanonical({ config: customConfig, shopify, templateHeader: header });
const expectedRows = [
  { rowNumber: 2, slug: "cnp-creatine-monohydrate-250g", offerAction: "unchanged" },
  { rowNumber: 3, slug: "applied-nutrition-creatine-120-capsules", offerAction: "create" },
  { rowNumber: 4, slug: "tbjp-berberine-60-capsules", offerAction: "create" },
];
function importerOutput(overrides = {}) {
  const values = { "approved rows": 3, "invalid rows": 0, "ambiguous rows": 0, "new retailers would be created": 0, "new products would be created": 0, "retailer_products would be created": 2, "offers would be created": 2, "offers would be updated": 0, "offers unchanged": 1, "price_history rows would be created": 2, "Skipped for review": 0, Failed: 0, ...overrides };
  return `${Object.entries(values).map(([key, value]) => `${key}: ${value}`).join("\n")}\nDry run: no database writes performed.\n`;
}
function runImporterFixture({ rows = expectedRows, overrides = {}, stale = false } = {}) {
  return adapter.runImporter("approved.csv", (_command, _args, options) => {
    fs.mkdirSync(path.dirname(options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH), { recursive: true });
    fs.writeFileSync(options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH, JSON.stringify({ runId: stale ? "stale" : options.env.SUPPLEMENTSCOUT_IMPORT_RUN_ID, rowLevelOffers: rows }));
    return { status: 0, stdout: importerOutput(overrides), stderr: "" };
  });
}

test("config contains exactly three immutable approved mappings", () => {
  adapter.validateConfig(config);
  assert.equal(config.products.length, 3);
  assert.deepEqual(config.products.map((item) => item.canonical_product_id), [407, 426, 688]);
  assert.deepEqual(config.products.map((item) => item.expected_row_action), ["unchanged", "create", "create"]);
  assert.deepEqual(config.products.map((item) => item.expected_unit_count), [null, 120, 60]);
  assert.deepEqual(config.products.map((item) => item.pack_count), [1, 1, 1]);
  assert.deepEqual(config.retailer.vendor_aliases, ["CNP", "Applied Nutrition", "TBJP"]);
});

test("config source, retailer and every canonical identity remain immutable", () => {
  const changes = [
    ["source URL", (value) => { value.source_url = "https://www.monstersupplements.com/products.json?limit=250"; }],
    ["retailer ID", (value) => { value.retailer.id = 5; }],
    ["retailer slug", (value) => { value.retailer.slug = "changed"; }],
    ["retailer name", (value) => { value.retailer.name = "Changed"; }],
    ["retailer website", (value) => { value.retailer.website = "https://example.test"; }],
  ];
  for (const itemIndex of [0, 1, 2]) {
    changes.push(
      [`canonical ID ${itemIndex}`, (value) => { value.products[itemIndex].canonical_product_id += 1; }],
      [`canonical slug ${itemIndex}`, (value) => { value.products[itemIndex].canonical_slug += "-changed"; }],
    );
  }
  for (const [label, mutate] of changes) {
    const changed = structuredClone(config); mutate(changed);
    assert.throws(() => adapter.validateConfig(changed), undefined, label);
  }
});

test("config format, size, unit count, flavour and pack count remain immutable", () => {
  const changes = [
    [0, "size", 2500], [0, "size_unit", "mg"], [0, "flavour", "Cherry"],
    [0, "product_format", "capsule"], [0, "pack_count", 250],
    [1, "expected_unit_count", 60], [1, "product_format", "powder"], [1, "pack_count", 120],
    [2, "expected_unit_count", 120], [2, "flavour", "Unflavoured"], [2, "pack_count", 60],
  ];
  for (const [index, key, value] of changes) {
    const changed = structuredClone(config); changed.products[index][key] = value;
    assert.throws(() => adapter.validateConfig(changed), undefined, `${index}:${key}`);
  }
});

test("canonical build emits three exact rows with Shopify IDs, URLs, shipping and no GTIN", () => {
  const result = build();
  assert.equal(result.rows.length, 3);
  for (let index = 0; index < result.rows.length; index += 1) {
    const row = result.rows[index], item = config.products[index];
    assert.equal(row.external_product_id, item.shopify_product_id);
    assert.equal(row.external_variant_id, item.shopify_variant_id);
    assert.equal(row.external_url, `https://www.discount-supplements.co.uk/products/${item.expected_handle}?variant=${item.shopify_variant_id}`);
    assert.equal(row.external_gtin, ""); assert.equal(row.shipping_known, "true"); assert.equal(row.shipping_cost, "4.99");
    assert.equal(row.pack_count, "1"); assert.deepEqual(Object.keys(row), header);
  }
  assert.equal(Number(result.rows[1].price) + Number(result.rows[1].shipping_cost), 14.98);
  assert.equal(Number(result.rows[2].price) + Number(result.rows[2].shipping_cost), 17.98);
});

test("every approved Shopify product and variant identity drift is fatal", () => {
  for (const item of config.products) {
    const mutations = [
      ["product ID", (p) => { p.id += 1; }],
      ["variant ID", (p) => { p.variants[0].id += 1; }],
      ["variant ownership", (p) => { p.variants[0].product_id += 1; }],
      ["variant count", (p) => { p.variants.push({ ...p.variants[0], id: p.variants[0].id + 2 }); }],
      ["handle", (p) => { p.handle += "-changed"; }],
      ["product title", (p) => { p.title += " changed"; }],
      ["variant title", (p) => { p.variants[0].title += " changed"; }],
      ["vendor", (p) => { p.vendor = "Other"; }],
      ["product options", (p) => { p.options[0].values[0] = "Different"; }],
      ["variant size/count option", (p) => { p.variants[0].option1 = "Different"; }],
      ["variant flavour", (p) => { p.variants[0].option2 = "Different"; }],
      ["variant option3", (p) => { p.variants[0].option3 = "Different"; }],
      ["SKU", (p) => { p.variants[0].sku = "OTHER"; }],
      ["barcode", (p) => { p.variants[0].barcode = "5012345678901"; }],
      ["price", (p) => { p.variants[0].price = "99.99"; }],
      ["stock", (p) => { p.variants[0].available = false; }],
      ["image protocol", (p) => { p.images[0].src = "http://cdn.shopify.com/image.webp"; }],
      ["image domain", (p) => { p.images[0].src = "https://example.test/image.webp"; }],
    ];
    for (const [label, mutate] of mutations) {
      const source = catalog(), product = source.products.find((candidate) => String(candidate.id) === item.shopify_product_id);
      mutate(product); assert.throws(() => build(source), undefined, `${item.canonical_product_id}:${label}`);
    }
  }
});

test("missing, null and blank barcode match approved null while a real barcode blocks", () => {
  for (const barcode of [undefined, null, "", "   "]) {
    const source = catalog();
    for (const product of source.products) {
      if (barcode === undefined) delete product.variants[0].barcode;
      else product.variants[0].barcode = barcode;
    }
    assert.doesNotThrow(() => build(source));
  }
  const source = catalog(); source.products[1].variants[0].barcode = "5012345678901";
  assert.throws(() => build(source), /barcode drift/);
});

test("fetchCatalog paginates until all three approved products are present", async () => {
  const calls = [];
  const filler = Array.from({ length: 250 }, (_, index) => ({ id: index + 1, variants: [] }));
  const fetchImpl = async (url) => {
    calls.push(url);
    const products = url.includes("page=1") ? [...filler, productFixture(config.products[0])] : config.products.slice(1).map(productFixture);
    return new Response(JSON.stringify({ products }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const result = await adapter.fetchCatalog(config, fetchImpl);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /page=1/); assert.match(calls[1], /page=2/);
  assert.equal(result.products.filter((product) => config.products.some((item) => item.shopify_product_id === String(product.id))).length, 3);
});

test("mixed batch accepts one unchanged and two creates regardless of row order", () => {
  const result = runImporterFixture({ rows: [expectedRows[2], expectedRows[0], expectedRows[1]] });
  assert.equal(result.lifecycleState, "MIXED_BATCH"); assert.equal(result.database_writes, 0);
  assert.deepEqual(result.summary, { approved_rows: 3, invalid_rows: 0, ambiguous_rows: 0, new_retailers: 0, new_products: 0, retailer_products_created: 2, offers_created: 2, offers_updated: 0, offers_unchanged: 1, price_history_created: 2, skipped_for_review: 0, failed: 0 });
});

test("wrong action for any slug is fatal", () => {
  for (let index = 0; index < expectedRows.length; index += 1) {
    const rows = structuredClone(expectedRows); rows[index].offerAction = rows[index].offerAction === "create" ? "unchanged" : "create";
    assert.throws(() => runImporterFixture({ rows }), /Unexpected row action/);
  }
});

test("missing, extra and duplicate slugs are fatal", () => {
  assert.throws(() => runImporterFixture({ rows: expectedRows.slice(0, 2) }), /row-level report/);
  assert.throws(() => runImporterFixture({ rows: [...expectedRows, { rowNumber: 5, slug: "extra", offerAction: "create" }] }), /row-level report/);
  assert.throws(() => runImporterFixture({ rows: [expectedRows[0], expectedRows[1], { ...expectedRows[1], rowNumber: 4 }] }), /duplicate|Invalid/);
});

test("three creates instead of exactly two is fatal", () => {
  const rows = structuredClone(expectedRows); rows[0].offerAction = "create";
  assert.throws(() => runImporterFixture({ rows, overrides: { "retailer_products would be created": 3, "offers would be created": 3, "offers unchanged": 0, "price_history rows would be created": 3 } }), /Unexpected row action/);
});

test("legacy whole-batch INITIAL_CREATE and STEADY_STATE are fatal; only MIXED_BATCH is allowed", () => {
  const initialRows = expectedRows.map((row) => ({ ...row, offerAction: "create" }));
  assert.throws(() => runImporterFixture({ rows: initialRows, overrides: { "retailer_products would be created": 3, "offers would be created": 3, "offers unchanged": 0, "price_history rows would be created": 3 } }), /Unexpected row action/);
  const steadyRows = expectedRows.map((row) => ({ ...row, offerAction: "unchanged" }));
  assert.throws(() => runImporterFixture({ rows: steadyRows, overrides: { "retailer_products would be created": 0, "offers would be created": 0, "offers unchanged": 3, "price_history rows would be created": 0 } }), /Unexpected row action/);
  assert.equal(runImporterFixture().lifecycleState, "MIXED_BATCH");
});

test("update action and aggregate update counter are fatal", () => {
  const rows = structuredClone(expectedRows); rows[1].offerAction = "update";
  assert.throws(() => runImporterFixture({ rows }), /Unexpected row action/);
  assert.throws(() => runImporterFixture({ overrides: { "offers would be updated": 1 } }), /offers_updated/);
});

test("every unexpected aggregate counter is fatal", () => {
  for (const [label, value] of [["approved rows", 2], ["new retailers would be created", 1], ["new products would be created", 1], ["retailer_products would be created", 1], ["offers would be created", 1], ["offers unchanged", 2], ["price_history rows would be created", 1], ["Skipped for review", 1], ["Failed", 1]]) {
    assert.throws(() => runImporterFixture({ overrides: { [label]: value } }), /Unexpected importer/);
  }
});

test("helper report must be fresh, present and valid", () => {
  assert.throws(() => runImporterFixture({ stale: true }), /stale/);
  assert.throws(() => adapter.runImporter("approved.csv", () => ({ status: 0, stdout: importerOutput(), stderr: "" })), /fresh helper/);
  assert.throws(() => adapter.runImporter("approved.csv", (_command, _args, options) => { fs.mkdirSync(path.dirname(options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH), { recursive: true }); fs.writeFileSync(options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH, "bad json"); return { status: 0, stdout: importerOutput(), stderr: "" }; }), /JSON/);
});

test("importer command remains fixed dry-run without safe-create or apply", () => {
  let args;
  adapter.runImporter("C:\\tmp\\batch.csv", (_command, actual, options) => { args = actual; fs.mkdirSync(path.dirname(options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH), { recursive: true }); fs.writeFileSync(options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH, JSON.stringify({ runId: options.env.SUPPLEMENTSCOUT_IMPORT_RUN_ID, rowLevelOffers: expectedRows })); return { status: 0, stdout: importerOutput(), stderr: "" }; });
  assert.deepEqual(args.slice(1), ["--mode=feed", "--dry-run", "--csv=C:\\tmp\\batch.csv"]);
  assert.equal(args.includes("--safe-create"), false); assert.equal(args.some((arg) => /apply/i.test(arg)), false);
});

test("production target validation requires all three active unmerged canonical products", async () => {
  const client = { from(table) { if (table === "retailers") return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { id: 4, name: "Discount Supplements", slug: "discount-supplements", website: "https://www.discount-supplements.co.uk" }, error: null }; } }; return { select() { return this; }, async in() { return { data: config.products.map((item) => ({ id: item.canonical_product_id, slug: item.canonical_slug, is_active: true, merged_into_product_id: null, merged_at: null })), error: null }; } }; } };
  await adapter.validateProductionTargets(config, client);
});

test("production target validation rejects retailer and canonical identity drift", async () => {
  function clientWith(retailer, products) {
    return { from(table) {
      if (table === "retailers") return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: retailer, error: null }; } };
      return { select() { return this; }, async in() { return { data: products, error: null }; } };
    } };
  }
  const retailer = { id: 4, name: "Discount Supplements", slug: "discount-supplements", website: "https://www.discount-supplements.co.uk" };
  const products = config.products.map((item) => ({ id: item.canonical_product_id, slug: item.canonical_slug, is_active: true, merged_into_product_id: null, merged_at: null }));
  await assert.rejects(adapter.validateProductionTargets(config, clientWith({ ...retailer, slug: "changed" }, products)), /Retailer identity/);
  for (const mutate of [
    (rows) => { rows[1].slug = "changed"; },
    (rows) => { rows[1].is_active = false; },
    (rows) => { rows[1].merged_into_product_id = 407; },
    (rows) => { rows.splice(1, 1); },
  ]) {
    const changed = structuredClone(products); mutate(changed);
    await assert.rejects(adapter.validateProductionTargets(config, clientWith(retailer, changed)), /Canonical identity/);
  }
});

test("hermetic main happy path writes a successful mixed-batch report", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "discount-batch-")); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const result = await adapter.main({ argv: [], csvPath: path.join(directory, "batch.csv"), reportPath: path.join(directory, "report.json"), fetchCatalog: async () => catalog(), validateProduction: async () => {}, runImporter: () => ({ runId: "fresh", lifecycleState: "MIXED_BATCH", rowLevelOffers: expectedRows, summary: { approved_rows: 3, invalid_rows: 0, ambiguous_rows: 0, new_retailers: 0, new_products: 0, retailer_products_created: 2, offers_created: 2, offers_updated: 0, offers_unchanged: 1, price_history_created: 2, skipped_for_review: 0, failed: 0 }, output: "ok", database_writes: 0 }) });
  assert.equal(result.report.success, true); assert.equal(result.report.database_writes, 0); assert.equal(result.report.lifecycle_state, "MIXED_BATCH");
  assert.deepEqual(result.report.delivered_prices, [{ canonical_product_id: 407, delivered_price: 17.98 }, { canonical_product_id: 426, delivered_price: 14.98 }, { canonical_product_id: 688, delivered_price: 17.98 }]);
  assert.equal(result.report.product_drifts.length, 0); assert.equal(result.report.importer_row_results.length, 3);
});

test("main rejects CLI arguments", async () => { await assert.rejects(adapter.main({ argv: ["--dry-run"] }), /does not accept CLI arguments/); });
