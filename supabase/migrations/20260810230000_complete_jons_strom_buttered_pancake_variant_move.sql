begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $correction$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_new_variant_id bigint;
  v_rows integer;
  v_products_before bigint;
  v_variants_before bigint;
  v_mappings_before bigint;
  v_offers_before bigint;
  v_history_before bigint;
  v_mapping_before jsonb;
  v_offer_before jsonb;
  v_price_history_before jsonb;
  v_binding_before jsonb;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Jon''s Strom Buttered Pancake variant move requires production database owner';
  end if;
  if not exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='jons-23-563ef072fa3fd68c-production'
      and target_environment='PRODUCTION' and retailer_id=10
      and reviewed_manifest_sha256='563ef072fa3fd68c94287eb796aaf8f0ca6163dbe384160a7f7e8f73d40caf4e'
      and reviewed_source_fingerprint='cf2b4bf75deecedaae626a323895a3012c99140d2d939b8823915b62af9a1aa3'
      and reviewed_scope_hash='a10de4b488c1ec0cd6072f78e020127189691cfbfe6ef9df27efe3793965920d'
      and row_count=23 and authorized_by='owner-approved-chat-2026-08-10-23-jons-oos'
      and contract_version=1
  ) or (select count(*) from public.retailer_offer_sync_reviewed_mixed_change_bindings
        where authorization_id='jons-23-563ef072fa3fd68c-production'
          and status='CONSUMED' and consumed_at is not null)<>1 then
    raise exception 'consumed reviewed Jon''s 23-OOS authorization precondition mismatch';
  end if;
  select jsonb_agg(to_jsonb(b) order by b.approval_id)
  into v_binding_before
  from public.retailer_offer_sync_reviewed_mixed_change_bindings b
  where b.authorization_id='jons-23-563ef072fa3fd68c-production';
  if not exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings b
    where b.authorization_id='jons-23-563ef072fa3fd68c-production'
      and b.contract#>>'{reviewed_manifest_sha256}'='563ef072fa3fd68c94287eb796aaf8f0ca6163dbe384160a7f7e8f73d40caf4e'
      and exists(
        select 1 from jsonb_array_elements(b.contract->'reviewed_rows') r
        where r->>'external_product_id'='10697591423314'
          and r->>'external_variant_id'='53111925768530'
          and r->>'action'='UPDATE_STOCK'
          and (r#>>'{before,in_stock}')::boolean
          and not (r#>>'{after,in_stock}')::boolean
      )
  ) then
    raise exception 'consumed reviewed Jon''s Buttered Pancake row is missing';
  end if;
  if not exists(
    select 1 from public.products
    where id=838 and name='Strom Sports Cream of Rice 2kg'
      and product_format='powder' and is_active and merged_into_product_id is null
    for update
  ) then
    raise exception 'Strom Cream of Rice canonical product precondition mismatch';
  end if;
  if not exists(
    select 1 from public.product_variants
    where id=1185 and product_id=838 and variant_key='buttered-pancake-2000g'
      and display_name='Buttered Pancake / 2000g'
      and flavour_code='buttered pancake' and flavour_label='Buttered Pancake'
      and size_value=2000 and size_unit='g' and pack_count=1
      and product_format='powder' and is_active and not is_default
    for update
  ) or exists(
    select 1 from public.product_variants
    where product_id=838 and id<>1185 and (
      is_default or variant_key='buttered-pancake-2000g'
      or (lower(coalesce(flavour_label,''))='buttered pancake'
          and size_value=2000 and lower(coalesce(size_unit,''))='g')
    )
  ) then
    raise exception 'Strom Buttered Pancake variant precondition mismatch';
  end if;
  select to_jsonb(rp) into v_mapping_before
  from public.retailer_products rp
  where rp.id=1299 and rp.retailer_id=10 and rp.product_id=838 and rp.product_variant_id=1185
    and rp.external_product_id='10697591423314' and rp.external_variant_id='53111925768530'
    and rp.external_sku='STM55004'
    and rp.external_options='{"Size":"2000g","Flavour":"Buttered Pancake"}'::jsonb
    and rp.external_url='https://jonssupplements.co.uk/products/strom-sports-cream-of-rice-2kg?variant=53111925768530'
    and rp.updated_at='2026-08-10T16:09:28.215271+00:00'::timestamptz
  for update;
  select to_jsonb(o) into v_offer_before
  from public.offers o
  where o.id=1113 and o.retailer_id=10 and o.product_id=838
    and o.product_variant_id=1185 and o.retailer_product_id=1299
    and o.price=17.99 and o.shipping_cost=3.99 and o.total_price=21.98
    and not o.in_stock
    and o.url='https://jonssupplements.co.uk/products/strom-sports-cream-of-rice-2kg?variant=53111925768530'
    and o.last_checked_at='2026-08-10T16:09:58.914+00:00'::timestamptz
  for update;
  if v_mapping_before is null or v_offer_before is null
     or (select count(*) from public.retailer_products where product_variant_id=1185)<>1
     or (select count(*) from public.offers where product_variant_id=1185)<>1 then
    raise exception 'Strom Buttered Pancake mapping or offer precondition mismatch';
  end if;
  select coalesce(jsonb_agg(to_jsonb(ph) order by ph.id),'[]'::jsonb)
  into v_price_history_before from public.price_history ph where ph.offer_id=1113;
  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;

  update public.product_variants
  set variant_key='default',display_name='Default',flavour_code=null,flavour_label=null,
      size_value=null,size_unit=null,pack_count=null,product_format=null,is_default=true
  where id=1185 and product_id=838 and variant_key='buttered-pancake-2000g'
    and not is_default;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Strom default restoration affected % rows',v_rows; end if;

  insert into public.product_variants(
    product_id,variant_key,display_name,flavour_code,flavour_label,size_value,
    size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active
  ) values(
    838,'buttered-pancake-2000g','Buttered Pancake / 2000g',
    'buttered pancake','Buttered Pancake',2000,'g',1,'powder',
    null,null,'{}'::jsonb,false,true
  ) returning id into v_new_variant_id;
  if v_new_variant_id=1185 then raise exception 'new Buttered Pancake variant reused default identity'; end if;

  update public.retailer_products
  set product_variant_id=v_new_variant_id,updated_at=now()
  where id=1299 and product_variant_id=1185;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Strom mapping move affected % rows',v_rows; end if;

  update public.offers set product_variant_id=v_new_variant_id
  where id=1113 and retailer_product_id=1299 and product_variant_id=1185;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Strom offer move affected % rows',v_rows; end if;

  if (select count(*) from public.products)<>v_products_before
     or (select count(*) from public.product_variants)<>v_variants_before+1
     or (select count(*) from public.retailer_products)<>v_mappings_before
     or (select count(*) from public.offers)<>v_offers_before
     or (select count(*) from public.price_history)<>v_history_before
     or (select count(*) from public.retailer_products where retailer_id=10)<>506
     or (select count(*) from public.offers where retailer_id=10)<>506
     or (select coalesce(jsonb_agg(to_jsonb(ph) order by ph.id),'[]'::jsonb)
         from public.price_history ph where ph.offer_id=1113)<>v_price_history_before
     or (select jsonb_agg(to_jsonb(b) order by b.approval_id)
         from public.retailer_offer_sync_reviewed_mixed_change_bindings b
         where b.authorization_id='jons-23-563ef072fa3fd68c-production')<>v_binding_before then
    raise exception 'Strom Buttered Pancake row-count, history or binding postcondition mismatch';
  end if;
  if not exists(
    select 1 from public.product_variants d
    where d.id=1185 and d.product_id=838 and d.variant_key='default'
      and d.display_name='Default' and d.flavour_code is null and d.flavour_label is null
      and d.size_value is null and d.size_unit is null and d.pack_count is null
      and d.product_format is null and d.is_active and d.is_default
      and not exists(select 1 from public.retailer_products rp where rp.product_variant_id=d.id)
      and not exists(select 1 from public.offers o where o.product_variant_id=d.id)
  ) or not exists(
    select 1 from public.product_variants v
    join public.retailer_products rp on rp.product_variant_id=v.id
    join public.offers o on o.product_variant_id=v.id and o.retailer_product_id=rp.id
    where v.id=v_new_variant_id and v.product_id=838
      and v.variant_key='buttered-pancake-2000g'
      and v.display_name='Buttered Pancake / 2000g'
      and v.flavour_code='buttered pancake' and v.flavour_label='Buttered Pancake'
      and v.size_value=2000 and v.size_unit='g' and v.pack_count=1
      and v.product_format='powder' and v.is_active and not v.is_default
      and rp.id=1299 and rp.external_product_id='10697591423314'
      and rp.external_variant_id='53111925768530' and rp.external_sku='STM55004'
      and (to_jsonb(rp)-'product_variant_id'-'updated_at')
          =(v_mapping_before-'product_variant_id'-'updated_at')
      and o.id=1113 and (to_jsonb(o)-'product_variant_id')=(v_offer_before-'product_variant_id')
  ) then
    raise exception 'Strom Buttered Pancake identity move postcondition mismatch';
  end if;
end
$correction$;

commit;
