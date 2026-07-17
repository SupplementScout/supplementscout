begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.retailer_catalogue_parent_plans drop constraint retailer_catalogue_parent_plans_target_environment_check;
alter table public.retailer_catalogue_parent_plans add constraint retailer_catalogue_parent_plans_target_environment_check check (target_environment in ('LOCAL_POSTGRES','DRY_RUN','STAGING'));
alter table public.retailer_catalogue_child_plans drop constraint retailer_catalogue_child_plans_target_environment_check;
alter table public.retailer_catalogue_child_plans add constraint retailer_catalogue_child_plans_target_environment_check check (target_environment in ('LOCAL_POSTGRES','DRY_RUN','STAGING'));
alter table public.retailer_catalogue_apply_runs drop constraint retailer_catalogue_apply_runs_target_environment_check;
alter table public.retailer_catalogue_apply_runs add constraint retailer_catalogue_apply_runs_target_environment_check check (target_environment in ('LOCAL_POSTGRES','DRY_RUN','STAGING'));

do $roles$ begin
  if not exists(select 1 from pg_roles where rolname='retailer_catalogue_staging_approver') then create role retailer_catalogue_staging_approver nologin; end if;
  if not exists(select 1 from pg_roles where rolname='retailer_catalogue_staging_executor') then create role retailer_catalogue_staging_executor nologin; end if;
end $roles$;

create table public.retailer_catalogue_staging_fixture_approvals (
  id uuid primary key default gen_random_uuid(),
  fixture_id text not null,
  fixture_fingerprint text not null check(fixture_fingerprint ~ '^[0-9a-f]{64}$'),
  project_ref text not null,
  database_identity text not null,
  migration_ledger_fingerprint text not null check(migration_ledger_fingerprint ~ '^[0-9a-f]{64}$'),
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
  check(expires_at>approved_at)
);
create unique index retailer_catalogue_staging_fixture_active_idx on public.retailer_catalogue_staging_fixture_approvals(fixture_fingerprint,project_ref,database_identity) where consumed_at is null;

