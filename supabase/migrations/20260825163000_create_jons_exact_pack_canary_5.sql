begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $apply$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_authority constant text := 'owner-chat-2026-08-25-jons-exact-pack-canary-5';
  v_evidence_sha256 constant text := 'e50a96fca517b8297594799ac74bbf9fffe18a37797a60a90f560b992394dbe1';
  v_source_sha256 constant text := 'd96a76914db406cbc24de52d91f79ceabbadca2c66ccb43e384bd0be23ee5fc7';
  v_scope constant jsonb := '[
    {"product_id":795,"product":"CNP Ashwagandha KSM-66 60 Capsules","default_variant_id":1142,"mapping_id":1256,"offer_id":1070,"external_product_id":"10149317280082","external_variant_id":"51056074981714","external_sku":"CNP37001","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","price":12.99,"shipping":3.99,"total":16.98,"url":"https://jonssupplements.co.uk/products/cnp-ashwagandha-ksm-66-60-capsules?variant=51056074981714"},
    {"product_id":797,"product":"Per4m Advanced Gut Health | 30 Capsules","default_variant_id":1144,"mapping_id":1258,"offer_id":1072,"external_product_id":"10913655718226","external_variant_id":"53897141911890","external_sku":"PFGUTH001","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","price":16.99,"shipping":3.99,"total":20.98,"url":"https://jonssupplements.co.uk/products/per4m-advanced-gut-health-30-capsules?variant=53897141911890"},
    {"product_id":798,"product":"Per4m Advanced Magnesium Bisglycinate 120 Capsules","default_variant_id":1145,"mapping_id":1259,"offer_id":1073,"external_product_id":"10913523073362","external_variant_id":"53896643969362","external_sku":"PFMAGCAP00","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","price":12.99,"shipping":3.99,"total":16.98,"url":"https://jonssupplements.co.uk/products/per4m-advanced-magnesium-bisglycinate-120-capsules?variant=53896643969362"},
    {"product_id":801,"product":"Per4m High Strength Liver Support | 90 Capsules","default_variant_id":1148,"mapping_id":1262,"offer_id":1076,"external_product_id":"10913543487826","external_variant_id":"53896878227794","external_sku":"PFLIVERS001","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","price":32.99,"shipping":3.99,"total":36.98,"url":"https://jonssupplements.co.uk/products/per4m-high-strength-liver-support-90-capsules?variant=53896878227794"},
    {"product_id":802,"product":"Per4m Joint 120 Capsules","default_variant_id":1149,"mapping_id":1263,"offer_id":1077,"external_product_id":"10913642774866","external_variant_id":"53897083978066","external_sku":"PFJOINT001","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","price":21.49,"shipping":3.99,"total":25.48,"url":"https://jonssupplements.co.uk/products/per4m-joint-120-capsules?variant=53897083978066"}
  ]'::jsonb;
  e record;
  v_new_id bigint;
  v_rows integer;
  v_mapping_before jsonb;
  v_offer_before jsonb;
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
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu'
     or v_authority <> 'owner-chat-2026-08-25-jons-exact-pack-canary-5'
     or v_evidence_sha256 !~ '^[0-9a-f]{64}$'
     or v_source_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Jon''s exact-pack canary authority or production target mismatch';
  end if;

  if jsonb_array_length(v_scope) <> 5
     or (select count(distinct (x->>'product_id')::bigint) from jsonb_array_elements(v_scope) x) <> 5
     or (select count(distinct (x->>'default_variant_id')::bigint) from jsonb_array_elements(v_scope) x) <> 5
     or (select count(distinct (x->>'mapping_id')::bigint) from jsonb_array_elements(v_scope) x) <> 5
     or (select count(distinct (x->>'offer_id')::bigint) from jsonb_array_elements(v_scope) x) <> 5
     or (select count(distinct x->>'external_variant_id') from jsonb_array_elements(v_scope) x) <> 5 then
    raise exception 'Jon''s exact-pack canary scope identity mismatch';
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
      product_id bigint, product text, default_variant_id bigint, mapping_id bigint,
      offer_id bigint, external_product_id text, external_variant_id text,
      external_sku text, variant_key text, display_name text, size_value numeric,
      size_unit text, price numeric, shipping numeric, total numeric, url text
    ) order by mapping_id
  loop
    if not exists(
      select 1 from public.products
      where id=e.product_id and name=e.product and product_format='capsule'
        and is_active and merged_into_product_id is null for update
    ) or not exists(
      select 1 from public.product_variants
      where id=e.default_variant_id and product_id=e.product_id
        and variant_key='default' and display_name='Default'
        and flavour_code is null and flavour_label is null
        and size_value is null and size_unit is null and pack_count is null
        and product_format is null and is_active and is_default for update
    ) or exists(
      select 1 from public.product_variants
      where product_id=e.product_id and id<>e.default_variant_id
        and (variant_key=e.variant_key or (
          size_value=e.size_value and lower(coalesce(size_unit,''))=lower(e.size_unit)
          and pack_count=1
        ))
    ) then
      raise exception 'Jon''s exact-pack product/default/target mismatch for offer %', e.offer_id;
    end if;

    select to_jsonb(rp) into v_mapping_before
    from public.retailer_products rp
    where rp.id=e.mapping_id and rp.retailer_id=10 and rp.product_id=e.product_id
      and rp.product_variant_id=e.default_variant_id
      and rp.external_product_id=e.external_product_id
      and rp.external_variant_id=e.external_variant_id
      and rp.external_sku is not distinct from e.external_sku
      and coalesce(rp.external_options,'{}'::jsonb)='{}'::jsonb
      and rp.external_url=e.url for update;

    select to_jsonb(o) into v_offer_before
    from public.offers o
    where o.id=e.offer_id and o.retailer_id=10 and o.product_id=e.product_id
      and o.product_variant_id=e.default_variant_id and o.retailer_product_id=e.mapping_id
      and o.price=e.price and o.shipping_cost=e.shipping and o.total_price=e.total
      and o.in_stock and o.url=e.url for update;

    if v_mapping_before is null or v_offer_before is null
       or (select count(*) from public.product_variants where product_id=e.product_id) <> 1
       or (select count(*) from public.retailer_products where product_variant_id=e.default_variant_id) <> 1
       or (select count(*) from public.offers where product_variant_id=e.default_variant_id) <> 1 then
      raise exception 'Jon''s exact-pack mapping/offer exclusivity mismatch for offer %', e.offer_id;
    end if;

    insert into public.product_variants(
      product_id, variant_key, display_name, flavour_code, flavour_label,
      size_value, size_unit, pack_count, product_format, gtin, image,
      nutrition_override, is_default, is_active
    ) values (
      e.product_id, e.variant_key, e.display_name, null, null,
      e.size_value, e.size_unit, 1, 'capsule', null, null,
      '{}'::jsonb, false, true
    ) returning id into v_new_id;

    if v_new_id=e.default_variant_id then
      raise exception 'Jon''s exact-pack canary reused default variant identity';
    end if;

    update public.retailer_products
    set product_variant_id=v_new_id
    where id=e.mapping_id and retailer_id=10 and product_variant_id=e.default_variant_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s exact-pack mapping move affected % rows',v_rows; end if;

    update public.offers
    set product_variant_id=v_new_id
    where id=e.offer_id and retailer_product_id=e.mapping_id
      and product_variant_id=e.default_variant_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s exact-pack offer move affected % rows',v_rows; end if;

    if not exists(
      select 1 from public.product_variants v
      join public.retailer_products rp on rp.product_variant_id=v.id
      join public.offers o on o.product_variant_id=v.id and o.retailer_product_id=rp.id
      where v.id=v_new_id and v.product_id=e.product_id
        and v.variant_key=e.variant_key and v.display_name=e.display_name
        and v.flavour_code is null and v.flavour_label is null
        and v.size_value=e.size_value and v.size_unit=e.size_unit and v.pack_count=1
        and v.product_format='capsule' and v.gtin is null and v.image is null
        and v.nutrition_override='{}'::jsonb and v.is_active and not v.is_default
        and rp.id=e.mapping_id and o.id=e.offer_id
        and (to_jsonb(rp)-'product_variant_id')=(v_mapping_before-'product_variant_id')
        and (to_jsonb(o)-'product_variant_id')=(v_offer_before-'product_variant_id')
    ) or exists(
      select 1 from public.retailer_products where product_variant_id=e.default_variant_id
    ) or exists(
      select 1 from public.offers where product_variant_id=e.default_variant_id
    ) then
      raise exception 'Jon''s exact-pack preservation postcondition mismatch for offer %',e.offer_id;
    end if;
  end loop;

  if (select count(*) from public.products)<>v_products_before
     or (select count(*) from public.product_variants)<>v_variants_before+5
     or (select count(*) from public.retailer_products)<>v_mappings_before
     or (select count(*) from public.offers)<>v_offers_before
     or (select count(*) from public.price_history)<>v_history_before
     or (select count(*) from public.price_identity_series)<>v_series_before
     or (select count(*) from public.retailer_products where retailer_id=10)<>506
     or (select count(*) from public.offers where retailer_id=10)<>506 then
    raise exception 'Jon''s exact-pack canary global postcondition mismatch';
  end if;
end
$apply$;

commit;
