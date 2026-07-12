const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { parse } = require("csv-parse/sync");
const {
  atomicWrite,
  buildCanonical,
  fetchJson,
  parseExport,
  runImporter,
  validateCanonicalMappings,
} = require("./kior-shopify");

const ROOT = path.resolve(__dirname, "../..");
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config/retailers/kior-shopify.json"), "utf8"));
const header = fs.readFileSync(path.join(ROOT, "data/templates/retailer-feed-template.csv"), "utf8").split(/\r?\n/, 1)[0].split(",");

const approvedConfigEvidence = [
  ["6717613539421", "39821206192221", 439, "kior-health-astragalus-60-caps", "20220001", "0-754590-525916"],
  ["6717636903005", "39821296009309", 438, "kior-health-super-beets-60-caps", "20220012", null],
  ["6717637328989", "39821296992349", 437, "kior-health-clear-mind-60-caps", "20220003", null],
  ["6758522355805", "39962446921821", 435, "kior-health-collagen-probio-60-caps", "20220004", "0-754590-525954"],
  ["6758526025821", "39962452426845", 458, "kior-health-digestive-enzyme", "20220006", null],
  ["6758548078685", "39962495746141", 434, "kior-health-turmeric--ginger-60-caps", "20220013", null],
  ["6766403551325", "39984169058397", 442, "kior-health-ksm-66-ashwaganda-60-caps", "20220009", null],
  ["6825707929693", "40172596068445", 436, "kior-health-brain-wave-60-caps", "20220002", null],
  ["6825718546525", "40172613533789", 441, "kior-health-green-tea-60-caps", "20220007", null],
  ["7067692138589", "40939513741405", 460, "kior-health-collagen-glow", null, null],
  ["7067692531805", "40939514232925", 461, "kior-health-collagen-super", null, null],
];

function productFor(item, overrides = {}) {
  return {
    id: Number(item.shopify_product_id), title: item.canonical_name, handle: item.expected_handle,
    vendor: "KIOR", updated_at: "2026-07-11T12:00:00Z", body_html: "DO NOT IMPORT BODY",
    images: [{ src: `https://cdn.test/${item.shopify_product_id}.jpg` }],
    variants: [{ id: Number(item.shopify_variant_id), product_id: Number(item.shopify_product_id), title: "Default Title", sku: `SKU-${item.shopify_product_id}`, price: item.approved_price.toFixed(2), available: item.approved_in_stock, updated_at: "2026-07-11T12:00:00Z", grams: 999 }],
    ...overrides,
  };
}

function fixture(options = {}) {
  const products = config.products.map((item) => productFor(item));
  if (options.extra) products.push({ id: 999999, title: "Unmapped", handle: "unmapped", vendor: "KIOR", images: [], variants: [{ id: 888888, sku: "", price: "1.00", available: true }] });
  const exportLines = ["Handle,Variant SKU,Variant Inventory Qty,Variant Barcode,Variant Grams,Body (HTML),Image Src"];
  for (const item of config.products) {
    exportLines.push(`${item.expected_handle},'SKU-${item.shopify_product_id},${item.approved_in_stock ? 5 : 0},BAR-${item.shopify_product_id},999,NEVER,https://csv.test/main.jpg`);
    exportLines.push(`${item.expected_handle},,,,,,https://csv.test/extra.jpg`);
  }
  return { products, groups: parseExport(`${exportLines.join("\n")}\n`) };
}

function build(options = {}) {
  const data = fixture(options);
  return buildCanonical({ config: structuredClone(config), shopify: { products: data.products }, exportGroups: data.groups, templateHeader: header });
}

