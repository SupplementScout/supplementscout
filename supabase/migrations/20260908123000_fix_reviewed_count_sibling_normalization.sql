begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $migration$
declare
  v_signature regprocedure := 'public.validate_reviewed_catalogue_import_plan(jsonb)'::regprocedure;
  v_definition text := pg_get_functiondef(v_signature);
  v_updated text;
  v_old text := $$public.atomic_import_normalized_identity(reviewed_option.option_name) in ('size','pack size','count')
                     and public.atomic_import_normalized_identity(reviewed_option.option_value) in (
                       (p_plan#>>'{product_variant,evidence,unit_count}') || ' ' ||
                         (p_plan#>>'{product_variant,evidence,unit_type}'),
                       (p_plan#>>'{product_variant,evidence,unit_count}') || ' ' ||
                         case p_plan#>>'{product_variant,evidence,unit_type}'$$;
  v_new text := $$public.atomic_import_normalized_identity(reviewed_option.option_name) in ('size','packsize','count')
                     and public.atomic_import_normalized_identity(reviewed_option.option_value) in (
                       (p_plan#>>'{product_variant,evidence,unit_count}') ||
                         (p_plan#>>'{product_variant,evidence,unit_type}'),
                       (p_plan#>>'{product_variant,evidence,unit_count}') ||
                         case p_plan#>>'{product_variant,evidence,unit_type}'$$;
begin
  if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1 then
    raise exception 'reviewed count sibling normalization guard drift';
  end if;
  v_updated := replace(v_definition,v_old,v_new);
  execute v_updated;
end
$migration$;

do $postflight$
declare
  v_definition text := pg_get_functiondef('public.validate_reviewed_catalogue_import_plan(jsonb)'::regprocedure);
begin
  if v_definition not like '%option_name) in (''size'',''packsize'',''count'')%'
     or v_definition not like '%unit_count}'') ||%unit_type}'')%'
     or v_definition not like '%when ''capsules'' then ''caps''%'
     or v_definition like '%option_name) in (''size'',''pack size'',''count'')%' then
    raise exception 'reviewed count sibling normalization installation failed';
  end if;
end
$postflight$;

commit;
