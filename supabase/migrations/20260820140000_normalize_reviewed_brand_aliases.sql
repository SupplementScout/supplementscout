begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.products, public.product_variants, public.retailer_products,
  public.offers, public.price_history in share row exclusive mode;

do $normalize_reviewed_brand_aliases$
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
    raise exception 'Reviewed brand alias normalization requires production database owner';
  end if;

  if (select array_agg(id order by id) from public.products where brand='PER4M')
       is distinct from array[791,796,797,798,799,800,801,802,803,804,805,806,882,887,888,897,926,927,1010,1083]::bigint[]
     or (select array_agg(id order by id) from public.products where brand='Per4m')
       is distinct from array[12,31,328,680,782,786,788,789,790,843,844,846,995]::bigint[]
     or (select array_agg(id order by id) from public.products where brand='Now Foods')
       is distinct from array[672,673,687,696,697,699,700,701,705,706,710,713,718,720,722,724,725,730]::bigint[]
     or (select array_agg(id order by id) from public.products where brand='NOW Foods')
       is distinct from array[1106,1137]::bigint[]
     or (select array_agg(id order by id) from public.products where brand='Ostrovit')
       is distinct from array[526]::bigint[]
     or (select array_agg(id order by id) from public.products where brand='OstroVit')
       is distinct from array[676,677,678,694,702,766,767,780,781]::bigint[]
     or (select array_agg(id order by id) from public.products where brand='ActivLab')
       is distinct from array[1093]::bigint[]
     or (select array_agg(id order by id) from public.products where brand='Activlab')
       is distinct from array[1032]::bigint[] then
    raise exception 'Reviewed brand alias product set drifted';
  end if;

  if exists (
    select 1 from public.products
    where id=any(array[12,31,328,526,672,673,676,677,678,680,687,694,696,697,699,700,701,702,705,706,710,713,718,720,722,724,725,730,766,767,780,781,786,788,789,790,791,796,797,798,799,800,801,802,803,804,805,806,843,844,846,882,887,888,897,926,927,995,1010,1032,1083,1093,1106,1137]::bigint[])
      and (not is_active or merged_into_product_id is not null or merged_at is not null)
  ) then
    raise exception 'Reviewed brand alias scope contains inactive or merged products';
  end if;

  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;

  update public.products
  set brand=case brand
    when 'PER4M' then 'Per4m'
    when 'Now Foods' then 'NOW Foods'
    when 'Ostrovit' then 'OstroVit'
    when 'ActivLab' then 'Activlab'
  end
  where brand in ('PER4M','Now Foods','Ostrovit','ActivLab');
  get diagnostics v_rows=row_count;
  if v_rows <> 40 then
    raise exception 'Reviewed brand alias normalization affected % products',v_rows;
  end if;

  if (select count(*) from public.products) <> v_products_before
     or (select count(*) from public.product_variants) <> v_variants_before
     or (select count(*) from public.retailer_products) <> v_mappings_before
     or (select count(*) from public.offers) <> v_offers_before
     or (select count(*) from public.price_history) <> v_history_before then
    raise exception 'Reviewed brand alias normalization changed a forbidden row count';
  end if;

  if exists (select 1 from public.products where brand in ('PER4M','Now Foods','Ostrovit','ActivLab'))
     or (select count(*) from public.products where brand='Per4m') <> 33
     or (select count(*) from public.products where brand='NOW Foods') <> 20
     or (select count(*) from public.products where brand='OstroVit') <> 10
     or (select count(*) from public.products where brand='Activlab') <> 2 then
    raise exception 'Reviewed brand alias normalization postcondition mismatch';
  end if;
end
$normalize_reviewed_brand_aliases$;

commit;
