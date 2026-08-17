# SupplementScout eBay UK Offer Coverage Plan

**Workstream:** `eBay UK Offer Coverage`  
**Role:** durable technical source of truth subordinate to the SupplementScout Operating Plan  
**Status:** CONTROLLED 31-OFFER ROLLOUT LIVE VERIFIED (BATCH A 5/5 + BATCH B 5/5 + BATCH C 7/7 + BATCH D 2/2 + BATCH E 1/1 + BATCH F 2/2 + BATCH G 9/9)
**Last verified:** 17 August 2026
**Production writes:** 31 owner-approved create plans plus 94 exact existing-offer verification refreshes (1 retailer, 31 mappings, 31 offers, 31 price-history rows; latest refresh changed verification timestamps only)
**Public changes:** 1 guarded account-deletion API route and 31 live eBay offers

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

Design, audit, Developers/EPN access, Production keyset compliance, the
read-only Browse pilot and the controlled 31-offer rollout are complete. The
existing adapter and guarded importer remain the only approved paths. Current
production evidence includes the 17 August 2026 exact-offer refresh and
postflight below. The exact-31 daily refresh is enabled at `05:43 UTC`; each
row continues to fail closed independently if its approved identity or safety
evidence changes. Batch G added exactly nine owner-reviewed listings across
nine variants and eight products after direct item-ID preflight. All nine are
now part of the same guarded exact-31 scheduled refresh manifest; missing GTIN
remains explicit evidence and is accepted only for the exact approved item,
business seller and reviewed metadata-gap set. No second scheduler or importer
was introduced.
Credential values remain outside the repository.

The guarded GTIN release is complete. The pilot cohort is exactly 54 active
canonical variant identities with safe canonical GTINs: 45 promoted and 9
already present; 16 conflicts remain quarantined and outside the cohort. The
read-only Browse API adapter, policy engine, immutable input/report artifacts
and mock-only tests are implemented. The initial live production pilot completed on
14 August 2026 for all 54 identities, fingerprint
`9d277525865ebaf7ce33e435db6ce1c9348b576a19e5c05e4168f5b549a1a885`,
with 10 identities found: 2 `AUTO_ELIGIBLE`, 3 `REVIEW`, 5 `REJECT` and 44
`NOT_FOUND`. Both safe offers would add a second retailer and were cheaper than
the current complete delivered price. That historical pilot made 0 database
writes, 0 offer or retailer-mapping changes and 0 public changes. Affiliate
tracking was not configured at that checkpoint; it was configured before the
later guarded rollouts. No eBay credential is stored in the repository. The
historical 100-identity target remains unavailable and must not be reached by
weakening the identity gate.

The owner accepted the bounded quality review on 14 August 2026. The two
`AUTO_ELIGIBLE` rows passed review for inclusion in a future production-pilot
design only. Solgar 60 Tablets is rejected because the selected listing is 120
tablets. Applied Nutrition Creatine 120 Capsules and Per4m Pre-Workout Stim
570g Berry Blast remain `REVIEW` because the selected listings did not return
their GTINs. This approval is not authority to write or publish an offer.

A scaled continuation of the same read-only mechanism then checked 355 new
one-retailer variant GTIN identities across 150 products and a bounded title
fallback for products missed by exact-GTIN search. Across the original pilot
and both discovery artifacts, eBay listing evidence now exists for 144 unique
products, exceeding the owner's 50-product discovery target. This is not 144
safe offers: only 46 products have an eBay-returned exact GTIN, 36 of those are
from an independent eBay seller, and current automatic plus owner-reviewed
gates leave 12 strong independent candidates including the original two. No
offer was written or published.

On 14 August 2026 the owner approved the exact 10 new strong independent
candidates for a controlled `5 + 5` rollout design. Revalidation against the
sealed title-discovery report found 10 unique products, variants and eBay
listings; all 10 remain `AUTO_ELIGIBLE`, have the exact returned GTIN, are new
fixed-price `EBAY_GB` business-seller listings and have zero blockers or review
reasons. This approval permits preparation and dry-run only. It does not yet
authorize a database write or public publication.

The existing canonical importer is the binding write path. It already supports
an existing canonical product/variant plus a new retailer mapping, offer and
price-history row; creates a missing retailer; produces a dry-run artifact and
fingerprint; requires a separate approval; and applies exactly one approved
plan atomically. CSV writes are disabled. No second importer, new schema or
migration is required for the canary. Production currently has nine retailer
rows and no eBay retailer row. The approved source artifact, not an unrelated
database field, remains the seller/listing audit evidence.

`EBAY_EPN_CAMPAIGN_ID` is now configured in the local controlled environment;
its value is not stored in the repository or this document. The Browse adapter
passes it through `X-EBAY-C-ENDUSERCTX` and accepts only eBay's returned
`itemAffiliateWebUrl` as affiliate-ready. Ordinary `itemWebUrl` values must not
be published as monetized links.

The exact five Batch A listings were refreshed by item ID on 14 August 2026.
All five were found, returned the expected GTIN, remained `AUTO_ELIGIBLE`, had
zero blockers/review reasons and returned an `itemAffiliateWebUrl`. All five
would add a second retailer and were the lowest complete delivered price in the
fresh result; median difference was GBP -6.41. Database writes remained zero.

The owner then explicitly approved the first exact Batch A bootstrap plan.
Manual GitHub Actions run `31816406873` consumed approval
`1edacfea-c2ad-4114-b2cd-9f6620889d58` and atomically created eBay UK retailer
`12`, retailer mapping `2724`, offer `2539` and price-history row `2734`. The
approved canonical product `10` and variant `1704` remained existing and were
not updated. The first run's apply passed; only its postflight assertion failed
because the current importer correctly reports idempotent actions as `noop`,
not the older expected words. Apply was not repeated. Commit `ad3747b` fixed
only that assertion and added a non-writing `postflight` mode. Run
`31817084379` then passed every step, with the fresh dry-run reporting the
retailer, mapping, offer and price history as exact no-ops. Production readback
confirmed GTIN `5999076263851`, `gtin`/`100` matching, GBP 77.99 delivered,
in-stock state and an affiliate campaign URL. The public product page returned
HTTP 200 and contained eBay UK, GBP 77.99 and `/go/2539`.

After the bootstrap, a fresh read-only dry-run regenerated the remaining four
Batch A rows against retailer `12`. The owner explicitly approved exactly
those four records. The sealed artifact SHA-256 was
`b22cb5ac40dd870aa45cec6b0773bd2cff8344305b14b9120a2ffc7c6e96b393`
and rollout fingerprint was
`b832dedcf86196db7712b2431ac6942a5324091c511299558ec015ca2086180d`.
Commit `63f34eb` restricted the active executor to that four-record scope and
removed the completed bootstrap from the active apply path. Manual GitHub run
`31820209540` validated and executed 4/4, creating mappings `2725`-`2728`,
offers `2540`-`2543` and price-history rows `2735`-`2738`. Its immediate
postflight passed with 4 plans, 0 blockers and all retailer, mapping, offer and
history actions as `noop`.

Production readback now confirms exactly five unique eBay mappings, five
unique variants, five unique external GTINs, five in-stock offers and five
price-history rows under retailer `12`. Every mapping is `gtin`/`100`, every
offer has known free delivery and an affiliate campaign URL, and all five
canonical product and variant GTIN fields remain untouched. Public readback
returned HTTP 200 for products `10`, `71`, `27`, `489` and `528`; every page
contained eBay UK, the exact price and its expected `/go/{offerId}` route.
Batch A is therefore live-verified 5/5. No Batch B write is approved.

The exact five owner-reviewed Batch B listings were revalidated read-only on
14 August 2026 through the existing title-lead Browse path. All five exact
approved item IDs were found; all five returned the expected GTIN, remained
`AUTO_ELIGIBLE`, returned affiliate URLs and had zero blockers or review
reasons. Four beat the current complete delivered price; Blood & Guts Mango
was GBP 25.90 delivered versus the current GBP 24.98. The median delivered
price difference was GBP -0.71. No substitute listing was selected.

The existing importer then produced five exact plans and zero blocked or
skipped rows. Every plan keeps the retailer, product and variant as existing
and proposes only one new `gtin`/`100` eBay mapping, one offer and one
price-history row. Critical Cookie is correctly bound to its sole active
default variant `462`; its 73 g and White Chocolate & Raspberry evidence is
preserved in the sealed eBay response rather than represented as a new
canonical variant. The final dry-run artifact SHA-256 is
`916c8a8717193491e81e1391438794c634f7c22288b9d1770a71e9145376fdd3`.
Database writes remain zero for Batch B and a new exact owner approval is
required before any guarded apply.

The owner explicitly approved those exact five Batch B plans on 14 August
2026. Commit `0b2db32` bound the existing manual executor to rollout
fingerprint
`47532d6b515cdb5d96a42d2ac630d530693b62cc5f7aeaf2f40f84d8dd550a65`
and confirmation `OWNER_APPROVED_EBAY_BATCH_B_EXACT_5`; it did not add a new
importer. Manual GitHub run `31824324247` validated and atomically executed
5/5, creating mappings `2729`-`2733`, offers `2544`-`2548` and price-history
rows `2739`-`2743`. Its immediate fresh postflight returned five exact no-ops
with zero blockers.

Independent production readback confirmed retailer `12`, five unique
products/variants/items/GTINs, `gtin`/`100` matching, the exact item price,
shipping and delivered total, in-stock state and affiliate campaign URLs.
Canonical `products.gtin` and `product_variants.gtin` remained unchanged.
eBay UK now has exactly 10 unique mappings and 10 offers with no duplicate
variant, GTIN or legacy item identity. All five Batch B public product pages
returned HTTP 200 and contained eBay UK, the expected delivered price and the
exact `/go/2544`-`/go/2548` route. The controlled 10-offer rollout is therefore
live-verified 10/10.

The next owner review rejected Boditronics Mass Attack Vanilla and retained
BioTech Iso Whey Banana 908g behind the importer's canonical-parent drift
blocker. The owner approved the remaining seven exact listings. Official
manufacturer evidence showed that the current Critical Cookie family is 73 g,
not the stale 85 g identity held in the catalogue. Guarded migration
`20260814213000_correct_critical_cookie_73g_identity.sql` therefore updated the
existing product name and all four canonical variant size identities from 85 g
to 73 g while preserving the canonical URL, GTINs, mappings, offers and price
history. Production rehearsal, rollback, apply and independent readback all
passed; table counts were unchanged.

A fresh exact-item eBay refresh then found all seven approved listings with no
new blocker, reject or missing result. The existing importer produced seven
create plans and zero blocked rows. Commit `9736d74` sealed artifact SHA-256
`822e6d0b053b8f626309e9331b4b2a4e4ef1a67d6c4c961cbf99751501ede928`,
rollout fingerprint
`22cb09f8e3abc3d1c2dcfa27d67c9c1c050db5eebb753c4dc931d288bc8670c6`
and confirmation `OWNER_APPROVED_EBAY_BATCH_C_EXACT_7` into the existing
guarded executor. No second importer was created.

Manual GitHub run `31843061483` validated and executed 7/7, creating mappings
`2734`-`2740`, offers `2549`-`2555` and seven price-history rows. Apply was not
repeated when the first postflight exposed one semantically identical Critical
Cookie mapping as technical `update`; the other six mappings and all seven
offers/history rows were no-ops. Commit `080f219` made the postflight accept
that one exact metadata-equivalent state without weakening identity, offer or
history checks. Non-writing postflight run `31869339692` then passed.

Independent production readback confirmed seven unique products, variants,
items and GTINs, seven in-stock affiliate URLs with known delivered prices and
seven price-history rows. eBay UK now has exactly 17 mappings and 17 offers.
All seven public product pages returned HTTP 200 and contained eBay UK plus the
expected `/go/2549`-`/go/2555` routes. Batch C is live-verified 7/7.

## Completed

- [x] Repository and operating-document audit.
- [x] Product, variant, retailer, mapping, offer and price-history schema audit.
- [x] Read-only production coverage and GTIN baseline.
- [x] Existing importer, matching, review, refresh and secret-path audit.
- [x] Read-only recovery audit of existing GTIN and barcode evidence.
- [x] Read-only GTIN confirmation cohort 1 (10 checked; 9 confirmed; 1 conflict).
- [x] Read-only scaled GTIN confirmation batch (46 checked; 31 confirmed; 15 conflicts).
- [x] Read-only GTIN promotion planner and 54-identity production dry-run.
- [x] Owner review pack for the exact 45 write-bearing GTIN candidates.
- [x] Marketplace architecture recommendation.
- [x] Conservative offer and matching policy proposal.
- [x] Official eBay Developer and EPN requirements review.
- [x] User registration checklist.
- [x] Read-only 100-record pilot specification.
- [x] eBay Developers and EPN account access confirmed by owner.
- [x] Sandbox and Production application keysets created by owner.
- [x] Guarded marketplace account-deletion endpoint built, tested and deployed.
- [x] Account-deletion endpoint Production secrets configured by owner.
- [x] Challenge endpoint accepted and saved by eBay.
- [x] Signed test notification accepted by eBay after guarded endpoint fixes.
- [x] Production keyset no longer marked `Non Compliant`, owner-verified.
- [ ] Pilot cohort of 100 verified canonical GTIN identities available.
- [x] Read-only API pilot executed for all 54 safe identities.
- [x] Pilot quality reviewed and accepted by owner.
- [x] Scaled read-only discovery found listing evidence for 144 unique products.
- [x] Same-retailer eBay sellers excluded from independent coverage.
- [x] Exact 10 new strong independent offers owner-approved for rollout design.
- [x] Existing guarded importer proved suitable for the eBay canary; no second importer.
- [x] Batch A affiliate refresh passed 5/5 using the exact approved item IDs.
- [x] Existing-importer Batch A dry-run passed 5 plans and 0 blocked rows.
- [x] First owner-approved Batch A offer applied atomically and live-verified.
- [x] Remaining four Batch A previews regenerated after retailer bootstrap (4 plans, 0 blockers).
- [x] Remaining four Batch A offers owner-approved, applied and postflight-verified.
- [x] Batch A public live verification passed 5/5.
- [x] Batch B exact listing refresh passed 5/5 with affiliate URLs and zero blockers.
- [x] Existing-importer Batch B dry-run passed 5 plans and 0 blocked rows.
- [x] Batch B five exact plans owner-approved and atomically applied.
- [x] Batch B postflight, production readback and public verification passed 5/5.
- [x] Controlled first 10 eBay offers are live-verified end to end.
- [x] Batch F exact two offers owner-approved, applied, postflight-verified and publicly live-verified.
- [x] Batch G exact nine offers owner-approved, applied, postflight-verified and added to the existing daily refresh.
- [ ] At least 50 independent owner-safe eBay offers available.
- [x] Production pilot completed; all five exact Batch A offers owner-approved, applied and live-verified.

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

## GTIN Confirmation Sprint

### Cohort 1 scope and selection

Captured 13 August 2026. Production access was SELECT-only and external source
work was read-only. No canonical or retailer GTIN, mapping, offer, migration,
importer, eBay API or public UI was changed.

The 748 one-source `REVIEW` identities were filtered deterministically to:

1. an active, unmerged product with exactly one positive-price in-stock
   retailer;
2. a valid GTIN checksum and one unambiguous canonical variant target;
3. a priority Creatine, Whey, Vitamins, Magnesium, Electrolytes or Pre Workout
   identity;
4. known brand and explicit size, weight or unit count;
5. stable product ID and variant ID order within category priority.

There were 233 records meeting those gates. Cohort 1 was deliberately capped
at 10 simple, non-flavoured single-SKU identities from Creatine, Vitamins and
Magnesium. It tests source quality before spending effort on large flavour
families and does not weaken the gate to approach 100.

### Evidence standard and sources

Source 1 is the existing Whey Okay retailer mapping. Source 2 was opened and
checked directly; search snippets, marketplaces, forums, social media and
barcode-only databases were not accepted. Official manufacturer stores were
used where they exposed EAN. Otherwise an established pharmacy, distributor or
retailer page was accepted only when it displayed the exact GTIN and the exact
commercial pack. Non-UK sources were necessary for several globally identified
trade items because no opened official or UK page exposed both barcode and pack
identity; their use is explicit below rather than silently treated as official
evidence.

