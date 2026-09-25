# RA-004 staging-canary implementation plan

**Prepared:** 25 September 2026

**Repository baseline:** `8e6299941fb6104d6e1ce2d453823b84cc97b44f`

**RA-004 status:** `IN_PROGRESS`

**Preparation status:** `OWNER_APPROVED`

**Independent verification:** `VERIFIED_COMPLETE`

**Execution and staging migration:** `NOT_AUTHORIZED`

**Credential design:** `OWNER_APPROVED`

**Credential issuance/use, live export, production and shadow:** `NOT_AUTHORIZED`

**Owner-decision fingerprint:** `030c9d7cb12b46ab0b2bca2311ffbe1456e1c579e9e3acd570a4c0766ead119c`

**Plan-manifest fingerprint:** `bd5c259941997daad3755c1cb135f76f6eccaef1fb9e1ce0044939ce08439214`

This is a documentation and design artifact, not an executable runbook and not
an execution authorization. It does not imply canary readiness. This task made
no staging or production connection, ran no SQL or database, applied no
migration, changed no selector, created or used no credential, read no secret
value, fetched no feed, created no live export, dispatched no workflow and
created no shadow run, control plan, approval, import or apply.

Machine-readable contract:
[`RA-004-staging-canary-plan.json`](RA-004-staging-canary-plan.json).

## Authority boundary

Marek approved only preparation of a separate staging-canary plan and the
credential design. The exact migration remains:
`supabase/migrations/20260924100000_add_transactional_retailer_control_state_interface.sql`,
SHA-256
`cfd7a93cb20845832b696183f5eb8a500f0474b4173829b85f6ac6bc73d4baaa`.
It remains excluded from both `STAGING` and `PRODUCTION` selectors. A future
staging selector change, migration application, credential issuance/use and
RPC call each require the later gates below and new exact authority.

Auto-safe classes remain `NONE_APPROVED`. Canary success, if separately
authorized in the future, would prove only the staging interface boundary. It
would not authorize production, a live feed capture, shadow mode, Model B or
cutover.

## Existing-mechanism audit

No separate RA-004 staging-canary plan, manifest or runbook existed on this
baseline. The design therefore adds one plan and one manifest, while reusing
the following existing mechanisms rather than proposing a parallel deployment
or exporter path:

| Existing mechanism | Future role | Current boundary |
|---|---|---|
| `scripts/supabase-migration-selector.js` | environment/ledger attestation, SHA-bound selection and isolated selected directory | RA-004 migration is excluded from staging and production |
| `scripts/verify-selected-migrations.js` | verify the selected environment after a separately authorized application | not invoked by this task |
| `scripts/apply-selected-migrations.js` | only permitted future migration application path | not invoked; direct SQL and Supabase push remain forbidden |
| `control-state-export-v1/providers.js` | single-call, allowlisted RPC provider contract | live provider requires an injected one-method transport |
| `control-state-export-v1/authorization.js` | time-, retailer-, baseline- and fingerprint-bound live authorization | no live authorization exists |
| `control-state-export-v1/schema.js` | eleven-source output, prohibited-operation and zero-mutation contract | interface contract is `VERIFIED_COMPLETE` |
| `scripts/retailer-control-state-export.js` | fixture CLI and fail-closed construction boundary | the separately reviewed follow-up permits only dependency injection of the bounded one-method live transport |

The original unwired transport was a deliberate safety boundary. The separately
authorized follow-up implements exactly `callReadOnlyRpc` and remains unwired
from applications, workflows and schedulers. This historical plan did not
authorize it; `RA-004-BOUNDED-LIVE-TRANSPORT.md` records the later authority and
implementation. The future
path must reuse the generic selector, verifier, application and exporter
contracts. It must not introduce direct migration tooling, a second exporter,
a second approval path or a new executor.

## Exact future sequence

Every step is prospective. Failure of any gate ends the attempt; later steps
do not inherit authority from earlier ones.

### Step 1 — independently verify and merge the plan

- Objective: Independently verify and merge the documentation-only staging-canary plan.
- Required inputs: Draft PR #92 at its reviewed head; origin/main at the approved baseline; owner-decision fingerprint.
- Responsibility owner: independent RA-004 verifier.
- Completion evidence: local and GitHub checks pass; squash tree equals the verified tree; plan verification status is VERIFIED_COMPLETE.
- Stop condition: Any ref, history, scope, fingerprint, check or tree mismatch stops closeout.
- Required prior authorization: Owner-approved staging-canary preparation and credential design only; no execution authority.

