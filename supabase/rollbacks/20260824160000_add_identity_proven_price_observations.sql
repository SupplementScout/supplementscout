begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback_preflight$
begin
  if to_regclass('public.price_identity_series') is null
     or to_regclass('public.price_observation_producers') is null
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='price_history' and column_name='identity_series_id') then
    raise exception 'identity-proven price observation foundation is not installed';
  end if;
  if exists(select 1 from public.price_history where identity_series_id is not null)
     or exists(select 1 from public.price_identity_series)
     or exists(select 1 from public.price_observation_producers where enabled) then
    raise exception 'rollback blocked after identity-proven accrual or producer enablement; disable producers and preserve evidence';
  end if;
end
$rollback_preflight$;

create or replace function public.apply_approved_product_import_plan(
  p_approval_id uuid,p_artifact_sha256 text,p_plan_fingerprint text,p_source_row_fingerprint text,
  p_retailer_id bigint,p_plan_kind text,p_run_id text) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $apply_approved$
declare v_approval public.approved_import_plans%rowtype;v_result jsonb;v_consumed_at timestamptz;
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
  update public.approved_import_plans set status='consumed',consumed_at=now() where id=v_approval.id returning consumed_at into v_consumed_at;
  return v_result||jsonb_build_object('approval_id',v_approval.id,'approval_status','consumed','consumed_at',v_consumed_at,
    'artifact_sha256',v_approval.artifact_sha256,'run_id',v_approval.run_id,'plan_fingerprint',v_approval.plan_fingerprint,
    'source_row_fingerprint',v_approval.source_row_fingerprint,'retailer_id',v_approval.retailer_id::text,'plan_kind',v_approval.plan_kind);
end
$apply_approved$;

create or replace function public.retailer_catalogue_business_counts()
returns jsonb language sql stable security definer set search_path=pg_catalog,public,pg_temp as $counts$
  select jsonb_build_object(
    'products',(select count(*) from public.products),
    'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'price_history',(select count(*) from public.price_history))
$counts$;

drop function public.record_identity_proven_price_observation(bigint,text,text,text,bigint);
alter table public.approved_import_plans
  drop constraint approved_import_plans_identity_observation_result_check,
  drop column identity_observation_result;
drop trigger price_identity_series_immutable on public.price_identity_series;
drop function public.reject_price_identity_series_mutation();
alter table public.price_history
  drop constraint price_history_identity_series_fkey,
  drop constraint price_history_observation_kind_check,
  drop constraint price_history_currency_check,
  drop constraint price_history_recorder_version_check,
  drop constraint price_history_evidence_status_check,
  drop constraint price_history_source_run_check,
  drop constraint price_history_source_importer_check,
  drop constraint price_history_proven_all_or_none;
drop index public.price_history_source_operation_unique;
drop index public.price_history_daily_confirmation_unique;
drop index public.price_history_proven_status_time_idx;
drop index public.price_history_proven_series_time_idx;
alter table public.price_history
  drop column anomaly_flags,
  drop column evidence_status,
  drop column observation_date,
  drop column recorder_version,
  drop column source_importer,
  drop column source_run_id,
  drop column observation_kind,
  drop column in_stock,
  drop column currency,
  drop column identity_series_id;
drop table public.price_observation_producers;
drop table public.price_identity_series;

alter function public.retailer_catalogue_business_counts() owner to postgres;
alter function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) owner to postgres;
revoke all on function public.retailer_catalogue_business_counts() from public,anon,authenticated,service_role;
revoke all on function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) to service_role;

commit;
