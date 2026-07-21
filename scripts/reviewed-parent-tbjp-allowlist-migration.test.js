const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260721113000_allow_reviewed_tbjp_parent_variants.sql"
);
const sql = fs.readFileSync(migrationPath, "utf8");

test("TBJP reviewed parent migration replaces only the allowlist helper", () => {
  assert.match(sql, /^begin;\s/i);
  assert.match(sql, /create or replace function public\.atomic_import_reviewed_parent_variant_allowed/i);
  assert.match(sql, /commit;\s*$/i);
  assert.doesNotMatch(sql, /\bcreate\s+role\b/i);
  assert.doesNotMatch(sql, /\bcreate\s+user\b/i);
  assert.doesNotMatch(sql, /\bgrant\b/i);
  assert.doesNotMatch(sql, /\brevoke\b/i);
  assert.doesNotMatch(sql, /\b(insert|update|delete)\s+into?\s+public\.(products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
});

test("TBJP reviewed parent migration contains exactly the seven approved families", () => {
  for (const family of [
    "Trained By JP ISO PRO 1.8kg",
    "Trained By JP Performance Isolate Tri Blend 2kg",
    "Trained By JP Performance Protein 1kg",
    "Trained By JP Performance Protein 2kg",
    "Trained By JP DNFM PRE 40 Servings",
    "Trained By JP PrePare Pro 400g",
    "Trained By JP Pumpage Pre Workout 400g",
  ]) {
    assert.match(sql, new RegExp(family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(sql, /Trained By JP Hydration 300g/);
  assert.doesNotMatch(sql, /Trained By JP Cream Of Rice 2kg/);
  assert.doesNotMatch(sql, /Trained By JP Collagen Powder/);
});

test("TBJP reviewed parent migration preserves exact category, format and size separation", () => {
  assert.match(sql, /\('Trained By JP ISO PRO 1\.8kg','Trained By JP','Whey Protein','powder','1800','g'\)/);
  assert.match(sql, /\('Trained By JP Performance Isolate Tri Blend 2kg','Trained By JP','Whey Protein','powder','2000','g'\)/);
  assert.match(sql, /\('Trained By JP Performance Protein 1kg','Trained By JP','Whey Protein','powder','1000','g'\)/);
  assert.match(sql, /\('Trained By JP Performance Protein 2kg','Trained By JP','Whey Protein','powder','2000','g'\)/);
  assert.match(sql, /\('Trained By JP DNFM PRE 40 Servings','Trained By JP','Pre Workout','powder','40','servings'\)/);
  assert.match(sql, /\('Trained By JP PrePare Pro 400g','Trained By JP','Pre Workout','powder','400','g'\)/);
  assert.match(sql, /\('Trained By JP Pumpage Pre Workout 400g','Trained By JP','Pre Workout','powder','400','g'\)/);
});
