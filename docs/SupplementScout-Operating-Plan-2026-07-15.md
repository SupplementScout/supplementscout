# SupplementScout Operating Plan

**Status date:** 16 July 2026<br>
**Purpose:** One authoritative operating document for architecture, current state, priorities, rules, roadmap, and definitions of done.  
**Replaces:** the older fragmented project brief and decisions scattered across chats.  
**Primary goal:** Build the UK's smartest and most trustworthy supplement search and comparison platform.

---

## 1. Product identity

**Name:** SupplementScout  
**Positioning:** The UK's Smart Supplement Search Engine  
**Mission:** Help people find the best supplements at the best prices.

SupplementScout is not merely a product catalogue or another supplement shop. It is intended to become a structured search, comparison, data and recommendation platform for the UK supplement market.

A successful user journey should answer three questions quickly:

1. What should I buy?
2. Where should I buy it?
3. Why is this the best option for me?

The user should leave thinking:

> This site helped me make a decision.

---

## 2. Long-term product vision

A user should be able to search by:

- exact product,
- brand,
- category,
- ingredient,
- format,
- budget,
- training goal,
- health goal,
- desired outcome.

Examples:

- cheapest whey protein 2 kg,
- best creatine under £20,
- magnesium for cramps,
- supplement for sleep,
- pre-workout without caffeine,
- compare two specific products.

The platform should eventually provide:

- one clean canonical product,
- exact flavour, size and format variants,
- offers from multiple UK retailers,
- product price,
- shipping cost,
- total delivered price,
- stock status,
- price per kilogram,
- price per serving,
- price per gram of protein,
- cost per 25 g protein,
- cost per 5 g creatine,
- historical prices,
- lowest recorded price,
- ingredient and dosage comparison,
- product pros and cons,
- similar products,
- better-value alternatives,
- AI-assisted recommendations,
- a simple “Help me choose” flow based on two or three questions.

---

## 3. Business model

Planned revenue streams:

- affiliate links,
- clearly labelled sponsored placements,
- paid retailer accounts,
- API access for other websites,
- price and market reports for brands and manufacturers,
- future mobile application.

The first commercial engine is affiliate traffic. The first data advantage is a clean, variant-aware, multi-retailer catalogue with reliable delivered prices.

---

## 4. Core strategic principle

Do not optimise for the number of products alone.

A more valuable catalogue has:

- accurate identity,
- current prices,
- current stock,
- exact variants,
- multiple retailers,
- useful images,
- measurable user interest.

Prefer:

> 100 products with three active retailers

rather than:

> 300 products with one retailer and weak identity.

The milestone of 200 new variants/offers is a technical and operational confidence milestone, not the final business objective.

---

## 5. System architecture

### 5.1 Retailer source layer

Retailer feeds, APIs, exports and storefront sources provide external data such as:

- source product name,
- source variant name,
- external product ID,
- external variant ID,
- SKU,
- GTIN,
- options,
- stock,
- price,
- shipping,
- image,
- product URL.

Current important sources:

- Discount Supplements,
- Fit House,
- Whey Okay.

Future sources may include additional UK retailers. eBay is explicitly postponed.

External data is untrusted until it passes identity and integrity checks.

### 5.2 Canonical catalogue layer

The canonical catalogue is the platform’s own clean product model.

Main tables:

- `products`
- `product_variants`

A canonical product represents one exact product family and pack identity. A canonical variant represents the exact flavour, size, count or format beneath that product.

Examples:

- product: Optimum Nutrition Serious Mass 5.4 kg
- variants: Banana / 5.4 kg, Chocolate / 5.4 kg, Vanilla / 5.4 kg

Canonical identity must not be changed automatically by routine price updates.

### 5.3 Retailer mapping layer

Main table:

- `retailer_products`

This layer states:

> This exact retailer variant corresponds to this exact canonical variant.

Important identity fields include:

- retailer ID,
- product ID,
- product variant ID,
- external product ID,
- external variant ID,
- SKU,
- external options,
- source URL.

### 5.4 Offer and history layer

Main tables:

- `offers`
- `price_history`

These store volatile commercial data:

- price,
- shipping,
- delivered total,
- stock,
- offer URL,
- price history.

Offer data may change frequently. Canonical identity should not.

### 5.5 Import safety layer

The approved pipeline is:

```text
snapshot
→ integrity validation
→ classification
→ dry-run
→ immutable artifact + SHA
→ read-only validation
→ approval ledger
→ staging apply
→ staging verification
→ production freshness check
→ production approval
→ production apply
→ production verification
→ public UI smoke test
```

Core principles:

- fail closed,
- no guessing,
- one exact artifact per approval,
- separate staging and production approvals,
- consumed approvals cannot be replayed,
- no direct mapping or offer inserts outside the approved pipeline,
- new products and variants remain review-only,
- routine automation may update only safe volatile fields.

### 5.6 Public application layer

The production site currently supports:

- canonical product pages,
- slug and ID routing,
- one retailer card per retailer,
- multiple variant chips within one retailer card,
- correct offer selection after changing variant,
- Best UK Price,
- delivered price,
- retailer and offer counts,
- mobile layout,
- outbound click tracking through `/go/<offer-id>`.

---

## 6. Technology stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase
- PostgreSQL
- Vercel
- GitHub
- Docker for PostgreSQL integration tests
- OpenAI API planned for future AI functionality

