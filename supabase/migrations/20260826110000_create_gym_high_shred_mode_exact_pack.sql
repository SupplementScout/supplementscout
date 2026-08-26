begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $apply$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_authority constant text := 'owner-chat-2026-08-26-gym-high-shred-mode-60-servings';
  v_label_evidence_sha256 constant text := 'cb7b1e71ed449f89e1a2bb1d96a9e7fb3e21ab6403d6723bc05ea31c4367c6bf';
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
     or v_authority<>'owner-chat-2026-08-26-gym-high-shred-mode-60-servings'
     or v_label_evidence_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'GYM HIGH Shred Mode evidence, authority or target mismatch';
  end if;
  if not exists(select 1 from public.price_observation_producers
      where retailer_id=1 and retailer_slug='gym-high'
        and source_importer='gym-high-reviewed-full-catalogue-v1'
        and approved_scope='reviewed-66' and technically_capable and enabled
        and public_use='owner-deferred' and terms_mode='standard-single-purchase-only') then
    raise exception 'GYM HIGH producer prerequisite is incomplete';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:gym-high-exact-pack:create_gym_high_shred_mode_exact_pack',0));

  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;
  select count(*) into v_series_before from public.price_identity_series;
  if (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
      where rp.retailer_id=1 and v.pack_count>0 and v.size_value>0 and nullif(trim(v.size_unit),'') is not null)<>49 then
    raise exception 'GYM HIGH exact-pack baseline is not 49';
  end if;
  if not exists(select 1 from public.products where id=508 and name='GYM HIGH Shred Mode 60 Capsules'
      and is_active and merged_into_product_id is null for update)
     or not exists(select 1 from public.product_variants where id=435 and product_id=508
      and variant_key='default' and display_name='Default' and flavour_code is null
      and flavour_label is null and size_value is null and size_unit is null
      and pack_count is null and is_active and is_default for update)
     or (select count(*) from public.product_variants where product_id=508)<>1
     or exists(select 1 from public.product_variants where product_id=508 and variant_key='60-servings')
     or exists(select 1 from public.price_identity_series where offer_id=550) then
    raise exception 'GYM HIGH Shred Mode product or series state mismatch';
  end if;
  select to_jsonb(rp) into v_mapping_before from public.retailer_products rp
    where rp.id=136 and rp.retailer_id=1 and rp.product_id=508 and rp.product_variant_id=435
      and rp.external_product_id='2796' and rp.external_variant_id='2796'
      and rp.external_sku is null and rp.external_options is null
      and rp.external_url='https://gymhigh.co.uk/product/gym-high-shred-mode-thermogenic-fat-burner-capsules/' for update;
  select to_jsonb(o) into v_offer_before from public.offers o
    where o.id=550 and o.retailer_id=1 and o.product_id=508 and o.product_variant_id=435
      and o.retailer_product_id=136 and o.price=39.99 and o.shipping_cost=3.99
      and o.total_price=43.98 and o.in_stock
      and o.url='https://gymhigh.co.uk/product/gym-high-shred-mode-thermogenic-fat-burner-capsules/' for update;
  if v_mapping_before is null or v_offer_before is null then
    raise exception 'GYM HIGH Shred Mode binding or commercial state mismatch';
  end if;

  insert into public.product_variants(
    product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,
    pack_count,product_format,gtin,image,nutrition_override,is_default,is_active
  ) values(508,'60-servings','60 Servings',null,null,60,'servings',1,null,null,null,'{}'::jsonb,false,true)
  returning id into v_new_id;
  update public.retailer_products set product_variant_id=v_new_id
    where id=136 and retailer_id=1 and product_variant_id=435;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'GYM HIGH Shred Mode mapping move affected % rows',v_rows; end if;
  update public.offers set product_variant_id=v_new_id
    where id=550 and retailer_product_id=136 and product_variant_id=435;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'GYM HIGH Shred Mode offer move affected % rows',v_rows; end if;

  if not exists(select 1 from public.product_variants v
      join public.retailer_products rp on rp.product_variant_id=v.id
      join public.offers o on o.product_variant_id=v.id and o.retailer_product_id=rp.id
      where v.id=v_new_id and v.product_id=508 and v.variant_key='60-servings'
        and v.display_name='60 Servings' and v.size_value=60 and v.size_unit='servings'
        and v.pack_count=1 and v.product_format is null and v.gtin is null
        and v.image is null and v.nutrition_override='{}'::jsonb
        and v.is_active and not v.is_default and rp.id=136 and o.id=550
        and (to_jsonb(rp)-'product_variant_id')=(v_mapping_before-'product_variant_id')
        and (to_jsonb(o)-'product_variant_id')=(v_offer_before-'product_variant_id'))
     or (select count(*) from public.products)<>v_products_before
     or (select count(*) from public.product_variants)<>v_variants_before+1
     or (select count(*) from public.retailer_products)<>v_mappings_before
     or (select count(*) from public.offers)<>v_offers_before
     or (select count(*) from public.price_history)<>v_history_before
     or (select count(*) from public.price_identity_series)<>v_series_before
     or (select count(*) from public.retailer_products rp join public.product_variants v on v.id=rp.product_variant_id
         where rp.retailer_id=1 and v.pack_count>0 and v.size_value>0 and nullif(trim(v.size_unit),'') is not null)<>50
     or (select count(*) from public.retailer_products where retailer_id=1)<>66
     or (select count(*) from public.offers where retailer_id=1)<>66 then
    raise exception 'GYM HIGH Shred Mode exact-pack postcondition mismatch';
  end if;
end
$apply$;

commit;
