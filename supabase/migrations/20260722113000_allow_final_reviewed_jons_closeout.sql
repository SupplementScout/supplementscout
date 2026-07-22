begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.atomic_import_safe_create_category_allowed(text,text,text)') is null
     or to_regprocedure('public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)') is null
     or to_regprocedure('public.atomic_import_validate_variant_plan_core(jsonb)') is null
     or to_regprocedure('public.validate_product_import_plan_read_only(jsonb)') is null
     or to_regprocedure('public.apply_product_import_plan(jsonb)') is null then
    raise exception 'existing reviewed importer policy is missing';
  end if;
end
$preflight$;

create or replace function public.atomic_import_safe_create_category_allowed(
  p_category text,
  p_name text,
  p_product_format text
)
returns boolean
language sql
immutable
parallel safe
as $$
  select
    coalesce(p_category, '') in ('Vitamins','Health Supplements','Amino Acids','Creatine')
    or (
      coalesce(p_product_format, '') = 'powder'
      and (
        (
          coalesce(p_category, '') = 'Whey Protein'
          and coalesce(p_name, '') ~* '(^|[^[:alnum:]])(efectiv[[:space:]]+whey[[:space:]]+protein|grass[-[:space:]]*fed[[:space:]]+whey[[:space:]]+protein[[:space:]]+isolate|whey([[:space:]]+protein)?[[:space:]]+isolate|mountain[[:space:]]+joe''?s[[:space:]]+shake[[:space:]]+a[[:space:]]+whey|egg[[:space:]]+white[[:space:]]+protein)([^[:alnum:]]|$)'
        )
        or (
          coalesce(p_category, '') = 'Pre Workout'
          and coalesce(p_name, '') ~* '(^|[^[:alnum:]])(pitbull[[:space:]]+pump|mega[[:space:]]+pump[[:space:]]+elite|pump[[:space:]]+pre[-[:space:]]*workout|defib[[:space:]]+original|mvpre[[:space:]]+365|hypermax''?d[[:space:]]+out|pharma[[:space:]]+grade[[:space:]]+pre|cellucor[[:space:]]+c4[[:space:]]+ripped[[:space:]]+180g)([^[:alnum:]]|$)'
        )
        or (
          coalesce(p_category, '') = 'Amino Acids'
          and coalesce(p_name, '') ~* '(^|[^[:alnum:]])essential[[:space:]]+gains[[:space:]]+eaa([^[:alnum:]]|$)'
        )
        or (
          coalesce(p_category, '') = 'Health Supplements'
          and coalesce(p_name, '') ~* '(^|[^[:alnum:]])(greens|cream[[:space:]]+of[[:space:]]+rice|cream[[:space:]]+of[[:space:]]+oats|protein[[:space:]]+pancakes?)([^[:alnum:]]|$)'
        )
      )
    )
$$;

do $reviewed_parent_policy$
declare
  v_definition text := pg_get_functiondef('public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)'::regprocedure);
  v_anchor text := '(''Strom MSM (Methylsulfonylmethane) 83 Servings'',''Strom'',''Health Supplements'',''powder'',''83'',''servings'')';
  v_replacement text := v_anchor || ',
      (''CNP ProDough Protein Bars Box of 12 x 60g'',''CNP'',''Protein Bars'',''bar'',''60'',''g''),
      (''Efectiv Whey Protein 2kg'',''Efectiv'',''Whey Protein'',''powder'',''2000'',''g''),
      (''PER4M Hydrate Unflavoured 159g'',''PER4M'',''Health Supplements'',''powder'',''159'',''g''),
      (''Strom Sports LipidMax 400g'',''Strom'',''Health Supplements'',''powder'',''400'',''g''),
      (''Time 4 Whey Protein Professional 1.8kg'',''Time 4'',''Whey Protein'',''powder'',''1800'',''g''),
      (''Trained By JP Collagen Powder 300g'',''Trained By JP'',''Health Supplements'',''powder'',''300'',''g''),
      (''Trained By JP Hydration 300g'',''Trained By JP'',''Health Supplements'',''powder'',''300'',''g''),
      (''Trained By JP Join-In 210g'',''Trained By JP'',''Health Supplements'',''powder'',''210'',''g'')';
