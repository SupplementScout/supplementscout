begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)') is null
     or to_regprocedure('public.validate_verified_offer_no_change_plan(jsonb)') is null
     or to_regprocedure('public.begin_retailer_catalogue_child_apply(uuid,text,text,text,text,text,text,text,text,text)') is null
     or to_regprocedure('public.retailer_catalogue_staging_runtime_guard(text,text,text)') is null
     or to_regclass('public.retailer_catalogue_staging_recovery_manifests') is null then
    raise exception 'retailer offer mixed-batch executor requires atomic, verified no-change, Phase 2 and staging executor migrations';
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
  target_environment text not null check(target_environment='STAGING'),
  project_ref text not null check(project_ref='hxnrsyyqffztlvcrtgbf'),
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
revoke all on table public.retailer_offer_sync_batch_approvals from public,anon,authenticated,service_role,retailer_catalogue_staging_approver,retailer_catalogue_staging_executor;

alter table public.retailer_catalogue_staging_recovery_manifests
  add column mixed_batch_artifact_fingerprint text check(mixed_batch_artifact_fingerprint is null or mixed_batch_artifact_fingerprint ~ '^[0-9a-f]{64}$'),
  add column mixed_batch_before_state jsonb check(mixed_batch_before_state is null or jsonb_typeof(mixed_batch_before_state)='array'),
  add column mixed_batch_applied_state jsonb check(mixed_batch_applied_state is null or jsonb_typeof(mixed_batch_applied_state)='array'),
  add column mixed_batch_migration_versions jsonb check(mixed_batch_migration_versions is null or jsonb_typeof(mixed_batch_migration_versions)='array'),
  add column mixed_batch_expected_migration_fingerprint text check(mixed_batch_expected_migration_fingerprint is null or mixed_batch_expected_migration_fingerprint~'^[0-9a-f]{64}$'),
  add column mixed_batch_migration_fingerprint_algorithm text check(mixed_batch_migration_fingerprint_algorithm is null or mixed_batch_migration_fingerprint_algorithm='SHA-256'),
  add column mixed_batch_migration_fingerprint_version text check(mixed_batch_migration_fingerprint_version is null or mixed_batch_migration_fingerprint_version='RSBI-CJ1'),
  add column mixed_batch_execution_migration_fingerprint text check(mixed_batch_execution_migration_fingerprint is null or mixed_batch_execution_migration_fingerprint~'^[0-9a-f]{64}$');

