-- Assertions run after an expected Stage 2 migration failure. The persisted
-- snapshot proves that the transaction left both data and DDL unchanged.

\if :{?stage2_test_database_confirmed}
\else
  \quit 3
\endif
\if :{?stage2_test_host}
\else
  \quit 3
\endif
\if :{?stage2_expected_database}
\else
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
  \echo 'Refusing assertions: disposable database guard failed.'
  \quit 3
\endif

do $stage2_failure_assertions$
declare
  before_snapshot jsonb;
  after_snapshot jsonb;
begin
  select snapshot into before_snapshot from stage2_test.state_before;

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
        jsonb_agg(jsonb_build_array(p.oid::regprocedure::text, pg_get_functiondef(p.oid), p.proacl) order by p.oid::regprocedure::text),
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
  ) into after_snapshot;

  if after_snapshot is distinct from before_snapshot then
    raise exception 'Stage 2 failure did not roll back every data and DDL change';
  end if;
end;
$stage2_failure_assertions$;

select 'PASS Stage 2 failure rollback assertions' as result;
