begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.retailer_catalogue_parent_plans') is null
     or to_regclass('public.retailer_catalogue_child_plans') is null
     or to_regclass('public.retailer_catalogue_apply_runs') is null
     or to_regprocedure('public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)') is null then
    raise exception 'staging executor migration requires atomic importer, approval ledger, and Phase 2 control ledger';
  end if;
  if to_regclass('public.retailer_catalogue_staging_fixture_approvals') is not null then
    raise exception 'staging executor migration is already installed; rerun rejected';
  end if;
end
$preflight$;

alter table public.retailer_catalogue_parent_plans drop constraint retailer_catalogue_parent_plans_target_environment_check;
alter table public.retailer_catalogue_parent_plans add constraint retailer_catalogue_parent_plans_target_environment_check check (target_environment in ('LOCAL_POSTGRES','DRY_RUN','STAGING'));
alter table public.retailer_catalogue_child_plans drop constraint retailer_catalogue_child_plans_target_environment_check;
alter table public.retailer_catalogue_child_plans add constraint retailer_catalogue_child_plans_target_environment_check check (target_environment in ('LOCAL_POSTGRES','DRY_RUN','STAGING'));
alter table public.retailer_catalogue_apply_runs drop constraint retailer_catalogue_apply_runs_target_environment_check;
alter table public.retailer_catalogue_apply_runs add constraint retailer_catalogue_apply_runs_target_environment_check check (target_environment in ('LOCAL_POSTGRES','DRY_RUN','STAGING'));

do $roles$
begin
  if not exists(select 1 from pg_roles where rolname='retailer_catalogue_staging_approver') then create role retailer_catalogue_staging_approver nologin; end if;
  if not exists(select 1 from pg_roles where rolname='retailer_catalogue_staging_executor') then create role retailer_catalogue_staging_executor nologin; end if;
end
$roles$;

-- This row is an owner-provisioned database attestation, not a client/session claim.
create table public.retailer_catalogue_database_targets (
  id boolean primary key default true check(id),
  target_environment text not null check(target_environment in ('STAGING','PRODUCTION')),
  project_ref text not null check(project_ref ~ '^[a-z]{20}$'),
  database_identity text not null,
  database_system_identifier text not null,
  database_oid oid not null,
  is_active boolean not null default true,
  attested_by text not null,
  attested_at timestamptz not null default now()
);

