begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Trigger-only exception for the seven exact Predators Gear CM3 variations
-- reviewed under one WooCommerce parent URL and two existing canonical pack
-- products. No catalogue row is changed by this migration.
create or replace function public.retailer_products_predators_cm3_cross_product_allowed(
  p_row public.retailer_products
) returns boolean
language sql
stable
strict
set search_path = pg_catalog, public, pg_temp
as $function$
  with allowed(
    product_id, external_variant_id, external_sku, external_gtin,
    flavour, flavour_code, display_name, size_value
  ) as (
    values
      (361::bigint,'8594181607979','5902114017743','05902114017743','Pink Grapefruit','pink grapefruit','Pink Grapefruit / 250g',250::numeric),
      (361::bigint,'8594181607980','5902114017736','05902114017736','Fresh Pineapple','fresh pineapple','Fresh Pineapple / 250g',250::numeric),
      (361::bigint,'8594181607507','5902114018818','05902114018818','Orange','orange','Orange / 250g',250::numeric),
      (361::bigint,'8594181607563','5902114018825','05902114018825','White Cola','white cola','White Cola / 250g',250::numeric),
      (1067::bigint,'8594181607506','5902114018832','05902114018832','Orange','orange','Orange / 500g',500::numeric),
      (1067::bigint,'8594181607977','5902114017750','05902114017750','Fresh Pineapple','fresh pineapple','Fresh Pineapple / 500g',500::numeric),
      (1067::bigint,'8594181607978','5902114017767','05902114017767','Pink Grapefruit','pink grapefruit','Pink Grapefruit / 500g',500::numeric)
  )
  select
    p_row.retailer_id = 13
    and p_row.external_url = 'https://predatorsgear.co.uk/supplements-vitamins-shop/creatine-cm3/'
    and p_row.external_product_id = '8594181607503'
    and exists (
      select 1
      from allowed a
      join public.product_variants pv
        on pv.id = p_row.product_variant_id
       and pv.product_id = a.product_id
       and pv.is_active
       and not pv.is_default
       and pv.display_name = a.display_name
       and pv.flavour_code = a.flavour_code
       and pv.flavour_label = a.flavour
       and pv.size_value = a.size_value
       and pv.size_unit = 'g'
       and pv.pack_count = 1
       and pv.product_format = 'powder'
      where p_row.product_id = a.product_id
        and p_row.external_variant_id = a.external_variant_id
        and p_row.external_sku = a.external_sku
        and p_row.external_gtin = a.external_gtin
        and p_row.external_options = jsonb_build_object(
          'Size', a.size_value::text || 'g',
          'Flavour', a.flavour
        )
    )
    and not exists (
      select 1
      from public.retailer_products rp
      left join public.product_variants pv on pv.id = rp.product_variant_id
      where rp.retailer_id = 13
        and rp.external_url = 'https://predatorsgear.co.uk/supplements-vitamins-shop/creatine-cm3/'
        and not exists (
          select 1
          from allowed a
          where rp.product_id = a.product_id
            and rp.external_product_id = '8594181607503'
            and rp.external_variant_id = a.external_variant_id
            and rp.external_sku = a.external_sku
            and rp.external_gtin = a.external_gtin
            and rp.external_options = jsonb_build_object(
              'Size', a.size_value::text || 'g',
              'Flavour', a.flavour
            )
            and pv.product_id = a.product_id
            and pv.is_active
            and not pv.is_default
            and pv.display_name = a.display_name
            and pv.flavour_code = a.flavour_code
            and pv.flavour_label = a.flavour
            and pv.size_value = a.size_value
            and pv.size_unit = 'g'
            and pv.pack_count = 1
            and pv.product_format = 'powder'
        )
    );
$function$;

do $patch_trigger$
declare
  v_definition text;
  v_old text := $old$and product_id is distinct from new.product_id
  ) then$old$;
  v_new text := $new$and product_id is distinct from new.product_id
      and not public.retailer_products_predators_cm3_cross_product_allowed(new)
  ) then$new$;
begin
  select pg_catalog.pg_get_functiondef(
    'public.retailer_products_enforce_url_identity_partition()'::regprocedure
  ) into v_definition;

  if encode(pg_catalog.sha256(convert_to(v_definition, 'UTF8')), 'hex') <>
       'ad3a6ddbde8470ef6e991471289b246a27d9620e6e081be09baa3a4dbc717d82' then
    raise exception 'retailer URL identity trigger definition drifted';
  end if;
  if (length(v_definition) - length(replace(v_definition, v_old, ''))) /
       length(v_old) <> 1 then
    raise exception 'retailer URL canonical product guard is missing or ambiguous';
  end if;

  execute replace(v_definition, v_old, v_new);
end
$patch_trigger$;

alter function public.retailer_products_predators_cm3_cross_product_allowed(public.retailer_products)
  owner to postgres;
alter function public.retailer_products_enforce_url_identity_partition()
  owner to postgres;

revoke all on function
  public.retailer_products_predators_cm3_cross_product_allowed(public.retailer_products)
  from public, anon, authenticated, service_role;

do $postflight$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.retailer_products_enforce_url_identity_partition()'::regprocedure
  ) into v_definition;
  if pg_catalog.strpos(
       v_definition,
       'retailer_products_predators_cm3_cross_product_allowed(new)'
     ) = 0
     or (
       select has_function_privilege(
         'service_role',
         'public.retailer_products_predators_cm3_cross_product_allowed(public.retailer_products)',
         'EXECUTE'
       )
     ) then
    raise exception 'Predators Gear CM3 trigger exception postflight failed';
  end if;
end
$postflight$;

commit;
