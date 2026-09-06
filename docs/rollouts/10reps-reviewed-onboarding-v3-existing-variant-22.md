# 10 Reps reviewed existing-variant onboarding v3

Status: **OWNER REVIEWED — PREPARED FOR GUARDED ONE-PLAN ONBOARDING**.

The owner approved all 22 displayed bindings. Existing SupplementScout
categories must be preserved for every row. The four Per4m Creatine Sherbet
rows remain canonically branded `Per4m`; the retailer feed's `Applied
Nutrition` brand value is source metadata and must not change the canonical
brand.

## Closed scope

- Exactly 22 10 Reps source variants bind to 22 active existing variants
  across five active existing products.
- Retailer `10 Reps` remains existing retailer ID `14`.
- Product and variant creation are forbidden.
- Canonical product, variant, GTIN, category, brand and nutrition updates are
  forbidden.
- Source URLs, images, external variant IDs and SKUs are preserved. Every
  external GTIN is null; SKU must never populate GTIN.
- Shipping is known at GBP 3.99. Delivered price is product price plus GBP
  3.99 for every row.
- Nine source variants are in stock and thirteen are out of stock in the
  reviewed feed snapshot.

The reviewed binding manifest is
[`config/retailers/10reps-reviewed-bindings-v3-existing-variant-22.json`](../../config/retailers/10reps-reviewed-bindings-v3-existing-variant-22.json).
Its immutable local CSV and dry-run artifact remain under ignored
`tmp/retailer-feeds/10reps/` and must not be committed.

## Dry-run result

The dry run produced 22 eligible plans, zero blocked or skipped rows and zero
identity, GTIN, size, pack-count or format conflicts. It would create zero
retailers, products or variants and exactly 22 retailer products, 22 offers and
22 initial price-history rows.

## Guarded application

The bounded 10 Reps approver must require the exact manifest, CSV, dry-run
artifact, hashes and 22 fingerprints. It must approve only one selected plan
per invocation through direct PostgreSQL and
`retailer_catalogue_production_approver`. Each approval is single use and must
be followed immediately by one-plan pilot apply and strict readback.

Readback after every plan must confirm retailer ID `14`, the reviewed source,
product and variant binding, price, stock, GBP 3.99 shipping and delivered
price. It must also confirm that product and variant counts and all canonical
fields remain unchanged. Processing stops on the first mismatch.

Automated feed refresh remains deferred until the full 10 Reps catalogue has
been mapped.
