# SupplementScout eBay UK Offer Coverage Plan

**Workstream:** `eBay UK Offer Coverage`  
**Role:** durable technical source of truth subordinate to the SupplementScout Operating Plan  
**Status:** GTIN AUDIT COMPLETE — PILOT COHORT AND ACCESS STILL BLOCKED
**Last verified:** 13 August 2026  
**Production writes:** 0  
**Public changes:** 0

Every future eBay task must read this document first and continue from
`Current status` and `Next action`. Update the dated evidence and changelog
after every eBay task. Do not infer completion without recorded evidence.

## Goal

Add eBay UK as a controlled second-offer coverage layer for products and
variants that already exist in SupplementScout. The business KPI is the
increase in products with at least two qualified, independent retailer offers,
while preserving identity accuracy, delivered-price truth and user trust.

## Why eBay

The current catalogue has much greater breadth than comparison depth. A
marketplace can potentially supply overlapping offers where another specialist
retailer is absent. eBay is useful only when a listing is an exact match, is
deliverable to the UK, has a trustworthy seller, has a known delivered price
and is eligible for compliant tracking.

## What eBay must not do

- It must not mass-create canonical products or variants.
- It must not turn title similarity into automatic product identity.
- It must not surface auctions, used/opened/damaged/refurbished items,
  classified listings, samples, ambiguous bundles or mismatched packs.
- It must not publish more than one active eBay offer for a canonical
  product/variant.
- It must not publish an unknown-shipping offer as a best delivered price.
- It must not write to production or change public UI before a separate owner
  approval following the read-only pilot.

## Current status

`ETAP 0–5 DESIGN/AUDIT COMPLETE`. Repository, data model, coverage, importer,
matching controls, secret conventions and current official eBay requirements
were audited. No eBay account status can be inferred from the repository.

The intended 100-record exact-GTIN pilot is currently blocked for two separate
reasons:

1. eBay/EPN account, keyset and Buy API access status is unknown and requires
   user confirmation/action.
2. Canonical fields still contain only 9 active product GTINs and 0 variant
   GTINs. The read-only GTIN recovery audit found 14 `AUTO_SAFE` variant-GTIN
   identities across 13 products, but only 2 of those products currently have
   exactly one positive-price in-stock retailer. A truthful 100 exact-GTIN
   cohort still cannot be selected.

## Completed

- [x] Repository and operating-document audit.
- [x] Product, variant, retailer, mapping, offer and price-history schema audit.
- [x] Read-only production coverage and GTIN baseline.
- [x] Existing importer, matching, review, refresh and secret-path audit.
- [x] Read-only recovery audit of existing GTIN and barcode evidence.
- [x] Marketplace architecture recommendation.
- [x] Conservative offer and matching policy proposal.
- [x] Official eBay Developer and EPN requirements review.
- [x] User registration checklist.
- [x] Read-only 100-record pilot specification.
- [ ] eBay/EPN account access confirmed.
- [ ] Pilot cohort of 100 verified canonical GTIN identities available.
- [ ] Read-only API pilot executed.
- [ ] Pilot quality reviewed by owner.
- [ ] Production pilot designed or approved.

## Baseline — read-only production evidence

Captured `2026-08-13T12:34:50Z` using only the public Supabase URL and anonymous
key. No service-role credential was used and no writes were made. “Qualified
for baseline” means active canonical product, positive item price and in-stock
offer. The separate 24-hour view also requires `last_checked_at` within 24
hours. Counts are evidence for this date, not timeless constants.

### Catalogue and GTIN

| Measure | Count | Coverage |
|---|---:|---:|
| Active unmerged canonical products | 1,070 | 100% |
| Active variants under those products | 2,586 | 100% |
| Active products with canonical GTIN | 9 | 0.84% |
| Active products without canonical GTIN | 1,061 | 99.16% |
| Distinct product GTIN values | 9 | — |
| Product rows using duplicated GTIN | 0 | — |
| Active variants with canonical GTIN | 0 | 0% |
| Active variants without canonical GTIN | 2,586 | 100% |

