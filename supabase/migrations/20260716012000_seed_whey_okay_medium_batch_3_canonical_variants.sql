begin;

do $seed_whey_okay_medium_batch_3_canonical_variants$
declare
  v_expected constant jsonb := $whey_okay_medium_batch_3_inventory$
[
    {
        "product_id": 294,
        "variant_key": "cola-300g",
        "display_name": "Cola / 300g",
        "flavour_code": "cola",
        "flavour_label": "Cola",
        "size_value": 300,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 125,
        "variant_key": "chocolate-perfection-2000g",
        "display_name": "Chocolate Perfection / 2kg",
        "flavour_code": "chocolate perfection",
        "flavour_label": "Chocolate Perfection",
        "size_value": 2000,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 61,
        "variant_key": "cola-and-lime-300g",
        "display_name": "Cola & Lime / 300g",
        "flavour_code": "cola and lime",
        "flavour_label": "Cola & Lime",
        "size_value": 300,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 348,
        "variant_key": "lime-330g",
        "display_name": "Lime / 330g",
        "flavour_code": "lime",
        "flavour_label": "Lime",
        "size_value": 330,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 172,
        "variant_key": "banana-cream-6000g",
        "display_name": "Banana Cream / 6kg",
        "flavour_code": "banana cream",
        "flavour_label": "Banana Cream",
        "size_value": 6000,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 220,
        "variant_key": "strawberry-and-fuzzy-fruits-510g",
        "display_name": "Strawberry And Fuzzy Fruits / 510g",
        "flavour_code": "strawberry and fuzzy fruits",
        "flavour_label": "Strawberry And Fuzzy Fruits",
        "size_value": 510,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 328,
        "variant_key": "double-chocolate-900g",
        "display_name": "Double Chocolate / 900g",
        "flavour_code": "double chocolate",
        "flavour_label": "Double Chocolate",
        "size_value": 900,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 390,
        "variant_key": "berry-bliss-600g",
        "display_name": "Berry Bliss / 600g",
        "flavour_code": "berry bliss",
        "flavour_label": "Berry Bliss",
        "size_value": 600,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 290,
        "variant_key": "chocolate-mudslide-2260g",
        "display_name": "Chocolate Mudslide / 2.26kg",
        "flavour_code": "chocolate mudslide",
        "flavour_label": "Chocolate Mudslide",
        "size_value": 2260,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 165,
        "variant_key": "apple-pie-113g",
        "display_name": "Apple Pie / 113g",
        "flavour_code": "apple pie",
        "flavour_label": "Apple Pie",
        "size_value": 113,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "snack",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 324,
        "variant_key": "golden-syrup-500g",
        "display_name": "Golden Syrup / 500g",
        "flavour_code": "golden syrup",
        "flavour_label": "Golden Syrup",
        "size_value": 500,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 170,
        "variant_key": "watermelon-315g",
        "display_name": "Watermelon / 315g",
        "flavour_code": "watermelon",
        "flavour_label": "Watermelon",
        "size_value": 315,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 517,
        "variant_key": "chocolate-fudge-brownie-2270g",
        "display_name": "Chocolate Fudge Brownie / 2.27kg",
        "flavour_code": "chocolate fudge brownie",
        "flavour_label": "Chocolate Fudge Brownie",
        "size_value": 2270,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 453,
        "variant_key": "strawberry-milkshake-900g",
        "display_name": "Strawberry Milkshake / 900g",
        "flavour_code": "strawberry milkshake",
        "flavour_label": "Strawberry Milkshake",
        "size_value": 900,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 448,
        "variant_key": "peanut-butter-chocolate-727g",
        "display_name": "Peanut Butter Chocolate / 727g",
        "flavour_code": "peanut butter chocolate",
        "flavour_label": "Peanut Butter Chocolate",
        "size_value": 727,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 510,
        "variant_key": "belgian-chocolate-600g",
        "display_name": "Belgian Chocolate / 600g",
        "flavour_code": "belgian chocolate",
        "flavour_label": "Belgian Chocolate",
        "size_value": 600,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 404,
        "variant_key": "blue-raspberry-292g",
        "display_name": "Blue Raspberry / 292g",
        "flavour_code": "blue raspberry",
        "flavour_label": "Blue Raspberry",
        "size_value": 292,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 339,
        "variant_key": "banana-split-4000g",
        "display_name": "Banana Split / 4kg",
        "flavour_code": "banana split",
        "flavour_label": "Banana Split",
        "size_value": 4000,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 75,
        "variant_key": "coconut-lime-500g",
        "display_name": "Coconut Lime / 500g",
        "flavour_code": "coconut lime",
        "flavour_label": "Coconut Lime",
        "size_value": 500,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    }
]
  $whey_okay_medium_batch_3_inventory$::jsonb;
  v_missing integer;
  v_inserted integer;
