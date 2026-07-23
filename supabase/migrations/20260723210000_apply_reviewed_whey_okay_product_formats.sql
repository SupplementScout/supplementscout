begin;

do $migration$
declare
  v_rows jsonb := $rows$
  [
    {"name":"Ghost Legend V4 Pre-Workout 660g","slug":"ghost-legend-v4-pre-workout-660g","brand":"Ghost","category":"Pre Workout","product_format":"powder"},
    {"name":"BioTech USA Iso Whey Zero 1816g","slug":"biotech-usa-iso-whey-zero-1816g","brand":"BioTech USA","category":"Whey Protein","product_format":"powder"},
    {"name":"USN Blue Lab 100% Whey Premium Protein 2kg","slug":"usn-blue-lab-100-whey-premium-protein-2kg","brand":"USN","category":"Whey Protein","product_format":"powder"},
    {"name":"BioTech USA Iso Whey Zero 908g","slug":"biotech-usa-iso-whey-zero-908g","brand":"BioTech USA","category":"Whey Protein","product_format":"powder"},
    {"name":"Optimum Nutrition Gold Standard Pre-Workout 330g","slug":"optimum-nutrition-gold-standard-pre-workout-330g","brand":"Optimum Nutrition","category":"Pre Workout","product_format":"powder"},
    {"name":"PEScience High Volume 252g","slug":"pescience-high-volume-252g","brand":"PEScience","category":"Pre Workout","product_format":"powder"},
    {"name":"PEScience Amino IV 375g","slug":"pescience-amino-iv-375g","brand":"PEScience","category":"Amino Acids","product_format":"powder"},
    {"name":"BioTech USA Micellar Casein 908g","slug":"biotech-usa-micellar-casein-908g","brand":"BioTech USA","category":"Whey Protein","product_format":"powder"},
    {"name":"Optimum Nutrition Amino Energy 270g","slug":"optimum-nutrition-amino-energy-270g","brand":"Optimum Nutrition","category":"Amino Acids","product_format":"powder"},
    {"name":"Grenade Defend BCAA 390g","slug":"grenade-defend-bcaa-390g","brand":"Grenade","category":"Amino Acids","product_format":"powder"},
    {"name":"5% Nutrition Rich Piana  All Day You May 465g","slug":"5-nutrition-rich-piana--all-day-you-may-465g","brand":"5% Nutrition","category":"Amino Acids","product_format":"powder"},
    {"name":"Applied Nutrition Critical Mass Gainer 6kg","slug":"applied-nutrition-critical-mass-gainer-6kg","brand":"Applied Nutrition","category":"Mass Gainer","product_format":"powder"},
    {"name":"Optimum Nutrition Protein Crisp Bar 10x65g","slug":"optimum-nutrition-protein-crisp-bar-10x65g","brand":"Optimum Nutrition","category":"Protein Bars","product_format":"snack"},
    {"name":"Lenny & Larry's Complete Vegan Cookie  113g","slug":"lenny--larrys-complete-vegan-cookie--113g","brand":"Lenny & Larry","category":"Protein Bars","product_format":"snack"},
    {"name":"Clif Bar Energy Bar 12x68g","slug":"clif-bar-energy-bar-12x68g","brand":"Clif","category":"Protein Bars","product_format":"snack"},
    {"name":"Applied Nutrition ISO-XP 1.8kg","slug":"applied-nutrition-iso-xp-18kg","brand":"Applied Nutrition","category":"Whey Protein","product_format":"powder"},
    {"name":"Grenade Carb Killa Protein Bar 60g","slug":"grenade-carb-killa-protein-bar-60g","brand":"Grenade","category":"Protein Bars","product_format":"snack"},
    {"name":"Love Vegan High Energy Protein Bite 45g","slug":"love-vegan-high-energy-protein-bite-45g","brand":"Love Vegan","category":"Protein Bars","product_format":"snack"},
    {"name":"BioTech USA Black Blood CAF+ 300g","slug":"biotech-usa-black-blood-caf-300g","brand":"BioTech USA","category":"Pre Workout","product_format":"powder"},
    {"name":"BioTech USA Black Blood NOX+ 330g","slug":"biotech-usa-black-blood-nox-330g","brand":"BioTech USA","category":"Pre Workout","product_format":"powder"},
    {"name":"Grenade Carb Killa Protein Spread 360g","slug":"grenade-carb-killa-protein-spread-360g","brand":"Grenade","category":"Protein Bars","product_format":"spread"},
    {"name":"Applied Nutrition Clear Whey Protein 875g","slug":"applied-nutrition-clear-whey-protein-875g","brand":"Applied Nutrition","category":"Whey Protein","product_format":"powder"},
    {"name":"USN QHUSH Black Pre-workout 220g","slug":"usn-qhush-black-pre-workout-220g","brand":"Unknown","category":"Pre Workout","product_format":"powder"},
    {"name":"Naughty Boy Winter Soldier Sick Pump 325g","slug":"naughty-boy-winter-soldier-sick-pump-325g","brand":"Naughty Boy","category":"Pre Workout","product_format":"powder"},
    {"name":"Reflex Nutrition Clear Whey Isolate 510g 17 Servings","slug":"reflex-nutrition-clear-whey-isolate-510g-17-servings","brand":"Reflex Nutrition","category":"Whey Protein","product_format":"powder"},
    {"name":"Mutant Madness Pre Workout 225g","slug":"mutant-madness-pre-workout-225g","brand":"Mutant","category":"Pre Workout","product_format":"powder"},
    {"name":"Creatine Gummies 400g 80 Gummies  Applied Nutrition","slug":"creatine-gummies-400g-80-gummies--applied-nutrition","brand":"Applied Nutrition","category":"Creatine","product_format":"gummy"}
  ]
  $rows$::jsonb;
  v_blank integer;
  v_exact integer;
  v_updated integer;
