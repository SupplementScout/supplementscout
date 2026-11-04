# Final P1 category coverage sweep

- **Audit date:** 2026-11-04
- **Starting `origin/main`:** `30ae003813ff684b34ff145e16635ed563f48120`
- **Production project:** `aftboxmrdgyhizicfsfu`
- **Scope:** final read-only, production-backed category/discovery sweep; documentation only
- **Closure decision:** **B — category cleanup needs two additional new P1 implementation units**, Amino Acids semantic authority and Carbohydrates semantic discovery, in addition to the already-known Hydration correction unit. Energy Drinks remains a valid but safely deferrable commercial expansion.

## Executive finding

The broad category-cleanup phase now has a bounded finishing line. Most of the remaining surface is either already semantically sound, explicitly closed by a prior production-backed decision, or good enough that further taxonomy work would be polish rather than P1.

Two new material problems remain:

1. **The existing `/amino-acids` route has material recall loss.** Its exact-category loader and route-specific name rule show 80 strong products with 100% audited precision, but the production strong set is 99. Nineteen strong products are missing across Health Supplements, Weight Management, Creatine and Pre Workout. The missing set itself has 30 fresh offers, five retailers and four products with multiple fresh retailers.
2. **Carbohydrates discovery is materially broken.** Production supports a coherent 22-product strong set with 70 fresh offers, seven retailers and four multi-retailer products, but there is no semantic authority or route. The homepage's `Carbohydrates` label falls through to raw Search: only 3 of 22 strong products appear among 14 results, giving 13.6% recall and 21.4% precision.

The smallest correct finishing sequence is therefore:

1. consolidate Amino Acids/BCAA/EAA into shared semantic authority while retaining `/amino-acids` and CategoryComparison;
2. complete the already-bounded Hydration semantic hardening and Electrolytes subtype/filter work;
3. implement one shared `carbohydrates` definition and `/carbohydrates` route with the existing lifecycle and CategoryComparison contracts;
4. close broad category cleanup and return to retailer coverage, nutrition/value data, decision support, retention and traffic work.

The future `/energy-drinks` opportunity is additive rather than a correction to an inaccurate existing route. It can follow later without holding category-cleanup closure open.

No category implementation, route, Search, homepage, lifecycle, sitemap, application, migration or production-data change occurred in this sweep.

## Governance and preflight

- `origin/main` was fetched first and matched the required starting SHA exactly.
- The root checkout contained unrelated owner work. It was preserved unchanged; the audit used clean worktree `C:\Projects\supplementscout\.worktrees\final-p1-category-sweep` on branch `audit/final-p1-category-sweep`.
- Project Guardian passed before substantive work: 22 SEO tasks were structurally valid, SEO-20 was the sole SEO task `IN PROGRESS`, and the only notice was the existing stale weekly-measurement reminder.
- No completed final P1 Category Coverage sweep existed in the repository.
- The current Operating Plan checkpoint, SEO Execution Plan, Agent Operating Model and SEO Indexability Lifecycle were read before the audit.
- Completed Testosterone Boosters, Fat Burners, Collagen, Nootropics and Protein decisions were treated as authoritative. Fresh reads checked for drift but did not reopen their design decisions.
- Energy and Hydration were treated as closed audits with known debt. Neither implementation was started.

## Production method and completeness

The final shortlisted semantic read was captured at **2026-11-04T11:01:39.435Z**. Supporting inventory, shared-definition, Search and live-route reads ran between 10:49 and 11:02 UTC.

The catalogue was read using only the public anonymous Supabase REST path. The query selected active products with both merge fields null, ordered by `id ASC`, and paginated deterministically to exhaustion:

1. range `0-999`;
2. range `1000-1999`, which returned the remaining rows.

The complete active/unmerged catalogue remains **1,357 products**. There was no 1,000-row truncation. Candidate classification happened locally after the complete read.

Fresh commercial coverage used the existing CategoryComparison contract: in stock; positive price; non-future check no more than 24 hours old; valid retailer product ID and HTTP(S) URL; and identified retailer. Offer coverage was never used to decide semantic identity.

Search measurement invoked the current read-only `searchProducts` path against public data. It did not render Search pages or emit Search analytics. Public route checks used HTTP GET only.

- Supabase/public HTTP writes: **0**
- RPC calls: **0**
- Service-role/admin/approver/executor credentials: **0**
- Runtime/app changes: **0**

## Inventory of the major category/discovery surface

The sweep inventoried **28 major category/intents**. It also checked all six homepage goal links: Sleep, Energy, Recovery, Hydration, Muscle growth and General health. Five delegate to existing reviewed routes; Recovery intentionally remains goal-mapped Search fallback and does not justify a separate category route.

Notation in the table:

