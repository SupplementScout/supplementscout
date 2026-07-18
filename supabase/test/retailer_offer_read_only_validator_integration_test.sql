\set ON_ERROR_STOP on

begin;

select set_config('app.safe_update','false',false);
select set_config('app.retailer_catalogue_staging_marker','1',false);
select set_config('app.retailer_catalogue_allow','1',false);

insert into public.verified_offer_refresh_targets(
  id,target_environment,project_ref,database_system_identifier,database_oid,is_active,attested_by)
select true,'STAGING','hxnrsyyqffztlvcrtgbf',system_identifier::text,
  (select oid from pg_database where datname=current_database()),true,'read-only-validator-test'
from pg_control_system()
on conflict(id) do update set target_environment=excluded.target_environment,
  project_ref=excluded.project_ref,database_system_identifier=excluded.database_system_identifier,
  database_oid=excluded.database_oid,is_active=true,attested_by=excluded.attested_by;

insert into public.retailers(id,name,slug,website)
values(980000,'Read Only Validation Retailer','read-only-validation','https://validation.test');
insert into public.products(id,name,slug,brand,category,product_format,is_active)
select 980000+n,'Read Only Product '||n,'read-only-product-'||n,'Validation','Supplements','powder',true
from generate_series(1,26) n;
insert into public.product_variants(id,product_id,variant_key,display_name,size_value,size_unit,pack_count,product_format,is_active,is_default)
select 980000+n,980000+n,'500g','500g',500,'g',1,'powder',true,false
from generate_series(1,26) n;
insert into public.retailer_products(
  id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,
  external_sku,external_options,external_name,external_slug,external_gtin,external_url,
  match_method,match_confidence)
select 980000+n,980000,980000+n,980000+n,'product-'||n,'variant-'||n,'sku-'||n,null,
  'Read Only Product '||n,'read-only-product-'||n,null,
  'https://validation.test/product-'||n||'?variant=variant-'||n,'external_id',100
from generate_series(1,26) n;
insert into public.offers(
  id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,
  total_price,in_stock,url,last_checked_at)
select 980000+n,980000+n,980000,980000+n,980000+n,19.99,3.99,23.98,true,
  'https://validation.test/product-'||n||'?variant=variant-'||n,now()-interval '2 hours'
from generate_series(1,26) n;

create table public.read_only_validator_test_results(
  case_name text primary key,
  result text not null,
  error_text text,
  state_unchanged boolean not null
);
create table public.read_only_validator_test_context(
  key text primary key,
  value jsonb not null
);

create or replace function public.read_only_validator_test_ledger_identifiers()
returns jsonb language sql stable as $function$
  select coalesce(jsonb_agg(value->>'identifier' order by (value->>'ordinal')::integer),'[]'::jsonb)
  from jsonb_array_elements(public.retailer_catalogue_actual_migration_ledger()->'migrations')
$function$;

create or replace function public.read_only_validator_test_state()
returns jsonb language sql stable as $function$
  select jsonb_build_object(
    'business_counts',public.retailer_catalogue_business_counts(),
    'offers',(select jsonb_agg(to_jsonb(o) order by o.id) from public.offers o where o.id between 980001 and 980026),
    'mappings',(select jsonb_agg(to_jsonb(rp) order by rp.id) from public.retailer_products rp where rp.id between 980001 and 980026),
    'history_count',(select count(*) from public.price_history),
    'approved_import_plans',(select count(*) from public.approved_import_plans),
    'mixed_approvals',(select count(*) from public.retailer_offer_sync_batch_approvals),
    'parent_plans',(select count(*) from public.retailer_catalogue_parent_plans),
    'child_plans',(select count(*) from public.retailer_catalogue_child_plans),
    'apply_runs',(select count(*) from public.retailer_catalogue_apply_runs),
    'recovery_manifests',(select count(*) from public.retailer_catalogue_staging_recovery_manifests),
    'recovery_audit',(select count(*) from public.retailer_catalogue_staging_recovery_audit))
