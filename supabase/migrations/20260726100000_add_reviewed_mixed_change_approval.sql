begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)') is null
     or to_regprocedure('public.retailer_offer_sync_approve_batch_internal(jsonb)') is null
     or to_regprocedure('public.retailer_offer_sync_execute_batch_internal(jsonb)') is null
     or to_regprocedure('public.retailer_offer_sync_validate_manifest(jsonb)') is null
     or to_regprocedure('public.validate_product_import_plan_read_only(jsonb)') is null then
    raise exception 'reviewed mixed-change approval requires the existing retailer offer control plane';
  end if;
  if to_regclass('public.retailer_offer_sync_reviewed_mixed_change_definitions') is not null
     or to_regprocedure('public.retailer_offer_sync_validate_reviewed_mixed_change_contract(jsonb,jsonb,timestamptz)') is not null then
    raise exception 'reviewed mixed-change approval is already installed; rerun rejected';
  end if;
end
$preflight$;

create table public.retailer_offer_sync_reviewed_mixed_change_definitions (
  authorization_id text primary key,
  target_environment text not null check (target_environment in ('STAGING','PRODUCTION')),
  retailer_id bigint not null references public.retailers(id) on delete restrict,
  reviewed_manifest_sha256 text not null check (reviewed_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  reviewed_source_fingerprint text not null check (reviewed_source_fingerprint ~ '^[0-9a-f]{64}$'),
  reviewed_scope_hash text not null check (reviewed_scope_hash ~ '^[0-9a-f]{64}$'),
  row_count integer not null check (row_count between 1 and 100),
  expected_deltas jsonb not null check (jsonb_typeof(expected_deltas)='object'),
  authorized_by text not null check (length(trim(authorized_by)) between 1 and 200),
  authorized_at timestamptz not null default now(),
  unique(target_environment,reviewed_manifest_sha256)
);

create table public.retailer_offer_sync_reviewed_mixed_change_bindings (
  approval_id uuid primary key references public.retailer_offer_sync_batch_approvals(id) on delete restrict,
  authorization_id text not null references public.retailer_offer_sync_reviewed_mixed_change_definitions(authorization_id) on delete restrict,
  reviewed_contract_hash text not null unique check (reviewed_contract_hash ~ '^[0-9a-f]{64}$'),
  artifact_fingerprint text not null check (artifact_fingerprint ~ '^[0-9a-f]{64}$'),
  contract jsonb not null check (jsonb_typeof(contract)='object'),
  status text not null default 'APPROVED' check (status in ('APPROVED','CONSUMED')),
  approved_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint reviewed_mixed_change_consumption check (
    (status='APPROVED' and consumed_at is null)
    or (status='CONSUMED' and consumed_at is not null)
  )
);

create unique index retailer_offer_sync_one_consumed_reviewed_mixed_change
  on public.retailer_offer_sync_reviewed_mixed_change_bindings(authorization_id)
  where status='CONSUMED';

alter table public.retailer_offer_sync_reviewed_mixed_change_definitions owner to postgres;
alter table public.retailer_offer_sync_reviewed_mixed_change_bindings owner to postgres;
alter table public.retailer_offer_sync_reviewed_mixed_change_definitions enable row level security;
alter table public.retailer_offer_sync_reviewed_mixed_change_definitions force row level security;
alter table public.retailer_offer_sync_reviewed_mixed_change_bindings enable row level security;
alter table public.retailer_offer_sync_reviewed_mixed_change_bindings force row level security;
revoke all on table public.retailer_offer_sync_reviewed_mixed_change_definitions from public,anon,authenticated,service_role;
revoke all on table public.retailer_offer_sync_reviewed_mixed_change_bindings from public,anon,authenticated,service_role;

do $register_reviewed_jons_15$
declare
  v_environment text := public.retailer_catalogue_actual_database_target()->>'target_environment';
  v_expected_deltas constant jsonb := '{
    "row_count_deltas":{"products":0,"product_variants":0,"retailer_products":0,"offers":0,"price_history":1},
    "logical_field_deltas":{"offer_price_updates":1,"offer_shipping_updates":0,"offer_total_updates":1,"offer_stock_updates":13,"offer_url_updates":1,"mapping_url_updates":1,"mapping_updated_at_updates":1,"last_checked_at_updates":15}
  }'::jsonb;
begin
  if v_environment not in ('STAGING','PRODUCTION') then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Reviewed mixed-change definition target is not staging or production');
  end if;
  insert into public.retailer_offer_sync_reviewed_mixed_change_definitions(
    authorization_id,target_environment,retailer_id,reviewed_manifest_sha256,
    reviewed_source_fingerprint,reviewed_scope_hash,row_count,expected_deltas,authorized_by)
  values(
    'jons-15-15a1a71238af5fa6-'||lower(v_environment),v_environment,10,
    '15a1a71238af5fa6cb08a334b859230c8cc0944cb2856c0572ef9abbd0c380a5',
    'a27e9a90f0a2e51e4c375da84f9cfb237384ab2b29db2e2c29725f57979831e5',
    '2be0472d80c495cee1b9a930bbbe8537c744d0f0d84ea110ec98ea20693e5f6b',
    15,v_expected_deltas,'user-authorized-targeted-rereview-2026-07-26');
end
$register_reviewed_jons_15$;

-- Clone the current dispatchers, then replace them in place. Keeping the original
-- OIDs means the existing public role-checking wrappers cannot bypass this layer
-- through an old dependency after the migration.
do $clone_current_dispatchers$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)'::regprocedure)
  into v_definition;
  execute replace(
    v_definition,
    'FUNCTION public.retailer_offer_sync_validate_batch_read_only_internal',
    'FUNCTION public.retailer_offer_sync_validate_before_reviewed_mixed');

  select pg_get_functiondef('public.retailer_offer_sync_approve_batch_internal(jsonb)'::regprocedure)
  into v_definition;
  execute replace(
    v_definition,
    'FUNCTION public.retailer_offer_sync_approve_batch_internal',
    'FUNCTION public.retailer_offer_sync_approve_before_reviewed_mixed');

  select pg_get_functiondef('public.retailer_offer_sync_execute_batch_internal(jsonb)'::regprocedure)
  into v_definition;
  execute replace(
    v_definition,
    'FUNCTION public.retailer_offer_sync_execute_batch_internal',
    'FUNCTION public.retailer_offer_sync_execute_before_reviewed_mixed');
