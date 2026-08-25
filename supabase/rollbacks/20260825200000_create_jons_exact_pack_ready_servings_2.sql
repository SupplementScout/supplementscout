begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $rollback$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_scope constant jsonb := '[{"product_id":933,"product":"Time 4 Joint Pro 120 Capsules","default_variant_id":1542,"mapping_id":1656,"offer_id":1470,"external_product_id":"10143400755538","external_variant_id":"51038128111954","external_sku":"T4JP","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/time-4-joint-pro-joint-care-120-capsules?variant=51038128111954","offer_url":"https://jonssupplements.co.uk/products/time-4-joint-pro-joint-care-120-capsules?variant=51038128111954","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","price":17.99,"shipping":3.99,"total":21.98,"in_stock":true},{"product_id":941,"product":"Trained By JP Heart Care 30 Servings","default_variant_id":1556,"mapping_id":1670,"offer_id":1484,"external_product_id":"10090854613330","external_variant_id":"50844992602450","external_sku":"TBJ20001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/trained-by-jp-heart-care-30-servings?variant=50844992602450","offer_url":"https://jonssupplements.co.uk/products/trained-by-jp-heart-care-30-servings?variant=50844992602450","variant_key":"30-servings","display_name":"30 Servings","size_value":30,"size_unit":"servings","price":29.79,"shipping":3.99,"total":33.78,"in_stock":true}]'::jsonb;
  e record;
  v_new_id bigint;
  v_new_created_at timestamptz;
  v_rows integer;
  v_products_before bigint;
  v_variants_before bigint;
  v_mappings_before bigint;
  v_offers_before bigint;
  v_history_before bigint;
  v_series_before bigint;
  v_exact_before bigint;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
     or jsonb_array_length(v_scope)<>2
     or not exists(select 1 from supabase_migrations.schema_migrations
       where version='20260825200000' and name='create_jons_exact_pack_ready_servings_2') then
    raise exception 'Jon''s ready servings rollback target, ledger or scope mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:jons-exact-pack-create_jons_exact_pack_ready_servings_2',0));
  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;
  select count(*) into v_series_before from public.price_identity_series;
  select count(*) into v_exact_before from public.retailer_products rp
    join public.product_variants v on v.id=rp.product_variant_id
    where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null
      and nullif(trim(v.size_unit),'') is not null;
  for e in select * from jsonb_to_recordset(v_scope) as x(
    product_id bigint,product text,default_variant_id bigint,mapping_id bigint,offer_id bigint,
    external_product_id text,external_variant_id text,external_sku text,external_options jsonb,
    mapping_url text,offer_url text,variant_key text,display_name text,size_value numeric,
    size_unit text,price numeric,shipping numeric,total numeric,in_stock boolean
  ) order by mapping_id loop
    select id,created_at into v_new_id,v_new_created_at from public.product_variants
    where product_id=e.product_id and variant_key=e.variant_key and display_name=e.display_name
      and flavour_code is null and flavour_label is null and size_value=e.size_value
      and size_unit=e.size_unit and pack_count=1 and product_format is null
      and gtin is null and image is null and nutrition_override='{}'::jsonb
      and is_active and not is_default for update;
    if v_new_id is null
       or not exists(select 1 from public.product_variants where id=e.default_variant_id
          and product_id=e.product_id and variant_key='default' and display_name='Default'
          and size_value is null and size_unit is null and pack_count is null and is_active and is_default)
       or not exists(select 1 from public.retailer_products where id=e.mapping_id and retailer_id=10
          and product_id=e.product_id and product_variant_id=v_new_id
          and external_product_id=e.external_product_id and external_variant_id=e.external_variant_id
          and external_sku is not distinct from e.external_sku
          and coalesce(external_options,'{}'::jsonb)=coalesce(e.external_options,'{}'::jsonb)
          and external_url=e.mapping_url and updated_at<=v_new_created_at)
       or not exists(select 1 from public.offers where id=e.offer_id and retailer_id=10
          and product_id=e.product_id and retailer_product_id=e.mapping_id and product_variant_id=v_new_id
          and price=e.price and shipping_cost=e.shipping and total_price=e.total
          and in_stock=e.in_stock and url=e.offer_url and last_checked_at<=v_new_created_at)
       or exists(select 1 from public.price_identity_series where product_variant_id=v_new_id)
       or (select count(*) from public.retailer_products where product_variant_id=v_new_id)<>1
       or (select count(*) from public.offers where product_variant_id=v_new_id)<>1 then
      raise exception 'Jon''s ready servings rollback guard mismatch for offer %',e.offer_id;
    end if;
    update public.retailer_products set product_variant_id=e.default_variant_id
      where id=e.mapping_id and retailer_id=10 and product_variant_id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s ready servings mapping rollback affected % rows',v_rows; end if;
    update public.offers set product_variant_id=e.default_variant_id
      where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s ready servings offer rollback affected % rows',v_rows; end if;
    delete from public.product_variants where id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s ready servings variant rollback affected % rows',v_rows; end if;
  end loop;
  if (select count(*) from public.products)<>v_products_before
     or (select count(*) from public.product_variants)<>v_variants_before-2
     or (select count(*) from public.retailer_products)<>v_mappings_before
     or (select count(*) from public.offers)<>v_offers_before
     or (select count(*) from public.price_history)<>v_history_before
     or (select count(*) from public.price_identity_series)<>v_series_before
     or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
         where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null
           and nullif(trim(v.size_unit),'') is not null)<>v_exact_before-2
     or (select count(*) from public.retailer_products where retailer_id=10)<>506
     or (select count(*) from public.offers where retailer_id=10)<>506 then
    raise exception 'Jon''s ready servings rollback global postcondition mismatch';
  end if;
end
$rollback$;

commit;
