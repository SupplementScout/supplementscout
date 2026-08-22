# SupplementScout Retailer Data Source Registry

_Last updated: 20 August 2026_

## Purpose

This registry tracks every retailer considered for SupplementScout, how its data can be obtained, how valuable it is commercially, and how difficult it is to integrate safely.

The registry supports the Commercial Coverage Sprint and prevents duplicate technical work. Before creating a new feed importer, platform adapter, scraper, or retailer-specific rule, check whether the capability already exists.

## Core rule

Use the safest and most reusable data source available.

Preferred order:

1. Existing CSV files and direct retailer feeds
2. Affiliate product feeds
3. Existing or shared platform adapters, including reusable API or structured-data capabilities
4. Retailer-specific scraper only when none of the earlier options exists

Do not build a retailer-specific scraper until the earlier options have been checked and documented.

### Current project-wide coverage checkpoint — 20 August 2026

- Production has 1,070 active products, 2,087 public offers and 10 active
  retailers.
- Coverage is 200 products with no retailer, 701 with one, 169 with at least
  two, 25 with at least three and three with four retailers.
- The next controlled target is 250 products with at least two retailers,
  leaving 81. Prioritise exact offers that create the second retailer for an
  existing canonical product; raw offer count is not the target.
- New catalogue expansion is paused until SEO-11, SEO-14 and the fresh SEO-13
  Protein Bars recheck are complete. Routine approved refreshes continue.

### Binding catalogue exclusions

The global catalogue exclusion policy applies before matching, creation, approval or automation:

- exclude products with positive evidence that their expiry or best-before date had already passed when the source was captured;
- exclude all SARMs;
- exclude real peptide and research-peptide products;
- do not treat ordinary collagen, collagen peptides, hydrolysed protein or ordinary protein-peptide wording as prohibited peptide products;
- do not infer expiry from missing expiry metadata, out-of-stock status, discontinued status or absence from a source;
- retain an explicit exclusion reason in the retailer ledger rather than silently dropping the row.

## Source types

### Existing CSV

Use when a clean retailer export already exists.

Advantages:

- controlled input
- reviewable before apply
- compatible with the current approval workflow
- low risk to production

Limitations:

- may become stale
- usually requires repeated manual exports
- may omit stock, variants, or shipping rules

### Affiliate feed

Possible networks include:

- Awin
- Webgains
- Impact
- CJ
- Rakuten
- TradeDoubler
- Partnerize
- direct retailer affiliate programmes

Potential fields:

- product name
- brand
- category
- price
- previous price
- image URL
- product URL
- affiliate URL
- stock status
- SKU
- GTIN
- description
- size
- colour or flavour

Feeds must still pass through SupplementScout normalization, matching, variant resolution, approval, and audit controls.

### Direct retailer feed

Examples:

- CSV
- XML
- JSON
- Google Merchant feed
- scheduled SFTP export
- private API

Prefer this when the retailer can provide reliable identifiers, stock, and variant data.

### Platform adapter

Reusable platform adapters may support multiple retailers.

Priority platforms:

- Shopify
- WooCommerce
- EKM
- Magento
- BigCommerce

A platform adapter should use stable structured sources where possible, such as JSON-LD, public product JSON, sitemaps, or documented storefront endpoints.

### Retailer-specific scraper

Use only when no reliable feed, API, or reusable adapter exists.

A retailer-specific scraper must document:

- discovery method
- parsing rules
- variant handling
- stock handling
- rate limits
- failure conditions
- legal and operational risks
- monitoring requirements

## Retailer prioritisation score

Score each retailer from 0 to 5 in every category.

| Dimension | Description | Score |
|---|---|---:|
| Product overlap | Products already present in SupplementScout | 0-5 |
| Affiliate value | Commission potential and tracking availability | 0-5 |
| Data quality | Availability of identifiers, variants, prices, and stock | 0-5 |
| Catalogue value | Number and commercial relevance of products | 0-5 |
| Integration ease | Estimated effort using existing capabilities | 0-5 |

Maximum score: 25.

Retailers with high overlap, strong affiliate value, good data quality, and low integration effort should be added first.

## Required retailer record

Each retailer entry should include the following fields.

### Identity

- retailer name
- domain
- retailer ID in SupplementScout
- active status
- UK market relevance
- main product categories

### Commercial

- affiliate network
- advertiser or merchant ID
- commission model
- cookie window
- affiliate approval status
- deep-link support
- product feed available
- promotional code support
- commercial notes

### Technical

