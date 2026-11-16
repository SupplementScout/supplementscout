-- Minimal catalogue dependencies for the existing publication RPC. The queue,
-- registry, audit trigger and hashing helpers are loaded from their real sources.
do $guard$
begin
  if current_database() !~ '^supplementscout_stage2_test_atomic_import_[a-z0-9_]+$'
     or inet_server_addr() is not null then
    raise exception 'LOCAL_PUBLICATION_FIXTURE_ONLY';
  end if;
end
$guard$;

create schema auth;
create function auth.role() returns text language sql stable as
$$ select current_setting('request.jwt.claim.role',true) $$;
create table public.retailers(id bigint primary key,name text not null,slug text not null);
create table public.products(id bigint primary key);
create table public.product_variants(id bigint primary key,product_id bigint not null references public.products(id));
create table public.retailer_products(
  id bigint primary key,retailer_id bigint not null references public.retailers(id),
  product_id bigint not null references public.products(id),product_variant_id bigint not null references public.product_variants(id),
  external_product_id text,external_variant_id text,external_url text
);
create table public.offers(
  id bigint primary key,retailer_id bigint not null references public.retailers(id),
  retailer_product_id bigint not null references public.retailer_products(id),
  product_id bigint not null references public.products(id),product_variant_id bigint not null references public.product_variants(id),
  price numeric,shipping_cost numeric,total_price numeric,in_stock boolean,url text
);
create table public.price_history(id bigint primary key,offer_id bigint references public.offers(id));
insert into public.retailers values(901,'Fixture Retailer','fixture-retailer');
insert into public.products select i from generate_series(1,38) i;
insert into public.product_variants select i,i from generate_series(1,38) i;
insert into public.retailer_products
select i,901,i,i,'product-'||i,'variant-'||i,'https://fixture.invalid/product/'||i from generate_series(1,38) i;
insert into public.offers
select i,901,i,i,i,10,3.99,13.99,true,'https://fixture.invalid/product/'||i from generate_series(1,38) i;
