begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_function regprocedure:='public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_function);
  v_old text:=$old$elsif v_contract->>'authorization_id'='jons-1-dfb4624497699b00-production' then
    if (v_guardrails->>'source_product_count')::integer<=0
       or (v_guardrails->>'previous_source_product_count')::integer<=0
       or (v_guardrails->>'source_product_count')::numeric/(v_guardrails->>'previous_source_product_count')::numeric
          <(v_limits->>'minimum_source_count_ratio')::numeric
       or jsonb_array_length(v_artifact->'rows')<>1
       or (v_guardrails->>'required_source_rows')::integer<>1
       or (v_guardrails->>'matched_source_rows')::integer<>1
       or (v_guardrails->>'changed_row_count')::integer<>1
       or (v_guardrails->>'price_changed_row_count')::integer<>1
       or (v_guardrails->>'new_oos_count')::integer<>0
       or v_new_oos<>0
       or not exists(
         select 1 from jsonb_array_elements(v_artifact->'rows') row
         where row.value->>'offer_id'='1098'
           and row.value->>'retailer_product_id'='1284'
           and row.value->>'external_product_id'='10074965508434'
           and row.value->>'external_variant_id'='50781523575122'
           and row.value->>'action'='UPDATE_PRICE'
           and (row.value->'changed_fields'->>'price')::boolean
           and not (row.value->'changed_fields'->>'stock')::boolean
           and not (row.value->'changed_fields'->>'url')::boolean
           and not (row.value->'changed_fields'->>'blocked')::boolean
           and (row.value#>>'{atomic_plan,expected_state,offer,price}')::numeric=27.95
           and (row.value#>>'{atomic_plan,offer,values,price}')::numeric=9.99
           and (row.value#>>'{atomic_plan,expected_state,offer,in_stock}')::boolean
           and (row.value#>>'{atomic_plan,offer,values,in_stock}')::boolean
       ) then
      perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Reviewed Jon''s offer 1098 price proof mismatch');
    end if;
  elsif $old$;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or exists(select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings
       where authorization_id='jons-1-dfb4624497699b00-production') then
    raise exception 'Jon''s offer 1098 reviewed rollback is not permitted';
  end if;
  if position(v_old in v_definition)=0 then
    raise exception 'Jon''s offer 1098 rollback anchor mismatch';
  end if;
  execute replace(v_definition,v_old,'elsif ');
  delete from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='jons-1-dfb4624497699b00-production' and retailer_id=10 and contract_version=1;
  if not found then raise exception 'Jon''s offer 1098 authorization delete failed'; end if;
end
$rollback$;

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb) owner to postgres;
revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb) from public,anon,authenticated,service_role;

commit;
