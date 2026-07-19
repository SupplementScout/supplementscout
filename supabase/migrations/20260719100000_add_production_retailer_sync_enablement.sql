begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Production-only portability bundle. It deliberately does not reuse or mark the
-- six staging ledger entries. The rollout runner must apply this exact file as the
-- next migration after the production ledger-25 checkpoint.
do $production_enablement_identity$
declare
  v_actual text[];
  v_expected constant text[] := array[
      '20260712211120_baseline_current_public_schema',
      '20260713130000_product_variants_stage2',
      '20260713180000_atomic_product_import_rpc',
      '20260713190000_approved_import_plan_ledger',
      '20260713200000_legacy_mapping_upgrade_rpc',
      '20260713210000_create_product_7_chocolate_vanilla_variants_and_retire_legacy_offer',
      '20260713220000_seed_batch_a_canonical_variants',
      '20260715120000_seed_discount_supplements_batch_b_canonical_variants',
      '20260715150000_seed_discount_supplements_batch_c_canonical_variants',
      '20260715180000_seed_discount_supplements_batch_d_canonical_products_variants',
      '20260715210000_seed_discount_supplements_batch_e_canonical_products_variants',
      '20260715230000_seed_fit_house_batch_f_catalog_and_backfill_images',
      '20260715233000_correct_fit_house_batch_f_source_variant_identity',
      '20260715234500_align_approval_product_format_normalization',
      '20260715235500_seed_batch_g_canonical_catalog',
      '20260716000000_support_standalone_legacy_mapping_upgrade',
      '20260716001000_seed_batch_g_replacement_variants',
      '20260716002000_allow_legacy_mapping_upgrade_null_total_noop',
      '20260716003000_support_optioned_legacy_mapping_upgrade',
      '20260716004000_support_optioned_parent_size_evidence',
      '20260716005000_allow_optioned_legacy_identity_update_null_total',
      '20260716010000_seed_whey_okay_medium_batch_1_canonical_variants',
      '20260716011000_seed_whey_okay_medium_batch_2_canonical_variants',
      '20260716012000_seed_whey_okay_medium_batch_3_canonical_variants',
      '20260716203000_seed_jons_per4m_product_families'
  ];
  v_system_identifier text;
  v_database_oid oid;
begin
  if current_user <> 'postgres' then
    raise exception 'production enablement requires the postgres migration owner';
  end if;
  if current_database() <> 'postgres' then
    raise exception 'production enablement database identity mismatch';
  end if;
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception 'production enablement requires the Supabase migration ledger';
  end if;
  select coalesce(array_agg(version || '_' || name order by version), array[]::text[])
    into v_actual
  from supabase_migrations.schema_migrations;
  if v_actual is distinct from v_expected then
    raise exception 'production enablement requires exact production ledger 25';
  end if;
  select system_identifier::text into v_system_identifier from pg_catalog.pg_control_system();
  select oid into v_database_oid from pg_catalog.pg_database where datname=current_database();
  if v_system_identifier <> '7642734024280108049' or v_database_oid <> 5::oid then
    raise exception 'production enablement physical database identity mismatch';
  end if;
  if to_regclass('public.retailer_catalogue_parent_plans') is not null
     or to_regclass('public.retailer_catalogue_database_targets') is not null
     or to_regclass('public.verified_offer_refresh_targets') is not null
     or to_regclass('public.retailer_offer_sync_batch_approvals') is not null
     or to_regrole('retailer_catalogue_production_validator') is not null
     or to_regrole('retailer_catalogue_production_approver') is not null
     or to_regrole('retailer_catalogue_production_executor') is not null then
    raise exception 'production enablement objects already exist; rerun rejected';
  end if;
end
$production_enablement_identity$;

-- Source: supabase\migrations\20260717120000_create_retailer_catalogue_control_ledger.sql

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


-- Source: supabase\migrations\20260717140000_add_staging_retailer_catalogue_executor.sql

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.retailer_catalogue_parent_plans') is null
     or to_regclass('public.retailer_catalogue_child_plans') is null
     or to_regclass('public.retailer_catalogue_apply_runs') is null
     or to_regprocedure('public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)') is null then
    raise exception 'production executor migration requires atomic importer, approval ledger, and Phase 2 control ledger';
  end if;
  if to_regclass('public.retailer_catalogue_production_fixture_approvals') is not null then
    raise exception 'production executor migration is already installed; rerun rejected';
  end if;
end
$preflight$;

alter table public.retailer_catalogue_parent_plans drop constraint retailer_catalogue_parent_plans_target_environment_check;
alter table public.retailer_catalogue_parent_plans add constraint retailer_catalogue_parent_plans_target_environment_check check (target_environment in ('LOCAL_POSTGRES','DRY_RUN','PRODUCTION'));
alter table public.retailer_catalogue_child_plans drop constraint retailer_catalogue_child_plans_target_environment_check;
alter table public.retailer_catalogue_child_plans add constraint retailer_catalogue_child_plans_target_environment_check check (target_environment in ('LOCAL_POSTGRES','DRY_RUN','PRODUCTION'));
alter table public.retailer_catalogue_apply_runs drop constraint retailer_catalogue_apply_runs_target_environment_check;
alter table public.retailer_catalogue_apply_runs add constraint retailer_catalogue_apply_runs_target_environment_check check (target_environment in ('LOCAL_POSTGRES','DRY_RUN','PRODUCTION'));

do $roles$
begin
  if not exists(select 1 from pg_roles where rolname='retailer_catalogue_production_approver') then create role retailer_catalogue_production_approver nologin; end if;
  if not exists(select 1 from pg_roles where rolname='retailer_catalogue_production_executor') then create role retailer_catalogue_production_executor nologin; end if;
end
$roles$;

-- This row is an owner-provisioned database attestation, not a client/session claim.
create table public.retailer_catalogue_database_targets (
  id boolean primary key default true check(id),
  target_environment text not null check(target_environment in ('PRODUCTION','PRODUCTION')),
  project_ref text not null check(project_ref ~ '^[a-z]{20}$'),
  database_identity text not null,
  database_system_identifier text not null,
  database_oid oid not null,
  is_active boolean not null default true,
  attested_by text not null,
  attested_at timestamptz not null default now()
);

create table public.retailer_catalogue_production_fixture_approvals (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null,
  package_fingerprint text not null check(package_fingerprint ~ '^[0-9a-f]{64}$'),
  fixture_id text not null,
  fixture_fingerprint text not null check(fixture_fingerprint ~ '^[0-9a-f]{64}$'),
  fixture_build_commit text not null check(fixture_build_commit ~ '^[0-9a-f]{40}$'),
  project_ref text not null,
  database_identity text not null,
  migration_ledger_fingerprint text not null check(migration_ledger_fingerprint ~ '^[0-9a-f]{64}$'),
  expected_migration_identifiers jsonb not null check(jsonb_typeof(expected_migration_identifiers)='array'),
  source_snapshot_fingerprint text not null check(source_snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  canonical_snapshot_fingerprint text not null check(canonical_snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  adapter_fingerprint text not null check(adapter_fingerprint ~ '^[0-9a-f]{64}$'),
  policy_fingerprint text not null check(policy_fingerprint ~ '^[0-9a-f]{64}$'),
  code_commit text not null check(code_commit ~ '^[0-9a-f]{40}$'),
  canonical_decisions jsonb not null check(jsonb_typeof(canonical_decisions)='object'),
  approved_by text not null,
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  parent_plan_id uuid unique,
  check(expires_at>approved_at),
  unique(package_id,package_fingerprint)
);
create unique index retailer_catalogue_production_fixture_active_idx on public.retailer_catalogue_production_fixture_approvals(fixture_fingerprint,project_ref,database_identity) where consumed_at is null;

create table public.retailer_catalogue_production_recovery_manifests (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null,
  package_fingerprint text not null check(package_fingerprint ~ '^[0-9a-f]{64}$'),
  child_plan_id uuid not null unique references public.retailer_catalogue_child_plans(id) on delete restrict,
  apply_run_id uuid not null unique references public.retailer_catalogue_apply_runs(id) on delete restrict,
  dependency_group text not null,
  execution_fingerprint text not null check(execution_fingerprint ~ '^[0-9a-f]{64}$'),
  rollback_manifest_fingerprint text not null unique check(rollback_manifest_fingerprint ~ '^[0-9a-f]{64}$'),
  created_product_ids jsonb not null default '[]'::jsonb,
  created_variant_ids jsonb not null default '[]'::jsonb,
  created_mapping_ids jsonb not null default '[]'::jsonb,
  created_offer_ids jsonb not null default '[]'::jsonb,
  created_price_history_ids jsonb not null default '[]'::jsonb,
  updated_before_state jsonb not null default '[]'::jsonb,
  ownership jsonb not null,
  reverse_dependency_order jsonb not null,
  before_counts jsonb not null,
  other_retailer_fingerprint text not null check(other_retailer_fingerprint ~ '^[0-9a-f]{64}$'),
  protected_shared_fingerprint text not null check(protected_shared_fingerprint ~ '^[0-9a-f]{64}$'),
  orphan_counts jsonb not null,
  applied_owned_state_fingerprint text not null check(applied_owned_state_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'READY' check(status in ('READY','RECOVERED','FAILED')),
  recovered_at timestamptz,
  failure_evidence jsonb,
  created_at timestamptz not null default now()
);

create table public.retailer_catalogue_production_recovery_approvals (
  id uuid primary key default gen_random_uuid(),
  recovery_manifest_id uuid not null references public.retailer_catalogue_production_recovery_manifests(id) on delete restrict,
  package_id uuid not null,
  package_fingerprint text not null check(package_fingerprint ~ '^[0-9a-f]{64}$'),
  project_ref text not null,
  database_identity text not null,
  child_plan_id uuid not null,
  execution_fingerprint text not null check(execution_fingerprint ~ '^[0-9a-f]{64}$'),
  rollback_manifest_fingerprint text not null check(rollback_manifest_fingerprint ~ '^[0-9a-f]{64}$'),
  expected_recovery_state jsonb not null,
  expected_recovery_state_fingerprint text not null check(expected_recovery_state_fingerprint ~ '^[0-9a-f]{64}$'),
  approved_by text not null,
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check(expires_at>approved_at)
);
create unique index retailer_catalogue_production_recovery_active_idx on public.retailer_catalogue_production_recovery_approvals(recovery_manifest_id) where consumed_at is null;

create table public.retailer_catalogue_production_recovery_audit (
  id uuid primary key default gen_random_uuid(),
  recovery_manifest_id uuid not null references public.retailer_catalogue_production_recovery_manifests(id),
  recovery_approval_id uuid references public.retailer_catalogue_production_recovery_approvals(id),
  recovery_run_id uuid references public.retailer_catalogue_apply_runs(id),
  event text not null,
  archived_rows jsonb not null default '{}'::jsonb,
  validation_evidence jsonb not null default '{}'::jsonb,
  actor text not null,
  created_at timestamptz not null default now()
);

alter table public.retailer_catalogue_database_targets owner to postgres;
alter table public.retailer_catalogue_production_fixture_approvals owner to postgres;
alter table public.retailer_catalogue_production_recovery_manifests owner to postgres;
alter table public.retailer_catalogue_production_recovery_approvals owner to postgres;
alter table public.retailer_catalogue_production_recovery_audit owner to postgres;
alter table public.retailer_catalogue_database_targets enable row level security;
alter table public.retailer_catalogue_database_targets force row level security;
alter table public.retailer_catalogue_production_fixture_approvals enable row level security;
alter table public.retailer_catalogue_production_fixture_approvals force row level security;
alter table public.retailer_catalogue_production_recovery_manifests enable row level security;
alter table public.retailer_catalogue_production_recovery_manifests force row level security;
alter table public.retailer_catalogue_production_recovery_approvals enable row level security;
alter table public.retailer_catalogue_production_recovery_approvals force row level security;
alter table public.retailer_catalogue_production_recovery_audit enable row level security;
alter table public.retailer_catalogue_production_recovery_audit force row level security;
revoke all on table public.retailer_catalogue_database_targets, public.retailer_catalogue_production_fixture_approvals, public.retailer_catalogue_production_recovery_manifests, public.retailer_catalogue_production_recovery_approvals, public.retailer_catalogue_production_recovery_audit from public,anon,authenticated,service_role,retailer_catalogue_production_approver,retailer_catalogue_production_executor;

create or replace function public.retailer_catalogue_sha256_json(p_value jsonb)
returns text language sql immutable strict set search_path=pg_catalog,public as $hash$
  select encode(pg_catalog.sha256(convert_to(public.atomic_import_canonical_json(p_value),'UTF8')),'hex')
$hash$;

create or replace function public.retailer_catalogue_actual_database_target()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $identity$
declare v_target public.retailer_catalogue_database_targets%rowtype; v_system text; v_oid oid;
begin
  select * into v_target from public.retailer_catalogue_database_targets where id=true and is_active;
  if not found then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Trusted database target attestation is missing'); end if;
  select system_identifier::text into v_system from pg_catalog.pg_control_system();
  select oid into v_oid from pg_catalog.pg_database where datname=current_database();
  if v_target.target_environment<>'PRODUCTION'
     or v_target.project_ref<>'aftboxmrdgyhizicfsfu'
     or v_target.project_ref='hxnrsyyqffztlvcrtgbf'
     or v_target.database_identity<>'supplementscout-production:aftboxmrdgyhizicfsfu'
     or v_target.database_system_identifier is distinct from v_system
     or v_target.database_oid is distinct from v_oid then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Trusted database target attestation rejected');
  end if;
  return jsonb_build_object('target_environment',v_target.target_environment,'project_ref',v_target.project_ref,'database_identity',v_target.database_identity,'database_system_identifier',v_system,'database_oid',v_oid::text);
end
$identity$;

create or replace function public.retailer_catalogue_actual_migration_ledger()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $ledger$
declare v_migrations jsonb;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null
     or not exists(select 1 from information_schema.columns where table_schema='supabase_migrations' and table_name='schema_migrations' and column_name='version')
     or not exists(select 1 from information_schema.columns where table_schema='supabase_migrations' and table_name='schema_migrations' and column_name='name') then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Supabase migration ledger schema is unavailable');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('identifier',identifier,'name',name,'ordinal',ordinal,'version',version) order by ordinal),'[]'::jsonb)
  into v_migrations
  from (
    select version, name, version||'_'||name as identifier, row_number() over(order by version,name)::integer as ordinal
    from supabase_migrations.schema_migrations
  ) ordered;
  return jsonb_build_object('schema_version',1,'target_environment',(public.retailer_catalogue_actual_database_target()->>'target_environment'),'migrations',v_migrations);
end
$ledger$;

create or replace function public.retailer_catalogue_actual_migration_ledger_fingerprint()
returns text language sql stable security definer set search_path=pg_catalog,public as $ledger_hash$
  select public.retailer_catalogue_sha256_json(public.retailer_catalogue_actual_migration_ledger())
$ledger_hash$;

create or replace function public.retailer_catalogue_assert_migration_ledger(p_expected_identifiers jsonb,p_expected_fingerprint text)
returns text language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $assert_ledger$
declare v_ledger jsonb; v_actual_identifiers jsonb; v_actual_fingerprint text;
begin
  v_ledger:=public.retailer_catalogue_actual_migration_ledger();
  select coalesce(jsonb_agg(value->>'identifier' order by (value->>'ordinal')::integer),'[]'::jsonb) into v_actual_identifiers from jsonb_array_elements(v_ledger->'migrations');
  v_actual_fingerprint:=public.retailer_catalogue_sha256_json(v_ledger);
  if jsonb_typeof(p_expected_identifiers)<>'array' or v_actual_identifiers is distinct from p_expected_identifiers or v_actual_fingerprint is distinct from p_expected_fingerprint then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Actual migration ledger does not match the approved package',jsonb_build_object('actual_fingerprint',v_actual_fingerprint,'actual_identifiers',v_actual_identifiers));
  end if;
  return v_actual_fingerprint;
end
$assert_ledger$;

create or replace function public.retailer_catalogue_business_counts()
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $counts$
  select jsonb_build_object('products',(select count(*) from public.products),'product_variants',(select count(*) from public.product_variants),'retailer_products',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),'price_history',(select count(*) from public.price_history))
$counts$;

create or replace function public.retailer_catalogue_orphan_counts()
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $orphans$
  select jsonb_build_object(
    'product_variants',(select count(*) from public.product_variants v where not exists(select 1 from public.products p where p.id=v.product_id)),
    'retailer_products_product',(select count(*) from public.retailer_products rp where not exists(select 1 from public.products p where p.id=rp.product_id)),
    'retailer_products_variant',(select count(*) from public.retailer_products rp where rp.product_variant_id is not null and not exists(select 1 from public.product_variants v where v.id=rp.product_variant_id)),
    'offers_product',(select count(*) from public.offers o where o.product_id is not null and not exists(select 1 from public.products p where p.id=o.product_id)),
    'offers_variant',(select count(*) from public.offers o where o.product_variant_id is not null and not exists(select 1 from public.product_variants v where v.id=o.product_variant_id)),
    'offers_mapping',(select count(*) from public.offers o where o.retailer_product_id is not null and not exists(select 1 from public.retailer_products rp where rp.id=o.retailer_product_id)),
    'price_history',(select count(*) from public.price_history ph where ph.offer_id is not null and not exists(select 1 from public.offers o where o.id=ph.offer_id)))
$orphans$;

create or replace function public.retailer_catalogue_other_retailer_fingerprint(p_retailer_id bigint)
returns text language sql stable security definer set search_path=pg_catalog,public as $other_hash$
  select public.retailer_catalogue_sha256_json(jsonb_build_object(
    'retailer_products',coalesce((select jsonb_agg(to_jsonb(rp) order by rp.id) from public.retailer_products rp where rp.retailer_id<>p_retailer_id),'[]'::jsonb),
    'offers',coalesce((select jsonb_agg(to_jsonb(o) order by o.id) from public.offers o where o.retailer_id<>p_retailer_id),'[]'::jsonb),
    'price_history',coalesce((select jsonb_agg(to_jsonb(ph) order by ph.id) from public.price_history ph join public.offers o on o.id=ph.offer_id where o.retailer_id<>p_retailer_id),'[]'::jsonb)))
$other_hash$;

create or replace function public.retailer_catalogue_protected_shared_fingerprint()
returns text language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $shared_hash$
declare v_product jsonb; v_variant jsonb;
begin
  select to_jsonb(p) into v_product from public.products p where p.id=91;
  select to_jsonb(v) into v_variant from public.product_variants v where v.id=39 and v.product_id=91;
  if v_product is null or v_variant is null then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Protected shared Project AD product 91 or variant 39 is missing'); end if;
  return public.retailer_catalogue_sha256_json(jsonb_build_object('product',v_product,'variant',v_variant));
end
$shared_hash$;

create or replace function public.retailer_catalogue_owned_state_fingerprint(p_products jsonb,p_variants jsonb,p_mappings jsonb,p_offers jsonb,p_histories jsonb)
returns text language sql stable security definer set search_path=pg_catalog,public as $owned_hash$
  select public.retailer_catalogue_sha256_json(jsonb_build_object(
    'products',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.products p where p.id in(select value::text::bigint from jsonb_array_elements(p_products))),'[]'::jsonb),
    'product_variants',coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from public.product_variants v where v.id in(select value::text::bigint from jsonb_array_elements(p_variants))),'[]'::jsonb),
    'retailer_products',coalesce((select jsonb_agg(to_jsonb(rp) order by rp.id) from public.retailer_products rp where rp.id in(select value::text::bigint from jsonb_array_elements(p_mappings))),'[]'::jsonb),
    'offers',coalesce((select jsonb_agg(to_jsonb(o) order by o.id) from public.offers o where o.id in(select value::text::bigint from jsonb_array_elements(p_offers))),'[]'::jsonb),
    'price_history',coalesce((select jsonb_agg(to_jsonb(ph) order by ph.id) from public.price_history ph where ph.id in(select value::text::bigint from jsonb_array_elements(p_histories))),'[]'::jsonb)))