begin
  if jsonb_typeof(v_expected) is distinct from 'array' or jsonb_array_length(v_expected) is distinct from 19 then
    raise exception 'Whey Okay Medium batch 3 variant seed blocked: expected inventory must contain exactly 19 variants';
  end if;

  if (select count(distinct e.product_id) from jsonb_to_recordset(v_expected) as e(product_id bigint)) is distinct from 19
     or exists (
       select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text, display_name text, flavour_code text, flavour_label text, size_value numeric, size_unit text, pack_count integer, product_format text, is_default boolean, is_active boolean)
       where e.product_id not in (61, 75, 125, 165, 170, 172, 220, 290, 294, 324, 328, 339, 348, 390, 404, 448, 453, 510, 517) or e.variant_key is null or btrim(e.variant_key) = '' or e.display_name is null or btrim(e.display_name) = '' or e.flavour_code is null or btrim(e.flavour_code) = '' or e.flavour_label is null or btrim(e.flavour_label) = '' or e.size_value is null or e.size_unit is distinct from 'g' or e.pack_count is null or e.pack_count < 1 or e.product_format not in ('powder','snack') or e.is_default is distinct from false or e.is_active is distinct from true)
     or exists (select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text) group by e.product_id, e.variant_key having count(*) <> 1)
     or exists (select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint, flavour_code text, size_value numeric, size_unit text, pack_count integer, product_format text) group by e.product_id, e.flavour_code, e.size_value, e.size_unit, e.pack_count, e.product_format having count(*) <> 1) then
    raise exception 'Whey Okay Medium batch 3 variant seed blocked: expected inventory contract is invalid';
  end if;

  perform 1 from public.products where id in (61, 75, 125, 165, 170, 172, 220, 290, 294, 324, 328, 339, 348, 390, 404, 448, 453, 510, 517) order by id for update;
  lock table public.product_variants in share row exclusive mode;

  if exists (
    select 1 from (values
      (61::bigint, 'Stay Lean Engage Natural Pre Workout 300g'::text, 'Stay Lean'::text),
      (75::bigint, 'Stay Lean BCAA All Day 500g'::text, 'Stay Lean'::text),
      (125::bigint, 'Reflex Instant Mass Heavyweight 2kg'::text, 'Reflex Nutrition'::text),
      (165::bigint, 'Lenny & Larry''s Complete Vegan Cookie  113g'::text, 'Lenny & Larry'::text),
      (170::bigint, 'Redcon1 Big Noise Pre-Workout 315g'::text, 'Redcon1'::text),
      (172::bigint, 'Boditronics Heavyweight 6kg Mass Attack'::text, 'Boditronics'::text),
      (220::bigint, 'HR Labs Basic 510g'::text, 'HR Labs'::text),
      (290::bigint, 'BSN Syntha 6 Limited Edition 2.26kg'::text, 'BSN'::text),
      (294::bigint, 'BioTech USA Black Blood CAF+ 300g'::text, 'BioTech USA'::text),
      (324::bigint, 'Muscle Moose Protein Pancakes Mix 500g'::text, 'Muscle Moose'::text),
      (328::bigint, 'Per4m Isolate Zero 900g'::text, 'Per4m'::text),
      (339::bigint, 'Boditronics Juggernaut Mass Attack 4kg'::text, 'Boditronics'::text),
      (348::bigint, 'Ghost Greens 330g'::text, 'Ghost'::text),
      (390::bigint, 'GYM HIGH Vegan Plant-Based-Protein Blend 600g'::text, 'GYM HIGH'::text),
      (404::bigint, 'ProSupps Mr Hyde Pre Workout 292g'::text, 'ProSupps'::text),
      (448::bigint, 'Mutant Iso Surge 727g'::text, 'Mutant'::text),
      (453::bigint, 'KIOR Health Whey+ Probiotics 900g'::text, 'KIOR Health'::text),
      (510::bigint, 'GYM HIGH Whey Pro Synergy Dynamic 600g'::text, 'GYM HIGH'::text),
      (517::bigint, 'Mutant Mass (Mass Gainer) 2.27kg'::text, 'Mutant'::text)
    ) as expected(product_id, product_name, brand)
    left join public.products p on p.id = expected.product_id
    where p.id is null or p.name is distinct from expected.product_name or coalesce(p.brand,'') is distinct from expected.brand or p.is_active is distinct from true or p.merged_into_product_id is not null or p.merged_at is not null
  ) then
    raise exception 'Whey Okay Medium batch 3 variant seed blocked: canonical product identity or lifecycle changed';
  end if;

  if exists (
    select 1 from (values
      (61::bigint, 132::bigint),
      (75::bigint, 35::bigint),
      (125::bigint, 125::bigint),
      (165::bigint, 172::bigint),
      (170::bigint, 174::bigint),
      (172::bigint, 226::bigint),
      (220::bigint, 220::bigint),
      (290::bigint, 256::bigint),
      (294::bigint, 246::bigint),
      (324::bigint, 527::bigint),
      (328::bigint, 373::bigint),
      (339::bigint, 304::bigint),
      (348::bigint, 361::bigint),
      (390::bigint, 556::bigint),
      (404::bigint, 398::bigint),
      (448::bigint, 439::bigint),
      (453::bigint, 490::bigint),
      (510::bigint, 603::bigint),
      (517::bigint, 487::bigint)
    ) as expected(product_id, default_variant_id)
    left join public.product_variants v on v.id = expected.default_variant_id
    where v.id is null or v.product_id is distinct from expected.product_id or v.variant_key is distinct from 'default' or v.is_default is distinct from true or v.is_active is distinct from true
  ) then
    raise exception 'Whey Okay Medium batch 3 variant seed blocked: default variant identity changed';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text, display_name text, flavour_code text, flavour_label text, size_value numeric, size_unit text, pack_count integer, product_format text, is_default boolean, is_active boolean)
    join public.product_variants v on v.product_id = e.product_id and v.variant_key = e.variant_key
    where v.display_name is distinct from e.display_name or v.flavour_code is distinct from e.flavour_code or v.flavour_label is distinct from e.flavour_label or v.size_value is distinct from e.size_value or v.size_unit is distinct from e.size_unit or v.pack_count is distinct from e.pack_count or v.product_format is distinct from e.product_format or v.gtin is not null or v.image is not null or v.nutrition_override is distinct from '{}'::jsonb or v.is_default is distinct from e.is_default or v.is_active is distinct from e.is_active
  ) then
    raise exception 'Whey Okay Medium batch 3 variant seed blocked: expected variant key has drifted values';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text, flavour_code text, size_value numeric, size_unit text, pack_count integer, product_format text)
    join public.product_variants v on v.product_id is not distinct from e.product_id and v.flavour_code is not distinct from e.flavour_code and v.size_value is not distinct from e.size_value and v.size_unit is not distinct from e.size_unit and v.pack_count is not distinct from e.pack_count and v.product_format is not distinct from e.product_format
    where v.variant_key is distinct from e.variant_key
  ) then
    raise exception 'Whey Okay Medium batch 3 variant seed blocked: semantic duplicate exists under another key';
  end if;


  select count(*) into v_missing from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text) where not exists (select 1 from public.product_variants v where v.product_id = e.product_id and v.variant_key = e.variant_key);

  insert into public.product_variants (product_id, variant_key, display_name, flavour_code, flavour_label, size_value, size_unit, pack_count, product_format, gtin, image, nutrition_override, is_default, is_active)
  select e.product_id, e.variant_key, e.display_name, e.flavour_code, e.flavour_label, e.size_value, e.size_unit, e.pack_count, e.product_format, null, null, '{}'::jsonb, e.is_default, e.is_active
  from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text, display_name text, flavour_code text, flavour_label text, size_value numeric, size_unit text, pack_count integer, product_format text, is_default boolean, is_active boolean)
  where not exists (select 1 from public.product_variants v where v.product_id = e.product_id and v.variant_key = e.variant_key)
  order by e.product_id, e.variant_key;

  get diagnostics v_inserted = row_count;
  if v_inserted is distinct from v_missing then
    raise exception 'Whey Okay Medium batch 3 variant seed failed: inserted % variants instead of %', v_inserted, v_missing;
  end if;

  if (select count(*) from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text) join public.product_variants v on v.product_id=e.product_id and v.variant_key=e.variant_key) is distinct from 19 then
    raise exception 'Whey Okay Medium batch 3 variant seed failed: final target inventory is not exactly 19 variants';
  end if;
end;
$seed_whey_okay_medium_batch_3_canonical_variants$;

commit;
