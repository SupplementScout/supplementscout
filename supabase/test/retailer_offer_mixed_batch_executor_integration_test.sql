\set ON_ERROR_STOP on

begin;

do $security$
begin
  if has_function_privilege('anon','public.execute_retailer_offer_sync_batch(jsonb)','EXECUTE') or has_function_privilege('authenticated','public.execute_retailer_offer_sync_batch(jsonb)','EXECUTE') or has_function_privilege('service_role','public.execute_retailer_offer_sync_batch(jsonb)','EXECUTE') or not has_function_privilege('retailer_catalogue_staging_executor','public.execute_retailer_offer_sync_batch(jsonb)','EXECUTE') or has_table_privilege('retailer_catalogue_staging_executor','public.offers','UPDATE') or has_table_privilege('retailer_catalogue_staging_approver','public.retailer_offer_sync_batch_approvals','INSERT') then raise exception 'mixed executor role boundary failed'; end if;
end
$security$;

-- The atomic importer itself is already exercised by atomic_product_import_rpc_integration_test.sql.
-- These disposable-only stubs isolate and prove the mixed transaction/approval/replay/recovery composition.
create or replace function public.validate_product_import_plan_read_only(p_plan jsonb) returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$ select jsonb_build_object('valid',true,'offer_id',p_plan#>>'{offer,id}') $$;
create or replace function public.approve_product_import_plan(p_plan jsonb,p_artifact_sha256 text,p_run_id text,p_source text default 'supplementscout_importer',p_expires_at timestamptz default now()+interval '15 minutes') returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public as $$
declare v_id uuid; begin
  insert into public.approved_import_plans(artifact_sha256,run_id,plan_fingerprint,source_row_fingerprint,plan_kind,retailer_id,expires_at,source,plan_json)
  values(p_artifact_sha256,p_run_id,p_plan#>>'{meta,plan_fingerprint}',p_plan#>>'{meta,source_row_fingerprint}',p_plan#>>'{meta,plan_kind}',(p_plan#>>'{retailer,id}')::bigint,p_expires_at,p_source,p_plan) returning id into v_id;
  return jsonb_build_object('approval_id',v_id,'run_id',p_run_id);
end $$;
create or replace function public.apply_approved_product_import_plan(p_approval_id uuid,p_artifact_sha256 text,p_plan_fingerprint text,p_source_row_fingerprint text,p_retailer_id bigint,p_plan_kind text,p_run_id text) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public as $$
declare v public.approved_import_plans%rowtype; v_history bigint; begin
  select * into v from public.approved_import_plans where id=p_approval_id for update;
  if v.status<>'approved' or v.consumed_at is not null or v.artifact_sha256<>p_artifact_sha256 or v.plan_fingerprint<>p_plan_fingerprint or v.source_row_fingerprint<>p_source_row_fingerprint or v.retailer_id<>p_retailer_id or v.plan_kind<>p_plan_kind or v.run_id<>p_run_id then raise exception 'test approval mismatch'; end if;
  update public.retailer_products set external_url=v.plan_json#>>'{retailer_product,values,external_url}',updated_at=case when external_url is distinct from v.plan_json#>>'{retailer_product,values,external_url}' then now() else updated_at end where id=(v.plan_json#>>'{retailer_product,id}')::bigint;
  update public.offers set price=(v.plan_json#>>'{offer,values,price}')::numeric,shipping_cost=nullif(v.plan_json#>>'{offer,values,shipping_cost}','')::numeric,total_price=nullif(v.plan_json#>>'{offer,values,total_price}','')::numeric,in_stock=(v.plan_json#>>'{offer,values,in_stock}')::boolean,url=v.plan_json#>>'{offer,values,url}',last_checked_at=(v.plan_json#>>'{offer,values,last_checked_at}')::timestamptz where id=(v.plan_json#>>'{offer,id}')::bigint;
  if v.plan_json#>>'{price_history,action}'='create' then insert into public.price_history(offer_id,price,shipping_cost,total_price,checked_at) values((v.plan_json#>>'{offer,id}')::bigint,(v.plan_json#>>'{offer,values,price}')::numeric,nullif(v.plan_json#>>'{offer,values,shipping_cost}','')::numeric,nullif(v.plan_json#>>'{offer,values,total_price}','')::numeric,(v.plan_json#>>'{offer,values,last_checked_at}')::timestamptz) returning id into v_history; end if;
  update public.approved_import_plans set status='consumed',consumed_at=now() where id=v.id;
  return jsonb_build_object('offer_id',v.plan_json#>>'{offer,id}','approval_id',v.id,'approval_status','consumed','price_history_id',v_history);
end $$;

do $boundary$
declare v_capture text:=to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); v_old text:=to_char((now()-interval '1 hour') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); v_rows jsonb; v_manifest jsonb; v_migrations jsonb:=(select jsonb_agg(value->>'identifier' order by (value->>'ordinal')::int) from jsonb_array_elements(public.retailer_catalogue_actual_migration_ledger()->'migrations')); v_migration_fp text:=public.retailer_catalogue_actual_migration_ledger_fingerprint(); v_expected jsonb:=jsonb_build_object('row_count_deltas',jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0),'logical_field_deltas',jsonb_build_object('offer_price_updates',0,'offer_shipping_updates',0,'offer_total_updates',0,'offer_stock_updates',0,'offer_url_updates',0,'mapping_url_updates',0,'mapping_updated_at_updates',0,'last_checked_at_updates',50)); v_row_delta jsonb:=jsonb_build_object('row_count_deltas',jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0),'logical_field_deltas',jsonb_build_object('offer_price_updates',0,'offer_shipping_updates',0,'offer_total_updates',0,'offer_stock_updates',0,'offer_url_updates',0,'mapping_url_updates',0,'mapping_updated_at_updates',0,'last_checked_at_updates',1)); v_blocked boolean:=false;
begin
  select jsonb_agg(jsonb_build_object('offer_id',(10000+n)::text,'retailer_product_id',(10000+n)::text,'external_product_id','p','external_variant_id',(10000+n)::text,'action','VERIFY_NO_CHANGE','changed_fields',jsonb_build_object('price',false,'stock',false,'url',false,'blocked',false),'source_captured_at',v_capture,'expected_deltas',v_row_delta,'atomic_plan',jsonb_build_object('meta',jsonb_build_object('operation_type','verify_offer_no_change'),'offer',jsonb_build_object('id',(10000+n)::text,'values',jsonb_build_object('price','1','shipping_cost','0','total_price','1','in_stock',true,'url','https://mixed.test/p','last_checked_at',v_capture)),'retailer_product',jsonb_build_object('id',(10000+n)::text),'expected_state',jsonb_build_object('offer',jsonb_build_object('shipping_cost','0','total_price','1','last_checked_at',v_old)))) order by n) into v_rows from generate_series(1,50)n;
  v_manifest:=jsonb_build_object('schema_version',1,'kind','retailer-existing-offer-mixed-batch-execution','retailer_slug','mixed-test','retailer_id','9001','target_environment','STAGING','target_project_ref','hxnrsyyqffztlvcrtgbf','target_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf','expected_migration_versions',v_migrations,'expected_migration_fingerprint',v_migration_fp,'migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1','source_snapshot_fingerprint',repeat('b',64),'adapter_fingerprint',repeat('d',64),'policy_fingerprint',repeat('e',64),'code_commit',repeat('f',40),'expected_state_fingerprint',repeat('1',64),'source_captured_at',v_capture,'state','DRY_RUN_READY','block','null'::jsonb,'action_manifest_fingerprint',repeat('2',64),'rows',v_rows,'expected_deltas',v_expected); v_manifest:=v_manifest||jsonb_build_object('artifact_fingerprint',public.retailer_catalogue_sha256_json(v_manifest));
  if (public.retailer_offer_sync_validate_manifest(v_manifest)->>'row_count')::int<>50 then raise exception '50-row boundary did not validate'; end if;
  begin
    perform public.retailer_offer_sync_validate_manifest(jsonb_build_object('schema_version',1,'artifact_fingerprint',repeat('0',64),'kind','retailer-existing-offer-mixed-batch-execution','retailer_slug','mixed-test','retailer_id','9001','target_environment','STAGING','target_project_ref','hxnrsyyqffztlvcrtgbf','target_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf','expected_migration_versions',v_migrations,'expected_migration_fingerprint',v_migration_fp,'migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1','source_snapshot_fingerprint',repeat('b',64),'adapter_fingerprint',repeat('d',64),'policy_fingerprint',repeat('e',64),'code_commit',repeat('f',40),'expected_state_fingerprint',repeat('1',64),'source_captured_at',v_capture,'state','DRY_RUN_READY','block','null'::jsonb,'action_manifest_fingerprint',repeat('2',64),'rows',v_rows||jsonb_build_array(v_rows->0),'expected_deltas',v_expected));
  exception when others then v_blocked:=sqlerrm like '%Mixed child size must be 1..50%'; end;
  if not v_blocked then raise exception '51-row boundary was not rejected'; end if;
end
$boundary$;

insert into public.retailers(id,name,slug,website) values(9001,'Mixed Test','mixed-test','https://mixed.test');
insert into public.products(id,name,slug,brand,category,is_active,product_format) values(9001,'Mixed Product','mixed-product','Test','Creatine',true,'powder');
insert into public.product_variants(id,product_id,variant_key,display_name,is_active,is_default)
select 9000+n,9001,'v-'||n,'Variant '||n,true,n=1 from generate_series(1,26) n;
insert into public.retailer_products(id,retailer_id,product_id,product_variant_id,external_name,external_slug,external_url,external_product_id,external_variant_id,match_method,match_confidence)
select 9000+n,9001,9001,9000+n,'Variant '||n,'v-'||n,'https://mixed.test/products/v?variant='||(9000+n),'p-1',(9000+n)::text,'external_id',100 from generate_series(1,26) n;
insert into public.offers(id,product_id,product_variant_id,retailer_id,retailer_product_id,price,shipping_cost,total_price,in_stock,url,last_checked_at)
select 9000+n,9001,9000+n,9001,9000+n,10,3.99,13.99,true,'https://mixed.test/products/v?variant='||(9000+n),'2026-07-18T10:00:00.000Z' from generate_series(1,26) n;

create temp table mixed_test_context(key text primary key,value jsonb) on commit preserve rows;
do $seed$
declare v_rows jsonb; v_manifest jsonb; v_fp text; v_migrations jsonb:=(select jsonb_agg(value->>'identifier' order by (value->>'ordinal')::int) from jsonb_array_elements(public.retailer_catalogue_actual_migration_ledger()->'migrations')); v_migration_fp text:=public.retailer_catalogue_actual_migration_ledger_fingerprint(); v_parent uuid:=gen_random_uuid(); v_child uuid:=gen_random_uuid(); v_parent_fp text:=repeat('a',64); v_capture text:=to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); v_expected jsonb:=jsonb_build_object('row_count_deltas',jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',3),'logical_field_deltas',jsonb_build_object('offer_price_updates',3,'offer_shipping_updates',0,'offer_total_updates',3,'offer_stock_updates',2,'offer_url_updates',2,'mapping_url_updates',2,'mapping_updated_at_updates',2,'last_checked_at_updates',26));
begin
  select jsonb_agg(jsonb_build_object(
    'offer_id',(9000+n)::text,'retailer_product_id',(9000+n)::text,'external_product_id','p-1','external_variant_id',(9000+n)::text,
    'action',case n when 1 then 'UPDATE_PRICE' when 2 then 'UPDATE_STOCK' when 3 then 'UPDATE_PRICE_AND_STOCK' when 4 then 'UPDATE_URL' when 5 then 'UPDATE_PRICE_STOCK_URL' else 'VERIFY_NO_CHANGE' end,
    'changed_fields',jsonb_build_object('price',n in (1,3,5),'stock',n in (2,3),'url',n in (4,5),'blocked',false),
    'source_captured_at',v_capture,'expected_deltas',jsonb_build_object('row_count_deltas',jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',case when n in (1,3,5) then 1 else 0 end),'logical_field_deltas',jsonb_build_object('offer_price_updates',(n in (1,3,5))::int,'offer_shipping_updates',0,'offer_total_updates',(n in (1,3,5))::int,'offer_stock_updates',(n in (2,3))::int,'offer_url_updates',(n in (4,5))::int,'mapping_url_updates',(n in (4,5))::int,'mapping_updated_at_updates',(n in (4,5))::int,'last_checked_at_updates',1)),
    'atomic_plan',jsonb_build_object('meta',jsonb_build_object('operation_type',case when n>5 then 'verify_offer_no_change' else 'standard_update' end,'plan_kind','feed','plan_fingerprint',lpad(to_hex(n),32,'0'),'source_row_fingerprint',lpad(to_hex(n),64,'0')),'retailer',jsonb_build_object('id','9001'),'retailer_product',jsonb_build_object('id',(9000+n)::text,'values',jsonb_build_object('external_url',case when n in (4,5) then 'https://mixed.test/products/new?variant='||(9000+n) else 'https://mixed.test/products/v?variant='||(9000+n) end)),'offer',jsonb_build_object('id',(9000+n)::text,'values',jsonb_build_object('price',case when n in (1,3,5) then '11' else '10' end,'shipping_cost','3.99','total_price',case when n in (1,3,5) then '14.99' else '13.99' end,'in_stock',not (n in (2,3)),'url',case when n in (4,5) then 'https://mixed.test/products/new?variant='||(9000+n) else 'https://mixed.test/products/v?variant='||(9000+n) end,'last_checked_at',v_capture)),'price_history',jsonb_build_object('action',case when n in (1,3,5) then 'create' else 'noop' end),'expected_state',jsonb_build_object('offer',jsonb_build_object('price','10','shipping_cost','3.99','total_price','13.99','in_stock',true,'url','https://mixed.test/products/v?variant='||(9000+n),'last_checked_at','2026-07-18T10:00:00.000Z')))
  ) order by n) into v_rows from generate_series(1,26) n;
  v_manifest:=jsonb_build_object('schema_version',1,'kind','retailer-existing-offer-mixed-batch-execution','retailer_slug','mixed-test','retailer_id','9001','target_environment','STAGING','target_project_ref','hxnrsyyqffztlvcrtgbf','target_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf','expected_migration_versions',v_migrations,'expected_migration_fingerprint',v_migration_fp,'migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1','source_snapshot_fingerprint',repeat('b',64),'adapter_fingerprint',repeat('d',64),'policy_fingerprint',repeat('e',64),'code_commit',repeat('f',40),'expected_state_fingerprint',repeat('1',64),'source_captured_at',v_capture,'state','DRY_RUN_READY','block','null'::jsonb,'action_manifest_fingerprint',repeat('2',64),'rows',v_rows,'expected_deltas',v_expected);
  v_fp:=public.retailer_catalogue_sha256_json(v_manifest); v_manifest:=v_manifest||jsonb_build_object('artifact_fingerprint',v_fp);
  insert into public.retailer_catalogue_parent_plans(id,parent_plan_fingerprint,retailer_id,target_environment,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,status,expected_deltas,plan_json,child_manifest,rollback_manifest,source_captured_at,canonical_snapshot_at,approval_id,approved_by,approved_at,approval_expires_at,created_by)
  values(v_parent,v_parent_fp,9001,'STAGING',repeat('b',64),repeat('c',64),repeat('d',64),repeat('e',64),repeat('f',40),repeat('1',64),'PLANNED',v_expected,'{}','[]',jsonb_build_object('rollback_fingerprint',repeat('9',64)),now(),now(),null,null,null,null,'test');
  insert into public.retailer_catalogue_child_plans(id,parent_plan_id,retailer_id,target_environment,child_plan_fingerprint,parent_plan_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,batch_index,batch_count,dependency_group,rollback_group,record_ids,status,expected_deltas,plan_json,rollback_manifest,approval_id,approved_at,approval_expires_at)
  values(v_child,v_parent,9001,'STAGING',v_fp,v_parent_fp,repeat('b',64),repeat('c',64),repeat('d',64),repeat('e',64),repeat('f',40),repeat('1',64),0,1,'mixed-26','mixed-26',(select jsonb_agg((9000+n)::text) from generate_series(1,26)n),'PLANNED',v_expected,v_manifest,'[]',null,null,null);
  insert into mixed_test_context values('manifest',v_manifest),('ids',jsonb_build_object('parent_id',v_parent,'child_id',v_child,'parent_fp',v_parent_fp,'child_fp',v_fp,'execution_fp',public.retailer_catalogue_sha256_json(jsonb_build_object('child_plan_id',v_child,'artifact_fingerprint',v_fp,'target_environment','STAGING','project_ref','hxnrsyyqffztlvcrtgbf','database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf','expected_migration_versions',v_migrations,'expected_migration_fingerprint',v_migration_fp,'migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1')),'capture',v_capture,'expected_migration_versions',v_migrations,'expected_migration_fingerprint',v_migration_fp,'migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1'));
end
$seed$;
commit;

grant select on mixed_test_context to retailer_catalogue_staging_approver,retailer_catalogue_staging_executor;
select set_config('app.retailer_catalogue_staging_marker','1',false),set_config('app.retailer_catalogue_allow','1',false),set_config('app.safe_update','false',false);

create temp table mixed_ledger_negative_results(case_id integer primary key,case_name text,error_code text,business_deltas jsonb,row_approvals integer,batch_consumed boolean,child_status text,recovery_status text) on commit preserve rows;
do $approval_ledger_negatives$
declare v_case integer; v_name text; v_expected_error text; v_request jsonb; v_error text; v_counts jsonb:=public.retailer_catalogue_business_counts(); v_row_approvals integer:=(select count(*) from public.approved_import_plans); v_batch_approvals integer:=(select count(*) from public.retailer_offer_sync_batch_approvals); v_manifest jsonb:=(select value from mixed_test_context where key='manifest'); v_ids jsonb:=(select value from mixed_test_context where key='ids');
begin
  for v_case in 1..8 loop
    v_request:=jsonb_build_object('schema_version',1,'child_plan_id',v_ids->>'child_id','parent_plan_fingerprint',v_ids->>'parent_fp','child_plan_fingerprint',v_ids->>'child_fp','artifact',v_manifest,'execution_fingerprint',v_ids->>'execution_fp','expected_migration_versions',v_ids->'expected_migration_versions','expected_migration_fingerprint',v_ids->>'expected_migration_fingerprint','migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1','approved_by','negative-test','expires_at',now()+interval '10 minutes','staging_project_ref','hxnrsyyqffztlvcrtgbf','staging_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf');
    case v_case
      when 1 then v_name:='missing expected versions'; v_expected_error:='RSBI_SOURCE_SCHEMA_MISMATCH'; v_request:=v_request-'expected_migration_versions';
      when 2 then v_name:='missing expected fingerprint'; v_expected_error:='RSBI_SOURCE_SCHEMA_MISMATCH'; v_request:=v_request-'expected_migration_fingerprint';
      when 3 then v_name:='wrong migration version list'; v_expected_error:='RSBI_SOURCE_HASH_MISMATCH'; v_request:=jsonb_set(v_request,'{expected_migration_versions}',(v_ids->'expected_migration_versions')||'"20990101000000_wrong"'::jsonb);
      when 4 then v_name:='missing applied migration'; v_expected_error:='RSBI_SOURCE_HASH_MISMATCH'; v_request:=jsonb_set(v_request,'{expected_migration_versions}',(v_ids->'expected_migration_versions')-((jsonb_array_length(v_ids->'expected_migration_versions'))-1));
      when 5 then v_name:='unexpected migration'; v_expected_error:='RSBI_SOURCE_HASH_MISMATCH';
      when 6 then v_name:='wrong migration fingerprint'; v_expected_error:='RSBI_SOURCE_HASH_MISMATCH'; v_request:=jsonb_set(v_request,'{expected_migration_fingerprint}',to_jsonb(repeat('0',64)));
      when 7 then v_name:='code commit correct ledger wrong'; v_expected_error:='RSBI_SOURCE_HASH_MISMATCH'; v_request:=jsonb_set(v_request,'{expected_migration_fingerprint}',to_jsonb(repeat('1',64)));
      when 8 then v_name:='target correct ledger wrong'; v_expected_error:='RSBI_SOURCE_HASH_MISMATCH'; v_request:=jsonb_set(v_request,'{expected_migration_fingerprint}',to_jsonb(repeat('2',64)));
    end case;
    v_error:=null;
    begin
      if v_case=5 then insert into supabase_migrations.schema_migrations(version,name,statements) values('20990101000000','unexpected',array[]::text[]); end if;
      perform public.retailer_offer_sync_approve_batch_internal(v_request);
    exception when others then v_error:=sqlerrm; end;
    if v_error not like '%'||v_expected_error||'%' then raise exception 'negative case % expected %, got %',v_name,v_expected_error,coalesce(v_error,'NO ERROR'); end if;
    if public.retailer_catalogue_business_counts() is distinct from v_counts or (select count(*) from public.approved_import_plans)<>v_row_approvals or (select count(*) from public.retailer_offer_sync_batch_approvals)<>v_batch_approvals or (select status from public.retailer_catalogue_child_plans where id=(v_ids->>'child_id')::uuid)<>'PLANNED' then raise exception 'negative case % changed state',v_name; end if;
    insert into mixed_ledger_negative_results values(v_case,v_name,v_expected_error,jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0),0,false,'PLANNED','NOT_STARTED');
  end loop;
end
$approval_ledger_negatives$;

set role retailer_catalogue_staging_approver;
select public.approve_retailer_offer_sync_batch(jsonb_build_object('schema_version',1,'child_plan_id',(select value->>'child_id' from mixed_test_context where key='ids'),'parent_plan_fingerprint',(select value->>'parent_fp' from mixed_test_context where key='ids'),'child_plan_fingerprint',(select value->>'child_fp' from mixed_test_context where key='ids'),'artifact',(select value from mixed_test_context where key='manifest'),'execution_fingerprint',(select value->>'execution_fp' from mixed_test_context where key='ids'),'expected_migration_versions',(select value->'expected_migration_versions' from mixed_test_context where key='ids'),'expected_migration_fingerprint',(select value->>'expected_migration_fingerprint' from mixed_test_context where key='ids'),'migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1','approved_by','integration-test','expires_at',now()+interval '10 minutes','staging_project_ref','hxnrsyyqffztlvcrtgbf','staging_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf')) as approval \gset
reset role;
insert into mixed_test_context values('approval',:'approval'::jsonb);
do $assert_single_approval$
begin
  if (select count(*) from public.retailer_offer_sync_batch_approvals where child_plan_id=((select value->>'child_id' from mixed_test_context where key='ids'))::uuid)<>1 or (select status from public.retailer_catalogue_parent_plans where id=((select value->>'parent_id' from mixed_test_context where key='ids'))::uuid)<>'APPROVED' or (select status from public.retailer_catalogue_child_plans where id=((select value->>'child_id' from mixed_test_context where key='ids'))::uuid)<>'APPROVED' then raise exception 'single mixed approval did not atomically bind parent and child'; end if;
end
$assert_single_approval$;

do $execution_ledger_drift$
declare v_ids jsonb:=(select value from mixed_test_context where key='ids'); v_approval jsonb:=(select value from mixed_test_context where key='approval'); v_request jsonb; v_error text; v_counts jsonb:=public.retailer_catalogue_business_counts(); v_row_approvals integer:=(select count(*) from public.approved_import_plans);
begin
  v_request:=jsonb_build_object('schema_version',1,'approval_id',v_approval->>'approval_id','execution_fingerprint',v_ids->>'execution_fp','expected_migration_versions',v_ids->'expected_migration_versions','expected_migration_fingerprint',v_ids->>'expected_migration_fingerprint','migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1','staging_project_ref','hxnrsyyqffztlvcrtgbf','staging_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf','requested_at',now(),'explicit_allow',true);
  begin insert into supabase_migrations.schema_migrations(version,name,statements) values('20990101000001','after_approval',array[]::text[]); perform public.retailer_offer_sync_execute_batch_internal(v_request); exception when others then v_error:=sqlerrm; end;
  if v_error not like '%RSBI_SOURCE_HASH_MISMATCH%' or public.retailer_catalogue_business_counts() is distinct from v_counts or (select count(*) from public.approved_import_plans)<>v_row_approvals or (select consumed_at from public.retailer_offer_sync_batch_approvals where id=(v_approval->>'approval_id')::uuid) is not null or (select status from public.retailer_catalogue_child_plans where id=(v_ids->>'child_id')::uuid)<>'APPROVED' then raise exception 'ledger drift after approval did not fail closed: %',coalesce(v_error,'NO ERROR'); end if;
  insert into mixed_ledger_negative_results values(9,'actual ledger changes after approval','RSBI_SOURCE_HASH_MISMATCH',jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0),0,false,'APPROVED','NOT_STARTED');
