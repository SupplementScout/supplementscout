# SupplementScout SEO Execution Plan

**Status date:** 1 August 2026<br>
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
| SEO-04 | P0 | Build crawlable category pagination and internal product links. | `LIVE VERIFIED` | Indexable category pages expose stable anchor links to every eligible product, with canonical pagination and no indexable filter explosion. |
| SEO-05 | P1 | Server-render authoritative home statistics and freshness. | `LIVE VERIFIED` | Initial HTML contains current approved counts and freshness; no loading or zero-value placeholder becomes the search snippet. |
| SEO-06 | P1 | Add product breadcrumbs and valid Product snippet structured data. | `LIVE VERIFIED` | Markup matches visible canonical data, passes automated and external structured-data validation, and never represents SupplementScout as the direct seller. |
| SEO-07 | P0 | Capture the baseline from the already-configured Search Console property and verify the submitted sitemap. | `BLOCKED` | Performance, Page indexing, Sitemaps, Core Web Vitals and Links baselines are recorded and priority URLs are inspected. Blocker: the current working session has no authenticated report view or export; site ownership itself is already verified through DNS. |
| SEO-08 | P1 | Launch the Whey Protein comparison landing page. | `LIVE VERIFIED` | Reviewed data-backed page covers current eligible products/offers, methodology, limitations, update time, internal links, analytics and a Search Console inspection record when authenticated report access is available. |
| SEO-09 | P1 | Launch the Pre Workout comparison landing page. | `LIVE VERIFIED` | Same quality contract as SEO-08; no unsupported formulation or medical claims. |
| SEO-10 | P1 | Publish comparison methodology and data-freshness pages. | `LIVE VERIFIED` | Delivered-price, price-history, unit-value, source and limitation rules are publicly explained and linked from priority pages. |
| SEO-11 | P2 | Normalize brand identities before brand SEO pages. | `PLANNED` | Case/alias splits such as `PER4M` and `Per4m`, plus `Unknown`, are reviewed; only sufficiently covered brands receive indexable pages. |
| SEO-12 | P1 | Begin legitimate authority and backlink acquisition. | `PLANNED` | Priority retailer/brand/community outreach uses useful live resources; earned links and outcomes are recorded monthly; no bulk or paid-link scheme is used. |
| SEO-13 | P1 | Deliver the controlled ten-page high-intent cluster. | `IN PROGRESS` | Ten individually reviewed pages pass the shared quality contract and `LIVE VERIFIED` gate one at a time; no parallel page framework or thin mass generation is introduced. |
| SEO-14 | P1 | Launch eligible brand and retailer landing pages. | `PLANNED` | Identity normalization and minimum coverage/content gates are tested; only useful pages are indexable and every page uses current canonical data. |
| SEO-15 | P1 | Launch a data-backed deals and price-drops page. | `PLANNED` | Existing offers and price history power truthful current deals; discount, delivery, freshness and historical-comparison limitations are visible. |
| SEO-16 | P1 | Launch guarded two-product comparison. | `PLANNED` | Users can compare two canonical products using current variants, offers, delivered prices and verified metrics without fabricated missing values. |
| SEO-17 | P2 | Add owner-reviewed expert decision notes. | `PLANNED` | Expert judgement is clearly labelled and dated, verified facts retain provenance, and unsupported medical or formulation claims cannot publish. |

## 6. Current active task

**Next executable task:** SEO-13 — remediate the recorded coverage blockers
through existing guarded catalogue and retailer mechanisms. All ten candidate
gates have now been reviewed: Amino Acids / BCAA / EAA is live verified and the
other nine candidates are deferred. The existing `/hydration` canonical was
hardened instead of creating a duplicate Electrolytes URL, and the existing
`/creatine` canonical retains Creatine Monohydrate intent instead of creating a
competing URL. Re-run a deferred page gate only after its recorded identity,
offer-volume or multi-retailer blocker materially changes; begin with Protein
Bars when current overlap evidence changes.
Search Console and GA4 are already configured; SEO-07 only awaits an
authenticated report view or export so its measurement baseline can be saved.

**Blocked evidence task:** SEO-02B — capture Search Console evidence before
changing index eligibility for products without a current offer.

The sequence may change only when new Search Console evidence proves a more
urgent indexing blocker. Record that evidence before changing priority.

Follow the binding sequence in Operating Plan section 0.0.7: SEO-13 one page at
a time, SEO-11 and SEO-14, the 250-product multi-retailer checkpoint, SEO-15,
SEO-16 and SEO-17.
SEO-07 measurement and SEO-12 legitimate authority work are continuous evidence
tracks, not permission to run a second implementation.

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

After Pre Workout and the shared SEO-10 methodology support are live, SEO-13
evaluates and delivers this initial cluster in order. A row may be skipped or
deferred only when the recorded evidence gate fails; the next eligible row then
becomes active.

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

### Measurement evidence log

Add one row only from authenticated GSC/GA4 evidence. Do not use estimates or
invent a date to silence the Guardian.

| Date | Type | Evidence | State |
|---|---|---|---|
| — | Weekly GSC/GA4 | Authenticated report view or export is not yet available in the working session. | `BLOCKED` under SEO-07 |

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
