begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare
  v_target jsonb;
  v_definition text;
begin
  if to_regprocedure('public.retailer_catalogue_actual_database_target()') is not null then
    v_target:=public.retailer_catalogue_actual_database_target();
  else
    v_target:=public.verified_offer_refresh_actual_target();
  end if;

  if current_user<>'postgres'
     or v_target->>'target_environment' not in ('STAGING','PRODUCTION')
     or (v_target->>'target_environment'='STAGING' and v_target->>'project_ref' is distinct from 'hxnrsyyqffztlvcrtgbf')
     or (v_target->>'target_environment'='PRODUCTION' and v_target->>'project_ref' is distinct from 'aftboxmrdgyhizicfsfu')
     or (v_target ? 'database_identity' and v_target->>'database_identity' not in (
       'supplementscout-staging:hxnrsyyqffztlvcrtgbf',
       'supplementscout-production:aftboxmrdgyhizicfsfu'
     ))
     or to_regprocedure('public.validate_verified_offer_no_change_plan(jsonb)') is null
     or to_regprocedure('public.approve_product_import_plan(jsonb,text,text,text,timestamptz)') is null then
    raise exception 'verified no-change timestamp guard repair requires an attested owner target';
  end if;

  v_definition:=pg_get_functiondef('public.validate_verified_offer_no_change_plan(jsonb)'::regprocedure);
  if position($old$'last_checked_at',to_char(v_offer.last_checked_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))$old$ in v_definition)=0
     or position($old$v_actual is distinct from p_plan#>'{expected_state,offer}'$old$ in v_definition)=0 then
    raise exception 'verified no-change timestamp guard anchor is missing';
  end if;
end
$preflight$;

create or replace function public.verified_offer_refresh_required_timestamptz(
  p_value text,
  p_label text
) returns timestamptz
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $parse_timestamp$
begin
  if p_value is null then
    raise exception 'invalid verified no-change timestamp: % is required', p_label;
  end if;
  return p_value::timestamptz;
exception
  when others then
    raise exception 'invalid verified no-change timestamp: %', p_label;
end
$parse_timestamp$;

comment on function public.verified_offer_refresh_required_timestamptz(text,text) is
  'Fail-closed parser for verified offer refresh guards; equivalent timestamp representations are compared as PostgreSQL timestamptz instants without truncation.';

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
  v_actual jsonb;
  v_capture timestamptz;
  v_expected_offer_last_checked_at timestamptz;
  v_offer_values_last_checked_at timestamptz;
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
  v_capture:=public.verified_offer_refresh_required_timestamptz(p_plan#>>'{meta,source_captured_at}','meta.source_captured_at');
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

  v_expected_offer_last_checked_at:=public.verified_offer_refresh_required_timestamptz(
    p_plan#>>'{expected_state,offer,last_checked_at}',
    'expected_state.offer.last_checked_at'
  );
  v_offer_values_last_checked_at:=public.verified_offer_refresh_required_timestamptz(
    p_plan#>>'{offer,values,last_checked_at}',
    'offer.values.last_checked_at'
  );

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
    'in_stock',v_offer.in_stock,'url',v_offer.url);
  if v_actual is distinct from (p_plan#>'{expected_state,offer}' - 'last_checked_at')
     or v_expected_offer_last_checked_at is distinct from v_offer.last_checked_at
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
     or v_mapping.external_url is distinct from p_plan#>>'{retailer_product,values,external_url}'
     or v_offer_values_last_checked_at is distinct from v_capture
     or v_capture<=v_offer.last_checked_at then
    raise exception 'verified no-change price, stock, URL, or timestamp mismatch';
  end if;
  return jsonb_build_object('valid',true,'operation_type','verify_offer_no_change','offer_id',v_offer.id::text,
    'previous_last_checked_at',v_offer.last_checked_at,'verified_last_checked_at',v_capture,
    'target_environment',v_target->>'target_environment','project_ref',v_target->>'project_ref');
end
$validate$;

alter function public.verified_offer_refresh_required_timestamptz(text,text) owner to postgres;
alter function public.validate_verified_offer_no_change_plan(jsonb) owner to postgres;

revoke all on function public.verified_offer_refresh_required_timestamptz(text,text),
  public.validate_verified_offer_no_change_plan(jsonb) from public,anon,authenticated,service_role;

do $verify$
declare
  v_definition text:=pg_get_functiondef('public.validate_verified_offer_no_change_plan(jsonb)'::regprocedure);
begin
  if position($check$v_expected_offer_last_checked_at is distinct from v_offer.last_checked_at$check$ in v_definition)=0
     or position($check$p_plan#>'{expected_state,offer}' - 'last_checked_at'$check$ in v_definition)=0
     or position($check$v_actual is distinct from p_plan#>'{expected_state,offer}'$check$ in v_definition)>0
     or position($check$v_mapping.external_url is distinct from p_plan#>>'{retailer_product,values,external_url}'$check$ in v_definition)=0 then
    raise exception 'verified no-change timestamp guard repair verification failed';
  end if;
end
$verify$;

commit;
