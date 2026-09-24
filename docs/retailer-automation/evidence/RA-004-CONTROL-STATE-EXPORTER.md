# RA-004 — read-only control-state exporter

**Status:** `BLOCKED_PENDING_INTERFACE_APPROVAL`

**Baseline:** `843ed987ff99a781ca04e16b2461a9eb4aa37b4e`

**Branch:** `feat/retailer-control-state-exporter-ra-004`

**RA-004:** `IN_PROGRESS`

**LIVE SHADOW RUN NOT AUTHORIZED**

Checkpoint commit `ba3265e` preserves this fixture-only implementation in Draft
PR #89. The proposed database boundary is documented separately in
[`RA-004-CONTROL-STATE-INTERFACE-DESIGN.md`](RA-004-CONTROL-STATE-INTERFACE-DESIGN.md).
That proposal is design-only and does not add a migration, credential or live
provider.

The local exporter core, fixture provider, authorization gate, schemas, CLI and
regression suite are implemented. The exporter is not `READY_FOR_VERIFICATION`
because no existing approved interface can return the complete mandatory 10
Reps control state without direct SQL. Creating a new RPC or view is outside
this task. Live provider construction therefore fails closed before reading a
credential or opening a connection.

No live exporter, feed, shadow replay, SQL, database connection, migration,
control write, approval, apply, workflow dispatch or Review Queue publication
was used.

## Existing mechanism inventory

| Mechanism | File / symbol | Data and credential | Capability finding | Reuse decision / gap |
|---|---|---|---|---|
| Role session | `scripts/lib/retailer-offer-sync/production-role-session.js` / `withPostgresRoleSession()` | PostgreSQL validator/approver/executor login; optional `BEGIN READ ONLY` | Exposes the general `client.query()` capability and can open writer-role sessions | Not imported. It is not a source-bounded capability and would violate the no-raw-SQL boundary. |
| Whey state RPC | migration `20260724100000_add_approved_retailer_sync_registration.sql` / `read_retailer_offer_sync_approved_state()` | Dedicated validator role; stable security-definer RPC | Read-only implementation, but hard-coded to retailer 3 and returns catalogue rows plus aggregate control counts only | Evidence that a narrow validator RPC can be safe; cannot serve retailer 14 or export plan/session/lock/approval/recovery rows. |
| Plan status RPC | migration `20260717120000_create_retailer_catalogue_control_ledger.sql` / `get_retailer_catalogue_plan_status()` | Granted to `service_role` | Reads one already-known parent plan and its children/runs; credential can write elsewhere | Rejected: incomplete enumeration and forbidden service-role capability. |
| Shared postflight | `scripts/retailer-offer-refresh-postflight.js` / `capture()` | Production validator login, read-only transaction, direct static SQL | Reads scoped mappings, offers and price history only; module imports `pg` and general query capability | Not imported; useful output conventions only. It does not read the control ledger. |
| Watchdog DB evidence | `scripts/automation-reliability-watchdog.js` / `databaseEvidence()` | Production validator login with direct SQL | Reads offer freshness counts; GitHub evidence correlation is read-only | Not imported. It does not expose complete control state or stable source pagination. |
| Whey refresh reader | `scripts/whey-okay-offer-refresh.js` / `readState()` | Validator RPC call | Reads the Whey-only RPC above; later functions can register, approve and execute | Not imported. The module has mutation paths and cannot be a capability boundary. |
| Review worker | `scripts/automation-review-ebay-worker.js` / `loadControlState()` | Supabase service-role plus approver/executor credentials | Client can write checkpoints and execute reviewed plans | Rejected before use; service-role and mutation capabilities are forbidden. |
| Control ledger | `retailer_catalogue_parent_plans`, `retailer_catalogue_child_plans`, `retailer_catalogue_apply_runs` | Tables have RLS and broad grants revoked | Contains plan/apply state, but repository exposes no complete retailer/global enumeration RPC to the validator role | Mandatory source remains unavailable without a new approved read-only interface. |
| Existing tests/fakes | retailer refresh, postflight, watchdog, role-session and canonical harness tests | Local fakes only | Demonstrate injected clients, role checks, deterministic hashing and denied capabilities | Reused as design conventions; the new fixture provider has no network, DB or credential. |
| Canonical hashing/artifacts | `canonical-json.js`, retailer-snapshot fingerprints, tmp artifact conventions | Local files only | Deterministic key sorting and domain-separated SHA-256; no mutation authority | Reused for authorization, state and export fingerprints and write-once local output. |

