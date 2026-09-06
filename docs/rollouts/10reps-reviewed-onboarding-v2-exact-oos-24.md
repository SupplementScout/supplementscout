# 10 Reps reviewed exact OOS onboarding v2

Status: **OWNER REVIEWED — PREPARED FOR BLOCKER-ONLY REVIEW; NO PRODUCTION APPROVAL OR APPLY**.

The owner explicitly reviewed the 24 displayed 10 Reps bindings with the
instruction `jedziemy z 24`. The binding scope is recorded in
[`config/retailers/10reps-reviewed-bindings-v2-exact-oos-24.json`](../../config/retailers/10reps-reviewed-bindings-v2-exact-oos-24.json).
This package records reviewed identity and immutable evidence only. It does not
submit an approval, execute an apply, register automation or grant database
authority.

## Reviewed scope

- Exactly 24 10 Reps source variants bind to 24 active existing canonical
  variants across six active existing products.
- Every canonical variant belongs to the reviewed product.
- Retailer `10 Reps` already exists as ID `14`, slug `10-reps`, website
  `https://www.10reps.co.uk/`.
- None of the 24 source variants had an existing retailer mapping at the fresh
  production readback.
- All 24 source variants were active and purchasable on their source product
  pages but reported out of stock.
- Product and variant creation, canonical product/variant updates, canonical
  GTIN updates, category changes and nutrition updates are forbidden.
- Shipping is known at GBP 3.99. Delivered price equals effective product price
  plus GBP 3.99 for every row.
- Source SKU is preserved only as SKU. All 24 external GTIN values are null;
  SKU must never populate a GTIN field.

## Immutable local evidence

Evidence remains under ignored `tmp/retailer-feeds/10reps/` and must not be
committed.

| Evidence | SHA-256 |
| --- | --- |
| `10reps-full-catalog-exact-oos-existing-variants-24-source-validation.json` | `be8484559eb00090472a250c4ff59814312c6183a80165b35922cf095e42a9c4` |
| `10reps-full-catalog-exact-oos-existing-variants-24-production-readback.json` | `03ddcde0d6fa6ccd573dbe8084f098b76f7bbc59f76acea52e5058322a1070a3` |
| `10reps-reviewed-bindings-v2-exact-oos-24.csv` | `5e16a807360d75afd9325e527a7ee35ea71aafd5836c1d5230ade957da6ec92d` |
| `10reps-reviewed-bindings-v2-exact-oos-24-dry-run.json` | `560dd434328955f4acd12554c3096863c482d1d0d8a97ca3b148b367ae2c64cf` |

Fresh source validation verified six product pages, all 24 exact source
variants and ten distinct images. Price, flavour, SKU, image identity and OOS
state matched the reviewed rows. Fresh direct PostgreSQL validation used the
protected validator credential, a read-only transaction and
`retailer_catalogue_production_validator`; database writes were zero.

## Dry-run result

The fresh dry-run command was:

```text
node scripts/import-products.js --mode=feed --safe-create --dry-run --csv=tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v2-exact-oos-24.csv --artifact=tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v2-exact-oos-24-dry-run.json
```

The result is 24 eligible plans, zero blocked or skipped rows and zero identity,
GTIN, size, pack-count or format conflicts. Every plan has retailer, product and
variant action `existing`; retailer ID is `14`. The plans would create zero
retailers, products or variants and exactly 24 retailer products, 24 OOS offers
and 24 initial price-history rows.

## Required blocker review

Before any production approval, require the exact manifest, CSV path and SHA,
artifact path and SHA, 24-plan count, zero blockers and the exact 24 manifest
fingerprints. For every selected plan require retailer ID `14`, existing
product and variant actions, the reviewed product/variant/source IDs, source
URL, price, OOS state, GBP 3.99 shipping and exact delivered-price arithmetic.
Reject product/variant creation, canonical updates, category changes, SKU as
GTIN, a changed fingerprint or any plan outside the manifest.

The bounded approver must continue to use direct PostgreSQL, a protected
production approver credential, `SET LOCAL ROLE
retailer_catalogue_production_approver`, and only
`approve_product_import_plan`. It must contain no service-role, PostgREST,
apply RPC, pilot-apply path or direct business-table DML.

## Controlled one-plan sequence after separate owner authorisation

1. Add a closed approval-only profile bound to this manifest, reviewed CSV and
   dry-run artifact. Its allowed set must contain exactly the 24 fingerprints
   recorded in the manifest.
2. Run blocker-only code and artifact review, quality gates, then obtain a
   separate owner decision before committing or submitting an approval.
3. Use source variant `7712`, product `788`, variant `1073`, fingerprint
   `80844944ed999b45ce749d1f16274304` as the first canary.
4. Submit one fresh, expiring approval and immediately pilot-apply only that
   fingerprint. Run strict production readback and stop on any mismatch.
5. Continue one fingerprint at a time. Never reuse a consumed approval or
   reapply an already-created mapping. Stop on expiry, stale evidence,
   unexpected stock/price/identity change or any canonical write.
6. Final readback must prove retailer-products/offers/price-history `+24`,
   products/variants/categories/canonical GTIN changes `0`, and all 24 offers
   remain bound to retailer ID `14` with GBP 3.99 shipping.

No approval submission, apply, product/variant creation, canonical update,
commit or automation registration is authorised by this preparation package.
Automated feed refresh remains deferred until full catalogue mapping is
complete.
