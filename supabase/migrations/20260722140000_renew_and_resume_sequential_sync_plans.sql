begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- This helper preserves the immutable migration binding of the one already
-- registered staging plan while this migration is added to the ledger. All
-- fresh plans continue to require an exact current-ledger match.
create or replace function public.retailer_catalogue_assert_migration_ledger_for_child(
  p_expected_identifiers jsonb,
  p_expected_fingerprint text,
  p_child_plan_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $assert_child_ledger$
declare
  v_ledger jsonb;
  v_actual_identifiers jsonb;
  v_actual_fingerprint text;
  v_child public.retailer_catalogue_child_plans%rowtype;
  v_parent public.retailer_catalogue_parent_plans%rowtype;
  v_expected_with_migration jsonb;
begin
  v_ledger := public.retailer_catalogue_actual_migration_ledger();
  select coalesce(jsonb_agg(value->>'identifier' order by (value->>'ordinal')::integer),'[]'::jsonb)
  into v_actual_identifiers
  from jsonb_array_elements(v_ledger->'migrations');
  v_actual_fingerprint := public.retailer_catalogue_sha256_json(v_ledger);

  if jsonb_typeof(p_expected_identifiers)='array'
     and v_actual_identifiers is not distinct from p_expected_identifiers
     and v_actual_fingerprint is not distinct from p_expected_fingerprint then
    return v_actual_fingerprint;
  end if;

  select * into v_child from public.retailer_catalogue_child_plans where id=p_child_plan_id;
  if found then
    select * into v_parent from public.retailer_catalogue_parent_plans where id=v_child.parent_plan_id;
  end if;
  v_expected_with_migration := coalesce(p_expected_identifiers,'[]'::jsonb)
    || to_jsonb('20260722140000_renew_and_resume_sequential_sync_plans'::text);

  if v_parent.id='be94ac00-4f61-44f8-8e2e-1aa4ae4dc6ba'::uuid
     and v_parent.target_environment='STAGING'
     and v_parent.parent_plan_fingerprint='752a8bf3c12dbd8aafa66b4bac8b0df6cb08056161538abe1c3bb83dd391d2cc'
     and v_child.parent_plan_fingerprint=v_parent.parent_plan_fingerprint
     and p_expected_identifiers is not distinct from v_child.plan_json->'expected_migration_versions'
     and p_expected_fingerprint is not distinct from v_child.plan_json->>'expected_migration_fingerprint'
     and v_actual_identifiers is not distinct from v_expected_with_migration
     and exists (
       select 1 from jsonb_array_elements(v_parent.audit_log) event
       where event->>'event'='EXACT_STAGING_PARENT_APPROVAL_RENEWED'
         and event->>'migration'='20260722140000'
     ) then
    return p_expected_fingerprint;
  end if;

  perform public.retailer_catalogue_raise(
    'RSBI_SOURCE_HASH_MISMATCH',
    'Actual migration ledger does not match the approved child package',
    jsonb_build_object('actual_fingerprint',v_actual_fingerprint,'actual_identifiers',v_actual_identifiers,'child_plan_id',p_child_plan_id)
  );
  return null;
end
$assert_child_ledger$;

-- Deliberately single-use and bound to the exact partially-applied staging
-- parent authorised on 2026-07-22. It is installed only on the trusted STAGING
-- database, remains owner-only and receives no grant.
do $install_exact_staging_renewal$
begin
  if public.retailer_catalogue_actual_database_target()->>'target_environment'='STAGING' then
    execute $exact_staging_renewal_definition$
create or replace function public.renew_exact_jons_staging_parent_approval(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $renew_exact_parent$
declare
  v_parent public.retailer_catalogue_parent_plans%rowtype;
  v_old_approval_id uuid;
  v_new_approval_id uuid;
  v_renewal_id uuid;
  v_old_expiry timestamptz;
  v_new_expiry timestamptz;
  v_children jsonb;
  v_expected_children constant jsonb := '[
    {"id":"6410f261-83e7-41fd-a128-b43ba8ba3767","batch_index":0,"status":"APPLIED","fingerprint":"fb31c8d2c3377d4355a776ca0a767c174985a7f4c54e0f00be73549eb627e9be"},
    {"id":"daad1141-8600-43e1-98dc-091ad393419b","batch_index":1,"status":"PLANNED","fingerprint":"f49b6338c11363f4c1ce1e5f8de590e89fb4ea41afc093296796a686ba494553"},
    {"id":"1b44c6fa-0050-4c8e-a47f-6679fd8d7338","batch_index":2,"status":"PLANNED","fingerprint":"ff8e7dd7bb5847c6a4c5e95717bba1029a07f150eeedcf9cc1fc74ec3f3ff76c"},
    {"id":"079ac88d-9b09-4865-8c17-042d07b47166","batch_index":3,"status":"PLANNED","fingerprint":"8907dd849e6d2ed46282ef6c26b351b4dc323b3b355172e139d96500670f5bec"},
    {"id":"016e9689-19ad-4387-9cf0-5ac5845a58cd","batch_index":4,"status":"PLANNED","fingerprint":"fd938655dc56997032bec10031b27fc51bcb626640a7543a84b1494313207fca"},
    {"id":"2371bf8f-2459-4dbc-9aa2-6b823e2ba69b","batch_index":5,"status":"PLANNED","fingerprint":"00f179b142c1b453bfa584f67c50913744c971fbc6ff52a28bcbf7e02f307d58"},
    {"id":"e36c810e-e7a4-4f9e-ab81-2619e3cfd8e3","batch_index":6,"status":"PLANNED","fingerprint":"77a42411a8f62393c0620d02f0c5a79421088d0da5e5a777c0fbc8d2ac1cf1a4"},
    {"id":"60379a1a-45a3-4e5a-9d3f-7cfa7302b7e6","batch_index":7,"status":"PLANNED","fingerprint":"184a76a4c68aa6a6c514fbafba953f85e4f925f975412b5f97fd594bc6345803"},
    {"id":"f568a871-4e02-4905-9178-e75615d7e023","batch_index":8,"status":"PLANNED","fingerprint":"d15b166e1d167d6857a6ff48d97b600a1ed18b83c2448f7c93da3b6004f0c342"},
    {"id":"2fcd50f1-9aee-4f00-85b0-057c384e5e9d","batch_index":9,"status":"PLANNED","fingerprint":"45ae96cfe6955ad2cfe9bf3bac86c266b050ab495b2af2c9abe1346fc2bc1fb1"},
    {"id":"d9bcd25a-5bf3-4064-b607-2b18800fd424","batch_index":10,"status":"PLANNED","fingerprint":"fc9447f8f38d918300128f482a30b0101df10c9bc73c31d52842140c9d15687a"}
  ]'::jsonb;
  v_manifest jsonb;
  v_actions jsonb;
begin
  if session_user<>'postgres' then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Exact staging renewal requires the existing administrative route');
  end if;
  if not public.atomic_import_has_exact_keys(p_request,array[
       'schema_version','parent_plan_id','parent_plan_fingerprint','manifest_fingerprint',
       'source_snapshot_fingerprint','retailer_id','source_country','reason','renewed_by',
       'new_expires_at','staging_project_ref','staging_database_identity'])
     or p_request->>'schema_version'<>'1'
     or p_request->>'parent_plan_id'<>'be94ac00-4f61-44f8-8e2e-1aa4ae4dc6ba'
     or p_request->>'parent_plan_fingerprint'<>'752a8bf3c12dbd8aafa66b4bac8b0df6cb08056161538abe1c3bb83dd391d2cc'
     or p_request->>'manifest_fingerprint'<>'45f2b02b4e89186930fcad503379d3f6f35dc3539d71d3962efa4190e72dce3e'
     or p_request->>'source_snapshot_fingerprint'<>'99f3403bbbeebfd3c0cb686839606bb09ede3910b85f4cc77c1dbf1ba29e13de'
     or p_request->>'retailer_id'<>'10'
     or p_request->>'source_country'<>'GB'
     or nullif(trim(p_request->>'reason'),'') is null
     or nullif(trim(p_request->>'renewed_by'),'') is null then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Exact staging renewal request mismatch');
  end if;
  perform public.retailer_catalogue_staging_runtime_guard('STAGING',p_request->>'staging_project_ref',p_request->>'staging_database_identity');
  v_new_expiry := (p_request->>'new_expires_at')::timestamptz;
  if v_new_expiry<now()+interval '10 minutes' or v_new_expiry>now()+interval '45 minutes' then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Exact renewal expiry must be between 10 and 45 minutes');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request->>'parent_plan_id',0));
  select * into v_parent from public.retailer_catalogue_parent_plans
  where id=(p_request->>'parent_plan_id')::uuid for update;
  if not found then
    perform public.retailer_catalogue_raise('RSBI_PARENT_FINGERPRINT_MISMATCH','Exact staging parent is missing');
  end if;
  if exists(select 1 from jsonb_array_elements(v_parent.audit_log) event where event->>'event'='EXACT_STAGING_PARENT_APPROVAL_RENEWED') then
    perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Exact staging parent renewal is single-use');
  end if;
  if v_parent.status<>'PARTIALLY_APPLIED' or v_parent.approval_expires_at>=now()
     or v_parent.retailer_id<>10 or v_parent.target_environment<>'STAGING'
     or v_parent.parent_plan_fingerprint is distinct from p_request->>'parent_plan_fingerprint'
     or v_parent.source_snapshot_fingerprint is distinct from p_request->>'source_snapshot_fingerprint'
     or v_parent.plan_json->>'manifest_fingerprint' is distinct from p_request->>'manifest_fingerprint'
     or v_parent.plan_json->>'source_country'<>'GB'
     or v_parent.plan_json->>'manifest_count'<>'506'
     or jsonb_array_length(v_parent.child_manifest)<>11 then
    perform public.retailer_catalogue_raise('RSBI_PARENT_FINGERPRINT_MISMATCH','Exact expired staging parent state mismatch');
  end if;
  if public.retailer_catalogue_sha256_json(v_parent.plan_json-array['parent_plan_fingerprint','manifest_count','expected_deltas']) is distinct from v_parent.parent_plan_fingerprint then
    perform public.retailer_catalogue_raise('RSBI_PARENT_FINGERPRINT_MISMATCH','Recomputed parent hash mismatch');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id::text,'batch_index',c.batch_index,'status',c.status,'fingerprint',c.child_plan_fingerprint
  ) order by c.batch_index),'[]'::jsonb) into v_children
  from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_parent.id;
  if v_children is distinct from v_expected_children
     or exists(select 1 from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_parent.id and (
       c.batch_count<>11 or c.retailer_id<>10 or c.target_environment<>'STAGING'
       or c.parent_plan_fingerprint<>v_parent.parent_plan_fingerprint
       or c.source_snapshot_fingerprint<>v_parent.source_snapshot_fingerprint
       or c.child_plan_fingerprint<>c.plan_json->>'artifact_fingerprint'
       or c.child_plan_fingerprint<>public.retailer_catalogue_sha256_json(c.plan_json-'artifact_fingerprint')
     )) then
    perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Exact child order, status or payload mismatch');
  end if;

  select coalesce(jsonb_object_agg(action,cnt),'{}'::jsonb) into v_actions from (
    select row->>'action' action,count(*) cnt
    from public.retailer_catalogue_child_plans c
    cross join lateral jsonb_array_elements(c.plan_json->'rows') row
    where c.parent_plan_id=v_parent.id group by row->>'action'
  ) scoped;
  if v_actions is distinct from '{"UPDATE_STOCK":3,"VERIFY_NO_CHANGE":503}'::jsonb
     or exists(
       select 1 from public.retailer_catalogue_child_plans c
       cross join lateral jsonb_array_elements(c.plan_json->'rows') row
       where c.parent_plan_id=v_parent.id and (
         row->>'action' not in ('VERIFY_NO_CHANGE','UPDATE_STOCK')
         or row#>>'{atomic_plan,product,action}'<>'existing'
         or row#>>'{atomic_plan,product_variant,action}'<>'existing'
         or row#>>'{atomic_plan,retailer,action}'<>'existing'
         or row#>>'{atomic_plan,retailer_product,action}' not in ('noop','update')
         or row#>>'{atomic_plan,offer,action}' not in ('update','verify_no_change')
         or row#>>'{atomic_plan,price_history,action}' not in ('noop','create')
       )
     ) then
    perform public.retailer_catalogue_raise('RSBI_ACTION_NOT_ALLOWED','Exact approved business-action scope changed');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'mapping_id',rp.id::text,'offer_id',o.id::text,'external_product_id',rp.external_product_id,'external_variant_id',rp.external_variant_id
  ) order by rp.id),'[]'::jsonb) into v_manifest
  from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id where rp.retailer_id=10;
  if jsonb_array_length(v_manifest)<>506
     or public.retailer_catalogue_sha256_json(v_manifest) is distinct from p_request->>'manifest_fingerprint' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Current Jon''s mapping manifest changed');
  end if;
  if exists(select 1 from public.retailer_catalogue_parent_plans p where p.retailer_id=10 and p.target_environment='STAGING' and p.status in ('PLANNED','APPROVED','PARTIALLY_APPLIED','FAILED') and p.id<>v_parent.id)
     or exists(select 1 from public.retailer_offer_sync_batch_approvals a where a.consumed_at is null and a.expires_at>now())
     or exists(select 1 from public.approved_import_plans a where a.consumed_at is null and a.expires_at>now())
     or exists(select 1 from public.retailer_catalogue_apply_runs r where r.status='STARTED') then
    perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Active approval, run or conflicting parent exists');
  end if;

  v_old_approval_id:=v_parent.approval_id;
  v_old_expiry:=v_parent.approval_expires_at;
  v_new_approval_id:=gen_random_uuid();
  v_renewal_id:=gen_random_uuid();
  update public.retailer_catalogue_parent_plans set
    approval_id=v_new_approval_id,
    approved_at=now(),
    approval_expires_at=v_new_expiry,
    approval_consumed_at=null,
    updated_at=now(),
    audit_log=audit_log||jsonb_build_array(jsonb_build_object(
      'event','EXACT_STAGING_PARENT_APPROVAL_RENEWED','migration','20260722140000',
      'renewal_id',v_renewal_id,'renewed_by',trim(p_request->>'renewed_by'),'reason',trim(p_request->>'reason'),
      'old_approval_id',v_old_approval_id,'new_approval_id',v_new_approval_id,
      'old_expiry',v_old_expiry,'new_expiry',v_new_expiry,'at',now()
    ))
  where id=v_parent.id;

  return jsonb_build_object(
    'status','RENEWED','renewal_id',v_renewal_id,'parent_plan_id',v_parent.id,
    'parent_status','PARTIALLY_APPLIED','old_expiry',v_old_expiry,'new_expiry',v_new_expiry,
    'old_approval_id',v_old_approval_id,'new_approval_id',v_new_approval_id,
    'parent_plan_fingerprint',v_parent.parent_plan_fingerprint,
    'manifest_fingerprint',v_parent.plan_json->>'manifest_fingerprint',
    'source_snapshot_fingerprint',v_parent.source_snapshot_fingerprint,
    'children_unchanged',11,'business_writes',0,'control_writes',1
  );