test("config preserves 11 approved identities and explicit SKU/barcode evidence", () => {
  assert.equal(config.products.length, 11);
  assert.deepEqual(
    config.products.map((item) => [
      item.shopify_product_id,
      item.shopify_variant_id,
      item.canonical_product_id,
      item.canonical_slug,
      item.expected_sku,
      item.expected_barcode,
    ]),
    approvedConfigEvidence,
  );

  assert.equal(new Set(config.products.map((item) => item.shopify_product_id)).size, 11);
  assert.equal(new Set(config.products.map((item) => item.shopify_variant_id)).size, 11);
  assert.equal(config.products.filter((item) => typeof item.expected_sku === "string").length, 9);
  assert.equal(config.products.filter((item) => item.expected_sku === null).length, 2);
  assert.equal(config.products.filter((item) => typeof item.expected_barcode === "string").length, 2);
  assert.equal(config.products.filter((item) => item.expected_barcode === null).length, 9);
  for (const item of config.products) {
    assert.equal(Object.hasOwn(item, "expected_sku"), true);
    assert.equal(Object.hasOwn(item, "expected_barcode"), true);
    if (typeof item.expected_sku === "string") assert.notEqual(item.expected_sku.trim(), "");
    if (typeof item.expected_barcode === "string") assert.notEqual(item.expected_barcode.trim(), "");
    for (const forbidden of ["gtin", "verified_metrics", "inventory_quantity", "variant_grams", "body_html", "raw_csv_data"]) {
      assert.equal(Object.hasOwn(item, forbidden), false);
    }
  }

  const serialized = JSON.stringify(config).toLowerCase();
  for (const forbidden of ["supabase_service_role_key", ".env.local", "products_export.csv", "c:\\", "/users/", "/home/"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("maps exactly 11 approved products in stable product/variant order", () => {
  const result = build({ extra: true });
  assert.equal(result.rows.length, 11);
  assert.equal(result.unmappedProducts.length, 1);
  const ids = result.rows.map((row) => [BigInt(row.external_product_id), BigInt(row.external_variant_id)]);
  assert.deepEqual(ids, [...ids].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1));
});

test("canonical header exactly matches template and URLs include variant IDs", () => {
  const result = build();
  assert.deepEqual(result.csv.split("\n", 1)[0].split(","), header);
  for (const row of result.rows) assert.equal(row.external_url, `https://kior.uk/products/${row.external_url.split("/products/")[1].split("?")[0]}?variant=${row.external_variant_id}`);
});

test("uses live availability, CSV barcode, image fallback, and approved canonical fields only", () => {
  const result = build();
  assert.equal(result.rows.filter((row) => row.in_stock === "true").length, 10);
  assert.equal(result.rows.filter((row) => row.in_stock === "false").length, 1);
  assert.match(result.rows[0].external_gtin, /^BAR-/);
  assert.match(result.rows[0].image, /^https:\/\/cdn\.test\//);
  assert.equal(result.rows[0].description, "");
  assert.equal(result.csv.includes("DO NOT IMPORT BODY"), false);
  assert.equal(result.csv.includes("NEVER"), false);
  assert.equal(header.includes("Variant Grams"), false);
  for (const forbidden of ["canonical_product_id", "gtin", "net_weight_g", "nutrition_verified"]) assert.equal(header.includes(forbidden), false);
});

test("adapter still requires local CSV data and does not use config evidence as output", () => {
  const data = fixture();
  const modified = structuredClone(config);
  modified.products[0].expected_sku = "CONFIG-ONLY-SKU";
  modified.products[0].expected_barcode = "CONFIG-ONLY-BARCODE";
  const result = buildCanonical({ config: modified, shopify: { products: data.products }, exportGroups: data.groups, templateHeader: header });
  assert.equal(result.rows[0].external_gtin, `BAR-${result.rows[0].external_product_id}`);
  assert.equal(result.csv.includes("CONFIG-ONLY-SKU"), false);
  assert.equal(result.csv.includes("CONFIG-ONLY-BARCODE"), false);
  assert.throws(
    () => buildCanonical({ config: modified, shopify: { products: data.products }, exportGroups: new Map(), templateHeader: header }),
    /No Shopify CSV rows/,
  );
});

test("ignores additional image rows in Shopify CSV", () => assert.doesNotThrow(() => build()));

test("rejects duplicate Shopify product and variant IDs", () => {
  const a = fixture();
  a.products.push(structuredClone(a.products[0]));
  assert.throws(() => buildCanonical({ config, shopify: { products: a.products }, exportGroups: a.groups, templateHeader: header }), /Duplicate Shopify product ID/);
  const b = fixture();
  b.products[1].variants[0].id = b.products[0].variants[0].id;
  assert.throws(() => buildCanonical({ config, shopify: { products: b.products }, exportGroups: b.groups, templateHeader: header }), /Duplicate Shopify variant ID/);
});

test("rejects missing product, changed variant, and changed handle", () => {
  const missing = fixture(); missing.products.pop();
  assert.throws(() => buildCanonical({ config, shopify: { products: missing.products }, exportGroups: missing.groups, templateHeader: header }), /Missing configured Shopify products/);
  const variant = fixture(); variant.products[0].variants[0].id = 123;
  assert.throws(() => buildCanonical({ config, shopify: { products: variant.products }, exportGroups: variant.groups, templateHeader: header }), /Configured variant .* is missing/);
  const handle = fixture(); handle.products[0].handle = "changed";
  assert.throws(() => buildCanonical({ config, shopify: { products: handle.products }, exportGroups: handle.groups, templateHeader: header }), /No Shopify CSV rows|handle changes/);
});

test("rejects SKU conflict and ambiguous CSV join", () => {
  const sku = fixture(); sku.products[0].variants[0].sku = "CONFLICT";
  assert.throws(() => buildCanonical({ config, shopify: { products: sku.products }, exportGroups: sku.groups, templateHeader: header }), /SKU mismatches/);
  const ambiguous = fixture(); ambiguous.groups.get(config.products[0].expected_handle).push({ Handle: config.products[0].expected_handle, "Variant SKU": "SECOND", "Variant Price": "9.99" });
  assert.throws(() => buildCanonical({ config, shopify: { products: ambiguous.products }, exportGroups: ambiguous.groups, templateHeader: header }), /Ambiguous Shopify CSV join/);
});

test("rejects invalid and excessive price changes", () => {
  for (const price of ["", "0", "NaN", "Infinity"]) {
    const data = fixture(); data.products[0].variants[0].price = price;
    assert.throws(() => buildCanonical({ config, shopify: { products: data.products }, exportGroups: data.groups, templateHeader: header }), /Invalid live price/);
  }
  const jump = fixture(); jump.products[0].variants[0].price = (config.products[0].approved_price * 1.26).toFixed(2);
  assert.throws(() => buildCanonical({ config, shopify: { products: jump.products }, exportGroups: jump.groups, templateHeader: header }), /Price change exceeds threshold/);
});

test("rejects mass stock flip", () => {
  const data = fixture();
  for (let index = 0; index < 4; index += 1) data.products[index].variants[0].available = !config.products[index].approved_in_stock;
  assert.throws(() => buildCanonical({ config, shopify: { products: data.products }, exportGroups: data.groups, templateHeader: header }), /Stock change threshold exceeded/);
});

function response(body, status = 200) {
  return { status, headers: { get: () => null }, text: async () => body };
}

test("fetch rejects HTTP errors, invalid JSON, empty products, and duplicate IDs", async () => {
  await assert.rejects(fetchJson("x", { timeoutMs: 50, maxBytes: 1000, fetchImpl: async () => response("x", 503) }), /HTTP 503/);
  await assert.rejects(fetchJson("x", { timeoutMs: 50, maxBytes: 1000, fetchImpl: async () => response("{" ) }), /not valid JSON/);
  await assert.rejects(fetchJson("x", { timeoutMs: 50, maxBytes: 1000, fetchImpl: async () => response('{"products":[]}') }), /empty/);
});

test("fetch enforces timeout", async () => {
  await assert.rejects(fetchJson("x", { timeoutMs: 5, maxBytes: 1000, fetchImpl: (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")))) }), /aborted/);
});

test("atomicWrite creates and replaces the final file without leaving a temporary file", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kior-atomic-"));
  const target = path.join(directory, "output.csv");
  atomicWrite(target, "old");
  atomicWrite(target, "complete");
  assert.equal(fs.readFileSync(target, "utf8"), "complete");
  assert.deepEqual(fs.readdirSync(directory), ["output.csv"]);
});

test("canonical mapping validation performs a read-only ID and slug check", async () => {
  const calls = [];
  const client = {
    from(table) {
      calls.push(["from", table]);
      return {
        select(columns) {
          calls.push(["select", columns]);
          return {
            async in(column, values) {
              calls.push(["in", column, values]);
              return { data: config.products.map((item) => ({ id: item.canonical_product_id, slug: item.canonical_slug })), error: null };
            },
          };
        },
      };
    },
  };
  await validateCanonicalMappings(config, client);
  assert.deepEqual(calls.map((call) => call[0]), ["from", "select", "in"]);
  assert.equal(calls.some((call) => ["insert", "update", "upsert", "delete"].includes(call[0])), false);
});

test("child process receives only importer path, feed mode, dry-run, and csv", () => {
  let captured;
  const result = runImporter("C:\\tmp\\generated.csv", (command, args, options) => { captured = { command, args, options }; return { status: 0, stdout: "Dry run: no database writes performed.\n", stderr: "" }; });
  assert.equal(captured.command, process.execPath);
  assert.deepEqual(captured.args.slice(1), ["--mode=feed", "--dry-run", "--csv=C:\\tmp\\generated.csv"]);
  assert.equal(captured.args.includes("--safe-create"), false);
  assert.equal(captured.args.some((arg) => /apply/i.test(arg)), false);
  assert.match(result.output, /no database writes/);
});

test("generated CSV parses to 11 rows without verified metrics", () => {
  const rows = parse(build().csv, { columns: true, skip_empty_lines: true });
  assert.equal(rows.length, 11);
  assert.equal(Object.hasOwn(rows[0], "canonical_product_id"), false);
  assert.equal(Object.hasOwn(rows[0], "net_weight_g"), false);
});
