# Nootropics Category Coverage Integrity audit — 2026-11-03

## Decision

**PASS — audit only.** Current production evidence supports **Model A**: one
semantic `/nootropics` route for products with an explicit primary or
co-primary Nootropic identity. Ordinary Pre Workouts with focus claims,
vitamins/minerals with cognitive benefit copy, and standalone cognitive-adjacent
ingredients do not become automatic members.

The closed active/unmerged candidate universe contains `67` products:
`13 INCLUDE_STRONG`, `33 EXCLUDE_STRONG` and `21 REVIEW_REQUIRED`. Current
public `/search?q=Nootropics` returns four strong products, with `30.8%` recall
and `100.0%` precision. This record does not implement a definition, route,
homepage link, Search behavior, lifecycle registration or data change.

## Scope, preflight and governance

- Starting `origin/main`: `2a8d4b5bd20ce9faaa1e96a789e6a7ea0373a4c6`,
  exactly the owner-specified SHA; `git fetch origin` found no intervening main
  commit.
- Clean audit worktree:
  `C:\Projects\supplementscout\.worktrees\category-coverage-nootropics`.
- Branch: `audit/category-coverage-nootropics`.
- Pre-audit `npm run verify:project`: **PASS**; 22 SEO tasks checked; SEO-20 is
  the sole `IN PROGRESS` task. Its PER4M title-only freeze remains intact.
- Testosterone Boosters, Fat Burners and Collagen remain `planned`,
  `noindex, follow` and sitemap-ineligible. Their audited evaluator contracts
  remain `11/6/11`, `21/77/16` and `29/21/2` respectively.
- The exact-category Search resolver and shared landing/presentation
  architecture are live; the homepage mobile-menu production closeout is
  present on current main.
- Reviewed the Operating Plan, SEO ledger, Agent Operating Model, Indexability
  Lifecycle, all three prior Category Coverage audits, shared evaluator,
  landing/presentation, Search resolver, route registry, product retrieval,
  Search page and regression contracts.
- No application runtime, route, homepage, Search, lifecycle, sitemap,
  breadcrumb, database/schema, workflow, SEO-20, PER4M, mobile-menu or existing
  category file was changed.

## Production read-only proof

The authoritative capture ran from `2026-11-03T19:39:54.311Z` to
`2026-11-03T19:40:09.766Z` through the production public site and public
Supabase REST endpoint. It used only `NEXT_PUBLIC_SUPABASE_ANON_KEY`, RLS and
`GET`:

- authoritative capture: `17 GET` requests — two paginated Supabase REST reads,
  the homepage and fourteen public Search pages (the `focus` result required
  page 2);
- complete collection session: `35 GET`, `0 HEAD`, `0 RPC`,
  `0 POST/PUT/PATCH/DELETE`, `0` database writes (one preliminary 16-GET
  capture, two public parser-diagnostic GETs, and the authoritative capture);
- the collector allowed only the production site and its Supabase origin,
  rejected non-GET/HEAD methods and `/rpc`, and never loaded a writer,
  service-role, admin or migration credential;
- catalogue closure was exact: `1,357` returned active, unmerged products
  against an exact `1,357` count;
- fresh means `last_checked_at` within 24 hours of capture. Offer state affects
  presentation, never semantic membership.

The temporary category-specific collector and analysis helper were not
committed and are removed before handoff. No generic audit harness was created.

## Current public experience and complete Search captures

The production homepage returned HTTP 200 and exposed no exact `Nootropics`
anchor, so the current homepage href is **none**.

The three requested exact/current result sets are:

| Query | Count | Ordered current product IDs / names |
| --- | ---: | --- |
| `Nootropics` | 4 | `1361` Neutonic Focus Pouches Fresh Mint 5 x 20 Pouches; `1114` Ultra Nutrio Limitless Nootropic 100 Capsules; `437` KIOR Health Clear Mind+ 60 Caps; `443` KIOR Health NOOTROPIC-FOCCUS [NON-STIM] |
| `nootropic` | 14 | `1114` Ultra Nutrio Limitless; `978` Neutonic Nootropic Focus Blend; `1397` Strom Sports Support Max Neuro Nootropic; `1401` Supplement Needs Pre Focus Nootropic; `960` Brain Gains Switch On; `235` Ghost Gamer Nootropic; `443` KIOR NOOTROPIC-FOCCUS; `23` MyoBlox Skywalk Nootropic Focus; `22` Warrior Brain Game Caffeine Free Nootropic; `1361` Neutonic Focus Pouches; `436` KIOR Brain Wave; `437` KIOR Clear Mind+; `481` Applied Nutrition ABE Pump; `367` GYM HIGH The Stacker |
| `nootropics` | 4 | `1361` Neutonic Focus Pouches; `1114` Ultra Nutrio Limitless; `437` KIOR Clear Mind+; `443` KIOR NOOTROPIC-FOCCUS |

Diagnostic searches are candidate generators, not membership truth. These are
their complete ordered ID sets; the classification table below resolves every
identity:

| Query | Count | Ordered IDs |
| --- | ---: | --- |
| `brain booster` | 0 | none |
| `focus` | 27 | `961, 1361, 978, 908, 1401, 23, 566, 513, 596, 597, 661, 1384, 581, 1386, 634, 481, 1381, 1372, 336, 1379, 1380, 6, 1378, 1382, 488, 51, 443` |
| `cognitive` | 11 | `665, 585, 654, 656, 659, 596, 635, 663, 443, 586, 400` |
| `mental focus` | 0 | none |
| `lion's mane` | 4 | `350, 675, 1131, 1346` |
| `bacopa` | 1 | `676` |
| `alpha gpc` | 1 | `274` |
| `tyrosine` | 2 | `674, 293` |
| `choline` | 7 | `590, 699, 615, 1379, 1380, 274, 452` |
| `mushroom complex` | 1 | `1130` |

