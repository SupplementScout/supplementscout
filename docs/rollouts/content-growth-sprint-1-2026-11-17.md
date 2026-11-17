# Content Growth sprint 1: owner review pack

Date: 17 November 2026. This is supporting scope, research and verification
evidence. The Operating Plan remains the project authority and
[SEO Execution Plan](../SEO-Execution-Plan.md) remains the sole status ledger.
This file does not create another roadmap or authorize publication.

## Owner scope and fresh preflight

The 17 November owner instruction approves one independent Content Growth
implementation alongside the frozen SEO-20 experiment: code, tests, minimal
governance alignment and a controlled Draft PR. It excludes merge, deployment,
production writes and publication. The two guide drafts below are preparation,
not permission to add routes. The seven briefs are recommendations.

- Remote main and the clean implementation base were
  `b9c44b3959fe857e49b8bb03a109a3d88e16f2b5` (H&B activation evidence, PR540).
- Branch: `content-growth/creatine-under-20-20261117`, created in an isolated
  worktree. The original checkout is on an older branch and has pre-existing
  edits to AGENTS, Operating Plan and nutrition documents plus untracked
  retailer/nutrition material. None was copied, staged or changed.
- Open Draft PRs at preflight: #532 (reviewed Default preflight) and #33
  (historical protein-bars coverage). Neither implements this content scope.
- Existing `/creatine`, Help Me Choose, CategoryDecisionPanel, category
  controls, product variants, nutrition, pricing, freshness, lifecycle cache,
  schema and comparison transparency contracts were inspected before building.
  The budget section was absent. Both proposed guide URLs returned 404 during
  the public readback at approximately 12:08 UTC.
- The installed Next.js 16.2.9 Server Component, metadata and cache guides were
  read. No framework upgrade or dependency change is needed.

The dated governance exception permits only SEO-21 beside frozen SEO-20, in
the existing ledger. Guardian requires the same owner scope in AGENTS,
Operating Plan, SEO current-task section and Agent Operating Model, and rejects
missing authority, a different pair, a third task, a changed implementation
route or a changed binding next task. It remains read-only and enabled.
This exception ends at the scoped Draft PR; it is not a reusable second lane.

## Evidence used; no repeated broad research

The earlier Hybrid SEO Growth Research in this owner conversation is the
research baseline. It inspected 40 WheyWise URLs (33 substantive), 25 search
queries, and current first-party pages and sitemaps. The sitemap snapshots
contained 283 non-product WheyWise URLs versus 28 SupplementScout URLs; these
are coverage counts, not estimates of visits, rankings or AI citations.

Latest authenticated scheduled Growth Analytics evidence inspected:

- Run `43933467205`, artifact `14259172592`,
  `weekly-2026-11-15.json`, SHA-256
  `9f1728703f0c9fc3d135c917ba8f68c6f8556f8abc5176d41014e4b17ae6a47c`.
- Settled GSC dates 9–14 November: 2,205 impressions, 21 clicks, 0.95% CTR,
  average position 32.77. The 15 November row (291 impressions) was non-final
  and excluded. The previous week's settled rows had 2,205 impressions and
  20 clicks. This is not evidence of content-sprint uplift.
- GA4: 79 Organic Search sessions, 13 users and 3 retailer clicks. Six
  AI-assistant-labelled sessions do not establish an operational referral
  source or a reliable acquisition channel.
- The attempted 28-day comparison had only 20 paired settled dates; its
  7,418 versus 4,947 impressions and 54 versus 31 clicks are explicitly a
  partial-window observation, not a complete 28-day result.
- Existing scheduled measurement is sufficient. No analytics workflow,
  property setting, credential or event definition is changed.

SEO-15's latest ordinary scheduled evidence was run `43915096459`, artifact
`14248309820`: 813 series; 49,663 proven, 346 quarantined and 5,062 legacy
observations; zero release candidates across two released sources. Public
Stage 3 remains disabled and behind its unchanged 12 / 30 / 4 gate.

## SEO-20 protection and existing public contracts

At approximately 12:08 UTC, `/brands/per4m` returned HTTP200 with:

- title: `Compare PER4M Prices Across UK Retailers | SupplementScout`;
- H1: `Per4m Products & Prices UK`;
- self-canonical `https://www.supplementscout.co.uk/brands/per4m`;
- robots: `index, follow`.

