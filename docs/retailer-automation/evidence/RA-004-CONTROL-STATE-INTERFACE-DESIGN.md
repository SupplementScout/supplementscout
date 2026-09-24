# RA-004 — transactional control-state interface design

**Status:** `OWNER_APPROVED FOR LOCAL IMPLEMENTATION` — `CONTROL-STATE LOCAL IMPLEMENTATION READY_FOR_VERIFICATION`

**Baseline and current `origin/main`:** `843ed987ff99a781ca04e16b2461a9eb4aa37b4e`

**OWNER DECISIONS APPROVED 24 SEPTEMBER 2026**

**LOCAL MIGRATION IMPLEMENTATION ONLY; NO STAGING OR PRODUCTION MIGRATION AUTHORIZED**

**NO LIVE CREDENTIAL AUTHORIZED**

**LIVE SHADOW RUN NOT AUTHORIZED**

This document records the design basis for the missing read boundary of the
fixture-only `control-state-export-v1` exporter. The later owner decision below
authorized a local migration implementation, but not any login, secret, remote
migration or live execution. The later implementation was exercised only on an
isolated local Docker PostgreSQL with networking disabled.

Marek approved one versioned transactional
`read_retailer_control_state_v1(...)` RPC plus one minimal shared append-only
evidence ledger, separate future staging/production credentials outside Git,
and implementation/testing only on an isolated local database. The forward
migration and unwired provider contract are prepared locally. The essential
database, privilege, idempotency, eleven-source and transactional snapshot tests
passed; the overall status remains blocked solely by the repository full gate.

## Repository finding

The eleven logical exporter sources are not eleven database tables. The durable
control plane is concentrated in parent plans, child plans, apply runs, several
approval ledgers and recovery ledgers. A `STARTED` apply run is the closest
durable session record. Transaction advisory locks and uniqueness indexes are
the current locking mechanism; there is no durable lock or heartbeat table.
Postflight and watchdog results are JSON/GitHub artifacts and are not stored in
the same database snapshot. Consequently, a read RPC over today's tables alone
cannot truthfully produce a complete eleven-source export.

The minimum complete design is therefore one bounded read RPC over the current
ledgers plus one narrow append-only evidence ledger for the logical records that
do not currently exist durably. Introducing that ledger and its separately
reviewed ingestion path is a prerequisite, not an authorization supplied by this
document.

## Map of the eleven logical sources

