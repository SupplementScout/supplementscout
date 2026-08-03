const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const file = path.resolve(
  __dirname,
  "../supabase/migrations/20260803240000_normalize_simply_reviewed_commercial_money.sql",
);
const sql = fs.readFileSync(file, "utf8");

test("Simply reviewed money normalization is production-only and transactional", () => {
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.match(sql, /target_environment'<>'PRODUCTION'/);
  assert.match(sql, /aftboxmrdgyhizicfsfu/);
  assert.match(sql, /current_user<>'postgres'/);
  assert.match(sql, /simply-49-2bc798f9fb7db4af-production/);
});

test("all reviewed monetary comparisons use PostgreSQL numeric equality", () => {
  const numericComparisons = sql.match(/\)::numeric is distinct from \([^\n]+\)::numeric/g) || [];
  assert.equal(numericComparisons.length, 7);
  assert.match(sql, /v_replacements text\[\]\[\]/);
  assert.match(sql, /foreach v_pair slice 1/);
  assert.doesNotMatch(sql, /grant execute|\b(update|insert into|delete from)\s+public\.(offers|offer_price_history|retailer_product_mappings)\b/i);
});
