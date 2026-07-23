const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const MIGRATION = path.join(ROOT, "supabase/migrations/20260719100000_add_production_retailer_sync_enablement.sql");
const IMAGE = "postgres:17-alpine";
const PRODUCTION_REF = "aftboxmrdgyhizicfsfu";
const STAGING_REF = "hxnrsyyqffztlvcrtgbf";
const PRODUCTION_IDENTITY = `supplementscout-production:${PRODUCTION_REF}`;
const LEDGER_25 = [
  ["20260712211120","baseline_current_public_schema"],
  ["20260713130000","product_variants_stage2"],
  ["20260713180000","atomic_product_import_rpc"],
  ["20260713190000","approved_import_plan_ledger"],
  ["20260713200000","legacy_mapping_upgrade_rpc"],
  ["20260713210000","create_product_7_chocolate_vanilla_variants_and_retire_legacy_offer"],
  ["20260713220000","seed_batch_a_canonical_variants"],
  ["20260715120000","seed_discount_supplements_batch_b_canonical_variants"],
  ["20260715150000","seed_discount_supplements_batch_c_canonical_variants"],
  ["20260715180000","seed_discount_supplements_batch_d_canonical_products_variants"],
  ["20260715210000","seed_discount_supplements_batch_e_canonical_products_variants"],
  ["20260715230000","seed_fit_house_batch_f_catalog_and_backfill_images"],
  ["20260715233000","correct_fit_house_batch_f_source_variant_identity"],
  ["20260715234500","align_approval_product_format_normalization"],
  ["20260715235500","seed_batch_g_canonical_catalog"],
  ["20260716000000","support_standalone_legacy_mapping_upgrade"],
  ["20260716001000","seed_batch_g_replacement_variants"],
  ["20260716002000","allow_legacy_mapping_upgrade_null_total_noop"],
  ["20260716003000","support_optioned_legacy_mapping_upgrade"],
  ["20260716004000","support_optioned_parent_size_evidence"],
  ["20260716005000","allow_optioned_legacy_identity_update_null_total"],
  ["20260716010000","seed_whey_okay_medium_batch_1_canonical_variants"],
  ["20260716011000","seed_whey_okay_medium_batch_2_canonical_variants"],
  ["20260716012000","seed_whey_okay_medium_batch_3_canonical_variants"],
  ["20260716203000","seed_jons_per4m_product_families"],
];
const STAGING_ONLY = [
  ["20260717120000","create_retailer_catalogue_control_ledger"],
  ["20260717140000","add_staging_retailer_catalogue_executor"],
  ["20260718150000","add_verified_no_change_offer_refresh"],
  ["20260718160000","add_retailer_offer_mixed_batch_executor"],
  ["20260718170000","add_read_only_mixed_batch_validator"],
  ["20260719090000","add_expired_retailer_offer_sync_approval_close"],
];
const PREREQUISITES = [
  "20260712211120_baseline_current_public_schema.sql",
  "20260713130000_product_variants_stage2.sql",
  "20260713180000_atomic_product_import_rpc.sql",
  "20260713190000_approved_import_plan_ledger.sql",
  "20260713200000_legacy_mapping_upgrade_rpc.sql",
  "20260716000000_support_standalone_legacy_mapping_upgrade.sql",
  "20260716002000_allow_legacy_mapping_upgrade_null_total_noop.sql",
  "20260715234500_align_approval_product_format_normalization.sql",
  "20260716003000_support_optioned_legacy_mapping_upgrade.sql",
  "20260716004000_support_optioned_parent_size_evidence.sql",
  "20260716005000_allow_optioned_legacy_identity_update_null_total.sql",
].map((name) => path.join(ROOT, "supabase/migrations", name));
const STAGE2_SETUP = path.join(ROOT, "supabase/test/product_variants_stage2_migration_test.sql");

