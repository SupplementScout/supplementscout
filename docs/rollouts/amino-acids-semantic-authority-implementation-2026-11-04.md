# Amino Acids semantic authority implementation

## Scope and authority

- **Implementation date:** 2026-11-04
- **Starting `origin/main`:** `9c3076b57cdd37d52801efa8403c6a8a7b8a9bf6`
- **Source audit:** [Final P1 category coverage sweep](final-p1-category-coverage-sweep-2026-11-04.md)
- **Production project:** `aftboxmrdgyhizicfsfu`
- **Bounded unit:** Amino Acids semantic authority only

This implementation hardens the existing `live_verified` `/amino-acids`
route. It does not start Hydration, Carbohydrates or Energy work. It does not
change SEO-20, the PER4M experiment surface, lifecycle state, indexability
thresholds, sitemap policy, production data, migrations or configuration.

## Fresh pre-implementation evidence

A complete active/unmerged catalogue read at `2026-11-04T12:13:17.846Z`
returned 1,357 products using deterministic `id ASC` pagination to exhaustion.
The audited semantic population had not drifted:

| Classification | Products |
|---|---:|
| Candidate universe | 110 |
| `INCLUDE_STRONG` | 99 |
| `REVIEW_REQUIRED` | 7 |
| `EXCLUDE_STRONG` | 4 |

The old route still exposed 80 strong products with no visible review or
exclude rows. Nineteen strong products remained missing. Fresh commercial
coverage had naturally moved to 259 offers, 10 retailers and 17 products with
at least two fresh retailers. The missing set had 31 fresh offers, six
retailers and five multi-retailer products. Counts were observed, not forced.

## Architecture

Semantic truth now belongs to one `amino-acids` definition in
`app/lib/categoryCoverage.ts`:

- public label `Amino Acids`;
- route `/amino-acids`;
- canonical alias `Amino Acids`;
- bounded candidate vocabulary for Amino, BCAA, EAA and the reviewed named
  amino identities;
- exclusion-first, include-second, review-third evaluation through the
  existing `evaluateCategoryCoverage()` engine.

`app/lib/aminoAcidsComparison.ts` remains responsible only for catalogue
eligibility, candidate retrieval, complete pagination, offer retrieval,
CategoryComparison normalization and the unchanged indexability summary.
`isAminoAcidsProduct()` delegates semantic membership to the shared evaluator
and admits only `INCLUDE_STRONG` products after active/unmerged eligibility.
The old route-local include and exclude regular expressions were removed.

CategoryComparison remains the commercial presentation. No
`CategoryCoverageLandingPage`, second classifier or dynamic category route was
introduced.

## Candidate retrieval

The loader now selects `description` and retrieves a bounded generic union:

- exact `Amino Acids` canonical category;
- Amino, BCAA and EAA names;
- Glutamine, Arginine/AAKG, Beta-Alanine, Citrulline, Carnitine, Glycine,
  Taurine, Tyrosine, Leucine/Isoleucine/Valine, Lysine and HMB names;
- bounded intra-workout candidates for review.

The database query still requires active, unmerged products. Results are
ordered by stable product ID and fetched in 1,000-row pages until a short page
proves exhaustion. A later-page failure returns the existing error result and
cannot publish a partial comparison. Candidate retrieval is not membership;
every row passes through the shared evaluator.

## Semantic rules

`INCLUDE_STRONG` requires one of:

1. an explicit Amino, BCAA or EAA primary/named co-primary identity;
2. an explicit named amino identity from the reviewed vocabulary;
3. exact reviewed Amino Acids category plus description evidence explicitly
   identifying an Amino Acids, BCAA or EAA formula for an otherwise opaque
   name.

This supports legitimate multi-membership such as Creatine + Taurine,
Creatine + HMB and Hydration + EAA/BCAA without rewriting canonical category.

`EXCLUDE_STRONG` has precedence for NAC, 5-HTP and Glutathione identities.

`REVIEW_REQUIRED` fails closed for opaque exact-category formulas without
sufficient description evidence, intra-workout ambiguity, bundles/multipacks,
Protein/Whey co-identity and an Energy/stimulant plus named-amino formula that
lacks independent Amino family evidence. No runtime product ID, slug, exact
product name, brand, retailer or source-store branch exists.

## Closed fixtures

`scripts/fixtures/category-coverage/amino-acids.js` contains the 110 audited
products as test evidence only. It reproduces exactly:

- 99 `INCLUDE_STRONG`;
- seven `REVIEW_REQUIRED`;
- four `EXCLUDE_STRONG`.

The 19 historical misses are all covered by generic rules. The two opaque
strong names use generic exact-category plus explicit formula-description
evidence. Fixture IDs and names do not occur in runtime conditions.

Existing Testosterone Boosters, Fat Burners, Collagen and Nootropics fixture
counts remain unchanged. Protein taxonomy regression coverage remains green.

## Page, cache and Search behavior

- `/amino-acids` keeps its metadata, canonical, robots, sitemap entry,
  structured data, analytics, decision panel, controls and error behavior.
- The customer-facing inclusion copy now describes semantic evidence rather
  than claiming canonical-category confinement.
- The lifecycle cache query version changes from
  `amino-acids-comparison-v1` to `amino-acids-comparison-v2` so old membership
  cannot survive deployment.
- Registering the real shared definition makes a clean exact
  `/search?q=Amino%20Acids` resolve generically to `/amino-acids`.