| Logical source | Physical source and creating migration | Key, scope and relations | State, time and fingerprints | Indexes and security | Completeness, concurrency and redaction |
|---|---|---|---|---|---|
| `control_plans` | `public.retailer_catalogue_parent_plans`; `20260717120000_create_retailer_catalogue_control_ledger.sql`, production enablement in `20260719100000_add_production_retailer_sync_enablement.sql` | PK `id`; `retailer_id`; no explicit global scope; parent of children and runs | `status`; source/canonical/adapter/policy/expected-state/parent fingerprints; capture, approval, consumption, create/update timestamps | unique active `(retailer_id,target_environment,source_snapshot_fingerprint)` and status/expiry index; forced RLS; table grants revoked | Complete for parent plans, but shared/global meaning is embedded in JSON/fingerprint/dependency metadata. Rows can change during capture. Export only closed control fields; redact actor text and free-form JSON by allowlist. |
| `plan_items` | `public.retailer_catalogue_child_plans` plus parent `child_manifest`/child `plan_json`; same migrations | PK `id`; FK `parent_plan_id`; `retailer_id`; batch/dependency/rollback groups | child/parent/source/canonical/adapter/policy/expected-state fingerprints; status and approval/rollback/create/update times | unique `(parent_plan_id,batch_index)`, child status index; forced RLS; grants revoked | Complete for registered child plans. Manifest JSON may contain commercial details and must be projected, not returned wholesale. Mutable status requires one snapshot. |
| `sessions` | No session table. Closest durable record is `retailer_catalogue_apply_runs` with `status='STARTED'`; workflow job/session heartbeat is external | Run PK `id`, FKs to parent/child, retailer scope | `started_by`, `started_at`, `updated_at`, `completed_at`, run fingerprints | one-active-run partial unique index; forced RLS | Incomplete: no heartbeat or durable workflow session identity. Future append-only evidence ledger must record `SESSION_OPEN`, heartbeat and terminal observations. Until present/current, export fails closed. |
| `locks` | No durable lock table. `pg_advisory_xact_lock` calls and partial unique indexes enforce transient/exclusion locks | Lock keys are hashes of parent, child, retailer/environment or approval identity; not queryable as historical control records | No durable status, owner, expiry or heartbeat fields | transaction advisory locks plus active-parent/run/approval unique indexes | Incomplete. Future evidence ledger records bounded logical lock acquisition/heartbeat/release observations; RPC also derives uniqueness conflicts. Missing current lock evidence blocks completeness. |
| `approval_contracts` | Parent/child approval columns; `public.retailer_offer_sync_batch_approvals`; `approved_import_plans`; production fixture/recovery approval tables; reviewed mixed-change definitions/bindings | UUID or authorization keys; joins through child/parent/retailer and recovery manifest | approved/expires/consumed times, status/result and artifact/execution/package/review fingerprints | expiry/artifact and active-approval indexes; forced RLS; grants revoked | Distributed but readable without mutation through a definer RPC. `REVOKED` is not a uniform persisted state; it must be derived only from explicit audit evidence, never inferred from expiry. Payloads require strict projection. |
| `approval_consumption` | `approval_consumed_at`, `consumed_at`, `status`, `result`, reviewed binding status, and recovery audit | Approval IDs join to parent, child, batch or recovery manifest | consumption timestamps and result fingerprints | same approval indexes and RLS | Complete for persisted approvals when all ledgers are unioned. Concurrent consumption requires the same statement snapshot. Result JSON is redacted/projected. |
| `recovery_state` | `retailer_catalogue_production_recovery_manifests`, `_recovery_approvals`, `_recovery_audit`; child rollback fields and apply runs with `run_type='ROLLBACK'`; production tables created by `20260719100000_add_production_retailer_sync_enablement.sql` | Manifest PK and unique child/apply-run FKs; approvals/audit reference manifest | READY/RECOVERED/FAILED, created/recovered/approved/expires/consumed timestamps and rollback/execution/state fingerprints | active recovery approval index; forced RLS; grants revoked | Complete for production recovery ledgers. Large before-state/archived JSON must not be returned; emit identifiers, counts, hashes and state only. |
| `apply_ledger` | `public.retailer_catalogue_apply_runs`; control ledger migration | PK `id`; FKs parent/child; `retailer_id`; APPLY/ROLLBACK | STARTED/SUCCEEDED/FAILED/ROLLED_BACK, start/complete/update times and full control fingerprint set | unique attempt and one-active-run indexes; forced RLS | Complete for ledgered apply attempts. Project `result_metadata`; do not expose arbitrary actor/error detail. |
| `postflight_state` | Today: local/GitHub JSON emitted by `scripts/retailer-offer-refresh-postflight.js`; no DB table | Artifact correlates retailer, plan/run and scoped offer/history evidence | completion time and artifact/state fingerprints in artifact only | no transactional DB index/RLS/grant | Incomplete in the database. Future evidence ledger stores a redacted, hash-bound terminal `POSTFLIGHT` observation. It must correlate to the latest run or the RPC fails closed. |
| `watchdog_state` | Today: `scripts/automation-reliability-watchdog.js`, `config/automation-reliability-watchdog.json` and GitHub artifact; no DB table | Retailer result plus workflow/artifact correlation | completed time, closeout snapshot SHA and result in artifact only | no transactional DB index/RLS/grant | Incomplete in the database. Future evidence ledger stores the redacted terminal `WATCHDOG` observation. Static config remains policy input, not database truth. |
| `global_conflicts` | Derived from all parent/child/apply/approval/recovery rows, dependency/rollback groups, workflow/batch/source fingerprints and future evidence rows | No single PK/table; conflict ID is a deterministic hash of reason and sorted source references | status/times/fingerprints of contributing records | existing indexes are only partial support; a future `(retailer_id,status,updated_at)` parent index and evidence scope index should be justified by local `EXPLAIN` before addition | Current tables can derive many cross-retailer conflicts, but global scope is not first-class and external shared workflow/lock evidence is absent. The evidence ledger supplies explicit `GLOBAL_CONFLICT` observations; omission blocks. |

