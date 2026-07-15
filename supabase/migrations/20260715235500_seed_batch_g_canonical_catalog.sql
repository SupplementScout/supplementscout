begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

lock table public.products, public.product_variants, public.retailer_products, public.offers, public.price_history in share row exclusive mode;

do $seed_batch_g_catalog$
declare
  v_new_products constant jsonb := $batch_g_new_products$
[
  {
    "name": "7Nutrition Beta-Alanine 250g",
    "slug": "7nutrition-beta-alanine-250g",
    "brand": "7Nutrition",
    "category": "Amino Acids",
    "net_weight_g": 250,
    "servings": null,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_30.png?v=1779206902",
    "is_active": true,
    "identity_key": "7nutritionbetaalanine250g"
  },
  {
    "name": "7Nutrition Creatine Monohydrate 500g",
    "slug": "7nutrition-creatine-monohydrate-500g",
    "brand": "7Nutrition",
    "category": "Creatine",
    "net_weight_g": 500,
    "servings": null,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/creatine.jpg?v=1751986853",
    "is_active": true,
    "identity_key": "7nutritioncreatinemonohydrate500g"
  },
  {
    "name": "Applied Nutrition Creatine + Hydration 30 servings",
    "slug": "applied-nutrition-creatine-hydration-30-servings",
    "brand": "Applied Nutrition",
    "category": "Creatine",
    "net_weight_g": null,
    "servings": 30,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_1.png?v=1779188613",
    "is_active": true,
    "identity_key": "appliednutritioncreatinehydration30servings"
  },
  {
    "name": "BioTech USA 100% Pure Whey 454g",
    "slug": "biotech-usa-100-pure-whey-454g",
    "brand": "BioTech USA",
    "category": "Whey Protein",
    "net_weight_g": 454,
    "servings": null,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_6c536ee6-641d-49c5-9070-d8c1e2de93c6.jpg?v=1759766231",
    "is_active": true,
    "identity_key": "biotechusa100purewhey454g"
  },
  {
    "name": "Bucked Up BAMF Pre-Workout 20 servings",
    "slug": "bucked-up-bamf-pre-workout-20-servings",
    "brand": "Bucked Up",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 20,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/2_646dc600-0fb0-47c6-84d7-389b27d5d4a7.png?v=1754307849",
    "is_active": true,
    "identity_key": "buckedupbamfpreworkout20servings"
  },
  {
    "name": "Condemned Labz Convict V2 25 servings",
    "slug": "condemned-labz-convict-v2-25-servings",
    "brand": "Condemned Labz",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 25,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_29e7592f-fc32-46b2-8194-2e5986bccef9.jpg?v=1717593218",
    "is_active": true,
    "identity_key": "condemnedlabzconvictv225servings"
  },
  {
    "name": "Ibiza Juice OG Pre-Workout 40 servings",
    "slug": "ibiza-juice-og-pre-workout-40-servings",
    "brand": "Ibiza Juice",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 40,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/2_1f09fdce-3d78-48da-9a73-c53609aa71a9.png?v=1754309762",
    "is_active": true,
    "identity_key": "ibizajuiceogpreworkout40servings"
  },
  {
    "name": "Innovapharm MVPRE Pre-Workout 3.0 40/20 servings",
    "slug": "innovapharm-mvpre-pre-workout-3-0-40-20-servings",
    "brand": "Innovapharm",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 40,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitled_design_4_88671da3-88ad-4161-bb9c-a805fb9d80ae.jpg?v=1733153228",
    "is_active": true,
    "identity_key": "innovapharmmvprepreworkout304020servings"
  },
  {
    "name": "Mutant GEAAR 30 servings",
    "slug": "mutant-geaar-30-servings",
    "brand": "Mutant",
    "category": "Amino Acids",
    "net_weight_g": null,
    "servings": 30,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_29a1d595-997b-45e7-a2f6-f8a2fde94406.jpg?v=1778259556",
    "is_active": true,
    "identity_key": "mutantgeaar30servings"
  },
  {
    "name": "N1 Pro Maximum Strength Pre-Workout 15 servings",
    "slug": "n1-pro-maximum-strength-pre-workout-15-servings",
    "brand": "N1 Pro",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 15,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/2_e7da8293-1c29-4a42-9f18-4b5d99f3be66.png?v=1754312279",
    "is_active": true,
    "identity_key": "n1promaximumstrengthpreworkout15servings"
  },
  {
    "name": "Naughty Boy Energy Pre-Workout 30 servings",
    "slug": "naughty-boy-energy-pre-workout-30-servings",
    "brand": "Naughty Boy",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 30,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/2.jpg?v=1729782717",
    "is_active": true,
    "identity_key": "naughtyboyenergypreworkout30servings"
  },
  {
    "name": "Naughty Boy Pump 25 servings",
    "slug": "naughty-boy-pump-25-servings",
    "brand": "Naughty Boy",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 25,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_34.png?v=1779207709",
    "is_active": true,
    "identity_key": "naughtyboypump25servings"
  },
  {
    "name": "OstroVit Creatine Monohydrate 1000g",
    "slug": "ostrovit-creatine-monohydrate-1000g",
    "brand": "OstroVit",
    "category": "Creatine",
    "net_weight_g": 1000,
    "servings": null,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_17.png?v=1779196459",
    "is_active": true,
    "identity_key": "ostrovitcreatinemonohydrate1000g"
  },
  {
    "name": "OstroVit Creatine Monohydrate 500g",
    "slug": "ostrovit-creatine-monohydrate-500g",
    "brand": "OstroVit",
    "category": "Creatine",
    "net_weight_g": 500,
    "servings": null,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_12.png?v=1779195684",
    "is_active": true,
    "identity_key": "ostrovitcreatinemonohydrate500g"
  },
  {
    "name": "PER4M Amino Burn 30 servings",
    "slug": "per4m-amino-burn-30-servings",
    "brand": "Per4m",
    "category": "Amino Acids",
    "net_weight_g": null,
    "servings": 30,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/1.png?v=1739014553",
    "is_active": true,
    "identity_key": "per4maminoburn30servings"
  },
  {
    "name": "RAW Nutrition Essential BUM Pre-Workout 30 servings",
    "slug": "raw-nutrition-essential-bum-pre-workout-30-servings",
    "brand": "RAW Nutrition",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 30,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/2_72c12d5c-af60-4321-8ede-5cbf5ff35b6c.png?v=1754305314",
    "is_active": true,
    "identity_key": "rawnutritionessentialbumpreworkout30servings"
  },
  {
    "name": "Smack Pre Workout Pink Starblast 20 servings",
    "slug": "smack-pre-workout-pink-starblast-20-servings",
    "brand": "Smack",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 20,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/smack.jpg?v=1733754765",
    "is_active": true,
    "identity_key": "smackpreworkoutpinkstarblast20servings"
  },
  {
    "name": "Trec CREA XTREME 180g",
    "slug": "trec-crea-xtreme-180g",
    "brand": "Trec Nutrition",
    "category": "Health Supplements",
    "net_weight_g": 180,
    "servings": null,
    "net_volume_ml": null,
    "unit_count": null,
    "unit_type": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/crea_f8b7f08d-cc70-454f-a9c2-7c20c497838c.png?v=1740492267",
    "is_active": true,
    "identity_key": "treccreaxtreme180g"
  }
]
  $batch_g_new_products$::jsonb;
  v_existing_products constant jsonb := $batch_g_existing_products$
