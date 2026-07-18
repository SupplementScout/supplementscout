begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.validate_product_import_plan_read_only(jsonb)') is null
     or to_regprocedure('public.apply_product_import_plan(jsonb)') is null
     or to_regprocedure('public.approve_product_import_plan(jsonb,text,text,text,timestamptz)') is null
     or to_regprocedure('public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)') is null
     or to_regclass('public.approved_import_plans') is null then
    raise exception 'verified no-change refresh requires the atomic importer and approval ledger';
  end if;
  if to_regprocedure('public.atomic_import_validate_standard_plan_core(jsonb)') is not null
     or to_regprocedure('public.atomic_import_apply_standard_plan_core(jsonb)') is not null
     or to_regclass('public.verified_offer_refresh_targets') is not null then
    raise exception 'verified no-change refresh migration is already installed';
  end if;
end
$preflight$;

-- Owner-provisioned attestation. A client/session setting cannot choose the target.
create table public.verified_offer_refresh_targets (
  id boolean primary key default true check(id),
  target_environment text not null check(target_environment in ('STAGING','PRODUCTION')),
  project_ref text not null check(
    (target_environment='STAGING' and project_ref='hxnrsyyqffztlvcrtgbf')
    or (target_environment='PRODUCTION' and project_ref='aftboxmrdgyhizicfsfu')
  ),
  database_system_identifier text not null,
  database_oid oid not null,
  is_active boolean not null default true,
  attested_by text not null,
  attested_at timestamptz not null default now()
);
alter table public.verified_offer_refresh_targets owner to postgres;
alter table public.verified_offer_refresh_targets enable row level security;
alter table public.verified_offer_refresh_targets force row level security;
revoke all on table public.verified_offer_refresh_targets from public,anon,authenticated,service_role;

-- Reuse the already deployed staging database attestation when present. Production
-- remains fail-closed until its own owner-provisioned attestation exists.
do $copy_existing_target$
begin
  if to_regclass('public.retailer_catalogue_database_targets') is not null then
    insert into public.verified_offer_refresh_targets(
      id,target_environment,project_ref,database_system_identifier,database_oid,is_active,attested_by,attested_at
    )
    select id,target_environment,project_ref,database_system_identifier,database_oid,is_active,
      'retailer_catalogue_database_targets:'||attested_by,attested_at
    from public.retailer_catalogue_database_targets
    where id=true and is_active and target_environment in ('STAGING','PRODUCTION')
      and ((target_environment='STAGING' and project_ref='hxnrsyyqffztlvcrtgbf')
        or (target_environment='PRODUCTION' and project_ref='aftboxmrdgyhizicfsfu'));
  end if;
end
$copy_existing_target$;

create or replace function public.verified_offer_refresh_actual_target()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $target$
declare
  v_target public.verified_offer_refresh_targets%rowtype;
  v_system text;
  v_oid oid;
begin
  select * into v_target from public.verified_offer_refresh_targets where id=true and is_active;
  if not found then raise exception 'verified no-change target attestation is missing'; end if;
  select system_identifier::text into v_system from pg_catalog.pg_control_system();
  select oid into v_oid from pg_catalog.pg_database where datname=current_database();
  if v_target.database_system_identifier is distinct from v_system
     or v_target.database_oid is distinct from v_oid
     or not ((v_target.target_environment='STAGING' and v_target.project_ref='hxnrsyyqffztlvcrtgbf')
       or (v_target.target_environment='PRODUCTION' and v_target.project_ref='aftboxmrdgyhizicfsfu')) then
    raise exception 'verified no-change target attestation rejected';
  end if;
  return jsonb_build_object('target_environment',v_target.target_environment,'project_ref',v_target.project_ref);
end
$target$;