### Supporting physical structures

The proposed append-only table is named
`public.retailer_control_state_evidence_v1`. Its rows are not a replacement for
the existing ledgers. It stores only missing durable observations with:
`id`, `logical_source`, `record_id`, `retailer_ids`, `scope_kind`, `status`,
`source_reference`, `correlation_fingerprint`, `payload_redacted`, `observed_at`,
`heartbeat_at`, `expires_at`, `completed_at`, `evidence_fingerprint`, and
`created_at`. `logical_source` is restricted to `SESSION`, `LOCK`, `POSTFLIGHT`,
`WATCHDOG`, and `GLOBAL_CONFLICT`. Every lifecycle change is a new immutable row;
updates and deletes are denied. A latest-observation query is deterministic by
`observed_at`, `created_at`, then `id`.

Required indexes are a unique evidence fingerprint, `(logical_source,record_id,
observed_at desc,created_at desc,id desc)`, and a GIN or normalized join strategy
for `retailer_ids`. The exact choice must be proven with local `EXPLAIN`; no index
is authorized here.

## Existing roles and credentials

| Role / connection | Repository evidence and capability | Write/escalation risk | Exporter decision |
|---|---|---|---|
| `retailer_catalogue_production_validator` through `supplementscout_production_validator_login` and `JONS_SYNC_VALIDATOR_DATABASE_URL` aliases | NOLOGIN/NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION initially; later `BYPASSRLS`; SELECT on catalogue tables; EXECUTE on validators and later registration functions. Direct PostgreSQL clients use `BEGIN READ ONLY` and `SET LOCAL ROLE`. | Credential can reach general `query()` and the group role has control-plan registration EXECUTE, so its effective capability is not read-only. `BYPASSRLS` broadens reads. | Reject for exporter. Postflight and watchdog reuse it, but naming and read-only transactions do not remove its granted mutation RPCs. |
| `retailer_catalogue_production_approver` / approver login | Dedicated direct PostgreSQL secret; EXECUTE on approval and recovery approval functions | Creates/extends approvals and control state | Reject. |
| `retailer_catalogue_production_executor` / executor login | Dedicated direct PostgreSQL secret; EXECUTE on apply and recovery functions | Business and control writes | Reject. |
| Staging validator/approver/executor | Equivalent staging group roles and externally provisioned logins | Same class of registration/approval/execution authority in staging | Reject for exporter; also out of scope for this design run. |
| Postflight tools | Direct PostgreSQL validator URL, general `pg.Client`, `BEGIN READ ONLY` | Transaction is read-only, but credential and client surface remain broader than one approved source | Do not reuse as exporter boundary. Preserve as evidence producer pending separate design. |
| Watchdog | `AUTOMATION_WATCHDOG_VALIDATOR_DATABASE_URL` aliases the validator secret | Same broad validator credential; GitHub artifact output is external | Do not reuse as exporter credential. Preserve as evidence producer pending separate design. |
| Read-only admin scripts | Mixture of validator direct connections and injected fake clients | General SQL capability; scope varies | Not an approved reusable provider. |
| Supabase REST `service_role` | Backend key bypasses RLS and is used by admin/review paths | Broad reads and writes, mutation RPC execution | Explicitly forbidden. |
| `anon` / `authenticated` | Supabase REST roles; control tables and functions generally revoked | Public/user surface and unrelated data policies | Not suitable. |
| GitHub Environments | Secrets map many retailer-specific environment variables to the shared validator/approver/executor URLs | Environment approval controls secret release, but not database privilege breadth | Use later only to hold a new dedicated exporter login secret; never reuse the three current secrets. |

Login passwords are provisioned outside tracked migrations; only login names and
secret variable names appear in the repository. No credential value was read.

## Options considered