$owned_hash$;

create or replace function public.retailer_catalogue_production_runtime_guard(p_target_environment text,p_project_ref text,p_database_identity text)
returns void language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $runtime_guard$
declare v_identity jsonb;
begin
  if p_target_environment is distinct from 'PRODUCTION' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Target environment is not PRODUCTION'); end if;
  if p_project_ref is distinct from 'aftboxmrdgyhizicfsfu' or p_project_ref='hxnrsyyqffztlvcrtgbf' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Project ref is not the exact production ref'); end if;
  if p_database_identity is distinct from 'supplementscout-production:aftboxmrdgyhizicfsfu' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Requested database identity is not production'); end if;
  if current_setting('app.retailer_catalogue_production_marker',true) is distinct from '1' or current_setting('app.retailer_catalogue_allow',true) is distinct from '1' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Production-specific session marker is missing'); end if;
  if coalesce(current_setting('app.safe_update',true),'false') not in ('','false','0','off') then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','SAFE_UPDATE must be false or unset'); end if;
  v_identity:=public.retailer_catalogue_actual_database_target();
  if v_identity->>'project_ref' is distinct from p_project_ref or v_identity->>'database_identity' is distinct from p_database_identity then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Request does not match trusted database identity'); end if;
end
$runtime_guard$;

create or replace function public.retailer_catalogue_production_package_fingerprint(p_package jsonb)
returns text language sql immutable strict set search_path=pg_catalog,public as $package_hash$
  select public.retailer_catalogue_sha256_json(jsonb_set(p_package,'{package_fingerprint}','null'::jsonb,false))
$package_hash$;

create or replace function public.retailer_catalogue_production_request_fingerprint(p_request jsonb)
returns text language sql immutable strict set search_path=pg_catalog,public as $request_hash$
  select public.retailer_catalogue_sha256_json(jsonb_set(p_request,'{request_fingerprint}','null'::jsonb,false))
$request_hash$;

