const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260718170000_add_read_only_mixed_batch_validator.sql"), "utf8");
const scenario = fs.readFileSync(path.resolve(__dirname, "../supabase/test/retailer_offer_read_only_validator_integration_test.sql"), "utf8");

test("read-only mixed-batch RPC composes existing validators and ledger/target guards", () => {
  assert.match(migration, /retailer_offer_sync_validate_manifest\(v_artifact\)/);
  assert.match(migration, /validate_product_import_plan_read_only\(v_row->'atomic_plan'\)/);
  assert.match(migration, /retailer_catalogue_assert_migration_ledger/);
  assert.match(migration, /retailer_catalogue_staging_runtime_guard/);
  assert.match(migration, /lag\(\(value->>'offer_id'\)::bigint\)[\s\S]+with ordinality/i);
  assert.match(migration, /Read-only source collapse guard/);
  assert.match(migration, /Read-only mass OOS guard/);
  assert.match(migration, /Read-only mass change or price anomaly guard/);
});

test("validator function is STABLE and contains no business or control DML", () => {
  const internal = migration.slice(
    migration.indexOf("create or replace function public.retailer_offer_sync_validate_batch_read_only_internal"),
    migration.indexOf("create or replace function public.validate_retailer_offer_sync_batch_read_only")
  );
  assert.match(internal, /language plpgsql\s+stable\s+security definer/i);
  assert.doesNotMatch(internal, /\b(?:insert\s+into|update|delete\s+from)\s+public\./i);
  assert.doesNotMatch(internal, /(?:approve|execute|recover)_retailer_offer_sync|apply_approved_product_import_plan|begin_retailer_catalogue_child_apply/i);
  assert.match(internal, /'business_writes',0,'control_writes',0/);
});

test("only a non-login non-inheriting validation role receives the wrapper grant", () => {
  assert.match(migration, /create role retailer_catalogue_staging_validator\s+nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls/i);
  assert.match(migration, /grant execute on function public\.retailer_offer_sync_validate_batch_read_only_internal\(jsonb\)\s+to retailer_catalogue_staging_validator/i);
  assert.match(migration, /grant execute on function public\.validate_retailer_offer_sync_batch_read_only\(jsonb\)\s+to retailer_catalogue_staging_validator/i);
  assert.doesNotMatch(migration, /grant execute[^;]+validate_retailer_offer_sync_batch_read_only[^;]+(?:anon|authenticated|service_role|staging_approver|staging_executor)/i);
  assert.match(migration, /Staging validator role required/);
});

test("membership checks distinguish outgoing escalation from safe incoming administration", () => {
  assert.match(scenario, /member=\(select oid from pg_roles where rolname='retailer_catalogue_staging_validator'\)/);
  assert.match(scenario, /roleid=\(select oid from pg_roles where rolname='retailer_catalogue_staging_validator'\)/);
  assert.match(scenario, /not admin_option or inherit_option or set_option/);
  for (const role of ["postgres", "service_role", "retailer_catalogue_staging_approver", "retailer_catalogue_staging_executor"])
    assert.match(scenario, new RegExp(`pg_has_role\\('retailer_catalogue_staging_validator','${role}','SET'\\)`));
  assert.match(scenario, /membership_direction_safe/);
});

test("validation expiry is capped at 15 minutes without changing approval semantics", () => {
  assert.match(migration, /validation_expires_at[\s\S]+now\(\)\+interval '15 minutes'/i);
  assert.doesNotMatch(migration, /create or replace function public\.(?:approve_retailer_offer_sync_batch|execute_retailer_offer_sync_batch|recover_retailer_offer_sync_batch)/i);
  assert.match(scenario, /'validation_expiry_minutes',15/);
});

test("disposable scenario covers 26 rows, zero writes and every required negative", () => {
  for (const token of [
    "verify_no_change_26", "wrong_target", "production_target", "migration_mismatch", "source_mismatch",
    "price_drift", "stock_drift", "url_drift", "identity_drift", "source_collapse", "mass_oos",
    "reordered_rows", "duplicate_row", "expired_package", "wrong_role",
    "write_rpc_inaccessible",
    "membership_direction_safe",
  ]) assert.match(scenario, new RegExp(token));
  assert.match(scenario, /'business_writes',0,'control_writes',0,'price_history_writes',0/);
  assert.match(scenario, /'skips',0/);
  assert.match(scenario, /generate_series\(1,26\)/);
});
