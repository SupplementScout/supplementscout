# SEO-15 accrual audit and weekly growth readout - 9 September 2026

**Result:** audit complete, read-only; Stage 3 **NOT READY**. Production snapshot
2026-09-09T10:10:18.507Z; zero production/Google configuration writes. This is an
evidence task, not a page launch or a new producer approval.

## Price-history evidence

| Producer | Identity series | Observations | Proven / quarantined | Observation dates per series | 14-day elapsed gate at snapshot |
| --- | ---: | ---: | ---: | --- | --- |
| Jon's | 503 | 5,013 | 4,966 / 47 | 6-10 | 503 pass |
| Fit House | 260 | 2,860 | 2,860 / 0 | 11 | Not yet: first threshold today at 16:10:24 UTC |
| GYM HIGH | 50 | 300 | 300 / 0 | 6 | First threshold 17 September at 08:59:05 UTC; public use remains owner-deferred |

Total: **813 series, 8,173 observations**. The 4,053 legacy history rows were
excluded. Four other configured producers remain disabled. All 813 series
still match current offer/mapping/variant/pack identity; no series reset,
duplicate daily confirmation or SQL observation-date inconsistency was found.
The 47 quarantined observations cover 45 Jon's offers and all carry
RETURNED_FROM_OOS; quarantine is preserved, not counted as clean evidence.

Independent SQL and the per-series analysis agree. Across all identity-linked
history there are **zero price decreases and three increases**, all increases
at Jon's. Consequently there are **zero qualifying historical drops**, even
before applying the other Stage 3 requirements. No historical claim is enabled.

Continuity is incomplete:

- Fit House has no observations on 30-31 August and 1-2 September.
- Jon's has none on 28 August, 1-2 September and 5-7 September; individual
  series also have additional missing/quarantined evidence.
- GYM HIGH's first actual observations are 3 September, not its August
  enablement date. It has six consecutive dates through 8 September. Today's
  run 34331843129 executed 66 plans: ledger readback shows 50 replayed
  confirmations referring to 8 September plus 16 expected identity skips.
  Sample current offer timestamps are also 8 September, so this requires
  source-timestamp tracing, not an assumption that daily deduplication is wrong.

At snapshot time, 409 Jon's and 182 Fit House series have currently active,
in-stock, fresh offers with complete delivery and matching identity. Latest
history matches 501/503 Jon's and 260/260 Fit House series; Jon's 1002 and
1209 do not qualify on latest-state/freshness evidence. GYM HIGH's latest
observations are older than 24h. These counts are not publishable-drop counts.

The first 30-day threshold is 24 September 05:18:30 UTC for Jon's and
25 September 16:10:24 UTC for Fit House. Later-started series mature later.
GYM HIGH's first 30-day threshold is 3 October 08:59:05 UTC. Elapsed time alone
does not repair gaps or establish a continuous seven-day reference price.

## Authenticated GSC/GA4 evidence

Fresh run [34338385065](https://github.com/SupplementScout/supplementscout/actions/runs/34338385065)
passed, reporting **2-8 September**:

- GSC: **801 impressions, 2 clicks, 0.25% CTR**, average position 56.88.
- GA4 organic: **69 sessions, 3 users, 527 views, 6 retailer-offer clicks**.
- Better-value alternatives: **18 impressions, 1 click (5.56%)**; one selecting
  user also clicked a retailer offer within 30 minutes. This is a one-user
  observation, not evidence of a conversion uplift or a purchase.
- Sitemap: 1,322 submitted URLs, zero reported errors/warnings. Five inspected
  canonical URLs pass; the sixth is the expected non-www home redirect.
  This does not establish whole-site index coverage, and the API's sitemap
  indexed=0 value must not be reported as zero indexed pages.

| Metric | 24-30 August | 31 August-6 September |
| --- | ---: | ---: |
| GSC impressions | 1,076 | 996 |
| GSC clicks | 5 | 1 |
| GSC CTR | 0.46% | 0.10% |
| GSC average position | 64.55 | 58.00 |
| GA4 organic sessions | 20 | 53 |
| GA4 organic users | 5 | 3 |
| Organic retailer-offer clicks | 0 | 6 |

These are disjoint calendar-week snapshots from runs 33413636032 and
34132888683, not settled historical re-queries. GSC uses dataState=final but
recent dates may still be absent; the reports do not prove date-level
completeness. The fresh 2-8 September window overlaps the latest calendar week
and is not a week-over-week comparison. The earlier artifact has no alternatives
measurement, which is not equivalent to zero activity.

Traffic remains small and concentrated. Check internal/test traffic and
attribution before interpreting 69 organic sessions from three users as growth;
GSC clicks and GA4 sessions are different measures. Category visibility is
strongest by impressions for Mass Gainer (192, position 52.42), Magnesium
(182, 72.22) and Vitamin D (77, 64.30), with zero clicks for each. This supports
continued measurement, not a roadmap override or a claim of proven demand.

## Decision and next checkpoint

The mandatory SEO-15 return/audit is complete. SEO-15 remains BLOCKED for
public historical claims because continuity, maturity and real qualifying
decreases are not yet established; the blocker is no longer solely the date.
Monitor the next normal producer runs with per-day evidence and investigate
missing-date/source-timestamp causes through the existing mechanisms. Do not
backfill, replay production applies, enable more producers or publish claims.
Re-audit continuity on **16 September**; keep **24-25 September** as conditional
publication-readiness reviews. SEO-17 remains behind that decision. Weekly
GSC/GA4 and bounded attribution checks can continue without a new SEO page.

Raw Google and database reports remain private under ignored tmp and Actions
artifacts. [Machine-readable evidence](seo15-accrual-and-growth-audit-2026-09-09.json)
records artifact digests, aggregate SQL cross-checks, dates and limitations.
