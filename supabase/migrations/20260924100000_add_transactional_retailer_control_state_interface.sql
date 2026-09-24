begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare
  v_required text[] := array[
    'public.retailer_catalogue_parent_plans',
    'public.retailer_catalogue_child_plans',
    'public.retailer_catalogue_apply_runs',
    'public.retailer_offer_sync_batch_approvals',
    'public.approved_import_plans',
    'public.retailer_catalogue_production_fixture_approvals',
    'public.retailer_catalogue_production_recovery_manifests',
    'public.retailer_catalogue_production_recovery_approvals',
    'public.retailer_offer_sync_reviewed_mixed_change_bindings'
  ];
  v_name text;
begin
  foreach v_name in array v_required loop
    if to_regclass(v_name) is null then
      raise exception 'RCSE_SOURCE_UNAVAILABLE: required source % is missing', v_name;
    end if;
  end loop;
  select required.table_name||'.'||required.column_name into v_name
  from (values
    ('retailer_catalogue_parent_plans','id'),('retailer_catalogue_parent_plans','parent_plan_fingerprint'),
    ('retailer_catalogue_parent_plans','retailer_id'),('retailer_catalogue_parent_plans','source_snapshot_fingerprint'),
    ('retailer_catalogue_parent_plans','status'),('retailer_catalogue_parent_plans','approval_id'),
    ('retailer_catalogue_parent_plans','approved_at'),('retailer_catalogue_parent_plans','approval_expires_at'),
    ('retailer_catalogue_parent_plans','approval_consumed_at'),('retailer_catalogue_parent_plans','created_at'),
    ('retailer_catalogue_parent_plans','updated_at'),('retailer_catalogue_parent_plans','audit_log'),
    ('retailer_catalogue_child_plans','id'),('retailer_catalogue_child_plans','parent_plan_id'),
    ('retailer_catalogue_child_plans','retailer_id'),('retailer_catalogue_child_plans','child_plan_fingerprint'),
    ('retailer_catalogue_child_plans','dependency_group'),('retailer_catalogue_child_plans','batch_index'),
    ('retailer_catalogue_child_plans','status'),('retailer_catalogue_child_plans','approval_id'),
    ('retailer_catalogue_child_plans','approved_at'),('retailer_catalogue_child_plans','approval_expires_at'),
    ('retailer_catalogue_child_plans','approval_consumed_at'),('retailer_catalogue_child_plans','created_at'),
    ('retailer_catalogue_child_plans','updated_at'),('retailer_catalogue_child_plans','audit_log'),
    ('retailer_catalogue_apply_runs','id'),('retailer_catalogue_apply_runs','parent_plan_id'),
    ('retailer_catalogue_apply_runs','child_plan_id'),('retailer_catalogue_apply_runs','retailer_id'),
    ('retailer_catalogue_apply_runs','run_type'),('retailer_catalogue_apply_runs','status'),
    ('retailer_catalogue_apply_runs','expected_state_fingerprint'),('retailer_catalogue_apply_runs','started_at'),
    ('retailer_catalogue_apply_runs','completed_at'),
    ('retailer_offer_sync_batch_approvals','id'),('retailer_offer_sync_batch_approvals','child_plan_id'),
    ('retailer_offer_sync_batch_approvals','approved_at'),('retailer_offer_sync_batch_approvals','expires_at'),
    ('retailer_offer_sync_batch_approvals','consumed_at'),('retailer_offer_sync_batch_approvals','execution_fingerprint'),
    ('approved_import_plans','id'),('approved_import_plans','retailer_id'),
    ('approved_import_plans','created_at'),('approved_import_plans','expires_at'),
    ('approved_import_plans','consumed_at'),('approved_import_plans','status'),('approved_import_plans','artifact_sha256'),
    ('retailer_catalogue_production_fixture_approvals','id'),('retailer_catalogue_production_fixture_approvals','parent_plan_id'),
    ('retailer_catalogue_production_fixture_approvals','approved_at'),('retailer_catalogue_production_fixture_approvals','expires_at'),
    ('retailer_catalogue_production_fixture_approvals','consumed_at'),('retailer_catalogue_production_fixture_approvals','package_fingerprint'),
    ('retailer_catalogue_production_recovery_manifests','id'),('retailer_catalogue_production_recovery_manifests','child_plan_id'),
    ('retailer_catalogue_production_recovery_manifests','apply_run_id'),('retailer_catalogue_production_recovery_manifests','execution_fingerprint'),
    ('retailer_catalogue_production_recovery_manifests','rollback_manifest_fingerprint'),('retailer_catalogue_production_recovery_manifests','status'),
    ('retailer_catalogue_production_recovery_manifests','recovered_at'),('retailer_catalogue_production_recovery_manifests','created_at'),
    ('retailer_catalogue_production_recovery_approvals','id'),('retailer_catalogue_production_recovery_approvals','recovery_manifest_id'),
    ('retailer_catalogue_production_recovery_approvals','approved_at'),('retailer_catalogue_production_recovery_approvals','expires_at'),
    ('retailer_catalogue_production_recovery_approvals','consumed_at'),('retailer_catalogue_production_recovery_approvals','expected_recovery_state_fingerprint'),
    ('retailer_offer_sync_reviewed_mixed_change_bindings','approval_id'),('retailer_offer_sync_reviewed_mixed_change_bindings','status'),
    ('retailer_offer_sync_reviewed_mixed_change_bindings','approved_at'),('retailer_offer_sync_reviewed_mixed_change_bindings','consumed_at'),
    ('retailer_offer_sync_reviewed_mixed_change_bindings','reviewed_contract_hash')
  ) required(table_name,column_name)
  left join information_schema.columns actual
    on actual.table_schema='public' and actual.table_name=required.table_name
   and actual.column_name=required.column_name
  where actual.column_name is null
  order by required.table_name,required.column_name
  limit 1;
  if found then
    raise exception 'RCSE_SCHEMA_DRIFT: required source column public.% is missing',v_name;
  end if;
  if to_regclass('public.retailer_control_state_evidence_v1') is not null
     or to_regprocedure('public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)') is not null
     or to_regprocedure('public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)') is not null then
    raise exception 'RCSE_SCHEMA_DRIFT: control-state interface v1 already exists';
  end if;
