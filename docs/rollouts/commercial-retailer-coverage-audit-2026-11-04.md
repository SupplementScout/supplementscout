# Commercial retailer coverage and multi-retailer depth audit

**Status:** READ-ONLY production audit complete  
**Decision:** **B — remediate specific existing-retailer coverage and freshness gaps, then add a new retailer/source selected for second-retailer overlap.**  
**Starting `origin/main`:** `1fdece880d4bdf2479a2fae953483c27041bb33f`  
**Production project:** `aftboxmrdgyhizicfsfu`  
**Production readback:** `2026-11-04T15:38:58.659Z`  
**Database writes:** `0`  
**Runtime changes:** `0`

## Executive finding

SupplementScout has useful retailer availability but shallow genuine comparison
depth. Of 1,357 active, unmerged products, 390 (28.7%) have no fresh retailer
and 776 (57.2%) have exactly one. Only 191 (14.1%) have two or more fresh
retailers and 37 (2.7%) have three or more.

Internal remediation is necessary but insufficient. Seventy products currently
lose potential comparison depth solely because a mapped retailer is stale. Even
the optimistic recovery of all 70 would move at most 261 products to 2+ depth,
or 19.2% of the active catalogue. Among all 1,166 zero/singleton products, 227
are classified as freshness gaps and 939 as source-coverage gaps under the
current approved mapping evidence. A new broad, exact-identifier source is
therefore justified after the bounded internal recovery and overlap checks.

The commercial priority is not simply the categories with the lowest percentage.
Whey Protein, Pre Workout, Creatine and Amino Acids combine high purchase intent
with 31/51, 40/92, 18/53 and 27/55 products at zero/one fresh retailer
respectively. They are the first opportunity pool.

## Scope, method and safeguards

- The audit fetched `origin/main`, verified the required starting SHA and used a
  clean worktree so unrelated owner changes in the root checkout remained
  untouched.
- Project Guardian passed before the audit: 22 SEO tasks were valid, `SEO-20`
  remained the sole SEO task `IN PROGRESS`, and only the existing stale weekly
  GSC reminder was reported. Broad P1 category cleanup remains closed.
- The production tables `products`, `retailers`, `offers`,
  `retailer_products`, `product_variants` and the outbound-click ranking signal
  were read with deterministic pagination to exhaustion. All queries were
  `SELECT`-only.
- The current public semantic/custom route resolvers were reused for category
  membership. No category semantics were changed or reopened.
- Freshness uses the existing `CategoryComparison` contract from
  `app/lib/offerFreshness.ts` and `app/lib/categoryComparison.ts`: active,
  unmerged product; in stock; finite positive price; check age no greater than
  24 hours; a `retailer_product_id`; HTTP(S) URL; and an identified retailer
  with a non-empty name. Shipping is not required for offer validity, and
  unknown delivery was not treated as free.
- Counts use distinct retailer IDs. Multiple variants or offers from one
  retailer never increase retailer depth.
- Production rows prove approved mappings and current offers. They do not prove
  that an unapproved source catalogue does not carry a product. Accordingly,
  `SOURCE_COVERAGE_GAP` means that current approved evidence does not provide a
  usable additional retailer, not that no retailer sells the product.
- “Second-retailer contribution” below is the transparent cross-sectional
  proxy of participation on a product with exactly two current fresh retailers;
  it does not claim historical causal attribution.

## Production inventory and catalogue depth

| Measure | Current production readback |
|---|---:|
| Product rows | 1,399 |
| Active, unmerged products | 1,357 |
| Retailers | 13 |
| Offer rows on active products | 4,361 |
| Retailer-product rows on active products | 4,361 |
| Active mappings with no offer row | 0 |
| Product variants | 4,070 |
| Fresh valid offers | 2,785 |

### Active-product states

| State | Products | Active catalogue |
|---|---:|---:|
| A. No retailer mapping at all | 1 | 0.1% |
| B. Mapped but no usable fresh retailer | 389 | 28.7% |
| C. Exactly one fresh retailer | 776 | 57.2% |
| D. Real comparison depth, 2+ | 191 | 14.1% |
| E. Strong comparison depth, 3+ | 37 | 2.7% |
| 4+ fresh retailers | 11 | 0.8% |
| 5+ fresh retailers | 1 | 0.1% |

### Exact distinct-retailer distribution

