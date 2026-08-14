begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.products, public.product_variants, public.retailer_products,
  public.offers, public.price_history in share row exclusive mode;

do $correct_critical_cookie_73g_identity$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
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
    raise exception 'Critical Cookie 73g correction requires production database owner';
  end if;

  if not exists (
       select 1 from public.products
       where id=468 and name='Critical Cookie 12 x 85g'
         and slug='critical-cookie-12-x-85g' and brand='Applied Nutrition'
         and category='Protein Bars' and product_format='snack'
         and gtin is null and is_active and merged_into_product_id is null
     )
     or (select count(*) from public.product_variants where product_id=468) <> 5
     or not exists (
       select 1 from public.product_variants
       where id=429 and product_id=468 and variant_key='default'
         and display_name='Default' and is_active and is_default
     ) then
    raise exception 'Critical Cookie canonical product precondition mismatch';
  end if;

  if (select count(*) from public.product_variants
      where (id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default) in (
        (2696,468,'double-chocolate-85g-12-pack','Double Chocolate Box of 12 / 85g','double-chocolate','Double Chocolate',85,'g',12,'snack',true,false),
        (2697,468,'chocolate-chip-85g-12-pack','Chocolate Chip Box of 12 / 85g','chocolate-chip','Chocolate Chip',85,'g',12,'snack',true,false),
        (2698,468,'white-chocolate-raspberry-85g-12-pack','White Chocolate & Raspberry Box of 12 / 85g','white-chocolate-and-raspberry','White Chocolate & Raspberry',85,'g',12,'snack',true,false),
        (2710,468,'salted-caramel-85g-12-pack','Salted Caramel Box of 12 / 85g','salted-caramel-85g-12-pack','Salted Caramel',85,'g',12,'snack',true,false)
      )) <> 4
     or exists (
       select 1 from public.product_variants
       where product_id=468 and id not in (2696,2697,2698,2710)
         and (variant_key like '%-73g-12-pack' or (size_value=73 and size_unit='g' and pack_count=12))
     ) then
    raise exception 'Critical Cookie 85g variant precondition mismatch';
  end if;

  if (select count(*) from public.retailer_products where product_id=468) <> 4
     or (select count(*) from public.retailer_products
         where id in (469,521,490,475) and retailer_id=3 and product_id=468
           and product_variant_id in (2696,2697,2698,2710)) <> 4
     or (select count(*) from public.offers where product_id=468) <> 4
     or (select count(*) from public.offers
         where retailer_id=3 and product_id=468 and product_variant_id in (2696,2697,2698,2710)
           and retailer_product_id in (469,521,490,475)) <> 4 then
    raise exception 'Critical Cookie retailer identity precondition mismatch';
  end if;

  perform id from public.products where id=468 for update;
  perform id from public.product_variants where product_id=468 order by id for update;

  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;

  update public.products
  set name='Critical Cookie 12 x 73g'
  where id=468 and name='Critical Cookie 12 x 85g'
    and slug='critical-cookie-12-x-85g' and is_active and merged_into_product_id is null;
  get diagnostics v_rows=row_count;
  if v_rows <> 1 then raise exception 'Critical Cookie product correction affected % rows',v_rows; end if;

  update public.product_variants
  set variant_key=case id
        when 2696 then 'double-chocolate-73g-12-pack'
        when 2697 then 'chocolate-chip-73g-12-pack'
        when 2698 then 'white-chocolate-raspberry-73g-12-pack'
        when 2710 then 'salted-caramel-73g-12-pack'
      end,
      display_name=case id
        when 2696 then 'Double Chocolate Box of 12 / 73g'
        when 2697 then 'Chocolate Chip Box of 12 / 73g'
        when 2698 then 'White Chocolate & Raspberry Box of 12 / 73g'
        when 2710 then 'Salted Caramel Box of 12 / 73g'
      end,
      size_value=73
  where product_id=468 and id in (2696,2697,2698,2710)
    and size_value=85 and size_unit='g' and pack_count=12 and product_format='snack'
    and is_active and not is_default;
  get diagnostics v_rows=row_count;
  if v_rows <> 4 then raise exception 'Critical Cookie variant correction affected % rows',v_rows; end if;

  if (select count(*) from public.products) <> v_products_before
     or (select count(*) from public.product_variants) <> v_variants_before
     or (select count(*) from public.retailer_products) <> v_mappings_before
     or (select count(*) from public.offers) <> v_offers_before
     or (select count(*) from public.price_history) <> v_history_before then
    raise exception 'Critical Cookie correction changed a forbidden row count';
  end if;

  if not exists (
       select 1 from public.products
       where id=468 and name='Critical Cookie 12 x 73g'
         and slug='critical-cookie-12-x-85g' and brand='Applied Nutrition'
         and category='Protein Bars' and product_format='snack'
         and gtin is null and is_active and merged_into_product_id is null
     )
     or (select count(*) from public.product_variants
         where product_id=468 and id in (2696,2697,2698,2710)
           and size_value=73 and size_unit='g' and pack_count=12
           and product_format='snack' and is_active and not is_default) <> 4
     or not exists (select 1 from public.product_variants where id=2696 and variant_key='double-chocolate-73g-12-pack' and display_name='Double Chocolate Box of 12 / 73g')
     or not exists (select 1 from public.product_variants where id=2697 and variant_key='chocolate-chip-73g-12-pack' and display_name='Chocolate Chip Box of 12 / 73g')
     or not exists (select 1 from public.product_variants where id=2698 and variant_key='white-chocolate-raspberry-73g-12-pack' and display_name='White Chocolate & Raspberry Box of 12 / 73g')
     or not exists (select 1 from public.product_variants where id=2710 and variant_key='salted-caramel-73g-12-pack' and display_name='Salted Caramel Box of 12 / 73g')
     or (select count(*) from public.retailer_products where product_id=468) <> 4
     or (select count(*) from public.offers where product_id=468) <> 4 then
    raise exception 'Critical Cookie 73g correction postcondition mismatch';
  end if;
end
$correct_critical_cookie_73g_identity$;

commit;
