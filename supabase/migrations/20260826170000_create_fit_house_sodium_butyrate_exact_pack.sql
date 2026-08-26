begin;

set local lock_timeout='5s';
set local statement_timeout='120s';

do $apply$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_authority constant text:='owner-chat-2026-08-26-fit-house-sodium-butyrate-one-pack-100-one-capsule-servings';
  v_source_fingerprint constant text:='ef14011b0634d3f20053a569323eb8170defb458d28d22b1bbf700ef2416f1bb';
  v_new_id bigint;
  v_mapping_before jsonb;
  v_offer_before jsonb;
  v_products_before bigint;
  v_variants_before bigint;
  v_mappings_before bigint;
  v_offers_before bigint;
  v_history_before bigint;
  v_series_before bigint;
  v_rows integer;
begin
  if current_user<>'postgres'
    or v_target->>'target_environment'<>'PRODUCTION'
    or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
    or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
    or v_authority<>'owner-chat-2026-08-26-fit-house-sodium-butyrate-one-pack-100-one-capsule-servings'
    or v_source_fingerprint<>'ef14011b0634d3f20053a569323eb8170defb458d28d22b1bbf700ef2416f1bb' then
    raise exception 'Fit House Sodium Butyrate authority, evidence or target mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:fit-house-exact-pack:sodium-butyrate-100',0));

  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;
  select count(*) into v_series_before from public.price_identity_series;
  if v_products_before<>1112 or v_variants_before<>2816 or v_mappings_before<>2761
    or v_offers_before<>2761 or v_history_before<>4001 or v_series_before<>503
    or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
        where rp.retailer_id=9 and v.pack_count is not null and v.size_value is not null
          and nullif(trim(v.size_unit),'') is not null)<>253
    or (select count(*) from public.retailer_products where retailer_id=9)<>286
    or (select count(*) from public.offers where retailer_id=9)<>286 then
    raise exception 'Fit House Sodium Butyrate baseline mismatch';
  end if;
  if not exists(select 1 from public.products where id=736
      and name='7Nutrition Sodium Butyrate 580mg 100 Capsules'
      and is_active and merged_into_product_id is null for update)
    or not exists(select 1 from public.product_variants where id=620 and product_id=736
      and variant_key='default' and display_name='Default' and flavour_code is null
      and flavour_label is null and size_value is null and size_unit is null
      and pack_count is null and product_format is null and gtin is null and image is null
      and nutrition_override='{}'::jsonb and is_active and is_default for update)
    or (select count(*) from public.product_variants where product_id=736)<>1
    or exists(select 1 from public.product_variants where product_id=736 and variant_key='100-servings')
    or exists(select 1 from public.price_identity_series where offer_id=755) then
    raise exception 'Fit House Sodium Butyrate product, variant or series state mismatch';
  end if;
  select to_jsonb(rp) into v_mapping_before from public.retailer_products rp
    where rp.id=869 and rp.retailer_id=9 and rp.product_id=736 and rp.product_variant_id=620
      and rp.external_product_id='8147560530160' and rp.external_variant_id='43582806327536'
      and rp.external_sku is null and rp.external_options is null
      and rp.external_url='https://fithouse.uk/products/7-nutrition-sodium-butyrate-100-vege-caps?variant=43582806327536' for update;
  select to_jsonb(o) into v_offer_before from public.offers o
    where o.id=755 and o.retailer_id=9 and o.product_id=736 and o.product_variant_id=620
      and o.retailer_product_id=869 and o.price=9.99 and o.shipping_cost=3.99
      and o.total_price=13.98 and o.in_stock
      and o.url='https://fithouse.uk/products/7-nutrition-sodium-butyrate-100-vege-caps?variant=43582806327536' for update;
  if v_mapping_before is null or v_offer_before is null then
    raise exception 'Fit House Sodium Butyrate binding or commercial state mismatch';
  end if;

  insert into public.product_variants(
    product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,
    pack_count,product_format,gtin,image,nutrition_override,is_default,is_active
  ) values(736,'100-servings','100 Servings',null,null,100,'servings',1,'capsule',null,null,'{}'::jsonb,false,true)
  returning id into v_new_id;
  update public.retailer_products set product_variant_id=v_new_id
    where id=869 and retailer_id=9 and product_variant_id=620;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Fit House Sodium Butyrate mapping move affected % rows',v_rows; end if;
  update public.offers set product_variant_id=v_new_id
    where id=755 and retailer_product_id=869 and product_variant_id=620;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Fit House Sodium Butyrate offer move affected % rows',v_rows; end if;

  if not exists(select 1 from public.product_variants v
      join public.retailer_products rp on rp.product_variant_id=v.id
      join public.offers o on o.product_variant_id=v.id and o.retailer_product_id=rp.id
      where v.id=v_new_id and v.product_id=736 and v.variant_key='100-servings'
        and v.display_name='100 Servings' and v.flavour_code is null and v.flavour_label is null
        and v.size_value=100 and v.size_unit='servings' and v.pack_count=1
        and v.product_format='capsule' and v.gtin is null and v.image is null
        and v.nutrition_override='{}'::jsonb and v.is_active and not v.is_default
        and rp.id=869 and o.id=755
        and (to_jsonb(rp)-'product_variant_id')=(v_mapping_before-'product_variant_id')
        and (to_jsonb(o)-'product_variant_id')=(v_offer_before-'product_variant_id'))
    or (select count(*) from public.products)<>v_products_before
    or (select count(*) from public.product_variants)<>v_variants_before+1
    or (select count(*) from public.retailer_products)<>v_mappings_before
    or (select count(*) from public.offers)<>v_offers_before
    or (select count(*) from public.price_history)<>v_history_before
    or (select count(*) from public.price_identity_series)<>v_series_before
    or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
        where rp.retailer_id=9 and v.pack_count is not null and v.size_value is not null
          and nullif(trim(v.size_unit),'') is not null)<>254 then
    raise exception 'Fit House Sodium Butyrate postcondition mismatch';
  end if;
end $apply$;

commit;
