const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { migrationLedgerFingerprint } = require("./lib/retailer-snapshot/staging-execution-contract");
const { validateMetadata } = require("./lib/retailer-offer-sync/ra004-staging-preflight-v1/contract");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = "postgres:17-alpine";
const BASELINE = "supabase/migrations/20260712211120_baseline_current_public_schema.sql";
const CONTROL_FIXTURE = "supabase/test/retailer_control_state_interface_fixture.sql";
const CONTROL_MIGRATION = "supabase/migrations/20260924100000_add_transactional_retailer_control_state_interface.sql";
const PREFLIGHT_MIGRATION = "supabase/migrations/20260925100000_add_ra004_staging_preflight_metadata_interface.sql";
const MIGRATIONS = [
  "20260712211120_baseline_current_public_schema",
  "20260924100000_add_transactional_retailer_control_state_interface",
  "20260925100000_add_ra004_staging_preflight_metadata_interface",
];
const LEDGER_FINGERPRINT = migrationLedgerFingerprint(MIGRATIONS, "STAGING");
const ROLE_SQL = `do $roles$ declare n text; begin foreach n in array array['anon','authenticated','service_role','retailer_catalogue_production_validator','retailer_catalogue_production_approver','retailer_catalogue_production_executor'] loop if not exists(select 1 from pg_roles where rolname=n) then execute format('create role %I nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls',n); end if; end loop; end $roles$;`;