create table public.retailer_catalogue_staging_fixture_approvals (
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
create unique index retailer_catalogue_staging_fixture_active_idx on public.retailer_catalogue_staging_fixture_approvals(fixture_fingerprint,project_ref,database_identity) where consumed_at is null;

create table public.retailer_catalogue_staging_recovery_manifests (
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

create table public.retailer_catalogue_staging_recovery_approvals (
  id uuid primary key default gen_random_uuid(),
  recovery_manifest_id uuid not null references public.retailer_catalogue_staging_recovery_manifests(id) on delete restrict,
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
create unique index retailer_catalogue_staging_recovery_active_idx on public.retailer_catalogue_staging_recovery_approvals(recovery_manifest_id) where consumed_at is null;

create table public.retailer_catalogue_staging_recovery_audit (
  id uuid primary key default gen_random_uuid(),
  recovery_manifest_id uuid not null references public.retailer_catalogue_staging_recovery_manifests(id),
  recovery_approval_id uuid references public.retailer_catalogue_staging_recovery_approvals(id),
  recovery_run_id uuid references public.retailer_catalogue_apply_runs(id),
  event text not null,
  archived_rows jsonb not null default '{}'::jsonb,
  validation_evidence jsonb not null default '{}'::jsonb,
  actor text not null,
  created_at timestamptz not null default now()
);

alter table public.retailer_catalogue_database_targets owner to postgres;
alter table public.retailer_catalogue_staging_fixture_approvals owner to postgres;
alter table public.retailer_catalogue_staging_recovery_manifests owner to postgres;
alter table public.retailer_catalogue_staging_recovery_approvals owner to postgres;
alter table public.retailer_catalogue_staging_recovery_audit owner to postgres;
alter table public.retailer_catalogue_database_targets enable row level security;
alter table public.retailer_catalogue_database_targets force row level security;
alter table public.retailer_catalogue_staging_fixture_approvals enable row level security;
alter table public.retailer_catalogue_staging_fixture_approvals force row level security;
alter table public.retailer_catalogue_staging_recovery_manifests enable row level security;
alter table public.retailer_catalogue_staging_recovery_manifests force row level security;
alter table public.retailer_catalogue_staging_recovery_approvals enable row level security;
alter table public.retailer_catalogue_staging_recovery_approvals force row level security;
alter table public.retailer_catalogue_staging_recovery_audit enable row level security;
alter table public.retailer_catalogue_staging_recovery_audit force row level security;
revoke all on table public.retailer_catalogue_database_targets, public.retailer_catalogue_staging_fixture_approvals, public.retailer_catalogue_staging_recovery_manifests, public.retailer_catalogue_staging_recovery_approvals, public.retailer_catalogue_staging_recovery_audit from public,anon,authenticated,service_role,retailer_catalogue_staging_approver,retailer_catalogue_staging_executor;

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
  if v_target.target_environment<>'STAGING'
     or v_target.project_ref<>'hxnrsyyqffztlvcrtgbf'
     or v_target.project_ref='aftboxmrdgyhizicfsfu'
     or v_target.database_identity<>'supplementscout-staging:hxnrsyyqffztlvcrtgbf'
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

create or replace function public.retailer_catalogue_staging_runtime_guard(p_target_environment text,p_project_ref text,p_database_identity text)
returns void language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $runtime_guard$
declare v_identity jsonb;
begin
  if p_target_environment is distinct from 'STAGING' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Target environment is not STAGING'); end if;
  if p_project_ref is distinct from 'hxnrsyyqffztlvcrtgbf' or p_project_ref='aftboxmrdgyhizicfsfu' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Project ref is not the exact staging ref'); end if;
  if p_database_identity is distinct from 'supplementscout-staging:hxnrsyyqffztlvcrtgbf' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Requested database identity is not staging'); end if;
  if current_setting('app.retailer_catalogue_staging_marker',true) is distinct from '1' or current_setting('app.retailer_catalogue_allow',true) is distinct from '1' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Staging-specific session marker is missing'); end if;
  if coalesce(current_setting('app.safe_update',true),'false') not in ('','false','0','off') then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','SAFE_UPDATE must be false or unset'); end if;
  v_identity:=public.retailer_catalogue_actual_database_target();
  if v_identity->>'project_ref' is distinct from p_project_ref or v_identity->>'database_identity' is distinct from p_database_identity then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Request does not match trusted database identity'); end if;
end
$runtime_guard$;

create or replace function public.retailer_catalogue_staging_package_fingerprint(p_package jsonb)
returns text language sql immutable strict set search_path=pg_catalog,public as $package_hash$
  select public.retailer_catalogue_sha256_json(jsonb_set(p_package,'{package_fingerprint}','null'::jsonb,false))
$package_hash$;

create or replace function public.retailer_catalogue_staging_request_fingerprint(p_request jsonb)
returns text language sql immutable strict set search_path=pg_catalog,public as $request_hash$
  select public.retailer_catalogue_sha256_json(jsonb_set(p_request,'{request_fingerprint}','null'::jsonb,false))
$request_hash$;

create or replace function public.retailer_catalogue_staging_approve_fixture_internal(p_approval jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $approve_fixture$
declare v_id uuid; v_package jsonb; v_actual_ledger text;
begin
  if not public.atomic_import_has_exact_keys(p_approval,array['schema_version','package_id','package_fingerprint','target_environment','staging_project_ref','staging_database_identity','fixture_id','fixture_fingerprint','fixture_build_commit','source_snapshot_fingerprint','canonical_snapshot_fingerprint','adapter_fingerprint','policy_fingerprint','code_commit','expected_migration_identifiers','expected_migration_ledger_fingerprint','canonical_decisions','approved_by','expires_at']) then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid staging fixture approval keys'); end if;
  perform public.retailer_catalogue_staging_runtime_guard(p_approval->>'target_environment',p_approval->>'staging_project_ref',p_approval->>'staging_database_identity');
  if p_approval->>'fixture_id'<>'jons-staging-canary-real-10-v1-20260717' or p_approval->>'fixture_fingerprint'<>'2c62a82c169ee20fab8a86c125423aa50b2d9613283907c408726d4ed89981f5' then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Fixture identity rejected'); end if;
  if (p_approval->>'fixture_build_commit')!~'^[0-9a-f]{40}$' or (p_approval->>'code_commit')!~'^[0-9a-f]{40}$' then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Fixture/package commit is invalid'); end if;
  if nullif(trim(p_approval->>'approved_by'),'') is null or p_approval->>'approved_by' in ('service_role','staging-executor') or (p_approval->>'expires_at')::timestamptz<=now() or (p_approval->>'expires_at')::timestamptz>now()+interval '120 minutes' then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Fixture approval operator or expiry rejected'); end if;
  if p_approval#>>'{canonical_decisions,50844992602450}' is distinct from 'APPROVE_SIMPLE_CANONICAL' or p_approval#>>'{canonical_decisions,53951719768402}' is distinct from 'APPROVE_SIMPLE_CANONICAL' or p_approval#>>'{canonical_decisions,51935656018258,product_id}' is distinct from '91' or p_approval#>>'{canonical_decisions,51935656018258,variant_id}' is distinct from '39' then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Canonical decision approval rejected'); end if;
  v_package:=p_approval-array['canonical_decisions','approved_by','expires_at'];
  if p_approval->>'package_fingerprint' is distinct from public.retailer_catalogue_staging_package_fingerprint(v_package) then perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Immutable staging package fingerprint mismatch'); end if;
  v_actual_ledger:=public.retailer_catalogue_assert_migration_ledger(p_approval->'expected_migration_identifiers',p_approval->>'expected_migration_ledger_fingerprint');
  insert into public.retailer_catalogue_staging_fixture_approvals(package_id,package_fingerprint,fixture_id,fixture_fingerprint,fixture_build_commit,project_ref,database_identity,migration_ledger_fingerprint,expected_migration_identifiers,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,canonical_decisions,approved_by,expires_at)
  values((p_approval->>'package_id')::uuid,p_approval->>'package_fingerprint',p_approval->>'fixture_id',p_approval->>'fixture_fingerprint',p_approval->>'fixture_build_commit',p_approval->>'staging_project_ref',p_approval->>'staging_database_identity',v_actual_ledger,p_approval->'expected_migration_identifiers',p_approval->>'source_snapshot_fingerprint',p_approval->>'canonical_snapshot_fingerprint',p_approval->>'adapter_fingerprint',p_approval->>'policy_fingerprint',p_approval->>'code_commit',p_approval->'canonical_decisions',trim(p_approval->>'approved_by'),(p_approval->>'expires_at')::timestamptz) returning id into v_id;
  return jsonb_build_object('fixture_approval_id',v_id,'status','APPROVED','actual_migration_ledger_fingerprint',v_actual_ledger);
end
$approve_fixture$;

create or replace function public.approve_retailer_catalogue_staging_fixture(p_approval jsonb)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $approve_fixture_wrapper$
begin
  if current_user<>'retailer_catalogue_staging_approver' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Staging approver role required'); end if;
  return public.retailer_catalogue_staging_approve_fixture_internal(p_approval);
end
$approve_fixture_wrapper$;

create or replace function public.retailer_catalogue_staging_approve_parent_internal(p_fixture_approval_id uuid,p_parent_plan_id uuid,p_parent_fingerprint text,p_actor text,p_expires_at timestamptz)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $approve_parent$
declare v_fixture public.retailer_catalogue_staging_fixture_approvals%rowtype; v_parent public.retailer_catalogue_parent_plans%rowtype; v_result jsonb;
begin
  select * into v_fixture from public.retailer_catalogue_staging_fixture_approvals where id=p_fixture_approval_id for update;
  if not found or v_fixture.expires_at<=now() then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Fixture approval is missing or expired'); end if;
  if v_fixture.consumed_at is not null then perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Fixture approval is already consumed'); end if;
  perform public.retailer_catalogue_assert_migration_ledger(v_fixture.expected_migration_identifiers,v_fixture.migration_ledger_fingerprint);
  select * into v_parent from public.retailer_catalogue_parent_plans where id=p_parent_plan_id;
  if not found or v_parent.target_environment<>'STAGING' or v_parent.parent_plan_fingerprint is distinct from p_parent_fingerprint or v_parent.source_snapshot_fingerprint is distinct from v_fixture.source_snapshot_fingerprint or v_parent.canonical_snapshot_fingerprint is distinct from v_fixture.canonical_snapshot_fingerprint or v_parent.adapter_fingerprint is distinct from v_fixture.adapter_fingerprint or v_parent.policy_fingerprint is distinct from v_fixture.policy_fingerprint or v_parent.code_commit is distinct from v_fixture.code_commit or v_parent.plan_json->>'fixture_fingerprint' is distinct from v_fixture.fixture_fingerprint or v_parent.plan_json->>'package_fingerprint' is distinct from v_fixture.package_fingerprint then perform public.retailer_catalogue_raise('RSBI_PARENT_FINGERPRINT_MISMATCH','Fixture/package approval is not bound to parent'); end if;
  v_result:=public.approve_retailer_catalogue_parent_plan(p_parent_plan_id,p_parent_fingerprint,p_actor,least(p_expires_at,v_fixture.expires_at));
  update public.retailer_catalogue_staging_fixture_approvals set consumed_at=now(),parent_plan_id=p_parent_plan_id where id=v_fixture.id;
  return v_result||jsonb_build_object('fixture_approval_id',v_fixture.id,'package_fingerprint',v_fixture.package_fingerprint);
end
$approve_parent$;

create or replace function public.approve_retailer_catalogue_staging_parent(p_fixture_approval_id uuid,p_parent_plan_id uuid,p_parent_fingerprint text,p_actor text,p_expires_at timestamptz)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $approve_parent_wrapper$
begin
  if current_user<>'retailer_catalogue_staging_approver' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Staging approver role required'); end if;
  return public.retailer_catalogue_staging_approve_parent_internal(p_fixture_approval_id,p_parent_plan_id,p_parent_fingerprint,p_actor,p_expires_at);
end
$approve_parent_wrapper$;

create or replace function public.retailer_catalogue_execute_staging_child_internal(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $execute$
declare v_child public.retailer_catalogue_child_plans%rowtype; v_parent public.retailer_catalogue_parent_plans%rowtype; v_fixture public.retailer_catalogue_staging_fixture_approvals%rowtype; v_run jsonb; v_run_id uuid; v_row jsonb; v_plan jsonb; v_approval jsonb; v_result jsonb; v_results jsonb:='[]'; v_approvals jsonb:='[]'; v_before jsonb; v_after jsonb; v_actual jsonb; v_manifest uuid; v_products jsonb:='[]'; v_variants jsonb:='[]'; v_mappings jsonb:='[]'; v_offers jsonb:='[]'; v_histories jsonb:='[]'; v_history bigint; v_completed jsonb; v_error text; v_code text; v_request_fingerprint text; v_execution_fingerprint text; v_rollback_fingerprint text; v_other text; v_shared text; v_orphans jsonb; v_owned text;
begin
  if not public.atomic_import_has_exact_keys(p_request,array['schema_version','target_environment','staging_project_ref','staging_database_identity','package_id','package_fingerprint','parent_plan_id','child_plan_id','fixture_id','fixture_fingerprint','fixture_approval_id','parent_plan_fingerprint','child_plan_fingerprint','source_snapshot_fingerprint','canonical_snapshot_fingerprint','migration_ledger_fingerprint','adapter_fingerprint','policy_fingerprint','code_commit','expected_deltas','row_plans','approval_expiry','requested_at','explicit_allow','request_fingerprint']) then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid staging request keys'); end if;
  v_request_fingerprint:=public.retailer_catalogue_staging_request_fingerprint(p_request);
  if p_request->>'request_fingerprint' is distinct from v_request_fingerprint then perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Request fingerprint mismatch'); end if;
  perform public.retailer_catalogue_staging_runtime_guard(p_request->>'target_environment',p_request->>'staging_project_ref',p_request->>'staging_database_identity');
  if coalesce((p_request->>'explicit_allow')::boolean,false)=false then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Explicit staging allow flag is missing'); end if;
  select * into v_child from public.retailer_catalogue_child_plans where id=(p_request->>'child_plan_id')::uuid;
  if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Child not found'); end if;
  select * into v_parent from public.retailer_catalogue_parent_plans where id=v_child.parent_plan_id;
  select * into v_fixture from public.retailer_catalogue_staging_fixture_approvals where id=(p_request->>'fixture_approval_id')::uuid;
  if not found or v_fixture.parent_plan_id is distinct from v_parent.id or v_fixture.consumed_at is null then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Fixture approval is not bound to parent'); end if;
  if v_fixture.expires_at<=now() or v_child.approval_expires_at<=now() then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Staging approval expired'); end if;
  if v_child.status='APPLIED' or v_child.approval_consumed_at is not null then perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Staging child approval was already consumed'); end if;
  if v_child.status<>'APPROVED' then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Staging child is not approved'); end if;
  if v_fixture.package_id::text is distinct from p_request->>'package_id' or v_fixture.package_fingerprint is distinct from p_request->>'package_fingerprint' then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Package binding mismatch'); end if;
  if v_fixture.fixture_id is distinct from p_request->>'fixture_id' or v_fixture.fixture_fingerprint is distinct from p_request->>'fixture_fingerprint' then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Fixture fingerprint mismatch'); end if;
  if v_fixture.migration_ledger_fingerprint is distinct from p_request->>'migration_ledger_fingerprint' then perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Migration ledger fingerprint mismatch'); end if;
  perform public.retailer_catalogue_assert_migration_ledger(v_fixture.expected_migration_identifiers,v_fixture.migration_ledger_fingerprint);
  if v_child.source_snapshot_fingerprint is distinct from p_request->>'source_snapshot_fingerprint' or v_fixture.source_snapshot_fingerprint is distinct from p_request->>'source_snapshot_fingerprint' then perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Source snapshot fingerprint mismatch'); end if;
  if v_child.canonical_snapshot_fingerprint is distinct from p_request->>'canonical_snapshot_fingerprint' or v_fixture.canonical_snapshot_fingerprint is distinct from p_request->>'canonical_snapshot_fingerprint' then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Canonical snapshot fingerprint mismatch'); end if;
  if v_child.adapter_fingerprint is distinct from p_request->>'adapter_fingerprint' or v_fixture.adapter_fingerprint is distinct from p_request->>'adapter_fingerprint' then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Adapter fingerprint mismatch'); end if;
  if v_child.policy_fingerprint is distinct from p_request->>'policy_fingerprint' or v_fixture.policy_fingerprint is distinct from p_request->>'policy_fingerprint' then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Policy fingerprint mismatch'); end if;
  if v_child.code_commit is distinct from p_request->>'code_commit' or v_fixture.code_commit is distinct from p_request->>'code_commit' then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Code commit mismatch'); end if;
  if v_parent.parent_plan_fingerprint is distinct from p_request->>'parent_plan_fingerprint' or v_child.child_plan_fingerprint is distinct from p_request->>'child_plan_fingerprint' or v_child.expected_deltas is distinct from p_request->'expected_deltas' or jsonb_array_length(p_request->'row_plans')<>jsonb_array_length(v_child.record_ids) or (p_request->>'approval_expiry')::timestamptz>v_child.approval_expires_at then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Request is not bound to approved staging child'); end if;
  for v_row in select value from jsonb_array_elements(p_request->'row_plans') loop
    if not public.atomic_import_has_exact_keys(v_row,array['phase1_row_plan','atomic_plan','row_plan_fingerprint','artifact_sha256']) or v_row#>>'{row_plan_fingerprint}' is distinct from v_row#>>'{phase1_row_plan,fingerprints,row_plan}' then perform public.retailer_catalogue_raise('RSBI_ROW_PLAN_FINGERPRINT_MISMATCH','Row binding mismatch'); end if;
    if v_row#>>'{phase1_row_plan,source_record_id}'='51935656018258' and (v_row#>>'{atomic_plan,product,id}' is distinct from '91' or v_row#>>'{atomic_plan,product_variant,id}' is distinct from '39') then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Project AD must reuse product 91 and variant 39'); end if;
    if v_row#>>'{atomic_plan,product,action}'='create' and v_row#>>'{phase1_row_plan,source_record_id}' not in ('50844992602450','53951719768402') then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Canonical creation is outside the approved fixture'); end if;
    if v_row#>>'{atomic_plan,product,action}'='create' and (v_row#>>'{atomic_plan,product_variant,action}' is distinct from 'create_default' or v_row#>>'{atomic_plan,product_variant,evidence,flavour}' is not null or coalesce((v_row#>>'{atomic_plan,product_variant,evidence,pack_count}')::integer,1)<>1) then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Only approved simple default canonical products are allowed'); end if;
    perform public.validate_product_import_plan_read_only(v_row->'atomic_plan');
  end loop;
  v_orphans:=public.retailer_catalogue_orphan_counts();
  if exists(select 1 from jsonb_each_text(v_orphans) where value::bigint<>0) then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Pre-apply orphan state is not clean',v_orphans); end if;
  v_run:=public.begin_retailer_catalogue_child_apply(v_child.id,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_child.source_snapshot_fingerprint,v_child.canonical_snapshot_fingerprint,v_child.adapter_fingerprint,v_child.policy_fingerprint,v_child.code_commit,v_child.expected_state_fingerprint,'staging-executor');
  if v_run->>'code'='RSBI_REPLAY_BLOCKED' then return v_run||jsonb_build_object('request_fingerprint',v_request_fingerprint,'replay_status','BLOCKED'); end if;
  v_run_id:=(v_run->>'run_id')::uuid;
  begin
    v_before:=public.retailer_catalogue_business_counts(); v_other:=public.retailer_catalogue_other_retailer_fingerprint(v_child.retailer_id); v_shared:=public.retailer_catalogue_protected_shared_fingerprint();
    for v_row in select value from jsonb_array_elements(p_request->'row_plans') order by value#>>'{phase1_row_plan,source_record_id}' loop
      v_plan:=v_row->'atomic_plan';
      v_approval:=public.approve_product_import_plan(v_plan,v_row->>'artifact_sha256','stg-'||replace(v_run_id::text,'-','')||'-'||left(v_row->>'row_plan_fingerprint',12),'staging_child',least(v_child.approval_expires_at,now()+interval '15 minutes'));
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
    v_completed:=public.complete_retailer_catalogue_child_apply(v_run_id,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_after,jsonb_build_object('row_results',v_results,'approval_ids',v_approvals,'actual_deltas',v_actual,'execution_fingerprint',v_execution_fingerprint),'staging-executor');
    insert into public.retailer_catalogue_staging_recovery_manifests(package_id,package_fingerprint,child_plan_id,apply_run_id,dependency_group,execution_fingerprint,rollback_manifest_fingerprint,created_product_ids,created_variant_ids,created_mapping_ids,created_offer_ids,created_price_history_ids,updated_before_state,ownership,reverse_dependency_order,before_counts,other_retailer_fingerprint,protected_shared_fingerprint,orphan_counts,applied_owned_state_fingerprint)
    values(v_fixture.package_id,v_fixture.package_fingerprint,v_child.id,v_run_id,v_child.dependency_group,v_execution_fingerprint,v_rollback_fingerprint,v_products,v_variants,v_mappings,v_offers,v_histories,'[]',jsonb_build_object('plan_owned_only',true,'retailer_id',v_child.retailer_id,'protected_shared_product_id',case when v_child.dependency_group='DG3_PROJECT_AD_OFFER' then 91 else null end,'protected_shared_variant_id',case when v_child.dependency_group='DG3_PROJECT_AD_OFFER' then 39 else null end),jsonb_build_array('price_history','offers','retailer_products','product_variants','products'),v_before,v_other,v_shared,v_orphans,v_owned) returning id into v_manifest;
    return jsonb_build_object('request_fingerprint',v_request_fingerprint,'approval_ids',v_approvals,'row_results',v_results,'before_counts',v_before,'after_counts',v_after,'exact_deltas',v_actual,'expected_delta_comparison',true,'child_status','APPLIED','parent_status',v_completed->>'parent_status','replay_status','NOT_REPLAY','rollback_metadata',jsonb_build_object('manifest_id',v_manifest,'manifest_fingerprint',v_rollback_fingerprint,'status','READY'),'error_code',null,'execution_fingerprint',v_execution_fingerprint);
  exception when others then
    get stacked diagnostics v_error=message_text; v_code:=coalesce(substring(v_error from 'RSBI_[A-Z_]+'),'RSBI_ATOMIC_APPLY_FAILED');
    v_completed:=public.fail_retailer_catalogue_child_apply(v_run_id,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_code,jsonb_build_object('transaction_rolled_back',true,'message',v_error),'staging-executor');
    return jsonb_build_object('request_fingerprint',v_request_fingerprint,'approval_ids','[]'::jsonb,'row_results','[]'::jsonb,'before_counts',v_before,'after_counts',v_before,'exact_deltas',jsonb_build_object('retailers',0,'products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0),'expected_delta_comparison',false,'child_status','FAILED','parent_status',v_completed->>'parent_status','replay_status','NOT_REPLAY','rollback_metadata',jsonb_build_object('status','TRANSACTION_ROLLED_BACK'),'error_code',v_code,'execution_fingerprint',null);
  end;
end
$execute$;

create or replace function public.execute_staging_retailer_catalogue_child(p_request jsonb)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $execute_wrapper$
begin
  if current_user<>'retailer_catalogue_staging_executor' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Staging executor role required'); end if;
  return public.retailer_catalogue_execute_staging_child_internal(p_request);
end
$execute_wrapper$;

create or replace function public.retailer_catalogue_expected_recovery_state(p_manifest_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $expected_recovery$
declare v_manifest public.retailer_catalogue_staging_recovery_manifests%rowtype; v_child public.retailer_catalogue_child_plans%rowtype; v_parent_status text;
begin
  select * into v_manifest from public.retailer_catalogue_staging_recovery_manifests where id=p_manifest_id;
  if not found then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Recovery manifest not found'); end if;
  select * into v_child from public.retailer_catalogue_child_plans where id=v_manifest.child_plan_id;
  if exists(select 1 from public.retailer_catalogue_child_plans where parent_plan_id=v_child.parent_plan_id and id<>v_child.id and status<>'ROLLED_BACK') then select status into v_parent_status from public.retailer_catalogue_parent_plans where id=v_child.parent_plan_id; else v_parent_status:='ROLLED_BACK'; end if;
  return jsonb_build_object('business_counts',v_manifest.before_counts,'child_status','ROLLED_BACK','original_apply_status','SUCCEEDED','recovery_run_status','ROLLED_BACK','recovery_approval_consumed',true,'parent_status',v_parent_status,'manifest_status','RECOVERED','ownership_markers',v_manifest.ownership,'other_retailer_fingerprint',v_manifest.other_retailer_fingerprint,'protected_shared_fingerprint',v_manifest.protected_shared_fingerprint,'orphan_counts',v_manifest.orphan_counts,'created_records_remaining',jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0));
end
$expected_recovery$;

create or replace function public.retailer_catalogue_staging_approve_recovery_internal(p_approval jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $approve_recovery$
declare v_manifest public.retailer_catalogue_staging_recovery_manifests%rowtype; v_child public.retailer_catalogue_child_plans%rowtype; v_expected jsonb; v_expected_fp text; v_id uuid;
begin
  if not public.atomic_import_has_exact_keys(p_approval,array['schema_version','target_environment','staging_project_ref','staging_database_identity','package_id','package_fingerprint','child_plan_id','execution_fingerprint','rollback_manifest_fingerprint','expected_recovery_state_fingerprint','approved_by','expires_at']) then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid recovery approval keys'); end if;
  perform public.retailer_catalogue_staging_runtime_guard(p_approval->>'target_environment',p_approval->>'staging_project_ref',p_approval->>'staging_database_identity');
  if nullif(trim(p_approval->>'approved_by'),'') is null or p_approval->>'approved_by' in ('service_role','staging-executor') or (p_approval->>'expires_at')::timestamptz<=now() or (p_approval->>'expires_at')::timestamptz>now()+interval '30 minutes' then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Recovery approval operator or expiry rejected'); end if;
  select * into v_manifest from public.retailer_catalogue_staging_recovery_manifests where child_plan_id=(p_approval->>'child_plan_id')::uuid for update;
  if not found or v_manifest.status<>'READY' or v_manifest.package_id::text is distinct from p_approval->>'package_id' or v_manifest.package_fingerprint is distinct from p_approval->>'package_fingerprint' or v_manifest.execution_fingerprint is distinct from p_approval->>'execution_fingerprint' or v_manifest.rollback_manifest_fingerprint is distinct from p_approval->>'rollback_manifest_fingerprint' then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Recovery manifest binding rejected'); end if;
  select * into v_child from public.retailer_catalogue_child_plans where id=v_manifest.child_plan_id;
  if v_child.status<>'APPLIED' then perform public.retailer_catalogue_raise('RSBI_PARTIAL_BATCH_STATE','Child is not in exact committed state'); end if;
  v_expected:=public.retailer_catalogue_expected_recovery_state(v_manifest.id); v_expected_fp:=public.retailer_catalogue_sha256_json(v_expected);
  if v_expected_fp is distinct from p_approval->>'expected_recovery_state_fingerprint' then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Expected recovery state fingerprint mismatch'); end if;
  update public.retailer_catalogue_staging_recovery_approvals set consumed_at=now() where recovery_manifest_id=v_manifest.id and consumed_at is null and expires_at<=now();
  if exists(select 1 from public.retailer_catalogue_staging_recovery_approvals where recovery_manifest_id=v_manifest.id and consumed_at is null) then perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','An unexpired recovery approval already exists'); end if;
  insert into public.retailer_catalogue_staging_recovery_approvals(recovery_manifest_id,package_id,package_fingerprint,project_ref,database_identity,child_plan_id,execution_fingerprint,rollback_manifest_fingerprint,expected_recovery_state,expected_recovery_state_fingerprint,approved_by,expires_at)
  values(v_manifest.id,v_manifest.package_id,v_manifest.package_fingerprint,p_approval->>'staging_project_ref',p_approval->>'staging_database_identity',v_child.id,v_manifest.execution_fingerprint,v_manifest.rollback_manifest_fingerprint,v_expected,v_expected_fp,trim(p_approval->>'approved_by'),(p_approval->>'expires_at')::timestamptz) returning id into v_id;
  return jsonb_build_object('recovery_approval_id',v_id,'status','APPROVED','expected_recovery_state_fingerprint',v_expected_fp);
end
$approve_recovery$;

create or replace function public.approve_retailer_catalogue_staging_recovery(p_approval jsonb)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $approve_recovery_wrapper$
begin
  if current_user<>'retailer_catalogue_staging_approver' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Staging approver role required'); end if;
  return public.retailer_catalogue_staging_approve_recovery_internal(p_approval);
end
$approve_recovery_wrapper$;

create or replace function public.retailer_catalogue_recover_staging_child_internal(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $recover$
declare v_manifest public.retailer_catalogue_staging_recovery_manifests%rowtype; v_approval public.retailer_catalogue_staging_recovery_approvals%rowtype; v_child public.retailer_catalogue_child_plans%rowtype; v_parent public.retailer_catalogue_parent_plans%rowtype; v_apply public.retailer_catalogue_apply_runs%rowtype; v_run_id uuid; v_attempt integer; v_archived jsonb; v_actual jsonb; v_parent_status text; v_request_fp text; v_error text; v_code text; v_owned text; v_evidence jsonb;
begin
  if not public.atomic_import_has_exact_keys(p_request,array['schema_version','target_environment','staging_project_ref','staging_database_identity','package_id','package_fingerprint','child_plan_id','parent_plan_fingerprint','child_plan_fingerprint','recovery_approval_id','execution_fingerprint','rollback_manifest_fingerprint','requested_at','explicit_allow','request_fingerprint']) then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid recovery request keys'); end if;
  v_request_fp:=public.retailer_catalogue_staging_request_fingerprint(p_request);
  if p_request->>'request_fingerprint' is distinct from v_request_fp then perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Recovery request fingerprint mismatch'); end if;
  perform public.retailer_catalogue_staging_runtime_guard(p_request->>'target_environment',p_request->>'staging_project_ref',p_request->>'staging_database_identity');
  if coalesce((p_request->>'explicit_allow')::boolean,false)=false then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Explicit recovery allow flag is missing'); end if;
  select * into v_approval from public.retailer_catalogue_staging_recovery_approvals where id=(p_request->>'recovery_approval_id')::uuid for update;
  if not found then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Recovery approval not found'); end if;
  if v_approval.consumed_at is not null then perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Recovery approval already consumed'); end if;
  if v_approval.expires_at<=now() then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Recovery approval expired'); end if;
  select * into v_manifest from public.retailer_catalogue_staging_recovery_manifests where id=v_approval.recovery_manifest_id for update;
  select * into v_child from public.retailer_catalogue_child_plans where id=v_manifest.child_plan_id; select * into v_parent from public.retailer_catalogue_parent_plans where id=v_child.parent_plan_id; select * into v_apply from public.retailer_catalogue_apply_runs where id=v_manifest.apply_run_id;
  if v_approval.child_plan_id::text is distinct from p_request->>'child_plan_id' or v_manifest.child_plan_id::text is distinct from p_request->>'child_plan_id' or v_approval.package_id::text is distinct from p_request->>'package_id' or v_approval.package_fingerprint is distinct from p_request->>'package_fingerprint' or v_approval.execution_fingerprint is distinct from p_request->>'execution_fingerprint' or v_approval.rollback_manifest_fingerprint is distinct from p_request->>'rollback_manifest_fingerprint' or v_child.child_plan_fingerprint is distinct from p_request->>'child_plan_fingerprint' or v_parent.parent_plan_fingerprint is distinct from p_request->>'parent_plan_fingerprint' then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Recovery request approval binding mismatch'); end if;
  if v_manifest.status<>'READY' or v_child.status<>'APPLIED' or v_apply.status<>'SUCCEEDED' or jsonb_array_length(v_manifest.updated_before_state)<>0 then perform public.retailer_catalogue_raise('RSBI_PARTIAL_BATCH_STATE','Committed child is not in exact recoverable state'); end if;
  v_owned:=public.retailer_catalogue_owned_state_fingerprint(v_manifest.created_product_ids,v_manifest.created_variant_ids,v_manifest.created_mapping_ids,v_manifest.created_offer_ids,v_manifest.created_price_history_ids);
  if v_owned is distinct from v_manifest.applied_owned_state_fingerprint then perform public.retailer_catalogue_raise('RSBI_PARTIAL_BATCH_STATE','Owned rows were partially removed or manually modified'); end if;
  if public.retailer_catalogue_other_retailer_fingerprint(v_child.retailer_id) is distinct from v_manifest.other_retailer_fingerprint or exists(select 1 from public.retailer_products rp where rp.retailer_id<>v_child.retailer_id and (rp.product_id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_product_ids)) or rp.product_variant_id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_variant_ids)))) or exists(select 1 from public.offers o where o.retailer_id<>v_child.retailer_id and (o.product_id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_product_ids)) or o.product_variant_id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_variant_ids)))) then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Cross-retailer ownership conflict detected'); end if;
  if public.retailer_catalogue_protected_shared_fingerprint() is distinct from v_manifest.protected_shared_fingerprint then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Protected shared Project AD records changed'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_child.id::text,0));
  update public.retailer_catalogue_staging_recovery_approvals set consumed_at=now() where id=v_approval.id;
  select coalesce(max(attempt_ordinal),0)+1 into v_attempt from public.retailer_catalogue_apply_runs where child_plan_id=v_child.id and run_type='ROLLBACK';
  insert into public.retailer_catalogue_apply_runs(parent_plan_id,child_plan_id,retailer_id,target_environment,run_type,attempt_ordinal,status,parent_plan_fingerprint,child_plan_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,approval_id,approval_expires_at,rollback_fingerprint,rollback_manifest,expected_deltas,started_by)
  values(v_parent.id,v_child.id,v_child.retailer_id,'STAGING','ROLLBACK',v_attempt,'STARTED',v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_child.source_snapshot_fingerprint,v_child.canonical_snapshot_fingerprint,v_child.adapter_fingerprint,v_child.policy_fingerprint,v_child.code_commit,v_child.expected_state_fingerprint,v_approval.id,v_approval.expires_at,v_manifest.rollback_manifest_fingerprint,v_child.rollback_manifest,v_child.expected_deltas,v_approval.approved_by) returning id into v_run_id;
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
    update public.retailer_catalogue_staging_recovery_manifests set status='RECOVERED',recovered_at=now() where id=v_manifest.id;
    update public.retailer_catalogue_apply_runs set status='ROLLED_BACK',result_metadata=jsonb_build_object('manifest_id',v_manifest.id,'recovery_approval_id',v_approval.id),completed_at=now() where id=v_run_id;
    update public.retailer_catalogue_child_plans set status='ROLLED_BACK',rollback_requested_at=now(),rollback_requested_by=v_approval.approved_by,audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','STAGING_COMMITTED_RECOVERY','run_id',v_run_id,'approval_id',v_approval.id,'at',now())) where id=v_child.id;
    if not exists(select 1 from public.retailer_catalogue_child_plans where parent_plan_id=v_parent.id and status<>'ROLLED_BACK') then update public.retailer_catalogue_parent_plans set status='ROLLED_BACK' where id=v_parent.id; v_parent_status:='ROLLED_BACK'; else select status into v_parent_status from public.retailer_catalogue_parent_plans where id=v_parent.id; end if;
    v_actual:=jsonb_build_object('business_counts',public.retailer_catalogue_business_counts(),'child_status',(select status from public.retailer_catalogue_child_plans where id=v_child.id),'original_apply_status',(select status from public.retailer_catalogue_apply_runs where id=v_manifest.apply_run_id),'recovery_run_status',(select status from public.retailer_catalogue_apply_runs where id=v_run_id),'recovery_approval_consumed',(select consumed_at is not null from public.retailer_catalogue_staging_recovery_approvals where id=v_approval.id),'parent_status',v_parent_status,'manifest_status',(select status from public.retailer_catalogue_staging_recovery_manifests where id=v_manifest.id),'ownership_markers',v_manifest.ownership,'other_retailer_fingerprint',public.retailer_catalogue_other_retailer_fingerprint(v_child.retailer_id),'protected_shared_fingerprint',public.retailer_catalogue_protected_shared_fingerprint(),'orphan_counts',public.retailer_catalogue_orphan_counts(),'created_records_remaining',jsonb_build_object('products',(select count(*) from public.products where id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_product_ids))),'product_variants',(select count(*) from public.product_variants where id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_variant_ids))),'retailer_products',(select count(*) from public.retailer_products where id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_mapping_ids))),'offers',(select count(*) from public.offers where id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_offer_ids))),'price_history',(select count(*) from public.price_history where id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_price_history_ids)))));
    if v_actual is distinct from v_approval.expected_recovery_state then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Exact post-recovery validation mismatch',jsonb_build_object('expected',v_approval.expected_recovery_state,'actual',v_actual)); end if;
    insert into public.retailer_catalogue_staging_recovery_audit(recovery_manifest_id,recovery_approval_id,recovery_run_id,event,archived_rows,validation_evidence,actor) values(v_manifest.id,v_approval.id,v_run_id,'COMMITTED_CHILD_RECOVERED',v_archived,jsonb_build_object('expected',v_approval.expected_recovery_state,'actual',v_actual,'match',true),v_approval.approved_by);
    return jsonb_build_object('child_plan_id',v_child.id,'recovery_status','RECOVERED','parent_status',v_parent_status,'protected_shared_product_id',v_manifest.ownership->'protected_shared_product_id','protected_shared_variant_id',v_manifest.ownership->'protected_shared_variant_id','audit_preserved',true,'exact_post_recovery_validation',true);
  exception when others then
    get stacked diagnostics v_error=message_text; v_code:=coalesce(substring(v_error from 'RSBI_[A-Z_]+'),'RSBI_EXPECTED_STATE_MISMATCH');
    v_evidence:=jsonb_build_object('error_code',v_code,'message',v_error,'expected',v_approval.expected_recovery_state,'observed_before_rollback',v_actual,'bounded_recovery_transaction_rolled_back',true);
    update public.retailer_catalogue_apply_runs set status='FAILED',error_code=v_code,result_metadata=v_evidence,completed_at=now() where id=v_run_id;
    update public.retailer_catalogue_staging_recovery_manifests set status='FAILED',failure_evidence=v_evidence where id=v_manifest.id;
    insert into public.retailer_catalogue_staging_recovery_audit(recovery_manifest_id,recovery_approval_id,recovery_run_id,event,archived_rows,validation_evidence,actor) values(v_manifest.id,v_approval.id,v_run_id,'COMMITTED_CHILD_RECOVERY_FAILED',coalesce(v_archived,'{}'::jsonb),v_evidence,v_approval.approved_by);
    return jsonb_build_object('child_plan_id',v_child.id,'recovery_status','FAILED','error_code',v_code,'audit_preserved',true,'exact_post_recovery_validation',false,'transaction_rolled_back',true);
  end;
