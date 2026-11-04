# Protein taxonomy semantic authority implementation

Date: 2026-11-04

Implementation state: production complete; documentation closeout pending merge

Starting `main`: `b6a2072f8da2d3873b8f8604861cf0be2ddbab7e`

Source audit: `docs/rollouts/protein-taxonomy-category-coverage-audit-2026-11-03.md`

## Owner decision and bounded scope

The owner accepted the 2026-11-03 taxonomy audit and authorized one semantic
authority implementation, pull request, guarded squash merge, production
verification and a documentation-only closeout pull request if post-merge
evidence cannot be recorded on the feature branch.

The implementation preserves the existing `/whey-protein`, `/whey-isolate`
and `/vegan-protein` routes. It creates no Protein Powder, Casein, Beef, Egg or
Clear Whey route and changes no lifecycle, canonical, metadata, sitemap,
homepage, Search, database, migration or production-write mechanism.

## Architecture

`app/lib/proteinTaxonomy.ts` is the sole multi-dimensional semantic authority.
It is a deterministic, side-effect-free evaluator over `name`, `category`,
optional `description`, optional `product_format` and generic normalized
`sourceLabels`. It imports no React, database, Supabase or route code and knows
no product ID, slug, brand or retailer identity.

Each evaluation returns an independent decision for umbrella, Whey, Isolate,
Vegan, Casein, Beef and Egg. Every decision contains one of
`INCLUDE_STRONG`, `EXCLUDE_STRONG` or `REVIEW_REQUIRED`, a confidence level,
reason codes and the evidence fields used. Multi-membership is intentional:
supported Whey/Casein blends can be strong in both dimensions.

Active/unmerged eligibility remains separate in
`app/lib/proteinEligibility.ts`. Semantic truth is therefore independent of
catalogue lifecycle state, offers, freshness, price, retailer coverage,
sorting and presentation.

`app/lib/proteinSubtypes.ts` now contains compatibility wrappers only. Whey,
Whey Isolate, Vegan and product-category routing consume the shared authority;
there is no route-specific semantic rule or second subtype engine.

## Semantic boundaries

- Whey recognizes explicit and compound source evidence, including ShadoWhey
  and VelosiWhey, without requiring the canonical Whey Protein category.
- Plant/Vegan, Beef, Casein, Egg, Collagen, Mass Gainer, food, non-powder and
  excluded bundle conflicts fail closed for Whey as applicable.
- Isolate requires explicit isolate/ISO/WPI evidence plus Whey source context.
  Plain Clear Whey, an unsourced hydrolysed isolate and isolate blends remain
  review cases; plant, Beef, Casein, Egg, Collagen, Mass Gainer, carbohydrate
  and non-powder conflicts are excluded.
- Vegan requires explicit plant-source protein evidence, excludes foods and
  non-powders, and accepts generic `sourceLabels` so an animal-source conflict
  can fail closed without knowing any retailer.
- Casein accepts explicit name or reviewed description evidence. This preserves
  PEScience Select 905g/1.8kg and the supported GYM HIGH Synergy 1.8kg/Dynamic
  blend evidence while the plain GYM HIGH 600g row remains outside Casein.
- Beef and Egg remain internal semantic dimensions with no new routes.
- The umbrella remains an internal conventional-sports-protein boundary and
  excludes Collagen, Mass Gainer, foods, RTDs, waters, shots, meals and meal
  replacements.

The only exact-name compatibility evidence is the accepted eight-name legacy
Whey blend set. It is centralized, has a dedicated no-expansion regression
guard and is marked for future replacement by structured source evidence.

## Candidate loading and presentation preservation

Whey and Isolate no longer use `.eq("category", "Whey Protein")`. Each loader
uses a bounded, auditable semantic candidate filter over category/name/
description evidence, stable `name` plus `id` ordering and 1,000-row page
iteration. Tests force a full first page and prove the second range is read, so
candidate growth cannot silently truncate at the former limit.

The already complete Vegan name candidate filter is preserved and receives
the same safe pagination contract. `description` is the only optional product
projection added. CategoryComparison offer resolution, 24-hour freshness,
delivered-price and verified nutrition calculations, sorting, presentation,
indexability, route copy and UX are otherwise unchanged.

## Closed fixtures and read-only production proof

`scripts/fixtures/protein-taxonomy/audited-candidates.js` records the complete
strong/review/conflict evidence needed for every audited include and review
set. The 144 offline cases are the 138 umbrella-strong rows, five umbrella
reviews and the separately excluded Olimp isolate-review case. They contain
test labels only and no runtime exception mechanism.

The focused evaluator test proves these exact contracts:

| Dimension | Strong | Review |
| --- | ---: | ---: |
| Whey | 101 | 5 |
| Whey Isolate | 25 | 6 |
| Vegan | 15 | 0 |
| Casein | 10 | 0 |
| Beef | 8 | 0 |
| Egg | 1 | 0 |
| Protein Powder umbrella | 138 | 5 |