- `C` = current exact canonical-category count;
- `V` = current visible route/result count;
- `U` = reviewed or approximate semantic universe where measured;
- depth = fresh valid offers / distinct retailers / products with 2+ fresh retailers.

| Intent | Public discovery | C / V / U | Current membership and presentation | Lifecycle | Current depth | Sweep decision / overlap risk |
|---|---|---:|---|---|---:|---|
| Accessories | raw Search | 86 / ~86 / not a supplement semantic family | Exact source category through text Search | Search `noindex` | 25 / 3 / 0 | GOOD ENOUGH fallback; low commercial depth, no category route |
| Amino Acids / BCAA / EAA | `/amino-acids` | 91 / 80 / 110 candidates, 99 strong | Route-specific exact category + name tokens; CategoryComparison | `live_verified` | 233 / 10 / 16 strong | **NEW P1**: 19 strong missing; BCAA/EAA remain subtypes, not routes |
| Carbohydrates | raw Search | 2 / 14 Search results / 34 candidates, 22 strong | Raw text/category/description Search; no semantic authority | Search `noindex` | 70 / 7 / 4 strong | **NEW P1**: highly fragmented and Search precision/recall are materially poor |
| Collagen | `/collagen` | 1 / 29 total strong / 52 audited candidates | Shared Category Coverage; paginated CategoryCoverage landing | `planned`, `noindex` | 36 / 8 / 5 | Closed; no drift in 29-strong baseline |
| Creatine | `/creatine` | 86 / 86 / ~87 strong | Route-specific exact category; CategoryComparison | `live_verified` | 126 / 9 / 13 | GOOD ENOUGH: one explicit strong identity outside category; no P1 false-positive pattern |
| Electrolytes | raw Search inside Hydration decision | 13 / 26 Search results / 24 strong | Raw Search; no independent runtime semantic authority | no separate lifecycle | 70 / 8 / 1 strong audit baseline | Known Hydration debt; subtype/filter only, no `/electrolytes` |
| Energy Drinks | raw Search | 14 / query-dependent / 18 strong | Search fallback only | no route | 73 / 5 / 1 audit baseline | Known deferred route opportunity; do not reopen or implement here |
| Energy Supplements | raw Search | 3 / 3 exact-label results / 4 strict strong | Search fallback | no route | 4 / 3 / 0 strong audit baseline | Closed no-route decision; do not build `/energy-supplements` |
| Fat Burners | `/fat-burners` | 7 / 21 / 114 audited candidates | Shared Category Coverage; CategoryCoverage landing | `planned`, `noindex` | 39 / 6 / 3 | Closed; Weight Management overlap already resolved |
| Glucosamine | `/glucosamine` | 0 / 19 / 19 strong | Shared semantic evaluator in legacy paginated Search landing | legacy indexable | 18 / 2 / 0 | GOOD ENOUGH; precise reviewed identity, shallow but established coverage |
| Health Supplements | raw Search | 442 / 442 / no coherent semantic parent | Exact catch-all source category through Search | Search `noindex` | 560 / 10 / 56 | Reject route: heterogeneous source label, not one customer intent |
| Hydration | `/hydration` | 5 / 34 cached / 95 candidates, 35 strong | Route-specific category/name rule; CategoryComparison | `live_verified` | 126 / 8 / 5 strong audit baseline | Known bounded correction debt; no re-audit |
| Magnesium | `/magnesium` | 0 / 33 / 33 strong | Shared semantic evaluator in legacy paginated Search landing | legacy indexable | 25 / 7 / 2 | GOOD ENOUGH; no material leak or missing family found |
| Mass Gainer | `/mass-gainer` | 16 / 16 / ~18 strong | Route-specific exact category + powder format; CategoryComparison | `live_verified` | 49 / 7 / 5 | GOOD ENOUGH: two Serious Mass rows remain outside; 88.9% approximate recall is not P1 |
| Multivitamins | `/multivitamins` | 0 / 20 / 20 strong | Route-specific Vitamins/Health category + multivitamin tokens; CategoryComparison | `live_verified` | 16 / 6 / 2 | GOOD ENOUGH; coherent set, existing route depth transparent |
| Nootropics | `/nootropics` | 2 / 13 / 67 audited candidates | Shared Category Coverage; CategoryCoverage landing | `planned`, `noindex` | 17 / 6 / 3 | Closed; no drift in 13-strong baseline |
| Omega 3 | `/omega-3` | 0 / 28 / 28 strong | Shared semantic evaluator in legacy paginated Search landing | legacy indexable | 28 / 7 / 5 | GOOD ENOUGH; excluded pet/adjacent oils remain guarded |
| Pre Workout | `/pre-workout` | 163 / 162 / 163 exact candidates | Exact category excluding one bundle; CategoryComparison | `live_verified` | 547 / 8 / 27 | GOOD ENOUGH: all 99 explicit name identities are inside category; only isolated exact-label edge cases |
| Protein Bars | `/protein-bars` | 55 / 11 exact-pack products / bounded exact-pack set | Route-specific category + identity + format + resolved pack; CategoryComparison | `live_verified` | 73 / 6 / 9 across canonical category | Closed SEO-13 exact-pack decision; do not broaden it in this sweep |
| Protein Powder | raw Search | 21 / query-dependent / closed Protein audit | Protein semantic authority exists, but no umbrella route | no route | 95 / 2 / 0 exact category | Closed no-route decision; do not build `/protein-powder` |
| Testosterone Boosters | `/testosterone-boosters` | 6 / 11 / 28 audited candidates | Shared Category Coverage; CategoryCoverage landing | `planned`, `noindex` | 12 / 4 / 4 | Closed; no drift in 11-strong baseline |
| Vegan Protein | `/vegan-protein` | cross-category / 15 / 15 strong | Shared Protein semantic authority; CategoryComparison | `live_verified` | 51 / 9 / 6 audit baseline | Closed at 100% recall/precision |
| Vitamin D | `/vitamin-d` | 0 / 32 / 32 strong | Shared semantic evaluator in legacy paginated Search landing | legacy indexable | 24 / 7 / 3 | GOOD ENOUGH; established explicit identity |
| Vitamins | `/vitamins` | 202 / 146 live / 147 strong | Shared semantic evaluator in legacy paginated Search landing | legacy indexable | 129 / 8 / 12 | GOOD ENOUGH; one-row cache/candidate drift is below P1 and exclusions remain materiality-correct |
| Weight Management | raw Search | 13 / 14 Search results / 114 prior candidates | Catch-all source label through raw Search | no route | 31 / 4 / 2 exact category | Closed prior decision: no public parent route; Fat Burners owns the coherent subset |
| Whey Isolate | `/whey-isolate` | cross-category / 25 / 25 strong | Shared Protein semantic authority; CategoryComparison | `live_verified` | 107 / 8 / 8 audit baseline | Closed at 100% audited recall/precision after implementation |
| Whey Protein | `/whey-protein` | 128 canonical Whey rows / 101 semantic / 101 strong | Shared Protein semantic authority; CategoryComparison | `live_verified` | 499 / 9 / 19 audit baseline | Closed at 100% audited recall/precision after implementation |
| Workout Supplements | raw Search | 1 / ~1 / 1 | Exact source category through Search | no route | 1 / 1 / 0 | Too small and vague; no route or P1 unit |

