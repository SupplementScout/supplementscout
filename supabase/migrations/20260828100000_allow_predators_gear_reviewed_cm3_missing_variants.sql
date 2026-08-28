begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Validator-only transport for five owner-reviewed CM3 variants. This does not
-- mutate catalogue tables and remains bound to retailer 13, products 361/1067,
-- one WooCommerce parent, and five exact source/canonical/commercial tuples.
create or replace function public.atomic_import_predators_cm3_missing_variant_allowed(
  p_plan jsonb
) returns boolean
language sql
immutable
strict
set search_path = pg_catalog, public, pg_temp
as $function$
  select
    p_plan#>>'{meta,operation_type}' = 'standard_import'
    and p_plan#>>'{meta,plan_kind}' = 'feed'
    and p_plan#>>'{product,action}' = 'existing'
    and p_plan#>>'{product_variant,action}' = 'create_variant'
    and p_plan#>>'{retailer,action}' = 'existing'
    and p_plan#>>'{retailer,id}' = '13'
    and p_plan#>>'{retailer_product,action}' = 'create'
    and p_plan#>>'{offer,action}' = 'create'
    and p_plan#>>'{price_history,action}' = 'create'
    and p_plan#>'{approval,approved}' = 'false'::jsonb
    and p_plan#>>'{approval,approval_type}' = 'none'
    and p_plan#>>'{retailer_product,values,external_product_id}' = '8594181607503'
    and p_plan#>>'{retailer_product,values,external_url}' =
      'https://predatorsgear.co.uk/supplements-vitamins-shop/creatine-cm3/'
    and p_plan#>>'{offer,values,url}' =
      'https://predatorsgear.co.uk/supplements-vitamins-shop/creatine-cm3/'
    and p_plan#>>'{offer,values,shipping_cost}' = '0'
    and p_plan#>>'{offer,values,total_price}' = p_plan#>>'{offer,values,price}'
    and p_plan#>'{offer,values,in_stock}' = 'true'::jsonb
    and exists (
      select 1
      from (values
        ('361','8594181607507','5902114018818','05902114018818','Orange','orange','orange-250g','Orange / 250g','250','21.99','Trec CM3 Creatine Powder 250g','trec-cm3-creatine-powder-250g'),
        ('361','8594181607563','5902114018825','05902114018825','White Cola','white cola','white-cola-250g','White Cola / 250g','250','21.99','Trec CM3 Creatine Powder 250g','trec-cm3-creatine-powder-250g'),
        ('1067','8594181607506','5902114018832','05902114018832','Orange','orange','orange-500g','Orange / 500g','500','34.99','Trec Nutrition CM3 Tri-Creatine Malate 500g White Cola','trec-nutrition-cm3-tri-creatine-malate-500g-white-cola'),
        ('1067','8594181607977','5902114017750','05902114017750','Fresh Pineapple','fresh pineapple','fresh-pineapple-500g','Fresh Pineapple / 500g','500','34.99','Trec Nutrition CM3 Tri-Creatine Malate 500g White Cola','trec-nutrition-cm3-tri-creatine-malate-500g-white-cola'),
        ('1067','8594181607978','5902114017767','05902114017767','Pink Grapefruit','pink grapefruit','pink-grapefruit-500g','Pink Grapefruit / 500g','500','34.99','Trec Nutrition CM3 Tri-Creatine Malate 500g White Cola','trec-nutrition-cm3-tri-creatine-malate-500g-white-cola')
      ) allowed(
        product_id, external_variant_id, external_sku, external_gtin,
        flavour_label, flavour_code, variant_key, display_name, size_value,
        price, external_name, external_slug
      )
      where p_plan#>>'{product,id}' = allowed.product_id
        and p_plan#>>'{retailer_product,values,external_variant_id}' = allowed.external_variant_id
        and p_plan#>>'{retailer_product,values,external_sku}' = allowed.external_sku
        and p_plan#>>'{retailer_product,values,external_gtin}' = allowed.external_gtin
        and p_plan#>>'{retailer_product,values,external_name}' = allowed.external_name
        and p_plan#>>'{retailer_product,values,external_slug}' = allowed.external_slug
        and p_plan#>'{retailer_product,values,external_options}' =
          jsonb_build_object('Size', allowed.size_value || 'g', 'Flavour', allowed.flavour_label)
        and p_plan#>>'{product_variant,values,flavour_label}' = allowed.flavour_label
        and p_plan#>>'{product_variant,values,flavour_code}' = allowed.flavour_code
        and p_plan#>>'{product_variant,values,variant_key}' = allowed.variant_key
        and p_plan#>>'{product_variant,values,display_name}' = allowed.display_name
        and p_plan#>>'{product_variant,values,size_value}' = allowed.size_value
        and p_plan#>>'{product_variant,values,size_unit}' = 'g'
        and p_plan#>>'{product_variant,values,pack_count}' = '1'
        and p_plan#>>'{product_variant,values,product_format}' = 'powder'
        and p_plan#>>'{offer,values,price}' = allowed.price
    )