- ecommerce platform
- sitemap URL
- robots policy reviewed
- JSON-LD quality
- product feed URL or source
- feed format
- API availability
- authentication requirements
- current adapter
- new adapter required
- JavaScript rendering required
- rate-limit notes

### Catalogue

- estimated product count
- estimated supplement product count
- estimated overlap with current database
- brands carried
- category coverage
- variant complexity
- GTIN coverage
- SKU coverage
- nutrition data availability
- ingredient data availability

### Price and stock

- current price source
- previous price source
- stock source
- promotion handling
- member-only price handling
- voucher handling
- subscription price handling
- last checked timestamp
- intended update frequency

### Shipping

- standard shipping price
- free-shipping threshold
- regional restrictions
- oversized item rules
- subscription shipping rules
- click-and-collect support
- shipping rule verification date

### Import state

- status
- sample collected
- dry run completed
- approval artifact created
- staging apply completed
- idempotency passed
- public validation completed
- production apply completed
- automated updates enabled
- last successful import
- last failed import
- current blocker

## Standard statuses

Use one of the following statuses:

- Discovered
- Under review
- Source confirmed
- Sample collected
- Adapter available
- Adapter required
- Dry run ready
- Approval required
- Staging verified
- Production ready
- Live
- Monitoring
- Blocked
- Paused
- Retired

## Quality states

Retailer data should not be treated as fully verified merely because it has been imported.

Track these states separately:

- Imported
- Matched
- Canonical product confirmed
- Variant resolved
- Weight verified
- Serving count verified
- Nutrition verified
- Ingredient data verified
- Unit pricing verified
- Affiliate ready
- Shipping verified
- Public ready

## Standard onboarding workflow

Every retailer should pass through this sequence.

1. Check whether an integration, adapter, or feed already exists.
2. Audit the source and platform.
3. Estimate catalogue size and overlap.
4. Confirm affiliate value.
5. Collect a representative sample.
6. Run a dry import.
7. Review product matching.
8. Review variant resolution.
9. Review blocked and ambiguous rows.
10. Create an immutable approval artifact.
11. Apply to staging.
12. Verify database deltas.
13. Verify idempotency.
14. Check public product and offer pages.
15. Approve production release.
16. Apply to production.
17. Monitor the first automated update.

## Success metrics

Track the following project-wide metrics:

- active retailers
- active offers
- canonical products
- products with at least 2 active retailers
- products with at least 3 active retailers
- products with affiliate-ready offers
- products with verified weight
- products with verified serving count
- products with verified nutrition
- offers updated in the last 24 hours
- retailers with automated updates
- import success rate
- unresolved match rate
- unresolved variant rate

Primary commercial coverage metric:

Products with at least 2 active retailers.

## Whey Okay current record - 17 August 2026