$function$;

create or replace function public.read_only_validator_test_plan(p_id bigint,p_capture timestamptz,p_source text)
returns jsonb language plpgsql stable as $function$
declare
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_retailer public.retailers%rowtype;
  v_mapping public.retailer_products%rowtype;
  v_offer public.offers%rowtype;
  v_mapping_state jsonb;
  v_offer_state jsonb;
  v_plan jsonb;
begin
  select * into strict v_product from public.products where id=p_id;
  select * into strict v_variant from public.product_variants where id=p_id;
  select * into strict v_retailer from public.retailers where id=980000;
  select * into strict v_mapping from public.retailer_products where id=p_id;
  select * into strict v_offer from public.offers where id=p_id;
  v_mapping_state:=jsonb_build_object(
    'id',v_mapping.id::text,'retailer_id',v_mapping.retailer_id::text,
    'product_id',v_mapping.product_id::text,'product_variant_id',v_mapping.product_variant_id::text,
    'external_product_id',v_mapping.external_product_id,'external_variant_id',v_mapping.external_variant_id,
    'external_sku',v_mapping.external_sku,'external_options',v_mapping.external_options,
    'external_name',v_mapping.external_name,'external_slug',v_mapping.external_slug,
    'external_gtin',v_mapping.external_gtin,'external_url',v_mapping.external_url,
    'match_method',v_mapping.match_method,
    'match_confidence',case when v_mapping.match_confidence is null then null else to_jsonb(public.atomic_import_decimal_string(v_mapping.match_confidence)) end);
  v_offer_state:=jsonb_build_object(
    'id',v_offer.id::text,'product_id',v_offer.product_id::text,'retailer_id',v_offer.retailer_id::text,
    'product_variant_id',v_offer.product_variant_id::text,'retailer_product_id',v_offer.retailer_product_id::text,
    'price',public.atomic_import_decimal_string(v_offer.price),
    'shipping_cost',case when v_offer.shipping_cost is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.shipping_cost)) end,
    'total_price',case when v_offer.total_price is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.total_price)) end,
    'in_stock',v_offer.in_stock,'url',v_offer.url,
    'last_checked_at',to_char(v_offer.last_checked_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
  v_plan:=jsonb_build_object(
    'meta',jsonb_build_object(
      'version','2','plan_kind','feed','operation_type','verify_offer_no_change',
      'source_row_fingerprint',encode(sha256(convert_to('source-row:'||p_id,'UTF8')),'hex'),
      'plan_fingerprint',null,'target_environment','STAGING','target_project_ref','hxnrsyyqffztlvcrtgbf',
      'source_snapshot_sha256',p_source,
      'source_captured_at',to_char(p_capture at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
    'product',jsonb_build_object('action','existing','id',v_product.id::text),
    'product_variant',jsonb_build_object('action','existing','id',v_variant.id::text,'evidence',jsonb_build_object('external_product_id',v_mapping.external_product_id,'external_variant_id',v_mapping.external_variant_id)),
    'retailer',jsonb_build_object('action','existing','id',v_retailer.id::text),
    'retailer_product',jsonb_build_object('action','noop','id',v_mapping.id::text,'values',v_mapping_state),
    'offer',jsonb_build_object('action','verify_no_change','id',v_offer.id::text,'values',jsonb_build_object(
      'price',public.atomic_import_decimal_string(v_offer.price),
      'shipping_cost',case when v_offer.shipping_cost is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.shipping_cost)) end,
      'total_price',case when v_offer.total_price is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.total_price)) end,
      'in_stock',v_offer.in_stock,'url',v_offer.url,
      'last_checked_at',to_char(p_capture at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))),
    'price_history',jsonb_build_object('action','noop'),
    'approval',jsonb_build_object('approved',false,'approval_type','none'),
    'expected_state',jsonb_build_object(
      'product',jsonb_build_object('id',v_product.id::text,'name',v_product.name,'is_active',v_product.is_active,'merged_into_product_id',case when v_product.merged_into_product_id is null then null else to_jsonb(v_product.merged_into_product_id::text) end,'product_format',v_product.product_format),
      'retailer',jsonb_build_object('id',v_retailer.id::text,'name',v_retailer.name,'slug',v_retailer.slug,'website',v_retailer.website),
      'product_variant',jsonb_build_object('id',v_variant.id::text,'product_id',v_variant.product_id::text,'variant_key',v_variant.variant_key,'display_name',v_variant.display_name,'flavour_code',v_variant.flavour_code,'flavour_label',v_variant.flavour_label,'size_value',case when v_variant.size_value is null then null else to_jsonb(public.atomic_import_decimal_string(v_variant.size_value)) end,'size_unit',v_variant.size_unit,'pack_count',case when v_variant.pack_count is null then null else to_jsonb(v_variant.pack_count::text) end,'product_format',v_variant.product_format,'is_active',v_variant.is_active,'is_default',v_variant.is_default),
      'retailer_product',v_mapping_state,'offer',v_offer_state));
  return jsonb_set(v_plan,'{meta,plan_fingerprint}',to_jsonb(md5(public.atomic_import_canonical_json(v_plan))));