## Candidate-universe closure and semantic boundary

The candidate universe is the union of all `57` unique diagnostic Search
products plus every active row with an exact Nootropics category, explicit
Nootropic/Brain/Memory identity, specified cognitive-associated ingredient,
Ginkgo/Ginseng/Rhodiola identity, mushroom identity, or mandatory
repository-reviewed product. That added ten unique rows and closed the universe
at `67`; every row came from the exact 1,357-product snapshot.

The recommended boundary is product-identity-led:

- include explicit `Nootropic`/`Nootropics` names, explicit Nootropic formula or
  blend descriptions, and named multi-identity products where Nootropic is
  primary or co-primary;
- a Focus identity can be strong only when independent evidence supports it.
  Neutonic Focus Pouches has exact reviewed Nootropics category support;
  FocusMax and Mentality lack enough current evidence and fail closed to review;
- exclude ordinary Pre Workouts, caffeine, hydration/amino, vitamins, minerals,
  accessories and other products where focus/cognition/nootropic ingredients
  are benefit copy or a secondary component;
- standalone Lion's Mane, Bacopa, Alpha-GPC, Choline, L-Tyrosine, Ginkgo,
  Ginseng and Rhodiola remain review candidates, not automatic members;
- generic Reishi and generic mushroom-wellness blends are excluded. The Gold
  Stack Mushroom Complex remains review-required because current production has
  no description proving either generic-wellness or cognitive identity;
- offer freshness, stock, retailer and canonical category never decide semantic
  membership.

## Complete candidate classification

All rows were active and unmerged. `Offers` is `total/fresh/fresh-in-stock`.
`Exact visible` means present in `/search?q=Nootropics`. `unknown*` is the
captured null `product_format`, not an inferred runtime value.

Evidence-code meanings:

- `EXPLICIT_NOOTROPIC_NAME`: current product name explicitly says Nootropic.
- `EXPLICIT_NOOTROPIC_DESCRIPTION`: current description identifies the product
  as a Nootropic blend/formula, supported by its Brain/Clear Mind identity.
- `MULTI_IDENTITY_PRODUCT`: current description explicitly names Nootropic as a
  co-primary identity.
- `FOCUS_IDENTITY_SUPPORTED_BY_EXACT_CATEGORY`: Focus product plus exact
  reviewed Nootropics category.
- `FOCUS_IDENTITY_AMBIGUITY`: Focus/Mentality identity lacks independent current
  Nootropic evidence.
- `STANDALONE_INGREDIENT_AMBIGUITY` and
  `STANDALONE_LIONS_MANE_AMBIGUITY`: ingredient identity only; no explicit
  Nootropic co-identity.
- `MUSHROOM_IDENTITY_AMBIGUITY`: generic complex name with insufficient current
  description.
- `PREWORKOUT_FOCUS_CLAIM_FALSE_POSITIVE`: Pre Workout is primary; focus,
  choline, tyrosine or “nootropic-rich” wording is secondary.
- `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH`: current product identity is another
  category and the diagnostic term is benefit or incidental copy.
- the remaining exclusion codes state the explicit conflicting primary
  identity.

