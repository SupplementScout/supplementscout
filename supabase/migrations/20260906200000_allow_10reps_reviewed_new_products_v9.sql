begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Policy only: permit exactly the seven owner-reviewed 10 Reps v9 product anchors.
do $preflight$
begin
  if to_regprocedure('public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)') is null
     or to_regprocedure('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)') is null
     or to_regprocedure('public.atomic_import_10reps_v8_parent_variant_transport_allowed(jsonb,jsonb)') is null then
    raise exception '10 Reps reviewed-new-products-v9 importer policy prerequisites are missing';
  end if;
end
$preflight$;

do $reviewed_parent_policy$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)'::regprocedure
  );
  v_anchor text := '(''AK-47 Labs Pre-Workout 240g'',''AK - 47'',''Pre Workout'',''powder'',''240'',''g'')';
  v_replacement text := v_anchor || $exact$,
      ('NXT Nutrition Pure Whey Deluxe 510g','NXT Nutrition','Whey Protein','powder','510','g'),
      ('NXT Nutrition Pure Whey Deluxe 2.1kg','NXT Nutrition','Whey Protein','powder','2100','g'),
      ('Cellucor C4 Original Pre-Workout Powder 30 Servings','Cellucor','Pre Workout','powder','30','servings'),
      ('Per4m Isolate Zero 2kg','Per4m','Whey Protein','powder','2000','g'),
      ('Cellucor C4 Original Pre-Workout Powder 60 Servings','Cellucor','Pre Workout','powder','60','servings'),
      ('Per4m Advanced Protein 800g','Per4m','Protein Powder','powder','800','g'),
      ('Darkstims Electrolytes Advanced Hydration Formula 195g','Dark Stims','Electrolytes','powder','195','g')$exact$;
begin
  if (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor) <> 1
     or position('NXT Nutrition Pure Whey Deluxe 510g' in v_definition) > 0 then
    raise exception '10 Reps v9 reviewed-parent policy anchor/state mismatch';
  end if;
  execute replace(v_definition, v_anchor, v_replacement);
end
$reviewed_parent_policy$;