| Option | Coverage and snapshot | Security and pagination | Testing, rollback and cost | Decision |
|---|---|---|---|---|
| **A. One versioned bounded RPC plus the minimal evidence ledger** | The RPC statically reads all durable ledgers and the missing-observation ledger in one PostgreSQL statement snapshot. It covers all eleven sources, including cross-retailer rows and external evidence after ingestion. | Purpose-specific SECURITY DEFINER owner with SELECT-only table access and no login; caller has EXECUTE only. No raw SQL operationally. No pagination: strict record/byte caps produce all-or-error. Static allowlisted projection performs redaction. | Local migration tests can prove ACLs, one-snapshot behavior and schema output. Rollback is revoke EXECUTE/disable login; preserve append-only evidence. Medium implementation cost and small, explicit ingestion impact. | **Recommended.** Smallest option that can truthfully meet completeness and transactional consistency. |
| B. Dedicated role with several direct SELECTs in `REPEATABLE READ READ ONLY` | Can cover DB ledgers in one held transaction but still needs the missing evidence ledger. | Requires a general SQL client, table SELECT grants, careful transaction lifetime and cursor handling. RLS/BYPASSRLS and accidental query expansion risks are materially higher. | More integration and privilege tests; rollback grants/role. Medium-high operational cost. | Reject: violates the preferred no-direct-SQL operational boundary and exposes more capability. |
| C. Existing validator/admin readers and GitHub artifacts | Partial database state plus separately timed artifacts; no common snapshot and incomplete enumeration. | Existing validator has `BYPASSRLS`, direct SQL and registration RPC authority; service role is broader still. Pagination and correlation are fragmented. | Lowest coding cost but cannot prove completeness or consistency; rollback does not cure capability risk. | Reject: cannot satisfy the contract. |

## Recommended interface contract

Future name and signature:

```text
public.read_retailer_control_state_v1(
  p_retailer_id bigint,
  p_retailer_name text,
  p_baseline_sha text,
  p_authorization_fingerprint text,
  p_authorization_valid_until timestamptz,
  p_required_sources text[],
  p_max_records integer,
  p_max_bytes integer
) returns jsonb
```

The schema version is `control-state-export-v1`. The only accepted source array
is the exact sorted eleven-name registry already tracked by the exporter.
Retailer ID/name must match `public.retailers`, baseline must be 40 lowercase hex,
authorization fingerprint must be 64 lowercase hex, and validity must be current
but no more than 30 minutes ahead. These inputs bind the result; they do not by
themselves authorize shadow execution.

The function is `STABLE SECURITY DEFINER`, uses only static SQL, and has
`SET search_path = pg_catalog`. Every object is schema-qualified. The future
purpose-specific owner has no login, no role-admin capability, no mutation
function EXECUTE and SELECT only on the named ledgers. Narrow forced-RLS policies
permit that owner to see the control rows needed for cross-retailer conflict
calculation. The caller role has only schema USAGE and function EXECUTE.

A single RPC invocation is one PostgreSQL statement and therefore one command
snapshot. No cursor or second RPC is allowed. The function captures
`transaction_timestamp()` and `statement_timestamp()`, source counts, maximum
source timestamps, migration-ledger fingerprint and deterministic source
fingerprints inside that snapshot. It returns the complete bounded result or
raises a stable error. It never returns a partial page.

Hard limits are owner-approved migration constants, provisionally at most 10,000
projected records and 8 MiB canonical JSON; caller limits may only be lower.
`statement_timeout` is provisionally 15 seconds and `lock_timeout` 2 seconds.
Counts are checked before aggregation and serialized size after construction.
Exceeding either limit fails closed; it does not truncate.

Output arrays are sorted by source name, scope kind, retailer IDs, stable record
ID and timestamps. Parent/child/run and approval/recovery relationships are
explicit references. Global conflicts carry deterministic reason codes and
sorted source references. JSON plan, result, audit and evidence payloads are
projected through closed key allowlists. Actor strings, URLs, headers, connection
metadata, free-form errors and customer data are excluded.

The result contains the existing v1 metadata and categorized records, plus a
`snapshot_proof` object containing source counts/fingerprints, the database
target identity fingerprint, migration-ledger fingerprint, capture timestamps,
limits applied and function version. The exporter recomputes the canonical and
export fingerprints independently.