create or replace function public.retailer_catalogue_production_approve_fixture_internal(p_approval jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $approve_fixture$
declare v_id uuid; v_package jsonb; v_actual_ledger text;
begin
  if not public.atomic_import_has_exact_keys(p_approval,array['schema_version','package_id','package_fingerprint','target_environment','production_project_ref','production_database_identity','fixture_id','fixture_fingerprint','fixture_build_commit','source_snapshot_fingerprint','canonical_snapshot_fingerprint','adapter_fingerprint','policy_fingerprint','code_commit','expected_migration_identifiers','expected_migration_ledger_fingerprint','canonical_decisions','approved_by','expires_at']) then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid production fixture approval keys'); end if;
  perform public.retailer_catalogue_production_runtime_guard(p_approval->>'target_environment',p_approval->>'production_project_ref',p_approval->>'production_database_identity');
  if p_approval->>'fixture_id'<>'jons-production-canary-real-10-v1-20260717' or p_approval->>'fixture_fingerprint'<>'2c62a82c169ee20fab8a86c125423aa50b2d9613283907c408726d4ed89981f5' then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Fixture identity rejected'); end if;
  if (p_approval->>'fixture_build_commit')!~'^[0-9a-f]{40}$' or (p_approval->>'code_commit')!~'^[0-9a-f]{40}$' then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Fixture/package commit is invalid'); end if;
  if nullif(trim(p_approval->>'approved_by'),'') is null or p_approval->>'approved_by' in ('service_role','production-executor') or (p_approval->>'expires_at')::timestamptz<=now() or (p_approval->>'expires_at')::timestamptz>now()+interval '120 minutes' then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Fixture approval operator or expiry rejected'); end if;
  if p_approval#>>'{canonical_decisions,50844992602450}' is distinct from 'APPROVE_SIMPLE_CANONICAL' or p_approval#>>'{canonical_decisions,53951719768402}' is distinct from 'APPROVE_SIMPLE_CANONICAL' or p_approval#>>'{canonical_decisions,51935656018258,product_id}' is distinct from '91' or p_approval#>>'{canonical_decisions,51935656018258,variant_id}' is distinct from '39' then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Canonical decision approval rejected'); end if;
  v_package:=p_approval-array['canonical_decisions','approved_by','expires_at'];
  if p_approval->>'package_fingerprint' is distinct from public.retailer_catalogue_production_package_fingerprint(v_package) then perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Immutable production package fingerprint mismatch'); end if;
  v_actual_ledger:=public.retailer_catalogue_assert_migration_ledger(p_approval->'expected_migration_identifiers',p_approval->>'expected_migration_ledger_fingerprint');
  insert into public.retailer_catalogue_production_fixture_approvals(package_id,package_fingerprint,fixture_id,fixture_fingerprint,fixture_build_commit,project_ref,database_identity,migration_ledger_fingerprint,expected_migration_identifiers,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,canonical_decisions,approved_by,expires_at)
  values((p_approval->>'package_id')::uuid,p_approval->>'package_fingerprint',p_approval->>'fixture_id',p_approval->>'fixture_fingerprint',p_approval->>'fixture_build_commit',p_approval->>'production_project_ref',p_approval->>'production_database_identity',v_actual_ledger,p_approval->'expected_migration_identifiers',p_approval->>'source_snapshot_fingerprint',p_approval->>'canonical_snapshot_fingerprint',p_approval->>'adapter_fingerprint',p_approval->>'policy_fingerprint',p_approval->>'code_commit',p_approval->'canonical_decisions',trim(p_approval->>'approved_by'),(p_approval->>'expires_at')::timestamptz) returning id into v_id;
  return jsonb_build_object('fixture_approval_id',v_id,'status','APPROVED','actual_migration_ledger_fingerprint',v_actual_ledger);
end
$approve_fixture$;

create or replace function public.approve_retailer_catalogue_production_fixture(p_approval jsonb)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $approve_fixture_wrapper$
begin
  if current_user<>'retailer_catalogue_production_approver' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Production approver role required'); end if;
  return public.retailer_catalogue_production_approve_fixture_internal(p_approval);
end
$approve_fixture_wrapper$;

create or replace function public.retailer_catalogue_production_approve_parent_internal(p_fixture_approval_id uuid,p_parent_plan_id uuid,p_parent_fingerprint text,p_actor text,p_expires_at timestamptz)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $approve_parent$
declare v_fixture public.retailer_catalogue_production_fixture_approvals%rowtype; v_parent public.retailer_catalogue_parent_plans%rowtype; v_result jsonb;
begin
  select * into v_fixture from public.retailer_catalogue_production_fixture_approvals where id=p_fixture_approval_id for update;
  if not found or v_fixture.expires_at<=now() then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Fixture approval is missing or expired'); end if;
  if v_fixture.consumed_at is not null then perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Fixture approval is already consumed'); end if;
  perform public.retailer_catalogue_assert_migration_ledger(v_fixture.expected_migration_identifiers,v_fixture.migration_ledger_fingerprint);
  select * into v_parent from public.retailer_catalogue_parent_plans where id=p_parent_plan_id;
  if not found or v_parent.target_environment<>'PRODUCTION' or v_parent.parent_plan_fingerprint is distinct from p_parent_fingerprint or v_parent.source_snapshot_fingerprint is distinct from v_fixture.source_snapshot_fingerprint or v_parent.canonical_snapshot_fingerprint is distinct from v_fixture.canonical_snapshot_fingerprint or v_parent.adapter_fingerprint is distinct from v_fixture.adapter_fingerprint or v_parent.policy_fingerprint is distinct from v_fixture.policy_fingerprint or v_parent.code_commit is distinct from v_fixture.code_commit or v_parent.plan_json->>'fixture_fingerprint' is distinct from v_fixture.fixture_fingerprint or v_parent.plan_json->>'package_fingerprint' is distinct from v_fixture.package_fingerprint then perform public.retailer_catalogue_raise('RSBI_PARENT_FINGERPRINT_MISMATCH','Fixture/package approval is not bound to parent'); end if;
  v_result:=public.approve_retailer_catalogue_parent_plan(p_parent_plan_id,p_parent_fingerprint,p_actor,least(p_expires_at,v_fixture.expires_at));
  update public.retailer_catalogue_production_fixture_approvals set consumed_at=now(),parent_plan_id=p_parent_plan_id where id=v_fixture.id;
  return v_result||jsonb_build_object('fixture_approval_id',v_fixture.id,'package_fingerprint',v_fixture.package_fingerprint);
end
$approve_parent$;

create or replace function public.approve_retailer_catalogue_production_parent(p_fixture_approval_id uuid,p_parent_plan_id uuid,p_parent_fingerprint text,p_actor text,p_expires_at timestamptz)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $approve_parent_wrapper$
begin
  if current_user<>'retailer_catalogue_production_approver' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Production approver role required'); end if;
  return public.retailer_catalogue_production_approve_parent_internal(p_fixture_approval_id,p_parent_plan_id,p_parent_fingerprint,p_actor,p_expires_at);
end
$approve_parent_wrapper$;

create or replace function public.retailer_catalogue_execute_production_child_internal(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $execute$
declare v_child public.retailer_catalogue_child_plans%rowtype; v_parent public.retailer_catalogue_parent_plans%rowtype; v_fixture public.retailer_catalogue_production_fixture_approvals%rowtype; v_run jsonb; v_run_id uuid; v_row jsonb; v_plan jsonb; v_approval jsonb; v_result jsonb; v_results jsonb:='[]'; v_approvals jsonb:='[]'; v_before jsonb; v_after jsonb; v_actual jsonb; v_manifest uuid; v_products jsonb:='[]'; v_variants jsonb:='[]'; v_mappings jsonb:='[]'; v_offers jsonb:='[]'; v_histories jsonb:='[]'; v_history bigint; v_completed jsonb; v_error text; v_code text; v_request_fingerprint text; v_execution_fingerprint text; v_rollback_fingerprint text; v_other text; v_shared text; v_orphans jsonb; v_owned text;
begin
  if not public.atomic_import_has_exact_keys(p_request,array['schema_version','target_environment','production_project_ref','production_database_identity','package_id','package_fingerprint','parent_plan_id','child_plan_id','fixture_id','fixture_fingerprint','fixture_approval_id','parent_plan_fingerprint','child_plan_fingerprint','source_snapshot_fingerprint','canonical_snapshot_fingerprint','migration_ledger_fingerprint','adapter_fingerprint','policy_fingerprint','code_commit','expected_deltas','row_plans','approval_expiry','requested_at','explicit_allow','request_fingerprint']) then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid production request keys'); end if;
  v_request_fingerprint:=public.retailer_catalogue_production_request_fingerprint(p_request);
  if p_request->>'request_fingerprint' is distinct from v_request_fingerprint then perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Request fingerprint mismatch'); end if;
  perform public.retailer_catalogue_production_runtime_guard(p_request->>'target_environment',p_request->>'production_project_ref',p_request->>'production_database_identity');
  if coalesce((p_request->>'explicit_allow')::boolean,false)=false then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Explicit production allow flag is missing'); end if;
  select * into v_child from public.retailer_catalogue_child_plans where id=(p_request->>'child_plan_id')::uuid;
  if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Child not found'); end if;
  select * into v_parent from public.retailer_catalogue_parent_plans where id=v_child.parent_plan_id;
  select * into v_fixture from public.retailer_catalogue_production_fixture_approvals where id=(p_request->>'fixture_approval_id')::uuid;
  if not found or v_fixture.parent_plan_id is distinct from v_parent.id or v_fixture.consumed_at is null then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Fixture approval is not bound to parent'); end if;
  if v_fixture.expires_at<=now() or v_child.approval_expires_at<=now() then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Production approval expired'); end if;
  if v_child.status='APPLIED' or v_child.approval_consumed_at is not null then perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Production child approval was already consumed'); end if;
  if v_child.status<>'APPROVED' then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Production child is not approved'); end if;
  if v_fixture.package_id::text is distinct from p_request->>'package_id' or v_fixture.package_fingerprint is distinct from p_request->>'package_fingerprint' then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Package binding mismatch'); end if;
  if v_fixture.fixture_id is distinct from p_request->>'fixture_id' or v_fixture.fixture_fingerprint is distinct from p_request->>'fixture_fingerprint' then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Fixture fingerprint mismatch'); end if;
  if v_fixture.migration_ledger_fingerprint is distinct from p_request->>'migration_ledger_fingerprint' then perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Migration ledger fingerprint mismatch'); end if;
  perform public.retailer_catalogue_assert_migration_ledger(v_fixture.expected_migration_identifiers,v_fixture.migration_ledger_fingerprint);
  if v_child.source_snapshot_fingerprint is distinct from p_request->>'source_snapshot_fingerprint' or v_fixture.source_snapshot_fingerprint is distinct from p_request->>'source_snapshot_fingerprint' then perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Source snapshot fingerprint mismatch'); end if;
  if v_child.canonical_snapshot_fingerprint is distinct from p_request->>'canonical_snapshot_fingerprint' or v_fixture.canonical_snapshot_fingerprint is distinct from p_request->>'canonical_snapshot_fingerprint' then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Canonical snapshot fingerprint mismatch'); end if;
  if v_child.adapter_fingerprint is distinct from p_request->>'adapter_fingerprint' or v_fixture.adapter_fingerprint is distinct from p_request->>'adapter_fingerprint' then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Adapter fingerprint mismatch'); end if;
  if v_child.policy_fingerprint is distinct from p_request->>'policy_fingerprint' or v_fixture.policy_fingerprint is distinct from p_request->>'policy_fingerprint' then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Policy fingerprint mismatch'); end if;
  if v_child.code_commit is distinct from p_request->>'code_commit' or v_fixture.code_commit is distinct from p_request->>'code_commit' then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Code commit mismatch'); end if;
  if v_parent.parent_plan_fingerprint is distinct from p_request->>'parent_plan_fingerprint' or v_child.child_plan_fingerprint is distinct from p_request->>'child_plan_fingerprint' or v_child.expected_deltas is distinct from p_request->'expected_deltas' or jsonb_array_length(p_request->'row_plans')<>jsonb_array_length(v_child.record_ids) or (p_request->>'approval_expiry')::timestamptz>v_child.approval_expires_at then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Request is not bound to approved production child'); end if;
  for v_row in select value from jsonb_array_elements(p_request->'row_plans') loop
    if not public.atomic_import_has_exact_keys(v_row,array['phase1_row_plan','atomic_plan','row_plan_fingerprint','artifact_sha256']) or v_row#>>'{row_plan_fingerprint}' is distinct from v_row#>>'{phase1_row_plan,fingerprints,row_plan}' then perform public.retailer_catalogue_raise('RSBI_ROW_PLAN_FINGERPRINT_MISMATCH','Row binding mismatch'); end if;
    if v_row#>>'{phase1_row_plan,source_record_id}'='51935656018258' and (v_row#>>'{atomic_plan,product,id}' is distinct from '91' or v_row#>>'{atomic_plan,product_variant,id}' is distinct from '39') then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Project AD must reuse product 91 and variant 39'); end if;
    if v_row#>>'{atomic_plan,product,action}'='create' and v_row#>>'{phase1_row_plan,source_record_id}' not in ('50844992602450','53951719768402') then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Canonical creation is outside the approved fixture'); end if;
    if v_row#>>'{atomic_plan,product,action}'='create' and (v_row#>>'{atomic_plan,product_variant,action}' is distinct from 'create_default' or v_row#>>'{atomic_plan,product_variant,evidence,flavour}' is not null or coalesce((v_row#>>'{atomic_plan,product_variant,evidence,pack_count}')::integer,1)<>1) then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Only approved simple default canonical products are allowed'); end if;
    perform public.validate_product_import_plan_read_only(v_row->'atomic_plan');
  end loop;
  v_orphans:=public.retailer_catalogue_orphan_counts();
  if exists(select 1 from jsonb_each_text(v_orphans) where value::bigint<>0) then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Pre-apply orphan state is not clean',v_orphans); end if;
  v_run:=public.begin_retailer_catalogue_child_apply(v_child.id,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_child.source_snapshot_fingerprint,v_child.canonical_snapshot_fingerprint,v_child.adapter_fingerprint,v_child.policy_fingerprint,v_child.code_commit,v_child.expected_state_fingerprint,'production-executor');
  if v_run->>'code'='RSBI_REPLAY_BLOCKED' then return v_run||jsonb_build_object('request_fingerprint',v_request_fingerprint,'replay_status','BLOCKED'); end if;
  v_run_id:=(v_run->>'run_id')::uuid;
  begin
    v_before:=public.retailer_catalogue_business_counts(); v_other:=public.retailer_catalogue_other_retailer_fingerprint(v_child.retailer_id); v_shared:=public.retailer_catalogue_protected_shared_fingerprint();
    for v_row in select value from jsonb_array_elements(p_request->'row_plans') order by value#>>'{phase1_row_plan,source_record_id}' loop
      v_plan:=v_row->'atomic_plan';
      v_approval:=public.approve_product_import_plan(v_plan,v_row->>'artifact_sha256','stg-'||replace(v_run_id::text,'-','')||'-'||left(v_row->>'row_plan_fingerprint',12),'production_child',least(v_child.approval_expires_at,now()+interval '15 minutes'));
      v_result:=public.apply_approved_product_import_plan((v_approval->>'approval_id')::uuid,v_row->>'artifact_sha256',v_plan#>>'{meta,plan_fingerprint}',v_plan#>>'{meta,source_row_fingerprint}',nullif(v_plan#>>'{retailer,id}','')::bigint,v_plan#>>'{meta,plan_kind}',v_approval->>'run_id');
      v_approvals:=v_approvals||jsonb_build_array(v_approval->>'approval_id'); v_results:=v_results||jsonb_build_array(v_result);
      if v_plan#>>'{product,action}'='create' then v_products:=v_products||jsonb_build_array((v_result->>'product_id')::bigint); end if;
      if v_plan#>>'{product_variant,action}'='create_default' then v_variants:=v_variants||jsonb_build_array((v_result->>'product_variant_id')::bigint); end if;
      if v_plan#>>'{retailer_product,action}'='create' then v_mappings:=v_mappings||jsonb_build_array((v_result->>'retailer_product_id')::bigint); end if;
      if v_plan#>>'{offer,action}'='create' then v_offers:=v_offers||jsonb_build_array((v_result->>'offer_id')::bigint); end if;
      if v_plan#>>'{price_history,action}'='create' then select id into v_history from public.price_history where offer_id=(v_result->>'offer_id')::bigint order by id desc limit 1; v_histories:=v_histories||jsonb_build_array(v_history); end if;
    end loop;
    v_after:=public.retailer_catalogue_business_counts();
    select jsonb_object_agg(k,(v_after->>k)::bigint-(v_before->>k)::bigint) into v_actual from unnest(array['products','product_variants','retailer_products','offers','price_history']) k;
    v_actual:=jsonb_build_object('retailers',0)||v_actual;
    if v_actual is distinct from p_request->'expected_deltas' then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Exact child deltas mismatch',jsonb_build_object('expected',p_request->'expected_deltas','actual',v_actual)); end if;
    v_execution_fingerprint:=public.retailer_catalogue_sha256_json(jsonb_build_object('request',v_request_fingerprint,'run',v_run_id,'results',v_results,'actual_deltas',v_actual));
    v_owned:=public.retailer_catalogue_owned_state_fingerprint(v_products,v_variants,v_mappings,v_offers,v_histories);
    v_rollback_fingerprint:=public.retailer_catalogue_sha256_json(jsonb_build_object('child_plan_id',v_child.id,'apply_run_id',v_run_id,'execution_fingerprint',v_execution_fingerprint,'created_product_ids',v_products,'created_variant_ids',v_variants,'created_mapping_ids',v_mappings,'created_offer_ids',v_offers,'created_price_history_ids',v_histories,'before_counts',v_before,'other_retailer_fingerprint',v_other,'protected_shared_fingerprint',v_shared,'orphan_counts',v_orphans,'applied_owned_state_fingerprint',v_owned));
    v_completed:=public.complete_retailer_catalogue_child_apply(v_run_id,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_after,jsonb_build_object('row_results',v_results,'approval_ids',v_approvals,'actual_deltas',v_actual,'execution_fingerprint',v_execution_fingerprint),'production-executor');
    insert into public.retailer_catalogue_production_recovery_manifests(package_id,package_fingerprint,child_plan_id,apply_run_id,dependency_group,execution_fingerprint,rollback_manifest_fingerprint,created_product_ids,created_variant_ids,created_mapping_ids,created_offer_ids,created_price_history_ids,updated_before_state,ownership,reverse_dependency_order,before_counts,other_retailer_fingerprint,protected_shared_fingerprint,orphan_counts,applied_owned_state_fingerprint)
    values(v_fixture.package_id,v_fixture.package_fingerprint,v_child.id,v_run_id,v_child.dependency_group,v_execution_fingerprint,v_rollback_fingerprint,v_products,v_variants,v_mappings,v_offers,v_histories,'[]',jsonb_build_object('plan_owned_only',true,'retailer_id',v_child.retailer_id,'protected_shared_product_id',case when v_child.dependency_group='DG3_PROJECT_AD_OFFER' then 91 else null end,'protected_shared_variant_id',case when v_child.dependency_group='DG3_PROJECT_AD_OFFER' then 39 else null end),jsonb_build_array('price_history','offers','retailer_products','product_variants','products'),v_before,v_other,v_shared,v_orphans,v_owned) returning id into v_manifest;
    return jsonb_build_object('request_fingerprint',v_request_fingerprint,'approval_ids',v_approvals,'row_results',v_results,'before_counts',v_before,'after_counts',v_after,'exact_deltas',v_actual,'expected_delta_comparison',true,'child_status','APPLIED','parent_status',v_completed->>'parent_status','replay_status','NOT_REPLAY','rollback_metadata',jsonb_build_object('manifest_id',v_manifest,'manifest_fingerprint',v_rollback_fingerprint,'status','READY'),'error_code',null,'execution_fingerprint',v_execution_fingerprint);
  exception when others then
    get stacked diagnostics v_error=message_text; v_code:=coalesce(substring(v_error from 'RSBI_[A-Z_]+'),'RSBI_ATOMIC_APPLY_FAILED');
    v_completed:=public.fail_retailer_catalogue_child_apply(v_run_id,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_code,jsonb_build_object('transaction_rolled_back',true,'message',v_error),'production-executor');
    return jsonb_build_object('request_fingerprint',v_request_fingerprint,'approval_ids','[]'::jsonb,'row_results','[]'::jsonb,'before_counts',v_before,'after_counts',v_before,'exact_deltas',jsonb_build_object('retailers',0,'products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0),'expected_delta_comparison',false,'child_status','FAILED','parent_status',v_completed->>'parent_status','replay_status','NOT_REPLAY','rollback_metadata',jsonb_build_object('status','TRANSACTION_ROLLED_BACK'),'error_code',v_code,'execution_fingerprint',null);
  end;
end
$execute$;

create or replace function public.execute_production_retailer_catalogue_child(p_request jsonb)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $execute_wrapper$
begin
  if current_user<>'retailer_catalogue_production_executor' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Production executor role required'); end if;
  return public.retailer_catalogue_execute_production_child_internal(p_request);
end
$execute_wrapper$;

create or replace function public.retailer_catalogue_expected_recovery_state(p_manifest_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $expected_recovery$
declare v_manifest public.retailer_catalogue_production_recovery_manifests%rowtype; v_child public.retailer_catalogue_child_plans%rowtype; v_parent_status text;
begin
  select * into v_manifest from public.retailer_catalogue_production_recovery_manifests where id=p_manifest_id;
  if not found then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Recovery manifest not found'); end if;
  select * into v_child from public.retailer_catalogue_child_plans where id=v_manifest.child_plan_id;
  if exists(select 1 from public.retailer_catalogue_child_plans where parent_plan_id=v_child.parent_plan_id and id<>v_child.id and status<>'ROLLED_BACK') then select status into v_parent_status from public.retailer_catalogue_parent_plans where id=v_child.parent_plan_id; else v_parent_status:='ROLLED_BACK'; end if;
  return jsonb_build_object('business_counts',v_manifest.before_counts,'child_status','ROLLED_BACK','original_apply_status','SUCCEEDED','recovery_run_status','ROLLED_BACK','recovery_approval_consumed',true,'parent_status',v_parent_status,'manifest_status','RECOVERED','ownership_markers',v_manifest.ownership,'other_retailer_fingerprint',v_manifest.other_retailer_fingerprint,'protected_shared_fingerprint',v_manifest.protected_shared_fingerprint,'orphan_counts',v_manifest.orphan_counts,'created_records_remaining',jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0));
end
$expected_recovery$;

create or replace function public.retailer_catalogue_production_approve_recovery_internal(p_approval jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $approve_recovery$
declare v_manifest public.retailer_catalogue_production_recovery_manifests%rowtype; v_child public.retailer_catalogue_child_plans%rowtype; v_expected jsonb; v_expected_fp text; v_id uuid;
begin
  if not public.atomic_import_has_exact_keys(p_approval,array['schema_version','target_environment','production_project_ref','production_database_identity','package_id','package_fingerprint','child_plan_id','execution_fingerprint','rollback_manifest_fingerprint','expected_recovery_state_fingerprint','approved_by','expires_at']) then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid recovery approval keys'); end if;
  perform public.retailer_catalogue_production_runtime_guard(p_approval->>'target_environment',p_approval->>'production_project_ref',p_approval->>'production_database_identity');
  if nullif(trim(p_approval->>'approved_by'),'') is null or p_approval->>'approved_by' in ('service_role','production-executor') or (p_approval->>'expires_at')::timestamptz<=now() or (p_approval->>'expires_at')::timestamptz>now()+interval '30 minutes' then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Recovery approval operator or expiry rejected'); end if;
  select * into v_manifest from public.retailer_catalogue_production_recovery_manifests where child_plan_id=(p_approval->>'child_plan_id')::uuid for update;
  if not found or v_manifest.status<>'READY' or v_manifest.package_id::text is distinct from p_approval->>'package_id' or v_manifest.package_fingerprint is distinct from p_approval->>'package_fingerprint' or v_manifest.execution_fingerprint is distinct from p_approval->>'execution_fingerprint' or v_manifest.rollback_manifest_fingerprint is distinct from p_approval->>'rollback_manifest_fingerprint' then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Recovery manifest binding rejected'); end if;
  select * into v_child from public.retailer_catalogue_child_plans where id=v_manifest.child_plan_id;
  if v_child.status<>'APPLIED' then perform public.retailer_catalogue_raise('RSBI_PARTIAL_BATCH_STATE','Child is not in exact committed state'); end if;
  v_expected:=public.retailer_catalogue_expected_recovery_state(v_manifest.id); v_expected_fp:=public.retailer_catalogue_sha256_json(v_expected);
  if v_expected_fp is distinct from p_approval->>'expected_recovery_state_fingerprint' then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Expected recovery state fingerprint mismatch'); end if;
  update public.retailer_catalogue_production_recovery_approvals set consumed_at=now() where recovery_manifest_id=v_manifest.id and consumed_at is null and expires_at<=now();
  if exists(select 1 from public.retailer_catalogue_production_recovery_approvals where recovery_manifest_id=v_manifest.id and consumed_at is null) then perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','An unexpired recovery approval already exists'); end if;
  insert into public.retailer_catalogue_production_recovery_approvals(recovery_manifest_id,package_id,package_fingerprint,project_ref,database_identity,child_plan_id,execution_fingerprint,rollback_manifest_fingerprint,expected_recovery_state,expected_recovery_state_fingerprint,approved_by,expires_at)
  values(v_manifest.id,v_manifest.package_id,v_manifest.package_fingerprint,p_approval->>'production_project_ref',p_approval->>'production_database_identity',v_child.id,v_manifest.execution_fingerprint,v_manifest.rollback_manifest_fingerprint,v_expected,v_expected_fp,trim(p_approval->>'approved_by'),(p_approval->>'expires_at')::timestamptz) returning id into v_id;
  return jsonb_build_object('recovery_approval_id',v_id,'status','APPROVED','expected_recovery_state_fingerprint',v_expected_fp);
end
$approve_recovery$;

create or replace function public.approve_retailer_catalogue_production_recovery(p_approval jsonb)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $approve_recovery_wrapper$
begin
  if current_user<>'retailer_catalogue_production_approver' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Production approver role required'); end if;
  return public.retailer_catalogue_production_approve_recovery_internal(p_approval);
end
$approve_recovery_wrapper$;

create or replace function public.retailer_catalogue_recover_production_child_internal(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $recover$
declare v_manifest public.retailer_catalogue_production_recovery_manifests%rowtype; v_approval public.retailer_catalogue_production_recovery_approvals%rowtype; v_child public.retailer_catalogue_child_plans%rowtype; v_parent public.retailer_catalogue_parent_plans%rowtype; v_apply public.retailer_catalogue_apply_runs%rowtype; v_run_id uuid; v_attempt integer; v_archived jsonb; v_actual jsonb; v_parent_status text; v_request_fp text; v_error text; v_code text; v_owned text; v_evidence jsonb;
begin
  if not public.atomic_import_has_exact_keys(p_request,array['schema_version','target_environment','production_project_ref','production_database_identity','package_id','package_fingerprint','child_plan_id','parent_plan_fingerprint','child_plan_fingerprint','recovery_approval_id','execution_fingerprint','rollback_manifest_fingerprint','requested_at','explicit_allow','request_fingerprint']) then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid recovery request keys'); end if;
  v_request_fp:=public.retailer_catalogue_production_request_fingerprint(p_request);
  if p_request->>'request_fingerprint' is distinct from v_request_fp then perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Recovery request fingerprint mismatch'); end if;
  perform public.retailer_catalogue_production_runtime_guard(p_request->>'target_environment',p_request->>'production_project_ref',p_request->>'production_database_identity');
  if coalesce((p_request->>'explicit_allow')::boolean,false)=false then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Explicit recovery allow flag is missing'); end if;
  select * into v_approval from public.retailer_catalogue_production_recovery_approvals where id=(p_request->>'recovery_approval_id')::uuid for update;
  if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Recovery approval not found'); end if;
  if v_approval.consumed_at is not null then perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Recovery approval already consumed'); end if;
  if v_approval.expires_at<=now() then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Recovery approval expired'); end if;
  select * into v_manifest from public.retailer_catalogue_production_recovery_manifests where id=v_approval.recovery_manifest_id for update;
  select * into v_child from public.retailer_catalogue_child_plans where id=v_manifest.child_plan_id; select * into v_parent from public.retailer_catalogue_parent_plans where id=v_child.parent_plan_id; select * into v_apply from public.retailer_catalogue_apply_runs where id=v_manifest.apply_run_id;
  if v_approval.child_plan_id::text is distinct from p_request->>'child_plan_id' or v_manifest.child_plan_id::text is distinct from p_request->>'child_plan_id' or v_approval.package_id::text is distinct from p_request->>'package_id' or v_approval.package_fingerprint is distinct from p_request->>'package_fingerprint' or v_approval.execution_fingerprint is distinct from p_request->>'execution_fingerprint' or v_approval.rollback_manifest_fingerprint is distinct from p_request->>'rollback_manifest_fingerprint' or v_child.child_plan_fingerprint is distinct from p_request->>'child_plan_fingerprint' or v_parent.parent_plan_fingerprint is distinct from p_request->>'parent_plan_fingerprint' then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Recovery request approval binding mismatch'); end if;
  if v_manifest.status<>'READY' or v_child.status<>'APPLIED' or v_apply.status<>'SUCCEEDED' or jsonb_array_length(v_manifest.updated_before_state)<>0 then perform public.retailer_catalogue_raise('RSBI_PARTIAL_BATCH_STATE','Committed child is not in exact recoverable state'); end if;
  v_owned:=public.retailer_catalogue_owned_state_fingerprint(v_manifest.created_product_ids,v_manifest.created_variant_ids,v_manifest.created_mapping_ids,v_manifest.created_offer_ids,v_manifest.created_price_history_ids);
  if v_owned is distinct from v_manifest.applied_owned_state_fingerprint then perform public.retailer_catalogue_raise('RSBI_PARTIAL_BATCH_STATE','Owned rows were partially removed or manually modified'); end if;
  if public.retailer_catalogue_other_retailer_fingerprint(v_child.retailer_id) is distinct from v_manifest.other_retailer_fingerprint or exists(select 1 from public.retailer_products rp where rp.retailer_id<>v_child.retailer_id and (rp.product_id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_product_ids)) or rp.product_variant_id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_variant_ids)))) or exists(select 1 from public.offers o where o.retailer_id<>v_child.retailer_id and (o.product_id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_product_ids)) or o.product_variant_id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_variant_ids)))) then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Cross-retailer ownership conflict detected'); end if;
  if public.retailer_catalogue_protected_shared_fingerprint() is distinct from v_manifest.protected_shared_fingerprint then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Protected shared Project AD records changed'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_child.id::text,0));
  update public.retailer_catalogue_production_recovery_approvals set consumed_at=now() where id=v_approval.id;
  select coalesce(max(attempt_ordinal),0)+1 into v_attempt from public.retailer_catalogue_apply_runs where child_plan_id=v_child.id and run_type='ROLLBACK';
  insert into public.retailer_catalogue_apply_runs(parent_plan_id,child_plan_id,retailer_id,target_environment,run_type,attempt_ordinal,status,parent_plan_fingerprint,child_plan_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,approval_id,approval_expires_at,rollback_fingerprint,rollback_manifest,expected_deltas,started_by)
  values(v_parent.id,v_child.id,v_child.retailer_id,'PRODUCTION','ROLLBACK',v_attempt,'STARTED',v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_child.source_snapshot_fingerprint,v_child.canonical_snapshot_fingerprint,v_child.adapter_fingerprint,v_child.policy_fingerprint,v_child.code_commit,v_child.expected_state_fingerprint,v_approval.id,v_approval.expires_at,v_manifest.rollback_manifest_fingerprint,v_child.rollback_manifest,v_child.expected_deltas,v_approval.approved_by) returning id into v_run_id;
  begin
    select jsonb_build_object(
      'products',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.products p where p.id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_product_ids))),'[]'::jsonb),
      'product_variants',coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from public.product_variants v where v.id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_variant_ids))),'[]'::jsonb),
      'retailer_products',coalesce((select jsonb_agg(to_jsonb(rp) order by rp.id) from public.retailer_products rp where rp.id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_mapping_ids))),'[]'::jsonb),
      'offers',coalesce((select jsonb_agg(to_jsonb(o) order by o.id) from public.offers o where o.id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_offer_ids))),'[]'::jsonb),
      'price_history',coalesce((select jsonb_agg(to_jsonb(ph) order by ph.id) from public.price_history ph where ph.id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_price_history_ids))),'[]'::jsonb)) into v_archived;
    delete from public.price_history where id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_price_history_ids));
    delete from public.offers where id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_offer_ids));
    delete from public.retailer_products where id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_mapping_ids));
    delete from public.product_variants v where v.id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_variant_ids)) and not exists(select 1 from public.retailer_products rp where rp.product_variant_id=v.id) and not exists(select 1 from public.offers o where o.product_variant_id=v.id);
    delete from public.products p where p.id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_product_ids)) and not exists(select 1 from public.product_variants v where v.product_id=p.id) and not exists(select 1 from public.retailer_products rp where rp.product_id=p.id) and not exists(select 1 from public.offers o where o.product_id=p.id);
    update public.retailer_catalogue_production_recovery_manifests set status='RECOVERED',recovered_at=now() where id=v_manifest.id;
    update public.retailer_catalogue_apply_runs set status='ROLLED_BACK',result_metadata=jsonb_build_object('manifest_id',v_manifest.id,'recovery_approval_id',v_approval.id),completed_at=now() where id=v_run_id;
    update public.retailer_catalogue_child_plans set status='ROLLED_BACK',rollback_requested_at=now(),rollback_requested_by=v_approval.approved_by,audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','PRODUCTION_COMMITTED_RECOVERY','run_id',v_run_id,'approval_id',v_approval.id,'at',now())) where id=v_child.id;
    if not exists(select 1 from public.retailer_catalogue_child_plans where parent_plan_id=v_parent.id and status<>'ROLLED_BACK') then update public.retailer_catalogue_parent_plans set status='ROLLED_BACK' where id=v_parent.id; v_parent_status:='ROLLED_BACK'; else select status into v_parent_status from public.retailer_catalogue_parent_plans where id=v_parent.id; end if;
    v_actual:=jsonb_build_object('business_counts',public.retailer_catalogue_business_counts(),'child_status',(select status from public.retailer_catalogue_child_plans where id=v_child.id),'original_apply_status',(select status from public.retailer_catalogue_apply_runs where id=v_manifest.apply_run_id),'recovery_run_status',(select status from public.retailer_catalogue_apply_runs where id=v_run_id),'recovery_approval_consumed',(select consumed_at is not null from public.retailer_catalogue_production_recovery_approvals where id=v_approval.id),'parent_status',v_parent_status,'manifest_status',(select status from public.retailer_catalogue_production_recovery_manifests where id=v_manifest.id),'ownership_markers',v_manifest.ownership,'other_retailer_fingerprint',public.retailer_catalogue_other_retailer_fingerprint(v_child.retailer_id),'protected_shared_fingerprint',public.retailer_catalogue_protected_shared_fingerprint(),'orphan_counts',public.retailer_catalogue_orphan_counts(),'created_records_remaining',jsonb_build_object('products',(select count(*) from public.products where id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_product_ids))),'product_variants',(select count(*) from public.product_variants where id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_variant_ids))),'retailer_products',(select count(*) from public.retailer_products where id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_mapping_ids))),'offers',(select count(*) from public.offers where id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_offer_ids))),'price_history',(select count(*) from public.price_history where id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_price_history_ids)))));
    if v_actual is distinct from v_approval.expected_recovery_state then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Exact post-recovery validation mismatch',jsonb_build_object('expected',v_approval.expected_recovery_state,'actual',v_actual)); end if;
    insert into public.retailer_catalogue_production_recovery_audit(recovery_manifest_id,recovery_approval_id,recovery_run_id,event,archived_rows,validation_evidence,actor) values(v_manifest.id,v_approval.id,v_run_id,'COMMITTED_CHILD_RECOVERED',v_archived,jsonb_build_object('expected',v_approval.expected_recovery_state,'actual',v_actual,'match',true),v_approval.approved_by);
    return jsonb_build_object('child_plan_id',v_child.id,'recovery_status','RECOVERED','parent_status',v_parent_status,'protected_shared_product_id',v_manifest.ownership->'protected_shared_product_id','protected_shared_variant_id',v_manifest.ownership->'protected_shared_variant_id','audit_preserved',true,'exact_post_recovery_validation',true);
  exception when others then
    get stacked diagnostics v_error=message_text; v_code:=coalesce(substring(v_error from 'RSBI_[A-Z_]+'),'RSBI_EXPECTED_STATE_MISMATCH');
    v_evidence:=jsonb_build_object('error_code',v_code,'message',v_error,'expected',v_approval.expected_recovery_state,'observed_before_rollback',v_actual,'bounded_recovery_transaction_rolled_back',true);
    update public.retailer_catalogue_apply_runs set status='FAILED',error_code=v_code,result_metadata=v_evidence,completed_at=now() where id=v_run_id;
    update public.retailer_catalogue_production_recovery_manifests set status='FAILED',failure_evidence=v_evidence where id=v_manifest.id;
    insert into public.retailer_catalogue_production_recovery_audit(recovery_manifest_id,recovery_approval_id,recovery_run_id,event,archived_rows,validation_evidence,actor) values(v_manifest.id,v_approval.id,v_run_id,'COMMITTED_CHILD_RECOVERY_FAILED',coalesce(v_archived,'{}'::jsonb),v_evidence,v_approval.approved_by);
    return jsonb_build_object('child_plan_id',v_child.id,'recovery_status','FAILED','error_code',v_code,'audit_preserved',true,'exact_post_recovery_validation',false,'transaction_rolled_back',true);
  end;
