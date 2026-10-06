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
  (select oid from pg_catalog.pg_database where datname=current_database()),true,'partial-close-test'
) on conflict(id) do update set
  target_environment=excluded.target_environment,project_ref=excluded.project_ref,database_identity=excluded.database_identity,
  database_system_identifier=excluded.database_system_identifier,database_oid=excluded.database_oid,is_active=true,attested_by=excluded.attested_by;

create or replace function public.partial_close_test_assert(p_condition boolean,p_label text)
returns void language plpgsql set search_path=pg_catalog as $assert$
begin
  if not coalesce(p_condition,false) then raise exception 'partial close assertion failed: %',p_label; end if;
end
$assert$;

create or replace function public.partial_close_test_call(p_request jsonb)
returns jsonb language sql security definer set search_path=pg_catalog,public,pg_temp
as $call$ select public.close_expired_retailer_offer_sync_approval(p_request) $call$;
alter function public.partial_close_test_call(jsonb) owner to retailer_catalogue_staging_approver;

do $partial_close$
declare
  v_parent uuid:=gen_random_uuid(); v_parent_approval uuid:=gen_random_uuid();
  v_parent_fp text:=public.retailer_catalogue_sha256_json(jsonb_build_object('case','partial-12-1-6','kind','parent'));
  v_source_fp text:=public.retailer_catalogue_sha256_json(jsonb_build_object('case','partial-12-1-6','kind','source'));
  v_canonical_fp text:=public.retailer_catalogue_sha256_json(jsonb_build_object('case','partial-12-1-6','kind','canonical'));
  v_adapter_fp text:=public.retailer_catalogue_sha256_json(jsonb_build_object('case','partial-12-1-6','kind','adapter'));
  v_policy_fp text:=public.retailer_catalogue_sha256_json(jsonb_build_object('case','partial-12-1-6','kind','policy'));
  v_state_fp text:=public.retailer_catalogue_sha256_json(jsonb_build_object('case','partial-12-1-6','kind','state'));
  v_child_manifest jsonb:='[]'::jsonb; v_children jsonb:='[]'::jsonb;
  v_index integer; v_row_index integer; v_row_count integer; v_child uuid; v_child_approval uuid;
  v_batch_approval uuid; v_run uuid; v_child_fp text; v_execution_fp text; v_plan jsonb; v_rows jsonb;
  v_versions jsonb; v_ledger_fp text; v_request jsonb; v_result jsonb; v_replay jsonb;
  v_before jsonb; v_after jsonb; v_history_before bigint; v_history_after bigint;
