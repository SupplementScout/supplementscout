begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $apply$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_authority constant text := 'owner-chat-2026-08-26-gym-high-exact-pack-9';
  v_verified_batch_1_sha256 constant text := '724484e5f44e8dfaf1617d2aec75d0d636fcec3765984358365538f2a0988372';
  v_verified_batch_2_sha256 constant text := 'cb7b1e71ed449f89e1a2bb1d96a9e7fb3e21ab6403d6723bc05ea31c4367c6bf';
  v_catalogue_manifest_sha256 constant text := 'aa0d024e538f37f94ca75f643a3eaafb33beb0cd664d8dc9b9cf7e4a60fdbf40';
  v_live_identity_sha256 constant text := 'abd419fcd0400df086b666110b66a187c5f81747c26ea46ba80ad5cb5a301552';
  v_scope constant jsonb := '[{"product_id":1,"product":"GYM HIGH CREA-4 Elite Capsules","default_variant_id":559,"mapping_id":1,"offer_id":1,"external_product_id":"632","external_variant_id":"632","mapping_url":"https://gymhigh.co.uk/product/gym-high-crea-4-elite-capsules/","offer_url":"https://gymhigh.co.uk/product/gym-high-crea-4-elite-capsules/","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":25.99,"shipping":3.99,"total":29.98,"in_stock":true},{"product_id":429,"product":"GYM HIGH Testo Pro 180 Capsules","default_variant_id":391,"mapping_id":106,"offer_id":535,"external_product_id":"635","external_variant_id":"635","mapping_url":"https://gymhigh.co.uk/product/gym-high-testo-pro-capsules/","offer_url":"https://gymhigh.co.uk/product/gym-high-testo-pro-capsules/","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":53.99,"shipping":0,"total":53.99,"in_stock":true},{"product_id":427,"product":"GYM HIGH BCAA 120 Capsules","default_variant_id":379,"mapping_id":139,"offer_id":536,"external_product_id":"638","external_variant_id":"638","mapping_url":"https://gymhigh.co.uk/product/gym-high-bcaa-capsules/","offer_url":"https://gymhigh.co.uk/product/gym-high-bcaa-capsules/","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1,"price":17.99,"shipping":3.99,"total":21.98,"in_stock":true},{"product_id":412,"product":"GYM HIGH L-Glutamine  Powder 500g","default_variant_id":400,"mapping_id":141,"offer_id":540,"external_product_id":"700","external_variant_id":"700","mapping_url":"https://gymhigh.co.uk/product/gym-high-l-glutamine-powder/","offer_url":"https://gymhigh.co.uk/product/gym-high-l-glutamine-powder/","variant_key":"500g","display_name":"500g","size_value":500,"size_unit":"g","pack_count":1,"price":21.99,"shipping":3.99,"total":25.98,"in_stock":true},{"product_id":389,"product":"GYM HIGH Creatine Monohydrate Powder 250g","default_variant_id":555,"mapping_id":384,"offer_id":541,"external_product_id":"701","external_variant_id":"701","mapping_url":"https://gymhigh.co.uk/product/gym-high-creatine-monohydrate/","offer_url":"https://gymhigh.co.uk/product/gym-high-creatine-monohydrate/","variant_key":"250g","display_name":"250g","size_value":250,"size_unit":"g","pack_count":1,"price":21.99,"shipping":3.99,"total":25.98,"in_stock":true},{"product_id":444,"product":"GYM HIGH Beta-Alanine 250g","default_variant_id":533,"mapping_id":77,"offer_id":542,"external_product_id":"702","external_variant_id":"702","mapping_url":"https://gymhigh.co.uk/product/gym-high-beta-alanine-powder/","offer_url":"https://gymhigh.co.uk/product/gym-high-beta-alanine-powder/","variant_key":"250g","display_name":"250g","size_value":250,"size_unit":"g","pack_count":1,"price":22.99,"shipping":3.99,"total":26.98,"in_stock":true},{"product_id":413,"product":"GYM HIGH ZMB 60 Capsules","default_variant_id":390,"mapping_id":142,"offer_id":544,"external_product_id":"707","external_variant_id":"707","mapping_url":"https://gymhigh.co.uk/product/gym-high-zmb-60-capsules/","offer_url":"https://gymhigh.co.uk/product/gym-high-zmb-60-capsules/","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":16.99,"shipping":3.99,"total":20.98,"in_stock":false},{"product_id":516,"product":"GYM HIGH Pure L-Arginine powder 500g","default_variant_id":572,"mapping_id":385,"offer_id":551,"external_product_id":"3333","external_variant_id":"3333","mapping_url":"https://gymhigh.co.uk/product/gym-high-pure-l-arginine-powder/","offer_url":"https://gymhigh.co.uk/product/gym-high-pure-l-arginine-powder/","variant_key":"500g","display_name":"500g","size_value":500,"size_unit":"g","pack_count":1,"price":26.99,"shipping":3.99,"total":30.98,"in_stock":true},{"product_id":529,"product":"GYM HIGH Creatine Monohydrate 400g","default_variant_id":507,"mapping_id":387,"offer_id":554,"external_product_id":"4623","external_variant_id":"4623","mapping_url":"https://gymhigh.co.uk/product/gym-high-creatine-monohydrate-400g/","offer_url":"https://gymhigh.co.uk/product/gym-high-creatine-monohydrate-400g/","variant_key":"400g","display_name":"400g","size_value":400,"size_unit":"g","pack_count":1,"price":25.99,"shipping":3.99,"total":29.98,"in_stock":true}]'::jsonb;
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
     or v_authority <> 'owner-chat-2026-08-26-gym-high-exact-pack-9'
     or v_verified_batch_1_sha256 !~ '^[0-9a-f]{64}$'
     or v_verified_batch_2_sha256 !~ '^[0-9a-f]{64}$'
     or v_catalogue_manifest_sha256 !~ '^[0-9a-f]{64}$'
     or v_live_identity_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'GYM HIGH exact-pack evidence, authority or target mismatch';
  end if;
  if jsonb_array_length(v_scope) <> 9
     or (select count(distinct (x->>'product_id')::bigint) from jsonb_array_elements(v_scope) x) <> 9
     or (select count(distinct (x->>'mapping_id')::bigint) from jsonb_array_elements(v_scope) x) <> 9
     or (select count(distinct (x->>'offer_id')::bigint) from jsonb_array_elements(v_scope) x) <> 9
     or exists(select 1 from jsonb_array_elements(v_scope) x where (x->>'pack_count')::int <= 0
       or (x->>'size_value')::numeric <= 0 or x->>'size_unit' not in ('g','servings'))
     or exists(select 1 from jsonb_array_elements(v_scope) x where (x->>'offer_id')::bigint in
       (550,2500,2501,2502,2503,2504,2505,2506,2507,2508,2509,2510)) then
    raise exception 'GYM HIGH exact-pack scope mismatch';
  end if;
  if not exists(select 1 from public.price_observation_producers
      where retailer_id=1 and retailer_slug='gym-high'
        and source_importer='gym-high-reviewed-full-catalogue-v1'
        and approved_scope='reviewed-66' and technically_capable and enabled
        and public_use='owner-deferred' and terms_mode='standard-single-purchase-only') then
    raise exception 'GYM HIGH producer prerequisite is incomplete';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:gym-high-exact-pack:create_gym_high_exact_pack_9',0));
  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;
  select count(*) into v_series_before from public.price_identity_series;
  select count(*) into v_exact_before from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
    where rp.retailer_id=1 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null;
  if v_exact_before <> 40 then raise exception 'GYM HIGH exact-pack baseline is %, expected 40',v_exact_before; end if;

  for e in select * from jsonb_to_recordset(v_scope) as x(
    product_id bigint,product text,default_variant_id bigint,mapping_id bigint,offer_id bigint,
    external_product_id text,external_variant_id text,mapping_url text,offer_url text,
    variant_key text,display_name text,size_value numeric,size_unit text,pack_count integer,
    price numeric,shipping numeric,total numeric,in_stock boolean
  ) order by mapping_id loop
    if not exists(select 1 from public.products where id=e.product_id and name=e.product
        and is_active and merged_into_product_id is null for update)
       or not exists(select 1 from public.product_variants where id=e.default_variant_id
        and product_id=e.product_id and variant_key='default' and display_name='Default'
        and flavour_code is null and flavour_label is null and size_value is null
        and size_unit is null and pack_count is null and is_active and is_default for update)
       or (select count(*) from public.product_variants where product_id=e.product_id) <> 1
       or exists(select 1 from public.product_variants where product_id=e.product_id and variant_key=e.variant_key) then
      raise exception 'GYM HIGH product state mismatch for offer %',e.offer_id;
    end if;
    select to_jsonb(rp) into v_mapping_before from public.retailer_products rp
      where rp.id=e.mapping_id and rp.retailer_id=1 and rp.product_id=e.product_id
        and rp.product_variant_id=e.default_variant_id and rp.external_product_id=e.external_product_id
        and rp.external_variant_id=e.external_variant_id and rp.external_sku is null
        and rp.external_options is null and rp.external_url=e.mapping_url for update;
    select to_jsonb(o) into v_offer_before from public.offers o
      where o.id=e.offer_id and o.retailer_id=1 and o.product_id=e.product_id
        and o.product_variant_id=e.default_variant_id and o.retailer_product_id=e.mapping_id
        and o.price=e.price and o.shipping_cost=e.shipping and o.total_price=e.total
        and o.in_stock=e.in_stock and o.url=e.offer_url for update;
    if v_mapping_before is null or v_offer_before is null
       or exists(select 1 from public.price_identity_series where offer_id=e.offer_id) then
      raise exception 'GYM HIGH binding, commercial state or prior-series mismatch for offer %',e.offer_id;
    end if;
    insert into public.product_variants(
      product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,
      pack_count,product_format,gtin,image,nutrition_override,is_default,is_active
    ) values(e.product_id,e.variant_key,e.display_name,null,null,e.size_value,e.size_unit,
      e.pack_count,null,null,null,'{}'::jsonb,false,true) returning id into v_new_id;
    update public.retailer_products set product_variant_id=v_new_id
      where id=e.mapping_id and retailer_id=1 and product_variant_id=e.default_variant_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'GYM HIGH mapping move affected % rows',v_rows; end if;
    update public.offers set product_variant_id=v_new_id
      where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=e.default_variant_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'GYM HIGH offer move affected % rows',v_rows; end if;
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
      raise exception 'GYM HIGH preservation mismatch for offer %',e.offer_id;
    end if;
  end loop;
  if (select count(*) from public.products)<>v_products_before
     or (select count(*) from public.product_variants)<>v_variants_before+9
     or (select count(*) from public.retailer_products)<>v_mappings_before
     or (select count(*) from public.offers)<>v_offers_before
     or (select count(*) from public.price_history)<>v_history_before
     or (select count(*) from public.price_identity_series)<>v_series_before
     or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
         where rp.retailer_id=1 and v.pack_count is not null and v.size_value is not null
           and nullif(trim(v.size_unit),'') is not null)<>49
     or (select count(*) from public.retailer_products where retailer_id=1)<>66
     or (select count(*) from public.offers where retailer_id=1)<>66 then
    raise exception 'GYM HIGH exact-pack global postcondition mismatch';
  end if;
end
$apply$;

commit;
