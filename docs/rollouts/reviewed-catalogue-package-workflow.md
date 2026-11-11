# Reviewed catalogue package workflow

This is the common path for new retailer catalogue onboarding. New retailers
must use this package contract instead of adding another retailer-specific
approval or execution runner.

## Reviewed URL validation

V2/V3 packages keep the direct merchant URL and outbound affiliate URL separate.
The existing `validateManifest()` checks HTTPS, URL encoding, credentials and
the direct URL's retailer hostname. It validates one explicit destination in a
tracking path (`/destination:...`) or query parameter. Supported carrier names
are `destination`, `dest`, `url`, `redirect`, `redirect_url`, `redirect_uri` and
`target`. A destination must equal the reviewed direct URL after standard URL
parsing, including origin, port, product path and query. Tracking parameters on
the outer URL remain unchanged. Duplicate carriers, nested redirects, malformed
encoding and additional decoding layers fail closed; no alternative target is
selected after rejection.

An affiliate URL without an explicit carrier remains allowed by this contract,
including opaque Awin links, eBay tracking parameters and `sca_ref`. These checks
do not establish the final network redirect destination. Validation makes no
network requests and never rewrites either stored URL. The package loader runs
this check before the existing protected approval/apply calls. SQL independently
binds the exact approved plan and both raw URL fields; it does not duplicate the
embedded-carrier parser. The SQL correction passed the existing atomic/URL,
bounded-state and V3 integration tests on disposable PostgreSQL 17 on 11 November
2026. It remains excluded from both shared-environment migration selectors;
deployment requires separate authorization and the existing prerequisite checks.

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
node scripts/reviewed-catalogue-package-executor.js --target=<staging|production> --mode=preflight --manifest=config/retailers/<manifest>.json --manifest-sha256=<sha256> --profile=<profile> --output=tmp/retailer-feeds/<retailer>/preflight.json
```

Version 1 packages require `--target=production`. Version 2 packages carry an
exact `STAGING` or `PRODUCTION` environment and Supabase project reference;
the CLI target, credential endpoint, login role, transaction marker and
manifest must all agree. Both targets use the shared verify-full PostgreSQL
TLS helper and a trusted private CA path.

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

## V3 canonical identity evidence

A V3 reviewed row may carry the optional, versioned
`canonical_identity_evidence` sub-contract when its canonical physical or count
identity cannot be proved by raw option-role parity alone. Its absence preserves
the original V3 behavior exactly. Its presence is fail-closed and separates:

- raw facts, retained exactly from the retailer source;
- captured and hashed external facts bound to the exact product, variant and
  pack configuration;
- deterministic derived facts recomputed from versioned operands without
  rounding;
- the exact facts selected for canonical identity; and
- mandatory conflict records for every material raw/canonical difference.

Raw facts are not a self-declared subset. Every supplied raw fact must bind to
the exact key and byte-preserved value in the row's validated
`external_options`, and its role must agree with the authoritative
`option_roles`. When a selected canonical physical-size or container-count fact
displaces an authoritative normalized raw role, the contract must contain
exactly one corresponding raw fact and exactly one linked conflict record.
Omitting the raw fact, substituting another option, duplicating the binding or
adding an orphan conflict fails closed. A preserved pack-structure string does
not itself create a false scalar conflict when no authoritative raw pack-count
role exists.

The evidence review decision is a fact-provenance decision. It is distinct from
the owner's business approval and cannot be replaced by an owner override. The
sub-contract is embedded in the immutable manifest row, copied exactly into the
plan evidence and authorization envelope, and therefore covered by the manifest
SHA, artifact SHA and plan fingerprint. The executor never fetches an evidence
URL or chooses canonical values at runtime.

JavaScript validates the contract during package generation and loading. The
database validator independently checks the same closed schema, bindings,
source eligibility, derivations, conflicts, review and target projection before
approval or apply. Raw `external_options` remain unchanged. Deploy the matching
SQL function migration to STAGING and then PRODUCTION, with the usual lineage,
security and rollback rehearsal, before merging or executing evidence-backed
packages. Historical packages and clean raw-role multipacks continue through
the original path.

## Existing-product pack correction

`reviewed-catalogue-product-pack-correction-v1` is the only canonical-update
extension to this workflow. It is generic and deliberately narrow: one existing
`products` row, the `net_weight_g` field, one positive exact-before value and one
different positive reviewed-after value. Extra fields, identity metadata,
`product_variants`, multiple targets and stale before-state all fail closed.

Prepare an immutable local package from an existing evidence artifact with:

```text
npm run catalogue:pack-correction -- --mode=prepare --target=<staging|production> --source-artifact=tmp/<prepared>.json --source-artifact-sha256=<sha256> --source-artifact-fingerprint=<fingerprint> --evidence-sha256=<sha256> --output=tmp/<package>.json
```

After the owner explicitly approves that exact immutable scope, create a new
local seal without editing or overwriting the `PREPARED` package:

```text
npm run catalogue:pack-correction -- --mode=owner-approve --target=<staging|production> --package=tmp/<prepared-package>.json --package-sha256=<exact-prepared-sha256> --authorized-by=<owner-identity> --confirm-owner-approval=true --output=tmp/<new-owner-approved-package>.json
```

The lifecycle is `PREPARED` -> explicit local `OWNER_APPROVED` sealing ->
read-only production `preflight` -> separate explicitly confirmed production
`apply`. Owner approval validates the package fingerprint, target and every
bound evidence file, changes only its approval status and metadata, reseals a
new file, and performs no database connection or database write.

`preflight` uses the protected validator in a read-only transaction. `apply`
additionally requires an `OWNER_APPROVED` sealed package, exact package SHA-256,
`--confirm-reviewed-product-pack-correction=true`, a clean `origin/main`, a
fresh single-use approver receipt and the protected executor. The owner-approval
seal and apply confirmation are independent controls; neither substitutes for
the other.
The atomic RPC conditionally changes exactly one `net_weight_g`, compares every
other product column, verifies zero row-count delta, consumes the approval and
then undergoes a separate validator readback. The CLI writes an immutable audit
artifact under `tmp/`. Preparing or owner-approving a package does not preflight
or apply it. No other canonical field is supported.

## Permanent boundaries

- Owner review remains mandatory for product identity and production writes.
- SKU is never treated as GTIN.
- Canonical updates and category changes remain forbidden except for the exact
  reviewed product-pack correction contract above.
- The runner performs no direct business-table DML. It calls only the existing
  approval and atomic apply RPCs.
- Price and stock automation starts only after catalogue onboarding is complete
  and uses a separate guarded refresh workflow.
