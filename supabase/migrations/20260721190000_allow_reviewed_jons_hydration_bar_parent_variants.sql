begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)') is null then
    raise exception 'reviewed parent explicit-variant allowlist helper is missing';
  end if;
  if to_regprocedure('public.validate_product_import_plan_read_only(jsonb)') is null
     or to_regprocedure('public.apply_product_import_plan(jsonb)') is null then
    raise exception 'reviewed parent explicit-variant importer RPCs are missing';
  end if;
end
$preflight$;

create or replace function public.atomic_import_reviewed_parent_variant_allowed(
  p_name text,
  p_brand text,
  p_category text,
  p_format text,
  p_size_value text,
  p_size_unit text
) returns boolean
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from (values
      ('CNP Loaded Beef Protein 1.8kg','CNP','Whey Protein','powder','1800','g'),
      ('CNP Loaded ISO Collagen Protein 2kg','CNP','Whey Protein','powder','2000','g'),
      ('CNP Peptide Whey Protein Blend 2.27kg','CNP','Whey Protein','powder','2270','g'),
      ('CNP Premium Whey 2kg','CNP','Whey Protein','powder','2000','g'),
      ('CNP Premium Whey 900g','CNP','Whey Protein','powder','900','g'),
      ('CNP Whey Isolate 1.8kg','CNP','Whey Protein','powder','1800','g'),
      ('Strom StimuMAX Black Edition 360g','Strom','Pre Workout','powder','360','g'),
      ('Strom StimuMAX Extreme Pre Workout 390g','Strom','Pre Workout','powder','390','g'),
      ('Strom StimuMAX OG Pre Workout 360g','Strom','Pre Workout','powder','360','g'),
      ('Strom StimuMAX PRO Pre Workout 360g','Strom','Pre Workout','powder','360','g'),
      ('Strom VascuMAX PRO 470g','Strom','Pre Workout','powder','470','g'),
      ('Trained By JP ISO PRO 1.8kg','Trained By JP','Whey Protein','powder','1800','g'),
      ('Trained By JP Performance Isolate Tri Blend 2kg','Trained By JP','Whey Protein','powder','2000','g'),
      ('Trained By JP Performance Protein 1kg','Trained By JP','Whey Protein','powder','1000','g'),
      ('Trained By JP Performance Protein 2kg','Trained By JP','Whey Protein','powder','2000','g'),
      ('Trained By JP DNFM PRE 40 Servings','Trained By JP','Pre Workout','powder','40','servings'),
      ('Trained By JP PrePare Pro 400g','Trained By JP','Pre Workout','powder','400','g'),
      ('Trained By JP Pumpage Pre Workout 400g','Trained By JP','Pre Workout','powder','400','g'),
      ('ABE All Black Everything Pre-Workout 375g','ABE All','Pre Workout','powder','375','g'),
      ('PER4M Energy Pre Workout 390g','PER4M','Pre Workout','powder','390','g'),
      ('HR Labs DEFIB V3 Pre-Workout 420g','HR Labs','Pre Workout','powder','420','g'),
      ('Gas Mark 10 No Games Pre Workout 30 Servings','Gas Mark 10','Pre Workout','powder','30','servings'),
      ('Innovapharm MVPRE 3.0 Pre Workout 437g','Innovapharm','Pre Workout','powder','437','g'),
      ('Conteh Sports Hydra Flow 300g','Conteh Sports','Health Supplements','powder','300','g'),
      ('PER4M Hydrate Electrolyte Mix 210g','PER4M','Health Supplements','powder','210','g'),
      ('PER4M Protein Bars Box of 12 x 62g','PER4M','Protein Bars','bar','62','g'),
      ('Strom Sports HydraMax 420g','Strom','Health Supplements','powder','420','g'),
      ('Strom Sports HydraMax 1.08kg','Strom','Health Supplements','powder','1080','g')
    ) as allowed(name, brand, category, format, size_value, size_unit)
    where allowed.name = p_name
      and allowed.brand = p_brand
      and allowed.category = p_category
      and allowed.format = p_format
      and allowed.size_value::numeric is not distinct from nullif(p_size_value,'')::numeric
      and allowed.size_unit = lower(coalesce(p_size_unit,''))
  );
$$;

commit;
