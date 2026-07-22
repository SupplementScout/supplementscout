const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260722113000_allow_final_reviewed_jons_closeout.sql'), 'utf8');

test('final Jon\'s closeout migration is policy-only and exact', () => {
  for (const family of [
    'CNP ProDough Protein Bars Box of 12 x 60g', 'Efectiv Whey Protein 2kg',
    'PER4M Hydrate Unflavoured 159g', 'Strom Sports LipidMax 400g',
    'Time 4 Whey Protein Professional 1.8kg', 'Trained By JP Collagen Powder 300g',
    'Trained By JP Hydration 300g', 'Trained By JP Join-In 210g',
  ]) assert.match(migration, new RegExp(family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(migration, /cellucor\[\[:space:\]\]\+c4/);
  assert.match(migration, /v_external_sku is not null/);
  assert.match(migration, /perform public\.validate_product_import_plan_read_only\(p_plan\)/);
  assert.doesNotMatch(migration.toLowerCase(), /\b(?:insert|update|delete|merge|truncate)\s+(?:into\s+|from\s+)?public\.(?:products|product_variants|retailer_products|offers|price_history|retailers)\b/);
  assert.doesNotMatch(migration.toLowerCase(), /\bcreate\s+(?:role|user)\b|\bgrant\s+|\brevoke\s+/);
});

test('no-SKU exception remains fail-closed for SKU rows and multiple defaults', () => {
  assert.match(migration, /count\(\*\).*is_default\) > 1/s);
  assert.match(migration, /is_default\) = 0[\s\S]*v_external_sku is not null/);
  assert.doesNotMatch(migration, /external_sku[^\n]*globally optional/i);
});
