# RA-004 canonical ledger fingerprint contract

Status: `READY_FOR_VERIFICATION`.

This is a local implementation and verification artifact. It authorizes no
staging or production connection, SQL, migration, preflight, canary or retry.
The terminal failed staging attempt and its closeout evidence are unchanged.

## Exact cause

The selector used SHA-256 over `JSON.stringify(rows)`. That input was the raw
Supabase CLI row array, retained arrival order and had no algorithm identifier,
schema version, target environment, identifiers or logical ordinals. For the
reconstructed 97 rows its hash was:

`1692043d963e98570cd69ea2f46654c35f35a78f26c35b3d96e04751d528331c`

The applied PostgreSQL RPC already builds a deterministic document from
`version` and `name`, orders by those values, adds a one-based ordinal and hashes
its UTF-8 bytes. The exact same 97 rows produce:

`bbfc25a25826ebfd4901941099903921e1f5adeb9d952eb6aa93c64939e3849c`

The terminal closeout records `169204...` as the coordinator's post-migration
fingerprint. Because the RPC stops on mismatch and does not return its computed
value, the historical wording that attributes that value to PostgreSQL is not
supported by the executable SQL. This document corrects the diagnosis without
rewriting historical evidence or presenting the failed preflight as a pass.

## `RA004_LEDGER_V1`

The closed input projection is exactly `version` plus `name` for every row.
`version` is exactly 14 decimal digits. `name` is lowercase ASCII words joined
by underscores and excludes `.sql`. Nulls, missing values, duplicate versions
and unknown contract versions fail closed. `statements`, timestamps, timezone
data and every other CLI field are ignored.

Rows are sorted by unsigned UTF-8 byte order of `version`, then `name`. The
logical one-based ordinal is assigned after sorting. Input arrival order,
object-key order, whitespace and LF/CRLF therefore do not affect the result.
Changing version, name, row count or the resulting logical sequence does.

The canonical input is compact UTF-8 JSON with lexicographically ordered object
keys and this exact shape:

```json
{"migrations":[{"identifier":"<version>_<name>","name":"<name>","ordinal":1,"version":"<version>"}],"schema_version":1,"target_environment":"STAGING"}
```

The exact 97-row canonical input is 16,130 bytes. SHA-256 is emitted as 64
lowercase hexadecimal characters. The neutral fixture is
`scripts/test-fixtures/ra004-ledger-fingerprint-v1/staging-ledger-97.json`;
shared smaller vectors are in the adjacent `golden-vectors.json`.

## Reconstruction and independent database proof

The fixture is derived from the closed staging selector's applied migration set,
the repository migration inventory and the terminal closeout's confirmed head
`20260927103000_consolidate_ra004_supabase_ownership_interfaces`. It contains 97
unique rows, begins at `20260712211120_baseline_current_public_schema` and ends
at that consolidated migration. No row was inferred from a network read.

An isolated networkless PostgreSQL 17 database recreates the exact first 96
rows, applies the already reviewed consolidated migration locally, records row
97 and invokes the unchanged metadata RPC. PostgreSQL and Node.js both produce
`bbfc25...e3849c`. Q1-Q8 pass locally, the synthetic read-only control-state
canary passes, business-row counts are unchanged, direct DDL/DML/table/sequence
access is denied, cleanup is deterministic, and replay, schema drift, ledger
drift and unknown fingerprint-contract versions fail closed.

## Scope and safety

- One shared Node module is used by the selector, snapshot contract,
  coordinator and preflight authorization.
- The preflight authorization and bounded transport require the exact
  `RA004_LEDGER_V1` identifier; the existing seven-argument PostgreSQL RPC is
  unchanged because its SQL already implements V1.
- No applied migration is modified and no new migration is introduced.
- Historical activation fingerprints remain preserved for immutable manifest
  verification; executable comparisons use the canonical V1 values.
- STAGING and PRODUCTION selectors remain closed. There is no application,
  workflow, scheduler or production-runtime wiring.
- RA-004 remains `IN_PROGRESS`; shadow and retry remain unauthorized.

## Local verification

- Focused RA-002/RA-003/RA-004, selector and migration-contract tests: 272/272
  pass; the final fingerprint/preflight/selector subset is 117/117 pass.
- Networkless PostgreSQL 17 RA-004 suite: 6/6 pass. This includes exact ledger
  96 to 97 construction, the unchanged SQL fingerprint, local Q1-Q8, one
  synthetic read-only canary, privilege negatives, cleanup, replay and drift.
- `verify:project`, `verify:quick`, `verify:full`, TypeScript, ESLint, baseline
  migration validation, production build, local Markdown link validation,
  secret-pattern scan and `git diff --check`: pass. The sealed inventory is 317
  files: 266 safe, 47 integration and 4 artifact-bound.
- The full integration gate ran its first 30 files and reported 72/74 because
  the two documented Jon's and nutrition failures reproduced. The remaining 17
  files were then run explicitly. A transient concurrent-container startup
  failure passed alone; one additional `shared-parent-import-identity` rollback
  hash failure remained. That third failure reproduces identically on the clean
  baseline. None of those three tests, their fixtures, dependencies or
  migrations is changed by this branch. They are not reported as passes and no
  skip or quality-gate weakening was added.
- Dependency scan completed against the unchanged lockfile and reported six
  existing advisories: two moderate, three high and one critical. This PR does
  not alter `package.json`, `package-lock.json` or any dependency.
