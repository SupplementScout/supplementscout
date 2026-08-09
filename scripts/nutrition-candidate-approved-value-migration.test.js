const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.join(
  process.cwd(),
  "supabase/migrations/20260809120000_add_nutrition_candidate_approved_value.sql",
), "utf8");

test("approved candidate value migration backfills reviewed rows and preserves review-only workflow", () => {
  assert.match(migration, /add column approved_value numeric/i);
  assert.match(migration, /old\.status = 'pending'[\s\S]+new\.status = 'approved'[\s\S]+new\.approved_value := new\.proposed_value/i);
  assert.match(migration, /create trigger nutrition_candidates_approved_value_default[\s\S]+before update/i);
  assert.match(migration, /disable trigger nutrition_candidates_review_update_guard[\s\S]+enable trigger nutrition_candidates_review_update_guard/i);
  assert.match(migration, /set approved_value = proposed_value\s+where status = 'approved'/i);
  assert.match(migration, /set approved_value = 14\s+where id = 105\s+and product_id = 771[\s\S]+proposed_value = 28/i);
  assert.match(migration, /status = 'pending' and approved_value is null/i);
  assert.match(migration, /status = 'approved' and approved_value is not null/i);
  assert.match(migration, /approval still only authorises planning and never updates catalogue data/i);
  assert.doesNotMatch(migration, /update public\.(products|product_variants|offers|retailer_products)/i);
});
