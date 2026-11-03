# Fat Burners and Weight Management category coverage integrity audit

Date: 2026-11-03

Audit state: complete, read-only; no category implementation authorised or performed

Starting `main`: `a2183802e71546b06cd9bf9e0dc0fdf18590de17`

Production catalogue evidence: `2026-11-03T14:00:46.509Z` through
`2026-11-03T14:06:04.417Z`

Public HTML evidence: `2026-11-03T14:02:47.033Z` and
`2026-11-03T14:04:43.863Z`

## Scope, preflight and safety

This audit changed no `app/**` runtime, `categoryCoverage.ts`, category route,
Search behaviour, homepage behaviour, product category, sitemap, lifecycle,
database/schema file, migration, workflow, production configuration, SEO-20 or
PER4M file. Database writes were `0`.

Fresh `origin/main` remained the expected SHA. The primary checkout contained
unrelated user work, so the audit used the isolated worktree
`C:\Projects\supplementscout\.worktrees\category-coverage-fat-weight-audit` on
branch `audit/category-coverage-fat-burners-weight-management`.
`npm run verify:project` passed before the audit: 22 SEO tasks were valid,
SEO-20 was the sole `IN PROGRESS` task and its title-experiment freeze remained
intact. The Testosterone Boosters route remains `planned`, `noindex, follow`
and excluded from the sitemap.

