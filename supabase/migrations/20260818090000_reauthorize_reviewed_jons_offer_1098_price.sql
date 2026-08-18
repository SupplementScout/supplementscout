begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $reauthorize$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_function regprocedure:='public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_function);
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Jon''s offer 1098 reauthorization requires production database owner';
  end if;
  if not exists(select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
      where authorization_id='jons-1-dfb4624497699b00-production' and retailer_id=10)
     or exists(select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings
      where authorization_id='jons-1-dfb4624497699b00-production')
     or exists(select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
      where authorization_id='jons-1-6d9a854bc3cdda67-production') then
    raise exception 'Jon''s offer 1098 reauthorization state mismatch';
  end if;
  if position($old$authorization_id'='jons-1-dfb4624497699b00-production'$old$ in v_definition)=0 then
    raise exception 'Jon''s offer 1098 reauthorization validator anchor mismatch';
  end if;
  execute replace(v_definition,
    $old$authorization_id'='jons-1-dfb4624497699b00-production'$old$,
    $new$authorization_id'='jons-1-6d9a854bc3cdda67-production'$new$);
  delete from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='jons-1-dfb4624497699b00-production';
end
$reauthorize$;

insert into public.retailer_offer_sync_reviewed_mixed_change_definitions(
  authorization_id,target_environment,retailer_id,reviewed_manifest_sha256,
  reviewed_source_fingerprint,reviewed_scope_hash,row_count,expected_deltas,
  authorized_by,contract_version
)
values(
  'jons-1-6d9a854bc3cdda67-production','PRODUCTION',10,
  '6d9a854bc3cdda674b3ded7d27eb54f11aa1903bba851024077770e7ac51158e',
  'f5eb4ebdf4d3c1bf7d363a7e741d383aaa9ef6dd383d82ad9662d3c93911df92',
  'e431297f792941134c4e836c56f1b552264bfeaab08aa5f77421975efc90d852',1,
  '{"row_count_deltas":{"products":0,"product_variants":0,"retailer_products":0,"offers":0,"price_history":1},"logical_field_deltas":{"offer_price_updates":1,"offer_shipping_updates":0,"offer_total_updates":1,"offer_stock_updates":0,"offer_url_updates":0,"mapping_url_updates":0,"mapping_updated_at_updates":0,"last_checked_at_updates":1}}'::jsonb,
  'owner-reconfirmed-chat-2026-08-18-after-source-drift-offer-1098-price-9-99',1
);

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb) owner to postgres;
revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb) from public,anon,authenticated,service_role;

commit;
