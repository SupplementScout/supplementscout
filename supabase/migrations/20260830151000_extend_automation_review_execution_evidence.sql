begin;

alter table public.product_match_review_queue
  add column plan_fingerprint text,
  add column plan_artifact_sha256 text,
  add column decision_actor text,
  add column decision_at timestamptz,
  add column execution_id text,
  add column execution_run_id text,
  add column execution_started_at timestamptz,
  add column execution_completed_at timestamptz,
  add column execution_error_code text,
  add column execution_error_message text,
  add column superseded_by_review_id bigint references public.product_match_review_queue(id) on delete restrict;

alter table public.product_match_review_queue
  add constraint product_match_review_queue_plan_fingerprint_check check (
    plan_fingerprint is null or plan_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  add constraint product_match_review_queue_plan_artifact_sha256_check check (
    plan_artifact_sha256 is null or plan_artifact_sha256 ~ '^[0-9a-f]{64}$'
  ),
  add constraint product_match_review_queue_execution_id_check check (
    execution_id is null or length(trim(execution_id)) between 1 and 200
  ),
  add constraint product_match_review_queue_execution_timestamps_check check (
    execution_completed_at is null
    or execution_started_at is null
    or execution_completed_at >= execution_started_at
  ),
  add constraint product_match_review_queue_superseded_check check (
    superseded_by_review_id is null or superseded_by_review_id <> id
  );

create index product_match_review_queue_execution_status_idx
  on public.product_match_review_queue (retailer_id, review_status, execution_started_at desc)
  where review_status in ('APPROVED', 'EXECUTING', 'EXECUTED', 'FAILED');

alter table public.product_match_review_events
  add column retailer_id bigint,
  add column offer_id bigint,
  add column previous_status text,
  add column new_status text,
  add column decision text,
  add column plan_fingerprint text,
  add column execution_id text,
  add column run_id text,
  add column error_code text,
  add column blocked_reason text;

alter table public.product_match_review_events
  add constraint product_match_review_events_plan_fingerprint_check check (
    plan_fingerprint is null or plan_fingerprint ~ '^[0-9a-f]{64}$'
  );

create or replace function public.audit_product_match_review_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_type text;
  v_actor text;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'CREATED';
  elsif old.decision is distinct from new.decision
     or old.review_status is distinct from new.review_status then
    v_event_type := case
      when old.decision is distinct from new.decision then 'DECISION_CHANGED'
      else 'STATE_CHANGED'
    end;
  elsif old.source_row_fingerprint is distinct from new.source_row_fingerprint
     or old.source_evidence is distinct from new.source_evidence then
    v_event_type := 'EVIDENCE_REFRESHED';
  else
    return new;
  end if;

  v_actor := coalesce(
    nullif(new.decision_actor, ''),
    nullif(new.reviewed_by, ''),
    current_user
  );
  insert into public.product_match_review_events (
    review_id, event_type, actor, source_row_fingerprint,
    before_snapshot, after_snapshot, retailer_id, offer_id,
    previous_status, new_status, decision, plan_fingerprint,
    execution_id, run_id, error_code, blocked_reason
  ) values (
    new.id, v_event_type, v_actor, new.source_row_fingerprint,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    to_jsonb(new), new.retailer_id, new.offer_id,
    case when tg_op = 'INSERT' then null else old.review_status end,
    new.review_status, new.decision, new.plan_fingerprint,
    new.execution_id, new.execution_run_id, new.execution_error_code,
    new.execution_error_message
  );
  return new;
end;
$$;

alter function public.audit_product_match_review_event() owner to postgres;
revoke all on function public.audit_product_match_review_event() from public, anon, authenticated;
grant execute on function public.audit_product_match_review_event() to service_role;

comment on column public.product_match_review_queue.plan_fingerprint is
  'Fingerprint of a freshly reproduced retailer-specific protected plan. It is not authority to execute by itself.';
comment on column public.product_match_review_queue.execution_id is
  'Coordinator checkpoint identifier. Catalogue writes remain restricted to the existing protected retailer executor.';
comment on column public.product_match_review_queue.superseded_by_review_id is
  'Optional immutable link to a newer evidence version; historical review rows are never deleted.';

commit;
