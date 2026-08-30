begin;

create table public.automation_review_execution_requests (
  id uuid primary key default gen_random_uuid(),
  review_id bigint not null references public.product_match_review_queue(id) on delete restrict,
  retailer_id bigint not null,
  retailer_slug text not null,
  operation_type text not null,
  review_fingerprint text not null,
  plan_fingerprint text not null,
  workflow_name text not null,
  environment_name text not null,
  execution_mode text not null,
  idempotency_key text not null unique,
  requested_by text not null,
  requested_at timestamptz not null default now(),
  status text not null default 'QUEUED',
  run_id text,
  run_url text,
  commit_sha text,
  manifest_sha256 text,
  before_state_hash text,
  postflight_hash text,
  executed_offer_ids jsonb,
  failed_offer_ids jsonb,
  remaining_offer_ids jsonb,
  expected_deltas jsonb,
  actual_deltas jsonb,
  price_history_delta integer,
  database_writes integer,
  idempotency_result text,
  last_checkpoint text,
  error_code text,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automation_review_execution_fingerprint_check check (
    review_fingerprint ~ '^[0-9a-f]{64}$' and plan_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint automation_review_execution_idempotency_check check (idempotency_key ~ '^[0-9a-f]{64}$'),
  constraint automation_review_execution_status_check check (
    status in ('QUEUED','DISPATCHED','EXECUTING','EXECUTED','FAILED','EXPIRED')
  ),
  constraint automation_review_execution_mode_check check (execution_mode = 'review-queue'),
  constraint automation_review_execution_nonnegative_check check (
    (price_history_delta is null or price_history_delta >= 0) and
    (database_writes is null or database_writes >= 0)
  )
);

create unique index automation_review_execution_active_review_idx
  on public.automation_review_execution_requests (review_id, review_fingerprint)
  where status in ('QUEUED','DISPATCHED','EXECUTING');

create index automation_review_execution_history_idx
  on public.automation_review_execution_requests (review_id, requested_at desc);

create table public.automation_review_execution_events (
  id bigint generated always as identity primary key,
  execution_request_id uuid not null references public.automation_review_execution_requests(id) on delete restrict,
  review_id bigint not null references public.product_match_review_queue(id) on delete restrict,
  actor text not null,
  previous_status text,
  new_status text not null,
  checkpoint text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index automation_review_execution_events_request_idx
  on public.automation_review_execution_events (execution_request_id, created_at, id);

alter table public.automation_review_execution_requests enable row level security;
alter table public.automation_review_execution_events enable row level security;
alter table public.automation_review_execution_requests force row level security;
alter table public.automation_review_execution_events force row level security;
revoke all on table public.automation_review_execution_requests from public, anon, authenticated, service_role;
revoke all on table public.automation_review_execution_events from public, anon, authenticated, service_role;
revoke all on sequence public.automation_review_execution_events_id_seq from public, anon, authenticated, service_role;
grant select on table public.automation_review_execution_requests to service_role;
grant select on table public.automation_review_execution_events to service_role;

create or replace function public.protect_automation_review_execution_request_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.review_id is distinct from new.review_id
     or old.retailer_id is distinct from new.retailer_id
     or old.retailer_slug is distinct from new.retailer_slug
     or old.operation_type is distinct from new.operation_type
     or old.review_fingerprint is distinct from new.review_fingerprint
     or old.plan_fingerprint is distinct from new.plan_fingerprint
     or old.workflow_name is distinct from new.workflow_name
     or old.environment_name is distinct from new.environment_name
     or old.execution_mode is distinct from new.execution_mode
     or old.idempotency_key is distinct from new.idempotency_key
     or old.requested_by is distinct from new.requested_by
     or old.requested_at is distinct from new.requested_at then
    raise exception 'AUTOMATION_EXECUTION_REQUEST_IDENTITY_IMMUTABLE';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger protect_automation_review_execution_request_identity
before update on public.automation_review_execution_requests
for each row execute function public.protect_automation_review_execution_request_identity();

create or replace function public.queue_automation_review_execution(
  p_review_id bigint,
  p_review_fingerprint text,
  p_requested_by text,
  p_retailer_slug text,
  p_workflow_name text,
  p_environment_name text,
  p_execution_mode text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.product_match_review_queue%rowtype;
  v_request public.automation_review_execution_requests%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'AUTOMATION_EXECUTION_SERVICE_ROLE_REQUIRED'; end if;
  if coalesce(trim(p_requested_by),'') = '' then raise exception 'AUTOMATION_EXECUTION_ACTOR_REQUIRED'; end if;
  select * into v_review from public.product_match_review_queue where id=p_review_id for update;
  if not found then raise exception 'AUTOMATION_REVIEW_NOT_FOUND'; end if;
  if v_review.review_status <> 'APPROVED' then raise exception 'AUTOMATION_REVIEW_NOT_APPROVED'; end if;
  if v_review.expires_at is null or v_review.expires_at <= now() then raise exception 'AUTOMATION_REVIEW_EXPIRED'; end if;
  if v_review.source_row_fingerprint <> p_review_fingerprint then raise exception 'AUTOMATION_REVIEW_FINGERPRINT_DRIFT'; end if;
  if v_review.plan_fingerprint is null then raise exception 'AUTOMATION_REVIEW_PLAN_FINGERPRINT_MISSING'; end if;
  if coalesce(trim(v_review.decision_actor),'') = '' or v_review.decision_at is null then raise exception 'AUTOMATION_REVIEW_APPROVAL_AUDIT_MISSING'; end if;

  select * into v_request
    from public.automation_review_execution_requests
   where review_id=p_review_id and review_fingerprint=p_review_fingerprint
     and status in ('QUEUED','DISPATCHED','EXECUTING')
   order by requested_at desc limit 1;
  if found then
    return jsonb_build_object('execution_request_id',v_request.id,'status',v_request.status,'already_queued',true,'idempotency_key',v_request.idempotency_key);
  end if;

  insert into public.automation_review_execution_requests (
    review_id,retailer_id,retailer_slug,operation_type,review_fingerprint,plan_fingerprint,
    workflow_name,environment_name,execution_mode,idempotency_key,requested_by
  ) values (
    v_review.id,v_review.retailer_id,p_retailer_slug,v_review.operation_type,
    v_review.source_row_fingerprint,v_review.plan_fingerprint,p_workflow_name,
    p_environment_name,p_execution_mode,p_idempotency_key,p_requested_by
  ) returning * into v_request;
  insert into public.automation_review_execution_events (
    execution_request_id,review_id,actor,previous_status,new_status,checkpoint,evidence
  ) values (v_request.id,v_review.id,p_requested_by,null,'QUEUED','REQUEST_CREATED',jsonb_build_object('idempotency_key',p_idempotency_key));
  return jsonb_build_object('execution_request_id',v_request.id,'status',v_request.status,'already_queued',false,'idempotency_key',v_request.idempotency_key);
end;
$$;

create or replace function public.record_automation_review_execution_checkpoint(
  p_execution_request_id uuid,
  p_actor text,
  p_new_status text,
  p_checkpoint text,
  p_evidence jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.automation_review_execution_requests%rowtype;
  v_previous text;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'AUTOMATION_EXECUTION_SERVICE_ROLE_REQUIRED'; end if;
  if p_new_status not in ('DISPATCHED','EXECUTING','EXECUTED','FAILED','EXPIRED') then raise exception 'AUTOMATION_EXECUTION_STATUS_INVALID'; end if;
  select * into v_request from public.automation_review_execution_requests where id=p_execution_request_id for update;
  if not found then raise exception 'AUTOMATION_EXECUTION_REQUEST_NOT_FOUND'; end if;
  v_previous := v_request.status;
  if not (
    (v_previous='QUEUED' and p_new_status in ('DISPATCHED','FAILED','EXPIRED')) or
    (v_previous='DISPATCHED' and p_new_status in ('EXECUTING','FAILED','EXPIRED')) or
    (v_previous='EXECUTING' and p_new_status in ('EXECUTED','FAILED','EXPIRED')) or
    (v_previous=p_new_status)
  ) then raise exception 'AUTOMATION_EXECUTION_TRANSITION_INVALID'; end if;

  update public.automation_review_execution_requests set
    status=p_new_status,
    run_id=coalesce(p_evidence->>'run_id',run_id),
    run_url=coalesce(p_evidence->>'run_url',run_url),
    commit_sha=coalesce(p_evidence->>'commit_sha',commit_sha),
    manifest_sha256=coalesce(p_evidence->>'manifest_sha256',manifest_sha256),
    before_state_hash=coalesce(p_evidence->>'before_state_hash',before_state_hash),
    postflight_hash=coalesce(p_evidence->>'postflight_hash',postflight_hash),
    executed_offer_ids=coalesce(p_evidence->'executed_offer_ids',executed_offer_ids),
    failed_offer_ids=coalesce(p_evidence->'failed_offer_ids',failed_offer_ids),
    remaining_offer_ids=coalesce(p_evidence->'remaining_offer_ids',remaining_offer_ids),
    expected_deltas=coalesce(p_evidence->'expected_deltas',expected_deltas),
    actual_deltas=coalesce(p_evidence->'actual_deltas',actual_deltas),
    price_history_delta=coalesce((p_evidence->>'price_history_delta')::integer,price_history_delta),
    database_writes=coalesce((p_evidence->>'database_writes')::integer,database_writes),
    idempotency_result=coalesce(p_evidence->>'idempotency_result',idempotency_result),
    last_checkpoint=p_checkpoint,
    error_code=coalesce(p_evidence->>'error_code',error_code),
    error_message=coalesce(p_evidence->>'error_message',error_message),
    completed_at=case when p_new_status in ('EXECUTED','FAILED','EXPIRED') then now() else completed_at end
  where id=p_execution_request_id returning * into v_request;

  if p_new_status='EXECUTING' then
    update public.product_match_review_queue set review_status='EXECUTING',execution_id=v_request.id::text,execution_started_at=coalesce(execution_started_at,now()) where id=v_request.review_id and review_status='APPROVED';
  elsif p_new_status='EXECUTED' then
    update public.product_match_review_queue set review_status='EXECUTED',execution_run_id=v_request.run_id,execution_completed_at=now() where id=v_request.review_id and review_status='EXECUTING';
  elsif p_new_status='EXPIRED' then
    update public.product_match_review_queue set review_status='EXPIRED',execution_error_code=coalesce(v_request.error_code,'FAILED_REVALIDATION'),execution_error_message=v_request.error_message,execution_completed_at=now() where id=v_request.review_id and review_status in ('APPROVED','EXECUTING');
  elsif p_new_status='FAILED' and v_previous='EXECUTING' then
    update public.product_match_review_queue set review_status='FAILED',execution_error_code=v_request.error_code,execution_error_message=v_request.error_message,execution_completed_at=now() where id=v_request.review_id and review_status='EXECUTING';
  end if;

  insert into public.automation_review_execution_events (
    execution_request_id,review_id,actor,previous_status,new_status,checkpoint,evidence
  ) values (v_request.id,v_request.review_id,p_actor,v_previous,p_new_status,p_checkpoint,coalesce(p_evidence,'{}'::jsonb));
  return to_jsonb(v_request);
end;
$$;

revoke all on function public.protect_automation_review_execution_request_identity() from public, anon, authenticated, service_role;
revoke all on function public.queue_automation_review_execution(bigint,text,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.record_automation_review_execution_checkpoint(uuid,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.queue_automation_review_execution(bigint,text,text,text,text,text,text,text) to service_role;
grant execute on function public.record_automation_review_execution_checkpoint(uuid,text,text,text,jsonb) to service_role;

comment on table public.automation_review_execution_requests is 'Control-plane execution requests. Immutable scope fields are not catalogue write authority.';
comment on table public.automation_review_execution_events is 'Append-only execution lifecycle evidence for Review Queue requests.';

commit;
