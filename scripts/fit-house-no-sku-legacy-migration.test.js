const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const MIGRATION = path.join(
  ROOT,
  "supabase/migrations/20260726160000_support_reviewed_fit_house_no_sku_legacy_upgrade.sql",
);
const EXPECTED_SHA =
  "ed310cc115d37a09b0e34a7941dae3b3134f4a554c75e166813ba68d39189f38";

test("Fit House no-SKU legacy migration is exact, transactional and control-plane only", () => {
  const bytes = fs.readFileSync(MIGRATION);
  const sql = bytes.toString("utf8");
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), EXPECTED_SHA);
  assert.match(sql, /^begin;/);
  assert.match(sql, /\ncommit;\s*$/);
  assert.match(sql, /create or replace|execute v_fn/i);
  assert.match(sql, /atomic_import_is_legacy_mapping_upgrade/);
  assert.match(sql, /slug = 'fit-house'/);
  assert.match(sql, /\^\[0-9\]\{10,\}\$/);
  assert.match(sql, /https:\/\/fithouse\.uk\/products\/%/);
  assert.match(sql, /\[\?&\]variant=/);
  assert.match(sql, /flavour_only_parent_size/);
  assert.match(sql, /external_sku/);
  assert.match(sql, /owner to postgres/);
  assert.match(sql, /revoke all[\s\S]*service_role/);
  assert.doesNotMatch(sql, /\b(insert|update|delete|truncate)\s+(?:into\s+|from\s+)?public\.(?:products|product_variants|retailer_products|offers|price_history|retailers)\b/i);
  assert.doesNotMatch(sql, /safe_update|guard_threshold|shipping/i);
});