All nine canonical GTINs are unique. They currently belong to GYM HIGH
products. Two have exactly one active retailer, five have two and two have
three. Therefore the exact desired intersection — verified GTIN plus exactly
one existing retailer — currently has only 2 records, not 100.

Retailer-source `external_gtin` is a separate evidence field and must not be
silently copied into canonical product or variant GTIN. Variant GTIN is
explicitly variant-level evidence in the schema.

### Product-level offer coverage

| Active retailer count | Positive-price in-stock | Fresh within 24h |
|---|---:|---:|
| 0 | 197 | 639 |
| 1 | 761 | 413 |
| 2 | 96 | 17 |
| 3+ | 16 | 1 |
| Total products | 1,070 | 1,070 |

There are 112 products with at least two positive-price in-stock retailer
offers, but only 18 with at least two such offers checked within 24 hours.
The eBay workstream must report both broad active coverage and current/fresh
coverage rather than mixing them.

### Variant-level offer coverage

| Active retailer count | Positive-price in-stock | Fresh within 24h |
|---|---:|---:|
| 0 | 741 | 1,849 |
| 1 | 1,668 | 718 |
| 2 | 155 | 17 |
| 3+ | 22 | 2 |
| Total variants | 2,586 | 2,586 |

The production read also found 2,524 offer rows, 2,046 positive-price in-stock
offers, 758 of those fresh within 24 hours, 2,677 price-history rows and nine
retailers. None of the nine retailer rows has `affiliate_id` or
`affiliate_network` configured.

The anonymous role cannot read `retailer_products` under current production
RLS. The follow-up GTIN audit therefore used the existing local service-role
configuration for SELECT-only reads at `2026-08-13T14:07:38Z`. It performed no
insert, update, delete, RPC, migration or public change.

## Existing-data GTIN recovery audit

This audit distinguishes source evidence from canonical fields. A normalized
source value removes spaces and hyphens only; it must then be exactly 8, 12,
13 or 14 digits and pass the GS1 check-digit calculation. Counts below cover
active mappings to active, unmerged products and active variants.

### Source baseline

| Existing source | Records/identities | GTIN evidence |
|---|---:|---:|
| Active `retailer_products` | 2,524 | 787 rows with `external_gtin` |
| Distinct normalized `external_gtin` | — | 769 |
| Valid mapping rows / distinct valid GTINs | 782 | 764 distinct |
| Active canonical products reached by any mapping GTIN | 414 | 410 with at least one valid GTIN |
| Active variants reached by any mapping GTIN | 773 | 768 with at least one valid GTIN |
| `products.gtin` | 9 active products | 9 valid, unique GTIN-13 values |
| `product_variants.gtin` | 2,586 active variants | 0 populated |
| `product_match_review_queue.source_gtin` | 141 queue rows | 18 rows / 15 distinct source values |

The review queue and repository CSV/JSON artifacts are provenance or staging
views of retailer evidence, not additional canonical identities. Repository
search also found GTIN/barcode-bearing retailer configs and feeds, adapters,
the bulk snapshot contracts, migrations and admin review UI. No separate
completed GTIN-promotion or barcode-enrichment pipeline exists.

For the 764 valid product-GTIN identities, retailer confirmation is:

| Independent retailers confirming the same product-GTIN | Identities |
|---|---:|
| 1 | 749 |
| 2 | 15 |
| 3+ | 0 |

Rolled up to canonical products, 396 products have only one-retailer support
for their best-supported GTIN, 14 have at least one same-GTIN confirmation from
two retailers, and 0 have a three-plus-retailer confirmation.

Different flavours, sizes and packs under one canonical product legitimately
produce different GTINs. After grouping by exact canonical variant, there are
754 single-retailer targets, 14 two-retailer targets and 0 three-plus-retailer
targets. There are 0 exact-variant cases where retailers disagree by supplying
different valid GTINs, and 0 valid GTINs used by more than one canonical
product.

### Validation classification

The following categories are mutually exclusive and account for all 787
mapping rows with a non-empty `external_gtin`:

