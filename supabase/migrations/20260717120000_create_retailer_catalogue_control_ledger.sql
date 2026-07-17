begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.retailer_catalogue_parent_plans (
  id uuid primary key default gen_random_uuid(),
  parent_plan_fingerprint text not null unique check (parent_plan_fingerprint ~ '^[0-9a-f]{64}$'),
  retailer_id bigint not null,
  target_environment text not null check (target_environment in ('LOCAL_POSTGRES','DRY_RUN')),
  source_snapshot_fingerprint text not null check (source_snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  canonical_snapshot_fingerprint text not null check (canonical_snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  adapter_fingerprint text not null check (adapter_fingerprint ~ '^[0-9a-f]{64}$'),
  policy_fingerprint text not null check (policy_fingerprint ~ '^[0-9a-f]{64}$'),
  code_commit text not null check (code_commit ~ '^[0-9a-f]{40}$'),
  expected_state_fingerprint text not null check (expected_state_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'PLANNED' check (status in ('PLANNED','APPROVED','PARTIALLY_APPLIED','COMPLETED','FAILED','ROLLED_BACK','EXPIRED','SUPERSEDED')),
  expected_deltas jsonb not null check (jsonb_typeof(expected_deltas) = 'object'),
  plan_json jsonb not null check (jsonb_typeof(plan_json) = 'object'),
  child_manifest jsonb not null default '[]'::jsonb check (jsonb_typeof(child_manifest) = 'array'),
  rollback_manifest jsonb not null check (jsonb_typeof(rollback_manifest) = 'object'),
  source_captured_at timestamptz not null,
  canonical_snapshot_at timestamptz not null,
  approval_id uuid unique,
  approved_by text,
  approved_at timestamptz,
  approval_expires_at timestamptz,
  approval_consumed_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  audit_log jsonb not null default '[]'::jsonb check (jsonb_typeof(audit_log) = 'array'),
  constraint retailer_catalogue_parent_approval_state check (
    (approval_id is null and approved_by is null and approved_at is null and approval_expires_at is null and status in ('PLANNED','EXPIRED','SUPERSEDED'))
    or (approval_id is not null and approved_by is not null and approved_at is not null and approval_expires_at > approved_at)
  )
);

create table if not exists public.retailer_catalogue_child_plans (
  id uuid primary key,
  parent_plan_id uuid not null references public.retailer_catalogue_parent_plans(id) on delete restrict,
  retailer_id bigint not null,
  target_environment text not null check (target_environment in ('LOCAL_POSTGRES','DRY_RUN')),
  child_plan_fingerprint text not null unique check (child_plan_fingerprint ~ '^[0-9a-f]{64}$'),
  parent_plan_fingerprint text not null check (parent_plan_fingerprint ~ '^[0-9a-f]{64}$'),
  source_snapshot_fingerprint text not null check (source_snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  canonical_snapshot_fingerprint text not null check (canonical_snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  adapter_fingerprint text not null check (adapter_fingerprint ~ '^[0-9a-f]{64}$'),
  policy_fingerprint text not null check (policy_fingerprint ~ '^[0-9a-f]{64}$'),
  code_commit text not null check (code_commit ~ '^[0-9a-f]{40}$'),
  expected_state_fingerprint text not null check (expected_state_fingerprint ~ '^[0-9a-f]{64}$'),
  batch_index integer not null check (batch_index >= 0),
  batch_count integer not null check (batch_count >= 1),
  dependency_group text not null check (length(dependency_group) between 1 and 4096),
  rollback_group text not null check (length(rollback_group) between 1 and 4096),
  record_ids jsonb not null check (jsonb_typeof(record_ids) = 'array' and jsonb_array_length(record_ids) between 1 and 100),
  status text not null default 'PLANNED' check (status in ('PLANNED','APPROVED','APPLYING','APPLIED','FAILED','ROLLED_BACK','EXPIRED','SUPERSEDED')),
  expected_deltas jsonb not null check (jsonb_typeof(expected_deltas) = 'object'),
  plan_json jsonb not null check (jsonb_typeof(plan_json) = 'object'),
  rollback_manifest jsonb not null check (jsonb_typeof(rollback_manifest) = 'array'),
  approval_id uuid unique,
  approved_at timestamptz,
  approval_expires_at timestamptz,
  approval_consumed_at timestamptz,
  rollback_requested_at timestamptz,
  rollback_requested_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  audit_log jsonb not null default '[]'::jsonb check (jsonb_typeof(audit_log) = 'array'),
  constraint retailer_catalogue_child_parent_batch unique(parent_plan_id, batch_index),
  constraint retailer_catalogue_child_approval_state check (
    (approval_id is null and approved_at is null and approval_expires_at is null and status in ('PLANNED','EXPIRED','SUPERSEDED'))
    or (approval_id is not null and approved_at is not null and approval_expires_at > approved_at)
  )
);

create table if not exists public.retailer_catalogue_apply_runs (
  id uuid primary key default gen_random_uuid(),
  parent_plan_id uuid not null references public.retailer_catalogue_parent_plans(id) on delete restrict,
  child_plan_id uuid not null references public.retailer_catalogue_child_plans(id) on delete restrict,
  retailer_id bigint not null,
  target_environment text not null check (target_environment in ('LOCAL_POSTGRES','DRY_RUN')),
  run_type text not null default 'APPLY' check (run_type in ('APPLY','ROLLBACK')),
  attempt_ordinal integer not null check (attempt_ordinal >= 1),
  status text not null default 'STARTED' check (status in ('STARTED','SUCCEEDED','FAILED','ROLLED_BACK')),
  parent_plan_fingerprint text not null check (parent_plan_fingerprint ~ '^[0-9a-f]{64}$'),
  child_plan_fingerprint text not null check (child_plan_fingerprint ~ '^[0-9a-f]{64}$'),
  source_snapshot_fingerprint text not null check (source_snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  canonical_snapshot_fingerprint text not null check (canonical_snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  adapter_fingerprint text not null check (adapter_fingerprint ~ '^[0-9a-f]{64}$'),
  policy_fingerprint text not null check (policy_fingerprint ~ '^[0-9a-f]{64}$'),
  code_commit text not null check (code_commit ~ '^[0-9a-f]{40}$'),
  expected_state_fingerprint text not null check (expected_state_fingerprint ~ '^[0-9a-f]{64}$'),
  approval_id uuid not null,
  approval_expires_at timestamptz not null,
  rollback_fingerprint text check (rollback_fingerprint is null or rollback_fingerprint ~ '^[0-9a-f]{64}$'),
  rollback_manifest jsonb not null default '[]'::jsonb check (jsonb_typeof(rollback_manifest) = 'array'),
  before_counts jsonb not null default '{}'::jsonb check (jsonb_typeof(before_counts) = 'object'),
  after_counts jsonb check (after_counts is null or jsonb_typeof(after_counts) = 'object'),
  expected_deltas jsonb not null check (jsonb_typeof(expected_deltas) = 'object'),
  result_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(result_metadata) = 'object'),
  started_by text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text check (error_code is null or error_code ~ '^RSBI_[A-Z_]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  audit_log jsonb not null default '[]'::jsonb check (jsonb_typeof(audit_log) = 'array'),
  constraint retailer_catalogue_apply_run_attempt unique(child_plan_id, run_type, attempt_ordinal),
  constraint retailer_catalogue_apply_run_terminal check (
    (status = 'STARTED' and completed_at is null and error_code is null)
    or (status = 'SUCCEEDED' and completed_at is not null and error_code is null)
    or (status = 'FAILED' and completed_at is not null and error_code is not null)
    or (status = 'ROLLED_BACK' and completed_at is not null)
  )
);

alter table public.retailer_catalogue_parent_plans owner to postgres;
alter table public.retailer_catalogue_child_plans owner to postgres;
alter table public.retailer_catalogue_apply_runs owner to postgres;
alter table public.retailer_catalogue_parent_plans enable row level security;
alter table public.retailer_catalogue_parent_plans force row level security;
alter table public.retailer_catalogue_child_plans enable row level security;
alter table public.retailer_catalogue_child_plans force row level security;
alter table public.retailer_catalogue_apply_runs enable row level security;
alter table public.retailer_catalogue_apply_runs force row level security;
revoke all on table public.retailer_catalogue_parent_plans from public, anon, authenticated, service_role;
revoke all on table public.retailer_catalogue_child_plans from public, anon, authenticated, service_role;
revoke all on table public.retailer_catalogue_apply_runs from public, anon, authenticated, service_role;

create unique index if not exists retailer_catalogue_one_active_parent_idx
  on public.retailer_catalogue_parent_plans(retailer_id, target_environment, source_snapshot_fingerprint)
  where status in ('PLANNED','APPROVED','PARTIALLY_APPLIED','FAILED');
create index if not exists retailer_catalogue_parent_status_idx on public.retailer_catalogue_parent_plans(status, approval_expires_at);
create index if not exists retailer_catalogue_child_parent_status_idx on public.retailer_catalogue_child_plans(parent_plan_id, status, batch_index);
create unique index if not exists retailer_catalogue_one_active_run_idx
  on public.retailer_catalogue_apply_runs(child_plan_id, run_type)
  where status = 'STARTED';

create or replace function public.retailer_catalogue_raise(p_code text, p_summary text, p_detail jsonb default '{}'::jsonb)
returns void language plpgsql volatile set search_path = pg_catalog as $error$
begin
  raise exception using errcode = 'P0001', message = jsonb_build_object(
    'code', p_code, 'severity', case when p_code in ('RSBI_DEPENDENCY_NOT_APPLIED','RSBI_PARTIAL_BATCH_STATE') then 'ERROR' else 'CRITICAL' end,
    'summary', p_summary, 'detail', coalesce(p_detail, '{}'::jsonb)
  )::text;
end;
$error$;

create or replace function public.retailer_catalogue_parent_transition_allowed(p_old text, p_new text)
returns boolean language sql immutable strict set search_path = pg_catalog as $parent_transition$
  select p_old = p_new or case p_old
    when 'PLANNED' then p_new in ('APPROVED','EXPIRED','SUPERSEDED')
    when 'APPROVED' then p_new in ('PARTIALLY_APPLIED','COMPLETED','FAILED','EXPIRED','SUPERSEDED')
    when 'PARTIALLY_APPLIED' then p_new in ('COMPLETED','FAILED','ROLLED_BACK','SUPERSEDED')
    when 'FAILED' then p_new in ('PARTIALLY_APPLIED','COMPLETED','ROLLED_BACK','SUPERSEDED')
    when 'COMPLETED' then p_new = 'ROLLED_BACK'
    else false end;
$parent_transition$;

create or replace function public.retailer_catalogue_child_transition_allowed(p_old text, p_new text)
returns boolean language sql immutable strict set search_path = pg_catalog as $child_transition$
  select p_old = p_new or case p_old
    when 'PLANNED' then p_new in ('APPROVED','EXPIRED','SUPERSEDED')
    when 'APPROVED' then p_new in ('APPLYING','EXPIRED','SUPERSEDED')
    when 'APPLYING' then p_new in ('APPLIED','FAILED')
    when 'APPLIED' then p_new = 'ROLLED_BACK'
    when 'FAILED' then p_new in ('APPROVED','ROLLED_BACK','SUPERSEDED')
    else false end;
$child_transition$;

create or replace function public.retailer_catalogue_apply_transition_allowed(p_old text, p_new text)
returns boolean language sql immutable strict set search_path = pg_catalog as $run_transition$
  select p_old = p_new or p_old = 'STARTED' and p_new in ('SUCCEEDED','FAILED','ROLLED_BACK') or p_old = 'FAILED' and p_new = 'ROLLED_BACK';
$run_transition$;

create or replace function public.retailer_catalogue_guard_transition()
returns trigger language plpgsql set search_path = pg_catalog, public as $guard_transition$
begin
  if tg_table_name = 'retailer_catalogue_parent_plans' then
    if not public.retailer_catalogue_parent_transition_allowed(old.status, new.status) then perform public.retailer_catalogue_raise('RSBI_INVALID_TRANSITION','Invalid parent transition',jsonb_build_object('old',old.status,'new',new.status)); end if;
    if (to_jsonb(old) - array['status','approval_id','approved_by','approved_at','approval_expires_at','approval_consumed_at','updated_at','audit_log']) is distinct from
       (to_jsonb(new) - array['status','approval_id','approved_by','approved_at','approval_expires_at','approval_consumed_at','updated_at','audit_log']) then
      perform public.retailer_catalogue_raise('RSBI_PARENT_FINGERPRINT_MISMATCH','Immutable parent fields changed');
    end if;
  elsif tg_table_name = 'retailer_catalogue_child_plans' then
    if not public.retailer_catalogue_child_transition_allowed(old.status, new.status) then perform public.retailer_catalogue_raise('RSBI_INVALID_TRANSITION','Invalid child transition',jsonb_build_object('old',old.status,'new',new.status)); end if;
    if (to_jsonb(old) - array['status','approval_id','approved_at','approval_expires_at','approval_consumed_at','rollback_requested_at','rollback_requested_by','updated_at','audit_log']) is distinct from
       (to_jsonb(new) - array['status','approval_id','approved_at','approval_expires_at','approval_consumed_at','rollback_requested_at','rollback_requested_by','updated_at','audit_log']) then
      perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Immutable child fields changed');
    end if;
  else
    if not public.retailer_catalogue_apply_transition_allowed(old.status, new.status) then perform public.retailer_catalogue_raise('RSBI_INVALID_TRANSITION','Invalid run transition',jsonb_build_object('old',old.status,'new',new.status)); end if;
    if (to_jsonb(old) - array['status','after_counts','result_metadata','completed_at','error_code']) is distinct from
       (to_jsonb(new) - array['status','after_counts','result_metadata','completed_at','error_code']) then
      perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Immutable apply-run fields changed');
    end if;
  end if;
  new.updated_at := coalesce((to_jsonb(new)->>'updated_at')::timestamptz, now());
  return new;
end;
$guard_transition$;

drop trigger if exists retailer_catalogue_parent_transition_guard on public.retailer_catalogue_parent_plans;
create trigger retailer_catalogue_parent_transition_guard before update on public.retailer_catalogue_parent_plans for each row execute function public.retailer_catalogue_guard_transition();
drop trigger if exists retailer_catalogue_child_transition_guard on public.retailer_catalogue_child_plans;
create trigger retailer_catalogue_child_transition_guard before update on public.retailer_catalogue_child_plans for each row execute function public.retailer_catalogue_guard_transition();
drop trigger if exists retailer_catalogue_apply_transition_guard on public.retailer_catalogue_apply_runs;
create trigger retailer_catalogue_apply_transition_guard before update on public.retailer_catalogue_apply_runs for each row execute function public.retailer_catalogue_guard_transition();

create or replace function public.create_retailer_catalogue_parent_plan(p_plan jsonb, p_parent_plan_fingerprint text, p_source_sha256 text, p_actor text)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp as $create_parent$
declare v_plan jsonb; v_children jsonb; v_control jsonb; v_existing public.retailer_catalogue_parent_plans%rowtype; v_id uuid; v_target text; v_retailer bigint;
begin
  v_plan := coalesce(p_plan->'parent_plan', p_plan); v_children := coalesce(p_plan->'child_plans','[]'::jsonb); v_control := coalesce(p_plan->'control','{}'::jsonb);
  if jsonb_typeof(v_plan) <> 'object' or jsonb_typeof(v_children) <> 'array' or nullif(trim(p_actor),'') is null then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid parent envelope'); end if;
  if p_parent_plan_fingerprint !~ '^[0-9a-f]{64}$' or p_source_sha256 !~ '^[0-9a-f]{64}$' or v_plan->>'parent_plan_fingerprint' is distinct from p_parent_plan_fingerprint or v_plan->>'source_sha256' is distinct from p_source_sha256 then perform public.retailer_catalogue_raise('RSBI_PARENT_FINGERPRINT_MISMATCH','Parent/source fingerprint mismatch'); end if;
  v_target := v_control->>'target_environment'; v_retailer := nullif(v_control->>'retailer_id','')::bigint;
  if v_target not in ('LOCAL_POSTGRES','DRY_RUN') or v_retailer is null then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Phase 2 target must be local'); end if;
  if (v_plan->>'canonical_snapshot_fingerprint') !~ '^[0-9a-f]{64}$' or (v_plan->>'adapter_sha256') !~ '^[0-9a-f]{64}$' or (v_plan->>'policy_config_sha256') !~ '^[0-9a-f]{64}$' or (v_plan->>'code_commit') !~ '^[0-9a-f]{40}$' then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Required fingerprints are invalid'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_target||':'||v_retailer::text,0));
  select * into v_existing from public.retailer_catalogue_parent_plans where parent_plan_fingerprint=p_parent_plan_fingerprint;
  if found then return jsonb_build_object('parent_plan_id',v_existing.id,'status',v_existing.status,'noop',true,'parent_plan_fingerprint',v_existing.parent_plan_fingerprint); end if;
  if exists(select 1 from public.retailer_catalogue_parent_plans where retailer_id=v_retailer and target_environment=v_target and source_snapshot_fingerprint=p_source_sha256 and status in ('PLANNED','APPROVED','PARTIALLY_APPLIED','FAILED')) then perform public.retailer_catalogue_raise('RSBI_DUPLICATE_IDENTITY','A different active parent exists for this immutable snapshot'); end if;
  insert into public.retailer_catalogue_parent_plans(id,parent_plan_fingerprint,retailer_id,target_environment,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,expected_deltas,plan_json,child_manifest,rollback_manifest,source_captured_at,canonical_snapshot_at,created_by)
  values((v_plan->>'parent_plan_id')::uuid,p_parent_plan_fingerprint,v_retailer,v_target,p_source_sha256,v_plan->>'canonical_snapshot_fingerprint',v_plan->>'adapter_sha256',v_plan->>'policy_config_sha256',v_plan->>'code_commit',coalesce(v_control->>'expected_state_fingerprint',v_plan->>'canonical_snapshot_fingerprint'),coalesce(v_plan->'aggregate_expected_deltas','{}'::jsonb),v_plan,v_children,coalesce(v_plan->'rollback_manifest','{}'::jsonb),coalesce((v_control->>'source_captured_at')::timestamptz,now()),coalesce((v_control->>'canonical_snapshot_at')::timestamptz,now()),trim(p_actor)) returning id into v_id;
  return jsonb_build_object('parent_plan_id',v_id,'status','PLANNED','noop',false,'parent_plan_fingerprint',p_parent_plan_fingerprint);
end;
$create_parent$;

create or replace function public.approve_retailer_catalogue_parent_plan(p_parent_plan_id uuid, p_parent_plan_fingerprint text, p_approved_by text, p_expires_at timestamptz)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp as $approve_parent$
declare v_parent public.retailer_catalogue_parent_plans%rowtype; v_approval uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_parent_plan_id::text,0)); select * into v_parent from public.retailer_catalogue_parent_plans where id=p_parent_plan_id for update;
  if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Parent not found'); end if;
  if v_parent.parent_plan_fingerprint is distinct from p_parent_plan_fingerprint then perform public.retailer_catalogue_raise('RSBI_PARENT_FINGERPRINT_MISMATCH','Parent fingerprint mismatch'); end if;
  if v_parent.status='APPROVED' and v_parent.approved_by=trim(p_approved_by) and v_parent.approval_expires_at>now() then return jsonb_build_object('parent_plan_id',v_parent.id,'approval_id',v_parent.approval_id,'status',v_parent.status,'noop',true); end if;
  if v_parent.status<>'PLANNED' then perform public.retailer_catalogue_raise('RSBI_INVALID_TRANSITION','Parent is not PLANNED'); end if;
  if nullif(trim(p_approved_by),'') is null or p_expires_at<=now() or p_expires_at>now()+interval '120 minutes' then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Parent approval expiry is invalid'); end if;
  if v_parent.source_captured_at<now()-interval '24 hours' then perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Source snapshot is stale'); end if;
  if v_parent.canonical_snapshot_at<now()-interval '15 minutes' then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Canonical snapshot is stale'); end if;
  v_approval:=gen_random_uuid(); update public.retailer_catalogue_parent_plans set status='APPROVED',approval_id=v_approval,approved_by=trim(p_approved_by),approved_at=now(),approval_expires_at=p_expires_at,updated_at=now(),audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','PARENT_APPROVED','actor',trim(p_approved_by),'at',now())) where id=v_parent.id;
  return jsonb_build_object('parent_plan_id',v_parent.id,'approval_id',v_approval,'status','APPROVED','expires_at',p_expires_at,'noop',false);
end;
$approve_parent$;

create or replace function public.generate_retailer_catalogue_child_plans(p_parent_plan_id uuid, p_parent_plan_fingerprint text)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp as $generate_children$
declare v_parent public.retailer_catalogue_parent_plans%rowtype; v_child jsonb; v_count integer:=0; v_existing integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_parent_plan_id::text,0)); select * into v_parent from public.retailer_catalogue_parent_plans where id=p_parent_plan_id for update;
  if not found or v_parent.parent_plan_fingerprint is distinct from p_parent_plan_fingerprint then perform public.retailer_catalogue_raise('RSBI_PARENT_FINGERPRINT_MISMATCH','Parent mismatch'); end if;
  if v_parent.status not in ('APPROVED','PARTIALLY_APPLIED','FAILED') or v_parent.approval_expires_at<=now() then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Parent is not active and approved'); end if;
  select count(*) into v_existing from public.retailer_catalogue_child_plans where parent_plan_id=v_parent.id;
  if v_existing>0 then
    if v_existing<>jsonb_array_length(v_parent.child_manifest) then perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Existing child set is incomplete'); end if;
    return jsonb_build_object('parent_plan_id',v_parent.id,'child_count',v_existing,'noop',true);
  end if;
  for v_child in select value from jsonb_array_elements(v_parent.child_manifest) loop
    if (v_child->>'parent_plan_id')::uuid is distinct from v_parent.id or (v_child->>'child_plan_fingerprint') !~ '^[0-9a-f]{64}$' or jsonb_array_length(v_child->'record_ids') not between 1 and 100 then perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Invalid deterministic child manifest'); end if;
    insert into public.retailer_catalogue_child_plans(id,parent_plan_id,retailer_id,target_environment,child_plan_fingerprint,parent_plan_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,batch_index,batch_count,dependency_group,rollback_group,record_ids,expected_deltas,plan_json,rollback_manifest)
    values((v_child->>'child_plan_id')::uuid,v_parent.id,v_parent.retailer_id,v_parent.target_environment,v_child->>'child_plan_fingerprint',v_parent.parent_plan_fingerprint,v_parent.source_snapshot_fingerprint,v_parent.canonical_snapshot_fingerprint,v_parent.adapter_fingerprint,v_parent.policy_fingerprint,v_parent.code_commit,coalesce(v_child#>>'{expected_state,parent_core_fingerprint}',v_parent.expected_state_fingerprint),(v_child->>'batch_index')::integer,(v_child->>'batch_count')::integer,v_child->>'dependency_group',v_child->>'rollback_group',v_child->'record_ids',coalesce(v_child->'expected_deltas','{}'::jsonb),v_child,coalesce(v_child->'rollback_operations','[]'::jsonb));
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('parent_plan_id',v_parent.id,'child_count',v_count,'noop',false);
end;
$generate_children$;

create or replace function public.approve_retailer_catalogue_child_plan(p_child_plan_id uuid, p_parent_approval_id uuid, p_parent_plan_fingerprint text, p_child_plan_fingerprint text, p_expires_at timestamptz)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp as $approve_child$
declare v_child public.retailer_catalogue_child_plans%rowtype; v_parent public.retailer_catalogue_parent_plans%rowtype; v_approval uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_child_plan_id::text,0)); select * into v_child from public.retailer_catalogue_child_plans where id=p_child_plan_id for update; if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Child not found'); end if;
  select * into v_parent from public.retailer_catalogue_parent_plans where id=v_child.parent_plan_id for update;
  if v_parent.approval_id is distinct from p_parent_approval_id or v_parent.parent_plan_fingerprint is distinct from p_parent_plan_fingerprint then perform public.retailer_catalogue_raise('RSBI_PARENT_FINGERPRINT_MISMATCH','Parent approval/fingerprint mismatch'); end if;
  if v_child.child_plan_fingerprint is distinct from p_child_plan_fingerprint then perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Child fingerprint mismatch'); end if;
  if v_parent.status not in ('APPROVED','PARTIALLY_APPLIED','FAILED') or v_parent.approval_expires_at<=now() then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Parent approval expired'); end if;
  if v_child.status='APPROVED' and v_child.approval_expires_at>now() then return jsonb_build_object('child_plan_id',v_child.id,'approval_id',v_child.approval_id,'status','APPROVED','noop',true); end if;
  if v_child.status not in ('PLANNED','FAILED') or p_expires_at<=now() or p_expires_at>least(v_parent.approval_expires_at,now()+interval '30 minutes') then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Child approval state or expiry invalid'); end if;
  if exists(select 1 from public.retailer_catalogue_child_plans prior where prior.parent_plan_id=v_parent.id and prior.batch_index<v_child.batch_index and prior.status not in ('APPLIED','ROLLED_BACK')) then perform public.retailer_catalogue_raise('RSBI_DEPENDENCY_NOT_APPLIED','Prior child is not applied'); end if;
  v_approval:=gen_random_uuid(); update public.retailer_catalogue_child_plans set status='APPROVED',approval_id=v_approval,approved_at=now(),approval_expires_at=p_expires_at,approval_consumed_at=null,updated_at=now(),audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','CHILD_APPROVED','at',now())) where id=v_child.id;
  return jsonb_build_object('child_plan_id',v_child.id,'approval_id',v_approval,'status','APPROVED','expires_at',p_expires_at,'noop',false);
end;
$approve_child$;

create or replace function public.begin_retailer_catalogue_child_apply(p_child_plan_id uuid, p_parent_plan_fingerprint text, p_child_plan_fingerprint text, p_source_snapshot_fingerprint text, p_canonical_snapshot_fingerprint text, p_adapter_fingerprint text, p_policy_fingerprint text, p_code_commit text, p_expected_state_fingerprint text, p_actor text)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp as $begin_apply$
declare v_child public.retailer_catalogue_child_plans%rowtype; v_parent public.retailer_catalogue_parent_plans%rowtype; v_run uuid; v_attempt integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_child_plan_id::text,0)); select * into v_child from public.retailer_catalogue_child_plans where id=p_child_plan_id for update; if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Child not found'); end if; select * into v_parent from public.retailer_catalogue_parent_plans where id=v_child.parent_plan_id for update;
  if v_child.status='APPLIED' then return jsonb_build_object('code','RSBI_REPLAY_BLOCKED','child_plan_id',v_child.id,'status','APPLIED','noop',true); end if;
  if exists(select 1 from public.retailer_catalogue_apply_runs where child_plan_id=v_child.id and run_type='APPLY' and status='STARTED') then perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Concurrent child apply already started'); end if;
  if v_child.status<>'APPROVED' then perform public.retailer_catalogue_raise('RSBI_INVALID_TRANSITION','Child is not APPROVED'); end if;
  if v_child.approval_expires_at<=now() or v_parent.approval_expires_at<=now() then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Approval expired'); end if;
  if v_parent.parent_plan_fingerprint is distinct from p_parent_plan_fingerprint then perform public.retailer_catalogue_raise('RSBI_PARENT_FINGERPRINT_MISMATCH','Parent fingerprint mismatch'); end if;
  if v_child.child_plan_fingerprint is distinct from p_child_plan_fingerprint then perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Child fingerprint mismatch'); end if;
  if v_child.source_snapshot_fingerprint is distinct from p_source_snapshot_fingerprint or v_child.canonical_snapshot_fingerprint is distinct from p_canonical_snapshot_fingerprint or v_child.adapter_fingerprint is distinct from p_adapter_fingerprint or v_child.policy_fingerprint is distinct from p_policy_fingerprint or v_child.code_commit is distinct from p_code_commit or v_child.expected_state_fingerprint is distinct from p_expected_state_fingerprint then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Sealed child metadata mismatch'); end if;
  select coalesce(max(attempt_ordinal),0)+1 into v_attempt from public.retailer_catalogue_apply_runs where child_plan_id=v_child.id and run_type='APPLY';
  insert into public.retailer_catalogue_apply_runs(parent_plan_id,child_plan_id,retailer_id,target_environment,run_type,attempt_ordinal,parent_plan_fingerprint,child_plan_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,approval_id,approval_expires_at,rollback_manifest,expected_deltas,started_by) values(v_parent.id,v_child.id,v_parent.retailer_id,v_parent.target_environment,'APPLY',v_attempt,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_child.source_snapshot_fingerprint,v_child.canonical_snapshot_fingerprint,v_child.adapter_fingerprint,v_child.policy_fingerprint,v_child.code_commit,v_child.expected_state_fingerprint,v_child.approval_id,v_child.approval_expires_at,v_child.rollback_manifest,v_child.expected_deltas,trim(p_actor)) returning id into v_run;
  update public.retailer_catalogue_child_plans set status='APPLYING',approval_consumed_at=now(),updated_at=now() where id=v_child.id; update public.retailer_catalogue_parent_plans set approval_consumed_at=coalesce(approval_consumed_at,now()),updated_at=now() where id=v_parent.id;
  return jsonb_build_object('run_id',v_run,'child_plan_id',v_child.id,'status','STARTED','business_writes',0);
end;
$begin_apply$;

create or replace function public.retailer_catalogue_recalculate_parent_status(p_parent_plan_id uuid)
returns text language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp as $recalc$
declare v_total integer; v_applied integer; v_failed integer; v_rolled integer; v_status text;
begin
  select count(*),count(*) filter(where status='APPLIED'),count(*) filter(where status='FAILED'),count(*) filter(where status='ROLLED_BACK') into v_total,v_applied,v_failed,v_rolled from public.retailer_catalogue_child_plans where parent_plan_id=p_parent_plan_id;
  v_status:=case when v_total>0 and v_rolled=v_total then 'ROLLED_BACK' when v_total>0 and v_applied=v_total then 'COMPLETED' when v_failed>0 then 'FAILED' when v_applied>0 and v_rolled=0 then 'PARTIALLY_APPLIED' else (select status from public.retailer_catalogue_parent_plans where id=p_parent_plan_id) end;
  update public.retailer_catalogue_parent_plans set status=v_status,updated_at=now() where id=p_parent_plan_id and status<>v_status; return v_status;
end;
$recalc$;

create or replace function public.complete_retailer_catalogue_child_apply(p_run_id uuid, p_parent_plan_fingerprint text, p_child_plan_fingerprint text, p_after_counts jsonb, p_result_metadata jsonb, p_actor text)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp as $complete_apply$
declare v_run public.retailer_catalogue_apply_runs%rowtype; v_child public.retailer_catalogue_child_plans%rowtype; v_parent_status text;
begin
  select * into v_run from public.retailer_catalogue_apply_runs where id=p_run_id for update; if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Apply run not found'); end if; perform pg_advisory_xact_lock(hashtextextended(v_run.child_plan_id::text,0)); select * into v_child from public.retailer_catalogue_child_plans where id=v_run.child_plan_id for update;
  if v_run.status='SUCCEEDED' and v_child.status='APPLIED' then return jsonb_build_object('code','RSBI_REPLAY_BLOCKED','run_id',v_run.id,'status','SUCCEEDED','noop',true); end if;
  if v_run.status<>'STARTED' or v_child.status<>'APPLYING' then perform public.retailer_catalogue_raise('RSBI_INVALID_TRANSITION','Run/child is not active'); end if;
  if v_run.parent_plan_fingerprint is distinct from p_parent_plan_fingerprint or v_run.child_plan_fingerprint is distinct from p_child_plan_fingerprint then perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Completion fingerprint mismatch'); end if;
  update public.retailer_catalogue_apply_runs set status='SUCCEEDED',after_counts=coalesce(p_after_counts,'{}'::jsonb),result_metadata=coalesce(p_result_metadata,'{}'::jsonb)||jsonb_build_object('confirmed_by',trim(p_actor),'business_writes',0),completed_at=now() where id=v_run.id;
  update public.retailer_catalogue_child_plans set status='APPLIED',updated_at=now(),audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','CONTROL_APPLY_SUCCEEDED','run_id',v_run.id,'at',now())) where id=v_child.id;
  v_parent_status:=public.retailer_catalogue_recalculate_parent_status(v_run.parent_plan_id); return jsonb_build_object('run_id',v_run.id,'child_plan_id',v_child.id,'status','SUCCEEDED','parent_status',v_parent_status,'business_writes',0);
end;
$complete_apply$;

create or replace function public.fail_retailer_catalogue_child_apply(p_run_id uuid, p_parent_plan_fingerprint text, p_child_plan_fingerprint text, p_error_code text, p_result_metadata jsonb, p_actor text)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp as $fail_apply$
declare v_run public.retailer_catalogue_apply_runs%rowtype; v_child public.retailer_catalogue_child_plans%rowtype; v_parent_status text;
begin
  if p_error_code !~ '^RSBI_[A-Z_]+$' then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Stable RSBI error code required'); end if;
  select * into v_run from public.retailer_catalogue_apply_runs where id=p_run_id for update; if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Apply run not found'); end if; perform pg_advisory_xact_lock(hashtextextended(v_run.child_plan_id::text,0)); select * into v_child from public.retailer_catalogue_child_plans where id=v_run.child_plan_id for update;
  if v_run.status<>'STARTED' or v_child.status<>'APPLYING' or v_run.parent_plan_fingerprint is distinct from p_parent_plan_fingerprint or v_run.child_plan_fingerprint is distinct from p_child_plan_fingerprint then perform public.retailer_catalogue_raise('RSBI_INVALID_TRANSITION','Run cannot fail from current state'); end if;
  update public.retailer_catalogue_apply_runs set status='FAILED',result_metadata=coalesce(p_result_metadata,'{}'::jsonb)||jsonb_build_object('reported_by',trim(p_actor),'business_writes',0),completed_at=now(),error_code=p_error_code where id=v_run.id;
  update public.retailer_catalogue_child_plans set status='FAILED',updated_at=now(),audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','CONTROL_APPLY_FAILED','run_id',v_run.id,'code',p_error_code,'at',now())) where id=v_child.id;
  v_parent_status:=public.retailer_catalogue_recalculate_parent_status(v_run.parent_plan_id); return jsonb_build_object('run_id',v_run.id,'child_plan_id',v_child.id,'status','FAILED','parent_status',v_parent_status,'business_writes',0,'error_code',p_error_code);
end;
$fail_apply$;

create or replace function public.resume_retailer_catalogue_parent_plan(p_parent_plan_id uuid, p_parent_plan_fingerprint text, p_decision text, p_actor text)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp as $resume_parent$
declare v_parent public.retailer_catalogue_parent_plans%rowtype; v_ready jsonb; v_blocked jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_parent_plan_id::text,0)); select * into v_parent from public.retailer_catalogue_parent_plans where id=p_parent_plan_id for update;
  if not found or v_parent.parent_plan_fingerprint is distinct from p_parent_plan_fingerprint then perform public.retailer_catalogue_raise('RSBI_PARENT_FINGERPRINT_MISMATCH','Parent mismatch'); end if;
  if v_parent.status not in ('COMPLETED','ROLLED_BACK') and v_parent.approval_expires_at<=now() then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Parent approval expired'); end if;
  if p_decision not in ('PREVIEW','RETRY_FAILED_GROUP','CONTINUE_INDEPENDENT_GROUPS','STOP_AND_ROLLBACK') then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid resume decision'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('child_plan_id',c.id,'batch_index',c.batch_index,'status',c.status) order by c.batch_index),'[]'::jsonb) into v_ready from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_parent.id and c.status in ('PLANNED','APPROVED') and not exists(select 1 from public.retailer_catalogue_child_plans f where f.parent_plan_id=c.parent_plan_id and f.dependency_group=c.dependency_group and f.status='FAILED');
  select coalesce(jsonb_agg(distinct dependency_group),'[]'::jsonb) into v_blocked from public.retailer_catalogue_child_plans where parent_plan_id=v_parent.id and status='FAILED';
  if p_decision<>'PREVIEW' then update public.retailer_catalogue_parent_plans set audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','RESUME_DECISION','decision',p_decision,'actor',trim(p_actor),'at',now())),updated_at=now() where id=v_parent.id; end if;
  return jsonb_build_object('parent_plan_id',v_parent.id,'parent_status',v_parent.status,'ready_children',v_ready,'blocked_dependency_groups',v_blocked,'skipped_applied',(select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent.id and status='APPLIED'),'skipped_rolled_back',(select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent.id and status='ROLLED_BACK'),'business_writes',0);
