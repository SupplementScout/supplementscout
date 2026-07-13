-- Setup for Product Variants Stage 2 executable SQL tests.
-- The runner creates a fresh local database, applies the active baseline, runs
-- this setup, executes the real migration in a separate psql process, and then
-- executes success or failure assertions. This file never drops schema objects.

\if :{?stage2_test_database_confirmed}
\else
  \echo 'Refusing setup: stage2_test_database_confirmed is required.'
  \quit 3
\endif
\if :{?stage2_test_host}
\else
  \echo 'Refusing setup: stage2_test_host is required.'
  \quit 3
\endif
\if :{?stage2_expected_database}
\else
  \echo 'Refusing setup: stage2_expected_database is required.'
  \quit 3
\endif
\if :{?stage2_scenario}
\else
  \echo 'Refusing setup: stage2_scenario is required.'
  \quit 3
\endif

select
  :'stage2_test_database_confirmed' = '1'
  and :'stage2_test_host' in ('127.0.0.1', 'localhost')
  and current_database() = :'stage2_expected_database'
  and current_database() like 'supplementscout_stage2_test_%'
  and position('aftboxmrdgyhizicfsfu' in current_database()) = 0
  and position('dlsbwshkzdsvzubjftbv' in current_database()) = 0
  as stage2_guard_ok
\gset

\if :stage2_guard_ok
\else
  \echo 'Refusing setup: disposable database guard failed.'
  \quit 3
\endif

truncate table
  public.outbound_clicks,
  public.price_history,
  public.offers,
  public.retailer_products,
  public.product_variants,
  public.product_merge_history,
  public.ignored_duplicate_product_pairs,
  public.search_events,
  public.products,
  public.retailers
restart identity cascade;

insert into public.retailers (id, name, slug, website) values
  (1, 'Expected retailer', 'expected-retailer', 'https://gymhigh.co.uk'),
  (2, 'Merge retailer A', 'merge-retailer-a', 'https://retailer-a.test'),
  (3, 'Merge retailer B', 'merge-retailer-b', 'https://retailer-b.test'),
  (4, 'Merge retailer C', 'merge-retailer-c', 'https://retailer-c.test');

insert into public.products (
  id, name, slug, brand, category, gtin, is_active
) values
  (510, 'Offer 538 canonical product', 'offer-538-product', 'Audit Brand', 'Protein', 'canonical-gtin-must-not-change', true),
  (511, 'Different product', 'different-product', 'Other Brand', 'Protein', 'different-product-gtin', true),
  (1001, 'Default Merge Product', 'default-merge-canonical', 'Merge Brand', 'Protein', null, true),
  (1002, 'Default Merge Product', 'default-merge-candidate', 'Merge Brand', 'Protein', null, true),
  (1101, 'Variant Merge Product', 'variant-merge-canonical', 'Merge Brand', 'Protein', null, true),
  (1102, 'Variant Merge Product', 'variant-merge-candidate', 'Merge Brand', 'Protein', null, true),
  (1201, 'Decision Merge Product', 'decision-merge-canonical', 'Merge Brand', 'Protein', null, true),
  (1202, 'Decision Merge Product', 'decision-merge-candidate', 'Merge Brand', 'Protein', null, true);

insert into public.product_variants (
  id, product_id, variant_key, display_name, flavour_code, flavour_label,
  size_value, size_unit, is_active, is_default
) values
  (603, 510, 'default', 'Default', null, null, null, null, true, true),
  (604, 510, 'chocolate-500g', 'Chocolate 500g', 'chocolate', 'Chocolate', 500, 'g', true, false),
  (605, 511, 'default', 'Default', null, null, null, null, true, true),
  (2001, 1001, 'default', 'Default', null, null, null, null, true, true),
  (2002, 1002, 'default', 'Default', null, null, null, null, true, true),
  (2101, 1101, 'default', 'Default', null, null, null, null, true, true),
  (2102, 1102, 'default', 'Default', null, null, null, null, true, true),
  (2103, 1102, 'vanilla', 'Vanilla', 'vanilla', 'Vanilla', null, null, true, false),
  (2201, 1201, 'default', 'Default', null, null, null, null, true, true),
  (2202, 1202, 'default', 'Default', null, null, null, null, true, true);

