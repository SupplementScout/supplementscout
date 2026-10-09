begin;

set local lock_timeout='5s';
set local statement_timeout='60s';

do $restore_shared_sequential_child_capacity$
declare
  v_function regprocedure;
  v_definition text;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('retailer-offer-sync:global-execution',0));

  foreach v_function in array array[
    to_regprocedure('public.register_retailer_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_fit_house_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_jons_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_whey_okay_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_discount_supplements_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_dolphin_vegan_protein_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_simply_supplements_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_kior_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_10reps_offer_sync_control_plan(jsonb)')
  ] loop
    if v_function is null then
      raise exception 'required shared sequential registration function missing';
    end if;
    select pg_get_functiondef(v_function) into v_definition;
    if (strpos(v_definition,
          'v_child_count < 1 or v_child_count > 50')=0
        and strpos(v_definition,
          'v_child_count<1 or v_child_count>50')=0) then
      raise exception 'shared sequential rollback definition drifted: %',
        v_function;
    end if;
    v_definition:=replace(
      v_definition,
      'v_child_count < 1 or v_child_count > 50',
      'v_child_count < 1 or v_child_count > 20');
    v_definition:=replace(
      v_definition,
      'v_child_count<1 or v_child_count>50',
      'v_child_count<1 or v_child_count>20');
    execute v_definition;
  end loop;
end
$restore_shared_sequential_child_capacity$;

commit;