| Fresh retailers | Products | Active catalogue |
|---:|---:|---:|
| 0 | 390 | 28.7% |
| 1 | 776 | 57.2% |
| 2 | 154 | 11.3% |
| 3 | 26 | 1.9% |
| 4 | 10 | 0.7% |
| 5+ | 1 | 0.1% |

## Current retailer contribution

`Mapped rows` counts active-product `retailer_products`; `mapped products` is
the corresponding distinct product count. `Shared` means the retailer covers a
product also covered by another current fresh retailer. `Depth 2` and `depth
3+` are present-day comparison participation. Freshness reliability is fresh / 
(fresh + otherwise-usable in-stock stale offers), not a workflow-success rate.

| Score rank | ID | Retailer | Mapped rows / products | Fresh offers / products | Unique | Shared | Depth 2 | Depth 3+ | Priority-category products | In-stock stale | Freshness reliability | Latest offer check (UTC) | Internal score |
|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| 1 | 3 | Whey Okay | 870 / 489 | 484 / 202 | 98 | 104 | 77 | 27 | 116 | 179 | 73.0% | 2026-11-04 09:21:17 | 84.8 |
| 2 | 14 | 10 Reps | 950 / 246 | 678 / 214 | 181 | 33 | 17 | 16 | 142 | 143 | 82.6% | 2026-11-04 09:54:50 | 74.1 |
| 3 | 12 | eBay UK | 237 / 161 | 153 / 110 | 4 | 106 | 87 | 19 | 58 | 74 | 67.4% | 2026-11-04 13:22:18 | 60.0 |
| 4 | 10 | Jon's Supplements | 506 / 171 | 366 / 154 | 111 | 43 | 36 | 7 | 74 | 1 | 99.7% | 2026-11-04 12:37:35 | 57.5 |
| 5 | 11 | 6 Pack Supplements | 506 / 193 | 346 / 151 | 101 | 50 | 35 | 15 | 63 | 42 | 89.2% | 2026-11-04 10:50:02 | 56.6 |
| 6 | 9 | Fit House | 286 / 175 | 164 / 127 | 91 | 36 | 26 | 10 | 61 | 11 | 93.7% | 2026-11-04 09:53:43 | 49.0 |
| 7 | 15 | Gladiator Nutrition | 603 / 90 | 346 / 83 | 62 | 21 | 10 | 11 | 61 | 0 | 100.0% | 2026-11-03 16:16:39 | 38.7 |
| 8 | 7 | Simply Supplements | 120 / 120 | 115 / 115 | 115 | 0 | 0 | 0 | 15 | 0 | 100.0% | 2026-11-04 12:57:37 | 31.9 |
| 9 | 4 | Discount Supplements | 156 / 41 | 84 / 29 | 6 | 23 | 9 | 14 | 25 | 35 | 70.6% | 2026-11-04 14:54:01 | 22.1 |
| 10 | 1 | GYM HIGH | 66 / 25 | 48 / 21 | 7 | 14 | 10 | 4 | 16 | 1 | 98.0% | 2026-11-04 12:02:23 | 19.2 |
| 11 | 5 | Dolphin Fitness | 3 / 3 | 1 / 1 | 0 | 1 | 1 | 0 | 1 | 2 | 33.3% | 2026-11-04 13:07:06 | 3.9 |
| 12 | 8 | KIOR Health | 11 / 11 | 0 / 0 | 0 | 0 | 0 | 0 | 0 | 10 | 0.0% | 2026-11-03 15:28:54 | 0.0 |
| 13 | 13 | Predators Gear | 47 / 30 | 0 / 0 | 0 | 0 | 0 | 0 | 0 | 47 | 0.0% | 2026-08-29 13:32:36 | 0.0 |

The leading unique-coverage retailers are 10 Reps (181), Simply Supplements
(115), Jon's (111), 6 Pack (101) and Whey Okay (98). The leading
second-comparison participants are eBay UK (87), Whey Okay (77), Jon's (36),
6 Pack (35) and Fit House (26). This distinction matters: Simply adds broad
availability but currently adds no multi-retailer comparisons, while eBay adds
only four unique products but participates in 87 exact two-retailer comparisons.

### Internal retailer value score

The score is an internal coverage contribution index, not an endorsement:

- 25% fresh distinct-product coverage, normalized to the current maximum;
- 10% unique coverage, normalized to the current maximum;
- 25% exact-two-retailer participation, normalized to the current maximum;
- 10% three-plus-retailer participation, normalized to the current maximum;
- 20% products in the audited priority categories, normalized to the current
  maximum; and
