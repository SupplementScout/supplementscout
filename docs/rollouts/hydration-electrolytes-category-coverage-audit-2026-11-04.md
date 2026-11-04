# Hydration / Electrolytes category coverage audit

- **Audit date:** 2026-11-04
- **Starting `origin/main`:** `6ebdfd9de8070cfdb29a2a4957169c3336845df2`
- **Production project:** `aftboxmrdgyhizicfsfu`
- **Scope:** read-only production-backed audit of the existing `/hydration` experience; no implementation
- **Decision:** keep `/hydration` and retain its CategoryComparison presentation. Consolidate its membership later into shared Category Coverage semantic authority, with Electrolytes as an independently evaluated subtype/filter inside Hydration. Do **not** create `/electrolytes`.

## Executive finding

The existing customer-facing concept is sound, but its route-specific semantic rule is slightly incomplete and slightly permissive:

- Production supports **35 Hydration strong** products and **24 Electrolytes strong** products. Every Electrolytes strong product is also Hydration strong; Electrolytes therefore has 100% containment in Hydration. Hydration also has 11 strong products without explicit Electrolytes identity.
- The production page's current cached set contains 34 products: 31 audited strong, two Review Required and one false positive. It misses four strong products, but three already satisfy the current rule and are cache-snapshot lag. Only one is a true rule miss: an explicitly isotonic product.
- Live cached recall is **88.6%** and precision is **91.2%**. The current rule at catalogue steady state would reach **97.1% recall** and **91.9% precision**. The semantic fix needed later is bounded: admit explicit isotonic identity, fail closed on vitamin water and electrolyte energy gel ambiguity, and exclude plain functional water.
- Hydration has real comparison depth: 126 fresh valid offers across eight retailers, 30 strong products with a fresh offer, five products with at least two fresh retailers and three with at least three.
- Electrolytes is commercially useful as a subtype/filter, not as a second route. A separate route would duplicate all 24 products while splitting a set that currently has only one multi-retailer product.

No runtime, route, Search, homepage, lifecycle, sitemap, indexability or production-data behavior changed in this audit.

## Governance and repository preflight

- The repository was fetched before work and `origin/main` matched the required starting SHA exactly.
- Unrelated owner changes existed in the root checkout and were preserved. Work used clean branch `audit/hydration-electrolytes` in a separate worktree.
- Project Guardian passed before substantive work: 22 SEO tasks were structurally valid, and SEO-20 remained the sole SEO task `IN PROGRESS`. The only notice was the existing stale measurement reminder.
- No completed Hydration/Electrolytes semantic coverage audit already existed. Historical Hydration rollout evidence described an older, smaller catalogue snapshot and was treated as context rather than current proof.
- The current Operating Plan, SEO Execution Plan, Agent Operating Model and SEO Indexability Lifecycle were read before the audit.
- The already closed Energy audit was not reopened. Only the current boundary overlap needed by this audit was re-read.

## Existing architecture

`/hydration` does **not** currently use the shared Category Coverage semantic evaluator.

- `app/lib/hydrationComparison.ts` owns a route-specific candidate query and route-specific membership rule. An active/unmerged product is included when its exact category is `Hydration`, or when `hydration`, `electrolyte(s)` or `hydrate` appears in normalized category/name text.
- The candidate query separately looks for exact category `Hydration` or hydration/electrolyte/hydrate name evidence. It has a fixed 1,000-row limit. The candidate query and the local membership filter are therefore two related pieces of semantic truth, rather than one shared evaluator.
- The rule does not inspect description or `product_format`, and it cannot return Review Required.
- The loader correctly reuses `normalizeCategoryComparison` for offer freshness, delivered-price normalization and comparison presentation.
- `app/hydration/page.tsx` reuses the established CategoryComparison UI, lifecycle cache, filters, sorting, JSON-LD and decision panel. The presentation does not need replacement.
- `app/lib/categoryCoverage.ts` has no Hydration or Electrolytes definition. `categoryCoverageLanding.ts` and `CategoryCoverageLandingPage.tsx` do not own this route.
- `/hydration` is registered once as `live_verified`; its cache, robots, canonical, sitemap and error contracts already exist. This audit supports no lifecycle change.
- The exact-category Search resolver does not redirect Hydration or Electrolytes. The homepage's Hydration discovery link correctly targets `/hydration`; its Electrolytes discovery remains raw Search.
- `categoryRoutes.ts` maps canonical `Hydration` to `/hydration`, but canonical `Electrolytes` products do not receive that comparison breadcrumb. A later shared semantic owner can remove that exact-category blind spot without adding a route.

