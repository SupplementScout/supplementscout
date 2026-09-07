# Reviewed catalogue package workflow

This is the common path for new retailer catalogue onboarding. New retailers
must use this package contract instead of adding another retailer-specific
approval or execution runner.

## Inputs

A package consists of:

- one tracked owner-reviewed manifest under `config/retailers/`;
- one ignored canonical CSV under `tmp/retailer-feeds/`;
- one ignored dry-run artifact under `tmp/retailer-feeds/`;
- exact SHA-256 bindings for the manifest, CSV and artifact;
- one reviewed row and plan fingerprint for every intended mapping.

Source product and variant identifiers are strings. The common package does not
assume Shopify, WooCommerce or numeric identifiers. Source-specific readers may
normalize a feed into the canonical CSV, but they must not add approval or
production-write logic.

## Preparation

Generate the canonical CSV, run `scripts/import-products.js` in `--dry-run`
mode with the reviewed manifest arguments, and seal the resulting artifact in
the manifest. The package validator requires zero blockers and conflicts, exact
row counts and exact product, variant, mapping, offer, price-history and
shipping actions.

Run the shared read-only gate before owner approval:

```text
node scripts/reviewed-catalogue-package-executor.js --mode=preflight --manifest=config/retailers/<manifest>.json --manifest-sha256=<sha256> --profile=<profile> --output=tmp/retailer-feeds/<retailer>/preflight.json
```

## Controlled apply

After the owner approves the exact manifest scope and the reviewed files are on
`origin/main`, run the same command with `--mode=apply` and a new ignored output
path. Apply mode refuses a dirty tracked working tree or a local commit that is
not exactly `origin/main`.

The executor opens one protected direct PostgreSQL connection for each existing
role: validator, approver and executor. It never uses Supabase/PostgREST or a
service-role key. For every row, in manifest order, it:

1. creates a fresh 15-minute approval bound to the manifest, artifact, profile
   and plan fingerprint;
2. atomically applies only that approved plan;
3. verifies exact row-count deltas and reads back the product, variant, mapping,
   offer and initial price-history row;
4. stops immediately on the first mismatch.

Connections are reused across the package. Previously completed rows are not
re-queried after every item, which keeps runtime close to linear as packages
grow. Each plan still has its own transaction, approval and readback.

If any source row is already mapped, the package fails preflight. Generate a
fresh package containing only the remaining rows; do not replay an old
artifact. A package may contain only one product-creation anchor for each source
product family. Create additional sibling variants in a fresh package after the
parent exists.

## Permanent boundaries

- Owner review remains mandatory for product identity and production writes.
- SKU is never treated as GTIN.
- Canonical updates and category changes remain forbidden unless a future
  manifest contract explicitly adds and validates such an action.
- The runner performs no direct business-table DML. It calls only the existing
  approval and atomic apply RPCs.
- Price and stock automation starts only after catalogue onboarding is complete
  and uses a separate guarded refresh workflow.
