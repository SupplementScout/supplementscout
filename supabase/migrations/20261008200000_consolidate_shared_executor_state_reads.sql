begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare
  v_definition text;
  v_state_read_count integer;
begin
  if to_regprocedure('public.retailer_offer_sync_execute_batch_unreviewed_internal(jsonb)') is null then
    raise exception 'shared unreviewed retailer executor is missing';
  end if;

  v_definition:=pg_get_functiondef(
    'public.retailer_offer_sync_execute_batch_unreviewed_internal(jsonb)'::regprocedure);
  v_state_read_count:=(
    length(v_definition)-length(replace(
      v_definition,
      'public.retailer_offer_sync_row_state((v_row->>''offer_id'')::bigint)',
      ''))
  )/length('public.retailer_offer_sync_row_state((v_row->>''offer_id'')::bigint)');

  if v_state_read_count<>9
     or position('perform public.validate_product_import_plan_read_only(v_row->''atomic_plan'')' in v_definition)=0
     or position('public.approve_product_import_plan' in v_definition)=0
     or position('public.apply_approved_product_import_plan' in v_definition)=0
     or position('RSBI_EXPECTED_STATE_MISMATCH' in v_definition)=0
     or position('RSBI_EXPECTED_DELTA_MISMATCH' in v_definition)=0
     or position('public.retailer_catalogue_other_retailer_fingerprint' in v_definition)=0
     or position('public.retailer_catalogue_protected_shared_fingerprint' in v_definition)=0 then
    raise exception 'shared unreviewed retailer executor definition drifted';
  end if;
end
$preflight$;

