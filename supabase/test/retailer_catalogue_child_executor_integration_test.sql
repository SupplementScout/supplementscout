\if :{?phase3_expected_database}
\else
\quit
\endif
\if :{?phase3_test_database_confirmed}
\else
\quit
\endif

select 1 / case when :'phase3_test_database_confirmed'='1'
  and current_database()=:'phase3_expected_database'
  and current_database() like 'supplementscout_stage2_test_atomic_import_%'
  then 1 else 0 end as phase3_disposable_database_guard;

create table public.retailer_catalogue_disposable_marker(id boolean primary key default true check(id));
insert into public.retailer_catalogue_disposable_marker values(true);
select set_config('app.retailer_catalogue_disposable','1',false);
select set_config('app.safe_update','false',false);

create or replace function public.phase3_test_request(p_count integer,p_case text,p_expected_override integer default null)
returns jsonb language plpgsql as $$
declare
  v_parent uuid:=gen_random_uuid(); v_child uuid:=gen_random_uuid(); v_approval uuid:=gen_random_uuid();
  v_parent_fp text:=encode(pg_catalog.sha256(convert_to(v_parent::text,'UTF8')),'hex'); v_child_fp text:=encode(pg_catalog.sha256(convert_to(v_child::text,'UTF8')),'hex');
  v_source text:=encode(pg_catalog.sha256(convert_to('control:'||p_case,'UTF8')),'hex'); v_row_source text:=repeat('a',64); v_canonical text:=repeat('c',64); v_adapter text:=repeat('d',64); v_policy text:=repeat('e',64); v_state text:=repeat('f',64);
  v_rows jsonb:='[]'; v_plan jsonb; v_phase jsonb; v_expected jsonb; v_request jsonb; i integer;
