\if :{?staging_executor_test_database_confirmed}
\else
\quit
\endif
select 1/case when :'staging_executor_test_database_confirmed'='1' and current_database()=:'staging_executor_expected_database' and current_database() like 'supplementscout_stage2_test_atomic_import_staging_executor_%' then 1 else 0 end;

create table public.retailer_catalogue_staging_simulation_marker(id boolean primary key default true check(id));
insert into public.retailer_catalogue_staging_simulation_marker values(true);
select set_config('app.safe_update','false',false);
select set_config('app.retailer_catalogue_staging_marker','1',false);
select set_config('app.retailer_catalogue_allow','1',false);
select set_config('app.retailer_catalogue_project_ref','hxnrsyyqffztlvcrtgbf',false);
select set_config('app.retailer_catalogue_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf',false);
select set_config('app.retailer_catalogue_migration_fingerprint','d441888ff840b0e054d6345268a9169b9ce1639ee920b34879116d554daf1312',false);

do $$ begin
  if to_regprocedure('public.execute_local_retailer_catalogue_child(jsonb)') is not null then raise exception 'staging executor depends on Phase 3 local function'; end if;
end $$;

insert into public.products(id,name,slug,brand,category,product_format,is_active) values(91,'Project AD Shredabull Untamed 2.0 50 Caps','project-ad-shredabull-untamed-2-0-50-caps','Project AD','Fat Burner','capsule',true) on conflict(id) do nothing;
insert into public.product_variants(id,product_id,variant_key,display_name,pack_count,product_format,is_active,is_default) values(39,91,'default','Default',1,'capsule',true,true) on conflict(id) do nothing;

do $$ declare i integer; begin
  for i in 1..7 loop perform public.atomic_test_apply(public.atomic_test_safe_plan('staging-noop-seed-'||i,'staging-noop-seed-'||i)); end loop;
end $$;

