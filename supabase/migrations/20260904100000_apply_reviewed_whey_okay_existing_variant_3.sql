begin;

-- Owner-review package only; it is not production-authorized by its presence.
-- Source: Whey Okay run 33838335548 / artifact 9924141590.
-- Two matching captures: 2026-09-04T04:56:02.852Z and 2026-09-04T05:01:08.003Z.
-- Raw SHA-256 7fdac0ea9d459edf545408faa3f2b397633050e14311857e0ee48f2f069bb0ed;
-- semantic SHA-256 bcc8c9d0779fa6baa83ba1434b2f100d4fb1e53720c5cc0eff45fbe171cf6ce4.

set local lock_timeout = '5s';
set local statement_timeout = '120s';

lock table public.products, public.product_variants, public.retailer_products,
  public.offers, public.price_history in share row exclusive mode;

do $reviewed_whey_3$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_environment text := v_target->>'target_environment';
  v_counts_before jsonb;
  v_rows integer;
  v_state_function regprocedure := to_regprocedure('public.read_retailer_offer_sync_approved_state(bigint)');
  v_registration_function regprocedure := to_regprocedure('public.register_whey_okay_offer_sync_control_plan(jsonb)');
  v_definition text;
  v_old_manifest_hash text := '52565db2747d905fa2db68162ebd56b1b4e5b8a3d007bb10c144f2213e216905';
  v_new_manifest_hash text := '0b98d44e0c1811ed753202366f49b769f057cf31dd772e95fcf8695a41f293ea';