| ID | Product / slug | Brand | Canonical category | Format | Offers; retailers | Exact visible | Classification | Confidence | Reason / evidence |
| ---: | --- | --- | --- | --- | --- | :---: | --- | --- | --- |
| 6 | `ghost-legend-v4-pre-workout-660g` — Ghost Legend V4 Pre-Workout 660g | Ghost | Pre Workout | powder | 7/6/6; Dolphin Fitness, Whey Okay, eBay UK | no | EXCLUDE_STRONG | HIGH | `PREWORKOUT_FOCUS_CLAIM_FALSE_POSITIVE` |
| 22 | `warrior-brain-game-caffeine-free-nootropic-360g` — Warrior Brain Game Caffeine Free Nootropic 360g | Warrior | Pre Workout | unknown* | 1/0/0; Whey Okay | no | INCLUDE_STRONG | HIGH | `EXPLICIT_NOOTROPIC_NAME` |
| 23 | `myoblox-skywalk-nootropic-focus-180g` — MyoBlox Skywalk Nootropic Focus 180g | MyoBlox | Pre Workout | unknown* | 1/0/0; Whey Okay | no | INCLUDE_STRONG | HIGH | `EXPLICIT_NOOTROPIC_NAME` |
| 51 | `5-nutrition-rich-piana-mentality-90-capsules` — 5% Nutrition Rich Piana Mentality 90 Capsules | 5% Nutrition | Pre Workout | unknown* | 1/1/0; Whey Okay | no | REVIEW_REQUIRED | MEDIUM | `FOCUS_IDENTITY_AMBIGUITY` |
| 235 | `ghost-gamer-nootropic-40-servings` — Ghost Gamer Nootropic 40 Servings | Ghost | Health Supplements | unknown* | 5/4/0; Gladiator Nutrition, Whey Okay | no | INCLUDE_STRONG | HIGH | `EXPLICIT_NOOTROPIC_NAME` |
| 274 | `7nutrition-alpha-gpc-60-capsules` — 7Nutrition Alpha GPC 60 Capsules | 7Nutrition | Vitamins | unknown* | 2/2/0; 6 Pack Supplements, Whey Okay | no | REVIEW_REQUIRED | MEDIUM | `STANDALONE_INGREDIENT_AMBIGUITY` |
| 293 | `insane-labz-possessed-pre-workout-30-servings` — Insane Labz Possessed Pre Workout 30 Servings | Insane Labz | Pre Workout | unknown* | 1/0/0; Whey Okay | no | EXCLUDE_STRONG | HIGH | `PREWORKOUT_FOCUS_CLAIM_FALSE_POSITIVE` |
| 336 | `hr-labs-defib-v3-480g` — HR Labs Defib V3 480g | HR Labs | Health Supplements | unknown* | 4/4/2; Whey Okay | no | EXCLUDE_STRONG | HIGH | `PREWORKOUT_FOCUS_CLAIM_FALSE_POSITIVE` |
| 350 | `swanson-full-spectrum-lions-mane-mushroom-60-caps` — Swanson Full Spectrum Lion's Mane Mushroom 60 Caps | Swanson | Health Supplements | unknown* | 2/2/2; Whey Okay, eBay UK | no | REVIEW_REQUIRED | MEDIUM | `STANDALONE_LIONS_MANE_AMBIGUITY` |
| 367 | `gym-high-the-stacker-240g` — GYM HIGH The Stacker 240g | GYM HIGH | Health Supplements | powder | 8/8/8; Fit House, GYM HIGH, Whey Okay | no | INCLUDE_STRONG | HIGH | `MULTI_IDENTITY_PRODUCT` — description explicitly says Nootropic, Thermogenic, Pre-Workout and Fat Burner |
| 400 | `solgar-chelated-zinc-100-tablets` — Solgar Chelated Zinc 100 Tablets | Solgar | Health Supplements | unknown* | 1/0/0; Whey Okay | no | EXCLUDE_STRONG | HIGH | `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH` |
| 414 | `gym-high-hydro-amino-eaabcaa-35-servings` — GYM HIGH Hydro Amino EAA+BCAA 35 Servings | GYM HIGH | Amino Acids | powder | 6/4/4; GYM HIGH, Predators Gear, Whey Okay | no | EXCLUDE_STRONG | HIGH | `AMINO_HYDRATION_PRIMARY_IDENTITY` |
| 436 | `kior-health-brain-wave-60-caps` — KIOR Health Brain Wave 60 Caps | KIOR Health | Health Supplements | unknown* | 2/2/2; KIOR Health, Whey Okay | no | INCLUDE_STRONG | HIGH | `EXPLICIT_NOOTROPIC_DESCRIPTION` — description opens with Nootropic Blend |
| 437 | `kior-health-clear-mind-60-caps` — KIOR Health Clear Mind+ 60 Caps | KIOR Health | Health Supplements | unknown* | 2/2/2; KIOR Health, Whey Okay | yes | INCLUDE_STRONG | HIGH | `EXPLICIT_NOOTROPIC_DESCRIPTION` — description identifies a nootropics/adaptogens blend |
| 443 | `kior-health-nootropic-foccus-non-stim` — KIOR Health NOOTROPIC-FOCCUS [NON-STIM] | KIOR Health | Health Supplements | unknown* | 1/0/0; Whey Okay | yes | INCLUDE_STRONG | HIGH | `EXPLICIT_NOOTROPIC_NAME` |
| 452 | `naughty-boy-winter-soldier-menace-400g` — Naughty Boy Winter Soldier Menace 400g | Naughty Boy | Pre Workout | unknown* | 1/0/0; Whey Okay | no | EXCLUDE_STRONG | HIGH | `PREWORKOUT_FOCUS_CLAIM_FALSE_POSITIVE` |
| 481 | `applied-nutrition-abe-pump-500g` — Applied Nutrition ABE Pump 500g | Applied Nutrition | Pre Workout | unknown* | 17/17/14; 10 Reps, Discount Supplements, Gladiator Nutrition, Whey Okay, eBay UK | no | EXCLUDE_STRONG | HIGH | `PREWORKOUT_FOCUS_CLAIM_FALSE_POSITIVE` — “nootropic-rich” is secondary to explicit Pump Pre-workout identity |
| 488 | `massage-gun` — Massage Gun | Urban Fitness | Accessories | unknown* | 2/1/1; Whey Okay, eBay UK | no | EXCLUDE_STRONG | HIGH | `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH` |
| 513 | `trec-nutrition--caffeine-200-plus---60-caps` — Trec Nutrition Caffeine 200 Plus 60 caps | Trec Nutrition | Health Supplements | unknown* | 2/1/1; Whey Okay, eBay UK | no | EXCLUDE_STRONG | HIGH | `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH` |
| 566 | `potassium-chloride-1000mg` — Potassium Chloride 1000mg | Simply Supplements | Health Supplements | unknown* | 1/1/1; Simply Supplements | no | EXCLUDE_STRONG | HIGH | `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH` |
| 581 | `glucosamine-chondroitin-and-calcium` — Glucosamine, Chondroitin & Calcium | Simply Supplements | Health Supplements | capsule | 1/1/1; Simply Supplements | no | EXCLUDE_STRONG | HIGH | `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH` |
| 585 | `children-s-chewable-multivitamins-orange-flavour` — Children's Chewable Multivitamins Orange Flavour | Simply Supplements | Vitamins | unknown* | 1/1/1; Simply Supplements | no | EXCLUDE_STRONG | HIGH | `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH` |
| 586 | `multivitamin-gummies` — Multivitamin Gummies | Simply Supplements | Vitamins | unknown* | 1/1/0; Simply Supplements | no | EXCLUDE_STRONG | HIGH | `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH` |
| 590 | `l-choline` — L-Choline | Simply Supplements | Vitamins | unknown* | 1/1/1; Simply Supplements | no | REVIEW_REQUIRED | MEDIUM | `STANDALONE_INGREDIENT_AMBIGUITY` |
| 596 | `super-zinc-plus` — Super Zinc Plus | Simply Supplements | Vitamins | capsule | 1/1/1; Simply Supplements | no | EXCLUDE_STRONG | HIGH | `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH` |
| 597 | `vitamin-c-1000mg-powder` — Vitamin C 1000mg Powder | Simply Supplements | Vitamins | powder | 1/1/1; Simply Supplements | no | EXCLUDE_STRONG | HIGH | `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH` |
| 615 | `anti-fatigue-multivitamin` — Anti-Fatigue Multivitamin | Simply Supplements | Vitamins | unknown* | 1/1/1; Simply Supplements | no | EXCLUDE_STRONG | HIGH | `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH` |
| 634 | `hyaluronic-acid-400mg-with-vitamin-c-320mg` — Hyaluronic Acid 400mg with Vitamin C 320mg | Simply Supplements | Health Supplements | unknown* | 1/1/1; Simply Supplements | no | EXCLUDE_STRONG | HIGH | `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH` |
| 635 | `a-to-z-multivitamins-and-minerals` — A to Z Multivitamins & Minerals | Simply Supplements | Health Supplements | tablet | 1/1/0; Simply Supplements | no | EXCLUDE_STRONG | HIGH | `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH` |
| 636 | `eye-health-multivitamin` — Eye Health Multivitamin | Simply Supplements | Vitamins | unknown* | 1/1/1; Simply Supplements | no | EXCLUDE_STRONG | HIGH | `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH` |
| 647 | `siberian-ginseng-4-000mg` — Siberian Ginseng 4,000mg | Simply Supplements | Health Supplements | unknown* | 1/1/1; Simply Supplements | no | REVIEW_REQUIRED | MEDIUM | `STANDALONE_INGREDIENT_AMBIGUITY` |
| 654 | `ginkgo-biloba-tablets-6-000mg` — Ginkgo Biloba Tablets 6,000mg | Simply Supplements | Health Supplements | unknown* | 1/1/1; Simply Supplements | no | REVIEW_REQUIRED | MEDIUM | `STANDALONE_INGREDIENT_AMBIGUITY` |
| 656 | `chewable-vitamin-b12-500-g-tablets` — Chewable Vitamin B12 500µg Tablets | Simply Supplements | Vitamins | unknown* | 1/1/1; Simply Supplements | no | EXCLUDE_STRONG | HIGH | `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH` |
| 659 | `korean-ginseng-tablets-4-000mg` — Korean Ginseng Tablets 4,000mg | Simply Supplements | Health Supplements | unknown* | 1/1/1; Simply Supplements | no | REVIEW_REQUIRED | MEDIUM | `STANDALONE_INGREDIENT_AMBIGUITY` |
| 661 | `odourless-garlic-tablets-18mg` — Odourless Garlic Tablets 18mg | Simply Supplements | Health Supplements | unknown* | 1/1/1; Simply Supplements | no | EXCLUDE_STRONG | HIGH | `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH` |
| 663 | `ginkgo-biloba-tablets-1-500mg` — Ginkgo Biloba Tablets 1,500mg | Simply Supplements | Health Supplements | unknown* | 1/0/0; Simply Supplements | no | REVIEW_REQUIRED | MEDIUM | `STANDALONE_INGREDIENT_AMBIGUITY` |
| 665 | `ginkgo-and-ginseng-complex` — Ginkgo & Ginseng Complex | Simply Supplements | Health Supplements | unknown* | 1/1/1; Simply Supplements | no | REVIEW_REQUIRED | MEDIUM | `STANDALONE_INGREDIENT_AMBIGUITY` |
| 674 | `swanson-l-tyrosine-500mg-100-capsules` — Swanson L-Tyrosine 500mg 100 Capsules | Swanson | Amino Acids | capsule | 1/1/1; Fit House | no | REVIEW_REQUIRED | MEDIUM | `STANDALONE_INGREDIENT_AMBIGUITY` |
| 675 | `osavi-lions-mane-600mg-60-capsules` — Osavi Lion's Mane 600mg 60 Capsules | Osavi | Health Supplements | capsule | 1/1/1; Fit House | no | REVIEW_REQUIRED | MEDIUM | `STANDALONE_LIONS_MANE_AMBIGUITY` |
| 676 | `ostrovit-bacopa-monnieri-90-capsules` — OstroVit Bacopa Monnieri 90 Capsules | OstroVit | Health Supplements | capsule | 1/1/1; Fit House | no | REVIEW_REQUIRED | MEDIUM | `STANDALONE_INGREDIENT_AMBIGUITY` |
| 695 | `trec-nutrition-korean-ginseng-90-capsules` — Trec Nutrition Korean Ginseng 90 Capsules | Trec Nutrition | Health Supplements | capsule | 1/1/0; Fit House | no | REVIEW_REQUIRED | MEDIUM | `STANDALONE_INGREDIENT_AMBIGUITY` |
| 699 | `now-foods-choline-inositol-100-capsules` — Now Foods Choline & Inositol 100 Capsules | NOW Foods | Health Supplements | capsule | 1/1/0; Fit House | no | REVIEW_REQUIRED | MEDIUM | `STANDALONE_INGREDIENT_AMBIGUITY` |
| 714 | `osavi-rhodiola-rosea-root-400mg-120-capsules` — Osavi Rhodiola Rosea Root 400mg 120 Capsules | Osavi | Health Supplements | capsule | 1/1/1; Fit House | no | REVIEW_REQUIRED | MEDIUM | `STANDALONE_INGREDIENT_AMBIGUITY` |
| 908 | `strom-sports-focusmax-36-servings` — Strom Sports FocusMax 36 Servings | Strom | Health Supplements | powder | 2/2/1; Jon's Supplements | no | REVIEW_REQUIRED | MEDIUM | `FOCUS_IDENTITY_AMBIGUITY` — no current description or explicit Nootropic identity |
| 960 | `brain-gains-switch-on-225g-nootropic-day-time-formula` — Brain Gains Switch On 225g Nootropic Day-time Formula | Brain Gains | Health Supplements | powder | 1/1/0; Fit House | no | INCLUDE_STRONG | HIGH | `EXPLICIT_NOOTROPIC_NAME` |
| 961 | `cellucor-c4-original-energy-focus-and-performance-pre-workout-30-servings` — Cellucor C4 Original – Energy, Focus & Performance Pre-Workout 30 servings | Cellucor | Pre Workout | powder | 2/2/2; Fit House | no | EXCLUDE_STRONG | HIGH | `PREWORKOUT_FOCUS_CLAIM_FALSE_POSITIVE` |
| 978 | `neutonic-nootropic-focus-blend-powder-sachets-16-servings` — Neutonic Nootropic Focus Blend Powder Sachets 16 Servings | Neutonic | Health Supplements | powder | 2/2/1; Fit House | no | INCLUDE_STRONG | HIGH | `EXPLICIT_NOOTROPIC_NAME` |
| 1045 | `7nutrition-rhodiola-rosea-60caps` — 7NUTRITION RHODIOLA ROSEA 60caps | 7Nutrition | Vitamins | capsule | 1/1/1; 6 Pack Supplements | no | REVIEW_REQUIRED | MEDIUM | `STANDALONE_INGREDIENT_AMBIGUITY` |
| 1114 | `ultra-nutrio-limitless-nootropic-100-capsules` — Ultra Nutrio Limitless Nootropic 100 Capsules | Ultra Nutrio | Nootropics | capsule | 1/1/1; 6 Pack Supplements | yes | INCLUDE_STRONG | HIGH | `EXPLICIT_NOOTROPIC_NAME` |
| 1130 | `nordic-labs-gold-stack-mushroom-complex-90-capsules` — Nordic Labs Gold Stack Mushroom Complex 90 Capsules | Nordic Labs | Health Supplements | capsule | 1/1/1; 6 Pack Supplements | no | REVIEW_REQUIRED | LOW | `MUSHROOM_IDENTITY_AMBIGUITY` |
| 1131 | `nordic-labs-lion-s-mane-mushroom-90-capsules` — Nordic Labs Lion's Mane Mushroom 90 Capsules | Nordic Labs | Health Supplements | capsule | 1/1/1; 6 Pack Supplements | no | REVIEW_REQUIRED | MEDIUM | `STANDALONE_LIONS_MANE_AMBIGUITY` |
| 1132 | `nordic-labs-reishi-mushroom-90-capsules` — Nordic Labs Reishi Mushroom 90 Capsules | Nordic Labs | Health Supplements | capsule | 1/1/1; 6 Pack Supplements | no | EXCLUDE_STRONG | HIGH | `GENERIC_MUSHROOM_WELLNESS_IDENTITY` |
| 1134 | `good-guru-black-maca-ginseng-90-capsules` — Good Guru Black Maca + Ginseng 90 Capsules | Good Guru | Health Supplements | capsule | 1/1/1; 6 Pack Supplements | no | REVIEW_REQUIRED | LOW | `STANDALONE_INGREDIENT_AMBIGUITY` |
| 1300 | `applied-nutrition-mushroom-superblend-160g-8-mushroom-extract-powder-blend` — Applied Nutrition Mushroom Superblend 160g – 8 Mushroom Extract Powder Blend | Applied Nutrition | Health Supplements | powder | 1/1/1; 10 Reps | no | EXCLUDE_STRONG | HIGH | `GENERIC_MUSHROOM_WELLNESS_IDENTITY` |
| 1346 | `swole-lifestyle-lion-s-mane` — Swole Lifestyle Lion's Mane | Swole Lifestyle | Health Supplements | capsule | 1/1/1; 10 Reps | no | REVIEW_REQUIRED | MEDIUM | `STANDALONE_LIONS_MANE_AMBIGUITY` |
| 1361 | `neutonic-focus-pouches-fresh-mint-5-x-20-pouches` — Neutonic Focus Pouches Fresh Mint 5 x 20 Pouches | Neutonic | Nootropics | sachet | 1/1/1; 10 Reps | yes | INCLUDE_STRONG | HIGH | `FOCUS_IDENTITY_SUPPORTED_BY_EXACT_CATEGORY` |
| 1372 | `twp-lft-v2-pre-workout` — TWP LFT V2 Pre Workout | TWP Nutrition | Pre Workout | powder | 13/13/13; Gladiator Nutrition | no | EXCLUDE_STRONG | HIGH | `PREWORKOUT_FOCUS_CLAIM_FALSE_POSITIVE` |
| 1378 | `ghost-legend-pre-workout` — Ghost Legend Pre Workout | Ghost Lifestyle | Pre Workout | powder | 9/9/2; Gladiator Nutrition | no | EXCLUDE_STRONG | HIGH | `PREWORKOUT_FOCUS_CLAIM_FALSE_POSITIVE` |
| 1379 | `naughty-boy-menace-v2-pre-workout` — Naughty Boy Menace V2 Pre-Workout | Naughty Boy Lifestyle | Pre Workout | powder | 14/14/7; Gladiator Nutrition | no | EXCLUDE_STRONG | HIGH | `PREWORKOUT_FOCUS_CLAIM_FALSE_POSITIVE` |
| 1380 | `twp-lft-v3-extreme-stim-pre-workout` — TWP LFT V3 Extreme Stim Pre Workout | TWP Nutrition | Pre Workout | powder | 3/3/3; Gladiator Nutrition | no | EXCLUDE_STRONG | HIGH | `PREWORKOUT_FOCUS_CLAIM_FALSE_POSITIVE` |
| 1381 | `twp-nutrition-pre-raw-pre-workout` — TWP Nutrition Pre Raw Pre Workout | TWP Nutrition | Pre Workout | powder | 6/6/6; Gladiator Nutrition | no | EXCLUDE_STRONG | HIGH | `PREWORKOUT_FOCUS_CLAIM_FALSE_POSITIVE` |
| 1382 | `nutrifitt-symbiote-extreme-high-stim-pre-workout` — NutriFitt Symbiote Extreme High-Stim Pre-Workout | NutriFitt | Pre Workout | powder | 4/4/3; Gladiator Nutrition | no | EXCLUDE_STRONG | HIGH | `PREWORKOUT_FOCUS_CLAIM_FALSE_POSITIVE` |
| 1383 | `twp-nutrition-all-the-weight-up-mass-gainer-5kg` — TWP Nutrition All The Weight Up Mass Gainer 5kg | TWP Nutrition | Mass Gainer | powder | 3/3/2; Gladiator Nutrition | no | EXCLUDE_STRONG | HIGH | `MASS_GAINER_MUSHROOM_COMPONENT` |
| 1384 | `supplement-needs-magnesium-bisglycinate` — Supplement Needs Magnesium Bisglycinate | Supplement Needs | Health Supplements | capsule | 1/1/1; Gladiator Nutrition | no | EXCLUDE_STRONG | HIGH | `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH` |
| 1386 | `twp-nutrition-omega-3-fish-oils` — TWP Nutrition Omega 3 Fish Oils | TWP Nutrition | Health Supplements | softgel | 1/1/1; Gladiator Nutrition | no | EXCLUDE_STRONG | HIGH | `NON_NOOTROPIC_BENEFIT_OR_LEXICAL_MATCH` |
| 1397 | `strom-sports-support-max-neuro-nootropic` — Strom Sports Support Max Neuro Nootropic | Strom Sports | Pre Workout | powder | 3/3/2; Gladiator Nutrition | no | INCLUDE_STRONG | HIGH | `EXPLICIT_NOOTROPIC_NAME` |
| 1401 | `supplement-needs-pre-focus-nootropic` — Supplement Needs Pre Focus Nootropic | Supplement Needs | Pre Workout | powder | 3/3/1; Gladiator Nutrition | no | INCLUDE_STRONG | HIGH | `EXPLICIT_NOOTROPIC_NAME` |