Duplicated or fragile semantic truth therefore exists across the Hydration query/filter, exact canonical-category navigation, Search goal mapping and page copy. It was recorded, not refactored.

## Production read method and completeness

The final catalogue evidence was read at **2026-11-04T10:19:26.104Z** through the public anonymous Supabase REST read path only. The query selected active products with both merge fields null, ordered deterministically by `id ASC`, and paginated to exhaustion:

1. range `0-999`;
2. range `1000-1999`, which returned the remaining rows.

The full active/unmerged catalogue contained **1,357 products**. The broad semantic screen was applied locally only after the complete catalogue had been retrieved. There was no silent 1,000-row candidate truncation. Production database writes: **0**.

Fresh commercial coverage used the existing CategoryComparison contract. A qualifying offer had to be in stock; checked within the prior 24 hours and not in the future; have a positive price, retailer product ID, valid HTTP(S) URL and identified retailer; and otherwise satisfy the existing relation normalization.

### Broad candidate-universe construction

A product entered the deliberately broad but bounded universe when any of these conditions held:

- canonical category was `Hydration`, `Electrolytes`, `Energy Drinks` or `Energy Supplements`;
- its name contained hydration, hydrate, rehydrate/rehydration, electrolyte(s), isotonic, sports drink, oral rehydration/ORS, mineral salt, sodium, potassium, magnesium, intra-workout or fluid-replacement evidence; or
- its description contained the same semantic concepts, explicit replacement of fluids/salts/minerals, or sweat evidence near sodium, potassium, magnesium or minerals.

This retrieval screen intentionally included ordinary minerals, energy products, amino products and other conflicts. Candidate retrieval did not decide membership. It produced **95 candidates**.

### Candidate distribution by canonical category

| Current category | Candidates |
|---|---:|
| Accessories | 1 |
| Amino Acids | 10 |
| Creatine | 3 |
| Electrolytes | 13 |
| Energy Drinks | 14 |
| Energy Supplements | 3 |
| Health Supplements | 32 |
| Hydration | 5 |
| Vitamins | 13 |
| Whey Protein | 1 |
| **Total** | **95** |

### Candidate distribution by product format

| Product format | Candidates |
|---|---:|
| blank / not normalized | 16 |
| capsule | 17 |
| gummy | 2 |
| liquid | 14 |
| powder | 34 |
| ready_to_drink | 1 |
| sachet | 1 |
| tablet | 10 |
| **Total** | **95** |

Format is useful supporting evidence and useful for presentation/filtering, but it cannot be required: two Hydration strong products and one Electrolytes strong product have blank format.

## Dimension 1: `hydration`

### Definition and precedence

Hydration membership requires explicit primary hydration/rehydration, electrolyte or isotonic sports-hydration identity. Benefit wording or ingredient presence alone does not replace product identity.

**INCLUDE_STRONG**

- explicit hydration, hydrate, rehydrate or rehydration identity in the product name;
- explicit electrolyte identity in the product name;
- explicit isotonic identity supported by a sports-hydration powder identity; or
- reviewed Hydration/Electrolytes category evidence supported by powder format where the name does not contradict it.

Explicit co-identities such as amino + hydration, creatine + hydration, clear whey + hydration, carbohydrate + electrolyte or electrolyte Energy Drink may be intentional multi-membership.

**EXCLUDE_STRONG**

- accessories and plain alkaline/ionised water;
- ordinary magnesium, potassium, sodium, calcium, zinc, multivitamin or mineral products without explicit hydration/electrolyte/isotonic identity;
- Pre Workout or intra-workout products where electrolytes/hydration appear only as ingredients or benefit copy;
- general health, protein, amino, carbohydrate or energy products without independent primary Hydration identity;
- description-only benefit wording that does not establish a product identity.

**REVIEW_REQUIRED**

- vitamin water/soft-drink identity inside the canonical Hydration category;
- electrolyte energy gel where gel/endurance identity conflicts with the broader Hydration comparison intent;
- sports drink, amino bundle or generic drink with hydration identity only in description;
- any unresolved conflict after positive and negative evidence is applied.

