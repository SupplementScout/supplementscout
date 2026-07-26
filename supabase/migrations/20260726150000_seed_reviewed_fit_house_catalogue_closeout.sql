begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

lock table public.products, public.product_variants, public.retailer_products, public.offers, public.price_history in share row exclusive mode;

do $fit_house_closeout$
declare
  v_manifest_sha256 constant text := '9c0e7c4335ac0c0ee3d3628175812a286eab4af46c25d458596a1b476ba85240';
  v_new_products constant jsonb := $fit_house_new_products$
[
  {
    "name": "7Nutrition Dextrose Gold 1000g",
    "slug": "7nutrition-dextrose-gold-1000g",
    "brand": "7Nutrition",
    "category": "Health Supplements",
    "net_weight_g": 1000,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Dextrose_Orange.jpg?v=1715868798",
    "is_active": true
  },
  {
    "name": "7Nutrition L-Glutathione 90 Capsules",
    "slug": "7nutrition-l-glutathione-90-capsules",
    "brand": "7Nutrition",
    "category": "Amino Acids",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_44.jpg?v=1684500522",
    "is_active": true
  },
  {
    "name": "7Nutrition Melatonin 1mg 60 Capsules",
    "slug": "7nutrition-melatonin-1mg-60-capsules",
    "brand": "7Nutrition",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_76.jpg?v=1688397543",
    "is_active": true
  },
  {
    "name": "7Nutrition Shilajit Mumio 120 Capsules",
    "slug": "7nutrition-shilajit-mumio-120-capsules",
    "brand": "7Nutrition",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/products/Untitleddesign_5_3bd66b43-71b8-45b1-aa77-6017039a0923.jpg?v=1666362581",
    "is_active": true
  },
  {
    "name": "7Nutrition Volcano 150 Capsules",
    "slug": "7nutrition-volcano-150-capsules",
    "brand": "7Nutrition",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_3_23d13ac0-2ada-418d-92b3-d2d3c5e7ea18.jpg?v=1715865852",
    "is_active": true
  },
  {
    "name": "7Nutrition Whey Isolate 90 500g",
    "slug": "7nutrition-whey-isolate-90-500g",
    "brand": "7Nutrition",
    "category": "Whey Protein",
    "net_weight_g": 500,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_75.jpg?v=1688392617",
    "is_active": true
  },
  {
    "name": "7Nutrition Zinc Citrate 100 Capsules",
    "slug": "7nutrition-zinc-citrate-100-capsules",
    "brand": "7Nutrition",
    "category": "Vitamins",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/products/Untitleddesign_3_edb1e2c2-f481-4782-9686-c3d22ff460be.jpg?v=1666350099",
    "is_active": true
  },
  {
    "name": "Animal Flex 44 packs",
    "slug": "animal-flex-44-packs",
    "brand": "Animal",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "pack",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_650f744b-ba45-462a-a74a-af1f8876c3d0.jpg?v=1779877511",
    "is_active": true
  },
  {
    "name": "Applied Nutrition ABE 30 servings",
    "slug": "applied-nutrition-abe-30-servings",
    "brand": "Applied Nutrition",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 30,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/1_029e0f49-4dbc-485d-8a48-0e4e7e69b3b0.jpg?v=1756988877",
    "is_active": true
  },
  {
    "name": "Barebells Protein Bar 55g",
    "slug": "barebells-protein-bar-55g",
    "brand": "Barebells",
    "category": "Protein Bars",
    "net_weight_g": 55,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "bar",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/5_NUTRITIONCREA-TEN-LEGENDARYSERIESCreatineisusuallyoneofthefirstsupplementsanathletewilltry.Infact_it_ssopopularit_sacornerstoneproductinthesupplementarsenalofmanyadvanc_16.jpg?v=1684932912",
    "is_active": true
  },
  {
    "name": "Black Magic BZRK Pre-Workout 25 Servings",
    "slug": "black-magic-bzrk-pre-workout-25-servings",
    "brand": "Black Magic",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 25,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/bzrkpeach.jpg?v=1733756549",
    "is_active": true
  },
  {
    "name": "Brain Gains Switch On 225g Nootropic Day-time Formula",
    "slug": "brain-gains-switch-on-225g-nootropic-day-time-formula",
    "brand": "Brain Gains",
    "category": "Health Supplements",
    "net_weight_g": 225,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/braingains.jpg?v=1740409781",
    "is_active": true
  },
  {
    "name": "Cellucor C4 Original – Energy, Focus & Performance Pre-Workout 30 servings",
    "slug": "cellucor-c4-original-energy-focus-and-performance-pre-workout-30-servings",
    "brand": "Cellucor",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 30,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/1_4f44c533-ebf9-4aae-86db-1cf5d8e42088.png?v=1754310913",
    "is_active": true
  },
  {
    "name": "Condemned Labz Arsynist 60 Capsules",
    "slug": "condemned-labz-arsynist-60-capsules",
    "brand": "Condemned Labz",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_1.jpg?v=1712757656",
    "is_active": true
  },
  {
    "name": "Doctor's Best Betaine HCL Pepsin & Gentian Bitters 120 Capsules",
    "slug": "doctor-s-best-betaine-hcl-pepsin-and-gentian-bitters-120-capsules",
    "brand": "Doctor's Best",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_11_9084a632-10bd-41aa-a55e-120e008287c1.jpg?v=1715272347",
    "is_active": true
  },
  {
    "name": "Doctor's Best L-Theanine AlphaWave 200mg 60 Capsules",
    "slug": "doctor-s-best-l-theanine-alphawave-200mg-60-capsules",
    "brand": "Doctor's Best",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/photo.jpg?v=1759769004",
    "is_active": true
  },
  {
    "name": "Doctor's Best Magnesium Lysinate Glycinate 240 tablets",
    "slug": "doctor-s-best-magnesium-lysinate-glycinate-240-tablets",
    "brand": "Doctor's Best",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "tablet",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_b9d7a6a6-9435-416f-8b7e-b71f39b23dac.jpg?v=1734697904",
    "is_active": true
  },
  {
    "name": "Fresh Out™ Pre-Workout by Fresh™ & Condemned Labz 25 servings",
    "slug": "fresh-out-pre-workout-by-fresh-and-condemned-labz-25-servings",
    "brand": "Fresh & Condemned Labz",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 25,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_5c1dd9c4-01dc-4917-b375-883d247d2bef.jpg?v=1733143014",
    "is_active": true
  },
  {
    "name": "Gym High CREA-4 Elite 60 servings",
    "slug": "gym-high-crea-4-elite-60-servings",
    "brand": "GYM HIGH",
    "category": "Creatine",
    "net_weight_g": null,
    "servings": 60,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign-2023-10-13T144627.816.jpg?v=1697205423",
    "is_active": true
  },
  {
    "name": "GYM HIGH Cream Of Rice 2.1kg",
    "slug": "gym-high-cream-of-rice-2-1kg",
    "brand": "GYM HIGH",
    "category": "Health Supplements",
    "net_weight_g": 2100,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_1_591ecfcc-4ff3-4373-aaac-4f99cbf13fdd.jpg?v=1759324754",
    "is_active": true
  },
  {
    "name": "HR Labs Defib v3 40/20 servings",
    "slug": "hr-labs-defib-v3-40-20-servings",
    "brand": "HR Labs",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign-2023-10-07T113557.299.jpg?v=1696675213",
    "is_active": true
  },
  {
    "name": "Jarrow Formulas Glutathione Reduced 500 mg 60 Capsules",
    "slug": "jarrow-formulas-glutathione-reduced-500-mg-60-capsules",
    "brand": "Jarrow",
    "category": "Amino Acids",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/glut.jpg?v=1737208276",
    "is_active": true
  },
  {
    "name": "Kilo Labs Stim Thug 20 servings",
    "slug": "kilo-labs-stim-thug-20-servings",
    "brand": "Kilo Labs",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 20,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_29_d34c401c-dc4e-4a10-8089-c8419758e42e.jpg?v=1683210532",
    "is_active": true
  },
  {
    "name": "Kilo Labs Supreme Pre‑Workout 20 servings Peach Rings Flavour",
    "slug": "kilo-labs-supreme-pre-workout-20-servings-peach-rings-flavour",
    "brand": "Kilo Labs",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 20,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/supremepre.png?v=1754306574",
    "is_active": true
  },
  {
    "name": "Kilo Labs Thiquid 25 servings",
    "slug": "kilo-labs-thiquid-25-servings",
    "brand": "Kilo Labs",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 25,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign-2024-01-17T141956.280.jpg?v=1705501556",
    "is_active": true
  },
  {
    "name": "Luna Pharm Exhale After Party Mix 30 Capsules",
    "slug": "luna-pharm-exhale-after-party-mix-30-capsules",
    "brand": "Luna Pharm",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_0e900112-5640-4801-99db-399629078685.jpg?v=1724490486",
    "is_active": true
  },
  {
    "name": "Luna Pharm Probiotic 60 Capsules",
    "slug": "luna-pharm-probiotic-60-capsules",
    "brand": "Luna Pharm",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_1_afe24184-ad7c-4246-8693-3e67d67a11ee.jpg?v=1724490730",
    "is_active": true
  },
  {
    "name": "MetaHuman Elite Vitamins 120 Capsules",
    "slug": "metahuman-elite-vitamins-120-capsules",
    "brand": "MetaHuman",
    "category": "Vitamins",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/products/vitamins.jpg?v=1665831796",
    "is_active": true
  },
  {
    "name": "Naughty Boy Hydration – Advanced Electrolyte Support 30 or 60 servings",
    "slug": "naughty-boy-hydration-advanced-electrolyte-support-30-or-60-servings",
    "brand": "Naughty Boy",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/1_e9d9df12-1661-4a03-9928-f34a94d0c2c3.png?v=1753803224",
    "is_active": true
  },
  {
    "name": "Neutonic Nootropic Focus Blend Powder Sachets 16 Servings",
    "slug": "neutonic-nootropic-focus-blend-powder-sachets-16-servings",
    "brand": "Neutonic",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": 16,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitled_design_13.png?v=1780414214",
    "is_active": true
  },
  {
    "name": "NMP Nutraceuticals Liberty Swell 25 servings",
    "slug": "nmp-nutraceuticals-liberty-swell-25-servings",
    "brand": "NMP Nutraceuticals",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": 25,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_28.png?v=1779206560",
    "is_active": true
  },
  {
    "name": "NMP Nutraceuticals Presidential Pre 50/25 Servings",
    "slug": "nmp-nutraceuticals-presidential-pre-50-25-servings",
    "brand": "NMP Nutraceuticals",
    "category": "Pre Workout",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign-2024-01-17T163635.282.jpg?v=1705509721",
    "is_active": true
  },
  {
    "name": "Nordic Labs Kanna Relief 60 Capsules",
    "slug": "nordic-labs-kanna-relief-60-capsules",
    "brand": "Nordic Labs",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_58.jpg?v=1686221641",
    "is_active": true
  },
  {
    "name": "Nordic Labs Long Jack Tongkat Ali 60 Capsules",
    "slug": "nordic-labs-long-jack-tongkat-ali-60-capsules",
    "brand": "Nordic Labs",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_57.jpg?v=1686221153",
    "is_active": true
  },
  {
    "name": "Nordic Labs TestX Pro Turkesterone 60 Capsules",
    "slug": "nordic-labs-testx-pro-turkesterone-60-capsules",
    "brand": "Nordic Labs",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign-2024-02-09T161032.164.jpg?v=1707495621",
    "is_active": true
  },
  {
    "name": "Olimp Whey Protein Complex 100% 1800–2270g",
    "slug": "olimp-whey-protein-complex-100-1800-2270g",
    "brand": "Olimp",
    "category": "Whey Protein",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/products/Untitleddesign_2.jpg?v=1666015306",
    "is_active": true
  },
  {
    "name": "Organic Sea Moss 90 Capsules",
    "slug": "organic-sea-moss-90-capsules",
    "brand": "KIKI Health",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/seamoss.jpg?v=1731938633",
    "is_active": true
  },
  {
    "name": "Osavi Advanced Marine Collagen 30 servings 360g",
    "slug": "osavi-advanced-marine-collagen-30-servings-360g",
    "brand": "Osavi",
    "category": "Health Supplements",
    "net_weight_g": 360,
    "servings": 30,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/2_1895b373-8e68-4791-a04c-cdd1af914bab.png?v=1741607825",
    "is_active": true
  },
  {
    "name": "Osavi Chromium 250 Capsules",
    "slug": "osavi-chromium-250-capsules",
    "brand": "Osavi",
    "category": "Vitamins",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_9_9a7d480e-e25a-49e8-b480-0d945c212c06.jpg?v=1759355765",
    "is_active": true
  },
  {
    "name": "Osavi Cod Liver Oil + D3 250 ml Lemon Flavour (Omega 3)",
    "slug": "osavi-cod-liver-oil-d3-250-ml-lemon-flavour-omega-3",
    "brand": "Osavi",
    "category": "Vitamins",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": 250,
    "product_format": "liquid",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/codliveroil.jpg?v=1682940738",
    "is_active": true
  },
  {
    "name": "Osavi Collagen & Electrolytes 30 Servings",
    "slug": "osavi-collagen-and-electrolytes-30-servings",
    "brand": "Osavi",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": 30,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_1_dfd89a89-96fa-4e5a-8a91-93584381f093.jpg?v=1779727641",
    "is_active": true
  },
  {
    "name": "Osavi Colostrum Immuno 800 mg 60 Capsules",
    "slug": "osavi-colostrum-immuno-800-mg-60-capsules",
    "brand": "Osavi",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_2_5261cc5b-4dee-4c1f-be85-3a788a93012a.jpg?v=1782922051",
    "is_active": true
  },
  {
    "name": "Osavi Liposomal Vitamin C 100mg 60 Capsules",
    "slug": "osavi-liposomal-vitamin-c-100mg-60-capsules",
    "brand": "Osavi",
    "category": "Vitamins",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_1_112d95fc-4a73-4962-9dba-edae2c3f67da.jpg?v=1727886855",
    "is_active": true
  },
  {
    "name": "Osavi Tribulus Terrestris Saponins 200mg 180 Capsules",
    "slug": "osavi-tribulus-terrestris-saponins-200mg-180-capsules",
    "brand": "Osavi",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Tribulus.jpg?v=1731940529",
    "is_active": true
  },
  {
    "name": "Osavi Vitamin D3 + K2, 2000 IU + 100 μg 60 Capsules",
    "slug": "osavi-vitamin-d3-k2-2000-iu-100-g-60-capsules",
    "brand": "Osavi",
    "category": "Vitamins",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_e842af10-7725-4933-8e46-cbd1bb3a8bc0.jpg?v=1782921719",
    "is_active": true
  },
  {
    "name": "Osavi Zinc+Copper 60 Capsules",
    "slug": "osavi-zinc-copper-60-capsules",
    "brand": "Osavi",
    "category": "Vitamins",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_77c3dcac-5527-42a2-81a3-efd1c57d6b6e.jpg?v=1782924612",
    "is_active": true
  },
  {
    "name": "Per4m Whey Advanced Protein 2010g",
    "slug": "per4m-whey-advanced-protein-2010g",
    "brand": "Per4m",
    "category": "Whey Protein",
    "net_weight_g": 2010,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign-2023-10-06T141428.795.jpg?v=1696599330",
    "is_active": true
  },
  {
    "name": "Soma ATP 30 Capsules",
    "slug": "soma-atp-30-capsules",
    "brand": "Soma",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_2_846710b0-5437-4dcc-81b7-4a186bf7a018.jpg?v=1756994964",
    "is_active": true
  },
  {
    "name": "Soma D3 4000 IU + K2 1000 ug 100 Tablets",
    "slug": "soma-d3-4000-iu-k2-1000-ug-100-tablets",
    "brand": "Soma",
    "category": "Vitamins",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "tablet",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_cf10f614-b8e7-4e64-bd9d-0358478c5887.jpg?v=1756996366",
    "is_active": true
  },
  {
    "name": "Soma Magnesium Glycinate – 90 Capsules",
    "slug": "soma-magnesium-glycinate-90-capsules",
    "brand": "Soma",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_1_3f371a60-e29d-42e6-9206-3b104b92414e.jpg?v=1756997890",
    "is_active": true
  },
  {
    "name": "Soma Melatonin 4 mg - 100 Tablets",
    "slug": "soma-melatonin-4-mg-100-tablets",
    "brand": "Soma",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "tablet",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_1_e023d62a-9ab3-4073-b5d8-a99b5d093939.jpg?v=1756994062",
    "is_active": true
  },
  {
    "name": "Soma Methyl B-Complex – 30 Capsules",
    "slug": "soma-methyl-b-complex-30-capsules",
    "brand": "Soma",
    "category": "Vitamins",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_f540dc8f-9a5b-4fca-9144-2018f7f13f13.jpg?v=1756997287",
    "is_active": true
  },
  {
    "name": "Swanson Argentinian Desiccated Beef Liver 500 mg 120 Capsules",
    "slug": "swanson-argentinian-desiccated-beef-liver-500-mg-120-capsules",
    "brand": "Swanson",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_1_c348fe46-d655-4276-bf62-b0e4c5bf120c.jpg?v=1722886883",
    "is_active": true
  },
  {
    "name": "Swanson Collagen Peptides Unflavoured 28 Servings",
    "slug": "swanson-collagen-peptides-unflavoured-28-servings",
    "brand": "Swanson",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": 28,
    "net_volume_ml": null,
    "product_format": "powder",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign_b8b979ca-355f-401f-bdc0-6c384674c73d.jpg?v=1722886019",
    "is_active": true
  },
  {
    "name": "Swanson Curcumin Complex 120 Capsules",
    "slug": "swanson-curcumin-complex-120-capsules",
    "brand": "Swanson",
    "category": "Health Supplements",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/curcuminsw.png?v=1739017122",
    "is_active": true
  },
  {
    "name": "Swanson P-5-P Double Strength 40 mg 60 Capsules",
    "slug": "swanson-p-5-p-double-strength-40-mg-60-capsules",
    "brand": "Swanson",
    "category": "Vitamins",
    "net_weight_g": null,
    "servings": null,
    "net_volume_ml": null,
    "product_format": "capsule",
    "image": "https://cdn.shopify.com/s/files/1/0661/8202/1360/files/Untitleddesign-2024-03-08T145525.337.jpg?v=1709910228",
    "is_active": true
  }
]
  $fit_house_new_products$::jsonb;
  v_variants constant jsonb := $fit_house_new_variants$
