begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $support_simply_sale_validation$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_function regprocedure:='public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_function);
  v_old text:=$old$if (v_guardrails->>'source_product_count')::integer<=0
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
  v_new text:=$new$if v_contract->>'kind'='retailer-reviewed-commercial-change-v4'
     and v_contract->>'authorization_id'='simply-offer635-sale-20260810-production' then
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
       or (v_guardrails->>'total_oos_count')::integer
          <>(v_guardrails->>'previous_oos_count')::integer
       or not exists(
         select 1
         from jsonb_array_elements(v_artifact->'rows') row
         where row.value->>'offer_id'='635'
           and row.value->>'retailer_product_id'='627'
           and row.value->>'external_product_id'='15934232691037'
           and row.value->>'external_variant_id'='64643271033181'
           and row.value->>'action'='UPDATE_PRICE'
           and (row.value->'changed_fields'->>'price')::boolean
           and not (row.value->'changed_fields'->>'stock')::boolean
           and not (row.value->'changed_fields'->>'url')::boolean
           and not (row.value->'changed_fields'->>'blocked')::boolean
           and (row.value#>>'{atomic_plan,expected_state,offer,price}')::numeric=6.41
           and (row.value#>>'{atomic_plan,offer,values,price}')::numeric=2.13
           and abs(
             (row.value#>>'{atomic_plan,offer,values,price}')::numeric
             -(row.value#>>'{atomic_plan,expected_state,offer,price}')::numeric
           )/(row.value#>>'{atomic_plan,expected_state,offer,price}')::numeric
             >=(v_limits->>'price_anomaly_ratio')::numeric
       ) then
      perform public.retailer_catalogue_raise(
        'RSBI_EXPECTED_STATE_MISMATCH',
        'Reviewed Simply offer 635 commercial anomaly proof mismatch');
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
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Simply offer 635 reviewed sale validation support requires production database owner';
  end if;
  if not exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='simply-offer635-sale-20260810-production'
      and retailer_id=7 and contract_version=4
  ) then
    raise exception 'Simply offer 635 reviewed sale authorization is missing';
  end if;
  if position(v_old in v_definition)=0
     or position('Reviewed Simply offer 635 commercial anomaly proof mismatch' in v_definition)>0 then
    raise exception 'Simply offer 635 validator anchor mismatch';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$support_simply_sale_validation$;

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb)
  owner to postgres;
revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb)
  from public,anon,authenticated,service_role;

do $verify_simply_sale_validation$
declare
  v_definition text:=pg_get_functiondef(
    'public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb)'::regprocedure);
begin
  if position('Reviewed Simply offer 635 commercial anomaly proof mismatch' in v_definition)=0
     or position($check$row.value->>'offer_id'='635'$check$ in v_definition)=0
     or position('Reviewed mixed-change ordinary MASS_OOS proof mismatch' in v_definition)=0 then
    raise exception 'Simply offer 635 reviewed sale validator verification failed';
  end if;
end
$verify_simply_sale_validation$;

commit;
