const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260801200000_repair_reviewed_gym_high_legacy_control_binding.sql"), "utf8");

test("GYM HIGH control binding remains limited to the reviewed tuple helper", () => {
  assert.match(sql, /atomic_import_is_legacy_mapping_upgrade\(jsonb\)/);
  assert.match(sql, /'1:1:1:632:632:559'/);
  assert.match(sql, /'529:387:554:4623:4623:507'/);
  assert.match(sql, /public\.atomic_import_is_legacy_mapping_upgrade\(p_plan\)/);
  assert.match(sql, /v_offer_action in \('noop','identity_update'\)/);
  assert.match(sql, /v_history_action = 'noop'/);
  assert.doesNotMatch(sql, /update public\.(offers|retailer_products)/i);
});
