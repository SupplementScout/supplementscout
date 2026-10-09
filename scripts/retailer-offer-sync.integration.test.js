const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260718160000_add_retailer_offer_mixed_batch_executor.sql"), "utf8");
const stateReadMigration = fs.readFileSync(path.join(root, "supabase/migrations/20261008200000_consolidate_shared_executor_state_reads.sql"), "utf8");
const compactFingerprintMigration = fs.readFileSync(path.join(root, "supabase/migrations/20261009120000_add_compact_other_retailer_fingerprint.sql"), "utf8");
const postgresScenario = fs.readFileSync(path.join(root, "supabase/test/retailer_offer_mixed_batch_executor_integration_test.sql"), "utf8");

test("mixed PostgreSQL scenario composes all six executable actions in one 26-row child", () => {
  for (const action of ["VERIFY_NO_CHANGE","UPDATE_PRICE","UPDATE_STOCK","UPDATE_PRICE_AND_STOCK","UPDATE_URL","UPDATE_PRICE_STOCK_URL"]) assert.match(postgresScenario, new RegExp(action));
  assert.match(postgresScenario, /generate_series\(1,26\)/); assert.match(postgresScenario, /price_history_delta',3/); assert.match(postgresScenario, /row_approvals_consumed/);
});
test("executor validates and locks every row before beginning or writing", () => {
  const executor = migration.slice(migration.indexOf("create or replace function public.retailer_offer_sync_execute_batch_internal"), migration.indexOf("create or replace function public.execute_retailer_offer_sync_batch"));
  const validation = executor.indexOf("perform public.validate_product_import_plan_read_only(v_row->'atomic_plan')");
  const begin = executor.indexOf("public.begin_retailer_catalogue_child_apply");
  const apply = executor.indexOf("public.apply_approved_product_import_plan");
  const approvalLock = executor.indexOf("for update");
  const ledger = executor.indexOf("retailer_catalogue_assert_migration_ledger");
  const replay = executor.indexOf("v_approval.consumed_at is not null");
  assert.ok(approvalLock > 0 && approvalLock < ledger && ledger < replay && validation < begin && begin < apply); assert.match(executor, /order by \(value->>'offer_id'\)::bigint/g);
});
test("approval, exact deltas, 50-row cap and replay are fail-closed", () => {
  assert.match(migration, /v_count<1 or v_count>50/); assert.match(migration, /RSBI_EXPECTED_DELTA_MISMATCH/); assert.match(migration, /RSBI_REPLAY_BLOCKED/);
  assert.match(migration, /jsonb_array_length\(v_approval_ids\).*jsonb_array_length\(v_approval\.approved_manifest->'rows'\)/s);
});
test("twelve isolated ledger negatives prove stable errors and zero unexpected state", () => {
  assert.match(postgresScenario, /for v_case in 1\.\.8 loop/);
  for (const id of [9,10,11,12]) assert.match(postgresScenario, new RegExp(`values\\(${id},`));
  assert.match(postgresScenario, /ledger_negative_cases/);
  assert.match(postgresScenario, /RSBI_SOURCE_SCHEMA_MISMATCH/);
  assert.match(postgresScenario, /RSBI_SOURCE_HASH_MISMATCH/);
});

test("shared executor caches one post-state without removing any safety check", () => {
  const oldExecutor = migration.slice(
    migration.indexOf("create or replace function public.retailer_offer_sync_execute_batch_internal"),
    migration.indexOf("create or replace function public.execute_retailer_offer_sync_batch"),
  );
  const newExecutor = stateReadMigration.slice(
    stateReadMigration.indexOf("create or replace function public.retailer_offer_sync_execute_batch_unreviewed_internal"),
    stateReadMigration.indexOf("do $postflight$"),
  );
  const stateCall = /public\.retailer_offer_sync_row_state\(\(v_row->>'offer_id'\)::bigint\)/g;
  assert.equal((oldExecutor.match(stateCall) || []).length, 9);
  assert.equal((newExecutor.match(stateCall) || []).length, 2);
  assert.match(newExecutor, /v_current_state:=public\.retailer_offer_sync_row_state/);
  for (const guard of [
    "validate_product_import_plan_read_only",
    "approve_product_import_plan",
    "apply_approved_product_import_plan",
    "RSBI_EXPECTED_STATE_MISMATCH",
    "RSBI_EXPECTED_DELTA_MISMATCH",
    "retailer_catalogue_other_retailer_fingerprint",
    "retailer_catalogue_protected_shared_fingerprint",
    "retailer_catalogue_orphan_counts",
  ]) {
    assert.match(oldExecutor, new RegExp(guard));
    assert.match(newExecutor, new RegExp(guard));
  }
  for (const field of ["last_checked_at", "price", "shipping_cost", "total_price", "in_stock", "offer_url", "mapping_url"]) {
    assert.match(newExecutor, new RegExp(`v_current_state->>'${field}'`));
  }
  assert.doesNotMatch(newExecutor, /retailer_id\s*=\s*\d+|retailer_slug|Whey Okay|Fit House|Simply Supplements/i);
  assert.match(stateReadMigration, /^begin;/i);
  assert.match(stateReadMigration, /commit;\s*$/i);
});

test("shared executor uses a compact exact other-retailer fingerprint without stranding historical recovery manifests", () => {
  assert.match(compactFingerprintMigration, /create function public\.retailer_catalogue_other_retailer_fingerprint_v2/);
  assert.match(compactFingerprintMigration, /to_jsonb\(rp\)::text/);
  assert.match(compactFingerprintMigration, /to_jsonb\(o\)::text/);
  assert.match(compactFingerprintMigration, /to_jsonb\(ph\)::text/);
  assert.match(compactFingerprintMigration, /pg_catalog\.sha256/);
  assert.match(compactFingerprintMigration, /row_count/);
  assert.match(compactFingerprintMigration, /rows_fingerprint/);
  assert.match(compactFingerprintMigration, /20261009120000_add_compact_other_retailer_fingerprint/);
  assert.match(compactFingerprintMigration, /return public\.retailer_catalogue_other_retailer_fingerprint_v2\(p_retailer_id\)/);
  assert.match(compactFingerprintMigration, /return public\.retailer_catalogue_other_retailer_fingerprint\(p_retailer_id\)/);
  assert.match(compactFingerprintMigration, /retailer_catalogue_other_retailer_fingerprint_for_migration\(v_child\.retailer_id,v_manifest\.mixed_batch_migration_versions\)/);
  assert.match(compactFingerprintMigration, /retailer_catalogue_protected_shared_fingerprint\(\)/);
  assert.match(compactFingerprintMigration, /retailer_catalogue_orphan_counts\(\)/);
  assert.match(compactFingerprintMigration, /RSBI_ROLLBACK_OWNERSHIP_CONFLICT/);
  assert.doesNotMatch(compactFingerprintMigration, /retailer_id\s*=\s*14|10 Reps|Whey Okay|Fit House/i);
  assert.match(compactFingerprintMigration, /^begin;/i);
  assert.match(compactFingerprintMigration, /commit;\s*$/i);
});