end
$execution_ledger_drift$;

set role retailer_catalogue_staging_executor;
select public.execute_retailer_offer_sync_batch(jsonb_build_object('schema_version',1,'approval_id',(:'approval'::jsonb->>'approval_id'),'execution_fingerprint',(select value->>'execution_fp' from mixed_test_context where key='ids'),'expected_migration_versions',(select value->'expected_migration_versions' from mixed_test_context where key='ids'),'expected_migration_fingerprint',(select value->>'expected_migration_fingerprint' from mixed_test_context where key='ids'),'migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1','staging_project_ref','hxnrsyyqffztlvcrtgbf','staging_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf','requested_at',now(),'explicit_allow',true)) as apply_result \gset
select public.execute_retailer_offer_sync_batch(jsonb_build_object('schema_version',1,'approval_id',(:'approval'::jsonb->>'approval_id'),'execution_fingerprint',(select value->>'execution_fp' from mixed_test_context where key='ids'),'expected_migration_versions',(select value->'expected_migration_versions' from mixed_test_context where key='ids'),'expected_migration_fingerprint',(select value->>'expected_migration_fingerprint' from mixed_test_context where key='ids'),'migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1','staging_project_ref','hxnrsyyqffztlvcrtgbf','staging_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf','requested_at',now(),'explicit_allow',true)) as replay_result \gset
reset role;
insert into mixed_test_context values('apply',:'apply_result'::jsonb),('replay',:'replay_result'::jsonb);

