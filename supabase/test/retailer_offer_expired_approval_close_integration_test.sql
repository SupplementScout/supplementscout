\set ON_ERROR_STOP on
begin;

select set_config('app.retailer_catalogue_staging_marker','1',false);
select set_config('app.retailer_catalogue_allow','1',false);
select set_config('app.safe_update','false',false);

insert into public.retailer_catalogue_database_targets(
  id,target_environment,project_ref,database_identity,database_system_identifier,database_oid,is_active,attested_by
) values(
  true,'STAGING','hxnrsyyqffztlvcrtgbf','supplementscout-staging:hxnrsyyqffztlvcrtgbf',
  (select system_identifier::text from pg_catalog.pg_control_system()),
  (select oid from pg_catalog.pg_database where datname=current_database()),true,'expired-close-test'
) on conflict(id) do update set
  target_environment=excluded.target_environment,project_ref=excluded.project_ref,database_identity=excluded.database_identity,
  database_system_identifier=excluded.database_system_identifier,database_oid=excluded.database_oid,is_active=true,attested_by=excluded.attested_by;

create or replace function public.expired_close_test_assert(p_condition boolean,p_label text)
returns void language plpgsql set search_path=pg_catalog as $assert$
begin
  if not coalesce(p_condition,false) then raise exception 'expired close assertion failed: %',p_label; end if;
end
$assert$;

create or replace function public.expired_close_test_seed(p_case text,p_expires_at timestamptz default now()-interval '1 hour')
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $seed$
declare
  v_parent uuid:=gen_random_uuid(); v_child uuid:=gen_random_uuid(); v_approval uuid:=gen_random_uuid();
  v_parent_approval uuid:=gen_random_uuid(); v_child_approval uuid:=gen_random_uuid();
  v_parent_fp text:=public.retailer_catalogue_sha256_json(jsonb_build_object('case',p_case,'kind','parent'));
  v_child_fp text:=public.retailer_catalogue_sha256_json(jsonb_build_object('case',p_case,'kind','child'));
  v_execution_fp text:=public.retailer_catalogue_sha256_json(jsonb_build_object('case',p_case,'kind','execution'));
  v_source_fp text:=public.retailer_catalogue_sha256_json(jsonb_build_object('case',p_case,'kind','source'));
  v_canonical_fp text:=public.retailer_catalogue_sha256_json(jsonb_build_object('case',p_case,'kind','canonical'));
  v_adapter_fp text:=public.retailer_catalogue_sha256_json(jsonb_build_object('case',p_case,'kind','adapter'));
  v_policy_fp text:=public.retailer_catalogue_sha256_json(jsonb_build_object('case',p_case,'kind','policy'));
  v_state_fp text:=public.retailer_catalogue_sha256_json(jsonb_build_object('case',p_case,'kind','state'));
  v_manifest jsonb:=jsonb_build_object('schema_version',1,'case',p_case,'rows',jsonb_build_array(jsonb_build_object('offer_id','1')));
  v_old_ledger text:=repeat('a',64); v_request jsonb;
