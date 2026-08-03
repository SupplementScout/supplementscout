const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const file = path.resolve(__dirname, "../supabase/migrations/20260803230000_authorize_simply_reviewed_commercial_baseline.sql");
const sql = fs.readFileSync(file, "utf8");

test("Simply reviewed commercial authorization is production-only and transactional", () => {
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.match(sql, /target_environment'<>'PRODUCTION'/);
  assert.match(sql, /aftboxmrdgyhizicfsfu/);
  assert.match(sql, /current_user<>'postgres'/);
});

test("commercial v4 freezes the owner-approved manifest, source, scope and deltas", () => {
  assert.match(sql, /2bc798f9fb7db4af8ff248f5d4b702b6bb0b5b91d85425afa9a842c9baa0f0e7/);
  assert.match(sql, /a9992d8e824d79a1ce32e82678b5bcf75c1cd0769720f9bfb0ef880818e4a520/);
  assert.match(sql, /9d54826e215388fe90b31d5a65d5947b1755abb32f3dd6a167886324172bc971/);
  assert.match(sql, /"offer_price_updates":43/);
  assert.match(sql, /"offer_shipping_updates":6/);
  assert.match(sql, /"offer_stock_updates":6/);
  assert.match(sql, /"offer_url_updates":0/);
  assert.match(sql, /"mapping_url_updates":0/);
});

test("commercial v4 retains the prior reviewed-contract dispatcher", () => {
  assert.match(sql, /rename to retailer_offer_sync_validate_reviewed_mixed_change_contract_v3/);
  assert.match(sql, /return public\.retailer_offer_sync_validate_reviewed_mixed_change_contract_v3/);
  assert.doesNotMatch(sql, /grant execute/);
  assert.equal(crypto.createHash("sha256").update(sql).digest("hex").length, 64);
});
