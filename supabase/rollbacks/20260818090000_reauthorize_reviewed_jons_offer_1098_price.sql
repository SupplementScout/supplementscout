begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_function regprocedure:='public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_function);
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or exists(select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings
       where authorization_id='jons-1-6d9a854bc3cdda67-production') then
    raise exception 'Jon''s offer 1098 reauthorization rollback is not permitted';
  end if;
  if not exists(select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
       where authorization_id='jons-1-6d9a854bc3cdda67-production')
     or position($old$authorization_id'='jons-1-6d9a854bc3cdda67-production'$old$ in v_definition)=0 then
    raise exception 'Jon''s offer 1098 reauthorization rollback state mismatch';
  end if;
  execute replace(v_definition,
    $old$authorization_id'='jons-1-6d9a854bc3cdda67-production'$old$,
    $new$authorization_id'='jons-1-dfb4624497699b00-production'$new$);
  delete from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='jons-1-6d9a854bc3cdda67-production';
end
$rollback$;

insert into public.retailer_offer_sync_reviewed_mixed_change_definitions(
  authorization_id,target_environment,retailer_id,reviewed_manifest_sha256,
  reviewed_source_fingerprint,reviewed_scope_hash,row_count,expected_deltas,
  authorized_by,contract_version
)
values(
  'jons-1-dfb4624497699b00-production','PRODUCTION',10,
  'dfb4624497699b00ae1d789df5d22d31464e404b025d36829c3a0e0e3036e86e',
  'c9431f5c3cf0091dbae3d574d6683c6bb1ebb01ea60d42e048aace0490e7b694',
  'e431297f792941134c4e836c56f1b552264bfeaab08aa5f77421975efc90d852',1,
  '{"row_count_deltas":{"products":0,"product_variants":0,"retailer_products":0,"offers":0,"price_history":1},"logical_field_deltas":{"offer_price_updates":1,"offer_shipping_updates":0,"offer_total_updates":1,"offer_stock_updates":0,"offer_url_updates":0,"mapping_url_updates":0,"mapping_updated_at_updates":0,"last_checked_at_updates":1}}'::jsonb,
  'owner-approved-chat-2026-08-18-offer-1098-price-9-99',1
);

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb) owner to postgres;
revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb) from public,anon,authenticated,service_role;

commit;
