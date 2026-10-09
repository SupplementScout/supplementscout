const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

const ROOT = path.resolve(__dirname, "..");

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function parseArgs(argv) {
  invariant(argv.length === 1, "SEO-15 audit requires one --output argument");
  const match = argv[0].match(/^--output=(.+)$/);
  invariant(match, "SEO-15 audit requires --output");
  const output = path.resolve(match[1]);
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  invariant(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "SEO-15 output must stay inside repository tmp");
  return { output };
}

const AUDIT_SQL = String.raw`
with series_base as (
  select s.*,
    min(ph.checked_at) filter (where ph.evidence_status='proven') first_proven,
    max(ph.checked_at) filter (where ph.evidence_status='proven') last_proven,
    count(ph.id)::int observations,
    count(ph.id) filter (where ph.evidence_status='proven')::int proven,
    count(ph.id) filter (where ph.evidence_status='quarantined')::int quarantined,
    count(distinct ph.observation_date) filter (where ph.evidence_status='proven')::int distinct_dates
  from public.price_identity_series s
  left join public.price_history ph on ph.identity_series_id=s.id
  group by s.id
),
identity_state as (
  select s.*,
    o.id is not null and rp.id is not null and pv.id is not null and p.id is not null
      and o.retailer_id=s.retailer_id and o.product_id=s.product_id
      and o.product_variant_id=s.product_variant_id and o.retailer_product_id=s.retailer_product_id
      and rp.retailer_id=s.retailer_id and rp.product_id=s.product_id and rp.product_variant_id=s.product_variant_id
      and rp.external_product_id=s.external_product_id
      and coalesce(rp.external_variant_id,'')=coalesce(s.external_variant_id,'')
      and coalesce(rp.external_gtin,'')=coalesce(s.gtin,'')
      and pv.product_id=s.product_id and pv.size_value=s.size_value and pv.size_unit=s.size_unit
      and pv.pack_count=s.pack_count and coalesce(pv.product_format,'')=coalesce(s.product_format,'') identity_matches,
    latest.id is not null and latest.price=o.price and latest.shipping_cost=o.shipping_cost
      and latest.total_price=o.total_price and latest.in_stock=o.in_stock latest_matches,
    o.in_stock and p.is_active and p.merged_into_product_id is null and pv.is_active
      and o.last_checked_at >= clock_timestamp()-interval '24 hours' current_state_eligible
  from series_base s
  left join public.offers o on o.id=s.offer_id
  left join public.retailer_products rp on rp.id=s.retailer_product_id
  left join public.product_variants pv on pv.id=s.product_variant_id
  left join public.products p on p.id=s.product_id
  left join lateral (
    select ph.* from public.price_history ph
    where ph.identity_series_id=s.id and ph.evidence_status='proven'
    order by ph.checked_at desc,ph.id desc limit 1
  ) latest on true
),
per_series as (
  select s.*,
    exists(
      select 1 from generate_series(s.first_proven::date,current_date-1,interval '1 day') day
      where not exists(
        select 1 from public.price_history ph
        where ph.identity_series_id=s.id and ph.evidence_status='proven' and ph.observation_date=day::date
      )
    ) has_missing_completed_date
  from identity_state s
),
ordered_prices as (
  select ph.*,
    lag(ph.total_price) over(partition by ph.identity_series_id order by ph.checked_at,ph.id) previous_total_price
  from public.price_history ph where ph.identity_series_id is not null and ph.evidence_status='proven'
),
drops as (
  select op.*,s.retailer_id,
    op.previous_total_price-op.total_price>=2
      and (op.previous_total_price-op.total_price)/op.previous_total_price>=0.10 threshold_drop,
    (select count(distinct prior.observation_date)=7
      from public.price_history prior
      where prior.identity_series_id=op.identity_series_id and prior.evidence_status='proven'
        and prior.observation_date between op.observation_date-7 and op.observation_date-1
        and prior.total_price=op.previous_total_price) continuous_7d
  from ordered_prices op join public.price_identity_series s on s.id=op.identity_series_id
  where op.previous_total_price is not null and op.total_price<op.previous_total_price
),
daily as (
  select s.retailer_id,ph.observation_date,count(distinct ph.identity_series_id)::int series_count,
    count(*)::int observation_count,
    count(*) filter(where ph.evidence_status='proven')::int proven,
    count(*) filter(where ph.evidence_status='quarantined')::int quarantined
  from public.price_history ph join public.price_identity_series s on s.id=ph.identity_series_id
  group by s.retailer_id,ph.observation_date
),
retailer_summary as (
  select s.retailer_id,pop.retailer_slug,pop.enabled,pop.public_use,
    count(*)::int series,sum(s.observations)::int observations,sum(s.proven)::int proven,sum(s.quarantined)::int quarantined,
    count(*) filter(where clock_timestamp()-s.first_proven>=interval '14 days')::int at_least_14_days,
    count(*) filter(where clock_timestamp()-s.first_proven>=interval '30 days')::int at_least_30_days,
    count(*) filter(where s.distinct_dates>=3)::int at_least_3_dates,
    count(*) filter(where s.has_missing_completed_date)::int with_missing_completed_dates,
    count(*) filter(where not s.identity_matches)::int identity_drift,
    count(*) filter(where s.latest_matches)::int latest_matches,
    count(*) filter(where s.identity_matches and s.latest_matches and s.current_state_eligible)::int current_eligible,
    min(s.first_proven) first_proven,max(s.last_proven) last_proven,
    coalesce((select count(*) from drops d where d.retailer_id=s.retailer_id and d.threshold_drop),0)::int amount_threshold_decreases,
    coalesce((select count(*) from drops d where d.retailer_id=s.retailer_id and d.threshold_drop and d.continuous_7d),0)::int continuous_7d_threshold_decreases
  from per_series s left join public.price_observation_producers pop on pop.retailer_id=s.retailer_id and pop.source_importer=s.source_importer
  group by s.retailer_id,pop.retailer_slug,pop.enabled,pop.public_use
)
select jsonb_build_object(
  'schema_version',1,'kind','seo15-readonly-accrual-audit','captured_at',clock_timestamp(),
  'database_writes',0,
  'history_rows',(select count(*) from public.price_history),
  'legacy_rows',(select count(*) from public.price_history where identity_series_id is null),
  'identity_series',(select count(*) from public.price_identity_series),
  'identity_linked_observations',(select count(*) from public.price_history where identity_series_id is not null),
  'producers',(select coalesce(jsonb_agg(to_jsonb(p) order by p.retailer_id),'[]'::jsonb) from public.price_observation_producers p),
  'qualifying_drops',(select coalesce(jsonb_agg(jsonb_build_object(
    'retailer_id',d.retailer_id,'retailer_slug',pop.retailer_slug,
    'identity_series_id',d.identity_series_id,'offer_id',d.offer_id,
    'observation_date',d.observation_date,'checked_at',d.checked_at,
    'previous_total_price',d.previous_total_price,'new_total_price',d.total_price,
    'decrease_amount',d.previous_total_price-d.total_price,
    'decrease_ratio',(d.previous_total_price-d.total_price)/d.previous_total_price,
    'evidence_status',d.evidence_status,'anomaly_flags',d.anomaly_flags,
    'continuous_7d',d.continuous_7d,'identity_matches',s.identity_matches,
    'latest_matches',s.latest_matches,'current_state_eligible',s.current_state_eligible,
    'current_total_price',o.total_price,'current_in_stock',o.in_stock,'current_last_checked_at',o.last_checked_at,
    'public_use',pop.public_use
  ) order by d.retailer_id,d.observation_date,d.identity_series_id),'[]'::jsonb)
    from drops d join identity_state s on s.id=d.identity_series_id
    join public.offers o on o.id=d.offer_id
    left join public.price_observation_producers pop on pop.retailer_id=d.retailer_id and pop.source_importer=s.source_importer
    where d.threshold_drop and d.continuous_7d),
  'retailers',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object(
    'missing_whole_dates',coalesce((select jsonb_agg(day::date order by day) from generate_series(r.first_proven::date,current_date-1,interval '1 day') day where not exists(select 1 from daily d where d.retailer_id=r.retailer_id and d.observation_date=day::date and d.series_count=r.series)),'[]'::jsonb),
    'daily_counts',coalesce((select jsonb_object_agg(d.observation_date,jsonb_build_object('observations',d.observation_count,'proven',d.proven,'quarantined',d.quarantined,'series',d.series_count) order by d.observation_date) from daily d where d.retailer_id=r.retailer_id),'{}'::jsonb)
  ) order by r.retailer_id),'[]'::jsonb) from retailer_summary r)
) report;
`;

