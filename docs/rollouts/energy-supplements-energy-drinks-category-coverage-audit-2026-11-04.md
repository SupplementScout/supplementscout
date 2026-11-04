# Energy Supplements / Energy Drinks category coverage audit

- **Audit date:** 2026-11-04
- **Starting `origin/main`:** `63d4044bc37891e4ffce8f039b8c9cbdbe3cdb1f`
- **Production project:** `aftboxmrdgyhizicfsfu`
- **Scope:** read-only production-backed audit; no implementation
- **Decision:** treat **Energy Drinks as a distinct future commercial intent** and keep broader **Energy Supplements in Search/fallback**. Do not build `/energy-supplements`. A later, separately approved implementation may build `/energy-drinks` with shared Category Coverage semantics and existing CategoryComparison presentation.

## Executive finding

Architecture **B** is the smallest architecture supported by current production evidence:

- `energyDrinks` has a coherent 18-product strong set, 73 fresh offers and five fresh retailers. Seventeen of the 18 products are not represented by any of the four audited existing route memberships. This is useful discovery rather than a second Pre Workout page.
- Its comparison depth is uneven: 13 strong products have a fresh offer, but only one has two or more fresh retailers. A future page should therefore be presented as a discovery/comparison experience with transparent coverage, not as uniformly deep market coverage.
- `energySupplements` resolves to only four strong standalone caffeine dose-form products. It has four fresh offers, three retailers and no multi-retailer product. Expanding it into an umbrella would pull in Pre Workout, amino products, drinks, nootropics, fat burners, vitamins and benefit-copy false positives. It is not a useful independent route today.
- The dimensions are independent and need not be mutually exclusive with existing categories. The one current intentional cross-route overlap is NOCCO Electrolyte Energy Drink with Hydration.

No Energy route, Search behavior, homepage behavior, indexability state or runtime semantic logic changed in this audit.

## Governance and repository preflight

- The repository was fetched before work. `origin/main` matched the required starting SHA exactly.
- Unrelated owner work existed in the root checkout and was preserved. The audit used a clean worktree and branch `audit/energy-supplements-energy-drinks`.
- Project Guardian passed before substantive work: 22 SEO tasks were structurally valid; SEO-20 was the sole `IN PROGRESS` SEO task. The only notice was the already-known stale measurement reminder.
- No completed Energy audit or Energy implementation existed in the current repository.
- Existing systems were inspected before choosing an architecture:
  - shared semantic truth: `app/lib/categoryCoverage.ts`;
  - shared semantic landing loader and UI: `app/lib/categoryCoverageLanding.ts` and `app/components/CategoryCoverageLandingPage.tsx`;
  - richer commercial normalization: `app/lib/categoryComparison.ts`;
  - current Pre Workout membership: exact active/unmerged `Pre Workout`, excluding bundles;
  - current Hydration membership: exact `Hydration` or explicit hydration/electrolyte/hydrate evidence in category/name;
  - current Nootropics and Fat Burners memberships: their shared Category Coverage definitions.
- There was no Energy definition in Category Coverage, no `/energy-drinks` or `/energy-supplements` app route, and no lifecycle registration for either route.
- The homepage's current Energy goal points to `/pre-workout`; this audit does not recommend or make a homepage change.

## Production read method and completeness

The catalogue evidence was read at `2026-11-04T09:41:20.014Z` using the public anonymous Supabase read path only. The query selected active products with both merge fields null, ordered deterministically by `id ASC`, in complete ranges:

1. `0-999`
2. `1000-1999`, which returned the remaining 357 rows

This proves the full active/unmerged catalogue of **1,357 products** was read. The semantic screen was then applied locally to the complete result; no server-side candidate limit silently truncated the universe. Offers were measured with the existing freshness contract: in stock and checked no more than 24 hours before the audit time. Database writes: **0**.

### Exact broad candidate-universe construction

A product entered the broad candidate universe when any normalized evidence matched:

- canonical category: `Energy Drinks`, `Energy Supplements`, `Pre Workout`, `Electrolytes`, `Hydration`, `Nootropics` or `Fat Burners`; or
- name identity token: energy/energise/energize, caffeine, stimulant/stim, alert/awake/focus/nootropic, hydration/hydrate/electrolyte/isotonic, sports drink, RTD/ready-to-drink, shot, gel, guarana, taurine, B-complex/B12 or carbohydrate; or
- description identity phrase: energy drink/supplement/shot/gel/powder, caffeine capsule/tablet/supplement, pre-workout, ready-to-drink, sports drink, hydration drink/powder or electrolyte drink/powder.

