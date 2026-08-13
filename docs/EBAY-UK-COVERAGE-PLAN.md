# SupplementScout eBay UK Offer Coverage Plan

**Workstream:** `eBay UK Offer Coverage`  
**Role:** durable technical source of truth subordinate to the SupplementScout Operating Plan  
**Status:** AUDIT COMPLETE — ACCESS SETUP BLOCKED ON USER ACTION  
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
2. Production contains only 9 active canonical products with a GTIN and 0
   active canonical variants with a GTIN. Only 2 of those 9 products currently
   have exactly one positive-price in-stock retailer. A truthful 100 exact-GTIN
   cohort cannot yet be selected.

## Completed

- [x] Repository and operating-document audit.
- [x] Product, variant, retailer, mapping, offer and price-history schema audit.
- [x] Read-only production coverage and GTIN baseline.
- [x] Existing importer, matching, review, refresh and secret-path audit.
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

`retailer_products` is not readable to the anonymous role in the current
production RLS configuration, so no live mapping total or field-completeness
claim is made from that read. Mapping structure and constraints below are
verified from the repository schema and migrations.

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

- Canonical GTIN coverage is only 0.84%; this is the immediate data blocker.
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
- `DATA BLOCKED`: only 9 active canonical products and 0 active variants have
  canonical GTIN; only 2 GTIN products have exactly one active retailer.
- `DESIGN BLOCKED`: seller/listing metadata storage awaits pilot evidence and
  separate approval.

## Next action

`USER ACTION REQUIRED — do not implement API code yet:` the owner must report
the status of the EPN account and eBay Developers account as `DONE` or
`NOT STARTED`, then begin/complete the registration and Buy API access checklist
above. After credentials/access status is known, the next separately approved
task is a credentials-free Sandbox transport/schema test plan plus a bounded
canonical-GTIN coverage plan; it is not the production pilot.

Do not proceed to that next task without explicit owner confirmation.

## Last verified

13 August 2026:

- `npm run verify:project` passed after both documentation changes.
- The production baseline was collected through the anonymous public client;
  service-role and write credentials were not used.
- Official eBay Developer and EPN pages linked above were checked on this date.
- Repository search found no existing eBay adapter, eBay credential convention,
  eBay retailer or completed eBay account-status record.
- No API implementation, account action, database write, public change, commit
  or push was performed.

## Decision changelog

### 13 August 2026

- Created the durable eBay UK coverage workstream.
- Chose special marketplace adapter plus reuse of the existing guarded import
  control plane; rejected a second importer and a retailer-ID hack.
- Bound the first automatic matching tier to exact canonical GTIN plus semantic
  validation and hard blockers.
- Recorded the 1,070-product / 2,586-variant baseline and the 9-product /
  0-variant canonical GTIN constraint.
- Kept all account, API, database, UI and production work blocked.
- Recorded zero production writes and zero public changes.
