begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.retailer_offer_sync_batch_approvals') is null
     or to_regprocedure('public.retailer_catalogue_staging_runtime_guard(text,text,text)') is null
     or to_regprocedure('public.retailer_catalogue_assert_migration_ledger(jsonb,text)') is null
     or to_regprocedure('public.retailer_catalogue_staging_request_fingerprint(jsonb)') is null
     or to_regrole('retailer_catalogue_staging_approver') is null
     or to_regrole('retailer_catalogue_staging_executor') is null
     or to_regrole('retailer_catalogue_staging_validator') is null then
    raise exception 'expired mixed approval close requires staging executor, mixed-batch executor and validator migrations';
  end if;
  if to_regprocedure('public.close_expired_retailer_offer_sync_approval(jsonb)') is not null
     or exists(
       select 1 from information_schema.columns
       where table_schema='public' and table_name='retailer_offer_sync_batch_approvals'
         and column_name in ('closed_at','closed_by','close_reason','close_request_fingerprint','close_result')
     ) then
    raise exception 'expired mixed approval close is already installed; rerun rejected';
  end if;
end
$preflight$;

alter table public.retailer_offer_sync_batch_approvals
  add column closed_at timestamptz,
  add column closed_by text,
  add column close_reason text,
  add column close_request_fingerprint text,
  add column close_result jsonb,
  add constraint retailer_offer_sync_batch_close_state check (
    (closed_at is null and closed_by is null and close_reason is null and close_request_fingerprint is null and close_result is null)
    or
    (closed_at is not null and nullif(trim(closed_by),'') is not null and length(close_reason) between 1 and 500
      and close_request_fingerprint ~ '^[0-9a-f]{64}$' and jsonb_typeof(close_result)='object' and consumed_at is null)
  ),
  add constraint retailer_offer_sync_batch_close_fingerprint_unique unique(close_request_fingerprint);

drop index public.retailer_offer_sync_one_active_approval;
create unique index retailer_offer_sync_one_active_approval
  on public.retailer_offer_sync_batch_approvals(child_plan_id)
  where consumed_at is null and closed_at is null;

