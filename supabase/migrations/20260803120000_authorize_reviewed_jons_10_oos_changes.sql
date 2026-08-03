begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'
        <>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Jon''s 10-change reviewed authorization requires production database owner';
  end if;
  if to_regprocedure(
    'public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v2(jsonb,jsonb,timestamptz)'
  ) is null
     or not exists(
       select 1
       from information_schema.columns
       where table_schema='public'
         and table_name='retailer_offer_sync_reviewed_mixed_change_definitions'
         and column_name='allowed_unmapped_collisions'
     ) then
    raise exception 'mapped-scope reviewed approval v3 is not installed';
  end if;
  if exists(
    select 1
    from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='jons-10-3d3dec8e0087adf5-production'
  ) then
    raise exception 'Jon''s 10-change reviewed authorization is already installed; rerun rejected';
  end if;
  if exists(
    select 1
    from public.retailer_offer_sync_reviewed_mixed_change_bindings
    where authorization_id='jons-10-3d3dec8e0087adf5-production'
  ) then
    raise exception 'Jon''s 10-change reviewed authorization already has binding history';
  end if;
end
$preflight$;

insert into public.retailer_offer_sync_reviewed_mixed_change_definitions(
  authorization_id,
  target_environment,
  retailer_id,
  reviewed_manifest_sha256,
  reviewed_source_fingerprint,
  reviewed_scope_hash,
  row_count,
  expected_deltas,
  authorized_by,
  contract_version,
  reviewed_full_source_fingerprint,
  mapped_scope_fingerprint,
  unmapped_source_delta_hash,
  allowed_unmapped_collisions,
  allowed_unmapped_collisions_hash,
  unmapped_drift_policy
)
values(
  'jons-10-3d3dec8e0087adf5-production',
  'PRODUCTION',
  10,
  '3d3dec8e0087adf547b2c7148f7fb1a6745dd342ee75d87993f4a4e9fdc9849c',
  '4dab6298d12bc41273873eca30ce0a2eeba875af210a458653ee11b4448b251f',
  '97babac5e0d0c8a407a566532a3aaaf2b2e115e70bb804887a7296124af9e23c',
  10,
  '{
    "row_count_deltas":{
      "products":0,
      "product_variants":0,
      "retailer_products":0,
      "offers":0,
      "price_history":0
    },
    "logical_field_deltas":{
      "offer_price_updates":0,
      "offer_shipping_updates":0,
      "offer_total_updates":0,
      "offer_stock_updates":10,
      "offer_url_updates":0,
      "mapping_url_updates":0,
      "mapping_updated_at_updates":0,
      "last_checked_at_updates":10
    }
  }'::jsonb,
  'owner-approved-chat-2026-08-03',
  3,
  '4dab6298d12bc41273873eca30ce0a2eeba875af210a458653ee11b4448b251f',
  'f86b07a266790fb991c7e16c93c1d9e554a7c3685c78b8fbbeac8eb3f46e2d43',
  null,
  '[
    {
      "unmapped_external_product_id":"10074974683474",
      "unmapped_external_variant_id":"50781567713618",
      "mapped_external_product_id":"10074965508434",
      "mapped_external_variant_id":"50781523575122",
      "collision_fields":["external_sku"]
    },
    {
      "unmapped_external_product_id":"10716188115282",
      "unmapped_external_variant_id":"53185996980562",
      "mapped_external_product_id":"10716188115282",
      "mapped_external_variant_id":"53221681234258",
      "collision_fields":["external_sku"]
    },
    {
      "unmapped_external_product_id":"10913708048722",
      "unmapped_external_variant_id":"53897264300370",
      "mapped_external_product_id":"10913708048722",
      "mapped_external_variant_id":"53897264202066",
      "collision_fields":["external_sku"]
    },
    {
      "unmapped_external_product_id":"10921949692242",
      "unmapped_external_variant_id":"53925321474386",
      "mapped_external_product_id":"10921949692242",
      "mapped_external_variant_id":"53925321670994",
      "collision_fields":["external_sku"]
    }
  ]'::jsonb,
  '7d61f670d3cbbfd00dac93ec4a9edec8a66f9d6f51b37a81b752b66561fd29d6',
  'ALLOW_UNMAPPED_ADD_REMOVE_WITHOUT_NEW_MAPPED_IDENTITY_COLLISIONS'
);

commit;
