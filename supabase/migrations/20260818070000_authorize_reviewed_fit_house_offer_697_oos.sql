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
    raise exception 'Fit House reviewed offer 697 authorization requires production database owner';
  end if;
  if exists(select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='fit-house-1-f62ab94e89861f7f-production')
     or exists(select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings
    where authorization_id='fit-house-1-f62ab94e89861f7f-production') then
    raise exception 'Fit House reviewed offer 697 authorization already exists';
  end if;
end
$preflight$;

insert into public.retailer_offer_sync_reviewed_mixed_change_definitions(
  authorization_id,target_environment,retailer_id,reviewed_manifest_sha256,
  reviewed_source_fingerprint,reviewed_scope_hash,row_count,expected_deltas,
  authorized_by,contract_version
)
values(
  'fit-house-1-f62ab94e89861f7f-production','PRODUCTION',9,
  'f62ab94e89861f7f42c5aa76cb00cb3fa80697289171b7ba4b02074a4c86d32a',
  '0d68058b575a88dd310e8c2808951ace073502936eeff96d464d48e9d42415d1',
  'c7227616854d5976375791488227a58123b4b74cc319201d3cf1ce4104490aad',
  1,
  '{"row_count_deltas":{"products":0,"product_variants":0,"retailer_products":0,"offers":0,"price_history":0},"logical_field_deltas":{"offer_price_updates":0,"offer_shipping_updates":0,"offer_total_updates":0,"offer_stock_updates":1,"offer_url_updates":0,"mapping_url_updates":0,"mapping_updated_at_updates":0,"last_checked_at_updates":1}}'::jsonb,
  'owner-approved-chat-2026-08-18-mutant-creakong-offer-697-oos',1
);

do $support_validation$
declare
  v_function regprocedure:='public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_function);
  v_old text:=$old$elsif (v_guardrails->>'source_product_count')::integer<=0
     or (v_guardrails->>'previous_source_product_count')::integer<=0
     or (v_guardrails->>'source_product_count')::numeric/(v_guardrails->>'previous_source_product_count')::numeric
        <(v_limits->>'minimum_source_count_ratio')::numeric
     or (v_guardrails->>'required_source_rows')::integer<>jsonb_array_length(v_artifact->'rows')
     or (v_guardrails->>'matched_source_rows')::integer<>jsonb_array_length(v_artifact->'rows')
     or (v_guardrails->>'changed_row_count')::integer<>jsonb_array_length(v_artifact->'rows')
     or (v_guardrails->>'new_oos_count')::integer<>v_new_oos
     or v_new_oos<=(v_limits->>'maximum_new_oos_count')::integer then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Reviewed mixed-change ordinary MASS_OOS proof mismatch');
  end if;$old$;
  v_new text:=$new$elsif v_contract->>'authorization_id'='fit-house-1-f62ab94e89861f7f-production' then
    if jsonb_array_length(v_artifact->'rows')<>1
       or (v_guardrails->>'required_source_rows')::integer<>1
       or (v_guardrails->>'matched_source_rows')::integer<>1
       or (v_guardrails->>'changed_row_count')::integer<>1
       or (v_guardrails->>'price_changed_row_count')::integer<>0
       or (v_guardrails->>'new_oos_count')::integer<>1
       or v_new_oos<>1
       or not exists(
         select 1 from jsonb_array_elements(v_artifact->'rows') row
         where row.value->>'offer_id'='697'
           and row.value->>'retailer_product_id'='689'
           and row.value->>'external_product_id'='10028457820400'
           and row.value->>'external_variant_id'='49744956850416'
           and row.value->>'action'='UPDATE_STOCK'
           and not (row.value->'changed_fields'->>'price')::boolean
           and (row.value->'changed_fields'->>'stock')::boolean
           and not (row.value->'changed_fields'->>'url')::boolean
           and not (row.value->'changed_fields'->>'blocked')::boolean
           and (row.value#>>'{atomic_plan,expected_state,offer,price}')::numeric=26.99
           and (row.value#>>'{atomic_plan,offer,values,price}')::numeric=26.99
           and (row.value#>>'{atomic_plan,expected_state,offer,in_stock}')::boolean
           and not (row.value#>>'{atomic_plan,offer,values,in_stock}')::boolean
       ) then
      perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Reviewed Fit House offer 697 OOS proof mismatch');
    end if;
  elsif (v_guardrails->>'source_product_count')::integer<=0
     or (v_guardrails->>'previous_source_product_count')::integer<=0
     or (v_guardrails->>'source_product_count')::numeric/(v_guardrails->>'previous_source_product_count')::numeric
        <(v_limits->>'minimum_source_count_ratio')::numeric
     or (v_guardrails->>'required_source_rows')::integer<>jsonb_array_length(v_artifact->'rows')
     or (v_guardrails->>'matched_source_rows')::integer<>jsonb_array_length(v_artifact->'rows')
     or (v_guardrails->>'changed_row_count')::integer<>jsonb_array_length(v_artifact->'rows')
     or (v_guardrails->>'new_oos_count')::integer<>v_new_oos
     or v_new_oos<=(v_limits->>'maximum_new_oos_count')::integer then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Reviewed mixed-change ordinary MASS_OOS proof mismatch');
  end if;$new$;
begin
  if position(v_old in v_definition)=0
     or position('Reviewed Fit House offer 697 OOS proof mismatch' in v_definition)>0 then
    raise exception 'Fit House offer 697 reviewed validation anchor mismatch';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$support_validation$;

do $support_registration$
declare
  v_function regprocedure:='public.register_reviewed_mixed_change_control_plan(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_function);
  v_old text:=$old$       (v_target='PRODUCTION'
        and p_request->>'kind'='retailer-existing-offer-sync-control-plan-registration'
        and p_request->>'retailer_slug'='fit-house'
        and p_request->>'source_domain'='fithouse.uk'
        and v_retailer_id=9
        and v_contract->>'authorization_id'='fit-house-47-168b5c604482280d-production')$old$;
  v_new text:=$new$       (v_target='PRODUCTION'
        and p_request->>'kind'='retailer-existing-offer-sync-control-plan-registration'
        and p_request->>'retailer_slug'='fit-house'
        and p_request->>'source_domain'='fithouse.uk'
        and v_retailer_id=9
        and v_contract->>'authorization_id' in (
          'fit-house-47-168b5c604482280d-production',
          'fit-house-1-f62ab94e89861f7f-production'))$new$;
begin
  if position(v_old in v_definition)=0
     or position('fit-house-1-f62ab94e89861f7f-production' in v_definition)>0 then
    raise exception 'Fit House offer 697 reviewed registration anchor mismatch';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$support_registration$;

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb) owner to postgres;
alter function public.register_reviewed_mixed_change_control_plan(jsonb) owner to postgres;
revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.register_reviewed_mixed_change_control_plan(jsonb) from public,anon,authenticated,service_role;

commit;