Precedence is: non-product/plain-water and explicit contradictory forms first; ordinary-mineral exclusion next; explicit primary identity next; bounded description-only ambiguity next; otherwise exclude. Ambiguity fails closed.

### Result

| Classification | Count |
|---|---:|
| INCLUDE_STRONG | **35** |
| REVIEW_REQUIRED | **5** |
| EXCLUDE_STRONG | **55** |
| **Candidate universe** | **95** |

### Exact Hydration strong set

The Electrolytes column marks the independent Electrolytes classification, not ingredient presence.

| ID | Product | Current category | Format | Electrolytes strong |
|---:|---|---|---|:---:|
| 37 | Applied Nutrition BCAA Amino Hydrate 450g | Amino Acids | blank | No |
| 335 | High5 ZERO Electrolytes 20 Tablets | Health Supplements | blank | Yes |
| 677 | OstroVit Electrolytes Orange 20 Effervescent Tablets | Health Supplements | tablet | Yes |
| 721 | Osavi Collagen & Electrolytes Orange & Grapefruit | Health Supplements | powder | Yes |
| 762 | HR Labs Wattr 40 servings | Hydration | powder | No |
| 764 | NOCCO Electrolyte Energy Drink 355ml | Energy Drinks | ready_to_drink | Yes |
| 770 | Applied Nutrition Creatine + Hydration 30 servings | Creatine | powder | No |
| 849 | EFECTIV Hybrid Creatine + Hydration 300g | Creatine | powder | No |
| 856 | Trained By JP EAA + Hydration 300g | Amino Acids | powder | No |
| 887 | PER4M Hydrate Electrolyte Mix 210g | Health Supplements | powder | Yes |
| 892 | Efectiv Hydration Electrolytes 330g | Health Supplements | powder | Yes |
| 926 | PER4M Hydrate Unflavoured 159g | Health Supplements | powder | No |
| 942 | Trained By JP Hydration 300g | Health Supplements | powder | No |
| 977 | Naughty Boy Hydration – Advanced Electrolyte Support | Health Supplements | powder | Yes |
| 989 | Osavi Collagen & Electrolytes 30 Servings | Health Supplements | powder | Yes |
| 1016 | 7Nutrition Isotonic Gold 1000g | Health Supplements | powder | Yes |
| 1055 | CNP Loaded H2O 300g | Hydration | powder | No |
| 1060 | Scivation XTEND EAAs + Electrolytes 40 Servings | Amino Acids | powder | Yes |
| 1093 | ActivLab Isoactive Electrolyte 630g | Electrolytes | powder | Yes |
| 1173 | Darkstims Electrolytes Advanced Hydration Formula 195g | Electrolytes | powder | Yes |
| 1180 | Refined Nutrition Ultra Hydration 300g | Electrolytes | powder | Yes |
| 1199 | XO Fitness Daily Hydration Electrolyte Drink Sachets 10 x 6g | Electrolytes | powder | Yes |
| 1200 | MyProtein Pro x HYROX THE Electro Hydration Powder 291g | Electrolytes | powder | Yes |
| 1285 | Naughty Boy Hydration Electrolyte Drink Mix 255g | Electrolytes | powder | Yes |
| 1286 | SiS HYDRO+ Electrolyte Drink Mix 20 x 4.5g | Electrolytes | powder | Yes |
| 1287 | Alpha Neon Hydron8 Advanced Hydration Formula 450g | Electrolytes | powder | Yes |
| 1288 | MyProtein Pro x HYROX THE Electrofuel Carbohydrate & Electrolyte Powder | Electrolytes | powder | Yes |
| 1319 | Olimp Sport Nutrition Iso Plus 1505g | Electrolytes | powder | Yes |
| 1355 | EHPLabs Hydreau 316g | Electrolytes | powder | Yes |
| 1356 | Swole Lifestyle HYDR8 150g | Electrolytes | powder | Yes |
| 1389 | TWP Hydraplenish Electrolytes | Health Supplements | powder | Yes |
| 1391 | TWP Nutrition Replenish Carb/Electrolyte Powder | Health Supplements | powder | Yes |
| 1402 | TWP Nutrition SWEAAT EAA Hydration | Amino Acids | powder | No |
| 1425 | Naughty Boy Hydration 255g | Hydration | powder | No |
| 1429 | PER4M Whey Hydrate 900g | Whey Protein | powder | No |

### Hydration review set

