begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.products, public.product_variants, public.retailer_products,
  public.offers, public.price_history in share row exclusive mode;

do $correct_ghost_lifestyle_energy_drink_metadata$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_products_before bigint;
  v_variants_before bigint;
  v_mappings_before bigint;
  v_offers_before bigint;
  v_history_before bigint;
  v_mapping_before jsonb;
  v_offer_before jsonb;
  v_family_history_before text;
  v_rows integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Ghost Lifestyle Energy Drink correction requires production database owner';
  end if;

  if (select count(*) from public.products where id=1398) <> 1
     or not exists (
       select 1 from public.products
       where id=1398 and name='Ghost Lifestyle Energy Drink'
         and slug='ghost-lifestyle-energy-drink' and brand='Ghost Lifestyle'
         and category='Pre Workout' and product_format='powder' and gtin is null
         and is_active and merged_into_product_id is null and merged_at is null
     ) then
    raise exception 'Ghost Lifestyle Energy Drink product precondition mismatch';
  end if;

  if (select count(*) from public.product_variants where product_id=1398) <> 1
     or not exists (
       select 1 from public.product_variants
       where id=4306 and product_id=1398
         and variant_key='sour-warheads-watermelon-500ml'
         and display_name='Sour Warheads Watermelon / 500ml'
         and flavour_code='sour warheads watermelon'
         and flavour_label='Sour Warheads Watermelon'
         and size_value=500 and size_unit='ml' and pack_count=1
         and product_format='powder' and gtin is null
         and is_active and not is_default
     ) then
    raise exception 'Ghost Lifestyle Energy Drink variant precondition mismatch';
  end if;

  if (select count(*) from public.retailer_products
      where retailer_id=15 and external_product_id='15246472610166') <> 1
     or not exists (
       select 1 from public.retailer_products
       where id=4270 and retailer_id=15 and product_id=1398 and product_variant_id=4306
         and external_product_id='15246472610166' and external_variant_id='55897618579830'
         and external_options='{"Flavour":"Sour Warheads Watermelon","Size":"500ml"}'::jsonb
         and external_url='https://gladiatornutrition.co.uk/products/ghost-lifestyle-energy-drink?variant=55897618579830'
     ) then
    raise exception 'Ghost Lifestyle Energy Drink mapping precondition mismatch';
  end if;

  if not exists (
       select 1 from public.offers
       where id=4083 and retailer_id=15 and product_id=1398 and product_variant_id=4306
         and retailer_product_id=4270 and price=2.75 and shipping_cost=6.99
         and total_price=9.74 and in_stock
         and url='https://gladiatornutrition.co.uk/products/ghost-lifestyle-energy-drink?variant=55897618579830&sca_ref=11968733.U3nlV04VwN4S'
     ) then
    raise exception 'Ghost Lifestyle Energy Drink offer precondition mismatch';
  end if;

  if not exists (
       select 1 from public.price_history
       where id=43153 and offer_id=4083 and price=2.75
         and shipping_cost=6.99 and total_price=9.74
     ) then
    raise exception 'Ghost Lifestyle Energy Drink price-history baseline mismatch';
  end if;

  perform id from public.products where id=1398 for update;
  perform id from public.product_variants where id=4306 for update;
  perform id from public.retailer_products where id=4270 for update;
  perform id from public.offers where id=4083 for update;
  perform id from public.price_history where offer_id=4083 order by id for update;

  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;
  select to_jsonb(rp) into v_mapping_before from public.retailer_products rp where rp.id=4270;
  select to_jsonb(o) into v_offer_before from public.offers o where o.id=4083;
  select md5(coalesce(jsonb_agg(to_jsonb(ph) order by ph.id)::text,'[]'))
    into v_family_history_before from public.price_history ph where ph.offer_id=4083;

  update public.products
  set category='Energy Drinks', product_format='liquid'
  where id=1398 and name='Ghost Lifestyle Energy Drink'
    and slug='ghost-lifestyle-energy-drink' and brand='Ghost Lifestyle'
    and category='Pre Workout' and product_format='powder' and gtin is null
    and is_active and merged_into_product_id is null and merged_at is null;
  get diagnostics v_rows=row_count;
  if v_rows <> 1 then
    raise exception 'Ghost Lifestyle Energy Drink correction affected % products',v_rows;
  end if;

  update public.product_variants
  set product_format='liquid'
  where id=4306 and product_id=1398
    and variant_key='sour-warheads-watermelon-500ml'
    and display_name='Sour Warheads Watermelon / 500ml'
    and flavour_code='sour warheads watermelon'
    and flavour_label='Sour Warheads Watermelon'
    and size_value=500 and size_unit='ml' and pack_count=1
    and product_format='powder' and gtin is null
    and is_active and not is_default;
  get diagnostics v_rows=row_count;
  if v_rows <> 1 then
    raise exception 'Ghost Lifestyle Energy Drink correction affected % variants',v_rows;
  end if;

  if (select count(*) from public.products) <> v_products_before
     or (select count(*) from public.product_variants) <> v_variants_before
     or (select count(*) from public.retailer_products) <> v_mappings_before
     or (select count(*) from public.offers) <> v_offers_before
     or (select count(*) from public.price_history) <> v_history_before
     or (select to_jsonb(rp) from public.retailer_products rp where rp.id=4270) is distinct from v_mapping_before
     or (select to_jsonb(o) from public.offers o where o.id=4083) is distinct from v_offer_before
     or (select md5(coalesce(jsonb_agg(to_jsonb(ph) order by ph.id)::text,'[]'))
         from public.price_history ph where ph.offer_id=4083) is distinct from v_family_history_before then
    raise exception 'Ghost Lifestyle Energy Drink correction changed forbidden catalogue evidence';
  end if;

  if not exists (
       select 1 from public.products
       where id=1398 and name='Ghost Lifestyle Energy Drink'
         and slug='ghost-lifestyle-energy-drink' and brand='Ghost Lifestyle'
         and category='Energy Drinks' and product_format='liquid' and gtin is null
         and is_active and merged_into_product_id is null and merged_at is null
     )
     or (select count(*) from public.product_variants where product_id=1398) <> 1
     or not exists (
       select 1 from public.product_variants
       where id=4306 and product_id=1398
         and variant_key='sour-warheads-watermelon-500ml'
         and display_name='Sour Warheads Watermelon / 500ml'
         and flavour_code='sour warheads watermelon'
         and flavour_label='Sour Warheads Watermelon'
         and size_value=500 and size_unit='ml' and pack_count=1
         and product_format='liquid' and gtin is null
         and is_active and not is_default
     )
     or (select count(*) from public.retailer_products
         where retailer_id=15 and external_product_id='15246472610166') <> 1
     or not exists (
       select 1 from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id
       where rp.id=4270 and rp.retailer_id=15 and rp.product_id=1398 and rp.product_variant_id=4306
         and rp.external_product_id='15246472610166' and rp.external_variant_id='55897618579830'
         and o.id=4083 and o.retailer_id=15 and o.product_id=1398 and o.product_variant_id=4306
     ) then
    raise exception 'Ghost Lifestyle Energy Drink correction postcondition mismatch';
  end if;
end
$correct_ghost_lifestyle_energy_drink_metadata$;

commit;
