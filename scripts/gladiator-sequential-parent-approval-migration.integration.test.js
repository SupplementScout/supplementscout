const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = "postgres:17-alpine";
const FORWARD = path.join(ROOT, "supabase/migrations/20261027150000_extend_sequential_parent_approval_to_gladiator.sql");
const ROLLBACK = path.join(ROOT, "supabase/rollbacks/20261027150000_extend_sequential_parent_approval_to_gladiator_rollback.sql");
const OLD_FUNCTION_SHA = "d0972f334b5a7852a76cc14f877b40ff1a4c5c2b29c2b72382fce5c152862d79";
const NEW_FUNCTION_SHA = "36ec800fd0056c5d556138ef3fe75f5dda627cd6fc6d193f2dc08ce6c1f23309";
const PARENT_ID = "6560bd60-bc36-4c52-8f13-32ac3ee84aa2";
const CHILD_ID = "16a6ed2d-931f-4081-969c-bd9340094eff";

function run(command, args, options = {}) { return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout: options.timeout || 180000, input: options.input }); }
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function ok(result, label) { assert.equal(result.error, undefined, `${label}: ${result.error?.message}`); assert.equal(result.status, 0, `${label}: ${output(result)}`); return result; }
function fails(result, label, pattern) { assert.equal(result.error, undefined, `${label}: ${result.error?.message}`); assert.notEqual(result.status, 0, `${label} unexpectedly passed`); assert.match(output(result), pattern); }
function dockerAvailable() { return run("docker", ["version", "--format", "{{.Server.Version}}"], { timeout: 10000 }).status === 0; }
function exec(container, args, options = {}) { return run("docker", ["exec", ...(options.stdin ? ["-i"] : []), container, ...args], options); }
function psql(container, database, sql, user = "postgres") { return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", database, "-tA", "-c", sql]); }
function psqlText(container, database, sql, user = "postgres") { return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", database, "-f", "-"], { stdin: true, input: sql }); }
function psqlFile(container, database, file) { return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-f", `/workspace/${path.relative(ROOT, file).replaceAll("\\", "/")}`]); }
function waitForPostgres(container) { let consecutive = 0; for (let attempt = 0; attempt < 100; attempt += 1) { consecutive = exec(container, ["pg_isready", "-U", "postgres"], { timeout: 5000 }).status === 0 ? consecutive + 1 : 0; if (consecutive === 3) return; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); } assert.fail("PostgreSQL did not start"); }
function functionDefinition(container, database) { return ok(psql(container, database, "select pg_get_functiondef('public.prepare_sequential_retailer_offer_sync_parent_approval(jsonb)'::regprocedure)"), "function definition").stdout.trimEnd(); }
function functionSha(container, database) { return ok(psql(container, database, "select encode(extensions.digest(convert_to(replace(pg_get_functiondef('public.prepare_sequential_retailer_offer_sync_parent_approval(jsonb)'::regprocedure),chr(13),''),'UTF8'),'sha256'),'hex')"), "function SHA").stdout.trim(); }
function oldFunctionSql() {
  const rollback = fs.readFileSync(ROLLBACK, "utf8");
  const start = rollback.indexOf("create or replace function public.prepare_sequential_retailer_offer_sync_parent_approval");
  const endToken = "grant execute on function public.prepare_sequential_retailer_offer_sync_parent_approval(jsonb) to retailer_catalogue_production_approver;";
  const end = rollback.indexOf(endToken, start) + endToken.length;
  assert.ok(start >= 0 && end > start);
  return rollback.slice(start, end);
}

function fixtureSql() {
  return `
create schema extensions;
create extension pgcrypto with schema extensions;
do $roles$ begin
  if to_regrole('anon') is null then create role anon nologin; end if;
  if to_regrole('authenticated') is null then create role authenticated nologin; end if;
  if to_regrole('service_role') is null then create role service_role nologin; end if;
  if to_regrole('retailer_catalogue_production_approver') is null then create role retailer_catalogue_production_approver nologin noinherit; end if;
  if to_regrole('supplementscout_production_approver_login') is null then create role supplementscout_production_approver_login login noinherit; end if;
end $roles$;
grant retailer_catalogue_production_approver to supplementscout_production_approver_login;

create table public.products(id bigint primary key);
create table public.product_variants(id bigint primary key);
create table public.retailer_products(id bigint primary key,retailer_id bigint not null);
create table public.offers(id bigint primary key,retailer_id bigint not null);
create table public.price_history(id bigint primary key,offer_id bigint not null);
insert into public.products values(1);
insert into public.product_variants values(1);
insert into public.retailer_products select id,15 from generate_series(1,602) id;
insert into public.retailer_products values(4159,15);
insert into public.offers select id,15 from generate_series(1,602) id;
insert into public.offers values(3972,15);
insert into public.price_history select id,id from generate_series(1,602) id;
insert into public.price_history values(3972,3972);

create table public.retailer_catalogue_parent_plans(
  id uuid primary key,parent_plan_fingerprint text,retailer_id bigint,target_environment text,status text,
  approval_id uuid,approved_by text,approved_at timestamptz,approval_expires_at timestamptz,approval_consumed_at timestamptz,
  created_by text,code_commit text,created_at timestamptz,updated_at timestamptz,
  source_snapshot_fingerprint text,canonical_snapshot_fingerprint text,adapter_fingerprint text,policy_fingerprint text,
  expected_state_fingerprint text,plan_json jsonb,audit_log jsonb
);
create table public.retailer_catalogue_child_plans(
  id uuid primary key,parent_plan_id uuid,child_plan_fingerprint text,parent_plan_fingerprint text,
  retailer_id bigint,target_environment text,status text,batch_index integer,batch_count integer,
  approval_id uuid,approved_at timestamptz,approval_expires_at timestamptz,approval_consumed_at timestamptz,
  code_commit text,record_ids jsonb,created_at timestamptz,updated_at timestamptz,audit_log jsonb
);
create table public.retailer_catalogue_apply_runs(id uuid default gen_random_uuid(),parent_plan_id uuid,child_plan_id uuid);
create table public.retailer_offer_sync_batch_approvals(id uuid default gen_random_uuid(),child_plan_id uuid);
create table public.approved_import_plans(id uuid default gen_random_uuid(),run_id text,plan_json jsonb,authorization_envelope jsonb);
create table public.retailer_catalogue_production_recovery_manifests(id uuid default gen_random_uuid(),child_plan_id uuid);
create table public.retailer_catalogue_production_recovery_approvals(id uuid default gen_random_uuid(),child_plan_id uuid);
create table public.product_match_review_queue(id bigint primary key,offer_id bigint,retailer_product_id bigint,review_status text,execution_error_code text);
create table public.automation_review_execution_requests(id uuid primary key,review_id bigint,status text,run_id text,commit_sha text,database_writes integer,error_code text,last_checkpoint text);

insert into public.retailer_catalogue_parent_plans values(
  '${PARENT_ID}','fe1852be68326a27159eea115a581a1fb33525c9e48cb58f23911acf0f17d7ee',15,'PRODUCTION','PLANNED',
  null,null,null,null,null,'github:SupplementScout/supplementscout:40521391539:1','40d5e93e8db21c93b9615263fcf5354b51c0011d',
  '2026-10-27T14:29:02.03652Z','2026-10-27T14:29:02.03652Z',
  '042a167734fc319e3a039a9e128753a814da1a3e5c3891c73a005307024c4efb',
  '66cf2bc813e3f542cb883dba7ab1ddd2b467a9666e84ad3a35cf67bced7e0710',
  '24bbd138a39f200ea7a134ee088853b82452915d1d0b259858850f96fbd84137',
  '7bb83067fa94c01877616c5dc9b85aeb2fe7a82939c02f3194da1552de8d5290',
  '66cf2bc813e3f542cb883dba7ab1ddd2b467a9666e84ad3a35cf67bced7e0710',
  '{"expires_at":"2026-10-27T15:13:01.354Z"}',
  '[{"event":"APPROVED_RETAILER_AUTOMATION_PLAN_REGISTERED","workflow":{"run_id":"40521391539"},"manifest_fingerprint":"834766bb56dd8783677df88a644bdde382fec9070a33801d11919555f4dc958a","approved_manifest_sha256":"F07122185A4D601E9E4172378D2FCF6636E5AB1833C33C749F69BCCD3FCD8078","operation_count":20}]'
);
insert into public.retailer_catalogue_child_plans values(
  '${CHILD_ID}','${PARENT_ID}','a3e338a85d7652c174b489e36f2a9525ace22e53d4ed3bf9acb109675dbd3cd1',
  'fe1852be68326a27159eea115a581a1fb33525c9e48cb58f23911acf0f17d7ee',15,'PRODUCTION','PLANNED',0,1,
  null,null,null,null,'40d5e93e8db21c93b9615263fcf5354b51c0011d',
  '["3887","3888","3890","3891","3892","3893","3894","3896","3897","3898","3899","3900","3901","3902","3903","3904","3905","3906","3907","3972"]',
  '2026-10-27T14:29:02.03652Z','2026-10-27T14:29:02.03652Z',
  '[{"event":"APPROVED_RETAILER_AUTOMATION_CHILD_REGISTERED","workflow":{"run_id":"40521391539"},"artifact_fingerprint":"a3e338a85d7652c174b489e36f2a9525ace22e53d4ed3bf9acb109675dbd3cd1"}]'
);
insert into public.product_match_review_queue values(2390,3972,4159,'FAILED','P0001');
insert into public.automation_review_execution_requests values('b1129cb6-57c7-488e-9f69-7cce63e0bfdb',2390,'FAILED','40521391539','40d5e93e8db21c93b9615263fcf5354b51c0011d',20,'P0001','EXECUTION_FAILED');

create function public.retailer_catalogue_actual_database_target() returns jsonb language sql stable as $$
  select '{"target_environment":"PRODUCTION","project_ref":"aftboxmrdgyhizicfsfu","database_identity":"supplementscout-production:aftboxmrdgyhizicfsfu"}'::jsonb
$$;
create function public.retailer_catalogue_business_counts() returns jsonb language sql stable as $$
  select jsonb_build_object('products',(select count(*) from products),'product_variants',(select count(*) from product_variants),'retailer_products',(select count(*) from retailer_products),'offers',(select count(*) from offers),'price_history',(select count(*) from price_history))
$$;
create function public.retailer_catalogue_sha256_json(p_value jsonb) returns text language sql immutable strict as $$
  select encode(extensions.digest(convert_to(p_value::text,'UTF8'),'sha256'),'hex')
$$;
create function public.atomic_import_has_exact_keys(p_value jsonb,p_keys text[]) returns boolean language sql immutable as $$
  select jsonb_typeof(p_value)='object' and (select array_agg(key order by key) from jsonb_object_keys(p_value) key)=(select array_agg(key order by key) from unnest(p_keys) key)
$$;
create function public.retailer_catalogue_raise(p_code text,p_summary text) returns void language plpgsql as $$begin raise exception '%',jsonb_build_object('code',p_code,'summary',p_summary)::text using errcode='P0001'; end$$;
create function public.retailer_catalogue_production_runtime_guard(p_environment text,p_ref text,p_identity text) returns void language plpgsql as $$begin if p_environment<>'PRODUCTION' or p_ref<>'aftboxmrdgyhizicfsfu' or p_identity<>'supplementscout-production:aftboxmrdgyhizicfsfu' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','production guard'); end if; end$$;
create function public.approve_retailer_catalogue_parent_plan(p_id uuid,p_fingerprint text,p_actor text,p_expires timestamptz) returns jsonb language plpgsql as $$begin update public.retailer_catalogue_parent_plans set status='APPROVED',approval_id=gen_random_uuid(),approved_by=p_actor,approved_at=now(),approval_expires_at=p_expires where id=p_id and parent_plan_fingerprint=p_fingerprint; return jsonb_build_object('status','APPROVED'); end$$;
`;
}

function seedFreshGladiatorParent(container, database) {
  return psqlText(container, database, `
    insert into public.retailer_catalogue_parent_plans(id,parent_plan_fingerprint,retailer_id,target_environment,status,created_by,code_commit,created_at,updated_at,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,expected_state_fingerprint,plan_json,audit_log)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${"a".repeat(64)}',15,'PRODUCTION','PLANNED','github:SupplementScout/supplementscout:integration:1','${"b".repeat(40)}',now(),now(),'${"c".repeat(64)}','${"d".repeat(64)}','${"e".repeat(64)}','${"f".repeat(64)}','${"d".repeat(64)}','{}','{}');
    insert into public.retailer_catalogue_child_plans(id,parent_plan_id,child_plan_fingerprint,parent_plan_fingerprint,retailer_id,target_environment,status,batch_index,batch_count,code_commit,record_ids,created_at,updated_at,audit_log)
    values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${"1".repeat(64)}','${"a".repeat(64)}',15,'PRODUCTION','PLANNED',0,1,'${"b".repeat(40)}','[]',now(),now(),'{}');
  `);
}

function approvalRequest() {
  return JSON.stringify({
    schema_version: 1,
    parent_plan_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    parent_plan_fingerprint: "a".repeat(64),
    retailer_id: "15",
    approved_by: "github-gladiator-nutrition-sync:integration",
    expires_at: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
    workflow: { repository: "SupplementScout/supplementscout", run_id: "integration", run_attempt: "1", actor: "integration" },
    production_project_ref: "aftboxmrdgyhizicfsfu",
    production_database_identity: "supplementscout-production:aftboxmrdgyhizicfsfu",
  }).replaceAll("'", "''");
}

function seedUnknownParent(container, database) {
  return psqlText(container, database, `
    insert into public.retailer_catalogue_parent_plans(id,parent_plan_fingerprint,retailer_id,target_environment,status,created_by,code_commit,created_at,updated_at,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,expected_state_fingerprint,plan_json,audit_log)
    values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','${"2".repeat(64)}',99,'PRODUCTION','PLANNED','github:SupplementScout/supplementscout:unknown:1','${"b".repeat(40)}',now(),now(),'${"c".repeat(64)}','${"d".repeat(64)}','${"e".repeat(64)}','${"f".repeat(64)}','${"d".repeat(64)}','{}','{}');
    insert into public.retailer_catalogue_child_plans(id,parent_plan_id,child_plan_fingerprint,parent_plan_fingerprint,retailer_id,target_environment,status,batch_index,batch_count,code_commit,record_ids,created_at,updated_at,audit_log)
    values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','cccccccc-cccc-4ccc-8ccc-cccccccccccc','${"3".repeat(64)}','${"2".repeat(64)}',99,'PRODUCTION','PLANNED',0,1,'${"b".repeat(40)}','[]',now(),now(),'{}');
  `);
}

function unknownApprovalRequest() {
  return JSON.stringify({
    schema_version: 1,
    parent_plan_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    parent_plan_fingerprint: "2".repeat(64),
    retailer_id: "99",
    approved_by: "github-unknown-sync:unknown",
    expires_at: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
    workflow: { repository: "SupplementScout/supplementscout", run_id: "unknown", run_attempt: "1", actor: "integration" },
    production_project_ref: "aftboxmrdgyhizicfsfu",
    production_database_identity: "supplementscout-production:aftboxmrdgyhizicfsfu",
  }).replaceAll("'", "''");
}

test("migration is a narrow production-only shared allowlist extension with terminal exact-plan cleanup", () => {
  const forward = fs.readFileSync(FORWARD, "utf8");
  const rollback = fs.readFileSync(ROLLBACK, "utf8");
  const previous = fs.readFileSync(path.join(ROOT, "supabase/migrations/20260922170000_allow_fit_house_parent_approval_and_supersede_failed_plan.sql"), "utf8");
  const marker = "create or replace function public.prepare_sequential_retailer_offer_sync_parent_approval(p_request jsonb)";
  const functionSection = (source) => source.slice(source.indexOf(marker), source.indexOf("alter function public.prepare_sequential_retailer_offer_sync_parent_approval", source.indexOf(marker))).replaceAll("\r\n", "\n");
  const expected = functionSection(previous)
    .replace("(4,5,7,8,9,14)", "(4,5,7,8,9,14,15)")
    .replace("when 14 then '10-reps' end;", "when 14 then '10-reps' when 15 then 'gladiator-nutrition' end;");
  assert.match(forward, /^begin;/i);
  assert.equal(functionSection(forward), expected);
  assert.match(forward, /v_parent\.retailer_id not in \(4,5,7,8,9,14,15\)/);
  assert.match(forward, /when 15 then 'gladiator-nutrition'/);
  assert.match(forward, /v_expected_actor:='github-'\|\|v_slug\|\|'-sync:'/);
  assert.match(forward, /p\.proowner='postgres'::regrole[\s\S]+p\.provolatile='v' and p\.prosecdef[\s\S]+search_path=pg_catalog, public, pg_temp/);
  assert.match(forward, /retailer_catalogue_production_approver=X\/postgres/);
  assert.match(forward, new RegExp(PARENT_ID));
  assert.match(forward, new RegExp(CHILD_ID));
  for (const table of ["retailer_catalogue_apply_runs", "retailer_offer_sync_batch_approvals", "approved_import_plans", "retailer_catalogue_production_recovery_manifests", "retailer_catalogue_production_recovery_approvals"]) assert.match(forward, new RegExp(table));
  assert.doesNotMatch(forward, /\b(?:insert into|update|delete from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history)\b/i);
  assert.doesNotMatch(forward, /create\s+(?:or\s+replace\s+)?function\s+public\.(?!prepare_sequential_retailer_offer_sync_parent_approval)/i);
  assert.doesNotMatch(forward, /create or replace function public\.(?:approve_retailer_offer_sync_batch|execute_retailer_offer_sync_batch|retailer_offer_sync_(?:approve|execute)_batch_internal)/i);
  assert.doesNotMatch(forward, /update\s+public\.(?:product_match_review_queue|automation_review_execution_requests|offers|retailer_products|price_history)/i);
  assert.match(forward, /where id='16a6ed2d-931f-4081-969c-bd9340094eff'::uuid and status='PLANNED'/);
  assert.match(forward, /where id='6560bd60-bc36-4c52-8f13-32ac3ee84aa2'::uuid and status='PLANNED'/);
  assert.match(forward, /SHARED_PARENT_APPROVAL_ALLOWLIST_MISSING_RETAILER_15/);
  assert.match(forward, /jsonb_typeof\(p\.audit_log\)='array'[\s\S]+jsonb_array_elements\(p\.audit_log\)/);
  assert.match(forward, /jsonb_typeof\(c\.audit_log\)='array'[\s\S]+jsonb_array_elements\(c\.audit_log\)/);
  assert.match(rollback, /terminal supersede evidence mismatch/);
  assert.doesNotMatch(rollback, /update\s+public\.retailer_catalogue_(?:parent|child)_plans/i);
  assert.doesNotMatch(rollback, /status='PLANNED'/i);
});

test("disposable PostgreSQL proves array-shaped live evidence, unchanged business state, rollback safety and fail-closed drift", { skip: !dockerAvailable() && "Docker daemon unavailable" }, () => {
  const container = `supplementscout-gladiator-parent-${crypto.randomBytes(5).toString("hex")}`;
  let primaryError;
  try {
    ok(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-v", `${ROOT}:/workspace:ro`, IMAGE]), "start PostgreSQL");
    waitForPostgres(container);
    for (const database of ["success", "drift", "object_shape"]) {
      ok(exec(container, ["createdb", "-U", "postgres", database]), `create ${database}`);
      ok(psqlText(container, database, fixtureSql()), `fixture ${database}`);
      ok(psqlText(container, database, oldFunctionSql()), `old function ${database}`);
      assert.equal(functionSha(container, database), OLD_FUNCTION_SHA, functionDefinition(container, database));
    }

    ok(seedFreshGladiatorParent(container, "success"), "fresh unrelated Gladiator parent");
    const before = ok(psql(container, "success", "select public.retailer_catalogue_business_counts()::text"), "business before").stdout.trim();
    ok(psqlFile(container, "success", FORWARD), "forward migration");
    assert.equal(functionSha(container, "success"), NEW_FUNCTION_SHA);
    assert.equal(ok(psql(container, "success", `select string_agg(status,',' order by kind) from (select 'parent' kind,status from retailer_catalogue_parent_plans where id='${PARENT_ID}' union all select 'child',status from retailer_catalogue_child_plans where id='${CHILD_ID}') s`), "terminal state").stdout.trim(), "SUPERSEDED,SUPERSEDED");
    assert.equal(ok(psql(container, "success", "select public.retailer_catalogue_business_counts()::text"), "business after").stdout.trim(), before);
    assert.equal(ok(psql(container, "success", "select (select count(*) from retailer_catalogue_apply_runs)||':'||(select count(*) from retailer_offer_sync_batch_approvals)||':'||(select count(*) from approved_import_plans)"), "execution state").stdout.trim(), "0:0:0");
    assert.equal(ok(psql(container, "success", "select status from retailer_catalogue_parent_plans where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'"), "unrelated Gladiator parent").stdout.trim(), "PLANNED");

    const approval = psqlText(container, "success", `set role retailer_catalogue_production_approver; select public.prepare_sequential_retailer_offer_sync_parent_approval('${approvalRequest()}'::jsonb)::text;`, "supplementscout_production_approver_login");
    assert.match(ok(approval, "Gladiator parent approval").stdout, /"status": "APPROVED"/);
    ok(seedUnknownParent(container, "success"), "unknown retailer parent");
    fails(psqlText(container, "success", `set role retailer_catalogue_production_approver; select public.prepare_sequential_retailer_offer_sync_parent_approval('${unknownApprovalRequest()}'::jsonb)::text;`, "supplementscout_production_approver_login"), "unknown retailer approval", /RSBI_EXPECTED_STATE_MISMATCH/);

    ok(psqlFile(container, "success", ROLLBACK), "rollback migration");
    assert.equal(functionSha(container, "success"), OLD_FUNCTION_SHA);
    assert.equal(ok(psql(container, "success", `select status from retailer_catalogue_parent_plans where id='${PARENT_ID}'`), "parent remains terminal").stdout.trim(), "SUPERSEDED");

    ok(psqlText(container, "drift", `insert into retailer_catalogue_apply_runs(parent_plan_id,child_plan_id) values('${PARENT_ID}','${CHILD_ID}')`), "inject incident drift");
    fails(psqlFile(container, "drift", FORWARD), "drifted incident migration", /precondition mismatch/);
    assert.equal(functionSha(container, "drift"), OLD_FUNCTION_SHA);
    assert.equal(ok(psql(container, "drift", `select status from retailer_catalogue_parent_plans where id='${PARENT_ID}'`), "drift rollback state").stdout.trim(), "PLANNED");

    ok(psqlText(container, "object_shape", `
      update public.retailer_catalogue_parent_plans set audit_log=audit_log->0 where id='${PARENT_ID}';
      update public.retailer_catalogue_child_plans set audit_log=audit_log->0 where id='${CHILD_ID}';
    `), "inject malformed object-shaped audit logs");
    fails(psqlFile(container, "object_shape", FORWARD), "object-shaped audit log migration", /parent precondition mismatch/);
    assert.equal(functionSha(container, "object_shape"), OLD_FUNCTION_SHA);
    assert.equal(ok(psql(container, "object_shape", `select jsonb_typeof(audit_log)||':'||status from retailer_catalogue_parent_plans where id='${PARENT_ID}'`), "object-shaped parent remains untouched").stdout.trim(), "object:PLANNED");
  } catch (error) { primaryError = error; throw error; } finally {
    const cleanup = run("docker", ["rm", "-f", container], { timeout: 30000 });
    if (!primaryError && cleanup.status !== 0) assert.fail(output(cleanup));
  }
});