### Step 2 — read-only staging preflight

- Objective: Perform an approved read-only preflight of current staging.
- Required inputs: separate read-only preflight authorization; approved preflight procedure; named verifier.
- Responsibility owner: staging environment owner with independent verifier.
- Completion evidence: redacted preflight receipt; zero-write and no-secret-read attestation.
- Stop condition: Missing, expired or scope-mismatched preflight authority, mutation capability or secret-value access stops the preflight.
- Required prior authorization: Separate owner authorization for the exact read-only staging preflight.

### Step 3 — staging project identity

- Objective: Attest the current staging project reference without reading secret values.
- Required inputs: step 2 preflight receipt; public or administrative project identity metadata.
- Responsibility owner: staging environment owner.
- Completion evidence: signed project-identity attestation bound to the preflight.
- Stop condition: An unrecognized, ambiguous or unattested project stops all later work.
- Required prior authorization: The step 2 read-only preflight authorization; no connection-bearing execution authority.

### Step 4 — 10 Reps staging identity

- Objective: Resolve the unique staging retailer ID for 10 Reps without guessing or copying production identity.
- Required inputs: attested staging project; read-only staging retailer inventory; unique 10 Reps name or slug.
- Responsibility owner: staging data owner.
- Completion evidence: redacted unique name-or-slug to numeric-ID resolution receipt.
- Stop condition: A missing, duplicate, ambiguous or production-copied retailer identity stops all later work.
- Required prior authorization: The step 2 read-only preflight authorization.

### Step 5 — ledger and schema attestation

- Objective: Attest the current staging migration ledger and schema prerequisites.
- Required inputs: attested staging project; approved read-only ledger and schema inventory; exact migration filename and SHA-256.
- Responsibility owner: staging database owner with independent verifier.
- Completion evidence: ledger count and fingerprint; schema prerequisite report; proof the target migration is absent and not partially applied.
- Stop condition: Unknown ledger, schema drift, hash mismatch or partial/unexpected application stops before selector work.
- Required prior authorization: The step 2 read-only preflight authorization.

### Step 6 — named responsibility and window

- Objective: Name the operation owner, operator, credential issuer and exact UTC execution window.
- Required inputs: completed steps 2 through 5; role-separation requirements; maximum 60-minute window policy.
- Responsibility owner: RA-004 owner.
- Completion evidence: signed responsibility record with four named assignments and UTC start/end.
- Stop condition: Any missing assignment, role conflict or window over 60 minutes stops preparation.
- Required prior authorization: Owner-approved preparation only; assignments do not authorize execution.

### Step 7 — private evidence store

- Objective: Approve the private evidence store and owner-approved retention controls.
- Required inputs: named evidence custodian; approved retention R; store security and lifecycle configuration.
- Responsibility owner: evidence custodian and data owner.
- Completion evidence: store approval; encryption, write-once, access-audit, deletion and read-after-write capability evidence.
- Stop condition: A missing store or any encryption, immutability, audit, retention or readback gap stops preparation.
- Required prior authorization: Owner-approved retention policy; no evidence collection or upload authority.

### Step 8 — separate selector PR

- Objective: Prepare and independently review an exact staging-only migration-selector change in a separate Draft PR.
- Required inputs: steps 3 and 5 attestations; exact migration filename and SHA-256; current staging and production selector contracts.
- Responsibility owner: future implementation owner with independent verifier.
- Completion evidence: separate reviewed Draft PR admitting one staging migration; unchanged production exclusion and production selector tests.
- Stop condition: Any extra selected file, project mismatch, hash drift or production-selector change stops before authorization.
- Required prior authorization: Owner-approved plan preparation only; selector implementation and merge require their own review.

### Step 9 — migration application authority

- Objective: Obtain exact owner authorization for one staging migration application.
- Required inputs: reviewed selector PR; attested project and preflight ledger; named operator and UTC window; migration filename and SHA-256.
- Responsibility owner: Marek as RA-004 owner.
- Completion evidence: time-bound authorization binding project, ledger, migration, operator and window.
- Stop condition: Missing, expired, ambiguous or scope-mismatched authorization stops before application.
- Required prior authorization: A new explicit owner decision; D4 does not authorize migration application.

