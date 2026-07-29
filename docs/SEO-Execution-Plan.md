# SupplementScout SEO Execution Plan

**Status date:** 29 July 2026  
**Owner:** SupplementScout  
**Scope:** Organic search traffic, indexation, internal discovery, search landing
pages, structured data, measurement and authority building.  
**Parent authority:** `docs/SupplementScout-Operating-Plan-2026-07-15.md`

## 1. Purpose

This is the live execution ledger for SEO work. The Operating Plan remains the
overall project authority; this file is its detailed SEO workstream.

Every SEO task must start by reading:

1. the current checkpoint at the top of the Operating Plan;
2. this file, including the active task and completed evidence;
3. the relevant current Next.js documentation before changing framework code.

Every SEO task must end by updating this file with:

- the final status;
- the exact evidence;
- the production verification state;
- the next active task.

Do not restart a completed task unless production evidence shows a regression.

## 2. Status rules

| Status | Meaning |
|---|---|
| `PLANNED` | Approved roadmap item, not started. |
| `IN PROGRESS` | The single SEO implementation currently being worked on. |
| `CODE COMPLETE` | Code and local tests pass, but production is not yet verified. |
| `LIVE VERIFIED` | Deployed and checked on the public site or in Search Console. This is the only completed state. |
| `BLOCKED` | Cannot progress without a named external input or decision. |
| `DEFERRED` | Deliberately postponed with a recorded reason. |

Only one SEO implementation item may be `IN PROGRESS` at a time. Measurement,
content research and legitimate outreach may continue in parallel when they do
not change the same files or data.

## 3. Baseline audit

Read-only audit completed on 29 July 2026:

- 1,111 active, unmerged canonical products;
- 2,106 positive-price in-stock offers;
- 920 products with at least one such offer;
- 112 products with at least two in-stock retailers;
- public sitemap returned 1,011 URLs: 11 static URLs and exactly 1,000 product
  URLs;
- therefore 111 active product URLs were absent from the sitemap because the
  product query did not paginate beyond the Supabase 1,000-row response limit;
- 191 active products had no positive-price in-stock offer and require an
  explicit index-eligibility policy rather than automatic inclusion or removal;
- GA4 is present in production behind consent;
- DNS contains Google site verification, but Search Console performance,
  submitted-sitemap state and page-indexing reports have not yet been captured
  in this repository;
- public search results show indexed home, category and product pages, but the
  exact indexed total is unknown without Search Console;
- the cached Google home result observed during the audit still contained an
  older heading and zero-product/zero-retailer statistics;
- existing broad landing-page matching exposes irrelevant products on some
  category pages;
- product pages have canonical metadata and useful price data but no Product
  JSON-LD or breadcrumb trail;
- discoverable external authority/backlinks appear minimal; a dedicated
  backlink tool or Search Console Links export has not yet been captured.

This baseline is evidence, not a permanent target. Refresh the counts after
material catalogue growth and before each monthly SEO review.

## 4. Objectives

The order of objectives is:

1. make every approved indexable page technically discoverable;
2. prevent irrelevant or weak pages from diluting catalogue quality;
3. create strong internal paths from home to categories to products;
4. publish data-backed high-intent comparison pages;
5. earn external references and links to those useful resources;
6. improve organic impressions, clicks and retailer click-through without
   unsupported health or marketing claims.

No traffic or ranking number is guaranteed. Decisions must be driven by Search
Console evidence and user value.

## 5. Active execution ledger

