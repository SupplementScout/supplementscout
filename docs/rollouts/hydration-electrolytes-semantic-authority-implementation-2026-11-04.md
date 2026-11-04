# Hydration semantic authority and Electrolytes subtype implementation

Date: 2026-11-04  
Status: feature merged and production verified; documentation closeout in progress

## Authority and scope

- Starting authoritative `main`: `1d30a68b5a5e3655397f6200daccd8e232d7d2f4`.
- Source audit: `docs/rollouts/hydration-electrolytes-category-coverage-audit-2026-11-04.md`.
- Scope is limited to Hydration semantic hardening and an internal Electrolytes subtype/filter.
- `/hydration` remains the existing `live_verified` `CategoryComparison` route.
- No `/electrolytes` route, lifecycle record, canonical, robots entry or sitemap entry was created.
- Amino Acids, Protein taxonomy, Carbohydrates, Energy, SEO-20, Stage 3 and the PER4M frozen surface were not reopened.

## Architecture

`app/lib/categoryCoverage.ts` is the single semantic authority for both concepts:

- `hydration` is a public route-bearing definition with label `Hydration` and route `/hydration`.
- `electrolytes` is an internal definition with no public label or route metadata.
- One `evaluateCategoryCoverage()` evaluator and the existing three classifications are used for both.
- The definition model now generically supports public and internal exposure. Public label resolution, homepage discovery and exact Search redirects consume the public-only registry; key-based runtime evaluation consumes the complete semantic registry.
- The shared product evidence shape now accepts optional `product_format`.
- Definitions may specify an explicit fail-closed fallback classification. Existing definitions retain their previous default `REVIEW_REQUIRED` fallback; Hydration and Electrolytes use `EXCLUDE_STRONG` when no primary identity rule matches.

No product ID, slug, exact product name, brand or retailer appears in runtime classification conditions.

## Semantic contract

Hydration strong inclusion uses generic explicit Hydration/rehydration, Electrolyte, isotonic sports-hydration, or compatible reviewed category plus powder evidence. It preserves legitimate Amino, Creatine, Whey, carbohydrate and Energy Drink co-identities.

Generic exclusions cover accessories, plain alkaline/ionised water and ordinary mineral identities without independent Hydration/Electrolyte/isotonic evidence. Review rules fail closed for vitamin water, Electrolyte energy gel, generic sports-drink description evidence, generic drink description evidence and description-only Hydration formula identity.

Electrolytes strong inclusion requires explicit Electrolyte identity, explicit isotonic identity, or reviewed Electrolytes-category powder evidence. Hydration-only identity is reviewable rather than automatically Electrolytes strong. The regression suite proves every Electrolytes strong fixture is also Hydration strong.

## Candidate and commercial loader

`app/lib/hydrationComparison.ts` is now a thin loader:

- active and unmerged rows only;
- broad server-side candidate retrieval across Hydration, Electrolytes, Energy Drinks and Energy Supplements categories, plus bounded name/description evidence;
- a local exact candidate-evidence boundary that removes deliberately broad database matches;
- deterministic `id` ordering;
- 1,000-row pagination to exhaustion;
- fail-closed empty error result if any later page fails;
- shared semantic evaluation for strong-only Hydration membership and Electrolytes subtype annotation;
- existing `CategoryComparison` offer normalization, delivered-price logic and commercial summary.

A forced second-page test and a later-page failure test cover pagination and partial-result prevention.

## Electrolytes subtype control

The existing generic category controls received one bounded reusable extension:

- optional semantic subtype facts and facets;
- stable `subtype=electrolytes` query state;
- server-side composition with brand, retailer, format and sort controls;
- the one-option Electrolytes facet is intentionally visible;
- analytics accepts `subtype` as the existing category-filter event dimension.

Hydration rows are annotated from the shared Electrolytes evaluation in the loader. The UI contains no classifier. `REVIEW_REQUIRED` rows cannot receive the subtype and therefore cannot enter filtered results.

## Search, navigation and lifecycle

- Exact clean `/search?q=Hydration` now resolves generically to `/hydration` because Hydration is a public shared definition on a `live_verified` lifecycle route.
- `search_mode=raw` continues to bypass the redirect.
- Exact `Electrolytes` remains ordinary Search because the definition is internal-only.
- Homepage discovery sees one public Hydration label and does not see Electrolytes.
- Existing exact Hydration category breadcrumbs remain unchanged. Redirecting canonically categorized Electrolytes products would require changing the broader product-routing precedence, so that optional navigation consequence is intentionally outside this bounded task.
- Lifecycle remains `live_verified`; canonical, robots, sitemap policy, indexability thresholds and Stage 3 are unchanged.

## Copy and cache

The route retains its title, description, structured data, decision panel, commercial transparency and comparison presentation. Only correctness copy was tightened to explain explicit identity, the Electrolytes subtype and why mineral presence alone is insufficient.

The lifecycle cache identity changed from `hydration-comparison-v1` to `hydration-comparison-v2` so old membership cannot survive deployment.

## Fixtures and tests

Focused closed fixtures cover:

- explicit Hydration, Electrolyte and isotonic identity;
- Amino, Creatine, Whey, carbohydrate and Energy Drink co-identity;
- vitamin water, Electrolyte gel and three description-only review boundaries;
- functional water, ordinary minerals, benefit-only copy and Pre Workout ingredient-only evidence;
- Hydration-only versus Electrolytes-strong separation;
- the Electrolytes-strong subset invariant.

Existing Amino (99/7/4), Testosterone Boosters (11/6/11), Fat Burners (21/77/16), Collagen (29/21/2), Nootropics (13/33/21), Protein, Search, homepage, lifecycle and sitemap regressions remain in the shared quality suite.

