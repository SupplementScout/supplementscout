begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.products, public.product_variants, public.retailer_products,
  public.offers, public.price_history in share row exclusive mode;

do $owner_approved_ebay_2581$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_counts_before jsonb;
  v_rows integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Owner-approved eBay offer 2581 rebind requires production database owner';
  end if;
  if (select count(*) from public.retailer_products where retailer_id=12) <> 237
     or (select count(*) from public.offers where retailer_id=12) <> 237 then
    raise exception 'eBay exact 237-row scope precondition mismatch';
  end if;
  if not exists(select 1 from public.products where id=831 and name='Time 4 Collagen+ 45 Servings' and brand='Time 4' and category='Health Supplements' and is_active and merged_into_product_id is null)
     or not exists(select 1 from public.product_variants where id=1178 and product_id=831 and variant_key='default' and display_name='Default' and is_active and is_default)
     or not exists(select 1 from public.product_variants where id=2920 and product_id=831 and variant_key='405g' and display_name='405g' and size_value=405 and size_unit='g' and pack_count=1 and is_active and not is_default)
     or not exists(select 1 from public.retailer_products where id=2766 and retailer_id=12 and product_id=831 and product_variant_id=1178 and external_product_id='313270204105' and external_variant_id='v1|313270204105|0' and external_sku is null and external_gtin is null and external_options='{"Supply":"45 Servings - 405g Tub"}'::jsonb and external_url='https://www.ebay.co.uk/itm/313270204105')
     or not exists(select 1 from public.offers where id=2581 and retailer_id=12 and retailer_product_id=2766 and product_id=831 and product_variant_id=1178 and price=29.99 and shipping_cost=0 and total_price=29.99 and in_stock and url like 'https://www.ebay.co.uk/itm/313270204105%') then
    raise exception 'eBay offer 2581 reviewed before-state mismatch';
  end if;

  select jsonb_build_object('products',(select count(*) from public.products),'variants',(select count(*) from public.product_variants),'mappings',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),'history',(select count(*) from public.price_history)) into v_counts_before;
  update public.retailer_products set product_variant_id=2920, updated_at=now() where id=2766 and retailer_id=12 and product_id=831 and product_variant_id=1178;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'eBay rebind affected % mappings',v_rows; end if;
  update public.offers set product_variant_id=2920 where id=2581 and retailer_id=12 and retailer_product_id=2766 and product_id=831 and product_variant_id=1178;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'eBay rebind affected % offers',v_rows; end if;

  if v_counts_before <> jsonb_build_object('products',(select count(*) from public.products),'variants',(select count(*) from public.product_variants),'mappings',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),'history',(select count(*) from public.price_history))
     or not exists(select 1 from public.retailer_products where id=2766 and retailer_id=12 and product_id=831 and product_variant_id=2920 and external_product_id='313270204105' and external_variant_id='v1|313270204105|0')
     or not exists(select 1 from public.offers where id=2581 and retailer_id=12 and retailer_product_id=2766 and product_id=831 and product_variant_id=2920 and price=29.99 and shipping_cost=0 and total_price=29.99 and in_stock) then
    raise exception 'eBay offer 2581 reviewed postcondition mismatch';
  end if;
end
$owner_approved_ebay_2581$;

commit;
