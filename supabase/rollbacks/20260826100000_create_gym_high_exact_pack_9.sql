begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $rollback$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_scope constant jsonb := '[{"product_id":1,"default_variant_id":559,"mapping_id":1,"offer_id":1,"variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1},{"product_id":429,"default_variant_id":391,"mapping_id":106,"offer_id":535,"variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1},{"product_id":427,"default_variant_id":379,"mapping_id":139,"offer_id":536,"variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","pack_count":1},{"product_id":412,"default_variant_id":400,"mapping_id":141,"offer_id":540,"variant_key":"500g","display_name":"500g","size_value":500,"size_unit":"g","pack_count":1},{"product_id":389,"default_variant_id":555,"mapping_id":384,"offer_id":541,"variant_key":"250g","display_name":"250g","size_value":250,"size_unit":"g","pack_count":1},{"product_id":444,"default_variant_id":533,"mapping_id":77,"offer_id":542,"variant_key":"250g","display_name":"250g","size_value":250,"size_unit":"g","pack_count":1},{"product_id":413,"default_variant_id":390,"mapping_id":142,"offer_id":544,"variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1},{"product_id":516,"default_variant_id":572,"mapping_id":385,"offer_id":551,"variant_key":"500g","display_name":"500g","size_value":500,"size_unit":"g","pack_count":1},{"product_id":529,"default_variant_id":507,"mapping_id":387,"offer_id":554,"variant_key":"400g","display_name":"400g","size_value":400,"size_unit":"g","pack_count":1}]'::jsonb;
  e record;
  v_new_id bigint;
  v_rows integer;
  v_variants_before bigint;
  v_history_before bigint;
  v_series_before bigint;
  v_exact_before bigint;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
     or jsonb_array_length(v_scope)<>9
     or not exists(select 1 from supabase_migrations.schema_migrations where version='20260826100000' and name='create_gym_high_exact_pack_9') then
    raise exception 'GYM HIGH rollback target, ledger or scope mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:gym-high-exact-pack:create_gym_high_exact_pack_9',0));
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_history_before from public.price_history;
  select count(*) into v_series_before from public.price_identity_series;
  select count(*) into v_exact_before from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
    where rp.retailer_id=1 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null;
  for e in select * from jsonb_to_recordset(v_scope) as x(
    product_id bigint,default_variant_id bigint,mapping_id bigint,offer_id bigint,
    variant_key text,display_name text,size_value numeric,size_unit text,pack_count integer
  ) order by mapping_id loop
    select id into v_new_id from public.product_variants
      where product_id=e.product_id and variant_key=e.variant_key and display_name=e.display_name
        and flavour_code is null and flavour_label is null and size_value=e.size_value
        and size_unit=e.size_unit and pack_count=e.pack_count and product_format is null
        and gtin is null and image is null and nutrition_override='{}'::jsonb
        and is_active and not is_default for update;
    if v_new_id is null
       or not exists(select 1 from public.product_variants where id=e.default_variant_id
         and product_id=e.product_id and variant_key='default' and display_name='Default'
         and size_value is null and size_unit is null and pack_count is null and is_active and is_default)
       or not exists(select 1 from public.retailer_products where id=e.mapping_id and retailer_id=1
         and product_id=e.product_id and product_variant_id=v_new_id)
       or not exists(select 1 from public.offers where id=e.offer_id and retailer_id=1
         and product_id=e.product_id and retailer_product_id=e.mapping_id and product_variant_id=v_new_id)
       or exists(select 1 from public.price_identity_series where offer_id=e.offer_id)
       or (select count(*) from public.retailer_products where product_variant_id=v_new_id)<>1
       or (select count(*) from public.offers where product_variant_id=v_new_id)<>1 then
      raise exception 'GYM HIGH rollback guard mismatch for offer %',e.offer_id;
    end if;
    update public.retailer_products set product_variant_id=e.default_variant_id
      where id=e.mapping_id and retailer_id=1 and product_variant_id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'GYM HIGH mapping rollback affected % rows',v_rows; end if;
    update public.offers set product_variant_id=e.default_variant_id
      where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'GYM HIGH offer rollback affected % rows',v_rows; end if;
    delete from public.product_variants where id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'GYM HIGH variant rollback affected % rows',v_rows; end if;
  end loop;
  if (select count(*) from public.product_variants)<>v_variants_before-9
     or (select count(*) from public.price_history)<>v_history_before
     or (select count(*) from public.price_identity_series)<>v_series_before
     or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
         where rp.retailer_id=1 and v.pack_count is not null and v.size_value is not null
           and nullif(trim(v.size_unit),'') is not null)<>v_exact_before-9 then
    raise exception 'GYM HIGH rollback global postcondition mismatch';
  end if;
end
$rollback$;

commit;
