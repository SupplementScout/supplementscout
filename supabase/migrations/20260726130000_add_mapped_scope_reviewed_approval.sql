begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure(
    'public.retailer_offer_sync_validate_reviewed_mixed_change_contract(jsonb,jsonb,timestamptz)'
  ) is null
     or to_regprocedure(
       'public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v1(jsonb,jsonb,timestamptz)'
     ) is null
     or not exists(
       select 1
       from information_schema.columns
       where table_schema='public'
         and table_name='retailer_offer_sync_reviewed_mixed_change_definitions'
         and column_name='contract_version'
     ) then
    raise exception 'mapped-scope reviewed approval requires migrations 20260726100000 and 20260726120000';
  end if;
  if to_regprocedure(
    'public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v2(jsonb,jsonb,timestamptz)'
  ) is not null
     or exists(
       select 1
       from information_schema.columns
       where table_schema='public'
         and table_name='retailer_offer_sync_reviewed_mixed_change_definitions'
         and column_name='allowed_unmapped_collisions'
     ) then
    raise exception 'mapped-scope reviewed approval is already installed; rerun rejected';
  end if;
end
$preflight$;

do $replace_contract_version_check$
declare
  v_constraint text;
begin
  select c.conname into v_constraint
  from pg_constraint c
  where c.conrelid=
    'public.retailer_offer_sync_reviewed_mixed_change_definitions'::regclass
    and c.contype='c'
    and pg_get_constraintdef(c.oid) like '%contract_version%'
    and pg_get_constraintdef(c.oid) like '%ARRAY[1, 2]%';
  if v_constraint is null then
    raise exception 'reviewed mixed-change contract-version constraint is missing';
  end if;
  execute format(
    'alter table public.retailer_offer_sync_reviewed_mixed_change_definitions drop constraint %I',
    v_constraint);
end
$replace_contract_version_check$;

alter table public.retailer_offer_sync_reviewed_mixed_change_definitions
  add column allowed_unmapped_collisions jsonb,
  add column allowed_unmapped_collisions_hash text
    check (allowed_unmapped_collisions_hash is null
      or allowed_unmapped_collisions_hash ~ '^[0-9a-f]{64}$'),
  add column unmapped_drift_policy text,
  add constraint reviewed_mixed_change_contract_version_check
    check (contract_version in (1,2,3)),
  add constraint reviewed_mixed_change_v3_fields_check
    check (
      (contract_version in (1,2)
        and allowed_unmapped_collisions is null
        and allowed_unmapped_collisions_hash is null
        and unmapped_drift_policy is null)
      or
      (contract_version=3
        and jsonb_typeof(allowed_unmapped_collisions)='array'
        and allowed_unmapped_collisions_hash ~ '^[0-9a-f]{64}$'
        and unmapped_drift_policy=
          'ALLOW_UNMAPPED_ADD_REMOVE_WITHOUT_NEW_MAPPED_IDENTITY_COLLISIONS')
    );

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
  jsonb,jsonb,timestamptz
) rename to retailer_offer_sync_validate_reviewed_mixed_change_contract_v2;

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
as $mapped_scope$
declare
  v_definition public.retailer_offer_sync_reviewed_mixed_change_definitions%rowtype;
  v_unmapped jsonb:=p_contract->'unmapped_identity_rows';
  v_actual_collisions jsonb;
  v_legacy jsonb;
  v_legacy_artifact jsonb;
  v_result jsonb;
