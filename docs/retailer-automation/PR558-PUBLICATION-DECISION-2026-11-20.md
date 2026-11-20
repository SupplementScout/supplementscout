# PR558 — whole-profile publication decision

Historical analysis at1e348491. The later
[safe publication boundary](PR558-SAFE-PUBLICATION-BOUNDARY-2026-11-20.md)
supersedes the automatic-exposure limitation below with an owner-only artifact
policy. This259-operation scenario remains evidence, not publication authority.

Status: **NEEDS_OWNER_APPROVAL / BLOCKED for production publication**.
PR557 alone was authorized for release. PR558 remains Draft and must not be
merged on the assumption that it merely creates two cards. No runtime change,
publication, scheduled dispatch, commercial apply or identity correction was
performed by this analysis.

## Exact read-only scenario

The existing pure shared source validator, card builder and reconciliation
planner were evaluated against native source44617220470 (19November21:18:07Z),
artifact14575936269 and a fresh20November08:47:39Z READ ONLY production baseline.
Source partition:950 approved =836 executable +114 review. These are recorded
source data, not a fresh20November retailer capture or protected binding of this
proposed revision. No GITHUB_ACTIONS context was fabricated. The saved scope
analysis is explicitly NOT_FOR_APPLY and contains no executable publication file.

| Operation | Count | Effect |
|---|---:|---|
|CREATE|114|Insert the incoming review problems, including3399/3545.|
|REFRESH|0|No existing problem fingerprint matches the incoming evidence.|
|SUPERSEDE|109|Replace existing problems with new evidence for the same offers.|
|RESOLVE_BY_SOURCE|36|Close existing problems absent from this source partition.|
|Total|259|Review mutations only; zero catalogue writes.|

Existing PENDING/APPROVED rows:145, all unexpired at the observation time.
Expected final PENDING/APPROVED count:114 =145 +114 -109 -36. Five CREATE offers
have no corresponding prior problem in that set. The two canonical cases are
only part of this complete transaction. The matching evidence JSON lists every
offer ID, affected review ID and replacement relation for all four operations.
No part of these259 operations has been authorized or executed.

The current fingerprint changes include source evidence. Therefore a new source
capture can change CREATE/REFRESH/SUPERSEDE as well as RESOLVE_BY_SOURCE even when
the incoming count happens to remain114. Source expiry is20November21:18:07Z;
this observation is not approval to replay it later as fresh source.

## What the next scheduled workflow can do after a hypothetical merge

The existing shared workflow selects10Reps for cron `47 2 * * *`. After fresh
dry-run validation it captures the baseline, binds the entire950-offer partition,
applies eligible commercial plans through the already guarded executor, verifies
postflight/idempotency and exposes exact artifact/contract outputs.

The existing refresh-review-queue job uses `always()` plus exact binding outputs;
its10Reps composite step runs whenever its source contract is present. Publication
does not require a new manual dispatch or per-card owner click. In particular,
a successful pre-execution binding can reach review reconciliation even if a
later commercial apply fails. All existing fingerprint, evidence and RPC guards
still apply, but none narrows the request to3399/3545 or to two CREATE operations.
The proposed canonical policy removes the current unsupported-reason rejection.

Consequently, merging this revision could enable an automatic full-profile review
transaction at the next delivered scheduled event. Delayed schedules make nominal
clock time an insufficient safety boundary. A promise to approve only two cards
would not constrain that transaction. Current durable OFF also does not gate
legacy Review Queue mutation. Do not merge before this exposure is resolved by
an explicit decision covering the actual fresh whole request and execution window,
or a separately reviewed minimal policy revision using the existing workflow.
No such runtime revision is included here.

## Owner decision still required

Review the complete fresh request, exact source SHA/artifact/digests, current
baseline, all259 scenario operations and their updated equivalents, expiry and
scheduled automation implications. Approve CREATE, REFRESH, SUPERSEDE and
RESOLVE_BY_SOURCE explicitly; unchanged identity authority does not authorize
automatic canonical rebinding. If the owner authorizes a bounded one-off review
publication only, the current always-on schedule exposure must be addressed in
a separately reviewed revision before merge. Do not add offer-ID exceptions.

## Compatibility and evidence

New main after PR557:857847abbed3ab5f05f45274e739b290a4cdf562. Its runtime tree is
identical to approved watchdog62ed57ff. GitHub reports PR558 MERGEABLE/CLEAN with
no conflict; no rebase, merge-from-main or copied runtime is necessary. The
original implementation SHA2892250f remains in history. This follow-up adds only
this analysis and its evidence. Existing shared reconciliation/reliability tests
repeat58/58 PASS; prior standalone project/baseline/quick/full PASS remain valid
for the unchanged implementation. Final-SHA PR CI rechecks the current merge
candidate. There was no production publication or commercial execution.
