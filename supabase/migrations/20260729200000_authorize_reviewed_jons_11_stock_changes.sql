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
    raise exception 'Jon''s 11-change reviewed authorization requires production database owner';
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
    where authorization_id='jons-11-1d85825cbb358680-production'
  ) then
    raise exception 'Jon''s 11-change reviewed authorization is already installed; rerun rejected';
  end if;
  if exists(
    select 1
    from public.retailer_offer_sync_reviewed_mixed_change_bindings
    where authorization_id='jons-11-1d85825cbb358680-production'
  ) then
    raise exception 'Jon''s 11-change reviewed authorization already has binding history';
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
  'jons-11-1d85825cbb358680-production',
  'PRODUCTION',
  10,
  '1d85825cbb35868090d1b41e3a836ef2545fe29ccb2a940aa93b3838cc13ec9a',
  '55de56ed26bb35ff7332811675c2956924b1bef1699b1b6ad44d5bf6f9867022',
  '92f5edd4c85005ba798fabfc7700253ec5c1961b23555b90c5a0206e33683fdd',
  11,
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
      "offer_stock_updates":11,
      "offer_url_updates":0,
      "mapping_url_updates":0,
      "mapping_updated_at_updates":0,
      "last_checked_at_updates":11
    }
  }'::jsonb,
  'owner-authorized-scheduled-stock-refresh-2026-07-29',
  3,
  '55de56ed26bb35ff7332811675c2956924b1bef1699b1b6ad44d5bf6f9867022',
  '6b92edd1e7f87246b15db6265da3ea53cc51f30c3f5f57cc12add103a161fa35',
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