- 10% freshness reliability as defined above.

## Commercial category depth

The table is ranked from strongest to weakest current 2+ depth. Category
membership is current route/shared semantic truth; it was not re-audited.

| Rank | Category | Semantic products | With fresh offer | 0 | 1 | 2+ | 3+ | Fresh offers | Retailers | 2+ rate |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Testosterone Boosters | 11 | 8 | 3 | 3 | 5 | 1 | 14 | 5 | 45.5% |
| 2 | Vegan Protein | 15 | 12 | 3 | 6 | 6 | 1 | 51 | 9 | 40.0% |
| 3 | Mass Gainer | 16 | 14 | 2 | 8 | 6 | 3 | 76 | 8 | 37.5% |
| 4 | Whey Isolate | 25 | 21 | 4 | 13 | 8 | 3 | 103 | 8 | 32.0% |
| 5 | Carbohydrates | 22 | 18 | 4 | 12 | 6 | 0 | 78 | 8 | 27.3% |
| 6 | Protein Bars | 11 | 8 | 3 | 5 | 3 | 1 | 53 | 6 | 27.3% |
| 7 | Multivitamins | 20 | 15 | 5 | 10 | 5 | 0 | 20 | 7 | 25.0% |
| 8 | Fat Burners | 21 | 15 | 6 | 11 | 4 | 2 | 41 | 7 | 19.0% |
| 9 | Whey Protein | 101 | 70 | 31 | 51 | 19 | 4 | 492 | 9 | 18.8% |
| 10 | Pre Workout | 162 | 122 | 40 | 92 | 30 | 9 | 563 | 9 | 18.5% |
| 11 | Creatine | 86 | 68 | 18 | 53 | 15 | 5 | 140 | 10 | 17.4% |
| 12 | Amino Acids | 99 | 72 | 27 | 55 | 17 | 6 | 259 | 10 | 17.2% |
| 13 | Hydration | 35 | 30 | 5 | 25 | 5 | 3 | 125 | 8 | 14.3% |
| 14 | Nootropics | 13 | 8 | 5 | 7 | 1 | 1 | 16 | 6 | 7.7% |
| 15 | Collagen | 29 | 26 | 3 | 24 | 2 | 0 | 36 | 8 | 6.9% |

Collagen and Nootropics have the weakest percentages, but the highest bounded
commercial opportunity is **Whey Protein, Pre Workout, Creatine, Amino Acids,
then Hydration** because those routes combine intent with much larger zero/one
populations. Whey Isolate is a focused sub-opportunity within Whey Protein.

## Top 25 product-level coverage gaps

Ranking is bounded to active zero/singleton products in audited public intents.
It combines semantic intent weight (5–10, multiplied by four), depth need (28
for one retailer; 22 for zero), current internal recovery evidence (up to 24),
observed outbound clicks (up to 10) and known-brand identity (4). Clicks are a
ranking signal only; they do not affect coverage truth.

