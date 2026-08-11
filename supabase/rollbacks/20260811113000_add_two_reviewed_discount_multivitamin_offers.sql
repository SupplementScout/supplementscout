begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.products, public.retailer_products, public.offers,
  public.price_history in share row exclusive mode;

do $rollback_two_reviewed_discount_multivitamin_offers$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_tbjp_mapping_id bigint;
  v_strom_mapping_id bigint;
  v_tbjp_offer_id bigint;
  v_strom_offer_id bigint;
  v_tbjp_created_at timestamptz;
  v_strom_created_at timestamptz;
  v_rows integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Reviewed Discount multivitamin rollback requires production database owner';
  end if;

  if not exists (select 1 from supabase_migrations.schema_migrations
      where version='20260811113000' and name='add_two_reviewed_discount_multivitamin_offers') then
    raise exception 'Reviewed Discount migration is not installed';
  end if;

  select id,created_at into v_tbjp_mapping_id,v_tbjp_created_at from public.retailer_products
  where retailer_id=4 and product_id=816 and product_variant_id=1163
    and external_product_id='15002692616570' and external_variant_id='55157496185210'
    and external_sku='TBJP-0046' and external_options='{"Size":"60 Caps"}'::jsonb
    and external_url='https://www.discount-supplements.co.uk/products/trained-by-jp-the-one-multivitamin-60-caps?variant=55157496185210';
  select id,created_at into v_strom_mapping_id,v_strom_created_at from public.retailer_products
  where retailer_id=4 and product_id=824 and product_variant_id=1171
    and external_product_id='7467845877956' and external_variant_id='42518690463940'
    and external_sku='STRO-0072' and external_options='{"Size":"180 Tablets"}'::jsonb
    and external_url='https://www.discount-supplements.co.uk/products/strom-multimax-90-caps?variant=42518690463940';

  select id into v_tbjp_offer_id from public.offers
  where retailer_id=4 and product_id=816 and product_variant_id=1163
    and retailer_product_id=v_tbjp_mapping_id and price=11.99 and shipping_cost=4.99
    and total_price=16.98 and in_stock
    and url='https://www.discount-supplements.co.uk/products/trained-by-jp-the-one-multivitamin-60-caps?variant=55157496185210'
    and last_checked_at=v_tbjp_created_at;
  select id into v_strom_offer_id from public.offers
  where retailer_id=4 and product_id=824 and product_variant_id=1171
    and retailer_product_id=v_strom_mapping_id and price=27.95 and shipping_cost=4.99
    and total_price=32.94 and in_stock
    and url='https://www.discount-supplements.co.uk/products/strom-multimax-90-caps?variant=42518690463940'
    and last_checked_at=v_strom_created_at;

  if v_tbjp_mapping_id is null or v_strom_mapping_id is null
     or v_tbjp_offer_id is null or v_strom_offer_id is null
     or not exists (select 1 from public.products where id=816 and name='Trained By JP The One Multivitamin 60 Capsules' and product_format='capsule' and unit_count=60 and unit_type='capsule')
     or not exists (select 1 from public.products where id=824 and product_format='tablet' and unit_count=180 and unit_type='tablet')
     or (select count(*) from public.price_history where offer_id in (v_tbjp_offer_id,v_strom_offer_id)) <> 2 then
    raise exception 'Reviewed Discount rollback state drifted; use a forward correction';
  end if;

  delete from public.price_history where offer_id in (v_tbjp_offer_id,v_strom_offer_id);
  get diagnostics v_rows=row_count;
  if v_rows <> 2 then raise exception 'Reviewed Discount rollback history count mismatch'; end if;
  delete from public.offers where id in (v_tbjp_offer_id,v_strom_offer_id);
  get diagnostics v_rows=row_count;
  if v_rows <> 2 then raise exception 'Reviewed Discount rollback offer count mismatch'; end if;
  delete from public.retailer_products where id in (v_tbjp_mapping_id,v_strom_mapping_id);
  get diagnostics v_rows=row_count;
  if v_rows <> 2 then raise exception 'Reviewed Discount rollback mapping count mismatch'; end if;

  update public.products set name='Trained by JP The One - Multivitamins',
    product_format='tablet',unit_count=null,unit_type=null where id=816;
  update public.products set unit_count=null,unit_type=null where id=824;

  if exists (select 1 from public.retailer_products where id in (v_tbjp_mapping_id,v_strom_mapping_id))
     or exists (select 1 from public.offers where id in (v_tbjp_offer_id,v_strom_offer_id))
     or exists (select 1 from public.price_history where offer_id in (v_tbjp_offer_id,v_strom_offer_id)) then
    raise exception 'Reviewed Discount rollback postcondition mismatch';
  end if;
end
$rollback_two_reviewed_discount_multivitamin_offers$;

commit;
