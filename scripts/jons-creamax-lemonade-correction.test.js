const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.resolve(
  "supabase/migrations/20260803130000_correct_jons_creamax_lemonade_variant.sql",
), "utf8");
const rollback = fs.readFileSync(path.resolve(
  "supabase/rollbacks/20260803130000_correct_jons_creamax_lemonade_variant.sql",
), "utf8");

test("Creamax correction is exact, identity-only and production-bound", () => {
  assert.match(migration, /product_variant.*id=1255|id=1255 and product_id=850/s);
  assert.match(migration, /retailer_products[\s\S]+id=1369/);
  assert.match(migration, /offers[\s\S]+id=1183/);
  assert.match(migration, /external_variant_id='50844852519250'/);
  assert.match(migration, /variant_key='lemonade-460g'/);
  assert.match(migration, /display_name='Lemonade \/ 460g'/);
  assert.match(migration, /external_options='\{"Size":"460g","Flavour":"Lemonade"\}'::jsonb/);
  assert.doesNotMatch(migration, /update\s+public\.offers|insert\s+into\s+public\.(products|product_variants|retailer_products|offers)|delete\s+from\s+public\./i);
  assert.match(migration, /target_environment'<>'PRODUCTION'/);
  assert.match(migration, /price=37\.49[\s\S]+shipping_cost=3\.99[\s\S]+total_price=41\.48/);
});

test("Creamax rollback refuses to run after offer refresh", () => {
  assert.match(rollback, /rollback is forbidden after corrected offer 1183 has been refreshed/);
  assert.match(rollback, /variant_key='default'/);
  assert.match(rollback, /external_options='\{\}'::jsonb/);
  assert.doesNotMatch(rollback, /update\s+public\.offers|delete\s+from\s+public\./i);
});
