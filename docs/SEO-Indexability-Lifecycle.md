# SEO Indexability Lifecycle

**Status:** binding technical contract  
**Applies to:** every future public comparison, category, brand and retailer
hub  
**Source of truth:** `app/lib/indexabilityLifecycle.ts`

## Purpose

This contract separates a page's approved launch state from its changing live
data. A temporary loss of fresh offers must not remove a page which has already
been launched and verified from Google. Freshness and exact-identity rules still
decide what users may see; they do not silently reverse an approved launch.

Reuse this system. Do not create route-local lifecycle logic, another registry,
another cache or a second comparison loader.

## Central lifecycle registry

`app/lib/indexabilityLifecycle.ts` contains two explicit sets:

- `PUBLIC_INDEXABILITY_LIFECYCLE` lists approved public lifecycle hubs and
  their status. Every entry must resolve to an existing `app/**/page.tsx`.
- `NON_PUBLIC_INDEXABILITY_DECISIONS` records deliberate non-public decisions.
  GYM HIGH is kept here as `owner_deferred`; it is not a public route registry
  entry and must not gain a page or sitemap URL without a new owner decision.

`INDEXABILITY_LIFECYCLE` is their combined compatibility view. Robots and the
sitemap adapter read this shared state. Unknown routes and unknown statuses
fail closed.

The allowed statuses are:

| Status | Meaning | Base robots | Sitemap |
|---|---|---|---|
| `planned` | Proposed, not approved for launch. | `noindex, follow` | absent |
| `launch_approved` | Owner approved release; awaiting final live verification. | `index, follow` | present |
| `live_verified` | Public release and required live checks passed. | `index, follow` | present |
| `owner_deferred` | Owner deliberately withheld publication. | `noindex, follow` | absent |
| `manually_withdrawn` | Owner deliberately withdrew a previously public route. | `noindex, follow` | absent |

`launch_approved` is a short release state, not a substitute for recording live
evidence. The authoritative SEO ledger can call work complete only after its
own `LIVE VERIFIED` evidence rules pass.

## Launch lifecycle versus live coverage

Lifecycle answers: "Has this base URL been approved for indexing?" Live
coverage answers: "Which exact products and offers are safe to show now?"

Live coverage includes current product, offer and retailer counts, the shared
24-hour freshness rule, stock, exact variant, exact pack and known delivered
price. It controls visible rows, honest limited/empty states, monitoring and
alerts. It does not change robots or sitemap eligibility for a
`live_verified` route.

Existing readiness gates remain mandatory launch evidence and quality
monitoring. They must not become an hourly deindex switch after launch.

## Robots, sitemap, canonical and parameters

- A base route uses `getLifecycleRobots(path)`. Only `launch_approved` and
  `live_verified` are indexable.
- Any unapproved query parameter uses `noindex, follow`, while its canonical
  remains the clean base URL.
- Do not emit indexable filter, sorting or tracking combinations.
- SEO-04 crawlable category pagination is the reviewed exception. Its own
  normalizer and page-specific canonical contract remain unchanged.
- `/search` retains its separate noindex search contract and is not a lifecycle
  hub.
- The sitemap obtains lifecycle decisions through
  `app/lib/sitemapReadiness.ts`; it must not rerun live coverage gates.
- Public lifecycle hubs occur exactly once in `app/sitemap.ts` and are filtered
  by the same combined lifecycle state. Planned, deferred and withdrawn routes
  are absent.
- Product URLs and ordinary static pages retain their existing separate sitemap
  policies.
- A complete product-sitemap loader error or detected partial pagination throws
  instead of returning a successful, truncated sitemap.

## Data cache contract

Every lifecycle hub loads comparison data through
`createLifecycleDataLoader()` in `app/lib/lifecycleDataCache.ts`.

- Successful results use Next.js `unstable_cache` for at most 3,600 seconds.
- The cache key prefix is `lifecycle-hub-data-v1` and includes the route plus a
  unique query-version string supplied by that route.
- The current hour bucket is an input, so an entry older than one hour cannot
  be served while background revalidation runs.
- Different hubs and query versions cannot share an entry.
- Change the query-version string when the result shape or selection semantics
  change. Do not reuse a version across hubs.
