# Content Growth Sprint 2: two buying guides

17 November 2026. Supporting implementation and release-review evidence only.
The Operating Plan remains authoritative and the SEO Execution Plan is the
sole task ledger. The owner authorizes one bundled Draft PR, code, tests and
necessary documentation. Merge, production publication and indexability
launch require a separate owner decision.

## Final content-quality revision in PR #542

The owner's follow-up authorizes only improvements to this existing Draft,
starting at `07e20cfd474687be5721026e818c1c95f99304c1`. Fresh main remains
`6eb2944e3ad5b4432f2a423e5c9f4bc45946b269`. SEO-22 returns to `CODE COMPLETE`
after the following revised local and actual-source checks. Nothing is merged,
indexed or published to production. The original Draft evidence below is a
historical checkpoint, not the current choice of examples.

### Bounded selection and actual examples

The [selection evidence](content-growth-sprint-2-2026-11-17/content-quality-selection.json)
records bounded GET/HEAD-only reads, not a new catalogue audit or runtime
discovery engine. An initial sample read 61 of 227 active powder variants with
a protein verification flag. A more specific provenance query returned all
14 manufacturer-sourced reviewed candidates across three products. Delivery
selection read 81 of 85 matching active Creatine/Whey-category products with
fresh in-stock known-shipping offers. Exact identity still uses the existing
mapping resolver. No nutrition, source approval, mapping or production record
was changed; no manufacturer label was newly collected or approved.

No qualifying price-order reversal was found in that bounded delivery sample.
The chosen current comparison is useful without claiming a reversal or using
an old price as today's price. Both offers are ordinary single-pack records.

| Guide / exact variant | Current item + delivery = total | Calculation / check time UTC |
|---|---|---|
| Delivery: CNP Creatine Monohydrate, Unflavoured 250g, variant2015 | Jon's £12.99 + £3.99 = £16.98; 6 Pack £15.00 + £4.99 = £19.99 | Both fresh and in stock; checked 17 Nov13:54:47 and11:45 respectively. Lower item price remains lower after delivery; the page says so. |
| Protein: Applied Nutrition ISO-XP 1.8kg Banana, variant732 | Whey Okay £81.53 + £3.99 = £85.52 | 72 ×22g =1,584g protein; £85.52 /1,584 ×25 =£1.35 rounded. Offer checked 17 Nov10:48:03. |
| Protein: Applied Nutrition ISO-XP 1.8kg Vanilla, variant735 | Whey Okay £81.53 + £3.99 = £85.52 | Its separate approved record also contains72 ×22g; result £1.35. Offer checked 17 Nov10:48:03. |

These are dated observations from the
[15:04:11 UTC source readback](content-growth-sprint-2-2026-11-17/content-quality-source-readback.json),
not constants in page code. Both protein overrides exactly match their own
previously approved entries in
`data/verified/variant-nutrition-reviewed-batch-1-v2.json`, including flags,
manufacturer provenance, servings and protein. Manifest scope/hash and exact
override equality are recorded in that readback. Each pack has72 verified
25g servings with22g protein per serving. No facts were transferred between
flavours. The page explicitly describes two flavours of one product, not two
different formulations or a cheapest-product ranking. Both guides now show
real arithmetic/comparison; neither depends on an empty-only example.

### Scoped correction and internal links

The guide's protein gate incorrectly passed a reviewed record's explicitly
null, unrelated `creatine_per_serving_g` to a helper that validates every
present nutrient. It therefore rejected otherwise approved protein evidence.
The scoped fix removes only that null key from a local validation copy, then
uses the same shared protein/pack validator and existing cost calculation.
It preserves rejection of invalid protein, invalid non-null nutrients,
unapproved evidence and wrong variants. No shared nutrition policy changed.
A regression test uses the existing approved manifest with a test offer.

The examples remain pinned, not dynamically chosen per request. Both caches
move to v2 to exclude old example results. The two flavour pins share one
deduplicated product read and use distinct variant keys/links. There are still
two database batches per cold guide and no per-variant query.

Exactly one contextual crawlable link was added to each existing page:

- `/whey-protein`, beside its explanation of value metrics, links to the
  cost-per25g guide.
- `/creatine`, beside its delivered-price explanation, links to the delivery
  guide. The existing SEO-21 budget section is unchanged.

[Incoming-link evidence](content-growth-sprint-2-2026-11-17/content-quality-incoming-links.json)
confirms one link each in initial actual Next HTML. Existing title, H1,
canonical and robots match the public baseline; the creatine budget section
remains present. [Public link checks](content-growth-sprint-2-2026-11-17/content-quality-public-links.json)
pass all16 existing destinations, including the three exact selected-variant
URLs. The approved manufacturer source URL returns200. PER4M remains unchanged.

### Quality and performance

