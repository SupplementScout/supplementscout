begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Policy only: the v10 transport is fingerprint-bound to the single reviewed
-- Applied Nutrition L-Carnitine liquid parent. All other non-powder/bar plans
-- continue to fail closed.
do $preflight$
begin
  if to_regprocedure('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)') is null
     or to_regprocedure('public.atomic_import_10reps_v10_parent_variant_transport_allowed(jsonb,jsonb)') is null then
    raise exception '10 Reps v10 reviewed-liquid prerequisites are missing';
  end if;
end
$preflight$;

do $reviewed_liquid_policy$
declare
  v_definition text := pg_get_functiondef('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure);
  v_old text := $old$  or v_product_values->>'product_format' not in ('powder','bar')$old$;
  v_new text := $new$  or (
    v_product_values->>'product_format' not in ('powder','bar')
    and not public.atomic_import_10reps_v10_parent_variant_transport_allowed(
      p_plan,
      jsonb_build_object(
        'id','14','name','10 Reps','slug','10-reps','website','https://www.10reps.co.uk/'
      )
    )
  )$new$;
begin
  if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1
     or position($marker$and not public.atomic_import_10reps_v10_parent_variant_transport_allowed($marker$ in
       substring(v_definition from position(v_old in v_definition) for 900)
     ) > 0 then
    raise exception '10 Reps v10 reviewed-liquid policy anchor/state mismatch';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$reviewed_liquid_policy$;

alter function public.atomic_import_validate_pre_source_metadata_plan_core(jsonb) owner to postgres;

do $postflight$
declare
  v_definition text := pg_get_functiondef('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure);
  v_anchor text := $anchor$v_product_values->>'product_format' not in ('powder','bar')$anchor$;
  v_marker text := 'and not public.atomic_import_10reps_v10_parent_variant_transport_allowed(';
  v_at integer := position(v_anchor in v_definition);
begin
  if v_at = 0
     or position(v_marker in substring(v_definition from v_at for 900)) = 0 then
    raise exception '10 Reps v10 reviewed-liquid policy verification failed';
  end if;
end
$postflight$;

commit;