| Product / variant | Identity and current evidence | Independent evidence | Validation and decision |
|---|---|---|---|
| `81` / `67` — BioTech USA Tri-Creatine Malate 300g | Brand BioTech USA; Whey Okay; `5999076228171`; powder; 300 g; no flavour; unit count n/a; [source 1](https://wheyokay.com/biotech-usa-tri-creatine-malate-300g-396-p.asp) | Farmacia Tei product page: BioTech USA, Tri Creatine Malate, 300 g and product code `5999076228171`; [source 2](https://comenzi.farmaciatei.ro/dieta-si-wellness/suplimente-pentru-sportivi/creatina/tri-creatine-malate-300-g-biotech-usa-p354392) | GTIN-13 checksum valid; brand/name/weight/format match; `CONFIRMED` |
| `87` / `38` — USN 100% Micronised Creatine Powder 200g | Brand USN; Whey Okay; `6009544961161`; powder; canonical/source pack 200 g; no flavour; unit count n/a; [source 1](https://wheyokay.com/usn-100-micronised-creatine-powder-200g-520-p.asp) | UK distributor Tropicana Wholesale assigns the same barcode to **230 g / Unflavoured**, not 200 g; [source 2](https://www.tropicanawholesale.com/monthly-offers/Monthly-Non-Gift-Offers/usn-creatine-monohydrate/) | GTIN-13 checksum valid, but pack weight conflicts 200 g vs 230 g; `CONFLICT`; do not promote |
| `88` / `54` — PEScience TruCreatine 120 Caps | Brand PEScience; Whey Okay; `040232661082`; capsules; 120 count; no flavour; [source 1](https://wheyokay.com/pescience-trucreatine-120-caps-522-p.asp) | Get Yok'd opened product page and embedded Shopify variant show PEScience TruCreatine, 120 capsules and barcode `040232661082`; [source 2](https://www.getyokd.com/products/pescience-trucreatine-120-capsules) | GTIN-12 checksum valid; brand/name/count/format match; `CONFIRMED` |
| `360` / `364` — Olimp TCM 1100 Mega Caps 120 Capsules | Brand Olimp; Whey Okay; `5901330020520`; capsules; 120 count; no flavour; [source 1](https://wheyokay.com/olimp-tcm-1100-mega-caps-120-capsules-2594-p.asp) | Official Olimp Store page shows TCM 1100 Mega Caps, 120 capsules and EAN `5901330020520`; [source 2](https://olimpstore.pl/olimp-tcm-1100-mega-caps-120-capsules-359) | GTIN-13 checksum valid; official brand/name/count/format match; `CONFIRMED` |
| `393` / `334` — Trec Nutrition CM3 1250 90 Capsules | Brand Trec Nutrition; Whey Okay; `5902114044664`; capsules; 90 count; no flavour; [source 1](https://wheyokay.com/trec-nutrition-cm3-1250-90-capsules-3085-p.asp) | Opened specialist retailer page shows TREC CM3, 90 capsules and EAN-13 `5902114044664`; [source 2](https://tanie-odzywki.pl/314-trec-cm3-90caps.html) | GTIN-13 checksum valid; brand/family/count/format match; `CONFIRMED` |
| `425` / `397` — Scitec Nutrition Creatine Caps 250 Capsules | Brand Scitec Nutrition; Whey Okay; `5999100029293`; capsules; 250 count; no flavour; [source 1](https://wheyokay.com/creatine-caps---250-capsules-3339-p.asp) | Dr. Max pharmacy page shows Scitec Nutrition Crea Caps, 250 capsules and EAN `5999100029293`; [source 2](https://www.drmax.sk/scitec-nutrition-crea-caps-250-kapsul) | GTIN-13 checksum valid; brand/name/count/format match; `CONFIRMED` |
| `1040` / `2176` — 7Nutrition Creatine Hydrochloride HCL 350 caps | Brand 7Nutrition; Whey Okay; `5903111089412`; capsules; 350 count; unflavoured; [source 1](https://wheyokay.com/7nutrition-creatine-hcl-350-caps-509-p.asp) | Mega Protein Store page shows 7Nutrition HCL Creatine, 350 caps and EAN `5903111089412`; [source 2](https://megaproteinstore.gr/hcl_creatine_350_caps_7nutrition) | GTIN-13 checksum valid; brand/formulation/count/format match; `CONFIRMED` |
| `138` / `90` — Solgar Skin, Nail And Hair Formula 60 Tablets | Brand Solgar; Whey Okay; `033984017351`; tablets; 60 count; no flavour; [source 1](https://wheyokay.com/solgar-skin-nail-and-hair-formula-60-tablets-765-p.asp) | Target product page shows Solgar Skin, Nails & Hair Advanced MSM Formula, 60 tablets and UPC `033984017351`; [source 2](https://www.target.com/p/-/A-1002587551) | GTIN-12 checksum valid; brand/formula/count/format match; `CONFIRMED` |
| `176` / `227` — Olimp Chela Mag B6 Forte 60 Capsules | Brand Olimp; Whey Okay; `5901330022685`; capsules; 60 count; no flavour; [source 1](https://wheyokay.com/olimp-chela-mag-b6-forte-60-capsules-1102-p.asp) | Official Olimp Store page shows Chela-Mag B6 Forte, 60 capsules and EAN `5901330022685`; [source 2](https://olimpstore.pl/olimp-chela-mag-b6-forte-mega-caps-60-capsules-87) | GTIN-13 checksum valid; official brand/formula/count/format match; `CONFIRMED` |
| `258` / `248` — Swanson Potassium Citrate 99 mg 120 Capsules | Brand Swanson; Whey Okay; `087614023953`; capsules; 99 mg; 120 count; no flavour; [source 1](https://wheyokay.com/swanson-potassium-citrate-99-mg-120-capsules-1693-p.asp) | iHerb page shows Swanson Potassium Citrate, 99 mg, 120 vegan capsules and UPC `087614023953`; [source 2](https://de.iherb.com/pr/swanson-vitamins-potassium-citrate-99-mg-120-vegan-capsules/111029) | GTIN-12 checksum valid; brand/formula/strength/count/format match; `CONFIRMED` |

### Cohort 1 result

| Measure | Result |
|---|---:|
| Checked | 10 |
| `CONFIRMED` | 9 |
| `REVIEW` | 0 |
| `CONFLICT` | 1 |
| `NOT_FOUND` | 0 |
| Confirmation rate | 90% (9/10) |
| Potential new `AUTO_SAFE` identities | 9 |
| Existing plus potential `AUTO_SAFE` | 23 |
| Remaining to the 100-identity target | 77 |

The projected exact-GTIN eBay pilot grows from 14 to 23 identities only after
owner approval of the evidence; this sprint did not write or promote them.
The high confirmation rate supports proposing another bounded cohort, but the
USN weight conflict proves that checksum plus a familiar product name is not
enough and the semantic gate must remain unchanged.

### Scaled batch scope and method

Captured 13 August 2026 after the owner approved moving beyond small cohorts.
The production reads remained SELECT-only. The same checksum, exact-variant,
known-brand, explicit-size/count and exactly-one-active-retailer gates were
applied, and all 10 cohort-1 variants were excluded. This left 215 current
priority candidates: 16 Creatine, 47 Whey, 54 Vitamins, 4 Magnesium and 94 Pre
Workout; no Electrolytes identity met every gate.

The batch checked 46 new identities for which an opened independent UK
distributor page displayed the candidate barcode in a size/flavour table.
Tropicana Wholesale identifies itself as an official trade supplier and is not
the current retailer for any record below. Search snippets were used only to
locate pages; every decision came from the opened product page. A candidate was
not classified `NOT_FOUND` merely because this one distributor lacked a page.
That prevents false negatives and avoids weakening the source standard to fill
the 150-record ceiling.

Source 1 abbreviations: `WO` = the existing Whey Okay mapping; `JON` = the
existing Jon's Supplements mapping. Source 2 is `TW`, the linked Tropicana
Wholesale product page. All rows have a valid GTIN checksum, one unambiguous
canonical variant target, one active retailer, known brand, powder format
unless stated otherwise, and the product/variant IDs shown below.

### Scaled batch — confirmed evidence

| Product / variant | Identity; current retailer; existing `external_gtin` | Source 1 / source 2 | Matched size, flavour, count and decision |
|---|---|---|---|
| `11` / `1002` | USN Blue Lab Whey; Caramel Chocolate; WO; `6009544910770` | [WO](https://wheyokay.com/usn-blue-lab-100-whey-premium-protein-2kg-18-p.asp) / [TW](https://www.tropicanawholesale.com/shop-by-brand/USN/USN-Blue-Lab-Whey-2kg/) | 2 kg; Caramel Chocolate; 1 tub; `CONFIRMED` |
| `11` / `1713` | USN Blue Lab Whey; Strawberry; WO; `6009544910718` | WO / [TW](https://www.tropicanawholesale.com/shop-by-brand/USN/USN-Blue-Lab-Whey-2kg/) | 2 kg; Strawberry; 1 tub; `CONFIRMED` |
| `11` / `1714` | USN Blue Lab Whey; Vanilla; WO; `6009544910732` | WO / TW above | 2 kg; Vanilla; 1 tub; `CONFIRMED` |
| `11` / `1715` | USN Blue Lab Whey; Banana; WO; `6009544910756` | WO / TW above | 2 kg; Banana; 1 tub; `CONFIRMED` |
| `11` / `1717` | USN Blue Lab Whey; Chocolate; WO; `6009544910695` | WO / TW above | 2 kg; Chocolate; 1 tub; `CONFIRMED` |
| `11` / `1720` | USN Blue Lab Whey; Salted Caramel; WO; `6009544942368` | WO / TW above | 2 kg; Salted Caramel; 1 tub; `CONFIRMED` |
| `11` / `1722` | USN Blue Lab Whey; Wheytella; WO; `6009544918745` | WO / TW above | 2 kg; Wheytella; 1 tub; `CONFIRMED` |
| `338` / `1020` | Applied Nutrition Clear Whey; Cherry & Apple; WO; `658556043769` | [WO](https://wheyokay.com/applied-nutrition-clear-whey-protein-875g-2418-p.asp) / [TW](https://www.tropicanawholesale.com/shop-by-brand/Applied-Nutrition/Applied-Nutrition-Clear-Whey-875g/) | 875 g; Cherry & Apple; 1 tub; `CONFIRMED` |
| `338` / `1782` | Applied Nutrition Clear Whey; Orange Squash; WO; `5056555214473` | WO / TW above | 875 g; Orange Squash; 1 tub; `CONFIRMED` |
| `338` / `1783` | Applied Nutrition Clear Whey; Strawberry & Lime; WO; `5056555214510` | WO / TW above | 875 g; Strawberry & Lime; 1 tub; `CONFIRMED` |
| `338` / `1784` | Applied Nutrition Clear Whey; Strawberry & Raspberry; WO; `5056555214527` | WO / TW above | 875 g; Strawberry & Raspberry; 1 tub; `CONFIRMED` |
| `338` / `1786` | Applied Nutrition Clear Whey; Watermelon; WO; `5056555214534` | WO / TW above | 875 g; Watermelon; 1 tub; `CONFIRMED` |
| `10` / `1710` | BioTech USA Iso Whey Zero; Pineapple-Mango; WO; `5999076263882` | [WO](https://wheyokay.com/biotech-usa-iso-whey-zero-1816g-11-p.asp) / [TW](https://www.tropicanawholesale.com/shop-by-brand/Biotech-USA/biotech-usa-iso-whey-zero-2-27kg-pineapple-mango/) | 1.816 kg; Pineapple-Mango; 1 tub; `CONFIRMED` |
| `55` / `1029` | BioTech USA Nitrox Therapy; Blue Grape; WO; `5999076253548` | [WO](https://wheyokay.com/biotech-usa-nitrox-therapy-340g-233-p.asp) / [TW](https://www.tropicanawholesale.com/shop-by-brand/Biotech-USA/BioTech-USA-Nitrox-Therapy-340g/) | 340 g; Blue Grape; 1 tub; `CONFIRMED` |
| `55` / `1599` | BioTech USA Nitrox Therapy; Tropical Fruit; WO; `5999076253555` | WO / TW above | 340 g; Tropical Fruit; 1 tub; `CONFIRMED` |
| `55` / `1600` | BioTech USA Nitrox Therapy; Peach; WO; `5999076253524` | WO / TW above | 340 g; Peach; 1 tub; `CONFIRMED` |
| `790` / `1094` | Per4m Creatine Sherbet; Cherry Fizz; JON; `5061097264619` | [JON](https://jonssupplements.co.uk/products/per4m-creatine-sherbet-100-servings?variant=53868239389010) / [TW](https://www.tropicanawholesale.com/shop-by-brand/Per4m/Per4m-Creatine-Sherbet-310g/) | 310 g; Cherry Fizz; 1 tub; `CONFIRMED` |
| `790` / `1095` | Per4m Creatine Sherbet; Fizzy Bubblegum Bottles; JON; `5061097264633` | JON / TW above | 310 g; Fizzy Bubblegum Bottles; 1 tub; `CONFIRMED` |
| `790` / `1096` | Per4m Creatine Sherbet; Original Sherbet; JON; `5061097264596` | JON / TW above | 310 g; Original; 1 tub; `CONFIRMED` |
| `790` / `1097` | Per4m Creatine Sherbet; Peach Sweets; JON; `5061097264657` | JON / TW above | 310 g; Peach Sweets; 1 tub; `CONFIRMED` |
| `790` / `1098` | Per4m Creatine Sherbet; Rainbow Candy; JON; `5061097264671` | JON / TW above | 310 g; Rainbow Candy; 1 tub; `CONFIRMED` |
| `789` / `1084` | Per4m Pre-Workout Stim; Blackberry; JON; `5061097261878` | [JON](https://jonssupplements.co.uk/products/per4m-pre-workout-stim-570g?variant=53925321277778) / [TW](https://www.tropicanawholesale.com/shop-by-brand/Per4m/Per4m-Pre-570g/) | 570 g; Blackberry; 1 tub; `CONFIRMED` |
| `789` / `1085` | Per4m Pre-Workout Stim; Berry Blast; JON; `5060660084821` | JON / TW above | 570 g; Berry Blast; 1 tub; `CONFIRMED` |
| `789` / `1086` | Per4m Pre-Workout Stim; Cola Bottles; JON; `5060660084760` | JON / TW above | 570 g; Cola Bottle; 1 tub; `CONFIRMED` |
| `789` / `1088` | Per4m Pre-Workout Stim; Orange & Mango; JON; `5060660084784` | JON / TW above | 570 g; Orange Mango; 1 tub; `CONFIRMED` |
| `789` / `1089` | Per4m Pre-Workout Stim; Passionfruit; JON; `5060660084746` | JON / TW above | 570 g; Passion Fruit; 1 tub; `CONFIRMED` |
| `789` / `1092` | Per4m Pre-Workout Stim; Watermelon Lemonade; JON; `5060660084807` | JON / TW above | 570 g; Watermelon Lemonade; 1 tub; `CONFIRMED` |
| `56` / `1601` | Warrior Rage; Energy Burst; WO; `5060424707256` | [WO](https://wheyokay.com/warrior-rage-unleash-hell-pre-workout-392g-236-p.asp) / [TW](https://www.tropicanawholesale.com/shop-by-brand/Warrior/Warrior-Rage-392g/) | 392 g; Energy Burst; 1 tub; `CONFIRMED` |
| `56` / `1604` | Warrior Rage; Wicked Watermelon; WO; `5060424700363` | WO / TW above | 392 g; Watermelon; 1 tub; `CONFIRMED` |
| `56` / `1605` | Warrior Rage; Charged Cherry; WO; `5060756342927` | WO / TW above | 392 g; Charged Cherry; 1 tub; `CONFIRMED` |
| `139` / `142` | Himalaya Liv.52; default; WO; `8901138110710` | [WO](https://wheyokay.com/himalaya-liv52-100-tablets-767-p.asp) / [TW](https://www.tropicanawholesale.com/shop-by-brand/Himalaya/Himalaya-Liv-52/) | 100 tablets; no flavour; tablet; `CONFIRMED` |

### Scaled batch — conflicts

| Product / variant | Identity; current retailer; existing `external_gtin` | Independent evidence | Decision and notes |
|---|---|---|---|
| `58` / `1007` | 5% Nutrition Full As F*ck; Blue Raspberry; WO; `850054547989` | [TW](https://www.tropicanawholesale.com/shop-by-brand/Rich-Piana-5-Percent-Nutrition/Rich-Piana-5-Nutrition-FULL-AS-F-CK-Legendary-Series-372g/) | Barcode matches flavour but TW pack is 372 g, canonical is 387 g; `CONFLICT` |
| `58` / `1607` | same family; Fruit Punch; WO; `850054547996` | TW above | 372 g versus 387 g; `CONFLICT` |
| `58` / `1611` | same family; Wild Berry; WO; `850060014024` | TW above | 372 g versus 387 g; `CONFLICT` |
| `49` / `1028` | Ghost Pump; Pineapple; WO; `810028296107` | [TW](https://www.tropicanawholesale.com/shop-by-brand/Ghost/Ghost-Pump-V2-270g/) | TW identifies 270 g V2, canonical says 350 g; `CONFLICT` |
| `49` / `1596` | Ghost Pump; Warheads Sour Watermelon; WO; `810028296084` | TW above | 270 g V2 versus 350 g; `CONFLICT` |
| `49` / `1597` | Ghost Pump; Natty; WO; `810028296114` | TW above | 270 g V2 versus 350 g; `CONFLICT` |
| `49` / `1598` | Ghost Pump; Peach; WO; `810028296091` | TW above | 270 g V2 versus 350 g; `CONFLICT` |
| `291` / `1040` | Reflex Muscle Bomb; Blue Raspberry; WO; `5033579002576` | [TW](https://www.tropicanawholesale.com/shop-by-brand/Reflex-Nutrition/Reflex-Nutrition-The-Muscle-Bomb-400g/) | TW pack is 400 g, canonical is 600 g; `CONFLICT` |
| `291` / `1691` | same family; Lemon Sherbet; WO; `5033579002545` | TW above | 400 g versus 600 g; `CONFLICT` |
| `291` / `1692` | same family; Twizzle Lolly; WO; `5033579002538` | TW above | 400 g versus 600 g; `CONFLICT` |
| `291` / `1693` | same family; Sour Apple; WO; `5033579002552` | TW above | 400 g versus 600 g; `CONFLICT` |
| `232` / `1017` | Ghost Vegan Protein; Banana Pancake Batter; WO; `810028290532` | [TW](https://www.tropicanawholesale.com/shop-by-brand/Ghost/Ghost-Vegan-Protein-989g/) | TW table says 896 g, canonical says 989 g; `CONFLICT` |
| `232` / `1812` | same family; Pancake Batter; WO; `850001610094` | TW above | 896 g versus 989 g; `CONFLICT` |
| `232` / `1813` | same family; Chocolate Cereal Milk; WO; `810028291942` | TW above | TW says 980 g, canonical says 989 g; `CONFLICT` |
| `27` / `1593` | Cellucor C4 Original; Cosmic Rainbow; WO; `5056569900409` | [TW](https://www.tropicanawholesale.com/shop-by-brand/Cellucor/Cellucor-C4-Original-30-Servings/) | TW says 207 g, canonical says 195 g; `CONFLICT` |

### Scaled batch result and cumulative gate

| Measure | Scaled batch | Confirmation sprint cumulative |
|---|---:|---:|
| Checked | 46 | 56 |
| `CONFIRMED` | 31 | 40 |
| `REVIEW` | 0 | 0 |
| `CONFLICT` | 15 | 16 |
| `NOT_FOUND` | 0 | 0 |
| Confirmation rate | 67.39% (31/46) | 71.43% (40/56) |
| Potential new `AUTO_SAFE` | 31 | 40 |
| Existing plus potential `AUTO_SAFE` | — | 54 |
| Remaining to 100 | — | 46 |

All 31 confirmed identities belong to products with exactly one active
retailer. They cover eight distinct products in this batch; cumulatively, the
40 confirmations cover 17 such products. The 100-identity decision gate is not
met, so neither an eBay API pilot nor a GTIN promotion apply is authorised.
The lower batch rate is expected and useful: family-level pack/version drift
was exposed rather than silently accepted.

### Sprint blockers and next action

- Canonical GTIN promotion remains unimplemented and unapproved.
- The 40 confirmed identities are evidence candidates, not production state.
- Product `87` / variant `38` is quarantined from promotion until authoritative
  packaging evidence resolves 200 g versus 230 g.
- All 15 scaled-batch pack/version conflicts are also quarantined.
- Forty-six further identities are still needed for a 100-record pilot.
- eBay/EPN access remains independently blocked on owner action.

Superseded by the separately approved `GTIN Promotion Pipeline` dry-run below.
Do not run another confirmation batch. No GTIN write or eBay call is authorised.

## GTIN Promotion Pipeline

### Reuse architecture

The promotion planner extends the existing control plane instead of creating a
second importer. It reuses the production canonical snapshot and GTIN collision
index, the owner-review evidence recorded in this ledger, and the existing
fingerprint/immutable-artifact conventions. The future write must reuse the
same approval-ledger properties already enforced for product imports: one
reviewed artifact, short expiry, exact expected state, one-time consumption,
transactional apply and an audit result bound to the artifact and row
fingerprints.

The existing `validate_product_import_plan_read_only` and
`apply_approved_product_import_plan` RPCs cannot apply this operation unchanged:
their closed schema permits product/variant create-or-existing actions and
retailer/offer changes, but no canonical GTIN update action. Reusing the
framework therefore meant adding one narrowly allowlisted `GTIN_PROMOTION`
operation beside those RPCs in the same approval ledger, not using the CSV
importer or enabling `SAFE_UPDATE`. The guarded release completed successfully
on 13 August 2026; the migration is deployed and its one approved apply wrote
exactly 45 variant GTINs.

The read-only planning slice is:

1. parse the 40 independently confirmed identities from this durable ledger;
2. recompute the 14 existing two-retailer `AUTO_SAFE` identities from a fresh
   production SELECT-only canonical snapshot;
3. validate checksum, exact product/variant binding, semantic evidence,
   quarantine, destination value and canonical/proposed GTIN collisions;
4. select `product_variants.gtin` by default, preserving an already identical
   `products.gtin` value as an idempotent no-op;
5. emit a new fingerprinted, 15-minute preview under `tmp/gtin-promotion` with
   `write_enabled: false` and `safe_update_enabled: false`.

The guarded write slice now prepared locally:

1. extends `approved_import_plans` with only the `gtin_promotion` plan kind and
   an immutable apply result;
2. stores all 16 known conflicts in an RLS-protected quarantine table;
3. validates the exact 45-row envelope, checksum, two-source evidence,
   destination, expected product/variant state, uniqueness and quarantine
   inside PostgreSQL;
4. separates approver and executor database roles, applies all 45 variant
   updates in one transaction, consumes approval once and records before/after
   audit evidence;
5. exposes a manual-main-only GitHub workflow with `preflight`, `validate` and
   `release_exact_45` choices. `preflight` runs the full disposable-database
   gate without production access. One explicit `release_exact_45` selection,
   exact owner confirmation and approval from the existing protected GitHub
   `production-readonly` environment then
   run production preflight, reviewed migration deployment, validate, atomic
   apply and post-write verification in strict order. Any failed step stops all
   successors, and the write step never receives the service-role key.

The release artifact is additionally bound in JavaScript and PostgreSQL to the
exact owner-approved identity allowlist and scope fingerprint
`a79b0f29d9ba141e3421a76a58b4cda4fb0995f4513e9d7004e6ab6308d50046`.
Post-write verification compares full product/variant GTIN fingerprints and
full offers/retailer-mapping fingerprints with the sealed pre-write baseline,
checks the 16-row quarantine and consumed 45-row audit result, and requires all
54 safe identities to become no-ops. A verification anomaly reports
`FAILED_VERIFICATION` with the exact check diff and never triggers automatic
rollback.

The owner approval recorded below fixes the allowed identity scope. The
completed release used that exact scope and did not widen it. The protected
environment contains
`SUPPLEMENTSCOUT_PRODUCTION_OWNER_DATABASE_URL`; it is materialized only in the
runner temporary directory, removed in an `always()` cleanup step and never
uploaded. Existing least-privilege approver/executor URLs are reused, with the
GTIN-specific secret names preferred when configured.

### Production release result

The manual `release_exact_45` run `31728827733` completed successfully on
commit `4336126c6b51abac2ecfb709bd1544c9d4b42ca9`. The full quality gate, exact
contract tests and disposable PostgreSQL integration test passed before the
production job received access to its protected environment. Production
preflight then built a fresh exact artifact, sealed the no-change baseline,
deployed migration `20260813170000_add_guarded_gtin_promotion`, validated the
plan, applied it atomically and completed post-write verification.

The immutable release report records `PASS`, 45 verified writes and 54 final
no-ops. All 45 owner-approved values are present in `product_variants.gtin`;
the nine previously present GTIN identities remained unchanged and the 16
quarantined conflicts remained quarantined. The report found zero anomalies,
no duplicate GTIN conflicts and a consumed 45-row approval audit result. The
full `products.gtin`, offers and `retailer_products` snapshots matched the
sealed baseline; no product GTIN, offer or retailer-mapping change escaped the
approved variant-only scope. A fresh dry-run classified all 54 safe identities
as `ALREADY_PRESENT`/no-op. The report itself performed zero additional writes.

Release evidence is retained as GitHub Actions artifact
`gtin-promotion-31728827733-1`, digest
`sha256:ca051cfdb14b8440f823c852046deabfae6b5d32c20f68523a3b0860a911a872`.
The GTIN promotion release is complete and must not be rerun. The next eBay
work remains separately gated and must consume these canonical identities
rather than rebuilding or re-promoting them.

### Safety and future-write gate

A row can be `READY_TO_PROMOTE` only with a valid GTIN-8/12/13/14 checksum, at
least two independent evidence sources or prior `AUTO_SAFE` evidence, one
active unmerged canonical product, one exact active variant, and confirmed
brand, size/weight/count, relevant flavour and format. Any quarantine,
canonical/proposed duplicate, conflicting destination value, inactive target
or semantic mismatch is `BLOCKED`; incomplete evidence or an ambiguous variant
is `MANUAL_REVIEW`.

For a future write, each row must still be `READY_TO_PROMOTE` in a newly
generated preview. The database operation must lock all destination rows,
re-read and compare their exact expected state and snapshot binding, re-run
global GTIN uniqueness and quarantine checks, then apply the whole approved
batch in one transaction. The approval must expire, be consumable once, and
record before/after values plus artifact, preview and candidate fingerprints.
An exact apply replay is blocked because the approval has already been
consumed; a changed catalogue becomes `STALE_PREVIEW` and writes nothing. The
separate nine already-present identities remain verified no-ops and never enter
the write-bearing 45-row artifact.

### Production dry-run result

Captured `2026-08-13T15:20:20.920Z` with SELECT-only production access. The
preview covered all 54 current potential safe identities and made 0 database
writes. Canonical snapshot fingerprint:
`c4bb8f2cf069bbf26bad5f34136471a8875d3bdc609780353f066d526b4d8e0e`;
source fingerprint:
`0649f9881cff87f3e596466061c35fe452084c7749f188b3fb5d44514b402848`;
preview fingerprint:
`8765743c98f03fed479d81a93333919b1cfc5bfc574b6b62798d94cf0542ae64`.

| Decision | Count | Meaning |
|---|---:|---|
| `READY_TO_PROMOTE` | 45 | Empty exact variant destination; all gates passed |
| `ALREADY_PRESENT` | 9 | Same GTIN already present in the canonical product field; no write |
| `MANUAL_REVIEW` | 0 | No incomplete or ambiguous candidate in the 54-row safe set |
| `BLOCKED` | 0 | No new conflict inside the 54-row safe set |

The 16 known confirmation conflicts remain outside this safe candidate set and
stay quarantined. Evidence abbreviations below: `R1`, `R3`, `R8`, `R11` are
the independent retailer IDs in the fresh canonical snapshot; `MAP+CONF` means
the existing retailer mapping plus the independent source recorded in the
confirmation tables above. `—` means an empty current field or no blocker.

| Product / variant | Product name | Variant | GTIN | Destination | Current | Proposed | Evidence | Blockers | Decision |
|---|---|---|---|---|---|---|---|---|---|
| `1` / `559` | GYM HIGH CREA-4 Elite Capsules | Default | `0742978960459` | `products.gtin` | same | same | 2: R1+R3 | — | `ALREADY_PRESENT` |
| `444` / `533` | GYM HIGH Beta-Alanine 250g | Default | `0742978960480` | `products.gtin` | same | same | 2: R1+R3 | — | `ALREADY_PRESENT` |
| `429` / `391` | GYM HIGH Testo Pro 180 Capsules | Default | `0742978960411` | `products.gtin` | same | same | 2: R1+R3 | — | `ALREADY_PRESENT` |
| `427` / `379` | GYM HIGH BCAA 120 Capsules | Default | `0742978960497` | `products.gtin` | same | same | 2: R1+R3 | — | `ALREADY_PRESENT` |
| `412` / `400` | GYM HIGH L-Glutamine Powder 500g | Default | `0742978960350` | `products.gtin` | same | same | 2: R1+R3 | — | `ALREADY_PRESENT` |
| `413` / `390` | GYM HIGH ZMB 60 Capsules | Default | `0742978960381` | `products.gtin` | same | same | 2: R1+R3 | — | `ALREADY_PRESENT` |
| `389` / `555` | GYM HIGH Creatine Monohydrate Powder 250g | Default | `0794179368862` | `products.gtin` | same | same | 2: R1+R3 | — | `ALREADY_PRESENT` |
| `516` / `572` | GYM HIGH Pure L-Arginine Powder 500g | Default | `0691057494654` | `products.gtin` | same | same | 2: R1+R3 | — | `ALREADY_PRESENT` |
| `529` / `507` | GYM HIGH Creatine Monohydrate 400g | Default | `0691057494883` | `products.gtin` | same | same | 2: R1+R3 | — | `ALREADY_PRESENT` |
| `435` / `414` | KIOR Health Collagen Probio 60 Caps | Default | `0754590525954` | `product_variants.gtin` | — | same | 2: R3+R8 | — | `READY_TO_PROMOTE` |
| `426` / `410` | Applied Nutrition Creatine 120 Capsules | Default | `5056555205297` | `product_variants.gtin` | — | same | 2: R3+R11 | — | `READY_TO_PROMOTE` |
| `439` / `422` | KIOR Health Astragalus+ 60 Caps | Default | `0754590525916` | `product_variants.gtin` | — | same | 2: R3+R8 | — | `READY_TO_PROMOTE` |
| `469` / `2313` | Critical Cookie 85g | Double Chocolate / 85g | `0634158940033` | `product_variants.gtin` | — | same | 2: R3+R11 | — | `READY_TO_PROMOTE` |
| `469` / `2699` | Critical Cookie 85g | Chocolate Chip / 85g | `0634158940026` | `product_variants.gtin` | — | same | 2: R3+R11 | — | `READY_TO_PROMOTE` |
| `81` / `67` | BioTech USA Tri-Creatine Malate 300g | Default | `5999076228171` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `88` / `54` | PEScience TruCreatine 120 Caps | Default | `040232661082` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `360` / `364` | Olimp TCM 1100 Mega Caps 120 Capsules | Default | `5901330020520` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `393` / `334` | Trec Nutrition CM3 1250 90 Capsules | Default | `5902114044664` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `425` / `397` | Creatine Caps 250 Capsules | Default | `5999100029293` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `1040` / `2176` | 7Nutrition Creatine HCL 350 Caps | Unflavoured / 350 capsules | `5903111089412` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `138` / `90` | Solgar Skin, Nail And Hair Formula | Default | `033984017351` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `176` / `227` | Olimp Chela Mag B6 Forte 60 Capsules | Default | `5901330022685` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `258` / `248` | Swanson Potassium Citrate 120 Capsules | Default | `087614023953` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `11` / `1002` | USN Blue Lab Whey 2kg | Caramel Chocolate / 2kg | `6009544910770` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `11` / `1713` | USN Blue Lab Whey 2kg | Strawberry / 2kg | `6009544910718` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `11` / `1714` | USN Blue Lab Whey 2kg | Vanilla / 2kg | `6009544910732` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `11` / `1715` | USN Blue Lab Whey 2kg | Banana / 2kg | `6009544910756` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `11` / `1717` | USN Blue Lab Whey 2kg | Chocolate / 2kg | `6009544910695` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `11` / `1720` | USN Blue Lab Whey 2kg | Salted Caramel / 2kg | `6009544942368` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `11` / `1722` | USN Blue Lab Whey 2kg | Wheytella / 2kg | `6009544918745` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `338` / `1020` | Applied Nutrition Clear Whey 875g | Cherry & Apple / 875g | `658556043769` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `338` / `1782` | Applied Nutrition Clear Whey 875g | Orange Squash / 875g | `5056555214473` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `338` / `1783` | Applied Nutrition Clear Whey 875g | Strawberry & Lime / 875g | `5056555214510` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `338` / `1784` | Applied Nutrition Clear Whey 875g | Strawberry & Raspberry / 875g | `5056555214527` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `338` / `1786` | Applied Nutrition Clear Whey 875g | Watermelon / 875g | `5056555214534` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `10` / `1710` | BioTech USA Iso Whey Zero 1816g | Pineapple-Mango / 1.816kg | `5999076263882` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `55` / `1029` | BioTech USA Nitrox Therapy 340g | Blue Grape / 340g | `5999076253548` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `55` / `1599` | BioTech USA Nitrox Therapy 340g | Tropical Fruit / 340g | `5999076253555` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `55` / `1600` | BioTech USA Nitrox Therapy 340g | Peach / 340g | `5999076253524` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `790` / `1094` | Per4m Creatine Sherbet 310g | Cherry Fizz / 310g | `5061097264619` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `790` / `1095` | Per4m Creatine Sherbet 310g | Fizzy Bubblegum Bottles / 310g | `5061097264633` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `790` / `1096` | Per4m Creatine Sherbet 310g | Original Sherbet / 310g | `5061097264596` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `790` / `1097` | Per4m Creatine Sherbet 310g | Peach Sweets / 310g | `5061097264657` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `790` / `1098` | Per4m Creatine Sherbet 310g | Rainbow Candy / 310g | `5061097264671` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `789` / `1084` | Per4m Pre-Workout Stim 570g | Blackberry / 570g | `5061097261878` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `789` / `1085` | Per4m Pre-Workout Stim 570g | Berry Blast / 570g | `5060660084821` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `789` / `1086` | Per4m Pre-Workout Stim 570g | Cola Bottles / 570g | `5060660084760` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `789` / `1088` | Per4m Pre-Workout Stim 570g | Orange & Mango / 570g | `5060660084784` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `789` / `1089` | Per4m Pre-Workout Stim 570g | Passionfruit / 570g | `5060660084746` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `789` / `1092` | Per4m Pre-Workout Stim 570g | Watermelon Lemonade / 570g | `5060660084807` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `56` / `1601` | Warrior Rage Pre Workout 392g | Energy Burst / 392g | `5060424707256` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `56` / `1604` | Warrior Rage Pre Workout 392g | Wicked Watermelon / 392g | `5060424700363` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `56` / `1605` | Warrior Rage Pre Workout 392g | Charged Cherry / 392g | `5060756342927` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |
| `139` / `142` | Himalaya Liv.52 100 Tablets | Default | `8901138110710` | `product_variants.gtin` | — | same | 2: MAP+CONF | — | `READY_TO_PROMOTE` |

### Owner review — exact 45 write-bearing candidates

Rechecked `2026-08-13T15:26:18.936Z` against a fresh production SELECT-only
view. The review covered exactly the 45 prior `READY_TO_PROMOTE` rows, checked
all 16 quarantined GTINs, and made 0 database writes. Every row retained a
valid checksum, unique canonical/proposed GTIN assignment, active exact product
and variant binding, documented brand/size/count/flavour/format agreement,
empty destination field and no quarantine match. `Current` is therefore `—`
for every row and every proposed value would be a real write. On 13 August 2026
the owner explicitly approved this exact 45-row set. That decision authorizes
the bounded build and future approval scope, but is not a production execution
instruction; a fresh unexpired preview and all runtime gates remain mandatory.

| Product / variant | Brand | Product | Variant / flavour / size | GTIN | Destination | Evidence | Sources | Current | Proposed | Status |
|---|---|---|---|---|---|---:|---|---|---|---|
| `435` / `414` | KIOR Health | KIOR Health Collagen Probio 60 Caps | Default | `0754590525954` | `product_variants.gtin` | 2 | Whey Okay + KIOR Health | — | `0754590525954` | `APPROVE_CANDIDATE` |
| `426` / `410` | Applied Nutrition | Applied Nutrition Creatine 120 Capsules | Default | `5056555205297` | `product_variants.gtin` | 2 | Whey Okay + 6 Pack Supplements | — | `5056555205297` | `APPROVE_CANDIDATE` |
| `439` / `422` | KIOR Health | KIOR Health Astragalus+ 60 Caps | Default | `0754590525916` | `product_variants.gtin` | 2 | Whey Okay + KIOR Health | — | `0754590525916` | `APPROVE_CANDIDATE` |
| `469` / `2313` | Applied Nutrition | Critical Cookie 85g | Double Chocolate / 85g | `0634158940033` | `product_variants.gtin` | 2 | Whey Okay + 6 Pack Supplements | — | `0634158940033` | `APPROVE_CANDIDATE` |
| `469` / `2699` | Applied Nutrition | Critical Cookie 85g | Chocolate Chip / 85g | `0634158940026` | `product_variants.gtin` | 2 | Whey Okay + 6 Pack Supplements | — | `0634158940026` | `APPROVE_CANDIDATE` |
| `81` / `67` | BioTech USA | BioTech USA Tri-Creatine Malate 300g | Default | `5999076228171` | `product_variants.gtin` | 2 | Whey Okay + Farmacia Tei | — | `5999076228171` | `APPROVE_CANDIDATE` |
| `88` / `54` | PEScience | PEScience TruCreatine 120 Caps | Default | `040232661082` | `product_variants.gtin` | 2 | Whey Okay + Get Yok'd | — | `040232661082` | `APPROVE_CANDIDATE` |
| `360` / `364` | Olimp | Olimp TCM 1100 Mega Caps 120 Capsules | Default | `5901330020520` | `product_variants.gtin` | 2 | Whey Okay + official Olimp Store | — | `5901330020520` | `APPROVE_CANDIDATE` |
| `393` / `334` | Trec Nutrition | Trec Nutrition CM3 1250 90 Capsules | Default | `5902114044664` | `product_variants.gtin` | 2 | Whey Okay + Tanie Odzywki | — | `5902114044664` | `APPROVE_CANDIDATE` |
| `425` / `397` | Scitec Nutrition | Creatine Caps 250 Capsules | Default | `5999100029293` | `product_variants.gtin` | 2 | Whey Okay + Dr. Max | — | `5999100029293` | `APPROVE_CANDIDATE` |
| `1040` / `2176` | 7Nutrition | 7Nutrition Creatine HCL 350 Caps | Unflavoured / 350 capsules | `5903111089412` | `product_variants.gtin` | 2 | Whey Okay + Mega Protein Store | — | `5903111089412` | `APPROVE_CANDIDATE` |
| `138` / `90` | Solgar | Solgar Skin, Nail And Hair Formula | Default / 60 tablets | `033984017351` | `product_variants.gtin` | 2 | Whey Okay + Target | — | `033984017351` | `APPROVE_CANDIDATE` |
| `176` / `227` | Olimp | Olimp Chela Mag B6 Forte | Default / 60 capsules | `5901330022685` | `product_variants.gtin` | 2 | Whey Okay + official Olimp Store | — | `5901330022685` | `APPROVE_CANDIDATE` |
| `258` / `248` | Swanson | Swanson Potassium Citrate 99 mg | Default / 120 capsules | `087614023953` | `product_variants.gtin` | 2 | Whey Okay + iHerb | — | `087614023953` | `APPROVE_CANDIDATE` |
| `11` / `1002` | USN | USN Blue Lab Whey 2kg | Caramel Chocolate / 2kg | `6009544910770` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `6009544910770` | `APPROVE_CANDIDATE` |
| `11` / `1713` | USN | USN Blue Lab Whey 2kg | Strawberry / 2kg | `6009544910718` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `6009544910718` | `APPROVE_CANDIDATE` |
| `11` / `1714` | USN | USN Blue Lab Whey 2kg | Vanilla / 2kg | `6009544910732` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `6009544910732` | `APPROVE_CANDIDATE` |
| `11` / `1715` | USN | USN Blue Lab Whey 2kg | Banana / 2kg | `6009544910756` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `6009544910756` | `APPROVE_CANDIDATE` |
| `11` / `1717` | USN | USN Blue Lab Whey 2kg | Chocolate / 2kg | `6009544910695` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `6009544910695` | `APPROVE_CANDIDATE` |
| `11` / `1720` | USN | USN Blue Lab Whey 2kg | Salted Caramel / 2kg | `6009544942368` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `6009544942368` | `APPROVE_CANDIDATE` |
| `11` / `1722` | USN | USN Blue Lab Whey 2kg | Wheytella / 2kg | `6009544918745` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `6009544918745` | `APPROVE_CANDIDATE` |
| `338` / `1020` | Applied Nutrition | Applied Nutrition Clear Whey 875g | Cherry & Apple / 875g | `658556043769` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `658556043769` | `APPROVE_CANDIDATE` |
| `338` / `1782` | Applied Nutrition | Applied Nutrition Clear Whey 875g | Orange Squash / 875g | `5056555214473` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `5056555214473` | `APPROVE_CANDIDATE` |
| `338` / `1783` | Applied Nutrition | Applied Nutrition Clear Whey 875g | Strawberry & Lime / 875g | `5056555214510` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `5056555214510` | `APPROVE_CANDIDATE` |
| `338` / `1784` | Applied Nutrition | Applied Nutrition Clear Whey 875g | Strawberry & Raspberry / 875g | `5056555214527` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `5056555214527` | `APPROVE_CANDIDATE` |
| `338` / `1786` | Applied Nutrition | Applied Nutrition Clear Whey 875g | Watermelon / 875g | `5056555214534` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `5056555214534` | `APPROVE_CANDIDATE` |
| `10` / `1710` | BioTech USA | BioTech USA Iso Whey Zero 1816g | Pineapple-Mango / 1.816kg | `5999076263882` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `5999076263882` | `APPROVE_CANDIDATE` |
| `55` / `1029` | BioTech USA | BioTech USA Nitrox Therapy 340g | Blue Grape / 340g | `5999076253548` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `5999076253548` | `APPROVE_CANDIDATE` |
| `55` / `1599` | BioTech USA | BioTech USA Nitrox Therapy 340g | Tropical Fruit / 340g | `5999076253555` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `5999076253555` | `APPROVE_CANDIDATE` |
| `55` / `1600` | BioTech USA | BioTech USA Nitrox Therapy 340g | Peach / 340g | `5999076253524` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `5999076253524` | `APPROVE_CANDIDATE` |
| `790` / `1094` | Per4m | Per4m Creatine Sherbet 310g | Cherry Fizz / 310g | `5061097264619` | `product_variants.gtin` | 2 | Jon's Supplements + Tropicana Wholesale | — | `5061097264619` | `APPROVE_CANDIDATE` |
| `790` / `1095` | Per4m | Per4m Creatine Sherbet 310g | Fizzy Bubblegum Bottles / 310g | `5061097264633` | `product_variants.gtin` | 2 | Jon's Supplements + Tropicana Wholesale | — | `5061097264633` | `APPROVE_CANDIDATE` |
| `790` / `1096` | Per4m | Per4m Creatine Sherbet 310g | Original Sherbet / 310g | `5061097264596` | `product_variants.gtin` | 2 | Jon's Supplements + Tropicana Wholesale | — | `5061097264596` | `APPROVE_CANDIDATE` |
| `790` / `1097` | Per4m | Per4m Creatine Sherbet 310g | Peach Sweets / 310g | `5061097264657` | `product_variants.gtin` | 2 | Jon's Supplements + Tropicana Wholesale | — | `5061097264657` | `APPROVE_CANDIDATE` |
| `790` / `1098` | Per4m | Per4m Creatine Sherbet 310g | Rainbow Candy / 310g | `5061097264671` | `product_variants.gtin` | 2 | Jon's Supplements + Tropicana Wholesale | — | `5061097264671` | `APPROVE_CANDIDATE` |
| `789` / `1084` | Per4m | Per4m Pre-Workout Stim 570g | Blackberry / 570g | `5061097261878` | `product_variants.gtin` | 2 | Jon's Supplements + Tropicana Wholesale | — | `5061097261878` | `APPROVE_CANDIDATE` |
| `789` / `1085` | Per4m | Per4m Pre-Workout Stim 570g | Berry Blast / 570g | `5060660084821` | `product_variants.gtin` | 2 | Jon's Supplements + Tropicana Wholesale | — | `5060660084821` | `APPROVE_CANDIDATE` |
| `789` / `1086` | Per4m | Per4m Pre-Workout Stim 570g | Cola Bottles / 570g | `5060660084760` | `product_variants.gtin` | 2 | Jon's Supplements + Tropicana Wholesale | — | `5060660084760` | `APPROVE_CANDIDATE` |
| `789` / `1088` | Per4m | Per4m Pre-Workout Stim 570g | Orange & Mango / 570g | `5060660084784` | `product_variants.gtin` | 2 | Jon's Supplements + Tropicana Wholesale | — | `5060660084784` | `APPROVE_CANDIDATE` |
| `789` / `1089` | Per4m | Per4m Pre-Workout Stim 570g | Passionfruit / 570g | `5060660084746` | `product_variants.gtin` | 2 | Jon's Supplements + Tropicana Wholesale | — | `5060660084746` | `APPROVE_CANDIDATE` |
| `789` / `1092` | Per4m | Per4m Pre-Workout Stim 570g | Watermelon Lemonade / 570g | `5060660084807` | `product_variants.gtin` | 2 | Jon's Supplements + Tropicana Wholesale | — | `5060660084807` | `APPROVE_CANDIDATE` |
| `56` / `1601` | Warrior | Warrior Rage Pre Workout 392g | Energy Burst / 392g | `5060424707256` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `5060424707256` | `APPROVE_CANDIDATE` |
| `56` / `1604` | Warrior | Warrior Rage Pre Workout 392g | Wicked Watermelon / 392g | `5060424700363` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `5060424700363` | `APPROVE_CANDIDATE` |
| `56` / `1605` | Warrior | Warrior Rage Pre Workout 392g | Charged Cherry / 392g | `5060756342927` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `5060756342927` | `APPROVE_CANDIDATE` |
| `139` / `142` | Himalaya | Himalaya Liv.52 100 Tablets | Default / 100 tablets | `8901138110710` | `product_variants.gtin` | 2 | Whey Okay + Tropicana Wholesale | — | `8901138110710` | `APPROVE_CANDIDATE` |

Owner review totals: 45 reviewed, 45 `APPROVE_CANDIDATE`, 0
`OWNER_CHECK_REQUIRED`, 0 `products.gtin` destinations, 45
`product_variants.gtin` destinations, 45 real future writes and 0 no-ops in
this reviewed set. The separate nine `ALREADY_PRESENT` identities remain
outside the 45-row review and require no write. The owner approved all 45 in
one decision bound to this exact set; any future write must still use a newly
generated, unexpired, stale-safe preview.

### Promotion handoff (completed)

The promotion handoff was to confirm eBay/EPN account and Buy API access. That
access gate is now complete. The guarded GTIN promotion must not be run again:
preserve all 54 safe identities as no-ops and all 16 conflicts in quarantine,
and do not enable `SAFE_UPDATE` or run another confirmation batch.

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

## Marketplace account-deletion notification endpoint

The existing Browse pilot did not include this compliance endpoint. A focused
audit found no prior route, challenge handler or signed-notification verifier,
so the implementation extends the existing OAuth mechanism instead of building
a second eBay client.

- Canonical HTTPS endpoint:
  `https://www.supplementscout.co.uk/api/ebay/account-deletion`.
- `GET` validates the exact endpoint and returns eBay's SHA-256 challenge
  response using `challenge_code + verification token + endpoint URL`.
- `POST` limits payload size, requires a structurally valid
  `X-EBAY-SIGNATURE` and valid JSON before immediately acknowledging receipt
  with HTTP 204, as required by eBay's receiving guide. It then verifies the
  signature and full deletion-payload schema after the response using Next.js `after()`,
  retrieves eBay's signing key through the official public-key API using
  application OAuth and caches only the public key in memory. No deletion
  processing runs unless that background signature verification succeeds.
- The route accepts only `MARKETPLACE_ACCOUNT_DELETION` schema `1.0`, never
  logs user identifiers, secrets or authorization headers, and performs no
  database write.
- SupplementScout currently has no persistent production eBay seller, buyer or
  user-data store, so a valid deletion event has zero stored records to delete.
  This explicit no-op boundary must be replaced and owner-reviewed before any
  such persistent eBay data store is introduced.
- Required production secrets are `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` and
  `EBAY_NOTIFICATION_VERIFICATION_TOKEN`. The verification token must be a
  private 32-80 character value using only letters, digits, underscore or
  hyphen. Values must be stored only in deployment secret storage and must
  never be committed or pasted into project documentation.

Local tests use generated RSA fixture keys and mocked OAuth/public-key
responses. They make no real eBay API call. Vercel deployment for commit
`dce0c95046ea74e274e50501d9e3502dc5f5462a` completed successfully. A live
secret-free GET returned the intended fail-closed HTTP 503 response. Secret
configuration was owner-confirmed and the live eBay challenge was accepted.
The first signed test exposed that the endpoint verified before acknowledging,
which caused an HTTP 503 while the keyset was still non-compliant. The order was
aligned with eBay's documented immediate-acknowledgement sequence; a live eBay
  retry returned HTTP 400 because eBay's synthetic test body did not satisfy
  the full real-notification schema. Full payload validation was therefore
  moved behind signature verification, where it continues to block all
  processing without blocking the required immediate acknowledgement. Another
  live eBay test retry remains pending.

Official references:

- https://developer.ebay.com/develop/guides-v2/marketplace-user-account-deletion
- https://developer.ebay.com/api-docs/sell/notification/resources/public_key/methods/getPublicKey
- https://github.com/eBay/event-notification-nodejs-sdk

## USER ACTION REQUIRED

Do not mark a box from repository evidence. The owner must confirm each status.

### EPN

- [ ] `UNKNOWN — USER ACTION REQUIRED`: confirm an ordinary eBay account exists
  and record only `DONE`/`NOT STARTED`, never credentials.
- [x] Owner confirmed the eBay Partner Network account was approved on
  14 August 2026.
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

- [x] Owner confirmed the eBay Developers Program account was created.
- [x] Owner created the SupplementScout application.
- [x] Owner created Sandbox and Production keysets; Production remains disabled
  pending notification compliance.
- [x] Owner added the endpoint's three Production secrets in Vercel and saved
  the exact endpoint with its matching verification token in eBay.
- [ ] `USER ACTION REQUIRED`: retry `Send Test Notification` after the
  acknowledgement-order fix is deployed.
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
- `EBAY_NOTIFICATION_VERIFICATION_TOKEN`
- `EBAY_MARKETPLACE_ID=EBAY_GB` (non-secret configuration)
- `EBAY_EPN_CAMPAIGN_ID`
- `EBAY_UK_DELIVERY_POSTCODE` (private operational configuration)
- optional pilot-only policy controls:
  `EBAY_PILOT_MIN_FEEDBACK_PERCENTAGE` and
  `EBAY_PILOT_MIN_FEEDBACK_SCORE` (non-secret; defaults 98 and 100, not final
  production thresholds)

Do not persist short-lived OAuth access tokens in Git. Mint and cache them at
runtime within their lifetime. Never print client secret, access token or full
Authorization headers in reports or CI logs.

## Implemented read-only 54-GTIN Browse API pilot

The pilot reuses the canonical GTIN promotion preview as its identity source
and requires exactly 54 current `ALREADY_PRESENT` safe identities. It enriches
them through SELECT-only reads of products, variants, retailer mappings and
offers. It contains no insert, update, delete, upsert, RPC, migration, retailer
creation or public publication path.

- CLI: `npm run ebay:pilot`
- input-only preparation without an eBay call:
  `npm run ebay:pilot -- --prepare-input`
- ignored immutable artifacts and SHA-256 sidecars:
  `tmp/ebay-uk-coverage/`
- OAuth: client credentials; token cached only in process memory until shortly
  before expiry; secrets, tokens and Authorization headers are excluded from
  artifacts and errors
- Browse requests: exact GTIN, `EBAY_GB`, fixed-price, new, delivery country GB
  and a controlled contextual UK postcode; item detail is fetched only from a
  validated `api.ebay.com/buy/browse/v1/item/` URL
- decisions: exactly `AUTO_ELIGIBLE`, `REVIEW`, `REJECT`, `NOT_FOUND`; at most
  one selected offer per canonical variant
- identity qualification precedes price ranking; unknown shipping, incomplete
  identity or seller quality below the proposed threshold cannot become
  `AUTO_ELIGIBLE`
- raw API evidence, normalized evidence, seller fields, rejection reasons,
  prices and KPI denominators stay in ignored local artifacts
- affiliate readiness is true only when eBay returns `itemAffiliateWebUrl`;
  the adapter never substitutes or publishes an untracked ordinary item URL

Required configuration after approvals: `EBAY_CLIENT_ID`,
`EBAY_CLIENT_SECRET`, `EBAY_MARKETPLACE_ID=EBAY_GB`,
`EBAY_UK_DELIVERY_POSTCODE`, and optional `EBAY_EPN_CAMPAIGN_ID` only after EPN
approval.

The report records checked/found/exact/qualified/safely-addable counts; Tier
A/B/C; decision and blocker counts; seller evidence; how many eBay offers would
become a second retailer; how many beat the current complete delivered price;
median delivered-price difference; and how many products remain
single-retailer. Primary KPI:
`increase in products with 2+ qualified offers`.

## Live read-only pilot result — 14 August 2026

The production Browse API run completed for the immutable 54-identity cohort.
The first local attempt failed before reaching eBay because Node did not use
the Windows system certificate store; rerunning the unchanged command with
`NODE_OPTIONS=--use-system-ca` completed normally. This was a local TLS setup
issue, not a change to the input, policy or API safety gates.

| Measure | Result |
|---|---:|
| Checked | 54 |
| Found | 10 |
| Exact returned GTIN | 5 |
| Fully qualified | 2 |
| `AUTO_ELIGIBLE` / safely addable | 2 |
| `REVIEW` | 3 |
| `REJECT` | 5 |
| `NOT_FOUND` | 44 |
| Tier A / B / C | 2 / 3 / 5 |
| Would become second retailer | 2 |
| Lowest complete delivered price | 2 |
| Median delivered-price difference | -GBP 6.42 |
| Products still single-retailer | 39 |
| Database writes | 0 |

The two `AUTO_ELIGIBLE` candidates are evidence only, not approved catalogue
writes:

| Product / variant | eBay evidence | Delivered-price comparison |
|---|---|---|
| `56` / `1605` — Warrior Rage Unleash Hell Pre Workout 392g, Charged Cherry, GTIN `5060756342927` | item `203341686447`; seller `bodybuildingwarehouse`; 99.8%, score 412628; exact returned GTIN | GBP 11.99 versus GBP 22.60 current |
| `176` / `227` — Olimp Chela Mag B6 Forte 60 Capsules, GTIN `5901330022685` | item `373250053773`; seller `nutrafituk`; 100%, score 123417; exact returned GTIN | GBP 14.49 versus GBP 16.73 current |

The three `REVIEW` rows are Solgar Skin, Nail And Hair Formula 60 Tablets
(`138` / `90`; listing title says 120 tablets), Applied Nutrition Creatine 120
Capsules (`426` / `410`) and Per4m Pre-Workout Stim 570g Berry Blast (`789` /
`1085`). Each lacks a returned GTIN; the Solgar unit-count difference is an
additional owner-review warning. The five rejected rows remain excluded. Their
blockers comprise three flavour mismatches, two unit-count mismatches, one
unproven size, one unproven format and five unproven returned GTINs; a row can
have more than one blocker.

The ignored local evidence is sealed by these file SHA-256 values:

- input: `9117B0C2A8A092EFC4E266E08F8ACC408B1EF89973D808A761B3DB0F6EAAAA31`;
- raw response: `1A3A3670DB698856F6EC7289B72C98A07850A1345ADEB96B6CFAEFB820DFCD70`;
- report: `072AA67EAF378E29B6D2F9FCBAA574961829FF0564CAB8AC559924ADB41F8857`.

Affiliate campaign configuration was absent. Ordinary eBay URLs must not be
substituted for tracked affiliate URLs, and none of these results may be
published or written before a separate owner-approved production design.

### Owner quality review — 14 August 2026

The owner accepted the quality review after the immutable report was checked
row by row. Existing pilot decisions remain the control vocabulary; no second
classification or pipeline was created.

| Pilot row | Review outcome | Reason |
|---|---|---|
| Warrior Rage Charged Cherry, `56` / `1605`, item `203341686447` | `AUTO_ELIGIBLE` accepted for future design | Exact GTIN, brand family, 392g, Charged Cherry, powder, new fixed-price listing, qualified business seller and complete delivered price agree |
| Olimp Chela Mag B6 Forte 60 Capsules, `176` / `227`, item `373250053773` | `AUTO_ELIGIBLE` accepted for future design | Exact GTIN, brand, 60 capsules, capsule format, new fixed-price listing, qualified business seller and complete delivered price agree |
| Solgar Skin, Nail And Hair Formula 60 Tablets, `138` / `90`, item `365921935616` | `REJECT` | Canonical identity is 60 tablets but the listing title and aspects state 120 tablets; returned GTIN is absent |
| Applied Nutrition Creatine 120 Capsules, `426` / `410`, item `227411188622` | remains `REVIEW` | Brand, format and 120-count text agree, but eBay did not return the GTIN; do not infer exact identity from the title |
| Per4m Pre-Workout Stim 570g Berry Blast, `789` / `1085`, item `227219788408` | remains `REVIEW` | Brand, flavour, powder format and 570g text agree, but eBay did not return the GTIN; do not infer exact identity from the title |

Review totals: 5 checked, 2 accepted for future design, 1 rejected and 2
still held in `REVIEW`. The accepted rows are not affiliate-ready and remain
outside the database and public site.

## Scaled offer discovery — 14 August 2026

The existing runner was extended rather than replaced. Its default 54-GTIN
pilot remains unchanged. The new `--discover-one-retailer` mode accepts only
active, unmerged, checksum-valid, unambiguous variant GTINs with exactly one
current retailer, excludes canonical and documented quarantined GTINs, caps
Browse results and item-detail reads at five per identity, writes only ignored
immutable artifacts and has no mutation or publication method.

The exact-GTIN discovery input contained 355 variants across 150 products,
fingerprint
`36aa3fca1595cfbf3c7ab2689ca31bb2ca8d21b052eeb976ba154f07c31c87b7`.
It returned 59 found variants across 29 products, 45 exact-GTIN rows across 19
products, 19 `REVIEW`, 40 `REJECT` and 296 `NOT_FOUND`. Zero rows passed every
automatic semantic gate; the exact GTIN alone did not override flavour, size,
format, marketplace, count or seller-quality failures.

A bounded title fallback used one missing representative per product and kept
title-only evidence out of automatic approval unless item detail returned the
same GTIN and all existing gates passed. It checked 140 products, found 126,
returned 27 exact GTINs and initially classified 19 as `AUTO_ELIGIBLE`, 26 as
`REVIEW`, 81 as `REJECT` and 14 as `NOT_FOUND`. Manual independence review
found nine of those 19 automatic rows were eBay listings operated by the same
Simply Supplements retailer already attached to the product. They are not
second-retailer coverage. A durable `SELLER_NOT_INDEPENDENT` gate now compares
the eBay seller with current retailer identities and evidence domains.

Combined, deduplicated evidence across the three runs is:

| Measure | Result |
|---|---:|
| Unique products with at least one eBay listing lead | 144 |
| Unique products with eBay-returned exact GTIN | 46 |
| Unique products with independent-seller exact GTIN | 36 |
| Strong independent candidates after current gates | 12 |
| Additional strong candidates from scaled discovery | 10 |
| Same-source products detected across reports | 12 |
| Database writes / public offer publications | 0 / 0 |

The 10 additional strong candidates are BioTech USA Iso Whey Zero 1816g
Vanilla; BioTech USA Vegan Protein 500g Chocolate-Cinnamon; Applied Nutrition
ISO-XP 1.8kg Cafe Latte; Dorian Yates Blood & Guts 380g Mango; Cellucor C4
Original 195g Green Apple; Mutant Madness 225g Roadside Lemonade; Nutrend Pump
225g Rainbow; HR Labs Basic 510g Strawberry And Fuzzy Fruits; Applied
Nutrition Critical Cookie White Chocolate & Raspberry; and Per4m EAA Xtra
420g Blue Raspberry. These are candidates for owner review and future design,
not database writes.

### Owner approval and controlled 5 + 5 rollout boundary

The owner approved exactly these 10 rows on 14 August 2026. Evidence is bound
to title report SHA-256
`D87ADB0D9A7C127710FC86C72798C6CB4CFDDD8FA14DE0C7C96FC3B51FE70229`.

| Batch | Product / variant | GTIN | eBay item | Seller | Delivered / current best | Owner status |
|---|---|---|---|---|---:|---|
| A | `10` / `1704` BioTech USA Iso Whey Zero, Vanilla 1.816kg | `5999076263851` | `323304007010` | `trainingfuels` | GBP 77.99 / 88.66 | APPROVED FOR DRY-RUN |
| A | `71` / `1008` BioTech USA Vegan Protein, Chocolate-Cinnamon 500g | `5999076228362` | `394018039646` | `ukesupps-2008` | GBP 19.99 / 21.66 | APPROVED FOR DRY-RUN |
| A | `27` / `1586` Cellucor C4 Original, Green Apple 195g | `842595109191` | `373707858011` | `nutrafituk` | GBP 19.99 / 26.76 | APPROVED FOR DRY-RUN |
| A | `489` / `1792` Mutant Madness, Roadside Lemonade 225g | `627933026183` | `204481126203` | `superfoodsinc` | GBP 19.95 / 26.36 | APPROVED FOR DRY-RUN |
| A | `528` / `1847` Nutrend Pump, Rainbow 225g | `8594073170477` | `145921318153` | `powerbodyltd` | GBP 18.10 / 23.98 | APPROVED FOR DRY-RUN |
| B | `178` / `1762` Applied Nutrition ISO-XP, Cafe Latte 1.8kg | `5056555204627` | `137546859794` | `powerbodyltd` | GBP 84.81 / 85.52 | APPROVED FOR DRY-RUN |
| B | `19` / `767` Dorian Yates Blood & Guts, Mango 380g | `5060763890480` | `256978504929` | `thesupplementstoreuk` | GBP 25.90 / 24.98 | APPROVED FOR DRY-RUN |
| B | `220` / `1057` HR Labs Basic, Strawberry And Fuzzy Fruits 510g | `5060662330162` | `404774853352` | `ukesupps-2008` | GBP 36.99 / 37.98 | APPROVED FOR DRY-RUN |
| B | `471` / `462` Critical Cookie, White Chocolate & Raspberry | `5056555201039` | `406431647826` | `muscle-factory-co-uk` | GBP 6.18 / 6.28 | APPROVED FOR DRY-RUN |
| B | `788` / `1074` Per4m EAA Xtra, Blue Raspberry 420g | `5060660086122` | `326796105372` | `trainingfuels` | GBP 25.99 / 27.48 | APPROVED FOR DRY-RUN |

Batch A intentionally covers five different sellers. After Campaign ID is
configured, refresh only these five listings and require five returned
`itemAffiliateWebUrl` values. Then prepare five ordinary input rows for the
existing importer, run dry-run, inspect canonical IDs, listing URLs, prices,
shipping and proposed deltas, and request a separate apply approval. Only after
live link, tracking, catalogue and idempotency verification may Batch B follow
through the same unchanged path. No row may move from A to B or be substituted
without a new owner review.

Importer reuse decision:

- use `scripts/import-products.js`; do not build another importer;
- bind every row explicitly to the existing product and variant IDs;
- let the plan create one `eBay UK` retailer row when absent, then create only
  the mapping, offer and price-history rows expected for that listing;
- use eBay's REST item ID / legacy item ID, returned GTIN, direct listing URL
  and returned affiliate URL in their existing identity/URL fields;
- retain seller, exact-match and shipping evidence in the sealed owner-approved
  source artifact and its hash rather than overloading `external_options`;
- keep one active eBay offer per canonical variant in the approved manifest;
- require dry-run, immutable artifact, plan fingerprint, separate approval,
  single-plan atomic apply, live verification and replay/no-op verification.

The final existing-importer dry-run passed with five plans and zero blocked
rows. Every plan uses an existing product and existing variant, proposes one
new exact-GTIN retailer mapping, one affiliate offer and one price-history row,
and proposes no canonical product or variant creation/update. New mappings now
record `match_method = gtin` and confidence `100`; a narrowly scoped importer
correction preserves all historical mapping values and changes only new mapping
metadata. Focused importer tests pass.

Evidence:

- canary input SHA-256:
  `6be53037891303e990e3191defbf653204e7cbac7557c135b1bdd23db11fb2bc`;
- canary raw response SHA-256:
  `f84d1f0be781f043015e5e6bfa9919466b71f3d61d6b1017408038bfc2b0e2e6`;
- canary report SHA-256:
  `af6123c51f9c3ca6c4d0a67e3679f125aa6876093b4e84644a84f7932f3ab984`;
- exact five-row importer source SHA-256:
  `54030992c5cc8d2b8e7240473365f4b7b59c42d1e39a9d18d95aa8d16d316d29`;
- final dry-run artifact SHA-256:
  `33a234cba05d441abf0551546d7933a2ba6e64a5fc5e683035b8905138fcabac`.

No approval record or production write has been created. Because the retailer
does not yet exist, all five previews contain `retailer.action = create`.
Applying one would make the other four previews stale. The safe release order
is therefore: separately approve and apply the first exact plan to bootstrap
the retailer plus its offer; live-verify it; regenerate the remaining exact
four against the new state; then separately approve/apply and verify those four.
This is still logical Batch A and does not change its five approved listings.

Local artifact file SHA-256 evidence:

- exact input: `892D859BDF27D16647A95B5A0E327ACD1E07732A28EEC6E1FC6870B3B7DD2080`;
- exact raw: `365D826CA2BFE81C04D2B839BA3BEDA26FE997BE3FB7733DF0C8DB28C08E27AF`;
- exact report: `E0F0818F85657254EB959E848B9AEA7E72BF25312CD9468D968B2EFE388AACAA`;
- title input: `7173BD922E4D2A3FF10FEBE88B5C87F7B8231CD962F08E8A84867F2D64AAC546`;
- title raw: `3E198028EB7AEEBCEF54B62AE65DCD0747EE4FCB41A7AB9595141073EF405272`;
- title report: `D87ADB0D9A7C127710FC86C72798C6CB4CFDDD8FA14DE0C7C96FC3B51FE70229`.

The 50-product discovery goal is complete, but the 50-safe-independent-offer
goal is not. Reaching it requires bounded owner review and stronger source or
listing evidence for at least 38 more products; the gate must not be weakened
and the 144 listing leads must not be presented as catalogue-ready offers.

## Read-only pilot specification — historical target 100 verified GTIN identities

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
  level; 14 recovered identities and 40 independently confirmed identities are
  safe candidates but have not been written.
- Another 748 valid mapping identities have only one retailer source and must
  not be promoted automatically without review or stronger evidence.
- eBay seller listings can be incorrect even when a GTIN is supplied.
- Seller/listing identity can change between refreshes.
- Shipping can depend on postcode and may be missing or calculated.
- Pack, flavour, formulation and condition ambiguity create false positives.
- Current schema lacks first-class marketplace seller and selection evidence.
- Account-deletion notification compliance, Production keyset activation and
  production Browse API access are live-verified.
- Affiliate disclosure requires a future public design change, separately
  approved.
- eBay API beta/contract and field behavior can change; reverify official docs
  before implementation.
- Marketplace result sorting/selection must be reconciled with the exact
  approved eBay use case and current Buy API requirements.

## Blockers

- `APPROVED BY OWNER`: EPN account and eBay Developers account.
- `LIVE VERIFIED`: eBay challenge and signed test delivery both succeeded.
- `OWNER VERIFIED`: Production keyset is no longer marked `Non Compliant`.
- `LIVE VERIFIED`: Production Browse API access; the guarded 54-identity
  read-only run completed.
- `OWNER REVIEWED`: 2 `AUTO_ELIGIBLE` rows accepted for future design; one
  reviewed row rejected and two remain held in `REVIEW`.
- `LIVE READ-ONLY EVIDENCE`: 144 unique products have eBay listing leads; 46
  have returned exact GTIN and 36 combine exact GTIN with an independent
  seller.
- `OWNER APPROVED`: exact 10 new strong independent rows for controlled dry-run
  design; together with the original two, 12 strong candidates are available.
- `LIVE READ-ONLY VERIFIED`: EPN Campaign ID is configured; exact Batch A
  refresh returned 5/5 affiliate URLs and final importer dry-run returned five
  exact plans with zero blockers.
- `LIVE VERIFIED`: the first exact Batch A plan created one eBay retailer, one
  mapping, one offer and one price-history row; public offer `/go/2539` is
  visible and the postflight is an exact no-op.
- `LIVE VERIFIED`: the separately approved remaining four Batch A plans
  executed 4/4 and their postflight is an exact no-op; Batch A is complete
  5/5.
- `READ-ONLY VERIFIED`: the exact five Batch B item IDs remain
  `AUTO_ELIGIBLE` and affiliate-ready; the existing importer produced five
  create plans with zero blockers.
- `LIVE VERIFIED`: owner-approved Batch B run `31824324247` executed 5/5 and
  postflight returned five exact no-ops; production and public readback passed
  5/5. Batch C subsequently passed 7/7, so the controlled rollout is complete
  17/17.
- `READ-ONLY VERIFIED`: the 15 August monitor checked all 17 live listings.
  Every exact item remained available and affiliate-ready, with 0 blockers and
  0 price, shipping or delivered-total drift. Fourteen passed the automatic
  gate; three retained only their previously owner-accepted missing returned
  GTIN evidence.
- `DISCOVERY EXHAUSTED`: production currently has 339 eligible one-retailer
  external-GTIN identities. All 339 were already checked by exact GTIN, and all
  137 relevant products missed by that search were already checked by title.
  No new unseen identity remains in the current catalogue.
- `MISSING-GTIN PRIORITY AUDIT COMPLETE`: a fresh SELECT-only production audit
  checked 2,641 variant rows and found 904 active variant identities across
  406 distinct products that have exactly one fresh non-eBay retailer, no eBay
  mapping and no valid canonical or retailer GTIN. The bounded priority cohort
  contains exactly 50 distinct products: 13 Creatine, 20 Whey Protein and 17
  Vitamins; their current source retailers are 25 Six Pack Supplements, 20
  Jon's Supplements and five Discount Supplements. Ten rows with an internal
  weight conflict were excluded before ranking. This cohort is new barcode-
  recovery work, not a repeat of the 339 already-searched GTIN identities.
  Audit fingerprint:
  `7c096b18452a4117e48758364e00a39ee4ab2c0a35fbdc94ff28f0fd1ab34498`.
  Production writes, eBay calls and canonical changes remained zero.
- `READ-ONLY GTIN CONFIRMATION COMPLETE`: the exact 50-product cohort was
  checked against its current retailer source and a second independent source,
  with checksum, pack, flavour, format, canonical collision and documented
  quarantine gates retained. Result: 36 `CONFIRMED`, 6 `REVIEW`, 8 `CONFLICT`
  and 0 `NOT_FOUND`; confirmation rate 72%. No GTIN was written and no eBay
  call was made. The exact confirmed and blocked scopes are recorded under
  `Last verified`; they are not authority for a production write.
- `OWNER REVIEW COMPLETE — EXACT 36`: after explicit owner authorization, a
  fresh production readback re-ran the existing promotion planner plus
  checksum, canonical destination, retailer-mapping collision, quarantine and
  identity-drift checks for exactly the 36 confirmed rows. Result: 36
  `APPROVE_CANDIDATE`, 0 `OWNER_CHECK_REQUIRED`; all 36 destinations are
  `product_variants.gtin`, all current destination values remain empty, so the
  future guarded operation would contain 36 writes and 0 no-ops. Review
  fingerprint: `e5f6a0fbaefad881c713cb138c626282396a98794fdb53bca5b508fdbbc2d619`.
  This completed review made zero database writes and is not apply authority.
- `GUARDED DRY-RUN COMPLETE — EXACT 36`: after separate owner authorization,
  the existing `gtin-promotion-dry-run` received a fail-closed
  `owner-reviewed-36` scope. Its code-bound allowlist must exactly match the
  documented 36 identities; it also checks current canonical state, checksum,
  destination, documented quarantine and foreign retailer-mapping collisions.
  Fresh production preview: 36 `READY_TO_PROMOTE`, 0 `ALREADY_PRESENT`, 0
  `MANUAL_REVIEW`, 0 `BLOCKED`; 36 empty `product_variants.gtin` destinations.
  Owner-scope fingerprint:
  `415142d4ba069103441a908bba4a15c3de73a828b9b7896a8556e29f32a97c02`;
  preview fingerprint:
  `141b60e898ec1eb41a5482d1c481f19d4064867091c3917a99ab0934efe141e8`;
  local immutable preview SHA-256:
  `5c058fcd9883c3cee5f9eefb1a5420fc91bdd8392f3822b5b4b8c956a82a2d92`.
  The preview explicitly has `write_enabled=false` and
  `safe_update_enabled=false`; database writes, migrations, approvals, apply
  and eBay calls remained zero.
- `EXACT-36 ARTIFACT CONTRACT BUILT LOCALLY`: the existing
  `gtin:promotion` operation now accepts the same closed
  `owner-reviewed-36` scope in plan mode and creates the normal immutable plan
  envelope with exact expected product/variant state, row fingerprints, plan
  fingerprint and SHA-256 sidecar. Fresh artifact SHA-256:
  `b1b8996d1555ed0dbf48f952ef1c75a7cefd4cdfb78e052516eb5ff0042f26c1`;
  plan fingerprint: `98af96f0c6d1533495b828781a69a771`; rows: 36. The
  completed exact-45 constants and workflow remain unchanged. Exact-36
  protected `validate` and `apply` fail closed until a separately reviewed
  database migration is deployed; the current workflow exposes no exact-36
  release option. This prevents the local design from becoming accidental
  write authority.
- `EXACT-36 GUARDED EXTENSION BUILT LOCALLY — NOT DEPLOYED`: one narrow
  migration extends the existing validator, approval ledger and atomic RPC;
  it does not create a second importer. The database allowlist contains
  exactly the 36 owner-reviewed product/variant/GTIN tuples, accepts only
  `product_variants.gtin`, requires an empty current destination and rechecks
  checksum, quarantine, canonical snapshot, retailer-mapping collisions,
  duplicate GTINs, immutable fingerprints and approval metadata under row
  locks. Apply must update exactly 36 rows in one transaction or rolls back all
  rows, consumes the existing approval audit record and blocks replay. The
  rollback refuses to remove the extension while an exact-36 approval audit
  exists. The existing GitHub workflow now exposes only
  `preflight_exact_36`; that option runs tests without production secrets and
  is explicitly barred from the production job. There is no
  `release_exact_36` option. The new migration is hash-bound and explicitly
  excluded from both staging and production deployment selectors pending a
  separate review/deployment decision. Production writes remain 0 and the
  migration is not deployed. Static/focused tests pass. Manual GitHub Actions
  run `31959277752` then ran `preflight_exact_36` on commit
  `051a5129280c7174fb5f3d70aaa8db872e202677`: the full quality gate, exact
  contract suite and disposable PostgreSQL integration test all passed. The
  `production` job was skipped, so migration deployment and production writes
  remained zero.
- `EXACT-36 MIGRATION LIVE VERIFIED — APPLY STILL BLOCKED`: after separate
  owner authorization, manual workflow run `31960257039` on commit
  `66a066809d592ba8463afa5a9c53959c1835feca` passed the full quality gate,
  exact contract suite and disposable PostgreSQL integration test. Its
  production job skipped artifact creation, GTIN validation, GTIN apply and
  post-write verification, then passed exact-36 migration preflight, deployed
  only `20260816173000_extend_guarded_gtin_promotion_exact_36.sql` and verified
  the schema. Independent production readback returned migration ledger 113,
  fingerprint
  `000c4464c63fbfded955d8ca1a4a29b75e122fe277e34be33b30a5a6ddbaaed4`,
  the exact-36 migration as the final ledger row and all four exact/dispatcher
  functions present. All 36 target `product_variants.gtin` fields remain null,
  none of the 36 approved GTINs is assigned and the exact-36 approval count is
  zero. The one-time migration operation was removed from the current workflow
  after verification and the selector now has no pending production migration.
- `EXACT-36 GTIN RELEASE LIVE VERIFIED`: owner-authorized workflow run
  `31961892019` on commit `e01720dc9492317cc5eeec70642cbe9522ac0644`
  passed the full quality gate, exact contract tests and disposable PostgreSQL
  integration test. Its fresh production preflight returned exactly 36 writes,
  0 no-ops and 0 conflicts; guarded validation passed and the atomic apply
  wrote exactly 36 `product_variants.gtin` values under approval
  `42c92610-1c2b-4c36-9790-fbe72ae43f50`. The first post-write check exposed
  a verifier-state bug after the successful apply, not a data conflict. The
  verifier was corrected without replaying apply. Read-only recovery run
  `31962357242` on commit `0d5fde7b19c7ab051b1330700fa415fc40c6cdba`
  reused the original immutable artifact and pre-write baseline and passed:
  36/36 verified, 36 already-present no-ops, 0 anomalies, products unchanged,
  offers unchanged, retailer mappings unchanged, 16 quarantined conflicts
  unchanged and no duplicate GTIN ownership. The one-time exact-36 write and
  recovery operations were then removed from the manual workflow.
- `EXACT-36 EBAY DISCOVERY COMPLETE — READ ONLY`: the existing Browse pilot
  was extended with one fixed `owner-reviewed-36` input scope; no second eBay
  adapter or importer was created. The sealed input contained exactly 36
  already-present canonical variant GTINs. Exact-GTIN Browse search checked
  36, found 3 and returned 0 `AUTO_ELIGIBLE`, 1 `REVIEW`, 2 `REJECT` and 33
  `NOT_FOUND` (report fingerprint
  `924ed6a60282b4a2b26f464f50ca2ccfccb8ec6f76b1831398579a90699551c6`).
  The existing title fallback then checked 30 of the 33 missing products and
  returned 1 `AUTO_ELIGIBLE`, 13 `REVIEW`, 11 `REJECT` and 5 `NOT_FOUND`
  (report fingerprint
  `8c2038b6f6f7742eb1e4979e85ccf0b29dc478fc94afbf180a5fc71c6d141721`).
  The single safe candidate is product 1107 / variant 2401, Trec Nutrition
  Creatine Monohydrate + Taurine 400 g, GTIN `5902114017811`, eBay item
  `204137434720`, business seller `superfoodsinc` (99.7%, score 4912), GBP
  19.95 delivered, affiliate-ready and with no blockers. Database writes and
  catalogue changes remained zero. Every `REVIEW`/`REJECT` row remains blocked
  from the importer.
- `BATCH E LIVE VERIFIED 1/1`: the owner approved exactly product `1107`,
  variant `2401`, GTIN `5902114017811`, eBay item `204137434720`. Existing
  importer artifact fingerprint
  `413450efe289f4a6669961d25e7ec274b1d1e054414600baa32b7416a86ee956`
  produced one create plan and zero blockers. Protected GitHub run
  `31963949261` created mapping `2743` and offer `2558`; its fresh postflight
  returned the exact plan as a no-op. Public readback shows eBay UK, GBP 19.95
  delivered and `/go/2558` redirecting to the approved Campaign-ID URL.
- `EBAY REFRESH PILOT BUILT — EXACT ONE`: the existing importer approval/apply
  path now has a thin eBay Browse source adapter for offer `2558`; it is not a
  second importer. Every run directly reads the sealed REST item ID, rechecks
  GTIN, brand, 400 g, Unflavoured, powder, condition, seller and UK delivered
  price, then permits only a bounded existing-offer update or the established
  `verify_offer_no_change` timestamp operation. Product, variant, mapping,
  affiliate URL and identity writes are blocked; a missing listing blocks the
  run rather than automatically marking OOS. Local live production dry-run
  passed at GBP 19.95 delivered with `verify_no_change` and zero writes.
- `GITHUB REFRESH PREFLIGHT BLOCKED — NO WRITES`: workflow `eBay Offer Refresh`
  registered successfully and run `31964579226` passed its protected context
  and exact-contract tests. Its read-only preflight then failed closed because
  environment `production-readonly` does not contain `EBAY_CLIENT_ID`,
  `EBAY_CLIENT_SECRET` or `EBAY_UK_DELIVERY_POSTCODE`. Apply and postflight were
  skipped. The schedule cannot write until those existing credential values
  are added securely under these exact GitHub environment-secret names. Even
  after that, scheduled apply remains disabled unless environment variable
  `EBAY_REFRESH_ENABLED` is explicitly set to `true` after the first successful
  manual apply and postflight.
- `LIVE VERIFIED — BATCH D 2/2`: a bounded refresh of the remaining 36 unresolved
  candidate/listing pairs found 27 live listings: 10 are blocked because the
  eBay seller is the same existing retailer, 15 still lack a returned GTIN,
  two retain exact GTIN, and nine are no longer available. Independent
  product evidence subsequently closed the two narrow eBay metadata gaps;
  the owner approved exactly Warrior Rage Blazin Berry and JNX The Curse Pina
  Colada for preparation and dry-run. A fresh exact-item refresh passed both,
  and the existing importer produced two create plans with zero blocked rows.
  The owner subsequently approved production apply of exactly those two plans.
  Manual workflow `31873994325` validated and executed 2/2, and its immediate
  postflight returned two exact no-ops. Independent production and public
  readback passed 2/2. Production now has 19 eBay mappings and 19 offers.
- GTIN deployment is complete: the disposable PostgreSQL gate, migration,
  exact 45-row apply and post-write verification passed. All 54 safe identities
  are now no-ops and 16 conflicts remain quarantined.
- `DESIGN BLOCKED`: seller/listing metadata storage awaits pilot evidence and
  separate approval.

## Next action

`NEXT ACTION: Monitor the first scheduled exact-31 refresh at 05:43 UTC on 18
August 2026 (06:43 BST). Continue coverage discovery only through the existing
read-only pipeline; do not include any of the other 13 rejected rows or weaken
the exact identity, seller, delivery, affiliate or continuity gates.`

The completed GTIN release and read-only Browse pilot must not be repeated.
No result can enter the catalogue or public site without a separate
owner-reviewed production design and approval.

## Last verified

17 August 2026:

- A live duplicate/configuration audit confirmed that the four existing eBay
  values were already present in the controlled local environment, while the
  GitHub repository had no repository-level Actions secrets and its
  `production-readonly` environment contained seven non-eBay secrets. The
  earlier successful canary consumed sealed artifacts and therefore did not
  prove that a GitHub runner could call eBay. Failed refresh run `31964579226`
  independently showed all four eBay workflow variables as empty.
- With explicit owner approval, the existing local `EBAY_CLIENT_ID`,
  `EBAY_CLIENT_SECRET`, `EBAY_UK_DELIVERY_POSTCODE` and
  `EBAY_EPN_CAMPAIGN_ID` values were encrypted with the GitHub environment
  public key and stored as environment secrets in `production-readonly`.
  Values were not printed, committed or copied into application files; GitHub
  confirmed only the four secret names.
- Manual GitHub Actions dry-run `32034428466` on commit `e483cef` passed the
  five exact eBay refresh contract tests and the fresh read-only preflight.
  Offer `2558` matched sealed item `v1|204137434720|0`, GTIN
  `5902114017811`, GBP 19.95 item price, GBP 0 shipping and GBP 19.95 delivered
  total. Classification was `verify_no_change`; executed writes were 0,
  `safe_update` remained unset and automatic OOS remained blocked. Evidence
  artifact `9290100758` has SHA-256
  `52871dd2f070a1b07bfc2da1df809c8068ef94ba696b99b1702e1e0d1eba7719`.
- Apply and postflight steps were skipped, and `EBAY_REFRESH_ENABLED` remains
  unset. No database, offer, price, mapping or public-page change occurred.
- The first owner-approved exact-one apply attempt, run `32034913023`, failed
  closed before approval or database execution because its write process also
  received `SUPABASE_SERVICE_ROLE_KEY`. The executor's existing credential
  separation guard stopped it; writes were zero. Commit `cdda005` split fresh
  source preparation and execution into separate processes, kept the service
  role out of the executor and added a 15-minute immutable-artifact expiry.
- Run `32035913998` proved that the separated prepare step and credential-free
  executor boundary worked, then failed closed while loading a verified-no-change
  artifact whose mapping URL and affiliate offer URL differ. Writes were zero.
  Commit `155a131` corrected the generic immutable loader to validate the
  mapping against `source.external_url` while retaining `source.url` for the
  offer; the regression test now loads an artifact with separate URLs.
- Owner-approved manual run `32036314282` passed all five exact refresh contract
  tests, fresh preflight, prepare, separated apply, immediate postflight and
  evidence upload. Offer `2558` remained GBP 19.95 plus GBP 0 shipping and
  classified `verify_no_change`; exactly one approved plan refreshed only its
  verification timestamp. Postflight returned the same `verify_no_change`,
  proving idempotency. Evidence artifact `9290814995` has SHA-256
  `fe6f0a3520fc9d6dfb2a3cff51c84719c92a815eaea202a43132d74051bf0fb3`.
  `EBAY_REFRESH_ENABLED` remains unset, so scheduled production apply is still
  disabled pending a reviewed all-20 manifest and dry-run.
- Commit `a0e0bae` expanded the same mechanism, not the importer, to one
  integrity-checked manifest sourced from all six approved rollout files A-E.
  It binds exactly 20 unique products, variants, GTINs and item IDs to mappings
  `2724`-`2743` and offers `2539`-`2558`. One run re-reads all 20; only current
  `AUTO_ELIGIBLE` rows can enter fresh 15-minute apply artifacts. REVIEW and
  REJECT rows remain unchanged and automatic OOS remains blocked. Volatile
  eBay `amdata` query values are intentionally discarded in favour of the
  already approved stable direct and affiliate URLs.
- Local exact-20 production dry-run checked all 20 with zero writes: 12 were
  `verify_no_change` and eight were held in REVIEW. Offers `2553`-`2555` no
  longer returned GTIN; `2549`, `2551`, `2552`, `2556` and `2557` lacked one or
  more current format, count or size evidence fields. No price delta was
  proposed for any eligible row.
- GitHub Actions dry-run `32037679947` on commit `a0e0bae` independently passed
  the five exact refresh contract tests and reproduced the same 20 checked / 12
  eligible / 8 blocked result with 12 `verify_no_change` plans and zero writes.
  Apply and postflight were skipped. Evidence artifact `9291197853` has SHA-256
  `40add195e31a3608789ce983c804a86fba788de7160c9b5da9248008eb9c264b`.
  `EBAY_REFRESH_ENABLED` remains unset.
- Commit `bd24be6` added an existing-listing continuity tier without widening
  discovery or new-listing matching. It is restricted to the immutable approved
  20-offer manifest and requires the same eBay item and legacy item IDs, no
  blockers, valid affiliate evidence and the same existing canonical target.
  An absent returned GTIN is accepted only when `RETURNED_GTIN_UNPROVEN` is the
  sole review reason; any GTIN mismatch, item change or additional missing
  evidence fails closed. Exact returned GTIN rows may tolerate only the narrow
  `FORMAT_UNPROVEN`, `SIZE_UNPROVEN` and `UNIT_COUNT_UNPROVEN` evidence gaps.
- Local production dry-run with that rule checked all 20 and returned 20
  `verify_no_change`, zero blocked rows, zero price/URL/stock/identity deltas and
  zero writes. Twelve had complete live exact-GTIN evidence, five had an exact
  live GTIN with only a narrow metadata gap, and offers `2553`-`2555` used
  sealed-existing-identity continuity because missing GTIN was their sole gap.
- GitHub Actions dry-run `32039150019` independently passed six focused
  continuity/refresh tests and reproduced 20/20 `verify_no_change`, zero blocked
  rows and zero writes. Apply and postflight were skipped. Evidence artifact
  `9291581276` has SHA-256
  `3bb6d4b6e796d1434f2a793e278fb048dfd6d95fea4d8543391b92d0640c8c83`.
  `EBAY_REFRESH_ENABLED` remains unset.
- The owner then explicitly approved the exact-20 manual apply and enabling the
  daily schedule only after a successful immediate postflight. GitHub Actions
  run `32039661320` completed successfully: fresh preflight, preparation,
  guarded execution and postflight each passed 20/20 with zero blocked rows.
  All 20 operations were `verify_no_change`; no price, URL, stock, product,
  variant, mapping or listing-identity value changed, and only verification
  timestamps were refreshed. Evidence artifact `9291719160` has SHA-256
  `343aacde47f98d6d3e8c3082cf7dda7e8eee35774efad1cd718ecef7d2d3f387`.
- An independent public readback after the apply passed 20/20: every product
  page returned HTTP 200, displayed `eBay UK` and contained its exact existing
  `/go/{offer_id}` route for offers `2539`-`2558`. No offer was lost.
- After the successful apply and postflight, environment variable
  `EBAY_REFRESH_ENABLED=true` was created and verified at
  `2026-08-17T14:40:12Z`. The existing single workflow is therefore enabled on
  its daily `43 5 * * *` schedule; no second importer or automation path was
  introduced.
- A fresh production SELECT-only discovery input rebuilt the complete current
  one-retailer GTIN-qualified pool at 331 identities. Comparison with the
  previously exhausted 339-identity pool found zero new identities and eight
  removals, so the prior broad discovery was not repeated. The input fingerprint
  is `3d033fed52db718dfa9a5fdc5dd2af383d8b4f470fa05d51e8e8f0c1cbb8bba4`;
  database writes and eBay calls were zero.
- The existing read-only Browse pilot gained one exact-item refresh mode for an
  intact fingerprinted REVIEW report. It freshly rebuilds current production
  identity first, requires the same product, variant and GTIN, reads only the
  sealed eBay item ID, verifies the legacy item ID and contains no catalogue or
  offer mutation path. Focused tests passed 27/27.
- The exact refresh then checked the 15 remaining missing-returned-GTIN rows:
  14 listings remained available, one was `NOT_FOUND`, none returned a GTIN and
  no write occurred. Report fingerprint:
  `3c678cce052fb8cdb056c98444ff83ee554bdf424e1bb54337806c37d91f0437`.
- Independent evidence leaves exactly two bounded owner-review candidates.
  Product `520` / variant `1025`, Olimp Redweiler Blueberry 480 g, GTIN
  `5901330044861`, is eBay item `v1|407021140091|677211935188` from business
  seller `muscle-factory-co-uk` (100%, score 270), GBP 34.99 plus GBP 3.99
  shipping. The live eBay variation states Blueberry Madness, 480 g and powder;
  [Gymgrossisten](https://www.gymgrossisten.com/redweiler-480-g-blueberry-madness/820924-42.html)
  and [Nutrigroup](https://nutrigroup.eu/redwiler-en) independently bind the same
  EAN to Blueberry Madness 480 g. Product `134` / variant `1644`, Dymatize ISO100 Gourmet Vanilla
  2.27 kg, GTIN `4029679671522`, is eBay item `v1|306694054274|0` from business
  seller `snober_trade_ltd` (99.9%, score 3656), GBP 149 delivered. The listing
  states Gourmet Vanilla powder at 2264 g (the 5 lb nominal pack), and the
  [Dymatize product sheet](https://deichmann.scene7.com/is/content/deichmann/osp/shopimages/5654464_claim_dymatize_en.pdf)
  binds the same EAN to Gourmet Vanilla. Both affiliate
  URLs are ready and each would add a second retailer, but neither is approved
  or written.
- The other 13 rows remain excluded. The review exposed a material source-data
  conflict for product `1065` / variant `2246`: GTIN `0634158780752` identifies
  the 250 g Applied Nutrition L-Glutamine pack, not the stored 500 g variant.
  Other rows had an unavailable listing, explicit flavour/size/formula mismatch,
  an ambiguous multi-product listing, or a seller below the unchanged trust
  threshold. None may enter Batch F.
- The owner explicitly approved `Batch F — these 2` for guarded preparation and
  production dry-run only. A fresh direct-item preflight re-read exactly Olimp
  item `v1|407021140091|677211935188` and Dymatize item
  `v1|306694054274|0`; both retained the approved seller, identity, delivery,
  affiliate and narrow missing-evidence state. It checked 2/2, found 2/2,
  returned zero hard blockers and made zero database writes.
- The existing production importer then accepted the exact two-row source with
  2 approved rows, 0 invalid, unmatched, ambiguous, collision, GTIN, external
  GTIN, size, pack or format conflicts and 0 blocked rows. It planned exactly
  two retailer-product creates, two offer creates and two price-history creates;
  no retailer, product or variant create/update is present. Dry-run writes were
  zero.
- The durable review pack is
  `docs/rollouts/ebay-offer-canary/batch-f-review.json`. Its source CSV has
  SHA-256 `0623ace99bf29f3ac9ca58a0553199032af95469a26980acf2c3684bc8e4535a`.
  The final dry-run ID is `0fd51c64-43aa-4017-bfd8-44a6f6256120`, artifact
  SHA-256 `6fa9ce81c1d3e6e9e2f32954bba2ce295141480c2c5d454bf507e3a15e444b12`.
  The pack explicitly records `approved_for_production_apply: false`; no apply
  or public change occurred.
- The owner then separately confirmed `Zatwierdzam produkcyjny apply Batch F —
  dokładnie te 2`. Rollout fingerprint
  `3c34757ddff5fbfe6d7bb09b34b141a4b126600d1eb5c3e1bf699f54e3b7f59d`
  binds the exact two plans, CSV and dry-run artifact to executor confirmation
  `OWNER_APPROVED_EBAY_BATCH_F_EXACT_2`. The existing canary workflow now adds a
  direct live preflight before apply and requires a two-row exact no-op
  postflight. Local rollout, workflow and drift tests pass 31/31.
- Manual GitHub Actions run `32044296989` on commit `ba53f6a` passed the fresh
  direct-item preflight 2/2 and atomically executed exactly 2/2 plans. It created
  mappings `2744`-`2745`, offers `2559`-`2560` and two price-history rows. The
  apply was not repeated when its postflight exposed an importer validation bug
  for the canonical feed representation `size=480|2270` plus `size_unit=g`.
  Execution artifact `9292513103` has SHA-256
  `619d6aa509b905a8e032e805742b39260c70fc93162526bec00035f220c2de2a`.
- Commit `172c2ab` corrected only that representation handling while preserving
  already unit-bearing values and added regression coverage. The complete
  importer suite passed 185/185 and `npm run verify:full` passed. Non-writing
  postflight run `32044675770` then validated 2 plans, 0 blocked rows and exact
  mapping, offer and price-history no-ops. Evidence artifact `9292594479` has
  SHA-256 `bf69a4c50c1160eae9be7f1af2a36f15c713a1e5f2aca94bcf535f72fb5c6bbd`.
- Independent public verification passed 2/2: products `520` and `134` returned
  HTTP 200, displayed eBay UK and contained `/go/2559` and `/go/2560`. Both
  routes returned HTTP 307 to the exact approved eBay item/variation with the
  configured affiliate campaign ID. Batch F is live-verified 2/2.
- Commit `f75ca5c` extended the existing refresh workflow and manifest from 20
  to exactly 22 offers without adding a scheduler or importer. Manual run
  `32045621134` proved the fail-closed boundary: it refreshed the prior 20 but
  blocked offers `2559` and `2560` because their live missing-GTIN state also
  carried one narrow metadata gap. No offer was removed or marked out of stock.
- Commit `960e873` added a sealed continuity tier only for those two exact item
  IDs, canonical targets, sellers and owner-reviewed missing-evidence sets.
  Wrong seller, item or evidence still blocks. Full project verification
  passed, including six focused refresh tests.
- Manual GitHub Actions run `32046154798` then passed end to end: fresh
  preflight 22/22, prepared 22/22, executed 22/22, zero blocked rows and
  immediate postflight 22/22 `verify_no_change`. Prices, shipping, URLs, stock
  and identities were unchanged; verification timestamps were refreshed.
  Evidence artifact `9293012601` has SHA-256
  `e7b4180d037d08e8844e5598c55e649b636fcd321294ac7c02584b551929d61f`.
  The enabled daily `43 5 * * *` schedule then covered all 22 live eBay offers.
- The owner approved Batch G as exactly nine listings: two CNP Peptide
  variants plus CNP Isolate, Innovapharm MVPRE, PER4M Stim, Olimp Vita-Min One,
  Osavi Zinc, Olimp Multiple Sport and Good Guru Magnesium. The rejected
  individual-seller listing and the conflicting 100-versus-60 capsule listing
  remained excluded. Guarded run `32063866981` on commit `cf305e2` executed
  9/9, creating mappings `2746`-`2754`, offers `2561`-`2569` and nine
  price-history rows. Immediate postflight returned exact mapping, offer and
  history no-ops for all nine with zero blockers. Evidence artifact
  `9299159112` has SHA-256
  `f9e3b5b3cb050d832b3b315d650bcc44d759d320ce34aeab2c8d1c69b62dad80`.
- Commits `596fa77` and `b03015a` extended the existing daily workflow from 22
  to exactly 31 offers. No synthetic GTIN is used: each Batch G source is
  evaluated with its actual blank canonical GTIN, and continuity accepts only
  the exact expected `CANONICAL_GTIN_INVALID` state together with the sealed
  item ID, legacy ID, business seller and reviewed semantic gaps. Any added
  blocker, returned mismatching GTIN, individual seller or identity drift
  fails closed. `npm run verify:quick` and `npm run verify:full` both passed.
- Manual GitHub Actions run `32066137554` on commit `b03015a` passed every
  contract, fresh preflight, prepare, guarded apply, immediate no-op postflight
  and artifact upload. It checked 31/31, executed 31/31 and blocked 0. All 31
  plans were `verify_no_change`; the nine Batch G delivered prices remained
  GBP 73.49, 73.49, 80.98, 39.99, 29.99, 10.89, 11.69, 12.89 and 14.96.
  Evidence artifact `9300084745` has SHA-256
  `1f687d33995293f2f38a4baa0b0a17f4a97bf0a6051ae02226211c4174d9a53c`.
  The enabled daily `43 5 * * *` schedule now covers all 31 live eBay offers.
- Public readback returned HTTP 200 for all eight Batch G product pages. Seven
  pages exposed the corresponding new `/go` route; product `865` exposed one
  of its two same-retailer flavours and product `789` retained its existing
  same-retailer flavour in the product-level comparison. Direct GET readback
  passed 9/9 for `/go/2561`-`/go/2569`: every route returned HTTP 307 to the
  exact approved eBay item/variation with the configured campaign parameter.
  No offer was missing from the guarded redirect path.

16 August 2026:

- Extended only the existing artifact builder—not the importer—with an exact
  owner-reviewed-36 configuration. A fresh production plan built 36 rows and
  zero writes, and immutable artifact validation passed. Local protected modes
  are explicitly blocked before reading an artifact unless a future reviewed
  schema-ready gate is enabled; GitHub Actions still exposes only the completed
  exact-45 contract. Focused promotion/workflow tests now pass 32/32.
- Generated the explicitly authorized guarded production dry-run for exactly
  the owner-reviewed 36 rows. The exact allowlist matched documentation and
  returned 36 `READY_TO_PROMOTE`, 0 no-ops, 0 review, 0 blocked, 36 variant
  destinations, 36 empty current values and zero writes. The scope is separate
  from the dynamic catalogue-wide AUTO_SAFE count, which is now 33 and does
  not widen this batch. Focused tests passed 17/17; the combined promotion and
  workflow tests passed 30/30; `verify:quick` passed with 0 lint errors and the
  10 pre-existing warnings. No old exact-45 release guard, migration or
  workflow operation was changed.
- Completed the explicitly authorized OWNER REVIEW for exactly the 36
  confirmed candidates against fresh production state. All 36 returned
  `READY_TO_PROMOTE` from the existing planner and `APPROVE_CANDIDATE` from the
  owner-review presentation: 0 blockers, 0 new anomalies, 0 foreign retailer
  mapping collisions, 0 quarantine matches, 36 valid unique checksums, 36
  unique variant destinations, 36 empty current values, 36 future writes and
  0 already-present no-ops. `products.gtin` destinations remain zero. No
  database write, migration, GTIN apply or eBay call occurred.
- Completed read-only source confirmation for the exact fingerprinted
  50-product missing-GTIN cohort: 36 `CONFIRMED`, 6 `REVIEW`, 8 `CONFLICT`, 0
  `NOT_FOUND`; confirmation rate 72%. A production SELECT-only collision check
  covered all initially supported codes and the sealed 16-row quarantine.
  Production writes and eBay API calls remained zero.
- Exact `CONFIRMED` owner-review scope, all proposed for
  `product_variants.gtin`: `769/2014=5903111089085`,
  `742/795=5056555202128`, `754/878=5060763896734`,
  `231/783=5060245605397`, `755/883=5060751997351`,
  `1068/2252=5033579000084`, `1108/2403=5902114017446`,
  `1067/2250=5902114018849`, `1107/2401=5902114017811`,
  `863/1300=5060547319022`, `865/1307=5060547316106`,
  `866/1309=5060547316144`, `867/1316=5060547316229`,
  `868/1320=5060547317752`, `746/1196=5060347312919`,
  `843/1222=5060660087068`, `12/1099=5060660080212`,
  `897/1483=5060660082131`, `902/1494=5060723199097`,
  `898/1486=5056371005545`, `874/1336=640516785468`,
  `875/1339=659048417532`, `877/1350=659048417440`,
  `1032/2160=5907368855059`, `1129/2471=5902837751917`,
  `1128/2469=5902837742663`, `1117/2421=5902837750415`,
  `1116/2419=5902837742649`, `1115/2417=5902837749389`,
  `1054/2204=5902837731155`, `1052/2200=5902837755762`,
  `1051/2198=5902837737447`, `1050/2196=5999076234554`,
  `1033/2162=5999076216703`, `1037/2170=5999076234363` and
  `1022/2140=5999076232451`.
- Independent confirmation came from manufacturer pages/labels or established
  retailers and distributors including 7Nutrition, Activlab, BioTechUSA,
  Tropicana Wholesale, Dr Max, Hemprove, Mellericks, Gymgrossisten, Rozetka,
  Medpak, Super-Pharm, Farmacia Tei, Lifestyle Health Store and the current
  retailer's exact structured variant feed. These confirmations are review
  evidence only; a future approved promotion artifact must bind the exact
  row-level evidence locations and fresh destination state before any write.
- `REVIEW` remains: `1071/2268`, `849/1270`, `894/1475`, `936/1545` and
  `747/834` lack a second exact-code source; `407/2015` uses correct GTIN
  `5060547314546`, but that code is already attached to the same product's
  older default variant `386`, so canonical variant duplication must be
  resolved first.
- `CONFLICT` remains: `1123/2450` has Orange versus Mango-Passion Fruit;
  `864/1305` has 1.8 kg versus 2 kg evidence; `836/1205` has invalid checksum
  plus pack/version drift; `837/2766` uses a Cookies & Cream code for Chocolate
  Peanut Butter; `1019/2134`, `1034/2164` and `1094/2375` use codes belonging
  to other brands/products; `1049/2194` code `5999076240715` is already mapped
  in production to BioTechUSA ZMAttack `142/77`. None may be promoted.

- Ran a fresh production SELECT-only missing-GTIN audit using the same 24-day
  offer-freshness rule as the public catalogue. Of 2,641 checked variant rows,
  904 identities across 406 products have one current non-eBay retailer, no
  eBay mapping and no usable product, variant or mapping GTIN. The audit
  excluded 578 identities with an existing usable GTIN, 19 already carrying
  eBay, 105 with multiple current retailers, 970 without a current offer, 55
  inactive/merged rows and 10 internal weight conflicts.
- Sealed a 50-distinct-product priority cohort under fingerprint
  `7c096b18452a4117e48758364e00a39ee4ab2c0a35fbdc94ff28f0fd1ab34498`.
  Exact product/variant scope: `769/2014`, `1071/2268`, `742/795`, `407/2015`,
  `754/878`, `849/1270`, `231/783`, `755/883`, `1123/2450`, `1068/2252`,
  `1108/2403`, `1067/2250`, `1107/2401`, `863/1300`, `864/1305`, `865/1307`,
  `866/1309`, `867/1316`, `868/1320`, `836/1205`, `746/1196`, `837/2766`,
  `843/1222`, `12/1099`, `897/1483`, `894/1475`, `902/1494`, `898/1486`,
  `936/1545`, `874/1336`, `875/1339`, `877/1350`, `747/834`, `1019/2134`,
  `1034/2164`, `1094/2375`, `1032/2160`, `1129/2471`, `1128/2469`,
  `1117/2421`, `1116/2419`, `1115/2417`, `1054/2204`, `1052/2200`,
  `1051/2198`, `1050/2196`, `1033/2162`, `1037/2170`, `1049/2194` and
  `1022/2140`. These are confirmation candidates, not approved GTINs and not
  authority for a database write or eBay import.
- Reused the existing GTIN promotion and eBay discovery control model. No new
  importer, migration, scheduled job, public UI change, API call or production
  write was created.

15 August 2026:

- Read-only monitor artifact
  `4e64291706d8fd64757b420aadb04987bf12a49bf499fcd318278530b799c5f5`
  checked all 17 live eBay offers: 17/17 exact items available, 0 blockers,
  0 price drift, 0 shipping drift, 0 delivered-total drift and 0 writes.
- Rebuilt the production discovery pool and confirmed 339 current eligible
  one-retailer identities, with zero unseen exact-GTIN candidates and zero
  unseen title-lead products. The earlier search space is exhausted rather
  than eligible for another duplicate batch.
- Refreshed the remaining 36 unique unresolved candidate/listing pairs in two
  immutable read-only reports (`637d9c8d2f01b4ec955eb7725ad525aafbd5b1941900269df8ad63c3bf6007d4`
  and `a78b741cb7436ad0de4cd646d4bb9ca41661ab23be29e53b89e5971cc492e1be`):
  27 found, 10 same-retailer rejects, 15 missing-returned-GTIN reviews, two
  exact-GTIN narrow reviews and nine not found. Database writes remained 0.
- Completed independent evidence review for the only two exact-GTIN rows.
  Tropicana Wholesale and MyGymSupplements confirm Warrior Rage Blazin Berry,
  392 g and GTIN `5060292834924`. The official JNX product page confirms The
  Curse Pina Colada as a pre-workout powder, while Target confirms 250 g,
  powder format and UPC `799439669956`. The eBay listings remain exact,
  independent-seller and affiliate-ready. Both rows are `APPROVE_CANDIDATE`,
  pending explicit owner approval; no import was prepared and writes remained
  zero.
- The owner then approved exactly those two rows for preparation and dry-run.
  A fresh exact-item Browse refresh found both exact items with their expected
  GTINs, affiliate URLs and zero new blockers. The existing importer initially
  rejected a duplicated size-unit representation in the temporary CSV; the
  input was corrected to the importer's established numeric-size plus
  separate-unit contract without changing identity or safety gates. The final
  feed-mode dry-run artifact SHA-256 was
  `827eaea06e34d2f8334a200ed017325d938a4f516c9168c34488e7321ac31da6`:
  two plans, zero blocked rows and zero writes. Before release sealing, the
  executor test correctly rejected that plan kind because the established
  eBay path requires `manual`. The exact same reviewed CSV was regenerated
  through manual mode, producing binding artifact SHA-256
  `b7e3491b8e852e0c0c30bad668b3256bfaa63119cf9e5a51f792941baf1b0779`,
  two plans and zero blocked rows. Each plan keeps retailer, product and
  variant existing and proposes only one new eBay mapping, offer and
  price-history row. Canonical GTIN writes remain blocked. The owner approved
  production apply of exactly these two plans; no write had occurred at this
  checkpoint.
- Commit `6e4aabf` sealed the binding two-row artifact, rollout fingerprint
  `5b89bc7dcc5474953bff004b1bbe75c4c574945a20d39a10cc5e46393cf10e3e`
  and confirmation `OWNER_APPROVED_EBAY_BATCH_D_EXACT_2` into the existing
  executor. Manual workflow `31873994325` passed every step, executed 2/2 and
  completed its immediate exact no-op postflight. Independent production
  readback confirmed mappings `2741`-`2742`, offers `2556`-`2557` and
  price-history rows `2751`-`2752`, with 19 total unique eBay mappings/offers,
  zero duplicate variant or GTIN identities and unchanged canonical
  `products.gtin` / `product_variants.gtin` values. Both public product pages
  returned HTTP 200 and showed eBay UK, the exact delivered price and
  `/go/2556` or `/go/2557`. Batch D is live verified 2/2.
- Corrected the current Critical Cookie canonical family from stale 85 g data
  to manufacturer-confirmed 73 g through a guarded production migration.
- Refreshed, sealed and owner-approved the exact seven-row Batch C scope; the
  existing importer dry-run returned seven create plans and zero blockers.
- GitHub apply run `31843061483` executed 7/7. The apply was not repeated after
  a postflight-only assertion mismatch; non-writing run `31869339692` passed
  after the exact metadata-equivalence check was corrected.
- Production readback confirmed mappings `2734`-`2740`, offers `2549`-`2555`,
  seven price-history rows and 17 total eBay mappings/offers. Public verification
  passed 7/7 with HTTP 200, visible eBay UK offers and exact `/go/{offerId}`
  routes.

14 August 2026:

- Owner evidence confirms eBay Developers and EPN approval plus Sandbox and
  Production keyset creation. The Production keyset is disabled pending the
  marketplace account-deletion notification gate.
- Audited the repo and confirmed that the earlier Browse pilot did not already
  contain the required endpoint. Built the exact HTTPS route, deterministic
  challenge response, signed POST verification, official public-key retrieval,
  in-memory public-key cache, payload/size gates and explicit zero-store
  deletion boundary. No database, offer, retailer mapping or public UI write
  path was introduced.
- Committed and deployed the guarded route through Vercel. Deployment status
  was successful and the live endpoint returned the expected fail-closed HTTP
  503 while its Production secrets remain absent.
- Owner configured all three Vercel Production secrets and eBay accepted the
  challenge endpoint. The first signed test reached the route but returned 503.
  Official eBay guidance requires immediate acknowledgement before validity
  verification; the route was corrected to return 204 after structural checks
  and to verify/process only inside a supported post-response task.
- The next eBay test returned HTTP 400, proving its synthetic test payload is
  not a full deletion notification. Pre-acknowledgement checks now require a
  bounded body, valid signature-header envelope and valid JSON; signature and
  full deletion schema remain mandatory before any processing after the 204.
- After deployment of that bounded change, eBay reported
  `A test notification was sent successfully!`. Account-deletion challenge and
  test delivery are therefore live-verified. No database write, offer change,
  retailer mapping change or public catalogue change occurred.
- Owner refreshed the Production keyset and confirmed its `Non Compliant`
  marker disappeared. Account-deletion compliance and keyset activation are
  complete and must not be rebuilt.
- The existing read-only Browse pilot checked the immutable 54-identity
  production cohort. It returned 2 `AUTO_ELIGIBLE`, 3 `REVIEW`, 5 `REJECT` and
  44 `NOT_FOUND`; both safe candidates would become second retailers and both
  had lower complete delivered prices. The run made 0 database writes and 0
  public changes. Affiliate tracking remains unconfigured, so publication is
  blocked pending owner quality review and a separately approved production
  design.
- The owner accepted the row-level quality review. Both `AUTO_ELIGIBLE` rows
  passed for future design only. Solgar 60 Tablets was rejected because the
  selected listing is 120 tablets; Applied Nutrition Creatine 120 Capsules and
  Per4m Pre-Workout Stim 570g Berry Blast remain held because their selected
  listings did not return GTINs. Production writes and public changes remained
  zero.
- Scaled read-only discovery checked 355 new variant identities across 150
  products and a bounded title fallback. Deduplicated listing evidence now
  covers 144 products; 46 have returned exact GTIN, 36 also have an independent
  seller and 12 currently qualify as strong candidates after the owner-reviewed
  original pair and the new same-retailer exclusion. No offer was written or
  published. The next controlled task is review and evidence enrichment, not a
  bulk import.

13 August 2026:

- Built the complete read-only 54-GTIN Browse API pilot without credentials or
  live eBay calls. Added exact-identity input preparation, EBAY_GB/OAuth client,
  listing/condition/delivery/seller/semantic policy, deterministic one-offer
  selection, immutable raw/report artifacts and KPI output. Prepared the local
  production input for exactly 54 safe identities with fingerprint
  `9d277525865ebaf7ce33e435db6ce1c9348b576a19e5c05e4168f5b549a1a885`;
  database writes and eBay API calls were both 0.
- Focused mocked policy/API tests passed 14/14. The Project Guardian, sealed
  test inventory, typecheck, lint (0 errors; 10 pre-existing warnings), full
  safe test suite and production build passed. `git diff --check` passed.
- Completed manual `release_exact_45` run `31728827733` after its full quality,
  exact-contract and disposable PostgreSQL gates passed; production apply and
  post-write verification both completed successfully.
- Bound both artifact validation and the database RPC to the exact 45-identity
  allowlist and approved scope fingerprint. Added sealed before/after checks for
  product GTINs, variant GTINs, offers, retailer mappings, quarantine, audit
  consumption, duplicates and the final 54-identity no-op dry-run.
- Focused GTIN release, workflow, migration selector and deployment-contract
  tests passed 63/63. The local disposable PostgreSQL test remained skipped
  because Docker is unavailable; the workflow converts that condition into a
  hard failure before production. Build, typecheck, lint with 0 errors, Project
  Guardian and `git diff --check` passed. Production writes remain 0, the
  migration remains undeployed and `release_exact_45` was not run.
- The owner explicitly approved the exact 45-row promotion scope. This approval
  authorized the guarded mechanism and scope; it did not instruct a production
  database write.
- Built the narrow `GTIN_PROMOTION` approval/apply operation locally on the
  existing `approved_import_plans` ledger, with exact-state validation,
  checksum/duplicate/quarantine gates, separate approver/executor roles,
  atomic 45-row apply, stale-preview protection, single consumption and an
  immutable audit result. The migration remains unapplied.
- Added a manual-main-only workflow with production-free `preflight`; protected
  modes always rebuild a fresh 15-minute artifact and support `validate` before
  `apply`. Fresh plan evidence:
  artifact SHA-256
  `390c4c06c60f9e7b186486e17da889eee2c9192c655001538b89aed09bea117e`,
  plan fingerprint `7f316af9a47ab6676f0aab4dabb5660e`, 45 rows, 0 writes.
- Non-Docker unit/contract/workflow tests passed 27/27. Typecheck passed. Full
  lint passed with 0 errors and 10 pre-existing warnings, the production build
  passed, Project Guardian passed, and `git diff --check` passed.
  `PostgreSQL integration test: PENDING PREFLIGHT` because the local Docker
  daemon is unavailable; therefore migration deployment and production apply
  remain blocked.
- Owner review rechecked the exact 45 write-bearing candidates against fresh
  production state and all 16 quarantined GTINs: 45 `APPROVE_CANDIDATE`, 0
  `OWNER_CHECK_REQUIRED`, 45 variant destinations, 45 future writes and 0
  no-ops.
- GTIN promotion SELECT-only dry-run covered all 54 potential safe identities:
  45 `READY_TO_PROMOTE`, 9 `ALREADY_PRESENT`, 0 `MANUAL_REVIEW` and 0
  `BLOCKED`; database writes remained 0.
- Added a reusable checksum/classification planner, proposed/canonical duplicate
  protection, variant-first destination logic, stale-preview expiry and
  fingerprinted audit artifacts. `SAFE_UPDATE` remains disabled; no migration,
  approval RPC, apply RPC, eBay call or UI change was executed.
- The scaled read-only batch checked 46 new identities: 31 `CONFIRMED`, 0
  `REVIEW`, 15 `CONFLICT` and 0 `NOT_FOUND`; batch confirmation rate 67.39%.
- Sprint cumulative result is 56 checked, 40 confirmed and 16 conflicts, a
  71.43% confirmation rate. Existing plus potential `AUTO_SAFE` is 54, leaving
  46 to the 100-identity gate.
- The 31 batch confirmations cover eight products, each with exactly one active
  retailer. No GTIN was promoted and no eBay call was made.
- GTIN confirmation cohort 1 checked 10 priority single-retailer identities
  against opened independent sources: 9 `CONFIRMED`, 0 `REVIEW`, 1 `CONFLICT`
  and 0 `NOT_FOUND`; confirmation rate 90%.
- Historical cohort-1 checkpoint: its nine confirmations projected 23 total
  safe identities and 77 remaining. The scaled-batch totals above supersede
  that checkpoint; no canonical GTIN was written or promoted.
- `npm run verify:project` passed after the GTIN confirmation documentation update.
- The initial production baseline was collected through the anonymous public
  client. The GTIN recovery follow-up used the existing local service role for
  SELECT-only access because RLS hides retailer mappings from anonymous reads.
- GTIN-8/12/13/14 length and check digits were evaluated locally; no external
  GTIN lookup was performed.
- Official eBay Developer and EPN pages linked above were checked on this date.
- Repository search found no existing eBay adapter, eBay credential convention,
  eBay retailer or completed eBay account-status record.
- Historical audit checkpoint: at that earlier point no API implementation,
  account action, database write, migration, public change, commit or push had
  been performed. The read-only adapter evidence above supersedes only the
  implementation part; it still made no live eBay call or production write.

## Decision changelog

### 13 August 2026

- Implemented the credential-ready, read-only Browse API pilot around the
  existing guarded identity/control framework. No second importer, database
  mutation, eBay call, public link or automation was introduced; account
  approvals and credentials remain the gate to the 54-identity run.
- Completed guarded production run `31728827733`: migration deployed, exact
  45-row atomic apply passed, 45/45 variant GTINs verified, nine existing
  identities unchanged, 16 conflicts still quarantined and all 54 safe
  identities now idempotent no-ops.
- Verified zero unintended changes to `products.gtin`, offers or
  `retailer_products`, zero duplicate conflicts and a correct consumed audit
  trail; archived the immutable release artifact and closed GTIN promotion.
- Replaced the stop-after-each-stage path with one manually selected,
  fail-closed `release_exact_45` sequence; no release run was started.
- Added exact owner-scope/destination allowlists, reviewed migration selection,
  already-deployed detection and immutable full-table post-write comparison.
- Recorded the owner's approval of the exact 45-row scope and built the guarded
  `GTIN_PROMOTION` mechanism without deploying its migration or writing GTINs.
- Reused the existing approval ledger and added a manual fresh-plan-first
  workflow; held deployment at the database integration gate because Docker is
  unavailable locally.
- Completed the exact 45-row owner review pack without changing code or data;
  no new anomaly was found and the next action is the separately authorised
  `Build guarded GTIN_PROMOTION write operation` task.
- Completed the 54-identity GTIN promotion dry-run and recorded its exact
  per-row destinations, evidence classes, decisions and immutable fingerprints.
- Reused the existing import control-plane design and explicitly limited the
  missing future code to one allowlisted `GTIN_PROMOTION` operation; no second
  importer or parallel approval workflow was created.
- Superseded the final confirmation-batch next action with owner review of the
  exact 45-row promotion scope.
- Completed the scaled read-only confirmation batch without filling the
  150-record ceiling with unsupported `NOT_FOUND` decisions.
- Confirmed 31 exact identities and quarantined 15 size/version conflicts;
  cumulative potential safe identity count is 54.
- Replaced the superseded 25-record cohort proposal with one final, separately
  approved confirmation batch capped at 60 and a hard stop at 100.
- Completed read-only GTIN confirmation cohort 1 with exact per-record source,
  pack and decision evidence; quarantined the USN 200 g / 230 g conflict.
- Historical and superseded after the scaled batch: proposed, but did not
  start, a separately approved cohort 2 capped at 25.
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
