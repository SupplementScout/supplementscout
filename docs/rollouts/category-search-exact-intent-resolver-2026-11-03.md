# Category Coverage exact Search intent resolver

Date: 2026-11-03

Implementation state: local implementation complete; production closeout pending

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

## Verification and production closeout

The focused resolver suite covers exact case/whitespace normalization,
nonexact fail-closed behavior, public-lifecycle gating, every protected Search
state, repeated query values, raw mode and behavior-level ordering before
planning, product loading and analytics. The quality-gate inventory is resealed
with the new test.

Feature PR, approved head, merge SHA, tree equivalence, CI, deployment and
read-only production redirect/Search/category/sitemap evidence will be recorded
here after guarded merge and deployment.
