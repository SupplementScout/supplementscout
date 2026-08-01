const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260801180000_upgrade_reviewed_gym_high_accessory_and_wrong_legacy_identities.sql"), "utf8");

test("reviewed GYM HIGH identity migration is exact and preserves commerce", () => {
  assert.match(sql, /^begin;/);
  assert.match(sql, /\ncommit;\s*$/);
  for (const token of ["id=121", "id=122", "id=143", "id=549", "2720", "2714", "2725", "2730", "external_variant_id='656'", "target external variant already mapped"]) assert.match(sql, new RegExp(token));
  assert.doesNotMatch(sql, /set[\s\S]{0,120}\b(price|shipping_cost|total_price|in_stock|url|last_checked_at)\s*=/i);
  assert.doesNotMatch(sql, /\b(delete|truncate)\b/i);
  assert.match(sql, /legacy mapping precondition drift/);
  assert.match(sql, /identity upgrade postcondition failed/);
});
