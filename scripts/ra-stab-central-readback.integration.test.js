const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = "postgres:17-alpine";
const MIGRATION = "supabase/migrations/20261004120000_add_central_control_plan_readback.sql";
const REVIEW_RECOVERY_MIGRATION = "supabase/migrations/20261006190000_add_automation_review_verified_postflight_recovery.sql";
const REVIEW_RECOVERY_ROLLBACK = "supabase/rollbacks/20261006190000_add_automation_review_verified_postflight_recovery.sql";

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

test("verified Review Queue recovery changes only failed control state after exact evidence", { timeout: 120_000 }, () => {
  const container = `supplementscout-review-recovery-${process.pid}-${Date.now()}`;
  ok(run("docker", ["run", "--detach", "--rm", "--name", container,
    "-e", "POSTGRES_USER=bootstrap", "-e", "POSTGRES_DB=postgres",
    "-e", "POSTGRES_PASSWORD=local-only", "-v", `${ROOT}:/workspace`, IMAGE]), "start postgres");
  try {
    for (let i = 0; i < 40 && run("docker", ["exec", container, "pg_isready", "-U", "bootstrap"]).status !== 0; i += 1) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
    ok(dbAs(container, "bootstrap", `
      create role service_role nologin;
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
      create table public.product_match_review_queue(
        id bigint primary key, review_status text, execution_id text, source_row_fingerprint text,
        plan_fingerprint text, operation_type text, offer_id bigint, proposed_state jsonb,
        execution_run_id text, execution_error_code text, execution_error_message text,
        execution_completed_at timestamptz, updated_at timestamptz default now()
      );
      create table public.automation_review_execution_requests(
        id uuid primary key, review_id bigint, retailer_id bigint, retailer_slug text,
        operation_type text, review_fingerprint text, plan_fingerprint text, idempotency_key text,
        status text, last_checkpoint text, database_writes integer, run_id text, commit_sha text,
        before_state_hash text, postflight_hash text, executed_offer_ids jsonb, failed_offer_ids jsonb,
        remaining_offer_ids jsonb, actual_deltas jsonb, price_history_delta integer,
        idempotency_result text, error_code text, error_message text, completed_at timestamptz,
        updated_at timestamptz default now(), requested_at timestamptz
      );
      create table public.automation_review_execution_events(
        id bigint generated always as identity primary key, execution_request_id uuid,
        review_id bigint, actor text, previous_status text, new_status text,
        checkpoint text, evidence jsonb, created_at timestamptz default now()
      );
      create table public.retailer_products(
        id bigint primary key, external_product_id text, external_variant_id text, external_url text
      );
      create table public.offers(
        id bigint primary key, retailer_id bigint, retailer_product_id bigint, product_id bigint,
        product_variant_id bigint, price numeric, shipping_cost numeric, total_price numeric,
        in_stock boolean, url text
      );
      insert into public.retailer_products values (2168,'product-1','variant-1','https://seller.test/p');
      insert into public.offers values (1982,9,2168,10,20,15.99,3.99,19.98,false,'https://seller.test/p');
      insert into public.product_match_review_queue values (
        1121,'FAILED','976f67b4-c06c-4f73-a3c6-48ca63f45dfd','${"a".repeat(64)}','${"b".repeat(64)}','UPDATE_STOCK',1982,
        '{"offer_id":"1982","retailer_product_id":"2168","product_id":"10","product_variant_id":"20","price":"15.99","shipping_cost":"3.99","total_price":"19.98","in_stock":false,"url":"https://seller.test/p","external_product_id":"product-1","external_variant_id":"variant-1","external_url":"https://seller.test/p"}',
        null,'STABLE_OOS_BASELINE_EXCEEDED','failed',now(),now()
      );
      insert into public.automation_review_execution_requests values (
        '976f67b4-c06c-4f73-a3c6-48ca63f45dfd',1121,9,'fit-house','UPDATE_STOCK','${"a".repeat(64)}','${"b".repeat(64)}','${"c".repeat(64)}',
        'FAILED','EXECUTION_FAILED',20,'37492690030','${"d".repeat(40)}','${"e".repeat(64)}',null,null,null,null,null,null,null,null,
        'STABLE_OOS_BASELINE_EXCEEDED','failed',now(),now(),now()-interval '1 minute'
      );
      insert into public.automation_review_execution_events(execution_request_id,review_id,actor,previous_status,new_status,checkpoint,evidence)
      values ('976f67b4-c06c-4f73-a3c6-48ca63f45dfd',1121,'github-actions:test','EXECUTING','FAILED','EXECUTION_FAILED','{"database_writes":20}');
    `), "seed failed execution state");
    ok(run("docker", ["exec", container, "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1",
      "-U", "bootstrap", "-d", "postgres", "-f", `/workspace/${REVIEW_RECOVERY_MIGRATION}`]), "apply recovery migration");
    const before = ok(dbAs(container, "bootstrap", "select md5(jsonb_agg(to_jsonb(o) order by id)::text) from public.offers o"), "catalogue before");
    const confirmations = Array.from({ length: 19 }, (_, index) => String(index + 1));
    const evidence = JSON.stringify({
      kind: "automation-review-verified-postflight-recovery-v1", original_run_id: "37492690030",
      original_commit_sha: "d".repeat(40), recovery_run_id: "37500000000", recovery_commit_sha: "f".repeat(40),
      baseline_hash: "e".repeat(64), postflight_hash: "1".repeat(64), executed_offer_ids: ["1982"],
      freshness_confirmation_offer_ids: confirmations,
      actual_deltas: { freshness: 20, price: 0, stock: 1, shipping: 0, total: 0, offer_url: 0, mapping_url: 0 },
      price_history_delta: 0, database_writes: 20, idempotency_result: "PASS",
    }).replaceAll("'", "''");
    const recovered = JSON.parse(ok(dbAs(container, "bootstrap", `select set_config('request.jwt.claim.role','service_role',false);
      select public.reconcile_automation_review_verified_postflight('976f67b4-c06c-4f73-a3c6-48ca63f45dfd','github-actions:recovery','${evidence}'::jsonb)::text`), "recover control state").split("\n").at(-1));
    assert.equal(recovered.status, "EXECUTED");
    assert.equal(recovered.idempotency_result, "PASS");
    assert.equal(ok(dbAs(container, "bootstrap", "select review_status from public.product_match_review_queue where id=1121"), "review state"), "EXECUTED");
    assert.equal(ok(dbAs(container, "bootstrap", "select count(*) from public.automation_review_execution_events where checkpoint='VERIFIED_POSTFLIGHT_RECOVERY'"), "recovery event"), "1");
    assert.equal(ok(dbAs(container, "bootstrap", "select md5(jsonb_agg(to_jsonb(o) order by id)::text) from public.offers o"), "catalogue after"), before);
    denied(container, `select set_config('request.jwt.claim.role','service_role',false); select public.reconcile_automation_review_verified_postflight('976f67b4-c06c-4f73-a3c6-48ca63f45dfd','github-actions:recovery','${evidence}'::jsonb)`, /AUTOMATION_RECOVERY_STATE_INVALID/, "bootstrap");
    denied(container, `\\i /workspace/${REVIEW_RECOVERY_ROLLBACK}`, /AUTOMATION_RECOVERY_ROLLBACK_BLOCKED_BY_USED_EVIDENCE/, "bootstrap");
  } finally {
    run("docker", ["rm", "--force", container], 30_000);
  }
});