create or replace function public.atomic_import_10reps_v9_parent_variant_transport_allowed(
  p_plan jsonb,
  p_retailer_actual jsonb
) returns boolean
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $function$
  with allowed(
    fingerprint,product_name,product_slug,brand,category,size_value,size_unit,
    external_product_id,external_variant_id,external_sku,source_size,
    flavour,flavour_code,variant_key,source_url,image,price,total_price
  ) as (
    values
      ('b685b77f476a0105f3a0a1c833780002','NXT Nutrition Pure Whey Deluxe 510g','nxt-nutrition-pure-whey-deluxe-510g','NXT Nutrition','Whey Protein','510','g','2673','10130','NXT114','510g','Brilliantly Biscuity','brilliantly biscuity','brilliantly-biscuity-510g','https://www.10reps.co.uk/product/nxt-nutrition-pure-whey-deluxe-510g/?attribute_flavours=Brilliantly%20Biscuity','https://www.10reps.co.uk/wp-content/uploads/2025/04/nxt-whey-powder-deluxe.png','20.49','24.48'),
      ('ed4cc5be1cdf7e1b90b5ba58f0586e40','NXT Nutrition Pure Whey Deluxe 2.1kg','nxt-nutrition-pure-whey-deluxe-2-1kg','NXT Nutrition','Whey Protein','2100','g','1370','7682','NXT099','2.1kg','Chocolate Orange','chocolate orange','chocolate-orange-2100g','https://www.10reps.co.uk/product/nxt-nutrition-pure-whey/?attribute_flavours=Chocolate%20Orange','https://www.10reps.co.uk/wp-content/uploads/2025/01/nxt-nutrition-pure-whey-protein-deluxe-min.png','52.99','56.98'),
      ('b776aebf391f80326e8cde1fea43ea26','Cellucor C4 Original Pre-Workout Powder 30 Servings','cellucor-c4-original-pre-workout-30-servings','Cellucor','Pre Workout','30','servings','8736','8739','CEL005','30 Servings','Cherry Limeade','cherry limeade','cherry-limeade-30servings','https://www.10reps.co.uk/product/cellucor-c4-original-pre-workout-powder-30-servings/?attribute_flavours=Cherry%20Limeade','https://www.10reps.co.uk/wp-content/uploads/2026/03/Cellucor-C4-Original-30-Servings.webp','20.49','24.48'),
      ('5f00835130146ca94725eeb4da9a3405','Per4m Isolate Zero 2kg','per4m-isolate-zero-2kg','Per4m','Whey Protein','2000','g','8983','8985','PER287','2kg','Baklava','baklava','baklava-2000g','https://www.10reps.co.uk/product/per4m-isolate-zero-2kg/?attribute_flavours=Baklava','https://www.10reps.co.uk/wp-content/uploads/2026/04/per4m-baklava-2kg.webp','75.49','79.48'),
      ('2876f86904bbc4b401b2e95669210860','Cellucor C4 Original Pre-Workout Powder 60 Servings','cellucor-c4-original-pre-workout-60-servings','Cellucor','Pre Workout','60','servings','8752','8756','CEL055','60 Servings','Cosmic Rainbow','cosmic rainbow','cosmic-rainbow-60servings','https://www.10reps.co.uk/product/c4-original-pre-workout-powder-60/?attribute_flavours=Cosmic%20Rainbow','https://www.10reps.co.uk/wp-content/uploads/2026/03/Cellucor-C4-Original-60-Servings.webp','31.49','35.48'),
      ('15bbbd2ebaa12f8201f59ab8f90d8d2c','Per4m Advanced Protein 800g','per4m-advanced-protein-800g','Per4m','Protein Powder','800','g','11169','11171','PER449','800g','Caramel Biscuit','caramel biscuit','caramel-biscuit-800g','https://www.10reps.co.uk/product/per4m-advanced-protein-800g/?attribute_flavours=Caramel%20Biscuit','https://www.10reps.co.uk/wp-content/uploads/2026/08/per4m-protein-advanced-blend-800g-caramel-biscuit.webp','28.99','32.98'),
      ('928153e3c6ca5971a8ae2122dfa66bf8','Darkstims Electrolytes Advanced Hydration Formula 195g','darkstims-electrolytes-advanced-hydration-formula-195g','Dark Stims','Electrolytes','195','g','11100','11102','DRK003','195g','Cherry','cherry','cherry-195g','https://www.10reps.co.uk/product/darkstims-electrolytes-advanced-hydration-formula-195g/?attribute_flavours=Cherry','https://www.10reps.co.uk/wp-content/uploads/2026/08/dark-stims-electrolytes-1.png','15.49','19.48')
  )
  select p_retailer_actual = jsonb_build_object('id','14','name','10 Reps','slug','10-reps','website','https://www.10reps.co.uk/')
    and p_plan#>>'{retailer,id}' = '14'
    and p_plan#>>'{retailer,action}' = 'existing'
    and p_plan#>>'{product,action}' = 'create_or_reuse_reviewed'
    and p_plan#>>'{product_variant,action}' = 'create_reviewed_variant'
    and p_plan#>>'{product,values,product_format}' = 'powder'
    and p_plan#>'{product,values,gtin}' = 'null'::jsonb
    and p_plan#>>'{retailer_product,action}' = 'create'
    and p_plan#>>'{offer,action}' = 'create'
    and p_plan#>>'{price_history,action}' = 'create'
    and exists (
      select 1 from allowed a
      where p_plan#>>'{meta,plan_fingerprint}' = a.fingerprint
        and p_plan#>>'{product,values,name}' = a.product_name
        and p_plan#>>'{product,values,slug}' = a.product_slug
        and p_plan#>>'{product,values,brand}' = a.brand
        and p_plan#>>'{product,values,category}' = a.category
        and p_plan#>>'{product,values,image}' = a.image
        and p_plan#>>'{product_variant,values,size_value}' = a.size_value
        and p_plan#>>'{product_variant,values,size_unit}' = a.size_unit
        and p_plan#>>'{product_variant,values,pack_count}' = '1'
        and p_plan#>>'{product_variant,values,product_format}' = 'powder'
        and p_plan#>>'{product_variant,values,flavour_label}' = a.flavour
        and p_plan#>>'{product_variant,values,flavour_code}' = a.flavour_code
        and p_plan#>>'{product_variant,values,display_name}' = a.flavour
        and p_plan#>>'{product_variant,values,variant_key}' = a.variant_key
        and p_plan#>>'{product_variant,evidence,flavour}' = a.flavour_code
        and p_plan#>>'{product_variant,evidence,size_value}' = a.size_value
        and p_plan#>>'{product_variant,evidence,size_unit}' = a.size_unit
        and p_plan#>>'{product_variant,evidence,pack_count}' = '1'
        and p_plan#>>'{product_variant,evidence,external_options,Flavour}' = a.flavour
        and p_plan#>>'{product_variant,evidence,external_options,Size}' = a.source_size
        and p_plan#>>'{retailer_product,values,external_product_id}' = a.external_product_id
        and p_plan#>>'{retailer_product,values,external_variant_id}' = a.external_variant_id
        and p_plan#>>'{retailer_product,values,external_sku}' = a.external_sku
        and p_plan#>'{retailer_product,values,external_gtin}' = 'null'::jsonb
        and p_plan#>>'{retailer_product,values,external_options,Flavour}' = a.flavour
        and p_plan#>>'{retailer_product,values,external_options,Size}' = a.source_size
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
  v_definition text := pg_get_functiondef('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure);
  v_old text := $old$elsif public.atomic_import_10reps_v8_parent_variant_transport_allowed(
    p_plan,
    v_retailer_actual
  )$old$;
  v_new text := $new$elsif public.atomic_import_10reps_v9_parent_variant_transport_allowed(
    p_plan,
    v_retailer_actual
  )
    or public.atomic_import_10reps_v8_parent_variant_transport_allowed(
    p_plan,
    v_retailer_actual
  )$new$;
begin
  if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1
     or position('atomic_import_10reps_v9_parent_variant_transport_allowed' in v_definition) > 0 then
    raise exception '10 Reps v9 transport policy anchor/state mismatch';
  end if;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := $old$and not public.atomic_import_10reps_v8_parent_variant_transport_allowed(
      p_plan,
      jsonb_build_object(
        'id','14','name','10 Reps','slug','10-reps','website','https://www.10reps.co.uk/'
      )
    )$old$;
  v_new := $new$and not public.atomic_import_10reps_v8_parent_variant_transport_allowed(
      p_plan,
      jsonb_build_object(
        'id','14','name','10 Reps','slug','10-reps','website','https://www.10reps.co.uk/'
      )
    )
    and not public.atomic_import_10reps_v9_parent_variant_transport_allowed(
      p_plan,
      jsonb_build_object(
        'id','14','name','10 Reps','slug','10-reps','website','https://www.10reps.co.uk/'
      )
    )$new$;
  if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1 then
    raise exception '10 Reps v9 short source ID anchor mismatch';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$validator_transport_policy$;

alter function public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text) owner to postgres;
alter function public.atomic_import_10reps_v9_parent_variant_transport_allowed(jsonb,jsonb) owner to postgres;
alter function public.atomic_import_validate_pre_source_metadata_plan_core(jsonb) owner to postgres;

revoke all on function public.atomic_import_10reps_v9_parent_variant_transport_allowed(jsonb,jsonb)
  from public, anon, authenticated, service_role;

do $postflight$
begin
  if not public.atomic_import_reviewed_parent_variant_allowed('NXT Nutrition Pure Whey Deluxe 510g','NXT Nutrition','Whey Protein','powder','510','g')
     or not public.atomic_import_reviewed_parent_variant_allowed('Cellucor C4 Original Pre-Workout Powder 30 Servings','Cellucor','Pre Workout','powder','30','servings')
     or public.atomic_import_reviewed_parent_variant_allowed('NXT Nutrition Pure Whey Deluxe 900g','NXT Nutrition','Whey Protein','powder','900','g')
     or has_function_privilege('service_role','public.atomic_import_10reps_v9_parent_variant_transport_allowed(jsonb,jsonb)','EXECUTE') then
    raise exception '10 Reps reviewed-new-products-v9 policy verification failed';
  end if;
end
$postflight$;

commit;
