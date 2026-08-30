begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.products, public.product_variants, public.retailer_products,
  public.offers, public.price_history in share row exclusive mode;

do $owner_approved_ebay_2582$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_counts_before jsonb;
  v_rows integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Owner-approved eBay offer 2582 rebind requires production database owner';
  end if;
  if (select count(*) from public.retailer_products where retailer_id=12) <> 237
     or (select count(*) from public.offers where retailer_id=12) <> 237 then
    raise exception 'eBay exact 237-row scope precondition mismatch';
  end if;
  if not exists(select 1 from public.products where id=832 and name='Time 4 Digestive Enzymes 90 Capsules' and brand='Time 4' and category='Health Supplements' and product_format='capsule' and is_active and merged_into_product_id is null)
     or not exists(select 1 from public.product_variants where id=1179 and product_id=832 and variant_key='default' and display_name='Default' and is_active and is_default)
     or not exists(select 1 from public.product_variants where id=2910 and product_id=832 and variant_key='30-servings' and display_name='30 Servings' and size_value=30 and size_unit='servings' and pack_count=1 and is_active and not is_default)
     or not exists(select 1 from public.retailer_products where id=2767 and retailer_id=12 and product_id=832 and product_variant_id=1179 and external_product_id='315370516891' and external_variant_id='v1|315370516891|0' and external_sku is null and external_gtin='5060420313208' and external_options='{"Number of Pills":"90"}'::jsonb and external_url='https://www.ebay.co.uk/itm/315370516891')
     or not exists(select 1 from public.offers where id=2582 and retailer_id=12 and retailer_product_id=2767 and product_id=832 and product_variant_id=1179 and price=19.99 and shipping_cost=0 and total_price=19.99 and in_stock and url like 'https://www.ebay.co.uk/itm/315370516891%') then
    raise exception 'eBay offer 2582 reviewed before-state mismatch';
  end if;

  select jsonb_build_object('products',(select count(*) from public.products),'variants',(select count(*) from public.product_variants),'mappings',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),'history',(select count(*) from public.price_history)) into v_counts_before;
  update public.retailer_products set product_variant_id=2910, updated_at=now() where id=2767 and retailer_id=12 and product_id=832 and product_variant_id=1179;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'eBay rebind affected % mappings',v_rows; end if;
  update public.offers set product_variant_id=2910 where id=2582 and retailer_id=12 and retailer_product_id=2767 and product_id=832 and product_variant_id=1179;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'eBay rebind affected % offers',v_rows; end if;

  if v_counts_before <> jsonb_build_object('products',(select count(*) from public.products),'variants',(select count(*) from public.product_variants),'mappings',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),'history',(select count(*) from public.price_history))
     or not exists(select 1 from public.retailer_products where id=2767 and retailer_id=12 and product_id=832 and product_variant_id=2910 and external_product_id='315370516891' and external_variant_id='v1|315370516891|0' and external_gtin='5060420313208')
     or not exists(select 1 from public.offers where id=2582 and retailer_id=12 and retailer_product_id=2767 and product_id=832 and product_variant_id=2910 and price=19.99 and shipping_cost=0 and total_price=19.99 and in_stock and url like 'https://www.ebay.co.uk/itm/315370516891%') then
    raise exception 'eBay offer 2582 reviewed postcondition mismatch';
  end if;
end
$owner_approved_ebay_2582$;

commit;