| Rank | Product (production ID) | Public intent | Fresh depth / retailer | Primary evidence classification |
|---:|---|---|---|---|
| 1 | Applied Nutrition ISO-XP 1.8kg (`178`) | Whey Protein; Whey Isolate | 1 / Whey Okay | `FRESHNESS_GAP` |
| 2 | Dymatize Iso 100 2.27kg (`134`) | Whey Protein; Whey Isolate | 1 / Whey Okay | `FRESHNESS_GAP` |
| 3 | Optimum Nutrition Micronised Creatine 317g (`231`) | Creatine | 1 / Whey Okay | `SOURCE_COVERAGE_GAP` |
| 4 | Trec CM3 Creatine Powder 250g (`361`) | Creatine | 1 / eBay UK | `FRESHNESS_GAP` |
| 5 | Applied Nutrition Creatine Monohydrate 250g (`742`) | Creatine | 1 / Discount Supplements | `FRESHNESS_GAP` |
| 6 | CNP Whey Isolate 1.8kg (`868`) | Whey Protein; Whey Isolate | 1 / Jon's | `FRESHNESS_GAP` |
| 7 | JNX Sports The Curse 250g (`482`) | Pre Workout | 1 / Whey Okay | `FRESHNESS_GAP` |
| 8 | USN QHUSH Black Pre-workout 220g (`449`) | Pre Workout | 1 / Whey Okay | `SOURCE_COVERAGE_GAP` |
| 9 | Naughty Boy Creatine Monohydrate (`1301`) | Creatine | 1 / 10 Reps | `SOURCE_COVERAGE_GAP` |
| 10 | Time 4 Creatine Blend 240 caps (`86`) | Creatine | 1 / Jon's | `FRESHNESS_GAP` |
| 11 | 7Nutrition Whey Isolate 90 1kg (`68`) | Whey Protein; Whey Isolate | 1 / 6 Pack | `SOURCE_COVERAGE_GAP` |
| 12 | 7Nutrition Creatine HCL 350 caps (`1040`) | Creatine | 1 / 6 Pack | `SOURCE_COVERAGE_GAP` |
| 13 | PEScience TruCreatine+ Powder 161g (`89`) | Creatine | 1 / Whey Okay | `FRESHNESS_GAP` |
| 14 | Trained By JP Performance Isolate Tri Blend 2kg (`875`) | Whey Protein | 1 / Jon's | `FRESHNESS_GAP` |
| 15 | Olimp TCM 1100 120 caps (`360`) | Creatine | 1 / Whey Okay | `FRESHNESS_GAP` |
| 16 | BioTech USA Nitrox Therapy 340g (`55`) | Pre Workout | 1 / Whey Okay | `FRESHNESS_GAP` |
| 17 | Trec CM3 Tri-Creatine Malate 500g (`1067`) | Creatine | 1 / 6 Pack | `FRESHNESS_GAP` |
| 18 | Ghost Vegan Protein 989g (`232`) | Vegan Protein | 1 / Whey Okay | `SOURCE_COVERAGE_GAP` |
| 19 | GYM HIGH Creatine Monohydrate 250g (`389`) | Creatine | 0 | `FRESHNESS_GAP` |
| 20 | Gorillalpha Yeti Juice Pre Workout 480g (`1280`) | Pre Workout | 1 / 10 Reps | `SOURCE_COVERAGE_GAP` |
| 21 | Cellucor C4 Original 30 servings (`1169`) | Pre Workout | 1 / 10 Reps | `SOURCE_COVERAGE_GAP` |
| 22 | Chaos Crew Whey Protein 720g (`1161`) | Whey Protein | 1 / 10 Reps | `SOURCE_COVERAGE_GAP` |
| 23 | Per4m Vegan Protein 908g (`31`) | Vegan Protein | 1 / Whey Okay | `FRESHNESS_GAP` |
| 24 | Ghost 100% Whey Protein 907g (`233`) | Whey Protein | 0 | `SOURCE_COVERAGE_GAP` |
| 25 | Medi-Evil Creatine Monohydrate Shots 400g (`511`) | Creatine | 0 | `FRESHNESS_GAP` |

This list is a prioritization shortlist, not an authorization to change a
mapping or offer. Some rows have several mapped variants at one retailer; only
distinct current retailers count.

## Freshness and root-cause findings

| Freshness measure | Count |
|---|---:|
| Fresh valid offers | 2,785 |
| Offers older than the 24-hour contract on active products | 726 |
| In-stock, otherwise usable, but stale offers | 545 |
| Out-of-stock offers on active products | 1,031 |
| Invalid/unusable non-OOS offers | 0 |
| Products losing potential comparison depth solely to a stale retailer | 70 |

The 70 depth-loss products include ISO-XP, Dymatize Iso100, CNP Whey Isolate,
JNX The Curse, multiple high-intent Creatine products and Per4m Vegan. A product
can have stale offers from the same retailer that remains fresh on another
variant; only a stale *additional distinct retailer* is counted as recoverable
comparison depth.

For the 1,166 products with zero or one fresh retailer, the primary evidence
classification is:

| Classification | Products | Meaning in this audit |
|---|---:|---|
| `SOURCE_COVERAGE_GAP` | 939 | No current approved additional retailer can supply a fresh comparison; source overlap must be proved before mapping. |
| `FRESHNESS_GAP` | 227 | An additional mapped retailer has an otherwise-usable stale offer. |
| Direct `MAPPING_GAP` | 0 | Every current active mapping materializes an offer row. |
| `PRODUCT_NORMALIZATION_GAP` | 0 proved | None is provable from approved production mappings alone; unresolved source rows may still reveal identity work. |
| `UNKNOWN` | 0 | The bounded classifier assigned current evidence to the two primary classes above. |

