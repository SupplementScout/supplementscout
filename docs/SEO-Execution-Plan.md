# SupplementScout SEO Execution Plan

**Status date:** 20 August 2026<br>
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

Use the role handoff in `docs/Agent-Operating-Model.md`: Roadmap Steward,
Growth Analyst, SEO/Decision-Page Builder and Independent Release Verifier.
Role separation does not create a second ledger or grant production-data write
authority.

Run `npm run verify:project` before and after changing this ledger. Its
structural pass does not replace task-specific tests or public verification.

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
- DNS contains Google site verification, and Search Console performance plus
  submitted-sitemap state are captured by automation; full indexed/ excluded
  page totals remain unavailable via the current authenticated API path;
- public search results show indexed home, category and product pages, and the latest
  Search Console export captured 794 indexed vs 181 not indexed pages (last update
  24 July 2026);
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
| SEO-04 | P0 | Build crawlable category pagination and internal product links. | `LIVE VERIFIED` | Indexable category pages expose stable anchor links to every eligible product, with canonical pagination and no indexable filter explosion. |
| SEO-05 | P1 | Server-render authoritative home statistics and freshness. | `LIVE VERIFIED` | Initial HTML contains current approved counts and freshness; no loading or zero-value placeholder becomes the search snippet. |
| SEO-06 | P1 | Add product breadcrumbs and valid Product snippet structured data. | `LIVE VERIFIED` | Markup matches visible canonical data, passes automated and external structured-data validation, and never represents SupplementScout as the direct seller. |
| SEO-07 | P0 | Capture the baseline from the already-configured Search Console property and verify the submitted sitemap. | `LIVE VERIFIED` | Authenticated Performance, GA4, Sitemaps, Index Coverage, Core Web Vitals and Links evidence are recorded, including the latest baseline and manual coverage exports. |
| SEO-08 | P1 | Launch the Whey Protein comparison landing page. | `LIVE VERIFIED` | Reviewed data-backed page covers current eligible products/offers, methodology, limitations, update time, internal links, analytics and a Search Console inspection record when authenticated report access is available. |
| SEO-09 | P1 | Launch the Pre Workout comparison landing page. | `LIVE VERIFIED` | Same quality contract as SEO-08; no unsupported formulation or medical claims. |
| SEO-10 | P1 | Publish comparison methodology and data-freshness pages. | `LIVE VERIFIED` | Delivered-price, price-history, unit-value, source and limitation rules are publicly explained and linked from priority pages. |
| SEO-11 | P2 | Normalize brand identities before brand SEO pages. | `LIVE VERIFIED` | Case/alias splits such as `PER4M` and `Per4m`, plus `Unknown`, are reviewed; uncertain identities stay unchanged for owner review and only sufficiently covered brands may proceed to indexable pages. |
| SEO-12 | P1 | Begin legitimate authority and backlink acquisition. | `PLANNED` | Priority retailer/brand/community outreach uses useful live resources; earned links and outcomes are recorded monthly; no bulk or paid-link scheme is used. |
| SEO-13 | P1 | Deliver the controlled ten-page high-intent cluster. | `DEFERRED` | Owner-paused on 20 August 2026 until SEO-14 finishes; SEO-11 is complete. Retain all completed evidence, then recheck Protein Bars without repeating live pages or weakening the shared gate. |
| SEO-14 | P1 | Launch eligible brand and retailer landing pages. | `IN PROGRESS` | Identity normalization and minimum coverage/content gates are tested; only useful pages are indexable and every page uses current canonical data. |
| SEO-15 | P1 | Launch a data-backed deals and price-drops page. | `PLANNED` | Existing offers and price history power truthful current deals; discount, delivery, freshness and historical-comparison limitations are visible. |
| SEO-16 | P1 | Launch guarded two-product comparison. | `PLANNED` | Users can compare two canonical products using current variants, offers, delivered prices and verified metrics without fabricated missing values. |
| SEO-17 | P2 | Add owner-reviewed expert decision notes. | `PLANNED` | Expert judgement is clearly labelled and dated, verified facts retain provenance, and unsupported medical or formulation claims cannot publish. |

## 6. Current active task

**Next executable task:** SEO-14 — merge and deploy the owner-approved,
bounded `/retailers/ebay-uk` release candidate, then capture live HTTP,
canonical, robots, structured-data, sitemap, internal-link and desktop/mobile
evidence. The implementation uses only stored guarded eBay offers and current
cross-retailer comparison data; it does not create a dynamic retailer generator
or change catalogue/production data. Applied Nutrition, Per4m and BioTech USA
are live verified; GYM HIGH remains deferred from both brand- and retailer-page
publication.

**Blocked evidence task:** SEO-02B — capture Search Console evidence before
changing index eligibility for products without a current offer.

The sequence may change only when new Search Console evidence proves a more
urgent indexing blocker. Record that evidence before changing priority.

Follow the binding sequence in Operating Plan section 0.0.7: SEO-14, the
bounded SEO-13 Protein Bars recheck, the 250-product multi-retailer
checkpoint, SEO-15, SEO-16 and SEO-17.
SEO-07 measurement and SEO-12 legitimate authority work are continuous evidence
tracks, not permission to run a second implementation or send outreach email
while the owner's no-email decision remains in force.

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

The table below preserves SEO-13's reviewed cluster order and historical gate
contract. The owner paused further SEO-13 execution on 20 August 2026 until
SEO-14 finishes; SEO-11 is complete. When SEO-13 resumes, Protein Bars is rechecked first;
completed pages are not rebuilt and no gate is weakened.

| Order | Candidate page | Evidence gate before implementation |
|---:|---|---|
| 1 | Amino Acids / BCAA / EAA | Reviewed taxonomy separates genuine amino-acid products from unrelated names. |
| 2 | Protein Bars | Product/box pack identity and sufficient current offers are verified. |
| 3 | Whey Isolate | Inclusion rules separate isolate, blends and misleading retailer labels. |
| 4 | Vegan Protein | Protein source and current offer coverage support a useful comparison. |
| 5 | Mass Gainer | Search evidence and current multi-retailer depth justify an indexable page. |
| 6 | Electrolytes | Relevant hydration/electrolyte products pass reviewed inclusion rules. |
| 7 | Magnesium Glycinate | Form-specific identity is reliable and does not include unrelated magnesium forms. |
| 8 | Multivitamins | Taxonomy and serving/value data support a meaningful comparison. |
| 9 | Ashwagandha | Product identity is reliable and content avoids unsupported health claims. |
| 10 | Creatine Monohydrate | The page adds distinct decision value beyond the existing `/creatine` page and avoids keyword cannibalisation. |

The Growth Analyst records the gate evidence; the Builder implements only the
active eligible page; the Verifier checks it independently; the Roadmap Steward
then records `LIVE VERIFIED` and advances the order.

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
- indexed and excluded page counts (full aggregate totals remain outside current Search Console API coverage and still require UI/export evidence);
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

### Measurement evidence log

Add one row only from authenticated GSC/GA4 evidence. Do not use estimates or
invent a date to silence the Guardian.

| Date | Type | Evidence | State |
|---|---|---|---|
| 2026-08-17 | Weekly GSC/GA4 | Authenticated read-only workflow run `32014837584`, artifact `9283110120`, covering 2026-08-10 through 2026-08-16: GSC 736 impressions, 9 clicks, 1.22% CTR and average position 61.68; GA4 Organic Search 12 sessions, 4 users, 107 views and 3 organic retailer-offer clicks. Sitemap reported 1,090 submitted URLs with 0 warnings and 0 errors. URL Inspection completed 6/6 targets with 0 errors; the five canonical `www` URLs were submitted and indexed, while the apex hostname correctly resolved as a redirect to the indexed `www` homepage. | `CAPTURED` |
| 2026-08-10 | Weekly GSC/GA4 | Authenticated read-only workflow run `31377198053`, artifact `9058392768`, covering 2026-08-03 through 2026-08-09: GSC 582 impressions, 3 clicks, 0.52% CTR and average position 61.03; GA4 Organic Search 4 sessions, 3 users, 2 views and 2 organic retailer-offer clicks. Sitemap reported 1,089 submitted URLs with 0 warnings and 0 errors. URL Inspection completed 6/6 targets with 0 errors; the five canonical `www` URLs were submitted and indexed, while the apex hostname correctly resolved as a redirect to the indexed `www` homepage. | `CAPTURED` |
| 2026-08-03 | Weekly GSC/GA4 | Authenticated read-only workflow run `30812538721`, covering 2026-07-27 through 2026-08-02: GSC 772 impressions, 1 click, 0.13% CTR and average position 59.56; GA4 43 total sessions, 3 users and 486 views (Direct), and 0 organic sessions with 0 organic retailer-offer clicks; sitemap 1,088 submitted URLs, 0 warnings and 0 errors. | `CAPTURED PARTIAL`; SEO-07 remains blocked on aggregate indexed/excluded totals, Core Web Vitals and Links evidence. |
| 2026-08-06 | Search Console manual export | Coverage export (updated 2026-07-24): 794 indexed pages, 181 not indexed pages. Major exclusion reasons: 27 noindex, 6 404, 5 robots.txt blocked, 4 redirect, 1 alternate canonical, 133 discovered not indexed, 5 crawled not indexed. | `CAPTURED PARTIAL`; SEO-07 remains blocked on Core Web Vitals and Links evidence. |
| 2026-08-04 | Search Console manual export | Core Web Vitals: last 90 days shows “Not enough usage data in the last 90 days” for device types; use PageSpeed Insights for page-level diagnostics. Links: External total 0 with no external top linked pages/sites/text; Internal total 25 with top linked pages `/affiliate-disclosure` (9), `/contact` (4), `/glucosamine` (2), `/magnesium` (2), `/omega-3` (2), `/privacy` (2), `/vitamin-d` (2), `/cookies` (1), `/vitamins` (1). | `CAPTURED` |
| 2026-08-01 | Weekly GSC/GA4 | Authenticated read-only workflow run `30702954910`, artifact `8819405398`, covering 2026-07-25 through 2026-07-31: GSC 559 impressions, 0 clicks, 0% CTR and average position 58.21; GA4 0 Organic Search sessions and 0 organic retailer-offer clicks; sitemap 1,120 submitted URLs, 0 warnings and 0 errors. The sitemap API's `indexed: 0` is not accepted as the Page indexing total because GSC already records impressions. | `CAPTURED PARTIAL`; SEO-07 remains blocked on aggregate indexed totals, Core Web Vitals and Links evidence. |

### SEO-07 manual evidence queue

SEO-07 manual evidence queue is now complete:

- [x] Search Console **Index Coverage**: total indexed/excluded pages and major exclusion reasons for the last 28 days.
- [x] Search Console **Core Web Vitals**: aggregate trend/state and top affected URLs where available.
- [x] Search Console **Links**: top internal/external linking pages and major new domains.

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

### 20 August 2026 — SEO-14 eBay UK retailer page CODE COMPLETE; live evidence pending

- The owner approved completing the exact bounded `/retailers/ebay-uk` unit,
  including its normal review, merge, deployment and live-verification flow.
- The release candidate first queries qualifying offer candidates for exact
  retailer ID `12`, fails closed on query errors or truncation, then loads only
  those active, unmerged canonical products with their current offers. Shared
  offer normalization enforces mapped, in-stock, positive-price, valid-URL and
  24-hour freshness rules. There are no catalogue or production-data writes.
- Current production-backed local rendering contains `69` products, `100`
  tracked eBay UK offers and `348` recently checked offers across `5` retailers;
  `65` products have a current alternative. The scope spans `10` categories,
  `26` brands and images on all `69` products.
- Comparable products appear first. Each visual product card places the best
  tracked eBay offer beside the best current non-eBay alternative, labels
  unknown delivery instead of treating it as free and links to the canonical
  product comparison. The page prominently states that eBay is a marketplace,
  represents only a guarded tracked subset and does not score or endorse
  sellers or products.
- The explicit route has fail-closed metadata, one canonical, index/follow only
  while the translated `20 / 10 / 3 / 50 / 5` gate and structured data pass,
  `CollectionPage`/`ItemList`/`BreadcrumbList` JSON-LD, one sitemap entry,
  homepage discovery, eBay-offer product links and consent-aware analytics. No
  generic retailer route or generator was added.
- Focused contract tests pass `8/8`; TypeScript and targeted ESLint pass.
  `npm run verify:quick` and `npm run verify:full` pass with `274` sealed tests,
  `230` safe tests, baseline migration validation and the Next.js 16.2.9 build
  including `/retailers/ebay-uk`. The actual production-backed build also
  passes and renders the current counts above.
- Desktop inspection passes. A true `390` CSS-pixel mobile emulation reports
  document and body `clientWidth = scrollWidth = 390` with no overflowing
  element. Earlier window-only captures were diagnosed as Chrome's 500-pixel
  minimum headless viewport being cropped to a 390-pixel bitmap, not page
  overflow.