Before CI, an anonymous read-only production evaluation checked all 1,357
active/unmerged catalogue rows, not only the fixture positives. It produced
exactly the same strong/review sets with zero unexpected decisions:

- umbrella `138 / 5 / 1,214` strong/review/exclude;
- Whey `101 / 5 / 1,251`;
- Isolate `25 / 6 / 1,326`;
- Vegan `15 / 0 / 1,342`;
- Casein `10 / 0 / 1,347`;
- Beef `8 / 0 / 1,349`;
- Egg `1 / 0 / 1,356`.

The read used the public anonymous REST contract only. It performed two
paginated product GETs and zero mutation methods, RPCs, database writes or
service-role/admin operations.

## Regression coverage

`scripts/protein-taxonomy.test.js` covers exact dimension totals and member
sets, compound aliases and negative neighbours, source-required Isolate,
plain Clear Whey review, animal-labelled Vegan conflict, eligibility
separation, the exact legacy eight and absence of all unapproved routes.

The existing Whey, Isolate, Vegan and product structured-data/routing suites
now exercise the shared authority, category-agnostic strong membership,
review fail-closed behavior, bounded pagination and product breadcrumb routing.
The quality-gate inventory was resealed after adding the focused test.

## Verification and production closeout

Local pre-merge verification is complete:

- focused semantic and route suite: `46 / 46` passed;
- `npm run verify:project`: PASS (`SEO-20` remains the sole active SEO task);
- `npm run verify:quick`: PASS with the sealed 352-test inventory;
- `npm run verify:full`: PASS, including TypeScript, ESLint, all safe test
  batches, baseline migration validation and the Next.js production build;
- build route inventory: 37 static pages and the existing Whey, Isolate and
  Vegan routes only; no new protein route was introduced.

Feature delivery and production closeout are complete:

- feature PR: `#463`, `Unify protein taxonomy across comparison routes`;
- approved feature head: `4e4d6f5ebf768afed43dc5e1a2a32d04e50d5f42`;
- guarded squash merge: `71cd6e10dded98c60dd2307256520822a316cee9` at
  `2026-11-04T08:34:20Z`;
- feature and merge tree: `444d19719f7d3e8963f1613a9e2986314053e54b`
  on both commits;
- PR Project Guardian run `41800158020`, Quality Gate run `41800158194`,
  GitGuardian and Vercel Preview: PASS;
- post-merge Project Guardian run `41800535230` and Quality Gate run
  `41800535167`: PASS for the exact merge SHA;
- Vercel production deployment `8kviaYarmo6hBXNjvHo6EDEhkrZT`: SUCCESS for
  the exact merge SHA at `2026-11-04T08:35:20Z`.

The final anonymous, read-only production readback completed at
`2026-11-04T08:41:59.545Z` against all 1,357 active/unmerged products and the
rendered public routes:

- `/whey-protein`: exactly `101 / 101` audited strong products, zero missing,
  zero false positives and zero review rows visible;
- all seven previously missing Whey rows are visible: Optimum Nutrition 100%
  Isolate 930g, Per4m Isolate Zero 900g, Mutant Iso Surge 727g, DY Nutrition
  Shadowhey Concentrate 2kg, Strom Sports VelosiWhey ISO 1kg, Strom Sports
  VelosiWhey 1.2kg and NutriSport H3avyweight Whey Protein Complex 500g;
- all eight legacy reviewed Whey rows remain visible;
- `/whey-isolate`: exactly `25 / 25` audited strong products, zero missing,
  zero false positives and zero review rows visible;
- the three previously missing strong Isolates are visible: Optimum Nutrition
  100% Isolate 930g, Per4m Isolate Zero 900g and Mutant Iso Surge 727g;
- all six review rows fail closed, including NIHpro, the three plain Clear Whey
  rows, Olimp Iso Plus and Trained By JP Isolate Tri-Blend; CNP ISO Collagen,
  all Beef isolates and all plant isolates are absent;
- `/vegan-protein`: exactly `15 / 15`, zero missing and zero false positives;
  BioTech USA Vegan Protein and GYM HIGH Vegan Plant-Based-Protein are visible;
- the three newly recognized out-of-category Isolate product pages now resolve
  to `/whey-isolate`; CNP ISO Collagen does not. No unrelated breadcrumb delta
  was found;
- existing delivered-price, retailer-coverage, verified-metric, decision-panel,
  structured-data and category-analytics mechanisms remain unchanged;
- `/whey-protein`, `/whey-isolate` and `/vegan-protein` remain in the sitemap;
  no Protein Powder, Casein, Beef, Egg or Clear Whey route or sitemap entry
  exists, and all five unapproved paths return 404;
- Category Coverage remains Testosterone `11`, Fat `21`, Collagen `29` and
  Nootropics `13`; exact Search still redirects `nootropics` to `/nootropics`;
- no new exact-name exception was added beyond the centralized legacy eight;
  database writes, migrations and production configuration changes: `0`;
- `SEO-20` remains the sole active SEO implementation and the PER4M freeze is
  intact. Energy Supplements / Energy Drinks was not started.
