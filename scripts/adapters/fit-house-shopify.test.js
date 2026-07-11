const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { parse } = require("csv-parse/sync");

const { atomicWrite } = require("./kior-shopify");
const {
  buildCanonical,
  importerCommand,
  main,
  runImporter,
  sha256,
  validateConfig,
} = require("./fit-house-shopify");

const ROOT = path.resolve(__dirname, "../..");
const fullConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "config/retailers/fit-house-shopify.json"), "utf8"));
const config = {
  ...structuredClone(fullConfig),
  products: structuredClone(fullConfig.products.slice(0, 10)),
};
const header = fs.readFileSync(path.join(ROOT, "data/templates/retailer-feed-template.csv"), "utf8").split(/\r?\n/, 1)[0].split(",");
const forbidden = ["canonical_product_id", "gtin", "product_gtin_verified", "free_shipping_threshold", "net_weight_g", "net_volume_ml", "unit_count", "unit_type", "servings", "nutrition_verified", "Variant Grams", "Body HTML", "SKU", "inventory quantity"];

function sourceProduct(item, overrides = {}) {
  return {
    id: Number(item.shopify_product_id),
    title: item.canonical_name,
    handle: item.expected_handle,
    vendor: item.brand,
    updated_at: "2026-07-11T12:00:00Z",
    body_html: "FORBIDDEN BODY",
    images: [{ src: `https://cdn.shopify.com/s/files/1/fit-house/${item.shopify_product_id}.jpg` }],
    variants: [{
      id: Number(item.shopify_variant_id), product_id: Number(item.shopify_product_id), title: "Default Title",
      price: item.approved_price.toFixed(2), available: item.approved_in_stock, sku: "FORBIDDEN-SKU",
      grams: 999, updated_at: "2026-07-11T12:00:00Z",
    }],
    ...overrides,
  };
}

function source(options = {}) {
  const products = config.products.map((item) => sourceProduct(item));
  if (options.unmapped) products.push({
    id: 999999999, title: "Unmapped", handle: "unmapped", vendor: "Other", updated_at: "2026-07-11T12:00:00Z",
    images: [{ src: "https://cdn.shopify.com/unmapped.jpg" }], variants: [{ id: 888888888, product_id: 999999999, price: "1.00", available: true }],
  });
  return { products };
}

function build(shopify = source(), configured = config) {
  return buildCanonical({ config: structuredClone(configured), shopify, templateHeader: header });
}

test("valid source produces exactly ten approved canonical rows and reports unmapped products", () => {
  const result = build(source({ unmapped: true }));
  assert.equal(result.rows.length, 10);
  assert.equal(result.unmapped_products.length, 1);
  assert.equal(result.rows.some((row) => row.external_product_id === "999999999"), false);
  assert.deepEqual(result.rows.map((row) => row.external_product_id), config.products.map((item) => item.shopify_product_id));
  for (const [index, row] of result.rows.entries()) {
    const item = config.products[index];
    assert.equal(row.slug, item.canonical_slug);
    assert.equal(row.product_name, item.canonical_name);
    assert.equal(row.brand, item.brand);
    assert.equal(row.external_url, `https://fithouse.uk/products/${item.expected_handle}?variant=${item.shopify_variant_id}`);
    assert.equal(row.affiliate_url, row.external_url);
  }
});

test("generated CSV exactly matches the template and excludes forbidden fields and raw metadata", () => {
  const result = build();
  assert.deepEqual(result.csv.split("\n", 1)[0].split(","), header);
  const rows = parse(result.csv, { columns: true, skip_empty_lines: true });
  assert.equal(rows.length, 10);
  for (const field of forbidden) assert.equal(header.includes(field), false);
  assert.equal(result.csv.includes("FORBIDDEN BODY"), false);
  assert.equal(result.csv.includes("FORBIDDEN-SKU"), false);
  assert.equal(result.csv.includes("999"), false);
  assert.ok(rows.every((row) => row.description === "" && row.external_gtin === "" && row.shipping_cost === "3.99"));
});

test("config guard enforces ten unique product IDs, variant IDs, slugs, and handles", () => {
  assert.doesNotThrow(() => validateConfig(structuredClone(config)));
  assert.throws(() => validateConfig(structuredClone(fullConfig)), /exactly 10/);
  for (const key of ["shopify_product_id", "shopify_variant_id", "canonical_slug", "expected_handle"]) {
    const changed = structuredClone(config);
    changed.products[1][key] = changed.products[0][key];
    assert.throws(() => validateConfig(changed), /Duplicate or missing/);
  }
  const extra = structuredClone(config); extra.products.push(structuredClone(extra.products[0]));
  assert.throws(() => validateConfig(extra), /exactly 10/);
});

