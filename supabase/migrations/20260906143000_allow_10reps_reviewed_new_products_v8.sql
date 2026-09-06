begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Policy only: this migration does not mutate catalogue or offer rows.
do $preflight$
begin
  if to_regprocedure('public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)') is null
     or to_regprocedure('public.atomic_import_predators_v3_parent_variant_transport_allowed(jsonb,jsonb)') is null
     or to_regprocedure('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)') is null then
    raise exception '10 Reps reviewed-new-products-v8 importer policy prerequisites are missing';
  end if;
end
$preflight$;

do $reviewed_parent_policy$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)'::regprocedure
  );
  v_anchor text := '(''Olimp EAA Xplode 520g'',''Olimp'',''Amino Acids'',''powder'',''520'',''g'')';
  v_replacement text := v_anchor || $exact$,
      ('Chaos Crew Whey Protein Powder 720g','Chaos Crew','Whey Protein','powder','720','g'),
      ('AK-47 Labs Pre-Workout 240g','AK - 47','Pre Workout','powder','240','g'),
      ('Efectiv Whey – Advanced Protein Complex 900g','Efectiv','Whey Protein','powder','900','g')$exact$;
begin
  if (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor) <> 1
     or position('Chaos Crew Whey Protein Powder 720g' in v_definition) > 0
     or position('AK-47 Labs Pre-Workout 240g' in v_definition) > 0
     or position('Efectiv Whey – Advanced Protein Complex 900g' in v_definition) > 0 then
    raise exception '10 Reps reviewed-parent policy anchor/state mismatch';
  end if;
  execute replace(v_definition, v_anchor, v_replacement);
end
$reviewed_parent_policy$;

create or replace function public.atomic_import_10reps_v8_parent_variant_transport_allowed(
  p_plan jsonb,
  p_retailer_actual jsonb
) returns boolean
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $function$
  with allowed(
    product_name, product_slug, brand, category, size_value,
    external_product_id, external_variant_id, external_sku,
    flavour, flavour_code, display_name, variant_key,
    source_url, image, price, total_price
  ) as (
    values
      ('Chaos Crew Whey Protein Powder 720g','chaos-crew-whey-protein-powder-720g','Chaos Crew','Whey Protein','720',
       '469','3840',null,
       'Vanilla Ice Cream','vanilla ice cream','Vanilla Ice Cream','vanilla-ice-cream-720g',
       'https://www.10reps.co.uk/product/chaos-crew-whey-protein-powder-720g/?attribute_flavour=Vanilla%20Ice%20Cream',
       'https://www.10reps.co.uk/wp-content/uploads/2024/11/chaos-crew-vanilla.png','24.99','28.98'),
      ('AK-47 Labs Pre-Workout 240g','ak-47-labs-pre-workout-240g','AK - 47','Pre Workout','240',
       '530','8099','AKL038',
       'Cotton Candy','cotton candy','Cotton Candy','cotton-candy-240g',
       'https://www.10reps.co.uk/product/ak-47-labs-pre-workout-240g/?attribute_flavours=Cotton%20Candy',
       'https://www.10reps.co.uk/wp-content/uploads/2024/11/AK-47-Labs-Pre-Workout-240g.png','20.99','24.98'),
      ('Efectiv Whey – Advanced Protein Complex 900g','efectiv-whey-advanced-protein-complex-900g','Efectiv','Whey Protein','900',
       '554','559',null,
       'Banana Crème','banana crème','Banana Crème','banana-cr-me-900g',
       'https://www.10reps.co.uk/product/efectiv-whey-advanced-protein-complex-900g/?attribute_flavours=Banana%20Cr%C3%A8me',
       'https://www.10reps.co.uk/wp-content/uploads/2024/11/Efectiv-Whey-–-Advanced-Protein-Complex-banana-cream.png','29.99','33.98')
  )
  select
    p_retailer_actual = jsonb_build_object(
      'id','14','name','10 Reps','slug','10-reps','website','https://www.10reps.co.uk/'
    )
    and p_plan#>>'{retailer,id}' = '14'
    and p_plan#>>'{retailer,action}' = 'existing'
    and p_plan#>>'{product,action}' = 'create_or_reuse_reviewed'
    and p_plan#>>'{product_variant,action}' = 'create_reviewed_variant'
    and p_plan#>>'{product,values,product_format}' = 'powder'
    and jsonb_typeof(p_plan#>'{product,values,gtin}') = 'null'
    and p_plan#>>'{retailer_product,action}' = 'create'
    and p_plan#>>'{offer,action}' = 'create'
    and p_plan#>>'{price_history,action}' = 'create'
    and exists (
      select 1 from allowed a
      where p_plan#>>'{product,values,name}' = a.product_name
        and p_plan#>>'{product,values,slug}' = a.product_slug
        and p_plan#>>'{product,values,brand}' = a.brand
        and p_plan#>>'{product,values,category}' = a.category
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
        and p_plan#>>'{product_variant,evidence,external_options,Size}' = a.size_value || 'g'
        and p_plan#>>'{retailer_product,values,external_product_id}' = a.external_product_id
        and p_plan#>>'{retailer_product,values,external_variant_id}' = a.external_variant_id
        and case when a.external_sku is null
          then p_plan#>'{retailer_product,values,external_sku}' = 'null'::jsonb
          else p_plan#>>'{retailer_product,values,external_sku}' = a.external_sku
        end
        and p_plan#>'{retailer_product,values,external_gtin}' = 'null'::jsonb
        and p_plan#>>'{retailer_product,values,external_options,Flavour}' = a.flavour
        and p_plan#>>'{retailer_product,values,external_options,Size}' = a.size_value || 'g'
        and p_plan#>>'{retailer_product,values,external_url}' = a.source_url
        and p_plan#>>'{offer,values,url}' = a.source_url
        and p_plan#>>'{offer,values,price}' = a.price
        and p_plan#>>'{offer,values,shipping_cost}' = '3.99'
        and p_plan#>>'{offer,values,total_price}' = a.total_price
        and p_plan#>'{offer,values,in_stock}' = 'true'::jsonb
    )
$function$;

do $validator_transport_policy$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure
  );
  v_anchor text := $exact$elsif public.atomic_import_predators_v3_parent_variant_transport_allowed(
    p_plan,
    v_retailer_actual
  )
    or v_retailer_id = 13$exact$;
  v_replacement text := $exact$elsif public.atomic_import_10reps_v8_parent_variant_transport_allowed(
    p_plan,
    v_retailer_actual
  )
    or public.atomic_import_predators_v3_parent_variant_transport_allowed(
    p_plan,
    v_retailer_actual
  )
    or v_retailer_id = 13$exact$;
