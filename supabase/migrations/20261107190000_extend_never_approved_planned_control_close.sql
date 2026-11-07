-- Preparation only. Separate owner authorization is required for deployment and
-- for a fresh, exact parent/state close. This migration closes no existing plan.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- Extend the SAME internal RPC without copying or changing its v1 expired /
-- partial implementation, wrapper, privileges, or any approval/executor path.
do $extend$
declare
  v_proc pg_catalog.pg_proc%rowtype;
  v_wrapper pg_catalog.pg_proc%rowtype;
  v_body text;
  v_anchor text:=E'begin\n  if not public.atomic_import_has_exact_keys(p_request,array[';
  v_extension text:=$planned_branch$
begin
  if p_request->>'schema_version'='2' then
    perform set_config('TimeZone','UTC',true);
    if public.atomic_import_has_exact_keys(p_request,array[
      'schema_version','kind','retailer_id','parent_plan_id','parent_plan_fingerprint',
      'expected_parent_expires_at','expected_children','control_state_fingerprint',
      'expected_migration_versions','expected_migration_fingerprint',
      'migration_fingerprint_algorithm','migration_fingerprint_version','target_environment',
      'production_project_ref','production_database_identity','reason','closed_by','requested_at','request_fingerprint'
    ]) is not true or (
      p_request->>'kind'='NEVER_APPROVED_PLANNED_SEQUENTIAL_PLAN'
      and p_request->>'retailer_id' ~ '^[1-9][0-9]*$'
      and p_request->>'parent_plan_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and p_request->>'parent_plan_fingerprint' ~ '^[0-9a-f]{64}$'
      and p_request->>'control_state_fingerprint' ~ '^[0-9a-f]{64}$'
      and p_request->>'expected_migration_fingerprint' ~ '^[0-9a-f]{64}$'
      and p_request->>'migration_fingerprint_algorithm'='SHA-256'
      and p_request->>'migration_fingerprint_version'='RSBI-CJ1'
      and p_request->>'target_environment'='PRODUCTION'
      and nullif(p_request->>'production_project_ref','') is not null
      and nullif(p_request->>'production_database_identity','') is not null
      and jsonb_typeof(p_request->'expected_children')='array'
      and jsonb_array_length(p_request->'expected_children') between 1 and 100
      and jsonb_typeof(p_request->'expected_migration_versions')='array'
      and jsonb_array_length(p_request->'expected_migration_versions')>0
      and nullif(trim(p_request->>'closed_by'),'') is not null
      and length(trim(p_request->>'reason')) between 1 and 500
      and p_request->>'expected_parent_expires_at' is not null
      and p_request->>'requested_at' is not null
    ) is not true then
      perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid never-approved PLANNED close request');
    end if;
    perform public.retailer_catalogue_production_runtime_guard(
      p_request->>'target_environment',p_request->>'production_project_ref',p_request->>'production_database_identity'
    );
    v_actual_migration_fingerprint:=public.retailer_catalogue_assert_migration_ledger(
      p_request->'expected_migration_versions',p_request->>'expected_migration_fingerprint'
    );
    v_request_fingerprint:=public.retailer_catalogue_production_request_fingerprint(p_request);
    if p_request->>'request_fingerprint' is distinct from v_request_fingerprint then
      perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Planned close request fingerprint mismatch');
    end if;
    v_retailer_id:=(p_request->>'retailer_id')::bigint;
    perform pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));
    perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:'||v_retailer_id::text,0));
    select * into v_parent from public.retailer_catalogue_parent_plans
    where id=(p_request->>'parent_plan_id')::uuid for update;
    if not found then
      perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Planned parent not found');
    end if;
    perform 1 from public.retailer_catalogue_child_plans
    where parent_plan_id=v_parent.id order by batch_index for update;
    select count(*) into v_child_count from public.retailer_catalogue_child_plans where parent_plan_id=v_parent.id;
    if v_parent.retailer_id is distinct from v_retailer_id
       or v_parent.target_environment is distinct from 'PRODUCTION'
       or v_parent.parent_plan_fingerprint is distinct from p_request->>'parent_plan_fingerprint'
       or v_parent.approval_id is not null or v_parent.approved_by is not null or v_parent.approved_at is not null
       or v_parent.approval_expires_at is not null or v_parent.approval_consumed_at is not null
       or v_parent.status not in ('PLANNED','SUPERSEDED') then
      perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Parent is not an exact never-approved tree');
    end if;
    if ((v_parent.plan_json->>'expires_at')::timestamptz=(p_request->>'expected_parent_expires_at')::timestamptz
        and (v_parent.plan_json->>'expires_at')::timestamptz<=clock_timestamp()) is not true then
      perform public.retailer_catalogue_raise('RSBI_SOURCE_STALE','Original registration deadline has not elapsed or drifted');
    end if;
    if v_child_count not between 1 and 100 or jsonb_array_length(v_parent.child_manifest)<>v_child_count
       or p_request->'expected_children' is distinct from (
         select jsonb_agg(jsonb_build_object('batch_index',c.batch_index,'child_plan_id',c.id::text,
           'child_plan_fingerprint',c.child_plan_fingerprint,'row_count',jsonb_array_length(c.plan_json->'rows')) order by c.batch_index)
         from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_parent.id
       ) or exists(
         select 1 from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_parent.id and (
           c.status is distinct from v_parent.status
           or c.approval_id is not null or c.approved_at is not null
           or c.approval_expires_at is not null or c.approval_consumed_at is not null
           or c.rollback_requested_at is not null or c.rollback_requested_by is not null
           or c.retailer_id is distinct from v_parent.retailer_id or c.target_environment is distinct from v_parent.target_environment
           or c.parent_plan_fingerprint is distinct from v_parent.parent_plan_fingerprint
           or c.source_snapshot_fingerprint is distinct from v_parent.source_snapshot_fingerprint
           or c.canonical_snapshot_fingerprint is distinct from v_parent.canonical_snapshot_fingerprint
           or c.adapter_fingerprint is distinct from v_parent.adapter_fingerprint
           or c.policy_fingerprint is distinct from v_parent.policy_fingerprint
           or c.code_commit is distinct from v_parent.code_commit
           or c.expected_state_fingerprint is distinct from v_parent.expected_state_fingerprint
           or c.batch_index<0 or c.batch_index>=v_child_count or c.batch_count<>v_child_count
           or jsonb_typeof(c.plan_json->'rows') is distinct from 'array' or jsonb_array_length(c.plan_json->'rows')<1
           or v_parent.child_manifest->c.batch_index->>'child_plan_id' is distinct from c.id::text
           or v_parent.child_manifest->c.batch_index->>'child_plan_fingerprint' is distinct from c.child_plan_fingerprint
           or v_parent.child_manifest->c.batch_index->>'batch_index' is distinct from c.batch_index::text
           or v_parent.child_manifest->c.batch_index->>'batch_count' is distinct from c.batch_count::text
           or v_parent.child_manifest->c.batch_index->'record_ids' is distinct from c.record_ids
         )
       ) then
      perform public.retailer_catalogue_raise('RSBI_PARTIAL_BATCH_STATE','Never-approved child tree state or identity drifted');
    end if;
    if exists(select 1 from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_parent.id)
       or exists(select 1 from public.approved_import_plans a join public.retailer_catalogue_child_plans c on c.child_plan_fingerprint=a.artifact_sha256 where c.parent_plan_id=v_parent.id and a.source='retailer_offer_mixed_batch')
       or exists(select 1 from public.retailer_catalogue_apply_runs r where r.parent_plan_id=v_parent.id or r.child_plan_id in (select id from public.retailer_catalogue_child_plans where parent_plan_id=v_parent.id))
       or exists(select 1 from public.retailer_catalogue_production_recovery_manifests m where m.child_plan_id in (select id from public.retailer_catalogue_child_plans where parent_plan_id=v_parent.id))
       or exists(select 1 from public.retailer_catalogue_production_recovery_approvals a join public.retailer_catalogue_production_recovery_manifests m on m.id=a.recovery_manifest_id where m.child_plan_id in (select id from public.retailer_catalogue_child_plans where parent_plan_id=v_parent.id))
       or exists(select 1 from public.retailer_catalogue_production_recovery_audit a join public.retailer_catalogue_production_recovery_manifests m on m.id=a.recovery_manifest_id where m.child_plan_id in (select id from public.retailer_catalogue_child_plans where parent_plan_id=v_parent.id)) then
      perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Approval, apply or recovery evidence exists for never-approved tree');
    end if;
    if v_parent.status='SUPERSEDED' then
      v_audit:=v_parent.audit_log->-1;
      if (v_audit->>'event'='NEVER_APPROVED_PLANNED_TREE_SUPERSEDED'
          and v_audit->>'request_fingerprint'=v_request_fingerprint
          and v_audit->>'control_state_fingerprint'=p_request->>'control_state_fingerprint'
          and v_audit->'result'->>'status'='SUPERSEDED') is not true
         or exists(select 1 from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_parent.id and c.audit_log->-1 is distinct from v_audit) then
        perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Terminal planned tree does not bind this exact close request');
      end if;
      return v_audit->'result'||jsonb_build_object('already_closed',true,'control_writes',0);
    end if;
    if p_request->>'control_state_fingerprint' is distinct from (
      select public.retailer_catalogue_sha256_json(jsonb_build_object('parent',to_jsonb(p),
        'children',(select jsonb_agg(to_jsonb(c) order by c.batch_index)
          from public.retailer_catalogue_child_plans c where c.parent_plan_id=p.id)))
      from public.retailer_catalogue_parent_plans p where p.id=v_parent.id
    ) then
      perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Locked planned control state differs from the sealed readback');
    end if;
    if ((p_request->>'requested_at')::timestamptz between clock_timestamp()-interval '15 minutes' and clock_timestamp()+interval '5 minutes') is not true then
      perform public.retailer_catalogue_raise('RSBI_SOURCE_STALE','Planned close request is stale or future');
    end if;
    v_before_business:=public.retailer_catalogue_business_counts();
    v_closed_at:=clock_timestamp();
    v_result:=jsonb_build_object('status','SUPERSEDED','parent_plan_id',v_parent.id,
      'closed_at',v_closed_at,'request_fingerprint',v_request_fingerprint,
      'actual_migration_fingerprint',v_actual_migration_fingerprint,'already_closed',false,
      'preserved_applied_child_count',0,'closed_child_count',v_child_count,'approval_closed',false,
      'control_writes',v_child_count+1,'business_writes',0,'price_history_writes',0);
    v_audit:=jsonb_build_object('event','NEVER_APPROVED_PLANNED_TREE_SUPERSEDED',
      'request_fingerprint',v_request_fingerprint,'control_state_fingerprint',p_request->>'control_state_fingerprint',
      'actor',trim(p_request->>'closed_by'),'reason',trim(p_request->>'reason'),'at',v_closed_at,'result',v_result);
    update public.retailer_catalogue_child_plans set status='SUPERSEDED',updated_at=v_closed_at,
      audit_log=audit_log||jsonb_build_array(v_audit) where parent_plan_id=v_parent.id and status='PLANNED';
    get diagnostics v_rows=row_count;
    if v_rows<>v_child_count then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Planned child close count mismatch'); end if;
    update public.retailer_catalogue_parent_plans set status='SUPERSEDED',updated_at=v_closed_at,
      audit_log=audit_log||jsonb_build_array(v_audit) where id=v_parent.id and status='PLANNED';
    get diagnostics v_rows=row_count;
    if v_rows<>1 then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Planned parent close count mismatch'); end if;
    if public.retailer_catalogue_business_counts() is distinct from v_before_business then
      perform public.retailer_catalogue_raise('RSBI_EXPECTED_DELTA_MISMATCH','Business state changed during planned close');
    end if;
    return v_result;
  end if;
  if not public.atomic_import_has_exact_keys(p_request,array[
$planned_branch$;
begin
  select * into v_proc from pg_catalog.pg_proc where oid=to_regprocedure('public.retailer_offer_sync_close_expired_approval_internal(jsonb)');
  select * into v_wrapper from pg_catalog.pg_proc where oid=to_regprocedure('public.close_expired_retailer_offer_sync_approval(jsonb)');
  if v_proc.oid is null or v_wrapper.oid is null
     or pg_catalog.pg_get_userbyid(v_proc.proowner)<>'postgres'
     or pg_catalog.pg_get_userbyid(v_wrapper.proowner)<>'postgres'
     or v_proc.prosecdef is distinct from true or v_wrapper.prosecdef is distinct from false
     or replace(array_to_string(v_proc.proconfig,','),' ','') is distinct from 'search_path=pg_catalog,public,pg_temp'
     or encode(pg_catalog.sha256(convert_to(replace(v_proc.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')
        is distinct from '84bb206a0e769067f3af4992bfd30875d5812c9a56179fa9a100b0814dc6f8f2'
     or not has_function_privilege('retailer_catalogue_production_approver',v_proc.oid,'EXECUTE')
     or not has_function_privilege('retailer_catalogue_production_approver',v_wrapper.oid,'EXECUTE') then
    raise exception 'Never-approved close requires exact existing partial close source, owner and security contract';
  end if;
  if exists(select 1 from pg_catalog.aclexplode(coalesce(v_proc.proacl,acldefault('f',v_proc.proowner))) a
      where a.privilege_type='EXECUTE' and a.grantee not in (v_proc.proowner,'retailer_catalogue_production_approver'::regrole::oid))
     or exists(select 1 from pg_catalog.aclexplode(coalesce(v_wrapper.proacl,acldefault('f',v_wrapper.proowner))) a
      where a.privilege_type='EXECUTE' and a.grantee not in (v_wrapper.proowner,'retailer_catalogue_production_approver'::regrole::oid)) then
    raise exception 'Never-approved close privilege drift';
  end if;
  v_body:=replace(v_proc.prosrc,E'\r\n',E'\n');
  if strpos(v_body,v_anchor)=0 then raise exception 'Never-approved close patch anchor missing'; end if;
  v_body:=replace(v_body,v_anchor,v_extension);
  execute 'create or replace function public.retailer_offer_sync_close_expired_approval_internal(p_request jsonb)
    returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as '
    ||quote_literal(v_body);
end
$extend$;

commit;