### Production

- Domain: `supplementscout.co.uk`
- Branch: `main`
- Supabase production ref: `aftboxmrdgyhizicfsfu`

### Staging

- Supabase persistent database branch ref: `hxnrsyyqffztlvcrtgbf`
- Name: SupplementScout Staging
- Region: `eu-west-3`

Old staging refs must not be reused:

- `dlsbwshkzdsvzubjftbv` was removed
- `tyyxhnoyelvarwdymvss` was outdated and incompatible

---

## 7. Current production state

Latest confirmed production counts after Whey Okay Medium Batch 3 canonical deployment and reduced reconciliation apply:

- `products`: 755
- `product_variants`: 1069
- `retailer_products`: 982
- `offers`: 981
- `price_history`: 990

Current catalogue expansion milestone:

- progress: **200 / 200**
- remaining: **0**

Production `SAFE_UPDATE` automation remains disabled.

---

## 8. What has been completed

### 8.1 Infrastructure and deployment

Completed:

- production Next.js deployment,
- Supabase production database,
- active staging clone/branch,
- GitHub repository and `main` workflow,
- Vercel deployment,
- versioned migrations,
- baseline verification,
- Docker/PostgreSQL migration tests.

### 8.2 Canonical data model

Completed:

- products,
- product variants,
- retailers,
- retailer mappings,
- offers,
- price history,
- duplicate/merge foundations,
- default and non-default variant model,
- variant-aware identity handling.

### 8.3 Safe import pipeline

Completed:

- atomic import RPC,
- approval ledger,
- immutable artifacts and sidecar SHA,
- source and plan fingerprints,
- staging and production approvals,
- consumed approval replay protection,
- standard import operation type,
- legacy mapping upgrade RPC,
- read-only validators,
- format, flavour, size, servings and count evidence handling,
- parser and approval normalization for:
  - `ready_to_drink` / `liquid`,
  - `snack`,
  - servings and count evidence.

### 8.4 Retailer UI

Completed:

- one card per retailer,
- multiple variants inside a retailer card,
- correct CTA per selected offer,
- Best UK Price using real offers,
- correct retailer and offer counts,
- mobile-safe variant chips,
- single-variant products without unnecessary controls.

### 8.5 Discount Supplements

Completed:

- full Shopify snapshot,
- pagination and integrity validation,
- Stage 1 scheduled dry-run,
- classification of existing, new and conflicting records,
- Batch A–E imports,
- exact external variant IDs,
- price, shipping, stock, URL and source option preservation.

Stage 1 currently performs:

- snapshot,
- classification,
- read-only production lookup,
- importer dry-run,
- reporting.

It does not perform production writes.

### 8.6 Fit House

Completed:

- working Shopify adapter/source,
- CSV and live Shopify comparison,
- Batch F canonical catalogue work,
- Batch F image work, including 12 verified canonical image backfills,
- Batch F 36 production mappings/offers/history,
- RTD, snack and servings evidence support,
- public UI verification for Batch F.

Fit House is not yet in a scheduled update workflow.

### 8.7 Whey Okay

Completed:

- authoritative full CSV analysis,
- catalogue structure audit,
- stable EKM key discovery,
- identification of legacy mapping problem,
- standalone legacy mapping upgrade tooling,
- optioned legacy mapping upgrade tooling for Flavour-only plus parent-size evidence,
- historical `total_price = null` support for optioned identity-only offer updates,
- 10-row standalone legacy mapping pilot using one-row approvals.

Authoritative export findings:

- 538 products,
- 1,706 sellable variants,
- 1,009 in stock,
- 697 out of stock,
- all 1,706 variants have images.

Current problem:

- 383 legacy mappings still require reconciliation,
- many legacy mappings still have no external product IDs,
- many legacy mappings still have no external variant IDs,
- many legacy mappings still have no external options,
- many legacy mappings point to default variants.

The first controlled Whey Okay reconciliation pilot, Batch 2.1, Batch 3, reduced Batch 4, the reduced optioned pilot, the final Easy optioned cleanup and reduced Medium Batches 1-3 have completed for 137 total legacy mappings. The remaining 383 legacy mappings must be reconciled before automated updates or EKM-based automation.

---

## 9. Completed catalogue batches

### Batch A

- 25 canonical variants
- 25 Discount Supplements mappings/offers/history

### Batch B

- 25 canonical variants
- 25 Discount Supplements mappings/offers/history

### Batch C

- 31 canonical variants
- 31 Discount Supplements mappings/offers/history

### Batch D

- 6 new canonical products
- 40 source flavour variants
- 46 `product_variants` including six technical defaults
- 40 Discount Supplements mappings/offers/history

### Batch E

- 19 approved production mappings/offers/history
- 17 ambiguous records excluded fail-closed

### Batch F

- canonical catalogue and image preparation completed
- 12 canonical `products.image` backfills verified for products 742-750 and 753-755
- products 751 and 752 remain manual image review with `image = null`
- 36 Fit House mappings/offers/history applied successfully
- public UI smoke test passed
- final production counts confirmed

Milestone arithmetic:

- previous milestone progress: 115 / 200
- Batch F added: 36
- current progress: **151 / 200**

Technical default variants created for new products do not count toward the 200 source-variant milestone.

### Batch G

- canonical catalogue deployed:
  - 18 new canonical products
  - 67 `product_variants`
  - 18 technical default variants
  - 49 reviewed source variants
