begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $apply$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_manifest_sha256 constant text := '1ed188258ed4face02c7f9771d05fa732ab18abe7971a161ba8778fa284861f4';
  v_semantic_sha256 constant text := 'd07c604eb778e0504816423ebdfbd285c25aeb34618dadb128780d6fd4e34de4';
  v_scope constant jsonb := '[{"product_id":786,"product":"Per4m Mult Vita+Min 30 Capsules","default_variant_id":1070,"mapping_id":1178,"offer_id":992,"external_product_id":"10913416249682","external_variant_id":"53896427798866","external_sku":"PFMMULT010","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/per4m-mult-vita-min-multivitamins-30-capsules?variant=53896427798866","offer_url":"https://jonssupplements.co.uk/products/per4m-mult-vita-min-multivitamins-30-capsules?variant=53896427798866","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":12.99,"shipping":3.99,"total":16.98,"in_stock":true},{"product_id":791,"product":"Per4m Creatine Capsules | 30 Servings","default_variant_id":1138,"mapping_id":1252,"offer_id":1066,"external_product_id":"10913998405970","external_variant_id":"53899052319058","external_sku":"PFCREACAP0","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/per4m-creatine-capsules-30-servings?variant=53899052319058","offer_url":"https://jonssupplements.co.uk/products/per4m-creatine-capsules-30-servings?variant=53899052319058","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":12.99,"shipping":3.99,"total":16.98,"in_stock":true},{"product_id":796,"product":"Per4m Advanced Curcumin | 60 Capsules","default_variant_id":1143,"mapping_id":1257,"offer_id":1071,"external_product_id":"10913951220050","external_variant_id":"53898992058706","external_sku":"PFCURCAP00","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/per4m-advanced-curcumin-60-capsules?variant=53898992058706","offer_url":"https://jonssupplements.co.uk/products/per4m-advanced-curcumin-60-capsules?variant=53898992058706","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":19.99,"shipping":3.99,"total":23.98,"in_stock":true},{"product_id":799,"product":"Per4m Advanced Omega 3 | 90 Softgels","default_variant_id":1146,"mapping_id":1260,"offer_id":1074,"external_product_id":"10913474249042","external_variant_id":"53896520597842","external_sku":"PFOMEGA002","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/per4m-advanced-omega-3-90-softgels?variant=53896520597842","offer_url":"https://jonssupplements.co.uk/products/per4m-advanced-omega-3-90-softgels?variant=53896520597842","variant_key":"90-servings","display_name":"90 Servings","size_value":90,"size_unit":"servings","pack_count":1,"price":16.99,"shipping":3.99,"total":20.98,"in_stock":true},{"product_id":820,"product":"Strom Sports AGB10+ Garlic 120 Caps","default_variant_id":1167,"mapping_id":1281,"offer_id":1095,"external_product_id":"10375540539730","external_variant_id":"51951286026578","external_sku":"STM48001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/strom-sports-agb10-garlic-120-caps?variant=51951286026578","offer_url":"https://jonssupplements.co.uk/products/strom-sports-agb10-garlic-120-caps?variant=51951286026578","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":31.99,"shipping":3.99,"total":35.98,"in_stock":true},{"product_id":822,"product":"Strom Sports Levagen®︎ 60 Capsules","default_variant_id":1169,"mapping_id":1283,"offer_id":1097,"external_product_id":"10373665620306","external_variant_id":"51944622293330","external_sku":"STM39001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/strom-sports-nbsp-levagen%C2%AE%EF%B8%8E-60-capsules?variant=51944622293330","offer_url":"https://jonssupplements.co.uk/products/strom-sports-nbsp-levagen%C2%AE%EF%B8%8E-60-capsules?variant=51944622293330","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":28.95,"shipping":3.99,"total":32.94,"in_stock":true},{"product_id":824,"product":"Strom Sports MultiMAX Multivitamins & Minerals 180 Tabs","default_variant_id":1171,"mapping_id":1285,"offer_id":1099,"external_product_id":"10083874177362","external_variant_id":"50818172879186","external_sku":"STM38001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/strom-sports-multimax-multivitamins-minerals-180-tabs?variant=50818172879186","offer_url":"https://jonssupplements.co.uk/products/strom-sports-multimax-multivitamins-minerals-180-tabs?variant=50818172879186","variant_key":"90-servings","display_name":"90 Servings","size_value":90,"size_unit":"servings","pack_count":1,"price":26.49,"shipping":3.99,"total":30.48,"in_stock":true},{"product_id":826,"product":"Strom Sports ThromboMax 60 Capsules","default_variant_id":1173,"mapping_id":1287,"offer_id":1101,"external_product_id":"10373573476690","external_variant_id":"51944505606482","external_sku":"STM30001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/strom-sports-thrombomax-60-capsules?variant=51944505606482","offer_url":"https://jonssupplements.co.uk/products/strom-sports-thrombomax-60-capsules?variant=51944505606482","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":31.99,"shipping":3.99,"total":35.98,"in_stock":true},{"product_id":827,"product":"Strom Sports Vitamin C 1000mg 100 Tabs","default_variant_id":1174,"mapping_id":1288,"offer_id":1102,"external_product_id":"10519521689938","external_variant_id":"52434375410002","external_sku":"STM52001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/strom-sports-vitamin-c-1000mg-100-tabs?variant=52434375410002","offer_url":"https://jonssupplements.co.uk/products/strom-sports-vitamin-c-1000mg-100-tabs?variant=52434375410002","variant_key":"100-servings","display_name":"100 Servings","size_value":100,"size_unit":"servings","pack_count":1,"price":12.99,"shipping":3.99,"total":16.98,"in_stock":true},{"product_id":828,"product":"Strom Sports Vitamin D3 & K2 90 Caps","default_variant_id":1175,"mapping_id":1289,"offer_id":1103,"external_product_id":"10850356724050","external_variant_id":"53686092169554","external_sku":"STM58001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/strom-sports-vitamin-d3-k2-90-caps?variant=53686092169554","offer_url":"https://jonssupplements.co.uk/products/strom-sports-vitamin-d3-k2-90-caps?variant=53686092169554","variant_key":"90-servings","display_name":"90 Servings","size_value":90,"size_unit":"servings","pack_count":1,"price":16.99,"shipping":3.99,"total":20.98,"in_stock":true}]'::jsonb;
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
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:jons-exact-pack:create_jons_exact_pack_ordinary_servings_a_10',0));
  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;
  select count(*) into v_series_before from public.price_identity_series;
  select count(*) into v_exact_before from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
    where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null;
  if v_exact_before <> 439 then raise exception 'Jon''s exact-pack baseline is %, expected 439',v_exact_before; end if;

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
