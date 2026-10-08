begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Restore the immediately preceding executor definition. This rollback changes
-- no catalogue or control rows; it only removes the shared execution lock.
create or replace function public.apply_approved_product_import_plan(
  p_approval_id uuid,p_artifact_sha256 text,p_plan_fingerprint text,p_source_row_fingerprint text,
  p_retailer_id bigint,p_plan_kind text,p_run_id text) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $apply_approved$
declare
  v_approval public.approved_import_plans%rowtype;
  v_result jsonb;
  v_consumed_at timestamptz;
  v_observation jsonb;
  v_kind text;
  v_existing_history_id bigint;
  v_existing_history_count integer;
begin
  select * into v_approval from public.approved_import_plans where id=p_approval_id for update;
  if not found then raise exception 'approved import plan not found'; end if;
  if v_approval.status<>'approved' or v_approval.consumed_at is not null then raise exception 'approved import plan already consumed'; end if;
  if v_approval.expires_at<=now() then raise exception 'approved import plan expired'; end if;
  if v_approval.artifact_sha256 is distinct from p_artifact_sha256 or v_approval.run_id is distinct from p_run_id
     or v_approval.plan_fingerprint is distinct from p_plan_fingerprint or v_approval.source_row_fingerprint is distinct from p_source_row_fingerprint
     or v_approval.retailer_id is distinct from p_retailer_id or v_approval.plan_kind is distinct from p_plan_kind then
    raise exception 'approved import plan metadata mismatch';
  end if;
  if v_approval.plan_fingerprint is distinct from v_approval.plan_json#>>'{meta,plan_fingerprint}'
     or v_approval.source_row_fingerprint is distinct from v_approval.plan_json#>>'{meta,source_row_fingerprint}'
     or v_approval.plan_kind is distinct from v_approval.plan_json#>>'{meta,plan_kind}'
     or v_approval.retailer_id is distinct from nullif(v_approval.plan_json#>>'{retailer,id}','')::bigint
     or md5(public.atomic_import_canonical_json(jsonb_set(v_approval.plan_json,'{meta,plan_fingerprint}','null'::jsonb,false)))<>v_approval.plan_fingerprint then
    raise exception 'approved import plan ledger integrity mismatch';
  end if;

  v_result:=public.apply_product_import_plan(v_approval.plan_json);
  if v_result->>'price_history_action'='create'
     and nullif(v_result->>'price_history_id','') is null then
    select count(*),min(id)
      into v_existing_history_count,v_existing_history_id
    from public.price_history
    where offer_id=(v_result->>'offer_id')::bigint
      and xmin::text::bigint=txid_current()
      and identity_series_id is null;
    if v_existing_history_count<>1 or v_existing_history_id is null then
      perform public.retailer_catalogue_raise(
        'RSBI_EXPECTED_DELTA_MISMATCH',
        'Atomic price change must expose exactly one reusable history row',
        jsonb_build_object('offer_id',v_result->>'offer_id','candidate_count',v_existing_history_count));
    end if;
    v_result:=jsonb_set(v_result,'{price_history_id}',to_jsonb(v_existing_history_id),true);
  end if;

  v_kind:=case
    when v_result->>'offer_action'='create' then 'offer_created'
    when v_result->>'price_history_action'='create' then 'delivered_price_changed'
    else 'daily_confirmation' end;
  v_observation:=public.record_identity_proven_price_observation(
    (v_result->>'offer_id')::bigint,v_kind,v_approval.run_id,v_approval.source,
    nullif(v_result->>'price_history_id','')::bigint);
  if v_observation->>'status'='IDENTITY_OBSERVATION_RECORDED'
     and v_result->>'price_history_id' is null then
    v_result:=jsonb_set(v_result,'{price_history_id}',to_jsonb((v_observation->>'price_history_id')::bigint),true);
  end if;
  update public.approved_import_plans
    set status='consumed',consumed_at=now(),identity_observation_result=v_observation
    where id=v_approval.id returning consumed_at into v_consumed_at;
  return v_result||jsonb_build_object('approval_id',v_approval.id,'approval_status','consumed','consumed_at',v_consumed_at,
    'artifact_sha256',v_approval.artifact_sha256,'run_id',v_approval.run_id,'plan_fingerprint',v_approval.plan_fingerprint,
    'source_row_fingerprint',v_approval.source_row_fingerprint,'retailer_id',v_approval.retailer_id::text,'plan_kind',v_approval.plan_kind,
    'identity_observation',v_observation);
end
$apply_approved$;

do $postflight$
declare
  v_definition text:=pg_get_functiondef(
    'public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)'::regprocedure);
begin
  if position('retailer-offer-sync:global-execution' in v_definition)>0 then
    raise exception 'approved product import executor rollback postflight failed';
  end if;
end
$postflight$;

commit;