Postflight/watchdog evidence must be terminal, unexpired under the approved
freshness policy, and correlated to the latest applicable plan/apply fingerprint.
Session/lock evidence must have a current heartbeat or terminal observation.
Any missing source, missing relation, unknown status, duplicate stable identity,
stale correlation, absent evidence, schema mismatch, count mismatch, oversized
result or impossible state yields no successful payload.

Stable error taxonomy:

- `RCSE_UNAUTHORIZED_CALLER`
- `RCSE_INVALID_REQUEST`
- `RCSE_BASELINE_MISMATCH`
- `RCSE_AUTHORIZATION_EXPIRED`
- `RCSE_REQUIRED_SOURCE_MISMATCH`
- `RCSE_SOURCE_UNAVAILABLE`
- `RCSE_INCOMPLETE_STATE`
- `RCSE_SCHEMA_DRIFT`
- `RCSE_LIMIT_EXCEEDED`
- `RCSE_TIMEOUT`
- `RCSE_INCONSISTENT_STATE`
- `RCSE_INTERNAL_ERROR`

The RPC never converts these errors into `CLEAR`. A successful payload may still
have a blocking final assessment. `CLEAR_FOR_SEPARATE_SHADOW_AUTHORIZATION`
remains evidence only, never authorization.

## Dedicated credential design

Create two group roles in the future migration:

- `retailer_control_state_export_owner`: NOLOGIN, NOINHERIT, NOSUPERUSER,
  NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS; owns only the RPC and
  has SELECT only on the explicit source tables through narrow RLS policies;
- `retailer_control_state_exporter`: NOLOGIN, NOINHERIT, NOSUPERUSER,
  NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS; has only `USAGE` on
  `public` and `EXECUTE` on the one RPC.

Provision `supplementscout_control_state_exporter_login` outside Git separately
for staging and production. It receives membership in the caller role without
admin option, no membership in the owner/validator/approver/executor roles, and
no table, sequence or general function privileges. Set
`default_transaction_read_only=on`, a short statement timeout, idle transaction
timeout and an exporter-specific application name. Store separate URLs only in
owner-approved protected GitHub Environment secrets. Never place a password or
token in migration, Git, documentation or artifacts.

Rotate by creating a new login/secret, canarying it, replacing the environment
secret and revoking/dropping the old login. Emergency revocation removes LOGIN,
revokes caller-role membership and disables the environment secret. The live
provider must verify `session_user`, `current_user`, read-only mode and the exact
RPC allowlist before its sole call.

`SECURITY INVOKER` is insufficient because forced RLS and revoked table grants
would require granting the credential direct table access, expanding it beyond
one operation and complicating cross-retailer conflict reads. SECURITY DEFINER
is acceptable only with the isolated non-login owner, fixed `pg_catalog`
search path, fully qualified static SQL, no dynamic SQL, no DML, no callable
mutation helpers, EXECUTE revoked from PUBLIC and every existing application
role, and ownership/membership tests preventing SET ROLE escalation.

## Threat model

| Threat | Control | Required test |
|---|---|---|
| Credential can write | caller receives EXECUTE only; default read-only | INSERT/UPDATE/DELETE/TRUNCATE and sequence tests fail |
| Service role used accidentally | provider rejects identity and secret name; RPC ACL excludes service role | service-role invocation fails |
| Mutation RPC is reachable | revoke all function EXECUTE, grant only read RPC | enumerate effective function privileges |
| SQL injection | typed parameters and static SQL only | malicious retailer/name/fingerprint inputs remain data or fail validation |
| Dynamic SQL | prohibited by migration contract | inspect `pg_get_functiondef` and reject `EXECUTE` statements |
| Search-path hijacking | `search_path=pg_catalog`; fully qualified objects | attacker-created same-name object is ignored |
| RLS bypass | caller and owner are NOBYPASSRLS; explicit owner policies only | role attributes and policy matrix tests |
| Other-retailer data leak | return only target rows plus minimal conflict references | seeded unrelated commercial payload never appears |
| Global conflict omitted | all-retailer conflict derivation and evidence scope are mandatory | seed shared batch/fingerprint/workflow conflict |
| Incomplete snapshot | one statement, all eleven sources mandatory | remove one source/evidence row and expect error |
| State changes during export | one command snapshot | concurrent transaction changes rows mid-call; output is wholly before or after |
| Pagination truncation | no pagination; bounded all-or-error | exceed row cap and prove no partial payload |
| Schema drift | exact columns/status allowlists and migration fingerprint | rename/remove fixture column or add unknown status and expect error |
| Secret leakage | closed projection and application redaction | seed token/header/URL-like values and scan output |
| Excessive output | absolute row/byte caps | exceed both caps independently |
| Denial of service | timeouts, caps and indexed predicates | forced slow fixture times out with stable error |
| Credential reuse | no table access or other RPC EXECUTE | attempt unrelated SELECT/function call |
| Expired authorization replay | validity bound and client fingerprint validation | expired/replayed authorization rejected |
| Export without owner consent | protected environment approval plus active authorization file | missing owner consent/secret release rejected before connection |
| Accidental scheduler run | no workflow/scheduler wiring; manual environment gate only | repository reference test finds no automatic caller |

