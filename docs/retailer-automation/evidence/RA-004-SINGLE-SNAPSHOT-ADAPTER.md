# RA-004 10 Reps test-only single-snapshot replay adapter

**Status:** `READY_FOR_REVERIFICATION`

**RA-004:** `IN_PROGRESS`

**Control-state interface:** `VERIFIED_COMPLETE`

**Shadow run:** `NOT_AUTHORIZED`

This evidence covers only a local synthetic-fixture replay. It authorizes no
live feed read, secret read, capture, database, control-state export, staging,
workflow dispatch, approval, apply, Review Queue publication or shadow run.

## Verification blockers and corrections

Independent verification of PR #90 found four material blockers. They remain
recorded here rather than being hidden by the corrected result:

1. both branches used `projectCsvRows()`;
2. the tracked CSV had no checkout-stable LF attribute;
3. native values, run-level fields and counters were outside the comparator;
4. source-read accounting was synthetic and HTTP, DNS, workflow-dispatch and
   secret-loader capabilities were absent.

Regression tests reproduced all four failures before implementation changed.
The corrected tests fail closed if any condition returns.

## Split point and independent call graphs

The adapter owns the one controlled local read:

```text
fixture path -> source capability readOnce() -> immutable raw bytes
                                      |-> defensive copy A
                                      `-> defensive copy B
```

Legacy branch:

```text
copy A -> projectCsvRows -> existing 10 Reps profile/policy
       -> classifyExistingOffers -> legacy normalization
```

Canonical branch:

```text
copy B -> ra004-10reps-canonical-connector
       -> independent 17-column validation and field mapping
       -> canonical contract v1 -> zero-write harness
       -> canonical normalization