There is one active product with no retailer mapping at all and 389 mapped
products with no usable fresh retailer. These catalogue states are reported
separately from the direct mapping-to-offer integrity check.

## Existing-retailer opportunity

Current retailers can close a meaningful first slice, not most gaps:

1. Recovering stale mapped second retailers can improve up to 70 products
   without adding an external retailer. eBay, Whey Okay, Predators Gear, KIOR,
   6 Pack and other existing scopes appear repeatedly in the stale evidence.
2. The existing feeds also have unresolved source-to-canonical opportunity.
   Most notably, the Gladiator execution ledger records 249 unmapped source
   variants. Those rows are candidates for read-only identity reconciliation,
   not proof of 249 safe mappings.
3. No approved mapping is missing its offer row, so bulk re-materialization of
   mappings is not the issue.
4. The 939 source-coverage classifications and the 19.2% optimistic ceiling
   after stale-depth recovery prove that existing approved mappings cannot
   close most gaps.

## Gladiator current readback

Historical 599-row context is superseded by production truth:

| Measure | Current value |
|---|---:|
| Retailer ID | 15 |
| Mappings / offer rows on active products | 603 / 603 |
| Distinct mapped active products | 90 |
| Fresh valid offers | 346 |
| Distinct products with fresh coverage | 83 |
| Unique fresh products | 62 |
| Shared fresh products | 21 |
| Exact-depth-2 participation | 10 |
| Depth-3+ participation | 11 |
| In-stock otherwise-usable stale offers | 0 |
| Latest offer check | 2026-11-03T16:16:39.508Z |

Repository governance says Gladiator shared-pipeline adoption **preparation** is
the current RA task. The current 603 scope is at configuration/registration
preparation; activation, migration and live apply remain unauthorized. The
watchdog could not correlate a complete ordinary/apply evidence profile for
Gladiator, even though its production offers were still within the 24-hour
window at this audit timestamp. This audit changes nothing for Gladiator.

## Automation and reliability evidence

The production retailer table is authoritative for inventory; repository
workflows and the latest watchdog explain reliability only. Current mechanisms
are:

- Whey Okay: EKM feed through guarded offer-sync; latest ordinary refresh
  succeeded, but 179 otherwise-usable offers were stale at 24 hours.
- 10 Reps: protected CSV plus shared offer-sync; RA stabilization is verified,
  but 143 otherwise-usable offers were stale and watchdog backlog baselines
  grew.
- eBay UK: Browse API plus guarded exact scope. Core run `41836635201`
  completed refresh stages, but its separate review-queue publication failed
  on `Unknown reason code in row 2`. The watchdog also detected stale/review
  backlog growth. This is a current publishing/contract issue, not evidence
  that the offer apply failed.
- Jon's: dedicated Shopify refresh using shared classifier/plans; current
  freshness is 99.7%. Watchdog reported review-backed backlog outside its
  static baseline, not a failed latest refresh.
- 6 Pack: dedicated WooCommerce reviewed refresh; current reliability is
  89.2%, with review-backed backlog growth.
- Fit House: Shopify reader plus shared offer-sync; latest refresh succeeded,
  while watchdog detected stale/review-scope growth.
- Simply Supplements: shared Shopify path; 115 fresh products but all are
  unique-only. Its latest refresh succeeded; watchdog failed the retailer on
  stale/review-scope baseline drift.
- Discount Supplements: shared Shopify path; latest successful production
  readback at 14:54 UTC superseded the earlier watchdog snapshot, while 35
  otherwise-usable stale offers remained.
- GYM HIGH: dedicated WooCommerce full-catalogue path; source/apply runs
  succeeded. Existing owner-deferred policy remains unchanged.
- Dolphin Fitness: narrow JSON-LD refresh succeeded, but two of three mapped
  offers remained stale.
- KIOR: shared Shopify path. The latest job was successful, but its newest check
  was just older than the 24-hour comparison contract, producing zero fresh
  offers at audit time. A successful job is not equivalent to current coverage.
- Predators Gear: mapped-page/manual read-only evidence, no scheduled apply
  workflow, and all 47 offers stale since August.
- Gladiator: described separately above.

