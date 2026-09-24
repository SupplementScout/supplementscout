# RA-004 — local control-state implementation

**Status:** `CONTROL-STATE INTERFACE VERIFIED_COMPLETE`

**Baseline:** `843ed987ff99a781ca04e16b2461a9eb4aa37b4e`

**Owner decision:** `OWNER_APPROVED FOR LOCAL IMPLEMENTATION`

**NO STAGING MIGRATION AUTHORIZED**

**NO PRODUCTION MIGRATION AUTHORIZED**

**NO LIVE CREDENTIAL AUTHORIZED**

**LIVE SHADOW RUN NOT AUTHORIZED**

## Approved scope and prepared implementation

On 24 September 2026 Marek approved: one versioned transactional
`read_retailer_control_state_v1(...)` RPC with a minimal shared append-only
evidence ledger; separate future staging and production credentials provisioned
outside Git; and migration execution/tests only on an isolated local database.

The prepared forward migration is
`supabase/migrations/20260924100000_add_transactional_retailer_control_state_interface.sql`.
It declares the shared `retailer_control_state_evidence_v1` table, insert-only
`write_retailer_control_state_evidence_v1(...)`, one `STABLE` read RPC, indexes,
forced RLS, ownership, explicit revokes/grants and four `NOLOGIN NOINHERIT`
group roles. It creates no login, password, token or secret.

Effective runtime boundaries are designed as follows:

- `retailer_control_state_exporter`: schema `USAGE` and `EXECUTE` only on the
  read RPC; no table, sequence, writer-RPC or role-membership grant.
- `retailer_control_state_evidence_writer`: schema `USAGE` and `EXECUTE` only
  on the evidence writer; no table, sequence, read-RPC or role-membership grant.
- dedicated read/evidence owners are `NOLOGIN`, non-superuser and
  `NOBYPASSRLS`; source-table `SELECT` belongs only to the read function owner.

The evidence registry is closed to `SESSION_STARTED`, `SESSION_HEARTBEAT`,
`SESSION_COMPLETED`, `SESSION_FAILED`, `LOCK_OBSERVED`, `LOCK_ACQUIRED`,
`LOCK_RENEWED`, `LOCK_RELEASED`, `LOCK_EXPIRED`, `POSTFLIGHT_COMPLETED`,
`POSTFLIGHT_FAILED`, `WATCHDOG_OBSERVED`, `GLOBAL_CONFLICT_OBSERVED`,
`SOURCE_OBSERVED` and `WORKFLOW_OBSERVED`. Metadata is bounded and rejects
secret and source-of-truth payload keys. Runtime roles have no update, delete
or truncate grant. Unique event and idempotency keys plus a payload-fingerprint
conflict check define idempotent replay.

The read signature is
`read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)`.
It is a single `STABLE SECURITY DEFINER` PostgreSQL statement with
`search_path=pg_catalog`, static fully-qualified reads, bounded record/byte
limits and all eleven logical sources. The live-provider contract accepts only
an injected transport exposing `callReadOnlyRpc`, calls only the allowlisted
RPC once, requires the future dedicated exporter identity and validates the
closed `control-state-export-v1` response. It is not wired into any runtime.

## Verification result

The final focused RA-002/003/004 suite passed 60/60 tests, including authorization,
credential-class rejection, unknown RPC, broad transport rejection, exactly one
read attempt, closed output schema, unknown schema version, zero mutation
attempts, all eleven fixture sources, deterministic output and no workflow or
scheduler wiring.

The previously failing deterministic-artifact set passed 29/29. Project
Guardian, TypeScript, ESLint, `git diff --check`, `verify:quick` and
`verify:full` passed; the quick gate reported 449 passed and three existing
explicit artifact-dependent skips. Baseline migration validation and the
Next.js production build passed. The sealed quality inventory contains 307
tests: 258 safe, 45 integration, four artifact-bound and 21 quick tests.

The LF audit covers 791 tracked deterministic files: five verified JSON files,
34 workflow YAML files, 159 retailer configuration/approval files, 279 rollout
artifacts, two feed CSVs, 229 migrations, 79 rollbacks and four tracked sealed
review fixtures under `tmp`. Every audited Git blob is LF; after worktree
normalization all 791 raw worktree hashes equal their index blob hashes, with
zero CRLF/mixed results and zero content diffs. JSON/YAML parsing and sealed
hash tests passed. The resulting `.gitattributes` rules are directory-scoped,
not global extension rules.

The RA-004 migration is SHA-bound and explicitly excluded from both STAGING and
PRODUCTION migration selectors. The selector suite passed 25/25 and proves the
migration is not pending or deployable without a separate reviewed change.