| Classification | Mapping rows | Meaning |
|---|---:|---|
| `VALID` | 776 | Valid checksum and one unambiguous canonical variant target |
| `INVALID_CHECKSUM` | 3 | Supported length but failed check digit |
| `INVALID_LENGTH` | 2 | 10- or 11-digit value |
| `CONFLICT` | 0 | No cross-product reuse or retailer disagreement on one exact variant |
| `AMBIGUOUS_VARIANT` | 6 | Valid GTIN reused across multiple variants of one product |

The six ambiguous rows are confined to product 364. GTIN `5904067876088`
maps both to its default variant and the exact Apple Cinnamon / 1 kg variant.
GTIN `5904067876118` appears on four different flavour variants even though
all four source names say Apple Cinnamon. None may be promoted automatically.

### Product versus variant decision

Use option **C: both, according to the trade item**, with the variant as the
default destination for recovered retailer GTINs:

- every one of the 782 valid retailer mapping rows already points to an
  explicit canonical variant;
- 478 distinct valid GTINs are clearly variant-level because they are attached
  to a non-default variant or to a product family having multiple GTINs;
- flavour, size, weight, unit count, format and pack count can change the trade
  item and therefore its barcode;
- a product-level GTIN is acceptable only for a genuinely single-trade-item
  product whose default variant has exactly the same identity;
- never copy `retailer_products.external_gtin` blindly into either canonical
  field. The current schema already has `product_variants.gtin`, so no new
  column or migration is needed before a reviewed promotion design.

### Promotion candidates

Candidate counts use mapping rows for a complete reconciliation and also show
the deduplicated identities relevant to eBay:

| Decision | Source rows | Deduplicated result | Rule |
|---|---:|---:|---|
| `AUTO_SAFE` | 28 | 14 variant-GTIN identities / 13 products | Two independent retailers, valid checksum, one exact target, and matching brand, name, size/count, flavour and format evidence |
| `REVIEW` | 748 | 748 variant-GTIN identities | Valid and unambiguous, but supported by only one retailer |
| `REJECT` | 11 | 11 mapping targets | 5 invalid values plus 6 ambiguous/conflicting variant assignments |

`AUTO_SAFE` is deliberately conservative. It includes the two exact Critical
Cookie 85 g flavours, Applied Nutrition Creatine 120 Capsules, two KIOR 60-cap
products and nine GYM HIGH identities. It does not treat a correct checksum as
proof of product identity.

### eBay pilot impact

The 14 `AUTO_SAFE` identities cover 13 of 1,070 active products (1.21%) and 14
of 2,586 active variants (0.54%). All 14 are usable as exact-GTIN lookup inputs
for a bounded read-only pilot, but only 2 currently intersect the desired
exactly-one-positive-price-in-stock-retailer cohort: GYM HIGH ZMB 60 Capsules
and GYM HIGH Creatine Monohydrate Powder 250 g.

The present exact-GTIN cohort is therefore 14, not 100, leaving 86 identities
to reach the planned sample. For the primary coverage KPI, only the 2
single-retailer intersections can add a second retailer. The broad baseline is
112 products with 2+ positive-price in-stock offers; the mathematical maximum
after a fully successful two-record eBay intersection would be 114. This is a
ceiling, not a forecast: the audit does not assume either listing exists or
qualifies on eBay. The fresh-24-hour baseline remains 18 and must not be mixed
with the broad count.

### Reuse decision and external enrichment

Recommendation **B: existing data partially suffices; run a small, bounded
GTIN enrichment sprint before the 100-record pilot**. Existing mechanisms to
reuse are:

- retailer adapters and CSV/feed `external_gtin` capture;
- the canonical snapshot GTIN index and exact-GTIN matcher;
- `SAFE_EXISTING_VARIANT`, quarantine and collision controls;
- `product_match_review_queue` plus the existing admin review screen;
- importer dry-run, immutable approval artifact, atomic apply and duplicate
  protections.

`SAFE_UPDATE` classification exists for approved volatile offer changes, but
production `SAFE_UPDATE` remains disabled and is not a GTIN-promotion path.

