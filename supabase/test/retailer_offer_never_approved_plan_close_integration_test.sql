\set ON_ERROR_STOP on
-- Only the existing disposable production-control harness executes this file.
begin;
set local time zone 'UTC';
select set_config('app.retailer_catalogue_production_marker','1',false);
select set_config('app.retailer_catalogue_allow','1',false);
select set_config('app.safe_update','false',false);

-- Counts alone cannot prove zero writes to existing business values. Any DML
-- statement on any business table must abort this disposable recovery scenario.
create function public.planned_close_test_no_business_dml() returns trigger language plpgsql as $$
begin raise exception 'UNEXPECTED_BUSINESS_DML: % %',tg_op,tg_table_name; end $$;
do $$ declare business_table text; begin
  foreach business_table in array array['retailers','products','product_variants','retailer_products','offers','price_history'] loop
    execute format('create trigger planned_close_test_no_business_dml before insert or update or delete on public.%I for each statement execute function public.planned_close_test_no_business_dml()',business_table);
  end loop;
end $$;

create function public.planned_close_test_assert(ok boolean,label text)
returns void language plpgsql as $$ begin if ok is not true then raise exception 'planned close assertion: %',label; end if; end $$;

create function public.planned_close_test_call(q jsonb)
returns jsonb language sql security definer set search_path=pg_catalog,public,pg_temp
as $$ select public.close_expired_retailer_offer_sync_approval(q) $$;
alter function public.planned_close_test_call(jsonb) owner to retailer_catalogue_production_approver;

create function public.planned_close_test_error(q jsonb,expected text)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  perform public.close_expired_retailer_offer_sync_approval(q); return false;
exception when others then
  if sqlerrm not like '%'||expected||'%' then raise exception 'expected %, got %',expected,sqlerrm; end if;
  return true;
end $$;
alter function public.planned_close_test_error(jsonb,text) owner to retailer_catalogue_production_approver;

create function public.planned_close_test_seed(label text,deadline timestamptz default now()-interval '1 hour',bad_manifest boolean default false)
returns jsonb language plpgsql as $$
declare
  p uuid:=gen_random_uuid(); fp text:=public.retailer_catalogue_sha256_json(to_jsonb(label||p::text));
  manifest jsonb:='[]'; child uuid; child_fp text; i int; rows int; q jsonb; expires text:=deadline::text;
begin
  for i in 0..9 loop
    child:=gen_random_uuid(); child_fp:=public.retailer_catalogue_sha256_json(to_jsonb(label||child::text));
    manifest:=manifest||jsonb_build_array(jsonb_build_object('child_plan_id',child,'child_plan_fingerprint',child_fp,
      'batch_index',i,'batch_count',10,'record_ids',jsonb_build_array(i::text)));
  end loop;
  insert into public.retailer_catalogue_parent_plans(
    id,parent_plan_fingerprint,retailer_id,target_environment,source_snapshot_fingerprint,canonical_snapshot_fingerprint,
    adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,status,expected_deltas,plan_json,
    child_manifest,rollback_manifest,source_captured_at,canonical_snapshot_at,created_by
  ) values(p,fp,9901,'PRODUCTION',fp,fp,fp,fp,repeat('b',40),fp,'PLANNED','{}',
    jsonb_build_object('expires_at',expires),case when bad_manifest then jsonb_set(manifest,'{0,record_ids}','["wrong"]') else manifest end,
    '{}',now()-interval '3 hours',now()-interval '3 hours','isolated-planned-test');
  for i in 0..9 loop
    rows:=case when i<2 then 50 when i=9 then 48 else 49 end;
    insert into public.retailer_catalogue_child_plans(
      id,parent_plan_id,retailer_id,target_environment,child_plan_fingerprint,parent_plan_fingerprint,
      source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,
      expected_state_fingerprint,batch_index,batch_count,dependency_group,rollback_group,record_ids,status,
      expected_deltas,plan_json,rollback_manifest
    ) values((manifest->i->>'child_plan_id')::uuid,p,9901,'PRODUCTION',manifest->i->>'child_plan_fingerprint',
      fp,fp,fp,fp,fp,repeat('b',40),fp,i,10,label,label,jsonb_build_array(i::text),'PLANNED','{}',
      jsonb_build_object('rows',(select jsonb_agg(jsonb_build_object('offer_id',n::text)) from generate_series(1,rows) n)),'[]');
  end loop;
  q:=jsonb_build_object('schema_version',2,'kind','NEVER_APPROVED_PLANNED_SEQUENTIAL_PLAN','retailer_id','9901',
    'parent_plan_id',p,'parent_plan_fingerprint',fp,'expected_parent_expires_at',expires,
    'expected_children',(select jsonb_agg(jsonb_build_object('batch_index',batch_index,'child_plan_id',id::text,
       'child_plan_fingerprint',child_plan_fingerprint,'row_count',jsonb_array_length(plan_json->'rows')) order by batch_index)
       from public.retailer_catalogue_child_plans where parent_plan_id=p),
    'control_state_fingerprint',(select public.retailer_catalogue_sha256_json(jsonb_build_object('parent',to_jsonb(t),
      'children',(select jsonb_agg(to_jsonb(c) order by c.batch_index) from public.retailer_catalogue_child_plans c where c.parent_plan_id=t.id)))
      from public.retailer_catalogue_parent_plans t where t.id=p),'expected_migration_versions',
      (select jsonb_agg(value->>'identifier' order by (value->>'ordinal')::int) from jsonb_array_elements(public.retailer_catalogue_actual_migration_ledger()->'migrations')),
    'expected_migration_fingerprint',public.retailer_catalogue_actual_migration_ledger_fingerprint(),
    'migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1',
    'target_environment','PRODUCTION','production_project_ref','aftboxmrdgyhizicfsfu',
    'production_database_identity','supplementscout-production:aftboxmrdgyhizicfsfu',
    'reason','isolated exact never-approved recovery','closed_by','isolated-owner-decision',
    'requested_at',now(),'request_fingerprint',null);
  return jsonb_set(q,'{request_fingerprint}',to_jsonb(public.retailer_catalogue_production_request_fingerprint(q)));
