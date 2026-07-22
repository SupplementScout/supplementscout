begin;

-- One reviewed bootstrap authorization, independently consumed in staging and production.
-- This does not alter the ordinary MASS_OOS limits or the ordinary validator path.
create table public.retailer_offer_sync_reviewed_stock_only_authorizations (
  authorization_id text primary key,
  target_environment text not null check (target_environment in ('STAGING','PRODUCTION')),
  approval_id uuid not null unique references public.retailer_offer_sync_batch_approvals(id) on delete restrict,
  reviewed_plan_hash text not null unique check (reviewed_plan_hash ~ '^[0-9a-f]{64}$'),
  artifact_fingerprint text not null check (artifact_fingerprint ~ '^[0-9a-f]{64}$'),
  contract jsonb not null check (jsonb_typeof(contract)='object'),
  status text not null default 'APPROVED' check (status in ('APPROVED','CONSUMED')),
  approved_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint reviewed_stock_only_consumption check (
    (status='APPROVED' and consumed_at is null) or
    (status='CONSUMED' and consumed_at is not null)
  )
);
alter table public.retailer_offer_sync_reviewed_stock_only_authorizations owner to postgres;
alter table public.retailer_offer_sync_reviewed_stock_only_authorizations enable row level security;
alter table public.retailer_offer_sync_reviewed_stock_only_authorizations force row level security;
revoke all on table public.retailer_offer_sync_reviewed_stock_only_authorizations from public,anon,authenticated,service_role;

do $rename$
begin
  if to_regprocedure('public.retailer_offer_sync_validate_batch_read_only_unreviewed_internal(jsonb)') is null then
    alter function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)
      rename to retailer_offer_sync_validate_batch_read_only_unreviewed_internal;
  end if;
  if to_regprocedure('public.retailer_offer_sync_approve_batch_unreviewed_internal(jsonb)') is null then
    alter function public.retailer_offer_sync_approve_batch_internal(jsonb)
      rename to retailer_offer_sync_approve_batch_unreviewed_internal;
  end if;
  if to_regprocedure('public.retailer_offer_sync_execute_batch_unreviewed_internal(jsonb)') is null then
    alter function public.retailer_offer_sync_execute_batch_internal(jsonb)
      rename to retailer_offer_sync_execute_batch_unreviewed_internal;
  end if;
end
$rename$;

create or replace function public.retailer_offer_sync_validate_reviewed_stock_only_contract(
  p_artifact jsonb,
  p_contract jsonb,
  p_validation_expires_at timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $reviewed$
declare
  v_environment text:=p_artifact->>'target_environment';
  v_authorization_id text;
  v_expected_offers jsonb;
  v_expected_mappings jsonb;
  v_expected_products jsonb;
  v_expected_variants jsonb;
  v_row jsonb;
  v_index integer:=0;
  v_expected_row_delta jsonb:=jsonb_build_object(
    'row_count_deltas',jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0),
    'logical_field_deltas',jsonb_build_object('offer_price_updates',0,'offer_shipping_updates',0,'offer_total_updates',0,'offer_stock_updates',1,'offer_url_updates',0,'mapping_url_updates',0,'mapping_updated_at_updates',0,'last_checked_at_updates',1));
  v_expected_batch_delta jsonb:=jsonb_build_object(
    'row_count_deltas',jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0),
    'logical_field_deltas',jsonb_build_object('offer_price_updates',0,'offer_shipping_updates',0,'offer_total_updates',0,'offer_stock_updates',8,'offer_url_updates',0,'mapping_url_updates',0,'mapping_updated_at_updates',0,'last_checked_at_updates',8));
