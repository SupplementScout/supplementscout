begin;

create or replace function public.execute_local_retailer_catalogue_child(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $executor$
declare
  v_child public.retailer_catalogue_child_plans%rowtype;
  v_parent public.retailer_catalogue_parent_plans%rowtype;
  v_run jsonb;
  v_run_id uuid;
  v_row jsonb;
  v_plan jsonb;
  v_validation jsonb := '[]'::jsonb;
  v_approvals jsonb := '[]'::jsonb;
  v_results jsonb := '[]'::jsonb;
  v_approval jsonb;
  v_result jsonb;
  v_before jsonb;
  v_after jsonb;
  v_actual jsonb;
  v_expected jsonb;
  v_completed jsonb;
  v_error_code text;
  v_error_message text;
  v_request_fingerprint text;
  v_execution_fingerprint text;
  v_started_at timestamptz := clock_timestamp();
begin
  if not public.atomic_import_has_exact_keys(p_request,array[
    'schema_version','parent_plan_id','child_plan_id','parent_plan_fingerprint',
    'child_plan_fingerprint','source_snapshot_fingerprint','canonical_snapshot_fingerprint',
    'code_commit','target_environment','expected_child_status','row_plans','expected_deltas',
    'dependency_group','rollback_group','execution_mode','requested_at','request_fingerprint'
  ]) then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid child execution request keys'); end if;
  if p_request#>>'{schema_version}' <> '1'
     or p_request#>>'{execution_mode}' not in ('LOCAL_DISPOSABLE_EXECUTE','LOCAL_DISPOSABLE_DRY_RUN')
     or p_request#>>'{target_environment}' <> 'LOCAL_POSTGRES'
     or p_request#>>'{expected_child_status}' <> 'APPROVED'
     or jsonb_typeof(p_request->'row_plans') <> 'array'
     or jsonb_array_length(p_request->'row_plans') not between 1 and 50 then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Executor accepts only bounded local disposable requests');
  end if;
  if current_database() !~ '^supplementscout_(phase3_test|stage2_test|retailer_ledger_test)[_a-z0-9]*$'
     or current_setting('app.retailer_catalogue_disposable',true) is distinct from '1'
     or to_regclass('public.retailer_catalogue_disposable_marker') is null
     or coalesce(current_setting('app.safe_update',true),'false') not in ('','false','0','off') then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Disposable database marker or SAFE_UPDATE guard failed');
  end if;
  if current_database() ~* '(aftboxmrdgyhizicfsfu|hxnrsyyqffztlvcrtgbf|supabase|postgres)' then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Remote or protected database identity rejected');
  end if;
  v_request_fingerprint := encode(pg_catalog.sha256(convert_to(public.atomic_import_canonical_json(jsonb_set(p_request,'{request_fingerprint}','null'::jsonb,false)),'UTF8')),'hex');
  if p_request#>>'{request_fingerprint}' is distinct from v_request_fingerprint then perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Request fingerprint mismatch'); end if;

  select * into v_child from public.retailer_catalogue_child_plans where id=(p_request#>>'{child_plan_id}')::uuid;
  if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Child not found'); end if;
  select * into v_parent from public.retailer_catalogue_parent_plans where id=v_child.parent_plan_id;
  if v_parent.id::text is distinct from p_request#>>'{parent_plan_id}'
     or v_parent.parent_plan_fingerprint is distinct from p_request#>>'{parent_plan_fingerprint}'
     or v_child.child_plan_fingerprint is distinct from p_request#>>'{child_plan_fingerprint}'
     or v_child.source_snapshot_fingerprint is distinct from p_request#>>'{source_snapshot_fingerprint}'
     or v_child.canonical_snapshot_fingerprint is distinct from p_request#>>'{canonical_snapshot_fingerprint}'
     or v_child.code_commit is distinct from p_request#>>'{code_commit}'
     or v_child.dependency_group is distinct from p_request#>>'{dependency_group}'
     or v_child.rollback_group is distinct from p_request#>>'{rollback_group}'
     or v_child.expected_deltas is distinct from p_request->'expected_deltas' then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Request is not bound to approved child');
  end if;

  for v_row in select value from jsonb_array_elements(p_request->'row_plans') loop
    if not public.atomic_import_has_exact_keys(v_row,array['phase1_row_plan','atomic_plan','row_plan_fingerprint','artifact_sha256'])
       or v_row#>>'{row_plan_fingerprint}' is distinct from v_row#>>'{phase1_row_plan,fingerprints,row_plan}'
       or v_row#>>'{atomic_plan,meta,source_row_fingerprint}' is distinct from v_row#>>'{phase1_row_plan,fingerprints,classification_record}'
       or v_row#>>'{artifact_sha256}' !~ '^[0-9a-f]{64}$' then
      perform public.retailer_catalogue_raise('RSBI_ROW_PLAN_FINGERPRINT_MISMATCH','Row plan binding mismatch');
    end if;
    v_plan := v_row->'atomic_plan';
    v_result := public.validate_product_import_plan_read_only(v_plan);
    v_validation := v_validation || jsonb_build_array(jsonb_build_object('source_record_id',v_row#>>'{phase1_row_plan,source_record_id}','valid',true,'result',v_result));
  end loop;
  if p_request#>>'{execution_mode}' = 'LOCAL_DISPOSABLE_DRY_RUN' then
    return jsonb_build_object('request_fingerprint',v_request_fingerprint,'parent_plan_id',v_parent.id,'child_plan_id',v_child.id,'run_id',null,'started_at',v_started_at,'completed_at',clock_timestamp(),'validator_results',v_validation,'row_approval_ids','[]'::jsonb,'row_results','[]'::jsonb,'before_counts',null,'after_counts',null,'actual_deltas',null,'expected_delta_comparison',null,'child_status_before',v_child.status,'child_status_after',v_child.status,'parent_status_before',v_parent.status,'parent_status_after',v_parent.status,'rollback_status','NOT_REQUIRED','error_code',null,'retryability','NOT_APPLICABLE','execution_fingerprint',encode(pg_catalog.sha256(convert_to(public.atomic_import_canonical_json(p_request),'UTF8')),'hex'));
  end if;

  v_run := public.begin_retailer_catalogue_child_apply(v_child.id,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_child.source_snapshot_fingerprint,v_child.canonical_snapshot_fingerprint,v_child.adapter_fingerprint,v_child.policy_fingerprint,v_child.code_commit,v_child.expected_state_fingerprint,'phase3-local-executor');
  if v_run->>'code'='RSBI_REPLAY_BLOCKED' then return v_run||jsonb_build_object('request_fingerprint',v_request_fingerprint,'retryability','NO','rollback_status','NOT_REQUIRED'); end if;
  v_run_id := (v_run->>'run_id')::uuid;
  begin
    select jsonb_build_object('retailers',(select count(*) from public.retailers),'products',(select count(*) from public.products),'product_variants',(select count(*) from public.product_variants),'retailer_products',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),'price_history',(select count(*) from public.price_history)) into v_before;
    for v_row in select value from jsonb_array_elements(p_request->'row_plans') order by value#>>'{phase1_row_plan,source_record_id}' loop
      v_plan := v_row->'atomic_plan';
      v_approval := public.approve_product_import_plan(v_plan,v_row->>'artifact_sha256','rsbi-'||replace(v_run_id::text,'-','')||'-'||left(v_row#>>'{row_plan_fingerprint}',12),'phase3_local_child',least(v_child.approval_expires_at,now()+interval '15 minutes'));
      v_approvals := v_approvals||jsonb_build_array(v_approval->>'approval_id');
      v_result := public.apply_approved_product_import_plan((v_approval->>'approval_id')::uuid,v_row->>'artifact_sha256',v_plan#>>'{meta,plan_fingerprint}',v_plan#>>'{meta,source_row_fingerprint}',nullif(v_plan#>>'{retailer,id}','')::bigint,v_plan#>>'{meta,plan_kind}',v_approval->>'run_id');
      if v_result->>'approval_status'<>'consumed' then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Row approval was not consumed'); end if;
      v_results := v_results||jsonb_build_array(v_result);
    end loop;
    select jsonb_build_object('retailers',(select count(*) from public.retailers),'products',(select count(*) from public.products),'product_variants',(select count(*) from public.product_variants),'retailer_products',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),'price_history',(select count(*) from public.price_history)) into v_after;
    select jsonb_object_agg(k,(v_after->>k)::bigint-(v_before->>k)::bigint) into v_actual from unnest(array['retailers','products','product_variants','retailer_products','offers','price_history']) k;
    v_expected := p_request->'expected_deltas';
    if v_actual is distinct from v_expected then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Exact child deltas mismatch',jsonb_build_object('expected',v_expected,'actual',v_actual)); end if;
    v_execution_fingerprint:=encode(pg_catalog.sha256(convert_to(public.atomic_import_canonical_json(jsonb_build_object('request',v_request_fingerprint,'run',v_run_id,'results',v_results,'actual_deltas',v_actual)),'UTF8')),'hex');
    v_completed:=public.complete_retailer_catalogue_child_apply(v_run_id,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_after,jsonb_build_object('request_fingerprint',v_request_fingerprint,'execution_fingerprint',v_execution_fingerprint,'row_approval_ids',v_approvals,'row_results',v_results,'actual_deltas',v_actual),'phase3-local-executor');
    return jsonb_build_object('request_fingerprint',v_request_fingerprint,'parent_plan_id',v_parent.id,'child_plan_id',v_child.id,'run_id',v_run_id,'started_at',v_started_at,'completed_at',clock_timestamp(),'validator_results',v_validation,'row_approval_ids',v_approvals,'row_results',v_results,'before_counts',v_before,'after_counts',v_after,'actual_deltas',v_actual,'expected_delta_comparison',true,'child_status_before','APPROVED','child_status_after','APPLIED','parent_status_before',v_parent.status,'parent_status_after',v_completed->>'parent_status','rollback_status','NOT_REQUIRED','error_code',null,'retryability','NO','execution_fingerprint',v_execution_fingerprint);
  exception when others then
    get stacked diagnostics v_error_message=message_text;
    v_error_code:=coalesce(substring(v_error_message from 'RSBI_[A-Z_]+'),'RSBI_ATOMIC_APPLY_FAILED');
    v_completed:=public.fail_retailer_catalogue_child_apply(v_run_id,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_error_code,jsonb_build_object('request_fingerprint',v_request_fingerprint,'message',v_error_message,'transaction_rolled_back',true),'phase3-local-executor');
    return jsonb_build_object('request_fingerprint',v_request_fingerprint,'parent_plan_id',v_parent.id,'child_plan_id',v_child.id,'run_id',v_run_id,'started_at',v_started_at,'completed_at',clock_timestamp(),'validator_results',v_validation,'row_approval_ids','[]'::jsonb,'row_results','[]'::jsonb,'before_counts',v_before,'after_counts',v_before,'actual_deltas',jsonb_build_object('retailers',0,'products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0),'expected_delta_comparison',false,'child_status_before','APPROVED','child_status_after','FAILED','parent_status_before',v_parent.status,'parent_status_after',v_completed->>'parent_status','rollback_status','TRANSACTION_ROLLED_BACK','error_code',v_error_code,'retryability','REQUIRES_TRANSITION','execution_fingerprint',null);
  end;
end;
$executor$;

alter function public.execute_local_retailer_catalogue_child(jsonb) owner to postgres;
revoke all on function public.execute_local_retailer_catalogue_child(jsonb) from public,anon,authenticated,service_role;

commit;