end;
$resume_parent$;

create or replace function public.request_retailer_catalogue_child_rollback(p_child_plan_id uuid, p_parent_plan_fingerprint text, p_child_plan_fingerprint text, p_rollback_fingerprint text, p_actor text)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp as $request_rollback$
declare v_child public.retailer_catalogue_child_plans%rowtype; v_parent public.retailer_catalogue_parent_plans%rowtype; v_run uuid; v_attempt integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_child_plan_id::text,0)); select * into v_child from public.retailer_catalogue_child_plans where id=p_child_plan_id for update; if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Child not found'); end if; select * into v_parent from public.retailer_catalogue_parent_plans where id=v_child.parent_plan_id for update;
  if v_parent.parent_plan_fingerprint is distinct from p_parent_plan_fingerprint or v_child.child_plan_fingerprint is distinct from p_child_plan_fingerprint then perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Rollback fingerprint binding mismatch'); end if;
  if v_child.status not in ('APPLIED','FAILED') or p_rollback_fingerprint !~ '^[0-9a-f]{64}$' or v_parent.rollback_manifest->>'rollback_fingerprint' is distinct from p_rollback_fingerprint then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Rollback manifest is not sealed'); end if;
  if jsonb_array_length(v_child.rollback_manifest)=0 or exists(select 1 from jsonb_array_elements(v_child.rollback_manifest) op where coalesce((op#>>'{ownership,plan_owned_only}')::boolean,false)=false) then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Rollback ownership is not exclusive'); end if;
  select coalesce(max(attempt_ordinal),0)+1 into v_attempt from public.retailer_catalogue_apply_runs where child_plan_id=v_child.id and run_type='ROLLBACK';
  insert into public.retailer_catalogue_apply_runs(parent_plan_id,child_plan_id,retailer_id,target_environment,run_type,attempt_ordinal,parent_plan_fingerprint,child_plan_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,approval_id,approval_expires_at,rollback_fingerprint,rollback_manifest,expected_deltas,started_by) values(v_parent.id,v_child.id,v_parent.retailer_id,v_parent.target_environment,'ROLLBACK',v_attempt,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_child.source_snapshot_fingerprint,v_child.canonical_snapshot_fingerprint,v_child.adapter_fingerprint,v_child.policy_fingerprint,v_child.code_commit,v_child.expected_state_fingerprint,v_child.approval_id,v_child.approval_expires_at,p_rollback_fingerprint,v_child.rollback_manifest,v_child.expected_deltas,trim(p_actor)) returning id into v_run;
  update public.retailer_catalogue_child_plans set rollback_requested_at=now(),rollback_requested_by=trim(p_actor),updated_at=now(),audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','ROLLBACK_REQUESTED','run_id',v_run,'at',now())) where id=v_child.id;
  return jsonb_build_object('run_id',v_run,'child_plan_id',v_child.id,'status','STARTED','run_type','ROLLBACK','business_writes',0);
end;
$request_rollback$;

create or replace function public.complete_retailer_catalogue_child_rollback(p_run_id uuid, p_parent_plan_fingerprint text, p_child_plan_fingerprint text, p_result_metadata jsonb, p_actor text)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp as $complete_rollback$
declare v_run public.retailer_catalogue_apply_runs%rowtype; v_child public.retailer_catalogue_child_plans%rowtype; v_status text;
begin
  select * into v_run from public.retailer_catalogue_apply_runs where id=p_run_id and run_type='ROLLBACK' for update; if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Rollback run not found'); end if; perform pg_advisory_xact_lock(hashtextextended(v_run.child_plan_id::text,0)); select * into v_child from public.retailer_catalogue_child_plans where id=v_run.child_plan_id for update;
  if v_run.status<>'STARTED' or v_child.status not in ('APPLIED','FAILED') or v_run.parent_plan_fingerprint is distinct from p_parent_plan_fingerprint or v_run.child_plan_fingerprint is distinct from p_child_plan_fingerprint then perform public.retailer_catalogue_raise('RSBI_INVALID_TRANSITION','Rollback confirmation mismatch'); end if;
  update public.retailer_catalogue_apply_runs set status='ROLLED_BACK',result_metadata=coalesce(p_result_metadata,'{}'::jsonb)||jsonb_build_object('confirmed_by',trim(p_actor),'business_writes',0),completed_at=now() where id=v_run.id;
  update public.retailer_catalogue_child_plans set status='ROLLED_BACK',updated_at=now(),audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','ROLLBACK_CONFIRMED','run_id',v_run.id,'at',now())) where id=v_child.id;
  v_status:=public.retailer_catalogue_recalculate_parent_status(v_run.parent_plan_id); return jsonb_build_object('run_id',v_run.id,'child_plan_id',v_child.id,'status','ROLLED_BACK','parent_status',v_status,'business_writes',0);
end;
$complete_rollback$;

create or replace function public.get_retailer_catalogue_plan_status(p_parent_plan_id uuid)
returns jsonb language sql stable security definer set search_path = pg_catalog, public, pg_temp as $get_status$
  select jsonb_build_object(
    'parent',jsonb_build_object('parent_plan_id',p.id,'status',p.status,'parent_plan_fingerprint',p.parent_plan_fingerprint,'retailer_id',p.retailer_id::text,'target_environment',p.target_environment,'expected_deltas',p.expected_deltas,'approval_expires_at',p.approval_expires_at),
    'children',coalesce((select jsonb_agg(jsonb_build_object('child_plan_id',c.id,'batch_index',c.batch_index,'status',c.status,'child_plan_fingerprint',c.child_plan_fingerprint,'approval_expires_at',c.approval_expires_at) order by c.batch_index) from public.retailer_catalogue_child_plans c where c.parent_plan_id=p.id),'[]'::jsonb),
    'runs',coalesce((select jsonb_agg(jsonb_build_object('run_id',r.id,'child_plan_id',r.child_plan_id,'run_type',r.run_type,'status',r.status,'started_at',r.started_at,'completed_at',r.completed_at) order by r.created_at) from public.retailer_catalogue_apply_runs r where r.parent_plan_id=p.id),'[]'::jsonb)
  ) from public.retailer_catalogue_parent_plans p where p.id=p_parent_plan_id;
$get_status$;

alter function public.retailer_catalogue_raise(text,text,jsonb) owner to postgres;
alter function public.retailer_catalogue_parent_transition_allowed(text,text) owner to postgres;
alter function public.retailer_catalogue_child_transition_allowed(text,text) owner to postgres;
alter function public.retailer_catalogue_apply_transition_allowed(text,text) owner to postgres;
alter function public.retailer_catalogue_guard_transition() owner to postgres;
alter function public.retailer_catalogue_recalculate_parent_status(uuid) owner to postgres;
alter function public.create_retailer_catalogue_parent_plan(jsonb,text,text,text) owner to postgres;
alter function public.approve_retailer_catalogue_parent_plan(uuid,text,text,timestamptz) owner to postgres;
alter function public.generate_retailer_catalogue_child_plans(uuid,text) owner to postgres;
alter function public.approve_retailer_catalogue_child_plan(uuid,uuid,text,text,timestamptz) owner to postgres;
alter function public.begin_retailer_catalogue_child_apply(uuid,text,text,text,text,text,text,text,text,text) owner to postgres;
alter function public.complete_retailer_catalogue_child_apply(uuid,text,text,jsonb,jsonb,text) owner to postgres;
alter function public.fail_retailer_catalogue_child_apply(uuid,text,text,text,jsonb,text) owner to postgres;
alter function public.resume_retailer_catalogue_parent_plan(uuid,text,text,text) owner to postgres;
alter function public.request_retailer_catalogue_child_rollback(uuid,text,text,text,text) owner to postgres;
alter function public.complete_retailer_catalogue_child_rollback(uuid,text,text,jsonb,text) owner to postgres;
alter function public.get_retailer_catalogue_plan_status(uuid) owner to postgres;

revoke all on function public.retailer_catalogue_raise(text,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.retailer_catalogue_parent_transition_allowed(text,text) from public,anon,authenticated,service_role;
revoke all on function public.retailer_catalogue_child_transition_allowed(text,text) from public,anon,authenticated,service_role;
revoke all on function public.retailer_catalogue_apply_transition_allowed(text,text) from public,anon,authenticated,service_role;
revoke all on function public.retailer_catalogue_guard_transition() from public,anon,authenticated,service_role;
revoke all on function public.retailer_catalogue_recalculate_parent_status(uuid) from public,anon,authenticated,service_role;
revoke all on function public.create_retailer_catalogue_parent_plan(jsonb,text,text,text) from public,anon,authenticated;
revoke all on function public.approve_retailer_catalogue_parent_plan(uuid,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.generate_retailer_catalogue_child_plans(uuid,text) from public,anon,authenticated;
revoke all on function public.approve_retailer_catalogue_child_plan(uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.begin_retailer_catalogue_child_apply(uuid,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.complete_retailer_catalogue_child_apply(uuid,text,text,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.fail_retailer_catalogue_child_apply(uuid,text,text,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.resume_retailer_catalogue_parent_plan(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.request_retailer_catalogue_child_rollback(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.complete_retailer_catalogue_child_rollback(uuid,text,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.get_retailer_catalogue_plan_status(uuid) from public,anon,authenticated;
grant execute on function public.create_retailer_catalogue_parent_plan(jsonb,text,text,text) to service_role;
grant execute on function public.approve_retailer_catalogue_parent_plan(uuid,text,text,timestamptz) to service_role;
grant execute on function public.generate_retailer_catalogue_child_plans(uuid,text) to service_role;
grant execute on function public.approve_retailer_catalogue_child_plan(uuid,uuid,text,text,timestamptz) to service_role;
grant execute on function public.begin_retailer_catalogue_child_apply(uuid,text,text,text,text,text,text,text,text,text) to service_role;
grant execute on function public.complete_retailer_catalogue_child_apply(uuid,text,text,jsonb,jsonb,text) to service_role;
grant execute on function public.fail_retailer_catalogue_child_apply(uuid,text,text,text,jsonb,text) to service_role;
grant execute on function public.resume_retailer_catalogue_parent_plan(uuid,text,text,text) to service_role;
grant execute on function public.request_retailer_catalogue_child_rollback(uuid,text,text,text,text) to service_role;
grant execute on function public.complete_retailer_catalogue_child_rollback(uuid,text,text,jsonb,text) to service_role;
grant execute on function public.get_retailer_catalogue_plan_status(uuid) to service_role;

commit;
