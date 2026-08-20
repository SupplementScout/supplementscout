begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $whey_okay_confirmed_validator$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_source regprocedure:='public.retailer_offer_sync_validate_batch_read_only_unreviewed_interna(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_source);
  v_begin_anchor text:='begin'||chr(10);
  v_begin_replacement text:='begin'||chr(10)||'  p_request:=public.require_retailer_price_confirmation(p_request,''3'',''whey-okay'');'||chr(10);
  v_dispatch regprocedure:='public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)'::regprocedure;
  v_dispatch_definition text:=pg_get_functiondef(v_dispatch);
  v_route_anchor text:=$old$      when '5' then return public.validate_dolphin_confirmed_price_read_only(p_request);
      else perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','Unsupported retailer price confirmation scope');$old$;
  v_route_replacement text:=$new$      when '5' then return public.validate_dolphin_confirmed_price_read_only(p_request);
      when '3' then return public.validate_whey_okay_confirmed_price_read_only(p_request);
      else perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','Unsupported retailer price confirmation scope');$new$;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION' then
    raise exception 'Whey Okay confirmed price validator requires production database owner';
  end if;
  if to_regprocedure('public.validate_whey_okay_confirmed_price_read_only(jsonb)') is not null
     or position(v_begin_anchor in v_definition)=0
     or position('or v_price_anomalies>0' in v_definition)=0
     or position(v_route_anchor in v_dispatch_definition)=0 then
    raise exception 'Whey Okay confirmed validator anchor mismatch';
  end if;
  v_definition:=replace(v_definition,'retailer_offer_sync_validate_batch_read_only_unreviewed_interna','validate_whey_okay_confirmed_price_read_only');
  v_definition:=overlay(v_definition placing v_begin_replacement from position(v_begin_anchor in v_definition) for length(v_begin_anchor));
  v_definition:=replace(v_definition,'or v_price_anomalies>0','or false /* Whey Okay price anomalies exactly confirmed above */');
  execute v_definition;
  execute replace(v_dispatch_definition,v_route_anchor,v_route_replacement);
end
$whey_okay_confirmed_validator$;

do $whey_okay_isolated_registration$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_source regprocedure:='public.register_retailer_offer_sync_control_plan(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_source);
  v_begin_anchor text:='begin'||chr(10);
  v_begin_replacement text:='begin'||chr(10)
    ||'  if p_request->>''retailer_id''<>''3'' or p_request->>''retailer_slug''<>''whey-okay'' then'||chr(10)
    ||'    perform public.retailer_catalogue_raise(''RSBI_SCOPE_MISMATCH'',''Whey Okay isolated registration scope mismatch'');'||chr(10)
    ||'  end if;'||chr(10);
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION' then
    raise exception 'Whey Okay isolated registration requires production database owner';
  end if;
  if to_regprocedure('public.register_whey_okay_offer_sync_control_plan(jsonb)') is not null
     or position(v_begin_anchor in v_definition)=0
     or position('v_row_count<>v_manifest_count' in v_definition)=0
     or position('cardinality(v_seen_mapping_ids)<>v_manifest_count' in v_definition)=0
     or position('cardinality(v_seen_offer_ids)<>v_manifest_count' in v_definition)=0 then
    raise exception 'Whey Okay isolated registration anchor mismatch';
  end if;
  v_definition:=replace(v_definition,'register_retailer_offer_sync_control_plan','register_whey_okay_offer_sync_control_plan');
  v_definition:=overlay(v_definition placing v_begin_replacement from position(v_begin_anchor in v_definition) for length(v_begin_anchor));
  v_definition:=replace(v_definition,'v_row_count<>v_manifest_count','v_row_count<1 or v_row_count>v_manifest_count');
  v_definition:=replace(v_definition,'cardinality(v_seen_mapping_ids)<>v_manifest_count','cardinality(v_seen_mapping_ids)<>v_row_count');
  v_definition:=replace(v_definition,'cardinality(v_seen_offer_ids)<>v_manifest_count','cardinality(v_seen_offer_ids)<>v_row_count');
  v_definition:=replace(v_definition,'Child rows do not cover the exact approved manifest','Isolated child rows do not reconcile with the approved manifest');
  v_definition:=replace(v_definition,$old$'operation_count',v_manifest_count$old$,$new$'operation_count',v_row_count$new$);
  execute v_definition;
end
$whey_okay_isolated_registration$;

alter function public.validate_whey_okay_confirmed_price_read_only(jsonb) owner to postgres;
revoke all on function public.validate_whey_okay_confirmed_price_read_only(jsonb) from public,anon,authenticated,service_role;
alter function public.register_whey_okay_offer_sync_control_plan(jsonb) owner to postgres;
revoke all on function public.register_whey_okay_offer_sync_control_plan(jsonb) from public,anon,authenticated,service_role;
do $$ begin
  if to_regrole('retailer_catalogue_production_validator') is not null then
    grant execute on function public.register_whey_okay_offer_sync_control_plan(jsonb) to retailer_catalogue_production_validator;
  end if;
end $$;

commit;
