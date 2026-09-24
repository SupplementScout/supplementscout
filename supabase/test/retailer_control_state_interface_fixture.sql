\if :{?expected_database}
\else
  \quit
\endif

select current_database() = :'expected_database' as database_ok \gset
\if :database_ok
\else
  \quit
\endif

do $guard$
declare
  v_addr inet := inet_server_addr();
begin
  if current_database() !~ '^ra004_control_state_test_[a-z0-9_]+$' then
    raise exception 'RA004_LOCAL_GUARD: unexpected database %',current_database();
  end if;
  if v_addr is not null and not (v_addr <<= inet '127.0.0.0/8' or v_addr = inet '::1') then
    raise exception 'RA004_LOCAL_GUARD: non-loopback server %',v_addr;
  end if;
end
$guard$;

do $roles$
declare v_name text;
begin
  foreach v_name in array array[
    'anon','authenticated','service_role',
    'retailer_catalogue_production_validator',
    'retailer_catalogue_production_approver',
    'retailer_catalogue_production_executor'
  ] loop
    if not exists(select 1 from pg_roles where rolname=v_name) then
      execute format('create role %I nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls',v_name);
    end if;
  end loop;
end
$roles$;

create table public.retailer_catalogue_parent_plans (
  id uuid primary key default gen_random_uuid(), parent_plan_fingerprint text not null unique,
  retailer_id bigint not null, source_snapshot_fingerprint text not null,
  status text not null, approval_id uuid, approved_at timestamptz,
  approval_expires_at timestamptz, approval_consumed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  audit_log jsonb not null default '[]'::jsonb
);
create table public.retailer_catalogue_child_plans (
  id uuid primary key, parent_plan_id uuid not null references public.retailer_catalogue_parent_plans(id),
  retailer_id bigint not null, child_plan_fingerprint text not null unique,
  dependency_group text not null, batch_index integer not null, status text not null,
  approval_id uuid, approved_at timestamptz, approval_expires_at timestamptz,
  approval_consumed_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), audit_log jsonb not null default '[]'::jsonb
);
create table public.retailer_catalogue_apply_runs (
  id uuid primary key default gen_random_uuid(), parent_plan_id uuid not null,
  child_plan_id uuid not null, retailer_id bigint not null, run_type text not null,
  status text not null, expected_state_fingerprint text not null,
  started_at timestamptz not null default now(), completed_at timestamptz
);
create table public.retailer_offer_sync_batch_approvals (
  id uuid primary key default gen_random_uuid(), child_plan_id uuid not null,
  approved_at timestamptz not null, expires_at timestamptz not null,
  consumed_at timestamptz, execution_fingerprint text not null
);
create table public.approved_import_plans (
  id uuid primary key default gen_random_uuid(), retailer_id bigint,
  created_at timestamptz not null default now(), expires_at timestamptz not null,
  consumed_at timestamptz, status text not null, artifact_sha256 text not null
);
create table public.retailer_catalogue_production_fixture_approvals (
  id uuid primary key default gen_random_uuid(), parent_plan_id uuid,
  approved_at timestamptz not null, expires_at timestamptz not null,
  consumed_at timestamptz, package_fingerprint text not null
);
create table public.retailer_catalogue_production_recovery_manifests (
  id uuid primary key default gen_random_uuid(), child_plan_id uuid not null,
  apply_run_id uuid not null, execution_fingerprint text not null,
  rollback_manifest_fingerprint text not null, status text not null,
  recovered_at timestamptz, created_at timestamptz not null default now()
);
create table public.retailer_catalogue_production_recovery_approvals (
  id uuid primary key default gen_random_uuid(), recovery_manifest_id uuid not null,
  approved_at timestamptz not null, expires_at timestamptz not null,
  consumed_at timestamptz, expected_recovery_state_fingerprint text not null
);
create table public.retailer_offer_sync_reviewed_mixed_change_bindings (
  approval_id uuid primary key, status text not null, approved_at timestamptz not null,
  consumed_at timestamptz, reviewed_contract_hash text not null
);

do $rls$
declare v_table text;
begin
  foreach v_table in array array[
    'retailer_catalogue_parent_plans','retailer_catalogue_child_plans',
    'retailer_catalogue_apply_runs','retailer_offer_sync_batch_approvals',
    'approved_import_plans','retailer_catalogue_production_fixture_approvals',
    'retailer_catalogue_production_recovery_manifests',
    'retailer_catalogue_production_recovery_approvals',
    'retailer_offer_sync_reviewed_mixed_change_bindings'
  ] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('alter table public.%I force row level security',v_table);
    execute format('revoke all on table public.%I from public,anon,authenticated,service_role',v_table);
  end loop;
end
$rls$;
