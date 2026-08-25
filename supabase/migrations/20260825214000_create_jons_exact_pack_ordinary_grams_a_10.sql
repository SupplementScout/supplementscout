begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $apply$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_manifest_sha256 constant text := '1ed188258ed4face02c7f9771d05fa732ab18abe7971a161ba8778fa284861f4';
  v_semantic_sha256 constant text := 'd07c604eb778e0504816423ebdfbd285c25aeb34618dadb128780d6fd4e34de4';
  v_scope constant jsonb := '[{"product_id":927,"product":"PER4M Relax Hot Chocolate 375g","default_variant_id":1535,"mapping_id":1649,"offer_id":1463,"external_product_id":"10571983323474","external_variant_id":"52637027303762","external_sku":"PFM20001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/per4m-relax-hot-chocolate-stress-support-375g?variant=52637027303762","offer_url":"https://jonssupplements.co.uk/products/per4m-relax-hot-chocolate-stress-support-375g?variant=52637027303762","variant_key":"375g","display_name":"375g","size_value":375,"size_unit":"g","pack_count":1,"price":26.99,"shipping":3.99,"total":30.98,"in_stock":true},{"product_id":793,"product":"Conteh Sports Creatine Monohydrate 1kg","default_variant_id":1140,"mapping_id":1254,"offer_id":1068,"external_product_id":"10930888442194","external_variant_id":"53951719768402","external_sku":"CYH091002","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/conteh-sports-creatine-monohydrate-1kg?variant=53951719768402","offer_url":"https://jonssupplements.co.uk/products/conteh-sports-creatine-monohydrate-1kg?variant=53951719768402","variant_key":"1000g","display_name":"1000g","size_value":1000,"size_unit":"g","pack_count":1,"price":23.99,"shipping":3.99,"total":27.98,"in_stock":true},{"product_id":857,"product":"EHP Labs CREA-8 Creatine Monohydrate 50 Servings","default_variant_id":1262,"mapping_id":1376,"offer_id":1190,"external_product_id":"10593822277970","external_variant_id":"52718590263634","external_sku":null,"external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/ehp-labs-crea-8-creatine-monohydrate-50-servings?variant=52718590263634","offer_url":"https://jonssupplements.co.uk/products/ehp-labs-crea-8-creatine-monohydrate-50-servings?variant=52718590263634","variant_key":"250g","display_name":"250g","size_value":250,"size_unit":"g","pack_count":1,"price":18.99,"shipping":3.99,"total":22.98,"in_stock":false},{"product_id":831,"product":"Time 4 Collagen+ 45 Servings","default_variant_id":1178,"mapping_id":1292,"offer_id":1106,"external_product_id":"10342923927890","external_variant_id":"51828109181266","external_sku":"T4C+","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/time-collagen-45-servings?variant=51828109181266","offer_url":"https://jonssupplements.co.uk/products/time-collagen-45-servings?variant=51828109181266","variant_key":"405g","display_name":"405g","size_value":405,"size_unit":"g","pack_count":1,"price":28.99,"shipping":3.99,"total":32.98,"in_stock":true},{"product_id":851,"product":"Strom Sports Glycine 400g (Cherry)","default_variant_id":1256,"mapping_id":1370,"offer_id":1184,"external_product_id":"10084029006162","external_variant_id":"50818691170642","external_sku":"STM44001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/strom-sports-glycine-400g-cherry?variant=50818691170642","offer_url":"https://jonssupplements.co.uk/products/strom-sports-glycine-400g-cherry?variant=50818691170642","variant_key":"400g","display_name":"400g","size_value":400,"size_unit":"g","pack_count":1,"price":14.49,"shipping":3.99,"total":18.48,"in_stock":true},{"product_id":859,"product":"Performax Labs PhytoActivMax Greens 330g Peach Iced Tea","default_variant_id":1264,"mapping_id":1378,"offer_id":1192,"external_product_id":"10793840312658","external_variant_id":"53492771488082","external_sku":null,"external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/performax-labs-phytoactivmax-greens-330g?variant=53492771488082","offer_url":"https://jonssupplements.co.uk/products/performax-labs-phytoactivmax-greens-330g?variant=53492771488082","variant_key":"330g","display_name":"330g","size_value":330,"size_unit":"g","pack_count":1,"price":26.95,"shipping":3.99,"total":30.94,"in_stock":true},{"product_id":860,"product":"Strom Sports R&GMAX Greens & Reds 600g","default_variant_id":1265,"mapping_id":1379,"offer_id":1193,"external_product_id":"10075086455122","external_variant_id":"50781923639634","external_sku":"STM11002","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/strom-sports-r-gmax-greens-reds-600g?variant=50781923639634","offer_url":"https://jonssupplements.co.uk/products/strom-sports-r-gmax-greens-reds-600g?variant=50781923639634","variant_key":"600g","display_name":"600g","size_value":600,"size_unit":"g","pack_count":1,"price":35.49,"shipping":3.99,"total":39.48,"in_stock":true},{"product_id":920,"product":"CNP Pro Fuel 1.8kg","default_variant_id":1524,"mapping_id":1638,"offer_id":1452,"external_product_id":"10534968787282","external_variant_id":"52484237623634","external_sku":"CNP12001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/cnp-pro-fuel-1-8kg?variant=52484237623634","offer_url":"https://jonssupplements.co.uk/products/cnp-pro-fuel-1-8kg?variant=52484237623634","variant_key":"1800g","display_name":"1800g","size_value":1800,"size_unit":"g","pack_count":1,"price":14.49,"shipping":3.99,"total":18.48,"in_stock":true},{"product_id":922,"product":"CNP Professional Cyclic Dextrin 20 Servings","default_variant_id":1526,"mapping_id":1640,"offer_id":1454,"external_product_id":"10090918871378","external_variant_id":"50845282992466","external_sku":"CNP18001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/cnp-professional-cyclic-dextrin-20-servings?variant=50845282992466","offer_url":"https://jonssupplements.co.uk/products/cnp-professional-cyclic-dextrin-20-servings?variant=50845282992466","variant_key":"1000g","display_name":"1000g","size_value":1000,"size_unit":"g","pack_count":1,"price":22.99,"shipping":3.99,"total":26.98,"in_stock":true},{"product_id":930,"product":"Strom Sports SupportMAX Joint 240g","default_variant_id":1539,"mapping_id":1653,"offer_id":1467,"external_product_id":"10274783330642","external_variant_id":"51558301991250","external_sku":"STM17001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/strom-sports-supportmax-joint-240g-40-servings?variant=51558301991250","offer_url":"https://jonssupplements.co.uk/products/strom-sports-supportmax-joint-240g-40-servings?variant=51558301991250","variant_key":"240g","display_name":"240g","size_value":240,"size_unit":"g","pack_count":1,"price":38.99,"shipping":3.99,"total":42.98,"in_stock":true}]'::jsonb;
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
  if jsonb_array_length(v_scope) <> 10
     or (select count(distinct (x->>'product_id')::bigint) from jsonb_array_elements(v_scope) x) <> 10
     or (select count(distinct (x->>'mapping_id')::bigint) from jsonb_array_elements(v_scope) x) <> 10
     or (select count(distinct (x->>'offer_id')::bigint) from jsonb_array_elements(v_scope) x) <> 10
     or exists(select 1 from jsonb_array_elements(v_scope) x where (x->>'pack_count')::int <= 0
       or (x->>'size_value')::numeric <= 0 or x->>'size_unit' not in ('g','servings')) then
    raise exception 'Jon''s ordinary exact-pack scope mismatch';
  end if;
  if (select count(*) from public.price_identity_series where retailer_id=10) <> 439
     or (select count(*) from public.price_history ph join public.price_identity_series s on s.id=ph.identity_series_id
         where s.retailer_id=10 and ph.observation_kind='daily_confirmation') <> 439 then
    raise exception 'Jon''s 439 producer prerequisite is incomplete';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:jons-exact-pack:create_jons_exact_pack_ordinary_grams_a_10',0));
  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;
  select count(*) into v_series_before from public.price_identity_series;
  select count(*) into v_exact_before from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
    where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null;
  if v_exact_before <> 478 then raise exception 'Jon''s exact-pack baseline is %, expected 478',v_exact_before; end if;

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
     or (select count(*) from public.product_variants)<>v_variants_before+10
     or (select count(*) from public.retailer_products)<>v_mappings_before
     or (select count(*) from public.offers)<>v_offers_before
     or (select count(*) from public.price_history)<>v_history_before
     or (select count(*) from public.price_identity_series)<>v_series_before
     or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
         where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null
           and nullif(trim(v.size_unit),'') is not null)<>v_exact_before+10
     or (select count(*) from public.retailer_products where retailer_id=10)<>506
     or (select count(*) from public.offers where retailer_id=10)<>506 then
    raise exception 'Jon''s ordinary exact-pack global postcondition mismatch';
  end if;
end
$apply$;

commit;
