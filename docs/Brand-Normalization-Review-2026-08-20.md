# Brand normalization review — 20 August 2026

## Scope and safety boundary

This is the reviewed evidence pack for SEO-11. It uses the existing `products.brand`
field and does not create a second brand model, merge products, change retailer
mappings or publish brand pages. Production observations were SELECT-only.

## Exact case-only aliases

| Observed values | Canonical value | Products before | Decision evidence |
|---|---|---:|---|
| `PER4M` / `Per4m` | `Per4m` | 20 / 13 | The first-party brand site uses `Per4m`; the split is case-only. |
| `NOW Foods` / `Now Foods` | `NOW Foods` | 2 / 18 | The first-party brand site uses `NOW Foods`; the split is case-only. |
| `OstroVit` / `Ostrovit` | `OstroVit` | 9 / 1 | The first-party brand site uses `OstroVit`; the split is case-only. |
| `ActivLab` / `Activlab` | `Activlab` | 1 / 1 | The first-party brand site uses `Activlab`; the split is case-only. |

The guarded migration changes only the 40 rows carrying the non-canonical case
forms. It binds the complete 65-product alias scope by exact IDs, requires all
rows to remain active and unmerged, preserves catalogue row counts and fails on
any drift.

## `Unknown` review

Nineteen active products currently carry literal `Unknown`. No automatic update
is included in SEO-11. Nine records have a strong candidate because the product
name and retailer mapping agree with a canonical brand already present in the
catalogue, but changing them remains an owner-reviewed product-identity decision.

| Product IDs | Candidate | State |
|---|---|---|
| 167 | `PEScience` | Strong candidate; unchanged pending owner review. |
| 345 | `Optimum Nutrition` | Strong candidate; unchanged pending owner review. |
| 409 | `NXT Nutrition` | Strong candidate; unchanged pending owner review. |
| 415, 416 | `Urban Gym Wear` | Strong candidates; unchanged pending owner review. |
| 447 | `Chaos Crew` | Strong candidate; unchanged pending owner review. |
| 449 | `USN` | Strong candidate with three GTIN-bearing mappings; unchanged pending owner review. |
| 477, 478 | `Himalaya` | Strong candidates; unchanged pending owner review. |
| 237, 418, 419, 420, 430, 431, 493, 494, 515, 1084 | — | Insufficient or potentially ambiguous identity evidence; unchanged. |

The review boundary deliberately leaves bundles (`493`, `494`), generic
accessories and names that could describe either a brand or a formulation
untouched. These records do not block normalization of the four exact case-only
aliases, and they cannot authorize a brand page.

## Release evidence required

1. Focused migration tests and the full local quality gate pass.
2. The exact migration SHA is reviewed and selected only for the production
   database-owner path; staging excludes it.
3. The production migration is applied only after the reviewed pull request is
   merged and CI is green.
4. SELECT-only postflight proves canonical counts of `33 / 20 / 10 / 2`, zero
   remaining source aliases, 19 unchanged `Unknown` products and unchanged
   product, variant, mapping, offer and price-history row counts.
5. Only then may SEO-11 be marked `LIVE VERIFIED` and SEO-14 become active.
