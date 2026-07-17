# WheyWise Competitive Intelligence Analysis

_Date: 17 July 2026_

## Purpose

This document records competitive intelligence about wheywise.co.uk and converts the findings into practical decisions for SupplementScout.

This is a supporting document. It does not replace the SupplementScout Operating Plan. The Operating Plan remains the source of truth for priorities and execution.

## Executive summary

WheyWise appears to have achieved rapid catalogue growth through automation, broad ingestion, templated publishing, affiliate data, and lighter quality controls.

Its visible strengths are:

- fast retailer onboarding
- large declared catalogue
- broad SEO coverage
- price history
- simple value metrics
- product finder tools
- affiliate monetisation
- strong first impression

Its visible weaknesses are:

- inconsistent public catalogue counts
- inconsistent retailer counts
- duplicated brand names
- generic product descriptions
- occasional category errors
- unclear distinction between product, variant, offer, and result
- limited transparency around data quality
- limited treatment of delivered price
- shallow analysis outside core protein categories

The main lesson for SupplementScout is not to copy inflated scale. The lesson is to combine faster data acquisition with stronger normalization, verified variants, delivered-price calculations, and clearer decision support.

## Observed positioning

WheyWise presents itself as a UK supplement price comparison and discovery service.

Its customer promise centres on:

- finding lower prices
- comparing retailers
- tracking price history
- comparing unit economics
- recommending products
- helping users choose protein and supplements

The project appears to have expanded quickly from protein into creatine, pre-workout, amino acids, vitamins, and wellness products.

## Likely growth model

The most likely operating model is a hybrid ingestion system.

### Discovery

Potential discovery sources include:

- retailer sitemaps
- category pages
- affiliate product feeds
- retailer product feeds
- public storefront JSON
- structured Product data
- manually seeded product URLs

### Extraction

Likely extracted fields include:

- product name
- brand
- price
- previous price
- stock
- product URL
- image URL
- size
- flavour
- serving count
- nutrition data
- ingredients
- SKU
- GTIN

### Classification

The system likely assigns products to categories using rules, retailer categories, text matching, or automated classification.

### Calculations

Likely calculated metrics include:

- price per 100 g
- price per serving
- cost per 25 g protein
- protein density
- cost per 5 g creatine
- price change
- category-relative value

### Publishing

A common data model appears to feed:

- product pages
- brand pages
- category pages
- price history
- deals pages
- comparison pages
- finder tools
- SEO content
- related products

## Why the catalogue grew quickly

The declared product count probably includes a broad interpretation of catalogue entries.

A single base product may create several tracked entries through combinations of:

- size
- flavour
- retailer
- offer
- source listing

This makes rapid numerical growth possible without requiring thousands of perfectly normalized canonical products.

WheyWise appears willing to publish imperfect records and improve them later. This increases speed but creates visible duplication and classification issues.

## Likely data sources

### Affiliate networks

WheyWise discloses affiliate relationships including Amazon Associates and Awin.

Affiliate networks can provide:

- product feeds
- prices
- URLs
- images
- merchant categories
- product descriptions
- stock signals
- tracking links

This could explain fast catalogue growth for larger retailers.

### Retailer websites

WheyWise states that automated tools read prices from retailer sites.

Possible technical methods include:

- JSON-LD Product extraction
- Shopify product JSON
- WooCommerce structured data
- Open Graph metadata
- HTML parsing
- browser automation for JavaScript sites
- public retailer endpoints

### Hybrid workflow

The most likely workflow is:

- use feeds where available
- use reusable platform extraction where possible
- use retailer-specific collection only where necessary
- perform partial manual correction for high-value products

## Likely architecture

The public site is hosted on Vercel.

A plausible architecture is:

- React or Next.js frontend
- Vercel deployment
- relational database
- scheduled jobs
- Node.js or Python ingestion workers
- generated SEO pages
- charting for price history
- analytics and conversion tracking
- email infrastructure

The exact database and backend services are not publicly confirmed.

## Likely data model

### Product

- canonical name
- brand
- category
- slug
- description
- main image
- attributes
- rating fields

### Variant

- size
- flavour
- weight
- serving count
- serving size
- SKU
- GTIN
- variant image

### Retailer

- name
- domain
- affiliate programme
- retailer verification fields
- promotional rules

### Offer

- product or variant reference
- retailer reference
- current price
- previous price
- stock
- source URL
- affiliate URL
- checked timestamp
- shipping fields

### Nutrition

- protein
- calories
- carbohydrate
- fat
- sugar
- salt
- serving values
- ingredients
- allergens

### Price history

- offer reference
- price
- stock
- recorded timestamp
- calculated unit values

### Editorial and ranking fields

- product rating
- ingredient score
- clean-label score
- popularity
- click data
- deal score

## SEO strategy

WheyWise appears to use programmatic SEO at scale.

Likely page types include:

- product pages
- brand pages
- category pages
- retailer pages
- product comparison pages
- best-product pages
- cheapest-product pages
- discount-code pages
- price-history pages
- goal-based guides
- educational articles

The system likely injects live product data into templates, reducing the need to write each page manually.

This creates three advantages:

- fast index growth
- broad long-tail search coverage
- automatic commercial links from content to offers

## Strong features

### Cost per useful amount

Cost per 25 g protein is easy for customers to understand.

### Price history

Historical pricing creates trust and return visits.

### Finder tool

A short questionnaire simplifies product choice for users who do not understand labels.

### Broad retailer message

A high retailer count makes the site appear comprehensive.

### No-account browsing

Users can compare and leave without registration.

### Data-connected content

Product cards, prices, and recommendations can update centrally.

