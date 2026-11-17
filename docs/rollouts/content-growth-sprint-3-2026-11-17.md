# Content Growth Sprint 3: budget protein and caffeine-free pre-workout

17 November 2026. Supporting implementation and review evidence for SEO-23;
the Operating Plan remains authoritative and the SEO Execution Plan is the
sole task ledger. Scope: two guides in one Draft PR. This record grants no
merge, production publication, indexability launch, data write or next sprint.

## Preflight and data qualification

Fresh GitHub reads confirmed main
`73f3c473e665df5862eb0fe92a5eefa4c1658656`. The only open PRs were unrelated
Drafts #532 and #33; neither proposed guide or equivalent budget guide exists.
The existing caffeine-free search is reused, not replaced. Sprint 1/2 packs,
current governance/lifecycle and installed Next.js 16.2.9 Server Components and
metadata documentation were read. No competitor research was repeated.

A bounded, GET/HEAD-only existing-source audit returned all 15 matching
protein products within a 61-product ceiling, and sampled 21 of 68 approved
caffeine-absence candidates. Candidate approval alone did not qualify a
product: the existing applied-fact reader checked exact variant overrides and
approved evidence. Both topics qualify; no fallback topic is necessary.
No production product, price, nutrition, candidate or mapping write occurred.
Raw candidates, private source locators and credentials are not archived here.

The [actual-source readback](content-growth-sprint-3-2026-11-17/actual-source-readback.json)
at 16:55 UTC uses the actual page selectors and existing live readers, with
no synthetic offers. These are dated observations, not prices hardcoded into
the pages. All five offers were in stock and checked within the shared 24-hour
window; product links retain their exact variant IDs.

| Guide | Exact variant | Retailer | Product | Delivery | Total | Last checked UTC |
|---|---|---|---:|---:|---:|---|
| Under £30 | BioTech USA Pure Whey 454g Hazelnut, 949 | Fit House | £15.99 | £3.99 | £19.98 | 17 Nov 11:11:52 |
| Under £30 | Optimum Nutrition Plant Protein 684g Vanilla, 1623 | Dolphin Fitness | £21.95 | £3.95 | £25.90 | 17 Nov 14:42:16 |
| Under £30 | CNP Premium Whey 900g Chocolate Peanut Butter, 1318 | Jon's Supplements | £25.99 | £3.99 | £29.98 | 17 Nov 13:54:47 |
| Caffeine-free | Nutrend Pump 225g Bubble Gum, 1848 | eBay UK | £18.50 | £0.00 | £18.50 | 17 Nov 14:57:16 |
| Caffeine-free | Applied Nutrition ABE Pump 500g Tigers Blood, 763 | eBay UK | £29.95 | £0.00 | £29.95 | 17 Nov 14:57:29 |

None of the three budget flavours has qualifying reviewed protein nutrition;
all three explicitly withhold cost per 25g instead of borrowing another
flavour's data. Their delivered cash comparisons remain valid. Both selected
pre-workout variants have approved **and applied** `confirmed_absent` caffeine
facts with manufacturer-source provenance. Numeric amounts remain null, not
an invented zero. Other ingredient doses, effectiveness and medical suitability
are not claimed. Existing public product pages independently show the same
selected variants and confirmed-absence ingredient states.

## Content, discovery and lifecycle

- `/guides/protein-powder-under-30`: title **Protein Powder Under £30 UK:
  Compare Delivered Prices**. It answers a fixed delivered cash-budget question
  with three different brands/packs. It explains cash outlay versus protein
  unit value, pack/flavour identity, delivery terms and missing nutrition.
  `/whey-protein` remains the broader category comparison, Help Me Choose the
  interactive shortlist, and the existing cost-per-25g guide the unit method.
- `/guides/caffeine-free-pre-workout`: title **Caffeine-Free Pre-Workout UK:
  How to Check and Compare**. It explains confirmed absence versus the other
  four information states and compares two proven exact variants. The existing
  `/pre-workout` hub and search filter retain catalogue discovery; this guide
  adds evidence interpretation, purchase examples and limitations.

Both use BuyingGuide/GuidePriceBreakdown, one H1, logical sections, initial
server HTML, factual WebPage/BreadcrumbList JSON-LD, self-canonicals and the
central robots/cache/error contracts. No Article/FAQ/review markup, invented
publication date or ratings. This is an intent/content distinction, not a
claim of proven traffic uplift or measured absence of future keyword overlap.

One contextual crawlable link was added from `/whey-protein` to the budget
guide and one from `/pre-workout` to the caffeine guide. Existing SEO-22 links
remain. Outgoing links reuse product pages, comparisons, the current caffeine
filter, Help Me Choose and existing method/delivery/freshness explanations.

Both entries are **planned**, base and parameter variants are **noindex,
follow**, and both are excluded from the generated sitemap. Sitemap candidates
are registered exactly once for a later authorized launch. Successful empty
results retain useful editorial guidance; unknown shipping, stale/OOS offers,
wrong identity/packs and missing or mismatched caffeine proof cannot appear as
qualifying examples. Read failures throw through the existing lifecycle error
contract instead of caching fabricated success/empty data.

The only shared reader change is an optional strict error mode on
`loadAppliedPreWorkoutFacts`; existing callers retain their original default.
The guide uses this mode to distinguish a failed evidence read from no proof.
No second resolver, data pipeline, CMS, calculator, dependency or filter exists.

## Verification

