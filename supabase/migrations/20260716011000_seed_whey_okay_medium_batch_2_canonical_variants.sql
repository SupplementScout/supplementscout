begin;

do $seed_whey_okay_medium_batch_2_canonical_variants$
declare
  v_expected constant jsonb := $whey_okay_medium_batch_2_inventory$
[
    {
        "product_id": 49,
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
    },
    {
        "product_id": 62,
        "variant_key": "jelly-bean-460g",
        "display_name": "Jelly Bean / 460g",
        "flavour_code": "jelly bean",
        "flavour_label": "Jelly Bean",
        "size_value": 460,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 59,
        "variant_key": "blue-ice-375g",
        "display_name": "Blue Ice / 375g",
        "flavour_code": "blue ice",
        "flavour_label": "Blue Ice",
        "size_value": 375,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 63,
        "variant_key": "fruit-punch-blast-264g",
        "display_name": "Fruit Punch Blast / 264g",
        "flavour_code": "fruit punch blast",
        "flavour_label": "Fruit Punch Blast",
        "size_value": 264,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 128,
        "variant_key": "strawberry-and-banana-1500g",
        "display_name": "Strawberry & Banana / 1.5kg",
        "flavour_code": "strawberry and banana",
        "flavour_label": "Strawberry & Banana",
        "size_value": 1500,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 291,
        "variant_key": "blue-raspberry-600g",
        "display_name": "Blue Raspberry / 600g",
        "flavour_code": "blue raspberry",
        "flavour_label": "Blue Raspberry",
        "size_value": 600,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 411,
        "variant_key": "electric-red-425g",
        "display_name": "Electric Red / 425g",
        "flavour_code": "electric red",
        "flavour_label": "Electric Red",
        "size_value": 425,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 403,
        "variant_key": "belgian-chocolate-2100g",
        "display_name": "Belgian Chocolate / 2.1kg",
        "flavour_code": "belgian chocolate",
        "flavour_label": "Belgian Chocolate",
        "size_value": 2100,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 361,
        "variant_key": "fresh-pineapple-250g",
        "display_name": "Fresh Pineapple / 250g",
        "flavour_code": "fresh pineapple",
        "flavour_label": "Fresh Pineapple",
        "size_value": 250,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 457,
        "variant_key": "mango-510g",
        "display_name": "Mango / 510g",
        "flavour_code": "mango",
        "flavour_label": "Mango",
        "size_value": 510,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 132,
        "variant_key": "banana-2400g",
        "display_name": "Banana / 2.4kg",
        "flavour_code": "banana",
        "flavour_label": "Banana",
        "size_value": 2400,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 67,
        "variant_key": "chocolate-908g",
        "display_name": "Chocolate / 908g",
        "flavour_code": "chocolate",
        "flavour_label": "Chocolate",
        "size_value": 908,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 423,
        "variant_key": "raspberry-ripple-2000g",
        "display_name": "Raspberry Ripple / 2kg",
        "flavour_code": "raspberry ripple",
        "flavour_label": "Raspberry Ripple",
        "size_value": 2000,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 31,
        "variant_key": "vanilla-creme-908g",
        "display_name": "Vanilla Creme / 908g",
        "flavour_code": "vanilla creme",
        "flavour_label": "Vanilla Creme",
        "size_value": 908,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 74,
        "variant_key": "blue-raspberry-435g",
        "display_name": "Blue Raspberry / 435g",
        "flavour_code": "blue raspberry",
        "flavour_label": "Blue Raspberry",
        "size_value": 435,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 295,
        "variant_key": "blood-orange-330g",
        "display_name": "Blood Orange / 330g",
        "flavour_code": "blood orange",
        "flavour_label": "Blood Orange",
        "size_value": 330,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 368,
        "variant_key": "fruit-punch-266g",
        "display_name": "Fruit Punch / 266g",
        "flavour_code": "fruit punch",
        "flavour_label": "Fruit Punch",
        "size_value": 266,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 55,
        "variant_key": "blue-grape-340g",
        "display_name": "Blue Grape / 340g",
        "flavour_code": "blue grape",
        "flavour_label": "Blue Grape",
        "size_value": 340,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 286,
        "variant_key": "cookies-and-cream-45g",
        "display_name": "Cookies and Cream / 45g",
        "flavour_code": "cookies and cream",
        "flavour_label": "Cookies and Cream",
        "size_value": 45,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "snack",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 367,
        "variant_key": "electric-blue-blue-raspberry-and-lime-240g",
        "display_name": "Electric Blue (Blue Raspberry & Lime) / 240g",
        "flavour_code": "electric blue (blue raspberry and lime)",
        "flavour_label": "Electric Blue (Blue Raspberry & Lime)",
        "size_value": 240,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 26,
        "variant_key": "cotton-candy-252g",
        "display_name": "Cotton Candy / 252g",
        "flavour_code": "cotton candy",
        "flavour_label": "Cotton Candy",
        "size_value": 252,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 70,
        "variant_key": "berry-684g",
        "display_name": "Berry / 684g",
        "flavour_code": "berry",
        "flavour_label": "Berry",
        "size_value": 684,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 450,
        "variant_key": "orange-1050g",
        "display_name": "Orange / 1.05kg",
        "flavour_code": "orange",
        "flavour_label": "Orange",
        "size_value": 1050,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 253,
        "variant_key": "apple-and-pear-266g",
        "display_name": "Apple & Pear / 266g",
        "flavour_code": "apple and pear",
        "flavour_label": "Apple & Pear",
        "size_value": 266,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 336,
        "variant_key": "jelly-bean-480g",
        "display_name": "Jelly Bean / 480g",
        "flavour_code": "jelly bean",
        "flavour_label": "Jelly Bean",
        "size_value": 480,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    }
]
  $whey_okay_medium_batch_2_inventory$::jsonb;
  v_missing integer;
  v_inserted integer;
