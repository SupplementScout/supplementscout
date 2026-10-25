const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { canonicalEvidenceSha256 } = require("./lib/reviewed-catalogue-canonical-evidence");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = "postgres:17-alpine";
const PASSWORD = "reviewed-v3-local-only";
const ENVIRONMENT_SAFE_BOUNDED_STATE_MIGRATION = "supabase/migrations/20261017131000_add_environment_safe_reviewed_catalogue_bounded_state.sql";
const ENVIRONMENT_SAFE_BOUNDED_STATE_ROLLBACK = "supabase/rollbacks/20261017131000_add_environment_safe_reviewed_catalogue_bounded_state_rollback.sql";
const ENVIRONMENT_SAFE_MIGRATION = "supabase/migrations/20261018121000_add_environment_safe_reviewed_catalogue_v3_boundary.sql";
const ENVIRONMENT_SAFE_ROLLBACK = "supabase/rollbacks/20261018121000_add_environment_safe_reviewed_catalogue_v3_boundary_rollback.sql";
const ENVIRONMENT_SAFE_OPTION_ROLE_MIGRATION = "supabase/migrations/20261018191000_fix_environment_safe_reviewed_v3_apply_option_roles.sql";
const ENVIRONMENT_SAFE_OPTION_ROLE_ROLLBACK = "supabase/rollbacks/20261018191000_fix_environment_safe_reviewed_v3_apply_option_roles_rollback.sql";
const POST_CREATE_OPTION_ROLE_MIGRATION = "supabase/migrations/20261019100000_fix_reviewed_v3_post_create_option_roles.sql";
const POST_CREATE_OPTION_ROLE_ROLLBACK = "supabase/rollbacks/20261019100000_fix_reviewed_v3_post_create_option_roles_rollback.sql";
const TRUSTED_PARENT_POLICY_MIGRATION = "supabase/migrations/20261019120000_bridge_trusted_v3_reviewed_parent_policy.sql";
const TRUSTED_PARENT_POLICY_ROLLBACK = "supabase/rollbacks/20261019120000_bridge_trusted_v3_reviewed_parent_policy_rollback.sql";
const PLURAL_FLAVOUR_MIGRATION = "supabase/migrations/20261019130000_fix_reviewed_v3_plural_flavour_compatibility.sql";
const PLURAL_FLAVOUR_ROLLBACK = "supabase/rollbacks/20261019130000_fix_reviewed_v3_plural_flavour_compatibility_rollback.sql";
const ROLE_AWARE_SIZE_MIGRATION = "supabase/migrations/20261020180000_fix_reviewed_v3_role_aware_legacy_size_projection.sql";
const ROLE_AWARE_SIZE_ROLLBACK = "supabase/rollbacks/20261020180000_fix_reviewed_v3_role_aware_legacy_size_projection_rollback.sql";
const TRUSTED_PARENT_FORMAT_MIGRATION = "supabase/migrations/20261021120000_align_trusted_v3_reviewed_parent_format_policy.sql";
const TRUSTED_PARENT_FORMAT_ROLLBACK = "supabase/rollbacks/20261021120000_align_trusted_v3_reviewed_parent_format_policy_rollback.sql";
const EXISTING_VARIANT_FLAVOUR_ALIAS_MIGRATION = "supabase/migrations/20261022080000_allow_reviewed_v3_existing_variant_flavour_alias_projection.sql";
const EXISTING_VARIANT_FLAVOUR_ALIAS_ROLLBACK = "supabase/rollbacks/20261022080000_allow_reviewed_v3_existing_variant_flavour_alias_projection_rollback.sql";
const EXISTING_VARIANT_FLAVOUR_ALIAS_PROJECTION_SHA = "7714cb21a64af063079c34cd5929b242030913c850532d5e71162839b974f1e6";
const EVIDENCE_PARITY_MIGRATION = "supabase/migrations/20261022120000_fix_reviewed_v3_apply_evidence_parity.sql";
const EVIDENCE_PARITY_ROLLBACK = "supabase/rollbacks/20261022120000_fix_reviewed_v3_apply_evidence_parity_rollback.sql";
const COMPOSITE_CREATE_SIZE_MIGRATION = "supabase/migrations/20261024120000_fix_reviewed_v3_create_product_composite_size_projection.sql";
const COMPOSITE_CREATE_SIZE_ROLLBACK = "supabase/rollbacks/20261024120000_fix_reviewed_v3_create_product_composite_size_projection_rollback.sql";
const CANONICAL_EVIDENCE_MIGRATION = "supabase/migrations/20261025120000_add_reviewed_v3_canonical_identity_evidence.sql";
const CANONICAL_EVIDENCE_ROLLBACK = "supabase/rollbacks/20261025120000_add_reviewed_v3_canonical_identity_evidence_rollback.sql";
const ENVIRONMENT_SAFE_FORWARD_CHAIN = Object.freeze([
  ENVIRONMENT_SAFE_BOUNDED_STATE_MIGRATION,
  ENVIRONMENT_SAFE_MIGRATION,
  ENVIRONMENT_SAFE_OPTION_ROLE_MIGRATION,
  POST_CREATE_OPTION_ROLE_MIGRATION,
  TRUSTED_PARENT_POLICY_MIGRATION,
  PLURAL_FLAVOUR_MIGRATION,
  ROLE_AWARE_SIZE_MIGRATION,
  TRUSTED_PARENT_FORMAT_MIGRATION,
  EXISTING_VARIANT_FLAVOUR_ALIAS_MIGRATION,
  EVIDENCE_PARITY_MIGRATION,
  COMPOSITE_CREATE_SIZE_MIGRATION,
  CANONICAL_EVIDENCE_MIGRATION,
]);
const ENVIRONMENT_SAFE_ROLLBACK_CHAIN = Object.freeze([
  ENVIRONMENT_SAFE_BOUNDED_STATE_ROLLBACK,
  ENVIRONMENT_SAFE_ROLLBACK,
  ENVIRONMENT_SAFE_OPTION_ROLE_ROLLBACK,
  POST_CREATE_OPTION_ROLE_ROLLBACK,
  TRUSTED_PARENT_POLICY_ROLLBACK,
  PLURAL_FLAVOUR_ROLLBACK,
  ROLE_AWARE_SIZE_ROLLBACK,
  TRUSTED_PARENT_FORMAT_ROLLBACK,
  EXISTING_VARIANT_FLAVOUR_ALIAS_ROLLBACK,
  EVIDENCE_PARITY_ROLLBACK,
  COMPOSITE_CREATE_SIZE_ROLLBACK,
  CANONICAL_EVIDENCE_ROLLBACK,
]);
const LEGACY_COMPATIBILITY_HELPER_SHA = "849df8441e8994daf1acb514705808fde17467e033185e30cc432ad165a13905";
const POST_CREATE_COMPATIBILITY_HELPER_SHA = "906cb5abad08deb8452fa9ae4fed8be8669b760e6f2ef088ae8846f5536b27db";
const PLURAL_FLAVOUR_COMPATIBILITY_HELPER_SHA = "3f25c76ae3407552f99e035d60f2629838ab878d5f127b20d29be02aa834fdfc";
const BOUNDED_STATE_SHA = "2e0f4696d3b9c437257e849f58db2ffc35b835d265eca83e6f3459a8cf2e44f4";
const LIVE_APPLY_DISPATCH_FIXTURE = "supabase/test/reviewed_catalogue_v3_live_apply_dispatch_fixture.sql";
const BOUNDARY_FUNCTIONS = Object.freeze([
  "public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb)",
  "public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb)",
  "public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)",
  "public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb)",
  "public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb)",
  "public.validate_product_import_plan_read_only(jsonb)",
  "public.approve_reviewed_catalogue_v3_plan(jsonb,jsonb,timestamp with time zone)",
  "public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)",
  "public.atomic_import_validate_product_before_reviewed_v3(jsonb)",
]);
const TARGETS = Object.freeze({
  STAGING: Object.freeze({
    projectRef: "hxnrsyyqffztlvcrtgbf",
    validatorSha: "70f134e6f7d3afa25de52353ff5e8aca3cc0f7c34a58d9da3577ead4ac11f4a9",
    standardCoreFixture: "supabase/test/reviewed_catalogue_v3_staging_standard_apply_core.sql",
    standardCoreSha: "69311caa0dda83010f986dfbd76bc0017d3a0f999c64b1dd5e35dcb87b7d4c48",
    preSourceCoreSha: "f560a7a93e3458db20d4a71451da35b53fe1fac9379bfedcd86ab98b76d3d648",
    livePreSourceValidatorFixture: "supabase/test/reviewed_catalogue_v3_staging_pre_source_validator.sql",
    livePreSourceValidatorSha: "3b78fcd6f6d175c01a83484811b473a703b5d134b79faaac5f6dfb039f0039eb",
    patchedPreSourceValidatorSha: "47913d9e685b0b0804cac3349a7e8d037878834071a7ad4a69be0c826090e44e",
    postBoundaryFallbackSha: "c8e47e4495fe78641b1cccf6ffe2dc6cbc980ae86ee341effd8278a8d86c918f",
    postTrustedParentSha: "0f2308eb0759cff2a4d97708a3bdfca24d50820483310117771f1bd3a2a3149a",
    postTrustedParentFormatSha: "c82e291550787e553fc906a669c348f0b7d6cd034bfb8bd326d7a9c646e7511a",
    legacyCountSizeError: "variant option size mismatch",
    hasV1: false,
    hasExecutionResult: false,
    boundedStateMigration: ENVIRONMENT_SAFE_BOUNDED_STATE_MIGRATION,
    boundedStateRollback: ENVIRONMENT_SAFE_BOUNDED_STATE_ROLLBACK,
    boundaryMigration: ENVIRONMENT_SAFE_MIGRATION,
    boundaryRollback: ENVIRONMENT_SAFE_ROLLBACK,
    optionRoleMigration: ENVIRONMENT_SAFE_OPTION_ROLE_MIGRATION,
    optionRoleRollback: ENVIRONMENT_SAFE_OPTION_ROLE_ROLLBACK,
  }),
  PRODUCTION: Object.freeze({
    projectRef: "aftboxmrdgyhizicfsfu",
    validatorSha: "b9d99d9245ff2ea493fa9ed4d160f0e9ff4c450764cb40a5a23325d0ca069583",
    standardCoreFixture: "supabase/test/reviewed_catalogue_v3_production_standard_apply_core.sql",
    standardCoreSha: "0b0bccb01e521228db93f495db7984372df5b177cf7009edc205620c1ddef634",
    preSourceCoreSha: "f560a7a93e3458db20d4a71451da35b53fe1fac9379bfedcd86ab98b76d3d648",
    livePreSourceValidatorFixture: "supabase/test/reviewed_catalogue_v3_production_pre_source_validator.sql",
    livePreSourceValidatorSha: "fbd7752889269b8bdc4b57c729b3233ce17507c6f5766be7a150d99363a6bf87",
    patchedPreSourceValidatorSha: "7771649ee17b055e5f90ad343a33abf6c950c90c293c575442ee3cb61d671c6e",
    postBoundaryFallbackSha: "47001d0eb21fce1b136b1050f2c91b392f54bb29cf67825d370a2f03a6f37d3a",
    postTrustedParentSha: "80e9f09e1b9ad414689d0f42876bb8f169f528b4efad61d9713f3dad6850a942",
    postTrustedParentFormatSha: "c8370ee49d873f9cf8f6f375653848248b2cbe19f0e0b869f392e45405ae5daf",
    legacyCountSizeError: "variant option size mismatch",
    hasV1: true,
    hasExecutionResult: true,
    boundedStateMigration: ENVIRONMENT_SAFE_BOUNDED_STATE_MIGRATION,
    boundedStateRollback: ENVIRONMENT_SAFE_BOUNDED_STATE_ROLLBACK,
    boundaryMigration: ENVIRONMENT_SAFE_MIGRATION,
    boundaryRollback: ENVIRONMENT_SAFE_ROLLBACK,
    optionRoleMigration: ENVIRONMENT_SAFE_OPTION_ROLE_MIGRATION,
    optionRoleRollback: ENVIRONMENT_SAFE_OPTION_ROLE_ROLLBACK,
  }),
});

function run(command, args, timeout = 180_000, input = undefined) {
  return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout, input });
}
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function succeed(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message}`);
  assert.equal(result.status, 0, `${label}:\n${output(result)}`);
  return result;
}
function fails(result, label, pattern) {
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
  assert.match(output(result), pattern, label);
}
function dockerAvailable() {
  return run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000).status === 0;
}
function exec(container, args, timeout = 180_000) {
  return run("docker", ["exec", "-e", `PGPASSWORD=${PASSWORD}`, container, ...args], timeout);
}
function sql(container, statement, tuples = false) {
  return exec(container, [
    "psql", "-X", "--no-psqlrc", "-q", "-v", "ON_ERROR_STOP=1",
    ...(tuples ? ["-tA"] : []), "-U", "postgres", "-d", "postgres", "-c", statement,
  ]);
}
function file(container, name) {
  return exec(container, [
    "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", "postgres", "-f", `/workspace/${name}`,
  ]);
}
function fixtureFile(container, name) {
  const contents = fs.readFileSync(path.join(ROOT, name), "utf8").replaceAll("\r\n", "\n");
  return run("docker", [
    "exec", "-i", "-e", `PGPASSWORD=${PASSWORD}`, container,
    "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", "postgres",
  ], 180_000, contents);
}
function literal(value) { return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`; }
function scalar(container, statement, label) {
  return succeed(sql(container, statement, true), label).stdout.trim();
}
function json(container, statement, label) {
  return JSON.parse(scalar(container, statement, label));
}
function wait(container) {
  let consecutiveReadyChecks = 0;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const ready = exec(container, [
      "psql", "-X", "--no-psqlrc", "-U", "postgres", "-tAc", "select 1",
    ], 5_000).stdout.trim() === "1";
    consecutiveReadyChecks = ready ? consecutiveReadyChecks + 1 : 0;
    if (consecutiveReadyChecks === 3) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("PostgreSQL did not become ready");
}

function roleNames(environment) {
  const lower = environment.toLowerCase();
  return {
    validator: `retailer_catalogue_${lower}_validator`,
    approver: `retailer_catalogue_${lower}_approver`,
    executor: `retailer_catalogue_${lower}_executor`,
    validatorLogin: `supplementscout_${lower}_validator_login`,
    approverLogin: `supplementscout_${lower}_approver_login`,
    executorLogin: `supplementscout_${lower}_executor_login`,
    marker: `app.retailer_catalogue_${lower}_marker`,
  };
}

function asRole(environment, kind, statement, { readOnly = false, approvalId = null } = {}) {
  const roles = roleNames(environment);
  const role = roles[kind];
  const login = roles[`${kind}Login`];
  const settings = readOnly
    ? ""
    : `set local ${roles.marker}='1'; set local app.retailer_catalogue_allow='1';`;
  const context = approvalId
    ? `set local app.reviewed_catalogue_v3_approval_id='${approvalId}';`
    : "";
  return `set session authorization ${login}; begin${readOnly ? " read only" : ""}; ${settings} set local role ${role}; ${context} ${statement}; ${readOnly ? "rollback" : "commit"};`;
}

