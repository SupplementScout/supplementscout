begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

lock table
  public.retailer_products,
  public.offers,
  public.price_history
in share row exclusive mode;

do $rollback_preflight$
declare
  v_count bigint;
begin
  if to_regclass('public.retailer_products_retailer_url_unique') is not null
     or to_regclass('public.offers_retailer_url_unique') is not null then
    raise exception 'URL identity rollback preflight failed: a legacy URL uniqueness object already exists';
  end if;
  if to_regclass('public.retailer_products_retailer_external_variant_unique_idx') is null
     or to_regclass('public.retailer_products_retailer_exact_canonical_variant_unique_idx') is null
     or to_regclass('public.retailer_products_retailer_legacy_url_unique_idx') is null
     or to_regprocedure('public.retailer_products_enforce_url_identity_partition()') is null then
    raise exception 'URL identity rollback preflight failed: replacement identity indexes are incomplete';
  end if;

  select count(*) into v_count
  from (
    select retailer_id, external_url
    from public.retailer_products
    group by retailer_id, external_url
    having count(*) > 1
  ) duplicates;
  if v_count <> 0 then
    raise exception 'URL identity rollback preflight failed: % shared mapping URL groups prevent safe restoration', v_count;
  end if;

  select count(*) into v_count
  from (
    select retailer_id, url
    from public.offers
    group by retailer_id, url
    having count(*) > 1
  ) duplicates;
  if v_count <> 0 then
    raise exception 'URL identity rollback preflight failed: % shared offer URL groups prevent safe restoration', v_count;
  end if;
end
$rollback_preflight$;

alter table public.retailer_products
  add constraint retailer_products_retailer_url_unique
  unique (retailer_id, external_url);

alter table public.offers
  add constraint offers_retailer_url_unique
  unique (retailer_id, url);

drop trigger retailer_products_url_identity_partition_guard
  on public.retailer_products;
drop function public.retailer_products_enforce_url_identity_partition();

drop index public.retailer_products_retailer_exact_canonical_variant_unique_idx;
drop index public.retailer_products_retailer_legacy_url_unique_idx;

do $rollback_validation$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.retailer_products'::regclass
      and conname = 'retailer_products_retailer_url_unique'
      and contype = 'u'
      and convalidated
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.offers'::regclass
      and conname = 'offers_retailer_url_unique'
      and contype = 'u'
      and convalidated
  ) then
    raise exception 'URL identity rollback validation failed: legacy URL constraints were not restored';
  end if;
  if to_regclass('public.retailer_products_retailer_exact_canonical_variant_unique_idx') is not null
     or to_regclass('public.retailer_products_retailer_legacy_url_unique_idx') is not null
     or to_regprocedure('public.retailer_products_enforce_url_identity_partition()') is not null then
    raise exception 'URL identity rollback validation failed: replacement identity objects remain';
  end if;
end
$rollback_validation$;

commit;