Do not build a second importer or a parallel review framework. The missing
piece is a reusable GTIN-8/12/13/14 checksum-and-classification gate plus a
reviewed promotion step into the already existing variant field. The current
snapshot contract names invalid-GTIN reason codes, but repository search found
no implemented reusable checksum validator. External lookup was not performed
in this audit. A later approved sprint should first review existing one-source
evidence, then obtain a second authoritative source only for a bounded priority
cohort, starting with products that have exactly one active retailer.

## Relevant SupplementScout model

### Canonical identity

- `products`: canonical name, brand, category, GTIN, active/merge state,
  net weight, unit count and product format.
- `product_variants`: parent product, variant key/display name, flavour,
  size/unit, pack count, format, GTIN, active/default state.
- `products.gtin` has a partial unique index for non-empty values.
- `product_variants.gtin` has an index but is not globally unique; it is
  variant-level evidence and must be validated in context.

### Retailer identity and offers

- `retailers`: stable retailer ID/name/slug/site plus affiliate network/ID.
- `retailer_products`: one source-to-canonical mapping with product and optional
  variant ID; external product ID, variant ID, SKU, GTIN, URL, source options,
  match method and confidence.
- External variant identity is unique within a retailer when non-null.
- `offers`: mapping, product, optional variant, retailer, item price, shipping,
  delivered total, stock, URL and `last_checked_at`.
- One offer is bound to one `retailer_product`; price history records item,
  shipping and total price at `checked_at`.

This can represent eBay as retailer `eBay` and each selected listing as one
mapping/offer. It cannot currently store marketplace seller username,
feedback, score, account type or listing-selection audit as first-class fields.
Those marketplace-specific facts need a reviewed extension before production.
They must not be overloaded into retailer ID, retailer name or unrelated
external fields.

## Existing mechanism audit

The repository already contains:

- Shopify adapters for Discount Supplements, Fit House, KIOR and Jon's;
- a WooCommerce adapter for 6 Pack Supplements;
- generic CSV/feed import with dry-run, immutable approval artifact and atomic
  apply;
- existing-product and explicit-variant mapping paths;
- external product/variant/SKU/GTIN collision prevention;
- canonical product/variant validation and duplicate controls;
- `product_match_review_queue` plus admin review decisions;
- existing-offer classification for no-change, price, stock and URL updates;
- stale/collapsed source, identity drift, mass-change, price and OOS guards;
- price history only when delivered-price inputs change;
- separate validator/approver/executor paths and replay protection.

### Reuse decision

Choose **B: a special marketplace adapter**, feeding the existing guarded
SupplementScout import/control plane.

Do not implement a second importer. The marketplace adapter has extra
responsibilities before it is allowed to emit a standard candidate row:

1. query and normalize eBay data;
2. enforce marketplace/listing/seller/delivery filters;
3. match only to an existing canonical identity;
4. rank/select at most one qualifying eBay listing per product/variant;
5. retain seller and selection evidence;
6. emit read-only pilot rows first;
7. later, only after approval, pass reviewed rows into the existing dry-run,
   approval and atomic import path.

Seller replacement means changing the selected external listing identity, not
ordinary price refresh. It requires its own reviewed marketplace transition
contract and audit trail.

## Proposed offer qualification policy

Every required condition must pass. Initial values are conservative proposals
to validate during the pilot, not production thresholds.

### Marketplace and delivery

- `listingMarketplaceId = EBAY_GB`.
- Delivery country must include GB; the API query must use
  `deliveryCountry:GB`.
- Use a controlled UK contextual postcode for calculated shipping evidence.
- Currency must be GBP; VAT-inclusive price context must be requested for GB.
- Item price and UK shipping must both be known; delivered price is their sum.
  Unknown shipping blocks `AUTO_ELIGIBLE` and best-delivered-price ranking.

### Listing

- Must contain `FIXED_PRICE` buying option.
- Must be `NEW`; reject used, opened, damaged, refurbished or unspecified when
  new condition cannot be proven.
