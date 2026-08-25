begin;
set local lock_timeout='5s'; set local statement_timeout='120s';
do $rollback$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target(); e record; v_rows integer; v_exact_before bigint;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
    or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu' or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
    or not exists(select 1 from supabase_migrations.schema_migrations where version='20260825220000' and name='rebind_jons_existing_exact_pack_1') then
    raise exception 'Jon''s exact existing rollback target or ledger mismatch'; end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:jons-exact-pack:rebind_jons_existing_exact_pack_1',0));
  select * into e from jsonb_to_record('[{"product_id":407,"product":"CNP Creatine Monohydrate 250g","default_variant_id":386,"mapping_id":1204,"offer_id":1018,"external_product_id":"10025211724114","external_variant_id":"50578552553810","external_sku":"CNP06011","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/cnp-creatine-250g?variant=50578552553810","offer_url":"https://jonssupplements.co.uk/products/cnp-creatine-250g?variant=50578552553810","variant_key":"250g","display_name":"250g","size_value":250,"size_unit":"g","pack_count":1,"price":12.99,"shipping":3.99,"total":16.98,"in_stock":true,"target_variant_id":2015,"target_variant_key":"unflavoured-250g","target_display_name":"Unflavoured / 250g","target_product_format":"powder"}]'::jsonb->0) as x(
    product_id bigint,default_variant_id bigint,target_variant_id bigint,mapping_id bigint,offer_id bigint,
    external_product_id text,external_variant_id text,external_sku text,external_options jsonb,mapping_url text,offer_url text,
    price numeric,shipping numeric,total numeric,in_stock boolean);
  select count(*) into v_exact_before from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
    where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null;
  if exists(select 1 from public.price_identity_series where offer_id=e.offer_id)
    or not exists(select 1 from public.retailer_products where id=e.mapping_id and retailer_id=10 and product_id=e.product_id
      and product_variant_id=e.target_variant_id and external_product_id=e.external_product_id and external_variant_id=e.external_variant_id
      and external_sku is not distinct from e.external_sku and coalesce(external_options,'{}'::jsonb)=coalesce(e.external_options,'{}'::jsonb)
      and external_url=e.mapping_url)
    or not exists(select 1 from public.offers where id=e.offer_id and retailer_id=10 and product_id=e.product_id
      and retailer_product_id=e.mapping_id and product_variant_id=e.target_variant_id and price=e.price and shipping_cost=e.shipping
      and total_price=e.total and in_stock=e.in_stock and url=e.offer_url) then raise exception 'Jon''s exact existing rollback guard mismatch'; end if;
  update public.retailer_products set product_variant_id=e.default_variant_id where id=e.mapping_id and retailer_id=10 and product_variant_id=e.target_variant_id;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Jon''s exact existing mapping rollback affected % rows',v_rows; end if;
  update public.offers set product_variant_id=e.default_variant_id where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=e.target_variant_id;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Jon''s exact existing offer rollback affected % rows',v_rows; end if;
  if (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
    where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null)<>v_exact_before-1 then
    raise exception 'Jon''s exact existing rollback postcondition mismatch'; end if;
end $rollback$;
commit;
