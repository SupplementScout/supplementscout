begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Policy only: permit exactly the eight owner-reviewed 10 Reps v10 product anchors.
do $preflight$
begin
  if to_regprocedure('public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)') is null
     or to_regprocedure('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)') is null
     or to_regprocedure('public.atomic_import_10reps_v9_parent_variant_transport_allowed(jsonb,jsonb)') is null then
    raise exception '10 Reps v10 importer policy prerequisites are missing';
  end if;
end
$preflight$;

do $reviewed_parent_policy$
declare
  v_definition text := pg_get_functiondef('public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)'::regprocedure);
  v_anchor text := '(''Darkstims Electrolytes Advanced Hydration Formula 195g'',''Dark Stims'',''Electrolytes'',''powder'',''195'',''g'')';
  v_replacement text := v_anchor || $exact$,
      ('Warrior EAA Essential Amino Acids 360g','Warrior','Amino Acids','powder','360','g'),
      ('NXT Nutrition Beef Protein Isolate 540g','NXT Nutrition','Protein Powder','powder','540','g'),
      ('NXT Nutrition Pure Whey ISO Juice 900g','NXT Nutrition','Whey Protein','powder','900','g'),
      ('Applied Nutrition L-Carnitine 3000 Liquid 480ml','Applied Nutrition','Weight Management','liquid','480','ml'),
      ('NXT Nutrition TNT Nuclear Pump Stim-Free 500g','NXT Nutrition','Pre Workout','powder','500','g'),
      ('Pharma Grade EAA 390g','Pharma Grade','Amino Acids','powder','390','g'),
      ('Refined Nutrition Ultra Hydration 300g','Refined Nutrition','Electrolytes','powder','300','g'),
      ('Darkstims Pre V4 Pre-Workout 500g','Dark Stims','Pre Workout','powder','500','g')$exact$;
begin
  if (length(v_definition)-length(replace(v_definition,v_anchor,'')))/length(v_anchor) <> 1
     or position('Warrior EAA Essential Amino Acids 360g' in v_definition) > 0 then
    raise exception '10 Reps v10 reviewed-parent policy anchor/state mismatch';
  end if;
  execute replace(v_definition,v_anchor,v_replacement);
end
$reviewed_parent_policy$;

