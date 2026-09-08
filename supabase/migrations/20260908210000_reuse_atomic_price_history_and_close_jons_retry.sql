begin;

set local lock_timeout='5s';
set local statement_timeout='60s';

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

do $cleanup$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_parent constant uuid:='a5df3061-ee78-49ff-afc0-403ff31c2fae';
  v_parent_fingerprint constant text:='b971d906e190327ed9ff5a3346a021e9bfee358280b956b8661eafc8dcc08743';
  v_open_child constant uuid:='c0c14eb2-3b17-4493-9ece-9c645c771e4e';
  v_open_approval constant uuid:='d54caf10-e290-4711-8cce-fad7b44682bd';
  v_now timestamptz:=clock_timestamp();
  v_before jsonb;
  v_after jsonb;
  v_rows integer;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Jon''s duplicate-history retry cleanup target mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:10',0));
  v_before:=public.retailer_catalogue_business_counts();
  if v_before<>jsonb_build_object('products',1337,'product_variants',3632,'retailer_products',3758,'offers',3758,'price_history',4053) then
    raise exception 'Jon''s duplicate-history retry cleanup catalogue count precondition mismatch';
  end if;

  perform 1 from public.retailer_catalogue_parent_plans p where p.id=v_parent
    and p.parent_plan_fingerprint=v_parent_fingerprint and p.retailer_id=10
    and p.target_environment='PRODUCTION' and p.status='APPROVED'
    and p.code_commit='99c703e2af1ecc1e8e827fb43b1c63381a24ea1a'
    and p.source_snapshot_fingerprint='c672471fb70d6ed0e63f62d0313c52713e003265235a989b36e5afe7f2dd4af2'
    and p.source_captured_at='2026-09-08T20:08:39.871Z'::timestamptz for update;
  if not found then raise exception 'Jon''s duplicate-history retry parent precondition mismatch'; end if;

  if (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent)<>11
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPROVED')<>1
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='PLANNED')<>10
     or exists(select 1 from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id=v_parent)
     or not exists(select 1 from public.retailer_catalogue_child_plans where id=v_open_child and parent_plan_id=v_parent and status='APPROVED' and jsonb_array_length(record_ids)=50)
     or (select count(*) from public.retailer_offer_sync_batch_approvals a where a.id=v_open_approval and a.child_plan_id=v_open_child and a.consumed_at is null and a.closed_at is null)<>1 then
    raise exception 'Jon''s duplicate-history retry child/run/approval precondition mismatch';
  end if;

  update public.retailer_offer_sync_batch_approvals
  set closed_at=v_now,closed_by='supplementscout-owner-approved-six-retailer-recovery',
      close_reason='Unexecuted Jon''s retry superseded after rollback-only duplicate-history diagnosis',
      close_request_fingerprint=encode(extensions.digest(convert_to(id::text||':2026-09-08-price-history-reuse','UTF8'),'sha256'),'hex'),
      close_result=jsonb_build_object('status','SUPERSEDED','approval_id',id,'closed_at',v_now,'business_writes',0,'price_history_writes',0)
  where id=v_open_approval and child_plan_id=v_open_child and consumed_at is null and closed_at is null;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Jon''s duplicate-history approval cleanup affected % rows',v_rows; end if;

  update public.retailer_catalogue_child_plans
  set status='SUPERSEDED',updated_at=v_now,audit_log=audit_log||jsonb_build_array(jsonb_build_object(
    'event','DUPLICATE_HISTORY_RETRY_SUPERSEDED','at',v_now,'authority','owner-approved-chat-2026-09-08-six-retailer-recovery'))
  where parent_plan_id=v_parent and status in ('PLANNED','APPROVED');
  get diagnostics v_rows=row_count;
  if v_rows<>11 then raise exception 'Jon''s duplicate-history child cleanup affected % rows',v_rows; end if;

  update public.retailer_catalogue_parent_plans
  set status='SUPERSEDED',updated_at=v_now,audit_log=audit_log||jsonb_build_array(jsonb_build_object(
    'event','DUPLICATE_HISTORY_RETRY_SUPERSEDED','at',v_now,'authority','owner-approved-chat-2026-09-08-six-retailer-recovery',
    'rollback_only_diagnosis',true,'preserved_business_writes',0))
  where id=v_parent and status='APPROVED';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Jon''s duplicate-history parent cleanup affected % rows',v_rows; end if;

  v_after:=public.retailer_catalogue_business_counts();
  if v_after is distinct from v_before
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='SUPERSEDED')<>11
     or not exists(select 1 from public.retailer_catalogue_parent_plans where id=v_parent and status='SUPERSEDED') then
    raise exception 'Jon''s duplicate-history retry cleanup postcondition mismatch';
  end if;
end
$cleanup$;

alter function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) owner to postgres;
revoke all on function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)
  from public,anon,authenticated,retailer_catalogue_production_approver,retailer_catalogue_production_validator;
grant execute on function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)
  to service_role,retailer_catalogue_production_executor;

commit;