end
$clone_current_dispatchers$;

create or replace function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
  p_artifact jsonb,
  p_contract jsonb,
  p_validation_expires_at timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $reviewed$
declare
  v_definition public.retailer_offer_sync_reviewed_mixed_change_definitions%rowtype;
  v_row jsonb;
  v_reviewed_row jsonb;
  v_expected_row_delta jsonb;
  v_price_changed boolean;
  v_stock_changed boolean;
  v_url_changed boolean;
begin
  if not public.atomic_import_has_exact_keys(p_contract,array[
       'schema_version','kind','authorization_id','target_environment','retailer_id',
       'source_country','reviewed_manifest_sha256','reviewed_source_fingerprint',
       'reviewed_scope_hash','reviewed_rows','expected_deltas','source_captured_at',
       'expires_at','artifact_fingerprint','reviewed_contract_hash'])
     or p_contract->>'schema_version'<>'1'
     or p_contract->>'kind'<>'retailer-reviewed-mixed-change-v1'
     or p_contract->>'source_country'<>'GB'
     or jsonb_typeof(p_contract->'reviewed_rows') is distinct from 'array'
     or jsonb_typeof(p_contract->'expected_deltas') is distinct from 'object' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid reviewed mixed-change contract');
  end if;

  select * into v_definition
  from public.retailer_offer_sync_reviewed_mixed_change_definitions
  where authorization_id=p_contract->>'authorization_id';
  if not found
     or v_definition.target_environment is distinct from p_contract->>'target_environment'
     or v_definition.retailer_id::text is distinct from p_contract->>'retailer_id'
     or v_definition.reviewed_manifest_sha256 is distinct from p_contract->>'reviewed_manifest_sha256'
     or v_definition.reviewed_source_fingerprint is distinct from p_contract->>'reviewed_source_fingerprint'
     or v_definition.reviewed_scope_hash is distinct from p_contract->>'reviewed_scope_hash'
     or v_definition.row_count<>jsonb_array_length(p_contract->'reviewed_rows')
     or v_definition.expected_deltas is distinct from p_contract->'expected_deltas' then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Reviewed mixed-change definition mismatch');
  end if;

  if p_contract->>'reviewed_scope_hash'!~'^[0-9a-f]{64}$'
     or public.retailer_catalogue_sha256_json(p_contract->'reviewed_rows') is distinct from p_contract->>'reviewed_scope_hash'
     or p_contract->>'reviewed_contract_hash'!~'^[0-9a-f]{64}$'
     or public.retailer_catalogue_sha256_json(p_contract-'reviewed_contract_hash') is distinct from p_contract->>'reviewed_contract_hash'
     or p_contract->>'target_environment' is distinct from p_artifact->>'target_environment'
     or p_contract->>'retailer_id' is distinct from p_artifact->>'retailer_id'
     or p_contract->>'reviewed_source_fingerprint' is distinct from p_artifact->>'source_snapshot_fingerprint'
     or (p_contract->>'source_captured_at')::timestamptz is distinct from (p_artifact->>'source_captured_at')::timestamptz
     or (p_contract->>'source_captured_at')::timestamptz<now()-interval '15 minutes'
     or (p_contract->>'source_captured_at')::timestamptz>now()+interval '5 minutes'
     or (p_contract->>'expires_at')::timestamptz is distinct from p_validation_expires_at
     or p_validation_expires_at<=now()
     or p_validation_expires_at>now()+interval '15 minutes'
     or p_contract->>'artifact_fingerprint' is distinct from p_artifact->>'artifact_fingerprint'
     or jsonb_array_length(p_artifact->'rows')<>v_definition.row_count
     or p_artifact->'expected_deltas' is distinct from v_definition.expected_deltas then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Reviewed mixed-change immutable binding mismatch');
  end if;

  if exists(
    select 1 from jsonb_array_elements(p_contract->'reviewed_rows') with ordinality row(value,ordinality)
    left join lateral (
      select prior.value
      from jsonb_array_elements(p_contract->'reviewed_rows') with ordinality prior(value,ordinality)
      where prior.ordinality=row.ordinality-1
    ) prior on true
    where not public.atomic_import_has_exact_keys(row.value,array[
      'external_product_id','external_variant_id','action','changed_fields','before','after'])
      or jsonb_typeof(row.value->'changed_fields') is distinct from 'array'
      or not public.atomic_import_has_exact_keys(row.value->'before',array['price','in_stock','url'])
      or not public.atomic_import_has_exact_keys(row.value->'after',array['price','in_stock','url'])
      or (prior.value is not null and (
        (row.value->>'external_product_id')::numeric<(prior.value->>'external_product_id')::numeric
        or ((row.value->>'external_product_id')::numeric=(prior.value->>'external_product_id')::numeric
            and (row.value->>'external_variant_id')::numeric<=(prior.value->>'external_variant_id')::numeric)
      ))
  ) then
    perform public.retailer_catalogue_raise('RSBI_DUPLICATE_IDENTITY','Reviewed mixed-change stable identity scope is invalid');
  end if;

  for v_row in select value from jsonb_array_elements(p_artifact->'rows') loop
    select value into v_reviewed_row
    from jsonb_array_elements(p_contract->'reviewed_rows')
    where value->>'external_product_id'=v_row->>'external_product_id'
      and value->>'external_variant_id'=v_row->>'external_variant_id';
    if not found then
      perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Artifact row is outside reviewed Shopify identity scope');
    end if;

    v_price_changed:=v_reviewed_row#>>'{before,price}' is distinct from v_reviewed_row#>>'{after,price}';
    v_stock_changed:=(v_reviewed_row#>>'{before,in_stock}')::boolean is distinct from (v_reviewed_row#>>'{after,in_stock}')::boolean;
    v_url_changed:=v_reviewed_row#>>'{before,url}' is distinct from v_reviewed_row#>>'{after,url}';
    v_expected_row_delta:=jsonb_build_object(
      'row_count_deltas',jsonb_build_object(
        'products',0,'product_variants',0,'retailer_products',0,'offers',0,
        'price_history',case when v_price_changed then 1 else 0 end),
      'logical_field_deltas',jsonb_build_object(
        'offer_price_updates',case when v_price_changed then 1 else 0 end,
        'offer_shipping_updates',0,
        'offer_total_updates',case when v_price_changed then 1 else 0 end,
        'offer_stock_updates',case when v_stock_changed then 1 else 0 end,
        'offer_url_updates',case when v_url_changed then 1 else 0 end,
        'mapping_url_updates',case when v_url_changed then 1 else 0 end,
        'mapping_updated_at_updates',case when v_url_changed then 1 else 0 end,
        'last_checked_at_updates',1));

    if v_row->>'action' is distinct from v_reviewed_row->>'action'
       or (v_row->'changed_fields'->>'price')::boolean is distinct from v_price_changed
       or (v_row->'changed_fields'->>'stock')::boolean is distinct from v_stock_changed
       or (v_row->'changed_fields'->>'url')::boolean is distinct from v_url_changed
       or (v_row->'changed_fields'->>'blocked')::boolean is distinct from false
       or v_row->'expected_deltas' is distinct from v_expected_row_delta
       or v_row#>>'{atomic_plan,meta,operation_type}'<>'standard_import'
       or v_row#>>'{atomic_plan,product,action}'<>'existing'
       or v_row#>>'{atomic_plan,product_variant,action}'<>'existing'
       or v_row#>>'{atomic_plan,retailer,action}'<>'existing'
       or v_row#>>'{atomic_plan,retailer,id}' is distinct from v_definition.retailer_id::text
       or v_row#>>'{atomic_plan,retailer_product,action}' is distinct from (case when v_url_changed then 'update' else 'noop' end)
       or v_row#>>'{atomic_plan,retailer_product,id}' is distinct from v_row->>'retailer_product_id'
       or v_row#>>'{atomic_plan,offer,action}'<>'update'
       or v_row#>>'{atomic_plan,offer,id}' is distinct from v_row->>'offer_id'
       or v_row#>>'{atomic_plan,expected_state,offer,price}' is distinct from v_reviewed_row#>>'{before,price}'
       or (v_row#>>'{atomic_plan,expected_state,offer,in_stock}')::boolean is distinct from (v_reviewed_row#>>'{before,in_stock}')::boolean
       or v_row#>>'{atomic_plan,expected_state,offer,url}' is distinct from v_reviewed_row#>>'{before,url}'
       or v_row#>>'{atomic_plan,offer,values,price}' is distinct from v_reviewed_row#>>'{after,price}'
       or (v_row#>>'{atomic_plan,offer,values,in_stock}')::boolean is distinct from (v_reviewed_row#>>'{after,in_stock}')::boolean
       or v_row#>>'{atomic_plan,offer,values,url}' is distinct from v_reviewed_row#>>'{after,url}'
       or v_row#>>'{atomic_plan,offer,values,shipping_cost}' is distinct from v_row#>>'{atomic_plan,expected_state,offer,shipping_cost}'
       or (v_row#>>'{atomic_plan,offer,values,total_price}')::numeric is distinct from
          (v_reviewed_row#>>'{after,price}')::numeric+(v_row#>>'{atomic_plan,offer,values,shipping_cost}')::numeric
       or v_row#>>'{atomic_plan,retailer_product,values,external_url}' is distinct from v_reviewed_row#>>'{after,url}'
       or v_row#>>'{atomic_plan,price_history,action}' is distinct from (case when v_price_changed then 'create' else 'noop' end)
       or v_row#>>'{atomic_plan,approval,approved}'<>'false'
       or v_row#>>'{atomic_plan,approval,approval_type}'<>'none' then
      perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Reviewed mixed-change row differs from approved before/after values');
    end if;
  end loop;

  return jsonb_build_object(
    'valid',true,'authorization_id',v_definition.authorization_id,
    'reviewed_contract_hash',p_contract->>'reviewed_contract_hash',
    'reviewed_manifest_sha256',v_definition.reviewed_manifest_sha256,
    'row_count',v_definition.row_count);
end
$reviewed$;

create or replace function public.register_reviewed_mixed_change_control_plan(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path=pg_catalog,public,pg_temp
as $register$
declare
  v_effective_role text:=current_setting('role',true);
  v_target text:=p_request->>'target_environment';
  v_project_ref text:=p_request->>'target_project_ref';
  v_database_identity text:=p_request->>'target_database_identity';
  v_retailer_id bigint:=(p_request->>'retailer_id')::bigint;
  v_artifact jsonb:=p_request#>'{children,0,artifact}';
  v_contract jsonb:=p_request->'reviewed_mixed_change_contract';
  v_manifest jsonb:=p_request->'manifest';
  v_manifest_count integer;
  v_operation_count integer;
  v_entry jsonb;
  v_row jsonb;
  v_mapping_id bigint;
  v_offer_id bigint;
  v_previous_mapping_id bigint:=0;
  v_seen_mapping_ids bigint[]:='{}'::bigint[];
  v_seen_offer_ids bigint[]:='{}'::bigint[];
  v_record_ids jsonb:='[]'::jsonb;
  v_parent_id uuid:=(p_request->>'parent_plan_id')::uuid;
  v_child_id uuid:=(p_request#>>'{children,0,child_plan_id}')::uuid;
  v_parent_hash_input jsonb;
  v_parent_fingerprint text;
  v_child_manifest jsonb;
  v_actor text;
begin
  if not public.atomic_import_has_exact_keys(p_request,array[
       'schema_version','kind','target_environment','target_project_ref','target_database_identity',
       'retailer_id','retailer_slug','source_platform','source_domain','source_country',
       'source_snapshot_fingerprint','source_captured_at','manifest','manifest_fingerprint',
       'parent_plan_id','parent_plan_fingerprint','children','code_commit','expires_at',
       'workflow','request_fingerprint','reviewed_mixed_change_contract'])
     or p_request->>'schema_version'<>'1'
     or p_request->>'kind'<>'jons-existing-offer-sync-control-plan-registration'
     or p_request->>'source_platform'<>'SHOPIFY'
     or p_request->>'source_country'<>'GB'
     or p_request->>'retailer_slug'<>'jon-s-supplements'
     or v_retailer_id<>10
     or jsonb_typeof(p_request->'workflow') is distinct from 'object'
     or jsonb_typeof(p_request->'children') is distinct from 'array'
     or jsonb_array_length(p_request->'children')<>1
     or not public.atomic_import_has_exact_keys(p_request->'children'->0,array['child_plan_id','artifact'])
     or p_request->>'request_fingerprint'!~'^[0-9a-f]{64}$'
     or public.retailer_catalogue_sha256_json(jsonb_set(p_request,'{request_fingerprint}','null'::jsonb,false))
        is distinct from p_request->>'request_fingerprint' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid reviewed mixed-change control registration');
  end if;

  if v_target='STAGING' then
    if v_effective_role<>'retailer_catalogue_staging_validator'
       or session_user<>'supplementscout_staging_validator_login'
       or v_project_ref<>'hxnrsyyqffztlvcrtgbf'
       or v_database_identity<>'supplementscout-staging:hxnrsyyqffztlvcrtgbf' then
      perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Reviewed staging registration identity mismatch');
    end if;
    perform public.retailer_catalogue_staging_runtime_guard('STAGING',v_project_ref,v_database_identity);
  elsif v_target='PRODUCTION' then
    if v_effective_role<>'retailer_catalogue_production_validator'
       or session_user<>'supplementscout_production_validator_login'
       or v_project_ref<>'aftboxmrdgyhizicfsfu'
       or v_database_identity<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
      perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Reviewed production registration identity mismatch');
    end if;
    perform public.retailer_catalogue_production_runtime_guard('PRODUCTION',v_project_ref,v_database_identity);
  else
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Reviewed registration target is invalid');
  end if;
  if p_request->>'source_snapshot_fingerprint'!~'^[0-9a-f]{64}$'
     or p_request->>'code_commit'!~'^[0-9a-f]{40}$'
     or (p_request->>'source_captured_at')::timestamptz<now()-interval '15 minutes'
     or (p_request->>'source_captured_at')::timestamptz>now()+interval '5 minutes'
     or (p_request->>'expires_at')::timestamptz<=now()
     or (p_request->>'expires_at')::timestamptz>now()+interval '15 minutes' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_STALE','Reviewed registration source or expiry is invalid');
  end if;

  if jsonb_typeof(v_manifest) is distinct from 'array' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Reviewed full mapping manifest must be an array');
  end if;
  v_manifest_count:=jsonb_array_length(v_manifest);
  if v_manifest_count<>(select count(*) from public.retailer_products where retailer_id=v_retailer_id)
     or v_manifest_count<>(select count(*) from public.offers where retailer_id=v_retailer_id)
     or public.retailer_catalogue_sha256_json(v_manifest) is distinct from p_request->>'manifest_fingerprint' then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Reviewed registration must bind every current retailer mapping and offer');
  end if;
  for v_entry in select value from jsonb_array_elements(v_manifest) loop
    if not public.atomic_import_has_exact_keys(v_entry,array[
         'mapping_id','offer_id','external_product_id','external_variant_id']) then
      perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid reviewed mapping manifest row');
    end if;
    v_mapping_id:=(v_entry->>'mapping_id')::bigint;
    v_offer_id:=(v_entry->>'offer_id')::bigint;
    if v_mapping_id<=v_previous_mapping_id
       or not exists(
         select 1 from public.retailer_products rp
         join public.offers o on o.retailer_product_id=rp.id
         join public.products p on p.id=rp.product_id
         join public.product_variants pv on pv.id=rp.product_variant_id
         where rp.id=v_mapping_id and o.id=v_offer_id
           and rp.retailer_id=v_retailer_id and o.retailer_id=v_retailer_id
           and rp.external_product_id=v_entry->>'external_product_id'
           and rp.external_variant_id=v_entry->>'external_variant_id'
           and o.product_id=rp.product_id and o.product_variant_id=rp.product_variant_id
           and p.is_active and p.merged_into_product_id is null
           and pv.is_active and pv.product_id=p.id) then
      perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Reviewed full manifest identity changed');
    end if;
    v_previous_mapping_id:=v_mapping_id;
  end loop;

  perform public.retailer_offer_sync_validate_manifest(v_artifact);
  perform public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
    v_artifact,v_contract,(p_request->>'expires_at')::timestamptz);
  if v_artifact->>'target_environment' is distinct from v_target
     or v_artifact->>'target_project_ref' is distinct from v_project_ref
     or v_artifact->>'target_database_identity' is distinct from v_database_identity
     or v_artifact->>'source_snapshot_fingerprint' is distinct from p_request->>'source_snapshot_fingerprint'
     or v_artifact->>'source_captured_at' is distinct from p_request->>'source_captured_at'
     or v_artifact->>'code_commit' is distinct from p_request->>'code_commit'
     or v_artifact->>'artifact_fingerprint' is distinct from p_request#>>'{children,0,artifact,artifact_fingerprint}' then
    perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Reviewed child does not bind registration');
  end if;
  v_operation_count:=jsonb_array_length(v_artifact->'rows');
  for v_row in select value from jsonb_array_elements(v_artifact->'rows') loop
    v_mapping_id:=(v_row->>'retailer_product_id')::bigint;
    v_offer_id:=(v_row->>'offer_id')::bigint;
    if v_mapping_id=any(v_seen_mapping_ids) or v_offer_id=any(v_seen_offer_ids)
       or not exists(
         select 1 from jsonb_array_elements(v_manifest) manifest_row
         where (manifest_row->>'mapping_id')::bigint=v_mapping_id
           and (manifest_row->>'offer_id')::bigint=v_offer_id
           and manifest_row->>'external_product_id'=v_row->>'external_product_id'
           and manifest_row->>'external_variant_id'=v_row->>'external_variant_id') then
      perform public.retailer_catalogue_raise('RSBI_DUPLICATE_IDENTITY','Reviewed child scope is duplicated or outside full manifest');
    end if;
    v_seen_mapping_ids:=array_append(v_seen_mapping_ids,v_mapping_id);
    v_seen_offer_ids:=array_append(v_seen_offer_ids,v_offer_id);
    v_record_ids:=v_record_ids||to_jsonb(v_offer_id::text);
  end loop;

  v_parent_hash_input:=jsonb_build_object(
    'schema_version',1,'kind','jons-existing-offer-sync-parent','parent_plan_id',v_parent_id,
    'target_environment',v_target,'target_project_ref',v_project_ref,
    'target_database_identity',v_database_identity,'retailer_id',v_retailer_id::text,
    'source_country','GB','source_snapshot_fingerprint',p_request->>'source_snapshot_fingerprint',
    'source_captured_at',p_request->>'source_captured_at',
    'manifest_fingerprint',p_request->>'manifest_fingerprint',
    'child_plan_ids',jsonb_build_array(v_child_id::text),
    'child_fingerprints',jsonb_build_array(v_artifact->>'artifact_fingerprint'),
    'code_commit',p_request->>'code_commit','expires_at',p_request->>'expires_at',
    'workflow',p_request->'workflow');
  v_parent_fingerprint:=public.retailer_catalogue_sha256_json(v_parent_hash_input);
  if v_parent_fingerprint is distinct from p_request->>'parent_plan_fingerprint' then
    perform public.retailer_catalogue_raise('RSBI_PARENT_FINGERPRINT_MISMATCH','Reviewed parent fingerprint mismatch');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_target||':'||v_retailer_id::text,0));
  if exists(
       select 1 from public.retailer_catalogue_parent_plans
       where retailer_id=v_retailer_id and target_environment=v_target
         and status in ('PLANNED','APPROVED','PARTIALLY_APPLIED','FAILED'))
     or exists(
       select 1 from public.retailer_offer_sync_batch_approvals
       where consumed_at is null and expires_at>now())
     or exists(
       select 1 from public.approved_import_plans
       where consumed_at is null and expires_at>now())
     or exists(
       select 1 from public.retailer_catalogue_apply_runs where status='STARTED') then
    perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Active control state blocks reviewed registration');
  end if;

  v_child_manifest:=jsonb_build_array(jsonb_build_object(
    'child_plan_id',v_child_id,'parent_plan_id',v_parent_id,
    'child_plan_fingerprint',v_artifact->>'artifact_fingerprint',
    'batch_index',0,'batch_count',1,
    'dependency_group','reviewed-mixed-change:'||(v_contract->>'authorization_id'),
    'rollback_group','reviewed-mixed-change:'||(v_contract->>'authorization_id'),
    'record_ids',v_record_ids,'expected_deltas',v_artifact->'expected_deltas'));
  v_actor:='github:'||(p_request#>>'{workflow,repository}')||':'||
    (p_request#>>'{workflow,run_id}')||':'||(p_request#>>'{workflow,run_attempt}');

  insert into public.retailer_catalogue_parent_plans(
    id,parent_plan_fingerprint,retailer_id,target_environment,source_snapshot_fingerprint,
    canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,
    expected_state_fingerprint,status,expected_deltas,plan_json,child_manifest,
    rollback_manifest,source_captured_at,canonical_snapshot_at,created_by,audit_log)
  values(
    v_parent_id,v_parent_fingerprint,v_retailer_id,v_target,
    p_request->>'source_snapshot_fingerprint',v_artifact->>'expected_state_fingerprint',
    v_artifact->>'adapter_fingerprint',v_artifact->>'policy_fingerprint',
    p_request->>'code_commit',v_artifact->>'expected_state_fingerprint','PLANNED',
    v_artifact->'expected_deltas',
    v_parent_hash_input||jsonb_build_object(
      'parent_plan_fingerprint',v_parent_fingerprint,'manifest_count',v_manifest_count,
      'operation_count',v_operation_count,'expected_deltas',v_artifact->'expected_deltas',
      'reviewed_contract_hash',v_contract->>'reviewed_contract_hash'),
    v_child_manifest,
    jsonb_build_object('kind','MIXED_EXISTING_OFFER_UPDATE','mapping_ids',to_jsonb(v_seen_mapping_ids)),
    (p_request->>'source_captured_at')::timestamptz,now(),v_actor,
    jsonb_build_array(jsonb_build_object(
      'event','REVIEWED_MIXED_CHANGE_PLAN_REGISTERED','at',now(),
      'authorization_id',v_contract->>'authorization_id',
      'reviewed_manifest_sha256',v_contract->>'reviewed_manifest_sha256',
      'operation_count',v_operation_count,'full_mapping_count',v_manifest_count,
      'caller_role',v_effective_role,'workflow',p_request->'workflow')));

  insert into public.retailer_catalogue_child_plans(
    id,parent_plan_id,retailer_id,target_environment,child_plan_fingerprint,
    parent_plan_fingerprint,source_snapshot_fingerprint,canonical_snapshot_fingerprint,
    adapter_fingerprint,policy_fingerprint,code_commit,expected_state_fingerprint,
    batch_index,batch_count,dependency_group,rollback_group,record_ids,status,
    expected_deltas,plan_json,rollback_manifest,audit_log)
  values(
    v_child_id,v_parent_id,v_retailer_id,v_target,v_artifact->>'artifact_fingerprint',
    v_parent_fingerprint,p_request->>'source_snapshot_fingerprint',
    v_artifact->>'expected_state_fingerprint',v_artifact->>'adapter_fingerprint',
    v_artifact->>'policy_fingerprint',p_request->>'code_commit',
    v_artifact->>'expected_state_fingerprint',0,1,
    'reviewed-mixed-change:'||(v_contract->>'authorization_id'),
    'reviewed-mixed-change:'||(v_contract->>'authorization_id'),
    v_record_ids,'PLANNED',v_artifact->'expected_deltas',v_artifact,'[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'event','REVIEWED_MIXED_CHANGE_CHILD_REGISTERED','at',now(),
      'authorization_id',v_contract->>'authorization_id',
      'artifact_fingerprint',v_artifact->>'artifact_fingerprint',
      'operation_count',v_operation_count)));

  return jsonb_build_object(
    'status','REGISTERED','parent_plan_id',v_parent_id,
    'parent_plan_fingerprint',v_parent_fingerprint,
    'child_plan_ids',jsonb_build_array(v_child_id::text),
    'child_fingerprints',jsonb_build_array(v_artifact->>'artifact_fingerprint'),
    'manifest_fingerprint',p_request->>'manifest_fingerprint',
    'source_snapshot_fingerprint',p_request->>'source_snapshot_fingerprint',
    'mapping_count',v_manifest_count,'operation_count',v_operation_count,
    'child_count',1,'target_environment',v_target,'workflow',p_request->'workflow',
    'reviewed_mixed_change',true,'control_writes',2,'business_writes',0);
end
$register$;

create or replace function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(p_request jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $validate$
declare
  v_artifact jsonb:=p_request->'artifact';
  v_contract jsonb:=p_request->'reviewed_mixed_change_contract';
  v_guardrails jsonb:=p_request->'guardrails';
  v_limits jsonb;
  v_contract_result jsonb;
  v_manifest_result jsonb;
  v_row jsonb;
  v_rows jsonb:='[]'::jsonb;
  v_actual_migration text;
  v_actual_batch text;
  v_new_oos integer;
begin
  if not (
    public.atomic_import_has_exact_keys(p_request,array[
      'schema_version','kind','artifact','validation_expires_at','production_project_ref',
      'production_database_identity','expected_migration_versions','expected_migration_fingerprint',
      'migration_fingerprint_algorithm','migration_fingerprint_version','code_commit',
      'source_snapshot_fingerprint','policy_fingerprint','action_manifest_fingerprint',
      'artifact_fingerprint','guardrails','batch_fingerprint','package_fingerprint',
      'reviewed_mixed_change_contract'])
    or public.atomic_import_has_exact_keys(p_request,array[
      'schema_version','kind','artifact','validation_expires_at','staging_project_ref',
      'staging_database_identity','expected_migration_versions','expected_migration_fingerprint',
      'migration_fingerprint_algorithm','migration_fingerprint_version','code_commit',
      'source_snapshot_fingerprint','policy_fingerprint','action_manifest_fingerprint',
      'artifact_fingerprint','guardrails','batch_fingerprint','package_fingerprint',
      'reviewed_mixed_change_contract'])
  ) or p_request->>'schema_version'<>'1'
    or p_request->>'kind'<>'retailer-existing-offer-mixed-batch-read-only-validation'
    or p_request->>'package_fingerprint'!~'^[0-9a-f]{64}$'
    or public.retailer_catalogue_sha256_json(jsonb_set(p_request,'{package_fingerprint}','null'::jsonb,false)) is distinct from p_request->>'package_fingerprint' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid reviewed mixed-change validation package');
  end if;

  if p_request->>'artifact_fingerprint' is distinct from v_artifact->>'artifact_fingerprint'
     or p_request->>'source_snapshot_fingerprint' is distinct from v_artifact->>'source_snapshot_fingerprint'
     or p_request->>'policy_fingerprint' is distinct from v_artifact->>'policy_fingerprint'
     or p_request->>'action_manifest_fingerprint' is distinct from v_artifact->>'action_manifest_fingerprint'
     or p_request->>'code_commit' is distinct from v_artifact->>'code_commit'
     or p_request->'expected_migration_versions' is distinct from v_artifact->'expected_migration_versions'
     or p_request->>'expected_migration_fingerprint' is distinct from v_artifact->>'expected_migration_fingerprint'
     or p_request->>'migration_fingerprint_algorithm' is distinct from v_artifact->>'migration_fingerprint_algorithm'
     or p_request->>'migration_fingerprint_version' is distinct from v_artifact->>'migration_fingerprint_version' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Reviewed mixed-change validation bindings mismatch');
  end if;
  if (v_artifact->>'target_environment'='PRODUCTION' and (
        p_request->>'production_project_ref' is distinct from v_artifact->>'target_project_ref'
        or p_request->>'production_database_identity' is distinct from v_artifact->>'target_database_identity'))
     or (v_artifact->>'target_environment'='STAGING' and (
        p_request->>'staging_project_ref' is distinct from v_artifact->>'target_project_ref'
        or p_request->>'staging_database_identity' is distinct from v_artifact->>'target_database_identity')) then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Reviewed mixed-change target binding mismatch');
  end if;
  if exists(
    select 1 from jsonb_array_elements(v_artifact->'rows') row
    where row.value#>>'{atomic_plan,meta,source_snapshot_sha256}' is distinct from v_artifact->>'source_snapshot_fingerprint'
       or row.value#>>'{atomic_plan,meta,source_captured_at}' is distinct from v_artifact->>'source_captured_at') then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Reviewed mixed-change row source binding mismatch');
  end if;

  v_actual_batch:=public.retailer_catalogue_sha256_json(jsonb_build_object(
    'artifact_fingerprint',v_artifact->>'artifact_fingerprint',
    'action_manifest_fingerprint',v_artifact->>'action_manifest_fingerprint',
    'policy_fingerprint',v_artifact->>'policy_fingerprint',
    'source_snapshot_fingerprint',v_artifact->>'source_snapshot_fingerprint',
    'row_count',jsonb_array_length(v_artifact->'rows'),'rows',v_artifact->'rows'));
  if p_request->>'batch_fingerprint' is distinct from v_actual_batch then
    perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Reviewed mixed-change batch fingerprint mismatch');
  end if;

  if not public.atomic_import_has_exact_keys(v_guardrails,array[
       'schema_version','policy_fingerprint','source_product_count','previous_source_product_count',
       'required_source_rows','matched_source_rows','new_oos_count','total_oos_count',
       'previous_oos_count','changed_row_count','price_changed_row_count','price_anomaly_count',
       'limits','result'])
     or v_guardrails->>'schema_version'<>'1'
     or v_guardrails->>'policy_fingerprint' is distinct from p_request->>'policy_fingerprint'
     or v_guardrails->>'result'<>'BLOCK' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Reviewed mixed-change requires blocked ordinary guard evidence');
  end if;
  v_limits:=v_guardrails->'limits';
  if not public.atomic_import_has_exact_keys(v_limits,array[
       'minimum_source_count_ratio','maximum_new_oos_count','maximum_oos_increase_ratio',
       'maximum_total_oos_ratio','maximum_changed_record_ratio','mass_price_change_ratio',
       'price_anomaly_ratio','price_anomaly_absolute_gbp'])
     or (v_limits->>'minimum_source_count_ratio')::numeric not between 0.90 and 1
     or (v_limits->>'maximum_new_oos_count')::integer not between 0 and 3
     or (v_limits->>'maximum_oos_increase_ratio')::numeric not between 0 and 0.15
     or (v_limits->>'maximum_total_oos_ratio')::numeric not between 0 and 0.35
     or (v_limits->>'maximum_changed_record_ratio')::numeric not between 0 and 0.25
     or (v_limits->>'mass_price_change_ratio')::numeric<=0
     or (v_limits->>'mass_price_change_ratio')::numeric>0.20
     or (v_limits->>'price_anomaly_ratio')::numeric<=0
     or (v_limits->>'price_anomaly_ratio')::numeric>0.60
     or (v_limits->>'price_anomaly_absolute_gbp')::numeric<=0
     or (v_limits->>'price_anomaly_absolute_gbp')::numeric>20 then
    perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','Reviewed mixed-change cannot weaken ordinary limits');
  end if;
  select count(*) filter(where (value#>>'{atomic_plan,expected_state,offer,in_stock}')::boolean
                              and not (value#>>'{atomic_plan,offer,values,in_stock}')::boolean)
  into v_new_oos from jsonb_array_elements(v_artifact->'rows');
  if (v_guardrails->>'source_product_count')::integer<=0
     or (v_guardrails->>'previous_source_product_count')::integer<=0
     or (v_guardrails->>'source_product_count')::numeric/(v_guardrails->>'previous_source_product_count')::numeric
        <(v_limits->>'minimum_source_count_ratio')::numeric
     or (v_guardrails->>'required_source_rows')::integer<>jsonb_array_length(v_artifact->'rows')
     or (v_guardrails->>'matched_source_rows')::integer<>jsonb_array_length(v_artifact->'rows')
     or (v_guardrails->>'changed_row_count')::integer<>jsonb_array_length(v_artifact->'rows')
     or (v_guardrails->>'new_oos_count')::integer<>v_new_oos
     or v_new_oos<=(v_limits->>'maximum_new_oos_count')::integer then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Reviewed mixed-change ordinary MASS_OOS proof mismatch');
  end if;

  v_actual_migration:=public.retailer_catalogue_assert_migration_ledger(
    p_request->'expected_migration_versions',p_request->>'expected_migration_fingerprint');
  v_contract_result:=public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
    v_artifact,v_contract,(p_request->>'validation_expires_at')::timestamptz);
  v_manifest_result:=public.retailer_offer_sync_validate_manifest(v_artifact);
  for v_row in select value from jsonb_array_elements(v_artifact->'rows') order by (value->>'offer_id')::bigint loop
    v_rows:=v_rows||jsonb_build_array(jsonb_build_object(
      'offer_id',v_row->>'offer_id','retailer_product_id',v_row->>'retailer_product_id',
      'action',v_row->>'action','valid',true,'expected_deltas',v_row->'expected_deltas',
      'validator_result',public.validate_product_import_plan_read_only(v_row->'atomic_plan')));
  end loop;
  return jsonb_build_object(
    'valid',true,'status','DRY_RUN_VALIDATED','row_count',jsonb_array_length(v_artifact->'rows'),
    'rows',v_rows,'expected_deltas',v_artifact->'expected_deltas',
    'batch_preview',jsonb_build_object(
      'actions',(select jsonb_object_agg(action,row_count) from (
        select value->>'action' action,count(*) row_count
        from jsonb_array_elements(v_artifact->'rows') group by value->>'action') counts),
      'ordinary_guardrails',v_guardrails,'reviewed_mixed_change_contract',v_contract_result,
      'source_captured_at',v_artifact->>'source_captured_at','batch_fingerprint',v_actual_batch,
      'artifact_fingerprint',v_artifact->>'artifact_fingerprint','actual_migration_fingerprint',v_actual_migration),
    'manifest_validation',v_manifest_result,'business_writes',0,'control_writes',0,
    'validation_expires_at',p_request->>'validation_expires_at');
end
$validate$;

create or replace function public.retailer_offer_sync_validate_batch_read_only_internal(p_request jsonb)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $dispatch$
begin
  if p_request ? 'reviewed_mixed_change_contract' then
    return public.retailer_offer_sync_validate_reviewed_mixed_change_internal(p_request);
  end if;
  return public.retailer_offer_sync_validate_before_reviewed_mixed(p_request);
end
$dispatch$;

create or replace function public.retailer_offer_sync_approve_batch_internal(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $approve$
declare
  v_result jsonb;
  v_contract jsonb;
begin
  if not (p_request ? 'reviewed_mixed_change_contract') then
    return public.retailer_offer_sync_approve_before_reviewed_mixed(p_request);
  end if;
  v_contract:=p_request->'reviewed_mixed_change_contract';
  if not (
    public.atomic_import_has_exact_keys(p_request,array[
      'schema_version','child_plan_id','parent_plan_fingerprint','child_plan_fingerprint',
      'artifact','execution_fingerprint','expected_migration_versions','expected_migration_fingerprint',
      'migration_fingerprint_algorithm','migration_fingerprint_version','approved_by','expires_at',
      'production_project_ref','production_database_identity','reviewed_mixed_change_contract'])
    or public.atomic_import_has_exact_keys(p_request,array[
      'schema_version','child_plan_id','parent_plan_fingerprint','child_plan_fingerprint',
      'artifact','execution_fingerprint','expected_migration_versions','expected_migration_fingerprint',
      'migration_fingerprint_algorithm','migration_fingerprint_version','approved_by','expires_at',
      'staging_project_ref','staging_database_identity','reviewed_mixed_change_contract'])
  ) then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid reviewed mixed-change approval keys');
  end if;
  if exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings
    where authorization_id=v_contract->>'authorization_id' and status='CONSUMED') then
    perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Reviewed mixed-change authorization already consumed');
  end if;
  perform public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
    p_request->'artifact',v_contract,(p_request->>'expires_at')::timestamptz);
  v_result:=public.retailer_offer_sync_approve_before_reviewed_mixed(
    p_request-'reviewed_mixed_change_contract');
  insert into public.retailer_offer_sync_reviewed_mixed_change_bindings(
    approval_id,authorization_id,reviewed_contract_hash,artifact_fingerprint,contract)
  values(
    (v_result->>'approval_id')::uuid,v_contract->>'authorization_id',
    v_contract->>'reviewed_contract_hash',v_contract->>'artifact_fingerprint',v_contract);
  return v_result||jsonb_build_object(
    'reviewed_mixed_change',true,'reviewed_contract_hash',v_contract->>'reviewed_contract_hash');
end
$approve$;

create or replace function public.retailer_offer_sync_execute_batch_internal(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $execute$
declare
  v_review public.retailer_offer_sync_reviewed_mixed_change_bindings%rowtype;
  v_approval public.retailer_offer_sync_batch_approvals%rowtype;
  v_result jsonb;
begin
  select * into v_review
  from public.retailer_offer_sync_reviewed_mixed_change_bindings
  where approval_id=(p_request->>'approval_id')::uuid for update;
  if not found then
    return public.retailer_offer_sync_execute_before_reviewed_mixed(p_request);
  end if;
  if v_review.status<>'APPROVED' or v_review.consumed_at is not null
     or exists(
       select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings
       where authorization_id=v_review.authorization_id and status='CONSUMED') then
    perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Reviewed mixed-change approval already consumed');
  end if;
  select * into v_approval
  from public.retailer_offer_sync_batch_approvals
  where id=v_review.approval_id;
  if not found
     or v_approval.artifact_fingerprint is distinct from v_review.artifact_fingerprint
     or v_approval.approved_manifest->>'artifact_fingerprint' is distinct from v_review.artifact_fingerprint then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Reviewed mixed-change approval binding mismatch');
  end if;
  perform public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
    v_approval.approved_manifest,v_review.contract,v_approval.expires_at);
  v_result:=public.retailer_offer_sync_execute_before_reviewed_mixed(p_request);
  update public.retailer_offer_sync_reviewed_mixed_change_bindings
  set status='CONSUMED',consumed_at=now()
  where approval_id=v_review.approval_id and status='APPROVED';
  if not found then
    perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Reviewed mixed-change authorization consumption failed');
  end if;
  return v_result||jsonb_build_object(
    'reviewed_mixed_change',true,'reviewed_contract_hash',v_review.reviewed_contract_hash);
end
$execute$;

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(jsonb,jsonb,timestamptz) owner to postgres;
alter function public.register_reviewed_mixed_change_control_plan(jsonb) owner to postgres;
alter function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb) owner to postgres;
alter function public.retailer_offer_sync_validate_before_reviewed_mixed(jsonb) owner to postgres;
alter function public.retailer_offer_sync_approve_before_reviewed_mixed(jsonb) owner to postgres;
alter function public.retailer_offer_sync_execute_before_reviewed_mixed(jsonb) owner to postgres;
alter function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb) owner to postgres;
alter function public.retailer_offer_sync_approve_batch_internal(jsonb) owner to postgres;
alter function public.retailer_offer_sync_execute_batch_internal(jsonb) owner to postgres;

revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(jsonb,jsonb,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.register_reviewed_mixed_change_control_plan(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.retailer_offer_sync_validate_before_reviewed_mixed(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.retailer_offer_sync_approve_before_reviewed_mixed(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.retailer_offer_sync_execute_before_reviewed_mixed(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.retailer_offer_sync_approve_batch_internal(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.retailer_offer_sync_execute_batch_internal(jsonb) from public,anon,authenticated,service_role;

do $least_privilege$
begin
  if exists(select 1 from pg_roles where rolname='retailer_catalogue_staging_validator') then
    grant execute on function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)
      to retailer_catalogue_staging_validator;
    grant execute on function public.register_reviewed_mixed_change_control_plan(jsonb)
      to retailer_catalogue_staging_validator;
  end if;
  if exists(select 1 from pg_roles where rolname='retailer_catalogue_production_validator') then
    grant execute on function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)
      to retailer_catalogue_production_validator;
    grant execute on function public.register_reviewed_mixed_change_control_plan(jsonb)
      to retailer_catalogue_production_validator;
  end if;
  if exists(select 1 from pg_roles where rolname='retailer_catalogue_staging_approver') then
    grant execute on function public.retailer_offer_sync_approve_batch_internal(jsonb)
      to retailer_catalogue_staging_approver;
  end if;
  if exists(select 1 from pg_roles where rolname='retailer_catalogue_production_approver') then
    grant execute on function public.retailer_offer_sync_approve_batch_internal(jsonb)
      to retailer_catalogue_production_approver;
  end if;
  if exists(select 1 from pg_roles where rolname='retailer_catalogue_staging_executor') then
    grant execute on function public.retailer_offer_sync_execute_batch_internal(jsonb)
      to retailer_catalogue_staging_executor;
  end if;
  if exists(select 1 from pg_roles where rolname='retailer_catalogue_production_executor') then
    grant execute on function public.retailer_offer_sync_execute_batch_internal(jsonb)
      to retailer_catalogue_production_executor;
  end if;
end
$least_privilege$;

commit;