- reduced production offer apply completed:
  - 47 Fit House mappings
  - 47 Fit House offers
  - 47 price history rows
- replacement production apply completed:
  - 2 additional Fit House mappings
  - 2 additional Fit House offers
  - 2 additional price history rows
  - GYM HIGH Whey Pro Synergy 600g Banana and Strawberry variants
- 2 reviewed records remain `MANUAL_REVIEW` and were excluded from apply:
  - 7Nutrition Beta-Alanine 250g
  - Applied Nutrition L-Glutamine Powder 250g
- exclusion reason:
  - Shopify source variant was `Default Title`,
  - no explicit flavour evidence,
  - mapping to non-default canonical variant `Unflavoured / 250g` did not satisfy the fail-closed identity contract.
- public UI smoke test passed for Batch G product families and the final replacement product page.

Milestone arithmetic:

- previous milestone progress: 151 / 200
- Batch G applied source offers: 47
- Batch G replacement source offers: 2
- current progress: **200 / 200**

Technical default variants and unapplied manual-review variants do not count toward the 200 source-variant/offer milestone.

---

## 10. Current known issues and gaps

### 10.1 200 milestone complete

The 200 source-variant/offer milestone is complete. Do not enable `SAFE_UPDATE` automatically as a result; it still requires separate review and explicit approval.

Immediate post-milestone priority is the **Commercial Coverage Sprint**: add high-confidence offers from additional retailers to increase multi-retailer coverage, public usefulness and affiliate readiness. The remaining Whey Okay reconciliation and its existing review queues are preserved but paused until the sprint checkpoint.

### 10.2 Whey Okay reconciliation

This remains the largest open reconciliation project, but it is currently **PAUSED** during the Commercial Coverage Sprint. Existing classifications and review queues must be preserved unchanged. Resume after the sprint checkpoint, or earlier only if a documented commercial or data-safety reason justifies it.

Completed:

- standalone legacy mapping upgrade RPC/tooling,
- 10 standalone legacy mappings upgraded with stable EKM identity,
- Whey Okay reconciliation Batch 2.1 with 25 additional standalone mappings enriched,
- Whey Okay reconciliation Batch 3 with 25 additional standalone mappings enriched,
- Whey Okay reconciliation reduced Batch 4 with 10 additional standalone mappings enriched,
- product_format evidence fix for optioned Whey Okay artifacts,
- reduced optioned Whey Okay pilot with 8 additional mappings enriched,
- final Easy optioned cleanup with 1 additional mapping enriched,
- Whey Okay Medium Batch 1 canonical seed with 25 active non-default canonical variants,
- reduced Whey Okay Medium Batch 1 reconciliation with 24 additional mappings enriched,
- Whey Okay Medium Batch 2 canonical seed with 25 active non-default canonical variants,
- reduced Whey Okay Medium Batch 2 reconciliation with 24 additional mappings enriched,
- Whey Okay Medium Batch 3 canonical seed with 19 active non-default canonical variants,
- reduced Whey Okay Medium Batch 3 reconciliation with 10 additional mappings enriched,
- one-row approval/apply pattern verified on staging and production,
- approval replay protection verified.

Remaining:

- 383 legacy mappings still require reconciliation.
- The final Medium audit covers all 75 original mappings exactly once: 58 `RECONCILED`, 2 `PACK_COUNT_REVIEW`, 5 `FORMAT_REVIEW`, 1 `IDENTITY_CONFLICT`, 9 `MANUAL_REVIEW`, and 0 `DUPLICATE`/`EXCLUDE`.
- The 17 unresolved Medium mappings are fully classified:
  - `PACK_COUNT_REVIEW`: `retailer_product_id` 179 (Clif Bar Energy Bar 12x68g) and 172 (Optimum Nutrition Protein Crisp Bar 10x65g),
  - `FORMAT_REVIEW`: `retailer_product_id` 358 (Love Vegan Protein Bite), 367 (Grenade Carb Killa Protein Spread), 499 (Medi-Evil Creatine Monohydrate Shots Powder), 472 (High5 Energy Drink with Protein), and 323 (High5 Energy Gel),
  - `IDENTITY_CONFLICT`: `retailer_product_id` 483 (Applied Nutrition Creatine Gummies; unresolved count/servings identity),
  - `MANUAL_REVIEW` for incomplete external identity evidence: `retailer_product_id` 178, 183, 535, 455, 450, 484, 421, 230, and 129.
- Eleven Medium mappings have seeded canonical variants but remain unresolved: `retailer_product_id` 179, 358, 178, 183, 535, 455, 450, 484, 421, 230, and 129.
- Six mappings still require a specialised or reviewed canonical seed: `retailer_product_id` 172, 367, 499, 472, 323, and 483. Each is explicitly blocked in a named review queue; no ordinary seed candidate remains unclassified.

Batch 2.1 excluded these records because dry-run required complete external identity evidence:

- `retailer_product_id` 368, EKM 2184, Natures Aid Iron Bisglycinate 14mg 90 Tablets,
- `retailer_product_id` 102, EKM 518, Time 4 Creatine Blend 240 caps,
- `retailer_product_id` 406, EKM 3105, Solgar Omega 3-6-9 Fish, Flax, Borage 60 Softgels.

Batch 4 excluded these records because dry-run required complete external identity evidence:

