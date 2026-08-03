const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const file = path.resolve(
  __dirname,
  "../supabase/migrations/20260803250000_support_simply_reviewed_commercial_registration.sql",
);
const sql = fs.readFileSync(file, "utf8");

test("Simply reviewed registration support is production-only and transactional", () => {
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.match(sql, /current_user<>'postgres'/);
  assert.match(sql, /supplementscout-production:aftboxmrdgyhizicfsfu/);
});

test("registration extension is exact to Simply and retains the Jon's path", () => {
  assert.match(sql, /simply-49-2bc798f9fb7db4af-production/);
  assert.match(sql, /retailer_slug'='simply-supplements'/);
  assert.match(sql, /source_domain'='simplysupplements\.co\.uk'/);
  assert.match(sql, /v_retailer_id=7/);
  assert.match(sql, /retailer_slug'='jon-s-supplements'/);
  assert.match(sql, /v_retailer_id=10/);
  assert.doesNotMatch(sql, /\b(insert into|update|delete from)\s+public\.(products|product_variants|retailer_products|offers|price_history)\b/i);
});
