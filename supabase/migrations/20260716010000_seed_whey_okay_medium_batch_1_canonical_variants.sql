begin;

do $seed_whey_okay_medium_batch_1_canonical_variants$
declare
  v_expected constant jsonb := $whey_okay_medium_batch_1_inventory$
[
    {
        "product_id": 12,
        "variant_key": "strawberry-cream-2000g",
        "display_name": "Strawberry Cream / 2kg",
        "flavour_code": "strawberry cream",
        "flavour_label": "Strawberry Cream",
        "size_value": 2000,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 11,
        "variant_key": "caramel-chocolate-2000g",
        "display_name": "Caramel Chocolate / 2kg",
        "flavour_code": "caramel chocolate",
        "flavour_label": "Caramel Chocolate",
        "size_value": 2000,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 233,
        "variant_key": "coffee-ice-cream-907g",
        "display_name": "Coffee Ice Cream / 907g",
        "flavour_code": "coffee ice cream",
        "flavour_label": "Coffee Ice Cream",
        "size_value": 907,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 482,
        "variant_key": "pina-colada-250g",
        "display_name": "Pina Colada / 250g",
        "flavour_code": "pina colada",
        "flavour_label": "Pina Colada",
        "size_value": 250,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 56,
        "variant_key": "blazin-berry-392g",
        "display_name": "Blazin Berry / 392g",
        "flavour_code": "blazin berry",
        "flavour_label": "Blazin Berry",
        "size_value": 392,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 215,
        "variant_key": "bubblegum-crush-315g",
        "display_name": "Bubblegum Crush / 315g",
        "flavour_code": "bubblegum crush",
        "flavour_label": "Bubblegum Crush",
        "size_value": 315,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 169,
        "variant_key": "blue-raspberry-400g",
        "display_name": "Blue Raspberry / 400g",
        "flavour_code": "blue raspberry",
        "flavour_label": "Blue Raspberry",
        "size_value": 400,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 271,
        "variant_key": "birthday-cake-60g",
        "display_name": "Birthday Cake / 60g",
        "flavour_code": "birthday cake",
        "flavour_label": "Birthday Cake",
        "size_value": 60,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "snack",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 93,
        "variant_key": "fruit-punch-150g",
        "display_name": "Fruit Punch / 150g",
        "flavour_code": "fruit punch",
        "flavour_label": "Fruit Punch",
        "size_value": 150,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 112,
        "variant_key": "blue-raspberry-465g",
        "display_name": "Blue Raspberry / 465g",
        "flavour_code": "blue raspberry",
        "flavour_label": "Blue Raspberry",
        "size_value": 465,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 58,
        "variant_key": "blue-raspberry-387g",
        "display_name": "Blue Raspberry / 387g",
        "flavour_code": "blue raspberry",
        "flavour_label": "Blue Raspberry",
        "size_value": 387,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 338,
        "variant_key": "cherry-and-apple-875g",
        "display_name": "Cherry & Apple / 875g",
        "flavour_code": "cherry and apple",
        "flavour_label": "Cherry & Apple",
        "size_value": 875,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 495,
        "variant_key": "pancake-butter-2000g",
        "display_name": "Pancake Butter / 2kg",
        "flavour_code": "pancake butter",
        "flavour_label": "Pancake Butter",
        "size_value": 2000,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 520,
        "variant_key": "blueberry-480g",
        "display_name": "Blueberry / 480g",
        "flavour_code": "blueberry",
        "flavour_label": "Blueberry",
        "size_value": 480,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 449,
        "variant_key": "berry-blaze-220g",
        "display_name": "Berry Blaze / 220g",
        "flavour_code": "berry blaze",
        "flavour_label": "Berry Blaze",
        "size_value": 220,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 232,
        "variant_key": "banana-pancake-batter-989g",
        "display_name": "Banana Pancake Batter / 989g",
        "flavour_code": "banana pancake batter",
        "flavour_label": "Banana Pancake Batter",
        "size_value": 989,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 6,
        "variant_key": "orange-cream-660g",
        "display_name": "Orange Cream / 660g",
        "flavour_code": "orange cream",
        "flavour_label": "Orange Cream",
        "size_value": 660,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 85,
        "variant_key": "blue-raspberry-240g",
        "display_name": "Blue Raspberry / 240g",
        "flavour_code": "blue raspberry",
        "flavour_label": "Blue Raspberry",
        "size_value": 240,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 71,
        "variant_key": "chocolate-cinnamon-500g",
        "display_name": "Chocolate-Cinnamon / 500g",
        "flavour_code": "chocolate-cinnamon",
        "flavour_label": "Chocolate-Cinnamon",
        "size_value": 500,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 77,
        "variant_key": "vanilla-ice-cream-900g",
        "display_name": "Vanilla Ice Cream / 900g",
        "flavour_code": "vanilla ice cream",
        "flavour_label": "Vanilla Ice Cream",
        "size_value": 900,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 164,
        "variant_key": "chocolate-1870g",
        "display_name": "Chocolate / 1.87kg",
        "flavour_code": "chocolate",
        "flavour_label": "Chocolate",
        "size_value": 1870,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 489,
        "variant_key": "blue-raspberry-225g",
        "display_name": "Blue Raspberry / 225g",
        "flavour_code": "blue raspberry",
        "flavour_label": "Blue Raspberry",
        "size_value": 225,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 166,
        "variant_key": "blueberry-crisp-12x68g",
        "display_name": "Blueberry Crisp / 12x68g",
        "flavour_code": "blueberry crisp",
        "flavour_label": "Blueberry Crisp",
        "size_value": 68,
        "size_unit": "g",
        "pack_count": 12,
        "product_format": "snack",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 24,
        "variant_key": "mango-splash-280g",
        "display_name": "Mango Splash / 280g",
        "flavour_code": "mango splash",
        "flavour_label": "Mango Splash",
        "size_value": 280,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    },
    {
        "product_id": 44,
        "variant_key": "black-cherry-375g",
        "display_name": "Black Cherry / 375g",
        "flavour_code": "black cherry",
        "flavour_label": "Black Cherry",
        "size_value": 375,
        "size_unit": "g",
        "pack_count": 1,
        "product_format": "powder",
        "is_default": false,
        "is_active": true
    }
]
  $whey_okay_medium_batch_1_inventory$::jsonb;
  v_missing integer;
  v_inserted integer;
