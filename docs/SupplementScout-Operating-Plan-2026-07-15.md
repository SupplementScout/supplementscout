# SupplementScout Operating Plan

**Status date:** 19 July 2026<br>
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

Latest confirmed production counts after the Jon's Supplements rollout:

- `products`: 760
- `product_variants`: 1098
- `retailer_products`: 1008
- `offers`: 1007
- `price_history`: 1016

Latest product-level commercial coverage snapshot, counting distinct retailers with an in-stock offer for each active, unmerged canonical product:

- active canonical products: 759,
- products with at least one active retailer: 605,
- products with at least two active retailers: 63,
- products with at least three active retailers: 3,
- products with at least four active retailers: 0.

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

The read-only architecture audit confirmed that the current importer, normalized feed contract, matching guards, dry-run artifacts, validator, row-level approval ledger and atomic apply RPC are the approved reusable core. The parent/child Retailer Import Control Plane is now implemented as the orchestration layer above that reusable core; it is not a second importer, validator, row-level approval ledger or business apply mechanism.

Status: **PHASES 1, 2 AND 3 COMPLETE; STAGING MIGRATIONS AND POST-MIGRATION READINESS COMPLETE; CANARY DRY-RUN DESIGN AND FRESH SOURCE REFRESH NEXT**.

Retailer Snapshot Bulk Import Phase 1 completed the read-only framework: 10 JSON contracts, 64 reason codes, 20 stable `RSBI_*` errors, `RSBI-CJ1` fingerprints, deterministic classification, parent/child plan builders, deterministic 50/100 partitioning, validators and review queue JSON/CSV. The full Jon's snapshot reproduced the frozen baseline without differences and made no Supabase writes. Commit: `53446ce6ed755f484e25551a757d4d0161e8a290`.

Phase 2 completed the control-ledger migration with three control tables, 11 public lifecycle RPCs and six internal functions. Parent/child lifecycle, locking, approval expiry, approval consumption, replay protection, resume and rollback metadata were first validated behind a local-only runtime guard. The implementation task made no business-table, staging or production writes. Commit: `94d1bf56991485a682a6eda4bce628229e614579`. The reviewed control-ledger schema was later deployed to staging by Task 6 Migration A.

### Retailer Snapshot Phase 3 — COMPLETE

Phase 3 completed the local bounded child-batch business executor. It reuses Phase 1 row plans, the Phase 2 parent/child lifecycle, the existing read-only validator, the existing row-level approval ledger and the existing atomic apply RPC. It performs no direct business-table DML. Child execution is transactional: a failed row plan or exact expected-delta mismatch rolls back the entire child, including generated and consumed row approvals. Replay protection and concurrency locking are tested.

Hard environment guards restrict execution to explicitly authorised disposable local PostgreSQL databases. The executor intentionally rejects staging, production, Supabase hosts and protected database identities; its local-only boundary must not be weakened. The 10-row local canary, 50-row child, mid-child rollback, delta-mismatch rollback, replay and concurrency tests passed. Full regression passed 600/600. Staging writes and production writes remained zero. Commit: `6a754f0e7c942dde550e029056e15f940aa56b3a`.

The separate stale product presentation test cleanup passed 64/64 presentation tests and is recorded in commit `2bc6a8c82c191b1bf935fdcf61fc5cd3296638b7`. It is not part of the Phase 3 implementation.

### Staging Migration Task 6 — COMPLETE

- Migration A was applied and validated on staging.
- Migration B was applied and validated on staging.
- Runner V2 used the whole-query path; the defective replacement-string path was not reused.
- Source, executed and migration-ledger text SHA-256 equality was confirmed for both migrations.
- Final staging migration count: 27.
- Final staging migration fingerprint: `2c36d09244f4c81f0727ad50dd62fad21c9c8037aee66342eed0662037d3081a`.
- Eight control/staging tables, the required functions and the staging roles were created.
- RLS, forced RLS, grants, indexes, constraints, owners, function security boundaries and `search_path` were validated.
- Business-table deltas were zero.
- No approval, parent plan, child plan, dry-run, apply run or recovery was created.
- Production connections, reads and writes were zero.

The first Task 6 attempt is historical only: it failed before `COMMIT`, rolled back safely and changed no persistent staging state. Its runner root cause was fixed, its package was superseded and a fresh immutable package authorised the successful retry.

### Post-Migration Readiness Review — COMPLETE

Result: **READY FOR CANARY DRY-RUN DESIGN**.