This deliberately broad screen includes adjacent categories and benefit-copy false positives so that exclusion boundaries are measured rather than assumed. It produced **281 candidates**.

### Candidate distribution by current canonical category

| Current category | Candidates |
|---|---:|
| Amino Acids | 9 |
| Creatine | 5 |
| Electrolytes | 13 |
| Energy Drinks | 14 |
| Energy Supplements | 3 |
| Fat Burners | 7 |
| Health Supplements | 34 |
| Hydration | 5 |
| Nootropics | 2 |
| Pre Workout | 163 |
| Protein Bars | 5 |
| Protein Powder | 1 |
| Vitamins | 15 |
| Weight Management | 3 |
| Whey Protein | 2 |
| **Total** | **281** |

The historical screening estimate of roughly 187 is obsolete. The current broad universe is larger principally because production now contains 163 Pre Workout candidates and the audit intentionally includes all nearby conflict families.

### Candidate distribution by product format

| Product format | Candidates |
|---|---:|
| blank / not normalized | 76 |
| capsule | 12 |
| gummy | 2 |
| liquid | 20 |
| powder | 156 |
| ready_to_drink | 1 |
| sachet | 3 |
| snack | 2 |
| softgel | 2 |
| tablet | 7 |
| **Total** | **281** |

The 76 blank formats are why category or format alone cannot be semantic truth.

## Dimension 1: `energyDrinks`

### Definition and fail-closed rules

An Energy Drink is a product whose primary commercial identity is an energy beverage or an explicitly named energy-drink powder. Caffeine, liquid format, RTD wording or the word “drink” alone is insufficient.

**INCLUDE_STRONG**

- The product name explicitly identifies an Energy Drink, including an explicitly named powdered Energy Drink; or
- the exact reviewed `Energy Drinks` category is supported by drink-like name/form evidence such as liquid, ready-to-drink, can or carbonated beverage; or
- an established beverage construction such as “sparkling energy” is supported by beverage form/category evidence.

Independent Energy Drink identity may coexist with Hydration/Electrolyte evidence. It must not be inferred merely from a stimulant or benefit claim.

**EXCLUDE_STRONG**

- Non-drink primary forms: bars, bites, gummies, gels, capsules/tablets and ordinary snacks;
- Pre Workout powders or shots without independent Energy Drink identity;
- Hydration, electrolyte or sports-drink products without independent Energy Drink identity;
- protein RTDs, protein shots and meal-replacement drinks;
- products for which “energy” is only benefit copy;
- generic liquid/RTD status without energy-beverage identity.

**REVIEW_REQUIRED**

- Sports/carbohydrate drinks whose name says “energy” but not Energy Drink;
- standalone energy shots without a clearly separate beverage identity;
- description-only Energy Drink evidence;
- exact category membership whose form contradicts a drink identity or remains unresolved.

Review is the default for unresolved co-identities. Product IDs and names below are evidence, not proposed runtime exceptions.

### Result

| Classification | Count |
|---|---:|
| INCLUDE_STRONG | **18** |
| REVIEW_REQUIRED | **1** |
| EXCLUDE_STRONG | **262** |
| **Candidate universe** | **281** |

### Exact audited strong set

| ID | Product | Current category | Format | Fresh offers | Fresh retailers |
|---:|---|---|---|---:|---:|
| 273 | Applied Nutrition ABE - Energy RTD Drink | Health Supplements | blank | 22 | 4 |
| 331 | High5 Energy Drink Powder 1kg | Health Supplements | blank | 0 | 0 |
| 354 | Ghost Energy Drink 455ml | Health Supplements | blank | 0 | 0 |
| 359 | Cellucor C4 Energy Drink | Protein Bars | blank | 0 | 0 |
| 394 | High5 Energy Drink with Protein 1.6kg | Health Supplements | blank | 0 | 0 |
| 764 | NOCCO Electrolyte Energy Drink 355ml | Energy Drinks | ready_to_drink | 0 | 0 |
| 1296 | RYSE Fuel Energy Drink 12x473ml | Energy Drinks | liquid | 5 | 1 |
| 1297 | Ghost Energy Drink 12 x 500ml | Energy Drinks | liquid | 6 | 1 |
| 1298 | Cellucor C4 Performance Energy Carbonated RTD 12 x 500ml | Energy Drinks | liquid | 4 | 1 |
| 1299 | Bloom Sparkling Energy 12x250ml | Energy Drinks | liquid | 3 | 1 |
| 1302 | EHP Labs OxyShred Ultra Energy Drink RTD 12 x 355ml | Energy Drinks | liquid | 6 | 1 |
| 1303 | Monster Energy 12x500ml | Energy Drinks | liquid | 2 | 1 |
| 1304 | Muscle Moose Moose Juice Energy Drink 12 x 440ml | Energy Drinks | liquid | 3 | 1 |
| 1308 | Applied Nutrition ABE (All Black Everything) Carbonated Can 12x330ml | Energy Drinks | liquid | 10 | 1 |
| 1398 | Ghost Lifestyle Energy Drink | Energy Drinks | liquid | 5 | 1 |
| 1415 | 3D Energy Drink | Energy Drinks | liquid | 2 | 1 |
| 1417 | EHP Labs OxyShred Ultra Energy Drink RTD 355ml | Energy Drinks | liquid | 4 | 1 |
| 1419 | EHP Labs OxyShred Infinity Energy Drink 355ml | Energy Drinks | liquid | 1 | 1 |