### Step 10 — one migration application

- Objective: Apply exactly one approved migration through the validated selected-directory path.
- Required inputs: step 9 authorization; merged reviewed staging selector; attested expected ledger; selected directory containing one SHA-bound migration.
- Responsibility owner: named staging operator.
- Completion evidence: one application receipt; one exact new ledger entry; zero unrelated selected files.
- Stop condition: Direct SQL, Supabase push, an unselected directory, ledger drift or any additional migration stops the operation.
- Required prior authorization: The exact unexpired step 9 migration-application authorization.

### Step 11 — post-migration security verification

- Objective: Verify the migrated function, roles, ACL, RLS, ledger and absence of broad grants.
- Required inputs: step 10 receipt; reviewed migration security contract; approved read-only post-migration verifier.
- Responsibility owner: independent staging database verifier.
- Completion evidence: post-migration schema, role, ACL and RLS report; ledger/hash match; zero broad-grant finding.
- Stop condition: Any security, schema, ledger or hash mismatch stops before credential issuance.
- Required prior authorization: The step 9 window must cover read-only post-migration verification; no credential authority yet.

### Step 12 — credential issuance

- Objective: Issue one staging-only credential satisfying the approved design.
- Required inputs: successful step 11 evidence; named issuer and operator; exact credential privilege and revocation plan.
- Responsibility owner: named staging credential issuer.
- Completion evidence: credential lifecycle receipt without its value; privilege and role-membership attestation.
- Stop condition: Missing separate authority or any excess privilege, membership or secret exposure stops before use and triggers revocation.
- Required prior authorization: A new explicit credential-issuance authorization; D5 approves design only.

### Step 13 — credential TTL proof

- Objective: Prove credential validity is at most 30 minutes and bounded by the canary window.
- Required inputs: step 12 lifecycle receipt; canary UTC window.
- Responsibility owner: credential issuer with independent verifier.
- Completion evidence: issued-at, expires-at and calculated TTL receipt.
- Stop condition: TTL over 30 minutes, window overflow or unproved expiry stops before RPC and triggers revocation.
- Required prior authorization: The exact credential-issuance authorization; credential use is still not authorized.

### Step 14 — one-attempt authorization

- Objective: Seal authorization for exactly one future allowlisted RPC attempt without invoking it.
- Required inputs: successful steps 11 through 13; allowlisted RPC signature; fingerprinted live authorization; attempt counter.
- Responsibility owner: RA-004 owner with independent verifier.
- Completion evidence: one-attempt authorization fingerprint; attempt counter initialized to zero.
- Stop condition: Missing or invalid authorization, a non-allowlisted RPC or a nonzero attempt counter stops before invocation.
- Required prior authorization: A new explicit credential-use and one-RPC canary authorization.

### Step 15 — no-retry proof

- Objective: Prove automatic and operator retry are disabled.
- Required inputs: reviewed one-shot transport; step 14 authorization and attempt counter.
- Responsibility owner: future implementation owner with independent verifier.
- Completion evidence: no-retry configuration proof; second-attempt negative test.
- Stop condition: Any retry path, queue, scheduler or second-attempt capability stops before RPC.
- Required prior authorization: The step 14 one-attempt authorization; no retry authorization exists.

### Step 16 — exact retailer binding

- Objective: Bind the future RPC request to the one resolved 10 Reps staging retailer.
- Required inputs: step 4 retailer receipt; step 3 project attestation; step 14 authorization.
- Responsibility owner: named staging operator with independent verifier.
- Completion evidence: sealed request showing matching project, retailer ID and unique name or slug.
- Stop condition: Any project/retailer mismatch, ambiguity or scope count other than one stops before RPC.
- Required prior authorization: The step 14 one-RPC authorization bound to this exact retailer.

### Step 17 — sole RPC and redacted export

- Objective: Make the sole allowlisted RPC attempt and create one redacted control-state export.
- Required inputs: successful steps 11 through 16; one-shot read-only transport; approved private evidence destination.
- Responsibility owner: named staging operator with independent verifier.
- Completion evidence: attempt count exactly one; one redacted export; eleven-source, cap, schema, timestamp and fingerprint validation; zero write/mutation attempts.
- Stop condition: Any pre-RPC stop condition, second call, retry, incomplete source, cap/redaction/fingerprint failure or prohibited capability ends the attempt without success.
- Required prior authorization: The unexpired exact step 14 credential-use and one-RPC authorization.

