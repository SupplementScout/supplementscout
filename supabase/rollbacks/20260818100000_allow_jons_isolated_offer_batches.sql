begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $restore_exact_jons_batches$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_function regprocedure:='public.register_jons_offer_sync_control_plan(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_function);
  v_isolated text:=$old$if v_row_count<1 or v_row_count>v_manifest_count
     or cardinality(v_seen_mapping_ids)<>v_row_count
     or cardinality(v_seen_offer_ids)<>v_row_count then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Isolated child rows do not reconcile with the approved manifest');
  end if;$old$;
  v_exact text:=$new$if v_row_count<>v_manifest_count or cardinality(v_seen_mapping_ids)<>v_manifest_count or cardinality(v_seen_offer_ids)<>v_manifest_count then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Child rows do not cover the exact approved manifest');
  end if;$new$;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION' then
    raise exception 'Jon''s isolated offer batch rollback requires production database owner';
  end if;
  if position(v_isolated in v_definition)=0 then
    raise exception 'Jon''s isolated batch rollback anchor mismatch';
  end if;
  v_definition:=replace(v_definition,v_isolated,v_exact);
  v_definition:=replace(v_definition,$old$'operation_count',v_row_count$old$,$new$'operation_count',v_manifest_count$new$);
  execute v_definition;
end
$restore_exact_jons_batches$;

alter function public.register_jons_offer_sync_control_plan(jsonb) owner to postgres;
revoke all on function public.register_jons_offer_sync_control_plan(jsonb) from public,anon,authenticated,service_role;

commit;