Production catalogue evidence used only the public client inputs used by
`app/lib/supabase.ts`: `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. A temporary wrapper allowed only `GET`/`HEAD`,
rejected `/rpc/`, and used no service-role, admin, migration, validator,
approver or executor credential. Across the completed evidence captures there
were 14 successful Supabase REST `GET` responses and 14 ordinary public-site
`GET` responses. One earlier local TLS attempt failed before an HTTP response
and produced no evidence or write. The successful methods were all `GET`; RPC
calls and writes were `0`. The final catalogue read used two ranges,
`0-999/1399` and `1000-1398/1399`, and found 1,399 product rows, including
1,357 active, unmerged canonical products.

The temporary readback tools were not retained. A generic harness is not yet
justified: the shared application evaluator already provides the reusable
contract, while durable audit input shapes are still evolving after only two
categories.

## Existing architecture and current public flow

`CategoryCoverageDefinition` and `evaluateCategoryCoverage()` already support
multi-membership: the same product can be evaluated independently by two
definitions. Candidate retrieval, semantic membership and offer/display state
remain separate. No architecture change is required for this audit or the next
Fat Burners unit.

Neither audited label has a definition or approved comparison route. Source
and live homepage HTML agree that `categoryBrowseHref()` falls through to:

- Fat Burners: `/search?q=Fat%20Burners`
- Weight Management: `/search?q=Weight%20Management`

Both are general text searches over name, brand, category and description, not
semantic category membership.

## Current public result sets

Offer notation is `retailer mappings / offers / fresh offers / fresh in-stock`.
Membership is independent of these values.

### Fat Burners

The live result count is `8`, in this order:

| Rank | ID | Product | Canonical category | Offer evidence; retailers | Fat audit |
| ---: | ---: | --- | --- | --- | --- |
| 1 | 1358 | TWP Diced V2 Stim Fat Burner 60 Capsules | Fat Burners | 1/1/1/1; 10 Reps | INCLUDE_STRONG |
| 2 | 1357 | AK-47 Burner 60 Capsules | Fat Burners | 1/1/1/1; 10 Reps | INCLUDE_STRONG |
| 3 | 1311 | EHP Labs OxyShred 80 Gummies 400g | Fat Burners | 1/1/1/1; 10 Reps | INCLUDE_STRONG |
| 4 | 1139 | Trec Nutrition Clenburexin 90 Capsules | Fat Burners | 2/2/1/1; eBay UK, 6 Pack Supplements | INCLUDE_STRONG |
| 5 | 1105 | Trec Nutrition Clenburexin 180 Capsules | Fat Burners | 2/2/2/2; 6 Pack Supplements, eBay UK | INCLUDE_STRONG |
| 6 | 1430 | Rich Piana All Day You Shred 325g | Fat Burners | 2/2/2/2; Gladiator Nutrition | INCLUDE_STRONG |
| 7 | 1305 | Animal Cuts Powder 248g/265g | Fat Burners | 2/2/2/2; 10 Reps | INCLUDE_STRONG |
| 8 | 163 | Dorian Yates Black Bombs 60 Tablets | Health Supplements | 2/2/2/1; Whey Okay, eBay UK | INCLUDE_STRONG |

All eight are true positives. The first seven match because their canonical
category is the exact phrase. Product 163 is admitted through description text
(`fat burners`), showing that the public set is still phrase-dependent.

### Weight Management

The live result count is `14`, in this order:

| Rank | ID | Product | Category | Offer evidence; retailers | Weight audit |
| ---: | ---: | --- | --- | --- | --- |
| 1 | 1177 | Applied Nutrition L-Carnitine 3000 Liquid 480ml | Weight Management | 6/6/6/6; 10 Reps | REVIEW_REQUIRED |
| 2 | 428 | Trec L-Carnitine 3000 Liquid Apricot 500 ml | Weight Management | 2/2/1/1; eBay UK, Whey Okay | REVIEW_REQUIRED |
| 3 | 504 | EHP Labs Acetyl L-Carnitine 100g | Weight Management | 1/1/1/1; Whey Okay | REVIEW_REQUIRED |
| 4 | 93 | JNX Sports The Ripper Fat Burner Powder 150g | Weight Management | 14/14/7/7; eBay UK, Whey Okay | INCLUDE_STRONG |
| 5 | 527 | GYM HIGH L-Carnitine Liquid 500 ml | Weight Management | 3/3/2/2; GYM HIGH, Whey Okay | REVIEW_REQUIRED |
| 6 | 1314 | Huel Lite Ready-to-Drink 8 x 500ml | Weight Management | 4/4/4/4; 10 Reps | REVIEW_REQUIRED |
| 7 | 1313 | HUEL Ready-to Drink 8x500ml | Weight Management | 7/7/7/7; 10 Reps | EXCLUDE_STRONG |
| 8 | 522 | Olimp L-Carnitine 1500 Extreme 120 Capsules | Weight Management | 2/2/2/2; eBay UK, Whey Okay | REVIEW_REQUIRED |
| 9 | 507 | Animal Cuts Fat Burner 42 Packs | Weight Management | 3/3/2/2; 10 Reps, Whey Okay, 6 Pack Supplements | INCLUDE_STRONG |
| 10 | 239 | Ghost Burn Fat Burner 40 Servings | Weight Management | 1/1/0/0; Whey Okay | INCLUDE_STRONG |
| 11 | 100 | HR Labs Fever 40 Fat Burner 75 Caps | Weight Management | 1/1/1/0; Whey Okay | INCLUDE_STRONG |
| 12 | 102 | PEScience Alphamine Thermogenic 244g | Weight Management | 1/1/0/0; Whey Okay | INCLUDE_STRONG |
| 13 | 103 | PEScience Alphamine Thermogenic 60 Capsules | Weight Management | 1/1/0/0; Whey Okay | INCLUDE_STRONG |
| 14 | 652 | Sea Kelp Capsules 4200mg | Health Supplements | 1/1/1/1; Simply Supplements | EXCLUDE_STRONG |

The result mixes six strong fat-loss identities, five ingredient-only
L-Carnitine rows, two Huel meals and one description-only Sea Kelp match. This
is direct evidence of a source/search catch-all, not one coherent public browse
family.

## Diagnostic public searches

These reads generated candidates; they are not membership truth. IDs preserve
the live order:

| Query | Count | Ordered product IDs |
| --- | ---: | --- |
| `fat burner` | 20 | 1358, 93, 507, 239, 100, 1357, 1311, 1139, 1105, 1430, 1305, 163, 90, 498, 497, 367, 508, 95, 102, 103 |
| `fat burners` | 8 | 1358, 1357, 1311, 1139, 1105, 1430, 1305, 163 |
| `fat loss` | 3 | 388, 97, 95 |
| `thermogenic` | 8 | 102, 103, 498, 497, 367, 508, 177, 52 |
| `shred` | 11 | 1419, 1417, 1311, 1186, 1302, 891, 498, 497, 508, 1430, 91 |
| `burner` | 20 | 1357, 1358, 93, 507, 239, 100, 1311, 1139, 1105, 1430, 1305, 163, 90, 498, 497, 367, 508, 95, 102, 103 |
| `weight management` | 14 | 1177, 428, 504, 93, 527, 1314, 1313, 522, 507, 239, 100, 102, 103, 652 |
| `weight loss` | 4 | 602, 98, 501, 99 |
| `meal replacement` | 1 | 1383 |
| `l-carnitine` | 11 | 666, 1177, 428, 504, 1020, 527, 522, 606, 615, 239, 94 |

The false matches in these diagnostic sets include accessories, pre-workouts,
energy drinks, creatine gummies, vitamins and a mass gainer. Adding more Search
synonyms would increase blast radius rather than solve membership.

## Candidate-generation and dual-classification contract

The broad union used exact source categories; product name/category/description
signals; all mandatory identities; repository-reviewed mappings; and explicit
fat burner, thermogenic, shred/OxyShred, cuts, ripper, Clenburexin, weight loss,
diet/slimming, meal replacement, L-Carnitine, CLA and MCT evidence. Generic
context terms deliberately generated negatives so precision could be audited.

- Fat-specific generation matched `46` rows.
- Weight-specific generation matched `114` rows.
- The combined active canonical universe is `114` unique products.
- Every row received both classifications.
- Fat Burners: `21 INCLUDE_STRONG`, `77 EXCLUDE_STRONG`, `16 REVIEW_REQUIRED`.
- Weight Management: `28 INCLUDE_STRONG`, `65 EXCLUDE_STRONG`,
  `21 REVIEW_REQUIRED`.

The classification groups below are exhaustive and total 114.

### INCLUDE_STRONG for both: 21

`90` Nutrex Lipo 6 Black Ultra Concentrate; `93` JNX The Ripper Fat Burner;
`95` Nutrex Lipo6 Black Keto; `100` HR Labs Fever 40 Fat Burner; `102` and
`103` PEScience Alphamine Thermogenic; `163` Dorian Yates Black Bombs; `239`
Ghost Burn Fat Burner; `367` GYM HIGH The Stacker; `497` OxyShred Stim; `498`
OxyShred Non-Stim; `501` Hydroxycut Hardcore Super Elite; `507` Animal Cuts
Fat Burner; `508` GYM HIGH Shred Mode; `1105` and `1139` Trec Clenburexin;
`1305` Animal Cuts Powder; `1311` OxyShred Gummies; `1357` AK-47 Burner;
`1358` TWP Diced V2 Stim Fat Burner; `1430` Rich Piana All Day You Shred.

There are no Fat-Burner-only strong members. The evidence therefore supports
future multi-membership, but does not make Weight Management a suitable public
parent route.

### Weight-Management-only INCLUDE_STRONG: 7

`76` Boditronics Diet Whey 1.8kg; `77` Boditronics Diet Whey 900g; `185` GYM
HIGH Slimming Protein 1000g; `751` Applied Nutrition Diet Whey 1.8kg; `752`
Applied Nutrition Diet Whey 1kg; `1233` PhD Diet Whey 1kg; `1234` PhD Diet Whey
2kg. These are explicit diet/slimming identities, not Fat Burners.

### REVIEW_REQUIRED for both: 16

`91` Project AD Shredabull (Shred identity but insufficient captured semantic
proof); `94` Mutant Carnitine; `98` 7Nutrition MCT Oil; `99` Nutrex Lipo6 CLA;
`428` Trec L-Carnitine 3000; `504` EHP Acetyl L-Carnitine; `519` Olimp MCT Oil;
`522` Olimp L-Carnitine 1500; `527` GYM HIGH L-Carnitine; `591` CLA Capsules;
`602` Glucomannan; `666` Acetyl L-Carnitine; `891` Conteh Pre Shred; `1020`
7Nutrition L-Carnitine; `1122` Trec MCT Gold Oil; `1177` Applied Nutrition
L-Carnitine 3000.

Ingredient identity or an ambiguous `Shred` name is candidate evidence, not
automatic strong membership.

### Weight-only REVIEW_REQUIRED: 5

`96` Nutrex Lipo 6 Aqua Loss (water-loss/diuretic identity); `97` Rich Piana
Keto aSalt; `601` Psyllium Husk; `653` Apple Cider Vinegar Gummies; `1314` Huel
Lite RTD. Their evidence could support a future narrower reviewed family, but
does not justify Fat Burner membership or a public Weight Management route.

### EXCLUDE_STRONG for both: 65

Exact IDs:

`52, 144, 151, 153, 177, 388, 390, 405, 407, 424, 462, 476, 551, 562, 564,
566, 567, 570, 572, 575, 576, 581, 584, 585, 586, 590, 596, 599, 604, 606,
609, 610, 611, 612, 613, 615, 616, 618, 622, 627, 629, 632, 633, 635, 637,
638, 648, 652, 655, 658, 662, 664, 668, 669, 670, 1084, 1186, 1302, 1313,
1372, 1381, 1382, 1383, 1417, 1419`.

These cover explicit pre-workouts, accessories, ordinary nutrition/health
products admitted by generic description language, OxyShred-branded creatine
and energy drinks, regular Huel RTD, and a mass gainer whose description happens
to mention meal replacement. The subtype or product identity overrides an
incidental benefit/brand term.

## Mandatory findings and direct answers

All mandatory rows are active, unmerged canonical products.

| Product | Current production state | Fat Burners | Weight Management | Current visibility and decision |
| --- | --- | --- | --- | --- |
| GYM HIGH Shred Mode | ID 508; Health Supplements; 3 mappings/offers, 3 fresh in-stock; GYM HIGH, Whey Okay, Fit House | INCLUDE_STRONG | INCLUDE_STRONG | Missing from both exact searches. Explicit description says thermogenic fat burner. It belongs to both semantic dimensions. |
| Animal Cuts Fat Burner | ID 507; Weight Management; 3/3, 2 fresh in-stock; 10 Reps, Whey Okay, 6 Pack | INCLUDE_STRONG | INCLUDE_STRONG | Visible only under Weight Management. Explicit fat-burner identity belongs to both. |
| JNX The Ripper | ID 93; Weight Management; 14/14, 7 fresh in-stock; eBay UK, Whey Okay | INCLUDE_STRONG | INCLUDE_STRONG | Visible only under Weight Management. Canonical label must not block Fat membership. |
| Trec Clenburexin 180 | ID 1105; Fat Burners; 2/2, 2 fresh in-stock; 6 Pack, eBay UK | INCLUDE_STRONG | INCLUDE_STRONG | Visible under Fat Burners only. Reviewed identity is a fat-burning product family. |
| Trec Clenburexin 90 | ID 1139; Fat Burners; 2/2, 1 fresh in-stock; eBay UK, 6 Pack | INCLUDE_STRONG | INCLUDE_STRONG | Visible under Fat Burners only. Same semantic family. |
| Rich Piana All Day You Shred | ID 1430; Fat Burners; 2/2, 2 fresh in-stock; Gladiator | INCLUDE_STRONG | INCLUDE_STRONG | Visible under Fat Burners only; exact reviewed category supports the Shred identity. |
| AK-47 Burner | ID 1357; Fat Burners; 1/1 fresh in-stock; 10 Reps | INCLUDE_STRONG | INCLUDE_STRONG | Visible under Fat Burners only; explicit Burner plus reviewed category. |
| HUEL RTD | ID 1313; Weight Management; 7/7 fresh in-stock; 10 Reps | EXCLUDE_STRONG | EXCLUDE_STRONG | Visible under Weight Management. Ready-to-drink complete-food identity alone is not a weight-management intervention and never belongs under Fat Burners. |
| Trec L-Carnitine 3000 | ID 428; Weight Management; 2/2, 1 fresh in-stock; eBay UK, Whey Okay | REVIEW_REQUIRED | REVIEW_REQUIRED | Visible under Weight Management. Standalone L-Carnitine must not auto-include in either category. |
| Olimp MCT Oil | ID 519; Health Supplements; 2/2 fresh in-stock; Whey Okay, eBay UK | REVIEW_REQUIRED | REVIEW_REQUIRED | Missing from both exact searches. Standalone MCT is candidate evidence only. Current parallel Trec MCT product is ID 1122 and is also review. |

Generic caffeine and stimulant products are excluded unless the product has
independent explicit fat-burner/thermogenic identity. A pre-workout mentioning
thermogenesis is not automatically a Fat Burner.

## Metrics, category-label quality and overlap

| Metric | Fat Burners | Weight Management |
| --- | ---: | ---: |
| Current public results | 8 | 14 |
| Expected strong members | 21 | 28 |
| Visible strong true positives | 8 | 6 |
| False positives | 0 | 2 |
| Visible review rows | 0 | 6 |
| Missing strong members | 13 | 22 |
| Recall | 38.1% | 21.4% |
| Precision (`true positives / all visible`) | 100.0% | 42.9% |

Strong Fat Burners by canonical category: 7 Fat Burners, 6 Weight Management
and 8 Health Supplements. Therefore 14/21 strong members are outside the exact
Fat Burners label. All seven exact-category rows are strong; exact-category
false positives and reviews are both `0`.

Strong Weight Management members by canonical category: 6 Weight Management,
7 Fat Burners, 8 Health Supplements and 7 Whey Protein. Therefore 22/28 are
outside the exact Weight Management label. Of the 13 exact-category rows, only
6 are strong, 6 require review and 1 is a strong exclude. The source label is
neither sufficiently precise nor sufficiently complete.

Four-way strong matrix:

- both strong: `21`;
- Fat-Burners-only strong: `0`;
- Weight-Management-only strong: `7`;
- neither strong: `86`.

Sixteen products are `REVIEW_REQUIRED` in both dimensions; five additional
products are Weight-only review, so `21` unique products have at least one
review state.

## Root causes

Counts can overlap because a row may have more than one cause.

| Root cause | Fat Burners | Weight Management |
| --- | ---: | ---: |
| `CATEGORY_LABEL_MISMATCH` / `SOURCE_CATEGORY_TOO_NARROW` | 14 strong outside exact category | 22 strong outside exact category |
| `SEARCH_PHRASE_MISMATCH` | 13 missing strong | 22 missing strong |
| `SEMANTIC_ALIAS_MISSING` | 13 missing strong | 22 missing strong |
| `INGREDIENT_ONLY_AMBIGUITY` | 14 ingredient-only reviews | 14 ingredient-only reviews |
| `SOURCE_CATEGORY_TOO_BROAD` | 0 exact-category false positives | 1 exact-category false positive plus 6 exact reviews |
| `MEAL_REPLACEMENT_VS_FAT_BURNER_CONFLATION` | 0 visible | 2 Huel rows visible; 1 mass-gainer diagnostic false match |
| `WEIGHT_MANAGEMENT_CATCH_ALL` | not applicable | 8/14 visible rows are non-strong |
| `DESCRIPTION_ONLY_MATCH` | 1 extra current result (ID 163) | 1 current false positive (Sea Kelp 652) |
| `CURRENT_OFFER_PRESENTATION_FILTER` | 0 | 0 |
| `INACTIVE_PRODUCT` / `MERGED_PRODUCT` | 0 | 0 |
| `NO_USABLE_OFFER` | 0 missing members explained | 0 missing members explained |
| `PUBLIC_BROWSE_ARCHITECTURE_LIMITATION` | 13 missing strong | 22 missing strong |

## Taxonomy relationship decision

| Model | User clarity and semantic correctness | SEO, scale and implementation risk | Decision |
| --- | --- | --- | --- |
| A: independent `/fat-burners` and `/weight-management` routes | Fat Burners is clear; Weight Management mixes fat burners, diet protein, meals and ingredients. | Would publish an unstable, claim-sensitive catch-all and weak breadcrumb owner. | Reject now. |
| B: Weight Management parent, Fat Burners child | The 21 strong Fat rows are a conceptual subset of a broad weight goal. | Parent boundary is not production-ready: 6/13 exact rows strong, 6 review, 1 exclude. | Defer; not a safe public parent. |
| C: only Fat Burners becomes semantic; Weight Management remains a source label | Gives users one precise product family and avoids presenting food/ingredient products as equivalent interventions. | Reuses the proven lifecycle and Category Coverage path with the smallest blast radius. | **Recommended.** |
| D: split Weight Management into future child audits | Diet/slimming protein, meal replacement and ingredient-support families may each become coherent later. | Requires separate evidence and claim-safe naming; not the next unit. | Future option after P0 work. |

Weight Management is therefore a broad catalogue/source goal, not currently a
coherent public semantic category. Fat Burners should be implemented as an
independent semantic category now, not exposed beneath a public Weight
Management parent. The audit nevertheless proves multi-membership is needed:
all 21 strong Fat Burners are also defensible members of the abstract broader
weight-management goal.

## Data quality versus semantic membership

The seven exact Fat Burners labels are reliable but cover only one third of the
strong set. Six explicit Fat Burners are stored under Weight Management and
eight under the coarse Health Supplements label. These are data-quality debts,
but changing a single canonical category would not represent multi-membership.

Weight Management is populated from retailer/source mapping and currently
mixes explicit fat burners, standalone L-Carnitine and ready-to-drink food.
That is evidence of `WEIGHT_MANAGEMENT_CATCH_ALL`, not authorization to relabel
production products. Semantic browse membership should be fixed independently;
any later canonical cleanup needs a separate reviewed data unit.

## Architecture sufficiency, risks and exact next unit

The existing engine is sufficient. Two definitions can independently evaluate
the same product; no new relationship type, product-ID path, slug exception,
retailer condition or runtime special case is required. Candidate retrieval
can be broad while rendering remains restricted to `INCLUDE_STRONG`.

Main risks are treating `Weight Management` as reviewed truth, auto-including
L-Carnitine/CLA/MCT/caffeine, allowing an OxyShred brand token to override an
explicit Energy Drink or Creatine subtype, and confusing offer freshness with
membership. Review cases must continue to fail closed.

Exact recommended next implementation unit, requiring its own owner-authorized
implementation contract:

> Add one shared `fat-burners` CategoryCoverage definition and a dedicated
> `/fat-burners` browse route in `planned` lifecycle state. Use the 114-row
> dual-audit universe as fixtures/negative protection, with exactly 21 strong
> members, 16 review cases and 77 strong excludes for the Fat dimension. Route
> only the Fat Burners homepage label to it, preserve Search, breadcrumbs,
> database categories, SEO-20 and PER4M, and keep offer presentation downstream.
> Do not add a Weight Management definition or public route yet.

Collagen remains the next P0 category candidate after the authorised Fat
Burners implementation unit. This audit did not inspect or change Collagen.

The exact stop point is this evidence-backed Model C decision and durable audit
record. No Fat Burners or Weight Management implementation, route, homepage
change, Search change, lifecycle/sitemap change, database mutation or SEO-20
change was performed.