[
  {
    "id": 43,
    "name": "Applied Nutrition L-Glutamine Powder 250g",
    "slug": "applied-nutrition-l-glutamine-powder-250g",
    "brand": "Applied Nutrition",
    "category": "Amino Acids",
    "product_format": null,
    "is_active": true
  },
  {
    "id": 68,
    "name": "7Nutrition Whey Isolate 90 1kg",
    "slug": "7nutrition-whey-isolate-90-1kg",
    "brand": "7Nutrition",
    "category": "Whey Protein",
    "product_format": null,
    "is_active": true
  },
  {
    "id": 328,
    "name": "Per4m Isolate Zero 900g",
    "slug": "per4m-isolate-zero-900g",
    "brand": "Per4m",
    "category": "Health Supplements",
    "product_format": null,
    "is_active": true
  },
  {
    "id": 403,
    "name": "GYM HIGH Mass Gainer 2100g",
    "slug": "gym-high-mass-gainer-2100g",
    "brand": "GYM HIGH",
    "category": "Mass Gainer",
    "product_format": "powder",
    "is_active": true
  },
  {
    "id": 517,
    "name": "Mutant Mass (Mass Gainer) 2.27kg",
    "slug": "mutant-mass-mass-gainer-227kg",
    "brand": "Mutant",
    "category": "Mass Gainer",
    "product_format": null,
    "is_active": true
  },
  {
    "id": 528,
    "name": "Nutrend  Pump Pre-Workout",
    "slug": "nutrend--pump-pre-workout",
    "brand": "Nutrend",
    "category": "Pre Workout",
    "product_format": null,
    "is_active": true
  }
]
  $batch_g_existing_products$::jsonb;
  v_variants constant jsonb := $batch_g_variants$
