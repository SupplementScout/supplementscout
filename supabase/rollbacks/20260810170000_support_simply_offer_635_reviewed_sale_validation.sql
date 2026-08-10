begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback_simply_sale_validation$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_function regprocedure:='public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_function);
  v_start integer:=position($anchor$if v_contract->>'kind'='retailer-reviewed-commercial-change-v4'
     and v_contract->>'authorization_id'='simply-offer635-sale-20260810-production' then$anchor$ in v_definition);
  v_end_anchor text:=$anchor$  end if;

  v_actual_migration:=public.retailer_catalogue_assert_migration_ledger($anchor$;
  v_end integer;
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
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Simply offer 635 validator rollback requires production database owner';
  end if;
  if v_start=0 then
    raise exception 'Simply offer 635 validator rollback anchor is missing';
  end if;
  if exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings
    where authorization_id='simply-offer635-sale-20260810-production'
  ) then
    raise exception 'Simply offer 635 validator rollback is forbidden after plan binding';
  end if;
  v_end:=position(v_end_anchor in substring(v_definition from v_start));
  if v_end=0 then
    raise exception 'Simply offer 635 validator rollback end anchor is missing';
  end if;
  v_definition:=substring(v_definition from 1 for v_start-1)
    ||v_old
    ||substring(v_definition from v_start+v_end+length(v_end_anchor)-1);
  execute v_definition;
end
$rollback_simply_sale_validation$;

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb)
  owner to postgres;
revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb)
  from public,anon,authenticated,service_role;

commit;