[
  {
    "product_slug": "7nutrition-dextrose-gold-1000g",
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
    "product_slug": "7nutrition-dextrose-gold-1000g",
    "variant_key": "green-apple-1000g",
    "display_name": "Green Apple / 1000g",
    "flavour_code": "green-apple",
    "flavour_label": "Green Apple",
    "size_value": 1000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "7nutrition-dextrose-gold-1000g",
    "variant_key": "orange-1000g",
    "display_name": "Orange / 1000g",
    "flavour_code": "orange",
    "flavour_label": "Orange",
    "size_value": 1000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "7nutrition-l-glutathione-90-capsules",
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
    "product_slug": "7nutrition-melatonin-1mg-60-capsules",
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
    "product_slug": "7nutrition-shilajit-mumio-120-capsules",
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
    "product_slug": "7nutrition-volcano-150-capsules",
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
    "product_slug": "7nutrition-whey-isolate-90-500g",
    "variant_key": "chocolate-500g",
    "display_name": "Chocolate / 500g",
    "flavour_code": "chocolate",
    "flavour_label": "Chocolate",
    "size_value": 500,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "7nutrition-whey-isolate-90-500g",
    "variant_key": "cookies-and-cream-500g",
    "display_name": "Cookies & Cream / 500g",
    "flavour_code": "cookies-and-cream",
    "flavour_label": "Cookies & Cream",
    "size_value": 500,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "7nutrition-whey-isolate-90-500g",
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
    "product_slug": "7nutrition-whey-isolate-90-500g",
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
    "product_slug": "7nutrition-whey-isolate-90-500g",
    "variant_key": "strawberry-500g",
    "display_name": "Strawberry / 500g",
    "flavour_code": "strawberry",
    "flavour_label": "Strawberry",
    "size_value": 500,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "7nutrition-whey-isolate-90-500g",
    "variant_key": "white-chocolate-500g",
    "display_name": "White Chocolate / 500g",
    "flavour_code": "white-chocolate",
    "flavour_label": "White Chocolate",
    "size_value": 500,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "7nutrition-zinc-citrate-100-capsules",
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
    "product_slug": "animal-flex-44-packs",
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
    "product_slug": "applied-nutrition-abe-30-servings",
    "variant_key": "baddy-berry-30servings",
    "display_name": "Baddy Berry / 30servings",
    "flavour_code": "baddy-berry",
    "flavour_label": "Baddy Berry",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-abe-30-servings",
    "variant_key": "cherry-cola-30servings",
    "display_name": "Cherry Cola / 30servings",
    "flavour_code": "cherry-cola",
    "flavour_label": "Cherry Cola",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-abe-30-servings",
    "variant_key": "cool-watermelon-30servings",
    "display_name": "Cool Watermelon / 30servings",
    "flavour_code": "cool-watermelon",
    "flavour_label": "Cool Watermelon",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "applied-nutrition-abe-30-servings",
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
    "product_slug": "barebells-protein-bar-55g",
    "variant_key": "banana-dream-55g",
    "display_name": "Banana Dream / 55g",
    "flavour_code": "banana-dream",
    "flavour_label": "Banana Dream",
    "size_value": 55,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "bar",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "barebells-protein-bar-55g",
    "variant_key": "caramel-choco-55g",
    "display_name": "Caramel Choco / 55g",
    "flavour_code": "caramel-choco",
    "flavour_label": "Caramel Choco",
    "size_value": 55,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "bar",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "barebells-protein-bar-55g",
    "variant_key": "coco-choco-55g",
    "display_name": "Coco Choco / 55g",
    "flavour_code": "coco-choco",
    "flavour_label": "Coco Choco",
    "size_value": 55,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "bar",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "barebells-protein-bar-55g",
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
    "product_slug": "barebells-protein-bar-55g",
    "variant_key": "peanut-caramel-55g",
    "display_name": "Peanut Caramel / 55g",
    "flavour_code": "peanut-caramel",
    "flavour_label": "Peanut Caramel",
    "size_value": 55,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "bar",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "black-magic-bzrk-pre-workout-25-servings",
    "variant_key": "cherry-lime-25servings",
    "display_name": "Cherry Lime / 25servings",
    "flavour_code": "cherry-lime",
    "flavour_label": "Cherry Lime",
    "size_value": 25,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "black-magic-bzrk-pre-workout-25-servings",
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
    "product_slug": "black-magic-bzrk-pre-workout-25-servings",
    "variant_key": "peach-rings-25servings",
    "display_name": "Peach Rings / 25servings",
    "flavour_code": "peach-rings",
    "flavour_label": "Peach Rings",
    "size_value": 25,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "brain-gains-switch-on-225g-nootropic-day-time-formula",
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
    "product_slug": "brain-gains-switch-on-225g-nootropic-day-time-formula",
    "variant_key": "miami-peach-225g",
    "display_name": "Miami Peach / 225g",
    "flavour_code": "miami-peach",
    "flavour_label": "Miami Peach",
    "size_value": 225,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "cellucor-c4-original-energy-focus-and-performance-pre-workout-30-servings",
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
    "product_slug": "cellucor-c4-original-energy-focus-and-performance-pre-workout-30-servings",
    "variant_key": "millions-cola-30servings",
    "display_name": "Millions Cola / 30servings",
    "flavour_code": "millions-cola",
    "flavour_label": "Millions Cola",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "cellucor-c4-original-energy-focus-and-performance-pre-workout-30-servings",
    "variant_key": "sour-batch-bros-30servings",
    "display_name": "Sour Batch Bros / 30servings",
    "flavour_code": "sour-batch-bros",
    "flavour_label": "Sour Batch Bros",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "condemned-labz-arsynist-60-capsules",
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
    "product_slug": "doctor-s-best-betaine-hcl-pepsin-and-gentian-bitters-120-capsules",
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
    "product_slug": "doctor-s-best-l-theanine-alphawave-200mg-60-capsules",
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
    "product_slug": "doctor-s-best-magnesium-lysinate-glycinate-240-tablets",
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
    "product_slug": "fresh-out-pre-workout-by-fresh-and-condemned-labz-25-servings",
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
    "product_slug": "gym-high-crea-4-elite-60-servings",
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
    "product_slug": "gym-high-cream-of-rice-2-1kg",
    "variant_key": "blueberry-2100g",
    "display_name": "Blueberry / 2100g",
    "flavour_code": "blueberry",
    "flavour_label": "Blueberry",
    "size_value": 2100,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "gym-high-cream-of-rice-2-1kg",
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
    "product_slug": "gym-high-cream-of-rice-2-1kg",
    "variant_key": "maple-syrup-2100g",
    "display_name": "Maple Syrup / 2100g",
    "flavour_code": "maple-syrup",
    "flavour_label": "Maple Syrup",
    "size_value": 2100,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "hr-labs-defib-v3-40-20-servings",
    "variant_key": "cherryade",
    "display_name": "Cherryade",
    "flavour_code": "cherryade",
    "flavour_label": "Cherryade",
    "size_value": null,
    "size_unit": null,
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "hr-labs-defib-v3-40-20-servings",
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
    "product_slug": "hr-labs-defib-v3-40-20-servings",
    "variant_key": "iced-blue-slush",
    "display_name": "Iced Blue Slush",
    "flavour_code": "iced-blue-slush",
    "flavour_label": "Iced Blue Slush",
    "size_value": null,
    "size_unit": null,
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "hr-labs-defib-v3-40-20-servings",
    "variant_key": "jelly-bean",
    "display_name": "Jelly Bean",
    "flavour_code": "jelly-bean",
    "flavour_label": "Jelly Bean",
    "size_value": null,
    "size_unit": null,
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "jarrow-formulas-glutathione-reduced-500-mg-60-capsules",
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
    "product_slug": "kilo-labs-stim-thug-20-servings",
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
    "product_slug": "kilo-labs-stim-thug-20-servings",
    "variant_key": "it-was-all-a-dream-20servings",
    "display_name": "It Was All A Dream / 20servings",
    "flavour_code": "it-was-all-a-dream",
    "flavour_label": "It Was All A Dream",
    "size_value": 20,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "kilo-labs-stim-thug-20-servings",
    "variant_key": "mother-pucker-20servings",
    "display_name": "Mother Pucker / 20servings",
    "flavour_code": "mother-pucker",
    "flavour_label": "Mother Pucker",
    "size_value": 20,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "kilo-labs-stim-thug-20-servings",
    "variant_key": "slay-my-name-dragonfruit-20servings",
    "display_name": "Slay My Name - Dragonfruit / 20servings",
    "flavour_code": "slay-my-name-dragonfruit",
    "flavour_label": "Slay My Name - Dragonfruit",
    "size_value": 20,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "kilo-labs-stim-thug-20-servings",
    "variant_key": "still-sippin-watermelon-and-peach-20servings",
    "display_name": "Still Sippin - Watermelon & Peach / 20servings",
    "flavour_code": "still-sippin-watermelon-and-peach",
    "flavour_label": "Still Sippin - Watermelon & Peach",
    "size_value": 20,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "kilo-labs-stim-thug-20-servings",
    "variant_key": "strawberry-lemonade-20servings",
    "display_name": "Strawberry Lemonade / 20servings",
    "flavour_code": "strawberry-lemonade",
    "flavour_label": "Strawberry Lemonade",
    "size_value": 20,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "kilo-labs-supreme-pre-workout-20-servings-peach-rings-flavour",
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
    "product_slug": "kilo-labs-thiquid-25-servings",
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
    "product_slug": "luna-pharm-exhale-after-party-mix-30-capsules",
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
    "product_slug": "luna-pharm-probiotic-60-capsules",
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
    "product_slug": "metahuman-elite-vitamins-120-capsules",
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
    "product_slug": "naughty-boy-hydration-advanced-electrolyte-support-30-or-60-servings",
    "variant_key": "blueberry-pineapple-60servings",
    "display_name": "Blueberry Pineapple / 60servings",
    "flavour_code": "blueberry-pineapple",
    "flavour_label": "Blueberry Pineapple",
    "size_value": 60,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "naughty-boy-hydration-advanced-electrolyte-support-30-or-60-servings",
    "variant_key": "cherry-mango-60servings",
    "display_name": "Cherry Mango / 60servings",
    "flavour_code": "cherry-mango",
    "flavour_label": "Cherry Mango",
    "size_value": 60,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "naughty-boy-hydration-advanced-electrolyte-support-30-or-60-servings",
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
    "product_slug": "naughty-boy-hydration-advanced-electrolyte-support-30-or-60-servings",
    "variant_key": "pink-lemonade-60servings",
    "display_name": "Pink Lemonade / 60servings",
    "flavour_code": "pink-lemonade",
    "flavour_label": "Pink Lemonade",
    "size_value": 60,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "naughty-boy-hydration-advanced-electrolyte-support-30-or-60-servings",
    "variant_key": "strawberry-kiwi-30servings",
    "display_name": "Strawberry Kiwi / 30servings",
    "flavour_code": "strawberry-kiwi",
    "flavour_label": "Strawberry Kiwi",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "naughty-boy-hydration-advanced-electrolyte-support-30-or-60-servings",
    "variant_key": "summer-fruits-30servings",
    "display_name": "Summer Fruits / 30servings",
    "flavour_code": "summer-fruits",
    "flavour_label": "Summer Fruits",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "neutonic-nootropic-focus-blend-powder-sachets-16-servings",
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
    "product_slug": "neutonic-nootropic-focus-blend-powder-sachets-16-servings",
    "variant_key": "peach-mango-16servings",
    "display_name": "Peach Mango / 16servings",
    "flavour_code": "peach-mango",
    "flavour_label": "Peach Mango",
    "size_value": 16,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "neutonic-nootropic-focus-blend-powder-sachets-16-servings",
    "variant_key": "wild-berry-16servings",
    "display_name": "Wild Berry / 16servings",
    "flavour_code": "wild-berry",
    "flavour_label": "Wild Berry",
    "size_value": 16,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "nmp-nutraceuticals-liberty-swell-25-servings",
    "variant_key": "apple-25servings",
    "display_name": "Apple / 25servings",
    "flavour_code": "apple",
    "flavour_label": "Apple",
    "size_value": 25,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "nmp-nutraceuticals-liberty-swell-25-servings",
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
    "product_slug": "nmp-nutraceuticals-liberty-swell-25-servings",
    "variant_key": "grape-25servings",
    "display_name": "Grape / 25servings",
    "flavour_code": "grape",
    "flavour_label": "Grape",
    "size_value": 25,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "nmp-nutraceuticals-presidential-pre-50-25-servings",
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
    "product_slug": "nmp-nutraceuticals-presidential-pre-50-25-servings",
    "variant_key": "kiwi-kennedy-s-kiwi",
    "display_name": "Kiwi (Kennedy's Kiwi)",
    "flavour_code": "kiwi-kennedy-s-kiwi",
    "flavour_label": "Kiwi (Kennedy's Kiwi)",
    "size_value": null,
    "size_unit": null,
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "nmp-nutraceuticals-presidential-pre-50-25-servings",
    "variant_key": "orange-creamsicle-trump-s-taning-lotion",
    "display_name": "Orange Creamsicle (Trump's Taning Lotion)",
    "flavour_code": "orange-creamsicle-trump-s-taning-lotion",
    "flavour_label": "Orange Creamsicle (Trump's Taning Lotion)",
    "size_value": null,
    "size_unit": null,
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "nordic-labs-kanna-relief-60-capsules",
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
    "product_slug": "nordic-labs-long-jack-tongkat-ali-60-capsules",
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
    "product_slug": "nordic-labs-testx-pro-turkesterone-60-capsules",
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
    "product_slug": "olimp-whey-protein-complex-100-1800-2270g",
    "variant_key": "apple-pie-1800g",
    "display_name": "Apple Pie / 1800g",
    "flavour_code": "apple-pie",
    "flavour_label": "Apple Pie",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "olimp-whey-protein-complex-100-1800-2270g",
    "variant_key": "blueberry-1800g",
    "display_name": "Blueberry / 1800g",
    "flavour_code": "blueberry",
    "flavour_label": "Blueberry",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "olimp-whey-protein-complex-100-1800-2270g",
    "variant_key": "chocolate-1800g",
    "display_name": "Chocolate / 1800g",
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
    "product_slug": "olimp-whey-protein-complex-100-1800-2270g",
    "variant_key": "chocolate-2270g",
    "display_name": "Chocolate / 2270g",
    "flavour_code": "chocolate",
    "flavour_label": "Chocolate",
    "size_value": 2270,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "olimp-whey-protein-complex-100-1800-2270g",
    "variant_key": "chocolate-caramel-2270g",
    "display_name": "Chocolate Caramel / 2270g",
    "flavour_code": "chocolate-caramel",
    "flavour_label": "Chocolate Caramel",
    "size_value": 2270,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "olimp-whey-protein-complex-100-1800-2270g",
    "variant_key": "cookies-cream-2270g",
    "display_name": "Cookies Cream / 2270g",
    "flavour_code": "cookies-cream",
    "flavour_label": "Cookies Cream",
    "size_value": 2270,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "olimp-whey-protein-complex-100-1800-2270g",
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
    "product_slug": "olimp-whey-protein-complex-100-1800-2270g",
    "variant_key": "peanut-butter-1800g",
    "display_name": "Peanut Butter / 1800g",
    "flavour_code": "peanut-butter",
    "flavour_label": "Peanut Butter",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "olimp-whey-protein-complex-100-1800-2270g",
    "variant_key": "strawberry-1800g",
    "display_name": "Strawberry / 1800g",
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
    "product_slug": "olimp-whey-protein-complex-100-1800-2270g",
    "variant_key": "tiramisu-1800g",
    "display_name": "Tiramisu / 1800g",
    "flavour_code": "tiramisu",
    "flavour_label": "Tiramisu",
    "size_value": 1800,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "olimp-whey-protein-complex-100-1800-2270g",
    "variant_key": "vanilla-ice-cream-2270g",
    "display_name": "Vanilla Ice Cream / 2270g",
    "flavour_code": "vanilla-ice-cream",
    "flavour_label": "Vanilla Ice Cream",
    "size_value": 2270,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "organic-sea-moss-90-capsules",
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
    "product_slug": "osavi-advanced-marine-collagen-30-servings-360g",
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
    "product_slug": "osavi-advanced-marine-collagen-30-servings-360g",
    "variant_key": "grapefruit-360g",
    "display_name": "Grapefruit / 360g",
    "flavour_code": "grapefruit",
    "flavour_label": "Grapefruit",
    "size_value": 360,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "osavi-advanced-marine-collagen-30-servings-360g",
    "variant_key": "lemon-360g",
    "display_name": "Lemon / 360g",
    "flavour_code": "lemon",
    "flavour_label": "Lemon",
    "size_value": 360,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "osavi-chromium-250-capsules",
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
    "product_slug": "osavi-cod-liver-oil-d3-250-ml-lemon-flavour-omega-3",
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
    "product_slug": "osavi-collagen-and-electrolytes-30-servings",
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
    "product_slug": "osavi-collagen-and-electrolytes-30-servings",
    "variant_key": "pineapple-and-mango-30servings",
    "display_name": "pineapple & mango / 30servings",
    "flavour_code": "pineapple-and-mango",
    "flavour_label": "pineapple & mango",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "osavi-colostrum-immuno-800-mg-60-capsules",
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
    "product_slug": "osavi-liposomal-vitamin-c-100mg-60-capsules",
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
    "product_slug": "osavi-tribulus-terrestris-saponins-200mg-180-capsules",
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
    "product_slug": "osavi-vitamin-d3-k2-2000-iu-100-g-60-capsules",
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
    "product_slug": "osavi-zinc-copper-60-capsules",
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
    "product_slug": "per4m-whey-advanced-protein-2010g",
    "variant_key": "banana-creme-2010g",
    "display_name": "Banana Creme / 2010g",
    "flavour_code": "banana-creme",
    "flavour_label": "Banana Creme",
    "size_value": 2010,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-whey-advanced-protein-2010g",
    "variant_key": "carmel-biscuit-2010g",
    "display_name": "Carmel Biscuit / 2010g",
    "flavour_code": "carmel-biscuit",
    "flavour_label": "Carmel Biscuit",
    "size_value": 2010,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-whey-advanced-protein-2010g",
    "variant_key": "chocolate-brownie-batter-2010g",
    "display_name": "Chocolate Brownie Batter / 2010g",
    "flavour_code": "chocolate-brownie-batter",
    "flavour_label": "Chocolate Brownie Batter",
    "size_value": 2010,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-whey-advanced-protein-2010g",
    "variant_key": "chocotella-2010g",
    "display_name": "Chocotella / 2010g",
    "flavour_code": "chocotella",
    "flavour_label": "Chocotella",
    "size_value": 2010,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-whey-advanced-protein-2010g",
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
    "product_slug": "per4m-whey-advanced-protein-2010g",
    "variant_key": "jammy-biscuit-2010g",
    "display_name": "Jammy Biscuit / 2010g",
    "flavour_code": "jammy-biscuit",
    "flavour_label": "Jammy Biscuit",
    "size_value": 2010,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-whey-advanced-protein-2010g",
    "variant_key": "strawberry-creme-2010g",
    "display_name": "Strawberry Creme / 2010g",
    "flavour_code": "strawberry-creme",
    "flavour_label": "Strawberry Creme",
    "size_value": 2010,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-whey-advanced-protein-2010g",
    "variant_key": "vanilla-creme-2010g",
    "display_name": "Vanilla Creme / 2010g",
    "flavour_code": "vanilla-creme",
    "flavour_label": "Vanilla Creme",
    "size_value": 2010,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-whey-advanced-protein-2010g",
    "variant_key": "white-chocolate-hazelnut-2010g",
    "display_name": "White Chocolate Hazelnut / 2010g",
    "flavour_code": "white-chocolate-hazelnut",
    "flavour_label": "White Chocolate Hazelnut",
    "size_value": 2010,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "soma-atp-30-capsules",
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
    "product_slug": "soma-d3-4000-iu-k2-1000-ug-100-tablets",
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
    "product_slug": "soma-magnesium-glycinate-90-capsules",
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
    "product_slug": "soma-melatonin-4-mg-100-tablets",
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
    "product_slug": "soma-methyl-b-complex-30-capsules",
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
    "product_slug": "swanson-argentinian-desiccated-beef-liver-500-mg-120-capsules",
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
    "product_slug": "swanson-collagen-peptides-unflavoured-28-servings",
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
    "product_slug": "swanson-curcumin-complex-120-capsules",
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
    "product_slug": "swanson-p-5-p-double-strength-40-mg-60-capsules",
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
  }
]
  $fit_house_new_variants$::jsonb;
  v_existing_variant_creates constant jsonb := $fit_house_existing_variant_creates$