Project Guardian, 51 focused guide/Guardian/lifecycle checks, `verify:quick`,
`verify:full` (304 safe files /3,986 tests), TypeScript, ESLint, baseline
validation and production build pass. The test file inventory remains 365:
two regression cases were added to the existing inventoried guide file, so
the existing inventory seal was reviewed and revalidated unchanged. See
[quality evidence](content-growth-sprint-2-2026-11-17/content-quality-quality.json).

[Actual production-build browser QA](content-growth-sprint-2-2026-11-17/content-quality-browser.json)
passes1440px desktop and390px touch emulation at normal scale: both cards on
each page, no clipping/overflow, overlap, keyboard-order error, HTTP failure or
runtime exception; CLS0. Screenshots:
[delivery desktop](content-growth-sprint-2-2026-11-17/content-quality-delivery-1440.png),
[delivery mobile](content-growth-sprint-2-2026-11-17/content-quality-delivery-390.png),
[protein desktop](content-growth-sprint-2-2026-11-17/content-quality-protein-1440.png),
[protein mobile](content-growth-sprint-2-2026-11-17/content-quality-protein-390.png).
As in the first checkpoint, this is a local actual Next production build with
guarded production-source GET/HEAD reads, not a public production deployment.

[Cache/performance evidence](content-growth-sprint-2-2026-11-17/content-quality-performance.json)
shows two cold batches and zero additional reads across five warm requests per
guide. Cold TTFB is779.2/780.9ms; warm medians23.0/16.9ms versus the previous
local33.0/32.6ms sample. These small loopback samples show no observed warm
regression, not a statistically established speedup or field CWV. Decoded HTML
is approximately33/37.4KB; the increase carries the real comparison and worked
nutrition data. LCP is112/48ms for delivery and52/52ms for protein
(desktop/mobile), CLS0. Observed script bytes match the first checkpoint;
no client feature, dependency or extra database-query mechanism was added.

### Exact launch delta prepared, not applied

After separate owner approval, the production-code change for indexing is
exactly these two existing entries in `app/lib/indexabilityLifecycle.ts`:

```diff
- "/guides/supplement-prices-including-delivery": "planned",
- "/guides/cost-per-25g-protein": "planned",
+ "/guides/supplement-prices-including-delivery": "launch_approved",
+ "/guides/cost-per-25g-protein": "launch_approved",
```

The existing shared robots/sitemap adapter then emits base index/follow and
admits exactly one canonical URL each:
`https://www.supplementscout.co.uk/guides/supplement-prices-including-delivery`
and `https://www.supplementscout.co.uk/guides/cost-per-25g-protein`.
Their sitemap candidates already exist; no `app/sitemap.ts`, `robots.txt`,
canonical, metadata, schema or routing change is needed. Parameters remain
noindex/follow with the clean canonical. No page generator or coverage-based
indexability switch is introduced.

In the same approved change, update only the state assertions in
`scripts/buying-guides.test.js` (base robots indextrue; parameters stillfalse;
status launch_approved and sitemap eligibilitytrue) and
`scripts/indexability-lifecycle.test.js` (move the two paths from the expected
planned list to the expected launch-approved list). Filenames/inventory stay
unchanged. Run Guardian and the required gates before approved release, then
the immediate readback/rollback procedure below. Mark `live_verified` only
after public evidence passes. The intent boundaries against existing category,
Deals, methodology and comparison tools are unchanged; no cannibalizing
category listing or second comparison engine was added.

## Scope and preflight

Fresh GitHub main was `6eb2944e3ad5b4432f2a423e5c9f4bc45946b269`.
Neither guide existed there. Open Draft PRs #532 and #33 do not overlap this
scope. Work uses an isolated worktree and preserves the owner's dirty checkout.
The Sprint 1 drafts were reused; no competitor or query research was repeated.

SEO-22 is one execution unit containing:

- `/guides/supplement-prices-including-delivery` — matching a single pack's
  item price, shipping and delivered total, including basket limitations.
- `/guides/cost-per-25g-protein` — explaining a verified protein denominator,
  delivered unit cost, rounding and the limits of comparing different formulas.

SEO-20 remains frozen and the binding next task. SEO-21 stays `LIVE VERIFIED`.
The minimal Guardian exception allows only SEO-20/SEO-22, requires both exact
guide routes and all existing authority records, and requires SEO-21 to remain
live verified. Negative tests reject missing authority, different scope, a
third task, a changed binding task and reopening SEO-21. No data, mapping,
nutrition, migration, retailer workflow, Stage 3 or GYM HIGH change is included.

## Distinct search and purchase intent

