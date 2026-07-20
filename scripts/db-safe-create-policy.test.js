const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260720103000_align_safe_create_reviewed_families.sql"
);

const sql = fs.readFileSync(migrationPath, "utf8");

test("DB safe-create migration replaces only the reviewed-family policy predicate", () => {
  assert.match(sql, /atomic_import_safe_create_category_allowed\(text,text,text\)/);
  assert.match(sql, /atomic_import_validate_standard_plan_core\(jsonb\)/);
  assert.match(sql, /atomic_import_apply_standard_plan_core\(jsonb\)/);
  assert.match(sql, /execute replace\(v_definition, v_original, v_replacement\)/);
  assert.match(sql, /p_plan#>>''\{product,values,name\}''/);
  assert.match(sql, /p_plan#>>''\{product,values,product_format\}''/);
});

test("DB safe-create migration includes every Marek-reviewed family and no broad unrelated category", () => {
  for (const expected of [
    "efectiv[[:space:]]+whey[[:space:]]+protein",
    "whey([[:space:]]+protein)?[[:space:]]+isolate",
    "egg[[:space:]]+white[[:space:]]+protein",
    "pitbull[[:space:]]+pump",
    "mega[[:space:]]+pump[[:space:]]+elite",
    "pump[[:space:]]+pre",
    "essential",
    "greens",
    "cream[[:space:]]+of[[:space:]]+rice",
    "cream[[:space:]]+of[[:space:]]+oats",
    "protein[[:space:]]+pancakes",
  ]) {
    assert.equal(sql.toLowerCase().includes(expected.toLowerCase()), true, expected);
  }

  assert.doesNotMatch(sql, /'Accessories'/);
  assert.doesNotMatch(sql, /'Protein Bars'/);
  assert.doesNotMatch(sql, /'Mass Gainer'/);
});

test("DB safe-create migration keeps reviewed families powder-only outside the base allowlist", () => {
  assert.match(sql, /coalesce\(p_product_format, ''\) = 'powder'/);
  assert.match(sql, /coalesce\(p_category, ''\) = 'Whey Protein'/);
  assert.match(sql, /coalesce\(p_category, ''\) = 'Pre Workout'/);
  assert.match(sql, /coalesce\(p_category, ''\) in \('Vitamins','Health Supplements','Amino Acids','Creatine'\)/);
});
