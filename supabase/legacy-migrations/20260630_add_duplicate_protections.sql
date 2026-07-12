alter table public.offers
add constraint offers_product_retailer_unique
unique (product_id, retailer_id);

alter table public.products
add constraint products_slug_unique
unique (slug);

create unique index products_gtin_unique
on public.products (gtin)
where gtin is not null
  and trim(gtin) <> '';

alter table public.offers
add constraint offers_retailer_url_unique
unique (retailer_id, url);