## Weaknesses and risks

### Inconsistent scale claims

Different pages appear to show different retailer and product counts.

This suggests stale templates or inconsistent aggregation.

### Naming duplication

Examples of repeated brand names indicate weak normalization between brand and external product name fields.

### Category leakage

Some non-protein products appear to receive protein-oriented descriptions.

This suggests template or classifier errors.

### Unclear entity boundaries

Public presentation does not always clearly distinguish:

- canonical product
- size
- flavour
- retailer listing
- offer
- tracked result

### Data verification uncertainty

Users cannot always see whether a value came from:

- manufacturer data
- retailer data
- a label image
- automated extraction
- manual verification

### Delivered price limitation

The lowest listed item price may not be the lowest final cost after shipping.

### Simplified category scoring

Metrics such as caffeine per pound or protein per pound are useful but incomplete for evaluating full formulations.

### Unclear popularity metrics

Metrics such as recent purchases require either affiliate conversion data or a defined proxy. Without an explanation, users cannot judge the meaning.

## Competitive threat level

WheyWise is a meaningful competitor because it is accumulating:

- indexed pages
- historical prices
- retailer relationships
- affiliate data
- brand recognition
- broad catalogue coverage

Its strongest long-term asset may be historical data, because a new competitor cannot instantly recreate earlier price records.

Its weakest long-term asset is data quality if the underlying product and variant structure remains inconsistent.

## Implications for SupplementScout

### Do not compete using a single inflated product count

SupplementScout should publish transparent metrics:

- canonical products
- variants
- active offers
- active retailers
- products with 2 or more retailers
- products with 3 or more retailers
- verified products
- affiliate-ready offers
- recently checked offers

### Primary coverage metric

The main commercial metric should be:

Products with at least 2 active retailers.

This measures real comparison value.

### Preserve strong normalization

SupplementScout should retain:

- one canonical product
- separate variants
- retailer-product mappings
- separate retailer offers
- variant-specific nutrition where required
- offer-specific price history
- audited merges
- explicit data quality states

### Add sources of truth

Public values should eventually display provenance such as:

- Manufacturer verified
- Retailer supplied
- Label verified
- Automatically extracted
- Needs review
- Last checked

### Win on delivered price

SupplementScout should rank using total delivered price where possible.

Example:

- Retailer A: £29.99 plus £4.99 shipping, total £34.98
- Retailer B: £32.99 with free shipping, total £32.99

Retailer B is the better final price.

### Win on useful-dose economics

Category-specific metrics should include:

- cost per serving
- price per kilogram
- cost per 25 g protein
- cost per 5 g creatine
- cost per effective dose of key ingredients

### Win on decision support

SupplementScout should explain:

- why one product ranks higher
- whether active ingredients are appropriately dosed
- key advantages
- key disadvantages
- better-value alternatives
- whether the current price is historically good
- which retailer offers the best delivered price

## Recommended response strategy

### Phase 1. Commercial coverage

Targets:

- 10 active retailers
- at least 1,000 canonical products
- at least 500 products with 2 or more active retailers
- at least 100 products with 3 or more active retailers

Focus:

- use existing CSV files
- add one retailer at a time
- prioritise overlap and affiliate value
- preserve safe importer controls

### Phase 2. Freshness

Build:

- scheduled price updates
- stock updates
- price history
- adapter monitoring
- error reporting

### Phase 3. Public comparison

Build:

- total delivered price
- sorting by delivered cost
- price per serving
- price per weight
- cost per useful dose
- visible freshness and provenance

### Phase 4. Decision engine

Build:

- formula comparison
- dose evaluation
- advantages and disadvantages
- better alternatives
- a short guided product finder

### Phase 5. SEO scale

Generate data-backed pages for:

- brands
- categories
- retailers
- ingredients
- goals
- product comparisons
- deals
- price history

## What to adopt

- faster retailer onboarding
- affiliate feeds
- reusable platform adapters
- data-driven SEO pages
- price history
- simple product finder
- brand and category landing pages
- automated content components

## What not to adopt

- counting variants as canonical products without disclosure
- weak naming normalization
- generic descriptions applied to incorrect categories
- unexplained popularity metrics
- ranking only by item price
- publishing nutrition without variant provenance
- treating every imported field as verified

## Immediate actions

1. Keep the Commercial Coverage Sprint as the current priority.
2. Create and maintain the Retailer Data Source Registry.
3. Audit every retailer for feeds before building scrapers.
4. Record platform compatibility and reusable adapters.
5. Track products with 2 or more retailers as the primary coverage metric.
6. Add delivered-price support before advanced AI recommendations.
7. Preserve variant and merge controls.
8. Plan programmatic SEO after sufficient multi-retailer coverage exists.
9. Use WheyWise as a recurring benchmark for speed, coverage, features, and SEO.
10. Review this document monthly or when WheyWise launches a material new capability.

## Monitoring checklist

Review monthly:

- declared product count
- declared retailer count
- new categories
- new retailer integrations
- price update frequency
- affiliate disclosures
- new finder or comparison tools
- new SEO page types
- changes to price-history features
- new data-quality claims
- changes in product naming quality
- changes in delivered-price treatment
- visible commercial partnerships

## Decision log

### 17 July 2026

- WheyWise is treated as a serious competitor, not as a blueprint to copy.
- SupplementScout will prioritise comparable coverage over raw catalogue size.
- SupplementScout will preserve stronger product, variant, offer, and audit structure.
- Faster retailer acquisition will be introduced through the Commercial Coverage Sprint and the Retailer Data Source Registry.
- Total delivered price and data provenance are selected as key differentiation opportunities.