function run(command, args, timeout = 300_000) { return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout }); }
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function ok(result, label) { assert.equal(result.error, undefined, `${label}: ${result.error?.message}`); assert.equal(result.status, 0, `${label}: ${output(result)}`); return result; }
function denied(result, label, pattern = /permission denied|not permitted|must be owner|cannot set role|does not exist|RA004_PREFLIGHT_/i) { assert.equal(result.error, undefined, `${label}: ${result.error?.message}`); assert.notEqual(result.status, 0, `${label} unexpectedly succeeded: ${output(result)}`); assert.match(output(result), pattern); }
function docker(container, args, timeout) { return run("docker", ["exec", container, ...args], timeout); }
function sql(container, database, statement, user = "postgres") { return docker(container, ["psql","-X","--no-psqlrc","-v","ON_ERROR_STOP=1","-U",user,"-d",database,"-tA","-c",statement]); }
function file(container, database, filename, variables = []) { return docker(container, ["psql","-X","--no-psqlrc","-v","ON_ERROR_STOP=1",...variables.flatMap((value)=>["-v",value]),"-U","postgres","-d",database,"-f",`/workspace/${filename}`]); }
function json(result) { const line=result.stdout.split(/\r?\n/).findLast((row)=>row.trim().startsWith("{")); assert.ok(line,output(result)); return JSON.parse(line); }
function wait(container) { for(let attempt=0,consecutive=0;attempt<100;attempt+=1){const result=docker(container,["psql","-X","--no-psqlrc","-U","postgres","-d","postgres","-tAc","select 1"],5000); consecutive=result.status===0&&result.stdout.trim()==="1"?consecutive+1:0;if(consecutive===3)return;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);}assert.fail("isolated PostgreSQL did not start"); }
function quote(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function ledgerSql() { return `create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text not null,statements text[] not null default array[]::text[]); insert into supabase_migrations.schema_migrations(version,name) values ${MIGRATIONS.map((item)=>{const split=item.indexOf("_");return `(${quote(item.slice(0,split))},${quote(item.slice(split+1))})`;}).join(",")};`; }
function call(environment="STAGING", count=3, fingerprint=LEDGER_FINGERPRINT, maxBytes=131072) { return `select public.read_ra004_staging_preflight_v1(${quote(environment)},'10 Reps','10-reps',${count},${quote(fingerprint)},'ra004_preflight_test_login',${maxBytes})::text`; }
function asLogin(statement) { return `set session authorization ra004_preflight_test_login; ${statement}`; }

test("RA-004 preflight migration and closed Q2-Q7 RPC pass in networkless PostgreSQL 17", () => {
  for (const [name,value] of Object.entries(process.env)) {
    if (/DATABASE_URL|DIRECT_URL|POSTGRES_URL|PGHOST|SUPABASE_SERVICE_ROLE_KEY/i.test(name) && value && !/localhost|127\.0\.0\.1|::1/i.test(value)) assert.fail(`RA004_LOCAL_GUARD: remote environment ${name}`);
    if (value && /aftboxmrdgyhizicfsfu|hxnrsyyqffztlvcrtgbf/i.test(value)) assert.fail(`RA004_LOCAL_GUARD: cloud project reference in ${name}`);
  }
  const container=`ra-004-preflight-${crypto.randomBytes(5).toString("hex")}`;
  const database=`ra004_control_state_test_preflight_${crypto.randomBytes(4).toString("hex")}`;
  let primary;
  try {
    ok(run("docker",["run","--detach","--rm","--name",container,"--network","none","-e","POSTGRES_HOST_AUTH_METHOD=trust","-v",`${ROOT}:/workspace:ro`,IMAGE]),"start networkless PostgreSQL 17");
    wait(container);
    ok(docker(container,["createdb","-U","postgres",database]),"create synthetic database");
    const target=json(ok(sql(container,database,"select jsonb_build_object('database',current_database(),'address',inet_server_addr(),'port',inet_server_port(),'version',current_setting('server_version'))::text"),"prove socket-only target"));
    assert.match(target.database,/^ra004_control_state_test_preflight_/); assert.equal(target.address,null); assert.equal(target.port,null); assert.match(target.version,/^17\./);
    ok(sql(container,database,ROLE_SQL),"bootstrap standard local roles");
    ok(sql(container,database,ledgerSql()),"create synthetic migration ledger");
    ok(file(container,database,BASELINE),"apply repository baseline");
    ok(file(container,database,CONTROL_FIXTURE,[`expected_database=${database}`]),"apply synthetic control-state fixture");
    ok(file(container,database,CONTROL_MIGRATION),"apply existing control-state migration");
    ok(sql(container,database,"insert into public.retailers(id,name,slug) values (14,'10 Reps','10-reps'); create role ra004_preflight_test_login login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;"),"create synthetic retailer and ephemeral login");
    ok(file(container,database,PREFLIGHT_MIGRATION),"apply preflight migration");
    denied(file(container,database,PREFLIGHT_MIGRATION),"forward-only rerun",/SCHEMA_DRIFT/);
    ok(sql(container,database,"grant execute on function public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer) to ra004_preflight_test_login"),"grant one exact RPC to ephemeral login");

    const properties=json(ok(sql(container,database,`select jsonb_build_object(
      'signature',to_regprocedure('public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)') is not null,
      'owner',pg_get_userbyid(proowner),'security_definer',prosecdef,'volatility',provolatile,'path',proconfig,
      'owner_login',(select rolcanlogin from pg_roles where rolname='ra004_staging_preflight_owner'),
      'caller_login',(select rolcanlogin from pg_roles where rolname='ra004_staging_preflight_caller'),
      'caller_inherit',(select rolinherit from pg_roles where rolname='ra004_staging_preflight_caller'),
      'public_execute',has_function_privilege('public',oid,'EXECUTE'),
      'caller_execute',has_function_privilege('ra004_staging_preflight_caller',oid,'EXECUTE'),
      'login_execute',has_function_privilege('ra004_preflight_test_login',oid,'EXECUTE')
    )::text from pg_proc where oid='public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)'::regprocedure`),"function and role properties"));
    assert.deepEqual(properties,{signature:true,owner:"ra004_staging_preflight_owner",security_definer:true,volatility:"s",path:["search_path=pg_catalog"],owner_login:false,caller_login:false,caller_inherit:false,public_execute:false,caller_execute:true,login_execute:true});
    const broad=json(ok(sql(container,database,`select jsonb_build_object(
      'attributes',(select jsonb_build_object('super',rolsuper,'inherit',rolinherit,'createdb',rolcreatedb,'createrole',rolcreaterole,'replication',rolreplication,'bypassrls',rolbypassrls) from pg_roles where rolname='ra004_preflight_test_login'),
      'tables',(select count(*) from information_schema.table_privileges where grantee='ra004_preflight_test_login'),
      'sequences',(select count(*) from information_schema.usage_privileges where grantee='ra004_preflight_test_login' and object_type='SEQUENCE'),
      'memberships',(select count(*) from pg_auth_members m join pg_roles r on r.oid=m.member where r.rolname='ra004_preflight_test_login'),
      'forbidden_rpc_count',(select count(*) from information_schema.routine_privileges where grantee='ra004_preflight_test_login' and routine_name<>'read_ra004_staging_preflight_v1')
    )::text`),"effective login boundary"));
    assert.deepEqual(broad,{attributes:{super:false,inherit:false,createdb:false,createrole:false,replication:false,bypassrls:false},tables:0,sequences:0,memberships:0,forbidden_rpc_count:0});

    for(const statement of [
      "select * from public.retailers", "select * from public.products", "select nextval('public.products_id_seq')",
      "insert into public.retailers(id,name,slug) values (99,'x','x')", "update public.retailers set name='x' where id=14",
      "delete from public.retailers where id=14", "truncate public.retailers", "create table public.ra004_forbidden(id integer)",
      "alter table public.retailers add column forbidden integer", "drop table public.retailers",
      "set role ra004_staging_preflight_caller", "set role retailer_catalogue_production_validator",
      "select public.write_retailer_control_state_evidence_v1(null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null)",
    ]) denied(sql(container,database,asLogin(statement)),`ephemeral login denied ${statement}`);

    const result=json(ok(sql(container,database,asLogin(call())),"one exact metadata RPC")); validateMetadata(result);
    assert.equal(result.q2_retailer.id,"14"); assert.equal(result.q4_objects.length,6); assert.equal(result.snapshot.business_rows_read,0);
    assert.doesNotMatch(JSON.stringify(result),/(?:offer|price|stock|customer|order|feed)(?:s|_id)?"\s*:/i);
    const repeat=json(ok(sql(container,database,asLogin(call())),"deterministic repeat")); assert.equal(repeat.metadata_fingerprint,result.metadata_fingerprint); assert.deepEqual(repeat,result);

    const hijack=json(ok(sql(container,database,asLogin(`create function pg_temp.sha256(bytea) returns bytea language sql immutable as 'select decode(repeat(''00'',32),''hex'')'; ${call()}`)),"pg_temp hijack resistance")); assert.equal(hijack.metadata_fingerprint,result.metadata_fingerprint);
    denied(sql(container,database,asLogin("create function public.sha256(bytea) returns bytea language sql immutable as 'select $1'")),"public search-path hijack");
    const source=ok(sql(container,database,"select prosrc from pg_proc where oid='public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)'::regprocedure"),"read function source").stdout;
    assert.doesNotMatch(source,/\bexecute\s+(?:format|['"])/i); assert.doesNotMatch(source,/\b(insert|update|delete|truncate|alter|create|drop)\s+(?:into|table|role|function|schema|on|from|public\.)/i);

    denied(sql(container,database,asLogin(call("PRODUCTION"))),"production-like target");
    denied(sql(container,database,asLogin(call("STAGING",3,"f".repeat(64)))),"unknown ledger");
    denied(sql(container,database,asLogin(call("STAGING",3,LEDGER_FINGERPRINT,4096))),"output byte cap",/LIMIT_EXCEEDED/);
    denied(sql(container,database,`begin; delete from public.retailers where id=14; set session authorization ra004_preflight_test_login; ${call()}`),"missing retailer",/RETAILER_AMBIGUOUS/);
    denied(sql(container,database,`begin; insert into public.retailers(id,name,slug) values (15,'10 Reps','duplicate'); set session authorization ra004_preflight_test_login; ${call()}`),"duplicate retailer",/RETAILER_AMBIGUOUS/);
    denied(sql(container,database,`begin; alter table public.retailers rename to retailers_missing; set session authorization ra004_preflight_test_login; ${call()}`),"missing object");
    denied(sql(container,database,`begin; alter function public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer) owner to postgres; set session authorization ra004_preflight_test_login; ${call()}`),"function schema drift",/SCHEMA_DRIFT/);
    denied(sql(container,database,`begin; alter role ra004_preflight_test_login inherit; set session authorization ra004_preflight_test_login; ${call()}`),"unsafe role attribute",/ROLE_UNSAFE/);
    denied(sql(container,database,`begin; grant retailer_catalogue_production_validator to ra004_preflight_test_login; set session authorization ra004_preflight_test_login; ${call()}`),"unsafe membership",/ROLE_UNSAFE/);
    denied(sql(container,database,`begin; grant select on public.retailers to ra004_preflight_test_login; set session authorization ra004_preflight_test_login; ${call()}`),"unsafe table grant",/ACL_UNSAFE/);
    denied(sql(container,database,`begin; alter table public.retailer_control_state_evidence_v1 disable row level security; set session authorization ra004_preflight_test_login; ${call()}`),"missing RLS",/ACL_UNSAFE/);
    denied(sql(container,database,`begin; drop policy retailer_control_state_evidence_owner_select_v1 on public.retailer_control_state_evidence_v1; set session authorization ra004_preflight_test_login; ${call()}`),"policy drift",/ACL_UNSAFE/);

    ok(sql(container,database,"revoke execute on function public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer) from ra004_preflight_test_login"),"revoke exact RPC");
    denied(sql(container,database,asLogin(call())),"revocation removes effective access");
  } catch (error) { primary=error; throw error; }
  finally { const cleanup=run("docker",["rm","-f",container],30_000); if(!primary) ok(cleanup,"remove isolated PostgreSQL"); }
});
