begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Trust model: service_role is a trusted backend administrator. The ledger binds
-- an operator-reviewed dry-run artifact to one plan and prevents accidental
-- cross-record apply, changed artifacts, replay and stale-state writes. It is not
-- a cryptographic boundary against a malicious holder of service_role credentials.
create table if not exists public.approved_import_plans (
  id uuid primary key default gen_random_uuid(),
  artifact_sha256 text not null check (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  run_id text not null check (run_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'),
  plan_fingerprint text not null check (plan_fingerprint ~ '^[0-9a-f]{32}$'),
  source_row_fingerprint text not null check (source_row_fingerprint ~ '^[0-9a-f]{64}$'),
  plan_kind text not null check (plan_kind in ('feed', 'manual')),
  retailer_id bigint references public.retailers(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  source text not null,
  plan_json jsonb not null,
  status text not null default 'approved' check (status in ('approved', 'consumed')),
  constraint approved_import_plans_expiry check (expires_at > created_at),
  constraint approved_import_plans_consumption check (
    (status = 'approved' and consumed_at is null)
    or (status = 'consumed' and consumed_at is not null)
  )
);

alter table public.approved_import_plans owner to postgres;
alter table public.approved_import_plans enable row level security;
alter table public.approved_import_plans force row level security;
revoke all on table public.approved_import_plans from public, anon, authenticated, service_role;

create index if not exists approved_import_plans_expiry_idx
  on public.approved_import_plans(status, expires_at);
create index if not exists approved_import_plans_artifact_idx
  on public.approved_import_plans(artifact_sha256, plan_fingerprint);

drop function if exists public.approve_product_import_plan(jsonb, text, timestamptz);
drop function if exists public.apply_approved_product_import_plan(uuid);

create or replace function public.approve_product_import_plan(
  p_plan jsonb,
  p_artifact_sha256 text,
  p_run_id text,
  p_source text default 'supplementscout_importer',
  p_expires_at timestamptz default (now() + interval '15 minutes')
) returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $approve_import$
declare
  v_plan_fingerprint text;
  v_source_fingerprint text;
  v_plan_kind text;
  v_retailer_id bigint;
  v_id uuid;
begin
  if p_artifact_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'approval requires a valid artifact SHA-256';
  end if;
  if p_run_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$' then
    raise exception 'approval requires a valid run ID';
  end if;
  if nullif(trim(p_source), '') is null then
    raise exception 'approval source is required';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '24 hours' then
    raise exception 'approval expiry must be within the next 24 hours';
  end if;

  -- This helper is strictly read-only: it validates the closed schema,
  -- fingerprints, semantics and current expected state without executing writes.
  perform public.validate_product_import_plan_read_only(p_plan);
  v_plan_fingerprint := p_plan#>>'{meta,plan_fingerprint}';
  v_source_fingerprint := p_plan#>>'{meta,source_row_fingerprint}';
  v_plan_kind := p_plan#>>'{meta,plan_kind}';
  v_retailer_id := nullif(p_plan#>>'{retailer,id}', '')::bigint;

  insert into public.approved_import_plans(
    artifact_sha256, run_id, plan_fingerprint, source_row_fingerprint,
    plan_kind, retailer_id, expires_at, source, plan_json
  ) values (
    p_artifact_sha256, p_run_id, v_plan_fingerprint, v_source_fingerprint,
    v_plan_kind, v_retailer_id, p_expires_at, trim(p_source), p_plan
  ) returning id into v_id;

  return jsonb_build_object(
    'approval_id', v_id,
    'artifact_sha256', p_artifact_sha256,
    'run_id', p_run_id,
    'plan_fingerprint', v_plan_fingerprint,
    'source_row_fingerprint', v_source_fingerprint,
    'retailer_id', v_retailer_id::text,
    'plan_kind', v_plan_kind,
    'expires_at', p_expires_at,
    'status', 'approved'
  );
end;
$approve_import$;

create or replace function public.apply_approved_product_import_plan(
  p_approval_id uuid,
  p_artifact_sha256 text,
  p_plan_fingerprint text,
  p_source_row_fingerprint text,
  p_retailer_id bigint,
  p_plan_kind text,
  p_run_id text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $apply_approved_import$
declare
  v_approval public.approved_import_plans%rowtype;
  v_result jsonb;
  v_consumed_at timestamptz;
begin
  select * into v_approval
  from public.approved_import_plans
  where id = p_approval_id
  for update;

  if not found then raise exception 'approved import plan not found'; end if;
  if v_approval.status <> 'approved' or v_approval.consumed_at is not null then
    raise exception 'approved import plan already consumed';
  end if;
  if v_approval.expires_at <= now() then raise exception 'approved import plan expired'; end if;

  if v_approval.artifact_sha256 is distinct from p_artifact_sha256
    or v_approval.run_id is distinct from p_run_id
    or v_approval.plan_fingerprint is distinct from p_plan_fingerprint
    or v_approval.source_row_fingerprint is distinct from p_source_row_fingerprint
    or v_approval.retailer_id is distinct from p_retailer_id
    or v_approval.plan_kind is distinct from p_plan_kind then
    raise exception 'approved import plan metadata mismatch';
  end if;
  if v_approval.plan_fingerprint is distinct from v_approval.plan_json#>>'{meta,plan_fingerprint}'
    or v_approval.source_row_fingerprint is distinct from v_approval.plan_json#>>'{meta,source_row_fingerprint}'
    or v_approval.plan_kind is distinct from v_approval.plan_json#>>'{meta,plan_kind}'
    or v_approval.retailer_id is distinct from nullif(v_approval.plan_json#>>'{retailer,id}', '')::bigint
    or md5(public.atomic_import_canonical_json(
      jsonb_set(v_approval.plan_json, '{meta,plan_fingerprint}', 'null'::jsonb, false)
    )) <> v_approval.plan_fingerprint then
    raise exception 'approved import plan ledger integrity mismatch';
  end if;

  v_result := public.apply_product_import_plan(v_approval.plan_json);
  update public.approved_import_plans
  set status = 'consumed', consumed_at = now()
  where id = v_approval.id
  returning consumed_at into v_consumed_at;

  return v_result || jsonb_build_object(
    'approval_id', v_approval.id,
    'approval_status', 'consumed',
    'consumed_at', v_consumed_at,
    'artifact_sha256', v_approval.artifact_sha256,
    'run_id', v_approval.run_id,
    'plan_fingerprint', v_approval.plan_fingerprint,
    'source_row_fingerprint', v_approval.source_row_fingerprint,
    'retailer_id', v_approval.retailer_id::text,
    'plan_kind', v_approval.plan_kind
  );
end;
$apply_approved_import$;

alter function public.approve_product_import_plan(jsonb, text, text, text, timestamptz) owner to postgres;
alter function public.apply_approved_product_import_plan(uuid, text, text, text, bigint, text, text) owner to postgres;

revoke all on function public.apply_product_import_plan(jsonb) from service_role;
revoke all on function public.approve_product_import_plan(jsonb, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_approved_product_import_plan(uuid, text, text, text, bigint, text, text) from public, anon, authenticated;
grant execute on function public.approve_product_import_plan(jsonb, text, text, text, timestamptz) to service_role;
grant execute on function public.apply_approved_product_import_plan(uuid, text, text, text, bigint, text, text) to service_role;

commit;
