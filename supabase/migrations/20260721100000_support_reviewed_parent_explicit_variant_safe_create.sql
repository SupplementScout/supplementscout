begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.validate_product_import_plan_read_only(jsonb)') is null
     or to_regprocedure('public.apply_product_import_plan(jsonb)') is null
     or to_regprocedure('public.atomic_import_validate_standard_plan_core(jsonb)') is null
     or to_regprocedure('public.atomic_import_apply_standard_plan_core(jsonb)') is null then
    raise exception 'reviewed parent explicit-variant safe-create requires existing atomic import RPCs';
  end if;
  if to_regprocedure('public.atomic_import_validate_variant_plan_core(jsonb)') is not null
     or to_regprocedure('public.atomic_import_apply_variant_plan_core(jsonb)') is not null then
    raise exception 'reviewed parent explicit-variant core wrapper already exists';
  end if;
end
$preflight$;

alter function public.validate_product_import_plan_read_only(jsonb)
  rename to atomic_import_validate_variant_plan_core;

alter function public.apply_product_import_plan(jsonb)
  rename to atomic_import_apply_variant_plan_core;

create or replace function public.atomic_import_reviewed_parent_variant_allowed(
  p_name text,
  p_brand text,
  p_category text,
  p_format text,
  p_size_value text,
  p_size_unit text
) returns boolean
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from (values
      ('CNP Loaded Beef Protein 1.8kg','CNP','Whey Protein','powder','1800','g'),
      ('CNP Loaded ISO Collagen Protein 2kg','CNP','Whey Protein','powder','2000','g'),
      ('CNP Peptide Whey Protein Blend 2.27kg','CNP','Whey Protein','powder','2270','g'),
      ('CNP Premium Whey 2kg','CNP','Whey Protein','powder','2000','g'),
      ('CNP Premium Whey 900g','CNP','Whey Protein','powder','900','g'),
      ('CNP Whey Isolate 1.8kg','CNP','Whey Protein','powder','1800','g'),
      ('Strom StimuMAX Black Edition 360g','Strom','Pre Workout','powder','360','g'),
      ('Strom StimuMAX Extreme Pre Workout 390g','Strom','Pre Workout','powder','390','g'),
      ('Strom StimuMAX OG Pre Workout 360g','Strom','Pre Workout','powder','360','g'),
      ('Strom StimuMAX PRO Pre Workout 360g','Strom','Pre Workout','powder','360','g'),
      ('Strom VascuMAX PRO 470g','Strom','Pre Workout','powder','470','g')
    ) as allowed(name, brand, category, format, size_value, size_unit)
    where allowed.name = p_name
      and allowed.brand = p_brand
      and allowed.category = p_category
      and allowed.format = p_format
      and allowed.size_value::numeric is not distinct from nullif(p_size_value,'')::numeric
      and allowed.size_unit = lower(coalesce(p_size_unit,''))
  );
$$;

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
  v_retailer_id bigint;
  v_retailer_actual jsonb;
  v_product_id bigint;
  v_product_values jsonb;
  v_variant_values jsonb;
  v_evidence jsonb;
  v_mapping_values jsonb;
  v_external_product_id text;
  v_external_variant_id text;
  v_external_sku text;
  v_external_gtin text;
  v_external_url text;
  v_external_options jsonb;
  v_option_size text;
  v_option_flavour text;
  v_normalized_option_size jsonb;
  v_matching_products bigint;
