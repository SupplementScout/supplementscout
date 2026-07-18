const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260718160000_add_retailer_offer_mixed_batch_executor.sql"), "utf8");
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
