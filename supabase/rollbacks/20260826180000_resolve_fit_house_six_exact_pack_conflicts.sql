begin;

set local lock_timeout='5s';
set local statement_timeout='120s';

lock table public.products,public.product_variants,public.retailer_products,
  public.offers,public.price_history,public.price_identity_series,public.outbound_clicks
in share row exclusive mode;

do $rollback$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_orange_variant_id bigint;
  v_thiquid_variant_id bigint;
  v_d3k2_variant_id bigint;
  v_vitamin_c_variant_id bigint;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
    or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
    or not exists(select 1 from supabase_migrations.schema_migrations
      where version='20260826180000' and name='resolve_fit_house_six_exact_pack_conflicts') then
    raise exception 'Fit House six-conflict rollback target or ledger mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:fit-house-exact-pack:six-conflicts',0));
  if exists(select 1 from public.price_identity_series where offer_id in (695,1909,1910,1913,1926,1937)) then
    raise exception 'Fit House six-conflict rollback is forbidden after identity-proven accrual';
  end if;
  select id into v_orange_variant_id from public.product_variants where product_id=677 and variant_key='orange-20-servings'
    and flavour_label='Orange' and size_value=20 and size_unit='servings' and pack_count=1 and product_format='tablet';
  select id into v_thiquid_variant_id from public.product_variants where product_id=973 and variant_key='1000ml'
    and size_value=1000 and size_unit='ml' and pack_count=1 and product_format='liquid';
  select id into v_d3k2_variant_id from public.product_variants where product_id=993 and variant_key='60-servings'
    and size_value=60 and size_unit='servings' and pack_count=1 and product_format='softgel';
  select id into v_vitamin_c_variant_id from public.product_variants where product_id=991 and variant_key='30-servings'
    and size_value=30 and size_unit='servings' and pack_count=1 and product_format='capsule';
  if v_orange_variant_id is null or v_thiquid_variant_id is null or v_d3k2_variant_id is null or v_vitamin_c_variant_id is null then
    raise exception 'Fit House six-conflict rollback variant precondition mismatch';
  end if;

  update public.retailer_products set product_variant_id=506 where id=687 and product_id=677 and product_variant_id=v_orange_variant_id;
  update public.offers set product_variant_id=506 where id=695 and retailer_product_id=687 and product_variant_id=v_orange_variant_id;
  update public.retailer_products set product_id=969,product_variant_id=1893,external_options='{"flavour":"Jelly Bean"}'::jsonb
    where id=2095 and product_id=62 and product_variant_id=2649;
  update public.offers set product_id=969,product_variant_id=1893 where id=1909 and retailer_product_id=2095 and product_id=62 and product_variant_id=2649;
  update public.outbound_clicks set product_id=969 where offer_id=1909 and product_id=62;
  update public.retailer_products set product_id=969,product_variant_id=1892,external_options='{"flavour":"Iced Blue Slush"}'::jsonb
    where id=2096 and product_id=62 and product_variant_id=2646;
  update public.offers set product_id=969,product_variant_id=1892 where id=1910 and retailer_product_id=2096 and product_id=62 and product_variant_id=2646;
  update public.outbound_clicks set product_id=969 where offer_id=1910 and product_id=62;
  update public.retailer_products set product_variant_id=1902 where id=2099 and product_id=973 and product_variant_id=v_thiquid_variant_id;
  update public.offers set product_variant_id=1902 where id=1913 and retailer_product_id=2099 and product_variant_id=v_thiquid_variant_id;
  update public.retailer_products set product_variant_id=1946 where id=2112 and product_id=993 and product_variant_id=v_d3k2_variant_id;
  update public.offers set product_variant_id=1946 where id=1926 and retailer_product_id=2112 and product_variant_id=v_d3k2_variant_id;
  update public.retailer_products set product_variant_id=1944 where id=2123 and product_id=991 and product_variant_id=v_vitamin_c_variant_id;
  update public.offers set product_variant_id=1944 where id=1937 and retailer_product_id=2123 and product_variant_id=v_vitamin_c_variant_id;

  update public.products set serving_count_verified=null,unit_count=null,unit_type=null,unit_pricing_verified=false where id=677;
  update public.products set product_format='powder',net_volume_ml=null,serving_size_ml=null,
    serving_count_verified=null,unit_pricing_verified=false where id=973;
  update public.products set name='Osavi Liposomal Vitamin C 100mg 60 Capsules',serving_count_verified=null,
    unit_count=null,unit_type=null,unit_pricing_verified=false where id=991;
  update public.products set name='Osavi Vitamin D3 + K2, 2000 IU + 100 μg 60 Capsules',product_format='capsule',
    serving_count_verified=null where id=993;

  delete from public.product_variants where id in (v_orange_variant_id,v_thiquid_variant_id,v_d3k2_variant_id,v_vitamin_c_variant_id);
  if (select count(*) from public.product_variants)<>2817
    or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
        where rp.retailer_id=9 and v.pack_count>0 and v.size_value>0 and nullif(trim(v.size_unit),'') is not null)<>254
    or not exists(select 1 from public.retailer_products where id=2095 and product_id=969 and product_variant_id=1893)
    or not exists(select 1 from public.retailer_products where id=2096 and product_id=969 and product_variant_id=1892)
    or exists(select 1 from public.outbound_clicks where offer_id in (1909,1910) and product_id<>969) then
    raise exception 'Fit House six-conflict rollback postcondition mismatch';
  end if;
end $rollback$;

commit;
