begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $apply$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_manifest_sha256 constant text := '55db2b2cd77e919821cb1f224f5d793035385b2db7e1c9f98727e9f65e4b53e3';
  v_semantic_sha256 constant text := '631febae59f3d2516066d3be627ddc176c6de62d5e9245c05904e80f5819fab6';
  v_scope constant jsonb := '[{"product_id":792,"product":"Strom Sports Creatine HCL - 80 Servings","default_variant_id":1139,"mapping_id":1253,"offer_id":1067,"external_product_id":"10135809720658","external_variant_id":"51000436326738","external_sku":"STM45001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/strom-sports-creatine-hcl-80-servings?variant=51000436326738","offer_url":"https://jonssupplements.co.uk/products/strom-sports-creatine-hcl-80-servings?variant=51000436326738","variant_key":"80-servings","display_name":"80 Servings","size_value":80,"size_unit":"servings","price":19.99,"shipping":3.99,"total":23.98,"in_stock":true},{"product_id":803,"product":"Per4m Krill Oil Softgels 120 Capsules","default_variant_id":1150,"mapping_id":1264,"offer_id":1078,"external_product_id":"10692814438738","external_variant_id":"53092453548370","external_sku":"PFM49001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/per4m-krill-oil-softgels-120-capsules?variant=53092453548370","offer_url":"https://jonssupplements.co.uk/products/per4m-krill-oil-softgels-120-capsules?variant=53092453548370","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","price":17.99,"shipping":3.99,"total":21.98,"in_stock":true},{"product_id":804,"product":"Per4m NMN 60 Capsules 1000mg","default_variant_id":1151,"mapping_id":1265,"offer_id":1079,"external_product_id":"10913227964754","external_variant_id":"53896125317458","external_sku":"PFNNMN001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/per4m-nmn-60-capsules-1000mg?variant=53896125317458","offer_url":"https://jonssupplements.co.uk/products/per4m-nmn-60-capsules-1000mg?variant=53896125317458","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","price":29.49,"shipping":3.99,"total":33.48,"in_stock":false},{"product_id":805,"product":"Per4m Vitamin C 60 Capsules","default_variant_id":1152,"mapping_id":1266,"offer_id":1080,"external_product_id":"10913496858962","external_variant_id":"53896547369298","external_sku":"PFVITC002","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/per4m-vitamin-c-60-capsules?variant=53896547369298","offer_url":"https://jonssupplements.co.uk/products/per4m-vitamin-c-60-capsules?variant=53896547369298","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","price":9.49,"shipping":3.99,"total":13.48,"in_stock":true},{"product_id":806,"product":"Per4m Zinc & Magnesium 120 Capsules","default_variant_id":1153,"mapping_id":1267,"offer_id":1081,"external_product_id":"10913242218834","external_variant_id":"53896170176850","external_sku":"PFNZMA001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/per4m-zinc-magnesium-120-capsules?variant=53896170176850","offer_url":"https://jonssupplements.co.uk/products/per4m-zinc-magnesium-120-capsules?variant=53896170176850","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","price":13.49,"shipping":3.99,"total":17.48,"in_stock":true},{"product_id":814,"product":"Trained By JP Oh Mega V Omega 180 Capsules 60 servings","default_variant_id":1161,"mapping_id":1275,"offer_id":1089,"external_product_id":"10114488336722","external_variant_id":"50926983577938","external_sku":"TBJ23001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-oh-mega-v-omega-3-6-9-180-capsules?variant=50926983577938","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-oh-mega-v-omega-3-6-9-180-capsules?variant=50926983577938","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","price":15.99,"shipping":3.99,"total":19.98,"in_stock":true},{"product_id":830,"product":"Strom SupportMax OCS 120 Caps","default_variant_id":1177,"mapping_id":1291,"offer_id":1105,"external_product_id":"10121076703570","external_variant_id":"50944967508306","external_sku":"STM18001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/strom-support-max-ocs-120-caps?variant=50944967508306","offer_url":"https://jonssupplements.co.uk/products/strom-support-max-ocs-120-caps?variant=50944967508306","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","price":38.49,"shipping":3.99,"total":42.48,"in_stock":true},{"product_id":891,"product":"Conteh Sports Pre Shred 90 Caps","default_variant_id":1469,"mapping_id":1583,"offer_id":1397,"external_product_id":"10716174745938","external_variant_id":"53185879605586","external_sku":"CTH05001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/conteh-sports-pre-shred-90-caps?variant=53185879605586","offer_url":"https://jonssupplements.co.uk/products/conteh-sports-pre-shred-90-caps?variant=53185879605586","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","price":24.99,"shipping":3.99,"total":28.98,"in_stock":true},{"product_id":906,"product":"Strom Sports Tri-Mag 90 Capsules","default_variant_id":1507,"mapping_id":1621,"offer_id":1435,"external_product_id":"10581132607826","external_variant_id":"52669571334482","external_sku":"STM53001","external_options":{"Title":"Default Title"},"mapping_url":"https://jonssupplements.co.uk/products/strom-sports-tri-mag-90-servings?variant=52669571334482","offer_url":"https://jonssupplements.co.uk/products/strom-sports-tri-mag-90-servings?variant=52669571334482","variant_key":"90-servings","display_name":"90 Servings","size_value":90,"size_unit":"servings","price":20.99,"shipping":3.99,"total":24.98,"in_stock":true},{"product_id":923,"product":"Conteh Sports Flax Seed Oil 60 Servings","default_variant_id":1527,"mapping_id":1641,"offer_id":1455,"external_product_id":"10593816707410","external_variant_id":"52718578401618","external_sku":null,"external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/conteh-sports-flax-seed-oil-60-servings?variant=52718578401618","offer_url":"https://jonssupplements.co.uk/products/conteh-sports-flax-seed-oil-60-servings?variant=52718578401618","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","price":9.99,"shipping":3.99,"total":13.98,"in_stock":true}]'::jsonb;
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
    raise exception 'Jon''s ready servings batch 1 evidence or target mismatch';
  end if;
  if jsonb_array_length(v_scope) <> 10
     or (select count(distinct (x->>'product_id')::bigint) from jsonb_array_elements(v_scope) x) <> 10
     or (select count(distinct (x->>'mapping_id')::bigint) from jsonb_array_elements(v_scope) x) <> 10
     or (select count(distinct (x->>'offer_id')::bigint) from jsonb_array_elements(v_scope) x) <> 10
     or exists(select 1 from jsonb_array_elements(v_scope) x where x->>'size_unit'<>'servings') then
    raise exception 'Jon''s ready servings batch 1 scope mismatch';
  end if;
  if (select count(distinct offer_id) from public.price_identity_series
      where offer_id in (1070,1072,1073,1076,1077)) <> 5
     or (select count(distinct s.offer_id) from public.price_identity_series s
         join public.price_history ph on ph.identity_series_id=s.id
         where s.offer_id in (1070,1072,1073,1076,1077)
           and ph.observation_kind='daily_confirmation') <> 5 then
    raise exception 'Jon''s exact-pack canary producer confirmation is incomplete';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('supplementscout:jons-exact-pack-ready-servings-10',0));
  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;
  select count(*) into v_series_before from public.price_identity_series;
  select count(*) into v_exact_before
  from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
  where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null
    and nullif(trim(v.size_unit),'') is not null;
  if v_exact_before<>423 then raise exception 'Jon''s exact-pack baseline is %, expected 423',v_exact_before; end if;

  for e in select * from jsonb_to_recordset(v_scope) as x(
    product_id bigint,product text,default_variant_id bigint,mapping_id bigint,offer_id bigint,
    external_product_id text,external_variant_id text,external_sku text,external_options jsonb,
    mapping_url text,offer_url text,variant_key text,display_name text,size_value numeric,
    size_unit text,price numeric,shipping numeric,total numeric,in_stock boolean
  ) order by mapping_id loop
    if not exists(select 1 from public.products where id=e.product_id and name=e.product
        and is_active and merged_into_product_id is null for update)
       or not exists(select 1 from public.product_variants where id=e.default_variant_id
        and product_id=e.product_id and variant_key='default' and display_name='Default'
        and flavour_code is null and flavour_label is null and size_value is null
        and size_unit is null and pack_count is null and is_active and is_default for update)
       or (select count(*) from public.product_variants where product_id=e.product_id)<>1
       or exists(select 1 from public.product_variants where product_id=e.product_id
          and variant_key=e.variant_key) then
      raise exception 'Jon''s ready servings product state mismatch for offer %',e.offer_id;
    end if;
    select to_jsonb(rp) into v_mapping_before from public.retailer_products rp
    where rp.id=e.mapping_id and rp.retailer_id=10 and rp.product_id=e.product_id
      and rp.product_variant_id=e.default_variant_id
      and rp.external_product_id=e.external_product_id and rp.external_variant_id=e.external_variant_id
      and rp.external_sku is not distinct from e.external_sku
      and coalesce(rp.external_options,'{}'::jsonb)=coalesce(e.external_options,'{}'::jsonb)
      and rp.external_url=e.mapping_url for update;
    select to_jsonb(o) into v_offer_before from public.offers o
    where o.id=e.offer_id and o.retailer_id=10 and o.product_id=e.product_id
      and o.product_variant_id=e.default_variant_id and o.retailer_product_id=e.mapping_id
      and o.price=e.price and o.shipping_cost=e.shipping and o.total_price=e.total
      and o.in_stock=e.in_stock and o.url=e.offer_url for update;
    if v_mapping_before is null or v_offer_before is null
       or (select count(*) from public.retailer_products where product_variant_id=e.default_variant_id)<>1
       or (select count(*) from public.offers where product_variant_id=e.default_variant_id)<>1
       or exists(select 1 from public.price_identity_series where offer_id=e.offer_id) then
      raise exception 'Jon''s ready servings binding or prior-series mismatch for offer %',e.offer_id;
    end if;
    insert into public.product_variants(
      product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,
      pack_count,product_format,gtin,image,nutrition_override,is_default,is_active
    ) values(e.product_id,e.variant_key,e.display_name,null,null,e.size_value,e.size_unit,
      1,null,null,null,'{}'::jsonb,false,true) returning id into v_new_id;
    update public.retailer_products set product_variant_id=v_new_id
      where id=e.mapping_id and retailer_id=10 and product_variant_id=e.default_variant_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s ready servings mapping move affected % rows',v_rows; end if;
    update public.offers set product_variant_id=v_new_id
      where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=e.default_variant_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s ready servings offer move affected % rows',v_rows; end if;
    if not exists(select 1 from public.product_variants v
      join public.retailer_products rp on rp.product_variant_id=v.id
      join public.offers o on o.product_variant_id=v.id and o.retailer_product_id=rp.id
      where v.id=v_new_id and v.product_id=e.product_id and v.variant_key=e.variant_key
        and v.display_name=e.display_name and v.flavour_code is null and v.flavour_label is null
        and v.size_value=e.size_value and v.size_unit=e.size_unit and v.pack_count=1
        and v.product_format is null and v.gtin is null and v.image is null
        and v.nutrition_override='{}'::jsonb and v.is_active and not v.is_default
        and rp.id=e.mapping_id and o.id=e.offer_id
        and (to_jsonb(rp)-'product_variant_id')=(v_mapping_before-'product_variant_id')
        and (to_jsonb(o)-'product_variant_id')=(v_offer_before-'product_variant_id')) then
      raise exception 'Jon''s ready servings preservation mismatch for offer %',e.offer_id;
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
    raise exception 'Jon''s ready servings batch 1 global postcondition mismatch';
  end if;
end
$apply$;

commit;