end $$;

do $cases$
declare q jsonb; changed jsonb; result jsonb; before_counts jsonb; key text; child uuid; p uuid; value text;
begin
  before_counts:=public.retailer_catalogue_business_counts();
  q:=public.planned_close_test_seed('ten-children-491-rows'); p:=(q->>'parent_plan_id')::uuid;
  perform public.planned_close_test_assert((select sum(jsonb_array_length(plan_json->'rows'))=491 from public.retailer_catalogue_child_plans where parent_plan_id=p),'491 rows');
  result:=public.planned_close_test_call(q);
  perform public.planned_close_test_assert(result->>'status'='SUPERSEDED' and result->>'control_writes'='11'
    and result->>'business_writes'='0' and result->>'price_history_writes'='0' and result->>'approval_closed'='false','exact result');
  perform public.planned_close_test_assert((select status='SUPERSEDED' and approval_id is null and approved_at is null
    and audit_log->-1->>'request_fingerprint'=q->>'request_fingerprint' from public.retailer_catalogue_parent_plans where id=p),'parent status and audit');
  perform public.planned_close_test_assert((select count(*)=10 and bool_and(status='SUPERSEDED' and approval_id is null
    and audit_log->-1->>'request_fingerprint'=q->>'request_fingerprint') from public.retailer_catalogue_child_plans where parent_plan_id=p),'all children audited');
  result:=public.planned_close_test_call(q);
  perform public.planned_close_test_assert(result->>'already_closed'='true' and result->>'control_writes'='0','exact replay writes zero');
  changed:=q||jsonb_build_object('reason','different decision');
  changed:=jsonb_set(changed,'{request_fingerprint}',to_jsonb(public.retailer_catalogue_production_request_fingerprint(changed)));
  perform public.planned_close_test_assert(public.planned_close_test_error(changed,'RSBI_REPLAY_BLOCKED'),'different replay blocked');

  foreach key in array array['approval_id','approved_by','approved_at','approval_expires_at','approval_consumed_at'] loop
    q:=public.planned_close_test_seed('parent-'||key); p:=(q->>'parent_plan_id')::uuid;
    value:=case when key='approval_id' then gen_random_uuid()::text when key='approved_by' then 'unexpected' else now()::text end;
    if key='approval_consumed_at' then
      execute format('update public.retailer_catalogue_parent_plans set %I=%L where id=%L',key,value,p);
    else
      update public.retailer_catalogue_parent_plans set approval_id=gen_random_uuid(),approved_by='unexpected',
        approved_at=now()-interval '2 hours',approval_expires_at=now()-interval '1 hour' where id=p;
    end if;
    perform public.planned_close_test_assert(public.planned_close_test_error(q,'RSBI_REPLAY_BLOCKED'),'parent '||key);
  end loop;
  foreach key in array array['approval_id','approved_at','approval_expires_at','approval_consumed_at','rollback_requested_at','rollback_requested_by'] loop
    q:=public.planned_close_test_seed('child-'||key); child:=(q->'expected_children'->0->>'child_plan_id')::uuid;
    value:=case when key='approval_id' then gen_random_uuid()::text when key='rollback_requested_by' then 'unexpected' else now()::text end;
    if key in ('approval_id','approved_at','approval_expires_at') then
      update public.retailer_catalogue_child_plans set approval_id=gen_random_uuid(),
        approved_at=now()-interval '2 hours',approval_expires_at=now()-interval '1 hour' where id=child;
    else
      execute format('update public.retailer_catalogue_child_plans set %I=%L where id=%L',key,value,child);
    end if;
    perform public.planned_close_test_assert(public.planned_close_test_error(q,'RSBI_PARTIAL_BATCH_STATE'),'child '||key);
  end loop;
  q:=public.planned_close_test_seed('live-registration',now()+interval '1 hour');
  perform public.planned_close_test_assert(public.planned_close_test_error(q,'RSBI_SOURCE_STALE'),'live registration');
  q:=public.planned_close_test_seed('bad-manifest',now()-interval '1 hour',true);
  perform public.planned_close_test_assert(public.planned_close_test_error(q,'RSBI_PARTIAL_BATCH_STATE'),'manifest drift');
  q:=public.planned_close_test_seed('concurrent-approval'); child:=(q->'expected_children'->0->>'child_plan_id')::uuid;
  update public.retailer_catalogue_child_plans set status='APPROVED',approval_id=gen_random_uuid(),
    approved_at=now()-interval '2 hours',approval_expires_at=now()-interval '1 hour' where id=child;
  perform public.planned_close_test_assert(public.planned_close_test_error(q,'RSBI_PARTIAL_BATCH_STATE'),'approval changed after preflight');
  update public.retailer_catalogue_child_plans set status='APPLYING' where id=child;
  perform public.planned_close_test_assert(public.planned_close_test_error(q,'RSBI_PARTIAL_BATCH_STATE'),'APPLYING blocked');

  q:=public.planned_close_test_seed('row-approval-evidence');
  insert into public.approved_import_plans(artifact_sha256,run_id,plan_fingerprint,source_row_fingerprint,plan_kind,expires_at,source,plan_json)
  values(q->'expected_children'->0->>'child_plan_fingerprint','mbs-'||left(q->>'parent_plan_fingerprint',16)||'-000000000001-'||repeat('a',16),
    repeat('a',32),repeat('b',64),'feed',now()+interval '10 minutes','retailer_offer_mixed_batch','{}');
  perform public.planned_close_test_assert(public.planned_close_test_error(q,'RSBI_REPLAY_BLOCKED'),'row approvals blocked without child metadata');
  q:=public.planned_close_test_seed('apply-run-evidence'); child:=(q->'expected_children'->0->>'child_plan_id')::uuid;
  insert into public.retailer_catalogue_apply_runs(parent_plan_id,child_plan_id,retailer_id,target_environment,run_type,attempt_ordinal,status,
    parent_plan_fingerprint,child_plan_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,
    policy_fingerprint,code_commit,expected_state_fingerprint,approval_id,approval_expires_at,expected_deltas,started_by)
  select c.parent_plan_id,c.id,c.retailer_id,c.target_environment,'APPLY',1,'STARTED',c.parent_plan_fingerprint,c.child_plan_fingerprint,
    c.source_snapshot_fingerprint,c.canonical_snapshot_fingerprint,c.adapter_fingerprint,c.policy_fingerprint,c.code_commit,
    c.expected_state_fingerprint,gen_random_uuid(),now()-interval '1 hour','{}','isolated-planned-test'
    from public.retailer_catalogue_child_plans c where c.id=child;
  perform public.planned_close_test_assert(public.planned_close_test_error(q,'RSBI_REPLAY_BLOCKED'),'all apply runs blocked');
  q:=public.planned_close_test_seed('batch-approval-evidence'); child:=(q->'expected_children'->0->>'child_plan_id')::uuid;
  insert into public.retailer_offer_sync_batch_approvals(child_plan_id,artifact_fingerprint,execution_fingerprint,target_environment,project_ref,database_identity,
    expected_migration_versions,expected_migration_fingerprint,migration_fingerprint_algorithm,migration_fingerprint_version,
    approved_manifest,expected_deltas,approved_by,approved_at,expires_at)
  select c.id,c.child_plan_fingerprint,repeat('c',64),'PRODUCTION','aftboxmrdgyhizicfsfu','supplementscout-production:aftboxmrdgyhizicfsfu',
    q->'expected_migration_versions',q->>'expected_migration_fingerprint','SHA-256','RSBI-CJ1',c.plan_json,'{}','isolated-planned-test',
    now()-interval '2 hours',now()-interval '1 hour' from public.retailer_catalogue_child_plans c where c.id=child;
  perform public.planned_close_test_assert(public.planned_close_test_error(q,'RSBI_REPLAY_BLOCKED'),'batch approval blocked without child metadata');

  q:=public.planned_close_test_seed('bad-requests');
  changed:=q||jsonb_build_object('control_state_fingerprint',repeat('f',64));
  changed:=jsonb_set(changed,'{request_fingerprint}',to_jsonb(public.retailer_catalogue_production_request_fingerprint(changed)));
  perform public.planned_close_test_assert(public.planned_close_test_error(changed,'RSBI_EXPECTED_STATE_MISMATCH'),'valid-shaped wrong locked state hash');
  foreach key in array array['parent_plan_fingerprint','expected_children','retailer_id','expected_migration_fingerprint',
      'target_environment','production_project_ref','production_database_identity','requested_at','control_state_fingerprint'] loop
    changed:=jsonb_set(q,array[key],case when key='expected_children' then '[]'::jsonb
      when key='requested_at' then to_jsonb((now()-interval '1 hour')::text)
      when key in ('parent_plan_fingerprint','expected_migration_fingerprint') then to_jsonb(repeat('f',64))
      else 'null'::jsonb end);
    changed:=jsonb_set(changed,'{request_fingerprint}',to_jsonb(public.retailer_catalogue_production_request_fingerprint(changed)));
    perform public.planned_close_test_assert(public.planned_close_test_error(changed,'RSBI_'),'bad request '||key);
  end loop;
  perform public.planned_close_test_assert(public.retailer_catalogue_business_counts()=before_counts,'zero business/history changes');
