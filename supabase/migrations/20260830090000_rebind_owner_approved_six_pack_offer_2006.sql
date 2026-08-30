begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.products, public.product_variants, public.retailer_products,
  public.offers, public.price_history in share row exclusive mode;

do $owner_approved_six_pack_2006$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_counts_before jsonb;
  v_rows integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Owner-approved 6 Pack offer 2006 rebind requires production database owner';
  end if;
  if (select count(*) from public.retailer_products where retailer_id=11) <> 506
     or (select count(*) from public.offers where retailer_id=11) <> 506 then
    raise exception '6 Pack exact 506-row scope precondition mismatch';
  end if;
  if not exists(select 1 from public.products where id=982 and name='Nordic Labs Long Jack Tongkat Ali 60 Capsules' and brand='Nordic Labs' and category='Health Supplements' and is_active and merged_into_product_id is null)
     or not exists(select 1 from public.product_variants where id=1922 and product_id=982 and variant_key='default' and display_name='Default' and is_active and is_default)
     or not exists(select 1 from public.product_variants where id=3126 and product_id=982 and variant_key='60-servings' and display_name='60 Servings' and size_value=60 and size_unit='servings' and pack_count=1 and product_format='capsule' and is_active and not is_default)
     or not exists(select 1 from public.retailer_products where id=2192 and retailer_id=11 and product_id=982 and product_variant_id=1922 and external_product_id='16448' and external_variant_id='16448' and external_sku='5060803380070' and external_gtin is null and external_options='{"Brands":"Nordic Labs"}'::jsonb and external_url='https://6pack-supplements.co.uk/product/tongkat-ali-long-jack-60-capsules/')
     or not exists(select 1 from public.offers where id=2006 and retailer_id=11 and retailer_product_id=2192 and product_id=982 and product_variant_id=1922 and price=20.00 and shipping_cost=4.99 and total_price=24.99 and in_stock and url='https://6pack-supplements.co.uk/product/tongkat-ali-long-jack-60-capsules/' and last_checked_at='2026-08-20T03:56:59.298Z'::timestamptz) then
    raise exception '6 Pack offer 2006 reviewed before-state mismatch';
  end if;

  select jsonb_build_object('products',(select count(*) from public.products),'variants',(select count(*) from public.product_variants),'mappings',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),'history',(select count(*) from public.price_history)) into v_counts_before;
  update public.retailer_products set product_variant_id=3126, updated_at=now() where id=2192 and retailer_id=11 and product_id=982 and product_variant_id=1922;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception '6 Pack rebind affected % mappings',v_rows; end if;
  update public.offers set product_variant_id=3126 where id=2006 and retailer_id=11 and retailer_product_id=2192 and product_id=982 and product_variant_id=1922;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception '6 Pack rebind affected % offers',v_rows; end if;

  if v_counts_before <> jsonb_build_object('products',(select count(*) from public.products),'variants',(select count(*) from public.product_variants),'mappings',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),'history',(select count(*) from public.price_history))
     or not exists(select 1 from public.retailer_products where id=2192 and retailer_id=11 and product_id=982 and product_variant_id=3126 and external_product_id='16448' and external_variant_id='16448')
     or not exists(select 1 from public.offers where id=2006 and retailer_id=11 and retailer_product_id=2192 and product_id=982 and product_variant_id=3126 and price=20.00 and shipping_cost=4.99 and total_price=24.99 and in_stock and last_checked_at='2026-08-20T03:56:59.298Z'::timestamptz) then
    raise exception '6 Pack offer 2006 reviewed postcondition mismatch';
  end if;
end
$owner_approved_six_pack_2006$;

commit;