alter table public.retailer_catalogue_staging_recovery_approvals
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
  if p_manifest->>'kind'<>'retailer-existing-offer-mixed-batch-execution' or p_manifest->>'state'<>'DRY_RUN_READY' or p_manifest->'block'<>'null'::jsonb or p_manifest->>'action_manifest_fingerprint'!~'^[0-9a-f]{64}$' or nullif(p_manifest->>'retailer_slug','') is null or nullif(p_manifest->>'retailer_id','')::bigint is null or p_manifest->>'target_environment'<>'STAGING' or p_manifest->>'target_project_ref'<>'hxnrsyyqffztlvcrtgbf' or p_manifest->>'target_project_ref'='aftboxmrdgyhizicfsfu' or p_manifest->>'target_database_identity'<>'supplementscout-staging:hxnrsyyqffztlvcrtgbf' or p_manifest->>'source_snapshot_fingerprint'!~'^[0-9a-f]{64}$' or p_manifest->>'adapter_fingerprint'!~'^[0-9a-f]{64}$' or p_manifest->>'policy_fingerprint'!~'^[0-9a-f]{64}$' or p_manifest->>'code_commit'!~'^[0-9a-f]{40}$' or p_manifest->>'expected_state_fingerprint'!~'^[0-9a-f]{64}$' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Mixed artifact target or immutable fingerprints are invalid'); end if;
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
  if not public.atomic_import_has_exact_keys(p_request,array['schema_version','child_plan_id','parent_plan_fingerprint','child_plan_fingerprint','artifact','execution_fingerprint','expected_migration_versions','expected_migration_fingerprint','migration_fingerprint_algorithm','migration_fingerprint_version','approved_by','expires_at','staging_project_ref','staging_database_identity']) then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid mixed approval keys');
  end if;
  if p_request->>'schema_version'<>'1' or p_request->>'execution_fingerprint'!~'^[0-9a-f]{64}$' or (p_request->>'expires_at')::timestamptz<=now() or (p_request->>'expires_at')::timestamptz>now()+interval '15 minutes' then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Mixed approval expiry/fingerprint invalid');
  end if;
  perform public.retailer_catalogue_staging_runtime_guard('STAGING',p_request->>'staging_project_ref',p_request->>'staging_database_identity');
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
     or v_manifest->>'target_project_ref' is distinct from p_request->>'staging_project_ref' or v_manifest->>'target_database_identity' is distinct from p_request->>'staging_database_identity' then
    perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Approved child does not exactly bind the artifact');
  end if;
  v_execution:=public.retailer_catalogue_sha256_json(jsonb_build_object('child_plan_id',v_child.id,'artifact_fingerprint',v_manifest->>'artifact_fingerprint','target_environment','STAGING','project_ref',p_request->>'staging_project_ref','database_identity',p_request->>'staging_database_identity','expected_migration_versions',v_manifest->'expected_migration_versions','expected_migration_fingerprint',v_manifest->>'expected_migration_fingerprint','migration_fingerprint_algorithm',v_manifest->>'migration_fingerprint_algorithm','migration_fingerprint_version',v_manifest->>'migration_fingerprint_version'));
  if v_execution is distinct from p_request->>'execution_fingerprint' then perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Execution fingerprint is not deterministic'); end if;
  v_parent_approval:=public.approve_retailer_catalogue_parent_plan(v_parent.id,v_parent.parent_plan_fingerprint,trim(p_request->>'approved_by'),(p_request->>'expires_at')::timestamptz);
  v_child_approval:=public.approve_retailer_catalogue_child_plan(v_child.id,(v_parent_approval->>'approval_id')::uuid,v_parent.parent_plan_fingerprint,v_child.child_plan_fingerprint,(p_request->>'expires_at')::timestamptz);
  insert into public.retailer_offer_sync_batch_approvals(child_plan_id,artifact_fingerprint,execution_fingerprint,target_environment,project_ref,database_identity,expected_migration_versions,expected_migration_fingerprint,migration_fingerprint_algorithm,migration_fingerprint_version,approved_manifest,expected_deltas,approved_by,expires_at)
  values(v_child.id,v_manifest->>'artifact_fingerprint',p_request->>'execution_fingerprint','STAGING',p_request->>'staging_project_ref',p_request->>'staging_database_identity',v_manifest->'expected_migration_versions',v_actual_migration,v_manifest->>'migration_fingerprint_algorithm',v_manifest->>'migration_fingerprint_version',v_manifest,v_manifest->'expected_deltas',trim(p_request->>'approved_by'),(p_request->>'expires_at')::timestamptz) returning id into v_id;
  return jsonb_build_object('approval_id',v_id,'parent_approval_id',v_parent_approval->>'approval_id','child_approval_id',v_child_approval->>'approval_id','child_plan_id',v_child.id,'status','APPROVED','row_count',jsonb_array_length(v_manifest->'rows'),'actual_migration_fingerprint',v_actual_migration,'business_writes',0);
end
$approve$;