- Reject auction-only, classified, samples, single sachets, unrelated bundles,
  ambiguous multipacks and any listing whose title/aspects contradict the
  canonical pack, size, flavour, format or formulation.

### Seller

- Capture username, feedback percentage, feedback score and account type.
- Pilot starting screen: feedback percentage at least 98%; do not finalize a
  minimum feedback score until the 100-record distribution is reviewed.
- Missing seller quality fields blocks automatic eligibility.
- Prefer business sellers in the pilot report, but do not declare that a final
  hard rule until results and eBay terms are reviewed.

### Selection

- Rank only listings that already passed identity and quality filters.
- Select at most one eBay listing per canonical product/variant.
- Proposed deterministic order for analysis: complete delivered price, then
  seller-quality threshold, then lowest delivered price, then higher feedback
  score, then stable item ID. This is a SupplementScout internal selection
  proposal and must be checked against the approved Buy API use case before
  production; eBay's Buy API requirements can restrict re-sorting in certain
  buying experiences.

## Matching policy

### Tier A — exact GTIN

`AUTO_ELIGIBLE` for the read-only pilot only when all are true:

- exact canonical product/variant GTIN equals eBay-returned GTIN;
- brand agrees after conservative normalization;
- size, flavour, unit count, pack count and format agree where applicable;
- title and aspects contain no contradiction;
- all offer and seller qualification rules pass.

### Tier B — GTIN with conflicting or incomplete validation

Exact GTIN exists but brand, size, flavour, units, format or title is incomplete
or suspicious. Decision is `REVIEW`, never automatic.

### Tier C — no canonical or returned GTIN

Report as discovery-only. Decision is `REVIEW` or `REJECT`; never import
automatically in the first phase. Name/brand/weight/flavour/unit matching may
help a reviewer later but cannot upgrade the row to Tier A.

### Hard blockers

- 250 g versus 500 g;
- 60 capsules versus 120 capsules;
- one tub versus a two-pack;
- different flavour when flavour defines the variant;
- powder versus capsules/tablets/liquid;
- different formulation/generation;
- ambiguous old/new pack transition;
- GTIN collision or conflict;
- listing title/aspects contradict the canonical identity.

## eBay/EPN/API requirements — official-source review

Verified 13 August 2026. Account status remains unknown because no login or
credential use was authorized.

### Developer and Browse API

- Join the eBay Developers Program and create separate Sandbox and Production
  application keysets. A keyset contains client/Application ID, Dev ID and
  confidential Cert ID/client secret.
- Browse API supports `EBAY_GB`, can search by GTIN and requires an Application
  access token obtained with the OAuth client-credentials flow.
- Sandbox Buy APIs are generally available to developer accounts, with noted
  checkout exceptions. Sandbox data is test data, so it can validate transport,
  schemas and filters but cannot measure real UK supplement coverage.
- Production Buy API use is not automatically granted. eBay documents an EPN
  business-model approval, Buy API application, support ticket, application
  review, requested changes and contracts before production enablement. There
  is no guarantee of approval.
- Production keysets also have marketplace account deletion/closure
  notification compliance requirements before use.

Official references:

- https://developer.ebay.com/api-docs/buy/buy-requirements.html
- https://developer.ebay.com/api-docs/buy/browse/overview.html
- https://developer.ebay.com/api-docs/buy/ref-marketplace-supported.html
- https://developer.ebay.com/api-docs/static/gs_create-the-ebay-api-keysets.html
- https://developer.ebay.com/api-docs/static/oauth-token-types.html
- https://developer.ebay.com/api-docs/buy/static/ref-buy-browse-filters.html

### EPN and affiliate links

- EPN acceptance and SupplementScout's business/promotional method must be
  confirmed; do not assume price-comparison approval.
- Campaign ID is required for EPN tracking. For REST Buy APIs it is supplied as
  `affiliateCampaignId` in `X-EBAY-C-ENDUSERCTX`; optional reference/custom ID
  can identify a placement.
- Browse can return `itemAffiliateWebUrl`; this is the URL EPN affiliates must
  use for commission attribution when available under the documented request
  conditions.