create or replace function public.staging_test_wrap(p_source_id text,p_plan jsonb)
returns jsonb language sql as $$
  select jsonb_build_object(
    'phase1_row_plan',jsonb_build_object('schema_version',1,'source_record_id',p_source_id,'fingerprints',jsonb_build_object('classification_record',p_plan#>>'{meta,source_row_fingerprint}','row_plan',encode(pg_catalog.sha256(convert_to(p_source_id||public.atomic_import_canonical_json(p_plan),'UTF8')),'hex'))),
    'atomic_plan',p_plan,
    'row_plan_fingerprint',encode(pg_catalog.sha256(convert_to(p_source_id||public.atomic_import_canonical_json(p_plan),'UTF8')),'hex'),
    'artifact_sha256',encode(pg_catalog.sha256(convert_to(public.atomic_import_canonical_json(p_plan),'UTF8')),'hex')
  )
$$;

create table public.staging_test_context(key text primary key,value jsonb not null);

create or replace function public.staging_test_request(p_child uuid,p_rows jsonb)
returns jsonb language plpgsql as $$
declare c public.retailer_catalogue_child_plans%rowtype; p public.retailer_catalogue_parent_plans%rowtype; f public.retailer_catalogue_staging_fixture_approvals%rowtype; q jsonb;
begin
  select * into strict c from public.retailer_catalogue_child_plans where id=p_child;
  select * into strict p from public.retailer_catalogue_parent_plans where id=c.parent_plan_id;
  select * into strict f from public.retailer_catalogue_staging_fixture_approvals where parent_plan_id=p.id;
  q:=jsonb_build_object('schema_version',1,'target_environment','STAGING','staging_project_ref','hxnrsyyqffztlvcrtgbf','staging_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf','parent_plan_id',p.id,'child_plan_id',c.id,'fixture_id',f.fixture_id,'fixture_fingerprint',f.fixture_fingerprint,'fixture_approval_id',f.id,'parent_plan_fingerprint',p.parent_plan_fingerprint,'child_plan_fingerprint',c.child_plan_fingerprint,'source_snapshot_fingerprint',c.source_snapshot_fingerprint,'canonical_snapshot_fingerprint',c.canonical_snapshot_fingerprint,'migration_ledger_fingerprint',f.migration_ledger_fingerprint,'adapter_fingerprint',c.adapter_fingerprint,'policy_fingerprint',c.policy_fingerprint,'code_commit',c.code_commit,'expected_deltas',c.expected_deltas,'row_plans',p_rows,'approval_expiry',c.approval_expires_at,'requested_at',now(),'explicit_allow',true,'request_fingerprint',null);
  return jsonb_set(q,'{request_fingerprint}',to_jsonb(encode(pg_catalog.sha256(convert_to(public.atomic_import_canonical_json(q),'UTF8')),'hex')));
end $$;

do $$
declare parent_id uuid:=gen_random_uuid(); parent_fp text:=repeat('1',64); source_fp text:=repeat('2',64); canonical_fp text:=repeat('3',64); adapter_fp text:=repeat('4',64); policy_fp text:=repeat('5',64); state_fp text:=repeat('6',64); rollback_fp text:=repeat('7',64); child_ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()]; manifest jsonb:='[]'; fixture_result jsonb; parent_result jsonb; i integer; deltas jsonb[]:=array[
  '{"retailers":0,"products":1,"product_variants":1,"retailer_products":1,"offers":1,"price_history":1}'::jsonb,
  '{"retailers":0,"products":1,"product_variants":1,"retailer_products":1,"offers":1,"price_history":1}'::jsonb,
  '{"retailers":0,"products":0,"product_variants":0,"retailer_products":1,"offers":1,"price_history":1}'::jsonb,
  '{"retailers":0,"products":0,"product_variants":0,"retailer_products":0,"offers":0,"price_history":0}'::jsonb]; groups text[]:=array['DG1_HEART_CARE_ATOMIC','DG2_CONTEH_ATOMIC','DG3_PROJECT_AD_OFFER','DG4_EXISTING_NOOPS']; record_sets jsonb[]:=array['["50844992602450"]'::jsonb,'["53951719768402"]'::jsonb,'["51935656018258"]'::jsonb,'["53868239389010","53868239421778","53868239454546","53868239487314","53868239520082","53896427798866","50927006581074"]'::jsonb];
begin
  for i in 1..4 loop manifest:=manifest||jsonb_build_array(jsonb_build_object('parent_plan_id',parent_id,'child_plan_id',child_ids[i],'child_plan_fingerprint',encode(pg_catalog.sha256(convert_to('child'||i,'UTF8')),'hex'),'batch_index',i-1,'batch_count',4,'dependency_group',groups[i],'rollback_group','fixture-recovery','record_ids',record_sets[i],'expected_deltas',deltas[i],'rollback_operations',jsonb_build_array(jsonb_build_object('ownership',jsonb_build_object('plan_owned_only',true))))); end loop;
  insert into public.retailer_catalogue_parent_plans(id,parent_plan_fingerprint,retailer_id,target_environment,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,status,expected_deltas,plan_json,child_manifest,rollback_manifest,source_captured_at,canonical_snapshot_at,created_by)
  values(parent_id,parent_fp,1,'STAGING',source_fp,canonical_fp,adapter_fp,policy_fp,'6f7eefb29f775e773bd0764664a0ba138993fa06',state_fp,'PLANNED','{"retailers":0,"products":2,"product_variants":2,"retailer_products":3,"offers":3,"price_history":3}',jsonb_build_object('fixture_fingerprint','2c62a82c169ee20fab8a86c125423aa50b2d9613283907c408726d4ed89981f5'),manifest,jsonb_build_object('rollback_fingerprint',rollback_fp),now(),now(),'staging-test');
  perform set_config('app.retailer_catalogue_invocation_role','retailer_catalogue_staging_approver',false);
  fixture_result:=public.approve_retailer_catalogue_staging_fixture(jsonb_build_object('fixture_id','jons-staging-canary-real-10-v1-20260717','fixture_fingerprint','2c62a82c169ee20fab8a86c125423aa50b2d9613283907c408726d4ed89981f5','project_ref','hxnrsyyqffztlvcrtgbf','database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf','migration_ledger_fingerprint','d441888ff840b0e054d6345268a9169b9ce1639ee920b34879116d554daf1312','source_snapshot_fingerprint',source_fp,'canonical_snapshot_fingerprint',canonical_fp,'adapter_fingerprint',adapter_fp,'policy_fingerprint',policy_fp,'code_commit','6f7eefb29f775e773bd0764664a0ba138993fa06','canonical_decisions',jsonb_build_object('50844992602450','APPROVE_SIMPLE_CANONICAL','53951719768402','APPROVE_SIMPLE_CANONICAL','51935656018258',jsonb_build_object('product_id','91','variant_id','39')),'approved_by','manual-reviewer','expires_at',now()+interval '1 hour'));
  parent_result:=public.approve_retailer_catalogue_staging_parent((fixture_result->>'fixture_approval_id')::uuid,parent_id,parent_fp,'manual-reviewer',now()+interval '45 minutes');
  perform public.generate_retailer_catalogue_child_plans(parent_id,parent_fp);
  insert into public.staging_test_context values('main',jsonb_build_object('parent_id',parent_id,'parent_fp',parent_fp,'parent_approval_id',parent_result->>'approval_id','child_ids',to_jsonb(child_ids),'before_counts',jsonb_build_object('retailers',(select count(*) from retailers),'products',(select count(*) from products),'product_variants',(select count(*) from product_variants),'retailer_products',(select count(*) from retailer_products),'offers',(select count(*) from offers),'price_history',(select count(*) from price_history))));
end $$;

do $$
declare ctx jsonb:=(select value from staging_test_context where key='main'); ids jsonb:=ctx->'child_ids'; q jsonb; r jsonb; rows jsonb; i integer; source_ids text[]:=array['53868239389010','53868239421778','53868239454546','53868239487314','53868239520082','53896427798866','50927006581074'];
begin
  perform set_config('app.retailer_catalogue_invocation_role','retailer_catalogue_staging_executor',false);
  begin perform public.approve_retailer_catalogue_child_plan((ids->>1)::uuid,(ctx->>'parent_approval_id')::uuid,ctx->>'parent_fp',encode(pg_catalog.sha256(convert_to('child2','UTF8')),'hex'),now()+interval '20 minutes'); raise exception 'dependency ordering accepted child 2 early'; exception when others then if sqlerrm like '%accepted child 2%' then raise; end if; end;
  perform public.approve_retailer_catalogue_child_plan((ids->>0)::uuid,(ctx->>'parent_approval_id')::uuid,ctx->>'parent_fp',encode(pg_catalog.sha256(convert_to('child1','UTF8')),'hex'),now()+interval '20 minutes');
  rows:=jsonb_build_array(public.staging_test_wrap('50844992602450',public.atomic_test_safe_plan('tbjp-heart-care-150-capsules','50844992602450','capsule'))); q:=public.staging_test_request((ids->>0)::uuid,rows); r:=public.execute_staging_retailer_catalogue_child(q); if r->>'child_status'<>'APPLIED' or r->'exact_deltas' is distinct from '{"retailers":0,"products":1,"product_variants":1,"retailer_products":1,"offers":1,"price_history":1}'::jsonb then raise exception 'Heart Care failed: %',r; end if; insert into staging_test_context values('request1',q);
  perform public.approve_retailer_catalogue_child_plan((ids->>1)::uuid,(ctx->>'parent_approval_id')::uuid,ctx->>'parent_fp',encode(pg_catalog.sha256(convert_to('child2','UTF8')),'hex'),now()+interval '20 minutes');
  rows:=jsonb_build_array(public.staging_test_wrap('53951719768402',public.atomic_test_safe_plan('conteh-sports-creatine-monohydrate-1kg','53951719768402','powder'))); q:=public.staging_test_request((ids->>1)::uuid,rows); r:=public.execute_staging_retailer_catalogue_child(q); if r->>'child_status'<>'APPLIED' then raise exception 'Conteh failed: %',r; end if; insert into staging_test_context values('request2',q);
  perform public.approve_retailer_catalogue_child_plan((ids->>2)::uuid,(ctx->>'parent_approval_id')::uuid,ctx->>'parent_fp',encode(pg_catalog.sha256(convert_to('child3','UTF8')),'hex'),now()+interval '20 minutes');
  rows:=jsonb_build_array(public.staging_test_wrap('51935656018258',public.atomic_test_existing_plan('project-ad-shredabull-untamed-2','51935656018258',91,39))); q:=public.staging_test_request((ids->>2)::uuid,rows); r:=public.execute_staging_retailer_catalogue_child(q); if r->>'child_status'<>'APPLIED' or (r#>>'{row_results,0,product_id}')::bigint<>91 then raise exception 'Project AD failed: %',r; end if; insert into staging_test_context values('request3',q);
  perform public.approve_retailer_catalogue_child_plan((ids->>3)::uuid,(ctx->>'parent_approval_id')::uuid,ctx->>'parent_fp',encode(pg_catalog.sha256(convert_to('child4','UTF8')),'hex'),now()+interval '20 minutes');
  rows:='[]'; for i in 1..7 loop rows:=rows||jsonb_build_array(public.staging_test_wrap(source_ids[i],public.atomic_test_current_plan('staging-noop-seed-'||i))); end loop; q:=public.staging_test_request((ids->>3)::uuid,rows); r:=public.execute_staging_retailer_catalogue_child(q); if r->>'child_status'<>'APPLIED' or r->'exact_deltas' is distinct from '{"retailers":0,"products":0,"product_variants":0,"retailer_products":0,"offers":0,"price_history":0}'::jsonb then raise exception 'noop child failed: %',r; end if; insert into staging_test_context values('request4',q);
  r:=public.execute_staging_retailer_catalogue_child(q); if r->>'code'<>'RSBI_REPLAY_BLOCKED' then raise exception 'replay not blocked: %',r; end if;
end $$;

create or replace function public.staging_test_single(p_case text,p_rows jsonb,p_expected jsonb,p_expired boolean default false)
returns jsonb language plpgsql as $$
declare p_id uuid:=gen_random_uuid(); c_id uuid:=gen_random_uuid(); p_fp text:=encode(pg_catalog.sha256(convert_to('p:'||p_case,'UTF8')),'hex'); c_fp text:=encode(pg_catalog.sha256(convert_to('c:'||p_case,'UTF8')),'hex'); s_fp text:=encode(pg_catalog.sha256(convert_to('s:'||p_case,'UTF8')),'hex'); f_id uuid:=gen_random_uuid(); approved timestamptz:=case when p_expired then now()-interval '2 hours' else now() end; expires timestamptz:=case when p_expired then now()-interval '1 hour' else now()+interval '30 minutes' end;
begin
  insert into public.retailer_catalogue_parent_plans(id,parent_plan_fingerprint,retailer_id,target_environment,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,status,expected_deltas,plan_json,child_manifest,rollback_manifest,source_captured_at,canonical_snapshot_at,approval_id,approved_by,approved_at,approval_expires_at,created_by)
  values(p_id,p_fp,1,'STAGING',s_fp,repeat('3',64),repeat('4',64),repeat('5',64),'6f7eefb29f775e773bd0764664a0ba138993fa06',repeat('6',64),'APPROVED',p_expected,jsonb_build_object('fixture_fingerprint','2c62a82c169ee20fab8a86c125423aa50b2d9613283907c408726d4ed89981f5'),'[]',jsonb_build_object('rollback_fingerprint',repeat('7',64)),now(),now(),gen_random_uuid(),'test',approved,expires,'test');
  insert into public.retailer_catalogue_child_plans(id,parent_plan_id,retailer_id,target_environment,child_plan_fingerprint,parent_plan_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,batch_index,batch_count,dependency_group,rollback_group,record_ids,status,expected_deltas,plan_json,rollback_manifest,approval_id,approved_at,approval_expires_at)
  values(c_id,p_id,1,'STAGING',c_fp,p_fp,s_fp,repeat('3',64),repeat('4',64),repeat('5',64),'6f7eefb29f775e773bd0764664a0ba138993fa06',repeat('6',64),0,1,'test:'||p_case,'test-recovery',(select jsonb_agg(ordinality::text) from jsonb_array_elements(p_rows) with ordinality),'APPROVED',p_expected,'{}',jsonb_build_array(jsonb_build_object('ownership',jsonb_build_object('plan_owned_only',true))),gen_random_uuid(),approved,expires);
  insert into public.retailer_catalogue_staging_fixture_approvals(id,fixture_id,fixture_fingerprint,project_ref,database_identity,migration_ledger_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,canonical_decisions,approved_by,approved_at,expires_at,consumed_at,parent_plan_id)
  values(f_id,'jons-staging-canary-real-10-v1-20260717','2c62a82c169ee20fab8a86c125423aa50b2d9613283907c408726d4ed89981f5','hxnrsyyqffztlvcrtgbf','supplementscout-staging:hxnrsyyqffztlvcrtgbf','d441888ff840b0e054d6345268a9169b9ce1639ee920b34879116d554daf1312',s_fp,repeat('3',64),repeat('4',64),repeat('5',64),'6f7eefb29f775e773bd0764664a0ba138993fa06','{}','test',approved,expires,approved,p_id);
  return public.staging_test_request(c_id,p_rows);
end $$;

create or replace function public.staging_test_reseal(p_request jsonb)
returns jsonb language sql as $$ select jsonb_set(p_request,'{request_fingerprint}',to_jsonb(encode(pg_catalog.sha256(convert_to(public.atomic_import_canonical_json(jsonb_set(p_request,'{request_fingerprint}','null'::jsonb,false)),'UTF8')),'hex'))) $$;

-- Mid-row/mid-child failure after one successful row apply rolls back rows and approvals.
do $$ declare p1 jsonb:=public.atomic_test_safe_plan('staging-mid-row-a','staging-mid-row-duplicate'); p2 jsonb:=public.atomic_test_safe_plan('staging-mid-row-b','staging-mid-row-duplicate'); rows jsonb; q jsonb; r jsonb; n bigint; begin
  rows:=jsonb_build_array(public.staging_test_wrap('50844992602450',p1),public.staging_test_wrap('53951719768402',p2)); q:=public.staging_test_single('mid-row',rows,'{"retailers":0,"products":2,"product_variants":2,"retailer_products":2,"offers":2,"price_history":2}'); select count(*) into n from approved_import_plans; r:=public.execute_staging_retailer_catalogue_child(q);
  if r->>'child_status'<>'FAILED' or r#>>'{rollback_metadata,status}'<>'TRANSACTION_ROLLED_BACK' or exists(select 1 from products where slug like 'staging-mid-row-%') or (select count(*) from approved_import_plans)<>n then raise exception 'mid-row rollback failed: %',r; end if;
end $$;

-- Exact-delta mismatch rolls back a fully applied row and its deterministic approval.
do $$ declare rows jsonb:=jsonb_build_array(public.staging_test_wrap('50844992602450',public.atomic_test_safe_plan('staging-delta-mismatch','staging-delta-mismatch'))); q jsonb; r jsonb; begin
  q:=public.staging_test_single('delta-mismatch',rows,'{"retailers":0,"products":2,"product_variants":1,"retailer_products":1,"offers":1,"price_history":1}'); r:=public.execute_staging_retailer_catalogue_child(q);
  if r->>'error_code'<>'RSBI_EXPECTED_STATE_MISMATCH' or exists(select 1 from products where slug='staging-delta-mismatch') then raise exception 'delta mismatch rollback failed: %',r; end if;
end $$;

-- Expired child/fixture approval and stale approval ID are isolated.
do $$ declare rows jsonb:=jsonb_build_array(public.staging_test_wrap('50844992602450',public.atomic_test_safe_plan('staging-expired','staging-expired'))); q jsonb; begin
  q:=public.staging_test_single('expired',rows,'{"retailers":0,"products":1,"product_variants":1,"retailer_products":1,"offers":1,"price_history":1}',true);
  begin perform public.execute_staging_retailer_catalogue_child(q); raise exception 'expired approval accepted'; exception when others then if sqlerrm like '%expired approval accepted%' then raise; end if; end;
  q:=jsonb_set(q,'{fixture_approval_id}',to_jsonb(gen_random_uuid())); q:=public.staging_test_reseal(q);
  begin perform public.execute_staging_retailer_catalogue_child(q); raise exception 'stale approval ID accepted'; exception when others then if sqlerrm like '%stale approval ID accepted%' then raise; end if; end;
end $$;

-- Canonical guards reject wrong Project AD candidate and family/non-default proposal.
do $$ declare q jsonb; row jsonb; plan jsonb; begin
  q:=(select value from staging_test_context where key='request3'); plan:=public.atomic_test_existing_plan('wrong-project-ad','wrong-project-ad',2010,2010); row:=public.staging_test_wrap('51935656018258',plan); q:=jsonb_set(q,'{row_plans}',jsonb_build_array(row)); q:=public.staging_test_reseal(q);
  begin perform public.execute_staging_retailer_catalogue_child(q); raise exception 'wrong Project AD candidate accepted'; exception when others then if sqlerrm like '%candidate accepted%' then raise; end if; end;
  q:=(select value from staging_test_context where key='request1'); plan:=public.atomic_test_safe_plan('family-proposal','family-proposal'); plan:=jsonb_set(plan,'{product_variant,evidence,flavour}','"chocolate"'); plan:=public.atomic_test_finalize_plan(plan); row:=public.staging_test_wrap('50844992602450',plan); q:=jsonb_set(q,'{row_plans}',jsonb_build_array(row)); q:=public.staging_test_reseal(q);
  begin perform public.execute_staging_retailer_catalogue_child(q); raise exception 'family proposal accepted'; exception when others then if sqlerrm like '%family proposal accepted%' then raise; end if; end;
end $$;

-- An already STARTED apply run blocks concurrent execution of the same child.
do $$ declare rows jsonb:=jsonb_build_array(public.staging_test_wrap('50844992602450',public.atomic_test_safe_plan('staging-concurrent','staging-concurrent'))); q jsonb; c retailer_catalogue_child_plans%rowtype; p retailer_catalogue_parent_plans%rowtype; begin
  q:=public.staging_test_single('concurrent',rows,'{"retailers":0,"products":1,"product_variants":1,"retailer_products":1,"offers":1,"price_history":1}'); select * into c from retailer_catalogue_child_plans where id=(q->>'child_plan_id')::uuid; select * into p from retailer_catalogue_parent_plans where id=c.parent_plan_id;
  insert into retailer_catalogue_apply_runs(parent_plan_id,child_plan_id,retailer_id,target_environment,run_type,attempt_ordinal,status,parent_plan_fingerprint,child_plan_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,approval_id,approval_expires_at,expected_deltas,started_by) values(p.id,c.id,1,'STAGING','APPLY',1,'STARTED',p.parent_plan_fingerprint,c.child_plan_fingerprint,c.source_snapshot_fingerprint,c.canonical_snapshot_fingerprint,c.adapter_fingerprint,c.policy_fingerprint,c.code_commit,c.expected_state_fingerprint,c.approval_id,c.approval_expires_at,c.expected_deltas,'concurrency-test'); update retailer_catalogue_child_plans set status='APPLYING' where id=c.id;
  begin perform public.execute_staging_retailer_catalogue_child(q); raise exception 'concurrent child accepted'; exception when others then if sqlerrm like '%concurrent child accepted%' then raise; end if; end;
end $$;

do $$ declare rows jsonb:=jsonb_build_array(public.staging_test_wrap('50844992602450',public.atomic_test_safe_plan('staging-real-concurrent','staging-real-concurrent'))); q jsonb; begin
  q:=public.staging_test_single('real-concurrent',rows,'{"retailers":0,"products":1,"product_variants":1,"retailer_products":1,"offers":1,"price_history":1}');
  insert into staging_test_context values('actual_concurrent',q);
end $$;

do $$ declare ctx jsonb:=(select value from staging_test_context where key='main'); b jsonb:=ctx->'before_counts'; a jsonb; d jsonb; begin
  select jsonb_build_object('retailers',(select count(*) from retailers),'products',(select count(*) from products),'product_variants',(select count(*) from product_variants),'retailer_products',(select count(*) from retailer_products),'offers',(select count(*) from offers),'price_history',(select count(*) from price_history)) into a;
  select jsonb_object_agg(k,(a->>k)::bigint-(b->>k)::bigint) into d from unnest(array['retailers','products','product_variants','retailer_products','offers','price_history']) k;
  if d is distinct from '{"retailers":0,"products":2,"product_variants":2,"retailer_products":3,"offers":3,"price_history":3}'::jsonb then raise exception 'fixture total mismatch: %',d; end if;
end $$;

-- Guard matrix: each mutation must fail before writes.
do $$ declare q jsonb:=(select value from staging_test_context where key='request1'); bad jsonb; label text; begin
  foreach label in array array['production_ref','production_identity','wrong_database','wrong_migration','wrong_fixture','wrong_code','source_drift','canonical_drift','missing_marker'] loop
    bad:=q;
    bad:=case label when 'production_ref' then jsonb_set(bad,'{staging_project_ref}','"aftboxmrdgyhizicfsfu"') when 'production_identity' then jsonb_set(bad,'{staging_database_identity}','"production"') when 'wrong_database' then jsonb_set(bad,'{staging_database_identity}','"wrong"') when 'wrong_migration' then jsonb_set(bad,'{migration_ledger_fingerprint}',to_jsonb(repeat('0',64))) when 'wrong_fixture' then jsonb_set(bad,'{fixture_fingerprint}',to_jsonb(repeat('0',64))) when 'wrong_code' then jsonb_set(bad,'{code_commit}',to_jsonb(repeat('0',40))) when 'source_drift' then jsonb_set(bad,'{source_snapshot_fingerprint}',to_jsonb(repeat('0',64))) when 'canonical_drift' then jsonb_set(bad,'{canonical_snapshot_fingerprint}',to_jsonb(repeat('0',64))) else bad end;
    begin if label='missing_marker' then perform set_config('app.retailer_catalogue_staging_marker','0',true); end if; perform public.execute_staging_retailer_catalogue_child(bad); raise exception 'guard accepted %',label; exception when others then if sqlerrm like '%guard accepted%' then raise; end if; end;
  end loop;
end $$;

-- Recover every committed child in reverse order; shared Project AD must survive.
do $$ declare i integer; q jsonb; r jsonb; begin
  perform set_config('app.retailer_catalogue_staging_marker','1',false); perform set_config('app.retailer_catalogue_invocation_role','retailer_catalogue_staging_executor',false);
  for i in reverse 4..1 loop q:=(select value from staging_test_context where key='request'||i); r:=public.recover_staging_retailer_catalogue_child(q); if r->>'recovery_status'<>'RECOVERED' then raise exception 'recovery % failed: %',i,r; end if; end loop;
  if not exists(select 1 from products where id=91) or not exists(select 1 from product_variants where id=39) then raise exception 'shared Project AD canonical was affected'; end if;
  if exists(select 1 from retailer_products where external_variant_id in ('50844992602450','53951719768402','51935656018258')) then raise exception 'recovery left fixture mappings'; end if;
  if (select count(*) from retailer_catalogue_staging_recovery_audit)<>4 then raise exception 'recovery audit incomplete'; end if;
end $$;

select jsonb_build_object('result','PASS','sql_scenarios',35,'heart_atomic',true,'conteh_atomic',true,'project_ad_shared',true,'noop_rows',7,'exact_total',true,'mid_row_rollback',true,'delta_mismatch_rollback',true,'replay',true,'concurrency_blocked',true,'dependency_ordering',true,'expired_and_stale_approval_isolation',true,'canonical_guards',true,'committed_recoveries',4,'phase3_dependency',false,'remote_connections',0);
