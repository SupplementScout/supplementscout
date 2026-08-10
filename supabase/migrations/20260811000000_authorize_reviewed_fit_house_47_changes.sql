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
    raise exception 'Fit House reviewed 47-change authorization requires production database owner';
  end if;
  if exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='fit-house-47-168b5c604482280d-production'
  ) or exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings
    where authorization_id='fit-house-47-168b5c604482280d-production'
  ) then
    raise exception 'Fit House reviewed 47-change authorization already exists';
  end if;
end
$preflight$;

insert into public.retailer_offer_sync_reviewed_mixed_change_definitions(
  authorization_id,target_environment,retailer_id,reviewed_manifest_sha256,
  reviewed_source_fingerprint,reviewed_scope_hash,row_count,expected_deltas,
  authorized_by,contract_version
)
values(
  'fit-house-47-168b5c604482280d-production','PRODUCTION',9,
  '168b5c604482280dc17842b93b9b27c24db42952b0873b14b0b326a6c10883f1',
  '90afc8b4715d56976769ecb490fb00455a028ab2f3e09dd01d33afd7a69ec86d',
  '62149b427ff68668fd4340e4acd84cd7ee66a5aa13ec23b7473a22241b561e5a',
  47,
  '{
    "row_count_deltas":{
      "products":0,"product_variants":0,"retailer_products":0,
      "offers":0,"price_history":3
    },
    "logical_field_deltas":{
      "offer_price_updates":3,"offer_shipping_updates":0,
      "offer_total_updates":3,"offer_stock_updates":45,
      "offer_url_updates":0,"mapping_url_updates":0,
      "mapping_updated_at_updates":0,"last_checked_at_updates":47
    }
  }'::jsonb,
  'owner-approved-chat-2026-08-10-all-three-fit-house-points-47-current-changes',1
);

do $support_fit_house_registration$
declare
  v_function regprocedure:='public.register_reviewed_mixed_change_control_plan(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_function);
  v_old text:=$old$       (p_request->>'kind'='retailer-existing-offer-sync-control-plan-registration'
        and p_request->>'retailer_slug'='simply-supplements'
        and p_request->>'source_domain'='simplysupplements.co.uk'
        and v_retailer_id=7
        and v_contract->>'authorization_id' in (
          'simply-49-2bc798f9fb7db4af-production',
          'simply-offer635-sale-20260810-production'))$old$;
  v_new text:=$new$       (p_request->>'kind'='retailer-existing-offer-sync-control-plan-registration'
        and p_request->>'retailer_slug'='simply-supplements'
        and p_request->>'source_domain'='simplysupplements.co.uk'
        and v_retailer_id=7
        and v_contract->>'authorization_id' in (
          'simply-49-2bc798f9fb7db4af-production',
          'simply-offer635-sale-20260810-production'))
       or
       (v_target='PRODUCTION'
        and p_request->>'kind'='retailer-existing-offer-sync-control-plan-registration'
        and p_request->>'retailer_slug'='fit-house'
        and p_request->>'source_domain'='fithouse.uk'
        and v_retailer_id=9
        and v_contract->>'authorization_id'='fit-house-47-168b5c604482280d-production')$new$;
begin
  if position(v_old in v_definition)=0
     or position('fit-house-47-168b5c604482280d-production' in v_definition)>0 then
    raise exception 'Fit House reviewed registration anchor mismatch';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$support_fit_house_registration$;

alter function public.register_reviewed_mixed_change_control_plan(jsonb) owner to postgres;
revoke all on function public.register_reviewed_mixed_change_control_plan(jsonb)
  from public,anon,authenticated,service_role;

do $verify$
declare
  v_definition text:=pg_get_functiondef(
    'public.register_reviewed_mixed_change_control_plan(jsonb)'::regprocedure);
begin
  if position('fit-house-47-168b5c604482280d-production' in v_definition)=0
     or position($check$p_request->>'retailer_slug'='fit-house'$check$ in v_definition)=0
     or position($check$p_request->>'source_domain'='fithouse.uk'$check$ in v_definition)=0
     or position($check$v_target='PRODUCTION'$check$ in v_definition)=0 then
    raise exception 'Fit House reviewed registration verification failed';
  end if;
end
$verify$;

commit;
