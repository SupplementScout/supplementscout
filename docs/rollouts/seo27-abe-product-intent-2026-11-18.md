# SEO-27: standard ABE product buying intent

Status: LIVE VERIFIED — owner-approved production release and public readback.
Base: `71e29a79b70f728954b954062f890e64522b3202`.
Approved head: `a321fc1a931c0ec6ed58a9a80185b23a72017d21`.
The final documentation-only closeout main SHA/CI and deployment/readback are
recorded on merged PR #547; no self-referential commit hash is embedded here.

## Production release — 18 November 2026

The later explicit owner instruction authorizes squash merge, automatic
Production and evidence-based closeout. Earlier Draft-only boundaries in the
implementation record are historical for this release.

- [PR #547](https://github.com/SupplementScout/supplementscout/pull/547) merged
  at `2026-11-18T11:14:50Z` as `5e483e94fd6d044f162512d4d92a314338e448e5`.
  Its tree is identical to the approved head; no runtime amendment was needed.
- [Main Quality Gate](https://github.com/SupplementScout/supplementscout/actions/runs/44292931305)
  and [Project Guardian](https://github.com/SupplementScout/supplementscout/actions/runs/44292931387)
  pass. Fresh local quick1,330/full4,058 scheduled tests, TypeScript, ESLint and
  Next16.2.9 production build complete with zero failures. Three existing legacy
  10 Reps artifact-dependent cases retain their built-in skips when their input
  files are absent; integration isolation is retained. No test or protection
  was disabled by this release.
- GitHub Production deployment `7881636613` and Vercel
  `dpl_Ne7QEbAiCVEMiBBALdPvXyq6vaM1` report success at11:15:49Z. The public
  custom-domain fingerprint changes from `lAMmMOJjK6sdUxAg21eq7` to
  `cUA2uOSFCTHL4PrKVYSEZ`. Exact commit statuses plus public build/content
  supply the authorized proof; private API403/SSO protections are preserved.
- First positive public ABE readback: `2026-11-18T11:16:11.921Z`. Full public
  contract readback covers21 routes; public Chrome QA completes at11:19:52Z
  with14 desktop1440/mobile390 cases. Images were visually reviewed. No
  horizontal overflow, clipped copy, overlapping sections, runtime exceptions
  or HTTP errors were observed. Contextual links and keyboard order pass.
- ABE base and `?variant=1672` return200 with the approved introduction and
  Standard ABE or ABE Pump section in initial HTML. Pump has no standard-copy
  leak. `/compare?left=215&right=481` returns200, noindex/follow and canonical
  `/compare`; both products resolve. Existing title/description/H1, canonical,
  robots and schema match baseline. Product schema remains exact-variant only.
  Both product URLs and all ten guides occur once in the duplicate-free sitemap.
- Source-bound public data rechecked at `2026-11-18T11:19:26.186Z`:

| Exact variant | Retailer | Item + delivery = total | Source check UTC |
| --- | --- | --- | --- |
| ABE Baddy Berry1672,315g | eBay UK | £21.95 + £0 = £21.95 | 17Nov14:57:48.215 |
| ABE Baddy Berry1672,315g | Gladiator Nutrition | £22.99 + £6.99 = £29.98 | 17Nov17:39:49.348 |
| ABE Baddy Berry1672,315g | Whey Okay | £26.73 + £3.99 = £30.72 | 18Nov10:14:49.194 |
| Pump Tigers Blood763,500g | eBay UK | £29.95 + £0 = £29.95 | 17Nov14:57:29.871 |
| Pump Tigers Blood763,500g | 10 Reps | £28.99 + £3.99 = £32.98 | 18Nov10:47:00.534 |
| Pump Tigers Blood763,500g | Gladiator Nutrition | £31.99 + £6.99 = £38.98 | 17Nov17:39:49.348 |
| Pump Tigers Blood763,500g | Whey Okay | £37.81 + £3.99 = £41.80 | 18Nov10:14:49.194 |

These are dated readback evidence, never constants in application code. Offer
IDs/variant ownership, stock/freshness, sums, visible dates and exact Product
offer prices match current source GETs. Existing approved/applied200mg/10.5g
for1672 and confirmed_absent for763 match public per-variant facts. No serving
count, cost per serving, other-flavour nutrition or absence of all stimulants
was inferred. All seven tracked /go paths return204 to HEAD; no GET/click was
used to insert outbound analytics. Retailer tracking source remains unchanged.

Six same-method public warm-response comparisons, median TTFB in milliseconds:

| Route | Before | Released |
| --- | ---: | ---: |
| ABE base | 890.4 | 1038.5 |
| ABE1672 | 989.7 | 990.6 |
| Pump base | 851.2 | 1044.4 |
| Clear Whey | 964.8 | 1024.9 |
| CNP Creatine | 724.4 | 808.2 |
| PER4M hub | 212.8 | 187.4 |

All pass the unchanged `after <= before * 1.5 + 100ms` guard. DNS errors:0;
lookup/connect/TLS and request timings are retained separately. These are
bounded lab observations, not proof of field CWV improvement. Source parity
and prior instrumentation retain7→7 reads; no production DB instrumentation,
new runtime read, N+1, cache change or dependency was added.

Pump base/763, Clear Whey, CNP, PER4M product/hub, Gold Standard Whey, homepage,
creatine/under-20 and all ten published guides pass public regression contracts.
Only this standard ABE card gained copy. SEO-20 is frozen; SEO-21–26 retain
LIVE VERIFIED; SEO-15 Stage3 stays disabled. No data, mapping, nutrition,
history, importer, workflow, schedule or Google write occurred.

Measurement clock uses the verified18November release. First complete UTC
windows are19–25November and19November–16December; inspect only once GSC
marks those dates complete. Keep existing metrics/limitations below and the
unchanged SEO-20 clock. No automatic Google submission or next implementation.

## Original Draft scope and implementation

The original18November owner instruction authorized one Draft PR for
`/product/applied-nutrition-abe-ultimate-pre-workout-315g`, its necessary tests
and this minimal record. No merge, production deployment or next task.

- Extend the existing productPresentation mechanism with an exact ID215,
  slug/name/brand/category guard. The canonical product has a legacy null
  product_format; accept that exact identity without writing the catalogue.
  Do not activate the copy for a different identity or explicit liquid format.
- Within the existing server renderer, clarify that standard powder, Pump,
  shot and RTD are separate products. Explain exact pack/flavour, dynamic
  retailer/delivery/check-date information and variant-specific caffeine facts.
- Add two crawlable contextual links: the existing Pump500g card and
  `/compare?left=215&right=481`. The latter remains noindex/follow with the
  existing `/compare` canonical. No new page or duplicate content mechanism.
- Keep the existing H1, title, description, summaries used in JSON-LD,
  canonical/robots/sitemap, exact offer links and retailer_offer_click.
  No price, stock, dose, serving count or saving is hard-coded in the new copy.
- No new client component, package, runtime read, N+1 query or caching change.

## Identity and reviewed facts, rechecked18November09:47UTC

Existing GET-only source readback confirmed:

| Product | Exact variant | Existing approved/applied caffeine proof |
| --- | --- | --- |
| Standard ABE, product215,315g | Baddy Berry1672 | Candidate2706: present_with_amount,200mg per10.5g serving; existing applied-fact resolver agrees. |
| ABE Pump, product481,500g | Tigers Blood763 | Candidate752: confirmed_absent; existing applied-fact resolver agrees. |

The315g source is the manufacturer's existing
[connect page](https://connect.appliednutrition.uk/product/abe-all-black-everything-pre-workout-copy/).
The main manufacturer shop now also lists
[standard375g](https://appliednutrition.uk/products/abe-all-black-everything-375g),
whose12.5g serving is not the315g/10.5g record. No relabelling, nutrition
transfer or catalogue/mapping change is authorized or performed.
[Pump500g](https://appliednutrition.uk/products/abe-pump-pre-workout-500g-caffeine-free)
remains a distinct product. Absence of caffeine is not proof of absence of all
stimulants. Existing approved per-variant facts remain in their existing
renderer; this change adds no new formulation assertion or serving arithmetic.

## Search targeting and baseline

Use the owner's18November Semrush UK snapshot: `abe pre workout`,5,400/month,
KD13, WheyWise position3. The ranking URL is UNKNOWN: the product description
and Pump traffic-share observation do not identify the same exact URL.
This is an estimate, not SupplementScout traffic or a forecast.

The four complete existing Growth Analytics artifacts cover19October–15November:
runs44166511050,44166516255,44166520996,44166526954. No historical rerun.
Both exact product URLs and their ABE query/page pairs are absent from the
capped returned rows: impressions/clicks/CTR/position are UNKNOWN, not zero.
Per-page GA4 organic sessions and retailer_offer_click baseline are UNKNOWN
in these artifacts. Site-wide9,661 impressions/74 clicks are context only.
Latest existing run44186080465 still reports incomplete16November; no newer
complete artifact was available at preflight. Query caps100/week and page-query
caps250/week plus privacy apply; these GSC reports are not UK-market volume.

Consequently this is a clarity intervention, not a claim to own generic ABE
searches. Standard and Pump titles/descriptions are unchanged. After a future
owner-approved deployment, record its exact time/SHA and inspect the first7
and28 complete settled days, excluding the partial deployment day. Compare
page/query impressions, clicks, CTR and position for both cards, existing GA4
organic landing metrics and retailer_offer_click where available, and existing
read-only indexing evidence. Record UNKNOWN when dimensions are unavailable.
No new event, report, schedule or Google submission. SEO-20's clock and minimum
28settled-day/500page/300brand-query thresholds remain untouched.

## Verification and actual-source QA

Existing test inventory remains369 files; reviewed inventory seal is unchanged
because tests were extended inside the existing product-presentation suite.
Focused actual async-page tests exercise changing prices, exact Baddy Berry,
caffeine attribution, unknown shipping, missing facts, stale/OOS/empty/failed
offers, metadata, tracked links and isolation from Pump/PER4M/unrelated cards.
Other existing pricing, offer-group, schema, nutrition, analytics and comparison
regressions remain included in the full gate.

Project Guardian, verify:quick, verify:full, TypeScript, ESLint and Next16.2.9
production build are required for the final Draft head. An initial isolated
build could not fetch Google Fonts; retry uses normal network access and the
system trust store, with production credentials still stripped by quality-gate.
No TLS verification bypass or application/config change was introduced.

Manual QA uses two local production builds, before/after, with the same real
sources and a transport allowing only GET/HEAD to existing Supabase tables.
This is not a preview/production deployment and fixtures are not live evidence.

- HTTP200, metadata/canonical/robots/schema parity and existing offer-link
  parity pass for ABE base/1672. The new comparison link resolves both product
  IDs with noindex/follow and the correct canonical.
- Pump base/763, Myprotein Clear Whey, CNP Creatine, PER4M product and PER4M
  hub retain identical visible text and metadata/schema in paired source reads.
- Chrome1440/390px: ABE base/1672 and control cards pass readable layout,
  no horizontal overflow or clipping/section overlap, no runtime/HTTP errors.
  New links have correct destinations and keyboard order; screenshots reviewed.
- Six alternating warm samples per build: median full HTTP response elapsed
 863.0ms before,695.4ms after; unchanged guard is after<=before*1.5+100ms.
  This is not a production TTFB or field Core Web Vitals improvement claim.
- Each measured exact-variant request made7 GETs in both versions. Existing
  cache/request behaviour is preserved; zero warm reads is not claimed.
- No outbound /go navigation was performed: it can record outbound_clicks.
  Existing tracked href/variant parity and safe analytics tests verify that
  contract without inserting production analytics or catalogue data.

Raw readback/HTTP/Chrome evidence and screenshots remain ignored under
`.worktrees/seo27-abe-product-intent-20261118/tmp/`; no secrets are committed.
The final command results and exact head are recorded on merged PR #547.

## Release boundary

The later explicit owner production approval supersedes the original Draft-only
restriction. The approved release and positive public readback are recorded
above. This closeout edits documentation only; verify its final main deployment
and public build/content again before handoff. It grants no next implementation.
SEO-20 is frozen; SEO-21–26 remain LIVE VERIFIED; SEO-15 Stage3 stays disabled.
No homepage, Clear Whey, importer, workflow, nutrition, mapping, offer or price
history modification is included.
