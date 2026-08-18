const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { APPROVED_OFFER_IDS, AUTHORITY, OFFER_697_AUTHORITY, parseArgs } = require("./fit-house-reviewed-change-builder");
const { loadReviewedOffer697, MANIFEST_SHA256 } = require("./fit-house-reviewed-offer-697-apply");

test("builder has an immutable exact owner-approved 47-offer scope", () => {
  assert.equal(APPROVED_OFFER_IDS.length, 47);
  assert.equal(new Set(APPROVED_OFFER_IDS).size, 47);
  assert.equal(AUTHORITY, "owner-approved-chat-2026-08-10-all-three-fit-house-points-47-current-changes");
  assert.deepEqual(parseArgs(["--output=tmp/fit-house.json"]), { output: path.resolve("tmp/fit-house.json"), offer697: false });
  assert.deepEqual(parseArgs(["--output=tmp/fit-house-697.json", "--approved-offer-697"]), { output: path.resolve("tmp/fit-house-697.json"), offer697: true });
  assert.throws(() => parseArgs([]), /exactly --output/);
  assert.throws(() => parseArgs(["--output=a", "--output=b"]), /exactly --output/);
});

test("offer 697 reviewed package is immutable, stock-only and production-bound", () => {
  assert.equal(OFFER_697_AUTHORITY, "owner-approved-chat-2026-08-18-mutant-creakong-offer-697-oos");
  assert.equal(MANIFEST_SHA256, "f62ab94e89861f7f42c5aa76cb00cb3fa80697289171b7ba4b02074a4c86d32a");
  const reviewed = loadReviewedOffer697();
  assert.deepEqual(reviewed.manifest.immutable_scope_offer_ids, ["697"]);
  assert.deepEqual(reviewed.manifest.expected_deltas, {
    products: 0, product_variants: 0, retailer_mappings_row_count: 0, offers_row_count: 0,
    stock_updates: 1, item_price_updates: 0, shipping_updates: 0, delivered_total_updates: 0,
    offer_url_updates: 0, mapping_url_updates: 0, mapping_updated_at_updates: 0,
    freshness_updates: 1, price_history_rows: 0, retailers: 0,
  });
  assert.equal(reviewed.manifest.rows[0].old_stock, true);
  assert.equal(reviewed.manifest.rows[0].new_stock, false);
  assert.equal(reviewed.manifest.rows[0].old_price, reviewed.manifest.rows[0].new_price);
});

test("offer 697 database authorization is exact, reversible and has no catalogue writes", () => {
  const migration = fs.readFileSync(path.resolve("supabase/migrations/20260818070000_authorize_reviewed_fit_house_offer_697_oos.sql"), "utf8");
  const rollback = fs.readFileSync(path.resolve("supabase/rollbacks/20260818070000_authorize_reviewed_fit_house_offer_697_oos.sql"), "utf8");
  for (const token of [
    "fit-house-1-f62ab94e89861f7f-production", "offer_id'='697'", "retailer_product_id'='689'",
    "external_product_id'='10028457820400'", "external_variant_id'='49744956850416'",
    "Reviewed Fit House offer 697 OOS proof mismatch", "owner-approved-chat-2026-08-18-mutant-creakong-offer-697-oos",
  ]) assert.ok(migration.includes(token), `missing ${token}`);
  assert.doesNotMatch(migration, /\b(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)\b/i);
  assert.match(rollback, /exists\(select 1 from public\.retailer_offer_sync_reviewed_mixed_change_bindings/);
  assert.match(rollback, /delete from public\.retailer_offer_sync_reviewed_mixed_change_definitions/);
});
