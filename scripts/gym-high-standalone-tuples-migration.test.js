const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260801220000_recognize_reviewed_gym_high_standalone_legacy_tuples.sql"), "utf8");

test("GYM HIGH standalone helper branch contains exactly twelve reviewed tuples", () => {
  const tuples = [...sql.matchAll(/'\d+:\d+:\d+:\d+:\d+:\d+'/g)].map((match) => match[0]);
  assert.equal(new Set(tuples).size, 12);
  assert.match(sql, /retailers where slug='gym-high'/);
  assert.match(sql, /external_product_id' = v_values->>'external_variant_id/);
  assert.match(sql, /GYM HIGH reviewed standalone legacy tuples/);
  assert.doesNotMatch(sql, /update public\.(offers|retailer_products)/i);
});