begin
  v_expected:=jsonb_build_object('retailers',0,'products',coalesce(p_expected_override,p_count),'product_variants',p_count,'retailer_products',p_count,'offers',p_count,'price_history',p_count);
  insert into public.retailer_catalogue_parent_plans(id,parent_plan_fingerprint,retailer_id,target_environment,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,status,expected_deltas,plan_json,rollback_manifest,source_captured_at,canonical_snapshot_at,approval_id,approved_by,approved_at,approval_expires_at,created_by)
  values(v_parent,v_parent_fp,1,'LOCAL_POSTGRES',v_source,v_canonical,v_adapter,v_policy,repeat('1',40),v_state,'APPROVED',v_expected,'{}'::jsonb,jsonb_build_object('rollback_fingerprint',repeat('9',64)),now(),now(),v_approval,'phase3-test',now(),now()+interval '1 hour','phase3-test');
  insert into public.retailer_catalogue_child_plans(id,parent_plan_id,retailer_id,target_environment,child_plan_fingerprint,parent_plan_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,batch_index,batch_count,dependency_group,rollback_group,record_ids,status,expected_deltas,plan_json,rollback_manifest,approval_id,approved_at,approval_expires_at)
  values(v_child,v_parent,1,'LOCAL_POSTGRES',v_child_fp,v_parent_fp,v_source,v_canonical,v_adapter,v_policy,repeat('1',40),v_state,0,1,'group:'||p_case,'rollback:'||p_case,(select jsonb_agg(x::text) from generate_series(1,p_count)x),'APPROVED',v_expected,'{}','[]',gen_random_uuid(),now(),now()+interval '30 minutes');
  for i in 1..p_count loop
    v_plan:=public.atomic_test_safe_plan('phase3-'||p_case||'-'||i,'phase3-'||p_case||'-'||i);
    if p_case='mid-failure' and i=26 then
      v_plan:=jsonb_set(v_plan,'{retailer_product,values,external_variant_id}','"atomic-safe-1"');
      v_plan:=public.atomic_test_finalize_plan(v_plan);
    end if;
    v_phase:=jsonb_build_object('schema_version',1,'source_record_id',lpad(i::text,3,'0'),'fingerprints',jsonb_build_object('classification_record',v_row_source,'row_plan',encode(pg_catalog.sha256(convert_to(p_case||':'||i,'UTF8')),'hex')));
    v_rows:=v_rows||jsonb_build_array(jsonb_build_object('phase1_row_plan',v_phase,'atomic_plan',v_plan,'row_plan_fingerprint',v_phase#>>'{fingerprints,row_plan}','artifact_sha256',encode(pg_catalog.sha256(convert_to(public.atomic_import_canonical_json(v_plan),'UTF8')),'hex')));
  end loop;
  v_request:=jsonb_build_object('schema_version',1,'parent_plan_id',v_parent,'child_plan_id',v_child,'parent_plan_fingerprint',v_parent_fp,'child_plan_fingerprint',v_child_fp,'source_snapshot_fingerprint',v_source,'canonical_snapshot_fingerprint',v_canonical,'code_commit',repeat('1',40),'target_environment','LOCAL_POSTGRES','expected_child_status','APPROVED','row_plans',v_rows,'expected_deltas',v_expected,'dependency_group','group:'||p_case,'rollback_group','rollback:'||p_case,'execution_mode','LOCAL_DISPOSABLE_EXECUTE','requested_at',to_char(clock_timestamp(),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'request_fingerprint',null);
  return jsonb_set(v_request,'{request_fingerprint}',to_jsonb(encode(pg_catalog.sha256(convert_to(public.atomic_import_canonical_json(v_request),'UTF8')),'hex')));
end $$;

do $$ declare r jsonb; begin
  r:=public.execute_local_retailer_catalogue_child(public.phase3_test_request(10,'canary'));
  if r->>'child_status_after'<>'APPLIED' or (r#>>'{actual_deltas,products}')::int<>10 or jsonb_array_length(r->'row_approval_ids')<>10 then raise exception '10-row canary failed: %',r; end if;
end $$;

do $$ declare q jsonb; r jsonb; begin
  q:=public.phase3_test_request(50,'fifty'); r:=public.execute_local_retailer_catalogue_child(q);
  if r->>'child_status_after'<>'APPLIED' or (r#>>'{actual_deltas,products}')::int<>50 then raise exception '50-row child failed: %',r; end if;
  r:=public.execute_local_retailer_catalogue_child(q); if r->>'code'<>'RSBI_REPLAY_BLOCKED' then raise exception 'replay was not blocked: %',r; end if;
end $$;

do $$ declare r jsonb; n bigint; begin
  select count(*) into n from public.approved_import_plans; r:=public.execute_local_retailer_catalogue_child(public.phase3_test_request(50,'mid-failure'));
  if r->>'child_status_after'<>'FAILED' or r->>'rollback_status'<>'TRANSACTION_ROLLED_BACK' then raise exception 'mid-child failure did not roll back: %',r; end if;
  if (select count(*) from public.approved_import_plans)<>n then raise exception 'mid-child rollback left consumed approvals'; end if;
  if exists(select 1 from public.products where slug like 'phase3-mid-failure-%') then raise exception 'mid-child rollback left business rows'; end if;
end $$;

do $$ declare r jsonb; n bigint; begin
  select count(*) into n from public.approved_import_plans; r:=public.execute_local_retailer_catalogue_child(public.phase3_test_request(10,'delta-mismatch',11));
  if r->>'error_code'<>'RSBI_EXPECTED_STATE_MISMATCH' or r->>'rollback_status'<>'TRANSACTION_ROLLED_BACK' then raise exception 'delta mismatch did not fail closed: %',r; end if;
  if (select count(*) from public.approved_import_plans)<>n or exists(select 1 from public.products where slug like 'phase3-delta-mismatch-%') then raise exception 'delta mismatch left writes'; end if;
end $$;

select jsonb_build_object('result','PASS','canary_rows',10,'bounded_rows',50,'mid_child_rollback',true,'delta_mismatch_rollback',true,'replay_blocked',true,'remote_writes',0);
