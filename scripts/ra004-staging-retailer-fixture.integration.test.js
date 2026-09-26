const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = "postgres:17-alpine";
const BASELINE = "supabase/migrations/20260712211120_baseline_current_public_schema.sql";
const MIGRATION = "supabase/migrations/20260926100000_create_ra004_staging_10reps_retailer.sql";
const ROLE_SQL = `do $roles$ declare n text; begin foreach n in array array['anon','authenticated','service_role'] loop if not exists(select 1 from pg_roles where rolname=n) then execute format('create role %I nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls',n); end if; end loop; end $roles$;`;

function run(command, args, timeout = 300_000) {
  return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout });
}
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function ok(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message}`);
  assert.equal(result.status, 0, `${label}: ${output(result)}`);
  return result;
}
function denied(result, label, pattern) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message}`);
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded: ${output(result)}`);
  assert.match(output(result), pattern);
}
function docker(container, args, timeout) { return run("docker", ["exec", container, ...args], timeout); }
function sql(container, database, statement) {
  return docker(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-tA", "-c", statement]);
}
function file(container, database, filename) {
  return docker(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-f", `/workspace/${filename}`]);
}
function json(result) {
  const line = result.stdout.split(/\r?\n/).findLast((row) => row.trim().startsWith("{"));
  assert.ok(line, output(result));
  return JSON.parse(line);
}
function wait(container) {
  for (let attempt = 0, consecutive = 0; attempt < 100; attempt += 1) {
    const result = docker(container, ["psql", "-X", "--no-psqlrc", "-U", "postgres", "-d", "postgres", "-tAc", "select 1"], 5000);
    consecutive = result.status === 0 && result.stdout.trim() === "1" ? consecutive + 1 : 0;
    if (consecutive === 3) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("isolated PostgreSQL did not start");
}
function targetFunction(environment, projectRef, identity) {
  return `create or replace function public.retailer_catalogue_actual_database_target() returns jsonb language sql stable as $$select jsonb_build_object('target_environment','${environment}','project_ref','${projectRef}','database_identity','${identity}')$$;`;
}
function bootstrap(container, database, targetSql) {
  ok(docker(container, ["createdb", "-U", "postgres", database]), `create ${database}`);
  ok(sql(container, database, ROLE_SQL), `${database} roles`);
  ok(file(container, database, BASELINE), `${database} baseline`);
  ok(sql(container, database, targetSql), `${database} target attestation`);
}

test("RA-004 creates one minimal sequence-issued 10 Reps record only on attested staging", () => {
  for (const [name, value] of Object.entries(process.env)) {
    if (/DATABASE_URL|DIRECT_URL|POSTGRES_URL|PGHOST|SUPABASE_SERVICE_ROLE_KEY/i.test(name) && value && !/localhost|127\.0\.0\.1|::1/i.test(value)) {
      assert.fail(`RA004_LOCAL_GUARD: remote environment ${name}`);
    }
    if (value && /aftboxmrdgyhizicfsfu|hxnrsyyqffztlvcrtgbf/i.test(value)) {
      assert.fail(`RA004_LOCAL_GUARD: cloud project reference in ${name}`);
    }
  }

  const container = `ra004-retailer-fixture-${crypto.randomBytes(5).toString("hex")}`;
  const suffix = crypto.randomBytes(4).toString("hex");
  const staging = `ra004_fixture_staging_${suffix}`;
  const reserved = `ra004_fixture_reserved_${suffix}`;
  const production = `ra004_fixture_production_${suffix}`;
  const ambiguous = `ra004_fixture_ambiguous_${suffix}`;
  const rollback = `ra004_fixture_rollback_${suffix}`;
  const stagingTarget = targetFunction("STAGING", "hxnrsyyqffztlvcrtgbf", "supplementscout-staging:hxnrsyyqffztlvcrtgbf");
  let started = false;

  try {
    ok(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-v", `${ROOT}:/workspace:ro`, IMAGE]), "start networkless PostgreSQL 17");
    started = true;
    wait(container);

    bootstrap(container, staging, stagingTarget);
    const local = json(ok(sql(container, staging, "select jsonb_build_object('database',current_database(),'address',inet_server_addr(),'port',inet_server_port())::text"), "prove socket-only target"));
    assert.match(local.database, /^ra004_fixture_staging_/);
    assert.equal(local.address, null);
    assert.equal(local.port, null);
    ok(file(container, staging, MIGRATION), "apply staging-only fixture");
    const created = json(ok(sql(container, staging, `select jsonb_build_object(
      'matches',(select count(*) from public.retailers where lower(name)='10 reps' or lower(slug)='10-reps'),
      'record',(select jsonb_build_object('id',id,'name',name,'slug',slug,'website',website,'logo',logo,'affiliate_network',affiliate_network,'affiliate_id',affiliate_id,'created_at',created_at is not null) from public.retailers where name='10 Reps'),
      'other_business_rows',(select count(*) from public.products)+(select count(*) from public.product_variants)+(select count(*) from public.retailer_products)+(select count(*) from public.offers)+(select count(*) from public.price_history)
    )::text`), "read minimal fixture"));
    assert.equal(created.matches, 1);
    assert.notEqual(Number(created.record.id), 14);
    assert.deepEqual({ ...created.record, id: undefined }, { id: undefined, name: "10 Reps", slug: "10-reps", website: null, logo: null, affiliate_network: null, affiliate_id: null, created_at: true });
    assert.equal(created.other_business_rows, 0);
    denied(file(container, staging, MIGRATION), "reject rerun", /RA004_STAGING_RETAILER_NOT_EMPTY/);
    assert.equal(sql(container, staging, "select count(*) from public.retailers").stdout.trim(), "1");

    bootstrap(container, reserved, stagingTarget);
    ok(sql(container, reserved, "select setval('public.retailers_id_seq',13,true)"), "reserve production identity boundary");
    ok(file(container, reserved, MIGRATION), "skip production retailer id");
    assert.equal(sql(container, reserved, "select id from public.retailers where slug='10-reps'").stdout.trim(), "15");

    bootstrap(container, production, targetFunction("PRODUCTION", "aftboxmrdgyhizicfsfu", "supplementscout-production:aftboxmrdgyhizicfsfu"));
    denied(file(container, production, MIGRATION), "reject production", /RA004_STAGING_RETAILER_TARGET_REJECTED/);
    assert.equal(sql(container, production, "select count(*) from public.retailers").stdout.trim(), "0");

    bootstrap(container, ambiguous, stagingTarget);
    ok(sql(container, ambiguous, "insert into public.retailers(name,slug) values ('10 Reps','not-the-canonical-slug'),('Other','10-reps')"), "seed ambiguous identities");
    denied(file(container, ambiguous, MIGRATION), "reject ambiguous identity", /2 matching rows/);
    assert.equal(sql(container, ambiguous, "select count(*) from public.retailers").stdout.trim(), "2");

    bootstrap(container, rollback, stagingTarget);
    ok(sql(container, rollback, `create function public.break_ra004_fixture() returns trigger language plpgsql as $$begin new.slug:='changed-by-trigger'; return new; end$$; create trigger break_ra004_fixture before insert on public.retailers for each row execute function public.break_ra004_fixture();`), "install postcondition fault");
    denied(file(container, rollback, MIGRATION), "rollback postcondition failure", /RA004_STAGING_RETAILER_POSTCONDITION_FAILED/);
    assert.equal(sql(container, rollback, "select count(*) from public.retailers").stdout.trim(), "0");
  } finally {
    if (started) run("docker", ["rm", "-f", container], 30_000);
  }
});