```

Only neutral `csv-parse/sync`, hashing/stable JSON and canonical contract
primitives are shared. The canonical connector does not import or receive
`projectCsvRows`, legacy evidence rows, the legacy classifier, compatibility
output or legacy-normalized price, stock, identity, URL or timestamp. A static
test scans the connector and its adapter wiring for those forbidden
dependencies. No production entry point, workflow or scheduler imports it.

The connector independently validates the exact 17 headers, numeric product
and variant IDs, duplicate identity, same-origin HTTPS URL and UTC timestamp.
It parses price to minor units, fixes currency to the approved GBP source
contract, maps stock and maps product ID, variant ID, SKU and EAN into canonical
v1 inputs. The existing production reader, projector, `buildRun()` and retailer
profiles are unchanged.

## Real one-read boundary

`readOnce()` performs the actual `fs.readFileSync` and increments
`source_read_count` only after that read succeeds. A second call increments the
attempt counter but throws `RA004_SOURCE_READ_COUNT` before a second read.
Neither branch receives a path. Both receive only defensive Buffer copies; all
three byte fingerprints are checked after both paths complete. A mutation test
changes the canonical copy after parsing and proves acceptance fails with
`RA004_FINGERPRINT_CHANGED_DURING_RUN`.

Accepted counters are closed to exactly these fields:

```text
source_read_attempt_count: 1       source_read_count: 1
refetch_attempt/performed: 0/0     network_attempt/performed: 0/0
http_attempt/performed: 0/0        dns_attempt/performed: 0/0
database_attempt/performed: 0/0    file_write_attempt/performed: 0/0
control_plan_attempt/performed: 0/0
approval_attempt/performed: 0/0    apply_attempt/performed: 0/0
review_queue_publish_attempt/performed: 0/0
workflow_dispatch_attempt/performed: 0/0
secret_loader_attempt/performed: 0/0
```

Every denied capability has an individual negative test, counter and error
code; every performed counter remains zero. Static/runtime dependency tests
exclude fetch clients, `http`, `https`, `net`, `tls`, `dns`, `undici`,
PostgreSQL/Supabase clients, writers, workflow dispatchers, secret loaders and
`TEN_REPS_FEED_URL`. The only permitted I/O is the controlled fixture read.

## LF contract and static goldens

All tracked `scripts/test-fixtures/**/*.csv` blobs were audited: one file, text,
LF, no CR bytes. `.gitattributes` now contains only the scoped rule:

```text
/scripts/test-fixtures/**/*.csv text eol=lf
```

The golden file is
`scripts/test-fixtures/retailer-automation/ra004-10reps-goldens.json`. Tests do
not derive expectations from checkout bytes. Frozen values are:

- raw LF: `3a7058db829c0277f681be470bec5e13a8d8b36c37c561e1cc92c2f0db01768c`;
- intentional in-memory CRLF:
  `213edf54809679be4326aa774ffa64ea9bae6c41fea38a672d0ca85d6e789b81`;
- legacy output:
  `d8d23f5a87e65ff98d1d42c6499a6e4add8270e52e122c8ea7ac2202f8ec1d2d`;
- canonical output:
  `23f2f5a7d4f2ef3a1dd225c91b0abeeaa9270880725f25b04341fef9096d806a`;
- complete parity report:
  `4c82cac23f0f0051392fb51889bce3a8329cdcb46623a780e90b04fc609fb70a`.

The golden also pins each side's native action, ordered reason-code array,
native record fingerprint and normalized record fingerprint for all nine
identities. Native representations intentionally differ because legacy emits
offer-sync actions plus RA-003 compatibility reasons, while canonical emits
canonical classifications/taxonomy. Neither representation is ignored.

## Closed parity contract and mutations

The 37-field row contract includes source/raw linkage, all identities, SKU,
GTIN, descriptive fields, URL, minor-unit price, currency, stock/availability,
provenance, source presence/state, change and review classifications, reason
semantics, blocking/run semantics, alert/next action, authorization/execution
flags, native action, native reason codes and both native/normalized record
fingerprints.

The report comparator also seals the complete top-level key set, snapshot and
source fingerprints, legacy and canonical output fingerprints, true native run
states, row counts/set, all difference counts, every capability counter and the
report fingerprint. It recomputes report integrity and rejects missing or new
fields. `EXACT_PARITY` requires all comparable fields equal, every side-specific
native golden matched, nine identical identities, zero non-exact classes,
exactly one source read and zero other attempts/performed effects.

Mutation tests cover every row field plus native reason codes, native and
normalized fingerprints, `canonical.run_outcome`, every capability counter,
missing and extra fields, missing and extra records, raw bytes and report
integrity. Each becomes `UNEXPLAINED_DIFFERENCE` or throws before acceptance.

## Fixture and scenario result

The synthetic fixture contains exactly eight source rows and 17 headers. The
fixed state contains nine mappings; variant `2009` is deliberately absent.
There are no live values, secrets or protected CSV copies.

All 16 required scenario families pass: no change, price change, stock change,
`SOURCE_MISSING`, no automatic OOS, identity conflict, invalid price, unknown
stock, missing ID, duplicate identity, mixed batch, per-row isolation, empty
CSV, missing/reordered header, HTML/content-type drift and deterministic replay.

The valid snapshot produces nine independently compared records:

- `2001`, `2004`-`2008`: `NO_CHANGE`;
- `2002`: `PRICE_CHANGE`, still `NOT_AUTHORIZED`;
- `2003`: `STOCK_CHANGE`, still `NOT_AUTHORIZED`;
- `2009`: `SOURCE_MISSING` / row review, never `OUT_OF_STOCK`.

Result: 9 `EXACT_PARITY`, zero in every other difference class and zero
unclassified records. There is no percentage difference budget. LF and CRLF
retain identical record semantics while retaining different raw fingerprints;
repeat runs, reversed state-key order and timezone changes are deterministic.

## Controls and authorization

Focused adapter/canonical/refactor/profile tests pass with no skip. The complete
repository gates and final clean-checkout LF proof are recorded in the PR commit
and CI evidence. No package, lockfile, workflow, scheduler, migration or
production behavior changed.

RA-004 remains `IN_PROGRESS`; the control-state interface remains
`VERIFIED_COMPLETE`; the corrected adapter is `READY_FOR_REVERIFICATION`; the
shadow run and every live/staging action remain `NOT_AUTHORIZED`. The next task
is a new independent verification of Draft PR #90.
