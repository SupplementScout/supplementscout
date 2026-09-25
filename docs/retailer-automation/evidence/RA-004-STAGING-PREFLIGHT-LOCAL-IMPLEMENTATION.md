# RA-004 staging preflight local implementation

**Status:** `VERIFIED_COMPLETE`

**RA-004:** `IN_PROGRESS`

**Baseline:** `509ffb51079855f628fdf3dd19996021dc0d2bb9`

**Decision fingerprint:** `b0cb6c6de75eace4e7d4d8705305eb90e6a975203438f23de7b745974e4ffdb8`

**STAGING AND PRODUCTION EXECUTION NOT AUTHORIZED**

This local-only implementation closes the technical interface gaps recorded by
the verified staging-preflight authorization pack. It does not close target
configuration gaps, authorize a connection, issue or use a credential, deploy a
migration, execute the preflight, start a canary, capture a feed, export live
state or authorize a shadow run.

## Architecture

The implementation has four closed layers:

1. A forward-only PostgreSQL migration creates a bounded metadata function and
   two dedicated `NOLOGIN NOINHERIT` roles.
2. A capability provider exposes only one project-identity read, one
   evidence-store metadata read, one exact metadata RPC and one combined
   revoke/close operation. It has no general fetch, URL, SQL, RPC-name, write,
   retry, secret-loader or workflow capability.
3. A fail-closed runner validates authorization and local immutable inputs
   before touching the provider, validates Q8 before Q1, performs one RPC,
   validates and redacts the result, seals local write-once evidence with the
   non-final `METADATA_CAPTURED_PENDING_REVOKE` status, reads it back, then
   revokes and closes access. Only the separate sealed revoke receipt proves a
   successful closeout, so a failed revoke cannot leave a false PASS artifact.
4. A standalone unwired CLI requires every target and fingerprint explicitly.
   The current authorization manifest is rejected before the first capability
   attempt because execution remains `NOT_AUTHORIZED` in that historical pack.
   A separately authorized follow-up now supplies the bounded live transport;
   see `RA-004-BOUNDED-LIVE-TRANSPORT.md`. Target activation and execution remain
   separate gates.

Canonical JSON and SHA-256 use the existing
`scripts/lib/stable-json-hash.js`; output redaction reuses the existing
control-state exporter's redactor. Evidence is allowed only under ignored
`tmp`, is created atomically with exclusive write semantics, has a detached
SHA-256, and is read back before closeout. A separate write-once revoke receipt
contains final capability counters.

## Migration, RPC and roles

- Migration:
  `supabase/migrations/20260925100000_add_ra004_staging_preflight_metadata_interface.sql`
- SHA-256:
  `9d6c1ea4df0bd86f84a4cb779a0824922f4e9bcc91681b734d5d18465a9e91be`
- Existing control-state migration remains byte-identical at
  `cfd7a93cb20845832b696183f5eb8a500f0474b4173829b85f6ac6bc73d4baaa`.
- RPC signature:
  `public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)`.

The arguments bind the staging environment, exact retailer name and slug,
expected ledger count and fingerprint, expected ephemeral session user and
response byte cap. They are necessary because an execution authorization must
bind the runtime target and current ledger; a zero-argument function could not
fail closed on unknown current values. The RPC is `STABLE`,
`SECURITY DEFINER`, uses `search_path=pg_catalog`, fully qualifies objects and
contains no dynamic SQL, DML, DDL or mutation RPC. It returns one versioned JSON
document and reads only Q2-Q7 in one PostgreSQL statement snapshot.

`ra004_staging_preflight_owner` owns the function and is `NOLOGIN NOINHERIT`
without superuser, database/role creation, replication or RLS bypass. It has
only schema usage, column-scoped `SELECT(id,name,slug)` on `public.retailers`,
column-scoped `SELECT(version,name)` on the migration ledger, and an RLS policy
restricted to the 10 Reps name/slug. `ra004_staging_preflight_caller` is also
`NOLOGIN NOINHERIT`, defaults to read-only transactions and has only schema
usage plus `EXECUTE` on the exact RPC. It has no table, column, sequence, DDL,
DML, mutation-RPC or operational-role membership. `PUBLIC`, service role,
validator, approver, executor and exporter roles have no execute grant.

No `LOGIN` role is created by the migration. The PostgreSQL integration test
creates one synthetic short-lived `NOINHERIT` login inside the disposable
container, grants only the exact RPC directly, proves all prohibited access is
denied, revokes that grant and proves effective access is gone. Container
deletion removes the synthetic login.

## Q1-Q8 coverage

| Query | Implementation | Execution status |
|---|---|---|
| Q1 project identity | One-shot `readProjectIdentity()` boundary with exact project and host allowlists | bounded attestation transport implemented in the separately reviewed follow-up; runtime value still required |
| Q2 retailer identity | RPC returns only `id`, `name`, `slug`, `match_count`; zero or two matches fail | locally implemented |
| Q3 migration ledger | RPC returns only target identity, match count, ordered count and canonical fingerprint; mismatch fails | locally implemented |
| Q4 objects | Closed prerequisite/target registry, maximum 32 | locally implemented |
| Q5 functions | Closed signatures, owners, security properties, search paths and definition digests, maximum 8 | locally implemented |
| Q6 roles | Closed attributes and membership/`SET ROLE` edges, maximum 24 | locally implemented |
| Q7 ACL/RLS | Closed function ACL and RA-004 policies, maximum 64; broad grants fail | locally implemented |
| Q8 evidence store | One-shot `readEvidenceStoreMetadata()` boundary validated before database access | bounded attestation transport implemented in the separately reviewed follow-up; runtime store proof still required |