create or replace function public.validate_verified_offer_no_change_plan(p_plan jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $validate$
declare
  v_target jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_retailer public.retailers%rowtype;
  v_mapping public.retailer_products%rowtype;
  v_offer public.offers%rowtype;
  v_expected jsonb;
  v_actual jsonb;
  v_capture timestamptz;
begin
  if not public.atomic_import_has_exact_keys(p_plan,array['meta','product','product_variant','retailer','retailer_product','offer','price_history','approval','expected_state'])
     or jsonb_path_exists(p_plan,'$.** ? (@.type() == "number")') then
    raise exception 'invalid verified no-change plan: closed decimal-string schema';
  end if;
  if not public.atomic_import_has_exact_keys(p_plan->'meta',array['version','plan_kind','operation_type','source_row_fingerprint','plan_fingerprint','target_environment','target_project_ref','source_snapshot_sha256','source_captured_at'])
     or p_plan#>>'{meta,version}'<>'2'
     or p_plan#>>'{meta,plan_kind}'<>'feed'
     or p_plan#>>'{meta,operation_type}'<>'verify_offer_no_change'
     or p_plan#>>'{meta,source_row_fingerprint}'!~'^[0-9a-f]{64}$'
     or p_plan#>>'{meta,source_snapshot_sha256}'!~'^[0-9a-f]{64}$'
     or p_plan#>>'{meta,plan_fingerprint}'!~'^[0-9a-f]{32}$'
     or md5(public.atomic_import_canonical_json(jsonb_set(p_plan,'{meta,plan_fingerprint}','null'::jsonb,false)))<>p_plan#>>'{meta,plan_fingerprint}' then
    raise exception 'invalid verified no-change plan: metadata or fingerprint';
  end if;
  v_capture:=(p_plan#>>'{meta,source_captured_at}')::timestamptz;
  if v_capture<now()-interval '24 hours' or v_capture>now()+interval '5 minutes' then
    raise exception 'verified no-change source capture is stale or in the future';
  end if;
  v_target:=public.verified_offer_refresh_actual_target();
  if v_target->>'target_environment' is distinct from p_plan#>>'{meta,target_environment}'
     or v_target->>'project_ref' is distinct from p_plan#>>'{meta,target_project_ref}' then
    raise exception 'verified no-change wrong target';
  end if;

  if not public.atomic_import_has_exact_keys(p_plan->'product',array['action','id']) or p_plan#>>'{product,action}'<>'existing'
     or not public.atomic_import_has_exact_keys(p_plan->'product_variant',array['action','id','evidence']) or p_plan#>>'{product_variant,action}'<>'existing'
     or not public.atomic_import_has_exact_keys(p_plan#>'{product_variant,evidence}',array['external_product_id','external_variant_id'])
     or not public.atomic_import_has_exact_keys(p_plan->'retailer',array['action','id']) or p_plan#>>'{retailer,action}'<>'existing'
     or not public.atomic_import_has_exact_keys(p_plan->'retailer_product',array['action','id','values']) or p_plan#>>'{retailer_product,action}'<>'noop'
     or not public.atomic_import_has_exact_keys(p_plan->'offer',array['action','id','values']) or p_plan#>>'{offer,action}'<>'verify_no_change'
     or not public.atomic_import_has_exact_keys(p_plan->'price_history',array['action']) or p_plan#>>'{price_history,action}'<>'noop'
     or p_plan->'approval'<>jsonb_build_object('approved',false,'approval_type','none')
     or not public.atomic_import_has_exact_keys(p_plan->'expected_state',array['product','retailer','product_variant','retailer_product','offer']) then
    raise exception 'invalid verified no-change plan: actions';
  end if;

  if not public.atomic_import_has_exact_keys(p_plan#>'{expected_state,product}',array['id','name','is_active','merged_into_product_id','product_format'])
     or not public.atomic_import_has_exact_keys(p_plan#>'{expected_state,retailer}',array['id','name','slug','website'])
     or not public.atomic_import_has_exact_keys(p_plan#>'{expected_state,product_variant}',array['id','product_id','variant_key','display_name','flavour_code','flavour_label','size_value','size_unit','pack_count','product_format','is_active','is_default'])
     or not public.atomic_import_has_exact_keys(p_plan#>'{expected_state,retailer_product}',array['id','retailer_id','product_id','product_variant_id','external_product_id','external_variant_id','external_sku','external_options','external_name','external_slug','external_gtin','external_url','match_method','match_confidence'])
     or not public.atomic_import_has_exact_keys(p_plan#>'{expected_state,offer}',array['id','product_id','retailer_id','product_variant_id','retailer_product_id','price','shipping_cost','total_price','in_stock','url','last_checked_at'])
     or p_plan#>'{retailer_product,values}' is distinct from p_plan#>'{expected_state,retailer_product}'
     or not public.atomic_import_has_exact_keys(p_plan#>'{offer,values}',array['price','shipping_cost','total_price','in_stock','url','last_checked_at']) then
    raise exception 'invalid verified no-change plan: expected state schema';
  end if;

  select * into v_product from public.products where id=(p_plan#>>'{product,id}')::bigint;
  select * into v_variant from public.product_variants where id=(p_plan#>>'{product_variant,id}')::bigint;
  select * into v_retailer from public.retailers where id=(p_plan#>>'{retailer,id}')::bigint;
  select * into v_mapping from public.retailer_products where id=(p_plan#>>'{retailer_product,id}')::bigint;
  select * into v_offer from public.offers where id=(p_plan#>>'{offer,id}')::bigint;
  if v_product.id is null or v_variant.id is null or v_retailer.id is null or v_mapping.id is null or v_offer.id is null then
    raise exception 'stale verified no-change plan: target missing';
  end if;

  v_actual:=jsonb_build_object('id',v_product.id::text,'name',v_product.name,'is_active',v_product.is_active,
    'merged_into_product_id',case when v_product.merged_into_product_id is null then null else to_jsonb(v_product.merged_into_product_id::text) end,
    'product_format',v_product.product_format);
  if v_actual is distinct from p_plan#>'{expected_state,product}' or not v_product.is_active or v_product.merged_into_product_id is not null then
    raise exception 'stale verified no-change plan: product';
  end if;
  v_actual:=jsonb_build_object('id',v_retailer.id::text,'name',v_retailer.name,'slug',v_retailer.slug,'website',v_retailer.website);
  if v_actual is distinct from p_plan#>'{expected_state,retailer}' then raise exception 'stale verified no-change plan: retailer'; end if;
  v_actual:=jsonb_build_object('id',v_variant.id::text,'product_id',v_variant.product_id::text,'variant_key',v_variant.variant_key,
    'display_name',v_variant.display_name,'flavour_code',v_variant.flavour_code,'flavour_label',v_variant.flavour_label,
    'size_value',case when v_variant.size_value is null then null else to_jsonb(public.atomic_import_decimal_string(v_variant.size_value)) end,
    'size_unit',v_variant.size_unit,'pack_count',case when v_variant.pack_count is null then null else to_jsonb(v_variant.pack_count::text) end,
    'product_format',v_variant.product_format,'is_active',v_variant.is_active,'is_default',v_variant.is_default);
  if v_actual is distinct from p_plan#>'{expected_state,product_variant}' or not v_variant.is_active then
    raise exception 'stale verified no-change plan: product variant';
  end if;
  v_actual:=jsonb_build_object('id',v_mapping.id::text,'retailer_id',v_mapping.retailer_id::text,'product_id',v_mapping.product_id::text,
    'product_variant_id',v_mapping.product_variant_id::text,'external_product_id',v_mapping.external_product_id,
    'external_variant_id',v_mapping.external_variant_id,'external_sku',v_mapping.external_sku,'external_options',v_mapping.external_options,
    'external_name',v_mapping.external_name,'external_slug',v_mapping.external_slug,'external_gtin',v_mapping.external_gtin,
    'external_url',v_mapping.external_url,'match_method',v_mapping.match_method,
    'match_confidence',case when v_mapping.match_confidence is null then null else to_jsonb(public.atomic_import_decimal_string(v_mapping.match_confidence)) end);
  if v_actual is distinct from p_plan#>'{expected_state,retailer_product}'
     or nullif(v_mapping.external_product_id,'') is null or nullif(v_mapping.external_variant_id,'') is null
     or v_mapping.external_product_id is distinct from p_plan#>>'{product_variant,evidence,external_product_id}'
     or v_mapping.external_variant_id is distinct from p_plan#>>'{product_variant,evidence,external_variant_id}'
     or (select count(*) from public.retailer_products where retailer_id=v_mapping.retailer_id and external_variant_id=v_mapping.external_variant_id)<>1 then
    raise exception 'verified no-change identity drift or duplicate identity';
  end if;
  v_actual:=jsonb_build_object('id',v_offer.id::text,'product_id',v_offer.product_id::text,'retailer_id',v_offer.retailer_id::text,
    'product_variant_id',v_offer.product_variant_id::text,'retailer_product_id',v_offer.retailer_product_id::text,
    'price',public.atomic_import_decimal_string(v_offer.price),
    'shipping_cost',case when v_offer.shipping_cost is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.shipping_cost)) end,
    'total_price',case when v_offer.total_price is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.total_price)) end,
    'in_stock',v_offer.in_stock,'url',v_offer.url,
    'last_checked_at',to_char(v_offer.last_checked_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
  if v_actual is distinct from p_plan#>'{expected_state,offer}'
     or v_offer.product_id is distinct from v_product.id or v_offer.retailer_id is distinct from v_retailer.id
     or v_offer.product_variant_id is distinct from v_variant.id or v_offer.retailer_product_id is distinct from v_mapping.id
     or v_mapping.product_id is distinct from v_product.id or v_mapping.product_variant_id is distinct from v_variant.id
     or v_mapping.retailer_id is distinct from v_retailer.id then
    raise exception 'stale verified no-change plan: offer identity or state';
  end if;
  if p_plan#>>'{offer,values,price}' is distinct from public.atomic_import_decimal_string(v_offer.price)
     or nullif(p_plan#>>'{offer,values,shipping_cost}','')::numeric is distinct from v_offer.shipping_cost
     or nullif(p_plan#>>'{offer,values,total_price}','')::numeric is distinct from v_offer.total_price
     or (p_plan#>>'{offer,values,in_stock}')::boolean is distinct from v_offer.in_stock
     or p_plan#>>'{offer,values,url}' is distinct from v_offer.url
     or v_mapping.external_url is distinct from v_offer.url
     or (p_plan#>>'{offer,values,last_checked_at}')::timestamptz is distinct from v_capture
     or v_capture<=v_offer.last_checked_at then
    raise exception 'verified no-change price, stock, URL, or timestamp mismatch';
  end if;
  return jsonb_build_object('valid',true,'operation_type','verify_offer_no_change','offer_id',v_offer.id::text,
    'previous_last_checked_at',v_offer.last_checked_at,'verified_last_checked_at',v_capture,
    'target_environment',v_target->>'target_environment','project_ref',v_target->>'project_ref');
end
$validate$;

alter function public.validate_product_import_plan_read_only(jsonb) rename to atomic_import_validate_standard_plan_core;
alter function public.apply_product_import_plan(jsonb) rename to atomic_import_apply_standard_plan_core;

create or replace function public.validate_product_import_plan_read_only(p_plan jsonb)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $wrapper$
begin
  if p_plan#>>'{meta,operation_type}'='verify_offer_no_change' then return public.validate_verified_offer_no_change_plan(p_plan); end if;
  return public.atomic_import_validate_standard_plan_core(p_plan);
end
$wrapper$;

create or replace function public.apply_verified_offer_no_change_plan(p_plan jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $apply_verify$
declare v_validation jsonb; v_offer_id bigint; v_updated integer;
begin
  v_offer_id:=(p_plan#>>'{offer,id}')::bigint;
  perform pg_catalog.pg_advisory_xact_lock(v_offer_id);
  perform 1 from public.offers where id=v_offer_id for update;
  v_validation:=public.validate_verified_offer_no_change_plan(p_plan);
  update public.offers set last_checked_at=(p_plan#>>'{offer,values,last_checked_at}')::timestamptz
  where id=v_offer_id and last_checked_at=(p_plan#>>'{expected_state,offer,last_checked_at}')::timestamptz;
  get diagnostics v_updated=row_count;
  if v_updated<>1 then raise exception 'stale verified no-change plan: concurrent offer change'; end if;
  return jsonb_build_object('product_id',p_plan#>>'{product,id}','product_variant_id',p_plan#>>'{product_variant,id}',
    'retailer_id',p_plan#>>'{retailer,id}','retailer_product_id',p_plan#>>'{retailer_product,id}','offer_id',v_offer_id,
    'retailer_product_action','noop','offer_action','verify_no_change','price_history_action','noop',
    'previous_last_checked_at',p_plan#>>'{expected_state,offer,last_checked_at}',
    'verified_last_checked_at',p_plan#>>'{offer,values,last_checked_at}',
    'plan_fingerprint',p_plan#>>'{meta,plan_fingerprint}','validation',v_validation);
end
$apply_verify$;

create or replace function public.apply_product_import_plan(p_plan jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $wrapper$
begin
  if p_plan#>>'{meta,operation_type}'='verify_offer_no_change' then return public.apply_verified_offer_no_change_plan(p_plan); end if;
  return public.atomic_import_apply_standard_plan_core(p_plan);
end
$wrapper$;

-- Rebind ledger functions to the wrappers above. The ledger schema and one-time
-- approval semantics remain unchanged.
create or replace function public.approve_product_import_plan(
  p_plan jsonb,p_artifact_sha256 text,p_run_id text,p_source text default 'supplementscout_importer',
  p_expires_at timestamptz default (now()+interval '15 minutes')) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $approve$
declare v_plan_fingerprint text;v_source_fingerprint text;v_plan_kind text;v_retailer_id bigint;v_id uuid;
begin
  if p_artifact_sha256!~'^[0-9a-f]{64}$' then raise exception 'approval requires a valid artifact SHA-256'; end if;
  if p_run_id!~'^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$' then raise exception 'approval requires a valid run ID'; end if;
  if nullif(trim(p_source),'') is null then raise exception 'approval source is required'; end if;
  if p_expires_at<=now() or p_expires_at>now()+interval '24 hours' then raise exception 'approval expiry must be within the next 24 hours'; end if;
  perform public.validate_product_import_plan_read_only(p_plan);
  v_plan_fingerprint:=p_plan#>>'{meta,plan_fingerprint}';v_source_fingerprint:=p_plan#>>'{meta,source_row_fingerprint}';
  v_plan_kind:=p_plan#>>'{meta,plan_kind}';v_retailer_id:=nullif(p_plan#>>'{retailer,id}','')::bigint;
  insert into public.approved_import_plans(artifact_sha256,run_id,plan_fingerprint,source_row_fingerprint,plan_kind,retailer_id,expires_at,source,plan_json)
  values(p_artifact_sha256,p_run_id,v_plan_fingerprint,v_source_fingerprint,v_plan_kind,v_retailer_id,p_expires_at,trim(p_source),p_plan) returning id into v_id;
  return jsonb_build_object('approval_id',v_id,'artifact_sha256',p_artifact_sha256,'run_id',p_run_id,'plan_fingerprint',v_plan_fingerprint,
    'source_row_fingerprint',v_source_fingerprint,'retailer_id',v_retailer_id::text,'plan_kind',v_plan_kind,'expires_at',p_expires_at,'status','approved');
end
$approve$;

create or replace function public.apply_approved_product_import_plan(
  p_approval_id uuid,p_artifact_sha256 text,p_plan_fingerprint text,p_source_row_fingerprint text,
  p_retailer_id bigint,p_plan_kind text,p_run_id text) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $apply_approved$
declare v_approval public.approved_import_plans%rowtype;v_result jsonb;v_consumed_at timestamptz;
begin
  select * into v_approval from public.approved_import_plans where id=p_approval_id for update;
  if not found then raise exception 'approved import plan not found'; end if;
  if v_approval.status<>'approved' or v_approval.consumed_at is not null then raise exception 'approved import plan already consumed'; end if;
  if v_approval.expires_at<=now() then raise exception 'approved import plan expired'; end if;
  if v_approval.artifact_sha256 is distinct from p_artifact_sha256 or v_approval.run_id is distinct from p_run_id
     or v_approval.plan_fingerprint is distinct from p_plan_fingerprint or v_approval.source_row_fingerprint is distinct from p_source_row_fingerprint
     or v_approval.retailer_id is distinct from p_retailer_id or v_approval.plan_kind is distinct from p_plan_kind then
    raise exception 'approved import plan metadata mismatch';
  end if;
  if v_approval.plan_fingerprint is distinct from v_approval.plan_json#>>'{meta,plan_fingerprint}'
     or v_approval.source_row_fingerprint is distinct from v_approval.plan_json#>>'{meta,source_row_fingerprint}'
     or v_approval.plan_kind is distinct from v_approval.plan_json#>>'{meta,plan_kind}'
     or v_approval.retailer_id is distinct from nullif(v_approval.plan_json#>>'{retailer,id}','')::bigint
     or md5(public.atomic_import_canonical_json(jsonb_set(v_approval.plan_json,'{meta,plan_fingerprint}','null'::jsonb,false)))<>v_approval.plan_fingerprint then
    raise exception 'approved import plan ledger integrity mismatch';
  end if;
  v_result:=public.apply_product_import_plan(v_approval.plan_json);
  update public.approved_import_plans set status='consumed',consumed_at=now() where id=v_approval.id returning consumed_at into v_consumed_at;
  return v_result||jsonb_build_object('approval_id',v_approval.id,'approval_status','consumed','consumed_at',v_consumed_at,
    'artifact_sha256',v_approval.artifact_sha256,'run_id',v_approval.run_id,'plan_fingerprint',v_approval.plan_fingerprint,
    'source_row_fingerprint',v_approval.source_row_fingerprint,'retailer_id',v_approval.retailer_id::text,'plan_kind',v_approval.plan_kind);
end
$apply_approved$;

alter function public.verified_offer_refresh_actual_target() owner to postgres;
alter function public.validate_verified_offer_no_change_plan(jsonb) owner to postgres;
alter function public.atomic_import_validate_standard_plan_core(jsonb) owner to postgres;
alter function public.validate_product_import_plan_read_only(jsonb) owner to postgres;
alter function public.apply_verified_offer_no_change_plan(jsonb) owner to postgres;
alter function public.atomic_import_apply_standard_plan_core(jsonb) owner to postgres;
alter function public.apply_product_import_plan(jsonb) owner to postgres;
alter function public.approve_product_import_plan(jsonb,text,text,text,timestamptz) owner to postgres;
alter function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) owner to postgres;

revoke all on function public.verified_offer_refresh_actual_target(),public.validate_verified_offer_no_change_plan(jsonb),
  public.atomic_import_validate_standard_plan_core(jsonb),public.validate_product_import_plan_read_only(jsonb),
  public.apply_verified_offer_no_change_plan(jsonb),public.atomic_import_apply_standard_plan_core(jsonb),
  public.apply_product_import_plan(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.approve_product_import_plan(jsonb,text,text,text,timestamptz),
  public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.approve_product_import_plan(jsonb,text,text,text,timestamptz),
  public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) to service_role;

commit;
