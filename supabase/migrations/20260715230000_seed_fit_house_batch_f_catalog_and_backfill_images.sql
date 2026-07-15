begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

lock table public.products, public.product_variants, public.retailer_products, public.offers, public.price_history in share row exclusive mode;

do $seed_fit_house_batch_f$
declare
  v_new_products constant jsonb := $batch_f_new_products$
[
  {
    "name": "10X Athletic PUMP Non-Stim Pre Workout 50 servings",
    "slug": "10x-athletic-pump-non-stim-pre-workout-50-servings",
    "brand": "10X Athletic",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 50,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_3_2559357e-8aec-486e-84c0-16047e5d6110.png?v=1780407180",
    "is_active": true,
    "identity_key": "10xathleticpumpnonstimpreworkout50servings"
  },
  {
    "name": "10X Extreme Stim Pre Workout 600g",
    "slug": "10x-extreme-stim-pre-workout-600g",
    "brand": "10X Athletic",
    "category": "Pre Workout",
    "net_weight_g": 600,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_a671e813-7137-42cb-a099-89a5eeb3cf49.png?v=1780403932",
    "is_active": true,
    "identity_key": "10xextremestimpreworkout600g"
  },
  {
    "name": "10X WHEY PROTEIN Grass Fed 25 Servings",
    "slug": "10x-whey-protein-grass-fed-25-servings",
    "brand": "10X Athletic",
    "category": "Whey Protein",
    "net_weight_g": null,
    "servings": 25,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_5_141a3557-7cc8-4201-be74-1cde58683a6d.png?v=1780407984",
    "is_active": true,
    "identity_key": "10xwheyproteingrassfed25servings"
  },
  {
    "name": "5% Nutrition Aminos 20 servings",
    "slug": "5-nutrition-aminos-20-servings",
    "brand": "5% Nutrition",
    "category": "Amino Acids",
    "net_weight_g": null,
    "servings": 20,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_d2f7d526-7521-4cf7-b246-fab05a93f59a.jpg?v=1778254843",
    "is_active": true,
    "identity_key": "5nutritionaminos20servings"
  },
  {
    "name": "HR Labs Hydro EAA 30 servings",
    "slug": "hr-labs-hydro-eaa-30-servings",
    "brand": "HR Labs",
    "category": "Amino Acids",
    "net_weight_g": null,
    "servings": 30,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_c8032508-53a2-4228-ae73-2c1e530db085.jpg?v=1778082287",
    "is_active": true,
    "identity_key": "hrlabshydroeaa30servings"
  },
  {
    "name": "HR Labs Proven 20 servings",
    "slug": "hr-labs-proven-20-servings",
    "brand": "HR Labs",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 20,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_32.png?v=1779207263",
    "is_active": true,
    "identity_key": "hrlabsproven20servings"
  },
  {
    "name": "HR Labs Wattr 40 servings",
    "slug": "hr-labs-wattr-40-servings",
    "brand": "HR Labs",
    "category": "Hydration",
    "net_weight_g": null,
    "servings": 40,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_94ea9ffb-c51b-47a7-bfff-abd819426938.jpg?v=1778507040",
    "is_active": true,
    "identity_key": "hrlabswattr40servings"
  },
  {
    "name": "Naughty Boy Menace V2 60 servings",
    "slug": "naughty-boy-menace-v2-60-servings",
    "brand": "Naughty Boy",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 60,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_ff727d6b-5765-4474-a0ca-2ebb4950c6ba.jpg?v=1759581176",
    "is_active": true,
    "identity_key": "naughtyboymenacev260servings"
  },
  {
    "name": "NOCCO Electrolyte Energy Drink 355ml",
    "slug": "nocco-electrolyte-energy-drink-355ml",
    "brand": "NOCCO",
    "category": "Energy Drinks",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": 355,
    "product_format": "ready_to_drink",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_1_c241d2fa-aa85-42e8-9d3f-0eb4a25dbf2f.jpg?v=1759490230",
    "is_active": true,
    "identity_key": "noccoelectrolyteenergydrink355ml"
  },
  {
    "name": "Osavi Himalayan Shilajit Resin 25g",
    "slug": "osavi-himalayan-shilajit-resin-25g",
    "brand": "Osavi",
    "category": "Health Supplements",
    "net_weight_g": 25,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "resin",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_4_192e7c91-c312-4689-bb40-dbf4673d69a9.jpg?v=1783008911",
    "is_active": true,
    "identity_key": "osavihimalayanshilajitresin25g"
  },
  {
    "name": "OstroVit Carbo 1000g",
    "slug": "ostrovit-carbo-1000g",
    "brand": "OstroVit",
    "category": "Carbohydrates",
    "net_weight_g": 1000,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_4_cc1718d8-ce04-4ebe-a429-2b6b650fd1ab.jpg?v=1778591486",
    "is_active": true,
    "identity_key": "ostrovitcarbo1000g"
  },
  {
    "name": "OstroVit Creatine Monohydrate 300g",
    "slug": "ostrovit-creatine-monohydrate-300g",
    "brand": "OstroVit",
    "category": "Creatine",
    "net_weight_g": 300,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_22.png?v=1779197358",
    "is_active": true,
    "identity_key": "ostrovitcreatinemonohydrate300g"
  }
]
  $batch_f_new_products$::jsonb;
  v_existing_products constant jsonb := $batch_f_existing_products$