Exact classification ID sets:

- `INCLUDE_STRONG` (`13`): `22, 23, 235, 367, 436, 437, 443, 960, 978,
  1114, 1361, 1397, 1401`.
- `EXCLUDE_STRONG` (`33`): `6, 293, 336, 400, 414, 452, 481, 488, 513,
  566, 581, 585, 586, 596, 597, 615, 634, 635, 636, 656, 661, 961, 1132,
  1300, 1372, 1378, 1379, 1380, 1381, 1382, 1383, 1384, 1386`.
- `REVIEW_REQUIRED` (`21`): `51, 274, 350, 590, 647, 654, 659, 663,
  665, 674, 675, 676, 695, 699, 714, 908, 1045, 1130, 1131, 1134,
  1346`.

## Mandatory product findings

All mandatory products below were active, unmerged current canonical rows.

- **Ultra Nutrio Limitless Nootropic** — `1114`,
  `ultra-nutrio-limitless-nootropic-100-capsules`, Ultra Nutrio, category
  Nootropics, capsule, `1/1/1` offer evidence from 6 Pack Supplements. Visible
  in exact Search. `INCLUDE_STRONG / HIGH`: explicit Nootropic name.
- **Neutonic Focus Pouches** — `1361`,
  `neutonic-focus-pouches-fresh-mint-5-x-20-pouches`, Neutonic, category
  Nootropics, sachet, `1/1/1` from 10 Reps. Visible in exact Search.
  `INCLUDE_STRONG / HIGH`: Focus identity plus exact reviewed category.
