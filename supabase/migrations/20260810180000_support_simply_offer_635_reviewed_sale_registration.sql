begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $support_simply_sale_registration$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_function regprocedure:='public.register_reviewed_mixed_change_control_plan(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_function);
  v_old text:=$old$v_contract->>'authorization_id'='simply-49-2bc798f9fb7db4af-production'$old$;
  v_new text:=$new$v_contract->>'authorization_id' in (
          'simply-49-2bc798f9fb7db4af-production',
          'simply-offer635-sale-20260810-production')$new$;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Simply offer 635 reviewed sale registration support requires production database owner';
  end if;
  if not exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='simply-offer635-sale-20260810-production'
      and retailer_id=7 and contract_version=4
  ) then
    raise exception 'Simply offer 635 reviewed sale authorization is missing';
  end if;
  if position(v_old in v_definition)=0
     or position('simply-offer635-sale-20260810-production' in v_definition)>0 then
    raise exception 'Simply offer 635 registration anchor mismatch';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$support_simply_sale_registration$;

alter function public.register_reviewed_mixed_change_control_plan(jsonb) owner to postgres;
revoke all on function public.register_reviewed_mixed_change_control_plan(jsonb)
  from public,anon,authenticated,service_role;

do $verify_simply_sale_registration$
declare
  v_definition text:=pg_get_functiondef(
    'public.register_reviewed_mixed_change_control_plan(jsonb)'::regprocedure);
begin
  if position('simply-49-2bc798f9fb7db4af-production' in v_definition)=0
     or position('simply-offer635-sale-20260810-production' in v_definition)=0
     or position($check$p_request->>'retailer_slug'='simply-supplements'$check$ in v_definition)=0
     or position($check$p_request->>'source_domain'='simplysupplements.co.uk'$check$ in v_definition)=0 then
    raise exception 'Simply offer 635 reviewed sale registration verification failed';
  end if;
end
$verify_simply_sale_registration$;

commit;