do $assert_apply$
begin
  if (select value->>'status' from mixed_test_context where key='apply')<>'APPLIED' or (select (value->>'row_approvals_consumed')::int from mixed_test_context where key='apply')<>26 or (select (value->>'price_history_delta')::int from mixed_test_context where key='apply')<>3 then raise exception 'mixed 26 apply failed'; end if;
  if (select value->>'code' from mixed_test_context where key='replay')<>'RSBI_REPLAY_BLOCKED' or (select count(*) from public.offers where id between 9001 and 9026 and last_checked_at=(select (value->>'capture')::timestamptz from mixed_test_context where key='ids'))<>26 then raise exception 'mixed replay/timestamp failed'; end if;
end
$assert_apply$;

do $replay_after_ledger_drift$
declare v_ids jsonb:=(select value from mixed_test_context where key='ids'); v_approval jsonb:=(select value from mixed_test_context where key='approval'); v_request jsonb; v_error text; v_counts jsonb:=public.retailer_catalogue_business_counts(); v_approved integer:=(select count(*) from public.approved_import_plans);
begin
  v_request:=jsonb_build_object('schema_version',1,'approval_id',v_approval->>'approval_id','execution_fingerprint',v_ids->>'execution_fp','expected_migration_versions',v_ids->'expected_migration_versions','expected_migration_fingerprint',v_ids->>'expected_migration_fingerprint','migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1','staging_project_ref','hxnrsyyqffztlvcrtgbf','staging_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf','requested_at',now(),'explicit_allow',true);
  begin insert into supabase_migrations.schema_migrations(version,name,statements) values('20990101000002','before_replay',array[]::text[]); perform public.retailer_offer_sync_execute_batch_internal(v_request); exception when others then v_error:=sqlerrm; end;
  if v_error not like '%RSBI_SOURCE_HASH_MISMATCH%' or public.retailer_catalogue_business_counts() is distinct from v_counts or (select count(*) from public.approved_import_plans)<>v_approved or (select status from public.retailer_catalogue_child_plans where id=(v_ids->>'child_id')::uuid)<>'APPLIED' then raise exception 'replay after ledger drift did not prefer ledger guard: %',coalesce(v_error,'NO ERROR'); end if;
  insert into mixed_ledger_negative_results values(10,'replay after ledger drift','RSBI_SOURCE_HASH_MISMATCH',jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0),v_approved,true,'APPLIED','NOT_STARTED');