test("missing product, changed product ID, changed variant ID, and variant ownership mismatch block the run", () => {
  const missing = source(); missing.products.pop();
  assert.throws(() => build(missing), /Missing configured Shopify products/);
  const productId = source(); productId.products[0].id = 123;
  assert.throws(() => build(productId), /Missing configured Shopify products/);
  const variantId = source(); variantId.products[0].variants[0].id = 123;
  assert.throws(() => build(variantId), /Configured variant .* is missing/);
  const owner = source(); owner.products[0].variants[0].product_id = 123;
  assert.throws(() => build(owner), /variant product ID mismatch/);
});

test("handle and vendor drift block while stock drift is reported", () => {
  const handle = source(); handle.products[0].handle = "changed";
  assert.throws(() => build(handle), /handle changes/);
  const vendor = source(); vendor.products[0].vendor = "Unexpected Vendor";
  assert.throws(() => build(vendor), /vendor mismatches/);
  const stock = source(); stock.products[0].variants[0].available = false;
  const result = build(stock);
  assert.equal(result.stock_changes.length, 1);
  assert.equal(result.rows[0].in_stock, "false");
});

test("invalid and excessive live prices are rejected", () => {
  for (const price of ["", "0", "NaN", "Infinity"]) {
    const shopify = source(); shopify.products[0].variants[0].price = price;
    assert.throws(() => build(shopify), /Invalid live price/);
  }
  const drift = source(); drift.products[0].variants[0].price = (config.products[0].approved_price * 1.251).toFixed(2);
  assert.throws(() => build(drift), /exceeds 25%/);
});

test("duplicate source product and variant IDs block the run", () => {
  const products = source(); products.products.push(structuredClone(products.products[0]));
  assert.throws(() => build(products), /Duplicate Shopify product ID/);
  const variants = source(); variants.products[1].variants[0].id = variants.products[0].variants[0].id;
  assert.throws(() => build(variants), /Duplicate Shopify variant ID/);
});

test("invalid image and retailer URLs are rejected", () => {
  const image = source(); image.products[0].images[0].src = "http://cdn.shopify.com/image.jpg";
  assert.throws(() => build(image), /Invalid Shopify images/);
  const retailer = structuredClone(config); retailer.retailer.website = "https://evil.example";
  assert.throws(() => validateConfig(retailer), /Unexpected Fit House retailer identity/);
  const timestamp = source(); timestamp.products[0].variants[0].updated_at = "not-a-date";
  assert.throws(() => build(timestamp), /Invalid source_updated_at/);
});

test("importer child process has only fixed safe-create dry-run arguments and no apply", () => {
  let captured;
  const csvPath = "C:\\tmp\\fit-house.csv";
  const result = runImporter(csvPath, (command, args, options) => {
    captured = { command, args, options };
    return { status: 0, stdout: "Dry run: no database writes performed.\n", stderr: "" };
  });
  assert.deepEqual(captured.args.slice(1), ["--mode=feed", "--safe-create", "--dry-run", `--csv=${csvPath}`]);
  assert.equal(captured.args.some((arg) => /apply/i.test(arg)), false);
  assert.equal(result.database_writes, 0);
  assert.match(result.output, /no database writes/);
  assert.deepEqual(importerCommand(csvPath).slice(2), ["--mode=feed", "--safe-create", "--dry-run", `--csv=${csvPath}`]);
});

test("adapter rejects every additional CLI argument before fetching or importing", async () => {
  let fetched = false;
  let imported = false;
  await assert.rejects(main({ argv: ["--dry-run"], fetchImpl: async () => { fetched = true; }, runImporter: () => { imported = true; } }), /does not accept CLI arguments/);
  assert.equal(fetched, false);
  assert.equal(imported, false);
});

test("atomic output replaces complete files, cleans temporary files, and checksum is deterministic", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fit-house-atomic-"));
  const target = path.join(directory, "output.csv");
  atomicWrite(target, "old");
  assert.throws(() => atomicWrite(target, Symbol("invalid")), TypeError);
  assert.equal(fs.readFileSync(target, "utf8"), "old");
  assert.deepEqual(fs.readdirSync(directory), ["output.csv"]);
  atomicWrite(target, "complete");
  assert.equal(fs.readFileSync(target, "utf8"), "complete");
  assert.deepEqual(fs.readdirSync(directory), ["output.csv"]);
  assert.equal(sha256(build().csv), sha256(build().csv));
});