No admin status endpoint, existing export script, Supabase client or approved RPC
was found that closes the missing mandatory scope. A read-only transaction is a
database safeguard, but a general SQL client is still a capability explicitly
forbidden by this task.

## Source registry

The executable registry is in
`scripts/lib/retailer-offer-sync/control-state-export-v1/schema.js`. Every
source is mandatory, cursor-paginated, deterministically sorted, checked before
and after capture, and filtered for retailer plus global/cross-retailer scope.

| Stable source | Objects and required scope | Approved read interface | Live status |
|---|---|---|---|
| `control_plans` | active, incomplete, expired, superseded and recovery parent plans; retailer/global scope | `fixture:control_plans` | unavailable for 10 Reps |
| `plan_items` | child/item manifests, parent links, executor/dependency groups | `fixture:plan_items` | unavailable for 10 Reps |
| `sessions` | open/closed sessions, heartbeat and multi-retailer scope | `fixture:sessions` | unavailable for 10 Reps |
| `locks` | active/expired/orphaned locks, owner session and shared executor scope | `fixture:locks` | unavailable for 10 Reps |
| `approval_contracts` | pending, unused, expired, consumed and revoked contracts | `fixture:approval_contracts` | unavailable for 10 Reps |
| `approval_consumption` | consumption/replay evidence | `fixture:approval_consumption` | unavailable for 10 Reps |
| `recovery_state` | incomplete recovery, rollback and resume state | `fixture:recovery_state` | unavailable for 10 Reps |
| `apply_ledger` | most recent and historical apply state | `fixture:apply_ledger` | unavailable for complete enumeration |
| `postflight_state` | latest correlated postflight | `fixture:postflight_state` | artifacts exist historically, no complete current interface |
| `watchdog_state` | latest correlated watchdog result | `fixture:watchdog_state` | GitHub artifacts exist, no single consistent database snapshot interface |
| `global_conflicts` | global plans/locks, shared workflow/executor/batch, cross-retailer approvals and fingerprint conflicts | `fixture:global_conflicts` | unavailable for 10 Reps |

The registry records `live_interface: null` and an explicit unavailable reason
for every source. The fixture interfaces are test mechanisms, not production
substitutes. Missing access yields `BLOCKED_INCOMPLETE_EXPORT`; marker drift
yields `BLOCKED_INCONSISTENT_SNAPSHOT`.

## Read-only capability boundary

The exporter accepts only three provider operations:

- `describe()`;
- `readConsistencyMarker(source)`;
- `readPage(source, { cursor, page_size })`.

Provider construction recursively inspects own and prototype methods. Any
unknown function or method matching insert, update, upsert, delete, mutation
RPC, raw query/SQL, transaction, creation, approval, apply, lock acquisition,
publication or write semantics is rejected before invocation. The descriptor
must declare no mutation capabilities and no service-role credential. Fixture
mode must declare credential type `NONE`. A future live provider would have to
prove a dedicated read-only validator identity and every source/RPC would have
to appear in the explicit allowlist. Because those interfaces do not currently
exist, live construction always returns `CONTROL_EXPORT_LIVE_PROVIDER_BLOCKED`.

The exporter dependency graph contains no `pg`, Supabase, network, production
executor, plan writer, approval writer, lock writer, Review Queue publisher or
production role-session import. Repository tests also prove that app code,
workflows, schedulers and retailer configuration do not import it.

## Authorization model

The closed authorization schema is
`scripts/lib/retailer-offer-sync/control-state-export-v1/schemas/control-state-export-authorization-v1.schema.json`.
It binds version, retailer ID/name, the exact eleven-source scope, baseline SHA,
task ID, validity window, `READ_ONLY_CONTROL_STATE_EXPORT`, every prohibited
operation, owner-consent state and a domain-separated SHA-256 fingerprint.

