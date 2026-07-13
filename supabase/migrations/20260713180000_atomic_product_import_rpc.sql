begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.atomic_import_has_exact_keys(
  p_value jsonb,
  p_keys text[]
) returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $exact_keys$
  select jsonb_typeof(p_value) = 'object'
    and (select count(*) from jsonb_object_keys(p_value)) = cardinality(p_keys)
    and not exists (
      select 1
      from jsonb_object_keys(p_value) as supplied(key)
      where not (supplied.key = any (p_keys))
    );
$exact_keys$;

create or replace function public.atomic_import_canonical_json(p_value jsonb)
returns text
language plpgsql
immutable
strict
set search_path = pg_catalog
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

create or replace function public.atomic_import_normalize_size(p_value text)
returns jsonb
language plpgsql
immutable
strict
set search_path = pg_catalog
as $normalize_size$
declare
  v_match text[];
  v_amount numeric;
  v_unit text;
begin
  v_match := regexp_match(
    lower(trim(p_value)),
    '^([0-9]+([.,][0-9]+)?)[[:space:]]*(kg|g|mg|mcg|iu|l|ml)$'
  );
  if v_match is null then return null; end if;
  v_amount := replace(v_match[1], ',', '.')::numeric;
  v_unit := v_match[3];
  if v_amount <= 0 then return null; end if;
  return case v_unit
    when 'kg' then jsonb_build_object('value', v_amount * 1000, 'unit', 'g', 'dimension', 'mass')
    when 'mg' then jsonb_build_object('value', v_amount / 1000, 'unit', 'g', 'dimension', 'mass')
    when 'mcg' then jsonb_build_object('value', v_amount / 1000000, 'unit', 'g', 'dimension', 'mass')
    when 'l' then jsonb_build_object('value', v_amount * 1000, 'unit', 'ml', 'dimension', 'volume')
    when 'ml' then jsonb_build_object('value', v_amount, 'unit', 'ml', 'dimension', 'volume')
    when 'iu' then jsonb_build_object('value', v_amount, 'unit', 'iu', 'dimension', 'potency')
    else jsonb_build_object('value', v_amount, 'unit', 'g', 'dimension', 'mass')
  end;
end;
$normalize_size$;

create or replace function public.atomic_import_is_decimal_string(p_value text)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $decimal_string$
  select p_value ~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?$'
    and p_value !~ '^-0(?:\.0+)?$'
    and length(replace(replace(replace(p_value, '-', ''), '.', ''), '0', '')) <= 38
    and length(replace(replace(p_value, '-', ''), '.', '')) <= 38
    and coalesce(length(split_part(p_value, '.', 2)), 0) <= 18;
$decimal_string$;

create or replace function public.atomic_import_decimal_string(p_value numeric)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $decimal_output$
  select case
    when p_value = 0 then '0'
    when p_value::text like '%.%' then rtrim(rtrim(p_value::text, '0'), '.')
    else p_value::text
  end;
$decimal_output$;