| ID | Priority | Task | Status | Definition of done |
|---|---:|---|---|---|
| SEO-00 | P0 | Establish this controlled SEO ledger and bind it into the Operating Plan. | `LIVE VERIFIED` | Both documents cross-reference the process, the active task and the completion rule. |
| SEO-01 | P0 | Remove the 1,000-product sitemap truncation. | `LIVE VERIFIED` | Pagination is tested, build passes, production sitemap contains every product allowed by the current index policy, and no duplicate URL exists. |
| SEO-02A | P0 | Replace fabricated sitemap modification dates with truthful evidence. | `LIVE VERIFIED` | Product URLs use the latest valid product-creation or offer-check timestamp; static pages omit the field until they have a truthful source; production XML is verified. |
| SEO-02B | P0 | Define sitemap/index eligibility for products without a current offer. | `BLOCKED` | Written policy covers products with no current offer and representative URLs are evaluated in Search Console before any broad noindex action. Blocker: Search Console evidence has not been captured. |
| SEO-03 | P0 | Correct category landing-page relevance. | `LIVE VERIFIED` | Magnesium, Glucosamine, Vitamins, Vitamin D and Omega 3 use reviewed inclusion logic; irrelevant audit examples are absent; regression fixtures pass. |
| SEO-04 | P0 | Build crawlable category pagination and internal product links. | `CODE COMPLETE` | Indexable category pages expose stable anchor links to every eligible product, with canonical pagination and no indexable filter explosion. |
| SEO-05 | P1 | Server-render authoritative home statistics and freshness. | `PLANNED` | Initial HTML contains current approved counts and freshness; no loading or zero-value placeholder becomes the search snippet. |
| SEO-06 | P1 | Add product breadcrumbs and valid Product snippet structured data. | `PLANNED` | Markup matches visible canonical data, passes tests and Google validation, and never represents SupplementScout as the direct seller. |
| SEO-07 | P0 | Capture the Search Console baseline and submit/verify the sitemap. | `BLOCKED` | Owner/account access is used to record Performance, Page indexing, Sitemaps, Core Web Vitals and Links baselines; priority URLs are inspected. Blocker: no Search Console account/API access in the repository. |
| SEO-08 | P1 | Launch the Whey Protein comparison landing page. | `PLANNED` | Reviewed data-backed page covers current eligible products/offers, methodology, limitations, update time, internal links, analytics and Search Console inspection. |
| SEO-09 | P1 | Launch the Pre Workout comparison landing page. | `PLANNED` | Same quality contract as SEO-08; no unsupported formulation or medical claims. |
| SEO-10 | P1 | Publish comparison methodology and data-freshness pages. | `PLANNED` | Delivered-price, price-history, unit-value, source and limitation rules are publicly explained and linked from priority pages. |
| SEO-11 | P2 | Normalize brand identities before brand SEO pages. | `PLANNED` | Case/alias splits such as `PER4M` and `Per4m`, plus `Unknown`, are reviewed; only sufficiently covered brands receive indexable pages. |
| SEO-12 | P1 | Begin legitimate authority and backlink acquisition. | `PLANNED` | Priority retailer/brand/community outreach uses useful live resources; earned links and outcomes are recorded monthly; no bulk or paid-link scheme is used. |

## 6. Current active task

**Deployment verification pending:** SEO-04 — crawlable category pagination
and internal product links are locally complete.

**Immediately next after live verification:** SEO-05 — server-render
authoritative home statistics and freshness.

**Blocked evidence task:** SEO-02B — capture Search Console evidence before
changing index eligibility for products without a current offer.

The sequence may change only when new Search Console evidence proves a more
urgent indexing blocker. Record that evidence before changing priority.

## 7. Content rollout order

Current catalogue evidence supports this initial order:

| Page | Products with in-stock offer | In-stock offers | Products with 2+ retailers | State |
|---|---:|---:|---:|---|
| Creatine | 53 | 103 | 12 | Live; verify indexation and improve through the shared quality contract. |
| Whey Protein | 65 | 409 | 12 | First new high-intent landing page. |
| Pre Workout | 88 | 339 | 11 | Second new high-intent landing page. |
| Amino Acids / BCAA / EAA | 51 | 173 | 12 | Research taxonomy before page implementation. |
| Protein Bars | 43 | 118 | 6 | Follow after the first two pages and category-quality fixes. |
| Mass Gainer | 8 | 44 | 3 | Lower-volume page; publish only if query evidence supports it. |

New pages must reuse one controlled category/decision-page system. Do not create
one independent implementation per category.

## 8. Page quality contract

An indexable category or decision page requires:

