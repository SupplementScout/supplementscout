# SEO-29: Myprotein Clear Whey buying clarity

Status: **LIVE VERIFIED** after owner-approved merge, Production and public readback.
Base: `2794c555bb12a25dbdd1ad7552ebf4d3f1f5c74c`.

## Owner-approved Production closeout — 18 November 2026

The later explicit release approval supersedes the Draft-only boundary below.
PR [#549](https://github.com/SupplementScout/supplementscout/pull/549) merged at
2026-11-18T15:15:58Z. Approved592960a91db61589bb7d1f3bd4184157e4d45253 became
reviewed3a2e2d8a403b0f837baedfb22c0863bf56a3b937 solely through a test-clock
fix. The unchanged caffeine loader's fixture expired at15:00UTC on18Nov; the
failure was reproduced on base main. The test now uses its fixture date through
the existing Node test clock. No application code, data, freshness limit,
assertion or test skip was weakened.17/17 targeted and45 presentation cases pass.

Squash/main release: `645d6c51698c524185cfc9d9e48cdda40391bbd3`, exact reviewed tree parity.
GitHub Production deployment `7887440889` and Vercel
`dpl_7XbCxA3ZBp3nTUdMxEvXUGEcxuUB` report SUCCESS at `2026-11-18T15:16:57Z`.
Public build `uqJ4jcOCjbjSdrHsZAaHr` changes to
`6jOjXHHkhMo4PGIhR-a3i`; first target proof `2026-11-18T15:17:12.270Z`,
complete16-route readback `2026-11-18T15:19:27.024Z`. This combines exact-commit GitHub/
Vercel evidence with actual custom-domain HTML. It does not claim private API
READY access: previous API403 and Preview SSO are retained, never bypassed.
Final documentation-only main SHA/CI/Production proof is recorded on merged
PR #549 after that final deployment; its application sources remain identical.

### Fresh real data and public HTML

Read-only catalogue/resolver snapshot `2026-11-18T15:17:06.905Z`, public binding
proof `2026-11-18T15:19:29.257Z`. Both variants are active single packs, resolved to1470,
in stock and younger than the existing24h limit at verification. Values below
are dated observations, not application constants or independent checkout quotes.

|Exact variant|Offer / mapping|Retailer|Product + delivery = total|Offer checked UTC|
|---|---|---|---|---|
|4649 Peach Tea, 244g|4647 / 4834|Holland & Barrett|£17.00 + £3.49 = £20.49|2026-11-17T17:48:48.656+00:00|
|4633 Orange Mango, 261g|4631 / 4818|Holland & Barrett|£17.00 + £3.49 = £20.49|2026-11-17T17:48:48.656+00:00|

Only one tracked retailer is stated;244g/261g are never treated as500g. Stored
destinations identify the exact two H&B packs. Nutrition candidates approved0,
empty variant overrides and false product verification flags remain unchanged;
numeric cost25g is absent. Public initial HTML preserves the approved summary,
exact variant labels, delivery explanations/check date and crawlable isolate
link. Flavour selection keeps go/4647 and go/4631 with product_offer_list;
primary product_best_offer links are unchanged. Safe HEAD204 only, no outbound
retailer GET, purchase, synthetic retailer click or production-data write.

The requested description appears once in each HTML/OG/Twitter field on all
three target addresses. Title, one H1, canonical to base and existing default
index/follow remain unchanged. Base retains BreadcrumbList without ambiguous
Product schema; exact variants retain Product/AggregateOffer plus BreadcrumbList,
with source-bound prices and the approved factual summary description. No new
Review, rating, nutrition,500g or metadata-as-schema claim appears. Robots and
all1,487 unique sitemap addresses match baseline, with one target canonical.
No new route or parameter indexability rule was introduced.

All16 public routes pass SEO contracts. Controls: Impact Whey Isolate, Applied
Clear Whey, ABE, PER4M card/hub, CNP Creatine, homepage, whey-protein/isolate,
creatine under20 and representative SEO-22/26 guides. The scoped helper's
negative tests also preserve standard Impact Whey; no active public standard
Impact URL was invented. Exact frozen PER4M title/H1, unchanged metadata and
schema entity rules pass. SEO-20 and SEO-21–28 ledger rows are byte-for-byte
unchanged; their runtime sources and lifecycle are untouched.

### Fresh gates and public responsive QA

Fresh quick1,331 scheduled:1,328 PASS,3 existing legacy10Reps fixture skips,
0 FAIL. Full4,068 scheduled:4,065 PASS,3 identical skips,0 FAIL. TypeScript,
ESLint, migration baseline, Next16.2.9 production build and manifest369/seal
2bfb325c9c18f95e45a4d596f7bd7c80a33199cbcef3dbc91c29d8518b0e27b8 pass.
Project Guardian passes before/after closeout; its negative contracts pass.
PR/main required CI is green. Isolated DB/integration job stays outside this
credential-free gate and retains its existing workflow skip.

Public base/Peach/Orange ×1440/390/320px:9/9 PASS. No clipping, overlap, new
horizontal overflow, runtime exception, HTTP4xx/5xx or focus failure. Existing
flavour-button selection and visible keyboard focus work. Analytics collection
was blocked, nonessential consent rejected and offer links were never followed.
Screenshots: [1440px](seo29-clear-whey-2026-11-18/production-1440.webp),
[390px](seo29-clear-whey-2026-11-18/production-390.webp),
[320px](seo29-clear-whey-2026-11-18/production-320.webp).

### Performance and reads

Public warm TTFB: five retained samples after an initial warm-up per route;
same existing before×1.5+100ms guard, unchanged. DNS/connection errors are
recorded separately and excluded from application timings. Network error count
in this run:0.

|Public route|Baseline median TTFB|Production median TTFB|Existing guard|
|---|---:|---:|---|
|/product/myprotein-clear-whey-protein-isolate|1176.6ms|1131.0ms|PASS|
|/product/myprotein-clear-whey-protein-isolate?variant=4649|1402.7ms|1258.1ms|PASS|
|/product/myprotein-clear-whey-protein-isolate?variant=4633|1529.2ms|1185.0ms|PASS|
|/product/myprotein-impact-whey-isolate-powder|1161.5ms|1104.8ms|PASS|
|/product/applied-nutrition-abe-ultimate-pre-workout-315g|1167.4ms|929.4ms|PASS|
|/brands/per4m|190.5ms|194.2ms|PASS|
|/|644.7ms|599.4ms|PASS|

Paired actual-source local production builds use GET-only interception and
five warm alternating samples per build/route. These are instrumented local
read counts/full HTTP durations, not Production database telemetry or TTFB.

|Route|Before full response|After full response|GETs each request|
|---|---:|---:|---|
|/product/myprotein-clear-whey-protein-isolate|800.3ms|740.8ms|7→7|
|/product/myprotein-clear-whey-protein-isolate?variant=4649|802.6ms|755.8ms|9→9|
|/product/myprotein-clear-whey-protein-isolate?variant=4633|756.3ms|731.9ms|9→9|

Existing cache/query mechanics and client architecture remain unchanged. Public
browser asset/LCP/CLS diagnostics are laboratory observations only; no field
Core Web Vitals or organic traffic improvement is claimed. Raw JSON, HTML,
read traces, CI/production authority and viewport PNGs remain in ignored
`.worktrees/seo29-clear-whey-intent-20261118/tmp/release-seo29/`.

SEO-29 is LIVE VERIFIED after these public checks. SEO-20 remains frozen with
its original clock/thresholds; SEO-21–28 remain LIVE VERIFIED and Stage3 disabled.
No catalogue, offer, nutrition approval, mapping, price history, importer,
migration, workflow or analytics/GSC schedule change occurred. No Google URL
submission or SEO-30. Google indexing is UNKNOWN, not inferred from publication.
Keep existing7/28 complete-day checks from the production success timestamp;
the first complete UTC day is19Nov2026 (7-day window19–25Nov,28-day19Nov–16Dec).
No new reporting job is started.

## Historical Draft implementation and evidence

The sections below preserve the earlier review checkpoint. Their Draft-only
release wording is superseded by the explicit approval and verified release above.

## Bounded implementation

Reuse `productPresentation.ts` and the existing async product renderer. The
guard requires product1470, exact slug/name, Myprotein, Whey Protein and powder;
null/changed identity fails closed. This cannot apply to Impact Whey/Isolate,
other brands' Clear Whey, ABE or PER4M. No catalogue correction or new CMS.

The existing Product summary now identifies a whey isolate protein powder,
distinguishes flavour-specific weights, lists current packs and tracked retailer
count from already-loaded offers, explains delivery/verification limits and
links to the existing `/whey-isolate`. No new hero block or product layout.
The scoped display list requires a matching variant ID, known powder/single-pack
mass/label, price and retailer ID. It reuses existing label/pricing helpers;
it does not resolve or approve a new mapping. Existing freshness/stock rules
exclude stale/OOS offers; unavailable data yields a useful honest fallback.
Prices, availability and check dates stay in the existing dynamic offer UI.

No new query, client component, dependency, image in the application, API,
nutrition resolver, cache/revalidation rule, importer, migration or review.
No taste/health/lactose/sugar claim, author, rating or brand affiliation claim.

## Actual-source evidence — 18 November 2026

At13:12:18.799UTC, the existing bounded read-only catalogue/resolver confirmed
product1470 with the complete expected identity and two active mapped powders.
There are no approved nutrition candidates for this product; both variant
overrides are empty and product nutrition/unit-pricing flags are false.
No500g pack or serving/protein value is inferred.

| Exact variant | Offer / mapping | Retailer | Product + delivery = total |
| --- | --- | --- | --- |
|4649 Peach Tea,244g,1 pack |4647 /4834 | Holland & Barrett | £17.00 + £3.49 = £20.49 |
|4633 Orange Mango,261g,1 pack |4631 /4818 | Holland & Barrett | £17.00 + £3.49 = £20.49 |

Both checks: `2026-11-17T17:48:48.656+00:00`, in stock and within the existing
24-hour freshness limit at QA. Stored destinations identify the exact
[Peach Tea244g](https://www.hollandandbarrett.com/shop/product/clear-whey-isolate-peach-tea-244g-6100004985)
and [Orange Mango261g](https://www.hollandandbarrett.com/shop/product/clear-whey-isolate-orange-mango-261g-6100004984).
These are dated catalogue observations, not independent checkout quotes or
application constants. Delivery is never assumed free; cost25g stays absent
without approved exact-variant nutrition. No production-data write occurred.

## SEO decision and validation

Keep title/H1 **Myprotein Clear Whey Protein Isolate**. The later explicit owner
correction replaces the generic meta description for exact product1470 with:

> Compare Myprotein Clear Whey Protein Isolate prices in the UK. Check available flavours, exact pack sizes, retailer offers and known delivery costs.

The existing productPresentation helper uses the same complete identity guard.
generateMetadata already shares its description with Open Graph and Twitter,
so all three fields use this exact text. Other products keep the original
description path. This correction changes no title/H1/canonical/robots/sitemap,
schema or existing Product summary. No further research, competing URL or new
indexable route is introduced. New-head tests/CI and actual rendered metadata
are recorded on the existing PR #549.

Initial HTML contains the new summary, real variant labels and crawlable isolate
link. Except the three owner-approved description fields, metadata/H1/canonical/
robots and1,487-URL duplicate-free sitemap match baseline; the product canonical
occurs once. Base with two
different variants still has BreadcrumbList without ambiguous Product schema.
Exact-variant routes retain Product/offer rules and unchanged price/identity
fields; only factual Product.description follows the new visible summary.
No Review/AggregateRating is introduced.

- 43 focused cases pass. Quick1,331 (1,328 pass/3 existing skips), full4,066
  (4,063 pass/3 same skips), TypeScript, ESLint, migration baseline and Next16.2.9
  production build pass. Legacy10Reps artifact-dependent skips are unchanged.
  No test filename changes: inventory369 and seal2bfb325c… remain valid.
  Guardian runs before/after ledger evidence; negative contracts are preserved.
- Actual-source paired local production builds return200 for canonical and
  both exact variants. Unknown delivery, missing nutrition, malformed/unresolved
  packs, stale/OOS, empty/error and multiple-retailer states have regression
  coverage. Numeric25g costs cannot be invented from missing data.
- All nine candidate layouts (1440/390/320px × base/Peach/Orange) pass visual
  review, no clipping/overlap/new overflow, visible keyboard focus and no
  runtime/HTTP errors. Existing flavour buttons select go/4647 for Peach and
  go/4631 for Orange with the unchanged product_offer_list source. Primary
  links retain product_best_offer. Safe HEADs return204; no outbound GET or
  synthetic retailer click was sent.
- Impact Whey Isolate1469, Applied Clear Whey338, ABE215, PER4M and the isolate
  hub retain identical visible text/metadata. Homepage source and SEO-28 block
  remain unchanged; its metadata/parity checks pass. Synthetic identity tests
  also cover standard Impact Whey. No other route is modified.

| Paired warm full HTTP response | Before | After | GETs each request, before→after |
| --- | ---: | ---: | --- |
| Base | 694.2ms | 689.0ms |7→7 |
| Peach4649 | 638.9ms | 633.4ms |9→9 |
| Orange4633 | 656.8ms | 724.0ms |9→9 |

Six alternating warm samples per build/route pass the existing
before×1.5+100ms guard. Counts are instrumented local actual-source requests,
not Production DB telemetry. Cache/query mechanisms are unchanged. No client
code is added; generated loaded JS differs by−3B, consistent with build module
identifiers. Local CLS0; browser LCP/interaction data are laboratory diagnostics,
not field CWV improvement claims.

Screenshots: [desktop before](seo29-clear-whey-2026-11-18/before-1440.webp),
[desktop after](seo29-clear-whey-2026-11-18/after-1440.webp),
[mobile before](seo29-clear-whey-2026-11-18/before-390.webp),
[mobile after](seo29-clear-whey-2026-11-18/after-390.webp),
[320px after](seo29-clear-whey-2026-11-18/after-320.webp).
Raw HTML, read traces, source proof and all18 before/after PNGs remain ignored
under `.worktrees/seo29-clear-whey-intent-20261118/tmp/` on the shared workspace.

## Existing measurement and release boundary

Use the completed18Nov Keyword Gap evidence only: supplied Semrush UK estimate
myprotein clear whey4,400/month, KD14, WheyWise estimated position6. These are
external estimates, not GSC evidence or a traffic promise; no review is invented.
Saved complete Growth Analytics reports19Oct–15Nov (runs44166511050,
44166516255,44166520996,44166526954) contain no matching exact-card/query rows.
Caps100 pages/100 queries/250 page-query pairs mean impressions, clicks, CTR and
position are **UNKNOWN**, not zero. Exact-card organic landing sessions and
retailer_offer_click are also UNKNOWN in existing reporting. Latest scheduled
run44186080465 ends16Nov but is not a complete replacement week; no new analytics
job, integration, workflow or schedule was introduced.

After separate owner release approval, retain7/28 complete post-release-day
checks for the exact card/query, landing sessions, retailer clicks and adjacent
Myprotein/whey pages. Do not attribute all changes to this copy. No GSC submission.
SEO-20 stays frozen with its original clock/thresholds; SEO-21–28 stay LIVE
VERIFIED and Stage3 disabled. Guardian needs no new active-pair exception:
SEO-29 is CODE COMPLETE review material. Production retains the old summary
until a separately approved merge/deployment.