function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout: options.timeout || 180_000, input: options.input });
}
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function requireSuccess(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message}`);
  assert.equal(result.status, 0, `${label} failed:\n${output(result)}`);
  return result;
}
function requireFailure(result, label, pattern) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message}`);
  assert.notEqual(result.status, 0, `${label} unexpectedly passed`);
  assert.match(output(result), pattern);
}
function dockerAvailable() {
  const result = run("docker", ["version", "--format", "{{.Server.Version}}"], { timeout: 10_000 });
  return result.status === 0;
}
function exec(container, args, options = {}) {
  return run("docker", ["exec", ...(options.stdin ? ["-i"] : []), container, ...args], options);
}
function psql(container, database, sql) {
  return exec(container, ["psql","-X","--no-psqlrc","-v","ON_ERROR_STOP=1","-U","postgres","-d",database,"-tA","-c",sql]);
}
function psqlAs(container, database, user, sql) {
  return exec(container, ["psql","-X","--no-psqlrc","-v","ON_ERROR_STOP=1","-U",user,"-d",database,"-tA","-c",sql]);
}
function psqlFile(container, database, file, variables = []) {
  const args = ["psql","-X","--no-psqlrc","-v","ON_ERROR_STOP=1",...variables.flatMap((value) => ["-v",value]),"-U","postgres","-d",database,"-f",`/workspace/${path.relative(ROOT,file).replaceAll("\\","/")}`];
  return exec(container, args);
}
function psqlText(container, database, sql, timeout = 180_000) {
  return exec(container, ["psql","-X","--no-psqlrc","-v","ON_ERROR_STOP=1","-U","postgres","-d",database,"-f","-"], { stdin: true, input: sql, timeout });
}
function json(container, database, sql) {
  const result = requireSuccess(psql(container,database,sql),"JSON query");
  return JSON.parse(result.stdout.trim());
}
function quote(value) { return `'${String(value).replaceAll("'","''")}'`; }
function ledgerInsert(rows) {
  return `insert into supabase_migrations.schema_migrations(version,name,statements) values ${rows.map(([version,name]) => `(${quote(version)},${quote(name)},array[]::text[])`).join(",")};`;
}
function waitForPostgres(container) {
  let consecutive=0;
  for (let attempt=0; attempt<100; attempt+=1) {
    const result=exec(container,["psql","-X","--no-psqlrc","-U","postgres","-d","postgres","-tAc","select 1"],{timeout:5000});
    consecutive=result.status===0&&result.stdout.trim()==="1"?consecutive+1:0;
    if(consecutive===3) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);
  }
  assert.fail("PostgreSQL did not start");
}
function adaptedMigration(container,database) {
  const physical=json(container,database,"select jsonb_build_object('system_identifier',system_identifier::text,'database_oid',(select oid::text from pg_database where datname=current_database()))::text from pg_control_system()");
  return fs.readFileSync(MIGRATION,"utf8")
    .replace("current_database() <> 'postgres'",`current_database() <> '${database}'`)
    .replaceAll("7642734024280108049",physical.system_identifier)
    .replaceAll("5::oid",`${physical.database_oid}::oid`);
}
function productionScenario(file) {
  return fs.readFileSync(path.join(ROOT,"supabase/test",file),"utf8")
    .replaceAll(PRODUCTION_IDENTITY,"__OPPOSITE_DATABASE_IDENTITY__")
    .replaceAll(PRODUCTION_REF,"__OPPOSITE_PROJECT_REF__")
    .replaceAll(STAGING_REF,PRODUCTION_REF)
    .replaceAll("STAGING","PRODUCTION")
    .replaceAll("Staging","Production")
    .replaceAll("staging","production")
    .replaceAll("__OPPOSITE_PROJECT_REF__",STAGING_REF)
    .replaceAll("__OPPOSITE_DATABASE_IDENTITY__",`supplementscout-staging:${STAGING_REF}`);
}
function objectState(container,database) {
  return json(container,database,`select jsonb_build_object(
    'business',public.retailer_catalogue_business_counts(),
    'control_rows',(select coalesce(sum(row_count),0) from (
      select count(*) row_count from public.retailer_catalogue_parent_plans union all
      select count(*) from public.retailer_catalogue_child_plans union all
      select count(*) from public.retailer_catalogue_apply_runs union all
      select count(*) from public.retailer_catalogue_database_targets union all
      select count(*) from public.verified_offer_refresh_targets union all
      select count(*) from public.retailer_offer_sync_batch_approvals union all
      select count(*) from public.retailer_catalogue_production_fixture_approvals union all
      select count(*) from public.retailer_catalogue_production_recovery_manifests union all
      select count(*) from public.retailer_catalogue_production_recovery_approvals union all
      select count(*) from public.retailer_catalogue_production_recovery_audit
    ) counts),
    'forced_rls',(select count(*) from pg_class where relnamespace='public'::regnamespace and relname in (
      'retailer_catalogue_parent_plans','retailer_catalogue_child_plans','retailer_catalogue_apply_runs',
      'retailer_catalogue_database_targets','verified_offer_refresh_targets','retailer_offer_sync_batch_approvals',
      'retailer_catalogue_production_fixture_approvals','retailer_catalogue_production_recovery_manifests',
      'retailer_catalogue_production_recovery_approvals','retailer_catalogue_production_recovery_audit'
    ) and relrowsecurity and relforcerowsecurity),
    'roles',(select jsonb_agg(jsonb_build_object('role',rolname,'login',rolcanlogin,'inherit',rolinherit,'super',rolsuper,'bypassrls',rolbypassrls) order by rolname) from pg_roles where rolname like 'retailer_catalogue_production_%'),
    'direct_business_dml',(select count(*) from information_schema.role_table_grants where grantee like 'retailer_catalogue_production_%' and table_name in ('retailers','products','product_variants','retailer_products','offers','price_history') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')),
    'service_runtime_execute',(select count(*) from (values
      ('validate_retailer_offer_sync_batch_read_only(jsonb)'::regprocedure),
      ('approve_retailer_offer_sync_batch(jsonb)'::regprocedure),
      ('execute_retailer_offer_sync_batch(jsonb)'::regprocedure),
      ('close_expired_retailer_offer_sync_approval(jsonb)'::regprocedure)
    ) f(p) where has_function_privilege('service_role',p,'EXECUTE'))
  )::text`);
}

