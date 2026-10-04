const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = "postgres:17-alpine";
const MIGRATION = "supabase/migrations/20261004120000_add_central_control_plan_readback.sql";

function run(command, args, timeout = 120_000) {
  return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout, windowsHide: true });
}
function ok(value, label) {
  assert.equal(value.status, 0, `${label}\n${value.stdout}\n${value.stderr}`);
  return value.stdout.trim();
}
function dbAs(container, user, sql) {
  return run("docker", ["exec", container, "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1",
    "-U", user, "-d", "postgres", "-tA", "-c", sql]);
}
function db(container, sql) { return dbAs(container, "postgres", sql); }
function denied(container, sql, pattern = /permission denied/, user = "postgres") {
  const value = dbAs(container, user, sql);
  assert.notEqual(value.status, 0, `${sql} unexpectedly passed`);
  assert.match(`${value.stdout}\n${value.stderr}`, pattern);
}

test("central role can call only the private status wrapper", { timeout: 120_000 }, () => {
  const container = `supplementscout-central-readback-${process.pid}-${Date.now()}`;
  ok(run("docker", ["run", "--detach", "--rm", "--name", container,
    "-e", "POSTGRES_USER=bootstrap", "-e", "POSTGRES_DB=postgres",
    "-e", "POSTGRES_PASSWORD=local-only", "-v", `${ROOT}:/workspace`, IMAGE]), "start postgres");
  try {
    for (let i = 0; i < 40 && run("docker", ["exec", container, "pg_isready", "-U", "postgres"]).status !== 0; i += 1) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
    ok(dbAs(container, "bootstrap", `
      create role postgres login createrole createdb;
      grant postgres to bootstrap with admin true;
      grant create on database postgres to postgres;
      alter schema public owner to postgres;
      set role postgres;
      create role anon nologin; create role authenticated nologin; create role service_role nologin;
      create role retailer_catalogue_production_validator nologin;
      create role retailer_catalogue_production_approver nologin;
      create role retailer_catalogue_production_executor nologin;
      create table public.control_secret(id uuid primary key, payload text);
      insert into public.control_secret values ('00000000-0000-0000-0000-000000000001','hidden');
      create function public.retailer_catalogue_actual_database_target() returns jsonb
        language sql stable security definer set search_path=pg_catalog
        as $$ select '{"target_environment":"PRODUCTION","project_ref":"aftboxmrdgyhizicfsfu","database_identity":"supplementscout-production:aftboxmrdgyhizicfsfu"}'::jsonb $$;
      revoke all on function public.retailer_catalogue_actual_database_target() from public;
      create function public.get_retailer_catalogue_plan_status(uuid) returns jsonb
        language sql stable security definer set search_path=pg_catalog,public,pg_temp
        as $$ select jsonb_build_object('parent',jsonb_build_object('parent_plan_id',$1),'children','[]'::jsonb,'runs','[]'::jsonb) $$;
      revoke all on function public.get_retailer_catalogue_plan_status(uuid) from public;
      create function public.rls_auto_enable() returns event_trigger language plpgsql security definer
        set search_path=pg_catalog as $$ begin null; end $$;
      grant execute on function public.rls_auto_enable() to public;
    `), "seed production-shaped contract");
    ok(run("docker", ["exec", container, "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1",
      "-U", "postgres", "-d", "postgres", "-f", `/workspace/${MIGRATION}`]), "apply central migration");

    const state = JSON.parse(ok(db(container, `select jsonb_build_object(
      'login',(select rolcanlogin from pg_roles where rolname='retailer_control_plan_readback_caller'),
      'inherit',(select rolinherit from pg_roles where rolname='retailer_control_plan_readback_caller'),
      'target',has_function_privilege('retailer_control_plan_readback_caller','public.get_retailer_catalogue_plan_status(uuid)','EXECUTE'),
      'wrapper',has_function_privilege('retailer_control_plan_readback_caller','retailer_readback.read_control_plan_status_v1(uuid)','EXECUTE'),
      'admin_public',has_function_privilege('public','public.rls_auto_enable()','EXECUTE'))::text`), "read ACL state"));
    assert.deepEqual(state, { login: false, inherit: false, target: false, wrapper: true, admin_public: false });

    const output = JSON.parse(ok(dbAs(container, "bootstrap", `set session authorization retailer_control_plan_readback_caller;
      select retailer_readback.read_control_plan_status_v1('00000000-0000-0000-0000-000000000001')::text`), "call wrapper").split("\n").at(-1));
    assert.equal(output.parent.parent_plan_id, "00000000-0000-0000-0000-000000000001");
    denied(container, "set session authorization retailer_control_plan_readback_caller; select * from public.control_secret", /permission denied/, "bootstrap");
    denied(container, "set session authorization retailer_control_plan_readback_caller; select public.get_retailer_catalogue_plan_status('00000000-0000-0000-0000-000000000001')", /permission denied/, "bootstrap");
    denied(container, "set session authorization retailer_control_plan_readback_caller; create table public.nope(id int)", /permission denied/, "bootstrap");
    denied(container, "set session authorization retailer_control_plan_readback_caller; select public.rls_auto_enable()", /permission denied|event trigger functions can only be called as triggers/, "bootstrap");
    denied(container, `\\i /workspace/${MIGRATION}`, /RA_STAB_CENTRAL_INTERFACE_ALREADY_EXISTS/);
  } finally {
    run("docker", ["rm", "--force", container], 30_000);
  }
});
