begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $preflight$
begin
  if to_regprocedure('public.close_expired_retailer_offer_sync_approval(jsonb)') is null
     or to_regprocedure('public.retailer_offer_sync_close_expired_approval_internal(jsonb)') is null
     or to_regprocedure('public.retailer_catalogue_production_runtime_guard(text,text,text)') is null
     or to_regclass('public.retailer_catalogue_production_recovery_manifests') is null then
    raise exception 'partial sequential plan close requires the existing production control plane';
  end if;
end
$preflight$;

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
  v_retailer_id bigint;
  v_child_count integer;
  v_applied_children integer;
  v_approved_children integer;
  v_planned_children integer;
  v_pending_children integer;
  v_batch_approvals integer;
  v_row_approvals integer;
  v_apply_runs integer;
  v_recovery_manifests integer;
  v_recovery_approvals integer;
  v_recovery_audit integer;
  v_rows integer;
  v_before_business jsonb;
  v_after_business jsonb;
  v_closed_at timestamptz;
  v_result jsonb;
  v_audit jsonb;
  v_partial boolean;
begin
  if not public.atomic_import_has_exact_keys(p_request,array[
    'schema_version','approval_id','parent_plan_id','child_plan_id',
    'parent_plan_fingerprint','child_plan_fingerprint','artifact_fingerprint','execution_fingerprint',
    'approval_expected_migration_fingerprint','expected_migration_versions','expected_migration_fingerprint',
    'migration_fingerprint_algorithm','migration_fingerprint_version','target_environment','production_project_ref',
    'production_database_identity','reason','closed_by','requested_at','request_fingerprint'
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

  perform public.retailer_catalogue_production_runtime_guard(
    p_request->>'target_environment',p_request->>'production_project_ref',p_request->>'production_database_identity'
  );
  v_actual_migration_fingerprint:=public.retailer_catalogue_assert_migration_ledger(
    p_request->'expected_migration_versions',p_request->>'expected_migration_fingerprint'
  );
  v_request_fingerprint:=public.retailer_catalogue_production_request_fingerprint(p_request);
  if p_request->>'request_fingerprint' is distinct from v_request_fingerprint then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Expired approval close request fingerprint mismatch');
  end if;

  select retailer_id into v_retailer_id
  from public.retailer_catalogue_parent_plans
  where id=(p_request->>'parent_plan_id')::uuid;
  if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Linked parent plan not found'); end if;
  perform pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:'||v_retailer_id::text,0));

  select * into v_parent
  from public.retailer_catalogue_parent_plans
  where id=(p_request->>'parent_plan_id')::uuid
  for update;
  if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Linked parent plan not found after lock'); end if;
  perform 1 from public.retailer_catalogue_child_plans
  where parent_plan_id=v_parent.id order by batch_index for update;
  select * into v_child from public.retailer_catalogue_child_plans
  where id=(p_request->>'child_plan_id')::uuid;
  if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Linked child plan not found'); end if;
  select * into v_approval from public.retailer_offer_sync_batch_approvals
  where id=(p_request->>'approval_id')::uuid for update;
  if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Mixed-batch approval not found'); end if;

  if v_approval.child_plan_id is distinct from v_child.id
     or v_child.parent_plan_id is distinct from v_parent.id
     or v_parent.retailer_id is distinct from v_retailer_id
     or v_approval.target_environment is distinct from 'PRODUCTION'
     or v_parent.target_environment is distinct from 'PRODUCTION'
     or v_approval.target_environment is distinct from p_request->>'target_environment'
     or v_approval.project_ref is distinct from p_request->>'production_project_ref'
     or v_approval.database_identity is distinct from p_request->>'production_database_identity'
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

  select count(*),count(*) filter(where status='APPLIED'),count(*) filter(where status='APPROVED'),count(*) filter(where status='PLANNED')
  into v_child_count,v_applied_children,v_approved_children,v_planned_children
  from public.retailer_catalogue_child_plans where parent_plan_id=v_parent.id;
  v_partial:=v_parent.status='PARTIALLY_APPLIED';

  if v_approval.closed_at is not null then
    if v_approval.close_request_fingerprint is distinct from v_request_fingerprint
       or v_approval.close_result is null
       or (v_approval.close_result->>'status'='EXPIRED' and (
         v_parent.status<>'EXPIRED' or exists(select 1 from public.retailer_catalogue_child_plans where parent_plan_id=v_parent.id and status<>'EXPIRED')
       ))
       or (v_approval.close_result->>'status'='SUPERSEDED' and (
         v_parent.status<>'SUPERSEDED' or exists(select 1 from public.retailer_catalogue_child_plans where parent_plan_id=v_parent.id and status not in ('APPLIED','SUPERSEDED'))
       )) then
      perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Expired sequential plan was closed by a different request or has inconsistent state');
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
  if v_approval.consumed_at is not null or v_child.approval_consumed_at is not null
     or (not v_partial and v_parent.approval_consumed_at is not null) then
    perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Target approval is already consumed');
  end if;
  if v_approval.result is not null then
    perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Approval already contains execution result');
  end if;
  if v_child.status<>'APPROVED' or v_parent.approval_id is null or v_child.approval_id is null
     or v_child.approval_expires_at is distinct from v_approval.expires_at
     or v_parent.approval_expires_at<v_approval.expires_at then
    perform public.retailer_catalogue_raise('RSBI_INVALID_TRANSITION','Target is not an exact unexecuted expired sequential approval');
  end if;
  if v_parent.status not in ('APPROVED','PARTIALLY_APPLIED') then
    perform public.retailer_catalogue_raise('RSBI_INVALID_TRANSITION','Parent is not recoverable');
  end if;

  if v_child_count<1 or v_approved_children<>1 or jsonb_array_length(v_parent.child_manifest)<>v_child_count
     or exists(
       select 1 from public.retailer_catalogue_child_plans c
       where c.parent_plan_id=v_parent.id and (
         c.retailer_id<>v_parent.retailer_id or c.target_environment<>v_parent.target_environment
         or c.parent_plan_fingerprint<>v_parent.parent_plan_fingerprint
         or c.source_snapshot_fingerprint<>v_parent.source_snapshot_fingerprint
         or c.canonical_snapshot_fingerprint<>v_parent.canonical_snapshot_fingerprint
         or c.adapter_fingerprint<>v_parent.adapter_fingerprint or c.policy_fingerprint<>v_parent.policy_fingerprint
         or c.code_commit<>v_parent.code_commit or c.expected_state_fingerprint<>v_parent.expected_state_fingerprint
         or c.batch_index<0 or c.batch_index>=v_child_count or c.batch_count<>v_child_count
         or v_parent.child_manifest->c.batch_index is null
         or v_parent.child_manifest->c.batch_index->>'child_plan_id' is distinct from c.id::text
         or v_parent.child_manifest->c.batch_index->>'child_plan_fingerprint' is distinct from c.child_plan_fingerprint
         or v_parent.child_manifest->c.batch_index->>'batch_index' is distinct from c.batch_index::text
         or v_parent.child_manifest->c.batch_index->>'batch_count' is distinct from c.batch_count::text
         or v_parent.child_manifest->c.batch_index->'record_ids' is distinct from c.record_ids
       )
     ) then
    perform public.retailer_catalogue_raise('RSBI_PARTIAL_BATCH_STATE','Sequential child tree identity drifted');
  end if;

  select count(*) into v_batch_approvals
  from public.retailer_offer_sync_batch_approvals a
  join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id
  where c.parent_plan_id=v_parent.id;
  select count(*) into v_row_approvals
  from public.approved_import_plans a
  join public.retailer_catalogue_child_plans c on c.child_plan_fingerprint=a.artifact_sha256
  where c.parent_plan_id=v_parent.id and a.source='retailer_offer_mixed_batch';
  select count(*) into v_apply_runs from public.retailer_catalogue_apply_runs where parent_plan_id=v_parent.id;
  select count(*) into v_recovery_manifests
  from public.retailer_catalogue_production_recovery_manifests m
  join public.retailer_catalogue_child_plans c on c.id=m.child_plan_id
  where c.parent_plan_id=v_parent.id;
  select count(*) into v_recovery_approvals
  from public.retailer_catalogue_production_recovery_approvals a
  join public.retailer_catalogue_production_recovery_manifests m on m.id=a.recovery_manifest_id
  join public.retailer_catalogue_child_plans c on c.id=m.child_plan_id
  where c.parent_plan_id=v_parent.id;
  select count(*) into v_recovery_audit
  from public.retailer_catalogue_production_recovery_audit a
  join public.retailer_catalogue_production_recovery_manifests m on m.id=a.recovery_manifest_id
  join public.retailer_catalogue_child_plans c on c.id=m.child_plan_id
  where c.parent_plan_id=v_parent.id;
  if v_recovery_approvals<>0 or v_recovery_audit<>0 then
    perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Recovery execution state exists for sequential plan');
  end if;

  if not v_partial then
    if v_batch_approvals<>1 then
      perform public.retailer_catalogue_raise('RSBI_PARTIAL_BATCH_STATE','Sequential plan contains unexpected batch approvals');
    end if;
    if v_row_approvals<>0 then
      perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Row approvals exist for expired sequential plan');
    end if;
    if v_recovery_manifests<>0 then
      perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Recovery state exists for expired sequential plan');
    end if;
    if v_apply_runs<>0 then
      perform public.retailer_catalogue_raise('RSBI_PARTIAL_BATCH_STATE','Apply run exists for expired sequential plan');
    end if;
    if v_applied_children<>0 or v_planned_children<>v_child_count-1
       or exists(select 1 from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_parent.id and c.id<>v_child.id and (
         c.status<>'PLANNED' or c.approval_id is not null or c.approved_at is not null
         or c.approval_expires_at is not null or c.approval_consumed_at is not null
       )) then
      perform public.retailer_catalogue_raise('RSBI_PARTIAL_BATCH_STATE','Expired sequential tree is neither wholly unexecuted nor a valid partial prefix');
    end if;
  else
    if v_parent.approval_consumed_at is null or v_applied_children<1
       or v_planned_children<>v_child_count-v_applied_children-1
       or v_child.batch_index<>v_applied_children
       or exists(select 1 from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_parent.id and (
         (c.batch_index<v_child.batch_index and c.status<>'APPLIED')
         or (c.batch_index=v_child.batch_index and c.id<>v_child.id)
         or (c.batch_index>v_child.batch_index and (c.status<>'PLANNED' or c.approval_id is not null or c.approved_at is not null or c.approval_expires_at is not null or c.approval_consumed_at is not null))
       )) then
      perform public.retailer_catalogue_raise('RSBI_PARTIAL_BATCH_STATE','Partial sequential tree is not an applied prefix plus one approved child and planned suffix');
    end if;
    if v_batch_approvals<>v_applied_children+1 or v_apply_runs<>v_applied_children or v_recovery_manifests<>v_applied_children then
      perform public.retailer_catalogue_raise('RSBI_PARTIAL_BATCH_STATE','Partial sequential evidence counts do not match the applied prefix');
    end if;
    if exists(
      select 1 from public.retailer_catalogue_child_plans c
      where c.parent_plan_id=v_parent.id and c.status='APPLIED' and (
        c.approval_id is null or c.approval_consumed_at is null
        or (select count(*) from public.retailer_offer_sync_batch_approvals a where a.child_plan_id=c.id and a.consumed_at is not null and a.closed_at is null and a.result->>'status'='APPLIED')<>1
        or (select count(*) from public.retailer_catalogue_apply_runs r where r.child_plan_id=c.id and r.run_type='APPLY' and r.status='SUCCEEDED')<>1
        or (select count(*) from public.retailer_catalogue_production_recovery_manifests m join public.retailer_catalogue_apply_runs r on r.id=m.apply_run_id where m.child_plan_id=c.id and r.child_plan_id=c.id and r.status='SUCCEEDED' and m.status='READY')<>1
        or (select count(*) from public.approved_import_plans a where a.artifact_sha256=c.child_plan_fingerprint and a.source='retailer_offer_mixed_batch')<>jsonb_array_length(c.plan_json->'rows')
      )
    ) then
      perform public.retailer_catalogue_raise('RSBI_PARTIAL_BATCH_STATE','Applied prefix evidence is incomplete or inconsistent');
    end if;
    if exists(select 1 from public.retailer_catalogue_apply_runs r where r.parent_plan_id=v_parent.id and (r.run_type<>'APPLY' or r.status<>'SUCCEEDED'))
       or exists(select 1 from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_parent.id and c.status='PLANNED')
       or exists(select 1 from public.retailer_catalogue_apply_runs r where r.child_plan_id=v_child.id)
       or exists(select 1 from public.approved_import_plans a where a.artifact_sha256=v_child.child_plan_fingerprint and a.source='retailer_offer_mixed_batch')
       or exists(select 1 from public.retailer_catalogue_production_recovery_manifests m where m.child_plan_id=v_child.id) then
      perform public.retailer_catalogue_raise('RSBI_PARTIAL_BATCH_STATE','Unexecuted suffix contains execution evidence');
    end if;
  end if;

  v_before_business:=public.retailer_catalogue_business_counts();
  v_closed_at:=clock_timestamp();
  v_pending_children:=v_approved_children+v_planned_children;
  v_result:=jsonb_build_object(
    'status',case when v_partial then 'SUPERSEDED' else 'EXPIRED' end,
    'approval_id',v_approval.id,'parent_plan_id',v_parent.id,'child_plan_id',v_child.id,
    'closed_at',v_closed_at,'closed_by',trim(p_request->>'closed_by'),'reason',trim(p_request->>'reason'),
    'request_fingerprint',v_request_fingerprint,'actual_migration_fingerprint',v_actual_migration_fingerprint,
    'approval_consumed',false,'parent_status',case when v_partial then 'SUPERSEDED' else 'EXPIRED' end,
    'child_status',case when v_partial then 'SUPERSEDED' else 'EXPIRED' end,'already_closed',false,
    'preserved_applied_child_count',v_applied_children,
    'closed_child_count',v_pending_children,
    'expired_child_count',case when v_partial then 0 else v_pending_children end,
    'superseded_child_count',case when v_partial then v_pending_children else 0 end,
    'approved_child_count',v_approved_children,'planned_child_count',v_planned_children,
    'row_approvals',v_row_approvals,'apply_runs',v_apply_runs,'recovery_records',v_recovery_manifests,
    'business_writes',0,'price_history_writes',0,'control_writes',v_pending_children+2
  );
  v_audit:=jsonb_build_object(
    'event',case when v_partial then 'EXPIRED_PARTIAL_SEQUENTIAL_SUFFIX_SUPERSEDED' else 'EXPIRED_UNEXECUTED_SEQUENTIAL_TREE_CLOSED' end,
    'approval_id',v_approval.id,'request_fingerprint',v_request_fingerprint,'reason',trim(p_request->>'reason'),
    'actor',trim(p_request->>'closed_by'),'at',v_closed_at,'preserved_applied_child_count',v_applied_children,
    'closed_child_count',v_pending_children
  );

  update public.retailer_offer_sync_batch_approvals
  set closed_at=v_closed_at,closed_by=trim(p_request->>'closed_by'),close_reason=trim(p_request->>'reason'),
      close_request_fingerprint=v_request_fingerprint,close_result=v_result
  where id=v_approval.id and consumed_at is null and closed_at is null;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Expired approval close count mismatch'); end if;

  update public.retailer_catalogue_child_plans
  set status=case when v_partial then 'SUPERSEDED' else 'EXPIRED' end,updated_at=v_closed_at,
      audit_log=audit_log||jsonb_build_array(v_audit)
  where parent_plan_id=v_parent.id and status in ('PLANNED','APPROVED');
  get diagnostics v_rows=row_count;
  if v_rows<>v_pending_children then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Sequential child close count mismatch'); end if;

  update public.retailer_catalogue_parent_plans
  set status=case when v_partial then 'SUPERSEDED' else 'EXPIRED' end,updated_at=v_closed_at,
      audit_log=audit_log||jsonb_build_array(v_audit)
  where id=v_parent.id and status=case when v_partial then 'PARTIALLY_APPLIED' else 'APPROVED' end;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Sequential parent close count mismatch'); end if;

  v_after_business:=public.retailer_catalogue_business_counts();
  if v_after_business is distinct from v_before_business then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_DELTA_MISMATCH','Business state changed while closing expired sequential plan');
  end if;
  return v_result;
end
$close_expired_internal$;

alter function public.retailer_offer_sync_close_expired_approval_internal(jsonb) owner to postgres;
revoke all on function public.retailer_offer_sync_close_expired_approval_internal(jsonb)
  from public,anon,authenticated,service_role,retailer_catalogue_production_approver,
       retailer_catalogue_production_executor,retailer_catalogue_production_validator;
grant execute on function public.retailer_offer_sync_close_expired_approval_internal(jsonb)
  to retailer_catalogue_production_approver;

commit;