- Schema readiness: **PASS**.
- Migration readiness: **PASS**.
- Role/grants readiness: **PASS**.
- Empty control-plane readiness: **PASS**.
- Fixture identity readiness: **PASS WITH CONDITIONS**.
- Expected delta readiness: **PASS**.
- Stale approval readiness: **PASS WITH CONDITIONS**.
- Recovery readiness: **PASS**.

The 10-record fixture still matches staging: seven existing mapping/offer no-ops are unchanged and three proposed mappings remain absent. Expected deltas remain retailers 0, products +2, product variants +2, retailer products +3, offers +3 and price history +3. The conditions are a fresh live source refresh before dry-run artifacts, continued alternate-identity review for the Conteh record without GTIN and non-reuse of the eight expired approvals.

The next bounded task is **Canary Dry-Run Design and Fresh Source Refresh**. It may refresh and freeze source evidence and design dry-run artifacts, but it must stop without executing a dry-run, creating an approval or applying any plan.

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
2. Complete **Canary Dry-Run Design and Fresh Source Refresh** without executing a dry-run, creating an approval or applying a plan.
3. Revalidate the real Jon's 10-record fixture, GTIN and alternate identity evidence, exact deltas, target binding, migration fingerprint and recovery boundary before requesting a separate dry-run execution task.
4. Hold the Commercial Coverage Sprint checkpoint after two or three new retailers or five to eight working days, whichever occurs first.
5. Resume the remaining 383 Whey Okay legacy mappings after the sprint or an earlier justified checkpoint.
6. Establish an automatic Whey Okay source through EKM API or an authorised feed only after reconciliation resumes and the source contract is reviewed.
7. Keep scheduled price/stock updates and `SAFE_UPDATE` deferred until a separate phase, repeated clean runs and explicit approval.
8. Retain images, analytics and comparison value features in the queue.

## Commercial Data Expansion and Competitive Response

The **Commercial Coverage Sprint** remains the current priority. Use [Retailer Data Source Registry](Retailer-Data-Source-Registry.md) as the operational registry for retailer data-source decisions and [WheyWise Competitive Intelligence Analysis](Competitive-Intelligence/WheyWise-Analysis-2026-07.md) as supporting competitive intelligence; this Operating Plan remains the single source of truth for project direction.

The primary metric is the number of canonical products with offers from at least two active retailers. Expand coverage in this order: (1) existing CSV files and feeds, (2) affiliate feeds, (3) existing or shared platform adapters, and (4) a retailer-specific scraper only when none of the earlier options exists. Before building anything new, verify whether the required integration, adapter, parser, helper or rule already exists and reuse it where safe.

Every import must preserve the approved separation of canonical products, variants, retailer mappings and offers, including offer-specific price history. Do not pursue an artificial product count at the expense of identity, variant accuracy, offer quality or auditability. Do not start AI product or assistant implementation, new admin panels or large automation implementation during this sprint; bounded SEO and AI citation-readiness work remains required.

The first retailer selected from the existing CSV files was Jon's Supplements. Its pilot and initial production rollout are complete, and the exact 26-existing-offer staging automation apply passed. The consolidated production readiness review is **NOT READY** because production-targeted executor/validator migrations do not yet exist, production roles/logins and target attestations are absent, and the repository retailer slug differs from production. The next operational task is the bounded design and review of those real production blockers, stopping before every production migration, login, attestation, validator, approval or apply action.

## Jon's Supplements current state

**Status:** PILOT AND INITIAL PRODUCTION ROLLOUT COMPLETE; 26-OFFER STAGING AUTOMATION PASS; PRODUCTION AUTOMATION NOT READY

