const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parse } = require("csv-parse/sync");
const { parseSize } = require("./lib/feed-variant-guards");

const root = path.resolve(__dirname, "..");
const migrationPath = path.join(root, "supabase/migrations/20260720110000_align_serving_count_variant_size.sql");
const csvPath = path.join(root, "tmp/jons-54-variant-batch/jons-54-unlocked-variant-candidate.csv");
const migration = fs.readFileSync(migrationPath, "utf8");
const csvRows = parse(fs.readFileSync(csvPath, "utf8"), {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

function sameSize(left, right) {
  const a = parseSize(left);
  const b = parseSize(right);
  return Boolean(a && b && a.value === b.value && a.unit === b.unit && a.dimension === b.dimension);
}

test("DB size normalizer supports serving-count aliases without weakening weight units", () => {
  assert.match(migration, /atomic_import_normalize_size\(p_value text\)/);
  assert.match(migration, /serving\|servings\|serve\|serves/);
  assert.match(migration, /'unit', 'servings', 'dimension', 'count'/);
  assert.match(migration, /when 'kg' then jsonb_build_object\('value', v_amount \* 1000, 'unit', 'g', 'dimension', 'mass'\)/);
  assert.doesNotMatch(migration.toLowerCase(), /\b(?:insert|update|delete|merge|truncate)\s+(?:into\s+|from\s+)?public\.(?:products|product_variants|retailer_products|offers|price_history|retailers)\b/);
  assert.doesNotMatch(migration.toLowerCase(), /\bcreate\s+(?:role|user)\b/);
});

test("serving-count semantic examples match locally and conflict cases stay blocked", () => {
  assert.equal(sameSize("25 servings", "25servings"), true);
  assert.equal(sameSize("25 servings", "25 Serving"), true);
  assert.equal(sameSize("25 serves", "25 serve"), true);
  assert.equal(sameSize("25 servings", "30 servings"), false);
  assert.equal(sameSize("25 servings", "500g"), false);
  assert.equal(sameSize("25 capsules", "25 servings"), false);
  assert.equal(sameSize("", "25 servings"), false);
});

test("authorised serving-based rows preserve explicit structured size and product format", () => {
  const servingRows = csvRows.filter((row) => row.size_unit === "servings");
  assert.equal(servingRows.length, 8);
  assert(servingRows.some((row) =>
    row.product_name === "Gas Mark 10 Pitbull Pump Pre Workout 25 Servings" &&
    row.flavour === "Sherbert Candy" &&
    row.external_variant_id === "53185997046098" &&
    row.external_sku === "GMK02002" &&
    row.size === "25" &&
    row.size_unit === "servings" &&
    row.product_format === "powder" &&
    sameSize(JSON.parse(row.external_options).Size, `${row.size}${row.size_unit}`)
  ));
  for (const row of servingRows) {
    assert.equal(row.product_format, "powder");
    assert.equal(row.pack_count, "1");
    assert.equal(sameSize(JSON.parse(row.external_options).Size, `${row.size}${row.size_unit}`), true);
  }
});

test("previously applied gram rows and remaining authorised rows are represented in CSV", () => {
  const appliedFamilies = new Map([
    ["Apex Formulas Cream of Oats 2kg", 7],
    ["Efectiv Whey Protein 60 Serving 1.8kg", 6],
    ["Strom Sports Cream of Rice 2kg", 6],
  ]);
  for (const [product, count] of appliedFamilies) {
    assert.equal(csvRows.filter((row) => row.product_name === product).length, count);
  }
  assert.equal(csvRows.length, 38);
  assert.equal(new Set(csvRows.map((row) => row.external_variant_id)).size, 38);
});
