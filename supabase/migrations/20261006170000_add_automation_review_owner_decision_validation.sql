begin;

set local lock_timeout='5s';
set local statement_timeout='120s';

do $preflight$
begin
  if to_regclass('public.product_match_review_queue') is null
     or to_regclass('public.product_match_review_events') is null
     or to_regclass('public.automation_review_execution_requests') is null
     or to_regprocedure('public.retailer_offer_sync_validate_batch_read_only_unreviewed_interna(jsonb)') is null
     or to_regprocedure('public.validate_retailer_offer_sync_batch_read_only(jsonb)') is null
     or to_regprocedure('public.retailer_catalogue_sha256_json(jsonb)') is null then
    raise exception 'automation review owner-decision validator prerequisites are missing';
  end if;
  if to_regprocedure('public.validate_automation_review_owner_decision(jsonb)') is not null then
    raise exception 'automation review owner-decision validator already exists';
  end if;
end
$preflight$;

create function public.validate_automation_review_owner_decision(p_request jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $validate$
declare
  v_contract jsonb:=p_request->'automation_review_execution_contract';
  v_contract_core jsonb;
  v_artifact jsonb:=p_request->'artifact';
  v_base jsonb;
  v_result jsonb;
  v_request public.automation_review_execution_requests%rowtype;
  v_review public.product_match_review_queue%rowtype;
  v_changed jsonb;
  v_changed_count integer;
  v_confirmation_count integer;
begin
  if not public.atomic_import_has_exact_keys(p_request,array[
       'schema_version','kind','artifact','validation_expires_at','production_project_ref',
       'production_database_identity','expected_migration_versions','expected_migration_fingerprint',
       'migration_fingerprint_algorithm','migration_fingerprint_version','code_commit',
       'source_snapshot_fingerprint','policy_fingerprint','action_manifest_fingerprint',
       'artifact_fingerprint','guardrails','batch_fingerprint','package_fingerprint',
       'automation_review_execution_contract'])
     or jsonb_typeof(v_contract) is distinct from 'object'
     or jsonb_typeof(v_artifact) is distinct from 'object'
     or jsonb_typeof(v_artifact->'rows') is distinct from 'array'
     or p_request->>'package_fingerprint'!~'^[0-9a-f]{64}$'
     or public.retailer_catalogue_sha256_json(
          jsonb_set(p_request,'{package_fingerprint}','null'::jsonb,false))
        is distinct from p_request->>'package_fingerprint' then
    perform public.retailer_catalogue_raise(
      'RSBI_SOURCE_SCHEMA_MISMATCH','Invalid automation review validation package');
  end if;

  if not public.atomic_import_has_exact_keys(v_contract,array[
       'schema_version','kind','execution_request_id','review_id','retailer_id','retailer_slug',
       'operation_type','review_fingerprint','plan_fingerprint','idempotency_key','requested_by',
       'requested_at','decision_actor','decision_at','expires_at','artifact_fingerprint','contract_hash'])
     or v_contract->>'schema_version' is distinct from '1'
     or v_contract->>'kind' is distinct from 'automation-review-owner-decision-v1'
     or coalesce(v_contract->>'execution_request_id','')!~'^[0-9a-f-]{36}$'
     or coalesce(v_contract->>'review_id','')!~'^[1-9][0-9]*$'
     or coalesce(v_contract->>'retailer_id','')!~'^[1-9][0-9]*$'
     or coalesce(v_contract->>'review_fingerprint','')!~'^[0-9a-f]{64}$'
     or coalesce(v_contract->>'plan_fingerprint','')!~'^[0-9a-f]{64}$'
     or coalesce(v_contract->>'idempotency_key','')!~'^[0-9a-f]{64}$'
     or coalesce(v_contract->>'artifact_fingerprint','')!~'^[0-9a-f]{64}$'
     or coalesce(v_contract->>'contract_hash','')!~'^[0-9a-f]{64}$' then
    perform public.retailer_catalogue_raise(
      'RSBI_SOURCE_SCHEMA_MISMATCH','Invalid automation review decision contract');
  end if;
  v_contract_core:=v_contract-'contract_hash';
  if public.retailer_catalogue_sha256_json(v_contract_core)
       is distinct from v_contract->>'contract_hash'
     or v_contract->>'artifact_fingerprint' is distinct from p_request->>'artifact_fingerprint'
     or v_contract->>'artifact_fingerprint' is distinct from v_artifact->>'artifact_fingerprint' then
    perform public.retailer_catalogue_raise(
      'RSBI_CHILD_FINGERPRINT_MISMATCH','Automation review contract fingerprint mismatch');
  end if;

  select * into v_request
    from public.automation_review_execution_requests
   where id=(v_contract->>'execution_request_id')::uuid;
  select * into v_review
    from public.product_match_review_queue
   where id=(v_contract->>'review_id')::bigint;
  if v_request.id is null or v_review.id is null
     or v_request.status<>'DISPATCHED'
     or v_review.review_status<>'APPROVED'
     or v_request.review_id<>v_review.id
     or v_request.retailer_id<>v_review.retailer_id
     or v_request.retailer_id::text is distinct from v_contract->>'retailer_id'
     or v_request.retailer_slug is distinct from v_contract->>'retailer_slug'
     or v_request.operation_type is distinct from v_contract->>'operation_type'
     or v_review.operation_type is distinct from v_contract->>'operation_type'
     or v_request.review_fingerprint is distinct from v_contract->>'review_fingerprint'
     or v_review.source_row_fingerprint is distinct from v_contract->>'review_fingerprint'
     or v_request.plan_fingerprint is distinct from v_contract->>'plan_fingerprint'
     or v_review.plan_fingerprint is distinct from v_contract->>'plan_fingerprint'
     or v_request.idempotency_key is distinct from v_contract->>'idempotency_key'
     or v_request.requested_by is distinct from v_contract->>'requested_by'
     or v_request.requested_at is distinct from (v_contract->>'requested_at')::timestamptz
     or v_review.decision_actor is distinct from v_contract->>'decision_actor'
     or v_review.decision_at is distinct from (v_contract->>'decision_at')::timestamptz
     or v_review.expires_at is null
     or v_review.expires_at<=now()
     or (v_contract->>'expires_at')::timestamptz<=now()
     or (v_contract->>'expires_at')::timestamptz>now()+interval '15 minutes'
     or (v_contract->>'expires_at')::timestamptz>v_review.expires_at then
    perform public.retailer_catalogue_raise(
      'RSBI_APPROVAL_MISMATCH','Automation review decision binding mismatch');
  end if;
  if not exists(
    select 1 from public.product_match_review_events event
     where event.review_id=v_review.id
       and event.previous_status='PENDING'
       and event.new_status='APPROVED'
       and event.actor='authenticated-admin'
       and event.source_row_fingerprint=v_review.source_row_fingerprint
       and event.plan_fingerprint=v_review.plan_fingerprint) then
    perform public.retailer_catalogue_raise(
      'RSBI_APPROVAL_MISMATCH','Automation review approval audit is missing');
  end if;

  select count(*) filter(where value->>'action'<>'VERIFY_NO_CHANGE'),
         count(*) filter(where value->>'action'='VERIFY_NO_CHANGE')
    into v_changed_count,v_confirmation_count
    from jsonb_array_elements(v_artifact->'rows') row(value);
  select value into v_changed
    from jsonb_array_elements(v_artifact->'rows') row(value)
   where value->>'action'<>'VERIFY_NO_CHANGE';
  if v_artifact->>'target_environment' is distinct from 'PRODUCTION'
     or v_artifact->>'retailer_id' is distinct from v_contract->>'retailer_id'
     or v_contract->>'operation_type' is distinct from 'UPDATE_STOCK'
     or jsonb_array_length(v_artifact->'rows')<>20
     or v_changed_count<>1 or v_confirmation_count<>19
     or v_changed->>'action' is distinct from 'UPDATE_STOCK'
     or v_changed->>'offer_id' is distinct from v_review.offer_id::text
     or v_changed->>'retailer_product_id' is distinct from v_review.retailer_product_id::text
     or v_changed->>'external_product_id' is distinct from v_review.before_state->>'external_product_id'
     or v_changed->>'external_variant_id' is distinct from v_review.before_state->>'external_variant_id'
     or v_changed#>>'{changed_fields,stock}' is distinct from 'true'
     or v_changed#>>'{changed_fields,price}' is distinct from 'false'
     or v_changed#>>'{changed_fields,url}' is distinct from 'false'
     or v_changed#>>'{atomic_plan,expected_state,product,id}' is distinct from v_review.before_state->>'product_id'
     or v_changed#>>'{atomic_plan,expected_state,product_variant,id}' is distinct from v_review.before_state->>'product_variant_id'
     or v_changed#>>'{atomic_plan,expected_state,retailer_product,id}' is distinct from v_review.before_state->>'retailer_product_id'
     or v_changed#>>'{atomic_plan,expected_state,offer,id}' is distinct from v_review.before_state->>'offer_id'
     or (v_changed#>>'{atomic_plan,expected_state,offer,price}')::numeric is distinct from (v_review.before_state->>'price')::numeric
     or (v_changed#>>'{atomic_plan,offer,values,price}')::numeric is distinct from (v_review.proposed_state->>'price')::numeric
     or (v_changed#>>'{atomic_plan,expected_state,offer,shipping_cost}')::numeric is distinct from (v_review.before_state->>'shipping_cost')::numeric
     or (v_changed#>>'{atomic_plan,offer,values,shipping_cost}')::numeric is distinct from (v_review.proposed_state->>'shipping_cost')::numeric
     or (v_changed#>>'{atomic_plan,expected_state,offer,total_price}')::numeric is distinct from (v_review.before_state->>'total_price')::numeric
     or (v_changed#>>'{atomic_plan,offer,values,total_price}')::numeric is distinct from (v_review.proposed_state->>'total_price')::numeric
     or (v_changed#>>'{atomic_plan,expected_state,offer,in_stock}')::boolean is distinct from (v_review.before_state->>'in_stock')::boolean
     or (v_changed#>>'{atomic_plan,offer,values,in_stock}')::boolean is distinct from (v_review.proposed_state->>'in_stock')::boolean
     or (v_review.before_state->>'in_stock')::boolean is not distinct from (v_review.proposed_state->>'in_stock')::boolean
     or v_changed#>>'{atomic_plan,expected_state,offer,url}' is distinct from v_review.before_state->>'url'
     or v_changed#>>'{atomic_plan,offer,values,url}' is distinct from v_review.proposed_state->>'url'
     or v_review.before_state-'in_stock' is distinct from v_review.proposed_state-'in_stock' then
    perform public.retailer_catalogue_raise(
      'RSBI_APPROVAL_MISMATCH','Automation review exact stock decision does not match the sealed batch');
  end if;

  v_base:=p_request-'automation_review_execution_contract';
  v_base:=jsonb_set(v_base,'{package_fingerprint}','null'::jsonb,false);
  v_base:=jsonb_set(v_base,'{package_fingerprint}',
    to_jsonb(public.retailer_catalogue_sha256_json(v_base)),false);
  v_result:=public.retailer_offer_sync_validate_batch_read_only_unreviewed_interna(v_base);
  return v_result||jsonb_build_object(
    'automation_review_owner_decision',true,
    'execution_request_id',v_request.id::text,
    'review_id',v_review.id::text,
    'contract_hash',v_contract->>'contract_hash');
end
$validate$;

alter function public.validate_automation_review_owner_decision(jsonb) owner to postgres;
revoke all on function public.validate_automation_review_owner_decision(jsonb)
  from public,anon,authenticated,service_role,
       retailer_catalogue_production_approver,retailer_catalogue_production_executor;
grant execute on function public.validate_automation_review_owner_decision(jsonb)
  to retailer_catalogue_production_validator;

create or replace function public.validate_retailer_offer_sync_batch_read_only(p_request jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,pg_temp
as $validate_wrapper$
begin
  if current_user<>'retailer_catalogue_production_validator' then
    perform public.retailer_catalogue_raise(
      'RSBI_ENVIRONMENT_BLOCKED','Production validator role required');
  end if;
  if p_request ? 'automation_review_execution_contract' then
    return public.validate_automation_review_owner_decision(p_request);
  end if;
  return public.retailer_offer_sync_validate_batch_read_only_internal(p_request);
end
$validate_wrapper$;

alter function public.validate_retailer_offer_sync_batch_read_only(jsonb) owner to postgres;
revoke all on function public.validate_retailer_offer_sync_batch_read_only(jsonb)
  from public,anon,authenticated,service_role,
       retailer_catalogue_production_approver,retailer_catalogue_production_executor;
grant execute on function public.validate_retailer_offer_sync_batch_read_only(jsonb)
  to retailer_catalogue_production_validator;

commit;