end
$replay_after_ledger_drift$;

insert into mixed_test_context
select 'recovery_meta',jsonb_build_object('manifest_id',id,'rollback_fingerprint',rollback_manifest_fingerprint,'expected_migration_versions',mixed_batch_migration_versions,'expected_migration_fingerprint',mixed_batch_expected_migration_fingerprint,'migration_fingerprint_algorithm',mixed_batch_migration_fingerprint_algorithm,'migration_fingerprint_version',mixed_batch_migration_fingerprint_version,'original_execution_migration_fingerprint',mixed_batch_execution_migration_fingerprint)
from public.retailer_catalogue_staging_recovery_manifests where id=((select value from mixed_test_context where key='apply')->>'recovery_manifest_id')::uuid;

do $recovery_approval_ledger_mismatch$
declare v_meta jsonb:=(select value from mixed_test_context where key='recovery_meta'); v_request jsonb; v_error text; v_counts jsonb:=public.retailer_catalogue_business_counts(); v_approvals integer:=(select count(*) from public.approved_import_plans);
begin
  v_request:=jsonb_build_object('schema_version',1,'recovery_manifest_id',v_meta->>'manifest_id','rollback_manifest_fingerprint',v_meta->>'rollback_fingerprint','expected_migration_versions',v_meta->'expected_migration_versions','expected_migration_fingerprint',repeat('3',64),'migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1','original_execution_migration_fingerprint',v_meta->>'original_execution_migration_fingerprint','approved_by','negative-test','expires_at',now()+interval '10 minutes','staging_project_ref','hxnrsyyqffztlvcrtgbf','staging_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf');
  begin perform public.retailer_offer_sync_approve_recovery_internal(v_request); exception when others then v_error:=sqlerrm; end;
  if v_error not like '%RSBI_SOURCE_HASH_MISMATCH%' or public.retailer_catalogue_business_counts() is distinct from v_counts or (select count(*) from public.approved_import_plans)<>v_approvals or exists(select 1 from public.retailer_catalogue_staging_recovery_approvals where recovery_manifest_id=(v_meta->>'manifest_id')::uuid) or (select status from public.retailer_catalogue_staging_recovery_manifests where id=(v_meta->>'manifest_id')::uuid)<>'READY' then raise exception 'recovery approval ledger mismatch did not fail closed: %',coalesce(v_error,'NO ERROR'); end if;
  insert into mixed_ledger_negative_results values(11,'recovery approval ledger mismatch','RSBI_SOURCE_HASH_MISMATCH',jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0),v_approvals,true,'APPLIED','READY');
