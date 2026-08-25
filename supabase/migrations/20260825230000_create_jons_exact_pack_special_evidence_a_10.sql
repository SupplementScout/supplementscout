begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $apply$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_manifest_sha256 constant text := '39519dd966e1947f89c8872b0d1d360d5cde8b5b9c8f238cb6181180c8eb6f11';
  v_semantic_sha256 constant text := '287bcf1f3f37b34fcc3c1babd117084fdec28152253fae03547d4c12249d035f';
  v_scope constant jsonb := '[{"product_id":821,"product":"Strom Sports Flaxseed Oil 60 Softgels","default_variant_id":1168,"mapping_id":1282,"offer_id":1096,"external_product_id":"10090754408786","external_variant_id":"50844792586578","external_sku":"STM27001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/strom-sports-flaxseed-oil-60-softgels?variant=50844792586578","offer_url":"https://jonssupplements.co.uk/products/strom-sports-flaxseed-oil-60-softgels?variant=50844792586578","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":11.89,"shipping":3.99,"total":15.88,"in_stock":true},{"product_id":915,"product":"Atlas Infusions Full-Spectrum Collagen 500g","default_variant_id":1519,"mapping_id":1633,"offer_id":1447,"external_product_id":"10871717527890","external_variant_id":"53761553531218","external_sku":null,"external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/atlas-infusions-full-spectrum-collagen-5-types-ha-biotin?variant=53761553531218","offer_url":"https://jonssupplements.co.uk/products/atlas-infusions-full-spectrum-collagen-5-types-ha-biotin?variant=53761553531218","variant_key":"500g","display_name":"500g","size_value":500,"size_unit":"g","pack_count":1,"price":44.99,"shipping":3.99,"total":48.98,"in_stock":true},{"product_id":916,"product":"Atlas Infusions IGG-1 150g","default_variant_id":1520,"mapping_id":1634,"offer_id":1448,"external_product_id":"10871747019090","external_variant_id":"53761603895634","external_sku":null,"external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/tlas-infusions-igg-1-immune-gut-support-60-igg?variant=53761603895634","offer_url":"https://jonssupplements.co.uk/products/tlas-infusions-igg-1-immune-gut-support-60-igg?variant=53761603895634","variant_key":"150g","display_name":"150g","size_value":150,"size_unit":"g","pack_count":1,"price":42.99,"shipping":3.99,"total":46.98,"in_stock":true},{"product_id":917,"product":"Cellucor C4 Ripped 180g","default_variant_id":1521,"mapping_id":1635,"offer_id":1449,"external_product_id":"10861669679442","external_variant_id":"53726322196818","external_sku":"CEL07003","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/cellucor-c4-ripped-180g-30-servings?variant=53726322196818","offer_url":"https://jonssupplements.co.uk/products/cellucor-c4-ripped-180g-30-servings?variant=53726322196818","variant_key":"165g","display_name":"165g","size_value":165,"size_unit":"g","pack_count":1,"price":22.49,"shipping":3.99,"total":26.48,"in_stock":true},{"product_id":816,"product":"Trained By JP The One Multivitamin 60 Capsules","default_variant_id":1163,"mapping_id":1277,"offer_id":1091,"external_product_id":"10044244197714","external_variant_id":"50651687158098","external_sku":"TBJ51001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-the-one-multivitamins?variant=50651687158098","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-the-one-multivitamins?variant=50651687158098","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":12.99,"shipping":3.99,"total":16.98,"in_stock":true},{"product_id":862,"product":"Time 4 Omega 3 - 60 Softgels","default_variant_id":1267,"mapping_id":1381,"offer_id":1195,"external_product_id":"10135707255122","external_variant_id":"50999913611602","external_sku":"T403","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/time-4-omega-3-60-softgels?variant=50999913611602","offer_url":"https://jonssupplements.co.uk/products/time-4-omega-3-60-softgels?variant=50999913611602","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":17.99,"shipping":3.99,"total":21.98,"in_stock":true},{"product_id":931,"product":"Swedish Supplements Cutter 120 Caps","default_variant_id":1540,"mapping_id":1654,"offer_id":1468,"external_product_id":"10085668684114","external_variant_id":"50825200271698","external_sku":null,"external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/swedish-supplements-cutter-120-caps?variant=50825200271698","offer_url":"https://jonssupplements.co.uk/products/swedish-supplements-cutter-120-caps?variant=50825200271698","variant_key":"40-servings","display_name":"40 Servings","size_value":40,"size_unit":"servings","pack_count":1,"price":13.99,"shipping":3.99,"total":17.98,"in_stock":false},{"product_id":938,"product":"Trained By JP Cure-coming 60 Servings","default_variant_id":1553,"mapping_id":1667,"offer_id":1481,"external_product_id":"10022362513746","external_variant_id":"50571183915346","external_sku":"TBJ21001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-cure-coming-60-servings?variant=50571183915346","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-cure-coming-60-servings?variant=50571183915346","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":25.99,"shipping":3.99,"total":29.98,"in_stock":true},{"product_id":945,"product":"Trained By JP Natural Physique 60 Servings","default_variant_id":1564,"mapping_id":1678,"offer_id":1492,"external_product_id":"10044264874322","external_variant_id":"50651727135058","external_sku":"TBJ31001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-natural-physique?variant=50651727135058","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-natural-physique?variant=50651727135058","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":14.99,"shipping":3.99,"total":18.98,"in_stock":true},{"product_id":794,"product":"Time 4 Creatine Powder 600g","default_variant_id":1141,"mapping_id":1255,"offer_id":1069,"external_product_id":"10037593342290","external_variant_id":"50624212599122","external_sku":"T4C","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/time-4-creatine-powder-600g?variant=50624212599122","offer_url":"https://jonssupplements.co.uk/products/time-4-creatine-powder-600g?variant=50624212599122","variant_key":"600g","display_name":"600g","size_value":600,"size_unit":"g","pack_count":1,"price":22.99,"shipping":3.99,"total":26.98,"in_stock":true}]'::jsonb;
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
    raise exception 'Jon''s special-evidence exact-pack evidence or target mismatch';
  end if;
  if jsonb_array_length(v_scope) <> 10
     or (select count(distinct (x->>'product_id')::bigint) from jsonb_array_elements(v_scope) x) <> 10
     or (select count(distinct (x->>'mapping_id')::bigint) from jsonb_array_elements(v_scope) x) <> 10
     or (select count(distinct (x->>'offer_id')::bigint) from jsonb_array_elements(v_scope) x) <> 10
     or exists(select 1 from jsonb_array_elements(v_scope) x where (x->>'pack_count')::int <= 0
       or (x->>'size_value')::numeric <= 0 or x->>'size_unit' not in ('g','servings')) then
    raise exception 'Jon''s special-evidence exact-pack scope mismatch';
  end if;
  if (select count(*) from public.price_identity_series where retailer_id=10) <> 490
     or (select count(*) from public.price_history ph join public.price_identity_series s on s.id=ph.identity_series_id
         where s.retailer_id=10 and ph.observation_kind='daily_confirmation') <> 490 then
    raise exception 'Jon''s 490 producer prerequisite is incomplete';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:jons-exact-pack:create_jons_exact_pack_special_evidence_a_10',0));
  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;
  select count(*) into v_series_before from public.price_identity_series;
  select count(*) into v_exact_before from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
    where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null;
  if v_exact_before <> 490 then raise exception 'Jon''s exact-pack baseline is %, expected 490',v_exact_before; end if;

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
      raise exception 'Jon''s special-evidence product state mismatch for offer %',e.offer_id;
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
      raise exception 'Jon''s special-evidence binding or prior-series mismatch for offer %',e.offer_id;
    end if;
    insert into public.product_variants(
      product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,
      pack_count,product_format,gtin,image,nutrition_override,is_default,is_active
    ) values(e.product_id,e.variant_key,e.display_name,null,null,e.size_value,e.size_unit,
      e.pack_count,null,null,null,'{}'::jsonb,false,true) returning id into v_new_id;
    update public.retailer_products set product_variant_id=v_new_id
      where id=e.mapping_id and retailer_id=10 and product_variant_id=e.default_variant_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s special-evidence mapping move affected % rows',v_rows; end if;
    update public.offers set product_variant_id=v_new_id
      where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=e.default_variant_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s special-evidence offer move affected % rows',v_rows; end if;
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
      raise exception 'Jon''s special-evidence preservation mismatch for offer %',e.offer_id;
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
    raise exception 'Jon''s special-evidence exact-pack global postcondition mismatch';
  end if;
end
$apply$;

commit;