end
$renew_exact_parent$;
$exact_staging_renewal_definition$;
  end if;
end
$install_exact_staging_renewal$;

-- Patch the existing approver in place. No parallel approver or wrapper is added.
do $patch_sequential_approver$
declare
  v_function regprocedure := to_regprocedure('public.retailer_offer_sync_approve_batch_unreviewed_internal(jsonb)');
  v_definition text;
  v_old text;
  v_new text;
begin
  if v_function is null then raise exception 'existing unreviewed batch approver is missing'; end if;
  select pg_get_functiondef(v_function) into v_definition;

  v_old := 'v_actual_migration:=public.retailer_catalogue_assert_migration_ledger(v_manifest->''expected_migration_versions'',v_manifest->>''expected_migration_fingerprint'');';
  v_new := 'v_actual_migration:=public.retailer_catalogue_assert_migration_ledger_for_child(v_manifest->''expected_migration_versions'',v_manifest->>''expected_migration_fingerprint'',(p_request->>''child_plan_id'')::uuid);';
  if strpos(v_definition,v_old)=0 then raise exception 'approver migration assertion did not match'; end if;
  v_definition:=replace(v_definition,v_old,v_new);

  v_old := 'v_child.status<>''PLANNED'' or v_parent.status<>''PLANNED'' or';
  v_new := 'v_child.status<>''PLANNED'' or v_parent.status not in (''PLANNED'',''APPROVED'',''PARTIALLY_APPLIED'') or';
  if strpos(v_definition,v_old)=0 then raise exception 'approver parent-state guard did not match'; end if;
  v_definition:=replace(v_definition,v_old,v_new);

  v_old := 'v_execution:=public.retailer_catalogue_sha256_json';
  v_new := $checks$
  if v_parent.status in ('APPROVED','PARTIALLY_APPLIED') then
    if v_parent.approval_id is null or v_parent.approval_expires_at<=now()
       or v_parent.approved_by is distinct from trim(p_request->>'approved_by') then
      perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Parent approval is expired or belongs to another identity');
    end if;
    if v_parent.source_snapshot_fingerprint is distinct from v_child.source_snapshot_fingerprint
       or v_parent.adapter_fingerprint is distinct from v_child.adapter_fingerprint
       or v_parent.policy_fingerprint is distinct from v_child.policy_fingerprint
       or v_parent.code_commit is distinct from v_child.code_commit
       or v_parent.expected_state_fingerprint is distinct from v_child.expected_state_fingerprint
       or v_child.parent_plan_fingerprint is distinct from v_parent.parent_plan_fingerprint then
      perform public.retailer_catalogue_raise('RSBI_PARENT_FINGERPRINT_MISMATCH','Parent and child immutable bindings differ');
    end if;
    if (select count(*) from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_parent.id)<>v_child.batch_count
       or v_child.batch_index<>(select count(*) from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_parent.id and c.status='APPLIED')
       or exists(select 1 from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_parent.id and c.batch_index<v_child.batch_index and c.status<>'APPLIED')
       or exists(select 1 from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_parent.id and c.batch_index>v_child.batch_index and c.status<>'PLANNED') then
      perform public.retailer_catalogue_raise('RSBI_DEPENDENCY_NOT_APPLIED','Child is not the next exact ordinal');
    end if;
    if v_parent.child_manifest->(v_child.batch_index) is null
       or v_parent.child_manifest->(v_child.batch_index)->>'child_plan_id' is distinct from v_child.id::text
       or v_parent.child_manifest->(v_child.batch_index)->>'child_plan_fingerprint' is distinct from v_child.child_plan_fingerprint
       or v_parent.child_manifest->(v_child.batch_index)->>'batch_index' is distinct from v_child.batch_index::text
       or v_parent.child_manifest->(v_child.batch_index)->>'batch_count' is distinct from v_child.batch_count::text
       or v_parent.child_manifest->(v_child.batch_index)->'record_ids' is distinct from v_child.record_ids
       or v_child.child_plan_fingerprint is distinct from public.retailer_catalogue_sha256_json(v_child.plan_json-'artifact_fingerprint') then
      perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Child manifest or payload hash changed');
    end if;
    if exists(select 1 from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_parent.id and a.consumed_at is null and a.expires_at>now()) then
      perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Another active child approval exists');
    end if;
  end if;
  v_execution:=public.retailer_catalogue_sha256_json