- The Shopify CSV and public Shopify JSON were audited with an exact source join.
- The Jon's adapter is complete and pushed.
- Retailer ID 10 exists on staging and production as `Jon's Supplements` / `jon-s-supplements` / `https://jonssupplements.co.uk`.
- Shipping is GBP 3.99 below GBP 90 and free from GBP 90.
- Per4m Mult Vita+Min and TBJP Oh Mega Pharma Pro production rollouts are complete.
- Canonical family seeds are complete for PER4M EAA Xtra 420g, PER4M Pre-Workout Stim 570g and PER4M Creatine Sherbet 310g.
- The three seeded families have 24 Jon's flavour mappings, offers and price-history rows on staging and production: EAA 10, Pre-Workout 9 and Creatine Sherbet 5.
- The current production retailer total is 5 canonical products, 24 flavour variants, 26 mappings, 26 offers and 26 price-history rows. All 26 offers are in stock.
- The exact 26-existing-offer staging apply passed: 26 `last_checked_at` updates at source capture `2026-07-19T09:33:56.316Z`; price, shipping, stock, URL, mapping and price-history deltas were all zero; the approval was consumed and the recovery manifest is ready.
- The production readiness review found ledger 25 with fingerprint `ba5d4c8581b185d5412fa4f41a3cbeacf40547f507e124962f922d4aa71772b0`; the six repo-parity migrations after it are staging-bound and are not an authorised production migration set.
- Production roles/logins, target attestations and a production-bound read-only mixed-batch validator are absent. Repository slug `jons-supplements` also differs from production slug `jon-s-supplements`; these findings must be resolved through a separate reviewed task.
- The five Jon's product families each moved from zero to one active retailer. The rollout did not yet increase the primary two-retailer coverage metric.
- Excluded or deferred: Strawberry Lime because of a shared SKU; five out-of-stock variants; Project AD unresolved; Protein Bars deferred; PER4M Whey deferred for later bulk processing.
- `SAFE_UPDATE` remains disabled.

## Retailer Snapshot Bulk Import Strategy

Do not continue importing large retailer catalogues one product at a time.

For large Shopify retailers:

1. Freeze one complete source snapshot.
2. Calculate immutable source hashes.
3. Classify every record as `safe existing match`, `safe new product`, `safe new variant`, `ambiguous`, `blocked` or `out of stock`.
4. Import only safe records.
5. Quarantine ambiguous and blocked records.
6. Use family- or catalogue-level canonical seeds where necessary.
7. Use large mapping, offer and price-history batches.
8. Validate on staging.
9. Roll out to production in controlled bulk operations.
10. Add scheduled Shopify synchronization after the initial bulk import and a separate automation review.

The Jon's pilot proved the adapter workflow, immutable artifacts, approval ledger, atomic apply, rollback, idempotency, retailer reuse, family-level canonical seeds and multi-row offer rollout. Further Jon's work must use this bulk snapshot strategy. This changes batch scope, not the safety contract: canonical products and variants remain reviewed, ambiguous data remains quarantined, and staging and production approvals remain separate.

Implementation status:

- **Phase 1 — COMPLETE:** read-only snapshot, classification, deterministic plans, validators and review artifacts; commit `53446ce6ed755f484e25551a757d4d0161e8a290`.
- **Phase 2 — COMPLETE:** parent/child control ledger, lifecycle RPCs, concurrency controls, resume and rollback metadata were validated locally in commit `94d1bf56991485a682a6eda4bce628229e614579`; the reviewed control schema is now deployed on staging through Migration A.
- **Phase 3 — COMPLETE:** local bounded child-batch executor reusing the existing row plans, Phase 2 lifecycle, read-only validator, row-level approval ledger and atomic apply RPC. It has no direct business-table DML; transactional rollback, exact deltas, replay, concurrency and local-only environment guards passed. Full regression: 600/600. Staging and production writes: zero. Commit `6a754f0e7c942dde550e029056e15f940aa56b3a`.
- **Staging executor framework — COMPLETE:** Migration B deployed the staging-only roles, target and migration-ledger guards, approval wrappers, bounded executor and recovery framework. Task 6 validated the schema without invoking an executor RPC.
- **Post-migration readiness review — COMPLETE:** schema, migration, role/grant, empty-state, expected-delta and recovery readiness passed; fixture and stale-approval readiness passed with the fresh-source and non-reuse conditions recorded below.
- **Exact 26-offer staging apply — COMPLETE:** one whole-stage approval covered the exact 26 existing offers; apply succeeded with 26 timestamp-only refreshes, zero commercial/identity/history deltas, consumed approval and ready recovery manifest.
- **Production readiness review — NOT READY:** production data and fresh source are exact at 26/26 with `VERIFY_NO_CHANGE ×26`, but no production-compatible executor/validator migration set, roles/logins or attestations exist, and the retailer slug contract is inconsistent.
- **Presentation test cleanup — COMPLETE, separate from Phase 3:** stale product presentation expectation fixed; presentation tests 64/64. Commit `2bc6a8c82c191b1bf935fdcf61fc5cd3296638b7`.

Before any write-bearing Jon's rollout, GTIN enrichment and canonical-creation proposals require separate review. Staging and production remain separate approval boundaries. Within each boundary, use one approval for the whole reviewed stage rather than fragmented per-step approvals.