The exact `Energy Drinks` category contributes 13 strong products, not 14. Five additional strong identities sit outside it: four in Health Supplements and one incorrectly under Protein Bars.

### Review set

| ID | Product | Current category | Reason | Fresh offers |
|---:|---|---|---|---:|
| 450 | Trec Vitargo Electro Energy 1050g | Health Supplements | Carbohydrate/sports-drink identity is explicit, but independent Energy Drink identity is not | 3 |

### Commercial coverage

- Strong products: **18**
- Fresh offers: **73**
- Strong products with at least one fresh offer: **13**
- Strong products with no fresh offer: **5**
- Distinct retailers with fresh offers: **5** — 10 Reps, Fit House, Gladiator Nutrition, Whey Okay and eBay UK
- Strong products with two or more fresh retailers: **1**
- Strong products with three or more fresh retailers: **1**
- Products with exactly one fresh retailer: **12**

The one genuinely multi-retailer product is ID 273, with four fresh retailers. Its 22 fresh offers also show why offer count must not be mistaken for broad multi-retailer depth. The set is viable for discovery and cross-product pricing, but current like-for-like retailer competition is shallow.

## Dimension 2: `energySupplements`

### Definition and fail-closed rules

Production evidence does not support Energy Supplements as a broad umbrella. The only coherent strong identity is a standalone caffeine/stimulant supplement in a supplement dose form, independent of Pre Workout or another primary category.

**INCLUDE_STRONG**

- Standalone caffeine/stimulant primary identity with capsule/tablet dose-form evidence; or
- exact reviewed `Energy Supplements` category supported by standalone stimulant identity.

**EXCLUDE_STRONG**

- Energy Drinks and other beverage identities;
- Pre Workout, Nootropics, Fat Burners, Hydration and Electrolytes where those are the primary identity;
- B vitamins, multivitamins, magnesium, adaptogens or other health supplements where energy is only benefit/metabolism copy;
- amino, carbohydrate, creatine and protein products without independent Energy Supplement identity;
- bars, gels, food, meal replacements and ordinary sports drinks;
- caffeine-free or caffeine-containing products whose primary identity is another category.

**REVIEW_REQUIRED**

- Named amino/EAA/BCAA “Energy” co-identities;
- Energy gummies or ambiguous non-tablet/capsule dose forms;
- generic stimulant, adaptogen or shot identities without enough evidence to separate them from Pre Workout, Nootropics or food/beverage intent.

### Result

| Classification | Count |
|---|---:|
| INCLUDE_STRONG | **4** |
| REVIEW_REQUIRED | **4** |
| EXCLUDE_STRONG | **273** |
| **Candidate universe** | **281** |

### Exact audited strong set

| ID | Product | Current category | Format | Fresh offers | Fresh retailers |
|---:|---|---|---|---:|---:|
| 513 | Trec Nutrition Caffeine 200 Plus - 60 caps | Health Supplements | blank; capsule evidence in name | 1 | 1 |
| 1098 | Olimp Nutrition Caffeine Kick 60 Capsules | Energy Supplements | capsule | 1 | 1 |
| 1101 | BioTech USA Caffeine + Taurine 60 Capsules | Energy Supplements | capsule | 1 | 1 |
| 1338 | SKILL Nutrition Caffeine | Energy Supplements | tablet | 1 | 1 |

### Review set