- `retailer_product_id` 418, EKM 3083, Reflex Nutrition Creapure Creatine 90 Capsules,
- `retailer_product_id` 444, EKM 3428, KIOR Health KSM-66 Ashwagandha+ 60 Caps.

Further Batch 4 candidate records after the first 10 were not processed.

Reduced optioned pilot exclusions:

- `retailer_product_id` 191 remains in canonical variant review because the required target canonical variant is missing,
- `retailer_product_id` 150 remains in flavour manual review because source flavour `Orange Cooler` is not the same as canonical `Orange`.

Final Easy optioned cleanup:

- `retailer_product_id` 482, EKM 3908, Lenny & Larry Fitzels Pretzels 85g `Everything Bagel`, was applied on staging and production,
- `retailer_product_id` 409 remains in flavour manual review because source flavour `Apple` is not the same as canonical `Apple & Cherry`.

Known problem cases include:

- Gold Standard Whey legacy 2.26/2.27 kg versus current 2 kg,
- Critical Whey legacy 2.27 kg versus current 2 kg,
- duplicate NXT Cream of Rice listings,
- existing mappings without external variant identity.

### 10.3 Images

A prior audit found 14 active canonical products without images:

- 12 had exact packshots suitable for automated backfill,
- 2 Diet Whey products required manual image selection.

Batch F image backfill has been verified:

- products 742-750 and 753-755 have exact approved canonical image URLs,
- migration `20260715230000_seed_fit_house_batch_f_catalog_and_backfill_images.sql` performed the backfill,
- commit `49ca31c` introduced the migration,
- staging and production both contain the migration once in the ledger.

Open image work:

- product 751, Applied Nutrition Diet Whey Protein 1.8kg, remains `MANUAL_IMAGE_REVIEW`,
- product 752, Applied Nutrition Diet Whey Protein 1kg, remains `MANUAL_IMAGE_REVIEW`.

Root architectural issue:

- canonical UI reads `products.image`,
- retailer mappings do not provide a persistent image fallback,
- some new-product migrations historically omitted `products.image`.

### 10.4 Analytics

Currently tracked with confidence:

- outbound retailer clicks through `/go/<offer-id>`.

Not yet fully confirmed or implemented:

- visits,
- page views,
- traffic sources,
- search queries,
- zero-result searches,
- product views,
- variant selections,
- filter use,
- Search Console performance,
- Vercel Analytics status.

### 10.5 Automation

Discount Supplements Stage 1 is read-only and successful.

Not yet enabled:

- automatic production `SAFE_UPDATE`,
- Fit House scheduled Stage 1,
- Whey Okay automated source.

### 10.6 Temporary scripts and process repetition

Many batch generators and reports live in `tmp/`.

Repeated logic should gradually move into:

- stable adapters,
- shared helpers,
- tested orchestrators,
- custom Codex skills,
- a documented standard batch command.

### 10.7 Retailer Import Control Plane

The read-only architecture audit confirmed that the current importer, normalized feed contract, matching guards, dry-run artifacts, validator, approval ledger and atomic apply RPC are the approved reusable core. A durable Retailer Import Control Plane and `/admin/imports` remain the accepted long-term architecture for import runs, review queues and decisions.

Status: **ARCHITECTURE APPROVED, IMPLEMENTATION DEFERRED**.

Do not implement the control plane during the Commercial Coverage Sprint. Reconsider it after two or three completed retailer imports, or earlier if manual handling becomes a clear bottleneck. Do not create a second importer, approval ledger, validator or apply mechanism.

---

## 11. Operating rules

These rules are mandatory unless explicitly changed by the owner.

### 11.1 Before any new task

Always check whether the feature, rule, migration or helper already exists.

Do not duplicate previous work.

### 11.2 Data safety

- Staging before production.
- Fail closed on mismatch.
- No `migration repair` unless separately reviewed and explicitly approved.
- No force push.
- No direct production writes outside approved mechanisms.
- No reuse of staging approval IDs in production.
- No reuse of consumed approvals.
- No automatic creation of canonical products by routine update automation.
- No weakening identity guards to make a batch pass.

### 11.3 Identity safety

Identity must consider:

- exact product family,
- brand,
- generation/version,
- formula,
- flavour,
- size,
- weight,
- servings,
- count,
- format,
- bundle status,
- sample status,
- multipack status,
- external product and variant IDs.

### 11.4 Automation boundaries

Future `SAFE_UPDATE` may update only approved existing mappings and volatile fields such as:

- price,
- shipping,
- total price,
- stock,
- URL,
- SKU,
- GTIN,
- external options,
- source timestamps,
- image only under a separately approved image contract.

It may not automatically change:

- canonical product,
- canonical variant,
- product ID,
- product variant ID,
- retailer identity,
- external variant identity,
- product family,
- formula,
- format.

### 11.5 Production approval wording

A production write must have an explicit scope. Approval for one batch or artifact does not authorise another.

---

## 12. Priority roadmap

Work should proceed sequentially. Do not open all projects at once.

Current priority order:

1. Run the Commercial Coverage Sprint, one retailer at a time.
2. Hold a checkpoint after two or three new retailers or five to eight working days, whichever occurs first.
3. Decide at the checkpoint whether to continue the current method or resume the Retailer Import Control Plane.
4. Resume the remaining 383 Whey Okay legacy mappings after the sprint or an earlier justified checkpoint.
5. Establish an automatic Whey Okay source through EKM API or an authorised feed only after reconciliation resumes and the source contract is reviewed.
6. Keep scheduled price/stock updates and `SAFE_UPDATE` deferred until a separate phase, repeated clean runs and explicit approval.
7. Retain images, analytics and comparison value features in the queue.