## Fresh pre-deployment evidence

Read-only production catalogue evidence at `2026-11-04T13:20:37.863Z`:

- active unmerged catalogue: 1,357 rows across two 1,000-row pages;
- exact candidate universe: 95;
- Hydration: 35 `INCLUDE_STRONG`, 5 `REVIEW_REQUIRED`, 55 `EXCLUDE_STRONG`;
- Electrolytes: 24 `INCLUDE_STRONG`, 12 `REVIEW_REQUIRED`, 59 `EXCLUDE_STRONG`;
- Electrolytes strong outside Hydration strong: 0;
- the exact five historical Hydration review rows remain review, including vitamin water and Electrolyte energy gel;
- broad production query returned 139 rows and the bounded local evidence predicate deterministically reduced them to the same 95 candidates.

Commercial read-only evidence from the same audit window:

- Hydration strong: 123 fresh offers, 7 fresh retailers, 5 products with 2+ retailers and 2 with 3+ retailers;
- Electrolytes strong: 69 fresh offers, 7 fresh retailers, 1 product with 2+ retailers and 1 with 3+ retailers.

DB writes: 0. Production configuration changes: 0.

## Validation and release evidence

- Initial Project Guardian: PASS; SEO-20 remained the sole SEO task `IN PROGRESS`.
- Focused Hydration/Category Coverage/controls/Search/homepage/lifecycle suite: 92/92 PASS.
- `npm run verify:quick`: PASS (Project Guardian, TypeScript, ESLint and 446 quick tests).
- Final `npm run verify:project`: PASS on the feature tree.
- `npm run verify:full`: PASS, including the complete safe/integration inventory, migration validation and production build.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS with the repository's isolated build credentials and again with the public read-only production client plus a non-production service placeholder.
- `git diff --check`: PASS.
- Local production build readback: `/hydration` 200 with 35/35 rows; `?subtype=electrolytes` 200 with 24/35 rows and parameterized `noindex` preserved.
- Desktop and narrow 500 px visual readback: PASS; existing `CategoryComparison` hierarchy, cards and responsive layout remain intact.
- Feature branch: `feature/hydration-electrolytes-semantic-authority`.
- Feature PR: `#471`.
- Approved feature head SHA: `41178d1449c2c64a5011bf08c5a58a35b4a1c828`.
- Feature squash merge SHA: `c7109945fd54eeb3c21a040420277f069883a2b4`.
- Tree equivalence: PASS; feature and merge tree SHA are both `873b5dc2b2b38b3de87248a868e736c765387efc`.
- Feature PR Project Guardian: PASS.
- Feature PR Quality Gate `full`: PASS in 3m20s.
- Feature PR GitGuardian: PASS.
- Feature PR Vercel: PASS.
- Unresolved review threads before merge: 0.
- Post-merge Project Guardian: PASS.
- Post-merge Quality Gate `full`: PASS in 3m18s.
- Production Vercel deployment for `c7109945`: PASS at `2026-11-04T13:39:51Z`.

## Production closeout

Read-only production route evidence at `2026-11-04T13:44:04.097Z`:

- `main` and feature squash merge SHA: `c7109945fd54eeb3c21a040420277f069883a2b4`.
- `/hydration`: HTTP 200, canonical `/hydration`, indexable, 35 shown of 35 total.
- Hydration strong/review/exclude: 35/5/55.
- Route missing strong: 0.
- Route false positives: 0.
- Route review visible: 0.
- Route recall: 35/35 = 100%.
- Route precision: 35/35 = 100%.
- Historical isotonic miss `7Nutrition Isotonic Gold 1000g`: visible.
- Historical vitamin-water review: not visible.
- Historical Electrolyte-gel review: not visible.
- Historical plain functional-water false positive: not visible.
- `?subtype=electrolytes`: HTTP 200, parameterized `noindex` preserved, 24 shown of 35 Hydration products.
- Electrolytes strong/review/exclude: 24/12/59.
- Electrolytes strong outside Hydration: 0.
- `/electrolytes`: HTTP 404 with no redirect.
- Exact Hydration Search: HTTP 307 to `/hydration`.
- Exact Electrolytes Search: HTTP 200 ordinary Search with no redirect.
- Hydration `search_mode=raw`: HTTP 200 ordinary Search with no redirect.
- Homepage: one Hydration category entry; the second intentional `/hydration` link is the separate Hydration goal card, not a duplicate category entry. Electrolytes is absent from public discovery.
- Sitemap: exactly one `/hydration` URL and zero `/electrolytes` URLs.
- Lifecycle: `/hydration` remains `live_verified`.

Fresh read-only semantic and commercial evidence at `2026-11-04T13:44:17.092Z`:

- active unmerged catalogue: 1,357 across two pages;
- candidate universe: 95;
- Hydration: 35 strong, 5 review, 55 exclude, 125 fresh offers, 8 fresh retailers, 5 products with 2+ retailers and 3 with 3+ retailers;
- Electrolytes: 24 strong, 12 review, 59 exclude, 69 fresh offers, 7 fresh retailers, 1 product with 2+ retailers and 1 with 3+ retailers;
- Electrolytes strong outside Hydration: 0.

DB writes remained 0. Production configuration changes remained 0. SEO-20 remained the sole SEO task `IN PROGRESS`; its policy and frozen PER4M surface are unchanged.

Documentation closeout branch: `docs/hydration-electrolytes-production-closeout`. The PR and squash merge SHA are reported in the final owner handoff because a commit cannot truthfully contain its own future PR merge identity.

The stop point is this production verification and documentation closeout. Carbohydrates and Energy work did not start.
