# Category Coverage shared route refactor

Date: 2026-11-03

Implementation state: local refactor complete; production closeout pending

Starting `main`: `a90f6f892bc5113af4a51764cc201e421c3c33fa`

## Duplication audit

Before this refactor, the explicit route adapters measured:

- `app/testosterone-boosters/page.tsx`: 151 lines;
- `app/fat-burners/page.tsx`: 150 lines;
- `app/collagen/page.tsx`: 194 lines.

All three independently imported or implemented definition lookup, semantic
evaluation, `INCLUDE_STRONG` filtering, `getLandingProducts`, lifecycle cache,
data-availability assertions, metadata plumbing, the SupplementScout header,
Search escape link, reviewed-category introduction, count summary, empty state
and `ProductResultCard` list. Testosterone and Fat Burners repeated a
single-page loader while Collagen separately implemented the same data path
with the shared 24-item pagination contract.

The three route `error.tsx` files are byte-identical 12-line adapters. The
shared evaluator suite was 593 lines, with 194 closed audit fixtures and their
expected ID sets occupying about 260 lines inline.

## Architecture decision

The refactor keeps all three explicit Next.js routes. No dynamic catch-all
route, route-name switch, conditional route chain or second semantic engine was
created.

Responsibilities are now separated as follows:

- `app/lib/categoryCoverage.ts` remains the sole semantic membership source:
  candidate queries, include/exclude/review rules and evaluation.
- `app/lib/categoryCoverageLanding.ts` owns typed route configuration, semantic
  definition lookup, strong-only product filtering, `getLandingProducts`, the
  page argument, lifecycle caching, pagination normalization/redirects,
  availability assertions and metadata construction.
- `app/components/CategoryCoverageLandingPage.tsx` owns the reusable header,
  Search link, reviewed-category copy layout, product/page count, empty state,
  product-card list and shared pagination UI.
- Each explicit `page.tsx` retains only its typed route-specific key, path,
  cache version, metadata profile and presentation copy plus thin metadata/page
  wrappers. The adapters are now 53 lines each.

Presentation remains separate from semantic definitions. The shared component
receives only presentation config and resolved landing results; it does not
import semantic definitions, evaluate membership or know a definition key.

## Deliberately route-local behavior

Each route retains its exact title, description, Search query, introduction,
secondary copy, section title, empty-state text and unique cache version.
Explicit routes retain independent canonical/lifecycle ownership and future
SEO validation.

The three framework-required `error.tsx` files deliberately remain unchanged.
They already delegate to the common `LifecycleHubError`, and adding another
wrapper would increase code without removing the required route-local files.

## Pagination and metadata preservation

All three routes now use the same page-aware loader and existing page size 24.
Against the accepted strong-member contracts this produces:

- Testosterone Boosters: 11 products, 1 page;
- Fat Burners: 21 products, 1 page;
- Collagen: 29 products, 2 pages (24 + 5), with no duplication.

The pagination component remains hidden when `totalPages === 1`. The existing
one-page product-count wording is preserved; the page/total-pages summary is
used only when more than one page exists. Invalid and out-of-range page values
use the existing canonical redirect contract.

The metadata helper has two explicit profiles to preserve rather than
normalize the existing output. Testosterone and Fat Burners retain route-level
OpenGraph `type: website` and inherited root Twitter metadata. Collagen retains
explicit category Twitter metadata, no route-level OpenGraph type, and its
page-specific title/canonical behavior. Titles, descriptions, canonicals,
robots, OpenGraph and Twitter baselines are covered by exact regression tests.

All three lifecycle statuses remain `planned`, with `noindex, follow` and no
sitemap eligibility. The registry remains 19 public routes: 16
`live_verified`, 3 `planned`.

## Fixture organization

Fixture data was extracted because three inline closed universes had become a
material readability cost. The evaluator suite and assertions remain shared;
only audit data and expected IDs moved to:

- `scripts/fixtures/category-coverage/testosterone-boosters.js`;
- `scripts/fixtures/category-coverage/fat-burners.js`;
- `scripts/fixtures/category-coverage/collagen.js`.

The fixtures contain no runtime semantic rules. The exact accepted contracts
remain Testosterone `28 -> 11/6/11`, Fat `114 -> 21/77/16`, and Collagen
`52 -> 29/21/2`.

## Preserved boundaries

The five existing reviewed landing definitions (Vitamins, Magnesium, Vitamin
D, Omega 3 and Glucosamine), Whey semantics, homepage generic category
discovery, Weight Management Search fallback, product breadcrumbs, general
Search and sitemap behavior are unchanged.

Database files, migrations, production configuration, SEO-20 and PER4M files
are unchanged. Database writes are `0`. SEO-20 remains the sole SEO task
`IN PROGRESS`, and the PER4M measurement freeze remains intact. The shared
exact-category Search intent resolver remains the next task; the mobile-menu
fix and Nootropics have not started.

## Verification and production closeout

The new focused architecture suite proves thin explicit adapters, central
strong-only filtering, page-aware caching, shared pagination, exact metadata
profiles, no catch-all route and the deliberate error-boundary decision. The
quality-gate inventory was resealed after adding this test.

Feature PR, approved head, merge SHA, tree equivalence, CI, production
deployment and read-only route/homepage/Search/sitemap smoke evidence will be
recorded here after guarded merge and deployment.