- **GYM HIGH The Stacker** — `367`, `gym-high-the-stacker-240g`, GYM HIGH,
  Health Supplements, powder, `8/8/8` across Fit House, GYM HIGH and Whey Okay.
  Not visible in exact Search. `INCLUDE_STRONG / HIGH`: its current description
  explicitly enumerates Nootropic, Thermogenic, Pre-Workout and Fat Burner.
  Existing Fat Burners membership remains untouched.
- **Strom Sports FocusMax** — `908`, `strom-sports-focusmax-36-servings`,
  Strom, Health Supplements, powder, `2/2/1` from Jon's Supplements. Not visible
  in exact Search. `REVIEW_REQUIRED / MEDIUM`: Focus name only; current
  description is null and reviewed import identity does not prove a Nootropic
  co-identity.
- **Brain Gains Switch On** — `960`,
  `brain-gains-switch-on-225g-nootropic-day-time-formula`, Brain Gains, Health
  Supplements, powder, `1/1/0` from Fit House. Not visible in exact Search.
  `INCLUDE_STRONG / HIGH`: explicit Nootropic Day-time Formula name.
- **Nordic Labs Lion's Mane** — `1131`,
  `nordic-labs-lion-s-mane-mushroom-90-capsules`, Nordic Labs, Health
  Supplements, capsule, `1/1/1` from 6 Pack Supplements. Not visible in exact
  Search. `REVIEW_REQUIRED / MEDIUM`: standalone Lion's Mane identity, no
  description or explicit Nootropic evidence.
