# Collagen category coverage integrity implementation

Date: 2026-11-03

Implementation state: feature implementation complete; production closeout pending

Starting `main`: `54d3d238e17e8ac1c53ec1f196dabe718d399342`

Source audit:
`docs/rollouts/category-coverage-integrity-collagen-audit-2026-11-03.md`

## Approved model and scope

This implementation follows accepted Model A: one semantic Collagen family at
`/collagen`. Marine Collagen remains a subtype rather than a separate route,
Collagen Peptides are ordinary Collagen supplements, and formats remain in the
same family. A named co-primary Collagen identity, including Glucosamine with
Marine Collagen, is eligible; benefit copy about collagen formation is not.

The shared `CategoryCoverageDefinition` and evaluator are reused. Broad
candidate queries retrieve possible products, while deterministic product-name
identity rules decide membership. The closed 52-product audit universe must
reproduce exactly `29 INCLUDE_STRONG`, `21 EXCLUDE_STRONG` and
`2 REVIEW_REQUIRED`.

The runtime contains zero Collagen audit product IDs, zero slug exceptions,
zero retailer-specific rules and zero brand-specific control-flow exceptions.

## Closed audit fixture universe

The fixture IDs below are audit/test labels only and are not runtime inputs.

### INCLUDE_STRONG (29)

| ID | Audited identity |
| ---: | --- |
| 188 | Applied Nutrition Keto Collagen 130g |
| 422 | Vital Proteins Collagen Peptides Unflavoured 284g |
| 435 | KIOR Health Collagen Probio 60 Caps |
| 440 | KIOR Health Collagen+ 60 Caps |
| 460 | KIOR Health Collagen Glow |
| 461 | KIOR Health Collagen Super |
| 577 | Glucosamine 500mg & Marine Collagen 400mg |
| 633 | Marine Collagen Powder with Vitamin C |
| 639 | Marine Collagen 1500mg |
| 681 | Doctor's Best Pure Collagen Peptides 417g |
| 720 | Now Foods Collagen Peptides Powder 227g |
| 721 | Osavi Collagen & Electrolytes Orange & Grapefruit |
| 831 | Time 4 Collagen+ 45 Servings |
| 864 | CNP Loaded ISO Collagen Protein 2kg |
| 915 | Atlas Infusions Full-Spectrum Collagen 500g |
| 937 | Trained By JP Collagen Powder 300g |
| 986 | Osavi Advanced Marine Collagen 30 servings 360g |
| 989 | Osavi Collagen & Electrolytes 30 Servings |
| 1002 | Swanson Collagen Peptides Unflavoured 28 Servings |
| 1017 | Trec Nutrition Collagen Renover 350g |
| 1215 | Sunna Supplements Halal Collagen Protein 250g |
| 1216 | Sunna Supplements Marine Collagen 250g |
| 1221 | Applied Nutrition Collagen Peptides 300g |
| 1291 | Per4m Multi-Blend Collagen 301g |
| 1317 | Bloom Clear Protein Collagen 250g |
| 1331 | VOW Nutrition Collagen Chews |
| 1343 | Swanson Marine Collagen Peptides 400mg Capsules |
| 1359 | BioTechUSA Clear Collagen Professional 350g |
| 1433 | TWP Nutrition Collagen Raw 300g |

### EXCLUDE_STRONG (21)

