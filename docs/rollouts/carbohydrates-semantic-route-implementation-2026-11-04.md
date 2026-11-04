# Carbohydrates semantic route implementation

- **Implementation date:** 2026-11-04
- **Starting `origin/main`:** `74d4d087d3bc02ada3a778225e5472b68a6c6b5d`
- **Source audit:** `docs/rollouts/final-p1-category-coverage-sweep-2026-11-04.md`
- **Feature branch:** `feature/carbohydrates-semantic-route`
- **Lifecycle target:** `planned`
- **Scope:** one shared Carbohydrates semantic definition, one planned/noindex `/carbohydrates` CategoryComparison route and broad P1 category-cleanup closeout after production verification

## Preflight and fresh baseline

The root checkout contained unrelated owner work and was preserved unchanged. Implementation used a clean worktree from the exact required `main` SHA. Project Guardian passed before substantive work with 22 structurally valid SEO tasks, `SEO-20` as the sole SEO task `IN PROGRESS`, and only the existing stale weekly-measurement reminder.

The current Operating Plan checkpoint, SEO Execution Plan, Agent Operating Model, SEO Indexability Lifecycle, final P1 sweep and relevant local Next.js 16.2.9 guides were reviewed. Protein, Amino Acids and Hydration/Electrolytes implementations were present. No Carbohydrates shared definition, loader or route existed.

A fresh read-only public Supabase audit at `2026-11-04T14:02:05.517Z` read all 1,357 active/unmerged products in deterministic 1,000-row pages. It reproduced the closed semantic universe exactly:

| Classification | Fresh count |
|---|---:|
| Candidates | 34 |
| `INCLUDE_STRONG` | 22 |
| `REVIEW_REQUIRED` | 6 |
| `EXCLUDE_STRONG` | 6 |

Commercial coverage legitimately drifted from the historical baseline to 78 fresh valid offers, eight retailers, 18 strong products with at least one fresh offer, four without, six products with 2+ fresh retailers and zero with 3+. Counts were observed, not forced.

The clean production Search query `Carbohydrates` still returned 14 results: three audited strong and 11 non-strong, so pre-implementation recall remained `3/22 = 13.6%` and precision `3/14 = 21.4%`. `Carbohydrate` returned 17 results, `Carb Powder` 19 and `Cream of Rice` 12; none had an exact-category redirect.

## Shared semantic authority

`app/lib/categoryCoverage.ts` now owns one public definition with key `carbohydrates`, public label and sole canonical alias `Carbohydrates`, and route `/carbohydrates`. The existing `evaluateCategoryCoverage()` engine provides exclusion-first, inclusion-second, review-third precedence.

Strong rules use generic explicit product evidence for Carbohydrate/Carbo/Carb powder identities, Cream of Rice, cyclic or cluster dextrin, dextrose, maltodextrin, Vitargo and explicit carbohydrate/electrolyte co-identity. Low-carb/Carb Killa food identities, Protein Bars, shakes, spreads, croissants and snacks exclude generically. Protein/Whey co-identity, Mass Gainer ambiguity, Energy Drinks/gels, sports drinks and description-only carbohydrate formula evidence fail closed. No product ID, slug, exact audited name, brand or retailer is a runtime condition.

Cream of Rice remains inside the shared Carbohydrates family. Explicit carbohydrate/electrolyte powders can independently remain strong Hydration/Electrolytes members. Hydration rules were not changed.

The closed 34-candidate fixture records the full historical `22 / 6 / 6` evidence set. IDs and names exist only in fixture/documentation evidence.

## Candidate and commercial loader

`app/lib/carbohydratesComparison.ts` is a thin loader. It queries active/unmerged products across canonical categories using broad category, name and bounded description candidate evidence; selects description, format, package/serving and offer fields; orders by `id ASC`; reads 1,000-row pages to exhaustion; locally confirms candidate evidence; delegates membership to shared Category Coverage; admits only `INCLUDE_STRONG`; and delegates offer freshness, delivered-price, verified value and summary behavior to `normalizeCategoryComparison()`.

A later-page error returns the existing empty error result. Partial data is never published. Candidate breadth is deliberately wider than membership, so low-carb and ambiguous protein rows reach the evaluator instead of becoming runtime exceptions.

## Route, discovery and lifecycle

`/carbohydrates` uses the rich CategoryComparison pattern with current offer cards, known delivered totals, verified price-per-kilogram/per-serving values where available, generic server controls, structured `CollectionPage`/`ItemList`/`BreadcrumbList` data, Category Decision, consent-aware category analytics and commercial-transparency links. Copy explicitly states that Cream of Rice, dextrose, dextrin, Vitargo and carbohydrate/electrolyte formulas are not necessarily equivalent.

The route is registered `planned`. Base and parameter states are `noindex, follow` with canonical `/carbohydrates`. The static sitemap candidate registry contains the route exactly once, while the lifecycle adapter excludes it from emitted sitemap output. The scoped lifecycle error boundary uses the shared safe retry screen.

No Carbohydrates-specific Search branch or homepage exception was added. The public definition plus lifecycle registration makes clean exact `Carbohydrates` resolve through the existing generic Search resolver; `search_mode=raw` remains ordinary Search. Singular `Carbohydrate`, `Carb Powder`, `Cream of Rice`, `Dextrose` and `Vitargo` remain ordinary Search. Homepage category discovery continues through `categoryBrowseHref()` and deduplicates the canonical catalogue label against shared public definitions.

No `/cream-of-rice`, `/carb-powder`, `/sports-drinks`, `/dextrose` or `/vitargo` route exists. Product breadcrumb routing was intentionally not broadened: the current canonical/product-subtype precedence remains authoritative, avoiding weak canonical-only or cross-family overrides in this bounded route task.

## Verification and release evidence

Local implementation verification is complete. Guarded release evidence will be recorded here after the feature and any documentation-only closeout PR complete:

- focused Carbohydrates/Category Coverage/Search/homepage/lifecycle/sitemap tests: **104 passed, 0 failed**
- Project Guardian before and after implementation: **PASS**; 22 SEO tasks; `SEO-20` remains the sole task `IN PROGRESS`
- Quality Gate quick: **PASS**; 461 tests, 0 failed
- Quality Gate full: **PASS**; 353-test inventory, 293 safe tests, 56 integration tests and four artifact-bound tests; baseline migration validation and Next.js production build passed
- typecheck/lint/diff check: **PASS / PASS / PASS**
- feature PR/head/merge/tree equivalence: pending
- GitGuardian/Vercel/review threads: pending
- production route/Search/homepage/sitemap readback: pending
- production semantic/commercial readback: pending
- final broad P1 category-cleanup closeout: pending production verification

Database writes: **0**. Production configuration changes: **0**. SEO-20 and the PER4M frozen surface are unchanged. Energy Drinks remains deferred and was not implemented.