create table public.retailer_catalogue_staging_recovery_manifests (
  id uuid primary key default gen_random_uuid(),
  child_plan_id uuid not null unique references public.retailer_catalogue_child_plans(id) on delete restrict,
  apply_run_id uuid not null unique references public.retailer_catalogue_apply_runs(id) on delete restrict,
  dependency_group text not null,
  created_product_ids jsonb not null default '[]'::jsonb,
  created_variant_ids jsonb not null default '[]'::jsonb,
  created_mapping_ids jsonb not null default '[]'::jsonb,
  created_offer_ids jsonb not null default '[]'::jsonb,
  created_price_history_ids jsonb not null default '[]'::jsonb,
  updated_before_state jsonb not null default '[]'::jsonb,
  ownership jsonb not null,
  reverse_dependency_order jsonb not null,
  status text not null default 'READY' check(status in ('READY','RECOVERED')),
  recovered_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.retailer_catalogue_staging_recovery_audit (
  id uuid primary key default gen_random_uuid(), recovery_manifest_id uuid not null references public.retailer_catalogue_staging_recovery_manifests(id),
  event text not null, archived_rows jsonb not null default '{}'::jsonb, actor text not null, created_at timestamptz not null default now()
);

alter table public.retailer_catalogue_staging_fixture_approvals enable row level security;
alter table public.retailer_catalogue_staging_fixture_approvals force row level security;
alter table public.retailer_catalogue_staging_recovery_manifests enable row level security;
alter table public.retailer_catalogue_staging_recovery_manifests force row level security;
alter table public.retailer_catalogue_staging_recovery_audit enable row level security;
alter table public.retailer_catalogue_staging_recovery_audit force row level security;
revoke all on table public.retailer_catalogue_staging_fixture_approvals,public.retailer_catalogue_staging_recovery_manifests,public.retailer_catalogue_staging_recovery_audit from public,anon,authenticated,service_role,retailer_catalogue_staging_approver,retailer_catalogue_staging_executor;

create or replace function public.retailer_catalogue_staging_guard(p_request jsonb)
returns void language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $guard$
begin
  if p_request->>'target_environment' is distinct from 'STAGING'
    or p_request->>'staging_project_ref' is distinct from 'hxnrsyyqffztlvcrtgbf'
    or p_request->>'staging_database_identity' is distinct from 'supplementscout-staging:hxnrsyyqffztlvcrtgbf'
    or p_request->>'fixture_id' is distinct from 'jons-staging-canary-real-10-v1-20260717'
    or p_request->>'fixture_fingerprint' is distinct from '2c62a82c169ee20fab8a86c125423aa50b2d9613283907c408726d4ed89981f5'
    or p_request->>'code_commit' is distinct from '6f7eefb29f775e773bd0764664a0ba138993fa06'
    or coalesce((p_request->>'explicit_allow')::boolean,false)=false then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Sealed staging target rejected');
  end if;
  if current_setting('app.retailer_catalogue_staging_marker',true) is distinct from '1'
    or current_setting('app.retailer_catalogue_allow',true) is distinct from '1'
    or current_setting('app.retailer_catalogue_project_ref',true) is distinct from p_request->>'staging_project_ref'
    or current_setting('app.retailer_catalogue_database_identity',true) is distinct from p_request->>'staging_database_identity'
    or current_setting('app.retailer_catalogue_migration_fingerprint',true) is distinct from p_request->>'migration_ledger_fingerprint'
    or current_setting('app.retailer_catalogue_invocation_role',true) is distinct from 'retailer_catalogue_staging_executor'
    or coalesce(current_setting('app.safe_update',true),'false') not in ('','false','0','off') then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Staging session identity or SAFE_UPDATE guard failed');
  end if;
  if current_database() !~ '^supplementscout_(stage3_test_staging_executor|stage2_test_atomic_import_staging_executor)_[a-z0-9_]+$'
    or to_regclass('public.retailer_catalogue_staging_simulation_marker') is null
    or current_database() ~* '(aftboxmrdgyhizicfsfu|supabase|production)' then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Task 3 permits only disposable staging simulation');
  end if;
end $guard$;

create or replace function public.approve_retailer_catalogue_staging_fixture(p_approval jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $approve_fixture$
declare v_id uuid;
begin
  if current_setting('app.retailer_catalogue_invocation_role',true) is distinct from 'retailer_catalogue_staging_approver'
    or current_database() !~ '^supplementscout_(stage3_test_staging_executor|stage2_test_atomic_import_staging_executor)_[a-z0-9_]+$'
    or to_regclass('public.retailer_catalogue_staging_simulation_marker') is null then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Fixture approval role/target rejected'); end if;
  if p_approval->>'fixture_fingerprint' is distinct from '2c62a82c169ee20fab8a86c125423aa50b2d9613283907c408726d4ed89981f5'
    or p_approval->>'project_ref' is distinct from 'hxnrsyyqffztlvcrtgbf'
    or p_approval->>'database_identity' is distinct from 'supplementscout-staging:hxnrsyyqffztlvcrtgbf'
    or (p_approval->>'expires_at')::timestamptz<=now() or (p_approval->>'expires_at')::timestamptz>now()+interval '120 minutes'
    or p_approval#>>'{canonical_decisions,50844992602450}' is distinct from 'APPROVE_SIMPLE_CANONICAL'
    or p_approval#>>'{canonical_decisions,53951719768402}' is distinct from 'APPROVE_SIMPLE_CANONICAL'
    or p_approval#>>'{canonical_decisions,51935656018258,product_id}' is distinct from '91'
    or p_approval#>>'{canonical_decisions,51935656018258,variant_id}' is distinct from '39' then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Canonical decision approval rejected'); end if;
  insert into public.retailer_catalogue_staging_fixture_approvals(fixture_id,fixture_fingerprint,project_ref,database_identity,migration_ledger_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,canonical_decisions,approved_by,expires_at)
  values(p_approval->>'fixture_id',p_approval->>'fixture_fingerprint',p_approval->>'project_ref',p_approval->>'database_identity',p_approval->>'migration_ledger_fingerprint',p_approval->>'source_snapshot_fingerprint',p_approval->>'canonical_snapshot_fingerprint',p_approval->>'adapter_fingerprint',p_approval->>'policy_fingerprint',p_approval->>'code_commit',p_approval->'canonical_decisions',p_approval->>'approved_by',(p_approval->>'expires_at')::timestamptz) returning id into v_id;
  return jsonb_build_object('fixture_approval_id',v_id,'status','APPROVED');
end $approve_fixture$;

create or replace function public.approve_retailer_catalogue_staging_parent(p_fixture_approval_id uuid,p_parent_plan_id uuid,p_parent_fingerprint text,p_actor text,p_expires_at timestamptz)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $approve_parent$
declare v_fixture public.retailer_catalogue_staging_fixture_approvals%rowtype; v_parent public.retailer_catalogue_parent_plans%rowtype; v_result jsonb;
begin
  if current_setting('app.retailer_catalogue_invocation_role',true) is distinct from 'retailer_catalogue_staging_approver' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Staging parent approval role rejected'); end if;
  select * into v_fixture from public.retailer_catalogue_staging_fixture_approvals where id=p_fixture_approval_id for update;
  if not found or v_fixture.consumed_at is not null or v_fixture.expires_at<=now() then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Fixture approval is missing, expired, or consumed'); end if;
  select * into v_parent from public.retailer_catalogue_parent_plans where id=p_parent_plan_id;
  if not found or v_parent.target_environment<>'STAGING' or v_parent.parent_plan_fingerprint is distinct from p_parent_fingerprint
    or v_parent.source_snapshot_fingerprint is distinct from v_fixture.source_snapshot_fingerprint or v_parent.canonical_snapshot_fingerprint is distinct from v_fixture.canonical_snapshot_fingerprint
    or v_parent.adapter_fingerprint is distinct from v_fixture.adapter_fingerprint or v_parent.policy_fingerprint is distinct from v_fixture.policy_fingerprint or v_parent.code_commit is distinct from v_fixture.code_commit
    or v_parent.plan_json->>'fixture_fingerprint' is distinct from v_fixture.fixture_fingerprint then perform public.retailer_catalogue_raise('RSBI_PARENT_FINGERPRINT_MISMATCH','Fixture approval is not bound to parent'); end if;
  v_result:=public.approve_retailer_catalogue_parent_plan(p_parent_plan_id,p_parent_fingerprint,p_actor,least(p_expires_at,v_fixture.expires_at));
  update public.retailer_catalogue_staging_fixture_approvals set consumed_at=now(),parent_plan_id=p_parent_plan_id where id=v_fixture.id;
  return v_result||jsonb_build_object('fixture_approval_id',v_fixture.id);
end $approve_parent$;

create or replace function public.execute_staging_retailer_catalogue_child(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $execute$
declare v_child public.retailer_catalogue_child_plans%rowtype; v_parent public.retailer_catalogue_parent_plans%rowtype; v_fixture public.retailer_catalogue_staging_fixture_approvals%rowtype; v_run jsonb; v_run_id uuid; v_row jsonb; v_plan jsonb; v_approval jsonb; v_result jsonb; v_results jsonb:='[]'; v_approvals jsonb:='[]'; v_before jsonb; v_after jsonb; v_actual jsonb; v_manifest uuid; v_products jsonb:='[]'; v_variants jsonb:='[]'; v_mappings jsonb:='[]'; v_offers jsonb:='[]'; v_histories jsonb:='[]'; v_history bigint; v_completed jsonb; v_error text; v_code text; v_request_fingerprint text;
begin
  if not public.atomic_import_has_exact_keys(p_request,array['schema_version','target_environment','staging_project_ref','staging_database_identity','parent_plan_id','child_plan_id','fixture_id','fixture_fingerprint','fixture_approval_id','parent_plan_fingerprint','child_plan_fingerprint','source_snapshot_fingerprint','canonical_snapshot_fingerprint','migration_ledger_fingerprint','adapter_fingerprint','policy_fingerprint','code_commit','expected_deltas','row_plans','approval_expiry','requested_at','explicit_allow','request_fingerprint']) then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid staging request keys'); end if;
  perform public.retailer_catalogue_staging_guard(p_request);
  v_request_fingerprint:=encode(pg_catalog.sha256(convert_to(public.atomic_import_canonical_json(jsonb_set(p_request,'{request_fingerprint}','null'::jsonb,false)),'UTF8')),'hex');
  if p_request->>'request_fingerprint' is distinct from v_request_fingerprint then perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Request fingerprint mismatch'); end if;
  select * into v_child from public.retailer_catalogue_child_plans where id=(p_request->>'child_plan_id')::uuid;
  select * into v_parent from public.retailer_catalogue_parent_plans where id=v_child.parent_plan_id;
  select * into v_fixture from public.retailer_catalogue_staging_fixture_approvals where id=(p_request->>'fixture_approval_id')::uuid;
  if v_child.id is null or v_parent.id is null or v_fixture.id is null or v_fixture.parent_plan_id is distinct from v_parent.id or v_fixture.consumed_at is null or v_fixture.expires_at<=now()
    or v_child.target_environment<>'STAGING' or v_parent.parent_plan_fingerprint is distinct from p_request->>'parent_plan_fingerprint' or v_child.child_plan_fingerprint is distinct from p_request->>'child_plan_fingerprint'
    or v_child.source_snapshot_fingerprint is distinct from p_request->>'source_snapshot_fingerprint' or v_child.canonical_snapshot_fingerprint is distinct from p_request->>'canonical_snapshot_fingerprint'
    or v_child.adapter_fingerprint is distinct from p_request->>'adapter_fingerprint' or v_child.policy_fingerprint is distinct from p_request->>'policy_fingerprint' or v_child.code_commit is distinct from p_request->>'code_commit'
    or v_child.expected_deltas is distinct from p_request->'expected_deltas' or jsonb_array_length(p_request->'row_plans')<>jsonb_array_length(v_child.record_ids)
    or (p_request->>'approval_expiry')::timestamptz>v_child.approval_expires_at then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Request is not bound to approved staging child'); end if;
  for v_row in select value from jsonb_array_elements(p_request->'row_plans') loop
    if not public.atomic_import_has_exact_keys(v_row,array['phase1_row_plan','atomic_plan','row_plan_fingerprint','artifact_sha256']) or v_row#>>'{row_plan_fingerprint}' is distinct from v_row#>>'{phase1_row_plan,fingerprints,row_plan}' then perform public.retailer_catalogue_raise('RSBI_ROW_PLAN_FINGERPRINT_MISMATCH','Row binding mismatch'); end if;
    if v_row#>>'{phase1_row_plan,source_record_id}'='51935656018258' and (v_row#>>'{atomic_plan,product,id}' is distinct from '91' or v_row#>>'{atomic_plan,product_variant,id}' is distinct from '39') then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Project AD must reuse product 91 and variant 39'); end if;
    if v_row#>>'{atomic_plan,product,action}'='create' and v_row#>>'{phase1_row_plan,source_record_id}' not in ('50844992602450','53951719768402') then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Canonical creation is outside the approved fixture'); end if;
    if v_row#>>'{atomic_plan,product,action}'='create' and (v_row#>>'{atomic_plan,product_variant,action}' is distinct from 'create_default' or v_row#>>'{atomic_plan,product_variant,evidence,flavour}' is not null or coalesce((v_row#>>'{atomic_plan,product_variant,evidence,pack_count}')::integer,1)<>1) then perform public.retailer_catalogue_raise('RSBI_CANONICAL_SNAPSHOT_STALE','Only approved simple default canonical products are allowed'); end if;
    perform public.validate_product_import_plan_read_only(v_row->'atomic_plan');
  end loop;
  v_run:=public.begin_retailer_catalogue_child_apply(v_child.id,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_child.source_snapshot_fingerprint,v_child.canonical_snapshot_fingerprint,v_child.adapter_fingerprint,v_child.policy_fingerprint,v_child.code_commit,v_child.expected_state_fingerprint,'staging-executor');
  if v_run->>'code'='RSBI_REPLAY_BLOCKED' then return v_run||jsonb_build_object('request_fingerprint',v_request_fingerprint,'replay_status','BLOCKED'); end if;
  v_run_id:=(v_run->>'run_id')::uuid;
  begin
    select jsonb_build_object('retailers',(select count(*) from public.retailers),'products',(select count(*) from public.products),'product_variants',(select count(*) from public.product_variants),'retailer_products',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),'price_history',(select count(*) from public.price_history)) into v_before;
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
    select jsonb_build_object('retailers',(select count(*) from public.retailers),'products',(select count(*) from public.products),'product_variants',(select count(*) from public.product_variants),'retailer_products',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),'price_history',(select count(*) from public.price_history)) into v_after;
    select jsonb_object_agg(k,(v_after->>k)::bigint-(v_before->>k)::bigint) into v_actual from unnest(array['retailers','products','product_variants','retailer_products','offers','price_history']) k;
    if v_actual is distinct from p_request->'expected_deltas' then perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Exact child deltas mismatch',jsonb_build_object('expected',p_request->'expected_deltas','actual',v_actual)); end if;
    v_completed:=public.complete_retailer_catalogue_child_apply(v_run_id,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_after,jsonb_build_object('row_results',v_results,'approval_ids',v_approvals,'actual_deltas',v_actual),'staging-executor');
    insert into public.retailer_catalogue_staging_recovery_manifests(child_plan_id,apply_run_id,dependency_group,created_product_ids,created_variant_ids,created_mapping_ids,created_offer_ids,created_price_history_ids,updated_before_state,ownership,reverse_dependency_order)
    values(v_child.id,v_run_id,v_child.dependency_group,v_products,v_variants,v_mappings,v_offers,v_histories,'[]',jsonb_build_object('plan_owned_only',true,'protected_shared_product_id',case when v_child.dependency_group='DG3_PROJECT_AD_OFFER' then 91 else null end),jsonb_build_array('price_history','offers','retailer_products','product_variants','products')) returning id into v_manifest;
    return jsonb_build_object('request_fingerprint',v_request_fingerprint,'approval_ids',v_approvals,'row_results',v_results,'before_counts',v_before,'after_counts',v_after,'exact_deltas',v_actual,'expected_delta_comparison',true,'child_status','APPLIED','parent_status',v_completed->>'parent_status','replay_status','NOT_REPLAY','rollback_metadata',jsonb_build_object('manifest_id',v_manifest,'status','READY'),'error_code',null,'execution_fingerprint',encode(pg_catalog.sha256(convert_to(public.atomic_import_canonical_json(jsonb_build_object('request',v_request_fingerprint,'run',v_run_id,'results',v_results)),'UTF8')),'hex'));
  exception when others then
    get stacked diagnostics v_error=message_text; v_code:=coalesce(substring(v_error from 'RSBI_[A-Z_]+'),'RSBI_ATOMIC_APPLY_FAILED');
    v_completed:=public.fail_retailer_catalogue_child_apply(v_run_id,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_code,jsonb_build_object('transaction_rolled_back',true,'message',v_error),'staging-executor');
    return jsonb_build_object('request_fingerprint',v_request_fingerprint,'approval_ids','[]'::jsonb,'row_results','[]'::jsonb,'before_counts',v_before,'after_counts',v_before,'exact_deltas',jsonb_build_object('retailers',0,'products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0),'expected_delta_comparison',false,'child_status','FAILED','parent_status',v_completed->>'parent_status','replay_status','NOT_REPLAY','rollback_metadata',jsonb_build_object('status','TRANSACTION_ROLLED_BACK'),'error_code',v_code,'execution_fingerprint',null);
  end;
end $execute$;

create or replace function public.recover_staging_retailer_catalogue_child(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $recover$
declare v_manifest public.retailer_catalogue_staging_recovery_manifests%rowtype; v_child public.retailer_catalogue_child_plans%rowtype; v_parent public.retailer_catalogue_parent_plans%rowtype; v_run_id uuid; v_attempt integer; v_archived jsonb; v_parent_status text;
begin
  perform public.retailer_catalogue_staging_guard(p_request);
  select * into v_manifest from public.retailer_catalogue_staging_recovery_manifests where child_plan_id=(p_request->>'child_plan_id')::uuid for update;
  if not found or v_manifest.status<>'READY' or coalesce((v_manifest.ownership->>'plan_owned_only')::boolean,false)=false then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Recovery manifest unavailable or consumed'); end if;
  select * into v_child from public.retailer_catalogue_child_plans where id=v_manifest.child_plan_id; select * into v_parent from public.retailer_catalogue_parent_plans where id=v_child.parent_plan_id;
  if v_child.child_plan_fingerprint is distinct from p_request->>'child_plan_fingerprint' or v_parent.parent_plan_fingerprint is distinct from p_request->>'parent_plan_fingerprint' then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Recovery request fingerprint mismatch'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_child.id::text,0));
  select coalesce(max(attempt_ordinal),0)+1 into v_attempt from public.retailer_catalogue_apply_runs where child_plan_id=v_child.id and run_type='ROLLBACK';
  insert into public.retailer_catalogue_apply_runs(parent_plan_id,child_plan_id,retailer_id,target_environment,run_type,attempt_ordinal,status,parent_plan_fingerprint,child_plan_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,approval_id,approval_expires_at,rollback_fingerprint,rollback_manifest,expected_deltas,started_by)
  values(v_parent.id,v_child.id,v_child.retailer_id,'STAGING','ROLLBACK',v_attempt,'STARTED',v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,v_child.source_snapshot_fingerprint,v_child.canonical_snapshot_fingerprint,v_child.adapter_fingerprint,v_child.policy_fingerprint,v_child.code_commit,v_child.expected_state_fingerprint,v_child.approval_id,v_child.approval_expires_at,v_parent.rollback_manifest->>'rollback_fingerprint',v_child.rollback_manifest,v_child.expected_deltas,'staging-recovery') returning id into v_run_id;
  select jsonb_build_object('price_history',coalesce(jsonb_agg(to_jsonb(ph)),'[]'::jsonb)) into v_archived from public.price_history ph where ph.id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_price_history_ids));
  delete from public.price_history where id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_price_history_ids));
  delete from public.offers where id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_offer_ids));
  delete from public.retailer_products where id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_mapping_ids));
  delete from public.product_variants v where v.id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_variant_ids)) and not exists(select 1 from public.retailer_products rp where rp.product_variant_id=v.id) and not exists(select 1 from public.offers o where o.product_variant_id=v.id);
  delete from public.products p where p.id in(select value::text::bigint from jsonb_array_elements(v_manifest.created_product_ids)) and not exists(select 1 from public.product_variants v where v.product_id=p.id) and not exists(select 1 from public.retailer_products rp where rp.product_id=p.id) and not exists(select 1 from public.offers o where o.product_id=p.id);
  insert into public.retailer_catalogue_staging_recovery_audit(recovery_manifest_id,event,archived_rows,actor) values(v_manifest.id,'COMMITTED_CHILD_RECOVERED',v_archived,'staging-recovery');
  update public.retailer_catalogue_staging_recovery_manifests set status='RECOVERED',recovered_at=now() where id=v_manifest.id;
  update public.retailer_catalogue_apply_runs set status='ROLLED_BACK',result_metadata=jsonb_build_object('manifest_id',v_manifest.id,'archived_price_history',v_archived,'confirmed_by','staging-recovery'),completed_at=now() where id=v_run_id;
  update public.retailer_catalogue_child_plans set status='ROLLED_BACK',rollback_requested_at=now(),rollback_requested_by='staging-recovery',audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','STAGING_COMMITTED_RECOVERY','run_id',v_run_id,'at',now())) where id=v_child.id;
  if not exists(select 1 from public.retailer_catalogue_child_plans where parent_plan_id=v_parent.id and status<>'ROLLED_BACK') then update public.retailer_catalogue_parent_plans set status='ROLLED_BACK' where id=v_parent.id; v_parent_status:='ROLLED_BACK'; else v_parent_status:=v_parent.status; end if;
  return jsonb_build_object('child_plan_id',v_child.id,'recovery_status','RECOVERED','parent_status',v_parent_status,'protected_shared_product_id',v_manifest.ownership->'protected_shared_product_id','audit_preserved',true);
