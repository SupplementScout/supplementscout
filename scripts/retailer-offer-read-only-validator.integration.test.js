const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
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

const ROOT = path.resolve(__dirname, "..");
const VERIFIED_READER_MIGRATION = "supabase/migrations/20261031120000_add_verified_automation_review_stock_transition_reader.sql";
const VERIFIED_READER_ROLLBACK = "supabase/rollbacks/20261031120000_add_verified_automation_review_stock_transition_reader_rollback.sql";

function run(command, args, timeout = 120_000) {
  return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout });
}

function dockerAvailable() {
  return run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000).status === 0;
}

function dockerExec(container, args, timeout = 120_000) {
  return run("docker", ["exec", container, ...args], timeout);
}

function sql(container, statement) {
  return dockerExec(container, [
    "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-tA", "-c", statement,
  ]);
}

function sqlFile(container, filename) {
  return dockerExec(container, [
    "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/${filename}`,
  ]);
}

function waitForPostgres(container) {
  let consecutive = 0;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = sql(container, "select 1");
    consecutive = result.status === 0 && result.stdout.trim() === "1" ? consecutive + 1 : 0;
    if (consecutive === 3) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("isolated PostgreSQL did not start");
}

test("verified Review Queue reader enforces retailer scope, exact ACLs, raw-table denial and rollback", { timeout: 180_000 }, (context) => {
  if (!dockerAvailable()) return context.skip("Docker unavailable");
  const container = `ss-review-reader-${crypto.randomBytes(5).toString("hex")}`;
  context.after(() => run("docker", ["rm", "--force", container], 30_000));
  const started = run("docker", [
    "run", "--detach", "--rm", "--name", container,
    "-e", "POSTGRES_PASSWORD=review-reader-local-only",
    "-v", `${ROOT.replaceAll("\\", "/")}:/workspace:ro`,
    "postgres:17-alpine",
  ], 30_000);
  assert.equal(started.status, 0, started.stderr);
  waitForPostgres(container);

  const setup = sql(container, `
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create role retailer_catalogue_production_validator nologin noinherit nosuperuser nocreatedb nocreaterole noreplication bypassrls;
    create role retailer_catalogue_production_approver nologin noinherit;
    create role retailer_catalogue_production_executor nologin noinherit;
    create table public.retailers(id bigint primary key);
    create table public.product_match_review_queue(
      id bigint primary key,offer_id bigint not null,retailer_id bigint not null,
      review_status text,operation_type text,source_row_fingerprint text,plan_fingerprint text,
      before_state jsonb,proposed_state jsonb
    );
    create table public.automation_review_execution_requests(
      id uuid primary key,review_id bigint not null,retailer_id bigint not null,
      operation_type text,review_fingerprint text,plan_fingerprint text,status text,
      postflight_hash text,executed_offer_ids jsonb,failed_offer_ids jsonb,remaining_offer_ids jsonb,
      actual_deltas jsonb,database_writes integer,idempotency_result text,last_checkpoint text,completed_at timestamptz
    );
    alter table public.product_match_review_queue enable row level security;
    alter table public.product_match_review_queue force row level security;
    alter table public.automation_review_execution_requests enable row level security;
    alter table public.automation_review_execution_requests force row level security;
    revoke all on table public.product_match_review_queue,public.automation_review_execution_requests from public,anon,authenticated;
    grant select on table public.product_match_review_queue,public.automation_review_execution_requests to service_role;
    insert into public.retailers values (9),(10);
    insert into public.product_match_review_queue values
      (1,1982,9,'EXECUTED','UPDATE_STOCK',repeat('a',64),repeat('b',64),'{"in_stock":true}','{"in_stock":false}'),
      (2,2002,10,'EXECUTED','UPDATE_STOCK',repeat('c',64),repeat('d',64),'{"in_stock":false}','{"in_stock":true}'),
      (3,3003,9,'APPROVED','UPDATE_STOCK',repeat('e',64),repeat('f',64),'{"in_stock":true}','{"in_stock":false}'),
      (4,4004,9,'EXECUTED','UPDATE_STOCK',repeat('1',64),repeat('2',64),'{"in_stock":true}','{"in_stock":false}');
    insert into public.automation_review_execution_requests values
      ('00000000-0000-4000-8000-000000000001',1,9,'UPDATE_STOCK',repeat('a',64),repeat('b',64),'EXECUTED',repeat('3',64),'["1982"]','[]','[]','{"stock":1}',20,'PASS','IDEMPOTENCY_PASSED','2026-10-31T09:00:00Z'),
      ('00000000-0000-4000-8000-000000000002',2,10,'UPDATE_STOCK',repeat('c',64),repeat('d',64),'EXECUTED',repeat('4',64),'["2002"]','[]','[]','{"stock":1}',20,'PASS','IDEMPOTENCY_PASSED','2026-10-31T09:01:00Z'),
      ('00000000-0000-4000-8000-000000000003',3,9,'UPDATE_STOCK',repeat('e',64),repeat('f',64),'EXECUTED',repeat('5',64),'["3003"]','[]','[]','{"stock":1}',20,'PASS','IDEMPOTENCY_PASSED','2026-10-31T09:02:00Z'),
      ('00000000-0000-4000-8000-000000000004',4,9,'UPDATE_STOCK',repeat('1',64),repeat('2',64),'FAILED',repeat('6',64),'["4004"]','[]','[]','{"stock":1}',20,'PASS','IDEMPOTENCY_PASSED','2026-10-31T09:03:00Z');
  `);
  assert.equal(setup.status, 0, setup.stderr);
  const exactRole = sql(container, `select concat_ws('|',rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls)
    from pg_roles where rolname='retailer_catalogue_production_validator';`);
  assert.equal(exactRole.status, 0, exactRole.stderr);
  assert.equal(exactRole.stdout.trim(), "f|f|f|f|f|f|t");
  const applied = sqlFile(container, VERIFIED_READER_MIGRATION);
  assert.equal(applied.status, 0, applied.stderr);

  const authorized = sql(container, `set role retailer_catalogue_production_validator;
    select count(*)||':'||min(offer_id)||':'||bool_and(before_in_stock and not proposed_in_stock)
      from public.read_verified_automation_review_stock_transitions_v1(9);`);
  assert.equal(authorized.status, 0, authorized.stderr);
  assert.equal(authorized.stdout.trim().split(/\r?\n/).at(-1), "1:1982:true");
  const otherRetailer = sql(container, `set role retailer_catalogue_production_validator;
    select string_agg(offer_id::text,',' order by offer_id)
      from public.read_verified_automation_review_stock_transitions_v1(10);`);
  assert.equal(otherRetailer.status, 0, otherRetailer.stderr);
  assert.equal(otherRetailer.stdout.trim().split(/\r?\n/).at(-1), "2002");

  const acl = sql(container, `select
    has_function_privilege('retailer_catalogue_production_validator','public.read_verified_automation_review_stock_transitions_v1(bigint)','EXECUTE'),
    has_function_privilege('anon','public.read_verified_automation_review_stock_transitions_v1(bigint)','EXECUTE'),
    has_function_privilege('authenticated','public.read_verified_automation_review_stock_transitions_v1(bigint)','EXECUTE'),
    has_function_privilege('service_role','public.read_verified_automation_review_stock_transitions_v1(bigint)','EXECUTE'),
    has_function_privilege('retailer_catalogue_production_approver','public.read_verified_automation_review_stock_transitions_v1(bigint)','EXECUTE'),
    has_function_privilege('retailer_catalogue_production_executor','public.read_verified_automation_review_stock_transitions_v1(bigint)','EXECUTE'),
    has_function_privilege('public','public.read_verified_automation_review_stock_transitions_v1(bigint)','EXECUTE'),
    has_table_privilege('retailer_catalogue_production_validator','public.product_match_review_queue','SELECT'),
    has_table_privilege('retailer_catalogue_production_validator','public.automation_review_execution_requests','SELECT');`);
  assert.equal(acl.status, 0, acl.stderr);
  assert.equal(acl.stdout.trim(), "t|f|f|f|f|f|f|f|f");
  for (const role of ["anon", "authenticated", "service_role", "retailer_catalogue_production_approver", "retailer_catalogue_production_executor"]) {
    const unauthorized = sql(container, `set role ${role}; select * from public.read_verified_automation_review_stock_transitions_v1(9);`);
    assert.notEqual(unauthorized.status, 0, `${role} unexpectedly executed reader`);
    assert.match(unauthorized.stderr, /permission denied/i);
  }
  for (const table of ["product_match_review_queue", "automation_review_execution_requests"]) {
    const rawRead = sql(container, `set role retailer_catalogue_production_validator; select * from public.${table};`);
    assert.notEqual(rawRead.status, 0, `BYPASSRLS unexpectedly overcame missing ${table} SELECT ACL`);
    assert.match(rawRead.stderr, /permission denied/i);
    for (const statement of [
      `insert into public.${table} default values`,
      `update public.${table} set id=id`,
      `delete from public.${table}`,
      `truncate public.${table}`,
    ]) {
      const mutation = sql(container, `set role retailer_catalogue_production_validator; ${statement};`);
      assert.notEqual(mutation.status, 0, `${table} mutation unexpectedly allowed`);
      assert.match(mutation.stderr, /permission denied/i);
    }
  }
  const metadata = sql(container, `select pg_get_userbyid(proowner)||'|'||provolatile::text||'|'||prosecdef::text||'|'||array_to_string(proconfig,',')
    from pg_proc where oid='public.read_verified_automation_review_stock_transitions_v1(bigint)'::regprocedure;`);
  assert.equal(metadata.status, 0, metadata.stderr);
  assert.equal(metadata.stdout.trim(), "postgres|s|true|search_path=pg_catalog, public, pg_temp");
  const invalidRetailer = sql(container, "set role retailer_catalogue_production_validator; select * from public.read_verified_automation_review_stock_transitions_v1(0);");
  assert.notEqual(invalidRetailer.status, 0);
  assert.match(invalidRetailer.stderr, /VERIFIED_AUTOMATION_REVIEW_READER_RETAILER_INVALID/);
  const unknownRetailer = sql(container, "set role retailer_catalogue_production_validator; select * from public.read_verified_automation_review_stock_transitions_v1(999);");
  assert.notEqual(unknownRetailer.status, 0);
  assert.match(unknownRetailer.stderr, /VERIFIED_AUTOMATION_REVIEW_READER_RETAILER_NOT_FOUND/);

  const rolledBack = sqlFile(container, VERIFIED_READER_ROLLBACK);
  assert.equal(rolledBack.status, 0, rolledBack.stderr);
  const absent = sql(container, "select to_regprocedure('public.read_verified_automation_review_stock_transitions_v1(bigint)') is null;");
  assert.equal(absent.status, 0, absent.stderr);
  assert.equal(absent.stdout.trim(), "t");
});
