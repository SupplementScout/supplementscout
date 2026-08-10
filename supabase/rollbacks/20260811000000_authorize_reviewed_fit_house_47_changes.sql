begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_function regprocedure:='public.register_reviewed_mixed_change_control_plan(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_function);
  v_old text:=$old$       (p_request->>'kind'='retailer-existing-offer-sync-control-plan-registration'
        and p_request->>'retailer_slug'='simply-supplements'
        and p_request->>'source_domain'='simplysupplements.co.uk'
        and v_retailer_id=7
        and v_contract->>'authorization_id' in (
          'simply-49-2bc798f9fb7db4af-production',
          'simply-offer635-sale-20260810-production'))
       or
       (v_target='PRODUCTION'
        and p_request->>'kind'='retailer-existing-offer-sync-control-plan-registration'
        and p_request->>'retailer_slug'='fit-house'
        and p_request->>'source_domain'='fithouse.uk'
        and v_retailer_id=9
        and v_contract->>'authorization_id'='fit-house-47-168b5c604482280d-production')$old$;
  v_new text:=$new$       (p_request->>'kind'='retailer-existing-offer-sync-control-plan-registration'
        and p_request->>'retailer_slug'='simply-supplements'
        and p_request->>'source_domain'='simplysupplements.co.uk'
        and v_retailer_id=7
        and v_contract->>'authorization_id' in (
          'simply-49-2bc798f9fb7db4af-production',
          'simply-offer635-sale-20260810-production'))$new$;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Fit House reviewed 47-change rollback requires production database owner';
  end if;
  if exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings
    where authorization_id='fit-house-47-168b5c604482280d-production'
  ) or exists(
    select 1 from public.retailer_catalogue_child_plans
    where dependency_group='reviewed-mixed-change:fit-house-47-168b5c604482280d-production'
       or rollback_group='reviewed-mixed-change:fit-house-47-168b5c604482280d-production'
  ) then
    raise exception 'Fit House reviewed rollback is forbidden after any control-plan registration or binding';
  end if;
  if not exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='fit-house-47-168b5c604482280d-production'
      and retailer_id=9 and contract_version=1
  ) or position(v_old in v_definition)=0 then
    raise exception 'Fit House reviewed rollback exact authorization or function anchor is missing';
  end if;
  execute replace(v_definition,v_old,v_new);
  delete from public.retailer_offer_sync_reviewed_mixed_change_definitions
  where authorization_id='fit-house-47-168b5c604482280d-production'
    and retailer_id=9 and contract_version=1;
  if not found then raise exception 'Fit House reviewed authorization delete failed'; end if;
end
$rollback$;

alter function public.register_reviewed_mixed_change_control_plan(jsonb) owner to postgres;
revoke all on function public.register_reviewed_mixed_change_control_plan(jsonb)
  from public,anon,authenticated,service_role;

commit;