Watchdog run `41846732322` was `FAILED_SYSTEM`, checked 13 retailers and made
zero database writes. It classified five retailer records as failures: Simply,
Fit House, eBay UK and 10 Reps for monitored-backlog growth, plus Gladiator for
incomplete/unresolved evidence correlation. Its static 48-hour monitoring
threshold is not the public 24-hour freshness contract, so this report retains
both signals rather than substituting one for the other.

These are current, bounded reliability issues. They do not authorize reopening
the retailer-automation programme, changing a workflow or applying an offer.

## Is a new retailer needed?

**Yes, after internal remediation and a read-only overlap proof.** A suitable
new source should contribute second retailers across high-intent Whey Protein,
Pre Workout, Creatine and Amino Acids rather than primarily unique long-tail
availability. It should provide exact identifiers/variant evidence, current
stock and price, complete pagination and a refresh cadence compatible with the
24-hour public contract. A reusable feed or supported platform source is
preferable to retailer-specific scraping.

The repository's Retailer Data Source Registry contains current connected
retailer records and only an example “under review” template; it does not name
a current unconnected candidate that can be recommended from repository proof.
No random retailer-site research was performed. Candidate selection therefore
remains a separate read-only evidence unit, not onboarding authorization.

## Ranked execution backlog — do not execute in this audit

| Order | Commercial coverage unit | Problem / affected scope | User impact and expected improvement | Root cause / kind | Production writes eventually required? |
|---:|---|---|---|---|---|
| 1 | Recover current mapped freshness depth | 70 products lose an additional distinct retailer solely to staleness; prioritize the top-25 Whey/Creatine/Pre Workout rows and KIOR/eBay/Whey/Predators/6 Pack evidence. | Restore real comparison on up to 70 products; optimistic 2+ depth rises from 191 to 261 (14.1% to 19.2%). | `FRESHNESS_GAP`; internal remediation through existing guarded paths. | **Yes**, only in a separately authorized bounded run using existing approval/executor contracts. |
| 2 | Reconcile existing source catalogues to high-value singleton products | Current source snapshots, including 249 unmapped Gladiator variants, may overlap the 939 source-gap products, but identity is unproved. | Safely create second-retailer candidates without buying a new source; exact improvement must be measured before approval. | Source-to-canonical/mapping evidence; internal read-only audit first. | Audit: **No**. Approved mappings/offers later: **Yes**. |
| 3 | Repair current review/observability contract gaps | eBay review publication rejects an unknown reason code; watchdog shows baseline/evidence drift for Simply, Fit House, 10 Reps, eBay and Gladiator. | Prevent successful refreshes from losing review evidence and distinguish real stale coverage from monitoring debt. | Internal automation reliability; reuse RA task order and shared mechanisms. | Tests/docs: **No**; any activation/apply: **Yes and separately authorized**. |
| 4 | Score one new broad UK source by exact overlap | Existing approved mappings still leave 939 zero/singleton source gaps; registry has no evidence-backed unconnected candidate. | Select for second-retailer lift in Whey/Pre Workout/Creatine/Amino, not raw SKU count; set a measured go/no-go threshold. | New retailer/source, read-only candidate feed evaluation only. | Evaluation: **No**. Onboarding later: **Yes**. |
| 5 | Re-read coverage and sequence the next programme | Recovery/source units need a fresh production checkpoint against 0/1/2+/3+ and category depth. | Prevents starting Nutrition or onboarding from stale assumptions; selects the higher marginal user-value step. | Read-only governance checkpoint. | **No**. |

## Final decision and stop

**Decision B:** existing retailer coverage needs the specific internal
remediation above, followed by a new retailer/source selected on exact overlap.
Existing retailers cannot close most current gaps: at best the presently proven
stale-depth slice raises genuine comparison coverage only to 19.2%, while 939
zero/singleton products still lack an approved additional source.

Nutrition Data Enrichment should **not** follow immediately after the first
retailer remediation. First complete the bounded existing-source overlap audit,
the candidate-source comparison and the fresh measurement checkpoint. At that
point Nutrition can be re-ranked against measured marginal retailer depth; it
is not started or authorized here.

Exact stop point: documentation of current production truth, recommendation
and a five-unit backlog. No retailer fix, mapping, offer refresh, automation
change, retailer onboarding, feed approval, external service, Nutrition work,
SEO-20 policy change or category work is executed. `SEO-20` remains the sole SEO
task `IN PROGRESS`; broad P1 category cleanup remains closed; Energy Drinks is
not implemented.
