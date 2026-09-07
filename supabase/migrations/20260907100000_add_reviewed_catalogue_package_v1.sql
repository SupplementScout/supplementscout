begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $preflight$
begin
  if to_regprocedure('public.validate_product_import_plan_read_only(jsonb)') is null
     or to_regprocedure('public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)') is null
     or to_regprocedure('public.atomic_import_canonical_json(jsonb)') is null
     or to_regclass('public.approved_import_plans') is null
     or to_regrole('retailer_catalogue_production_approver') is null then
    raise exception 'reviewed catalogue package prerequisites are missing';
  end if;
  if to_regprocedure('public.approve_reviewed_catalogue_import_plan(jsonb,text,text,text,text,timestamptz)') is not null
     or to_regprocedure('public.atomic_import_reviewed_catalogue_plan_allowed(jsonb)') is not null
     or to_regprocedure('public.atomic_import_validate_before_reviewed_catalogue_package(jsonb)') is not null then
    raise exception 'reviewed catalogue package is already installed';
  end if;
end
$preflight$;

alter function public.validate_product_import_plan_read_only(jsonb)
  rename to atomic_import_validate_before_reviewed_catalogue_package;

create function public.atomic_import_reviewed_catalogue_plan_allowed(p_plan jsonb)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $allowed$
  select exists (
    select 1
    from public.approved_import_plans a
    where a.status = 'approved'
      and a.consumed_at is null
      and a.expires_at > now()
      and a.source ~ '^reviewed-catalogue-package-v1:[A-Za-z0-9._-]+:[0-9a-f]{64}$'
      and a.plan_json = p_plan
      and a.plan_fingerprint = p_plan#>>'{meta,plan_fingerprint}'
      and a.source_row_fingerprint = p_plan#>>'{meta,source_row_fingerprint}'
      and a.plan_kind = p_plan#>>'{meta,plan_kind}'
      and a.retailer_id = nullif(p_plan#>>'{retailer,id}','')::bigint
      and md5(public.atomic_import_canonical_json(
        jsonb_set(p_plan,'{meta,plan_fingerprint}','null'::jsonb,false)
      )) = a.plan_fingerprint
  )
$allowed$;

create function public.validate_reviewed_catalogue_import_plan(p_plan jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $validate$
declare
  v_product_action text := p_plan#>>'{product,action}';
  v_variant_action text := p_plan#>>'{product_variant,action}';
  v_retailer_id bigint;
  v_product_id bigint;
  v_variant_id bigint;
  v_mapping jsonb := p_plan#>'{retailer_product,values}';
  v_offer jsonb := p_plan#>'{offer,values}';
  v_product_values jsonb := p_plan#>'{product,values}';
  v_variant_values jsonb := p_plan#>'{product_variant,values}';
  v_actual jsonb;
begin
  if not public.atomic_import_reviewed_catalogue_plan_allowed(p_plan) then
    raise exception 'reviewed catalogue plan is not bound to a live approval';
  end if;
  if not public.atomic_import_has_exact_keys(
       p_plan,array['meta','product','product_variant','retailer','retailer_product','offer','price_history','approval','expected_state'])
     or jsonb_path_exists(p_plan,'$.** ? (@.type() == "number")')
     or p_plan#>>'{meta,version}' <> '2'
     or p_plan#>>'{meta,plan_kind}' <> 'feed'
     or p_plan#>>'{meta,operation_type}' <> 'standard_import'
     or p_plan#>>'{meta,source_row_fingerprint}' !~ '^[0-9a-f]{64}$'
     or p_plan#>>'{meta,plan_fingerprint}' !~ '^[0-9a-f]{32}$'
     or md5(public.atomic_import_canonical_json(jsonb_set(p_plan,'{meta,plan_fingerprint}','null'::jsonb,false))) <> p_plan#>>'{meta,plan_fingerprint}' then
    raise exception 'invalid reviewed catalogue plan metadata';
  end if;
  if p_plan#>>'{retailer,action}' <> 'existing'
     or p_plan#>>'{retailer_product,action}' <> 'create'
     or p_plan#>>'{offer,action}' <> 'create'
     or p_plan#>>'{price_history,action}' <> 'create'
     or not (
       (v_product_action='existing' and v_variant_action in ('existing','create_variant'))
       or (v_product_action='create_or_reuse_reviewed' and v_variant_action='create_reviewed_variant')
       or (v_product_action='create' and v_variant_action='create_default')
     ) then
    raise exception 'reviewed catalogue action is not allowed';
  end if;
  if p_plan#>'{expected_state,retailer_product}' <> 'null'::jsonb
     or p_plan#>'{expected_state,offer}' <> 'null'::jsonb
     or nullif(btrim(v_mapping->>'external_product_id'),'') is null
     or nullif(btrim(v_mapping->>'external_variant_id'),'') is null
     or nullif(btrim(v_mapping->>'external_url'),'') is null
     or (v_mapping->>'external_url') !~ '^https://'
     or v_mapping->>'external_url' is distinct from v_offer->>'url'
     or (nullif(btrim(v_mapping->>'external_gtin'),'') is not null
       and nullif(btrim(v_mapping->>'external_gtin'),'') is not distinct from nullif(btrim(v_mapping->>'external_sku'),'')) then
    raise exception 'invalid reviewed catalogue source identity';
  end if;
  if not public.atomic_import_is_decimal_string(v_offer->>'price')
     or (v_offer->>'price')::numeric <= 0
     or not public.atomic_import_is_decimal_string(v_offer->>'shipping_cost')
     or (v_offer->>'shipping_cost')::numeric < 0
     or not public.atomic_import_is_decimal_string(v_offer->>'total_price')
     or (v_offer->>'total_price')::numeric is distinct from
       (v_offer->>'price')::numeric + (v_offer->>'shipping_cost')::numeric
     or jsonb_typeof(v_offer->'in_stock') <> 'boolean' then
    raise exception 'invalid reviewed catalogue price, shipping or stock';
  end if;
  perform (v_offer->>'last_checked_at')::timestamptz;
  v_retailer_id := (p_plan#>>'{retailer,id}')::bigint;
  select jsonb_build_object('id',id::text,'name',name,'slug',slug,'website',website)
    into v_actual from public.retailers where id=v_retailer_id;
  if v_actual is null or v_actual is distinct from p_plan#>'{expected_state,retailer}' then
    raise exception 'stale reviewed catalogue retailer';
  end if;
  if exists (
    select 1 from public.retailer_products rp
    where rp.retailer_id=v_retailer_id and (
      rp.external_variant_id=v_mapping->>'external_variant_id'
      or rp.external_url=v_mapping->>'external_url'
      or (nullif(v_mapping->>'external_sku','') is not null and rp.external_sku=v_mapping->>'external_sku')
    )
  ) then
    raise exception 'reviewed catalogue source mapping already exists';
  end if;
  if nullif(v_mapping->>'external_gtin','') is not null and exists (
    select 1 from public.retailer_products rp
    where rp.external_gtin=v_mapping->>'external_gtin'
      and (rp.retailer_id is distinct from v_retailer_id
        or rp.external_variant_id is distinct from v_mapping->>'external_variant_id')
  ) then
    raise exception 'reviewed catalogue GTIN conflicts with another source row';
  end if;
  if concat_ws(' ',v_mapping->>'external_name',v_mapping->>'external_slug',v_mapping->>'external_url')
     ~* '\m(bundle|stack|with\s+free|plus\s+free|free\s+item|bbe|dated|best\s+before|short\s+date|short\s+dated)\M' then
    raise exception 'reviewed catalogue source is excluded';
  end if;

  if v_product_action='existing' then
    v_product_id := (p_plan#>>'{product,id}')::bigint;
    select jsonb_build_object('id',id::text,'name',name,'is_active',is_active,
      'merged_into_product_id',merged_into_product_id::text,'product_format',product_format)
      into v_actual from public.products where id=v_product_id;
    if v_actual is null or v_actual is distinct from p_plan#>'{expected_state,product}'
       or v_actual->'is_active' <> 'true'::jsonb or v_actual->>'merged_into_product_id' is not null then
      raise exception 'stale or inactive reviewed catalogue product';
    end if;
  else
    if p_plan#>'{expected_state,product}' <> 'null'::jsonb
       or p_plan#>'{expected_state,product_variant}' <> 'null'::jsonb
       or nullif(btrim(v_product_values->>'name'),'') is null
       or nullif(btrim(v_product_values->>'slug'),'') is null
       or nullif(btrim(v_product_values->>'brand'),'') is null
       or nullif(btrim(v_product_values->>'category'),'') is null
       or nullif(btrim(v_product_values->>'product_format'),'') is null
       or v_product_values->>'gtin' is not null then
      raise exception 'invalid reviewed catalogue product creation';
    end if;
  end if;

  if v_variant_action='existing' then
    v_variant_id := (p_plan#>>'{product_variant,id}')::bigint;
    select jsonb_build_object('id',id::text,'product_id',product_id::text,'variant_key',variant_key,
      'display_name',display_name,'flavour_code',flavour_code,'flavour_label',flavour_label,
      'size_value',size_value::text,'size_unit',size_unit,'pack_count',pack_count::text,
      'product_format',product_format,'is_default',is_default,'is_active',is_active)
      into v_actual from public.product_variants where id=v_variant_id;
    if v_actual is null or v_actual is distinct from p_plan#>'{expected_state,product_variant}'
       or v_actual->'is_active' <> 'true'::jsonb
       or v_actual->>'product_id' is distinct from v_product_id::text
       or v_mapping->>'product_variant_id' is distinct from v_variant_id::text then
      raise exception 'stale or inactive reviewed catalogue variant';
    end if;
  elsif v_variant_action in ('create_variant','create_reviewed_variant') then
    if p_plan#>'{expected_state,product_variant}' <> 'null'::jsonb
       or nullif(btrim(v_variant_values->>'variant_key'),'') is null
       or nullif(btrim(v_variant_values->>'display_name'),'') is null
       or public.atomic_import_normalized_identity(v_variant_values->>'variant_key')='default'
       or public.atomic_import_normalized_identity(v_variant_values->>'display_name')='default'
       or not public.atomic_import_is_decimal_string(v_variant_values->>'size_value')
       or (v_variant_values->>'size_value')::numeric <= 0
       or nullif(btrim(v_variant_values->>'size_unit'),'') is null
       or (v_variant_values->>'pack_count') !~ '^[1-9][0-9]*$'
       or nullif(btrim(v_variant_values->>'product_format'),'') is null
       or v_mapping->'product_variant_id' <> 'null'::jsonb then
      raise exception 'invalid reviewed catalogue variant creation';
    end if;
    if v_product_action='existing' and exists (
      select 1 from public.product_variants pv
      where pv.product_id=v_product_id and pv.is_active=true
        and (pv.variant_key=v_variant_values->>'variant_key'
          or (pv.flavour_code is not distinct from v_variant_values->>'flavour_code'
            and pv.size_value is not distinct from (v_variant_values->>'size_value')::numeric
            and pv.size_unit is not distinct from v_variant_values->>'size_unit'
            and pv.pack_count is not distinct from (v_variant_values->>'pack_count')::integer))
    ) then
      raise exception 'equivalent reviewed catalogue variant already exists';
    end if;
  else
    if v_product_action<>'create'
       or p_plan#>'{expected_state,product_variant}' <> 'null'::jsonb
       or p_plan#>'{product_variant,values}' <> 'null'::jsonb
       or nullif(btrim(p_plan#>>'{product_variant,evidence,product_format}'),'') is null
       or v_mapping->'product_variant_id' <> 'null'::jsonb then
      raise exception 'invalid reviewed catalogue default variant creation';
    end if;
  end if;
  return jsonb_build_object('valid',true,'operation_type','standard_import',
    'product_action',v_product_action,'product_variant_action',v_variant_action,
    'retailer_id',v_retailer_id::text,'retailer_product_action','create',
    'offer_action','create','price_history_action','create',
    'plan_fingerprint',p_plan#>>'{meta,plan_fingerprint}');
end
$validate$;

create function public.validate_product_import_plan_read_only(p_plan jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $wrapper$
begin
  if public.atomic_import_reviewed_catalogue_plan_allowed(p_plan) then
    return public.validate_reviewed_catalogue_import_plan(p_plan);
  end if;
  return public.atomic_import_validate_before_reviewed_catalogue_package(p_plan);
end
$wrapper$;

create function public.approve_reviewed_catalogue_import_plan(
  p_plan jsonb,p_artifact_sha256 text,p_run_id text,p_manifest_sha256 text,p_profile_id text,
  p_expires_at timestamptz default (now()+interval '15 minutes')) returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $approve$
declare
  v_plan_fingerprint text := p_plan#>>'{meta,plan_fingerprint}';
  v_source_fingerprint text := p_plan#>>'{meta,source_row_fingerprint}';
  v_retailer_id bigint := nullif(p_plan#>>'{retailer,id}','')::bigint;
  v_id uuid;
  v_source text;
begin
  if p_artifact_sha256 !~ '^[0-9a-f]{64}$' or p_manifest_sha256 !~ '^[0-9a-f]{64}$'
     or p_run_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
     or p_profile_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
     or p_expires_at<=now() or p_expires_at>now()+interval '24 hours' then
    raise exception 'invalid reviewed catalogue approval identity or expiry';
  end if;
  v_source := 'reviewed-catalogue-package-v1:'||p_profile_id||':'||p_manifest_sha256;
  insert into public.approved_import_plans(
    artifact_sha256,run_id,plan_fingerprint,source_row_fingerprint,plan_kind,
    retailer_id,expires_at,source,plan_json
  ) values (
    p_artifact_sha256,p_run_id,v_plan_fingerprint,v_source_fingerprint,
    p_plan#>>'{meta,plan_kind}',v_retailer_id,p_expires_at,v_source,p_plan
  ) returning id into v_id;
  perform public.validate_reviewed_catalogue_import_plan(p_plan);
  return jsonb_build_object('approval_id',v_id,'artifact_sha256',p_artifact_sha256,
    'run_id',p_run_id,'plan_fingerprint',v_plan_fingerprint,
    'source_row_fingerprint',v_source_fingerprint,'retailer_id',v_retailer_id::text,
    'plan_kind',p_plan#>>'{meta,plan_kind}','expires_at',p_expires_at,'status','approved');
end
$approve$;

alter function public.atomic_import_reviewed_catalogue_plan_allowed(jsonb) owner to postgres;
alter function public.validate_reviewed_catalogue_import_plan(jsonb) owner to postgres;
alter function public.atomic_import_validate_before_reviewed_catalogue_package(jsonb) owner to postgres;
alter function public.validate_product_import_plan_read_only(jsonb) owner to postgres;
alter function public.approve_reviewed_catalogue_import_plan(jsonb,text,text,text,text,timestamptz) owner to postgres;

revoke all on function public.atomic_import_reviewed_catalogue_plan_allowed(jsonb),
  public.validate_reviewed_catalogue_import_plan(jsonb),
  public.atomic_import_validate_before_reviewed_catalogue_package(jsonb),
  public.validate_product_import_plan_read_only(jsonb),
  public.approve_reviewed_catalogue_import_plan(jsonb,text,text,text,text,timestamptz)
  from public,anon,authenticated,service_role,retailer_catalogue_production_approver,
    retailer_catalogue_production_executor,retailer_catalogue_production_validator;
grant execute on function public.validate_product_import_plan_read_only(jsonb)
  to retailer_catalogue_production_validator;
grant execute on function public.approve_reviewed_catalogue_import_plan(jsonb,text,text,text,text,timestamptz)
  to retailer_catalogue_production_approver;

do $postflight$
begin
  if not has_function_privilege('retailer_catalogue_production_approver',
       'public.approve_reviewed_catalogue_import_plan(jsonb,text,text,text,text,timestamptz)','execute')
     or not has_function_privilege('retailer_catalogue_production_validator',
       'public.validate_product_import_plan_read_only(jsonb)','execute')
     or has_function_privilege('service_role',
       'public.approve_reviewed_catalogue_import_plan(jsonb,text,text,text,text,timestamptz)','execute')
     or has_function_privilege('retailer_catalogue_production_executor',
       'public.approve_reviewed_catalogue_import_plan(jsonb,text,text,text,text,timestamptz)','execute')
     or has_function_privilege('retailer_catalogue_production_approver',
       'public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute') then
    raise exception 'reviewed catalogue package role separation failed';
  end if;
end
$postflight$;

commit;