[
  {
    "id": null,
    "product_id": "756",
    "product_slug": "10x-athletic-pump-non-stim-pre-workout-50-servings",
    "variant_key": "cobra-ki-50servings",
    "display_name": "Cobra Ki / 50servings",
    "flavour_code": "cobra-ki",
    "flavour_label": "Cobra Ki",
    "size_value": 50,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "source_option_tuple": {
      "Flavours": "Cobra Ki"
    },
    "is_default": false,
    "is_active": true
  },
  {
    "id": null,
    "product_id": "68",
    "product_slug": "7nutrition-whey-isolate-90-1kg",
    "variant_key": "banana-1000g",
    "display_name": "Banana / 1000g",
    "flavour_code": "banana",
    "flavour_label": "Banana",
    "size_value": 1000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "source_option_tuple": {
      "Flavour": "Banana"
    },
    "is_default": false,
    "is_active": true
  },
  {
    "id": null,
    "product_id": "68",
    "product_slug": "7nutrition-whey-isolate-90-1kg",
    "variant_key": "belgian-chocolate-1000g",
    "display_name": "Belgian Chocolate / 1000g",
    "flavour_code": "belgian-chocolate",
    "flavour_label": "Belgian Chocolate",
    "size_value": 1000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "source_option_tuple": {
      "Flavour": "Belgian Chocolate"
    },
    "is_default": false,
    "is_active": true
  },
  {
    "id": null,
    "product_id": "224",
    "product_slug": "barebells-high-protein-milkshake-330ml",
    "variant_key": "banana-330ml",
    "display_name": "Banana / 330ml",
    "flavour_code": "banana",
    "flavour_label": "Banana",
    "size_value": 330,
    "size_unit": "ml",
    "pack_count": 1,
    "product_format": "liquid",
    "source_option_tuple": {
      "Flavor": "Banana"
    },
    "is_default": false,
    "is_active": true
  },
  {
    "id": null,
    "product_id": "771",
    "product_slug": "biotech-usa-100-pure-whey-454g",
    "variant_key": "cookies-and-cream-454g",
    "display_name": "Cookies & Cream / 454g",
    "flavour_code": "cookies-and-cream",
    "flavour_label": "Cookies & Cream",
    "size_value": 454,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "source_option_tuple": {
      "Flavor": "Cookies & Cream"
    },
    "is_default": false,
    "is_active": true
  },
  {
    "id": null,
    "product_id": "773",
    "product_slug": "condemned-labz-convict-v2-25-servings",
    "variant_key": "kiwi-strawberry-25servings",
    "display_name": "Kiwi Strawberry / 25servings",
    "flavour_code": "kiwi-strawberry",
    "flavour_label": "Kiwi Strawberry",
    "size_value": 25,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "source_option_tuple": {
      "flavour": "Kiwi Strawberry"
    },
    "is_default": false,
    "is_active": true
  },
  {
    "id": null,
    "product_id": "337",
    "product_slug": "gym-high-whey-pro-synergy-600g",
    "variant_key": "vanilla-600g",
    "display_name": "Vanilla / 600g",
    "flavour_code": "vanilla",
    "flavour_label": "Vanilla",
    "size_value": 600,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "source_option_tuple": {
      "Flavour": "Vanilla"
    },
    "is_default": false,
    "is_active": true
  },
  {
    "id": null,
    "product_id": "775",
    "product_slug": "innovapharm-mvpre-pre-workout-3-0-40-20-servings",
    "variant_key": "sweet-apple-punch-40servings",
    "display_name": "Sweet Apple Punch / 40servings",
    "flavour_code": "sweet-apple-punch",
    "flavour_label": "Sweet Apple Punch",
    "size_value": 40,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "source_option_tuple": {
      "Flavour": "Sweet Apple Punch"
    },
    "is_default": false,
    "is_active": true
  },
  {
    "id": null,
    "product_id": "517",
    "product_slug": "mutant-mass-mass-gainer-227kg",
    "variant_key": "cookies-and-cream-2270g",
    "display_name": "Cookies and Cream / 2270g",
    "flavour_code": "cookies-and-cream",
    "flavour_label": "Cookies and Cream",
    "size_value": 2270,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "source_option_tuple": {
      "flavour": "Cookies and Cream"
    },
    "is_default": false,
    "is_active": true
  },
  {
    "id": null,
    "product_id": "517",
    "product_slug": "mutant-mass-mass-gainer-227kg",
    "variant_key": "vanilla-ice-cream-2270g",
    "display_name": "Vanilla Ice Cream / 2270g",
    "flavour_code": "vanilla-ice-cream",
    "flavour_label": "Vanilla Ice Cream",
    "size_value": 2270,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "source_option_tuple": {
      "flavour": "Vanilla Ice Cream"
    },
    "is_default": false,
    "is_active": true
  },
  {
    "id": null,
    "product_id": "778",
    "product_slug": "naughty-boy-energy-pre-workout-30-servings",
    "variant_key": "strawberry-mango-30servings",
    "display_name": "Strawberry Mango / 30servings",
    "flavour_code": "strawberry-mango",
    "flavour_label": "Strawberry Mango",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "source_option_tuple": {
      "Flavour": "Strawberry Mango"
    },
    "is_default": false,
    "is_active": true
  },
  {
    "id": null,
    "product_id": "780",
    "product_slug": "ostrovit-creatine-monohydrate-1000g",
    "variant_key": "natural-1000g",
    "display_name": "Natural / 1000g",
    "flavour_code": "natural",
    "flavour_label": "Natural",
    "size_value": 1000,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "source_option_tuple": {
      "flavour": "Natural"
    },
    "is_default": false,
    "is_active": true
  },
  {
    "id": null,
    "product_id": "328",
    "product_slug": "per4m-isolate-zero-900g",
    "variant_key": "dubai-chocolate-900g",
    "display_name": "Dubai Chocolate / 900g",
    "flavour_code": "dubai-chocolate",
    "flavour_label": "Dubai Chocolate",
    "size_value": 900,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "source_option_tuple": {
      "flavour": "Dubai Chocolate"
    },
    "is_default": false,
    "is_active": true
  },
  {
    "id": null,
    "product_id": "328",
    "product_slug": "per4m-isolate-zero-900g",
    "variant_key": "strawberry-creme-900g",
    "display_name": "Strawberry Creme / 900g",
    "flavour_code": "strawberry-creme",
    "flavour_label": "Strawberry Creme",
    "size_value": 900,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "source_option_tuple": {
      "flavour": "Strawberry Creme"
    },
    "is_default": false,
    "is_active": true
  },
  {
    "id": null,
    "product_id": "783",
    "product_slug": "raw-nutrition-essential-bum-pre-workout-30-servings",
    "variant_key": "raspberry-creamthickle-30servings",
    "display_name": "Raspberry Creamthickle / 30servings",
    "flavour_code": "raspberry-creamthickle",
    "flavour_label": "Raspberry Creamthickle",
    "size_value": 30,
    "size_unit": "servings",
    "pack_count": 1,
    "product_format": "powder",
    "source_option_tuple": {
      "Flavour": "Raspberry Creamthickle"
    },
    "is_default": false,
    "is_active": true
  },
  {
    "id": null,
    "product_id": "785",
    "product_slug": "trec-crea-xtreme-180g",
    "variant_key": "tropical-180g",
    "display_name": "Tropical / 180g",
    "flavour_code": "tropical",
    "flavour_label": "Tropical",
    "size_value": 180,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "source_option_tuple": {
      "Flavour": "Tropical"
    },
    "is_default": false,
    "is_active": true
  }
]
  $fit_house_existing_variant_creates$::jsonb;
  v_existing_targets constant jsonb := $fit_house_existing_targets$
