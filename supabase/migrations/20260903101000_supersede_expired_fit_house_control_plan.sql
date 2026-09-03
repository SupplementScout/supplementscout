begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $repair$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_parent constant uuid := 'fbb260ad-0984-40ef-8136-38dba975d6d0';
  v_parent_fingerprint constant text := 'fb0ded40e9d062b0d2ae7717041b58fc64d97e2317f56f30abd5060433f60c69';
  v_batch_approval constant uuid := 'f158a21f-2d17-4fa3-b30a-828024ab1336';
  v_close_fingerprint constant text := '6ec76a1936e02175651c646a9974f184dfd5709499184c9b6804508604a61e3a';
  v_now timestamptz := clock_timestamp();
  v_before jsonb;
  v_after jsonb;
  v_rows integer;
  v_result jsonb;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'expired Fit House control-plan repair target mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:9',0));
  v_before := public.retailer_catalogue_business_counts();

  perform 1 from public.retailer_catalogue_parent_plans p
  where p.id=v_parent and p.parent_plan_fingerprint=v_parent_fingerprint
    and p.retailer_id=9 and p.target_environment='PRODUCTION'
    and p.status='APPROVED' and p.code_commit='ab8c319e61cdcaa43e640c7aa18fbee4fe51256b'
    and p.source_snapshot_fingerprint='ef14011b0634d3f20053a569323eb8170defb458d28d22b1bbf700ef2416f1bb'
    and p.source_captured_at='2026-08-30T08:33:12.157Z'::timestamptz
    and p.approval_id='10bc4bc6-8ac9-4b4e-ba81-c4d6cb17074f'::uuid
    and p.approval_expires_at='2026-08-30T08:47:25.408Z'::timestamptz
    and p.approval_expires_at<clock_timestamp() and p.approval_consumed_at is null
  for update;
  if not found then raise exception 'expired Fit House parent precondition mismatch'; end if;

  if (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent)<>6
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPROVED')<>1
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='PLANNED')<>5
     or (select count(*) from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id=v_parent)<>0
     or (select count(*) from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_parent)<>1
     or not exists(
       select 1 from public.retailer_offer_sync_batch_approvals a
       where a.id=v_batch_approval and a.child_plan_id='1ba29bc2-26ad-4aef-9489-a383c68858d4'::uuid
         and a.artifact_fingerprint='1cb51de62319c683650f17c3848c7f39eff065fa03653ad17355463dd21fda5a'
         and a.execution_fingerprint='43c791f90d02a4721cd054c8eb5ad81da788cd1b6e74eb114d03685f5a40cb25'
         and a.expires_at='2026-08-30T08:47:25.408Z'::timestamptz
         and a.expires_at<clock_timestamp() and a.consumed_at is null and a.closed_at is null and a.result is null
     )
     or exists(
       select 1 from public.approved_import_plans
       where source='retailer_offer_mixed_batch'
         and artifact_sha256='1cb51de62319c683650f17c3848c7f39eff065fa03653ad17355463dd21fda5a'
         and run_id like 'mbs-43c791f90d02a472-%'
     ) then
    raise exception 'expired Fit House child, approval or execution precondition mismatch';
  end if;

  v_result := jsonb_build_object(
    'status','SUPERSEDED','approval_id',v_batch_approval,'parent_plan_id',v_parent,
    'closed_at',v_now,'closed_by','owner-approved-fit-house-expired-plan-repair',
    'reason','Expired unexecuted Fit House control plan superseded',
    'request_fingerprint',v_close_fingerprint,'approval_consumed',false,
    'parent_status','SUPERSEDED','child_count',6,'apply_runs',0,
    'business_writes',0,'price_history_writes',0,'control_writes',8
  );
  update public.retailer_offer_sync_batch_approvals
  set closed_at=v_now,closed_by='owner-approved-fit-house-expired-plan-repair',
      close_reason='Expired unexecuted Fit House control plan superseded',
      close_request_fingerprint=v_close_fingerprint,close_result=v_result
  where id=v_batch_approval and consumed_at is null and closed_at is null;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'expired Fit House approval repair affected % rows',v_rows; end if;

  update public.retailer_catalogue_child_plans
  set status='SUPERSEDED',updated_at=v_now,
      audit_log=audit_log||jsonb_build_array(jsonb_build_object(
        'event','EXPIRED_FIT_HOUSE_PLAN_SUPERSEDED','at',v_now,
        'authority','owner-approved-chat-2026-09-03-fit-house-control-plan-repair'))
  where parent_plan_id=v_parent and status in ('PLANNED','APPROVED');
  get diagnostics v_rows=row_count;
  if v_rows<>6 then raise exception 'expired Fit House child repair affected % rows',v_rows; end if;

  update public.retailer_catalogue_parent_plans
  set status='SUPERSEDED',updated_at=v_now,
      audit_log=audit_log||jsonb_build_array(jsonb_build_object(
        'event','EXPIRED_FIT_HOUSE_PLAN_SUPERSEDED','at',v_now,
        'authority','owner-approved-chat-2026-09-03-fit-house-control-plan-repair',
        'children_superseded',6,'business_writes',0))
  where id=v_parent and status='APPROVED';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'expired Fit House parent repair affected % rows',v_rows; end if;

  v_after := public.retailer_catalogue_business_counts();
  if v_after is distinct from v_before
     or (select status from public.retailer_catalogue_parent_plans where id=v_parent)<>'SUPERSEDED'
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='SUPERSEDED')<>6
     or not exists(select 1 from public.retailer_offer_sync_batch_approvals where id=v_batch_approval and closed_at=v_now and consumed_at is null and close_result=v_result) then
    raise exception 'expired Fit House control-plan repair postcondition mismatch';
  end if;
end
$repair$;

commit;