### Blockers before canary dry-run execution

The earlier staging migration and readiness blockers are resolved: a real 10-record fixture is sealed, the staging executor framework is deployed, Migration A and B are validated, the control plane is empty and bounded recovery objects are present. Those completed reviews do not authorise dry-run execution or approval creation.

Every condition below is mandatory before a separately authorised canary dry-run execution:

- acquire a fresh Shopify source,
- acquire fresh CSV/GTIN enrichment,
- freeze fresh source hashes,
- capture a fresh staging canonical snapshot,
- revalidate prices and stock,
- confirm all 10 records are still in stock,
- confirm no external identity collisions,
- confirm no canonical collisions,
- confirm the staging migration fingerprint remains `2c36d09244f4c81f0727ad50dd62fad21c9c8037aee66342eed0662037d3081a`,
- confirm the code commit is unchanged or explicitly rebind every generated artifact to the reviewed replacement commit,
- regenerate the fixture fingerprint if any source field changes,
- recalculate exact expected deltas,
- preserve the eight expired approvals as non-reusable,
- keep `SAFE_UPDATE=false` or unset.

The design task must freshly confirm GTIN evidence for nine records and the documented alternate identity for the Conteh record without GTIN. It must compare source drift and canonical drift, design immutable dry-run artifacts and stop. No dry-run execution, approval, parent/child plan creation or apply is permitted in that task.

Any later approval must remain fingerprint-bound, exact-target-specific, short-lived, single-use and replay-protected. Staging canary apply, production canary and production bulk rollout remain separate approval boundaries.

## SEO and AI Search Visibility

SEO and AI-search visibility are a permanent parallel growth workstream. Every working day should include:

1. one primary product, data, retailer or engineering task,
2. one completed SEO or AI-search visibility task.

The visibility goal covers Google Search, Google AI Overviews and AI Mode, Bing and Copilot, ChatGPT Search, Gemini and other AI answer engines.

Evaluate every major page or feature against three questions:

1. Does it help the user make a decision?
2. Can it rank in traditional search?
3. Can an AI system understand and cite it accurately?

This workstream improves the discoverability and citation quality of the existing product; it does not authorise building the deferred AI decision assistant.

## AI Citation Readiness

Important pages require:

- a direct answer near the top,
- clear headings matching real user questions,
- factual comparison tables,
- visible calculation methodology,
- a last-updated date,
- source provenance,
- explicit uncertainty and limitations,
- stable canonical URLs,
- valid structured data,
- strong internal linking,
- server-rendered HTML,
- no unsupported marketing claims,
- no thin mass-generated content.

Priority page types are category pages, brand pages, product pages with multiple retailer offers, price and value comparisons, ingredient and dosage comparisons, methodology pages and best-for-goal pages.

## Parallel growth rule

Do not postpone SEO until catalogue coverage is complete. Coverage, SEO and AI citation readiness must grow together, while only one primary product, data, retailer or engineering task is active at a time.

## Commercial Coverage Sprint

**Status:** ACTIVE

**Business objective:** Increase multi-retailer coverage, useful price comparisons, affiliate readiness and catalogue authority as quickly as the existing safety pipeline permits.

Operating method:

1. Accept retailer CSV files and complete retailer snapshots already received.
2. Before processing a source, check for an existing adapter, parser or helper that can be reused.
3. Work on exactly one retailer at a time, using catalogue-level classification and safe bulk batches rather than a product-by-product catalogue process.
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

At the first checkpoint, assess coverage growth, import speed, conflict volume, public usefulness, affiliate readiness and the evidence from the implemented control ledger and completed Phase 3 local executor tests.

One active stage rule:

- exactly one retailer may be active at a time,
- do not start a staging/production bulk executor rollout, EKM automation, `SAFE_UPDATE` or another large Whey Okay reconciliation batch in parallel,
- update this Operating Plan after every retailer,
- start the next retailer only after the current retailer meets its definition of done.

Out of scope during the sprint:

- a new importer or separate application,
- `/admin/imports`,
- replacement approval ledgers, validators or atomic apply mechanisms,
- canary dry-run execution, approval creation and staging or production apply,
- EKM automation,
- scheduled production updates,
- `SAFE_UPDATE`.

### Project Control Board

