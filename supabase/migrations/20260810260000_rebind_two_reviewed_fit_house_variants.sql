begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.products, public.product_variants, public.retailer_products,
  public.offers, public.price_history in share row exclusive mode;

do $rebind_two_fit_house_variants$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_products_before bigint;
  v_variants_before bigint;
  v_mappings_before bigint;
  v_offers_before bigint;
  v_history_before bigint;
  v_rows integer;
  v_definition text;
  v_old_manifest_sha constant text:='8a3653774c7169b40db0dfa129bba83d3cb496b17f25513a256b8fa84999897f';
  v_new_manifest_sha constant text:='a1e596f7707c851534e04e30d13f4289439449556787c572736e77b279c75292';
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Two reviewed Fit House variant rebinds require production database owner';
  end if;
  if (select count(*) from public.retailer_products where retailer_id=9)<>286
     or (select count(*) from public.offers where retailer_id=9)<>286 then
    raise exception 'Fit House exact 286/286 scope precondition mismatch';
  end if;
  if exists(
    select 1 from public.retailer_catalogue_parent_plans
    where retailer_id=9 and target_environment='PRODUCTION'
      and status in ('PLANNED','APPROVED','PARTIALLY_APPLIED','FAILED')
  ) then
    raise exception 'Fit House rebind is blocked by an existing active control plan';
  end if;
  if exists(
    select 1 from public.retailer_products
    where retailer_id=9
      and external_variant_id in ('50234901954800','50235877982448')
  ) then
    raise exception 'Reviewed Fit House replacement identity is already mapped';
  end if;

  if not exists(
    select 1 from public.product_variants
    where id=595 and product_id=716 and variant_key='default'
      and display_name='Default' and is_active and is_default
  ) or not exists(
    select 1 from public.retailer_products
    where id=797 and retailer_id=9 and product_id=716 and product_variant_id=595
      and external_product_id='8493540278512'
      and external_variant_id='45060374167792'
      and external_sku is null and external_options is null
      and external_url='https://fithouse.uk/products/osavi-maca-1000mg-120-vege-caps?variant=45060374167792'
  ) or not exists(
    select 1 from public.offers
    where id=735 and retailer_id=9 and retailer_product_id=797
      and product_id=716 and product_variant_id=595
      and price=14.99 and shipping_cost=3.99 and total_price=18.98 and in_stock
      and url='https://fithouse.uk/products/osavi-maca-1000mg-120-vege-caps?variant=45060374167792'
  ) then
    raise exception 'Fit House Osavi Maca reviewed precondition mismatch';
  end if;

  if not exists(
    select 1 from public.product_variants
    where id=917 and product_id=165
      and variant_key='peanut-butter-chocolate-chip-113g'
      and display_name='Peanut Butter Chocolate Chip / 113g'
      and flavour_label='Peanut Butter Chocolate Chip'
      and size_value=113 and size_unit='g' and pack_count=1
      and is_active and not is_default
  ) or not exists(
    select 1 from public.retailer_products
    where id=1102 and retailer_id=9 and product_id=165 and product_variant_id=917
      and external_product_id='9674420912368'
      and external_variant_id='48124051816688'
      and external_sku is null
      and external_options='{"Flavor":"Peanut Butter Chocolate Chip"}'::jsonb
      and external_url='https://fithouse.uk/products/lenny-larrys-the-complete-cookie-113-g?variant=48124051816688'
  ) or not exists(
    select 1 from public.offers
    where id=916 and retailer_id=9 and retailer_product_id=1102
      and product_id=165 and product_variant_id=917
      and price=2.50 and shipping_cost=3.99 and total_price=6.49 and in_stock
      and url='https://fithouse.uk/products/lenny-larrys-the-complete-cookie-113-g?variant=48124051816688'
  ) then
    raise exception 'Fit House Lenny cookie reviewed precondition mismatch';
  end if;

  select pg_get_functiondef(
    'public.register_fit_house_offer_sync_control_plan(jsonb)'::regprocedure
  ) into v_definition;
  if v_definition is null
     or position(v_old_manifest_sha in v_definition)=0
     or position(v_new_manifest_sha in v_definition)>0 then
    raise exception 'Fit House registration manifest binding precondition mismatch';
  end if;

  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;

  update public.retailer_products
  set external_variant_id='50234901954800',
      external_options='{"Capsules":"120"}'::jsonb,
      external_url='https://fithouse.uk/products/osavi-maca-1000mg-120-vege-caps?variant=50234901954800',
      updated_at=now()
  where id=797 and retailer_id=9
    and external_product_id='8493540278512'
    and external_variant_id='45060374167792';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Fit House Osavi Maca rebind affected % mappings',v_rows; end if;

  update public.offers
  set url='https://fithouse.uk/products/osavi-maca-1000mg-120-vege-caps?variant=50234901954800'
  where id=735 and retailer_product_id=797
    and url='https://fithouse.uk/products/osavi-maca-1000mg-120-vege-caps?variant=45060374167792';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Fit House Osavi Maca rebind affected % offers',v_rows; end if;

  update public.retailer_products
  set external_variant_id='50235877982448',
      external_options='{"Flavour ":"Peanut Butter Chocolate Chip"}'::jsonb,
      external_url='https://fithouse.uk/products/lenny-larrys-the-complete-cookie-113-g?variant=50235877982448',
      updated_at=now()
  where id=1102 and retailer_id=9
    and external_product_id='9674420912368'
    and external_variant_id='48124051816688';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Fit House Lenny cookie rebind affected % mappings',v_rows; end if;

  update public.offers
  set url='https://fithouse.uk/products/lenny-larrys-the-complete-cookie-113-g?variant=50235877982448'
  where id=916 and retailer_product_id=1102
    and url='https://fithouse.uk/products/lenny-larrys-the-complete-cookie-113-g?variant=48124051816688';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Fit House Lenny cookie rebind affected % offers',v_rows; end if;

  execute replace(v_definition,v_old_manifest_sha,v_new_manifest_sha);

  if (select count(*) from public.products)<>v_products_before
     or (select count(*) from public.product_variants)<>v_variants_before
     or (select count(*) from public.retailer_products)<>v_mappings_before
     or (select count(*) from public.offers)<>v_offers_before
     or (select count(*) from public.price_history)<>v_history_before
     or (select count(*) from public.retailer_products where retailer_id=9)<>286
     or (select count(*) from public.offers where retailer_id=9)<>286 then
    raise exception 'Two reviewed Fit House rebinds changed a forbidden row count';
  end if;
  if not exists(
    select 1 from public.retailer_products
    where id=797 and product_id=716 and product_variant_id=595
      and external_product_id='8493540278512' and external_variant_id='50234901954800'
      and external_sku is null and external_options='{"Capsules":"120"}'::jsonb
      and external_url='https://fithouse.uk/products/osavi-maca-1000mg-120-vege-caps?variant=50234901954800'
  ) or not exists(
    select 1 from public.offers
    where id=735 and product_id=716 and product_variant_id=595 and retailer_product_id=797
      and price=14.99 and shipping_cost=3.99 and total_price=18.98 and in_stock
      and url='https://fithouse.uk/products/osavi-maca-1000mg-120-vege-caps?variant=50234901954800'
  ) or not exists(
    select 1 from public.retailer_products
    where id=1102 and product_id=165 and product_variant_id=917
      and external_product_id='9674420912368' and external_variant_id='50235877982448'
      and external_sku is null
      and external_options='{"Flavour ":"Peanut Butter Chocolate Chip"}'::jsonb
      and external_url='https://fithouse.uk/products/lenny-larrys-the-complete-cookie-113-g?variant=50235877982448'
  ) or not exists(
    select 1 from public.offers
    where id=916 and product_id=165 and product_variant_id=917 and retailer_product_id=1102
      and price=2.50 and shipping_cost=3.99 and total_price=6.49 and in_stock
      and url='https://fithouse.uk/products/lenny-larrys-the-complete-cookie-113-g?variant=50235877982448'
  ) then
    raise exception 'Two reviewed Fit House rebinds postcondition mismatch';
  end if;
  v_definition:=pg_get_functiondef(
    'public.register_fit_house_offer_sync_control_plan(jsonb)'::regprocedure
  );
  if position(v_new_manifest_sha in v_definition)=0
     or position(v_old_manifest_sha in v_definition)>0 then
    raise exception 'Fit House registration manifest binding postcondition mismatch';
  end if;
end
$rebind_two_fit_house_variants$;

commit;
