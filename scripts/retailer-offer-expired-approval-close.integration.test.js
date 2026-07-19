const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260719090000_add_expired_retailer_offer_sync_approval_close.sql"), "utf8");
const scenario = fs.readFileSync(path.resolve(__dirname, "../supabase/test/retailer_offer_expired_approval_close_integration_test.sql"), "utf8");

test("expired approval close is one transactional control-plane-only migration", () => {
  assert.match(migration, /^begin;/i); assert.match(migration, /commit;\s*$/i);
  assert.match(migration, /alter table public\.retailer_offer_sync_batch_approvals/);
  assert.doesNotMatch(migration, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history)\b/i);
  assert.doesNotMatch(migration, /(?:apply_approved_product_import_plan|execute_retailer_offer_sync_batch|recover_retailer_offer_sync_batch)\s*\(/i);
});

test("RPC locks exact approval-child-parent state and proves zero execution before EXPIRED", () => {
  assert.match(migration, /close_expired_retailer_offer_sync_approval\(p_request jsonb\)/);
  for (const table of ["retailer_offer_sync_batch_approvals", "retailer_catalogue_child_plans", "retailer_catalogue_parent_plans"])
    assert.match(migration, new RegExp(`from public\\.${table}[\\s\\S]+for update`, "i"));
  for (const token of ["v_row_approvals<>0", "v_apply_runs<>0", "v_recovery_manifests<>0", "v_approval.result is not null", "v_after_business is distinct from v_before_business"])
    assert.ok(migration.includes(token), token);
  assert.match(migration, /set status='EXPIRED'/g); assert.match(migration, /consumed_at is null/);
});

test("security and replay model are narrow and fail closed", () => {
  assert.match(migration, /security definer[\s\S]+set search_path=pg_catalog,public,pg_temp/i);
  assert.match(migration, /security invoker[\s\S]+current_user<>'retailer_catalogue_staging_approver'/i);
  assert.match(migration, /grant execute[^;]+close_expired_retailer_offer_sync_approval\(jsonb\)[^;]+retailer_catalogue_staging_approver/is);
  assert.match(migration, /grant execute[^;]+retailer_offer_sync_close_expired_approval_internal\(jsonb\)[^;]+retailer_catalogue_staging_approver/is);
  assert.match(migration, /revoke all[^;]+close_expired_retailer_offer_sync_approval\(jsonb\)[^;]+retailer_catalogue_staging_executor[^;]+retailer_catalogue_staging_validator/is);
  assert.match(migration, /close_request_fingerprint is distinct from v_request_fingerprint/);
  assert.match(migration, /already_closed',true,'control_writes',0/);
  assert.match(migration, /retailer_catalogue_assert_migration_ledger/);
  assert.match(migration, /retailer_catalogue_staging_runtime_guard/);
});

test("disposable scenario covers success, replay, negatives, rollback and privilege matrix", () => {
  for (const token of ["unexpired", "consumed", "row-approval", "apply-run", "recovery-state", "target-mismatch", "production-target", "ledger-mismatch", "database-identity", "fingerprint-mismatch", "parent-child-mismatch", "injected-rollback"])
    assert.match(scenario, new RegExp(token));
  assert.match(scenario, /'cases',20,'failures',0,'skips',0/);
  assert.match(scenario, /'business_writes',0,'price_history_writes',0,'replay_writes',0/);
  for (const role of ["retailer_catalogue_staging_approver", "retailer_catalogue_staging_executor", "retailer_catalogue_staging_validator", "public"])
    assert.match(scenario, new RegExp(`has_function_privilege\\('${role}'`));
});