[
  {
    "id": "68",
    "name": "7Nutrition Whey Isolate 90 1kg",
    "slug": "7nutrition-whey-isolate-90-1kg",
    "brand": "7Nutrition",
    "category": "Whey Protein"
  },
  {
    "id": "165",
    "name": "Lenny & Larry's Complete Vegan Cookie  113g",
    "slug": "lenny--larrys-complete-vegan-cookie--113g",
    "brand": "Lenny & Larry",
    "category": "Protein Bars"
  },
  {
    "id": "224",
    "name": "Barebells High Protein Milkshake 330ml",
    "slug": "barebells-high-protein-milkshake-330ml",
    "brand": "Barebells",
    "category": "Protein Bars"
  },
  {
    "id": "328",
    "name": "Per4m Isolate Zero 900g",
    "slug": "per4m-isolate-zero-900g",
    "brand": "Per4m",
    "category": "Health Supplements"
  },
  {
    "id": "337",
    "name": "GYM HIGH Whey Pro Synergy 600g",
    "slug": "gym-high-whey-pro-synergy-600g",
    "brand": "GYM HIGH",
    "category": "Whey Protein"
  },
  {
    "id": "367",
    "name": "GYM HIGH The Stacker 240g",
    "slug": "gym-high-the-stacker-240g",
    "brand": "GYM HIGH",
    "category": "Health Supplements"
  },
  {
    "id": "371",
    "name": "Olimp Creatine Mega Caps 1250",
    "slug": "olimp-creatine-mega-caps-1250",
    "brand": "Olimp",
    "category": "Creatine"
  },
  {
    "id": "403",
    "name": "GYM HIGH Mass Gainer 2100g",
    "slug": "gym-high-mass-gainer-2100g",
    "brand": "GYM HIGH",
    "category": "Mass Gainer"
  },
  {
    "id": "421",
    "name": "5% Nutrition Rich Piana Core Series DIM 60 Capsules",
    "slug": "5-nutrition-rich-piana-core-series-dim-60-capsules",
    "brand": "5% Nutrition",
    "category": "Health Supplements"
  },
  {
    "id": "429",
    "name": "GYM HIGH Testo Pro 180 Capsules",
    "slug": "gym-high-testo-pro-180-capsules",
    "brand": "GYM HIGH",
    "category": "Health Supplements"
  },
  {
    "id": "517",
    "name": "Mutant Mass (Mass Gainer) 2.27kg",
    "slug": "mutant-mass-mass-gainer-227kg",
    "brand": "Mutant",
    "category": "Mass Gainer"
  },
  {
    "id": "521",
    "name": "Olimp Vita-Min Multiple Sport  60 Capsules",
    "slug": "olimp-vita-min-multiple-sport--60-capsules",
    "brand": "Olimp",
    "category": "Health Supplements"
  },
  {
    "id": "523",
    "name": "Olimp Ashwagandha 600 Sport 60 Capsules",
    "slug": "olimp-ashwagandha-600-sport-60-capsules",
    "brand": "Olimp",
    "category": "Health Supplements"
  },
  {
    "id": "756",
    "name": "10X Athletic PUMP Non-Stim Pre Workout 50 servings",
    "slug": "10x-athletic-pump-non-stim-pre-workout-50-servings",
    "brand": "10X Athletic",
    "category": "Pre Workout"
  },
  {
    "id": "771",
    "name": "BioTech USA 100% Pure Whey 454g",
    "slug": "biotech-usa-100-pure-whey-454g",
    "brand": "BioTech USA",
    "category": "Whey Protein"
  },
  {
    "id": "773",
    "name": "Condemned Labz Convict V2 25 servings",
    "slug": "condemned-labz-convict-v2-25-servings",
    "brand": "Condemned Labz",
    "category": "Pre Workout"
  },
  {
    "id": "775",
    "name": "Innovapharm MVPRE Pre-Workout 3.0 40/20 servings",
    "slug": "innovapharm-mvpre-pre-workout-3-0-40-20-servings",
    "brand": "Innovapharm",
    "category": "Pre Workout"
  },
  {
    "id": "778",
    "name": "Naughty Boy Energy Pre-Workout 30 servings",
    "slug": "naughty-boy-energy-pre-workout-30-servings",
    "brand": "Naughty Boy",
    "category": "Pre Workout"
  },
  {
    "id": "780",
    "name": "OstroVit Creatine Monohydrate 1000g",
    "slug": "ostrovit-creatine-monohydrate-1000g",
    "brand": "OstroVit",
    "category": "Creatine"
  },
  {
    "id": "783",
    "name": "RAW Nutrition Essential BUM Pre-Workout 30 servings",
    "slug": "raw-nutrition-essential-bum-pre-workout-30-servings",
    "brand": "RAW Nutrition",
    "category": "Pre Workout"
  },
  {
    "id": "785",
    "name": "Trec CREA XTREME 180g",
    "slug": "trec-crea-xtreme-180g",
    "brand": "Trec Nutrition",
    "category": "Health Supplements"
  }
]
  $fit_house_existing_targets$::jsonb;
  v_products_before bigint;
  v_variants_before bigint;
  v_mappings_before bigint;
  v_offers_before bigint;
  v_history_before bigint;
  v_products_after bigint;
  v_variants_after bigint;
  v_mappings_after bigint;
  v_offers_after bigint;
  v_history_after bigint;
  v_missing_products bigint;
  v_missing_variants bigint;
  v_inserted_products bigint;
  v_inserted_new_variants bigint;
  v_inserted_existing_variants bigint;