- State is `CODE COMPLETE`, not `LIVE VERIFIED`. SEO-14 remains `IN PROGRESS`.

### 20 August 2026 — SEO-14 retailer-page audit selects eBay UK; owner review required

- A fresh production read-only audit captured at `2026-08-20T17:01:59.747Z`
  performed zero production writes. It reviewed `1,070` active canonical
  products, all `10` retailer rows and `1,802` qualifying in-stock offers under
  the shared 24-hour freshness, positive-price, mapped-offer and valid-URL
  boundary.
- Because the repository had no established retailer-page gate, the audit used
  a provisional, fail-closed translation of the existing `20 / 10 / 3 / 50 / 5`
  contract: visible retailer products, products also available from another
  retailer, retailers represented across those comparisons, fresh offers on
  the visible product set and visible categories. Passing a numerical gate is
  evidence for review, not automatic publication authority.
- Whey Okay, eBay UK, 6 Pack Supplements, Fit House and Jon's Supplements
  passed numerically. GYM HIGH also passed but remains excluded by the owner's
  existing privacy/association decision. Discount Supplements, Dolphin Fitness,
  Simply Supplements and KIOR Health failed one or more comparison or breadth
  gates; Simply Supplements had `115` visible products but zero cross-retailer
  comparisons.
- eBay UK has the strongest comparison density and is the selected bounded
  candidate: `69` visible products, `100` target-retailer offers, `65`
  comparable products, `5` retailers across those comparisons, `348` fresh
  offers on the visible product set, `10` categories, `26` brands and images on
  all `69` products. The Retailer Data Source Registry independently records
  that the exact `100` eBay offers are approved, guarded and refreshed, with
  eBay creating the second retailer for `58` products and a third-or-later
  retailer for `10`.
- User value must be cross-retailer price comparison, not a thin eBay catalogue:
  show the current eBay offer beside the best known alternative, rank genuinely
  comparable products first, disclose that eBay is a marketplace and preserve
  the normal affiliate/freshness limitations. The page must use only stored,
  approved offers; it must not browse arbitrary listings, imply seller or
  product endorsement, or make unsupported seller-quality claims.
- Demand evidence is not overstated. The latest available seven-day Search
  Console query export contained only one impression each for two other
  retailer-name queries and none for eBay UK or Whey Okay. The outbound table
  contained `33` eBay requests in the last 30 days, but `11` were classified as
  likely automated and `22` remained unknown; zero may be represented as proven
  human demand. External results show eBay's supplement inventory is far larger
  than the guarded SupplementScout subset, reinforcing the need to describe
  exact tracked offers rather than claim complete marketplace coverage.
- Reuse is feasible through the current server-rendered comparison cards,
  delivered-price/freshness rules, product imagery, canonical metadata,
  `CollectionPage`/`ItemList`/`BreadcrumbList` schema, sitemap and analytics.
  No retailer route currently exists, so any approved implementation must be
  one explicit `/retailers/ebay-uk` page with a fail-closed gate, not a generic
  route or retailer-page system.
- State is `AUDIT PASSED`; `/retailers/ebay-uk` requires explicit owner approval
  before implementation. SEO-14 remains `IN PROGRESS`.

### 20 August 2026 — SEO-14 BioTech USA brand page LIVE VERIFIED

- The owner approved exactly one bounded `/brands/biotech-usa` implementation
  after the fresh coverage and official-source audit in merged PR #23.
- The release candidate reuses the existing exact-brand query, coverage-first
  ordering, shared 24-hour offer rules, product imagery, dated offer badge,
  fail-closed `20 / 10 / 3 / 50 / 5` gate, canonical metadata,
  `CollectionPage`/`ItemList`/`BreadcrumbList` schema, sitemap, bounded
  homepage/product links and consent-aware analytics.
- All eleven audited category exceptions are bound to exact product IDs and
  tested as page-local display rules. Every other product retains its catalogue
  category. There are no catalogue or production-data writes and no dynamic
  brand route.
- Fresh read-only production evidence remains `40` visible products from `49`
  scoped products, `109` fresh offers, `11` multi-retailer products, `3`
  comparison retailers and images on all `40` visible products.
- Local evidence passes the BioTech USA contract (`9/9`), TypeScript,
  `npm run verify:quick` and `npm run verify:full`: `273` sealed tests, `229`
  safe tests, baseline migration validation and the Next.js 16.2.9 production
  build including `/brands/biotech-usa`.
- Owner-approved PR #24 was squash-merged as production commit `18f80241`.
  Vercel reported a successful production deployment, and the post-merge
  `full` and `verify-project-control` checks passed; the isolated integration
  job remained intentionally skipped.
- Public `/brands/biotech-usa` returned HTTP 200 with its exact canonical,
  `index, follow`, and `CollectionPage`, `ItemList` and `BreadcrumbList`
  structured data. It visibly reported the shared 24-hour freshness rule and
  rendered `40` products, `109` recently checked offers from `4` retailers and
  `11` products with offers from multiple retailers.
- The eleven bounded exceptions produced the intended page-only display groups
  within `15` rendered groups. The public sitemap contained the route exactly
  once, and the checked BioTech USA product page linked back to the brand page.
- Desktop and mobile captures exposed the intended content and product imagery.
  Mobile reproduced the shared horizontal overflow already present on the live
  Applied Nutrition and Per4m controls, so it is recorded as a common-layout
  limitation rather than a BioTech USA regression.
- This bounded unit is `LIVE VERIFIED`; SEO-14 remains `IN PROGRESS` while the
  next retailer-page feasibility audit is performed.

### 20 August 2026 — SEO-14 fresh next-candidate audit selects BioTech USA; implementation approved

- A fresh production read-only brand audit captured at
  `2026-08-20T15:39:36.737Z` performed zero production writes and reapplied the
  exact active/unmerged identity boundary, shared 24-hour freshness rule and
  unchanged `20 / 10 / 3 / 50 / 5` brand gate after Applied Nutrition and
  Per4m were live verified and GYM HIGH remained owner-deferred.
- BioTech USA is the only remaining brand to pass every gate: `40` visible
  products from `49` scoped products, `109` fresh offers, `11` products with
  multiple fresh retailers, `3` retailers across comparisons and `11` source
  categories. All `40` visible products have images. The fresh eligible offers
  span 6 Pack Supplements, eBay UK, Fit House and Whey Okay, while three of
  those retailers overlap on multi-retailer comparisons.