begin
  if current_user <> 'postgres'
     or v_environment<>'PRODUCTION'
     or (
       v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
       or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
     ) then
    raise exception 'Reviewed Whey Okay 3-row remediation requires the exact production database owner target';
  end if;
  if clock_timestamp() >= '2026-09-05T05:01:08.003Z'::timestamptz then
    raise exception 'Reviewed Whey Okay artifact 9924141590 has expired';
  end if;
  if v_state_function is null or v_registration_function is null then
    raise exception 'Reviewed Whey Okay control-plane function missing';
  end if;
  if (select count(*) from public.products)<>1130
       or (select count(*) from public.product_variants)<>2850
       or (select count(*) from public.retailer_products)<>2808
       or (select count(*) from public.offers)<>2808
       or (select count(*) from public.price_history)<>7945
     then
    raise exception 'Reviewed Whey Okay production catalogue baseline changed';
  end if;

  if (select count(*) from (values
      (18,23,19,3,770,'65','66','Dorian Yates Blood & Guts Pre Workout 380g','dorian-yates-blood--guts-pre-workout-380g','https://wheyokay.com/dorian-yates-blood--guts-pre-workout-380g-65-p.asp',26.31,3.99,true,'2026-06-29T12:31:53.715Z'::timestamptz),
      (171,162,158,149,747,'847','848','Optimum Nutrition Serious Mass  5.4kg','optimum-nutrition-serious-mass--54kg','https://wheyokay.com/optimum-nutrition-serious-mass--54kg-847-p.asp',57.99,3.99,true,'2026-06-29T12:33:07.980Z'::timestamptz),
      (204,235,231,194,783,'1504','1504','Optimum Nutrition Micronised Creatine 317g','optimum-nutrition-micronised-creatine-317g','https://wheyokay.com/optimum-nutrition-micronised-creatine-317g-1504-p.asp',23.99,3.99,true,'2026-06-29T12:33:46.400Z'::timestamptz)
    ) x(mapping_id,offer_id,product_id,old_variant_id,new_variant_id,external_product_id,external_variant_id,external_name,external_slug,url,old_price,shipping,in_stock,checked_at)
    join public.products p on p.id=x.product_id and p.is_active and p.merged_into_product_id is null and p.merged_at is null
    join public.product_variants old_v on old_v.id=x.old_variant_id and old_v.product_id=x.product_id and old_v.is_active and old_v.is_default
    join public.product_variants new_v on new_v.id=x.new_variant_id and new_v.product_id=x.product_id and new_v.is_active and not new_v.is_default
    join public.retailer_products rp on rp.id=x.mapping_id and rp.retailer_id=3 and rp.product_id=x.product_id and rp.product_variant_id=x.old_variant_id
      and rp.external_product_id is null and rp.external_variant_id is null and rp.external_sku is null and rp.external_gtin is null and rp.external_options is null
      and rp.external_name=x.external_name and rp.external_slug=x.external_slug and rp.external_url=x.url
      and rp.match_method='existing_offer' and rp.match_confidence=100 and rp.updated_at='2026-06-30T19:40:13.950723Z'::timestamptz
    join public.offers o on o.id=x.offer_id and o.retailer_id=3 and o.retailer_product_id=x.mapping_id
      and o.product_id=x.product_id and o.product_variant_id=x.old_variant_id and o.price=x.old_price
      and o.shipping_cost=x.shipping and o.total_price is null and o.in_stock=x.in_stock and o.url=x.url and o.last_checked_at=x.checked_at
  )<>3 then
    raise exception 'Reviewed Whey Okay exact 3-row before-state mismatch';
  end if;
  if exists(
    select 1 from public.retailer_products rp
    where rp.retailer_id=3 and rp.product_variant_id in (770,747,783) and rp.id not in (18,171,204)
  ) then
    raise exception 'Reviewed Whey Okay target variant collision';
  end if;

  select jsonb_build_object(
    'products',(select count(*) from public.products),
    'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'price_history',(select count(*) from public.price_history)
  ) into v_counts_before;

  with x(mapping_id,new_variant_id,external_product_id,external_variant_id,external_sku,external_gtin,external_options,external_name) as (values
    (18,770,'65','66','5060763890411','5060763890411',jsonb_build_object('Flavour','Watermelon'),'Dorian Yates Blood & Guts Pre Workout 380g - Watermelon'),
    (171,747,'847','848','5060245600446','5060245600446',jsonb_build_object('Flavour','Chocolate'),'Optimum Nutrition Serious Mass 5.4kg - Chocolate'),
    (204,783,'1504','1504','5060245605397','5060245605397','{}'::jsonb,'Optimum Nutrition Micronised Creatine 317g')
  ) update public.retailer_products rp set
    product_variant_id=x.new_variant_id,
    external_product_id=x.external_product_id,
    external_variant_id=x.external_variant_id,
    external_sku=x.external_sku,
    external_gtin=x.external_gtin,
    external_options=x.external_options,
    external_name=x.external_name,
    match_method='external_id',
    match_confidence=100,
    updated_at='2026-09-04T05:01:08.003Z'::timestamptz
  from x where rp.id=x.mapping_id;
  get diagnostics v_rows=row_count;
  if v_rows<>3 then raise exception 'Reviewed Whey Okay remediation changed % mappings',v_rows; end if;

  with x(offer_id,new_variant_id,price,total_price,in_stock) as (values
    (23,770,26.31,null,false),
    (162,747,57.99,null,false),
    (235,783,23.72,27.71,true)
  ) update public.offers o set
    product_variant_id=x.new_variant_id,
    price=x.price,
    total_price=x.total_price,
    in_stock=x.in_stock,
    last_checked_at='2026-09-04T05:01:08.003Z'::timestamptz
  from x where o.id=x.offer_id;
  get diagnostics v_rows=row_count;
  if v_rows<>3 then raise exception 'Reviewed Whey Okay remediation changed % offers',v_rows; end if;

  insert into public.price_history(offer_id,price,shipping_cost,total_price,checked_at)
  values (235,23.72,3.99,27.71,'2026-09-04T05:01:08.003Z'::timestamptz);
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Reviewed Whey Okay remediation inserted % history rows',v_rows; end if;

  select pg_get_functiondef(v_state_function) into v_definition;
  if strpos(v_definition,'v_approved_count <> 586 or v_legacy_count <> 284')=0
     or strpos(v_definition,'jsonb_array_length(v_records) <> 586')=0
     or strpos(v_definition,'v_approved_count <> 589 or v_legacy_count <> 281')>0 then
    raise exception 'Reviewed Whey Okay state function baseline drift';
  end if;
  v_definition:=replace(v_definition,'v_approved_count = 587 and v_legacy_count = 283','v_approved_count = 590 and v_legacy_count = 280');
  v_definition:=replace(v_definition,'v_approved_count <> 586 or v_legacy_count <> 284','v_approved_count <> 589 or v_legacy_count <> 281');
  v_definition:=replace(v_definition,'jsonb_array_length(v_records) <> 586','jsonb_array_length(v_records) <> 589');
  execute v_definition;

  select pg_get_functiondef(v_registration_function) into v_definition;
  if (length(v_definition)-length(replace(v_definition,v_old_manifest_hash,'')))/length(v_old_manifest_hash)<>1
     or strpos(v_definition,'jsonb_array_length(v_manifest) <> 586')=0
     or strpos(v_definition,'exactly 586 approved Whey Okay mappings')=0 then
    raise exception 'Reviewed Whey Okay registration function baseline drift';
  end if;
  v_definition:=replace(v_definition,v_old_manifest_hash,v_new_manifest_hash);
  v_definition:=replace(v_definition,'jsonb_array_length(v_manifest) <> 586','jsonb_array_length(v_manifest) <> 589');
  v_definition:=replace(v_definition,'exactly 586 approved Whey Okay mappings','exactly 589 approved Whey Okay mappings');
  execute v_definition;

  if jsonb_build_object(
      'products',(select count(*) from public.products),
      'product_variants',(select count(*) from public.product_variants),
      'retailer_products',(select count(*) from public.retailer_products),
      'offers',(select count(*) from public.offers),
      'price_history',(select count(*) from public.price_history)-1
    )<>v_counts_before then
    raise exception 'Reviewed Whey Okay remediation changed a forbidden row count';
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
  )<>3 then raise exception 'Reviewed Whey Okay 3-row postcondition mismatch'; end if;
  if not exists(select 1 from public.price_history where offer_id=235 and price=23.72 and shipping_cost=3.99 and total_price=27.71 and checked_at='2026-09-04T05:01:08.003Z'::timestamptz) then
    raise exception 'Reviewed Whey Okay price history postcondition mismatch';
  end if;
  if strpos(pg_get_functiondef(v_state_function),'v_approved_count <> 589 or v_legacy_count <> 281')=0
     or strpos(pg_get_functiondef(v_state_function),'jsonb_array_length(v_records) <> 589')=0
     or strpos(pg_get_functiondef(v_registration_function),v_new_manifest_hash)=0
     or strpos(pg_get_functiondef(v_registration_function),'jsonb_array_length(v_manifest) <> 589')=0 then
    raise exception 'Reviewed Whey Okay automation scope postcondition mismatch';
  end if;
end
$reviewed_whey_3$;

alter function public.read_retailer_offer_sync_approved_state(bigint) owner to postgres;
alter function public.register_whey_okay_offer_sync_control_plan(jsonb) owner to postgres;

commit;
