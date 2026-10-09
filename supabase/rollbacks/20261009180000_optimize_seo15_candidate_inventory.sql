begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare
  v_environment text;
  v_definition text;
begin
  v_environment:=public.retailer_catalogue_actual_database_target()->>'target_environment';
  if v_environment not in ('STAGING','PRODUCTION') then
    raise exception 'SEO-15 inventory optimization rollback requires an exact staging or production target';
  end if;
  if to_regprocedure('public.get_seo15_stage3_candidate_inventory()') is null then
    raise exception 'SEO-15 optimized inventory function is missing';
  end if;
  select pg_get_functiondef('public.get_seo15_stage3_candidate_inventory()'::regprocedure)
    into v_definition;
  if position('ordered_prices as materialized' in lower(v_definition))=0
     or position('select ph.*,s.offer_series_count' in lower(v_definition))=0 then
    raise exception 'SEO-15 optimized inventory rollback predecessor mismatch';
  end if;
end
$preflight$;

create or replace function public.get_seo15_stage3_candidate_inventory()
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $inventory$
  with eligible_series as (
    select s.*,
      pop.retailer_slug producer_retailer_slug,
      pop.approved_scope producer_approved_scope,
      pop.enabled producer_enabled,
      pop.public_use producer_public_use,
      coalesce(release.release_enabled,false) release_enabled,
      count(*) over(partition by s.offer_id)::int offer_series_count
    from public.price_identity_series s
    join public.price_observation_producers pop
      on pop.retailer_id=s.retailer_id and pop.source_importer=s.source_importer
    left join public.seo15_stage3_retailer_releases release
      on release.retailer_id=s.retailer_id and release.source_importer=s.source_importer
    where pop.enabled and pop.public_use='eligible-after-separate-approval'
  ),
  ordered_prices as (
    select ph.*,
      lag(ph.total_price) over(
        partition by ph.identity_series_id order by ph.checked_at,ph.id
      ) previous_total_price
    from public.price_history ph
    join eligible_series s on s.id=ph.identity_series_id
    where ph.evidence_status='proven'
  ),
  series_stats as (
    select ph.identity_series_id,
      min(ph.checked_at) first_proven_at,
      count(distinct ph.observation_date)::int distinct_proven_dates
    from public.price_history ph
    join eligible_series s on s.id=ph.identity_series_id
    where ph.evidence_status='proven'
    group by ph.identity_series_id
  ),
  decreases as (
    select op.*,s.offer_series_count,stats.first_proven_at,stats.distinct_proven_dates
    from ordered_prices op
    join eligible_series s on s.id=op.identity_series_id
    join series_stats stats on stats.identity_series_id=op.identity_series_id
    where op.previous_total_price is not null and op.total_price<op.previous_total_price
      and op.previous_total_price-op.total_price>=2
      and (op.previous_total_price-op.total_price)/op.previous_total_price>=0.10
  ),
  evaluated as (
    select d.id drop_observation_id,s.id identity_series_id,s.offer_id,s.retailer_id,
      r.slug retailer_slug,r.name retailer_name,p.name product_name,p.slug product_slug,
      p.brand product_brand,p.image product_image,p.is_active product_active,
      p.merged_into_product_id product_merged_into_id,pv.is_active variant_active,
      pv.pack_count,pv.size_value,pv.size_unit,o.url offer_url,o.price current_product_price,
      o.shipping_cost current_shipping_cost,o.total_price current_total_price,
      o.in_stock current_in_stock,o.last_checked_at current_last_checked_at,
      d.previous_total_price,d.total_price drop_total_price,d.checked_at drop_checked_at,
      d.observation_date drop_observation_date,d.evidence_status drop_evidence_status,
      d.anomaly_flags drop_anomaly_flags,d.first_proven_at,d.distinct_proven_dates,
      (select count(distinct prior.observation_date)::int
       from public.price_history prior
       where prior.identity_series_id=s.id and prior.evidence_status='proven'
         and prior.observation_date between d.observation_date-7 and d.observation_date-1
         and prior.total_price=d.previous_total_price) prior_stable_dates,
      (select count(*)::int
       from public.price_history prior
       where prior.identity_series_id=s.id
         and prior.observation_date between d.observation_date-7 and d.observation_date-1
         and (prior.evidence_status<>'proven' or prior.total_price<>d.previous_total_price or cardinality(prior.anomaly_flags)>0)) prior_conflicts,
      (select count(*)::int
       from public.price_history later
       where later.identity_series_id=s.id and later.checked_at>d.checked_at
         and (later.evidence_status<>'proven' or later.total_price<>d.total_price or later.in_stock is not true or cardinality(later.anomaly_flags)>0)) subsequent_conflicts,
      d.offer_series_count,
      (o.id is not null and rp.id is not null and pv.id is not null and p.id is not null
       and o.retailer_id=s.retailer_id and o.product_id=s.product_id
       and o.product_variant_id=s.product_variant_id and o.retailer_product_id=s.retailer_product_id
       and rp.retailer_id=s.retailer_id and rp.product_id=s.product_id and rp.product_variant_id=s.product_variant_id
       and rp.external_product_id=s.external_product_id
       and coalesce(rp.external_variant_id,'')=coalesce(s.external_variant_id,'')
       and coalesce(rp.external_gtin,'')=coalesce(s.gtin,'')
       and pv.product_id=s.product_id and pv.size_value=s.size_value and pv.size_unit=s.size_unit
       and pv.pack_count=s.pack_count and coalesce(pv.product_format,'')=coalesce(s.product_format,'')) identity_matches,
      (latest.id is not null and latest.price=o.price and latest.shipping_cost=o.shipping_cost
       and latest.total_price=o.total_price and latest.in_stock=o.in_stock) latest_matches,
      s.producer_enabled,s.producer_public_use,s.producer_approved_scope,s.release_enabled
    from decreases d
    join eligible_series s on s.id=d.identity_series_id
    join public.offers o on o.id=s.offer_id
    join public.retailers r on r.id=s.retailer_id
    join public.retailer_products rp on rp.id=s.retailer_product_id
    join public.product_variants pv on pv.id=s.product_variant_id
    join public.products p on p.id=s.product_id
    left join lateral (
      select ph.* from public.price_history ph
      where ph.identity_series_id=s.id and ph.evidence_status='proven'
      order by ph.checked_at desc,ph.id desc limit 1
    ) latest on true
  ),
  qualified as (
    select * from evaluated
    where product_active and product_merged_into_id is null and variant_active
      and current_in_stock and current_last_checked_at>=clock_timestamp()-interval '24 hours'
      and current_product_price>0 and current_shipping_cost>=0
      and current_total_price=current_product_price+current_shipping_cost
      and current_total_price=drop_total_price
      and distinct_proven_dates>=3 and clock_timestamp()-first_proven_at>=interval '14 days'
      and prior_stable_dates=7 and prior_conflicts=0 and subsequent_conflicts=0
      and offer_series_count=1 and drop_evidence_status='proven'
      and cardinality(drop_anomaly_flags)=0 and identity_matches and latest_matches
  ),
  retailer_counts as (
    select retailer_id,retailer_slug,retailer_name,release_enabled,
      count(*)::int candidate_count
    from qualified
    group by retailer_id,retailer_slug,retailer_name,release_enabled
  )
  select jsonb_build_object(
    'schema_version',1,
    'kind','seo15-stage3-candidate-inventory',
    'captured_at',clock_timestamp(),
    'database_writes',0,
    'summary',jsonb_build_object(
      'candidate_count',(select count(*) from qualified),
      'released_candidate_count',(select count(*) from qualified where release_enabled),
      'awaiting_retailer_approval_count',(select count(*) from qualified where not release_enabled),
      'released_retailer_count',(select count(*) from public.seo15_stage3_retailer_releases where release_enabled),
      'retailers',coalesce((select jsonb_agg(to_jsonb(rc) order by rc.retailer_id) from retailer_counts rc),'[]'::jsonb)
    ),
    'candidates',coalesce((select jsonb_agg(to_jsonb(q) order by q.release_enabled desc,q.retailer_id,q.offer_id,q.drop_checked_at) from qualified q),'[]'::jsonb)
  )
$inventory$;

alter function public.get_seo15_stage3_candidate_inventory() owner to postgres;
revoke all on function public.get_seo15_stage3_candidate_inventory() from public,anon,authenticated,service_role;
grant execute on function public.get_seo15_stage3_candidate_inventory() to service_role;

notify pgrst,'reload schema';

commit;