The [quality summary](content-growth-sprint-3-2026-11-17/quality-summary.json)
records 49 focused checks, `verify:quick`, `verify:full` (4,004 passing safe
tests), TypeScript, ESLint, Project Guardian, baseline migration validation and
the Next.js production build: **PASS**. Inventory resealed at 366 files:
305 safe, 57 isolated integration, 4 artifact-bound; 65 quick smoke files.
Integration jobs were not run and no production credentials reached gates.

Coverage includes exact flavour/pack/parent identity, inclusive £30 delivered
boundary, unknown versus zero shipping, stale/OOS/invalid timestamps, applied
caffeine proof and all excluded information states, missing nutrition, failed
reads, cache ageing, SSR, metadata/parameters/schema, sitemap and governance
negative cases. Synthetic unit fixtures are test-only, not live evidence.

An actual Next production build was run locally with the existing authorized
source, a GET/HEAD-only table allowlist and zero writes. It is **not a public
deployment**. [HTTP contracts](content-growth-sprint-3-2026-11-17/local-http-contracts.json)
confirm both 200s, real example prices/check times in initial HTML, one H1,
base/parameter noindex/follow, self-canonicals, factual schema, exactly one
incoming link each and zero new sitemap URLs. Existing protected URLs remain
in the generated sitemap exactly once.

[Chrome 157 desktop1440 and mobile390 touch QA](content-growth-sprint-3-2026-11-17/local-browser.json)
passes real viewport scale, card fit, no horizontal clipping/card overlap,
keyboard link order and zero runtime/HTTP errors. Manual screenshot review
confirms legibility. CLS is 0 in all four samples; warm lab LCP 148–452ms.
Screenshots: [budget desktop](content-growth-sprint-3-2026-11-17/protein-budget-1440.png),
[budget mobile](content-growth-sprint-3-2026-11-17/protein-budget-390.png),
[caffeine desktop](content-growth-sprint-3-2026-11-17/caffeine-free-1440.png),
[caffeine mobile](content-growth-sprint-3-2026-11-17/caffeine-free-390.png).

[Public link checks](content-growth-sprint-3-2026-11-17/existing-public-links.json)
and [exact selected-variant checks](content-growth-sprint-3-2026-11-17/existing-public-variants.json)
pass on the already deployed site. PER4M's exact title/H1/canonical/robots,
Creatine's under-20 section and both SEO-22 guide contracts remain intact.
Their route sources and the SEO-20 experiment file are byte-identical to main.
SEO-20's clock/gates/schedule, SEO-21/22 live status, Stage3 disabled state and
GYM HIGH deferred hub decision are unchanged.

## Performance and data cost

[Production-build loopback measurements](content-growth-sprint-3-2026-11-17/local-performance.json)
use one cold request and five warm requests per route:

| Route | Cold TTFB ms | Cold DB reads | Warm median TTFB ms | Warm DB reads |
|---|---:|---:|---:|---:|
| Methodology baseline | 245.8 | 0 | 26.3 | 0 |
| Protein under £30 | 1358.0 | 2 | 57.7 | 0 |
| Caffeine-free | 586.3 | 3 | 31.8 | 0 |
| Existing delivery guide | 468.3 | 2 | 35.0 | 0 |
| Existing protein-cost guide | 475.1 | 2 | 31.4 | 0 |

The earlier same-machine baseline medians were 23.1/32.3/34.7ms for methodology,
delivery and protein-cost respectively. These small samples show no material
persistent existing-page regression; the new routes have no previous public
version. They do not establish field CWV or INP.

Protein uses the existing two catalogue/resolver batches for three pinned
products. Caffeine uses the same two batches for two products plus one
existing approved-fact batch for those two parent IDs. In the independent
source capture the extra batch was 57,466 decoded bytes and 254ms; no N+1.
All successful data shares the existing hour-bucketed, at-most-3600-second
cache; five warm requests per route caused **zero additional DB reads**.
Offer freshness is still checked at render time. No cache/architecture rebuild
is warranted by this evidence.

[Client manifests](content-growth-sprint-3-2026-11-17/client-artifacts.json)
confirm the pages are server components. Project client entries are only the
existing shared consent/shortcut components and thin lifecycle error wrappers,
as with SEO-22. No guide calculator, chart, image or client data loader was added.

## Exact owner decision required for publication

SEO-23 is **CODE COMPLETE**, not LIVE VERIFIED. This branch is Draft-only.
To launch both guides, the owner must separately approve:

1. Only these two registry entries: `planned` → `launch_approved`, with the
   corresponding existing lifecycle/sitemap contract expectations updated.
   Central helpers then provide base index/follow and exactly one canonical
   sitemap URL each; parameters retain noindex/follow. No new sitemap system
   or route-local robots change is needed.
2. Required checks, Ready for Review, guarded squash merge and automatic Vercel
   production release of the reviewed PR head.
3. Immediate actual public 200/commit/robots/canonical/sitemap/schema/data/link,
   desktop1440/mobile390 and performance readback. Only after it passes may the two
   lifecycle entries become `live_verified` and SEO-23 become LIVE VERIFIED.
   A real regression stops closeout; retain the previous production release
   for the existing owner-authorized rollback procedure. No data repair is
   implicitly authorized.

The owner will submit URLs in Google Search Console manually after publication.
No Search Console submission, indexing request, new Google integration,
production deployment or next sprint was executed by this Draft sprint.
