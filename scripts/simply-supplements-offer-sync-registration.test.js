const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260803220000_add_simply_supplements_offer_sync_registration.sql"), "utf8");

test("Simply registration clones the existing guarded Shopify path and freezes the approved scope", () => {
  assert.match(sql, /register_fit_house_offer_sync_control_plan/);
  assert.match(sql, /register_simply_supplements_offer_sync_control_plan/);
  assert.match(sql, /514327e15c2fd50013bc17dc853676331e3120734626bdf0da1ae4130b031611/);
  assert.match(sql, /73ad2a3268736ccc472c5fdf58523cf43f39a1cf6d1babd0b3fe118803f9c554/);
  assert.match(sql, /retailer_catalogue_staging_validator/);
  assert.match(sql, /retailer_catalogue_production_validator/);
  assert.doesNotMatch(sql, /\b(update|insert into|delete from)\s+public\.(products|product_variants|retailer_products|offers|price_history)\b/i);
});
