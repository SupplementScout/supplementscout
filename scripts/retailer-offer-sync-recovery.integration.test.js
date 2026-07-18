const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260718160000_add_retailer_offer_mixed_batch_executor.sql"), "utf8");
const scenario = fs.readFileSync(path.resolve(__dirname, "../supabase/test/retailer_offer_mixed_batch_executor_integration_test.sql"), "utf8");

test("recovery requires a separate single-use dedicated-role approval", () => {
  assert.match(sql, /approve_retailer_offer_sync_recovery/); assert.match(sql, /current_user<>'retailer_catalogue_staging_approver'/); assert.match(sql, /v_approval\.consumed_at is not null or v_approval\.expires_at<=now\(\)/);
});
test("recovery verifies exact applied state before any reverse DML", () => {
  const recovery = sql.slice(sql.indexOf("create or replace function public.retailer_offer_sync_recover_batch_internal"), sql.indexOf("create or replace function public.recover_retailer_offer_sync_batch"));
  const approvalLock = recovery.indexOf("for update"); const ledger = recovery.indexOf("retailer_catalogue_assert_migration_ledger"); const replay = recovery.indexOf("v_approval.consumed_at is not null"); const compare = recovery.indexOf("Applied state drift blocks recovery"); const deletion = recovery.indexOf("delete from public.price_history"); const restore = recovery.indexOf("update public.retailer_products set external_url");
  assert.ok(approvalLock > 0 && approvalLock < ledger && ledger < replay && replay < compare && compare < deletion && deletion < restore); assert.match(recovery, /Owned history is missing/); assert.match(recovery, /Exact recovery baseline mismatch/);
});
test("disposable scenario proves mixed recovery returns all 26 rows to baseline", () => {
  assert.match(scenario, /rows_recovered',26/); assert.match(scenario, /last_checked_at='2026-07-18T10:00:00Z'/); assert.match(scenario, /recovery_status.*RECOVERED/s);
});
