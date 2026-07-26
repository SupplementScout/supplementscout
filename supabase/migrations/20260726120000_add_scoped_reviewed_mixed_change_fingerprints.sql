begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.retailer_offer_sync_reviewed_mixed_change_definitions') is null
     or to_regprocedure(
       'public.retailer_offer_sync_validate_reviewed_mixed_change_contract(jsonb,jsonb,timestamptz)'
     ) is null then
    raise exception 'scoped reviewed mixed-change fingerprints require migration 20260726100000';
  end if;
  if exists(
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='retailer_offer_sync_reviewed_mixed_change_definitions'
      and column_name='contract_version'
  ) or to_regprocedure(
    'public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v1(jsonb,jsonb,timestamptz)'
  ) is not null then
    raise exception 'scoped reviewed mixed-change fingerprints are already installed; rerun rejected';
  end if;
end
$preflight$;

alter table public.retailer_offer_sync_reviewed_mixed_change_definitions
  add column contract_version smallint not null default 1
    check (contract_version in (1,2)),
  add column reviewed_full_source_fingerprint text
    check (reviewed_full_source_fingerprint is null
      or reviewed_full_source_fingerprint ~ '^[0-9a-f]{64}$'),
  add column mapped_scope_fingerprint text
    check (mapped_scope_fingerprint is null
      or mapped_scope_fingerprint ~ '^[0-9a-f]{64}$'),
  add column unmapped_source_delta_hash text
    check (unmapped_source_delta_hash is null
      or unmapped_source_delta_hash ~ '^[0-9a-f]{64}$');

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
  jsonb,jsonb,timestamptz
) rename to retailer_offer_sync_validate_reviewed_mixed_change_contract_v1;

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
as $scoped$
declare
  v_definition public.retailer_offer_sync_reviewed_mixed_change_definitions%rowtype;
  v_delta jsonb:=p_contract->'unmapped_source_delta';
  v_legacy jsonb;
  v_result jsonb;