- **Swanson Lion's Mane** — `350`,
  `swanson-full-spectrum-lions-mane-mushroom-60-caps`, Swanson, Health
  Supplements, captured format null (name says caps), `2/2/2` from Whey Okay
  and eBay UK. Not visible in exact Search. `REVIEW_REQUIRED / MEDIUM`.
- **Osavi Lion's Mane** — `675`, `osavi-lions-mane-600mg-60-capsules`, Osavi,
  Health Supplements, capsule, `1/1/1` from Fit House. Not visible in exact
  Search. `REVIEW_REQUIRED / MEDIUM`.
- **Swole Lifestyle Lion's Mane** — `1346`,
  `swole-lifestyle-lion-s-mane`, Swole Lifestyle, Health Supplements, capsule,
  `1/1/1` from 10 Reps. Not visible in exact Search.
  `REVIEW_REQUIRED / MEDIUM`.
- **OstroVit Bacopa Monnieri** — `676`,
  `ostrovit-bacopa-monnieri-90-capsules`, OstroVit, Health Supplements,
  capsule, `1/1/1` from Fit House. Not visible in exact Search.
  `REVIEW_REQUIRED / MEDIUM`: standalone ingredient only.
- **Swanson L-Tyrosine** — `674`,
  `swanson-l-tyrosine-500mg-100-capsules`, Swanson, Amino Acids, capsule,
  `1/1/1` from Fit House. Not visible in exact Search.
  `REVIEW_REQUIRED / MEDIUM`: standalone amino identity only.
