-- Assertions run after the real Stage 2 migration on a disposable local DB.

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

do $stage2_success_catalog_and_data$
declare
  expected_offer jsonb;
  valid_acl_count integer;
begin
  select snapshot->'offer_538' into expected_offer from stage2_test.state_before;

  if (select to_jsonb(o) - 'retailer_product_id' from public.offers o where id = 538)
       is distinct from (expected_offer - 'retailer_product_id')
     or (select retailer_product_id from public.offers where id = 538) <> 137 then
    raise exception 'offer 538 changed beyond retailer_product_id = 137';
  end if;
  if (select coalesce(jsonb_agg(to_jsonb(ph) order by id), '[]'::jsonb) from public.price_history ph where offer_id = 538)
       is distinct from (select snapshot->'price_history' from stage2_test.state_before) then
    raise exception 'price_history for offer 538 changed';
  end if;
  if (select coalesce(jsonb_agg(to_jsonb(oc) order by id), '[]'::jsonb) from public.outbound_clicks oc where offer_id = 538)
       is distinct from (select snapshot->'outbound_clicks' from stage2_test.state_before) then
    raise exception 'outbound_clicks for offer 538 changed';
  end if;
  if (select gtin from public.products where id = 510)
       is distinct from (select snapshot->>'product_gtin' from stage2_test.state_before) then
    raise exception 'products.gtin changed';
  end if;
  if (select external_gtin from public.retailer_products where id = 137)
       is distinct from 'retailer-gtin-137' then
    raise exception 'retailer GTIN evidence changed';
  end if;

  if exists (
    select 1 from public.offers
    where product_id is null or retailer_id is null
       or product_variant_id is null or retailer_product_id is null
  ) or exists (select 1 from public.retailer_products where product_variant_id is null) then
    raise exception 'required Stage 2 linkage remains nullable in data';
  end if;
  if (select count(*) from pg_attribute
      where (attrelid, attname) in (
        ('public.retailer_products'::regclass, 'product_variant_id'),
        ('public.offers'::regclass, 'product_id'),
        ('public.offers'::regclass, 'retailer_id'),
        ('public.offers'::regclass, 'product_variant_id'),
        ('public.offers'::regclass, 'retailer_product_id')
      ) and attnotnull and not attisdropped) <> 5 then
    raise exception 'required Stage 2 columns are not all NOT NULL';
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.offers'::regclass and conname = 'offers_product_retailer_unique') then
    raise exception 'legacy offer uniqueness still exists';
  end if;
  if (select count(*) from pg_constraint
      where conname = any (array[
        'offers_retailer_product_unique',
        'product_variants_id_product_id_unique',
        'retailer_products_offer_identity_unique',
        'retailer_products_variant_product_fkey',
        'offers_retailer_product_identity_fkey'
      ]::text[]) and convalidated) <> 5 then
    raise exception 'final Stage 2 constraints are incomplete';
  end if;
  if not exists (
    select 1 from pg_index i
    where i.indexrelid = 'public.retailer_products_retailer_external_variant_unique_idx'::regclass
      and i.indisunique and i.indisvalid and i.indisready
      and pg_get_expr(i.indpred, i.indrelid) = '(external_variant_id IS NOT NULL)'
  ) then
    raise exception 'external variant partial unique index is incorrect';
  end if;
  select count(*)
  into valid_acl_count
  from (
    values
      ('public.merge_products(bigint,bigint)'::regprocedure, true),
      ('public.merge_products_with_decisions(bigint,bigint,jsonb)'::regprocedure, true),
      ('public.merge_products_stage1_legacy(bigint,bigint)'::regprocedure, false),
      ('public.merge_products_with_decisions_stage1_legacy(bigint,bigint,jsonb)'::regprocedure, false),
      ('public.stage2_prepare_default_only_merge(bigint,bigint)'::regprocedure, false)
  ) expected(function_oid, is_wrapper)
  join pg_catalog.pg_proc p on p.oid = expected.function_oid
  where not exists (
    select 1
    from pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) direct_acl
    where direct_acl.privilege_type = 'EXECUTE'
      and direct_acl.grantee <> p.proowner
      and (
        not expected.is_wrapper
        or direct_acl.grantee <> 'service_role'::regrole
      )
  )
    and (
      not expected.is_wrapper
      or exists (
        select 1
        from pg_catalog.aclexplode(
          coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
        ) direct_acl
        where direct_acl.privilege_type = 'EXECUTE'
          and direct_acl.grantee = 'service_role'::regrole
          and direct_acl.grantor = p.proowner
          and not direct_acl.is_grantable
      )
    )
    and not pg_catalog.has_function_privilege(
      'anon', expected.function_oid, 'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'authenticated', expected.function_oid, 'EXECUTE'
    )
    and pg_catalog.has_function_privilege(
      'service_role', expected.function_oid, 'EXECUTE'
    ) = expected.is_wrapper;

  if valid_acl_count <> 5 then
    raise exception 'Stage 2 merge function permissions permit a wrapper bypass';
  end if;
