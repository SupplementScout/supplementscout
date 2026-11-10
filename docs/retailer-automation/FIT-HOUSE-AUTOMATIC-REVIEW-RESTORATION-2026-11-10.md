# Fit House Automatic Review Queue restoration

Status: DRAFT PREPARATION. This change is not production restoration or authority
to merge, publish, approve, apply or resume either paused schedule.

## Verified starting point

Production main is `e5075b67b705fb283eb7832de3eccc110fa52359`, CURRENT262.
The TLS-verified, repeatable-read/read-only production check at
2026-11-10 07:27:03 UTC retained 284 ACTIVE+2 HISTORICAL, OOS104, offer 1859 OOS
and EXECUTED review 1114. There are no active Fit parent plans. For the 23 review
offers, 97 historical cards comprise 78 EXPIRED, 12 persisted PENDING whose evidence
expired 5 November, 6 REJECTED and 1 EXECUTED; none has a currently valid approval.
Both schedules remain paused in main and in this branch.

Run 42766571104 completed 261 exact confirmations in 14 batches. The 237 daily
observations match the existing SQL recorder contract; 24 observations correctly
skip incomplete structured identity. Actual commercial changes and Review Queue
publications are zero. Native apply, postflight and read-only idempotency receipts,
their hashes, all 261 consumed approval bindings and the independent price-history
closeout are preserved in the [completed execution receipt](evidence/FIT-HOUSE-EXACT-261-EXECUTION-CLOSEOUT-2026-11-10.json).
The original owner evidence and approved catalogue manifest remain unchanged.

## Cause and bounded correction

The publication profile still expected286 active rows and stock-only review. It
also expected the classifier to cover missing-source rows. The existing lifecycle
already separates284 ACTIVE from 2 HISTORICAL, while the latest classifier covers
280 source-resolved rows and puts 4 unknown absences in review. The native diagnostic
incorrectly labelled physical 286 counts as approved counts even though its report
and baseline correctly used 284. All three contracts must agree.

Reuse `validateOrdinaryPartition`, `validateStandardCapture`, `validateStandard`,
`normalizeMixedReviewRows`, `normalizeMissingRows`, the existing source binder,
shared publisher/reconciler and stock adapter. A declarative stock-only commercial
restriction lets mixed review retain identity cards without admitting compound
price/stock changes. Other profiles retain their previous defaults. The native
producer reports the validated configured active scope; its DB-before counters
continue reporting physical rows, including historical bindings.

The retained run projection is 261 executable VERIFY_NO_CHANGE  + 19 stock review
(14 IN→OUT,5 OUT→IN)  + 4 missing review = 284. This is regression evidence, not a
guarantee about a later source. No production source capture is performed here.
The immutable captured fixture retains the original diagnostic 286; local tests
explicitly replay corrected producer metadata and verify that producer separately.

Only UPDATE_STOCK/STOCK_CHANGE cards are executable through the existing stock
worker, which still selects one approved transition plus 19 safe confirmations.
Missing-source cards are IDENTITY_CONFLICT/MANUAL_REVIEW_IDENTITY with KEEP_UNCHANGED,
no price/stock proposal, no proposed product/variant, no stock approval and no rebind.
No SQL, RPC, executor, approval registry, source importer or database permissions
change. RA-001 and the existing owner, MASS_OOS and durable stock-transition guards
remain authoritative; RA-004 remains suspended.

## Decision history and consumed exact gate

The reconciler leaves terminal EXPIRED, REJECTED and EXECUTED records intact.
Fresh evidence produces PENDING cards only; old PENDING evidence can be refreshed
or superseded without becoming an approval. Reconciliation is fingerprint-bound
and repeated identical publication creates no duplicate card. Offers 954 and 1938
require fresh owner decisions; no historical rejection is approval authority.
Review 1114 remains historical execution evidence, not authority over today's
missing-source case. Existing owner decision and expiry checks stay unchanged.

Remove both active exact-scope configuration fields, preserving the original
versioned 261/23 evidence and completed receipts. Remove the consumed manual choice
and its execution wiring; every job continues rejecting a stale exact-mode input.
A direct invocation with the retired selector fails before DB/source access.
The exact gate implementation remains covered as a historical fixture and still
fails closed if a separately configured active gate has missing/tampered evidence.
Ordinary guarded execution is not owner approval of any of the 23 review rows.

## Release boundary and subsequent owner decisions

After exact-head tests, CI/Guardian and a separately approved standard merge,
verify main and production deployment. A separately authorized fresh read-only
capture/baseline must reconcile the then-current full active/historical scope and
all review rows. Only then prepare/publish through the existing reconciler; do not
publish this offline test projection or reuse expired owner approvals. Owner
decisions and the existing worker must precede any stock write, postflight and
idempotency. Missing cases can remain explicitly deferred without inferred OOS.
Resuming Fit's schedule requires separate owner approval after that verification.
Six Pack remains paused and outside this implementation.

Focused, quick/full Quality Gate, TypeScript, ESLint, isolated build and Guardian
results are recorded in the draft PR. No DB contracts changed; PostgreSQL
integration is not required for this application/workflow-only correction.