| Workstream | Status | Current state | Resume trigger | Next action |
|---|---|---|---|---|
| Commercial Coverage Sprint | ACTIVE | Jon's initial rollout, Retailer Snapshot Phases 1-3, staging migrations and post-migration readiness are complete | Ends or is reassessed at the first sprint checkpoint | Run Canary Dry-Run Design and Fresh Source Refresh without dry-run execution |
| Whey Okay reconciliation | PAUSED | 137/520 reconciled; 383 remain; Medium 75/75 classified | Sprint completion or earlier justified checkpoint | Preserve current classifications and review queues |
| Retailer Snapshot Phase 1 | COMPLETE | Read-only framework, deterministic classification/plans and review artifacts reproduce the Jon's baseline | Complete | Reuse unchanged |
| Retailer Snapshot Phase 2 | COMPLETE | Three-table parent/child ledger and lifecycle runtime passed local validation and the schema is deployed on staging | Complete | Reuse as the control layer |
| Retailer Snapshot Phase 3 | COMPLETE | Local bounded executor passes transactional, delta, replay, concurrency and local-environment tests; staging and production writes remain zero | Complete | Preserve its intentional local-only boundary |
| Task 6 staging migrations | COMPLETE | Migration A and B applied through runner V2; final ledger count 27 and fingerprint sealed | Complete | Do not rerun or reuse the migration package |
| Post-migration readiness | COMPLETE | Readiness verdict is READY FOR CANARY DRY-RUN DESIGN | Complete | Preserve the zero-row control-plane baseline |
| Canary Dry-Run Design and Fresh Source Refresh | NEXT | Real 10-record fixture is sealed; live source evidence now requires refresh | Post-migration readiness complete | Refresh source evidence and design artifacts; stop before dry-run execution |
| Canary Dry-Run Execution | BLOCKED | Not authorised and fresh design artifacts do not yet exist | Fresh-source design review complete and separate explicit authorisation | No execution in the design task |
| Approval Creation | BLOCKED | No canary approval package is authorised | Successful separately authorised dry-run and a further reviewed approval task | Create nothing now |
| Staging Canary Apply | BLOCKED | Not authorised | Successful reviewed dry-run, fresh approval package and separate explicit approval | No apply in the design or dry-run task |
| Production Canary | DEFERRED | No staging canary evidence or production approval exists | Successful reviewed staging canary and separate explicit approval | No action now |
| Scheduled Sync | DEFERRED | No bulk scheduled apply is authorised | Successful canaries, repeated clean runs and separate automation approval | Keep disabled |
| Jon's canary source and GTIN refresh | REQUIRED | Frozen fixture has nine exact GTINs and one reviewed alternate identity; live evidence is not fresh | Before dry-run execution | Refresh Shopify, CSV/GTIN, price, stock and identity evidence |
| Real Jon's 10-record fixture | COMPLETE WITH REFRESH CONDITION | Exact fixture is sealed and still matches staging | Regenerate if any source field changes | Rebind only after fresh source comparison |
| Bounded recovery framework | COMPLETE FOR READINESS | Recovery tables and target/expiry/replay/shared-state guards exist; no recovery was invoked | Before apply, bind an exact manifest and approval in a separate task | Do not invoke recovery now |
| `/creatine` SEO page | PRIORITY QUEUED | First priority SEO page; content/data contract is prepared, but no route is implemented | Separate reviewed SEO implementation task | Preserve as the first priority page; do not implement in this task |
| EKM automation | DEFERRED | No production EKM adapter; current normalized/import pipeline is reusable | Whey Okay reconciliation resumes and source/API contract is approved | Later build acquisition only, reusing the current pipeline |
| `SAFE_UPDATE` | DISABLED | Classification exists; automatic production apply remains off | Separate reviewed phase after repeated clean runs and explicit approval | No action during the sprint |
| Analytics | QUEUED | Outbound clicks exist; broader baseline is incomplete | Commercial sprint checkpoint or a dedicated analytics phase | Record available coverage and affiliate baseline metrics |
| Images/catalogue quality | QUEUED | 12 backfills verified; products 751 and 752 remain manual review | After the active retailer closes or at a prioritised quality checkpoint | Preserve the two manual image tasks |
| Comparison value features | QUEUED | Product and delivered-price foundations exist | Stable retailer coverage and analytics | Do not implement during the sprint |

The numbered programme roadmap below predates the Retailer Snapshot Bulk Import phase sequence. Its labels are retained for historical continuity; references to completed **Retailer Snapshot Phase 3** do not mean the paused legacy Whey Okay roadmap phase.

