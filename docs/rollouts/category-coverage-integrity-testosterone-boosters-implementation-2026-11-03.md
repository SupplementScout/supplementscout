# Testosterone Boosters category coverage integrity implementation

Date: 2026-11-03

State: feature implementation complete locally; production evidence pending

Starting `main`: `926bca9e4ac50d0d6170b4643e41f2fba36ed0e0`

Source audit: `docs/rollouts/category-coverage-integrity-testosterone-boosters-audit-2026-11-03.md`

## Scope and architecture

This pilot adds one shared, pure `CategoryCoverageDefinition` registry and
reason-bearing evaluator in `app/lib/categoryCoverage.ts`. The evaluator keeps
candidate retrieval separate from semantic membership and returns exactly one
of `INCLUDE_STRONG`, `EXCLUDE_STRONG` or `REVIEW_REQUIRED`, with deterministic
confidence, reason codes and evidence. Exclusion rules run before inclusion;
unresolved evidence fails closed to review.

The existing Glucosamine, Magnesium, Omega 3, Vitamin D and Vitamins landing
rules are definitions in the same shared layer. `isReviewedLandingProductMatch()`
remains as a thin compatibility wrapper, and its established name-only output
is unchanged. There is no second Testosterone-specific engine.

The Testosterone Boosters definition has the public route
`/testosterone-boosters`, the exact canonical source alias `Testosterone
Boosters`, and broad candidate queries for testosterone, testo, TestX,
Tribooster, hormone support, anabol, Fadogia, Tongkat, Tribulus and
Turkesterone. Candidate terms do not establish membership. Rules contain no
runtime product IDs, slugs, retailer conditions or brand-specific control flow.

## Classification contract

The dedicated 28-row audit fixture proves:

- `11` `INCLUDE_STRONG` products: `183, 184, 217, 225, 285, 429, 499, 514,
  983, 1111, 1366`;
- `6` `EXCLUDE_STRONG` products: `237, 413, 459, 596, 1363, 1387`;
- `11` `REVIEW_REQUIRED` products: `420, 431, 446, 485, 982, 992, 1124,
  1218, 1364, 1365, 1436`.

Product IDs are test and audit labels only. Generic negative fixtures prove
that Creatine, Whey, ordinary Zinc, ordinary Ashwagandha and Pre Workout do not
leak into strong membership through broad description text. Expected public
strong membership is `11`, expected strong false positives are `0`, and all
`11` review-required products remain excluded.

## Public route and lifecycle

`categoryBrowseHref("Testosterone Boosters")` now resolves through the shared
coverage registry to `/testosterone-boosters`, after the existing approved
comparison-route check and before the existing Search fallback. The pilot does
not add an entry to `COMPARISON_CATEGORY_LINKS`, does not change
`comparisonLinkForProduct()`, and does not change product breadcrumbs.

The route reuses `getLandingProducts()`, `CATEGORY_LANDING_PAGE_SIZE`,
`ProductResultCard`, `createLifecycleDataLoader()`,
`assertLifecycleDataAvailable()` and `LifecycleHubError`. It retrieves broad
candidates, renders only `INCLUDE_STRONG`, and leaves price, stock, freshness
and retailer availability downstream of membership.

The route is registered as `planned`. Its base and parameterized metadata use
the shared lifecycle contract and therefore remain `noindex, follow`, with the
base canonical `/testosterone-boosters`. One static sitemap candidate exists,
but shared lifecycle filtering makes its sitemap eligibility false while the
route is planned.

## Preserved boundaries

- General Search query variants, filters, scoring, page and old
  `/search?q=Testosterone%20Boosters` semantics are unchanged.
- No database/schema file, migration, product category or production data was
  changed.
- No production configuration, secret or external service was changed.
- SEO-20 and PER4M files are unchanged; SEO-20 remains the sole SEO task in
  progress and its experiment freeze remains intact.

## Evidence

Preflight Project Guardian: `PASS` at starting main.

Focused tests: `137/137 PASS`, including `8/8` category coverage tests.

TypeScript: `PASS`.

Project Guardian after implementation: `PASS`; 22 SEO tasks valid, SEO-20 sole
`IN PROGRESS` task.

Quality Gate inventory: `349` tests sealed (`289` safe, `56` integration, `4`
artifact-bound, `47` quick).

`verify:quick`: `PASS`.

`verify:full`: `PASS`, including baseline migration validation and the Next.js
16.2.9 production build.

Standalone ESLint: `PASS`. Standalone production build with the quality gate's
isolated loopback Supabase placeholders: `PASS`. `git diff --check`: `PASS`.

Feature CI, deployment and production evidence will be recorded below after
their required runs.

## Production closeout

Pending feature PR, guarded squash merge, main CI, Vercel production and
read-only production verification. Lifecycle status must remain `planned`.