end
$recover$;

create or replace function public.recover_staging_retailer_catalogue_child(p_request jsonb)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $recover_wrapper$
begin
  if current_user<>'retailer_catalogue_staging_executor' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Staging executor role required'); end if;
  return public.retailer_catalogue_recover_staging_child_internal(p_request);
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
alter function public.retailer_catalogue_staging_runtime_guard(text,text,text) owner to postgres;
alter function public.retailer_catalogue_staging_package_fingerprint(jsonb) owner to postgres;
alter function public.retailer_catalogue_staging_request_fingerprint(jsonb) owner to postgres;
alter function public.retailer_catalogue_staging_approve_fixture_internal(jsonb) owner to postgres;
alter function public.approve_retailer_catalogue_staging_fixture(jsonb) owner to postgres;
alter function public.retailer_catalogue_staging_approve_parent_internal(uuid,uuid,text,text,timestamptz) owner to postgres;
alter function public.approve_retailer_catalogue_staging_parent(uuid,uuid,text,text,timestamptz) owner to postgres;
alter function public.retailer_catalogue_execute_staging_child_internal(jsonb) owner to postgres;
alter function public.execute_staging_retailer_catalogue_child(jsonb) owner to postgres;
alter function public.retailer_catalogue_expected_recovery_state(uuid) owner to postgres;
alter function public.retailer_catalogue_staging_approve_recovery_internal(jsonb) owner to postgres;
alter function public.approve_retailer_catalogue_staging_recovery(jsonb) owner to postgres;
alter function public.retailer_catalogue_recover_staging_child_internal(jsonb) owner to postgres;
alter function public.recover_staging_retailer_catalogue_child(jsonb) owner to postgres;

