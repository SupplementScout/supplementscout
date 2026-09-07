# Reviewed catalogue package v1

This is the shared onboarding path for owner-reviewed retailer catalogue rows.
It replaces new retailer- or product-specific approval runners. Existing sealed
rollouts remain valid and are not rewritten.

The owner reviews one manifest under `config/retailers/`. The manifest binds an
existing retailer, the exact ignored CSV and dry-run artifact by SHA-256, every
source row and plan fingerprint, all intended catalogue actions, shipping,
price, stock and canonical targets. Source IDs are opaque strings. Product
format is taken from the reviewed row. A missing SKU is allowed only when the
exact source row and plan are in the reviewed package. SKU is never promoted to
GTIN.

The common approver validates the complete package before reading a credential.
It then opens a direct PostgreSQL transaction, assumes only
`retailer_catalogue_production_approver`, calls only the approval RPC, verifies
the returned receipt and commits. Each apply still needs a fresh, single-use,
15-minute approval and strict readback. Product identity decisions remain owner
decisions.

Required manifest shape:

```json
{
  "schema_version": 1,
  "kind": "reviewed-catalogue-package-v1",
  "status": "OWNER_APPROVED",
  "authorized_by": "owner",
  "authorized_at": "2026-09-07T10:05:00.000Z",
  "retailer": {
    "id": 14,
    "name": "Retailer",
    "slug": "retailer",
    "website": "https://retailer.example/",
    "expected_action": "existing",
    "shipping_known": true,
    "shipping_cost": 3.99
  },
  "policy": {
    "reviewed_rows_only": true,
    "allow_product_creation": true,
    "allow_variant_creation": true,
    "allow_canonical_product_updates": false,
    "allow_canonical_variant_updates": false,
    "allow_canonical_gtin_updates": false,
    "allow_category_changes": false,
    "sku_is_not_gtin": true,
    "one_plan_at_a_time": true,
    "fresh_single_use_approval_per_plan": true,
    "strict_production_readback_after_each_apply": true
  },
  "profiles": []
}
```

Each profile contains exact `csv_path`, `csv_sha256`, `artifact_path`,
`artifact_sha256`, counts and its reviewed rows. Each row contains the opaque
source product/variant IDs, optional source SKU and true GTIN, source URL,
canonical product/variant binding, reviewed action, brand, category, product
and variant names, flavour, size, pack count, product format, price, stock,
source-row fingerprint and plan fingerprint.

For an owner-reviewed tablet, capsule, gummy or chew whose identity is a unit
count rather than a weight or serving size, the row also carries the exact
`unit_count` and `unit_type`. In that case `size_value` and `size_unit` are
null. The importer stores the count on the product and keeps the variant size
null; it never converts a count into grams or servings. The same optional
fields work for every retailer using this package contract.

The generic dry-run command adds the final reviewed manifest contract:

```text
node scripts/import-products.js --mode=feed --safe-create --dry-run --csv=<ignored-csv> --artifact=<ignored-artifact> --reviewed-manifest=<tracked-manifest> --reviewed-manifest-sha256=<sha256> --reviewed-profile=<profile-id>
```

The approval-only command is:

```text
node scripts/reviewed-catalogue-artifact-approver.js --manifest=<tracked-manifest> --manifest-sha256=<sha256> --profile=<profile-id> --plan-fingerprint=<fingerprint>
```

The established `import-products.js --pilot-apply` command consumes one returned
approval ID. The original artifact is never loop-applied; each selected plan is
approved and applied separately, then read back before continuing.
