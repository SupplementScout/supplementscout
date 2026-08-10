begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.retailer_products, public.offers, public.price_history
  in share row exclusive mode;

do $rollback_two_fit_house_variants$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_installed_at timestamptz;
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
    raise exception 'Two reviewed Fit House rebind rollback requires production database owner';
  end if;
  select installed_at into v_installed_at
  from public.retailer_catalogue_migration_ledger
  where version='20260810260000_rebind_two_reviewed_fit_house_variants';
  if v_installed_at is null then
    raise exception 'Two Fit House rebind migration ledger row is missing';
  end if;
  if exists(
    select 1 from public.offers
    where id in (735,916) and last_checked_at>v_installed_at
  ) or exists(
    select 1 from public.retailer_products
    where id in (797,1102) and updated_at>v_installed_at
  ) then
    raise exception 'rollback is forbidden after corrected Fit House rows have been refreshed';
  end if;
  if not exists(
    select 1 from public.retailer_products
    where id=797 and retailer_id=9 and product_id=716 and product_variant_id=595
      and external_product_id='8493540278512' and external_variant_id='50234901954800'
      and external_options='{"Capsules":"120"}'::jsonb
      and external_url='https://fithouse.uk/products/osavi-maca-1000mg-120-vege-caps?variant=50234901954800'
  ) or not exists(
    select 1 from public.retailer_products
    where id=1102 and retailer_id=9 and product_id=165 and product_variant_id=917
      and external_product_id='9674420912368' and external_variant_id='50235877982448'
      and external_options='{"Flavour ":"Peanut Butter Chocolate Chip"}'::jsonb
      and external_url='https://fithouse.uk/products/lenny-larrys-the-complete-cookie-113-g?variant=50235877982448'
  ) or not exists(
    select 1 from public.offers
    where id=735 and retailer_id=9 and product_id=716 and product_variant_id=595
      and retailer_product_id=797
      and price=14.99 and shipping_cost=3.99 and total_price=18.98 and in_stock
      and url='https://fithouse.uk/products/osavi-maca-1000mg-120-vege-caps?variant=50234901954800'
  ) or not exists(
    select 1 from public.offers
    where id=916 and retailer_id=9 and product_id=165 and product_variant_id=917
      and retailer_product_id=1102
      and price=2.50 and shipping_cost=3.99 and total_price=6.49 and in_stock
      and url='https://fithouse.uk/products/lenny-larrys-the-complete-cookie-113-g?variant=50235877982448'
  ) then
    raise exception 'Two Fit House rebind rollback state mismatch';
  end if;
  v_definition:=pg_get_functiondef(
    'public.register_fit_house_offer_sync_control_plan(jsonb)'::regprocedure
  );
  if position(v_new_manifest_sha in v_definition)=0
     or position(v_old_manifest_sha in v_definition)>0 then
    raise exception 'Fit House rollback registration binding mismatch';
  end if;

  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;

  update public.offers set url=case id
    when 735 then 'https://fithouse.uk/products/osavi-maca-1000mg-120-vege-caps?variant=45060374167792'
    when 916 then 'https://fithouse.uk/products/lenny-larrys-the-complete-cookie-113-g?variant=48124051816688'
  end where
    (id=735 and retailer_id=9 and product_id=716 and product_variant_id=595
      and retailer_product_id=797
      and url='https://fithouse.uk/products/osavi-maca-1000mg-120-vege-caps?variant=50234901954800')
    or
    (id=916 and retailer_id=9 and product_id=165 and product_variant_id=917
      and retailer_product_id=1102
      and url='https://fithouse.uk/products/lenny-larrys-the-complete-cookie-113-g?variant=50235877982448');
  get diagnostics v_rows=row_count;
  if v_rows<>2 then raise exception 'Two Fit House rollback offers affected % rows',v_rows; end if;

  update public.retailer_products set
    external_variant_id=case id
      when 797 then '45060374167792'
      when 1102 then '48124051816688' end,
    external_options=case id
      when 797 then null
      when 1102 then '{"Flavor":"Peanut Butter Chocolate Chip"}'::jsonb end,
    external_url=case id
      when 797 then 'https://fithouse.uk/products/osavi-maca-1000mg-120-vege-caps?variant=45060374167792'
      when 1102 then 'https://fithouse.uk/products/lenny-larrys-the-complete-cookie-113-g?variant=48124051816688' end,
    updated_at=now()
  where
    (id=797 and retailer_id=9 and product_id=716 and product_variant_id=595
      and external_product_id='8493540278512' and external_variant_id='50234901954800'
      and external_options='{"Capsules":"120"}'::jsonb
      and external_url='https://fithouse.uk/products/osavi-maca-1000mg-120-vege-caps?variant=50234901954800')
    or
    (id=1102 and retailer_id=9 and product_id=165 and product_variant_id=917
      and external_product_id='9674420912368' and external_variant_id='50235877982448'
      and external_options='{"Flavour ":"Peanut Butter Chocolate Chip"}'::jsonb
      and external_url='https://fithouse.uk/products/lenny-larrys-the-complete-cookie-113-g?variant=50235877982448');
  get diagnostics v_rows=row_count;
  if v_rows<>2 then raise exception 'Two Fit House rollback mappings affected % rows',v_rows; end if;

  execute replace(v_definition,v_new_manifest_sha,v_old_manifest_sha);

  if (select count(*) from public.retailer_products)<>v_mappings_before
     or (select count(*) from public.offers)<>v_offers_before
     or (select count(*) from public.price_history)<>v_history_before then
    raise exception 'Two Fit House rollback changed a forbidden row count';
  end if;
  if not exists(
    select 1 from public.retailer_products
    where id=797 and retailer_id=9 and product_id=716 and product_variant_id=595
      and external_product_id='8493540278512' and external_variant_id='45060374167792'
      and external_sku is null and external_options is null
      and external_url='https://fithouse.uk/products/osavi-maca-1000mg-120-vege-caps?variant=45060374167792'
  ) or not exists(
    select 1 from public.retailer_products
    where id=1102 and retailer_id=9 and product_id=165 and product_variant_id=917
      and external_product_id='9674420912368' and external_variant_id='48124051816688'
      and external_sku is null
      and external_options='{"Flavor":"Peanut Butter Chocolate Chip"}'::jsonb
      and external_url='https://fithouse.uk/products/lenny-larrys-the-complete-cookie-113-g?variant=48124051816688'
  ) or not exists(
    select 1 from public.offers
    where id=735 and retailer_id=9 and product_id=716 and product_variant_id=595
      and retailer_product_id=797
      and price=14.99 and shipping_cost=3.99 and total_price=18.98 and in_stock
      and url='https://fithouse.uk/products/osavi-maca-1000mg-120-vege-caps?variant=45060374167792'
  ) or not exists(
    select 1 from public.offers
    where id=916 and retailer_id=9 and product_id=165 and product_variant_id=917
      and retailer_product_id=1102
      and price=2.50 and shipping_cost=3.99 and total_price=6.49 and in_stock
      and url='https://fithouse.uk/products/lenny-larrys-the-complete-cookie-113-g?variant=48124051816688'
  ) then
    raise exception 'Two Fit House rollback postcondition mismatch';
  end if;
  v_definition:=pg_get_functiondef(
    'public.register_fit_house_offer_sync_control_plan(jsonb)'::regprocedure
  );
  if position(v_old_manifest_sha in v_definition)=0
     or position(v_new_manifest_sha in v_definition)>0 then
    raise exception 'Fit House rollback registration binding postcondition mismatch';
  end if;
end
$rollback_two_fit_house_variants$;

commit;