async function collectAudit({ connectionString, ClientImpl = Client }) {
  invariant(connectionString, "SEO15_AUDIT_OWNER_DATABASE_URL is required");
  const client = new ClientImpl({
    connectionString,
    ssl: { rejectUnauthorized: false },
    application_name: "supplementscout-seo15-readonly-audit-v1",
    options: "-c default_transaction_read_only=on -c statement_timeout=120000",
  });
  await client.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    const context = (await client.query("select current_user,session_user,current_setting('transaction_read_only') read_only,current_setting('app.safe_update',true) safe_update,(public.retailer_catalogue_actual_database_target()->>'target_environment') target_environment")).rows[0];
    invariant(context.read_only === "on", "SEO-15 audit transaction is not read-only");
    invariant(context.target_environment === "PRODUCTION", "SEO-15 audit target is not production");
    invariant(!context.safe_update || context.safe_update === "false" || context.safe_update === "off", "SAFE_UPDATE must remain disabled");
    const report = (await client.query(AUDIT_SQL)).rows[0].report;
    await client.query("rollback");
    return { ...report, database_session: { current_user: context.current_user, session_user: context.session_user, transaction_read_only: context.read_only }, database_writes: 0 };
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const { output } = parseArgs(argv);
  const report = await collectAudit({ connectionString: env.SEO15_AUDIT_OWNER_DATABASE_URL });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ result: "PASS", captured_at: report.captured_at, identity_series: report.identity_series, identity_linked_observations: report.identity_linked_observations, database_writes: report.database_writes }));
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { AUDIT_SQL, collectAudit, parseArgs };
