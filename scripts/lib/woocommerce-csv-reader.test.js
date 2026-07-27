const assert = require("node:assert/strict");
const test = require("node:test");
const { parseWooCommerceCsv } = require("./woocommerce-csv-reader");

const HEADER = [
  "ID", "Type", "SKU", "GTIN, UPC, EAN, or ISBN", "Name", "Published",
  "In stock?", "Short description", "Description", "Sale price", "Regular price",
  "Categories", "Tags", "Images", "Parent", "EAN", "Brands",
  "Meta: _wpm_gtin_code", "Attribute 1 name", "Attribute 1 value(s)",
  "Attribute 2 name", "Attribute 2 value(s)", "Attribute 3 name",
  "Attribute 3 value(s)",
];

function cell(value) {
  const string = String(value ?? "");
  return /[",\r\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

function csv(rows) {
  return `${[HEADER, ...rows.map((row) => HEADER.map((key) => row[key] ?? ""))]
    .map((row) => row.map(cell).join(","))
    .join("\n")}\n`;
}

const base = {
  Published: "1",
  "In stock?": "1",
  Categories: "Protein",
  Images: "https://example.test/product.jpg",
};

test("normalizes simple products and keeps retailer GTIN external", () => {
  const result = parseWooCommerceCsv(csv([{
    ...base,
    ID: "10",
    Type: "simple",
    SKU: "SKU-10",
    "GTIN, UPC, EAN, or ISBN": "05012345678901",
    Name: "Example Whey 1kg",
    "Regular price": "29.99",
    "Attribute 1 name": "Brands",
    "Attribute 1 value(s)": "Example Nutrition",
  }]), { storeUrl: "https://shop.example.test", capturedAt: "2026-07-27T12:00:00.000Z" });
  assert.equal(result.counts.eligible_records, 1);
  assert.deepEqual(result.records[0], {
    source_record_id: "10",
    immutable_source_identity: "10:10",
    source_type: "simple",
    external_product_id: "10",
    external_variant_id: "10",
    external_sku: "SKU-10",
    external_gtin: "05012345678901",
    product_name: "Example Whey 1kg",
    variant_name: "Example Whey 1kg",
    brand: "Example Nutrition",
    categories: ["Protein"],
    description: null,
    image_url: "https://example.test/product.jpg",
    external_options: { Brands: "Example Nutrition" },
    product_url: "https://shop.example.test/?p=10",
    variant_url: "https://shop.example.test/?p=10",
    regular_price: "29.99",
    sale_price: null,
    price: "29.99",
    in_stock: true,
    published: true,
    policy_state: "ELIGIBLE",
    policy_code: "ELIGIBLE",
    policy_evidence: null,
    source_fingerprint: result.records[0].source_fingerprint,
  });
  assert.match(result.records[0].source_fingerprint, /^[0-9a-f]{64}$/);
});

test("joins variations through parent SKU and id references", () => {
  const result = parseWooCommerceCsv(csv([
    { ...base, ID: "20", Type: "variable", SKU: "PARENT-20", Name: "Example Creatine 500g", "Attribute 1 name": "Brands", "Attribute 1 value(s)": "Example" },
    { ...base, ID: "21", Type: "variation", Name: "Example Creatine 500g - Cherry", Parent: "PARENT-20", "Regular price": "19.99", "Attribute 1 name": "Flavour", "Attribute 1 value(s)": "Cherry" },
    { ...base, ID: "22", Type: "variation", Name: "Example Creatine 500g - Lemon", Parent: "id:20", "Regular price": "20.99", "Attribute 1 name": "Flavour", "Attribute 1 value(s)": "Lemon" },
  ]), { storeUrl: "https://shop.example.test", capturedAt: "2026-07-27T12:00:00.000Z" });
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.records.map((row) => row.immutable_source_identity), ["20:21", "20:22"]);
  assert.deepEqual(result.records.map((row) => row.brand), ["Example", "Example"]);
});

test("excludes SARMs, real peptide categories and positively expired rows", () => {
  const result = parseWooCommerceCsv(csv([
    { ...base, ID: "30", Type: "simple", Name: "Research product", Categories: "SARMs", "Regular price": "10" },
    { ...base, ID: "31", Type: "simple", Name: "Peptide product", Categories: "Peptides", "Regular price": "11" },
    { ...base, ID: "32", Type: "simple", Name: "Short date whey BBE 06/2026", Categories: "Protein", "Regular price": "12" },
    { ...base, ID: "33", Type: "simple", Name: "Collagen Peptides", Categories: "Collagen", "Regular price": "13" },
  ]), { storeUrl: "https://shop.example.test", capturedAt: "2026-07-27T12:00:00.000Z" });
  assert.deepEqual(result.records.map((row) => row.policy_code), [
    "EXCLUDE_SARM",
    "EXCLUDE_PEPTIDE",
    "EXCLUDE_EXPIRED",
    "ELIGIBLE",
  ]);
});

test("quarantines orphan and missing-price variations without aborting the snapshot", () => {
  const result = parseWooCommerceCsv(csv([
    { ...base, ID: "40", Type: "variation", Name: "", Parent: "", "Regular price": "10" },
    { ...base, ID: "50", Type: "variable", SKU: "PARENT-50", Name: "Example Pre Workout" },
    { ...base, ID: "51", Type: "variation", Name: "Example Pre Workout - Berry", Parent: "PARENT-50" },
  ]), { storeUrl: "https://shop.example.test", capturedAt: "2026-07-27T12:00:00.000Z" });
  assert.equal(result.records.length, 0);
  assert.deepEqual(result.issues.map((row) => row.code), [
    "BLOCK_ORPHAN_VARIATION",
    "BLOCK_MISSING_PRICE",
  ]);
});

test("fails closed on duplicate row IDs and unsupported product types", () => {
  const duplicate = csv([
    { ...base, ID: "60", Type: "simple", Name: "A", "Regular price": "10" },
    { ...base, ID: "60", Type: "simple", Name: "B", "Regular price": "11" },
  ]);
  assert.throws(() => parseWooCommerceCsv(duplicate, { storeUrl: "https://shop.example.test" }), /Duplicate WooCommerce row ID/);
  assert.throws(() => parseWooCommerceCsv(csv([
    { ...base, ID: "61", Type: "external", Name: "A", "Regular price": "10" },
  ]), { storeUrl: "https://shop.example.test" }), /Unsupported WooCommerce product type/);
});
