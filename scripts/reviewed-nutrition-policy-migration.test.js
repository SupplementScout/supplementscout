const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260721200000_allow_reviewed_jons_nutrition_families.sql"), "utf8");

test("nutrition policy migration adds exactly the reviewed canonical boundaries", () => {
  for (const value of [
    "('Strom Sports CarbMax 1.5kg','Strom','Health Supplements','powder','1500','g')",
    "('Strom Sports MealMAX 2.5kg','Strom','Health Supplements','powder','2500','g')",
    "('Strom Sports PerforMAX 900g','Strom','Health Supplements','powder','900','g')",
    "('PER4M Plant Protein 2kg','PER4M','Whey Protein','powder','2000','g')",
    "('Efectiv Hydration Electrolytes 330g','Efectiv','Health Supplements','powder','330','g')",
    "('Strom Sports Nihpro Hydrolysed Protein Isolate 40 Servings','Strom','Whey Protein','powder','40','servings')",
  ]) assert.ok(sql.includes(value), value);
  assert.doesNotMatch(sql, /like\s+'%|ilike|wildcard/i);
  assert.doesNotMatch(sql, /\b(create\s+role|create\s+user|grant|revoke)\b/i);
});

test("nutrition policy migration blocks prohibited catalogue types before every validator branch", () => {
  assert.match(sql, /prohibited catalogue type: SARM or peptide/);
  assert.match(sql, /optimised research labs \(vi-ron\|de-bol\|20-hydrox/);
  assert.match(sql, /bpc\[- \]\?157/);
  assert.match(sql, /if v_variant_action <> ''create_reviewed_variant'' then/);
  assert.doesNotMatch(sql, /\b(insert|update|delete)\s+(?:into\s+|from\s+)?public\.(products|product_variants|retailer_products|offers|price_history)\b/i);
});