[
  {
    "product_slug": "7nutrition-beta-alanine-250g",
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
    "product_slug": "7nutrition-creatine-monohydrate-500g",
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
    "product_slug": "applied-nutrition-creatine-hydration-30-servings",
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
    "product_slug": "biotech-usa-100-pure-whey-454g",
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
    "product_slug": "bucked-up-bamf-pre-workout-20-servings",
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
    "product_slug": "condemned-labz-convict-v2-25-servings",
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
    "product_slug": "ibiza-juice-og-pre-workout-40-servings",
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
    "product_slug": "innovapharm-mvpre-pre-workout-3-0-40-20-servings",
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
    "product_slug": "mutant-geaar-30-servings",
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
    "product_slug": "n1-pro-maximum-strength-pre-workout-15-servings",
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
    "product_slug": "naughty-boy-energy-pre-workout-30-servings",
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
    "product_slug": "naughty-boy-pump-25-servings",
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
    "product_slug": "ostrovit-creatine-monohydrate-1000g",
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
    "product_slug": "ostrovit-creatine-monohydrate-500g",
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
    "product_slug": "per4m-amino-burn-30-servings",
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
    "product_slug": "raw-nutrition-essential-bum-pre-workout-30-servings",
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
    "product_slug": "smack-pre-workout-pink-starblast-20-servings",
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
    "product_slug": "trec-crea-xtreme-180g",
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
    "product_slug": "mutant-mass-mass-gainer-227kg",
    "variant_key": "strawberry-banana-2270g",
    "display_name": "Strawberry Banana / 2270g",
    "flavour_code": "strawberry banana",
    "flavour_label": "Strawberry Banana",
    "size_value": 2270,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": null,
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "mutant-mass-mass-gainer-227kg",
    "variant_key": "triple-chocolate-2270g",
    "display_name": "Triple Chocolate / 2270g",
    "flavour_code": "triple chocolate",
    "flavour_label": "Triple Chocolate",
    "size_value": 2270,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": null,
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "nutrend--pump-pre-workout",
    "variant_key": "berry-splash-225g",
    "display_name": "Berry Splash / 225g",
    "flavour_code": "berry splash",
    "flavour_label": "Berry Splash",
    "size_value": 225,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": null,
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "nutrend--pump-pre-workout",
    "variant_key": "tropical-blend-225g",
    "display_name": "Tropical Blend / 225g",
    "flavour_code": "tropical blend",
    "flavour_label": "Tropical Blend",
    "size_value": 225,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": null,
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-isolate-zero-900g",
    "variant_key": "caramel-biscuit-900g",
    "display_name": "Caramel Biscuit / 900g",
    "flavour_code": "caramel biscuit",
    "flavour_label": "Caramel Biscuit",
    "size_value": 900,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": null,
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-isolate-zero-900g",
    "variant_key": "cereal-milk-900g",
    "display_name": "Cereal Milk / 900g",
    "flavour_code": "cereal milk",
    "flavour_label": "Cereal Milk",
    "size_value": 900,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": null,
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-isolate-zero-900g",
    "variant_key": "chocolate-brownie-batter-900g",
    "display_name": "Chocolate Brownie batter / 900g",
    "flavour_code": "chocolate brownie batter",
    "flavour_label": "Chocolate Brownie batter",
    "size_value": 900,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": null,
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-isolate-zero-900g",
    "variant_key": "vanilla-creme-900g",
    "display_name": "Vanilla Creme / 900g",
    "flavour_code": "vanilla creme",
    "flavour_label": "Vanilla Creme",
    "size_value": 900,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": null,
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "gym-high-mass-gainer-2100g",
    "variant_key": "banana-split-2100g",
    "display_name": "Banana Split / 2100g",
    "flavour_code": "banana split",
    "flavour_label": "Banana Split",
    "size_value": 2100,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "7nutrition-creatine-monohydrate-500g",
    "variant_key": "apple-500g",
    "display_name": "Apple / 500g",
    "flavour_code": "apple",
    "flavour_label": "Apple",
    "size_value": 500,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "biotech-usa-100-pure-whey-454g",
    "variant_key": "banana-454g",
    "display_name": "Banana / 454g",
    "flavour_code": "banana",
    "flavour_label": "Banana",
    "size_value": 454,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-creatine-hydration-30-servings",
    "variant_key": "berry-slush-30servings",
    "display_name": "Berry Slush / 30 servings",
    "flavour_code": "berry slush",
    "flavour_label": "Berry Slush",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "ostrovit-creatine-monohydrate-1000g",
    "variant_key": "cherry-1000g",
    "display_name": "Cherry / 1000g",
    "flavour_code": "cherry",
    "flavour_label": "Cherry",
    "size_value": 1000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "biotech-usa-100-pure-whey-454g",
    "variant_key": "chocolate-454g",
    "display_name": "Chocolate / 454g",
    "flavour_code": "chocolate",
    "flavour_label": "Chocolate",
    "size_value": 454,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "condemned-labz-convict-v2-25-servings",
    "variant_key": "citrus-cherry-25servings",
    "display_name": "Citrus Cherry / 25 servings",
    "flavour_code": "citrus cherry",
    "flavour_label": "Citrus Cherry",
    "size_value": 25,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-creatine-hydration-30-servings",
    "variant_key": "citrust-burst-30servings",
    "display_name": "Citrust Burst / 30 servings",
    "flavour_code": "citrust burst",
    "flavour_label": "Citrust Burst",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "naughty-boy-energy-pre-workout-30-servings",
    "variant_key": "fizzy-peach-sweets-30servings",
    "display_name": "Fizzy Peach Sweets / 30 servings",
    "flavour_code": "fizzy peach sweets",
    "flavour_label": "Fizzy Peach Sweets",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "n1-pro-maximum-strength-pre-workout-15-servings",
    "variant_key": "forest-berries-15servings",
    "display_name": "Forest Berries / 15 servings",
    "flavour_code": "forest berries",
    "flavour_label": "Forest Berries",
    "size_value": 15,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "raw-nutrition-essential-bum-pre-workout-30-servings",
    "variant_key": "grape-30servings",
    "display_name": "Grape / 30 servings",
    "flavour_code": "grape",
    "flavour_label": "Grape",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "ostrovit-creatine-monohydrate-500g",
    "variant_key": "green-apple-500g",
    "display_name": "Green apple / 500g",
    "flavour_code": "green apple",
    "flavour_label": "Green apple",
    "size_value": 500,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "n1-pro-maximum-strength-pre-workout-15-servings",
    "variant_key": "green-lemonade-15servings",
    "display_name": "Green Lemonade / 15 servings",
    "flavour_code": "green lemonade",
    "flavour_label": "Green Lemonade",
    "size_value": 15,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "biotech-usa-100-pure-whey-454g",
    "variant_key": "hazelnut-454g",
    "display_name": "Hazelnut / 454g",
    "flavour_code": "hazelnut",
    "flavour_label": "Hazelnut",
    "size_value": 454,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "bucked-up-bamf-pre-workout-20-servings",
    "variant_key": "jungle-juice-20servings",
    "display_name": "Jungle Juice / 20 servings",
    "flavour_code": "jungle juice",
    "flavour_label": "Jungle Juice",
    "size_value": 20,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "ostrovit-creatine-monohydrate-1000g",
    "variant_key": "lemon-1000g",
    "display_name": "lemon / 1000g",
    "flavour_code": "lemon",
    "flavour_label": "lemon",
    "size_value": 1000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-amino-burn-30-servings",
    "variant_key": "lemon-lime-popsicle-30servings",
    "display_name": "LEMON LIME POPSICLE / 30 servings",
    "flavour_code": "lemon lime popsicle",
    "flavour_label": "LEMON LIME POPSICLE",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "ostrovit-creatine-monohydrate-500g",
    "variant_key": "mango-500g",
    "display_name": "Mango / 500g",
    "flavour_code": "mango",
    "flavour_label": "Mango",
    "size_value": 500,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-amino-burn-30-servings",
    "variant_key": "mango-orange-30servings",
    "display_name": "MANGO ORANGE / 30 servings",
    "flavour_code": "mango orange",
    "flavour_label": "MANGO ORANGE",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "ostrovit-creatine-monohydrate-500g",
    "variant_key": "natural-500g",
    "display_name": "Natural / 500g",
    "flavour_code": "natural",
    "flavour_label": "Natural",
    "size_value": 500,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "mutant-geaar-30-servings",
    "variant_key": "orange-rush-30servings",
    "display_name": "Orange Rush / 30 servings",
    "flavour_code": "orange rush",
    "flavour_label": "Orange Rush",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "ibiza-juice-og-pre-workout-40-servings",
    "variant_key": "pacha-fruit-strawberry-watermelon-40servings",
    "display_name": "Pacha fruit Strawberry Watermelon / 40 servings",
    "flavour_code": "pacha fruit strawberry watermelon",
    "flavour_label": "Pacha fruit Strawberry Watermelon",
    "size_value": 40,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "ibiza-juice-og-pre-workout-40-servings",
    "variant_key": "peach-daiquiri-40servings",
    "display_name": "Peach Daiquiri / 40 servings",
    "flavour_code": "peach daiquiri",
    "flavour_label": "Peach Daiquiri",
    "size_value": 40,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "naughty-boy-pump-25-servings",
    "variant_key": "pineapple-crush-25servings",
    "display_name": "Pineapple Crush / 25 servings",
    "flavour_code": "pineapple crush",
    "flavour_label": "Pineapple Crush",
    "size_value": 25,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "naughty-boy-energy-pre-workout-30-servings",
    "variant_key": "pineapple-crush-30servings",
    "display_name": "Pineapple Crush / 30 servings",
    "flavour_code": "pineapple crush",
    "flavour_label": "Pineapple Crush",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "smack-pre-workout-pink-starblast-20-servings",
    "variant_key": "pink-starblast-20servings",
    "display_name": "Pink Starblast / 20 servings",
    "flavour_code": "pink starblast",
    "flavour_label": "Pink Starblast",
    "size_value": 20,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "bucked-up-bamf-pre-workout-20-servings",
    "variant_key": "strawberry-kiwi-20servings",
    "display_name": "Strawberry Kiwi / 20 servings",
    "flavour_code": "strawberry kiwi",
    "flavour_label": "Strawberry Kiwi",
    "size_value": 20,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-amino-burn-30-servings",
    "variant_key": "strawberry-lime-30servings",
    "display_name": "STRAWBERRY LIME / 30 servings",
    "flavour_code": "strawberry lime",
    "flavour_label": "STRAWBERRY LIME",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "naughty-boy-pump-25-servings",
    "variant_key": "strawberry-mango-25servings",
    "display_name": "Strawberry Mango / 25 servings",
    "flavour_code": "strawberry mango",
    "flavour_label": "Strawberry Mango",
    "size_value": 25,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "mutant-geaar-30-servings",
    "variant_key": "sweet-iced-tea-30servings",
    "display_name": "Sweet Iced Tea / 30 servings",
    "flavour_code": "sweet iced tea",
    "flavour_label": "Sweet Iced Tea",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "7nutrition-beta-alanine-250g",
    "variant_key": "unflavoured-250g",
    "display_name": "Unflavoured / 250g",
    "flavour_code": "unflavoured",
    "flavour_label": "Unflavoured",
    "size_value": 250,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-creatine-hydration-30-servings",
    "variant_key": "unflavoured-30servings",
    "display_name": "Unflavoured / 30 servings",
    "flavour_code": "unflavoured",
    "flavour_label": "Unflavoured",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "trec-crea-xtreme-180g",
    "variant_key": "watermelon-180g",
    "display_name": "Watermelon / 180g",
    "flavour_code": "watermelon",
    "flavour_label": "Watermelon",
    "size_value": 180,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "condemned-labz-convict-v2-25-servings",
    "variant_key": "watermelon-25servings",
    "display_name": "Watermelon / 25 servings",
    "flavour_code": "watermelon",
    "flavour_label": "Watermelon",
    "size_value": 25,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "7nutrition-creatine-monohydrate-500g",
    "variant_key": "watermelon-500g",
    "display_name": "Watermelon / 500g",
    "flavour_code": "watermelon",
    "flavour_label": "Watermelon",
    "size_value": 500,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "innovapharm-mvpre-pre-workout-3-0-40-20-servings",
    "variant_key": "watermelon-lemonade-40servings",
    "display_name": "Watermelon Lemonade / 40 servings",
    "flavour_code": "watermelon lemonade",
    "flavour_label": "Watermelon Lemonade",
    "size_value": 40,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-l-glutamine-powder-250g",
    "variant_key": "unflavoured-250g",
    "display_name": "Unflavoured / 250g",
    "flavour_code": "unflavoured",
    "flavour_label": "Unflavoured",
    "size_value": 250,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": null,
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "7nutrition-whey-isolate-90-1kg",
    "variant_key": "natural-1000g",
    "display_name": "Natural / 1000g",
    "flavour_code": "natural",
    "flavour_label": "Natural",
    "size_value": 1000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": null,
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "7nutrition-whey-isolate-90-1kg",
    "variant_key": "strawberry-1000g",
    "display_name": "Strawberry / 1000g",
    "flavour_code": "strawberry",
    "flavour_label": "Strawberry",
    "size_value": 1000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": null,
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "7nutrition-whey-isolate-90-1kg",
    "variant_key": "vanilla-1000g",
    "display_name": "Vanilla / 1000g",
    "flavour_code": "vanilla",
    "flavour_label": "Vanilla",
    "size_value": 1000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": null,
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "7nutrition-whey-isolate-90-1kg",
    "variant_key": "white-chocolate-1000g",
    "display_name": "White Chocolate / 1000g",
    "flavour_code": "white chocolate",
    "flavour_label": "White Chocolate",
    "size_value": 1000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": null,
    "is_default": false,
    "is_active": true
  }
]
  $batch_g_variants$::jsonb;
  v_products_before integer;
  v_variants_before integer;
  v_mappings_before integer;
  v_offers_before integer;
  v_history_before integer;
  v_missing_products integer;
  v_missing_variants integer;
  v_inserted_products integer;
  v_inserted_variants integer;
