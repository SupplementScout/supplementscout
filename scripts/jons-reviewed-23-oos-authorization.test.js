const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.resolve(
  "supabase/migrations/20260810210000_authorize_reviewed_jons_23_oos_changes.sql",
), "utf8");
const rollback = fs.readFileSync(path.resolve(
  "supabase/rollbacks/20260810210000_authorize_reviewed_jons_23_oos_changes.sql",
), "utf8");

test("Jon's 23-OOS authorization is exact, production-only and control-only", () => {
  for (const token of [
    "jons-23-563ef072fa3fd68c-production",
    "563ef072fa3fd68c94287eb796aaf8f0ca6163dbe384160a7f7e8f73d40caf4e",
    "cf2b4bf75deecedaae626a323895a3012c99140d2d939b8823915b62af9a1aa3",
    "a10de4b488c1ec0cd6072f78e020127189691cfbfe6ef9df27efe3793965920d",
    "owner-approved-chat-2026-08-10-23-jons-oos",
    "offer_stock_updates\":23",
    "last_checked_at_updates\":23",
  ]) assert.match(migration, new RegExp(token));
  assert.match(migration, /requires production database owner/);
  assert.match(migration, /23,\s*'/);
  assert.match(migration, /contract_version[\s\S]+,1\s*\n\);/);
  assert.doesNotMatch(migration,
    /(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
});

test("Jon's 23-OOS rollback refuses after any binding and deletes only authorization", () => {
  assert.match(rollback, /rollback is forbidden after any Jon''s 23-OOS reviewed binding/);
  assert.match(rollback,
    /delete from public\.retailer_offer_sync_reviewed_mixed_change_definitions/);
  assert.doesNotMatch(rollback,
    /(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
});
