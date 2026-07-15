begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

lock table public.products, public.product_variants in share row exclusive mode;

do $seed_discount_supplements_batch_d$
declare
  v_products constant jsonb := $batch_d_products$
  [
    {"name":"Applied Nutrition Critical Whey 2kg","slug":"applied-nutrition-critical-whey-2kg","brand":"Applied Nutrition","category":"Whey Protein","net_weight_g":2000,"servings":null,"product_format":"powder","is_active":true,"identity_key":"appliednutritioncriticalwhey2kg"},
    {"name":"Applied Nutrition Creatine Monohydrate 250g","slug":"applied-nutrition-creatine-monohydrate-250g","brand":"Applied Nutrition","category":"Creatine","net_weight_g":250,"servings":50,"product_format":"powder","is_active":true,"identity_key":"appliednutritioncreatinemonohydrate250g"},
    {"name":"Efectiv Nutrition Grass-Fed Whey Protein Isolate 2kg","slug":"efectiv-nutrition-grass-fed-whey-protein-isolate-2kg","brand":"Efectiv Nutrition","category":"Whey Protein","net_weight_g":2000,"servings":66,"product_format":"powder","is_active":true,"identity_key":"efectivnutritiongrassfedwheyproteinisolate2kg"},
    {"name":"Applied Nutrition Pump 3G Zero Stim 375g","slug":"applied-nutrition-pump-3g-zero-stim-375g","brand":"Applied Nutrition","category":"Pre Workout","net_weight_g":375,"servings":25,"product_format":"powder","is_active":true,"identity_key":"appliednutritionpump3gzerostim375g"},
    {"name":"CNP Loaded EAA 300g","slug":"cnp-loaded-eaa-300g","brand":"CNP","category":"Amino Acids","net_weight_g":300,"servings":null,"product_format":"powder","is_active":true,"identity_key":"cnploadedeaa300g"},
    {"name":"XL Nutrition XTRA Whey 2kg","slug":"xl-nutrition-xtra-whey-2kg","brand":"XL Nutrition","category":"Whey Protein","net_weight_g":2000,"servings":66,"product_format":"powder","is_active":true,"identity_key":"xlnutritionxtrawhey2kg"}
  ]
  $batch_d_products$::jsonb;
  v_variants constant jsonb := $batch_d_variants$
  [
    {"product_slug":"applied-nutrition-critical-whey-2kg","variant_key":"default","display_name":"Default","flavour_code":null,"flavour_label":null,"size_value":null,"size_unit":null,"pack_count":null,"product_format":null,"is_default":true,"is_active":true},
    {"product_slug":"applied-nutrition-critical-whey-2kg","variant_key":"banana-2000g","display_name":"Banana / 2kg","flavour_code":"banana","flavour_label":"Banana","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"applied-nutrition-critical-whey-2kg","variant_key":"banana-strawberry-2000g","display_name":"Banana Strawberry / 2kg","flavour_code":"banana strawberry","flavour_label":"Banana Strawberry","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"applied-nutrition-critical-whey-2kg","variant_key":"caramel-latte-2000g","display_name":"Caramel Latte / 2kg","flavour_code":"caramel latte","flavour_label":"Caramel Latte","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"applied-nutrition-critical-whey-2kg","variant_key":"choco-hazelnut-2000g","display_name":"Choco Hazelnut / 2kg","flavour_code":"choco hazelnut","flavour_label":"Choco Hazelnut","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"applied-nutrition-critical-whey-2kg","variant_key":"chocolate-2000g","display_name":"Chocolate / 2kg","flavour_code":"chocolate","flavour_label":"Chocolate","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"applied-nutrition-critical-whey-2kg","variant_key":"cookies-and-cream-2000g","display_name":"Cookies & Cream / 2kg","flavour_code":"cookies and cream","flavour_label":"Cookies & Cream","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"applied-nutrition-critical-whey-2kg","variant_key":"frappuccino-2000g","display_name":"Frappuccino / 2kg","flavour_code":"frappuccino","flavour_label":"Frappuccino","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"applied-nutrition-critical-whey-2kg","variant_key":"salted-caramel-2000g","display_name":"Salted Caramel / 2kg","flavour_code":"salted caramel","flavour_label":"Salted Caramel","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"applied-nutrition-critical-whey-2kg","variant_key":"strawberry-2000g","display_name":"Strawberry / 2kg","flavour_code":"strawberry","flavour_label":"Strawberry","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"applied-nutrition-critical-whey-2kg","variant_key":"vanilla-2000g","display_name":"Vanilla / 2kg","flavour_code":"vanilla","flavour_label":"Vanilla","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"applied-nutrition-critical-whey-2kg","variant_key":"vanilla-matcha-2000g","display_name":"Vanilla Matcha / 2kg","flavour_code":"vanilla matcha","flavour_label":"Vanilla Matcha","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"applied-nutrition-critical-whey-2kg","variant_key":"white-choco-hazelnut-2000g","display_name":"White Choco Hazelnut / 2kg","flavour_code":"white choco hazelnut","flavour_label":"White Choco Hazelnut","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"applied-nutrition-critical-whey-2kg","variant_key":"white-chocolate-pistachio-2000g","display_name":"White Chocolate Pistachio / 2kg","flavour_code":"white chocolate pistachio","flavour_label":"White Chocolate Pistachio","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},

    {"product_slug":"applied-nutrition-creatine-monohydrate-250g","variant_key":"default","display_name":"Default","flavour_code":null,"flavour_label":null,"size_value":null,"size_unit":null,"pack_count":null,"product_format":null,"is_default":true,"is_active":true},
    {"product_slug":"applied-nutrition-creatine-monohydrate-250g","variant_key":"cherry-and-apple-250g","display_name":"Cherry & Apple / 250g","flavour_code":"cherry and apple","flavour_label":"Cherry & Apple","size_value":250,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"applied-nutrition-creatine-monohydrate-250g","variant_key":"icy-blue-razz-250g","display_name":"Icy Blue Razz / 250g","flavour_code":"icy blue razz","flavour_label":"Icy Blue Razz","size_value":250,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"applied-nutrition-creatine-monohydrate-250g","variant_key":"strawberry-and-raspberry-250g","display_name":"Strawberry & Raspberry / 250g","flavour_code":"strawberry and raspberry","flavour_label":"Strawberry & Raspberry","size_value":250,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"applied-nutrition-creatine-monohydrate-250g","variant_key":"unflavoured-250g","display_name":"Unflavoured / 250g","flavour_code":"unflavoured","flavour_label":"Unflavoured","size_value":250,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},

    {"product_slug":"efectiv-nutrition-grass-fed-whey-protein-isolate-2kg","variant_key":"default","display_name":"Default","flavour_code":null,"flavour_label":null,"size_value":null,"size_unit":null,"pack_count":null,"product_format":null,"is_default":true,"is_active":true},
    {"product_slug":"efectiv-nutrition-grass-fed-whey-protein-isolate-2kg","variant_key":"chocolate-2000g","display_name":"Chocolate / 2kg","flavour_code":"chocolate","flavour_label":"Chocolate","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"efectiv-nutrition-grass-fed-whey-protein-isolate-2kg","variant_key":"strawberry-2000g","display_name":"Strawberry / 2kg","flavour_code":"strawberry","flavour_label":"Strawberry","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"efectiv-nutrition-grass-fed-whey-protein-isolate-2kg","variant_key":"vanilla-2000g","display_name":"Vanilla / 2kg","flavour_code":"vanilla","flavour_label":"Vanilla","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},

    {"product_slug":"applied-nutrition-pump-3g-zero-stim-375g","variant_key":"default","display_name":"Default","flavour_code":null,"flavour_label":null,"size_value":null,"size_unit":null,"pack_count":null,"product_format":null,"is_default":true,"is_active":true},
    {"product_slug":"applied-nutrition-pump-3g-zero-stim-375g","variant_key":"fruit-burst-375g","display_name":"Fruit Burst / 375g","flavour_code":"fruit burst","flavour_label":"Fruit Burst","size_value":375,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"applied-nutrition-pump-3g-zero-stim-375g","variant_key":"icy-blue-razz-375g","display_name":"Icy Blue Razz / 375g","flavour_code":"icy blue razz","flavour_label":"Icy Blue Razz","size_value":375,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},

    {"product_slug":"cnp-loaded-eaa-300g","variant_key":"default","display_name":"Default","flavour_code":null,"flavour_label":null,"size_value":null,"size_unit":null,"pack_count":null,"product_format":null,"is_default":true,"is_active":true},
    {"product_slug":"cnp-loaded-eaa-300g","variant_key":"cherry-cola-bottles-300g","display_name":"Cherry Cola Bottles / 300g","flavour_code":"cherry cola bottles","flavour_label":"Cherry Cola Bottles","size_value":300,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"cnp-loaded-eaa-300g","variant_key":"lemon-300g","display_name":"Lemon / 300g","flavour_code":"lemon","flavour_label":"Lemon","size_value":300,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"cnp-loaded-eaa-300g","variant_key":"pink-lemonade-300g","display_name":"Pink Lemonade / 300g","flavour_code":"pink lemonade","flavour_label":"Pink Lemonade","size_value":300,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"cnp-loaded-eaa-300g","variant_key":"pink-pigs-300g","display_name":"Pink Pigs / 300g","flavour_code":"pink pigs","flavour_label":"Pink Pigs","size_value":300,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"cnp-loaded-eaa-300g","variant_key":"tropical-pineapple-300g","display_name":"Tropical Pineapple / 300g","flavour_code":"tropical pineapple","flavour_label":"Tropical Pineapple","size_value":300,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"cnp-loaded-eaa-300g","variant_key":"twisted-fruit-300g","display_name":"Twisted Fruit / 300g","flavour_code":"twisted fruit","flavour_label":"Twisted Fruit","size_value":300,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},

    {"product_slug":"xl-nutrition-xtra-whey-2kg","variant_key":"default","display_name":"Default","flavour_code":null,"flavour_label":null,"size_value":null,"size_unit":null,"pack_count":null,"product_format":null,"is_default":true,"is_active":true},
    {"product_slug":"xl-nutrition-xtra-whey-2kg","variant_key":"banana-2000g","display_name":"Banana / 2kg","flavour_code":"banana","flavour_label":"Banana","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"xl-nutrition-xtra-whey-2kg","variant_key":"birthday-cake-2000g","display_name":"Birthday Cake / 2kg","flavour_code":"birthday cake","flavour_label":"Birthday Cake","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"xl-nutrition-xtra-whey-2kg","variant_key":"chocolate-2000g","display_name":"Chocolate / 2kg","flavour_code":"chocolate","flavour_label":"Chocolate","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"xl-nutrition-xtra-whey-2kg","variant_key":"chocolate-bueno-2000g","display_name":"Chocolate Bueno / 2kg","flavour_code":"chocolate bueno","flavour_label":"Chocolate Bueno","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"xl-nutrition-xtra-whey-2kg","variant_key":"chocolate-mint-2000g","display_name":"Chocolate Mint / 2kg","flavour_code":"chocolate mint","flavour_label":"Chocolate Mint","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"xl-nutrition-xtra-whey-2kg","variant_key":"coconut-cream-2000g","display_name":"Coconut Cream / 2kg","flavour_code":"coconut cream","flavour_label":"Coconut Cream","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"xl-nutrition-xtra-whey-2kg","variant_key":"cookies-and-cream-2000g","display_name":"Cookies & Cream / 2kg","flavour_code":"cookies and cream","flavour_label":"Cookies & Cream","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"xl-nutrition-xtra-whey-2kg","variant_key":"peanut-butter-2000g","display_name":"Peanut Butter / 2kg","flavour_code":"peanut butter","flavour_label":"Peanut Butter","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"xl-nutrition-xtra-whey-2kg","variant_key":"strawberry-2000g","display_name":"Strawberry / 2kg","flavour_code":"strawberry","flavour_label":"Strawberry","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"xl-nutrition-xtra-whey-2kg","variant_key":"toffee-popcorn-2000g","display_name":"Toffee Popcorn / 2kg","flavour_code":"toffee popcorn","flavour_label":"Toffee Popcorn","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"xl-nutrition-xtra-whey-2kg","variant_key":"vanilla-2000g","display_name":"Vanilla / 2kg","flavour_code":"vanilla","flavour_label":"Vanilla","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_slug":"xl-nutrition-xtra-whey-2kg","variant_key":"white-chocolate-raspberry-2000g","display_name":"White Chocolate Raspberry / 2kg","flavour_code":"white chocolate raspberry","flavour_label":"White Chocolate Raspberry","size_value":2000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true}
  ]
  $batch_d_variants$::jsonb;
  v_products_before bigint;
  v_variants_before bigint;
  v_products_after bigint;
  v_variants_after bigint;
  v_missing_products bigint;
  v_missing_variants bigint;
  v_inserted_products bigint;
  v_inserted_variants bigint;
begin
  if jsonb_array_length(v_products) is distinct from 6
     or jsonb_array_length(v_variants) is distinct from 46
     or (select count(*) from jsonb_array_elements(v_variants) e where (e->>'is_default')::boolean) is distinct from 6
     or (select count(*) from jsonb_array_elements(v_variants) e where not (e->>'is_default')::boolean) is distinct from 40
     or exists (
       select 1 from jsonb_array_elements(v_products) e
       where jsonb_typeof(e) <> 'object'
          or (select count(*) from jsonb_object_keys(e)) <> 9
          or not e ?& array['name','slug','brand','category','net_weight_g','servings','product_format','is_active','identity_key']
          or nullif(btrim(e->>'name'),'') is null
          or nullif(btrim(e->>'slug'),'') is null
          or nullif(btrim(e->>'brand'),'') is null
          or nullif(btrim(e->>'category'),'') is null
          or (e->>'net_weight_g')::numeric <= 0
          or e->>'product_format' <> 'powder'
          or (e->>'is_active')::boolean is distinct from true
          or regexp_replace(lower(e->>'name'),'[^a-z0-9]+','','g') <> e->>'identity_key'
     )
     or exists (
       select 1 from jsonb_array_elements(v_variants) e
       where jsonb_typeof(e) <> 'object'
          or (select count(*) from jsonb_object_keys(e)) <> 11
          or not e ?& array['product_slug','variant_key','display_name','flavour_code','flavour_label','size_value','size_unit','pack_count','product_format','is_default','is_active']
          or not exists (select 1 from jsonb_array_elements(v_products) p where p->>'slug'=e->>'product_slug')
          or (e->>'is_active')::boolean is distinct from true
          or case when (e->>'is_default')::boolean then
               e->>'variant_key' <> 'default' or e->>'display_name' <> 'Default'
               or e->'flavour_code' <> 'null'::jsonb or e->'flavour_label' <> 'null'::jsonb
               or e->'size_value' <> 'null'::jsonb or e->'size_unit' <> 'null'::jsonb
               or e->'pack_count' <> 'null'::jsonb or e->'product_format' <> 'null'::jsonb
             else
               e->>'variant_key' = 'default' or nullif(btrim(e->>'flavour_code'),'') is null
               or nullif(btrim(e->>'flavour_label'),'') is null or (e->>'size_value')::numeric <= 0
               or e->>'size_unit' <> 'g' or (e->>'pack_count')::integer <> 1
               or e->>'product_format' <> 'powder'
             end
     ) then
    raise exception 'Batch D seed blocked: closed inventory contract is invalid';
  end if;

  if (select count(distinct e->>'slug') from jsonb_array_elements(v_products) e) <> 6
     or (select count(distinct e->>'identity_key') from jsonb_array_elements(v_products) e) <> 6
     or (select count(distinct (e->>'product_slug') || ':' || (e->>'variant_key')) from jsonb_array_elements(v_variants) e) <> 46
     or (select count(distinct (e->>'product_slug') || ':' || coalesce(e->>'flavour_code','') || ':' || coalesce(e->>'size_value','')) from jsonb_array_elements(v_variants) e where not (e->>'is_default')::boolean) <> 40 then
    raise exception 'Batch D seed blocked: inventory contains duplicate identity';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_products) e(name text,slug text,brand text,category text,net_weight_g numeric,servings integer,product_format text,is_active boolean,identity_key text)
    join public.products p on p.slug=e.slug
    where p.name is distinct from e.name or p.brand is distinct from e.brand
       or p.category is distinct from e.category or p.net_weight_g is distinct from e.net_weight_g
       or p.servings is distinct from e.servings or p.product_format is distinct from e.product_format
       or p.is_active is distinct from true or p.merged_into_product_id is not null or p.merged_at is not null
       or p.price is not null
  ) then
    raise exception 'Batch D seed blocked: expected product slug has drifted identity';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_products) e(slug text,brand text,identity_key text)
    join public.products p on p.slug is distinct from e.slug
      and regexp_replace(lower(coalesce(p.name,'')),'[^a-z0-9]+','','g')=e.identity_key
      and regexp_replace(lower(coalesce(p.brand,'')),'[^a-z0-9]+','','g')=regexp_replace(lower(e.brand),'[^a-z0-9]+','','g')
  ) then
    raise exception 'Batch D seed blocked: semantic duplicate product exists under another slug';
  end if;

  select count(*) filter (where p.id is null)
  into v_missing_products
  from jsonb_to_recordset(v_products) e(slug text)
  left join public.products p on p.slug=e.slug;
  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;

  insert into public.products(name,slug,brand,category,price,servings,net_weight_g,product_format,is_active)
  select e.name,e.slug,e.brand,e.category,null,e.servings,e.net_weight_g,e.product_format,e.is_active
  from jsonb_to_recordset(v_products) e(name text,slug text,brand text,category text,net_weight_g numeric,servings integer,product_format text,is_active boolean)
  where not exists (select 1 from public.products p where p.slug=e.slug)
  order by e.slug;
  get diagnostics v_inserted_products=row_count;

  if v_inserted_products is distinct from v_missing_products then
    raise exception 'Batch D seed failed: expected % product inserts, inserted %',v_missing_products,v_inserted_products;
  end if;

  if exists (
    select 1
    from public.products p
    join jsonb_to_recordset(v_products) ep(slug text) on ep.slug=p.slug
    join public.product_variants v on v.product_id=p.id
    where not exists (
      select 1 from jsonb_to_recordset(v_variants) ev(product_slug text,variant_key text)
      where ev.product_slug=p.slug and ev.variant_key=v.variant_key
    )
  ) then
    raise exception 'Batch D seed blocked: unexpected variant already exists for target product';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_variants) e(product_slug text,variant_key text,display_name text,flavour_code text,flavour_label text,size_value numeric,size_unit text,pack_count integer,product_format text,is_default boolean,is_active boolean)
    join public.products p on p.slug=e.product_slug
    join public.product_variants v on v.product_id=p.id and v.variant_key=e.variant_key
    where v.display_name is distinct from e.display_name or v.flavour_code is distinct from e.flavour_code
       or v.flavour_label is distinct from e.flavour_label or v.size_value is distinct from e.size_value
       or v.size_unit is distinct from e.size_unit or v.pack_count is distinct from e.pack_count
       or v.product_format is distinct from e.product_format or v.is_default is distinct from e.is_default
       or v.is_active is distinct from e.is_active or v.gtin is not null or v.image is not null
       or v.nutrition_override is distinct from '{}'::jsonb
  ) then
    raise exception 'Batch D seed blocked: expected variant key has drifted identity';
  end if;

  select count(*) into v_missing_variants
  from jsonb_to_recordset(v_variants) e(product_slug text,variant_key text)
  join public.products p on p.slug=e.product_slug
  where not exists (select 1 from public.product_variants v where v.product_id=p.id and v.variant_key=e.variant_key);

  insert into public.product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active)
  select p.id,e.variant_key,e.display_name,e.flavour_code,e.flavour_label,e.size_value,e.size_unit,e.pack_count,e.product_format,null,null,'{}'::jsonb,e.is_default,e.is_active
  from jsonb_to_recordset(v_variants) e(product_slug text,variant_key text,display_name text,flavour_code text,flavour_label text,size_value numeric,size_unit text,pack_count integer,product_format text,is_default boolean,is_active boolean)
  join public.products p on p.slug=e.product_slug
  where not exists (select 1 from public.product_variants v where v.product_id=p.id and v.variant_key=e.variant_key)
  order by e.product_slug,e.variant_key;
  get diagnostics v_inserted_variants=row_count;

  select count(*) into v_products_after from public.products;
  select count(*) into v_variants_after from public.product_variants;
  if v_inserted_variants is distinct from v_missing_variants
     or v_products_after is distinct from v_products_before+v_inserted_products
     or v_variants_after is distinct from v_variants_before+v_inserted_variants then
    raise exception 'Batch D seed failed: unexpected global table delta';
  end if;

  if (select count(*) from public.products p join jsonb_to_recordset(v_products) e(slug text) on e.slug=p.slug) <> 6
     or (select count(*) from public.product_variants v join public.products p on p.id=v.product_id join jsonb_to_recordset(v_products) e(slug text) on e.slug=p.slug) <> 46
     or exists (
       select 1 from jsonb_to_recordset(v_products) e(slug text)
       join public.products p on p.slug=e.slug
       left join lateral (select count(*) total,count(*) filter(where is_default and is_active) defaults from public.product_variants where product_id=p.id) c on true
       where c.defaults<>1 or c.total<>(case e.slug
         when 'applied-nutrition-critical-whey-2kg' then 14
         when 'applied-nutrition-creatine-monohydrate-250g' then 5
         when 'efectiv-nutrition-grass-fed-whey-protein-isolate-2kg' then 4
         when 'applied-nutrition-pump-3g-zero-stim-375g' then 3
         when 'cnp-loaded-eaa-300g' then 7
         when 'xl-nutrition-xtra-whey-2kg' then 13 end)
     ) then
    raise exception 'Batch D seed failed: final target inventory or default relation is invalid';
  end if;
end;
$seed_discount_supplements_batch_d$;

commit;
