const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const image = "postgres:17-alpine";
const dbHost = "127.0.0.1";
const postgresPassword = "staging-local-only";
const files = {
  baseline: "supabase/migrations/20260712211120_baseline_current_public_schema.sql",
  stage2Setup: "supabase/test/product_variants_stage2_migration_test.sql",
  stage2: "supabase/migrations/20260713130000_product_variants_stage2.sql",
  atomic: "supabase/migrations/20260713180000_atomic_product_import_rpc.sql",
  approval: "supabase/migrations/20260713190000_approved_import_plan_ledger.sql",
  legacy: "supabase/migrations/20260713200000_legacy_mapping_upgrade_rpc.sql",
  format: "supabase/migrations/20260715234500_align_approval_product_format_normalization.sql",
  standalone: "supabase/migrations/20260716000000_support_standalone_legacy_mapping_upgrade.sql",
  nullTotal: "supabase/migrations/20260716002000_allow_legacy_mapping_upgrade_null_total_noop.sql",
  optioned: "supabase/migrations/20260716003000_support_optioned_legacy_mapping_upgrade.sql",
  parentSize: "supabase/migrations/20260716004000_support_optioned_parent_size_evidence.sql",
  optionedNull: "supabase/migrations/20260716005000_allow_optioned_legacy_identity_update_null_total.sql",
  atomicTest: "supabase/test/atomic_product_import_rpc_integration_test.sql",
  phase2: "supabase/migrations/20260717120000_create_retailer_catalogue_control_ledger.sql",
  staging: "supabase/migrations/20260717140000_add_staging_retailer_catalogue_executor.sql",
  stagingTest: "supabase/test/staging_retailer_catalogue_executor_integration_test.sql",
  verified: "supabase/migrations/20260718150000_add_verified_no_change_offer_refresh.sql",
  mixed: "supabase/migrations/20260718160000_add_retailer_offer_mixed_batch_executor.sql",
  mixedTest: "supabase/test/retailer_offer_mixed_batch_executor_integration_test.sql",
  readOnlyValidator: "supabase/migrations/20260718170000_add_read_only_mixed_batch_validator.sql",
  readOnlyValidatorTest: "supabase/test/retailer_offer_read_only_validator_integration_test.sql",
  expiredClose: "supabase/migrations/20260719090000_add_expired_retailer_offer_sync_approval_close.sql",
  expiredCloseTest: "supabase/test/retailer_offer_expired_approval_close_integration_test.sql",
};
assert.equal(process.argv.length, 2, "staging integration runner accepts no connection arguments");
function run(command, args, timeout = 180_000) { return spawnSync(command, args, { cwd: root, encoding: "utf8", timeout }); }
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function ok(result, label) { assert.equal(result.error, undefined, `${label}: ${result.error?.message}`); assert.equal(result.status, 0, `${label} failed:\n${output(result)}`); }
function dockerAvailable() { const result = run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000); return result.status === 0; }
function exec(container, args, timeout) { return run("docker", ["exec", "-e", `PGPASSWORD=${postgresPassword}`, "-e", `PGHOST=${dbHost}`, container, ...args], timeout); }
function wait(container) { for (let i = 0; i < 80; i += 1) { const result = exec(container, ["pg_isready", "-U", "postgres"], 5_000); if (result.status === 0) return; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); } assert.fail("PostgreSQL not ready"); }
function psqlFile(container, database, file, variables = []) { const args = ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1"]; for (const value of variables) args.push("-v", value); args.push("-U", "postgres", "-d", database, "-f", `/workspace/${file}`); return exec(container, args); }
function psql(container, database, sql) { return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c", sql]); }
function recordMigration(container, database, identifier) { const split = identifier.indexOf("_"); return psql(container, database, `insert into supabase_migrations.schema_migrations(version,name,statements) values ('${identifier.slice(0, split)}','${identifier.slice(split + 1)}',array[]::text[])`); }

test("staging executor full fixture and recovery on network-isolated disposable PostgreSQL", { skip: !dockerAvailable() && "Docker unavailable" }, () => {
  const container = `supplementscout-staging-${crypto.randomBytes(5).toString("hex")}`;
  const database = "supplementscout_stage2_test_atomic_import_staging_executor_main";
  let failure;
  try {
    ok(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", `POSTGRES_PASSWORD=${postgresPassword}`, "-v", `${root}:/workspace:ro`, image]), "start disposable PostgreSQL");
    wait(container); ok(exec(container, ["createdb", "-U", "postgres", database]), "create database");
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c", "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;"]), "create local roles");
    ok(psql(container, database, "create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text not null,statements text[] not null default array[]::text[]);"), "create migration ledger");
    ok(psqlFile(container, database, files.baseline), "baseline"); ok(recordMigration(container, database, "20260712211120_baseline_current_public_schema"), "record baseline");
    ok(psqlFile(container, database, files.stage2Setup, ["stage2_test_database_confirmed=1", "stage2_test_host=127.0.0.1", `stage2_expected_database=${database}`, "stage2_scenario=success"]), "Stage 2 fixture");
    ok(psqlFile(container, database, files.stage2), "Stage 2 migration"); ok(recordMigration(container, database, "20260713130000_product_variants_stage2"), "record Stage 2");
    ok(psqlFile(container, database, files.atomic), "atomic migration"); ok(recordMigration(container, database, "20260713180000_atomic_product_import_rpc"), "record atomic");
    ok(psqlFile(container, database, files.approval), "approval migration"); ok(recordMigration(container, database, "20260713190000_approved_import_plan_ledger"), "record approval");
    ok(psqlFile(container, database, files.legacy), "legacy migration"); ok(recordMigration(container, database, "20260713200000_legacy_mapping_upgrade_rpc"), "record legacy");
    ok(psqlFile(container, database, files.format), "format migration"); ok(recordMigration(container, database, "20260715234500_align_approval_product_format_normalization"), "record format");
    ok(psqlFile(container, database, files.standalone), "standalone migration"); ok(recordMigration(container, database, "20260716000000_support_standalone_legacy_mapping_upgrade"), "record standalone");
    ok(psqlFile(container, database, files.nullTotal), "null-total migration"); ok(recordMigration(container, database, "20260716002000_allow_legacy_mapping_upgrade_null_total_noop"), "record null-total");
    ok(psqlFile(container, database, files.optioned), "optioned migration"); ok(recordMigration(container, database, "20260716003000_support_optioned_legacy_mapping_upgrade"), "record optioned");
    ok(psqlFile(container, database, files.parentSize), "parent-size migration"); ok(recordMigration(container, database, "20260716004000_support_optioned_parent_size_evidence"), "record parent-size");
    ok(psqlFile(container, database, files.optionedNull), "optioned null-total migration"); ok(recordMigration(container, database, "20260716005000_allow_optioned_legacy_identity_update_null_total"), "record optioned null-total");
    ok(psqlFile(container, database, files.atomicTest, ["atomic_import_test_database_confirmed=1", "atomic_import_test_host=127.0.0.1", `atomic_import_expected_database=${database}`]), "atomic contract scenarios");
    ok(psqlFile(container, database, files.phase2), "Phase 2 migration"); ok(recordMigration(container, database, "20260717120000_create_retailer_catalogue_control_ledger"), "record Phase 2");
    ok(psqlFile(container, database, files.staging), "staging executor migration"); ok(recordMigration(container, database, "20260717140000_add_staging_retailer_catalogue_executor"), "record staging executor");
    const result = psqlFile(container, database, files.stagingTest, ["staging_executor_test_database_confirmed=1", `staging_executor_expected_database=${database}`]);
    ok(result, "staging executor scenarios");
    assert.match(output(result), /"result"\s*:\s*"PASS"/); assert.match(output(result), /"isolated_guard_cases"\s*:\s*19/); assert.match(output(result), /"guard_failures"\s*:\s*0/); assert.match(output(result), /"committed_recoveries"\s*:\s*4/);
    ok(psqlFile(container, database, files.verified), "verified no-change migration after old canary");
    ok(recordMigration(container, database, "20260718150000_add_verified_no_change_offer_refresh"), "record verified no-change");
    ok(psqlFile(container, database, files.mixed), "mixed-batch migration after old canary");
    ok(recordMigration(container, database, "20260718160000_add_retailer_offer_mixed_batch_executor"), "record mixed-batch");
    ok(psqlFile(container, database, files.readOnlyValidator), "read-only mixed-batch validator migration");
    ok(recordMigration(container, database, "20260718170000_add_read_only_mixed_batch_validator"), "record read-only validator");
    const readOnlyResult = psqlFile(container, database, files.readOnlyValidatorTest);
    ok(readOnlyResult, "read-only mixed-batch validator scenarios");
    assert.match(output(readOnlyResult), /"result"\s*:\s*"PASS"/); assert.match(output(readOnlyResult), /"rows_validated"\s*:\s*26/);
    assert.match(output(readOnlyResult), /"cases"\s*:\s*17/); assert.match(output(readOnlyResult), /"last_checked_at_updates"\s*:\s*26/);
    assert.match(output(readOnlyResult), /"business_writes"\s*:\s*0/); assert.match(output(readOnlyResult), /"control_writes"\s*:\s*0/);
    assert.match(output(readOnlyResult), /"failures"\s*:\s*0/); assert.match(output(readOnlyResult), /"skips"\s*:\s*0/);
    const compatibility = psql(container, database, "select to_regprocedure('public.execute_staging_retailer_catalogue_child(jsonb)') is not null as old_executor_preserved, to_regprocedure('public.execute_retailer_offer_sync_batch(jsonb)') is not null as mixed_executor_installed");
    ok(compatibility, "old and mixed executor compatibility"); assert.match(output(compatibility), /t\s*\|\s*t/);
    const mixedResult = psqlFile(container, database, files.mixedTest);
    ok(mixedResult, "mixed-batch 26-row apply, replay and recovery"); assert.match(output(mixedResult), /"result"\s*:\s*"PASS"/);
    assert.match(output(mixedResult), /"ledger_negative_cases"\s*:\s*12/); assert.match(output(mixedResult), /"ledger_negative_failures"\s*:\s*0/);
    ok(psqlFile(container, database, files.expiredClose), "expired approval close migration");
    ok(recordMigration(container, database, "20260719090000_add_expired_retailer_offer_sync_approval_close"), "record expired approval close");
    const expiredCloseResult = psqlFile(container, database, files.expiredCloseTest);
    ok(expiredCloseResult, "expired approval close scenarios"); assert.match(output(expiredCloseResult), /"result"\s*:\s*"PASS"/);
    assert.match(output(expiredCloseResult), /"cases"\s*:\s*20/); assert.match(output(expiredCloseResult), /"failures"\s*:\s*0/); assert.match(output(expiredCloseResult), /"skips"\s*:\s*0/);

    const expiredCloseRerun = psqlFile(container, database, files.expiredClose);
    assert.notEqual(expiredCloseRerun.status, 0, "expired approval close migration rerun unexpectedly succeeded");
    assert.match(output(expiredCloseRerun), /expired mixed approval close is already installed; rerun rejected/);

    const mixedRerun = psqlFile(container, database, files.mixed);
    assert.notEqual(mixedRerun.status, 0, "mixed migration rerun unexpectedly succeeded");
    assert.match(output(mixedRerun), /mixed-batch executor is already installed; rerun rejected/);

    const prepareDependencies = (target) => {
      ok(exec(container, ["createdb", "-U", "postgres", target]), `create ${target}`);
      ok(psqlFile(container, target, files.baseline), `${target} baseline`);
      ok(psqlFile(container, target, files.stage2Setup, ["stage2_test_database_confirmed=1", "stage2_test_host=127.0.0.1", `stage2_expected_database=${target}`, "stage2_scenario=success"]), `${target} Stage 2 fixture`);
      ok(psqlFile(container, target, files.stage2), `${target} Stage 2`);
      ok(psqlFile(container, target, files.atomic), `${target} atomic`);
      ok(psqlFile(container, target, files.approval), `${target} approval`);
    };

    const wrongOrder = "supplementscout_stage2_test_atomic_import_staging_executor_wo";
    prepareDependencies(wrongOrder);
    const wrongOrderResult = psqlFile(container, wrongOrder, files.staging);
    assert.notEqual(wrongOrderResult.status, 0, "wrong-order migration unexpectedly succeeded");
    assert.match(output(wrongOrderResult), /requires atomic importer, approval ledger, and Phase 2 control ledger/);

    const mixedWrongOrder = "supplementscout_stage2_test_atomic_import_mixed_wo";
    prepareDependencies(mixedWrongOrder); ok(psqlFile(container, mixedWrongOrder, files.phase2), `${mixedWrongOrder} Phase 2`); ok(psqlFile(container, mixedWrongOrder, files.staging), `${mixedWrongOrder} staging executor`);
    const mixedWrongOrderResult = psqlFile(container, mixedWrongOrder, files.mixed);
    assert.notEqual(mixedWrongOrderResult.status, 0, "mixed migration without verified no-change unexpectedly succeeded");
    assert.match(output(mixedWrongOrderResult), /requires atomic, verified no-change, Phase 2 and staging executor migrations/);

    const rerun = psqlFile(container, database, files.staging);
    assert.notEqual(rerun.status, 0, "migration rerun unexpectedly succeeded");
    assert.match(output(rerun), /already installed; rerun rejected/);

    const interrupted = "supplementscout_stage2_test_atomic_import_staging_executor_ix";
    prepareDependencies(interrupted); ok(psqlFile(container, interrupted, files.phase2), `${interrupted} Phase 2`);
    const interruptedResult = exec(container, ["sh", "-c", `sed 's/^commit;$/select 1\\/0; commit;/' /workspace/${files.staging} | psql -X --no-psqlrc -v ON_ERROR_STOP=1 -U postgres -d ${interrupted}`]);
    assert.notEqual(interruptedResult.status, 0, "interrupted migration unexpectedly committed");
    const interruptedProof = psql(container, interrupted, "select to_regclass('public.retailer_catalogue_staging_fixture_approvals') is null as rolled_back");
    ok(interruptedProof, "interrupted migration rollback proof"); assert.match(output(interruptedProof), /t/);

    const drift = "supplementscout_stage2_test_atomic_import_staging_executor_sd";
    prepareDependencies(drift); ok(psqlFile(container, drift, files.phase2), `${drift} Phase 2`);
    ok(psql(container, drift, "alter table public.retailer_catalogue_parent_plans drop constraint retailer_catalogue_parent_plans_target_environment_check"), "inject schema drift");
    const driftResult = psqlFile(container, drift, files.staging);
    assert.notEqual(driftResult.status, 0, "schema-drifted migration unexpectedly succeeded");
    const driftProof = psql(container, drift, "select to_regclass('public.retailer_catalogue_staging_fixture_approvals') is null as drift_failed_closed");
    ok(driftProof, "schema drift rollback proof"); assert.match(output(driftProof), /t/);
  } catch (error) { failure = error; }
  finally { const cleanup = run("docker", ["rm", "--force", container], 30_000); if (!failure && cleanup.status !== 0) failure = new Error(`cleanup failed: ${output(cleanup)}`); }
  if (failure) throw failure;
});