end
$recovery_approval_ledger_mismatch$;

set role retailer_catalogue_staging_approver;
select public.approve_retailer_offer_sync_recovery(jsonb_build_object('schema_version',1,'recovery_manifest_id',(select value->>'manifest_id' from mixed_test_context where key='recovery_meta'),'rollback_manifest_fingerprint',(select value->>'rollback_fingerprint' from mixed_test_context where key='recovery_meta'),'expected_migration_versions',(select value->'expected_migration_versions' from mixed_test_context where key='recovery_meta'),'expected_migration_fingerprint',(select value->>'expected_migration_fingerprint' from mixed_test_context where key='recovery_meta'),'migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1','original_execution_migration_fingerprint',(select value->>'original_execution_migration_fingerprint' from mixed_test_context where key='recovery_meta'),'approved_by','integration-test','expires_at',now()+interval '10 minutes','staging_project_ref','hxnrsyyqffztlvcrtgbf','staging_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf')) as recovery_approval \gset
reset role;
insert into mixed_test_context values('recovery_approval',:'recovery_approval'::jsonb);
do $recovery_execution_ledger_drift$
declare v_meta jsonb:=(select value from mixed_test_context where key='recovery_meta'); v_approval jsonb:=(select value from mixed_test_context where key='recovery_approval'); v_request jsonb; v_error text; v_counts jsonb:=public.retailer_catalogue_business_counts(); v_approvals integer:=(select count(*) from public.approved_import_plans);
begin
  v_request:=jsonb_build_object('schema_version',1,'recovery_approval_id',v_approval->>'recovery_approval_id','expected_migration_versions',v_meta->'expected_migration_versions','expected_migration_fingerprint',v_meta->>'expected_migration_fingerprint','migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1','original_execution_migration_fingerprint',v_meta->>'original_execution_migration_fingerprint','staging_project_ref','hxnrsyyqffztlvcrtgbf','staging_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf','explicit_allow',true);
  begin insert into supabase_migrations.schema_migrations(version,name,statements) values('20990101000003','before_recovery',array[]::text[]); perform public.retailer_offer_sync_recover_batch_internal(v_request); exception when others then v_error:=sqlerrm; end;
  if v_error not like '%RSBI_SOURCE_HASH_MISMATCH%' or public.retailer_catalogue_business_counts() is distinct from v_counts or (select count(*) from public.approved_import_plans)<>v_approvals or (select consumed_at from public.retailer_catalogue_staging_recovery_approvals where id=(v_approval->>'recovery_approval_id')::uuid) is not null or (select status from public.retailer_catalogue_staging_recovery_manifests where id=(v_meta->>'manifest_id')::uuid)<>'READY' then raise exception 'recovery execution ledger drift did not fail closed: %',coalesce(v_error,'NO ERROR'); end if;
  insert into mixed_ledger_negative_results values(12,'recovery execution ledger changed after approval','RSBI_SOURCE_HASH_MISMATCH',jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0),v_approvals,true,'APPLIED','READY');