### Homepage discovery findings

- The first seven mobile category cards are reviewed comparison routes. Additional canonical labels appear only after `View all`; desktop exposes the full list.
- `categoryBrowseHref()` correctly prefers explicit comparison routes and then shared Category Coverage definitions. Remaining canonical labels fall back to raw Search.
- The raw fallback is acceptable for small, vague or explicitly deferred labels when no coherent public intent exists. It is not adequate for Carbohydrates because production supports a coherent strong set and the exact homepage query is both incomplete and noisy.
- `Health Supplements` returns all 442 catch-all rows. It is broad by definition and should not become a route. The final P1 fix is not to build a semantic umbrella around it; narrower shared definitions should continue extracting coherent identities.
- The Recovery goal maps to protein, magnesium and electrolytes through current Search intent. It is an exploratory goal, not a category identity; Help Me Choose remains the stronger decision path. No `/recovery` route is justified.

## Prioritisation model

The first pass used a comparative 0-2 score across the nine requested factors: user/commercial importance, catalogue size, expected recall risk, false-positive risk, category fragmentation, public visibility, multi-retailer depth, architectural fragility and duplication. Scores are triage, not semantic truth. Only families at 12 or above received a fresh three-state deep audit.

| Family | Risk/value score (max 18) | Main evidence | Decision |
|---|---:|---|---|
| Amino Acids / BCAA / EAA | **16** | Prominent live route; strong identities scattered across five other categories; route-specific exact-category loader | Deep validation |
| Carbohydrates | **15** | Homepage label; 2 canonical rows versus broad commercial set; raw Search very noisy | Deep validation |
| Weight Management | 14 | Prior audit already proves 21.4% recall and 42.9% precision | Eliminate: closed no-route decision, do not repeat audit |
| Hydration / Electrolytes | 14 | Known route-specific semantic debt | Eliminate: closed audit, retain bounded debt |
| Energy Drinks | 12 | Coherent future intent but no current route regression | Eliminate: closed audit, known deferred expansion |
| Pre Workout | 9 | Large route but exact-category/name evidence remains concentrated and commercial depth is high | Fast PASS |
| Mass Gainer | 9 | Two strong rows outside route, but current set is coherent and deep enough | Fast PASS |
| Creatine | 8 | One explicit identity outside category; strong exact-category coherence | Fast PASS |
| Vitamins / mineral landings | 7 | Shared semantic evaluator and reviewed exclusions already exist | Fast PASS |
| Protein Bars | 7 | Exact-pack route deliberately narrower than source category | Fast PASS; closed decision |
| Generic source labels | 4-6 | Either too broad, too small or intentionally Search-only | Reject new routes |