begin
  if jsonb_typeof(v_expected) is distinct from 'array' or jsonb_array_length(v_expected) is distinct from 25 then
    raise exception 'Whey Okay Medium batch 1 variant seed blocked: expected inventory must contain exactly 25 variants';
  end if;

  if (select count(distinct e.product_id) from jsonb_to_recordset(v_expected) as e(product_id bigint)) is distinct from 25
     or exists (
       select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text, display_name text, flavour_code text, flavour_label text, size_value numeric, size_unit text, pack_count integer, product_format text, is_default boolean, is_active boolean)
       where e.product_id not in (6, 11, 12, 24, 44, 56, 58, 71, 77, 85, 93, 112, 164, 166, 169, 215, 232, 233, 271, 338, 449, 482, 489, 495, 520) or e.variant_key is null or btrim(e.variant_key) = '' or e.display_name is null or btrim(e.display_name) = '' or e.flavour_code is null or btrim(e.flavour_code) = '' or e.flavour_label is null or btrim(e.flavour_label) = '' or e.size_value is null or e.size_unit is distinct from 'g' or e.pack_count is null or e.pack_count < 1 or e.product_format not in ('powder','snack') or e.is_default is distinct from false or e.is_active is distinct from true)
     or exists (select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text) group by e.product_id, e.variant_key having count(*) <> 1)
     or exists (select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint, flavour_code text, size_value numeric, size_unit text, pack_count integer, product_format text) group by e.product_id, e.flavour_code, e.size_value, e.size_unit, e.pack_count, e.product_format having count(*) <> 1) then
    raise exception 'Whey Okay Medium batch 1 variant seed blocked: expected inventory contract is invalid';
  end if;

  perform 1 from public.products where id in (6, 11, 12, 24, 44, 56, 58, 71, 77, 85, 93, 112, 164, 166, 169, 215, 232, 233, 271, 338, 449, 482, 489, 495, 520) order by id for update;
  lock table public.product_variants in share row exclusive mode;

  if exists (
    select 1 from (values
      (6::bigint, 'Ghost Legend V4 Pre-Workout 660g'::text, 'Ghost'::text),
      (11::bigint, 'USN Blue Lab 100% Whey Premium Protein 2kg'::text, 'USN'::text),
      (12::bigint, 'Per4m Whey Protein 2kg'::text, 'Per4m'::text),
      (24::bigint, 'PEScience Prolific 280g'::text, 'PEScience'::text),
      (44::bigint, 'PEScience Amino IV 375g'::text, 'PEScience'::text),
      (56::bigint, 'Warrior Rage Unleash Hell Pre Workout 392g'::text, 'Warrior'::text),
      (58::bigint, '5 Nutrition Rich Piana  Full As F*ck 387g'::text, '5% Nutrition'::text),
      (71::bigint, 'BioTech USA Vegan Protein 500g'::text, 'BioTech USA'::text),
      (77::bigint, 'Boditronics Diet Whey 900g'::text, 'Boditronics'::text),
      (85::bigint, '5% Nutrition Rich Piana CreaTen 240g'::text, '5% Nutrition'::text),
      (93::bigint, 'JNX Sports The Ripper Fat Burner Powder 150g'::text, 'JNX Sports'::text),
      (112::bigint, '5% Nutrition Rich Piana  All Day You May 465g'::text, '5% Nutrition'::text),
      (164::bigint, 'BSN Syntha-6 Edge 1.87kg'::text, 'BSN'::text),
      (166::bigint, 'Clif Bar Energy Bar 12x68g'::text, 'Clif'::text),
      (169::bigint, 'Redcon1 Total War 400g'::text, 'Redcon1'::text),
      (215::bigint, 'Applied Nutrition ABE Ultimate Pre-Workout 315g'::text, 'Applied Nutrition'::text),
      (232::bigint, 'Ghost Vegan Protein 989g'::text, 'Ghost'::text),
      (233::bigint, 'Ghost 100% Whey Protein 907g'::text, 'Ghost'::text),
      (271::bigint, 'Grenade Carb Killa Protein Bar 60g'::text, 'Grenade'::text),
      (338::bigint, 'Applied Nutrition Clear Whey Protein 875g'::text, 'Applied Nutrition'::text),
      (449::bigint, 'USN QHUSH Black Pre-workout 220g'::text, 'Unknown'::text),
      (482::bigint, 'JNX Sports The Curse 250g'::text, 'JNX Sports'::text),
      (489::bigint, 'Mutant Madness Pre Workout 225g'::text, 'Mutant'::text),
      (495::bigint, 'GYM HIGH Cream Of Rice 2kg'::text, 'GYM HIGH'::text),
      (520::bigint, 'Olimp Redweiler Preworkout 480g'::text, 'Olimp'::text)
    ) as expected(product_id, product_name, brand)
    left join public.products p on p.id = expected.product_id
    where p.id is null or p.name is distinct from expected.product_name or coalesce(p.brand,'') is distinct from expected.brand or p.is_active is distinct from true or p.merged_into_product_id is not null or p.merged_at is not null
  ) then
    raise exception 'Whey Okay Medium batch 1 variant seed blocked: canonical product identity or lifecycle changed';
  end if;

  if exists (
    select 1 from (values
      (6::bigint, 8::bigint),
      (11::bigint, 14::bigint),
      (12::bigint, 15::bigint),
      (24::bigint, 152::bigint),
      (44::bigint, 47::bigint),
      (56::bigint, 102::bigint),
      (58::bigint, 60::bigint),
      (71::bigint, 34::bigint),
      (77::bigint, 66::bigint),
      (85::bigint, 68::bigint),
      (93::bigint, 70::bigint),
      (112::bigint, 105::bigint),
      (164::bigint, 519::bigint),
      (166::bigint, 191::bigint),
      (169::bigint, 156::bigint),
      (215::bigint, 134::bigint),
      (232::bigint, 223::bigint),
      (233::bigint, 170::bigint),
      (271::bigint, 271::bigint),
      (338::bigint, 340::bigint),
      (449::bigint, 551::bigint),
      (482::bigint, 441::bigint),
      (489::bigint, 489::bigint),
      (495::bigint, 569::bigint),
      (520::bigint, 426::bigint)
    ) as expected(product_id, default_variant_id)
    left join public.product_variants v on v.id = expected.default_variant_id
    where v.id is null or v.product_id is distinct from expected.product_id or v.variant_key is distinct from 'default' or v.is_default is distinct from true or v.is_active is distinct from true
  ) then
    raise exception 'Whey Okay Medium batch 1 variant seed blocked: default variant identity changed';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text, display_name text, flavour_code text, flavour_label text, size_value numeric, size_unit text, pack_count integer, product_format text, is_default boolean, is_active boolean)
    join public.product_variants v on v.product_id = e.product_id and v.variant_key = e.variant_key
    where v.display_name is distinct from e.display_name or v.flavour_code is distinct from e.flavour_code or v.flavour_label is distinct from e.flavour_label or v.size_value is distinct from e.size_value or v.size_unit is distinct from e.size_unit or v.pack_count is distinct from e.pack_count or v.product_format is distinct from e.product_format or v.gtin is not null or v.image is not null or v.nutrition_override is distinct from '{}'::jsonb or v.is_default is distinct from e.is_default or v.is_active is distinct from e.is_active
  ) then
    raise exception 'Whey Okay Medium batch 1 variant seed blocked: expected variant key has drifted values';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text, flavour_code text, size_value numeric, size_unit text, pack_count integer, product_format text)
    join public.product_variants v on v.product_id is not distinct from e.product_id and v.flavour_code is not distinct from e.flavour_code and v.size_value is not distinct from e.size_value and v.size_unit is not distinct from e.size_unit and v.pack_count is not distinct from e.pack_count and v.product_format is not distinct from e.product_format
    where v.variant_key is distinct from e.variant_key
  ) then
    raise exception 'Whey Okay Medium batch 1 variant seed blocked: semantic duplicate exists under another key';
  end if;

  if exists (
    select 1 from public.product_variants v where v.product_id in (6, 11, 12, 24, 44, 56, 58, 71, 77, 85, 93, 112, 164, 166, 169, 215, 232, 233, 271, 338, 449, 482, 489, 495, 520) and v.is_default is distinct from true and not exists (select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text) where e.product_id = v.product_id and e.variant_key = v.variant_key)
  ) then
    raise exception 'Whey Okay Medium batch 1 variant seed blocked: unexpected non-default variant exists';
  end if;

  select count(*) into v_missing from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text) where not exists (select 1 from public.product_variants v where v.product_id = e.product_id and v.variant_key = e.variant_key);

  insert into public.product_variants (product_id, variant_key, display_name, flavour_code, flavour_label, size_value, size_unit, pack_count, product_format, gtin, image, nutrition_override, is_default, is_active)
  select e.product_id, e.variant_key, e.display_name, e.flavour_code, e.flavour_label, e.size_value, e.size_unit, e.pack_count, e.product_format, null, null, '{}'::jsonb, e.is_default, e.is_active
  from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text, display_name text, flavour_code text, flavour_label text, size_value numeric, size_unit text, pack_count integer, product_format text, is_default boolean, is_active boolean)
  where not exists (select 1 from public.product_variants v where v.product_id = e.product_id and v.variant_key = e.variant_key)
  order by e.product_id, e.variant_key;

  get diagnostics v_inserted = row_count;
  if v_inserted is distinct from v_missing then
    raise exception 'Whey Okay Medium batch 1 variant seed failed: inserted % variants instead of %', v_inserted, v_missing;
  end if;

  if (select count(*) from public.product_variants where product_id in (6, 11, 12, 24, 44, 56, 58, 71, 77, 85, 93, 112, 164, 166, 169, 215, 232, 233, 271, 338, 449, 482, 489, 495, 520) and is_default is distinct from true) is distinct from 25
     or (select count(*) from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text) join public.product_variants v on v.product_id=e.product_id and v.variant_key=e.variant_key) is distinct from 25 then
    raise exception 'Whey Okay Medium batch 1 variant seed failed: final target inventory is not exactly 25 variants';
  end if;
end;
$seed_whey_okay_medium_batch_1_canonical_variants$;

commit;