end;
$stage2_success_catalog_and_data$;

-- A second real variant for the same retailer/product is now legal.
insert into public.retailer_products (
  id, retailer_id, product_id, product_variant_id, external_name,
  external_url, external_gtin, external_product_id, external_variant_id,
  external_sku, external_options, match_method, match_confidence
) values (
  550, 1, 510, 604, 'Chocolate 500g listing',
  'https://gymhigh.co.uk/?post_type=product&p=3627&variant=chocolate-500g',
  'retailer-gtin-550', 'woo-product-3627', 'woo-variant-chocolate-500g',
  'SKU-CHOC-500', '{"Flavour":"Chocolate","Size":"500g"}', 'exact_variant', 100
);
insert into public.offers (
  id, product_id, retailer_id, product_variant_id, retailer_product_id,
  price, shipping_cost, total_price, in_stock, url
) values (
  539, 510, 1, 604, 550, 30.99, 0, 30.99, true,
  'https://gymhigh.co.uk/?post_type=product&p=3627&variant=chocolate-500g'
);

-- Unoffered mappings isolate each composite-offer mismatch from the unique
-- offer(retailer_product_id) constraint, so the FK is the rejecting object.
insert into public.retailer_products (
  id, retailer_id, product_id, product_variant_id, external_name,
  external_url, external_variant_id
) values
  (551, 1, 510, 603, 'Product mismatch target', 'https://reject.test/mapping-product', 'reject-product'),
  (552, 1, 510, 603, 'Retailer mismatch target', 'https://reject.test/mapping-retailer', 'reject-retailer'),
  (553, 1, 510, 603, 'Variant mismatch target', 'https://reject.test/mapping-variant', 'reject-variant');

do $stage2_rejections$
begin
  begin
    insert into public.offers (id, product_id, retailer_id, product_variant_id, retailer_product_id, url)
    values (6001, 510, 1, 603, 137, 'https://reject.test/duplicate-offer');
    raise exception 'Expected duplicate retailer_product offer rejection';
  exception when unique_violation then null; end;

  begin
    insert into public.retailer_products (id, retailer_id, product_id, product_variant_id, external_name, external_url, external_variant_id)
    values (6002, 1, 510, 604, 'Duplicate external variant', 'https://reject.test/duplicate-variant', 'woo-variant-3627');
    raise exception 'Expected duplicate external variant identity rejection';
  exception when unique_violation then null; end;

  begin
    insert into public.retailer_products (id, retailer_id, product_id, product_variant_id, external_name, external_url, external_variant_id)
    values (6003, 1, 511, 603, 'Wrong product variant', 'https://reject.test/wrong-rp-product', 'wrong-rp-product');
    set constraints all immediate;
    raise exception 'Expected retailer product/product variant mismatch rejection';
  exception when foreign_key_violation then set constraints all deferred; end;

  begin
    insert into public.offers (id, product_id, retailer_id, product_variant_id, retailer_product_id, url)
    values (6004, 511, 1, 603, 551, 'https://reject.test/wrong-offer-product');
    set constraints all immediate;
    raise exception 'Expected offer product mismatch rejection';
  exception when foreign_key_violation then set constraints all deferred; end;

  begin
    insert into public.offers (id, product_id, retailer_id, product_variant_id, retailer_product_id, url)
    values (6005, 510, 2, 603, 552, 'https://reject.test/wrong-offer-retailer');
    set constraints all immediate;
    raise exception 'Expected offer retailer mismatch rejection';
  exception when foreign_key_violation then set constraints all deferred; end;

  begin
    insert into public.offers (id, product_id, retailer_id, product_variant_id, retailer_product_id, url)
    values (6006, 510, 1, 604, 553, 'https://reject.test/wrong-offer-variant');
    set constraints all immediate;
    raise exception 'Expected offer canonical variant mismatch rejection';
  exception when foreign_key_violation then set constraints all deferred; end;

  begin
    insert into public.offers (id, product_id, retailer_id, product_variant_id, retailer_product_id, url)
    values (6007, null, 1, 603, 137, 'https://reject.test/null-product');
    raise exception 'Expected NULL offer product rejection';
  exception when not_null_violation then null; end;
  begin
    insert into public.offers (id, product_id, retailer_id, product_variant_id, retailer_product_id, url)
    values (6008, 510, null, 603, 137, 'https://reject.test/null-retailer');
    raise exception 'Expected NULL offer retailer rejection';
  exception when not_null_violation then null; end;
  begin
    insert into public.offers (id, product_id, retailer_id, product_variant_id, retailer_product_id, url)
    values (6009, 510, 1, null, 137, 'https://reject.test/null-variant');
    raise exception 'Expected NULL offer variant rejection';
  exception when not_null_violation then null; end;
  begin
    insert into public.offers (id, product_id, retailer_id, product_variant_id, retailer_product_id, url)
    values (6010, 510, 1, 603, null, 'https://reject.test/null-mapping');
    raise exception 'Expected NULL offer retailer_product rejection';
  exception when not_null_violation then null; end;