The experiment source, rollout record, shared brand loader, measurement
workflow, queries, schedule and parameters are outside this change. The
measurement start remains `2026-11-03T11:54:34Z`; minimums remain 28 settled
post-deployment days, 500 page impressions and 300 fixed-group brand-query
impressions. No result is declared. Live prices can change through ordinary
approved refreshes; a whole live-body hash cannot demonstrate source parity
across different catalogue refresh times.

The current `/creatine` production baseline returned HTTP200, unchanged title
and H1, self-canonical and index/follow. Its parameter state
`/creatine?sort=price` returned HTTP200, the same canonical and noindex/follow.
The route is already registered and live verified. No new registry or sitemap
entry is appropriate for an HTML fragment. Existing metadata, JSON-LD builder,
table, category decisions, filters, error contract and lifecycle state remain.
The cache uses the same shared hour-bucket loader and revalidation policy;
only its payload version changes from v2 to v3 for exact-variant fields.

## First implementation: /creatine#under-20

The new server-rendered section answers the budget question directly, with
up to three distinct products ordered by the existing delivered-price
comparator. Each example identifies exact active variant, structural pack,
retailer, item price, known delivery, delivered total, offer check time and
verified cost per 5 g where supported. Product links carry the exact
`?variant=` identifier. Help Me Choose retains its existing budget query and
`priority=lowest_delivered_price`.

The existing category read adds offer binding IDs and calls the existing
batched `resolveCategoryComparisonVariants`. It creates no second data
source or pricing/nutrition engine. Original comparison rows, ranking and
schema retain their existing calculation and presentation. Budget facts use
`getEffectiveNutritionMetrics` and `getVerifiedCostPer5gCreatine` on the
matched variant; unresolved, wrong-product, inactive or structurally unknown
variants do not qualify. Unit cost is conservatively withheld for multipacks
and packs without structural gram-weight alignment: the shared contract does
not establish total nutrition for a different capsule count or multipack.

Only fresh, in-stock offers with a known delivered total at most £20 qualify.
Freshness is checked again when rendering, so a cached offer cannot remain a
current budget example after it ages out. Unknown delivery is not free.
There is a useful zero state and no static current price in page prose.
Examples are drawn from covered retailers, not a claim about the whole UK
market or product effectiveness. Address, basket, membership and checkout
limitations remain explicit. Budget examples use the full category result;
existing table filters do not silently change the editorial examples.

Changed implementation and verification files:

- `app/creatine/page.tsx`: bounded section and cache payload version.
- `app/lib/creatineComparison.ts`: reuse variant resolution and add a
  conservative projection/selection of existing offers.
- `scripts/creatine-page.test.js`: price boundary, delivery, exact bindings,
  stale cache, nutrition mismatch, three-product cap, SSR, links and resolver
  error regressions alongside existing metadata/schema/error tests.
- `scripts/project-guardian.js` and its existing test file: exact scoped
  concurrency exception and negative tests.
- `scripts/quality-gate-manifest.json`: include the creatine test in quick
  checks. The 364-file inventory and SHA-256 seal are unchanged because no
  test file was created, removed or renamed; both changed tests remain safe.
- AGENTS and the three existing governance documents: dated authorization,
  existing-ledger task and review evidence, without a second approval system.

Local verification and final review results are recorded below.
Production verification of the new section must follow separately authorized
publication; this Draft PR must never be labelled live verified.

### Local verification evidence

- Before governance edits: `npm run verify:project` passed, 22 tasks and
  SEO-20 alone in progress. After the bounded exception it passed with 23
  tasks and exactly SEO-20/SEO-21 in progress. After local completion it passes
  with SEO-20 still next and in progress; SEO-21 is code complete.
- Focused regressions: 45/45 pass across the existing creatine and Guardian
  test files. The price/variant tests also exercise actual resolver read-error
  behavior, withholding inferred examples while preserving the comparison.
- `npm run verify:quick`: PASS, including TypeScript, ESLint, Guardian and
  the reviewed quick inventory. `npm run verify:full`: PASS, including all
  303 safe test files, baseline migration validation and Next.js 16.2.9 production build.
  Integration/database tests remain isolated; neither gate received
  production-write credentials. Build emitted the existing multiple-lockfile
  workspace-root notice and an absent-cache notice, with no build failure.
- Chrome headless local SSR fixture QA used the production-built styles at
  1440px and 390px, three navigations per baseline/changed/empty state.
  The section fits 390px, long names wrap, no section text/card clipping occurs,
  three cards become a vertical list, missing unit cost is explicit, checked
  times use machine-readable `time`, and product/HMC links are keyboard
  reachable with an accessible heading/list/definition structure.
