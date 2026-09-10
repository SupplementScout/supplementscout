# GSC/GA4 traffic-quality audit — 10 September 2026

**Result:** the 2–8 September GSC window is now complete enough for a settled
weekly read, while GA4's headline Organic Search session count is materially
contaminated by one operational-looking source. No growth or conversion claim is
supported. The audit was read-only and made no Google configuration changes.

## Search Console re-read

Protected workflow run `34491056108` re-read the same 2–8 September range with a
new daily completeness contract. GSC now reports **1,276 impressions, 2 clicks,
0.16% CTR and average position 54.54**. The prior 9 September read reported 801
impressions and the same 2 clicks. The additional 475 impressions are a **59.3%**
revision, demonstrating that the earlier report was collected before the recent
days had settled.

All seven requested dates now contain final activity. `dataState=final` and
`dataState=all` return identical daily totals, and the API reports no first
incomplete date. Daily impressions are 153, 158, 143, 186, 161, 251 and 224;
the two clicks occurred on 5 and 6 September. This supports using 1,276/2 as the
current weekly baseline. It does not guarantee that Google will never revise
historical reporting again.

## GA4 traffic quality

GA4 now reports **71 Organic Search sessions, 4 users, 555 views and 7 retailer
offer clicks**. The source/medium split changes how that headline should be read:

| Source / medium | Sessions | Users |
|---|---:|---:|
| `search.google.com / referral` | 67 | 1 |
| `bing / organic` | 2 | 1 |
| `google / organic` | 2 | 2 |

All 71 sessions used the correct production hostname and were attributed to the
United Kingdom. The 67 sessions from one user via `search.google.com` strongly
indicate owner, testing or other operational navigation from a Google tool. They
must not be presented as customer acquisition. Excluding that row leaves a
conservative external-search signal of **4 sessions across 3 source-row users**.
User counts across rows are not guaranteed to be additive distinct people.

The supported Data API returns `(not set)` for `testDataFilterName` across all 71
sessions, so no testing-state filter identifies the traffic. The supported Admin
API does not expose the property's active data-filter configuration. Therefore
this audit cannot prove whether an active internal-traffic exclusion exists.

The 7 retailer clicks and the Better-value observation (18 impressions, one
selection, one downstream retailer click user) are not split by source in this
report. They remain unverified as external conversions. Separately, GA4 records
6 sessions from 6 users in the `AI Assistant` channel; this is a small signal to
retain in weekly monitoring, not yet a growth trend.

## Decision

Use GSC **1,276 impressions / 2 clicks / 0.16% CTR / position 54.54** as the
settled 2–8 September search baseline. Use **4 sessions** as the conservative
external-search signal until `search.google.com / referral` is isolated or
excluded. Do not use 71 Organic Search sessions, 7 retailer clicks or the
Better-value funnel as proof of growth or conversion.

Future weekly reports now record final-versus-all GSC rows by date plus GA4 daily,
hostname, country, source/medium and testing-filter evidence. A manual report can
re-read an exact end date. The scheduled workflow remains read-only and keeps raw
reports in private Actions artifacts.

[Machine-readable evidence](growth-traffic-quality-audit-2026-09-10.json) binds
run `34491056108`, artifact `10157749027`, commit `db64e5e` and report SHA-256
`846ff030418a4460e288f0b6ea1fbd774b914d62f31d07e104bee39974f42d3a`.
