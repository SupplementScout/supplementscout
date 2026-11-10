# Fit House Automatic Review Queue restoration

Status: DRAFT PREPARATION. This change is not production restoration or authority
to merge, publish, approve, apply or resume either paused schedule.

## Final safety correction in the same PR519

The current owner HOLD is now executable policy in a SHA-pinned, tuple-bound
[owner decision](../../config/retailers/fit-house-owner-source-decisions-2026-11-10.json),
not a note or a historical REJECTED status. Offer1938 must retain stock=false.
The native adapter quarantines it even when the source flavour matches; the
publication adapter cannot emit a commercial card for it, and registration rejects
any artifact containing the held offer. There is no expiry-based release. A later
explicit owner decision and reviewed code/evidence change are required to release it.

The adapter reuses `projectShopifyCanonicalRecords`, `parseVariantIdentity`,
`normalizeFlavour` and `parseSize` to compare approved mapping options and canonical
flavour against current source options/title. No second projector or normalizer is
introduced. Present-but-conflicting variants retain flavour-conflict reasons;
unknown evidence is FLAVOUR_UNVERIFIED. Genuine absence remains
SOURCE_VARIANT_MISSING. Conflicting source option/title evidence also stays review.
Checks run after existing owner/aggregate classification and before stock plans or
worker selection, retaining the original MASS_OOS evidence and thresholds.

Fresh native review rows carry their identity evidence; the shared publication
adapter rechecks current binding/flavour and source fingerprint. Old reports that
lack flavour evidence cannot acquire commercial authority from approved mapping
labels alone. Identity cards use IDENTITY_CONFLICT/MANUAL_REVIEW_IDENTITY;
OWNER_HOLD uses POLICY_REVIEW/MANUAL_REVIEW. Neither has a commercial proposed state.
All decisions still use the existing Review Queue, approver and shared executor.

The original source report remains immutable19 stock observations+4 missing.
The conservative publication replay with retained source evidence and read-only
canonical metadata yields7 stock cards,15 identity cards (4 missing+11 unknown
flavour) and1 OWNER_HOLD card. This is not a fresh source measurement. No historical
mapping label is substituted for a current source flavour. Offer954's separate
owner observation supports Berry Slush identity only for its exact source
fingerprint/date/tuple/price and observed unavailable state; it remains PENDING
and requires a new owner stock decision. Explicit source conflict overrides that
observation, and a different source fingerprint does not inherit it.

The08:27:55UTC read-only production check reconfirmed CURRENT262, unchanged23
offers/cards, OOS104/OOS1859 and EXECUTED1114. No production action is performed.
The deny-only decision and guard are included in the adapter fingerprint; the
installed business-policy/SQL fingerprint, approved manifests, shared executor,
approval registry, other retailer defaults and both schedule pauses stay unchanged.

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
and repeated identical publication creates no duplicate card. Offer954 requires
a fresh owner stock decision. Offer1938 remains HOLD; an ordinary queue approval
cannot release it. No historical rejection is approval authority.
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
