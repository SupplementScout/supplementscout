# RA-004 staging-canary implementation plan

**Prepared:** 25 September 2026

**Repository baseline:** `8e6299941fb6104d6e1ce2d453823b84cc97b44f`

**RA-004 status:** `IN_PROGRESS`

**Preparation status:** `OWNER_APPROVED`

**Independent verification:** `NOT_STARTED`

**Execution and staging migration:** `NOT_AUTHORIZED`

**Credential design:** `OWNER_APPROVED`

**Credential issuance/use, live export, production and shadow:** `NOT_AUTHORIZED`

**Owner-decision fingerprint:** `030c9d7cb12b46ab0b2bca2311ffbe1456e1c579e9e3acd570a4c0766ead119c`

**Plan-manifest fingerprint:** `34fb0e93fd3e91b7b737040c9eef0069c722fb96926bc109c86b5e75d3046b35`

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
| `scripts/retailer-control-state-export.js` | fixture CLI and fail-closed construction boundary | it supplies no live transport, so the current repository cannot execute the canary |

The current unwired transport is a deliberate safety boundary. A future
implementation must be separately reviewed and must expose only
`callReadOnlyRpc`; this plan neither implements nor authorizes it. The future
path must reuse the generic selector, verifier, application and exporter
contracts. It must not introduce direct migration tooling, a second exporter,
a second approval path or a new executor.

## Exact future sequence

Every step is prospective. Failure of any gate ends the attempt; later steps
do not inherit authority from earlier ones.

1. Independently verify this Draft PR; keep it Draft and unmerged during review.
2. Perform an approved read-only preflight of current staging, without mutation or secret-value inspection.
3. Confirm the current staging project reference from public/administrative identity evidence, not from a secret value.
4. Resolve the unique staging retailer ID for 10 Reps by name/slug; never guess it or copy a production ID.
5. Confirm the current staging migration ledger and required schema; prove the target migration is absent and not partially applied.
6. Name the operation owner, operator, credential issuer and exact UTC execution window.
7. Approve a private, encrypted, write-once evidence store implementing the owner-approved retention policy.
8. Prepare the exact staging-only selector change in a separate future Draft PR: admit only the named migration and SHA while leaving production exclusion and its contract unchanged.
9. Obtain separate exact owner authorization to apply that migration to the attested staging project and expected ledger.
10. Apply exactly one migration with the approved SHA through the validated selected-directory path; do not use direct SQL, Supabase push or an unselected directory.
11. Verify the ledger entry, function, roles, role attributes, ACL, RLS and absence of broad grants.
12. Only after separate exact authorization, issue one staging-only credential satisfying the design below.
13. Limit credential validity to at most 30 minutes, with matching lifecycle evidence.
14. Permit exactly one attempt of the allowlisted `public.read_retailer_control_state_v1(...)` RPC.
15. Disable automatic and operator retry; a second attempt requires a new task and authorization.
16. Bind the request to the one preflight-resolved 10 Reps staging retailer.
17. Create exactly one redacted control-state export and validate all eleven sources, caps, schema, timestamps and fingerprints.
18. Keep the whole canary inside one owner-authorized window of at most 60 minutes; unused authority expires at its end.
19. Immediately revoke `LOGIN` and caller `EXECUTE` access after the call or any failure.
20. Prove expiry or invalidation and inability to reconnect or execute.
21. Store the redacted evidence, audit receipts and detached fingerprints without credentials, secret endpoints or raw private payloads in Git, logs or public artifacts.
22. Read back the stored evidence and prove its bytes, metadata and hashes match the sealed evidence index.
23. Close out the canary with the outcome, zero-side-effect attestation and access-revocation receipt. Revocation is access rollback only; DDL removal would require a separate reviewed migration and retention decision.
24. Obtain a separate owner decision before any live feed capture or shadow run. Canary success creates no later authority.

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

The future canary stops before the RPC if any one condition is present:

1. Repository baseline or migration SHA does not match the approved binding.
2. The staging project is unrecognized, ambiguous or not independently attested.
3. The staging 10 Reps retailer ID is missing, ambiguous or assumed.
4. Required schema differs from the independently reviewed prerequisites.
5. The migration ledger is unknown or differs from the approved preflight.
6. The migration is already partially or unexpectedly applied.
7. ACL, RLS, role attributes or grants are broader than approved.
8. The credential has an unapproved privilege, role membership or RPC.
9. Credential validity exceeds 30 minutes or its expiry cannot be proved.
10. The private evidence store is missing or fails encryption, immutability, audit, retention or readback requirements.
11. The named operator or credential issuer is missing.
12. Separate execution and migration authorization is missing, expired or scope-mismatched.
13. A second RPC attempt is requested or detected.
14. Any automatic or operator retry is requested or detected.
15. A production endpoint, credential or access attempt is present.
16. Any feed fetch or live capture is requested or detected.
17. Any business/control write or mutation capability/attempt is present.
18. Any control-plan, approval, import or apply attempt is present.
19. The complete audit trail, attempt counter or evidence binding is missing.
20. Immediate revocation and subsequent inability to reconnect/execute cannot be proved.

Post-call validation also fails closed on an incomplete eleven-source result,
cap/redaction/schema/fingerprint/timestamp inconsistency, nonzero mutation
attempts or failed evidence readback. Such a result is not canary success and
creates no permission to retry.

## Unresolved information — do not infer

Repository literals and historical configuration are not proof of current
staging state. Each unknown remains an execution blocker.

| Unknown | Answer owner | Safe check | Required point | Consequence if absent |
|---|---|---|---|---|
| Current staging project reference | staging environment owner | approved read-only administrative identity preflight; inspect no secret values | before selector implementation review and connection-bearing authorization | stop; target cannot be attested |
| Current staging 10 Reps retailer ID | staging data owner | read-only unique name/slug inventory on the attested project | before authorization or credential issuance | stop; retailer scope cannot be bound |
| Current staging migration ledger | staging database owner | existing approved read-only selector preflight and ledger fingerprint comparison | before selector plan generation and immediately before application | stop; safe selection is impossible |
| Current staging schema | staging database owner | approved read-only prerequisite/function/role/ACL/RLS inventory | before migration authorization | stop; drift or partial state cannot be excluded |
| Private evidence store | evidence custodian and data owner | configuration, region, encryption, immutability, access and retention review without uploading canary data | before execution authorization | stop; export has no compliant destination |
| Operator | RA-004 operation owner | named-person assignment and role-separation review | before execution authorization | stop; no accountable executor |
| Credential issuer | staging security/database owner | named-person assignment and privilege-capability review | before credential issuance authorization | stop; lifecycle cannot be controlled |
| Exact execution window | RA-004 owner and staging owner | explicit UTC start/end no longer than 60 minutes | before execution authority becomes valid | stop; no valid authorization window |
| Future staging selector change | future implementation owner and independent verifier | separate Draft PR proving one-file SHA admission and unchanged production exclusion | before migration application authorization | stop; migration remains intentionally excluded |

## Future evidence and closeout contract

If later authorized, private evidence must bind the baseline, owner decision,
staging identity, retailer identity, pre/post migration ledger, migration hash,
selector manifest, authorization window, credential privilege proof, single
attempt, complete redacted export, eleven-source validation, zero-side-effect
attestation, revocation proof and read-after-write result. The redacted export
retention is 90 days under approved retention R; audit logs are 13 months and
fingerprints/deletion receipts seven years. The evidence custodian and exact
store must be named before execution.

This plan's next and only task is independent verification of the Draft PR.
No selector implementation, migration, credential or canary execution belongs
to that verification task.