## Commercial Data Expansion and Competitive Response

The **Commercial Coverage Sprint** remains the current priority. Use [Retailer Data Source Registry](Retailer-Data-Source-Registry.md) as the operational registry for retailer data-source decisions and [WheyWise Competitive Intelligence Analysis](Competitive-Intelligence/WheyWise-Analysis-2026-07.md) as supporting competitive intelligence; this Operating Plan remains the single source of truth for project direction.

The primary metric is the number of canonical products with offers from at least two active retailers. Expand coverage in this order: (1) existing CSV files and feeds, (2) affiliate feeds, (3) existing or shared platform adapters, and (4) a retailer-specific scraper only when none of the earlier options exists. Before building anything new, verify whether the required integration, adapter, parser, helper or rule already exists and reuse it where safe.

Every import must preserve the approved separation of canonical products, variants, retailer mappings and offers, including offer-specific price history. Do not pursue an artificial product count at the expense of identity, variant accuracy, offer quality or auditability. Do not start AI work, new admin panels or large automation work during this sprint.

After this documentation update, the next operational task is to select the next retailer from the existing CSV files and complete its source and reuse audit before import work begins.

## Commercial Coverage Sprint

**Status:** ACTIVE

**Business objective:** Increase multi-retailer coverage, useful price comparisons, affiliate readiness and catalogue authority as quickly as the existing safety pipeline permits.

Operating method:

1. Accept retailer CSV files already received.
2. Before processing a source, check for an existing adapter, parser or helper that can be reused.
3. Work on exactly one retailer at a time.
4. Prioritise existing canonical products, especially products with one active retailer that can gain a second or third.
5. Prefer popular products and categories, in-stock rows, exact flavour/size/count/format identity and working affiliate URLs.
6. Apply high-confidence rows first through the existing approved pipeline.
7. Give every isolated conflict a final, specific review status.
8. Allow a safe reduced batch when isolated conflicts do not affect the remaining records.
9. Never weaken identity guards to increase batch size.
10. Apply on staging before production and complete public and affiliate QA before closing a retailer.

Definition of done for each retailer:

- source file and SHA recorded,
- adapter/reuse audit completed,
- complete inventory classified,
- safe records applied through the existing dry-run, validator, approval and atomic apply pipeline,
- every conflict has a final status,
- staging and production verified,
- public product pages smoke-tested,
- delivered prices and retailer URLs verified,
- affiliate tracking verified or its absence explicitly recorded,
- coverage metrics and deltas recorded,
- this Operating Plan updated before the next retailer starts.

Commercial coverage baseline to record before the first new retailer:

- products with one active retailer,
- products with two active retailers,
- products with three or more active retailers,
- active offers,
- in-stock offers,
- products with valid affiliate links,
- outbound clicks,
- affiliate revenue, if available.

At the first checkpoint, assess coverage growth, import speed, conflict volume, public usefulness, affiliate readiness, whether the current manual method still scales and whether to resume the Retailer Import Control Plane.

One active stage rule:

- exactly one retailer may be active at a time,
- do not start the Retailer Import Control Plane workbench, EKM automation, `SAFE_UPDATE` or another large Whey Okay reconciliation batch in parallel,
- update this Operating Plan after every retailer,
- start the next retailer only after the current retailer meets its definition of done.

Out of scope during the sprint:

- a new importer or separate application,
- `/admin/imports`,
- new approval, validator or apply mechanisms,
- EKM automation,
- scheduled production updates,
- `SAFE_UPDATE`.

### Project Control Board

| Workstream | Status | Current state | Resume trigger | Next action |
|---|---|---|---|---|
| Commercial Coverage Sprint | ACTIVE | Existing safe importer and retailer adapters are ready for controlled CSV batches | Ends or is reassessed at the first sprint checkpoint | Select and audit the highest-commercial-value retailer CSV already received |
| Whey Okay reconciliation | PAUSED | 137/520 reconciled; 383 remain; Medium 75/75 classified | Sprint completion or earlier justified checkpoint | Preserve current classifications and review queues |
| Retailer Import Control Plane | ARCHITECTURE APPROVED, IMPLEMENTATION DEFERRED | Existing architecture audited; no implementation started | Two or three retailers completed, or manual processing becomes a clear bottleneck | Reassess the minimal durable control-plane scope |
| EKM automation | DEFERRED | No production EKM adapter; current normalized/import pipeline is reusable | Whey Okay reconciliation resumes and source/API contract is approved | Later build acquisition only, reusing the current pipeline |
| `SAFE_UPDATE` | DISABLED | Classification exists; automatic production apply remains off | Separate reviewed phase after repeated clean runs and explicit approval | No action during the sprint |
| Analytics | QUEUED | Outbound clicks exist; broader baseline is incomplete | Commercial sprint checkpoint or a dedicated analytics phase | Record available coverage and affiliate baseline metrics |
| Images/catalogue quality | QUEUED | 12 backfills verified; products 751 and 752 remain manual review | After the active retailer closes or at a prioritised quality checkpoint | Preserve the two manual image tasks |
| Comparison value features | QUEUED | Product and delivered-price foundations exist | Stable retailer coverage and analytics | Do not implement during the sprint |

