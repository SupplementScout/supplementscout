const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260719090000_add_expired_retailer_offer_sync_approval_close.sql"), "utf8");
const sequentialMigration = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260929133000_extend_expired_sequential_plan_close.sql"), "utf8");
const scenario = fs.readFileSync(path.resolve(__dirname, "../supabase/test/retailer_offer_expired_approval_close_integration_test.sql"), "utf8");
const productionPreparation = JSON.parse(fs.readFileSync(path.resolve(
  __dirname,
  "../docs/retailer-automation/evidence/RA-STAB-01-PRODUCTION-RECOVERY-PREPARATION.json",
), "utf8"));

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
  assert.match(scenario, /'cases',case when[\s\S]+then 24 else 20 end/);
  assert.match(scenario, /'business_writes',0,'price_history_writes',0,'replay_writes',0/);
  for (const role of ["retailer_catalogue_staging_approver", "retailer_catalogue_staging_executor", "retailer_catalogue_staging_validator", "public"])
    assert.match(scenario, new RegExp(`has_function_privilege\\('${role}'`));
});

test("shared sequential recovery extends the existing RPC and closes the whole unexecuted tree", () => {
  assert.match(sequentialMigration, /^begin;/i);
  assert.match(sequentialMigration, /commit;\s*$/i);
  assert.match(sequentialMigration, /create or replace function public\.retailer_offer_sync_close_expired_approval_internal\(p_request jsonb\)/i);
  assert.doesNotMatch(sequentialMigration, /create\s+(?:or\s+replace\s+)?function\s+public\.(?!retailer_offer_sync_close_expired_approval_internal)/i);
  assert.match(sequentialMigration, /retailer-offer-sync:global-execution/);
  assert.match(sequentialMigration, /PRODUCTION:'\|\|v_retailer_id::text/);
  assert.match(sequentialMigration, /v_approved_children<>1 or v_planned_children<>v_child_count-1/);
  assert.match(sequentialMigration, /v_parent\.child_manifest->c\.batch_index->>'child_plan_id' is distinct from c\.id::text/);
  assert.match(sequentialMigration, /v_parent\.child_manifest->c\.batch_index->'record_ids' is distinct from c\.record_ids/);
  assert.match(sequentialMigration, /v_batch_approvals<>1/);
  assert.match(sequentialMigration, /v_apply_runs<>0/);
  assert.match(sequentialMigration, /v_row_approvals<>0/);
  assert.match(sequentialMigration, /v_recovery_manifests<>0 or v_recovery_approvals<>0 or v_recovery_audit<>0/);
  assert.match(sequentialMigration, /where parent_plan_id=v_parent\.id and status in \('PLANNED','APPROVED'\)/);
  assert.match(sequentialMigration, /if v_rows<>v_child_count/);
  assert.match(sequentialMigration, /v_after_business is distinct from v_before_business/);
  assert.doesNotMatch(sequentialMigration, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history)\b/i);
  assert.match(scenario, /expired_close_test_seed\('sequential-tree-success',now\(\)-interval '1 hour',18\)/);
  assert.match(scenario, /count\(\*\)=19 and count\(\*\) filter\(where status='EXPIRED'\)=19/);
  assert.match(scenario, /unexpected approved sibling blocked/);
  assert.match(scenario, /sequential child manifest drift blocked/);
});

test("production recovery preparation is exact, two-phase and not authorized", () => {
  assert.equal(productionPreparation.status, "NOT_AUTHORIZED");
  assert.deepEqual(productionPreparation.target, {
    environment: "PRODUCTION",
    project_ref: "aftboxmrdgyhizicfsfu",
    database_identity: "supplementscout-production:aftboxmrdgyhizicfsfu",
  });
  assert.equal(productionPreparation.fresh_readback.pre_migration_ledger_count, 222);
  assert.equal(productionPreparation.fresh_readback.pre_migration_ledger_fingerprint, "c08b5f2e704072a0e4b2590688998e07a781f8699546279b6e81acd9c975c0fe");
  assert.equal(productionPreparation.fresh_readback.post_migration_ledger_count, 223);
  assert.equal(productionPreparation.fresh_readback.post_migration_ledger_fingerprint, "c891240d8ed411b3bc0ad5e2abc6a8c90bfeb442c1cd0824f3c5a4577ee0c7b0");
  assert.equal(productionPreparation.migration.sha256, "b0a4cac2d9c30989f00570bf1c63036daf190fffbcc7b08b17c616761bc6a380");
  assert.equal(productionPreparation.migration.ordinary_selector_status, "EXCLUDED");
  assert.equal(productionPreparation.control_target.parent_plan_id, "a3072837-9f0b-4b0e-af15-2584a19980d7");
  assert.equal(productionPreparation.control_target.approval_id, "0a94d97d-7b0d-4f98-af57-04b029d445d6");
  assert.equal(productionPreparation.control_target.child_count, 19);
  assert.equal(productionPreparation.control_target.apply_runs, 0);
  assert.equal(productionPreparation.control_target.row_approvals, 0);
  assert.equal(productionPreparation.authorization.production_schema_write, false);
  assert.equal(productionPreparation.authorization.production_control_write, false);
  assert.equal(productionPreparation.authorization.business_write, false);
  assert.equal(productionPreparation.execution.migration_started, false);
  assert.equal(productionPreparation.execution.recovery_started, false);
  assert.equal(productionPreparation.execution.automatic_transition_between_phases, false);
  assert.deepEqual(productionPreparation.expected_result, {
    parent_status: "EXPIRED",
    expired_child_count: 19,
    approval_closed: true,
    business_writes: 0,
    price_history_writes: 0,
    control_writes: 21,
  });
});
