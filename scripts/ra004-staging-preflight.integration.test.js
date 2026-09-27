const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { migrationLedgerFingerprint } = require("./lib/retailer-snapshot/staging-execution-contract");
const { sha256 } = require("./lib/stable-json-hash");
const {
  CURRENT_DECISION_FINGERPRINT, authorizationFingerprint, fileSha,
  postgresJsonbText, validateMetadata,
} = require("./lib/retailer-offer-sync/ra004-staging-preflight-v1/contract");
const { createClosedProvider } = require("./lib/retailer-offer-sync/ra004-staging-preflight-v1/provider");
const { runPreflight } = require("./lib/retailer-offer-sync/ra004-staging-preflight-v1/runner");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = "postgres:17-alpine";
const BASELINE = "supabase/migrations/20260712211120_baseline_current_public_schema.sql";
const CONTROL_FIXTURE = "supabase/test/retailer_control_state_interface_fixture.sql";
const CONTROL_MIGRATION = "supabase/migrations/20260924100000_add_transactional_retailer_control_state_interface.sql";
const PREFLIGHT_MIGRATION = "supabase/migrations/20260925100000_add_ra004_staging_preflight_metadata_interface.sql";
const COMPATIBILITY_MIGRATION = "supabase/migrations/20260926110000_add_ra004_staging_interface_compatibility.sql";
const FORWARD_CONTROL_MIGRATION = "supabase/migrations/20260927100000_reissue_transactional_retailer_control_state_interface.sql";
const FORWARD_PREFLIGHT_MIGRATION = "supabase/migrations/20260927101000_reissue_ra004_staging_preflight_metadata_interface.sql";
const CORRECTED_PREFLIGHT_MIGRATION = "supabase/migrations/20260927102000_correct_ra004_staging_preflight_ledger_contract.sql";
const CORRECTED_PREFLIGHT_FILENAME = path.basename(CORRECTED_PREFLIGHT_MIGRATION);
const CORRECTED_PREFLIGHT_SHA = "25f70527d18113a2282ebcdb1626b8052f7774f3f7f6ee1dbe69e1cd17864b93";
const CORRECT_LEDGER_NAME = "reissue_transactional_retailer_control_state_interface";
const OBSOLETE_LEDGER_NAME = "add_transactional_retailer_control_state_interface";
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
function fileAs(container, database, user, filename, variables = []) { return docker(container, ["psql","-X","--no-psqlrc","-v","ON_ERROR_STOP=1",...variables.flatMap((value)=>["-v",value]),"-U",user,"-d",database,"-f",`/workspace/${filename}`]); }
function file(container, database, filename, variables = []) { return fileAs(container,database,"postgres",filename,variables); }
function json(result) { const line=result.stdout.split(/\r?\n/).findLast((row)=>row.trim().startsWith("{")); assert.ok(line,output(result)); return JSON.parse(line); }
function wait(container) { for(let attempt=0,consecutive=0;attempt<100;attempt+=1){const result=docker(container,["psql","-X","--no-psqlrc","-U","postgres","-d","postgres","-tAc","select 1"],5000); consecutive=result.status===0&&result.stdout.trim()==="1"?consecutive+1:0;if(consecutive===3)return;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);}assert.fail("isolated PostgreSQL did not start"); }
function waitAs(container,user) { for(let attempt=0,consecutive=0;attempt<100;attempt+=1){const result=docker(container,["psql","-X","--no-psqlrc","-U",user,"-d",user,"-tAc","select 1"],5000); consecutive=result.status===0&&result.stdout.trim()==="1"?consecutive+1:0;if(consecutive===3)return;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);}assert.fail("isolated PostgreSQL did not start"); }
function quote(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function ledgerSql() { return `create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text not null,statements text[] not null default array[]::text[]); insert into supabase_migrations.schema_migrations(version,name) values ${MIGRATIONS.map((item)=>{const split=item.indexOf("_");return `(${quote(item.slice(0,split))},${quote(item.slice(split+1))})`;}).join(",")};`; }
function call(environment="STAGING", count=3, fingerprint=LEDGER_FINGERPRINT, maxBytes=131072) { return `select public.read_ra004_staging_preflight_v1(${quote(environment)},'10 Reps','10-reps',${count},${quote(fingerprint)},'ra004_preflight_test_login',${maxBytes})::text`; }
function asLogin(statement) { return `set session authorization ra004_preflight_test_login; ${statement}`; }
function validateLegacyMetadata(value, expectedSessionUser) {
  assert.equal(value.q3_migration_ledger.target_version, "20260924100000");
  assert.equal(value.q3_migration_ledger.target_name, "add_transactional_retailer_control_state_interface");
  assert.equal(
    sha256(postgresJsonbText({ ...value, metadata_fingerprint: "0".repeat(64) })),
    value.metadata_fingerprint,
  );
  const compatible = structuredClone(value);
  compatible.q3_migration_ledger.target_version = "20260927100000";
  compatible.q3_migration_ledger.target_name = "reissue_transactional_retailer_control_state_interface";
  compatible.metadata_fingerprint = "0".repeat(64);
  compatible.metadata_fingerprint = sha256(postgresJsonbText(compatible));
  return validateMetadata(compatible, expectedSessionUser);
}

function assertLedgerContractSources(sqlText) {
  const selectorText = fs.readFileSync(path.join(ROOT, "scripts/supabase-migration-selector.js"), "utf8");
  const contractText = fs.readFileSync(path.join(ROOT, "scripts/lib/retailer-offer-sync/ra004-staging-preflight-v1/contract.js"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/retailer-automation/evidence/RA-004-forward-reissued-interface-migrations.json"), "utf8"));
  const current = manifest.forward_migrations.find(({ filename }) => filename === CORRECTED_PREFLIGHT_FILENAME);
  assert.ok(current);
  assert.equal(current.sha256, CORRECTED_PREFLIGHT_SHA);
  assert.equal(current.status, "CURRENT");
  assert.equal(fileSha(CORRECTED_PREFLIGHT_MIGRATION), CORRECTED_PREFLIGHT_SHA);
  assert.ok(selectorText.includes(`\"${CORRECTED_PREFLIGHT_FILENAME}\":`));
  assert.ok(selectorText.includes(CORRECTED_PREFLIGHT_SHA));
  assert.ok(contractText.includes(`const PREFLIGHT_MIGRATION = \"${CORRECTED_PREFLIGHT_MIGRATION}\"`));
  assert.ok(contractText.includes(`value.q3_migration_ledger.target_name !== \"${CORRECT_LEDGER_NAME}\"`));
  assert.ok(sqlText.includes(`v_target_name is distinct from '${CORRECT_LEDGER_NAME}'`));
  assert.ok(!sqlText.includes(`v_target_name is distinct from '${OBSOLETE_LEDGER_NAME}'`));
}

test("corrected Q3 ledger name is identical across SQL, selector, manifest and runtime contract", () => {
  const sqlText = fs.readFileSync(path.join(ROOT, CORRECTED_PREFLIGHT_MIGRATION), "utf8");
  assertLedgerContractSources(sqlText);
  const mutated = sqlText.replaceAll(CORRECT_LEDGER_NAME, OBSOLETE_LEDGER_NAME);
  assert.throws(() => assertLedgerContractSources(mutated));
});

async function runExactLocalQ1ToQ8(metadata, ledgerCount, ledgerFingerprint) {
  const now = "2026-09-27T12:00:00.000Z";
  const role = "ra004_preflight_test_login";
  const baseline = "12cd071bfdef935ae8c4e879362ba4b965629edb";
  const planFingerprint = "bd5c259941997daad3755c1cb135f76f6eccaef1fb9e1ce0044939ce08439214";
  const projectIdentity = {
    schema_version: "ra-004-project-identity-v1", project_reference: "ra004-local-synthetic",
    canonical_host: "ra004-local.invalid", environment_label: "STAGING",
    project_identity_fingerprint: "0".repeat(64), observed_at: now,
  };
  projectIdentity.project_identity_fingerprint = sha256(projectIdentity);
  const evidenceStore = {
    schema_version: "ra-004-evidence-store-metadata-v1", store_identifier: "ra004-local-write-once-fixture",
    private: true, encryption: "AT_REST_AND_IN_TRANSIT", write_once: true, access_audit: true,
    readback_supported: true, raw_retention_days: 90, derived_retention_days: 90,
    approved_by: "fixture-custodian", approved_at: "2026-09-27T11:00:00.000Z",
    evidence_store_fingerprint: "0".repeat(64),
  };
  evidenceStore.evidence_store_fingerprint = sha256(evidenceStore);
  const authorization = {
    schema_version: "ra-004-staging-preflight-authorization-execution-v1", status: "TEST_ONLY_AUTHORIZED",
    task_id: "RA-004", baseline_sha: baseline, decision_fingerprint: CURRENT_DECISION_FINGERPRINT,
    plan_fingerprint: planFingerprint,
    control_migration: { path: FORWARD_CONTROL_MIGRATION, sha256: fileSha(FORWARD_CONTROL_MIGRATION) },
    preflight_migration: { path: CORRECTED_PREFLIGHT_MIGRATION, sha256: CORRECTED_PREFLIGHT_SHA },
    target: {
      environment: "STAGING", project_reference: "ra004-local-synthetic", canonical_host: "ra004-local.invalid",
      host_allowlist: ["ra004-local.invalid"], retailer: { name: "10 Reps", slug: "10-reps" },
      ledger: { count: ledgerCount, fingerprint: ledgerFingerprint },
    },
    operator: "fixture-operator", credential_issuer: "fixture-issuer",
    window: { starts_at: "2026-09-27T11:50:00.000Z", expires_at: "2026-09-27T12:20:00.000Z" },
    credential_design: {
      role_name: role, environment: "STAGING_ONLY", rpc_name: "public.read_ra004_staging_preflight_v1",
      maximum_attempts: 1, maximum_ttl_minutes: 30, automatic_retry: false, service_role: false,
      table_privileges: false, sequence_privileges: false, dml: false, ddl: false, mutation_rpc: false,
    },
    evidence_store: {
      store_identifier: evidenceStore.store_identifier, required_private: true, required_encryption: true,
      required_write_once: true, required_access_audit: true, required_readback: true,
      raw_retention_days: 90, derived_retention_days: 90,
    },
    authorization_fingerprint: "0".repeat(64),
  };
  authorization.authorization_fingerprint = authorizationFingerprint(authorization);
  const transport = {
    async readProjectIdentity() { return structuredClone(projectIdentity); },
    async readEvidenceStoreMetadata() { return structuredClone(evidenceStore); },
    async callMetadataRpc(request) {
      return { function_name: request.function_name, session_user: role, transaction_read_only: true, data: structuredClone(metadata) };
    },
    async revoke() { return { access_revoked: true }; },
    async close() { return { connection_closed: true }; },
  };
  const providerBundle = createClosedProvider({
    configuration: {
      environment: "STAGING", project_reference: "ra004-local-synthetic", canonical_host: "ra004-local.invalid",
      host_allowlist: ["ra004-local.invalid"], expected_session_user: role,
    },
    transport,
  });
  const directory = fs.mkdtempSync(path.join(ROOT, "tmp", "ra004-corrected-preflight-"));
  try {
    const result = await runPreflight({
      authorization,
      expected: {
        provider_mode: "fixture", baseline_sha: baseline, decision_fingerprint: CURRENT_DECISION_FINGERPRINT,
        plan_fingerprint: planFingerprint,
        control_migration: authorization.control_migration, preflight_migration: authorization.preflight_migration,
        project_reference: "ra004-local-synthetic", canonical_host: "ra004-local.invalid",
        host_allowlist: ["ra004-local.invalid"],
      },
      providerBundle,
      outputPath: path.join(directory, "q1-q8-report.json"),
      now,
    });
    assert.equal(result.report.status, "METADATA_CAPTURED_PENDING_REVOKE");
    assert.equal(result.report.metadata.q3_migration_ledger.target_name, CORRECT_LEDGER_NAME);
    assert.equal(result.report.metadata.q3_migration_ledger.ordered_ledger_count, ledgerCount);
    assert.equal(result.receipt.status, "REVOKED_AND_CLOSED");
    return result;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

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
      'owner_safe',(select not (rolsuper or rolinherit or rolcreaterole or rolcreatedb or rolcanlogin or rolreplication or rolbypassrls) from pg_roles where rolname='ra004_staging_preflight_owner'),
      'caller_safe',(select not (rolsuper or rolinherit or rolcreaterole or rolcreatedb or rolcanlogin or rolreplication or rolbypassrls) from pg_roles where rolname='ra004_staging_preflight_caller'),
      'public_execute',has_function_privilege('public',oid,'EXECUTE'),
      'caller_execute',has_function_privilege('ra004_staging_preflight_caller',oid,'EXECUTE'),
      'login_execute',has_function_privilege('ra004_preflight_test_login',oid,'EXECUTE')
    )::text from pg_proc where oid='public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)'::regprocedure`),"function and role properties"));
    assert.deepEqual(properties,{signature:true,owner:"ra004_staging_preflight_owner",security_definer:true,volatility:"s",path:["search_path=pg_catalog"],owner_login:false,caller_login:false,caller_inherit:false,owner_safe:true,caller_safe:true,public_execute:false,caller_execute:true,login_execute:true});
    const broad=json(ok(sql(container,database,`select jsonb_build_object(
      'attributes',(select jsonb_build_object('super',rolsuper,'inherit',rolinherit,'createdb',rolcreatedb,'createrole',rolcreaterole,'replication',rolreplication,'bypassrls',rolbypassrls) from pg_roles where rolname='ra004_preflight_test_login'),
      'tables',(select count(*) from information_schema.table_privileges where grantee='ra004_preflight_test_login'),
      'sequences',(select count(*) from information_schema.usage_privileges where grantee='ra004_preflight_test_login' and object_type='SEQUENCE'),
      'memberships',(select count(*) from pg_auth_members m join pg_roles r on r.oid=m.member where r.rolname='ra004_preflight_test_login'),
      'forbidden_rpc_count',(select count(*) from information_schema.routine_privileges where grantee='ra004_preflight_test_login' and routine_name<>'read_ra004_staging_preflight_v1')
    )::text`),"effective login boundary"));
    assert.deepEqual(broad,{attributes:{super:false,inherit:false,createdb:false,createrole:false,replication:false,bypassrls:false},tables:0,sequences:0,memberships:0,forbidden_rpc_count:0});
    const ownerBoundary=json(ok(sql(container,database,`select jsonb_build_object(
      'table_grants',(select count(*) from information_schema.table_privileges where grantee='ra004_staging_preflight_owner'),
      'column_grants',(select count(*) from information_schema.column_privileges where grantee='ra004_staging_preflight_owner' and privilege_type='SELECT'),
      'sequence_grants',(select count(*) from information_schema.usage_privileges where grantee='ra004_staging_preflight_owner' and object_type='SEQUENCE'),
      'memberships',(select count(*) from pg_auth_members m join pg_roles member on member.oid=m.member join pg_roles granted on granted.oid=m.roleid where member.rolname in ('ra004_staging_preflight_owner','ra004_staging_preflight_caller') or granted.rolname in ('ra004_staging_preflight_owner','ra004_staging_preflight_caller'))
    )::text`),"minimal owner and caller boundary"));
    assert.deepEqual(ownerBoundary,{table_grants:0,column_grants:5,sequence_grants:0,memberships:0});

    for(const statement of [
      "select * from public.retailers", "select * from public.products", "select nextval('public.products_id_seq')",
      "insert into public.retailers(id,name,slug) values (99,'x','x')", "update public.retailers set name='x' where id=14",
      "delete from public.retailers where id=14", "truncate public.retailers", "create table public.ra004_forbidden(id integer)",
      "alter table public.retailers add column forbidden integer", "drop table public.retailers",
      "set role ra004_staging_preflight_caller", "set role retailer_catalogue_production_validator",
      "select public.write_retailer_control_state_evidence_v1(null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null)",
    ]) denied(sql(container,database,asLogin(statement)),`ephemeral login denied ${statement}`);

    const result=json(ok(sql(container,database,asLogin(call())),"one exact metadata RPC")); validateLegacyMetadata(result,"ra004_preflight_test_login");
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
    denied(sql(container,database,`begin; create function public.read_ra004_staging_preflight_v1(text) returns jsonb language sql stable as $$select jsonb_build_object()$$; set session authorization ra004_preflight_test_login; ${call()}`),"ambiguous function overload",/SCHEMA_DRIFT/);
    denied(sql(container,database,`begin; alter role ra004_preflight_test_login inherit; set session authorization ra004_preflight_test_login; ${call()}`),"unsafe role attribute",/ROLE_UNSAFE/);
    denied(sql(container,database,`begin; grant retailer_catalogue_production_validator to ra004_preflight_test_login; set session authorization ra004_preflight_test_login; ${call()}`),"unsafe membership",/ROLE_UNSAFE/);
    denied(sql(container,database,`begin; grant select on public.retailers to ra004_preflight_test_login; set session authorization ra004_preflight_test_login; ${call()}`),"unsafe table grant",/ACL_UNSAFE/);
    denied(sql(container,database,`begin; grant select on public.products to ra004_staging_preflight_owner; set session authorization ra004_preflight_test_login; ${call()}`),"unsafe owner table grant",/ACL_UNSAFE/);
    denied(sql(container,database,`begin; grant select on public.products to ra004_staging_preflight_caller; set session authorization ra004_preflight_test_login; ${call()}`),"unsafe caller table grant",/ACL_UNSAFE/);
    denied(sql(container,database,`begin; grant execute on function public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer) to authenticated; set session authorization ra004_preflight_test_login; ${call()}`),"unsafe function grant",/ACL_UNSAFE/);
    denied(sql(container,database,`begin; alter table public.retailer_control_state_evidence_v1 disable row level security; set session authorization ra004_preflight_test_login; ${call()}`),"missing RLS",/ACL_UNSAFE/);
    denied(sql(container,database,`begin; drop policy retailer_control_state_evidence_owner_select_v1 on public.retailer_control_state_evidence_v1; set session authorization ra004_preflight_test_login; ${call()}`),"policy drift",/ACL_UNSAFE/);
    denied(sql(container,database,`begin; alter policy retailer_control_state_evidence_owner_select_v1 on public.retailer_control_state_evidence_v1 using (false); set session authorization ra004_preflight_test_login; ${call()}`),"policy expression drift",/ACL_UNSAFE/);
    denied(sql(container,database,`begin; alter policy ra004_staging_preflight_retailer_read_v1 on public.retailers using (true); set session authorization ra004_preflight_test_login; ${call()}`),"retailer policy expression drift",/ACL_UNSAFE/);

    ok(sql(container,database,"revoke execute on function public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer) from ra004_preflight_test_login"),"revoke exact RPC");
    denied(sql(container,database,asLogin(call())),"revocation removes effective access");
  } catch (error) { primary=error; throw error; }
  finally { const cleanup=run("docker",["rm","-f",container],30_000); if(!primary) ok(cleanup,"remove isolated PostgreSQL"); }
});

test("RA-004 compatibility accepts only PostgreSQL 17 automatic memberships for verified Supabase migration user", () => {
  const container=`ra-004-pg17-membership-${crypto.randomBytes(5).toString("hex")}`;
  const database=`ra004_control_state_test_pg17_membership_${crypto.randomBytes(4).toString("hex")}`;
  let primary;
  try {
    ok(run("docker",["run","--detach","--rm","--name",container,"--network","none","-e","POSTGRES_HOST_AUTH_METHOD=trust","-e","POSTGRES_USER=supabase_admin","-v",`${ROOT}:/workspace:ro`,IMAGE]),"start managed-shape PostgreSQL 17");
    waitAs(container,"supabase_admin");
    ok(sql(container,"supabase_admin","create role postgres login noinherit nosuperuser createdb createrole noreplication nobypassrls","supabase_admin"),"create verified non-superuser migration role");
    ok(docker(container,["createdb","-U","supabase_admin","-O","postgres",database]),"create migration-owned database");
    ok(sql(container,database,ROLE_SQL,"postgres"),"bootstrap local roles as migration user");
    ok(fileAs(container,database,"supabase_admin",BASELINE),"apply repository baseline as isolated bootstrap superuser");
    ok(fileAs(container,database,"supabase_admin",CONTROL_FIXTURE,[`expected_database=${database}`]),"apply control fixture as isolated bootstrap superuser");
    ok(sql(container,database,"alter table public.retailer_catalogue_child_plans owner to postgres; alter table public.retailer_catalogue_apply_runs owner to postgres","supabase_admin"),"match Supabase ownership of compatibility dependencies");
    ok(sql(container,database,"drop table public.retailer_catalogue_production_recovery_approvals, public.retailer_catalogue_production_recovery_manifests, public.retailer_catalogue_production_fixture_approvals","postgres"),"remove compatibility tables");
    ok(sql(container,database,"drop role retailer_catalogue_production_validator, retailer_catalogue_production_executor, retailer_catalogue_production_approver","supabase_admin"),"remove compatibility roles");
    denied(fileAs(container,database,"supabase_admin",COMPATIBILITY_MIGRATION),"reject guessed migration identity",/MIGRATION_USER_MISMATCH/);
    ok(fileAs(container,database,"postgres",COMPATIBILITY_MIGRATION),"apply compatibility as verified migration user");
    const contract=json(ok(sql(container,database,`select jsonb_build_object(
      'server_version',current_setting('server_version'),
      'migration_user',(select jsonb_build_object('name',rolname,'super',rolsuper,'createrole',rolcreaterole) from pg_roles where rolname='postgres'),
      'role_attributes',(select count(*) from pg_roles where rolname in ('retailer_catalogue_production_approver','retailer_catalogue_production_executor','retailer_catalogue_production_validator') and not rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole and not rolreplication),
      'memberships',(select count(*) from pg_auth_members m join pg_roles member on member.oid=m.member join pg_roles granted on granted.oid=m.roleid where member.rolname='postgres' and granted.rolname in ('retailer_catalogue_production_approver','retailer_catalogue_production_executor','retailer_catalogue_production_validator')),
      'exact_memberships',(select count(*) from pg_auth_members m join pg_roles member on member.oid=m.member join pg_roles granted on granted.oid=m.roleid join pg_roles grantor on grantor.oid=m.grantor where member.rolname='postgres' and granted.rolname in ('retailer_catalogue_production_approver','retailer_catalogue_production_executor','retailer_catalogue_production_validator') and m.admin_option and not coalesce((to_jsonb(m)->>'set_option')::boolean,true) and not coalesce((to_jsonb(m)->>'inherit_option')::boolean,true) and grantor.rolname='supabase_admin' and grantor.rolsuper),
      'other_memberships',(select count(*) from pg_auth_members m join pg_roles member on member.oid=m.member join pg_roles granted on granted.oid=m.roleid where (member.rolname in ('retailer_catalogue_production_approver','retailer_catalogue_production_executor','retailer_catalogue_production_validator') or granted.rolname in ('retailer_catalogue_production_approver','retailer_catalogue_production_executor','retailer_catalogue_production_validator')) and not (member.rolname='postgres' and granted.rolname in ('retailer_catalogue_production_approver','retailer_catalogue_production_executor','retailer_catalogue_production_validator'))),
      'direct_object_grants',(select count(*) from pg_class object cross join lateral aclexplode(coalesce(object.relacl,acldefault(case when object.relkind='S' then 's'::\"char\" else 'r'::\"char\" end,object.relowner))) privilege join pg_roles grantee on grantee.oid=privilege.grantee where grantee.rolname in ('retailer_catalogue_production_approver','retailer_catalogue_production_executor','retailer_catalogue_production_validator')),
      'direct_function_grants',(select count(*) from pg_proc function cross join lateral aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege join pg_roles grantee on grantee.oid=privilege.grantee where grantee.rolname in ('retailer_catalogue_production_approver','retailer_catalogue_production_executor','retailer_catalogue_production_validator'))
    )::text`),"read exact PostgreSQL 17 role contract"));
    assert.match(contract.server_version,/^17\./);
    assert.deepEqual(contract.migration_user,{name:"postgres",super:false,createrole:true});
    assert.deepEqual({...contract,server_version:undefined,migration_user:undefined},{server_version:undefined,migration_user:undefined,role_attributes:3,memberships:3,exact_memberships:3,other_memberships:0,direct_object_grants:0,direct_function_grants:0});
  } catch(error) { primary=error; throw error; }
  finally { const cleanup=run("docker",["rm","-f",container],30_000); if(!primary) ok(cleanup,"remove managed-shape PostgreSQL"); }
});

test("RA-004 compatibility, control and corrected preflight pass Q1-Q8 after ledger 95 and reject drift", async () => {
  const container=`ra-004-forward-${crypto.randomBytes(5).toString("hex")}`;
  const base=`ra004_control_state_test_forward_base_${crypto.randomBytes(3).toString("hex")}`;
  const fresh=`ra004_control_state_test_forward_fresh_${crypto.randomBytes(3).toString("hex")}`;
  const compatible=`ra004_control_state_test_compatible_${crypto.randomBytes(3).toString("hex")}`;
  let primary;
  const clone=(source,target)=>ok(docker(container,["createdb","-U","postgres","-T",source,target]),`clone ${target}`);
  const apply=(database,migration,label)=>ok(file(container,database,migration),label);
  try {
    ok(run("docker",["run","--detach","--rm","--name",container,"--network","none","-e","POSTGRES_HOST_AUTH_METHOD=trust","-v",`${ROOT}:/workspace:ro`,IMAGE]),"start forward-only PostgreSQL");
    wait(container);
    ok(docker(container,["createdb","-U","postgres",base]),"create forward base");
    ok(sql(container,base,ROLE_SQL),"bootstrap standard roles");
    ok(file(container,base,BASELINE),"apply repository baseline");
    ok(file(container,base,CONTROL_FIXTURE,[`expected_database=${base}`]),"apply control fixture");
    ok(sql(container,base,"drop table public.retailer_catalogue_production_recovery_approvals, public.retailer_catalogue_production_recovery_manifests, public.retailer_catalogue_production_fixture_approvals; drop role retailer_catalogue_production_validator, retailer_catalogue_production_executor, retailer_catalogue_production_approver; create role retailer_catalogue_production_approver nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls; create role retailer_catalogue_production_executor nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls; create role retailer_catalogue_production_validator nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls; grant retailer_catalogue_production_approver, retailer_catalogue_production_executor, retailer_catalogue_production_validator to postgres with admin true, inherit false, set false;"),"reproduce staging compatibility gaps with exact PostgreSQL 17 role edges");
    const ledgerRows=[
      ...Array.from({length:94},(_,index)=>[`20250101${String(index).padStart(6,"0")}`,`synthetic_history_${index}`]),
      ["20260926100000","create_ra004_staging_10reps_retailer"],
    ];
    ok(sql(container,base,`create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text not null,statements text[] not null default array[]::text[]); insert into supabase_migrations.schema_migrations(version,name) values ${ledgerRows.map(([version,name])=>`(${quote(version)},${quote(name)})`).join(",")}; insert into public.retailers(id,name,slug) overriding system value values (11,'10 Reps','10-reps');`),"create exact 95-row staging simulation");
    clone(base,fresh);

    const before=json(ok(sql(container,fresh,`select jsonb_build_object('products',(select count(*) from public.products),'variants',(select count(*) from public.product_variants),'retailer_products',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),'price_history',(select count(*) from public.price_history))::text`),"business counts before"));
    apply(fresh,COMPATIBILITY_MIGRATION,"install staging compatibility closure");
    ok(sql(container,fresh,"insert into supabase_migrations.schema_migrations(version,name) values ('20260926110000','add_ra004_staging_interface_compatibility')"),"record compatibility migration");
    clone(fresh,compatible);
    apply(fresh,FORWARD_CONTROL_MIGRATION,"install forward control interface");
    ok(sql(container,fresh,"insert into supabase_migrations.schema_migrations(version,name) values ('20260927100000','reissue_transactional_retailer_control_state_interface')"),"record forward control migration");
    apply(fresh,CORRECTED_PREFLIGHT_MIGRATION,"install corrected forward preflight interface");
    ok(sql(container,fresh,"insert into supabase_migrations.schema_migrations(version,name) values ('20260927102000','correct_ra004_staging_preflight_ledger_contract')"),"record corrected preflight migration");
    const after=json(ok(sql(container,fresh,`select jsonb_build_object('products',(select count(*) from public.products),'variants',(select count(*) from public.product_variants),'retailer_products',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),'price_history',(select count(*) from public.price_history))::text`),"business counts after"));
    assert.deepEqual(after,before);
    const inventory=json(ok(sql(container,fresh,`select jsonb_build_object('ledger_count',(select count(*) from supabase_migrations.schema_migrations),'ledger_head',(select max(version) from supabase_migrations.schema_migrations),'control_rpc',to_regprocedure('public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)') is not null,'preflight_rpc',to_regprocedure('public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)') is not null,'control_owner',(select pg_get_userbyid(proowner) from pg_proc where oid='public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)'::regprocedure),'preflight_owner',(select pg_get_userbyid(proowner) from pg_proc where oid='public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)'::regprocedure),'rls',(select relrowsecurity and relforcerowsecurity from pg_class where oid='public.retailer_control_state_evidence_v1'::regclass))::text`),"forward inventory"));
    assert.deepEqual(inventory,{ledger_count:98,ledger_head:"20260927102000",control_rpc:true,preflight_rpc:true,control_owner:"retailer_control_state_read_owner",preflight_owner:"ra004_staging_preflight_owner",rls:true});
    const compatibility=json(ok(sql(container,fresh,`select jsonb_build_object(
      'tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('retailer_catalogue_production_fixture_approvals','retailer_catalogue_production_recovery_manifests','retailer_catalogue_production_recovery_approvals')),
      'roles',(select count(*) from pg_roles where rolname in ('retailer_catalogue_production_approver','retailer_catalogue_production_executor','retailer_catalogue_production_validator')),
      'rows',(select (select count(*) from public.retailer_catalogue_production_fixture_approvals)+(select count(*) from public.retailer_catalogue_production_recovery_manifests)+(select count(*) from public.retailer_catalogue_production_recovery_approvals)),
      'policies',(select count(*) from pg_policies where schemaname='public' and tablename like 'retailer_catalogue_production_%'),
      'memberships',(select count(*) from pg_auth_members m join pg_roles r on r.oid=m.member join pg_roles g on g.oid=m.roleid where r.rolname like 'retailer_catalogue_production_%' or g.rolname like 'retailer_catalogue_production_%'),
      'exact_memberships',(select count(*) from pg_auth_members m join pg_roles r on r.oid=m.member join pg_roles g on g.oid=m.roleid join pg_roles grantor on grantor.oid=m.grantor where r.rolname='postgres' and g.rolname in ('retailer_catalogue_production_approver','retailer_catalogue_production_executor','retailer_catalogue_production_validator') and m.admin_option and not coalesce((to_jsonb(m)->>'set_option')::boolean,true) and not coalesce((to_jsonb(m)->>'inherit_option')::boolean,true) and grantor.rolsuper),
      'broad_grants',(select count(*) from information_schema.role_table_grants where table_schema='public' and table_name in ('retailer_catalogue_production_fixture_approvals','retailer_catalogue_production_recovery_manifests','retailer_catalogue_production_recovery_approvals') and grantee<>'postgres')
    )::text`),"compatibility boundary"));
    assert.deepEqual(compatibility,{tables:3,roles:3,rows:0,policies:3,memberships:3,exact_memberships:3,broad_grants:3});
    const exactLedgerIdentifiers = [
      ...ledgerRows.map(([version,name])=>`${version}_${name}`),
      "20260926110000_add_ra004_staging_interface_compatibility",
      "20260927100000_reissue_transactional_retailer_control_state_interface",
      "20260927102000_correct_ra004_staging_preflight_ledger_contract",
    ];
    const exactLedgerFingerprint = migrationLedgerFingerprint(exactLedgerIdentifiers,"STAGING");
    ok(sql(container,fresh,"create role ra004_preflight_test_login login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls; grant execute on function public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer) to ra004_preflight_test_login"),"create bounded local preflight login");
    const metadata=json(ok(sql(container,fresh,asLogin(call("STAGING",98,exactLedgerFingerprint))),"corrected Q2-Q7 metadata RPC"));
    validateMetadata(metadata,"ra004_preflight_test_login");
    const fullPreflight=await runExactLocalQ1ToQ8(metadata,98,exactLedgerFingerprint);
    assert.equal(fullPreflight.report.project_identity.environment_label,"STAGING");
    assert.equal(fullPreflight.report.evidence_store.private,true);
    ok(sql(container,fresh,"revoke execute on function public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer) from ra004_preflight_test_login; drop role ra004_preflight_test_login"),"remove bounded local preflight login");

    apply(fresh,FORWARD_CONTROL_MIGRATION,"safe control replay recognition");
    apply(fresh,CORRECTED_PREFLIGHT_MIGRATION,"safe corrected preflight replay recognition");

    for(const [kind,mutation,pattern] of [
      ["table","alter table public.retailer_catalogue_production_fixture_approvals add column forbidden text",/COLUMN_DRIFT/],
      ["grant","grant select on public.retailer_catalogue_production_recovery_manifests to authenticated",/TABLE_SECURITY_DRIFT/],
      ["policy","create policy forbidden on public.retailer_catalogue_production_recovery_approvals using (true)",/TABLE_SECURITY_DRIFT/],
      ["constraint","do $$ declare n text; begin select conname into n from pg_constraint where conrelid='public.retailer_catalogue_production_fixture_approvals'::regclass and contype='c' order by conname limit 1; execute format('alter table public.retailer_catalogue_production_fixture_approvals drop constraint %I',n); end $$",/CONSTRAINT_DRIFT/],
      ["role","alter role retailer_catalogue_production_validator inherit",/ROLE_DRIFT/],
      ["membership-set","grant retailer_catalogue_production_validator to postgres with admin true, inherit false, set true",/ROLE_DRIFT/],
      ["membership-admin","grant retailer_catalogue_production_validator to postgres with admin false, inherit false, set false",/ROLE_DRIFT/],
      ["extra-membership","grant retailer_catalogue_production_validator to authenticated with admin false, inherit false, set false",/ROLE_DRIFT/],
      ["direct-table-grant","grant select on public.retailer_catalogue_production_fixture_approvals to retailer_catalogue_production_validator",/ROLE_DRIFT/],
      ["direct-function-grant","grant execute on function gen_random_uuid() to retailer_catalogue_production_validator",/ROLE_DRIFT/],
    ]) {
      const drift=`ra004_control_state_test_compat_drift_${kind}_${crypto.randomBytes(2).toString("hex")}`;
      clone(compatible,drift);
      ok(sql(container,drift,mutation),`inject compatibility ${kind} drift`);
      denied(file(container,drift,COMPATIBILITY_MIGRATION),`reject compatibility ${kind} drift`,pattern);
    }

    for(const [kind,mutation,migration,pattern] of [
      ["function","alter function public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer) volatile",FORWARD_CONTROL_MIGRATION,/FUNCTION_DRIFT/],
      ["grant","grant execute on function public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer) to authenticated",FORWARD_CONTROL_MIGRATION,/ACL_DRIFT/],
      ["policy","alter policy retailer_control_state_evidence_owner_select_v1 on public.retailer_control_state_evidence_v1 using (false)",FORWARD_CONTROL_MIGRATION,/POLICY_DRIFT/],
      ["preflight policy","alter policy ra004_staging_preflight_retailer_read_v1 on public.retailers using (true)",CORRECTED_PREFLIGHT_MIGRATION,/POLICY_DRIFT/],
      ["role","alter role retailer_control_state_exporter inherit",FORWARD_CONTROL_MIGRATION,/ROLE_DRIFT/],
    ]) {
      const drift=`ra004_control_state_test_forward_drift_${kind.replaceAll(" ","_")}_${crypto.randomBytes(2).toString("hex")}`;
      clone(fresh,drift);
      ok(sql(container,drift,mutation),`inject ${kind} drift`);
      denied(file(container,drift,migration),`reject ${kind} drift`,pattern);
    }
    denied(sql(container,fresh,"insert into supabase_migrations.schema_migrations(version,name) values ('20260926110000','add_ra004_staging_interface_compatibility')"),"ledger blocks compatibility replay",/duplicate key/);
  } catch(error) { primary=error; throw error; }
  finally { const cleanup=run("docker",["rm","-f",container],30_000); if(!primary) ok(cleanup,"remove forward-only PostgreSQL"); }
});

test("corrected migration replaces the exact defective RPC in a full local history", () => {
  const container=`ra-004-corrected-history-${crypto.randomBytes(5).toString("hex")}`;
  const database=`ra004_control_state_test_corrected_history_${crypto.randomBytes(4).toString("hex")}`;
  let primary;
  try {
    ok(run("docker",["run","--detach","--rm","--name",container,"--network","none","-e","POSTGRES_HOST_AUTH_METHOD=trust","-v",`${ROOT}:/workspace:ro`,IMAGE]),"start full-history PostgreSQL");
    wait(container);
    ok(docker(container,["createdb","-U","postgres",database]),"create full-history database");
    ok(sql(container,database,ROLE_SQL),"bootstrap full-history roles");
    ok(file(container,database,BASELINE),"apply full-history baseline");
    ok(file(container,database,CONTROL_FIXTURE,[`expected_database=${database}`]),"apply full-history control fixture");
    ok(sql(container,database,"drop table public.retailer_catalogue_production_recovery_approvals, public.retailer_catalogue_production_recovery_manifests, public.retailer_catalogue_production_fixture_approvals; drop role retailer_catalogue_production_validator, retailer_catalogue_production_executor, retailer_catalogue_production_approver; create role retailer_catalogue_production_approver nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls; create role retailer_catalogue_production_executor nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls; create role retailer_catalogue_production_validator nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls; grant retailer_catalogue_production_approver, retailer_catalogue_production_executor, retailer_catalogue_production_validator to postgres with admin true, inherit false, set false;"),"reproduce full-history compatibility gaps with exact PostgreSQL 17 role edges");
    const ledgerRows=[
      ...Array.from({length:94},(_,index)=>[`20250101${String(index).padStart(6,"0")}`,`synthetic_history_${index}`]),
      ["20260926100000","create_ra004_staging_10reps_retailer"],
    ];
    ok(sql(container,database,`create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text not null,statements text[] not null default array[]::text[]); insert into supabase_migrations.schema_migrations(version,name) values ${ledgerRows.map(([version,name])=>`(${quote(version)},${quote(name)})`).join(",")}; insert into public.retailers(id,name,slug) overriding system value values (11,'10 Reps','10-reps');`),"create full-history ledger 95");
    for(const [migration,version,name,label] of [
      [COMPATIBILITY_MIGRATION,"20260926110000","add_ra004_staging_interface_compatibility","compatibility"],
      [FORWARD_CONTROL_MIGRATION,"20260927100000","reissue_transactional_retailer_control_state_interface","control"],
      [FORWARD_PREFLIGHT_MIGRATION,"20260927101000","reissue_ra004_staging_preflight_metadata_interface","defective preflight"],
      [CORRECTED_PREFLIGHT_MIGRATION,"20260927102000","correct_ra004_staging_preflight_ledger_contract","corrected preflight"],
    ]) {
      ok(file(container,database,migration),`apply ${label}`);
      ok(sql(container,database,`insert into supabase_migrations.schema_migrations(version,name) values (${quote(version)},${quote(name)})`),`record ${label}`);
    }
    const state=json(ok(sql(container,database,`select jsonb_build_object(
      'ledger_count',(select count(*) from supabase_migrations.schema_migrations),
      'ledger_head',(select max(version) from supabase_migrations.schema_migrations),
      'function_hash',encode(sha256(convert_to(pg_get_functiondef('public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)'::regprocedure),'UTF8')),'hex'),
      'correct_name',position('${CORRECT_LEDGER_NAME}' in pg_get_functiondef('public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)'::regprocedure))>0,
      'obsolete_name',position('v_target_name is distinct from ''${OBSOLETE_LEDGER_NAME}''' in pg_get_functiondef('public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)'::regprocedure))>0
    )::text`),"read corrected full-history state"));
    assert.deepEqual(state,{ledger_count:99,ledger_head:"20260927102000",function_hash:"498945611307a893c627aa088cb97977cc956b85082a4b6ffd7d360c1b80a2bb",correct_name:true,obsolete_name:false});
  } catch(error) { primary=error; throw error; }
  finally { const cleanup=run("docker",["rm","-f",container],30_000); if(!primary) ok(cleanup,"remove full-history PostgreSQL"); }
});