### Step 18 — maximum 60-minute window

- Objective: Prove the entire canary stayed within the maximum 60-minute window.
- Required inputs: authorized UTC window; timestamped audit events through the single RPC.
- Responsibility owner: RA-004 operation owner with independent verifier.
- Completion evidence: window-duration calculation; proof unused authority expired at window end.
- Stop condition: Window expiry or duration over 60 minutes ends authority immediately and prevents success.
- Required prior authorization: The exact time-bound canary authorization established before step 10.

### Step 19 — immediate access revocation

- Objective: Immediately remove LOGIN and caller EXECUTE access after the call or any failure.
- Required inputs: credential identity; revocation procedure; call or failure timestamp.
- Responsibility owner: credential issuer with named operator.
- Completion evidence: LOGIN, EXECUTE and membership revocation receipt.
- Stop condition: Inability to revoke is a failed canary, triggers incident handling and prohibits success reporting.
- Required prior authorization: The credential lifecycle authorization must require immediate revocation.

### Step 20 — revocation verification

- Objective: Independently prove credential expiry or invalidation and inability to reconnect or execute.
- Required inputs: step 19 receipt; approved negative access check.
- Responsibility owner: independent staging security verifier.
- Completion evidence: failed reconnect proof; failed allowlisted-RPC execution proof; expiry or invalidation receipt.
- Stop condition: Any surviving access or unproved invalidation makes the canary failed and blocks closeout success.
- Required prior authorization: Read-only security verification within the closeout window; no further RPC attempt authority.

### Step 21 — private evidence storage

- Objective: Store the redacted evidence, audit receipts and detached fingerprints.
- Required inputs: step 17 redacted export; steps 18 through 20 receipts; approved evidence store and retention metadata.
- Responsibility owner: named evidence custodian.
- Completion evidence: write-once object IDs; detached SHA-256 values; redacted evidence index and retention dates.
- Stop condition: Secret/raw leakage, missing evidence, public storage or retention mismatch prevents closeout success.
- Required prior authorization: Approved evidence storage and retention authority for this exact evidence set.

### Step 22 — evidence readback

- Objective: Read back stored evidence and verify bytes, metadata and fingerprints.
- Required inputs: step 21 object IDs and detached hashes; read-after-write capability.
- Responsibility owner: independent evidence verifier.
- Completion evidence: readback hashes and metadata equal the sealed evidence index.
- Stop condition: Missing object, byte/hash mismatch or unreadable retention metadata prevents closeout success.
- Required prior authorization: Least-privilege read access for the independent verifier.

### Step 23 — bounded canary closeout

- Objective: Close out the staging canary without claiming production or shadow authority.
- Required inputs: all prior completion evidence; zero-side-effect attestation; access-revocation and evidence-readback receipts.
- Responsibility owner: RA-004 operation owner with independent verifier.
- Completion evidence: signed outcome record; zero-side-effect attestation; explicit statement that success proves only the staging interface boundary.
- Stop condition: Any missing evidence, unexplained result or unrevoked access produces failed/incomplete closeout, never default success.
- Required prior authorization: Closeout authority only; DDL removal requires a separate reviewed migration and retention decision.

### Step 24 — separate later owner decision

- Objective: Require a separate owner decision before any live feed capture or shadow run.
- Required inputs: step 23 closeout; new proposal with current baseline and fingerprints.
- Responsibility owner: Marek as RA-004 owner.
- Completion evidence: separate explicit owner decision, or a recorded NOT_AUTHORIZED outcome.
- Stop condition: Absent separate approval, live capture and shadow remain NOT_AUTHORIZED with no automatic transition.
- Required prior authorization: None is inherited from canary success; a new exact owner authorization is mandatory.

## Immutable canary restrictions

The future canary is staging-only and one-retailer-only. It permits zero
production access, feed capture, scheduler wiring, evidence producers, control
plans, approvals, imports, applies, offer changes, Model B execution, auto-safe
classes or cutover. It may make one allowlisted read-only RPC attempt and
produce one redacted export only after all separate authorizations exist.

