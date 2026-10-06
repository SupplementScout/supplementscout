begin;

create function public.reconcile_automation_review_verified_postflight(
  p_execution_request_id uuid,
  p_actor text,
  p_evidence jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.automation_review_execution_requests%rowtype;
  v_review public.product_match_review_queue%rowtype;
  v_offer public.offers%rowtype;
  v_mapping public.retailer_products%rowtype;
  v_result jsonb;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'AUTOMATION_RECOVERY_SERVICE_ROLE_REQUIRED'; end if;
  if coalesce(trim(p_actor),'') = '' then raise exception 'AUTOMATION_RECOVERY_ACTOR_REQUIRED'; end if;
  if p_evidence is null or jsonb_typeof(p_evidence) <> 'object'
     or p_evidence->>'kind' <> 'automation-review-verified-postflight-recovery-v1'
     or p_evidence->>'idempotency_result' <> 'PASS'
     or coalesce(p_evidence->>'database_writes','') !~ '^[1-9][0-9]*$'
     or coalesce(p_evidence->>'baseline_hash','') !~ '^[0-9a-f]{64}$'
     or coalesce(p_evidence->>'postflight_hash','') !~ '^[0-9a-f]{64}$'
     or coalesce(p_evidence->>'recovery_commit_sha','') !~ '^[0-9a-f]{40}$'
     or coalesce(p_evidence->>'recovery_run_id','') !~ '^[1-9][0-9]*$' then
    raise exception 'AUTOMATION_RECOVERY_EVIDENCE_INVALID';
  end if;

  select * into v_request
  from public.automation_review_execution_requests
  where id=p_execution_request_id
  for update;
  if not found then raise exception 'AUTOMATION_RECOVERY_REQUEST_NOT_FOUND'; end if;

  select * into v_review
  from public.product_match_review_queue
  where id=v_request.review_id
  for update;
  if not found then raise exception 'AUTOMATION_RECOVERY_REVIEW_NOT_FOUND'; end if;

  if v_request.status <> 'FAILED' or v_request.last_checkpoint <> 'EXECUTION_FAILED'
     or coalesce(v_request.database_writes,0) <= 0
     or v_review.review_status <> 'FAILED'
     or v_review.execution_id is distinct from v_request.id::text
     or v_request.review_fingerprint is distinct from v_review.source_row_fingerprint
     or v_request.plan_fingerprint is distinct from v_review.plan_fingerprint
     or v_request.operation_type <> 'UPDATE_STOCK'
     or v_review.operation_type <> 'UPDATE_STOCK' then
    raise exception 'AUTOMATION_RECOVERY_STATE_INVALID';
  end if;
  if (p_evidence->>'database_writes')::integer <> v_request.database_writes
     or p_evidence->>'original_run_id' is distinct from v_request.run_id
     or p_evidence->>'original_commit_sha' is distinct from v_request.commit_sha
     or p_evidence->>'baseline_hash' is distinct from v_request.before_state_hash then
    raise exception 'AUTOMATION_RECOVERY_REQUEST_BINDING_DRIFT';
  end if;
  if not exists (
    select 1 from public.automation_review_execution_events e
    where e.execution_request_id=v_request.id and e.previous_status='EXECUTING'
      and e.new_status='FAILED' and e.checkpoint='EXECUTION_FAILED'
      and (e.evidence->>'database_writes')::integer=v_request.database_writes
  ) then raise exception 'AUTOMATION_RECOVERY_FAILED_EVENT_MISSING'; end if;
  if exists (
    select 1 from public.automation_review_execution_requests later
    where later.review_id=v_request.review_id and later.requested_at>v_request.requested_at
  ) then raise exception 'AUTOMATION_RECOVERY_LATER_REQUEST_EXISTS'; end if;

  if jsonb_typeof(p_evidence->'executed_offer_ids') is distinct from 'array'
     or jsonb_array_length(p_evidence->'executed_offer_ids') <> 1
     or p_evidence#>>'{executed_offer_ids,0}' is distinct from v_review.offer_id::text
     or jsonb_typeof(p_evidence->'freshness_confirmation_offer_ids') is distinct from 'array'
     or jsonb_array_length(p_evidence->'freshness_confirmation_offer_ids') <> 19
     or exists (
       select 1 from jsonb_array_elements_text(p_evidence->'freshness_confirmation_offer_ids') x
       where x.value=v_review.offer_id::text
     )
     or (select count(distinct x.value) from jsonb_array_elements_text(p_evidence->'freshness_confirmation_offer_ids') x) <> 19 then
    raise exception 'AUTOMATION_RECOVERY_SCOPE_INVALID';
  end if;
  if p_evidence#>>'{actual_deltas,stock}' is distinct from '1'
     or p_evidence#>>'{actual_deltas,freshness}' is distinct from '20'
     or coalesce((p_evidence#>>'{actual_deltas,price}')::integer,-1) <> 0
     or coalesce((p_evidence#>>'{actual_deltas,shipping}')::integer,-1) <> 0
     or coalesce((p_evidence#>>'{actual_deltas,total}')::integer,-1) <> 0
     or coalesce((p_evidence#>>'{actual_deltas,offer_url}')::integer,-1) <> 0
     or coalesce((p_evidence#>>'{actual_deltas,mapping_url}')::integer,-1) <> 0
     or coalesce((p_evidence->>'price_history_delta')::integer,-1) <> 0 then
    raise exception 'AUTOMATION_RECOVERY_DELTA_INVALID';
  end if;

  select * into v_offer from public.offers where id=v_review.offer_id;
  if not found then raise exception 'AUTOMATION_RECOVERY_OFFER_MISSING'; end if;
  select * into v_mapping from public.retailer_products where id=v_offer.retailer_product_id;
  if not found then raise exception 'AUTOMATION_RECOVERY_MAPPING_MISSING'; end if;
  if v_offer.retailer_id is distinct from v_request.retailer_id
     or v_offer.retailer_product_id::text is distinct from v_review.proposed_state->>'retailer_product_id'
     or v_offer.product_id::text is distinct from v_review.proposed_state->>'product_id'
     or v_offer.product_variant_id::text is distinct from v_review.proposed_state->>'product_variant_id'
     or v_offer.price is distinct from (v_review.proposed_state->>'price')::numeric
     or v_offer.shipping_cost is distinct from (v_review.proposed_state->>'shipping_cost')::numeric
     or v_offer.total_price is distinct from (v_review.proposed_state->>'total_price')::numeric
     or v_offer.in_stock is distinct from (v_review.proposed_state->>'in_stock')::boolean
     or v_offer.url is distinct from v_review.proposed_state->>'url'
     or v_mapping.external_product_id is distinct from v_review.proposed_state->>'external_product_id'
     or v_mapping.external_variant_id is distinct from v_review.proposed_state->>'external_variant_id'
     or v_mapping.external_url is distinct from v_review.proposed_state->>'external_url' then
    raise exception 'AUTOMATION_RECOVERY_CURRENT_STATE_DRIFT';
  end if;

  update public.automation_review_execution_requests as recovered set
    status='EXECUTED',
    postflight_hash=p_evidence->>'postflight_hash',
    executed_offer_ids=p_evidence->'executed_offer_ids',
    failed_offer_ids='[]'::jsonb,
    remaining_offer_ids='[]'::jsonb,
    actual_deltas=p_evidence->'actual_deltas',
    price_history_delta=(p_evidence->>'price_history_delta')::integer,
    idempotency_result='PASS',
    last_checkpoint='VERIFIED_POSTFLIGHT_RECOVERY',
    error_code=null,
    error_message=null,
    completed_at=now(),
    updated_at=now()
  where recovered.id=v_request.id
  returning to_jsonb(recovered) into v_result;

  update public.product_match_review_queue set
    review_status='EXECUTED',
    execution_run_id=p_evidence->>'recovery_run_id',
    execution_error_code=null,
    execution_error_message=null,
    execution_completed_at=now(),
    updated_at=now()
  where id=v_review.id and review_status='FAILED';
  if not found then raise exception 'AUTOMATION_RECOVERY_REVIEW_TRANSITION_FAILED'; end if;

  insert into public.automation_review_execution_events(
    execution_request_id,review_id,actor,previous_status,new_status,checkpoint,evidence
  ) values (
    v_request.id,v_review.id,p_actor,'FAILED','EXECUTED','VERIFIED_POSTFLIGHT_RECOVERY',p_evidence
  );
  return v_result;
end;
$$;

revoke all on function public.reconcile_automation_review_verified_postflight(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.reconcile_automation_review_verified_postflight(uuid,text,jsonb) to service_role;

comment on function public.reconcile_automation_review_verified_postflight(uuid,text,jsonb) is
  'Control-only recovery after a bounded Review Queue apply passed exact postflight and fresh-source idempotency but its request was already marked failed. Performs no catalogue write and forbids replay.';

commit;
