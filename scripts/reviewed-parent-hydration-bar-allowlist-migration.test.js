const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260721190000_allow_reviewed_jons_hydration_bar_parent_variants.sql"
);
const sql = fs.readFileSync(migrationPath, "utf8");

test("hydration/bar migration replaces only the existing reviewed-family helper", () => {
  assert.match(sql, /^begin;\s/i);
  assert.match(sql, /create or replace function public\.atomic_import_reviewed_parent_variant_allowed/i);
  assert.match(sql, /commit;\s*$/i);
  assert.doesNotMatch(sql, /\b(create\s+role|create\s+user|grant|revoke)\b/i);
  assert.doesNotMatch(sql, /\b(insert|update|delete)\s+into?\s+public\.(products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
});

test("hydration/bar migration adds exactly the five reviewed parent families", () => {
  for (const family of [
    "Conteh Sports Hydra Flow 300g",
    "PER4M Hydrate Electrolyte Mix 210g",
    "PER4M Protein Bars Box of 12 x 62g",
    "Strom Sports HydraMax 420g",
    "Strom Sports HydraMax 1.08kg",
  ]) assert.match(sql, new RegExp(family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.doesNotMatch(sql, /Hydra Flow 500g/);
  assert.doesNotMatch(sql, /HydraMax 500g/);
  assert.doesNotMatch(sql, /PER4M Protein Powder/i);
});

test("hydration/bar migration preserves exact brand, category, format, and size boundaries", () => {
  assert.match(sql, /\('Conteh Sports Hydra Flow 300g','Conteh Sports','Health Supplements','powder','300','g'\)/);
  assert.match(sql, /\('PER4M Hydrate Electrolyte Mix 210g','PER4M','Health Supplements','powder','210','g'\)/);
  assert.match(sql, /\('PER4M Protein Bars Box of 12 x 62g','PER4M','Protein Bars','bar','62','g'\)/);
  assert.match(sql, /\('Strom Sports HydraMax 420g','Strom','Health Supplements','powder','420','g'\)/);
  assert.match(sql, /\('Strom Sports HydraMax 1\.08kg','Strom','Health Supplements','powder','1080','g'\)/);
});
