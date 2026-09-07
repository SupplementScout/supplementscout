begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Policy only: allow the already fingerprint-bound v10 transport through the
-- independent short WooCommerce source-ID gate.
do $preflight$
begin
  if to_regprocedure('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)') is null
     or to_regprocedure('public.atomic_import_10reps_v10_parent_variant_transport_allowed(jsonb,jsonb)') is null then
    raise exception '10 Reps v10 short-source policy prerequisites are missing';
  end if;
end
$preflight$;

do $short_source_policy$
declare
  v_definition text := pg_get_functiondef('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure);
  v_old text := $old$    and not public.atomic_import_10reps_v9_parent_variant_transport_allowed(
      p_plan,
      jsonb_build_object(
        'id','14','name','10 Reps','slug','10-reps','website','https://www.10reps.co.uk/'
      )
    )
  )
  -- 10 Reps short WooCommerce source IDs$old$;
  v_new text := $new$    and not public.atomic_import_10reps_v9_parent_variant_transport_allowed(
      p_plan,
      jsonb_build_object(
        'id','14','name','10 Reps','slug','10-reps','website','https://www.10reps.co.uk/'
      )
    )
    and not public.atomic_import_10reps_v10_parent_variant_transport_allowed(
      p_plan,
      jsonb_build_object(
        'id','14','name','10 Reps','slug','10-reps','website','https://www.10reps.co.uk/'
      )
    )
  )
  -- 10 Reps short WooCommerce source IDs$new$;
begin
  if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1
     or position($marker$and not public.atomic_import_10reps_v10_parent_variant_transport_allowed($marker$ in v_definition) > 0 then
    raise exception '10 Reps v10 short-source policy anchor/state mismatch';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$short_source_policy$;

alter function public.atomic_import_validate_pre_source_metadata_plan_core(jsonb) owner to postgres;

do $postflight$
declare
  v_definition text := pg_get_functiondef('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure);
  v_marker text := 'and not public.atomic_import_10reps_v10_parent_variant_transport_allowed(';
begin
  if (length(v_definition)-length(replace(v_definition,v_marker,'')))/length(v_marker) <> 1 then
    raise exception '10 Reps v10 short-source policy verification failed';
  end if;
end
$postflight$;

commit;