begin
  select jsonb_agg(value->>'identifier' order by (value->>'ordinal')::int)
  into v_versions from jsonb_array_elements(public.retailer_catalogue_actual_migration_ledger()->'migrations');
  v_ledger_fp:=public.retailer_catalogue_actual_migration_ledger_fingerprint();

  for v_index in 0..18 loop
    v_child:=gen_random_uuid();
    v_child_fp:=public.retailer_catalogue_sha256_json(jsonb_build_object('case','partial-12-1-6','kind','child','batch_index',v_index));
    v_children:=v_children||jsonb_build_array(jsonb_build_object('id',v_child,'fingerprint',v_child_fp));
    v_child_manifest:=v_child_manifest||jsonb_build_array(jsonb_build_object(
      'child_plan_id',v_child,'child_plan_fingerprint',v_child_fp,'batch_index',v_index,
      'batch_count',19,'record_ids',jsonb_build_array((v_index+1)::text)
    ));
  end loop;

  insert into public.retailer_catalogue_parent_plans(
    id,parent_plan_fingerprint,retailer_id,target_environment,source_snapshot_fingerprint,canonical_snapshot_fingerprint,
    adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,status,expected_deltas,plan_json,
    child_manifest,rollback_manifest,source_captured_at,canonical_snapshot_at,approval_id,approved_by,approved_at,
    approval_expires_at,approval_consumed_at,created_by,audit_log
  ) values(
    v_parent,v_parent_fp,9902,'STAGING',v_source_fp,v_canonical_fp,v_adapter_fp,v_policy_fp,repeat('c',40),v_state_fp,
    'PARTIALLY_APPLIED','{}',jsonb_build_object('case','partial-12-1-6'),v_child_manifest,'{}',now()-interval '3 hours',
    now()-interval '3 hours',v_parent_approval,'partial-close-test',now()-interval '2 hours',now()-interval '1 hour',
    now()-interval '90 minutes','partial-close-test',jsonb_build_array(jsonb_build_object('event','PARTIAL_FIXTURE'))
  );

  for v_index in 0..18 loop
    v_child:=(v_children->v_index->>'id')::uuid;
    v_child_fp:=v_children->v_index->>'fingerprint';
    v_row_count:=case when v_index<11 then 50 when v_index=11 then 41 else 50 end;
    select jsonb_agg(jsonb_build_object('offer_id',(v_index*100+g)::text) order by g)
    into v_rows from generate_series(1,v_row_count) g;
    v_plan:=jsonb_build_object('schema_version',1,'case','partial-12-1-6','batch_index',v_index,'rows',v_rows);
    v_child_approval:=case when v_index<=12 then gen_random_uuid() else null end;
    insert into public.retailer_catalogue_child_plans(
      id,parent_plan_id,retailer_id,target_environment,child_plan_fingerprint,parent_plan_fingerprint,
      source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,
      expected_state_fingerprint,batch_index,batch_count,dependency_group,rollback_group,record_ids,status,
      expected_deltas,plan_json,rollback_manifest,approval_id,approved_at,approval_expires_at,approval_consumed_at,audit_log
    ) values(
      v_child,v_parent,9902,'STAGING',v_child_fp,v_parent_fp,v_source_fp,v_canonical_fp,v_adapter_fp,v_policy_fp,
      repeat('c',40),v_state_fp,v_index,19,'partial-close-test','partial-close-test',jsonb_build_array((v_index+1)::text),
      case when v_index<12 then 'APPLIED' when v_index=12 then 'APPROVED' else 'PLANNED' end,'{}',v_plan,'[]',
      v_child_approval,case when v_index<=12 then now()-interval '2 hours' end,
      case when v_index<=12 then now()-interval '1 hour' end,
      case when v_index<12 then now()-interval '90 minutes' end,'[]'
    );

    if v_index<=12 then
      v_batch_approval:=gen_random_uuid();
      v_execution_fp:=public.retailer_catalogue_sha256_json(jsonb_build_object('case','partial-12-1-6','kind','execution','batch_index',v_index));
      insert into public.retailer_offer_sync_batch_approvals(
        id,child_plan_id,artifact_fingerprint,execution_fingerprint,target_environment,project_ref,database_identity,
        expected_migration_versions,expected_migration_fingerprint,migration_fingerprint_algorithm,migration_fingerprint_version,
        approved_manifest,expected_deltas,approved_by,approved_at,expires_at,consumed_at,result
      ) values(
        v_batch_approval,v_child,v_child_fp,v_execution_fp,'STAGING','hxnrsyyqffztlvcrtgbf',
        'supplementscout-staging:hxnrsyyqffztlvcrtgbf',v_versions,v_ledger_fp,'SHA-256','RSBI-CJ1',v_plan,'{}',
        'partial-close-test',now()-interval '2 hours',now()-interval '1 hour',
        case when v_index<12 then now()-interval '90 minutes' end,
        case when v_index<12 then jsonb_build_object('status','APPLIED','row_approvals_consumed',v_row_count) end
      );
      if v_index=12 then
        v_request:=jsonb_build_object(
          'schema_version',1,'approval_id',v_batch_approval,'parent_plan_id',v_parent,'child_plan_id',v_child,
          'parent_plan_fingerprint',v_parent_fp,'child_plan_fingerprint',v_child_fp,'artifact_fingerprint',v_child_fp,
          'execution_fingerprint',v_execution_fp,'approval_expected_migration_fingerprint',v_ledger_fp,
          'expected_migration_versions',v_versions,'expected_migration_fingerprint',v_ledger_fp,
          'migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1',
          'target_environment','STAGING','staging_project_ref','hxnrsyyqffztlvcrtgbf',
          'staging_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf',
          'reason','preserve applied prefix and close exact expired suffix','closed_by','partial-close-test',
          'requested_at',now(),'request_fingerprint',null
        );
      else
        insert into public.retailer_catalogue_apply_runs(
          parent_plan_id,child_plan_id,retailer_id,target_environment,run_type,attempt_ordinal,status,
          parent_plan_fingerprint,child_plan_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,
          adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,approval_id,approval_expires_at,
          before_counts,after_counts,expected_deltas,result_metadata,started_by,started_at,completed_at
        ) values(
          v_parent,v_child,9902,'STAGING','APPLY',1,'SUCCEEDED',v_parent_fp,v_child_fp,v_source_fp,v_canonical_fp,
          v_adapter_fp,v_policy_fp,repeat('c',40),v_state_fp,v_child_approval,now()-interval '1 hour','{}','{}','{}',
          jsonb_build_object('status','APPLIED'),'partial-close-test',now()-interval '100 minutes',now()-interval '90 minutes'
        ) returning id into v_run;
        insert into public.retailer_catalogue_staging_recovery_manifests(
          package_id,package_fingerprint,child_plan_id,apply_run_id,dependency_group,execution_fingerprint,
          rollback_manifest_fingerprint,ownership,reverse_dependency_order,before_counts,other_retailer_fingerprint,
          protected_shared_fingerprint,orphan_counts,applied_owned_state_fingerprint,status
        ) values(
          v_batch_approval,v_child_fp,v_child,v_run,'partial-close-test',v_execution_fp,
          public.retailer_catalogue_sha256_json(jsonb_build_object('case','partial-12-1-6','kind','rollback','batch_index',v_index)),
          jsonb_build_object('plan_owned_only',true),'[]','{}',repeat('1',64),repeat('2',64),'{}',repeat('3',64),'READY'
        );
        for v_row_index in 1..v_row_count loop
          insert into public.approved_import_plans(
            artifact_sha256,run_id,plan_fingerprint,source_row_fingerprint,plan_kind,created_at,expires_at,
            consumed_at,source,plan_json,status
          ) values(
            v_child_fp,'partial-'||v_index::text||'-'||v_row_index::text,
            lpad(to_hex(v_index*1000+v_row_index),32,'0'),lpad(to_hex(v_index*1000+v_row_index),64,'0'),'feed',
            now()-interval '2 hours',now()-interval '1 hour',now()-interval '90 minutes',
            'retailer_offer_mixed_batch','{}','consumed'
          );
        end loop;
      end if;
    end if;
  end loop;

  v_request:=jsonb_set(v_request,'{request_fingerprint}',to_jsonb(public.retailer_catalogue_staging_request_fingerprint(v_request)));
  v_before:=public.retailer_catalogue_business_counts(); select count(*) into v_history_before from public.price_history;
  v_result:=public.partial_close_test_call(v_request);
  perform public.partial_close_test_assert(v_result->>'status'='SUPERSEDED','partial result status');
  perform public.partial_close_test_assert((v_result->>'preserved_applied_child_count')::int=12,'twelve applied children preserved');
  perform public.partial_close_test_assert((v_result->>'closed_child_count')::int=7,'one approved and six planned children closed');
  perform public.partial_close_test_assert((v_result->>'control_writes')::int=9,'only approval, suffix and parent changed');
  perform public.partial_close_test_assert((v_result->>'business_writes')::int=0 and (v_result->>'price_history_writes')::int=0,'zero business writes reported');
  perform public.partial_close_test_assert((select status='SUPERSEDED' from public.retailer_catalogue_parent_plans where id=v_parent),'parent superseded');
  perform public.partial_close_test_assert((select count(*)=19 and count(*) filter(where status='APPLIED')=12 and count(*) filter(where status='SUPERSEDED')=7 from public.retailer_catalogue_child_plans where parent_plan_id=v_parent),'applied prefix preserved and suffix superseded');
  perform public.partial_close_test_assert((select count(*)=12 and count(*) filter(where status='SUCCEEDED')=12 from public.retailer_catalogue_apply_runs where parent_plan_id=v_parent),'successful run history preserved');
  perform public.partial_close_test_assert((select count(*)=591 from public.approved_import_plans a join public.retailer_catalogue_child_plans c on c.child_plan_fingerprint=a.artifact_sha256 where c.parent_plan_id=v_parent and a.source='retailer_offer_mixed_batch'),'591 row approvals preserved');
  v_after:=public.retailer_catalogue_business_counts(); select count(*) into v_history_after from public.price_history;
  perform public.partial_close_test_assert(v_after=v_before and v_history_after=v_history_before,'business and price history unchanged');
  v_replay:=public.partial_close_test_call(v_request);
  perform public.partial_close_test_assert((v_replay->>'already_closed')::boolean and (v_replay->>'control_writes')::int=0,'exact replay is no-write');
end
$partial_close$;

select jsonb_build_object(
  'result','PASS','shape','12_APPLIED_1_APPROVED_6_PLANNED','preserved_applied_children',12,
  'superseded_suffix_children',7,'preserved_row_approvals',591,'business_writes',0,'price_history_writes',0
) as retailer_offer_partial_plan_close_test_report;

rollback;
