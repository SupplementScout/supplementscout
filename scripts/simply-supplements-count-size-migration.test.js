const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260803190000_allow_simply_count_size_option_evidence.sql"), "utf8");

test("Simply count-size migration delegates only to the exact complete identity helper", () => {
  assert.match(sql, /atomic_import_validate_standard_plan_core/);
  assert.match(sql, /not public\.atomic_import_is_simply_identity_only_upgrade\(p_plan\)/);
  assert.match(sql, /Simply complete reviewed options binding/);
  assert.match(sql, /Simply reviewed count-size option binding/);
  assert.doesNotMatch(sql, /\b(update|insert into|delete from)\s+public\.(products|product_variants|retailer_products|offers|price_history)\b/i);
});