There is no pagination or retry at the canary orchestration boundary. The
transactional RPC returns the complete bounded snapshot in one call. All
eleven required sources must be present: control plans, plan items, sessions,
locks, approval contracts, approval consumption, recovery state, apply ledger,
postflight state, watchdog state and global conflicts.

## Staging-only credential design

The future credential must meet all of these controls simultaneously:

1. Use a separate staging-only login, created outside Git for this canary only.
2. Expire no later than 30 minutes after issuance and no later than the canary window.
3. Permit one RPC attempt; automatic and manual retry are prohibited.
4. Have no direct privileges on tables or sequences.
5. Have no mutation-RPC privileges and no execute privilege on any other RPC.
6. Have no membership in validator, approver, executor or service roles; its only functional membership is the dedicated `retailer_control_state_exporter` boundary.
7. Be `NOSUPERUSER` and `NOBYPASSRLS` and have no role-creation or database-creation capability.
8. Default every transaction to read-only and reject any write capability.
9. Use a short statement timeout, no greater than the interface's tracked 15-second role setting, plus a bounded idle-in-transaction timeout.
10. Be non-reusable; a failed or consumed attempt is terminal.
11. Lose `LOGIN` and caller `EXECUTE` immediately after the attempt or any failure; revoke membership as part of closeout.
12. Never expose the credential value in Git, logs, artifacts or the Pull Request.
13. Record issuer, operator, issuance time, expiry time and a revocation receipt, without recording the secret value.

The login receives only the schema access needed to invoke the single RPC and
the dedicated exporter membership/execute boundary. It receives no access to
the append-only evidence writer role. Issuance, use and revocation are not
authorized by this design.

## Stop conditions before RPC

The future canary stops before the RPC if any one condition is present. Every
condition has the same non-overridable effect:
`STOP_BEFORE_RPC_NO_OVERRIDE_NO_PARTIAL_CONTINUATION_NO_SUCCESS`. An operator
cannot waive it, continue a safe-looking subset or turn it into default success.

| Stop code | Required evidence |
|---|---|
| `BASELINE_OR_MIGRATION_SHA_MISMATCH` | fresh Git ref receipts plus independently computed migration SHA-256 |
| `STAGING_PROJECT_UNRECOGNIZED_OR_UNATTESTED` | signed read-only staging project-identity attestation |
| `STAGING_RETAILER_ID_UNRECOGNIZED_OR_AMBIGUOUS` | unique read-only 10 Reps name-or-slug to numeric-ID receipt |
| `SCHEMA_DRIFT` | reviewed schema, function, role, ACL and RLS prerequisite comparison |
| `MIGRATION_LEDGER_UNKNOWN_OR_MISMATCHED` | current ledger count, ordered entries and fingerprint matching the approved preflight |
| `MIGRATION_PARTIALLY_OR_UNEXPECTEDLY_APPLIED` | proof the target objects and ledger entry are wholly absent before application |
| `GRANTS_BROADER_THAN_APPROVED` | post-migration role attributes, memberships, ACL, RLS and function-grant report |
| `CREDENTIAL_HAS_UNAPPROVED_PRIVILEGES_OR_MEMBERSHIP` | credential privilege and membership attestation against the closed allowlist |
| `CREDENTIAL_TTL_EXCEEDS_30_MINUTES` | issued-at, expires-at and independently calculated TTL receipt |
| `PRIVATE_EVIDENCE_STORE_MISSING_OR_NONCOMPLIANT` | approved store encryption, immutability, access-audit, retention and readback report |
| `OPERATOR_OR_CREDENTIAL_ISSUER_MISSING` | signed named-role and separation-of-duties record |
| `SEPARATE_EXECUTION_OR_MIGRATION_AUTHORIZATION_MISSING` | unexpired exact owner authorization bound to project, ledger, migration, operator and window |
| `SECOND_RPC_ATTEMPT` | sealed attempt counter and one-shot provider receipt |
| `RETRY_ATTEMPT` | no-retry configuration proof and retry-attempt audit event |
| `PRODUCTION_ACCESS_OR_CREDENTIAL_ATTEMPT` | endpoint and credential-scope attestation plus network destination audit |
| `FEED_FETCH_ATTEMPT` | network capability audit proving no feed source is allowed |
| `BUSINESS_OR_CONTROL_WRITE_ATTEMPT` | read-only transaction proof and zero write/mutation attempt counters |
| `CONTROL_PLAN_APPROVAL_IMPORT_OR_APPLY_ATTEMPT` | capability audit proving those operations are absent and attempt counters remain zero |
| `AUDIT_TRAIL_INCOMPLETE` | complete ordered event, authorization, attempt, evidence and revocation ledger |
| `IMMEDIATE_REVOCATION_CANNOT_BE_PROVED` | LOGIN, EXECUTE and membership revocation receipt plus failed reconnect/execute checks |

