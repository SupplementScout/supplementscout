begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $apply$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_manifest_sha256 constant text := '1ed188258ed4face02c7f9771d05fa732ab18abe7971a161ba8778fa284861f4';
  v_semantic_sha256 constant text := 'd07c604eb778e0504816423ebdfbd285c25aeb34618dadb128780d6fd4e34de4';
  v_scope constant jsonb := '[{"product_id":810,"product":"Trained By JP Iron 60 Capsules","default_variant_id":1157,"mapping_id":1271,"offer_id":1085,"external_product_id":"10091009671506","external_variant_id":"50845594059090","external_sku":"TBJ52001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-iron-60-capsules?variant=50845594059090","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-iron-60-capsules?variant=50845594059090","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":7.99,"shipping":3.99,"total":11.98,"in_stock":true},{"product_id":811,"product":"Trained By JP Love Heart 60 Caps","default_variant_id":1158,"mapping_id":1272,"offer_id":1086,"external_product_id":"10090823975250","external_variant_id":"50844944925010","external_sku":"TBJ19001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-love-heart-60-caps?variant=50844944925010","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-love-heart-60-caps?variant=50844944925010","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":28.79,"shipping":3.99,"total":32.78,"in_stock":true},{"product_id":812,"product":"Trained By JP Magnesium 120 Capsules","default_variant_id":1159,"mapping_id":1273,"offer_id":1087,"external_product_id":"10022308512082","external_variant_id":"50571068408146","external_sku":"TBJ38001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-magnesium-120-capsules?variant=50571068408146","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-magnesium-120-capsules?variant=50571068408146","variant_key":"120-servings","display_name":"120 Servings","size_value":120,"size_unit":"servings","pack_count":1,"price":14.95,"shipping":3.99,"total":18.94,"in_stock":true},{"product_id":813,"product":"Trained By JP Oh Mega Omega 3-6-9 180 Capsules","default_variant_id":1160,"mapping_id":1274,"offer_id":1088,"external_product_id":"10092312068434","external_variant_id":"50850616410450","external_sku":"TBJ55001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-omega-3-6-9-180-capsules?variant=50850616410450","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-omega-3-6-9-180-capsules?variant=50850616410450","variant_key":"180-servings","display_name":"180 Servings","size_value":180,"size_unit":"servings","pack_count":1,"price":12.49,"shipping":3.99,"total":16.48,"in_stock":true},{"product_id":815,"product":"Trained By JP Pycnogenol 30 Capsules","default_variant_id":1162,"mapping_id":1276,"offer_id":1090,"external_product_id":"10092319211858","external_variant_id":"50850659631442","external_sku":"TBJ56001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-pycnogenol-30-capsules?variant=50850659631442","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-pycnogenol-30-capsules?variant=50850659631442","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":24.99,"shipping":3.99,"total":28.98,"in_stock":true},{"product_id":817,"product":"Trained By JP Unwind Halcyon 120 Caps","default_variant_id":1164,"mapping_id":1278,"offer_id":1092,"external_product_id":"10090861363538","external_variant_id":"50845041164626","external_sku":"TBJ28001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-unwind-halcyon-120-caps?variant=50845041164626","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-unwind-halcyon-120-caps?variant=50845041164626","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":17.99,"shipping":3.99,"total":21.98,"in_stock":true},{"product_id":818,"product":"Trained By JP Zinc, Magnesium & B6 90 Capsules ZMA","default_variant_id":1165,"mapping_id":1279,"offer_id":1093,"external_product_id":"10193272602962","external_variant_id":"51223027646802","external_sku":"TBJ60001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-zinc-magnesium-b6-90-capsules?variant=51223027646802","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-zinc-magnesium-b6-90-capsules?variant=51223027646802","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":11.99,"shipping":3.99,"total":15.98,"in_stock":true},{"product_id":823,"product":"Strom Sports Maximise 120 Caps","default_variant_id":1170,"mapping_id":1284,"offer_id":1098,"external_product_id":"10074965508434","external_variant_id":"50781523575122","external_sku":"STM08001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/strom-sports-maximise-120-caps?variant=50781523575122","offer_url":"https://jonssupplements.co.uk/products/strom-sports-maximise-120-caps?variant=50781523575122","variant_key":"120-servings","display_name":"120 Servings","size_value":120,"size_unit":"servings","pack_count":1,"price":9.99,"shipping":3.99,"total":13.98,"in_stock":true},{"product_id":825,"product":"Strom Sports SupportMAX Joint 160 Caps","default_variant_id":1172,"mapping_id":1286,"offer_id":1100,"external_product_id":"10075286962514","external_variant_id":"51558285345106","external_sku":"STM16001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/strom-sports-supportmax-joint-160-caps?variant=51558285345106","offer_url":"https://jonssupplements.co.uk/products/strom-sports-supportmax-joint-160-caps?variant=51558285345106","variant_key":"40-servings","display_name":"40 Servings","size_value":40,"size_unit":"servings","pack_count":1,"price":38.99,"shipping":3.99,"total":42.98,"in_stock":true},{"product_id":829,"product":"Strom Sports ZMAX - Zinc Magensium & B6 - 90 Capsules","default_variant_id":1176,"mapping_id":1290,"offer_id":1104,"external_product_id":"10031152562514","external_variant_id":"50598379323730","external_sku":"STM36001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/strom-sports-zmax-zinc-magensium-b6-90-capsules?variant=50598379323730","offer_url":"https://jonssupplements.co.uk/products/strom-sports-zmax-zinc-magensium-b6-90-capsules?variant=50598379323730","variant_key":"45-servings","display_name":"45 Servings","size_value":45,"size_unit":"servings","pack_count":1,"price":19.99,"shipping":3.99,"total":23.98,"in_stock":true}]'::jsonb;
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
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:jons-exact-pack:create_jons_exact_pack_ordinary_servings_c_10',0));
  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;
  select count(*) into v_series_before from public.price_identity_series;
  select count(*) into v_exact_before from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
    where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null;
  if v_exact_before <> 459 then raise exception 'Jon''s exact-pack baseline is %, expected 459',v_exact_before; end if;

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