- a stable canonical URL;
- a direct answer and clear purpose near the top;
- reviewed, relevant product inclusion;
- current offer and retailer coverage;
- delivered-price treatment and visible limitations;
- source/freshness explanation and last-updated evidence;
- stable anchor links to eligible product pages;
- useful headings based on real user decisions;
- server-rendered primary content;
- valid structured data appropriate to the page type;
- analytics and a Search Console inspection record;
- no unsupported health, dosage, safety or superiority claims;
- no thin text created only to target keyword variations.

## 9. Measurement cadence

### At every production SEO release

Record:

- commit and deployment;
- affected URLs;
- local test/build result;
- live HTTP, canonical, robots and structured-data checks;
- sitemap URL count and duplicate count;
- Search Console inspection state when account access is available.

### Weekly

Record from Search Console and GA4:

- organic impressions;
- organic clicks;
- click-through rate;
- average position;
- indexed and excluded page counts;
- top queries and landing pages;
- organic retailer-offer clicks;
- newly detected technical issues.

### Monthly

Review:

- pages gaining or losing impressions;
- query gaps worth a useful page;
- content that needs improvement or consolidation;
- products and categories with stronger multi-retailer coverage;
- earned external links and referring sites;
- competitor page types only as evidence, not as templates to copy.

## 10. Guardrails

- SEO work must not modify product identity, retailer mappings, prices or offer
  automation unless a separately approved data task requires it.
- Do not index internal search/filter combinations.
- Do not create mass programmatic pages before the page-quality contract is
  automated and proven on a small set.
- Do not publish medical advice or unsupported supplement claims.
- Do not mark a task complete without live evidence.
- Do not buy bulk links, use link farms or create misleading retailer/brand
  endorsements.
- Preserve the existing catalogue, merge, import and automation safety rules.

## 11. Execution evidence

### 29 July 2026 — SEO-00 and SEO-01 local implementation

- Added this controlled SEO execution ledger.
- Bound the ledger and completion rules into the current Operating Plan
  checkpoint.
- Added deterministic, ordered pagination to the active-product sitemap query.
- A page-query error fails closed and cannot publish a silently partial product
  list.
- Added regression coverage for the Supabase 1,000-row boundary.
- Updated the existing homepage-to-Creatine discovery test to match the current
  configuration-driven links; the public link contract itself was unchanged.
- `node --test scripts/sitemap-freshness.test.js scripts/creatine-page.test.js scripts/hydration-page.test.js`:
  40 passed, 0 failed.
- Targeted ESLint: passed.
- Next.js 16.2.9 production build and TypeScript: passed.
- State remains `CODE COMPLETE`/`IN PROGRESS` until commit, deployment and live
  sitemap count/duplicate verification are complete.

### 29 July 2026 — SEO-00 and SEO-01 live verification

- Commit `ebbf0f4` was pushed to `main`.
- Public `https://www.supplementscout.co.uk/sitemap.xml` changed from 1,011
  total URLs / 1,000 product URLs to 1,122 total URLs / 1,111 product URLs.
- All 1,122 public sitemap locations were unique.
- SEO-00 and SEO-01 are `LIVE VERIFIED`.

### 29 July 2026 — SEO-02A local implementation

- Removed the fabricated shared `2026-07-08` modification date.
- Product modification time now uses the newest valid value from canonical
  product creation and all mapped offer checks.
- Static and landing URLs omit `lastModified` until a truthful modification
  source is implemented; an omitted value is preferable to a false value.
- The paginated production-shaped query returned 1,000 products and 2,254
  related offers on its first page in approximately 727 ms during the read-only
  design check.
- SEO tests: 42 passed, 0 failed.
- Targeted ESLint, TypeScript and Next.js production build: passed.
- Local implementation reached `CODE COMPLETE`; live verification is recorded
  separately below.

### 29 July 2026 — SEO-02A deployment pending

- Commit `bb71196` was pushed to `main`.
- Repeated cache-bypassed public checks continued to return 1,122 unique URLs
  but still showed the previous shared `2026-07-08` date on every URL.