insert into public.retailer_products (
  id, retailer_id, product_id, product_variant_id, external_name,
  external_slug, external_url, external_gtin, external_product_id,
  external_variant_id, external_sku, external_options, match_method,
  match_confidence
) values
  (137, 1, 510, 603, 'Exact listing', 'exact-listing', 'https://gymhigh.co.uk/?post_type=product&p=3627', 'retailer-gtin-137', 'woo-product-3627', 'woo-variant-3627', 'SKU-3627', '{"Size":"Default"}', 'exact_url', 100),
  (549, 1, 510, 603, 'Different listing', 'different-listing', 'https://gymhigh.co.uk/?post_type=product&p=5490', 'retailer-gtin-549', 'woo-product-5490', 'woo-variant-5490', 'SKU-5490', '{"Size":"Default"}', 'manual', 80),
  (3001, 2, 1001, 2001, 'Simple canonical listing', null, 'https://retailer-a.test/simple-canonical', null, 'simple-canonical', 'simple-canonical-v1', null, null, 'manual', 100),
  (3002, 3, 1002, 2002, 'Simple candidate listing', null, 'https://retailer-b.test/simple-candidate', null, 'simple-candidate', 'simple-candidate-v1', null, null, 'manual', 100),
  (3003, 4, 1002, 2002, 'Candidate mapping without offer', null, 'https://retailer-c.test/orphan-candidate', null, 'simple-orphan', 'simple-orphan-v1', null, null, 'manual', 100),
  (3201, 2, 1201, 2201, 'Decision canonical listing', null, 'https://retailer-a.test/decision-canonical', null, 'decision-canonical', 'decision-canonical-v1', null, null, 'manual', 100),
  (3202, 2, 1202, 2202, 'Decision candidate listing', null, 'https://retailer-a.test/decision-candidate', null, 'decision-candidate', 'decision-candidate-v1', null, null, 'manual', 100),
  (3203, 4, 1202, 2202, 'Decision orphan mapping', null, 'https://retailer-c.test/decision-orphan', null, 'decision-orphan', 'decision-orphan-v1', null, null, 'manual', 100);

insert into public.offers (
  id, product_id, retailer_id, product_variant_id, retailer_product_id,
  price, shipping_cost, total_price, in_stock, url, created_at,
  last_checked_at
) values
  (538, 510, 1, 603, null, 29.99, 3.99, 33.98, true, 'https://gymhigh.co.uk/?post_type=product&p=3627', '2026-07-01T10:00:00Z', '2026-07-13T10:00:00Z'),
  (4001, 1001, 2, 2001, 3001, 20, 0, 20, true, 'https://retailer-a.test/simple-canonical', now(), now()),
  (4002, 1002, 3, 2002, 3002, 21, 0, 21, true, 'https://retailer-b.test/simple-candidate', now(), now()),
  (4201, 1201, 2, 2201, 3201, 30, 0, 30, true, 'https://retailer-a.test/decision-canonical', now(), now()),
  (4202, 1202, 2, 2202, 3202, 31, 0, 31, true, 'https://retailer-a.test/decision-candidate', now(), now());

insert into public.price_history (
  id, offer_id, price, shipping_cost, total_price, checked_at, created_at
) values
  (9001, 538, 31.99, 3.99, 35.98, '2026-07-01T10:00:00Z', '2026-07-01T10:00:00Z'),
  (9002, 538, 29.99, 3.99, 33.98, '2026-07-13T10:00:00Z', '2026-07-13T10:00:00Z'),
  (9101, 4002, 21, 0, 21, now(), now()),
  (9201, 4201, 30, 0, 30, now(), now()),
  (9202, 4202, 31, 0, 31, now(), now());

insert into public.outbound_clicks (
  id, created_at, offer_id, product_id, retailer_id, destination_url, source_page
) values
  (8001, '2026-07-12T08:00:00Z', 538, 510, 1, 'https://gymhigh.co.uk/?post_type=product&p=3627', 'product_best_offer'),
  (8002, '2026-07-13T09:00:00Z', 538, 510, 1, 'https://gymhigh.co.uk/?post_type=product&p=3627', 'product_offer_list'),
  (8101, now(), 4002, 1002, 3, 'https://retailer-b.test/simple-candidate', 'product_offer_list'),
  (8201, now(), 4202, 1202, 2, 'https://retailer-a.test/decision-candidate', 'product_offer_list');

select :'stage2_scenario' = 'missing_mapping_137' as stage2_case \gset
\if :stage2_case
  delete from public.retailer_products where id = 137;
\endif
select :'stage2_scenario' = 'mapping_137_wrong_retailer' as stage2_case \gset
\if :stage2_case
  update public.retailer_products set retailer_id = 2 where id = 137;
\endif
select :'stage2_scenario' = 'mapping_137_wrong_product' as stage2_case \gset
\if :stage2_case
  update public.retailer_products set product_id = 511 where id = 137;
\endif
select :'stage2_scenario' = 'mapping_137_wrong_variant' as stage2_case \gset
\if :stage2_case
  update public.retailer_products set product_variant_id = 604 where id = 137;
\endif
select :'stage2_scenario' = 'mapping_137_wrong_url' as stage2_case \gset
\if :stage2_case
  update public.retailer_products set external_url = 'https://gymhigh.co.uk/?post_type=product&p=9999' where id = 137;