- **Nordic Gold Stack Mushroom Complex** — `1130`,
  `nordic-labs-gold-stack-mushroom-complex-90-capsules`, Nordic Labs, Health
  Supplements, capsule, `1/1/1` from 6 Pack Supplements. Not visible in exact
  Search. `REVIEW_REQUIRED / LOW`: generic mushroom-complex name and no current
  description establish neither cognitive nor generic-wellness identity.
- **Good Guru Black Maca + Ginseng** — `1134`,
  `good-guru-black-maca-ginseng-90-capsules`, Good Guru, Health Supplements,
  capsule, `1/1/1` from 6 Pack Supplements. Not visible in exact Search.
  `REVIEW_REQUIRED / LOW`: botanical blend without current Nootropic evidence.
- **GYM HIGH Hydro Amino** — `414`,
  `gym-high-hydro-amino-eaabcaa-35-servings`, GYM HIGH, Amino Acids, powder,
  `6/4/4` across GYM HIGH, Predators Gear and Whey Okay. Not visible in exact
  Search. `EXCLUDE_STRONG / HIGH`: its current production description identifies
  hydration/performance/recovery and contains no Nootropic, focus or mental
  clarity wording. This is an Amino/Hydration primary identity.

## Ingredient, Focus, Pre Workout and mushroom decisions

- **Lion's Mane automatic membership: no.** All four current products are
  standalone ingredient identities. They remain review-required until reviewed
  product evidence explicitly establishes a Nootropic identity.
- **Bacopa automatic membership: no.** Product `676` remains review-required.
- **L-Tyrosine automatic membership: no.** Product `674` remains
  review-required; Tyrosine inside Pre Workout `293` is a strong exclusion.
- **Choline/Alpha-GPC/Citicoline automatic membership: no.** Standalone Alpha-GPC
  `274`, L-Choline `590`, and Choline & Inositol `699` require review. No active
  standalone Citicoline/CDP-Choline identity was found. CDP/VitaCholine inside
  Pre Workouts `452, 1379, 1380` does not create membership.
- **Focus products:** explicit Nootropic names (`23, 978, 1401`) are strong;
  Focus plus exact reviewed category (`1361`) is strong; FocusMax `908` and
  Mentality `51` fail closed to review; ordinary energy/Pre Workout focus claims
  are excluded.
- **Generic Pre Workout focus claims: no membership.** Eleven Pre Workout rows
  are strong excludes; four other Pre Workout-labelled products are legitimate
  strong Nootropics because their names explicitly say Nootropic. Canonical
  category alone therefore cannot decide membership.
- **Mushrooms:** generic Reishi `1132`, Applied Mushroom Superblend `1300`, and
  the mushroom component inside Mass Gainer `1383` are strong excludes. Gold
  Stack `1130` remains review-required; Lion's Mane is separately
  review-required, not automatic.

## Search metrics and category-label quality

For exact public `/search?q=Nootropics`:

- current results: `4`;
- expected strong members: `13`;
- visible strong true positives: `4` (`1361, 1114, 437, 443`);
- visible false positives: `0`;
- visible review cases: `0`;
- missing strong members: `9` (`22, 23, 235, 367, 436, 960, 978, 1397,
  1401`);
- recall: `4 / 13 = 30.8%`;
- precision: `4 / 4 = 100.0%`.

Canonical category distribution across the complete universe:

| Canonical category | INCLUDE_STRONG | EXCLUDE_STRONG | REVIEW_REQUIRED |
| --- | ---: | ---: | ---: |
| Nootropics | 2 | 0 | 0 |
| Health Supplements | 7 | 12 | 16 |
| Pre Workout | 4 | 11 | 1 |
| Vitamins | 0 | 7 | 3 |
| Amino Acids | 0 | 1 | 1 |
| Accessories | 0 | 1 | 0 |
| Mass Gainer | 0 | 1 | 0 |

The exact Nootropics label is currently precise (`2/2` strong, `0` false,
`0` review) but severely incomplete: `11/13` strong members sit outside it.
Health Supplements and Pre Workout are too broad to serve as semantic truth.
Obvious canonical-label debt exists, but relabelling is a separate reviewed data
task and would not solve legitimate multi-membership.

## Root causes

Counts may overlap because one row can have several causes.

| Root cause | Count / scope | Finding |
| --- | ---: | --- |
| `CATEGORY_LABEL_MISMATCH` / `SOURCE_CATEGORY_TOO_NARROW` | 11 strong | Only two strong products carry exact Nootropics; seven use Health Supplements and four use Pre Workout. |
| `SEARCH_PHRASE_MISMATCH` | 9 missing strong | The exact plural phrase does not match the nine missing strong identities. |
| `SEMANTIC_ALIAS_MISSING` | 9 missing strong | Singular Nootropic, named brain/focus identities and reviewed multi-identity evidence are not current Search membership aliases. |
| `DESCRIPTION_ONLY_MATCH` | 3 strong | IDs `367, 436, 437` require current description evidence; `437` happens to match the exact plural query. |
| `FOCUS_CLAIM_FALSE_POSITIVE` | 20 of 27 `focus` results | Focus Search is a noisy generator, not membership truth. |
| `PREWORKOUT_NOOTROPIC_CONFLATION` / `ENERGY_FOCUS_CONFLATION` | 12 excludes | Ordinary Pre Workout, ingredient and focus claims must lose to the primary identity. |
| `STANDALONE_INGREDIENT_AMBIGUITY` | 18 reviews | Four Lion's Mane plus fourteen other standalone cognitive-associated ingredient/botanical rows require review. |
| `MUSHROOM_IDENTITY_AMBIGUITY` | 4 non-Lion rows | One review, two generic mushroom excludes and one Mass Gainer component. |
| `MULTI_IDENTITY_PRODUCT` | 5 strong | IDs `22, 23, 367, 1397, 1401` legitimately cross Pre Workout/Fat Burner and Nootropics boundaries. |
| `PUBLIC_BROWSE_ARCHITECTURE_LIMITATION` | 9 missing strong | Literal Search has no Nootropics semantic membership definition yet. |
| `CURRENT_OFFER_PRESENTATION_FILTER` | 0 | Search does not explain missing strong rows by offer freshness. |
| `NO_USABLE_OFFER` | 5 strong presentation states | IDs `22, 23, 235, 443, 960` have no fresh in-stock offer, but this does not alter membership; `443` remains visible. |
| `INACTIVE_PRODUCT` / `MERGED_PRODUCT` | 0 | The universe is closed to active, unmerged rows. |

