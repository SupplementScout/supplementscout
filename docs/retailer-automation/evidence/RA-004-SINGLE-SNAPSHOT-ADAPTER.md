# RA-004 10 Reps test-only single-snapshot replay adapter

**Status:** `READY_FOR_VERIFICATION`

**RA-004:** `IN_PROGRESS`

**Control-state interface:** `VERIFIED_COMPLETE`

**Shadow run:** `NOT_AUTHORIZED`

This evidence covers a local synthetic-fixture replay only. It does not
authorize a live capture, database access, control-state export, migration,
approval, apply, Review Queue publication, workflow dispatch, shadow run,
Model B, auto-safe class or cutover.

## Existing path reused

The active production entry point remains
`.github/workflows/fit-house-offer-refresh.yml` ->
`RETAILER_REFRESH_PROFILE=10reps` -> `scripts/fit-house-offer-refresh.js`.
Its `buildRun()` and source-fetch lifecycle were not changed and have no test
hook, CLI switch or environment override.

The adapter reuses the active 10 Reps configuration, the existing
`classifyExistingOffers()` classifier and action contract, canonical contract
v1, `runZeroWriteHarness()`, and the RA-003 compatibility matrix and adapter.
It does not define a second status map.

The shared extraction moves the existing 17-column parsing/projection body
from `csv-product-feed-reader.js` into the pure
`csv-product-feed-projector.js`. The production reader calls that function
after its unchanged fetch checks. The projector imports only
`csv-parse/sync`; it has no fetch, HTTP, database, plan, approval, executor,
apply, queue, workflow or secret capability. A second pure extraction moves
the unchanged canonical JSON/hash helpers out of the Shopify fetcher so the
classifier's artifact fingerprint no longer acquires a network-capable
transitive dependency. Existing parser, classifier, Shopify and canonical
tests prove unchanged behavior.

## Snapshot contract and fixture inventory

`RA004_SINGLE_SNAPSHOT_V1` records retailer `14` / `10 Reps`, source type,
fixed capture ID `ra004-synthetic-fixture-001`, fixed UTC capture time,
content type, byte length, raw-byte SHA-256, two issued-copy hashes, exactly
one source read and fixture provenance. The adapter reads no file itself: its
test performs one local read and supplies a Buffer. Separate legacy and
canonical Buffer copies must retain the same SHA-256 before acceptance.

Committed inputs are small and synthetic:

- `ra004-10reps-single-snapshot.csv`: 8 rows and exactly the approved 17
  headers; SHA-256
  `3a7058db829c0277f681be470bec5e13a8d8b36c37c561e1cc92c2f0db01768c`;
- `ra004-10reps-state.json`: 9 existing synthetic mappings, including one
  expected identity absent from the source; SHA-256
  `c4f08738b53221218747850dd12de976797052f6ec5142672bb23d78764ababb`.

No live feed, `TEN_REPS_FEED_URL`, protected v8/v9/v10 data or owner-review
artifact was read or copied.

## Parity contract and scenario results

The comparison covers raw/source fingerprints, mapping/product/variant
identity, external IDs, SKU, GTIN, name, brand, variant, URL, minor units,
currency, stock/availability, source presence/state, classification,
execution state, run-outcome semantics, reasons, blocking scope, alert, next
action, provenance, authorization/apply flags and normalized record
fingerprints. Native legacy and canonical reason codes and record fingerprints
remain visible; normalization is explicitly tied to the RA-003 matrix, the
existing action contract and canonical taxonomy.

The approved six RA-004 difference classes are used without modification:
`EXACT_PARITY`, `SEMANTIC_PARITY`, `EXPECTED_IMPROVEMENT`,
`LEGACY_DEFECT_CONFIRMED`, `CANONICAL_DEFECT`, and
`UNEXPLAINED_DIFFERENCE`.

The primary replay produced 9 `EXACT_PARITY` rows and zero rows in every other
class. It contained no-change, normal price change, stock change and
`SOURCE_MISSING`. The price change remained `NOT_AUTHORIZED`. The missing row
was isolated as review evidence and never converted to `OUT_OF_STOCK`.

