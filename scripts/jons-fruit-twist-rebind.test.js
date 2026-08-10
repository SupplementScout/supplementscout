const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const migration = fs.readFileSync(
  "supabase/migrations/20260810190000_rebind_jons_loaded_eaa_fruit_twist_variant.sql",
  "utf8",
);
const rollback = fs.readFileSync(
  "supabase/rollbacks/20260810190000_rebind_jons_loaded_eaa_fruit_twist_variant.sql",
  "utf8",
);

test("Fruit Twist rebind preserves canonical family and exact 506/506 scope", () => {
  for (const token of [
    "id=745", "id=823", "id=1208", "id=1022", "id=1383", "id=1197",
    "50608174924114", "54181852283218", "50608174694738",
    "CNP27009", "CNP27003", "Twisted Fruit", "Fruit Twist", "Fruit Salad",
  ]) assert.match(migration, new RegExp(token));
  assert.match(migration, /retailer_id=10\)<>506/);
  assert.doesNotMatch(migration, /(?:insert into|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
  assert.doesNotMatch(migration, /update\s+public\.(?:products|product_variants|price_history)/i);
});

test("Fruit Twist rollback is forbidden after the ordinary refresh", () => {
  assert.match(rollback, /rollback is forbidden after corrected offer 1022 has been refreshed/);
  assert.match(rollback, /last_checked_at>v_installed_at/);
  assert.doesNotMatch(rollback, /(?:insert into|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
});
