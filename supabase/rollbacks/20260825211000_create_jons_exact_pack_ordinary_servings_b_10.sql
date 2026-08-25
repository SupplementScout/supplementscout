begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $rollback$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_scope constant jsonb := '[{"product_id":907,"product":"Strom Sports Quatrefolic (5-MTHF) 120 Tablets","default_variant_id":1508,"mapping_id":1622,"offer_id":1436,"external_product_id":"10379904418130","external_variant_id":"51966132093266","external_sku":"STM46001","external_options":{"Title":"Default Title"},"mapping_url":"https://jonssupplements.co.uk/products/strom-sports-quatrefolic-5-mthf-120-servings?variant=51966132093266","offer_url":"https://jonssupplements.co.uk/products/strom-sports-quatrefolic-5-mthf-120-servings?variant=51966132093266","variant_key":"120-servings","display_name":"120 Servings","size_value":120,"size_unit":"servings","pack_count":1,"price":21.99,"shipping":3.99,"total":25.98,"in_stock":true},{"product_id":910,"product":"Strom Sports PeakMax 80 Caps","default_variant_id":1512,"mapping_id":1626,"offer_id":1440,"external_product_id":"10090689593682","external_variant_id":"50844687696210","external_sku":"STM23001","external_options":{"Title":"Default Title"},"mapping_url":"https://jonssupplements.co.uk/products/strom-sports-peakmax-80-caps?variant=50844687696210","offer_url":"https://jonssupplements.co.uk/products/strom-sports-peakmax-80-caps?variant=50844687696210","variant_key":"20-servings","display_name":"20 Servings","size_value":20,"size_unit":"servings","pack_count":1,"price":33.99,"shipping":3.99,"total":37.98,"in_stock":true},{"product_id":928,"product":"Sports Fast Acting Co-Crystal Curcumin 60 Servings","default_variant_id":1536,"mapping_id":1650,"offer_id":1464,"external_product_id":"10375545848146","external_variant_id":"51951317123410","external_sku":"STM50001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/sports-fast-acting-co-crystal-curcumin-6%EF%B8%8E0%EF%B8%8E-servings?variant=51951317123410","offer_url":"https://jonssupplements.co.uk/products/sports-fast-acting-co-crystal-curcumin-6%EF%B8%8E0%EF%B8%8E-servings?variant=51951317123410","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":30.99,"shipping":3.99,"total":34.98,"in_stock":true},{"product_id":787,"product":"TBJP Oh Mega Pharma Pro 180 Capsules","default_variant_id":1071,"mapping_id":1179,"offer_id":993,"external_product_id":"10114493514066","external_variant_id":"50927006581074","external_sku":"TBJ24001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-oh-mega-pharma-pro-180-capsules?variant=50927006581074","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-oh-mega-pharma-pro-180-capsules?variant=50927006581074","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":29.99,"shipping":3.99,"total":33.98,"in_stock":true},{"product_id":688,"product":"TBJP Berberine 60 Capsules","default_variant_id":549,"mapping_id":1209,"offer_id":1023,"external_product_id":"10193267949906","external_variant_id":"51223012213074","external_sku":"TBJ58001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-berberine-60-capsules?variant=51223012213074","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-berberine-60-capsules?variant=51223012213074","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":12.98,"shipping":3.99,"total":16.97,"in_stock":true},{"product_id":91,"product":"Project AD Shredabull Untamed 2.0 50 Caps","default_variant_id":39,"mapping_id":1251,"offer_id":1065,"external_product_id":"10370727477586","external_variant_id":"51935656018258","external_sku":"AND40001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/project-ad-shredball-untamed-2-0-50-capsules?variant=51935656018258","offer_url":"https://jonssupplements.co.uk/products/project-ad-shredball-untamed-2-0-50-capsules?variant=51935656018258","variant_key":"50-servings","display_name":"50 Servings","size_value":50,"size_unit":"servings","pack_count":1,"price":39.99,"shipping":3.99,"total":43.98,"in_stock":true},{"product_id":800,"product":"Per4m D3 & K2 120 Tablets","default_variant_id":1147,"mapping_id":1261,"offer_id":1075,"external_product_id":"10913901936978","external_variant_id":"53898924458322","external_sku":"PFD3K2001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/per4m-d3-k2-120-tablets?variant=53898924458322","offer_url":"https://jonssupplements.co.uk/products/per4m-d3-k2-120-tablets?variant=53898924458322","variant_key":"120-servings","display_name":"120 Servings","size_value":120,"size_unit":"servings","pack_count":1,"price":12.99,"shipping":3.99,"total":16.98,"in_stock":true},{"product_id":807,"product":"Trained by JP Ashwagandha 60 caps","default_variant_id":1154,"mapping_id":1268,"offer_id":1082,"external_product_id":"10193278337362","external_variant_id":"51223051862354","external_sku":"TBJ59001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-ashwagandha-60-caps?variant=51223051862354","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-ashwagandha-60-caps?variant=51223051862354","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":12.49,"shipping":3.99,"total":16.48,"in_stock":true},{"product_id":808,"product":"Trained By JP D3 & K2 60 Caps","default_variant_id":1155,"mapping_id":1269,"offer_id":1083,"external_product_id":"10090859856210","external_variant_id":"50845015048530","external_sku":"TBJ29001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-d3-k2-60-caps?variant=50845015048530","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-d3-k2-60-caps?variant=50845015048530","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":16.99,"shipping":3.99,"total":20.98,"in_stock":true},{"product_id":809,"product":"Trained By JP Deep dream Sleep 120 Capsules","default_variant_id":1156,"mapping_id":1270,"offer_id":1084,"external_product_id":"10193281941842","external_variant_id":"51223073816914","external_sku":"TBJ26001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-deep-sleep-120-capsules?variant=51223073816914","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-deep-sleep-120-capsules?variant=51223073816914","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":26.99,"shipping":3.99,"total":30.98,"in_stock":true}]'::jsonb;
  e record;
  v_new_id bigint;
  v_new_created_at timestamptz;
  v_rows integer;
  v_variants_before bigint;
  v_history_before bigint;
  v_series_before bigint;
  v_exact_before bigint;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
     or jsonb_array_length(v_scope)<>10
     or not exists(select 1 from supabase_migrations.schema_migrations where version='20260825211000' and name='create_jons_exact_pack_ordinary_servings_b_10') then
    raise exception 'Jon''s ordinary rollback target, ledger or scope mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:jons-exact-pack:create_jons_exact_pack_ordinary_servings_b_10',0));
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_history_before from public.price_history;
  select count(*) into v_series_before from public.price_identity_series;
  select count(*) into v_exact_before from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
    where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null;
  for e in select * from jsonb_to_recordset(v_scope) as x(
    product_id bigint,product text,default_variant_id bigint,mapping_id bigint,offer_id bigint,
    external_product_id text,external_variant_id text,external_sku text,external_options jsonb,
    mapping_url text,offer_url text,variant_key text,display_name text,size_value numeric,
    size_unit text,pack_count integer,price numeric,shipping numeric,total numeric,in_stock boolean
  ) order by mapping_id loop
    select id,created_at into v_new_id,v_new_created_at from public.product_variants
      where product_id=e.product_id and variant_key=e.variant_key and display_name=e.display_name
        and flavour_code is null and flavour_label is null and size_value=e.size_value
        and size_unit=e.size_unit and pack_count=e.pack_count and product_format is null
        and gtin is null and image is null and nutrition_override='{}'::jsonb
        and is_active and not is_default for update;
    if v_new_id is null
       or not exists(select 1 from public.product_variants where id=e.default_variant_id
         and product_id=e.product_id and variant_key='default' and display_name='Default'
         and size_value is null and size_unit is null and pack_count is null and is_active and is_default)
       or not exists(select 1 from public.retailer_products where id=e.mapping_id and retailer_id=10
         and product_id=e.product_id and product_variant_id=v_new_id
         and external_product_id=e.external_product_id and external_variant_id=e.external_variant_id
         and external_sku is not distinct from e.external_sku
         and coalesce(external_options,'{}'::jsonb)=coalesce(e.external_options,'{}'::jsonb)
         and external_url=e.mapping_url and updated_at<=v_new_created_at)
       or not exists(select 1 from public.offers where id=e.offer_id and retailer_id=10
         and product_id=e.product_id and retailer_product_id=e.mapping_id and product_variant_id=v_new_id
         and price=e.price and shipping_cost=e.shipping and total_price=e.total
         and in_stock=e.in_stock and url=e.offer_url and last_checked_at<=v_new_created_at)
       or exists(select 1 from public.price_identity_series where offer_id=e.offer_id)
       or (select count(*) from public.retailer_products where product_variant_id=v_new_id)<>1
       or (select count(*) from public.offers where product_variant_id=v_new_id)<>1 then
      raise exception 'Jon''s ordinary rollback guard mismatch for offer %',e.offer_id;
    end if;
    update public.retailer_products set product_variant_id=e.default_variant_id where id=e.mapping_id and retailer_id=10 and product_variant_id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s ordinary mapping rollback affected % rows',v_rows; end if;
    update public.offers set product_variant_id=e.default_variant_id where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s ordinary offer rollback affected % rows',v_rows; end if;
    delete from public.product_variants where id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s ordinary variant rollback affected % rows',v_rows; end if;
  end loop;
  if (select count(*) from public.product_variants)<>v_variants_before-10
     or (select count(*) from public.price_history)<>v_history_before
     or (select count(*) from public.price_identity_series)<>v_series_before
     or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
         where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null
           and nullif(trim(v.size_unit),'') is not null)<>v_exact_before-10 then
    raise exception 'Jon''s ordinary rollback global postcondition mismatch';
  end if;
end
$rollback$;

commit;
