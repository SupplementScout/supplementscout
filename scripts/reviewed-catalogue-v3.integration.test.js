const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = "postgres:17-alpine";
const PASSWORD = "reviewed-v3-local-only";
const MIGRATION = "supabase/migrations/20261018120000_add_reviewed_catalogue_v3_boundary.sql";
const ROLLBACK = "supabase/rollbacks/20261018120000_add_reviewed_catalogue_v3_boundary_rollback.sql";
const OPTION_ROLE_MIGRATION = "supabase/migrations/20261018190000_fix_reviewed_catalogue_v3_apply_option_roles.sql";
const OPTION_ROLE_ROLLBACK = "supabase/rollbacks/20261018190000_fix_reviewed_catalogue_v3_apply_option_roles_rollback.sql";
const LIVE_APPLY_DISPATCH_FIXTURE = "supabase/test/reviewed_catalogue_v3_live_apply_dispatch_fixture.sql";
const TARGETS = Object.freeze({
  STAGING: Object.freeze({
    projectRef: "hxnrsyyqffztlvcrtgbf",
    validatorSha: "70f134e6f7d3afa25de52353ff5e8aca3cc0f7c34a58d9da3577ead4ac11f4a9",
    standardCoreFixture: "supabase/test/reviewed_catalogue_v3_staging_standard_apply_core.sql",
    standardCoreSha: "69311caa0dda83010f986dfbd76bc0017d3a0f999c64b1dd5e35dcb87b7d4c48",
    legacyCountSizeError: "variant option size mismatch",
    hasV1: false,
    hasExecutionResult: false,
  }),
  PRODUCTION: Object.freeze({
    projectRef: "aftboxmrdgyhizicfsfu",
    validatorSha: "b9d99d9245ff2ea493fa9ed4d160f0e9ff4c450764cb40a5a23325d0ca069583",
    standardCoreFixture: "supabase/test/reviewed_catalogue_v3_production_standard_apply_core.sql",
    standardCoreSha: "0b0bccb01e521228db93f495db7984372df5b177cf7009edc205620c1ddef634",
    legacyCountSizeError: "invalid variant option size",
    hasV1: true,
    hasExecutionResult: true,
  }),
});

