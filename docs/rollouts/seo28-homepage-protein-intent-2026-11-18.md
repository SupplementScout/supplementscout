# SEO-28: homepage protein-comparison intent

Status: **LIVE VERIFIED — owner-approved Production release**.
Base: `92091e13e654e9a1f25746cd997dc3d01b114fa1`.
Approved head: `10dfa02d974054bbace5c09467239ad98be28ff0`.
The later explicit owner instruction authorizes Ready for Review, squash merge,
automatic Production and verified closeout. Earlier Draft-only restrictions
below are historical. No Google submission, Clear Whey or SEO-29 is authorized.
Final documentation-only main SHA/CI/deployment are recorded on merged PR #548
to avoid embedding a self-referential commit hash in this record.

## Production release — 18 November 2026

- [PR #548](https://github.com/SupplementScout/supplementscout/pull/548)
  squash merged at12:39:17UTC as `2b48c4b73bbb0aa17814f92dfcd749ea37002606`.
  Its complete tree matches the approved head; no runtime fix was needed.
  Existing GitHub controls were retained.
- Fresh quick1,331/full4,059 scheduled cases, TypeScript, ESLint and Next16.2.9
  build pass: full4,056 passed/3 existing legacy fixture skips/0 failures.
  [Main Quality Gate](https://github.com/SupplementScout/supplementscout/actions/runs/44305983386)
  and [Guardian](https://github.com/SupplementScout/supplementscout/actions/runs/44305983466)
  pass; PR GitGuardian passes. The integration job retains its existing isolated
  workflow skip; no new skip or production-write credential was added to gates.
- Exact GitHub Production deployment7883508663 and [Vercel Production](https://vercel.com/supplement-scout/supplementscout/4iwEC4GX5BQizKP2PiE9FpcLmDGv)
  report SUCCESS at12:40:18UTC. Public build changes from
  `G5rZE-n-tlTYR8szQzAT0` to `GcAMDDlZE-2hHGYdLaWvx`.
  First positive public homepage proof:12:40:27.542UTC. Full18-route public
  readback:12:42:05.402UTC. Existing API403/Preview SSO protections are retained.
- Homepage200 contains the approved section/H2 and five anchors in initial
  HTML, after category/deal navigation. One H1 and all metadata, OG/Twitter,
  canonical, effective index/follow and schema contracts match baseline.
  Robots and the duplicate-free1,487-URL sitemap match baseline. All five
  destinations, PER4M, creatine/under-20, ABE base/1672 and all ten guides pass.
- GET-only source evidence verifies featured product788/variant1075,
  Chocolate2400g, three exact mapped offers, in-stock/fresh dates and sums:
  Whey Okay33.57+3.99=37.56; Holland & Barrett38.00+0=38.00;
  Gladiator Nutrition33.00+6.99=39.99 GBP. Existing verified metrics2.35/serving,
  1.40/25g protein and16 servings match the existing calculator. All three
  secondary cards' exact-variant delivered totals/savings also match source.
  These are dated evidence snapshots, not hardcoded application prices.
- Public Chrome1440/768/390/320px passes visual review against Draft screenshots:
  no clipping/overlap/new overflow, runtime or HTTP errors. Hero/search/featured/
  categories have identical bounds and existing comparison text/links. Keyboard
  order and visible focus pass; category expansion works; native search renders
  72 product links for creatine. Existing tracked hrefs and three safe HEAD204
  checks preserve the click contract without synthetic retailer clicks.
- CLS is0 before/after, including scrolling. Production LCP samples after
  release:1768/2096/1036/1072ms by width; these are lab diagnostics, not field
  CWV improvement claims. The EKM image works publicly at every width; the old
  local NAT64/SSRF restriction is kept separate and was not weakened.
- Initial client script URLs and shared asset bytes are identical. One desktop
  run additionally prefetched an existing13,700B My Supplements route chunk;
  it is absent from initial HTML, exists in the baseline build and adds no new
  homepage client logic. Other widths load identical540,389B totals.
- Fresh actual-source local builds retain cold12→12 (10 GET/2 HEAD) and warm
  3→3 across six requests each; warm full-response medians370.3→347.4ms.
  Source/cache/revalidation remain unchanged. Public warm timing below excludes
  failed DNS attempts; DNS errors0. Each route passes before×1.5+100ms.

| Public warm median TTFB | Before | After |
| --- | ---: | ---: |
| Homepage | 657.4ms | 723.3ms |
| PER4M | 201.0ms | 210.6ms |
| Whey Protein | 251.1ms | 260.6ms |
| Creatine | 255.4ms | 236.6ms |
| ABE | 1213.1ms | 1538.8ms |

Production screenshots: [desktop1440](seo28-homepage-2026-11-18/production-1440.webp)
and [mobile390](seo28-homepage-2026-11-18/production-390.webp).
Raw HTML, read-only source checks, DNS/connect/TLS traces, four-width PNGs,
browser measurements and readiness proof remain ignored under the shared
worktree's `tmp/release-20261118/`. Documentation closeout changes no runtime
source. Its final SHA/CI and subsequent automatic Production readback are on
merged PR #548. SEO-20 remains frozen, SEO-21–27 LIVE VERIFIED, Stage3 disabled;
no production-data, analytics schedule, Google or next-sprint write occurred.

## Bounded change

One inline Server Component section in `app/page.tsx`, after existing category
and current-deal navigation, adds a real H2 and two short decision explanations.
The primary whey comparison link is followed by contextual isolate/vegan
alternatives; budget and verified-protein-cost guides are subordinate.
Exact flavour, size, pack count, known delivery and exact-variant verified
servings/protein evidence explain value beyond the existing category directory.
The cheapest pack is explicitly distinguished from the cheapest protein.
The existing Protein card is one anchor, so nesting these decisions inside it
would create invalid links. Extending the category directory would add client
code. Inline static server HTML preserves both existing mechanisms.

The broad H1/hero, search, Featured Comparison, other categories and discovery
sections remain intact. No new page, price/ranking, image asset in the product,
client component, API, abstraction, dependency, loader or CSS source file.
No global metadata, OG/Twitter, canonical, robots, schema, lifecycle or sitemap
change. Product/variant/nutrition/mapping/importer/history/workflow data and
production writes remain outside scope.

## Original Draft validation — 18 November 2026

- Project Guardian before/after status evidence; quick **1,331** scheduled
  cases (**1,328 pass**,3 existing skips), full **4,059** (**4,056 pass**,3 same
  skips), TypeScript, ESLint, migration baseline, Next16.2.9 production build
  and43 focused homepage tests pass. Skips are existing legacy10Reps artifact
  cases with missing fixtures. No tests/protections disabled. Test filenames
  are unchanged; inventory369 and seal2bfb325c… remain valid.
- Actual production builds of base and candidate use the existing catalogue
  through a local GET/HEAD-only guard; all writes are rejected. Fixtures used
  by unit tests are not production evidence. New advice survives empty/failed
  data; no price or nutrient value is invented.
- Both homepage responses return200, retain one H1, identical metadata,
  self-canonical, indexability and schema. New H2/copy/all five ordinary anchors
  are in initial HTML. All five destinations return200. Robots are identical;
  sitemap contains the same1,487 URLs, including one canonical homepage.
- Paired controls preserve SEO/HTTP contracts for PER4M, ABE, creatine and all
  ten SEO-22–26 guides. Existing featured product/variant/offer links and text
  are identical. Three tracked `/go/…?source=product_best_offer` HEADs return204;
  no outbound GET or synthetic click insertion. Existing analytics tests pass.
  Browser search submits to `/search?q=creatine` and renders results; category
  expansion works. No catalogue or analytics data is written.
- Chrome at **1440,768,390,320px**: readable copy, no new overflow/clipping or
  overlap, unchanged hero/search/featured/category bounds and navigation.
  Keyboard order and the existing3px visible focus ring pass. No runtime
  exception or new application error. Screenshots visually reviewed.
- Local DNS supplies NAT64 addresses for the existing EKM featured image;
  Next's unchanged SSRF guard returns400 on both builds. This pre-existing
  environment limitation is recorded separately; no DNS/SSRF/Preview security
  was weakened and image availability is not claimed from local screenshots.

| Paired local measurement | Before | After |
| --- | ---: | ---: |
| Cold catalogue requests | 12 (10 GET,2 HEAD) | 12 (10 GET,2 HEAD) |
| Warm requests, each of8 samples | 3 GET | 3 GET |
| Median full warm HTTP response | 388.9ms | 308.2ms |
| Loaded JS, desktop / narrow viewports | 553,632 / 539,930B | 553,633 / 539,931B |
| Total emitted CSS | 101,971B | 102,161B |

No new client module/logic: the one-byte generated bundle variance includes
changed Turbopack module identifiers. Existing utilities add190B emitted CSS;
`home.css` is byte-identical. Cache keys/revalidation and all data mechanisms
are unchanged; the three warm reads are existing bounded enrichment/history.
Eight alternating samples per build pass the existing before×1.5+100ms guard.
Warm browser LCP before→after:1440px696→720ms,768px684→548ms,
390px452→472ms,320px344→420ms; CLS0→0 at all widths. Recorded keydown
interactions are16ms at1440/768/390px, with no entry above the16ms threshold
at320px. These are local diagnostics, not field CWV/INP or proof of a production
improvement; the CDN limitation further restricts LCP interpretation.

Review screenshots: [desktop before](seo28-homepage-2026-11-18/before-1440.webp),
[desktop after](seo28-homepage-2026-11-18/after-1440.webp),
[mobile before](seo28-homepage-2026-11-18/before-390.webp),
[mobile after](seo28-homepage-2026-11-18/after-390.webp).
Raw HTTP/read/browser evidence and all four-width PNGs remain ignored in
`.worktrees/seo28-homepage-protein-intent-20261118/tmp/` on the shared workspace.

## Existing measurement baseline and follow-up

Use the completed18Nov Keyword Gap evidence, not new competitor research.
Supplied Semrush UK snapshot: protein powder comparison5,400/month, KD40,
WheyWise homepage estimated position2. These are external estimates, not GSC
observations or a ranking/traffic promise.

Existing Growth Analytics reports for complete **19Oct–15Nov2026** give homepage
**439 impressions,19 clicks,4.33% CTR, approximately6.09 weighted position**.
Latest complete week9–15Nov:180/5,2.78% CTR, position7.37. Source runs:
44166511050,44166516255,44166520996,44166526954. Latest scheduled run44186080465
ends16Nov but reports incomplete final-date metadata; it is not a complete
replacement week. No new reporting or workflow is introduced.

| Existing GSC observation | Impressions / clicks | Position | Limitation |
| --- | --- | --- | --- |
| protein powder comparison | UNKNOWN | UNKNOWN | Missing capped row is not zero |
| compare protein prices | 7 / 0 | 11.14 | Observed query rows only; homepage pairing UNKNOWN |
| supplement price comparison → homepage | 5 / 1 | 2.80 | Observed page-query rows,3 weeks |
| whey-protein,9–15Nov | 137 / 3 | 17.54 | Full28-day total UNKNOWN |
| whey-isolate,9–15Nov | 126 / 1 | 53.33 | Full28-day total UNKNOWN |
| vegan-protein | UNKNOWN | UNKNOWN | Missing capped rows |

Query cap100/week and page-query cap250/week prevent exhaustive totals; no UK
country filter is implied. GA4 existing site totals:290 Organic Search sessions,
10 retailer-offer clicks;30 search.google.com/referral sessions are suspect,
so260 is a conservative signal, not proven external traffic. Homepage-specific
sessions/retailer clicks are UNKNOWN in the existing report.
Retain the existing7/28 **complete post-release-day** Growth Analytics checks:
homepage/non-brand query impressions, clicks, CTR/position, related protein
pages and retailer clicks. For the approved18Nov release the first complete
windows are19–25Nov and19Nov–16Dec, subject to GSC completeness. No schedule
change or GSC submission; do not attribute all future traffic to this change.

SEO-20 remains frozen IN PROGRESS with its original clock/thresholds;
SEO-21–27 remain LIVE VERIFIED. SEO-15 Stage3 remains disabled. Guardian needed
no Draft exception: SEO-28 was CODE COMPLETE, not a second IN PROGRESS task.
The original11:59UTC public homepage readback returned200 without the SEO-28
block. That Draft boundary is superseded by the later explicit owner release
approval and positive Production verification recorded above.