## Future migration plan — not implementation

1. Add one forward-only versioned migration after owner approval; preflight exact
   prerequisite tables/functions/roles and abort on unexpected prior objects.
2. Create the append-only `retailer_control_state_evidence_v1` table, checks,
   forced RLS, ownership, revokes and only locally justified indexes.
3. Design and separately review a narrow evidence-ingestion RPC and producer
   identity for session/lock/postflight/watchdog/global observations. It may only
   insert exact closed records; it is not granted to the exporter credential.
4. Backfill nothing silently. First trusted observations are explicit canary
   evidence; absent history remains absent and blocks the exporter.
5. Create the isolated NOLOGIN owner and caller group roles with final attributes.
6. Add explicit owner-only SELECT policies and table grants for the named ledgers;
   do not grant those tables to the caller.
7. Create `read_retailer_control_state_v1` as STABLE SECURITY DEFINER, fixed
   search path, static SQL, hard limits and closed JSON projection.
8. Set ownership and comments documenting version, no-DML rule, logical sources,
   limits, security assumptions and emergency revocation.
9. Revoke function EXECUTE from PUBLIC, anon, authenticated, service_role,
   validator, approver, executor and evidence producer; grant only to the caller.
10. Revoke all tables/sequences/functions from the caller before the single grant;
    assert no role membership path to owner or existing control roles.
11. Run the isolated local database plan below and inspect `EXPLAIN` before adding
    any optional index.
12. Provision staging login and secret outside Git only after a separate approval;
    perform an owner-authorized one-call read-only canary and revoke on mismatch.
13. Provision an independent production login/secret only after staging evidence,
    code review and a new owner authorization; run one bounded read-only canary.
14. Do not wire a scheduler. A later live provider change must remain manual and
    authorization-file gated until separately approved.
15. Rollback by revoking caller EXECUTE and LOGIN immediately. Drop the function
    only if necessary; retain append-only evidence for audit. A later cleanup
    migration may remove roles/policies/table after retention approval.

Forward proof must include zero DML in the read function definition and
dependencies, effective privilege enumeration, one-statement concurrency tests,
eleven non-null source results, deterministic fingerprints, and a before/after
catalog snapshot proving the read call changed no user table or sequence.

## Local isolated database test plan

No local database was started for this design. The future suite must:

1. install the baseline and proposed migration in a disposable database;
2. seed and export all eleven logical sources;
3. export an explicitly complete empty state;
4. classify an active plan;
5. classify an incomplete plan;
6. classify a recovery plan;
7. classify open and stale sessions from evidence/heartbeat;
8. classify active, expired and orphaned locks;
9. classify pending, unused, expired, consumed and explicitly revoked approvals;
10. detect a global conflict;
11. detect a cross-retailer conflict without leaking unrelated payload;
12. preserve parent-child relations;
13. detect an equivalent active plan;
14. change state concurrently while the RPC is executing;
15. prove the response is entirely one statement snapshot;
16. remove a mandatory source and require `RCSE_SOURCE_UNAVAILABLE`;
17. inject schema/status drift and require `RCSE_SCHEMA_DRIFT`;
18. force statement timeout and require no partial response;
19. exceed record and byte limits independently;
20. prove INSERT is denied;
21. prove UPDATE is denied;
22. prove DELETE and TRUNCATE are denied;
23. prove every mutation RPC is denied;
24. prove unrelated tables and another retailer's payload are unreadable;
25. reject expired authorization metadata;
26. reject use of the login outside the exact RPC;
27. seed secret-shaped data and prove closed projection/redaction;
28. repeat with different physical insertion order and prove identical canonical output;
29. validate output against `control-state-export-v1` and the existing fixture exporter.

