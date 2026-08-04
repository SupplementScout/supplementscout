const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260804010000_add_dolphin_single_offer_validation.sql"), "utf8");

test("Dolphin percentage exception is production-only and exact-row scoped", () => {
  assert.match(sql, /retailer_offer_sync_validate_batch_read_only_unreviewed_internal/);
  assert.match(sql, /validate_dolphin_single_offer_read_only/);
  assert.match(sql, /target_environment.*PRODUCTION/);
  for (const value of ["retailer_id", "'5'", "2490", "2676", "193943-VANILLA"]) assert.match(sql, new RegExp(value));
  assert.doesNotMatch(sql, /replace\(v_definition,\s*'v_price_anomaly/);
  assert.doesNotMatch(sql, /\b(update|insert into|delete from)\s+public\.(products|product_variants|retailer_products|offers|price_history)\b/i);
});

test("all non-Dolphin requests retain the previous validators", () => {
  assert.match(sql, /return public\.retailer_offer_sync_validate_reviewed_mixed_change_internal/);
  assert.match(sql, /return public\.retailer_offer_sync_validate_before_reviewed_mixed/);
});
