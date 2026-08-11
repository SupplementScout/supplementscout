begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.products, public.product_variants, public.retailers,
  public.retailer_products, public.offers, public.price_history in share row exclusive mode;

do $add_two_reviewed_discount_multivitamin_offers$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_tbjp_mapping_id bigint;
  v_strom_mapping_id bigint;
  v_tbjp_offer_id bigint;
  v_strom_offer_id bigint;
  v_products_before bigint;
  v_variants_before bigint;
  v_mappings_before bigint;
  v_offers_before bigint;
  v_history_before bigint;
  v_rows integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Reviewed Discount multivitamin rollout requires production database owner';
  end if;

  if not exists (
       select 1 from public.retailers
       where id=4 and name='Discount Supplements' and slug='discount-supplements'
         and website='https://www.discount-supplements.co.uk'
     ) then
    raise exception 'Discount Supplements retailer identity mismatch';
  end if;

  if not exists (
       select 1 from public.products
       where id=816 and name='Trained by JP The One - Multivitamins'
         and slug='trained-by-jp-the-one-multivitamins' and brand='Trained By JP'
         and category='Health Supplements' and product_format='tablet'
         and unit_count is null and unit_type is null
         and is_active and merged_into_product_id is null and merged_at is null
     )
     or not exists (
       select 1 from public.product_variants
       where id=1163 and product_id=816 and variant_key='default'
         and display_name='Default' and is_active and is_default
     )
     or not exists (
       select 1 from public.retailer_products
       where id=1277 and retailer_id=10 and product_id=816 and product_variant_id=1163
         and external_product_id='10044244197714' and external_variant_id='50651687158098'
         and external_sku='TBJ51001'
     )
     or not exists (
       select 1 from public.offers
       where id=1091 and retailer_id=10 and product_id=816 and product_variant_id=1163
         and retailer_product_id=1277 and price=12.99 and shipping_cost=3.99
         and total_price=16.98 and in_stock
     ) then
    raise exception 'TBJP canonical/Jon identity precondition mismatch';
  end if;

  if not exists (
       select 1 from public.products
       where id=824 and name='Strom Sports MultiMAX Multivitamins & Minerals 180 Tabs'
         and slug='strom-sports-multimax-multivitamins-and-minerals-180-tabs'
         and brand='Strom' and category='Health Supplements' and product_format='tablet'
         and unit_count is null and unit_type is null
         and is_active and merged_into_product_id is null and merged_at is null
     )
     or not exists (
       select 1 from public.product_variants
       where id=1171 and product_id=824 and variant_key='default'
         and display_name='Default' and is_active and is_default
     )
     or not exists (
       select 1 from public.retailer_products
       where id=1285 and retailer_id=10 and product_id=824 and product_variant_id=1171
         and external_product_id='10083874177362' and external_variant_id='50818172879186'
         and external_sku='STM38001'
     )
     or not exists (
       select 1 from public.offers
       where id=1099 and retailer_id=10 and product_id=824 and product_variant_id=1171
         and retailer_product_id=1285 and price=26.49 and shipping_cost=3.99
         and total_price=30.48 and in_stock
     ) then
    raise exception 'Strom canonical/Jon identity precondition mismatch';
  end if;

  if exists (
       select 1 from public.retailer_products
       where retailer_id=4 and (
         product_id in (816,824)
         or external_variant_id in ('55157496185210','42518690463940')
         or external_sku in ('TBJP-0046','STRO-0072')
       )
     )
     or exists (select 1 from public.offers where retailer_id=4 and product_id in (816,824)) then
    raise exception 'Reviewed Discount multivitamin mapping already exists or collides';
  end if;

  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;

  update public.products
  set name='Trained By JP The One Multivitamin 60 Capsules',
      product_format='capsule', unit_count=60, unit_type='capsule'
  where id=816 and name='Trained by JP The One - Multivitamins'
    and product_format='tablet' and unit_count is null and unit_type is null;
  get diagnostics v_rows=row_count;
  if v_rows <> 1 then raise exception 'TBJP metadata correction affected % rows',v_rows; end if;

  update public.products
  set unit_count=180, unit_type='tablet'
  where id=824 and unit_count is null and unit_type is null
    and product_format='tablet';
  get diagnostics v_rows=row_count;
  if v_rows <> 1 then raise exception 'Strom count correction affected % rows',v_rows; end if;

  insert into public.retailer_products(
    retailer_id,product_id,product_variant_id,external_name,external_slug,
    external_gtin,external_url,external_product_id,external_variant_id,
    external_sku,external_options,match_method,match_confidence
  ) values (
    4,816,1163,'Trained By JP TBJP The One Multivitamin 60 Caps | Overall Health',
    'trained-by-jp-the-one-multivitamin-60-caps',null,
    'https://www.discount-supplements.co.uk/products/trained-by-jp-the-one-multivitamin-60-caps?variant=55157496185210',
    '15002692616570','55157496185210','TBJP-0046','{"Size":"60 Caps"}'::jsonb,
    'owner_reviewed_exact_identity',100
  ) returning id into v_tbjp_mapping_id;

  insert into public.retailer_products(
    retailer_id,product_id,product_variant_id,external_name,external_slug,
    external_gtin,external_url,external_product_id,external_variant_id,
    external_sku,external_options,match_method,match_confidence
  ) values (
    4,824,1171,'Strom MultiMax 180 Tablets | Multivitamin','strom-multimax-90-caps',null,
    'https://www.discount-supplements.co.uk/products/strom-multimax-90-caps?variant=42518690463940',
    '7467845877956','42518690463940','STRO-0072','{"Size":"180 Tablets"}'::jsonb,
    'owner_reviewed_exact_identity',100
  ) returning id into v_strom_mapping_id;

  insert into public.offers(product_id,retailer_id,product_variant_id,retailer_product_id,
    price,shipping_cost,total_price,url,in_stock,last_checked_at)
  values (816,4,1163,v_tbjp_mapping_id,11.99,4.99,16.98,
    'https://www.discount-supplements.co.uk/products/trained-by-jp-the-one-multivitamin-60-caps?variant=55157496185210',true,now())
  returning id into v_tbjp_offer_id;

  insert into public.offers(product_id,retailer_id,product_variant_id,retailer_product_id,
    price,shipping_cost,total_price,url,in_stock,last_checked_at)
  values (824,4,1171,v_strom_mapping_id,27.95,4.99,32.94,
    'https://www.discount-supplements.co.uk/products/strom-multimax-90-caps?variant=42518690463940',true,now())
  returning id into v_strom_offer_id;

  insert into public.price_history(offer_id,price,shipping_cost,total_price,checked_at)
  values (v_tbjp_offer_id,11.99,4.99,16.98,now()),
         (v_strom_offer_id,27.95,4.99,32.94,now());

  if (select count(*) from public.products) <> v_products_before
     or (select count(*) from public.product_variants) <> v_variants_before
     or (select count(*) from public.retailer_products) <> v_mappings_before+2
     or (select count(*) from public.offers) <> v_offers_before+2
     or (select count(*) from public.price_history) <> v_history_before+2 then
    raise exception 'Reviewed Discount multivitamin rollout row-count mismatch';
  end if;

  if not exists (
       select 1 from public.products where id=816
         and name='Trained By JP The One Multivitamin 60 Capsules'
         and product_format='capsule' and unit_count=60 and unit_type='capsule'
     )
     or not exists (
       select 1 from public.products where id=824
         and product_format='tablet' and unit_count=180 and unit_type='tablet'
     )
     or (select count(*) from public.retailer_products
         where retailer_id=4 and external_variant_id in ('55157496185210','42518690463940')) <> 2
     or (select count(*) from public.offers
         where retailer_id=4 and retailer_product_id in (v_tbjp_mapping_id,v_strom_mapping_id)
           and in_stock) <> 2
     or (select count(*) from public.price_history
         where offer_id in (v_tbjp_offer_id,v_strom_offer_id)) <> 2 then
    raise exception 'Reviewed Discount multivitamin rollout postcondition mismatch';
  end if;
end
$add_two_reviewed_discount_multivitamin_offers$;

commit;