revoke all on function public.retailer_catalogue_sha256_json(jsonb),public.retailer_catalogue_actual_database_target(),public.retailer_catalogue_actual_migration_ledger(),public.retailer_catalogue_actual_migration_ledger_fingerprint(),public.retailer_catalogue_assert_migration_ledger(jsonb,text),public.retailer_catalogue_business_counts(),public.retailer_catalogue_orphan_counts(),public.retailer_catalogue_other_retailer_fingerprint(bigint),public.retailer_catalogue_protected_shared_fingerprint(),public.retailer_catalogue_owned_state_fingerprint(jsonb,jsonb,jsonb,jsonb,jsonb),public.retailer_catalogue_staging_runtime_guard(text,text,text),public.retailer_catalogue_staging_package_fingerprint(jsonb),public.retailer_catalogue_staging_request_fingerprint(jsonb),public.retailer_catalogue_staging_approve_fixture_internal(jsonb),public.retailer_catalogue_staging_approve_parent_internal(uuid,uuid,text,text,timestamptz),public.retailer_catalogue_execute_staging_child_internal(jsonb),public.retailer_catalogue_expected_recovery_state(uuid),public.retailer_catalogue_staging_approve_recovery_internal(jsonb),public.retailer_catalogue_recover_staging_child_internal(jsonb) from public,anon,authenticated,service_role,retailer_catalogue_staging_approver,retailer_catalogue_staging_executor;
revoke all on function public.approve_retailer_catalogue_staging_fixture(jsonb),public.approve_retailer_catalogue_staging_parent(uuid,uuid,text,text,timestamptz),public.execute_staging_retailer_catalogue_child(jsonb),public.approve_retailer_catalogue_staging_recovery(jsonb),public.recover_staging_retailer_catalogue_child(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.approve_retailer_catalogue_staging_fixture(jsonb),public.approve_retailer_catalogue_staging_parent(uuid,uuid,text,text,timestamptz),public.approve_retailer_catalogue_staging_recovery(jsonb) to retailer_catalogue_staging_approver;
grant execute on function public.execute_staging_retailer_catalogue_child(jsonb),public.recover_staging_retailer_catalogue_child(jsonb) to retailer_catalogue_staging_executor;
revoke execute on function public.apply_product_import_plan(jsonb),public.approve_product_import_plan(jsonb,text,text,text,timestamptz),public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) from retailer_catalogue_staging_approver,retailer_catalogue_staging_executor;

commit;