$checks$;
  if strpos(v_definition,v_old)=0 then raise exception 'approver execution point did not match'; end if;
  v_definition:=replace(v_definition,v_old,v_new);

  v_old := 'v_parent_approval:=public.approve_retailer_catalogue_parent_plan(v_parent.id,v_parent.parent_plan_fingerprint,trim(p_request->>''approved_by''),(p_request->>''expires_at'')::timestamptz);';
  v_new := $parent_approval$
  if v_parent.status='PLANNED' then
    v_parent_approval:=public.approve_retailer_catalogue_parent_plan(v_parent.id,v_parent.parent_plan_fingerprint,trim(p_request->>'approved_by'),(p_request->>'expires_at')::timestamptz);
  else
    v_parent_approval:=jsonb_build_object('parent_plan_id',v_parent.id,'approval_id',v_parent.approval_id,'status',v_parent.status,'expires_at',v_parent.approval_expires_at,'noop',true);
  end if;
$parent_approval$;
  if strpos(v_definition,v_old)=0 then raise exception 'approver parent approval call did not match'; end if;
  v_definition:=replace(v_definition,v_old,v_new);
  execute v_definition;
end
$patch_sequential_approver$;

-- The executor must accept the same immutable pre-migration binding only for
-- the exact renewed staging child; fresh plans still use the ordinary assertion.
do $patch_sequential_executor$
declare
  v_function regprocedure := to_regprocedure('public.retailer_offer_sync_execute_batch_unreviewed_internal(jsonb)');
  v_definition text;
  v_old text := 'v_actual_migration:=public.retailer_catalogue_assert_migration_ledger(v_approval.expected_migration_versions,v_approval.expected_migration_fingerprint);';
  v_new text := 'v_actual_migration:=public.retailer_catalogue_assert_migration_ledger_for_child(v_approval.expected_migration_versions,v_approval.expected_migration_fingerprint,v_approval.child_plan_id);';
