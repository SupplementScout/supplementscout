begin;

create or replace function public.validate_product_import_plan_read_only(p_plan jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $validate_plan$
declare
  v_product_action text;
  v_variant_action text;
  v_retailer_action text;
  v_mapping_action text;
  v_offer_action text;
  v_history_action text;
  v_expected jsonb;
  v_actual jsonb;
  v_retailer_id bigint;
  v_evidence jsonb;
  v_option_size text;
  v_option_flavour text;
  v_normalized_option_size jsonb;
  v_variant public.product_variants%rowtype;
begin
  if not public.atomic_import_has_exact_keys(
    p_plan,
    array['meta','product','product_variant','retailer','retailer_product','offer','price_history','approval','expected_state']
  ) or jsonb_path_exists(p_plan, '$.** ? (@.type() == "number")') then
    raise exception 'invalid product import plan: closed decimal-string schema';
  end if;
  if not public.atomic_import_has_exact_keys(
    p_plan->'meta', array['version','plan_kind','operation_type','source_row_fingerprint','plan_fingerprint']
  ) or p_plan#>>'{meta,version}' <> '2'
    or p_plan#>>'{meta,plan_kind}' not in ('feed','manual')
    or jsonb_typeof(p_plan#>'{meta,operation_type}') <> 'string'
    or p_plan#>>'{meta,operation_type}' not in ('standard_import','legacy_mapping_upgrade')
    or (p_plan#>>'{meta,operation_type}' = 'legacy_mapping_upgrade'
        and p_plan#>>'{meta,plan_kind}' <> 'feed')
    or (p_plan#>>'{meta,source_row_fingerprint}') !~ '^[0-9a-f]{64}$'
    or (p_plan#>>'{meta,plan_fingerprint}') !~ '^[0-9a-f]{32}$'
    or md5(public.atomic_import_canonical_json(
      jsonb_set(p_plan, '{meta,plan_fingerprint}', 'null'::jsonb, false)
    )) <> p_plan#>>'{meta,plan_fingerprint}' then
    raise exception 'invalid product import plan: meta or fingerprint';
  end if;

  v_product_action := p_plan#>>'{product,action}';
  v_variant_action := p_plan#>>'{product_variant,action}';
  v_retailer_action := p_plan#>>'{retailer,action}';
  v_mapping_action := p_plan#>>'{retailer_product,action}';
  v_offer_action := p_plan#>>'{offer,action}';
  v_history_action := p_plan#>>'{price_history,action}';
  if v_product_action not in ('existing','create')
    or v_variant_action not in ('existing','create_default')
    or v_retailer_action not in ('existing','create')
    or v_mapping_action not in ('create','update','noop')
    or v_offer_action not in ('create','update','noop')
    or v_history_action not in ('create','noop') then
    raise exception 'invalid product import plan: action';
  end if;
  if (v_product_action = 'existing' and not public.atomic_import_has_exact_keys(p_plan->'product', array['action','id']))
    or (v_product_action = 'create' and not public.atomic_import_has_exact_keys(p_plan->'product', array['action','values']))
    or (v_retailer_action = 'existing' and not public.atomic_import_has_exact_keys(p_plan->'retailer', array['action','id']))
    or (v_retailer_action = 'create' and not public.atomic_import_has_exact_keys(p_plan->'retailer', array['action','values']))
    or (v_variant_action = 'existing' and not public.atomic_import_has_exact_keys(p_plan->'product_variant', array['action','id','evidence']))
    or (v_variant_action = 'create_default' and not public.atomic_import_has_exact_keys(p_plan->'product_variant', array['action','evidence']))
    or (v_mapping_action = 'create' and not public.atomic_import_has_exact_keys(p_plan->'retailer_product', array['action','values']))
    or (v_mapping_action in ('update','noop') and not public.atomic_import_has_exact_keys(p_plan->'retailer_product', array['action','id','values']))
    or (v_offer_action = 'create' and not public.atomic_import_has_exact_keys(p_plan->'offer', array['action','values']))
    or (v_offer_action in ('update','noop') and not public.atomic_import_has_exact_keys(p_plan->'offer', array['action','id','values']))
    or not public.atomic_import_has_exact_keys(p_plan->'price_history', array['action'])
    or not public.atomic_import_has_exact_keys(p_plan->'expected_state', array['product','retailer','product_variant','retailer_product','offer']) then
    raise exception 'invalid product import plan: action schema';
  end if;

  if not public.atomic_import_has_exact_keys(
      p_plan#>'{product_variant,evidence}',
      array['flavour','size_value','size_unit','pack_count','product_format','external_options','approved_mapping_id']
    )
    or jsonb_typeof(p_plan#>'{product_variant,evidence,external_options}') not in ('object','null')
    or (p_plan#>>'{product_variant,evidence,size_value}' is not null and
        (not public.atomic_import_is_decimal_string(p_plan#>>'{product_variant,evidence,size_value}')
         or (p_plan#>>'{product_variant,evidence,size_value}')::numeric <= 0))
    or (p_plan#>>'{product_variant,evidence,pack_count}' is not null and
        (p_plan#>>'{product_variant,evidence,pack_count}') !~ '^[1-9][0-9]*$')
    or ((p_plan#>>'{product_variant,evidence,size_value}' is null) <>
        (p_plan#>>'{product_variant,evidence,size_unit}' is null)) then
    raise exception 'invalid product import plan: variant evidence';
  end if;
  v_evidence := p_plan#>'{product_variant,evidence}';
  if exists (
    select 1 from jsonb_each(case when jsonb_typeof(v_evidence->'external_options')='object'
      then v_evidence->'external_options' else '{}'::jsonb end)
    where jsonb_typeof(value) in ('object','array')
  ) then
    raise exception 'invalid product import plan: nested external options';
  end if;
  select value into v_option_size
  from jsonb_each_text(case when jsonb_typeof(v_evidence->'external_options')='object'
    then v_evidence->'external_options' else '{}'::jsonb end)
  where lower(key)='size' limit 1;
  if v_option_size is not null then
    v_normalized_option_size := public.atomic_import_normalize_size(v_option_size);
    if v_normalized_option_size is null
      or nullif(v_normalized_option_size->>'value','')::numeric is distinct from
         nullif(v_evidence->>'size_value','')::numeric
      or v_normalized_option_size->>'unit' is distinct from v_evidence->>'size_unit' then
      raise exception 'variant option size mismatch';
    end if;
  end if;
  if not public.atomic_import_has_exact_keys(
      p_plan#>'{offer,values}', array['price','shipping_cost','total_price','url','in_stock','last_checked_at']
    )
    or not public.atomic_import_is_decimal_string(p_plan#>>'{offer,values,price}')
    or (p_plan#>>'{offer,values,price}')::numeric <= 0
    or (p_plan#>>'{offer,values,shipping_cost}' is not null and
        (not public.atomic_import_is_decimal_string(p_plan#>>'{offer,values,shipping_cost}')
         or (p_plan#>>'{offer,values,shipping_cost}')::numeric < 0))
    or (p_plan#>>'{offer,values,total_price}' is not null and
        (not public.atomic_import_is_decimal_string(p_plan#>>'{offer,values,total_price}')
         or (p_plan#>>'{offer,values,total_price}')::numeric < 0))
    or jsonb_typeof(p_plan#>'{offer,values,in_stock}') <> 'boolean'
    or nullif(btrim(p_plan#>>'{offer,values,url}'), '') is null then
    raise exception 'invalid product import plan: offer values';
  end if;
  if not (
      p_plan#>>'{meta,operation_type}' = 'legacy_mapping_upgrade'
      and v_offer_action = 'noop'
      and v_history_action = 'noop'
      and p_plan#>>'{offer,values,shipping_cost}' is not null
      and p_plan#>>'{offer,values,total_price}' is null
      and p_plan#>>'{expected_state,offer,total_price}' is null
      and (p_plan#>>'{offer,values,price}')::numeric is not distinct from
        nullif(p_plan#>>'{expected_state,offer,price}','')::numeric
      and (p_plan#>>'{offer,values,shipping_cost}')::numeric is not distinct from
        nullif(p_plan#>>'{expected_state,offer,shipping_cost}','')::numeric
    ) and (
      (p_plan#>>'{offer,values,shipping_cost}' is null) <>
       (p_plan#>>'{offer,values,total_price}' is null)
      or (p_plan#>>'{offer,values,total_price}' is not null and
          (p_plan#>>'{offer,values,total_price}')::numeric is distinct from
          (p_plan#>>'{offer,values,price}')::numeric + (p_plan#>>'{offer,values,shipping_cost}')::numeric)
    ) then
    raise exception 'invalid product import plan: offer total';
  end if;
  perform (p_plan#>>'{offer,values,last_checked_at}')::timestamptz;
  if v_history_action = 'create' and not (
      v_offer_action = 'create'
      or v_offer_action = 'update' and (
        (p_plan#>>'{offer,values,price}')::numeric is distinct from
          nullif(p_plan#>>'{expected_state,offer,price}','')::numeric
        or nullif(p_plan#>>'{offer,values,shipping_cost}','')::numeric is distinct from
          nullif(p_plan#>>'{expected_state,offer,shipping_cost}','')::numeric
        or nullif(p_plan#>>'{offer,values,total_price}','')::numeric is distinct from
          nullif(p_plan#>>'{expected_state,offer,total_price}','')::numeric
      )
    ) then
    raise exception 'price history create requires a price change';
  end if;
  if v_history_action = 'noop' and (
      v_offer_action = 'create'
      or v_offer_action = 'update' and (
        (p_plan#>>'{offer,values,price}')::numeric is distinct from
          nullif(p_plan#>>'{expected_state,offer,price}','')::numeric
        or nullif(p_plan#>>'{offer,values,shipping_cost}','')::numeric is distinct from
          nullif(p_plan#>>'{expected_state,offer,shipping_cost}','')::numeric
        or nullif(p_plan#>>'{offer,values,total_price}','')::numeric is distinct from
          nullif(p_plan#>>'{expected_state,offer,total_price}','')::numeric
      )
    ) then
    raise exception 'price change requires price history';
  end if;

  if v_product_action = 'create' then
    if p_plan#>>'{meta,plan_kind}' <> 'feed'
      or not public.atomic_import_has_exact_keys(
        p_plan->'approval',
        array['approved','approval_type','approved_category','source_row_fingerprint','canonical_name','has_variant_evidence','approval_fingerprint']
      )
      or p_plan#>'{approval,approved}' <> 'true'::jsonb
      or p_plan#>>'{approval,approval_type}' <> 'safe_create'
      or p_plan#>>'{approval,approved_category}' <> p_plan#>>'{product,values,category}'
      or p_plan#>>'{approval,approved_category}' not in ('Vitamins','Health Supplements','Amino Acids','Creatine')
      or p_plan#>>'{approval,source_row_fingerprint}' <> p_plan#>>'{meta,source_row_fingerprint}'
      or p_plan#>>'{approval,canonical_name}' <> p_plan#>>'{product,values,name}'
      or p_plan#>'{approval,has_variant_evidence}' <> 'false'::jsonb
      or md5(public.atomic_import_canonical_json(
        jsonb_set(p_plan->'approval', '{approval_fingerprint}', 'null'::jsonb, false)
      )) <> p_plan#>>'{approval,approval_fingerprint}' then
      raise exception 'product create requires valid safe-create approval';
    end if;
  elsif not public.atomic_import_has_exact_keys(p_plan->'approval', array['approved','approval_type'])
    or p_plan#>'{approval,approved}' <> 'false'::jsonb
    or p_plan#>>'{approval,approval_type}' <> 'none' then
    raise exception 'existing product cannot carry safe-create approval';
  end if;

  if v_retailer_action = 'existing' then
    select jsonb_build_object('id',id::text,'name',name,'slug',slug,'website',website)
      into v_actual from public.retailers where id=(p_plan#>>'{retailer,id}')::bigint;
    v_expected := p_plan#>'{expected_state,retailer}';
    if v_actual is null or v_actual is distinct from v_expected then raise exception 'stale product import plan: retailer'; end if;
    v_retailer_id := (p_plan#>>'{retailer,id}')::bigint;
  elsif p_plan#>'{expected_state,retailer}' <> 'null'::jsonb then
    raise exception 'invalid product import plan: retailer expected state';
  end if;
  if v_product_action = 'existing' then
    select jsonb_build_object('id',id::text,'name',name,'is_active',is_active,
      'merged_into_product_id',case when merged_into_product_id is null then null else to_jsonb(merged_into_product_id::text) end,
      'product_format',product_format)
      into v_actual from public.products where id=(p_plan#>>'{product,id}')::bigint;
    if v_actual is null or v_actual is distinct from p_plan#>'{expected_state,product}' then raise exception 'stale product import plan: product'; end if;
  elsif p_plan#>'{expected_state,product}' <> 'null'::jsonb then
    raise exception 'invalid product import plan: product expected state';
  end if;
  if v_variant_action = 'existing' then
    select * into v_variant from public.product_variants
    where id=(p_plan#>>'{product_variant,id}')::bigint;
    if not found then raise exception 'stale product import plan: product variant'; end if;
    if v_variant.is_default then
      if (
        v_evidence->>'flavour' is not null or v_evidence->>'size_value' is not null
        or exists(select 1 from public.product_variants where product_id=v_variant.product_id and is_active and not is_default)
      ) and not public.atomic_import_is_legacy_mapping_upgrade(p_plan) then
        raise exception 'variant evidence does not match default product variant';
      end if;
    else
      if v_evidence->>'flavour' is not null and lower(v_evidence->>'flavour') not in
        (lower(coalesce(v_variant.flavour_code,'')),lower(coalesce(v_variant.flavour_label,''))) then
        raise exception 'variant evidence flavour mismatch';
      end if;
      if v_evidence->>'size_value' is not null and (
        (v_evidence->>'size_value')::numeric is distinct from v_variant.size_value
        or lower(coalesce(v_evidence->>'size_unit','')) is distinct from lower(coalesce(v_variant.size_unit,''))) then
        raise exception 'variant evidence size mismatch';
      end if;
      if v_evidence->>'pack_count' is not null and v_variant.pack_count is not null and v_variant.pack_count <> 1
        and (v_evidence->>'pack_count')::integer is distinct from v_variant.pack_count then
        raise exception 'variant evidence pack mismatch';
      end if;
      if v_evidence->>'product_format' is not null and v_variant.product_format is not null
        and lower(v_evidence->>'product_format') is distinct from lower(v_variant.product_format) then
        raise exception 'variant evidence format mismatch';
      end if;
      if v_evidence->>'approved_mapping_id' is null and (
        ((v_variant.flavour_code is not null or v_variant.flavour_label is not null) and v_evidence->>'flavour' is null)
        or (v_variant.size_value is not null and v_evidence->>'size_value' is null)
        or (v_variant.pack_count is not null and v_variant.pack_count <> 1 and v_evidence->>'pack_count' is null)
        or (v_variant.product_format is not null and v_evidence->>'product_format' is null)
      ) then raise exception 'non-default variant requires complete distinguishing evidence'; end if;
      if v_evidence->>'approved_mapping_id' is not null and (
        v_mapping_action not in ('update','noop')
        or (v_evidence->>'approved_mapping_id')::bigint is distinct from (p_plan#>>'{retailer_product,id}')::bigint
      ) then raise exception 'approved mapping evidence mismatch'; end if;
    end if;
    select lower(value) into v_option_flavour
    from jsonb_each_text(case when jsonb_typeof(v_evidence->'external_options')='object'
      then v_evidence->'external_options' else '{}'::jsonb end)
    where lower(key) in ('flavour','flavor') limit 1;
    if v_option_flavour is not null and not v_variant.is_default and v_option_flavour not in
      (lower(coalesce(v_variant.flavour_code,'')),lower(coalesce(v_variant.flavour_label,''))) then
      raise exception 'variant option flavour mismatch';
    end if;
    select jsonb_build_object('id',id::text,'product_id',product_id::text,'variant_key',variant_key,
      'display_name',display_name,'flavour_code',flavour_code,'flavour_label',flavour_label,
      'size_value',case when size_value is null then null else to_jsonb(public.atomic_import_decimal_string(size_value)) end,
      'size_unit',size_unit,'pack_count',case when pack_count is null then null else to_jsonb(pack_count::text) end,
      'product_format',product_format,'is_active',is_active,'is_default',is_default)
      into v_actual from public.product_variants where id=(p_plan#>>'{product_variant,id}')::bigint;
    if v_actual is null or v_actual is distinct from p_plan#>'{expected_state,product_variant}' then raise exception 'stale product import plan: product variant'; end if;
  elsif p_plan#>'{expected_state,product_variant}' <> 'null'::jsonb then
    raise exception 'invalid product import plan: product variant expected state';
  end if;
  if v_mapping_action in ('update','noop') then
    select jsonb_build_object('id',id::text,'retailer_id',retailer_id::text,'product_id',product_id::text,
      'product_variant_id',case when product_variant_id is null then null else to_jsonb(product_variant_id::text) end,
      'updated_at',updated_at,'external_product_id',external_product_id,'external_variant_id',external_variant_id,
      'external_sku',external_sku,'external_options',external_options,'external_name',external_name,
      'external_slug',external_slug,'external_gtin',external_gtin,'external_url',external_url,
      'match_method',match_method,'match_confidence',case when match_confidence is null then null else to_jsonb(public.atomic_import_decimal_string(match_confidence)) end)
      into v_actual from public.retailer_products where id=(p_plan#>>'{retailer_product,id}')::bigint;
    if v_actual is not null and (v_actual->>'updated_at')::timestamptz is not distinct from
       (p_plan#>>'{expected_state,retailer_product,updated_at}')::timestamptz then
      v_actual := jsonb_set(v_actual, '{updated_at}', p_plan#>'{expected_state,retailer_product,updated_at}', false);
    end if;
    if v_actual is null or v_actual is distinct from p_plan#>'{expected_state,retailer_product}' then raise exception 'stale product import plan: retailer product'; end if;
  elsif p_plan#>'{expected_state,retailer_product}' <> 'null'::jsonb then
    raise exception 'invalid product import plan: retailer product expected state';
  end if;
  if v_offer_action in ('update','noop') then
    select jsonb_build_object('id',id::text,'product_id',product_id::text,'retailer_id',retailer_id::text,
      'product_variant_id',case when product_variant_id is null then null else to_jsonb(product_variant_id::text) end,
      'retailer_product_id',case when retailer_product_id is null then null else to_jsonb(retailer_product_id::text) end,
      'price',public.atomic_import_decimal_string(price),
      'shipping_cost',case when shipping_cost is null then null else to_jsonb(public.atomic_import_decimal_string(shipping_cost)) end,
      'total_price',case when total_price is null then null else to_jsonb(public.atomic_import_decimal_string(total_price)) end,
      'in_stock',in_stock,'url',url,'last_checked_at',last_checked_at)
      into v_actual from public.offers where id=(p_plan#>>'{offer,id}')::bigint;
    if v_actual is not null and (v_actual->>'last_checked_at')::timestamptz is not distinct from
       (p_plan#>>'{expected_state,offer,last_checked_at}')::timestamptz then
      v_actual := jsonb_set(v_actual, '{last_checked_at}', p_plan#>'{expected_state,offer,last_checked_at}', false);
    end if;
    if v_actual is null or v_actual is distinct from p_plan#>'{expected_state,offer}' then raise exception 'stale product import plan: offer'; end if;
  elsif p_plan#>'{expected_state,offer}' <> 'null'::jsonb then
    raise exception 'invalid product import plan: offer expected state';
  end if;
  if p_plan#>>'{meta,operation_type}' = 'legacy_mapping_upgrade'
     and not public.atomic_import_is_legacy_mapping_upgrade(p_plan) then
    raise exception 'invalid legacy mapping upgrade plan';
  end if;
  return jsonb_build_object('retailer_id',v_retailer_id,'plan_kind',p_plan#>>'{meta,plan_kind}');
end;
$validate_plan$;

alter function public.validate_product_import_plan_read_only(jsonb) owner to postgres;
revoke all on function public.validate_product_import_plan_read_only(jsonb) from public, anon, authenticated, service_role;

commit;