end
$function$;

create or replace function public.read_only_validator_test_reseal(p_request jsonb)
returns jsonb language plpgsql stable as $function$
declare v_request jsonb:=p_request; v_artifact jsonb; v_batch text;
begin
  v_artifact:=v_request->'artifact';
  v_artifact:=jsonb_set(v_artifact,'{artifact_fingerprint}',to_jsonb(public.retailer_catalogue_sha256_json(v_artifact-'artifact_fingerprint')));
  v_request:=jsonb_set(v_request,'{artifact}',v_artifact);
  v_request:=jsonb_set(v_request,'{artifact_fingerprint}',v_artifact->'artifact_fingerprint');
  v_batch:=public.retailer_catalogue_sha256_json(jsonb_build_object(
    'artifact_fingerprint',v_artifact->>'artifact_fingerprint',
    'action_manifest_fingerprint',v_artifact->>'action_manifest_fingerprint',
    'policy_fingerprint',v_artifact->>'policy_fingerprint',
    'source_snapshot_fingerprint',v_artifact->>'source_snapshot_fingerprint',
    'row_count',jsonb_array_length(v_artifact->'rows'),'rows',v_artifact->'rows'));
  v_request:=jsonb_set(v_request,'{batch_fingerprint}',to_jsonb(v_batch));
  return jsonb_set(v_request,'{package_fingerprint}',to_jsonb(public.retailer_catalogue_sha256_json(jsonb_set(v_request,'{package_fingerprint}','null'::jsonb,false))));
end
$function$;