function setupSql(environment) {
  const target = TARGETS[environment];
  const roles = roleNames(environment);
  const executionResult = target.hasExecutionResult ? ",execution_result jsonb" : "";
  const stagingValidator = `
create function public.atomic_import_is_source_bound_offer_sync_plan(p_plan jsonb) returns boolean language sql immutable as $$select false$$;
create function public.atomic_import_validate_source_bound_offer_sync_plan(p_plan jsonb) returns jsonb language sql stable as $$select jsonb_build_object('valid',true,'path','staging-source')$$;
create function public.atomic_import_source_bound_offer_sync_core_plan(p_plan jsonb) returns jsonb language sql immutable as $$select p_plan$$;
create function public.atomic_import_validate_pre_source_metadata_plan_core(p_plan jsonb) returns jsonb language plpgsql stable as $$
begin
  if p_plan->>'force_error'='1' then raise exception 'FIXTURE_NON_V3_REJECT' using errcode='22023'; end if;
  return jsonb_build_object('valid',true,'path','staging-fallback');
end$$;
create function public.validate_product_import_plan_read_only(p_plan jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  if public.atomic_import_is_source_bound_offer_sync_plan(p_plan) then
    return public.atomic_import_validate_source_bound_offer_sync_plan(p_plan);
  end if;
  return public.atomic_import_validate_pre_source_metadata_plan_core(p_plan);
end
$function$;`;
  const productionValidator = `
create function public.atomic_import_is_source_bound_offer_sync_plan(p_plan jsonb) returns boolean language sql immutable as $$select false$$;
create function public.atomic_import_validate_source_bound_offer_sync_plan(p_plan jsonb) returns jsonb language sql stable as $$select jsonb_build_object('valid',true,'path','production-source')$$;
create function public.atomic_import_source_bound_offer_sync_core_plan(p_plan jsonb) returns jsonb language sql immutable as $$select p_plan$$;
create function public.atomic_import_reviewed_catalogue_plan_allowed(p_plan jsonb) returns boolean language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
  select exists(select 1 from public.approved_import_plans a where a.source like 'reviewed-catalogue-package-v1:%' and a.status='approved' and a.consumed_at is null and a.expires_at>now() and a.plan_json=p_plan)
$$;
create function public.validate_reviewed_catalogue_import_plan(p_plan jsonb) returns jsonb language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$select jsonb_build_object('valid',true,'path','production-v1')$$;
create function public.atomic_import_validate_before_reviewed_catalogue_package(p_plan jsonb) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if p_plan->>'force_error'='1' then raise exception 'FIXTURE_NON_V3_REJECT' using errcode='22023'; end if;
  return jsonb_build_object('valid',true,'path','production-fallback');
end$$;
create function public.atomic_import_validate_pre_source_metadata_plan_core(p_plan jsonb) returns jsonb language sql stable as $$
  select public.atomic_import_validate_before_reviewed_catalogue_package(p_plan)
$$;
create function public.validate_product_import_plan_read_only(p_plan jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  if public.atomic_import_reviewed_catalogue_plan_allowed(p_plan) then
    return public.validate_reviewed_catalogue_import_plan(p_plan);
  end if;
  return public.atomic_import_validate_before_reviewed_catalogue_package(p_plan);
end
$function$;`;
  return `
create extension pgcrypto;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(
  version text primary key,
  name text not null,
  statements text[] not null default array[]::text[]
);
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create role ${roles.validator} nologin; create role ${roles.approver} nologin; create role ${roles.executor} nologin;
create role ${roles.validatorLogin} login; create role ${roles.approverLogin} login; create role ${roles.executorLogin} login;
grant ${roles.validator} to ${roles.validatorLogin} with set true;
grant ${roles.approver} to ${roles.approverLogin} with set true;
grant ${roles.executor} to ${roles.executorLogin} with set true;
create table public.retailers(id bigint primary key,name text not null,slug text not null,website text not null);
create table public.products(id bigint generated by default as identity primary key,name text,slug text,brand text,category text,gtin text,price numeric,image text,description text,servings integer,net_weight_g numeric,net_volume_ml numeric,serving_count_verified integer,serving_size_g numeric,serving_size_ml numeric,protein_per_serving_g numeric,creatine_per_serving_g numeric,unit_count integer,unit_type text,unit_pricing_verified boolean,nutrition_verified boolean,is_active boolean default true,merged_into_product_id bigint,merged_at timestamptz,product_format text);
create table public.product_variants(id bigint generated by default as identity primary key,product_id bigint,variant_key text,display_name text,flavour_code text,flavour_label text,size_value numeric,size_unit text,pack_count integer,product_format text,gtin text,nutrition_override jsonb default '{}'::jsonb,is_default boolean default false,is_active boolean default true);
create table public.retailer_products(id bigint generated by default as identity primary key,retailer_id bigint,product_id bigint,product_variant_id bigint,external_product_id text,external_variant_id text,external_sku text,external_gtin text,external_url text,external_options jsonb,external_name text,external_slug text,match_method text,match_confidence numeric,updated_at timestamptz default now());
create table public.offers(id bigint generated by default as identity primary key,retailer_id bigint,product_id bigint,product_variant_id bigint,retailer_product_id bigint,price numeric,shipping_cost numeric,total_price numeric,in_stock boolean,url text,last_checked_at timestamptz);
create table public.price_history(id bigint generated by default as identity primary key,offer_id bigint,price numeric,shipping_cost numeric,total_price numeric,in_stock boolean,checked_at timestamptz);
create table public.approved_import_plans(id uuid primary key default gen_random_uuid(),artifact_sha256 text,run_id text,plan_fingerprint text,source_row_fingerprint text,plan_kind text,retailer_id bigint,created_at timestamptz default now(),expires_at timestamptz,status text default 'approved',consumed_at timestamptz,source text,plan_json jsonb,identity_observation_result jsonb${executionResult});
insert into public.retailers values(12,'Example Nutrition','example-nutrition','https://example.test');
insert into public.products(id,name,slug,brand,category,gtin,is_active,merged_into_product_id,product_format)
values(100,'Existing Protein','existing-protein','Example Nutrition','Whey Protein',null,true,null,'powder');
insert into public.product_variants(id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_default,is_active)
values(200,100,'cherry-and-apple-875g','Cherry & Apple / 875g','cherry and apple','Cherry & Apple',875,'g',1,'powder',false,true);
create function public.atomic_import_canonical_json(p_value jsonb)
returns text
language plpgsql
immutable
strict
set search_path=pg_catalog
as $canonical_json$
declare
  v_result text;
begin
  case jsonb_typeof(p_value)
    when 'object' then
      select '{' || coalesce(string_agg(
        to_jsonb(entry.key)::text || ':' || public.atomic_import_canonical_json(entry.value),
        ',' order by entry.key
      ), '') || '}'
      into v_result
      from jsonb_each(p_value) as entry;
    when 'array' then
      select '[' || coalesce(string_agg(
        public.atomic_import_canonical_json(entry.value),
        ',' order by entry.ordinality
      ), '') || ']'
      into v_result
      from jsonb_array_elements(p_value) with ordinality as entry(value, ordinality);
    else
      v_result := p_value::text;
  end case;
  return v_result;
end;
$canonical_json$;
create function public.atomic_import_has_exact_keys(p_value jsonb,p_keys text[]) returns boolean language sql immutable as $$select jsonb_typeof(p_value)='object' and (select array_agg(key order by key) from jsonb_object_keys(p_value) key)=(select array_agg(key order by key) from unnest(p_keys) key)$$;
create function public.atomic_import_is_decimal_string(p_value text) returns boolean language sql immutable as $$select p_value ~ '^(0|[1-9][0-9]*)(\\.[0-9]+)?$'$$;
create function public.atomic_import_normalized_identity(p_value text) returns text language sql immutable as $$select lower(regexp_replace(btrim(coalesce(p_value,'')),'[^a-zA-Z0-9]+','','g'))$$;
create function public.atomic_import_normalize_product_format(p_value text) returns text language sql immutable as $$select lower(replace(btrim(coalesce(p_value,'')),'_',' '))$$;
create function public.atomic_import_normalize_size(p_value text)
returns jsonb language plpgsql immutable strict set search_path=pg_catalog as $$
declare m text[]; amount numeric; unit text;
begin
  m:=regexp_match(lower(trim(p_value)),'^([0-9]+([.,][0-9]+)?)[[:space:]]*(kg|g|mg|mcg|iu|l|ml|serving|servings|serve|serves)$');
  if m is null then return null; end if;
  amount:=replace(m[1],',','.')::numeric; unit:=m[3];
  if amount<=0 then return null; end if;
  return case unit
    when 'kg' then jsonb_build_object('value',amount*1000,'unit','g','dimension','mass')
    when 'mg' then jsonb_build_object('value',amount/1000,'unit','g','dimension','mass')
    when 'mcg' then jsonb_build_object('value',amount/1000000,'unit','g','dimension','mass')
    when 'l' then jsonb_build_object('value',amount*1000,'unit','ml','dimension','volume')
    when 'ml' then jsonb_build_object('value',amount,'unit','ml','dimension','volume')
    when 'iu' then jsonb_build_object('value',amount,'unit','iu','dimension','potency')
    when 'serving' then jsonb_build_object('value',amount,'unit','servings','dimension','count')
    when 'servings' then jsonb_build_object('value',amount,'unit','servings','dimension','count')
    when 'serve' then jsonb_build_object('value',amount,'unit','servings','dimension','count')
    when 'serves' then jsonb_build_object('value',amount,'unit','servings','dimension','count')
    else jsonb_build_object('value',amount,'unit','g','dimension','mass')
  end;
end$$;
create function public.atomic_import_is_legacy_mapping_upgrade(p_plan jsonb) returns boolean language sql immutable as $$select false$$;
create function public.atomic_import_is_simply_identity_only_upgrade(p_plan jsonb) returns boolean language sql immutable as $$select false$$;
create function public.atomic_import_safe_create_category_allowed(p_category text,p_name text,p_format text) returns boolean language sql immutable as $$select true$$;
create function public.atomic_import_reviewed_parent_variant_allowed(
  p_name text,p_brand text,p_category text,p_format text,p_size_value text,p_size_unit text
) returns boolean language sql immutable set search_path=pg_catalog,public,pg_temp as $$
  select p_name='CNP Premium Whey 2kg' and p_brand='CNP' and p_category='Whey Protein'
    and p_format='powder' and p_size_value::numeric=2000 and lower(p_size_unit)='g'
$$;
create function public.atomic_import_predators_v3_parent_variant_transport_allowed(jsonb,jsonb) returns boolean language sql immutable as $$select false$$;
create function public.atomic_import_10reps_v8_parent_variant_transport_allowed(jsonb,jsonb) returns boolean language sql immutable as $$select false$$;
create function public.atomic_import_10reps_v9_parent_variant_transport_allowed(jsonb,jsonb) returns boolean language sql immutable as $$select false$$;
create function public.atomic_import_10reps_v10_parent_variant_transport_allowed(jsonb,jsonb) returns boolean language sql immutable as $$select false$$;
create function public.atomic_import_validate_variant_plan_core(p_plan jsonb) returns jsonb language sql stable as $$select jsonb_build_object('valid',true,'path','fixture-variant-core')$$;
create function public.apply_verified_offer_no_change_plan(p_plan jsonb) returns jsonb language plpgsql volatile as $$begin raise exception 'fixture no-change path not expected'; end$$;
create function public.retailer_catalogue_actual_database_target() returns jsonb language sql stable security definer as $$select '{"target_environment":"${environment}","project_ref":"${target.projectRef}"}'::jsonb$$;
${target.hasV1 ? productionValidator : stagingValidator}
revoke all on function public.validate_product_import_plan_read_only(jsonb) from public,anon,authenticated,service_role,${roles.validator},${roles.approver},${roles.executor};
grant execute on function public.validate_product_import_plan_read_only(jsonb) to ${roleNames(environment).validator};
create function public.fixture_capture_validator_error(p_plan jsonb) returns jsonb language plpgsql volatile as $$
begin
  perform public.validate_product_import_plan_read_only(p_plan);
  return jsonb_build_object('accepted',true);
exception when others then
  return jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm);
end$$;
create function public.fixture_capture_standard_apply_error(p_plan jsonb) returns jsonb language plpgsql volatile as $$
begin
  perform public.atomic_import_apply_standard_plan_core(p_plan);
  return jsonb_build_object('accepted',true);
exception when others then
  return jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm);
end$$;
create function public.atomic_import_fixture_apply_core(p_plan jsonb) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $core$
declare
  v_validation jsonb;
  v_product_id bigint;
  v_variant_id bigint;
  v_mapping_id bigint;
  v_offer_id bigint;
  v_history_id bigint;
begin
  v_validation:=public.validate_product_import_plan_read_only(p_plan);
  if v_validation->>'contract_kind' is distinct from 'reviewed-catalogue-package-v3' then
    raise exception 'fixture public validator did not authorize V3 before DML';
  end if;
  if p_plan#>>'{product,action}'='existing' then
    v_product_id:=(p_plan#>>'{product,id}')::bigint;
  else
    insert into public.products(name,slug,brand,category,gtin,product_format)
    values(p_plan#>>'{product,values,name}',p_plan#>>'{product,values,slug}',p_plan#>>'{product,values,brand}',p_plan#>>'{product,values,category}',null,p_plan#>>'{product,values,product_format}')
    returning id into v_product_id;
  end if;
  if p_plan#>>'{product_variant,action}'='existing' then
    v_variant_id:=(p_plan#>>'{product_variant,id}')::bigint;
  elsif p_plan#>>'{product_variant,action}'='create_default' then
    insert into public.product_variants(product_id,variant_key,display_name,product_format,is_default,is_active)
    values(v_product_id,'default','Default',p_plan#>>'{product_variant,evidence,product_format}',true,true)
    returning id into v_variant_id;
  else
    insert into public.product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_default,is_active)
    values(v_product_id,p_plan#>>'{product_variant,values,variant_key}',p_plan#>>'{product_variant,values,display_name}',p_plan#>>'{product_variant,values,flavour_code}',p_plan#>>'{product_variant,values,flavour_label}',(p_plan#>>'{product_variant,values,size_value}')::numeric,p_plan#>>'{product_variant,values,size_unit}',(p_plan#>>'{product_variant,values,pack_count}')::integer,p_plan#>>'{product_variant,values,product_format}',false,true)
    returning id into v_variant_id;
  end if;
  insert into public.retailer_products(retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_sku,external_gtin,external_url,external_options,external_name,external_slug,match_method,match_confidence)
  values((p_plan#>>'{retailer,id}')::bigint,v_product_id,v_variant_id,p_plan#>>'{retailer_product,values,external_product_id}',p_plan#>>'{retailer_product,values,external_variant_id}',p_plan#>>'{retailer_product,values,external_sku}',p_plan#>>'{retailer_product,values,external_gtin}',p_plan#>>'{retailer_product,values,external_url}',p_plan#>'{retailer_product,values,external_options}',p_plan#>>'{retailer_product,values,external_name}',p_plan#>>'{retailer_product,values,external_slug}',p_plan#>>'{retailer_product,values,match_method}',(p_plan#>>'{retailer_product,values,match_confidence}')::numeric)
  returning id into v_mapping_id;
  insert into public.offers(retailer_id,product_id,product_variant_id,retailer_product_id,price,shipping_cost,total_price,in_stock,url,last_checked_at)
  values((p_plan#>>'{retailer,id}')::bigint,v_product_id,v_variant_id,v_mapping_id,(p_plan#>>'{offer,values,price}')::numeric,(p_plan#>>'{offer,values,shipping_cost}')::numeric,(p_plan#>>'{offer,values,total_price}')::numeric,(p_plan#>>'{offer,values,in_stock}')::boolean,p_plan#>>'{offer,values,url}',(p_plan#>>'{offer,values,last_checked_at}')::timestamptz)
  returning id into v_offer_id;
  insert into public.price_history(offer_id,price,shipping_cost,total_price,in_stock,checked_at)
  values(v_offer_id,(p_plan#>>'{offer,values,price}')::numeric,(p_plan#>>'{offer,values,shipping_cost}')::numeric,(p_plan#>>'{offer,values,total_price}')::numeric,(p_plan#>>'{offer,values,in_stock}')::boolean,(p_plan#>>'{offer,values,last_checked_at}')::timestamptz)
  returning id into v_history_id;
  return jsonb_build_object('product_id',v_product_id::text,'product_variant_id',v_variant_id::text,'retailer_product_id',v_mapping_id::text,'offer_id',v_offer_id::text,'price_history_id',v_history_id::text);
end
$core$;
create function public.apply_product_import_plan(p_plan jsonb) returns jsonb language sql volatile security definer set search_path=pg_catalog,public,pg_temp as $$select public.atomic_import_fixture_apply_core(p_plan)$$;
create function public.apply_approved_product_import_plan(p_approval_id uuid,p_artifact text,p_fingerprint text,p_source_fingerprint text,p_retailer bigint,p_kind text,p_run text)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $approved$
declare
  a public.approved_import_plans%rowtype;
  result jsonb;
  consumed timestamptz;
begin
  select * into a from public.approved_import_plans where id=p_approval_id for update;
  if not found or a.status<>'approved' or a.consumed_at is not null or a.expires_at<=now()
     or a.artifact_sha256 is distinct from p_artifact or a.plan_fingerprint is distinct from p_fingerprint
     or a.source_row_fingerprint is distinct from p_source_fingerprint or a.retailer_id is distinct from p_retailer
     or a.plan_kind is distinct from p_kind or a.run_id is distinct from p_run then
    raise exception 'fixture approved plan mismatch';
  end if;
  result:=public.apply_product_import_plan(a.plan_json);
  consumed:=now();
  result:=result||jsonb_build_object('approval_status','consumed','consumed_at',consumed,'artifact_sha256',a.artifact_sha256,'plan_fingerprint',a.plan_fingerprint,'source_row_fingerprint',a.source_row_fingerprint,'retailer_id',a.retailer_id::text,'plan_kind',a.plan_kind,'run_id',a.run_id);
  update public.approved_import_plans set status='consumed',consumed_at=consumed,execution_result=result where id=a.id;
  return result;
end
$approved$;
revoke all on all tables in schema public from anon,authenticated,service_role,${roles.validator},${roles.approver},${roles.executor};
`;
}

function productValues(suffix) {
  return {
    name: `Example Protein ${suffix}`, slug: `example-protein-${suffix}`, brand: "Example Nutrition",
    category: "Whey Protein", price: "29.99", image: null, description: "Formula description",
    servings: "35", net_weight_g: "875", net_volume_ml: null, serving_count_verified: null,
    serving_size_g: null, serving_size_ml: null, protein_per_serving_g: null,
    creatine_per_serving_g: null, unit_count: null, unit_type: null, product_format: "powder",
    unit_pricing_verified: false, nutrition_verified: false, gtin: null,
  };
}

function actionFixture(environment, action, index) {
  const target = TARGETS[environment];
  const externalProductId = `${7462538510000 + index}`;
  const externalVariantId = `${41660010360000 + index}`;
  const defaultVariant = action === "create_product_with_default_variant";
  const newProduct = defaultVariant || action === "create_product_with_variant";
  const newVariant = action === "create_product_with_variant" || action === "create_variant_on_existing_product";
  const flavour = action === "map_existing_variant" ? "Cherry & Apple" : `Flavour ${index}`;
  const externalOptions = defaultVariant
    ? { Size: "60 Servings" }
    : { Flavour: flavour, Size: "35 Servings", Weight: "875g" };
  const plan = {
    meta: {
      version: "2", plan_kind: "feed", operation_type: "standard_import",
      source_row_fingerprint: crypto.createHash("sha256").update(`${environment}-${action}-${index}`).digest("hex"),
      plan_fingerprint: null,
    },
    retailer: { action: "existing", id: "12" },
    product: newProduct
      ? { action: defaultVariant ? "create" : "create_or_reuse_reviewed", values: productValues(index) }
      : { action: "existing", id: "100" },
    product_variant: defaultVariant
      ? { action: "create_default", evidence: {
        flavour: null, size_value: null, size_unit: null, pack_count: "1",
        product_format: "powder", external_options: externalOptions, approved_mapping_id: null,
        unit_count: "60", unit_type: "servings",
      } }
      : newVariant
        ? { action: action === "create_product_with_variant" ? "create_reviewed_variant" : "create_variant", values: {
          variant_key: `flavour-${index}-875g`, display_name: `Flavour ${index} / 875g`,
          flavour_code: `flavour-${index}`, flavour_label: `Flavour ${index}`, size_value: "875",
          size_unit: "g", pack_count: "1", product_format: "powder",
        }, ...(action === "create_product_with_variant" ? { evidence: {
          flavour, size_value: "875", size_unit: "g", pack_count: "1",
          product_format: "powder", external_options: externalOptions, approved_mapping_id: null,
        } } : {}) }
        : { action: "existing", id: "200", evidence: {
          flavour: "cherry and apple", size_value: "875", size_unit: "g", pack_count: "1",
          product_format: "powder", external_options: externalOptions, approved_mapping_id: null,
        } },
    retailer_product: { action: "create", values: {
      product_variant_id: newProduct || newVariant ? null : "200", external_product_id: externalProductId,
      external_variant_id: externalVariantId, external_sku: null, external_gtin: null,
      external_url: `https://example.test/products/item-${index}?variant=${externalVariantId}`,
      external_options: externalOptions, external_name: `Example Item ${index}`,
      external_slug: `example-item-${index}`, match_method: "owner_reviewed", match_confidence: "100",
    } },
    offer: { action: "create", values: {
      price: "29.99", shipping_cost: "3.99", total_price: "33.98", in_stock: true,
      url: `https://affiliate.example/click/item-${index}`, last_checked_at: "2026-10-18T12:00:00.000Z",
    } },
    price_history: { action: "create" },
    expected_state: {
      retailer: { id: "12", name: "Example Nutrition", slug: "example-nutrition", website: "https://example.test" },
      product: newProduct ? null : { id: "100", name: "Existing Protein", is_active: true, merged_into_product_id: null, product_format: "powder" },
      product_variant: newProduct || newVariant ? null : {
        id: "200", product_id: "100", variant_key: "cherry-and-apple-875g", display_name: "Cherry & Apple / 875g",
        flavour_code: "cherry and apple", flavour_label: "Cherry & Apple", size_value: "875", size_unit: "g",
        pack_count: "1", product_format: "powder", is_default: false, is_active: true,
      },
      retailer_product: null, offer: null,
    },
    approval: newProduct ? {
      approved: true,
      approval_type: defaultVariant ? "safe_create" : "reviewed_parent_variant_safe_create",
      approved_category: "Whey Protein",
      source_row_fingerprint: null,
      canonical_name: `Example Protein ${index}`,
      has_variant_evidence: !defaultVariant,
      approval_fingerprint: null,
    } : { approved: false, approval_type: "none" },
  };
  if (newProduct) {
    plan.approval.source_row_fingerprint = plan.meta.source_row_fingerprint;
  }
  if (defaultVariant) {
    plan.product.values.servings = null;
    plan.product.values.net_weight_g = null;
    plan.product.values.unit_count = "60";
    plan.product.values.unit_type = "servings";
  }
  const envelope = {
    schema_version: 3, kind: "reviewed-catalogue-authorization-v3", source_platform: "shopify",
    target_environment: environment, target_project_ref: target.projectRef,
    retailer: { id: "12", name: "Example Nutrition", slug: "example-nutrition", website: "https://example.test" },
    profile_id: `batch-${index}`,
    manifest_sha256: crypto.createHash("sha256").update(`manifest-${environment}-${index}`).digest("hex"),
    artifact_sha256: crypto.createHash("sha256").update(`artifact-${environment}-${index}`).digest("hex"),
    run_id: `reviewed-v3-${environment.toLowerCase()}-${index}`, review_row: `${index}`,
    reviewed_action: action, external_product_id: externalProductId, external_variant_id: externalVariantId,
    direct_source_url: plan.retailer_product.values.external_url, affiliate_url: plan.offer.values.url,
    external_options: externalOptions,
    option_roles: defaultVariant
      ? {
        flavour: null, physical_size: null,
        count: { source_key: "Size", source_value: "60 Servings", count_value: "60", count_unit: "servings" },
      }
      : {
        flavour: { source_key: "Flavour", source_value: flavour },
        physical_size: { source_key: "Weight", source_value: "875g", size_value: "875", size_unit: "g" },
        count: { source_key: "Size", source_value: "35 Servings", count_value: "35", count_unit: "servings" },
      },
    source_structure: defaultVariant
      ? { product_variant_count: 1, meaningful_variant_axes: [] }
      : { product_variant_count: 12, meaningful_variant_axes: ["flavour"] },
    source_row_fingerprint: plan.meta.source_row_fingerprint, plan_fingerprint: null,
  };
  return { plan, envelope };
}

function canonicalEvidenceFixture(environment, index) {
  const fixture = actionFixture(environment, "create_product_with_variant", index);
  const externalProductId = "15640537334134";
  const externalVariantId = "57417961668982";
  fixture.envelope.external_product_id = externalProductId;
  fixture.envelope.external_variant_id = externalVariantId;
  fixture.plan.retailer_product.values.external_product_id = externalProductId;
  fixture.plan.retailer_product.values.external_variant_id = externalVariantId;
  fixture.plan.retailer_product.values.external_url = `https://example.test/products/kayow?variant=${externalVariantId}`;
  fixture.envelope.direct_source_url = fixture.plan.retailer_product.values.external_url;
  fixture.plan.product.values.name = "KAYOW Protein Butter Cups";
  fixture.plan.product.values.brand = "KAYOW";
  fixture.plan.approval.canonical_name = fixture.plan.product.values.name;
  const binding = {
    retailer_id: "12", external_product_id: externalProductId,
    external_variant_id: externalVariantId,
    source_row_fingerprint: fixture.envelope.source_row_fingerprint,
    brand: "KAYOW", product_identity: "KAYOW Protein Butter Cups",
    external_gtin: null, external_sku: null, package_authorized_at: "2026-10-25T12:00:00.000Z",
  };
  const identity = { brand: binding.brand, product_identity: binding.product_identity, external_gtin: null, external_sku: null, pack_configuration: "2 pieces x 22g" };
  const external = [
    { fact_id: "pieces", role: "piece_count", normalized_value: "2", unit: "pieces", evidence_source_type: "manufacturer_label", source_url: "https://manufacturer.example/item", captured_at: "2026-10-25T10:00:00.000Z", source_content_sha256: "b".repeat(64), identity_binding: identity },
    { fact_id: "piece-size", role: "physical_size", normalized_value: "22", unit: "g", evidence_source_type: "manufacturer_label", source_url: "https://manufacturer.example/item", captured_at: "2026-10-25T10:00:00.000Z", source_content_sha256: "b".repeat(64), identity_binding: identity },
    { fact_id: "packs", role: "pack_count", normalized_value: "12", unit: "packs", evidence_source_type: "manufacturer_label", source_url: "https://manufacturer.example/item", captured_at: "2026-10-25T10:00:00.000Z", source_content_sha256: "b".repeat(64), identity_binding: identity },
  ];
  const derived = { fact_id: "pack-size", role: "physical_size", formula_id: "multiply_exact_decimal_v1", operand_fact_ids: ["pieces", "piece-size"], normalized_value: "44", unit: "g", derivation_sha256: null };
  derived.derivation_sha256 = canonicalEvidenceSha256({ formula_id: derived.formula_id, ordered_operands: external.slice(0, 2).map(fact => ({ fact_id: fact.fact_id, normalized_value: fact.normalized_value, unit: fact.unit })), result: "44", unit: "g" });
  const total = { fact_id: "total", role: "total_content", formula_id: "multiply_exact_decimal_v1", operand_fact_ids: ["packs", "pack-size"], normalized_value: "528", unit: "g", derivation_sha256: null };
  total.derivation_sha256 = canonicalEvidenceSha256({ formula_id: total.formula_id, ordered_operands: [external[2], derived].map(fact => ({ fact_id: fact.fact_id, normalized_value: fact.normalized_value, unit: fact.unit })), result: "528", unit: "g" });
  const evidence = {
    contract_version: "1", binding,
    raw_source_facts: [
      { fact_id: "raw-pack-structure", role: "pack_structure", raw_value: "12 x Packs of 2 x 22g Cups", source_key: "Size", source_row_fingerprint: binding.source_row_fingerprint },
      { fact_id: "raw-weight", role: "physical_size", raw_value: "265g", source_key: "Weight", source_row_fingerprint: binding.source_row_fingerprint },
    ],
    external_evidence_facts: external, derived_facts: [derived, total],
    canonical_selected_facts: [
      { role: "physical_size", selected_fact_id: "pack-size", normalized_value: "44", unit: "g", evidence_review_decision: "ACCEPT_FOR_CANONICAL_IDENTITY" },
      { role: "pack_count", selected_fact_id: "packs", normalized_value: "12", unit: "packs", evidence_review_decision: "ACCEPT_FOR_CANONICAL_IDENTITY" },
    ],
    conflict_records: [{ raw_fact_id: "raw-weight", canonical_fact_id: "pack-size", classification: "UNEXPLAINED_CONFLICTING_METADATA", disposition: "PRESERVE_RAW_DO_NOT_USE_FOR_CANONICAL_IDENTITY" }],
    evidence_review_decision: { decision: "ACCEPT_EXACT_FACTS_FOR_CANONICAL_IDENTITY", reviewed_fact_ids: ["pack-size", "packs"], reviewed_by: "catalogue-evidence-reviewer:test", reviewed_at: "2026-10-25T11:00:00.000Z", decision_evidence_sha256: null },
  };
  evidence.evidence_review_decision.decision_evidence_sha256 = canonicalEvidenceSha256(evidence);
  fixture.plan.product_variant.values.size_value = "44";
  fixture.plan.product_variant.values.pack_count = "12";
  fixture.plan.product_variant.values.variant_key = `flavour-${index}-44g`;
  fixture.plan.product_variant.values.display_name = `Flavour ${index} / 44g`;
  fixture.plan.product_variant.evidence.size_value = "44";
  fixture.plan.product_variant.evidence.pack_count = "12";
  fixture.plan.product_variant.evidence.canonical_identity_evidence = evidence;
  fixture.plan.retailer_product.values.external_options = { Flavour: `Flavour ${index}`, Size: "12 x Packs of 2 x 22g Cups", Weight: "265g" };
  fixture.plan.product_variant.evidence.external_options = fixture.plan.retailer_product.values.external_options;
  fixture.envelope.external_options = fixture.plan.retailer_product.values.external_options;
  fixture.envelope.option_roles.physical_size = { source_key: "Weight", source_value: "265g", size_value: "265", size_unit: "g" };
  fixture.envelope.option_roles.count = null;
  fixture.envelope.source_structure = { product_variant_count: 5, meaningful_variant_axes: ["flavour"] };
  fixture.envelope.canonical_identity_evidence = evidence;
  return fixture;
}

