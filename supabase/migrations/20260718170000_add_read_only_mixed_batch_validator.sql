begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.retailer_offer_sync_validate_manifest(jsonb)') is null
     or to_regprocedure('public.validate_product_import_plan_read_only(jsonb)') is null
     or to_regprocedure('public.retailer_catalogue_assert_migration_ledger(jsonb,text)') is null
     or to_regprocedure('public.retailer_catalogue_staging_runtime_guard(text,text,text)') is null then
    raise exception 'read-only mixed-batch validator requires the mixed-batch, verified no-change and staging guard migrations';
  end if;
  if to_regprocedure('public.validate_retailer_offer_sync_batch_read_only(jsonb)') is not null then
    raise exception 'read-only mixed-batch validator is already installed; rerun rejected';
  end if;
end
$preflight$;

do $role$
declare v_role pg_roles%rowtype;
begin
  select * into v_role from pg_roles where rolname='retailer_catalogue_staging_validator';
  if not found then
    create role retailer_catalogue_staging_validator
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  elsif v_role.rolcanlogin or v_role.rolinherit or v_role.rolsuper or v_role.rolcreatedb
     or v_role.rolcreaterole or v_role.rolreplication or v_role.rolbypassrls then
    raise exception 'existing read-only mixed-batch validator role is not fail-closed';
  end if;
end
$role$;