begin
  if (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor) <> 1
     or position('atomic_import_10reps_v8_parent_variant_transport_allowed' in v_definition) > 0 then
    raise exception '10 Reps reviewed parent transport guard anchor/state mismatch';
  end if;
  execute replace(v_definition, v_anchor, v_replacement);
end
$validator_transport_policy$;

alter function public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text) owner to postgres;
alter function public.atomic_import_10reps_v8_parent_variant_transport_allowed(jsonb,jsonb) owner to postgres;
alter function public.atomic_import_validate_pre_source_metadata_plan_core(jsonb) owner to postgres;

revoke all on function public.atomic_import_10reps_v8_parent_variant_transport_allowed(jsonb,jsonb)
  from public, anon, authenticated, service_role;

do $postflight$
begin
  if not public.atomic_import_reviewed_parent_variant_allowed(
       'Chaos Crew Whey Protein Powder 720g','Chaos Crew','Whey Protein','powder','720','g'
     )
     or not public.atomic_import_reviewed_parent_variant_allowed(
       'AK-47 Labs Pre-Workout 240g','AK - 47','Pre Workout','powder','240','g'
     )
     or not public.atomic_import_reviewed_parent_variant_allowed(
       'Efectiv Whey – Advanced Protein Complex 900g','Efectiv','Whey Protein','powder','900','g'
     )
     or public.atomic_import_reviewed_parent_variant_allowed(
       'Chaos Crew Whey Protein Powder 900g','Chaos Crew','Whey Protein','powder','900','g'
     )
     or has_function_privilege(
       'service_role',
       'public.atomic_import_10reps_v8_parent_variant_transport_allowed(jsonb,jsonb)',
       'EXECUTE'
     ) then
    raise exception '10 Reps reviewed-new-products-v8 policy verification failed';
  end if;
end
$postflight$;

commit;