test("production enablement is one transactional bundle and preserves staging migrations byte-for-byte", () => {
  const sql=fs.readFileSync(MIGRATION,"utf8");
  assert.match(sql,/^begin;/i); assert.match(sql,/commit;\s*$/i);
  assert.match(sql,/exact production ledger 25/);
  assert.match(sql,/physical database identity mismatch/);
  assert.match(sql,/retailer_catalogue_production_validator/);
  assert.match(sql,/target_environment='PRODUCTION'/);
  assert.match(sql,/project_ref='aftboxmrdgyhizicfsfu'/);
  assert.doesNotMatch(sql,/\balter\s+role\b/i);
  for(const role of ["validator","approver","executor"])
    assert.match(sql,new RegExp(`create role retailer_catalogue_production_${role}\\s+nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls`,`i`));
  assert.doesNotMatch(sql,/insert into public\.verified_offer_refresh_targets/i);
  const expected={
    "20260717120000_create_retailer_catalogue_control_ledger.sql":"df8539d1b63cdd37ac58fce40c1bd7fc6165982294b1554ed1f2945a62988270",
    "20260717140000_add_staging_retailer_catalogue_executor.sql":"6dbdc5c2912c9c04a8c24e7905b7c705711c2f1b68b2eff51fab85e132f56512",
    "20260718150000_add_verified_no_change_offer_refresh.sql":"9c97854bc8469e1ba376e25803a4c82c81de69c701df6e65870bb0fafefd97e2",
    "20260718160000_add_retailer_offer_mixed_batch_executor.sql":"29098f16a10e0aaab2e1fdca1dadf33791ad470e3bfe0cc46bd7b24e60b0f7d1",
    "20260718170000_add_read_only_mixed_batch_validator.sql":"09ece7d68328ee7e383375f6d13f55933e7c18be88137fa0108046d69f121510",
    "20260719090000_add_expired_retailer_offer_sync_approval_close.sql":"978ee878cbdc93ec4ef942a30aa51da4ae40c8400bceec2ba07a641d3ca72893",
  };
  for(const [file,sha] of Object.entries(expected)) assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT,"supabase/migrations",file))).digest("hex"),sha,file);
});