begin
  insert into public.retailer_catalogue_parent_plans(
    id,parent_plan_fingerprint,retailer_id,target_environment,source_snapshot_fingerprint,canonical_snapshot_fingerprint,
    adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,status,expected_deltas,plan_json,
    rollback_manifest,source_captured_at,canonical_snapshot_at,approval_id,approved_by,approved_at,approval_expires_at,
    created_by,audit_log
  ) values(
    v_parent,v_parent_fp,9901,'STAGING',v_source_fp,v_canonical_fp,v_adapter_fp,v_policy_fp,repeat('b',40),v_state_fp,
    'APPROVED','{}',jsonb_build_object('case',p_case),'{}',now()-interval '3 hours',now()-interval '3 hours',
    v_parent_approval,'expired-close-test',now()-interval '2 hours',p_expires_at,'expired-close-test',
    jsonb_build_array(jsonb_build_object('event','PARENT_APPROVED','at',now()-interval '2 hours'))
  );
  insert into public.retailer_catalogue_child_plans(
    id,parent_plan_id,retailer_id,target_environment,child_plan_fingerprint,parent_plan_fingerprint,
    source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,
    expected_state_fingerprint,batch_index,batch_count,dependency_group,rollback_group,record_ids,status,
    expected_deltas,plan_json,rollback_manifest,approval_id,approved_at,approval_expires_at,audit_log
  ) values(
    v_child,v_parent,9901,'STAGING',v_child_fp,v_parent_fp,v_source_fp,v_canonical_fp,v_adapter_fp,v_policy_fp,repeat('b',40),
    v_state_fp,0,1,'expired-close:'||p_case,'expired-close:'||p_case,jsonb_build_array('1'),'APPROVED','{}',v_manifest,'[]',
    v_child_approval,now()-interval '2 hours',p_expires_at,
    jsonb_build_array(jsonb_build_object('event','CHILD_APPROVED','at',now()-interval '2 hours'))
  );
  insert into public.retailer_offer_sync_batch_approvals(
    id,child_plan_id,artifact_fingerprint,execution_fingerprint,target_environment,project_ref,database_identity,
    expected_migration_versions,expected_migration_fingerprint,migration_fingerprint_algorithm,migration_fingerprint_version,
    approved_manifest,expected_deltas,approved_by,approved_at,expires_at
  ) values(
    v_approval,v_child,v_child_fp,v_execution_fp,'STAGING','hxnrsyyqffztlvcrtgbf','supplementscout-staging:hxnrsyyqffztlvcrtgbf',
    jsonb_build_array('historical_approval_ledger'),v_old_ledger,'SHA-256','RSBI-CJ1',v_manifest,'{}','expired-close-test',
    now()-interval '2 hours',p_expires_at
  );
  v_request:=jsonb_build_object(
    'schema_version',1,'approval_id',v_approval,'parent_plan_id',v_parent,'child_plan_id',v_child,
    'parent_plan_fingerprint',v_parent_fp,'child_plan_fingerprint',v_child_fp,'artifact_fingerprint',v_child_fp,
    'execution_fingerprint',v_execution_fp,'approval_expected_migration_fingerprint',v_old_ledger,
    'expected_migration_versions',(select jsonb_agg(value->>'identifier' order by (value->>'ordinal')::int) from jsonb_array_elements(public.retailer_catalogue_actual_migration_ledger()->'migrations')),
    'expected_migration_fingerprint',public.retailer_catalogue_actual_migration_ledger_fingerprint(),
    'migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1','target_environment','STAGING',
    'staging_project_ref','hxnrsyyqffztlvcrtgbf','staging_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf',
    'reason','source recapture aborted after non-semantic drift','closed_by','expired-close-test','requested_at',now(),
    'request_fingerprint',null
  );
  return jsonb_set(v_request,'{request_fingerprint}',to_jsonb(public.retailer_catalogue_staging_request_fingerprint(v_request)));
end
$seed$;

create or replace function public.expired_close_test_call(p_request jsonb)
returns jsonb language sql security definer set search_path=pg_catalog,public,pg_temp
as $call$ select public.close_expired_retailer_offer_sync_approval(p_request) $call$;
alter function public.expired_close_test_call(jsonb) owner to retailer_catalogue_staging_approver;

create or replace function public.expired_close_test_expect_error(p_request jsonb,p_code text)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $expect$
begin
  perform public.close_expired_retailer_offer_sync_approval(p_request);
  return false;
exception when others then
  if sqlerrm not like '%'||p_code||'%' then raise exception 'expected %, got %',p_code,sqlerrm; end if;
  return true;
end
$expect$;
alter function public.expired_close_test_expect_error(jsonb,text) owner to retailer_catalogue_staging_approver;

