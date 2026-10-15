begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $release_gym_high_stage3_source$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_authority constant text := 'owner-chat-2026-10-14-end-gym-high-owner-deferred';
  v_source constant text := 'gym-high-reviewed-full-catalogue-v1';
  v_owner_scope constant text := 'gym-high-stage3-automatic-candidates-v1';
  v_before_counts jsonb;
  v_after_counts jsonb;
  v_before_inventory jsonb;
  v_after_inventory jsonb;
  v_rows integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu'
     or v_authority <> 'owner-chat-2026-10-14-end-gym-high-owner-deferred' then
    raise exception 'GYM HIGH SEO-15 source release authority or production target mismatch';
  end if;

  if to_regclass('public.price_observation_producers') is null
     or to_regclass('public.seo15_stage3_retailer_releases') is null
     or to_regclass('public.price_identity_series') is null
     or to_regclass('public.price_history') is null
     or to_regprocedure('public.get_seo15_stage3_candidate_inventory()') is null then
    raise exception 'GYM HIGH SEO-15 source release foundation is incomplete';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('supplementscout:seo15:gym-high-source-release',0));

  if not exists(
    select 1 from public.price_observation_producers
    where retailer_id=1 and retailer_slug='gym-high'
      and source_importer=v_source and approved_scope='reviewed-66'
      and technically_capable and enabled and public_use='owner-deferred'
      and terms_mode='standard-single-purchase-only'
  ) then
    raise exception 'GYM HIGH SEO-15 producer baseline mismatch';
  end if;

  if (select count(*) from public.seo15_stage3_retailer_releases)<>1
     or not exists(
       select 1 from public.seo15_stage3_retailer_releases
       where retailer_id=10 and source_importer='retailer_offer_mixed_batch'
         and owner_scope='jons-stage3-automatic-candidates-v1' and release_enabled
     )
     or exists(
       select 1 from public.seo15_stage3_retailer_releases
       where retailer_id=1 or source_importer=v_source
     ) then
    raise exception 'GYM HIGH SEO-15 release registry baseline mismatch';
  end if;

  if (select count(*) from public.price_identity_series where retailer_id=1 and source_importer=v_source)<>50
     or exists(
       select 1
       from public.price_identity_series s
       left join public.price_history ph on ph.identity_series_id=s.id
       where s.retailer_id=1 and s.source_importer=v_source
       group by s.id
       having count(distinct ph.observation_date) filter(where ph.evidence_status='proven')<3
          or count(*) filter(where ph.evidence_status='quarantined')>0
     ) then
    raise exception 'GYM HIGH SEO-15 identity-proven evidence baseline mismatch';
  end if;

  select jsonb_build_object(
    'products',(select count(*) from public.products),
    'variants',(select count(*) from public.product_variants),
    'mappings',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'history',(select count(*) from public.price_history),
    'series',(select count(*) from public.price_identity_series)
  ) into v_before_counts;
  select public.get_seo15_stage3_candidate_inventory() into v_before_inventory;

  if (v_before_inventory#>>'{summary,released_retailer_count}')::integer<>1
     or exists(
       select 1 from jsonb_array_elements(v_before_inventory->'candidates') candidate
       where (candidate->>'retailer_id')::bigint=1
     ) then
    raise exception 'GYM HIGH SEO-15 pre-release candidate inventory mismatch';
  end if;

  update public.price_observation_producers
  set public_use='eligible-after-separate-approval',updated_at=clock_timestamp()
  where retailer_id=1 and retailer_slug='gym-high'
    and source_importer=v_source and approved_scope='reviewed-66'
    and technically_capable and enabled and public_use='owner-deferred'
    and terms_mode='standard-single-purchase-only';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception 'GYM HIGH SEO-15 producer release changed an unexpected row count';
  end if;

  insert into public.seo15_stage3_retailer_releases
    (retailer_id,source_importer,owner_scope,release_enabled,approved_at)
  values
    (1,v_source,v_owner_scope,true,'2026-10-14T00:00:00Z'::timestamptz);

  select public.get_seo15_stage3_candidate_inventory() into v_after_inventory;
  select jsonb_build_object(
    'products',(select count(*) from public.products),
    'variants',(select count(*) from public.product_variants),
    'mappings',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'history',(select count(*) from public.price_history),
    'series',(select count(*) from public.price_identity_series)
  ) into v_after_counts;

  if v_after_counts<>v_before_counts
     or v_after_inventory->'candidates'<>v_before_inventory->'candidates'
     or v_after_inventory#>'{summary,retailers}'<>v_before_inventory#>'{summary,retailers}'
     or v_after_inventory#>>'{summary,candidate_count}'<>v_before_inventory#>>'{summary,candidate_count}'
     or v_after_inventory#>>'{summary,released_candidate_count}'<>v_before_inventory#>>'{summary,released_candidate_count}'
     or v_after_inventory#>>'{summary,awaiting_retailer_approval_count}'<>v_before_inventory#>>'{summary,awaiting_retailer_approval_count}'
     or (v_after_inventory#>>'{summary,released_retailer_count}')::integer<>2
     or (select count(*) from public.seo15_stage3_retailer_releases)<>2
     or not exists(
       select 1 from public.seo15_stage3_retailer_releases
       where retailer_id=1 and source_importer=v_source
         and owner_scope=v_owner_scope and release_enabled
         and approved_at='2026-10-14T00:00:00Z'::timestamptz
     )
     or has_table_privilege('service_role','public.seo15_stage3_retailer_releases','select')
     or has_function_privilege('anon','public.get_seo15_stage3_candidate_inventory()','execute')
     or has_function_privilege('authenticated','public.get_seo15_stage3_candidate_inventory()','execute')
     or not has_function_privilege('service_role','public.get_seo15_stage3_candidate_inventory()','execute') then
    raise exception 'GYM HIGH SEO-15 source release postcondition failed';
  end if;
end
$release_gym_high_stage3_source$;

commit;