Fixture tests use only an in-memory/file-temporary `TEST_ONLY` authorization
with `TEST_ONLY_FIXTURE`. No active authorization file is tracked. Live mode
would require `AUTHORIZED` plus `OWNER_APPROVED`, but would still fail while
the live source registry is incomplete. The existing RA-004 shadow manifest is
`NOT_AUTHORIZED` and is explicitly rejected as exporter authority.

## Output schema v1 and assessment

The closed output schema is
`scripts/lib/retailer-offer-sync/control-state-export-v1/schemas/control-state-export-v1.schema.json`.
The runtime validator and assessment logic are in `schema.js` and
`exporter.js`. The report contains all requested metadata, complete redacted
source rows, categorized states, last apply/postflight/watchdog, overlap
conflicts, counts, page evidence, read/write/mutation counters, consistency
markers, canonical state fingerprint and export fingerprint.

`CLEAR_FOR_SEPARATE_SHADOW_AUTHORIZATION` means only that the complete export
contains no detected control blocker. It cannot authorize capture or shadow
execution. All other documented assessments fail closed.

## Pagination and consistency

- page size is exactly 100;
- every page records cursor input/output, page number, row count and total;
- repeated cursors, missing/out-of-order pages, total-count drift, duplicates
  and incomplete totals stop the export;
- a regression fixture uses 205 records and proves three-page coverage;
- every mandatory source receives a pre-read and post-read consistency marker;
- marker mismatch blocks with `BLOCKED_INCONSISTENT_SNAPSHOT`;
- no 1,000-row response is treated as complete without cursor/total proof.

This is the strongest safe fixture strategy available without adding a new
transactional RPC. It does not pretend that separate future live RPC calls are
one database snapshot.

## Redaction and local artifact

Sensitive keys and connection/token/password/Bearer patterns are redacted
before output. The artifact contains control identifiers only. CLI output is
restricted to `tmp/control-state-exports/`, which is ignored by Git. It uses a
same-volume temporary file, write-once hard-link publication, restrictive mode
where supported, refuses an existing artifact or digest path, and writes a
detached SHA-256 file. Canonical fingerprints use parsed objects, so CRLF and
object-key order do not affect them.

## CLI, fixtures and tests

Exporter library:
`scripts/lib/retailer-offer-sync/control-state-export-v1/exporter.js`

Fixture/live provider boundary:
`scripts/lib/retailer-offer-sync/control-state-export-v1/providers.js`

CLI:
`scripts/retailer-control-state-export.js`

Fixture:
`scripts/test-fixtures/retailer-control-state-export-v1/complete-clear.json`

Focused fixture command:

```text
node --test scripts/retailer-control-state-export.test.js
```

Illustrative future live command — **NOT AUTHORIZED and currently guaranteed to
fail closed**:

```text
node scripts/retailer-control-state-export.js --retailer-id=14 --retailer-name="10 Reps" --authorization=tmp/control-state-exports/OWNER-AUTHORIZATION.json --output=tmp/control-state-exports/10reps-control-state.json --baseline=<40-character-approved-main-sha> --provider-mode=live-read-only --provider-config=tmp/control-state-exports/APPROVED-READ-ONLY-PROVIDER.json
```

The test suite covers the 47 required behavioral cases plus schema, CLI,
source-registry and architecture-boundary checks. It uses only local fixtures
and fake read-only providers. No actual control-state artifact was created.

## Unresolved gap and decision

The code cannot meet the live Definition of Done without an existing approved
interface for all eleven sources. The repository currently offers only:

1. a Whey-only partial RPC;
2. one-plan status through a service-role grant;
3. direct SQL readers with a general query capability;
4. historical GitHub artifacts that are neither complete nor one consistent
   current snapshot.

All four are insufficient or forbidden. Therefore the original technical
blocker is narrowed and made executable/testable, but not removed. RA-004 stays
`IN_PROGRESS`; the control-state exporter gate is
`BLOCKED_PENDING_INTERFACE_APPROVAL`; the interface design is
`READY_FOR_OWNER_DECISION`; the single-snapshot adapter was not started; and the
shadow manifest remains `NOT_AUTHORIZED`.
