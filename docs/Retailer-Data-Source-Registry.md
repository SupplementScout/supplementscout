# SupplementScout Retailer Data Source Registry

_Last updated: 22 July 2026_

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

## Jon's Supplements current record - 22 July 2026

- Retailer ID: `10`; domain: `jonssupplements.co.uk`; platform/source: public Shopify product JSON through the existing Shopify snapshot reader.
- Every capture must explicitly request the `GB` market context. A non-GB or collapsed market response is not acceptable evidence for price, stock or catalogue completeness.
- Fresh closeout source: 224 products and 844 variants. Production now has 506 exact Jon's mappings and 506 offers.
- Catalogue closeout ledger: 506 `MAPPED_APPROVED`, 8 `EXCLUDE_PROHIBITED`, 318 `EXCLUDE_OOS_BUNDLE_BBE_OR_NONPRODUCT`, 10 `EXCEPTION_UNRESOLVED`, 2 `DEFER_LOW_VALUE`, and 0 unclassified variants.
- SARMs and real peptide products are permanently prohibited. Ordinary collagen, hydrolysed protein and normal protein-peptide wording are not prohibited by that rule.
- Catalogue status: closed for the reviewed safe scope. Every source variant is mapped, excluded, deferred or retained in the explicit exception ledger.
- Reviewed stock correction: the exact eight authorised staging and production offers changed only from in stock to out of stock and received a fresh check timestamp. Price, URL, mappings, products, variants and price history changed by 0; approvals were consumed and recovery was not invoked.
- Full post-correction verification: 506/506 mapped offers matched the fresh GB source and classified `VERIFY_NO_CHANGE`; missing mappings, identity drift, duplicate source identities, source errors and blockers were all 0. The verified source contained 224 products, 844 variants and 575 available variants. The remaining 338 source variants are discovery-only, so `506 + 338 = 844` reconciles the source exactly.
- Operational status: **blocked at automation access**. The existing production validator, approver and executor credentials cannot register the required parent/child control plans. The existing administrative route can register them locally but is not present in GitHub Actions. A direct service-role update would bypass the approved safety contract, so no daily schedule is active and no guard has been weakened.
- Smallest next decision: separately authorise an existing GitHub-accessible administrative plan-registration credential/path, or a narrowly reviewed plan-registration RPC/grant for the existing control plane. Routine automation must still use explicit `GB` market context, exact Shopify identity and the existing source-collapse and mass-change guards, and must never create products, variants or mappings.

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
- The reviewed eight-offer stock-only correction and full 506-offer dry-run passed on both environments. The remaining operational blocker is GitHub access to the existing parent/child plan-registration path, not source quality, catalogue identity or another importer framework.