## Fast-eliminated GOOD ENOUGH families

### Creatine

- Exact canonical route: 86 products, 126 fresh valid offers, nine retailers and 13 multi-retailer products.
- Seventy-four explicit `creatine`/`Creapure` names are in the category. The remaining exact-category rows are recognisable creatine brands/forms such as CreaTen, Kre-Alkalyn, TCM and CM3.
- Only one explicit strong name sits outside: ID 1394, TWP Nutrition Kick Start AM Creatine/Multi Vit.
- Approximate semantic recall is 86/87 = **98.9%** and audited precision is effectively **100%** for the reviewed exact set.
- One dual-identity row is not a P1 reason to replace a stable live route during the final sweep.

### Pre Workout

- Exact category: 163 products; the live route excludes one explicit bundle and shows 162.
- All 99 names that explicitly say Pre Workout are already inside the canonical category.
- Current commercial depth is 547 fresh valid offers, eight retailers and 27 products with multiple fresh retailers.
- Sampling the non-explicit brand/pump set found legitimate pump/stimulant-free Pre Workout identities. The material edge cases are isolated ingredient/carb rows, not a broad false-positive pattern.
- This is not a P1 semantic rebuild. Any later precision refinement should be evidence-led and must not create a second engine.

### Mass Gainer

- The current route shows all 16 canonical powder rows with 49 fresh offers, seven retailers and five multi-retailer products.
- Two explicit Optimum Nutrition Serious Mass rows remain in Health Supplements. Treating them as strong produces an approximate 18-product set and 88.9% recall.
- The missing pair has commercial value, but the existing route remains coherent, precise and useful. This is below the final P1 threshold and does not justify keeping broad cleanup open.

### Vitamins, Multivitamins, Vitamin D, Magnesium, Omega 3 and Glucosamine

- All use reviewed explicit-identity rules; the five legacy paginated landings share `categoryCoverage.ts` semantic definitions even though their presentation predates the central lifecycle-hub architecture.
- Current strong counts are Vitamins 147, Multivitamins 20, Vitamin D 32, Magnesium 33, Omega 3 28 and Glucosamine 19.
- No material family-wide leak or missing identity pattern was found. Vitamins' live total of 146 versus 147 evaluator-strong rows is a one-row cache/candidate drift, not P1.
- Do not migrate these stable pages merely for architectural uniformity. New work must use the current lifecycle system.

### Protein, Protein Bars and closed Category Coverage families

- Protein remains at the completed semantic-authority baselines: Whey 101, Whey Isolate 25 and Vegan 15 with audited 100% recall/precision after implementation.
- Protein Bars remains its exact-pack comparison rather than all 55 source-category rows.
- Fresh shared-definition evaluation reproduces Testosterone Boosters 11, Fat Burners 21, Collagen 29 and Nootropics 13. No current drift justifies reopening those audits.

### Generic and tiny source labels

- Do not create `/health-supplements`, `/weight-management`, `/protein-powder`, `/energy-supplements`, `/accessories` or `/workout-supplements`.
- Health Supplements and Weight Management are heterogeneous source labels; Protein Powder and Energy Supplements already have explicit closed route decisions; Accessories is not a supplement semantic family; Workout Supplements has one product.
- Search fallback is sufficient where a coherent, commercially useful semantic page is not supported.

## New P1 finding 1: Amino Acids / BCAA / EAA

### Current architecture and root cause

`/amino-acids` is a `live_verified` CategoryComparison route, but its membership is owned by `app/lib/aminoAcidsComparison.ts` rather than shared Category Coverage:

- retrieval is restricted to exact canonical category `Amino Acids`;
- local membership then requires one of a fixed list of name tokens;
- NAC, 5-HTP, Glutathione, bundles and `n-pack` names are excluded;
- the query has a fixed 1,000-row ceiling, though the current exact category is far below it;
- description evidence and strong identities stored in other categories are invisible.

The root cause is **canonical-category confinement plus duplicated route-specific semantics**, not freshness, pricing, cache or missing retailer data.

### Candidate universe and rules

The bounded candidate union contained **110 products**:

- every exact `Amino Acids` product;
- explicit name identity for Amino, BCAA, EAA, Glutamine, Arginine/AAKG, Beta-Alanine, Citrulline, Carnitine, Glycine, Taurine, Tyrosine, Leucine/Isoleucine/Valine, Lysine or HMB;
- named intra-workout candidates for review.

**INCLUDE_STRONG** required explicit primary or named co-primary amino identity. An opaque exact-category brand could become strong only when description explicitly identified Amino Acids/BCAA/EAA as the formula. Independent Creatine + Taurine/HMB or Hydration + EAA/BCAA identities may multi-member.

**EXCLUDE_STRONG** covered adjacent NAC, 5-HTP and Glutathione identities. Ingredient presence in general copy was insufficient.

**REVIEW_REQUIRED** covered opaque exact-category/intra-workout names, bundles/multipacks, protein bundles and Energy formulas where an amino ingredient did not clearly establish the comparison identity. Review fails closed.

### Result and route accuracy

| Metric | Result |
|---|---:|
| Broad candidates | **110** |
| INCLUDE_STRONG | **99** |
| REVIEW_REQUIRED | **7** |
| EXCLUDE_STRONG | **4** |
| Current route visible | **80** |
| Strong visible | **80** |
| Missing strong | **19** |
| Review visible | **0** |
| False positives visible | **0** |
| Recall | **80/99 = 80.8%** |
| Precision | **80/80 = 100.0%** |

The 19 missing strong products are exhaustive audit evidence, not proposed runtime exceptions:

| ID | Product | Current category | Fresh offers |
|---:|---|---|---:|
| 94 | Mutant Carnitine Liquid 1500 473ml | Health Supplements | 0 |
| 112 | 5% Nutrition Rich Piana All Day You May 465g | Amino Acids | 8 |
| 212 | Axe & Sledge The Grind 480g | Amino Acids | 0 |
| 236 | Scitec Nutrition Taurine 90 Capsules | Health Supplements | 0 |
| 365 | BioTech USA Citrulline Malate 90 Capsules | Health Supplements | 1 |
| 428 | Trec L-Carnitine 3000 Liquid Apricot 500ml | Weight Management | 1 |
| 444 | GYM HIGH Beta-Alanine 250g | Health Supplements | 2 |
| 504 | EHP Labs Acetyl L-Carnitine 100g | Weight Management | 1 |
| 516 | GYM HIGH Pure L-Arginine Powder 500g | Health Supplements | 2 |
| 522 | Olimp L-Carnitine 1500 Extreme 120 Capsules | Weight Management | 2 |
| 527 | GYM HIGH L-Carnitine Liquid 500ml | Weight Management | 2 |
| 909 | Strom Sports L-Glutamine 500g | Health Supplements | 0 |
| 918 | CNP L-Glutamine 250g | Health Supplements | 1 |
| 919 | CNP L-Glutamine 500g | Health Supplements | 1 |
| 940 | Trained By JP Glutamine 500g | Health Supplements | 1 |
| 1107 | Trec Nutrition Creatine Monohydrate + Taurine 400g | Creatine | 1 |
| 1154 | Olimp AAKG 1250 Extreme Mega Caps 120 Capsules | Pre Workout | 0 |
| 1177 | Applied Nutrition L-Carnitine 3000 Liquid 480ml | Weight Management | 5 |
| 1241 | Animal Creatine + HMB 327g | Creatine | 2 |

Review set: IDs 39 HR Labs No Code, 40 GAT Muscle Martini, 45 TIME 4 Intra-Workout, 493 Whey Pro Synergy BCAA Bundle, 494 Hydro Amino 2-Pack, 776 Mutant GEAAR and 1101 BioTech USA Caffeine + Taurine.

Exclude set: IDs 729 Soma NAC, 730 Now Foods 5-HTP, 950 7Nutrition L-Glutathione and 970 Jarrow Glutathione.

### Commercial coverage

| Metric | Strong set | Current visible | Missing strong |
|---|---:|---:|---:|
| Products | 99 | 80 | 19 |
| Fresh valid offers | **233** | **203** | **30** |
| Distinct retailers | **10** | 10 | **5** |
| Products with 2+ fresh retailers | **16** | **12** | **4** |

The missing set is commercially material. This is not catalogue polish or an offer-only issue.

### Search and subtype findings

| Query | Results | Target strong | Strong hits | Recall | Precision | Exact redirect |
|---|---:|---:|---:|---:|---:|---|
| `Amino Acids` | 94 | 99 | 82 | 82.8% | 87.2% | none |
| `Amino Acid` | 98 | 99 | 83 | 83.8% | 84.7% | none |
| `BCAA` | 29 | 24 | 24 | **100%** | 82.8% | none |
| `EAA` | 28 | 22 | 22 | **100%** | 78.6% | none |

