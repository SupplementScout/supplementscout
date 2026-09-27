-- RA-004 staging-only compatibility closure.
-- This migration restores only the schema dependencies omitted with the
-- production executor migration. It creates no business rows, approvals,
-- executor functions, production target attestation, or production wiring.

-- PostgreSQL 17 automatically grants a newly created role back to a
-- non-superuser CREATEROLE operator as if the bootstrap superuser had issued
-- WITH ADMIN TRUE, SET FALSE, INHERIT FALSE. Supabase migrations run as the
-- selector-bound `postgres` database owner. This contract admits only that
-- exact administrative edge and rejects every other membership or operator.
do $migration_operator$
begin
  if current_user <> 'postgres' or session_user <> 'postgres'
     or not exists (
       select 1 from pg_roles
       where rolname = current_user and rolcreaterole
     ) then
    raise exception 'RA004_COMPATIBILITY_MIGRATION_USER_MISMATCH';
  end if;
end
$migration_operator$;

do $existing_drift$
declare
  v_role text;
  v_table text;
begin
  foreach v_role in array array[
    'retailer_catalogue_production_approver',
    'retailer_catalogue_production_executor',
    'retailer_catalogue_production_validator'
  ] loop
    if exists (select 1 from pg_roles where rolname = v_role) and (
      not exists (
        select 1 from pg_roles where rolname = v_role and not rolcanlogin and not rolinherit and not rolsuper
          and not rolcreatedb and not rolcreaterole and not rolreplication and not rolbypassrls
          and rolconnlimit = -1 and rolvaliduntil is null and coalesce(array_length(rolconfig, 1), 0) = 0
      ) or 1 <> (
        select count(*) from pg_auth_members m
        join pg_roles member_role on member_role.oid = m.member
        join pg_roles granted_role on granted_role.oid = m.roleid
        where member_role.rolname = v_role or granted_role.rolname = v_role
      ) or not exists (
        select 1 from pg_auth_members m
        join pg_roles member_role on member_role.oid = m.member
        join pg_roles granted_role on granted_role.oid = m.roleid
        join pg_roles grantor_role on grantor_role.oid = m.grantor
        where member_role.rolname = current_user and granted_role.rolname = v_role
          and m.admin_option
          and not coalesce((to_jsonb(m)->>'set_option')::boolean, true)
          and not coalesce((to_jsonb(m)->>'inherit_option')::boolean, true)
          and grantor_role.rolsuper
      )
    ) then
      raise exception 'RA004_COMPATIBILITY_ROLE_DRIFT: %', v_role;
    end if;
  end loop;

  foreach v_table in array array[
    'retailer_catalogue_production_fixture_approvals',
    'retailer_catalogue_production_recovery_manifests',
    'retailer_catalogue_production_recovery_approvals'
  ] loop
    if to_regclass('public.' || v_table) is not null and (
      not exists (
        select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = v_table and c.relkind = 'r'
          and pg_get_userbyid(c.relowner) = 'postgres' and c.relrowsecurity and c.relforcerowsecurity
      ) or exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = v_table
      ) or exists (
        select 1 from information_schema.role_table_grants
        where table_schema = 'public' and table_name = v_table and grantee <> 'postgres'
      )
    ) then
      raise exception 'RA004_COMPATIBILITY_TABLE_SECURITY_DRIFT: public.%', v_table;
    end if;
  end loop;
end
$existing_drift$;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'retailer_catalogue_production_approver') then
    create role retailer_catalogue_production_approver
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'retailer_catalogue_production_executor') then
    create role retailer_catalogue_production_executor
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'retailer_catalogue_production_validator') then
    create role retailer_catalogue_production_validator
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;

end
$roles$;