[
  {
    "id": 165,
    "name": "Lenny & Larry's Complete Vegan Cookie  113g",
    "slug": "lenny--larrys-complete-vegan-cookie--113g",
    "brand": "Lenny & Larry",
    "category": "Protein Bars",
    "is_active": true
  },
  {
    "id": 224,
    "name": "Barebells High Protein Milkshake 330ml",
    "slug": "barebells-high-protein-milkshake-330ml",
    "brand": "Barebells",
    "category": "Protein Bars",
    "is_active": true
  },
  {
    "id": 273,
    "name": "Applied Nutrition ABE - Energy RTD Drink",
    "slug": "applied-nutrition-abe---energy-rtd-drink",
    "brand": "Applied Nutrition",
    "category": "Health Supplements",
    "is_active": true
  },
  {
    "id": 502,
    "name": "Lenny & Larry Fitzels Pretzels 85g",
    "slug": "lenny--larry-fitzels-pretzels-85g",
    "brand": "Lenny & Larry",
    "category": "Health Supplements",
    "is_active": true
  }
]
  $batch_f_existing_products$::jsonb;
  v_variants constant jsonb := $batch_f_variants$
[
  {
    "product_slug": "10x-athletic-pump-non-stim-pre-workout-50-servings",
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
    "product_slug": "10x-extreme-stim-pre-workout-600g",
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
    "product_slug": "10x-whey-protein-grass-fed-25-servings",
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
    "product_slug": "5-nutrition-aminos-20-servings",
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
    "product_slug": "hr-labs-hydro-eaa-30-servings",
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
    "product_slug": "hr-labs-proven-20-servings",
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
    "product_slug": "hr-labs-wattr-40-servings",
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
    "product_slug": "naughty-boy-menace-v2-60-servings",
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
    "product_slug": "nocco-electrolyte-energy-drink-355ml",
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
    "product_slug": "osavi-himalayan-shilajit-resin-25g",
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
    "product_slug": "ostrovit-carbo-1000g",
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
    "product_slug": "ostrovit-creatine-monohydrate-300g",
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
    "product_slug": "applied-nutrition-abe---energy-rtd-drink",
    "variant_key": "apple-and-elderflower-330ml",
    "display_name": "Apple & Elderflower / 330ml",
    "flavour_code": "apple and elderflower",
    "flavour_label": "Apple & Elderflower",
    "size_value": 330,
    "size_unit": "ml",
    "pack_count": 1,
    "product_format": "ready_to_drink",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-abe---energy-rtd-drink",
    "variant_key": "cloudy-lemonade-330ml",
    "display_name": "Cloudy Lemonade / 330ml",
    "flavour_code": "cloudy lemonade",
    "flavour_label": "Cloudy Lemonade",
    "size_value": 330,
    "size_unit": "ml",
    "pack_count": 1,
    "product_format": "ready_to_drink",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-abe---energy-rtd-drink",
    "variant_key": "energy-330ml",
    "display_name": "Energy / 330ml",
    "flavour_code": "energy",
    "flavour_label": "Energy",
    "size_value": 330,
    "size_unit": "ml",
    "pack_count": 1,
    "product_format": "ready_to_drink",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-abe---energy-rtd-drink",
    "variant_key": "grape-soda-330ml",
    "display_name": "Grape Soda / 330ml",
    "flavour_code": "grape soda",
    "flavour_label": "Grape Soda",
    "size_value": 330,
    "size_unit": "ml",
    "pack_count": 1,
    "product_format": "ready_to_drink",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "barebells-high-protein-milkshake-330ml",
    "variant_key": "chocolate-330ml",
    "display_name": "Chocolate / 330ml",
    "flavour_code": "chocolate",
    "flavour_label": "Chocolate",
    "size_value": 330,
    "size_unit": "ml",
    "pack_count": 1,
    "product_format": "ready_to_drink",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "lenny--larry-fitzels-pretzels-85g",
    "variant_key": "everything-bagel-85g",
    "display_name": "Everything Bagel / 85g",
    "flavour_code": "everything bagel",
    "flavour_label": "Everything Bagel",
    "size_value": 85,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "snack",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "lenny--larry-fitzels-pretzels-85g",
    "variant_key": "pizza-palooza-85g",
    "display_name": "Pizza Palooza / 85g",
    "flavour_code": "pizza palooza",
    "flavour_label": "Pizza Palooza",
    "size_value": 85,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "snack",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "lenny--larrys-complete-vegan-cookie--113g",
    "variant_key": "chocolate-chip-113g",
    "display_name": "Chocolate Chip / 113g",
    "flavour_code": "chocolate chip",
    "flavour_label": "Chocolate Chip",
    "size_value": 113,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "snack",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "lenny--larrys-complete-vegan-cookie--113g",
    "variant_key": "lemon-poppy-seed-113g",
    "display_name": "Lemon Poppy Seed / 113g",
    "flavour_code": "lemon poppy seed",
    "flavour_label": "Lemon Poppy Seed",
    "size_value": 113,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "snack",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "lenny--larrys-complete-vegan-cookie--113g",
    "variant_key": "peanut-butter-chocolate-chip-113g",
    "display_name": "Peanut Butter Chocolate Chip / 113g",
    "flavour_code": "peanut butter chocolate chip",
    "flavour_label": "Peanut Butter Chocolate Chip",
    "size_value": 113,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "snack",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "lenny--larrys-complete-vegan-cookie--113g",
    "variant_key": "strawberry-shortcake-113g",
    "display_name": "Strawberry Shortcake / 113g",
    "flavour_code": "strawberry shortcake",
    "flavour_label": "Strawberry Shortcake",
    "size_value": 113,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "snack",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "10x-athletic-pump-non-stim-pre-workout-50-servings",
    "variant_key": "apple-attack-50-servings",
    "display_name": "Apple Attack / 50 servings",
    "flavour_code": "apple attack",
    "flavour_label": "Apple Attack",
    "size_value": 50,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "10x-extreme-stim-pre-workout-600g",
    "variant_key": "apple-attack-600g",
    "display_name": "Apple Attack / 600g",
    "flavour_code": "apple attack",
    "flavour_label": "Apple Attack",
    "size_value": 600,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "10x-extreme-stim-pre-workout-600g",
    "variant_key": "cobra-ki-600g",
    "display_name": "Cobra Ki / 600g",
    "flavour_code": "cobra ki",
    "flavour_label": "Cobra Ki",
    "size_value": 600,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "10x-whey-protein-grass-fed-25-servings",
    "variant_key": "banana-split-25-servings",
    "display_name": "Banana Split / 25 servings",
    "flavour_code": "banana split",
    "flavour_label": "Banana Split",
    "size_value": 25,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "10x-whey-protein-grass-fed-25-servings",
    "variant_key": "chocolate-hazelnut-25-servings",
    "display_name": "Chocolate Hazelnut / 25 servings",
    "flavour_code": "chocolate hazelnut",
    "flavour_label": "Chocolate Hazelnut",
    "size_value": 25,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "10x-whey-protein-grass-fed-25-servings",
    "variant_key": "chocolate-milk-25-servings",
    "display_name": "Chocolate Milk / 25 servings",
    "flavour_code": "chocolate milk",
    "flavour_label": "Chocolate Milk",
    "size_value": 25,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "10x-whey-protein-grass-fed-25-servings",
    "variant_key": "strawberry-milkshake-25-servings",
    "display_name": "Strawberry Milkshake / 25 servings",
    "flavour_code": "strawberry milkshake",
    "flavour_label": "Strawberry Milkshake",
    "size_value": 25,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "10x-whey-protein-grass-fed-25-servings",
    "variant_key": "vanilla-ice-cream-25-servings",
    "display_name": "Vanilla Ice Cream / 25 servings",
    "flavour_code": "vanilla ice cream",
    "flavour_label": "Vanilla Ice Cream",
    "size_value": 25,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "5-nutrition-aminos-20-servings",
    "variant_key": "italian-lemon-ice-20-servings",
    "display_name": "Italian Lemon Ice / 20 servings",
    "flavour_code": "italian lemon ice",
    "flavour_label": "Italian Lemon Ice",
    "size_value": 20,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "5-nutrition-aminos-20-servings",
    "variant_key": "southern-sweet-tea-20-servings",
    "display_name": "Southern Sweet Tea / 20 servings",
    "flavour_code": "southern sweet tea",
    "flavour_label": "Southern Sweet Tea",
    "size_value": 20,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "hr-labs-hydro-eaa-30-servings",
    "variant_key": "s-berry-peaches-30-servings",
    "display_name": "S-Berry Peaches / 30 servings",
    "flavour_code": "s berry peaches",
    "flavour_label": "S-Berry Peaches",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "hr-labs-hydro-eaa-30-servings",
    "variant_key": "super-fresh-oj-30-servings",
    "display_name": "Super Fresh OJ / 30 servings",
    "flavour_code": "super fresh oj",
    "flavour_label": "Super Fresh OJ",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "hr-labs-proven-20-servings",
    "variant_key": "classic-cola-20-servings",
    "display_name": "Classic Cola / 20 servings",
    "flavour_code": "classic cola",
    "flavour_label": "Classic Cola",
    "size_value": 20,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "hr-labs-proven-20-servings",
    "variant_key": "frootz-20-servings",
    "display_name": "Frootz / 20 servings",
    "flavour_code": "frootz",
    "flavour_label": "Frootz",
    "size_value": 20,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "hr-labs-wattr-40-servings",
    "variant_key": "pink-lemonade-40-servings",
    "display_name": "Pink Lemonade / 40 servings",
    "flavour_code": "pink lemonade",
    "flavour_label": "Pink Lemonade",
    "size_value": 40,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "hr-labs-wattr-40-servings",
    "variant_key": "super-fresh-oj-40-servings",
    "display_name": "Super Fresh OJ / 40 servings",
    "flavour_code": "super fresh oj",
    "flavour_label": "Super Fresh OJ",
    "size_value": 40,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "naughty-boy-menace-v2-60-servings",
    "variant_key": "gotti-grape-60-servings",
    "display_name": "Gotti Grape / 60 servings",
    "flavour_code": "gotti grape",
    "flavour_label": "Gotti Grape",
    "size_value": 60,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "naughty-boy-menace-v2-60-servings",
    "variant_key": "sour-gummy-bears-60-servings",
    "display_name": "Sour Gummy Bears / 60 servings",
    "flavour_code": "sour gummy bears",
    "flavour_label": "Sour Gummy Bears",
    "size_value": 60,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "nocco-electrolyte-energy-drink-355ml",
    "variant_key": "blood-orange-355ml",
    "display_name": "Blood Orange / 355ml",
    "flavour_code": "blood orange",
    "flavour_label": "Blood Orange",
    "size_value": 355,
    "size_unit": "ml",
    "pack_count": 1,
    "product_format": "ready_to_drink",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "nocco-electrolyte-energy-drink-355ml",
    "variant_key": "lemon-lime-355ml",
    "display_name": "Lemon Lime / 355ml",
    "flavour_code": "lemon lime",
    "flavour_label": "Lemon Lime",
    "size_value": 355,
    "size_unit": "ml",
    "pack_count": 1,
    "product_format": "ready_to_drink",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "ostrovit-carbo-1000g",
    "variant_key": "cherry-1000g",
    "display_name": "Cherry / 1kg",
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
    "product_slug": "ostrovit-carbo-1000g",
    "variant_key": "lemon-1000g",
    "display_name": "Lemon / 1kg",
    "flavour_code": "lemon",
    "flavour_label": "Lemon",
    "size_value": 1000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "ostrovit-creatine-monohydrate-300g",
    "variant_key": "orange-300g",
    "display_name": "Orange / 300g",
    "flavour_code": "orange",
    "flavour_label": "Orange",
    "size_value": 300,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "ostrovit-creatine-monohydrate-300g",
    "variant_key": "unflavoured-300g",
    "display_name": "Unflavoured / 300g",
    "flavour_code": "unflavoured",
    "flavour_label": "Unflavoured",
    "size_value": 300,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  }
]
  $batch_f_variants$::jsonb;
  v_images constant jsonb := $batch_f_images$