- A valid empty result is cacheable. It is evidence that the complete query
  succeeded and currently found no safe rows.
- A loader result with `error: true` is thrown before caching. It must never be
  converted to an empty list or a successful response.
- Partial results are errors unless the loader can prove completeness. Do not
  render the known subset as if it were complete.

## Empty results and failures

A complete successful query with zero qualifying rows returns the normal page
and an honest empty-state message. A `live_verified` base route remains
`index, follow` and stays in the sitemap.

A full loader, database or proven-partial-result failure aborts rendering. It
must produce an HTTP 5xx response with no-store behavior and no stale or false
offer list. Each lifecycle route has a thin route-level `error.tsx` using the
shared `app/components/LifecycleHubError.tsx`. The shared client component
shows a neutral message and invokes Next.js 16 `unstable_retry()` so the Server
Component is actually requested again. Do not replace it with `reset()` and do
not add a global error boundary for this scoped behavior.

## Current approved routes

The following routes are currently `live_verified`:

- `/deals`
- `/whey-protein`
- `/vegan-protein`
- `/protein-bars`
- `/whey-isolate`
- `/mass-gainer`
- `/pre-workout`
- `/amino-acids`
- `/multivitamins`
- `/creatine`
- `/hydration`
- `/brands/applied-nutrition`
- `/brands/per4m`
- `/brands/biotech-usa`
- `/retailers/ebay-uk`

GYM HIGH remains `owner_deferred` for both the proposed brand and retailer
routes. It is outside the public registry and sitemap.

## Adding a public hub

1. Check whether the same page or mechanism already exists.
2. Add the route to the central public lifecycle registry.
3. Give it the initial status `planned`.
4. Use the shared lifecycle robots helper.
5. Use the shared sitemap adapter.
6. Use the shared lifecycle cache loader.
7. Assign a unique cache query version.
8. Add a route-level error boundary using the shared component.
9. Make unapproved parameters `noindex, follow`.
10. Canonicalize parameter URLs to the clean base route.
11. Preserve approved SEO-04 pagination as a separate exception.
12. Add lifecycle, route, robots, canonical, sitemap, cache, empty-state and
    loader-error contract tests.
13. Pass the documented launch readiness gate without weakening it.
14. Obtain explicit owner launch approval.
15. After public verification, change the lifecycle status to `live_verified`
    and record the required commit/deployment/live evidence in the ledgers.
16. Never make its robots depend on hourly coverage after live verification.

## Required tests

The contract suite must prove:

- every public registry entry has an existing page and an allowed status;
- public lifecycle routes use shared robots, canonical, sitemap, cache and
  route-level error contracts;
- missing routes and unknown statuses fail closed;
- `live_verified` stays indexable at zero coverage;
- `planned`, `owner_deferred` and `manually_withdrawn` are not indexable;
- unapproved parameters are noindex with the clean canonical;
- every public lifecycle route appears once in the sitemap source and GYM HIGH
  does not;
- cache success, expiry, isolation, valid empty results and uncached errors;
- full/partial loader errors abort while valid zero renders honestly;
- SEO-04 pagination, `/search`, product pages and unrelated routes retain their
  separate contracts.

The repository deliberately does not scan every `app/**/page.tsx` and guess
whether it is a hub. That heuristic would be brittle and could misclassify
product, admin or static routes. The automatic contract covers every route in
the explicit public registry and every lifecycle entry used by the sitemap.
AGENTS.md makes registration mandatory before a new public hub is built.

## Release, withdrawal and rollback

For launch, keep the route `planned` until its data boundary, metadata, schema,
parameters, empty state, 5xx behavior, tests and owner approval pass. Use
`launch_approved` for the controlled release, verify public HTTP, canonical,
robots, sitemap, schema and visible data, then record `live_verified`.

Do not withdraw a live page because one refresh failed or coverage dipped.
Escalate a sustained quality problem with dated evidence. Manual withdrawal
requires an explicit owner decision, a change to `manually_withdrawn`, aligned
robots/sitemap verification and a recorded recovery condition.

Application rollback reverts the lifecycle implementation commit as one unit.
If only a newly launched route is unsafe, the owner may instead approve
`manually_withdrawn`. Preserve data, offers and history; this lifecycle system
does not authorize production-data writes or refresh workflows.
