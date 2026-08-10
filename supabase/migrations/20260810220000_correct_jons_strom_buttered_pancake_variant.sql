begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $correction$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_rows integer;
  v_history_count bigint;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Jon''s Strom Buttered Pancake correction requires production database owner';
  end if;
  if not exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='jons-23-563ef072fa3fd68c-production'
      and authorized_by='owner-approved-chat-2026-08-10-23-jons-oos'
  ) or exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings
    where authorization_id='jons-23-563ef072fa3fd68c-production'
  ) then
    raise exception 'reviewed Jon''s 23-OOS authorization is missing or already bound';
  end if;
  if not exists(
    select 1 from public.products
    where id=838 and name='Strom Sports Cream of Rice 2kg'
      and product_format='powder' and is_active and merged_into_product_id is null
  ) then
    raise exception 'Strom Cream of Rice canonical product precondition mismatch';
  end if;
  if not exists(
    select 1 from public.product_variants
    where id=1185 and product_id=838 and variant_key='default'
      and display_name='Default' and flavour_code is null and flavour_label is null
      and size_value is null and size_unit is null and pack_count is null
      and product_format is null and is_active and is_default
  ) then
    raise exception 'Strom Buttered Pancake default variant precondition mismatch';
  end if;
  if exists(
    select 1 from public.product_variants
    where product_id=838 and id<>1185 and (
      variant_key='buttered-pancake-2000g'
      or lower(coalesce(flavour_code,''))='buttered pancake'
      or lower(coalesce(flavour_label,''))='buttered pancake'
    )
  ) then
    raise exception 'Strom Buttered Pancake variant already exists';
  end if;
  if (select count(*) from public.retailer_products where product_variant_id=1185)<>1
     or not exists(
       select 1 from public.retailer_products
       where id=1299 and retailer_id=10 and product_id=838 and product_variant_id=1185
         and external_product_id='10697591423314'
         and external_variant_id='53111925768530'
         and external_sku='STM55004'
         and coalesce(external_options,'{}'::jsonb)='{}'::jsonb
         and external_url='https://jonssupplements.co.uk/products/strom-sports-cream-of-rice-2kg?variant=53111925768530'
     ) then
    raise exception 'Strom Buttered Pancake mapping precondition mismatch';
  end if;
  if (select count(*) from public.offers where product_variant_id=1185)<>1
     or not exists(
       select 1 from public.offers
       where id=1113 and retailer_id=10 and product_id=838
         and product_variant_id=1185 and retailer_product_id=1299
         and price=17.99 and shipping_cost=3.99 and total_price=21.98
         and in_stock
         and url='https://jonssupplements.co.uk/products/strom-sports-cream-of-rice-2kg?variant=53111925768530'
     ) then
    raise exception 'Strom Buttered Pancake offer precondition mismatch';
  end if;
  select count(*) into v_history_count from public.price_history where offer_id=1113;

  update public.product_variants
  set variant_key='buttered-pancake-2000g',
      display_name='Buttered Pancake / 2000g',
      flavour_code='buttered pancake',
      flavour_label='Buttered Pancake',
      size_value=2000,
      size_unit='g',
      pack_count=1,
      product_format='powder',
      is_default=false
  where id=1185 and product_id=838 and variant_key='default' and is_default;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception 'Strom Buttered Pancake variant correction affected % rows',v_rows;
  end if;

  update public.retailer_products
  set external_options='{"Size":"2000g","Flavour":"Buttered Pancake"}'::jsonb,
      updated_at=now()
  where id=1299 and retailer_id=10 and product_id=838 and product_variant_id=1185
    and external_product_id='10697591423314' and external_variant_id='53111925768530';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception 'Strom Buttered Pancake mapping correction affected % rows',v_rows;
  end if;

  if not exists(
    select 1
    from public.product_variants v
    join public.retailer_products rp on rp.product_variant_id=v.id
    join public.offers o on o.retailer_product_id=rp.id
    where v.id=1185 and v.product_id=838
      and v.variant_key='buttered-pancake-2000g'
      and v.display_name='Buttered Pancake / 2000g'
      and v.flavour_code='buttered pancake' and v.flavour_label='Buttered Pancake'
      and v.size_value=2000 and v.size_unit='g' and v.pack_count=1
      and v.product_format='powder' and v.is_active and not v.is_default
      and rp.id=1299
      and rp.external_options='{"Size":"2000g","Flavour":"Buttered Pancake"}'::jsonb
      and o.id=1113 and o.product_variant_id=1185 and o.in_stock
      and o.price=17.99 and o.shipping_cost=3.99 and o.total_price=21.98
  ) or (select count(*) from public.price_history where offer_id=1113)<>v_history_count then
    raise exception 'Strom Buttered Pancake correction postcondition mismatch';
  end if;
end
$correction$;

commit;
