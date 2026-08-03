const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260803180000_require_simply_complete_identity_options.sql"), "utf8");

test("Simply complete-options migration narrows the existing atomic helper", () => {
  assert.match(sql, /atomic_import_is_simply_identity_only_upgrade/);
  assert.match(sql, /Simply complete reviewed options binding/);
  assert.match(sql, /external_options,Size/);
  assert.match(sql, /external_options,Subscription/);
  assert.match(sql, /\[Multibuy 1\]/);
  assert.match(sql, /v_evidence->'external_options'/);
  assert.doesNotMatch(sql, /\b(update|insert into|delete from)\s+public\.(products|product_variants|retailer_products|offers|price_history)\b/i);
});
