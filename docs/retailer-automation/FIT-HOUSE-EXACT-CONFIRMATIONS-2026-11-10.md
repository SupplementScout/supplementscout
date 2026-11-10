# Fit House exact confirmation gate — preparation only

Starting main: `98d5b1297e74688ab6439f24c7a6a8e162734eb3`.
RA-001, shared classifier, registration RPC, approver, executor and postflight
remain authoritative. This task prepares one draft PR; it authorizes no merge,
dispatch, source capture, production write, migration or schedule restart.

PR517 was released, but its fresh read-only run42692247024 did not execute any
confirmation. It returned261 VERIFY_NO_CHANGE,19 stock observations and4 source
absences, with14 SQL-validated batches. The attempted exact execution stopped
before any write: the full-catalogue confirmation guard requires284/zero review,
and ordinary workflow apply also publishes Review Queue evidence.

## Versioned owner evidence

[Exact subset](../../config/retailers/fit-house-exact-confirmations-2026-11-10.json)
retains all261 execution IDs and23 excluded review IDs. The original approved
catalogue manifest is unchanged:284 ACTIVE +2 HISTORICAL. Provenance binds
run42692247024/artifact13707591856, the two report-file hashes and ZIP SHA256
`36b9fadb3b50d6d3b95b54efa2f018e3d1a5d00d4004fe9179a61289d42485f8`.
The numerically sorted string-ID hash is
`df3f35359365bfadd016b36bbb78098333dc3fb36849e422bd21353ba3bd32fd`.

The evidence pins the existing mapped-offer source fingerprint, CURRENT262
migration binding, and the target projections of the independent original DB
baseline. Existing `targetFor`, canonical timestamp handling and immutable
retained state supply these projections; there is no second identity normalizer.
They include prices, shipping, stock, URLs, mapping/variant IDs, active flags and
last_checked_at for284 active and2 historical bindings. This also blocks a whole
apply replay after any successful or partial execution. A10November05:07:40UTC
TLS-verified read-only production check matched both pinned state hashes and
CURRENT262; OOS104 and offer1859 OOS remained intact. No source was fetched.

## Integration and first-write boundary

Discount Supplements already uses `selectApprovedScopeSegment`; the new evidence
uses that selector without adding segments to the historical approved manifest.
The exact selector cannot silently discard an extra executable row. The full
native plan is still built from a freshly captured source using all existing
catalogue, source-health, owner, MASS_OOS and reconciliation guards.

After native read-only SQL validation and before registration, the gate requires
the exact261 executable IDs/hash,261 VERIFY_NO_CHANGE actions, the exact23 review
IDs, matching source/DB fingerprints, current validation bound to each sealed
artifact, and per-row/per-batch deltas containing only freshness updates. It also
checks that atomic plans retain every commercial value and cannot insert history
or update catalogue records. No registration occurs on any mismatch.

The execution-authority metadata is separately SHA-pinned and remains covered by
the existing adapter/artifact fingerprint. It is excluded from the business-policy
hash so the installed SQL/OOS policy fingerprint and every guardrail stay unchanged.
Regression tests retain the immutable historical SQL fixtures and confirm that
changing a business guardrail still changes the policy fingerprint. No SQL
fingerprint, migration or privilege is resealed or changed.

The Fit profile config makes this gate mandatory for ordinary process-level
apply, even when the caller omits the selector or workflow operation name.
Other profiles and separately sealed historical reviewed operations retain their
existing paths. The old full-catalogue `confirmations_only=true` guard remains
unchanged and does not mean this261-row subset.

## Separately reviewed release procedure

After exact-head CI/Guardian, owner review, standard merge and production release
verification, the manual workflow mode is `apply-exact-confirmations`, retailer
`fit-house`, `confirmations_only=false`, `validation_context=workflow_dispatch`.
It uses the same production-write concurrency lane, roles, registration, approval,
execution checkpoint, DB postflight and read-only idempotency steps. Review-source
binding and Review Queue publication are excluded; other retailer jobs cannot
enter this mode. Both Fit House and Six Pack schedule pause guards are unchanged.

The fresh source must still match the pinned mapped scope. Any drift stops before
registration. A partial execution uses the existing checkpoint/readback; never
repeat the whole apply or perform unapproved recovery. This PR performs no apply
and makes no production restoration claim. No SQL/RPC/privilege contracts changed,
so PostgreSQL integration is not required for this application/workflow gate.

## Local validation

Focused134 PASS/0 SKIP; quick1086 PASS/3 existing SKIP; full3737 PASS/3 existing
SKIP, zero failures. TypeScript, ESLint, isolated production build and Project
Guardian PASS. Test inventory is reviewed/resealed360 files. The focused suite
also covers the actual ordinary-apply first-write boundary, historical SQL/OOS
fingerprints, Discount scope selection and unaffected shared retailer behavior.
Exact-head automatic CI and Guardian remain recorded in the draft PR checks.