| ID | Product | Current category | Format | Reason | Fresh offers |
|---:|---|---|---|---|---:|
| 80 | Optimum Nutrition Amino Energy 270g | Amino Acids | powder | Amino + Energy co-identity | 12 |
| 173 | Optimum Nutrition EAA Energy 432g | Amino Acids | blank | EAA + Energy co-identity | 0 |
| 1309 | Warrior Amino Blast BCAA with Added Energy 270g | Amino Acids | powder | BCAA + Energy co-identity | 3 |
| 1310 | Ruly Energy Gummies 12x42g | Energy Drinks | gummy | Energy identity, but neither a drink nor a clear standalone caffeine dose-form supplement | 3 |

### Commercial coverage

- Strong products: **4**
- Fresh offers: **4**
- Strong products with at least one fresh offer: **4**
- Strong products with no fresh offer: **0**
- Distinct retailers with fresh offers: **3** — 10 Reps, 6 Pack Supplements and Whey Okay
- Strong products with two or more fresh retailers: **0**
- Strong products with three or more fresh retailers: **0**

This is adequate Search coverage for a narrow caffeine-tablet/capsule intent, not enough breadth or comparison depth for a broad Energy Supplements route.

## Existing-route overlap

Overlap was evaluated against the current production membership functions, not category labels alone.

| Energy dimension | Pre Workout | Hydration / Electrolytes | Nootropics | Fat Burners |
|---|---:|---:|---:|---:|
| Energy Drinks strong (18) | 0 (0%) | 1 (5.6%) | 0 (0%) | 0 (0%) |
| Energy Supplements strong (4) | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) |

- The Energy Drinks/Hydration overlap is ID 764, NOCCO Electrolyte Energy Drink. Its name independently supports both identities, so overlap is intentional.
- Seventeen Energy Drinks strong products (94.4%) are outside all four audited existing route memberships. A dedicated Energy Drinks experience would therefore add useful discovery rather than duplicate Pre Workout.
- All four Energy Supplements strong products are outside the audited existing routes, but the set is too small and commercially shallow to justify a route.
- No Pre Workout product is admitted merely because its name or copy mentions energy. This prevents the proposed Energy Drinks page from becoming a second Pre Workout page.

## Current canonical and Search behavior

Production route/Search readback was performed with read-only HTTP GETs on 2026-11-04.

- `/energy-drinks`: **404**
- `/energy-supplements`: **404**
- Exact Search does not redirect either term to a category route.
- `/search?q=energy%20drinks`: 14 product links — the full canonical `Energy Drinks` label set, comprising 13 strong identities plus the Ruly gummy false positive. It misses all five strong products stored outside that category: 72.2% semantic recall, 92.9% precision against the audited strong set.
- `/search?q=energy%20drink`: 18 product links — 17 audited strong identities plus the Ruly gummy false positive. It misses ID 273: 94.4% recall and 94.4% precision.
- `/search?q=energy%20supplements`: three product links, all strong, but it misses ID 513 in Health Supplements: 75% recall for the strict strong set.
- `/search?q=caffeine`: 21 product links, including all four Energy Supplements strong products, but also caffeine-free Pre Workouts, Nootropics, Fat Burners and other caffeine-adjacent identities. For the strict Energy Supplements intent only 4/21 are strong.
- `/search?q=energy`: the first 24-result page mixes Energy Drinks with Pre Workouts, amino products, an energy bar, a protein bite and an electrolyte gel. Broad text Search is appropriately broad but is not semantic category truth.

The Search variation between singular and plural demonstrates low recall from raw phrase/category matching. Broad “energy” and “caffeine” demonstrate noisy precision for category intent. Search remains useful fallback and was not modified.

### Canonical false positives and missing coverage

- **False positive:** ID 1310 Ruly Energy Gummies is canonically `Energy Drinks` but is a gummy.
- **Missing Energy Drinks strong identities:** IDs 273, 331, 354 and 394 are in Health Supplements; ID 359 is in Protein Bars.
- **Missing Energy Supplements strong identity:** ID 513 is in Health Supplements.
- **Split commercial formats:** Energy Drinks contains cans/RTDs, while two explicit powdered Energy Drinks are outside the category. Format should be a presentation subtype/filter, not a reason to fragment semantic truth into separate routes.
- **Blank formats:** several clear legacy identities lack normalized `product_format`; rules cannot require format as the only positive evidence.

## Representative conflicts and boundaries