create or replace function public.retailer_offer_sync_close_expired_approval_internal(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path=pg_catalog,public,pg_temp
as $close_expired_internal$
declare
  v_approval public.retailer_offer_sync_batch_approvals%rowtype;
  v_child public.retailer_catalogue_child_plans%rowtype;
  v_parent public.retailer_catalogue_parent_plans%rowtype;
  v_request_fingerprint text;
  v_actual_migration_fingerprint text;
  v_row_approvals integer;
  v_apply_runs integer;
  v_recovery_manifests integer;
  v_recovery_approvals integer;
  v_recovery_audit integer;
  v_before_business jsonb;
  v_after_business jsonb;
  v_closed_at timestamptz;
  v_result jsonb;
  v_audit jsonb;
begin
  if not public.atomic_import_has_exact_keys(p_request,array[
    'schema_version','approval_id','parent_plan_id','child_plan_id',
    'parent_plan_fingerprint','child_plan_fingerprint','artifact_fingerprint','execution_fingerprint',
    'approval_expected_migration_fingerprint','expected_migration_versions','expected_migration_fingerprint',
    'migration_fingerprint_algorithm','migration_fingerprint_version','target_environment','staging_project_ref',
    'staging_database_identity','reason','closed_by','requested_at','request_fingerprint'
  ]) then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid expired approval close request keys');
  end if;
  if p_request->>'schema_version'<>'1'
     or p_request->>'migration_fingerprint_algorithm'<>'SHA-256'
     or p_request->>'migration_fingerprint_version'<>'RSBI-CJ1'
     or p_request->>'expected_migration_fingerprint'!~'^[0-9a-f]{64}$'
     or p_request->>'approval_expected_migration_fingerprint'!~'^[0-9a-f]{64}$'
     or p_request->>'artifact_fingerprint'!~'^[0-9a-f]{64}$'
     or p_request->>'execution_fingerprint'!~'^[0-9a-f]{64}$'
     or p_request->>'parent_plan_fingerprint'!~'^[0-9a-f]{64}$'
     or p_request->>'child_plan_fingerprint'!~'^[0-9a-f]{64}$'
     or jsonb_typeof(p_request->'expected_migration_versions') is distinct from 'array'
     or jsonb_array_length(p_request->'expected_migration_versions')<1
     or exists(select 1 from jsonb_array_elements_text(p_request->'expected_migration_versions') v where v!~'^[0-9]+_[a-z0-9_]+$')
     or (select count(*) from jsonb_array_elements_text(p_request->'expected_migration_versions'))<>(select count(distinct value) from jsonb_array_elements_text(p_request->'expected_migration_versions'))
     or length(trim(p_request->>'reason')) not between 1 and 500
     or nullif(trim(p_request->>'closed_by'),'') is null then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid expired approval close request values');
  end if;

  perform public.retailer_catalogue_staging_runtime_guard(
    p_request->>'target_environment',p_request->>'staging_project_ref',p_request->>'staging_database_identity'
  );
  v_actual_migration_fingerprint:=public.retailer_catalogue_assert_migration_ledger(
    p_request->'expected_migration_versions',p_request->>'expected_migration_fingerprint'
  );
  v_request_fingerprint:=public.retailer_catalogue_staging_request_fingerprint(p_request);
  if p_request->>'request_fingerprint' is distinct from v_request_fingerprint then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Expired approval close request fingerprint mismatch');
  end if;

  select * into v_approval
  from public.retailer_offer_sync_batch_approvals
  where id=(p_request->>'approval_id')::uuid
  for update;
  if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Mixed-batch approval not found'); end if;

  select * into v_child
  from public.retailer_catalogue_child_plans
  where id=(p_request->>'child_plan_id')::uuid
  for update;
  if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Linked child plan not found'); end if;

  select * into v_parent
  from public.retailer_catalogue_parent_plans
  where id=(p_request->>'parent_plan_id')::uuid
  for update;
  if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Linked parent plan not found'); end if;

  if v_approval.child_plan_id is distinct from v_child.id
     or v_child.parent_plan_id is distinct from v_parent.id
     or v_approval.target_environment is distinct from 'STAGING'
     or v_approval.target_environment is distinct from p_request->>'target_environment'
     or v_approval.project_ref is distinct from p_request->>'staging_project_ref'
     or v_approval.database_identity is distinct from p_request->>'staging_database_identity'
     or v_approval.artifact_fingerprint is distinct from p_request->>'artifact_fingerprint'
     or v_approval.execution_fingerprint is distinct from p_request->>'execution_fingerprint'
     or v_approval.expected_migration_fingerprint is distinct from p_request->>'approval_expected_migration_fingerprint'
     or v_parent.parent_plan_fingerprint is distinct from p_request->>'parent_plan_fingerprint'
     or v_child.parent_plan_fingerprint is distinct from v_parent.parent_plan_fingerprint
     or v_child.child_plan_fingerprint is distinct from p_request->>'child_plan_fingerprint'
     or v_child.child_plan_fingerprint is distinct from v_approval.artifact_fingerprint
     or v_child.plan_json is distinct from v_approval.approved_manifest
     or v_child.source_snapshot_fingerprint is distinct from v_parent.source_snapshot_fingerprint
     or v_child.canonical_snapshot_fingerprint is distinct from v_parent.canonical_snapshot_fingerprint
     or v_child.adapter_fingerprint is distinct from v_parent.adapter_fingerprint
     or v_child.policy_fingerprint is distinct from v_parent.policy_fingerprint
     or v_child.code_commit is distinct from v_parent.code_commit
     or v_child.expected_state_fingerprint is distinct from v_parent.expected_state_fingerprint then
    perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Expired approval does not exactly bind target parent and child');
  end if;

  if v_approval.closed_at is not null then
    if v_approval.close_request_fingerprint is distinct from v_request_fingerprint
       or v_parent.status<>'EXPIRED' or v_child.status<>'EXPIRED'
       or v_approval.close_result is null then
      perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Expired approval was closed by a different request or has inconsistent state');
    end if;
    return v_approval.close_result||jsonb_build_object('already_closed',true,'control_writes',0);
  end if;

  if (p_request->>'requested_at')::timestamptz<clock_timestamp()-interval '15 minutes'
     or (p_request->>'requested_at')::timestamptz>clock_timestamp()+interval '5 minutes' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_STALE','Expired approval close request is stale or future');
  end if;
  if v_approval.expires_at>clock_timestamp()
     or v_parent.approval_expires_at>clock_timestamp()
     or v_child.approval_expires_at>clock_timestamp() then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Approval is not expired');
  end if;
  if v_approval.consumed_at is not null
     or v_parent.approval_consumed_at is not null
     or v_child.approval_consumed_at is not null then
    perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Consumed approval cannot be closed as expired');
  end if;
  if v_parent.status<>'APPROVED' or v_child.status<>'APPROVED'
     or v_parent.approval_id is null or v_child.approval_id is null
     or v_parent.approval_expires_at is distinct from v_approval.expires_at
     or v_child.approval_expires_at is distinct from v_approval.expires_at then
    perform public.retailer_catalogue_raise('RSBI_INVALID_TRANSITION','Parent or child is not an exact unexecuted expired approval');
  end if;
  if v_approval.result is not null then
    perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Approval already contains execution result');
  end if;

  select count(*) into v_row_approvals
  from public.approved_import_plans
  where source='retailer_offer_mixed_batch'
    and artifact_sha256=v_approval.artifact_fingerprint
    and run_id like 'mbs-'||left(v_approval.execution_fingerprint,16)||'-%';
  select count(*) into v_apply_runs from public.retailer_catalogue_apply_runs where child_plan_id=v_child.id;
  select count(*) into v_recovery_manifests from public.retailer_catalogue_staging_recovery_manifests where child_plan_id=v_child.id;
  select count(*) into v_recovery_approvals
  from public.retailer_catalogue_staging_recovery_approvals a
  join public.retailer_catalogue_staging_recovery_manifests m on m.id=a.recovery_manifest_id
  where m.child_plan_id=v_child.id;
  select count(*) into v_recovery_audit
  from public.retailer_catalogue_staging_recovery_audit a
  join public.retailer_catalogue_staging_recovery_manifests m on m.id=a.recovery_manifest_id
  where m.child_plan_id=v_child.id;
  if v_row_approvals<>0 then perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Row approvals exist for expired mixed batch'); end if;
  if v_recovery_manifests<>0 or v_recovery_approvals<>0 or v_recovery_audit<>0 then
    perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Recovery state exists for expired mixed batch');
  end if;
  if v_apply_runs<>0 then perform public.retailer_catalogue_raise('RSBI_PARTIAL_BATCH_STATE','Apply run exists for expired mixed batch'); end if;

  v_before_business:=public.retailer_catalogue_business_counts();
  v_closed_at:=clock_timestamp();
  v_result:=jsonb_build_object(
    'status','EXPIRED','approval_id',v_approval.id,'parent_plan_id',v_parent.id,'child_plan_id',v_child.id,
    'closed_at',v_closed_at,'closed_by',trim(p_request->>'closed_by'),'reason',trim(p_request->>'reason'),
    'request_fingerprint',v_request_fingerprint,'actual_migration_fingerprint',v_actual_migration_fingerprint,
    'approval_consumed',false,'parent_status','EXPIRED','child_status','EXPIRED','already_closed',false,
    'row_approvals',0,'apply_runs',0,'recovery_records',0,'business_writes',0,'price_history_writes',0,'control_writes',3
  );
  v_audit:=jsonb_build_object(
    'event','EXPIRED_MIXED_APPROVAL_CLOSED','approval_id',v_approval.id,'request_fingerprint',v_request_fingerprint,
    'reason',trim(p_request->>'reason'),'actor',trim(p_request->>'closed_by'),'at',v_closed_at
  );

  update public.retailer_offer_sync_batch_approvals
  set closed_at=v_closed_at,closed_by=trim(p_request->>'closed_by'),close_reason=trim(p_request->>'reason'),
      close_request_fingerprint=v_request_fingerprint,close_result=v_result
  where id=v_approval.id;
  update public.retailer_catalogue_parent_plans
  set status='EXPIRED',updated_at=v_closed_at,audit_log=audit_log||jsonb_build_array(v_audit)
  where id=v_parent.id;
  update public.retailer_catalogue_child_plans
  set status='EXPIRED',updated_at=v_closed_at,audit_log=audit_log||jsonb_build_array(v_audit)
  where id=v_child.id;

  v_after_business:=public.retailer_catalogue_business_counts();
  if v_after_business is distinct from v_before_business then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_DELTA_MISMATCH','Business state changed while closing expired approval');
  end if;
  return v_result;
end
$close_expired_internal$;

create or replace function public.close_expired_retailer_offer_sync_approval(p_request jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path=pg_catalog,public,pg_temp
as $close_expired_wrapper$
begin
  if current_user<>'retailer_catalogue_staging_approver' then
    raise exception 'expired mixed approval close requires the dedicated approver role';
  end if;
  return public.retailer_offer_sync_close_expired_approval_internal(p_request);
end
$close_expired_wrapper$;

alter function public.retailer_offer_sync_close_expired_approval_internal(jsonb) owner to postgres;
alter function public.close_expired_retailer_offer_sync_approval(jsonb) owner to postgres;

revoke all on function public.retailer_offer_sync_close_expired_approval_internal(jsonb)
  from public,anon,authenticated,service_role,retailer_catalogue_staging_approver,retailer_catalogue_staging_executor,retailer_catalogue_staging_validator;
revoke all on function public.close_expired_retailer_offer_sync_approval(jsonb)
  from public,anon,authenticated,service_role,retailer_catalogue_staging_executor,retailer_catalogue_staging_validator;
grant execute on function public.close_expired_retailer_offer_sync_approval(jsonb)
  to retailer_catalogue_staging_approver;
grant execute on function public.retailer_offer_sync_close_expired_approval_internal(jsonb)
  to retailer_catalogue_staging_approver;

commit;