do $success$
declare
  q jsonb:=public.expired_close_test_seed('success'); r jsonb; replay jsonb; changed jsonb;
  a_before jsonb; p_before jsonb; c_before jsonb; business_before jsonb; business_after jsonb; history_before bigint; history_after bigint;
begin
  select to_jsonb(a) into a_before from public.retailer_offer_sync_batch_approvals a where id=(q->>'approval_id')::uuid;
  select to_jsonb(p) into p_before from public.retailer_catalogue_parent_plans p where id=(q->>'parent_plan_id')::uuid;
  select to_jsonb(c) into c_before from public.retailer_catalogue_child_plans c where id=(q->>'child_plan_id')::uuid;
  business_before:=public.retailer_catalogue_business_counts(); select count(*) into history_before from public.price_history;
  r:=public.expired_close_test_call(q);
  perform public.expired_close_test_assert(r->>'status'='EXPIRED' and (r->>'control_writes')::int=3 and (r->>'business_writes')::int=0,'success result');
  perform public.expired_close_test_assert((select status='EXPIRED' and approval_consumed_at is null and jsonb_array_length(audit_log)=jsonb_array_length(p_before->'audit_log')+1 from public.retailer_catalogue_parent_plans where id=(q->>'parent_plan_id')::uuid),'parent expired and audited');
  perform public.expired_close_test_assert((select status='EXPIRED' and approval_consumed_at is null and jsonb_array_length(audit_log)=jsonb_array_length(c_before->'audit_log')+1 from public.retailer_catalogue_child_plans where id=(q->>'child_plan_id')::uuid),'child expired and audited');
  perform public.expired_close_test_assert((select consumed_at is null and closed_at is not null and close_request_fingerprint=q->>'request_fingerprint' and approved_at=(a_before->>'approved_at')::timestamptz and approved_by=a_before->>'approved_by' from public.retailer_offer_sync_batch_approvals where id=(q->>'approval_id')::uuid),'approval preserved and closed');
  business_after:=public.retailer_catalogue_business_counts(); select count(*) into history_after from public.price_history;
  perform public.expired_close_test_assert(business_after=business_before and history_after=history_before,'zero business and price-history deltas');
  replay:=public.expired_close_test_call(q);
  perform public.expired_close_test_assert((replay->>'already_closed')::boolean and (replay->>'control_writes')::int=0,'deterministic replay no-write');
  changed:=jsonb_set(q,'{reason}',to_jsonb('different reason'::text));
  changed:=jsonb_set(changed,'{request_fingerprint}',to_jsonb(public.retailer_catalogue_staging_request_fingerprint(changed)));
  perform public.expired_close_test_assert(public.expired_close_test_expect_error(changed,'RSBI_REPLAY_BLOCKED'),'different replay blocked');
end
$success$;

