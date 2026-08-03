const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260803200000_normalize_simply_match_confidence_guard.sql"), "utf8");

test("Simply confidence migration canonicalizes only the existing state guard", () => {
  assert.match(sql, /atomic_import_is_simply_identity_only_upgrade/);
  assert.match(sql, /match_confidence::text/);
  assert.match(sql, /match_confidence',''\)::numeric/);
  assert.match(sql, /Simply canonical numeric confidence binding/);
  assert.doesNotMatch(sql, /\b(update|insert into|delete from)\s+public\.(products|product_variants|retailer_products|offers|price_history)\b/i);
});
