begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $enable_fit_house_producer$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_authority constant text := 'owner-chat-2026-08-26-enable-fit-house-after-286-no-change-preflight';
  v_products_before bigint;
  v_variants_before bigint;
  v_mappings_before bigint;
  v_offers_before bigint;
  v_history_before bigint;
  v_rows integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu'
     or v_authority <> 'owner-chat-2026-08-26-enable-fit-house-after-286-no-change-preflight' then
    raise exception 'Fit House producer authority or production target mismatch';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('supplementscout:enable-fit-house-price-observation-producer', 0));

  if (select count(*) from public.price_observation_producers) <> 7
     or (select count(*) from public.price_observation_producers where enabled) <> 2
     or not exists(select 1 from public.price_observation_producers where retailer_id=10 and enabled)
     or not exists(select 1 from public.price_observation_producers where retailer_id=1 and enabled)
     or exists(select 1 from public.price_observation_producers where retailer_id not in (1,10) and enabled) then
    raise exception 'existing producer control state is not the approved Jon''s and GYM HIGH baseline';
  end if;

  if not exists(
    select 1 from public.price_observation_producers
    where retailer_id=9 and retailer_slug='fit-house'
      and source_importer='retailer_offer_mixed_batch'
      and approved_scope='approved-286' and technically_capable and not enabled
      and public_use='eligible-after-separate-approval'
      and terms_mode='standard-single-purchase-only'
  ) or (select count(*) from public.retailer_products where retailer_id=9)<>286
    or (select count(*) from public.offers where retailer_id=9)<>286
    or (select count(*) from public.price_identity_series where retailer_id=9)<>0 then
    raise exception 'Fit House producer, approved scope, or pre-accrual state mismatch';
  end if;

  if (
    select count(*) from public.retailer_products rp
    join public.products p on p.id=rp.product_id
    join public.product_variants v on v.id=rp.product_variant_id and v.product_id=rp.product_id
    join public.offers o on o.retailer_product_id=rp.id and o.retailer_id=rp.retailer_id
    where rp.retailer_id=9
      and v.pack_count>0 and v.size_value>0 and nullif(trim(v.size_unit),'') is not null
      and v.is_active and p.is_active and p.merged_into_product_id is null and p.merged_at is null
      and o.product_id=rp.product_id and o.product_variant_id=rp.product_variant_id
      and o.price>0 and o.shipping_cost>=0 and o.total_price>0
      and round(o.price+o.shipping_cost,2)=round(o.total_price,2)
      and o.in_stock is not null and o.last_checked_at is not null
  ) <> 260 then
    raise exception 'Fit House exact-pack producer-ready scope is not the audited 260 of 286';
  end if;

  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;

  update public.price_observation_producers
  set enabled=true,updated_at=clock_timestamp()
  where retailer_id=9 and retailer_slug='fit-house'
    and source_importer='retailer_offer_mixed_batch'
    and approved_scope='approved-286' and technically_capable and not enabled
    and public_use='eligible-after-separate-approval'
    and terms_mode='standard-single-purchase-only';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Fit House producer enablement changed an unexpected row count'; end if;

  if (select count(*) from public.price_observation_producers where enabled)<>3
     or not exists(select 1 from public.price_observation_producers where retailer_id=1 and enabled)
     or not exists(select 1 from public.price_observation_producers where retailer_id=9 and enabled)
     or not exists(select 1 from public.price_observation_producers where retailer_id=10 and enabled)
     or (select count(*) from public.products)<>v_products_before
     or (select count(*) from public.product_variants)<>v_variants_before
     or (select count(*) from public.retailer_products)<>v_mappings_before
     or (select count(*) from public.offers)<>v_offers_before
     or (select count(*) from public.price_history)<>v_history_before then
    raise exception 'Fit House producer enablement postcondition failed';
  end if;
end
$enable_fit_house_producer$;

commit;
