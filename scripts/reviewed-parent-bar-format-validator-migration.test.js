const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260721191000_allow_reviewed_bar_format_in_parent_import.sql"), "utf8");

test("reviewed bar-format migration patches only the existing validator guard", () => {
  assert.match(sql, /^begin;\s/i);
  assert.match(sql, /pg_get_functiondef\('public\.validate_product_import_plan_read_only\(jsonb\)'::regprocedure\)/i);
  assert.match(sql, /not in \(''powder'',''bar''\)/i);
  assert.match(sql, /PER4M Protein Bars Box of 12 x 62g/);
  assert.match(sql, /commit;\s*$/i);
  assert.doesNotMatch(sql, /\b(create\s+role|create\s+user|grant|revoke)\b/i);
  assert.doesNotMatch(sql, /\b(insert|update|delete)\s+into?\s+public\.(products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
});

test("reviewed bar-format migration keeps the exact family allowlist as the gate", () => {
  assert.match(sql, /atomic_import_reviewed_parent_variant_allowed/i);
  assert.doesNotMatch(sql, /wildcard|like\s+'%|ilike/i);
  assert.doesNotMatch(sql, /product_format[^\n]+<>\s*''powder''\s+and/i);
});
