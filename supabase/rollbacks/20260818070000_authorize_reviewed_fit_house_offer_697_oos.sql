begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_validation regprocedure:='public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb)'::regprocedure;
  v_registration regprocedure:='public.register_reviewed_mixed_change_control_plan(jsonb)'::regprocedure;
  v_validation_definition text:=pg_get_functiondef(v_validation);
  v_registration_definition text:=pg_get_functiondef(v_registration);
  v_validation_old text:=$old$elsif v_contract->>'authorization_id'='fit-house-1-f62ab94e89861f7f-production' then
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
  elsif $old$;
  v_validation_new text:='elsif ';
  v_registration_old text:=$old$       (v_target='PRODUCTION'
        and p_request->>'kind'='retailer-existing-offer-sync-control-plan-registration'
        and p_request->>'retailer_slug'='fit-house'
        and p_request->>'source_domain'='fithouse.uk'
        and v_retailer_id=9
        and v_contract->>'authorization_id' in (
          'fit-house-47-168b5c604482280d-production',
          'fit-house-1-f62ab94e89861f7f-production'))$old$;
  v_registration_new text:=$new$       (v_target='PRODUCTION'
        and p_request->>'kind'='retailer-existing-offer-sync-control-plan-registration'
        and p_request->>'retailer_slug'='fit-house'
        and p_request->>'source_domain'='fithouse.uk'
        and v_retailer_id=9
        and v_contract->>'authorization_id'='fit-house-47-168b5c604482280d-production')$new$;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or exists(select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings
       where authorization_id='fit-house-1-f62ab94e89861f7f-production') then
    raise exception 'Fit House offer 697 reviewed rollback is not permitted';
  end if;
  if position(v_validation_old in v_validation_definition)=0
     or position(v_registration_old in v_registration_definition)=0 then
    raise exception 'Fit House offer 697 rollback anchor mismatch';
  end if;
  execute replace(v_validation_definition,v_validation_old,v_validation_new);
  execute replace(v_registration_definition,v_registration_old,v_registration_new);
  delete from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='fit-house-1-f62ab94e89861f7f-production' and retailer_id=9 and contract_version=1;
  if not found then raise exception 'Fit House offer 697 authorization delete failed'; end if;
end
$rollback$;

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb) owner to postgres;
alter function public.register_reviewed_mixed_change_control_plan(jsonb) owner to postgres;
revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.register_reviewed_mixed_change_control_plan(jsonb) from public,anon,authenticated,service_role;

commit;