- Affiliate disclosure is required globally and, for UK users, must make the
  advertising relationship clear and be close to the promotional link. A
  footer-only or linked disclosure page is not sufficient.

Official references:

- https://partnernetwork.ebay.com/resources/create-your-affiliate-link
- https://partnernetwork.ebay.com/solutions/optimizing-using-tracking-parameters
- https://partnernetwork.ebay.com/resources/affiliate-disclosure-faq
- https://partnernetwork.ebay.com/page/network-agreement
- https://developer.ebay.com/api-docs/buy/api-browse.html

## USER ACTION REQUIRED

Do not mark a box from repository evidence. The owner must confirm each status.

### EPN

- [ ] `UNKNOWN — USER ACTION REQUIRED`: confirm an ordinary eBay account exists
  and record only `DONE`/`NOT STARTED`, never credentials.
- [ ] `UNKNOWN — USER ACTION REQUIRED`: confirm or create an eBay Partner
  Network account.
- [ ] `USER ACTION REQUIRED`: complete accurate person/company, payment/tax and
  contact information requested by EPN.
- [ ] `USER ACTION REQUIRED`: register SupplementScout and describe its website
  price-comparison/promotional method truthfully.
- [ ] `USER ACTION REQUIRED`: read and accept current EPN agreements/policies.
- [ ] `USER ACTION REQUIRED`: obtain explicit EPN/Buy API business-model
  approval where required; retain the approval email outside Git.
- [ ] `USER ACTION REQUIRED`: create/select a Campaign ID.
- [ ] `USER ACTION REQUIRED`: keep Campaign ID outside Git as private runtime
  configuration.
- [ ] `USER ACTION REQUIRED`: confirm the required UK disclosure placement
  before any public affiliate link is introduced.

### Developer

- [ ] `UNKNOWN — USER ACTION REQUIRED`: confirm or create an eBay Developers
  Program account.
- [ ] `USER ACTION REQUIRED`: create the SupplementScout application/keyset.
- [ ] `USER ACTION REQUIRED`: create Sandbox credentials and, when eligible,
  Production credentials.
- [ ] `USER ACTION REQUIRED`: configure required account deletion/closure
  notification compliance for Production keys.
- [ ] `USER ACTION REQUIRED`: store client ID, client secret and access tokens
  only in approved secret storage, never in Git or documentation.
- [ ] `USER ACTION REQUIRED`: confirm the Browse scope and generate a Sandbox
  Application token using client credentials.

### Production access

- [ ] `BLOCKED`: complete Sandbox transport/schema/filter tests.
- [ ] `USER ACTION REQUIRED`: submit the Buy API application with an accurate
  business model, mocks and data flows.
- [ ] `USER ACTION REQUIRED`: reply to the confirmation email with requested
  application evidence.
- [ ] `USER ACTION REQUIRED`: after EPN approval, open the documented Developer
  Support ticket titled `Buy API Production Access (eBay user ID)` and include
  the EPN user ID, Sandbox test instructions and EPN approval email.
- [ ] `USER ACTION REQUIRED`: complete compliance review, requested changes and
  contracts.
- [ ] `BLOCKED`: confirm Production Browse API is enabled before any real-data
  pilot.
- [ ] `BLOCKED`: separately confirm whether an Application Growth Check is
  required for the expected call volume; it does not replace Buy API production
  approval.

## Secret handling

Current repository convention uses ignored `.env*.local` files for local
configuration, GitHub Environment/Repository Secrets for workflows, and
role-specific credential files outside the repository for production control
paths. No eBay secret currently exists or is inferred.

