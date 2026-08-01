const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260801210000_allow_reviewed_gym_high_standalone_null_options.sql"), "utf8");

test("GYM HIGH standalone exception accepts null options only inside the exact tuple helper", () => {
  assert.match(sql, /atomic_import_is_legacy_mapping_upgrade\(jsonb\)/);
  assert.match(sql, /'1:1:1:632:632:559'/);
  assert.match(sql, /'529:387:554:4623:4623:507'/);
  assert.match(sql, /jsonb_typeof\(v_values->'external_options'\) in \('object','null'\)/);
  assert.match(sql, /else '\{\}'::jsonb/);
  assert.doesNotMatch(sql, /update public\.(offers|retailer_products)/i);
});
