begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $guard$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_definition text:=pg_get_functiondef('public.prepare_sequential_retailer_offer_sync_parent_approval(jsonb)'::regprocedure);
  v_before jsonb;
  v_after jsonb;
  v_now timestamptz:=clock_timestamp();
  v_rows integer;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Fit House parent approval target mismatch';
  end if;
  if md5(v_definition)<>'c0a21cce669814ae4f900c9858081754' then
    raise exception 'Fit House parent approval function definition mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:9',0));
  v_before:=public.retailer_catalogue_business_counts();
  perform 1 from public.retailer_catalogue_parent_plans p
  where p.id='ab47be4a-abed-41b0-8c24-58015005840b'::uuid
    and p.retailer_id=9
    and p.parent_plan_fingerprint='14a2fea85d813474c14a56fea704e3d9c7316fa99d1887774f29fd1f883a140e'
    and p.created_by='github:SupplementScout/supplementscout:35753256468:1'
    and p.code_commit='2cf12487d242328acb4a35f743b2ab8cad7b77e1'
    and p.target_environment='PRODUCTION' and p.status='PLANNED'
    and p.approval_id is null and p.approval_consumed_at is null
    and (p.plan_json->>'expires_at')::timestamptz='2026-09-22T17:03:25.479Z'::timestamptz
  for update;
  if not found then raise exception 'Fit House failed parent precondition mismatch'; end if;
  if (select count(*) from public.retailer_catalogue_child_plans c where c.parent_plan_id='ab47be4a-abed-41b0-8c24-58015005840b'::uuid)<>2
     or (select count(*) from public.retailer_catalogue_child_plans c where c.parent_plan_id='ab47be4a-abed-41b0-8c24-58015005840b'::uuid and c.status='PLANNED')<>2
     or exists(select 1 from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id='ab47be4a-abed-41b0-8c24-58015005840b'::uuid)
     or exists(select 1 from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id='ab47be4a-abed-41b0-8c24-58015005840b'::uuid) then
    raise exception 'Fit House failed child/run/approval precondition mismatch';
  end if;
  update public.retailer_catalogue_child_plans
    set status='SUPERSEDED',updated_at=v_now,audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','FAILED_FIT_HOUSE_APPROVAL_SUPERSEDED','at',v_now,'authority','owner-chat-2026-09-22-six-offer-retry'))
    where parent_plan_id='ab47be4a-abed-41b0-8c24-58015005840b'::uuid and status='PLANNED';
  get diagnostics v_rows=row_count;
  if v_rows<>2 then raise exception 'Fit House child cleanup count mismatch'; end if;
  update public.retailer_catalogue_parent_plans
    set status='SUPERSEDED',updated_at=v_now,audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','FAILED_FIT_HOUSE_APPROVAL_SUPERSEDED','at',v_now,'authority','owner-chat-2026-09-22-six-offer-retry','business_writes',0))
    where id='ab47be4a-abed-41b0-8c24-58015005840b'::uuid and status='PLANNED';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Fit House parent cleanup count mismatch'; end if;
  v_after:=public.retailer_catalogue_business_counts();
  if v_after is distinct from v_before then raise exception 'Fit House parent cleanup changed business counts'; end if;
end
$guard$;

create or replace function public.prepare_sequential_retailer_offer_sync_parent_approval(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $prepare$
declare
  v_effective_role text:=current_setting('role',true);
  v_parent public.retailer_catalogue_parent_plans%rowtype;
  v_workflow jsonb;
  v_expected_actor text;
  v_slug text;
  v_result jsonb;
begin
  if v_effective_role is distinct from 'retailer_catalogue_production_approver'
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
     or v_parent.retailer_id not in (4,5,7,8,9,14) or v_parent.target_environment<>'PRODUCTION'
     or v_parent.status<>'PLANNED' or v_parent.approval_id is not null
     or exists(select 1 from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_parent.id and c.status<>'PLANNED') then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Sequential parent is not a fresh approved-retailer plan');
  end if;
  v_slug:=case v_parent.retailer_id when 4 then 'discount-supplements' when 5 then 'dolphin-fitness' when 7 then 'simply-supplements' when 8 then 'kior-health' when 9 then 'fit-house' when 14 then '10-reps' end;
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