Negative scenarios cover identity conflict, invalid price, unknown stock,
missing identity, duplicate identity, mixed/per-row isolation, empty bytes,
header-only CSV, missing/reordered header, HTML/content-type drift, every
parity-field mutation, raw fingerprint drift, unclassified/additional/missing
records, second source read and every denied capability. Parser-level schema
or value corruption rejects the snapshot before either result is accepted;
row-level source absence is isolated without suppressing valid rows.

Repeated replay, reversed JSON key order and a different process timezone
produce the same report fingerprint. LF and CRLF have identical row semantics
but intentionally different raw-byte fingerprints.

## Fingerprints and zero-side-effect evidence

- legacy action manifest:
  `d8d23f5a87e65ff98d1d42c6499a6e4add8270e52e122c8ea7ac2202f8ec1d2d`;
- canonical output:
  `23f2f5a7d4f2ef3a1dd225c91b0abeeaa9270880725f25b04341fef9096d806a`;
- complete parity report:
  `3d6ef04a6446e189c0e857185d770e73a0bf9e3beda35bdca1b5ed3004932897`.

Accepted replay counters are exactly:

```text
source_read_count: 1
refetch_count: 0
network_attempt_count: 0
database_attempt_count: 0
write_attempt_count: 0
control_plan_attempt_count: 0
approval_attempt_count: 0
apply_attempt_count: 0
review_queue_publish_attempt_count: 0
```

Each prohibited capability increments only its own counter and throws a
distinct `RA004_*_DENIED` error before any effect. Static recursive dependency
inspection and runtime loading exclude network fetchers/HTTP clients,
Supabase/PostgreSQL, plan-capable validators, approvers, executors, apply
modules, Review Queue publishers, workflow dispatchers and secret loaders.
Production workflow inspection confirms it does not import the adapter. The
adapter is imported only by its RA-004 test.

## Known differences and actions not performed

Legacy actions/RA-003 profiles and canonical classifications have different
native representations, as do their native record fingerprints. They remain
in the report and are compared through the documented semantic contract; the
primary replay has no semantic or unexplained value difference. No
owner-approved `EXPECTED_IMPROVEMENT` or `LEGACY_DEFECT_CONFIRMED` is claimed.

There was no network request, database connection, SQL, adapter file write,
migration, live capture, control-state export, staging/production action,
approval, apply, queue publication, workflow/scheduler change or production
wiring. The machine shadow plan remains `NOT_AUTHORIZED`.

## Remaining owner decisions

RA004-B02 through RA004-B05 remain open: a separately authorized read-only
control-state export, record-count drift bounds, protected snapshot retention
rules, and an exact live capture/shadow window. The next task is independent
verification of the Draft PR; it is not a shadow run.

## Verification record

The adapter has 8 focused test cases covering 16 required scenario families
plus exhaustive field/capability mutations. The final local runs passed:

- focused adapter, active parser/classifier, RA-002 canonical, RA-003 incident
  and compatibility, and RA-004 fixture-only control-state tests;
- Project Guardian, TypeScript, ESLint, sealed 308-test inventory,
  `verify:quick` and `verify:full`;
- baseline migration validation (229 post-baseline migrations) and the Next.js
  16.2.9 production build (36 static pages generated);
- JSON, 17-column CSV, 34 workflow YAML files, local documentation links,
  secret scan, static/runtime dependency graph, `git diff --check`, package and
  lockfile integrity, workflow/scheduler integrity and original-checkout
  integrity.

Three existing safe-suite tests were skipped, not counted as passes:
`10 Reps v8 closed bootstrap`, `10 Reps v8 Time 4`, and `10 Reps v8
remaining`. They require intentionally untracked owner-review v8 artifacts and
are unrelated to this synthetic fixture. The four artifact-bound inventory
tests were not run by `verify:full`, by design; the sealed inventory reports
them separately and this change does not create their protected inputs.