create or replace function public.read_only_validator_test_package()
returns jsonb language plpgsql stable as $function$
declare
  v_capture timestamptz:=now()-interval '1 minute';
  v_source text:=repeat('b',64);
  v_policy text:=repeat('e',64);
  v_rows jsonb;
  v_expected jsonb:=jsonb_build_object(
    'row_count_deltas',jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0),
    'logical_field_deltas',jsonb_build_object('offer_price_updates',0,'offer_shipping_updates',0,'offer_total_updates',0,'offer_stock_updates',0,'offer_url_updates',0,'mapping_url_updates',0,'mapping_updated_at_updates',0,'last_checked_at_updates',26));
  v_row_delta jsonb:=jsonb_build_object(
    'row_count_deltas',jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0),
    'logical_field_deltas',jsonb_build_object('offer_price_updates',0,'offer_shipping_updates',0,'offer_total_updates',0,'offer_stock_updates',0,'offer_url_updates',0,'mapping_url_updates',0,'mapping_updated_at_updates',0,'last_checked_at_updates',1));
  v_artifact jsonb;
  v_request jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'offer_id',(980000+n)::text,'retailer_product_id',(980000+n)::text,
    'external_product_id','product-'||n,'external_variant_id','variant-'||n,
    'action','VERIFY_NO_CHANGE','changed_fields',jsonb_build_object('price',false,'stock',false,'url',false,'blocked',false),
    'source_captured_at',to_char(v_capture at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'expected_deltas',v_row_delta,'atomic_plan',public.read_only_validator_test_plan(980000+n,v_capture,v_source)) order by n)
  into v_rows from generate_series(1,26) n;
  v_artifact:=jsonb_build_object(
    'schema_version',1,'kind','retailer-existing-offer-mixed-batch-execution',
    'retailer_slug','read-only-validation','retailer_id','980000','target_environment','STAGING',
    'target_project_ref','hxnrsyyqffztlvcrtgbf','target_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf',
    'expected_migration_versions',public.read_only_validator_test_ledger_identifiers(),
    'expected_migration_fingerprint',public.retailer_catalogue_actual_migration_ledger_fingerprint(),
    'migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1',
    'source_snapshot_fingerprint',v_source,'adapter_fingerprint',repeat('d',64),'policy_fingerprint',v_policy,
    'code_commit','69f63f754423af1b81336fe31afb6f8825fb283e','expected_state_fingerprint',repeat('1',64),
    'source_captured_at',to_char(v_capture at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'state','DRY_RUN_READY','block','null'::jsonb,'rows',v_rows,'expected_deltas',v_expected,
    'action_manifest_fingerprint',public.retailer_catalogue_sha256_json(jsonb_build_object('state','DRY_RUN_READY','rows',v_rows,'expected_deltas',v_expected)),
    'artifact_fingerprint',null);
  v_request:=jsonb_build_object(
    'schema_version',1,'kind','retailer-existing-offer-mixed-batch-read-only-validation','artifact',v_artifact,
    'validation_expires_at',now()+interval '10 minutes','staging_project_ref','hxnrsyyqffztlvcrtgbf',
    'staging_database_identity','supplementscout-staging:hxnrsyyqffztlvcrtgbf',
    'expected_migration_versions',v_artifact->'expected_migration_versions',
    'expected_migration_fingerprint',v_artifact->>'expected_migration_fingerprint',
    'migration_fingerprint_algorithm','SHA-256','migration_fingerprint_version','RSBI-CJ1',
    'code_commit',v_artifact->>'code_commit','source_snapshot_fingerprint',v_source,
    'policy_fingerprint',v_policy,'action_manifest_fingerprint',v_artifact->>'action_manifest_fingerprint',
    'artifact_fingerprint',null,
    'guardrails',jsonb_build_object(
      'schema_version',1,'policy_fingerprint',v_policy,'source_product_count',100,'previous_source_product_count',100,
      'required_source_rows',26,'matched_source_rows',26,'new_oos_count',0,'total_oos_count',0,
      'previous_oos_count',0,'changed_row_count',0,'price_changed_row_count',0,'price_anomaly_count',0,
      'limits',jsonb_build_object('minimum_source_count_ratio','0.90','maximum_new_oos_count','3','maximum_oos_increase_ratio','0.15','maximum_total_oos_ratio','0.35','maximum_changed_record_ratio','0.25','mass_price_change_ratio','0.20','price_anomaly_ratio','0.60','price_anomaly_absolute_gbp','20.00'),
      'result','PASS'),
    'batch_fingerprint',null,'package_fingerprint',null);
  return public.read_only_validator_test_reseal(v_request);
end
$function$;

create or replace function public.read_only_validator_test_assert_blocked(p_case text,p_request jsonb,p_pattern text)
returns void language plpgsql security definer as $function$
declare v_before jsonb:=public.read_only_validator_test_state(); v_after jsonb; v_error text; v_blocked boolean:=false;
begin
  begin
    perform public.retailer_offer_sync_validate_batch_read_only_internal(p_request);
  exception when others then
    v_blocked:=true; v_error:=sqlerrm;
  end;
  v_after:=public.read_only_validator_test_state();
  if not v_blocked or position(p_pattern in coalesce(v_error,''))=0 or v_after is distinct from v_before then
    raise exception 'case % failed: blocked %, error %, state equal %',p_case,v_blocked,v_error,v_after is not distinct from v_before;
  end if;
  insert into public.read_only_validator_test_results values(p_case,'PASS',v_error,true);
end
$function$;

do $security$
declare v_role pg_roles%rowtype;
begin
  select * into strict v_role from pg_roles where rolname='retailer_catalogue_staging_validator';
  if v_role.rolcanlogin or v_role.rolinherit or v_role.rolsuper or v_role.rolcreatedb or v_role.rolcreaterole or v_role.rolreplication or v_role.rolbypassrls then raise exception 'validator role attributes unsafe'; end if;
  if not has_function_privilege('retailer_catalogue_staging_validator','public.validate_retailer_offer_sync_batch_read_only(jsonb)','EXECUTE')
     or not has_function_privilege('retailer_catalogue_staging_validator','public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)','EXECUTE')
     or has_function_privilege('retailer_catalogue_staging_validator','public.approve_retailer_offer_sync_batch(jsonb)','EXECUTE')
     or has_function_privilege('retailer_catalogue_staging_validator','public.execute_retailer_offer_sync_batch(jsonb)','EXECUTE')
     or has_function_privilege('retailer_catalogue_staging_validator','public.approve_retailer_offer_sync_recovery(jsonb)','EXECUTE')
     or has_function_privilege('retailer_catalogue_staging_validator','public.recover_retailer_offer_sync_batch(jsonb)','EXECUTE')
     or has_function_privilege('retailer_catalogue_staging_validator','public.approve_product_import_plan(jsonb,text,text,text,timestamp with time zone)','EXECUTE')
     or has_function_privilege('retailer_catalogue_staging_validator','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','EXECUTE')
     or has_function_privilege('retailer_catalogue_staging_validator','public.approve_retailer_catalogue_staging_fixture(jsonb)','EXECUTE')
     or has_function_privilege('retailer_catalogue_staging_validator','public.execute_staging_retailer_catalogue_child(jsonb)','EXECUTE')
     or has_function_privilege('retailer_catalogue_staging_validator','public.approve_retailer_catalogue_staging_recovery(jsonb)','EXECUTE')
     or has_function_privilege('retailer_catalogue_staging_validator','public.recover_staging_retailer_catalogue_child(jsonb)','EXECUTE')
     or exists(
       select 1 from unnest(array[
         'public.retailers','public.products','public.product_variants','public.retailer_products',
         'public.offers','public.price_history','public.approved_import_plans',
         'public.retailer_catalogue_parent_plans','public.retailer_catalogue_child_plans',
         'public.retailer_catalogue_apply_runs','public.retailer_catalogue_staging_recovery_manifests',
         'public.retailer_catalogue_staging_recovery_approvals','public.retailer_catalogue_staging_recovery_audit',
         'public.retailer_offer_sync_batch_approvals']) table_name,
         unnest(array['INSERT','UPDATE','DELETE']) privilege
       where has_table_privilege('retailer_catalogue_staging_validator',table_name,privilege)) then
    raise exception 'validator role privilege boundary unsafe';
  end if;
  insert into public.read_only_validator_test_results values('write_rpc_inaccessible','PASS',null,true);
end
$security$;

select public.read_only_validator_test_state() as positive_before \gset
select public.read_only_validator_test_package() as valid_package \gset
set role retailer_catalogue_staging_validator;
select public.validate_retailer_offer_sync_batch_read_only(:'valid_package'::jsonb) as positive_result \gset
reset role;
select public.read_only_validator_test_state() as positive_after \gset
insert into public.read_only_validator_test_context(key,value) values
  ('positive_before',:'positive_before'::jsonb),
  ('positive_result',:'positive_result'::jsonb),
  ('positive_after',:'positive_after'::jsonb);

do $positive$
declare
  v_result jsonb:=(select value from public.read_only_validator_test_context where key='positive_result');
  v_before jsonb:=(select value from public.read_only_validator_test_context where key='positive_before');
  v_after jsonb:=(select value from public.read_only_validator_test_context where key='positive_after');
begin
  if v_result->>'status'<>'DRY_RUN_VALIDATED' or (v_result->>'row_count')::int<>26
     or jsonb_array_length(v_result->'rows')<>26
     or v_result#>>'{batch_preview,actions,VERIFY_NO_CHANGE}'<>'26'
     or v_result#>>'{expected_deltas,logical_field_deltas,last_checked_at_updates}'<>'26'
     or v_result->>'business_writes'<>'0' or v_result->>'control_writes'<>'0'
     or v_before is distinct from v_after then
    raise exception 'positive 26-row validation failed: %',v_result;
  end if;
  insert into public.read_only_validator_test_results values('verify_no_change_26','PASS',null,true);
end
$positive$;

do $negative$
declare q jsonb:=public.read_only_validator_test_package(); bad jsonb; a jsonb; rows jsonb; row_delta jsonb; expected jsonb;
begin
  bad:=jsonb_set(q,'{staging_project_ref}','"unknownprojectrefxxxx"');
  bad:=jsonb_set(bad,'{package_fingerprint}',to_jsonb(public.retailer_catalogue_sha256_json(jsonb_set(bad,'{package_fingerprint}','null'::jsonb,false))));
  perform public.read_only_validator_test_assert_blocked('wrong_target',bad,'Project ref is not the exact staging ref');

  bad:=jsonb_set(q,'{staging_project_ref}','"aftboxmrdgyhizicfsfu"');
  bad:=jsonb_set(bad,'{package_fingerprint}',to_jsonb(public.retailer_catalogue_sha256_json(jsonb_set(bad,'{package_fingerprint}','null'::jsonb,false))));
  perform public.read_only_validator_test_assert_blocked('production_target',bad,'Project ref is not the exact staging ref');

  a:=jsonb_set(q->'artifact','{expected_migration_fingerprint}',to_jsonb(repeat('0',64)));
  bad:=jsonb_set(jsonb_set(q,'{artifact}',a),'{expected_migration_fingerprint}',to_jsonb(repeat('0',64)));
  bad:=public.read_only_validator_test_reseal(bad);
  perform public.read_only_validator_test_assert_blocked('migration_mismatch',bad,'Actual migration ledger does not match');

  bad:=jsonb_set(q,'{source_snapshot_fingerprint}',to_jsonb(repeat('0',64)));
  bad:=jsonb_set(bad,'{package_fingerprint}',to_jsonb(public.retailer_catalogue_sha256_json(jsonb_set(bad,'{package_fingerprint}','null'::jsonb,false))));
  perform public.read_only_validator_test_assert_blocked('source_mismatch',bad,'bindings do not match');

  update public.offers set price=20.99 where id=980001;
  perform public.read_only_validator_test_assert_blocked('price_drift',q,'stale verified no-change plan');
  update public.offers set price=19.99 where id=980001;

  update public.offers set in_stock=false where id=980001;
  perform public.read_only_validator_test_assert_blocked('stock_drift',q,'stale verified no-change plan');
  update public.offers set in_stock=true where id=980001;

  update public.offers set url='https://validation.test/drift' where id=980001;
  perform public.read_only_validator_test_assert_blocked('url_drift',q,'stale verified no-change plan');
  update public.offers set url='https://validation.test/product-1?variant=variant-1' where id=980001;

  update public.retailer_products set external_variant_id='identity-drift' where id=980001;
  perform public.read_only_validator_test_assert_blocked('identity_drift',q,'identity drift');
  update public.retailer_products set external_variant_id='variant-1' where id=980001;

  bad:=jsonb_set(q,'{guardrails,source_product_count}',to_jsonb(80));
  bad:=jsonb_set(bad,'{package_fingerprint}',to_jsonb(public.retailer_catalogue_sha256_json(jsonb_set(bad,'{package_fingerprint}','null'::jsonb,false))));
  perform public.read_only_validator_test_assert_blocked('source_collapse',bad,'source collapse guard');

  a:=q->'artifact'; rows:=a->'rows';
  for i in 0..3 loop
    rows:=jsonb_set(rows,array[i::text,'action'],'"UPDATE_STOCK"');
    rows:=jsonb_set(rows,array[i::text,'changed_fields','stock'],'true'::jsonb);
    rows:=jsonb_set(rows,array[i::text,'atomic_plan','offer','values','in_stock'],'false'::jsonb);
    row_delta:=rows#>array[i::text,'expected_deltas'];
    row_delta:=jsonb_set(row_delta,'{logical_field_deltas,offer_stock_updates}','1'::jsonb);
    rows:=jsonb_set(rows,array[i::text,'expected_deltas'],row_delta);
  end loop;
  expected:=a->'expected_deltas'; expected:=jsonb_set(expected,'{logical_field_deltas,offer_stock_updates}','4'::jsonb);
  a:=jsonb_set(jsonb_set(a,'{rows}',rows),'{expected_deltas}',expected);
  bad:=jsonb_set(q,'{artifact}',a);
  bad:=jsonb_set(bad,'{guardrails,new_oos_count}','4'::jsonb);
  bad:=jsonb_set(bad,'{guardrails,total_oos_count}','4'::jsonb);
  bad:=jsonb_set(bad,'{guardrails,changed_row_count}','4'::jsonb);
  bad:=public.read_only_validator_test_reseal(bad);
  perform public.read_only_validator_test_assert_blocked('mass_oos',bad,'mass OOS guard');

  a:=q->'artifact'; select jsonb_agg(value order by ordinality desc) into rows from jsonb_array_elements(a->'rows') with ordinality;
  bad:=public.read_only_validator_test_reseal(jsonb_set(q,'{artifact}',jsonb_set(a,'{rows}',rows)));
  perform public.read_only_validator_test_assert_blocked('reordered_rows',bad,'unique and ascending');

  a:=q->'artifact'; rows:=jsonb_set(a->'rows','{1}',(a->'rows')->0);
  bad:=public.read_only_validator_test_reseal(jsonb_set(q,'{artifact}',jsonb_set(a,'{rows}',rows)));
  perform public.read_only_validator_test_assert_blocked('duplicate_row',bad,'unique and ascending');

  bad:=jsonb_set(q,'{validation_expires_at}',to_jsonb(now()-interval '1 minute'));
  bad:=jsonb_set(bad,'{package_fingerprint}',to_jsonb(public.retailer_catalogue_sha256_json(jsonb_set(bad,'{package_fingerprint}','null'::jsonb,false))));
  perform public.read_only_validator_test_assert_blocked('expired_package',bad,'expiry must be within 15 minutes');
end
$negative$;

do $wrong_role$
declare q jsonb:=public.read_only_validator_test_package(); v_error text;
begin
  begin perform public.validate_retailer_offer_sync_batch_read_only(q); exception when others then v_error:=sqlerrm; end;
  if v_error not like '%Staging validator role required%' then raise exception 'wrong role was not blocked: %',v_error; end if;
  insert into public.read_only_validator_test_results values('wrong_role','PASS',v_error,true);
end
$wrong_role$;

select jsonb_build_object(
  'result',case when (select count(*) from public.read_only_validator_test_results where result<>'PASS')=0 then 'PASS' else 'FAIL' end,
  'rows_validated',26,'actions',jsonb_build_object('VERIFY_NO_CHANGE',26),
  'expected_deltas',(select value->'expected_deltas' from public.read_only_validator_test_context where key='positive_result'),
  'business_writes',0,'control_writes',0,'price_history_writes',0,
  'cases',(select count(*) from public.read_only_validator_test_results),
  'failures',(select count(*) from public.read_only_validator_test_results where result<>'PASS' or not state_unchanged),
  'skips',0,'validation_role','retailer_catalogue_staging_validator',
  'validation_expiry_minutes',15) as read_only_validator_integration_result;

rollback;
