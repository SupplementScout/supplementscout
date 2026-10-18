CREATE OR REPLACE FUNCTION public.atomic_import_apply_variant_plan_core(p_plan jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  v_product_id bigint;
  v_retailer_id bigint;
  v_variant_id bigint;
  v_mapping_id bigint;
  v_offer_id bigint;
  v_history_id bigint;
  v_values jsonb;
begin
  if p_plan#>>'{meta,operation_type}' = 'verify_offer_no_change' then
    return public.apply_verified_offer_no_change_plan(p_plan);
  end if;

  if p_plan#>>'{product_variant,action}' <> 'create_variant' then
    return public.atomic_import_apply_standard_plan_core(p_plan);
  end if;

  v_product_id := (p_plan#>>'{product,id}')::bigint;
  v_retailer_id := (p_plan#>>'{retailer,id}')::bigint;
  v_values := p_plan#>'{product_variant,values}';

  perform pg_advisory_xact_lock(hashtextextended(concat_ws(
    '|',
    v_retailer_id::text,
    p_plan#>>'{retailer_product,values,external_variant_id}'
  ), 0));
  perform pg_advisory_xact_lock(hashtextextended(concat_ws(
    '|',
    v_retailer_id::text,
    p_plan#>>'{retailer_product,values,external_sku}'
  ), 0));
  perform pg_advisory_xact_lock(hashtextextended(concat_ws(
    '|',
    v_retailer_id::text,
    p_plan#>>'{retailer_product,values,external_url}'
  ), 0));

  perform public.validate_product_import_plan_read_only(p_plan);

  perform 1 from public.products
  where id=v_product_id and is_active and merged_into_product_id is null
  for update;
  if not found then raise exception 'stale product import plan: product'; end if;
  perform 1 from public.retailers where id=v_retailer_id for update;
  if not found then raise exception 'stale product import plan: retailer'; end if;

  insert into public.product_variants(
    product_id, variant_key, display_name, flavour_code, flavour_label,
    size_value, size_unit, pack_count, product_format, gtin,
    nutrition_override, is_active, is_default
  ) values (
    v_product_id,
    v_values->>'variant_key',
    v_values->>'display_name',
    v_values->>'flavour_code',
    v_values->>'flavour_label',
    (v_values->>'size_value')::numeric,
    v_values->>'size_unit',
    (v_values->>'pack_count')::integer,
    v_values->>'product_format',
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
    'product_variant_id', v_variant_id,
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
$function$

;
CREATE OR REPLACE FUNCTION public.atomic_import_apply_pre_source_metadata_plan_core(p_plan jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$

;
CREATE OR REPLACE FUNCTION public.apply_product_import_plan(p_plan jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  v_result jsonb;
begin
  if public.atomic_import_is_source_bound_offer_sync_plan(p_plan) then
    perform public.atomic_import_validate_source_bound_offer_sync_plan(p_plan);
    v_result := public.atomic_import_apply_pre_source_metadata_plan_core(
      public.atomic_import_source_bound_offer_sync_core_plan(p_plan)
    );
    return v_result || jsonb_build_object(
      'plan_fingerprint', p_plan#>>'{meta,plan_fingerprint}',
      'source_snapshot_sha256', p_plan#>>'{meta,source_snapshot_sha256}',
      'source_captured_at', p_plan#>>'{meta,source_captured_at}'
    );
  end if;
  return public.atomic_import_apply_pre_source_metadata_plan_core(p_plan);
end
$function$

;