end
$preflight$;

do $roles$
declare
  v_name text;
  v_role pg_roles%rowtype;
begin
  foreach v_name in array array[
    'retailer_control_state_read_owner',
    'retailer_control_state_evidence_owner',
    'retailer_control_state_exporter',
    'retailer_control_state_evidence_writer'
  ] loop
    select * into v_role from pg_roles where rolname = v_name;
    if not found then
      execute format(
        'create role %I nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls',
        v_name
      );
    elsif v_role.rolcanlogin or v_role.rolinherit or v_role.rolsuper
       or v_role.rolcreatedb or v_role.rolcreaterole or v_role.rolreplication
       or v_role.rolbypassrls then
      raise exception 'RCSE_ROLE_UNSAFE: role % has unsafe attributes', v_name;
    end if;
  end loop;
end
$roles$;

alter role retailer_control_state_exporter set default_transaction_read_only = on;
alter role retailer_control_state_exporter set statement_timeout = '15s';
alter role retailer_control_state_exporter set idle_in_transaction_session_timeout = '15s';

create table public.retailer_control_state_evidence_v1 (
  event_id uuid primary key,
  event_version integer not null check (event_version = 1),
  event_type text not null check (event_type in (
    'SESSION_STARTED','SESSION_HEARTBEAT','SESSION_COMPLETED','SESSION_FAILED',
    'LOCK_OBSERVED','LOCK_ACQUIRED','LOCK_RENEWED','LOCK_RELEASED','LOCK_EXPIRED',
    'POSTFLIGHT_COMPLETED','POSTFLIGHT_FAILED','WATCHDOG_OBSERVED',
    'GLOBAL_CONFLICT_OBSERVED','SOURCE_OBSERVED','WORKFLOW_OBSERVED'
  )),
  retailer_id bigint,
  global_scope boolean not null default false,
  scope_fingerprint text not null check (scope_fingerprint ~ '^[0-9a-f]{64}$'),
  source_system text not null check (source_system ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  source_run_id text not null check (source_run_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$'),
  parent_id text check (parent_id is null or parent_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$'),
  occurred_at timestamptz not null,
  observed_at timestamptz not null,
  expires_at timestamptz,
  status text not null check (status in (
    'OPEN','ACTIVE','CURRENT','COMPLETED','FAILED','RELEASED','EXPIRED',
    'STALE','OBSERVED','CLEAR','BLOCKED','ORPHANED'
  )),
  reason_code text not null check (reason_code ~ '^RCSE_[A-Z0-9_]{2,96}$'),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and octet_length(metadata::text) <= 4096
    and metadata::text !~* '"(password|token|authorization|cookie|secret|connection_string|database_url|service_role_key)"[[:space:]]*:'
    and metadata::text !~* '"(plan|plans|plan_json|approval|approvals|apply|apply_ledger|offer|offers|price|stock|product|products|variant|variants|recovery_manifest)"[[:space:]]*:'
    and metadata::text !~* '(bearer[[:space:]]+[a-z0-9._~+/-]{8,}|postgres(ql)?://)'
  ),
  payload_fingerprint text not null check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null unique check (idempotency_key ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default transaction_timestamp(),
  constraint retailer_control_state_evidence_scope check (
    (global_scope and retailer_id is null) or (not global_scope and retailer_id is not null)
  ),
  constraint retailer_control_state_evidence_time check (
    observed_at >= occurred_at - interval '5 minutes'
    and observed_at <= transaction_timestamp() + interval '5 minutes'
    and (expires_at is null or expires_at > occurred_at)
  ),
  constraint retailer_control_state_evidence_expiry_required check (
    event_type not in ('SESSION_STARTED','SESSION_HEARTBEAT','LOCK_OBSERVED','LOCK_ACQUIRED',
      'LOCK_RENEWED','POSTFLIGHT_COMPLETED','POSTFLIGHT_FAILED','WATCHDOG_OBSERVED',
      'GLOBAL_CONFLICT_OBSERVED','SOURCE_OBSERVED','WORKFLOW_OBSERVED')
    or expires_at is not null
  )
);

alter table public.retailer_control_state_evidence_v1 owner to retailer_control_state_evidence_owner;
alter table public.retailer_control_state_evidence_v1 enable row level security;
alter table public.retailer_control_state_evidence_v1 force row level security;

create index retailer_control_state_evidence_retailer_time_idx
  on public.retailer_control_state_evidence_v1(retailer_id,event_type,observed_at desc,event_id desc);
create index retailer_control_state_evidence_scope_time_idx
  on public.retailer_control_state_evidence_v1(scope_fingerprint,observed_at desc,event_id desc);
create index retailer_control_state_evidence_source_run_idx
  on public.retailer_control_state_evidence_v1(source_system,source_run_id,observed_at desc,event_id desc);
create index retailer_control_state_evidence_active_idx
  on public.retailer_control_state_evidence_v1(retailer_id,event_type,expires_at)
  where status in ('OPEN','ACTIVE','CURRENT','STALE','BLOCKED','ORPHANED');

revoke all on table public.retailer_control_state_evidence_v1
  from public,anon,authenticated,service_role,
       retailer_catalogue_production_validator,retailer_catalogue_production_approver,
       retailer_catalogue_production_executor,retailer_control_state_read_owner,
       retailer_control_state_exporter,retailer_control_state_evidence_writer;
create policy retailer_control_state_evidence_owner_insert_v1
  on public.retailer_control_state_evidence_v1 for insert
  to retailer_control_state_evidence_owner with check (true);
create policy retailer_control_state_evidence_owner_select_v1
  on public.retailer_control_state_evidence_v1 for select
  to retailer_control_state_evidence_owner using (true);
create policy retailer_control_state_read_owner_select_v1
  on public.retailer_control_state_evidence_v1 for select
  to retailer_control_state_read_owner using (true);

grant select,insert on table public.retailer_control_state_evidence_v1
  to retailer_control_state_evidence_owner;
grant select on table public.retailer_control_state_evidence_v1
  to retailer_control_state_read_owner;

do $read_policies$
declare
  v_table text;
  v_policy text;
begin
  foreach v_table in array array[
    'retailer_catalogue_parent_plans','retailer_catalogue_child_plans',
    'retailer_catalogue_apply_runs','retailer_offer_sync_batch_approvals',
    'approved_import_plans','retailer_catalogue_production_fixture_approvals',
    'retailer_catalogue_production_recovery_manifests',
    'retailer_catalogue_production_recovery_approvals',
    'retailer_offer_sync_reviewed_mixed_change_bindings'
  ] loop
    v_policy := 'rcse_read_' || substr(md5(v_table),1,16) || '_v1';
    execute format('create policy %I on public.%I for select to retailer_control_state_read_owner using (true)',v_policy,v_table);
    execute format('grant select on table public.%I to retailer_control_state_read_owner',v_table);
  end loop;
end
$read_policies$;

create or replace function public.write_retailer_control_state_evidence_v1(
  p_event_id uuid,
  p_event_version integer,
  p_event_type text,
  p_retailer_id bigint,
  p_global_scope boolean,
  p_scope_fingerprint text,
  p_source_system text,
  p_source_run_id text,
  p_parent_id text,
  p_occurred_at timestamptz,
  p_observed_at timestamptz,
  p_expires_at timestamptz,
  p_status text,
  p_reason_code text,
  p_metadata jsonb,
  p_payload_fingerprint text,
  p_idempotency_key text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $write_evidence$
declare
  v_expected text;
  v_existing public.retailer_control_state_evidence_v1%rowtype;
  v_inserted boolean := false;
begin
  v_expected := encode(pg_catalog.sha256(convert_to(jsonb_build_object(
    'event_id',p_event_id,'event_version',p_event_version,'event_type',p_event_type,
    'retailer_id',p_retailer_id,'global_scope',p_global_scope,
    'scope_fingerprint',p_scope_fingerprint,'source_system',p_source_system,
    'source_run_id',p_source_run_id,'parent_id',p_parent_id,
    'occurred_at',p_occurred_at,'observed_at',p_observed_at,'expires_at',p_expires_at,
    'status',p_status,'reason_code',p_reason_code,'metadata',coalesce(p_metadata,'{}'::jsonb)
  )::text,'UTF8')),'hex');

  if p_payload_fingerprint is distinct from v_expected then
    raise exception 'RCSE_EVIDENCE_FINGERPRINT_MISMATCH';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key,0));

  insert into public.retailer_control_state_evidence_v1(
    event_id,event_version,event_type,retailer_id,global_scope,scope_fingerprint,
    source_system,source_run_id,parent_id,occurred_at,observed_at,expires_at,
    status,reason_code,metadata,payload_fingerprint,idempotency_key
  ) values (
    p_event_id,p_event_version,p_event_type,p_retailer_id,p_global_scope,p_scope_fingerprint,
    p_source_system,p_source_run_id,p_parent_id,p_occurred_at,p_observed_at,p_expires_at,
    p_status,p_reason_code,coalesce(p_metadata,'{}'::jsonb),p_payload_fingerprint,p_idempotency_key
  ) on conflict (idempotency_key) do nothing
  returning true into v_inserted;
  v_inserted := coalesce(v_inserted,false);

  select * into v_existing
  from public.retailer_control_state_evidence_v1
  where idempotency_key = p_idempotency_key;

  if not found or v_existing.payload_fingerprint is distinct from p_payload_fingerprint
     or v_existing.event_id is distinct from p_event_id then
    raise exception 'RCSE_EVIDENCE_IDEMPOTENCY_CONFLICT';
  end if;

  return jsonb_build_object(
    'event_id',v_existing.event_id,'event_type',v_existing.event_type,
    'payload_fingerprint',v_existing.payload_fingerprint,
    'idempotency_key',v_existing.idempotency_key,'inserted',v_inserted,
    'idempotent',not v_inserted
  );
end
$write_evidence$;

alter function public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)
  owner to retailer_control_state_evidence_owner;

create or replace function public.read_retailer_control_state_v1(
  p_retailer_id bigint,
  p_retailer_name text,
  p_baseline_sha text,
  p_authorization_fingerprint text,
  p_authorization_valid_until timestamptz,
  p_required_sources text[],
  p_max_records integer,
  p_max_bytes integer
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $read_state$
declare
  v_sources constant text[] := array[
    'control_plans','plan_items','sessions','locks','approval_contracts',
    'approval_consumption','recovery_state','apply_ledger','postflight_state',
    'watchdog_state','global_conflicts'
  ];
  v_started timestamptz := statement_timestamp();
  v_plans jsonb;
  v_items jsonb;
  v_sessions jsonb;
  v_locks jsonb;
  v_approvals jsonb;
  v_consumption jsonb;
  v_recovery jsonb;
  v_applies jsonb;
  v_postflight jsonb;
  v_watchdog jsonb;
  v_conflicts jsonb;
  v_records jsonb;
  v_counts jsonb;
  v_total integer;
  v_coverage integer;
  v_state_fingerprint text;
  v_result jsonb;
  v_assessment text;
begin
  if p_retailer_id is null or nullif(trim(p_retailer_name),'') is null
     or p_baseline_sha !~ '^[0-9a-f]{40}$'
     or p_authorization_fingerprint !~ '^[0-9a-f]{64}$'
     or p_authorization_valid_until <= statement_timestamp()
     or p_authorization_valid_until > statement_timestamp() + interval '30 minutes'
     or p_required_sources is distinct from v_sources
     or p_max_records not between 1 and 10000
     or p_max_bytes not between 1024 and 8388608 then
    raise exception 'RCSE_INVALID_REQUEST';
  end if;

  select count(distinct metadata->>'logical_source') into v_coverage
  from public.retailer_control_state_evidence_v1
  where (retailer_id=p_retailer_id or global_scope)
    and event_type='SOURCE_OBSERVED'
    and status in ('CURRENT','CLEAR','OBSERVED')
    and expires_at>statement_timestamp()
    and metadata->>'logical_source' in ('sessions','locks','postflight_state','watchdog_state','global_conflicts');
  if v_coverage <> 5 then
    raise exception 'RCSE_SOURCE_UNAVAILABLE: observation coverage is %/5',v_coverage;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id::text,'status',p.status,'kind','CONTROL','scope','RETAILER',
    'retailer_ids',jsonb_build_array(p.retailer_id::text),
    'source_fingerprint',p.source_snapshot_fingerprint,
    'parent_plan_fingerprint',p.parent_plan_fingerprint,
    'created_at',p.created_at,'updated_at',p.updated_at,
    'expires_at',p.approval_expires_at
  ) order by p.id),'[]'::jsonb) into v_plans
  from public.retailer_catalogue_parent_plans p where p.retailer_id=p_retailer_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id::text,'plan_id',c.parent_plan_id::text,'status',c.status,
    'scope','RETAILER','retailer_ids',jsonb_build_array(c.retailer_id::text),
    'child_plan_fingerprint',c.child_plan_fingerprint,'dependency_group',c.dependency_group,
    'batch_index',c.batch_index,'created_at',c.created_at,'updated_at',c.updated_at
  ) order by c.parent_plan_id,c.batch_index,c.id),'[]'::jsonb) into v_items
  from public.retailer_catalogue_child_plans c where c.retailer_id=p_retailer_id;

  with latest as (
    select distinct on (source_run_id) *
    from public.retailer_control_state_evidence_v1
    where (retailer_id=p_retailer_id or global_scope)
      and event_type like 'SESSION_%'
    order by source_run_id,observed_at desc,created_at desc,event_id desc
  ) select coalesce(jsonb_agg(jsonb_build_object(
    'id',source_run_id,'status',case when event_type in ('SESSION_STARTED','SESSION_HEARTBEAT') then 'OPEN' when event_type='SESSION_COMPLETED' then 'CLOSED' else 'FAILED' end,
    'scope',case when global_scope then 'GLOBAL' else 'RETAILER' end,
    'retailer_ids',case when retailer_id is null then '[]'::jsonb else jsonb_build_array(retailer_id::text) end,
    'heartbeat_status',case when event_type in ('SESSION_STARTED','SESSION_HEARTBEAT') and expires_at<=statement_timestamp() then 'STALE' else 'CURRENT' end,
    'heartbeat_expires_at',expires_at,'source_reference',source_system||':'||source_run_id
  ) order by source_run_id),'[]'::jsonb) into v_sessions from latest;

  with latest as (
    select distinct on (source_run_id) *
    from public.retailer_control_state_evidence_v1
    where (retailer_id=p_retailer_id or global_scope)
      and event_type like 'LOCK_%'
    order by source_run_id,observed_at desc,created_at desc,event_id desc
  ) select coalesce(jsonb_agg(jsonb_build_object(
    'id',source_run_id,
    'status',case when event_type in ('LOCK_RELEASED') then 'RELEASED' when event_type='LOCK_EXPIRED' or expires_at<=statement_timestamp() then 'EXPIRED' when status='ORPHANED' then 'ORPHANED' else 'ACTIVE' end,
    'scope',case when global_scope then 'GLOBAL' else 'RETAILER' end,
    'retailer_ids',case when retailer_id is null then '[]'::jsonb else jsonb_build_array(retailer_id::text) end,
    'owner_session_id',metadata->>'owner_session_id','expires_at',expires_at,
    'source_reference',source_system||':'||source_run_id
  ) order by source_run_id),'[]'::jsonb) into v_locks from latest;

  with approvals as (
    select approval_id::text id,retailer_id,approved_at,approval_expires_at expires_at,
      approval_consumed_at consumed_at,
      case when audit_log @> '[{"event":"APPROVAL_REVOKED"}]'::jsonb then 'REVOKED'
           when approval_consumed_at is not null then 'CONSUMED'
           when approval_expires_at<=statement_timestamp() then 'EXPIRED' else 'APPROVED' end status,
      parent_plan_fingerprint fingerprint,'PARENT_PLAN' source
    from public.retailer_catalogue_parent_plans where retailer_id=p_retailer_id and approval_id is not null
    union all
    select approval_id::text,retailer_id,approved_at,approval_expires_at,approval_consumed_at,
      case when audit_log @> '[{"event":"APPROVAL_REVOKED"}]'::jsonb then 'REVOKED'
           when approval_consumed_at is not null then 'CONSUMED'
           when approval_expires_at<=statement_timestamp() then 'EXPIRED' else 'APPROVED' end,
      child_plan_fingerprint,'CHILD_PLAN'
    from public.retailer_catalogue_child_plans where retailer_id=p_retailer_id and approval_id is not null
    union all
    select a.id::text,c.retailer_id,a.approved_at,a.expires_at,a.consumed_at,
      case when a.consumed_at is not null then 'CONSUMED' when a.expires_at<=statement_timestamp() then 'EXPIRED' else 'APPROVED' end,
      a.execution_fingerprint,'BATCH'
    from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id
    where c.retailer_id=p_retailer_id
    union all
    select a.id::text,a.retailer_id,a.created_at,a.expires_at,a.consumed_at,
      case when a.consumed_at is not null or a.status='consumed' then 'CONSUMED' when a.expires_at<=statement_timestamp() then 'EXPIRED' else 'APPROVED' end,
      a.artifact_sha256,'IMPORT'
    from public.approved_import_plans a where a.retailer_id=p_retailer_id
    union all
    select a.id::text,p.retailer_id,a.approved_at,a.expires_at,a.consumed_at,
      case when a.consumed_at is not null then 'CONSUMED' when a.expires_at<=statement_timestamp() then 'EXPIRED' else 'APPROVED' end,
      a.package_fingerprint,'FIXTURE'
    from public.retailer_catalogue_production_fixture_approvals a join public.retailer_catalogue_parent_plans p on p.id=a.parent_plan_id
    where p.retailer_id=p_retailer_id
    union all
    select a.id::text,c.retailer_id,a.approved_at,a.expires_at,a.consumed_at,
      case when a.consumed_at is not null then 'CONSUMED' when a.expires_at<=statement_timestamp() then 'EXPIRED' else 'APPROVED' end,
      a.expected_recovery_state_fingerprint,'RECOVERY'
    from public.retailer_catalogue_production_recovery_approvals a
    join public.retailer_catalogue_production_recovery_manifests m on m.id=a.recovery_manifest_id
    join public.retailer_catalogue_child_plans c on c.id=m.child_plan_id
    where c.retailer_id=p_retailer_id
    union all
    select b.approval_id::text,c.retailer_id,b.approved_at,a.expires_at,b.consumed_at,
      case when b.status='CONSUMED' or b.consumed_at is not null then 'CONSUMED'
           when a.expires_at<=statement_timestamp() then 'EXPIRED' else 'APPROVED' end,
      b.reviewed_contract_hash,'REVIEWED_MIXED'
    from public.retailer_offer_sync_reviewed_mixed_change_bindings b
    join public.retailer_offer_sync_batch_approvals a on a.id=b.approval_id
    join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id
    where c.retailer_id=p_retailer_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'status',status,'scope','RETAILER','retailer_ids',jsonb_build_array(retailer_id::text),
    'approved_at',approved_at,'expires_at',expires_at,'consumed_at',consumed_at,
    'fingerprint',fingerprint,'source',source
  ) order by id),'[]'::jsonb) into v_approvals from approvals;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id','consumption-'||(a->>'id'),'approval_id',a->>'id','status','CONSUMED',
    'scope',a->>'scope','retailer_ids',a->'retailer_ids','consumed_at',a->'consumed_at'
  ) order by a->>'id'),'[]'::jsonb) into v_consumption
  from jsonb_array_elements(v_approvals) a where a->>'consumed_at' is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id::text,'status',m.status,'scope','RETAILER',
    'retailer_ids',jsonb_build_array(c.retailer_id::text),
    'child_plan_id',m.child_plan_id::text,'apply_run_id',m.apply_run_id::text,
    'execution_fingerprint',m.execution_fingerprint,
    'rollback_fingerprint',m.rollback_manifest_fingerprint,
    'created_at',m.created_at,'completed_at',m.recovered_at
  ) order by m.id),'[]'::jsonb) into v_recovery
  from public.retailer_catalogue_production_recovery_manifests m
  join public.retailer_catalogue_child_plans c on c.id=m.child_plan_id
  where c.retailer_id=p_retailer_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id::text,'status',r.status,'scope','RETAILER',
    'retailer_ids',jsonb_build_array(r.retailer_id::text),
    'plan_id',r.parent_plan_id::text,'plan_item_id',r.child_plan_id::text,
    'run_type',r.run_type,'started_at',r.started_at,'completed_at',coalesce(r.completed_at,r.started_at),
    'execution_fingerprint',r.expected_state_fingerprint
  ) order by r.started_at,r.id),'[]'::jsonb) into v_applies
  from public.retailer_catalogue_apply_runs r where r.retailer_id=p_retailer_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',event_id::text,'status',case when event_type='POSTFLIGHT_COMPLETED' then 'COMPLETED' else 'FAILED' end,
    'scope',case when global_scope then 'GLOBAL' else 'RETAILER' end,
    'retailer_ids',case when retailer_id is null then '[]'::jsonb else jsonb_build_array(retailer_id::text) end,
    'completed_at',occurred_at,'source_reference',source_system||':'||source_run_id,
    'payload_fingerprint',payload_fingerprint
  ) order by occurred_at,event_id),'[]'::jsonb) into v_postflight
  from public.retailer_control_state_evidence_v1
  where (retailer_id=p_retailer_id or global_scope)
    and event_type in ('POSTFLIGHT_COMPLETED','POSTFLIGHT_FAILED')
    and expires_at>statement_timestamp();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',event_id::text,'status',status,'scope',case when global_scope then 'GLOBAL' else 'RETAILER' end,
    'retailer_ids',case when retailer_id is null then '[]'::jsonb else jsonb_build_array(retailer_id::text) end,
    'completed_at',occurred_at,'source_reference',source_system||':'||source_run_id,
    'payload_fingerprint',payload_fingerprint
  ) order by occurred_at,event_id),'[]'::jsonb) into v_watchdog
  from public.retailer_control_state_evidence_v1
  where (retailer_id=p_retailer_id or global_scope)
    and event_type='WATCHDOG_OBSERVED'
    and expires_at>statement_timestamp();

  with explicit_conflicts as (
    select event_id::text id,reason_code,
      source_system||':'||source_run_id source_reference,
      case when global_scope then 'GLOBAL' else 'CROSS_RETAILER' end scope,
      case when retailer_id is null then '[]'::jsonb else jsonb_build_array(retailer_id::text) end retailer_ids,
      payload_fingerprint
    from public.retailer_control_state_evidence_v1
    where (retailer_id=p_retailer_id or global_scope)
      and event_type='GLOBAL_CONFLICT_OBSERVED'
      and status in ('ACTIVE','BLOCKED','ORPHANED')
      and expires_at>statement_timestamp()
  ), equivalent_active_plans as (
    select 'equivalent-'||p.source_snapshot_fingerprint id,
      'RCSE_EQUIVALENT_ACTIVE_PLAN' reason_code,
      'source-fingerprint:'||p.source_snapshot_fingerprint source_reference,
      'CROSS_RETAILER' scope,
      jsonb_agg(distinct p.retailer_id::text order by p.retailer_id::text) retailer_ids,
      p.source_snapshot_fingerprint payload_fingerprint
    from public.retailer_catalogue_parent_plans p
    where p.status in ('PLANNED','APPROVED','PARTIALLY_APPLIED')
      and exists (
        select 1 from public.retailer_catalogue_parent_plans target
        where target.retailer_id=p_retailer_id
          and target.source_snapshot_fingerprint=p.source_snapshot_fingerprint
          and target.status in ('PLANNED','APPROVED','PARTIALLY_APPLIED')
      )
    group by p.source_snapshot_fingerprint
    having count(distinct p.retailer_id)>1
  ), conflicts as (
    select * from explicit_conflicts
    union all
    select * from equivalent_active_plans
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'reason_code',reason_code,'source_reference',source_reference,
    'scope',scope,'retailer_ids',retailer_ids,'payload_fingerprint',payload_fingerprint
  ) order by id),'[]'::jsonb) into v_conflicts from conflicts;

  v_records := jsonb_build_object(
    'control_plans',v_plans,'plan_items',v_items,'sessions',v_sessions,'locks',v_locks,
    'approval_contracts',v_approvals,'approval_consumption',v_consumption,
    'recovery_state',v_recovery,'apply_ledger',v_applies,'postflight_state',v_postflight,
    'watchdog_state',v_watchdog,'global_conflicts',v_conflicts
  );
  select coalesce(sum(jsonb_array_length(value)),0)::integer into v_total from jsonb_each(v_records);
  if v_total > p_max_records then raise exception 'RCSE_LIMIT_EXCEEDED: records %/%',v_total,p_max_records; end if;
  select jsonb_object_agg(key,jsonb_array_length(value) order by key) into v_counts from jsonb_each(v_records);
  v_state_fingerprint := encode(pg_catalog.sha256(convert_to(v_records::text,'UTF8')),'hex');

  v_assessment := case
    when jsonb_array_length(v_recovery)>0 then 'BLOCKED_RECOVERY'
    when exists(select 1 from jsonb_array_elements(v_plans) p where p->>'status' in ('PLANNED','APPROVED','APPLYING','PARTIALLY_APPLIED')) then 'BLOCKED_ACTIVE_PLAN'
    when exists(select 1 from jsonb_array_elements(v_sessions) s where s->>'status'='OPEN') then 'BLOCKED_ACTIVE_SESSION'
    when exists(select 1 from jsonb_array_elements(v_locks) l where l->>'status' in ('ACTIVE','ORPHANED')) then 'BLOCKED_LOCK'
    when exists(select 1 from jsonb_array_elements(v_approvals) a where a->>'status'='APPROVED') then 'BLOCKED_APPROVAL'
    when exists(select 1 from jsonb_array_elements(v_plans) p where p->>'status' in ('FAILED','PARTIALLY_APPLIED')) then 'BLOCKED_INCOMPLETE_STATE'
    when jsonb_array_length(v_conflicts)>0 then 'BLOCKED_UNKNOWN'
    when jsonb_array_length(v_postflight)=0 or jsonb_array_length(v_watchdog)=0 then 'BLOCKED_INCOMPLETE_EXPORT'
    else 'CLEAR_FOR_SEPARATE_SHADOW_AUTHORIZATION' end;

  v_result := jsonb_build_object(
    'schema_version','control-state-export-v1','retailer_id',p_retailer_id::text,
    'retailer_name',trim(p_retailer_name),'baseline_sha',p_baseline_sha,
    'export_started_at',v_started,'export_completed_at',statement_timestamp(),
    'capture_window',jsonb_build_object('started_at',v_started,'completed_at',statement_timestamp(),
      'consistency_markers',jsonb_build_object('snapshot','ONE_POSTGRESQL_STATEMENT','state_fingerprint',v_state_fingerprint)),
    'authorization_fingerprint',p_authorization_fingerprint,
    'provider_identity',jsonb_build_object('mode','live-read-only','provider_id','transactional-rpc-v1',
      'credential_type','DEDICATED_CONTROL_STATE_EXPORTER','read_only_proven',true,
      'service_role',false,'mutation_capabilities','[]'::jsonb,
      'approved_interfaces',jsonb_build_array('public.read_retailer_control_state_v1')),
    'sources_queried',to_jsonb(v_sources),'sources_unavailable','[]'::jsonb,
    'source_records',v_records,'completeness_status','COMPLETE','consistency_status','CONSISTENT',
    'active_plans',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(v_plans)x where x->>'status' in ('PLANNED','APPROVED','APPLYING','PARTIALLY_APPLIED')),
    'incomplete_plans',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(v_plans)x where x->>'status' in ('FAILED','PARTIALLY_APPLIED')),
    'expired_plans',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(v_plans)x where x->>'status'='EXPIRED'),
    'superseded_plans',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(v_plans)x where x->>'status'='SUPERSEDED'),
    'recovery_plans',v_recovery,'sessions',v_sessions,
    'open_sessions',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(v_sessions)x where x->>'status'='OPEN'),
    'stale_sessions',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(v_sessions)x where x->>'heartbeat_status'='STALE'),
    'active_locks',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(v_locks)x where x->>'status'='ACTIVE'),
    'expired_locks',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(v_locks)x where x->>'status'='EXPIRED'),
    'orphaned_locks',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(v_locks)x where x->>'status'='ORPHANED'),
    'pending_approvals','[]'::jsonb,
    'unused_approvals',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(v_approvals)x where x->>'status'='APPROVED'),
    'expired_approvals',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(v_approvals)x where x->>'status'='EXPIRED'),
    'consumed_approvals',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(v_approvals)x where x->>'status'='CONSUMED'),
    'revoked_approvals',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(v_approvals)x where x->>'status'='REVOKED'),
    'last_apply',(select x from jsonb_array_elements(v_applies)x order by x->>'completed_at' desc,x->>'id' desc limit 1),
    'last_postflight',(select x from jsonb_array_elements(v_postflight)x order by x->>'completed_at' desc,x->>'id' desc limit 1),
    'last_watchdog_result',(select x from jsonb_array_elements(v_watchdog)x order by x->>'completed_at' desc,x->>'id' desc limit 1),
    'overlapping_scope_conflicts',v_conflicts,
    'blocking_reasons',case when v_assessment='CLEAR_FOR_SEPARATE_SHADOW_AUTHORIZATION' then '[]'::jsonb else jsonb_build_array(v_assessment) end,
    'warnings',case when v_assessment='CLEAR_FOR_SEPARATE_SHADOW_AUTHORIZATION' then jsonb_build_array('This result does not authorize capture or shadow execution') else '[]'::jsonb end,
    'record_counts',v_counts,
    'pagination_evidence',(select jsonb_object_agg(key,jsonb_build_object('page_size',jsonb_array_length(value),'page_count',1,'record_count',jsonb_array_length(value),'pages',jsonb_build_array(jsonb_build_object('page_number',1,'record_count',jsonb_array_length(value),'cursor_in',null,'cursor_out',null,'total_count',jsonb_array_length(value)))) order by key) from jsonb_each(v_records)),
    'read_attempt_count',1,'write_attempt_count',0,'mutation_attempt_count',0,
    'canonical_state_fingerprint',v_state_fingerprint,'export_fingerprint',repeat('0',64),
    'final_assessment',v_assessment
  );
  v_result := jsonb_set(v_result,'{export_fingerprint}',to_jsonb(encode(pg_catalog.sha256(convert_to(v_result::text,'UTF8')),'hex')));
  if octet_length(v_result::text)>p_max_bytes then raise exception 'RCSE_LIMIT_EXCEEDED: bytes'; end if;
  return v_result;
