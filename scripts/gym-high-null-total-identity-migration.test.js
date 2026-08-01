const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260801190000_allow_reviewed_gym_high_null_total_identity_upgrade.sql"), "utf8");

test("GYM HIGH null-total exception is exact and non-price only", () => {
  assert.match(sql, /atomic_import_validate_standard_plan_core\(jsonb\)/);
  assert.match(sql, /operation_type}' = 'legacy_mapping_upgrade'/);
  assert.match(sql, /retailer,id}' = '1'/);
  assert.match(sql, /reviewed_gym_high_no_sku_identity/);
  assert.match(sql, /atomic_import_is_legacy_mapping_upgrade\(p_plan\)/);
  assert.match(sql, /v_offer_action in \('noop','identity_update'\)/);
  assert.match(sql, /v_history_action = 'noop'/);
  assert.match(sql, /offer,values,price}[\s\S]*expected_state,offer,price/);
  assert.match(sql, /offer,values,shipping_cost}[\s\S]*expected_state,offer,shipping_cost/);
  assert.doesNotMatch(sql, /update public\.(offers|retailer_products)/i);
});
