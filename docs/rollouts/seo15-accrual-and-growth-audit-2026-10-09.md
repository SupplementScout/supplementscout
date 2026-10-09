# SEO-15 accrual and growth audit - 9 October 2026

**Result:** read-only audit complete; Stage 3 remains **BLOCKED pending the
required separate owner decision**. This audit changed no offer, history,
producer or Google configuration data.

## Price-history evidence

Production audit run `37927290755`, private artifact `11613814836`, captured
30,146 history rows: 26,007 linked to 813 immutable identity series and 4,139
legacy rows excluded from historical claims. The database transaction reported
`transaction_read_only=on` and `database_writes=0`.

| Producer | Series | Proven / quarantined observations | 30-day mature | Current exact/fresh/in-stock | Threshold drops |
| --- | ---: | ---: | ---: | ---: | ---: |
| GYM HIGH | 50 | 1,770 / 0 | 50 | 26 | 0 |
| Fit House | 260 | 4,757 / 2 | 260 | 18 | 0 |
| Jon's | 503 | 19,275 / 203 | 503 | 297 | 5 |

Elapsed maturity is now sufficient for every series, but producer-wide
continuity is not. GYM HIGH has 49/50 observations on each recent date and
remains `owner-deferred`. Fit House has only partial recent dates (20 on 1
October, 246 on 5 October, 20 on 6 October, 247 on 8 October and 22 on 9
October). Jon's has 497-498 of 503 series on most recent dates and no observation
date on 30 September. Historical gaps were not backfilled.

Five Jon's decreases on 28 September pass the GBP 2 / 10%, 14-day, three-date,
seven-day prior-price and latest-state price checks. All stayed at the lower
price through 9 October and have no anomaly flag:

| Offer | Product / exact variant | Delivered price | Current decision |
| ---: | --- | ---: | --- |
| 1284 | Trained By JP Performance Protein 2kg / Chocolate Orange | GBP 49.98 to GBP 36.48 | Exclude: currently out of stock |
| 1339 | HR Labs Defib Pre-Workout / Lemon Fizz Bombs 420g V3 | GBP 35.48 to GBP 27.48 | **Qualifies in this audit** |
| 1251 | Strom StimuMAX Black Edition / Green Apple 360g | GBP 32.98 to GBP 28.98 | Exclude: currently out of stock |
| 1337 | HR Labs Defib Pre-Workout / Jelly Bean 420g V3 | GBP 35.48 to GBP 27.48 | **Qualifies in this audit** |
| 1192 | Performax Labs PhytoActivMax Greens / Peach Iced Tea 330g | GBP 30.94 to GBP 23.98 | Exclude: current identity no longer matches the immutable series |

The two qualifying rows are evidence for a bounded Stage 3 decision, not
permission to publish. The existing plan requires a separate owner decision and
a selector/UI implementation that preserves every fail-closed condition. Fit
House and GYM HIGH do not need to be repaired before a per-row selector can
exclude them, but their gaps must not be represented as complete history.

## GSC and GA4 evidence

Authenticated read-only run `37925170969`, private artifact `11613338938`,
covers 30 September through 6 October. All seven GSC dates are final and present:

- GSC: 1,535 impressions, 15 clicks, 0.98% CTR and average position 36.59;
- GA4 Organic Search: 59 sessions, 11 users, 400 views and zero retailer clicks;
- 45 sessions came from one `search.google.com / referral` user; the conservative
  external organic signal is 14 sessions (10 Google organic and 4 Bing organic);
- Better-value alternatives: 8 impressions and zero clicks;
- sitemap: 1,322 submitted URLs, zero warnings/errors;
- URL Inspection: 6/6 targets returned without an error; five canonical URLs
  were indexed and the apex URL was the expected redirect.

Compared with the last documented 2-8 September read, GSC impressions rose from
1,276 to 1,535 and clicks from 2 to 15. These are non-adjacent snapshots and do
not prove a trend. The recurring one-user referral pattern still prevents using
the raw GA4 session total as a growth or conversion claim.

## Decision and next step

SEO-15 is no longer blocked by age or the absence of a real price drop. It is
blocked only on the planned separate owner decision for a bounded Stage 3
implementation using the two currently qualifying Jon's rows and the existing
per-row fail-closed contract. No public historical wording is enabled. SEO-17
remains behind that decision; weekly GSC/GA4 measurement continues.

The raw reports remain private. Their JSON SHA-256 values are
`d48a55cd48ee167d0d870277409fe4d7470f16504d356848c0befe02169ca9bd`
(SEO-15) and
`698e8c154f992de529b4a8aeb1276a22ee16f49a1ecf5a4ec955f4ec20a37245`
(GSC/GA4).
