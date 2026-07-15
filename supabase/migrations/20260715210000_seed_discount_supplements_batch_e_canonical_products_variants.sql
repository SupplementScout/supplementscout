begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

lock table public.products, public.product_variants in share row exclusive mode;

do $seed_discount_supplements_batch_e$
declare
  v_products constant jsonb := $batch_e_products$
  [
  {
    "name": "Applied Nutrition BEEF-XP Clear Beef Protein Isolate 1.8kg",
    "slug": "applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg",
    "brand": "Applied Nutrition",
    "category": "Whey Protein",
    "net_weight_g": 1800,
    "servings": 60,
    "product_format": "powder",
    "is_active": true,
    "identity_key": "appliednutritionbeefxpclearbeefproteinisolate18kg"
  },
  {
    "name": "Applied Nutrition Diet Whey Protein 1.8kg",
    "slug": "applied-nutrition-diet-whey-protein-1-8kg",
    "brand": "Applied Nutrition",
    "category": "Whey Protein",
    "net_weight_g": 1800,
    "servings": 72,
    "product_format": "powder",
    "is_active": true,
    "identity_key": "appliednutritiondietwheyprotein18kg"
  },
  {
    "name": "Applied Nutrition Diet Whey Protein 1kg",
    "slug": "applied-nutrition-diet-whey-protein-1kg",
    "brand": "Applied Nutrition",
    "category": "Whey Protein",
    "net_weight_g": 1000,
    "servings": 40,
    "product_format": "powder",
    "is_active": true,
    "identity_key": "appliednutritiondietwheyprotein1kg"
  },
  {
    "name": "DY Nutrition Shadowhey Concentrate 2kg",
    "slug": "dy-nutrition-shadowhey-concentrate-2kg",
    "brand": "DY Nutrition",
    "category": "Whey Protein",
    "net_weight_g": 2000,
    "servings": 66,
    "product_format": "powder",
    "is_active": true,
    "identity_key": "dynutritionshadowheyconcentrate2kg"
  },
  {
    "name": "DY Nutrition The Creatine 400g",
    "slug": "dy-nutrition-the-creatine-400g",
    "brand": "DY Nutrition",
    "category": "Creatine",
    "net_weight_g": 400,
    "servings": 40,
    "product_format": "powder",
    "is_active": true,
    "identity_key": "dynutritionthecreatine400g"
  },
  {
    "name": "Optimum Nutrition Platinum Creatine Plus 350g",
    "slug": "optimum-nutrition-platinum-creatine-plus-350g",
    "brand": "Optimum Nutrition",
    "category": "Creatine",
    "net_weight_g": 350,
    "servings": 50,
    "product_format": "powder",
    "is_active": true,
    "identity_key": "optimumnutritionplatinumcreatineplus350g"
  },
  {
    "name": "Applied Nutrition Beef Mass Gainer 3.13kg",
    "slug": "applied-nutrition-beef-mass-gainer-3-13kg",
    "brand": "Applied Nutrition",
    "category": "Mass Gainer",
    "net_weight_g": 3130,
    "servings": 25,
    "product_format": "powder",
    "is_active": true,
    "identity_key": "appliednutritionbeefmassgainer313kg"
  },
  {
    "name": "Applied Nutrition Critical Plant Protein 1.8kg",
    "slug": "applied-nutrition-critical-plant-protein-1-8kg",
    "brand": "Applied Nutrition",
    "category": "Whey Protein",
    "net_weight_g": 1800,
    "servings": 60,
    "product_format": "powder",
    "is_active": true,
    "identity_key": "appliednutritioncriticalplantprotein18kg"
  }
]
  $batch_e_products$::jsonb;
  v_variants constant jsonb := $batch_e_variants$
  [
  {
    "product_slug": "applied-nutrition-beef-mass-gainer-3-13kg",
    "variant_key": "blackcurrant-millions-3130g",
    "display_name": "Blackcurrant Millions / 3.13kg",
    "flavour_code": "blackcurrant millions",
    "flavour_label": "Blackcurrant Millions",
    "size_value": 3130,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-beef-mass-gainer-3-13kg",
    "variant_key": "cola-millions-3130g",
    "display_name": "Cola Millions / 3.13kg",
    "flavour_code": "cola millions",
    "flavour_label": "Cola Millions",
    "size_value": 3130,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-beef-mass-gainer-3-13kg",
    "variant_key": "default",
    "display_name": "Default",
    "flavour_code": null,
    "flavour_label": null,
    "size_value": null,
    "size_unit": null,
    "pack_count": null,
    "product_format": null,
    "is_default": true,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-beef-mass-gainer-3-13kg",
    "variant_key": "frozen-berries-3130g",
    "display_name": "Frozen Berries / 3.13kg",
    "flavour_code": "frozen berries",
    "flavour_label": "Frozen Berries",
    "size_value": 3130,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-beef-mass-gainer-3-13kg",
    "variant_key": "pineapple-millions-3130g",
    "display_name": "Pineapple Millions / 3.13kg",
    "flavour_code": "pineapple millions",
    "flavour_label": "Pineapple Millions",
    "size_value": 3130,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-beef-mass-gainer-3-13kg",
    "variant_key": "tropical-vibes-3130g",
    "display_name": "Tropical Vibes / 3.13kg",
    "flavour_code": "tropical vibes",
    "flavour_label": "Tropical Vibes",
    "size_value": 3130,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg",
    "variant_key": "blue-raspberry-1800g",
    "display_name": "Blue Raspberry / 1.8kg",
    "flavour_code": "blue raspberry",
    "flavour_label": "Blue Raspberry",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg",
    "variant_key": "cherry-and-apple-1800g",
    "display_name": "Cherry & Apple / 1.8kg",
    "flavour_code": "cherry and apple",
    "flavour_label": "Cherry & Apple",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg",
    "variant_key": "citrus-twist-1800g",
    "display_name": "Citrus Twist / 1.8kg",
    "flavour_code": "citrus twist",
    "flavour_label": "Citrus Twist",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg",
    "variant_key": "default",
    "display_name": "Default",
    "flavour_code": null,
    "flavour_label": null,
    "size_value": null,
    "size_unit": null,
    "pack_count": null,
    "product_format": null,
    "is_default": true,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg",
    "variant_key": "lemon-and-mint-1800g",
    "display_name": "Lemon & Mint / 1.8kg",
    "flavour_code": "lemon and mint",
    "flavour_label": "Lemon & Mint",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg",
    "variant_key": "millions-blackcurrant-1800g",
    "display_name": "Millions Blackcurrant / 1.8kg",
    "flavour_code": "millions blackcurrant",
    "flavour_label": "Millions Blackcurrant",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg",
    "variant_key": "millions-cola-1800g",
    "display_name": "Millions Cola / 1.8kg",
    "flavour_code": "millions cola",
    "flavour_label": "Millions Cola",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg",
    "variant_key": "mixed-berry-1800g",
    "display_name": "Mixed Berry / 1.8kg",
    "flavour_code": "mixed berry",
    "flavour_label": "Mixed Berry",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg",
    "variant_key": "orange-and-mango-1800g",
    "display_name": "Orange & Mango / 1.8kg",
    "flavour_code": "orange and mango",
    "flavour_label": "Orange & Mango",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg",
    "variant_key": "pineapple-millions-1800g",
    "display_name": "Pineapple Millions / 1.8kg",
    "flavour_code": "pineapple millions",
    "flavour_label": "Pineapple Millions",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg",
    "variant_key": "strawberry-and-raspberry-1800g",
    "display_name": "Strawberry & Raspberry / 1.8kg",
    "flavour_code": "strawberry and raspberry",
    "flavour_label": "Strawberry & Raspberry",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg",
    "variant_key": "tropical-vibes-1800g",
    "display_name": "Tropical Vibes / 1.8kg",
    "flavour_code": "tropical vibes",
    "flavour_label": "Tropical Vibes",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-critical-plant-protein-1-8kg",
    "variant_key": "chocolate-1800g",
    "display_name": "Chocolate / 1.8kg",
    "flavour_code": "chocolate",
    "flavour_label": "Chocolate",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-critical-plant-protein-1-8kg",
    "variant_key": "default",
    "display_name": "Default",
    "flavour_code": null,
    "flavour_label": null,
    "size_value": null,
    "size_unit": null,
    "pack_count": null,
    "product_format": null,
    "is_default": true,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-critical-plant-protein-1-8kg",
    "variant_key": "strawberry-1800g",
    "display_name": "Strawberry / 1.8kg",
    "flavour_code": "strawberry",
    "flavour_label": "Strawberry",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-critical-plant-protein-1-8kg",
    "variant_key": "vanilla-1800g",
    "display_name": "Vanilla / 1.8kg",
    "flavour_code": "vanilla",
    "flavour_label": "Vanilla",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-diet-whey-protein-1-8kg",
    "variant_key": "banana-milkshake-1800g",
    "display_name": "Banana Milkshake / 1.8kg",
    "flavour_code": "banana milkshake",
    "flavour_label": "Banana Milkshake",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-diet-whey-protein-1-8kg",
    "variant_key": "chocolate-dessert-1800g",
    "display_name": "Chocolate Dessert / 1.8kg",
    "flavour_code": "chocolate dessert",
    "flavour_label": "Chocolate Dessert",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-diet-whey-protein-1-8kg",
    "variant_key": "default",
    "display_name": "Default",
    "flavour_code": null,
    "flavour_label": null,
    "size_value": null,
    "size_unit": null,
    "pack_count": null,
    "product_format": null,
    "is_default": true,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-diet-whey-protein-1-8kg",
    "variant_key": "strawberry-milkshake-1800g",
    "display_name": "Strawberry Milkshake / 1.8kg",
    "flavour_code": "strawberry milkshake",
    "flavour_label": "Strawberry Milkshake",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-diet-whey-protein-1-8kg",
    "variant_key": "vanilla-ice-cream-1800g",
    "display_name": "Vanilla Ice Cream / 1.8kg",
    "flavour_code": "vanilla ice cream",
    "flavour_label": "Vanilla Ice Cream",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-diet-whey-protein-1kg",
    "variant_key": "banana-milkshake-1000g",
    "display_name": "Banana Milkshake / 1kg",
    "flavour_code": "banana milkshake",
    "flavour_label": "Banana Milkshake",
    "size_value": 1000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-diet-whey-protein-1kg",
    "variant_key": "chocolate-dessert-1000g",
    "display_name": "Chocolate Dessert / 1kg",
    "flavour_code": "chocolate dessert",
    "flavour_label": "Chocolate Dessert",
    "size_value": 1000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-diet-whey-protein-1kg",
    "variant_key": "default",
    "display_name": "Default",
    "flavour_code": null,
    "flavour_label": null,
    "size_value": null,
    "size_unit": null,
    "pack_count": null,
    "product_format": null,
    "is_default": true,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-diet-whey-protein-1kg",
    "variant_key": "strawberry-milkshake-1000g",
    "display_name": "Strawberry Milkshake / 1kg",
    "flavour_code": "strawberry milkshake",
    "flavour_label": "Strawberry Milkshake",
    "size_value": 1000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-diet-whey-protein-1kg",
    "variant_key": "vanilla-ice-cream-1000g",
    "display_name": "Vanilla Ice Cream / 1kg",
    "flavour_code": "vanilla ice cream",
    "flavour_label": "Vanilla Ice Cream",
    "size_value": 1000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "dy-nutrition-shadowhey-concentrate-2kg",
    "variant_key": "chocolate-2000g",
    "display_name": "Chocolate / 2kg",
    "flavour_code": "chocolate",
    "flavour_label": "Chocolate",
    "size_value": 2000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "dy-nutrition-shadowhey-concentrate-2kg",
    "variant_key": "cookies-and-cream-2000g",
    "display_name": "Cookies & Cream / 2kg",
    "flavour_code": "cookies and cream",
    "flavour_label": "Cookies & Cream",
    "size_value": 2000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "dy-nutrition-shadowhey-concentrate-2kg",
    "variant_key": "default",
    "display_name": "Default",
    "flavour_code": null,
    "flavour_label": null,
    "size_value": null,
    "size_unit": null,
    "pack_count": null,
    "product_format": null,
    "is_default": true,
    "is_active": true
  },
  {
    "product_slug": "dy-nutrition-shadowhey-concentrate-2kg",
    "variant_key": "strawberry-2000g",
    "display_name": "Strawberry / 2kg",
    "flavour_code": "strawberry",
    "flavour_label": "Strawberry",
    "size_value": 2000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "dy-nutrition-shadowhey-concentrate-2kg",
    "variant_key": "vanilla-2000g",
    "display_name": "Vanilla / 2kg",
    "flavour_code": "vanilla",
    "flavour_label": "Vanilla",
    "size_value": 2000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "dy-nutrition-the-creatine-400g",
    "variant_key": "cherry-400g",
    "display_name": "Cherry / 400g",
    "flavour_code": "cherry",
    "flavour_label": "Cherry",
    "size_value": 400,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "dy-nutrition-the-creatine-400g",
    "variant_key": "default",
    "display_name": "Default",
    "flavour_code": null,
    "flavour_label": null,
    "size_value": null,
    "size_unit": null,
    "pack_count": null,
    "product_format": null,
    "is_default": true,
    "is_active": true
  },
  {
    "product_slug": "dy-nutrition-the-creatine-400g",
    "variant_key": "peach-400g",
    "display_name": "Peach / 400g",
    "flavour_code": "peach",
    "flavour_label": "Peach",
    "size_value": 400,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "dy-nutrition-the-creatine-400g",
    "variant_key": "strawberry-400g",
    "display_name": "Strawberry / 400g",
    "flavour_code": "strawberry",
    "flavour_label": "Strawberry",
    "size_value": 400,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "optimum-nutrition-platinum-creatine-plus-350g",
    "variant_key": "default",
    "display_name": "Default",
    "flavour_code": null,
    "flavour_label": null,
    "size_value": null,
    "size_unit": null,
    "pack_count": null,
    "product_format": null,
    "is_default": true,
    "is_active": true
  },
  {
    "product_slug": "optimum-nutrition-platinum-creatine-plus-350g",
    "variant_key": "orange-350g",
    "display_name": "Orange / 350g",
    "flavour_code": "orange",
    "flavour_label": "Orange",
    "size_value": 350,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "optimum-nutrition-platinum-creatine-plus-350g",
    "variant_key": "pineapple-350g",
    "display_name": "Pineapple / 350g",
    "flavour_code": "pineapple",
    "flavour_label": "Pineapple",
    "size_value": 350,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  }
]
  $batch_e_variants$::jsonb;
  v_products_before bigint;
  v_variants_before bigint;
  v_products_after bigint;
  v_variants_after bigint;
  v_missing_products bigint;
  v_missing_variants bigint;
  v_inserted_products bigint;
  v_inserted_variants bigint;