function run(command, args, timeout = 180_000) {
  return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout });
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
function literal(value) { return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`; }
function scalar(container, statement, label) {
  return succeed(sql(container, statement, true), label).stdout.trim();
}
function json(container, statement, label) {
  return JSON.parse(scalar(container, statement, label));
}
function wait(container) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (exec(container, [
      "psql", "-X", "--no-psqlrc", "-U", "postgres", "-tAc", "select 1",
    ], 5_000).stdout.trim() === "1") return;
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
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create role retailer_catalogue_staging_validator nologin; create role retailer_catalogue_staging_approver nologin; create role retailer_catalogue_staging_executor nologin;
create role retailer_catalogue_production_validator nologin; create role retailer_catalogue_production_approver nologin; create role retailer_catalogue_production_executor nologin;
create role supplementscout_staging_validator_login login; create role supplementscout_staging_approver_login login; create role supplementscout_staging_executor_login login;
create role supplementscout_production_validator_login login; create role supplementscout_production_approver_login login; create role supplementscout_production_executor_login login;
grant retailer_catalogue_staging_validator to supplementscout_staging_validator_login with set true;
grant retailer_catalogue_staging_approver to supplementscout_staging_approver_login with set true;
grant retailer_catalogue_staging_executor to supplementscout_staging_executor_login with set true;
grant retailer_catalogue_production_validator to supplementscout_production_validator_login with set true;
grant retailer_catalogue_production_approver to supplementscout_production_approver_login with set true;
grant retailer_catalogue_production_executor to supplementscout_production_executor_login with set true;
create table public.retailers(id bigint primary key,name text not null,slug text not null,website text not null);
create table public.products(id bigint generated by default as identity primary key,name text,slug text,brand text,category text,gtin text,price numeric,image text,description text,servings integer,net_weight_g numeric,net_volume_ml numeric,serving_count_verified integer,serving_size_g numeric,serving_size_ml numeric,protein_per_serving_g numeric,creatine_per_serving_g numeric,unit_count integer,unit_type text,unit_pricing_verified boolean,nutrition_verified boolean,is_active boolean default true,merged_into_product_id bigint,product_format text);
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
create function public.atomic_import_canonical_json(p_value jsonb) returns text language sql immutable as $$select p_value::text$$;
create function public.atomic_import_has_exact_keys(p_value jsonb,p_keys text[]) returns boolean language sql immutable as $$select jsonb_typeof(p_value)='object' and (select array_agg(key order by key) from jsonb_object_keys(p_value) key)=(select array_agg(key order by key) from unnest(p_keys) key)$$;
create function public.atomic_import_is_decimal_string(p_value text) returns boolean language sql immutable as $$select p_value ~ '^(0|[1-9][0-9]*)(\\.[0-9]+)?$'$$;
create function public.atomic_import_normalized_identity(p_value text) returns text language sql immutable as $$select lower(regexp_replace(btrim(coalesce(p_value,'')),'[^a-zA-Z0-9]+','','g'))$$;
create function public.atomic_import_normalize_product_format(p_value text) returns text language sql immutable as $$select lower(replace(btrim(coalesce(p_value,'')),'_',' '))$$;
create function public.atomic_import_normalize_size(p_value text) returns jsonb language plpgsql immutable as $$
declare m text[]; amount numeric; unit text;
begin
  m:=regexp_match(btrim(p_value),'^(\\d+(?:[.,]\\d+)?)\\s*(mcg|mg|kg|g|ml|cl|l)$','i');
  if m is null then return null; end if;
  amount:=replace(m[1],',','.')::numeric; unit:=lower(m[2]);
  if unit='kg' then amount:=amount*1000; unit:='g'; elsif unit='l' then amount:=amount*1000; unit:='ml'; elsif unit='cl' then amount:=amount*10; unit:='ml'; end if;
  return jsonb_build_object('value',amount::text,'unit',unit);
end$$;
create function public.atomic_import_is_legacy_mapping_upgrade(p_plan jsonb) returns boolean language sql immutable as $$select false$$;
create function public.atomic_import_is_simply_identity_only_upgrade(p_plan jsonb) returns boolean language sql immutable as $$select false$$;
create function public.atomic_import_safe_create_category_allowed(p_category text,p_name text,p_format text) returns boolean language sql immutable as $$select true$$;
create function public.apply_verified_offer_no_change_plan(p_plan jsonb) returns jsonb language plpgsql volatile as $$begin raise exception 'fixture no-change path not expected'; end$$;
create function public.retailer_catalogue_actual_database_target() returns jsonb language sql stable security definer as $$select '{"target_environment":"${environment}","project_ref":"${target.projectRef}"}'::jsonb$$;
${target.hasV1 ? productionValidator : stagingValidator}
revoke all on function public.validate_product_import_plan_read_only(jsonb) from public,anon,authenticated,service_role,retailer_catalogue_staging_validator,retailer_catalogue_production_validator;
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
revoke all on all tables in schema public from anon,authenticated,service_role,retailer_catalogue_staging_validator,retailer_catalogue_staging_approver,retailer_catalogue_staging_executor,retailer_catalogue_production_validator,retailer_catalogue_production_approver,retailer_catalogue_production_executor;
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
        } }
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
    approval: defaultVariant ? {
      approved: true, approval_type: "safe_create", approved_category: "Whey Protein",
      source_row_fingerprint: null, canonical_name: `Example Protein ${index}`,
      has_variant_evidence: false, approval_fingerprint: null,
    } : { approved: false, approval_type: "none" },
  };
  if (defaultVariant) {
    plan.product.values.servings = null;
    plan.product.values.net_weight_g = null;
    plan.product.values.unit_count = "60";
    plan.product.values.unit_type = "servings";
    plan.approval.source_row_fingerprint = plan.meta.source_row_fingerprint;
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

function seal(container, fixture, label) {
  if (fixture.plan.approval.approval_type === "safe_create") {
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

function columnMetadata(container, column, label) {
  const value = scalar(container, `select coalesce((
    select jsonb_build_object('data_type',data_type,'is_nullable',is_nullable,'column_default',column_default)::text
    from information_schema.columns
    where table_schema='public' and table_name='approved_import_plans' and column_name='${column}'
  ),'null')`, label);
  return JSON.parse(value);
}

function validatorMetadata(container, label) {
  return json(container, `select jsonb_build_object(
    'owner',p.proowner::regrole::text,
    'volatility',p.provolatile,
    'security_definer',p.prosecdef,
    'config',p.proconfig,
    'acl',p.proacl::text
  ) from pg_proc p where p.oid='public.validate_product_import_plan_read_only(jsonb)'::regprocedure`, label);
}

function exerciseBaseline(environment) {
  const target = TARGETS[environment];
  const container = `supplementscout-reviewed-v3-${environment.toLowerCase()}-${crypto.randomBytes(5).toString("hex")}`;
  try {
    succeed(run("docker", [
      "run", "--detach", "--rm", "--name", container, "--network", "none",
      "-e", `POSTGRES_PASSWORD=${PASSWORD}`, "-v", `${ROOT}:/workspace:ro`, IMAGE,
    ]), `${environment} start PostgreSQL`);
    wait(container);
    succeed(sql(container, setupSql(environment)), `${environment} prepare baseline`);
    succeed(file(container, target.standardCoreFixture), `${environment} install exact live standard apply core`);
    succeed(file(container, LIVE_APPLY_DISPATCH_FIXTURE), `${environment} install exact live apply dispatch cores`);
    succeed(sql(container, `
      alter function public.atomic_import_apply_standard_plan_core(jsonb) owner to postgres;
      revoke all on function public.atomic_import_apply_standard_plan_core(jsonb) from public,anon,authenticated,service_role,
        retailer_catalogue_staging_validator,retailer_catalogue_staging_approver,retailer_catalogue_staging_executor,
        retailer_catalogue_production_validator,retailer_catalogue_production_approver,retailer_catalogue_production_executor;
      alter function public.atomic_import_apply_variant_plan_core(jsonb) owner to postgres;
      alter function public.atomic_import_apply_pre_source_metadata_plan_core(jsonb) owner to postgres;
      alter function public.apply_product_import_plan(jsonb) owner to postgres;
      revoke all on function public.atomic_import_apply_variant_plan_core(jsonb),
        public.atomic_import_apply_pre_source_metadata_plan_core(jsonb),public.apply_product_import_plan(jsonb)
        from public,anon,authenticated,service_role,
          retailer_catalogue_staging_validator,retailer_catalogue_staging_approver,retailer_catalogue_staging_executor,
          retailer_catalogue_production_validator,retailer_catalogue_production_approver,retailer_catalogue_production_executor;
    `), `${environment} seal exact live apply dispatch cores`);
    const standardCoreBefore = scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
      'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure
    ),'UTF8')),'hex')`, `${environment} exact standard apply SHA`);
    assert.equal(standardCoreBefore, target.standardCoreSha);

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

    succeed(file(container, MIGRATION), `${environment} apply corrected V3 migration`);
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

    const roles = roleNames(environment);
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

    succeed(file(container, OPTION_ROLE_MIGRATION), `${environment} apply V3 option-role compatibility migration`);
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
        fails(file(container, ROLLBACK), `${environment} rollback with live approval`, /rollback blocked by durable approval evidence/i);
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
      if (index === 0) fails(file(container, ROLLBACK), `${environment} rollback with consumed approval`, /rollback blocked by durable approval evidence/i);
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
    succeed(file(container, OPTION_ROLE_ROLLBACK), `${environment} rollback V3 option-role compatibility`);
    assert.equal(scalar(container, "select to_regprocedure('public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)') is null", `${environment} compatibility helper removed`), "t");
    assert.equal(scalar(container, `select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
      'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure
    ),'UTF8')),'hex')`, `${environment} restored standard apply SHA`), standardCoreBefore);
    succeed(file(container, ROLLBACK), `${environment} successful rollback`);
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
  } finally {
    run("docker", ["rm", "--force", container], 30_000);
  }
}

test("reviewed catalogue V3 independently wraps staging and production validator lineages", { timeout: 600_000 }, (t) => {
  if (!dockerAvailable()) return t.skip("Docker unavailable");
  exerciseBaseline("STAGING");
  exerciseBaseline("PRODUCTION");
});
