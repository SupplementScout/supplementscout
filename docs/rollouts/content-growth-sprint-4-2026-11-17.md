# Content Growth Sprint 4: whey types and matched pack value

17 November 2026. SEO-24 supporting implementation and review evidence.
The Operating Plan remains authoritative and the SEO Execution Plan is the
sole task ledger. The owner authorizes two guides, code, tests, necessary
documentation and one Draft PR. No merge, production deployment/indexing,
data write, nutrition approval, workflow change or further sprint.

## Fresh preflight

Remote main is `5ac0e802b5ffc5754466b546b5f99aa6716a196e`. Existing Draft PRs
#532 and #33 do not overlap. Work uses the clean isolated branch
`content-growth/sprint4-20261117`; the original dirty checkout is untouched.
SEO-24 was unused. Sprint1/2/3 packs, current governance, lifecycle, nutrition
boundaries and installed Next.js16.2.9 server/metadata/cache guidance were read.
No competitor/query audit was repeated.

The proposed routes do not exist and return404 publicly. Categories already
compare live offers, and existing guides cover budget, shipping and the protein
unit-cost method. Neither proposed decision guide is already implemented.
Existing BuyingGuide, buyingGuideData/buyingGuides, categoryComparison,
wheyComparison, proteinTaxonomy, nutritionMetrics, pricing, variant resolution,
freshness, lifecycle cache, metadata and sitemap mechanisms are reused.

## Data readiness: selected evidence, not category counts

The bounded discovery query returned53 active category identities with a fresh
known-shipping offer, below its61-product ceiling. That category contains
non-whey items and blends; **53 is not a qualifying comparison count**. Only
three product identities were subsequently read through the existing complete
projection/resolver. The guide selections use three distinct exact variants.

| Selection | Reviewed variants | Fresh in-stock, known delivery | Approved exact nutrition | Honest numeric comparison |
|---|---:|---:|---:|---|
| Isolate/concentrate | 2 | 2 | 1 | Delivered prices and verified powder cost/kg; one verified protein cost, no protein-unit winner |
| Same-formula pack sizes | 2 | 2 | 1 | Delivered prices, powder cost/kg, upfront and unit differences; protein-unit pair withheld |

[Readiness proof](content-growth-sprint-4-2026-11-17/data-readiness.json),
[actual-source render](content-growth-sprint-4-2026-11-17/actual-source-readback.json)
and [existing approved-record equality](content-growth-sprint-4-2026-11-17/approved-nutrition-proof.json)
are independent of synthetic test fixtures. All source transport is GET/HEAD
only with an explicit table allowlist and zero production writes.