begin
  if position(v_anchor in v_definition) = 0
     or position('CNP ProDough Protein Bars Box of 12 x 60g' in v_definition) > 0 then
    raise exception 'reviewed-parent policy anchor/state mismatch';
  end if;
  execute replace(v_definition, v_anchor, v_replacement);
end
$reviewed_parent_policy$;

do $no_sku_without_default$
declare
  v_definition text := pg_get_functiondef('public.atomic_import_validate_variant_plan_core(jsonb)'::regprocedure);
  v_original text := 'if (select count(*) from public.product_variants where product_id=v_product_id and is_active and is_default) <> 1 then';
  v_replacement text := 'if (select count(*) from public.product_variants where product_id=v_product_id and is_active and is_default) > 1
     or ((select count(*) from public.product_variants where product_id=v_product_id and is_active and is_default) = 0
       and v_external_sku is not null) then';
begin
  if position(v_original in v_definition) = 0
     or position('and v_external_sku is not null) then' in v_definition) > 0 then
    raise exception 'no-SKU create-variant validator anchor/state mismatch';
  end if;
  execute replace(v_definition, v_original, v_replacement);
end
$no_sku_without_default$;

alter function public.atomic_import_safe_create_category_allowed(text,text,text) owner to postgres;
alter function public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text) owner to postgres;
alter function public.atomic_import_validate_variant_plan_core(jsonb) owner to postgres;

do $postflight$
begin
  if not public.atomic_import_safe_create_category_allowed('Pre Workout','Cellucor C4 Ripped 180g','powder')
     or public.atomic_import_safe_create_category_allowed('Pre Workout','Unreviewed C4 Product 180g','powder')
     or not public.atomic_import_reviewed_parent_variant_allowed('CNP ProDough Protein Bars Box of 12 x 60g','CNP','Protein Bars','bar','60','g')
     or not public.atomic_import_reviewed_parent_variant_allowed('Efectiv Whey Protein 2kg','Efectiv','Whey Protein','powder','2000','g')
     or not public.atomic_import_reviewed_parent_variant_allowed('PER4M Hydrate Unflavoured 159g','PER4M','Health Supplements','powder','159','g')
     or not public.atomic_import_reviewed_parent_variant_allowed('Strom Sports LipidMax 400g','Strom','Health Supplements','powder','400','g')
     or not public.atomic_import_reviewed_parent_variant_allowed('Time 4 Whey Protein Professional 1.8kg','Time 4','Whey Protein','powder','1800','g')
     or not public.atomic_import_reviewed_parent_variant_allowed('Trained By JP Collagen Powder 300g','Trained By JP','Health Supplements','powder','300','g')
     or not public.atomic_import_reviewed_parent_variant_allowed('Trained By JP Hydration 300g','Trained By JP','Health Supplements','powder','300','g')
     or not public.atomic_import_reviewed_parent_variant_allowed('Trained By JP Join-In 210g','Trained By JP','Health Supplements','powder','210','g')
     or public.atomic_import_reviewed_parent_variant_allowed('Efectiv Whey Protein 1.8kg','Efectiv','Whey Protein','powder','1800','g')
     or position('and v_external_sku is not null) then' in pg_get_functiondef('public.atomic_import_validate_variant_plan_core(jsonb)'::regprocedure)) = 0
     or position('perform public.validate_product_import_plan_read_only(p_plan)' in pg_get_functiondef('public.apply_product_import_plan(jsonb)'::regprocedure)) = 0 then
    raise exception 'final Jon''s closeout policy verification failed';
  end if;
end
$postflight$;

commit;
