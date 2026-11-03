# Collagen Category Coverage Integrity audit — 2026-11-03

## Decision

**PASS — audit only.** Current production evidence supports **Model A**: one
semantic `/collagen` route for every strong Collagen identity, with Marine
Collagen, Collagen Peptides, powders, capsules/tablets and gummies kept as
subtypes/formats inside the same route. This record does not implement the
definition or route.

The complete active canonical candidate universe contains `52` products:
`29 INCLUDE_STRONG`, `21 EXCLUDE_STRONG` and `2 REVIEW_REQUIRED`. The current
public Search returns all 52, so recall is `29 / 29 = 100.0%`, but precision is
only `29 / 52 = 55.8%`; unresolved reviews remain in the denominator and are
not promoted to true positives.

## Scope, preflight and governance

- Starting `main` and `origin/main`: `b5aa207a04d6a1975f6aa9a0d306c494cfd08708`,
  exactly the owner-specified SHA.
- Clean audit worktree: `C:\Projects\supplementscout\.worktrees\category-coverage-collagen-audit`.
- Branch: `audit/category-coverage-collagen`.
- Pre-audit `npm run verify:project`: **PASS**; 22 SEO tasks validated; SEO-20
  remains the sole `IN PROGRESS` SEO task and its PER4M freeze/evidence is
  unchanged.
- `/testosterone-boosters` and `/fat-burners` remain registered as `planned`,
  `noindex, follow` and sitemap-ineligible.
- Reviewed the shared evaluator, category routing, product/search path, protein
  subtype and Whey exclusions, relevant comparison pages/tests, both previous
  Category Coverage audits, the current Operating Plan, SEO ledger and Agent
  Operating Model.
- No application runtime, route, homepage, Search, canonical category,
  breadcrumb, sitemap, lifecycle, database/schema, SEO-20, PER4M, Testosterone
  Boosters or Fat Burners file was changed.

## Production read-only proof

The authoritative capture ran from `2026-11-03T15:16:21.344Z` to
`2026-11-03T15:16:31.846Z` through the production public website and public
Supabase REST endpoint. It used only `NEXT_PUBLIC_SUPABASE_ANON_KEY`, RLS and
`GET`:

- authoritative capture: `15 GET` requests — `3` Supabase REST reads and `12`
  public-site reads, including all three exact-Collagen result pages;
- complete audit session: `59 GET`, `0 HEAD`, `0 RPC`, `0 POST/PUT/PATCH/DELETE`,
  `0` database writes (three preliminary 13-request read-only captures, two
  focused public HTML reads, the authoritative 15-request capture, and three
  final pagination/order reads);
- catalogue count was exact and pagination-closed: `1,399` total rows and
  `1,357` active, unmerged canonical rows;
- freshness means `last_checked_at` within 24 hours of the authoritative
  capture; freshness and stock affect presentation, never semantic membership.

The temporary task-specific evidence collector was not committed. It rejected
non-GET/HEAD methods, rejected `/rpc`, allowed only the production site and its
Supabase host, and had no writer/service-role credential.

## Current public Collagen experience

The production homepage returned 200 but exposed **no exact `Collagen` anchor**,
so the current Collagen homepage href is **none**. The public exact search
`/search?q=Collagen` returned 200 and reported `52 products found`, paginated
24/24/4. Its complete ordered slug set was:

1. Page 1: `twp-nutrition-collagen-raw-300g`, `swanson-marine-collagen-peptides-400mg-capsules`, `glucosamine-500mg-and-marine-collagen-400mg`, `applied-nutrition-keto-collagen-130g`, `now-foods-collagen-peptides-powder-227g`, `kior-health-collagen-probio-60-caps`, `marine-collagen-1500mg`, `applied-nutrition-collagen-peptides-300g`, `marine-collagen-powder-with-vitamin-c`, `vow-nutrition-collagen-chews`, `sunna-supplements-marine-collagen-250g`, `bloom-clear-protein-collagen-250g`, `trec-nutrition-collagen-renover-350g`, `biotechusa-clear-collagen-professional-350g`, `kior-health-collagen-glow`, `kior-health-collagen-super`, `vital-proteins-collagen-peptides-unflavoured-284g`, `per4m-multi-blend-collagen-301g`, `trained-by-jp-collagen-powder-300g`, `time-4-collagen-45-servings`, `osavi-advanced-marine-collagen-30-servings-360g`, `osavi-collagen-and-electrolytes-30-servings`, `osavi-collagen-electrolytes-orange-grapefruit`, `atlas-infusions-full-spectrum-collagen-500g`.
2. Page 2: `cnp-loaded-iso-collagen-protein-2kg`, `doctors-best-pure-collagen-peptides-417g`, `kior-health-collagen-60-caps`, `sunna-supplements-halal-collagen-protein-250g`, `swanson-collagen-peptides-unflavoured-28-servings`, `immunoboost-tablets-with-black-garlic-simplybest`, `glucosamine-1-000mg-with-vitamin-c-tablets`, `evening-primrose-oil-1500mg`, `vitamin-c-500mg-capsules`, `quick-release-glucosamine-65-plus`, `hyaluronic-acid-capsules-200mg`, `odourless-garlic-capsules-3000mg`, `chewable-vitamin-c-tablets-1-000mg-orange-flavour`, `bone-and-joint-health-gummies`, `potassium-citrate-1300mg-with-vitamin-c`, `vegan-glucosamine-hcl-1000mg-with-vitamin-c-40mg`, `vitamin-c-1000mg-with-rosehip-800mg`, `super-vitamin-b-complex`, `vitamin-c-1000mg-powder`, `glucosamine-1-000mg-with-vitamin-c-capsules`, `glucosamine-1-500mg-with-vitamin-c`, `mature-woman-multivitamin`, `cranberry-tablets-24-000mg-with-vitamin-c-160mg`, `vitamin-c-1000mg-with-rosehip-and-citrus-bioflavonoids`.
3. Page 3: `curcumin-c3-complex-12-000mg-turmeric-capsules`, `hyaluronic-acid-400mg-with-vitamin-c-320mg`, `turmeric-joint-care-plus`, `multivitamin-gummies`.

Diagnostic queries are candidate generators, not membership truth:

| Query | Live results | Finding |
| --- | ---: | --- |
| `Collagen` | 52 | All candidates: 29 strong, 21 exclude, 2 review. |
| `collagen` | 52 | Case-equivalent to the exact-label query. |
| `collagen peptides` | 6 | Six strong peptide identities. |
| `marine collagen` | 7 | Six strong Marine identities plus Mature Woman Multivitamin review. |
| `hydrolysed collagen` | 1 | One strong result. |
| `hydrolyzed collagen` | 0 | Spelling/alias gap. |
| `collagen protein` | 2 | CNP and Sunna Halal, both strong. |
| `bovine collagen` | 0 | Subtype/alias gap; absence is not evidence that no bovine strong products exist. |
| `collagen powder` | 18 | High precision for powders but incomplete for all strong Collagen identities. |

## Semantic boundary

The browse category is identity-led:

- include a product when Collagen, Collagen Peptides, Marine Collagen,
  Collagen Protein or another explicit Collagen identity is a primary or
  co-primary name identity;
- `Collagen + Electrolytes`, `Collagen Probio`, beauty blends, joint-targeted
  Collagen and Collagen gummies remain strong when Collagen is explicitly
  headline identity;
- ordinary Collagen Peptides are food supplements and are valid members; they
  remain distinct from prohibited/research peptides under existing policy;
- do not include Vitamin C, Glucosamine, MSM, whey, skin support or connective
  tissue products solely because a description mentions Collagen formation,
  synthesis, protection, an incidental ingredient or taking it alongside
  Collagen;
- a multi-ingredient product whose name does not identify Collagen but whose
  description names it as one component fails closed to review until stronger
  product-identity evidence exists;
- availability, offer freshness, retailer and current canonical category do
  not decide membership.

## Complete candidate universe and classification

All 52 rows below were active and unmerged at capture. `Offers` is
`total/fresh/fresh-in-stock`; `Visible` covers the complete three-page exact
Collagen result set. An asterisk on format means canonical `product_format` was
blank and the format is supported by current name/source identity. Reason codes
are compact; the evidence column states the adjudicating identity evidence.

