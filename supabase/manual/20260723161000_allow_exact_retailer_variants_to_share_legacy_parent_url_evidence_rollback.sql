begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

lock table public.retailer_products in share row exclusive mode;

do $rollback_preflight$
declare
  v_definition text;
begin
  if to_regprocedure('public.retailer_products_enforce_url_identity_partition()') is null
     or not exists (
       select 1 from pg_catalog.pg_trigger
       where tgrelid = 'public.retailer_products'::regclass
         and tgname = 'retailer_products_url_identity_partition_guard'
         and not tgisinternal
         and tgenabled = 'O'
     ) then
    raise exception 'legacy parent URL refinement rollback failed: URL guard is missing';
  end if;
  select pg_catalog.pg_get_functiondef(
    'public.retailer_products_enforce_url_identity_partition()'::regprocedure
  ) into v_definition;
  if position(
    'a legacy mapping cannot enter an exact shared parent URL' in v_definition
  ) = 0 then
    raise exception 'legacy parent URL refinement rollback failed: refined guard is not installed';
  end if;
end
$rollback_preflight$;

create or replace function public.retailer_products_enforce_url_identity_partition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $guard$
declare
  v_peer public.retailer_products%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      concat_ws('|', 'retailer-product-url-identity', new.retailer_id::text, new.external_url),
      0
    )
  );

  select *
  into v_peer
  from public.retailer_products
  where retailer_id = new.retailer_id
    and external_url = new.external_url
    and id is distinct from new.id
  order by id
  limit 1;

  if found and (
    new.external_variant_id is null
    or v_peer.external_variant_id is null
  ) then
    raise exception 'retailer URL identity collision: legacy and shared exact mappings cannot coexist';
  end if;

  if found and (
    nullif(btrim(new.external_product_id), '') is null
    or nullif(btrim(v_peer.external_product_id), '') is null
    or new.external_product_id is distinct from v_peer.external_product_id
    or new.product_id is distinct from v_peer.product_id
  ) then
    raise exception 'retailer shared parent URL identity conflict';
  end if;

  return new;
end
$guard$;

alter function public.retailer_products_enforce_url_identity_partition()
  owner to postgres;

revoke all on function public.retailer_products_enforce_url_identity_partition()
  from public, anon, authenticated, service_role;

commit;