| Existing URL | Existing purpose | Guide boundary |
|---|---|---|
| `/how-we-compare` | Site-wide comparison rules and transparency | Guides apply the rules to two specific purchase questions; methodology gains two contextual links, not duplicated rules or a competing policy page. |
| `/deals` | Discover current tracked offers and eligible deals | Delivery guide explains shipping arithmetic; it makes no price-drop claim and sends discovery to Deals. |
| `/whey-protein` | Browse/filter current whey comparisons | Protein guide teaches the denominator and missing-data rules; it is not another category listing or cheapest-product ranking. |
| `/creatine` | Browse current creatine and delivered-budget offers | Delivery guide uses one pinned pack to explain shipping, linking back to the existing budget section without changing it. |
| `/compare` | Select two products for side-by-side comparison | Protein guide explains the unit before sending readers to that existing tool. |

The separate titles/H1s, short direct opening answers, different worked-example
purposes and contextual cross-links support distinct intent. This is an
implementation-level overlap review, not a prediction of Google rankings.

## Reused mechanisms and fail-closed behavior

Both pages are Server Components with initial-HTML answers, the full reviewed
English editorial structure, one small shared presentation component and thin
wrappers around the existing lifecycle error boundary. No new dependency,
CMS, API, animation, pricing engine, nutrition calculator or variant resolver.

The existing product-page loader is an inline history-heavy query; the whey
loader reads the entire category and the two-product loader reads the catalogue
and compacts away variant provenance. A small bounded projection therefore
selects only the one/two reviewed slugs, checks exact counts and calls the
existing strict batch variant resolver once. It reuses normalization,
freshness, delivered pence arithmetic, effective nutrition, pack labels and
verified nutrient/cost helpers. The only shared-pricing change exports an
existing helper without changing its body.

Selection pins product ID/slug, active parent and variant, flavour, size and
single-pack count. Other flavours, sizes, unresolved bindings and inactive
records cannot substitute. Unknown shipping is not free; stale, unavailable or
invalid-timestamp offers cannot supply a current price. Delivery reversal is
conditional on two distinct current retailers. Otherwise the guide explains
the missing comparison. Actual read errors throw through the shared error
contract; a successful empty result remains an honest empty state.

For these selected protein flavours, the guide additionally requires reviewed
variant-level manufacturer provenance and pack-aligned nutrition before using
the existing nutrition/pricing helpers. Legacy product verification flags alone
do not prove the flavour's label. This does not change nutrition records or
global nutrition policy.

## Actual production-source readback

[Source-bound evidence](content-growth-sprint-2-2026-11-17/source-readback.json)
was captured at `2026-11-17T14:28:02.429Z` using the existing authorized server
client behind a GET/HEAD-only transport restricted to catalogue reads. No
production writes occurred; test fixtures were not used as source evidence.

| Product / exact variant | Current accepted offer | Nutrition result |
|---|---|---|
| Time 4 Creatine 600g / 2943 | Jon's: £22.99 + £3.99 = £26.98, checked 17 Nov 13:54:47 UTC | No protein calculation; eBay's 16 Nov 14:04 offer is stale, so no two-retailer example is shown. |
| Time 4 Whey 1.8kg Raspberry Smoothie / 1546 | Jon's: £46.99 + £3.99 = £50.98, checked 17 Nov 13:54:47 UTC | Exact-flavour override is empty; cost per 25g withheld with an explanation. |
| CNP Peptide Whey 2.27kg Chocolate / 1307 | Jon's: £65.99 + £3.99 = £69.98, checked 17 Nov 13:54:47 UTC | Exact-flavour override is empty; cost per 25g withheld with an explanation. |

These are dated QA observations, never static prices in page code. The ordinary
retailer refresh changed Jon's timestamps during the audit; no refresh or data
write was initiated by this work. Positive arithmetic and nutrition examples
are tested with explicitly synthetic fixtures, separately from this readback.

[Public link checks](content-growth-sprint-2-2026-11-17/public-links.json)
returned HTTP200 for all 16 existing destinations, including three variant
product URLs whose initial HTML confirms 600g, Raspberry Smoothie/1800g and
Chocolate/2270g respectively. PER4M's exact title, H1, canonical and index/follow
remain unchanged; `/creatine#under-20` is present. Both new guides are
unpublished and are not described as production pages.

## Metadata, indexing and schema

Both routes are centrally registered `planned`: `noindex, follow`, excluded
from the effective sitemap. Static sitemap candidates are filtered by the
existing adapter, enabling a later explicitly approved launch. No temporary
coverage condition deindexes any existing `live_verified` URL.

Metadata is database-free, uses the requested distinct title/description,
clean absolute canonical via the root metadata base, and the shared parameter
robots policy. JSON-LD contains factual `WebPage` and `BreadcrumbList` only.
There are no invented authors, qualifications, publication dates, ratings,
Article or FAQ markup. Initial HTML links connect both guides, the comparison
tools, product variants, freshness, methodology, Deals and Help Me Choose.

