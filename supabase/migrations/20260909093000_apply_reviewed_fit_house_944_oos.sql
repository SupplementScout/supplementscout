begin;

-- Owner approved the exact offer 944 OOS transition and baseline 103 -> 104.
-- Source/approval: docs/rollouts/shared-automation-owner-approval-2026-09-09.json
-- SHA-256: 3bcac846d086c8bc71ce9c5bf5bf8e135f704f8e6eed543d03ab7bbaae0d578c
-- No price, identity, URL, freshness or history changes are authorized here.
set local lock_timeout = '5s';
set local statement_timeout = '120s';
lock table public.products, public.product_variants, public.retailer_products,
  public.offers, public.price_history in share row exclusive mode;

create temp table _fit_944_before on commit drop as
select id, to_jsonb(o) as row from public.offers o;
create temp table _fit_944_functions on commit drop as
select p.oid, p.oid::regprocedure::text as name, pg_get_functiondef(p.oid) as definition,
  p.proowner, p.proacl, p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'validate_fit_house_stable_oos_read_only',
  'validate_fit_house_confirmed_price_read_only');

do $fit_944$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_function record;
  v_old text := '(select count(*) from public.offers where retailer_id=9 and not in_stock)>103';
  v_new text := '(select count(*) from public.offers where retailer_id=9 and not in_stock)>104';
  v_definition text;
  v_rows integer;
  v_history bigint := (select count(*) from public.price_history);
begin
  if current_user <> 'postgres'
    or v_target->>'target_environment' <> 'PRODUCTION'
    or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
    or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Fit House 944 requires the exact production owner target';
  end if;
  if clock_timestamp() >= '2026-09-10T09:16:56.957Z'::timestamptz then
    raise exception 'Fit House 944 reviewed source evidence expired';
  end if;
  if (select count(*) from public.offers where retailer_id=9) <> 286
    or (select count(*) from public.retailer_products where retailer_id=9) <> 286
    or (select count(*) from public.offers where retailer_id=9 and not in_stock) <> 103 then
    raise exception 'Fit House 944 exact scope or previous OOS baseline changed';
  end if;
  if not exists (
    select 1 from public.offers o join public.retailer_products r on r.id=o.retailer_product_id
    where o.id=944 and o.retailer_id=9 and o.retailer_product_id=1130
      and o.product_id=517 and o.product_variant_id=966
      and o.price=31.99 and o.shipping_cost=3.99 and o.total_price=35.98 and o.in_stock
      and o.url='https://fithouse.uk/products/mutant-mass-2-27-kg?variant=47976539259120'
      and o.last_checked_at='2026-09-08T17:18:54.119Z'::timestamptz
      and r.retailer_id=9 and r.product_id=517 and r.product_variant_id=966
      and r.external_product_id='8318574264560' and r.external_variant_id='47976539259120'
  ) then raise exception 'Fit House 944 reviewed before-state changed'; end if;
  if (select count(*) from _fit_944_functions) <> 2
    or md5(pg_get_functiondef('public.validate_fit_house_stable_oos_read_only(jsonb)'::regprocedure)) <> 'aaa920e71d5e867ffc4576dddcc0fb43'
    or md5(pg_get_functiondef('public.validate_fit_house_confirmed_price_read_only(jsonb)'::regprocedure)) <> '16d5383c87e84d76044834159e7d5789'
    or md5(pg_get_functiondef('public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)'::regprocedure)) <> 'a8512ea11c4acd06dd6674924ca2a442' then
    raise exception 'Fit House validator definitions changed';
  end if;
  for v_function in select * from _fit_944_functions loop
    if (length(v_function.definition)-length(replace(v_function.definition,v_old,''))) <> length(v_old)
      or position('or v_total_oos>v_previous_oos then' in v_function.definition)=0 then
      raise exception 'Fit House stable baseline or no-net-increase guard missing';
    end if;
    v_definition := replace(replace(v_function.definition,v_old,v_new),
      'baseline: max 103 and no net increase','baseline: max 104 and no net increase');
    execute v_definition;
    if pg_get_functiondef(v_function.oid) <> v_definition
      or not exists (select 1 from pg_proc p where p.oid=v_function.oid
        and p.proowner=v_function.proowner and p.proacl is not distinct from v_function.proacl
        and p.proconfig is not distinct from v_function.proconfig) then
      raise exception 'Fit House validator definition, owner, ACL or settings drift';
    end if;
  end loop;

  update public.offers set in_stock=false where id=944 and in_stock;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Fit House 944 exact one-row update failed'; end if;
  if (select count(*) from public.offers where retailer_id=9 and not in_stock)<>104
    or (select count(*) from public.price_history)<>v_history
    or exists (
      select 1 from _fit_944_before b full join public.offers o using(id)
      where (case when b.id=944 then b.row-'in_stock' else b.row end)
        is distinct from (case when o.id=944 then to_jsonb(o)-'in_stock' else to_jsonb(o) end)
    ) then raise exception 'Fit House 944 unexpected postflight delta'; end if;
  if md5(pg_get_functiondef('public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)'::regprocedure)) <> 'a8512ea11c4acd06dd6674924ca2a442' then
    raise exception 'Shared validator dispatcher changed';
  end if;
end
$fit_944$;
commit;
