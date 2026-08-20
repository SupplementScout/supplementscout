begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $discount_confirmed_validator$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_source regprocedure:='public.retailer_offer_sync_validate_batch_read_only_unreviewed_interna(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_source);
  v_begin_anchor text:='begin'||chr(10);
  v_begin_replacement text:='begin'||chr(10)||'  p_request:=public.require_retailer_price_confirmation(p_request,''4'',''discount-supplements'');'||chr(10);
  v_dispatch regprocedure:='public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)'::regprocedure;
  v_dispatch_definition text:=pg_get_functiondef(v_dispatch);
  v_route_anchor text:=$old$      when '3' then return public.validate_whey_okay_confirmed_price_read_only(p_request);
      else perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','Unsupported retailer price confirmation scope');$old$;
  v_route_replacement text:=$new$      when '3' then return public.validate_whey_okay_confirmed_price_read_only(p_request);
      when '4' then return public.validate_discount_supplements_confirmed_price_read_only(p_request);
      else perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','Unsupported retailer price confirmation scope');$new$;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION' then
    raise exception 'Discount Supplements confirmed price validator requires production database owner';
  end if;
  if to_regprocedure('public.validate_discount_supplements_confirmed_price_read_only(jsonb)') is not null
     or position(v_begin_anchor in v_definition)=0
     or position('or v_price_anomalies>0' in v_definition)=0
     or position(v_route_anchor in v_dispatch_definition)=0 then
    raise exception 'Discount Supplements confirmed validator anchor mismatch';
  end if;
  v_definition:=replace(v_definition,'retailer_offer_sync_validate_batch_read_only_unreviewed_interna','validate_discount_supplements_confirmed_price_read_only');
  v_definition:=overlay(v_definition placing v_begin_replacement from position(v_begin_anchor in v_definition) for length(v_begin_anchor));
  v_definition:=replace(v_definition,'or v_price_anomalies>0','or false /* Discount Supplements price anomalies exactly confirmed above */');
  execute v_definition;
  execute replace(v_dispatch_definition,v_route_anchor,v_route_replacement);
end
$discount_confirmed_validator$;