begin
  if p_contract->>'kind'='retailer-reviewed-mixed-change-v1' then
    return public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v1(
      p_artifact,p_contract,p_validation_expires_at);
  end if;

  if not public.atomic_import_has_exact_keys(p_contract,array[
       'schema_version','kind','authorization_id','target_environment','retailer_id',
       'source_country','reviewed_manifest_sha256','reviewed_source_fingerprint',
       'reviewed_scope_hash','reviewed_rows','expected_deltas','source_captured_at',
       'expires_at','artifact_fingerprint','full_source_fingerprint',
       'reviewed_full_source_fingerprint','mapped_scope_fingerprint',
       'mapped_scope_row_count','unmapped_source_delta','unmapped_source_delta_hash',
       'reviewed_change_scope_hash','execution_preconditions','reviewed_contract_hash'])
     or p_contract->>'schema_version'<>'2'
     or p_contract->>'kind'<>'retailer-reviewed-mixed-change-v2'
     or p_contract->>'source_country'<>'GB'
     or jsonb_typeof(p_contract->'reviewed_rows') is distinct from 'array'
     or jsonb_typeof(p_contract->'expected_deltas') is distinct from 'object'
     or jsonb_typeof(p_contract->'execution_preconditions') is distinct from 'array'
     or jsonb_typeof(v_delta) is distinct from 'object' then
    perform public.retailer_catalogue_raise(
      'RSBI_SOURCE_SCHEMA_MISMATCH','Invalid scoped reviewed mixed-change contract');
  end if;

  select * into v_definition
  from public.retailer_offer_sync_reviewed_mixed_change_definitions
  where authorization_id=p_contract->>'authorization_id';
  if not found
     or v_definition.contract_version<>2
     or v_definition.target_environment is distinct from p_contract->>'target_environment'
     or v_definition.retailer_id::text is distinct from p_contract->>'retailer_id'
     or v_definition.reviewed_manifest_sha256 is distinct from p_contract->>'reviewed_manifest_sha256'
     or v_definition.reviewed_source_fingerprint is distinct from p_contract->>'full_source_fingerprint'
     or v_definition.reviewed_full_source_fingerprint
        is distinct from p_contract->>'reviewed_full_source_fingerprint'
     or v_definition.mapped_scope_fingerprint
        is distinct from p_contract->>'mapped_scope_fingerprint'
     or v_definition.unmapped_source_delta_hash
        is distinct from p_contract->>'unmapped_source_delta_hash'
     or v_definition.reviewed_scope_hash is distinct from p_contract->>'reviewed_scope_hash'
     or v_definition.row_count<>jsonb_array_length(p_contract->'reviewed_rows')
     or v_definition.expected_deltas is distinct from p_contract->'expected_deltas' then
    perform public.retailer_catalogue_raise(
      'RSBI_APPROVAL_MISMATCH','Scoped reviewed mixed-change definition mismatch');
  end if;

  if p_contract->>'reviewed_source_fingerprint'
       is distinct from p_contract->>'reviewed_full_source_fingerprint'
     or p_contract->>'full_source_fingerprint'
       is distinct from p_artifact->>'source_snapshot_fingerprint'
     or (p_contract->>'mapped_scope_row_count')::integer<>506
     or p_contract->>'mapped_scope_fingerprint'!~'^[0-9a-f]{64}$'
     or p_contract->>'unmapped_source_delta_hash'!~'^[0-9a-f]{64}$'
     or p_contract->>'reviewed_change_scope_hash'!~'^[0-9a-f]{64}$'
     or p_contract->>'reviewed_contract_hash'!~'^[0-9a-f]{64}$'
     or public.retailer_catalogue_sha256_json(p_contract-'reviewed_contract_hash')
        is distinct from p_contract->>'reviewed_contract_hash'
     or not public.atomic_import_has_exact_keys(v_delta,array[
       'added_products','removed_products','added_variants','removed_variants'])
     or jsonb_typeof(v_delta->'added_products') is distinct from 'array'
     or jsonb_typeof(v_delta->'removed_products') is distinct from 'array'
     or jsonb_typeof(v_delta->'added_variants') is distinct from 'array'
     or jsonb_typeof(v_delta->'removed_variants') is distinct from 'array'
     or public.retailer_catalogue_sha256_json(v_delta)
        is distinct from p_contract->>'unmapped_source_delta_hash'
     or jsonb_array_length(p_contract->'execution_preconditions')<>v_definition.row_count
     or public.retailer_catalogue_sha256_json(jsonb_build_object(
       'reviewed_rows',p_contract->'reviewed_rows',
       'execution_preconditions',p_contract->'execution_preconditions',
       'expected_deltas',p_contract->'expected_deltas'))
        is distinct from p_contract->>'reviewed_change_scope_hash' then
    perform public.retailer_catalogue_raise(
      'RSBI_SOURCE_HASH_MISMATCH','Scoped reviewed mixed-change immutable binding mismatch');
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
      'RSBI_EXPECTED_STATE_MISMATCH','Scoped reviewed execution precondition mismatch');
  end if;

  if exists(
    with product_entries as (
      select value
      from jsonb_array_elements(v_delta->'added_products')
      union all
      select value
      from jsonb_array_elements(v_delta->'removed_products')
    ),
    variant_entries as (
      select
        p.value->>'product_id' product_id,
        variant.value->>'id' variant_id,
        nullif(variant.value->>'sku','') sku,
        nullif(variant.value->>'barcode','') gtin,
        trim(trailing '/' from retailer.website)||'/products/'||
          (p.value#>>'{semantic_product,handle}')||'?variant='||(variant.value->>'id') url
      from product_entries p
      cross join lateral jsonb_array_elements(p.value#>'{semantic_product,variants}') variant
      cross join public.retailers retailer
      where retailer.id=v_definition.retailer_id
      union all
      select
        value->>'product_id',
        value->>'variant_id',
        nullif(value#>>'{semantic_variant,sku}',''),
        nullif(value#>>'{semantic_variant,barcode}',''),
        value->>'url'
      from jsonb_array_elements(v_delta->'added_variants')
      union all
      select
        value->>'product_id',
        value->>'variant_id',
        nullif(value#>>'{semantic_variant,sku}',''),
        nullif(value#>>'{semantic_variant,barcode}',''),
        value->>'url'
      from jsonb_array_elements(v_delta->'removed_variants')
    )
    select 1
    from variant_entries delta_row
    join public.retailer_products mapping
      on mapping.retailer_id=v_definition.retailer_id
     and (
       mapping.external_product_id=delta_row.product_id
       or mapping.external_variant_id=delta_row.variant_id
       or (delta_row.sku is not null and mapping.external_sku=delta_row.sku)
       or (delta_row.gtin is not null and mapping.external_gtin=delta_row.gtin)
       or mapping.external_url=delta_row.url
     )
  ) then
    perform public.retailer_catalogue_raise(
      'RSBI_DUPLICATE_IDENTITY','Unmapped source delta collides with mapped identity');
  end if;

  v_legacy:=p_contract
    -'full_source_fingerprint'
    -'reviewed_full_source_fingerprint'
    -'mapped_scope_fingerprint'
    -'mapped_scope_row_count'
    -'unmapped_source_delta'
    -'unmapped_source_delta_hash'
    -'reviewed_change_scope_hash'
    -'execution_preconditions'
    -'reviewed_contract_hash';
  v_legacy:=v_legacy||jsonb_build_object(
    'schema_version',1,
    'kind','retailer-reviewed-mixed-change-v1',
    'reviewed_source_fingerprint',p_contract->>'full_source_fingerprint');
  v_legacy:=v_legacy||jsonb_build_object(
    'reviewed_contract_hash',public.retailer_catalogue_sha256_json(v_legacy));

  v_result:=public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v1(
    p_artifact,v_legacy,p_validation_expires_at);
  return v_result||jsonb_build_object(
    'contract_version',2,
    'full_source_fingerprint',p_contract->>'full_source_fingerprint',
    'mapped_scope_fingerprint',p_contract->>'mapped_scope_fingerprint',
    'reviewed_change_scope_hash',p_contract->>'reviewed_change_scope_hash',
    'unmapped_source_delta_hash',p_contract->>'unmapped_source_delta_hash');
end
$scoped$;

do $seed_staging_definition$
declare
  v_environment text:=public.retailer_catalogue_actual_database_target()->>'target_environment';
begin
  if v_environment not in ('STAGING','PRODUCTION') then
    perform public.retailer_catalogue_raise(
      'RSBI_ENVIRONMENT_BLOCKED','Scoped reviewed definition target is not staging or production');
  end if;
  if v_environment='STAGING' then
    insert into public.retailer_offer_sync_reviewed_mixed_change_definitions(
      authorization_id,target_environment,retailer_id,reviewed_manifest_sha256,
      reviewed_source_fingerprint,reviewed_scope_hash,row_count,expected_deltas,
      authorized_by,contract_version,reviewed_full_source_fingerprint,
      mapped_scope_fingerprint,unmapped_source_delta_hash
    )
    select
      'jons-15-2b14b0d7b09ab70f-staging','STAGING',10,
      '2b14b0d7b09ab70f41aacb1907bd1718d605cab9fcde0246dc7b7a7f167718c2',
      '8c08e91978adc5640d8eb17d208e2f6b343735abb3f947807da0684a2977690f',
      '2be0472d80c495cee1b9a930bbbe8537c744d0f0d84ea110ec98ea20693e5f6b',
      15,expected_deltas,'user-authorized-scoped-reviewed-fingerprint-fix-2026-07-26',
      2,'a27e9a90f0a2e51e4c375da84f9cfb237384ab2b29db2e2c29725f57979831e5',
      '2cb55c05ae9c4a10f1b8f8943bbf4b16864d10d268dde54b42cb97bf47de722c',
      'f2f4cd3e1cdf07883771a506b1f3ec5bebf41b203dd4bf3567a66c93ef614dce'
    from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='jons-15-15a1a71238af5fa6-staging';
    if not found then
      raise exception 'scoped reviewed mixed-change staging definition seed source is missing';
    end if;
  end if;
end
$seed_staging_definition$;

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v1(
  jsonb,jsonb,timestamptz
) owner to postgres;
alter function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
  jsonb,jsonb,timestamptz
) owner to postgres;

revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v1(
  jsonb,jsonb,timestamptz
) from public,anon,authenticated,service_role;
revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
  jsonb,jsonb,timestamptz
) from public,anon,authenticated,service_role;

commit;