create table if not exists public.retailer_catalogue_production_fixture_approvals (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null,
  package_fingerprint text not null check(package_fingerprint ~ '^[0-9a-f]{64}$'),
  fixture_id text not null,
  fixture_fingerprint text not null check(fixture_fingerprint ~ '^[0-9a-f]{64}$'),
  fixture_build_commit text not null check(fixture_build_commit ~ '^[0-9a-f]{40}$'),
  project_ref text not null,
  database_identity text not null,
  migration_ledger_fingerprint text not null check(migration_ledger_fingerprint ~ '^[0-9a-f]{64}$'),
  expected_migration_identifiers jsonb not null check(jsonb_typeof(expected_migration_identifiers) = 'array'),
  source_snapshot_fingerprint text not null check(source_snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  canonical_snapshot_fingerprint text not null check(canonical_snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  adapter_fingerprint text not null check(adapter_fingerprint ~ '^[0-9a-f]{64}$'),
  policy_fingerprint text not null check(policy_fingerprint ~ '^[0-9a-f]{64}$'),
  code_commit text not null check(code_commit ~ '^[0-9a-f]{40}$'),
  canonical_decisions jsonb not null check(jsonb_typeof(canonical_decisions) = 'object'),
  approved_by text not null,
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  parent_plan_id uuid unique,
  check(expires_at > approved_at),
  unique(package_id, package_fingerprint)
);

create unique index if not exists retailer_catalogue_production_fixture_active_idx
  on public.retailer_catalogue_production_fixture_approvals(fixture_fingerprint, project_ref, database_identity)
  where consumed_at is null;

create table if not exists public.retailer_catalogue_production_recovery_manifests (
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
  status text not null default 'READY' check(status in ('READY', 'RECOVERED', 'FAILED')),
  recovered_at timestamptz,
  failure_evidence jsonb,
  created_at timestamptz not null default now(),
  mixed_batch_artifact_fingerprint text check(mixed_batch_artifact_fingerprint is null or mixed_batch_artifact_fingerprint ~ '^[0-9a-f]{64}$'),
  mixed_batch_before_state jsonb check(mixed_batch_before_state is null or jsonb_typeof(mixed_batch_before_state) = 'array'),
  mixed_batch_applied_state jsonb check(mixed_batch_applied_state is null or jsonb_typeof(mixed_batch_applied_state) = 'array'),
  mixed_batch_migration_versions jsonb check(mixed_batch_migration_versions is null or jsonb_typeof(mixed_batch_migration_versions) = 'array'),
  mixed_batch_expected_migration_fingerprint text check(mixed_batch_expected_migration_fingerprint is null or mixed_batch_expected_migration_fingerprint ~ '^[0-9a-f]{64}$'),
  mixed_batch_migration_fingerprint_algorithm text check(mixed_batch_migration_fingerprint_algorithm is null or mixed_batch_migration_fingerprint_algorithm = 'SHA-256'),
  mixed_batch_migration_fingerprint_version text check(mixed_batch_migration_fingerprint_version is null or mixed_batch_migration_fingerprint_version = 'RSBI-CJ1'),
  mixed_batch_execution_migration_fingerprint text check(mixed_batch_execution_migration_fingerprint is null or mixed_batch_execution_migration_fingerprint ~ '^[0-9a-f]{64}$')
);

create table if not exists public.retailer_catalogue_production_recovery_approvals (
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
  mixed_batch_expected_migration_versions jsonb check(mixed_batch_expected_migration_versions is null or jsonb_typeof(mixed_batch_expected_migration_versions) = 'array'),
  mixed_batch_expected_migration_fingerprint text check(mixed_batch_expected_migration_fingerprint is null or mixed_batch_expected_migration_fingerprint ~ '^[0-9a-f]{64}$'),
  mixed_batch_migration_fingerprint_algorithm text check(mixed_batch_migration_fingerprint_algorithm is null or mixed_batch_migration_fingerprint_algorithm = 'SHA-256'),
  mixed_batch_migration_fingerprint_version text check(mixed_batch_migration_fingerprint_version is null or mixed_batch_migration_fingerprint_version = 'RSBI-CJ1'),
  mixed_batch_original_execution_migration_fingerprint text check(mixed_batch_original_execution_migration_fingerprint is null or mixed_batch_original_execution_migration_fingerprint ~ '^[0-9a-f]{64}$'),
  check(expires_at > approved_at)
);

create unique index if not exists retailer_catalogue_production_recovery_active_idx
  on public.retailer_catalogue_production_recovery_approvals(recovery_manifest_id)
  where consumed_at is null;

alter table public.retailer_catalogue_production_fixture_approvals owner to postgres;
alter table public.retailer_catalogue_production_recovery_manifests owner to postgres;
alter table public.retailer_catalogue_production_recovery_approvals owner to postgres;
alter table public.retailer_catalogue_production_fixture_approvals enable row level security;
alter table public.retailer_catalogue_production_fixture_approvals force row level security;
alter table public.retailer_catalogue_production_recovery_manifests enable row level security;
alter table public.retailer_catalogue_production_recovery_manifests force row level security;
alter table public.retailer_catalogue_production_recovery_approvals enable row level security;
alter table public.retailer_catalogue_production_recovery_approvals force row level security;

revoke all on table
  public.retailer_catalogue_production_fixture_approvals,
  public.retailer_catalogue_production_recovery_manifests,
  public.retailer_catalogue_production_recovery_approvals
from public, anon, authenticated, service_role,
  retailer_catalogue_production_approver,
  retailer_catalogue_production_executor,
  retailer_catalogue_production_validator;

do $contract$
declare
  v_role text;
  v_table text;
  v_expected_columns text[];
  v_actual_columns text[];
begin
  foreach v_role in array array[
    'retailer_catalogue_production_approver',
    'retailer_catalogue_production_executor',
    'retailer_catalogue_production_validator'
  ] loop
    if not exists (
      select 1 from pg_roles
      where rolname = v_role and not rolcanlogin and not rolinherit and not rolsuper
        and not rolcreatedb and not rolcreaterole and not rolreplication and not rolbypassrls
        and rolconnlimit = -1 and rolvaliduntil is null and coalesce(array_length(rolconfig, 1), 0) = 0
    ) or 1 <> (
      select count(*) from pg_auth_members m
      join pg_roles member_role on member_role.oid = m.member
      join pg_roles granted_role on granted_role.oid = m.roleid
      where member_role.rolname = v_role or granted_role.rolname = v_role
    ) or not exists (
      select 1 from pg_auth_members m
      join pg_roles member_role on member_role.oid = m.member
      join pg_roles granted_role on granted_role.oid = m.roleid
      join pg_roles grantor_role on grantor_role.oid = m.grantor
      where member_role.rolname = current_user and granted_role.rolname = v_role
        and m.admin_option
        and not coalesce((to_jsonb(m)->>'set_option')::boolean, true)
        and not coalesce((to_jsonb(m)->>'inherit_option')::boolean, true)
        and grantor_role.rolsuper
    ) or exists (
      select 1 from pg_class object
      cross join lateral aclexplode(coalesce(
        object.relacl,
        acldefault(case when object.relkind = 'S' then 's'::"char" else 'r'::"char" end, object.relowner)
      )) privilege
      join pg_roles grantee on grantee.oid = privilege.grantee
      where grantee.rolname = v_role
    ) or exists (
      select 1 from pg_proc function
      cross join lateral aclexplode(coalesce(function.proacl, acldefault('f', function.proowner))) privilege
      join pg_roles grantee on grantee.oid = privilege.grantee
      where grantee.rolname = v_role
    ) then
      raise exception 'RA004_COMPATIBILITY_ROLE_DRIFT: %', v_role;
    end if;
  end loop;

  foreach v_table in array array[
    'retailer_catalogue_production_fixture_approvals',
    'retailer_catalogue_production_recovery_manifests',
    'retailer_catalogue_production_recovery_approvals'
  ] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table and c.relkind = 'r'
        and pg_get_userbyid(c.relowner) = 'postgres' and c.relrowsecurity and c.relforcerowsecurity
    ) or exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = v_table
    ) or exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public' and table_name = v_table and grantee <> 'postgres'
    ) then
      raise exception 'RA004_COMPATIBILITY_TABLE_SECURITY_DRIFT: public.%', v_table;
    end if;
  end loop;

  v_expected_columns := array[
    'adapter_fingerprint:text:t','approved_at:timestamp with time zone:t','approved_by:text:t',
    'canonical_decisions:jsonb:t','canonical_snapshot_fingerprint:text:t','code_commit:text:t',
    'consumed_at:timestamp with time zone:f','database_identity:text:t','expected_migration_identifiers:jsonb:t',
    'expires_at:timestamp with time zone:t','fixture_build_commit:text:t','fixture_fingerprint:text:t',
    'fixture_id:text:t','id:uuid:t','migration_ledger_fingerprint:text:t','package_fingerprint:text:t',
    'package_id:uuid:t','parent_plan_id:uuid:f','policy_fingerprint:text:t','project_ref:text:t',
    'source_snapshot_fingerprint:text:t'
  ];
  select array_agg(a.attname || ':' || format_type(a.atttypid,a.atttypmod) || ':' || case when a.attnotnull then 't' else 'f' end order by a.attname)
    into v_actual_columns from pg_attribute a
    where a.attrelid = 'public.retailer_catalogue_production_fixture_approvals'::regclass and a.attnum > 0 and not a.attisdropped;
  if v_actual_columns is distinct from v_expected_columns then
    raise exception 'RA004_COMPATIBILITY_COLUMN_DRIFT: public.retailer_catalogue_production_fixture_approvals';
  end if;

  v_expected_columns := array[
    'applied_owned_state_fingerprint:text:t','apply_run_id:uuid:t','before_counts:jsonb:t','child_plan_id:uuid:t',
    'created_at:timestamp with time zone:t','created_mapping_ids:jsonb:t','created_offer_ids:jsonb:t',
    'created_price_history_ids:jsonb:t','created_product_ids:jsonb:t','created_variant_ids:jsonb:t',
    'dependency_group:text:t','execution_fingerprint:text:t','failure_evidence:jsonb:f','id:uuid:t',
    'mixed_batch_applied_state:jsonb:f','mixed_batch_artifact_fingerprint:text:f',
    'mixed_batch_before_state:jsonb:f','mixed_batch_execution_migration_fingerprint:text:f',
    'mixed_batch_expected_migration_fingerprint:text:f','mixed_batch_migration_fingerprint_algorithm:text:f',
    'mixed_batch_migration_fingerprint_version:text:f','mixed_batch_migration_versions:jsonb:f',
    'orphan_counts:jsonb:t','other_retailer_fingerprint:text:t','ownership:jsonb:t','package_fingerprint:text:t',
    'package_id:uuid:t','protected_shared_fingerprint:text:t','recovered_at:timestamp with time zone:f',
    'reverse_dependency_order:jsonb:t','rollback_manifest_fingerprint:text:t','status:text:t',
    'updated_before_state:jsonb:t'
  ];
  select array_agg(a.attname || ':' || format_type(a.atttypid,a.atttypmod) || ':' || case when a.attnotnull then 't' else 'f' end order by a.attname)
    into v_actual_columns from pg_attribute a
    where a.attrelid = 'public.retailer_catalogue_production_recovery_manifests'::regclass and a.attnum > 0 and not a.attisdropped;
  if v_actual_columns is distinct from v_expected_columns then
    raise exception 'RA004_COMPATIBILITY_COLUMN_DRIFT: public.retailer_catalogue_production_recovery_manifests';
  end if;

  v_expected_columns := array[
    'approved_at:timestamp with time zone:t','approved_by:text:t','child_plan_id:uuid:t','consumed_at:timestamp with time zone:f',
    'database_identity:text:t','execution_fingerprint:text:t','expected_recovery_state:jsonb:t',
    'expected_recovery_state_fingerprint:text:t','expires_at:timestamp with time zone:t','id:uuid:t',
    'mixed_batch_expected_migration_fingerprint:text:f','mixed_batch_expected_migration_versions:jsonb:f',
    'mixed_batch_migration_fingerprint_algorithm:text:f','mixed_batch_migration_fingerprint_version:text:f',
    'mixed_batch_original_execution_migration_fingerprint:text:f','package_fingerprint:text:t','package_id:uuid:t',
    'project_ref:text:t','recovery_manifest_id:uuid:t','rollback_manifest_fingerprint:text:t'
  ];
  select array_agg(a.attname || ':' || format_type(a.atttypid,a.atttypmod) || ':' || case when a.attnotnull then 't' else 'f' end order by a.attname)
    into v_actual_columns from pg_attribute a
    where a.attrelid = 'public.retailer_catalogue_production_recovery_approvals'::regclass and a.attnum > 0 and not a.attisdropped;
  if v_actual_columns is distinct from v_expected_columns then
    raise exception 'RA004_COMPATIBILITY_COLUMN_DRIFT: public.retailer_catalogue_production_recovery_approvals';
  end if;

  if (select count(*) from pg_constraint where conrelid='public.retailer_catalogue_production_fixture_approvals'::regclass) <> 15
     or (select count(*) from pg_constraint where conrelid='public.retailer_catalogue_production_recovery_manifests'::regclass) <> 21
     or (select count(*) from pg_constraint where conrelid='public.retailer_catalogue_production_recovery_approvals'::regclass) <> 12
     or not exists (select 1 from pg_constraint where conrelid='public.retailer_catalogue_production_recovery_manifests'::regclass and contype='f' and pg_get_constraintdef(oid,true)='FOREIGN KEY (child_plan_id) REFERENCES retailer_catalogue_child_plans(id) ON DELETE RESTRICT')
     or not exists (select 1 from pg_constraint where conrelid='public.retailer_catalogue_production_recovery_manifests'::regclass and contype='f' and pg_get_constraintdef(oid,true)='FOREIGN KEY (apply_run_id) REFERENCES retailer_catalogue_apply_runs(id) ON DELETE RESTRICT')
     or not exists (select 1 from pg_constraint where conrelid='public.retailer_catalogue_production_recovery_approvals'::regclass and contype='f' and pg_get_constraintdef(oid,true)='FOREIGN KEY (recovery_manifest_id) REFERENCES retailer_catalogue_production_recovery_manifests(id) ON DELETE RESTRICT') then
    raise exception 'RA004_COMPATIBILITY_CONSTRAINT_DRIFT';
  end if;

  if (select pg_get_expr(d.adbin,d.adrelid) from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum where d.adrelid='public.retailer_catalogue_production_fixture_approvals'::regclass and a.attname='id') <> 'gen_random_uuid()'
     or (select pg_get_expr(d.adbin,d.adrelid) from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum where d.adrelid='public.retailer_catalogue_production_fixture_approvals'::regclass and a.attname='approved_at') <> 'now()'
     or (select pg_get_expr(d.adbin,d.adrelid) from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum where d.adrelid='public.retailer_catalogue_production_recovery_manifests'::regclass and a.attname='status') <> '''READY''::text'
     or (select count(*) from pg_attrdef where adrelid='public.retailer_catalogue_production_fixture_approvals'::regclass) <> 2
     or (select count(*) from pg_attrdef where adrelid='public.retailer_catalogue_production_recovery_manifests'::regclass) <> 9
     or (select count(*) from pg_attrdef where adrelid='public.retailer_catalogue_production_recovery_approvals'::regclass) <> 2 then
    raise exception 'RA004_COMPATIBILITY_DEFAULT_DRIFT';
  end if;

  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='retailer_catalogue_production_fixture_active_idx' and indexdef like '%(fixture_fingerprint, project_ref, database_identity)%WHERE (consumed_at IS NULL)')
     or not exists (select 1 from pg_indexes where schemaname='public' and indexname='retailer_catalogue_production_recovery_active_idx' and indexdef like '%(recovery_manifest_id)%WHERE (consumed_at IS NULL)') then
    raise exception 'RA004_COMPATIBILITY_INDEX_DRIFT';
  end if;
end
$contract$;