create or replace function public.retailer_offer_sync_execute_batch_unreviewed_internal(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $execute$
declare v_approval public.retailer_offer_sync_batch_approvals%rowtype; v_child public.retailer_catalogue_child_plans%rowtype; v_parent public.retailer_catalogue_parent_plans%rowtype; v_row jsonb; v_plan jsonb; v_row_approval jsonb; v_row_result jsonb; v_current_state jsonb; v_run jsonb; v_run_id uuid; v_before jsonb:='[]'; v_after jsonb:='[]'; v_history_ids jsonb:='[]'; v_approval_ids jsonb:='[]'; v_before_counts jsonb; v_after_counts jsonb; v_expected_history integer; v_actual_history integer; v_result jsonb; v_manifest_id uuid; v_actual_deltas jsonb; v_price_updates integer; v_shipping_updates integer; v_total_updates integer; v_stock_updates integer; v_offer_url_updates integer; v_mapping_url_updates integer; v_mapping_time_updates integer; v_checked_updates integer; v_other_before text; v_protected_before text; v_actual_migration text;
begin
  if not public.atomic_import_has_exact_keys(p_request,array['schema_version','approval_id','execution_fingerprint','expected_migration_versions','expected_migration_fingerprint','migration_fingerprint_algorithm','migration_fingerprint_version','production_project_ref','production_database_identity','requested_at','explicit_allow']) or coalesce((p_request->>'explicit_allow')::boolean,false)=false then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid mixed execution request');
  end if;
  perform public.retailer_catalogue_production_runtime_guard('PRODUCTION',p_request->>'production_project_ref',p_request->>'production_database_identity');
  select * into v_approval from public.retailer_offer_sync_batch_approvals where id=(p_request->>'approval_id')::uuid for update;
  if not found then perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Batch approval not found'); end if;
  if p_request->'expected_migration_versions' is distinct from v_approval.expected_migration_versions
     or p_request->>'expected_migration_fingerprint' is distinct from v_approval.expected_migration_fingerprint
     or p_request->>'migration_fingerprint_algorithm' is distinct from v_approval.migration_fingerprint_algorithm
     or p_request->>'migration_fingerprint_version' is distinct from v_approval.migration_fingerprint_version then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Mixed execution migration binding mismatch');
  end if;
  v_actual_migration:=public.retailer_catalogue_assert_migration_ledger(v_approval.expected_migration_versions,v_approval.expected_migration_fingerprint);
  if v_approval.consumed_at is not null then return coalesce(v_approval.result,'{}')||jsonb_build_object('code','RSBI_REPLAY_BLOCKED','noop',true,'business_writes',0); end if;
  if v_approval.expires_at<=now() or v_approval.execution_fingerprint is distinct from p_request->>'execution_fingerprint' then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Batch approval expired or mismatched'); end if;
  perform public.retailer_offer_sync_validate_manifest(v_approval.approved_manifest);
  select * into v_child from public.retailer_catalogue_child_plans where id=v_approval.child_plan_id for update; select * into v_parent from public.retailer_catalogue_parent_plans where id=v_child.parent_plan_id for update;
  if v_child.status<>'APPROVED' then perform public.retailer_catalogue_raise('RSBI_INVALID_TRANSITION','Child is not approved'); end if;
  for v_row in select value from jsonb_array_elements(v_approval.approved_manifest->'rows') order by (value->>'offer_id')::bigint loop
    perform pg_advisory_xact_lock((v_row->>'offer_id')::bigint); perform 1 from public.offers where id=(v_row->>'offer_id')::bigint for update;
    perform public.validate_product_import_plan_read_only(v_row->'atomic_plan');
    v_before:=v_before||jsonb_build_array(public.retailer_offer_sync_row_state((v_row->>'offer_id')::bigint));
  end loop;
  v_before_counts:=public.retailer_catalogue_business_counts(); v_other_before:=public.retailer_catalogue_other_retailer_fingerprint(v_child.retailer_id); v_protected_before:=public.retailer_catalogue_protected_shared_fingerprint();
  v_run:=public.begin_retailer_catalogue_child_apply(v_child.id,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_child.source_snapshot_fingerprint,v_child.canonical_snapshot_fingerprint,v_child.adapter_fingerprint,v_child.policy_fingerprint,v_child.code_commit,v_child.expected_state_fingerprint,'retailer_offer_sync');
  v_run_id:=(v_run->>'run_id')::uuid;
  for v_row in select value from jsonb_array_elements(v_approval.approved_manifest->'rows') order by (value->>'offer_id')::bigint loop
    v_plan:=v_row->'atomic_plan';
    v_row_approval:=public.approve_product_import_plan(v_plan,v_approval.artifact_fingerprint,'mbs-'||left(v_approval.execution_fingerprint,16)||'-'||lpad((v_row->>'offer_id'),12,'0')||'-'||left(v_plan#>>'{meta,plan_fingerprint}',16),'retailer_offer_mixed_batch',least(v_approval.expires_at,now()+interval '15 minutes'));
    v_row_result:=public.apply_approved_product_import_plan((v_row_approval->>'approval_id')::uuid,v_approval.artifact_fingerprint,v_plan#>>'{meta,plan_fingerprint}',v_plan#>>'{meta,source_row_fingerprint}',(v_plan#>>'{retailer,id}')::bigint,v_plan#>>'{meta,plan_kind}',v_row_approval->>'run_id');
    v_approval_ids:=v_approval_ids||jsonb_build_array(v_row_approval->>'approval_id');
    if v_row_result ? 'price_history_id' and nullif(v_row_result->>'price_history_id','') is not null then v_history_ids:=v_history_ids||jsonb_build_array(v_row_result->>'price_history_id'); end if;
  end loop;
  for v_row in select value from jsonb_array_elements(v_approval.approved_manifest->'rows') order by (value->>'offer_id')::bigint loop
    v_current_state:=public.retailer_offer_sync_row_state((v_row->>'offer_id')::bigint);
    v_after:=v_after||jsonb_build_array(v_current_state);
    v_plan:=v_row->'atomic_plan';
    if v_current_state->>'last_checked_at' is distinct from to_char((v_approval.approved_manifest->>'source_captured_at')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
       or v_current_state->>'price' is distinct from v_plan#>>'{offer,values,price}'
       or v_current_state->>'shipping_cost' is distinct from v_plan#>>'{offer,values,shipping_cost}'
       or v_current_state->>'total_price' is distinct from v_plan#>>'{offer,values,total_price}'
       or (v_current_state->>'in_stock')::boolean is distinct from (v_plan#>>'{offer,values,in_stock}')::boolean
       or v_current_state->>'offer_url' is distinct from v_plan#>>'{offer,values,url}'
       or v_current_state->>'mapping_url' is distinct from v_plan#>>'{retailer_product,values,external_url}' then
      perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Exact mixed post-state mismatch');
    end if;
  end loop;
  select count(*) filter(where b.value->>'price' is distinct from a.value->>'price'),count(*) filter(where b.value->>'shipping_cost' is distinct from a.value->>'shipping_cost'),count(*) filter(where b.value->>'total_price' is distinct from a.value->>'total_price'),count(*) filter(where b.value->>'in_stock' is distinct from a.value->>'in_stock'),count(*) filter(where b.value->>'offer_url' is distinct from a.value->>'offer_url'),count(*) filter(where b.value->>'mapping_url' is distinct from a.value->>'mapping_url'),count(*) filter(where b.value->>'mapping_updated_at' is distinct from a.value->>'mapping_updated_at'),count(*) filter(where b.value->>'last_checked_at' is distinct from a.value->>'last_checked_at')
  into v_price_updates,v_shipping_updates,v_total_updates,v_stock_updates,v_offer_url_updates,v_mapping_url_updates,v_mapping_time_updates,v_checked_updates
  from jsonb_array_elements(v_before) b(value) join jsonb_array_elements(v_after) a(value) on a.value->>'offer_id'=b.value->>'offer_id';
  v_after_counts:=public.retailer_catalogue_business_counts(); v_expected_history:=coalesce((v_approval.expected_deltas#>>'{row_count_deltas,price_history}')::integer,0); v_actual_history:=(v_after_counts->>'price_history')::integer-(v_before_counts->>'price_history')::integer;
  v_actual_deltas:=jsonb_build_object('row_count_deltas',jsonb_build_object('products',(v_after_counts->>'products')::int-(v_before_counts->>'products')::int,'product_variants',(v_after_counts->>'product_variants')::int-(v_before_counts->>'product_variants')::int,'retailer_products',(v_after_counts->>'retailer_products')::int-(v_before_counts->>'retailer_products')::int,'offers',(v_after_counts->>'offers')::int-(v_before_counts->>'offers')::int,'price_history',v_actual_history),'logical_field_deltas',jsonb_build_object('offer_price_updates',v_price_updates,'offer_shipping_updates',v_shipping_updates,'offer_total_updates',v_total_updates,'offer_stock_updates',v_stock_updates,'offer_url_updates',v_offer_url_updates,'mapping_url_updates',v_mapping_url_updates,'mapping_updated_at_updates',v_mapping_time_updates,'last_checked_at_updates',v_checked_updates));
  if v_actual_deltas is distinct from v_approval.expected_deltas or v_actual_history<>v_expected_history or jsonb_array_length(v_approval_ids)<>jsonb_array_length(v_approval.approved_manifest->'rows')
     or public.retailer_catalogue_other_retailer_fingerprint(v_child.retailer_id) is distinct from v_other_before or public.retailer_catalogue_protected_shared_fingerprint() is distinct from v_protected_before then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_DELTA_MISMATCH','Exact mixed batch deltas mismatch');
  end if;
  v_result:=jsonb_build_object('status','APPLIED','child_plan_id',v_child.id,'run_id',v_run_id,'row_approvals_created',jsonb_array_length(v_approval_ids),'row_approvals_consumed',jsonb_array_length(v_approval_ids),'expected_deltas',v_approval.expected_deltas,'price_history_delta',v_actual_history,'execution_fingerprint',v_approval.execution_fingerprint,'actual_migration_fingerprint',v_actual_migration,'business_writes',jsonb_array_length(v_approval.approved_manifest->'rows'));
  perform public.complete_retailer_catalogue_child_apply(v_run_id,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_after_counts,v_result,'retailer_offer_sync');
  insert into public.retailer_catalogue_production_recovery_manifests(package_id,package_fingerprint,child_plan_id,apply_run_id,dependency_group,execution_fingerprint,rollback_manifest_fingerprint,created_product_ids,created_variant_ids,created_mapping_ids,created_offer_ids,created_price_history_ids,updated_before_state,ownership,reverse_dependency_order,before_counts,other_retailer_fingerprint,protected_shared_fingerprint,orphan_counts,applied_owned_state_fingerprint,mixed_batch_artifact_fingerprint,mixed_batch_before_state,mixed_batch_applied_state,mixed_batch_migration_versions,mixed_batch_expected_migration_fingerprint,mixed_batch_migration_fingerprint_algorithm,mixed_batch_migration_fingerprint_version,mixed_batch_execution_migration_fingerprint)
  values(v_approval.id,v_approval.artifact_fingerprint,v_child.id,v_run_id,v_child.dependency_group,v_approval.execution_fingerprint,public.retailer_catalogue_sha256_json(jsonb_build_object('before',v_before,'after',v_after,'history',v_history_ids)),'[]','[]','[]','[]',v_history_ids,v_before,jsonb_build_object('kind','MIXED_EXISTING_OFFER_UPDATE','price_history_state',(select coalesce(jsonb_agg(jsonb_build_object('id',ph.id::text,'offer_id',ph.offer_id::text,'price',public.atomic_import_decimal_string(ph.price),'shipping_cost',case when ph.shipping_cost is null then null else to_jsonb(public.atomic_import_decimal_string(ph.shipping_cost)) end,'total_price',case when ph.total_price is null then null else to_jsonb(public.atomic_import_decimal_string(ph.total_price)) end,'checked_at',to_char(ph.checked_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) order by ph.id),'[]'::jsonb) from public.price_history ph where ph.id in(select value::bigint from jsonb_array_elements_text(v_history_ids)))),'[]',v_before_counts,v_other_before,v_protected_before,public.retailer_catalogue_orphan_counts(),public.retailer_catalogue_sha256_json(v_after),v_approval.artifact_fingerprint,v_before,v_after,v_approval.expected_migration_versions,v_approval.expected_migration_fingerprint,v_approval.migration_fingerprint_algorithm,v_approval.migration_fingerprint_version,v_actual_migration) returning id into v_manifest_id;
  v_result:=v_result||jsonb_build_object('recovery_manifest_id',v_manifest_id);
  update public.retailer_offer_sync_batch_approvals set consumed_at=now(),result=v_result where id=v_approval.id;
  return v_result;
end
$execute$;

do $postflight$
declare
  v_definition text:=pg_get_functiondef(
    'public.retailer_offer_sync_execute_batch_unreviewed_internal(jsonb)'::regprocedure);
  v_state_read_count integer;
begin
  v_state_read_count:=(
    length(v_definition)-length(replace(
      v_definition,
      'public.retailer_offer_sync_row_state((v_row->>''offer_id'')::bigint)',
      ''))
  )/length('public.retailer_offer_sync_row_state((v_row->>''offer_id'')::bigint)');

  if v_state_read_count<>2
     or position('v_current_state:=public.retailer_offer_sync_row_state' in replace(v_definition,' ',''))=0
     or position('perform public.validate_product_import_plan_read_only(v_row->''atomic_plan'')' in v_definition)=0
     or position('public.approve_product_import_plan' in v_definition)=0
     or position('public.apply_approved_product_import_plan' in v_definition)=0
     or position('RSBI_EXPECTED_STATE_MISMATCH' in v_definition)=0
     or position('RSBI_EXPECTED_DELTA_MISMATCH' in v_definition)=0
     or position('public.retailer_catalogue_other_retailer_fingerprint' in v_definition)=0
     or position('public.retailer_catalogue_protected_shared_fingerprint' in v_definition)=0 then
    raise exception 'shared executor state-read consolidation postflight failed';
  end if;
end
$postflight$;

commit;
