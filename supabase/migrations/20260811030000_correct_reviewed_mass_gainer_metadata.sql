begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.products, public.product_variants, public.retailer_products,
  public.offers, public.price_history in share row exclusive mode;

do $correct_reviewed_mass_gainer_metadata$
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
    raise exception 'Reviewed Mass Gainer metadata correction requires production database owner';
  end if;

  if (select count(*) from public.products where id in (128,132)) <> 2
     or not exists (
       select 1 from public.products
       where id=128 and name='7Nutrition Bodybuilder 1.5kg'
         and slug='7nutrition-bodybuilder-15kg' and brand='7Nutrition'
         and category='Health Supplements' and product_format is null
         and is_active and merged_into_product_id is null and merged_at is null
     )
     or not exists (
       select 1 from public.products
       where id=132 and name='Applied Nutrition Critical Mass Lean Mass Gainz 2.4kg'
         and slug='applied-nutrition-critical-mass-lean-mass-gainz-24kg'
         and brand='Applied Nutrition'
         and category='Health Supplements' and product_format is null
         and is_active and merged_into_product_id is null and merged_at is null
     ) then
    raise exception 'Reviewed Mass Gainer canonical product precondition mismatch';
  end if;

  perform id from public.products where id in (128,132) order by id for update;

  if (select count(*) from public.product_variants where product_id=128) <> 8
     or (select count(*) from public.product_variants where product_id=132) <> 7
     or exists (
       select 1 from public.product_variants
       where product_id=128 and not is_default
         and (not is_active or product_format is distinct from 'powder'
           or size_value is distinct from 1500 or size_unit is distinct from 'g')
     )
     or exists (
       select 1 from public.product_variants
       where product_id=132 and not is_default
         and (not is_active or product_format is distinct from 'powder'
           or size_value is distinct from 2400 or size_unit is distinct from 'g')
     )
     or (select count(*) from public.product_variants where product_id=128 and not is_default) <> 7
     or (select count(*) from public.product_variants where product_id=132 and not is_default) <> 6 then
    raise exception 'Reviewed Mass Gainer powder variant evidence mismatch';
  end if;

  if (select count(distinct retailer_id) from public.retailer_products where product_id=128 and retailer_id in (3,11)) <> 2
     or (select count(distinct retailer_id) from public.retailer_products where product_id=132 and retailer_id in (3,11)) <> 2
     or (select count(distinct retailer_id) from public.offers where product_id=128 and retailer_id in (3,11) and in_stock) <> 2
     or (select count(distinct retailer_id) from public.offers where product_id=132 and retailer_id in (3,11) and in_stock) <> 2 then
    raise exception 'Reviewed Mass Gainer multi-retailer evidence mismatch';
  end if;

  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;

  update public.products
  set category='Mass Gainer', product_format='powder'
  where id in (128,132)
    and category='Health Supplements'
    and product_format is null
    and is_active and merged_into_product_id is null and merged_at is null;
  get diagnostics v_rows=row_count;
  if v_rows <> 2 then
    raise exception 'Reviewed Mass Gainer metadata correction affected % products',v_rows;
  end if;

  if (select count(*) from public.products) <> v_products_before
     or (select count(*) from public.product_variants) <> v_variants_before
     or (select count(*) from public.retailer_products) <> v_mappings_before
     or (select count(*) from public.offers) <> v_offers_before
     or (select count(*) from public.price_history) <> v_history_before then
    raise exception 'Reviewed Mass Gainer metadata correction changed a forbidden row count';
  end if;

  if (select count(*) from public.products
      where id in (128,132) and category='Mass Gainer' and product_format='powder'
        and is_active and merged_into_product_id is null and merged_at is null) <> 2
     or not exists (select 1 from public.products where id=128 and name='7Nutrition Bodybuilder 1.5kg' and slug='7nutrition-bodybuilder-15kg' and brand='7Nutrition')
     or not exists (select 1 from public.products where id=132 and name='Applied Nutrition Critical Mass Lean Mass Gainz 2.4kg' and slug='applied-nutrition-critical-mass-lean-mass-gainz-24kg' and brand='Applied Nutrition') then
    raise exception 'Reviewed Mass Gainer metadata correction postcondition mismatch';
  end if;
end
$correct_reviewed_mass_gainer_metadata$;

commit;