begin
  if jsonb_array_length(v_new_products) <> 18 or jsonb_array_length(v_existing_products) <> 6
     or jsonb_array_length(v_variants) <> 67
     or (select count(*) from jsonb_to_recordset(v_variants) e(is_default boolean) where e.is_default) <> 18
     or (select count(*) from jsonb_to_recordset(v_variants) e(is_default boolean) where not e.is_default) <> 49
  then
    raise exception 'Batch G seed blocked: closed inventory count invalid';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_new_products) e(name text,slug text,brand text,category text,product_format text,identity_key text)
    where coalesce(e.name,'')='' or coalesce(e.slug,'')='' or coalesce(e.brand,'')='' or coalesce(e.category,'')='' or coalesce(e.product_format,'')='' or coalesce(e.identity_key,'')=''
  ) then raise exception 'Batch G seed blocked: product inventory has blank identity fields'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_new_products) e(slug text)
    group by e.slug having count(*)<>1
  ) then raise exception 'Batch G seed blocked: duplicate product slug in inventory'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_variants) e(product_slug text,variant_key text)
    group by e.product_slug,e.variant_key having count(*)<>1
  ) then raise exception 'Batch G seed blocked: duplicate variant key in inventory'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_existing_products) e(id bigint,name text,slug text,brand text,category text,is_active boolean)
    left join public.products p on p.id=e.id
    where p.id is null or p.name is distinct from e.name or p.slug is distinct from e.slug
       or p.brand is distinct from e.brand or p.category is distinct from e.category
       or p.is_active is distinct from e.is_active
  ) then raise exception 'Batch G seed blocked: existing product identity drift'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_existing_products) e(id bigint)
    left join lateral (
      select count(*) defaults
      from public.product_variants v
      where v.product_id=e.id and v.is_default and v.is_active
    ) d on true
    where d.defaults<>1
  ) then raise exception 'Batch G seed blocked: existing parent default variant invalid'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_new_products) e(name text,slug text,brand text,category text,product_format text,identity_key text)
    join public.products p on p.slug=e.slug
    where p.name is distinct from e.name or p.brand is distinct from e.brand or p.category is distinct from e.category
       or p.product_format is distinct from e.product_format or p.is_active is distinct from true
  ) then raise exception 'Batch G seed blocked: product slug drift'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_new_products) e(slug text,identity_key text)
    join public.products p on regexp_replace(lower(coalesce(p.name,'')),'[^a-z0-9]+','','g')=e.identity_key
    where p.slug<>e.slug and p.is_active and p.merged_into_product_id is null
  ) then raise exception 'Batch G seed blocked: semantic product collision'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_variants) e(product_slug text,variant_key text,display_name text,flavour_code text,flavour_label text,size_value numeric,size_unit text,pack_count integer,product_format text,is_default boolean,is_active boolean)
    join public.products p on p.slug=e.product_slug
    join public.product_variants v on v.product_id=p.id and v.variant_key=e.variant_key
    where v.display_name is distinct from e.display_name
       or v.flavour_code is distinct from e.flavour_code
       or v.flavour_label is distinct from e.flavour_label
       or v.size_value is distinct from e.size_value
       or v.size_unit is distinct from e.size_unit
       or v.pack_count is distinct from e.pack_count
       or v.product_format is distinct from e.product_format
       or v.is_default is distinct from e.is_default
       or v.is_active is distinct from e.is_active
  ) then raise exception 'Batch G seed blocked: variant key drift'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_variants) e(product_slug text,variant_key text,flavour_code text,flavour_label text,size_value numeric,size_unit text,pack_count integer,product_format text,is_default boolean)
    join public.products p on p.slug=e.product_slug
    join public.product_variants v on v.product_id=p.id
    where not e.is_default and not v.is_default and v.variant_key<>e.variant_key
      and v.is_active
      and v.flavour_code is not distinct from e.flavour_code
      and v.flavour_label is not distinct from e.flavour_label
      and v.size_value is not distinct from e.size_value
      and v.size_unit is not distinct from e.size_unit
      and v.pack_count is not distinct from e.pack_count
      and v.product_format is not distinct from e.product_format
  ) then raise exception 'Batch G seed blocked: semantic variant collision'; end if;

  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;

  select count(*) into v_missing_products
  from jsonb_to_recordset(v_new_products) e(slug text)
  where not exists(select 1 from public.products p where p.slug=e.slug);

  insert into public.products(name,slug,brand,category,price,image,servings,net_weight_g,net_volume_ml,unit_count,unit_type,product_format,is_active)
  select e.name,e.slug,e.brand,e.category,null,e.image,e.servings,e.net_weight_g,e.net_volume_ml,e.unit_count,e.unit_type,e.product_format,true
  from jsonb_to_recordset(v_new_products) e(name text,slug text,brand text,category text,image text,servings integer,net_weight_g numeric,net_volume_ml numeric,unit_count integer,unit_type text,product_format text)
  where not exists(select 1 from public.products p where p.slug=e.slug)
  order by e.slug;
  get diagnostics v_inserted_products = row_count;
  if v_inserted_products<>v_missing_products then raise exception 'Batch G seed failed: product insert count mismatch'; end if;

  select count(*) into v_missing_variants
  from jsonb_to_recordset(v_variants) e(product_slug text,variant_key text)
  join public.products p on p.slug=e.product_slug
  where not exists(select 1 from public.product_variants v where v.product_id=p.id and v.variant_key=e.variant_key);

  insert into public.product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active)
  select p.id,e.variant_key,e.display_name,e.flavour_code,e.flavour_label,e.size_value,e.size_unit,e.pack_count,e.product_format,null,null,'{}'::jsonb,e.is_default,true
  from jsonb_to_recordset(v_variants) e(product_slug text,variant_key text,display_name text,flavour_code text,flavour_label text,size_value numeric,size_unit text,pack_count integer,product_format text,is_default boolean)
  join public.products p on p.slug=e.product_slug
  where not exists(select 1 from public.product_variants v where v.product_id=p.id and v.variant_key=e.variant_key)
  order by e.product_slug,e.is_default desc,e.variant_key;
  get diagnostics v_inserted_variants = row_count;
  if v_inserted_variants<>v_missing_variants then raise exception 'Batch G seed failed: variant insert count mismatch'; end if;

  if (select count(*) from public.products)<>v_products_before+v_missing_products
     or (select count(*) from public.product_variants)<>v_variants_before+v_missing_variants
     or (select count(*) from public.retailer_products)<>v_mappings_before
     or (select count(*) from public.offers)<>v_offers_before
     or (select count(*) from public.price_history)<>v_history_before
  then raise exception 'Batch G seed failed: unexpected table delta'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_new_products) e(slug text,image text)
    left join public.products p on p.slug=e.slug
    left join lateral (
      select count(*) defaults
      from public.product_variants v
      where v.product_id=p.id and v.is_default and v.is_active
    ) d on true
    where p.id is null or p.image is distinct from e.image or d.defaults<>1
  )
  or (
    select count(*)
    from jsonb_to_recordset(v_variants) e(product_slug text,variant_key text)
    join public.products p on p.slug=e.product_slug
    join public.product_variants v on v.product_id=p.id and v.variant_key=e.variant_key
  ) <> jsonb_array_length(v_variants)
  then raise exception 'Batch G seed failed: final inventory invalid'; end if;
end
$seed_batch_g_catalog$;

commit;
