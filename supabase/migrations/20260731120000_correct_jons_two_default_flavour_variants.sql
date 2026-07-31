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
    raise exception 'Jon''s default flavour correction requires production database owner';
  end if;

  if not exists(select 1 from public.products where id=841 and name='Conteh Sports Essential Gains EAA 465g' and is_active and merged_into_product_id is null)
     or not exists(select 1 from public.products where id=856 and name='Trained By JP EAA + Hydration 300g' and is_active and merged_into_product_id is null) then
    raise exception 'Jon''s default flavour product precondition mismatch';
  end if;
  if not exists(
    select 1 from public.product_variants where id=1188 and product_id=841
      and variant_key='default' and display_name='Default' and flavour_code is null
      and flavour_label is null and size_value is null and size_unit is null
      and pack_count is null and product_format is null and is_active and is_default
  ) or not exists(
    select 1 from public.product_variants where id=1261 and product_id=856
      and variant_key='default' and display_name='Default' and flavour_code is null
      and flavour_label is null and size_value is null and size_unit is null
      and pack_count is null and product_format is null and is_active and is_default
  ) then
    raise exception 'Jon''s default flavour variant precondition mismatch';
  end if;
  if exists(
    select 1 from public.product_variants where product_id=841 and id<>1188
      and (variant_key='berry-465g' or lower(coalesce(flavour_code,''))='berry' or lower(coalesce(flavour_label,''))='berry')
  ) or exists(
    select 1 from public.product_variants where product_id=856 and id<>1261
      and (variant_key='fizzy-blue-bottles-300g' or lower(coalesce(flavour_code,''))='fizzy blue bottles' or lower(coalesce(flavour_label,''))='fizzy blue bottles')
  ) then
    raise exception 'Jon''s corrected flavour variant already exists';
  end if;
  if (select count(*) from public.retailer_products where product_variant_id=1188)<>1
     or not exists(
       select 1 from public.retailer_products where id=1302 and retailer_id=10
         and product_id=841 and product_variant_id=1188
         and external_product_id='10563642065234' and external_variant_id='52597672542546'
         and external_sku is null and coalesce(external_options,'{}'::jsonb)='{}'::jsonb
     )
     or (select count(*) from public.retailer_products where product_variant_id=1261)<>1
     or not exists(
       select 1 from public.retailer_products where id=1375 and retailer_id=10
         and product_id=856 and product_variant_id=1261
         and external_product_id='10088748908882' and external_variant_id='50838685286738'
         and external_sku='TBJ019' and coalesce(external_options,'{}'::jsonb)='{}'::jsonb
     ) then
    raise exception 'Jon''s default flavour mapping precondition mismatch';
  end if;
  if (select count(*) from public.offers where product_variant_id=1188)<>1
     or not exists(select 1 from public.offers where id=1116 and retailer_id=10 and product_id=841 and product_variant_id=1188 and retailer_product_id=1302)
     or (select count(*) from public.offers where product_variant_id=1261)<>1
     or not exists(select 1 from public.offers where id=1189 and retailer_id=10 and product_id=856 and product_variant_id=1261 and retailer_product_id=1375) then
    raise exception 'Jon''s default flavour offer precondition mismatch';
  end if;

  update public.product_variants
  set variant_key='berry-465g',display_name='Berry / 465g',flavour_code='berry',
      flavour_label='Berry',size_value=465,size_unit='g',pack_count=1,
      product_format='powder',is_default=false
  where id=1188 and product_id=841 and variant_key='default' and is_default;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Conteh Berry variant correction affected % rows',v_rows; end if;

  update public.product_variants
  set variant_key='fizzy-blue-bottles-300g',display_name='Fizzy Blue Bottles / 300g',
      flavour_code='fizzy blue bottles',flavour_label='Fizzy Blue Bottles',
      size_value=300,size_unit='g',pack_count=1,product_format='powder',is_default=false
  where id=1261 and product_id=856 and variant_key='default' and is_default;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Trained By JP Fizzy Blue Bottles variant correction affected % rows',v_rows; end if;

  update public.retailer_products
  set external_options='{"Size":"465g","Flavour":"Berry"}'::jsonb,updated_at=now()
  where id=1302 and retailer_id=10 and product_variant_id=1188
    and external_product_id='10563642065234' and external_variant_id='52597672542546';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Conteh Berry mapping correction affected % rows',v_rows; end if;

  update public.retailer_products
  set external_options='{"Size":"300g","Flavour":"Fizzy Blue Bottles"}'::jsonb,updated_at=now()
  where id=1375 and retailer_id=10 and product_variant_id=1261
    and external_product_id='10088748908882' and external_variant_id='50838685286738';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Trained By JP Fizzy Blue Bottles mapping correction affected % rows',v_rows; end if;

  if not exists(
    select 1 from public.product_variants v join public.retailer_products rp on rp.product_variant_id=v.id
    join public.offers o on o.retailer_product_id=rp.id
    where v.id=1188 and v.product_id=841 and v.variant_key='berry-465g'
      and v.display_name='Berry / 465g' and v.flavour_code='berry' and v.flavour_label='Berry'
      and v.size_value=465 and v.size_unit='g' and v.pack_count=1 and v.product_format='powder'
      and v.is_active and not v.is_default and rp.id=1302
      and rp.external_options='{"Size":"465g","Flavour":"Berry"}'::jsonb and o.id=1116
  ) or not exists(
    select 1 from public.product_variants v join public.retailer_products rp on rp.product_variant_id=v.id
    join public.offers o on o.retailer_product_id=rp.id
    where v.id=1261 and v.product_id=856 and v.variant_key='fizzy-blue-bottles-300g'
      and v.display_name='Fizzy Blue Bottles / 300g' and v.flavour_code='fizzy blue bottles'
      and v.flavour_label='Fizzy Blue Bottles' and v.size_value=300 and v.size_unit='g'
      and v.pack_count=1 and v.product_format='powder' and v.is_active and not v.is_default
      and rp.id=1375 and rp.external_options='{"Size":"300g","Flavour":"Fizzy Blue Bottles"}'::jsonb and o.id=1189
  ) then
    raise exception 'Jon''s default flavour correction postcondition mismatch';
  end if;
end
$correction$;

commit;
