begin;
set local lock_timeout='5s'; set local statement_timeout='120s';
do $rollback$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_scope constant jsonb:='[["create",676,500,686,694,90],["create",696,568,739,715,200],["create",700,576,743,719,33],["create",709,586,790,728,66],["create",737,625,870,756,30],["create",741,615,874,760,60],["rebind",429,391,2084,1898,60,2967],["create",990,1943,2105,1919,30],["create",994,1947,2106,1920,60],["create",972,1901,2145,1959,20]]'::jsonb;
  e record; v_target_variant_id bigint; v_rows integer; v_variants_before bigint; v_history_before bigint; v_series_before bigint;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION' or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
    or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
    or not exists(select 1 from supabase_migrations.schema_migrations where version='20260826160000' and name='create_fit_house_owner_reviewed_exact_pack_10')
    or jsonb_array_length(v_scope)<>10 then raise exception 'Fit House exact-pack 10 rollback target, ledger or scope mismatch'; end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:fit-house-exact-pack:owner-reviewed-10',0));
  select count(*) into v_variants_before from public.product_variants; select count(*) into v_history_before from public.price_history; select count(*) into v_series_before from public.price_identity_series;
  for e in select x->>0 mode,(x->>1)::bigint product_id,(x->>2)::bigint default_variant_id,(x->>3)::bigint mapping_id,(x->>4)::bigint offer_id,(x->>5)::numeric size_value,nullif(x->>6,'')::bigint target_variant_id from jsonb_array_elements(v_scope) x order by (x->>3)::bigint loop
    if e.mode='create' then
      select id into v_target_variant_id from public.product_variants where product_id=e.product_id and variant_key=e.size_value::text||'-servings' and display_name=e.size_value::text||' Servings' and size_value=e.size_value and size_unit='servings' and pack_count=1 and is_active and not is_default for update;
    else v_target_variant_id:=e.target_variant_id; end if;
    if v_target_variant_id is null or not exists(select 1 from public.product_variants where id=e.default_variant_id and product_id=e.product_id and variant_key='default' and size_value is null and size_unit is null and pack_count is null and is_active and is_default)
      or not exists(select 1 from public.retailer_products where id=e.mapping_id and retailer_id=9 and product_id=e.product_id and product_variant_id=v_target_variant_id)
      or not exists(select 1 from public.offers where id=e.offer_id and retailer_id=9 and retailer_product_id=e.mapping_id and product_variant_id=v_target_variant_id)
      or exists(select 1 from public.price_identity_series where offer_id=e.offer_id) then raise exception 'Fit House exact-pack 10 rollback guard mismatch for mapping %',e.mapping_id; end if;
    update public.retailer_products set product_variant_id=e.default_variant_id where id=e.mapping_id and retailer_id=9 and product_variant_id=v_target_variant_id;
    get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House mapping rollback affected % rows',v_rows; end if;
    update public.offers set product_variant_id=e.default_variant_id where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=v_target_variant_id;
    get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House offer rollback affected % rows',v_rows; end if;
    if e.mode='create' then
      if (select count(*) from public.retailer_products where product_variant_id=v_target_variant_id)<>0 or (select count(*) from public.offers where product_variant_id=v_target_variant_id)<>0 then raise exception 'Fit House created variant still referenced for mapping %',e.mapping_id; end if;
      delete from public.product_variants where id=v_target_variant_id; get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House variant rollback affected % rows',v_rows; end if;
    end if;
  end loop;
  if (select count(*) from public.product_variants)<>v_variants_before-9 or (select count(*) from public.price_history)<>v_history_before or (select count(*) from public.price_identity_series)<>v_series_before
    or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id where rp.retailer_id=9 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null)<>243 then raise exception 'Fit House exact-pack 10 rollback postcondition mismatch'; end if;
end $rollback$;
commit;
