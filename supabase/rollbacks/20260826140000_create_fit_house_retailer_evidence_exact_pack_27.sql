begin;
set local lock_timeout='5s'; set local statement_timeout='120s';
do $rollback$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_scope constant jsonb:='[
    [672,505,682,690,90],[675,534,685,693,60],[682,543,702,700,90],[684,545,704,702,60],[685,546,705,703,30],[686,547,706,704,60],[687,548,707,705,120],[691,557,711,709,60],[692,558,712,710,60],
    [693,561,735,711,90],[697,570,740,716,60],[699,573,742,718,100],[701,577,744,720,100],[702,578,745,721,90],[703,579,746,722,180],[707,583,750,726,50],[708,584,789,727,60],
    [712,590,793,731,60],[713,592,794,732,90],[714,593,795,733,120],[717,596,798,736,60],[722,601,855,741,180],[723,608,856,742,60],[728,604,861,747,90],[729,610,862,748,100],
    [730,619,863,749,60],[735,613,868,754,120]
  ]'::jsonb;
  e record; v_target_variant_id bigint; v_rows integer; v_variants_before bigint; v_history_before bigint; v_series_before bigint;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION' or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
    or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
    or not exists(select 1 from supabase_migrations.schema_migrations where version='20260826140000' and name='create_fit_house_retailer_evidence_exact_pack_27')
    or jsonb_array_length(v_scope)<>27 then raise exception 'Fit House retailer-evidence rollback 27 target, ledger or scope mismatch'; end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:fit-house-exact-pack:retailer-evidence-27',0));
  select count(*) into v_variants_before from public.product_variants; select count(*) into v_history_before from public.price_history; select count(*) into v_series_before from public.price_identity_series;
  for e in select (x->>0)::bigint product_id,(x->>1)::bigint default_variant_id,(x->>2)::bigint mapping_id,(x->>3)::bigint offer_id,(x->>4)::numeric size_value from jsonb_array_elements(v_scope) x order by (x->>2)::bigint loop
    select id into v_target_variant_id from public.product_variants where product_id=e.product_id and variant_key=e.size_value::text||'-servings' and display_name=e.size_value::text||' Servings' and size_value=e.size_value and size_unit='servings' and pack_count=1 and is_active and not is_default for update;
    if v_target_variant_id is null or not exists(select 1 from public.product_variants where id=e.default_variant_id and product_id=e.product_id and variant_key='default' and size_value is null and size_unit is null and pack_count is null and is_active and is_default)
      or not exists(select 1 from public.retailer_products where id=e.mapping_id and retailer_id=9 and product_id=e.product_id and product_variant_id=v_target_variant_id)
      or not exists(select 1 from public.offers where id=e.offer_id and retailer_id=9 and product_id=e.product_id and retailer_product_id=e.mapping_id and product_variant_id=v_target_variant_id)
      or exists(select 1 from public.price_identity_series where offer_id=e.offer_id) then raise exception 'Fit House retailer-evidence rollback 27 guard mismatch for mapping %',e.mapping_id; end if;
    update public.retailer_products set product_variant_id=e.default_variant_id where id=e.mapping_id and retailer_id=9 and product_variant_id=v_target_variant_id;
    get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House mapping rollback affected % rows',v_rows; end if;
    update public.offers set product_variant_id=e.default_variant_id where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=v_target_variant_id;
    get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House offer rollback affected % rows',v_rows; end if;
    if (select count(*) from public.retailer_products where product_variant_id=v_target_variant_id)<>0 or (select count(*) from public.offers where product_variant_id=v_target_variant_id)<>0 then raise exception 'Fit House created variant still referenced for mapping %',e.mapping_id; end if;
    delete from public.product_variants where id=v_target_variant_id; get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Fit House variant rollback affected % rows',v_rows; end if;
  end loop;
  if (select count(*) from public.product_variants)<>v_variants_before-27 or (select count(*) from public.price_history)<>v_history_before or (select count(*) from public.price_identity_series)<>v_series_before
    or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id where rp.retailer_id=9 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null)<>192 then raise exception 'Fit House retailer-evidence rollback 27 postcondition mismatch'; end if;
end $rollback$;
commit;
