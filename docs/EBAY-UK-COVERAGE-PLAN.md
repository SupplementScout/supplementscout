# SupplementScout eBay UK Offer Coverage Plan

**Workstream:** `eBay UK Offer Coverage`  
**Role:** durable technical source of truth subordinate to the SupplementScout Operating Plan  
**Status:** GUARDED `release_exact_45` BUILT — NOT RUN; MIGRATION AND WRITE NOT EXECUTED
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
   identities. The confirmation sprint independently confirmed 40 more without
   writing them, projecting 54 safe identities. A truthful 100 exact-GTIN
   cohort still cannot be selected.

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
importer or enabling `SAFE_UPDATE`. The operation and migration now exist
locally, but the migration has not been deployed and no apply RPC has been run.

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

The owner approval recorded below fixes the allowed identity scope. It does not
deploy the migration or authorize an `apply` workflow run by itself.
Before the release run, the protected environment must contain
`SUPPLEMENTSCOUT_PRODUCTION_OWNER_DATABASE_URL`; it is materialized only in the
runner temporary directory, removed in an `always()` cleanup step and never
uploaded. Existing least-privilege approver/executor URLs are reused, with the
GTIN-specific secret names preferred when configured.

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

### Promotion next action

`NEXT ACTION: Run release_exact_45.` This remains a separate manual GitHub
Actions operation and has not been run. Its default remains non-writing
`preflight`; selecting `release_exact_45` requires
`OWNER_APPROVED_EXACT_45` and GitHub production-environment approval. Preserve
the nine `ALREADY_PRESENT` rows as no-ops and all 16 conflicts in quarantine.
Do not enable `SAFE_UPDATE`, run another confirmation batch or call eBay.

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
  level; 14 recovered identities and 40 independently confirmed identities are
  safe candidates but have not been written.
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
- `DEPLOYMENT BLOCKED`: the guarded migration is intentionally unapplied until
  its disposable-PostgreSQL integration test passes in an environment with a
  working Docker daemon. The 45 approved identities remain unwritten; 9 further
  identities are already present and 16 conflicts remain quarantined.
- `DESIGN BLOCKED`: seller/listing metadata storage awaits pilot evidence and
  separate approval.

## Next action

`NEXT ACTION: Run release_exact_45.` The single manual run performs PRECHECK,
the required disposable PostgreSQL test, production preflight, exact migration
deployment-or-already-present check, production validate, atomic apply and
post-write verification. Each successor requires PASS from its predecessor.
The 9 `ALREADY_PRESENT` rows remain no-ops and all 16 conflicts remain
quarantined. eBay API work remains independently blocked on account/access
confirmation.

## Last verified

13 August 2026:

- Built, but did not run, the single manual `release_exact_45` path. Default
  operation remains non-writing `preflight`; the production job requires exact
  owner confirmation and approval from the existing protected
  `production-readonly` GitHub environment.
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
- No API implementation, account action, database write, migration, public
  change, commit or push was performed.

## Decision changelog

### 13 August 2026

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
