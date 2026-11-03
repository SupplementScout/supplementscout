# Testosterone Boosters category coverage integrity implementation

Date: 2026-11-03

State: production pilot verified; documentation closeout recorded

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

Feature PR: `#445`, Category Coverage: fix Testosterone Boosters browse
membership.

Approved feature head: `51df2810144935fe01901f70f7c991f96cc7dc4b`.

Squash merge on `main`: `cd66b817322078c5eaad2512a12ee7dcc69182a3`.

Feature-head tree and squash-merge tree: identical
(`adf963855c87b39e7084d8aec9b0a8aefdf339fd`).

All PR checks passed: Project Guardian, Quality Gate, GitGuardian and Vercel
Preview. There were zero review threads. Automatic post-merge Project Guardian
run `41645983382` and Quality Gate run `41645983325` both passed without manual
workflow dispatch. Vercel production deployment
`Gg6AgRBFhYuXPVgAXmTZxR6LMv85` completed successfully for the merge SHA.

Read-only production verification completed at
`2026-11-03T13:41:14.5280252Z`:

- `/testosterone-boosters` returned HTTP `200`, canonical
  `https://www.supplementscout.co.uk/testosterone-boosters` and robots
  `noindex, follow`;
- the route exposed exactly `11` unique canonical product links, covering all
  `11/11` approved strong identities, with `0` missing strong identities;
- current catalogue display text differs from the audit wording for three
  identities only: `Biotech USA Tribooster 60 Tablets`, `Olimp Nutrition DAA
  Xtreme Prolact-Block - 60 tablets`, and `Animal Stack 21 Packs`; their
  canonical slugs match the audited products;
- all `6` strong excludes were absent, including Chaos Crew Turk, and all `11`
  review-required products were absent;
- strong recall was `100%` and strong precision was `100%`, with `0` strong
  false positives;
- the production homepage linked Testosterone Boosters to
  `/testosterone-boosters` and did not retain the old Search href;
- the old `/search?q=Testosterone%20Boosters` URL remained HTTP `200` with the
  same seven baseline text-search cards and identities;
- production `sitemap.xml` contained `0` occurrences of
  `/testosterone-boosters`, as required by the `planned` lifecycle;
- database writes were `0`, production configuration changes were `0`, and no
  canonical product category was changed;
- SEO-20 remained the sole SEO task `IN PROGRESS`; its PER4M experiment files
  and freeze were unchanged.

Lifecycle status remains `planned`. This closeout does not make the route
indexable and does not authorize the next category pilot.