## Phase 0: operating control

**Status:** in progress and maintained through this document.

Actions:

1. Keep this document current.
2. Use it as the first reference in new chats and Codex sessions.
3. Maintain one active priority and a short queued list.
4. Update counts, refs, completed batches and decisions after every major milestone.

Definition of done:

- one current source of truth,
- no conflicting roadmap across chats,
- clear current task, next task and deferred list.

## Phase 1: finish the 200 milestone with value

**Current:** 200 / 200
**Remaining:** 0

Selection priority:

1. cross-retailer coverage,
2. existing canonical products,
3. in-stock products,
4. popular categories,
5. multiple flavours in one family,
6. new products only with high-confidence identity.

Do not lower identity quality merely to reach 200.

Definition of done:

- approximately 200 high-quality source variants/offers added,
- all production mappings verified,
- all public pages smoke-tested,
- no unresolved import blockers,
- final catalogue quality report.

## Phase 2: catalogue quality and images

Actions:

1. Resolve the two manual Diet Whey images.
2. Enforce image handling for every future new canonical product.
3. Define image priority:
   - existing canonical image,
   - verified manufacturer packshot,
   - approved exact retailer packshot,
   - placeholder.
4. Never overwrite an approved canonical image automatically.

Done:

- 12 approved Batch F image backfills are present and verified on staging and production.
- Public product pages and search/card rendering passed smoke checks for those 12 products.

Definition of done:

- no unexplained blank product images,
- image provenance known,
- future new-product pipeline requires an image decision,
- automated backfill limited to null/empty canonical images and exact identity.

## Phase 3: Whey Okay reconciliation

**Status:** PAUSED during the Commercial Coverage Sprint.

This remains a defined data project after the 200 milestone. All existing classifications and review queues remain authoritative; no large reconciliation batch should run in parallel with the active retailer.

### Step A: parent-product reconciliation

For the remaining legacy mappings:

- map current EKM product ID,
- verify parent URL,
- classify exact, drifted, duplicate, ambiguous, removed.

### Step B: variant reconciliation

- assign EKM variant ID,
- capture flavour, size, count and format,
- map to exact canonical variant,
- create missing canonical variants only after review.

### Step C: controlled legacy mapping upgrades

Use the existing legacy mapping upgrade RPC and approval model.

Pilot status:

- 70 standalone legacy mappings have been upgraded successfully,
- continue with larger but still reviewable sequential one-row approval batches,
- do not use a multi-row artifact unless separately reviewed and approved.

### Step D: automatic source

Preferred source order:

1. EKM Partner API v2 with merchant OAuth,
2. merchant-authorised scheduled Google Shopping/feed URL,
3. storefront scraping only as a last fallback.

Definition of done:

- all safe legacy mappings have stable EKM identity,
- all ambiguous mappings are separated for review,
- automatic full snapshot works,
- no manual CSV upload is required for routine updates.

## Phase 4: retailer automation

### Discount Supplements

- observe Stage 1 reports,
- review false positives and missing cases,
- enable production `SAFE_UPDATE` only after explicit approval.

### Fit House

- build scheduled full snapshot and Stage 1 dry-run,
- use Shopify product/variant IDs,
- maintain independent security boundary.

### Whey Okay

- automate only after reconciliation.

Definition of done:

- daily source snapshots,
- source integrity checks,
- safe updates for existing approved mappings,
- new products and variants remain review-only,
- clear alerting for missing-from-source and identity drift.

## Phase 5: analytics foundation

Minimal stack:

1. Vercel Web Analytics for visits and page views,
2. Google Search Console for organic visibility,
3. anonymous first-party business events for:
   - search performed,
   - zero-results search,
   - product viewed,
   - variant selected,
   - retailer offer clicked,
   - Best UK Price clicked.

GA4 is optional later and should not be added before privacy/consent is reviewed.

Definition of done:

- know whether real users are visiting,
- know what they search for,
- know which products and offers attract attention,
- know which searches return no results,
- use evidence to prioritise catalogue and UX work.

## Phase 6: comparison value features

After catalogue freshness and analytics are stable:

1. price per kilogram,
2. price per serving,
3. cost per 25 g protein,
4. cost per 5 g creatine,
5. price history charts,
6. lowest recorded price,
7. better filtering and sorting,
8. similar products,
9. better-value alternatives.

Before implementing each feature, verify whether it already exists anywhere in the codebase.

## Phase 7: AI decision assistant

Build only when product data is sufficiently structured.

Target experience:

- one “Help me choose” button,
- two or three simple questions,
- ranked recommendations,
- clear reasoning,
- dosage and value explanation,
- no unsupported medical claims.

---

## 13. Immediate active plan

### Current active task

Run the **Commercial Coverage Sprint** using the existing approved import pipeline, with exactly one retailer active at a time.

### Next task

Select and audit the highest-commercial-value retailer CSV already received, prioritising product overlap and affiliate readiness.

### Then

1. Close that retailer completely, including staging, production, public QA, affiliate QA, metrics and this document update.
2. Start the next retailer only after the previous retailer is closed.
3. Hold the checkpoint after two or three retailers or five to eight working days, whichever occurs first.
4. At the checkpoint, decide whether to continue the sprint or resume the Retailer Import Control Plane.
5. Resume Whey Okay reconciliation, EKM work, scheduled updates and `SAFE_UPDATE` only according to the Project Control Board.