[
  {
    "product_id": 742,
    "name": "Applied Nutrition Creatine Monohydrate 250g",
    "slug": "applied-nutrition-creatine-monohydrate-250g",
    "brand": "Applied Nutrition",
    "image": "https://cdn.shopify.com/s/files/1/0266/9032/2479/files/CreatineMonohydrate_Professional_250g.webp?v=1764773642"
  },
  {
    "product_id": 743,
    "name": "Applied Nutrition Critical Whey 2kg",
    "slug": "applied-nutrition-critical-whey-2kg",
    "brand": "Applied Nutrition",
    "image": "https://cdn.shopify.com/s/files/1/0266/9032/2479/files/Critical_Whey_Professional_2kg_-_Chocolate_Milkshake.webp?v=1756728633"
  },
  {
    "product_id": 744,
    "name": "Applied Nutrition Pump 3G Zero Stim 375g",
    "slug": "applied-nutrition-pump-3g-zero-stim-375g",
    "brand": "Applied Nutrition",
    "image": "https://cdn.shopify.com/s/files/1/0266/9032/2479/files/PumpPre-Workout3G-FruitBirst-ZeroStim.webp?v=1757336580"
  },
  {
    "product_id": 745,
    "name": "CNP Loaded EAA 300g",
    "slug": "cnp-loaded-eaa-300g",
    "brand": "CNP",
    "image": "https://cdn.shopify.com/s/files/1/0266/9032/2479/files/cnp-loaded-eaa-300g-709599.jpg?v=1720518326"
  },
  {
    "product_id": 746,
    "name": "Efectiv Nutrition Grass-Fed Whey Protein Isolate 2kg",
    "slug": "efectiv-nutrition-grass-fed-whey-protein-isolate-2kg",
    "brand": "Efectiv Nutrition",
    "image": "https://cdn.shopify.com/s/files/1/0266/9032/2479/files/efectiv.grass.fed.whey.protein.isolate.milky.chocolate_1f7ea90a-f3c7-4e04-94a3-9bde0879060d.webp?v=1765898855"
  },
  {
    "product_id": 747,
    "name": "XL Nutrition XTRA Whey 2kg",
    "slug": "xl-nutrition-xtra-whey-2kg",
    "brand": "XL Nutrition",
    "image": "https://cdn.shopify.com/s/files/1/0266/9032/2479/files/XL_Xtra_Whey_2kg_Banana.jpg?v=1765468759"
  },
  {
    "product_id": 748,
    "name": "Applied Nutrition Beef Mass Gainer 3.13kg",
    "slug": "applied-nutrition-beef-mass-gainer-3-13kg",
    "brand": "Applied Nutrition",
    "image": "https://cdn.shopify.com/s/files/1/0266/9032/2479/files/BeefMassGainer3.13kg-MillionsCola_02c8b3aa-27dc-4d64-a3e7-482d8177e867.webp?v=1758813558"
  },
  {
    "product_id": 749,
    "name": "Applied Nutrition BEEF-XP Clear Beef Protein Isolate 1.8kg",
    "slug": "applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg",
    "brand": "Applied Nutrition",
    "image": "https://cdn.shopify.com/s/files/1/0266/9032/2479/files/Beef-XP_1.8kg_-_Mixed_Berry.webp?v=1764773376"
  },
  {
    "product_id": 750,
    "name": "Applied Nutrition Critical Plant Protein 1.8kg",
    "slug": "applied-nutrition-critical-plant-protein-1-8kg",
    "brand": "Applied Nutrition",
    "image": "https://cdn.shopify.com/s/files/1/0266/9032/2479/files/applied-nutrition-critical-plant-18kg-157625.webp?v=1720518184"
  },
  {
    "product_id": 753,
    "name": "DY Nutrition Shadowhey Concentrate 2kg",
    "slug": "dy-nutrition-shadowhey-concentrate-2kg",
    "brand": "DY Nutrition",
    "image": "https://cdn.shopify.com/s/files/1/0266/9032/2479/files/DY_WPC_SHADOWHEYCONCENTRATED_cookiesandcream_0010000.webp?v=1769165442"
  },
  {
    "product_id": 754,
    "name": "DY Nutrition The Creatine 400g",
    "slug": "dy-nutrition-the-creatine-400g",
    "brand": "DY Nutrition",
    "image": "https://cdn.shopify.com/s/files/1/0266/9032/2479/files/DY_THECREATINE_2025_PEACH_010000_d7f8c811-b664-41f5-892d-e8cf53cc5bf9.webp?v=1769165299"
  },
  {
    "product_id": 755,
    "name": "Optimum Nutrition Platinum Creatine Plus 350g",
    "slug": "optimum-nutrition-platinum-creatine-plus-350g",
    "brand": "Optimum Nutrition",
    "image": "https://cdn.shopify.com/s/files/1/0266/9032/2479/files/optimum-nutrition-platinum-creatine-plus-350g-585674.webp?v=1720518691"
  }
]
  $batch_f_images$::jsonb;
  v_products_before bigint; v_variants_before bigint; v_mappings_before bigint; v_offers_before bigint; v_history_before bigint;
  v_products_after bigint; v_variants_after bigint; v_mappings_after bigint; v_offers_after bigint; v_history_after bigint;
  v_missing_products bigint; v_missing_variants bigint; v_inserted_products bigint; v_inserted_variants bigint; v_updated_images bigint;
