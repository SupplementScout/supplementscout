# Nootropics category coverage integrity implementation

Date: 2026-11-03

Implementation state: feature implementation prepared; production closeout pending

Starting `main`: `aaff507427ccc21d2e241b597a6167197ddb7cca`

Source audit:
`docs/rollouts/category-coverage-integrity-nootropics-audit-2026-11-03.md`

## Approved model and scope

This implementation follows accepted Model A: one semantic Nootropics family
at `/nootropics`. An explicit Nootropic name, an explicit Nootropic formula or
blend description, or a Focus identity supported by the exact reviewed
Nootropics category can be a strong member. Ordinary Pre Workouts with focus
or secondary nootropic copy, vitamins and minerals with cognitive benefit copy,
generic mushroom-wellness products and standalone cognitive-associated
ingredients do not become automatic members.

The existing shared `CategoryCoverageDefinition`, exclusion-first evaluator,
landing loader, lifecycle cache, presentation component, exact-category Search
resolver and homepage discovery mechanism are reused unchanged. The runtime
contains zero Nootropics product-ID or slug exceptions and zero retailer- or
brand-specific control-flow rules.

## Closed audit fixture universe

The 67-product fixture is closed evidence from the source audit. Fixture IDs
are test labels only and are not runtime inputs.

- `INCLUDE_STRONG` (13): `22, 23, 235, 367, 436, 437, 443, 960, 978, 1114,
  1361, 1397, 1401`.
- `EXCLUDE_STRONG` (33): `6, 293, 336, 400, 414, 452, 481, 488, 513, 566,
  581, 585, 586, 596, 597, 615, 634, 635, 636, 656, 661, 961, 1132, 1300,
  1372, 1378, 1379, 1380, 1381, 1382, 1383, 1384, 1386`.
- `REVIEW_REQUIRED` (21): `51, 274, 350, 590, 647, 654, 659, 663, 665,
  674, 675, 676, 695, 699, 714, 908, 1045, 1130, 1131, 1134, 1346`.

The contract explicitly proves that GYM HIGH The Stacker can enter through its
multi-identity description, KIOR Brain Wave and Clear Mind+ can enter through
generic description evidence, Neutonic Focus Pouches requires Focus plus exact
category support, and Applied Nutrition ABE Pump is excluded because its Pump
Pre Workout identity has precedence over secondary nootropic-rich copy.
Standalone Alpha-GPC, Choline, L-Tyrosine, Ginkgo, Ginseng, Rhodiola, Bacopa
and Lion's Mane identities fail closed to review and do not render.

## Route, Search and indexability contract

The thin `/nootropics` adapter uses the shared 24-product page, the
`nootropics-category-v1` cache identity and strong-only rendering. Thirteen
accepted members fit on one page. Metadata uses the existing
`inherit-root-twitter` profile with the title `Compare Nootropic Prices UK` and
neutral reviewed-identity copy.

The route is registered `planned`, so base robots remain `noindex, follow` and
the canonical is `/nootropics`. A normal sitemap candidate is registered but
the shared lifecycle filter must emit zero entries while the route remains
planned.

The homepage obtains Nootropics through the generic definition aggregation and
the category route mapper; no Nootropics literal was added to
`categoryRoutes.ts` or homepage control flow. The existing exact-category
Search resolver maps clean case-insensitive `Nootropics` queries to
`/nootropics`, while singular, qualified, filtered, repeated and raw-mode
queries remain ordinary Search. No Search resolver or Search algorithm code was
changed.

## Preserved boundaries

The Testosterone Boosters `28 -> 11/6/11`, Fat Burners `114 -> 21/77/16` and
Collagen `52 -> 29/21/2` contracts remain unchanged. Existing reviewed landing
definitions, breadcrumbs, mobile navigation, database and migration files,
production configuration, SEO-20 and PER4M are unchanged. SEO-20 remains the
sole in-progress SEO task and its measurement freeze remains intact. Database
writes are zero. Protein Powder and subtype work was not started.

## Production closeout evidence

Pending guarded feature PR merge and production verification. This section
will record the approved head, merge SHA, tree equivalence, CI, Vercel
deployment, production membership, Search redirects, homepage discovery,
sitemap exclusion and final Guardian evidence without changing the lifecycle
from `planned`.