The still-open runtime inputs are the current approved staging project
reference, canonical host allowlist, signed project-identity source, unique
staging retailer identity, current ledger authorization, named operator and
credential issuer, exact UTC window, approved private evidence store, a
separate staging-only ephemeral credential and separate execution/deployment
authorization. Repository literals and `.invalid` fixtures are never accepted
as proof of those real values.

## Schemas, counters and CLI

Six closed versioned JSON schemas cover execution authorization, project
identity, metadata output, evidence-store metadata, final report and revoke
receipt. Runtime validators reject unknown root and nested fields, malformed
SHA-256 values, non-UTC timestamps, windows over 30 minutes, multiple retailers,
secret-shaped keys or values, local/private/URL-shaped hosts, unbounded strings,
unsafe numbers, policy-expression drift and incomplete or forged counters. Q1
and Q8 metadata fingerprints are recomputed rather than trusted.

Every capability records `attempt_count`, `performed_count` and `denied_count`
independently for project identity, evidence store, database connection,
metadata RPC, revoke, close, retry and prohibited operations. The positive
fixture path proves exactly one performed read or call for each allowed
capability, one revoke and one close, with zero retry and prohibited attempts.
Second reads, connections or RPCs fail closed and increment denied counters.

The CLI is `scripts/ra004-staging-preflight.js`. It has no default environment,
secret loader or implicit live construction. The separately reviewed transport
is injected programmatically only after authorization. A safe synthetic
shape is:

```text
node scripts/ra004-staging-preflight.js --authorization=<synthetic-json-below-tmp> --output=tmp/ra004-preflight/report.json --baseline=<40-hex> --decision-fingerprint=<64-hex> --plan-fingerprint=<64-hex> --control-migration-sha=<64-hex> --preflight-migration-sha=<64-hex> --project-reference=ra004-local-synthetic --canonical-host=ra004-local.invalid --host-allowlist=ra004-local.invalid --retailer-name="10 Reps" --retailer-slug=10-reps --provider-mode=fixture --fixture=scripts/test-fixtures/ra004-staging-preflight-v1/complete-synthetic.json
```

This example is test-only and contains no real endpoint, project, credential or
secret. Live mode without a separately injected approved Q1/Q8 transport stops
as `BLOCKED_TARGET_CONFIGURATION`.

## Local verification evidence

- `node --test scripts/ra004-staging-preflight.test.js`: 52/52 PASS. It covers
  the current manifest pre-capability stop, authorization, fingerprint, target,
  window and credential failures, all closed capability boundaries, schema and
  secret rejection, write-once/readback/revoke behavior, deterministic
  fingerprints, LF/CRLF, key order, UTC enforcement, CLI and complete counters.
- `node --test scripts/ra004-staging-preflight.integration.test.js`: 1/1 PASS
  against PostgreSQL 17 in a fresh random `ra-004-preflight-*` container with
  `--network none`, no published ports and `inet_server_addr()` and port both
  null. The test applies the repository baseline, synthetic prerequisites, the
  existing control-state migration and the new migration, then removes the
  container.
- The database test proves exact signature and ownership, safe role attributes,
  revoked `PUBLIC`, exact execute-only login access, denial of tables,
  sequences, DML, DDL, mutation RPC and `SET ROLE`, search-path and `pg_temp`
  hijack resistance, absence of dynamic SQL and mutations, unique, missing and
  duplicate retailer behavior, staging-only target, exact ledger, object,
  function, role, membership, grant, RLS and policy drift stops, byte cap,
  closed schema, deterministic snapshots, metadata-only output and post-revoke
  denial.
- The new migration is a SHA-bound local exclusion in both STAGING and
  PRODUCTION selectors and is not pending or deployable. Unknown environments,
  changed excluded bytes and ledger drift retain their existing fail-closed
  selector tests.
- Repository dependency search finds no import from the application,
  workflows, schedulers, retailer connectors, importers, executors, approvers,
  Review Queue, postflight or watchdog.

Final repository-wide quality-gate results are recorded in the Draft PR after
fresh execution. This document is local implementation evidence, not staging,
production or live evidence.

Independent verification used a new detached worktree, a separate `npm ci` and
fresh random PostgreSQL 17 containers. It corrected seven bounded defect groups:
local/private and URL-shaped targets; incomplete nested Q4-Q7 runtime checks;
unbounded schema fields and counters; unverified Q1/Q8 fingerprints; incomplete
owner/policy/overload drift checks; path-link and error-secret leakage; and a
pre-revoke report that could otherwise appear final. The corrected migration
has SHA-256
`9d6c1ea4df0bd86f84a4cb779a0824922f4e9bcc91681b734d5d18465a9e91be`.

## Authorization boundary and next step

RA-004 remains `IN_PROGRESS`. Local interface implementation is
`VERIFIED_COMPLETE`. Staging connection, control-plane or database reads,
credential issuance or use, preflight execution, migration application, canary,
production, live export, feed capture, workflow dispatch, shadow run, control
plan, approval, import, apply, Model B and cutover remain `NOT_AUTHORIZED`.
Auto-safe classes remain `NONE_APPROVED`.

The only next task is to prepare one concrete future activation record with
actual project, host, operator, issuer, window and evidence-store values. That
future task must not connect or execute as part of this closeout.