end;
$stage2_rejections$;

-- Existing default-only merges keep referential integrity and click evidence.
select public.merge_products(1001, 1002);
do $stage2_simple_merge_assertions$
begin
  if not exists (select 1 from public.products where id = 1002 and not is_active and merged_into_product_id = 1001) then
    raise exception 'simple merge did not retire candidate';
  end if;
  if not exists (select 1 from public.offers where id = 4002 and product_id = 1001 and product_variant_id = 2001 and retailer_product_id = 3002) then
    raise exception 'simple merge offer identity is incorrect';
  end if;
  if (select count(*) from public.retailer_products where id in (3002, 3003) and product_id = 1001 and product_variant_id = 2001) <> 2 then
    raise exception 'simple merge did not preserve all mappings';
  end if;
  if not exists (select 1 from public.price_history where id = 9101 and offer_id = 4002 and price = 21) then
    raise exception 'simple merge changed price history';
  end if;
  if not exists (select 1 from public.outbound_clicks where id = 8101 and offer_id = 4002 and product_id = 1001 and retailer_id = 3 and destination_url = 'https://retailer-b.test/simple-candidate' and source_page = 'product_offer_list') then
    raise exception 'simple merge did not preserve outbound click';
  end if;
end;
$stage2_simple_merge_assertions$;

-- A product with an active non-default variant is blocked without mutation.
do $stage2_variant_merge_block$
declare
  before_state jsonb;
  after_state jsonb;
begin
  select jsonb_build_object(
    'products', (select jsonb_agg(to_jsonb(p) order by id) from public.products p where id in (1101, 1102)),
    'variants', (select jsonb_agg(to_jsonb(pv) order by id) from public.product_variants pv where product_id in (1101, 1102))
  ) into before_state;
  begin
    perform public.merge_products(1101, 1102);
    raise exception 'Expected non-default variant merge rejection';
  exception when others then
    if sqlerrm not like 'Merge blocked: Product Variants Stage 2%' then raise; end if;
  end;
  select jsonb_build_object(
    'products', (select jsonb_agg(to_jsonb(p) order by id) from public.products p where id in (1101, 1102)),
    'variants', (select jsonb_agg(to_jsonb(pv) order by id) from public.product_variants pv where product_id in (1101, 1102))
  ) into after_state;
  if after_state is distinct from before_state then
    raise exception 'blocked variant merge changed data';
  end if;
end;
$stage2_variant_merge_block$;

-- The conflict-aware RPC preserves/reassigns histories, clicks, and orphan mappings.
select public.merge_products_with_decisions(
  1201,
  1202,
  '{"offerConflicts":[{"canonicalOfferId":4201,"candidateOfferId":4202,"decision":"keep_canonical"}],"retailerProductConflicts":[{"canonicalMappingId":3201,"candidateMappingId":3202,"decision":"keep_canonical"}]}'::jsonb
);
do $stage2_decision_merge_assertions$
begin
  if exists (select 1 from public.offers where id = 4202)
     or not exists (select 1 from public.offers where id = 4201 and product_id = 1201 and product_variant_id = 2201 and retailer_product_id = 3201) then
    raise exception 'decision merge offer result is incorrect';
  end if;
  if not exists (select 1 from public.price_history where id = 9202 and offer_id = 4201 and price = 31) then
    raise exception 'decision merge did not reassign price history';
  end if;
  if not exists (select 1 from public.outbound_clicks where id = 8201 and offer_id = 4201 and product_id = 1201 and retailer_id = 2 and destination_url = 'https://retailer-a.test/decision-candidate' and source_page = 'product_offer_list') then
    raise exception 'decision merge did not preserve click evidence';
  end if;
  if not exists (select 1 from public.retailer_products where id = 3203 and product_id = 1201 and product_variant_id = 2201) then
    raise exception 'decision merge lost orphan mapping';
  end if;
  if exists (
    select 1 from public.offers o
    join public.retailer_products rp on rp.id = o.retailer_product_id
    where (o.product_id, o.retailer_id, o.product_variant_id)
      is distinct from (rp.product_id, rp.retailer_id, rp.product_variant_id)
  ) then
    raise exception 'decision merge left inconsistent offer identity';
  end if;
end;
$stage2_decision_merge_assertions$;

select 'PASS Product Variants Stage 2 executable SQL assertions' as result;
