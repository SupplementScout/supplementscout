# SupplementScout Retailer Data Source Registry

_Last updated: 24 July 2026_

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

## Whey Okay current record - 24 July 2026

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
- Status: **TECHNICALLY COMPLETE — AWAITING SCHEDULED PROOF** until the real `25 July 2026 02:17 UTC` and `26 July 2026 02:17 UTC` cron runs pass.

## Jon's Supplements current record - 22 July 2026

- Retailer ID: `10`; domain: `jonssupplements.co.uk`; platform/source: public Shopify product JSON through the existing Shopify snapshot reader.
- Every capture must explicitly request the `GB` market context. A non-GB or collapsed market response is not acceptable evidence for price, stock or catalogue completeness.
- Fresh closeout source: 224 products and 844 variants. Production now has 506 exact Jon's mappings and 506 offers.
- Catalogue closeout ledger: 506 `MAPPED_APPROVED`, 8 `EXCLUDE_PROHIBITED`, 318 `EXCLUDE_OOS_BUNDLE_BBE_OR_NONPRODUCT`, 10 `EXCEPTION_UNRESOLVED`, 2 `DEFER_LOW_VALUE`, and 0 unclassified variants.
- SARMs and real peptide products are permanently prohibited. Ordinary collagen, hydrolysed protein and normal protein-peptide wording are not prohibited by that rule.
- Catalogue status: closed for the reviewed safe scope. Every source variant is mapped, excluded, deferred or retained in the explicit exception ledger.
- Reviewed stock correction: the exact eight authorised staging and production offers changed only from in stock to out of stock and received a fresh check timestamp. Price, URL, mappings, products, variants and price history changed by 0; approvals were consumed and recovery was not invoked.
- Full post-correction verification: 506/506 mapped offers matched the fresh GB source and classified `VERIFY_NO_CHANGE`; missing mappings, identity drift, duplicate source identities, source errors and blockers were all 0. The verified source contained 224 products, 844 variants and 575 available variants. The remaining 338 source variants are discovery-only, so `506 + 338 = 844` reconciles the source exactly.
- Operational status: **complete**. `.github/workflows/jons-offer-refresh.yml` runs daily at `04:47 UTC` (`05:47 Europe/London` during British Summer Time) and remains available through `workflow_dispatch`. It uses the protected `production-readonly` Environment, tests and dry-runs before apply, registers one immutable 506-row parent with 11 ordered children, validates and applies each child through the separate least-privilege validator, approver and executor roles, performs a fresh idempotency dry-run, and uploads evidence on success or failure.
- Manual GitHub validation run [`29931897205`](https://github.com/SupplementScout/supplementscout/actions/runs/29931897205) passed on commit `f28d462a45e11f01437365a579c5ad7fa696ad86`: 506/506 mappings and offers, 11/11 children `APPLIED`, terminal parent `COMPLETED`, 506 freshness updates, 0 price/stock/URL/history changes, 0 catalogue row-count changes, 338 discovery-only variants, blockers 0, active plans/approvals/runs 0 and recovery 0. The retained guards require explicit `GB` context, exact Shopify identity, complete source coverage and acceptable mass-change thresholds; routine automation cannot create products, variants or mappings.

## 6 Pack Supplements current record - 27 July 2026

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
- Routine automation is implemented in `.github/workflows/six-pack-offer-refresh.yml`. One shared expandable manifest drives the complete retailer scope; the workflow runs daily at `03:17 UTC` and supports manual dry-run/apply. Every run tests contracts, fetches five exact WooCommerce product pages for all approved variants, validates source identity and full manifest coverage, applies only approved existing mappings through separate production approver/executor roles, takes a fresh source capture, requires idempotency and uploads evidence.
- Automatic apply fails closed on a missing/duplicate source identity, stale source, URL/domain drift, commercial identity drift, unexpected mapping/offer, catalogue create, hard per-row price anomaly, changed-record ratio above 25%, price-change ratio at or above 20%, two or more new out-of-stock transitions, excessive total OOS or post-apply drift. New products are never created by this workflow.
- First routine automation run [`30272677883`](https://github.com/SupplementScout/supplementscout/actions/runs/30272677883) passed on commit `dca4cca0c75a0b68ad45de945f7901ab12f57b6c`: tests, live preflight, exact six-plan apply, fresh idempotency check and evidence upload all succeeded. Independent verification retained six mappings and six offers with unchanged approved prices/stock/shipping and refreshed all six `last_checked_at` values to `2026-07-27T13:57:14.212Z`.
- The explicitly approved nine-row expansion passed protected production run [`30273730176`](https://github.com/SupplementScout/supplementscout/actions/runs/30273730176) on commit `418f618ea7c71c974662146c98c393fa586e3b25`: exact checksum, fresh preflight, nine sequential approvals/applies, post-apply idempotency and exact mapping/offer verification all succeeded. No product or variant was created.
- The nine mappings were appended to the same manifest, increasing the shared scope from six to 15 offers without creating a second automation. Full shared run [`30274125451`](https://github.com/SupplementScout/supplementscout/actions/runs/30274125451) passed on commit `d2e781501e619a9e8b4f29474591c48dbbd7749c`: 15/15 existing approved offers, five live product pages, apply and fresh idempotency verification all succeeded. An independent post-run capture at `2026-07-27T14:16:50.138Z` classified all 15 as `VERIFY_NO_CHANGE`, with zero price, stock or URL changes and zero blockers.
- The confirmed delivery policy was applied to the exact 15-offer scope through protected run [`30275285518`](https://github.com/SupplementScout/supplementscout/actions/runs/30275285518) on commit `677b461859f971d647ea5f38eea220ba0f325da4`: all 15 offers received £4.99 shipping and a recalculated total, while product price, stock, URL, product, variant and mapping identities remained unchanged. Fresh importer idempotency and exact production verification passed. An independent post-run capture at `2026-07-27T14:30:48.251Z` classified all 15 as `VERIFY_NO_CHANGE`.
- The explicitly approved seven-row V2 expansion passed protected run [`30276417064`](https://github.com/SupplementScout/supplementscout/actions/runs/30276417064) on commit `b9ad10e86bae3ceee25135cc429132c95927e673`: seven existing canonical variants, seven mappings/offers, no product or variant creation, exact £4.99 shipping and totals, fresh idempotency and production verification all succeeded. The shared manifest was expanded from 15 to 22 offers across eight live product pages. Five offers are intentionally retained as the current OOS baseline so the automation can detect their return to sale.
- Full 22-offer shared run [`30276968945`](https://github.com/SupplementScout/supplementscout/actions/runs/30276968945) passed on commit `2f6b5bfec90da7007a041267056ffb5e1526fb4a`: contracts, fresh eight-page preflight, 22 protected approvals/applies, a second fresh source capture, exact 22/22 idempotency and evidence upload all succeeded. Live-source reads now have three bounded attempts for transient transport failures; business-rule and identity blockers still fail closed.
- Status: **22 APPROVED OFFERS / SHARED DAILY AUTOMATION OPERATIONAL**.

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