| ID | Product | Current category | Reason | Visible now |
|---:|---|---|---|:---:|
| 394 | High5 Energy Drink with Protein 1.6kg | Health Supplements | Description-only all-in-one sports drink; Energy/Carbohydrate identity remains primary/ambiguous | No |
| 483 | Applied Nutrition Fuel Drink | Health Supplements | Generic Drink name with description-only hydration identity | No |
| 494 | Hydro Amino 2-Pack | Amino Acids | Description calls it a hydration supplement, but amino/bundle identity conflicts | No |
| 1307 | Activit Sparkling Vitamin Water 12 x 330ml | Hydration | Vitamin-water/soft-drink ambiguity | **Yes** |
| 1330 | High5 Energy Gel Electrolyte | Electrolytes | Energy gel with electrolyte variant | **Yes** |

### Hydration format profile

| Classification | blank | powder | ready_to_drink | tablet | liquid | sachet |
|---|---:|---:|---:|---:|---:|---:|
| Strong | 2 | 31 | 1 | 1 | 0 | 0 |
| Review | 3 | 0 | 0 | 0 | 1 | 1 |

## Dimension 2: `electrolytes`

### Definition and precedence

Electrolytes is an independent semantic dimension inside Hydration, not a synonym for the presence of sodium, potassium or magnesium.

**INCLUDE_STRONG**

- explicit electrolyte identity in the name;
- explicit isotonic sports-hydration identity; or
- reviewed canonical Electrolytes category plus supporting powder format and no contradictory primary form.

**EXCLUDE_STRONG**

- ordinary mineral supplements and products in which electrolyte balance is only benefit copy;
- Hydration products with no explicit electrolyte/isotonic identity;
- Pre Workout, amino, creatine, protein, vitamin, energy or general-health products without independent Electrolytes identity;
- accessories and plain functional water.

**REVIEW_REQUIRED**

- Hydration-strong products without explicit electrolyte/isotonic identity;
- electrolyte energy gel because of the conflicting gel intent;
- unresolved description-only electrolyte identity.

Contradictory form is evaluated before positive category/name evidence; explicit Electrolytes/isotonic identity follows; Hydration-only identity then becomes Review Required; all remaining candidates are excluded.

### Result

| Classification | Count |
|---|---:|
| INCLUDE_STRONG | **24** |
| REVIEW_REQUIRED | **12** |
| EXCLUDE_STRONG | **59** |
| **Candidate universe** | **95** |

The exact Electrolytes strong set is the 24 rows marked **Yes** in the Hydration table: IDs 335, 677, 721, 764, 887, 892, 977, 989, 1016, 1060, 1093, 1173, 1180, 1199, 1200, 1285, 1286, 1287, 1288, 1319, 1355, 1356, 1389 and 1391.

### Electrolytes review set

| ID | Product | Reason |
|---:|---|---|
| 37 | Applied Nutrition BCAA Amino Hydrate | Hydration identity without explicit Electrolytes identity |
| 762 | HR Labs Wattr | Hydration identity without explicit Electrolytes identity |
| 770 | Applied Nutrition Creatine + Hydration | Hydration identity without explicit Electrolytes identity |
| 849 | EFECTIV Hybrid Creatine + Hydration | Hydration identity without explicit Electrolytes identity |
| 856 | Trained By JP EAA + Hydration | Hydration identity without explicit Electrolytes identity |
| 926 | PER4M Hydrate Unflavoured | Hydration identity without explicit Electrolytes identity |
| 942 | Trained By JP Hydration | Hydration identity without explicit Electrolytes identity |
| 1055 | CNP Loaded H2O | Hydration identity without explicit Electrolytes identity |
| 1330 | High5 Energy Gel Electrolyte | Energy-gel conflict |
| 1402 | TWP Nutrition SWEAAT EAA Hydration | Hydration identity without explicit Electrolytes identity |
| 1425 | Naughty Boy Hydration | Hydration identity without explicit Electrolytes identity |
| 1429 | PER4M Whey Hydrate | Hydration identity without explicit Electrolytes identity |

### Electrolytes format profile

| Classification | blank | powder | ready_to_drink | tablet | sachet |
|---|---:|---:|---:|---:|---:|
| Strong | 1 | 21 | 1 | 1 | 0 |
| Review | 1 | 10 | 0 | 0 | 1 |

## Existing `/hydration` route accuracy

The readback distinguishes the route's currently rendered lifecycle-cache snapshot from the current membership rule evaluated over the complete catalogue.

