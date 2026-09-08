begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $migration$
declare
  v_signature regprocedure := 'public.validate_reviewed_catalogue_import_plan(jsonb)'::regprocedure;
  v_definition text;
  v_updated text;
  v_parent_count_old text := $$(v_product_action='existing' and exists (
               select 1 from public.products p
               where p.id=v_product_id
                 and p.unit_count=(p_plan#>>'{product_variant,evidence,unit_count}')::integer
                 and p.unit_type=p_plan#>>'{product_variant,evidence,unit_type}'
             ))$$;
  v_parent_count_new text := $$(v_product_action='existing' and (
               exists (
                 select 1 from public.products p
                 where p.id=v_product_id
                   and p.unit_count=(p_plan#>>'{product_variant,evidence,unit_count}')::integer
                   and p.unit_type=p_plan#>>'{product_variant,evidence,unit_type}'
               )
               or (
                 v_variant_values->>'product_format' = p_plan#>>'{expected_state,product,product_format}'
                 and (v_variant_values->>'variant_key') ~
                   ('(^|[^0-9])' || (p_plan#>>'{product_variant,evidence,unit_count}') ||
                    '[-_ ]' || (p_plan#>>'{product_variant,evidence,unit_type}') || '([^a-z]|$)')
                 and lower(v_variant_values->>'display_name') ~
                   ('(^|[^0-9])' || (p_plan#>>'{product_variant,evidence,unit_count}') ||
                    '[ /_-]+' || (p_plan#>>'{product_variant,evidence,unit_type}') || '([^a-z]|$)')
                 and exists (
                   select 1
                   from jsonb_each_text(coalesce(v_mapping->'external_options','{}'::jsonb)) as reviewed_option(option_name, option_value)
                   where public.atomic_import_normalized_identity(reviewed_option.option_name) in ('size','pack size','count')
                     and public.atomic_import_normalized_identity(reviewed_option.option_value) in (
                       (p_plan#>>'{product_variant,evidence,unit_count}') || ' ' ||
                         (p_plan#>>'{product_variant,evidence,unit_type}'),
                       (p_plan#>>'{product_variant,evidence,unit_count}') || ' ' ||
                         case p_plan#>>'{product_variant,evidence,unit_type}'
                           when 'capsules' then 'caps'
                           when 'tablets' then 'tabs'
                           else p_plan#>>'{product_variant,evidence,unit_type}'
                         end
                     )
                 )
               )
             ))$$;
  v_duplicate_old text := $$and (pv.variant_key=v_variant_values->>'variant_key'
          or (pv.flavour_code is not distinct from v_variant_values->>'flavour_code'
            and pv.size_value is not distinct from (v_variant_values->>'size_value')::numeric
            and pv.size_unit is not distinct from v_variant_values->>'size_unit'
            and pv.pack_count is not distinct from (v_variant_values->>'pack_count')::integer))$$;
  v_duplicate_new text := $$and (pv.variant_key=v_variant_values->>'variant_key'
          or (p_plan#>>'{product_variant,evidence,unit_count}' is null
            and pv.flavour_code is not distinct from v_variant_values->>'flavour_code'
            and pv.size_value is not distinct from (v_variant_values->>'size_value')::numeric
            and pv.size_unit is not distinct from v_variant_values->>'size_unit'
            and pv.pack_count is not distinct from (v_variant_values->>'pack_count')::integer))$$;
begin
  v_definition := pg_get_functiondef(v_signature);
  if (length(v_definition)-length(replace(v_definition,v_parent_count_old,'')))/length(v_parent_count_old) <> 1 then
    raise exception 'reviewed parent count guard drift';
  end if;
  v_updated := replace(v_definition,v_parent_count_old,v_parent_count_new);

  if (length(v_updated)-length(replace(v_updated,v_duplicate_old,'')))/length(v_duplicate_old) <> 1 then
    raise exception 'reviewed count duplicate guard drift';
  end if;
  v_updated := replace(v_updated,v_duplicate_old,v_duplicate_new);
  execute v_updated;
end
$migration$;

do $postflight$
declare
  v_definition text := pg_get_functiondef('public.validate_reviewed_catalogue_import_plan(jsonb)'::regprocedure);
begin
  if v_definition not like '%jsonb_each_text(coalesce(v_mapping->''external_options''%'
     or v_definition not like '%reviewed_option.option_name%'
     or v_definition not like '%p_plan#>>''{product_variant,evidence,unit_count}'' is null%'
     or v_definition not like '%when ''capsules'' then ''caps''%'
     or v_definition not like '%when ''tablets'' then ''tabs''%' then
    raise exception 'reviewed count sibling guard installation failed';
  end if;
end
$postflight$;

commit;