create or replace function public.approve_retailer_offer_sync_batch(p_request jsonb)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $approve_wrapper$
begin
  if current_user<>'retailer_catalogue_staging_approver' then raise exception 'mixed-batch approval requires the dedicated approver role'; end if;
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
  if not public.atomic_import_has_exact_keys(p_request,array['schema_version','approval_id','execution_fingerprint','expected_migration_versions','expected_migration_fingerprint','migration_fingerprint_algorithm','migration_fingerprint_version','staging_project_ref','staging_database_identity','requested_at','explicit_allow']) or coalesce((p_request->>'explicit_allow')::boolean,false)=false then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid mixed execution request');
  end if;
  perform public.retailer_catalogue_staging_runtime_guard('STAGING',p_request->>'staging_project_ref',p_request->>'staging_database_identity');
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
  insert into public.retailer_catalogue_staging_recovery_manifests(package_id,package_fingerprint,child_plan_id,apply_run_id,dependency_group,execution_fingerprint,rollback_manifest_fingerprint,created_product_ids,created_variant_ids,created_mapping_ids,created_offer_ids,created_price_history_ids,updated_before_state,ownership,reverse_dependency_order,before_counts,other_retailer_fingerprint,protected_shared_fingerprint,orphan_counts,applied_owned_state_fingerprint,mixed_batch_artifact_fingerprint,mixed_batch_before_state,mixed_batch_applied_state,mixed_batch_migration_versions,mixed_batch_expected_migration_fingerprint,mixed_batch_migration_fingerprint_algorithm,mixed_batch_migration_fingerprint_version,mixed_batch_execution_migration_fingerprint)
  values(v_approval.id,v_approval.artifact_fingerprint,v_child.id,v_run_id,v_child.dependency_group,v_approval.execution_fingerprint,public.retailer_catalogue_sha256_json(jsonb_build_object('before',v_before,'after',v_after,'history',v_history_ids)),'[]','[]','[]','[]',v_history_ids,v_before,jsonb_build_object('kind','MIXED_EXISTING_OFFER_UPDATE','price_history_state',(select coalesce(jsonb_agg(jsonb_build_object('id',ph.id::text,'offer_id',ph.offer_id::text,'price',public.atomic_import_decimal_string(ph.price),'shipping_cost',case when ph.shipping_cost is null then null else to_jsonb(public.atomic_import_decimal_string(ph.shipping_cost)) end,'total_price',case when ph.total_price is null then null else to_jsonb(public.atomic_import_decimal_string(ph.total_price)) end,'checked_at',to_char(ph.checked_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) order by ph.id),'[]'::jsonb) from public.price_history ph where ph.id in(select value::bigint from jsonb_array_elements_text(v_history_ids)))),'[]',v_before_counts,v_other_before,v_protected_before,public.retailer_catalogue_orphan_counts(),public.retailer_catalogue_sha256_json(v_after),v_approval.artifact_fingerprint,v_before,v_after,v_approval.expected_migration_versions,v_approval.expected_migration_fingerprint,v_approval.migration_fingerprint_algorithm,v_approval.migration_fingerprint_version,v_actual_migration) returning id into v_manifest_id;
  v_result:=v_result||jsonb_build_object('recovery_manifest_id',v_manifest_id);
  update public.retailer_offer_sync_batch_approvals set consumed_at=now(),result=v_result where id=v_approval.id;
  return v_result;
end
$execute$;

create or replace function public.execute_retailer_offer_sync_batch(p_request jsonb)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $execute_wrapper$
begin
  if current_user<>'retailer_catalogue_staging_executor' then raise exception 'mixed-batch execution requires the dedicated executor role'; end if;
  return public.retailer_offer_sync_execute_batch_internal(p_request);
end
$execute_wrapper$;

create or replace function public.retailer_offer_sync_approve_recovery_internal(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $approve_recovery$
declare v_manifest public.retailer_catalogue_staging_recovery_manifests%rowtype; v_id uuid; v_actual_migration text;
begin
  if not public.atomic_import_has_exact_keys(p_request,array['schema_version','recovery_manifest_id','rollback_manifest_fingerprint','expected_migration_versions','expected_migration_fingerprint','migration_fingerprint_algorithm','migration_fingerprint_version','original_execution_migration_fingerprint','approved_by','expires_at','staging_project_ref','staging_database_identity']) then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid mixed recovery approval'); end if;
  if (p_request->>'expires_at')::timestamptz<=now() or (p_request->>'expires_at')::timestamptz>now()+interval '15 minutes' then perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Recovery approval expiry must be within 15 minutes'); end if;
  perform public.retailer_catalogue_staging_runtime_guard('STAGING',p_request->>'staging_project_ref',p_request->>'staging_database_identity');
  select * into v_manifest from public.retailer_catalogue_staging_recovery_manifests where id=(p_request->>'recovery_manifest_id')::uuid and mixed_batch_artifact_fingerprint is not null for update;
  if not found or v_manifest.status<>'READY' or v_manifest.rollback_manifest_fingerprint is distinct from p_request->>'rollback_manifest_fingerprint' then perform public.retailer_catalogue_raise('RSBI_ROLLBACK_OWNERSHIP_CONFLICT','Mixed recovery manifest mismatch'); end if;
  if p_request->'expected_migration_versions' is distinct from v_manifest.mixed_batch_migration_versions
     or p_request->>'expected_migration_fingerprint' is distinct from v_manifest.mixed_batch_expected_migration_fingerprint
     or p_request->>'migration_fingerprint_algorithm' is distinct from v_manifest.mixed_batch_migration_fingerprint_algorithm
     or p_request->>'migration_fingerprint_version' is distinct from v_manifest.mixed_batch_migration_fingerprint_version
     or p_request->>'original_execution_migration_fingerprint' is distinct from v_manifest.mixed_batch_execution_migration_fingerprint then perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Mixed recovery migration binding mismatch'); end if;
  v_actual_migration:=public.retailer_catalogue_assert_migration_ledger(v_manifest.mixed_batch_migration_versions,v_manifest.mixed_batch_expected_migration_fingerprint);
  if v_actual_migration is distinct from v_manifest.mixed_batch_execution_migration_fingerprint then perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Migration ledger changed since original execution'); end if;
  insert into public.retailer_catalogue_staging_recovery_approvals(recovery_manifest_id,package_id,package_fingerprint,project_ref,database_identity,child_plan_id,execution_fingerprint,rollback_manifest_fingerprint,expected_recovery_state,expected_recovery_state_fingerprint,approved_by,expires_at,mixed_batch_expected_migration_versions,mixed_batch_expected_migration_fingerprint,mixed_batch_migration_fingerprint_algorithm,mixed_batch_migration_fingerprint_version,mixed_batch_original_execution_migration_fingerprint)
  values(v_manifest.id,v_manifest.package_id,v_manifest.package_fingerprint,p_request->>'staging_project_ref',p_request->>'staging_database_identity',v_manifest.child_plan_id,v_manifest.execution_fingerprint,v_manifest.rollback_manifest_fingerprint,v_manifest.mixed_batch_before_state,public.retailer_catalogue_sha256_json(v_manifest.mixed_batch_before_state),trim(p_request->>'approved_by'),(p_request->>'expires_at')::timestamptz,v_manifest.mixed_batch_migration_versions,v_manifest.mixed_batch_expected_migration_fingerprint,v_manifest.mixed_batch_migration_fingerprint_algorithm,v_manifest.mixed_batch_migration_fingerprint_version,v_manifest.mixed_batch_execution_migration_fingerprint) returning id into v_id;
  return jsonb_build_object('recovery_approval_id',v_id,'status','APPROVED','actual_migration_fingerprint',v_actual_migration,'business_writes',0);
end
$approve_recovery$;

create or replace function public.approve_retailer_offer_sync_recovery(p_request jsonb)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $approve_recovery_wrapper$
begin
  if current_user<>'retailer_catalogue_staging_approver' then raise exception 'mixed recovery approval requires dedicated approver role'; end if;
  return public.retailer_offer_sync_approve_recovery_internal(p_request);
end
$approve_recovery_wrapper$;

create or replace function public.retailer_offer_sync_recover_batch_internal(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $recover$
declare v_approval public.retailer_catalogue_staging_recovery_approvals%rowtype; v_manifest public.retailer_catalogue_staging_recovery_manifests%rowtype; v_row jsonb; v_current jsonb; v_child public.retailer_catalogue_child_plans%rowtype; v_parent public.retailer_catalogue_parent_plans%rowtype; v_original public.retailer_catalogue_apply_runs%rowtype; v_recovery_run uuid; v_attempt integer; v_parent_status text; v_history_actual jsonb; v_actual_migration text;
begin
  if not public.atomic_import_has_exact_keys(p_request,array['schema_version','recovery_approval_id','expected_migration_versions','expected_migration_fingerprint','migration_fingerprint_algorithm','migration_fingerprint_version','original_execution_migration_fingerprint','staging_project_ref','staging_database_identity','explicit_allow']) or coalesce((p_request->>'explicit_allow')::boolean,false)=false then perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid mixed recovery request'); end if;
  perform public.retailer_catalogue_staging_runtime_guard('STAGING',p_request->>'staging_project_ref',p_request->>'staging_database_identity');
  select * into v_approval from public.retailer_catalogue_staging_recovery_approvals where id=(p_request->>'recovery_approval_id')::uuid for update;
  if not found then perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Recovery approval missing'); end if;
  if p_request->'expected_migration_versions' is distinct from v_approval.mixed_batch_expected_migration_versions
     or p_request->>'expected_migration_fingerprint' is distinct from v_approval.mixed_batch_expected_migration_fingerprint
     or p_request->>'migration_fingerprint_algorithm' is distinct from v_approval.mixed_batch_migration_fingerprint_algorithm
     or p_request->>'migration_fingerprint_version' is distinct from v_approval.mixed_batch_migration_fingerprint_version
     or p_request->>'original_execution_migration_fingerprint' is distinct from v_approval.mixed_batch_original_execution_migration_fingerprint then perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Mixed recovery execution migration binding mismatch'); end if;
  v_actual_migration:=public.retailer_catalogue_assert_migration_ledger(v_approval.mixed_batch_expected_migration_versions,v_approval.mixed_batch_expected_migration_fingerprint);
  if v_actual_migration is distinct from v_approval.mixed_batch_original_execution_migration_fingerprint then perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Migration ledger changed since original execution'); end if;
  if v_approval.consumed_at is not null or v_approval.expires_at<=now() then perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Recovery approval expired or consumed'); end if;
  select * into v_manifest from public.retailer_catalogue_staging_recovery_manifests where id=v_approval.recovery_manifest_id for update;
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
  update public.retailer_catalogue_staging_recovery_approvals set consumed_at=now() where id=v_approval.id; update public.retailer_catalogue_staging_recovery_manifests set status='RECOVERED',recovered_at=now() where id=v_manifest.id;
  update public.retailer_catalogue_child_plans set status='ROLLED_BACK',updated_at=now() where id=v_child.id; update public.retailer_catalogue_apply_runs set status='ROLLED_BACK',after_counts=public.retailer_catalogue_business_counts(),result_metadata=jsonb_build_object('recovery_manifest_id',v_manifest.id,'exact_post_recovery_validation',true),completed_at=now() where id=v_recovery_run; v_parent_status:=public.retailer_catalogue_recalculate_parent_status(v_parent.id);
  return jsonb_build_object('recovery_status','RECOVERED','recovery_run_id',v_recovery_run,'child_plan_id',v_child.id,'parent_status',v_parent_status,'restored_rows',jsonb_array_length(v_manifest.mixed_batch_before_state),'deleted_price_history',jsonb_array_length(v_manifest.created_price_history_ids),'exact_post_recovery_validation',true);
end
$recover$;

create or replace function public.recover_retailer_offer_sync_batch(p_request jsonb)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,public,pg_temp as $recover_wrapper$
begin
  if current_user<>'retailer_catalogue_staging_executor' then raise exception 'mixed recovery requires dedicated executor role'; end if;
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
revoke all on function public.retailer_offer_sync_validate_manifest(jsonb),public.retailer_offer_sync_row_state(bigint),public.retailer_offer_sync_approve_batch_internal(jsonb),public.retailer_offer_sync_execute_batch_internal(jsonb),public.retailer_offer_sync_approve_recovery_internal(jsonb),public.retailer_offer_sync_recover_batch_internal(jsonb) from public,anon,authenticated,service_role,retailer_catalogue_staging_approver,retailer_catalogue_staging_executor;
revoke all on function public.approve_retailer_offer_sync_batch(jsonb),public.execute_retailer_offer_sync_batch(jsonb),public.approve_retailer_offer_sync_recovery(jsonb),public.recover_retailer_offer_sync_batch(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.approve_retailer_offer_sync_batch(jsonb),public.approve_retailer_offer_sync_recovery(jsonb) to retailer_catalogue_staging_approver;
grant execute on function public.execute_retailer_offer_sync_batch(jsonb),public.recover_retailer_offer_sync_batch(jsonb) to retailer_catalogue_staging_executor;
grant execute on function public.retailer_offer_sync_approve_batch_internal(jsonb),public.retailer_offer_sync_approve_recovery_internal(jsonb) to retailer_catalogue_staging_approver;
grant execute on function public.retailer_offer_sync_execute_batch_internal(jsonb),public.retailer_offer_sync_recover_batch_internal(jsonb) to retailer_catalogue_staging_executor;

commit;
