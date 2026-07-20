begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.atomic_import_validate_standard_plan_core(jsonb)') is null
     or to_regprocedure('public.atomic_import_apply_standard_plan_core(jsonb)') is null then
    raise exception 'existing atomic importer core is missing';
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
          and coalesce(p_name, '') ~* '(^|[^[:alnum:]])(pitbull[[:space:]]+pump|mega[[:space:]]+pump[[:space:]]+elite|pump[[:space:]]+pre[-[:space:]]*workout|defib[[:space:]]+original|mvpre[[:space:]]+365|hypermax''?d[[:space:]]+out|pharma[[:space:]]+grade[[:space:]]+pre)([^[:alnum:]]|$)'
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

comment on function public.atomic_import_safe_create_category_allowed(text,text,text)
  is 'DB-side safe-create category/family policy aligned to reviewed supplement families while preserving existing atomic import guards.';

do $rewrite$
declare
  v_signature regprocedure;
  v_definition text;
  v_original text := 'p_plan#>>''{approval,approved_category}'' not in (''Vitamins'',''Health Supplements'',''Amino Acids'',''Creatine'')';
  v_replacement text := 'not public.atomic_import_safe_create_category_allowed(p_plan#>>''{approval,approved_category}'', p_plan#>>''{product,values,name}'', p_plan#>>''{product,values,product_format}'')';
begin
  foreach v_signature in array array[
    'public.atomic_import_validate_standard_plan_core(jsonb)'::regprocedure,
    'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure
  ] loop
    v_definition := pg_get_functiondef(v_signature);
    if position(v_original in v_definition) = 0 then
      raise exception 'safe-create category predicate not found in %', v_signature::text;
    end if;
    execute replace(v_definition, v_original, v_replacement);
  end loop;
end
$rewrite$;

alter function public.atomic_import_safe_create_category_allowed(text,text,text) owner to postgres;

do $grants$
declare
  v_role text;
begin
  foreach v_role in array array[
    'service_role',
    'retailer_catalogue_staging_approver',
    'retailer_catalogue_staging_executor',
    'retailer_catalogue_production_approver',
    'retailer_catalogue_production_executor'
  ] loop
    if exists (select 1 from pg_roles where rolname = v_role) then
      execute format(
        'grant execute on function public.atomic_import_safe_create_category_allowed(text,text,text) to %I',
        v_role
      );
    end if;
  end loop;
end
$grants$;

commit;