## QA and performance evidence

Final Project Guardian, `verify:quick` and `verify:full` pass. The full gate
runs 304 safe files / 3,984 tests, TypeScript, ESLint, baseline migration
validation and the production build. The 365-file inventory was reviewed and
resealed; the new 17-test guide suite is in the 64-file quick set. The 49
focused guide/Guardian/lifecycle tests also pass. Integration tests remain
isolated and receive no production credentials. See
[quality evidence](content-growth-sprint-2-2026-11-17/quality.json).

[Actual browser evidence](content-growth-sprint-2-2026-11-17/browser.json)
passes both pages at desktop 1440px and touch-emulated mobile 390px, normal
scale. Document width equals viewport width; no clipped text, overlapping
cards, failed same-origin requests or runtime exceptions. Keyboard link order
passes. Visual inspection found adjacent footer links; their spacing was
corrected and both quality gates and final browser checks rerun.

- Delivery: [desktop](content-growth-sprint-2-2026-11-17/delivery-1440.png)
  and [mobile](content-growth-sprint-2-2026-11-17/delivery-390.png).
- Protein: [desktop](content-growth-sprint-2-2026-11-17/protein-1440.png)
  and [mobile](content-growth-sprint-2-2026-11-17/protein-390.png).

[Final HTTP/cache measurements](content-growth-sprint-2-2026-11-17/performance.json)
show exactly two batches on each cold guide and zero database reads across
five warm requests per guide. Cold TTFB is 1,146.6ms/482.4ms; warm medians are
33.0ms/32.6ms. The same local build's existing static methodology page is a
19.8ms warm baseline, not an older version of either new guide. Payloads are
approximately 28.5KB/34.4KB decoded HTML. Cold database response bodies total
less than 2KB/8KB respectively; no N+1 reads. The shared 3600-second cache has
distinct route/version keys and render-time freshness exclusion, covered by
existing cache tests and the guide's expiry-boundary test.

Local browser LCP is 136/92ms for delivery and 120/96ms for protein
(desktop/mobile); CLS is 0 in all four runs. These unthrottled loopback samples
are not field CWV or evidence of production LCP/INP. No new page interactions
or animations are added. [Client artifact evidence](content-growth-sprint-2-2026-11-17/client-artifacts.json)
shows only the existing root client components plus thin error wrappers as
client source. Each wrapper chunk is 947 bytes (about 515 gzip); each guide also
references an existing framework/image chunk of 14,474 bytes (5,493 gzip).
The guide content and calculations remain server rendered. No dependency or
package-lock change is included. This bounded cost provides no demonstrated
reason to redesign the existing architecture.

The manual HTTP/browser environment starts the actual Next production build.
Because quality-gate builds intentionally contain loopback-only database
settings, its ignored QA transport remaps that placeholder to the existing
production source and replaces only the placeholder public key in memory.
It permits GET/HEAD on products/retailer-products only, blocks other methods,
origins and tables, and logs no credentials. This is local read-only QA, not a
Vercel production/Preview verification. Quality gates receive no production
write credentials. Vercel protection is not changed.

## Pending owner release, readback and rollback

1. Review the one Draft PR, exact head, example limitations and indexing scope.
   A release decision must explicitly authorize merge/publication and the two
   lifecycle transitions to `launch_approved`; make those bounded changes in
   this PR, update lifecycle expectations and rerun the required gates. Do not
   merge the current planned state and claim an indexable public launch.
2. Recheck exact head, conflicts and all required checks, then use guarded
   squash merge only after owner approval. Confirm main and Vercel READY.
3. Immediately GET both production pages and parameter variants. Verify
   HTTP200, initial answers, actual exact variants, fresh stock/check times,
   known item/shipping totals, and nutrition figures only if exact-flavour
   provenance now passes. An honest empty/withheld state is valid; never fill
   it with the historical snapshot. Check every product/retailer path.
4. Verify clean canonicals, base index/follow after approved launch, parameter
   noindex/follow, exactly one clean sitemap URL each, factual schema, contextual
   incoming/outgoing links and no server errors. Repeat 1440px/390px and warm
   performance checks against this pack and the contemporaneous production
   baseline. Recheck frozen PER4M and the live creatine section.
5. Only then may the ledger/lifecycle be marked live verified with public
   evidence under Project Guardian. No next sprint is implied.
6. On a real release regression, stop closeout and follow the owner's existing
   release authority. Prepare a revert of this single bundle in the same
   guarded GitHub flow or restore the immediately prior known-good Vercel
   deployment only if the owner authorizes that production action. Preserve
   SEO-20, SEO-21 and all production data. No DB rollback is necessary because
   the change performs no writes or migrations. Keep status at code complete
   until the approved release and readback succeed.