create or replace function public.retailer_offer_sync_validate_batch_read_only_internal(p_request jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $validate$
declare
  v_artifact jsonb;
  v_guardrails jsonb;
  v_limits jsonb;
  v_manifest_result jsonb;
  v_row jsonb;
  v_row_result jsonb;
  v_row_results jsonb:='[]'::jsonb;
  v_row_count integer;
  v_changed integer;
  v_price_changed integer;
  v_new_oos integer;
  v_total_oos integer;
  v_previous_oos integer;
  v_price_anomalies integer;
  v_source_products integer;
  v_previous_source_products integer;
  v_minimum_source_ratio numeric;
  v_maximum_new_oos integer;
  v_maximum_oos_increase numeric;
  v_maximum_total_oos numeric;
  v_maximum_changed numeric;
  v_mass_price_ratio numeric;
  v_price_anomaly_ratio numeric;
  v_price_anomaly_absolute numeric;
  v_actual_migration text;
  v_actual_batch_fingerprint text;
begin
  if not public.atomic_import_has_exact_keys(p_request,array[
       'schema_version','kind','artifact','validation_expires_at','staging_project_ref',
       'staging_database_identity','expected_migration_versions','expected_migration_fingerprint',
       'migration_fingerprint_algorithm','migration_fingerprint_version','code_commit',
       'source_snapshot_fingerprint','policy_fingerprint','action_manifest_fingerprint',
       'artifact_fingerprint','guardrails','batch_fingerprint','package_fingerprint'])
     or p_request->>'schema_version'<>'1'
     or p_request->>'kind'<>'retailer-existing-offer-mixed-batch-read-only-validation'
     or jsonb_typeof(p_request->'artifact') is distinct from 'object'
     or jsonb_typeof(p_request->'guardrails') is distinct from 'object' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid read-only mixed-batch validation package');
  end if;

  if p_request->>'package_fingerprint'!~'^[0-9a-f]{64}$'
     or public.retailer_catalogue_sha256_json(jsonb_set(p_request,'{package_fingerprint}','null'::jsonb,false)) is distinct from p_request->>'package_fingerprint' then
    perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Read-only validation package fingerprint mismatch');
  end if;
  if (p_request->>'validation_expires_at')::timestamptz<=now()
     or (p_request->>'validation_expires_at')::timestamptz>now()+interval '15 minutes' then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Read-only validation expiry must be within 15 minutes');
  end if;

  perform public.retailer_catalogue_staging_runtime_guard(
    'STAGING',p_request->>'staging_project_ref',p_request->>'staging_database_identity');

  v_artifact:=p_request->'artifact';
  if p_request->'expected_migration_versions' is distinct from v_artifact->'expected_migration_versions'
     or p_request->>'expected_migration_fingerprint' is distinct from v_artifact->>'expected_migration_fingerprint'
     or p_request->>'migration_fingerprint_algorithm' is distinct from v_artifact->>'migration_fingerprint_algorithm'
     or p_request->>'migration_fingerprint_version' is distinct from v_artifact->>'migration_fingerprint_version'
     or p_request->>'code_commit' is distinct from v_artifact->>'code_commit'
     or p_request->>'source_snapshot_fingerprint' is distinct from v_artifact->>'source_snapshot_fingerprint'
     or p_request->>'policy_fingerprint' is distinct from v_artifact->>'policy_fingerprint'
     or p_request->>'action_manifest_fingerprint' is distinct from v_artifact->>'action_manifest_fingerprint'
     or p_request->>'artifact_fingerprint' is distinct from v_artifact->>'artifact_fingerprint'
     or p_request->>'code_commit'!~'^[0-9a-f]{40}$' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Read-only validation bindings do not match the immutable artifact');
  end if;
  if exists(
    select 1 from jsonb_array_elements(v_artifact->'rows') row(value)
    where row.value#>>'{atomic_plan,meta,source_snapshot_sha256}' is distinct from p_request->>'source_snapshot_fingerprint'
       or row.value#>>'{atomic_plan,meta,source_captured_at}' is distinct from v_artifact->>'source_captured_at') then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Row source binding does not match the immutable artifact');
  end if;

  v_row_count:=jsonb_array_length(v_artifact->'rows');
  if exists(
    select 1
    from (
      select (value->>'offer_id')::bigint offer_id,
        lag((value->>'offer_id')::bigint) over(order by ordinality) previous_offer_id
      from jsonb_array_elements(v_artifact->'rows') with ordinality
    ) ordered
    where previous_offer_id is not null and offer_id<=previous_offer_id) then
    perform public.retailer_catalogue_raise('RSBI_DUPLICATE_IDENTITY','Rows must be unique and ascending by offer ID');
  end if;
  v_actual_batch_fingerprint:=public.retailer_catalogue_sha256_json(jsonb_build_object(
    'artifact_fingerprint',v_artifact->>'artifact_fingerprint',
    'action_manifest_fingerprint',v_artifact->>'action_manifest_fingerprint',
    'policy_fingerprint',v_artifact->>'policy_fingerprint',
    'source_snapshot_fingerprint',v_artifact->>'source_snapshot_fingerprint',
    'row_count',v_row_count,
    'rows',v_artifact->'rows'));
  if p_request->>'batch_fingerprint'!~'^[0-9a-f]{64}$'
     or p_request->>'batch_fingerprint' is distinct from v_actual_batch_fingerprint then
    perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Read-only batch fingerprint mismatch');
  end if;

  v_actual_migration:=public.retailer_catalogue_assert_migration_ledger(
    p_request->'expected_migration_versions',p_request->>'expected_migration_fingerprint');

  v_guardrails:=p_request->'guardrails';
  if not public.atomic_import_has_exact_keys(v_guardrails,array[
       'schema_version','policy_fingerprint','source_product_count','previous_source_product_count',
       'required_source_rows','matched_source_rows','new_oos_count','total_oos_count',
       'previous_oos_count','changed_row_count','price_changed_row_count','price_anomaly_count',
       'limits','result'])
     or v_guardrails->>'schema_version'<>'1'
     or v_guardrails->>'policy_fingerprint' is distinct from p_request->>'policy_fingerprint'
     or v_guardrails->>'result'<>'PASS'
     or jsonb_typeof(v_guardrails->'limits') is distinct from 'object' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid read-only policy guardrail evidence');
  end if;
  v_limits:=v_guardrails->'limits';
  if not public.atomic_import_has_exact_keys(v_limits,array[
       'minimum_source_count_ratio','maximum_new_oos_count','maximum_oos_increase_ratio',
       'maximum_total_oos_ratio','maximum_changed_record_ratio','mass_price_change_ratio',
       'price_anomaly_ratio','price_anomaly_absolute_gbp']) then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid read-only policy guardrail limits');
  end if;

  v_minimum_source_ratio:=(v_limits->>'minimum_source_count_ratio')::numeric;
  v_maximum_new_oos:=(v_limits->>'maximum_new_oos_count')::integer;
  v_maximum_oos_increase:=(v_limits->>'maximum_oos_increase_ratio')::numeric;
  v_maximum_total_oos:=(v_limits->>'maximum_total_oos_ratio')::numeric;
  v_maximum_changed:=(v_limits->>'maximum_changed_record_ratio')::numeric;
  v_mass_price_ratio:=(v_limits->>'mass_price_change_ratio')::numeric;
  v_price_anomaly_ratio:=(v_limits->>'price_anomaly_ratio')::numeric;
  v_price_anomaly_absolute:=(v_limits->>'price_anomaly_absolute_gbp')::numeric;
  if v_minimum_source_ratio not between 0.90 and 1
     or v_maximum_new_oos not between 0 and 3
     or v_maximum_oos_increase not between 0 and 0.15
     or v_maximum_total_oos not between 0 and 0.35
     or v_maximum_changed not between 0 and 0.25
     or v_mass_price_ratio<=0 or v_mass_price_ratio>0.20
     or v_price_anomaly_ratio<=0 or v_price_anomaly_ratio>0.60
     or v_price_anomaly_absolute<=0 or v_price_anomaly_absolute>20 then
    perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','Read-only validation limits may not weaken the mixed-batch policy');
  end if;

  select count(*) filter(where value->>'action'<>'VERIFY_NO_CHANGE'),
         count(*) filter(where (value#>>'{changed_fields,price}')::boolean),
         count(*) filter(where (value#>>'{atomic_plan,expected_state,offer,in_stock}')::boolean and not (value#>>'{atomic_plan,offer,values,in_stock}')::boolean),
         count(*) filter(where not (value#>>'{atomic_plan,offer,values,in_stock}')::boolean),
         count(*) filter(where not (value#>>'{atomic_plan,expected_state,offer,in_stock}')::boolean),
         count(*) filter(where (value#>>'{changed_fields,price}')::boolean and
           (abs((value#>>'{atomic_plan,offer,values,price}')::numeric-(value#>>'{atomic_plan,expected_state,offer,price}')::numeric)>=v_price_anomaly_absolute
            or abs((value#>>'{atomic_plan,offer,values,price}')::numeric-(value#>>'{atomic_plan,expected_state,offer,price}')::numeric)
               /greatest(0.01,(value#>>'{atomic_plan,expected_state,offer,price}')::numeric)>=v_price_anomaly_ratio))
  into v_changed,v_price_changed,v_new_oos,v_total_oos,v_previous_oos,v_price_anomalies
  from jsonb_array_elements(v_artifact->'rows');

  v_source_products:=(v_guardrails->>'source_product_count')::integer;
  v_previous_source_products:=(v_guardrails->>'previous_source_product_count')::integer;
  if (v_guardrails->>'required_source_rows')::integer<>v_row_count
     or (v_guardrails->>'matched_source_rows')::integer<>v_row_count
     or (v_guardrails->>'new_oos_count')::integer<>v_new_oos
     or (v_guardrails->>'total_oos_count')::integer<>v_total_oos
     or (v_guardrails->>'previous_oos_count')::integer<>v_previous_oos
     or (v_guardrails->>'changed_row_count')::integer<>v_changed
     or (v_guardrails->>'price_changed_row_count')::integer<>v_price_changed
     or (v_guardrails->>'price_anomaly_count')::integer<>v_price_anomalies then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Read-only source coverage or guardrail metrics do not match rows');
  end if;
  if v_source_products<=0 or v_previous_source_products<=0
     or v_source_products::numeric/v_previous_source_products<v_minimum_source_ratio then
    perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','Read-only source collapse guard blocked the batch');
  end if;
  if v_new_oos>v_maximum_new_oos
     or (v_total_oos-v_previous_oos)::numeric/v_row_count>v_maximum_oos_increase
     or v_total_oos::numeric/v_row_count>v_maximum_total_oos then
    perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','Read-only mass OOS guard blocked the batch');
  end if;
  if v_changed::numeric/v_row_count>v_maximum_changed
     or v_price_changed::numeric/v_row_count>=v_mass_price_ratio
     or v_price_anomalies>0 then
    perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','Read-only mass change or price anomaly guard blocked the batch');
  end if;

  v_manifest_result:=public.retailer_offer_sync_validate_manifest(v_artifact);
  for v_row in select value from jsonb_array_elements(v_artifact->'rows') order by (value->>'offer_id')::bigint loop
    v_row_result:=public.validate_product_import_plan_read_only(v_row->'atomic_plan');
    v_row_results:=v_row_results||jsonb_build_array(jsonb_build_object(
      'offer_id',v_row->>'offer_id','retailer_product_id',v_row->>'retailer_product_id',
      'action',v_row->>'action','valid',true,'expected_deltas',v_row->'expected_deltas',
      'validator_result',v_row_result));
  end loop;

  return jsonb_build_object(
    'valid',true,'status','DRY_RUN_VALIDATED','row_count',v_row_count,
    'rows',v_row_results,'expected_deltas',v_artifact->'expected_deltas',
    'batch_preview',jsonb_build_object(
      'actions',(select jsonb_object_agg(action,row_count) from (select value->>'action' action,count(*) row_count from jsonb_array_elements(v_artifact->'rows') group by value->>'action') counts),
      'guardrails',v_guardrails,'source_captured_at',v_artifact->>'source_captured_at',
      'batch_fingerprint',v_actual_batch_fingerprint,'artifact_fingerprint',v_artifact->>'artifact_fingerprint',
      'actual_migration_fingerprint',v_actual_migration),
    'manifest_validation',v_manifest_result,'business_writes',0,'control_writes',0,
    'validation_expires_at',p_request->>'validation_expires_at');
end
$validate$;

create or replace function public.validate_retailer_offer_sync_batch_read_only(p_request jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,pg_temp
as $validate_wrapper$
begin
  if current_user<>'retailer_catalogue_staging_validator' then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Staging validator role required');
  end if;
  return public.retailer_offer_sync_validate_batch_read_only_internal(p_request);
end
$validate_wrapper$;

alter function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb) owner to postgres;
alter function public.validate_retailer_offer_sync_batch_read_only(jsonb) owner to postgres;

revoke all on function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)
  from public,anon,authenticated,service_role,retailer_catalogue_staging_approver,
       retailer_catalogue_staging_executor,retailer_catalogue_staging_validator;
revoke all on function public.validate_retailer_offer_sync_batch_read_only(jsonb)
  from public,anon,authenticated,service_role,retailer_catalogue_staging_approver,
       retailer_catalogue_staging_executor;
grant usage on schema public to retailer_catalogue_staging_validator;
grant execute on function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)
  to retailer_catalogue_staging_validator;
grant execute on function public.validate_retailer_offer_sync_batch_read_only(jsonb)
  to retailer_catalogue_staging_validator;

commit;