begin
  if p_contract->>'kind'<>'retailer-reviewed-mapped-scope-v3' then
    return public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v2(
      p_artifact,p_contract,p_validation_expires_at);
  end if;

  if not public.atomic_import_has_exact_keys(p_contract,array[
       'schema_version','kind','authorization_id','target_environment','retailer_id',
       'source_country','reviewed_manifest_sha256','reviewed_source_fingerprint',
       'reviewed_scope_hash','reviewed_rows','expected_deltas','source_captured_at',
       'expires_at','artifact_fingerprint','full_source_fingerprint',
       'observed_product_count','observed_variant_count','mapped_scope_fingerprint',
       'mapped_scope_row_count','unmapped_identity_rows','unmapped_identity_rows_hash',
       'unmapped_identity_row_count','unmapped_collisions','unmapped_collisions_hash',
       'allowed_unmapped_collisions_hash','unmapped_drift_policy','collision_checks',
       'reviewed_change_scope_hash','execution_preconditions','reviewed_contract_hash'])
     or p_contract->>'schema_version'<>'3'
     or p_contract->>'source_country'<>'GB'
     or jsonb_typeof(p_contract->'reviewed_rows') is distinct from 'array'
     or jsonb_typeof(p_contract->'expected_deltas') is distinct from 'object'
     or jsonb_typeof(p_contract->'execution_preconditions') is distinct from 'array'
     or jsonb_typeof(v_unmapped) is distinct from 'array'
     or jsonb_typeof(p_contract->'unmapped_collisions') is distinct from 'array' then
    perform public.retailer_catalogue_raise(
      'RSBI_SOURCE_SCHEMA_MISMATCH','Invalid mapped-scope reviewed contract');
  end if;

  select * into v_definition
  from public.retailer_offer_sync_reviewed_mixed_change_definitions
  where authorization_id=p_contract->>'authorization_id';
  if not found
     or v_definition.contract_version<>3
     or v_definition.target_environment is distinct from p_contract->>'target_environment'
     or v_definition.retailer_id::text is distinct from p_contract->>'retailer_id'
     or v_definition.reviewed_manifest_sha256
        is distinct from p_contract->>'reviewed_manifest_sha256'
     or v_definition.reviewed_source_fingerprint
        is distinct from p_contract->>'reviewed_source_fingerprint'
     or v_definition.mapped_scope_fingerprint
        is distinct from p_contract->>'mapped_scope_fingerprint'
     or v_definition.allowed_unmapped_collisions_hash
        is distinct from p_contract->>'allowed_unmapped_collisions_hash'
     or v_definition.unmapped_drift_policy
        is distinct from p_contract->>'unmapped_drift_policy'
     or v_definition.reviewed_scope_hash is distinct from p_contract->>'reviewed_scope_hash'
     or v_definition.row_count<>jsonb_array_length(p_contract->'reviewed_rows')
     or v_definition.expected_deltas is distinct from p_contract->'expected_deltas' then
    perform public.retailer_catalogue_raise(
      'RSBI_APPROVAL_MISMATCH','Mapped-scope reviewed definition mismatch');
  end if;

  if p_contract->>'full_source_fingerprint'
       is distinct from p_artifact->>'source_snapshot_fingerprint'
     or p_contract->>'full_source_fingerprint'!~'^[0-9a-f]{64}$'
     or p_contract->>'mapped_scope_fingerprint'!~'^[0-9a-f]{64}$'
     or p_contract->>'unmapped_identity_rows_hash'!~'^[0-9a-f]{64}$'
     or p_contract->>'unmapped_collisions_hash'!~'^[0-9a-f]{64}$'
     or p_contract->>'reviewed_change_scope_hash'!~'^[0-9a-f]{64}$'
     or p_contract->>'reviewed_contract_hash'!~'^[0-9a-f]{64}$'
     or p_contract->>'collision_checks'<>'PASS'
     or p_contract->>'unmapped_drift_policy'<>
        'ALLOW_UNMAPPED_ADD_REMOVE_WITHOUT_NEW_MAPPED_IDENTITY_COLLISIONS'
     or (p_contract->>'observed_product_count')::integer<=0
     or (p_contract->>'observed_variant_count')::integer<=0
     or (p_contract->>'mapped_scope_row_count')::integer<>506
     or (p_contract->>'unmapped_identity_row_count')::integer
        <>jsonb_array_length(v_unmapped)
     or (p_contract->>'observed_variant_count')::integer
        <>(p_contract->>'mapped_scope_row_count')::integer
          +(p_contract->>'unmapped_identity_row_count')::integer
     or public.retailer_catalogue_sha256_json(v_unmapped)
        is distinct from p_contract->>'unmapped_identity_rows_hash'
     or public.retailer_catalogue_sha256_json(p_contract->'unmapped_collisions')
        is distinct from p_contract->>'unmapped_collisions_hash'
     or public.retailer_catalogue_sha256_json(v_definition.allowed_unmapped_collisions)
        is distinct from v_definition.allowed_unmapped_collisions_hash
     or public.retailer_catalogue_sha256_json(p_contract-'reviewed_contract_hash')
        is distinct from p_contract->>'reviewed_contract_hash'
     or jsonb_array_length(p_contract->'execution_preconditions')<>v_definition.row_count
     or public.retailer_catalogue_sha256_json(jsonb_build_object(
       'reviewed_rows',p_contract->'reviewed_rows',
       'execution_preconditions',p_contract->'execution_preconditions',
       'expected_deltas',p_contract->'expected_deltas'))
        is distinct from p_contract->>'reviewed_change_scope_hash' then
    perform public.retailer_catalogue_raise(
      'RSBI_SOURCE_HASH_MISMATCH','Mapped-scope reviewed immutable binding mismatch');
  end if;

  if exists(
    select 1
    from jsonb_array_elements(v_unmapped) row
    where not public.atomic_import_has_exact_keys(row.value,array[
      'external_product_id','external_variant_id','external_sku','external_gtin','url'])
      or row.value->>'external_product_id'!~'^[0-9]+$'
      or row.value->>'external_variant_id'!~'^[0-9]+$'
      or jsonb_typeof(row.value->'url') is distinct from 'string'
      or (row.value->'external_sku'<>'null'::jsonb
        and jsonb_typeof(row.value->'external_sku') is distinct from 'string')
      or (row.value->'external_gtin'<>'null'::jsonb
        and jsonb_typeof(row.value->'external_gtin') is distinct from 'string')
  ) or exists(
    select 1
    from jsonb_array_elements(v_unmapped) row
    group by row.value->>'external_variant_id'
    having count(*)<>1
  ) then
    perform public.retailer_catalogue_raise(
      'RSBI_DUPLICATE_IDENTITY','Invalid or duplicate unmapped source identity');
  end if;

  select coalesce(jsonb_agg(collision order by
    (collision->>'unmapped_external_variant_id')::numeric,
    (collision->>'mapped_external_variant_id')::numeric),'[]'::jsonb)
  into v_actual_collisions
  from (
    select jsonb_build_object(
      'unmapped_external_product_id',unmapped.value->>'external_product_id',
      'unmapped_external_variant_id',unmapped.value->>'external_variant_id',
      'mapped_external_product_id',mapping.external_product_id,
      'mapped_external_variant_id',mapping.external_variant_id,
      'collision_fields',to_jsonb(array_remove(array[
        case when mapping.external_variant_id=unmapped.value->>'external_variant_id'
          then 'external_variant_id' end,
        case when nullif(unmapped.value->>'external_sku','') is not null
          and mapping.external_sku=unmapped.value->>'external_sku'
          then 'external_sku' end,
        case when nullif(unmapped.value->>'external_gtin','') is not null
          and mapping.external_gtin=unmapped.value->>'external_gtin'
          then 'external_gtin' end,
        case when mapping.external_url=unmapped.value->>'url'
          then 'url' end
      ]::text[],null))
    ) collision
    from jsonb_array_elements(v_unmapped) unmapped
    join public.retailer_products mapping
      on mapping.retailer_id=v_definition.retailer_id
     and (
       mapping.external_variant_id=unmapped.value->>'external_variant_id'
       or (nullif(unmapped.value->>'external_sku','') is not null
         and mapping.external_sku=unmapped.value->>'external_sku')
       or (nullif(unmapped.value->>'external_gtin','') is not null
         and mapping.external_gtin=unmapped.value->>'external_gtin')
       or mapping.external_url=unmapped.value->>'url'
     )
  ) collisions;

  if v_actual_collisions is distinct from p_contract->'unmapped_collisions'
     or exists(
       select 1
       from jsonb_array_elements(v_actual_collisions) collision
       where not v_definition.allowed_unmapped_collisions
         @>jsonb_build_array(collision.value)
     ) then
    perform public.retailer_catalogue_raise(
      'RSBI_DUPLICATE_IDENTITY','New unmapped identity collision is not authorized');
  end if;

  if exists(
    select 1
    from jsonb_array_elements(p_contract->'execution_preconditions') pre
    left join lateral (
      select row.value
      from jsonb_array_elements(p_artifact->'rows') row
      where row.value->>'external_product_id'=pre.value->>'external_product_id'
        and row.value->>'external_variant_id'=pre.value->>'external_variant_id'
    ) artifact_row on true
    where not public.atomic_import_has_exact_keys(pre.value,array[
      'external_product_id','external_variant_id','offer_id','retailer_product_id',
      'mapping_updated_at','offer_last_checked_at'])
      or artifact_row.value is null
      or artifact_row.value->>'offer_id' is distinct from pre.value->>'offer_id'
      or artifact_row.value->>'retailer_product_id'
         is distinct from pre.value->>'retailer_product_id'
      or artifact_row.value#>>'{atomic_plan,expected_state,retailer_product,updated_at}'
         is distinct from pre.value->>'mapping_updated_at'
      or artifact_row.value#>>'{atomic_plan,expected_state,offer,last_checked_at}'
         is distinct from pre.value->>'offer_last_checked_at'
  ) then
    perform public.retailer_catalogue_raise(
      'RSBI_EXPECTED_STATE_MISMATCH','Mapped-scope execution precondition mismatch');
  end if;

  v_legacy:=p_contract
    -'full_source_fingerprint'
    -'observed_product_count'
    -'observed_variant_count'
    -'mapped_scope_fingerprint'
    -'mapped_scope_row_count'
    -'unmapped_identity_rows'
    -'unmapped_identity_rows_hash'
    -'unmapped_identity_row_count'
    -'unmapped_collisions'
    -'unmapped_collisions_hash'
    -'allowed_unmapped_collisions_hash'
    -'unmapped_drift_policy'
    -'collision_checks'
    -'reviewed_change_scope_hash'
    -'execution_preconditions'
    -'reviewed_contract_hash';
  v_legacy:=v_legacy||jsonb_build_object(
    'schema_version',1,
    'kind','retailer-reviewed-mixed-change-v1');
  v_legacy:=v_legacy||jsonb_build_object(
    'reviewed_contract_hash',public.retailer_catalogue_sha256_json(v_legacy));
  v_legacy_artifact:=jsonb_set(
    p_artifact,
    '{source_snapshot_fingerprint}',
    to_jsonb(p_contract->>'reviewed_source_fingerprint'),
    false);

  v_result:=public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v1(
    v_legacy_artifact,v_legacy,p_validation_expires_at);
  return v_result||jsonb_build_object(
    'contract_version',3,
    'full_source_fingerprint',p_contract->>'full_source_fingerprint',
    'mapped_scope_fingerprint',p_contract->>'mapped_scope_fingerprint',
    'reviewed_change_scope_hash',p_contract->>'reviewed_change_scope_hash',
    'unmapped_identity_rows_hash',p_contract->>'unmapped_identity_rows_hash',
    'unmapped_collisions_hash',p_contract->>'unmapped_collisions_hash',
    'collision_checks','PASS');
end
$mapped_scope$;

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v2(
  jsonb,jsonb,timestamptz
) owner to postgres;
alter function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
  jsonb,jsonb,timestamptz
) owner to postgres;

revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v2(
  jsonb,jsonb,timestamptz
) from public,anon,authenticated,service_role;
revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
  jsonb,jsonb,timestamptz
) from public,anon,authenticated,service_role;

commit;