\endif
select :'stage2_scenario' = 'ambiguous_mapping_549' as stage2_case \gset
\if :stage2_case
  alter table public.retailer_products drop constraint retailer_products_retailer_url_unique;
  update public.retailer_products set external_url = 'https://gymhigh.co.uk/?post_type=product&p=3627' where id = 549;
\endif
select :'stage2_scenario' = 'offer_538_already_linked' as stage2_case \gset
\if :stage2_case
  update public.offers set retailer_product_id = 549 where id = 538;
\endif
select :'stage2_scenario' = 'partial_final_constraint' as stage2_case \gset
\if :stage2_case
  alter table public.offers add constraint offers_retailer_product_unique unique (retailer_product_id);
\endif
select :'stage2_scenario' = 'wrong_named_constraint' as stage2_case \gset
\if :stage2_case
  alter table public.offers add constraint offers_retailer_product_unique check (id > 0);
\endif
select :'stage2_scenario' = 'wrong_named_index_nonunique' as stage2_case \gset
\if :stage2_case
  create index retailer_products_retailer_external_variant_unique_idx on public.retailer_products (retailer_id, external_variant_id) where external_variant_id is not null;
\endif
select :'stage2_scenario' = 'wrong_index_predicate' as stage2_case \gset
\if :stage2_case
  create unique index retailer_products_retailer_external_variant_unique_idx on public.retailer_products (retailer_id, external_variant_id) where external_variant_id is null;
\endif
select :'stage2_scenario' = 'missing_retailer_url_unique' as stage2_case \gset
\if :stage2_case
  alter table public.retailer_products drop constraint retailer_products_retailer_url_unique;
\endif
select :'stage2_scenario' = 'before_merge_products_body_drift' as stage2_case \gset
\if :stage2_case
  create or replace function public.merge_products(
    canonical_id bigint,
    candidate_id bigint
  ) returns jsonb
  language plpgsql
  security definer
  set search_path to 'pg_catalog', 'public'
  as $drift$
  begin
    return jsonb_build_object('drifted', true);
  end;
  $drift$;
\endif
select :'stage2_scenario' = 'before_merge_decisions_body_drift' as stage2_case \gset
\if :stage2_case
  create or replace function public.merge_products_with_decisions(
    canonical_id bigint,
    candidate_id bigint,
    decisions jsonb
  ) returns jsonb
  language plpgsql
  security definer
  set search_path to 'pg_catalog', 'public'
  as $drift$
  begin
    return jsonb_build_object('drifted', true);
  end;
  $drift$;
\endif

drop schema if exists stage2_test cascade;
create schema stage2_test;
create table stage2_test.state_before (snapshot jsonb not null);
create function stage2_test.capture_state() returns jsonb
language sql
as $capture_state$
select jsonb_build_object(
  'offer_538', (select to_jsonb(o) from public.offers o where id = 538),
  'price_history', (select coalesce(jsonb_agg(to_jsonb(ph) order by id), '[]'::jsonb) from public.price_history ph where offer_id = 538),
  'outbound_clicks', (select coalesce(jsonb_agg(to_jsonb(oc) order by id), '[]'::jsonb) from public.outbound_clicks oc where offer_id = 538),
  'product_gtin', (select gtin from public.products where id = 510),
  'constraints', (
    select coalesce(jsonb_agg(jsonb_build_array(c.conrelid::regclass::text, c.conname, pg_get_constraintdef(c.oid, true)) order by c.conrelid::regclass::text, c.conname), '[]'::jsonb)
    from pg_constraint c
    where c.conrelid in ('public.offers'::regclass, 'public.retailer_products'::regclass, 'public.product_variants'::regclass)
  ),
  'indexes', (
    select coalesce(jsonb_agg(jsonb_build_array(indexname, indexdef) order by indexname), '[]'::jsonb)
    from pg_indexes where schemaname = 'public' and tablename in ('offers', 'retailer_products', 'product_variants')
  ),
  'not_null', (
    select coalesce(jsonb_agg(jsonb_build_array(attrelid::regclass::text, attname, attnotnull) order by attrelid::regclass::text, attname), '[]'::jsonb)
    from pg_attribute
    where attrelid in ('public.offers'::regclass, 'public.retailer_products'::regclass)
      and attname in ('product_id', 'retailer_id', 'product_variant_id', 'retailer_product_id')
      and not attisdropped
  ),
  'functions', (
    select coalesce(
      jsonb_agg(
        jsonb_build_array(
          p.oid::regprocedure::text,
          pg_get_functiondef(p.oid),
          p.proacl
        )
        order by p.oid::regprocedure::text
      ),
      '[]'::jsonb
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'merge_products',
        'merge_products_with_decisions',
        'merge_products_stage1_legacy',
        'merge_products_with_decisions_stage1_legacy',
        'stage2_prepare_default_only_merge'
      )
  )
);
$capture_state$;

insert into stage2_test.state_before (snapshot)
select stage2_test.capture_state();