function canonicalCountEvidenceFixture(environment, index) {
  const fixture = actionFixture(environment, "create_product_with_default_variant", index);
  const externalProductId = "7500539297837";
  const externalVariantId = "41706864803885";
  fixture.envelope.external_product_id = externalProductId;
  fixture.envelope.external_variant_id = externalVariantId;
  fixture.plan.retailer_product.values.external_product_id = externalProductId;
  fixture.plan.retailer_product.values.external_variant_id = externalVariantId;
  fixture.plan.retailer_product.values.external_url = `https://example.test/products/tongkat?variant=${externalVariantId}`;
  fixture.envelope.direct_source_url = fixture.plan.retailer_product.values.external_url;
  fixture.plan.product.values.name = "TWP Tongkat Ali";
  fixture.plan.product.values.brand = "TWP";
  fixture.plan.approval.canonical_name = fixture.plan.product.values.name;
  fixture.plan.retailer_product.values.external_options = { Size: "60/30 Servings" };
  fixture.plan.product_variant.evidence.external_options = fixture.plan.retailer_product.values.external_options;
  fixture.envelope.external_options = fixture.plan.retailer_product.values.external_options;
  fixture.envelope.option_roles.count = { source_key: "Size", source_value: "60/30 Servings", count_value: "60/30", count_unit: "servings" };
  const binding = {
    retailer_id: "12", external_product_id: externalProductId,
    external_variant_id: externalVariantId,
    source_row_fingerprint: fixture.envelope.source_row_fingerprint,
    brand: "TWP", product_identity: "TWP Tongkat Ali",
    external_gtin: null, external_sku: null, package_authorized_at: "2026-10-25T12:00:00.000Z",
  };
  const evidence = {
    contract_version: "1", binding,
    raw_source_facts: [{ fact_id: "raw-servings", role: "serving_count", raw_value: "60/30 Servings", source_key: "Size", source_row_fingerprint: binding.source_row_fingerprint }],
    external_evidence_facts: [{
      fact_id: "manufacturer-count", role: "container_count", normalized_value: "60", unit: "capsules",
      evidence_source_type: "manufacturer_product_page", source_url: "https://manufacturer.example/item",
      captured_at: "2026-10-25T10:00:00.000Z", source_content_sha256: "c".repeat(64),
      identity_binding: { brand: binding.brand, product_identity: binding.product_identity, external_gtin: null, external_sku: null, pack_configuration: "60 capsules" },
    }],
    derived_facts: [],
    canonical_selected_facts: [{ role: "container_count", selected_fact_id: "manufacturer-count", normalized_value: "60", unit: "capsules", evidence_review_decision: "ACCEPT_FOR_CANONICAL_IDENTITY" }],
    conflict_records: [{ raw_fact_id: "raw-servings", canonical_fact_id: "manufacturer-count", classification: "SERVING_COUNT_NOT_CONTAINER_COUNT", disposition: "PRESERVE_RAW_DO_NOT_USE_FOR_CANONICAL_IDENTITY" }],
    evidence_review_decision: { decision: "ACCEPT_EXACT_FACTS_FOR_CANONICAL_IDENTITY", reviewed_fact_ids: ["manufacturer-count"], reviewed_by: "catalogue-evidence-reviewer:test", reviewed_at: "2026-10-25T11:00:00.000Z", decision_evidence_sha256: null },
  };
  evidence.evidence_review_decision.decision_evidence_sha256 = canonicalEvidenceSha256(evidence);
  fixture.plan.product.values.unit_count = "60";
  fixture.plan.product.values.unit_type = "capsules";
  fixture.plan.product_variant.evidence.unit_count = "60";
  fixture.plan.product_variant.evidence.unit_type = "capsules";
  fixture.plan.product_variant.evidence.canonical_identity_evidence = evidence;
  fixture.envelope.canonical_identity_evidence = evidence;
  return fixture;
}

function existingVariantFlavourAliasFixture(environment, index, rawFlavour, canonicalFlavour, sourceKey = "Flavour") {
  const fixture = actionFixture(environment, "map_existing_variant", index);
  const variantId = String(300 + index);
  const normalized = canonicalFlavour.toLowerCase().replaceAll("'", "").replace(/[^a-z0-9]+/g, " ").trim();
  const variantKey = normalized.replace(/\s+/g, "-") + "-875g";
  const externalOptions = { [sourceKey]: rawFlavour, Size: "35 Servings", Weight: "875g" };
  fixture.plan.product_variant.id = variantId;
  fixture.plan.product_variant.evidence = {
    flavour: normalized, size_value: "875", size_unit: "g", pack_count: "1",
    product_format: "powder", external_options: externalOptions, approved_mapping_id: null,
  };
  fixture.plan.retailer_product.values.product_variant_id = variantId;
  fixture.plan.retailer_product.values.external_options = externalOptions;
  fixture.plan.expected_state.product_variant = {
    id: variantId, product_id: "100", variant_key: variantKey,
    display_name: `${canonicalFlavour} / 875g`, flavour_code: normalized,
    flavour_label: canonicalFlavour, size_value: "875", size_unit: "g",
    pack_count: "1", product_format: "powder", is_default: false, is_active: true,
  };
  fixture.envelope.external_options = externalOptions;
  fixture.envelope.option_roles.flavour = { source_key: sourceKey, source_value: rawFlavour };
  return { ...fixture, variantId, variantKey, canonicalFlavour };
}

function existingVariantEvidenceParityFixture(environment, index, {
  flavour,
  productId,
  productName,
  variantId,
  productFormat,
  externalOptions,
  physicalRole,
  countRole,
  expectedSizeValue,
  expectedSizeUnit,
  originalSizeValue,
  originalSizeUnit,
} = {}) {
  const fixture = actionFixture(environment, "map_existing_variant", index);
  const flavourCode = flavour.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  fixture.plan.product.id = String(productId);
  fixture.plan.product_variant.id = String(variantId);
  fixture.plan.product_variant.evidence = {
    flavour: flavourCode,
    size_value: originalSizeValue,
    size_unit: originalSizeUnit,
    pack_count: "1",
    product_format: productFormat,
    external_options: externalOptions,
    approved_mapping_id: null,
  };
  fixture.plan.retailer_product.values.product_variant_id = String(variantId);
  fixture.plan.retailer_product.values.external_options = externalOptions;
  fixture.plan.expected_state.product = {
    id: String(productId), name: productName, is_active: true,
    merged_into_product_id: null, product_format: productFormat,
  };
  fixture.plan.expected_state.product_variant = {
    id: String(variantId), product_id: String(productId),
    variant_key: `${flavourCode}-${expectedSizeValue}${expectedSizeUnit}`,
    display_name: `${flavour} / ${expectedSizeValue}${expectedSizeUnit}`,
    flavour_code: flavourCode, flavour_label: flavour,
    size_value: expectedSizeValue, size_unit: expectedSizeUnit,
    pack_count: "1", product_format: productFormat, is_default: false, is_active: true,
  };
  fixture.envelope.external_options = externalOptions;
  fixture.envelope.option_roles = {
    flavour: { source_key: "Flavour", source_value: flavour },
    physical_size: physicalRole,
    count: countRole,
  };
  return fixture;
}