## Legacy roadmap Phase 0: operating control

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

## Legacy roadmap Phase 1: finish the 200 milestone with value

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

## Legacy roadmap Phase 2: catalogue quality and images

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

## Legacy roadmap Phase 3: Whey Okay reconciliation

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

## Legacy roadmap Phase 4: retailer automation

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

## Legacy roadmap Phase 5: analytics foundation

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

## Legacy roadmap Phase 6: comparison value features

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

## Legacy roadmap Phase 7: AI decision assistant

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

Resolve the real Jon's production automation blockers through design and review only, with no production writes. Keep exactly one primary retailer/data implementation active at a time alongside the daily SEO and AI-search visibility workstream.

### Next task

Design and review a production-targeted control/executor/validator migration set and resolve the Jon's retailer-slug contract drift. The design must preserve target identity, migration-ledger binding, semantic source binding, dedicated roles, atomicity, replay protection and recovery readiness. Stop before migration, login, attestation, validator, approval or apply execution.

### Then

1. Produce production-specific migrations and contracts; do not redirect or weaken staging-only guards.
2. Review and test them locally, including exact migration fingerprints, roles, attestations, validator replay and recovery boundaries.
3. Request one explicit approval for the whole production migration stage; later stages each receive one whole-stage approval.
4. After migrations, separately provision and verify the three restricted production logins and exact attestations.
5. Run a production-bound read-only 26-row validator only under a separate authorised stage, then build a fresh immutable rollout package.
6. Apply the exact 26-offer production refresh only after a later explicit whole-stage approval and exact preflight.
7. After Jon's is closed, freeze infrastructure work unless a real blocker appears; continue with the next retailer, multi-retailer coverage and `/creatine` indexing readiness.
8. Resume Whey Okay reconciliation, EKM work, scheduled updates and `SAFE_UPDATE` only according to the Project Control Board.

### Deferred near-term

Create two custom Codex skills:

1. `SupplementScout Retailer Import Operations`
2. `SupplementScout Images & Catalog Quality`

These should encode stable operating rules and reduce repeated long prompts, but must not run in parallel with the active retailer.

---

## 14. Explicitly deferred

Do not start these now:

- canary dry-run execution,
- approval creation,
- staging canary apply,
- production canary apply,
- production bulk rollout for the remaining Jon's catalogue,
- scheduled retailer synchronization,
- committed-batch rollback automation,
- cleanup of the eight expired approvals,
- admin review UI and `/admin/imports`,
- automated canonical merge,
- automatic deletion or deactivation,
- affiliate automation,
- shipping discovery,
- full catalogue family rollout,
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
- Commercial Coverage Sprint is the primary active product/data workstream and processes one retailer at a time; SEO and AI-search visibility run alongside it as a bounded daily growth workstream.
- Large retailer catalogues must use the Retailer Snapshot Bulk Import strategy rather than continuing product by product.
- Jon's initial rollout is complete: 5 products, 24 flavour variants, 26 mappings, 26 offers and 26 price-history rows on production; the remaining catalogue is deferred to the bulk snapshot workflow.
- Whey Okay reconciliation is paused at 137/520 with all 383 remaining mappings and current review queues preserved.
- Whey Okay automation comes after reconciliation resumes; EKM acquisition must reuse the current normalized/import pipeline.
- Whey Okay standalone pilot, Batch 2.1, Batch 3, reduced Batch 4, reduced optioned pilot, final Easy optioned cleanup and reduced Medium Batches 1-3 upgraded 137 total legacy mappings; 383 remain.
- Retailer Snapshot Phases 1, 2 and 3 are complete locally; the framework, control plane and bounded local business executor are no longer deferred.
- Phase 3 completed in commit `6a754f0e7c942dde550e029056e15f940aa56b3a`; its local-only boundary remains intentional and must not be weakened.
- The stale product presentation test cleanup is separate from Phase 3 and completed in commit `2bc6a8c82c191b1bf935fdcf61fc5cd3296638b7`.
- Task 6 staging migrations are complete: Migration A and B are applied and validated, with final ledger count 27 and fingerprint `2c36d09244f4c81f0727ad50dd62fad21c9c8037aee66342eed0662037d3081a`.
- The post-migration readiness review is complete with verdict **READY FOR CANARY DRY-RUN DESIGN**.
- Historical state before the 26-offer staging pass: the immediate next task was **Canary Dry-Run Design and Fresh Source Refresh**. This was completed and superseded on 2026-07-19.
- The exact 26-offer staging apply passed, while the consolidated production readiness review is **NOT READY** due to missing production-targeted migrations, roles/logins, attestations and validator plus retailer-slug contract drift.
- The next authorised boundary is production migration/contract design and review only. No production migration, login, attestation, validator, approval, apply or recovery is authorised.
- Use one approval per whole reviewed stage. After Jon's production closure, freeze infrastructure unless a real blocker exists, then move to the next retailer, multi-retailer coverage and `/creatine` indexing readiness.
- The Phase 3 local executor cannot be redirected to staging; the deployed staging framework retains separate target-specific roles, guards and approval boundaries.
- The real 10-record fixture is sealed and matches staging, subject to a fresh live-source, price, stock, GTIN and alternate-identity refresh before dry-run execution.
- The bounded recovery framework is deployed and readiness-audited; an exact canary recovery manifest and approval remain later apply-stage boundaries.
- The eight expired approvals are non-reusable and cleanup remains a separate deferred maintenance task.
- No canary dry-run, approval or apply may occur without fresh source hashes, a fresh staging canonical snapshot, recalculated deltas and a reviewed fixture fingerprint.
- Staging canary, production canary and production bulk rollout each require later, separate review and explicit approval.
- No staging apply is allowed without a real 10-record fixture, GTIN and canonical identity review, exact approved deltas and an approved recovery decision.
- Fit House and Discount Supplements should become automated through staged, fail-closed workflows.
- New products and variants remain review-only.
- Scheduled price/stock updates remain deferred.
- `SAFE_UPDATE` remains disabled until a separate phase, repeated clean runs and explicit approval.
- Do not duplicate already completed work.
- Build the two custom SupplementScout skills later, not in parallel with the active retailer.
- Do not run many major initiatives in parallel.
- Do not postpone SEO until catalogue coverage is complete; coverage, SEO and AI citation readiness grow together.

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
- Historical decision, superseded later on 2026-07-17: at this point the Retailer Import Control Plane remained the approved long-term direction and its implementation was still deferred.
- Commercial Coverage Sprint is now the active business priority to increase multi-retailer coverage, public usefulness, affiliate traffic readiness and commercial potential.
- Remaining Whey Okay reconciliation is paused at 137/520 with 383 mappings and all current review queues preserved.
- The sprint will process one retailer at a time through the existing importer, validator, approval ledger, staging and production apply pipeline.
- First checkpoint is after two or three new retailers or five to eight working days, whichever occurs first.
- EKM automation, scheduled price/stock updates and `SAFE_UPDATE` remain deferred; `SAFE_UPDATE` remains disabled.

### 2026-07-17

- Jon's Supplements adapter, staging pilot and initial production rollout completed.
- Retailer ID 10 now has 5 products, 24 flavour variants, 26 mappings, 26 offers and 26 price-history rows; all 26 offers are in stock.
- Per4m Mult Vita+Min and TBJP Oh Mega Pharma Pro production rollouts completed.
- Canonical family seeds and 24-row staging/production offer rollouts completed for PER4M EAA Xtra 420g, PER4M Pre-Workout Stim 570g and PER4M Creatine Sherbet 310g.
- Strawberry Lime, five OOS variants, unresolved Project AD, Protein Bars and PER4M Whey remain explicitly excluded or deferred.
- Post-rollout product coverage is 605 products at one or more active retailers, 63 at two or more, 3 at three or more and 0 at four or more, across 759 active canonical products.
- The five Jon's product families each moved from zero to one active retailer; none moved into multi-retailer coverage.
- Retailer Snapshot Bulk Import is now the required strategy for the remaining Jon's catalogue.
- SEO and AI-search visibility became a permanent daily parallel growth workstream; the AI decision assistant remains deferred.
- Historical context: at the start of 2026-07-17, the immediate next task was to design, but not implement, the reusable Retailer Snapshot Bulk Import workflow; that earlier instruction was superseded by the completed Phase 1, Phase 2 and Phase 3 work recorded below.
- Retailer Snapshot Bulk Import Phase 1 completed in commit `53446ce6ed755f484e25551a757d4d0161e8a290`: read-only framework, 10 JSON contracts, 64 reason codes, 20 stable errors, deterministic classification/plans, validators and review artifacts reproduced the Jon's baseline with no Supabase writes.
- Retailer Snapshot Bulk Import Phase 2 completed in commit `94d1bf56991485a682a6eda4bce628229e614579`: three control tables, 11 public lifecycle RPCs, six internal functions, locking, expiry, replay protection, resume and rollback metadata passed disposable-PostgreSQL tests with no business-table, staging or production writes.
- Retailer Snapshot Bulk Import Phase 3 completed in commit `6a754f0e7c942dde550e029056e15f940aa56b3a`: the bounded local child-batch executor reuses Phase 1 plans, Phase 2 lifecycle, the read-only validator, row-level approvals and atomic apply without direct business-table DML.
- Phase 3 local tests passed for a synthetic 10-row canary, 50-row child, mid-child rollback, delta-mismatch rollback, replay and concurrency; full regression passed 600/600, with zero staging and production writes.
- The separate presentation test cleanup completed in commit `2bc6a8c82c191b1bf935fdcf61fc5cd3296638b7`; presentation tests passed 64/64. This cleanup is not part of Phase 3.
- The Phase 3 executor remains intentionally local-only. Its synthetic canary does not authorise or sufficiently prove staging readiness.
- Historical state at the close of 2026-07-17: committed-batch business rollback remained unresolved and only failed-child transactional rollback was proven. This was superseded on 2026-07-18 by the deployed, readiness-audited bounded recovery framework; an exact recovery manifest and approval are still required before apply.
- Historical next task at the close of 2026-07-17: the Staging Canary Readiness and Design Review. This was completed and superseded on 2026-07-18.
- No staging apply may occur without an approved real 10-record Jon's fixture, GTIN and canonical identity review, exact expected deltas, target-specific approvals, migration readiness and a committed-batch recovery decision.
- `SAFE_UPDATE` remains disabled.

