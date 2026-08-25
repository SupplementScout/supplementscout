begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $apply$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_manifest_sha256 constant text := '1ed188258ed4face02c7f9771d05fa732ab18abe7971a161ba8778fa284861f4';
  v_semantic_sha256 constant text := 'd07c604eb778e0504816423ebdfbd285c25aeb34618dadb128780d6fd4e34de4';
  v_scope constant jsonb := '[{"product_id":832,"product":"Time 4 Digestive Enzymes 90 Capsules","default_variant_id":1179,"mapping_id":1293,"offer_id":1107,"external_product_id":"10135582835026","external_variant_id":"50999699276114","external_sku":"T4DE","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/time-4-digestive-enzymes-90-capsules?variant=50999699276114","offer_url":"https://jonssupplements.co.uk/products/time-4-digestive-enzymes-90-capsules?variant=50999699276114","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":17.99,"shipping":3.99,"total":21.98,"in_stock":true},{"product_id":833,"product":"Time 4 GDA - Glucose Disposal Agent - 180 Capsules","default_variant_id":1180,"mapping_id":1294,"offer_id":1108,"external_product_id":"10135747756370","external_variant_id":"51000143937874","external_sku":"T4GDA","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/time-4-gda-glucose-disposal-agent-180-capsules?variant=51000143937874","offer_url":"https://jonssupplements.co.uk/products/time-4-gda-glucose-disposal-agent-180-capsules?variant=51000143937874","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":29.99,"shipping":3.99,"total":33.98,"in_stock":true},{"product_id":834,"product":"Time 4 Immune Pro 120 Vegan Capsules","default_variant_id":1181,"mapping_id":1295,"offer_id":1109,"external_product_id":"10135591584082","external_variant_id":"50999715266898","external_sku":"T4IP","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/time-4-immune-pro-120-vegan-capsules?variant=50999715266898","offer_url":"https://jonssupplements.co.uk/products/time-4-immune-pro-120-vegan-capsules?variant=50999715266898","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":22.99,"shipping":3.99,"total":26.98,"in_stock":true},{"product_id":934,"product":"Time 4 Test 180 Capsules","default_variant_id":1543,"mapping_id":1657,"offer_id":1471,"external_product_id":"10035472171346","external_variant_id":"50613610512722","external_sku":"T4TEST","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/time-4-test-180-capsules?variant=50613610512722","offer_url":"https://jonssupplements.co.uk/products/time-4-test-180-capsules?variant=50613610512722","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":18.99,"shipping":3.99,"total":22.98,"in_stock":true},{"product_id":939,"product":"Trained By JP Digest Pharma Pro 60 Servings","default_variant_id":1554,"mapping_id":1668,"offer_id":1482,"external_product_id":"10022457606482","external_variant_id":"50571412472146","external_sku":"TBJ30001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-digest-pharma-pro-60-servings?variant=50571412472146","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-digest-pharma-pro-60-servings?variant=50571412472146","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":27.49,"shipping":3.99,"total":31.48,"in_stock":true},{"product_id":943,"product":"Trained By JP In-Sure GDA","default_variant_id":1560,"mapping_id":1674,"offer_id":1488,"external_product_id":"10341400281426","external_variant_id":"51821252673874","external_sku":"TBJ22001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-in-sure-gda?variant=51821252673874","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-in-sure-gda?variant=51821252673874","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":34.99,"shipping":3.99,"total":38.98,"in_stock":true},{"product_id":946,"product":"Trained By JP NMN 30 Servings","default_variant_id":1565,"mapping_id":1679,"offer_id":1493,"external_product_id":"10022332825938","external_variant_id":"50571137352018","external_sku":"TBJ47001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-nmn-30-servings?variant=50571137352018","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-nmn-30-servings?variant=50571137352018","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":34.99,"shipping":3.99,"total":38.98,"in_stock":true},{"product_id":947,"product":"Trained By JP Osteo Pro","default_variant_id":1566,"mapping_id":1680,"offer_id":1494,"external_product_id":"10469804114258","external_variant_id":"52268353913170","external_sku":"TBJ25001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-osteo-pro?variant=52268353913170","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-osteo-pro?variant=52268353913170","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":33.99,"shipping":3.99,"total":37.98,"in_stock":true},{"product_id":948,"product":"Trained By JP Vital Support 30 Servings","default_variant_id":1569,"mapping_id":1683,"offer_id":1497,"external_product_id":"10022442139986","external_variant_id":"50571372396882","external_sku":"TBJ27001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-vital-support-30-servings?variant=50571372396882","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-vital-support-30-servings?variant=50571372396882","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":38.99,"shipping":3.99,"total":42.98,"in_stock":true}]'::jsonb;
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
  v_exact_before bigint;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu'
     or v_manifest_sha256 !~ '^[0-9a-f]{64}$'
     or v_semantic_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Jon''s ordinary exact-pack evidence or target mismatch';
  end if;
  if jsonb_array_length(v_scope) <> 9
     or (select count(distinct (x->>'product_id')::bigint) from jsonb_array_elements(v_scope) x) <> 9
     or (select count(distinct (x->>'mapping_id')::bigint) from jsonb_array_elements(v_scope) x) <> 9
     or (select count(distinct (x->>'offer_id')::bigint) from jsonb_array_elements(v_scope) x) <> 9
     or exists(select 1 from jsonb_array_elements(v_scope) x where (x->>'pack_count')::int <= 0
       or (x->>'size_value')::numeric <= 0 or x->>'size_unit' not in ('g','servings')) then
    raise exception 'Jon''s ordinary exact-pack scope mismatch';
  end if;
  if (select count(*) from public.price_identity_series where retailer_id=10) <> 439
     or (select count(*) from public.price_history ph join public.price_identity_series s on s.id=ph.identity_series_id
         where s.retailer_id=10 and ph.observation_kind='daily_confirmation') <> 439 then
    raise exception 'Jon''s 439 producer prerequisite is incomplete';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:jons-exact-pack:create_jons_exact_pack_ordinary_servings_d_9',0));
  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;
  select count(*) into v_series_before from public.price_identity_series;
  select count(*) into v_exact_before from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
    where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null;
  if v_exact_before <> 469 then raise exception 'Jon''s exact-pack baseline is %, expected 469',v_exact_before; end if;

  for e in select * from jsonb_to_recordset(v_scope) as x(
    product_id bigint,product text,default_variant_id bigint,mapping_id bigint,offer_id bigint,
    external_product_id text,external_variant_id text,external_sku text,external_options jsonb,
    mapping_url text,offer_url text,variant_key text,display_name text,size_value numeric,
    size_unit text,pack_count integer,price numeric,shipping numeric,total numeric,in_stock boolean
  ) order by mapping_id loop
    if not exists(select 1 from public.products where id=e.product_id and name=e.product
        and is_active and merged_into_product_id is null for update)
       or not exists(select 1 from public.product_variants where id=e.default_variant_id
        and product_id=e.product_id and variant_key='default' and display_name='Default'
        and flavour_code is null and flavour_label is null and size_value is null
        and size_unit is null and pack_count is null and is_active and is_default for update)
       or (select count(*) from public.product_variants where product_id=e.product_id) <> 1
       or exists(select 1 from public.product_variants where product_id=e.product_id and variant_key=e.variant_key) then
      raise exception 'Jon''s ordinary product state mismatch for offer %',e.offer_id;
    end if;
    select to_jsonb(rp) into v_mapping_before from public.retailer_products rp
      where rp.id=e.mapping_id and rp.retailer_id=10 and rp.product_id=e.product_id
        and rp.product_variant_id=e.default_variant_id and rp.external_product_id=e.external_product_id
        and rp.external_variant_id=e.external_variant_id and rp.external_sku is not distinct from e.external_sku
        and coalesce(rp.external_options,'{}'::jsonb)=coalesce(e.external_options,'{}'::jsonb)
        and rp.external_url=e.mapping_url for update;
    select to_jsonb(o) into v_offer_before from public.offers o
      where o.id=e.offer_id and o.retailer_id=10 and o.product_id=e.product_id
        and o.product_variant_id=e.default_variant_id and o.retailer_product_id=e.mapping_id
        and o.price=e.price and o.shipping_cost=e.shipping and o.total_price=e.total
        and o.in_stock=e.in_stock and o.url=e.offer_url for update;
    if v_mapping_before is null or v_offer_before is null
       or (select count(*) from public.retailer_products where id=e.mapping_id and product_variant_id=e.default_variant_id) <> 1
       or (select count(*) from public.offers where id=e.offer_id and product_variant_id=e.default_variant_id) <> 1
       or exists(select 1 from public.price_identity_series where offer_id=e.offer_id) then
      raise exception 'Jon''s ordinary binding or prior-series mismatch for offer %',e.offer_id;
    end if;
    insert into public.product_variants(
      product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,
      pack_count,product_format,gtin,image,nutrition_override,is_default,is_active
    ) values(e.product_id,e.variant_key,e.display_name,null,null,e.size_value,e.size_unit,
      e.pack_count,null,null,null,'{}'::jsonb,false,true) returning id into v_new_id;
    update public.retailer_products set product_variant_id=v_new_id
      where id=e.mapping_id and retailer_id=10 and product_variant_id=e.default_variant_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s ordinary mapping move affected % rows',v_rows; end if;
    update public.offers set product_variant_id=v_new_id
      where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=e.default_variant_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s ordinary offer move affected % rows',v_rows; end if;
    if not exists(select 1 from public.product_variants v
      join public.retailer_products rp on rp.product_variant_id=v.id
      join public.offers o on o.product_variant_id=v.id and o.retailer_product_id=rp.id
      where v.id=v_new_id and v.product_id=e.product_id and v.variant_key=e.variant_key
        and v.display_name=e.display_name and v.flavour_code is null and v.flavour_label is null
        and v.size_value=e.size_value and v.size_unit=e.size_unit and v.pack_count=e.pack_count
        and v.product_format is null and v.gtin is null and v.image is null
        and v.nutrition_override='{}'::jsonb and v.is_active and not v.is_default
        and rp.id=e.mapping_id and o.id=e.offer_id
        and (to_jsonb(rp)-'product_variant_id')=(v_mapping_before-'product_variant_id')
        and (to_jsonb(o)-'product_variant_id')=(v_offer_before-'product_variant_id')) then
      raise exception 'Jon''s ordinary preservation mismatch for offer %',e.offer_id;
    end if;
  end loop;
  if (select count(*) from public.products)<>v_products_before
     or (select count(*) from public.product_variants)<>v_variants_before+9
     or (select count(*) from public.retailer_products)<>v_mappings_before
     or (select count(*) from public.offers)<>v_offers_before
     or (select count(*) from public.price_history)<>v_history_before
     or (select count(*) from public.price_identity_series)<>v_series_before
     or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
         where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null
           and nullif(trim(v.size_unit),'') is not null)<>v_exact_before+9
     or (select count(*) from public.retailer_products where retailer_id=10)<>506
     or (select count(*) from public.offers where retailer_id=10)<>506 then
    raise exception 'Jon''s ordinary exact-pack global postcondition mismatch';
  end if;
end
$apply$;

commit;
