begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Extend the existing atomic legacy-mapping path for the owner-reviewed
-- Simply Supplements bootstrap. This branch changes only the three external
-- identity fields and deliberately preserves null external_options.
alter function public.atomic_import_is_legacy_mapping_upgrade(jsonb)
  rename to atomic_import_is_legacy_mapping_upgrade_pre_simply;

create or replace function public.atomic_import_is_simply_identity_only_upgrade(p_plan jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $simply_identity$
declare
  v_mapping_id bigint := nullif(p_plan#>>'{retailer_product,id}','')::bigint;
  v_product_id bigint := nullif(p_plan#>>'{product,id}','')::bigint;
  v_variant_id bigint := nullif(p_plan#>>'{product_variant,id}','')::bigint;
  v_retailer_id bigint := nullif(p_plan#>>'{retailer,id}','')::bigint;
  v_offer_id bigint := nullif(p_plan#>>'{offer,id}','')::bigint;
  v_expected jsonb := p_plan#>'{expected_state,retailer_product}';
  v_values jsonb := p_plan#>'{retailer_product,values}';
  v_mapping public.retailer_products%rowtype;
  v_offer public.offers%rowtype;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
begin
  if p_plan#>>'{meta,operation_type}' is distinct from 'legacy_mapping_upgrade'
     or p_plan#>>'{meta,plan_kind}' is distinct from 'feed'
     or p_plan#>>'{product,action}' is distinct from 'existing'
     or p_plan#>>'{product_variant,action}' is distinct from 'existing'
     or p_plan#>>'{retailer,action}' is distinct from 'existing'
     or p_plan#>>'{retailer_product,action}' is distinct from 'update'
     or p_plan#>>'{offer,action}' is distinct from 'noop'
     or p_plan#>>'{price_history,action}' is distinct from 'noop'
     or v_mapping_id is null or v_product_id is null or v_variant_id is null
     or v_retailer_id is null or v_offer_id is null
     or v_retailer_id is distinct from (
       select id from public.retailers where slug='simply-supplements' limit 1
     )
     or v_expected->>'id' is distinct from v_mapping_id::text
     or v_expected->>'retailer_id' is distinct from v_retailer_id::text
     or v_expected->>'product_id' is distinct from v_product_id::text
     or v_expected->>'product_variant_id' is distinct from v_variant_id::text
     or v_values->>'product_variant_id' is distinct from v_variant_id::text
     or coalesce(v_expected->'external_options','null'::jsonb) <> 'null'::jsonb
     or coalesce(v_values->'external_options','null'::jsonb) <> 'null'::jsonb
     or nullif(v_values->>'external_product_id','') is null
     or nullif(v_values->>'external_product_id','') !~ '^[0-9]+$'
     or nullif(v_values->>'external_variant_id','') is null
     or nullif(v_values->>'external_variant_id','') !~ '^[0-9]+$'
     or nullif(v_values->>'external_sku','') is null
     or v_values->>'external_product_id' = v_values->>'external_variant_id'
     or v_values->>'external_name' is distinct from v_expected->>'external_name'
     or v_values->>'external_slug' is distinct from v_expected->>'external_slug'
     or v_values->>'external_gtin' is distinct from v_expected->>'external_gtin'
     or v_values->>'external_url' is distinct from v_expected->>'external_url'
     or v_values->>'match_method' is distinct from v_expected->>'match_method'
     or v_values->>'match_confidence' is distinct from v_expected->>'match_confidence' then
    return false;
  end if;

  select * into v_mapping from public.retailer_products where id=v_mapping_id;
  select * into v_offer from public.offers where id=v_offer_id;
  select * into v_product from public.products where id=v_product_id;
  select * into v_variant from public.product_variants where id=v_variant_id;

  if v_mapping.id is null or v_offer.id is null or v_product.id is null or v_variant.id is null
     or v_mapping.retailer_id is distinct from v_retailer_id
     or v_mapping.product_id is distinct from v_product_id
     or v_mapping.product_variant_id is distinct from v_variant_id
     or v_mapping.external_product_id is not null
     or v_mapping.external_variant_id is not null
     or v_mapping.external_sku is not null
     or v_mapping.external_options is not null
     or v_mapping.external_name is distinct from v_expected->>'external_name'
     or v_mapping.external_slug is distinct from v_expected->>'external_slug'
     or v_mapping.external_gtin is distinct from v_expected->>'external_gtin'
     or v_mapping.external_url is distinct from v_expected->>'external_url'
     or v_mapping.match_method is distinct from v_expected->>'match_method'
     or v_mapping.match_confidence::text is distinct from v_expected->>'match_confidence'
     or v_mapping.updated_at is distinct from (v_expected->>'updated_at')::timestamptz
     or v_offer.retailer_id is distinct from v_retailer_id
     or v_offer.product_id is distinct from v_product_id
     or v_offer.product_variant_id is distinct from v_variant_id
     or v_offer.retailer_product_id is distinct from v_mapping_id
     or v_variant.product_id is distinct from v_product_id
     or not v_variant.is_active
     or not v_product.is_active
     or v_product.merged_into_product_id is not null
     or (select count(*) from public.retailer_products
         where retailer_id=v_retailer_id and product_id=v_product_id) <> 1
     or (select count(*) from public.offers
         where retailer_id=v_retailer_id and product_id=v_product_id) <> 1
     or exists(select 1 from public.retailer_products
         where retailer_id=v_retailer_id
           and external_variant_id=v_values->>'external_variant_id'
           and id<>v_mapping_id) then
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
$simply_identity$;

create or replace function public.atomic_import_is_legacy_mapping_upgrade(p_plan jsonb)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $wrapper$
  select public.atomic_import_is_legacy_mapping_upgrade_pre_simply(p_plan)
      or public.atomic_import_is_simply_identity_only_upgrade(p_plan)
$wrapper$;

alter function public.atomic_import_is_legacy_mapping_upgrade_pre_simply(jsonb) owner to postgres;
alter function public.atomic_import_is_simply_identity_only_upgrade(jsonb) owner to postgres;
alter function public.atomic_import_is_legacy_mapping_upgrade(jsonb) owner to postgres;
revoke all on function public.atomic_import_is_legacy_mapping_upgrade_pre_simply(jsonb),
  public.atomic_import_is_simply_identity_only_upgrade(jsonb),
  public.atomic_import_is_legacy_mapping_upgrade(jsonb)
  from public, anon, authenticated, service_role;

revoke all on function public.validate_product_import_plan_read_only(jsonb)
  from public, anon, authenticated, service_role;
do $grant_identity_validator$
begin
  if to_regrole('retailer_catalogue_staging_validator') is not null then
    grant execute on function public.validate_product_import_plan_read_only(jsonb)
      to retailer_catalogue_staging_validator;
  end if;
  if to_regrole('retailer_catalogue_production_validator') is not null then
    grant execute on function public.validate_product_import_plan_read_only(jsonb)
      to retailer_catalogue_production_validator;
  end if;
end;
$grant_identity_validator$;

commit;