### 2026-07-18

- The first Task 6 attempt failed before `COMMIT` and rolled back safely; staging migration count, schema and business state remained unchanged.
- Root cause was JavaScript replacement-string handling in the migration runner. Runner V2 fixed the boundary with whole-query execution, callback replacement and parameterised ledger text.
- The failed package was marked `SUPERSEDED_AFTER_FAILED_ATTEMPT`; a fresh immutable package was issued and separately authorised.
- Task 6 retry passed: Migration A and Migration B were applied and validated on staging.
- Source, executed and ledger migration text SHA-256 values matched for both migrations.
- Final staging migration count is 27 and fingerprint is `2c36d09244f4c81f0727ad50dd62fad21c9c8037aee66342eed0662037d3081a`.
- Eight control/staging tables, required functions and staging roles are deployed; RLS, forced RLS, grants, constraints, indexes, owners and security boundaries passed.
- Business-table deltas were zero; no approvals, plans, dry-runs, apply runs or recoveries were created; production was untouched.
- The read-only post-migration readiness review passed with verdict **READY FOR CANARY DRY-RUN DESIGN**.
- The next task is **Canary Dry-Run Design and Fresh Source Refresh**. No dry-run execution, approval creation or apply is allowed without a fresh live source, CSV/GTIN enrichment, source hashes, staging canonical snapshot, price/stock validation, drift comparison, recalculated deltas and regenerated fixture binding when required.
- `SAFE_UPDATE` remains disabled.

### 2026-07-19

- Jon's exact 26-existing-offer staging apply PASS: 26 `last_checked_at` updates using source capture `2026-07-19T09:33:56.316Z`; price, shipping, stock, offer URL, mapping URL and price-history deltas were zero.
- The staging apply succeeded, its one whole-stage approval was consumed, recovery manifest state is ready, and production was untouched.
- Fresh production/source audit confirmed retailer ID 10, 26 mappings, 26 offers, no duplicate or incomplete identity, Shopify coverage 26/26 and `VERIFY_NO_CHANGE ×26`.
- Production readiness verdict: **NOT READY FOR JON'S PRODUCTION ROLLOUT APPROVAL**. Production ledger is 25; the existing six later repo migrations reproduce staging ledger 31 but contain staging-only guards and are not a valid production rollout set.
- Missing production capabilities: production-specific control/executor/validator/expiry-close migrations, validator/approver/executor roles and logins, both target attestations, a production-bound read-only validator, and a resolved retailer-slug contract.
- Next authorised boundary: design and review those blockers only. No production migration, login, attestation, validator, approval, apply or recovery is authorised.
- Use one approval per whole stage. After Jon's is closed, freeze infrastructure unless a real blocker exists; then continue with the next retailer, multi-retailer coverage and `/creatine` indexing readiness.
- `SAFE_UPDATE` remains disabled.

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
