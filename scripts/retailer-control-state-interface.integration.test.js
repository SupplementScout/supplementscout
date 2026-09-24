const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const test = require("node:test");
const { assertOutputShape, SOURCE_NAMES } = require("./lib/retailer-offer-sync/control-state-export-v1/schema");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = "postgres:17-alpine";
const BASELINE = path.join(ROOT, "supabase/migrations/20260712211120_baseline_current_public_schema.sql");
const FIXTURE = path.join(ROOT, "supabase/test/retailer_control_state_interface_fixture.sql");
const MIGRATION = path.join(ROOT, "supabase/migrations/20260924100000_add_transactional_retailer_control_state_interface.sql");
const ROLE_SQL = `do $roles$ declare n text; begin foreach n in array array['anon','authenticated','service_role','retailer_catalogue_production_validator','retailer_catalogue_production_approver','retailer_catalogue_production_executor'] loop if not exists(select 1 from pg_roles where rolname=n) then execute format('create role %I nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls',n); end if; end loop; end $roles$;`;
const q = (value) => value === null ? "null" : `'${String(value).replaceAll("'", "''")}'`;

function run(command, args, timeout = 180_000) { return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout }); }
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function ok(result, label) { assert.equal(result.error, undefined, `${label}: ${result.error?.message}`); assert.equal(result.status, 0, `${label}: ${output(result)}`); return result; }
function denied(result, label, pattern = /permission denied|must be owner|not permitted|does not exist|RCSE_/i) { assert.equal(result.error, undefined, `${label}: ${result.error?.message}`); assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`); assert.match(output(result), pattern); }
function docker(container, args, timeout) { return run("docker", ["exec", container, ...args], timeout); }
function sql(container, database, statement, user = "postgres") { return docker(container, ["psql","-X","--no-psqlrc","-v","ON_ERROR_STOP=1","-U",user,"-d",database,"-tA","-c",statement]); }
function file(container, database, filename, variables = []) { return docker(container, ["psql","-X","--no-psqlrc","-v","ON_ERROR_STOP=1",...variables.flatMap((v) => ["-v",v]),"-U","postgres","-d",database,"-f",`/workspace/${path.relative(ROOT, filename).replaceAll("\\", "/")}`], 300_000); }
function jsonResult(result) { const line = result.stdout.split(/\r?\n/).findLast((row) => row.trim().startsWith("{")); assert.ok(line, output(result)); return JSON.parse(line); }
function wait(container) { let consecutive=0; for (let i=0;i<100;i+=1) { const result=docker(container,["psql","-X","--no-psqlrc","-U","postgres","-d","postgres","-tAc","select 1"],5000); consecutive=result.status===0&&result.stdout.trim()==="1"?consecutive+1:0; if(consecutive===3)return; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250); } assert.fail("local PostgreSQL did not start"); }
function asyncSql(container, database, statement) { return new Promise((resolve) => { const child=spawn("docker",["exec",container,"psql","-X","--no-psqlrc","-v","ON_ERROR_STOP=1","-U","postgres","-d",database,"-tA","-c",statement],{cwd:ROOT}); let stdout="",stderr=""; child.stdout.on("data",(b)=>stdout+=b); child.stderr.on("data",(b)=>stderr+=b); child.on("close",(status)=>resolve({status,stdout,stderr})); }); }

function eventSql(overrides = {}) {
  const now = Date.now();
  const event = {
    event_id: crypto.randomUUID(), event_version: 1, event_type: "SOURCE_OBSERVED",
    retailer_id: 14, global_scope: false, scope_fingerprint: "a".repeat(64),
    source_system: "RA004_LOCAL_TEST", source_run_id: `run-${crypto.randomUUID()}`,
    parent_id: null, status: "OBSERVED", reason_code: "RCSE_LOCAL_TEST",
    metadata: {}, idempotency_key: crypto.randomBytes(32).toString("hex"),
    occurred_at: new Date(now-1000).toISOString(), observed_at: new Date(now).toISOString(),
    expires_at: new Date(now+3600000).toISOString(), ...overrides,
  };
  const fingerprint = event.force_fingerprint
    ? `${q(event.force_fingerprint)}::text`
    : "encode(pg_catalog.sha256(convert_to(jsonb_build_object('event_id',event_id,'event_version',event_version,'event_type',event_type,'retailer_id',retailer_id,'global_scope',global_scope,'scope_fingerprint',scope_fingerprint,'source_system',source_system,'source_run_id',source_run_id,'parent_id',parent_id,'occurred_at',occurred_at,'observed_at',observed_at,'expires_at',expires_at,'status',status,'reason_code',reason_code,'metadata',metadata)::text,'UTF8')),'hex')";
  return `with p as (select ${q(event.event_id)}::uuid event_id,${event.event_version} event_version,${q(event.event_type)}::text event_type,${event.retailer_id===null?"null":event.retailer_id}::bigint retailer_id,${event.global_scope}::boolean global_scope,${q(event.scope_fingerprint)}::text scope_fingerprint,${q(event.source_system)}::text source_system,${q(event.source_run_id)}::text source_run_id,${q(event.parent_id)}::text parent_id,${q(event.occurred_at)}::timestamptz occurred_at,${q(event.observed_at)}::timestamptz observed_at,${q(event.expires_at)}::timestamptz expires_at,${q(event.status)}::text status,${q(event.reason_code)}::text reason_code,${q(JSON.stringify(event.metadata))}::jsonb metadata,${q(event.idempotency_key)}::text idempotency_key), f as (select *,${fingerprint} payload_fingerprint from p) select public.write_retailer_control_state_evidence_v1(event_id,event_version,event_type,retailer_id,global_scope,scope_fingerprint,source_system,source_run_id,parent_id,occurred_at,observed_at,expires_at,status,reason_code,metadata,payload_fingerprint,idempotency_key)::text from f;`;
}
function readSql(retailer = 14, maxRecords = 10000, maxBytes = 8388608) {
  return `select public.read_retailer_control_state_v1(${retailer},'10 Reps','${"a".repeat(40)}','${"b".repeat(64)}',statement_timestamp()+interval '10 minutes',array[${SOURCE_NAMES.map(q).join(",")}],${maxRecords},${maxBytes})::text`;
}

test("RA-004 migration, roles, ledger, eleven sources and one snapshot pass on isolated local PostgreSQL", async () => {
  for (const [name,value] of Object.entries(process.env)) {
    if (/DATABASE_URL|DIRECT_URL|POSTGRES_URL|PGHOST|SUPABASE_SERVICE_ROLE_KEY/i.test(name) && value && !/localhost|127\.0\.0\.1|::1/i.test(value)) assert.fail(`RA004_LOCAL_GUARD: remote environment ${name}`);
    if (value && /aftboxmrdgyhizicfsfu|hxnrsyyqffztlvcrtgbf/i.test(value)) assert.fail(`RA004_LOCAL_GUARD: cloud project reference in ${name}`);
  }
  const container=`ra004_control_state_test_${crypto.randomBytes(4).toString("hex")}`;
  const database=`ra004_control_state_test_${crypto.randomBytes(4).toString("hex")}`;
  const missing=`ra004_control_state_test_missing_${crypto.randomBytes(3).toString("hex")}`;
  const drift=`ra004_control_state_test_drift_${crypto.randomBytes(3).toString("hex")}`;
  let primary;
  try {
    ok(run("docker",["run","--detach","--rm","--name",container,"--network","none","-e","POSTGRES_HOST_AUTH_METHOD=trust","-v",`${ROOT}:/workspace:ro`,IMAGE]),"start isolated PostgreSQL");
    wait(container);
    ok(docker(container,["createdb","-U","postgres",database]),"create guarded database");
    const local=jsonResult(ok(sql(container,database,"select jsonb_build_object('database',current_database(),'server_addr',inet_server_addr(),'server_port',inet_server_port(),'ssl',current_setting('ssl'))::text"),"local target proof"));
    assert.match(local.database,/^ra004_control_state_test_/); assert.equal(local.server_addr,null); assert.equal(local.server_port,null);
    ok(sql(container,database,ROLE_SQL),"bootstrap standard local roles");
    ok(file(container,database,BASELINE),"repository baseline");
    ok(file(container,database,FIXTURE,[`expected_database=${database}`]),"control-source fixture");
    ok(docker(container,["createdb","-U","postgres","-T",database,drift]),"clone drift database");
    ok(docker(container,["createdb","-U","postgres",missing]),"create missing-source database");
    ok(sql(container,missing,ROLE_SQL),"missing-source roles"); ok(file(container,missing,BASELINE),"missing-source baseline");
    denied(file(container,missing,MIGRATION),"missing mandatory source",/RCSE_SOURCE_UNAVAILABLE/);
    ok(sql(container,drift,"alter table public.retailer_catalogue_parent_plans drop column source_snapshot_fingerprint"),"inject schema drift");
    denied(file(container,drift,MIGRATION),"schema drift",/source_snapshot_fingerprint|does not exist/i);
    ok(file(container,database,MIGRATION),"RA-004 migration");
    denied(file(container,database,MIGRATION),"deterministic migration rerun",/RCSE_SCHEMA_DRIFT/);

    const schema=jsonResult(ok(sql(container,database,`select jsonb_build_object(
      'table',to_regclass('public.retailer_control_state_evidence_v1') is not null,
      'indexes',(select count(*) from pg_indexes where schemaname='public' and tablename='retailer_control_state_evidence_v1'),
      'policies',(select count(*) from pg_policies where schemaname='public' and (tablename='retailer_control_state_evidence_v1' or policyname like 'rcse_read_%')),
      'forced',(select relrowsecurity and relforcerowsecurity from pg_class where oid='public.retailer_control_state_evidence_v1'::regclass),
      'read_signature',to_regprocedure('public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)') is not null,
      'write_signature',to_regprocedure('public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)') is not null,
      'read_volatility',(select provolatile from pg_proc where oid='public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)'::regprocedure),
      'read_security',(select prosecdef from pg_proc where oid='public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)'::regprocedure),
      'read_path',(select proconfig from pg_proc where oid='public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)'::regprocedure),
      'read_owner',(select pg_get_userbyid(proowner) from pg_proc where oid='public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)'::regprocedure),
      'write_owner',(select pg_get_userbyid(proowner) from pg_proc where oid='public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)'::regprocedure)
    )::text`),"schema inventory"));
    assert.deepEqual(schema,{table:true,indexes:6,policies:12,forced:true,read_signature:true,write_signature:true,read_volatility:"s",read_security:true,read_path:["search_path=pg_catalog"],read_owner:"retailer_control_state_read_owner",write_owner:"retailer_control_state_evidence_owner"});

    const roles=jsonResult(ok(sql(container,database,`select jsonb_build_object(
      'attributes',(select jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'inherit',rolinherit,'super',rolsuper,'createdb',rolcreatedb,'createrole',rolcreaterole,'replication',rolreplication,'bypassrls',rolbypassrls) order by rolname) from pg_roles where rolname like 'retailer_control_state_%'),
      'memberships',(select count(*) from pg_auth_members m join pg_roles a on a.oid=m.member join pg_roles b on b.oid=m.roleid where a.rolname like 'retailer_control_state_%' or b.rolname like 'retailer_control_state_%'),
      'exporter_read',has_function_privilege('retailer_control_state_exporter','public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)','EXECUTE'),
      'exporter_write',has_function_privilege('retailer_control_state_exporter','public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)','EXECUTE'),
      'writer_read',has_function_privilege('retailer_control_state_evidence_writer','public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)','EXECUTE'),
      'writer_write',has_function_privilege('retailer_control_state_evidence_writer','public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)','EXECUTE'),
      'public_read',has_function_privilege('public','public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)','EXECUTE'),
      'public_write',has_function_privilege('public','public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)','EXECUTE'),
      'exporter_table',has_table_privilege('retailer_control_state_exporter','public.retailer_control_state_evidence_v1','SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),
      'writer_table',has_table_privilege('retailer_control_state_evidence_writer','public.retailer_control_state_evidence_v1','SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),
      'sequence_grants',(select count(*) from information_schema.usage_privileges where grantee in ('retailer_control_state_exporter','retailer_control_state_evidence_writer') and object_type='SEQUENCE'),
      'exporter_settings',(select to_jsonb(setconfig) from pg_db_role_setting s join pg_roles r on r.oid=s.setrole where r.rolname='retailer_control_state_exporter' and s.setdatabase=0)
    )::text`),"role boundary"));
    assert.equal(roles.attributes.length,4); assert.ok(roles.attributes.every((r)=>Object.values(r).slice(1).every((v)=>v===false))); assert.deepEqual(new Set(roles.exporter_settings),new Set(["default_transaction_read_only=on","statement_timeout=15s","idle_in_transaction_session_timeout=15s"])); assert.deepEqual({...roles,attributes:undefined,exporter_settings:undefined},{attributes:undefined,exporter_settings:undefined,memberships:0,exporter_read:true,exporter_write:false,writer_read:false,writer_write:true,public_read:false,public_write:false,exporter_table:false,writer_table:false,sequence_grants:0});

    for (const attempt of [
      "select * from public.retailer_control_state_evidence_v1",
      "insert into public.retailer_control_state_evidence_v1 default values",
      "update public.retailer_control_state_evidence_v1 set status='CLEAR'",
      "delete from public.retailer_control_state_evidence_v1",
      "truncate public.retailer_control_state_evidence_v1",
      "create table public.ra004_forbidden(id integer)",
      "alter table public.retailer_control_state_evidence_v1 add column forbidden integer",
      "drop table public.retailer_control_state_evidence_v1",
      "grant select on public.retailer_control_state_evidence_v1 to anon",
      "set role retailer_control_state_read_owner",
      "set role retailer_catalogue_production_validator",
    ]) denied(sql(container,database,`set session authorization retailer_control_state_exporter; ${attempt}`),`exporter denied ${attempt}`);
    denied(sql(container,database,"set session authorization retailer_control_state_exporter; select * from public.products"),"unrelated data denied");
    denied(sql(container,database,"set session authorization retailer_control_state_evidence_writer; select * from public.retailer_control_state_evidence_v1"),"writer select denied");
    denied(sql(container,database,"set session authorization retailer_control_state_evidence_writer; select public.read_retailer_control_state_v1(1,'x','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',now()+interval '1 minute',array[]::text[],1,1024)"),"writer read RPC denied");

    const types=["SESSION_STARTED","SESSION_HEARTBEAT","SESSION_COMPLETED","SESSION_FAILED","LOCK_OBSERVED","LOCK_ACQUIRED","LOCK_RENEWED","LOCK_RELEASED","LOCK_EXPIRED","POSTFLIGHT_COMPLETED","POSTFLIGHT_FAILED","WATCHDOG_OBSERVED","GLOBAL_CONFLICT_OBSERVED","SOURCE_OBSERVED","WORKFLOW_OBSERVED"];
    const statusFor=(type)=>type.includes("FAILED")?"FAILED":type.includes("COMPLETED")?"COMPLETED":type.includes("RELEASED")?"RELEASED":type.includes("EXPIRED")?"EXPIRED":type==="GLOBAL_CONFLICT_OBSERVED"?"BLOCKED":type.includes("STARTED")||type.includes("ACQUIRED")||type.includes("RENEWED")?"ACTIVE":"OBSERVED";
    for (const type of types) ok(sql(container,database,`set session authorization retailer_control_state_evidence_writer; ${eventSql({event_type:type,status:statusFor(type),global_scope:type==="GLOBAL_CONFLICT_OBSERVED",retailer_id:type==="GLOBAL_CONFLICT_OBSERVED"?null:14,metadata:type.startsWith("LOCK_")?{owner_session_id:"snapshot-session"}:{}})}`),`insert ${type}`);
    for (const logical_source of ["sessions","locks","postflight_state","watchdog_state","global_conflicts"]) ok(sql(container,database,`set session authorization retailer_control_state_evidence_writer; ${eventSql({metadata:{logical_source},source_run_id:`coverage-${logical_source}`})}`),`coverage ${logical_source}`);
    assert.equal(jsonResult(ok(sql(container,database,"select jsonb_build_object('count',count(*),'types',count(distinct event_type))::text from public.retailer_control_state_evidence_v1"),"event registry count")).types,15);

    const replayId=crypto.randomUUID(), replayKey=crypto.randomBytes(32).toString("hex");
    const replay=eventSql({event_id:replayId,idempotency_key:replayKey,source_run_id:"idempotent-run"});
    assert.equal(jsonResult(ok(sql(container,database,`set session authorization retailer_control_state_evidence_writer; ${replay}`),"first idempotent write")).inserted,true);
    assert.equal(jsonResult(ok(sql(container,database,`set session authorization retailer_control_state_evidence_writer; ${replay}`),"idempotent replay")).idempotent,true);
    denied(sql(container,database,`set session authorization retailer_control_state_evidence_writer; ${eventSql({event_id:crypto.randomUUID(),idempotency_key:replayKey,source_run_id:"changed-payload"})}`),"idempotency conflict",/RCSE_EVIDENCE_IDEMPOTENCY_CONFLICT/);
    denied(sql(container,database,`set session authorization retailer_control_state_evidence_writer; ${eventSql({event_id:replayId,idempotency_key:crypto.randomBytes(32).toString("hex"),source_run_id:"duplicate-event"})}`),"duplicate event id",/duplicate key/i);
    denied(sql(container,database,`set session authorization retailer_control_state_evidence_writer; ${eventSql({event_type:"TEN_REPS_ONLY"})}`),"closed event registry",/check constraint/i);
    denied(sql(container,database,`set session authorization retailer_control_state_evidence_writer; ${eventSql({retailer_id:null,global_scope:false})}`),"missing scope",/check constraint/i);
    denied(sql(container,database,`set session authorization retailer_control_state_evidence_writer; ${eventSql({metadata:{password:"forbidden-value"}})}`),"secret metadata",/check constraint/i);
    denied(sql(container,database,`set session authorization retailer_control_state_evidence_writer; ${eventSql({metadata:{note:"x".repeat(5000)}})}`),"oversized metadata",/check constraint/i);
    denied(sql(container,database,`set session authorization retailer_control_state_evidence_writer; ${eventSql({reason_code:""})}`),"missing reason code",/check constraint/i);
    denied(sql(container,database,`set session authorization retailer_control_state_evidence_writer; ${eventSql({observed_at:"2100-01-01T00:00:00.000Z",expires_at:"2100-01-01T01:00:00.000Z"})}`),"future observation",/check constraint/i);
    denied(sql(container,database,`set session authorization retailer_control_state_evidence_writer; ${eventSql({occurred_at:"2026-09-24T12:00:00.000Z",observed_at:"2026-09-24T12:00:00.000Z",expires_at:"2026-09-24T11:00:00.000Z"})}`),"invalid expiry",/check constraint/i);
    denied(sql(container,database,`set session authorization retailer_control_state_evidence_writer; ${eventSql({force_fingerprint:"0".repeat(64)})}`),"invalid payload fingerprint",/RCSE_EVIDENCE_FINGERPRINT_MISMATCH/);
    const concurrentId=crypto.randomUUID(),concurrentKey=crypto.randomBytes(32).toString("hex"),concurrentEvent=eventSql({event_id:concurrentId,idempotency_key:concurrentKey,source_run_id:"concurrent-idempotency"});
    const concurrent=await Promise.all([asyncSql(container,database,`set session authorization retailer_control_state_evidence_writer; ${concurrentEvent}`),asyncSql(container,database,`set session authorization retailer_control_state_evidence_writer; ${concurrentEvent}`)]);
    assert.equal(concurrent.filter((r)=>r.status===0).length,2); assert.equal(jsonResult(ok(sql(container,database,`select jsonb_build_object('count',count(*))::text from public.retailer_control_state_evidence_v1 where idempotency_key='${concurrentKey}'`),"concurrent idempotency count")).count,1);

    ok(sql(container,database,`insert into public.retailer_catalogue_parent_plans(id,parent_plan_fingerprint,retailer_id,source_snapshot_fingerprint,status,approval_id,approved_at,approval_expires_at,audit_log) values
      ('10000000-0000-4000-8000-000000000001','${"1".repeat(64)}',14,'${"c".repeat(64)}','PLANNED','20000000-0000-4000-8000-000000000001',now()-interval '1 minute',now()+interval '1 hour','[]'),
      ('10000000-0000-4000-8000-000000000002','${"2".repeat(64)}',14,'${"d".repeat(64)}','FAILED',null,null,null,'[]'),
      ('10000000-0000-4000-8000-000000000003','${"3".repeat(64)}',14,'${"e".repeat(64)}','EXPIRED',null,null,null,'[]'),
      ('10000000-0000-4000-8000-000000000004','${"4".repeat(64)}',14,'${"f".repeat(64)}','SUPERSEDED',null,null,null,'[]'),
      ('10000000-0000-4000-8000-000000000005','${"5".repeat(64)}',15,'${"c".repeat(64)}','PLANNED',null,null,null,'[]');
      insert into public.retailer_catalogue_child_plans(id,parent_plan_id,retailer_id,child_plan_fingerprint,dependency_group,batch_index,status,approval_id,approved_at,approval_expires_at,approval_consumed_at,audit_log) values('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',14,'${"6".repeat(64)}','shared',0,'APPROVED','40000000-0000-4000-8000-000000000001',now()-interval '1 minute',now()+interval '1 hour',now(),'[]');
      insert into public.retailer_catalogue_apply_runs(id,parent_plan_id,child_plan_id,retailer_id,run_type,status,expected_state_fingerprint,started_at,completed_at) values('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',14,'APPLY','SUCCEEDED','${"7".repeat(64)}',now()-interval '2 minutes',now()-interval '1 minute');
      insert into public.retailer_offer_sync_batch_approvals(id,child_plan_id,approved_at,expires_at,consumed_at,execution_fingerprint) values('60000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',now()-interval '1 minute',now()+interval '1 hour',null,'${"8".repeat(64)}');
      insert into public.approved_import_plans(id,retailer_id,created_at,expires_at,consumed_at,status,artifact_sha256) values('70000000-0000-4000-8000-000000000001',14,now()-interval '2 hours',now()-interval '1 hour',null,'approved','${"9".repeat(64)}');
      insert into public.retailer_catalogue_production_fixture_approvals(id,parent_plan_id,approved_at,expires_at,consumed_at,package_fingerprint) values('80000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',now()-interval '1 minute',now()+interval '1 hour',null,'${"a".repeat(64)}');
      insert into public.retailer_catalogue_production_recovery_manifests(id,child_plan_id,apply_run_id,execution_fingerprint,rollback_manifest_fingerprint,status) values('90000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','${"b".repeat(64)}','${"c".repeat(64)}','READY');
      insert into public.retailer_catalogue_production_recovery_approvals(id,recovery_manifest_id,approved_at,expires_at,consumed_at,expected_recovery_state_fingerprint) values('a0000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001',now()-interval '1 minute',now()+interval '1 hour',null,'${"d".repeat(64)}');
      insert into public.retailer_offer_sync_reviewed_mixed_change_bindings(approval_id,status,approved_at,consumed_at,reviewed_contract_hash) values('60000000-0000-4000-8000-000000000001','APPROVED',now()-interval '1 minute',null,'${"e".repeat(64)}');`),"synthetic eleven-source state");
    ok(sql(container,database,eventSql({event_type:"SESSION_STARTED",status:"ACTIVE",source_run_id:"snapshot-session"})),"snapshot session start");
    ok(sql(container,database,eventSql({event_type:"LOCK_ACQUIRED",status:"ACTIVE",source_run_id:"snapshot-lock",metadata:{owner_session_id:"snapshot-session"}})),"snapshot lock acquire");

    const read=jsonResult(ok(sql(container,database,`set session authorization retailer_control_state_exporter; ${readSql()}`),"read eleven-source state")); assertOutputShape(read);
    assert.deepEqual(read.sources_queried,SOURCE_NAMES); assert.equal(Object.keys(read.source_records).length,11); assert.equal(read.source_records.plan_items.length,1); assert.equal(read.source_records.apply_ledger.length,1); assert.equal(read.source_records.recovery_state.length,1); assert.ok(read.source_records.sessions.some((row)=>row.status==="OPEN")); assert.ok(read.source_records.sessions.some((row)=>row.status==="CLOSED")); assert.ok(read.source_records.locks.some((row)=>row.status==="ACTIVE")); assert.ok(read.source_records.locks.some((row)=>row.status==="EXPIRED")); assert.ok(read.source_records.approval_contracts.some((row)=>row.status==="APPROVED")); assert.ok(read.source_records.approval_consumption.length>0); assert.ok(read.source_records.postflight_state.length>0); assert.ok(read.source_records.watchdog_state.length>0); assert.ok(read.overlapping_scope_conflicts.some((row)=>row.reason_code==="RCSE_EQUIVALENT_ACTIVE_PLAN")); assert.ok(read.source_records.approval_contracts.some((row)=>row.source==="REVIEWED_MIXED")); assert.ok(read.source_records.control_plans.every((row)=>row.retailer_ids.includes("14"))); assert.equal(read.read_attempt_count,1); assert.equal(read.write_attempt_count,0); assert.equal(read.mutation_attempt_count,0);
    const repeat=jsonResult(ok(sql(container,database,`set session authorization retailer_control_state_exporter; ${readSql()}`),"deterministic repeat")); assert.equal(repeat.canonical_state_fingerprint,read.canonical_state_fingerprint); assert.deepEqual(repeat.source_records,read.source_records);
    denied(sql(container,database,`set session authorization retailer_control_state_exporter; ${readSql(14,1,8388608)}`),"record limit",/RCSE_LIMIT_EXCEEDED/); denied(sql(container,database,`set session authorization retailer_control_state_exporter; ${readSql(14,10000,1024)}`),"byte limit",/RCSE_LIMIT_EXCEEDED/); denied(sql(container,database,`set session authorization retailer_control_state_exporter; ${readSql(99)}`),"missing evidence coverage",/RCSE_SOURCE_UNAVAILABLE/);
    const emptyRetailer=16; for(const logical_source of ["sessions","locks","postflight_state","watchdog_state","global_conflicts"]) ok(sql(container,database,eventSql({retailer_id:emptyRetailer,metadata:{logical_source},source_run_id:`empty-${logical_source}`})),`empty coverage ${logical_source}`); const empty=jsonResult(ok(sql(container,database,readSql(emptyRetailer)),"empty sources")); assert.equal(empty.completeness_status,"COMPLETE"); assert.equal(empty.source_records.control_plans.length,0); assert.equal(empty.last_postflight,null); assert.equal(empty.last_watchdog_result,null); assert.equal(empty.final_assessment,"BLOCKED_UNKNOWN"); assert.ok(empty.overlapping_scope_conflicts.some((row)=>row.scope==="GLOBAL"));

    const beforeFp=read.canonical_state_fingerprint;
    const transaction=asyncSql(container,database,`begin isolation level repeatable read; select 'before|'||(public.read_retailer_control_state_v1(14,'10 Reps','${"a".repeat(40)}','${"b".repeat(64)}',statement_timestamp()+interval '10 minutes',array[${SOURCE_NAMES.map(q).join(",")}],10000,8388608)->>'canonical_state_fingerprint'); select pg_sleep(2); select 'during|'||(public.read_retailer_control_state_v1(14,'10 Reps','${"a".repeat(40)}','${"b".repeat(64)}',statement_timestamp()+interval '10 minutes',array[${SOURCE_NAMES.map(q).join(",")}],10000,8388608)->>'canonical_state_fingerprint'); commit;`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,500);
    ok(sql(container,database,`update public.retailer_catalogue_parent_plans set status='COMPLETED' where id='10000000-0000-4000-8000-000000000001'; update public.retailer_offer_sync_batch_approvals set consumed_at=now() where id='60000000-0000-4000-8000-000000000001'; update public.retailer_offer_sync_reviewed_mixed_change_bindings set status='CONSUMED',consumed_at=now() where approval_id='60000000-0000-4000-8000-000000000001'; ${eventSql({event_type:"SESSION_COMPLETED",status:"COMPLETED",source_run_id:"snapshot-session"})} ${eventSql({event_type:"LOCK_RELEASED",status:"RELEASED",source_run_id:"snapshot-lock",metadata:{owner_session_id:"snapshot-session"}})} ${eventSql({event_type:"WORKFLOW_OBSERVED",status:"OBSERVED",source_run_id:"snapshot-evidence"})}`),"concurrent committed state change");
    const snapshot=await transaction; assert.equal(snapshot.status,0,output(snapshot)); const snapshotLines=snapshot.stdout.split(/\r?\n/).filter((line)=>/^(before|during)\|/.test(line)); assert.equal(snapshotLines.length,2); assert.equal(snapshotLines[0].split("|")[1],beforeFp); assert.equal(snapshotLines[1].split("|")[1],beforeFp);
    const after=jsonResult(ok(sql(container,database,readSql()),"post-commit snapshot")); assert.notEqual(after.canonical_state_fingerprint,beforeFp);

    const hijack=jsonResult(ok(sql(container,database,`set session authorization retailer_control_state_exporter; create function pg_temp.sha256(bytea) returns bytea language sql immutable as 'select decode(repeat(''00'',32),''hex'')'; ${readSql()}`),"pg_temp hijack resistance")); assert.equal(hijack.canonical_state_fingerprint,after.canonical_state_fingerprint);
    denied(sql(container,database,"set session authorization retailer_control_state_exporter; create function public.sha256(bytea) returns bytea language sql immutable as 'select $1'"),"public search-path hijack denied");
    for(const dml of ["update public.retailer_control_state_evidence_v1 set status='CLEAR'","delete from public.retailer_control_state_evidence_v1","truncate public.retailer_control_state_evidence_v1"]) denied(sql(container,database,`set session authorization retailer_control_state_evidence_writer; ${dml}`),`writer append-only ${dml}`);
  } catch (error) { primary=error; throw error; } finally {
    const cleanup=run("docker",["rm","-f",container],30_000); if(!primary) ok(cleanup,"remove isolated PostgreSQL");
  }
});