begin
  if jsonb_array_length(v_new_products) <> 12 or jsonb_array_length(v_existing_products) <> 4
     or jsonb_array_length(v_variants) <> 47 or jsonb_array_length(v_images) <> 12
     or (select count(*) from jsonb_array_elements(v_variants) e where (e->>'is_default')::boolean) <> 12
     or (select count(*) from jsonb_array_elements(v_variants) e where not (e->>'is_default')::boolean) <> 35
     or (select count(distinct e->>'slug') from jsonb_array_elements(v_new_products) e) <> 12
     or (select count(distinct (e->>'product_slug')||':'||(e->>'variant_key')) from jsonb_array_elements(v_variants) e) <> 47
     or (select count(distinct (e->>'product_slug')||':'||coalesce(e->>'flavour_code','')||':'||coalesce(e->>'size_value','')||':'||coalesce(e->>'size_unit','')) from jsonb_array_elements(v_variants) e where not (e->>'is_default')::boolean) <> 35
     or (select count(distinct (e->>'product_id')::bigint) from jsonb_array_elements(v_images) e) <> 12 then
    raise exception 'Batch F seed blocked: closed inventory contract is invalid';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(v_existing_products) e(id bigint,name text,slug text,brand text,category text,is_active boolean)
    left join public.products p on p.id=e.id
    where p.id is null or p.name is distinct from e.name or p.slug is distinct from e.slug or p.brand is distinct from e.brand
       or p.category is distinct from e.category or p.is_active is distinct from true or p.merged_into_product_id is not null
  ) then raise exception 'Batch F seed blocked: existing canonical product identity drift'; end if;

  if exists (
    select 1 from jsonb_to_recordset(v_images) e(product_id bigint,name text,slug text,brand text,image text)
    left join public.products p on p.id=e.product_id
    where p.id is null or p.name is distinct from e.name or p.slug is distinct from e.slug or p.brand is distinct from e.brand
       or p.is_active is distinct from true or p.merged_into_product_id is not null
       or (nullif(btrim(p.image),'') is not null and p.image is distinct from e.image)
  ) then raise exception 'Batch F seed blocked: image target identity or URL drift'; end if;

  if exists (
    select 1 from jsonb_to_recordset(v_new_products) e(name text,slug text,brand text,category text,net_weight_g numeric,servings integer,net_volume_ml numeric,product_format text,image text,is_active boolean,identity_key text)
    join public.products p on p.slug=e.slug
    where p.name is distinct from e.name or p.brand is distinct from e.brand or p.category is distinct from e.category
       or p.net_weight_g is distinct from e.net_weight_g or p.servings is distinct from e.servings or p.net_volume_ml is distinct from e.net_volume_ml
       or p.product_format is distinct from e.product_format or p.image is distinct from e.image or p.is_active is distinct from true
       or p.price is not null or p.merged_into_product_id is not null or p.merged_at is not null
  ) then raise exception 'Batch F seed blocked: expected product slug has drifted identity'; end if;

  if exists (
    select 1 from jsonb_to_recordset(v_new_products) e(slug text,brand text,identity_key text)
    join public.products p on p.slug is distinct from e.slug
      and regexp_replace(lower(coalesce(p.name,'')),'[^a-z0-9]+','','g')=e.identity_key
      and regexp_replace(lower(coalesce(p.brand,'')),'[^a-z0-9]+','','g')=regexp_replace(lower(e.brand),'[^a-z0-9]+','','g')
  ) then raise exception 'Batch F seed blocked: semantic duplicate product exists under another slug'; end if;

  if exists (
    select 1 from jsonb_to_recordset(v_existing_products) e(id bigint)
    join public.product_variants v on v.product_id=e.id
    where not (v.is_default and v.is_active and v.variant_key='default')
      and not exists (select 1 from jsonb_to_recordset(v_variants) x(product_slug text,variant_key text) join public.products p on p.slug=x.product_slug where p.id=e.id and x.variant_key=v.variant_key)
  ) or exists (
    select 1 from jsonb_to_recordset(v_existing_products) e(id bigint)
    left join lateral (select count(*) filter(where is_default and is_active) defaults from public.product_variants where product_id=e.id) c on true where c.defaults<>1
  ) then raise exception 'Batch F seed blocked: existing product variant inventory drift'; end if;

  select count(*) into v_products_before from public.products; select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products; select count(*) into v_offers_before from public.offers; select count(*) into v_history_before from public.price_history;
  select count(*) filter(where p.id is null) into v_missing_products from jsonb_to_recordset(v_new_products) e(slug text) left join public.products p on p.slug=e.slug;

  insert into public.products(name,slug,brand,category,price,image,servings,net_weight_g,net_volume_ml,product_format,is_active)
  select e.name,e.slug,e.brand,e.category,null,e.image,e.servings,e.net_weight_g,e.net_volume_ml,e.product_format,true
  from jsonb_to_recordset(v_new_products) e(name text,slug text,brand text,category text,net_weight_g numeric,servings integer,net_volume_ml numeric,product_format text,image text)
  where not exists(select 1 from public.products p where p.slug=e.slug) order by e.slug;
  get diagnostics v_inserted_products=row_count;
  if v_inserted_products<>v_missing_products then raise exception 'Batch F seed failed: product insert count mismatch'; end if;

  if exists (
    select 1 from jsonb_to_recordset(v_new_products) ep(slug text) join public.products p on p.slug=ep.slug join public.product_variants v on v.product_id=p.id
    where not exists(select 1 from jsonb_to_recordset(v_variants) ev(product_slug text,variant_key text) where ev.product_slug=p.slug and ev.variant_key=v.variant_key)
  ) then raise exception 'Batch F seed blocked: unexpected variant exists for new product'; end if;

  if exists (
    select 1 from jsonb_to_recordset(v_variants) e(product_slug text,variant_key text,display_name text,flavour_code text,flavour_label text,size_value numeric,size_unit text,pack_count integer,product_format text,is_default boolean,is_active boolean)
    join public.products p on p.slug=e.product_slug join public.product_variants v on v.product_id=p.id and v.variant_key=e.variant_key
    where v.display_name is distinct from e.display_name or v.flavour_code is distinct from e.flavour_code or v.flavour_label is distinct from e.flavour_label
       or v.size_value is distinct from e.size_value or v.size_unit is distinct from e.size_unit or v.pack_count is distinct from e.pack_count
       or v.product_format is distinct from e.product_format or v.is_default is distinct from e.is_default or v.is_active is distinct from true
       or v.gtin is not null or v.image is not null or v.nutrition_override is distinct from '{}'::jsonb
  ) then raise exception 'Batch F seed blocked: expected variant key has drifted identity'; end if;

  if exists (
    select 1 from jsonb_to_recordset(v_variants) e(product_slug text,variant_key text,flavour_code text,size_value numeric,size_unit text,is_default boolean)
    join public.products p on p.slug=e.product_slug join public.product_variants v on v.product_id=p.id and v.variant_key<>e.variant_key
    where not e.is_default and not v.is_default and lower(coalesce(v.flavour_code,''))=lower(coalesce(e.flavour_code,''))
      and v.size_value is not distinct from e.size_value and v.size_unit is not distinct from e.size_unit
  ) then raise exception 'Batch F seed blocked: semantic variant collision'; end if;

  select count(*) into v_missing_variants from jsonb_to_recordset(v_variants) e(product_slug text,variant_key text)
  join public.products p on p.slug=e.product_slug where not exists(select 1 from public.product_variants v where v.product_id=p.id and v.variant_key=e.variant_key);
  insert into public.product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active)
  select p.id,e.variant_key,e.display_name,e.flavour_code,e.flavour_label,e.size_value,e.size_unit,e.pack_count,e.product_format,null,null,'{}'::jsonb,e.is_default,true
  from jsonb_to_recordset(v_variants) e(product_slug text,variant_key text,display_name text,flavour_code text,flavour_label text,size_value numeric,size_unit text,pack_count integer,product_format text,is_default boolean)
  join public.products p on p.slug=e.product_slug where not exists(select 1 from public.product_variants v where v.product_id=p.id and v.variant_key=e.variant_key)
  order by e.product_slug,e.variant_key;
  get diagnostics v_inserted_variants=row_count;
  if v_inserted_variants<>v_missing_variants then raise exception 'Batch F seed failed: variant insert count mismatch'; end if;

  update public.products p set image=e.image from jsonb_to_recordset(v_images) e(product_id bigint,image text)
  where p.id=e.product_id and nullif(btrim(p.image),'') is null;
  get diagnostics v_updated_images=row_count;

  select count(*) into v_products_after from public.products; select count(*) into v_variants_after from public.product_variants;
  select count(*) into v_mappings_after from public.retailer_products; select count(*) into v_offers_after from public.offers; select count(*) into v_history_after from public.price_history;
  if v_products_after<>v_products_before+v_inserted_products or v_variants_after<>v_variants_before+v_inserted_variants
     or v_mappings_after<>v_mappings_before or v_offers_after<>v_offers_before or v_history_after<>v_history_before
     or v_updated_images<0 or v_updated_images>12 then raise exception 'Batch F seed failed: unexpected global table delta'; end if;

  if (select count(*) from jsonb_to_recordset(v_images) e(product_id bigint,image text) join public.products p on p.id=e.product_id where p.image=e.image)<>12
     or exists (
       select 1 from (select slug from jsonb_to_recordset(v_new_products) x(slug text) union all select slug from jsonb_to_recordset(v_existing_products) x(slug text)) e
       join public.products p on p.slug=e.slug left join lateral(select count(*) filter(where is_default and is_active) defaults from public.product_variants where product_id=p.id)c on true where c.defaults<>1
     )
     or (select count(*) from public.product_variants v join public.products p on p.id=v.product_id join jsonb_to_recordset(v_variants) e(product_slug text,variant_key text) on e.product_slug=p.slug and e.variant_key=v.variant_key)<>47
  then raise exception 'Batch F seed failed: final inventory, images, or default relation invalid'; end if;
end;
$seed_fit_house_batch_f$;

commit;
