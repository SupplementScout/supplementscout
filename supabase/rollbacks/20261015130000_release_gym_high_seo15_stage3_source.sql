begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $rollback_gym_high_stage3_source$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_source constant text := 'gym-high-reviewed-full-catalogue-v1';
  v_owner_scope constant text := 'gym-high-stage3-automatic-candidates-v1';
  v_before_counts jsonb;
  v_after_counts jsonb;
  v_rows integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'GYM HIGH SEO-15 source release rollback target mismatch';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('supplementscout:seo15:gym-high-source-release',0));

  if not exists(
       select 1 from public.price_observation_producers
       where retailer_id=1 and retailer_slug='gym-high'
         and source_importer=v_source and approved_scope='reviewed-66'
         and technically_capable and enabled
         and public_use='eligible-after-separate-approval'
         and terms_mode='standard-single-purchase-only'
     )
     or not exists(
       select 1 from public.seo15_stage3_retailer_releases
       where retailer_id=1 and source_importer=v_source
         and owner_scope=v_owner_scope and release_enabled
         and approved_at='2026-10-14T00:00:00Z'::timestamptz
     ) then
    raise exception 'GYM HIGH SEO-15 source release rollback baseline mismatch';
  end if;

  select jsonb_build_object(
    'products',(select count(*) from public.products),
    'variants',(select count(*) from public.product_variants),
    'mappings',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'history',(select count(*) from public.price_history),
    'series',(select count(*) from public.price_identity_series)
  ) into v_before_counts;

  delete from public.seo15_stage3_retailer_releases
  where retailer_id=1 and source_importer=v_source
    and owner_scope=v_owner_scope and release_enabled
    and approved_at='2026-10-14T00:00:00Z'::timestamptz;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception 'GYM HIGH SEO-15 source release rollback deleted an unexpected row count';
  end if;

  update public.price_observation_producers
  set public_use='owner-deferred',updated_at=clock_timestamp()
  where retailer_id=1 and retailer_slug='gym-high'
    and source_importer=v_source and approved_scope='reviewed-66'
    and technically_capable and enabled
    and public_use='eligible-after-separate-approval'
    and terms_mode='standard-single-purchase-only';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception 'GYM HIGH SEO-15 producer rollback changed an unexpected row count';
  end if;

  select jsonb_build_object(
    'products',(select count(*) from public.products),
    'variants',(select count(*) from public.product_variants),
    'mappings',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'history',(select count(*) from public.price_history),
    'series',(select count(*) from public.price_identity_series)
  ) into v_after_counts;

  if v_after_counts<>v_before_counts
     or (select count(*) from public.seo15_stage3_retailer_releases)<>1
     or not exists(
       select 1 from public.seo15_stage3_retailer_releases
       where retailer_id=10 and source_importer='retailer_offer_mixed_batch'
         and owner_scope='jons-stage3-automatic-candidates-v1' and release_enabled
     )
     or exists(
       select 1 from public.seo15_stage3_retailer_releases
       where retailer_id=1 or source_importer=v_source
     ) then
    raise exception 'GYM HIGH SEO-15 source release rollback postcondition failed';
  end if;
end
$rollback_gym_high_stage3_source$;

commit;