### Live cached production page

The production GET returned HTTP 200 with canonical `https://www.supplementscout.co.uk/hydration` and `index, follow`. It rendered 34 base product slugs and reported: **34 products, 122 recently checked offers, eight retailers and five products with multiple recently checked retailers**.

| Measure | Live cached result |
|---|---:|
| Products visible | **34** |
| Audited strong visible | **31** |
| Audited strong missing | **4** |
| Review Required visible | **2** |
| False positives visible | **1** |
| Recall | **31 / 35 = 88.6%** |
| Precision | **31 / 34 = 91.2%** |

Every missing strong product:

| ID | Product | Why missing from this readback |
|---:|---|---|
| 1016 | 7Nutrition Isotonic Gold 1000g | Genuine semantic false negative: `isotonic` is absent from the current query/rule |
| 1319 | Olimp Sport Nutrition Iso Plus 1505g | Already matches the current electrolyte/category rule; lifecycle-cache snapshot lag |
| 1355 | EHPLabs Hydreau 316g | Already matches the current Electrolytes-category rule; lifecycle-cache snapshot lag |
| 1356 | Swole Lifestyle HYDR8 150g | Already matches the current Electrolytes-category rule; lifecycle-cache snapshot lag |

Visible Review Required products are IDs **1307** and **1330**, listed above. The sole visible false positive is ID **1360, Actiph Alkaline Ionised Water**: plain functional water without independent supplement Hydration/Electrolytes identity.

### Current rule at catalogue steady state

Evaluating today's route helper over the same complete production catalogue yields 37 members: 34 strong, two review and one false positive. Its steady-state recall is **34/35 = 97.1%** and precision is **34/37 = 91.9%**. ID 1016 remains the only strong miss. IDs 1319, 1355 and 1356 are therefore cache convergence, not additional rule defects.

The live page's 122 offers versus 128 offers under the current rule is also explained by those cached products. Coverage reporting is snapshot-sensitive; semantic membership must remain independent of offer freshness.

## Current Search and canonical-category coverage

Search was measured by invoking the current read-only `searchProducts` path against the complete public catalogue. This avoided rendering Search pages and therefore avoided analytics/event writes. None of the five exact queries resolves through the exact Category Coverage redirect.

| Query | Current behavior | Audited recall | Audited precision | Finding |
|---|---|---:|---:|---|
| `Hydration` | goal-mapped `ILIKE`; 41 results | 28/35 = **80.0%** | 28/41 = **68.3%** | Misses seven strong identities and admits ordinary mineral/benefit-copy noise |
| `Electrolytes` | raw `ILIKE`; 26 results | 19/24 = **79.2%** | 19/26 = **73.1%** | Plural form misses five strong identities and includes mineral/amino noise |
| `Electrolyte` | raw `ILIKE`; 33 results | 23/24 = **95.8%** | 23/33 = **69.7%** | Misses only the isotonic strong product but has ten non-strong results |
| `Hydration Powder` | format parsed, Hydration goal mapping; 25 results | 23/31 powder strong = **74.2%** | 23/25 = **92.0%** | High precision, incomplete word-form/category recall |
| `Electrolyte Powder` | format parsed; 18 results | 17/21 powder strong = **81.0%** | 17/18 = **94.4%** | Useful fallback but not full subtype truth |

Canonical categories are incomplete and split identity: only five candidates are canonically Hydration and 13 canonically Electrolytes, while the audited strong sets span Amino Acids, Creatine, Energy Drinks, Health Supplements and Whey Protein as well. Conversely, ordinary mineral products can mention electrolyte balance or hydration without becoming category members. Exact category, raw Search and benefit text are therefore candidate evidence, not semantic truth.

## Boundary and overlap verification

### Hydration and Electrolytes

- Both strong: **24**.
- Electrolytes strong outside Hydration strong: **0**.
- Hydration strong without Electrolytes strong: **11**.
- Electrolytes containment in Hydration: **24/24 = 100%**.
- Hydration represented by Electrolytes: **24/35 = 68.6%**.

This is the decisive evidence for a subtype/filter rather than `/electrolytes`.

### Energy Drinks

The freshly checked Energy Drinks strong baseline remains **18**. The sole Hydration strong overlap is ID **764, NOCCO Electrolyte Energy Drink**: **1/35 = 2.9%**. Its name independently expresses both Energy Drink and Electrolyte identities, so multi-membership is legitimate. Ordinary Energy Drinks do not leak into Hydration.

