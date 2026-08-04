const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260804000000_add_dolphin_vegan_protein_offer_sync_registration.sql"), "utf8");

test("Dolphin registration freezes one existing production offer", () => {
  assert.match(sql, /register_fit_house_offer_sync_control_plan/);
  assert.match(sql, /register_dolphin_vegan_protein_offer_sync_control_plan/);
  assert.match(sql, /Dolphin frozen one-offer production scope binding/);
  assert.match(sql, /source_platform' <> 'PRODUCT_PAGE/);
  assert.match(sql, /v_target <> 'PRODUCTION'/);
  assert.doesNotMatch(sql, /\b(update|insert into|delete from)\s+public\.(products|product_variants|retailer_products|offers|price_history)\b/i);
});
