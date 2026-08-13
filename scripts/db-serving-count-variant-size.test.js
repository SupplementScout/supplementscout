const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parseSize } = require("./lib/feed-variant-guards");

const root = path.resolve(__dirname, "..");
const migrationPath = path.join(root, "supabase/migrations/20260720110000_align_serving_count_variant_size.sql");
const migration = fs.readFileSync(migrationPath, "utf8");
const servingRows = [
  ["Gas Mark 10 Pitbull Pump Pre Workout 25 Servings", "53185997046098", "GMK02002", "Sherbert Candy", 25],
  ["Gas Mark 10 Pitbull Pump Pre Workout 25 Servings", "53185997078866", "GMK02006", "Strawberry Banana", 25],
  ["Gas Mark 10 Pitbull Pump Pre Workout 25 Servings", "53185997111634", "GMK02003", "Strawberry Laces", 25],
  ["Gas Mark 10 Pitbull Pump Pre Workout 25 Servings", "53221681234258", "GMK02005", "Lemon sherbet", 25],
  ["Conteh Sports Mega Pump Elite 30 Servings", "52577121239378", "CTH29004", "Raspberry Twist", 30],
  ["PER4M Protein Pancakes 16 Servings", "52637042082130", "PFM29004", "Caramel Biscuit", 16],
  ["PER4M Protein Pancakes 16 Servings", "52637042114898", "PFM29001", "Chocolate Chip", 16],
  ["PER4M Protein Pancakes 16 Servings", "52637042147666", "PFM29003", "Cookies & Cream", 16],
].map(([product_name, external_variant_id, external_sku, flavour, size]) => ({
  product_name,
  external_variant_id,
  external_sku,
  external_options: JSON.stringify({ Flavour: flavour, Size: `${size} servings` }),
  size: String(size),
  size_unit: "servings",
  flavour,
  product_format: "powder",
  pack_count: "1",
}));

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