### Deferred near-term

Create two custom Codex skills:

1. `SupplementScout Retailer Import Operations`
2. `SupplementScout Images & Catalog Quality`

These should encode stable operating rules and reduce repeated long prompts, but must not run in parallel with the active retailer.

---

## 14. Explicitly deferred

Do not start these now:

- eBay integration,
- mobile app,
- retailer self-service portal,
- paid listings,
- public API,
- advanced GA4 implementation,
- broad AI assistant,
- autonomous creation of new canonical products,
- unprioritised retailers outside the controlled Commercial Coverage Sprint,
- large frontend redesign.

---

## 15. Key project metrics

### Catalogue quality

Track:

- active products,
- canonical variants,
- products without images,
- default-only products with variant evidence,
- duplicates,
- identity conflicts,
- inactive and merged products.

### Retailer coverage

Track:

- products with one active retailer,
- products with two active retailers,
- products with three or more active retailers,
- active offers,
- in-stock offers,
- stale offers.

### Data freshness

Track:

- last successful snapshot per retailer,
- source row counts,
- source errors,
- price changes,
- stock changes,
- missing-from-source findings,
- blocked identity cases.

### User value

Track:

- visits,
- product views,
- searches,
- zero-result searches,
- variant selections,
- outbound clicks,
- Best UK Price clicks,
- click-through rate to retailers.

### Business progress

Track:

- indexed pages,
- organic impressions,
- organic clicks,
- affiliate clicks,
- affiliate revenue,
- retailer coverage growth.

---

## 16. Definition of a healthy production system

SupplementScout is healthy when:

- canonical identity is clean,
- multiple retailers are represented accurately,
- prices and stock are fresh,
- broken sources fail closed,
- new identity never appears automatically without review,
- user-visible images are present and trustworthy,
- UI links to the exact selected offer,
- approvals are auditable and non-replayable,
- staging matches production architecture,
- user behaviour can be measured without unnecessary personal data,
- roadmap work is chosen by value rather than novelty.

---

## 17. Decision log snapshot

Current binding decisions:

- Finish 200 high-quality variants/offers before production `SAFE_UPDATE`.
- Current progress is 200 / 200.
- eBay is postponed.
- Commercial Coverage Sprint is the sole active workstream and processes one retailer at a time.
- Whey Okay reconciliation is paused at 137/520 with all 383 remaining mappings and current review queues preserved.
- Whey Okay automation comes after reconciliation resumes; EKM acquisition must reuse the current normalized/import pipeline.
- Whey Okay standalone pilot, Batch 2.1, Batch 3, reduced Batch 4, reduced optioned pilot, final Easy optioned cleanup and reduced Medium Batches 1-3 upgraded 137 total legacy mappings; 383 remain.
- Retailer Import Control Plane is the approved long-term architecture, but implementation is deferred until the sprint checkpoint or a demonstrated manual-processing bottleneck.
- Fit House and Discount Supplements should become automated through staged, fail-closed workflows.
- New products and variants remain review-only.
- Scheduled price/stock updates remain deferred.
- `SAFE_UPDATE` remains disabled until a separate phase, repeated clean runs and explicit approval.
- Do not duplicate already completed work.
- Build the two custom SupplementScout skills later, not in parallel with the active retailer.
- Do not run many major initiatives in parallel.

---

## 18. Changelog

### 2026-07-15

- Batch F production PASS.
- Progress is 151 / 200.
- 36 Fit House mappings/offers/history added.
- 12 canonical images verified.
- 2 Diet Whey images remain manual.
- `SAFE_UPDATE` still disabled.
- Batch G canonical catalog deployed: 18 products and 67 product variants.
- Reduced Batch G production offer apply PASS: 47 Fit House mappings/offers/history added.
- Progress is 198 / 200.
- 2 Batch G records remain manual review due to missing explicit source flavour evidence.
- Next step is to find two safe replacement records, then begin Whey Okay reconciliation.
- `SAFE_UPDATE` still disabled.
- Batch G replacement production PASS: 2 additional Fit House mappings/offers/history added for GYM HIGH Whey Pro Synergy 600g.
- Progress is 200 / 200.
- 200 source-variant/offer milestone complete.
- Next priority is Whey Okay reconciliation.
- `SAFE_UPDATE` still disabled.
- Whey Okay standalone legacy mapping pilot PASS: 10 one-row upgrades applied on staging and production.
- Whey Okay reconciliation Batch 2.1 PASS: 25 additional one-row upgrades applied on staging and production.
- Total Whey Okay legacy mappings reconciled: 35.
- Remaining Whey Okay legacy mappings: 485.
- Batch 2.1 excluded retailer_products 368, 102 and 406 due to incomplete external identity evidence.
- Whey Okay reconciliation Batch 3 PASS: 25 additional one-row upgrades applied on staging and production.
- Total Whey Okay legacy mappings reconciled: 60.
- Remaining Whey Okay legacy mappings: 460.
- Batch 3 had no new incomplete-evidence exclusions; higher-risk candidates were left out fail-closed.
- Whey Okay reconciliation reduced Batch 4 PASS: 10 additional one-row upgrades applied on staging and production.
- Total Whey Okay legacy mappings reconciled: 70.
- Remaining Whey Okay legacy mappings: 450.
- Batch 4 excluded retailer_products 418 and 444 due to incomplete external identity evidence.
- Further Batch 4 candidate records were not processed after the reduced 10-row PASS set.
- Optioned Whey Okay tooling PASS: Flavour-only plus parent-size evidence, identity-only mapping/offer variant movement, and historical null total support are deployed.
- Product format evidence fix for optioned artifacts PASS: all 8 final records had source `product_format = powder` evidence.
- Reduced optioned Whey Okay pilot PASS: 8 additional mappings applied on staging and production.
- Total Whey Okay legacy mappings reconciled: 78.
- Remaining Whey Okay legacy mappings: 442.
- `retailer_product_id` 191 remains canonical variant review; `retailer_product_id` 150 remains flavour manual review.
- Final Easy optioned cleanup PASS: `retailer_product_id` 482 applied on staging and production.
- Total Whey Okay legacy mappings reconciled: 79.
- Remaining Whey Okay legacy mappings: 441.
- `retailer_product_id` 409 remains flavour manual review because source flavour `Apple` does not exactly match canonical `Apple & Cherry`.
- Continue reconciliation in larger sequential one-row approval batches; do not enable Whey Okay automation yet.
- `SAFE_UPDATE` still disabled.