- The official [BioTechUSA category index](https://shop.biotechusa.com/collections)
  and product/range pages confirm that the current internal categories must not
  be copied literally for eleven visible products. A bounded page may group the
  four Iso Whey Zero sizes as `Whey Isolate`, product `71` as `Plant Protein`,
  product `67` as `Casein Protein`, products `1119` and `1082` as `Food &
  Snacks`, product `1099` as `Food & Baking Mixes`, product `402` as `Natural
  Plant Extracts` and product `365` as `Amino Acids`.
- These are page-local presentation rules backed by official sources, not
  catalogue corrections. The page must remain independent, omit unsupported
  manufacturer claims and reuse the exact-brand fail-closed mechanism. No
  retailer-page mechanism with a comparable proven contract exists in the
  repository, so BioTech USA is the single selected next candidate.
- State is `AUDIT PASSED`; the bounded implementation was subsequently
  owner-approved and is recorded above. SEO-14 remains `IN PROGRESS`.

### 20 August 2026 — SEO-14 Per4m brand page LIVE VERIFIED

- The owner approved one bounded `/brands/per4m` implementation after the
  alternative-brand audit and the merge of documentation closeout PR #20.
- The release candidate reuses the Applied Nutrition exact-brand query,
  coverage-first ordering, current 24-hour offer rules, product imagery, dated
  offer badge, fail-closed `20 / 10 / 3 / 50 / 5` indexability gate, canonical
  metadata, `CollectionPage`/`ItemList`/`BreadcrumbList` schema, sitemap,
  bounded homepage/product links and consent-aware analytics.
- Scope remains exact canonical brand `Per4m`. The only display exceptions are
  `Whey Isolate` for product `328` and `Plant Protein` for product `1010`;
  automated tests prove the exceptions do not alter other product groupings.
  There are no catalogue or production-data writes and no dynamic brand route.
- Fresh production read-only evidence captured at `2026-08-20T14:57:06.146Z`
  passed at `33` visible products, `177` fresh offers, `12` multi-retailer
  products, `5` comparison retailers and `7` source categories, with images on
  all `33` visible products. The page-local display rules produce the two
  official-source-backed groupings without weakening the numerical gate.
- Local evidence passes the Per4m contract tests (`9/9`), the paired Applied
  Nutrition/Per4m regression tests (`17/17`), `npm run verify:quick` and
  `npm run verify:full`: `272` sealed tests, `228` safe tests, baseline
  migration validation and the Next.js 16.2.9 production build including
  `/brands/per4m`. A local live-data HTTP render timed out and is not counted as
  evidence; live-route verification remains required after deployment.
- Owner-approved PR #21 was squash-merged to `main` as production commit
  `bc4f4864`. Vercel production deployment and the post-merge `full` and
  `verify-project-control` checks succeeded.
- Public `/brands/per4m` returned HTTP `200` with the exact canonical,
  `index, follow`, valid `CollectionPage`/`ItemList`/`BreadcrumbList` markup,
  `33` products, `177` fresh offers, `5` retailers, `12` multi-retailer
  products and `9` page display groups. The sitemap contains exactly one route
  entry and product `per4m-isolate-zero-900g` links back to the brand page.
- Desktop and mobile captures exposed the intended content and product imagery.
  The mobile capture also reproduced an existing shared horizontal overflow on
  the live Applied Nutrition control page, so it is recorded as a common-layout
  limitation rather than a Per4m regression.
- This bounded unit is `LIVE VERIFIED`; SEO-14 remains `IN PROGRESS`.

### 20 August 2026 — SEO-14 alternative brand audit selects Per4m; implementation approved

- A production read-only ranking applied the exact active/unmerged brand
  boundary, shared 24-hour freshness rule and unchanged `20 / 10 / 3 / 50 / 5`
  brand-page gate to every canonical brand except the live Applied Nutrition
  page and owner-deferred GYM HIGH. It performed zero production writes.
- Only Per4m and BioTech USA passed every numerical and structured-data gate.
  Per4m is the stronger first candidate at `33` visible products, `177` fresh
  offers, `12` multi-retailer products, `5` comparison retailers and `7`
  categories; all `33` visible products have images. BioTech USA passed at
  `40 / 109 / 11 / 3 / 11` but has weaker retailer depth and more visible
  taxonomy/content anomalies.
- SEO-11 already normalized all `PER4M` product-brand aliases to the exact
  canonical value `Per4m`, leaving `33` active canonical products and no source
  alias split. Product names may retain the official uppercase styling without
  changing their canonical brand identity.
- The [official Per4m catalogue](https://per4mbetter.com/collections/all)
  provides a current first-party source and supports the breadth of the range.
  Two internal category labels must not be repeated literally on the page:
  product `328`, `Per4m Isolate Zero 900g`, is confirmed by the
  [official whey-isolate collection](https://per4mbetter.com/collections/isolate-zero),
  while product `1010`, `PER4M Plant Advanced Vegan Protein 900g`, belongs to
  the [official plant-protein range](https://per4mbetter.com/collections/plant-protein).
- A safe `/brands/per4m` implementation may use exact page-local display groups
  `Whey Isolate` for product `328` and `Plant Protein` for product `1010`.
  These are content-presentation exceptions backed by first-party evidence,
  not catalogue writes or authority to infer other product categories. The page
  was subsequently owner-approved and implemented in the bounded release
  candidate recorded above.

### 20 August 2026 — SEO-14 GYM HIGH brand gate PASSED; publication DEFERRED

- A production read-only audit applied the exact canonical brand `GYM HIGH`,
  active/unmerged product boundary, shared 24-hour offer rules and the unchanged
  Applied Nutrition brand-page gate. It performed zero production writes.
- Current eligible coverage is `23` visible products, `88` fresh offers, `14`
  products with multiple fresh retailers, `4` retailers across comparisons and
  `8` visible categories. All `23` visible rows have images, product slugs are
  valid and the structured-data boundary passes. This exceeds every unchanged
  gate: `20 / 10 / 3 / 50 / 5`.
- The existing official-source catalogue audit also passed read-only with `26`
  parent products and `71` source variants. Its identity fingerprint
  `abd419fcd0400df086b666110b66a187c5f81747c26ea46ba80ad5cb5a301552`
  exactly matches the normalized baseline; four gift-card rows remain excluded.
- One active canonical product, `GYM HIGH Slimming Protein 1000g` (`id 185`),
  still uses the noncanonical brand spelling `GYMHiGH`. It is absent from the
  current official-source catalogue and has zero fresh offers. The proposed
  exact-brand page must exclude it; this SEO audit does not authorise an
  identity correction.
- Although the numerical gate passed, the owner explicitly deferred public
  publication to preserve SupplementScout's independent positioning and avoid
  an unwanted brand association. No `/brands/gym-high` page, link, sitemap
  entry, metadata or implementation is authorised. SEO-14 must select a
  different brand or retailer candidate through a fresh read-only audit.

### 20 August 2026 — SEO-14 comparison presentation and 24-hour freshness LIVE VERIFIED

- The owner directed all current comparison landing pages to use the visual
  language proven on Creatine: compact product imagery, concise commercial
  information and a prominent dated offer-check status instead of text-heavy
  cards. One shared `ComparisonProductVisuals` component now supplies safe
  product thumbnails and the red `Offer checked` badge across Whey Protein,
  Pre Workout, Amino Acids, Hydration, Whey Isolate, Vegan Protein, Mass Gainer,
  Multivitamins and Applied Nutrition; Creatine reuses the same badge alongside
  its existing product thumbnails.
- The shared public current-offer gate changed from 24 days to exactly 24 hours.
  Product/search fallbacks, comparison explanations and `/data-freshness` use
  the same wording and constant; this is a real eligibility change, not a copy-
  only claim.
- A read-only production-data rehearsal through the local application found no
  loss of current index eligibility on the ten comparison routes. Representative
  24-hour coverage remained Creatine `57 / 91 / 8`, Pre Workout `78 / 316 / 6`,
  Whey Protein `38 / 281 / 6`, Applied Nutrition `44 / 199 / 5`, and all other
  audited comparison routes also retained `index, follow`.
- Desktop review of Pre Workout and Applied Nutrition confirmed product images,
  compact cards, prices and dated red badges. The nine card-based routes had an
  image for every rendered product in the read-only rehearsal; the safe `No
  image` fallback remains for incomplete catalogue rows.
- Focused comparison/freshness tests, scoped TypeScript/ESLint checks,
  `npm run verify:quick` and `npm run verify:full` passed. Owner-approved PR
  #19 shipped as production commit `832e3dfe`; its Vercel production status is
  successful. Public checks returned HTTP 200 with `index, follow` for Pre
  Workout, Applied Nutrition, Creatine and Data Freshness. Pre Workout and
  Applied Nutrition rendered product images and dated red `Offer checked`
  badges with no visible `No image` fallback, and production desktop review
  confirmed the intended compact card layout. Public freshness copy uses
  `24 hours` and no longer contains `24 days`. SEO-14 remains `IN PROGRESS`.

### 20 August 2026 — SEO-14 Applied Nutrition brand page LIVE VERIFIED

- Owner-approved PR #17 merged as production commit
  `b7fae9704e49dbce783e94093a929f3e69b79430`; its Vercel deployment completed
  successfully and the public `/brands/applied-nutrition` route returned HTTP
  200.
- A fresh pre-implementation production audit found 56 active, unmerged
  exact-brand products. The page's current 24-day offer gate exposed 44 products,
  199 recently checked offers from five retailers and 23 products with offers
  from multiple retailers across ten category groupings.
- The live page has an indexable `index, follow` policy, an absolute canonical,
  visible freshness/methodology/limitation copy and independent-comparison
  disclosure. It uses `CollectionPage`, `ItemList` and `BreadcrumbList` JSON-LD
  without fabricated `Product`, seller, rating or medical-claim data.
- The canonical route occurs exactly once in the live sitemap. The production
  homepage links to it, and an exact-brand product page links back to it. The
  existing consent-aware analytics path records source
  `applied_nutrition_brand`.
- Eight focused contract tests, TypeScript, ESLint, Project Guardian,
  `npm run verify:quick`, `npm run verify:full`, the Next.js production build
  and PR CI run `32374522830` passed. Only this explicit page was added; no
  dynamic brand slug or mass page generator exists.
- This is the first completed unit inside SEO-14, not completion of SEO-14.
  SEO-14 remains the single `IN PROGRESS` implementation and the next action is
  a fresh GYM HIGH eligibility audit before any second page is built.

### 20 August 2026 — SEO-11 brand normalization LIVE VERIFIED

- Owner-approved production migration
  `20260820140000_normalize_reviewed_brand_aliases` applied from merged PR #15
  through the database-owner path after a successful rollback-only rehearsal.
- The exact 40 non-canonical case forms changed to `Per4m`, `NOW Foods`,
  `OstroVit` and `Activlab`. Production postflight found zero remaining source
  aliases and canonical totals of `33 / 20 / 10 / 2`.
- All 19 literal `Unknown` products remained unchanged. The nine strong
  candidates and ten insufficient or ambiguous identities remain separated in
  `docs/Brand-Normalization-Review-2026-08-20.md`; no product merge, create,
  variant, mapping, offer or price-history mutation was authorised.
- Protected production table counts were unchanged at 1,112 products, 2,641
  variants, 2,624 retailer mappings, 2,624 offers and 2,803 price-history rows.
  The production migration ledger advanced exactly once to 126 entries with
  fingerprint `cd6ce83450ee7030e0bae5eb4eda62349feaca1973b8017e56d077f54f4ebbf5`.
- Focused tests, `npm run verify:quick`, `npm run verify:full`, the Next.js build,
  Project Guardian and PR CI passed. SEO-11 is therefore `LIVE VERIFIED`, and
  SEO-14 is the single active implementation.

### 20 August 2026 — owner-approved SEO execution reorder

- The owner explicitly reordered the growth sequence to SEO-11, SEO-14, a
  fresh SEO-13 Protein Bars review, the 250-product multi-retailer checkpoint,
  then the ordered deals, two-product comparison and expert-note features.
- SEO-11 is now the single `IN PROGRESS` implementation. SEO-13 is deliberately
  paused with all live and deferred evidence preserved; completed pages must
  not be repeated and the Protein Bars `3 / 2 / 20` quality gate remains
  unchanged.
- The current read-only production checkpoint is 1,070 active products, 2,087
  public offers and 10 active retailers. Of those products, 169 have at least
  two retailers, leaving 81 to the next checkpoint of 250.
- This status reconciliation changes plans only. It authorises no catalogue,
  offer, retailer-mapping or production-data write.

### 17 August 2026 - exact product-to-comparison internal links live verification

- A duplicate-mechanism audit confirmed that the homepage already held the 14
  approved comparison-category routes, while product pages exposed only the
  existing `SupplementScout / Product` breadcrumb. No product-to-comparison
  category helper or equivalent middle breadcrumb already existed.
- Commit `c8898a9` moved the existing approved homepage routes into one shared
  module and reused that same source on product pages. A comparison link is
  added only when the stored product category is an exact, case-insensitive
  match; broader or unknown categories keep the prior two-level breadcrumb.
  No product-name inference, second route map or new page framework was added.
- The visible product breadcrumb and `BreadcrumbList` JSON-LD now agree on
  `SupplementScout / comparison category / product` for exact matches. Unsafe
  or external category paths are rejected. Product metadata, H1, canonical,
  offer ordering, prices, freshness rules and catalogue data were unchanged.
- Focused tests passed 41/41 before the compatibility adjustment and the
  existing Vegan Protein suite passed 8/8 afterward. TypeScript, targeted
  ESLint, `verify:quick`, `verify:full`, all 269 registered-test inventory
  checks and the Next.js production build passed.
- Live HTML returned HTTP 200 for `PER4M Micronised Creatine 150g` and
  `BioTech USA 100% Pure Whey 454g`, with exact canonical URLs, unchanged
  product titles/H1s, visible `/creatine` and `/whey-protein` breadcrumbs and
  matching category entries in JSON-LD. `Trained By JP Collagen Powder 300g`
  returned HTTP 200 with its exact canonical and unchanged title/H1, and
  correctly retained no comparison-category link or category schema entry.
  This internal-link reinforcement is `LIVE VERIFIED`; SEO-13 remains
  `IN PROGRESS`.

### 17 August 2026 - SEO-13 Whey Protein price-query reinforcement live verification

- The schema-v2 authenticated GSC artifact for 10-16 August recorded
  `whey protein price` at 10 impressions, zero clicks and average position
  37.10 for `/whey-protein`. Four adjacent price-comparison queries added one
  impression each at average positions 40-47.
- The page already used the exact title and H1
  `Compare Whey Protein Prices UK`, so commit `baed49f` preserved those terms,
  the description, URL, canonical, dynamic robots gate, structured data,
  coverage-first ranking and current-offer filter. Exact metadata regression
  assertions were added.
- One server-rendered quick answer now scans the existing freshness-filtered
  rows for the lowest known delivered total across the comparison. It links to
  the canonical product page and limits the statement to current
  SupplementScout retailer coverage rather than claiming the whole UK market.
- The focused Whey Protein suite passed 13/13; targeted ESLint, TypeScript,
  `verify:full` and the Next.js production build passed. Cache-bypassed live
  HTML returned HTTP 200 with the preserved title, H1, canonical and
  index/follow state. It rendered 39 current products and GBP 19.98 for
  `BioTech USA 100% Pure Whey 454g` as the lowest known delivered price, with
  the scope limitation present. This reinforcement is `LIVE VERIFIED`;
  `/whey-protein` is frozen until later GSC comparison and SEO-13 remains
  `IN PROGRESS`.

### 17 August 2026 - SEO-13 Magnesium query-alignment live verification

- The weekly report mechanism was expanded in commit `dd89312` without changing
  its Google read-only scopes, GitHub permissions or protected environment. It
  now retains up to 100 pages, 100 queries and 250 page-query rows, and derives
  a zero-click opportunity queue. Protected workflow run `32025282683` passed;
  private artifact `9286849927` contains schema-v2 evidence for 96 pages, 100
  queries and 176 page-query rows for 10-16 August.
- The detailed evidence identified `/magnesium` as the largest unaddressed
  landing-page cluster: `magnesium tablets` had 43 impressions at position
  72.53, `magnesium supplements` 30 at 84.40 and `magnesium supplement` 25 at
  82.48, all with zero clicks. Search Console privacy thresholds mean the
  page-query rows are directional and need not sum to site totals.
- Commit `aeef872` aligned the page title, description and single H1 with both
  observed intents: tablets and supplements. The `/magnesium` URL, canonical,
  index/follow policy, reviewed relevance filter, pagination, product cards,
  prices and catalogue reads were unchanged.
- The focused landing suite passed 17/17; targeted ESLint, TypeScript,
  `verify:full` and the Next.js production build passed. Cache-bypassed live
  HTML returned HTTP 200 with the exact new title, description and H1, the
  unchanged canonical and index/follow state, and crawlable product links.
  This query alignment is `LIVE VERIFIED`; `/magnesium` is frozen until later
  GSC comparison and SEO-13 remains `IN PROGRESS`.

### 17 August 2026 - SEO-13 Creatine no-click price reinforcement live verification

- The authenticated GSC report for 10-16 August recorded 36 impressions, zero
  clicks and average position 70.56 for `/creatine`. This was the next largest
  no-click comparison page visible in the report after the already reinforced
  `/glucosamine` page.
- The existing title `Compare Creatine Supplements & Prices UK`, description,
  H1 `Compare Creatine Supplements UK`, canonical, robots policy, structured
  data and comparison table were preserved. Exact regression assertions now
  protect the title and description rather than permitting a broad match.
- Commit `34ecd9d` added one server-rendered quick answer using the already
  sorted, freshness-filtered comparison data. It reports the current product
  count, the lowest known delivered total and a direct canonical product link,
  while explicitly limiting the statement to SupplementScout's current
  retailer coverage.
- The focused Creatine suite passed 24/24. Targeted ESLint, TypeScript,
  `verify:quick`, `verify:full` and the Next.js production build passed.
- Cache-bypassed live HTML returned HTTP 200 with the preserved title, H1,
  canonical and index/follow state. It rendered 57 active creatine products
  and the lowest known delivered price of GBP 11.98 for
  `PER4M Micronised Creatine 150g`, linked to its canonical product page.
  The scope limitation was present. This reinforcement is `LIVE VERIFIED`;
  the page is frozen until a later GSC comparison is available and SEO-13
  remains `IN PROGRESS`.

### 17 August 2026 - SEO-13 outbound measurement integrity live verification

- Investigation of the admin report found 59 raw redirect requests between
  08:40 and 10:34 UTC, including repeated same-offer triplets seconds apart.
  Because the legacy table stored no client or navigation diagnostics, those
  requests are not presented as proven shoppers and were not deleted.
- Commit `c3e2f33` keeps the raw request total while adding privacy-limited
  `likely_human`, `likely_automated` and `unknown` reporting. Classification
  uses only coarse browser family, referrer class and navigation context; raw
  IP addresses, full user-agent strings and full referrers are not stored.
  Historical records remain `unknown / legacy_unclassified` rather than being
  backfilled with an unsupported conclusion.
- The schema migration passed staging rehearsal/apply and production
  rehearsal/apply. Production migration ledger 115 is bound to fingerprint
  `4afae6d2489727b56f9c69cb022890d080f764c8973a62685af4200fa25b013e`
  with no pending migrations. Catalogue counts remained unchanged at 1,112
  products, 2,641 variants, 2,544 retailer products, 2,544 offers and 2,704
  price-history rows.
- The final quality gate passed with 269 registered tests and a successful
  Next.js production build. Public `/privacy` served the new disclosure. A
  live `HEAD /go/2232` returned HTTP 204, no redirect and
  `X-Robots-Tag: noindex, nofollow, noarchive`; the production outbound-click
  count remained exactly 1,705 before and after the request.
- Measurement hardening is `LIVE VERIFIED`. It does not change page metadata,
  catalogue identity, ranking content or retailer destinations. SEO-13 remains
  `IN PROGRESS`, and future traffic decisions should use classified counts
  alongside GSC and GA4 rather than treating every raw redirect as a person.

### 17 August 2026 — SEO-13 Glucosamine no-click reinforcement live verification

- The fresh authenticated weekly report for 10–16 August recorded 90
  impressions, zero clicks and average position 68.94 for `/glucosamine`, the
  largest no-click landing page in the report's current top-ten page sample.
- The report does not include page-query pairs, so the existing title, H1,
  description, canonical, relevance gate and crawlable pagination were
  preserved rather than guessing which ranking terms to rewrite.
- The first page now adds one dynamic quick answer using the already sorted
  landing results: current matching-product count, lowest known delivered
  price and its canonical product link. The copy limits the claim to current
  SupplementScout retailer coverage and tells shoppers to confirm changing
  price and stock before buying.
- The focused category landing suite passed 16/16; targeted ESLint, TypeScript,
  `git diff --check`, `verify:quick` and `verify:full` all passed. Commit
  `2ecc328` was pushed to `main`.
- A cache-bypassed public read returned HTTP 200 and the exact preserved title,
  description, H1 and canonical. The route retained ordinary index/follow
  behaviour, rendered 18 matching products and answered with GBP 4.98 for
  `Glucosamine Sulphate 500mg`; the retailer-coverage limitation and existing
  comparison results were present. This reinforcement is `LIVE VERIFIED`;
  measurement now freezes the page until a later GSC comparison is available.

### 17 August 2026 — approved Whey Okay freshness preflight repaired

- A fresh protected production dry-run initially failed before classification
  because approved source identity `509:509` still referenced canonical product
  `84` / variant `53`. Existing guarded merge code, the current production
  mapping and GTIN evidence all prove that mapping `151` and offer `88` were
  intentionally moved to canonical product `1040` / variant `2176`.
- Commit `2b4016b` resealed only that reviewed manifest identity and its SHA,
  retained the unchanged staging binding and added a regression test. The
  focused suite passed 21/21; `verify:quick` and `verify:full` both passed.
- The follow-up read-only production dry-run passed all 586 environment-binding
  checks and source health. It then failed closed at `MASS_OOS`: six variants
  from the single `Ghost 100% Whey Protein 907g` family changed from in stock to
  OOS at an unchanged GBP 39.87. Zero database writes and zero approvals were
  performed.
- The owner explicitly approved only those six Ghost stock transitions. Commit
  `d422910` added a SHA-bound production-only selector and tests that reject a
  seventh row, a different selector, staging use, source drift or any attempt
  to bypass `MASS_CHANGE` / `MASS_PRICE`; the generic OOS limit stayed
  unchanged. The production dry-run passed 586/586 mappings in 12 batches.
- The first apply failed before business writes because the registration RPC
  still pinned the pre-creatine-merge manifest SHA. Commit `9f847f3` added one
  reversible migration that changes only that exact hash. Its production
  rehearsal and apply preserved all product, variant, mapping, offer and price
  history row counts; the migration ledger advanced from 113 to 114.
- The guarded refresh then passed. It refreshed all 586 approved offers,
  applied exactly six reviewed OOS transitions, seven normal price changes and
  four normal URL changes, and created seven price-history rows. Product,
  variant, mapping, offer and retailer row counts were unchanged; 12 approvals
  were created and consumed and no recovery call was required.
- A final ordinary dry-run without the reviewed selector returned
  `VERIFY_NO_CHANGE: 586`, zero price/stock/URL deltas and zero new price-history
  rows. The special approval is therefore no longer needed for routine runs.
- The immediate 24-hour Protein Bars gate was rechecked after the refresh.
  Eleven products passed the identity/format/pack boundary, but only three were
  visible with 15 fresh offers, one retailer and zero multi-retailer products.
  The unchanged `3 / 2 / 20` gate remains closed; no route or thin page was
  created.

### 17 August 2026 — WheyWise competitive spot check

- Public sitemap reads counted 1,090 SupplementScout URLs and 1,383 WheyWise
  URLs, compared with 1,083 and 1,385 respectively on 31 July. The footprint
  gap narrowed from 302 to 293 URLs but remains material.
- WheyWise has strengthened commercial query presentation around cheapest,
  budget, type, brand and supplement-category hubs plus finder, calculator,
  deals and two-product comparison tools. Its current pages also retain
  inconsistent 1,337 / 1,958 / 1,900+ product and 85+ / 98 retailer claims and
  visible classification/copy defects.
- The evidence reinforces the existing sequence: finish useful controlled
  SEO-13 pages, restore approved offer freshness and multi-retailer overlap,
  pursue legitimate authority, then execute the planned brand/retailer, deals
  and guarded comparison work. No second SEO implementation was opened.

### 17 August 2026 — comparison-page shopper-language cleanup

- A review of the active comparison templates found internal SEO terminology
  exposed in shopper copy on Whey Protein, Whey Isolate, Pre Workout, Amino
  Acids, Vegan Protein, Mass Gainer, Multivitamins, Hydration and the public
  data-freshness explanation. Examples included `Indexing quality gate`,
  `noindex`, `indexability coverage gate` and structured-data error language.
- The visible wording now explains the customer consequence instead: a current
  single-retailer offer can still help check availability, while a meaningful
  price comparison needs enough recently checked offers from multiple UK
  retailers. If coverage becomes narrow, the page is not presented in search
  as a complete market comparison.
- The existing dynamic robots metadata, exact category gates, freshness rules,
  canonical URLs, structured data, catalogue reads and analytics are unchanged.
  This is presentation work inside the existing comparison-page mechanism,
  not a second SEO implementation or a weakened indexing policy.
- A regression assertion now blocks the identified internal phrases from
  returning to shopper-facing comparison copy. Nine focused page and
  transparency suites passed 77 tests; `npm run verify:quick` and
  `npm run verify:full`, including the Next.js production build, passed.
- Commit `00d00b2` was pushed to `main` and deployed. Cache-bypassed public
  reads returned HTTP 200, the new shopper-language copy, no identified old
  jargon and the exact canonical on all nine affected routes. Amino Acids, Pre
  Workout, Whey Isolate, Whey Protein and Data Freshness retained `index,
  follow`; Hydration, Mass Gainer, Multivitamins and Vegan Protein retained
  `noindex, follow` under their unchanged live coverage gates. The language
  cleanup is `LIVE VERIFIED`; the active comparison-page cluster remains
  `IN PROGRESS`.

### 17 August 2026 — SEO-13 Omega 3 price-intent local enhancement

- The latest available authenticated page report for 3–9 August identified
  `/omega-3` as the highest-impression current category landing page with 141
  impressions. Its existing title and H1 described a broad supplement list but
  did not lead with the delivered-price answer that differentiates
  SupplementScout.
- A current public search-result sample also showed price-led competitors using
  `prices`, `cheapest`, `deals`, per-unit value and multi-store comparison
  language. SupplementScout retains the safer delivered-cost claim and does not
  invent a best-product, health or complete-market ranking.
- The title, description, H1 and opening copy now target `Omega 3 Prices UK`
  and delivered-cost intent. A server-rendered quick answer uses the first row
  from the existing globally delivered-price-sorted landing data to state the
  current lowest known delivered price and link to the canonical product. It
  appears on page one only and explicitly limits the claim to current
  SupplementScout retailer coverage.
- The reviewed Omega 3 scope, freshness checks, price calculation, product
  cards, pagination, canonical policy, catalogue reads and internal links are
  unchanged. No second landing mechanism or manually maintained price was
  introduced.
- The focused landing suite passed 15 tests. Targeted ESLint and TypeScript,
  `npm run verify:quick` and `npm run verify:full`, including the Next.js
  production build, passed.
- Commit `3815e01` was pushed to `main` and deployed. Follow-up commit `610a471`
  replaced a malformed separator with a safe ASCII hyphen and added a
  regression assertion that rejects the damaged byte sequence. A
  cache-bypassed public read returned HTTP 200, title and H1 `Omega 3 Prices UK
  - Compare Delivered Cost`, the updated description, the exact `/omega-3`
  canonical and ordinary
  index/follow behaviour. The server-rendered answer used 24 current matching
  products and stated a lowest known delivered price of GBP 6.23 for `Omega 3
  Capsules 500mg`, linked to its canonical product, with the current-coverage
  limitation visible. The Omega 3 enhancement is `LIVE VERIFIED`; the wider
  active cluster remains `IN PROGRESS`.

### 17 August 2026 — SEO-13 Whey Isolate cost-intent local enhancement

- The latest available authenticated report, covering 3–9 August, confirmed
  that indexing is not the immediate traffic blocker: GSC recorded 582
  impressions, three clicks and average position 61.03, while GA4 recorded four
  organic sessions and two organic retailer-offer clicks. The report artefact
  remains read-only; a fresh scheduled report is still required for the next
  weekly comparison.
- Public search-result sampling showed that current Whey Isolate competition
  leads with `cheapest`, price-comparison and cost-per-protein intent. The
  existing live `/whey-isolate` page was therefore enhanced inside the active
  SEO-13 implementation rather than starting a second SEO task or route.
- Metadata and the H1 now lead with UK Whey Isolate price intent and the
  delivered-cost distinction. A server-rendered quick-answer block selects up
  to three lowest fresh in-stock totals only where delivery is known, excludes
  unknown delivery instead of estimating it, and links to the existing
  canonical product pages. A conditional answer states the lowest known
  delivered product and price without claiming full-market coverage.
- The existing canonical, reviewed isolate boundary, 24-hour freshness policy,
  `3 / 2 / 20` indexability gate, coverage-first main ranking, structured-data
  types, consent-aware analytics and catalogue read paths remain unchanged.
- Five focused Whey Isolate tests, `npm run verify:quick` and
  `npm run verify:full` passed. The isolated production build emitted title
  `Whey Isolate Prices UK – Delivered Cost | SupplementScout`. This is local
  release evidence only; the enhancement is not live verified until deployment
  and public HTML, robots, canonical, price-answer and analytics checks pass.
- Commit `25c6a3c` was pushed to `main`; its GitHub `full` and project-control
  checks passed and Vercel reported a successful deployment. A direct public
  read after deployment returned HTTP `200`, title
  `Whey Isolate Prices UK – Delivered Cost | SupplementScout`, H1
  `Whey Isolate Prices UK – Compare Delivered Cost`, the exact canonical and
  `index, follow`. Server-returned HTML contained the delivered-price quick
  answer, the conditional lowest-price answer, explicit unknown-delivery
  exclusion, CollectionPage, ItemList and BreadcrumbList data and the
  `whey_isolate_comparison` analytics marker. The cost-intent enhancement is
  `LIVE VERIFIED`; SEO-13 remains `IN PROGRESS`.

### 17 August 2026 — SEO-12 first-party retailer authority prospect audit

- Search Console Links still reports zero external links, so the first
  authority work is restricted to retailers already represented by current
  SupplementScout offers. No cold-list scraping, paid links, automated messages
  or third-party endorsements are authorised.
- Discount Supplements is the first commercial prospect because its official
  affiliate page explicitly welcomes content sites and aggregators and provides
  a Partnerize/Visualsoft application path:
  `https://www.discount-supplements.co.uk/pages/affiliates`. The proposed ask is
  an approved affiliate relationship, verified deep links and, only if useful
  to the retailer's customers, a natural partner/resource mention.
- Jon's Supplements, 6 Pack Supplements and Fit House are the first direct
  retailer prospects because they already have audited catalogue coverage and
  publish first-party contact paths at
  `https://jonssupplements.co.uk/pages/contact`,
  `https://6pack-supplements.co.uk/contact-us/` and
  `https://fithouse.uk/pages/about-us`. The proposed message offers a link to
  their live SupplementScout coverage, invites corrections to retailer data and
  asks whether they maintain a partners, press or useful-resources page where a
  factual comparison listing belongs.
- Outreach copy must lead with the retailer's existing coverage and
  SupplementScout's delivered-price transparency, make no ranking or traffic
  promise and never require a reciprocal link. No message has been sent; owner
  approval remains required before external communication. Four tailored,
  unsent owner-review messages and a pre-send accuracy checklist are recorded
  in `docs/SEO-Retailer-Outreach-Drafts-2026-08-17.md`.

### 12 August 2026 — Vitamin D cost-intent audit and local enhancement

- The existing `/vitamin-d` URL, canonical, title, description, H1, reviewed
  relevance gate, crawlable pagination, product links, delivered-price cards,
  verified price-per-serving display and internal links were retained without
  changes. No new route, pricing logic, FAQ or structured-data mechanism was
  introduced.
- The read-only public audit returned HTTP `200`, the exact canonical, one H1,
  72 product links, visible delivered-price breakdowns and ten visible
  price-per-serving labels. The page remained included once in the public
  sitemap and was indexable under the existing robots policy.
- A small server-rendered answer block was added only to canonical page one. It
  answers how much Vitamin D costs in the UK using the existing total product
  count and the lowest delivered total from the already price-sorted landing
  results, then explains the existing verified cost-per-serving display. This
  is local release evidence only; the established SEO-03 page remains live,
  while this enhancement is not live verified until deployment and public
  post-checks.

### 11 August 2026 — SEO-13 Multivitamins local release candidate

- The guarded `/multivitamins` comparison page reuses the existing shared
  category-comparison mechanism, 24-hour offer freshness and unchanged
  `3 / 2 / 20` indexability gate. It introduces no second importer, comparison
  framework or catalogue-write path.
- A production-backed local build found 18 products inside the reviewed
  explicit-multivitamin boundary. Sixteen were visible with 20 fresh offers
  across five retailers; four products had fresh offers from multiple
  retailers, so the unchanged gate returned `index, follow`.
- The rendered HTML contains the canonical `/multivitamins`, 16 ItemList
  entries, CollectionPage and BreadcrumbList structured data, current coverage,
  the consent-aware category analytics marker and only verified pack/value
  evidence. One sitemap entry and homepage discovery links were added.
- Focused tests, lint and the production-backed Next build passed. This is local
  release evidence only: Multivitamins is not `LIVE VERIFIED` until the public
  URL, robots directive, canonical, schema, analytics marker and sitemap entry
  are checked after deployment. SEO-13 remains `IN PROGRESS`.

### 11 August 2026 — SEO-13 Multivitamins live verification

- Commit `35e44ca` deployed the guarded `/multivitamins` page. The public URL
  returned HTTP `200` with `index, follow`, title `Compare Multivitamin Prices
  UK | SupplementScout` and canonical
  `https://www.supplementscout.co.uk/multivitamins`.
- Public HTML showed 16 visible products, 20 fresh offers, five retailers and
  four products with multiple retailers. Discount Supplements was visible.
- Public HTML contained one CollectionPage, one ItemList with 16 product
  entries, one BreadcrumbList and the `multivitamins_comparison` analytics
  marker. The public sitemap contained `/multivitamins` exactly once.
- Multivitamins is `LIVE VERIFIED`. Five of ten controlled SEO-13 candidates
  are now live. Protein Bars is the first deferred candidate in the fixed order
  and becomes the next bounded coverage-remediation task; its unchanged quality
  gate must not be weakened. SEO-13 remains `IN PROGRESS`.

### 11 August 2026 — SEO-13 Protein Bars source-overlap audit

- Fresh read-only source checks covered Discount Supplements (341 products),
  Fit House (240), Jon's Supplements (241) and Whey Okay (1,684 feed rows), plus
  the existing Six Pack approved catalogue evidence. No database or catalogue
  writes were performed.
- Discount exposed four bar families. Optimum Nutrition High Protein Bar
  `10 x 65g` is the only current same-family candidate already represented in
  the catalogue: its in-stock Marshmallow Crunch box at GBP 18.99 corresponds
  to canonical product `159` and explicit `Marshmallow / 65g`, pack `10`
  variant `1755`. This remains an owner-review candidate, not an authorised
  mapping.
- Jon's exposed exact CNP Protein Flapjack `12 x 75g` box variants matching the
  existing Six Pack family `1081`, but every current Jon's variant was OOS.
  Mapping those identities would not satisfy the fresh in-stock comparison gate
  today and must not be counted as coverage.
- Fit House exposed two in-stock single Barebells variants, while Whey Okay
  exposed in-stock Barebells singles under legacy canonical product `151` and
  Fit House's older reviewed variants are under product `958`. This is a
  duplicate-family/explicit-variant review, not a safe automatic merge. Current
  flavour sets also differ.
- Whey Okay's current Battle Bites single and box rows were OOS. PER4M single
  bars and boxes remain correctly separated, and no other exact current overlap
  was found in these bounded sources.
- The evidence therefore does not yet prove three safe, current multi-retailer
  product families. Protein Bars remains deferred behind the unchanged
  `3 / 2 / 20` gate. The next step is owner review of the Optimum candidate,
  the Barebells duplicate-family repair and whether to preserve the exact OOS
  CNP Jon's mappings for future stock recovery.

### 11 August 2026 — SEO-13 remaining-candidate recheck and remediation choice

- Electrolytes was rechecked through the existing `/hydration` boundary. The
  read-only production audit found 18 scoped products, 12 visible products, 44
  fresh offers and four retailers. Only product `37`, Applied Nutrition BCAA
  Amino Hydrate 450g, had fresh offers from multiple retailers. The unchanged
  `3 / 2 / 8` Hydration gate therefore still fails on multi-retailer depth; the
  existing page remains the only canonical and continues to fail closed rather
  than creating `/electrolytes`.
- Magnesium Glycinate reviewed 20 magnesium-named products. Five passed the
  exact glycinate/bisglycinate boundary without a conflicting magnesium form or
  blend; three were visible, with three fresh offers from three retailers and
  zero multi-retailer products. The unchanged `3 / 2 / 20` gate failed.
- Multivitamins reviewed 18 explicit multivitamin products. Sixteen were
  visible with 18 fresh offers across four retailers; products `380` and `381`
  had fresh offers from both 6 Pack Supplements and Whey Okay. Two visible
  products had verified value metrics. The unchanged gate still failed at two
  rather than three multi-retailer products and 18 rather than 20 fresh offers.
- Ashwagandha reviewed nine named products and excluded the Shilajit blend.
  Eight passed the identity boundary; six were visible with seven fresh offers
  across three retailers. Only product `402`, BioTech USA Ashwagandha 60 Caps,
  had fresh multi-retailer coverage, so the unchanged gate failed.
- Creatine Monohydrate remains consolidated into `/creatine`. The established
  canonical already compares creatine products, delivered prices and verified
  cost per 5 g, and includes explicit monohydrate products. A second route would
  duplicate the same products and intent without distinct decision value.
- A follow-up read-only mapping audit found no dormant third Multivitamins
  comparison to revive: only products `380` and `381` have mappings at two
  retailers; every other candidate has exactly one retailer mapping. The next
  bounded task is therefore exact overlap discovery against existing approved
  retailer sources, not a page, a relaxed gate or another import mechanism.
- A fresh 341-product / 997-variant Discount Supplements snapshot then found
  three bounded overlap candidates. Product `824`, Strom Sports MultiMAX, is an
  exact 180-tablet match to Discount external product `7467845877956`, variant
  `42518690463940`, in stock at GBP 27.95; current Jon's and Discount evidence
  agrees with the manufacturer's 180-tablet / 90-serving identity. Product
  `816`, TBJP The One, is the same formula, but canonical format `tablet` is
  wrong: the manufacturer describes capsules and Discount external product
  `15002692616570`, variant `55157496185210`, identifies 60 capsules in stock at
  GBP 11.99. It requires an owner-reviewed metadata and variant correction
  before mapping. Product `1042`, Applied Nutrition Multi-Vitamin Complex,
  similarly says 90 tablets locally while the manufacturer and Discount
  external product `4670592974895`, variant `54864037708154`, identify 90
  capsules. It remains a separate correction rather than being silently linked.
- Applying only the exact Strom mapping and the reviewed TBJP correction/mapping
  would raise the current Multivitamins gate from two to four multi-retailer
  products and from 18 to 20 fresh offers, subject to a fresh post-apply audit.
  These findings are planning evidence, not production-write authority.
- All audits were read-only and performed zero catalogue, mapping, offer or
  analytics writes. SEO-13 remains `IN PROGRESS` with four live candidates and
  six explicit deferred outcomes.

### 11 August 2026 — SEO-13 Protein Bars gate rechecked and remains deferred

- A fresh read-only production audit reviewed all 52 active, unmerged products
  in the exact `Protein Bars` category, 183 canonical variant rows and 172
  mapping/offer rows. It performed zero catalogue, mapping, offer or analytics
  writes.
- The unchanged safe boundary required an explicit bar, wafer or flapjack
  canonical identity; `bar` or `snack` format; a known product-consistent pack
  count across every concrete active variant; and an in-stock, positive-price,
  mapped offer checked within 24 hours. Jams, sauces, spreads, cookies,
  milkshakes, pancake mix, liquid egg white and other non-bar foods remained
  outside this category-specific comparison even though they are allowed in
  the wider catalogue.
- Twelve products passed the identity, format and pack boundary. Nine were
  visible with 46 fresh offers across 6 Pack Supplements, Whey Okay and Jon's
  Supplements. Single products and boxes remained separate; Warrior Crunch
  and 6Pak Protein Wafer were excluded because their current families still
  mix pack counts `1` and `12`.
- Zero eligible products had fresh offers from multiple retailers. The
  unchanged `3 / 2 / 20` index gate therefore failed on comparable retailer
  overlap even though fresh-offer volume passed. No `/protein-bars` route,
  sitemap entry or metadata was created, and the gate was not weakened.
- Protein Bars remains deferred until at least three exact same-pack products
  have fresh multi-retailer coverage. Electrolytes is the next fixed-order
  candidate and must be rechecked through the existing `/hydration` canonical
  rather than through a duplicate route.

### 11 August 2026 — SEO-13 Mass Gainer live verification

- The owner explicitly approved changing only products `128` and `132` from
  `Health Supplements` / null format to `Mass Gainer` / `powder`. Production
  migration `20260811030000_correct_reviewed_mass_gainer_metadata` passed an
  all-or-nothing rollback rehearsal and then applied successfully. Product,
  variant, mapping, offer and price-history row counts remained exactly
  `1112 / 2641 / 2522 / 2522 / 2673`; no price, stock, URL, identity or history
  row changed.
- A fresh read-only post-correction audit found nine scoped products, eight
  visible products, 50 offers checked within 24 hours and three retailers.
  Products `128`, `132` and `403` had fresh multi-retailer coverage, so the
  unchanged `3 / 2 / 20` gate passed.
- Added `/mass-gainer` through the existing shared category comparison
  normalizer, with the exact reviewed category-and-powder boundary, a strict
  24-hour page freshness rule, dynamic indexability, known delivered prices,
  verified-only value metrics, consent-aware category analytics and
  CollectionPage, ItemList and BreadcrumbList structured data. Added one
  sitemap entry and bounded links from the homepage and Whey Protein page.
- Forty-two focused migration, selector, comparison and transparency tests
  passed. TypeScript passed. ESLint reported zero errors and only ten existing
  unrelated warnings. The Next.js 16.2.9 production build passed with the
  system certificate store and emitted `/mass-gainer` with one-hour
  revalidation. Its generated HTML contained `index, follow`, the exact
  canonical, eight visible product cards, 50 fresh offers, three retailers,
  three multi-retailer products, all three structured-data types and the
  `mass_gainer_comparison` analytics marker.
- Commit `ed585c1` was pushed to `main`. Public `/mass-gainer` returned HTTP
  200 with `index, follow`, the exact canonical, eight visible product cards,
  50 fresh offers, three retailers and three multi-retailer products. It
  rendered CollectionPage, ItemList and BreadcrumbList data, contained the
  consent-aware `mass_gainer_comparison` analytics marker, and appeared exactly
  once in the public sitemap. Mass Gainer is `LIVE VERIFIED`; SEO-13 remains
  `IN PROGRESS` with four of ten controlled candidates live verified.

### 11 August 2026 — SEO-13 Mass Gainer gate rechecked and remains deferred

- A fresh read-only production audit reused the recorded safe boundary: active,
  unmerged products in the exact `Mass Gainer` category with canonical
  `product_format = powder`, plus offers checked within the shared 24-hour SEO
  gate window. It performed zero catalogue, offer or analytics writes.
- Seven canonical products remained in scope. Six had current offers: 30 fresh
  offers across 6 Pack Supplements, GYM HIGH and Whey Okay. Only product `403`,
  `GYM HIGH Mass Gainer 2100g`, had fresh offers from multiple retailers.
- The 20-offer and 2-retailer parts of the unchanged gate passed, but the
  requirement for three products with fresh multi-retailer coverage still
  failed at one. No `/mass-gainer` page, sitemap entry or metadata was created,
  and the gate was not weakened.
- The audit identified two bounded catalogue-metadata candidates rather than a
  new page mechanism. Products `128` (`7Nutrition Bodybuilder 1.5kg`) and `132`
  (`Applied Nutrition Critical Mass Lean Mass Gainz 2.4kg`) already have fresh
  mapped offers from both Whey Okay and 6 Pack Supplements, and every reviewed
  non-default variant is explicitly a powder with a verified 1,500 g or 2,400 g
  size. Both canonical products are still labelled `Health Supplements` with a
  null product format. Any correction to `Mass Gainer` / `powder` remains a
  separate exact owner-reviewed catalogue write; it was not inferred or
  applied by this SEO audit.
- SEO-13 remains `IN PROGRESS`; Mass Gainer remains the next fixed-order
  candidate and must be rechecked after any guarded catalogue correction.

### 4 August 2026 — SEO-13 Vegan Protein live verification

- The owner-approved refresh reused guarded existing-offer mechanisms for 586
  Whey Okay offers, 66 GYM HIGH offers and the exact Dolphin offer `2490`.
  Dolphin now has a protected daily refresh for that one manifest-bound offer.
- A GYM HIGH postcondition check exposed that unchanged standard-import rows
  did not advance freshness. Commit `4e34fd2` corrected the existing scheduled
  workflow to convert unchanged rows into verified-no-change plans. The
  protected apply executed exactly 66 plans and the postflight found zero stale
  rows, zero creates and zero price, shipping, stock or URL changes.
- The final read-only production audit passed the unchanged gate with 32 fresh
  offers from four retailers and three products with fresh multi-retailer
  coverage: products `70`, `71` and `390`. No product, variant, mapping or offer
  was created by this remediation.
- Commit `84f08af` added `/vegan-protein` through the existing shared
  comparison normalizer with a page-specific 24-hour freshness predicate. The
  global 24-day availability buffer was not changed. Focused tests, TypeScript,
  lint with only ten pre-existing warnings, the production build and Project
  Guardian all passed.
- The public page returned HTTP 200 with `index, follow`, the exact canonical,
  7 visible products, 32 fresh offers, 4 retailers and 3 multi-retailer
  products. It had no degraded-data state and rendered CollectionPage,
  ItemList and BreadcrumbList structured data. The live sitemap contained
  `/vegan-protein` exactly once.
- Vegan Protein is `LIVE VERIFIED`. SEO-13 remains `IN PROGRESS` with three of
  ten controlled pages live; Mass Gainer is the next fixed-order candidate and
  retains its recorded coverage blocker until the unchanged gate passes.

### 1 August 2026 — SEO-13 page 3 Whey Isolate live verification

- The post-remediation read-only production gate reviewed the unchanged safe
  boundary: exact `Whey Protein` category plus explicit isolate, ISO or WPI
  canonical identity, excluding explicit blends, beef and collagen proteins.
  Sixteen products remained in scope with 78 fresh offers from four retailers;
  three products had fresh offers from multiple retailers. The unchanged
  3-product / 2-retailer / 20-offer gate passed.
- Commit `16bcaf6` added `/whey-isolate` through the existing shared category
  comparison normalizer and indexability gate. No product, variant, mapping,
  offer or retailer identity was created or changed by the page implementation.
- Local evidence passed: 26 focused tests, TypeScript, lint with only the four
  pre-existing Six Pack warnings, production build and Project Guardian. The
  build emitted the `/whey-isolate` route with the existing one-hour revalidation
  policy.
- Vercel reported the deployment successful. Live `/whey-isolate` returned HTTP
  200 with the exact canonical, `index, follow`, visible 16-product / 78-offer /
  4-retailer / 3-multi-retailer coverage, no degraded-data message, and
  CollectionPage, ItemList and BreadcrumbList structured data. The live sitemap
  contained `/whey-isolate` exactly once.
- SEO-13 remains `IN PROGRESS`: two of ten controlled pages are now live
  verified. Vegan Protein is the next fixed-order candidate and retains its
  existing coverage blocker until the same gate passes.

### 1 August 2026 — Fit House source-removal remediation applied

- The public product, search and suggestion paths now share one fail-closed
  24-hour current-offer rule. Missing, invalid, future-dated and older offers
  are excluded from public price and retailer availability instead of relying
  only on `in_stock=true`.
- The Fit House refresh now preserves all 286 approved mappings when a variant
  disappears from a healthy, complete Shopify snapshot. Missing identities are
  represented only as unavailable source evidence; product identity, mapping,
  URL and historical records are not deleted or guessed. The policy blocks if
  more than 28 approved identities or more than 10% of the approved scope is
  absent.
- Owner approval bound the exceptional 18 new out-of-stock transitions to
  reviewed manifest SHA-256
  `bf88cae84484b26f638ed10fd1073f39dc48aa464a0b5deae794840b99e2f28f`
  and source fingerprint
  `e3f72cc6e2cc54880ab6c8bd11612a984dbe1a4a4b60a9774810e2c87f94e680`.
  Any row, price, stock, identity or source-fingerprint drift failed closed.
- The protected production dry-run passed for all 286 offers. The approved
  apply registered parent plan `87d7e61f-34a8-41ea-bcaf-e70bccf091d0`
  and applied all six validator/approver/executor children. It updated 16
  prices/delivered totals, 20 stock states and 286 check timestamps, adding 16
  price-history rows. Product, variant, mapping and offer row-count deltas were
  all zero; no recovery call was required.
- The mandatory post-apply production dry-run passed with 286
  `VERIFY_NO_CHANGE` rows, zero price, stock and history deltas, and no reviewed
  override required. The Fit House blocker closed and the subsequent Whey
  Isolate gate passed; SEO-13 remains `IN PROGRESS`.
- Commit `9eabbac` deployed successfully through Vercel. The live affected
  product and exact search both returned HTTP 200 without Fit House or the stale
  £40.98 delivered price, confirming that unavailable source identities no
  longer leak into public price or retailer availability.

### 1 August 2026 — SEO-13 coverage-remediation checkpoint

- A read-only mapping audit rechecked the safe Protein Bars boundary. Eleven
  products had a stable explicit bar/wafer/flapjack identity and one consistent
  pack count, but only one product was mapped to two retailers and none had
  fresh offers from two retailers.
- The sole mapped overlap candidate was Battle Snacks Battle Bites Protein Bar
  62g. Its 6 Pack offers were fresh; its legacy Whey Okay offer was stale. The
  existing guarded EKM reader fetched a fresh 1,680-row Whey Okay feed and found
  all nine single-bar and all nine box-of-12 Battle Bites variants out of stock.
  The stale offer was not revived, pack identities were not mixed and no write
  was attempted.
- Whey Isolate remains the nearest deferred coverage gate: 16 scoped products,
  77 fresh offers and two products with fresh multi-retailer coverage. Four
  products already have mappings at more retailers than their current fresh
  coverage, so existing refresh mechanisms were checked before considering any
  new integration.
- Scheduled Fit House run `30686341802` passed its contracts but failed closed
  in the full approved-offer classifier. A local production dry-run through the
  same mechanism reproduced `IDENTITY_DRIFT` at offer `986`, mapping `1172`,
  canonical product `68` (`7Nutrition Whey Isolate 90 1kg`). It attempted and
  completed zero database, business or control writes.
- The approved Fit House source product `8147819069680` is absent from the
  current 206-product Shopify source and its previous public handle returns
  404. The whole 286-offer refresh correctly remains blocked rather than
  treating disappearance as proof of out-of-stock state.
- The next safe action is an owner-reviewed disposition of that missing source
  identity through the existing guarded manifest process, followed by a
  protected dry-run. SEO-13 remains `IN PROGRESS`; no deferred page gate changed
  and no production or catalogue write was authorised by this audit.

### 1 August 2026 — SEO-13 page 10 Creatine Monohydrate gate deferred

- A read-only production audit reviewed all 58 active, unmerged products in the
  exact Creatine category. Eighteen names explicitly identified monohydrate or
  Creapure; the final single-form boundary excluded the `Creatine Monohydrate +
  Taurine` blend, leaving 17 eligible products. No catalogue or production data
  was changed.
- Twelve eligible products had 25 fresh offers across five retailers, and
  three had fresh offers from multiple retailers. The coverage threshold was
  met without broadening the identity rule.
- The distinct-value gate failed. The public `/creatine` page returned HTTP
  200 with its exact canonical, already included monohydrate products, compared
  retailer availability and exposed the verified cost-per-5-g decision metric.
  A separate `/creatine-monohydrate` route would reuse the same products,
  offers and decision data while competing with the established canonical.
- No duplicate route, sitemap entry or metadata was created. Creatine
  Monohydrate remains consolidated into `/creatine`. All ten candidate gates
  have now been reviewed; SEO-13 remains `IN PROGRESS` because only page 1 is
  live verified and the other nine candidates have recorded blockers.

### 1 August 2026 — SEO-13 page 9 Ashwagandha gate deferred

- A read-only production audit reviewed nine active, unmerged products with an
  explicit Ashwagandha identity, then checked canonical names, current retailer
  labels and the shared 24-hour offer window. The final boundary excluded the
  `Gold Shilajit + Ashwagandha` blend rather than treating it as a comparable
  single-ingredient product. No catalogue or production data was changed.
- Eight products passed the identity boundary. Seven had a fresh offer, giving
  eight fresh offers across three retailers. Only one product had fresh offers
  from multiple retailers.
- Canonical and current retailer labels agreed for the included products, but
  the page failed the existing minimums of 20 fresh offers and three
  multi-retailer products.
- No `/ashwagandha` page, sitemap entry, metadata or unsupported health content
  was created. Ashwagandha is deferred until retailer depth improves. Creatine
  Monohydrate becomes the next candidate while SEO-13 remains `IN PROGRESS`.

### 1 August 2026 — SEO-13 page 8 Multivitamins gate deferred

- A read-only production audit reviewed 18 active, unmerged products with an
  explicit multivitamin identity, plus category, current offers, retailer
  labels, unit counts and verified serving/value fields. A multi-mineral-only
  product was excluded from the final boundary. No data was changed.
- Six products had eight fresh offers across three retailers. Two products had
  multi-retailer coverage, below the existing minimum of three, and the total
  fresh-offer count was below 20.
- None of the six visible products had the verified serving or unit-pricing
  state required to display a trustworthy value metric. Products with verified
  value fields had no current offer.
- The taxonomy, coverage and value-data gate therefore failed. No
  `/multivitamins` page, sitemap entry, metadata or production change was
  created, and missing values were not inferred from product names.
- Multivitamins is deferred until current coverage and verified value data
  improve. Ashwagandha becomes the next candidate while SEO-13 remains
  `IN PROGRESS`.

### 1 August 2026 — SEO-13 page 7 Magnesium Glycinate gate deferred

- A read-only production audit reviewed all 19 active, unmerged products with
  magnesium in the canonical name, then checked exact glycinate/bisglycinate
  wording, conflicting forms or blends, fresh offers and retailer labels. It
  performed no catalogue or production write.
- Four products passed the form-specific identity boundary. No retailer-only
  glycinate label pulled a different canonical product into scope, and no
  included current label conflicted with the canonical form.
- Only two products had a fresh offer, one each from Jon's Supplements and
  6 Pack Supplements: two fresh offers total and zero multi-retailer products.
  The existing index gate failed on both offer volume and retailer overlap.
- No `/magnesium-glycinate` page, sitemap entry, metadata or production change
  was created, and the form or coverage gate was not weakened. Multivitamins
  becomes the next candidate while SEO-13 remains `IN PROGRESS`.

### 1 August 2026 — SEO-13 page 6 Electrolytes gate deferred and local hardening

- A read-only production audit applied the existing Hydration/Electrolytes
  inclusion rule to active, unmerged products and the shared 24-hour offer
  window. It found 18 scoped products, 12 visible products, 47 fresh offers and
  four retailers, but only one product with fresh offers from multiple
  retailers. No catalogue or production data was changed.
- A separate `/electrolytes` route would duplicate the existing `/hydration`
  canonical, whose title, copy and product scope already target hydration and
  electrolyte intent. No duplicate URL or sitemap entry was created.
- The existing 3-product / 2-retailer / 8-offer Hydration index gate failed on
  multi-retailer depth. The page was incorrectly hard-coded to `index, follow`
  despite explaining that gate publicly.
- Reused the existing comparison loader and gate to make Hydration metadata
  fail closed dynamically. The cached loader is shared by metadata and page
  rendering; no second query mechanism was created. Added the missing
  CollectionPage node and consent-aware category analytics while retaining the
  existing ItemList, BreadcrumbList, canonical and visible limitations.
- Sixty-seven focused comparison, transparency, sitemap and Guardian tests
  passed. TypeScript passed; ESLint had zero errors and only the four existing
  Six Pack warnings. The Next.js 16.2.9 production build passed and its static
  Hydration HTML contained the exact canonical, `noindex, follow`,
  CollectionPage JSON-LD and the consent-aware analytics source.
- Hardening commit `2d42df6` was pushed to `main`; hosted Project Guardian run
  `30692805345` passed. Public `/hydration` returned `200`, its exact canonical,
  `noindex, follow`, the consent-aware analytics source and one JSON-LD graph
  containing CollectionPage, ItemList and BreadcrumbList. Schema.org Validator
  fetched the live URL and reported zero issues across 19 parsed nodes.
- Electrolytes is deferred until the shared multi-retailer gate recovers. The
  next candidate is Magnesium Glycinate; SEO-13 remains the single
  `IN PROGRESS` implementation.

### 1 August 2026 — SEO-13 page 5 Mass Gainer gate deferred

- A read-only production audit reviewed the exact `Mass Gainer` category,
  explicit gainer identities, product format, fresh offers and the latest 1,000
  internal `search_results` events. No catalogue, analytics or production data
  was changed.
- Internal demand evidence was present: 31 matching events included direct
  `mass gainer` searches, a specific product query and goal-mapped `muscle
  gain` searches. This is recorded as on-site intent evidence, not substituted
  for the still-blocked Search Console baseline.
- Seven products passed the explicit powder identity boundary. Three had
  current offers: 18 fresh offers across two retailers, with only one product
  covered by multiple retailers.
- Both the 3-product multi-retailer threshold and the 20-fresh-offer threshold
  failed. No `/mass-gainer` page, sitemap entry, metadata or production change
  was created, and neither threshold was weakened.
- Mass Gainer is deferred until current coverage improves. Electrolytes becomes
  the next candidate gate, with an explicit requirement to review the existing
  `/hydration` canonical and avoid duplicate search intent.

### 1 August 2026 — SEO-13 page 4 Vegan Protein gate deferred

- A read-only production audit reviewed explicit vegan, plant, pea, rice and
  hemp protein identities across all active, unmerged products, then checked
  canonical category, format, variants, fresh offers and retailer labels. It
  made no catalogue or production write.
- The safe boundary requires an explicit plant/vegan protein powder identity,
  excludes bars and other food formats, and rejects animal-protein conflicts in
  canonical or retailer labels. All included current retailer labels agreed
  with the canonical plant/vegan identity.
- Eight products passed the identity boundary; six had 27 fresh offers across
  Whey Okay, 6 Pack Supplements and Jon's Supplements. Only one product had
  fresh offers from multiple retailers.
- The unchanged 3-product / 2-retailer / 20-offer gate failed on
  multi-retailer depth. No `/vegan-protein` page, sitemap entry, metadata or
  production change was created, and the gate was not weakened.
- Vegan Protein is deferred until current comparable retailer overlap reaches
  the existing threshold. Mass Gainer becomes the next candidate gate while
  SEO-13 remains the single `IN PROGRESS` implementation.

### 1 August 2026 — SEO-13 page 3 Whey Isolate gate deferred

- A read-only production audit reviewed all 94 active, unmerged products in
  the exact `Whey Protein` category, their fresh offers and the corresponding
  retailer labels. It also inspected explicit isolate names outside that
  category. No product, mapping, offer or production data was changed.
- The safe boundary requires the exact Whey Protein category plus an explicit
  isolate/ISO/WPI canonical identity, and excludes explicit blends, beef and
  collagen proteins. Retailer-only isolate wording cannot pull a canonical
  product into scope, and four isolate-labelled products assigned to `Health
  Supplements` remain excluded pending separate identity review.
- One explicit tri-blend was excluded. The final reviewed boundary contained
  16 visible products, 77 fresh offers and three retailers. Retailer labels for
  included fresh offers agreed with their canonical isolate identities.
- Only two included products had fresh offers from multiple retailers. The
  unchanged 3-product / 2-retailer / 20-offer index gate therefore failed on
  multi-retailer depth. No `/whey-isolate` page, sitemap entry, metadata or
  production change was created, and the gate was not weakened.
- Whey Isolate is deferred until current comparable retailer overlap reaches
  the existing threshold. Vegan Protein becomes the next candidate gate while
  SEO-13 remains the single `IN PROGRESS` implementation.

### 1 August 2026 — SEO-13 page 2 Protein Bars gate deferred

- A read-only production audit reviewed all 52 active, unmerged products in
  the exact `Protein Bars` category, including active variants, pack counts and
  offers checked within the shared 24-hour freshness window. It performed no
  product, variant, mapping, offer or production write.
- The unreviewed category boundary is unsafe: current entries include jams,
  sauces, nut butter, milkshakes, pancake mix, liquid egg white, cookies and
  other non-bar products. Current variants also expose single-versus-box pack
  conflicts, including one canonical product with simultaneous 1-bar and
  12-bar offers.
- The broad category had 28 products with 95 fresh offers and only two apparent
  multi-retailer products; both apparent comparisons were outside the safe bar
  boundary. Requiring an explicit bar/wafer/flapjack identity, one known and
  consistent pack count, active canonical state and a fresh mapped offer left
  10 products, 48 offers and three retailers, but zero products with offers
  from multiple retailers.
- The unchanged 3-product / 2-retailer / 20-offer index gate therefore failed
  on multi-retailer depth. No `/protein-bars` page, sitemap entry, metadata or
  production change was created, and the gate was not weakened.
- Protein Bars is deferred inside SEO-13 until canonical category cleanup and
  comparable pack-level retailer overlap are independently verified. Per the
  fixed rollout order, Whey Isolate becomes the next candidate gate while
  SEO-13 remains the single `IN PROGRESS` implementation.

### 1 August 2026 — SEO-13 page 1 Amino Acids / BCAA / EAA live verification

- A read-only production audit reviewed all 62 active, unmerged products in
  the exact `Amino Acids` category and inspected explicit amino-product names
  outside it for category conflicts. The public scope stays inside the
  reviewed category and requires the canonical name to identify amino acids,
  BCAA, EAA or a named amino-acid ingredient explicitly.
- Opaque blends, bundles, 5-HTP, NAC and glutathione products are excluded
  rather than inferred. Explicit products assigned to other categories are not
  pulled across category boundaries. No product identity, mapping, offer or
  production data was changed.
- Added canonical `/amino-acids` through the existing
  `app/lib/categoryComparison.ts` mechanism with the shared 24-hour freshness,
  mapped-offer validation, known-delivery ranking, verified value metrics,
  coverage-first ordering and fail-closed index gate. No second comparison or
  catalogue system was created.
- The page includes canonical metadata, conditional `index`/`noindex`, one
  CollectionPage/ItemList/BreadcrumbList JSON-LD block, consent-aware category
  analytics, visible inclusion and limitation rules, one sitemap entry and
  crawlable links from the homepage, Whey Protein, Pre Workout, Hydration and
  Creatine pages. It makes no effectiveness or suitability claims.
- Nine focused page tests passed. ESLint completed with zero errors and four
  pre-existing warnings in `scripts/six-pack-large-family-bootstrap.js`;
  TypeScript, `git diff --check`, Project Guardian and the Next.js 16.2.9
  production build passed. The broad historical suite recorded 1,139 passes,
  33 skips and four unrelated baseline/environment failures: three unavailable
  Docker integration runs and one existing migration-count expectation of 68
  against the repository's current 70 migrations.
- Implementation commit `6a11f38` was pushed to `main`. Hosted Project Guardian
  run `30692047673` passed for that commit. The public page returned `200`, its
  exact canonical URL and `index, follow`, with 31 visible products, 104 fresh
  offers from three retailers and three products with current multi-retailer
  coverage, meeting the unchanged 3-product / 2-retailer / 20-offer gate.
- Public JSON-LD contained one CollectionPage, one 31-item ItemList and one
  BreadcrumbList. All 31 product URLs were unique and the reviewed exclusions
  were absent. Schema.org Validator fetched the live URL and reported zero
  errors and zero warnings across 38 parsed nodes.
- The public homepage and four priority comparison pages linked to the route;
  the public sitemap contained its canonical URL exactly once. Search Console
  URL inspection remains unrecorded under the existing SEO-07 authentication
  blocker and is not represented as successful evidence.
- Separate scheduled Retailer Dry Run `30692057395` failed closed in the
  read-only Discount Supplements classification step. It is recorded as an
  operational source follow-up, not as a successful run and not as authority
  for catalogue or production writes; current live page evidence remained
  independently valid.
- SEO-13 remains `IN PROGRESS`: one of ten pages is live verified. Protein Bars
  is the next candidate and must pass its own product/box identity and current
  coverage gate before any implementation begins.

### 1 August 2026 — SEO-10 local implementation

- Added canonical, indexable `/how-we-compare` and `/data-freshness` static
  Server Components. They use the existing Next.js metadata and sitemap
  mechanisms; no second pricing, freshness, catalogue or data-fetching system
  was created.
- `/how-we-compare` explains the implemented delivered-total calculation,
  unknown-delivery handling, canonical product/variant identity, coverage-first
  ordering, verified unit and nutrition metrics, price-history treatment,
  retailer sources and limitations. It explicitly avoids effectiveness,
  formulation, safety and whole-market claims.
- `/data-freshness` binds its visible 24-hour rule to the existing
  `CREATINE_LAUNCH_THRESHOLDS.maximumOfferAgeHours` constant. It distinguishes
  current comparison-page eligibility from other site surfaces, explains
  timestamps, guarded retailer updates, stale-offer exclusion, fail-closed
  `noindex`, price-history gaps and checkout verification without claiming one
  sitewide refresh schedule.
- Both pages publish WebPage and BreadcrumbList JSON-LD without invented
  Product, Dataset or FAQ entities. Each canonical URL appears once in the
  sitemap without a fabricated `lastModified` value.
- Added one shared crawlable link component and reused it on the homepage, Whey
  Protein, Pre Workout, Creatine and Hydration pages. The homepage footer and
  About navigation also expose both routes.
- `node --test scripts/comparison-transparency-pages.test.js scripts/pre-workout-page.test.js scripts/whey-protein-page.test.js scripts/creatine-page.test.js scripts/hydration-page.test.js scripts/sitemap-freshness.test.js scripts/homepage-statistics.test.js scripts/home-navigation-ux.test.js`:
  88 passed, 0 failed.
- Targeted ESLint, TypeScript, `git diff --check` and the Next.js 16.2.9
  production build passed. The build prerendered both routes as static content.
- Local production-server checks returned `200`, canonical `index, follow` and
  JSON-LD for both pages. Homepage links were present and the local sitemap
  contained each canonical URL exactly once.
- SEO-10 remains `CODE COMPLETE`; deployment, public HTML, public sitemap/link
  and external structured-data checks remain required before completion.

### 1 August 2026 — SEO-10 live verification

- Commit `eaa09e2` was pushed to `main`; Vercel reported the deployment
  successful. Hosted Project Guardian run `30690024522` also passed for that
  exact commit.
- Public `/how-we-compare` and `/data-freshness` both returned `200`,
  `index, follow` and their exact canonical URLs. Initial HTML contained each
  page's direct answer and the implemented methodology/freshness rules.
- The homepage, Whey Protein, Pre Workout, Creatine and Hydration public pages
  each exposed crawlable links to both support pages. The public sitemap
  contained each canonical support URL exactly once.
- Each public page emitted one JSON-LD block containing WebPage and a
  two-position BreadcrumbList. Both blocks parsed successfully and contained
  no Product, Dataset or FAQPage entity.
- Schema.org Validator fetched both public URLs. All seven parsed result nodes
  per page reported zero errors and zero warnings.
- Search Console URL inspection remains unrecorded because the authenticated
  report/export blocker documented under SEO-07 still applies; this is not
  represented as a successful inspection.
- SEO-10 is `LIVE VERIFIED`. The next executable implementation is declared in
  the current active-task section above.

### 1 August 2026 — SEO-09 local implementation

- Added canonical `/pre-workout` as a Server Component through the existing
  `app/lib/categoryComparison.ts` decision-page core; no second search,
  catalogue or comparison engine was created.
- The reviewed scope requires an active, unmerged product in the exact
  `Pre Workout` category and excludes explicit multi-product bundles. It does
  not infer caffeine, stimulant status, ingredient suitability, effectiveness
  or formulation quality from product names.
- Reused the existing 24-hour offer freshness rule, mapped-offer validation,
  known-delivery ranking, verified unit-value calculations, coverage-first
  ordering and fail-closed indexing gate from SEO-08.
- Added canonical metadata, conditional `index`/`noindex`, CollectionPage,
  ItemList and BreadcrumbList JSON-LD, consent-aware category analytics, one
  sitemap entry and prominent links from the homepage, Whey Protein, Creatine
  and Hydration pages.
- A read-only catalogue audit before implementation found 111 active exact-
  category products, 339 positive-price in-stock offers, 13 products with at
  least two retailers and seven retailers before the 24-hour freshness rule.
- The production-shaped local build correctly applied that freshness rule and
  rendered 32 products, 135 fresh offers and two fresh retailers. Only one
  product currently had fresh offers from multiple retailers, below the
  three-product index gate, so the page correctly emitted `noindex, follow`.
  The 32 visible product cards matched 32 ItemList entries, the explicit bundle
  was absent, the homepage link was present and sitemap occurrence was exactly
  one.
- `node --test scripts/pre-workout-page.test.js scripts/whey-protein-page.test.js scripts/sitemap-freshness.test.js scripts/homepage-server-rendering.test.js scripts/creatine-page.test.js scripts/hydration-page.test.js`:
  66 passed, 0 failed.
- Targeted ESLint, TypeScript, `git diff --check`, the Next.js 16.2.9
  production build and the local production-server HTML checks passed.
- At this local checkpoint SEO-09 was `CODE COMPLETE`, not `LIVE VERIFIED`.
  Deployment, public checks and recovery of the existing quality gate to at
  least three multi-retailer products across at least two retailers and 20
  fresh offers were still required; the SEO implementation did not receive
  authority to change retailer data or weaken the gate.

### 1 August 2026 — SEO-09 live verification

- Implementation commit `e592fd1` launched the controlled page. Commit
  `77056cb` produced the live verified artefact after current retailer checks;
  Vercel reported the deployment successful.
- Existing Whey Okay automation first failed closed on six reviewed family-
  variant binding changes and then on the frozen registration hash. Runs
  `30688188811`, `30688432013` and `30688663746` stopped before catalogue
  mutation; the registration failure recorded zero control and business writes.
- The six bindings were reconciled to already-approved canonical variants in
  commit `81e8f5a`. A read-only audit then matched all 586 manifest rows with
  zero binding mismatches. The narrow, reversible manifest-guard migration was
  rehearsed and applied first on staging and then production; product, variant,
  mapping, offer and price-history row counts did not change. Stable migration
  ledgers are recorded by commits `fe3f88c` and `8d46b90`.
- Hosted production run `30688986753` passed preflight, apply and a fresh-source
  idempotency check. Its signed artefact matched 586/586 approved offers across
  12 guarded batches, with zero missing rows and 586 `VERIFY_NO_CHANGE`
  classifications. Product, variant, mapping, offer and price-history counts
  changed by zero; prices, shipping, totals, stock and URLs changed by zero;
  only 586 `last_checked_at` values were refreshed. Thirty-one observed
  shipping differences remained report-only with zero mutations, and 1,094
  discovery rows remained outside the approved manifest.
- The public `/pre-workout` response returned `200`, canonical
  `https://www.supplementscout.co.uk/pre-workout` and `index, follow`. Visible
  coverage was 60 products and 269 recently checked offers from three
  retailers, including five products with current offers from multiple
  retailers, exceeding the unchanged 3-product / 2-retailer / 20-offer gate.
- Public JSON-LD contained one CollectionPage, one 60-item ItemList and one
  BreadcrumbList. All 60 positions and canonical product URLs were valid and
  unique, with no bundle product. Schema.org Validator fetched the live URL and
  reported zero errors and zero warnings across all parsed nodes.
- The public homepage linked to `/pre-workout`, and the public sitemap contained
  the canonical URL exactly once. Eleven focused page tests, targeted ESLint,
  TypeScript and `git diff --check` passed for the final artefact.
- Search Console URL inspection remains unrecorded because the authenticated
  report/export blocker documented under SEO-07 still applies; this is not
  represented as a successful inspection.
- SEO-09 is `LIVE VERIFIED`. The next executable implementation is declared in
  the current active-task section above.

### 1 August 2026 — automatic project guardian

- Added one read-only validator for the Operating Plan, this SEO ledger, the
  agent model and the WheyWise review cadence.
- Added fail-closed checks for duplicate IDs, unsupported statuses, multiple
  `IN PROGRESS` tasks, disagreement about the next task and completion without
  evidence.
- Weekly GSC/GA4 and monthly WheyWise age checks are reminders rather than job
  failures, preventing routine missing evidence from producing repeated false
  failure notifications.
- Added a read-only GitHub workflow for relevant pushes/pull requests, Monday
  schedule and manual execution. It receives no secrets and has no production
  path.
- Initial local result: `PASS`; 19 SEO tasks checked; next task `SEO-09`; no
  task in progress; the expected SEO-07 measurement reminder remains visible.
- Seven focused tests passed, including multiple-active-task, plan disagreement,
  unsupported completion, stale-reminder and read-only-boundary cases.
- Independent verification returned `PASS` with no material findings: the
  validator, seven tests, read-only boundary and workflow permissions were
  checked separately.
- Implementation commit `5ee8dd6` was pushed to `main`. GitHub Actions run
  `30687118501` completed successfully for that exact commit, proving the
  automatic push trigger and hosted read-only check work.

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
- Implementation commit: `9f940a2`.
- Public verification confirmed five HTTP 200 Vitamins pages with correct
  canonicals and a continuous next-page link chain. They exposed 114 distinct
  current product URLs: 24 on pages 1–4 and 18 on page 5, with zero cross-page
  duplicates.
- `?page=1` and `?page=0` returned a 307 redirect to `/vitamins`; page 999
  redirected to the real last page, `/vitamins?page=5`.
- Glucosamine, Magnesium, Omega 3 and Vitamin D each currently fit on one page,
  expose respectively 18, 23, 22 and 18 distinct product URLs, and redirect an
  attempted page 2 to the clean category path.
- SEO-04 is `LIVE VERIFIED`.

### 29 July 2026 — SEO-05 local implementation

- Converted the homepage from one page-wide browser component into a Server
  Component. Search, navigation and mobile category expansion remain isolated
  interactive components.
- Active product count, retailer registry count, latest recorded offer check and
  active-product categories are now loaded on the server and included in the
  initial HTML.
- Each data source fails independently through `Promise.allSettled`; a missing
  freshness value cannot hide valid counts, and no failure is converted into a
  fabricated zero.
- Non-fetch database results use four separate one-hour Next.js caches. The
  homepage is statically generated and revalidated hourly rather than querying
  Supabase for every visitor.
- Category retrieval now walks every 1,000-row database page, removing the
  previous implicit category-discovery ceiling.
- The fallback contains an honest temporary-unavailability message and never a
  loading skeleton or zero-value placeholder.
- 34 focused homepage/category/sitemap tests, targeted ESLint, TypeScript and
  the full Next.js production build passed.
- A local production-server HTML check contained 1,111 active catalogue
  products, 9 retailers represented and the truthful latest recorded check
  `2026-07-29T15:47:16.811+00:00` (`29 Jul 2026`). It contained neither loading
  text, skeleton markup nor the fallback message.
- Commit `18d4f21` was pushed to `main`. The production alias continued to
  return the previous cached loading-skeleton HTML during the initial
  post-deployment checks, so live completion was deliberately withheld.
- A recorded pending-deployment checkpoint (`3ff40c7`) retriggered the connected
  deployment integration without changing application behaviour.
- Public HTML then returned HTTP 200 with 1,111 active catalogue products, 9 UK
  retailers represented and `<time
  dateTime="2026-07-29T15:47:16.811+00:00">29 Jul 2026</time>`.
- Loading text, skeleton markup and the fallback message were all absent from
  the initial response. The search input and mobile category expansion control
  remained present.
- SEO-05 is `LIVE VERIFIED`.

### 29 July 2026 — SEO-06 local implementation

- Added a visible, keyboard-accessible `SupplementScout / Product` breadcrumb
  to the public product template and a matching two-item `BreadcrumbList`.
- Added server-rendered native JSON-LD using the canonical product URL, visible
  neutral product summary, known brand and safe crawlable image URL.
- Product snippet eligibility is deliberately fail-closed. `Product` plus
  `AggregateOffer` is emitted only when all valid positive-price in-stock
  offers describe one canonical variant. Multi-variant and no-offer pages emit
  the valid breadcrumb only rather than an incomplete or misleading Product
  rich-result item.
- Aggregate prices use visible product prices, `GBP`, exact valid offer count
  and `InStock`. Delivered totals are not misrepresented as retailer shelf
  prices.
- The markup contains no `seller: SupplementScout`, reviews, ratings,
  price-valid-until date, shipping policy or other unsupported claims.
- JSON-LD serialization escapes `<`, unsafe image protocols are rejected,
  duplicate offer IDs are ignored and placeholder `Unknown brand` is omitted.
- The implementation follows the current official Google product-snippet,
  breadcrumb and general structured-data rules plus the local Next.js JSON-LD
  guide.
- 61 focused product, offer, pricing and structured-data tests passed with zero
  failures. Targeted ESLint, TypeScript and the full production build passed.
- Local production HTML verified a qualifying single-variant Vitamin D product
  with one GBP AggregateOffer at 13.99, no seller and two breadcrumbs. A
  multi-variant Clear Whey product exposed the breadcrumbs but correctly
  omitted the Product/AggregateOffer entity.
- Commit `044e3ea` was pushed to `main` and served by the production site.
- Public HTML for the qualifying Vitamin D example returned the canonical
  Product/AggregateOffer data with GBP 13.99, one offer, no seller claim and
  matching visible/structured breadcrumbs.
- Public HTML for the multi-variant Clear Whey example retained the canonical
  and breadcrumbs while correctly omitting Product/AggregateOffer data.
- Schema.org Validator fetched the live Vitamin D page and detected one Product
  plus one BreadcrumbList with 0 errors and 0 warnings.
- An automated Google Rich Results Test was also attempted, but Google required
  an authenticated interactive session. This is recorded as a tool-access
  limitation rather than represented as a successful Google test.
- SEO-06 is `LIVE VERIFIED`.

### 29 July 2026 — SEO-08 local implementation

- Added the canonical `/whey-protein` Server Component with a direct comparison
  answer, recently checked offer coverage, visible freshness evidence,
  methodology, limitations, stable product links and related comparisons.
- Added one reusable category-comparison core for current and future decision
  pages. It accepts only active, unmerged products and valid mapped in-stock
  offers checked within 24 hours.
- The reviewed Whey scope excludes plant, vegan, beef, collagen, egg,
  casein-only and bundle products even when the broad catalogue category says
  `Whey Protein`. Reviewed whey products with non-obvious names such as ISO-XP,
  ISO100 and IsoPro remain eligible.
- Product offers are ranked by known delivered total. Unknown delivery is never
  treated as free and cannot outrank a complete delivered price.
- Price per kilogram, price per serving and cost per 25 g protein appear only
  when their required package/nutrition evidence is verified. Missing values
  are not estimated.
- The page automatically switches to `noindex, follow` after a data-load failure
  or if comparison coverage falls below its explicit quality gate.
- Added CollectionPage, ItemList and BreadcrumbList structured data without
  presenting listing rows as direct-sale Product entities.
- Added consent-aware GA4 category-view measurement, one sitemap entry and
  prominent internal links from the homepage, Creatine and Hydration pages.
- Production-shaped local HTML returned HTTP 200, `index, follow`, the canonical
  URL, 27 reviewed fresh Whey products, 193 fresh offers, 3 retailers and 5
  multi-retailer products. Known delivery and verified protein value were
  visible; reviewed plant and beef leak examples were absent.
- Focused regression suite: 92 passed, 0 failed. Targeted ESLint, TypeScript,
  full Next.js 16.2.9 production build and `git diff --check` passed.
- Implementation commit `7b3a59f` was pushed to `main` and served by the
  production site.
- Public `/whey-protein` returned HTTP 200, the exact canonical, `index,
  follow`, one sitemap occurrence, a homepage link and the expected
  consent-aware Analytics marker.
- Public data remained at 27 reviewed fresh Whey products, 193 offers, 3
  retailers and 5 multi-retailer products. Known delivery and verified protein
  value remained visible; the controlled plant and beef leak examples remained
  absent.
- Public structured data contained CollectionPage, ItemList and BreadcrumbList
  with 27 matching stable product links. Schema.org Validator fetched the live
  page and reported 0 errors and 0 warnings.
- Search Console inspection could not be recorded from this working session
  because it has no authenticated report view. The already-configured property
  and DNS ownership verification are unchanged; measurement capture remains
  explicitly tracked under SEO-07.
- SEO-08 is `LIVE VERIFIED`.