Post-call validation also fails closed on an incomplete eleven-source result,
cap/redaction/schema/fingerprint/timestamp inconsistency, nonzero mutation
attempts or failed evidence readback. Such a result is not canary success and
creates no permission to retry.

## Unresolved information — do not infer

Repository literals and historical configuration are not proof of current
staging state. Each unknown remains an execution blocker.

| Unknown | Answer owner | Safe check | Required point | Consequence if absent |
|---|---|---|---|---|
| Current staging project reference | staging environment owner | approved read-only administrative preflight comparing public project identity metadata; do not inspect secret values | before selector implementation review and before any connection-bearing authorization | stop; project target cannot be attested |
| Current staging 10 Reps retailer ID | staging data owner | read-only unique name or slug inventory on the attested staging project | before authorization or credential issuance | stop; retailer scope cannot be bound |
| Current staging migration ledger | staging database owner | existing approved read-only selector preflight and ledger fingerprint comparison | before selector plan generation and again immediately before application | stop; migration selection is unsafe |
| Current staging schema | staging database owner | approved read-only prerequisite, function, role, ACL and RLS inventory | before migration authorization | stop; schema drift and partial state cannot be excluded |
| Private evidence store | evidence custodian and data owner | configuration and access-policy review without uploading canary data | before execution authorization | stop; export has no compliant destination |
| Operator | RA-004 operation owner | named-person assignment with role-separation review | before execution authorization | stop; no accountable executor |
| Credential issuer | staging security or database owner | named-person assignment and privilege-capability review | before credential issuance authorization | stop; credential lifecycle cannot be controlled |
| Exact execution window | RA-004 owner and staging owner | record explicit UTC start and end not exceeding 60 minutes | before any execution authorization becomes valid | stop; no valid canary window |
| Future staging selector change | future implementation owner plus independent verifier | separate Draft PR proving one-file SHA-bound staging admission and unchanged production exclusion | before migration application authorization | stop; migration remains intentionally excluded |

## Future evidence and closeout contract

If later authorized, private evidence must bind the baseline, owner decision,
staging identity, retailer identity, pre/post migration ledger, migration hash,
selector manifest, authorization window, credential privilege proof, single
attempt, complete redacted export, eleven-source validation, zero-side-effect
attestation, revocation proof and read-after-write result. The redacted export
retention is 90 days under approved retention R; audit logs are 13 months and
fingerprints/deletion receipts seven years. The evidence custodian and exact
store must be named before execution.

## Independent verification evidence

On 25 September 2026 an independent verifier checked the exact initial PR head
`08dc87f9957058bb1a8e040a650e18ae94c7baae` in a new clean worktree with a
lockfile-clean `npm ci`. The verifier independently recomputed the initial
manifest fingerprint, owner-decision fingerprint and migration SHA-256; proved
both selector exclusions; audited the unwired one-RPC exporter boundary and
eleven-source registry; and reconciled all 24 steps, 20 stop conditions and nine
unresolved facts between this document and the machine-readable manifest.

Eight controlled negative mutations were independently rejected: authorizing
execution, staging migration, credential issuance or production; removing a
stop condition; changing the migration SHA; adding an unknown manifest field;
and diverging Markdown from JSON. Project Guardian, the focused exporter and
migration-selector tests (84/84), TypeScript, ESLint, `verify:quick` and
`verify:full` all passed. The full gate included the production Next.js build.
Integration, SQL and database tests were intentionally not run. No staging or
production connection, migration, credential, secret read, live export, feed
capture, workflow dispatch, shadow run, control plan, approval, import or apply
occurred.

This plan remains documentation and design only. Its next and only task is to
prepare a separate authorization package for a bounded read-only staging
preflight, without connecting to staging as part of this closeout. No selector
implementation, migration, credential or canary execution belongs to that
task.
