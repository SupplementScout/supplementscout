begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Policy only: permit the exact reviewed 10 Reps v8 anchor plans to retain
-- their genuine short WooCommerce product and variation identifiers.
do $preflight$
begin
  if to_regprocedure('public.atomic_import_10reps_v8_parent_variant_transport_allowed(jsonb,jsonb)') is null
     or to_regprocedure('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)') is null then
    raise exception '10 Reps v8 short source ID prerequisites are missing';
  end if;
end
$preflight$;

do $short_source_id_policy$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure
  );
  v_old text := $old$  or v_external_product_id !~ '^[0-9]{10,}$'
  or v_external_variant_id !~ '^[0-9]{10,}$'
  or v_external_product_id = v_external_variant_id$old$;
  v_new text := $new$  or (
    (
      v_external_product_id !~ '^[0-9]{10,}$'
      or v_external_variant_id !~ '^[0-9]{10,}$'
      or v_external_product_id = v_external_variant_id
    )
    and not public.atomic_import_10reps_v8_parent_variant_transport_allowed(
      p_plan,
      jsonb_build_object(
        'id','14','name','10 Reps','slug','10-reps','website','https://www.10reps.co.uk/'
      )
    )
  )$new$;
begin
  if (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1
     or position('10 Reps short WooCommerce source IDs' in v_definition) > 0 then
    raise exception '10 Reps v8 short source ID anchor/state mismatch';
  end if;

  v_new := v_new || E'\n  -- 10 Reps short WooCommerce source IDs';
  execute replace(v_definition, v_old, v_new);
end
$short_source_id_policy$;

alter function public.atomic_import_validate_pre_source_metadata_plan_core(jsonb) owner to postgres;

do $postflight$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure
  );
begin
  if position('10 Reps short WooCommerce source IDs' in v_definition) = 0
     or position('atomic_import_10reps_v8_parent_variant_transport_allowed' in v_definition) = 0
     or has_function_privilege(
       'service_role',
       'public.atomic_import_10reps_v8_parent_variant_transport_allowed(jsonb,jsonb)',
       'EXECUTE'
     ) then
    raise exception '10 Reps v8 short source ID policy verification failed';
  end if;
end
$postflight$;

commit;
