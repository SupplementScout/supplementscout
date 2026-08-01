const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260801170000_support_reviewed_gym_high_no_sku_legacy_upgrade.sql"), "utf8");

test("GYM HIGH no-SKU migration is exact and control-plane only", () => {
  assert.match(sql, /^begin;/);
  assert.match(sql, /\ncommit;\s*$/);
  for (const token of ["slug = 'gym-high'", "1:1:1:632:632:559", "390:78:543:703:704:1064", "529:387:554:4623:4623:507", "reviewed_gym_high_no_sku_identity"]) assert.match(sql, new RegExp(token));
  const tuples = [...sql.matchAll(/^\s+'\d+:\d+:\d+:\d+:\d+:\d+',?$/gm)];
  assert.equal(tuples.length, 21);
  assert.match(sql, /owner to postgres/);
  assert.match(sql, /revoke all[\s\S]*service_role/);
  assert.doesNotMatch(sql, /\b(insert|update|delete|truncate)\s+(?:into\s+|from\s+)?public\.(?:products|product_variants|retailer_products|offers|price_history|retailers)\b/i);
});