begin
  if v_variant_action <> 'create_reviewed_variant' then
    return public.atomic_import_validate_variant_plan_core(p_plan);
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

  if v_product_action <> 'create_or_reuse_reviewed'
     or v_retailer_action <> 'existing'
     or v_mapping_action <> 'create'
     or v_offer_action <> 'create'
     or v_history_action <> 'create' then
    raise exception 'reviewed parent explicit-variant requires reviewed parent, existing retailer and new mapping/offer/history';
  end if;
  if not public.atomic_import_has_exact_keys(p_plan->'product', array['action','values'])
     or not public.atomic_import_has_exact_keys(p_plan->'retailer', array['action','id'])
     or not public.atomic_import_has_exact_keys(p_plan->'product_variant', array['action','values','evidence'])
     or not public.atomic_import_has_exact_keys(p_plan->'retailer_product', array['action','values'])
     or not public.atomic_import_has_exact_keys(p_plan->'offer', array['action','values'])
     or not public.atomic_import_has_exact_keys(p_plan->'price_history', array['action'])
     or not public.atomic_import_has_exact_keys(
       p_plan->'approval',
       array['approved','approval_type','approved_category','source_row_fingerprint','canonical_name','has_variant_evidence','approval_fingerprint']
     )
     or not public.atomic_import_has_exact_keys(p_plan->'expected_state', array['product','retailer','product_variant','retailer_product','offer'])
     or jsonb_typeof(p_plan#>'{expected_state,product}') <> 'null'
     or jsonb_typeof(p_plan#>'{expected_state,product_variant}') <> 'null'
     or jsonb_typeof(p_plan#>'{expected_state,retailer_product}') <> 'null'
     or jsonb_typeof(p_plan#>'{expected_state,offer}') <> 'null' then
    raise exception 'invalid product import plan: reviewed parent explicit-variant schema';
  end if;

  if p_plan#>'{approval,approved}' <> 'true'::jsonb
     or p_plan#>>'{approval,approval_type}' <> 'reviewed_parent_variant_safe_create'
     or p_plan#>>'{approval,source_row_fingerprint}' <> p_plan#>>'{meta,source_row_fingerprint}'
     or p_plan#>>'{approval,canonical_name}' <> p_plan#>>'{product,values,name}'
     or p_plan#>'{approval,has_variant_evidence}' <> 'true'::jsonb
     or md5(public.atomic_import_canonical_json(
       jsonb_set(p_plan->'approval', '{approval_fingerprint}', 'null'::jsonb, false)
     )) <> p_plan#>>'{approval,approval_fingerprint}' then
    raise exception 'product create requires valid reviewed parent explicit-variant approval';
  end if;

  v_product_values := p_plan#>'{product,values}';
  if not public.atomic_import_has_exact_keys(
    v_product_values,
    array['name','slug','brand','category','price','image','description','servings','net_weight_g','net_volume_ml','serving_count_verified','serving_size_g','serving_size_ml','protein_per_serving_g','creatine_per_serving_g','unit_count','unit_type','product_format','unit_pricing_verified','nutrition_verified','gtin']
  )
  or nullif(btrim(v_product_values->>'name'), '') is null
  or nullif(btrim(v_product_values->>'slug'), '') is null
  or nullif(btrim(v_product_values->>'brand'), '') is null
  or nullif(btrim(v_product_values->>'category'), '') is null
  or v_product_values->>'gtin' is not null
  or v_product_values->>'product_format' <> 'powder'
  or jsonb_typeof(v_product_values->'unit_pricing_verified') <> 'boolean'
  or jsonb_typeof(v_product_values->'nutrition_verified') <> 'boolean'
  or not public.atomic_import_is_decimal_string(v_product_values->>'price')
  or (v_product_values->>'price')::numeric <= 0
  or v_product_values->>'name' ~* '\m[0-9]+([.,][0-9]+)?\s*(kg|g|mg|mcg|iu|l|ml)\s*[-–]\s*[0-9]+([.,][0-9]+)?\s*(kg|g|mg|mcg|iu|l|ml)\M' then
    raise exception 'invalid product import plan: reviewed parent values';
  end if;

  v_variant_values := p_plan#>'{product_variant,values}';
  if not public.atomic_import_has_exact_keys(
    v_variant_values,
    array['variant_key','display_name','flavour_code','flavour_label','size_value','size_unit','pack_count','product_format']
  )
  or nullif(btrim(v_variant_values->>'variant_key'), '') is null
  or public.atomic_import_normalized_identity(v_variant_values->>'variant_key') = 'default'
  or nullif(btrim(v_variant_values->>'display_name'), '') is null
  or public.atomic_import_normalized_identity(v_variant_values->>'display_name') = 'default'
  or nullif(btrim(v_variant_values->>'flavour_code'), '') is null
  or nullif(btrim(v_variant_values->>'flavour_label'), '') is null
  or not public.atomic_import_is_decimal_string(v_variant_values->>'size_value')
  or (v_variant_values->>'size_value')::numeric <= 0
  or nullif(btrim(v_variant_values->>'size_unit'), '') is null
  or (v_variant_values->>'pack_count') !~ '^[1-9][0-9]*$'
  or v_variant_values->>'product_format' <> v_product_values->>'product_format' then
    raise exception 'invalid product import plan: reviewed parent variant values';
  end if;

  v_evidence := p_plan#>'{product_variant,evidence}';
  if not public.atomic_import_has_exact_keys(
    v_evidence,
    array['flavour','size_value','size_unit','pack_count','product_format','external_options','approved_mapping_id']
  )
  or jsonb_typeof(v_evidence->'external_options') not in ('object','null')
  or jsonb_typeof(v_evidence->'approved_mapping_id') <> 'null'
  or public.atomic_import_normalized_identity(v_evidence->>'flavour') is distinct from public.atomic_import_normalized_identity(v_variant_values->>'flavour_code')
  or nullif(v_evidence->>'size_value','')::numeric is distinct from (v_variant_values->>'size_value')::numeric
  or v_evidence->>'size_unit' is distinct from v_variant_values->>'size_unit'
  or coalesce(nullif(v_evidence->>'pack_count','')::integer, 1) is distinct from (v_variant_values->>'pack_count')::integer
  or v_evidence->>'product_format' is distinct from v_variant_values->>'product_format'
  or exists (
    select 1 from jsonb_each(case when jsonb_typeof(v_evidence->'external_options')='object'
      then v_evidence->'external_options' else '{}'::jsonb end)
    where jsonb_typeof(value) in ('object','array')
  ) then
    raise exception 'invalid product import plan: reviewed parent variant evidence';
  end if;
  select value into v_option_flavour
  from jsonb_each_text(case when jsonb_typeof(v_evidence->'external_options')='object'
    then v_evidence->'external_options' else '{}'::jsonb end)
  where lower(key) in ('flavour','flavor') limit 1;
  if v_option_flavour is null or public.atomic_import_normalized_identity(v_option_flavour)
     is distinct from public.atomic_import_normalized_identity(v_variant_values->>'flavour_code') then
    raise exception 'reviewed variant option flavour mismatch';
  end if;
  select value into v_option_size
  from jsonb_each_text(case when jsonb_typeof(v_evidence->'external_options')='object'
    then v_evidence->'external_options' else '{}'::jsonb end)
  where lower(key)='size' limit 1;
  if v_option_size is not null then
    v_normalized_option_size := public.atomic_import_normalize_size(v_option_size);
    if v_normalized_option_size is null
       or nullif(v_normalized_option_size->>'value','')::numeric is distinct from (v_variant_values->>'size_value')::numeric
       or v_normalized_option_size->>'unit' is distinct from v_variant_values->>'size_unit' then
      raise exception 'reviewed variant option size mismatch';
    end if;
  end if;

  if not public.atomic_import_reviewed_parent_variant_allowed(
    v_product_values->>'name',
    v_product_values->>'brand',
    v_product_values->>'category',
    v_product_values->>'product_format',
    v_variant_values->>'size_value',
    v_variant_values->>'size_unit'
  ) or p_plan#>>'{approval,approved_category}' is distinct from v_product_values->>'category' then
    raise exception 'reviewed parent explicit-variant policy does not allow this canonical family';
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
  or v_external_product_id !~ '^[0-9]{10,}$'
  or v_external_variant_id !~ '^[0-9]{10,}$'
  or v_external_product_id = v_external_variant_id
  or nullif(btrim(v_mapping_values->>'external_name'), '') is null
  or v_external_url is null
  or jsonb_typeof(v_mapping_values->'external_options') not in ('object','null')
  or jsonb_typeof(v_mapping_values->'product_variant_id') <> 'null'
  or coalesce(p_plan#>'{product_variant,evidence,external_options}', 'null'::jsonb)
     is distinct from coalesce(v_mapping_values->'external_options', 'null'::jsonb) then
    raise exception 'invalid product import plan: reviewed retailer product values';
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
  or p_plan#>'{offer,values,in_stock}' <> 'true'::jsonb
  or nullif(btrim(p_plan#>>'{offer,values,url}'), '') is null then
    raise exception 'invalid product import plan: reviewed offer values';
  end if;
  perform (p_plan#>>'{offer,values,last_checked_at}')::timestamptz;

  v_retailer_id := (p_plan#>>'{retailer,id}')::bigint;
  select jsonb_build_object('id',id::text,'name',name,'slug',slug,'website',website)
    into v_retailer_actual from public.retailers where id=v_retailer_id;
  if v_retailer_actual is null or v_retailer_actual is distinct from p_plan#>'{expected_state,retailer}' then
    raise exception 'stale product import plan: retailer';
  end if;
  if v_retailer_actual->>'slug' <> 'jon-s-supplements' then
    raise exception 'reviewed parent explicit-variant policy is Jon''s-only';
  end if;
  if v_external_url !~ ('^' || replace(v_retailer_actual->>'website', '.', '\.') || '/products/.*[?&]variant=' || v_external_variant_id || '(&|$)') then
    raise exception 'reviewed parent explicit-variant requires strict Shopify variant URL identity';
  end if;

  select count(*) into v_matching_products
  from public.products
  where public.atomic_import_normalized_identity(name)=public.atomic_import_normalized_identity(v_product_values->>'name')
     or slug = v_product_values->>'slug';
  if v_matching_products > 1 then
    raise exception 'reviewed parent explicit-variant duplicate canonical parent';
  end if;
  select id into v_product_id
  from public.products
  where public.atomic_import_normalized_identity(name)=public.atomic_import_normalized_identity(v_product_values->>'name')
     or slug = v_product_values->>'slug'
  limit 1;
  if v_product_id is not null then
    perform 1 from public.products
    where id=v_product_id
      and name=v_product_values->>'name'
      and slug=v_product_values->>'slug'
      and brand=v_product_values->>'brand'
      and category=v_product_values->>'category'
      and product_format is not distinct from v_product_values->>'product_format'
      and is_active
      and merged_into_product_id is null
      and merged_at is null;
    if not found then
      raise exception 'reviewed parent explicit-variant canonical parent collision';
    end if;
    if exists (
      select 1 from public.product_variants
      where product_id=v_product_id and is_active and (
        public.atomic_import_normalized_identity(variant_key)=public.atomic_import_normalized_identity(v_variant_values->>'variant_key')
        or public.atomic_import_normalized_identity(display_name)=public.atomic_import_normalized_identity(v_variant_values->>'display_name')
        or (
          public.atomic_import_normalized_identity(coalesce(flavour_code, flavour_label))=public.atomic_import_normalized_identity(v_variant_values->>'flavour_code')
          and size_value is not distinct from (v_variant_values->>'size_value')::numeric
          and lower(coalesce(size_unit,'')) is not distinct from lower(v_variant_values->>'size_unit')
          and coalesce(pack_count,1) is not distinct from (v_variant_values->>'pack_count')::integer
        )
      )
    ) then
      raise exception 'equivalent canonical product_variant already exists';
    end if;
  end if;

  if exists (
    select 1 from public.retailer_products
    where retailer_id=v_retailer_id and (
      external_variant_id=v_external_variant_id
      or external_url=v_external_url
      or (v_external_sku is not null and external_sku=v_external_sku and external_variant_id is distinct from v_external_variant_id)
    )
  ) then
    raise exception 'stale product import plan: retailer product identity';
  end if;
  if v_external_gtin is not null and exists (
    select 1 from public.retailer_products
    where external_gtin = v_external_gtin
      and (retailer_id is distinct from v_retailer_id
        or external_variant_id is distinct from v_external_variant_id)
  ) then
    raise exception 'reviewed parent explicit-variant GTIN conflict';
  end if;
  if concat_ws(' ', v_mapping_values->>'external_name', v_mapping_values->>'external_slug', v_external_url)
     ~* '\m(bundle|stack|with\s+free|plus\s+free|free\s+item|bbe|dated|best\s+before|short\s+date|short\s+dated)\M' then
    raise exception 'reviewed parent explicit-variant source row is bundle/free/BBE/dated';
  end if;

  return jsonb_build_object(
    'valid', true,
    'operation_type', 'standard_import',
    'product_action', 'create_or_reuse_reviewed',
    'retailer_id', v_retailer_id::text,
    'product_variant_action', 'create_reviewed_variant',
    'retailer_product_action', 'create',
    'offer_action', 'create',
    'price_history_action', 'create',
    'plan_fingerprint', p_plan#>>'{meta,plan_fingerprint}'
  );
end;
$validate_plan$;

create or replace function public.apply_product_import_plan(p_plan jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $apply_plan$
declare
  v_product_id bigint;
  v_retailer_id bigint;
  v_variant_id bigint;
  v_mapping_id bigint;
  v_offer_id bigint;
  v_history_id bigint;
  v_product_created boolean := false;
  v_product_values jsonb;
  v_variant_values jsonb;
begin
  if p_plan#>>'{product_variant,action}' <> 'create_reviewed_variant' then
    return public.atomic_import_apply_variant_plan_core(p_plan);
  end if;

  v_product_values := p_plan#>'{product,values}';
  v_variant_values := p_plan#>'{product_variant,values}';
  v_retailer_id := (p_plan#>>'{retailer,id}')::bigint;

  perform pg_advisory_xact_lock(hashtextextended(concat_ws('|','reviewed-parent',v_product_values->>'slug'), 0));
  perform pg_advisory_xact_lock(hashtextextended(concat_ws('|',v_retailer_id::text,p_plan#>>'{retailer_product,values,external_variant_id}'), 0));
  perform pg_advisory_xact_lock(hashtextextended(concat_ws('|',v_retailer_id::text,p_plan#>>'{retailer_product,values,external_sku}'), 0));
  perform pg_advisory_xact_lock(hashtextextended(concat_ws('|',v_retailer_id::text,p_plan#>>'{retailer_product,values,external_url}'), 0));

  perform public.validate_product_import_plan_read_only(p_plan);

  perform 1 from public.retailers where id=v_retailer_id for update;
  if not found then raise exception 'stale product import plan: retailer'; end if;

  select id into v_product_id
  from public.products
  where public.atomic_import_normalized_identity(name)=public.atomic_import_normalized_identity(v_product_values->>'name')
     or slug = v_product_values->>'slug'
  for update;

  if v_product_id is null then
    insert into public.products(
      name, slug, brand, category, price, image, description, servings,
      net_weight_g, net_volume_ml, serving_count_verified, serving_size_g,
      serving_size_ml, protein_per_serving_g, creatine_per_serving_g,
      unit_count, unit_type, product_format, unit_pricing_verified,
      nutrition_verified
    ) values (
      v_product_values->>'name', v_product_values->>'slug',
      v_product_values->>'brand', v_product_values->>'category',
      (v_product_values->>'price')::numeric,
      v_product_values->>'image', v_product_values->>'description',
      nullif(v_product_values->>'servings','')::integer,
      nullif(v_product_values->>'net_weight_g','')::numeric,
      nullif(v_product_values->>'net_volume_ml','')::numeric,
      nullif(v_product_values->>'serving_count_verified','')::integer,
      nullif(v_product_values->>'serving_size_g','')::numeric,
      nullif(v_product_values->>'serving_size_ml','')::numeric,
      nullif(v_product_values->>'protein_per_serving_g','')::numeric,
      nullif(v_product_values->>'creatine_per_serving_g','')::numeric,
      nullif(v_product_values->>'unit_count','')::integer,
      v_product_values->>'unit_type', v_product_values->>'product_format',
      (v_product_values->>'unit_pricing_verified')::boolean,
      (v_product_values->>'nutrition_verified')::boolean
    ) returning id into v_product_id;
    v_product_created := true;
  end if;

  perform public.validate_product_import_plan_read_only(p_plan);

  insert into public.product_variants(
    product_id, variant_key, display_name, flavour_code, flavour_label,
    size_value, size_unit, pack_count, product_format, gtin,
    nutrition_override, is_active, is_default
  ) values (
    v_product_id,
    v_variant_values->>'variant_key',
    v_variant_values->>'display_name',
    v_variant_values->>'flavour_code',
    v_variant_values->>'flavour_label',
    (v_variant_values->>'size_value')::numeric,
    v_variant_values->>'size_unit',
    (v_variant_values->>'pack_count')::integer,
    v_variant_values->>'product_format',
    null,
    '{}'::jsonb,
    true,
    false
  ) returning id into v_variant_id;

  insert into public.retailer_products(
    retailer_id, product_id, product_variant_id, external_name, external_slug,
    external_gtin, external_url, external_product_id, external_variant_id,
    external_sku, external_options, match_method, match_confidence
  ) values (
    v_retailer_id, v_product_id, v_variant_id,
    p_plan#>>'{retailer_product,values,external_name}',
    p_plan#>>'{retailer_product,values,external_slug}',
    p_plan#>>'{retailer_product,values,external_gtin}',
    p_plan#>>'{retailer_product,values,external_url}',
    p_plan#>>'{retailer_product,values,external_product_id}',
    p_plan#>>'{retailer_product,values,external_variant_id}',
    p_plan#>>'{retailer_product,values,external_sku}',
    case when jsonb_typeof(p_plan#>'{retailer_product,values,external_options}') = 'null'
      then null else p_plan#>'{retailer_product,values,external_options}' end,
    p_plan#>>'{retailer_product,values,match_method}',
    nullif(p_plan#>>'{retailer_product,values,match_confidence}','')::numeric
  ) returning id into v_mapping_id;

  insert into public.offers(
    product_id, retailer_id, product_variant_id, retailer_product_id,
    price, shipping_cost, total_price, url, in_stock, last_checked_at
  ) values (
    v_product_id, v_retailer_id, v_variant_id, v_mapping_id,
    (p_plan#>>'{offer,values,price}')::numeric,
    nullif(p_plan#>>'{offer,values,shipping_cost}','')::numeric,
    nullif(p_plan#>>'{offer,values,total_price}','')::numeric,
    p_plan#>>'{offer,values,url}',
    (p_plan#>>'{offer,values,in_stock}')::boolean,
    (p_plan#>>'{offer,values,last_checked_at}')::timestamptz
  ) returning id into v_offer_id;

  insert into public.price_history(offer_id, price, shipping_cost, total_price, checked_at)
  values (
    v_offer_id,
    (p_plan#>>'{offer,values,price}')::numeric,
    nullif(p_plan#>>'{offer,values,shipping_cost}','')::numeric,
    nullif(p_plan#>>'{offer,values,total_price}','')::numeric,
    (p_plan#>>'{offer,values,last_checked_at}')::timestamptz
  ) returning id into v_history_id;

  return jsonb_build_object(
    'product_id', v_product_id,
    'product_action', case when v_product_created then 'create' else 'reuse_existing_reviewed' end,
    'product_variant_id', v_variant_id,
    'product_variant_action', 'create_reviewed_variant',
    'retailer_id', v_retailer_id,
    'retailer_product_id', v_mapping_id,
    'offer_id', v_offer_id,
    'price_history_id', v_history_id,
    'retailer_product_action', 'create',
    'offer_action', 'create',
    'price_history_action', 'create',
    'plan_fingerprint', p_plan#>>'{meta,plan_fingerprint}'
  );
end;
$apply_plan$;

alter function public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text) owner to postgres;
alter function public.atomic_import_validate_variant_plan_core(jsonb) owner to postgres;
alter function public.atomic_import_apply_variant_plan_core(jsonb) owner to postgres;
alter function public.validate_product_import_plan_read_only(jsonb) owner to postgres;
alter function public.apply_product_import_plan(jsonb) owner to postgres;

revoke all on function public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text),
  public.atomic_import_validate_variant_plan_core(jsonb),public.atomic_import_apply_variant_plan_core(jsonb),
  public.validate_product_import_plan_read_only(jsonb),public.apply_product_import_plan(jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)
  to service_role;

commit;