BCAA and EAA are already discoverable subtypes of the Amino intent. Their Search recall is complete and the live route title already names them. Separate `/bcaa` or `/eaa` routes would duplicate a small subset and are not justified.

### Required architecture

- Keep `/amino-acids`, its `live_verified` state and CategoryComparison presentation.
- Add one shared `amino-acids` definition to `app/lib/categoryCoverage.ts` with three-state precedence.
- Make `aminoAcidsComparison.ts` a thin, paginated candidate/commercial loader over that shared evaluator and `normalizeCategoryComparison`.
- Candidate retrieval must cross canonical categories and paginate deterministically to exhaustion.
- Preserve BCAA/EAA and single-amino identities as independently filterable/subtype evidence if useful; do not create subtype routes.
- Add fixtures for all 110 audited candidates, especially opaque exact-category reviews, derivative exclusions, bundles and legitimate multi-members.
- Re-read the complete catalogue and verify 99 strong / 7 review / 4 exclude as a baseline, explaining drift rather than forcing counts.

This unit must complete before broad category cleanup closes.

## New P1 finding 2: Carbohydrates

### Current architecture and root cause

There is no `/carbohydrates` route or shared definition. The homepage obtains `Carbohydrates` from the production canonical-category list and `categoryBrowseHref()` falls through to `/search?q=Carbohydrates`.

Only two products are canonically `Carbohydrates`. Strong identities are scattered across Health Supplements, Electrolytes and Pre Workout. Raw Search also matches nutrition/metabolism benefit copy, Mass Gainers and low-carb Protein Bars.

The root cause is **missing semantic membership plus Search-only discovery**, not weak commercial depth.

### Candidate universe and rules

The broad bounded universe contained **34 products** across:

| Canonical category | Candidates |
|---|---:|
| Carbohydrates | 2 |
| Electrolytes | 1 |
| Health Supplements | 20 |
| Pre Workout | 2 |
| Protein Bars | 6 |
| Protein Powder | 1 |
| Whey Protein | 2 |
| **Total** | **34** |

Candidates used exact category, explicit name identities such as Carbo/Carb, CarbMax, carbohydrate, cyclic/cluster dextrin, dextrose, maltodextrin, Vitargo and Cream of Rice, plus tightly bounded description-only carbohydrate powder/drink/formula evidence.

**INCLUDE_STRONG** required explicit primary carbohydrate powder, sports-carbohydrate or Cream of Rice identity. Explicit carbohydrate + electrolyte identity may multi-member Hydration. Exact canonical category was supporting evidence where not contradicted.

**EXCLUDE_STRONG** covered Carb Killa/low-carb Protein Bars, shakes, spreads and croissants where `carb` denotes reduction/branding rather than a carbohydrate supplement.

**REVIEW_REQUIRED** covered description-only Energy Drink/gel carbohydrate identity and Protein/Whey products with carbohydrate as a secondary or co-primary component.

### Result

| Classification | Count |
|---|---:|
| INCLUDE_STRONG | **22** |
| REVIEW_REQUIRED | **6** |
| EXCLUDE_STRONG | **6** |
| **Candidate universe** | **34** |

Exact strong set:

| ID | Product | Current category | Fresh offers |
|---:|---|---|---:|
| 423 | Applied Nutrition Cream Of Rice 2kg | Health Supplements | 6 |
| 424 | NXT Nutrition Cream Of Rice 2kg | Health Supplements | 4 |
| 450 | Trec Vitargo Electro Energy 1050g | Health Supplements | 3 |
| 495 | GYM HIGH Cream Of Rice 2kg | Health Supplements | 10 |
| 766 | OstroVit Carbo 1000g | Carbohydrates | 0 |
| 838 | Strom Sports Cream of Rice 2kg | Health Supplements | 7 |
| 858 | CNP Professional Cream of Rice 2kg | Health Supplements | 4 |
| 861 | Trained By JP Cream Of Rice 2kg | Health Supplements | 10 |
| 904 | Strom Sports CarbMax 1.5kg | Health Supplements | 3 |
| 922 | CNP Professional Cyclic Dextrin 20 Servings | Health Supplements | 0 |
| 932 | Time 4 Carbs 1.8kg | Health Supplements | 2 |
| 949 | 7Nutrition Dextrose Gold 1000g | Health Supplements | 1 |
| 968 | GYM HIGH Cream Of Rice 2.1kg | Health Supplements | 0 |
| 1012 | 7Nutrition Carbo Gold 1000g | Health Supplements | 0 |
| 1288 | MyProtein HYROX Electrofuel Carbohydrate & Electrolyte Powder | Electrolytes | 0 |
| 1289 | Alpha Neon Cream of Rice 2kg | Carbohydrates | 1 |
| 1390 | Applied Nutrition Carb X Carb Powder 125g | Pre Workout | 4 |
| 1391 | TWP Replenish Carb/Electrolyte Powder | Health Supplements | 2 |
| 1392 | TBJP Nutrition Cream Of Rice | Health Supplements | 3 |
| 1406 | TWP Anytime COR+ Cream Of Rice | Health Supplements | 3 |
| 1409 | HR Labs Carb Up Carb Powder | Health Supplements | 1 |
| 1416 | Applied Nutrition Carb-X Carb Powder 1.2kg | Pre Workout | 6 |

