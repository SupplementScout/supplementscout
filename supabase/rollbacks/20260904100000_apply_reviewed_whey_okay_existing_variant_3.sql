begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

lock table public.products, public.product_variants, public.retailer_products,
  public.offers, public.price_history in share row exclusive mode;

do $rollback_reviewed_whey_3$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_rows integer;
  v_state_function regprocedure := to_regprocedure('public.read_retailer_offer_sync_approved_state(bigint)');
  v_registration_function regprocedure := to_regprocedure('public.register_whey_okay_offer_sync_control_plan(jsonb)');
  v_definition text;
  v_old_manifest_hash text := '52565db2747d905fa2db68162ebd56b1b4e5b8a3d007bb10c144f2213e216905';
  v_new_manifest_hash text := '0b98d44e0c1811ed753202366f49b769f057cf31dd772e95fcf8695a41f293ea';
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Reviewed Whey Okay rollback requires the exact production database owner target';
  end if;
  if (select count(*) from (values
      (18,23,19,770,'65','66','5060763890411',26.31,null,false),
      (171,162,158,747,'847','848','5060245600446',57.99,null,false),
      (204,235,231,783,'1504','1504','5060245605397',23.72,27.71,true)
    ) x(mapping_id,offer_id,product_id,variant_id,external_product_id,external_variant_id,gtin,price,total_price,in_stock)
    join public.retailer_products rp on rp.id=x.mapping_id and rp.retailer_id=3 and rp.product_id=x.product_id and rp.product_variant_id=x.variant_id
      and rp.external_product_id=x.external_product_id and rp.external_variant_id=x.external_variant_id and rp.external_sku=x.gtin and rp.external_gtin=x.gtin
      and rp.match_method='external_id' and rp.updated_at='2026-09-04T05:01:08.003Z'::timestamptz
    join public.offers o on o.id=x.offer_id and o.retailer_product_id=x.mapping_id and o.product_id=x.product_id and o.product_variant_id=x.variant_id
      and o.price=x.price and o.shipping_cost=3.99 and o.total_price is not distinct from x.total_price and o.in_stock=x.in_stock
      and o.last_checked_at='2026-09-04T05:01:08.003Z'::timestamptz
  )<>3 then raise exception 'Reviewed Whey Okay rollback state mismatch'; end if;

  delete from public.price_history
  where offer_id=235 and price=23.72 and shipping_cost=3.99 and total_price=27.71
    and checked_at='2026-09-04T05:01:08.003Z'::timestamptz;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Reviewed Whey Okay rollback removed % history rows',v_rows; end if;

  with x(offer_id,old_variant_id,old_price,old_checked_at) as (values
    (23,3,26.31,'2026-06-29T12:31:53.715Z'::timestamptz),
    (162,149,57.99,'2026-06-29T12:33:07.980Z'::timestamptz),
    (235,194,23.99,'2026-06-29T12:33:46.400Z'::timestamptz)
  ) update public.offers o set product_variant_id=x.old_variant_id,price=x.old_price,total_price=null,in_stock=true,last_checked_at=x.old_checked_at
  from x where o.id=x.offer_id;
  get diagnostics v_rows=row_count;
  if v_rows<>3 then raise exception 'Reviewed Whey Okay rollback changed % offers',v_rows; end if;

  with x(mapping_id,old_variant_id,external_name) as (values
    (18,3,'Dorian Yates Blood & Guts Pre Workout 380g'),
    (171,149,'Optimum Nutrition Serious Mass  5.4kg'),
    (204,194,'Optimum Nutrition Micronised Creatine 317g')
  ) update public.retailer_products rp set
    product_variant_id=x.old_variant_id,external_product_id=null,external_variant_id=null,
    external_sku=null,external_gtin=null,external_options=null,external_name=x.external_name,
    match_method='existing_offer',match_confidence=100,
    updated_at='2026-06-30T19:40:13.950723Z'::timestamptz
  from x where rp.id=x.mapping_id;
  get diagnostics v_rows=row_count;
  if v_rows<>3 then raise exception 'Reviewed Whey Okay rollback changed % mappings',v_rows; end if;

  select pg_get_functiondef(v_state_function) into v_definition;
  if strpos(v_definition,'v_approved_count <> 589 or v_legacy_count <> 281')=0
     or strpos(v_definition,'jsonb_array_length(v_records) <> 589')=0 then
    raise exception 'Reviewed Whey Okay rollback state function drift';
  end if;
  v_definition:=replace(v_definition,'v_approved_count = 590 and v_legacy_count = 280','v_approved_count = 587 and v_legacy_count = 283');
  v_definition:=replace(v_definition,'v_approved_count <> 589 or v_legacy_count <> 281','v_approved_count <> 586 or v_legacy_count <> 284');
  v_definition:=replace(v_definition,'jsonb_array_length(v_records) <> 589','jsonb_array_length(v_records) <> 586');
  execute v_definition;

  select pg_get_functiondef(v_registration_function) into v_definition;
  if (length(v_definition)-length(replace(v_definition,v_new_manifest_hash,'')))/length(v_new_manifest_hash)<>1
     or strpos(v_definition,'jsonb_array_length(v_manifest) <> 589')=0
     or strpos(v_definition,'exactly 589 approved Whey Okay mappings')=0 then
    raise exception 'Reviewed Whey Okay rollback registration function drift';
  end if;
  v_definition:=replace(v_definition,v_new_manifest_hash,v_old_manifest_hash);
  v_definition:=replace(v_definition,'jsonb_array_length(v_manifest) <> 589','jsonb_array_length(v_manifest) <> 586');
  v_definition:=replace(v_definition,'exactly 589 approved Whey Okay mappings','exactly 586 approved Whey Okay mappings');
  execute v_definition;
end
$rollback_reviewed_whey_3$;

alter function public.read_retailer_offer_sync_approved_state(bigint) owner to postgres;
alter function public.register_whey_okay_offer_sync_control_plan(jsonb) owner to postgres;

commit;