- The remote `main` ref was independently confirmed at `bb71196`.
- No live-completion claim is made. SEO-02A is `CODE COMPLETE` until the Vercel
  production alias serves the commit and the XML timestamp distribution is
  verified.

### 29 July 2026 — SEO-02A live verification

- The production alias now serves the truthful timestamp implementation.
- Public sitemap remained at 1,122 unique URLs and 1,111 product URLs.
- All 1,111 product URLs had evidence-backed `lastmod` values with 369 distinct
  timestamps; the newest observed timestamp was `2026-07-29T15:47:16.811Z`.
- All 11 static/landing URLs correctly omitted `lastmod` rather than publishing
  the previous fabricated shared date.
- SEO-02A is `LIVE VERIFIED`.

### 29 July 2026 — SEO-03 local implementation

- Added one shared reviewed relevance gate inside the existing
  `app/lib/products.ts` landing-product path; no second search service or
  category engine was created.
- Magnesium accepts explicit Magnesium, ZMA, ZMB and ZMPro identities.
- Glucosamine requires explicit Glucosamine identity.
- Vitamin D accepts explicit Vitamin D, D2 or D3 identity.
- Omega 3 accepts explicit Omega 3, fish oil, cod liver oil, krill oil and
  flaxseed oil identity while excluding evening primrose, starflower and
  pet/cat/dog products.
- Vitamins uses explicit vitamin/mineral identity and rejects products whose
  primary identity is Glucosamine, Omega, collagen, protein, amino acid,
  pre-workout, creatine, hydration or another reviewed category.
- Source queries were narrowed so rejected collagen, joint-care, starflower and
  evening-primrose candidates are not fetched unnecessarily.
- Current production-shaped qualifying counts were: Glucosamine 18, Magnesium
  23, Omega 3 22, Vitamin D 24 and Vitamins 115.
- Regression fixtures include the incorrect products observed in public search
  results and valid edge cases such as ZMA, D3 + K2 and flaxseed oil.
- Combined category/search/pricing and SEO route suites passed 128 tests with
  zero failures. The final focused suite passed 38 tests with zero failures.
- Targeted ESLint, TypeScript and the Next.js production build passed.
- Implementation commit: `76be160`.
- Production verification after deployment confirmed HTTP 200 and the expected
  canonical URL on all five reviewed landing pages.
- Valid examples remained visible while every controlled leak was absent:
  Magnesium had no Chewable Multivitamins or Chromium Complex; Glucosamine had
  no Vitamin C or Omega 3 capsules; Omega 3 had no Starflower, Evening Primrose
  or pet products; Vitamin D had no plain Cod Liver Oil; Vitamins had no
  Glucosamine-with-Vitamin-C or Omega 3 capsules.
- SEO-03 is `LIVE VERIFIED`.

### 29 July 2026 — SEO-04 local implementation

- Added one shared category-pagination URL and metadata policy for Glucosamine,
  Magnesium, Omega 3, Vitamin D and Vitamins.
- Page one keeps the clean category path. Further pages use stable
  `?page=N` links with their own canonical URL and page-specific title.
- `?page=1`, invalid, leading-zero, duplicate and unsafe page values cannot
  create separate indexable copies. Requests beyond the available range
  redirect to the last real page.
- Landing retrieval now walks every 1,000-row database batch before applying
  the reviewed relevance gate and slicing the requested 24-product page. This
  removes the previous future 1,000-row discovery ceiling.
- Every result is rendered in the initial server response through existing
  `ProductResultCard` anchors; no client-only load-more control was introduced.
- The production build, targeted ESLint and 95 category/pricing/search tests
  passed with zero failures.
- A local production-server check found five Vitamins pages containing 114
  distinct current products: 24 on pages 1–4 and 18 on page 5, with zero
  cross-page duplicates. Page 2 had its own canonical, page 1 exposed its link,
  and invalid/out-of-range requests redirected correctly.
- SEO-04 remains `CODE COMPLETE` until deployment and public verification.