begin
  if not public.atomic_import_has_exact_keys(p_contract,array[
       'schema_version','kind','authorization_id','target_environment','retailer_id',
       'offer_ids','mapping_ids','external_product_ids','external_variant_ids',
       'before_stock','after_stock','source_country','snapshot_a_fingerprint','snapshot_b_fingerprint',
       'snapshot_a_captured_at','snapshot_b_captured_at','expires_at','artifact_fingerprint','reviewed_plan_hash'])
     or p_contract->>'schema_version'<>'1'
     or p_contract->>'kind'<>'jons-reviewed-stock-only-v1'
     or p_contract->>'target_environment' is distinct from v_environment
     or p_contract->>'retailer_id'<>'10'
     or p_contract->>'source_country'<>'GB'
     or (p_contract->>'before_stock')::boolean is distinct from true
     or (p_contract->>'after_stock')::boolean is distinct from false then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid reviewed stock-only contract');
  end if;

  if v_environment='PRODUCTION' then
    v_authorization_id:='jons-reviewed-eight-oos-2026-07-22-production';
    v_expected_offers:='["1013","1016","1029","1046","1176","1243","1276","1375"]'::jsonb;
    v_expected_mappings:='["1199","1202","1215","1232","1362","1429","1462","1561"]'::jsonb;
    v_expected_products:='["10904679186770","10904679186770","10018787557714","10018787557714","10563642065234","10032290431314","10088760148306","10460316533074"]'::jsonb;
    v_expected_variants:='["53868239389010","53868239487314","50561870463314","50561871085906","53264568910162","50602413949266","50838720676178","52233394028882"]'::jsonb;
  elsif v_environment='STAGING' then
    v_authorization_id:='jons-reviewed-eight-oos-2026-07-22-staging';
    v_expected_offers:='["994","995","1084","1101","1366","1433","1466","1565"]'::jsonb;
    v_expected_mappings:='["1180","1181","1270","1287","1552","1619","1652","1751"]'::jsonb;
    v_expected_products:='["10904679186770","10904679186770","10018787557714","10018787557714","10563642065234","10032290431314","10088760148306","10460316533074"]'::jsonb;
    v_expected_variants:='["53868239487314","53868239389010","50561870463314","50561871085906","53264568910162","50602413949266","50838720676178","52233394028882"]'::jsonb;
  else
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Reviewed stock-only target must be staging or production');
  end if;

  if p_contract->>'authorization_id' is distinct from v_authorization_id
     or p_contract->'offer_ids' is distinct from v_expected_offers
     or p_contract->'mapping_ids' is distinct from v_expected_mappings
     or p_contract->'external_product_ids' is distinct from v_expected_products
     or p_contract->'external_variant_ids' is distinct from v_expected_variants
     or jsonb_array_length(p_artifact->'rows')<>8
     or p_artifact->>'retailer_id'<>'10' then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Reviewed stock-only identity set mismatch');
  end if;

  if p_contract->>'snapshot_a_fingerprint'!~'^[0-9a-f]{64}$'
     or p_contract->>'snapshot_b_fingerprint'!~'^[0-9a-f]{64}$'
     or p_contract->>'snapshot_a_fingerprint' is distinct from p_contract->>'snapshot_b_fingerprint'
     or p_contract->>'snapshot_b_fingerprint' is distinct from p_artifact->>'source_snapshot_fingerprint'
     or (p_contract->>'snapshot_a_captured_at')::timestamptz>=(p_contract->>'snapshot_b_captured_at')::timestamptz
     or (p_contract->>'snapshot_a_captured_at')::timestamptz<now()-interval '15 minutes'
     or (p_contract->>'snapshot_b_captured_at')::timestamptz>now()+interval '5 minutes'
     or (p_contract->>'snapshot_b_captured_at')::timestamptz is distinct from (p_artifact->>'source_captured_at')::timestamptz then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Reviewed Shopify GB snapshots do not match');
  end if;

  if (p_contract->>'expires_at')::timestamptz is distinct from p_validation_expires_at
     or p_validation_expires_at<=now()
     or p_validation_expires_at>now()+interval '15 minutes'
     or p_contract->>'artifact_fingerprint' is distinct from p_artifact->>'artifact_fingerprint'
     or p_contract->>'reviewed_plan_hash'!~'^[0-9a-f]{64}$'
     or public.retailer_catalogue_sha256_json(p_contract-'reviewed_plan_hash') is distinct from p_contract->>'reviewed_plan_hash' then
    perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Reviewed plan hash or expiry mismatch');
  end if;

  for v_row in select value from jsonb_array_elements(p_artifact->'rows') order by (value->>'offer_id')::bigint loop
    v_index:=v_index+1;
    if v_row->>'offer_id' is distinct from v_expected_offers->>(v_index-1)
       or v_row->>'retailer_product_id' is distinct from v_expected_mappings->>(v_index-1)
       or v_row->>'external_product_id' is distinct from v_expected_products->>(v_index-1)
       or v_row->>'external_variant_id' is distinct from v_expected_variants->>(v_index-1)
       or v_row->>'action'<>'UPDATE_STOCK'
       or v_row->'changed_fields' is distinct from jsonb_build_object('price',false,'stock',true,'url',false,'blocked',false)
       or v_row->'expected_deltas' is distinct from v_expected_row_delta
       or v_row#>>'{atomic_plan,meta,operation_type}'<>'standard_import'
       or v_row#>>'{atomic_plan,product,action}'<>'existing'
       or v_row#>>'{atomic_plan,product_variant,action}'<>'existing'
       or v_row#>>'{atomic_plan,retailer,action}'<>'existing'
       or v_row#>>'{atomic_plan,retailer,id}'<>'10'
       or v_row#>>'{atomic_plan,retailer_product,action}'<>'noop'
       or v_row#>>'{atomic_plan,retailer_product,id}' is distinct from v_expected_mappings->>(v_index-1)
       or v_row#>>'{atomic_plan,offer,action}'<>'update'
       or v_row#>>'{atomic_plan,offer,id}' is distinct from v_expected_offers->>(v_index-1)
       or (v_row#>>'{atomic_plan,expected_state,offer,in_stock}')::boolean is distinct from true
       or (v_row#>>'{atomic_plan,offer,values,in_stock}')::boolean is distinct from false
       or v_row#>>'{atomic_plan,offer,values,price}' is distinct from v_row#>>'{atomic_plan,expected_state,offer,price}'
       or v_row#>>'{atomic_plan,offer,values,shipping_cost}' is distinct from v_row#>>'{atomic_plan,expected_state,offer,shipping_cost}'
       or v_row#>>'{atomic_plan,offer,values,total_price}' is distinct from v_row#>>'{atomic_plan,expected_state,offer,total_price}'
       or v_row#>>'{atomic_plan,offer,values,url}' is distinct from v_row#>>'{atomic_plan,expected_state,offer,url}'
       or v_row#>>'{atomic_plan,retailer_product,values,external_url}' is distinct from v_row#>>'{atomic_plan,expected_state,retailer_product,external_url}'
       or v_row#>>'{atomic_plan,price_history,action}'<>'noop'
       or v_row#>>'{atomic_plan,approval,approved}'<>'false'
       or v_row#>>'{atomic_plan,approval,approval_type}'<>'none' then
      perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Reviewed row is not exact true-to-false stock-only');
    end if;
  end loop;

  if p_artifact->'expected_deltas' is distinct from v_expected_batch_delta then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_DELTA_MISMATCH','Reviewed stock-only aggregate delta mismatch');
  end if;
  return jsonb_build_object('valid',true,'authorization_id',v_authorization_id,'reviewed_plan_hash',p_contract->>'reviewed_plan_hash','row_count',8);
end
$reviewed$;

create or replace function public.retailer_offer_sync_validate_reviewed_stock_only_internal(p_request jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $validate$
declare
  v_artifact jsonb:=p_request->'artifact';
  v_contract jsonb:=p_request->'reviewed_stock_only_contract';
  v_guardrails jsonb:=p_request->'guardrails';
  v_limits jsonb;
  v_contract_result jsonb;
  v_manifest_result jsonb;
  v_row jsonb;
  v_rows jsonb:='[]'::jsonb;
  v_actual_migration text;
  v_actual_batch text;
begin
  if not public.atomic_import_has_exact_keys(p_request,array[
       'schema_version','kind','artifact','validation_expires_at','production_project_ref',
       'production_database_identity','expected_migration_versions','expected_migration_fingerprint',
       'migration_fingerprint_algorithm','migration_fingerprint_version','code_commit',
       'source_snapshot_fingerprint','policy_fingerprint','action_manifest_fingerprint',
       'artifact_fingerprint','guardrails','batch_fingerprint','package_fingerprint','reviewed_stock_only_contract'])
     and not public.atomic_import_has_exact_keys(p_request,array[
       'schema_version','kind','artifact','validation_expires_at','staging_project_ref',
       'staging_database_identity','expected_migration_versions','expected_migration_fingerprint',
       'migration_fingerprint_algorithm','migration_fingerprint_version','code_commit',
       'source_snapshot_fingerprint','policy_fingerprint','action_manifest_fingerprint',
       'artifact_fingerprint','guardrails','batch_fingerprint','package_fingerprint','reviewed_stock_only_contract']) then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid reviewed validation package keys');
  end if;
  if p_request->>'schema_version'<>'1' or p_request->>'kind'<>'retailer-existing-offer-mixed-batch-read-only-validation'
     or p_request->>'package_fingerprint'!~'^[0-9a-f]{64}$'
     or public.retailer_catalogue_sha256_json(jsonb_set(p_request,'{package_fingerprint}','null'::jsonb,false)) is distinct from p_request->>'package_fingerprint' then
    perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Reviewed validation package fingerprint mismatch');
  end if;
  if p_request->>'artifact_fingerprint' is distinct from v_artifact->>'artifact_fingerprint'
     or p_request->>'source_snapshot_fingerprint' is distinct from v_artifact->>'source_snapshot_fingerprint'
     or p_request->>'policy_fingerprint' is distinct from v_artifact->>'policy_fingerprint'
     or p_request->>'action_manifest_fingerprint' is distinct from v_artifact->>'action_manifest_fingerprint'
     or p_request->>'code_commit' is distinct from v_artifact->>'code_commit'
     or p_request->'expected_migration_versions' is distinct from v_artifact->'expected_migration_versions'
     or p_request->>'expected_migration_fingerprint' is distinct from v_artifact->>'expected_migration_fingerprint'
     or p_request->>'migration_fingerprint_algorithm' is distinct from v_artifact->>'migration_fingerprint_algorithm'
     or p_request->>'migration_fingerprint_version' is distinct from v_artifact->>'migration_fingerprint_version' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Reviewed validation bindings mismatch');
  end if;
  if (v_artifact->>'target_environment'='PRODUCTION' and (
        p_request->>'production_project_ref' is distinct from v_artifact->>'target_project_ref' or
        p_request->>'production_database_identity' is distinct from v_artifact->>'target_database_identity'))
     or (v_artifact->>'target_environment'='STAGING' and (
        p_request->>'staging_project_ref' is distinct from v_artifact->>'target_project_ref' or
        p_request->>'staging_database_identity' is distinct from v_artifact->>'target_database_identity')) then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Reviewed validation target binding mismatch');
  end if;
  if exists(select 1 from jsonb_array_elements(v_artifact->'rows') r where r.value#>>'{atomic_plan,meta,source_snapshot_sha256}' is distinct from v_artifact->>'source_snapshot_fingerprint' or r.value#>>'{atomic_plan,meta,source_captured_at}' is distinct from v_artifact->>'source_captured_at') then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Reviewed row source binding mismatch');
  end if;
  v_actual_batch:=public.retailer_catalogue_sha256_json(jsonb_build_object('artifact_fingerprint',v_artifact->>'artifact_fingerprint','action_manifest_fingerprint',v_artifact->>'action_manifest_fingerprint','policy_fingerprint',v_artifact->>'policy_fingerprint','source_snapshot_fingerprint',v_artifact->>'source_snapshot_fingerprint','row_count',jsonb_array_length(v_artifact->'rows'),'rows',v_artifact->'rows'));
  if p_request->>'batch_fingerprint' is distinct from v_actual_batch then perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Reviewed batch fingerprint mismatch'); end if;

  if not public.atomic_import_has_exact_keys(v_guardrails,array['schema_version','policy_fingerprint','source_product_count','previous_source_product_count','required_source_rows','matched_source_rows','new_oos_count','total_oos_count','previous_oos_count','changed_row_count','price_changed_row_count','price_anomaly_count','limits','result'])
     or v_guardrails->>'schema_version'<>'1' or v_guardrails->>'policy_fingerprint' is distinct from p_request->>'policy_fingerprint' or v_guardrails->>'result'<>'PASS' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid reviewed guardrail evidence');
  end if;
  v_limits:=v_guardrails->'limits';
  if not public.atomic_import_has_exact_keys(v_limits,array['minimum_source_count_ratio','maximum_new_oos_count','maximum_oos_increase_ratio','maximum_total_oos_ratio','maximum_changed_record_ratio','mass_price_change_ratio','price_anomaly_ratio','price_anomaly_absolute_gbp'])
     or (v_limits->>'minimum_source_count_ratio')::numeric not between 0.90 and 1
     or (v_limits->>'maximum_new_oos_count')::integer not between 0 and 3
     or (v_limits->>'maximum_oos_increase_ratio')::numeric not between 0 and 0.15
     or (v_limits->>'maximum_total_oos_ratio')::numeric not between 0 and 0.35
     or (v_limits->>'maximum_changed_record_ratio')::numeric not between 0 and 0.25
     or (v_limits->>'mass_price_change_ratio')::numeric<=0 or (v_limits->>'mass_price_change_ratio')::numeric>0.20
     or (v_limits->>'price_anomaly_ratio')::numeric<=0 or (v_limits->>'price_anomaly_ratio')::numeric>0.60
     or (v_limits->>'price_anomaly_absolute_gbp')::numeric<=0 or (v_limits->>'price_anomaly_absolute_gbp')::numeric>20 then
    perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','Reviewed plan cannot weaken global limits');
  end if;
  if (v_guardrails->>'source_product_count')::integer<>224 or (v_guardrails->>'previous_source_product_count')::integer<>224
     or (v_guardrails->>'required_source_rows')::integer<>8 or (v_guardrails->>'matched_source_rows')::integer<>8
     or (v_guardrails->>'new_oos_count')::integer<>8 or (v_guardrails->>'total_oos_count')::integer<>8
     or (v_guardrails->>'previous_oos_count')::integer<>0 or (v_guardrails->>'changed_row_count')::integer<>8
     or (v_guardrails->>'price_changed_row_count')::integer<>0 or (v_guardrails->>'price_anomaly_count')::integer<>0 then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Reviewed source evidence counts mismatch');
  end if;

  v_actual_migration:=public.retailer_catalogue_assert_migration_ledger(p_request->'expected_migration_versions',p_request->>'expected_migration_fingerprint');
  v_contract_result:=public.retailer_offer_sync_validate_reviewed_stock_only_contract(v_artifact,v_contract,(p_request->>'validation_expires_at')::timestamptz);
  v_manifest_result:=public.retailer_offer_sync_validate_manifest(v_artifact);
  for v_row in select value from jsonb_array_elements(v_artifact->'rows') order by (value->>'offer_id')::bigint loop
    v_rows:=v_rows||jsonb_build_array(jsonb_build_object('offer_id',v_row->>'offer_id','retailer_product_id',v_row->>'retailer_product_id','action',v_row->>'action','valid',true,'expected_deltas',v_row->'expected_deltas','validator_result',public.validate_product_import_plan_read_only(v_row->'atomic_plan')));
  end loop;
  return jsonb_build_object('valid',true,'status','DRY_RUN_VALIDATED','row_count',8,'rows',v_rows,'expected_deltas',v_artifact->'expected_deltas','batch_preview',jsonb_build_object('actions',jsonb_build_object('UPDATE_STOCK',8),'guardrails',v_guardrails,'reviewed_stock_only_contract',v_contract_result,'source_captured_at',v_artifact->>'source_captured_at','batch_fingerprint',v_actual_batch,'artifact_fingerprint',v_artifact->>'artifact_fingerprint','actual_migration_fingerprint',v_actual_migration),'manifest_validation',v_manifest_result,'business_writes',0,'control_writes',0,'validation_expires_at',p_request->>'validation_expires_at');
end
$validate$;

create or replace function public.retailer_offer_sync_validate_batch_read_only_internal(p_request jsonb)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $dispatch$
begin
  if p_request ? 'reviewed_stock_only_contract' then
    return public.retailer_offer_sync_validate_reviewed_stock_only_internal(p_request);
  end if;
  return public.retailer_offer_sync_validate_batch_read_only_unreviewed_internal(p_request);
end
$dispatch$;

create or replace function public.retailer_offer_sync_approve_batch_internal(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $approve$
declare v_result jsonb; v_contract jsonb; v_environment text;
begin
  if not (p_request ? 'reviewed_stock_only_contract') then return public.retailer_offer_sync_approve_batch_unreviewed_internal(p_request); end if;
  v_contract:=p_request->'reviewed_stock_only_contract';
  if not (public.atomic_import_has_exact_keys(p_request,array['schema_version','child_plan_id','parent_plan_fingerprint','child_plan_fingerprint','artifact','execution_fingerprint','expected_migration_versions','expected_migration_fingerprint','migration_fingerprint_algorithm','migration_fingerprint_version','approved_by','expires_at','production_project_ref','production_database_identity','reviewed_stock_only_contract'])
          or public.atomic_import_has_exact_keys(p_request,array['schema_version','child_plan_id','parent_plan_fingerprint','child_plan_fingerprint','artifact','execution_fingerprint','expected_migration_versions','expected_migration_fingerprint','migration_fingerprint_algorithm','migration_fingerprint_version','approved_by','expires_at','staging_project_ref','staging_database_identity','reviewed_stock_only_contract'])) then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid reviewed approval keys');
  end if;
  perform public.retailer_offer_sync_validate_reviewed_stock_only_contract(p_request->'artifact',v_contract,(p_request->>'expires_at')::timestamptz);
  v_result:=public.retailer_offer_sync_approve_batch_unreviewed_internal(p_request-'reviewed_stock_only_contract');
  v_environment:=p_request#>>'{artifact,target_environment}';
  insert into public.retailer_offer_sync_reviewed_stock_only_authorizations(authorization_id,target_environment,approval_id,reviewed_plan_hash,artifact_fingerprint,contract)
  values(v_contract->>'authorization_id',v_environment,(v_result->>'approval_id')::uuid,v_contract->>'reviewed_plan_hash',v_contract->>'artifact_fingerprint',v_contract);
  return v_result||jsonb_build_object('reviewed_stock_only',true,'reviewed_plan_hash',v_contract->>'reviewed_plan_hash');
end
$approve$;

create or replace function public.retailer_offer_sync_execute_batch_internal(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $execute$
declare v_review public.retailer_offer_sync_reviewed_stock_only_authorizations%rowtype; v_approval public.retailer_offer_sync_batch_approvals%rowtype; v_result jsonb;
begin
  select * into v_review from public.retailer_offer_sync_reviewed_stock_only_authorizations where approval_id=(p_request->>'approval_id')::uuid for update;
  if not found then return public.retailer_offer_sync_execute_batch_unreviewed_internal(p_request); end if;
  if v_review.status<>'APPROVED' or v_review.consumed_at is not null then perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Reviewed stock-only approval already consumed'); end if;
  select * into v_approval from public.retailer_offer_sync_batch_approvals where id=v_review.approval_id;
  if not found or v_approval.artifact_fingerprint is distinct from v_review.artifact_fingerprint then perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Reviewed approval binding mismatch'); end if;
  perform public.retailer_offer_sync_validate_reviewed_stock_only_contract(v_approval.approved_manifest,v_review.contract,v_approval.expires_at);
  v_result:=public.retailer_offer_sync_execute_batch_unreviewed_internal(p_request);
  update public.retailer_offer_sync_reviewed_stock_only_authorizations set status='CONSUMED',consumed_at=now() where authorization_id=v_review.authorization_id and status='APPROVED';
  if not found then perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Reviewed stock-only authorization consumption failed'); end if;
  return v_result||jsonb_build_object('reviewed_stock_only',true,'reviewed_plan_hash',v_review.reviewed_plan_hash);
end
$execute$;

alter function public.retailer_offer_sync_validate_reviewed_stock_only_contract(jsonb,jsonb,timestamptz) owner to postgres;
alter function public.retailer_offer_sync_validate_reviewed_stock_only_internal(jsonb) owner to postgres;
alter function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb) owner to postgres;
alter function public.retailer_offer_sync_approve_batch_internal(jsonb) owner to postgres;
alter function public.retailer_offer_sync_execute_batch_internal(jsonb) owner to postgres;

revoke all on function public.retailer_offer_sync_validate_reviewed_stock_only_contract(jsonb,jsonb,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.retailer_offer_sync_validate_reviewed_stock_only_internal(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.retailer_offer_sync_approve_batch_internal(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.retailer_offer_sync_execute_batch_internal(jsonb) from public,anon,authenticated,service_role;

do $grants$
begin
  if exists(select 1 from pg_roles where rolname='retailer_catalogue_staging_validator') then
    grant execute on function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb) to retailer_catalogue_staging_validator;
  end if;
  if exists(select 1 from pg_roles where rolname='retailer_catalogue_production_validator') then
    grant execute on function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb) to retailer_catalogue_production_validator;
  end if;
  if exists(select 1 from pg_roles where rolname='retailer_catalogue_staging_approver') then
    grant execute on function public.retailer_offer_sync_approve_batch_internal(jsonb) to retailer_catalogue_staging_approver;
  end if;
  if exists(select 1 from pg_roles where rolname='retailer_catalogue_production_approver') then
    grant execute on function public.retailer_offer_sync_approve_batch_internal(jsonb) to retailer_catalogue_production_approver;
  end if;
  if exists(select 1 from pg_roles where rolname='retailer_catalogue_staging_executor') then
    grant execute on function public.retailer_offer_sync_execute_batch_internal(jsonb) to retailer_catalogue_staging_executor;
  end if;
  if exists(select 1 from pg_roles where rolname='retailer_catalogue_production_executor') then
    grant execute on function public.retailer_offer_sync_execute_batch_internal(jsonb) to retailer_catalogue_production_executor;
  end if;
end
$grants$;

commit;
