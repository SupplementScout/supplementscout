# Protein exact-variant nutrition review — 2026-08-23

Status: `EVIDENCE_REQUIRED_NO_DATA_WRITE`

This is the evidence and owner-review plan for the five pack mismatches found in
the Protein SEO audit. It is not an approval manifest and contains no proposed
nutrition values. Prices, offers, retailer mappings, canonical product identity
and retailer data are out of scope.

## Read-only production evidence

| Product / canonical URL | Selected offer evidence | Base pack | Exact variant | Current override | Review status |
|---|---|---:|---:|---|---|
| Product `7`, Optimum Nutrition Gold Standard 100% Whey 2.27kg, `/product/optimum-nutrition-gold-standard-whey-2-27kg` | offer `2721`, retailer product `2907`, eBay UK, variant `1574` (`cookies-and-cream-2000g`) | 2270g; 71 × 32g; 24g protein | 2000g | `{}` | `AWAITING_MANUFACTURER_EVIDENCE` |
| Product `12`, Per4m Whey Protein 2kg, `/product/per4m-whey-protein-2kg` | offer `1025`, retailer product `1211`, Jon's Supplements, variant `1003` (`strawberry-cream-2000g`) | 2010g; 67 × 30g; 21g protein | 2000g | `{}` | `AWAITING_MANUFACTURER_EVIDENCE` |
| Product `31`, Per4m Vegan Protein 908g, `/product/per4m-vegan-protein-908g` | offer `2725`, retailer product `2911`, eBay UK, variant `1594` (`double-chocolate-908g`) | 900g; 30 × 30g; 21g protein | 908g | `{}` | `AWAITING_MANUFACTURER_EVIDENCE` |
| Product `134`, Dymatize Iso 100 2.27Kg, `/product/dymatize-iso-100-227kg` | offer `1650`, retailer product `1836`, Whey Okay, variant `1644` (`gourmet-vanilla-2270g`) | 2264g; 75 × 30g; 25g protein | 2270g | `{}` | `AWAITING_MANUFACTURER_EVIDENCE` |
| Product `232`, Ghost Vegan Protein 989g, `/product/ghost-vegan-protein-989g` | offer `2742`, retailer product `2928`, eBay UK, variant `1811` (`peanut-butter-cereal-milk-989g`) | 896g; 28 × 32g; 20g protein | 989g | `{}` | `AWAITING_MANUFACTURER_EVIDENCE` |

The production snapshot was read on 2026-08-23. Offer price and freshness are
not nutrition evidence and must not be used to infer servings or macros.

## Evidence required per exact variant

Each row remains blocked until one authoritative manufacturer product page or
manufacturer label supplies all of the following for the exact flavour and pack:

- exact net weight, serving count and serving size;
- protein per serving (and any other nutrient later used for value metrics);
- powder format and an HTTPS manufacturer source URL;
- a reviewable evidence excerpt identifying the exact variant;
- consistency between package weight and servings within one serving-size
  rounding tolerance.

Retailer copy, product-name arithmetic, another flavour, another pack size and
the base canonical product values are not sufficient evidence.

## Guarded review path

1. Collect manufacturer evidence without changing production.
2. Store candidates in the existing nutrition candidate workflow and obtain
   explicit owner approval.
3. Run `npm run nutrition:approved-plan -- --run-id=<run_id> ...` and review its
   no-write plan and fingerprints.
4. Apply only through `npm run nutrition:approved-apply -- --plan=<path> ...`
   after a separate owner approval.
5. Re-run the exact-variant audit and verify that only the reviewed variant's
   serving/nutrition-dependent metrics reopen.

The current `nutrition-approved-plan` / `nutrition-approved-apply` implementation
writes approved product-level fields, not `product_variants.nutrition_override`.
Therefore these five rows must remain blocked unless that same guarded pathway
is explicitly extended and approved for exact variants. No older standalone
variant writer is authorised by this plan.

## Expected behavior until approval

The exact structural variant weight may support price per kg. Cost per serving,
cost per 25g protein and any other serving/nutrition-dependent value metric must
remain hidden for the selected mismatched variant. No product or variant data is
changed by the P0 code sprint.
