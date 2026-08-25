begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $rollback$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_scope constant jsonb := '[{"product_id":819,"product":"Strom KSM-66 Ashwagandha 500mg 120 Caps","default_variant_id":1166,"mapping_id":1280,"offer_id":1094,"external_product_id":"10031275475282","external_variant_id":"50598621020498","external_sku":"STM01001","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/strom-ksm-66-ashwagandha-500mg-120-caps?variant=50598621020498","offer_url":"https://jonssupplements.co.uk/products/strom-ksm-66-ashwagandha-500mg-120-caps?variant=50598621020498","variant_key":"120-servings","display_name":"120 Servings","size_value":120,"size_unit":"servings","pack_count":1,"price":19.99,"shipping":3.99,"total":23.98,"in_stock":true},{"product_id":905,"product":"Strom Sports Uridine Monophosphate 60 Capsules","default_variant_id":1506,"mapping_id":1620,"offer_id":1434,"external_product_id":"10850822455634","external_variant_id":"53687214145874","external_sku":null,"external_options":{"Title":"Default Title"},"mapping_url":"https://jonssupplements.co.uk/products/strom-sport-uridine-monophosphate-60-caps?variant=53687214145874","offer_url":"https://jonssupplements.co.uk/products/strom-sport-uridine-monophosphate-60-caps?variant=53687214145874","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":18.99,"shipping":3.99,"total":22.98,"in_stock":true},{"product_id":935,"product":"Time 4 Vit & Min + Vit C 120 Capsules","default_variant_id":1544,"mapping_id":1658,"offer_id":1472,"external_product_id":"10035464110418","external_variant_id":"50613576073554","external_sku":"T4VMC","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/time-4-vit-min-vit-c-60-capsules?variant=50613576073554","offer_url":"https://jonssupplements.co.uk/products/time-4-vit-min-vit-c-60-capsules?variant=50613576073554","variant_key":"60-servings","display_name":"60 Servings","size_value":60,"size_unit":"servings","pack_count":1,"price":12.99,"shipping":3.99,"total":16.98,"in_stock":true}]'::jsonb;
  e record;
  v_new_id bigint;
  v_new_created_at timestamptz;
  v_rows integer;
  v_variants_before bigint;
  v_history_before bigint;
  v_series_before bigint;
  v_exact_before bigint;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
     or jsonb_array_length(v_scope)<>3
     or not exists(select 1 from supabase_migrations.schema_migrations where version='20260825231000' and name='create_jons_exact_pack_special_evidence_b_3') then
    raise exception 'Jon''s special-evidence rollback target, ledger or scope mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:jons-exact-pack:create_jons_exact_pack_special_evidence_b_3',0));
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_history_before from public.price_history;
  select count(*) into v_series_before from public.price_identity_series;
  select count(*) into v_exact_before from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
    where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null;
  for e in select * from jsonb_to_recordset(v_scope) as x(
    product_id bigint,product text,default_variant_id bigint,mapping_id bigint,offer_id bigint,
    external_product_id text,external_variant_id text,external_sku text,external_options jsonb,
    mapping_url text,offer_url text,variant_key text,display_name text,size_value numeric,
    size_unit text,pack_count integer,price numeric,shipping numeric,total numeric,in_stock boolean
  ) order by mapping_id loop
    select id,created_at into v_new_id,v_new_created_at from public.product_variants
      where product_id=e.product_id and variant_key=e.variant_key and display_name=e.display_name
        and flavour_code is null and flavour_label is null and size_value=e.size_value
        and size_unit=e.size_unit and pack_count=e.pack_count and product_format is null
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
       or exists(select 1 from public.price_identity_series where offer_id=e.offer_id)
       or (select count(*) from public.retailer_products where product_variant_id=v_new_id)<>1
       or (select count(*) from public.offers where product_variant_id=v_new_id)<>1 then
      raise exception 'Jon''s special-evidence rollback guard mismatch for offer %',e.offer_id;
    end if;
    update public.retailer_products set product_variant_id=e.default_variant_id where id=e.mapping_id and retailer_id=10 and product_variant_id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s special-evidence mapping rollback affected % rows',v_rows; end if;
    update public.offers set product_variant_id=e.default_variant_id where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s special-evidence offer rollback affected % rows',v_rows; end if;
    delete from public.product_variants where id=v_new_id;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Jon''s special-evidence variant rollback affected % rows',v_rows; end if;
  end loop;
  if (select count(*) from public.product_variants)<>v_variants_before-3
     or (select count(*) from public.price_history)<>v_history_before
     or (select count(*) from public.price_identity_series)<>v_series_before
     or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
         where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null
           and nullif(trim(v.size_unit),'') is not null)<>v_exact_before-3 then
    raise exception 'Jon''s special-evidence rollback global postcondition mismatch';
  end if;
end
$rollback$;

commit;