do $negative$
declare q jsonb; other jsonb; run_id uuid;
begin
  q:=public.expired_close_test_seed('unexpired',now()+interval '10 minutes');
  perform public.expired_close_test_assert(public.expired_close_test_expect_error(q,'RSBI_APPROVAL_EXPIRED'),'unexpired blocked');

  q:=public.expired_close_test_seed('consumed');
  update public.retailer_offer_sync_batch_approvals set consumed_at=now(),result=jsonb_build_object('status','APPLIED') where id=(q->>'approval_id')::uuid;
  perform public.expired_close_test_assert(public.expired_close_test_expect_error(q,'RSBI_REPLAY_BLOCKED'),'consumed blocked');

  q:=public.expired_close_test_seed('row-approval');
  insert into public.approved_import_plans(artifact_sha256,run_id,plan_fingerprint,source_row_fingerprint,plan_kind,expires_at,source,plan_json)
  values(q->>'artifact_fingerprint','mbs-'||left(q->>'execution_fingerprint',16)||'-000000000001-'||repeat('a',16),repeat('a',32),repeat('b',64),'feed',now()+interval '10 minutes','retailer_offer_mixed_batch','{}');
  perform public.expired_close_test_assert(public.expired_close_test_expect_error(q,'RSBI_REPLAY_BLOCKED'),'row approval blocked');

  q:=public.expired_close_test_seed('apply-run');
  insert into public.retailer_catalogue_apply_runs(parent_plan_id,child_plan_id,retailer_id,target_environment,run_type,attempt_ordinal,status,parent_plan_fingerprint,child_plan_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,approval_id,approval_expires_at,expected_deltas,started_by)
  select p.id,c.id,c.retailer_id,'STAGING','APPLY',1,'STARTED',p.parent_plan_fingerprint,c.child_plan_fingerprint,c.source_snapshot_fingerprint,c.canonical_snapshot_fingerprint,c.adapter_fingerprint,c.policy_fingerprint,c.code_commit,c.expected_state_fingerprint,(q->>'approval_id')::uuid,now()-interval '1 hour','{}','expired-close-test' from public.retailer_catalogue_child_plans c join public.retailer_catalogue_parent_plans p on p.id=c.parent_plan_id where c.id=(q->>'child_plan_id')::uuid;
  perform public.expired_close_test_assert(public.expired_close_test_expect_error(q,'RSBI_PARTIAL_BATCH_STATE'),'apply run blocked');

  q:=public.expired_close_test_seed('recovery-state');
  insert into public.retailer_catalogue_apply_runs(parent_plan_id,child_plan_id,retailer_id,target_environment,run_type,attempt_ordinal,status,parent_plan_fingerprint,child_plan_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,approval_id,approval_expires_at,expected_deltas,started_by)
  select p.id,c.id,c.retailer_id,'STAGING','APPLY',1,'STARTED',p.parent_plan_fingerprint,c.child_plan_fingerprint,c.source_snapshot_fingerprint,c.canonical_snapshot_fingerprint,c.adapter_fingerprint,c.policy_fingerprint,c.code_commit,c.expected_state_fingerprint,(q->>'approval_id')::uuid,now()-interval '1 hour','{}','expired-close-test' from public.retailer_catalogue_child_plans c join public.retailer_catalogue_parent_plans p on p.id=c.parent_plan_id where c.id=(q->>'child_plan_id')::uuid returning id into run_id;
  insert into public.retailer_catalogue_staging_recovery_manifests(package_id,package_fingerprint,child_plan_id,apply_run_id,dependency_group,execution_fingerprint,rollback_manifest_fingerprint,ownership,reverse_dependency_order,before_counts,other_retailer_fingerprint,protected_shared_fingerprint,orphan_counts,applied_owned_state_fingerprint)
  values(gen_random_uuid(),repeat('1',64),(q->>'child_plan_id')::uuid,run_id,'expired-close-test',q->>'execution_fingerprint',repeat('2',64),jsonb_build_object('plan_owned_only',true),'[]','{}',repeat('3',64),repeat('4',64),'{}',repeat('5',64));
  perform public.expired_close_test_assert(public.expired_close_test_expect_error(q,'RSBI_ROLLBACK_OWNERSHIP_CONFLICT'),'recovery state blocked');

  q:=public.expired_close_test_seed('target-mismatch'); q:=jsonb_set(q,'{staging_project_ref}',to_jsonb('wrongprojectrefxxxxx'::text)); q:=jsonb_set(q,'{request_fingerprint}',to_jsonb(public.retailer_catalogue_staging_request_fingerprint(q)));
  perform public.expired_close_test_assert(public.expired_close_test_expect_error(q,'RSBI_ENVIRONMENT_BLOCKED'),'target mismatch blocked');
  q:=public.expired_close_test_seed('production-target'); q:=jsonb_set(q,'{staging_project_ref}',to_jsonb('aftboxmrdgyhizicfsfu'::text)); q:=jsonb_set(q,'{request_fingerprint}',to_jsonb(public.retailer_catalogue_staging_request_fingerprint(q)));
  perform public.expired_close_test_assert(public.expired_close_test_expect_error(q,'RSBI_ENVIRONMENT_BLOCKED'),'production blocked');
  q:=public.expired_close_test_seed('ledger-mismatch'); q:=jsonb_set(q,'{expected_migration_fingerprint}',to_jsonb(repeat('0',64))); q:=jsonb_set(q,'{request_fingerprint}',to_jsonb(public.retailer_catalogue_staging_request_fingerprint(q)));
  perform public.expired_close_test_assert(public.expired_close_test_expect_error(q,'RSBI_SOURCE_HASH_MISMATCH'),'ledger mismatch blocked');
  q:=public.expired_close_test_seed('database-identity'); q:=jsonb_set(q,'{staging_database_identity}',to_jsonb('supplementscout-production:aftboxmrdgyhizicfsfu'::text)); q:=jsonb_set(q,'{request_fingerprint}',to_jsonb(public.retailer_catalogue_staging_request_fingerprint(q)));
  perform public.expired_close_test_assert(public.expired_close_test_expect_error(q,'RSBI_ENVIRONMENT_BLOCKED'),'database identity blocked');
  q:=public.expired_close_test_seed('fingerprint-mismatch'); q:=jsonb_set(q,'{artifact_fingerprint}',to_jsonb(repeat('0',64))); q:=jsonb_set(q,'{request_fingerprint}',to_jsonb(public.retailer_catalogue_staging_request_fingerprint(q)));
  perform public.expired_close_test_assert(public.expired_close_test_expect_error(q,'RSBI_CHILD_FINGERPRINT_MISMATCH'),'fingerprint mismatch blocked');
  q:=public.expired_close_test_seed('parent-child-mismatch'); other:=public.expired_close_test_seed('other-child'); q:=jsonb_set(q,'{child_plan_id}',other->'child_plan_id'); q:=jsonb_set(q,'{child_plan_fingerprint}',other->'child_plan_fingerprint'); q:=jsonb_set(q,'{request_fingerprint}',to_jsonb(public.retailer_catalogue_staging_request_fingerprint(q)));
  perform public.expired_close_test_assert(public.expired_close_test_expect_error(q,'RSBI_CHILD_FINGERPRINT_MISMATCH'),'parent child mismatch blocked');