| Boundary | Production evidence | Audited outcome |
|---|---|---|
| Pre Workout vs Energy Drink | ID 1428, PER4M Energy Pre-Workout Shot 100ml | Exclude from both strong Energy sets: Pre Workout shot is the primary identity; “energy” and shot/RTD form are insufficient. |
| Pre Workout marketing | ID 961, Cellucor C4 Original – Energy, Focus & Performance Pre-Workout | Exclude: explicit Pre Workout identity overrides benefit language. |
| Hydration/Electrolyte vs Energy Drink | ID 764, NOCCO Electrolyte Energy Drink 355ml | Strong Energy Drink and intentional Hydration overlap because both identities are explicit. |
| Hydration RTD not Energy Drink | ID 1307, Activit Sparkling Vitamin Water | Exclude: sparkling hydration/vitamin-water identity does not establish Energy Drink. |
| Energy gel vs Energy Supplement | ID 1330, High5 Energy Gel Electrolyte | Exclude from Energy Drink and strong Energy Supplement: gel/endurance identity is primary. |
| Powdered Energy Drink | IDs 331 and 394, High5 Energy Drink powders | Include Energy Drinks because Energy Drink is explicit primary identity; expose powder as a subtype. |
| Caffeinated supplement | IDs 513, 1098, 1101 and 1338 | Strong Energy Supplements; caffeine identity plus dose form does not make them Pre Workout. |
| Nootropic vs Energy Supplement | ID 235, Ghost Gamer Nootropic 40 Servings | Exclude Energy Supplement without independent primary Energy Supplement identity. |
| Fat Burner/weight-management adjacency | ID 522, L-Carnitine Energy Support | Exclude: weight-management/ingredient identity plus benefit wording is insufficient. |
| Health copy mentioning energy | ID 389, GYM HIGH Creatine | Exclude: energy-supply copy does not replace Creatine identity. |
| Protein/meal RTD | IDs 1313/1314 Huel Ready-to-drink products and ID 1316 Applied Nutrition Protein Shot | Exclude: RTD/shot form alone is not Energy Drink identity. |
| Ambiguous carbohydrate sports drink | ID 450, Trec Vitargo Electro Energy | Review Required; do not infer Energy Drink from “Energy” plus carbohydrate-drink copy. |
| Canonical contradiction | ID 1310, Ruly Energy Gummies | Exclude Energy Drink; Review Required for Energy Supplements. Category label is candidate evidence, not final truth. |

These are fixture/evidence candidates for later regression tests. They must not become ID, slug, exact-name, brand or retailer branches in runtime logic.

## Architectural recommendation

1. **Do not create `/energy-supplements`.** Keep “Energy Supplements” as Search/fallback. The useful strict subset is standalone caffeine supplements, and current breadth/multi-retailer depth do not justify a page.
2. **A future `/energy-drinks` should exist**, but only in a separately approved implementation after a fresh production read. It is a standalone commercial intent, not an umbrella over Pre Workout/Hydration and not a child page of `/energy-supplements`.
3. **Use one shared semantic truth.** Add a single `energy-drinks` definition to `app/lib/categoryCoverage.ts`; if form-aware conditions are required, extend the generic `CategoryCoverageProduct`/condition field support with optional `product_format`. Do not create a parallel Energy rule engine.
4. **Use the existing richer CategoryComparison normalization/presentation for the future route.** Energy Drinks need pack/volume/unit context, delivered prices and explicit fresh-retailer depth. A thin Energy Drinks loader may compose `evaluateCategoryCoverage` for membership with `normalizeCategoryComparison` for offers/pricing. It must not duplicate semantic rules in the loader or page.
5. **Use format as a subtype/filter, not a page split.** At minimum distinguish RTD/can/bottle from explicitly named powder. Do not create separate canned, RTD, powdered or “Energy Supplements” routes from this evidence.
6. **Preserve intentional overlap.** Explicit electrolyte Energy Drinks may also belong to Hydration. Ordinary Hydration/Electrolyte products remain out. Pre Workout RTDs/shots remain out unless they have independent Energy Drink identity.
7. **Do not change existing routes.** No Pre Workout, Hydration, Nootropics or Fat Burners refactor is supported by this audit. The later Hydration/Electrolytes audit remains separate.

### Can existing Category Coverage represent the semantics?

Yes. Its INCLUDE_STRONG / EXCLUDE_STRONG / REVIEW_REQUIRED precedence is the correct ownership model. The only generic capability likely needed later is an optional `product_format` condition so a canonical gummy contradiction can fail closed without exact-name logic. Candidate retrieval and commercial presentation need composition with existing shared loaders; they do not need a second semantic engine.