begin
  if jsonb_array_length(v_products) is distinct from 8
     or jsonb_array_length(v_variants) is distinct from 44
     or (select count(*) from jsonb_array_elements(v_variants) e where (e->>'is_default')::boolean) is distinct from 8
     or (select count(*) from jsonb_array_elements(v_variants) e where not (e->>'is_default')::boolean) is distinct from 36
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
    raise exception 'Batch E seed blocked: closed inventory contract is invalid';
  end if;

  if (select count(distinct e->>'slug') from jsonb_array_elements(v_products) e) <> 8
     or (select count(distinct e->>'identity_key') from jsonb_array_elements(v_products) e) <> 8
     or (select count(distinct (e->>'product_slug') || ':' || (e->>'variant_key')) from jsonb_array_elements(v_variants) e) <> 44
     or (select count(distinct (e->>'product_slug') || ':' || coalesce(e->>'flavour_code','') || ':' || coalesce(e->>'size_value','')) from jsonb_array_elements(v_variants) e where not (e->>'is_default')::boolean) <> 36 then
    raise exception 'Batch E seed blocked: inventory contains duplicate identity';
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
    raise exception 'Batch E seed blocked: expected product slug has drifted identity';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_products) e(slug text,brand text,identity_key text)
    join public.products p on p.slug is distinct from e.slug
      and regexp_replace(lower(coalesce(p.name,'')),'[^a-z0-9]+','','g')=e.identity_key
      and regexp_replace(lower(coalesce(p.brand,'')),'[^a-z0-9]+','','g')=regexp_replace(lower(e.brand),'[^a-z0-9]+','','g')
  ) then
    raise exception 'Batch E seed blocked: semantic duplicate product exists under another slug';
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
    raise exception 'Batch E seed failed: expected % product inserts, inserted %',v_missing_products,v_inserted_products;
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
    raise exception 'Batch E seed blocked: unexpected variant already exists for target product';
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
    raise exception 'Batch E seed blocked: expected variant key has drifted identity';
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
    raise exception 'Batch E seed failed: unexpected global table delta';
  end if;

  if (select count(*) from public.products p join jsonb_to_recordset(v_products) e(slug text) on e.slug=p.slug) <> 8
     or (select count(*) from public.product_variants v join public.products p on p.id=v.product_id join jsonb_to_recordset(v_products) e(slug text) on e.slug=p.slug) <> 44
     or exists (
       select 1 from jsonb_to_recordset(v_products) e(slug text)
       join public.products p on p.slug=e.slug
       left join lateral (select count(*) total,count(*) filter(where is_default and is_active) defaults from public.product_variants where product_id=p.id) c on true
       where c.defaults<>1 or c.total<>(case e.slug
         when 'applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg' then 12
         when 'applied-nutrition-diet-whey-protein-1-8kg' then 5
         when 'applied-nutrition-diet-whey-protein-1kg' then 5
         when 'dy-nutrition-shadowhey-concentrate-2kg' then 5
         when 'dy-nutrition-the-creatine-400g' then 4
         when 'optimum-nutrition-platinum-creatine-plus-350g' then 3
         when 'applied-nutrition-beef-mass-gainer-3-13kg' then 6
         when 'applied-nutrition-critical-plant-protein-1-8kg' then 4 end)
     ) then
    raise exception 'Batch E seed failed: final target inventory or default relation is invalid';
  end if;
end;
$seed_discount_supplements_batch_e$;

commit;