- Visual review: [mobile 390px](content-growth-sprint-1-2026-11-17/creatine-390.png),
  [desktop 1440px](content-growth-sprint-1-2026-11-17/creatine-1440.png) and
  [mobile empty state](content-growth-sprint-1-2026-11-17/creatine-empty-390.png).
  These are labelled synthetic UI fixtures, not current retailer evidence.
- Local fixture HTML increases by 3,978 bytes with three cards; script count is
  unchanged (one existing JSON-LD block, no new executable JavaScript).
  Observed CLS is 0 in all runs. These local observations do not establish
  field Core Web Vitals or production query latency. The existing comparison
  table's mobile overflow behavior is the same in baseline and changed
  fixtures; this scope does not redesign that table.
- A separate public-anon read-only SELECT loaded 86 category products in
  approximately 1.65 seconds but exposed no exact variant bindings. It was not
  used to claim zero eligible offers. No privileged credential was supplied
  to a quality gate or UI fixture. The real server-side resolver and current
  examples require readback after separately authorized release.
- `generateMetadata` and `buildCreatineStructuredData` retain their exact
  source implementations; existing canonical, parameter robots, sitemap,
  JSON-LD, error and quick-decision regression tests pass.
- [Machine-readable local evidence](content-growth-sprint-1-2026-11-17/local-qa.json)
  records the 18 fixture navigations and protected source/contract hashes.

Performance risk is bounded but not zero: a cold creatine cache fill adds
one existing batched variant lookup, never one read per product. Cache lifetime
is unchanged, the section adds no image, dependency or client bundle, and
selection is bounded to three cards. Check actual cache-miss latency and field
CWV after an authorized release; no production performance claim is made here.

## Guide A: delivery-inclusive comparison — implementation-ready editorial scope

Proposed route: `/guides/supplement-prices-including-delivery`.
Title: **Supplement Prices Including Delivery: A UK Comparison**.
H1: **Can a higher product price be cheaper after delivery?**
Description: **Compare checked UK supplement offers for the same variant and
pack, with product price, delivery and the final delivered total shown apart.**

Decision: a separate guide is justified by the educational same-variant
retailer comparison and checkout checklist. It must link to the existing
`/how-we-compare` method and category comparisons rather than copy their
general methodology. `/deals` owns current deal discovery; this guide owns
the question of why delivery can reverse an apparent price advantage.
Do not make another generic cheapest-supplements listing or claim a
UK-wide study from a single matched example.

### Refreshed evidence and required inputs

