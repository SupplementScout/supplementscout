begin;

set local lock_timeout='5s';
set local statement_timeout='120s';

lock table public.products,public.product_variants,public.retailer_products,
  public.offers,public.price_history,public.price_identity_series,public.outbound_clicks
in share row exclusive mode;

do $apply$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_authority constant text:='owner-chat-2026-08-26-approved-fit-house-six-source-present-conflicts';
  v_source_fingerprint constant text:='ef14011b0634d3f20053a569323eb8170defb458d28d22b1bbf700ef2416f1bb';
  v_orange_variant_id bigint;
  v_thiquid_variant_id bigint;
  v_d3k2_variant_id bigint;
  v_vitamin_c_variant_id bigint;
  v_products_before bigint;
  v_variants_before bigint;
  v_mappings_before bigint;
  v_offers_before bigint;
  v_history_before bigint;
  v_series_before bigint;
  v_clicks_before bigint;
  v_rows integer;
  v_p677_before jsonb;
  v_p973_before jsonb;
  v_p991_before jsonb;
  v_p993_before jsonb;
begin
  if current_user<>'postgres'
    or v_target->>'target_environment'<>'PRODUCTION'
    or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
    or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
    or v_authority<>'owner-chat-2026-08-26-approved-fit-house-six-source-present-conflicts'
    or v_source_fingerprint<>'ef14011b0634d3f20053a569323eb8170defb458d28d22b1bbf700ef2416f1bb' then
    raise exception 'Fit House six-conflict authority, evidence or target mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:fit-house-exact-pack:six-conflicts',0));

  if exists(select 1 from public.price_observation_producers where retailer_id=9 and enabled) then
    raise exception 'Fit House six-conflict alignment requires the observation producer to remain disabled';
  end if;
  if exists(select 1 from public.retailer_catalogue_parent_plans where retailer_id=9
      and target_environment='PRODUCTION' and status in ('PLANNED','APPROVED','PARTIALLY_APPLIED','FAILED')) then
    raise exception 'Fit House six-conflict alignment is blocked by an active control plan';
  end if;

  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;
  select count(*) into v_series_before from public.price_identity_series;
  select count(*) into v_clicks_before from public.outbound_clicks;
  if v_products_before<>1112 or v_variants_before<>2817 or v_mappings_before<>2761
    or v_offers_before<>2761 or v_history_before<>4001 or v_series_before<>503
    or (select count(*) from public.retailer_products where retailer_id=9)<>286
    or (select count(*) from public.offers where retailer_id=9)<>286
    or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
        where rp.retailer_id=9 and v.pack_count>0 and v.size_value>0 and nullif(trim(v.size_unit),'') is not null)<>254 then
    raise exception 'Fit House six-conflict baseline mismatch';
  end if;
  if exists(select 1 from public.price_identity_series where offer_id in (695,1909,1910,1913,1926,1937)) then
    raise exception 'Fit House six-conflict target already has immutable identity history';
  end if;

  select to_jsonb(p) into v_p677_before from public.products p where p.id=677
    and p.name='OstroVit Electrolytes Orange 20 Effervescent Tablets'
    and p.slug='ostrovit-electrolytes-orange-20-effervescent-tablets'
    and p.product_format='tablet' and p.serving_count_verified is null
    and p.unit_count is null and p.unit_type is null and not p.unit_pricing_verified
    and p.is_active and p.merged_into_product_id is null for update;
  select to_jsonb(p) into v_p973_before from public.products p where p.id=973
    and p.name='Kilo Labs Thiquid 25 servings' and p.slug='kilo-labs-thiquid-25-servings'
    and p.product_format='powder' and p.servings=25 and p.net_volume_ml is null
    and p.serving_size_ml is null and p.serving_count_verified is null
    and p.unit_count is null and p.unit_type is null and not p.unit_pricing_verified
    and p.is_active and p.merged_into_product_id is null for update;
  select to_jsonb(p) into v_p991_before from public.products p where p.id=991
    and p.name='Osavi Liposomal Vitamin C 100mg 60 Capsules'
    and p.slug='osavi-liposomal-vitamin-c-100mg-60-capsules'
    and p.product_format='capsule' and p.serving_count_verified is null
    and p.unit_count is null and p.unit_type is null and not p.unit_pricing_verified
    and p.is_active and p.merged_into_product_id is null for update;
  select to_jsonb(p) into v_p993_before from public.products p where p.id=993
    and p.name='Osavi Vitamin D3 + K2, 2000 IU + 100 μg 60 Capsules'
    and p.slug='osavi-vitamin-d3-k2-2000-iu-100-g-60-capsules'
    and p.product_format='capsule' and p.serving_count_verified is null
    and p.unit_count is null and p.unit_type is null and not p.unit_pricing_verified
    and p.is_active and p.merged_into_product_id is null for update;
  if v_p677_before is null or v_p973_before is null or v_p991_before is null or v_p993_before is null then
    raise exception 'Fit House six-conflict canonical product precondition mismatch';
  end if;

  if not exists(select 1 from public.product_variants where id=506 and product_id=677
      and variant_key='default' and display_name='Default' and flavour_code is null and flavour_label is null
      and size_value is null and size_unit is null and pack_count is null and product_format is null
      and is_active and is_default for update)
    or not exists(select 1 from public.product_variants where id=1902 and product_id=973
      and variant_key='default' and display_name='Default' and size_value is null and size_unit is null
      and pack_count is null and product_format is null and is_active and is_default for update)
    or not exists(select 1 from public.product_variants where id=1944 and product_id=991
      and variant_key='default' and display_name='Default' and size_value is null and size_unit is null
      and pack_count is null and product_format is null and is_active and is_default for update)
    or not exists(select 1 from public.product_variants where id=1946 and product_id=993
      and variant_key='default' and display_name='Default' and size_value is null and size_unit is null
      and pack_count is null and product_format is null and is_active and is_default for update)
    or not exists(select 1 from public.product_variants where id=1893 and product_id=969
      and variant_key='jelly-bean' and flavour_label='Jelly Bean' and size_value is null and size_unit is null
      and pack_count=1 and product_format='powder' and is_active and not is_default for update)
    or not exists(select 1 from public.product_variants where id=1892 and product_id=969
      and variant_key='iced-blue-slush' and flavour_label='Iced Blue Slush' and size_value is null and size_unit is null
      and pack_count=1 and product_format='powder' and is_active and not is_default for update)
    or not exists(select 1 from public.product_variants where id=2649 and product_id=62
      and variant_key='lemon-fizz-bombs-420g' and flavour_code='lemon-fizz-bombs'
      and flavour_label='Lemon Fizz Bombs' and size_value=420 and size_unit='g' and pack_count=1
      and product_format='powder' and is_active and not is_default for update)
    or not exists(select 1 from public.product_variants where id=2646 and product_id=62
      and variant_key='fizzy-bubblegum-bottles-420g' and flavour_code='fizzy-bubblegum-bottles'
      and flavour_label='Fizzy Bubblegum Bottles' and size_value=420 and size_unit='g' and pack_count=1
      and product_format='powder' and is_active and not is_default for update) then
    raise exception 'Fit House six-conflict source or target variant precondition mismatch';
  end if;
  if exists(select 1 from public.product_variants where (product_id=677 and variant_key='orange-20-servings')
      or (product_id=973 and variant_key='1000ml') or (product_id=991 and variant_key='30-servings')
      or (product_id=993 and variant_key='60-servings')) then
    raise exception 'Fit House six-conflict target variant already exists';
  end if;

  if not exists(select 1 from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id
      where rp.id=687 and rp.retailer_id=9 and rp.product_id=677 and rp.product_variant_id=506
        and rp.external_product_id='10019820470512' and rp.external_variant_id='49715305840880'
        and rp.external_options is null and rp.external_url='https://fithouse.uk/products/ostrovit-electrolytes-20-effervescent-tablets?variant=49715305840880'
        and o.id=695 and o.product_id=677 and o.product_variant_id=506 and o.price=3.99
        and o.shipping_cost=3.99 and o.total_price=7.98 and o.in_stock and o.url=rp.external_url for update of rp,o)
    or not exists(select 1 from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id
      where rp.id=2095 and rp.retailer_id=9 and rp.product_id=969 and rp.product_variant_id=1893
        and rp.external_product_id='8334867103984' and rp.external_variant_id='44267408589040'
        and rp.external_options='{"flavour":"Jelly Bean"}'::jsonb
        and rp.external_url='https://fithouse.uk/products/hr-labs-defib-v3-40-20-servings?variant=44267408589040'
        and o.id=1909 and o.product_id=969 and o.product_variant_id=1893 and o.price=34.99
        and o.shipping_cost=3.99 and o.total_price=38.98 and o.in_stock and o.url=rp.external_url for update of rp,o)
    or not exists(select 1 from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id
      where rp.id=2096 and rp.retailer_id=9 and rp.product_id=969 and rp.product_variant_id=1892
        and rp.external_product_id='8334867103984' and rp.external_variant_id='44267408851184'
        and rp.external_options='{"flavour":"Iced Blue Slush"}'::jsonb
        and rp.external_url='https://fithouse.uk/products/hr-labs-defib-v3-40-20-servings?variant=44267408851184'
        and o.id=1910 and o.product_id=969 and o.product_variant_id=1892 and o.price=34.99
        and o.shipping_cost=3.99 and o.total_price=38.98 and o.in_stock and o.url=rp.external_url for update of rp,o)
    or not exists(select 1 from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id
      where rp.id=2099 and rp.retailer_id=9 and rp.product_id=973 and rp.product_variant_id=1902
        and rp.external_product_id='8472175935728' and rp.external_variant_id='44962322710768'
        and coalesce(rp.external_options,'{}'::jsonb)='{}'::jsonb
        and rp.external_url='https://fithouse.uk/products/kilo-labs-thiquid-25-servings?variant=44962322710768'
        and o.id=1913 and o.product_id=973 and o.product_variant_id=1902 and o.price=39.99
        and o.shipping_cost=3.99 and o.total_price=43.98 and o.in_stock and o.url=rp.external_url for update of rp,o)
    or not exists(select 1 from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id
      where rp.id=2112 and rp.retailer_id=9 and rp.product_id=993 and rp.product_variant_id=1946
        and rp.external_product_id='8685915111664' and rp.external_variant_id='45768723693808'
        and coalesce(rp.external_options,'{}'::jsonb)='{}'::jsonb
        and rp.external_url='https://fithouse.uk/products/osavi-vitamin-d3-k2-2000-iu-100-%CE%BCg-120-caps?variant=45768723693808'
        and o.id=1926 and o.product_id=993 and o.product_variant_id=1946 and o.price=9.99
        and o.shipping_cost=3.99 and o.total_price=13.98 and o.in_stock and o.url=rp.external_url for update of rp,o)
    or not exists(select 1 from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id
      where rp.id=2123 and rp.retailer_id=9 and rp.product_id=991 and rp.product_variant_id=1944
        and rp.external_product_id='9048878940400' and rp.external_variant_id='46640043753712'
        and coalesce(rp.external_options,'{}'::jsonb)='{}'::jsonb
        and rp.external_url='https://fithouse.uk/products/osavi-liposomal-vitamin-c-100mg-60-vege-caps?variant=46640043753712'
        and o.id=1937 and o.product_id=991 and o.product_variant_id=1944 and o.price=14.99
        and o.shipping_cost=3.99 and o.total_price=18.98 and o.in_stock and o.url=rp.external_url for update of rp,o) then
    raise exception 'Fit House six-conflict mapping, offer or commercial precondition mismatch';
  end if;

  insert into public.product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active)
  values(677,'orange-20-servings','Orange / 20 Servings','orange','Orange',20,'servings',1,'tablet',null,null,'{}'::jsonb,false,true)
  returning id into v_orange_variant_id;
  insert into public.product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active)
  values(973,'1000ml','1000ml',null,null,1000,'ml',1,'liquid',null,null,'{}'::jsonb,false,true)
  returning id into v_thiquid_variant_id;
  insert into public.product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active)
  values(993,'60-servings','60 Servings',null,null,60,'servings',1,'softgel',null,null,'{}'::jsonb,false,true)
  returning id into v_d3k2_variant_id;
  insert into public.product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active)
  values(991,'30-servings','30 Servings',null,null,30,'servings',1,'capsule',null,null,'{}'::jsonb,false,true)
  returning id into v_vitamin_c_variant_id;

  update public.products set serving_count_verified=20,unit_count=20,unit_type='tablet',unit_pricing_verified=true where id=677;
  update public.products set product_format='liquid',net_volume_ml=1000,serving_size_ml=40,
    serving_count_verified=25,unit_pricing_verified=true where id=973;
  update public.products set name='Osavi Liposomal Vitamin C 1000mg 60 Capsules',serving_count_verified=30,
    unit_count=60,unit_type='capsule',unit_pricing_verified=true where id=991;
  update public.products set name='Osavi Vitamin D3 + K2, 2000 IU + 100 μg 60 Softgels',product_format='softgel',
    serving_count_verified=60 where id=993;

  update public.retailer_products set product_variant_id=v_orange_variant_id where id=687 and product_variant_id=506;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House Orange mapping move affected % rows',v_rows; end if;
  update public.offers set product_variant_id=v_orange_variant_id where id=695 and retailer_product_id=687 and product_variant_id=506;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House Orange offer move affected % rows',v_rows; end if;

  update public.retailer_products set product_id=62,product_variant_id=2649,
    external_options='{"flavour":"Lemon Fizz Bombs"}'::jsonb where id=2095 and product_id=969 and product_variant_id=1893;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House Lemon DEFIB mapping move affected % rows',v_rows; end if;
  update public.offers set product_id=62,product_variant_id=2649 where id=1909 and retailer_product_id=2095 and product_id=969 and product_variant_id=1893;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House Lemon DEFIB offer move affected % rows',v_rows; end if;
  update public.outbound_clicks set product_id=62 where offer_id=1909 and product_id=969;

  update public.retailer_products set product_id=62,product_variant_id=2646,
    external_options='{"flavour":"Fizzy Bubblegum Bottle"}'::jsonb where id=2096 and product_id=969 and product_variant_id=1892;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House Bubblegum DEFIB mapping move affected % rows',v_rows; end if;
  update public.offers set product_id=62,product_variant_id=2646 where id=1910 and retailer_product_id=2096 and product_id=969 and product_variant_id=1892;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House Bubblegum DEFIB offer move affected % rows',v_rows; end if;
  update public.outbound_clicks set product_id=62 where offer_id=1910 and product_id=969;

  update public.retailer_products set product_variant_id=v_thiquid_variant_id where id=2099 and product_variant_id=1902;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House Thiquid mapping move affected % rows',v_rows; end if;
  update public.offers set product_variant_id=v_thiquid_variant_id where id=1913 and retailer_product_id=2099 and product_variant_id=1902;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House Thiquid offer move affected % rows',v_rows; end if;
  update public.retailer_products set product_variant_id=v_d3k2_variant_id where id=2112 and product_variant_id=1946;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House D3 K2 mapping move affected % rows',v_rows; end if;
  update public.offers set product_variant_id=v_d3k2_variant_id where id=1926 and retailer_product_id=2112 and product_variant_id=1946;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House D3 K2 offer move affected % rows',v_rows; end if;
  update public.retailer_products set product_variant_id=v_vitamin_c_variant_id where id=2123 and product_variant_id=1944;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House Vitamin C mapping move affected % rows',v_rows; end if;
  update public.offers set product_variant_id=v_vitamin_c_variant_id where id=1937 and retailer_product_id=2123 and product_variant_id=1944;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House Vitamin C offer move affected % rows',v_rows; end if;

  if (select count(*) from public.products)<>v_products_before
    or (select count(*) from public.product_variants)<>v_variants_before+4
    or (select count(*) from public.retailer_products)<>v_mappings_before
    or (select count(*) from public.offers)<>v_offers_before
    or (select count(*) from public.price_history)<>v_history_before
    or (select count(*) from public.price_identity_series)<>v_series_before
    or (select count(*) from public.outbound_clicks)<>v_clicks_before
    or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
        where rp.retailer_id=9 and v.pack_count>0 and v.size_value>0 and nullif(trim(v.size_unit),'') is not null)<>260 then
    raise exception 'Fit House six-conflict postcondition count mismatch';
  end if;
  if (to_jsonb((select p from public.products p where id=677))-array['serving_count_verified','unit_count','unit_type','unit_pricing_verified'])
       is distinct from (v_p677_before-array['serving_count_verified','unit_count','unit_type','unit_pricing_verified'])
    or (to_jsonb((select p from public.products p where id=973))-array['product_format','net_volume_ml','serving_size_ml','serving_count_verified','unit_pricing_verified'])
       is distinct from (v_p973_before-array['product_format','net_volume_ml','serving_size_ml','serving_count_verified','unit_pricing_verified'])
    or (to_jsonb((select p from public.products p where id=991))-array['name','serving_count_verified','unit_count','unit_type','unit_pricing_verified'])
       is distinct from (v_p991_before-array['name','serving_count_verified','unit_count','unit_type','unit_pricing_verified'])
    or (to_jsonb((select p from public.products p where id=993))-array['name','product_format','serving_count_verified'])
       is distinct from (v_p993_before-array['name','product_format','serving_count_verified']) then
    raise exception 'Fit House six-conflict product preservation mismatch';
  end if;
  if not exists(select 1 from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id
      where rp.id=687 and rp.product_id=677 and rp.product_variant_id=v_orange_variant_id and o.id=695 and o.product_id=677 and o.product_variant_id=v_orange_variant_id)
    or not exists(select 1 from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id
      where rp.id=2095 and rp.product_id=62 and rp.product_variant_id=2649 and rp.external_options='{"flavour":"Lemon Fizz Bombs"}'::jsonb
        and o.id=1909 and o.product_id=62 and o.product_variant_id=2649)
    or not exists(select 1 from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id
      where rp.id=2096 and rp.product_id=62 and rp.product_variant_id=2646 and rp.external_options='{"flavour":"Fizzy Bubblegum Bottle"}'::jsonb
        and o.id=1910 and o.product_id=62 and o.product_variant_id=2646)
    or not exists(select 1 from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id
      where rp.id=2099 and rp.product_id=973 and rp.product_variant_id=v_thiquid_variant_id and o.id=1913 and o.product_variant_id=v_thiquid_variant_id)
    or not exists(select 1 from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id
      where rp.id=2112 and rp.product_id=993 and rp.product_variant_id=v_d3k2_variant_id and o.id=1926 and o.product_variant_id=v_d3k2_variant_id)
    or not exists(select 1 from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id
      where rp.id=2123 and rp.product_id=991 and rp.product_variant_id=v_vitamin_c_variant_id and o.id=1937 and o.product_variant_id=v_vitamin_c_variant_id)
    or exists(select 1 from public.outbound_clicks where offer_id in (1909,1910) and product_id<>62) then
    raise exception 'Fit House six-conflict identity binding postcondition mismatch';
  end if;
end $apply$;

commit;
