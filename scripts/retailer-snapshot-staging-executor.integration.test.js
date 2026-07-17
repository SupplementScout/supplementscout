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
  standalone: "supabase/migrations/20260716000000_support_standalone_legacy_mapping_upgrade.sql",
  nullTotal: "supabase/migrations/20260716002000_allow_legacy_mapping_upgrade_null_total_noop.sql",
  format: "supabase/migrations/20260715234500_align_approval_product_format_normalization.sql",
  optioned: "supabase/migrations/20260716003000_support_optioned_legacy_mapping_upgrade.sql",
  parentSize: "supabase/migrations/20260716004000_support_optioned_parent_size_evidence.sql",
  optionedNull: "supabase/migrations/20260716005000_allow_optioned_legacy_identity_update_null_total.sql",
  atomicTest: "supabase/test/atomic_product_import_rpc_integration_test.sql",
  phase2: "supabase/migrations/20260717120000_create_retailer_catalogue_control_ledger.sql",
  staging: "supabase/migrations/20260717140000_add_staging_retailer_catalogue_executor.sql",
  stagingTest: "supabase/test/staging_retailer_catalogue_executor_integration_test.sql",
};
assert.equal(process.argv.length, 2, "staging integration runner accepts no connection arguments");
function run(command, args, timeout = 180_000) { return spawnSync(command, args, { cwd: root, encoding: "utf8", timeout }); }
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function ok(result, label) { assert.equal(result.error, undefined, `${label}: ${result.error?.message}`); assert.equal(result.status, 0, `${label} failed:\n${output(result)}`); }
function dockerAvailable() { const result = run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000); return result.status === 0; }
function exec(container, args, timeout) { return run("docker", ["exec", "-e", `PGPASSWORD=${postgresPassword}`, "-e", `PGHOST=${dbHost}`, container, ...args], timeout); }
function wait(container) { for (let i = 0; i < 80; i += 1) { const result = exec(container, ["pg_isready", "-U", "postgres"], 5_000); if (result.status === 0) return; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); } assert.fail("PostgreSQL not ready"); }
function psqlFile(container, database, file, variables = []) { const args = ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1"]; for (const value of variables) args.push("-v", value); args.push("-U", "postgres", "-d", database, "-f", `/workspace/${file}`); return exec(container, args); }

test("staging executor full fixture and recovery on network-isolated disposable PostgreSQL", { skip: !dockerAvailable() && "Docker unavailable" }, () => {
  const container = `supplementscout-staging-${crypto.randomBytes(5).toString("hex")}`;
  const database = "supplementscout_stage2_test_atomic_import_staging_executor_main";
  let failure;
  try {
    ok(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", `POSTGRES_PASSWORD=${postgresPassword}`, "-v", `${root}:/workspace:ro`, image]), "start disposable PostgreSQL");
    wait(container); ok(exec(container, ["createdb", "-U", "postgres", database]), "create database");
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c", "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;"]), "create local roles");
    ok(psqlFile(container, database, files.baseline), "baseline");
    ok(psqlFile(container, database, files.stage2Setup, ["stage2_test_database_confirmed=1", "stage2_test_host=127.0.0.1", `stage2_expected_database=${database}`, "stage2_scenario=success"]), "Stage 2 fixture");
    ok(psqlFile(container, database, files.stage2), "Stage 2 migration");
    ok(psqlFile(container, database, files.atomic), "atomic migration");
    ok(psqlFile(container, database, files.approval), "approval migration");
    ok(psqlFile(container, database, files.legacy), "legacy migration");
    ok(psqlFile(container, database, files.standalone), "standalone migration");
    ok(psqlFile(container, database, files.nullTotal), "null-total migration");
    ok(psqlFile(container, database, files.format), "format migration");
    ok(psqlFile(container, database, files.optioned), "optioned migration");
    ok(psqlFile(container, database, files.parentSize), "parent-size migration");
    ok(psqlFile(container, database, files.optionedNull), "optioned null-total migration");
    ok(psqlFile(container, database, files.atomicTest, ["atomic_import_test_database_confirmed=1", "atomic_import_test_host=127.0.0.1", `atomic_import_expected_database=${database}`]), "atomic contract scenarios");
    ok(psqlFile(container, database, files.phase2), "Phase 2 migration");
    ok(psqlFile(container, database, files.staging), "staging executor migration");
    const result = psqlFile(container, database, files.stagingTest, ["staging_executor_test_database_confirmed=1", `staging_executor_expected_database=${database}`]);
    ok(result, "staging executor scenarios");
    assert.match(output(result), /"result"\s*:\s*"PASS"/); assert.match(output(result), /"committed_recoveries"\s*:\s*4/);
    const concurrentSql = "set app.retailer_catalogue_staging_marker='1'; set app.retailer_catalogue_allow='1'; set app.safe_update='false'; set app.retailer_catalogue_project_ref='hxnrsyyqffztlvcrtgbf'; set app.retailer_catalogue_database_identity='supplementscout-staging:hxnrsyyqffztlvcrtgbf'; set app.retailer_catalogue_migration_fingerprint='d441888ff840b0e054d6345268a9169b9ce1639ee920b34879116d554daf1312'; set app.retailer_catalogue_invocation_role='retailer_catalogue_staging_executor'; select public.execute_staging_retailer_catalogue_child((select value from public.staging_test_context where key='actual_concurrent'));";
    const concurrent = exec(container, ["sh", "-c", `psql -X --no-psqlrc -v ON_ERROR_STOP=1 -U postgres -d ${database} -c "${concurrentSql}" >/tmp/staging-a.log 2>&1 & a=$!; psql -X --no-psqlrc -v ON_ERROR_STOP=1 -U postgres -d ${database} -c "${concurrentSql}" >/tmp/staging-b.log 2>&1 & b=$!; wait $a; sa=$?; wait $b; sb=$?; cat /tmp/staging-a.log /tmp/staging-b.log; test $sa -eq 0; test $sb -eq 0`], 30_000);
    ok(concurrent, "concurrent child execution"); assert.match(output(concurrent), /RSBI_REPLAY_BLOCKED/);
  } catch (error) { failure = error; }
  finally { const cleanup = run("docker", ["rm", "--force", container], 30_000); if (!failure && cleanup.status !== 0) failure = new Error(`cleanup failed: ${output(cleanup)}`); }
  if (failure) throw failure;
});
