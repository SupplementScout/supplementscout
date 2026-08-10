begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback_simply_sale_registration$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_function regprocedure:='public.register_reviewed_mixed_change_control_plan(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_function);
  v_old text:=$old$v_contract->>'authorization_id' in (
          'simply-49-2bc798f9fb7db4af-production',
          'simply-offer635-sale-20260810-production')$old$;
  v_new text:=$new$v_contract->>'authorization_id'='simply-49-2bc798f9fb7db4af-production'$new$;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Simply offer 635 registration rollback requires production database owner';
  end if;
  if exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings
    where authorization_id='simply-offer635-sale-20260810-production'
  ) then
    raise exception 'Simply offer 635 registration rollback is forbidden after plan binding';
  end if;
  if position(v_old in v_definition)=0 then
    raise exception 'Simply offer 635 registration rollback anchor is missing';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$rollback_simply_sale_registration$;

alter function public.register_reviewed_mixed_change_control_plan(jsonb) owner to postgres;
revoke all on function public.register_reviewed_mixed_change_control_plan(jsonb)
  from public,anon,authenticated,service_role;

commit;