end
$negative$;

create or replace function public.expired_close_test_injected_failure()
returns trigger language plpgsql set search_path=pg_catalog as $failure$
begin
  if new.status='EXPIRED' and new.id::text=current_setting('app.expired_close_failure_child',true) then raise exception 'injected close failure'; end if;
  return new;
end
$failure$;
create trigger expired_close_test_failure before update on public.retailer_catalogue_child_plans for each row execute function public.expired_close_test_injected_failure();

do $rollback$
declare q jsonb:=public.expired_close_test_seed('injected-rollback'); failed boolean:=false;
begin
  perform set_config('app.expired_close_failure_child',q->>'child_plan_id',true);
  begin perform public.expired_close_test_call(q); exception when others then if sqlerrm like '%injected close failure%' then failed:=true; else raise; end if; end;
  perform public.expired_close_test_assert(failed,'injected failure observed');
  perform public.expired_close_test_assert((select closed_at is null and consumed_at is null from public.retailer_offer_sync_batch_approvals where id=(q->>'approval_id')::uuid),'approval rollback');
  perform public.expired_close_test_assert((select status='APPROVED' from public.retailer_catalogue_parent_plans where id=(q->>'parent_plan_id')::uuid),'parent rollback');
  perform public.expired_close_test_assert((select status='APPROVED' from public.retailer_catalogue_child_plans where id=(q->>'child_plan_id')::uuid),'child rollback');
end
$rollback$;
drop trigger expired_close_test_failure on public.retailer_catalogue_child_plans;