end
$recovery_execution_ledger_drift$;
do $recovery_conflicts$
declare v_request jsonb:=jsonb_build_object('schema_version',1,'recovery_approval_id',(select value->>'recovery_approval_id' from mixed_test_context where key='recovery_approval'),'expected_migration_versions',(select value->'expected_migration_versions' from mixed_test_context where key='recovery_meta'),'expected_migration_fingerprint',(select value->>'expected_migration_fingerprint' from mixed_test_context where key='recovery_meta'),'migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1','original_execution_migration_fingerprint',(select value->>'original_execution_migration_fingerprint' from mixed_test_context where key='recovery_meta'),'staging_project_ref','hxnrsyyqffztlvcrtgbf','staging_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf','explicit_allow',true); v_blocked boolean;
begin
  v_blocked:=false; begin update public.offers set price=price+1 where id=9001; perform public.retailer_offer_sync_recover_batch_internal(v_request); exception when others then v_blocked:=sqlerrm like '%Applied state drift blocks recovery%'; end; if not v_blocked then raise exception 'offer drift did not block recovery'; end if;
  v_blocked:=false; begin update public.price_history set price=price+1 where id=(select value::bigint from jsonb_array_elements_text((select created_price_history_ids from public.retailer_catalogue_staging_recovery_manifests where id=((select value->>'manifest_id' from mixed_test_context where key='recovery_meta'))::uuid)) limit 1); perform public.retailer_offer_sync_recover_batch_internal(v_request); exception when others then v_blocked:=sqlerrm like '%Owned history was altered%'; end; if not v_blocked then raise exception 'history drift did not block recovery'; end if;