end
$cases$;

-- A failure after children changed must roll back the whole RPC, including audit.
create function public.planned_close_test_abort() returns trigger language plpgsql as $$
begin if new.created_by='isolated-planned-test' and new.status='SUPERSEDED' then raise exception 'INJECTED_PLANNED_ROLLBACK'; end if; return new; end $$;
create trigger planned_close_test_abort before update on public.retailer_catalogue_parent_plans
for each row execute function public.planned_close_test_abort();
do $$ declare q jsonb:=public.planned_close_test_seed('rollback'); p uuid:=(q->>'parent_plan_id')::uuid; before_children jsonb;
begin
  select jsonb_agg(to_jsonb(c) order by batch_index) into before_children from public.retailer_catalogue_child_plans c where parent_plan_id=p;
  perform public.planned_close_test_assert(public.planned_close_test_error(q,'INJECTED_PLANNED_ROLLBACK'),'injected failure');
  perform public.planned_close_test_assert((select status='PLANNED' and audit_log='[]'::jsonb from public.retailer_catalogue_parent_plans where id=p),'parent rollback');
  perform public.planned_close_test_assert((select jsonb_agg(to_jsonb(c) order by batch_index)=before_children from public.retailer_catalogue_child_plans c where parent_plan_id=p),'children and audit rollback');
end $$;

select jsonb_build_object('result','PASS','shape','10_PLANNED_491_ROWS','business_writes',0,'price_history_writes',0,
  'business_dml_guard','STATEMENT_TRIGGER_RAISES_ON_ANY_BUSINESS_DML',
  'planned_control_writes',11,'replay_writes',0,'migration_applied_only_to_disposable_database',true) as never_approved_plan_close_test_report;
rollback;
