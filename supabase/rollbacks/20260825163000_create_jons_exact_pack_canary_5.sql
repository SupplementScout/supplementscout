begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $rollback$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_scope constant jsonb := '[
    {"product_id":795,"default_variant_id":1142,"mapping_id":1256,"offer_id":1070,"external_product_id":"10149317280082","external_variant_id":"51056074981714","external_sku":"CNP37001","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","price":12.99,"shipping":3.99,"total":16.98,"url":"https://jonssupplements.co.uk/products/cnp-ashwagandha-ksm-66-60-capsules?variant=51056074981714"},
    {"product_id":797,"default_variant_id":1144,"mapping_id":1258,"offer_id":1072,"external_product_id":"10913655718226","external_variant_id":"53897141911890","external_sku":"PFGUTH001","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","price":16.99,"shipping":3.99,"total":20.98,"url":"https://jonssupplements.co.uk/products/per4m-advanced-gut-health-30-capsules?variant=53897141911890"},
    {"product_id":798,"default_variant_id":1145,"mapping_id":1259,"offer_id":1073,"external_product_id":"10913523073362","external_variant_id":"53896643969362","external_sku":"PFMAGCAP00","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","price":12.99,"shipping":3.99,"total":16.98,"url":"https://jonssupplements.co.uk/products/per4m-advanced-magnesium-bisglycinate-120-capsules?variant=53896643969362"},
    {"product_id":801,"default_variant_id":1148,"mapping_id":1262,"offer_id":1076,"external_product_id":"10913543487826","external_variant_id":"53896878227794","external_sku":"PFLIVERS001","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","price":32.99,"shipping":3.99,"total":36.98,"url":"https://jonssupplements.co.uk/products/per4m-high-strength-liver-support-90-capsules?variant=53896878227794"},
    {"product_id":802,"default_variant_id":1149,"mapping_id":1263,"offer_id":1077,"external_product_id":"10913642774866","external_variant_id":"53897083978066","external_sku":"PFJOINT001","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","price":21.49,"shipping":3.99,"total":25.48,"url":"https://jonssupplements.co.uk/products/per4m-joint-120-capsules?variant=53897083978066"}
  ]'::jsonb;
  e record;
  v_new_id bigint;
  v_new_created_at timestamptz;
  v_rows integer;
  v_products_before bigint;
  v_variants_before bigint;
  v_mappings_before bigint;
  v_offers_before bigint;
  v_history_before bigint;
  v_series_before bigint;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Jon''s exact-pack canary rollback target mismatch';
  end if;
  if jsonb_array_length(v_scope)<>5
     or not exists(
       select 1 from supabase_migrations.schema_migrations
       where version='20260825163000' and name='create_jons_exact_pack_canary_5'
     ) then
    raise exception 'Jon''s exact-pack canary rollback ledger or scope mismatch';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('supplementscout:jons-exact-pack-canary-5', 0));
  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;
  select count(*) into v_series_before from public.price_identity_series;

  for e in
    select * from jsonb_to_recordset(v_scope) as x(
      product_id bigint, default_variant_id bigint, mapping_id bigint, offer_id bigint,
      external_product_id text, external_variant_id text, external_sku text,
      variant_key text, display_name text, size_value numeric, size_unit text,
      price numeric, shipping numeric, total numeric, url text
    ) order by mapping_id
  loop
    select id,created_at into v_new_id,v_new_created_at
    from public.product_variants
    where product_id=e.product_id and variant_key=e.variant_key
      and display_name=e.display_name and flavour_code is null and flavour_label is null
      and size_value=e.size_value and size_unit=e.size_unit and pack_count=1
      and product_format='capsule' and gtin is null and image is null
      and nutrition_override='{}'::jsonb and is_active and not is_default for update;

    if v_new_id is null
       or not exists(
         select 1 from public.product_variants
         where id=e.default_variant_id and product_id=e.product_id
           and variant_key='default' and display_name='Default'
           and flavour_code is null and flavour_label is null
           and size_value is null and size_unit is null and pack_count is null
           and product_format is null and is_active and is_default
       ) or not exists(
         select 1 from public.retailer_products
         where id=e.mapping_id and retailer_id=10 and product_id=e.product_id
           and product_variant_id=v_new_id and external_product_id=e.external_product_id
           and external_variant_id=e.external_variant_id
           and external_sku is not distinct from e.external_sku
           and coalesce(external_options,'{}'::jsonb)='{}'::jsonb and external_url=e.url
           and updated_at<=v_new_created_at
       ) or not exists(
         select 1 from public.offers
         where id=e.offer_id and retailer_id=10 and product_id=e.product_id
           and retailer_product_id=e.mapping_id and product_variant_id=v_new_id
           and price=e.price and shipping_cost=e.shipping and total_price=e.total
           and in_stock and url=e.url and last_checked_at<=v_new_created_at
       ) or exists(
         select 1 from public.price_identity_series where product_variant_id=v_new_id
       ) or (select count(*) from public.retailer_products where product_variant_id=v_new_id)<>1
       or (select count(*) from public.offers where product_variant_id=v_new_id)<>1 then
      raise exception 'Jon''s exact-pack rollback precondition or later-use guard mismatch for offer %',e.offer_id;
    end if;

    update public.retailer_products
    set product_variant_id=e.default_variant_id
    where id=e.mapping_id and retailer_id=10 and product_variant_id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s exact-pack mapping rollback affected % rows',v_rows; end if;

    update public.offers
    set product_variant_id=e.default_variant_id
    where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s exact-pack offer rollback affected % rows',v_rows; end if;

    delete from public.product_variants where id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s exact-pack variant rollback affected % rows',v_rows; end if;
  end loop;

  if (select count(*) from public.products)<>v_products_before
     or (select count(*) from public.product_variants)<>v_variants_before-5
     or (select count(*) from public.retailer_products)<>v_mappings_before
     or (select count(*) from public.offers)<>v_offers_before
     or (select count(*) from public.price_history)<>v_history_before
     or (select count(*) from public.price_identity_series)<>v_series_before
     or (select count(*) from public.retailer_products where retailer_id=10)<>506
     or (select count(*) from public.offers where retailer_id=10)<>506 then
    raise exception 'Jon''s exact-pack canary rollback global postcondition mismatch';
  end if;
end
$rollback$;

commit;