Review set: IDs 331 High5 Energy Drink Powder, 332 High5 Energy Gels, 333 High5 Energy Gel, 1273 NutriSport Protein & Complex Carbs, 1373 Naughty Boy Whey Protein and 1374 Naughty Boy Whey.

Exclude set: IDs 106, 107, 213, 271, 320 and 322 — Carb Killa/low-carb Protein Bar, shake, spread and croissant identities.

### Current discovery accuracy

The exact homepage label uses raw `Carbohydrates` Search:

| Metric | Result |
|---|---:|
| Current Search results | **14** |
| Strong visible | **3** |
| Missing strong | **19** |
| Non-strong visible | **11** |
| Recall | **3/22 = 13.6%** |
| Precision | **3/14 = 21.4%** |

The 11 non-strong results include vitamin/mineral products whose descriptions mention carbohydrate metabolism, Mass Gainers, Whey Protein and a low-carb croissant. Singular/plural variation does not solve the problem:

| Query | Results | Strong hits | Recall | Precision |
|---|---:|---:|---:|---:|
| `Carbohydrates` | 14 | 3 | 13.6% | 21.4% |
| `Carbohydrate` | 17 | 5 | 22.7% | 29.4% |
| `Carb Powder` | 18 | 10 | 45.5% | 55.6% |
| `Cream of Rice` | 12 | 10/10 Cream of Rice strong | 100% subtype recall | 83.3% |

Search is useful for the explicit Cream of Rice subtype but is not category truth for the broader intent.

### Commercial coverage

- Strong products: **22**
- Fresh valid offers: **70**
- Distinct fresh retailers: **7**
- Strong products with at least one fresh offer: **17**
- Strong products with no fresh offer: **5**
- Products with 2+ fresh retailers: **4**
- Products with 3+ fresh retailers: **0**

This is enough breadth and comparison depth for a useful route. It is much stronger than a tiny subtype opportunity and is poorly represented by existing pages.

### Required architecture

- Add one shared `carbohydrates` definition to `app/lib/categoryCoverage.ts`.
- Add `/carbohydrates` as one new public lifecycle hub, initially `planned`, following the full cache, robots, canonical, sitemap and error contracts.
- Use CategoryComparison presentation because delivered price, weight, servings and retailer depth are material. A thin loader should compose shared semantic evaluation with `normalizeCategoryComparison`.
- Candidate retrieval must be broad, deterministic and paginated to exhaustion. It must not use canonical category as membership truth.
- Treat `Cream of Rice` and sports carbohydrate/electrolyte powder as subtypes/filters, not routes.
- Preserve legitimate Hydration multi-membership for explicit carbohydrate + electrolyte identities; exclude Mass Gainers, low-carb foods and Protein Bars without independent Carbohydrate supplement identity.
- Add three-state fixtures for all 34 candidates and production readback for the strong/review sets and commercial depth.

This unit must complete before broad category cleanup closes.

## Architecture findings across the sweep

1. **Shared Category Coverage is the correct semantic owner.** It already handles independent classification, exclusion precedence and multi-membership for completed pilots.
2. **CategoryComparison remains the correct commercial presentation** for Amino, Hydration and the proposed Carbohydrates page. Category Coverage should own membership; comparison normalization should own offers, price and retailer depth.
3. **Exact-category loaders are not automatically P1.** Creatine, Pre Workout, Mass Gainer and Multivitamins remain useful and mostly precise. Only Amino crosses the material recall threshold in this sweep.
4. **Raw Search is not semantic category truth.** It is acceptable fallback for vague or tiny source labels, but not for Carbohydrates where a coherent set and strong commercial depth exist.
5. **Do not rewrite canonical categories.** The new findings require semantic multi-membership across current source labels. Catalogue-wide recategorisation would lose legitimate co-identities and is outside scope.
6. **Do not migrate stable legacy vitamin pages solely for uniformity.** They already share semantic definitions and pagination. New routes must use the lifecycle contract; a broad legacy rewrite is not P1.
7. **Candidate completeness remains separate from membership.** Future loaders must paginate to exhaustion and run every candidate through one shared evaluator. Fixed 1,000 limits are fragile even where current counts are below the ceiling.
8. **Lifecycle state must not depend on live offer depth after launch.** Existing live routes remain `live_verified`; new Carbohydrates starts `planned` and requires separate owner launch approval.