The suite must additionally inspect role attributes, memberships, grants,
policies, function owner, volatility, security mode, search path and static
definition; compare all user-table/sequence fingerprints before and after calls;
and run the existing exporter, RA-002, RA-003, quick/full and migration gates.

## Canary and rollback gates

Staging and production canaries are future, separately authorized work. Each is
one manual RPC call with a short-lived authorization, exact baseline, exact
eleven-source scope and hard limits. Capture caller identity, function version,
migration fingerprint, counts, state fingerprint, duration and zero-write proof.
Do not run shadow or the snapshot adapter. Any missing evidence, unknown status,
count/size drift, role mismatch or non-zero write proof revokes the credential
and blocks progress.

Emergency rollback is credential revocation plus RPC EXECUTE revocation. It does
not modify business/control rows. Database-object removal, evidence retention and
any ingestion rollback require a separate reviewed migration.

## Unknowns requiring resolution

- approved freshness/retention windows for session, lock, postflight and watchdog evidence;
- approved absolute record and byte caps;
- exact evidence producer and its strictly insert-only authorization model;
- whether legacy approvals without explicit revocation can be reported only as expired/superseded;
- whether global scope needs a normalized table column instead of evidence-derived metadata;
- production policy for retaining append-only control observations.

## Owner decisions for Marek

### Decision 1 — architecture

**Question:** Should the team prepare the smallest complete design: one bounded
transactional RPC plus one append-only ledger for the missing session, lock,
postflight, watchdog and global observations?

1. **Recommended:** approve Option A for a migration and isolated local tests.
   Risk: introduces one evidence ledger and a separately reviewed ingestion path,
   but is the only option that proves all eleven sources in one snapshot.
2. Use several direct SELECTs with a dedicated role. Risk: broader SQL capability,
   transaction/cursor complexity and larger leakage surface.
3. Reuse current validator/admin readers. Risk: known incompleteness, inconsistent
   snapshots and existing mutation/BYPASSRLS capability; safe default is reject.

Default if no decision: no migration and exporter remains blocked.

### Decision 2 — credential provisioning

**Question:** If the design is implemented later, may separate short-lived
staging and production exporter logins be provisioned outside Git and released
only through protected GitHub Environments?

1. **Recommended:** separate logins/secrets, manual environment approval,
   rotation and emergency revocation.
2. One shared exporter login for both environments. Risk: cross-environment blast
   radius and weaker attribution.
3. Reuse the validator secret. Risk: it has broader reads, BYPASSRLS and mutation
   RPC access; safe default is reject.

Default if no decision: create no login or secret.

### Decision 3 — next authorized scope

**Question:** May the team prepare the migration and run its tests only in a
disposable local database, with no staging, production, live provider or shadow?

1. **Recommended:** authorize migration implementation plus isolated local tests only.
2. Authorize documentation refinement only. Risk: the blocker remains untested.
3. Include a staging canary now. Risk: premature credential/database access;
   safe default is reject.

Default if no decision: design remains documentation only.

## Current status

RA-004 remains `IN_PROGRESS`. The fixture-only exporter is preserved in Draft PR
#89. Interface status is `OWNER_APPROVED FOR LOCAL IMPLEMENTATION`; local
implementation status is `CONTROL-STATE LOCAL IMPLEMENTATION READY_FOR_VERIFICATION`;
the repository LF policy preserves deterministic artifact bytes and
`verify:full` passes. The shadow manifest is
`NOT_AUTHORIZED`; the single-snapshot adapter is `NOT_STARTED`.