$function$;

create or replace function public.atomic_import_predators_cm3_parent_cohort_exact()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
  select count(*) between 3 and 8
    and count(*) filter (
      where rp.external_variant_id in ('8594181607509','8594181607979','8594181607980')
    ) = 3
    and bool_and(
    (rp.product_id = 1067
      and rp.product_variant_id = 2250
      and rp.external_variant_id = '8594181607509'
      and rp.external_url = 'https://predatorsgear.co.uk/?p=8594181607503'
      and rp.external_options = jsonb_build_object('Size','500g','Flavour','White Cola')
      and pv.product_id = 1067 and pv.is_active)
    or (rp.product_id = 361
      and rp.product_variant_id = 1694
      and rp.external_variant_id = '8594181607979'
      and rp.external_url = 'https://predatorsgear.co.uk/supplements-vitamins-shop/creatine-cm3/'
      and rp.external_options = jsonb_build_object('Size','250g','Flavour','Pink Grapefruit')
      and pv.product_id = 361 and pv.is_active)
    or (rp.product_id = 361
      and rp.product_variant_id = 1043
      and rp.external_variant_id = '8594181607980'
      and rp.external_url = 'https://predatorsgear.co.uk/supplements-vitamins-shop/creatine-cm3/'
      and rp.external_options = jsonb_build_object('Size','250g','Flavour','Fresh Pineapple')
      and pv.product_id = 361 and pv.is_active)
    or (rp.product_id = 361
      and rp.external_variant_id = '8594181607507'
      and rp.external_sku = '5902114018818'
      and rp.external_gtin = '05902114018818'
      and rp.external_url = 'https://predatorsgear.co.uk/supplements-vitamins-shop/creatine-cm3/'
      and rp.external_options = jsonb_build_object('Size','250g','Flavour','Orange')
      and pv.product_id = 361 and pv.is_active and not pv.is_default
      and pv.variant_key = 'orange-250g' and pv.flavour_label = 'Orange'
      and pv.size_value = 250 and lower(pv.size_unit) = 'g')
    or (rp.product_id = 361
      and rp.external_variant_id = '8594181607563'
      and rp.external_sku = '5902114018825'
      and rp.external_gtin = '05902114018825'
      and rp.external_url = 'https://predatorsgear.co.uk/supplements-vitamins-shop/creatine-cm3/'
      and rp.external_options = jsonb_build_object('Size','250g','Flavour','White Cola')
      and pv.product_id = 361 and pv.is_active and not pv.is_default
      and pv.variant_key = 'white-cola-250g' and pv.flavour_label = 'White Cola'
      and pv.size_value = 250 and lower(pv.size_unit) = 'g')
    or (rp.product_id = 1067
      and rp.external_variant_id = '8594181607506'
      and rp.external_sku = '5902114018832'
      and rp.external_gtin = '05902114018832'
      and rp.external_url = 'https://predatorsgear.co.uk/supplements-vitamins-shop/creatine-cm3/'
      and rp.external_options = jsonb_build_object('Size','500g','Flavour','Orange')
      and pv.product_id = 1067 and pv.is_active and not pv.is_default
      and pv.variant_key = 'orange-500g' and pv.flavour_label = 'Orange'
      and pv.size_value = 500 and lower(pv.size_unit) = 'g')
    or (rp.product_id = 1067
      and rp.external_variant_id = '8594181607977'
      and rp.external_sku = '5902114017750'
      and rp.external_gtin = '05902114017750'
      and rp.external_url = 'https://predatorsgear.co.uk/supplements-vitamins-shop/creatine-cm3/'
      and rp.external_options = jsonb_build_object('Size','500g','Flavour','Fresh Pineapple')
      and pv.product_id = 1067 and pv.is_active and not pv.is_default
      and pv.variant_key = 'fresh-pineapple-500g' and pv.flavour_label = 'Fresh Pineapple'
      and pv.size_value = 500 and lower(pv.size_unit) = 'g')
    or (rp.product_id = 1067
      and rp.external_variant_id = '8594181607978'
      and rp.external_sku = '5902114017767'
      and rp.external_gtin = '05902114017767'
      and rp.external_url = 'https://predatorsgear.co.uk/supplements-vitamins-shop/creatine-cm3/'
      and rp.external_options = jsonb_build_object('Size','500g','Flavour','Pink Grapefruit')
      and pv.product_id = 1067 and pv.is_active and not pv.is_default
      and pv.variant_key = 'pink-grapefruit-500g' and pv.flavour_label = 'Pink Grapefruit'
      and pv.size_value = 500 and lower(pv.size_unit) = 'g')
  )
  from public.retailer_products rp
  join public.product_variants pv on pv.id = rp.product_variant_id
  where rp.retailer_id = 13
    and rp.external_product_id = '8594181607503'