### Why richer CategoryComparison is warranted

The strong set mixes single cans, multipacks and powders, and current prices are not directly comparable without volume/weight/unit context. `CategoryComparison` already owns fresh-offer normalization, delivered-price handling, price-per-litre/weight/unit fields, retailer counts and coverage summaries. `CategoryCoverageLandingPage` is adequate for simpler semantic discovery but would not by itself explain these commercial differences as clearly.

## Bounded implementation contract for a later task

This contract is evidence for a future owner-authorized task; none of it was executed here.

### Semantic dimensions

- Implement only `energyDrinks` / definition key `energy-drinks`.
- Keep `energySupplements` as an audited non-route Search/fallback concept.
- Do not build a general supplement-goals ontology.

### Candidate retrieval

- Retrieve active/unmerged products using generic evidence: exact `Energy Drinks` category; explicit Energy Drink/energy RTD/sparkling-energy name evidence; and tightly bounded description candidates for review.
- Include `name`, `category`, `description` and `product_format` in semantic evidence, plus existing comparison fields/offers for presentation.
- Paginate deterministically until exhaustion. Do not inherit a silent 1,000-row or first-page-only candidate cap.
- Candidate query broadness must not decide membership; run every candidate through the shared evaluator.

### Shared truth and presentation

- Membership truth: `app/lib/categoryCoverage.ts`, with a generic optional `product_format` field if required.
- Retrieval/commercial normalization: existing shared Category Coverage candidate mechanisms plus `app/lib/categoryComparison.ts`.
- A thin Energy Drinks comparison loader may compose those systems, but may contain no duplicate semantic classifier.
- Public page: `/energy-drinks` only. No dynamic category catch-all.

### Expected production baseline

- `energyDrinks`: 18 strong, 1 review, 262 exclude from the 281-candidate audit universe.
- A fresh implementation read must explain any drift from this timestamp; it must not force counts with ID/name exceptions.
- Expected initial lifecycle state: **`planned`**. This audit does not authorize registration, indexing, sitemap/canonical changes or an indexability threshold. A later implementation must follow `docs/SEO-Indexability-Lifecycle.md` and preserve its cache, robots, canonical, sitemap and error contracts.

### Required regression coverage

- Shared evaluator fixtures for all three states and precedence.
- Explicit Energy Drink names inside and outside the canonical category are strong.
- Canonical gummy/non-drink contradiction is excluded, without an exact-name/ID rule.
- Explicit powdered Energy Drinks are strong and retain powder subtype.
- Pre Workout powder/RTD/shot without independent Energy Drink identity is excluded.
- Hydration/Electrolyte alone is excluded; the independent dual identity is allowed.
- Protein RTD, protein shot, meal replacement, energy bar/bite and energy gel are excluded.
- Ambiguous sports/carbohydrate drink and description-only evidence fail closed to review.
- Candidate retrieval pagination proves no truncation.
- CategoryComparison tests cover fresh-offer filtering, retailer counts, delivered price and applicable litre/weight/unit presentation.
- Route/lifecycle contract tests cover registered route uniqueness, cache, planned robots/canonical behavior, sitemap policy, error behavior, pagination and raw Search escape.
- Existing Pre Workout, Hydration, Nootropics, Fat Burners, Search resolver and homepage tests remain unchanged and green.
- Production verification must re-read strong/review sets, fresh offers, retailers, 2+/3+ retailer depth, route response, canonical/robots/lifecycle behavior and unresolved review threads.

### Explicit implementation prohibitions

- No `/energy-supplements` route.
- No Pre Workout alias page.
- No Hydration/Electrolytes implementation or refactor.
- No canned/RTD/powder sub-routes.
- No product-ID, slug, exact-name, brand or retailer membership exceptions.
- No second category engine.
- No production write, migration, lifecycle/indexability threshold change, Search change, homepage change or SEO-20 policy change under this audit.

## Audit closeout facts

- Production database writes: **0**
- Migrations/config/auth/secrets changes: **0**
- Runtime/app changes: **0**
- Route/indexability/canonical/sitemap/metadata/Search/homepage changes: **0**
- SEO-20: unchanged and still the sole active SEO implementation
- Protein taxonomy: unchanged and remains closed
- Hydration/Electrolytes: not started
- STOP point: this document and its delivery verification only; no Energy implementation follows from this audit
