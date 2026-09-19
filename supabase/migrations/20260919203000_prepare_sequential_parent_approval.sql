begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $cleanup$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_parent constant uuid:='6bf06253-9309-4ec7-98ae-003047d946cb';
  v_now timestamptz:=clock_timestamp();
  v_before jsonb;
  v_rows integer;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'sequential parent-approval target mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:14',0));
  v_before:=public.retailer_catalogue_business_counts();
  perform 1 from public.retailer_catalogue_parent_plans p where p.id=v_parent
    and p.parent_plan_fingerprint='047ec2a6c2d773af8509b0c63fb987bfdb8c0d4cc3026ae6bf96453818864c12'
    and p.retailer_id=14 and p.target_environment='PRODUCTION' and p.status='PARTIALLY_APPLIED'
    and p.code_commit='3e384421ae7908b9e721f391e69c37a03b8bfef4'
    and p.source_snapshot_fingerprint='4ac2def92a63eb99924a8481a2ac48050b85ee234d09f39f72f6b4f14f0e62a0'
    and p.created_by='github:SupplementScout/supplementscout:35463121940:1'
    and p.approval_expires_at='2026-09-19T19:20:08.691Z'::timestamptz
    and p.approval_expires_at<clock_timestamp() for update;
  if not found then raise exception 'failed 10 Reps parent precondition mismatch'; end if;
  if (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent)<>19
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPLIED')<>1
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='PLANNED')<>18
     or (select coalesce(sum(jsonb_array_length(record_ids)),0) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPLIED')<>50
     or (select coalesce(sum(jsonb_array_length(record_ids)),0) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='PLANNED')<>885
     or (select count(*) from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id=v_parent and r.status='SUCCEEDED')<>1
     or exists(select 1 from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id=v_parent and r.status='STARTED')
     or (select count(*) from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_parent and a.consumed_at is not null)<>1
     or exists(select 1 from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_parent and a.consumed_at is null and a.closed_at is null)
     or (select coalesce(sum((a.result->>'business_writes')::integer),0) from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_parent and a.consumed_at is not null)<>50
     or (select coalesce(sum((a.result->>'price_history_delta')::integer),0) from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_parent and a.consumed_at is not null)<>0 then
    raise exception 'failed 10 Reps child/run/approval precondition mismatch';
  end if;
  update public.retailer_catalogue_child_plans set status='SUPERSEDED',updated_at=v_now,
    audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','INTERRUPTED_REFRESH_SUPERSEDED','at',v_now,'authority','owner-directed-chat-2026-09-19-complete-retailer-refreshes'))
  where parent_plan_id=v_parent and status='PLANNED';
  get diagnostics v_rows=row_count;
  if v_rows<>18 then raise exception 'failed 10 Reps child cleanup affected % rows',v_rows; end if;
  update public.retailer_catalogue_parent_plans set status='SUPERSEDED',updated_at=v_now,
    audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','INTERRUPTED_REFRESH_SUPERSEDED','at',v_now,'authority','owner-directed-chat-2026-09-19-complete-retailer-refreshes','preserved_applied_children',1,'preserved_refreshed_offers',50))
  where id=v_parent and status='PARTIALLY_APPLIED';
  get diagnostics v_rows=row_count;
  if v_rows<>1 or public.retailer_catalogue_business_counts() is distinct from v_before
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPLIED')<>1
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='SUPERSEDED')<>18 then
    raise exception 'failed 10 Reps cleanup postcondition mismatch';
  end if;
end
$cleanup$;

create or replace function public.prepare_sequential_retailer_offer_sync_parent_approval(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $prepare$
declare
  v_parent public.retailer_catalogue_parent_plans%rowtype;
  v_workflow jsonb;
  v_expected_actor text;
  v_slug text;
  v_result jsonb;
begin
  if current_user<>'retailer_catalogue_production_approver'
     or session_user<>'supplementscout_production_approver_login' then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Dedicated production approver identity required');
  end if;
  if not public.atomic_import_has_exact_keys(p_request,array['schema_version','parent_plan_id','parent_plan_fingerprint','retailer_id','approved_by','expires_at','workflow','production_project_ref','production_database_identity'])
     or p_request->>'schema_version'<>'1' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid sequential parent approval request');
  end if;
  perform public.retailer_catalogue_production_runtime_guard('PRODUCTION',p_request->>'production_project_ref',p_request->>'production_database_identity');
  if (p_request->>'expires_at')::timestamptz<=now()+interval '30 minutes'
     or (p_request->>'expires_at')::timestamptz>now()+interval '45 minutes' then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Sequential parent approval must be between 30 and 45 minutes');
  end if;
  v_workflow:=p_request->'workflow';
  if not public.atomic_import_has_exact_keys(v_workflow,array['repository','run_id','run_attempt','actor'])
     or v_workflow->>'repository'<>'SupplementScout/supplementscout' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid sequential workflow identity');
  end if;
  select * into v_parent from public.retailer_catalogue_parent_plans where id=(p_request->>'parent_plan_id')::uuid for update;
  if not found or v_parent.parent_plan_fingerprint is distinct from p_request->>'parent_plan_fingerprint'
     or v_parent.retailer_id is distinct from (p_request->>'retailer_id')::bigint
     or v_parent.retailer_id not in (7,14) or v_parent.target_environment<>'PRODUCTION'
     or v_parent.status<>'PLANNED' or v_parent.approval_id is not null
     or exists(select 1 from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_parent.id and c.status<>'PLANNED') then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Sequential parent is not a fresh approved-retailer plan');
  end if;
  v_slug:=case v_parent.retailer_id when 14 then '10-reps' when 7 then 'simply-supplements' end;
  v_expected_actor:='github-'||v_slug||'-sync:'||(v_workflow->>'run_id');
  if p_request->>'approved_by' is distinct from v_expected_actor
     or v_parent.created_by is distinct from 'github:'||(v_workflow->>'repository')||':'||(v_workflow->>'run_id')||':'||(v_workflow->>'run_attempt') then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Sequential parent workflow identity mismatch');
  end if;
  v_result:=public.approve_retailer_catalogue_parent_plan(v_parent.id,v_parent.parent_plan_fingerprint,v_expected_actor,(p_request->>'expires_at')::timestamptz);
  return v_result||jsonb_build_object('business_writes',0,'retailer_id',v_parent.retailer_id::text);
end
$prepare$;
alter function public.prepare_sequential_retailer_offer_sync_parent_approval(jsonb) owner to postgres;
revoke all on function public.prepare_sequential_retailer_offer_sync_parent_approval(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.prepare_sequential_retailer_offer_sync_parent_approval(jsonb) to retailer_catalogue_production_approver;
commit;
