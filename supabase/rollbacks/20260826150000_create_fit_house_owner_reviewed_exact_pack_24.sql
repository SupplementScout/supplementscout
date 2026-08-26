begin;
set local lock_timeout='5s'; set local statement_timeout='120s';
do $rollback$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_scope constant jsonb:='[["create",716,595,797,735,60],["create",721,600,802,740,30],["create",765,925,1124,938,100],["create",952,1854,2058,1872,120],["create",962,1881,2062,1876,60],["create",956,1863,2069,1883,44],["create",982,1922,2075,1889,60],["create",981,1921,2076,1890,60],["create",521,488,2083,1897,30],["enrich",980,1919,2100,1914,25],["enrich",980,1920,2101,1915,25],["create",983,1923,2104,1918,60],["create",963,1882,2114,1928,120],["create",184,211,2115,1929,30],["create",371,311,2118,1932,30],["create",1001,1962,2120,1934,120],["create",975,1904,2121,1935,60],["create",974,1903,2122,1936,30],["create",985,1935,2125,1939,90],["create",992,1945,2126,1940,180],["create",523,503,2131,1945,60],["create",970,1894,2132,1946,60],["create",996,1957,2152,1966,30],["create",987,1939,2161,1975,250]]'::jsonb;
  e record; v_target_variant_id bigint; v_rows integer; v_variants_before bigint; v_history_before bigint; v_series_before bigint;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION' or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
    or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
    or not exists(select 1 from supabase_migrations.schema_migrations where version='20260826150000' and name='create_fit_house_owner_reviewed_exact_pack_24')
    or jsonb_array_length(v_scope)<>24 then raise exception 'Fit House owner-reviewed exact-pack 24 rollback target, ledger or scope mismatch'; end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:fit-house-exact-pack:owner-reviewed-24',0));
  select count(*) into v_variants_before from public.product_variants; select count(*) into v_history_before from public.price_history; select count(*) into v_series_before from public.price_identity_series;
  for e in select x->>0 mode,(x->>1)::bigint product_id,(x->>2)::bigint from_variant_id,(x->>3)::bigint mapping_id,(x->>4)::bigint offer_id,(x->>5)::numeric size_value from jsonb_array_elements(v_scope) x order by (x->>3)::bigint loop
    if exists(select 1 from public.price_identity_series where offer_id=e.offer_id) then raise exception 'Fit House rollback prior-series mismatch for mapping %',e.mapping_id; end if;
    if e.mode='create' then
      select id into v_target_variant_id from public.product_variants where product_id=e.product_id and variant_key=e.size_value::text||'-servings' and display_name=e.size_value::text||' Servings' and size_value=e.size_value and size_unit='servings' and pack_count=1 and is_active and not is_default for update;
      if v_target_variant_id is null or not exists(select 1 from public.product_variants where id=e.from_variant_id and product_id=e.product_id and variant_key='default' and size_value is null and size_unit is null and pack_count is null and is_active and is_default)
        or not exists(select 1 from public.retailer_products where id=e.mapping_id and retailer_id=9 and product_id=e.product_id and product_variant_id=v_target_variant_id)
        or not exists(select 1 from public.offers where id=e.offer_id and retailer_id=9 and retailer_product_id=e.mapping_id and product_variant_id=v_target_variant_id) then raise exception 'Fit House create rollback guard mismatch for mapping %',e.mapping_id; end if;
      update public.retailer_products set product_variant_id=e.from_variant_id where id=e.mapping_id and retailer_id=9 and product_variant_id=v_target_variant_id;
      get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House mapping rollback affected % rows',v_rows; end if;
      update public.offers set product_variant_id=e.from_variant_id where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=v_target_variant_id;
      get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House offer rollback affected % rows',v_rows; end if;
      if (select count(*) from public.retailer_products where product_variant_id=v_target_variant_id)<>0 or (select count(*) from public.offers where product_variant_id=v_target_variant_id)<>0 then raise exception 'Fit House created variant still referenced for mapping %',e.mapping_id; end if;
      delete from public.product_variants where id=v_target_variant_id; get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House variant rollback affected % rows',v_rows; end if;
    elsif e.mode='enrich' then
      if not exists(select 1 from public.product_variants where id=e.from_variant_id and product_id=e.product_id and size_value=e.size_value and size_unit='servings' and pack_count=1 and is_active and not is_default for update)
        or not exists(select 1 from public.retailer_products where id=e.mapping_id and retailer_id=9 and product_variant_id=e.from_variant_id)
        or not exists(select 1 from public.offers where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=e.from_variant_id) then raise exception 'Fit House enrich rollback guard mismatch for mapping %',e.mapping_id; end if;
      update public.product_variants set size_value=null,size_unit=null where id=e.from_variant_id and size_value=e.size_value and size_unit='servings' and pack_count=1;
      get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House enrichment rollback affected % rows',v_rows; end if;
    else raise exception 'Fit House unsupported rollback mode for mapping %',e.mapping_id; end if;
  end loop;
  if (select count(*) from public.product_variants)<>v_variants_before-22 or (select count(*) from public.price_history)<>v_history_before or (select count(*) from public.price_identity_series)<>v_series_before
    or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id where rp.retailer_id=9 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null)<>219 then raise exception 'Fit House owner-reviewed exact-pack 24 rollback postcondition mismatch'; end if;
end $rollback$;
commit;