### Pre Workout

Hydration strong overlap: **0**. Electrolytes strong overlap: **0**. A Pre Workout or intra-workout does not become Hydration merely because its ingredients or copy mention electrolytes.

### Amino Acids

Hydration strong overlap with the current Amino route is **4/35 = 11.4%**: IDs 37, 856, 1060 and 1402. Electrolytes strong overlap is **1/24 = 4.2%**: ID 1060. These names independently express amino and hydration/electrolyte identities; description-only amino hydration claims remain excluded/review.

### Carbohydrate and sports-drink boundary

No Hydration strong product is canonically in `Carbohydrates`, but four strong products form the material sports-hydration boundary:

- IDs 1288 and 1391 have explicit carbohydrate + electrolyte co-identity;
- IDs 1016 and 1319 have isotonic sports-hydration identity.

These are legitimate Hydration members because sports-hydration identity is explicit, not because carbohydrate is present. ID 394, High5 Energy Drink with Protein, remains Review Required. An electrolyte energy gel (ID 1330) also remains Review Required rather than being admitted from one token.

### Other material conflicts

- IDs 770 and 849 are explicit Creatine + Hydration multi-members.
- ID 1429 is explicit Whey Hydrate and production evidence supports a dual protein/hydration identity; it is not Electrolytes strong without explicit electrolyte/isotonic evidence.
- ID 1307 shows why canonical Hydration alone is insufficient when the primary form is vitamin water/soft drink.
- ID 1360 shows why the word/category vicinity of hydration must not admit plain functional water.
- Ordinary magnesium/potassium/sodium products are excluded even when descriptions mention hydration or electrolyte balance.

Product IDs and names are audit evidence and future fixtures only. They are not proposed runtime exceptions.

## Commercial coverage

| Measure | Hydration strong | Electrolytes strong |
|---|---:|---:|
| Strong products | **35** | **24** |
| Review Required | **5** | **12** |
| Fresh valid offers | **126** | **70** |
| Distinct fresh retailers | **8** | **8** |
| Products with at least one fresh offer | **30** | **19** |
| Products with no fresh offer | **5** | **5** |
| Products with 2+ fresh retailers | **5** | **1** |
| Products with 3+ fresh retailers | **3** | **1** |

The eight retailers in both dimensions are 10 Reps, 6 Pack Supplements, Discount Supplements, Fit House, Gladiator Nutrition, Jon's Supplements, Whey Okay and eBay UK.

Hydration has sufficient real comparison depth to retain its current CategoryComparison experience. Electrolytes has strong discovery breadth but only one multi-retailer product; separating it into a second page would duplicate products without creating stronger comparison utility.

## Architectural recommendation

1. **Keep `/hydration`.** It is already `live_verified`, has coherent customer intent and sufficient commercial depth.
2. **Keep CategoryComparison presentation.** Its pricing, fresh-offer and retailer-depth handling already fits the set. Do not replace it with a parallel page system.
3. **Harden the semantic boundary later.** Add explicit isotonic identity, exclude plain functional water, and fail closed on vitamin-water and electrolyte-gel conflicts.
4. **Do not create `/electrolytes`.** Every Electrolytes strong product is already Hydration strong, and standalone comparison depth is shallow.
5. **Expose Electrolytes later as a filter/subtype inside `/hydration`.** It is useful discovery metadata, not a separate indexable intent from this evidence.
6. **Use one shared semantic authority.** Category Coverage should own the Hydration route definition and the independent Electrolytes subtype evaluation. Do not retain a route-specific semantic engine.
7. **Allow independent multi-membership.** Amino, Creatine, Energy Drink, carbohydrate/isotonic and protein co-identities remain valid only when each identity has explicit evidence.
8. **Make no new route.** Production evidence supports neither `/electrolytes` nor any format-specific hydration route.

Existing Category Coverage can own the core three-state semantics. It will need a generic way to evaluate a non-route subtype/dimension and optional `product_format` evidence without forcing a second public route. The route-bearing `hydration` definition and internal/filter `electrolytes` dimension should live beside each other in the same shared authority.

## Bounded implementation contract for a later task

This contract is evidence for a separately approved implementation. It was **not** executed.

### Semantic keys and ownership