end $recover$;

alter function public.retailer_catalogue_staging_guard(jsonb) owner to postgres;
alter function public.approve_retailer_catalogue_staging_fixture(jsonb) owner to postgres;
alter function public.approve_retailer_catalogue_staging_parent(uuid,uuid,text,text,timestamptz) owner to postgres;
alter function public.execute_staging_retailer_catalogue_child(jsonb) owner to postgres;
alter function public.recover_staging_retailer_catalogue_child(jsonb) owner to postgres;
revoke all on function public.retailer_catalogue_staging_guard(jsonb),public.approve_retailer_catalogue_staging_fixture(jsonb),public.approve_retailer_catalogue_staging_parent(uuid,uuid,text,text,timestamptz),public.execute_staging_retailer_catalogue_child(jsonb),public.recover_staging_retailer_catalogue_child(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.approve_retailer_catalogue_staging_fixture(jsonb),public.approve_retailer_catalogue_staging_parent(uuid,uuid,text,text,timestamptz) to retailer_catalogue_staging_approver;
grant execute on function public.execute_staging_retailer_catalogue_child(jsonb),public.recover_staging_retailer_catalogue_child(jsonb) to retailer_catalogue_staging_executor;
revoke execute on function public.apply_product_import_plan(jsonb),public.approve_product_import_plan(jsonb,text,text,text,timestamptz),public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) from retailer_catalogue_staging_approver,retailer_catalogue_staging_executor;

commit;
