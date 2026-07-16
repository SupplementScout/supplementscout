begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Tooling/RPC only. This migration does not touch business tables.
-- It extends legacy_mapping_upgrade to the explicitly flagged Whey Okay
-- optioned case where an existing mapping moves from the current default
-- canonical variant to an exact existing non-default canonical variant.

create or replace function public.atomic_import_is_legacy_mapping_upgrade(p_plan jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $legacy_upgrade$
declare
  v_mapping_id bigint;
  v_product_id bigint;
  v_variant_id bigint;
  v_retailer_id bigint;
  v_offer_id bigint;
  v_expected jsonb;
  v_values jsonb;
  v_evidence jsonb;
  v_mapping public.retailer_products%rowtype;
  v_offer public.offers%rowtype;
  v_variant public.product_variants%rowtype;
  v_current_variant public.product_variants%rowtype;
  v_product public.products%rowtype;
  v_optioned boolean;
  v_switch_optioned boolean;
  v_standalone boolean;
  v_expected_variant_id bigint;
  v_option_size text;
  v_option_flavour text;
  v_normalized_option_size jsonb;
begin
  if p_plan#>>'{meta,operation_type}' is distinct from 'legacy_mapping_upgrade'
     or p_plan#>>'{meta,plan_kind}' is distinct from 'feed'
     or p_plan#>>'{product,action}' <> 'existing'
     or p_plan#>>'{product_variant,action}' <> 'existing'
     or p_plan#>>'{retailer,action}' <> 'existing'
     or p_plan#>>'{retailer_product,action}' not in ('update','noop')
     or p_plan#>>'{offer,action}' not in ('noop','identity_update')
     or p_plan#>>'{price_history,action}' <> 'noop' then
    return false;
  end if;

  v_mapping_id := nullif(p_plan#>>'{retailer_product,id}','')::bigint;
  v_product_id := nullif(p_plan#>>'{product,id}','')::bigint;
  v_variant_id := nullif(p_plan#>>'{product_variant,id}','')::bigint;
  v_retailer_id := nullif(p_plan#>>'{retailer,id}','')::bigint;
  v_offer_id := nullif(p_plan#>>'{offer,id}','')::bigint;
  v_expected := p_plan#>'{expected_state,retailer_product}';
  v_values := p_plan#>'{retailer_product,values}';
  v_evidence := p_plan#>'{product_variant,evidence}';
  v_expected_variant_id := nullif(v_expected->>'product_variant_id','')::bigint;

  if v_mapping_id is null or v_product_id is null or v_variant_id is null
     or v_retailer_id is null or v_offer_id is null or v_expected_variant_id is null
     or nullif(v_values->>'external_product_id','') is null
     or nullif(v_values->>'external_variant_id','') is null
     or nullif(v_values->>'external_sku','') is null
     or v_evidence->>'approved_mapping_id' is distinct from v_mapping_id::text
     or v_expected->>'id' is distinct from v_mapping_id::text
     or v_expected->>'product_id' is distinct from v_product_id::text
     or v_expected->>'retailer_id' is distinct from v_retailer_id::text
     or v_values->>'product_variant_id' is distinct from v_variant_id::text
     or v_values->>'external_url' is distinct from v_expected->>'external_url'
     or v_values->>'external_name' is distinct from v_expected->>'external_name'
     or v_values->>'external_slug' is distinct from v_expected->>'external_slug'
     or v_values->>'match_method' is distinct from v_expected->>'match_method'
     or v_values->>'match_confidence' is distinct from v_expected->>'match_confidence'
     or coalesce(v_values->'external_options', 'null'::jsonb)
        is distinct from coalesce(v_evidence->'external_options', 'null'::jsonb) then
    return false;
  end if;

  v_optioned :=
    v_values->>'external_product_id' is distinct from v_values->>'external_variant_id'
    and jsonb_typeof(v_values->'external_options') = 'object'
    and (select count(*) from jsonb_each(v_values->'external_options')) = 2
    and (v_values->'external_options' ? 'Size')
    and (v_values->'external_options' ? 'Flavour')
    and nullif(v_evidence->>'size_value','') is not null
    and nullif(v_evidence->>'size_unit','') is not null
    and nullif(v_evidence->>'flavour','') is not null;

  v_standalone :=
    v_expected_variant_id is not distinct from v_variant_id
    and coalesce(v_values->'external_options', 'null'::jsonb) = 'null'::jsonb
    and coalesce(v_evidence->'external_options', 'null'::jsonb) = 'null'::jsonb
    and v_retailer_id = (select id from public.retailers where slug='whey-okay' limit 1)
    and v_values->>'external_product_id' = v_values->>'external_variant_id'
    and nullif(v_evidence->>'size_value','') is null
    and nullif(v_evidence->>'size_unit','') is null
    and nullif(v_evidence->>'flavour','') is null;

  if not (v_optioned or v_standalone) then
    return false;
  end if;
  v_switch_optioned := v_optioned and v_expected_variant_id is distinct from v_variant_id;
  if (v_switch_optioned and p_plan#>>'{offer,action}' <> 'identity_update')
     or (not v_switch_optioned and p_plan#>>'{offer,action}' <> 'noop') then
    return false;
  end if;

  if (v_expected->>'external_product_id' is not null
      and v_expected->>'external_product_id' is distinct from v_values->>'external_product_id')
     or (v_expected->>'external_variant_id' is not null
      and v_expected->>'external_variant_id' is distinct from v_values->>'external_variant_id')
     or (v_expected->>'external_sku' is not null
      and v_expected->>'external_sku' is distinct from v_values->>'external_sku')
     or (v_expected->'external_options' <> 'null'::jsonb
      and v_expected->'external_options' is distinct from v_values->'external_options')
     or (v_expected->>'external_gtin' is not null
      and v_expected->>'external_gtin' is distinct from v_values->>'external_gtin') then
    return false;
  end if;

  select * into v_mapping from public.retailer_products where id=v_mapping_id;
  select * into v_offer from public.offers where id=v_offer_id;
  select * into v_variant from public.product_variants where id=v_variant_id;
  select * into v_current_variant from public.product_variants where id=v_expected_variant_id;
  select * into v_product from public.products where id=v_product_id;

  if v_mapping.id is null or v_offer.id is null or v_variant.id is null
     or v_current_variant.id is null or v_product.id is null
     or v_mapping.retailer_id is distinct from v_retailer_id
     or v_mapping.product_id is distinct from v_product_id
     or v_mapping.product_variant_id is distinct from v_expected_variant_id
     or v_mapping.external_url is distinct from v_values->>'external_url'
     or v_variant.product_id is distinct from v_product_id
     or not v_variant.is_active
     or v_current_variant.product_id is distinct from v_product_id
     or not v_current_variant.is_active
     or not v_product.is_active or v_product.merged_into_product_id is not null
     or v_offer.product_id is distinct from v_product_id
     or v_offer.retailer_id is distinct from v_retailer_id
     or v_offer.retailer_product_id is distinct from v_mapping_id
     or v_offer.product_variant_id is distinct from v_expected_variant_id
     or (select count(*) from public.retailer_products
         where retailer_id=v_retailer_id and product_id=v_product_id) <> 1
     or (select count(*) from public.retailer_products
         where retailer_id=v_retailer_id
           and external_variant_id=v_values->>'external_variant_id'
           and id<>v_mapping_id) <> 0
     or (select count(*) from public.offers
         where retailer_id=v_retailer_id and product_id=v_product_id) <> 1 then
    return false;
  end if;

  if v_standalone then
    if v_mapping.product_variant_id is distinct from v_variant_id
       or not v_variant.is_default
       or not v_current_variant.is_default
       or (select count(*) from public.product_variants
           where product_id=v_product_id and is_active and not is_default) <> 0 then
      return false;
    end if;
  end if;

  if v_optioned and not v_switch_optioned then
    if v_mapping.product_variant_id is distinct from v_variant_id
       or not v_variant.is_default
       or not v_current_variant.is_default
       or (select count(*) from public.product_variants
           where product_id=v_product_id and is_active and not is_default) <> 0 then
      return false;
    end if;
  end if;

  if v_switch_optioned then
    if not v_current_variant.is_default
       or v_variant.is_default
       or public.atomic_import_normalize_product_format(v_evidence->>'product_format')
          is distinct from public.atomic_import_normalize_product_format(v_variant.product_format)
       or lower(v_evidence->>'flavour') not in (
         lower(coalesce(v_variant.flavour_code,'')),
         lower(coalesce(v_variant.flavour_label,''))
       )
       or nullif(v_evidence->>'size_value','')::numeric is distinct from v_variant.size_value
       or lower(v_evidence->>'size_unit') is distinct from lower(v_variant.size_unit)
       or (v_variant.pack_count is not null and v_variant.pack_count <> 1
           and nullif(v_evidence->>'pack_count','')::integer is distinct from v_variant.pack_count) then
      return false;
    end if;
    select value into v_option_flavour
    from jsonb_each_text(v_values->'external_options')
    where lower(key) in ('flavour','flavor') limit 1;
    if lower(v_option_flavour) not in (
      lower(coalesce(v_variant.flavour_code,'')),
      lower(coalesce(v_variant.flavour_label,''))
    ) then
      return false;
    end if;
    select value into v_option_size
    from jsonb_each_text(v_values->'external_options')
    where lower(key)='size' limit 1;
    v_normalized_option_size := public.atomic_import_normalize_size(v_option_size);
    if v_normalized_option_size is null
       or nullif(v_normalized_option_size->>'value','')::numeric is distinct from v_variant.size_value
       or v_normalized_option_size->>'unit' is distinct from v_variant.size_unit then
      return false;
    end if;
  end if;

  if p_plan#>'{expected_state,offer}' is distinct from jsonb_build_object(
       'id',v_offer.id::text,
       'product_id',v_offer.product_id::text,
       'retailer_id',v_offer.retailer_id::text,
       'product_variant_id',v_offer.product_variant_id::text,
       'retailer_product_id',v_offer.retailer_product_id::text,
       'price',public.atomic_import_decimal_string(v_offer.price),
       'shipping_cost',case when v_offer.shipping_cost is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.shipping_cost)) end,
       'total_price',case when v_offer.total_price is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.total_price)) end,
       'in_stock',v_offer.in_stock,
       'url',v_offer.url,
       'last_checked_at',v_offer.last_checked_at
     )
     or (
       p_plan#>>'{offer,action}' = 'noop'
       and p_plan#>'{offer,values}' is distinct from jsonb_build_object(
       'price',public.atomic_import_decimal_string(v_offer.price),
       'shipping_cost',case when v_offer.shipping_cost is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.shipping_cost)) end,
       'total_price',case when v_offer.total_price is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.total_price)) end,
       'url',v_offer.url,
       'in_stock',v_offer.in_stock,
       'last_checked_at',v_offer.last_checked_at
       )
     )
     or (
       p_plan#>>'{offer,action}' = 'identity_update'
       and p_plan#>'{offer,values}' is distinct from jsonb_build_object(
       'price',public.atomic_import_decimal_string(v_offer.price),
       'shipping_cost',case when v_offer.shipping_cost is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.shipping_cost)) end,
       'total_price',case when v_offer.total_price is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.total_price)) end,
       'url',v_offer.url,
       'in_stock',v_offer.in_stock,
       'last_checked_at',v_offer.last_checked_at,
       'product_variant_id',v_variant_id::text
       )
     ) then
    return false;
  end if;
  return true;
