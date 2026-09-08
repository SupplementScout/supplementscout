# 10 Reps reviewed onboarding v1

Status: **PREPARED FOR BLOCKER-ONLY REVIEW — NO PRODUCTION APPROVAL OR APPLY**.

The owner reviewed exactly 20 existing product/variant bindings from the first
10 Reps feed audit. The reviewed manifest is
[`config/retailers/10reps-reviewed-bindings-v1.json`](../../config/retailers/10reps-reviewed-bindings-v1.json).
It is an evidence and scope manifest; it does not register an executor, grant
database authority or enable a schedule. The existing importer remains the
canonical-feed and artifact mechanism.

## Scope and evidence

- Exactly 20 source variants bind to 20 existing canonical variants across five
  existing products. Held rows: zero.
- Product and variant creation, canonical GTIN updates, category changes and
  nutrition updates are forbidden.
- Retailer: 10 Reps, `https://www.10reps.co.uk/`, slug `10-reps`.
- Shipping is the owner-supplied James rule: known, GBP 3.99; delivered price is
  effective item price plus GBP 3.99.
- The manifest preserves source product/variant IDs, source and image URLs,
  SKU, brand, size, flavour, price and stock. All selected GTIN fields are null;
  SKU must never populate a GTIN field.
- Fresh catalogue reads confirmed all identities, categories and the absence
  of the retailer. Fresh feed and page checks confirmed the same price, stock,
  source variant, flavour, SKU and image. All 20 product URLs and 15 distinct
  image URLs returned HTTP 200.

Evidence remains under ignored `tmp/retailer-feeds/10reps/`:

| Artifact | SHA-256 |
| --- | --- |
| `10reps-reviewed-v1-feed.csv` | `6b9edbbe07cd2a6f8641effe9f65b5f6d3863acec1845e7c8956dd514ca3a697` |
| `10reps-reviewed-bindings-v1.csv` | `0ecba1a6528c4e4397ab48256355fee7d8e7a2f40d6a6ac0276df8b42762da36` |
| `10reps-reviewed-bindings-v1-dry-run.json` | `68bff98ddabff332a71fcf968214a09a0fe94d473c2dae110d473a725cc33785` |

The reviewed CSV was freshly regenerated. Its bytes match the original because
the source and bindings have not changed. The dry-run is a new artifact with a
new run ID, capture times and plan fingerprints. Every fingerprint is recorded
on its manifest row and in `10reps-reviewed-v1-plan-fingerprints.json`.
`10reps-reviewed-v1-evidence.json` binds the manifest, CSV and artifact digests.
Raw source, local helpers and dry-run artifacts must not be committed.

## Read-only preparation

The command used was:

```text
node scripts/import-products.js --mode=feed --safe-create --dry-run --csv=tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v1.csv --artifact=tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v1-dry-run.json
```

A local transport guard restricted the importer to REST GET requests and
blocked RPC/mutation requests. It recorded 60 GET requests, zero blocked
attempts and zero writes. The catalogue revalidation used three GET requests.
The private feed setting was loaded separately and never passed to the importer.

The result is 20 eligible plans, zero held/blocked rows, zero conflicts, and
would-create totals of one retailer, 20 retailer products, 20 offers and 20
initial price-history rows. Products and variants both have action `existing`;
their create totals are zero. All artifact approval flags remain false.
Preflight's word "approved" describes eligibility, not production approval.

## Blocker-only review contract

Before any later approval, compare the manifest and both CSV/artifact hashes,
use the existing `loadDryRunArtifact` validation, and check every resolved plan
against its manifest row. Require exact source and canonical IDs, URLs, price,
stock, GBP 3.99 shipping and delivered totals. Require product/variant actions
`existing`, mapping/offer/history actions `create`, exactly 20 unique targets,
and no unexpected field or mutation. The local preparation validation also
rejected ten altered plans covering identity, creation, GTIN, price, shipping,
stock, URL and premature approval.

The manifest's policy flags are scope declarations, not a replacement for
executor guards. The reviewer must confirm that the chosen existing protected
approval/execution path enforces the exact manifest and immutable artifact.
No 10 Reps write-capable workflow or approver profile is enabled by this package.

Any weaker or changed source/canonical evidence is held. Do not substitute an
unreviewed product or variant to preserve the row count. Refresh evidence before
later production approval; these captured commercial values are not perpetual
authority. Quality-gate jobs receive no production-write credentials.

## Controlled onboarding sequence after separate owner authorisation

The current 20-row artifact is a review package, not a batch to apply in a
loop. All 20 plans currently have retailer action `create`. The existing atomic
import core inserts a retailer for that action. Replaying all 20 unchanged
would therefore attempt repeated retailer creation.

Use the existing bootstrap/remaining-rows pattern, already used by Predators
Gear, while retaining this exact 20-row identity scope:

1. After blocker review, obtain separate explicit authorisation for the
   protected production onboarding stage. Do not submit an approval during the
   current preparation task.
2. Subject to fresh source and database evidence, select only manifest row 1
   for the bootstrap: source variant `10003`, product `788`, variant `1080`.
   Its exact fingerprint is `onboarding.bootstrap_plan_fingerprint` in the
   manifest. Use the existing split approver/executor roles and artifact-bound,
   single-use, expiring approval process. No service-role bypass is permitted.
3. Verify the newly assigned retailer/mapping/offer IDs and the exact one-row
   delta. Products, variants, categories and canonical GTINs must remain
   unchanged. Stop on any unexpected delta; do not improvise recovery.
4. Re-read the remaining 19 source variants and canonical bindings. Generate a
   new remaining-19 CSV and dry-run artifact against the actual existing
   retailer ID. Expect retailer action `existing`, zero retailer/product/variant
   creates, and exactly 19 mapping/offer/history creates. Preserve all reviewed
   identities and GBP 3.99 shipping.
5. Review the new artifact and fingerprints before any remaining-row approval.
   Follow the existing protected per-plan approval and atomic execution process;
   do not reuse the original retailer-create plans or approval IDs.
6. Independently verify final deltas: retailer +1, mappings/offers/history +20
   each; products/variants/categories/canonical GTIN changes zero. Repeat a
   fresh exact-20 dry-run for idempotency, and check public offer presentation
   and delivered prices before recording any live completion.

The bootstrap result and remaining-19 artifact cannot exist before a separately
authorised production step. This is an expected sequencing boundary, not a
reason to weaken the current guards. No bootstrap, approval submission, apply,
retailer creation or schedule registration has occurred. Later price/stock
automation must reuse existing guarded patterns under its own reviewed scope.

## Post-catalogue importer cleanup backlog

The owner requested that catalogue coverage be completed before this cleanup.
Keep the following work together as one shared importer change rather than
adding retailer-specific exceptions:

- compare equivalent database and artifact scalars consistently, including the
  integer `1` and serialized text `"1"`, while retaining exact semantic checks;
- resume a partially completed reviewed package at the first unapplied row and
  reject replay of already completed rows;
- generate a fresh remainder package automatically after a guarded stop;
- keep one reviewed-manifest path across source formats and source identifier
  shapes; and
- add regression tests for partial success, safe resume, scalar serialization,
  approval consumption and strict final readback.

Do this before 10 Reps automated refresh registration. The cleanup must retain
single-use approvals, protected roles, per-plan atomic apply, canonical identity
guards and fail-closed production readback.