begin
  if v_manifest_sha256 <> '9c0e7c4335ac0c0ee3d3628175812a286eab4af46c25d458596a1b476ba85240'
     or jsonb_array_length(v_new_products) <> 56
     or jsonb_array_length(v_variants) <> 117
     or jsonb_array_length(v_existing_variant_creates) <> 16
     or jsonb_array_length(v_existing_targets) <> 21
     or (select count(*) from jsonb_array_elements(v_variants) e where (e->>'is_default')::boolean) <> 56
     or (select count(distinct e->>'slug') from jsonb_array_elements(v_new_products) e) <> 56
     or (select count(distinct (e->>'product_slug') || ':' || (e->>'variant_key')) from jsonb_array_elements(v_variants) e) <> 117
  then
    raise exception 'Fit House closeout blocked: immutable manifest contract is invalid';
  end if;

  if not exists (
    select 1 from public.retailers where id = 9 and slug = 'fit-house' and name = 'Fit House'
  ) then
    raise exception 'Fit House closeout blocked: retailer identity drift';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_existing_targets)
      e(id bigint, name text, slug text, brand text, category text)
    left join public.products p on p.id = e.id
    where p.id is null
       or p.name is distinct from e.name
       or p.slug is distinct from e.slug
       or p.brand is distinct from e.brand
       or p.category is distinct from e.category
       or p.is_active is distinct from true
       or p.merged_into_product_id is not null
       or p.merged_at is not null
  ) then
    raise exception 'Fit House closeout blocked: existing canonical target drift';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_new_products)
      e(name text, slug text, brand text, category text, net_weight_g numeric,
        servings integer, net_volume_ml numeric, product_format text, image text,
        is_active boolean)
    join public.products p on p.slug = e.slug
    where p.name is distinct from e.name
       or p.brand is distinct from e.brand
       or p.category is distinct from e.category
       or p.net_weight_g is distinct from e.net_weight_g
       or p.servings is distinct from e.servings
       or p.net_volume_ml is distinct from e.net_volume_ml
       or p.product_format is distinct from e.product_format
       or p.image is distinct from e.image
       or p.is_active is distinct from true
       or p.price is not null
       or p.merged_into_product_id is not null
       or p.merged_at is not null
  ) then
    raise exception 'Fit House closeout blocked: expected product slug has drifted identity';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_new_products) e(name text, slug text, brand text)
    join public.products p on p.slug is distinct from e.slug
      and regexp_replace(lower(coalesce(p.name, '')), '[^a-z0-9]+', '', 'g')
        = regexp_replace(lower(e.name), '[^a-z0-9]+', '', 'g')
      and regexp_replace(lower(coalesce(p.brand, '')), '[^a-z0-9]+', '', 'g')
        = regexp_replace(lower(e.brand), '[^a-z0-9]+', '', 'g')
  ) then
    raise exception 'Fit House closeout blocked: semantic duplicate canonical product';
  end if;

  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;

  select count(*) filter (where p.id is null)
  into v_missing_products
  from jsonb_to_recordset(v_new_products) e(slug text)
  left join public.products p on p.slug = e.slug;

  insert into public.products (
    name, slug, brand, category, price, image, servings,
    net_weight_g, net_volume_ml, product_format, is_active
  )
  select
    e.name, e.slug, e.brand, e.category, null, e.image, e.servings,
    e.net_weight_g, e.net_volume_ml, e.product_format, true
  from jsonb_to_recordset(v_new_products)
    e(name text, slug text, brand text, category text, net_weight_g numeric,
      servings integer, net_volume_ml numeric, product_format text, image text)
  where not exists (select 1 from public.products p where p.slug = e.slug)
  order by e.slug;
  get diagnostics v_inserted_products = row_count;
  if v_inserted_products <> v_missing_products then
    raise exception 'Fit House closeout failed: product insert count mismatch';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_new_products) ep(slug text)
    join public.products p on p.slug = ep.slug
    join public.product_variants v on v.product_id = p.id
    where not exists (
      select 1
      from jsonb_to_recordset(v_variants) ev(product_slug text, variant_key text)
      where ev.product_slug = p.slug and ev.variant_key = v.variant_key
    )
  ) then
    raise exception 'Fit House closeout blocked: unexpected canonical variant exists';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_variants)
      e(product_slug text, variant_key text, display_name text, flavour_code text,
        flavour_label text, size_value numeric, size_unit text, pack_count integer,
        product_format text, is_default boolean, is_active boolean)
    join public.products p on p.slug = e.product_slug
    join public.product_variants v
      on v.product_id = p.id and v.variant_key = e.variant_key
    where v.display_name is distinct from e.display_name
       or v.flavour_code is distinct from e.flavour_code
       or v.flavour_label is distinct from e.flavour_label
       or v.size_value is distinct from e.size_value
       or v.size_unit is distinct from e.size_unit
       or v.pack_count is distinct from e.pack_count
       or v.product_format is distinct from e.product_format
       or v.is_default is distinct from e.is_default
       or v.is_active is distinct from true
       or v.gtin is not null
       or v.image is not null
       or v.nutrition_override is distinct from '{}'::jsonb
  ) then
    raise exception 'Fit House closeout blocked: expected canonical variant drift';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_existing_variant_creates)
      e(product_id bigint, product_slug text, variant_key text, display_name text,
        flavour_code text, flavour_label text, size_value numeric, size_unit text,
        pack_count integer, product_format text, is_default boolean, is_active boolean)
    left join public.products p on p.id = e.product_id and p.slug = e.product_slug
    left join public.product_variants v
      on v.product_id = p.id and v.variant_key = e.variant_key
    where p.id is null
       or (v.id is not null and (
         v.display_name is distinct from e.display_name
         or v.flavour_code is distinct from e.flavour_code
         or v.flavour_label is distinct from e.flavour_label
         or v.size_value is distinct from e.size_value
         or v.size_unit is distinct from e.size_unit
         or v.pack_count is distinct from e.pack_count
         or v.product_format is distinct from e.product_format
         or v.is_default is distinct from false
         or v.is_active is distinct from true
       ))
  ) then
    raise exception 'Fit House closeout blocked: existing-product variant drift';
  end if;

  select count(*)
  into v_missing_variants
  from jsonb_to_recordset(v_variants) e(product_slug text, variant_key text)
  join public.products p on p.slug = e.product_slug
  where not exists (
    select 1 from public.product_variants v
    where v.product_id = p.id and v.variant_key = e.variant_key
  );

  insert into public.product_variants (
    product_id, variant_key, display_name, flavour_code, flavour_label,
    size_value, size_unit, pack_count, product_format, gtin, image,
    nutrition_override, is_default, is_active
  )
  select
    p.id, e.variant_key, e.display_name, e.flavour_code, e.flavour_label,
    e.size_value, e.size_unit, e.pack_count, e.product_format, null, null,
    '{}'::jsonb, e.is_default, true
  from jsonb_to_recordset(v_variants)
    e(product_slug text, variant_key text, display_name text, flavour_code text,
      flavour_label text, size_value numeric, size_unit text, pack_count integer,
      product_format text, is_default boolean)
  join public.products p on p.slug = e.product_slug
  where not exists (
    select 1 from public.product_variants v
    where v.product_id = p.id and v.variant_key = e.variant_key
  )
  order by e.product_slug, e.variant_key;
  get diagnostics v_inserted_new_variants = row_count;
  if v_inserted_new_variants <> v_missing_variants then
    raise exception 'Fit House closeout failed: variant insert count mismatch';
  end if;

  select count(*)
  into v_missing_variants
  from jsonb_to_recordset(v_existing_variant_creates)
    e(product_id bigint, variant_key text)
  where not exists (
    select 1 from public.product_variants v
    where v.product_id = e.product_id and v.variant_key = e.variant_key
  );

  insert into public.product_variants (
    product_id, variant_key, display_name, flavour_code, flavour_label,
    size_value, size_unit, pack_count, product_format, gtin, image,
    nutrition_override, is_default, is_active
  )
  select
    e.product_id, e.variant_key, e.display_name, e.flavour_code, e.flavour_label,
    e.size_value, e.size_unit, e.pack_count, e.product_format, null, null,
    '{}'::jsonb, false, true
  from jsonb_to_recordset(v_existing_variant_creates)
    e(product_id bigint, variant_key text, display_name text, flavour_code text,
      flavour_label text, size_value numeric, size_unit text, pack_count integer,
      product_format text)
  where not exists (
    select 1 from public.product_variants v
    where v.product_id = e.product_id and v.variant_key = e.variant_key
  )
  order by e.product_id, e.variant_key;
  get diagnostics v_inserted_existing_variants = row_count;
  if v_inserted_existing_variants <> v_missing_variants then
    raise exception 'Fit House closeout failed: existing-product variant insert count mismatch';
  end if;

  select count(*) into v_products_after from public.products;
  select count(*) into v_variants_after from public.product_variants;
  select count(*) into v_mappings_after from public.retailer_products;
  select count(*) into v_offers_after from public.offers;
  select count(*) into v_history_after from public.price_history;

  if v_products_after <> v_products_before + v_inserted_products
     or v_variants_after <> v_variants_before
       + v_inserted_new_variants + v_inserted_existing_variants
     or v_mappings_after <> v_mappings_before
     or v_offers_after <> v_offers_before
     or v_history_after <> v_history_before
  then
    raise exception 'Fit House closeout failed: unexpected global table delta';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_new_products) e(slug text)
    join public.products p on p.slug = e.slug
    left join lateral (
      select count(*) filter (where is_default and is_active) as defaults
      from public.product_variants where product_id = p.id
    ) c on true
    where c.defaults <> 1
  ) or (
    select count(*)
    from public.product_variants v
    join public.products p on p.id = v.product_id
    join jsonb_to_recordset(v_variants) e(product_slug text, variant_key text)
      on e.product_slug = p.slug and e.variant_key = v.variant_key
  ) <> 117
     or (
       select count(*)
       from public.product_variants v
       join jsonb_to_recordset(v_existing_variant_creates)
         e(product_id bigint, variant_key text)
         on e.product_id = v.product_id and e.variant_key = v.variant_key
     ) <> 16
  then
    raise exception 'Fit House closeout failed: final canonical inventory mismatch';
  end if;
end;
$fit_house_closeout$;

commit;
