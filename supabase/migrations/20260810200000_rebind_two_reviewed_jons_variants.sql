begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rebind_two_jons_variants$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_rows integer;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Two reviewed Jon''s variant rebinds require production database owner';
  end if;
  if (select count(*) from public.retailer_products where retailer_id=10)<>506
     or (select count(*) from public.offers where retailer_id=10)<>506 then
    raise exception 'Jon''s exact 506/506 scope precondition mismatch';
  end if;
  if exists(
    select 1 from public.retailer_products
    where retailer_id=10 and external_variant_id in ('54182107578706','54181091279186')
  ) then
    raise exception 'Reviewed Jon''s replacement identity is already mapped';
  end if;
  if not exists(
    select 1 from public.product_variants
    where id=1282 and product_id=858 and variant_key='chocomel-cups-2000g'
      and display_name='Chocomel cups / 2000g' and is_active and not is_default
  ) or not exists(
    select 1 from public.retailer_products
    where id=1396 and retailer_id=10 and product_id=858 and product_variant_id=1282
      and external_product_id='10044164899154' and external_variant_id='50666562126162'
      and external_sku='CNP60004'
      and external_options='{"Size":"2000g","Flavour":"Chocomel cups"}'::jsonb
  ) or not exists(
    select 1 from public.offers
    where id=1210 and retailer_product_id=1396 and product_variant_id=1282
      and price=16.95 and shipping_cost=3.99 and total_price=20.94 and not in_stock
  ) then
    raise exception 'Jon''s Chocomel Cups reviewed precondition mismatch';
  end if;
  if not exists(
    select 1 from public.product_variants
    where id=1311 and product_id=866 and variant_key='salted-caramel-2000g'
      and display_name='Salted Caramel / 2000g' and is_active and not is_default
  ) or not exists(
    select 1 from public.retailer_products
    where id=1425 and retailer_id=10 and product_id=866 and product_variant_id=1311
      and external_product_id='10032290431314' and external_variant_id='50602413883730'
      and external_sku='CNP09006'
      and external_options='{"Flavour":"Salted Caramel"}'::jsonb
  ) or not exists(
    select 1 from public.offers
    where id=1239 and retailer_product_id=1425 and product_variant_id=1311
      and price=49.99 and shipping_cost=3.99 and total_price=53.98 and in_stock
  ) then
    raise exception 'Jon''s Salted Caramel reviewed precondition mismatch';
  end if;

  update public.retailer_products
  set external_variant_id='54182107578706',external_sku='CNP60004',
      external_options='{"Size":"2000g","Flavour":"Chocolate Caramel"}'::jsonb,
      external_url='https://jonssupplements.co.uk/products/cnp-professional-cream-of-rice-2kg?variant=54182107578706',
      updated_at=now()
  where id=1396 and external_variant_id='50666562126162';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Jon''s Chocomel rebind affected % mappings',v_rows; end if;
  update public.offers
  set url='https://jonssupplements.co.uk/products/cnp-professional-cream-of-rice-2kg?variant=54182107578706'
  where id=1210 and retailer_product_id=1396
    and url='https://jonssupplements.co.uk/products/cnp-professional-cream-of-rice-2kg?variant=50666562126162';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Jon''s Chocomel rebind affected % offers',v_rows; end if;

  update public.retailer_products
  set external_variant_id='54181091279186',external_sku='CNP09006',
      external_options='{"Flavour":"Salted Caramel"}'::jsonb,
      external_url='https://jonssupplements.co.uk/products/cnp-professional-premium-whey-protein-2kg?variant=54181091279186',
      updated_at=now()
  where id=1425 and external_variant_id='50602413883730';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Jon''s Salted Caramel rebind affected % mappings',v_rows; end if;
  update public.offers
  set url='https://jonssupplements.co.uk/products/cnp-professional-premium-whey-protein-2kg?variant=54181091279186'
  where id=1239 and retailer_product_id=1425
    and url='https://jonssupplements.co.uk/products/cnp-professional-premium-whey-protein-900g?variant=50602413883730';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Jon''s Salted Caramel rebind affected % offers',v_rows; end if;

  if (select count(*) from public.retailer_products where retailer_id=10)<>506
     or (select count(*) from public.offers where retailer_id=10)<>506
     or (select count(*) from public.retailer_products
         where id in (1396,1425) and external_variant_id in ('54182107578706','54181091279186'))<>2
     or (select count(*) from public.offers
         where id in (1210,1239)
           and url in (
             'https://jonssupplements.co.uk/products/cnp-professional-cream-of-rice-2kg?variant=54182107578706',
             'https://jonssupplements.co.uk/products/cnp-professional-premium-whey-protein-2kg?variant=54181091279186'))<>2 then
    raise exception 'Two reviewed Jon''s rebinds postcondition mismatch';
  end if;
end
$rebind_two_jons_variants$;

commit;