| ID | Audited identity |
| ---: | --- |
| 551 | Vitamin C 500mg Capsules |
| 565 | Glucosamine 1,000mg with Vitamin C Tablets |
| 575 | Glucosamine 1,000mg with Vitamin C Capsules |
| 576 | Glucosamine 1,500mg with Vitamin C |
| 584 | Quick Release Glucosamine 65 Plus |
| 586 | Multivitamin Gummies |
| 595 | Super Vitamin B Complex |
| 597 | Vitamin C 1000mg Powder |
| 598 | Hyaluronic Acid Capsules 200mg |
| 617 | Vitamin C 1000mg with Rosehip & Citrus Bioflavonoids |
| 628 | Potassium Citrate 1300mg with Vitamin C |
| 629 | Chewable Vitamin C Tablets 1,000mg Orange Flavour |
| 630 | Cranberry Tablets 24,000mg with Vitamin C 160mg |
| 631 | Vegan Glucosamine HCl 1000mg with Vitamin C 40mg |
| 632 | Vitamin C 1000mg with Rosehip 800mg |
| 634 | Hyaluronic Acid 400mg with Vitamin C 320mg |
| 640 | Turmeric Joint Care Plus |
| 644 | Curcumin C3 Complex 12,000mg (Turmeric) Capsules |
| 650 | Odourless Garlic Capsules 3000mg |
| 660 | Evening Primrose Oil 1500mg |
| 670 | ImmunoBoost Tablets with Black Garlic - SimplyBest |

### REVIEW_REQUIRED (2)

| ID | Audited identity |
| ---: | --- |
| 571 | Bone and Joint Health Gummies |
| 612 | Mature Woman Multivitamin |

Description-level evidence that Collagen is one component, without a Collagen
product-name identity, fails closed as review required and does not render.

## Route, pagination and indexability contract

The implementation adds `/collagen` using the existing landing retrieval,
semantic filter, lifecycle cache, guarded data-availability and product-card
contracts. Candidate retrieval uses the definition's nine audited query
concepts; only `INCLUDE_STRONG` products render.

The shared page size remains 24. All 29 members are exposed through two pages:
24 on `/collagen` and 5 on `/collagen?page=2`; there is no silent truncation.
The cache loader is extended compatibly to include loader arguments in the
existing cache key, so page 1 and page 2 cannot collide. No second cache
framework was introduced. The query version is `collagen-category-v1`.

The route is registered as `planned`. Base and paginated states return
`noindex, follow`. Canonicals are respectively
`https://www.supplementscout.co.uk/collagen` and
`https://www.supplementscout.co.uk/collagen?page=2`. A normal static sitemap
candidate is present and is filtered out by the shared lifecycle mechanism.

## Homepage discovery result

The homepage root cause was that exact semantic labels were guaranteed only
for `COMPARISON_CATEGORY_LINKS`; other labels depended on the production
catalogue category list. Because Collagen is not a comparison category and 28
of 29 strong products are outside the canonical Collagen category, discovery
was not guaranteed.

The generic aggregation now preserves comparison-category order, preserves
catalogue category order, then appends only missing shared
`CategoryCoverageDefinition.publicLabel` values with case-insensitive
deduplication. This guarantees exactly one Collagen, Testosterone Boosters and
Fat Burners category link without route-specific homepage conditions.
`COMPARISON_CATEGORY_LINKS` itself is unchanged. Weight Management keeps the
existing Search fallback.

## Preserved boundaries

General Search semantics and product breadcrumbs are unchanged; the old
Collagen Search may continue to expose its 52 text-search results. The exact
category Search resolver remains future work. Whey and Whey Isolate semantics
are unchanged, so CNP Loaded ISO Collagen is a Collagen member without becoming
a semantic Whey member. Testosterone Boosters remains `28 -> 11/6/11`; Fat
Burners remains `114 -> 21/77/16`; existing reviewed landing contracts are
unchanged.

The database, migrations, canonical category labels, production configuration,
SEO-20 and PER4M are unchanged. SEO-20 remains the sole in-progress SEO task
and its measurement freeze remains intact. Database writes are `0`. The mobile
menu remains unchanged and its fix remains future work.

## Production closeout evidence

Pending feature merge and read-only production verification. This section will
record the feature PR, approved head, merge SHA, tree equivalence, CI, Vercel
deployment, production timestamp, pagination metrics, homepage discovery,
Search and Whey readback, lifecycle/sitemap state, and the docs-only closeout
PR.
