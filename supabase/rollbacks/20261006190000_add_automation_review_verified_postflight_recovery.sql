begin;

do $$
begin
  if exists (
    select 1 from public.automation_review_execution_events
    where checkpoint='VERIFIED_POSTFLIGHT_RECOVERY'
  ) then raise exception 'AUTOMATION_RECOVERY_ROLLBACK_BLOCKED_BY_USED_EVIDENCE'; end if;
end;
$$;

revoke all on function public.reconcile_automation_review_verified_postflight(uuid,text,jsonb) from public, anon, authenticated, service_role;
drop function public.reconcile_automation_review_verified_postflight(uuid,text,jsonb);

commit;
