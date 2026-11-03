# Nootropics category coverage integrity implementation

Date: 2026-11-03

Implementation state: feature merged and production-verified; closeout complete

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

Feature PR [#460](https://github.com/SupplementScout/supplementscout/pull/460)
was squash-merged under the standing owner authorization after Project
Guardian, Quality Gate, GitGuardian and Vercel passed with no unresolved review
threads.

- Approved feature head: `62e7505fa12b7bb48eebef5cc6dad39f083326e2`.
- Feature merge SHA: `7a13f0e3466514662ae231fb98f8245f2bec3139`.
- Approved-head tree and merge tree: identical
  (`5bc47ba6215a78e7adc81ea516640122e930244a`).
- Feature Project Guardian: PASS, run `41710347497`.
- Feature Quality Gate: PASS, run `41710347620`.
- Post-merge main Project Guardian: PASS, run `41710971224`.
- Post-merge main Quality Gate: PASS, run `41710971178`.
- Vercel production deployment: PASS, deployment
  `7WosNvVYXEKJXFLX6Z3GesZCozbh` (GitHub deployment `7529570389`).
- Production smoke completed: `2026-11-03T20:20:44.979Z`.

Production `/nootropics` returned HTTP `200`, canonical
`https://www.supplementscout.co.uk/nootropics` and `noindex, follow`. It
rendered exactly all `13/13` audited strong members on one page, with `0`
missing strong members, `0` strong false positives, all `21/21` review products
absent and all `33/33` strong excludes absent. Strong recall and precision were
both `100%` against the accepted audit contract. GYM HIGH The Stacker, Ultra
Nutrio Limitless Nootropic, both Neutonic products, Brain Gains Switch On,
Ghost Gamer, all three KIOR strong products, both explicit reviewed Pre Workout
Nootropic products and both remaining explicit Nootropic products were visible.
All four Lion's Mane review products, Bacopa, L-Tyrosine and Hydro Amino were
absent.

The production homepage contained exactly one href each for `/nootropics`,
`/testosterone-boosters`, `/fat-burners` and `/collagen`. Clean exact
`Nootropics` and lowercase `nootropics` Search requests returned HTTP `307`
with `Location: /nootropics`. Singular `Nootropic` and `lion's mane` remained
ordinary HTTP `200` Search responses without redirects. Raw Nootropics Search
remained HTTP `200` with its unchanged four identities: Neutonic Focus Pouches,
Ultra Nutrio Limitless Nootropic, KIOR Clear Mind+ and KIOR
NOOTROPIC-FOCCUS.

The production sitemap contained zero exact entries for Nootropics,
Testosterone Boosters, Fat Burners and Collagen because all four routes remain
`planned`. Regression smoke returned the unchanged semantic counts: `11`
Testosterone Boosters, `21` Fat Burners and `29` unique Collagen products across
both Collagen pages.

A headless mobile production smoke confirmed that the navigation remains an
opaque white, fixed full-viewport dialog portalled directly under `body`, locks
body scroll while open, retains its four approved links and restores focus plus
scroll state on Escape. No mobile-menu files were changed.

Database writes were `0`; database and migration files, production
configuration, Search algorithms, breadcrumbs, mobile navigation, SEO-20 and
PER4M were unchanged. SEO-20 remained the sole in-progress SEO task and its
measurement freeze remained intact. The Nootropics lifecycle remains
`planned`; no Protein Powder or subtype work was started.
