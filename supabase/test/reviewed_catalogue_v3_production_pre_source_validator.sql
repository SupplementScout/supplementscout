-- Exact PRODUCTION pg_get_functiondef capture.
-- Function SHA-256: fbd7752889269b8bdc4b57c729b3233ce17507c6f5766be7a150d99363a6bf87
CREATE OR REPLACE FUNCTION public.atomic_import_validate_pre_source_metadata_plan_core(p_plan jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
  if lower(coalesce(p_plan#>>'{product,values,name}','') || ' ' || coalesce(p_plan#>>'{product,values,brand}','')) ~ '(sarms?|ostarine|mk[- ]?2866|ligandrol|lgd[- ]?4033|testolone|rad[- ]?140|andarine|cardarine|gw[- ]?501516|ibutamoren|mk[- ]?677|yk[- ]?11|acp[- ]?105|s[- ]?23|sr[- ]?9009|bpc[- ]?157|tb[- ]?500|cjc[- ]?1295|ipamorelin|ghrp[- ]?[246]|hexarelin|sermorelin|tesamorelin|melanotan|retatrutide|optimised research labs (vi-ron|de-bol|20-hydrox|deep-sleep rem-08|an-var|pct-ex|zma-ex|t5-xs))' then
    raise exception 'prohibited catalogue type: SARM or peptide';
  end if;

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
  or (
    v_product_values->>'product_format' not in ('powder','bar')
    and not public.atomic_import_10reps_v10_parent_variant_transport_allowed(
      p_plan,
      jsonb_build_object(
        'id','14','name','10 Reps','slug','10-reps','website','https://www.10reps.co.uk/'
      )
    )
  )
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
  or (
    (
      v_external_product_id !~ '^[0-9]{10,}$'
      or v_external_variant_id !~ '^[0-9]{10,}$'
      or v_external_product_id = v_external_variant_id
    )
    and not public.atomic_import_10reps_v8_parent_variant_transport_allowed(
      p_plan,
      jsonb_build_object(
        'id','14','name','10 Reps','slug','10-reps','website','https://www.10reps.co.uk/'
      )
    )
    and not public.atomic_import_10reps_v9_parent_variant_transport_allowed(
      p_plan,
      jsonb_build_object(
        'id','14','name','10 Reps','slug','10-reps','website','https://www.10reps.co.uk/'
      )
    )
    and not public.atomic_import_10reps_v10_parent_variant_transport_allowed(
      p_plan,
      jsonb_build_object(
        'id','14','name','10 Reps','slug','10-reps','website','https://www.10reps.co.uk/'
      )
    )
  )
  -- 10 Reps short WooCommerce source IDs
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
  if v_retailer_actual->>'slug' = 'jon-s-supplements' then
    if v_external_url !~ ('^' || replace(v_retailer_actual->>'website', '.', '\.') || '/products/.*[?&]variant=' || v_external_variant_id || '(&|$)') then
      raise exception 'reviewed parent explicit-variant requires strict Shopify variant URL identity';
    end if;
  elsif public.atomic_import_10reps_v10_parent_variant_transport_allowed(
    p_plan,
    v_retailer_actual
  )
    or public.atomic_import_10reps_v9_parent_variant_transport_allowed(
      p_plan,
      v_retailer_actual
    )
    or public.atomic_import_10reps_v8_parent_variant_transport_allowed(
    p_plan,
    v_retailer_actual
  )
    or public.atomic_import_predators_v3_parent_variant_transport_allowed(
    p_plan,
    v_retailer_actual
  )
    or v_retailer_id = 13
    and v_retailer_actual = jsonb_build_object(
      'id','13',
      'name','Predators Gear',
      'slug','predators-gear',
      'website','https://predatorsgear.co.uk/'
    )
    and v_product_values->>'name' = 'DY Nutrition The Creatine Complex 316g'
    and v_product_values->>'slug' = 'dy-nutrition-the-creatine-complex-316g'
    and v_product_values->>'brand' = 'DY Nutrition'
    and v_product_values->>'category' = 'Creatine'
    and v_product_values->>'product_format' = 'powder'
    and p_plan#>>'{retailer_product,values,external_product_id}' = '8594181604892'
    and v_external_url = 'https://predatorsgear.co.uk/supplements-vitamins-shop/dorian-yates-the-creatine-complex-316g/'
    and p_plan#>>'{offer,values,url}' = v_external_url
    and (
      (v_external_variant_id = '8594181604895'
        and p_plan#>>'{retailer_product,values,external_sku}' = '5060763890503'
        and p_plan#>>'{retailer_product,values,external_gtin}' = '05060763890503'
        and p_plan#>>'{retailer_product,values,external_options,Flavour}' = 'Cherry'
        and p_plan#>>'{product_variant,values,flavour_label}' = 'Cherry')
      or (v_external_variant_id = '8594181604896'
        and p_plan#>>'{retailer_product,values,external_sku}' = '5060763890510'
        and p_plan#>>'{retailer_product,values,external_gtin}' = '05060763890510'
        and p_plan#>>'{retailer_product,values,external_options,Flavour}' = 'Peach'
        and p_plan#>>'{product_variant,values,flavour_label}' = 'Peach')
      or (v_external_variant_id = '8594181604897'
        and p_plan#>>'{retailer_product,values,external_sku}' = '5060763890527'
        and p_plan#>>'{retailer_product,values,external_gtin}' = '05060763890527'
        and p_plan#>>'{retailer_product,values,external_options,Flavour}' = 'Strawberry'
        and p_plan#>>'{product_variant,values,flavour_label}' = 'Strawberry')
    ) then
    null;
  else
    raise exception 'reviewed parent explicit-variant retailer and transport policy does not allow this plan';
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
    select 1 from public.retailer_products rp
    where rp.retailer_id=v_retailer_id and (
      rp.external_variant_id=v_external_variant_id
      or (v_external_sku is not null and rp.external_sku=v_external_sku and rp.external_variant_id is distinct from v_external_variant_id)
      or (
        rp.external_url=v_external_url
        and not (
          (
            v_retailer_id=13
            and v_product_values->>'name'='DY Nutrition The Creatine Complex 316g'
            and v_product_values->>'slug'='dy-nutrition-the-creatine-complex-316g'
            and v_product_values->>'brand'='DY Nutrition'
            and v_product_values->>'category'='Creatine'
            and v_product_values->>'product_format'='powder'
            and v_external_product_id='8594181604892'
            and v_external_variant_id in ('8594181604896','8594181604897')
            and v_external_url='https://predatorsgear.co.uk/supplements-vitamins-shop/dorian-yates-the-creatine-complex-316g/'
            and rp.product_id=1143
            and rp.external_product_id='8594181604892'
            and rp.external_url=v_external_url
            and (
              (rp.external_variant_id='8594181604895'
                and rp.external_sku='5060763890503'
                and rp.external_gtin='05060763890503'
                and rp.external_options=jsonb_build_object('Flavour','Cherry')
                and rp.product_variant_id=3188)
              or (rp.external_variant_id='8594181604896'
                and rp.external_sku='5060763890510'
                and rp.external_gtin='05060763890510'
                and rp.external_options=jsonb_build_object('Flavour','Peach')
                and exists (
                  select 1 from public.product_variants pv
                  where pv.id=rp.product_variant_id
                    and pv.product_id=1143
                    and pv.is_active
                    and not pv.is_default
                    and pv.flavour_label='Peach'
                    and pv.size_value=316
                    and lower(pv.size_unit)='g'
                ))
              or (rp.external_variant_id='8594181604897'
                and rp.external_sku='5060763890527'
                and rp.external_gtin='05060763890527'
                and rp.external_options=jsonb_build_object('Flavour','Strawberry')
                and exists (
                  select 1 from public.product_variants pv
                  where pv.id=rp.product_variant_id
                    and pv.product_id=1143
                    and pv.is_active
                    and not pv.is_default
                    and pv.flavour_label='Strawberry'
                    and pv.size_value=316
                    and lower(pv.size_unit)='g'
                ))
            )
          )
          or (
            public.atomic_import_predators_v3_parent_variant_transport_allowed(p_plan,v_retailer_actual)
            and (
              (
                v_external_product_id='8594181603360'
                and v_external_variant_id='8594181607205'
                and v_external_url='https://predatorsgear.co.uk/supplements-vitamins-shop/olimp-bcaa-xplode-powder-branched-chain-amino-acids-glutamine-vitamin-b6-leucine-1000g-500g-280g/'
                and rp.product_id=1158
                and rp.product_variant_id=3211
                and rp.external_product_id='8594181603360'
                and rp.external_variant_id='8594181603369'
                and rp.external_sku='5901330039614'
                and rp.external_gtin='05901330039614'
                and rp.external_options=jsonb_build_object('Flavour','Fruit Punch')
                and rp.external_url=v_external_url
                and exists (
                  select 1
                  from public.products p
                  join public.product_variants pv on pv.product_id=p.id
                  where p.id=1158 and p.is_active
                    and p.merged_into_product_id is null and p.merged_at is null
                    and pv.id=3211 and pv.is_active and not pv.is_default
                    and pv.flavour_label='Fruit Punch'
                    and pv.size_value=500 and lower(pv.size_unit)='g'
                )
              )
              or (
                v_external_product_id='8594181603396'
                and v_external_variant_id in ('8594181603400','8594181607759')
                and v_external_url='https://predatorsgear.co.uk/supplements-vitamins-shop/olimp-glutamine-xplode-powder-500g/'
                and rp.product_id=1159
                and rp.external_product_id='8594181603396'
                and rp.external_url=v_external_url
                and (
                  (
                    rp.product_variant_id=3212
                    and rp.external_variant_id='8594181603399'
                    and rp.external_sku='5901330024139'
                    and rp.external_gtin='05901330024139'
                    and rp.external_options=jsonb_build_object('Flavour','Lemon')
                    and exists (
                      select 1
                      from public.products p
                      join public.product_variants pv on pv.product_id=p.id
                      where p.id=1159 and p.is_active
                        and p.merged_into_product_id is null and p.merged_at is null
                        and pv.id=3212 and pv.is_active and not pv.is_default
                        and pv.flavour_label='Lemon'
                        and pv.size_value=500 and lower(pv.size_unit)='g'
                    )
                  )
                  or (
                    v_external_variant_id='8594181607759'
                    and rp.id=3008
                    and rp.product_variant_id=3215
                    and rp.external_variant_id='8594181603400'
                    and rp.external_sku='5901330024122'
                    and rp.external_gtin='05901330024122'
                    and rp.external_options=jsonb_build_object('Flavour','Orange')
                    and exists (
                      select 1
                      from public.products p
                      join public.product_variants pv on pv.product_id=p.id
                      where p.id=1159 and p.is_active
                        and p.merged_into_product_id is null and p.merged_at is null
                        and pv.id=3215 and pv.is_active and not pv.is_default
                        and pv.flavour_label='Orange'
                        and pv.size_value=500 and lower(pv.size_unit)='g'
                    )
                    and exists (
                      select 1 from public.offers o
                      where o.id=2821 and o.retailer_product_id=rp.id
                        and o.retailer_id=13 and o.product_id=1159
                        and o.product_variant_id=3215 and o.price=34.99
                        and o.shipping_cost=0 and o.total_price=34.99 and o.in_stock
                    )
                  )
                )
              )
            )
          )
        )
      )
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
$function$
;