Public readback at `2026-11-17T12:07:59Z` confirmed the exact **Time 4
Creatine Powder 600g, variant 600g** on
[the existing product page](https://www.supplementscout.co.uk/product/time-4-creatine-powder-600g).
It showed Jon's Supplements £22.99 + £3.99 = £26.98 and eBay UK £24.99 +
£0.00 = £24.99, both checked 16 November. The item-price ordering reverses:
the higher item price has a £1.99 lower delivered total. This is a
same-variant, same-pack comparison. It is not a historical price drop.

At implementation, resolve the canonical product and exact active variant
through the existing product/comparison loader. Require two distinct fresh
retailers bound to that same variant, positive item price, known shipping,
in-stock state and each offer's check time. Use `getDeliveredPrice` and the
existing offer freshness rule. Select the illustrative reversal only if it
still exists; otherwise show a neutral same-variant breakdown or an explicit
no-current-example state. Never manufacture a reversal or compare flavours
with different bindings. No checkout promise, membership, voucher or unknown
regional postage assumption is permitted.

### Complete proposed page copy

**A higher product price can be cheaper after delivery. Compare the final
total for the same variant and pack, not the headline item price alone.**
If delivery is unknown, you do not yet have a reliable delivered-price
comparison.

#### A checked example for the same pack

The comparison below uses one exact creatine variant at two covered UK
retailers. It separates the product price from delivery and shows when each
offer was checked.

[Render the current exact-variant comparison: product and variant link,
structural pack, retailer, product price, known delivery, delivered total,
and check time for each offer. At the dated research snapshot, the two
600g offers were £26.98 and £24.99 delivered. These snapshot figures are
review evidence, not fixed current prices to paste into production.]

The lower item price is useful only if the delivered total is also right
for your order. A delivery charge can reverse the apparent advantage.
This example covers one matched pack; it does not establish the cheapest
retailer for every product or address.

#### What to match before comparing

Start with the product variant, including flavour or formulation where
recorded, and its exact pack size and pack count. A small tub and a larger
tub are different purchases even if the product names look similar.
Then compare in-stock offers on the same delivery basis.

Free delivery should appear only when the recorded shipping cost is zero.
Unknown delivery is not free delivery. Basket thresholds, location,
membership benefits and retailer checkout terms may change what you pay.
Do not assume a voucher or member price applies to every shopper.

#### A quick checkout checklist

1. Open the product's exact variant and check the pack.
2. Compare product price, delivery and delivered total.
3. Read each offer's check time and confirm stock.
4. Confirm the retailer's final checkout total for your address and basket.

#### What SupplementScout can show

Our comparisons use tracked retailer offers. They do not include every
UK store, delivery destination or possible discount. Older offers are
excluded from current-price comparisons until checked again. If a price,
delivery cost or exact match is missing, we show the limitation rather
than estimate it.

Use [the creatine comparison](/creatine#under-20) for a delivered budget
question, or [Help Me Choose](/help-me-choose) to narrow a purchase.
Read [how we compare prices](/how-we-compare) and
[our freshness rules](/data-freshness) for the method behind the figures.
When comparing protein packs, [cost per 25 g of protein] is a separate
value question; add that link only after its guide is separately approved
and live.

### Minimal implementation and acceptance

Use an ordinary Server Component, existing site layout/typography,
`next/link`, `OfferCheckedBadge`, `ComparisonTransparencyLinks`,
`formatCurrency`, existing product variant presentation and existing
freshness/pricing helpers. A small server-rendered two-offer table or stacked
mobile cards is sufficient; no calculator, CMS, new API, pricing engine or
client state. Keep the example in the shared cache/error contract and check
freshness at render. Add no new general-purpose loader until the existing
product loader has been checked for reuse.

Before coding the future route: register it under the lifecycle policy,
declare its metadata/canonical and indexability approval, preserve unknown
delivery, failure and zero-state semantics, and define sitemap admission
through the shared registry. A guide-specific Article schema must be supported
by real author/date information and visible content; do not invent a reviewer,
review rating or FAQ schema. Lifecycle changes require their own contract tests.

Tests: same product but different variant rejected; unknown shipping,
stale/out-of-stock and missing bindings rejected; two retailers required;
£22.99 + £3.99 versus £24.99 + £0 produces the correct reversal in a synthetic
fixture; no static current prices; read failure not a successful empty dataset;
SSR links and checked times; no duplicate current Offer markup; base and
parameter canonical/robots/sitemap contracts; keyboard and 390px/desktop QA.
Proposed incoming links after separate approval: one contextual link from
`/how-we-compare` and an appropriate comparison methodology section.
Do not add a link to a not-yet-live guide.

## Guide B: cost per 25 g protein — implementation-ready editorial scope

Proposed route: `/guides/cost-per-25g-protein`.
Title: **Cost per 25g Protein: Compare UK Whey Prices Fairly**.
H1: **How to compare protein powders by cost per 25g of protein**.
Description: **Understand delivered cost per 25 g of protein with checked
whey examples, verified serving data and clear limits on missing information.**

Decision: a separate explanatory guide is distinct from `/whey-protein`
(shopping comparison), `/whey-isolate` (category) and a future isolate versus
concentrate guide (formulation choice). It explains the denominator with two
real, differently sized servings. It must not duplicate the category's live
ranking or claim that the cheapest protein is the most effective or suitable.

### Refreshed evidence and required inputs

The public product pages returned HTTP200 at approximately 12:08 UTC:

| Exact example | Retailer and checked offer | Verified denominator | Displayed cost per 25 g |
|---|---|---|---|
| [Time 4 Whey Protein Professional 1.8kg](https://www.supplementscout.co.uk/product/time-4-whey-protein-professional-1-8kg), Raspberry Smoothie / 1800g | Jon's Supplements; £46.99 + £3.99 = £50.98; checked 16 November | 60 servings, 30 g serving, 25 g protein per serving; 1,500 g protein per pack | £0.85 |
| [CNP Peptide Whey Protein Blend 2.27kg](https://www.supplementscout.co.uk/product/cnp-peptide-whey-protein-blend-2-27kg), Chocolate / 2270g | Jon's Supplements; £65.99 + £3.99 = £69.98; checked 16 November | 35 servings, 65 g serving, 47 g protein per serving; 1,645 g protein per pack | £1.06 |

Both current pages displayed these verified values. The second product is a
different formulation and serving size; these are illustrative denominators,
not a controlled isolate/concentrate test. Do not substitute another flavour
or inherit base-product nutrition when exact variant/pack alignment fails.
The guide must use live qualifying offer/variant data when implemented;
this table is a dated review snapshot.

Required fields: product/variant IDs and exact label, structural pack,
retailer binding, fresh in-stock offer, known delivered total, checked time,
verified serving count, serving size, protein per serving, nutrition and unit
pricing verification, effective net weight and product format.
Reuse `getWheyComparison`, `resolveCategoryComparisonVariants`,
`getEffectiveNutritionMetrics` and `getVerifiedCostPer25gProtein`.
Never derive protein content from the product name or powder mass.

### Complete proposed page copy

**Cost per 25 g of protein compares the delivered price of a pack with the
amount of verified protein it contains. A bigger tub or a cheaper scoop is
not automatically better value on that basis.**

This is a price comparison unit, not advice about how much protein to take.
Product ingredients, formulation, dietary requirements and serving directions
still need checking.

#### The calculation

Total verified protein in a pack equals its verified serving count multiplied
by the protein per serving. Divide the known delivered pack price by that
total, then multiply by 25.

**Cost per 25 g protein = delivered pack price ÷ total verified protein in
the pack × 25.**

Powder weight and protein weight are different. A 30 g scoop does not mean
30 g of protein. Comparing the price of one scoop can therefore be misleading
when the serving sizes or protein amounts differ.

#### Two checked examples

[Render the current exact variants, retailer, product/delivery/total breakdown,
checked time, verified serving count, protein per serving, total protein and
the shared verified cost-per-25-g result. Use the two source-bound products
above only while their data and offers qualify.]

In the dated research example, the Time 4 variant had 60 verified servings
with 25 g protein each: 1,500 g protein in the pack. The CNP variant had
35 servings with 47 g protein each: 1,645 g protein. Their serving sizes were
different, so the price per serving answered a different question from cost
per 25 g protein.

The examples explain the method. They are different formulations and do not
establish the best product, the cheapest UK market offer, or a result for
every flavour and pack. The live comparison should show its own check time
and current qualifying figures.

#### When we leave the figure blank

We need a known delivered total and verified nutrition and pack data for the
selected variant. If delivery, serving count, protein content or exact pack
alignment is missing, a trustworthy unit cost may not be available.
We do not fill gaps from a product name, a larger pack, another flavour or
an unverified label claim.

A stale offer is not a current-price example. Prices, stock and delivery
terms can change after a check. Confirm the exact variant and final checkout
total with the retailer.

#### Use the number as one part of a purchase

Compare [current whey protein offers](/whey-protein) using the same verified
unit, then open the product page to review the actual pack, ingredients and
retailer options. Use [the whey isolate comparison](/whey-isolate) when that
category fits your shopping question, or [Help Me Choose](/help-me-choose)
to narrow the shortlist.

Read [how we compare prices](/how-we-compare) and
[data freshness](/data-freshness) before treating a displayed price as a
checkout guarantee. Add a contextual link to the delivery guide only after
its separate approval and live verification.

### Minimal implementation and acceptance

Use a Server Component with a small example table/cards and text formula.
Do not build a client calculator or second nutrition calculation service.
The existing shared helper remains the numerical authority; any displayed
working must agree with its verified inputs and result. Use existing
comparison transparency and checked-time components, safe currency formatting,
shared cache/error behavior and exact-variant product links.

Future route registration, metadata/canonical/robots, sitemap admission and
supported article provenance require the same lifecycle review as Guide A.
Do not automatically index an unreviewed draft or publish invented authorship.
Proposed incoming link: one explanatory link beside the whey unit-cost
methodology after owner approval; keep shopping content on the existing hub.

Tests: verified 60 × 25 and 35 × 47 denominators with £50.98 and £69.98
produce displayed £0.85 and £1.06 using the shared helper; changed pack or
unresolved variant cannot inherit verification; unverified nutrition,
unknown shipping, stale price, zero/invalid denominator and wrong format
produce no unit cost; no static current price; SSR exact-variant links and
timestamps; honest missing-example and failure states; canonical/robots/
sitemap/schema contracts; keyboard and mobile 390px/desktop checks.

## Seven subsequent briefs, ordered by implementation readiness

These are proposed scopes, not active implementation tasks or permission for
seven URLs. Recheck current production coverage before selecting one.

| Order / topic | Destination and distinct job | Minimum data and acceptance |
|---|---|---|
| 1. Protein powder under £30 | Expand `/whey-protein#under-30`; answer the delivered budget question and pass through to exact variants/HMC. No second whey landing page. | Fresh exact pack, active binding, known delivery ≤£30; verified cost per25g where supported; missing data withheld. Reuse the creatine pattern and existing whey loader; budget boundary, stale-cache and canonical parity tests. |
| 2. Confirmed caffeine-free pre-workout | Expand `/pre-workout` with a confirmed caffeine-free section/filter explanation, preserving the current decision system. | Only applied, approved `confirmed_absent` caffeine facts at exact variant scope. Unknown, low caffeine and stim-free marketing words do not qualify. Test exact fact binding, unknown exclusion, stale prices and no medical/suitability guarantee. |
| 3. Best verified value vegan protein | Expand `/vegan-protein`; compare verified delivered cost per25g within the existing category, with clear coverage limits. | Existing category membership plus source-bound protein, servings, exact pack and fresh delivered prices. No inferred vegan certification or quality ranking. Test unverified denominator exclusions and preserve lifecycle state. Prefer the heading “Verified vegan protein value” over an unsupported market-wide “best”. |
| 4. Mass gainer cost per serving | Expand `/mass-gainer`; explain delivered cost per verified serving alongside serving size. | Source-bound serving count/size, exact pack and known delivered total. Serving sizes are not equivalent protein/calorie outcomes. Do not infer energy or recommend a dose. Test mismatched packs, missing verified servings and shared unit-price agreement. |
| 5. Whey isolate vs concentrate | New `/guides/whey-isolate-vs-concentrate` only after separate approval; educational formulation choice linked to both existing shopping hubs. | Source-confirmed pure isolate and concentrate variants with ingredients/nutrition provenance; blends cannot stand in for a controlled pair. Manufacturer primary sources for formulation claims, no unsupported digestion/health promise. Distinct from the per25g guide; exact classification and claim/source review required. |
| 6. Protein pack size and actual value | Prefer an evidence report at `/guides/protein-pack-size-value` if a bounded matched sample supports original findings; otherwise add one worked example to the per25g guide. | Same product/formulation/flavour across at least two exact sizes, current known delivery, aligned verified protein, reproducible sample date and exclusions. Do not assert larger is always cheaper or invent a “UK study”. Test price reversal, pack identity and normalization. |
| 7. Myprotein vs Optimum Nutrition | Conditional new `/guides/myprotein-vs-optimum-nutrition`, after exact-pair and editorial approval; link to existing product/brand comparisons. | Current comparable formulations and exact packs, verified denominator and ingredients/source evidence for both brands. Current Myprotein gaps cannot become estimates. Define a bounded comparison, no brand winner or unsupported health superiority. If one side is unavailable, hold the article rather than create a thin page. |

The first four reuse existing shopping destinations and supported mechanisms.
The three later guides need tighter source/classification or matched-sample
evidence. This readiness order intentionally puts data-supported expansions
ahead of new generic comparison URLs.

## Publication decisions and release verification

1. Review and approve the exact Draft PR head, including the dated governance
   exception and bounded creatine implementation.
2. Separately authorize its merge and production release through the existing
   release path. No auto-merge, deployment dispatch or production setting is
   part of this sprint.
3. After that authorized release, verify the new section with real server-side
   variant bindings, price/delivery/check-time parity, zero-state, mobile/
   desktop rendering, stable metadata/schema/sitemap and unchanged SEO-20
   source/measurement contract. Only then consider SEO-21 `LIVE VERIFIED`.
4. For each guide, approve the final distinct scope, English copy, exact
   source-bound examples, lifecycle/indexing decision and a separate
   implementation PR. Draft readiness is not publication authorization.
5. Select the next single Content Growth implementation from the briefs;
   the SEO-21 exception does not authorize another concurrent task.

Use the existing weekly GSC/GA4 report to observe page impressions, clicks,
retailer click-through and eventual attributable revenue. Do not promise
traffic, revenue or Core Web Vitals gains from this small implementation.
Do not alter SEO-20's measurement or use its interim result to claim sprint
success. Rollback of the new section, if required after an authorized release,
should remove only the SEO-21 code through a reviewed change and preserve all
other route and experiment contracts.
