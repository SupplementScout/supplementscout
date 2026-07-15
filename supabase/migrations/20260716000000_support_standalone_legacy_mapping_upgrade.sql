begin;

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
  v_product public.products%rowtype;
  v_optioned boolean;
  v_standalone boolean;
begin
  if p_plan#>>'{meta,operation_type}' is distinct from 'legacy_mapping_upgrade'
     or p_plan#>>'{meta,plan_kind}' is distinct from 'feed'
     or p_plan#>>'{product,action}' <> 'existing'
     or p_plan#>>'{product_variant,action}' <> 'existing'
     or p_plan#>>'{retailer,action}' <> 'existing'
     or p_plan#>>'{retailer_product,action}' not in ('update','noop')
     or p_plan#>>'{offer,action}' <> 'noop'
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

  if v_mapping_id is null or v_product_id is null or v_variant_id is null
     or v_retailer_id is null or v_offer_id is null
     or nullif(v_values->>'external_product_id','') is null
     or nullif(v_values->>'external_variant_id','') is null
     or nullif(v_values->>'external_sku','') is null
     or v_evidence->>'approved_mapping_id' is distinct from v_mapping_id::text
     or v_expected->>'id' is distinct from v_mapping_id::text
     or v_expected->>'product_id' is distinct from v_product_id::text
     or v_expected->>'retailer_id' is distinct from v_retailer_id::text
     or v_expected->>'product_variant_id' is distinct from v_variant_id::text
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
    jsonb_typeof(v_values->'external_options') = 'object'
    and (select count(*) from jsonb_each(v_values->'external_options')) = 2
    and (v_values->'external_options' ? 'Size')
    and (v_values->'external_options' ? 'Flavour')
    and nullif(v_evidence->>'size_value','') is not null
    and nullif(v_evidence->>'size_unit','') is not null
    and nullif(v_evidence->>'flavour','') is not null;

  v_standalone :=
    coalesce(v_values->'external_options', 'null'::jsonb) = 'null'::jsonb
    and coalesce(v_evidence->'external_options', 'null'::jsonb) = 'null'::jsonb
    and v_retailer_id = (select id from public.retailers where slug='whey-okay' limit 1)
    and v_values->>'external_product_id' = v_values->>'external_variant_id'
    and nullif(v_evidence->>'size_value','') is null
    and nullif(v_evidence->>'size_unit','') is null
    and nullif(v_evidence->>'flavour','') is null;

  if not (v_optioned or v_standalone) then
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
  select * into v_product from public.products where id=v_product_id;

  if v_mapping.id is null or v_offer.id is null or v_variant.id is null or v_product.id is null
     or v_mapping.retailer_id is distinct from v_retailer_id
     or v_mapping.product_id is distinct from v_product_id
     or v_mapping.product_variant_id is distinct from v_variant_id
     or v_mapping.external_url is distinct from v_values->>'external_url'
     or v_variant.product_id is distinct from v_product_id
     or not v_variant.is_active or not v_variant.is_default
     or not v_product.is_active or v_product.merged_into_product_id is not null
     or v_offer.product_id is distinct from v_product_id
     or v_offer.retailer_id is distinct from v_retailer_id
     or v_offer.retailer_product_id is distinct from v_mapping_id
     or v_offer.product_variant_id is distinct from v_variant_id
     or (select count(*) from public.product_variants
         where product_id=v_product_id and is_active and not is_default) <> 0
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
     or p_plan#>'{offer,values}' is distinct from jsonb_build_object(
       'price',public.atomic_import_decimal_string(v_offer.price),
       'shipping_cost',case when v_offer.shipping_cost is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.shipping_cost)) end,
       'total_price',case when v_offer.total_price is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.total_price)) end,
       'url',v_offer.url,
       'in_stock',v_offer.in_stock,
       'last_checked_at',v_offer.last_checked_at
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

commit;
