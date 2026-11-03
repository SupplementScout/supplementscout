# Category Coverage exact Search intent resolver

Date: 2026-11-03

Implementation state: live and production-verified

Starting `main`: `da2277adbddebd7ab912d28beedc392c6e8b02a9`

## Inconsistency and bounded decision

Before this change, clean exact searches for `Testosterone Boosters`, `Fat
Burners` and `Collagen` rendered the ordinary text Search result set even
though the same intent had a dedicated reviewed Category Coverage route. The
semantic routes and raw text Search therefore exposed intentionally different
sets for the same clean navigation phrase.

The resolver is a small pure helper in `app/lib/categorySearchIntent.ts`.
`SearchPage` calls it immediately after awaiting `searchParams` and before
query normalization, intent planning, product loading or Search-result
analytics. A resolved intent uses the Next.js server `redirect()` contract.
`SearchInput` remains a generic GET form with `action="/search"`, and the
suggestion API remains unchanged.

## Authority and safety boundary

The resolver calls the existing `categoryCoverageDefinitionForLabel()` and
then requires the resolved definition route to be an own entry of
`PUBLIC_INDEXABILITY_LIFECYCLE`. It contains no route list, route-name branch,
product ID, slug exception or second category registry. This combination
currently makes only `/testosterone-boosters`, `/fat-burners` and `/collagen`
eligible. Older compatibility definitions are not public-lifecycle entries and
therefore remain ordinary Search. Future definitions become eligible only
through the same semantic and lifecycle authorities.

Only a single string `q` with no other supplied request state can redirect.
The resolver trims leading/trailing whitespace, collapses repeated internal
whitespace and relies on the shared label authority for case-insensitive exact
matching of `publicLabel` or an approved canonical category alias. It performs
no fuzzy, correction, partial, singular/plural or ingredient-alias matching.
Repeated `q`, malformed values, nonexact phrases and every filtered, sorted,
structured or paginated request fail closed to the existing Search flow.

## Deliberate raw Search escape

The shared Category Coverage presentation still needs a truthful way to open
the underlying text Search rather than redirect back to the same category.
`categoryCoverageRawSearchHref()` therefore adds the single explicit
`search_mode=raw` escape to that generic link. The resolver sees the additional
state and declines navigation; no route-specific component behavior exists.

`search_mode` is not a Search filter, is not passed to Supabase, does not alter
`searchProducts`, and is not interpreted by intent parsing, ranking, facets or
sorting. The rendered raw Search retains the existing Search metadata,
`noindex` policy and normal Search-result analytics because it actually renders
results. Clean exact category redirects do not call
`logSearchResultsEvent()` and create no fabricated Search impression.

## Preserved contracts

The Category Coverage semantic engine is unchanged. The accepted contracts
remain Testosterone `28 -> 11/6/11`, Fat `114 -> 21/77/16` and Collagen
`52 -> 29/21/2`. Category lifecycle, metadata, robots, sitemap eligibility and
pagination are unchanged. General Search query variants, corrections, filters,
intent parsing, scoring, ranking, facets, price sorting and nutrition filters
are unchanged.

Database files, migrations, production configuration, SEO-20, PER4M and mobile
menu files are unchanged. Database writes are `0`; no external service is used
by the implementation. SEO-20 remains the sole SEO task `IN PROGRESS` and the
PER4M measurement freeze remains intact. The mobile-menu repair is explicitly
deferred to the next task, and Nootropics has not started.

## Verification

The focused resolver suite covers exact case/whitespace normalization,
nonexact fail-closed behavior, public-lifecycle gating, every protected Search
state, repeated query values, raw mode and behavior-level ordering before
planning, product loading and analytics. The quality-gate inventory is resealed
with the new test.

Feature PR, approved head, merge SHA, tree equivalence, CI, deployment and
read-only production redirect/Search/category/sitemap evidence are recorded
below.

The focused resolver suite passed `9/9`. The combined focused verification
passed `143/143`: Category Coverage `14/14`, route architecture `5/5`, Search
`76/76`, home navigation `11/11`, indexability lifecycle `18/18`, and product
structured data `10/10`. Typecheck, lint, build, Project Guardian,
`verify:quick` (`435/435`), `verify:full`, quality-gate manifest verification,
and `git diff --check` all passed. The resealed manifest contains 351 tests:
291 safe, 56 integration, 4 artifact and 49 quick.

## Merge and deployment evidence

- Feature branch: `feat/category-search-exact-intent`
- Feature commit and approved PR head:
  `182dee7ee8326f095c96b2fa0838e16f9073d9db`
- Feature PR: `#455`, **Search: resolve exact Category Coverage intents**
- PR gates: Project Guardian, Quality Gate, GitGuardian and Vercel passed; the
  PR was clean and had zero unresolved review threads
- Guarded squash merge:
  `6fc25ef0521a9ae5da0e4b54867da8b6cae54e8a`
- Feature-head and merged-main tree:
  `6bd92fafa4d99d3aaa22f147a54aedc41493ee2f`
- Post-merge `main` Project Guardian run `41693817607`: passed
- Post-merge `main` Quality Gate run `41693817581`: passed
- Vercel production deployment `7527218471`: successful for the exact merge
  SHA at `2026-11-03T18:27:19Z`

## Read-only production evidence

The production smoke was performed after the successful deployment. Requests
were first made without following redirects, and then followed separately.

- `/search?q=Testosterone%20Boosters` returned `307` with
  `Location: /testosterone-boosters`; following reached that route with `200`
- `/search?q=Fat%20Burners` returned `307` with
  `Location: /fat-burners`; following reached that route with `200`
- `/search?q=Collagen` returned `307` with `Location: /collagen`; following
  reached that route with `200`
- lowercase `collagen`, uppercase `FAT BURNERS`, and whitespace-normalized
  `Collagen` returned the same semantic destinations
- `Collagen Peptides`, `Marine Collagen`, `Fat Burner`, `Testosterone`, and
  `Testo Pro` remained ordinary `200` Search pages with Search `noindex`
- exact category queries with the tested `sort` state remained ordinary `200`
  Search pages, and repeated `q=Collagen&q=Creatine` failed closed to Search
- all three Category Coverage pages exposed their generic
  `/search?q=<label>&search_mode=raw` action; each rendered an ordinary `200`
  Search page rather than redirecting back to the category

The raw Search result counts remained Testosterone `7`, Fat `8`, and Collagen
`52`. Product identities matched the timestamped pre-deployment baseline
captured at `2026-11-03T18:21:48Z` through `2026-11-03T18:21:51Z`; for Collagen,
the same first-page 24 identities were observed. This confirms the navigation
resolver did not change the underlying Search result behavior.

The final category and sitemap snapshot at `2026-11-03T18:31:49Z` returned
`200` for all category pages. Testosterone exposed 11 unique products, Fat 21,
and Collagen 29 unique products across its 24-item first page and 5-item second
page with zero cross-page duplicates. Testosterone and Fat fit on one page, so
their out-of-range `?page=2` requests correctly reused the single available
page rather than representing a second result page. Each route retained its
canonical, `noindex, follow`, and zero sitemap occurrences. Search pages
retained `noindex, nofollow`.

Production database writes, database-file changes, migrations, production
configuration changes and external-service mutations were all `0`. SEO-20
remains the sole SEO task `IN PROGRESS`, and the PER4M measurement freeze is
unchanged. Mobile-menu work and Nootropics remain unstarted by this task.