alter function public.atomic_import_has_exact_keys(jsonb, text[]) owner to postgres;
alter function public.atomic_import_canonical_json(jsonb) owner to postgres;
alter function public.atomic_import_normalize_size(text) owner to postgres;
alter function public.atomic_import_is_decimal_string(text) owner to postgres;
alter function public.atomic_import_decimal_string(numeric) owner to postgres;
revoke all on function public.atomic_import_has_exact_keys(jsonb, text[]) from public, anon, authenticated, service_role;
revoke all on function public.atomic_import_canonical_json(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.atomic_import_normalize_size(text) from public, anon, authenticated, service_role;
revoke all on function public.atomic_import_is_decimal_string(text) from public, anon, authenticated, service_role;
revoke all on function public.atomic_import_decimal_string(numeric) from public, anon, authenticated, service_role;

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
    p_plan->'meta', array['version','plan_kind','source_row_fingerprint','plan_fingerprint']
  ) or p_plan#>>'{meta,version}' <> '2'
    or p_plan#>>'{meta,plan_kind}' not in ('feed','manual')
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
  if (p_plan#>>'{offer,values,shipping_cost}' is null) <>
     (p_plan#>>'{offer,values,total_price}' is null)
    or (p_plan#>>'{offer,values,total_price}' is not null and
        (p_plan#>>'{offer,values,total_price}')::numeric is distinct from
        (p_plan#>>'{offer,values,price}')::numeric + (p_plan#>>'{offer,values,shipping_cost}')::numeric) then
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
      if v_evidence->>'flavour' is not null or v_evidence->>'size_value' is not null
        or exists(select 1 from public.product_variants where product_id=v_variant.product_id and is_active and not is_default) then
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
  return jsonb_build_object('retailer_id',v_retailer_id,'plan_kind',p_plan#>>'{meta,plan_kind}');
end;
$validate_plan$;

alter function public.validate_product_import_plan_read_only(jsonb) owner to postgres;
revoke all on function public.validate_product_import_plan_read_only(jsonb) from public, anon, authenticated, service_role;

create or replace function public.apply_product_import_plan(p_plan jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $atomic_import$
declare
  v_product_id bigint;
  v_variant_id bigint;
  v_retailer_id bigint;
  v_mapping_id bigint;
  v_offer_id bigint;
  v_product_action text;
  v_variant_action text;
  v_retailer_action text;
  v_mapping_action text;
  v_offer_action text;
  v_history_action text;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_retailer public.retailers%rowtype;
  v_mapping public.retailer_products%rowtype;
  v_offer public.offers%rowtype;
  v_expected jsonb;
  v_evidence jsonb;
  v_price_changed boolean := false;
  v_offer_changed boolean := false;
  v_option_flavour text;
  v_option_size text;
  v_normalized_option_size jsonb;
  v_field text;
begin
  perform public.validate_product_import_plan_read_only(p_plan);
  if not public.atomic_import_has_exact_keys(
    p_plan,
    array['meta','product','product_variant','retailer','retailer_product','offer','price_history','approval','expected_state']
  ) then
    raise exception 'invalid product import plan: top-level schema';
  end if;

  if not public.atomic_import_has_exact_keys(
    p_plan->'meta',
    array['version','plan_kind','source_row_fingerprint','plan_fingerprint']
  )
  or jsonb_typeof(p_plan#>'{meta,version}') <> 'string'
  or (p_plan#>>'{meta,version}')::integer <> 2
  or jsonb_typeof(p_plan#>'{meta,plan_kind}') <> 'string'
  or p_plan#>>'{meta,plan_kind}' not in ('feed','manual')
  or jsonb_typeof(p_plan#>'{meta,source_row_fingerprint}') <> 'string'
  or (p_plan#>>'{meta,source_row_fingerprint}') !~ '^[0-9a-f]{64}$'
  or jsonb_typeof(p_plan#>'{meta,plan_fingerprint}') <> 'string'
  or (p_plan#>>'{meta,plan_fingerprint}') !~ '^[0-9a-f]{32}$' then
    raise exception 'invalid product import plan: meta';
  end if;

  if md5(public.atomic_import_canonical_json(
    jsonb_set(p_plan, '{meta,plan_fingerprint}', 'null'::jsonb, false)
  )) <> p_plan#>>'{meta,plan_fingerprint}' then
    raise exception 'invalid product import plan: fingerprint';
  end if;

  if jsonb_typeof(p_plan->'product') <> 'object'
     or jsonb_typeof(p_plan->'product_variant') <> 'object'
     or jsonb_typeof(p_plan->'retailer') <> 'object'
     or jsonb_typeof(p_plan->'retailer_product') <> 'object'
     or jsonb_typeof(p_plan->'offer') <> 'object'
     or jsonb_typeof(p_plan->'price_history') <> 'object'
     or jsonb_typeof(p_plan->'approval') <> 'object'
     or jsonb_typeof(p_plan->'expected_state') <> 'object' then
    raise exception 'invalid product import plan: section type';
  end if;

  v_product_action := p_plan#>>'{product,action}';
  v_variant_action := p_plan#>>'{product_variant,action}';
  v_retailer_action := p_plan#>>'{retailer,action}';
  v_mapping_action := p_plan#>>'{retailer_product,action}';
  v_offer_action := p_plan#>>'{offer,action}';
  v_history_action := p_plan#>>'{price_history,action}';

  if v_product_action is null or v_product_action not in ('existing','create')
     or v_variant_action is null or v_variant_action not in ('existing','create_default')
     or v_retailer_action is null or v_retailer_action not in ('existing','create')
     or v_mapping_action is null or v_mapping_action not in ('create','update','noop')
     or v_offer_action is null or v_offer_action not in ('create','update','noop')
     or v_history_action is null or v_history_action not in ('create','noop') then
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
     or not public.atomic_import_has_exact_keys(p_plan->'price_history', array['action']) then
    raise exception 'invalid product import plan: action schema';
  end if;

  if not public.atomic_import_has_exact_keys(
    p_plan#>'{product_variant,evidence}',
    array['flavour','size_value','size_unit','pack_count','product_format','external_options','approved_mapping_id']
  )
  or jsonb_typeof(p_plan#>'{product_variant,evidence,external_options}') not in ('object','null')
  or jsonb_typeof(p_plan#>'{product_variant,evidence,flavour}') not in ('string','null')
  or jsonb_typeof(p_plan#>'{product_variant,evidence,size_value}') not in ('string','null')
  or jsonb_typeof(p_plan#>'{product_variant,evidence,size_unit}') not in ('string','null')
  or jsonb_typeof(p_plan#>'{product_variant,evidence,pack_count}') not in ('string','null')
  or jsonb_typeof(p_plan#>'{product_variant,evidence,product_format}') not in ('string','null')
  or jsonb_typeof(p_plan#>'{product_variant,evidence,approved_mapping_id}') not in ('string','null') then
    raise exception 'invalid product import plan: variant evidence';
  end if;
  v_evidence := p_plan#>'{product_variant,evidence}';
  if ((v_evidence->>'size_value' is null) <> (v_evidence->>'size_unit' is null))
     or (v_evidence->>'size_value')::numeric <= 0
     or (v_evidence->>'pack_count')::integer <= 0
     or exists (
       select 1 from jsonb_each(case
         when jsonb_typeof(v_evidence->'external_options') = 'object'
           then v_evidence->'external_options' else '{}'::jsonb end
       ) where jsonb_typeof(value) in ('object','array')
     ) then
    raise exception 'invalid product import plan: variant evidence values';
  end if;

  if not public.atomic_import_has_exact_keys(
    p_plan#>'{retailer_product,values}',
    array['external_product_id','external_variant_id','external_sku','external_options','external_name','external_slug','external_gtin','external_url','match_method','match_confidence','product_variant_id']
  )
  or jsonb_typeof(p_plan#>'{retailer_product,values,external_name}') <> 'string'
  or nullif(btrim(p_plan#>>'{retailer_product,values,external_name}'), '') is null
  or jsonb_typeof(p_plan#>'{retailer_product,values,external_url}') <> 'string'
  or nullif(btrim(p_plan#>>'{retailer_product,values,external_url}'), '') is null
  or jsonb_typeof(p_plan#>'{retailer_product,values,external_options}') not in ('object','null')
  or jsonb_typeof(p_plan#>'{retailer_product,values,product_variant_id}') not in ('string','null') then
    raise exception 'invalid product import plan: retailer product values';
  end if;
  foreach v_field in array array[
    'external_product_id','external_variant_id','external_sku','external_name',
    'external_slug','external_gtin','external_url','match_method'
  ] loop
    if jsonb_typeof(p_plan#>array['retailer_product','values',v_field]) not in ('string','null') then
      raise exception 'invalid product import plan: retailer product field %', v_field;
    end if;
  end loop;
  if jsonb_typeof(p_plan#>'{retailer_product,values,match_confidence}') not in ('string','null') then
    raise exception 'invalid product import plan: retailer product confidence';
  end if;

  if coalesce(p_plan#>'{product_variant,evidence,external_options}', 'null'::jsonb)
     is distinct from coalesce(p_plan#>'{retailer_product,values,external_options}', 'null'::jsonb) then
    raise exception 'invalid product import plan: option evidence mismatch';
  end if;

  if not public.atomic_import_has_exact_keys(
    p_plan#>'{offer,values}',
    array['price','shipping_cost','total_price','url','in_stock','last_checked_at']
  )
  or jsonb_typeof(p_plan#>'{offer,values,price}') <> 'string'
  or (p_plan#>>'{offer,values,price}')::numeric <= 0
  or jsonb_typeof(p_plan#>'{offer,values,shipping_cost}') not in ('string','null')
  or jsonb_typeof(p_plan#>'{offer,values,total_price}') not in ('string','null')
  or jsonb_typeof(p_plan#>'{offer,values,url}') <> 'string'
  or nullif(btrim(p_plan#>>'{offer,values,url}'), '') is null
  or jsonb_typeof(p_plan#>'{offer,values,in_stock}') <> 'boolean'
  or jsonb_typeof(p_plan#>'{offer,values,last_checked_at}') <> 'string' then
    raise exception 'invalid product import plan: offer values';
  end if;
  perform (p_plan#>>'{offer,values,last_checked_at}')::timestamptz;

  if not public.atomic_import_has_exact_keys(
    p_plan->'expected_state',
    array['product','retailer','product_variant','retailer_product','offer']
  ) then
    raise exception 'invalid product import plan: expected state schema';
  end if;

  if (v_product_action = 'existing') <> (jsonb_typeof(p_plan#>'{expected_state,product}') = 'object')
     or (v_product_action = 'create') <> (jsonb_typeof(p_plan#>'{expected_state,product}') = 'null')
     or (v_retailer_action = 'existing') <> (jsonb_typeof(p_plan#>'{expected_state,retailer}') = 'object')
     or (v_retailer_action = 'create') <> (jsonb_typeof(p_plan#>'{expected_state,retailer}') = 'null')
     or (v_variant_action = 'existing') <> (jsonb_typeof(p_plan#>'{expected_state,product_variant}') = 'object')
     or (v_variant_action = 'create_default') <> (jsonb_typeof(p_plan#>'{expected_state,product_variant}') = 'null')
     or (v_mapping_action in ('update','noop')) <> (jsonb_typeof(p_plan#>'{expected_state,retailer_product}') = 'object')
     or (v_mapping_action = 'create') <> (jsonb_typeof(p_plan#>'{expected_state,retailer_product}') = 'null')
     or (v_offer_action in ('update','noop')) <> (jsonb_typeof(p_plan#>'{expected_state,offer}') = 'object')
     or (v_offer_action = 'create') <> (jsonb_typeof(p_plan#>'{expected_state,offer}') = 'null') then
    raise exception 'invalid product import plan: expected state action mismatch';
  end if;

  if v_product_action = 'create' then
    if not public.atomic_import_has_exact_keys(
      p_plan#>'{product,values}',
      array['name','slug','brand','category','price','image','description','servings','net_weight_g','net_volume_ml','serving_count_verified','serving_size_g','serving_size_ml','protein_per_serving_g','creatine_per_serving_g','unit_count','unit_type','product_format','unit_pricing_verified','nutrition_verified','gtin']
    )
    or jsonb_typeof(p_plan#>'{product,values,name}') <> 'string'
    or nullif(btrim(p_plan#>>'{product,values,name}'), '') is null
    or jsonb_typeof(p_plan#>'{product,values,slug}') <> 'string'
    or nullif(btrim(p_plan#>>'{product,values,slug}'), '') is null
    or jsonb_typeof(p_plan#>'{product,values,brand}') <> 'string'
    or jsonb_typeof(p_plan#>'{product,values,category}') <> 'string'
    or jsonb_typeof(p_plan#>'{product,values,price}') <> 'string'
    or jsonb_typeof(p_plan#>'{product,values,unit_pricing_verified}') <> 'boolean'
    or jsonb_typeof(p_plan#>'{product,values,nutrition_verified}') <> 'boolean'
    or jsonb_typeof(p_plan#>'{product,values,gtin}') <> 'null' then
      raise exception 'invalid product import plan: product create values';
    end if;
    foreach v_field in array array['image','description','unit_type','product_format'] loop
      if jsonb_typeof(p_plan#>array['product','values',v_field]) not in ('string','null') then
        raise exception 'invalid product import plan: product field %', v_field;
      end if;
    end loop;
    foreach v_field in array array[
      'servings','net_weight_g','net_volume_ml','serving_count_verified',
      'serving_size_g','serving_size_ml','protein_per_serving_g',
      'creatine_per_serving_g','unit_count'
    ] loop
      if jsonb_typeof(p_plan#>array['product','values',v_field]) not in ('string','null') then
        raise exception 'invalid product import plan: product numeric field %', v_field;
      end if;
    end loop;

    if p_plan#>>'{meta,plan_kind}' <> 'feed'
       or not public.atomic_import_has_exact_keys(
         p_plan->'approval',
         array['approved','approval_type','approved_category','source_row_fingerprint','canonical_name','has_variant_evidence','approval_fingerprint']
       )
       or p_plan#>'{approval,approved}' <> 'true'::jsonb
       or jsonb_typeof(p_plan#>'{approval,approved_category}') <> 'string'
       or jsonb_typeof(p_plan#>'{approval,source_row_fingerprint}') <> 'string'
       or jsonb_typeof(p_plan#>'{approval,canonical_name}') <> 'string'
       or jsonb_typeof(p_plan#>'{approval,has_variant_evidence}') <> 'boolean'
       or p_plan#>>'{approval,approval_type}' <> 'safe_create'
       or p_plan#>>'{approval,approved_category}' <> p_plan#>>'{product,values,category}'
       or p_plan#>>'{approval,approved_category}' not in ('Vitamins','Health Supplements','Amino Acids','Creatine')
       or p_plan#>>'{approval,source_row_fingerprint}' <> p_plan#>>'{meta,source_row_fingerprint}'
       or p_plan#>>'{approval,canonical_name}' <> p_plan#>>'{product,values,name}'
       or p_plan#>'{approval,has_variant_evidence}' <> 'false'::jsonb
       or jsonb_typeof(p_plan#>'{approval,approval_fingerprint}') <> 'string'
       or md5(public.atomic_import_canonical_json(
         jsonb_set(p_plan->'approval', '{approval_fingerprint}', 'null'::jsonb, false)
       )) <> p_plan#>>'{approval,approval_fingerprint}' then
      raise exception 'product create requires valid safe-create approval';
    end if;
  else
    if not public.atomic_import_has_exact_keys(p_plan->'approval', array['approved','approval_type'])
       or jsonb_typeof(p_plan#>'{approval,approved}') <> 'boolean'
       or jsonb_typeof(p_plan#>'{approval,approval_type}') <> 'string'
       or p_plan#>'{approval,approved}' <> 'false'::jsonb
       or p_plan#>>'{approval,approval_type}' <> 'none' then
      raise exception 'existing product cannot carry safe-create approval';
    end if;
  end if;

  if v_retailer_action = 'create' then
    if not public.atomic_import_has_exact_keys(p_plan#>'{retailer,values}', array['name','slug','website'])
       or jsonb_typeof(p_plan#>'{retailer,values,name}') <> 'string'
       or jsonb_typeof(p_plan#>'{retailer,values,slug}') <> 'string'
       or jsonb_typeof(p_plan#>'{retailer,values,website}') <> 'string' then
      raise exception 'invalid product import plan: retailer create values';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(concat_ws(
    '|',
    coalesce(p_plan#>>'{retailer,id}', p_plan#>>'{retailer,values,slug}'),
    coalesce(p_plan#>>'{retailer_product,values,external_variant_id}', p_plan#>>'{retailer_product,values,external_url}')
  ), 0));

  if v_retailer_action = 'existing' then
    v_retailer_id := (p_plan#>>'{retailer,id}')::bigint;
    v_expected := p_plan#>'{expected_state,retailer}';
    if not public.atomic_import_has_exact_keys(v_expected, array['id','name','slug','website']) then
      raise exception 'invalid product import plan: retailer expected state';
    end if;
    select * into v_retailer from public.retailers where id = v_retailer_id for update;
    if not found
       or (v_expected->>'id')::bigint is distinct from v_retailer.id
       or v_expected->>'name' is distinct from v_retailer.name
       or v_expected->>'slug' is distinct from v_retailer.slug
       or v_expected->>'website' is distinct from v_retailer.website then
      raise exception 'stale product import plan: retailer';
    end if;
  else
    insert into public.retailers(name, slug, website)
    values (
      p_plan#>>'{retailer,values,name}',
      p_plan#>>'{retailer,values,slug}',
      p_plan#>>'{retailer,values,website}'
    ) returning id into v_retailer_id;
  end if;

  if v_product_action = 'existing' then
    v_product_id := (p_plan#>>'{product,id}')::bigint;
    v_expected := p_plan#>'{expected_state,product}';
    if not public.atomic_import_has_exact_keys(v_expected, array['id','name','is_active','merged_into_product_id','product_format']) then
      raise exception 'invalid product import plan: product expected state';
    end if;
    select * into v_product from public.products where id = v_product_id for update;
    if not found
       or (v_expected->>'id')::bigint is distinct from v_product.id
       or v_expected->>'name' is distinct from v_product.name
       or (v_expected->>'is_active')::boolean is distinct from v_product.is_active
       or nullif(v_expected->>'merged_into_product_id','')::bigint is distinct from v_product.merged_into_product_id
       or v_expected->>'product_format' is distinct from v_product.product_format
       or v_product.merged_into_product_id is not null then
      raise exception 'stale product import plan: product';
    end if;
  else
    insert into public.products(
      name, slug, brand, category, price, image, description, servings,
      net_weight_g, net_volume_ml, serving_count_verified, serving_size_g,
      serving_size_ml, protein_per_serving_g, creatine_per_serving_g,
      unit_count, unit_type, product_format, unit_pricing_verified,
      nutrition_verified
    ) values (
      p_plan#>>'{product,values,name}', p_plan#>>'{product,values,slug}',
      p_plan#>>'{product,values,brand}', p_plan#>>'{product,values,category}',
      (p_plan#>>'{product,values,price}')::numeric,
      p_plan#>>'{product,values,image}', p_plan#>>'{product,values,description}',
      nullif(p_plan#>>'{product,values,servings}','')::integer,
      nullif(p_plan#>>'{product,values,net_weight_g}','')::numeric,
      nullif(p_plan#>>'{product,values,net_volume_ml}','')::numeric,
      nullif(p_plan#>>'{product,values,serving_count_verified}','')::integer,
      nullif(p_plan#>>'{product,values,serving_size_g}','')::numeric,
      nullif(p_plan#>>'{product,values,serving_size_ml}','')::numeric,
      nullif(p_plan#>>'{product,values,protein_per_serving_g}','')::numeric,
      nullif(p_plan#>>'{product,values,creatine_per_serving_g}','')::numeric,
      nullif(p_plan#>>'{product,values,unit_count}','')::integer,
      p_plan#>>'{product,values,unit_type}', p_plan#>>'{product,values,product_format}',
      (p_plan#>>'{product,values,unit_pricing_verified}')::boolean,
      (p_plan#>>'{product,values,nutrition_verified}')::boolean
    ) returning id into v_product_id;
  end if;


  if v_variant_action = 'existing' then
    v_variant_id := (p_plan#>>'{product_variant,id}')::bigint;
    v_expected := p_plan#>'{expected_state,product_variant}';
    if not public.atomic_import_has_exact_keys(v_expected, array['id','product_id','variant_key','display_name','flavour_code','flavour_label','size_value','size_unit','pack_count','product_format','is_active','is_default']) then
      raise exception 'invalid product import plan: variant expected state';
    end if;
    select * into v_variant from public.product_variants where id = v_variant_id for update;
    if not found
       or (v_expected->>'id')::bigint is distinct from v_variant.id
       or (v_expected->>'product_id')::bigint is distinct from v_variant.product_id
       or v_variant.product_id is distinct from v_product_id
       or v_expected->>'variant_key' is distinct from v_variant.variant_key
       or v_expected->>'display_name' is distinct from v_variant.display_name
       or v_expected->>'flavour_code' is distinct from v_variant.flavour_code
       or v_expected->>'flavour_label' is distinct from v_variant.flavour_label
       or nullif(v_expected->>'size_value','')::numeric is distinct from v_variant.size_value
       or v_expected->>'size_unit' is distinct from v_variant.size_unit
       or nullif(v_expected->>'pack_count','')::integer is distinct from v_variant.pack_count
       or v_expected->>'product_format' is distinct from v_variant.product_format
       or (v_expected->>'is_active')::boolean is distinct from v_variant.is_active
       or (v_expected->>'is_default')::boolean is distinct from v_variant.is_default
       or not v_variant.is_active then
      raise exception 'stale product import plan: product variant';
    end if;
  else
    if v_product_action <> 'create'
       or v_evidence->>'flavour' is not null
       or v_evidence->>'size_value' is not null
       or coalesce((v_evidence->>'pack_count')::integer, 1) <> 1 then
      raise exception 'invalid safe-create default variant evidence';
    end if;
    insert into public.product_variants(
      product_id, variant_key, display_name, flavour_code, flavour_label,
      size_value, size_unit, pack_count, product_format, gtin,
      nutrition_override, is_active, is_default
    ) values (
      v_product_id, 'default', 'Default', null, null, null, null, null, null,
      null, '{}'::jsonb, true, true
    ) returning * into v_variant;
    v_variant_id := v_variant.id;
  end if;


  if v_mapping_action in ('update','noop') then
    v_mapping_id := (p_plan#>>'{retailer_product,id}')::bigint;
    v_expected := p_plan#>'{expected_state,retailer_product}';
    if not public.atomic_import_has_exact_keys(v_expected, array['id','retailer_id','product_id','product_variant_id','updated_at','external_product_id','external_variant_id','external_sku','external_options','external_name','external_slug','external_gtin','external_url','match_method','match_confidence']) then
      raise exception 'invalid product import plan: retailer product expected state';
    end if;
    select * into v_mapping from public.retailer_products where id = v_mapping_id for update;
    if not found
       or (v_expected->>'id')::bigint is distinct from v_mapping.id
       or (v_expected->>'retailer_id')::bigint is distinct from v_mapping.retailer_id
       or (v_expected->>'product_id')::bigint is distinct from v_mapping.product_id
       or (v_expected->>'product_variant_id')::bigint is distinct from v_mapping.product_variant_id
       or (v_expected->>'updated_at')::timestamptz is distinct from v_mapping.updated_at
       or v_expected->>'external_product_id' is distinct from v_mapping.external_product_id
       or v_expected->>'external_variant_id' is distinct from v_mapping.external_variant_id
       or v_expected->>'external_sku' is distinct from v_mapping.external_sku
       or coalesce(v_expected->'external_options','null'::jsonb) is distinct from coalesce(v_mapping.external_options,'null'::jsonb)
       or v_expected->>'external_name' is distinct from v_mapping.external_name
       or v_expected->>'external_slug' is distinct from v_mapping.external_slug
       or v_expected->>'external_gtin' is distinct from v_mapping.external_gtin
       or v_expected->>'external_url' is distinct from v_mapping.external_url
       or v_expected->>'match_method' is distinct from v_mapping.match_method
       or nullif(v_expected->>'match_confidence','')::numeric is distinct from v_mapping.match_confidence
       or v_mapping.retailer_id is distinct from v_retailer_id
       or v_mapping.product_id is distinct from v_product_id
       or v_mapping.product_variant_id is distinct from v_variant_id then
      raise exception 'stale product import plan: retailer product';
    end if;
    if v_mapping_action = 'noop' and (
      p_plan#>>'{retailer_product,values,external_product_id}' is distinct from v_mapping.external_product_id
      or p_plan#>>'{retailer_product,values,external_variant_id}' is distinct from v_mapping.external_variant_id
      or p_plan#>>'{retailer_product,values,external_sku}' is distinct from v_mapping.external_sku
      or coalesce(p_plan#>'{retailer_product,values,external_options}','null'::jsonb) is distinct from coalesce(v_mapping.external_options,'null'::jsonb)
      or p_plan#>>'{retailer_product,values,external_name}' is distinct from v_mapping.external_name
      or p_plan#>>'{retailer_product,values,external_slug}' is distinct from v_mapping.external_slug
      or p_plan#>>'{retailer_product,values,external_gtin}' is distinct from v_mapping.external_gtin
      or p_plan#>>'{retailer_product,values,external_url}' is distinct from v_mapping.external_url
      or p_plan#>>'{retailer_product,values,match_method}' is distinct from v_mapping.match_method
      or nullif(p_plan#>>'{retailer_product,values,match_confidence}','')::numeric is distinct from v_mapping.match_confidence
    ) then
      raise exception 'invalid retailer product noop values';
    end if;
  end if;

  if v_variant.is_default then
    if v_evidence->>'flavour' is not null
       or v_evidence->>'size_value' is not null
       or exists (
         select 1 from public.product_variants
         where product_id = v_product_id and is_active and not is_default
       ) then
      raise exception 'variant evidence does not match default product variant';
    end if;
  else
    if v_evidence->>'flavour' is not null
       and lower(v_evidence->>'flavour') not in (
         lower(coalesce(v_variant.flavour_code,'')), lower(coalesce(v_variant.flavour_label,''))
       ) then
      raise exception 'variant evidence flavour mismatch';
    end if;
    if v_evidence->>'size_value' is not null and (
      nullif(v_evidence->>'size_value','')::numeric is distinct from v_variant.size_value
      or lower(coalesce(v_evidence->>'size_unit','')) is distinct from lower(coalesce(v_variant.size_unit,''))
    ) then
      raise exception 'variant evidence size mismatch';
    end if;
    if v_evidence->>'pack_count' is not null and v_variant.pack_count is not null and v_variant.pack_count <> 1
       and nullif(v_evidence->>'pack_count','')::integer is distinct from v_variant.pack_count then
      raise exception 'variant evidence pack mismatch';
    end if;
    if v_evidence->>'product_format' is not null and v_variant.product_format is not null
       and lower(coalesce(v_evidence->>'product_format','')) is distinct from lower(v_variant.product_format) then
      raise exception 'variant evidence format mismatch';
    end if;
    if v_evidence->>'approved_mapping_id' is null
       and ((v_variant.flavour_code is not null or v_variant.flavour_label is not null) and v_evidence->>'flavour' is null
         or v_variant.size_value is not null and v_evidence->>'size_value' is null
         or v_variant.pack_count is not null and v_variant.pack_count <> 1 and v_evidence->>'pack_count' is null
         or v_variant.product_format is not null and v_evidence->>'product_format' is null) then
      raise exception 'non-default variant requires complete distinguishing evidence';
    end if;
    if v_evidence->>'approved_mapping_id' is not null
       and (v_mapping_action not in ('update','noop')
         or (v_evidence->>'approved_mapping_id')::bigint is distinct from v_mapping_id) then
      raise exception 'approved mapping evidence mismatch';
    end if;
  end if;

  select lower(value) into v_option_flavour
  from jsonb_each_text(case
    when jsonb_typeof(v_evidence->'external_options') = 'object'
      then v_evidence->'external_options'
    else '{}'::jsonb
  end)
  where lower(key) in ('flavour','flavor') limit 1;
  if v_option_flavour is not null and not v_variant.is_default
     and v_option_flavour not in (lower(coalesce(v_variant.flavour_code,'')), lower(coalesce(v_variant.flavour_label,''))) then
    raise exception 'variant option flavour mismatch';
  end if;
  select value into v_option_size
  from jsonb_each_text(case
    when jsonb_typeof(v_evidence->'external_options') = 'object'
      then v_evidence->'external_options'
    else '{}'::jsonb
  end)
  where lower(key) = 'size' limit 1;
  if v_option_size is not null then
    v_normalized_option_size := public.atomic_import_normalize_size(v_option_size);
    if v_normalized_option_size is null then
      raise exception 'invalid variant option size';
    end if;
    if nullif(v_normalized_option_size->>'value','')::numeric
         is distinct from nullif(v_evidence->>'size_value','')::numeric
       or v_normalized_option_size->>'unit' is distinct from v_evidence->>'size_unit' then
      raise exception 'variant option size mismatch';
    end if;
  end if;
  if p_plan#>>'{retailer_product,values,product_variant_id}' is not null
     and (p_plan#>>'{retailer_product,values,product_variant_id}')::bigint is distinct from v_variant_id then
    raise exception 'retailer product variant identity mismatch';
  end if;

  if v_mapping_action = 'create' then
    if exists (
      select 1 from public.retailer_products
      where retailer_id = v_retailer_id and (
        (p_plan#>>'{retailer_product,values,external_variant_id}' is not null
          and external_variant_id = p_plan#>>'{retailer_product,values,external_variant_id}')
        or (p_plan#>>'{retailer_product,values,external_variant_id}' is null
          and external_url = p_plan#>>'{retailer_product,values,external_url}')
      )
    ) then
      raise exception 'stale product import plan: retailer product identity';
    end if;
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
      case when jsonb_typeof(p_plan#>'{retailer_product,values,external_options}') = 'null' then null else p_plan#>'{retailer_product,values,external_options}' end,
      p_plan#>>'{retailer_product,values,match_method}',
      nullif(p_plan#>>'{retailer_product,values,match_confidence}','')::numeric
    ) returning id into v_mapping_id;
  elsif v_mapping_action = 'update' then
    update public.retailer_products set
      external_name = p_plan#>>'{retailer_product,values,external_name}',
      external_slug = p_plan#>>'{retailer_product,values,external_slug}',
      external_gtin = p_plan#>>'{retailer_product,values,external_gtin}',
      external_url = p_plan#>>'{retailer_product,values,external_url}',
      external_product_id = p_plan#>>'{retailer_product,values,external_product_id}',
      external_variant_id = p_plan#>>'{retailer_product,values,external_variant_id}',
      external_sku = p_plan#>>'{retailer_product,values,external_sku}',
      external_options = case when jsonb_typeof(p_plan#>'{retailer_product,values,external_options}') = 'null' then null else p_plan#>'{retailer_product,values,external_options}' end,
      match_method = p_plan#>>'{retailer_product,values,match_method}',
      match_confidence = nullif(p_plan#>>'{retailer_product,values,match_confidence}','')::numeric,
      updated_at = now()
    where id = v_mapping_id;
  end if;


  if v_offer_action in ('update','noop') then
    v_offer_id := (p_plan#>>'{offer,id}')::bigint;
    v_expected := p_plan#>'{expected_state,offer}';
    if not public.atomic_import_has_exact_keys(v_expected, array['id','product_id','retailer_id','product_variant_id','retailer_product_id','price','shipping_cost','total_price','in_stock','url','last_checked_at']) then
      raise exception 'invalid product import plan: offer expected state';
    end if;
    select * into v_offer from public.offers where id = v_offer_id for update;
    if not found
       or (v_expected->>'id')::bigint is distinct from v_offer.id
       or (v_expected->>'product_id')::bigint is distinct from v_offer.product_id
       or (v_expected->>'retailer_id')::bigint is distinct from v_offer.retailer_id
       or (v_expected->>'product_variant_id')::bigint is distinct from v_offer.product_variant_id
       or (v_expected->>'retailer_product_id')::bigint is distinct from v_offer.retailer_product_id
       or nullif(v_expected->>'price','')::numeric is distinct from v_offer.price
       or nullif(v_expected->>'shipping_cost','')::numeric is distinct from v_offer.shipping_cost
       or nullif(v_expected->>'total_price','')::numeric is distinct from v_offer.total_price
       or (v_expected->>'in_stock')::boolean is distinct from v_offer.in_stock
       or v_expected->>'url' is distinct from v_offer.url
       or nullif(v_expected->>'last_checked_at','')::timestamptz is distinct from v_offer.last_checked_at
       or v_offer.product_id is distinct from v_product_id
       or v_offer.retailer_id is distinct from v_retailer_id
       or v_offer.product_variant_id is distinct from v_variant_id
       or v_offer.retailer_product_id is distinct from v_mapping_id then
      raise exception 'stale product import plan: offer';
    end if;
    v_price_changed := v_offer.price is distinct from (p_plan#>>'{offer,values,price}')::numeric
      or v_offer.shipping_cost is distinct from nullif(p_plan#>>'{offer,values,shipping_cost}','')::numeric
      or v_offer.total_price is distinct from nullif(p_plan#>>'{offer,values,total_price}','')::numeric;
    v_offer_changed := v_price_changed
      or v_offer.in_stock is distinct from (p_plan#>>'{offer,values,in_stock}')::boolean
      or v_offer.url is distinct from p_plan#>>'{offer,values,url}';
  end if;

  if v_offer_action = 'noop' and v_offer_changed then
    raise exception 'invalid offer noop values';
  end if;
  if v_offer_action = 'update' and not v_offer_changed then
    raise exception 'invalid offer update without change';
  end if;

  if (v_offer_action = 'create' and v_history_action <> 'create')
     or (v_offer_action = 'update' and v_price_changed and v_history_action <> 'create')
     or (v_offer_action = 'update' and not v_price_changed and v_history_action <> 'noop')
     or (v_offer_action = 'noop' and v_history_action <> 'noop') then
    raise exception 'invalid price history action';
  end if;

  if v_offer_action = 'create' then
    if exists (select 1 from public.offers where retailer_product_id = v_mapping_id) then
      raise exception 'stale product import plan: offer identity';
    end if;
    insert into public.offers(
      product_id, retailer_id, product_variant_id, retailer_product_id,
      price, shipping_cost, total_price, url, in_stock, last_checked_at
    ) values (
      v_product_id, v_retailer_id, v_variant_id, v_mapping_id,
      (p_plan#>>'{offer,values,price}')::numeric,
      nullif(p_plan#>>'{offer,values,shipping_cost}','')::numeric,
      nullif(p_plan#>>'{offer,values,total_price}','')::numeric,
      p_plan#>>'{offer,values,url}', (p_plan#>>'{offer,values,in_stock}')::boolean,
      (p_plan#>>'{offer,values,last_checked_at}')::timestamptz
    ) returning id into v_offer_id;
  elsif v_offer_action = 'update' then
    update public.offers set
      price = (p_plan#>>'{offer,values,price}')::numeric,
      shipping_cost = nullif(p_plan#>>'{offer,values,shipping_cost}','')::numeric,
      total_price = nullif(p_plan#>>'{offer,values,total_price}','')::numeric,
      url = p_plan#>>'{offer,values,url}',
      in_stock = (p_plan#>>'{offer,values,in_stock}')::boolean,
      last_checked_at = (p_plan#>>'{offer,values,last_checked_at}')::timestamptz
    where id = v_offer_id;
  end if;


  if v_history_action = 'create' then
    insert into public.price_history(offer_id, price, shipping_cost, total_price, checked_at)
    values (
      v_offer_id, (p_plan#>>'{offer,values,price}')::numeric,
      nullif(p_plan#>>'{offer,values,shipping_cost}','')::numeric,
      nullif(p_plan#>>'{offer,values,total_price}','')::numeric,
      (p_plan#>>'{offer,values,last_checked_at}')::timestamptz
    );
  end if;

  return jsonb_build_object(
    'product_id', v_product_id,
    'product_variant_id', v_variant_id,
    'retailer_id', v_retailer_id,
    'retailer_product_id', v_mapping_id,
    'offer_id', v_offer_id,
    'retailer_product_action', v_mapping_action,
    'offer_action', v_offer_action,
    'price_history_action', v_history_action,
    'plan_fingerprint', p_plan#>>'{meta,plan_fingerprint}'
  );
end;
$atomic_import$;

alter function public.apply_product_import_plan(jsonb) owner to postgres;
revoke all on function public.apply_product_import_plan(jsonb) from public, anon, authenticated, service_role;

commit;