do $security$
begin
  perform public.expired_close_test_assert(
    (select pg_get_userbyid(proowner)='postgres'
       and prosecdef=false
       and provolatile='v'
       and coalesce(proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public, pg_temp']
     from pg_catalog.pg_proc
     where oid='public.close_expired_retailer_offer_sync_approval(jsonb)'::regprocedure),
    'public RPC owner invoker volatility and fixed search path'
  );
  perform public.expired_close_test_assert(
    (select pg_get_userbyid(proowner)='postgres'
       and prosecdef=true
       and provolatile='v'
       and coalesce(proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public, pg_temp']
     from pg_catalog.pg_proc
     where oid='public.retailer_offer_sync_close_expired_approval_internal(jsonb)'::regprocedure),
    'internal RPC owner definer volatility and fixed search path'
  );
  perform public.expired_close_test_assert(
    (select bool_and(relrowsecurity and relforcerowsecurity)
     from pg_catalog.pg_class
     where oid in (
       'public.retailer_offer_sync_batch_approvals'::regclass,
       'public.retailer_catalogue_parent_plans'::regclass,
       'public.retailer_catalogue_child_plans'::regclass
     )),
    'control tables retain enabled and forced RLS'
  );
  perform public.expired_close_test_assert(has_function_privilege('retailer_catalogue_staging_approver','public.close_expired_retailer_offer_sync_approval(jsonb)','EXECUTE'),'approver execute');
  perform public.expired_close_test_assert(not has_function_privilege('retailer_catalogue_staging_executor','public.close_expired_retailer_offer_sync_approval(jsonb)','EXECUTE'),'executor blocked');
  perform public.expired_close_test_assert(not has_function_privilege('retailer_catalogue_staging_validator','public.close_expired_retailer_offer_sync_approval(jsonb)','EXECUTE'),'validator blocked');
  perform public.expired_close_test_assert(not has_function_privilege('public','public.close_expired_retailer_offer_sync_approval(jsonb)','EXECUTE'),'public blocked');
  perform public.expired_close_test_assert(has_function_privilege('retailer_catalogue_staging_approver','public.retailer_offer_sync_close_expired_approval_internal(jsonb)','EXECUTE'),'approver internal execute chain');
  perform public.expired_close_test_assert(not has_function_privilege('retailer_catalogue_staging_executor','public.retailer_offer_sync_close_expired_approval_internal(jsonb)','EXECUTE') and not has_function_privilege('retailer_catalogue_staging_validator','public.retailer_offer_sync_close_expired_approval_internal(jsonb)','EXECUTE'),'internal blocked from executor and validator');
  perform public.expired_close_test_assert(not has_table_privilege('retailer_catalogue_staging_approver','public.offers','UPDATE') and not has_table_privilege('retailer_catalogue_staging_approver','public.price_history','INSERT'),'approver no business DML');
end
$security$;

select jsonb_build_object(
  'result','PASS','cases',20,'failures',0,'skips',0,'lifecycle_status','EXPIRED',
  'business_writes',0,'price_history_writes',0,'replay_writes',0,
  'rpc_signature','close_expired_retailer_offer_sync_approval(jsonb)',
  'approver_execute',has_function_privilege('retailer_catalogue_staging_approver','public.close_expired_retailer_offer_sync_approval(jsonb)','EXECUTE'),
  'executor_execute',has_function_privilege('retailer_catalogue_staging_executor','public.close_expired_retailer_offer_sync_approval(jsonb)','EXECUTE'),
  'validator_execute',has_function_privilege('retailer_catalogue_staging_validator','public.close_expired_retailer_offer_sync_approval(jsonb)','EXECUTE'),
  'public_execute',has_function_privilege('public','public.close_expired_retailer_offer_sync_approval(jsonb)','EXECUTE')
) as expired_approval_close_test_report;

rollback;