end
$read_state$;

alter function public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)
  owner to retailer_control_state_read_owner;

revoke all on function public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)
  from public,anon,authenticated,service_role,
       retailer_catalogue_production_validator,retailer_catalogue_production_approver,
       retailer_catalogue_production_executor,retailer_control_state_exporter,
       retailer_control_state_read_owner;
revoke all on function public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)
  from public,anon,authenticated,service_role,
       retailer_catalogue_production_validator,retailer_catalogue_production_approver,
       retailer_catalogue_production_executor,retailer_control_state_evidence_writer,
       retailer_control_state_evidence_owner;

revoke all on all tables in schema public from retailer_control_state_exporter,retailer_control_state_evidence_writer;
revoke all on all sequences in schema public from retailer_control_state_exporter,retailer_control_state_evidence_writer;
revoke execute on all functions in schema public from retailer_control_state_exporter,retailer_control_state_evidence_writer;
grant usage on schema public to retailer_control_state_read_owner,
  retailer_control_state_evidence_owner,retailer_control_state_exporter,
  retailer_control_state_evidence_writer;
grant execute on function public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)
  to retailer_control_state_exporter;
grant execute on function public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)
  to retailer_control_state_evidence_writer;

revoke retailer_catalogue_production_validator,retailer_catalogue_production_approver,
  retailer_catalogue_production_executor from retailer_control_state_exporter,
  retailer_control_state_evidence_writer,retailer_control_state_read_owner,
  retailer_control_state_evidence_owner;
revoke retailer_control_state_read_owner,retailer_control_state_evidence_owner
  from retailer_control_state_exporter,retailer_control_state_evidence_writer;

comment on table public.retailer_control_state_evidence_v1 is
  'RA-004 v1 append-only operational evidence only; never copies plans, approvals, apply rows or catalogue data.';
comment on function public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text) is
  'RA-004 v1 idempotent insert-only evidence interface. No runtime caller is authorized by this migration.';
comment on function public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer) is
  'RA-004 v1 bounded one-statement control-state snapshot. CLEAR is evidence only and never shadow authorization.';

commit;
