begin;
set local lock_timeout='5s'; set local statement_timeout='120s';
do $rollback$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_scope constant jsonb:='[
    {"product_id":673,"default_variant_id":513,"mapping_id":683,"offer_id":691,"variant_key":"90-servings","size_value":90},
    {"product_id":674,"default_variant_id":531,"mapping_id":684,"offer_id":692,"variant_key":"100-servings","size_value":100},
    {"product_id":678,"default_variant_id":514,"mapping_id":688,"offer_id":696,"variant_key":"133-servings","size_value":133},
    {"product_id":683,"default_variant_id":544,"mapping_id":703,"offer_id":701,"variant_key":"60-servings","size_value":60},
    {"product_id":689,"default_variant_id":552,"mapping_id":709,"offer_id":707,"variant_key":"60-servings","size_value":60},
    {"product_id":690,"default_variant_id":554,"mapping_id":710,"offer_id":708,"variant_key":"40-servings","size_value":40},
    {"product_id":715,"default_variant_id":594,"mapping_id":796,"offer_id":734,"variant_key":"60-servings","size_value":60},
    {"product_id":726,"default_variant_id":627,"mapping_id":859,"offer_id":745,"variant_key":"30-servings","size_value":30},
    {"product_id":731,"default_variant_id":624,"mapping_id":864,"offer_id":750,"variant_key":"60-servings","size_value":60},
    {"product_id":734,"default_variant_id":605,"mapping_id":867,"offer_id":753,"variant_key":"120-servings","size_value":120},
    {"product_id":740,"default_variant_id":606,"mapping_id":873,"offer_id":759,"variant_key":"90-servings","size_value":90}
  ]'::jsonb;
  e record; v_target_variant_id bigint; v_rows integer; v_variants_before bigint; v_history_before bigint; v_series_before bigint;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION' or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
    or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
    or not exists(select 1 from supabase_migrations.schema_migrations where version='20260826130000' and name='create_fit_house_retailer_evidence_exact_pack_11')
    or jsonb_array_length(v_scope)<>11 then raise exception 'Fit House retailer-evidence rollback target, ledger or scope mismatch'; end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:fit-house-exact-pack:retailer-evidence-11',0));
  select count(*) into v_variants_before from public.product_variants; select count(*) into v_history_before from public.price_history; select count(*) into v_series_before from public.price_identity_series;
  for e in select * from jsonb_to_recordset(v_scope) as x(product_id bigint,default_variant_id bigint,mapping_id bigint,offer_id bigint,variant_key text,size_value numeric) order by mapping_id loop
    select id into v_target_variant_id from public.product_variants where product_id=e.product_id and variant_key=e.variant_key and display_name=e.size_value::text||' Servings' and size_value=e.size_value and size_unit='servings' and pack_count=1 and is_active and not is_default for update;
    if v_target_variant_id is null or not exists(select 1 from public.product_variants where id=e.default_variant_id and product_id=e.product_id and variant_key='default' and size_value is null and size_unit is null and pack_count is null and is_active and is_default)
      or not exists(select 1 from public.retailer_products where id=e.mapping_id and retailer_id=9 and product_id=e.product_id and product_variant_id=v_target_variant_id)
      or not exists(select 1 from public.offers where id=e.offer_id and retailer_id=9 and product_id=e.product_id and retailer_product_id=e.mapping_id and product_variant_id=v_target_variant_id)
      or exists(select 1 from public.price_identity_series where offer_id=e.offer_id) then raise exception 'Fit House retailer-evidence rollback guard mismatch for mapping %',e.mapping_id; end if;
    update public.retailer_products set product_variant_id=e.default_variant_id where id=e.mapping_id and retailer_id=9 and product_variant_id=v_target_variant_id;
    get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House mapping rollback affected % rows',v_rows; end if;
    update public.offers set product_variant_id=e.default_variant_id where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=v_target_variant_id;
    get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House offer rollback affected % rows',v_rows; end if;
    if (select count(*) from public.retailer_products where product_variant_id=v_target_variant_id)<>0 or (select count(*) from public.offers where product_variant_id=v_target_variant_id)<>0 then raise exception 'Fit House created variant still referenced for mapping %',e.mapping_id; end if;
    delete from public.product_variants where id=v_target_variant_id; get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Fit House variant rollback affected % rows',v_rows; end if;
  end loop;
  if (select count(*) from public.product_variants)<>v_variants_before-11 or (select count(*) from public.price_history)<>v_history_before or (select count(*) from public.price_identity_series)<>v_series_before
    or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id where rp.retailer_id=9 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null)<>181 then raise exception 'Fit House retailer-evidence rollback postcondition mismatch'; end if;
end $rollback$;
commit;
