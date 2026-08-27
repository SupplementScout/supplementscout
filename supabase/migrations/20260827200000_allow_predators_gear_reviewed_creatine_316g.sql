begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)') is null
     or to_regprocedure('public.validate_product_import_plan_read_only(jsonb)') is null
     or to_regprocedure('public.apply_product_import_plan(jsonb)') is null then
    raise exception 'existing reviewed importer policy is missing';
  end if;
end
$preflight$;

do $reviewed_parent_policy$
declare
  v_definition text := pg_get_functiondef('public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)'::regprocedure);
  v_anchor text := '(''Trained By JP Join-In 210g'',''Trained By JP'',''Health Supplements'',''powder'',''210'',''g'')';
  v_replacement text := v_anchor || ',
      (''DY Nutrition The Creatine Complex 316g'',''DY Nutrition'',''Creatine'',''powder'',''316'',''g'')';
begin
  if position(v_anchor in v_definition) = 0
     or position('DY Nutrition The Creatine Complex 316g' in v_definition) > 0 then
    raise exception 'reviewed-parent policy anchor/state mismatch';
  end if;
  execute replace(v_definition, v_anchor, v_replacement);
end
$reviewed_parent_policy$;

alter function public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text) owner to postgres;

do $postflight$
begin
  if not public.atomic_import_reviewed_parent_variant_allowed(
       'DY Nutrition The Creatine Complex 316g',
       'DY Nutrition',
       'Creatine',
       'powder',
       '316',
       'g'
     )
     or public.atomic_import_reviewed_parent_variant_allowed(
       'DY Nutrition The Creatine Complex 400g',
       'DY Nutrition',
       'Creatine',
       'powder',
       '400',
       'g'
     )
     or public.atomic_import_reviewed_parent_variant_allowed(
       'DY Nutrition The Creatine Complex 316g',
       'DY Nutrition',
       'Health Supplements',
       'powder',
       '316',
       'g'
     )
     or position(
       'perform public.validate_product_import_plan_read_only(p_plan)',
       pg_get_functiondef('public.apply_product_import_plan(jsonb)'::regprocedure)
     ) = 0 then
    raise exception 'Predators Gear reviewed creatine policy verification failed';
  end if;
end
$postflight$;

commit;