$function$;

do $patch_validator$
declare
  v_function regprocedure :=
    to_regprocedure('public.atomic_import_validate_variant_plan_core(jsonb)');
  v_definition text;
  v_definition_hash text;
  v_old text;
  v_new text;
begin
  if v_function is null then
    raise exception 'Predators Gear CM3 variant validator prerequisite is missing';
  end if;
  select pg_catalog.pg_get_functiondef(v_function) into v_definition;
  v_definition_hash := encode(
    pg_catalog.sha256(convert_to(v_definition, 'UTF8')),
    'hex'
  );
  if v_definition_hash <>
     'ceeed1edd5b17699b3f31098d113beef578f41e586deeda476b55b45f10bfda3' then
    raise exception
      'Predators Gear CM3 variant validator drifted (%)',
      v_definition_hash;
  end if;

  v_old := $old$
    where rp.retailer_id = v_retailer_id
      and rp.external_url = v_external_url
      and not exists (
$old$;
  v_new := $new$
    where rp.retailer_id = v_retailer_id
      and rp.external_url = v_external_url
      and not (
        public.atomic_import_predators_cm3_missing_variant_allowed(p_plan)
        and public.atomic_import_predators_cm3_parent_cohort_exact()
        and rp.external_product_id = '8594181607503'
        and rp.product_id in (361,1067)
        and rp.product_id is distinct from v_product_id
      )
      and not exists (
$new$;
  if (length(v_definition) - length(replace(v_definition, v_old, ''))) /
       length(v_old) <> 1 then
    raise exception 'Predators Gear CM3 shared URL peer guard is missing or ambiguous';
  end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$
    where retailer_id = v_retailer_id
      and external_product_id = v_external_product_id
      and product_id is distinct from v_product_id
  ) then
$old$;
  v_new := $new$
    where retailer_id = v_retailer_id
      and external_product_id = v_external_product_id
      and product_id is distinct from v_product_id
      and not (
        public.atomic_import_predators_cm3_missing_variant_allowed(p_plan)
        and public.atomic_import_predators_cm3_parent_cohort_exact()
      )
  ) then
$new$;
  if (length(v_definition) - length(replace(v_definition, v_old, ''))) /
       length(v_old) <> 1 then
    raise exception 'Predators Gear CM3 cross-product parent guard is missing or ambiguous';
  end if;
  v_definition := replace(v_definition, v_old, v_new);

  execute v_definition;
end
$patch_validator$;

alter function public.atomic_import_predators_cm3_missing_variant_allowed(jsonb)
  owner to postgres;
alter function public.atomic_import_predators_cm3_parent_cohort_exact()
  owner to postgres;
alter function public.atomic_import_validate_variant_plan_core(jsonb)
  owner to postgres;

revoke all on function
  public.atomic_import_predators_cm3_missing_variant_allowed(jsonb),
  public.atomic_import_predators_cm3_parent_cohort_exact()
  from public, anon, authenticated, service_role;

do $postflight$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.atomic_import_validate_variant_plan_core(jsonb)'::regprocedure
  ) into v_definition;
  if pg_catalog.strpos(
       v_definition,
       'atomic_import_predators_cm3_missing_variant_allowed(p_plan)'
     ) = 0
     or (
       select has_function_privilege(
         'service_role',
         'public.atomic_import_predators_cm3_missing_variant_allowed(jsonb)',
         'EXECUTE'
       )
     )
     or (
       select has_function_privilege(
         'service_role',
         'public.atomic_import_predators_cm3_parent_cohort_exact()',
         'EXECUTE'
       )
     ) then
    raise exception 'Predators Gear CM3 variant guard postflight failed';
  end if;
end
$postflight$;

commit;