create or replace function public.atomic_import_10reps_v10_parent_variant_transport_allowed(p_plan jsonb,p_retailer_actual jsonb)
returns boolean language sql immutable set search_path=pg_catalog,public,pg_temp as $function$
  with allowed(fingerprint,product_name,product_slug,brand,category,product_format,size_value,size_unit,external_product_id,external_variant_id,external_sku,external_options,flavour,flavour_code,variant_key,source_url,image,price,total_price) as (
    values
      ('afb4c93d5874c24aa5ce864a2d0b8607','Warrior EAA Essential Amino Acids 360g','warrior-eaa-essential-amino-acids-360g','Warrior','Amino Acids','powder','360','g','3815','8050',null,'{"Flavour":"Blue Raspberry"}','Blue Raspberry','blue raspberry','blue-raspberry-360g','https://www.10reps.co.uk/product/warrior-eaa/?attribute_flavours=Blue%20Raspberry','https://www.10reps.co.uk/wp-content/uploads/2026/02/warrior-eaa-strawberry-blue-raspberry.png','16.99','20.98'),
      ('6a9641d0280358c6ede09e51e4525273','NXT Nutrition Beef Protein Isolate 540g','nxt-nutrition-beef-protein-isolate-540g','NXT Nutrition','Protein Powder','powder','540','g','6092','9668','NXT213','{"Flavour":"Pear Drops","Size":"540g"}','Pear Drops','pear drops','pear-drops-540g','https://www.10reps.co.uk/product/nxt-nutrition-beef-protein-isolate-540g/?attribute_flavours=Pear%20Drops','https://www.10reps.co.uk/wp-content/uploads/2025/12/nxt-beef-protein-isolate-.png','21.49','25.48'),
      ('a8c31831db41c150be0259232b2d0ffd','NXT Nutrition Pure Whey ISO Juice 900g','nxt-nutrition-pure-whey-iso-juice-900g','NXT Nutrition','Whey Protein','powder','900','g','6100','7695','NXT132','{"Flavour":"Blue Raspberry Smoothie","Size":"900g"}','Blue Raspberry Smoothie','blue raspberry smoothie','blue-raspberry-smoothie-900g','https://www.10reps.co.uk/product/nxt-nutrition-pure-whey-iso-juice-900g/?attribute_flavours=Blue%20Raspberry%20Smoothie','https://www.10reps.co.uk/wp-content/uploads/2025/12/nxt-whey-iso-juice-.png','35.99','39.98'),
      ('594643ac3fc0b9143c34d89ab7487dc3','Applied Nutrition L-Carnitine 3000 Liquid 480ml','applied-nutrition-l-carnitine-3000-liquid-480ml','Applied Nutrition','Weight Management','liquid','480','ml','9486','9488','APP658','{"Flavour":"Blue Raspberry Slush Puppie","Size":"480ml"}','Blue Raspberry Slush Puppie','blue raspberry slush puppie','blue-raspberry-slush-puppie-480ml','https://www.10reps.co.uk/product/applied-nutrition-l-carnitine-3000/?attribute_flavours=Blue%20Raspberry%20Slush%20Puppie','https://www.10reps.co.uk/wp-content/uploads/2026/05/Applied-Nutrition-L-Carnitine-3000-blu-raz-slush.webp','17.99','21.98'),
      ('b8d56f29e7109d6df62a3bbc8c745f22','NXT Nutrition TNT Nuclear Pump Stim-Free 500g','nxt-nutrition-tnt-nuclear-pump-stim-free-500g','NXT Nutrition','Pre Workout','powder','500','g','9670','9671','NXT220','{"Flavour":"Blue Raspberry","Size":"500g"}','Blue Raspberry','blue raspberry','blue-raspberry-500g','https://www.10reps.co.uk/product/nxt-pump-500g/?attribute_flavours=Blue%20Raspberry','https://www.10reps.co.uk/wp-content/uploads/2026/05/NXT-Nutrition-TNT-Nuclear-PUMP.webp','21.49','25.48'),
      ('c18a5b01f290ddcd8364682beb1a68df','Pharma Grade EAA 390g','pharma-grade-eaa-390g','Pharma Grade','Amino Acids','powder','390','g','10115','10117','GRA017','{"Flavour":"Blue Raspberry","Size":"390g"}','Blue Raspberry','blue raspberry','blue-raspberry-390g','https://www.10reps.co.uk/product/pharma-grade-eaa/?attribute_flavours=Blue%20Raspberry','https://www.10reps.co.uk/wp-content/uploads/2026/06/Pharma-Grade-EAA-390g.webp','15.99','19.98'),
      ('cf57de6f6f12d1bf3dc7838e3bfecb51','Refined Nutrition Ultra Hydration 300g','refined-nutrition-ultra-hydration-300g','Refined Nutrition','Electrolytes','powder','300','g','10392','10394','RNU154','{"Flavour":"American Grape","Size":"300g"}','American Grape','american grape','american-grape-300g','https://www.10reps.co.uk/product/refined-nutrition-ultra-hydration-300g/?attribute_flavours=American%20Grape','https://www.10reps.co.uk/wp-content/uploads/2026/06/RefinedNutritionUltraHydrtion300g-AmericanGrape.webp','15.99','19.98'),
      ('9bce2f76fd2e7ee920c765a1fd9b3d03','Darkstims Pre V4 Pre-Workout 500g','darkstims-pre-v4-pre-workout-500g','Dark Stims','Pre Workout','powder','500','g','11134','11136','DRK016','{"Flavour":"Bubblegum","Size":"500g"}','Bubblegum','bubblegum','bubblegum-500g','https://www.10reps.co.uk/product/darkstims-pre-v4-pre-workout-500g/?attribute_flavours=Bubblegum','https://www.10reps.co.uk/wp-content/uploads/2026/08/PRE-BUBBLEGUM.webp','27.49','31.48')
  )
  select p_retailer_actual=jsonb_build_object('id','14','name','10 Reps','slug','10-reps','website','https://www.10reps.co.uk/')
    and p_plan#>>'{retailer,id}'='14' and p_plan#>>'{retailer,action}'='existing'
    and p_plan#>>'{product,action}'='create_or_reuse_reviewed'
    and p_plan#>>'{product_variant,action}'='create_reviewed_variant'
    and p_plan#>'{product,values,gtin}'='null'::jsonb
    and p_plan#>>'{retailer_product,action}'='create' and p_plan#>>'{offer,action}'='create' and p_plan#>>'{price_history,action}'='create'
    and exists(select 1 from allowed a where
      p_plan#>>'{meta,plan_fingerprint}'=a.fingerprint
      and p_plan#>>'{product,values,name}'=a.product_name and p_plan#>>'{product,values,slug}'=a.product_slug
      and p_plan#>>'{product,values,brand}'=a.brand and p_plan#>>'{product,values,category}'=a.category
      and p_plan#>>'{product,values,product_format}'=a.product_format and p_plan#>>'{product,values,image}'=a.image
      and p_plan#>>'{product_variant,values,size_value}'=a.size_value and p_plan#>>'{product_variant,values,size_unit}'=a.size_unit
      and p_plan#>>'{product_variant,values,pack_count}'='1' and p_plan#>>'{product_variant,values,product_format}'=a.product_format
      and p_plan#>>'{product_variant,values,flavour_label}'=a.flavour and p_plan#>>'{product_variant,values,flavour_code}'=a.flavour_code
      and p_plan#>>'{product_variant,values,display_name}'=a.flavour and p_plan#>>'{product_variant,values,variant_key}'=a.variant_key
      and p_plan#>>'{product_variant,evidence,flavour}'=a.flavour_code and p_plan#>>'{product_variant,evidence,size_value}'=a.size_value
      and p_plan#>>'{product_variant,evidence,size_unit}'=a.size_unit and p_plan#>>'{product_variant,evidence,pack_count}'='1'
      and p_plan#>'{product_variant,evidence,external_options}'=a.external_options::jsonb
      and p_plan#>>'{retailer_product,values,external_product_id}'=a.external_product_id
      and p_plan#>>'{retailer_product,values,external_variant_id}'=a.external_variant_id
      and p_plan#>>'{retailer_product,values,external_sku}' is not distinct from a.external_sku
      and p_plan#>'{retailer_product,values,external_gtin}'='null'::jsonb
      and p_plan#>'{retailer_product,values,external_options}'=a.external_options::jsonb
      and p_plan#>>'{retailer_product,values,external_url}'=a.source_url and p_plan#>>'{offer,values,url}'=a.source_url
      and p_plan#>>'{offer,values,price}'=a.price and p_plan#>>'{offer,values,shipping_cost}'='3.99'
      and p_plan#>>'{offer,values,total_price}'=a.total_price and p_plan#>'{offer,values,in_stock}'='true'::jsonb)
$function$;

do $validator_transport_policy$
declare
  v_definition text := pg_get_functiondef('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure);
  v_old text := $old$elsif public.atomic_import_10reps_v9_parent_variant_transport_allowed(
    p_plan,
    v_retailer_actual
  )$old$;
  v_new text := $new$elsif public.atomic_import_10reps_v10_parent_variant_transport_allowed(
    p_plan,
    v_retailer_actual
  )
    or public.atomic_import_10reps_v9_parent_variant_transport_allowed(
      p_plan,
      v_retailer_actual
    )$new$;
begin
  if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1
     or position('atomic_import_10reps_v10_parent_variant_transport_allowed' in v_definition)>0 then
    raise exception '10 Reps v10 transport policy anchor/state mismatch';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$validator_transport_policy$;

alter function public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text) owner to postgres;
alter function public.atomic_import_10reps_v10_parent_variant_transport_allowed(jsonb,jsonb) owner to postgres;
alter function public.atomic_import_validate_pre_source_metadata_plan_core(jsonb) owner to postgres;
revoke all on function public.atomic_import_10reps_v10_parent_variant_transport_allowed(jsonb,jsonb) from public,anon,authenticated,service_role;

do $postflight$
begin
  if not public.atomic_import_reviewed_parent_variant_allowed('Warrior EAA Essential Amino Acids 360g','Warrior','Amino Acids','powder','360','g')
     or not public.atomic_import_reviewed_parent_variant_allowed('Applied Nutrition L-Carnitine 3000 Liquid 480ml','Applied Nutrition','Weight Management','liquid','480','ml')
     or public.atomic_import_reviewed_parent_variant_allowed('Warrior EAA Essential Amino Acids 500g','Warrior','Amino Acids','powder','500','g')
     or has_function_privilege('service_role','public.atomic_import_10reps_v10_parent_variant_transport_allowed(jsonb,jsonb)','EXECUTE') then
    raise exception '10 Reps v10 policy verification failed';
  end if;
end
$postflight$;

commit;