- `Amino Acid`, `BCAA` and `EAA` remain ordinary Search queries.
- The existing shared `search_mode=raw` escape remains ordinary Search and the
  Amino page uses it for its explicit Search links.
- Homepage discovery continues to use the generic case-insensitive dedupe and
  produces one Amino Acids destination.

No `/bcaa`, `/eaa` or `/amino-acid` route was added.

## Local and production-backed pre-merge verification

Focused tests cover:

- all 110 audited classifications;
- category-agnostic and description-supported inclusion;
- derivative exclusions and review fail-closed behavior;
- strong-only comparison normalization;
- complete second-page pagination and partial-query failure;
- generic exact Search redirect plus raw escape;
- absence of subtype routes;
- one deduplicated homepage destination;
- unchanged earlier Category Coverage and Protein contracts.

The new code was also executed read-only against the full production catalogue
at `2026-11-04T12:24:50.685Z`:

| Measure | Result |
|---|---:|
| Active/unmerged catalogue | 1,357 |
| Candidate universe | 110 |
| Strong | 99 |
| Review | 7 |
| Exclude | 4 |
| Route loader visible | 99 |
| Missing strong | 0 |
| False positives | 0 |
| Review visible | 0 |
| Historical misses visible | 19/19 |
| Historical reviews visible | 0/7 |
| Historical excludes visible | 0/4 |
| Fresh offers | 259 |
| Fresh retailers | 10 |
| Products with 2+ fresh retailers | 17 |

This readback used public anonymous read paths only. Database writes: **0**.

## Release closeout

### Feature delivery

- Feature PR: [#469](https://github.com/SupplementScout/supplementscout/pull/469).
- Approved feature head: `776fac5e2b615a981c5adb3b8f3f4d471d20bdd4`.
- Production squash merge: `f2ae5ae0c802a666855674be29de1ed1cb62762d`.
- Feature-head and squash-merge trees are identical at
  `062bab8b61d2d88c20a36048026ca3ba73b751da`; an empty Git diff independently
  confirmed equivalence.
- Before merge, Project Guardian, Quality Gate Full, GitGuardian and Vercel
  Preview passed and the PR had zero unresolved review threads. The feature CI
  runs were Project Guardian
  [41830114929](https://github.com/SupplementScout/supplementscout/actions/runs/41830114929)
  and Quality Gate
  [41830115081](https://github.com/SupplementScout/supplementscout/actions/runs/41830115081).
- Post-merge `main` passed Project Guardian
  [41830634103](https://github.com/SupplementScout/supplementscout/actions/runs/41830634103)
  and Quality Gate
  [41830634375](https://github.com/SupplementScout/supplementscout/actions/runs/41830634375).
- The production Vercel deployment for the squash merge completed successfully
  at `2026-11-04T12:36:32Z`.

### Production readback

A fresh anonymous full-catalogue read at `2026-11-04T12:39:43.969Z` executed
the deployed shared evaluator and route-loader code over all 1,357 active,
unmerged products. It returned:

| Measure | Production result |
|---|---:|
| Candidate universe | 110 |
| `INCLUDE_STRONG` | 99 |
| `REVIEW_REQUIRED` | 7 |
| `EXCLUDE_STRONG` | 4 |
| Route-loader visible | 99 |
| Missing strong | 0 |
| False positives | 0 |
| Review visible | 0 |
| Historical misses visible | 19/19 |
| Historical reviews visible | 0/7 |
| Historical excludes visible | 0/4 |
| Recall against current strong set | 100% |
| Precision against current visible set | 100% |
| Fresh offers | 259 |
| Fresh retailers | 10 |
| Products with 2+ fresh retailers | 17 |

The uncached loader's latest included offer check was
`2026-11-04T12:37:35.633Z`. A public HTML read at
`2026-11-04T12:43:27.667Z` showed the same 99/99 products, 10 retailers and 17
multi-retailer products from the route cache, with 253 fresh offers in that
cache snapshot. This six-offer commercial-timing difference does not change
semantic membership; counts were observed rather than forced. The public HTML
contained every still-current historical miss (including the current product
name for product 522) and none of the seven review or four exclude products.

Public behavior was also verified read-only:

- `/amino-acids` returned 200, its unchanged canonical URL and `index, follow`;
- the CategoryDecision panel, all 99 comparison rows, filters, sorting,
  commercial cards and corrected semantic-boundary copy rendered;
- robots did not block the route and the sitemap contained exactly one Amino
  URL;
- clean exact `/search?q=Amino%20Acids` returned 307 to `/amino-acids` through
  the generic resolver;
- `search_mode=raw` returned ordinary Search with 200, and BCAA, EAA and Amino
  Acid remained ordinary 200 Search queries;
- `/bcaa`, `/eaa` and `/amino-acid` each returned 404;
- the homepage Popular categories section contained exactly one Amino Acids
  label and destination. The pre-existing Popular searches link is a separate
  discovery surface, not a duplicate category entry.

The complete production and HTTP verification used public anonymous reads
only. Database writes: **0**. Production configuration changes: **0**.

SEO-20 remains the sole SEO task `IN PROGRESS`. `/amino-acids` remains
`live_verified`; its lifecycle state, indexability thresholds, canonical,
robots and sitemap policy are unchanged. Hydration, Carbohydrates and Energy
implementation did not start.
