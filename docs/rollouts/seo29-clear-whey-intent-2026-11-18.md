# SEO-29: Myprotein Clear Whey buying clarity

Status: **CODE COMPLETE — READY FOR PUBLICATION REVIEW**. One owner-approved
Draft PR only; no merge, Production deployment or SEO-30.
Base: `2794c555bb12a25dbdd1ad7552ebf4d3f1f5c74c`. Final head, CI and protected
Preview result are recorded on the Draft PR.

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

Keep title/H1 **Myprotein Clear Whey Protein Isolate** and the existing metadata
description unchanged. The title/H1 already identify the exact buying intent;
the capped GSC report has no exact-card/query row to justify a separate SERP
rewrite. The generic body is improved independently of metadata. No competing
URL or new indexable route is created.

Initial HTML contains the new summary, real variant labels and crawlable isolate
link. One H1, metadata/OG/Twitter/canonical/robots and1,487-URL duplicate-free
sitemap match baseline; the product canonical occurs once. Base with two
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
