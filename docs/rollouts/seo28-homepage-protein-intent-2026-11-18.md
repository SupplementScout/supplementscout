# SEO-28: homepage protein-comparison intent

Status: **CODE COMPLETE — READY FOR PUBLICATION REVIEW**. Owner authorizes one
Draft PR only. Base: `92091e13e654e9a1f25746cd997dc3d01b114fa1`. Final head,
PR/CI and protected Preview result are recorded on the Draft PR. No merge,
Production deployment, Google submission or SEO-29 is authorized.

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

## Validation — 18 November 2026

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
After a separately approved release, check7 and28 **complete post-release days**
using existing Growth Analytics: homepage/non-brand query impressions, clicks,
CTR/position, related protein pages and retailer clicks. No schedule or GSC
submission now; do not attribute all future traffic to this change.

SEO-20 remains frozen IN PROGRESS with its original clock/thresholds;
SEO-21–27 remain LIVE VERIFIED. SEO-15 Stage3 remains disabled. Guardian needs
no exception: SEO-28 is CODE COMPLETE review material, not a second IN PROGRESS
task. Public homepage readback at11:59UTC returns200 with no SEO-28 block.
Production remains the approved baseline; this record makes no live-launch claim.
