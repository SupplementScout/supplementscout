const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { fingerprint } = require("./lib/retailer-offer-sync/artifacts");
const { REVIEWED_JONS_STOCK_ONLY, bindReviewedContract, buildReviewedStockOnlyContract } = require("./lib/retailer-offer-sync/reviewed-stock-only");

const migration = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260722120000_add_reviewed_jons_stock_only_override.sql"), "utf8");
const bindingFix = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260722121000_fix_reviewed_stock_only_plan_binding.sql"), "utf8");
const HASH = "4".repeat(64);
const artifact = {
  target_environment: "PRODUCTION",
  source_snapshot_fingerprint: HASH,
  source_captured_at: "2026-07-22T12:00:01.000Z",
  artifact_fingerprint: "5".repeat(64),
};
const snapshotA = { semantic_source_fingerprint: HASH, captured_at: "2026-07-22T12:00:00.000Z" };
const snapshotB = { semantic_source_fingerprint: HASH, captured_at: artifact.source_captured_at };

test("reviewed contract is exact, hash-bound, GB-only and binds two independent matching snapshots", () => {
  const contract = buildReviewedStockOnlyContract({ artifact, snapshotA, snapshotB, expiresAt: "2026-07-22T12:10:00.000Z" });
  assert.deepEqual(contract.offer_ids, REVIEWED_JONS_STOCK_ONLY.PRODUCTION.offer_ids);
  assert.deepEqual(contract.mapping_ids, REVIEWED_JONS_STOCK_ONLY.PRODUCTION.mapping_ids);
  assert.deepEqual(contract.external_variant_ids, REVIEWED_JONS_STOCK_ONLY.PRODUCTION.external_variant_ids);
  assert.equal(contract.before_stock, true);
  assert.equal(contract.after_stock, false);
  assert.equal(contract.source_country, "GB");
  assert.equal(contract.reviewed_plan_hash, fingerprint(Object.fromEntries(Object.entries(contract).filter(([key]) => key !== "reviewed_plan_hash"))));
});

test("reviewed contract builder blocks snapshot disagreement, non-GB, reversed capture and unbound artifact", () => {
  const base = { artifact, snapshotA, snapshotB, expiresAt: "2026-07-22T12:10:00.000Z" };
  assert.throws(() => buildReviewedStockOnlyContract({ ...base, snapshotB: { ...snapshotB, semantic_source_fingerprint: "6".repeat(64) } }), /snapshots must match/);
  assert.throws(() => buildReviewedStockOnlyContract({ ...base, country: "US" }), /must be GB/);
  assert.throws(() => buildReviewedStockOnlyContract({ ...base, snapshotA: snapshotB }), /independently captured/);
  assert.throws(() => buildReviewedStockOnlyContract({ ...base, artifact: { ...artifact, source_snapshot_fingerprint: "7".repeat(64) } }), /bind snapshot B/);
});

test("validation package hash includes the reviewed contract", () => {
  const contract = buildReviewedStockOnlyContract({ artifact, snapshotA, snapshotB, expiresAt: "2026-07-22T12:10:00.000Z" });
  const bound = bindReviewedContract({ schema_version: 1, package_fingerprint: "old" }, contract);
  assert.equal(bound.package_fingerprint, fingerprint({ ...bound, package_fingerprint: null }));
  assert.notEqual(bound.package_fingerprint, fingerprint({ schema_version: 1, package_fingerprint: null }));
});

test("migration dispatches ordinary traffic unchanged and never changes MASS_OOS thresholds", () => {
  assert.match(migration, /return public\.retailer_offer_sync_validate_batch_read_only_unreviewed_internal\(p_request\)/);
  assert.match(migration, /maximum_new_oos_count[\s\S]+not between 0 and 3/);
  assert.match(migration, /maximum_oos_increase_ratio[\s\S]+not between 0 and 0\.15/);
  assert.match(migration, /maximum_total_oos_ratio[\s\S]+not between 0 and 0\.35/);
  assert.match(migration, /maximum_changed_record_ratio[\s\S]+not between 0 and 0\.25/);
  assert.doesNotMatch(migration, /alter\s+role|create\s+role/i);
});

test("SQL contract blocks every identity, direction and mutation escape", () => {
  for (const token of [
    "authorization_id", "target_environment", "retailer_id", "offer_ids", "mapping_ids",
    "external_product_ids", "external_variant_ids", "before_stock", "after_stock", "source_country",
    "snapshot_a_fingerprint", "snapshot_b_fingerprint", "snapshot_a_captured_at", "snapshot_b_captured_at",
    "artifact_fingerprint", "reviewed_plan_hash", "UPDATE_STOCK", "standard_import", "price_history,action",
    "retailer_product,action", "expected_state,offer,in_stock", "offer,values,in_stock",
  ]) assert.match(migration, new RegExp(token.replaceAll(",", ",")));
  assert.match(migration, /jsonb_array_length\(p_artifact->'rows'\)<>8/);
  assert.match(migration, /offer,values,price[\s\S]+expected_state,offer,price/);
  assert.match(migration, /offer,values,url[\s\S]+expected_state,offer,url/);
  assert.match(migration, /Reviewed row is not exact true-to-false stock-only/);
});

test("approval and executor retain exact hash binding, single use and atomic rollback semantics", () => {
  assert.match(migration, /insert into public\.retailer_offer_sync_reviewed_stock_only_authorizations/);
  assert.match(migration, /approval_id uuid not null unique/);
  assert.match(migration, /reviewed_plan_hash text not null unique/);
  assert.match(migration, /status<>'APPROVED'[\s\S]+RSBI_REPLAY_BLOCKED/);
  assert.match(migration, /v_result:=public\.retailer_offer_sync_execute_batch_unreviewed_internal\(p_request\);[\s\S]+update public\.retailer_offer_sync_reviewed_stock_only_authorizations set status='CONSUMED'/);
  assert.doesNotMatch(migration, /(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
});

test("only exact staging and production identities are encoded", () => {
  assert.equal(REVIEWED_JONS_STOCK_ONLY.PRODUCTION.offer_ids.length, 8);
  assert.equal(REVIEWED_JONS_STOCK_ONLY.STAGING.offer_ids.length, 8);
  assert.deepEqual(new Set(REVIEWED_JONS_STOCK_ONLY.PRODUCTION.external_variant_ids), new Set(REVIEWED_JONS_STOCK_ONLY.STAGING.external_variant_ids));
  assert.match(migration, /jons-reviewed-eight-oos-2026-07-22-production/);
  assert.match(migration, /jons-reviewed-eight-oos-2026-07-22-staging/);
});

test("follow-up binding fix preserves artifact snapshot binding and standard atomic meta compatibility", () => {
  assert.match(bindingFix, /Standard importer plans deliberately use a closed meta schema/);
  assert.match(bindingFix, /replace\(v_definition,v_incompatible_check,''\)/);
  assert.match(bindingFix, /atomic_plan,meta,source_snapshot_sha256/);
  assert.doesNotMatch(bindingFix, /(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
  assert.doesNotMatch(bindingFix, /alter\s+role|create\s+role|grant\s+/i);
  assert.match(migration, /p_request->>'source_snapshot_fingerprint' is distinct from v_artifact->>'source_snapshot_fingerprint'/);
  assert.match(migration, /snapshot_b_fingerprint[\s\S]+source_snapshot_fingerprint/);
});
