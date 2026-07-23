begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

lock table
  public.retailer_products,
  public.offers,
  public.price_history
in share row exclusive mode;

do $preflight$
declare
  v_count bigint;
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.retailer_products'::regclass
      and c.conname = 'retailer_products_retailer_url_unique'
      and c.contype = 'u'
      and c.convalidated
      and lower(regexp_replace(pg_catalog.pg_get_constraintdef(c.oid, true), '\s+', ' ', 'g'))
        = 'unique (retailer_id, external_url)'
  ) then
    raise exception 'URL identity migration preflight failed: exact legacy retailer_products URL constraint is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.offers'::regclass
      and c.conname = 'offers_retailer_url_unique'
      and c.contype = 'u'
      and c.convalidated
      and lower(regexp_replace(pg_catalog.pg_get_constraintdef(c.oid, true), '\s+', ' ', 'g'))
        = 'unique (retailer_id, url)'
  ) then
    raise exception 'URL identity migration preflight failed: exact legacy offers URL constraint is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.offers'::regclass
      and c.conname = 'offers_retailer_product_unique'
      and c.contype = 'u'
      and c.convalidated
      and lower(regexp_replace(pg_catalog.pg_get_constraintdef(c.oid, true), '\s+', ' ', 'g'))
        = 'unique (retailer_product_id)'
  ) then
    raise exception 'URL identity migration preflight failed: one-offer-per-mapping constraint is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class index_class
    join pg_catalog.pg_namespace index_namespace
      on index_namespace.oid = index_class.relnamespace
    join pg_catalog.pg_index index_data
      on index_data.indexrelid = index_class.oid
    where index_namespace.nspname = 'public'
      and index_class.relname = 'retailer_products_retailer_external_variant_unique_idx'
      and index_data.indrelid = 'public.retailer_products'::regclass
      and index_data.indisunique
      and index_data.indisvalid
      and index_data.indisready
      and lower(regexp_replace(pg_catalog.pg_get_indexdef(index_class.oid), '\s+', ' ', 'g'))
        ~ 'create unique index retailer_products_retailer_external_variant_unique_idx on public\.retailer_products using btree \(retailer_id, external_variant_id\) where \(external_variant_id is not null\)'
  ) then
    raise exception 'URL identity migration preflight failed: exact external variant uniqueness is missing or drifted';
  end if;

  if to_regclass('public.retailer_products_retailer_exact_canonical_variant_unique_idx') is not null
     or to_regclass('public.retailer_products_retailer_legacy_url_unique_idx') is not null
     or to_regprocedure('public.retailer_products_enforce_url_identity_partition()') is not null
     or exists (
       select 1 from pg_catalog.pg_trigger
       where tgrelid = 'public.retailer_products'::regclass
         and tgname = 'retailer_products_url_identity_partition_guard'
         and not tgisinternal
     ) then
    raise exception 'URL identity migration preflight failed: replacement identity objects already exist; rerun rejected';
  end if;

  select count(*) into v_count
  from public.retailer_products
  where external_variant_id is not null
    and nullif(btrim(external_variant_id), '') is null;
  if v_count <> 0 then
    raise exception 'URL identity migration preflight failed: % blank external variant identities', v_count;
  end if;

  select count(*) into v_count
  from public.retailer_products
  where external_variant_id is not null
    and nullif(btrim(external_product_id), '') is null;
  if v_count <> 0 then
    raise exception 'URL identity migration preflight failed: % exact variants lack an external product identity', v_count;
  end if;

  select count(*) into v_count
  from (
    select retailer_id, external_variant_id
    from public.retailer_products
    where external_variant_id is not null
    group by retailer_id, external_variant_id
    having count(*) > 1
  ) duplicates;
  if v_count <> 0 then
    raise exception 'URL identity migration preflight failed: % duplicate retailer external variant identities', v_count;
  end if;

  select count(*) into v_count
  from (
    select retailer_id, product_variant_id
    from public.retailer_products
    where external_variant_id is not null
    group by retailer_id, product_variant_id
    having count(*) > 1
  ) duplicates;
  if v_count <> 0 then
    raise exception 'URL identity migration preflight failed: % exact mappings collide on canonical retailer variants', v_count;
  end if;

  select count(*) into v_count
  from (
    select retailer_id, external_url
    from public.retailer_products
    where external_variant_id is null
    group by retailer_id, external_url
    having count(*) > 1
  ) duplicates;
  if v_count <> 0 then
    raise exception 'URL identity migration preflight failed: % legacy mappings collide on retailer URL identity', v_count;
  end if;

  select count(*) into v_count
  from (
    select retailer_product_id
    from public.offers
    group by retailer_product_id
    having count(*) > 1
  ) duplicates;
  if v_count <> 0 then
    raise exception 'URL identity migration preflight failed: % mappings have duplicate offers', v_count;
  end if;

  select count(*) into v_count
  from public.offers o
  left join public.retailer_products rp on rp.id = o.retailer_product_id
  where rp.id is null
     or (o.product_id, o.retailer_id, o.product_variant_id)
        is distinct from (rp.product_id, rp.retailer_id, rp.product_variant_id);
  if v_count <> 0 then
    raise exception 'URL identity migration preflight failed: % offers have missing or mismatched mapping identity', v_count;
  end if;

  select count(*) into v_count
  from public.price_history ph
  left join public.offers o on o.id = ph.offer_id
  where ph.offer_id is not null and o.id is null;
  if v_count <> 0 then
    raise exception 'URL identity migration preflight failed: % price-history rows have a missing offer', v_count;
  end if;
