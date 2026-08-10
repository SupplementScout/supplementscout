begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rebind_jons_fruit_twist$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_rows integer;
  v_new_url text:='https://jonssupplements.co.uk/products/cnp-professional-loaded-eaa-300g?variant=54181852283218';
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Jon''s Loaded EAA Fruit Twist rebind requires production database owner';
  end if;
  if (select count(*) from public.retailer_products where retailer_id=10)<>506
     or (select count(*) from public.offers where retailer_id=10)<>506 then
    raise exception 'Jon''s exact 506/506 scope precondition mismatch';
  end if;
  if not exists(
    select 1 from public.products
    where id=745 and name='CNP Loaded EAA 300g'
      and is_active and merged_into_product_id is null
  ) or not exists(
    select 1 from public.product_variants
    where id=823 and product_id=745 and variant_key='twisted-fruit-300g'
      and display_name='Twisted Fruit / 300g'
      and flavour_code='twisted fruit' and flavour_label='Twisted Fruit'
      and size_value=300 and size_unit='g' and pack_count=1
      and product_format='powder' and is_active and not is_default
  ) then
    raise exception 'Jon''s Loaded EAA canonical identity precondition mismatch';
  end if;
  if not exists(
    select 1 from public.retailer_products
    where id=1208 and retailer_id=10 and product_id=745 and product_variant_id=823
      and external_product_id='10034302124370'
      and external_variant_id='50608174924114' and external_sku='CNP27009'
      and external_options='{"Flavour":"Twisted Fruit"}'::jsonb
      and external_url='https://jonssupplements.co.uk/products/cnp-professional-loaded-eaa-300g?variant=50608174924114'
  ) or not exists(
    select 1 from public.offers
    where id=1022 and retailer_id=10 and product_id=745 and product_variant_id=823
      and retailer_product_id=1208 and price=18.99 and shipping_cost=3.99
      and total_price=22.98 and in_stock
      and url='https://jonssupplements.co.uk/products/cnp-professional-loaded-eaa-300g?variant=50608174924114'
  ) then
    raise exception 'Jon''s Loaded EAA old Fruit Twist state mismatch';
  end if;
  if exists(
    select 1 from public.retailer_products
    where retailer_id=10 and external_variant_id='54181852283218'
  ) then
    raise exception 'Jon''s new Fruit Twist source identity is already mapped';
  end if;
  if not exists(
    select 1 from public.retailer_products rp
    join public.offers o on o.retailer_product_id=rp.id
    where rp.id=1383 and rp.retailer_id=10 and rp.product_id=745
      and rp.product_variant_id=1269
      and rp.external_product_id='10034302124370'
      and rp.external_variant_id='50608174694738'
      and rp.external_sku='CNP27003'
      and rp.external_options='{"Size":"300g","Flavour":"Fruit Salad"}'::jsonb
      and o.id=1197 and o.product_variant_id=1269
  ) then
    raise exception 'Jon''s distinct Fruit Salad mapping precondition mismatch';
  end if;

  update public.retailer_products
  set external_variant_id='54181852283218',external_sku='CNP27003',
      external_options='{"Flavour":"Fruit Twist"}'::jsonb,
      external_url=v_new_url,updated_at=now()
  where id=1208 and retailer_id=10 and product_id=745 and product_variant_id=823
    and external_variant_id='50608174924114';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Jon''s Fruit Twist rebind affected % mappings',v_rows; end if;

  update public.offers
  set url=v_new_url
  where id=1022 and retailer_id=10 and product_id=745 and product_variant_id=823
    and retailer_product_id=1208
    and url='https://jonssupplements.co.uk/products/cnp-professional-loaded-eaa-300g?variant=50608174924114';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Jon''s Fruit Twist rebind affected % offers',v_rows; end if;

  if (select count(*) from public.retailer_products where retailer_id=10)<>506
     or (select count(*) from public.offers where retailer_id=10)<>506
     or not exists(
       select 1 from public.retailer_products rp
       join public.offers o on o.retailer_product_id=rp.id
       where rp.id=1208 and rp.product_id=745 and rp.product_variant_id=823
         and rp.external_product_id='10034302124370'
         and rp.external_variant_id='54181852283218' and rp.external_sku='CNP27003'
         and rp.external_options='{"Flavour":"Fruit Twist"}'::jsonb
         and rp.external_url=v_new_url and o.id=1022 and o.url=v_new_url
         and o.price=18.99 and o.shipping_cost=3.99 and o.total_price=22.98 and o.in_stock
     ) then
    raise exception 'Jon''s Fruit Twist rebind postcondition mismatch';
  end if;
end
$rebind_jons_fruit_twist$;

commit;
