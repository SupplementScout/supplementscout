begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Policy only: this migration does not mutate catalogue or offer rows.
do $preflight$
begin
  if to_regprocedure('public.atomic_import_safe_create_category_allowed(text,text,text)') is null
     or to_regprocedure('public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)') is null
     or to_regprocedure('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)') is null then
    raise exception 'Predators Gear reviewed-new-products-v3 importer policy prerequisites are missing';
  end if;
end
$preflight$;

do $reviewed_safe_create_category$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_safe_create_category_allowed(text,text,text)'::regprocedure
  );
  v_anchor text := 'coalesce(p_category, '''') in (''Vitamins'',''Health Supplements'',''Amino Acids'',''Creatine'')';
  v_replacement text := '(' || v_anchor || $exact$
    or (
      coalesce(p_category, '') = 'Pre Workout'
      and coalesce(p_name, '') = 'Olimp AAKG 1250 Extreme Mega Caps 120 Capsules'
      and coalesce(p_product_format, '') = 'capsule'
    ))$exact$;
begin
  if (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor) <> 1
     or position('Olimp AAKG 1250 Extreme Mega Caps 120 Capsules' in v_definition) > 0 then
    raise exception 'safe-create category policy anchor/state mismatch';
  end if;
  execute replace(v_definition, v_anchor, v_replacement);
end
$reviewed_safe_create_category$;

do $reviewed_parent_policy$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)'::regprocedure
  );
  v_anchor text := '(''DY Nutrition The Creatine Complex 316g'',''DY Nutrition'',''Creatine'',''powder'',''316'',''g'')';
  v_replacement text := v_anchor || $exact$,
      ('Olimp BCAA Xplode 500g','Olimp','Amino Acids','powder','500','g'),
      ('Olimp Glutamine Xplode 500g','Olimp','Amino Acids','powder','500','g'),
      ('Olimp EAA Xplode 520g','Olimp','Amino Acids','powder','520','g')$exact$;
begin
  if (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor) <> 1
     or position('Olimp BCAA Xplode 500g' in v_definition) > 0
     or position('Olimp Glutamine Xplode 500g' in v_definition) > 0
     or position('Olimp EAA Xplode 520g' in v_definition) > 0 then
    raise exception 'reviewed-parent policy anchor/state mismatch';
  end if;
  execute replace(v_definition, v_anchor, v_replacement);
end
$reviewed_parent_policy$;

create or replace function public.atomic_import_predators_v3_parent_variant_transport_allowed(
  p_plan jsonb,
  p_retailer_actual jsonb
) returns boolean
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $function$
  with allowed(
    product_name, product_slug, size_value,
    external_product_id, external_variant_id, external_sku, external_gtin,
    flavour, flavour_code, display_name, variant_key, source_url, image, price
  ) as (
    values
      ('Olimp BCAA Xplode 500g','olimp-bcaa-xplode-500g','500',
       '8594181603360','8594181603369','5901330039614','05901330039614',
       'Fruit Punch','fruit punch','Fruit Punch / 500g','fruit-punch-500g',
       'https://predatorsgear.co.uk/supplements-vitamins-shop/olimp-bcaa-xplode-powder-branched-chain-amino-acids-glutamine-vitamin-b6-leucine-1000g-500g-280g/',
       'https://predatorsgear.co.uk/wp-content/uploads/2021/06/Olimp-BCAA-Xplode-500g-predatorsgear.co_.u.jpg','34.99'),
      ('Olimp BCAA Xplode 500g','olimp-bcaa-xplode-500g','500',
       '8594181603360','8594181607205','5901330022739','05901330022739',
       'Orange','orange','Orange / 500g','orange-500g',
       'https://predatorsgear.co.uk/supplements-vitamins-shop/olimp-bcaa-xplode-powder-branched-chain-amino-acids-glutamine-vitamin-b6-leucine-1000g-500g-280g/',
       'https://predatorsgear.co.uk/wp-content/uploads/2021/06/Olimp-BCAA-Xplode-500g-predatorsgear.co_.u.jpg','34.99'),
      ('Olimp Glutamine Xplode 500g','olimp-glutamine-xplode-500g','500',
       '8594181603396','8594181603399','5901330024139','05901330024139',
       'Lemon','lemon','Lemon / 500g','lemon-500g',
       'https://predatorsgear.co.uk/supplements-vitamins-shop/olimp-glutamine-xplode-powder-500g/',
       'https://predatorsgear.co.uk/wp-content/uploads/2021/06/Olimp-Glutamine-xplode-powder-500g-predatorsgear.co_.uk_.jpg','34.99'),
      ('Olimp Glutamine Xplode 500g','olimp-glutamine-xplode-500g','500',
       '8594181603396','8594181603400','5901330024122','05901330024122',
       'Orange','orange','Orange / 500g','orange-500g',
       'https://predatorsgear.co.uk/supplements-vitamins-shop/olimp-glutamine-xplode-powder-500g/',
       'https://predatorsgear.co.uk/wp-content/uploads/2021/06/Olimp-Glutamine-xplode-powder-500g-predatorsgear.co_.uk_.jpg','34.99'),
      ('Olimp Glutamine Xplode 500g','olimp-glutamine-xplode-500g','500',
       '8594181603396','8594181607759','5901330024146','05901330024146',
       'Pineapple','pineapple','Pineapple / 500g','pineapple-500g',
       'https://predatorsgear.co.uk/supplements-vitamins-shop/olimp-glutamine-xplode-powder-500g/',
       'https://predatorsgear.co.uk/wp-content/uploads/2021/06/Olimp-Glutamine-xplode-powder-500g-predatorsgear.co_.uk_.jpg','34.99'),
      ('Olimp EAA Xplode 520g','olimp-eaa-xplode-520g','520',
       '8594181603390','8594181605030','5901330062872','05901330062872',
       'Orange','orange','Orange / 520g','orange-520g',
       'https://predatorsgear.co.uk/supplements-vitamins-shop/eaa-amino/',
       'https://predatorsgear.co.uk/wp-content/uploads/2021/06/Olimp-eaa-xplode-powder-520g-predatorsgear.co_.uk_.jpg','34.99')
  )
  select
    p_retailer_actual = jsonb_build_object(
      'id','13','name','Predators Gear','slug','predators-gear','website','https://predatorsgear.co.uk/'
    )
    and p_plan#>>'{retailer,id}' = '13'
    and p_plan#>>'{retailer,action}' = 'existing'
    and p_plan#>>'{product,action}' = 'create_or_reuse_reviewed'
    and p_plan#>>'{product_variant,action}' = 'create_reviewed_variant'
    and p_plan#>>'{product,values,brand}' = 'Olimp'
    and p_plan#>>'{product,values,category}' = 'Amino Acids'
    and p_plan#>>'{product,values,product_format}' = 'powder'
    and jsonb_typeof(p_plan#>'{product,values,gtin}') = 'null'
    and p_plan#>>'{retailer_product,action}' = 'create'
    and p_plan#>>'{offer,action}' = 'create'
    and p_plan#>>'{price_history,action}' = 'create'
    and exists (
      select 1 from allowed a
      where p_plan#>>'{product,values,name}' = a.product_name
        and p_plan#>>'{product,values,slug}' = a.product_slug
        and p_plan#>>'{product,values,image}' = a.image
        and p_plan#>>'{product_variant,values,size_value}' = a.size_value
        and p_plan#>>'{product_variant,values,size_unit}' = 'g'
        and p_plan#>>'{product_variant,values,pack_count}' = '1'
        and p_plan#>>'{product_variant,values,product_format}' = 'powder'
        and p_plan#>>'{product_variant,values,flavour_label}' = a.flavour
        and p_plan#>>'{product_variant,values,flavour_code}' = a.flavour_code
        and p_plan#>>'{product_variant,values,display_name}' = a.display_name
        and p_plan#>>'{product_variant,values,variant_key}' = a.variant_key
        and p_plan#>>'{product_variant,evidence,flavour}' = a.flavour_code
        and p_plan#>>'{product_variant,evidence,size_value}' = a.size_value
        and p_plan#>>'{product_variant,evidence,size_unit}' = 'g'
        and p_plan#>>'{product_variant,evidence,pack_count}' = '1'
        and p_plan#>>'{product_variant,evidence,external_options,Flavour}' = a.flavour
        and p_plan#>>'{retailer_product,values,external_product_id}' = a.external_product_id
        and p_plan#>>'{retailer_product,values,external_variant_id}' = a.external_variant_id
        and p_plan#>>'{retailer_product,values,external_sku}' = a.external_sku
        and p_plan#>>'{retailer_product,values,external_gtin}' = a.external_gtin
        and p_plan#>>'{retailer_product,values,external_options,Flavour}' = a.flavour
        and p_plan#>>'{retailer_product,values,external_url}' = a.source_url
        and p_plan#>>'{offer,values,url}' = a.source_url
        and p_plan#>>'{offer,values,price}' = a.price
        and p_plan#>>'{offer,values,shipping_cost}' = '0'
        and p_plan#>>'{offer,values,total_price}' = a.price
        and p_plan#>'{offer,values,in_stock}' = 'true'::jsonb
    )
$function$;

do $validator_transport_policy$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure
  );
  v_anchor text := 'elsif v_retailer_id = 13';
  v_replacement text := $exact$elsif public.atomic_import_predators_v3_parent_variant_transport_allowed(
    p_plan,
    v_retailer_actual
  )
    or v_retailer_id = 13$exact$;
begin
  if (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor) <> 1
     or position('atomic_import_predators_v3_parent_variant_transport_allowed' in v_definition) > 0 then
    raise exception 'reviewed parent retailer transport guard anchor/state mismatch';
  end if;
  execute replace(v_definition, v_anchor, v_replacement);
end
$validator_transport_policy$;

alter function public.atomic_import_safe_create_category_allowed(text,text,text) owner to postgres;
alter function public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text) owner to postgres;
alter function public.atomic_import_predators_v3_parent_variant_transport_allowed(jsonb,jsonb) owner to postgres;
alter function public.atomic_import_validate_pre_source_metadata_plan_core(jsonb) owner to postgres;

revoke all on function public.atomic_import_predators_v3_parent_variant_transport_allowed(jsonb,jsonb)
  from public, anon, authenticated, service_role;

do $postflight$
begin
  if not public.atomic_import_safe_create_category_allowed(
       'Pre Workout','Olimp AAKG 1250 Extreme Mega Caps 120 Capsules','capsule'
     )
     or public.atomic_import_safe_create_category_allowed(
       'Pre Workout','Olimp AAKG 1250 Extreme Mega Caps 60 Capsules','capsule'
     )
     or public.atomic_import_safe_create_category_allowed(
       'Pre Workout','Olimp AAKG 1250 Extreme Mega Caps 120 Capsules','powder'
     )
     or not public.atomic_import_reviewed_parent_variant_allowed(
       'Olimp BCAA Xplode 500g','Olimp','Amino Acids','powder','500','g'
     )
     or not public.atomic_import_reviewed_parent_variant_allowed(
       'Olimp Glutamine Xplode 500g','Olimp','Amino Acids','powder','500','g'
     )
     or not public.atomic_import_reviewed_parent_variant_allowed(
       'Olimp EAA Xplode 520g','Olimp','Amino Acids','powder','520','g'
     )
     or public.atomic_import_reviewed_parent_variant_allowed(
       'Olimp BCAA Xplode 1000g','Olimp','Amino Acids','powder','1000','g'
     )
     or position(
       'atomic_import_predators_v3_parent_variant_transport_allowed',
       pg_get_functiondef('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure)
     ) = 0
     or has_function_privilege(
       'service_role',
       'public.atomic_import_predators_v3_parent_variant_transport_allowed(jsonb,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'Predators Gear reviewed-new-products-v3 policy verification failed';
  end if;
end
$postflight$;

commit;