- Retailer ID: `3`; domain: `wheyokay.com`; platform/source: EKM Google Product Feed at `https://wheyokay.com/ekmps/shops/2ab763/data/ekm_p_2ab763.txt`.
- Source classification: `FULL_AUTOMATIC_SOURCE` for the immutable exact-mapping manifest only. Reader requirements are HTTP success, safe same-host HTTPS redirects, UTF-8 TSV, exactly 48 columns, exact EKM parent/variant identity, valid price and availability, Whey Okay URL identity and `Last-Modified` age no greater than 24 hours.
- Approved automatic manifest: 586 existing mappings/offers; SHA-256 `54D828AF0E3C20F548708832E0A7AD9DCAF74B1CBC6AB043ED7696D6F7C4D731`. It had 527 active and 59 monitored-OOS rows when frozen. Identity and canonical-target duplicates were 0 and approved feed coverage was 586/586.
- Outside automation: all 284 legacy mappings; reviewed mapping exceptions `11`, `150`, `191` and `249`; permanent Q3/Q4 exceptions; apparel; and every unapproved discovery row. The automatic path cannot create or remap catalogue identities.
- Refresh fields: price, stock, approved offer/mapping URL and `last_checked_at`; price history only for a genuine price or approved delivered-price change. Stored shipping is preserved during the first rollout.
- First staging and production refresh: 580 no-change, 5 stock changes, 1 price change, 586 freshness updates, history `+1`, all catalogue row-count deltas 0, URL changes 0, shipping mutations 0, approvals consumed and recovery 0. Fresh idempotency was 586/586 no-change in both environments.
- Shipping review: the fresh feed has 31 feed-versus-stored differences rather than the previously expected 28. All 31 are report-only and deferred.
- Source/guard baselines: 520 products, 1,678 rows, 90% minimum count ratio, 75% collapse boundary, at most 3 new OOS, total OOS at most 20%, OOS increase at most 5 percentage points, changed rows at most 20%, price changes below 10%, per-row price hard blocks at 60% or £20, and URL host restricted to `wheyokay.com`. Any missing approved row blocks; source failure produces zero writes; new rows remain discovery-only.
- Workflow: `.github/workflows/whey-okay-offer-refresh.yml`, daily `02:17 UTC` (`03:17 Europe/London` during British Summer Time), plus dry-run-by-default manual dispatch. It uses separate scoped validator, approver and executor credentials, uploads evidence with `if: always()`, has no service-role path and keeps `SAFE_UPDATE` unset.
- Manual production dry-runs [`30074666550`](https://github.com/SupplementScout/supplementscout/actions/runs/30074666550) and [`30074733707`](https://github.com/SupplementScout/supplementscout/actions/runs/30074733707), plus scheduled-context dry-run [`30074802757`](https://github.com/SupplementScout/supplementscout/actions/runs/30074802757), passed on commit `c5eae74bf072d1b93b206fd2853075c0485a3b7a`, including 120/120 contract tests, 586-row validation and artifacts.
- The 17 August guarded refresh completed for the exact 586-row manifest after
  the reviewed canonical-target reseal and six approved Ghost OOS transitions.
  A final ordinary production dry-run returned `VERIFY_NO_CHANGE` x586 with
  zero further commercial changes or writes.
- Status: **ROUTINE AUTOMATION OPERATIONAL; EXACT 586 MANIFEST HEALTHY**.

## Jon's Supplements current record - 11 August 2026

- Retailer ID: `10`; domain: `jonssupplements.co.uk`; platform/source: public Shopify product JSON through the existing Shopify snapshot reader.
- Every capture must explicitly request the `GB` market context. A non-GB or collapsed market response is not acceptable evidence for price, stock or catalogue completeness.
- Fresh current source: 241 products and 872 variants. Production has 506 exact
  Jon's mappings and 506 offers. The 11 August ordinary production dry-run
  returned `VERIFY_NO_CHANGE` x506 across 11 validator batches, with zero
  missing variants, commercial changes, catalogue deltas or writes.
- Catalogue closeout ledger: 506 `MAPPED_APPROVED`, 8 `EXCLUDE_PROHIBITED`, 318 `EXCLUDE_OOS_BUNDLE_BBE_OR_NONPRODUCT`, 10 `EXCEPTION_UNRESOLVED`, 2 `DEFER_LOW_VALUE`, and 0 unclassified variants.
- SARMs and real peptide products are permanently prohibited. Ordinary collagen, hydrolysed protein and normal protein-peptide wording are not prohibited by that rule.
- Catalogue status: closed for the reviewed safe scope. Every source variant is mapped, excluded, deferred or retained in the explicit exception ledger.
- Reviewed stock correction: the exact eight authorised staging and production offers changed only from in stock to out of stock and received a fresh check timestamp. Price, URL, mappings, products, variants and price history changed by 0; approvals were consumed and recovery was not invoked.
- Full post-correction verification: 506/506 mapped offers matched the fresh GB source and classified `VERIFY_NO_CHANGE`; missing mappings, identity drift, duplicate source identities, source errors and blockers were all 0. The verified source contained 224 products, 844 variants and 575 available variants. The remaining 338 source variants are discovery-only, so `506 + 338 = 844` reconciles the source exactly.
- Operational status: **complete**. `.github/workflows/jons-offer-refresh.yml` runs daily at `04:47 UTC` (`05:47 Europe/London` during British Summer Time) and remains available through `workflow_dispatch`. It uses the protected `production-readonly` Environment, tests and dry-runs before apply, registers one immutable 506-row parent with 11 ordered children, validates and applies each child through the separate least-privilege validator, approver and executor roles, performs a fresh idempotency dry-run, and uploads evidence on success or failure.
- Manual GitHub validation run [`29931897205`](https://github.com/SupplementScout/supplementscout/actions/runs/29931897205) passed on commit `f28d462a45e11f01437365a579c5ad7fa696ad86`: 506/506 mappings and offers, 11/11 children `APPLIED`, terminal parent `COMPLETED`, 506 freshness updates, 0 price/stock/URL/history changes, 0 catalogue row-count changes, 338 discovery-only variants, blockers 0, active plans/approvals/runs 0 and recovery 0. The retained guards require explicit `GB` context, exact Shopify identity, complete source coverage and acceptable mass-change thresholds; routine automation cannot create products, variants or mappings.

## 6 Pack Supplements current record - 11 August 2026

- Current binding scope: 506 approved existing offers across 279 live product
  pages, handled by one shared workflow and one expandable manifest.
- The owner-reviewed Banana and Belgian Chocolate Whey Isolate stock changes
  were applied on 11 August through the existing split-role executor. Immediate
  ordinary postflight: `VERIFY_NO_CHANGE` x506 and zero further writes. The
  ordinary two-new-OOS guard remains unchanged; the exact reviewed selector is
  manual-only and replay-safe.

- Domain: `6pack-supplements.co.uk`; platform/source: retailer-provided native WooCommerce product CSV.
- The store owner explicitly authorised inclusion of the store and its products in SupplementScout and authorised technical use of the supplied catalogue data. Authorization source: `MANUAL_USER_CONFIRMED`, recorded 27 July 2026. Credentials or private personal details must not be committed.
- Source snapshot: 671 rows comprising 273 simple products, 64 variable parents and 334 variation rows; SHA-256 `6B9D131C658077B7F3982EBF94C80F34B6AE31AE4B158750D041ADB73E6B1190`. The raw CSV remains outside Git.
- Stable source identity is available through unique WooCommerce row IDs. For a simple product, use its row ID as both external product and variant identity. For a variation, use the variable parent ID as external product identity and the variation row ID as external variant identity.
- Initial onboarding is match-first: use existing SupplementScout canonical product, brand, format, size, pack and flavour data to resolve retailer rows. Ambiguous and unmatched rows remain review-only; retailer SKU or barcode-like text must not become canonical GTIN evidence.
- Permanently exclude SARMs, real peptide/research-peptide products and any row with positive evidence that its expiry or best-before date had passed at capture time. The supplied CSV contains no expiry field and no detected BBE, best-before, expiry, expired or short-date marker, so expiry cannot be inferred. Out-of-stock rows are not expired by default.
- Ordinary collagen and hydrolysed protein remain eligible under normal identity review.
- Source defects retained for review: 26 orphan variations have no parent, name or attributes; four named active variations have no price; direct product URLs are absent; variation SKU coverage is 4/334; explicit GTIN/EAN coverage is limited.
- Public store categories `SARMs` and `Peptides` are excluded before matching. Accessories are deferred outside the initial supplement scope.
- Public live-page enrichment is bound to the stable WooCommerce product ID through `/?p=<id>`, same-host redirects, the page `postid-<id>` identity and exact variation IDs from WooCommerce's variation payload. Price, stock and canonical URL are refreshed from the live page; the adapter fails closed on redirect, identity, schema, currency, duplicate-variant or material name/size/dosage drift.
- Read-only source audit result: 576 normalized records; 517 eligible supplement records; 43 policy exclusions (25 peptide and 18 SARM); 16 accessories deferred; 31 source issues retained (26 orphan variations, four missing prices and one unpublished row).
- Production match-only result: 26 safe existing-variant matches; seven high-confidence reviews; 196 ambiguous reviews; 277 new-product reviews; 11 variant reviews. No catalogue creation was attempted.
- A live 10-row canary was passed through the existing canonical importer. Its guardrails retained four rows for review and accepted six. The exact six-row subset then passed a second dry-run with six approved rows, zero invalid, unmatched, excluded, ambiguous, collision or conflict rows, and zero database writes. Frozen canary SHA-256: `28bd98642e0c6dd04e98622e9a10245e898a7d41226a2ba45401e85118dc8281`.
- The store's standard delivery was manually confirmed on 27 July 2026 as £4.99 below the £99.99 free-shipping threshold and £0.00 at or above the threshold. Direct retailer URLs are used; affiliate tracking is not claimed.
- The six-row canary was explicitly approved and applied through protected GitHub Actions run `30271526584` on commit `66e4306d8a247e3db281e561692442e058932b69`. Bootstrap, exact-scope apply, fresh idempotency dry-run, production mapping/offer verification and evidence upload all passed.
- Initial independent production verification found exactly one retailer (`id=11`), six exact mappings and six exact offers with external variant IDs `4110`, `4112`, `4627`, `6305`, `6308` and `87012`. All six offers matched the initially approved prices and stock state.
- The initial production identities are sealed in `config/retailers/six-pack-approved-offer-manifest.json`. It is the single expandable retailer manifest: later reviewed mappings are appended to the same scope and handled by the same refresh process. New or ambiguous products remain discovery-only until reviewed; they do not create separate automations.
- Routine automation is implemented in `.github/workflows/six-pack-offer-refresh.yml`. One shared expandable manifest drives the complete retailer scope; the workflow runs daily at `03:17 UTC` and supports manual dry-run/apply. Every run tests contracts, fetches the 279 exact WooCommerce product pages for all 506 approved offers, validates source identity and full manifest coverage, applies only approved existing mappings through separate production approver/executor roles, takes a fresh source capture, requires idempotency and uploads evidence.
- Automatic apply fails closed on a missing/duplicate source identity, stale source, URL/domain drift, commercial identity drift, unexpected mapping/offer, catalogue create, hard per-row price anomaly, changed-record ratio above 25%, price-change ratio at or above 20%, two or more new out-of-stock transitions, excessive total OOS or post-apply drift. New products are never created by this workflow.
- First routine automation run [`30272677883`](https://github.com/SupplementScout/supplementscout/actions/runs/30272677883) passed on commit `dca4cca0c75a0b68ad45de945f7901ab12f57b6c`: tests, live preflight, exact six-plan apply, fresh idempotency check and evidence upload all succeeded. Independent verification retained six mappings and six offers with unchanged approved prices/stock/shipping and refreshed all six `last_checked_at` values to `2026-07-27T13:57:14.212Z`.
- The explicitly approved nine-row expansion passed protected production run [`30273730176`](https://github.com/SupplementScout/supplementscout/actions/runs/30273730176) on commit `418f618ea7c71c974662146c98c393fa586e3b25`: exact checksum, fresh preflight, nine sequential approvals/applies, post-apply idempotency and exact mapping/offer verification all succeeded. No product or variant was created.
- The nine mappings were appended to the same manifest, increasing the shared scope from six to 15 offers without creating a second automation. Full shared run [`30274125451`](https://github.com/SupplementScout/supplementscout/actions/runs/30274125451) passed on commit `d2e781501e619a9e8b4f29474591c48dbbd7749c`: 15/15 existing approved offers, five live product pages, apply and fresh idempotency verification all succeeded. An independent post-run capture at `2026-07-27T14:16:50.138Z` classified all 15 as `VERIFY_NO_CHANGE`, with zero price, stock or URL changes and zero blockers.
- The confirmed delivery policy was applied to the exact 15-offer scope through protected run [`30275285518`](https://github.com/SupplementScout/supplementscout/actions/runs/30275285518) on commit `677b461859f971d647ea5f38eea220ba0f325da4`: all 15 offers received £4.99 shipping and a recalculated total, while product price, stock, URL, product, variant and mapping identities remained unchanged. Fresh importer idempotency and exact production verification passed. An independent post-run capture at `2026-07-27T14:30:48.251Z` classified all 15 as `VERIFY_NO_CHANGE`.
- The explicitly approved seven-row V2 expansion passed protected run [`30276417064`](https://github.com/SupplementScout/supplementscout/actions/runs/30276417064) on commit `b9ad10e86bae3ceee25135cc429132c95927e673`: seven existing canonical variants, seven mappings/offers, no product or variant creation, exact £4.99 shipping and totals, fresh idempotency and production verification all succeeded. The shared manifest was expanded from 15 to 22 offers across eight live product pages. Five offers are intentionally retained as the current OOS baseline so the automation can detect their return to sale.
- Full 22-offer shared run [`30276968945`](https://github.com/SupplementScout/supplementscout/actions/runs/30276968945) passed on commit `2f6b5bfec90da7007a041267056ffb5e1526fb4a`: contracts, fresh eight-page preflight, 22 protected approvals/applies, a second fresh source capture, exact 22/22 idempotency and evidence upload all succeeded. Live-source reads now have three bounded attempts for transient transport failures; business-rule and identity blockers still fail closed.
- The explicitly reviewed 21-row family rollout passed protected run [`30280952450`](https://github.com/SupplementScout/supplementscout/actions/runs/30280952450): 14 exact WooCommerce flavour variants were atomically bootstrapped under three existing canonical products, 21 mappings/offers were verified, no canonical product was created, and every offer uses the confirmed £4.99-below-£99.99 delivery rule. The reviewed aliases for Tongkat Ali, BCAA Ice/Icy Blue Razz, 7Nutrition Cookies & Cream and GYM HIGH 2100g remain fingerprint-bound rather than becoming global fuzzy-match rules.
- The same shared automation was expanded from 22 to 43 offers across 11 product pages in manifest SHA-256 `04b889735b55c309077cd911dc0f46b020678df96bf63a47a6ef65e3c6d7491c`. Full protected run [`30281395323`](https://github.com/SupplementScout/supplementscout/actions/runs/30281395323) passed on commit `b0ab09e2c6faaa562833f06f6b1b2fbcfe47e796`: live-source preflight, exact-manifest apply, a second fresh source capture and 43/43 idempotency all succeeded. This is one retailer automation, not a separate process for the newly added products.
- A further 35 existing canonical variants were added in one protected rollout, without creating products or variants. Run [`30283296805`](https://github.com/SupplementScout/supplementscout/actions/runs/30283296805) passed preflight, exact-scope execution, production verification and 35/35 idempotency. The single shared manifest now covers 78 offers across 27 product pages with SHA-256 `00097844976ec31f6c1cf0bfd3c9a4e8abcd9c0af3d2b28aade17688a2c1046e`; full shared-automation run [`30283890153`](https://github.com/SupplementScout/supplementscout/actions/runs/30283890153) passed live-source preflight, exact-manifest execution and a second fresh-source idempotency check for all 78 offers.
- Seventeen missing flavour variants were then created atomically under seven existing canonical products and bound to 17 new retailer offers. Protected run [`30285647049`](https://github.com/SupplementScout/supplementscout/actions/runs/30285647049) passed the explicit-ID preflight, exact-scope apply, production verification and idempotency. The same shared manifest now covers 95 offers across 28 product pages with SHA-256 `0e52e08982f8fd53e0628c9ba8c02feaa32c9d3eb560dcfbf439fad0ec61b04f`; full shared refresh [`30285963795`](https://github.com/SupplementScout/supplementscout/actions/runs/30285963795) passed live preflight, exact-manifest execution and a second fresh-source idempotency check for all 95 offers.
- Historical V14 checkpoint: 440 approved offers across 231 WooCommerce product
  pages. The binding current scope at the top of this record supersedes it:
  506 offers across 279 pages in the same expandable automation.
- Product matching review queue: 141 rows, comprising 58 owner decisions and 83
  open reviews. Fifty decided rows were approved for controlled execution:
  25 new products, 17 new variants, four new-family seeds and four
  existing-variant mappings. Protected bootstrap run `30389870288` verified all
  35 reviewed families complete and idempotent. Protected offer run
  `30391111886` then added and verified 49 exact mappings/offers with £4.99
  shipping. Source row `5232` remains separately audited as a duplicate page
  already covered by mapping `4551:4553`, so it did not create a second offer.
  Shared refresh run `30391609002` expanded the existing single manifest from
  391 to 440 offers, fetched 231 product pages and classified all 440 offers as
  `VERIFY_NO_CHANGE` both before and after apply. Seven rows are excluded and
  one is deferred.
- Status: **506 APPROVED OFFERS / ONE SHARED DAILY AUTOMATION OPERATIONAL;
  POST-APPLY IDEMPOTENCY VERIFIED**.

## Fit House current record - 11 August 2026

- Retailer ID: `9`; domain: `fithouse.uk`; guarded Shopify products JSON.
- Approved routine scope: 286 exact mappings/offers in
  `config/retailers/fit-house-approved-offer-manifest.json`. Routine refreshes
  cannot create, delete or automatically remap catalogue identities.
- One routine engine is authoritative:
  `.github/workflows/fit-house-offer-refresh.yml` ->
  `scripts/fit-house-offer-refresh.js`. It runs daily at `02:47 UTC`.
- The immutable 78-row audited-missing manifest is source-identity evidence.
  It cannot authorise stock writes. Reviewed manifests/builders and SQL
  migrations are one-time approval and audit evidence, not parallel scheduled
  engines.
- The reviewed 47-change operation completed with unchanged catalogue entity
  counts. The exact Fit House stable-OOS boundary is 103 of 286, may not
  increase, and does not alter the generic 35% guard used elsewhere.
- Migration `20260811020000` repaired only the runtime policy fingerprint.
  Production counts remained `1112` products, `2641` variants, `2522`
  mappings, `2522` offers and `2673` price-history rows.
- Final production dry-run: source `240` products / `332` variants; exact scope
  `286`; `VERIFY_NO_CHANGE` x286; six validator batches; zero business/control
  writes.
- Status: **ROUTINE AUTOMATION HEALTHY; ONE SHARED GUARDED PATH; LATEST REMOTE
  RUN GREEN**. Future identity changes must
  use owner review and the existing path.

## Fit House historical blocked record - 1 August 2026

- Retailer ID: `9`; domain: `fithouse.uk`; platform/source: guarded Shopify
  products JSON through the existing Fit House adapter and shared retailer
  offer-refresh controls.
- Approved routine scope: 286 exact mappings/offers in
  `config/retailers/fit-house-approved-offer-manifest.json`. The automation
  requires full manifest coverage and fails closed on a missing source
  identity; it cannot create or remap products during a refresh.
- Scheduled run `30686341802` passed contract tests and source-health checks,
  then stopped in the read-only classifier with `IDENTITY_DRIFT`. Apply and
  idempotency steps were skipped.
- The exact blocker is offer `986`, mapping `1172`, canonical product `68`
  (`7Nutrition Whey Isolate 90 1kg`), approved Shopify product
  `8147819069680` / variant `43583990006000`. The product is absent from the
  current 206-product source and the previous public handle returns 404.
- A local dry-run through the same production mechanism reproduced the blocker
  with zero database, business or control writes. No missing identity was
  converted into an out-of-stock claim.
- Status: **BLOCKED — OWNER-REVIEWED SOURCE IDENTITY DECISION REQUIRED**. Next
  action: decide whether evidence supports a guarded manifest retirement or a
  replacement identity review, then rerun the protected dry-run. Do not edit
  the manifest or production mapping solely to restore freshness.

## Simply Supplements current record - 11 August 2026

- Retailer ID: `7`; approved routine scope: 120 exact mappings/offers through
  the existing shared Shopify offer-refresh engine.
- Owner-reviewed offer `635` / mapping `627` is complete: price GBP 2.13,
  shipping GBP 1.99, delivered total GBP 4.12, still in stock. Identity, source
  URL and Awin offer URL are unchanged; price history contains the move from
  GBP 6.41.
- The exact one-time reviewed authorization is consumed and replay-protected.
- Fresh ordinary production dry-run: source 270 products / 469 variants;
  `VERIFY_NO_CHANGE` x120 across three validator batches; zero missing
  identities and zero writes.
- Status: **ROUTINE AUTOMATION HEALTHY; NO PENDING OFFER-635 ACTION**.

## Dolphin Fitness current record - 11 August 2026

- The active workflow syntax is valid after removal of the unsupported YAML
  mapping merge. It remains limited to schedule and manual dispatch on `main`.
- Approved automated scope: exactly one existing mapping and offer, read from
  the exact Dolphin product page; routine execution cannot create catalogue
  identities.
- Focused contracts: 20/20 PASS. Fresh production dry-run: HTTP 200, one source
  product/variant, `VERIFY_NO_CHANGE` x1, zero missing identities and zero
  writes.
- Status: **ROUTINE AUTOMATION HEALTHY; LATEST REMOTE RUN GREEN**.

## GYM HIGH current record - 21 August 2026

- Retailer ID: `1`; domain: `gymhigh.co.uk`; source: public WooCommerce Store API for complete discovery plus the existing bounded WooCommerce product-page reader for exact live variant price, stock and identity.
- The owner-reviewed source scope contains 66 approved sellable variants across
  26 product families. Four gift-card rows remain excluded and source identity
  `639:644` remains an explicit reviewed exception.
- The exact 66-row catalogue rollout and legacy identity repair are complete.
  Production has 66 mappings and 66 offers in the reviewed scope.
- The owner confirmed standard delivery on 21 August 2026 as GBP 3.99 below
  GBP 50 and free from GBP 50 inclusive. The existing feed and guarded refresh
  now encode only that formula. A fresh production-data dry-run over all 66
  approved identities planned exactly 43 shipping-only updates and 23 no-ops:
  37 unknown-to-GBP-3.99, five unknown-to-free and one GBP-3.99-to-free. Price,
  stock, URL and catalogue identity changes were all zero. PR `#31` merged the
  guarded policy as `cb84b9720700b45d13fc978d2851cdc0c65c71df`. Protected
  production run `32481753907` passed source capture, exact contracts, dry-run,
  role-separated apply, complete live postcondition and evidence upload. An
  independent production read at `2026-08-21T12:31:09.680Z` returned 66/66
  policy no-ops and zero remaining updates.
- `.github/workflows/gym-high-source-monitor.yml` performs a daily full-catalogue read-only capture at `03:43 UTC`. It discovers the complete source, validates every product page and variation ID, fails closed on count, host, schema, currency, product or variation drift, and retains the complete classification artifact.
- The daily source monitor remains read-only. The separate existing 66-offer
  guarded refresh can update only the exact reviewed offers and fails closed on
  stale, missing or drifted source evidence or a shipping value outside the
  confirmed threshold formula. New and ambiguous identities
  remain review-only.
- Status: **66-OFFER REVIEWED CATALOGUE AND CONFIRMED SHIPPING POLICY LIVE;
  DAILY MONITOR AND GUARDED REFRESH OPERATIONAL; LATEST REMOTE RUN GREEN**.

## eBay UK current record - 22 August 2026

- Retailer ID: `12`; source: eBay Browse API plus exact item-ID revalidation;
  affiliate destinations require eBay-returned EPN Campaign-ID URLs.
- Batches A-P are complete. Production has exactly 161 approved eBay mappings,
  161 public offers and 161 initial price-history rows. PR `#39` merged Batch P
  as `eddd2c156235e3409c4693a7322370c344978909`; protected run `32561910587`
  passed 20 fresh business-seller reads and executed all 20 plans, creating
  mappings `2866`-`2885` and offers `2680`-`2699`. Its failure conclusion came
  only from a false Critical Cookie postflight conflict after all writes; apply
  was not replayed. Artifact `9473044920` has SHA-256
  `890efa2fff695fc0960556da0aef6aeae96160348299c43414e3ec607e079c7c`.
- Independent readback verified all 20 identities, prices, known shipping,
  delivered totals, stock, affiliate URLs and history rows. The corrected
  importer dry-run returned 20 no-ops, zero blockers and SHA-256
  `37b25c7c13057259a00132f50b85afe4a77b76f1cb2213a30e68aa7286985867`.
  All 13 distinct public product pages returned HTTP 200 and displayed eBay UK.
- The single existing workflow refreshes the exact 161-offer manifest at
  `05:43 UTC`. PR `#40`, merge SHA
  `e6817538ebf8cc8d1ee9479cf3ae981843b9a84c`, sealed Batch P continuity to
  exact offer IDs, business sellers and reviewed evidence sets. Protected
  read-only run `32563234233` passed 161/161 `verify_no_change`, zero blocked
  rows and zero executions. Artifact `9473405068` has SHA-256
  `30ae68b07607d18e24d12a00371731f7d98d13b734376e6a98bb6176630d6fcf`.
  Automatic-OOS blocking remains active.
- Current production-wide readback has 1,070 active products and 2,170
  positive-price in-stock offers: 191 products have at least two current
  retailers, 31 have at least three and five have at least four. The 250-product
  checkpoint therefore has 59 remaining. The earlier nine-row projection was
  variant-level; after canonical-product deduplication Batch P advances the KPI
  by three products.
- Status: **EXACT 161 LIVE, PUBLICLY VERIFIED AND GUARDED; BATCH P COMPLETE**.
  Do not repeat Batches A-P, reintroduce excluded Batch N row 5 or widen any
  reviewed shared-parent, missing-GTIN or seller-threshold contract.

## Initial registry template

| Retailer | Platform | Source | Affiliate network | Feed | Overlap | Commercial score | Integration score | Status | Next action |
|---|---|---|---|---|---:|---:|---:|---|---|
| Example Retailer | Shopify | Existing CSV | Awin | Yes | 4 | 5 | 5 | Under review | Validate feed fields |

## Decision log

Record major decisions below.

### 17 July 2026

- The registry was created as the operational source for retailer acquisition and data-source decisions.
- The project will prioritise retailers with product overlap and affiliate value.
- Existing CSV imports remain the first route during the current Commercial Coverage Sprint.
- Platform adapters, affiliate feeds, and automated collection will follow after the commercial coverage milestone unless a reusable low-risk source is already available.
- EKM automation, a new admin imports interface, SAFE_UPDATE, and complex remaining legacy cleanup remain deferred unless the main operating plan changes.

### 22 July 2026

- The final reviewed Jon's catalogue closeout applied 51 rows on staging and production: 34 products, 51 variants, 51 mappings, 51 offers and 51 initial price-history rows.
- Production Jon's coverage moved from 455 to 506 mappings/offers; post-apply importer idempotency was 51/51 unchanged with zero new deltas.
- The reviewed eight-offer stock-only correction and full 506-offer dry-run passed on both environments. The subsequent GitHub parent/child run passed for all 506 offers, its daily schedule is active, and Jon's is operationally complete without a new sync framework or routine manual refresh.

### 24 July 2026

- Whey Okay's EKM Google Product Feed became the authorised `FULL_AUTOMATIC_SOURCE` for the immutable 586-row exact-mapping manifest.
- Staging and production apply plus 586/586 idempotency passed. The 284 legacy mappings, four reviewed rebind exceptions and permanent exclusions remain outside automation.
- The daily `02:17 UTC` workflow is active. Manual production and scheduled-context dry-runs are the technical proof; operational completion still requires two consecutive real cron passes.
