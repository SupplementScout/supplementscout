begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.products in share row exclusive mode;

do $rollback_reviewed_brand_aliases$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_rows integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Reviewed brand alias rollback requires production database owner';
  end if;

  if not exists (
       select 1 from supabase_migrations.schema_migrations
       where version='20260820140000' and name='normalize_reviewed_brand_aliases'
     )
     or (select count(*) from public.products where id=any(array[791,796,797,798,799,800,801,802,803,804,805,806,882,887,888,897,926,927,1010,1083]::bigint[]) and brand='Per4m') <> 20
     or (select count(*) from public.products where id=any(array[672,673,687,696,697,699,700,701,705,706,710,713,718,720,722,724,725,730]::bigint[]) and brand='NOW Foods') <> 18
     or not exists (select 1 from public.products where id=526 and brand='OstroVit')
     or not exists (select 1 from public.products where id=1093 and brand='Activlab') then
    raise exception 'Reviewed brand alias rollback precondition mismatch';
  end if;

  update public.products
  set brand=case
    when id=any(array[791,796,797,798,799,800,801,802,803,804,805,806,882,887,888,897,926,927,1010,1083]::bigint[]) then 'PER4M'
    when id=any(array[672,673,687,696,697,699,700,701,705,706,710,713,718,720,722,724,725,730]::bigint[]) then 'Now Foods'
    when id=526 then 'Ostrovit'
    when id=1093 then 'ActivLab'
  end
  where id=any(array[526,672,673,687,696,697,699,700,701,705,706,710,713,718,720,722,724,725,730,791,796,797,798,799,800,801,802,803,804,805,806,882,887,888,897,926,927,1010,1083,1093]::bigint[]);
  get diagnostics v_rows=row_count;
  if v_rows <> 40 then
    raise exception 'Reviewed brand alias rollback affected % products',v_rows;
  end if;

  if (select count(*) from public.products where brand='PER4M') <> 20
     or (select count(*) from public.products where brand='Now Foods') <> 18
     or (select count(*) from public.products where brand='Ostrovit') <> 1
     or (select count(*) from public.products where brand='ActivLab') <> 1 then
    raise exception 'Reviewed brand alias rollback postcondition mismatch';
  end if;
end
$rollback_reviewed_brand_aliases$;

commit;