end
$recover$;

create or replace function public.recover_production_retailer_catalogue_child(p_request jsonb)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $recover_wrapper$
begin
  if current_user<>'retailer_catalogue_production_executor' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Production executor role required'); end if;
  return public.retailer_catalogue_recover_production_child_internal(p_request);
end
$recover_wrapper$;

alter function public.retailer_catalogue_sha256_json(jsonb) owner to postgres;
alter function public.retailer_catalogue_actual_database_target() owner to postgres;
alter function public.retailer_catalogue_actual_migration_ledger() owner to postgres;
alter function public.retailer_catalogue_actual_migration_ledger_fingerprint() owner to postgres;
alter function public.retailer_catalogue_assert_migration_ledger(jsonb,text) owner to postgres;
alter function public.retailer_catalogue_business_counts() owner to postgres;
alter function public.retailer_catalogue_orphan_counts() owner to postgres;
alter function public.retailer_catalogue_other_retailer_fingerprint(bigint) owner to postgres;
alter function public.retailer_catalogue_protected_shared_fingerprint() owner to postgres;
alter function public.retailer_catalogue_owned_state_fingerprint(jsonb,jsonb,jsonb,jsonb,jsonb) owner to postgres;
alter function public.retailer_catalogue_production_runtime_guard(text,text,text) owner to postgres;
alter function public.retailer_catalogue_production_package_fingerprint(jsonb) owner to postgres;
alter function public.retailer_catalogue_production_request_fingerprint(jsonb) owner to postgres;
alter function public.retailer_catalogue_production_approve_fixture_internal(jsonb) owner to postgres;
alter function public.approve_retailer_catalogue_production_fixture(jsonb) owner to postgres;
alter function public.retailer_catalogue_production_approve_parent_internal(uuid,uuid,text,text,timestamptz) owner to postgres;
alter function public.approve_retailer_catalogue_production_parent(uuid,uuid,text,text,timestamptz) owner to postgres;
alter function public.retailer_catalogue_execute_production_child_internal(jsonb) owner to postgres;
alter function public.execute_production_retailer_catalogue_child(jsonb) owner to postgres;
alter function public.retailer_catalogue_expected_recovery_state(uuid) owner to postgres;
alter function public.retailer_catalogue_production_approve_recovery_internal(jsonb) owner to postgres;
alter function public.approve_retailer_catalogue_production_recovery(jsonb) owner to postgres;
alter function public.retailer_catalogue_recover_production_child_internal(jsonb) owner to postgres;
alter function public.recover_production_retailer_catalogue_child(jsonb) owner to postgres;

revoke all on function public.retailer_catalogue_sha256_json(jsonb),public.retailer_catalogue_actual_database_target(),public.retailer_catalogue_actual_migration_ledger(),public.retailer_catalogue_actual_migration_ledger_fingerprint(),public.retailer_catalogue_assert_migration_ledger(jsonb,text),public.retailer_catalogue_business_counts(),public.retailer_catalogue_orphan_counts(),public.retailer_catalogue_other_retailer_fingerprint(bigint),public.retailer_catalogue_protected_shared_fingerprint(),public.retailer_catalogue_owned_state_fingerprint(jsonb,jsonb,jsonb,jsonb,jsonb),public.retailer_catalogue_production_runtime_guard(text,text,text),public.retailer_catalogue_production_package_fingerprint(jsonb),public.retailer_catalogue_production_request_fingerprint(jsonb),public.retailer_catalogue_production_approve_fixture_internal(jsonb),public.retailer_catalogue_production_approve_parent_internal(uuid,uuid,text,text,timestamptz),public.retailer_catalogue_execute_production_child_internal(jsonb),public.retailer_catalogue_expected_recovery_state(uuid),public.retailer_catalogue_production_approve_recovery_internal(jsonb),public.retailer_catalogue_recover_production_child_internal(jsonb) from public,anon,authenticated,service_role,retailer_catalogue_production_approver,retailer_catalogue_production_executor;
revoke all on function public.approve_retailer_catalogue_production_fixture(jsonb),public.approve_retailer_catalogue_production_parent(uuid,uuid,text,text,timestamptz),public.execute_production_retailer_catalogue_child(jsonb),public.approve_retailer_catalogue_production_recovery(jsonb),public.recover_production_retailer_catalogue_child(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.approve_retailer_catalogue_production_fixture(jsonb),public.approve_retailer_catalogue_production_parent(uuid,uuid,text,text,timestamptz),public.approve_retailer_catalogue_production_recovery(jsonb) to retailer_catalogue_production_approver;
grant execute on function public.execute_production_retailer_catalogue_child(jsonb),public.recover_production_retailer_catalogue_child(jsonb) to retailer_catalogue_production_executor;
revoke execute on function public.apply_product_import_plan(jsonb),public.approve_product_import_plan(jsonb,text,text,text,timestamptz),public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) from retailer_catalogue_production_approver,retailer_catalogue_production_executor;


-- Source: supabase\migrations\20260718150000_add_verified_no_change_offer_refresh.sql

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.validate_product_import_plan_read_only(jsonb)') is null
     or to_regprocedure('public.apply_product_import_plan(jsonb)') is null
     or to_regprocedure('public.approve_product_import_plan(jsonb,text,text,text,timestamptz)') is null
     or to_regprocedure('public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)') is null
     or to_regclass('public.approved_import_plans') is null then
    raise exception 'verified no-change refresh requires the atomic importer and approval ledger';
  end if;
  if to_regprocedure('public.atomic_import_validate_standard_plan_core(jsonb)') is not null
     or to_regprocedure('public.atomic_import_apply_standard_plan_core(jsonb)') is not null
     or to_regclass('public.verified_offer_refresh_targets') is not null then
    raise exception 'verified no-change refresh migration is already installed';
  end if;
end
$preflight$;

-- Owner-provisioned attestation. A client/session setting cannot choose the target.
create table public.verified_offer_refresh_targets (
  id boolean primary key default true check(id),
  target_environment text not null check(target_environment='PRODUCTION'),
  project_ref text not null check(project_ref='aftboxmrdgyhizicfsfu'),
  database_system_identifier text not null,
  database_oid oid not null,
  is_active boolean not null default true,
  attested_by text not null,
  attested_at timestamptz not null default now()
);
alter table public.verified_offer_refresh_targets owner to postgres;
alter table public.verified_offer_refresh_targets enable row level security;
alter table public.verified_offer_refresh_targets force row level security;
revoke all on table public.verified_offer_refresh_targets from public,anon,authenticated,service_role;

create or replace function public.verified_offer_refresh_actual_target()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $target$
declare
  v_target public.verified_offer_refresh_targets%rowtype;
  v_system text;
  v_oid oid;
begin
  select * into v_target from public.verified_offer_refresh_targets where id=true and is_active;
  if not found then raise exception 'verified no-change target attestation is missing'; end if;
  select system_identifier::text into v_system from pg_catalog.pg_control_system();
  select oid into v_oid from pg_catalog.pg_database where datname=current_database();
  if v_target.database_system_identifier is distinct from v_system
     or v_target.database_oid is distinct from v_oid
     or v_target.target_environment<>'PRODUCTION'
     or v_target.project_ref<>'aftboxmrdgyhizicfsfu' then
    raise exception 'verified no-change target attestation rejected';
  end if;
  return jsonb_build_object('target_environment',v_target.target_environment,'project_ref',v_target.project_ref);
end
$target$;

