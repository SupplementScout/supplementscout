const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const adapter = require("./discount-supplements-shopify");

const ROOT = path.resolve(__dirname, "../..");
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config/retailers/discount-supplements-shopify.json"), "utf8"));
const header = fs.readFileSync(path.join(ROOT, "data/templates/retailer-feed-template.csv"), "utf8").split(/\r?\n/, 1)[0].split(",");

function productFixture() {
  return {
    id: 6788065329348, title: "CNP Creatine Monohydrate 250g", handle: "cnp-pro-creatine-250g", vendor: "CNP",
    updated_at: "2026-07-12T12:46:48+01:00",
    options: [
      { name: "Size", position: 1, values: ["250g"] },
      { name: "Flavour", position: 2, values: ["Unflavoured"] },
    ],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0266/9032/2479/files/cnp-creatine-250g.jpg" }],
    variants: [{
      id: 54879874810234, product_id: 6788065329348, title: "250g / Unflavoured",
      option1: "250g", option2: "Unflavoured", option3: null, sku: "CNP-0508",
      available: true, price: "12.99", updated_at: "2026-07-12T12:46:48+01:00",
    }],
  };
}

function build(shopify = { products: [productFixture()] }, customConfig = config) {
  return adapter.buildCanonical({ config: customConfig, shopify, templateHeader: header });
}

function importerOutput(overrides = {}) {
  const values = {
    "approved rows": 1, "invalid rows": 0, "ambiguous rows": 0,
    "new retailers would be created": 0, "new products would be created": 0,
    "retailer_products would be created": 1, "offers would be created": 1,
    "offers would be updated": 0, "offers unchanged": 0,
    "price_history rows would be created": 1, "Skipped for review": 0, Failed: 0,
    ...overrides,
  };
  return `${Object.entries(values).map(([key, value]) => `${key}: ${value}`).join("\n")}\nDry run: no database writes performed.\n`;
}

