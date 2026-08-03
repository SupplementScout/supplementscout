begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $correction$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_rows integer;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Jon''s Creamax Lemonade correction requires production database owner';
  end if;

  if not exists(
    select 1 from public.products
    where id=850 and name='Strom Sports Creamax 460g'
      and is_active and merged_into_product_id is null
  ) then
    raise exception 'Jon''s Creamax product precondition mismatch';
  end if;
  if not exists(
    select 1 from public.product_variants
    where id=1255 and product_id=850 and variant_key='default'
      and display_name='Default' and flavour_code is null and flavour_label is null
      and size_value is null and size_unit is null and pack_count is null
      and product_format is null and is_active and is_default
  ) then
    raise exception 'Jon''s Creamax default variant precondition mismatch';
  end if;
  if exists(
    select 1 from public.product_variants
    where product_id=850 and id<>1255
      and (variant_key='lemonade-460g'
        or lower(coalesce(flavour_code,''))='lemonade'
        or lower(coalesce(flavour_label,''))='lemonade')
  ) then
    raise exception 'Jon''s Creamax Lemonade variant already exists';
  end if;
  if (select count(*) from public.retailer_products where product_variant_id=1255)<>1
     or not exists(
       select 1 from public.retailer_products
       where id=1369 and retailer_id=10 and product_id=850 and product_variant_id=1255
         and external_product_id='10083514876242'
         and external_variant_id='50844852519250'
         and external_sku='STM26004'
         and coalesce(external_options,'{}'::jsonb)='{}'::jsonb
         and external_url='https://jonssupplements.co.uk/products/strom-sports-creamax-460g-lemonade?variant=50844852519250'
     ) then
    raise exception 'Jon''s Creamax Lemonade mapping precondition mismatch';
  end if;
  if (select count(*) from public.offers where product_variant_id=1255)<>1
     or not exists(
       select 1 from public.offers
       where id=1183 and retailer_id=10 and product_id=850
         and product_variant_id=1255 and retailer_product_id=1369
         and price=37.49 and shipping_cost=3.99 and total_price=41.48
         and in_stock
         and url='https://jonssupplements.co.uk/products/strom-sports-creamax-460g-lemonade?variant=50844852519250'
     ) then
    raise exception 'Jon''s Creamax Lemonade offer precondition mismatch';
  end if;

  update public.product_variants
  set variant_key='lemonade-460g',display_name='Lemonade / 460g',
      flavour_code='lemonade',flavour_label='Lemonade',size_value=460,
      size_unit='g',pack_count=1,product_format='powder',is_default=false
  where id=1255 and product_id=850 and variant_key='default' and is_default;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Creamax Lemonade variant correction affected % rows',v_rows; end if;

  update public.retailer_products
  set external_options='{"Size":"460g","Flavour":"Lemonade"}'::jsonb,
      updated_at=now()
  where id=1369 and retailer_id=10 and product_variant_id=1255
    and external_product_id='10083514876242' and external_variant_id='50844852519250';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Creamax Lemonade mapping correction affected % rows',v_rows; end if;

  if not exists(
    select 1
    from public.product_variants v
    join public.retailer_products rp on rp.product_variant_id=v.id
    join public.offers o on o.retailer_product_id=rp.id
    where v.id=1255 and v.product_id=850 and v.variant_key='lemonade-460g'
      and v.display_name='Lemonade / 460g' and v.flavour_code='lemonade'
      and v.flavour_label='Lemonade' and v.size_value=460 and v.size_unit='g'
      and v.pack_count=1 and v.product_format='powder' and v.is_active and not v.is_default
      and rp.id=1369
      and rp.external_options='{"Size":"460g","Flavour":"Lemonade"}'::jsonb
      and o.id=1183 and o.product_variant_id=1255 and o.price=37.49
      and o.shipping_cost=3.99 and o.total_price=41.48 and o.in_stock
  ) then
    raise exception 'Jon''s Creamax Lemonade correction postcondition mismatch';
  end if;
end
$correction$;

commit;
