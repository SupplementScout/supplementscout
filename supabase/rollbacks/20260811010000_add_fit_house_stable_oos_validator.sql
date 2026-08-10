begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_dispatch regprocedure:='public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_dispatch);
  v_old text:=$old$  if p_request ? 'reviewed_mixed_change_contract' then
    return public.retailer_offer_sync_validate_reviewed_mixed_change_internal(p_request);
  end if;
  if p_request#>>'{artifact,target_environment}'='PRODUCTION'
     and p_request#>>'{artifact,retailer_id}'='9'
     and p_request->>'policy_fingerprint'='6838770659dc772a3454846ad8e2e9e9620839b3ca688b118e9337231e520db6' then
    return public.validate_fit_house_stable_oos_read_only(p_request);
  end if;$old$;
  v_new text:=$new$  if p_request ? 'reviewed_mixed_change_contract' then
    return public.retailer_offer_sync_validate_reviewed_mixed_change_internal(p_request);
  end if;$new$;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Fit House stable OOS validator rollback requires production database owner';
  end if;
  if exists(
    select 1 from public.retailer_catalogue_parent_plans p
    where p.retailer_id=9 and p.target_environment='PRODUCTION'
      and p.status in ('PLANNED','APPROVED','PARTIALLY_APPLIED','FAILED')
  ) or exists(
    select 1 from public.retailer_catalogue_child_plans c
    where c.retailer_id=9 and c.target_environment='PRODUCTION'
      and c.status in ('PLANNED','APPROVED','APPLYING','FAILED')
  ) or exists(
    select 1 from public.retailer_offer_sync_batch_approvals a
    join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id
    where c.retailer_id=9 and c.target_environment='PRODUCTION'
      and a.consumed_at is null
  ) or exists(
    select 1 from public.retailer_catalogue_apply_runs r
    join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id
    where c.retailer_id=9 and c.target_environment='PRODUCTION'
      and r.status='STARTED'
  ) then
    raise exception 'Fit House stable OOS validator rollback blocked by active control state';
  end if;
  if to_regprocedure('public.validate_fit_house_stable_oos_read_only(jsonb)') is null
     or position(v_old in v_definition)=0 then
    raise exception 'Fit House stable OOS validator rollback anchor mismatch';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$rollback$;

drop function public.validate_fit_house_stable_oos_read_only(jsonb);

alter function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb) owner to postgres;
revoke all on function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)
  from public,anon,authenticated,service_role;

commit;
