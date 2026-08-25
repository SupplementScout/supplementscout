begin;
set local lock_timeout='5s'; set local statement_timeout='120s';
do $apply$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_manifest_sha256 constant text:='1ed188258ed4face02c7f9771d05fa732ab18abe7971a161ba8778fa284861f4';
  v_semantic_sha256 constant text:='d07c604eb778e0504816423ebdfbd285c25aeb34618dadb128780d6fd4e34de4';
  e record; v_mapping_before jsonb; v_offer_before jsonb; v_rows integer;
  v_variants_before bigint; v_history_before bigint; v_series_before bigint; v_exact_before bigint;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
    or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
    or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
    or '1ed188258ed4face02c7f9771d05fa732ab18abe7971a161ba8778fa284861f4'!~'^[0-9a-f]{64}$' or 'd07c604eb778e0504816423ebdfbd285c25aeb34618dadb128780d6fd4e34de4'!~'^[0-9a-f]{64}$' then
    raise exception 'Jon''s exact existing rebind evidence or target mismatch'; end if;
  if (select count(*) from public.price_identity_series where retailer_id=10)<>439
    or (select count(*) from public.price_history ph join public.price_identity_series s on s.id=ph.identity_series_id
      where s.retailer_id=10 and ph.observation_kind='daily_confirmation')<>439 then
    raise exception 'Jon''s 439 producer prerequisite is incomplete'; end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:jons-exact-pack:rebind_jons_existing_exact_pack_1',0));
  select * into e from jsonb_to_record('[{"product_id":407,"product":"CNP Creatine Monohydrate 250g","default_variant_id":386,"mapping_id":1204,"offer_id":1018,"external_product_id":"10025211724114","external_variant_id":"50578552553810","external_sku":"CNP06011","external_options":{},"mapping_url":"https://jonssupplements.co.uk/products/cnp-creatine-250g?variant=50578552553810","offer_url":"https://jonssupplements.co.uk/products/cnp-creatine-250g?variant=50578552553810","variant_key":"250g","display_name":"250g","size_value":250,"size_unit":"g","pack_count":1,"price":12.99,"shipping":3.99,"total":16.98,"in_stock":true,"target_variant_id":2015,"target_variant_key":"unflavoured-250g","target_display_name":"Unflavoured / 250g","target_product_format":"powder"}]'::jsonb->0) as x(
    product_id bigint,product text,default_variant_id bigint,target_variant_id bigint,mapping_id bigint,offer_id bigint,
    external_product_id text,external_variant_id text,external_sku text,external_options jsonb,mapping_url text,offer_url text,
    target_variant_key text,target_display_name text,target_product_format text,size_value numeric,size_unit text,pack_count integer,
    price numeric,shipping numeric,total numeric,in_stock boolean);
  select count(*) into v_variants_before from public.product_variants; select count(*) into v_history_before from public.price_history;
  select count(*) into v_series_before from public.price_identity_series;
  select count(*) into v_exact_before from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
    where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null;
  if v_exact_before<>489 then raise exception 'Jon''s exact-pack baseline is %, expected 489',v_exact_before; end if;
  if not exists(select 1 from public.product_variants where id=e.default_variant_id and product_id=e.product_id
      and variant_key='default' and display_name='Default' and size_value is null and size_unit is null and pack_count is null and is_default and is_active for update)
    or not exists(select 1 from public.product_variants where id=e.target_variant_id and product_id=e.product_id
      and variant_key=e.target_variant_key and display_name=e.target_display_name and size_value=e.size_value
      and size_unit=e.size_unit and pack_count=e.pack_count and product_format is not distinct from e.target_product_format and not is_default and is_active for update) then
    raise exception 'Jon''s exact existing target mismatch'; end if;
  select to_jsonb(rp) into v_mapping_before from public.retailer_products rp where rp.id=e.mapping_id and rp.retailer_id=10
    and rp.product_id=e.product_id and rp.product_variant_id=e.default_variant_id and rp.external_product_id=e.external_product_id
    and rp.external_variant_id=e.external_variant_id and rp.external_sku is not distinct from e.external_sku
    and coalesce(rp.external_options,'{}'::jsonb)=coalesce(e.external_options,'{}'::jsonb) and rp.external_url=e.mapping_url for update;
  select to_jsonb(o) into v_offer_before from public.offers o where o.id=e.offer_id and o.retailer_id=10 and o.product_id=e.product_id
    and o.product_variant_id=e.default_variant_id and o.retailer_product_id=e.mapping_id and o.price=e.price
    and o.shipping_cost=e.shipping and o.total_price=e.total and o.in_stock=e.in_stock and o.url=e.offer_url for update;
  if v_mapping_before is null or v_offer_before is null or exists(select 1 from public.price_identity_series where offer_id=e.offer_id) then
    raise exception 'Jon''s exact existing binding mismatch'; end if;
  update public.retailer_products set product_variant_id=e.target_variant_id where id=e.mapping_id and retailer_id=10 and product_variant_id=e.default_variant_id;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Jon''s exact existing mapping move affected % rows',v_rows; end if;
  update public.offers set product_variant_id=e.target_variant_id where id=e.offer_id and retailer_product_id=e.mapping_id and product_variant_id=e.default_variant_id;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'Jon''s exact existing offer move affected % rows',v_rows; end if;
  if (select count(*) from public.product_variants)<>v_variants_before or (select count(*) from public.price_history)<>v_history_before
    or (select count(*) from public.price_identity_series)<>v_series_before
    or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
      where rp.retailer_id=10 and v.pack_count is not null and v.size_value is not null and nullif(trim(v.size_unit),'') is not null)<>v_exact_before+1
    or not exists(select 1 from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id
      where rp.id=e.mapping_id and o.id=e.offer_id and rp.product_variant_id=e.target_variant_id and o.product_variant_id=e.target_variant_id
      and (to_jsonb(rp)-'product_variant_id')=(v_mapping_before-'product_variant_id') and (to_jsonb(o)-'product_variant_id')=(v_offer_before-'product_variant_id')) then
    raise exception 'Jon''s exact existing rebind postcondition mismatch'; end if;
end $apply$;
commit;
