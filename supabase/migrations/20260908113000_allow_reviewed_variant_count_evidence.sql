begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_updated text;
  v_evidence_old text := $$p_plan#>'{product_variant,evidence}',$$;
  v_evidence_new text := $$(p_plan#>'{product_variant,evidence}') - array['unit_count','unit_type'],$$;
  v_validate_old text := $$or ((p_plan#>>'{product_variant,evidence,size_value}' is null) <>
        (p_plan#>>'{product_variant,evidence,size_unit}' is null)) then$$;
  v_validate_new text := $$or ((p_plan#>>'{product_variant,evidence,size_value}' is null) <>
        (p_plan#>>'{product_variant,evidence,size_unit}' is null))
    or ((p_plan#>>'{product_variant,evidence,unit_count}' is null) <>
        (p_plan#>>'{product_variant,evidence,unit_type}' is null))
    or (p_plan#>>'{product_variant,evidence,unit_count}' is not null and
        ((p_plan#>>'{product_variant,evidence,unit_count}') !~ '^[1-9][0-9]*$'
         or nullif(btrim(p_plan#>>'{product_variant,evidence,unit_type}'), '') is null)) then$$;
  v_apply_types_old text := $$or jsonb_typeof(p_plan#>'{product_variant,evidence,approved_mapping_id}') not in ('string','null') then$$;
  v_apply_types_new text := $$or jsonb_typeof(p_plan#>'{product_variant,evidence,approved_mapping_id}') not in ('string','null')
  or jsonb_typeof(p_plan#>'{product_variant,evidence,unit_count}') not in ('string','null')
  or jsonb_typeof(p_plan#>'{product_variant,evidence,unit_type}') not in ('string','null') then$$;
  v_apply_values_old text := $$or (v_evidence->>'pack_count')::integer <= 0
     or exists ($$;
  v_apply_values_new text := $$or (v_evidence->>'pack_count')::integer <= 0
     or ((v_evidence->>'unit_count' is null) <> (v_evidence->>'unit_type' is null))
     or (v_evidence->>'unit_count' is not null and
         ((v_evidence->>'unit_count') !~ '^[1-9][0-9]*$'
          or nullif(btrim(v_evidence->>'unit_type'), '') is null))
     or exists ($$;
begin
  foreach v_signature in array array[
    'public.atomic_import_validate_standard_plan_core(jsonb)'::regprocedure,
    'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure
  ] loop
    v_definition := pg_get_functiondef(v_signature);
    if (length(v_definition)-length(replace(v_definition,v_evidence_old,'')))/length(v_evidence_old) <> 2 then
      raise exception 'variant evidence schema guard drift: %', v_signature;
    end if;
    v_updated := replace(v_definition,v_evidence_old,v_evidence_new);

    if v_signature = 'public.atomic_import_validate_standard_plan_core(jsonb)'::regprocedure then
      if (length(v_updated)-length(replace(v_updated,v_validate_old,'')))/length(v_validate_old) <> 1 then
        raise exception 'variant count validation guard drift: %', v_signature;
      end if;
      v_updated := replace(v_updated,v_validate_old,v_validate_new);
    else
      if (length(v_updated)-length(replace(v_updated,v_apply_types_old,'')))/length(v_apply_types_old) <> 1
         or (length(v_updated)-length(replace(v_updated,v_apply_values_old,'')))/length(v_apply_values_old) <> 1 then
        raise exception 'variant count apply guard drift: %', v_signature;
      end if;
      v_updated := replace(v_updated,v_apply_types_old,v_apply_types_new);
      v_updated := replace(v_updated,v_apply_values_old,v_apply_values_new);
    end if;
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
    if v_definition not like '%(p_plan#>''{product_variant,evidence}'') - array[''unit_count'', ''unit_type'']%'
       or v_definition not like '%product_variant,evidence,unit_count%'
       or v_definition not like '%product_variant,evidence,unit_type%' then
      raise exception 'reviewed variant count evidence installation failed: %', v_signature;
    end if;
  end loop;
end
$postflight$;

commit;
