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
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Jon''s 23-OOS reviewed authorization requires production database owner';
  end if;
  if to_regprocedure(
    'public.retailer_offer_sync_validate_reviewed_mixed_change_contract(jsonb,jsonb,timestamptz)'
  ) is null then
    raise exception 'reviewed mixed-change approval v1 is not installed';
  end if;
  if exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='jons-23-563ef072fa3fd68c-production'
  ) or exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings
    where authorization_id='jons-23-563ef072fa3fd68c-production'
  ) then
    raise exception 'Jon''s 23-OOS reviewed authorization already exists';
  end if;
end
$preflight$;

insert into public.retailer_offer_sync_reviewed_mixed_change_definitions(
  authorization_id,target_environment,retailer_id,reviewed_manifest_sha256,
  reviewed_source_fingerprint,reviewed_scope_hash,row_count,expected_deltas,
  authorized_by,contract_version
)
values(
  'jons-23-563ef072fa3fd68c-production','PRODUCTION',10,
  '563ef072fa3fd68c94287eb796aaf8f0ca6163dbe384160a7f7e8f73d40caf4e',
  'cf2b4bf75deecedaae626a323895a3012c99140d2d939b8823915b62af9a1aa3',
  'a10de4b488c1ec0cd6072f78e020127189691cfbfe6ef9df27efe3793965920d',
  23,
  '{
    "row_count_deltas":{
      "products":0,"product_variants":0,"retailer_products":0,
      "offers":0,"price_history":0
    },
    "logical_field_deltas":{
      "offer_price_updates":0,"offer_shipping_updates":0,
      "offer_total_updates":0,"offer_stock_updates":23,
      "offer_url_updates":0,"mapping_url_updates":0,
      "mapping_updated_at_updates":0,"last_checked_at_updates":23
    }
  }'::jsonb,
  'owner-approved-chat-2026-08-10-23-jons-oos',1
);

commit;