- Public route-bearing definition key: `hydration`.
- Independent non-route subtype/filter key: `electrolytes`.
- Shared truth owner: `app/lib/categoryCoverage.ts`, extended generically for optional `product_format` evidence and non-route subtype evaluation if needed.
- `app/lib/hydrationComparison.ts` becomes a thin retrieval/composition layer that invokes the shared evaluator and existing `normalizeCategoryComparison`; it contains no second membership classifier.

### Candidate retrieval

- Retrieve active/unmerged products using exact Hydration/Electrolytes category candidates plus explicit hydration/hydrate/rehydration/electrolyte/isotonic evidence.
- Select name, category, description and optional product format for semantic evaluation, and existing comparison fields/offers only for presentation.
- Paginate deterministically to exhaustion. Remove reliance on a single fixed 1,000-candidate ceiling.
- Candidate broadness must never decide membership; every candidate passes through the shared three-state evaluator.
- No ID, slug, exact-name, brand or retailer runtime conditions.

### Expected semantic and route outcome

- Baseline Hydration: 35 strong, five review, 55 exclude in this 95-candidate universe.
- Baseline Electrolytes: 24 strong, 12 review, 59 exclude.
- Expected route delta from the current rule: add the isotonic strong identity represented by ID 1016; remove the two visible review cases represented by IDs 1307 and 1330; remove the false positive represented by ID 1360.
- Expected delta from the current live cache: also allow IDs 1319, 1355 and 1356 to appear after normal cache convergence. The resulting semantic route set is 35 strong products, not a forced ID-based count.
- Any production drift at implementation time must be explained by a fresh semantic read, not patched to these IDs.

### Required regression coverage

- Shared evaluator fixtures cover Include Strong, Review Required and Exclude Strong precedence for both dimensions.
- Explicit hydration/rehydration, electrolyte and isotonic identities are strong.
- Canonical category plus compatible supporting format can be strong; category alone does not override contradictory form.
- Ordinary magnesium/potassium/sodium/mineral products, plain functional water and benefit-copy-only products are excluded.
- Vitamin water and electrolyte energy gel fail closed to review.
- Amino/Creatine/protein/carbohydrate/Energy Drink multi-membership requires independently explicit identities.
- Electrolytes strong is a subset of Hydration strong and powers a filter without registering `/electrolytes`.
- Candidate retrieval pagination proves no truncation and no duplicated semantic filtering.
- Existing CategoryComparison freshness, delivered price, retailer counts, sorting, filtering, pagination, JSON-LD and error behavior remain green.
- Product breadcrumb/navigation behavior uses shared semantic truth where appropriate, without inventing a second route.
- Existing exact Search resolver and homepage behavior remain unchanged unless a separate task explicitly authorizes them.
- Lifecycle contract tests confirm `/hydration` remains the single registered `live_verified` route, canonical and sitemap entry; there is no `/electrolytes` lifecycle record.

### Production readback requirements

- Re-read the complete active/unmerged catalogue with deterministic pagination.
- Report current strong/review/exclude sets for both dimensions and explain drift.
- Verify rendered `/hydration` membership, canonical, robots, cache and error contracts.
- Verify fresh offers, distinct retailers, products with 2+/3+ retailers and filter counts.
- Verify `/electrolytes` remains absent and Search/homepage behavior is unchanged unless separately authorized.
- Verify Project Guardian, Quality Gate, GitGuardian, Vercel where triggered, and zero unresolved review threads.

### Lifecycle and presentation implications

- `/hydration` remains `live_verified`; semantic hardening must not deindex it because coverage fluctuates.
- No lifecycle threshold, sitemap, canonical, robots or indexability change is authorized.
- Retain CategoryComparison. Add only a bounded Electrolytes subtype/filter if later owner-authorized and supported by the shared evaluator.

## Explicit non-goals and closeout facts

- No `/electrolytes` route.
- No `/energy-drinks` implementation and no reopening of the closed Energy audit.
- No Hydration implementation or refactor.
- No Search, exact-category resolver, homepage, navigation, lifecycle, sitemap, canonical, robots, indexability or metadata change.
- No broad taxonomy/catalogue cleanup and no final P1 Category Coverage sweep.
- No production database write, migration, config, auth, secret or external-service change.
- Database writes: **0**.
- Runtime/app changes: **0**.
- SEO-20: unchanged and still the sole SEO task `IN PROGRESS`.
- Exact STOP point: merge and verify this documentation-only audit, then stop before any implementation or final P1 sweep.