exception when others then
  return false;
end;
$legacy_upgrade$;

alter function public.atomic_import_is_legacy_mapping_upgrade(jsonb) owner to postgres;
revoke all on function public.atomic_import_is_legacy_mapping_upgrade(jsonb) from public, anon, authenticated, service_role;

do $patch_validate_optioned_legacy$
declare
  v_validate text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.validate_product_import_plan_read_only(jsonb)'::regprocedure)
  into v_validate;
  if v_validate is null then
    raise exception 'validate_product_import_plan_read_only(jsonb) is missing';
  end if;

  v_old := $$or v_offer_action not in ('create','update','noop')$$;
  v_new := $$or v_offer_action not in ('create','update','noop','identity_update')$$;
  if position(v_new in v_validate) = 0 then
    if position(v_old in v_validate) = 0 then
      raise exception 'validate_product_import_plan_read_only(jsonb) offer action target not found';
    end if;
    v_validate := replace(v_validate, v_old, v_new);
  end if;

  v_old := $$if v_offer_action in ('update','noop') then
    select jsonb_build_object('id',id::text,'product_id',product_id::text,'retailer_id',retailer_id::text,$$;
  v_new := $$if v_offer_action in ('update','noop','identity_update') then
    select jsonb_build_object('id',id::text,'product_id',product_id::text,'retailer_id',retailer_id::text,$$;
  if position(v_new in v_validate) = 0 then
    if position(v_old in v_validate) = 0 then
      raise exception 'validate_product_import_plan_read_only(jsonb) offer expected state branch target not found';
    end if;
    v_validate := replace(v_validate, v_old, v_new);
  end if;

  v_old := $$or (v_offer_action in ('update','noop') and not public.atomic_import_has_exact_keys(p_plan->'offer', array['action','id','values']))$$;
  v_new := $$or (v_offer_action in ('update','noop','identity_update') and not public.atomic_import_has_exact_keys(p_plan->'offer', array['action','id','values']))$$;
  if position(v_new in v_validate) = 0 then
    if position(v_old in v_validate) = 0 then
      raise exception 'validate_product_import_plan_read_only(jsonb) offer action schema target not found';
    end if;
    v_validate := replace(v_validate, v_old, v_new);
  end if;

  v_old := $$if not public.atomic_import_has_exact_keys(
      p_plan#>'{offer,values}', array['price','shipping_cost','total_price','url','in_stock','last_checked_at']
    )$$;
  v_new := $$if not (
      (v_offer_action = 'identity_update' and public.atomic_import_has_exact_keys(
        p_plan#>'{offer,values}', array['price','shipping_cost','total_price','url','in_stock','last_checked_at','product_variant_id']
      ))
      or (v_offer_action <> 'identity_update' and public.atomic_import_has_exact_keys(
        p_plan#>'{offer,values}', array['price','shipping_cost','total_price','url','in_stock','last_checked_at']
      ))
    )$$;
  if position(v_new in v_validate) = 0 then
    if position(v_old in v_validate) = 0 then
      raise exception 'validate_product_import_plan_read_only(jsonb) offer values schema target not found';
    end if;
    v_validate := replace(v_validate, v_old, v_new);
  end if;

  v_old := $$or jsonb_typeof(p_plan#>'{offer,values,in_stock}') <> 'boolean'
    or nullif(btrim(p_plan#>>'{offer,values,url}'), '') is null then$$;
  v_new := $$or jsonb_typeof(p_plan#>'{offer,values,in_stock}') <> 'boolean'
    or nullif(btrim(p_plan#>>'{offer,values,url}'), '') is null
    or (v_offer_action = 'identity_update'
      and jsonb_typeof(p_plan#>'{offer,values,product_variant_id}') <> 'string') then$$;
  if position(v_new in v_validate) = 0 then
    if position(v_old in v_validate) = 0 then
      raise exception 'validate_product_import_plan_read_only(jsonb) offer identity_update value target not found';
    end if;
    v_validate := replace(v_validate, v_old, v_new);
  end if;

  v_old := $$or (v_offer_action in ('update','noop')) <> (jsonb_typeof(p_plan#>'{expected_state,offer}') = 'object')$$;
  v_new := $$or (v_offer_action in ('update','noop','identity_update')) <> (jsonb_typeof(p_plan#>'{expected_state,offer}') = 'object')$$;
  if position(v_new in v_validate) = 0 and position(v_old in v_validate) > 0 then
    v_validate := replace(v_validate, v_old, v_new);
  end if;

  execute v_validate;
end;
$patch_validate_optioned_legacy$;

alter function public.validate_product_import_plan_read_only(jsonb) owner to postgres;
revoke all on function public.validate_product_import_plan_read_only(jsonb) from public, anon, authenticated, service_role;

do $patch_apply_optioned_legacy$
declare
  v_apply text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.apply_product_import_plan(jsonb)'::regprocedure)
  into v_apply;
  if v_apply is null then
    raise exception 'apply_product_import_plan(jsonb) is missing';
  end if;

  v_old := $$or v_offer_action is null or v_offer_action not in ('create','update','noop')$$;
  v_new := $$or v_offer_action is null or v_offer_action not in ('create','update','noop','identity_update')$$;
  if position(v_new in v_apply) = 0 then
    if position(v_old in v_apply) = 0 then
      raise exception 'apply_product_import_plan(jsonb) offer action target not found';
    end if;
    v_apply := replace(v_apply, v_old, v_new);
  end if;

  v_old := $$if v_offer_action in ('update','noop') then
    v_offer_id := (p_plan#>>'{offer,id}')::bigint;$$;
  v_new := $$if v_offer_action in ('update','noop','identity_update') then
    v_offer_id := (p_plan#>>'{offer,id}')::bigint;$$;
  if position(v_new in v_apply) = 0 then
    if position(v_old in v_apply) = 0 then
      raise exception 'apply_product_import_plan(jsonb) offer expected state branch target not found';
    end if;
    v_apply := replace(v_apply, v_old, v_new);
  end if;

  v_old := $$or (v_offer_action in ('update','noop') and not public.atomic_import_has_exact_keys(p_plan->'offer', array['action','id','values']))$$;
  v_new := $$or (v_offer_action in ('update','noop','identity_update') and not public.atomic_import_has_exact_keys(p_plan->'offer', array['action','id','values']))$$;
  if position(v_new in v_apply) = 0 then
    if position(v_old in v_apply) = 0 then
      raise exception 'apply_product_import_plan(jsonb) offer action schema target not found';
    end if;
    v_apply := replace(v_apply, v_old, v_new);
  end if;

  v_old := $$if not public.atomic_import_has_exact_keys(
    p_plan#>'{offer,values}',
    array['price','shipping_cost','total_price','url','in_stock','last_checked_at']
  )$$;
  v_new := $$if not (
    (v_offer_action = 'identity_update' and public.atomic_import_has_exact_keys(
      p_plan#>'{offer,values}',
      array['price','shipping_cost','total_price','url','in_stock','last_checked_at','product_variant_id']
    ))
    or (v_offer_action <> 'identity_update' and public.atomic_import_has_exact_keys(
      p_plan#>'{offer,values}',
      array['price','shipping_cost','total_price','url','in_stock','last_checked_at']
    ))
  )$$;
  if position(v_new in v_apply) = 0 then
    if position(v_old in v_apply) = 0 then
      raise exception 'apply_product_import_plan(jsonb) offer values schema target not found';
    end if;
    v_apply := replace(v_apply, v_old, v_new);
  end if;

  v_old := $$or jsonb_typeof(p_plan#>'{offer,values,in_stock}') <> 'boolean'
  or jsonb_typeof(p_plan#>'{offer,values,last_checked_at}') <> 'string' then$$;
  v_new := $$or jsonb_typeof(p_plan#>'{offer,values,in_stock}') <> 'boolean'
  or jsonb_typeof(p_plan#>'{offer,values,last_checked_at}') <> 'string'
  or (v_offer_action = 'identity_update'
    and jsonb_typeof(p_plan#>'{offer,values,product_variant_id}') <> 'string') then$$;
  if position(v_new in v_apply) = 0 then
    if position(v_old in v_apply) = 0 then
      raise exception 'apply_product_import_plan(jsonb) offer identity_update value target not found';
    end if;
    v_apply := replace(v_apply, v_old, v_new);
  end if;

  v_old := $$or (v_offer_action in ('update','noop')) <> (jsonb_typeof(p_plan#>'{expected_state,offer}') = 'object')$$;
  v_new := $$or (v_offer_action in ('update','noop','identity_update')) <> (jsonb_typeof(p_plan#>'{expected_state,offer}') = 'object')$$;
  if position(v_new in v_apply) = 0 and position(v_old in v_apply) > 0 then
    v_apply := replace(v_apply, v_old, v_new);
  end if;

  v_old := $$  v_field text;
begin
  perform public.validate_product_import_plan_read_only(p_plan);$$;
  v_new := $$  v_field text;
  v_legacy_mapping_upgrade_allowed boolean := false;
begin
  perform public.validate_product_import_plan_read_only(p_plan);
  v_legacy_mapping_upgrade_allowed := public.atomic_import_is_legacy_mapping_upgrade(p_plan);$$;
  if position(v_new in v_apply) = 0 then
    if position(v_old in v_apply) = 0 then
      raise exception 'apply_product_import_plan(jsonb) legacy preflight cache target not found';
    end if;
    v_apply := replace(v_apply, v_old, v_new);
  end if;

  v_old := $$       or v_mapping.product_variant_id is distinct from v_variant_id then$$;
  v_new := $$       or (v_mapping.product_variant_id is distinct from v_variant_id
           and not v_legacy_mapping_upgrade_allowed) then$$;
  if position(v_new in v_apply) = 0 then
    if position(v_old in v_apply) = 0 then
      raise exception 'apply_product_import_plan(jsonb) mapping variant guard target not found';
    end if;
    v_apply := replace(v_apply, v_old, v_new);
  end if;

  v_old := $$      external_name = p_plan#>>'{retailer_product,values,external_name}',$$;
  v_new := $$      product_variant_id = nullif(p_plan#>>'{retailer_product,values,product_variant_id}','')::bigint,
      external_name = p_plan#>>'{retailer_product,values,external_name}',$$;
  if position(v_new in v_apply) = 0 then
    if position(v_old in v_apply) = 0 then
      raise exception 'apply_product_import_plan(jsonb) mapping update target not found';
    end if;
    v_apply := replace(v_apply, v_old, v_new);
  end if;

  v_old := $$       or v_offer.product_variant_id is distinct from v_variant_id$$;
  v_new := $$       or (v_offer.product_variant_id is distinct from v_variant_id
           and not v_legacy_mapping_upgrade_allowed)$$;
  if position(v_new in v_apply) = 0 then
    if position(v_old in v_apply) = 0 then
      raise exception 'apply_product_import_plan(jsonb) offer variant guard target not found';
    end if;
    v_apply := replace(v_apply, v_old, v_new);
  end if;

  v_old := $$  if v_offer_action = 'noop' and v_offer_changed then
    raise exception 'invalid offer noop values';
  end if;$$;
  v_new := $$  if v_offer_action = 'identity_update' and (
      not v_legacy_mapping_upgrade_allowed
      or v_offer_changed
      or nullif(p_plan#>>'{offer,values,product_variant_id}','')::bigint is distinct from v_variant_id
    ) then
    raise exception 'invalid offer identity_update values';
  end if;
  if v_offer_action = 'noop' and v_offer_changed then
    raise exception 'invalid offer noop values';
  end if;$$;
  if position(v_new in v_apply) = 0 then
    if position(v_old in v_apply) = 0 then
      raise exception 'apply_product_import_plan(jsonb) offer identity_update guard target not found';
    end if;
    v_apply := replace(v_apply, v_old, v_new);
  end if;

  v_old := $$     or (v_offer_action = 'noop' and v_history_action <> 'noop') then$$;
  v_new := $$     or (v_offer_action = 'noop' and v_history_action <> 'noop')
     or (v_offer_action = 'identity_update' and v_history_action <> 'noop') then$$;
  if position(v_new in v_apply) = 0 then
    if position(v_old in v_apply) = 0 then
      raise exception 'apply_product_import_plan(jsonb) identity_update history target not found';
    end if;
    v_apply := replace(v_apply, v_old, v_new);
  end if;

  v_old := $$  elsif v_offer_action = 'update' then
    update public.offers set$$;
  v_new := $$  elsif v_offer_action = 'identity_update' then
    update public.offers set
      product_variant_id = v_variant_id
    where id = v_offer_id;
  elsif v_offer_action = 'update' then
    update public.offers set$$;
  if position(v_new in v_apply) = 0 then
    if position(v_old in v_apply) = 0 then
      raise exception 'apply_product_import_plan(jsonb) offer identity_update apply target not found';
    end if;
    v_apply := replace(v_apply, v_old, v_new);
  end if;

  execute v_apply;
end;
$patch_apply_optioned_legacy$;

alter function public.apply_product_import_plan(jsonb) owner to postgres;
revoke all on function public.apply_product_import_plan(jsonb) from public, anon, authenticated, service_role;

commit;