do $discount_isolated_registration$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_source regprocedure:='public.register_retailer_offer_sync_control_plan(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_source);
  v_begin_anchor text:='begin'||chr(10);
  v_begin_replacement text:='begin'||chr(10)
    ||'  if p_request->>''retailer_id''<>''4'' or p_request->>''retailer_slug''<>''discount-supplements'' then'||chr(10)
    ||'    perform public.retailer_catalogue_raise(''RSBI_SCOPE_MISMATCH'',''Discount Supplements isolated registration scope mismatch'');'||chr(10)
    ||'  end if;'||chr(10);
  v_manifest_anchor text:='  v_manifest_count := jsonb_array_length(v_manifest);'||chr(10);
  v_manifest_replacement text:=v_manifest_anchor
    ||'  if public.retailer_catalogue_sha256_json(v_manifest)<>''cf09dcd18094e03ac5c02d62a631588f644439e72b94486b1c0a6723e1d3e9c8'' then'||chr(10)
    ||'    perform public.retailer_catalogue_raise(''RSBI_SOURCE_HASH_MISMATCH'',''Discount Supplements exact approved manifest drift'');'||chr(10)
    ||'  end if;'||chr(10);
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION' then
    raise exception 'Discount Supplements isolated registration requires production database owner';
  end if;
  if to_regprocedure('public.register_discount_supplements_offer_sync_control_plan(jsonb)') is not null
     or position(v_begin_anchor in v_definition)=0
     or position(v_manifest_anchor in v_definition)=0
     or position('52565db2747d905fa2db68162ebd56b1b4e5b8a3d007bb10c144f2213e216905' in v_definition)=0
     or position('v_row_count<>v_manifest_count' in v_definition)=0
     or position('cardinality(v_seen_mapping_ids)<>v_manifest_count' in v_definition)=0
     or position('cardinality(v_seen_offer_ids)<>v_manifest_count' in v_definition)=0 then
    raise exception 'Discount Supplements isolated registration anchor mismatch';
  end if;
  v_definition:=replace(v_definition,'register_retailer_offer_sync_control_plan','register_discount_supplements_offer_sync_control_plan');
  v_definition:=overlay(v_definition placing v_begin_replacement from position(v_begin_anchor in v_definition) for length(v_begin_anchor));
  v_definition:=overlay(v_definition placing v_manifest_replacement from position(v_manifest_anchor in v_definition) for length(v_manifest_anchor));
  v_definition:=replace(v_definition,'whey-okay','discount-supplements');
  v_definition:=replace(v_definition,'Whey Okay','Discount Supplements');
  v_definition:=replace(v_definition,'wheyokay.com','discount-supplements.co.uk');
  v_definition:=replace(v_definition,'https://discount-supplements.co.uk','https://www.discount-supplements.co.uk');
  v_definition:=replace(v_definition,'EKM_GOOGLE_PRODUCT_FEED','SHOPIFY');
  v_definition:=replace(v_definition,'52565db2747d905fa2db68162ebd56b1b4e5b8a3d007bb10c144f2213e216905','ce13e2a72d12024aac98005d5d40288bd5f109b6f2a63b4f30c9016d46e017a7');
  v_definition:=replace(v_definition,'jsonb_array_length(v_manifest) <> 586','jsonb_array_length(v_manifest) <> 14');
  v_definition:=replace(v_definition,'exactly 586 approved','exactly 14 approved');
  v_definition:=replace(v_definition,'v_mapping_id = any(array[11,150,191,249]::bigint[])','false');
  v_definition:=replace(v_definition,' and exclude reviewed exceptions','');
  v_definition:=replace(v_definition,'retailer_id'' <> ''3''','retailer_id'' <> ''4''');
  v_definition:=replace(v_definition,'retailer_id <> 3','retailer_id <> 4');
  v_definition:=replace(v_definition,'where id=3 and slug=','where id=4 and slug=');
  v_definition:=replace(v_definition,'where rp.retailer_id=3','where rp.retailer_id=4 and false');
  v_definition:=replace(v_definition,'where o.retailer_id=3','where o.retailer_id=4 and false');
  v_definition:=replace(v_definition,'where retailer_id=3 and target_environment','where retailer_id=4 and target_environment');
  v_definition:=replace(v_definition,'''retailer-offer-sync:3:''','''retailer-offer-sync:4:''');
  v_definition:=replace(v_definition,'v_target||'':3''','v_target||'':4''');
  v_definition:=replace(v_definition,'''retailer_id'',''3''','''retailer_id'',''4''');
  v_definition:=replace(v_definition,'v_parent_id,v_parent_fingerprint,3,v_target','v_parent_id,v_parent_fingerprint,4,v_target');
  v_definition:=replace(v_definition,'v_parent_id,3,v_target','v_parent_id,4,v_target');
  v_definition:=replace(v_definition,'v_row_count<>v_manifest_count','v_row_count<1 or v_row_count>v_manifest_count');
  v_definition:=replace(v_definition,'cardinality(v_seen_mapping_ids)<>v_manifest_count','cardinality(v_seen_mapping_ids)<>v_row_count');
  v_definition:=replace(v_definition,'cardinality(v_seen_offer_ids)<>v_manifest_count','cardinality(v_seen_offer_ids)<>v_row_count');
  v_definition:=replace(v_definition,'Child rows do not cover the exact approved manifest','Isolated child rows do not reconcile with the approved manifest');
  v_definition:=replace(v_definition,$old$'operation_count',v_manifest_count$old$,$new$'operation_count',v_row_count$new$);
  execute v_definition;
end
$discount_isolated_registration$;

alter function public.validate_discount_supplements_confirmed_price_read_only(jsonb) owner to postgres;
revoke all on function public.validate_discount_supplements_confirmed_price_read_only(jsonb) from public,anon,authenticated,service_role;
alter function public.register_discount_supplements_offer_sync_control_plan(jsonb) owner to postgres;
revoke all on function public.register_discount_supplements_offer_sync_control_plan(jsonb) from public,anon,authenticated,service_role;
do $$ begin
  if to_regrole('retailer_catalogue_production_validator') is not null then
    grant execute on function public.register_discount_supplements_offer_sync_control_plan(jsonb) to retailer_catalogue_production_validator;
  end if;
end $$;

commit;