begin
  if current_setting('app.safe_update', true) is not null then
    raise exception using
      errcode = 'P0001',
      message = 'WHEY_OKAY_FORMATS_SAFE_UPDATE_MUST_BE_UNSET';
  end if;

  if jsonb_array_length(v_rows) <> 27 then
    raise exception using
      errcode = 'P0001',
      message = 'WHEY_OKAY_FORMATS_PACKAGE_ROW_COUNT_MISMATCH';
  end if;

  if (
    select count(distinct value->>'slug')
    from jsonb_array_elements(v_rows)
  ) <> 27 then
    raise exception using
      errcode = 'P0001',
      message = 'WHEY_OKAY_FORMATS_PACKAGE_DUPLICATE_IDENTITY';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_rows) as e(
      name text,
      slug text,
      brand text,
      category text,
      product_format text
    )
    where (
      select count(*)
      from public.products p
      where p.name = e.name
        and p.slug = e.slug
        and p.brand is not distinct from e.brand
        and p.category is not distinct from e.category
        and p.is_active is true
        and p.merged_into_product_id is null
    ) <> 1
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'WHEY_OKAY_FORMATS_CANONICAL_IDENTITY_MISMATCH';
  end if;

  perform p.id
  from public.products p
  join jsonb_to_recordset(v_rows) as e(
    name text,
    slug text,
    brand text,
    category text,
    product_format text
  )
    on p.name = e.name
   and p.slug = e.slug
   and p.brand is not distinct from e.brand
   and p.category is not distinct from e.category
  where p.is_active is true
    and p.merged_into_product_id is null
  order by p.id
  for update of p;

  select
    count(*) filter (where p.product_format is null),
    count(*) filter (where p.product_format = e.product_format)
  into v_blank, v_exact
  from public.products p
  join jsonb_to_recordset(v_rows) as e(
    name text,
    slug text,
    brand text,
    category text,
    product_format text
  )
    on p.name = e.name
   and p.slug = e.slug
   and p.brand is not distinct from e.brand
   and p.category is not distinct from e.category
  where p.is_active is true
    and p.merged_into_product_id is null;

  if not (
    (v_blank = 27 and v_exact = 0)
    or (v_blank = 0 and v_exact = 27)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'WHEY_OKAY_FORMATS_PARTIAL_OR_CONFLICTING_STATE';
  end if;

  with expected as (
    select *
    from jsonb_to_recordset(v_rows) as e(
      name text,
      slug text,
      brand text,
      category text,
      product_format text
    )
  )
  update public.products p
  set product_format = e.product_format
  from expected e
  where p.name = e.name
    and p.slug = e.slug
    and p.brand is not distinct from e.brand
    and p.category is not distinct from e.category
    and p.product_format is null
    and p.is_active is true
    and p.merged_into_product_id is null;

  get diagnostics v_updated = row_count;

  if v_updated not in (0, 27) then
    raise exception using
      errcode = 'P0001',
      message = 'WHEY_OKAY_FORMATS_UPDATE_COUNT_MISMATCH';
  end if;

  if (
    select count(*)
    from public.products p
    join jsonb_to_recordset(v_rows) as e(
      name text,
      slug text,
      brand text,
      category text,
      product_format text
    )
      on p.name = e.name
     and p.slug = e.slug
     and p.brand is not distinct from e.brand
     and p.category is not distinct from e.category
     and p.product_format = e.product_format
    where p.is_active is true
      and p.merged_into_product_id is null
  ) <> 27 then
    raise exception using
      errcode = 'P0001',
      message = 'WHEY_OKAY_FORMATS_POSTCONDITION_FAILED';
  end if;
end
$migration$;

commit;