function reviewedCreateFlavourFixture(environment, index, sourceKey, sourceValue) {
  const fixture = actionFixture(environment, "create_product_with_variant", index);
  const normalized = sourceValue.toLowerCase().replaceAll("'", "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const externalOptions = { [sourceKey]: sourceValue, Size: "30 Servings", Weight: "390g" };
  fixture.plan.product.values.servings = "30";
  fixture.plan.product.values.net_weight_g = "390";
  fixture.plan.product_variant.values = {
    variant_key: `${normalized}-390g`, display_name: `${sourceValue} / 390g`,
    flavour_code: normalized, flavour_label: sourceValue, size_value: "390",
    size_unit: "g", pack_count: "1", product_format: "powder",
  };
  fixture.plan.product_variant.evidence = {
    flavour: normalized, size_value: "390", size_unit: "g", pack_count: "1",
    product_format: "powder", external_options: externalOptions, approved_mapping_id: null,
  };
  fixture.plan.retailer_product.values.external_options = externalOptions;
  fixture.envelope.external_options = externalOptions;
  fixture.envelope.option_roles = {
    flavour: { source_key: sourceKey, source_value: sourceValue },
    physical_size: { source_key: "Weight", source_value: "390g", size_value: "390", size_unit: "g" },
    count: { source_key: "Size", source_value: "30 Servings", count_value: "30", count_unit: "servings" },
  };
  return fixture;
}

function reviewedLiquidParentFixture(environment, index) {
  const fixture = actionFixture(environment, "create_product_with_variant", index);
  const externalOptions = { Flavour: "Watermelon Grape", Size: "473ml" };
  fixture.plan.product.values = {
    ...fixture.plan.product.values,
    name: `Example Energy Drink ${index}`,
    slug: `example-energy-drink-${index}`,
    brand: "Example Energy",
    category: "Energy Drinks",
    description: "Carbonated energy drink",
    servings: null,
    net_weight_g: null,
    net_volume_ml: null,
    product_format: "liquid",
  };
  fixture.plan.product_variant.values = {
    variant_key: "watermelon-grape-473ml",
    display_name: "Watermelon Grape / 473ml",
    flavour_code: "watermelon-grape",
    flavour_label: "Watermelon Grape",
    size_value: "473",
    size_unit: "ml",
    pack_count: "1",
    product_format: "liquid",
  };
  fixture.plan.product_variant.evidence = {
    flavour: "watermelon-grape",
    size_value: "473",
    size_unit: "ml",
    pack_count: "1",
    product_format: "liquid",
    external_options: externalOptions,
    approved_mapping_id: null,
  };
  fixture.plan.retailer_product.values.external_options = externalOptions;
  fixture.plan.approval.approved_category = "Energy Drinks";
  fixture.plan.approval.canonical_name = fixture.plan.product.values.name;
  fixture.envelope.external_options = externalOptions;
  fixture.envelope.option_roles = {
    flavour: { source_key: "Flavour", source_value: "Watermelon Grape" },
    physical_size: {
      source_key: "Size", source_value: "473ml", size_value: "473", size_unit: "ml",
    },
    count: null,
  };
  fixture.envelope.source_structure = {
    product_variant_count: 4,
    meaningful_variant_axes: ["flavour"],
  };
  return fixture;
}

function compositeCreationFixture(environment, action, index) {
  assert.ok([
    "create_product_with_variant",
    "create_variant_on_existing_product",
  ].includes(action));
  const fixture = action === "create_product_with_variant"
    ? reviewedLiquidParentFixture(environment, index)
    : actionFixture(environment, action, index);
  const flavour = `Example Apple ${index}`;
  const flavourCode = flavour.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const externalOptions = { Flavour: flavour, Size: "1 Serving (355ml)" };

  if (action === "create_product_with_variant") {
    fixture.plan.product.values = {
      ...fixture.plan.product.values,
      name: `Example Composite Energy Drink ${index}`,
      slug: `example-composite-energy-drink-${index}`,
      brand: "Example Nutrition",
      category: "Energy Drinks",
      servings: null,
      net_weight_g: null,
      net_volume_ml: null,
      product_format: "liquid",
    };
    fixture.plan.approval.approved_category = "Energy Drinks";
    fixture.plan.approval.canonical_name = fixture.plan.product.values.name;
  } else {
    fixture.plan.product.id = "101";
    fixture.plan.expected_state.product = {
      id: "101", name: "Evidence Product 101", is_active: true,
      merged_into_product_id: null, product_format: "liquid",
    };
  }
  fixture.plan.product_variant.values = {
    variant_key: `${flavourCode}-355ml`,
    display_name: `${flavour} / 355ml`,
    flavour_code: flavourCode,
    flavour_label: flavour,
    size_value: "355",
    size_unit: "ml",
    pack_count: "1",
    product_format: "liquid",
  };
  fixture.plan.product_variant.evidence = {
    flavour: flavourCode,
    size_value: "355",
    size_unit: "ml",
    pack_count: "1",
    product_format: "liquid",
    external_options: externalOptions,
    approved_mapping_id: null,
  };
  fixture.plan.retailer_product.values.external_options = externalOptions;
  fixture.envelope.external_options = externalOptions;
  fixture.envelope.option_roles = {
    flavour: { source_key: "Flavour", source_value: flavour },
    physical_size: {
      source_key: "Size", source_value: "1 Serving (355ml)",
      size_value: "355", size_unit: "ml",
    },
    count: {
      source_key: "Size", source_value: "1 Serving (355ml)",
      count_value: "1", count_unit: "servings",
    },
  };
  fixture.envelope.source_structure = {
    product_variant_count: 4,
    meaningful_variant_axes: ["flavour"],
  };
  return fixture;
}

function roleAwareLegacySizeFixture(environment, index, {
  flavour,
  rawSize,
  physicalKey = "Weight",
  physicalValue,
  sizeValue,
  sizeUnit = "g",
  count = null,
} = {}) {
  const fixture = actionFixture(environment, "create_product_with_variant", index);
  const normalized = flavour.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const externalOptions = { Flavour: flavour, Size: rawSize };
  if (physicalKey !== "Size") externalOptions[physicalKey] = physicalValue;
  fixture.plan.product.values.net_weight_g = sizeUnit === "g" ? sizeValue : null;
  fixture.plan.product.values.servings = null;
  fixture.plan.product_variant.values = {
    variant_key: `${normalized}-${sizeValue}${sizeUnit}`,
    display_name: `${flavour} / ${rawSize} / ${physicalValue}`,
    flavour_code: normalized,
    flavour_label: flavour,
    size_value: sizeValue,
    size_unit: sizeUnit,
    pack_count: "1",
    product_format: "powder",
  };
  fixture.plan.product_variant.evidence = {
    flavour: normalized,
    size_value: sizeValue,
    size_unit: sizeUnit,
    pack_count: "1",
    product_format: "powder",
    external_options: externalOptions,
    approved_mapping_id: null,
  };
  fixture.plan.retailer_product.values.external_options = externalOptions;
  fixture.envelope.external_options = externalOptions;
  fixture.envelope.option_roles = {
    flavour: { source_key: "Flavour", source_value: flavour },
    physical_size: {
      source_key: physicalKey,
      source_value: physicalValue,
      size_value: sizeValue,
      size_unit: sizeUnit,
    },
    count,
  };
  return fixture;
}

function seal(container, fixture, label) {
  if (Object.hasOwn(fixture.plan.approval, "approval_fingerprint")) {
    fixture.plan.approval.approval_fingerprint = scalar(
      container,
      `select md5(public.atomic_import_canonical_json(jsonb_set(${literal(fixture.plan.approval)},'{approval_fingerprint}','null'::jsonb,false)))`,
      `${label} safe-create approval fingerprint`,
    );
  }
  fixture.plan.meta.plan_fingerprint = scalar(
    container,
    `select md5(public.atomic_import_canonical_json(jsonb_set(${literal(fixture.plan)},'{meta,plan_fingerprint}','null'::jsonb,false)))`,
    `${label} plan fingerprint`,
  );
  fixture.envelope.plan_fingerprint = fixture.plan.meta.plan_fingerprint;
  return fixture;
}

function counts(container, label) {
  return json(container, `select jsonb_build_object(
    'products',(select count(*) from products),
    'product_variants',(select count(*) from product_variants),
    'retailer_products',(select count(*) from retailer_products),
    'offers',(select count(*) from offers),
    'price_history',(select count(*) from price_history)
  )`, label);
}

function succeedWithoutBusinessChange(container, name, label) {
  const before = counts(container, `${label} counts before`);
  succeed(file(container, name), label);
  assert.deepEqual(counts(container, `${label} counts after`), before, `${label} changed business rows`);
}

function functionDefinition(container, signature, label) {
  return scalar(container, `select pg_get_functiondef('${signature}'::regprocedure)`, label);
}

function functionSha(container, signature, label) {
  return scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
    '${signature}'::regprocedure
  ),'UTF8')),'hex')`, label);
}

function tamperedDefinition(definition) {
  const marker = definition.match(/\nAS (\$[^$]*\$)\n/i);
  assert.ok(marker, "function definition has a dollar-quoted body");
  return definition.replace(marker[0], `${marker[0]}-- rollback-lineage-tamper\n`);
}

function boundaryStateDigest(container, label) {
  return scalar(container, `select md5(jsonb_build_object(
    'functions',(select jsonb_agg(jsonb_build_object(
      'signature',p.oid::regprocedure::text,
      'sha256',encode(pg_catalog.sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),
      'owner',p.proowner::regrole::text,'volatility',p.provolatile,
      'security_definer',p.prosecdef,'config',p.proconfig,
      'acl',(select coalesce(jsonb_agg(jsonb_build_object(
        'grantor',acl.grantor::regrole::text,'grantee',case when acl.grantee=0 then 'PUBLIC' else acl.grantee::regrole::text end,
        'privilege',acl.privilege_type,'grantable',acl.is_grantable
      ) order by acl.grantee,acl.privilege_type,acl.is_grantable),'[]'::jsonb)
        from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl)
    ) order by p.oid::regprocedure::text) from pg_proc p where p.oid in (
      ${BOUNDARY_FUNCTIONS.map(signature => `'${signature}'::regprocedure`).join(",\n      ")}
    )),
    'columns',(select jsonb_agg(jsonb_build_object(
      'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
      'default',pg_get_expr(d.adbin,d.adrelid)
    ) order by a.attname) from pg_attribute a left join pg_attrdef d
      on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid='public.approved_import_plans'::regclass and not a.attisdropped
        and a.attname in ('authorization_envelope','execution_result')),
    'constraints',(select jsonb_agg(jsonb_build_object(
      'name',c.conname,'definition',pg_get_constraintdef(c.oid,true),'validated',c.convalidated,
      'deferrable',c.condeferrable,'deferred',c.condeferred
    ) order by c.conname) from pg_constraint c
      where c.conrelid='public.approved_import_plans'::regclass
        and c.conname in ('approved_import_plans_v3_envelope_check','approved_import_plans_v3_created_execution_result_check'))
  )::text)`, label);
}

function functionStateDigest(container, signature, label) {
  return scalar(container, `select md5(jsonb_build_object(
    'definition',pg_get_functiondef(p.oid),'owner',p.proowner::regrole::text,
    'volatility',p.provolatile,'security_definer',p.prosecdef,'config',p.proconfig,
    'acl',(select coalesce(jsonb_agg(jsonb_build_object(
      'grantor',acl.grantor::regrole::text,'grantee',case when acl.grantee=0 then 'PUBLIC' else acl.grantee::regrole::text end,
      'privilege',acl.privilege_type,'grantable',acl.is_grantable
    ) order by acl.grantee,acl.privilege_type,acl.is_grantable),'[]'::jsonb)
      from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl)
  )::text) from pg_proc p where p.oid='${signature}'::regprocedure`, label);
}

function publicFunctionAndApprovalSchemaState(container, label) {
  return json(container, `select jsonb_build_object(
    'functions',(select jsonb_agg(jsonb_build_object(
      'signature',p.oid::regprocedure::text,
      'sha256',encode(pg_catalog.sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),
      'owner',p.proowner::regrole::text,'volatility',p.provolatile,
      'security_definer',p.prosecdef,'config',p.proconfig,
      'acl',(select coalesce(jsonb_agg(jsonb_build_object(
        'grantor',acl.grantor::regrole::text,'grantee',case when acl.grantee=0 then 'PUBLIC' else acl.grantee::regrole::text end,
        'privilege',acl.privilege_type,'grantable',acl.is_grantable
      ) order by acl.grantee,acl.privilege_type,acl.is_grantable),'[]'::jsonb)
        from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl)
    ) order by p.oid::regprocedure::text)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
    'columns',(select jsonb_agg(jsonb_build_object(
      'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
      'default',pg_get_expr(d.adbin,d.adrelid)
    ) order by a.attnum) from pg_attribute a left join pg_attrdef d
      on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid='public.approved_import_plans'::regclass and a.attnum>0 and not a.attisdropped),
    'constraints',(select coalesce(jsonb_agg(jsonb_build_object(
      'name',c.conname,'definition',pg_get_constraintdef(c.oid,true),'validated',c.convalidated,
      'deferrable',c.condeferrable,'deferred',c.condeferred
    ) order by c.conname),'[]'::jsonb) from pg_constraint c
      where c.conrelid='public.approved_import_plans'::regclass)
  )`, label);
}

function columnMetadata(container, column, label) {
  const value = scalar(container, `select coalesce((
    select jsonb_build_object('data_type',data_type,'is_nullable',is_nullable,'column_default',column_default)::text
    from information_schema.columns
    where table_schema='public' and table_name='approved_import_plans' and column_name='${column}'
  ),'null')`, label);
  return JSON.parse(value);
}

function functionMetadata(container, signature, label) {
  return json(container, `select jsonb_build_object(
    'owner',p.proowner::regrole::text,
    'volatility',p.provolatile,
    'security_definer',p.prosecdef,
    'config',p.proconfig,
    'acl',p.proacl::text
  ) from pg_proc p where p.oid='${signature}'::regprocedure`, label);
}

function validatorMetadata(container, label) {
  return functionMetadata(container, "public.validate_product_import_plan_read_only(jsonb)", label);
}

function exerciseRequiredEnvironmentRoleGuards(container, environment) {
  const target = TARGETS[environment];
  const roles = roleNames(environment);
  const baselineCounts = counts(container, `${environment} required-role baseline counts`);
  const temporarilyMissing = (role, migration, pattern, label) => {
    const temporaryRole = `${role}_temporarily_missing`;
    succeed(sql(container, `alter role ${role} rename to ${temporaryRole}`), `${label} hide role`);
    try {
      fails(file(container, migration), `${label} fail closed`, pattern);
      assert.deepEqual(counts(container, `${label} counts`), baselineCounts);
    } finally {
      succeed(sql(container, `alter role ${temporaryRole} rename to ${role}`), `${label} restore role`);
    }
  };

  temporarilyMissing(
    roles.validator,
    target.boundedStateMigration,
    /required validator role is missing/i,
    `${environment} bounded-state missing validator`,
  );
  assert.equal(
    scalar(container, "select to_regprocedure('public.read_reviewed_catalogue_import_state(jsonb)') is null", `${environment} failed bounded-state install rolled back`),
    "t",
  );

  succeedWithoutBusinessChange(
    container,
    target.boundedStateMigration,
    `${environment} install bounded state for required-role guards`,
  );
  for (const [kind, role] of [["approver", roles.approver], ["executor", roles.executor]]) {
    temporarilyMissing(
      role,
      target.boundaryMigration,
      /required environment roles are missing/i,
      `${environment} boundary missing ${kind}`,
    );
    assert.equal(
      scalar(container, "select to_regprocedure('public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb)') is null", `${environment} failed boundary install rolled back for ${kind}`),
      "t",
    );
    assert.equal(
      scalar(container, "select count(*) from information_schema.columns where table_schema='public' and table_name='approved_import_plans' and column_name='authorization_envelope'", `${environment} failed boundary column rolled back for ${kind}`),
      "0",
    );
  }
  succeedWithoutBusinessChange(
    container,
    target.boundedStateRollback,
    `${environment} reset bounded state after required-role guards`,
  );
}

function exerciseBoundedStateRollbackGuards(container, environment) {
  const target = TARGETS[environment];
  const signature = "public.read_reviewed_catalogue_import_state(jsonb)";
  const baselineCounts = counts(container, `${environment} bounded-state baseline counts`);
  const assertExact = label => {
    assert.equal(functionSha(container, signature, `${label} SHA`), BOUNDED_STATE_SHA);
    assert.deepEqual(counts(container, `${label} counts`), baselineCounts);
  };
  const restore = label => {
    succeedWithoutBusinessChange(container, target.boundedStateMigration, label);
    assertExact(label);
  };
  const scenarios = [
    ["body", `create or replace function public.read_reviewed_catalogue_import_state(p_request jsonb)
      returns jsonb language sql stable security definer
      set search_path=pg_catalog,public,pg_temp as $$select '{}'::jsonb$$`],
    ["owner", `alter function ${signature} owner to anon`],
    ["volatility", `alter function ${signature} volatile`],
    ["security-definer", `alter function ${signature} security invoker`],
    ["search-path", `alter function ${signature} set search_path=public`],
    ["execute-privilege", `grant execute on function ${signature} to service_role`],
  ];

  restore(`${environment} install bounded state for rollback guards`);
  for (const [name, statement] of scenarios) {
    succeed(sql(container, statement), `${environment} bounded-state tamper ${name}`);
    const tamperedSha = functionSha(container, signature, `${environment} bounded-state tampered ${name} SHA`);
    if (name === "body") assert.notEqual(tamperedSha, BOUNDED_STATE_SHA);
    fails(
      file(container, target.boundedStateRollback),
      `${environment} bounded-state ${name} fail closed`,
      /bounded-state rollback lineage or metadata differs/i,
    );
    assert.equal(
      scalar(container, `select to_regprocedure('${signature}') is not null`, `${environment} bounded-state ${name} remains`),
      "t",
    );
    assert.deepEqual(counts(container, `${environment} bounded-state ${name} counts`), baselineCounts);
    restore(`${environment} restore bounded state after ${name}`);
  }

  succeedWithoutBusinessChange(container, target.boundedStateRollback, `${environment} bounded-state happy rollback`);
  assert.equal(scalar(container, `select to_regprocedure('${signature}') is null`, `${environment} bounded-state removed`), "t");
  fails(
    file(container, target.boundedStateRollback),
    `${environment} bounded-state missing target fails closed`,
    /bounded-state rollback target is missing/i,
  );
  assert.deepEqual(counts(container, `${environment} bounded-state missing-target counts`), baselineCounts);
  restore(`${environment} reinstall bounded state for full chain`);
}

function exerciseBoundaryRollbackTamperGuards(container, environment) {
  const target = TARGETS[environment];
  const roles = roleNames(environment);
  const baseline = boundaryStateDigest(container, `${environment} boundary baseline digest`);
  const baselineCounts = counts(container, `${environment} boundary baseline counts`);
  const assertFailedRollbackPreserved = (label, pattern) => {
    const before = boundaryStateDigest(container, `${label} digest before`);
    fails(file(container, target.boundaryRollback), label, pattern);
    assert.equal(boundaryStateDigest(container, `${label} digest after`), before, `${label} changed schema`);
    assert.deepEqual(counts(container, `${label} counts after`), baselineCounts, `${label} changed business rows`);
  };
  const assertRestored = label => {
    assert.equal(boundaryStateDigest(container, label), baseline, `${label} did not restore exact boundary state`);
  };

  assert.equal(
    functionSha(container, "public.atomic_import_validate_product_before_reviewed_v3(jsonb)", `${environment} fallback boundary SHA`),
    target.postBoundaryFallbackSha,
  );

  for (const signature of BOUNDARY_FUNCTIONS) {
    const original = functionDefinition(container, signature, `${environment} capture ${signature}`);
    succeed(sql(container, tamperedDefinition(original)), `${environment} tamper definition ${signature}`);
    assertFailedRollbackPreserved(
      `${environment} boundary definition fail closed ${signature}`,
      /rollback lineage or metadata differs/i,
    );
    succeed(sql(container, original), `${environment} restore definition ${signature}`);
    assertRestored(`${environment} restored definition ${signature}`);
  }

  const internal = "public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb)";
  succeed(sql(container, `grant execute on function ${internal} to service_role`), `${environment} boundary ACL tamper`);
  assertFailedRollbackPreserved(`${environment} boundary ACL fail closed`, /rollback lineage or metadata differs/i);
  succeed(sql(container, `revoke execute on function ${internal} from service_role`), `${environment} restore boundary ACL`);
  assertRestored(`${environment} restored boundary ACL`);

  succeed(sql(container, `alter function ${internal} owner to anon`), `${environment} boundary owner tamper`);
  assertFailedRollbackPreserved(`${environment} boundary owner fail closed`, /rollback lineage or metadata differs/i);
  succeed(sql(container, `alter function ${internal} owner to postgres;
    revoke all on function ${internal} from public,anon,authenticated,service_role,
      ${roles.validator},${roles.approver},${roles.executor};
    grant execute on function ${internal} to postgres`), `${environment} restore boundary owner`);
  assertRestored(`${environment} restored boundary owner`);

  succeed(sql(container, `alter function ${internal} set search_path=public`), `${environment} boundary search_path tamper`);
  assertFailedRollbackPreserved(`${environment} boundary search_path fail closed`, /rollback lineage or metadata differs/i);
  succeed(sql(container, `alter function ${internal} set search_path=pg_catalog,public,pg_temp`), `${environment} restore boundary search_path`);
  assertRestored(`${environment} restored boundary search_path`);

  succeed(sql(container, "alter table public.approved_import_plans alter column authorization_envelope set default '{}'::jsonb"), `${environment} envelope metadata tamper`);
  assertFailedRollbackPreserved(`${environment} envelope metadata fail closed`, /authorization_envelope metadata differs/i);
  succeed(sql(container, "alter table public.approved_import_plans alter column authorization_envelope drop default"), `${environment} restore envelope metadata`);
  assertRestored(`${environment} restored envelope metadata`);

  succeed(sql(container, `alter table public.approved_import_plans drop constraint approved_import_plans_v3_envelope_check;
    alter table public.approved_import_plans add constraint approved_import_plans_v3_envelope_check check (
      authorization_envelope is null or jsonb_typeof(authorization_envelope)='object'
    )`), `${environment} envelope constraint tamper`);
  assertFailedRollbackPreserved(`${environment} envelope constraint fail closed`, /authorization envelope constraint differs/i);
  succeed(sql(container, `alter table public.approved_import_plans drop constraint approved_import_plans_v3_envelope_check;
    alter table public.approved_import_plans add constraint approved_import_plans_v3_envelope_check check (
      (source !~ '^reviewed-catalogue-package-v3:' and authorization_envelope is null)
      or (
        source ~ '^reviewed-catalogue-package-v3:[A-Za-z0-9._-]+:[0-9a-f]{64}:(STAGING|PRODUCTION):[a-z0-9]{20}$'
        and jsonb_typeof(authorization_envelope)='object'
        and authorization_envelope->>'kind'='reviewed-catalogue-authorization-v3'
      )
    )`), `${environment} restore envelope constraint`);
  assertRestored(`${environment} restored envelope constraint`);

  succeed(sql(container, "alter table public.approved_import_plans alter column execution_result set default '{}'::jsonb"), `${environment} execution_result metadata tamper`);
  assertFailedRollbackPreserved(`${environment} execution_result metadata fail closed`, /execution_result metadata differs/i);
  succeed(sql(container, "alter table public.approved_import_plans alter column execution_result drop default"), `${environment} restore execution_result metadata`);
  assertRestored(`${environment} restored execution_result metadata`);

  const evidenceSource = `reviewed-catalogue-package-v3:rollback-tamper:${"e".repeat(64)}:${environment}:${target.projectRef}`;
  succeed(sql(container, `insert into public.approved_import_plans(source,authorization_envelope)
    values('${evidenceSource}','{"kind":"reviewed-catalogue-authorization-v3"}'::jsonb)`), `${environment} seed durable rollback evidence`);
  assertFailedRollbackPreserved(`${environment} durable evidence fail closed`, /rollback blocked by durable approval evidence/i);
  assert.equal(scalar(container, `select count(*) from public.approved_import_plans where source='${evidenceSource}'`, `${environment} durable evidence retained`), "1");
  succeed(sql(container, `delete from public.approved_import_plans where source='${evidenceSource}'`), `${environment} remove disposable durable evidence`);
  assertRestored(`${environment} boundary state after evidence cleanup`);
}

function exerciseTrustedParentRollbackTamperGuards(container, environment) {
  const signature = "public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)";
  const target = TARGETS[environment];
  const roles = roleNames(environment);
  const baseline = functionStateDigest(container, signature, `${environment} trusted-parent baseline digest`);
  const baselineCounts = counts(container, `${environment} trusted-parent baseline counts`);
  const original = functionDefinition(container, signature, `${environment} trusted-parent original definition`);
  const assertFailedRollbackPreserved = label => {
    const before = functionStateDigest(container, signature, `${label} digest before`);
    fails(file(container, TRUSTED_PARENT_POLICY_ROLLBACK), label, /rollback lineage or metadata differs/i);
    assert.equal(functionStateDigest(container, signature, `${label} digest after`), before, `${label} changed validator`);
    assert.deepEqual(counts(container, `${label} counts after`), baselineCounts, `${label} changed business rows`);
  };
  const assertRestored = label => {
    assert.equal(functionStateDigest(container, signature, label), baseline, `${label} did not restore exact validator state`);
  };

  assert.equal(functionSha(container, signature, `${environment} trusted-parent post-migration SHA`), target.postTrustedParentSha);
  succeed(sql(container, tamperedDefinition(original)), `${environment} trusted-parent anchor-preserving body tamper`);
  assertFailedRollbackPreserved(`${environment} trusted-parent body SHA fail closed`);
  succeed(sql(container, original), `${environment} restore trusted-parent body`);
  assertRestored(`${environment} restored trusted-parent body`);

  succeed(sql(container, `alter function ${signature} owner to anon`), `${environment} trusted-parent owner tamper`);
  assertFailedRollbackPreserved(`${environment} trusted-parent owner fail closed`);
  succeed(sql(container, `alter function ${signature} owner to postgres;
    revoke all on function ${signature} from public,anon,authenticated,service_role,
      ${roles.validator},${roles.approver},${roles.executor};
    grant execute on function ${signature} to postgres`), `${environment} restore trusted-parent owner`);
  assertRestored(`${environment} restored trusted-parent owner`);

  succeed(sql(container, `grant execute on function ${signature} to service_role`), `${environment} trusted-parent ACL tamper`);
  assertFailedRollbackPreserved(`${environment} trusted-parent ACL fail closed`);
  succeed(sql(container, `revoke execute on function ${signature} from service_role`), `${environment} restore trusted-parent ACL`);
  assertRestored(`${environment} restored trusted-parent ACL`);

  succeed(sql(container, `alter function ${signature} set search_path=public`), `${environment} trusted-parent search_path tamper`);
  assertFailedRollbackPreserved(`${environment} trusted-parent search_path fail closed`);
  succeed(sql(container, `alter function ${signature} set search_path=pg_catalog,public,pg_temp`), `${environment} restore trusted-parent search_path`);
  assertRestored(`${environment} restored trusted-parent search_path`);
}

function exerciseBaseline(environment) {
  const target = TARGETS[environment];
  const roles = roleNames(environment);
  const container = `supplementscout-reviewed-v3-${environment.toLowerCase()}-${crypto.randomBytes(5).toString("hex")}`;
  try {
    succeed(run("docker", [
      "run", "--detach", "--rm", "--name", container, "--network", "none",
      "-e", `POSTGRES_PASSWORD=${PASSWORD}`, "-v", `${ROOT}:/workspace:ro`, IMAGE,
    ]), `${environment} start PostgreSQL`);
    wait(container);
    succeed(sql(container, setupSql(environment)), `${environment} prepare baseline`);
    const oppositeRoles = roleNames(environment === "STAGING" ? "PRODUCTION" : "STAGING");
    const roleInventory = json(container, `select jsonb_build_object(
      'validator',to_regrole('${roles.validator}') is not null,
      'approver',to_regrole('${roles.approver}') is not null,
      'executor',to_regrole('${roles.executor}') is not null,
      'opposite_validator',to_regrole('${oppositeRoles.validator}') is not null,
      'opposite_approver',to_regrole('${oppositeRoles.approver}') is not null,
      'opposite_executor',to_regrole('${oppositeRoles.executor}') is not null
    )`, `${environment} exact role inventory`);
    assert.deepEqual(roleInventory, {
      validator: true,
      approver: true,
      executor: true,
      opposite_validator: false,
      opposite_approver: false,
      opposite_executor: false,
    });
    succeed(fixtureFile(container, target.standardCoreFixture), `${environment} install exact live standard apply core`);
    succeed(fixtureFile(container, LIVE_APPLY_DISPATCH_FIXTURE), `${environment} install exact live apply dispatch cores`);
    succeed(sql(container, `
      alter function public.atomic_import_apply_standard_plan_core(jsonb) owner to postgres;
      revoke all on function public.atomic_import_apply_standard_plan_core(jsonb) from public,anon,authenticated,service_role,
        ${roles.validator},${roles.approver},${roles.executor};
      alter function public.atomic_import_apply_variant_plan_core(jsonb) owner to postgres;
      alter function public.atomic_import_apply_pre_source_metadata_plan_core(jsonb) owner to postgres;
      alter function public.apply_product_import_plan(jsonb) owner to postgres;
      revoke all on function public.atomic_import_apply_variant_plan_core(jsonb),
        public.atomic_import_apply_pre_source_metadata_plan_core(jsonb),public.apply_product_import_plan(jsonb)
        from public,anon,authenticated,service_role,
          ${roles.validator},${roles.approver},${roles.executor};
    `), `${environment} seal exact live apply dispatch cores`);
    const originalPreSourceValidatorDefinition = functionDefinition(
      container,
      "public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)",
      `${environment} original pre-source validator definition`,
    );
    const originalLineageState = publicFunctionAndApprovalSchemaState(container, `${environment} original lineage state`);
    exerciseRequiredEnvironmentRoleGuards(container, environment);
    exerciseBoundedStateRollbackGuards(container, environment);
    const standardCoreBefore = scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
      'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure
    ),'UTF8')),'hex')`, `${environment} exact standard apply SHA`);
    assert.equal(standardCoreBefore, target.standardCoreSha);
    const preSourceCoreBefore = scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
      'public.atomic_import_apply_pre_source_metadata_plan_core(jsonb)'::regprocedure
    ),'UTF8')),'hex')`, `${environment} exact pre-source apply SHA`);
    assert.equal(preSourceCoreBefore, target.preSourceCoreSha);

    const beforeValidatorSha = scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
      'public.validate_product_import_plan_read_only(jsonb)'::regprocedure
    ),'UTF8')),'hex')`, `${environment} pre-V3 validator SHA`);
    assert.equal(beforeValidatorSha, target.validatorSha, `${environment} exact reviewed lineage`);
    const beforeValidatorMetadata = validatorMetadata(container, `${environment} validator metadata before`);
    const beforeExecutionResult = columnMetadata(container, "execution_result", `${environment} execution_result before`);
    assert.equal(beforeExecutionResult === null, !target.hasExecutionResult);

    const ordinaryPlan = { meta: { operation_type: "ordinary" }, row: environment };
    const ordinaryBefore = scalar(
      container,
      `select public.validate_product_import_plan_read_only(${literal(ordinaryPlan)})::text`,
      `${environment} non-V3 before`,
    );
    const ordinaryErrorBefore = json(
      container,
      `select public.fixture_capture_validator_error('{"force_error":"1"}'::jsonb)`,
      `${environment} non-V3 error before`,
    );
    assert.deepEqual(ordinaryErrorBefore, { sqlstate: "22023", message: "FIXTURE_NON_V3_REJECT" });
    const legacyPlan = { meta: { operation_type: "standard_import" }, legacy: true, environment };
    let v1Before = null;
    let v1FunctionBefore = null;
    if (target.hasV1) {
      succeed(sql(container, `insert into public.approved_import_plans(
        artifact_sha256,run_id,plan_fingerprint,source_row_fingerprint,plan_kind,retailer_id,expires_at,source,plan_json
      ) values('${"a".repeat(64)}','legacy-run','${"b".repeat(32)}','${"c".repeat(64)}','feed',12,now()+interval '1 hour','reviewed-catalogue-package-v1:legacy:${"d".repeat(64)}',${literal(legacyPlan)})`), `${environment} seed V1 row`);
      v1Before = scalar(container, `select public.validate_product_import_plan_read_only(${literal(legacyPlan)})::text`, `${environment} V1 before`);
      assert.equal(JSON.parse(v1Before).path, "production-v1");
      v1FunctionBefore = scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
        'public.validate_reviewed_catalogue_import_plan(jsonb)'::regprocedure
      ),'UTF8')),'hex')`, `${environment} V1 function before`);
    } else {
      assert.equal(scalar(container, "select to_regprocedure('public.validate_reviewed_catalogue_import_plan(jsonb)') is null", `${environment} no V1`), "t");
    }

    const legacyDigestBefore = scalar(container, `select md5(coalesce(string_agg(
      concat_ws('|',id::text,artifact_sha256,run_id,plan_fingerprint,source_row_fingerprint,plan_kind,retailer_id::text,status,source,plan_json::text),
      E'\\n' order by id
    ),'')) from public.approved_import_plans`, `${environment} legacy digest before`);

    succeedWithoutBusinessChange(container, target.boundaryMigration, `${environment} apply corrected V3 migration`);
    exerciseBoundaryRollbackTamperGuards(container, environment);
    assert.equal(scalar(container, "select to_regprocedure('public.atomic_import_validate_product_before_reviewed_v3(jsonb)') is not null", `${environment} fallback exists`), "t");
    assert.equal(scalar(container, "select to_regprocedure('public.validate_product_import_plan_read_only(jsonb)') is not null", `${environment} wrapper exists`), "t");
    assert.equal(scalar(container, "select to_regprocedure('public.atomic_import_reviewed_catalogue_plan_allowed(jsonb)') is not null", `${environment} V1 presence unchanged`), target.hasV1 ? "t" : "f");
    assert.equal(scalar(container, `select public.validate_product_import_plan_read_only(${literal(ordinaryPlan)})::text`, `${environment} non-V3 after`), ordinaryBefore);
    assert.deepEqual(json(
      container,
      `select public.fixture_capture_validator_error('{"force_error":"1"}'::jsonb)`,
      `${environment} non-V3 error after`,
    ), ordinaryErrorBefore);
    assert.equal(scalar(container, `select md5(coalesce(string_agg(
      concat_ws('|',id::text,artifact_sha256,run_id,plan_fingerprint,source_row_fingerprint,plan_kind,retailer_id::text,status,source,plan_json::text),
      E'\\n' order by id
    ),'')) from public.approved_import_plans`, `${environment} legacy digest after`), legacyDigestBefore);

    const afterExecutionResult = columnMetadata(container, "execution_result", `${environment} execution_result after`);
    assert.deepEqual(afterExecutionResult, {
      data_type: "jsonb", is_nullable: "YES", column_default: null,
    });
    if (target.hasExecutionResult) assert.deepEqual(afterExecutionResult, beforeExecutionResult);
    else assert.equal(scalar(container, `select exists(select 1 from pg_constraint where conrelid='public.approved_import_plans'::regclass and conname='approved_import_plans_v3_created_execution_result_check')`, `${environment} V3 execution marker`), "t");

    if (target.hasV1) {
      assert.equal(scalar(container, `select public.validate_product_import_plan_read_only(${literal(legacyPlan)})::text`, `${environment} V1 after`), v1Before);
      assert.equal(scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
        'public.validate_reviewed_catalogue_import_plan(jsonb)'::regprocedure
      ),'UTF8')),'hex')`, `${environment} V1 function after`), v1FunctionBefore);
    }

    const acl = json(container, `select jsonb_build_object(
      'validator_read',has_function_privilege('${roles.validator}','public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb)','execute'),
      'validator_public_wrapper',has_function_privilege('${roles.validator}','public.validate_product_import_plan_read_only(jsonb)','execute'),
      'validator_approve',has_function_privilege('${roles.validator}','public.approve_reviewed_catalogue_v3_plan(jsonb,jsonb,timestamptz)','execute'),
      'validator_apply',has_function_privilege('${roles.validator}','public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)','execute'),
      'approver_read',has_function_privilege('${roles.approver}','public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb)','execute'),
      'approver_approve',has_function_privilege('${roles.approver}','public.approve_reviewed_catalogue_v3_plan(jsonb,jsonb,timestamptz)','execute'),
      'approver_apply',has_function_privilege('${roles.approver}','public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)','execute'),
      'executor_read',has_function_privilege('${roles.executor}','public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb)','execute'),
      'executor_approve',has_function_privilege('${roles.executor}','public.approve_reviewed_catalogue_v3_plan(jsonb,jsonb,timestamptz)','execute'),
      'executor_apply',has_function_privilege('${roles.executor}','public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)','execute'),
      'anon_read',has_function_privilege('anon','public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb)','execute'),
      'authenticated_read',has_function_privilege('authenticated','public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb)','execute'),
      'service_read',has_function_privilege('service_role','public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb)','execute'),
      'service_apply',has_function_privilege('service_role','public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)','execute'),
      'validator_table_write',has_table_privilege('${roles.validator}','public.approved_import_plans','insert')
    )`, `${environment} ACL`);
    assert.deepEqual(acl, {
      validator_read: true, validator_public_wrapper: true, validator_approve: false, validator_apply: false,
      approver_read: false, approver_approve: true, approver_apply: false,
      executor_read: false, executor_approve: false, executor_apply: true,
      anon_read: false, authenticated_read: false, service_read: false, service_apply: false,
      validator_table_write: false,
    });

    const preFixFixture = seal(container, actionFixture(environment, "map_existing_variant", 91), `${environment} pre-fix exact source shape`);
    const traditionalFixture = actionFixture(environment, "map_existing_variant", 92);
    traditionalFixture.plan.retailer_product.values.external_options = {
      Flavour: "Cherry & Apple", Size: "875g",
    };
    traditionalFixture.plan.product_variant.evidence.external_options = traditionalFixture.plan.retailer_product.values.external_options;
    const sealedTraditionalFixture = seal(container, traditionalFixture, `${environment} traditional physical Size`);
    const traditionalCounts = counts(container, `${environment} traditional non-V3 before counts`);
    const traditionalBefore = json(
      container,
      `begin; select public.atomic_import_apply_standard_plan_core(${literal(sealedTraditionalFixture.plan)}); rollback`,
      `${environment} traditional non-V3 apply before`,
    );
    assert.equal(traditionalBefore.product_id, 100);
    assert.equal(traditionalBefore.product_variant_id, 200);
    assert.deepEqual(counts(container, `${environment} traditional rollback before counts`), traditionalCounts);
    const preFixApproval = json(
      container,
      asRole(environment, "approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(preFixFixture.plan)},${literal(preFixFixture.envelope)})`),
      `${environment} pre-fix approval`,
    );
    const nonV3ErrorBefore = json(
      container,
      `select public.fixture_capture_standard_apply_error(${literal(preFixFixture.plan)})`,
      `${environment} non-V3 count-size error before`,
    );
    assert.deepEqual(nonV3ErrorBefore, { sqlstate: "P0001", message: target.legacyCountSizeError });
    fails(
      sql(container, asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${preFixApproval.approval_id}',${literal(preFixFixture.plan)},${literal(preFixFixture.envelope)})`)),
      `${environment} exact pre-fix apply failure`,
      new RegExp(target.legacyCountSizeError),
    );
    assert.equal(scalar(container, `select status||':'||coalesce(consumed_at::text,'NULL') from approved_import_plans where id='${preFixApproval.approval_id}'`, `${environment} pre-fix approval remains unconsumed`), "approved:NULL");
    succeed(sql(container, `delete from public.approved_import_plans where id='${preFixApproval.approval_id}'`), `${environment} remove disposable pre-fix approval`);

    succeedWithoutBusinessChange(container, target.optionRoleMigration, `${environment} apply V3 option-role compatibility migration`);
    assert.equal(scalar(container, "select to_regprocedure('public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)') is not null", `${environment} compatibility helper exists`), "t");
    assert.deepEqual(
      json(container, `select public.fixture_capture_standard_apply_error(${literal(preFixFixture.plan)})`, `${environment} non-V3 count-size error after`),
      nonV3ErrorBefore,
    );
    const traditionalAfter = json(
      container,
      `begin; select public.atomic_import_apply_standard_plan_core(${literal(sealedTraditionalFixture.plan)}); rollback`,
      `${environment} traditional non-V3 apply after`,
    );
    assert.equal(traditionalAfter.product_id, traditionalBefore.product_id);
    assert.equal(traditionalAfter.product_variant_id, traditionalBefore.product_variant_id);
    assert.equal(traditionalAfter.retailer_product_action, traditionalBefore.retailer_product_action);
    assert.equal(traditionalAfter.offer_action, traditionalBefore.offer_action);
    assert.equal(traditionalAfter.price_history_action, traditionalBefore.price_history_action);
    assert.deepEqual(counts(container, `${environment} traditional rollback after counts`), traditionalCounts);
    fails(sql(container, asRole(environment, "validator", `select public.atomic_import_apply_standard_plan_core(${literal(preFixFixture.plan)})`, { readOnly: true, approvalId: preFixApproval.approval_id })), `${environment} validator compatibility spoof`, /permission denied/);
    fails(sql(container, `set session authorization service_role; begin; select set_config('app.reviewed_catalogue_v3_approval_id','${preFixApproval.approval_id}',true); select public.atomic_import_apply_standard_plan_core(${literal(preFixFixture.plan)}); rollback`), `${environment} service-role compatibility spoof`, /permission denied/);
    fails(sql(container, asRole(environment, "executor", `select public.atomic_import_apply_standard_plan_core(${literal(preFixFixture.plan)})`)), `${environment} ordinary executor direct compatibility`, /permission denied/);

    succeed(fixtureFile(container, target.livePreSourceValidatorFixture), `${environment} install exact live pre-source validator`);
    succeed(sql(container, `
      alter function public.atomic_import_validate_pre_source_metadata_plan_core(jsonb) owner to postgres;
      revoke all on function public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)
        from public,anon,authenticated,service_role,
          ${roles.validator},${roles.approver},${roles.executor};
    `), `${environment} seal exact live pre-source validator`);
    assert.equal(scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
      'public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure
    ),'UTF8')),'hex')`, `${environment} exact live pre-source validator SHA`), target.livePreSourceValidatorSha);
    const livePreSourceMetadata = functionMetadata(
      container,
      "public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)",
      `${environment} exact live pre-source validator metadata`,
    );
    const compatibilityHelperMetadata = functionMetadata(
      container,
      "public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)",
      `${environment} pre-fix compatibility helper metadata`,
    );
    assert.equal(scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
      'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure
    ),'UTF8')),'hex')`, `${environment} pre-fix compatibility helper SHA`), LEGACY_COMPATIBILITY_HELPER_SHA);
    const legacyPolicyBefore = json(container, `select jsonb_build_object(
      'family',encode(pg_catalog.sha256(convert_to(pg_get_functiondef('public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)'::regprocedure),'UTF8')),'hex'),
      'predators',encode(pg_catalog.sha256(convert_to(pg_get_functiondef('public.atomic_import_predators_v3_parent_variant_transport_allowed(jsonb,jsonb)'::regprocedure),'UTF8')),'hex'),
      'ten_reps_v8',encode(pg_catalog.sha256(convert_to(pg_get_functiondef('public.atomic_import_10reps_v8_parent_variant_transport_allowed(jsonb,jsonb)'::regprocedure),'UTF8')),'hex'),
      'ten_reps_v9',encode(pg_catalog.sha256(convert_to(pg_get_functiondef('public.atomic_import_10reps_v9_parent_variant_transport_allowed(jsonb,jsonb)'::regprocedure),'UTF8')),'hex'),
      'ten_reps_v10',encode(pg_catalog.sha256(convert_to(pg_get_functiondef('public.atomic_import_10reps_v10_parent_variant_transport_allowed(jsonb,jsonb)'::regprocedure),'UTF8')),'hex')
    )`, `${environment} legacy policy hashes before bridge`);
    const legacyFamilyDefinitionBefore = scalar(
      container,
      "select pg_get_functiondef('public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)'::regprocedure)",
      `${environment} exact legacy family definition before isolation`,
    );
    assert.equal(scalar(container, `select public.atomic_import_reviewed_parent_variant_allowed(
      'CNP Premium Whey 2kg','CNP','Whey Protein','powder','2000','g'
    )`, `${environment} historical family allowed before bridge`), "t");
    assert.equal(scalar(container, `select public.atomic_import_reviewed_parent_variant_allowed(
      'Generic Whey Product 2kg','Generic Brand','Whey Protein','powder','2000','g'
    )`, `${environment} unknown family blocked before bridge`), "f");

    const gapFixture = actionFixture(environment, "create_product_with_variant", 93);
    gapFixture.plan.product.values.servings = "67";
    gapFixture.plan.product.values.net_weight_g = "2000";
    gapFixture.plan.product_variant.values.variant_key = "caramel-biscuit-2kg";
    gapFixture.plan.product_variant.values.display_name = "Caramel Biscuit / 67 Servings / 2kg";
    gapFixture.plan.product_variant.values.flavour_code = "caramel-biscuit";
    gapFixture.plan.product_variant.values.flavour_label = "Caramel Biscuit";
    gapFixture.plan.product_variant.values.size_value = "2000";
    gapFixture.plan.product_variant.evidence = {
      flavour: "Caramel Biscuit", size_value: "2000", size_unit: "g", pack_count: "1",
      product_format: "powder",
      external_options: { Flavour: "Caramel Biscuit", Size: "67 Servings", Weight: "2kg" },
      approved_mapping_id: null,
    };
    gapFixture.plan.retailer_product.values.external_options =
      gapFixture.plan.product_variant.evidence.external_options;
    gapFixture.envelope.external_options = gapFixture.plan.product_variant.evidence.external_options;
    gapFixture.envelope.option_roles = {
      flavour: { source_key: "Flavour", source_value: "Caramel Biscuit" },
      physical_size: { source_key: "Weight", source_value: "2kg", size_value: "2000", size_unit: "g" },
      count: { source_key: "Size", source_value: "67 Servings", count_value: "67", count_unit: "servings" },
    };
    const sealedGapFixture = seal(container, gapFixture, `${environment} reviewed-create 2kg 67 servings`);
    const gapReadOnlyValidation = json(
      container,
      asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(sealedGapFixture.plan)},${literal(sealedGapFixture.envelope)})`, { readOnly: true }),
      `${environment} reviewed-create 2kg 67 servings V3 read-only validation`,
    );
    assert.equal(gapReadOnlyValidation.valid, true);
    const gapApproval = json(
      container,
      asRole(environment, "approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(sealedGapFixture.plan)},${literal(sealedGapFixture.envelope)})`),
      `${environment} reviewed-create 2kg 67 servings approval`,
    );
    const gapCountsBefore = counts(container, `${environment} reviewed-create pre-fix counts`);
    fails(
      sql(container, asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${gapApproval.approval_id}',${literal(sealedGapFixture.plan)},${literal(sealedGapFixture.envelope)})`)),
      `${environment} reviewed-create exact post-create pre-fix failure`,
      /reviewed variant option size mismatch/,
    );
    assert.deepEqual(counts(container, `${environment} reviewed-create rolled-back counts`), gapCountsBefore);
    assert.equal(
      scalar(container, `select status||':'||coalesce(consumed_at::text,'NULL') from approved_import_plans where id='${gapApproval.approval_id}'`, `${environment} reviewed-create failed approval state`),
      "approved:NULL",
    );
    fails(
      sql(container, `select public.atomic_import_validate_pre_source_metadata_plan_core(${literal(sealedGapFixture.plan)})`),
      `${environment} non-V3 reviewed-create remains closed before fix`,
      /reviewed variant option size mismatch/,
    );

    succeedWithoutBusinessChange(container, POST_CREATE_OPTION_ROLE_MIGRATION, `${environment} apply reviewed-create post-create option-role migration`);
    assert.equal(scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
      'public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure
    ),'UTF8')),'hex')`, `${environment} patched live pre-source validator SHA`), target.patchedPreSourceValidatorSha);
    assert.deepEqual(
      functionMetadata(container, "public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)", `${environment} patched live pre-source validator metadata`),
      livePreSourceMetadata,
    );
    assert.equal(scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
      'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure
    ),'UTF8')),'hex')`, `${environment} patched compatibility helper SHA`), POST_CREATE_COMPATIBILITY_HELPER_SHA);
    assert.deepEqual(
      functionMetadata(container, "public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)", `${environment} patched compatibility helper metadata`),
      compatibilityHelperMetadata,
    );
    fails(
      sql(container, `select public.atomic_import_validate_pre_source_metadata_plan_core(${literal(sealedGapFixture.plan)})`),
      `${environment} non-V3 reviewed-create remains closed after fix`,
      /reviewed variant option size mismatch/,
    );
    fails(
      sql(container, `begin; select set_config('app.reviewed_catalogue_v3_approval_id','${gapApproval.approval_id}',true); select public.atomic_import_validate_pre_source_metadata_plan_core(${literal(sealedGapFixture.plan)}); rollback`),
      `${environment} fake GUC remains insufficient after fix`,
      /reviewed variant option size mismatch/,
    );
    fails(
      sql(container, `set session authorization service_role; begin; select set_config('app.reviewed_catalogue_v3_approval_id','${gapApproval.approval_id}',true); select public.atomic_import_validate_pre_source_metadata_plan_core(${literal(sealedGapFixture.plan)}); rollback`),
      `${environment} service-role compatibility remains denied after fix`,
      /permission denied/,
    );
    fails(
      sql(container, asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${gapApproval.approval_id}',${literal(sealedGapFixture.plan)},${literal(sealedGapFixture.envelope)})`)),
      `${environment} generic reviewed-create pre-bridge family blocker`,
      /reviewed parent explicit-variant policy does not allow this canonical family/,
    );
    assert.deepEqual(counts(container, `${environment} generic reviewed-create family rollback counts`), gapCountsBefore);
    assert.equal(
      scalar(container, `select status||':'||coalesce(consumed_at::text,'NULL') from approved_import_plans where id='${gapApproval.approval_id}'`, `${environment} family failure approval state`),
      "approved:NULL",
    );
    succeed(sql(container, `create or replace function public.atomic_import_reviewed_parent_variant_allowed(
      p_name text,p_brand text,p_category text,p_format text,p_size_value text,p_size_unit text
    ) returns boolean language sql immutable set search_path=pg_catalog,public,pg_temp as $$select true$$`), `${environment} test-only family gate isolation`);
    fails(
      sql(container, asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${gapApproval.approval_id}',${literal(sealedGapFixture.plan)},${literal(sealedGapFixture.envelope)})`)),
      `${environment} family-only patch exposes next retailer transport blocker`,
      /reviewed parent explicit-variant retailer and transport policy does not allow this plan/,
    );
    assert.deepEqual(counts(container, `${environment} generic reviewed-create transport rollback counts`), gapCountsBefore);
    succeed(
      sql(container, legacyFamilyDefinitionBefore),
      `${environment} restore byte-exact test legacy family policy`,
    );

    succeedWithoutBusinessChange(container, TRUSTED_PARENT_POLICY_MIGRATION, `${environment} apply trusted V3 reviewed-parent policy bridge`);
    assert.deepEqual(
      json(container, `select jsonb_build_object(
        'family',encode(pg_catalog.sha256(convert_to(pg_get_functiondef('public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)'::regprocedure),'UTF8')),'hex'),
        'predators',encode(pg_catalog.sha256(convert_to(pg_get_functiondef('public.atomic_import_predators_v3_parent_variant_transport_allowed(jsonb,jsonb)'::regprocedure),'UTF8')),'hex'),
        'ten_reps_v8',encode(pg_catalog.sha256(convert_to(pg_get_functiondef('public.atomic_import_10reps_v8_parent_variant_transport_allowed(jsonb,jsonb)'::regprocedure),'UTF8')),'hex'),
        'ten_reps_v9',encode(pg_catalog.sha256(convert_to(pg_get_functiondef('public.atomic_import_10reps_v9_parent_variant_transport_allowed(jsonb,jsonb)'::regprocedure),'UTF8')),'hex'),
        'ten_reps_v10',encode(pg_catalog.sha256(convert_to(pg_get_functiondef('public.atomic_import_10reps_v10_parent_variant_transport_allowed(jsonb,jsonb)'::regprocedure),'UTF8')),'hex')
      )`, `${environment} legacy policy hashes after bridge`),
      legacyPolicyBefore,
    );
    assert.deepEqual(
      functionMetadata(container, "public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)", `${environment} bridged validator metadata`),
      livePreSourceMetadata,
    );
    fails(file(container, TRUSTED_PARENT_POLICY_ROLLBACK), `${environment} bridge rollback with live reviewed-create approval`, /rollback blocked by live approval/i);
    const gapApplied = json(
      container,
      asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${gapApproval.approval_id}',${literal(sealedGapFixture.plan)},${literal(sealedGapFixture.envelope)})`),
      `${environment} reviewed-create post-bridge apply`,
    );
    assert.equal(gapApplied.approval_status, "consumed");
    assert.deepEqual(
      json(container, `select external_options from public.retailer_products where id=${gapApplied.retailer_product_id}`, `${environment} reviewed-create stored raw options`),
      { Flavour: "Caramel Biscuit", Size: "67 Servings", Weight: "2kg" },
    );
    const gapCountsAfter = counts(container, `${environment} reviewed-create post-fix counts`);
    for (const table of ["products", "product_variants", "retailer_products", "offers", "price_history"]) {
      assert.equal(gapCountsAfter[table] - gapCountsBefore[table], 1, `${environment} reviewed-create ${table} delta`);
    }
    exerciseTrustedParentRollbackTamperGuards(container, environment);

    const exactPluralFixture = seal(
      container,
      reviewedCreateFlavourFixture(environment, 94, "Flavours", "Georgie's Blood"),
      `${environment} exact plural reviewed-create regression`,
    );
    const exactPluralValidation = json(
      container,
      asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(exactPluralFixture.plan)},${literal(exactPluralFixture.envelope)})`, { readOnly: true }),
      `${environment} exact plural V3 pre-fix validation`,
    );
    assert.equal(exactPluralValidation.valid, true);
    const exactPluralApproval = json(
      container,
      asRole(environment, "approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(exactPluralFixture.plan)},${literal(exactPluralFixture.envelope)})`),
      `${environment} exact plural pre-fix approval`,
    );
    const exactPluralCountsBefore = counts(container, `${environment} exact plural pre-fix counts`);
    fails(
      sql(container, asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${exactPluralApproval.approval_id}',${literal(exactPluralFixture.plan)},${literal(exactPluralFixture.envelope)})`)),
      `${environment} exact plural pre-fix apply failure`,
      /reviewed variant option flavour mismatch/,
    );
    assert.deepEqual(counts(container, `${environment} exact plural pre-fix rollback counts`), exactPluralCountsBefore);
    assert.deepEqual(
      json(container, `select jsonb_build_object('status',status,'consumed_at',consumed_at,'execution_result',execution_result) from public.approved_import_plans where id='${exactPluralApproval.approval_id}'`, `${environment} exact plural failed approval state`),
      { status: "approved", consumed_at: null, execution_result: null },
    );
    fails(
      sql(container, `select public.atomic_import_validate_pre_source_metadata_plan_core(${literal(exactPluralFixture.plan)})`),
      `${environment} non-V3 plural flavour error before`,
      /reviewed variant option flavour mismatch/,
    );
    const traditionalFlavorFixture = actionFixture(environment, "map_existing_variant", 95);
    traditionalFlavorFixture.plan.retailer_product.values.external_options = { Flavor: "Cherry & Apple", Size: "875g" };
    traditionalFlavorFixture.plan.product_variant.evidence.external_options = traditionalFlavorFixture.plan.retailer_product.values.external_options;
    const sealedTraditionalFlavorFixture = seal(container, traditionalFlavorFixture, `${environment} traditional Flavor evidence`);
    const traditionalFlavorBefore = json(
      container,
      `begin; select public.atomic_import_apply_standard_plan_core(${literal(sealedTraditionalFlavorFixture.plan)}); rollback`,
      `${environment} traditional Flavor before plural fix`,
    );
    assert.deepEqual(counts(container, `${environment} traditional Flavor rollback before counts`), exactPluralCountsBefore);

    succeedWithoutBusinessChange(container, PLURAL_FLAVOUR_MIGRATION, `${environment} apply plural-flavour compatibility migration`);
    assert.equal(scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
      'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure
    ),'UTF8')),'hex')`, `${environment} plural-flavour compatibility helper SHA`), PLURAL_FLAVOUR_COMPATIBILITY_HELPER_SHA);
    assert.deepEqual(
      functionMetadata(container, "public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)", `${environment} plural-flavour compatibility helper metadata`),
      compatibilityHelperMetadata,
    );
    fails(
      sql(container, `select public.atomic_import_validate_pre_source_metadata_plan_core(${literal(exactPluralFixture.plan)})`),
      `${environment} non-V3 plural flavour error after`,
      /reviewed variant option flavour mismatch/,
    );
    const traditionalFlavorAfter = json(
      container,
      `begin; select public.atomic_import_apply_standard_plan_core(${literal(sealedTraditionalFlavorFixture.plan)}); rollback`,
      `${environment} traditional Flavor after plural fix`,
    );
    assert.equal(traditionalFlavorAfter.product_id, traditionalFlavorBefore.product_id);
    assert.equal(traditionalFlavorAfter.product_variant_id, traditionalFlavorBefore.product_variant_id);
    assert.equal(traditionalFlavorAfter.retailer_product_action, traditionalFlavorBefore.retailer_product_action);
    assert.equal(traditionalFlavorAfter.offer_action, traditionalFlavorBefore.offer_action);
    assert.equal(traditionalFlavorAfter.price_history_action, traditionalFlavorBefore.price_history_action);
    assert.deepEqual(counts(container, `${environment} traditional Flavor rollback after counts`), exactPluralCountsBefore);
    fails(file(container, PLURAL_FLAVOUR_ROLLBACK), `${environment} plural-flavour rollback with live approval`, /rollback blocked by live approval/i);
    fails(
      sql(container, `begin; select set_config('app.reviewed_catalogue_v3_approval_id','${exactPluralApproval.approval_id}',true); select public.atomic_import_validate_pre_source_metadata_plan_core(${literal(exactPluralFixture.plan)}); rollback`),
      `${environment} plural-flavour fake GUC remains insufficient`,
      /reviewed variant option flavour mismatch/,
    );
    fails(
      sql(container, asRole(environment, "validator", `select public.atomic_import_reviewed_v3_legacy_validation_evidence(${literal(exactPluralFixture.plan)},${literal(exactPluralFixture.envelope)})`, { readOnly: true, approvalId: exactPluralApproval.approval_id })),
      `${environment} validator cannot execute plural-flavour helper`,
      /permission denied/,
    );
    fails(
      sql(container, `set session authorization service_role; begin; select set_config('app.reviewed_catalogue_v3_approval_id','${exactPluralApproval.approval_id}',true); select public.atomic_import_reviewed_v3_legacy_validation_evidence(${literal(exactPluralFixture.plan)},${literal(exactPluralFixture.envelope)}); rollback`),
      `${environment} service_role cannot execute plural-flavour helper`,
      /permission denied/,
    );
    const exactPluralApplied = json(
      container,
      asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${exactPluralApproval.approval_id}',${literal(exactPluralFixture.plan)},${literal(exactPluralFixture.envelope)})`),
      `${environment} exact plural post-fix apply`,
    );
    assert.equal(exactPluralApplied.approval_status, "consumed");
    const exactPluralCountsAfter = counts(container, `${environment} exact plural post-fix counts`);
    for (const table of ["products", "product_variants", "retailer_products", "offers", "price_history"]) {
      assert.equal(exactPluralCountsAfter[table] - exactPluralCountsBefore[table], 1, `${environment} exact plural ${table} delta`);
    }
    assert.deepEqual(
      json(container, `select external_options from public.retailer_products where id=${exactPluralApplied.retailer_product_id}`, `${environment} exact plural stored raw options`),
      { Flavours: "Georgie's Blood", Size: "30 Servings", Weight: "390g" },
    );

    const preRoleAwareFixture = seal(
      container,
      roleAwareLegacySizeFixture(environment, 120, {
        flavour: "Chocolate Chip", rawSize: "12 x 60g Cookies",
        physicalValue: "720g", sizeValue: "720",
      }),
      `${environment} role-aware size pre-fix fixture`,
    );
    const preRoleAwareValidation = json(
      container,
      asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(preRoleAwareFixture.plan)},${literal(preRoleAwareFixture.envelope)})`, { readOnly: true }),
      `${environment} role-aware size pre-fix read-only validation`,
    );
    assert.equal(preRoleAwareValidation.valid, true);
    const preRoleAwareApproval = json(
      container,
      asRole(environment, "approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(preRoleAwareFixture.plan)},${literal(preRoleAwareFixture.envelope)})`),
      `${environment} role-aware size pre-fix approval`,
    );
    const preRoleAwareCounts = counts(container, `${environment} role-aware size pre-fix counts`);
    fails(
      sql(container, asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${preRoleAwareApproval.approval_id}',${literal(preRoleAwareFixture.plan)},${literal(preRoleAwareFixture.envelope)})`)),
      `${environment} role-aware size pre-fix apply`,
      /reviewed variant option size mismatch/,
    );
    assert.deepEqual(counts(container, `${environment} role-aware size pre-fix rollback counts`), preRoleAwareCounts);
    assert.equal(
      scalar(container, `select status||':'||coalesce(consumed_at::text,'NULL') from approved_import_plans where id='${preRoleAwareApproval.approval_id}'`, `${environment} role-aware size failed approval state`),
      "approved:NULL",
    );
    fails(
      file(container, ROLE_AWARE_SIZE_MIGRATION),
      `${environment} role-aware migration with live approval`,
      /blocked by live approval/,
    );
    succeed(
      sql(container, `delete from public.approved_import_plans where id='${preRoleAwareApproval.approval_id}'`),
      `${environment} remove disposable role-aware size failed approval`,
    );
    fails(
      sql(container, `select public.atomic_import_validate_pre_source_metadata_plan_core(${literal(preRoleAwareFixture.plan)})`),
      `${environment} non-V3 role-aware size remains closed before fix`,
      /reviewed variant option size mismatch/,
    );

    succeedWithoutBusinessChange(container, ROLE_AWARE_SIZE_MIGRATION, `${environment} apply role-aware legacy size projection migration`);
    assert.equal(functionSha(container, "public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)", `${environment} projection SHA`), "48ce4f1bf0cb9c9d5dd75f2617b92482a19806bc272bd9ee95adab3518e5d92a");
    assert.equal(functionSha(container, "public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)", `${environment} helper SHA`), "a5b8a05c0dc9cba672cbb4607c8d63660744165f88d2807e26d299159277b0f8");
    assert.equal(functionSha(container, "public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)", `${environment} validator SHA`), "04392ff0eff0e814ba54e41d0b9af38478174eda6f427e7eefcc35d18c7b3e0c");
    assert.deepEqual(
      functionMetadata(container, "public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)", `${environment} role-aware compatibility helper metadata`),
      compatibilityHelperMetadata,
    );
    const projectionMetadata = functionMetadata(
      container,
      "public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)",
      `${environment} role-aware projection metadata`,
    );
    assert.deepEqual(projectionMetadata, {
      owner: "postgres", volatility: "s", security_definer: true,
      config: ["search_path=pg_catalog, public, pg_temp"], acl: "{postgres=X/postgres}",
    });
    fails(
      sql(container, `select public.atomic_import_validate_pre_source_metadata_plan_core(${literal(preRoleAwareFixture.plan)})`),
      `${environment} non-V3 role-aware size remains closed after fix`,
      /reviewed variant option size mismatch/,
    );
    fails(
      sql(container, `set session authorization service_role; select public.atomic_import_reviewed_v3_legacy_validation_projection(${literal(preRoleAwareFixture.plan)},${literal(preRoleAwareFixture.envelope)})`),
      `${environment} service role cannot execute role-aware projection`,
      /permission denied/,
    );

    const liquidFixture = seal(
      container,
      reviewedLiquidParentFixture(environment, 140),
      `${environment} trusted V3 liquid parent fixture`,
    );
    const liquidValidationBefore = json(
      container,
      asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(liquidFixture.plan)},${literal(liquidFixture.envelope)})`, { readOnly: true }),
      `${environment} liquid parent read-only validation before parity fix`,
    );
    assert.equal(liquidValidationBefore.valid, true);
    const liquidApprovalBefore = json(
      container,
      asRole(environment, "approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(liquidFixture.plan)},${literal(liquidFixture.envelope)})`),
      `${environment} liquid parent approval before parity fix`,
    );
    const liquidCountsBefore = counts(container, `${environment} liquid parent pre-fix counts`);
    fails(
      sql(container, asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${liquidApprovalBefore.approval_id}',${literal(liquidFixture.plan)},${literal(liquidFixture.envelope)})`)),
      `${environment} liquid parent apply before parity fix`,
      /invalid product import plan: reviewed parent values/,
    );
    assert.deepEqual(counts(container, `${environment} liquid parent pre-fix rollback counts`), liquidCountsBefore);
    assert.equal(
      scalar(container, `select status||':'||coalesce(consumed_at::text,'NULL') from approved_import_plans where id='${liquidApprovalBefore.approval_id}'`, `${environment} liquid parent failed approval state`),
      "approved:NULL",
    );
    fails(
      file(container, TRUSTED_PARENT_FORMAT_MIGRATION),
      `${environment} trusted parent format migration with live approval`,
      /blocked by live approval/,
    );
    succeed(
      sql(container, `delete from public.approved_import_plans where id='${liquidApprovalBefore.approval_id}'`),
      `${environment} remove disposable liquid parent failed approval`,
    );
    fails(
      sql(container, `select public.atomic_import_validate_pre_source_metadata_plan_core(${literal(liquidFixture.plan)})`),
      `${environment} non-V3 liquid parent remains closed before parity fix`,
      /invalid product import plan: reviewed parent values/,
    );

    succeedWithoutBusinessChange(container, TRUSTED_PARENT_FORMAT_MIGRATION, `${environment} apply trusted V3 reviewed-parent format policy`);
    assert.equal(
      functionSha(container, "public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)", `${environment} trusted parent format validator SHA`),
      target.postTrustedParentFormatSha,
    );
    fails(
      sql(container, `select public.atomic_import_validate_pre_source_metadata_plan_core(${literal(liquidFixture.plan)})`),
      `${environment} non-V3 liquid parent remains closed after parity fix`,
      /invalid product import plan: reviewed parent values/,
    );
    const liquidCountsApplyBefore = counts(container, `${environment} liquid parent post-fix counts before`);
    const liquidApproval = json(
      container,
      asRole(environment, "approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(liquidFixture.plan)},${literal(liquidFixture.envelope)})`),
      `${environment} liquid parent approval after parity fix`,
    );
    fails(
      file(container, TRUSTED_PARENT_FORMAT_ROLLBACK),
      `${environment} trusted parent format rollback with live approval`,
      /blocked by live approval/,
    );
    const liquidApplied = json(
      container,
      asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${liquidApproval.approval_id}',${literal(liquidFixture.plan)},${literal(liquidFixture.envelope)})`),
      `${environment} liquid parent apply after parity fix`,
    );
    assert.equal(liquidApplied.approval_status, "consumed");
    assert.deepEqual(
      json(container, `select external_options from public.retailer_products where id=${liquidApplied.retailer_product_id}`, `${environment} liquid parent stored raw options`),
      liquidFixture.envelope.external_options,
    );
    const liquidCountsAfter = counts(container, `${environment} liquid parent post-fix counts after`);
    for (const table of ["products", "product_variants", "retailer_products", "offers", "price_history"]) {
      assert.equal(liquidCountsAfter[table] - liquidCountsApplyBefore[table], 1, `${environment} liquid parent ${table} delta`);
    }

    const aliasFixtures = [
      ["Strawberry alias", existingVariantFlavourAliasFixture(environment, 161, "Strawberry", "Strawberry Cream")],
      ["Chocotella spelling alias", existingVariantFlavourAliasFixture(environment, 162, "Chocotella", "Choctella", "Flavor")],
      ["Chocolate Raspberry punctuation alias", existingVariantFlavourAliasFixture(environment, 163, "Chocolate & Raspberry", "Chocolate Raspberry", "Flavours")],
      ["Eggsplosion expanded alias", existingVariantFlavourAliasFixture(environment, 164, "Egg'splosion (Limited Edition)", "Chocolate Egg'splosion (limited Edition)", "Flavors")],
    ];
    for (const [, fixture] of aliasFixtures) {
      const expected = fixture.plan.expected_state.product_variant;
      succeed(sql(container, `insert into public.product_variants(
        id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,
        pack_count,product_format,is_default,is_active
      ) values(
        ${fixture.variantId},100,${literal(expected.variant_key)}#>>'{}',${literal(expected.display_name)}#>>'{}',
        ${literal(expected.flavour_code)}#>>'{}',${literal(expected.flavour_label)}#>>'{}',875,'g',1,'powder',false,true
      )`), `${environment} seed ${expected.flavour_label} canonical variant`);
    }

    const sealedPreAlias = seal(container, aliasFixtures[0][1], `${environment} pre-fix Strawberry alias`);
    const preAliasValidation = json(
      container,
      asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(sealedPreAlias.plan)},${literal(sealedPreAlias.envelope)})`, { readOnly: true }),
      `${environment} pre-fix Strawberry alias validation`,
    );
    assert.equal(preAliasValidation.valid, true);
    const preAliasApproval = json(
      container,
      asRole(environment, "approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(sealedPreAlias.plan)},${literal(sealedPreAlias.envelope)})`),
      `${environment} pre-fix Strawberry alias approval`,
    );
    const preAliasCounts = counts(container, `${environment} pre-fix Strawberry alias counts`);
    fails(
      sql(container, asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${preAliasApproval.approval_id}',${literal(sealedPreAlias.plan)},${literal(sealedPreAlias.envelope)})`)),
      `${environment} pre-fix Strawberry alias apply`,
      /variant option flavour mismatch/,
    );
    assert.deepEqual(counts(container, `${environment} pre-fix Strawberry alias rollback counts`), preAliasCounts);
    succeed(sql(container, `delete from public.approved_import_plans where id='${preAliasApproval.approval_id}'`), `${environment} remove disposable pre-fix alias approval`);
    assert.deepEqual(
      json(container, `select public.fixture_capture_standard_apply_error(${literal(sealedPreAlias.plan)})`, `${environment} non-V3 alias remains closed before fix`),
      { sqlstate: "P0001", message: "variant option flavour mismatch" },
    );

    succeedWithoutBusinessChange(container, EXISTING_VARIANT_FLAVOUR_ALIAS_MIGRATION, `${environment} apply existing-variant flavour alias migration`);
    assert.equal(
      functionSha(container, "public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)", `${environment} alias projection SHA`),
      EXISTING_VARIANT_FLAVOUR_ALIAS_PROJECTION_SHA,
    );
    assert.deepEqual(
      functionMetadata(container, "public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)", `${environment} alias projection metadata`),
      projectionMetadata,
    );
    succeed(sql(container, `insert into supabase_migrations.schema_migrations(version,name)
      values('20261022080000','allow_reviewed_v3_existing_variant_flavour_alias_projection')
      on conflict (version) do update set name=excluded.name`), `${environment} seed disposable alias migration ledger`);
    succeedWithoutBusinessChange(container, EXISTING_VARIANT_FLAVOUR_ALIAS_ROLLBACK, `${environment} clean alias projection rollback`);
    assert.equal(
      functionSha(container, "public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)", `${environment} clean alias rollback SHA`),
      "48ce4f1bf0cb9c9d5dd75f2617b92482a19806bc272bd9ee95adab3518e5d92a",
    );
    succeedWithoutBusinessChange(container, EXISTING_VARIANT_FLAVOUR_ALIAS_MIGRATION, `${environment} reapply existing-variant flavour alias migration`);
    succeedWithoutBusinessChange(container, EVIDENCE_PARITY_MIGRATION, `${environment} apply evidence parity migration`);
    succeed(sql(container, `insert into supabase_migrations.schema_migrations(version,name)
      values('20261022120000','fix_reviewed_v3_apply_evidence_parity')
      on conflict (version) do update set name=excluded.name`), `${environment} seed disposable evidence parity migration ledger`);
    succeedWithoutBusinessChange(container, COMPOSITE_CREATE_SIZE_MIGRATION, `${environment} apply composite create size projection migration`);
    succeed(sql(container, `insert into supabase_migrations.schema_migrations(version,name)
      values('20261024120000','fix_reviewed_v3_create_product_composite_size_projection')
      on conflict (version) do update set name=excluded.name`), `${environment} seed disposable composite create size migration ledger`);
    const beforeCanonicalValidatorMetadata = functionMetadata(
      container,
      "public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)",
      `${environment} canonical evidence validator metadata before`,
    );
    succeedWithoutBusinessChange(container, CANONICAL_EVIDENCE_MIGRATION, `${environment} apply canonical identity evidence migration`);
    assert.deepEqual(
      functionMetadata(container, "public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)", `${environment} canonical evidence validator metadata after`),
      beforeCanonicalValidatorMetadata,
    );
    const canonicalHelperMetadata = functionMetadata(
      container,
      "public.atomic_import_reviewed_v3_canonical_role_allowed(jsonb,jsonb,text)",
      `${environment} canonical evidence helper metadata`,
    );
    assert.equal(canonicalHelperMetadata.owner, "postgres");
    assert.equal(canonicalHelperMetadata.volatility, "s");
    assert.equal(canonicalHelperMetadata.security_definer, true);
    assert.deepEqual(canonicalHelperMetadata.config, ["search_path=pg_catalog, public, pg_temp"]);
    assert.doesNotMatch(canonicalHelperMetadata.acl || "", /PUBLIC|anon|authenticated|service_role/);
    assert.equal(
      functionSha(container, "public.atomic_import_reviewed_v3_canonical_role_allowed(jsonb,jsonb,text)", `${environment} canonical evidence helper SHA`),
      "cc6c8017e87a3f02129dbd855960d8078348eb8271713a274e26ef5dcdf15f46",
    );

    const canonicalEvidence = seal(container, canonicalEvidenceFixture(environment, 190), `${environment} canonical evidence`);
    const canonicalEvidenceResult = json(
      container,
      asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(canonicalEvidence.plan)},${literal(canonicalEvidence.envelope)})`, { readOnly: true }),
      `${environment} canonical evidence read-only projection`,
    );
    assert.equal(canonicalEvidenceResult.valid, true);
    const canonicalCountEvidence = seal(container, canonicalCountEvidenceFixture(environment, 191), `${environment} canonical count evidence`);
    const canonicalCountResult = json(
      container,
      asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(canonicalCountEvidence.plan)},${literal(canonicalCountEvidence.envelope)})`, { readOnly: true }),
      `${environment} canonical count evidence read-only projection`,
    );
    assert.equal(canonicalCountResult.valid, true);
    for (const [label, source] of [
      ["physical", canonicalEvidence],
      ["container count", canonicalCountEvidence],
    ]) {
      const omittedRaw = structuredClone(source);
      omittedRaw.envelope.canonical_identity_evidence.raw_source_facts = [];
      omittedRaw.envelope.canonical_identity_evidence.conflict_records = [];
      omittedRaw.plan.product_variant.evidence.canonical_identity_evidence.raw_source_facts = [];
      omittedRaw.plan.product_variant.evidence.canonical_identity_evidence.conflict_records = [];
      for (const target of [omittedRaw.envelope.canonical_identity_evidence, omittedRaw.plan.product_variant.evidence.canonical_identity_evidence]) {
        target.evidence_review_decision.decision_evidence_sha256 = null;
        target.evidence_review_decision.decision_evidence_sha256 = canonicalEvidenceSha256(target);
      }
      seal(container, omittedRaw, `${environment} canonical evidence omitted ${label} raw fact before fix`);
      fails(
        sql(container, asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(omittedRaw.plan)},${literal(omittedRaw.envelope)})`, { readOnly: true })),
        `${environment} canonical evidence omitted ${label} raw fact after fix`,
        /V3_CANONICAL_RAW_FACT_BINDING_MISMATCH/,
      );
    }
    const wrongRawValue = structuredClone(canonicalEvidence);
    for (const target of [wrongRawValue.envelope.canonical_identity_evidence, wrongRawValue.plan.product_variant.evidence.canonical_identity_evidence]) {
      target.raw_source_facts.find(fact => fact.fact_id === "raw-weight").raw_value = "264g";
      target.evidence_review_decision.decision_evidence_sha256 = null;
      target.evidence_review_decision.decision_evidence_sha256 = canonicalEvidenceSha256(target);
    }
    seal(container, wrongRawValue, `${environment} canonical evidence wrong raw value`);
    fails(
      sql(container, asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(wrongRawValue.plan)},${literal(wrongRawValue.envelope)})`, { readOnly: true })),
      `${environment} canonical evidence wrong raw value`,
      /V3_CANONICAL_RAW_FACT_BINDING_MISMATCH/,
    );
    const missingConflict = structuredClone(canonicalEvidence);
    missingConflict.envelope.canonical_identity_evidence.conflict_records = [];
    missingConflict.plan.product_variant.evidence.canonical_identity_evidence.conflict_records = [];
    for (const target of [missingConflict.envelope.canonical_identity_evidence, missingConflict.plan.product_variant.evidence.canonical_identity_evidence]) {
      target.evidence_review_decision.decision_evidence_sha256 = null;
      target.evidence_review_decision.decision_evidence_sha256 = canonicalEvidenceSha256(target);
    }
    seal(container, missingConflict, `${environment} canonical evidence missing conflict`);
    fails(
      sql(container, asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(missingConflict.plan)},${literal(missingConflict.envelope)})`, { readOnly: true })),
      `${environment} missing canonical conflict`,
      /V3_CANONICAL_CONFLICT_RECORD_REQUIRED/,
    );

    succeed(sql(container, `insert into public.products(id,name,slug,brand,category,is_active,product_format)
      values(101,'Evidence Product 101','evidence-product-101','Example','Energy Drinks',true,'liquid')`), `${environment} seed liquid evidence parent`);

    const compositeCreationCases = [
      ["create_product_with_variant", 181, { products: 1, product_variants: 1 }],
      ["create_variant_on_existing_product", 182, { products: 0, product_variants: 1 }],
    ];
    for (const [action, index, expectedDelta] of compositeCreationCases) {
      const fixture = seal(
        container,
        compositeCreationFixture(environment, action, index),
        `${environment} ${action} composite size`,
      );
      const projected = json(
        container,
        `select public.atomic_import_reviewed_v3_legacy_validation_projection(${literal(fixture.plan)},${literal(fixture.envelope)})`,
        `${environment} ${action} composite validation projection`,
      );
      assert.equal(projected.external_options.Size, "355ml");
      assert.deepEqual(fixture.envelope.external_options, {
        Flavour: `Example Apple ${index}`, Size: "1 Serving (355ml)",
      });
      const validation = json(
        container,
        asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(fixture.plan)},${literal(fixture.envelope)})`, { readOnly: true }),
        `${environment} ${action} composite protected validation`,
      );
      assert.equal(validation.valid, true);
      const before = counts(container, `${environment} ${action} composite before`);
      const approval = json(
        container,
        asRole(environment, "approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(fixture.plan)},${literal(fixture.envelope)})`),
        `${environment} ${action} composite approval`,
      );
      const applied = json(
        container,
        asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${approval.approval_id}',${literal(fixture.plan)},${literal(fixture.envelope)})`),
        `${environment} ${action} composite apply`,
      );
      assert.equal(applied.approval_status, "consumed");
      assert.equal(
        scalar(container, `select status from approved_import_plans where id='${approval.approval_id}'`, `${environment} ${action} composite approval consumed`),
        "consumed",
      );
      assert.deepEqual(
        json(container, `select external_options from retailer_products where id=${applied.retailer_product_id}`, `${environment} ${action} composite raw evidence`),
        fixture.envelope.external_options,
      );
      assert.deepEqual(
        json(container, `select jsonb_build_object('size_value',size_value::text,'size_unit',size_unit,'product_format',product_format) from product_variants where id=${applied.product_variant_id}`, `${environment} ${action} composite created variant`),
        { size_value: "355", size_unit: "ml", product_format: "liquid" },
      );
      const after = counts(container, `${environment} ${action} composite after`);
      assert.equal(after.products - before.products, expectedDelta.products);
      assert.equal(after.product_variants - before.product_variants, expectedDelta.product_variants);
      for (const table of ["retailer_products", "offers", "price_history"]) {
        assert.equal(after[table] - before[table], 1, `${environment} ${action} composite ${table} delta`);
      }
    }

    const compositeNegativeCases = [];
    const ambiguousPhysical = compositeCreationFixture(environment, "create_product_with_variant", 190);
    for (const targetOptions of [
      ambiguousPhysical.plan.product_variant.evidence.external_options,
      ambiguousPhysical.plan.retailer_product.values.external_options,
      ambiguousPhysical.envelope.external_options,
    ]) targetOptions.Size = "1 Serving (355ml / 500ml)";
    ambiguousPhysical.envelope.option_roles.physical_size.source_value = "1 Serving (355ml / 500ml)";
    ambiguousPhysical.envelope.option_roles.count.source_value = "1 Serving (355ml / 500ml)";
    compositeNegativeCases.push(["ambiguous physical composite", ambiguousPhysical]);

    const ambiguousCount = compositeCreationFixture(environment, "create_product_with_variant", 191);
    for (const targetOptions of [
      ambiguousCount.plan.product_variant.evidence.external_options,
      ambiguousCount.plan.retailer_product.values.external_options,
      ambiguousCount.envelope.external_options,
    ]) targetOptions.Size = "1 or 2 Servings (355ml)";
    ambiguousCount.envelope.option_roles.physical_size.source_value = "1 or 2 Servings (355ml)";
    ambiguousCount.envelope.option_roles.count.source_value = "1 or 2 Servings (355ml)";
    compositeNegativeCases.push(["ambiguous composite count", ambiguousCount]);

    const roleSourceMismatch = compositeCreationFixture(environment, "create_product_with_variant", 192);
    roleSourceMismatch.envelope.option_roles.count.source_value = "2 Servings (355ml)";
    compositeNegativeCases.push(["role source value mismatch", roleSourceMismatch]);

    const wrongPhysicalProof = compositeCreationFixture(environment, "create_product_with_variant", 193);
    for (const targetOptions of [
      wrongPhysicalProof.plan.product_variant.evidence.external_options,
      wrongPhysicalProof.plan.retailer_product.values.external_options,
      wrongPhysicalProof.envelope.external_options,
    ]) targetOptions.Size = "1 Serving (330ml)";
    wrongPhysicalProof.envelope.option_roles.physical_size.source_value = "1 Serving (330ml)";
    wrongPhysicalProof.envelope.option_roles.count.source_value = "1 Serving (330ml)";
    compositeNegativeCases.push(["physical proof differs from raw source", wrongPhysicalProof]);

    const wrongCountProof = compositeCreationFixture(environment, "create_product_with_variant", 194);
    for (const targetOptions of [
      wrongCountProof.plan.product_variant.evidence.external_options,
      wrongCountProof.plan.retailer_product.values.external_options,
      wrongCountProof.envelope.external_options,
    ]) targetOptions.Size = "2 Servings (355ml)";
    wrongCountProof.envelope.option_roles.physical_size.source_value = "2 Servings (355ml)";
    wrongCountProof.envelope.option_roles.count.source_value = "2 Servings (355ml)";
    compositeNegativeCases.push(["count proof differs from raw source", wrongCountProof]);

    const invalidCanonicalSize = compositeCreationFixture(environment, "create_product_with_variant", 195);
    invalidCanonicalSize.plan.product_variant.values.size_value = "invalid";
    compositeNegativeCases.push(["invalid canonical size", invalidCanonicalSize]);

    const tamperedProjectionTarget = compositeCreationFixture(environment, "create_product_with_variant", 196);
    tamperedProjectionTarget.plan.product_variant.values.size_value = "500";
    tamperedProjectionTarget.plan.product_variant.values.variant_key = "example-apple-196-500ml";
    tamperedProjectionTarget.plan.product_variant.values.display_name = "Example Apple 196 / 500ml";
    compositeNegativeCases.push(["tampered legacy projection target", tamperedProjectionTarget]);

    const missingPhysicalRole = compositeCreationFixture(environment, "create_product_with_variant", 197);
    missingPhysicalRole.envelope.option_roles.physical_size = null;
    compositeNegativeCases.push(["missing physical role", missingPhysicalRole]);

    const missingCountRole = compositeCreationFixture(environment, "create_product_with_variant", 198);
    missingCountRole.envelope.option_roles.count = null;
    compositeNegativeCases.push(["missing count role", missingCountRole]);

    for (const [label, rawFixture] of compositeNegativeCases) {
      const fixture = seal(container, rawFixture, `${environment} ${label}`);
      const before = counts(container, `${environment} ${label} before`);
      fails(
        sql(container, asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(fixture.plan)},${literal(fixture.envelope)})`, { readOnly: true })),
        `${environment} ${label} rejected before writes`,
        /physical size role is not exact raw evidence|count role is not exact raw evidence|V3_LEGACY_COMPATIBILITY_MISMATCH|variant values|canonical/i,
      );
      assert.deepEqual(counts(container, `${environment} ${label} after`), before);
    }
    assert.equal(scalar(container, `select public.atomic_import_reviewed_v3_physical_role_allowed(
      '{"Size":"1 Serving (330ml)"}'::jsonb,
      '{"source_key":"Size","source_value":"1 Serving (330ml)","size_value":"330","size_unit":"ml"}'::jsonb
    )`, `${environment} SQL composite physical role`), "t");
    assert.equal(scalar(container, `select public.atomic_import_reviewed_v3_count_role_allowed(
      '{"Size":"1 Serving (330ml)"}'::jsonb,
      '{"source_key":"Size","source_value":"1 Serving (330ml)","count_value":"1","count_unit":"servings"}'::jsonb
    )`, `${environment} SQL composite count role`), "t");
    assert.equal(scalar(container, `select public.atomic_import_reviewed_v3_physical_role_allowed(
      '{"Size":"1 Serving 330ml 500ml"}'::jsonb,
      '{"source_key":"Size","source_value":"1 Serving 330ml 500ml","size_value":"330","size_unit":"ml"}'::jsonb
    )`, `${environment} SQL ambiguous composite physical rejection`), "f");
    assert.equal(scalar(container, `select public.atomic_import_reviewed_v3_count_role_allowed(
      '{"Size":"1 or 2 Servings (330ml)"}'::jsonb,
      '{"source_key":"Size","source_value":"1 or 2 Servings (330ml)","count_value":"1","count_unit":"servings"}'::jsonb
    )`, `${environment} SQL ambiguous composite count rejection`), "f");
    const evidenceParityFixtures = [
      ["composite RTD", existingVariantEvidenceParityFixture(environment, 171, {
        flavour: "Apple Burst", productId: 101, productName: "Evidence Product 101", variantId: 701, productFormat: "liquid",
        externalOptions: { Flavour: "Apple Burst", Size: "1 Serving (330ml)" },
        physicalRole: { source_key: "Size", source_value: "1 Serving (330ml)", size_value: "330", size_unit: "ml" },
        countRole: { source_key: "Size", source_value: "1 Serving (330ml)", count_value: "1", count_unit: "servings" },
        expectedSizeValue: "330", expectedSizeUnit: "ml", originalSizeValue: null, originalSizeUnit: null,
      })],
      ["count-sized powder", existingVariantEvidenceParityFixture(environment, 172, {
        flavour: "Apple Mango", productId: 100, productName: "Existing Protein", variantId: 702, productFormat: "powder",
        externalOptions: { Flavour: "Apple Mango", Size: "30 Servings", Weight: "330g" },
        physicalRole: { source_key: "Weight", source_value: "330g", size_value: "330", size_unit: "g" },
        countRole: { source_key: "Size", source_value: "30 Servings", count_value: "30", count_unit: "servings" },
        expectedSizeValue: "30", expectedSizeUnit: "servings", originalSizeValue: "330", originalSizeUnit: "g",
      })],
    ];
    for (const [label, rawFixture] of evidenceParityFixtures) {
      const expected = rawFixture.plan.expected_state.product_variant;
      succeed(sql(container, `insert into public.product_variants(
        id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,
        pack_count,product_format,is_default,is_active
      ) values(
        ${expected.id},${expected.product_id},${literal(expected.variant_key)}#>>'{}',${literal(expected.display_name)}#>>'{}',
        ${literal(expected.flavour_code)}#>>'{}',${literal(expected.flavour_label)}#>>'{}',${expected.size_value},
        ${literal(expected.size_unit)}#>>'{}',1,${literal(expected.product_format)}#>>'{}',false,true
      )`), `${environment} seed ${label} canonical variant`);
      const fixture = seal(container, rawFixture, `${environment} ${label}`);
      const projected = json(
        container,
        `select public.atomic_import_reviewed_v3_legacy_validation_projection(${literal(fixture.plan)},${literal(fixture.envelope)})`,
        `${environment} ${label} projected evidence`,
      );
      assert.equal(projected.size_value, expected.size_value);
      assert.equal(projected.size_unit, expected.size_unit);
      assert.deepEqual(fixture.plan.product_variant.evidence.external_options, fixture.envelope.external_options);
      const validation = json(
        container,
        asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(fixture.plan)},${literal(fixture.envelope)})`, { readOnly: true }),
        `${environment} ${label} protected validation`,
      );
      assert.equal(validation.valid, true);
      const before = counts(container, `${environment} ${label} counts before`);
      const approval = json(
        container,
        asRole(environment, "approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(fixture.plan)},${literal(fixture.envelope)})`),
        `${environment} ${label} approval`,
      );
      const applied = json(
        container,
        asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${approval.approval_id}',${literal(fixture.plan)},${literal(fixture.envelope)})`),
        `${environment} ${label} apply`,
      );
      assert.equal(applied.approval_status, "consumed");
      assert.deepEqual(
        json(container, `select external_options from public.retailer_products where id=${applied.retailer_product_id}`, `${environment} ${label} raw storage`),
        fixture.envelope.external_options,
      );
      const after = counts(container, `${environment} ${label} counts after`);
      assert.equal(after.products - before.products, 0);
      assert.equal(after.product_variants - before.product_variants, 0);
      for (const table of ["retailer_products", "offers", "price_history"]) assert.equal(after[table] - before[table], 1);
    }

    for (const [label, fixtureIndex, expectedValue] of [
      ["physical canonical mismatch", 0, "500"],
      ["count canonical mismatch", 1, "40"],
    ]) {
      const fixture = structuredClone(evidenceParityFixtures[fixtureIndex][1]);
      fixture.plan.expected_state.product_variant.size_value = expectedValue;
      fails(
        sql(container, `select public.atomic_import_reviewed_v3_legacy_validation_projection(${literal(fixture.plan)},${literal(fixture.envelope)})`),
        `${environment} ${label} rejected`,
        /canonical size does not select exactly one proven role/,
      );
    }
    const evidenceParityNegativeCases = [
      ["missing product format", (fixture) => { fixture.plan.product_variant.evidence.product_format = null; }],
      ["role source key drift", (fixture) => { fixture.envelope.option_roles.count.source_key = "Count"; }],
      ["role source value drift", (fixture) => { fixture.envelope.option_roles.count.source_value = "40 Servings"; }],
      ["stale canonical target", (fixture) => { fixture.plan.expected_state.product_variant.id = "9999"; }],
      ["default variant misuse", (fixture) => { fixture.plan.expected_state.product_variant.is_default = true; }],
    ];
    for (const [label, mutate] of evidenceParityNegativeCases) {
      const fixture = structuredClone(evidenceParityFixtures[1][1]);
      mutate(fixture);
      fails(
        sql(container, `select public.atomic_import_reviewed_v3_legacy_validation_projection(${literal(fixture.plan)},${literal(fixture.envelope)})`),
        `${environment} ${label} rejected`,
        /V3_LEGACY_COMPATIBILITY_MISMATCH/,
      );
    }
    const missingCanonicalCountRole = structuredClone(evidenceParityFixtures[1][1]);
    missingCanonicalCountRole.envelope.option_roles.count = null;
    missingCanonicalCountRole.envelope.external_options = { Flavour: "Apple Mango", Weight: "330g" };
    missingCanonicalCountRole.plan.product_variant.evidence.external_options = missingCanonicalCountRole.envelope.external_options;
    missingCanonicalCountRole.plan.retailer_product.values.external_options = missingCanonicalCountRole.envelope.external_options;
    fails(
      sql(container, `select public.atomic_import_reviewed_v3_legacy_validation_projection(${literal(missingCanonicalCountRole.plan)},${literal(missingCanonicalCountRole.envelope)})`),
      `${environment} canonical count without a proven count role rejected`,
      /canonical size does not select exactly one proven role/,
    );
    const ambiguousComposite = structuredClone(evidenceParityFixtures[0][1]);
    ambiguousComposite.plan.product_variant.evidence.external_options.Size = "1 Serving 330ml 500ml";
    ambiguousComposite.plan.retailer_product.values.external_options.Size = "1 Serving 330ml 500ml";
    ambiguousComposite.envelope.external_options.Size = "1 Serving 330ml 500ml";
    ambiguousComposite.envelope.option_roles.physical_size.source_value = "1 Serving 330ml 500ml";
    ambiguousComposite.envelope.option_roles.count.source_value = "1 Serving 330ml 500ml";
    fails(
      sql(container, `select public.atomic_import_reviewed_v3_legacy_validation_projection(${literal(ambiguousComposite.plan)},${literal(ambiguousComposite.envelope)})`),
      `${environment} ambiguous composite rejected`,
      /V3_LEGACY_COMPATIBILITY_MISMATCH/,
    );

    const aliasTargetFailures = [
      ["changed target variant", (fixture) => { fixture.plan.expected_state.product_variant.id = "9999"; }],
      ["target belongs to different product", (fixture) => { fixture.plan.expected_state.product_variant.product_id = "9999"; }],
      ["default target variant", (fixture) => { fixture.plan.expected_state.product_variant.is_default = true; }],
      ["inactive target variant", (fixture) => { fixture.plan.expected_state.product_variant.is_active = false; }],
      ["empty canonical flavour", (fixture) => { fixture.plan.expected_state.product_variant.flavour_label = " "; }],
    ];
    for (const [label, mutate] of aliasTargetFailures) {
      const fixture = structuredClone(sealedPreAlias);
      mutate(fixture);
      fails(
        sql(container, `select public.atomic_import_reviewed_v3_legacy_validation_projection(${literal(fixture.plan)},${literal(fixture.envelope)})`),
        `${environment} ${label} remains closed`,
        /existing variant alias target differs/,
      );
    }
    const ambiguousAlias = structuredClone(sealedPreAlias);
    ambiguousAlias.plan.retailer_product.values.external_options.Flavor = "Strawberry";
    ambiguousAlias.plan.product_variant.evidence.external_options.Flavor = "Strawberry";
    ambiguousAlias.envelope.external_options.Flavor = "Strawberry";
    fails(
      sql(container, `select public.atomic_import_reviewed_v3_legacy_validation_projection(${literal(ambiguousAlias.plan)},${literal(ambiguousAlias.envelope)})`),
      `${environment} multiple flavour keys remain closed`,
      /ambiguous flavour aliases/,
    );

    const aliasReceipts = [];
    for (const [label, rawFixture] of aliasFixtures) {
      const fixture = seal(container, rawFixture, `${environment} ${label}`);
      const validation = json(
        container,
        asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(fixture.plan)},${literal(fixture.envelope)})`, { readOnly: true }),
        `${environment} ${label} validation`,
      );
      assert.equal(validation.valid, true);
      const before = counts(container, `${environment} ${label} counts before`);
      const approval = json(
        container,
        asRole(environment, "approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(fixture.plan)},${literal(fixture.envelope)})`),
        `${environment} ${label} approval`,
      );
      const applied = json(
        container,
        asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${approval.approval_id}',${literal(fixture.plan)},${literal(fixture.envelope)})`),
        `${environment} ${label} apply`,
      );
      assert.equal(applied.approval_status, "consumed");
      assert.equal(String(applied.product_variant_id), fixture.variantId);
      assert.deepEqual(
        json(container, `select external_options from public.retailer_products where id=${applied.retailer_product_id}`, `${environment} ${label} raw storage`),
        fixture.envelope.external_options,
      );
      assert.equal(
        scalar(container, `select product_variant_id::text from public.offers where id=${applied.offer_id}`, `${environment} ${label} offer target`),
        fixture.variantId,
      );
      const after = counts(container, `${environment} ${label} counts after`);
      assert.equal(after.products - before.products, 0);
      assert.equal(after.product_variants - before.product_variants, 0);
      for (const table of ["retailer_products", "offers", "price_history"]) {
        assert.equal(after[table] - before[table], 1, `${environment} ${label} ${table} delta`);
      }
      assert.equal(scalar(container, `select count(*)::text from price_history where offer_id=${applied.offer_id}`, `${environment} ${label} history count`), "1");
      assert.equal(scalar(container, `select status from approved_import_plans where id='${approval.approval_id}'`, `${environment} ${label} consumed approval`), "consumed");
      const replay = json(
        container,
        asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${approval.approval_id}',${literal(fixture.plan)},${literal(fixture.envelope)})`),
        `${environment} ${label} replay`,
      );
      assert.equal(replay.status, "ALREADY_APPLIED");
      assert.deepEqual(counts(container, `${environment} ${label} replay counts`), after);
      aliasReceipts.push({ approval, applied, fixture });
    }
    assert.equal(aliasReceipts.length, 4);
    assert.equal(aliasReceipts[0].fixture.envelope.external_options.Flavour, "Strawberry");
    assert.notEqual(aliasReceipts[0].fixture.envelope.external_options.Flavour, "Strawberry Cream");
    fails(
      file(container, EXISTING_VARIANT_FLAVOUR_ALIAS_ROLLBACK),
      `${environment} alias rollback after dependent execution`,
      /blocked by dependent execution/,
    );
    assert.deepEqual(
      json(container, `select public.fixture_capture_standard_apply_error(${literal(sealedPreAlias.plan)})`, `${environment} non-V3 alias remains closed after fix`),
      { sqlstate: "P0001", message: "variant option flavour mismatch" },
    );

    const mismatchedCreate = actionFixture(environment, "create_product_with_variant", 165);
    mismatchedCreate.plan.retailer_product.values.external_options.Flavour = "Retailer Alias";
    mismatchedCreate.plan.product_variant.evidence.external_options.Flavour = "Retailer Alias";
    mismatchedCreate.envelope.external_options.Flavour = "Retailer Alias";
    mismatchedCreate.envelope.option_roles.flavour.source_value = "Retailer Alias";
    const sealedMismatchedCreate = seal(container, mismatchedCreate, `${environment} mismatched reviewed create flavour`);
    const mismatchedCreateApproval = json(
      container,
      asRole(environment, "approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(sealedMismatchedCreate.plan)},${literal(sealedMismatchedCreate.envelope)})`),
      `${environment} mismatched reviewed create approval`,
    );
    const mismatchedCreateCounts = counts(container, `${environment} mismatched reviewed create counts`);
    fails(
      sql(container, asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${mismatchedCreateApproval.approval_id}',${literal(sealedMismatchedCreate.plan)},${literal(sealedMismatchedCreate.envelope)})`)),
      `${environment} mismatched reviewed create apply remains closed`,
      /variant option flavour mismatch/,
    );
    assert.deepEqual(counts(container, `${environment} mismatched reviewed create rollback counts`), mismatchedCreateCounts);
    succeed(sql(container, `delete from public.approved_import_plans where id='${mismatchedCreateApproval.approval_id}'`), `${environment} remove disposable mismatched create approval`);

    const roleAwarePassFixtures = [
      ["cookie pack wording", roleAwareLegacySizeFixture(environment, 121, {
        flavour: "Chocolate Chip", rawSize: "12 x 60g Cookies",
        physicalValue: "720g", sizeValue: "720",
      })],
      ["slash count wording", roleAwareLegacySizeFixture(environment, 122, {
        flavour: "Sugar Sweet", rawSize: "40/80",
        physicalValue: "1.8kg", sizeValue: "1800",
      })],
      ["Size count role", reviewedCreateFlavourFixture(environment, 123, "Flavour", "Count Role")],
      ["Size physical role", roleAwareLegacySizeFixture(environment, 124, {
        flavour: "Physical Size", rawSize: "720g", physicalKey: "Size",
        physicalValue: "720g", sizeValue: "720",
      })],
    ];
    for (const [label, rawFixture] of roleAwarePassFixtures) {
      const fixture = seal(container, rawFixture, `${environment} ${label}`);
      const validation = json(
        container,
        asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(fixture.plan)},${literal(fixture.envelope)})`, { readOnly: true }),
        `${environment} ${label} read-only validation`,
      );
      assert.equal(validation.valid, true);
      const before = counts(container, `${environment} ${label} counts before`);
      const approval = json(
        container,
        asRole(environment, "approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(fixture.plan)},${literal(fixture.envelope)})`),
        `${environment} ${label} approval`,
      );
      const applied = json(
        container,
        asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${approval.approval_id}',${literal(fixture.plan)},${literal(fixture.envelope)})`),
        `${environment} ${label} apply`,
      );
      assert.equal(applied.approval_status, "consumed");
      assert.deepEqual(
        json(container, `select external_options from public.retailer_products where id=${applied.retailer_product_id}`, `${environment} ${label} persisted raw options`),
        fixture.envelope.external_options,
      );
      const after = counts(container, `${environment} ${label} counts after`);
      for (const table of ["products", "product_variants", "retailer_products", "offers", "price_history"]) {
        assert.equal(after[table] - before[table], 1, `${environment} ${label} ${table} delta`);
      }
    }

    const negativeRoleAwareFixtures = [];
    const wrongPhysical = roleAwareLegacySizeFixture(environment, 130, {
      flavour: "Wrong Physical", rawSize: "12 x 60g Cookies", physicalValue: "720g", sizeValue: "720",
    });
    wrongPhysical.envelope.option_roles.physical_size.source_value = "719g";
    negativeRoleAwareFixtures.push(["physical source mismatch", wrongPhysical, /physical size role is not exact raw evidence/]);
    const missingPhysical = roleAwareLegacySizeFixture(environment, 131, {
      flavour: "Missing Physical", rawSize: "12 x 60g Cookies", physicalValue: "720g", sizeValue: "720",
    });
    delete missingPhysical.envelope.external_options.Weight;
    delete missingPhysical.plan.retailer_product.values.external_options.Weight;
    delete missingPhysical.plan.product_variant.evidence.external_options.Weight;
    negativeRoleAwareFixtures.push(["missing physical option", missingPhysical, /physical size role is not exact raw evidence/]);
    const roleConflict = roleAwareLegacySizeFixture(environment, 132, {
      flavour: "Role Conflict", rawSize: "30 Servings", physicalKey: "Size",
      physicalValue: "30 Servings", sizeValue: "30", sizeUnit: "g",
      count: { source_key: "Size", source_value: "30 Servings", count_value: "30", count_unit: "servings" },
    });
    negativeRoleAwareFixtures.push(["physical count conflict", roleConflict, /physical size role is not exact raw evidence|physical and count roles conflict/]);
    const ambiguousSize = roleAwareLegacySizeFixture(environment, 133, {
      flavour: "Ambiguous Size", rawSize: "12 x 60g Cookies", physicalValue: "720g", sizeValue: "720",
    });
    ambiguousSize.envelope.external_options.size = "40/80";
    ambiguousSize.plan.retailer_product.values.external_options.size = "40/80";
    ambiguousSize.plan.product_variant.evidence.external_options.size = "40/80";
    negativeRoleAwareFixtures.push(["ambiguous Size aliases", ambiguousSize, /ambiguous size aliases/]);
    const envelopeMismatch = roleAwareLegacySizeFixture(environment, 134, {
      flavour: "Envelope Mismatch", rawSize: "12 x 60g Cookies", physicalValue: "720g", sizeValue: "720",
    });
    envelopeMismatch.envelope.external_options = {
      ...envelopeMismatch.envelope.external_options,
      Size: "different",
    };
    negativeRoleAwareFixtures.push(["envelope raw mismatch", envelopeMismatch, /plan and authorization envelope differ/]);
    for (const [label, rawFixture, expected] of negativeRoleAwareFixtures) {
      const fixture = seal(container, rawFixture, `${environment} ${label}`);
      fails(
        sql(container, asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(fixture.plan)},${literal(fixture.envelope)})`, { readOnly: true })),
        `${environment} ${label} read-only rejection`,
        expected,
      );
    }

    for (const [index, alias] of ["Flavour", "Flavor", "Flavours", "Flavors"].entries()) {
      const sourceValue = `Alias ${index + 1}`;
      const aliasFixture = seal(
        container,
        reviewedCreateFlavourFixture(environment, 100 + index, alias, sourceValue),
        `${environment} ${alias} full-apply fixture`,
      );
      const aliasValidation = json(
        container,
        asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(aliasFixture.plan)},${literal(aliasFixture.envelope)})`, { readOnly: true }),
        `${environment} ${alias} read-only validation`,
      );
      assert.equal(aliasValidation.valid, true);
      const aliasBefore = counts(container, `${environment} ${alias} counts before`);
      const aliasApproval = json(
        container,
        asRole(environment, "approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(aliasFixture.plan)},${literal(aliasFixture.envelope)})`),
        `${environment} ${alias} approval`,
      );
      const aliasApplied = json(
        container,
        asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${aliasApproval.approval_id}',${literal(aliasFixture.plan)},${literal(aliasFixture.envelope)})`),
        `${environment} ${alias} apply`,
      );
      assert.equal(aliasApplied.approval_status, "consumed");
      assert.deepEqual(
        json(container, `select external_options from public.retailer_products where id=${aliasApplied.retailer_product_id}`, `${environment} ${alias} stored source key`),
        aliasFixture.envelope.external_options,
      );
      const aliasAfter = counts(container, `${environment} ${alias} counts after`);
      for (const table of ["products", "product_variants", "retailer_products", "offers", "price_history"]) {
        assert.equal(aliasAfter[table] - aliasBefore[table], 1, `${environment} ${alias} ${table} delta`);
      }
    }

    const wrongRoleFixture = reviewedCreateFlavourFixture(environment, 110, "Flavours", "Wrong Role");
    wrongRoleFixture.envelope.option_roles.flavour.source_value = "Different Value";
    const sealedWrongRoleFixture = seal(container, wrongRoleFixture, `${environment} wrong plural role binding`);
    fails(
      sql(container, asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(sealedWrongRoleFixture.plan)},${literal(sealedWrongRoleFixture.envelope)})`, { readOnly: true })),
      `${environment} plural source wrong role value`,
      /flavour role is not exact raw evidence/,
    );

    const tasteFixture = reviewedCreateFlavourFixture(environment, 111, "Taste", "Unknown Taste");
    const sealedTasteFixture = seal(container, tasteFixture, `${environment} unknown Taste flavour role`);
    fails(
      sql(container, asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(sealedTasteFixture.plan)},${literal(sealedTasteFixture.envelope)})`, { readOnly: true })),
      `${environment} unknown Taste flavour role`,
      /flavour role is not exact raw evidence/,
    );

    const conflictingFixture = reviewedCreateFlavourFixture(environment, 112, "Flavours", "Conflict One");
    conflictingFixture.plan.product_variant.evidence.external_options.Flavour = "Conflict Two";
    conflictingFixture.plan.retailer_product.values.external_options.Flavour = "Conflict Two";
    conflictingFixture.envelope.external_options.Flavour = "Conflict Two";
    const sealedConflictingFixture = seal(container, conflictingFixture, `${environment} conflicting flavour aliases`);
    fails(
      sql(container, asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(sealedConflictingFixture.plan)},${literal(sealedConflictingFixture.envelope)})`, { readOnly: true })),
      `${environment} conflicting flavour aliases`,
      /flavour role coverage differs from raw evidence/,
    );

    const actionCases = [
      ["map_existing_variant", { products: 0, product_variants: 0 }],
      ["create_variant_on_existing_product", { products: 0, product_variants: 1 }],
      ["create_product_with_variant", { products: 1, product_variants: 1 }],
      ["create_product_with_default_variant", { products: 1, product_variants: 1 }],
    ];
    for (let index = 0; index < actionCases.length; index += 1) {
      const [action, canonicalDelta] = actionCases[index];
      const fixture = seal(container, actionFixture(environment, action, index + 1), `${environment} ${action}`);
      const readOnlyValidation = json(
        container,
        asRole(environment, "validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(fixture.plan)},${literal(fixture.envelope)})`, { readOnly: true }),
        `${environment} ${action} V3 read-only validation`,
      );
      assert.equal(readOnlyValidation.valid, true);
      const before = counts(container, `${environment} ${action} before`);
      const approval = json(
        container,
        asRole(environment, "approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(fixture.plan)},${literal(fixture.envelope)})`),
        `${environment} ${action} approval`,
      );
      assert.equal(approval.contract_kind, "reviewed-catalogue-package-v3");

      if (index === 0) {
        fails(file(container, ROLE_AWARE_SIZE_ROLLBACK), `${environment} role-aware rollback with live approval`, /rollback blocked by live approval/i);
        const spoofed = json(
          container,
          asRole(environment, "validator", `select public.validate_product_import_plan_read_only(${literal(fixture.plan)})`, { readOnly: true, approvalId: approval.approval_id }),
          `${environment} validator GUC spoof`,
        );
        assert.notEqual(spoofed.contract_kind, "reviewed-catalogue-package-v3");
        assert.deepEqual(counts(container, `${environment} spoof counts`), before);
        assert.equal(scalar(container, `select status from approved_import_plans where id='${approval.approval_id}'`, `${environment} spoof approval status`), "approved");
        fails(sql(container, asRole(environment, "validator", `select public.apply_approved_reviewed_catalogue_v3_plan('${approval.approval_id}',${literal(fixture.plan)},${literal(fixture.envelope)})`, { readOnly: true })), `${environment} validator cannot apply`, /permission denied/);
        fails(sql(container, `set session authorization service_role; begin; select set_config('app.reviewed_catalogue_v3_approval_id','${approval.approval_id}',true); select public.apply_approved_reviewed_catalogue_v3_plan('${approval.approval_id}',${literal(fixture.plan)},${literal(fixture.envelope)}); rollback`), `${environment} service_role spoof`, /permission denied/);
      }

      const applied = json(
        container,
        asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${approval.approval_id}',${literal(fixture.plan)},${literal(fixture.envelope)})`),
        `${environment} ${action} apply`,
      );
      assert.equal(applied.approval_status, "consumed");
      assert.deepEqual(
        json(container, `select external_options from public.retailer_products where id=${applied.retailer_product_id}`, `${environment} ${action} stored raw options`),
        fixture.envelope.external_options,
      );
      assert.equal(scalar(container, `select status from public.approved_import_plans where id='${approval.approval_id}'`, `${environment} ${action} consumed row`), "consumed");
      const after = counts(container, `${environment} ${action} after`);
      assert.equal(after.products - before.products, canonicalDelta.products);
      assert.equal(after.product_variants - before.product_variants, canonicalDelta.product_variants);
      for (const table of ["retailer_products", "offers", "price_history"]) {
        assert.equal(after[table] - before[table], 1, `${environment} ${action} ${table}`);
      }
      if (index === 0) fails(file(container, ROLE_AWARE_SIZE_ROLLBACK), `${environment} role-aware rollback with consumed approval`, /rollback blocked by later durable approval evidence/i);
      const replay = json(
        container,
        asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${approval.approval_id}',${literal(fixture.plan)},${literal(fixture.envelope)})`),
        `${environment} ${action} replay`,
      );
      assert.equal(replay.status, "ALREADY_APPLIED");
      assert.equal(replay.already_applied, true);
      assert.deepEqual(counts(container, `${environment} ${action} replay counts`), after);
    }

    const pluralFixture = actionFixture(environment, "create_variant_on_existing_product", 50);
    pluralFixture.plan.product_variant.values.variant_key = "georgies-blood-390g";
    pluralFixture.plan.product_variant.values.display_name = "Georgie's Blood / 390g";
    pluralFixture.plan.product_variant.values.flavour_code = "georgies-blood";
    pluralFixture.plan.product_variant.values.flavour_label = "Georgie's Blood";
    pluralFixture.plan.product_variant.values.size_value = "390";
    pluralFixture.plan.retailer_product.values.external_options = {
      Flavours: "Georgie's Blood", Size: "30 Servings", Weight: "390g",
    };
    pluralFixture.envelope.external_options = pluralFixture.plan.retailer_product.values.external_options;
    pluralFixture.envelope.option_roles = {
      flavour: { source_key: "Flavours", source_value: "Georgie's Blood" },
      physical_size: { source_key: "Weight", source_value: "390g", size_value: "390", size_unit: "g" },
      count: { source_key: "Size", source_value: "30 Servings", count_value: "30", count_unit: "servings" },
    };
    const sealedPluralFixture = seal(container, pluralFixture, `${environment} plural Flavours`);
    const pluralApproval = json(
      container,
      asRole(environment, "approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(sealedPluralFixture.plan)},${literal(sealedPluralFixture.envelope)})`),
      `${environment} plural Flavours approval`,
    );
    const pluralApplied = json(
      container,
      asRole(environment, "executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${pluralApproval.approval_id}',${literal(sealedPluralFixture.plan)},${literal(sealedPluralFixture.envelope)})`),
      `${environment} plural Flavours apply`,
    );
    assert.equal(pluralApplied.approval_status, "consumed");
    assert.deepEqual(
      json(container, `select external_options from public.retailer_products where id=${pluralApplied.retailer_product_id}`, `${environment} plural Flavours stored raw options`),
      sealedPluralFixture.envelope.external_options,
    );

    succeed(sql(container, "delete from public.approved_import_plans where source like 'reviewed-catalogue-package-v3:%'"), `${environment} remove disposable V3 fixture approvals`);
    succeedWithoutBusinessChange(container, CANONICAL_EVIDENCE_ROLLBACK, `${environment} rollback canonical identity evidence migration`);
    succeedWithoutBusinessChange(container, COMPOSITE_CREATE_SIZE_ROLLBACK, `${environment} rollback composite create size projection migration`);
    assert.equal(
      functionSha(container, "public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)", `${environment} restored pre-composite projection SHA`),
      "cc0be112418a5843f1526d9ee2c746564cb9ec40d6be1ff26724fbc92934bda5",
    );
    succeedWithoutBusinessChange(container, COMPOSITE_CREATE_SIZE_MIGRATION, `${environment} reapply composite create size projection migration`);
    assert.notEqual(
      functionSha(container, "public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)", `${environment} reapplied composite projection SHA`),
      "cc0be112418a5843f1526d9ee2c746564cb9ec40d6be1ff26724fbc92934bda5",
    );
    succeedWithoutBusinessChange(container, COMPOSITE_CREATE_SIZE_ROLLBACK, `${environment} final rollback composite create size projection migration`);
    succeedWithoutBusinessChange(container, EVIDENCE_PARITY_ROLLBACK, `${environment} rollback evidence parity migration`);
    succeedWithoutBusinessChange(container, EXISTING_VARIANT_FLAVOUR_ALIAS_ROLLBACK, `${environment} rollback existing-variant flavour alias projection`);
    assert.equal(
      functionSha(container, "public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)", `${environment} restored pre-alias projection SHA`),
      "48ce4f1bf0cb9c9d5dd75f2617b92482a19806bc272bd9ee95adab3518e5d92a",
    );
    succeedWithoutBusinessChange(container, TRUSTED_PARENT_FORMAT_ROLLBACK, `${environment} rollback trusted V3 reviewed-parent format policy`);
    assert.equal(
      functionSha(container, "public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)", `${environment} trusted parent format rollback SHA`),
      target.postTrustedParentSha,
    );
    succeedWithoutBusinessChange(container, ROLE_AWARE_SIZE_ROLLBACK, `${environment} rollback role-aware legacy size projection migration`);
    assert.equal(
      scalar(container, "select to_regprocedure('public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)') is null", `${environment} role-aware projection removed`),
      "t",
    );
    assert.equal(functionSha(
      container,
      "public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)",
      `${environment} role-aware rollback helper SHA`,
    ), PLURAL_FLAVOUR_COMPATIBILITY_HELPER_SHA);
    succeedWithoutBusinessChange(container, PLURAL_FLAVOUR_ROLLBACK, `${environment} rollback plural-flavour compatibility migration`);
    assert.equal(scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
      'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure
    ),'UTF8')),'hex')`, `${environment} plural-flavour rollback helper SHA`), POST_CREATE_COMPATIBILITY_HELPER_SHA);
    assert.deepEqual(
      functionMetadata(container, "public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)", `${environment} plural-flavour rollback helper metadata`),
      compatibilityHelperMetadata,
    );
    succeedWithoutBusinessChange(container, TRUSTED_PARENT_POLICY_ROLLBACK, `${environment} rollback trusted V3 reviewed-parent policy bridge`);
    assert.equal(scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
      'public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure
    ),'UTF8')),'hex')`, `${environment} bridge rollback validator SHA`), target.patchedPreSourceValidatorSha);
    assert.deepEqual(
      functionMetadata(container, "public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)", `${environment} bridge rollback validator metadata`),
      livePreSourceMetadata,
    );
    succeedWithoutBusinessChange(container, POST_CREATE_OPTION_ROLE_ROLLBACK, `${environment} rollback reviewed-create post-create option-role migration`);
    assert.equal(scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
      'public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure
    ),'UTF8')),'hex')`, `${environment} restored live pre-source validator SHA`), target.livePreSourceValidatorSha);
    assert.deepEqual(
      functionMetadata(container, "public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)", `${environment} restored live pre-source validator metadata`),
      livePreSourceMetadata,
    );
    assert.equal(scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
      'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure
    ),'UTF8')),'hex')`, `${environment} restored compatibility helper SHA`), LEGACY_COMPATIBILITY_HELPER_SHA);
    assert.deepEqual(
      functionMetadata(container, "public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)", `${environment} restored compatibility helper metadata`),
      compatibilityHelperMetadata,
    );
    succeedWithoutBusinessChange(container, target.optionRoleRollback, `${environment} rollback V3 option-role compatibility`);
    assert.equal(scalar(container, "select to_regprocedure('public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)') is null", `${environment} compatibility helper removed`), "t");
    assert.equal(scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
      'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure
    ),'UTF8')),'hex')`, `${environment} restored standard apply SHA`), standardCoreBefore);
    assert.equal(scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
      'public.atomic_import_apply_pre_source_metadata_plan_core(jsonb)'::regprocedure
    ),'UTF8')),'hex')`, `${environment} restored pre-source apply SHA`), preSourceCoreBefore);
    succeed(sql(container, `${originalPreSourceValidatorDefinition};
      grant execute on function public.atomic_import_validate_pre_source_metadata_plan_core(jsonb) to public`), `${environment} restore exact original pre-source validator fixture`);
    succeedWithoutBusinessChange(container, target.boundaryRollback, `${environment} successful rollback`);
    const restoredSha = scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
      'public.validate_product_import_plan_read_only(jsonb)'::regprocedure
    ),'UTF8')),'hex')`, `${environment} restored validator SHA`);
    assert.equal(restoredSha, beforeValidatorSha);
    assert.deepEqual(validatorMetadata(container, `${environment} restored validator metadata`), beforeValidatorMetadata);
    assert.equal(scalar(container, "select to_regprocedure('public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb)') is null", `${environment} V3 removed`), "t");
    assert.equal(scalar(container, "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='approved_import_plans' and column_name='authorization_envelope')", `${environment} envelope removed`), "f");
    assert.deepEqual(columnMetadata(container, "execution_result", `${environment} execution_result rollback`), beforeExecutionResult);
    assert.equal(scalar(container, `select public.validate_product_import_plan_read_only(${literal(ordinaryPlan)})::text`, `${environment} non-V3 after rollback`), ordinaryBefore);
    if (target.hasV1) {
      assert.equal(scalar(container, `select public.validate_product_import_plan_read_only(${literal(legacyPlan)})::text`, `${environment} V1 after rollback`), v1Before);
      assert.equal(scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
        'public.validate_reviewed_catalogue_import_plan(jsonb)'::regprocedure
      ),'UTF8')),'hex')`, `${environment} V1 function rollback`), v1FunctionBefore);
    }
    succeedWithoutBusinessChange(container, target.boundedStateRollback, `${environment} final bounded-state rollback`);
    assert.equal(scalar(container, "select to_regprocedure('public.read_reviewed_catalogue_import_state(jsonb)') is null", `${environment} bounded state absent after full rollback`), "t");
    assert.deepEqual(
      publicFunctionAndApprovalSchemaState(container, `${environment} full rollback lineage state`),
      originalLineageState,
      `${environment} full rollback did not restore the exact original function/schema lineage`,
    );
  } finally {
    run("docker", ["rm", "--force", container], 30_000);
  }
}