test("canonical Jon's slug matches production and the obsolete alias cannot create a second identity", () => {
  const policy=require("./config/retailers/jons-supplements");
  const config=require("../config/retailers/jons-supplements-offer-sync.json");
  const fixture=require("./test-fixtures/retailer-offer-sync/jons-supplements-26.json");
  assert.deepEqual(new Set([policy.retailer.id,policy.retailer.slug,config.retailer_slug,fixture.retailer_slug]),new Set(["jon-s-supplements"]));
  assert.notEqual(policy.retailer.slug,"jons-supplements");
  const identities=new Map();
  for(const slug of [policy.retailer.slug,config.retailer_slug,fixture.retailer_slug]) identities.set(slug,(identities.get(slug)||0)+1);
  assert.equal(identities.size,1);
});

test("one-stage rollout package is immutable, complete, unexecuted, and binds all 26 no-change rows", () => {
  const packageFile=path.join(ROOT,"docs/rollouts/jons-production-retailer-sync-rollout-package.json");
  const packageBytes=fs.readFileSync(packageFile);
  const packageData=JSON.parse(packageBytes);
  const packageRelative=path.relative(ROOT,packageFile).replaceAll("\\","/");
  const provenanceCommit=requireSuccess(
    run("git",["log","-1","--format=%H","--",packageRelative]),
    "resolve historical rollout package commit",
  ).stdout.trim();
  assert.match(provenanceCommit,/^[0-9a-f]{40}$/);
  const historicalBytes=(relative) => requireSuccess(
    spawnSync("git",["show",`${provenanceCommit}:${relative}`],{cwd:ROOT,timeout:180_000}),
    `read historical rollout input ${relative}`,
  ).stdout;
  assert.equal(
    crypto.createHash("sha256").update(historicalBytes(packageData.source.policy_file)).digest("hex"),
    packageData.source.policy_sha256,
    "historical package must bind the policy bytes from its own rollout commit, not mutable current policy",
  );
  assert.equal(
    crypto.createHash("sha256").update(historicalBytes(packageData.source.adapter_file)).digest("hex"),
    packageData.source.adapter_sha256,
  );
  assert.equal(
    crypto.createHash("sha256").update(historicalBytes(packageData.migration.sequence[0].file)).digest("hex"),
    packageData.migration.sequence[0].sha256,
  );
  assert.equal(
    crypto.createHash("sha256").update(historicalBytes(packageData.provenance.builder_file)).digest("hex"),
    packageData.provenance.builder_sha256,
  );
  const unsealed={...packageData,package_fingerprint:null};
  assert.equal(crypto.createHash("sha256").update(require("./lib/canonical-json").canonicalJson(unsealed)).digest("hex"),packageData.package_fingerprint);
  assert.equal(packageData.migration.current_count,25); assert.equal(packageData.migration.expected_count,26);
  assert.equal(packageData.migration.current_fingerprint,"ba5d4c8581b185d5412fa4f41a3cbeacf40547f507e124962f922d4aa71772b0");
  assert.equal(packageData.migration.expected_fingerprint,"a0015032fc8b3b4fbf829ea0d0f1eb1dfdcaf1893d68dc875f21558c6a587152");
  assert.equal(packageData.execution_plan.row_count,26);
  assert.equal(packageData.execution_plan.row_plans.every((row)=>row.action==="VERIFY_NO_CHANGE"&&row.expected_price_history_insert===0),true);
  assert.equal(packageData.execution_plan.expected_last_checked_at_updates,26);
  assert.deepEqual(packageData.production_actions_executed,[]);
  assert.equal(packageData.stages.every((stage)=>stage.executed===false),true);
  const sidecar=fs.readFileSync(`${packageFile}.sha256`,"utf8").trim().split(/\s+/)[0];
  assert.equal(sidecar,crypto.createHash("sha256").update(packageBytes).digest("hex"));
});

