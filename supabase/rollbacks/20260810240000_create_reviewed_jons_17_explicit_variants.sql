begin;

set local lock_timeout='5s';
set local statement_timeout='120s';

do $rollback$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_scope constant jsonb:='[
    {"product_id":835,"default_variant_id":1182,"mapping_id":1296,"offer_id":1110,"external_product_id":"10889771057490","external_variant_id":"53818329792850","external_sku":"APX14001","source_title":"Vanilla","variant_key":"vanilla-2000g","display_name":"Vanilla / 2000g","flavour_code":"vanilla","flavour_label":"Vanilla","size_value":2000,"size_unit":"g","size_label":"2000g","mapping_updated_at":"2026-07-20T07:32:19.065196+00:00","price":17.89,"shipping":3.99,"total":21.88,"last_checked_at":"2026-08-04T07:26:39.606+00:00","url":"https://jonssupplements.co.uk/products/apex-formulas-cream-of-oats-2kg?variant=53818329792850"},
    {"product_id":836,"default_variant_id":1183,"mapping_id":1297,"offer_id":1111,"external_product_id":"10538625761618","external_variant_id":"52499552797010","external_sku":"EFEC-0206","source_title":"Biscuit Spread","variant_key":"biscuit-spread-1800g","display_name":"Biscuit Spread / 1800g","flavour_code":"biscuit spread","flavour_label":"Biscuit Spread","size_value":1800,"size_unit":"g","size_label":"1800g","mapping_updated_at":"2026-07-20T07:32:19.521818+00:00","price":52.99,"shipping":3.99,"total":56.98,"last_checked_at":"2026-08-04T07:26:39.606+00:00","url":"https://jonssupplements.co.uk/products/efectiv-whey-protein-60-serving-1-8kg?variant=52499552797010"},
    {"product_id":837,"default_variant_id":1184,"mapping_id":1298,"offer_id":1112,"external_product_id":"10538638180690","external_variant_id":"52499565314386","external_sku":"MTJ14006","source_title":"Chocolate Peanut Butter","variant_key":"chocolate-peanut-butter-1800g","display_name":"Chocolate Peanut Butter / 1800g","flavour_code":"chocolate peanut butter","flavour_label":"Chocolate Peanut Butter","size_value":1800,"size_unit":"g","size_label":"1800g","mapping_updated_at":"2026-07-20T07:32:19.91876+00:00","price":38.99,"shipping":3.99,"total":42.98,"last_checked_at":"2026-08-04T07:26:39.606+00:00","url":"https://jonssupplements.co.uk/products/mountain-joes-shake-a-whey-1-8kg?variant=52499565314386"},
    {"product_id":839,"default_variant_id":1186,"mapping_id":1300,"offer_id":1114,"external_product_id":"10716188115282","external_variant_id":"53185997013330","external_sku":"GMK02001","source_title":"Cherry Bubblegum","variant_key":"cherry-bubblegum-25servings","display_name":"Cherry Bubblegum / 25servings","flavour_code":"cherry bubblegum","flavour_label":"Cherry Bubblegum","size_value":25,"size_unit":"servings","size_label":"25servings","mapping_updated_at":"2026-07-20T07:32:20.705564+00:00","price":34.99,"shipping":3.99,"total":38.98,"last_checked_at":"2026-08-04T07:26:39.606+00:00","url":"https://jonssupplements.co.uk/products/gas-mark-10-pitbull-pump-pre-workout-25-servings?variant=53185997013330"},
    {"product_id":840,"default_variant_id":1187,"mapping_id":1301,"offer_id":1115,"external_product_id":"10891853594962","external_variant_id":"53828561338706","external_sku":null,"source_title":"Blue Slush","variant_key":"blue-slush-420g","display_name":"Blue Slush / 420g","flavour_code":"blue slush","flavour_label":"Blue Slush","size_value":420,"size_unit":"g","size_label":"420g","mapping_updated_at":"2026-07-20T07:32:21.090286+00:00","price":31.49,"shipping":3.99,"total":35.48,"last_checked_at":"2026-08-04T07:26:39.606+00:00","url":"https://jonssupplements.co.uk/products/hr-labs-defib-original-420g?variant=53828561338706"},
    {"product_id":842,"default_variant_id":1189,"mapping_id":1303,"offer_id":1117,"external_product_id":"10558547427666","external_variant_id":"52577121206610","external_sku":"CTH29002","source_title":"Peach","variant_key":"peach-30servings","display_name":"Peach / 30servings","flavour_code":"peach","flavour_label":"Peach","size_value":30,"size_unit":"servings","size_label":"30servings","mapping_updated_at":"2026-07-20T07:32:21.86327+00:00","price":34.99,"shipping":3.99,"total":38.98,"last_checked_at":"2026-08-04T07:26:39.606+00:00","url":"https://jonssupplements.co.uk/products/conteh-sports-mega-pump-elite?variant=52577121206610"},
    {"product_id":843,"default_variant_id":1190,"mapping_id":1304,"offer_id":1118,"external_product_id":"10593823818066","external_variant_id":"52718620082514","external_sku":"PFM22005","source_title":"Double Chocolate","variant_key":"double-chocolate-1800g","display_name":"Double Chocolate / 1800g","flavour_code":"double chocolate","flavour_label":"Double Chocolate","size_value":1800,"size_unit":"g","size_label":"1800g","mapping_updated_at":"2026-07-20T07:32:22.259858+00:00","price":49.99,"shipping":3.99,"total":53.98,"last_checked_at":"2026-08-04T07:26:39.606+00:00","url":"https://jonssupplements.co.uk/products/per4m-egg-white-protein-1-8kg?variant=52718620082514"},
    {"product_id":844,"default_variant_id":1191,"mapping_id":1305,"offer_id":1119,"external_product_id":"10571987353938","external_variant_id":"52637042049362","external_sku":"PFM29002","source_title":"Blueberry Muffin","variant_key":"blueberry-muffin-16servings","display_name":"Blueberry Muffin / 16servings","flavour_code":"blueberry muffin","flavour_label":"Blueberry Muffin","size_value":16,"size_unit":"servings","size_label":"16servings","mapping_updated_at":"2026-07-20T07:32:22.639882+00:00","price":19.89,"shipping":3.99,"total":23.88,"last_checked_at":"2026-08-04T07:26:39.606+00:00","url":"https://jonssupplements.co.uk/products/per4m-protein-pancakes-16-servings?variant=52637042049362"},
    {"product_id":845,"default_variant_id":1192,"mapping_id":1306,"offer_id":1120,"external_product_id":"10623242469714","external_variant_id":"52846399193426","external_sku":"INP23001","source_title":"Bahama Mama","variant_key":"bahama-mama-460g","display_name":"Bahama Mama / 460g","flavour_code":"bahama mama","flavour_label":"Bahama Mama","size_value":460,"size_unit":"g","size_label":"460g","mapping_updated_at":"2026-07-20T07:32:23.036591+00:00","price":37.99,"shipping":3.99,"total":41.98,"last_checked_at":"2026-08-04T07:26:39.606+00:00","url":"https://jonssupplements.co.uk/products/innovapharm-mvpre-365-pre-workout-460g?variant=52846399193426"},
    {"product_id":846,"default_variant_id":1193,"mapping_id":1307,"offer_id":1121,"external_product_id":"10913708048722","external_variant_id":"53897264202066","external_sku":"PFGREEN004","source_title":"Apple Mango","variant_key":"apple-mango-150g","display_name":"Apple Mango / 150g","flavour_code":"apple mango","flavour_label":"Apple Mango","size_value":150,"size_unit":"g","size_label":"150g","mapping_updated_at":"2026-07-20T07:32:23.428293+00:00","price":16.99,"shipping":3.99,"total":20.98,"last_checked_at":"2026-08-04T07:26:39.606+00:00","url":"https://jonssupplements.co.uk/products/per4m-greens-150g?variant=53897264202066"},
    {"product_id":847,"default_variant_id":1194,"mapping_id":1308,"offer_id":1122,"external_product_id":"10716120088914","external_variant_id":"53185770324306","external_sku":"PML07004","source_title":"Anaconda Apple","variant_key":"anaconda-apple-480g","display_name":"Anaconda Apple / 480g","flavour_code":"anaconda apple","flavour_label":"Anaconda Apple","size_value":480,"size_unit":"g","size_label":"480g","mapping_updated_at":"2026-07-20T07:32:23.810534+00:00","price":39.49,"shipping":3.99,"total":43.48,"last_checked_at":"2026-08-04T07:26:39.606+00:00","url":"https://jonssupplements.co.uk/products/performax-labs-hypermaxd-out-480g?variant=53185770324306"},
    {"product_id":848,"default_variant_id":1195,"mapping_id":1309,"offer_id":1123,"external_product_id":"10716089975122","external_variant_id":"53185595179346","external_sku":"PGE01003","source_title":"Blue Raz","variant_key":"blue-raz-380g","display_name":"Blue Raz / 380g","flavour_code":"blue raz","flavour_label":"Blue Raz","size_value":380,"size_unit":"g","size_label":"380g","mapping_updated_at":"2026-07-20T07:32:24.206289+00:00","price":32.99,"shipping":3.99,"total":36.98,"last_checked_at":"2026-08-04T07:26:39.606+00:00","url":"https://jonssupplements.co.uk/products/pharma-grade-pre-380g?variant=53185595179346"},
    {"product_id":849,"default_variant_id":1254,"mapping_id":1368,"offer_id":1182,"external_product_id":"10079892767058","external_variant_id":"51000175067474","external_sku":"EFEC-0705","source_title":"Black Cherry","variant_key":"black-cherry-300g","display_name":"Black Cherry / 300g","flavour_code":"black cherry","flavour_label":"Black Cherry","size_value":300,"size_unit":"g","size_label":"300g","mapping_updated_at":"2026-07-20T19:44:00.244495+00:00","price":19.99,"shipping":3.99,"total":23.98,"last_checked_at":"2026-08-04T07:26:39.606+00:00","url":"https://jonssupplements.co.uk/products/efectiv-performance-creatine-300g?variant=51000175067474"},
    {"product_id":853,"default_variant_id":1258,"mapping_id":1372,"offer_id":1186,"external_product_id":"10019951247698","external_variant_id":"52156907585874","external_sku":"EFEC-0830","source_title":"Cherry breeze","variant_key":"cherry-breeze-440g","display_name":"Cherry Breeze / 440g","flavour_code":"cherry breeze","flavour_label":"Cherry Breeze","size_value":440,"size_unit":"g","size_label":"440g","mapping_updated_at":"2026-07-20T19:44:01.912213+00:00","price":27.99,"shipping":3.99,"total":31.98,"last_checked_at":"2026-08-04T07:26:39.606+00:00","url":"https://jonssupplements.co.uk/products/efectiv-project-pump-pre-workout-440g?variant=52156907585874"},
    {"product_id":854,"default_variant_id":1259,"mapping_id":1373,"offer_id":1187,"external_product_id":"10436171497810","external_variant_id":"52158735384914","external_sku":"EFEC-0951","source_title":"Peach Rings","variant_key":"peach-rings-375g","display_name":"Peach Rings / 375g","flavour_code":"peach rings","flavour_label":"Peach Rings","size_value":375,"size_unit":"g","size_label":"375g","mapping_updated_at":"2026-07-20T19:44:02.317775+00:00","price":19.69,"shipping":3.99,"total":23.68,"last_checked_at":"2026-08-04T07:26:39.606+00:00","url":"https://jonssupplements.co.uk/products/efectiv-eaa-essential-amino-acids-375g?variant=52158735384914"},
    {"product_id":858,"default_variant_id":1263,"mapping_id":1377,"offer_id":1191,"external_product_id":"10044164899154","external_variant_id":"51000857723218","external_sku":"CNP60002","source_title":"Biscoff Spread","variant_key":"biscoff-spread-2000g","display_name":"Biscoff Spread / 2000g","flavour_code":"biscoff spread","flavour_label":"Biscoff Spread","size_value":2000,"size_unit":"g","size_label":"2000g","mapping_updated_at":"2026-07-20T19:44:03.921476+00:00","price":16.95,"shipping":3.99,"total":20.94,"last_checked_at":"2026-08-04T07:26:39.606+00:00","url":"https://jonssupplements.co.uk/products/cnp-professional-cream-of-rice-2kg?variant=51000857723218"},
    {"product_id":861,"default_variant_id":1266,"mapping_id":1380,"offer_id":1194,"external_product_id":"10085737333074","external_variant_id":"50825886171474","external_sku":"TBJ02018","source_title":"Apple Pie","variant_key":"apple-pie-2000g","display_name":"Apple Pie / 2000g","flavour_code":"apple pie","flavour_label":"Apple Pie","size_value":2000,"size_unit":"g","size_label":"2000g","mapping_updated_at":"2026-07-20T19:44:05.135265+00:00","price":16.99,"shipping":3.99,"total":20.98,"last_checked_at":"2026-08-04T07:26:39.606+00:00","url":"https://jonssupplements.co.uk/products/trained-by-jp-cream-of-rice-2kg?variant=50825886171474"}
  ]'::jsonb;
  e record;
  v_new_id bigint;
  v_new_created_at timestamptz;
  v_rows integer;
  v_products_before bigint;
  v_variants_before bigint;
  v_mappings_before bigint;
  v_offers_before bigint;
  v_history_count_before bigint;
  v_history_before jsonb;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'reviewed Jon''s 17-variant rollback target mismatch';
  end if;
  if jsonb_array_length(v_scope)<>17
     or (select count(distinct (x->>'product_id')::bigint) from jsonb_array_elements(v_scope) x)<>17
     or (select count(distinct (x->>'mapping_id')::bigint) from jsonb_array_elements(v_scope) x)<>17
     or (select count(distinct (x->>'offer_id')::bigint) from jsonb_array_elements(v_scope) x)<>17
     or (select count(distinct x->>'external_variant_id') from jsonb_array_elements(v_scope) x)<>17 then
    raise exception 'reviewed Jon''s rollback scope identity mismatch';
  end if;
  if not exists(select 1 from supabase_migrations.schema_migrations
    where version='20260810240000' and name='create_reviewed_jons_17_explicit_variants') then
    raise exception 'reviewed Jon''s forward migration ledger evidence is missing';
  end if;
  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_count_before from public.price_history;
  select coalesce(jsonb_agg(to_jsonb(ph) order by ph.offer_id,ph.id),'[]'::jsonb)
  into v_history_before from public.price_history ph
  where ph.offer_id in(select (x->>'offer_id')::bigint from jsonb_array_elements(v_scope) x);

  for e in select * from jsonb_to_recordset(v_scope) as x(product_id bigint,
    default_variant_id bigint,mapping_id bigint,offer_id bigint,external_product_id text,
    external_variant_id text,external_sku text,source_title text,variant_key text,
    display_name text,flavour_code text,flavour_label text,size_value numeric,
    size_unit text,size_label text,mapping_updated_at timestamptz,price numeric,
    shipping numeric,total numeric,last_checked_at timestamptz,url text) order by mapping_id loop
    select id,created_at into v_new_id,v_new_created_at from public.product_variants
    where product_id=e.product_id and variant_key=e.variant_key
      and display_name=e.display_name and flavour_code=e.flavour_code
      and flavour_label=e.flavour_label and size_value=e.size_value and size_unit=e.size_unit
      and pack_count=1 and product_format='powder' and gtin is null and image is null
      and nutrition_override='{}'::jsonb and is_active and not is_default for update;
    if v_new_id is null
       or not exists(select 1 from public.product_variants where id=e.default_variant_id
         and product_id=e.product_id and variant_key='default' and display_name='Default'
         and flavour_code is null and flavour_label is null and size_value is null
         and size_unit is null and pack_count is null and product_format is null
         and is_active and is_default)
       or not exists(select 1 from public.retailer_products where id=e.mapping_id
         and retailer_id=10 and product_id=e.product_id and product_variant_id=v_new_id
         and external_product_id=e.external_product_id and external_variant_id=e.external_variant_id
         and external_sku is not distinct from e.external_sku and external_url=e.url
         and external_options=jsonb_build_object('Size',e.size_label,'Flavour',e.source_title)
         and updated_at=v_new_created_at)
       or not exists(select 1 from public.offers where id=e.offer_id
         and retailer_id=10 and product_id=e.product_id and retailer_product_id=e.mapping_id
         and product_variant_id=v_new_id and price=e.price and shipping_cost=e.shipping
         and total_price=e.total and in_stock and url=e.url and last_checked_at=e.last_checked_at)
       or (select count(*) from public.retailer_products where product_variant_id=v_new_id)<>1
       or (select count(*) from public.offers where product_variant_id=v_new_id)<>1 then
      raise exception 'reviewed Jon''s rollback precondition or later-refresh guard mismatch for mapping %',e.mapping_id;
    end if;
    update public.retailer_products set product_variant_id=e.default_variant_id,
      external_options='{}'::jsonb,updated_at=e.mapping_updated_at
    where id=e.mapping_id and product_variant_id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'reviewed Jon''s mapping rollback affected % rows',v_rows; end if;
    update public.offers set product_variant_id=e.default_variant_id
    where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'reviewed Jon''s offer rollback affected % rows',v_rows; end if;
    delete from public.product_variants where id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'reviewed Jon''s variant rollback affected % rows',v_rows; end if;
  end loop;
  if (select count(*) from public.products)<>v_products_before
     or (select count(*) from public.product_variants)<>v_variants_before-17
     or (select count(*) from public.retailer_products)<>v_mappings_before
     or (select count(*) from public.offers)<>v_offers_before
     or (select count(*) from public.price_history)<>v_history_count_before
     or (select count(*) from public.retailer_products where retailer_id=10)<>506
     or (select count(*) from public.offers where retailer_id=10)<>506
     or (select coalesce(jsonb_agg(to_jsonb(ph) order by ph.offer_id,ph.id),'[]'::jsonb)
         from public.price_history ph where ph.offer_id in(
           select (x->>'offer_id')::bigint from jsonb_array_elements(v_scope) x))<>v_history_before then
    raise exception 'reviewed Jon''s 17-variant rollback global postcondition mismatch';
  end if;
end
$rollback$;

commit;