test("reviewed catalogue V3 installer has no direct cross-environment ACL references", () => {
  const directNamedRoleAcl = /\b(?:grant|revoke)\b[^;]*\b(?:to|from)\s+[^;]*retailer_catalogue_(?:staging|production)_/i;
  for (const migration of ENVIRONMENT_SAFE_FORWARD_CHAIN) {
    const contents = fs.readFileSync(path.join(ROOT, migration), "utf8");
    const unsafeStatements = contents.split(";").filter((statement) => directNamedRoleAcl.test(statement));
    assert.deepEqual(unsafeStatements, [], `${migration} contains a direct environment-role ACL statement`);
  }
});

test("reviewed catalogue V3 rollbacks resolve only the selected environment role", () => {
  const eagerNamedRoleCast = /retailer_catalogue_(?:staging|production)_[a-z_]+'\s*::\s*regrole/i;
  for (const rollback of ENVIRONMENT_SAFE_ROLLBACK_CHAIN) {
    const contents = fs.readFileSync(path.join(ROOT, rollback), "utf8");
    assert.doesNotMatch(contents, eagerNamedRoleCast, `${rollback} eagerly resolves an environment role`);
  }
});

test("reviewed catalogue V3 independently wraps staging and production validator lineages", { timeout: 600_000 }, (t) => {
  if (!dockerAvailable()) return t.skip("Docker unavailable");
  const environments = process.env.REVIEWED_V3_TEST_ENV
    ? [process.env.REVIEWED_V3_TEST_ENV]
    : ["STAGING", "PRODUCTION"];
  for (const environment of environments) {
    assert.ok(Object.hasOwn(TARGETS, environment), `unsupported focused environment ${environment}`);
    exerciseBaseline(environment);
  }
});
