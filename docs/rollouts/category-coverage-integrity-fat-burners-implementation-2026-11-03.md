# Fat Burners category coverage integrity implementation

Date: 2026-11-03

Implementation state: feature implementation in progress; production closeout
evidence pending

Starting `main`: `12708fd7ec127a1a24b3b4422f9a21f902b2ddcd`

Source audit:
`docs/rollouts/category-coverage-integrity-fat-burners-weight-management-audit-2026-11-03.md`

## Approved model and scope

This implementation follows the accepted Model C decision: Fat Burners becomes
one semantic category, while Weight Management remains a catalogue/source label
and continues to use the existing Search fallback. No `weight-management`
definition, route, lifecycle entry or sitemap candidate was created.

The shared `CategoryCoverageDefinition` and evaluator are reused. The Fat
Burners definition separates broad candidate retrieval from deterministic
membership. Its durable 114-product audit fixture universe must reproduce
exactly:

- `21 INCLUDE_STRONG`;
- `77 EXCLUDE_STRONG`;
- `16 REVIEW_REQUIRED`.

The runtime contains no product IDs, slug exceptions, retailer-specific rules
or brand-specific control flow. Established semantic product-family identities
are permitted only where the audit supports them.

## Route and indexability contract

The implementation adds `/fat-burners` using the existing landing retrieval,
semantic filter, lifecycle cache, guarded data-availability and product-card
contracts. Only `INCLUDE_STRONG` products render; review and exclude products
fail closed.

The route is registered as `planned`. Its base and parameterized states return
`noindex, follow`. It has one normal static sitemap candidate which is excluded
by the shared lifecycle filter while the route remains planned. The canonical
is `/fat-burners`.

Homepage category resolution sends `Fat Burners` to `/fat-burners` through the
shared definition. `Weight Management` remains
`/search?q=Weight%20Management`. `COMPARISON_CATEGORY_LINKS` and product
breadcrumb resolution are unchanged.

## Preserved boundaries

General Search semantics are unchanged. The database, migrations, canonical
category labels, production configuration, Testosterone Boosters semantics,
the five existing reviewed category definitions, PER4M and SEO-20 are
unchanged. SEO-20 remains the sole in-progress SEO task and its measurement
freeze remains intact. Database writes for this implementation are `0`.

## Evidence pending production closeout

The feature PR, approved head, merge SHA, tree equivalence, main CI, Vercel
deployment, production route/readback metrics and docs-only closeout PR will be
recorded here after the guarded feature merge and successful production smoke.
