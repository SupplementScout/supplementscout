begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare
  v_environment text;
  v_scope_count integer;
begin
  if to_regclass('public.price_identity_series') is null
     or to_regclass('public.price_history') is null
     or to_regclass('public.price_observation_producers') is null then
    raise exception 'SEO-15 bounded Stage 3 requires the identity-proven price observation foundation';
  end if;
  if to_regprocedure('public.retailer_catalogue_actual_database_target()') is null then
    raise exception 'SEO-15 bounded Stage 3 requires the guarded database target contract';
  end if;
  v_environment:=public.retailer_catalogue_actual_database_target()->>'target_environment';
  if v_environment not in ('STAGING','PRODUCTION') then
    raise exception 'SEO-15 bounded Stage 3 requires an exact staging or production target';
  end if;
  select count(*) into v_scope_count from public.offers where id in (1337,1339) and retailer_id=10;
  if exists(
    select 1 from public.offers o
    where o.id in (1337,1339) and o.retailer_id<>10
  ) or (v_environment='PRODUCTION' and v_scope_count<>2)
     or (v_environment='STAGING' and v_scope_count not in (0,2)) then
    raise exception 'SEO-15 bounded Stage 3 exact Jon''s offer scope does not match';
  end if;
end
$preflight$;

create function public.get_seo15_bounded_stage3_evidence()
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $evidence$
  with scoped_series as (
    select s.*,
      count(*) over(partition by s.offer_id)::int offer_series_count
    from public.price_identity_series s
    where s.retailer_id=10 and s.offer_id in (1337,1339)
  ),
  ordered_prices as (
    select ph.*,
      lag(ph.total_price) over(
        partition by ph.identity_series_id order by ph.checked_at,ph.id
      ) previous_total_price
    from public.price_history ph
    join scoped_series s on s.id=ph.identity_series_id
    where ph.evidence_status='proven'
  ),
  series_stats as (
    select ph.identity_series_id,
      min(ph.checked_at) first_proven_at,
      count(distinct ph.observation_date)::int distinct_proven_dates
    from public.price_history ph
    join scoped_series s on s.id=ph.identity_series_id
    where ph.evidence_status='proven'
    group by ph.identity_series_id
  ),
  decreases as (
    select op.*,s.offer_series_count,stats.first_proven_at,stats.distinct_proven_dates
    from ordered_prices op
    join scoped_series s on s.id=op.identity_series_id
    join series_stats stats on stats.identity_series_id=op.identity_series_id
    where op.previous_total_price is not null and op.total_price<op.previous_total_price
  ),
  evidence_rows as (
    select jsonb_build_object(
      'drop_observation_id',d.id,
      'identity_series_id',s.id,
      'offer_id',s.offer_id,
      'retailer_id',s.retailer_id,
      'retailer_slug',r.slug,
      'retailer_name',r.name,
      'product_name',p.name,
      'product_slug',p.slug,
      'product_brand',p.brand,
      'product_image',p.image,
      'product_active',p.is_active,
      'product_merged_into_id',p.merged_into_product_id,
      'variant_active',pv.is_active,
      'pack_count',pv.pack_count,
      'size_value',pv.size_value,
      'size_unit',pv.size_unit,
      'offer_url',o.url,
      'current_product_price',o.price,
      'current_shipping_cost',o.shipping_cost,
      'current_total_price',o.total_price,
      'current_in_stock',o.in_stock,
      'current_last_checked_at',o.last_checked_at,
      'previous_total_price',d.previous_total_price,
      'drop_total_price',d.total_price,
      'drop_checked_at',d.checked_at,
      'drop_observation_date',d.observation_date,
      'drop_evidence_status',d.evidence_status,
      'drop_anomaly_flags',d.anomaly_flags,
      'first_proven_at',d.first_proven_at,
      'distinct_proven_dates',d.distinct_proven_dates,
      'prior_stable_dates',(
        select count(distinct prior.observation_date)::int
        from public.price_history prior
        where prior.identity_series_id=s.id and prior.evidence_status='proven'
          and prior.observation_date between d.observation_date-7 and d.observation_date-1
          and prior.total_price=d.previous_total_price
      ),
      'prior_conflicts',(
        select count(*)::int
        from public.price_history prior
        where prior.identity_series_id=s.id
          and prior.observation_date between d.observation_date-7 and d.observation_date-1
          and (prior.evidence_status<>'proven' or prior.total_price<>d.previous_total_price or cardinality(prior.anomaly_flags)>0)
      ),
      'subsequent_conflicts',(
        select count(*)::int
        from public.price_history later
        where later.identity_series_id=s.id and later.checked_at>d.checked_at
          and (later.evidence_status<>'proven' or later.total_price<>d.total_price or later.in_stock is not true or cardinality(later.anomaly_flags)>0)
      ),
      'offer_series_count',d.offer_series_count,
      'identity_matches',(
        o.id is not null and rp.id is not null and pv.id is not null and p.id is not null
        and o.retailer_id=s.retailer_id and o.product_id=s.product_id
        and o.product_variant_id=s.product_variant_id and o.retailer_product_id=s.retailer_product_id
        and rp.retailer_id=s.retailer_id and rp.product_id=s.product_id and rp.product_variant_id=s.product_variant_id
        and rp.external_product_id=s.external_product_id
        and coalesce(rp.external_variant_id,'')=coalesce(s.external_variant_id,'')
        and coalesce(rp.external_gtin,'')=coalesce(s.gtin,'')
        and pv.product_id=s.product_id and pv.size_value=s.size_value and pv.size_unit=s.size_unit
        and pv.pack_count=s.pack_count and coalesce(pv.product_format,'')=coalesce(s.product_format,'')
      ),
      'latest_matches',(
        latest.id is not null and latest.price=o.price and latest.shipping_cost=o.shipping_cost
        and latest.total_price=o.total_price and latest.in_stock=o.in_stock
      ),
      'producer_enabled',pop.enabled,
      'producer_public_use',pop.public_use
    ) row
    from decreases d
    join scoped_series s on s.id=d.identity_series_id
    join public.offers o on o.id=s.offer_id
    join public.retailers r on r.id=s.retailer_id
    join public.retailer_products rp on rp.id=s.retailer_product_id
    join public.product_variants pv on pv.id=s.product_variant_id
    join public.products p on p.id=s.product_id
    left join public.price_observation_producers pop
      on pop.retailer_id=s.retailer_id and pop.source_importer=s.source_importer
    left join lateral (
      select ph.* from public.price_history ph
      where ph.identity_series_id=s.id and ph.evidence_status='proven'
      order by ph.checked_at desc,ph.id desc limit 1
    ) latest on true
  )
  select coalesce(jsonb_agg(row order by (row->>'offer_id')::bigint,(row->>'drop_checked_at')::timestamptz),'[]'::jsonb)
  from evidence_rows
$evidence$;

alter function public.get_seo15_bounded_stage3_evidence() owner to postgres;
revoke all on function public.get_seo15_bounded_stage3_evidence() from public,anon,authenticated,service_role;
grant execute on function public.get_seo15_bounded_stage3_evidence() to service_role;

comment on function public.get_seo15_bounded_stage3_evidence() is
  'Read-only, exact-scope evidence boundary for owner-approved SEO-15 Stage 3 Jon''s offers 1337 and 1339; it performs no catalogue or history writes.';

commit;