end
$preflight$;

create unique index retailer_products_retailer_exact_canonical_variant_unique_idx
  on public.retailer_products (retailer_id, product_variant_id)
  where external_variant_id is not null;

create unique index retailer_products_retailer_legacy_url_unique_idx
  on public.retailer_products (retailer_id, external_url)
  where external_variant_id is null;

create function public.retailer_products_enforce_url_identity_partition()
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

create trigger retailer_products_url_identity_partition_guard
before insert or update of
  retailer_id,
  product_id,
  external_product_id,
  external_variant_id,
  external_url
on public.retailer_products
for each row
execute function public.retailer_products_enforce_url_identity_partition();

alter table public.retailer_products
  drop constraint retailer_products_retailer_url_unique;

alter table public.offers
  drop constraint offers_retailer_url_unique;

do $post_validation$
declare
  v_count bigint;
begin
  if to_regclass('public.retailer_products_retailer_url_unique') is not null
     or to_regclass('public.offers_retailer_url_unique') is not null then
    raise exception 'URL identity migration validation failed: a legacy URL uniqueness object remains';
  end if;

  select count(*) into v_count
  from pg_catalog.pg_class index_class
  join pg_catalog.pg_namespace index_namespace
    on index_namespace.oid = index_class.relnamespace
  join pg_catalog.pg_index index_data
    on index_data.indexrelid = index_class.oid
  where index_namespace.nspname = 'public'
    and index_data.indrelid = 'public.retailer_products'::regclass
    and index_data.indisunique
    and index_data.indisvalid
    and index_data.indisready
    and (
      (
        index_class.relname = 'retailer_products_retailer_external_variant_unique_idx'
        and lower(regexp_replace(pg_catalog.pg_get_indexdef(index_class.oid), '\s+', ' ', 'g'))
          ~ '\(retailer_id, external_variant_id\) where \(external_variant_id is not null\)'
      )
      or (
        index_class.relname = 'retailer_products_retailer_exact_canonical_variant_unique_idx'
        and lower(regexp_replace(pg_catalog.pg_get_indexdef(index_class.oid), '\s+', ' ', 'g'))
          ~ '\(retailer_id, product_variant_id\) where \(external_variant_id is not null\)'
      )
      or (
        index_class.relname = 'retailer_products_retailer_legacy_url_unique_idx'
        and lower(regexp_replace(pg_catalog.pg_get_indexdef(index_class.oid), '\s+', ' ', 'g'))
          ~ '\(retailer_id, external_url\) where \(external_variant_id is null\)'
      )
    );
  if v_count <> 3 then
    raise exception 'URL identity migration validation failed: exact replacement index count is % instead of 3', v_count;
  end if;

  if to_regprocedure('public.retailer_products_enforce_url_identity_partition()') is null
     or not exists (
       select 1 from pg_catalog.pg_trigger
       where tgrelid = 'public.retailer_products'::regclass
         and tgname = 'retailer_products_url_identity_partition_guard'
         and not tgisinternal
         and tgenabled = 'O'
     ) then
    raise exception 'URL identity migration validation failed: URL identity partition guard is missing';
  end if;

  if (
    select pg_catalog.pg_get_userbyid(p.proowner) <> 'postgres'
      or has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      or has_function_privilege('service_role', p.oid, 'EXECUTE')
    from pg_catalog.pg_proc p
    where p.oid = 'public.retailer_products_enforce_url_identity_partition()'::regprocedure
  ) then
    raise exception 'URL identity migration validation failed: URL guard ownership or ACL drifted';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.offers'::regclass
      and c.conname = 'offers_retailer_product_unique'
      and c.contype = 'u'
      and c.convalidated
  ) then
    raise exception 'URL identity migration validation failed: one-offer-per-mapping constraint was not preserved';
  end if;
end
$post_validation$;

commit;