test("production sequence passes exact identity and fails staging, drift, order, rerun, and injected failure atomically",{skip:!dockerAvailable()&&"Docker daemon unavailable"},()=>{
  const container=`supplementscout-production-enablement-${crypto.randomBytes(5).toString("hex")}`;
  let primaryError;
  try{
    requireSuccess(run("docker",["run","--detach","--rm","--name",container,"--network","none","-e","POSTGRES_HOST_AUTH_METHOD=trust","-v",`${ROOT}:/workspace:ro`,IMAGE],{timeout:180000}),"start PostgreSQL");
    waitForPostgres(container);
    const base="supplementscout_stage2_test_production_enablement";
    requireSuccess(exec(container,["createdb","-U","postgres",base]),"create base database");
    requireSuccess(psql(container,base,"create role management_sql_operator_probe login createrole nosuperuser nocreatedb noreplication nobypassrls"),"create management SQL operator probe");
    const finalAttributes="nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls";
    requireSuccess(psqlAs(container,base,"management_sql_operator_probe",`create role direct_final_role_probe ${finalAttributes}`),"management operator direct final CREATE ROLE");
    requireSuccess(psqlAs(container,base,"management_sql_operator_probe","create role late_alter_role_probe nologin"),"management operator initial CREATE ROLE");
    requireFailure(psqlAs(container,base,"management_sql_operator_probe",`alter role late_alter_role_probe ${finalAttributes}`),"management operator ALTER ROLE superuser attribute",/Only roles with the SUPERUSER attribute may change the SUPERUSER attribute/i);
    const directRole=json(container,base,"select row_to_json(r)::text from (select rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls from pg_roles where rolname='direct_final_role_probe') r");
    assert.deepEqual(directRole,{rolcanlogin:false,rolinherit:false,rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false});
    requireSuccess(psql(container,base,"do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon')then create role anon nologin;end if;if not exists(select 1 from pg_roles where rolname='authenticated')then create role authenticated nologin;end if;if not exists(select 1 from pg_roles where rolname='service_role')then create role service_role nologin;end if;end $roles$;"),"create roles");
    requireSuccess(psqlFile(container,base,PREREQUISITES[0]),"baseline");
    requireSuccess(psqlFile(container,base,STAGE2_SETUP,["stage2_test_database_confirmed=1","stage2_test_host=127.0.0.1",`stage2_expected_database=${base}`,"stage2_scenario=success"]),"stage2 fixture");
    for(const migration of PREREQUISITES.slice(1)) requireSuccess(psqlFile(container,base,migration),path.basename(migration));
    requireSuccess(psql(container,base,`create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text not null,statements text[] not null default array[]::text[]); ${ledgerInsert(LEDGER_25)}`),"seed production ledger");

    for(const database of ["wrong_identity","staging_ledger","wrong_ledger","wrong_order","rollback","pass"].map((suffix)=>`supplementscout_stage2_test_${suffix}`))
      requireSuccess(exec(container,["createdb","-U","postgres","-T",base,database]),`clone ${database}`);

    const wrongIdentity="supplementscout_stage2_test_wrong_identity";
    requireFailure(psqlText(container,wrongIdentity,fs.readFileSync(MIGRATION,"utf8")),"wrong physical identity",/database identity mismatch/);

    const staging="supplementscout_stage2_test_staging_ledger";
    requireSuccess(psql(container,staging,ledgerInsert(STAGING_ONLY)),"seed staging ledger 31");
    requireFailure(psqlText(container,staging,adaptedMigration(container,staging)),"staging fail closed",/exact production ledger 25/);
    assert.equal(json(container,staging,"select jsonb_build_object('control_objects',(select count(*) from pg_class where relnamespace='public'::regnamespace and relname like 'retailer_catalogue_%'))::text").control_objects,0);

    const wrongLedger="supplementscout_stage2_test_wrong_ledger";
    requireSuccess(psql(container,wrongLedger,"delete from supabase_migrations.schema_migrations where version='20260716203000'"),"drift ledger");
    requireFailure(psqlText(container,wrongLedger,adaptedMigration(container,wrongLedger)),"wrong ledger",/exact production ledger 25/);

    const wrongOrder="supplementscout_stage2_test_wrong_order";
    requireSuccess(psql(container,wrongOrder,"update supabase_migrations.schema_migrations set version='20260716011500' where version='20260716012000'"),"drift order");
    requireFailure(psqlText(container,wrongOrder,adaptedMigration(container,wrongOrder)),"wrong order",/exact production ledger 25/);

    const rollback="supplementscout_stage2_test_rollback";
    const injected=adaptedMigration(container,rollback).replace("-- Final production security boundary","do $injected$ begin raise exception 'INJECTED_ENABLEMENT_FAILURE'; end $injected$;\n\n-- Final production security boundary");
    requireFailure(psqlText(container,rollback,injected),"injected rollback",/INJECTED_ENABLEMENT_FAILURE/);
    const rolledBack=json(container,rollback,"select jsonb_build_object('tables',(select count(*) from pg_class where relnamespace='public'::regnamespace and relname like 'retailer_catalogue_%'),'roles',(select count(*) from pg_roles where rolname like 'retailer_catalogue_production_%'),'targets',to_regclass('public.verified_offer_refresh_targets') is not null)::text");
    assert.deepEqual(rolledBack,{tables:0,roles:0,targets:false});

    const pass="supplementscout_stage2_test_pass";
    const businessCounts="select jsonb_build_object('products',(select count(*) from public.products),'product_variants',(select count(*) from public.product_variants),'retailers',(select count(*) from public.retailers),'retailer_products',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),'price_history',(select count(*) from public.price_history),'approved_import_plans',(select count(*) from public.approved_import_plans))::text";
    const before=json(container,pass,businessCounts);
    const productionSql=adaptedMigration(container,pass);
    requireSuccess(psqlText(container,pass,productionSql,300000),"production bundle");
    const after=json(container,pass,businessCounts);
    assert.deepEqual(after,before);
    const state=objectState(container,pass);
    assert.equal(state.control_rows,0); assert.equal(state.forced_rls,10); assert.equal(state.roles.length,3);
    assert.equal(state.roles.every((role)=>!role.login&&!role.inherit&&!role.super&&!role.bypassrls),true);
    assert.equal(state.direct_business_dml,0); assert.equal(state.service_runtime_execute,0);

    const rerunBefore=objectState(container,pass);
    requireFailure(psqlText(container,pass,productionSql),"deterministic rerun",/objects already exist; rerun rejected/);
    assert.deepEqual(objectState(container,pass),rerunBefore);

    requireSuccess(psql(container,pass,`insert into supabase_migrations.schema_migrations values('20260719100000','add_production_retailer_sync_enablement',array[]::text[]);
      insert into public.products(id,name,slug,brand,category,product_format,is_active) values(91,'Project AD Shredabull Untamed 2.0 50 Caps','project-ad-shredabull-untamed-2-0-50-caps','Project AD','Fat Burner','capsule',true) on conflict(id) do nothing;
      insert into public.product_variants(id,product_id,variant_key,display_name,pack_count,product_format,is_active,is_default) values(39,91,'default','Default',1,'capsule',true,true) on conflict(id) do nothing;
      insert into public.retailer_catalogue_database_targets(id,target_environment,project_ref,database_identity,database_system_identifier,database_oid,is_active,attested_by)
      select true,'PRODUCTION','${PRODUCTION_REF}','${PRODUCTION_IDENTITY}',system_identifier::text,(select oid from pg_database where datname=current_database()),true,'local-production-sequence-test' from pg_control_system();
      insert into public.verified_offer_refresh_targets(id,target_environment,project_ref,database_system_identifier,database_oid,is_active,attested_by)
      select true,'PRODUCTION','${PRODUCTION_REF}',system_identifier::text,(select oid from pg_database where datname=current_database()),true,'local-production-sequence-test' from pg_control_system();`),"local attestations");

    for(const scenario of [
      "retailer_offer_read_only_validator_integration_test.sql",
      "retailer_offer_mixed_batch_executor_integration_test.sql",
      "retailer_offer_expired_approval_close_integration_test.sql",
    ]) {
      const result=requireSuccess(psqlText(container,pass,productionScenario(scenario),300000),`production ${scenario}`);
      assert.match(result.stdout,/"result"\s*:\s*"PASS"/i,scenario);
    }
  }catch(error){primaryError=error;throw error;}finally{
    const cleanup=run("docker",["rm","-f",container],{timeout:30000});
    if(!primaryError&&cleanup.status!==0) assert.fail(output(cleanup));
  }
});