Proposed names, only after access is approved:

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_MARKETPLACE_ID=EBAY_GB` (non-secret configuration)
- `EBAY_EPN_CAMPAIGN_ID`
- `EBAY_UK_DELIVERY_POSTCODE` (private operational configuration)

Do not persist short-lived OAuth access tokens in Git. Mint and cache them at
runtime within their lifetime. Never print client secret, access token or full
Authorization headers in reports or CI logs.

## Read-only pilot specification — target 100 verified GTIN identities

### Entry gate

Do not run until:

- Production Browse API eligibility and credentials are confirmed, or the
  owner explicitly accepts that a Sandbox-only transport test cannot measure
  real coverage.
- A reproducible list of 100 active existing canonical product/variant
  identities with owner-verified GTIN exists.
- No write credentials are present in the pilot process.
- Output goes only to ignored local `tmp/ebay-uk-coverage/`.

Because only 9 active products currently have canonical GTIN, the 100-record
cohort is a target specification, not an available list. Do not pad it with
retailer barcodes, title-only matches or products already having broad coverage.

### Cohort selection

Select deterministically in this order:

1. active, unmerged canonical product/variant with verified canonical GTIN;
2. exactly one positive-price in-stock current retailer, preferring offers
   fresh within 24 hours;
3. complete brand plus size/weight/unit/format identity;
4. categories: Creatine, Whey Protein, Vitamins, Magnesium/Health Supplements,
   Hydration/Electrolytes and Pre Workout;
5. stable product ID then variant ID tie-breaker.

If fewer than 100 qualify, report the actual count and stop. Never weaken the
gate to reach 100.

### API request policy

- Marketplace header `X-EBAY-C-MARKETPLACE-ID: EBAY_GB`.
- Search by exact GTIN.
- Filters must include delivery to GB, NEW condition and FIXED_PRICE buying
  option.
- Supply controlled GB contextual location/postcode for shipping evidence.
- Do not include EPN tracking in the first technical call unless EPN is
  approved and the Campaign ID is safely configured.
- Follow result with item detail only where needed to validate aspects,
  condition, seller, shipping and listing identity.
- Preserve raw responses locally with secrets/headers removed and record
  capture time plus request-policy fingerprint.

### Output row

Each of the 100 requested identities (or every available qualifying identity
when fewer) must report:

- SupplementScout product ID and variant ID;
- product/variant name, brand, canonical GTIN and category;
- size, weight, flavour, unit count, pack count and format evidence;
- current distinct retailer count and current best delivered price;
- found yes/no and number of raw eBay candidates;
- selected eBay REST item ID and legacy item ID;
- title, marketplace, condition and buying options;
- seller username, account type, feedback percentage and score;
- item price, UK shipping and delivered price with currency;
- returned GTIN, brand and localized size/variant aspects;
- match tier/confidence and exact evidence;
- seller/listing/delivery blocker codes;
- decision: `AUTO_ELIGIBLE`, `REVIEW` or `REJECT`;
- whether eBay would be the second retailer and whether its delivered price is
  lower than the current best.

### Pilot guarantees

- 0 writes to `products`, `product_variants`, `retailers`,
  `retailer_products`, `offers` or `price_history`.
- 0 public UI, sitemap or structured-data changes.
- 0 account creation and 0 production automation.
- No automatic eligibility for Tier B or Tier C.
- One selected eBay candidate maximum per canonical product/variant.

## Pilot KPI and success gate

Record exact denominators and counts:

- checked, found, exact-GTIN, fully qualified and safely addable;
- Tier A/B/C and each rejection/blocker reason;
- seller feedback percentage and score distributions before choosing final
  thresholds;
- manual-review accuracy on a predeclared sample, including false positives;
- number for which eBay would become the second retailer;
- number for which eBay is the lowest complete delivered price;
- median delivered-price difference from current best;
- products still single-retailer after the pilot.

Primary KPI: `increase in products with 2+ qualified offers`.

No broad automation if manual review finds meaningful false positives. A later
production pilot remains separately blocked and must be capped at 20–30
owner-reviewed offers with exact evidence, affiliate URL, dry-run, preview,
rollback and explicit approval.

## Future production checklist

- [ ] Read-only pilot evidence complete and owner accepted.
- [ ] Final seller threshold chosen from pilot distribution.
- [ ] EPN/Browse production access and disclosure accepted.
- [ ] Marketplace seller/listing audit fields designed without field abuse.
- [ ] At-most-one-eBay-offer constraint and replacement audit designed.
- [ ] Existing importer compatibility proved with tests.
- [ ] Dry-run contains exact canonical, listing, seller and delivered-price
  evidence.
- [ ] Maximum 20–30 rows manually reviewed.
- [ ] Staging apply and rollback verified.
- [ ] Explicit owner approval for production scope.
- [ ] Live mappings/offers and public presentation separately verified.
- [ ] Refresh, disappearance and seller replacement monitoring approved.

## Risks and open problems

- Canonical GTIN coverage remains 0.84% at product level and 0% at variant
  level; 14 recovered identities are safe candidates but have not been written.
- Another 748 valid mapping identities have only one retailer source and must
  not be promoted automatically without review or stronger evidence.
- eBay seller listings can be incorrect even when a GTIN is supplied.
- Seller/listing identity can change between refreshes.
- Shipping can depend on postcode and may be missing or calculated.
- Pack, flavour, formulation and condition ambiguity create false positives.
- Current schema lacks first-class marketplace seller and selection evidence.
- Production Browse API and price-comparison business-model approval are not
  known.
- Affiliate disclosure requires a future public design change, separately
  approved.
- eBay API beta/contract and field behavior can change; reverify official docs
  before implementation.
- Marketplace result sorting/selection must be reconciled with the exact
  approved eBay use case and current Buy API requirements.

## Blockers

- `USER ACTION REQUIRED`: confirm EPN and Developer account status.
- `USER ACTION REQUIRED`: pursue EPN/Buy API production approval.
- `DATA BLOCKED`: only 14 recovered identities meet `AUTO_SAFE`, leaving 86
  identities before the planned 100-record exact-GTIN cohort; only 2 of the 14
  currently have exactly one positive-price in-stock retailer.
- `DESIGN BLOCKED`: seller/listing metadata storage awaits pilot evidence and
  separate approval.

## Next action

`OWNER APPROVAL REQUIRED — do not start automatically:` approve a small,
read-only-first GTIN enrichment sprint that reuses the existing snapshot,
review queue, admin review and guarded importer. Its bounded goal is to review
the 748 one-source identities in priority order, seek second authoritative
evidence only for the single-retailer cohort, and produce at least 86 further
exact variant-GTIN candidates without writing production data. In parallel,
the owner must report EPN and eBay Developers account status as `DONE` or
`NOT STARTED`. API implementation and the production pilot remain out of scope.

Do not proceed to that next task without explicit owner confirmation.

## Last verified

13 August 2026:

- `npm run verify:project` passed after the GTIN audit documentation update.
- The initial production baseline was collected through the anonymous public
  client. The GTIN recovery follow-up used the existing local service role for
  SELECT-only access because RLS hides retailer mappings from anonymous reads.
- GTIN-8/12/13/14 length and check digits were evaluated locally; no external
  GTIN lookup was performed.
- Official eBay Developer and EPN pages linked above were checked on this date.
- Repository search found no existing eBay adapter, eBay credential convention,
  eBay retailer or completed eBay account-status record.
- No API implementation, account action, database write, migration, public
  change, commit or push was performed.

## Decision changelog

### 13 August 2026

- Audited all existing GTIN sources and recorded the 787-row retailer mapping
  baseline, checksum results, conflicts and product-versus-variant decision.
- Classified 28 source rows into 14 `AUTO_SAFE` identities, 748 as `REVIEW`
  and 11 as `REJECT`; kept all production promotion blocked.
- Chose recommendation B: reuse the existing guarded identity pipeline for a
  bounded enrichment sprint rather than build a duplicate framework.
- Created the durable eBay UK coverage workstream.
- Chose special marketplace adapter plus reuse of the existing guarded import
  control plane; rejected a second importer and a retailer-ID hack.
- Bound the first automatic matching tier to exact canonical GTIN plus semantic
  validation and hard blockers.
- Recorded the 1,070-product / 2,586-variant baseline and the 9-product /
  0-variant canonical GTIN constraint.
- Kept all account, API, database, UI and production work blocked.
- Recorded zero production writes and zero public changes.