### 2026-07-16

- Whey Okay Medium Batch 1 canonical seed DONE: 25 active non-default canonical variants deployed on staging and production.
- Reduced Whey Okay Medium Batch 1 reconciliation PASS: 24 mappings and their offers moved from the expected default variants to matching canonical variants on staging and production.
- `retailer_product_id` 179, EKM variant 1007, was excluded after `conflicting variant evidence: size` and moved to `PACK_COUNT_REVIEW`; its canonical `Blueberry Crisp / 12x68g` variant remains active.
- Total Whey Okay legacy mappings reconciled: 103.
- Remaining Whey Okay legacy mappings: 417.
- Medium remaining legacy mappings: 51; 50 require canonical variant seeds and 1 requires pack-count reconciliation.
- Prices, shipping, totals, stock, URLs, clicks and price history remained unchanged.
- `SAFE_UPDATE` still disabled.
- Whey Okay Medium Batch 2 canonical seed DONE: 25 active non-default canonical variants deployed on staging and production.
- Reduced Whey Okay Medium Batch 2 reconciliation PASS: 24 mappings and their offers moved from the expected default variants to matching canonical variants on staging and production.
- `retailer_product_id` 358, EKM variant 1897, was excluded after `format conflict` and moved to `FORMAT_REVIEW`; its canonical `Cookies and Cream / 45g` variant remains active.
- `retailer_product_id` 483 remains excluded with unresolved count/servings identity and was not included in the canonical seed.
- Total Whey Okay legacy mappings reconciled: 127.
- Remaining Whey Okay legacy mappings: 393.
- Medium remaining legacy mappings: 27; 25 require canonical variant seeds and 2 have seeded-but-unresolved canonical variants (`rp179` pack-count review and `rp358` format review).
- Prices, shipping, totals, stock, URLs, clicks and price history remained unchanged.
- `SAFE_UPDATE` still disabled.
- Whey Okay Medium Batch 3 canonical seed DONE: 19 active non-default canonical variants deployed on staging and production.
- Reduced Whey Okay Medium Batch 3 reconciliation PASS: 10 mappings and their offers moved from the expected default variants to matching canonical variants on staging and production.
- Nine seeded mappings (`rp178`, `rp183`, `rp535`, `rp455`, `rp450`, `rp484`, `rp421`, `rp230`, `rp129`) remain `MANUAL_REVIEW` because dry-run correctly required complete external identity evidence; no approval was created for them.
- Final Medium audit: 75/75 classified, comprising 58 `RECONCILED`, 2 `PACK_COUNT_REVIEW`, 5 `FORMAT_REVIEW`, 1 `IDENTITY_CONFLICT`, 9 `MANUAL_REVIEW`, and 0 `DUPLICATE`/`EXCLUDE`.
- Total Whey Okay legacy mappings reconciled: 137.
- Remaining Whey Okay legacy mappings: 383.
- Prices, shipping, totals, stock, URLs, last-checked timestamps, clicks and price history remained unchanged during Batch 3 reconciliation.
- `SAFE_UPDATE` still disabled.
- Architecture decision: the Retailer Import Control Plane remains the approved long-term direction, but its implementation is deferred.
- Commercial Coverage Sprint is now the active business priority to increase multi-retailer coverage, public usefulness, affiliate traffic readiness and commercial potential.
- Remaining Whey Okay reconciliation is paused at 137/520 with 383 mappings and all current review queues preserved.
- The sprint will process one retailer at a time through the existing importer, validator, approval ledger, staging and production apply pipeline.
- First checkpoint is after two or three new retailers or five to eight working days, whichever occurs first.
- EKM automation, scheduled price/stock updates and `SAFE_UPDATE` remain deferred; `SAFE_UPDATE` remains disabled.

---

## 19. How to use this document

At the start of every new project chat or Codex session:

1. Read this Operating Plan.
2. Confirm current production and staging refs.
3. Check whether the planned work already exists.
4. State the one active task.
5. State what is explicitly out of scope.
6. Work through staging before production.
7. Update this document after a major milestone.

This document should remain concise enough to operate from, but complete enough to prevent the project from fragmenting across conversations.
