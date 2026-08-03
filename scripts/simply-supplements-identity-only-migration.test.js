const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260803170000_support_simply_identity_only_legacy_upgrade.sql"), "utf8");

test("Simply identity-only migration extends the atomic importer without business-table DML", () => {
  assert.match(sql, /atomic_import_is_legacy_mapping_upgrade_pre_simply/);
  assert.match(sql, /atomic_import_is_simply_identity_only_upgrade/);
  assert.match(sql, /slug='simply-supplements'/);
  assert.match(sql, /external_options[^\n]+null/);
  assert.match(sql, /external_product_id[^\n]+\^\[0-9\]\+\$/);
  assert.match(sql, /external_variant_id[^\n]+\^\[0-9\]\+\$/);
  assert.match(sql, /external_sku[^\n]+is null/);
  assert.match(sql, /offer,action[^\n]+noop/);
  assert.match(sql, /price_history,action[^\n]+noop/);
  assert.doesNotMatch(sql, /\b(update|insert into|delete from)\s+public\.(products|product_variants|retailer_products|offers|price_history)\b/i);
});
