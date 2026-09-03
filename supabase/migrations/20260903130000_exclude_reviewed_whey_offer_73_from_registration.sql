begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $repair$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_function regprocedure := to_regprocedure('public.register_whey_okay_offer_sync_control_plan(jsonb)');
  v_definition text;
  v_begin_anchor text := 'begin'||chr(10);
  v_begin_replacement text := 'begin'||chr(10)
    ||'  if not exists('||chr(10)
    ||'    select 1 from public.retailer_products rp'||chr(10)
    ||'    join public.offers o on o.retailer_product_id=rp.id'||chr(10)
    ||'    join public.product_variants v on v.id=rp.product_variant_id'||chr(10)
    ||'    where rp.id=65 and rp.retailer_id=3 and rp.product_id=69'||chr(10)
    ||'      and rp.product_variant_id=3217'||chr(10)
    ||'      and rp.external_product_id=''300'' and rp.external_variant_id=''301'''||chr(10)
    ||'      and rp.match_method=''external_id'''||chr(10)
    ||'      and rp.external_options=jsonb_build_object(''Flavour'',''Biscuit Spread'')'||chr(10)
    ||'      and o.id=73 and o.retailer_id=3 and o.product_id=69'||chr(10)
    ||'      and o.product_variant_id=3217'||chr(10)
    ||'      and o.price=22.70 and o.shipping_cost=3.99 and o.total_price=26.69'||chr(10)
    ||'      and o.in_stock is true'||chr(10)
    ||'      and v.id=3217 and v.product_id=69'||chr(10)
    ||'      and v.variant_key=''biscuit-spread-908g'''||chr(10)
    ||'      and v.display_name=''Biscuit Spread / 908g'''||chr(10)
    ||'      and v.size_value=908 and v.size_unit=''g'' and v.pack_count=1'||chr(10)
    ||'      and v.is_active is true and v.is_default is false'||chr(10)
    ||'  ) then'||chr(10)
    ||'    perform public.retailer_catalogue_raise(''RSBI_EXPECTED_STATE_MISMATCH'',''Reviewed Whey Okay offer 73 registration exclusion drift'');'||chr(10)
    ||'  end if;'||chr(10);
  v_mapping_anchor text := 'where rp.retailer_id=3'||chr(10)
    ||'      and nullif(trim(rp.external_product_id),'''') is not null';
  v_mapping_replacement text := 'where rp.retailer_id=3 and rp.id<>65'||chr(10)
    ||'      and nullif(trim(rp.external_product_id),'''') is not null';
  v_offer_anchor text := 'where o.retailer_id=3'||chr(10)
    ||'      and nullif(trim(rp.external_product_id),'''') is not null';
  v_offer_replacement text := 'where o.retailer_id=3 and rp.id<>65'||chr(10)
    ||'      and nullif(trim(rp.external_product_id),'''') is not null';
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_function is null then
    raise exception 'Whey Okay registration exclusion requires production database owner';
  end if;
  select pg_get_functiondef(v_function) into v_definition;
  if strpos(v_definition,'Reviewed Whey Okay offer 73 registration exclusion drift')>0
     or (length(v_definition)-length(replace(v_definition,v_begin_anchor,'')))/length(v_begin_anchor)<>1
     or (length(v_definition)-length(replace(v_definition,v_mapping_anchor,'')))/length(v_mapping_anchor)<>1
     or (length(v_definition)-length(replace(v_definition,v_offer_anchor,'')))/length(v_offer_anchor)<>1 then
    raise exception 'Whey Okay registration exclusion anchor/state mismatch';
  end if;
  v_definition := overlay(v_definition placing v_begin_replacement from position(v_begin_anchor in v_definition) for length(v_begin_anchor));
  v_definition := replace(v_definition,v_mapping_anchor,v_mapping_replacement);
  v_definition := replace(v_definition,v_offer_anchor,v_offer_replacement);
  execute v_definition;
end
$repair$;

alter function public.register_whey_okay_offer_sync_control_plan(jsonb) owner to postgres;

-- 20260901090000 recreated the shared validator and consequently removed the
-- dedicated validator role's EXECUTE grant. Restore that read-only entry point;
-- approver and executor roles remain unable to call it directly.
grant execute on function public.validate_product_import_plan_read_only(jsonb)
  to retailer_catalogue_production_validator;

do $verify$
declare
  v_definition text := pg_get_functiondef('public.register_whey_okay_offer_sync_control_plan(jsonb)'::regprocedure);
begin
  if strpos(v_definition,'Reviewed Whey Okay offer 73 registration exclusion drift')=0
     or strpos(v_definition,'where rp.retailer_id=3 and rp.id<>65')=0
     or strpos(v_definition,'where o.retailer_id=3 and rp.id<>65')=0
     or not has_function_privilege('retailer_catalogue_production_validator','public.register_whey_okay_offer_sync_control_plan(jsonb)','EXECUTE')
     or not has_function_privilege('retailer_catalogue_production_validator','public.validate_product_import_plan_read_only(jsonb)','EXECUTE')
     or has_function_privilege('public','public.validate_product_import_plan_read_only(jsonb)','EXECUTE')
     or has_function_privilege('anon','public.validate_product_import_plan_read_only(jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.validate_product_import_plan_read_only(jsonb)','EXECUTE')
     or has_function_privilege('service_role','public.validate_product_import_plan_read_only(jsonb)','EXECUTE')
     or has_function_privilege('retailer_catalogue_production_approver','public.validate_product_import_plan_read_only(jsonb)','EXECUTE')
     or has_function_privilege('retailer_catalogue_production_executor','public.validate_product_import_plan_read_only(jsonb)','EXECUTE')
     or has_function_privilege('public','public.register_whey_okay_offer_sync_control_plan(jsonb)','EXECUTE')
     or has_function_privilege('service_role','public.register_whey_okay_offer_sync_control_plan(jsonb)','EXECUTE')
     or has_function_privilege('retailer_catalogue_production_approver','public.register_whey_okay_offer_sync_control_plan(jsonb)','EXECUTE')
     or has_function_privilege('retailer_catalogue_production_executor','public.register_whey_okay_offer_sync_control_plan(jsonb)','EXECUTE') then
    raise exception 'Whey Okay registration exclusion verification failed';
  end if;
end
$verify$;

commit;
