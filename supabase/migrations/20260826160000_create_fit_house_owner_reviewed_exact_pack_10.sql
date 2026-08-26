begin;

set local lock_timeout='5s';
set local statement_timeout='120s';

do $apply$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_authority constant text:='owner-chat-2026-08-26-approved-fit-house-exact-pack-10-pack-count-1';
  v_source_fingerprint constant text:='ef14011b0634d3f20053a569323eb8170defb458d28d22b1bbf700ef2416f1bb';
  v_scope constant jsonb:='[
    {"mode":"create","product_id":676,"product":"OstroVit Bacopa Monnieri 90 Capsules","default_variant_id":500,"mapping_id":686,"offer_id":694,"external_product_id":"9710810628336","external_variant_id":"48227374006512","external_sku":null,"external_options":null,"url":"https://fithouse.uk/products/bacopa-monnieri-90-caps?variant=48227374006512","variant_key":"90-servings","display_name":"90 Servings","size_value":90,"product_format":"capsule","price":9.99,"shipping":3.99,"total":13.98,"in_stock":true},
    {"mode":"create","product_id":696,"product":"Now Foods MSM 1500mg 200 Tablets","default_variant_id":568,"mapping_id":739,"offer_id":715,"external_product_id":"9347657269488","external_variant_id":"47199875530992","external_sku":null,"external_options":null,"url":"https://fithouse.uk/products/msm-1500-mg-200-tabs?variant=47199875530992","variant_key":"200-servings","display_name":"200 Servings","size_value":200,"product_format":"tablet","price":19.99,"shipping":3.99,"total":23.98,"in_stock":true},
    {"mode":"create","product_id":700,"product":"Now Foods Evening Primrose Oil 500mg 100 Softgels","default_variant_id":576,"mapping_id":743,"offer_id":719,"external_product_id":"8969071853808","external_variant_id":"46453750563056","external_sku":null,"external_options":null,"url":"https://fithouse.uk/products/now-foods-evening-primrose-oil-500-mg-100-gel-caps?variant=46453750563056","variant_key":"33-servings","display_name":"33 Servings","size_value":33,"product_format":"softgel","price":12.99,"shipping":3.99,"total":16.98,"in_stock":true},
    {"mode":"create","product_id":709,"product":"Trec Nutrition CM3 PRO+ 200 Capsules","default_variant_id":586,"mapping_id":790,"offer_id":728,"external_product_id":"9370261913840","external_variant_id":"47256925995248","external_sku":null,"external_options":null,"url":"https://fithouse.uk/products/trec-nutrition-cm3-pro-limited-edition-200-caps?variant=47256925995248","variant_key":"66-servings","display_name":"66 Servings","size_value":66,"product_format":"capsule","price":17.99,"shipping":3.99,"total":21.98,"in_stock":true},
    {"mode":"create","product_id":737,"product":"Nordic Naturals Nordic Flora Probiotic Comfort 15 Billion CFU 30 Capsules","default_variant_id":625,"mapping_id":870,"offer_id":756,"external_product_id":"9060343709936","external_variant_id":"46673002004720","external_sku":null,"external_options":null,"url":"https://fithouse.uk/products/nordic-naturals-nordic-flora-probiotic-comfort-15-billion-cfu-30-capsules?variant=46673002004720","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"product_format":"capsule","price":34.99,"shipping":3.99,"total":38.98,"in_stock":true},
    {"mode":"create","product_id":741,"product":"Swanson Full Spectrum Passion Flower 500mg 60 Capsules","default_variant_id":615,"mapping_id":874,"offer_id":760,"external_product_id":"8273427333360","external_variant_id":"44092616311024","external_sku":null,"external_options":null,"url":"https://fithouse.uk/products/swanson-full-spectrum-passion-flower-60-vege-caps?variant=44092616311024","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"product_format":"capsule","price":6.99,"shipping":3.99,"total":10.98,"in_stock":true},
    {"mode":"rebind","product_id":429,"product":"GYM HIGH Testo Pro 180 Capsules","default_variant_id":391,"target_variant_id":2967,"mapping_id":2084,"offer_id":1898,"external_product_id":"8293829509360","external_variant_id":"44155400061168","external_sku":null,"external_options":{},"url":"https://fithouse.uk/products/gym-high-testo-pro-180-caps?variant=44155400061168","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"product_format":"capsule","price":45.99,"shipping":3.99,"total":49.98,"in_stock":true},
    {"mode":"create","product_id":990,"product":"Osavi Colostrum Immuno 800 mg 60 Capsules","default_variant_id":1943,"mapping_id":2105,"offer_id":1919,"external_product_id":"8511380390128","external_variant_id":"45127862452464","external_sku":null,"external_options":{},"url":"https://fithouse.uk/products/osavi-colostrum-1000-mg-60-caps?variant=45127862452464","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"product_format":"capsule","price":13.99,"shipping":3.99,"total":17.98,"in_stock":true},
    {"mode":"create","product_id":994,"product":"Osavi Zinc+Copper 60 Capsules","default_variant_id":1947,"mapping_id":2106,"offer_id":1920,"external_product_id":"8520928100592","external_variant_id":"45150301618416","external_sku":null,"external_options":{},"url":"https://fithouse.uk/products/osavi-zinc-copper-120-vege-caps?variant=45150301618416","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"product_format":"capsule","price":9.99,"shipping":3.99,"total":13.98,"in_stock":true},
    {"mode":"create","product_id":972,"product":"Kilo Labs Supreme Pre‑Workout 20 servings Peach Rings Flavour","default_variant_id":1901,"mapping_id":2145,"offer_id":1959,"external_product_id":"9587128631536","external_variant_id":"47879495516400","external_sku":null,"external_options":{},"url":"https://fithouse.uk/products/kilo-labs-supreme-pre-workout-20-servings-peach-rings-flavour?variant=47879495516400","variant_key":"20-servings","display_name":"20 Servings","size_value":20,"product_format":"powder","price":39.99,"shipping":3.99,"total":43.98,"in_stock":true}
  ]'::jsonb;
  e record; v_target_variant_id bigint; v_rows integer; v_mapping_before jsonb; v_offer_before jsonb;
  v_products_before bigint; v_variants_before bigint; v_mappings_before bigint; v_offers_before bigint; v_history_before bigint; v_series_before bigint;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
    or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu' or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
    or v_authority<>'owner-chat-2026-08-26-approved-fit-house-exact-pack-10-pack-count-1'
    or v_source_fingerprint<>'ef14011b0634d3f20053a569323eb8170defb458d28d22b1bbf700ef2416f1bb' then raise exception 'Fit House exact-pack 10 authority, evidence or target mismatch'; end if;
  if jsonb_array_length(v_scope)<>10 or (select count(*) from jsonb_array_elements(v_scope) x where x->>'mode'='create')<>9
    or (select count(*) from jsonb_array_elements(v_scope) x where x->>'mode'='rebind')<>1
    or (select count(distinct (x->>'mapping_id')::bigint) from jsonb_array_elements(v_scope) x)<>10
    or exists(select 1 from jsonb_array_elements(v_scope) x where (x->>'mapping_id')::bigint in (687,869,2095,2096,2099,2112,2123)) then raise exception 'Fit House exact-pack 10 scope mismatch'; end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:fit-house-exact-pack:owner-reviewed-10',0));
  select count(*) into v_products_before from public.products; select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products; select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history; select count(*) into v_series_before from public.price_identity_series;
  if v_products_before<>1112 or v_variants_before<>2807 or v_mappings_before<>2761 or v_offers_before<>2761 or v_history_before<>4001
    or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id where rp.retailer_id=9 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null)<>243
    or (select count(*) from public.retailer_products where retailer_id=9)<>286 or (select count(*) from public.offers where retailer_id=9)<>286 then raise exception 'Fit House exact-pack 10 baseline mismatch'; end if;
  for e in select * from jsonb_to_recordset(v_scope) as x(mode text,product_id bigint,product text,default_variant_id bigint,target_variant_id bigint,mapping_id bigint,offer_id bigint,external_product_id text,external_variant_id text,external_sku text,external_options jsonb,url text,variant_key text,display_name text,size_value numeric,product_format text,price numeric,shipping numeric,total numeric,in_stock boolean) order by mapping_id loop
    if not exists(select 1 from public.products where id=e.product_id and name=e.product and is_active and merged_into_product_id is null for update)
      or not exists(select 1 from public.product_variants where id=e.default_variant_id and product_id=e.product_id and variant_key='default' and display_name='Default' and size_value is null and size_unit is null and pack_count is null and is_active and is_default for update)
      or exists(select 1 from public.price_identity_series where offer_id=e.offer_id) then raise exception 'Fit House product or prior-series mismatch for mapping %',e.mapping_id; end if;
    select to_jsonb(rp) into v_mapping_before from public.retailer_products rp where rp.id=e.mapping_id and rp.retailer_id=9 and rp.product_id=e.product_id and rp.product_variant_id=e.default_variant_id and rp.external_product_id=e.external_product_id and rp.external_variant_id=e.external_variant_id and rp.external_sku is not distinct from e.external_sku and coalesce(rp.external_options,'{}'::jsonb)=coalesce(e.external_options,'{}'::jsonb) and rp.external_url=e.url for update;
    select to_jsonb(o) into v_offer_before from public.offers o where o.id=e.offer_id and o.retailer_id=9 and o.product_id=e.product_id and o.product_variant_id=e.default_variant_id and o.retailer_product_id=e.mapping_id and o.price=e.price and o.shipping_cost=e.shipping and o.total_price=e.total and o.in_stock=e.in_stock and o.url=e.url for update;
    if v_mapping_before is null or v_offer_before is null then raise exception 'Fit House binding or commercial mismatch for mapping %',e.mapping_id; end if;
    if e.mode='create' then
      if exists(select 1 from public.product_variants where product_id=e.product_id and variant_key=e.variant_key) then raise exception 'Fit House target variant already exists for mapping %',e.mapping_id; end if;
      insert into public.product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active)
      values(e.product_id,e.variant_key,e.display_name,null,null,e.size_value,'servings',1,e.product_format,null,null,'{}'::jsonb,false,true) returning id into v_target_variant_id;
    elsif e.mode='rebind' then
      v_target_variant_id:=e.target_variant_id;
      if not exists(select 1 from public.product_variants where id=v_target_variant_id and product_id=e.product_id and variant_key=e.variant_key and display_name=e.display_name and size_value=e.size_value and size_unit='servings' and pack_count=1 and is_active and not is_default for update) then raise exception 'Fit House existing target mismatch for mapping %',e.mapping_id; end if;
    else raise exception 'Fit House unsupported mode for mapping %',e.mapping_id; end if;
    update public.retailer_products set product_variant_id=v_target_variant_id where id=e.mapping_id and retailer_id=9 and product_variant_id=e.default_variant_id;
    get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House mapping move affected % rows',v_rows; end if;
    update public.offers set product_variant_id=v_target_variant_id where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=e.default_variant_id;
    get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House offer move affected % rows',v_rows; end if;
    if not exists(select 1 from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id where rp.id=e.mapping_id and o.id=e.offer_id and rp.product_variant_id=v_target_variant_id and o.product_variant_id=v_target_variant_id and (to_jsonb(rp)-'product_variant_id')=(v_mapping_before-'product_variant_id') and (to_jsonb(o)-'product_variant_id')=(v_offer_before-'product_variant_id')) then raise exception 'Fit House preservation mismatch for mapping %',e.mapping_id; end if;
  end loop;
  if (select count(*) from public.products)<>v_products_before or (select count(*) from public.product_variants)<>v_variants_before+9
    or (select count(*) from public.retailer_products)<>v_mappings_before or (select count(*) from public.offers)<>v_offers_before
    or (select count(*) from public.price_history)<>v_history_before or (select count(*) from public.price_identity_series)<>v_series_before
    or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id where rp.retailer_id=9 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null)<>253 then raise exception 'Fit House exact-pack 10 postcondition mismatch'; end if;
end $apply$;

commit;
