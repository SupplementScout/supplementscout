begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_updated text;
  v_old text := $$or not public.atomic_import_safe_create_category_allowed(p_plan#>>'{approval,approved_category}', p_plan#>>'{product,values,name}', p_plan#>>'{product,values,product_format}')$$;
  v_new text := $$or (not public.atomic_import_safe_create_category_allowed(p_plan#>>'{approval,approved_category}', p_plan#>>'{product,values,name}', p_plan#>>'{product,values,product_format}')
        and not (p_plan#>>'{approval,approved_category}' = 'Energy Supplements'
          and public.atomic_import_reviewed_catalogue_plan_allowed(p_plan)))$$;
begin
  if to_regprocedure('public.atomic_import_reviewed_catalogue_plan_allowed(jsonb)') is null then
    raise exception 'reviewed catalogue package prerequisite is missing';
  end if;

  foreach v_signature in array array[
    'public.atomic_import_validate_standard_plan_core(jsonb)'::regprocedure,
    'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure
  ] loop
    v_definition := pg_get_functiondef(v_signature);
    if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1 then
      raise exception 'safe-create category guard drift: %', v_signature;
    end if;
    v_updated := replace(v_definition,v_old,v_new);
    execute v_updated;
  end loop;
end
$migration$;

do $postflight$
declare
  v_signature regprocedure;
  v_definition text;
begin
  foreach v_signature in array array[
    'public.atomic_import_validate_standard_plan_core(jsonb)'::regprocedure,
    'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure
  ] loop
    v_definition := pg_get_functiondef(v_signature);
    if v_definition not like '%approved_category}'' = ''Energy Supplements''%'
       or v_definition not like '%atomic_import_reviewed_catalogue_plan_allowed(p_plan)%' then
      raise exception 'owner-reviewed Energy Supplements guard installation failed: %', v_signature;
    end if;
  end loop;
end
$postflight$;

commit;
