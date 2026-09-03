begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $repair$
declare
  v_function regprocedure := to_regprocedure('public.read_retailer_offer_sync_approved_state(bigint)');
  v_definition text;
  v_old_count text := $anchor$
  v_approved_count := v_approved_count - v_legacy_count;
  if v_approved_count <> 586 or v_legacy_count <> 284 then
    perform public.retailer_catalogue_raise(
      'RSBI_EXPECTED_STATE_MISMATCH',
      'Whey Okay approved or legacy mapping count drift'
    );
  end if;$anchor$;
  v_new_count text := $replacement$
  v_approved_count := v_approved_count - v_legacy_count;
  if v_approved_count = 587 and v_legacy_count = 283 then
    if not exists(
      select 1
      from public.retailer_products rp
      join public.offers o on o.retailer_product_id=rp.id
      join public.product_variants v on v.id=rp.product_variant_id
      where rp.id=65 and rp.retailer_id=3 and rp.product_id=69
        and rp.product_variant_id=3217
        and rp.external_product_id='300' and rp.external_variant_id='301'
        and rp.match_method='external_id'
        and rp.external_options=jsonb_build_object('Flavour','Biscuit Spread')
        and o.id=73 and o.retailer_id=3 and o.product_id=69
        and o.product_variant_id=3217
        and o.price=22.70 and o.shipping_cost=3.99 and o.total_price=26.69
        and o.in_stock is true
        and v.id=3217 and v.product_id=69
        and v.variant_key='biscuit-spread-908g'
        and v.display_name='Biscuit Spread / 908g'
        and v.size_value=908 and v.size_unit='g' and v.pack_count=1
        and v.is_active is true and v.is_default is false
    ) then
      perform public.retailer_catalogue_raise(
        'RSBI_EXPECTED_STATE_MISMATCH',
        'Reviewed Whey Okay offer 73 state drift'
      );
    end if;
    v_approved_count := v_approved_count - 1;
    v_legacy_count := v_legacy_count + 1;
  elsif v_approved_count <> 586 or v_legacy_count <> 284 then
    perform public.retailer_catalogue_raise(
      'RSBI_EXPECTED_STATE_MISMATCH',
      'Whey Okay approved or legacy mapping count drift'
    );
  end if;$replacement$;
begin
  if current_user <> 'postgres' or v_function is null then
    raise exception 'Whey Okay reviewed-scope repair owner or function mismatch';
  end if;
  select pg_get_functiondef(v_function) into v_definition;
  if strpos(v_definition,v_old_count)=0
     or strpos(v_definition,'Reviewed Whey Okay offer 73 state drift')>0
     or (length(v_definition)-length(replace(v_definition,v_old_count,'')))/length(v_old_count)<>1
     or (length(v_definition)-length(replace(v_definition,'where rp.retailer_id = 3','')))/length('where rp.retailer_id = 3')<>1
     or (length(v_definition)-length(replace(v_definition,'array[11,150,191,249]','')))/length('array[11,150,191,249]')<>1
     or (length(v_definition)-length(replace(v_definition,'jsonb_array_length(v_exceptions) <> 4','')))/length('jsonb_array_length(v_exceptions) <> 4')<>1 then
    raise exception 'Whey Okay reviewed-scope repair anchor/state mismatch';
  end if;
  v_definition := replace(v_definition,v_old_count,v_new_count);
  v_definition := replace(v_definition,'where rp.retailer_id = 3','where rp.retailer_id = 3 and rp.id <> 65');
  v_definition := replace(v_definition,'array[11,150,191,249]','array[11,65,150,191,249]');
  v_definition := replace(v_definition,'jsonb_array_length(v_exceptions) <> 4','jsonb_array_length(v_exceptions) <> 5');
  execute v_definition;
end
$repair$;

alter function public.read_retailer_offer_sync_approved_state(bigint) owner to postgres;

do $verify$
declare
  v_definition text := pg_get_functiondef('public.read_retailer_offer_sync_approved_state(bigint)'::regprocedure);
begin
  if strpos(v_definition,'Reviewed Whey Okay offer 73 state drift')=0
     or strpos(v_definition,'where rp.retailer_id = 3 and rp.id <> 65')=0
     or strpos(v_definition,'array[11,65,150,191,249]')=0
     or strpos(v_definition,'jsonb_array_length(v_exceptions) <> 5')=0
     or not has_function_privilege('retailer_catalogue_production_validator','public.read_retailer_offer_sync_approved_state(bigint)','EXECUTE')
     or has_function_privilege('public','public.read_retailer_offer_sync_approved_state(bigint)','EXECUTE')
     or has_function_privilege('service_role','public.read_retailer_offer_sync_approved_state(bigint)','EXECUTE')
     or has_function_privilege('retailer_catalogue_production_approver','public.read_retailer_offer_sync_approved_state(bigint)','EXECUTE')
     or has_function_privilege('retailer_catalogue_production_executor','public.read_retailer_offer_sync_approved_state(bigint)','EXECUTE') then
    raise exception 'Whey Okay reviewed-scope repair verification failed';
  end if;
end
$verify$;

commit;