## Taxonomy model decision

| Model | Clarity and precision | Recall / risk | Architecture and SEO | Decision |
| --- | --- | --- | --- | --- |
| A — one `/nootropics` route for explicit Nootropic identities | Clear product-identity promise; separates ordinary focus and ingredient claims. | 13 current strong rows; lowest false-positive risk; reviews fail closed. | Direct fit for `CategoryCoverageDefinition`, shared route, resolver, homepage and lifecycle. | **Recommended.** |
| B — explicit Nootropics plus reviewed standalone cognitive ingredients | Broader shopper choice but mixes product type and use-associated ingredients. | Higher potential recall; current evidence cannot defend automatic Lion's Mane/Bacopa/Choline inclusion. | Technically possible but would require a durable reviewed ingredient policy and larger regression surface. | Not yet supported. |
| C — separate Nootropics and cognitive-ingredient routes | Separates identities cleanly in theory. | Avoids one giant bucket but current reviewed ingredient set and demand evidence are insufficient. | Creates another route/lifecycle/SEO surface before the boundary is mature. | Premature. |
| D — broad Brain/Focus route | Simple label but collapses Pre Workout, caffeine, vitamins and ordinary health claims. | Diagnostic Focus precision is poor: 20/27 results are strong excludes. | Would encode Search noise as taxonomy and increase cannibalisation risk. | Reject. |

One `/nootropics` semantic route is therefore correct now. It should contain
the 13 strong identities only; the 21 review rows remain excluded from runtime
results until separately reviewed evidence changes their contract.

## Multi-membership and data-quality separation

Legitimate semantic multi-membership is expected:

- `22, 23, 1397, 1401`: Pre Workout canonical label plus explicit Nootropics
  semantic membership;
- `367` The Stacker: Nootropics + existing Fat Burners + Pre Workout identity;
- seven strong products remain canonically Health Supplements while belonging
  to the Nootropics semantic category.

Do not mutate canonical categories to simulate multi-membership. Semantic browse
membership is the immediate user-facing mechanism; any canonical taxonomy
cleanup requires a separate reviewed data task and production-write authority.

## Existing architecture sufficiency

The current `CategoryCoverageDefinition` and `evaluateCategoryCoverage()` are
sufficient without extension:

1. candidate queries can cover Nootropics, Nootropic, brain/focus identities,
   standalone ingredients and mushroom candidates;
2. exclusion rules run first and can reject ordinary Pre Workout, amino,
   vitamin/mineral, generic mushroom and lexical/benefit matches unless the
   product name independently carries an explicit Nootropic identity;
3. include rules can recognise explicit Nootropic names, explicit Nootropic
   description identity, and Focus plus exact category support;
4. review rules can fail closed on Focus-only, standalone ingredient, Lion's
   Mane and ambiguous mushroom identities;
5. evaluation already returns classification, confidence, reason codes and
   evidence, while strong-only filtering remains downstream in the shared
   landing loader.

No architecture extension, product-ID exception, slug exception, retailer
condition or brand-specific branch is required. IDs belong only in this audit
and future contract fixtures.

The shared `categoryCoverageLanding.ts` and
`CategoryCoverageLandingPage.tsx` can serve a future thin `/nootropics` route
without new route architecture. Once a Nootropics definition and lifecycle
record exist, the existing exact-category resolver should automatically map
clean `/search?q=Nootropics` to `/nootropics`; no Nootropics-specific Search code
is needed. The homepage should likewise discover the definition through the
existing generic `CATEGORY_COVERAGE_DEFINITIONS` append behavior, with no
route-specific homepage hack.

Any future public route must still follow `docs/SEO-Indexability-Lifecycle.md`:
register it as `planned`, retain `noindex, follow`, keep it sitemap-ineligible,
reuse cache/canonical/robots/error contracts and add lifecycle/route tests. This
audit does not authorise that implementation.

## Exact next unit and stop point

Recommended next implementation unit, requiring a separate owner-authorized
implementation task:

> Add one declarative Nootropics `CategoryCoverageDefinition` implementing the
> Model A boundary and all 67 audit fixtures; add a thin `/nootropics` adapter
> through the existing shared landing/presentation and lifecycle contracts;
> register it `planned`, `noindex, follow` and sitemap-ineligible; prove the
> existing generic homepage discovery and exact-category Search resolver work
> without Nootropics-specific code; keep review rows fail-closed; make no
> product-ID/slug/retailer/brand exceptions, no canonical-category or database
> writes, and no SEO-20/PER4M/mobile-menu changes.

The exact stop point is this evidence-backed boundary and implementation
contract. No Nootropics definition, route, Search behavior, homepage change,
lifecycle entry, sitemap change, canonical-category edit, database write or
shared architecture change was performed.
