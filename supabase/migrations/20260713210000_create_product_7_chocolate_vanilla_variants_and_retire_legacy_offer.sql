begin;

do $product_7_variants$
declare
  v_product public.products%rowtype;
  v_default_variant public.product_variants%rowtype;
  v_mapping public.retailer_products%rowtype;
  v_offer public.offers%rowtype;
  v_chocolate public.product_variants%rowtype;
  v_vanilla public.product_variants%rowtype;
  v_chocolate_exists boolean;
  v_vanilla_exists boolean;
  v_inserted integer;
  v_updated integer;
  v_legacy_url constant text := 'https://www.discount-supplements.co.uk/products/optimum-nutrition-gold-standard-100-whey-2-27kg';
begin
  select * into v_product from public.products where id = 7 for update;
  if not found or not v_product.is_active or v_product.merged_into_product_id is not null then
    raise exception 'Product 7 variant seed blocked: product identity or lifecycle changed';
  end if;

  select * into v_default_variant from public.product_variants where id = 7 for update;
  if not found
     or v_default_variant.product_id is distinct from 7
     or v_default_variant.variant_key is distinct from 'default'
     or not v_default_variant.is_default
     or not v_default_variant.is_active then
    raise exception 'Product 7 variant seed blocked: default variant identity changed';
  end if;

  select * into v_mapping from public.retailer_products where id = 10 for update;
  if not found
     or v_mapping.product_id is distinct from 7
     or v_mapping.retailer_id is distinct from 4
     or v_mapping.product_variant_id is distinct from 7
     or v_mapping.external_variant_id is not null
     or v_mapping.external_url is distinct from v_legacy_url then
    raise exception 'Product 7 variant seed blocked: retailer_product 10 identity changed';
  end if;

  select * into v_offer from public.offers where id = 10 for update;
  if not found
     or v_offer.product_id is distinct from 7
     or v_offer.retailer_id is distinct from 4
     or v_offer.retailer_product_id is distinct from 10
     or v_offer.product_variant_id is distinct from 7
     or v_offer.price is distinct from 77.95::numeric
     or v_offer.shipping_cost is distinct from 4.99::numeric
     or v_offer.total_price is not null
     or v_offer.url is distinct from v_legacy_url
     or v_offer.last_checked_at is distinct from '2026-06-28T14:32:45.398+00:00'::timestamptz then
    raise exception 'Product 7 variant seed blocked: offer 10 identity or immutable values changed';
  end if;

  select * into v_chocolate
  from public.product_variants
  where product_id = 7 and variant_key = 'chocolate-2000g'
  for update;
  v_chocolate_exists := found;
  if v_chocolate_exists and (
       v_chocolate.display_name is distinct from 'Chocolate / 2kg'
       or v_chocolate.flavour_code is distinct from 'chocolate'
       or v_chocolate.flavour_label is distinct from 'Chocolate'
       or v_chocolate.size_value is distinct from 2000::numeric
       or v_chocolate.size_unit is distinct from 'g'
       or v_chocolate.pack_count is distinct from 1
       or v_chocolate.product_format is distinct from 'powder'
       or v_chocolate.gtin is not null
       or v_chocolate.image is not null
       or v_chocolate.nutrition_override is distinct from '{}'::jsonb
       or v_chocolate.is_default
       or not v_chocolate.is_active
     ) then
    raise exception 'Product 7 variant seed blocked: chocolate-2000g conflicts with expected values';
  end if;

  select * into v_vanilla
  from public.product_variants
  where product_id = 7 and variant_key = 'vanilla-2000g'
  for update;
  v_vanilla_exists := found;
  if v_vanilla_exists and (
       v_vanilla.display_name is distinct from 'Vanilla / 2kg'
       or v_vanilla.flavour_code is distinct from 'vanilla'
       or v_vanilla.flavour_label is distinct from 'Vanilla'
       or v_vanilla.size_value is distinct from 2000::numeric
       or v_vanilla.size_unit is distinct from 'g'
       or v_vanilla.pack_count is distinct from 1
       or v_vanilla.product_format is distinct from 'powder'
       or v_vanilla.gtin is not null
       or v_vanilla.image is not null
       or v_vanilla.nutrition_override is distinct from '{}'::jsonb
       or v_vanilla.is_default
       or not v_vanilla.is_active
     ) then
    raise exception 'Product 7 variant seed blocked: vanilla-2000g conflicts with expected values';
  end if;

  if exists (
    select 1
    from public.product_variants
    where product_id is not distinct from 7
      and flavour_code is not distinct from 'chocolate'::text
      and size_value is not distinct from 2000::numeric
      and size_unit is not distinct from 'g'::text
      and pack_count is not distinct from 1
      and product_format is not distinct from 'powder'::text
      and variant_key is distinct from 'chocolate-2000g'::text
  ) then
    raise exception 'Product 7 variant seed blocked: chocolate-2000g semantic duplicate exists under another key';
  end if;

  if exists (
    select 1
    from public.product_variants
    where product_id is not distinct from 7
      and flavour_code is not distinct from 'vanilla'::text
      and size_value is not distinct from 2000::numeric
      and size_unit is not distinct from 'g'::text
      and pack_count is not distinct from 1
      and product_format is not distinct from 'powder'::text
      and variant_key is distinct from 'vanilla-2000g'::text
  ) then
    raise exception 'Product 7 variant seed blocked: vanilla-2000g semantic duplicate exists under another key';
  end if;

  if exists (
    select 1
    from public.product_variants
    where product_id = 7
      and is_active
      and not is_default
      and variant_key not in ('chocolate-2000g', 'vanilla-2000g')
  ) then
    raise exception 'Product 7 variant seed blocked: unexpected active non-default variant exists';
  end if;

  if v_chocolate_exists is distinct from v_vanilla_exists then
    raise exception 'Product 7 variant seed blocked: partial target variant state';
  end if;

  if v_chocolate_exists then
    if v_offer.in_stock is distinct from false then
      raise exception 'Product 7 variant seed blocked: variants exist while legacy offer is not exactly retired';
    end if;
    return;
  end if;

  if v_offer.in_stock is distinct from true then
    raise exception 'Product 7 variant seed blocked: legacy offer is not exactly active before target variants exist';
  end if;

  insert into public.product_variants (
    product_id, variant_key, display_name, flavour_code, flavour_label,
    size_value, size_unit, pack_count, product_format, gtin, image,
    nutrition_override, is_default, is_active
  ) values
    (7, 'chocolate-2000g', 'Chocolate / 2kg', 'chocolate', 'Chocolate',
     2000, 'g', 1, 'powder', null, null, '{}'::jsonb, false, true),
    (7, 'vanilla-2000g', 'Vanilla / 2kg', 'vanilla', 'Vanilla',
     2000, 'g', 1, 'powder', null, null, '{}'::jsonb, false, true);
  get diagnostics v_inserted = row_count;
  if v_inserted <> 2 then
    raise exception 'Product 7 variant seed failed: inserted % variants instead of 2', v_inserted;
  end if;

  update public.offers
  set in_stock = false
  where id = 10 and in_stock = true;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Product 7 variant seed failed: legacy offer 10 was not retired exactly once';
  end if;
end;
$product_7_variants$;

commit;