begin
  if v_function is null then raise exception 'existing unreviewed batch executor is missing'; end if;
  select pg_get_functiondef(v_function) into v_definition;
  if strpos(v_definition,v_old)=0 then raise exception 'executor migration assertion did not match'; end if;
  execute replace(v_definition,v_old,v_new);
end
$patch_sequential_executor$;

alter function public.retailer_catalogue_assert_migration_ledger_for_child(jsonb,text,uuid) owner to postgres;

revoke all on function public.retailer_catalogue_assert_migration_ledger_for_child(jsonb,text,uuid)
  from public,anon,authenticated,service_role;

do $least_privilege$
begin
  if to_regprocedure('public.renew_exact_jons_staging_parent_approval(jsonb)') is not null then
    alter function public.renew_exact_jons_staging_parent_approval(jsonb) owner to postgres;
    revoke all on function public.renew_exact_jons_staging_parent_approval(jsonb)
      from public,anon,authenticated,service_role;
    if exists(select 1 from pg_roles where rolname='retailer_catalogue_staging_validator') then
      revoke all on function public.renew_exact_jons_staging_parent_approval(jsonb)
        from retailer_catalogue_staging_validator,retailer_catalogue_staging_approver,retailer_catalogue_staging_executor;
    end if;
    if exists(select 1 from pg_roles where rolname='retailer_catalogue_production_validator') then
      revoke all on function public.renew_exact_jons_staging_parent_approval(jsonb)
        from retailer_catalogue_production_validator,retailer_catalogue_production_approver,retailer_catalogue_production_executor;
    end if;
  end if;
end
$least_privilege$;

commit;