create or replace function public.validate_verified_offer_no_change_plan(p_plan jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $validate$
declare
  v_target jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_retailer public.retailers%rowtype;
  v_mapping public.retailer_products%rowtype;
  v_offer public.offers%rowtype;
  v_expected jsonb;
  v_actual jsonb;
  v_capture timestamptz;
begin
  if not public.atomic_import_has_exact_keys(p_plan,array['meta','product','product_variant','retailer','retailer_product','offer','price_history','approval','expected_state'])
     or jsonb_path_exists(p_plan,'$.** ? (@.type() == "number")') then
    raise exception 'invalid verified no-change plan: closed decimal-string schema';
  end if;
  if not public.atomic_import_has_exact_keys(p_plan->'meta',array['version','plan_kind','operation_type','source_row_fingerprint','plan_fingerprint','target_environment','target_project_ref','source_snapshot_sha256','source_captured_at'])
     or p_plan#>>'{meta,version}'<>'2'
     or p_plan#>>'{meta,plan_kind}'<>'feed'
     or p_plan#>>'{meta,operation_type}'<>'verify_offer_no_change'
     or p_plan#>>'{meta,source_row_fingerprint}'!~'^[0-9a-f]{64}$'
     or p_plan#>>'{meta,source_snapshot_sha256}'!~'^[0-9a-f]{64}$'
     or p_plan#>>'{meta,plan_fingerprint}'!~'^[0-9a-f]{32}$'
     or md5(public.atomic_import_canonical_json(jsonb_set(p_plan,'{meta,plan_fingerprint}','null'::jsonb,false)))<>p_plan#>>'{meta,plan_fingerprint}' then
    raise exception 'invalid verified no-change plan: metadata or fingerprint';
  end if;
  v_capture:=(p_plan#>>'{meta,source_captured_at}')::timestamptz;
  if v_capture<now()-interval '24 hours' or v_capture>now()+interval '5 minutes' then
    raise exception 'verified no-change source capture is stale or in the future';
  end if;
  v_target:=public.verified_offer_refresh_actual_target();
  if v_target->>'target_environment' is distinct from p_plan#>>'{meta,target_environment}'
     or v_target->>'project_ref' is distinct from p_plan#>>'{meta,target_project_ref}' then
    raise exception 'verified no-change wrong target';
  end if;

  if not public.atomic_import_has_exact_keys(p_plan->'product',array['action','id']) or p_plan#>>'{product,action}'<>'existing'
     or not public.atomic_import_has_exact_keys(p_plan->'product_variant',array['action','id','evidence']) or p_plan#>>'{product_variant,action}'<>'existing'
     or not public.atomic_import_has_exact_keys(p_plan#>'{product_variant,evidence}',array['external_product_id','external_variant_id'])
     or not public.atomic_import_has_exact_keys(p_plan->'retailer',array['action','id']) or p_plan#>>'{retailer,action}'<>'existing'
     or not public.atomic_import_has_exact_keys(p_plan->'retailer_product',array['action','id','values']) or p_plan#>>'{retailer_product,action}'<>'noop'
     or not public.atomic_import_has_exact_keys(p_plan->'offer',array['action','id','values']) or p_plan#>>'{offer,action}'<>'verify_no_change'
     or not public.atomic_import_has_exact_keys(p_plan->'price_history',array['action']) or p_plan#>>'{price_history,action}'<>'noop'
     or p_plan->'approval'<>jsonb_build_object('approved',false,'approval_type','none')
     or not public.atomic_import_has_exact_keys(p_plan->'expected_state',array['product','retailer','product_variant','retailer_product','offer']) then
    raise exception 'invalid verified no-change plan: actions';
  end if;

  if not public.atomic_import_has_exact_keys(p_plan#>'{expected_state,product}',array['id','name','is_active','merged_into_product_id','product_format'])
     or not public.atomic_import_has_exact_keys(p_plan#>'{expected_state,retailer}',array['id','name','slug','website'])
     or not public.atomic_import_has_exact_keys(p_plan#>'{expected_state,product_variant}',array['id','product_id','variant_key','display_name','flavour_code','flavour_label','size_value','size_unit','pack_count','product_format','is_active','is_default'])
     or not public.atomic_import_has_exact_keys(p_plan#>'{expected_state,retailer_product}',array['id','retailer_id','product_id','product_variant_id','external_product_id','external_variant_id','external_sku','external_options','external_name','external_slug','external_gtin','external_url','match_method','match_confidence'])
     or not public.atomic_import_has_exact_keys(p_plan#>'{expected_state,offer}',array['id','product_id','retailer_id','product_variant_id','retailer_product_id','price','shipping_cost','total_price','in_stock','url','last_checked_at'])
     or p_plan#>'{retailer_product,values}' is distinct from p_plan#>'{expected_state,retailer_product}'
     or not public.atomic_import_has_exact_keys(p_plan#>'{offer,values}',array['price','shipping_cost','total_price','in_stock','url','last_checked_at']) then
    raise exception 'invalid verified no-change plan: expected state schema';
  end if;

  select * into v_product from public.products where id=(p_plan#>>'{product,id}')::bigint;
  select * into v_variant from public.product_variants where id=(p_plan#>>'{product_variant,id}')::bigint;
  select * into v_retailer from public.retailers where id=(p_plan#>>'{retailer,id}')::bigint;
  select * into v_mapping from public.retailer_products where id=(p_plan#>>'{retailer_product,id}')::bigint;
  select * into v_offer from public.offers where id=(p_plan#>>'{offer,id}')::bigint;
  if v_product.id is null or v_variant.id is null or v_retailer.id is null or v_mapping.id is null or v_offer.id is null then
    raise exception 'stale verified no-change plan: target missing';
  end if;

  v_actual:=jsonb_build_object('id',v_product.id::text,'name',v_product.name,'is_active',v_product.is_active,
    'merged_into_product_id',case when v_product.merged_into_product_id is null then null else to_jsonb(v_product.merged_into_product_id::text) end,
    'product_format',v_product.product_format);
  if v_actual is distinct from p_plan#>'{expected_state,product}' or not v_product.is_active or v_product.merged_into_product_id is not null then
    raise exception 'stale verified no-change plan: product';
  end if;
  v_actual:=jsonb_build_object('id',v_retailer.id::text,'name',v_retailer.name,'slug',v_retailer.slug,'website',v_retailer.website);
  if v_actual is distinct from p_plan#>'{expected_state,retailer}' then raise exception 'stale verified no-change plan: retailer'; end if;
  v_actual:=jsonb_build_object('id',v_variant.id::text,'product_id',v_variant.product_id::text,'variant_key',v_variant.variant_key,
    'display_name',v_variant.display_name,'flavour_code',v_variant.flavour_code,'flavour_label',v_variant.flavour_label,
    'size_value',case when v_variant.size_value is null then null else to_jsonb(public.atomic_import_decimal_string(v_variant.size_value)) end,
    'size_unit',v_variant.size_unit,'pack_count',case when v_variant.pack_count is null then null else to_jsonb(v_variant.pack_count::text) end,
    'product_format',v_variant.product_format,'is_active',v_variant.is_active,'is_default',v_variant.is_default);
  if v_actual is distinct from p_plan#>'{expected_state,product_variant}' or not v_variant.is_active then
    raise exception 'stale verified no-change plan: product variant';
  end if;
  v_actual:=jsonb_build_object('id',v_mapping.id::text,'retailer_id',v_mapping.retailer_id::text,'product_id',v_mapping.product_id::text,
    'product_variant_id',v_mapping.product_variant_id::text,'external_product_id',v_mapping.external_product_id,
    'external_variant_id',v_mapping.external_variant_id,'external_sku',v_mapping.external_sku,'external_options',v_mapping.external_options,
    'external_name',v_mapping.external_name,'external_slug',v_mapping.external_slug,'external_gtin',v_mapping.external_gtin,
    'external_url',v_mapping.external_url,'match_method',v_mapping.match_method,
    'match_confidence',case when v_mapping.match_confidence is null then null else to_jsonb(public.atomic_import_decimal_string(v_mapping.match_confidence)) end);
  if v_actual is distinct from p_plan#>'{expected_state,retailer_product}'
     or nullif(v_mapping.external_product_id,'') is null or nullif(v_mapping.external_variant_id,'') is null
     or v_mapping.external_product_id is distinct from p_plan#>>'{product_variant,evidence,external_product_id}'
     or v_mapping.external_variant_id is distinct from p_plan#>>'{product_variant,evidence,external_variant_id}'
     or (select count(*) from public.retailer_products where retailer_id=v_mapping.retailer_id and external_variant_id=v_mapping.external_variant_id)<>1 then
    raise exception 'verified no-change identity drift or duplicate identity';
  end if;
  v_actual:=jsonb_build_object('id',v_offer.id::text,'product_id',v_offer.product_id::text,'retailer_id',v_offer.retailer_id::text,
    'product_variant_id',v_offer.product_variant_id::text,'retailer_product_id',v_offer.retailer_product_id::text,
    'price',public.atomic_import_decimal_string(v_offer.price),
    'shipping_cost',case when v_offer.shipping_cost is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.shipping_cost)) end,
    'total_price',case when v_offer.total_price is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.total_price)) end,
    'in_stock',v_offer.in_stock,'url',v_offer.url,
    'last_checked_at',to_char(v_offer.last_checked_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
  if v_actual is distinct from p_plan#>'{expected_state,offer}'
     or v_offer.product_id is distinct from v_product.id or v_offer.retailer_id is distinct from v_retailer.id
     or v_offer.product_variant_id is distinct from v_variant.id or v_offer.retailer_product_id is distinct from v_mapping.id
     or v_mapping.product_id is distinct from v_product.id or v_mapping.product_variant_id is distinct from v_variant.id
     or v_mapping.retailer_id is distinct from v_retailer.id then
    raise exception 'stale verified no-change plan: offer identity or state';
  end if;
  if p_plan#>>'{offer,values,price}' is distinct from public.atomic_import_decimal_string(v_offer.price)
     or nullif(p_plan#>>'{offer,values,shipping_cost}','')::numeric is distinct from v_offer.shipping_cost
     or nullif(p_plan#>>'{offer,values,total_price}','')::numeric is distinct from v_offer.total_price
     or (p_plan#>>'{offer,values,in_stock}')::boolean is distinct from v_offer.in_stock
     or p_plan#>>'{offer,values,url}' is distinct from v_offer.url
     or v_mapping.external_url is distinct from v_offer.url
     or (p_plan#>>'{offer,values,last_checked_at}')::timestamptz is distinct from v_capture
     or v_capture<=v_offer.last_checked_at then
    raise exception 'verified no-change price, stock, URL, or timestamp mismatch';
  end if;
  return jsonb_build_object('valid',true,'operation_type','verify_offer_no_change','offer_id',v_offer.id::text,
    'previous_last_checked_at',v_offer.last_checked_at,'verified_last_checked_at',v_capture,
    'target_environment',v_target->>'target_environment','project_ref',v_target->>'project_ref');
end
$validate$;

alter function public.validate_product_import_plan_read_only(jsonb) rename to atomic_import_validate_standard_plan_core;
alter function public.apply_product_import_plan(jsonb) rename to atomic_import_apply_standard_plan_core;

create or replace function public.validate_product_import_plan_read_only(p_plan jsonb)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $wrapper$
begin
  if p_plan#>>'{meta,operation_type}'='verify_offer_no_change' then return public.validate_verified_offer_no_change_plan(p_plan); end if;
  return public.atomic_import_validate_standard_plan_core(p_plan);
end
$wrapper$;

create or replace function public.apply_verified_offer_no_change_plan(p_plan jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $apply_verify$
declare v_validation jsonb; v_offer_id bigint; v_updated integer;
begin
  v_offer_id:=(p_plan#>>'{offer,id}')::bigint;
  perform pg_catalog.pg_advisory_xact_lock(v_offer_id);
  perform 1 from public.offers where id=v_offer_id for update;
  v_validation:=public.validate_verified_offer_no_change_plan(p_plan);
  update public.offers set last_checked_at=(p_plan#>>'{offer,values,last_checked_at}')::timestamptz
  where id=v_offer_id and last_checked_at=(p_plan#>>'{expected_state,offer,last_checked_at}')::timestamptz;
  get diagnostics v_updated=row_count;
  if v_updated<>1 then raise exception 'stale verified no-change plan: concurrent offer change'; end if;
  return jsonb_build_object('product_id',p_plan#>>'{product,id}','product_variant_id',p_plan#>>'{product_variant,id}',
    'retailer_id',p_plan#>>'{retailer,id}','retailer_product_id',p_plan#>>'{retailer_product,id}','offer_id',v_offer_id,
    'retailer_product_action','noop','offer_action','verify_no_change','price_history_action','noop',
    'previous_last_checked_at',p_plan#>>'{expected_state,offer,last_checked_at}',
    'verified_last_checked_at',p_plan#>>'{offer,values,last_checked_at}',
    'plan_fingerprint',p_plan#>>'{meta,plan_fingerprint}','validation',v_validation);
end
$apply_verify$;

create or replace function public.apply_product_import_plan(p_plan jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $wrapper$
begin
  if p_plan#>>'{meta,operation_type}'='verify_offer_no_change' then return public.apply_verified_offer_no_change_plan(p_plan); end if;
  return public.atomic_import_apply_standard_plan_core(p_plan);
end
$wrapper$;

-- Rebind ledger functions to the wrappers above. The ledger schema and one-time
-- approval semantics remain unchanged.
create or replace function public.approve_product_import_plan(
  p_plan jsonb,p_artifact_sha256 text,p_run_id text,p_source text default 'supplementscout_importer',
  p_expires_at timestamptz default (now()+interval '15 minutes')) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $approve$
declare v_plan_fingerprint text;v_source_fingerprint text;v_plan_kind text;v_retailer_id bigint;v_id uuid;
begin
  if p_artifact_sha256!~'^[0-9a-f]{64}$' then raise exception 'approval requires a valid artifact SHA-256'; end if;
  if p_run_id!~'^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$' then raise exception 'approval requires a valid run ID'; end if;
  if nullif(trim(p_source),'') is null then raise exception 'approval source is required'; end if;
  if p_expires_at<=now() or p_expires_at>now()+interval '24 hours' then raise exception 'approval expiry must be within the next 24 hours'; end if;
  perform public.validate_product_import_plan_read_only(p_plan);
  v_plan_fingerprint:=p_plan#>>'{meta,plan_fingerprint}';v_source_fingerprint:=p_plan#>>'{meta,source_row_fingerprint}';
  v_plan_kind:=p_plan#>>'{meta,plan_kind}';v_retailer_id:=nullif(p_plan#>>'{retailer,id}','')::bigint;
  insert into public.approved_import_plans(artifact_sha256,run_id,plan_fingerprint,source_row_fingerprint,plan_kind,retailer_id,expires_at,source,plan_json)
  values(p_artifact_sha256,p_run_id,v_plan_fingerprint,v_source_fingerprint,v_plan_kind,v_retailer_id,p_expires_at,trim(p_source),p_plan) returning id into v_id;
  return jsonb_build_object('approval_id',v_id,'artifact_sha256',p_artifact_sha256,'run_id',p_run_id,'plan_fingerprint',v_plan_fingerprint,
    'source_row_fingerprint',v_source_fingerprint,'retailer_id',v_retailer_id::text,'plan_kind',v_plan_kind,'expires_at',p_expires_at,'status','approved');
end
$approve$;

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

alter function public.verified_offer_refresh_actual_target() owner to postgres;
alter function public.validate_verified_offer_no_change_plan(jsonb) owner to postgres;
alter function public.atomic_import_validate_standard_plan_core(jsonb) owner to postgres;
alter function public.validate_product_import_plan_read_only(jsonb) owner to postgres;
alter function public.apply_verified_offer_no_change_plan(jsonb) owner to postgres;
alter function public.atomic_import_apply_standard_plan_core(jsonb) owner to postgres;
alter function public.apply_product_import_plan(jsonb) owner to postgres;
alter function public.approve_product_import_plan(jsonb,text,text,text,timestamptz) owner to postgres;
alter function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) owner to postgres;

revoke all on function public.verified_offer_refresh_actual_target(),public.validate_verified_offer_no_change_plan(jsonb),
  public.atomic_import_validate_standard_plan_core(jsonb),public.validate_product_import_plan_read_only(jsonb),
  public.apply_verified_offer_no_change_plan(jsonb),public.atomic_import_apply_standard_plan_core(jsonb),
  public.apply_product_import_plan(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.approve_product_import_plan(jsonb,text,text,text,timestamptz),
  public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.approve_product_import_plan(jsonb,text,text,text,timestamptz),
  public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) to service_role;


-- Source: supabase\migrations\20260718160000_add_retailer_offer_mixed_batch_executor.sql

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)') is null
     or to_regprocedure('public.validate_verified_offer_no_change_plan(jsonb)') is null
     or to_regprocedure('public.begin_retailer_catalogue_child_apply(uuid,text,text,text,text,text,text,text,text,text)') is null
     or to_regprocedure('public.retailer_catalogue_production_runtime_guard(text,text,text)') is null
     or to_regclass('public.retailer_catalogue_production_recovery_manifests') is null then
    raise exception 'retailer offer mixed-batch executor requires atomic, verified no-change, Phase 2 and production executor migrations';
  end if;
  if to_regclass('public.retailer_offer_sync_batch_approvals') is not null then
    raise exception 'retailer offer mixed-batch executor is already installed; rerun rejected';
  end if;
end
$preflight$;

create table public.retailer_offer_sync_batch_approvals (
  id uuid primary key default gen_random_uuid(),
  child_plan_id uuid not null references public.retailer_catalogue_child_plans(id) on delete restrict,
  artifact_fingerprint text not null check(artifact_fingerprint ~ '^[0-9a-f]{64}$'),
  execution_fingerprint text not null unique check(execution_fingerprint ~ '^[0-9a-f]{64}$'),
  target_environment text not null check(target_environment='PRODUCTION'),
  project_ref text not null check(project_ref='aftboxmrdgyhizicfsfu'),
  database_identity text not null,
  expected_migration_versions jsonb not null check(jsonb_typeof(expected_migration_versions)='array' and jsonb_array_length(expected_migration_versions)>0),
  expected_migration_fingerprint text not null check(expected_migration_fingerprint~'^[0-9a-f]{64}$'),
  migration_fingerprint_algorithm text not null check(migration_fingerprint_algorithm='SHA-256'),
  migration_fingerprint_version text not null check(migration_fingerprint_version='RSBI-CJ1'),
  approved_manifest jsonb not null check(jsonb_typeof(approved_manifest)='object'),
  expected_deltas jsonb not null check(jsonb_typeof(expected_deltas)='object'),
  approved_by text not null,
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  result jsonb,
  constraint retailer_offer_sync_batch_approval_expiry check(expires_at>approved_at)
);
create unique index retailer_offer_sync_one_active_approval on public.retailer_offer_sync_batch_approvals(child_plan_id) where consumed_at is null;
alter table public.retailer_offer_sync_batch_approvals owner to postgres;
alter table public.retailer_offer_sync_batch_approvals enable row level security;
alter table public.retailer_offer_sync_batch_approvals force row level security;
revoke all on table public.retailer_offer_sync_batch_approvals from public,anon,authenticated,service_role,retailer_catalogue_production_approver,retailer_catalogue_production_executor;

alter table public.retailer_catalogue_production_recovery_manifests
  add column mixed_batch_artifact_fingerprint text check(mixed_batch_artifact_fingerprint is null or mixed_batch_artifact_fingerprint ~ '^[0-9a-f]{64}$'),
  add column mixed_batch_before_state jsonb check(mixed_batch_before_state is null or jsonb_typeof(mixed_batch_before_state)='array'),
  add column mixed_batch_applied_state jsonb check(mixed_batch_applied_state is null or jsonb_typeof(mixed_batch_applied_state)='array'),
  add column mixed_batch_migration_versions jsonb check(mixed_batch_migration_versions is null or jsonb_typeof(mixed_batch_migration_versions)='array'),
  add column mixed_batch_expected_migration_fingerprint text check(mixed_batch_expected_migration_fingerprint is null or mixed_batch_expected_migration_fingerprint~'^[0-9a-f]{64}$'),
  add column mixed_batch_migration_fingerprint_algorithm text check(mixed_batch_migration_fingerprint_algorithm is null or mixed_batch_migration_fingerprint_algorithm='SHA-256'),
  add column mixed_batch_migration_fingerprint_version text check(mixed_batch_migration_fingerprint_version is null or mixed_batch_migration_fingerprint_version='RSBI-CJ1'),
  add column mixed_batch_execution_migration_fingerprint text check(mixed_batch_execution_migration_fingerprint is null or mixed_batch_execution_migration_fingerprint~'^[0-9a-f]{64}$');

alter table public.retailer_catalogue_production_recovery_approvals
  add column mixed_batch_expected_migration_versions jsonb check(mixed_batch_expected_migration_versions is null or jsonb_typeof(mixed_batch_expected_migration_versions)='array'),
  add column mixed_batch_expected_migration_fingerprint text check(mixed_batch_expected_migration_fingerprint is null or mixed_batch_expected_migration_fingerprint~'^[0-9a-f]{64}$'),
  add column mixed_batch_migration_fingerprint_algorithm text check(mixed_batch_migration_fingerprint_algorithm is null or mixed_batch_migration_fingerprint_algorithm='SHA-256'),
  add column mixed_batch_migration_fingerprint_version text check(mixed_batch_migration_fingerprint_version is null or mixed_batch_migration_fingerprint_version='RSBI-CJ1'),
  add column mixed_batch_original_execution_migration_fingerprint text check(mixed_batch_original_execution_migration_fingerprint is null or mixed_batch_original_execution_migration_fingerprint~'^[0-9a-f]{64}$');

create or replace function public.retailer_offer_sync_validate_manifest(p_manifest jsonb)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $validate$
declare v_row jsonb; v_count integer; v_capture timestamptz; v_last bigint:=0; v_offer bigint; v_plan jsonb; v_price boolean; v_stock boolean; v_url boolean; v_shipping boolean; v_total boolean; v_expected_action text; v_expected_row jsonb; v_aggregate jsonb:=jsonb_build_object('row_count_deltas',jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0),'logical_field_deltas',jsonb_build_object('offer_price_updates',0,'offer_shipping_updates',0,'offer_total_updates',0,'offer_stock_updates',0,'offer_url_updates',0,'mapping_url_updates',0,'mapping_updated_at_updates',0,'last_checked_at_updates',0));
begin
  if not public.atomic_import_has_exact_keys(p_manifest,array['schema_version','kind','retailer_slug','retailer_id','target_environment','target_project_ref','target_database_identity','expected_migration_versions','expected_migration_fingerprint','migration_fingerprint_algorithm','migration_fingerprint_version','source_snapshot_fingerprint','adapter_fingerprint','policy_fingerprint','code_commit','expected_state_fingerprint','source_captured_at','state','block','rows','expected_deltas','action_manifest_fingerprint','artifact_fingerprint'])
     or p_manifest->>'schema_version'<>'1' or jsonb_typeof(p_manifest->'rows')<>'array' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid mixed-batch manifest keys');
  end if;
  if jsonb_typeof(p_manifest->'expected_migration_versions') is distinct from 'array' or jsonb_array_length(p_manifest->'expected_migration_versions')<1
     or exists(select 1 from jsonb_array_elements_text(p_manifest->'expected_migration_versions') v where v!~'^[0-9]+_[a-z0-9_]+$')
     or (select count(*) from jsonb_array_elements_text(p_manifest->'expected_migration_versions'))<>(select count(distinct value) from jsonb_array_elements_text(p_manifest->'expected_migration_versions'))
     or p_manifest->>'expected_migration_fingerprint'!~'^[0-9a-f]{64}$' or p_manifest->>'migration_fingerprint_algorithm'<>'SHA-256' or p_manifest->>'migration_fingerprint_version'<>'RSBI-CJ1' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Missing or invalid mixed migration binding');
  end if;
  v_count:=jsonb_array_length(p_manifest->'rows');
  if v_count<1 or v_count>50 then perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','Mixed child size must be 1..50'); end if;
  if p_manifest->>'kind'<>'retailer-existing-offer-mixed-batch-execution' or p_manifest->>'state'<>'DRY_RUN_READY' or p_manifest->'block'<>'null'::jsonb or p_manifest->>'action_manifest_fingerprint'!~'^[0-9a-f]{64}$' or nullif(p_manifest->>'retailer_slug','') is null or nullif(p_manifest->>'retailer_id','')::bigint is null or p_manifest->>'target_environment'<>'PRODUCTION' or p_manifest->>'target_project_ref'<>'aftboxmrdgyhizicfsfu' or p_manifest->>'target_project_ref'='hxnrsyyqffztlvcrtgbf' or p_manifest->>'target_database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' or p_manifest->>'source_snapshot_fingerprint'!~'^[0-9a-f]{64}$' or p_manifest->>'adapter_fingerprint'!~'^[0-9a-f]{64}$' or p_manifest->>'policy_fingerprint'!~'^[0-9a-f]{64}$' or p_manifest->>'code_commit'!~'^[0-9a-f]{40}$' or p_manifest->>'expected_state_fingerprint'!~'^[0-9a-f]{64}$' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Mixed artifact target or immutable fingerprints are invalid'); end if;
  if p_manifest->>'artifact_fingerprint' !~ '^[0-9a-f]{64}$'
     or public.retailer_catalogue_sha256_json(p_manifest-'artifact_fingerprint') is distinct from p_manifest->>'artifact_fingerprint' then
    perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Artifact fingerprint mismatch');
  end if;
  v_capture:=(p_manifest->>'source_captured_at')::timestamptz;
  if v_capture<now()-interval '24 hours' or v_capture>now()+interval '5 minutes' then perform public.retailer_catalogue_raise('RSBI_SOURCE_STALE','Mixed source capture is stale or future'); end if;
  for v_row in select value from jsonb_array_elements(p_manifest->'rows') order by (value->>'offer_id')::bigint loop
    if not public.atomic_import_has_exact_keys(v_row,array['offer_id','retailer_product_id','external_product_id','external_variant_id','action','changed_fields','source_captured_at','expected_deltas','atomic_plan']) then
      perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid mixed row keys');
    end if;
    if v_row->>'action' not in ('VERIFY_NO_CHANGE','UPDATE_PRICE','UPDATE_STOCK','UPDATE_PRICE_AND_STOCK','UPDATE_URL','UPDATE_PRICE_STOCK_URL') then
      perform public.retailer_catalogue_raise('RSBI_UNSUPPORTED_ACTION','Blocked or unsupported mixed action');
    end if;
    v_offer:=(v_row->>'offer_id')::bigint;
    if v_offer<=v_last then perform public.retailer_catalogue_raise('RSBI_DUPLICATE_IDENTITY','Rows must be unique and ascending by offer ID'); end if;
    v_last:=v_offer;
    if (v_row->>'source_captured_at')::timestamptz is distinct from v_capture then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Every row must use the common source capture'); end if;
    v_plan:=v_row->'atomic_plan';
    if (v_plan#>>'{offer,id}')::bigint is distinct from v_offer
       or (v_plan#>>'{retailer_product,id}')::bigint is distinct from (v_row->>'retailer_product_id')::bigint
       or (v_plan#>>'{offer,values,last_checked_at}')::timestamptz is distinct from v_capture then
      perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Row identity or capture does not bind the atomic plan');
    end if;
    if nullif(v_plan#>>'{expected_state,offer,last_checked_at}','') is null or v_capture<=(v_plan#>>'{expected_state,offer,last_checked_at}')::timestamptz then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Source capture must be strictly newer than expected last_checked_at'); end if;
    if (v_row->>'action'='VERIFY_NO_CHANGE') is distinct from (v_plan#>>'{meta,operation_type}'='verify_offer_no_change') then
      perform public.retailer_catalogue_raise('RSBI_UNSUPPORTED_ACTION','Action does not bind the approved atomic plan');
    end if;
    if not public.atomic_import_has_exact_keys(v_row->'changed_fields',array['price','stock','url','blocked']) or coalesce((v_row#>>'{changed_fields,blocked}')::boolean,true) then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid changed-fields bitmap'); end if;
    v_price:=(v_row#>>'{changed_fields,price}')::boolean; v_stock:=(v_row#>>'{changed_fields,stock}')::boolean; v_url:=(v_row#>>'{changed_fields,url}')::boolean;
    v_expected_action:=case when v_url and (v_price or v_stock) then 'UPDATE_PRICE_STOCK_URL' when v_url then 'UPDATE_URL' when v_price and v_stock then 'UPDATE_PRICE_AND_STOCK' when v_price then 'UPDATE_PRICE' when v_stock then 'UPDATE_STOCK' else 'VERIFY_NO_CHANGE' end;
    if v_row->>'action' is distinct from v_expected_action then perform public.retailer_catalogue_raise('RSBI_UNSUPPORTED_ACTION','Action and changed-fields bitmap disagree'); end if;
    v_shipping:=(v_plan#>>'{offer,values,shipping_cost}') is distinct from (v_plan#>>'{expected_state,offer,shipping_cost}');
    v_total:=(v_plan#>>'{offer,values,total_price}') is distinct from (v_plan#>>'{expected_state,offer,total_price}');
    v_expected_row:=jsonb_build_object('row_count_deltas',jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',v_price::int),'logical_field_deltas',jsonb_build_object('offer_price_updates',v_price::int,'offer_shipping_updates',v_shipping::int,'offer_total_updates',v_total::int,'offer_stock_updates',v_stock::int,'offer_url_updates',v_url::int,'mapping_url_updates',v_url::int,'mapping_updated_at_updates',v_url::int,'last_checked_at_updates',1));
    if v_row->'expected_deltas' is distinct from v_expected_row then perform public.retailer_catalogue_raise('RSBI_EXPECTED_DELTA_MISMATCH','Row logical delta does not match its action and atomic plan'); end if;
    v_aggregate:=jsonb_set(v_aggregate,'{row_count_deltas,price_history}',to_jsonb((v_aggregate#>>'{row_count_deltas,price_history}')::int+v_price::int));
    v_aggregate:=jsonb_set(v_aggregate,'{logical_field_deltas,offer_price_updates}',to_jsonb((v_aggregate#>>'{logical_field_deltas,offer_price_updates}')::int+v_price::int));
    v_aggregate:=jsonb_set(v_aggregate,'{logical_field_deltas,offer_shipping_updates}',to_jsonb((v_aggregate#>>'{logical_field_deltas,offer_shipping_updates}')::int+v_shipping::int));
    v_aggregate:=jsonb_set(v_aggregate,'{logical_field_deltas,offer_total_updates}',to_jsonb((v_aggregate#>>'{logical_field_deltas,offer_total_updates}')::int+v_total::int));
    v_aggregate:=jsonb_set(v_aggregate,'{logical_field_deltas,offer_stock_updates}',to_jsonb((v_aggregate#>>'{logical_field_deltas,offer_stock_updates}')::int+v_stock::int));
    v_aggregate:=jsonb_set(v_aggregate,'{logical_field_deltas,offer_url_updates}',to_jsonb((v_aggregate#>>'{logical_field_deltas,offer_url_updates}')::int+v_url::int));
    v_aggregate:=jsonb_set(v_aggregate,'{logical_field_deltas,mapping_url_updates}',to_jsonb((v_aggregate#>>'{logical_field_deltas,mapping_url_updates}')::int+v_url::int));
    v_aggregate:=jsonb_set(v_aggregate,'{logical_field_deltas,mapping_updated_at_updates}',to_jsonb((v_aggregate#>>'{logical_field_deltas,mapping_updated_at_updates}')::int+v_url::int));
    v_aggregate:=jsonb_set(v_aggregate,'{logical_field_deltas,last_checked_at_updates}',to_jsonb((v_aggregate#>>'{logical_field_deltas,last_checked_at_updates}')::int+1));
    perform public.validate_product_import_plan_read_only(v_plan);
  end loop;
  if p_manifest->'expected_deltas' is distinct from v_aggregate then perform public.retailer_catalogue_raise('RSBI_EXPECTED_DELTA_MISMATCH','Aggregate mixed-batch deltas mismatch'); end if;
  return jsonb_build_object('valid',true,'row_count',v_count,'source_captured_at',v_capture);
end
$validate$;

create or replace function public.retailer_offer_sync_approve_batch_internal(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $approve$
declare v_child public.retailer_catalogue_child_plans%rowtype; v_parent public.retailer_catalogue_parent_plans%rowtype; v_id uuid; v_manifest jsonb; v_parent_approval jsonb; v_child_approval jsonb; v_execution text; v_actual_migration text;
begin
  if not public.atomic_import_has_exact_keys(p_request,array['schema_version','child_plan_id','parent_plan_fingerprint','child_plan_fingerprint','artifact','execution_fingerprint','expected_migration_versions','expected_migration_fingerprint','migration_fingerprint_algorithm','migration_fingerprint_version','approved_by','expires_at','production_project_ref','production_database_identity']) then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid mixed approval keys');
  end if;
  if p_request->>'schema_version'<>'1' or p_request->>'execution_fingerprint'!~'^[0-9a-f]{64}$' or (p_request->>'expires_at')::timestamptz<=now() or (p_request->>'expires_at')::timestamptz>now()+interval '15 minutes' then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Mixed approval expiry/fingerprint invalid');
  end if;
  perform public.retailer_catalogue_production_runtime_guard('PRODUCTION',p_request->>'production_project_ref',p_request->>'production_database_identity');
  v_manifest:=p_request->'artifact'; perform public.retailer_offer_sync_validate_manifest(v_manifest);
  if p_request->'expected_migration_versions' is distinct from v_manifest->'expected_migration_versions'
     or p_request->>'expected_migration_fingerprint' is distinct from v_manifest->>'expected_migration_fingerprint'
     or p_request->>'migration_fingerprint_algorithm' is distinct from v_manifest->>'migration_fingerprint_algorithm'
     or p_request->>'migration_fingerprint_version' is distinct from v_manifest->>'migration_fingerprint_version' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Approval migration binding does not match artifact');
  end if;
  v_actual_migration:=public.retailer_catalogue_assert_migration_ledger(v_manifest->'expected_migration_versions',v_manifest->>'expected_migration_fingerprint');
  select * into v_child from public.retailer_catalogue_child_plans where id=(p_request->>'child_plan_id')::uuid for update;
  if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Child not found'); end if;
  select * into v_parent from public.retailer_catalogue_parent_plans where id=v_child.parent_plan_id for update;
  if v_child.status<>'PLANNED' or v_parent.status<>'PLANNED' or v_parent.parent_plan_fingerprint is distinct from p_request->>'parent_plan_fingerprint' or v_child.child_plan_fingerprint is distinct from p_request->>'child_plan_fingerprint'
     or v_child.child_plan_fingerprint is distinct from v_manifest->>'artifact_fingerprint' or v_child.expected_deltas is distinct from v_manifest->'expected_deltas' or v_child.plan_json is distinct from v_manifest
     or v_child.retailer_id is distinct from (v_manifest->>'retailer_id')::bigint or v_child.target_environment is distinct from v_manifest->>'target_environment' or v_child.source_snapshot_fingerprint is distinct from v_manifest->>'source_snapshot_fingerprint' or v_child.adapter_fingerprint is distinct from v_manifest->>'adapter_fingerprint' or v_child.policy_fingerprint is distinct from v_manifest->>'policy_fingerprint' or v_child.code_commit is distinct from v_manifest->>'code_commit' or v_child.expected_state_fingerprint is distinct from v_manifest->>'expected_state_fingerprint'
     or v_manifest->>'target_project_ref' is distinct from p_request->>'production_project_ref' or v_manifest->>'target_database_identity' is distinct from p_request->>'production_database_identity' then
    perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Approved child does not exactly bind the artifact');
  end if;
  v_execution:=public.retailer_catalogue_sha256_json(jsonb_build_object('child_plan_id',v_child.id,'artifact_fingerprint',v_manifest->>'artifact_fingerprint','target_environment','PRODUCTION','project_ref',p_request->>'production_project_ref','database_identity',p_request->>'production_database_identity','expected_migration_versions',v_manifest->'expected_migration_versions','expected_migration_fingerprint',v_manifest->>'expected_migration_fingerprint','migration_fingerprint_algorithm',v_manifest->>'migration_fingerprint_algorithm','migration_fingerprint_version',v_manifest->>'migration_fingerprint_version'));
  if v_execution is distinct from p_request->>'execution_fingerprint' then perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Execution fingerprint is not deterministic'); end if;
  v_parent_approval:=public.approve_retailer_catalogue_parent_plan(v_parent.id,v_parent.parent_plan_fingerprint,trim(p_request->>'approved_by'),(p_request->>'expires_at')::timestamptz);
  v_child_approval:=public.approve_retailer_catalogue_child_plan(v_child.id,(v_parent_approval->>'approval_id')::uuid,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,(p_request->>'expires_at')::timestamptz);
  insert into public.retailer_offer_sync_batch_approvals(child_plan_id,artifact_fingerprint,execution_fingerprint,target_environment,project_ref,database_identity,expected_migration_versions,expected_migration_fingerprint,migration_fingerprint_algorithm,migration_fingerprint_version,approved_manifest,expected_deltas,approved_by,expires_at)
  values(v_child.id,v_manifest->>'artifact_fingerprint',p_request->>'execution_fingerprint','PRODUCTION',p_request->>'production_project_ref',p_request->>'production_database_identity',v_manifest->'expected_migration_versions',v_actual_migration,v_manifest->>'migration_fingerprint_algorithm',v_manifest->>'migration_fingerprint_version',v_manifest,v_manifest->'expected_deltas',trim(p_request->>'approved_by'),(p_request->>'expires_at')::timestamptz) returning id into v_id;
  return jsonb_build_object('approval_id',v_id,'parent_approval_id',v_parent_approval->>'approval_id','child_approval_id',v_child_approval->>'approval_id','child_plan_id',v_child.id,'status','APPROVED','row_count',jsonb_array_length(v_manifest->'rows'),'actual_migration_fingerprint',v_actual_migration,'business_writes',0);
end
$approve$;

create or replace function public.approve_retailer_offer_sync_batch(p_request jsonb)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $approve_wrapper$
begin
  if current_user<>'retailer_catalogue_production_approver' then raise exception 'mixed-batch approval requires the dedicated approver role'; end if;
  return public.retailer_offer_sync_approve_batch_internal(p_request);
end
$approve_wrapper$;

create or replace function public.retailer_offer_sync_row_state(p_offer_id bigint)
returns jsonb language sql stable security definer set search_path=pg_catalog,public,pg_temp as $state$
  select jsonb_build_object('offer_id',o.id::text,'retailer_product_id',o.retailer_product_id::text,
    'price',public.atomic_import_decimal_string(o.price),'shipping_cost',case when o.shipping_cost is null then null else to_jsonb(public.atomic_import_decimal_string(o.shipping_cost)) end,
    'total_price',case when o.total_price is null then null else to_jsonb(public.atomic_import_decimal_string(o.total_price)) end,
    'in_stock',o.in_stock,'offer_url',o.url,'last_checked_at',to_char(o.last_checked_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'mapping_url',rp.external_url,'mapping_updated_at',to_char(rp.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
  from public.offers o join public.retailer_products rp on rp.id=o.retailer_product_id where o.id=p_offer_id;
$state$;

create or replace function public.retailer_offer_sync_execute_batch_internal(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $execute$
declare v_approval public.retailer_offer_sync_batch_approvals%rowtype; v_child public.retailer_catalogue_child_plans%rowtype; v_parent public.retailer_catalogue_parent_plans%rowtype; v_row jsonb; v_plan jsonb; v_row_approval jsonb; v_row_result jsonb; v_run jsonb; v_run_id uuid; v_before jsonb:='[]'; v_after jsonb:='[]'; v_history_ids jsonb:='[]'; v_approval_ids jsonb:='[]'; v_before_counts jsonb; v_after_counts jsonb; v_expected_history integer; v_actual_history integer; v_result jsonb; v_manifest_id uuid; v_actual_deltas jsonb; v_price_updates integer; v_shipping_updates integer; v_total_updates integer; v_stock_updates integer; v_offer_url_updates integer; v_mapping_url_updates integer; v_mapping_time_updates integer; v_checked_updates integer; v_other_before text; v_protected_before text; v_actual_migration text;
begin
  if not public.atomic_import_has_exact_keys(p_request,array['schema_version','approval_id','execution_fingerprint','expected_migration_versions','expected_migration_fingerprint','migration_fingerprint_algorithm','migration_fingerprint_version','production_project_ref','production_database_identity','requested_at','explicit_allow']) or coalesce((p_request->>'explicit_allow')::boolean,false)=false then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid mixed execution request');
  end if;
  perform public.retailer_catalogue_production_runtime_guard('PRODUCTION',p_request->>'production_project_ref',p_request->>'production_database_identity');
  select * into v_approval from public.retailer_offer_sync_batch_approvals where id=(p_request->>'approval_id')::uuid for update;
  if not found then perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Batch approval not found'); end if;
  if p_request->'expected_migration_versions' is distinct from v_approval.expected_migration_versions
     or p_request->>'expected_migration_fingerprint' is distinct from v_approval.expected_migration_fingerprint
     or p_request->>'migration_fingerprint_algorithm' is distinct from v_approval.migration_fingerprint_algorithm
     or p_request->>'migration_fingerprint_version' is distinct from v_approval.migration_fingerprint_version then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Mixed execution migration binding mismatch');
  end if;
  v_actual_migration:=public.retailer_catalogue_assert_migration_ledger(v_approval.expected_migration_versions,v_approval.expected_migration_fingerprint);
  if v_approval.consumed_at is not null then return coalesce(v_approval.result,'{}')||jsonb_build_object('code','RSBI_REPLAY_BLOCKED','noop',true,'business_writes',0); end if;
  if v_approval.expires_at<=now() or v_approval.execution_fingerprint is distinct from p_request->>'execution_fingerprint' then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Batch approval expired or mismatched'); end if;
  perform public.retailer_offer_sync_validate_manifest(v_approval.approved_manifest);
  select * into v_child from public.retailer_catalogue_child_plans where id=v_approval.child_plan_id for update; select * into v_parent from public.retailer_catalogue_parent_plans where id=v_child.parent_plan_id for update;
  if v_child.status<>'APPROVED' then perform public.retailer_catalogue_raise('RSBI_INVALID_TRANSITION','Child is not approved'); end if;
  for v_row in select value from jsonb_array_elements(v_approval.approved_manifest->'rows') order by (value->>'offer_id')::bigint loop
    perform pg_advisory_xact_lock((v_row->>'offer_id')::bigint); perform 1 from public.offers where id=(v_row->>'offer_id')::bigint for update;
    perform public.validate_product_import_plan_read_only(v_row->'atomic_plan');
    v_before:=v_before||jsonb_build_array(public.retailer_offer_sync_row_state((v_row->>'offer_id')::bigint));
  end loop;
  v_before_counts:=public.retailer_catalogue_business_counts(); v_other_before:=public.retailer_catalogue_other_retailer_fingerprint(v_child.retailer_id); v_protected_before:=public.retailer_catalogue_protected_shared_fingerprint();
  v_run:=public.begin_retailer_catalogue_child_apply(v_child.id,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_child.source_snapshot_fingerprint,v_child.canonical_snapshot_fingerprint,v_child.adapter_fingerprint,v_child.policy_fingerprint,v_child.code_commit,v_child.expected_state_fingerprint,'retailer_offer_sync');
  v_run_id:=(v_run->>'run_id')::uuid;
  for v_row in select value from jsonb_array_elements(v_approval.approved_manifest->'rows') order by (value->>'offer_id')::bigint loop
    v_plan:=v_row->'atomic_plan';
    v_row_approval:=public.approve_product_import_plan(v_plan,v_approval.artifact_fingerprint,'mbs-'||left(v_approval.execution_fingerprint,16)||'-'||lpad((v_row->>'offer_id'),12,'0')||'-'||left(v_plan#>>'{meta,plan_fingerprint}',16),'retailer_offer_mixed_batch',least(v_approval.expires_at,now()+interval '15 minutes'));
    v_row_result:=public.apply_approved_product_import_plan((v_row_approval->>'approval_id')::uuid,v_approval.artifact_fingerprint,v_plan#>>'{meta,plan_fingerprint}',v_plan#>>'{meta,source_row_fingerprint}',(v_plan#>>'{retailer,id}')::bigint,v_plan#>>'{meta,plan_kind}',v_row_approval->>'run_id');
    v_approval_ids:=v_approval_ids||jsonb_build_array(v_row_approval->>'approval_id');
    if v_row_result ? 'price_history_id' and nullif(v_row_result->>'price_history_id','') is not null then v_history_ids:=v_history_ids||jsonb_build_array(v_row_result->>'price_history_id'); end if;
  end loop;
  for v_row in select value from jsonb_array_elements(v_approval.approved_manifest->'rows') order by (value->>'offer_id')::bigint loop
    v_after:=v_after||jsonb_build_array(public.retailer_offer_sync_row_state((v_row->>'offer_id')::bigint));
    v_plan:=v_row->'atomic_plan';
    if public.retailer_offer_sync_row_state((v_row->>'offer_id')::bigint)->>'last_checked_at' is distinct from to_char((v_approval.approved_manifest->>'source_captured_at')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
       or public.retailer_offer_sync_row_state((v_row->>'offer_id')::bigint)->>'price' is distinct from v_plan#>>'{offer,values,price}'
       or public.retailer_offer_sync_row_state((v_row->>'offer_id')::bigint)->>'shipping_cost' is distinct from v_plan#>>'{offer,values,shipping_cost}'
       or public.retailer_offer_sync_row_state((v_row->>'offer_id')::bigint)->>'total_price' is distinct from v_plan#>>'{offer,values,total_price}'
       or (public.retailer_offer_sync_row_state((v_row->>'offer_id')::bigint)->>'in_stock')::boolean is distinct from (v_plan#>>'{offer,values,in_stock}')::boolean
       or public.retailer_offer_sync_row_state((v_row->>'offer_id')::bigint)->>'offer_url' is distinct from v_plan#>>'{offer,values,url}'
       or public.retailer_offer_sync_row_state((v_row->>'offer_id')::bigint)->>'mapping_url' is distinct from v_plan#>>'{retailer_product,values,external_url}' then
      perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Exact mixed post-state mismatch');
    end if;
  end loop;
  select count(*) filter(where b.value->>'price' is distinct from a.value->>'price'),count(*) filter(where b.value->>'shipping_cost' is distinct from a.value->>'shipping_cost'),count(*) filter(where b.value->>'total_price' is distinct from a.value->>'total_price'),count(*) filter(where b.value->>'in_stock' is distinct from a.value->>'in_stock'),count(*) filter(where b.value->>'offer_url' is distinct from a.value->>'offer_url'),count(*) filter(where b.value->>'mapping_url' is distinct from a.value->>'mapping_url'),count(*) filter(where b.value->>'mapping_updated_at' is distinct from a.value->>'mapping_updated_at'),count(*) filter(where b.value->>'last_checked_at' is distinct from a.value->>'last_checked_at')
  into v_price_updates,v_shipping_updates,v_total_updates,v_stock_updates,v_offer_url_updates,v_mapping_url_updates,v_mapping_time_updates,v_checked_updates
  from jsonb_array_elements(v_before) b(value) join jsonb_array_elements(v_after) a(value) on a.value->>'offer_id'=b.value->>'offer_id';
  v_after_counts:=public.retailer_catalogue_business_counts(); v_expected_history:=coalesce((v_approval.expected_deltas#>>'{row_count_deltas,price_history}')::integer,0); v_actual_history:=(v_after_counts->>'price_history')::integer-(v_before_counts->>'price_history')::integer;
  v_actual_deltas:=jsonb_build_object('row_count_deltas',jsonb_build_object('products',(v_after_counts->>'products')::int-(v_before_counts->>'products')::int,'product_variants',(v_after_counts->>'product_variants')::int-(v_before_counts->>'product_variants')::int,'retailer_products',(v_after_counts->>'retailer_products')::int-(v_before_counts->>'retailer_products')::int,'offers',(v_after_counts->>'offers')::int-(v_before_counts->>'offers')::int,'price_history',v_actual_history),'logical_field_deltas',jsonb_build_object('offer_price_updates',v_price_updates,'offer_shipping_updates',v_shipping_updates,'offer_total_updates',v_total_updates,'offer_stock_updates',v_stock_updates,'offer_url_updates',v_offer_url_updates,'mapping_url_updates',v_mapping_url_updates,'mapping_updated_at_updates',v_mapping_time_updates,'last_checked_at_updates',v_checked_updates));
  if v_actual_deltas is distinct from v_approval.expected_deltas or v_actual_history<>v_expected_history or jsonb_array_length(v_approval_ids)<>jsonb_array_length(v_approval.approved_manifest->'rows')
     or public.retailer_catalogue_other_retailer_fingerprint(v_child.retailer_id) is distinct from v_other_before or public.retailer_catalogue_protected_shared_fingerprint() is distinct from v_protected_before then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_DELTA_MISMATCH','Exact mixed batch deltas mismatch');
  end if;
  v_result:=jsonb_build_object('status','APPLIED','child_plan_id',v_child.id,'run_id',v_run_id,'row_approvals_created',jsonb_array_length(v_approval_ids),'row_approvals_consumed',jsonb_array_length(v_approval_ids),'expected_deltas',v_approval.expected_deltas,'price_history_delta',v_actual_history,'execution_fingerprint',v_approval.execution_fingerprint,'actual_migration_fingerprint',v_actual_migration,'business_writes',jsonb_array_length(v_approval.approved_manifest->'rows'));
  perform public.complete_retailer_catalogue_child_apply(v_run_id,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_after_counts,v_result,'retailer_offer_sync');
  insert into public.retailer_catalogue_production_recovery_manifests(package_id,package_fingerprint,child_plan_id,apply_run_id,dependency_group,execution_fingerprint,rollback_manifest_fingerprint,created_product_ids,created_variant_ids,created_mapping_ids,created_offer_ids,created_price_history_ids,updated_before_state,ownership,reverse_dependency_order,before_counts,other_retailer_fingerprint,protected_shared_fingerprint,orphan_counts,applied_owned_state_fingerprint,mixed_batch_artifact_fingerprint,mixed_batch_before_state,mixed_batch_applied_state,mixed_batch_migration_versions,mixed_batch_expected_migration_fingerprint,mixed_batch_migration_fingerprint_algorithm,mixed_batch_migration_fingerprint_version,mixed_batch_execution_migration_fingerprint)
  values(v_approval.id,v_approval.artifact_fingerprint,v_child.id,v_run_id,v_child.dependency_group,v_approval.execution_fingerprint,public.retailer_catalogue_sha256_json(jsonb_build_object('before',v_before,'after',v_after,'history',v_history_ids)),'[]','[]','[]','[]',v_history_ids,v_before,jsonb_build_object('kind','MIXED_EXISTING_OFFER_UPDATE','price_history_state',(select coalesce(jsonb_agg(jsonb_build_object('id',ph.id::text,'offer_id',ph.offer_id::text,'price',public.atomic_import_decimal_string(ph.price),'shipping_cost',case when ph.shipping_cost is null then null else to_jsonb(public.atomic_import_decimal_string(ph.shipping_cost)) end,'total_price',case when ph.total_price is null then null else to_jsonb(public.atomic_import_decimal_string(ph.total_price)) end,'checked_at',to_char(ph.checked_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) order by ph.id),'[]'::jsonb) from public.price_history ph where ph.id in(select value::bigint from jsonb_array_elements_text(v_history_ids)))),'[]',v_before_counts,v_other_before,v_protected_before,public.retailer_catalogue_orphan_counts(),public.retailer_catalogue_sha256_json(v_after),v_approval.artifact_fingerprint,v_before,v_after,v_approval.expected_migration_versions,v_approval.expected_migration_fingerprint,v_approval.migration_fingerprint_algorithm,v_approval.migration_fingerprint_version,v_actual_migration) returning id into v_manifest_id;
  v_result:=v_result||jsonb_build_object('recovery_manifest_id',v_manifest_id);
  update public.retailer_offer_sync_batch_approvals set consumed_at=now(),result=v_result where id=v_approval.id;
  return v_result;
end
$execute$;

create or replace function public.execute_retailer_offer_sync_batch(p_request jsonb)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $execute_wrapper$
begin
  if current_user<>'retailer_catalogue_production_executor' then raise exception 'mixed-batch execution requires the dedicated executor role'; end if;
  return public.retailer_offer_sync_execute_batch_internal(p_request);
end
$execute_wrapper$;

create or replace function public.retailer_offer_sync_approve_recovery_internal(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $approve_recovery$
declare v_manifest public.retailer_catalogue_production_recovery_manifests%rowtype; v_id uuid; v_actual_migration text;
begin
  if not public.atomic_import_has_exact_keys(p_request,array['schema_version','recovery_manifest_id','rollback_manifest_fingerprint','expected_migration_versions','expected_migration_fingerprint','migration_fingerprint_algorithm','migration_fingerprint_version','original_execution_migration_fingerprint','approved_by','expires_at','production_project_ref','production_database_identity']) then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid mixed recovery approval'); end if;
  if (p_request->>'expires_at')::timestamptz<=now() or (p_request->>'expires_at')::timestamptz>now()+interval '15 minutes' then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Recovery approval expiry must be within 15 minutes'); end if;
  perform public.retailer_catalogue_production_runtime_guard('PRODUCTION',p_request->>'production_project_ref',p_request->>'production_database_identity');
  select * into v_manifest from public.retailer_catalogue_production_recovery_manifests where id=(p_request->>'recovery_manifest_id')::uuid and mixed_batch_artifact_fingerprint is not null for update;
  if not found or v_manifest.status<>'READY' or v_manifest.rollback_manifest_fingerprint is distinct from p_request->>'rollback_manifest_fingerprint' then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Mixed recovery manifest mismatch'); end if;
  if p_request->'expected_migration_versions' is distinct from v_manifest.mixed_batch_migration_versions
     or p_request->>'expected_migration_fingerprint' is distinct from v_manifest.mixed_batch_expected_migration_fingerprint
     or p_request->>'migration_fingerprint_algorithm' is distinct from v_manifest.mixed_batch_migration_fingerprint_algorithm
     or p_request->>'migration_fingerprint_version' is distinct from v_manifest.mixed_batch_migration_fingerprint_version
     or p_request->>'original_execution_migration_fingerprint' is distinct from v_manifest.mixed_batch_execution_migration_fingerprint then perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Mixed recovery migration binding mismatch'); end if;
  v_actual_migration:=public.retailer_catalogue_assert_migration_ledger(v_manifest.mixed_batch_migration_versions,v_manifest.mixed_batch_expected_migration_fingerprint);
  if v_actual_migration is distinct from v_manifest.mixed_batch_execution_migration_fingerprint then perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Migration ledger changed since original execution'); end if;
  insert into public.retailer_catalogue_production_recovery_approvals(recovery_manifest_id,package_id,package_fingerprint,project_ref,database_identity,child_plan_id,execution_fingerprint,rollback_manifest_fingerprint,expected_recovery_state,expected_recovery_state_fingerprint,approved_by,expires_at,mixed_batch_expected_migration_versions,mixed_batch_expected_migration_fingerprint,mixed_batch_migration_fingerprint_algorithm,mixed_batch_migration_fingerprint_version,mixed_batch_original_execution_migration_fingerprint)
  values(v_manifest.id,v_manifest.package_id,v_manifest.package_fingerprint,p_request->>'production_project_ref',p_request->>'production_database_identity',v_manifest.child_plan_id,v_manifest.execution_fingerprint,v_manifest.rollback_manifest_fingerprint,v_manifest.mixed_batch_before_state,public.retailer_catalogue_sha256_json(v_manifest.mixed_batch_before_state),trim(p_request->>'approved_by'),(p_request->>'expires_at')::timestamptz,v_manifest.mixed_batch_migration_versions,v_manifest.mixed_batch_expected_migration_fingerprint,v_manifest.mixed_batch_migration_fingerprint_algorithm,v_manifest.mixed_batch_migration_fingerprint_version,v_manifest.mixed_batch_execution_migration_fingerprint) returning id into v_id;
  return jsonb_build_object('recovery_approval_id',v_id,'status','APPROVED','actual_migration_fingerprint',v_actual_migration,'business_writes',0);
end
$approve_recovery$;

create or replace function public.approve_retailer_offer_sync_recovery(p_request jsonb)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $approve_recovery_wrapper$
begin
  if current_user<>'retailer_catalogue_production_approver' then raise exception 'mixed recovery approval requires dedicated approver role'; end if;
  return public.retailer_offer_sync_approve_recovery_internal(p_request);
end
$approve_recovery_wrapper$;

create or replace function public.retailer_offer_sync_recover_batch_internal(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $recover$
declare v_approval public.retailer_catalogue_production_recovery_approvals%rowtype; v_manifest public.retailer_catalogue_production_recovery_manifests%rowtype; v_row jsonb; v_current jsonb; v_child public.retailer_catalogue_child_plans%rowtype; v_parent public.retailer_catalogue_parent_plans%rowtype; v_original public.retailer_catalogue_apply_runs%rowtype; v_recovery_run uuid; v_attempt integer; v_parent_status text; v_history_actual jsonb; v_actual_migration text;
begin
  if not public.atomic_import_has_exact_keys(p_request,array['schema_version','recovery_approval_id','expected_migration_versions','expected_migration_fingerprint','migration_fingerprint_algorithm','migration_fingerprint_version','original_execution_migration_fingerprint','production_project_ref','production_database_identity','explicit_allow']) or coalesce((p_request->>'explicit_allow')::boolean,false)=false then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid mixed recovery request'); end if;
  perform public.retailer_catalogue_production_runtime_guard('PRODUCTION',p_request->>'production_project_ref',p_request->>'production_database_identity');
  select * into v_approval from public.retailer_catalogue_production_recovery_approvals where id=(p_request->>'recovery_approval_id')::uuid for update;
  if not found then perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Recovery approval missing'); end if;
  if p_request->'expected_migration_versions' is distinct from v_approval.mixed_batch_expected_migration_versions
     or p_request->>'expected_migration_fingerprint' is distinct from v_approval.mixed_batch_expected_migration_fingerprint
     or p_request->>'migration_fingerprint_algorithm' is distinct from v_approval.mixed_batch_migration_fingerprint_algorithm
     or p_request->>'migration_fingerprint_version' is distinct from v_approval.mixed_batch_migration_fingerprint_version
     or p_request->>'original_execution_migration_fingerprint' is distinct from v_approval.mixed_batch_original_execution_migration_fingerprint then perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Mixed recovery execution migration binding mismatch'); end if;
  v_actual_migration:=public.retailer_catalogue_assert_migration_ledger(v_approval.mixed_batch_expected_migration_versions,v_approval.mixed_batch_expected_migration_fingerprint);
  if v_actual_migration is distinct from v_approval.mixed_batch_original_execution_migration_fingerprint then perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Migration ledger changed since original execution'); end if;
  if v_approval.consumed_at is not null or v_approval.expires_at<=now() then perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Recovery approval expired or consumed'); end if;
  select * into v_manifest from public.retailer_catalogue_production_recovery_manifests where id=v_approval.recovery_manifest_id for update;
  if v_manifest.mixed_batch_migration_versions is distinct from v_approval.mixed_batch_expected_migration_versions or v_manifest.mixed_batch_expected_migration_fingerprint is distinct from v_approval.mixed_batch_expected_migration_fingerprint or v_manifest.mixed_batch_execution_migration_fingerprint is distinct from v_approval.mixed_batch_original_execution_migration_fingerprint then perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Mixed recovery manifest migration binding mismatch'); end if;
  if v_manifest.status<>'READY' or public.retailer_catalogue_sha256_json(v_manifest.mixed_batch_applied_state) is distinct from v_manifest.applied_owned_state_fingerprint then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Recovery evidence mismatch'); end if;
  select * into v_child from public.retailer_catalogue_child_plans where id=v_manifest.child_plan_id for update; select * into v_parent from public.retailer_catalogue_parent_plans where id=v_child.parent_plan_id for update; select * into v_original from public.retailer_catalogue_apply_runs where id=v_manifest.apply_run_id for update;
  if v_child.status<>'APPLIED' or v_original.status<>'SUCCEEDED' or public.retailer_catalogue_other_retailer_fingerprint(v_child.retailer_id) is distinct from v_manifest.other_retailer_fingerprint or public.retailer_catalogue_protected_shared_fingerprint() is distinct from v_manifest.protected_shared_fingerprint or public.retailer_catalogue_orphan_counts() is distinct from v_manifest.orphan_counts then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Shared or unrelated state drift blocks recovery'); end if;
  for v_row in select value from jsonb_array_elements(v_manifest.mixed_batch_applied_state) order by (value->>'offer_id')::bigint loop perform pg_advisory_xact_lock((v_row->>'offer_id')::bigint); v_current:=public.retailer_offer_sync_row_state((v_row->>'offer_id')::bigint); if v_current is distinct from v_row then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Applied state drift blocks recovery'); end if; end loop;
  if exists(select 1 from jsonb_array_elements_text(v_manifest.created_price_history_ids) h left join public.price_history p on p.id=h::bigint where p.id is null) then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Owned history is missing'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',ph.id::text,'offer_id',ph.offer_id::text,'price',public.atomic_import_decimal_string(ph.price),'shipping_cost',case when ph.shipping_cost is null then null else to_jsonb(public.atomic_import_decimal_string(ph.shipping_cost)) end,'total_price',case when ph.total_price is null then null else to_jsonb(public.atomic_import_decimal_string(ph.total_price)) end,'checked_at',to_char(ph.checked_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) order by ph.id),'[]'::jsonb) into v_history_actual from public.price_history ph where ph.id in(select value::bigint from jsonb_array_elements_text(v_manifest.created_price_history_ids));
  if v_history_actual is distinct from v_manifest.ownership->'price_history_state' then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Owned history was altered'); end if;
  select coalesce(max(attempt_ordinal),0)+1 into v_attempt from public.retailer_catalogue_apply_runs where child_plan_id=v_child.id and run_type='ROLLBACK';
  insert into public.retailer_catalogue_apply_runs(parent_plan_id,child_plan_id,retailer_id,target_environment,run_type,attempt_ordinal,parent_plan_fingerprint,child_plan_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,approval_id,approval_expires_at,rollback_fingerprint,rollback_manifest,before_counts,expected_deltas,started_by)
  values(v_parent.id,v_child.id,v_child.retailer_id,v_child.target_environment,'ROLLBACK',v_attempt,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_child.source_snapshot_fingerprint,v_child.canonical_snapshot_fingerprint,v_child.adapter_fingerprint,v_child.policy_fingerprint,v_child.code_commit,v_child.expected_state_fingerprint,v_approval.id,v_approval.expires_at,v_manifest.rollback_manifest_fingerprint,'[]',public.retailer_catalogue_business_counts(),v_child.expected_deltas,'retailer_offer_sync_recovery') returning id into v_recovery_run;
  delete from public.price_history where id in(select value::bigint from jsonb_array_elements_text(v_manifest.created_price_history_ids));
  for v_row in select value from jsonb_array_elements(v_manifest.mixed_batch_before_state) order by (value->>'offer_id')::bigint loop
    update public.retailer_products set external_url=v_row->>'mapping_url',updated_at=(v_row->>'mapping_updated_at')::timestamptz where id=(v_row->>'retailer_product_id')::bigint;
    update public.offers set price=(v_row->>'price')::numeric,shipping_cost=nullif(v_row->>'shipping_cost','')::numeric,total_price=nullif(v_row->>'total_price','')::numeric,in_stock=(v_row->>'in_stock')::boolean,url=v_row->>'offer_url',last_checked_at=(v_row->>'last_checked_at')::timestamptz where id=(v_row->>'offer_id')::bigint;
  end loop;
  if (select jsonb_agg(public.retailer_offer_sync_row_state((b->>'offer_id')::bigint) order by (b->>'offer_id')::bigint) from jsonb_array_elements(v_manifest.mixed_batch_before_state) b) is distinct from v_manifest.mixed_batch_before_state or public.retailer_catalogue_business_counts() is distinct from v_manifest.before_counts then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Exact recovery baseline mismatch'); end if;
  update public.retailer_catalogue_production_recovery_approvals set consumed_at=now() where id=v_approval.id; update public.retailer_catalogue_production_recovery_manifests set status='RECOVERED',recovered_at=now() where id=v_manifest.id;
  update public.retailer_catalogue_child_plans set status='ROLLED_BACK',updated_at=now() where id=v_child.id; update public.retailer_catalogue_apply_runs set status='ROLLED_BACK',after_counts=public.retailer_catalogue_business_counts(),result_metadata=jsonb_build_object('recovery_manifest_id',v_manifest.id,'exact_post_recovery_validation',true),completed_at=now() where id=v_recovery_run; v_parent_status:=public.retailer_catalogue_recalculate_parent_status(v_parent.id);
  return jsonb_build_object('recovery_status','RECOVERED','recovery_run_id',v_recovery_run,'child_plan_id',v_child.id,'parent_status',v_parent_status,'restored_rows',jsonb_array_length(v_manifest.mixed_batch_before_state),'deleted_price_history',jsonb_array_length(v_manifest.created_price_history_ids),'exact_post_recovery_validation',true);
end
$recover$;

create or replace function public.recover_retailer_offer_sync_batch(p_request jsonb)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $recover_wrapper$
begin
  if current_user<>'retailer_catalogue_production_executor' then raise exception 'mixed recovery requires dedicated executor role'; end if;
  return public.retailer_offer_sync_recover_batch_internal(p_request);
end
$recover_wrapper$;

alter function public.retailer_offer_sync_validate_manifest(jsonb) owner to postgres;
alter function public.retailer_offer_sync_approve_batch_internal(jsonb) owner to postgres;
alter function public.approve_retailer_offer_sync_batch(jsonb) owner to postgres;
alter function public.retailer_offer_sync_row_state(bigint) owner to postgres;
alter function public.retailer_offer_sync_execute_batch_internal(jsonb) owner to postgres;
alter function public.execute_retailer_offer_sync_batch(jsonb) owner to postgres;
alter function public.retailer_offer_sync_approve_recovery_internal(jsonb) owner to postgres;
alter function public.approve_retailer_offer_sync_recovery(jsonb) owner to postgres;
alter function public.retailer_offer_sync_recover_batch_internal(jsonb) owner to postgres;
alter function public.recover_retailer_offer_sync_batch(jsonb) owner to postgres;
revoke all on function public.retailer_offer_sync_validate_manifest(jsonb),public.retailer_offer_sync_row_state(bigint),public.retailer_offer_sync_approve_batch_internal(jsonb),public.retailer_offer_sync_execute_batch_internal(jsonb),public.retailer_offer_sync_approve_recovery_internal(jsonb),public.retailer_offer_sync_recover_batch_internal(jsonb) from public,anon,authenticated,service_role,retailer_catalogue_production_approver,retailer_catalogue_production_executor;
revoke all on function public.approve_retailer_offer_sync_batch(jsonb),public.execute_retailer_offer_sync_batch(jsonb),public.approve_retailer_offer_sync_recovery(jsonb),public.recover_retailer_offer_sync_batch(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.approve_retailer_offer_sync_batch(jsonb),public.approve_retailer_offer_sync_recovery(jsonb) to retailer_catalogue_production_approver;
grant execute on function public.execute_retailer_offer_sync_batch(jsonb),public.recover_retailer_offer_sync_batch(jsonb) to retailer_catalogue_production_executor;
grant execute on function public.retailer_offer_sync_approve_batch_internal(jsonb),public.retailer_offer_sync_approve_recovery_internal(jsonb) to retailer_catalogue_production_approver;
grant execute on function public.retailer_offer_sync_execute_batch_internal(jsonb),public.retailer_offer_sync_recover_batch_internal(jsonb) to retailer_catalogue_production_executor;


-- Source: supabase\migrations\20260718170000_add_read_only_mixed_batch_validator.sql

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.retailer_offer_sync_validate_manifest(jsonb)') is null
     or to_regprocedure('public.validate_product_import_plan_read_only(jsonb)') is null
     or to_regprocedure('public.retailer_catalogue_assert_migration_ledger(jsonb,text)') is null
     or to_regprocedure('public.retailer_catalogue_production_runtime_guard(text,text,text)') is null then
    raise exception 'read-only mixed-batch validator requires the mixed-batch, verified no-change and production guard migrations';
  end if;
  if to_regprocedure('public.validate_retailer_offer_sync_batch_read_only(jsonb)') is not null then
    raise exception 'read-only mixed-batch validator is already installed; rerun rejected';
  end if;
end
$preflight$;

do $role$
declare v_role pg_roles%rowtype;
begin
  select * into v_role from pg_roles where rolname='retailer_catalogue_production_validator';
  if not found then
    create role retailer_catalogue_production_validator
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
       'schema_version','kind','artifact','validation_expires_at','production_project_ref',
       'production_database_identity','expected_migration_versions','expected_migration_fingerprint',
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

  perform public.retailer_catalogue_production_runtime_guard(
    'PRODUCTION',p_request->>'production_project_ref',p_request->>'production_database_identity');

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
  if current_user<>'retailer_catalogue_production_validator' then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Production validator role required');
  end if;
  return public.retailer_offer_sync_validate_batch_read_only_internal(p_request);
end
$validate_wrapper$;

alter function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb) owner to postgres;
alter function public.validate_retailer_offer_sync_batch_read_only(jsonb) owner to postgres;

revoke all on function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)
  from public,anon,authenticated,service_role,retailer_catalogue_production_approver,
       retailer_catalogue_production_executor,retailer_catalogue_production_validator;
revoke all on function public.validate_retailer_offer_sync_batch_read_only(jsonb)
  from public,anon,authenticated,service_role,retailer_catalogue_production_approver,
       retailer_catalogue_production_executor;
grant usage on schema public to retailer_catalogue_production_validator;
grant execute on function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)
  to retailer_catalogue_production_validator;
grant execute on function public.validate_retailer_offer_sync_batch_read_only(jsonb)
  to retailer_catalogue_production_validator;


-- Source: supabase\migrations\20260719090000_add_expired_retailer_offer_sync_approval_close.sql

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.retailer_offer_sync_batch_approvals') is null
     or to_regprocedure('public.retailer_catalogue_production_runtime_guard(text,text,text)') is null
     or to_regprocedure('public.retailer_catalogue_assert_migration_ledger(jsonb,text)') is null
     or to_regprocedure('public.retailer_catalogue_production_request_fingerprint(jsonb)') is null
     or to_regrole('retailer_catalogue_production_approver') is null
     or to_regrole('retailer_catalogue_production_executor') is null
     or to_regrole('retailer_catalogue_production_validator') is null then
    raise exception 'expired mixed approval close requires production executor, mixed-batch executor and validator migrations';
  end if;
  if to_regprocedure('public.close_expired_retailer_offer_sync_approval(jsonb)') is not null
     or exists(
       select 1 from information_schema.columns
       where table_schema='public' and table_name='retailer_offer_sync_batch_approvals'
         and column_name in ('closed_at','closed_by','close_reason','close_request_fingerprint','close_result')
     ) then
    raise exception 'expired mixed approval close is already installed; rerun rejected';
  end if;
end
$preflight$;

alter table public.retailer_offer_sync_batch_approvals
  add column closed_at timestamptz,
  add column closed_by text,
  add column close_reason text,
  add column close_request_fingerprint text,
  add column close_result jsonb,
  add constraint retailer_offer_sync_batch_close_state check (
    (closed_at is null and closed_by is null and close_reason is null and close_request_fingerprint is null and close_result is null)
    or
    (closed_at is not null and nullif(trim(closed_by),'') is not null and length(close_reason) between 1 and 500
      and close_request_fingerprint ~ '^[0-9a-f]{64}$' and jsonb_typeof(close_result)='object' and consumed_at is null)
  ),
  add constraint retailer_offer_sync_batch_close_fingerprint_unique unique(close_request_fingerprint);

drop index public.retailer_offer_sync_one_active_approval;
create unique index retailer_offer_sync_one_active_approval
  on public.retailer_offer_sync_batch_approvals(child_plan_id)
  where consumed_at is null and closed_at is null;

create or replace function public.retailer_offer_sync_close_expired_approval_internal(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path=pg_catalog,public,pg_temp
as $close_expired_internal$
declare
  v_approval public.retailer_offer_sync_batch_approvals%rowtype;
  v_child public.retailer_catalogue_child_plans%rowtype;
  v_parent public.retailer_catalogue_parent_plans%rowtype;
  v_request_fingerprint text;
  v_actual_migration_fingerprint text;
  v_row_approvals integer;
  v_apply_runs integer;
  v_recovery_manifests integer;
  v_recovery_approvals integer;
  v_recovery_audit integer;
  v_before_business jsonb;
  v_after_business jsonb;
  v_closed_at timestamptz;
  v_result jsonb;
  v_audit jsonb;
begin
  if not public.atomic_import_has_exact_keys(p_request,array[
    'schema_version','approval_id','parent_plan_id','child_plan_id',
    'parent_plan_fingerprint','child_plan_fingerprint','artifact_fingerprint','execution_fingerprint',
    'approval_expected_migration_fingerprint','expected_migration_versions','expected_migration_fingerprint',
    'migration_fingerprint_algorithm','migration_fingerprint_version','target_environment','production_project_ref',
    'production_database_identity','reason','closed_by','requested_at','request_fingerprint'
  ]) then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid expired approval close request keys');
  end if;
  if p_request->>'schema_version'<>'1'
     or p_request->>'migration_fingerprint_algorithm'<>'SHA-256'
     or p_request->>'migration_fingerprint_version'<>'RSBI-CJ1'
     or p_request->>'expected_migration_fingerprint'!~'^[0-9a-f]{64}$'
     or p_request->>'approval_expected_migration_fingerprint'!~'^[0-9a-f]{64}$'
     or p_request->>'artifact_fingerprint'!~'^[0-9a-f]{64}$'
     or p_request->>'execution_fingerprint'!~'^[0-9a-f]{64}$'
     or p_request->>'parent_plan_fingerprint'!~'^[0-9a-f]{64}$'
     or p_request->>'child_plan_fingerprint'!~'^[0-9a-f]{64}$'
     or jsonb_typeof(p_request->'expected_migration_versions') is distinct from 'array'
     or jsonb_array_length(p_request->'expected_migration_versions')<1
     or exists(select 1 from jsonb_array_elements_text(p_request->'expected_migration_versions') v where v!~'^[0-9]+_[a-z0-9_]+$')
     or (select count(*) from jsonb_array_elements_text(p_request->'expected_migration_versions'))<>(select count(distinct value) from jsonb_array_elements_text(p_request->'expected_migration_versions'))
     or length(trim(p_request->>'reason')) not between 1 and 500
     or nullif(trim(p_request->>'closed_by'),'') is null then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid expired approval close request values');
  end if;

  perform public.retailer_catalogue_production_runtime_guard(
    p_request->>'target_environment',p_request->>'production_project_ref',p_request->>'production_database_identity'
  );
  v_actual_migration_fingerprint:=public.retailer_catalogue_assert_migration_ledger(
    p_request->'expected_migration_versions',p_request->>'expected_migration_fingerprint'
  );
  v_request_fingerprint:=public.retailer_catalogue_production_request_fingerprint(p_request);
  if p_request->>'request_fingerprint' is distinct from v_request_fingerprint then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Expired approval close request fingerprint mismatch');
  end if;

  select * into v_approval
  from public.retailer_offer_sync_batch_approvals
  where id=(p_request->>'approval_id')::uuid
  for update;
  if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Mixed-batch approval not found'); end if;

  select * into v_child
  from public.retailer_catalogue_child_plans
  where id=(p_request->>'child_plan_id')::uuid
  for update;
  if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Linked child plan not found'); end if;

  select * into v_parent
  from public.retailer_catalogue_parent_plans
  where id=(p_request->>'parent_plan_id')::uuid
  for update;
  if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Linked parent plan not found'); end if;

  if v_approval.child_plan_id is distinct from v_child.id
     or v_child.parent_plan_id is distinct from v_parent.id
     or v_approval.target_environment is distinct from 'PRODUCTION'
     or v_approval.target_environment is distinct from p_request->>'target_environment'
     or v_approval.project_ref is distinct from p_request->>'production_project_ref'
     or v_approval.database_identity is distinct from p_request->>'production_database_identity'
     or v_approval.artifact_fingerprint is distinct from p_request->>'artifact_fingerprint'
     or v_approval.execution_fingerprint is distinct from p_request->>'execution_fingerprint'
     or v_approval.expected_migration_fingerprint is distinct from p_request->>'approval_expected_migration_fingerprint'
     or v_parent.parent_plan_fingerprint is distinct from p_request->>'parent_plan_fingerprint'
     or v_child.parent_plan_fingerprint is distinct from v_parent.parent_plan_fingerprint
     or v_child.child_plan_fingerprint is distinct from p_request->>'child_plan_fingerprint'
     or v_child.child_plan_fingerprint is distinct from v_approval.artifact_fingerprint
     or v_child.plan_json is distinct from v_approval.approved_manifest
     or v_child.source_snapshot_fingerprint is distinct from v_parent.source_snapshot_fingerprint
     or v_child.canonical_snapshot_fingerprint is distinct from v_parent.canonical_snapshot_fingerprint
     or v_child.adapter_fingerprint is distinct from v_parent.adapter_fingerprint
     or v_child.policy_fingerprint is distinct from v_parent.policy_fingerprint
     or v_child.code_commit is distinct from v_parent.code_commit
     or v_child.expected_state_fingerprint is distinct from v_parent.expected_state_fingerprint then
    perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Expired approval does not exactly bind target parent and child');
  end if;

  if v_approval.closed_at is not null then
    if v_approval.close_request_fingerprint is distinct from v_request_fingerprint
       or v_parent.status<>'EXPIRED' or v_child.status<>'EXPIRED'
       or v_approval.close_result is null then
      perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Expired approval was closed by a different request or has inconsistent state');
    end if;
    return v_approval.close_result||jsonb_build_object('already_closed',true,'control_writes',0);
  end if;

  if (p_request->>'requested_at')::timestamptz<clock_timestamp()-interval '15 minutes'
     or (p_request->>'requested_at')::timestamptz>clock_timestamp()+interval '5 minutes' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_STALE','Expired approval close request is stale or future');
  end if;
  if v_approval.expires_at>clock_timestamp()
     or v_parent.approval_expires_at>clock_timestamp()
     or v_child.approval_expires_at>clock_timestamp() then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Approval is not expired');
  end if;
  if v_approval.consumed_at is not null
     or v_parent.approval_consumed_at is not null
     or v_child.approval_consumed_at is not null then
    perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Consumed approval cannot be closed as expired');
  end if;
  if v_parent.status<>'APPROVED' or v_child.status<>'APPROVED'
     or v_parent.approval_id is null or v_child.approval_id is null
     or v_parent.approval_expires_at is distinct from v_approval.expires_at
     or v_child.approval_expires_at is distinct from v_approval.expires_at then
    perform public.retailer_catalogue_raise('RSBI_INVALID_TRANSITION','Parent or child is not an exact unexecuted expired approval');
  end if;
  if v_approval.result is not null then
    perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Approval already contains execution result');
  end if;

  select count(*) into v_row_approvals
  from public.approved_import_plans
  where source='retailer_offer_mixed_batch'
    and artifact_sha256=v_approval.artifact_fingerprint
    and run_id like 'mbs-'||left(v_approval.execution_fingerprint,16)||'-%';
  select count(*) into v_apply_runs from public.retailer_catalogue_apply_runs where child_plan_id=v_child.id;
  select count(*) into v_recovery_manifests from public.retailer_catalogue_production_recovery_manifests where child_plan_id=v_child.id;
  select count(*) into v_recovery_approvals
  from public.retailer_catalogue_production_recovery_approvals a
  join public.retailer_catalogue_production_recovery_manifests m on m.id=a.recovery_manifest_id
  where m.child_plan_id=v_child.id;
  select count(*) into v_recovery_audit
  from public.retailer_catalogue_production_recovery_audit a
  join public.retailer_catalogue_production_recovery_manifests m on m.id=a.recovery_manifest_id
  where m.child_plan_id=v_child.id;
  if v_row_approvals<>0 then perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Row approvals exist for expired mixed batch'); end if;
  if v_recovery_manifests<>0 or v_recovery_approvals<>0 or v_recovery_audit<>0 then
    perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Recovery state exists for expired mixed batch');
  end if;
  if v_apply_runs<>0 then perform public.retailer_catalogue_raise('RSBI_PARTIAL_BATCH_STATE','Apply run exists for expired mixed batch'); end if;

  v_before_business:=public.retailer_catalogue_business_counts();
  v_closed_at:=clock_timestamp();
  v_result:=jsonb_build_object(
    'status','EXPIRED','approval_id',v_approval.id,'parent_plan_id',v_parent.id,'child_plan_id',v_child.id,
    'closed_at',v_closed_at,'closed_by',trim(p_request->>'closed_by'),'reason',trim(p_request->>'reason'),
    'request_fingerprint',v_request_fingerprint,'actual_migration_fingerprint',v_actual_migration_fingerprint,
    'approval_consumed',false,'parent_status','EXPIRED','child_status','EXPIRED','already_closed',false,
    'row_approvals',0,'apply_runs',0,'recovery_records',0,'business_writes',0,'price_history_writes',0,'control_writes',3
  );
  v_audit:=jsonb_build_object(
    'event','EXPIRED_MIXED_APPROVAL_CLOSED','approval_id',v_approval.id,'request_fingerprint',v_request_fingerprint,
    'reason',trim(p_request->>'reason'),'actor',trim(p_request->>'closed_by'),'at',v_closed_at
  );

  update public.retailer_offer_sync_batch_approvals
  set closed_at=v_closed_at,closed_by=trim(p_request->>'closed_by'),close_reason=trim(p_request->>'reason'),
      close_request_fingerprint=v_request_fingerprint,close_result=v_result
  where id=v_approval.id;
  update public.retailer_catalogue_parent_plans
  set status='EXPIRED',updated_at=v_closed_at,audit_log=audit_log||jsonb_build_array(v_audit)
  where id=v_parent.id;
  update public.retailer_catalogue_child_plans
  set status='EXPIRED',updated_at=v_closed_at,audit_log=audit_log||jsonb_build_array(v_audit)
  where id=v_child.id;

  v_after_business:=public.retailer_catalogue_business_counts();
  if v_after_business is distinct from v_before_business then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_DELTA_MISMATCH','Business state changed while closing expired approval');
  end if;
  return v_result;
end
$close_expired_internal$;

create or replace function public.close_expired_retailer_offer_sync_approval(p_request jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path=pg_catalog,public,pg_temp
as $close_expired_wrapper$
begin
  if current_user<>'retailer_catalogue_production_approver' then
    raise exception 'expired mixed approval close requires the dedicated approver role';
  end if;
  return public.retailer_offer_sync_close_expired_approval_internal(p_request);
end
$close_expired_wrapper$;

alter function public.retailer_offer_sync_close_expired_approval_internal(jsonb) owner to postgres;
alter function public.close_expired_retailer_offer_sync_approval(jsonb) owner to postgres;

revoke all on function public.retailer_offer_sync_close_expired_approval_internal(jsonb)
  from public,anon,authenticated,service_role,retailer_catalogue_production_approver,retailer_catalogue_production_executor,retailer_catalogue_production_validator;
revoke all on function public.close_expired_retailer_offer_sync_approval(jsonb)
  from public,anon,authenticated,service_role,retailer_catalogue_production_executor,retailer_catalogue_production_validator;
grant execute on function public.close_expired_retailer_offer_sync_approval(jsonb)
  to retailer_catalogue_production_approver;
grant execute on function public.retailer_offer_sync_close_expired_approval_internal(jsonb)
  to retailer_catalogue_production_approver;

-- Final production security boundary. Runtime entrypoints are role-separated;
-- internal SECURITY DEFINER functions remain inaccessible to callers.
alter role retailer_catalogue_production_validator
  nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
alter role retailer_catalogue_production_approver
  nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
alter role retailer_catalogue_production_executor
  nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;

revoke retailer_catalogue_production_validator from retailer_catalogue_production_approver, retailer_catalogue_production_executor;
revoke retailer_catalogue_production_approver from retailer_catalogue_production_validator, retailer_catalogue_production_executor;
revoke retailer_catalogue_production_executor from retailer_catalogue_production_validator, retailer_catalogue_production_approver;

revoke all on all tables in schema public
  from retailer_catalogue_production_validator, retailer_catalogue_production_approver, retailer_catalogue_production_executor;
revoke all on all sequences in schema public
  from retailer_catalogue_production_validator, retailer_catalogue_production_approver, retailer_catalogue_production_executor;

revoke execute on all functions in schema public
  from retailer_catalogue_production_validator, retailer_catalogue_production_approver, retailer_catalogue_production_executor;

grant usage on schema public
  to retailer_catalogue_production_validator, retailer_catalogue_production_approver, retailer_catalogue_production_executor;
grant execute on function public.validate_retailer_offer_sync_batch_read_only(jsonb),
  public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)
  to retailer_catalogue_production_validator;
grant execute on function public.approve_retailer_offer_sync_batch(jsonb),
  public.approve_retailer_offer_sync_recovery(jsonb),
  public.close_expired_retailer_offer_sync_approval(jsonb),
  public.retailer_offer_sync_approve_batch_internal(jsonb),
  public.retailer_offer_sync_approve_recovery_internal(jsonb),
  public.retailer_offer_sync_close_expired_approval_internal(jsonb)
  to retailer_catalogue_production_approver;
grant execute on function public.execute_retailer_offer_sync_batch(jsonb),
  public.recover_retailer_offer_sync_batch(jsonb),
  public.retailer_offer_sync_execute_batch_internal(jsonb),
  public.retailer_offer_sync_recover_batch_internal(jsonb)
  to retailer_catalogue_production_executor;

revoke execute on function public.create_retailer_catalogue_parent_plan(jsonb,text,text,text),
  public.approve_retailer_catalogue_parent_plan(uuid,text,text,timestamptz),
  public.generate_retailer_catalogue_child_plans(uuid,text),
  public.approve_retailer_catalogue_child_plan(uuid,uuid,text,text,timestamptz),
  public.begin_retailer_catalogue_child_apply(uuid,text,text,text,text,text,text,text,text,text),
  public.complete_retailer_catalogue_child_apply(uuid,text,text,jsonb,jsonb,text),
  public.fail_retailer_catalogue_child_apply(uuid,text,text,text,jsonb,text),
  public.resume_retailer_catalogue_parent_plan(uuid,text,text,text),
  public.request_retailer_catalogue_child_rollback(uuid,text,text,text,text),
  public.complete_retailer_catalogue_child_rollback(uuid,text,text,jsonb,text),
  public.get_retailer_catalogue_plan_status(uuid),
  public.approve_product_import_plan(jsonb,text,text,text,timestamptz),
  public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text),
  public.approve_retailer_offer_sync_batch(jsonb),
  public.execute_retailer_offer_sync_batch(jsonb),
  public.approve_retailer_offer_sync_recovery(jsonb),
  public.recover_retailer_offer_sync_batch(jsonb),
  public.validate_retailer_offer_sync_batch_read_only(jsonb),
  public.close_expired_retailer_offer_sync_approval(jsonb)
  from service_role;

commit;
