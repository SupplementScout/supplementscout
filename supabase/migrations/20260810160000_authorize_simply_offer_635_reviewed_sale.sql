begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $authorize_simply_sale$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Simply offer 635 reviewed sale authorization requires production database owner';
  end if;
  if to_regprocedure('public.retailer_offer_sync_validate_reviewed_commercial_change_v4(jsonb,jsonb,timestamptz)') is null
     or to_regprocedure('public.register_reviewed_mixed_change_control_plan(jsonb)') is null then
    raise exception 'Simply offer 635 reviewed sale control path is missing';
  end if;
  if exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='simply-offer635-sale-20260810-production'
  ) then
    raise exception 'Simply offer 635 reviewed sale authorization already exists';
  end if;
end
$authorize_simply_sale$;

insert into public.retailer_offer_sync_reviewed_mixed_change_definitions(
  authorization_id,target_environment,retailer_id,reviewed_manifest_sha256,
  reviewed_source_fingerprint,reviewed_scope_hash,row_count,expected_deltas,
  authorized_by,contract_version
)
values(
  'simply-offer635-sale-20260810-production','PRODUCTION',7,
  'c1d1c794f39ea955df7c048f4856b6058efbd7df60a6c7e42ef7c057ba5fd1b9',
  '6db3040a902152799bd3e77334ebd32b59f5909f3f5c85902eb0f640173bf689',
  'cc1cbe7bcd4b8530ab7889ca017db250690807475b75329a631538edb413f56d',
  1,
  '{
    "row_count_deltas":{"products":0,"product_variants":0,"retailer_products":0,"offers":0,"price_history":1},
    "logical_field_deltas":{"offer_price_updates":1,"offer_shipping_updates":0,"offer_total_updates":1,"offer_stock_updates":0,"offer_url_updates":0,"mapping_url_updates":0,"mapping_updated_at_updates":0,"last_checked_at_updates":1}
  }'::jsonb,
  'owner-approved-chat-2026-08-10-after-exact-identity-and-price-review',4
);

do $verify_simply_sale$
begin
  if not exists(
    select 1
    from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='simply-offer635-sale-20260810-production'
      and target_environment='PRODUCTION'
      and retailer_id=7
      and reviewed_manifest_sha256='c1d1c794f39ea955df7c048f4856b6058efbd7df60a6c7e42ef7c057ba5fd1b9'
      and reviewed_source_fingerprint='6db3040a902152799bd3e77334ebd32b59f5909f3f5c85902eb0f640173bf689'
      and reviewed_scope_hash='cc1cbe7bcd4b8530ab7889ca017db250690807475b75329a631538edb413f56d'
      and row_count=1
      and contract_version=4
  ) then
    raise exception 'Simply offer 635 reviewed sale authorization verification failed';
  end if;
end
$verify_simply_sale$;

commit;