end
$recovery_conflicts$;
set role retailer_catalogue_staging_executor;
select public.recover_retailer_offer_sync_batch(jsonb_build_object('schema_version',1,'recovery_approval_id',(:'recovery_approval'::jsonb->>'recovery_approval_id'),'expected_migration_versions',(select value->'expected_migration_versions' from mixed_test_context where key='recovery_meta'),'expected_migration_fingerprint',(select value->>'expected_migration_fingerprint' from mixed_test_context where key='recovery_meta'),'migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1','original_execution_migration_fingerprint',(select value->>'original_execution_migration_fingerprint' from mixed_test_context where key='recovery_meta'),'staging_project_ref','hxnrsyyqffztlvcrtgbf','staging_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf','explicit_allow',true)) as recovery_result \gset
reset role;
insert into mixed_test_context values('recovery',:'recovery_result'::jsonb);

do $assert_recovery$
begin
  if (select value->>'recovery_status' from mixed_test_context where key='recovery')<>'RECOVERED' or (select count(*) from public.offers where id between 9001 and 9026 and last_checked_at='2026-07-18T10:00:00Z')<>26 then raise exception 'mixed recovery failed'; end if;
end
$assert_recovery$;

select jsonb_build_object('result','PASS','rows_applied',26,'row_approvals',26,'replay','BLOCKED','rows_recovered',26,'price_history_delta',3,'ledger_negative_cases',(select count(*) from mixed_ledger_negative_results),'ledger_negative_failures',(select count(*) from mixed_ledger_negative_results where error_code not like 'RSBI_%'),'actions',jsonb_build_object('VERIFY_NO_CHANGE',21,'UPDATE_PRICE',1,'UPDATE_STOCK',1,'UPDATE_PRICE_AND_STOCK',1,'UPDATE_URL',1,'UPDATE_PRICE_STOCK_URL',1)) as mixed_batch_integration_result;