begin
  if jsonb_typeof(v_expected) is distinct from 'array' or jsonb_array_length(v_expected) is distinct from 25 then
    raise exception 'Whey Okay Medium batch 2 variant seed blocked: expected inventory must contain exactly 25 variants';
  end if;

  if (select count(distinct e.product_id) from jsonb_to_recordset(v_expected) as e(product_id bigint)) is distinct from 25
     or exists (
       select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text, display_name text, flavour_code text, flavour_label text, size_value numeric, size_unit text, pack_count integer, product_format text, is_default boolean, is_active boolean)
       where e.product_id not in (26, 31, 49, 55, 59, 62, 63, 67, 70, 74, 128, 132, 253, 286, 291, 295, 336, 361, 367, 368, 403, 411, 423, 450, 457) or e.variant_key is null or btrim(e.variant_key) = '' or e.display_name is null or btrim(e.display_name) = '' or e.flavour_code is null or btrim(e.flavour_code) = '' or e.flavour_label is null or btrim(e.flavour_label) = '' or e.size_value is null or e.size_unit is distinct from 'g' or e.pack_count is null or e.pack_count < 1 or e.product_format not in ('powder','snack') or e.is_default is distinct from false or e.is_active is distinct from true)
     or exists (select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text) group by e.product_id, e.variant_key having count(*) <> 1)
     or exists (select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint, flavour_code text, size_value numeric, size_unit text, pack_count integer, product_format text) group by e.product_id, e.flavour_code, e.size_value, e.size_unit, e.pack_count, e.product_format having count(*) <> 1) then
    raise exception 'Whey Okay Medium batch 2 variant seed blocked: expected inventory contract is invalid';
  end if;

  perform 1 from public.products where id in (26, 31, 49, 55, 59, 62, 63, 67, 70, 74, 128, 132, 253, 286, 291, 295, 336, 361, 367, 368, 403, 411, 423, 450, 457) order by id for update;
  lock table public.product_variants in share row exclusive mode;

  if exists (
    select 1 from (values
      (26::bigint, 'PEScience High Volume 252g'::text, 'PEScience'::text),
      (31::bigint, 'Per4m Vegan Protein 908g'::text, 'Per4m'::text),
      (49::bigint, 'Ghost Pump Nitric Oxide 350g'::text, 'Ghost'::text),
      (55::bigint, 'BioTech USA Nitrox Therapy 340g'::text, 'BioTech USA'::text),
      (59::bigint, '5% Nutrition Rich Piana 5150 375g'::text, '5% Nutrition'::text),
      (62::bigint, 'HR Labs Defib Pre-Workout 460g'::text, 'HR Labs'::text),
      (63::bigint, 'Muscletech Vapor X5 Next Gen 264g'::text, 'MuscleTech'::text),
      (67::bigint, 'BioTech USA Micellar Casein 908g'::text, 'BioTech USA'::text),
      (70::bigint, 'Optimum Nutrition 100% Plant Protein 684g'::text, 'Optimum Nutrition'::text),
      (74::bigint, 'BSN AminoX 435g'::text, 'BSN'::text),
      (128::bigint, '7Nutrition Bodybuilder 1.5kg'::text, '7Nutrition'::text),
      (132::bigint, 'Applied Nutrition Critical Mass Lean Mass Gainz 2.4kg'::text, 'Applied Nutrition'::text),
      (253::bigint, 'Optimum Nutrition Gold Standard BCAA Train Sustain 266g'::text, 'Optimum Nutrition'::text),
      (286::bigint, 'Love Vegan High Energy Protein Bite 45g'::text, 'Love Vegan'::text),
      (291::bigint, 'Reflex Muscle Bomb Pre-Workout 600g'::text, 'Reflex Nutrition'::text),
      (295::bigint, 'BioTech USA Black Blood NOX+ 330g'::text, 'BioTech USA'::text),
      (336::bigint, 'HR Labs Defib V3 480g'::text, 'HR Labs'::text),
      (361::bigint, 'Trec CM3 Creatine Powder 250g'::text, 'Trec Nutrition'::text),
      (367::bigint, 'GYM HIGH The Stacker 240g'::text, 'GYM HIGH'::text),
      (368::bigint, 'Kaged Muscle Pre-Kaged Sport 266g'::text, 'Kaged Muscle'::text),
      (403::bigint, 'GYM HIGH Mass Gainer 2100g'::text, 'GYM HIGH'::text),
      (411::bigint, 'GYM HIGH The Stinger Zero Caffeine Pump Pre Workout 425g'::text, 'GYM HIGH'::text),
      (423::bigint, 'Applied Nutrition Cream Of Rice 2kg'::text, 'Applied Nutrition'::text),
      (450::bigint, 'Trec Vitargo Electro Energy 1050g'::text, 'Trec Nutrition'::text),
      (457::bigint, 'Reflex Nutrition Clear Whey Isolate 510g 17 Servings'::text, 'Reflex Nutrition'::text)
    ) as expected(product_id, product_name, brand)
    left join public.products p on p.id = expected.product_id
    where p.id is null or p.name is distinct from expected.product_name or coalesce(p.brand,'') is distinct from expected.brand or p.is_active is distinct from true or p.merged_into_product_id is not null or p.merged_at is not null
  ) then
    raise exception 'Whey Okay Medium batch 2 variant seed blocked: canonical product identity or lifecycle changed';
  end if;

  if exists (
    select 1 from (values
      (26::bigint, 16::bigint),
      (31::bigint, 42::bigint),
      (49::bigint, 113::bigint),
      (55::bigint, 93::bigint),
      (59::bigint, 94::bigint),
      (62::bigint, 72::bigint),
      (63::bigint, 96::bigint),
      (67::bigint, 33::bigint),
      (70::bigint, 19::bigint),
      (74::bigint, 20::bigint),
      (128::bigint, 108::bigint),
      (132::bigint, 109::bigint),
      (253::bigint, 229::bigint),
      (286::bigint, 255::bigint),
      (291::bigint, 280::bigint),
      (295::bigint, 135::bigint),
      (336::bigint, 375::bigint),
      (361::bigint, 326::bigint),
      (367::bigint, 317::bigint),
      (368::bigint, 358::bigint),
      (403::bigint, 383::bigint),
      (411::bigint, 381::bigint),
      (423::bigint, 378::bigint),
      (450::bigint, 456::bigint),
      (457::bigint, 491::bigint)
    ) as expected(product_id, default_variant_id)
    left join public.product_variants v on v.id = expected.default_variant_id
    where v.id is null or v.product_id is distinct from expected.product_id or v.variant_key is distinct from 'default' or v.is_default is distinct from true or v.is_active is distinct from true
  ) then
    raise exception 'Whey Okay Medium batch 2 variant seed blocked: default variant identity changed';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text, display_name text, flavour_code text, flavour_label text, size_value numeric, size_unit text, pack_count integer, product_format text, is_default boolean, is_active boolean)
    join public.product_variants v on v.product_id = e.product_id and v.variant_key = e.variant_key
    where v.display_name is distinct from e.display_name or v.flavour_code is distinct from e.flavour_code or v.flavour_label is distinct from e.flavour_label or v.size_value is distinct from e.size_value or v.size_unit is distinct from e.size_unit or v.pack_count is distinct from e.pack_count or v.product_format is distinct from e.product_format or v.gtin is not null or v.image is not null or v.nutrition_override is distinct from '{}'::jsonb or v.is_default is distinct from e.is_default or v.is_active is distinct from e.is_active
  ) then
    raise exception 'Whey Okay Medium batch 2 variant seed blocked: expected variant key has drifted values';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text, flavour_code text, size_value numeric, size_unit text, pack_count integer, product_format text)
    join public.product_variants v on v.product_id is not distinct from e.product_id and v.flavour_code is not distinct from e.flavour_code and v.size_value is not distinct from e.size_value and v.size_unit is not distinct from e.size_unit and v.pack_count is not distinct from e.pack_count and v.product_format is not distinct from e.product_format
    where v.variant_key is distinct from e.variant_key
  ) then
    raise exception 'Whey Okay Medium batch 2 variant seed blocked: semantic duplicate exists under another key';
  end if;


  select count(*) into v_missing from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text) where not exists (select 1 from public.product_variants v where v.product_id = e.product_id and v.variant_key = e.variant_key);

  insert into public.product_variants (product_id, variant_key, display_name, flavour_code, flavour_label, size_value, size_unit, pack_count, product_format, gtin, image, nutrition_override, is_default, is_active)
  select e.product_id, e.variant_key, e.display_name, e.flavour_code, e.flavour_label, e.size_value, e.size_unit, e.pack_count, e.product_format, null, null, '{}'::jsonb, e.is_default, e.is_active
  from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text, display_name text, flavour_code text, flavour_label text, size_value numeric, size_unit text, pack_count integer, product_format text, is_default boolean, is_active boolean)
  where not exists (select 1 from public.product_variants v where v.product_id = e.product_id and v.variant_key = e.variant_key)
  order by e.product_id, e.variant_key;

  get diagnostics v_inserted = row_count;
  if v_inserted is distinct from v_missing then
    raise exception 'Whey Okay Medium batch 2 variant seed failed: inserted % variants instead of %', v_inserted, v_missing;
  end if;

  if (select count(*) from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text) join public.product_variants v on v.product_id=e.product_id and v.variant_key=e.variant_key) is distinct from 25 then
    raise exception 'Whey Okay Medium batch 2 variant seed failed: final target inventory is not exactly 25 variants';
  end if;
end;
$seed_whey_okay_medium_batch_2_canonical_variants$;

commit;
