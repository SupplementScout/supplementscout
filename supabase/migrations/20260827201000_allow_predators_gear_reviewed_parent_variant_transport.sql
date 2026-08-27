begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)') is null
     or to_regprocedure('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)') is null
     or not public.atomic_import_reviewed_parent_variant_allowed(
       'DY Nutrition The Creatine Complex 316g',
       'DY Nutrition',
       'Creatine',
       'powder',
       '316',
       'g'
     ) then
    raise exception 'Predators Gear reviewed parent policy prerequisite is missing';
  end if;
end
$preflight$;

do $validator_transport_policy$
declare
  v_definition text;
  v_updated text;
  v_old text := $old$
  if v_retailer_actual->>'slug' <> 'jon-s-supplements' then
    raise exception 'reviewed parent explicit-variant policy is Jon''s-only';
  end if;
  if v_external_url !~ ('^' || replace(v_retailer_actual->>'website', '.', '\.') || '/products/.*[?&]variant=' || v_external_variant_id || '(&|$)') then
    raise exception 'reviewed parent explicit-variant requires strict Shopify variant URL identity';
  end if;
$old$;
  v_new text := $new$
  if v_retailer_actual->>'slug' = 'jon-s-supplements' then
    if v_external_url !~ ('^' || replace(v_retailer_actual->>'website', '.', '\.') || '/products/.*[?&]variant=' || v_external_variant_id || '(&|$)') then
      raise exception 'reviewed parent explicit-variant requires strict Shopify variant URL identity';
    end if;
  elsif v_retailer_id = 13
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
$new$;
begin
  select pg_get_functiondef('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure)
  into v_definition;

  if (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'reviewed parent retailer transport guard is missing or ambiguous';
  end if;

  v_updated := replace(v_definition, v_old, v_new);
  execute v_updated;

  if strpos(
    pg_get_functiondef('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure),
    'reviewed parent explicit-variant retailer and transport policy does not allow this plan'
  ) = 0 then
    raise exception 'Predators Gear reviewed parent transport guard was not installed';
  end if;
end
$validator_transport_policy$;

alter function public.atomic_import_validate_pre_source_metadata_plan_core(jsonb) owner to postgres;

commit;