Manufacturer checks on17November establish the selected Vanilla whey sources:
[7Nutrition500g](https://7nutrition.eu/en/products/7nutrition-whey-protein-80-500g-598.html)
lists concentrate, while [ISO-XP](https://appliednutrition.uk/products/iso-xp)
lists isolate and the current450g/1.8kg sizes under the same Vanilla formula.
These are scoped editorial ingredient/identity facts, not database taxonomy
changes or nutrition approvals. Other flavours/formulas cannot inherit them.
The [ADPI definitions](https://www.adpi.org/wp-content/uploads/2022/07/Whey-and-Whey-Products_Human-Food-Definitions.pdf)
support the separate general ingredient explanation, not finished-product
protein/lactose amounts or clinical claims. Source links all return200.

ISO-XP1kg offers were found, but that size is not currently listed on the checked
manufacturer page. Its formula was not assumed equivalent. The450g/1.8kg
Vanilla pair instead has current common manufacturer evidence and exact
resolved catalogue variants. A1kg-versus2kg example was a preference, not a
reason to invent sizes or equate unproved formulations.

| Exact variant | Retailer | Item + delivery = total | Cost/kg | Offer check UTC |
|---|---|---|---:|---|
| 7Nutrition Whey Protein80 Vanilla500g,2026 | 6 Pack Supplements | £19.99 +£4.99 =£24.98 | £49.96 | 17Nov11:45:40 |
| Applied Nutrition ISO-XP Vanilla1.8kg,735 | Whey Okay | £81.53 +£3.99 =£85.52 | £47.51 | 17Nov10:48:03 |
| Applied Nutrition ISO-XP Vanilla450g,4613 | Holland & Barrett | £30.00 +£0.00 =£30.00 | £66.67 | 17Nov17:48:48 |

These are dated observations, not hardcoded page prices. Variant735's applied
override exactly equals its own entry in the existing REVIEWED manifest
`data/verified/variant-nutrition-reviewed-batch-1-v2.json`, file SHA256
`447048be2ca789210ad71f8d144471d8cd3b2ef75b5e81c3b4f6cd6169656fa7`.
Its72×22g =1,584g approved protein supports £85.52/1,584×25 =£1.35 after final
rounding. The concentrate and450g pack lack approved exact nutrition; no
amounts/servings are borrowed, imported from manufacturer text or approved.

For the matched size pair: £30/0.45kg =£66.67/kg and £85.52/1.8kg =£47.51/kg.
The larger pack requires **£55.52 more upfront**, with **£19.16 less per kg**
after rounding the raw difference. It is not a same-store bulk discount or
guaranteed basket saving. Formula/flavour, one-pack identity, verified mass,
known shipping and current stock are required for both sides. Pennies and
grams determine the ordering before display rounding. Protein-unit comparison
is withheld for both cards while either exact record is missing.

## Content, discovery and engineering

- `/guides/whey-isolate-vs-concentrate`: **Whey Isolate vs Concentrate: Which
  Is Better Value in the UK?** Explains ingredient types, blends, label limits,
  different cash/weight/protein metrics and the buyer's decision. It does not
  replace the broad whey catalogue, isolate catalogue or two-product tool.
- `/guides/protein-powder-pack-size-value`: **Does Buying a Bigger Protein
  Bag Actually Save Money?** Compares a matched formula/flavour in two sizes,
  unit price and cash outlay. Its decision differs from the under£30 budget
  list, general delivered-price guide and cost-per25g calculation method.

This is an intent/content review, not measured proof of Google traffic,
keyword non-overlap or field CWV. No universal winner, efficacy/digestion/
safety promise, fake author, rating or publication date is introduced.

Both use initial server HTML, BuyingGuide/GuidePriceBreakdown, one H1,
clear headings, self-canonicals and factual WebPage/BreadcrumbList JSON-LD.
A small server-only presentation component and pure projections are shared
by both guides; no pricing/nutrition engine or generic classifier was created.
The reviewed type pins require exact product/brand/name/flavour/pack identity;
unregistered or ambiguous blend identities cannot qualify through a name word.

One contextual link comes from Whey Isolate to the type guide and one from
Whey Protein to pack-size value. All required product/tool/guide links are
crawlable. Existing completed guides are unchanged. Product destinations keep
their existing consent-aware `retailer_offer_click` events; no new analytics
event, workflow or integration is added and no retailer redirect is clicked in QA.

The two new entries are **planned/noindex, follow**. Parameters retain that
robots state and the clean base canonical. Sitemap candidates exist exactly
once but the shared adapter excludes planned routes. Empty results retain
useful explanations; incomplete matched pairs are withheld. Read failures use
the existing uncached lifecycle error/retry contract.

## Quality and performance

[Quality summary](content-growth-sprint-4-2026-11-17/quality-summary.json):
54 focused checks, Project Guardian, verify:quick/full (4,021 safe tests),
TypeScript, ESLint, baseline migration checks and Next.js production build
**PASS**. Inventory367:306 safe,57 isolated integration,4 artifact-bound;
66 quick smoke files. No production credentials reached gates. Integration
was not run. The first full gate exposed an old substring sitemap assertion
counting the new guide as another `/whey-isolate`; it now checks the exact
category canonical. No test was omitted/disabled, and the full rerun passes.

[Actual local production-build HTTP contracts](content-growth-sprint-4-2026-11-17/local-http-contracts.json)
and [Chrome1440/390px touch QA](content-growth-sprint-4-2026-11-17/local-browser.json)
pass current examples in initial HTML, canonical/robots/schema, one incoming
link each, no new sitemap URL, readable cards, no horizontal clipping/card
overlap, keyboard order and zero observed runtime/HTTP errors. Manual review
of all four screenshots confirms the layout:
[type desktop](content-growth-sprint-4-2026-11-17/whey-types-1440.png),
[type mobile](content-growth-sprint-4-2026-11-17/whey-types-390.png),
[pack desktop](content-growth-sprint-4-2026-11-17/pack-value-1440.png),
[pack mobile](content-growth-sprint-4-2026-11-17/pack-value-390.png).
These are real-source local checks, **not a new production deployment**.

[Local timings/cache](content-growth-sprint-4-2026-11-17/local-performance.json):
type-guide cold/warm median TTFB920.9/36.2ms; pack-guide397.9/26.1ms. Each cold
route uses two existing bounded catalogue/resolver batches. Five warm requests
per route cause **zero DB reads** under the existing3600-second hour-bucket
cache; no N+1. Freshness is still checked at render time. Existing delivery/
protein-cost guide warm medians28.2/31.2ms remain comparable with the prior
same-machine35.0/31.4ms sample. CLS0; local warm LCP92–224ms. These small lab
samples establish neither field CWV/INP nor a production performance gain.
[Client artifacts](content-growth-sprint-4-2026-11-17/client-artifacts.json)
show only shared root components and thin existing-pattern error wrappers;
no guide page or new presentation component enters the client graph.

[Existing public contracts and links](content-growth-sprint-4-2026-11-17/existing-public-checks.json)
pass: three exact variant links, manufacturer/ADPI links, frozen PER4M metadata,
Creatine under20 and all four SEO-22/23 guides. Their route sources and the
SEO-20 experiment record have byte parity with main. Stage3 stays disabled;
GYM HIGH public hubs stay deferred. No production data, workflow, migration,
nutrition approval, Google action or next sprint was changed.

## Handoff: READY FOR PUBLICATION REVIEW

SEO-24 is **CODE COMPLETE**, with one Draft PR. Both guides pass readiness;
there is no catalogue repair or nutrition approval prerequisite for publishing
the honest cash/weight comparisons described above. The missing protein-unit
comparison is explicit, not filled with invented numbers.

Publication requires a separate owner decision covering only these two
`planned`→`launch_approved` entries, corresponding existing lifecycle/sitemap
contract expectations, guarded merge and automatic production deployment.
Central helpers then provide base index/follow and one clean sitemap URL each;
parameters remain noindex/follow. Public readback must pass before recording
`live_verified` and closing SEO-24 as LIVE VERIFIED. No new sitemap or local
robots mechanism is needed. GSC submission remains manual by the owner.
