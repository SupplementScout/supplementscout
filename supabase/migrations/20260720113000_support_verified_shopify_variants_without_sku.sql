begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.validate_product_import_plan_read_only(p_plan jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $validate_plan$
declare
  v_product_action text := p_plan#>>'{product,action}';
  v_variant_action text := p_plan#>>'{product_variant,action}';
  v_retailer_action text := p_plan#>>'{retailer,action}';
  v_mapping_action text := p_plan#>>'{retailer_product,action}';
  v_offer_action text := p_plan#>>'{offer,action}';
  v_history_action text := p_plan#>>'{price_history,action}';
  v_product_id bigint;
  v_retailer_id bigint;
  v_expected jsonb;
  v_actual jsonb;
  v_product_actual jsonb;
  v_retailer_actual jsonb;
  v_evidence jsonb;
  v_values jsonb;
  v_mapping_values jsonb;
  v_option_size text;
  v_option_flavour text;
  v_normalized_option_size jsonb;
  v_external_product_id text;
  v_external_variant_id text;
  v_external_sku text;
  v_external_gtin text;
  v_external_url text;
  v_external_options jsonb;
begin
  if p_plan#>>'{meta,operation_type}' = 'verify_offer_no_change' then
    return public.validate_verified_offer_no_change_plan(p_plan);
  end if;

  if v_variant_action <> 'create_variant' then
    return public.atomic_import_validate_standard_plan_core(p_plan);
  end if;

  if not public.atomic_import_has_exact_keys(
    p_plan,
    array['meta','product','product_variant','retailer','retailer_product','offer','price_history','approval','expected_state']
  ) or jsonb_path_exists(p_plan, '$.** ? (@.type() == "number")') then
    raise exception 'invalid product import plan: closed decimal-string schema';
  end if;
  if not public.atomic_import_has_exact_keys(
    p_plan->'meta', array['version','plan_kind','operation_type','source_row_fingerprint','plan_fingerprint']
  ) or p_plan#>>'{meta,version}' <> '2'
    or p_plan#>>'{meta,plan_kind}' <> 'feed'
    or p_plan#>>'{meta,operation_type}' <> 'standard_import'
    or (p_plan#>>'{meta,source_row_fingerprint}') !~ '^[0-9a-f]{64}$'
    or (p_plan#>>'{meta,plan_fingerprint}') !~ '^[0-9a-f]{32}$'
    or md5(public.atomic_import_canonical_json(
      jsonb_set(p_plan, '{meta,plan_fingerprint}', 'null'::jsonb, false)
    )) <> p_plan#>>'{meta,plan_fingerprint}' then
    raise exception 'invalid product import plan: meta or fingerprint';
  end if;

  if v_product_action <> 'existing'
     or v_retailer_action <> 'existing'
     or v_mapping_action <> 'create'
     or v_offer_action <> 'create'
     or v_history_action <> 'create' then
    raise exception 'create_variant requires existing product/retailer and new mapping/offer/history';
  end if;
  if not public.atomic_import_has_exact_keys(p_plan->'product', array['action','id'])
     or not public.atomic_import_has_exact_keys(p_plan->'retailer', array['action','id'])
     or not public.atomic_import_has_exact_keys(p_plan->'product_variant', array['action','values','evidence'])
     or not public.atomic_import_has_exact_keys(p_plan->'retailer_product', array['action','values'])
     or not public.atomic_import_has_exact_keys(p_plan->'offer', array['action','values'])
     or not public.atomic_import_has_exact_keys(p_plan->'price_history', array['action'])
     or not public.atomic_import_has_exact_keys(p_plan->'approval', array['approved','approval_type'])
     or p_plan#>'{approval,approved}' <> 'false'::jsonb
     or p_plan#>>'{approval,approval_type}' <> 'none'
     or not public.atomic_import_has_exact_keys(p_plan->'expected_state', array['product','retailer','product_variant','retailer_product','offer'])
     or jsonb_typeof(p_plan#>'{expected_state,product_variant}') <> 'null'
     or jsonb_typeof(p_plan#>'{expected_state,retailer_product}') <> 'null'
     or jsonb_typeof(p_plan#>'{expected_state,offer}') <> 'null' then
    raise exception 'invalid product import plan: create_variant schema';
  end if;

  v_values := p_plan#>'{product_variant,values}';
  if not public.atomic_import_has_exact_keys(
    v_values,
    array['variant_key','display_name','flavour_code','flavour_label','size_value','size_unit','pack_count','product_format']
  )
  or jsonb_typeof(v_values->'variant_key') <> 'string'
  or nullif(btrim(v_values->>'variant_key'), '') is null
  or public.atomic_import_normalized_identity(v_values->>'variant_key') = 'default'
  or jsonb_typeof(v_values->'display_name') <> 'string'
  or nullif(btrim(v_values->>'display_name'), '') is null
  or public.atomic_import_normalized_identity(v_values->>'display_name') = 'default'
  or jsonb_typeof(v_values->'flavour_code') <> 'string'
  or nullif(btrim(v_values->>'flavour_code'), '') is null
  or jsonb_typeof(v_values->'flavour_label') <> 'string'
  or nullif(btrim(v_values->>'flavour_label'), '') is null
  or jsonb_typeof(v_values->'size_value') <> 'string'
  or not public.atomic_import_is_decimal_string(v_values->>'size_value')
  or (v_values->>'size_value')::numeric <= 0
  or jsonb_typeof(v_values->'size_unit') <> 'string'
  or nullif(btrim(v_values->>'size_unit'), '') is null
  or jsonb_typeof(v_values->'pack_count') <> 'string'
  or (v_values->>'pack_count') !~ '^[1-9][0-9]*$'
  or jsonb_typeof(v_values->'product_format') not in ('string','null') then
    raise exception 'invalid product import plan: create_variant values';
  end if;

  v_evidence := p_plan#>'{product_variant,evidence}';
  if not public.atomic_import_has_exact_keys(
    v_evidence,
    array['flavour','size_value','size_unit','pack_count','product_format','external_options','approved_mapping_id']
  )
  or jsonb_typeof(v_evidence->'external_options') not in ('object','null')
  or jsonb_typeof(v_evidence->'approved_mapping_id') <> 'null'
  or v_evidence->>'flavour' is null
  or public.atomic_import_normalized_identity(v_evidence->>'flavour') is distinct from public.atomic_import_normalized_identity(v_values->>'flavour_code')
  or nullif(v_evidence->>'size_value','')::numeric is distinct from (v_values->>'size_value')::numeric
  or v_evidence->>'size_unit' is distinct from v_values->>'size_unit'
  or coalesce(nullif(v_evidence->>'pack_count','')::integer, 1) is distinct from (v_values->>'pack_count')::integer
  or v_evidence->>'product_format' is distinct from v_values->>'product_format'
  or exists (
    select 1 from jsonb_each(case when jsonb_typeof(v_evidence->'external_options')='object'
      then v_evidence->'external_options' else '{}'::jsonb end)
    where jsonb_typeof(value) in ('object','array')
  ) then
    raise exception 'invalid product import plan: create_variant evidence';
  end if;
  select value into v_option_flavour
  from jsonb_each_text(case when jsonb_typeof(v_evidence->'external_options')='object'
    then v_evidence->'external_options' else '{}'::jsonb end)
  where lower(key) in ('flavour','flavor') limit 1;
  if v_option_flavour is not null and public.atomic_import_normalized_identity(v_option_flavour)
     is distinct from public.atomic_import_normalized_identity(v_values->>'flavour_code') then
    raise exception 'variant option flavour mismatch';
  end if;
  select value into v_option_size
  from jsonb_each_text(case when jsonb_typeof(v_evidence->'external_options')='object'
    then v_evidence->'external_options' else '{}'::jsonb end)
  where lower(key)='size' limit 1;
  if v_option_size is not null then
    v_normalized_option_size := public.atomic_import_normalize_size(v_option_size);
    if v_normalized_option_size is null
      or nullif(v_normalized_option_size->>'value','')::numeric is distinct from (v_values->>'size_value')::numeric
      or v_normalized_option_size->>'unit' is distinct from v_values->>'size_unit' then
      raise exception 'variant option size mismatch';
    end if;
  end if;

  v_mapping_values := p_plan#>'{retailer_product,values}';
  v_external_product_id := nullif(btrim(v_mapping_values->>'external_product_id'), '');
  v_external_variant_id := nullif(btrim(v_mapping_values->>'external_variant_id'), '');
  v_external_sku := nullif(btrim(v_mapping_values->>'external_sku'), '');
  v_external_gtin := nullif(btrim(v_mapping_values->>'external_gtin'), '');
  v_external_url := nullif(btrim(v_mapping_values->>'external_url'), '');
  v_external_options := case when jsonb_typeof(v_mapping_values->'external_options') = 'object'
    then v_mapping_values->'external_options' else '{}'::jsonb end;
  if not public.atomic_import_has_exact_keys(
    v_mapping_values,
    array['external_product_id','external_variant_id','external_sku','external_options','external_name','external_slug','external_gtin','external_url','match_method','match_confidence','product_variant_id']
  )
  or v_external_product_id is null
  or v_external_variant_id is null
  or nullif(btrim(v_mapping_values->>'external_name'), '') is null
  or v_external_url is null
  or jsonb_typeof(v_mapping_values->'external_options') not in ('object','null')
  or jsonb_typeof(v_mapping_values->'product_variant_id') <> 'null'
  or coalesce(p_plan#>'{product_variant,evidence,external_options}', 'null'::jsonb)
     is distinct from coalesce(v_mapping_values->'external_options', 'null'::jsonb) then
    raise exception 'invalid product import plan: retailer product values';
  end if;

  if not public.atomic_import_has_exact_keys(
    p_plan#>'{offer,values}', array['price','shipping_cost','total_price','url','in_stock','last_checked_at']
  )
  or not public.atomic_import_is_decimal_string(p_plan#>>'{offer,values,price}')
  or (p_plan#>>'{offer,values,price}')::numeric <= 0
  or (p_plan#>>'{offer,values,shipping_cost}' is not null and (
    not public.atomic_import_is_decimal_string(p_plan#>>'{offer,values,shipping_cost}')
    or (p_plan#>>'{offer,values,shipping_cost}')::numeric < 0))
  or (p_plan#>>'{offer,values,total_price}' is not null and (
    not public.atomic_import_is_decimal_string(p_plan#>>'{offer,values,total_price}')
    or (p_plan#>>'{offer,values,total_price}')::numeric < 0))
  or (p_plan#>>'{offer,values,shipping_cost}' is null) <> (p_plan#>>'{offer,values,total_price}' is null)
  or (p_plan#>>'{offer,values,total_price}' is not null and
      (p_plan#>>'{offer,values,total_price}')::numeric is distinct from
      (p_plan#>>'{offer,values,price}')::numeric + (p_plan#>>'{offer,values,shipping_cost}')::numeric)
  or jsonb_typeof(p_plan#>'{offer,values,in_stock}') <> 'boolean'
  or nullif(btrim(p_plan#>>'{offer,values,url}'), '') is null then
    raise exception 'invalid product import plan: offer values';
  end if;
  perform (p_plan#>>'{offer,values,last_checked_at}')::timestamptz;

  v_product_id := (p_plan#>>'{product,id}')::bigint;
  v_retailer_id := (p_plan#>>'{retailer,id}')::bigint;
  select jsonb_build_object('id',id::text,'name',name,'is_active',is_active,
    'merged_into_product_id',case when merged_into_product_id is null then null else to_jsonb(merged_into_product_id::text) end,
    'product_format',product_format)
    into v_product_actual from public.products where id=v_product_id;
  if v_product_actual is null or v_product_actual is distinct from p_plan#>'{expected_state,product}'
     or v_product_actual->>'is_active' <> 'true'
     or v_product_actual->>'merged_into_product_id' is not null then
    raise exception 'stale product import plan: product';
  end if;
  select jsonb_build_object('id',id::text,'name',name,'slug',slug,'website',website)
    into v_retailer_actual from public.retailers where id=v_retailer_id;
  if v_retailer_actual is null or v_retailer_actual is distinct from p_plan#>'{expected_state,retailer}' then
    raise exception 'stale product import plan: retailer';
  end if;

  if v_external_sku is null then
    if v_external_product_id !~ '^[0-9]{10,}$'
       or v_external_variant_id !~ '^[0-9]{10,}$'
       or v_external_product_id = v_external_variant_id
       or v_external_url !~ ('^' || replace(v_retailer_actual->>'website', '.', '\.') || '/products/.*[?&]variant=' || v_external_variant_id || '(&|$)')
       or (select count(*) from jsonb_each_text(v_external_options) where lower(key) in ('flavour','flavor')) <> 1
       or (select count(*) from jsonb_each_text(v_external_options) where lower(key) = 'size') <> 1 then
      raise exception 'create_variant without SKU requires strict Shopify product and variant identity';
    end if;
    if (v_product_actual->>'product_format') is not null
       and (v_values->>'product_format') is not null
       and (v_product_actual->>'product_format') is distinct from (v_values->>'product_format') then
      raise exception 'create_variant without SKU product format mismatch';
    end if;
    if concat_ws(' ', v_mapping_values->>'external_name', v_mapping_values->>'external_slug', v_external_url)
       ~* '\m(bundle|stack|with\s+free|plus\s+free|free\s+item|bbe|dated|best\s+before|short\s+date|short\s+dated)\M' then
      raise exception 'create_variant without SKU source row is bundle/free/BBE/dated';
    end if;
    if v_external_gtin is not null and exists (
      select 1 from public.retailer_products
      where external_gtin = v_external_gtin
        and (retailer_id is distinct from v_retailer_id
          or external_variant_id is distinct from v_external_variant_id)
    ) then
      raise exception 'create_variant without SKU GTIN conflict';
    end if;
  end if;

  if (select count(*) from public.product_variants where product_id=v_product_id and is_active and is_default) <> 1 then
    raise exception 'create_variant requires exactly one active default product_variant';
  end if;
  if exists (
    select 1 from public.product_variants
    where product_id=v_product_id and is_active and (
      public.atomic_import_normalized_identity(variant_key)=public.atomic_import_normalized_identity(v_values->>'variant_key')
      or public.atomic_import_normalized_identity(display_name)=public.atomic_import_normalized_identity(v_values->>'display_name')
      or (
        public.atomic_import_normalized_identity(coalesce(flavour_code, flavour_label))=public.atomic_import_normalized_identity(v_values->>'flavour_code')
        and size_value is not distinct from (v_values->>'size_value')::numeric
        and lower(coalesce(size_unit,'')) is not distinct from lower(v_values->>'size_unit')
        and coalesce(pack_count,1) is not distinct from (v_values->>'pack_count')::integer
      )
    )
  ) then
    raise exception 'equivalent canonical product_variant already exists';
  end if;
  if exists (
    select 1 from public.retailer_products
    where retailer_id=v_retailer_id and (
      external_variant_id=v_external_variant_id
      or external_url=v_external_url
    )
  ) then
    raise exception 'stale product import plan: retailer product identity';
  end if;

  return jsonb_build_object(
    'valid', true,
    'operation_type', 'standard_import',
    'product_id', v_product_id::text,
    'retailer_id', v_retailer_id::text,
    'product_variant_action', 'create_variant',
    'retailer_product_action', 'create',
    'offer_action', 'create',
    'price_history_action', 'create',
    'plan_fingerprint', p_plan#>>'{meta,plan_fingerprint}'
  );
end;
$validate_plan$;

alter function public.validate_product_import_plan_read_only(jsonb) owner to postgres;

commit;
