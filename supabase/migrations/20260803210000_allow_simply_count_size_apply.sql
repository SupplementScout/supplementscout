begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Keep the write-side guard identical to the read-only guard. Shopify's Size
-- for this exact Simply identity bootstrap is a reviewed unit count such as
-- "60 capsules", not physical mass or volume.
do $allow_simply_count_size_apply$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure
  );
  v_original text := $anchor$  if v_option_size is not null then
    v_normalized_option_size := public.atomic_import_normalize_size(v_option_size);$anchor$;
  v_replacement text := $anchor$  if v_option_size is not null
     and not public.atomic_import_is_simply_identity_only_upgrade(p_plan) then
    v_normalized_option_size := public.atomic_import_normalize_size(v_option_size);
    /* Simply reviewed count-size write binding */$anchor$;
begin
  if v_definition is null
     or position('Simply complete reviewed options binding' in pg_get_functiondef(
       'public.atomic_import_is_simply_identity_only_upgrade(jsonb)'::regprocedure
     )) = 0
     or position(v_original in v_definition) = 0 then
    raise exception 'Simply count-size apply precondition failed';
  end if;
  execute replace(v_definition, v_original, v_replacement);
end;
$allow_simply_count_size_apply$;

alter function public.atomic_import_apply_standard_plan_core(jsonb) owner to postgres;
revoke all on function public.atomic_import_apply_standard_plan_core(jsonb)
  from public, anon, authenticated, service_role;

do $verify_simply_count_size_apply$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure
  );
begin
  if position('Simply reviewed count-size write binding' in v_definition) = 0
     or position('not public.atomic_import_is_simply_identity_only_upgrade(p_plan)' in v_definition) = 0 then
    raise exception 'Simply count-size apply verification failed';
  end if;
end;
$verify_simply_count_size_apply$;

commit;