## Known approved-for-later architectural debt

### Energy Drinks

- Keep the prior 18 strong / 1 review audit baseline as historical evidence subject to fresh implementation readback.
- A future `/energy-drinks` remains a valid commercial route.
- Do not create `/energy-supplements`.
- Use shared Category Coverage membership plus CategoryComparison presentation.
- Treat can/bottle/RTD/powder as filters/subtypes, not routes.
- This is additive commercial expansion. It may safely defer until after category-cleanup closure.

### Hydration / Electrolytes

- Keep `/hydration`; do not create `/electrolytes`.
- Move Hydration and Electrolytes to one shared semantic authority.
- Admit explicit isotonic identity.
- Fail closed on vitamin-water and electrolyte-energy-gel ambiguity.
- Exclude plain functional water.
- Remove route-specific semantic truth and fixed candidate pagination.
- Keep CategoryComparison and expose Electrolytes as a subtype/filter.
- Baselines remain Hydration 35 strong / 5 review and Electrolytes 24 strong / 12 review, subject to fresh readback.
- This corrects an existing `live_verified` route and must complete before category-cleanup closure.

## Final bounded implementation backlog

| Order | Unit | Status/source | Problem and target | Architecture | Closure requirement |
|---:|---|---|---|---|---|
| 1 | **Amino Acids semantic authority** | New P1 finding | Existing live route recall 80.8%; target baseline 99 strong / 7 review / 4 exclude | Shared `amino-acids` definition; thin paginated CategoryComparison loader; no BCAA/EAA routes | **Must complete** |
| 2 | **Hydration hardening + Electrolytes filter** | Known audited debt | Existing live route includes review/false-positive rows and misses isotonic identity | Shared Hydration/Electrolytes authority; retain `/hydration`; no `/electrolytes` | **Must complete** |
| 3 | **Carbohydrates semantic route** | New P1 finding | Current label recall 13.6%, precision 21.4%; target baseline 22 strong / 6 review / 6 exclude | Shared `carbohydrates` definition; new `/carbohydrates` lifecycle hub and CategoryComparison | **Must complete** |
| 4 | **Energy Drinks commercial route** | Known audited opportunity | Coherent 18-strong future intent, but no incorrect existing route | Shared `energy-drinks` definition and `/energy-drinks`; format filters | **May safely defer** |

Each future unit requires separate owner-authorized implementation, fresh production evidence, focused fixtures, Project Guardian, Quality Gate, lifecycle contract verification where applicable, public readback and zero unresolved review threads. This audit does not authorize implementation or merge of any backlog item.

## Routes explicitly not recommended

Do not create:

- `/bcaa`
- `/eaa`
- `/amino-acid`
- `/cream-of-rice`
- `/carb-powder`
- `/sports-drinks`
- `/electrolytes`
- `/energy-supplements`
- `/health-supplements`
- `/weight-management`
- `/protein-powder`
- `/casein-protein`
- `/beef-protein`
- `/egg-protein`
- `/clear-whey`
- `/recovery`
- `/workout-supplements`

No dynamic catch-all category route is recommended.

## Final closure decision

**B — CATEGORY CLEANUP NEEDS TWO ADDITIONAL NEW P1 IMPLEMENTATION UNITS.**

The two new units are:

1. Amino Acids shared semantic authority for the existing route;
2. Carbohydrates shared semantic authority and one new `/carbohydrates` route.

The operational closure line also includes the already-known Hydration correction unit because it fixes an existing live route. Energy Drinks may safely defer as later commercial expansion.

Once Amino, Hydration and Carbohydrates are implemented and production-verified one at a time, broad category cleanup should close. Do not begin another taxonomy sweep. Return to higher-value work:

1. retailer breadth, multi-retailer depth and freshness reliability;
2. nutrition/value enrichment and shared metrics;
3. Help Me Choose, Better Value and product comparison improvements;
4. retention through saved products and separately gated alerts;
5. traffic work when the SEO-20 experiment policy permits.

## Explicit non-goals and stop point

- No production database write or canonical-category rewrite.
- No Search, homepage, lifecycle, sitemap, route, metadata or application change.
- No Energy, Hydration, Amino or Carbohydrates implementation.
- No migration, config, secret, auth, Stage 3 or external-service change.
- No SEO-20 policy or frozen PER4M surface change.
- SEO-20 remains the sole SEO task `IN PROGRESS`.
- Runtime/app changes: **0**.
- Database writes: **0**.
- Exact STOP point: merge and verify this documentation-only final sweep, then stop before implementing any backlog item.
