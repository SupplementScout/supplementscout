begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_new_variant public.product_variants%rowtype;
  v_rows integer;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Jon''s Strom Buttered Pancake variant-move rollback requires production database owner';
  end if;
  select * into v_new_variant from public.product_variants
  where product_id=838 and variant_key='buttered-pancake-2000g'
    and display_name='Buttered Pancake / 2000g'
    and flavour_code='buttered pancake' and flavour_label='Buttered Pancake'
    and size_value=2000 and size_unit='g' and pack_count=1
    and product_format='powder' and is_active and not is_default
  for update;
  if not found or v_new_variant.id=1185
     or not exists(
       select 1 from public.product_variants
       where id=1185 and product_id=838 and variant_key='default'
         and display_name='Default' and is_active and is_default
     )
     or not exists(
       select 1 from public.retailer_products
       where id=1299 and product_variant_id=v_new_variant.id
         and external_options='{"Size":"2000g","Flavour":"Buttered Pancake"}'::jsonb
     )
     or not exists(
       select 1 from public.offers
       where id=1113 and retailer_product_id=1299 and product_variant_id=v_new_variant.id
         and not in_stock and price=17.99 and shipping_cost=3.99 and total_price=21.98
         and last_checked_at='2026-08-10T16:09:58.914+00:00'::timestamptz
     )
     or (select count(*) from public.retailer_products where product_variant_id=v_new_variant.id)<>1
     or (select count(*) from public.offers where product_variant_id=v_new_variant.id)<>1
     or '2026-08-10T16:09:58.914+00:00'::timestamptz>v_new_variant.created_at then
    raise exception 'Strom Buttered Pancake rollback precondition or later-refresh guard mismatch';
  end if;

  update public.retailer_products
  set product_variant_id=1185,updated_at='2026-08-10T16:09:28.215271+00:00'::timestamptz
  where id=1299 and product_variant_id=v_new_variant.id;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Strom mapping rollback affected % rows',v_rows; end if;

  update public.offers set product_variant_id=1185
  where id=1113 and retailer_product_id=1299 and product_variant_id=v_new_variant.id;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Strom offer rollback affected % rows',v_rows; end if;

  delete from public.product_variants where id=v_new_variant.id;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Strom new variant rollback affected % rows',v_rows; end if;

  update public.product_variants
  set variant_key='buttered-pancake-2000g',display_name='Buttered Pancake / 2000g',
      flavour_code='buttered pancake',flavour_label='Buttered Pancake',
      size_value=2000,size_unit='g',pack_count=1,product_format='powder',is_default=false
  where id=1185 and product_id=838 and variant_key='default' and is_default;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Strom original variant rollback affected % rows',v_rows; end if;
end
$rollback$;

commit;
