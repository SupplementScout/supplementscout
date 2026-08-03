const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(
  path.resolve(__dirname, "../supabase/migrations/20260803270000_verify_separate_offer_and_mapping_urls.sql"),
  "utf8",
);

test("separate verified URLs migration is production-only and transactional", () => {
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.match(sql, /current_user<>'postgres'/);
  assert.match(sql, /supplementscout-production:aftboxmrdgyhizicfsfu/);
});

test("validator compares each URL to its own closed expected state", () => {
  assert.match(sql, /v_mapping\.external_url is distinct from p_plan#>>'\{retailer_product,values,external_url\}'/);
  assert.match(sql, /v_mapping\.external_url is distinct from v_offer\.url/);
  assert.doesNotMatch(sql, /\b(insert into|update|delete from)\s+public\.(products|product_variants|retailer_products|offers|price_history)\b/i);
});