Docker Desktop 4.81.0 was started without installation, update or configuration
change. The test used the already-present official `postgres:17-alpine` image,
`--network none`, no published port and a database whose name began
`ra004_control_state_test_`. `inet_server_addr()` and `inet_server_port()` were
both `NULL`, proving a local Unix socket inside the isolated container. The
container and database were removed after every run.

The registered integration test passed 1/1 with zero skips. It applied the
repository baseline and forward migration on a fresh database, verified six
indexes, twelve policies, forced RLS, both RPC signatures and their dedicated
non-superuser owners, all four `NOLOGIN` roles, exporter timeout/read-only
settings and zero runtime sequence grants. It also proved fail-closed
missing-source, schema-drift and rerun behavior.
It covered all 15 event types, identical and conflicting replay, duplicate event
ID, concurrent idempotency, invalid type/scope/time/expiry/fingerprint/reason,
oversized/secret metadata, forbidden DML/DDL/GRANT/SET ROLE, unrelated reads,
PUBLIC revokes and `pg_temp`/`public` search-path hijacking.

Synthetic state covered all eleven sources, retailer isolation, global scope,
parent/child and equivalent plans, sessions, locks, approval/consumption,
recovery, apply, postflight, watchdog and global conflicts. Record/byte limits,
missing evidence, closed output schema, deterministic state fingerprint and
sorting passed. A two-connection `REPEATABLE READ` test changed a plan, session,
lock, approval and evidence event concurrently: both reads in the first snapshot
returned the old fingerprint and the next invocation returned the complete new
fingerprint.

The executed tests found and fixed three implementation defects: missing column
preflight for schema drift, `NULL` instead of `true` on idempotent replay, and a
race in concurrent replay. The writer now serializes only matching idempotency
keys with a transaction-scoped advisory lock.

No staging or
production connection, Supabase project, service role, credential, feed, live
export, shadow run, import, apply, workflow dispatch or producer wiring was
used. Postflight, watchdog, session and lock producers remain disconnected.

## Remaining authorization boundary and rollback plan

The local implementation blockers and independent review are closed. Staging
migration, production migration, live credentials, live export and the shadow
run remain unauthorized. Forward rollout rollback planning is: revoke runtime
EXECUTE first, stop any future evidence producers, retain the append-only rows
for audit, then remove functions/policies/roles/table only through a separately
reviewed forward migration. No rollback was executed.

## Independent verification — 24 September 2026

The verification used a new clean worktree at PR #89 head, independently of the
implementation worktree. The merge base was the recorded `origin/main`
baseline `843ed987ff99a781ca04e16b2461a9eb4aa37b4e`. Commit inspection confirmed
that the LF-policy commit changed only `.gitattributes`, while the local
interface implementation commit contained exactly its 17 declared files. The
full PR contained 22 files and no package, lockfile or workflow change.

A fresh byte-level audit covered 792 unique deterministic artifacts: 5 verified
JSON files, 34 workflow YAML files, 159 retailer configuration files, 279
rollout artifacts, 2 feed CSV files, 230 migrations, 79 rollback scripts and 4
sealed fixtures. Every raw worktree byte sequence produced its indexed Git blob
hash, every file had an independently calculated SHA-256 digest, and the audit
found zero CRLF, mixed-ending or byte mismatches. A trial
`git add --renormalize` produced no diff. The LF rules remain limited to the
listed semantic artifact paths.

Migration-path inspection found no merge, Vercel, package or workflow path that
applies the full migration directory. The repository's controlled selectors
exclude the new migration by exact SHA-256 in both staging and production, and
the 25 selector tests passed. No remote database was contacted.

The integration test passed on a fresh network-isolated PostgreSQL 17 container
and removed the container afterward. It reconfirmed the six indexes, twelve
forced-RLS policies, four `NOLOGIN NOINHERIT` non-superuser/non-`BYPASSRLS`
roles, least-privilege grants, fixed search paths, read-only exporter role,
append-only evidence writer, all 15 event types, all eleven exporter sources,
idempotency and fail-closed drift behavior. The two-connection snapshot proof
now covers both `REPEATABLE READ` consistency and ordinary `READ COMMITTED`
statement snapshots: after an atomic concurrent control-state transition, the
second read returned the complete new canonical fingerprint, never a mixed
third fingerprint.

Focused contract, incident and exporter tests passed 59/59, the database
integration test passed 1/1 with zero skips, and the selector tests passed
25/25. `verify:quick` passed with 452 tests (449 passed, 3 explicitly skipped),
and `verify:full` passed, including the production build. The three skips are
pre-existing artifact-presence cases and are not counted as passes. No staging
or production connection, secret, migration, live export, workflow dispatch or
shadow execution was used.

RA-004 remains `IN_PROGRESS`; the live single-snapshot adapter step remains
`NOT_STARTED`; the shadow manifest remains `NOT_AUTHORIZED`.
