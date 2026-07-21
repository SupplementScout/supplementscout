const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260721125000_allow_reviewed_jons_preworkout_parent_variants.sql"
);
const sql = fs.readFileSync(migrationPath, "utf8");

test("Jon's reviewed pre-workout migration replaces only the allowlist helper", () => {
  assert.match(sql, /^begin;\s/i);
  assert.match(sql, /create or replace function public\.atomic_import_reviewed_parent_variant_allowed/i);
  assert.match(sql, /commit;\s*$/i);
  assert.doesNotMatch(sql, /\bcreate\s+role\b/i);
  assert.doesNotMatch(sql, /\bcreate\s+user\b/i);
  assert.doesNotMatch(sql, /\bgrant\b/i);
  assert.doesNotMatch(sql, /\brevoke\b/i);
  assert.doesNotMatch(sql, /\b(insert|update|delete)\s+into?\s+public\.(products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
});

test("Jon's reviewed pre-workout migration contains exactly the five approved new families", () => {
  for (const family of [
    "ABE All Black Everything Pre-Workout 375g",
    "PER4M Energy Pre Workout 390g",
    "HR Labs DEFIB V3 Pre-Workout 420g",
    "Gas Mark 10 No Games Pre Workout 30 Servings",
    "Innovapharm MVPRE 3.0 Pre Workout 437g",
  ]) {
    assert.match(sql, new RegExp(family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(sql, /DEFIB Original/i);
  assert.doesNotMatch(sql, /HR Labs DEFIB Pre-Workout 480g/i);
  assert.doesNotMatch(sql, /Innovapharm MVPRE Pre-Workout 3\.0 40\/20 servings/i);
  assert.doesNotMatch(sql, /ABE Energy/i);
});

test("Jon's reviewed pre-workout migration preserves exact brand, format and size separation", () => {
  assert.match(sql, /\('ABE All Black Everything Pre-Workout 375g','ABE All','Pre Workout','powder','375','g'\)/);
  assert.match(sql, /\('PER4M Energy Pre Workout 390g','PER4M','Pre Workout','powder','390','g'\)/);
  assert.match(sql, /\('HR Labs DEFIB V3 Pre-Workout 420g','HR Labs','Pre Workout','powder','420','g'\)/);
  assert.match(sql, /\('Gas Mark 10 No Games Pre Workout 30 Servings','Gas Mark 10','Pre Workout','powder','30','servings'\)/);
  assert.match(sql, /\('Innovapharm MVPRE 3\.0 Pre Workout 437g','Innovapharm','Pre Workout','powder','437','g'\)/);
});
