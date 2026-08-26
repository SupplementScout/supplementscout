begin;
set local lock_timeout='5s'; set local statement_timeout='120s';
do $rollback$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_scope constant jsonb:='[
    {"mode":"create","product_id":679,"default_variant_id":532,"mapping_id":689,"offer_id":697,"variant_key":"1000g","display_name":"1kg","flavour_code":null,"flavour_label":null,"size_value":1000,"size_unit":"g","pack_count":1},
    {"mode":"create","product_id":680,"default_variant_id":535,"mapping_id":690,"offer_id":698,"variant_key":"150g","display_name":"150g","flavour_code":null,"flavour_label":null,"size_value":150,"size_unit":"g","pack_count":1},
    {"mode":"create","product_id":681,"default_variant_id":539,"mapping_id":701,"offer_id":699,"variant_key":"417g","display_name":"417g","flavour_code":null,"flavour_label":null,"size_value":417,"size_unit":"g","pack_count":1},
    {"mode":"rebind","product_id":688,"default_variant_id":549,"target_variant_id":2891,"mapping_id":708,"offer_id":706,"variant_key":"60-servings","display_name":"60 Servings","flavour_code":null,"flavour_label":null,"size_value":60,"size_unit":"servings","pack_count":1},
    {"mode":"create","product_id":694,"default_variant_id":565,"mapping_id":736,"offer_id":712,"variant_key":"natural-200g","display_name":"200g / Natural","flavour_code":"natural","flavour_label":"Natural","size_value":200,"size_unit":"g","pack_count":1},
    {"mode":"create","product_id":705,"default_variant_id":581,"mapping_id":748,"offer_id":724,"variant_key":"227g","display_name":"227g","flavour_code":null,"flavour_label":null,"size_value":227,"size_unit":"g","pack_count":1},
    {"mode":"create","product_id":706,"default_variant_id":582,"mapping_id":749,"offer_id":725,"variant_key":"227g","display_name":"227g","flavour_code":null,"flavour_label":null,"size_value":227,"size_unit":"g","pack_count":1},
    {"mode":"create","product_id":719,"default_variant_id":598,"mapping_id":800,"offer_id":738,"variant_key":"unflavoured-100g","display_name":"100g / Unflavoured","flavour_code":"unflavoured","flavour_label":"Unflavoured","size_value":100,"size_unit":"g","pack_count":1},
    {"mode":"create","product_id":720,"default_variant_id":599,"mapping_id":801,"offer_id":739,"variant_key":"227g","display_name":"227g","flavour_code":null,"flavour_label":null,"size_value":227,"size_unit":"g","pack_count":1},
    {"mode":"create","product_id":725,"default_variant_id":621,"mapping_id":858,"offer_id":744,"variant_key":"unflavoured-227g","display_name":"227g / Unflavoured","flavour_code":"unflavoured","flavour_label":"Unflavoured","size_value":227,"size_unit":"g","pack_count":1},
    {"mode":"create","product_id":727,"default_variant_id":633,"mapping_id":860,"offer_id":746,"variant_key":"unflavoured-250g","display_name":"250g / Unflavoured","flavour_code":"unflavoured","flavour_label":"Unflavoured","size_value":250,"size_unit":"g","pack_count":1},
    {"mode":"create","product_id":732,"default_variant_id":630,"mapping_id":865,"offer_id":751,"variant_key":"unflavoured-250g","display_name":"250g / Unflavoured","flavour_code":"unflavoured","flavour_label":"Unflavoured","size_value":250,"size_unit":"g","pack_count":1},
    {"mode":"create","product_id":733,"default_variant_id":634,"mapping_id":866,"offer_id":752,"variant_key":"cherry-berry-369g","display_name":"369g / Cherry Berry","flavour_code":"cherry berry","flavour_label":"Cherry Berry","size_value":369,"size_unit":"g","pack_count":1},
    {"mode":"rebind","product_id":508,"default_variant_id":435,"target_variant_id":2975,"mapping_id":947,"offer_id":761,"variant_key":"60-servings","display_name":"60 Servings","flavour_code":null,"flavour_label":null,"size_value":60,"size_unit":"servings","pack_count":1},
    {"mode":"rebind","product_id":1,"default_variant_id":559,"target_variant_id":2965,"mapping_id":2098,"offer_id":1912,"variant_key":"60-servings","display_name":"60 Servings","flavour_code":null,"flavour_label":null,"size_value":60,"size_unit":"servings","pack_count":1}
  ]'::jsonb;
  e record; v_target_variant_id bigint; v_rows integer; v_variants_before bigint; v_history_before bigint; v_series_before bigint;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION' or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
    or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
    or not exists(select 1 from supabase_migrations.schema_migrations where version='20260826120000' and name='create_fit_house_exact_pack_batch_15')
    or jsonb_array_length(v_scope)<>15 then raise exception 'Fit House batch 15 rollback target, ledger or scope mismatch'; end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:fit-house-exact-pack:batch-15',0));
  select count(*) into v_variants_before from public.product_variants; select count(*) into v_history_before from public.price_history; select count(*) into v_series_before from public.price_identity_series;
  for e in select * from jsonb_to_recordset(v_scope) as x(mode text,product_id bigint,default_variant_id bigint,target_variant_id bigint,mapping_id bigint,offer_id bigint,variant_key text,display_name text,flavour_code text,flavour_label text,size_value numeric,size_unit text,pack_count integer) order by mapping_id loop
    if e.mode='create' then
      select id into v_target_variant_id from public.product_variants where product_id=e.product_id and variant_key=e.variant_key and display_name=e.display_name and flavour_code is not distinct from e.flavour_code and flavour_label is not distinct from e.flavour_label and size_value=e.size_value and size_unit=e.size_unit and pack_count=e.pack_count and is_active and not is_default for update;
    else v_target_variant_id:=e.target_variant_id; end if;
    if v_target_variant_id is null or not exists(select 1 from public.product_variants where id=e.default_variant_id and product_id=e.product_id and variant_key='default' and size_value is null and size_unit is null and pack_count is null and is_active and is_default)
      or not exists(select 1 from public.retailer_products where id=e.mapping_id and retailer_id=9 and product_id=e.product_id and product_variant_id=v_target_variant_id)
      or not exists(select 1 from public.offers where id=e.offer_id and retailer_id=9 and product_id=e.product_id and retailer_product_id=e.mapping_id and product_variant_id=v_target_variant_id)
      or exists(select 1 from public.price_identity_series where offer_id=e.offer_id) then raise exception 'Fit House rollback guard mismatch for mapping %',e.mapping_id; end if;
    update public.retailer_products set product_variant_id=e.default_variant_id where id=e.mapping_id and retailer_id=9 and product_variant_id=v_target_variant_id;
    get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House mapping rollback affected % rows',v_rows; end if;
    update public.offers set product_variant_id=e.default_variant_id where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=v_target_variant_id;
    get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Fit House offer rollback affected % rows',v_rows; end if;
    if e.mode='create' then
      if (select count(*) from public.retailer_products where product_variant_id=v_target_variant_id)<>0 or (select count(*) from public.offers where product_variant_id=v_target_variant_id)<>0 then raise exception 'Fit House created variant still referenced for mapping %',e.mapping_id; end if;
      delete from public.product_variants where id=v_target_variant_id; get diagnostics v_rows=row_count;
      if v_rows<>1 then raise exception 'Fit House variant rollback affected % rows',v_rows; end if;
    end if;
  end loop;
  if (select count(*) from public.product_variants)<>v_variants_before-12 or (select count(*) from public.price_history)<>v_history_before or (select count(*) from public.price_identity_series)<>v_series_before
    or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id where rp.retailer_id=9 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null)<>166 then raise exception 'Fit House rollback postcondition mismatch'; end if;
end $rollback$;
commit;