test("config freezes the single approved retailer, canonical product, variant, evidence, and shipping", () => {
  adapter.validateConfig(config);
  assert.equal(config.products.length, 1);
  assert.deepEqual(config.retailer, {
    id: 4, name: "Discount Supplements", slug: "discount-supplements",
    website: "https://www.discount-supplements.co.uk", vendor_aliases: ["CNP"],
  });
  assert.deepEqual(config.shipping, {
    known: true, cost: 4.99, free_shipping_threshold: 80,
    approval_note: "Verified standard UK delivery for third-party brands, including CNP; the basket-level free-shipping threshold is informational and does not change a single-offer shipping row.",
  });
  const item = config.products[0];
  assert.equal(item.expected_variant_count, 1);
  assert.equal(item.expected_product_title, "CNP Creatine Monohydrate 250g");
  assert.deepEqual([item.expected_option1, item.expected_option2, item.expected_option3], ["250g", "Unflavoured", null]);
  assert.equal(item.expected_sku, "CNP-0508");
  assert.equal(item.expected_barcode, null);
  const serialized = JSON.stringify(config);
  for (const forbidden of ["products.gtin", "Variant Grams", "Body HTML", "inventory quantity", "verified metrics", "SUPABASE_SERVICE_ROLE_KEY", "C:\\\\Users\\\\"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("buildCanonical emits exactly one locked row with empty GTIN and delivered price inputs", () => {
  const result = build();
  assert.equal(result.rows.length, 1);
  const row = result.rows[0];
  assert.equal(row.external_product_id, "6788065329348");
  assert.equal(row.external_variant_id, "54879874810234");
  assert.equal(row.external_url, "https://www.discount-supplements.co.uk/products/cnp-pro-creatine-250g?variant=54879874810234");
  assert.equal(row.external_gtin, "");
  assert.equal(row.price, "12.99");
  assert.equal(row.shipping_known, "true");
  assert.equal(row.shipping_cost, "4.99");
  assert.equal(Number(row.price) + Number(row.shipping_cost), 17.98);
  assert.equal(Object.hasOwn(row, "sku"), false);
  assert.deepEqual(Object.keys(row), header);
});

test("every approved Shopify and variant identity drift blocks the run", () => {
  const mutations = [
    ["product ID", (p) => { p.id = 1; }],
    ["variant ID", (p) => { p.variants[0].id = 2; }],
    ["variant count", (p) => { p.variants.push({ ...p.variants[0], id: 3 }); }],
    ["handle", (p) => { p.handle = "changed"; }],
    ["product title and format", (p) => { p.title = "CNP Creatine Monohydrate 250 Capsules"; }],
    ["variant title", (p) => { p.variants[0].title = "500g / Unflavoured"; }],
    ["size option", (p) => { p.options[0].values[0] = "500g"; p.variants[0].option1 = "500g"; }],
    ["size unit", (p) => { p.options[0].values[0] = "250kg"; p.variants[0].option1 = "250kg"; }],
    ["flavour", (p) => { p.options[1].values[0] = "Cherry"; p.variants[0].option2 = "Cherry"; }],
    ["option3", (p) => { p.variants[0].option3 = "Single"; }],
    ["vendor", (p) => { p.vendor = "Other"; }],
    ["SKU", (p) => { p.variants[0].sku = "OTHER"; }],
    ["missing SKU", (p) => { p.variants[0].sku = ""; }],
    ["barcode appearance", (p) => { p.variants[0].barcode = "5012345678901"; }],
    ["price", (p) => { p.variants[0].price = "13.00"; }],
    ["stock", (p) => { p.variants[0].available = false; }],
    ["image", (p) => { p.images[0].src = "http://example.test/image.jpg"; }],
    ["foreign HTTPS image", (p) => { p.images[0].src = "https://example.test/image.jpg"; }],
  ];
  for (const [label, mutate] of mutations) {
    const product = productFixture();
    mutate(product);
    assert.throws(() => build({ products: [product] }), undefined, label);
  }
});

test("missing, null, and blank barcode match approved null while a real barcode blocks", () => {
  for (const barcode of [undefined, null, "", "   "]) {
    const product = productFixture();
    if (barcode !== undefined) product.variants[0].barcode = barcode;
    assert.doesNotThrow(() => build({ products: [product] }));
  }
  const product = productFixture();
  product.variants[0].barcode = "5012345678901";
  assert.throws(() => build({ products: [product] }), /barcode drift/);
});

test("config identity, format and pack-count changes are rejected", () => {
  for (const [key, value] of [["canonical_product_id", 408], ["canonical_slug", "changed"], ["size", 500], ["size_unit", "kg"], ["flavour", "Cherry"], ["product_format", "capsule"], ["pack_count", 2]]) {
    const changed = structuredClone(config);
    changed.products[0][key] = value;
    assert.throws(() => adapter.validateConfig(changed), new RegExp(key));
  }
  for (const [key, value] of [["id", 5], ["slug", "changed"], ["website", "https://example.test"]]) {
    const changed = structuredClone(config);
    changed.retailer[key] = value;
    assert.throws(() => adapter.validateConfig(changed), /retailer identity/);
  }
  const monster = structuredClone(config);
  monster.source_url = "https://www.monstersupplements.com/products.json?limit=250";
  assert.throws(() => adapter.validateConfig(monster), /source URL/);
});

test("fetchCatalog paginates until the approved product can be present", async () => {
  const calls = [];
  const firstPage = Array.from({ length: 250 }, (_, index) => ({ id: index + 1, variants: [] }));
  const fetchImpl = async (url) => {
    calls.push(url);
    const body = url.includes("page=1") ? { products: firstPage } : { products: [productFixture()] };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  const result = await adapter.fetchCatalog(config, fetchImpl);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /page=1/);
  assert.match(calls[1], /page=2/);
  assert.equal(result.products.length, 251);
});

test("production target validation requires retailer ID 4 and canonical ID 407", async () => {
  function clientWith(retailer, product) {
    return { from(table) {
      const data = table === "retailers" ? retailer : product;
      return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data, error: null }; } };
    } };
  }
  await adapter.validateProductionTargets(config, clientWith(
    { id: 4, name: "Discount Supplements", slug: "discount-supplements", website: "https://www.discount-supplements.co.uk" },
    { id: 407, slug: "cnp-creatine-monohydrate-250g", is_active: true, merged_into_product_id: null, merged_at: null },
  ));
  await assert.rejects(adapter.validateProductionTargets(config, clientWith(
    { id: 5, name: "Discount Supplements", slug: "discount-supplements", website: "https://www.discount-supplements.co.uk" },
    { id: 407, slug: "cnp-creatine-monohydrate-250g", is_active: true, merged_into_product_id: null, merged_at: null },
  )), /Retailer ID/);
  await assert.rejects(adapter.validateProductionTargets(config, clientWith(
    { id: 4, name: "Discount Supplements", slug: "discount-supplements", website: "https://www.discount-supplements.co.uk" },
    { id: 407, slug: "changed", is_active: true, merged_into_product_id: null, merged_at: null },
  )), /Canonical product/);
  for (const product of [
    { id: 407, slug: "cnp-creatine-monohydrate-250g", is_active: false, merged_into_product_id: null, merged_at: null },
    { id: 407, slug: "cnp-creatine-monohydrate-250g", is_active: true, merged_into_product_id: 999, merged_at: "2026-01-01T00:00:00Z" },
  ]) {
    await assert.rejects(adapter.validateProductionTargets(config, clientWith(
      { id: 4, name: "Discount Supplements", slug: "discount-supplements", website: "https://www.discount-supplements.co.uk" }, product,
    )), /Canonical product/);
  }
});

test("importer command is fixed to feed dry-run and exact first-run counters", () => {
  const captured = {};
  const result = adapter.runImporter("C:\\tmp\\approved.csv", (command, args, options) => {
    captured.command = command; captured.args = args;
    fs.mkdirSync(path.dirname(options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH), { recursive: true });
    fs.writeFileSync(options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH, JSON.stringify({
      runId: options.env.SUPPLEMENTSCOUT_IMPORT_RUN_ID,
      rowLevelOffers: [{ rowNumber: 2, slug: "cnp-creatine-monohydrate-250g", offerAction: "create" }],
    }));
    return { status: 0, stdout: importerOutput(), stderr: "" };
  });
  assert.deepEqual(captured.args.slice(1), ["--mode=feed", "--dry-run", "--csv=C:\\tmp\\approved.csv"]);
  assert.equal(captured.args.includes("--safe-create"), false);
  assert.equal(captured.args.some((arg) => /apply/i.test(arg)), false);
  assert.deepEqual(result.summary, {
    approved_rows: 1, invalid_rows: 0, ambiguous_rows: 0, new_retailers: 0, new_products: 0,
    retailer_products_created: 1, offers_created: 1, offers_updated: 0, offers_unchanged: 0,
    price_history_created: 1, skipped_for_review: 0, failed: 0,
  });
  assert.equal(result.database_writes, 0);
  assert.deepEqual(result.rowLevelOffers, [{ rowNumber: 2, slug: "cnp-creatine-monohydrate-250g", offerAction: "create" }]);
});

test("importer blocks any counter drift", () => {
  assert.throws(() => adapter.runImporter("approved.csv", (_command, _args, options) => {
    fs.mkdirSync(path.dirname(options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH), { recursive: true });
    fs.writeFileSync(options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH, JSON.stringify({ runId: options.env.SUPPLEMENTSCOUT_IMPORT_RUN_ID, rowLevelOffers: [{ rowNumber: 2, slug: "cnp-creatine-monohydrate-250g", offerAction: "create" }] }));
    return { status: 0, stdout: importerOutput({ "new products would be created": 1 }), stderr: "" };
  }), /new_products/);
});

test("importer rejects stale or non-exact row-level evidence", () => {
  for (const rowLevelOffers of [
    [{ rowNumber: 2, slug: "wrong-slug", offerAction: "create" }],
    [{ rowNumber: 2, slug: "cnp-creatine-monohydrate-250g", offerAction: "unchanged" }],
    [],
  ]) {
    assert.throws(() => adapter.runImporter("approved.csv", (_command, _args, options) => {
      fs.mkdirSync(path.dirname(options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH), { recursive: true });
      fs.writeFileSync(options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH, JSON.stringify({ runId: "stale-run", rowLevelOffers }));
      return { status: 0, stdout: importerOutput(), stderr: "" };
    }), /Invalid or stale importer row-level report/);
  }
});

test("importer rejects missing and invalid helper reports and removes invalid helpers", () => {
  assert.throws(() => adapter.runImporter("approved.csv", () => ({ status: 0, stdout: importerOutput(), stderr: "" })), /fresh helper report/);
  let helperPath;
  assert.throws(() => adapter.runImporter("approved.csv", (_command, _args, options) => {
    helperPath = options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH;
    fs.mkdirSync(path.dirname(helperPath), { recursive: true });
    fs.writeFileSync(helperPath, "not json");
    return { status: 0, stdout: importerOutput(), stderr: "" };
  }), /JSON/);
  assert.equal(fs.existsSync(helperPath), false);
});

test("main writes only controlled tmp outputs after validated dry-run success", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "discount-supplements-adapter-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const csvPath = path.join(directory, "generated.csv");
  const reportPath = path.join(directory, "report.json");
  const result = await adapter.main({
    argv: [], csvPath, reportPath, fetchCatalog: async () => ({ products: [productFixture()] }),
    validateProduction: async () => {},
    runImporter: () => ({ runId: "fresh-run", database_writes: 0, output: "ok", rowLevelOffers: [{ rowNumber: 2, slug: "cnp-creatine-monohydrate-250g", offerAction: "create" }], summary: {
      approved_rows: 1, invalid_rows: 0, ambiguous_rows: 0, new_retailers: 0, new_products: 0,
      retailer_products_created: 1, offers_created: 1, offers_updated: 0, offers_unchanged: 0,
      price_history_created: 1, skipped_for_review: 0, failed: 0,
    } }),
  });
  assert.equal(fs.existsSync(csvPath), true);
  assert.equal(fs.existsSync(reportPath), true);
  assert.equal(result.report.success, true);
  assert.equal(result.report.database_writes, 0);
  assert.equal(result.report.delivered_price, 17.98);
  assert.equal(result.report.importer_summary.retailer_products_created, 1);
  assert.deepEqual(result.report.importer_row_results, [{ rowNumber: 2, slug: "cnp-creatine-monohydrate-250g", offerAction: "create" }]);
});

test("main rejects CLI arguments", async () => {
  await assert.rejects(adapter.main({ argv: ["--dry-run"] }), /does not accept CLI arguments/);
});