| ID | Slug / product | Brand | Canonical category | Format | Offers; retailers | Visible | Classification | Confidence | Reason / evidence |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 188 | `applied-nutrition-keto-collagen-130g` — Applied Nutrition Keto Collagen 130g | Applied Nutrition | Vitamins | powder* | 1/1/1; Whey Okay | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_PRIMARY_IDENTITY`; headline Keto Collagen identity. |
| 422 | `vital-proteins-collagen-peptides-unflavoured-284g` — Vital Proteins Collagen Peptides Unflavoured 284g | Vital Proteins | Vitamins | powder* | 1/1/1; Whey Okay | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_PEPTIDES_IDENTITY`; explicit peptide identity. |
| 435 | `kior-health-collagen-probio-60-caps` — KIOR Health Collagen Probio 60 Caps | KIOR Health | Health Supplements | capsule* | 2/2/2; KIOR Health, Whey Okay | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_CO_PRIMARY_IDENTITY`; Collagen is headline, probiotic is a co-component. |
| 440 | `kior-health-collagen-60-caps` — KIOR Health Collagen+ 60 Caps | KIOR Health | Health Supplements | capsule* | 1/0/0; Whey Okay | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_PRIMARY_IDENTITY`; no usable current offer does not remove membership. |
| 460 | `kior-health-collagen-glow` — KIOR Health Collagen Glow | KIOR Health | Health Supplements | powder* | 2/2/2; KIOR Health, Whey Okay | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_BEAUTY_IDENTITY`; explicit Collagen headline. |
| 461 | `kior-health-collagen-super` — KIOR Health Collagen Super | KIOR Health | Health Supplements | powder* | 2/2/2; KIOR Health, Whey Okay | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_PRIMARY_IDENTITY`; explicit Collagen headline. |
| 551 | `vitamin-c-500mg-capsules` — Vitamin C 500mg Capsules | Simply Supplements | Vitamins | capsule | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; Vitamin C identity, description-only normal formation claim. |
| 565 | `glucosamine-1-000mg-with-vitamin-c-tablets` — Glucosamine 1,000mg with Vitamin C Tablets | Simply Supplements | Health Supplements | tablet | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; Glucosamine/Vitamin C identity. |
| 571 | `bone-and-joint-health-gummies` — Bone and Joint Health Gummies | Simply Supplements | Health Supplements | other/unknown | 1/1/1; Simply Supplements | yes | REVIEW_REQUIRED | MEDIUM | `JOINT_BLEND_AMBIGUITY`; unnamed amounts of turmeric, Collagen and Vitamin E appear only in description. |
| 575 | `glucosamine-1-000mg-with-vitamin-c-capsules` — Glucosamine 1,000mg with Vitamin C Capsules | Simply Supplements | Health Supplements | capsule | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; Glucosamine/Vitamin C identity. |
| 576 | `glucosamine-1-500mg-with-vitamin-c` — Glucosamine 1,500mg with Vitamin C | Simply Supplements | Health Supplements | tablet | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; Glucosamine/Vitamin C identity. |
| 577 | `glucosamine-500mg-and-marine-collagen-400mg` — Glucosamine 500mg & Marine Collagen 400mg | Simply Supplements | Health Supplements | tablet* | 1/1/1; Simply Supplements | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_CO_PRIMARY_IDENTITY`; named/dosed Marine Collagen co-identity; legitimate Glucosamine multi-membership. |
| 584 | `quick-release-glucosamine-65-plus` — Quick Release Glucosamine 65 Plus | Simply Supplements | Health Supplements | capsule | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; Vitamin C role inside Glucosamine formula. |
| 586 | `multivitamin-gummies` — Multivitamin Gummies | Simply Supplements | Vitamins | other/unknown | 1/1/0; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; multivitamin identity. |
| 595 | `super-vitamin-b-complex` — Super Vitamin B Complex | Simply Supplements | Vitamins | tablet | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `INCIDENTAL_COLLAGEN_MENTION`; description says B2 protects Collagen. |
| 597 | `vitamin-c-1000mg-powder` — Vitamin C 1000mg Powder | Simply Supplements | Vitamins | powder | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; Vitamin C identity. |
| 598 | `hyaluronic-acid-capsules-200mg` — Hyaluronic Acid Capsules 200mg | Simply Supplements | Health Supplements | capsule | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; Hyaluronic Acid identity, synthesis claim only. |
| 612 | `mature-woman-multivitamin` — Mature Woman Multivitamin | Simply Supplements | Vitamins | other/unknown | 1/1/1; Simply Supplements | yes | REVIEW_REQUIRED | MEDIUM | `MULTI_INGREDIENT_AMBIGUITY`; Marine Collagen is one described premium ingredient, absent from product name. |
| 617 | `vitamin-c-1000mg-with-rosehip-and-citrus-bioflavonoids` — Vitamin C 1000mg with Rosehip & Citrus Bioflavonoids | Simply Supplements | Vitamins | other/unknown | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; Vitamin C identity and benefit copy only. |
| 628 | `potassium-citrate-1300mg-with-vitamin-c` — Potassium Citrate 1300mg with Vitamin C | Simply Supplements | Health Supplements | other/unknown | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; potassium/Vitamin C identity. |
| 629 | `chewable-vitamin-c-tablets-1-000mg-orange-flavour` — Chewable Vitamin C Tablets 1,000mg Orange Flavour | Simply Supplements | Vitamins | tablet | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; Vitamin C identity. |
| 630 | `cranberry-tablets-24-000mg-with-vitamin-c-160mg` — Cranberry Tablets 24,000mg with Vitamin C 160mg | Simply Supplements | Health Supplements | other/unknown | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; cranberry/Vitamin C identity. |
| 631 | `vegan-glucosamine-hcl-1000mg-with-vitamin-c-40mg` — Vegan Glucosamine HCl 1000mg with Vitamin C 40mg | Simply Supplements | Health Supplements | tablet | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; Glucosamine/Vitamin C identity. |
| 632 | `vitamin-c-1000mg-with-rosehip-800mg` — Vitamin C 1000mg with Rosehip 800mg | Simply Supplements | Vitamins | other/unknown | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; Vitamin C identity. |
| 633 | `marine-collagen-powder-with-vitamin-c` — Marine Collagen Powder with Vitamin C | Simply Supplements | Health Supplements | powder | 1/1/1; Simply Supplements | yes | INCLUDE_STRONG | HIGH | `MARINE_COLLAGEN_IDENTITY`; Vitamin C is secondary to explicit Marine Collagen powder. |
| 634 | `hyaluronic-acid-400mg-with-vitamin-c-320mg` — Hyaluronic Acid 400mg with Vitamin C 320mg | Simply Supplements | Health Supplements | other/unknown | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; Hyaluronic Acid/Vitamin C identity. |
| 639 | `marine-collagen-1500mg` — Marine Collagen 1500mg | Simply Supplements | Health Supplements | tablet | 1/1/1; Simply Supplements | yes | INCLUDE_STRONG | HIGH | `MARINE_COLLAGEN_IDENTITY`; explicit primary identity. |
| 640 | `turmeric-joint-care-plus` — Turmeric Joint Care Plus | Simply Supplements | Health Supplements | other/unknown | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; joint formula mentions Vitamin C formation role only. |
| 644 | `curcumin-c3-complex-12-000mg-turmeric-capsules` — Curcumin C3 Complex 12,000mg (Turmeric) Capsules | Simply Supplements | Health Supplements | other/unknown | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; curcumin identity. |
| 650 | `odourless-garlic-capsules-3000mg` — Odourless Garlic Capsules 3000mg | Simply Supplements | Health Supplements | other/unknown | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; garlic/Vitamin C identity. |
| 660 | `evening-primrose-oil-1500mg` — Evening Primrose Oil 1500mg | Simply Supplements | Health Supplements | other/unknown | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `INCIDENTAL_COLLAGEN_MENTION`; copy only says it is often taken alongside Collagen. |
| 670 | `immunoboost-tablets-with-black-garlic-simplybest` — ImmunoBoost Tablets with Black Garlic - SimplyBest | Simply Supplements | Health Supplements | other/unknown | 1/1/1; Simply Supplements | yes | EXCLUDE_STRONG | HIGH | `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE`; immune/garlic identity. |
| 681 | `doctors-best-pure-collagen-peptides-417g` — Doctor's Best Pure Collagen Peptides 417g | Doctor's Best | Health Supplements | powder | 1/1/1; Fit House | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_PEPTIDES_IDENTITY`; explicit pure peptide identity. |
| 720 | `now-foods-collagen-peptides-powder-227g` — NOW Foods Collagen Peptides Powder 227g | NOW Foods | Health Supplements | powder | 2/2/2; Fit House, eBay UK | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_PEPTIDES_IDENTITY`; explicit primary identity. |
| 721 | `osavi-collagen-electrolytes-orange-grapefruit` — Osavi Collagen & Electrolytes Orange & Grapefruit | Osavi | Health Supplements | powder | 1/1/1; Fit House | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_CO_PRIMARY_IDENTITY`; named Collagen/Electrolytes co-identity. |
| 831 | `time-4-collagen-45-servings` — Time 4 Collagen+ 45 Servings | Time 4 | Health Supplements | powder | 2/2/2; Jon's Supplements, eBay UK | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_PRIMARY_IDENTITY`; explicit headline identity. |
| 864 | `cnp-loaded-iso-collagen-protein-2kg` — CNP Loaded ISO Collagen Protein 2kg | CNP | Whey Protein | powder | 2/2/2; Jon's Supplements | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_PROTEIN_IDENTITY`; exact Collagen Protein identity overrides erroneous source label. |
| 915 | `atlas-infusions-full-spectrum-collagen-500g` — Atlas Infusions Full-Spectrum Collagen 500g | Atlas Infusions | Health Supplements | powder | 1/1/1; Jon's Supplements | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_PRIMARY_IDENTITY`; explicit full-spectrum identity. |
| 937 | `trained-by-jp-collagen-powder-300g` — Trained By JP Collagen Powder 300g | Trained By JP | Health Supplements | powder | 2/2/1; Jon's Supplements | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_PRIMARY_IDENTITY`; explicit powder identity. |
| 986 | `osavi-advanced-marine-collagen-30-servings-360g` — Osavi Advanced Marine Collagen 30 servings 360g | Osavi | Health Supplements | powder | 2/2/1; Fit House | yes | INCLUDE_STRONG | HIGH | `MARINE_COLLAGEN_IDENTITY`; explicit subtype identity. |
| 989 | `osavi-collagen-and-electrolytes-30-servings` — Osavi Collagen & Electrolytes 30 Servings | Osavi | Health Supplements | powder | 1/1/1; Fit House | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_CO_PRIMARY_IDENTITY`; named Collagen/Electrolytes co-identity. |
| 1002 | `swanson-collagen-peptides-unflavoured-28-servings` — Swanson Collagen Peptides Unflavoured 28 Servings | Swanson | Health Supplements | powder | 1/1/0; Fit House | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_PEPTIDES_IDENTITY`; out-of-stock offer does not remove membership. |
| 1017 | `trec-nutrition-collagen-renover-350g` — Trec Nutrition Collagen Renover 350g | Trec Nutrition | Health Supplements | powder | 3/3/3; 6 Pack Supplements | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_PRIMARY_IDENTITY`; joint-positioned name remains explicit Collagen. |
| 1215 | `sunna-supplements-halal-collagen-protein-250g` — Sunna Supplements Halal Collagen Protein 250g | Sunna Supplements | Health Supplements | powder | 1/1/0; 10 Reps | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_PROTEIN_IDENTITY`; out-of-stock offer does not remove membership. |
| 1216 | `sunna-supplements-marine-collagen-250g` — Sunna Supplements Marine Collagen 250g | Sunna Supplements | Health Supplements | powder | 1/1/1; 10 Reps | yes | INCLUDE_STRONG | HIGH | `MARINE_COLLAGEN_IDENTITY`; explicit subtype identity. |
| 1221 | `applied-nutrition-collagen-peptides-300g` — Applied Nutrition Collagen Peptides 300g | Applied Nutrition | Health Supplements | powder | 1/1/1; 10 Reps | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_PEPTIDES_IDENTITY`; explicit primary identity. |
| 1291 | `per4m-multi-blend-collagen-301g` — Per4m Multi-Blend Collagen 301g | Per4m | Health Supplements | powder | 4/4/4; 10 Reps | yes | INCLUDE_STRONG | HIGH | `MULTI_COLLAGEN_IDENTITY`; explicit Multi-Blend Collagen identity. |
| 1317 | `bloom-clear-protein-collagen-250g` — Bloom Clear Protein Collagen 250g | Bloom | Health Supplements | powder | 2/1/1; 10 Reps | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_PROTEIN_IDENTITY`; explicit Protein Collagen identity. |
| 1331 | `vow-nutrition-collagen-chews` — VOW Nutrition Collagen Chews | VOW Nutrition | Health Supplements | gummy | 2/2/2; 10 Reps | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_PRIMARY_IDENTITY`; chew/gummy format does not split taxonomy. |
| 1343 | `swanson-marine-collagen-peptides-400mg-capsules` — Swanson Marine Collagen Peptides 400mg Capsules | Swanson | Health Supplements | capsule | 1/1/1; 10 Reps | yes | INCLUDE_STRONG | HIGH | `MARINE_COLLAGEN_IDENTITY`; explicit peptide/capsule subtype. |
| 1359 | `biotechusa-clear-collagen-professional-350g` — BioTechUSA Clear Collagen Professional 350g | BioTechUSA | Health Supplements | powder | 2/2/2; 10 Reps | yes | INCLUDE_STRONG | HIGH | `COLLAGEN_PRIMARY_IDENTITY`; explicit headline identity. |
| 1433 | `twp-nutrition-collagen-raw-300g` — TWP Nutrition Collagen Raw 300g | TWP Nutrition | Collagen | powder | 1/1/1; Gladiator Nutrition | yes | INCLUDE_STRONG | HIGH | `EXACT_CATEGORY_AND_COLLAGEN_IDENTITY`; only exact-category row. |

Classification totals are exhaustive: `29 + 21 + 2 = 52`.

## Mandatory product conclusions

- **CNP Loaded ISO Collagen Protein 2kg** is current ID `864`, active/unmerged,
  incorrectly labelled `Whey Protein`, with 2/2 fresh in-stock offers from
  Jon's Supplements and visible on exact Search page 2. It is
  `INCLUDE_STRONG`. Existing Whey/Whey Isolate semantics already exclude
  Collagen identity, so Collagen should own it without changing Whey behavior.
- **Time 4 Collagen+** is ID `831`, Health Supplements, active/unmerged, 2/2
  fresh in-stock offers from Jon's Supplements/eBay UK, visible and strong.
- **Trained By JP Collagen Powder** is ID `937`, Health Supplements,
  active/unmerged, 2/2 fresh offers (1 in stock) from Jon's Supplements,
  visible and strong.
- **NOW Foods Collagen Peptides** is ID `720`, Health Supplements,
  active/unmerged, 2/2 fresh in-stock offers from Fit House/eBay UK, visible
  and strong.
- **Swanson Collagen Peptides** is ID `1002`, Health Supplements,
  active/unmerged, 1 fresh but out-of-stock offer from Fit House, visible and
  strong. **Swanson Marine Collagen Peptides** is ID `1343`, Health
  Supplements, active/unmerged, 1 fresh in-stock 10 Reps offer, visible and
  strong.
- **Osavi Advanced Marine Collagen** is ID `986`, Health Supplements,
  active/unmerged, 2 fresh offers (1 in stock) from Fit House, visible and
  strong.
- **Sunna Marine Collagen** is ID `1216`, Health Supplements, active/unmerged,
  1 fresh in-stock 10 Reps offer, visible and strong. Sunna Halal Collagen
  Protein `1215` is also strong despite its current offer being out of stock.
- **Applied Nutrition Collagen Peptides** is ID `1221`, Health Supplements,
  active/unmerged, 1 fresh in-stock 10 Reps offer, visible and strong. Applied
  Nutrition Keto Collagen `188` is also strong despite its `Vitamins` label.
- **PER4M Multi-Blend Collagen** is ID `1291`, Health Supplements,
  active/unmerged, 4/4 fresh in-stock offers through 10 Reps, visible and
  strong. No SEO-20/PER4M experiment state was touched.
- **Trec Collagen Renover** is ID `1017`, Health Supplements, active/unmerged,
  3/3 fresh in-stock offers from 6 Pack Supplements, visible and strong.
- **KIOR Collagen Probio/Glow/Super** are IDs `435/460/461`; all are
  active/unmerged, visible and strong. Each has 2/2 fresh in-stock offers from
  KIOR Health/Whey Okay. KIOR Collagen+ `440` is also strong, visible and
  active/unmerged, but its only Whey Okay offer is not fresh/usable.
- **Osavi Collagen & Electrolytes** IDs `721` and `989` are active/unmerged,
  each has one fresh in-stock Fit House offer, is visible and is
  `INCLUDE_STRONG`: Collagen is a named co-primary identity, not incidental
  electrolyte copy.

## Formats, subtypes and overlap

Strong-member format distribution, using reviewed source/name evidence where
the canonical field is blank:

| Format | Strong count |
| --- | ---: |
| Powder | 23 |
| Capsule/tablet | 5 |
| Gummy/chew | 1 |
| Liquid/drink | 0 |
| Other/unknown | 0 |

One route safely covers all formats. Format is a filter/facet, not a separate
semantic category. Six strong rows have explicit Marine Collagen identity
(`577, 633, 639, 986, 1216, 1343`); this is a useful subtype within the parent,
not enough evidence for a separate route. Six strong rows explicitly identify
Collagen Peptides (`422, 681, 720, 1002, 1221, 1343`); these are ordinary
Collagen supplements, not prohibited research peptides.

Joint positioning allows legitimate multi-membership. Product `577` is both a
Glucosamine and named/dosed Marine Collagen product; Trec Collagen Renover
`1017` retains Collagen membership despite joint positioning. Conversely,
Glucosamine/Vitamin C products that merely discuss Collagen formation are
strong excludes. Bone and Joint Health Gummies `571` remains review because
Collagen is only one description-level component with insufficient captured
identity evidence. MSM/Chondroitin/ordinary joint formula language alone never
creates Collagen membership.

## Canonical category quality and public metrics

Strong members by current canonical category:

| Canonical category | Strong members |
| --- | ---: |
| Collagen | 1 |
| Health Supplements | 25 |
| Vitamins | 2 |
| Whey Protein | 1 |

Only `1/29` strong members is in exact `Collagen`; `28/29` are outside it. The
exact category contains one strong product and has `0` false positives and `0`
review cases. It is precise but almost empty, so it is not a reliable coverage
mechanism. The public exact Search metrics are:

| Metric | Current value |
| --- | ---: |
| Public results | 52 |
| Expected strong members | 29 |
| Visible strong true positives | 29 |
| Visible strong false positives | 21 |
| Visible review cases | 2 |
| Missing strong members | 0 |
| Recall | 100.0% |
| Precision (`true positives / all visible`) | 55.8% |

Search therefore has complete recall only by exposing every description match,
including Vitamin C formation claims. A semantic route should retain all 29
strong identities and fail the remaining 23 closed.

## Root causes

Counts can overlap; row counts and systemic/query-case counts are labelled.

| Root cause | Count | Evidence |
| --- | ---: | --- |
| `CATEGORY_LABEL_MISMATCH` | 28 rows | Strong identities outside exact Collagen. |
| `COLLAGEN_PRIMARY_IDENTITY_MISSING_CATEGORY` | 28 rows | Same canonical data debt viewed from product identity. |
| `SOURCE_CATEGORY_TOO_BROAD` | 27 rows | Strong products stored under Health Supplements or Vitamins. |
| `SOURCE_CATEGORY_TOO_NARROW` | 1 row | CNP Collagen Protein stored as Whey Protein. |
| `DESCRIPTION_ONLY_MATCH` | 23 rows | 21 excludes plus 2 reviews have no Collagen name/category identity. |
| `COLLAGEN_FORMATION_CLAIM_FALSE_POSITIVE` | 19 rows | Vitamin C/formation/synthesis benefit copy drives irrelevant results. |
| `INCIDENTAL_COLLAGEN_MENTION` | 4 rows | IDs 571, 595, 612 and 660 are component/protection/alongside mentions. |
| `JOINT_BLEND_AMBIGUITY` | 1 row | Bone and Joint Health Gummies `571`. |
| `SEARCH_PHRASE_MISMATCH` | 2 query forms | `hydrolyzed collagen` and `bovine collagen` return zero. |
| `SEMANTIC_ALIAS_MISSING` | 2 query forms | No semantic normalisation covers those spelling/subtype forms. |
| `PUBLIC_BROWSE_ARCHITECTURE_LIMITATION` | 1 systemic | No homepage link or semantic route; broad Search is the only public behavior. |
| `CURRENT_OFFER_PRESENTATION_FILTER` | 3 strong rows | IDs 440, 1002 and 1215 lack a fresh in-stock offer. |
| `NO_USABLE_OFFER` | 3 strong rows | Same presentation cases; membership remains intact. |
| `INACTIVE_PRODUCT` | 0 | Every candidate is active. |
| `MERGED_PRODUCT` | 0 | Every candidate is unmerged. |
| `OTHER_NAMED_CAUSE` | 0 | No additional cause is needed. |

Canonical category cleanup is separate data-quality debt. The semantic route
must not mutate categories to simulate multi-membership, and this audit gives
no authority for production data writes.

## Taxonomy model decision

| Model | User clarity / semantic correctness | Coverage, SEO and scale | Decision |
| --- | --- | --- | --- |
| **A: one semantic `/collagen` route containing all strong identities** | One clear family; formats, Marine, peptide, protein, beauty and joint-positioned headline products remain understandable subtypes. | Covers 29 strong rows with one canonical browse owner and reuses the established lifecycle/evaluator. | **Recommend.** |
| B: Collagen parent plus Marine child | Marine is meaningful but only six strong rows and shares the same user decision space. | Creates duplicate/overlapping ownership and thin child-page risk without production evidence of need. | Reject now. |
| C: separate powder/capsule/Marine routes | Fragments one ingredient family by delivery format and forces mixed products into arbitrary owners. | 23 powders, 5 capsules/tablets and 1 gummy do not justify multiple public routes. | Reject. |
| D: broad beauty/joint/protein Collagen children | Marketing goals overlap and are not stable product identities. | Higher claim, duplication and maintenance risk; review evidence is insufficient. | Reject; future facets can express these attributes. |

## Engine sufficiency and implementation boundary

The existing `CategoryCoverageDefinition` and `evaluateCategoryCoverage()` are
sufficient. Current `anyOf`, `allOf` and `noneOf` field conditions can:

- include explicit Collagen name identities and co-primary variants;
- exclude formation/synthesis/alongside description matches only when the name
  lacks Collagen identity;
- send secondary-component description evidence to review;
- use broad candidate queries while rendering only `INCLUDE_STRONG`.

No new relationship type, evaluator precedence change, runtime product-ID or
slug exception, retailer condition, database field or architecture extension
is required. Future runtime logic must contain exactly `0` product-ID
exceptions and `0` slug/retailer exceptions; IDs remain audit/test fixtures
only.

The exact recommended next implementation unit, requiring its own
owner-authorized implementation contract, is:

> Add one shared `collagen` CategoryCoverage definition and a dedicated
> `/collagen` browse route in `planned` lifecycle state. Use this 52-row closed
> universe as fixture protection with 29 strong, 21 exclude and 2 review
> outcomes; route only an exact Collagen category label to it; register and
> test shared cache, canonical, robots (`noindex, follow`), sitemap-ineligible,
> error and breadcrumb contracts; keep Search, canonical product categories,
> Whey semantics, offer-presentation rules, database, SEO-20 and PER4M
> unchanged.

The exact stop point is this evidence-backed taxonomy decision and durable
audit record. No definition, route, homepage link, Search resolver, lifecycle
entry, sitemap change, product relabel, database write or other runtime work is
authorized in this unit.

## Next Category Coverage screening

This is a quick ranking, not a full audit. Current active canonical
name/category screening found:

1. **P1-A — Nootropics:** 10 candidate rows spread across Health Supplements,
   Nootropics and Pre Workout. Small, bounded and visibly fragmented.
2. **P1-B — Protein Powder/subtypes:** 47 candidate rows across Protein Powder,
   Whey Protein and Protein Bars. Existing protein subtype mechanisms must be
   reused; CNP's Collagen mislabel demonstrates the boundary risk.
3. **P1-C — Energy Supplements / Energy Drinks:** 187 broad candidate rows
   across six categories including Pre Workout and Electrolytes. High potential
   impact, but overlap means it should follow the smaller bounded audits.

Hydration/Electrolytes remains a later candidate: 34 screened rows across six
categories, but the existing Hydration route makes reuse/duplication review a
prerequisite.

## Recorded follow-ups, not implemented

- After Category Coverage cleanup, add one shared exact-category Search intent
  resolver based on `CategoryCoverageDefinition`: exact `Testosterone
  Boosters`, `Fat Burners`, and future `Collagen` intents may resolve to their
  semantic routes, while general searches remain Search.
- After that resolver, address the severe homepage mobile-menu overlay
  overlap/readability problem documented by the owner screenshot on
  2026-11-03.
- A generic audit harness was **not created**. Three audits prove repetition,
  but candidate generation, dual-taxonomy handling and evidence sources are
  still category-specific. The temporary collector was not category-agnostic
  enough to commit; premature generalisation would create a second truth path.
