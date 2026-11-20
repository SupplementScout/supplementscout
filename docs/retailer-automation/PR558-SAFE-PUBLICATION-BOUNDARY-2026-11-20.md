# PR558 — safe publication boundary

Status: **NEEDS_OWNER_APPROVAL**. This is a tested Draft revision, not a production
release. Main remains857847abbed3ab5f05f45274e739b290a4cdf562/CURRENT269/pending=[].
No merge, deployment, publication, migration, commercial/identity write or durable
flag change is authorized. PR559 is untouched and durable enforcement stays OFF.
The original2892250f/1e348491 evidence remains historical; this revision rebases
the existing PR onto current main and supersedes its unsafe automatic exposure.

## A. What the259 operations actually mean

The existing contract produces114CREATE,0REFRESH,109SUPERSEDE and36RESOLVE_BY_SOURCE.
This is259 review operations, not259 new semantic problems.

All109 replacements have exactly the same problem content as their old cards.
Recomputing the existing row hash with only the previous global source fingerprint
restored reproduces all109 historical fingerprints exactly. The original global
fingerprint wasb369113a6e868e8610950f27dc729441ca3e434799bcc286eda09b9c531677cb;
the current one is5b4f287a537c5cc61d05fbfbfae615726e6ffa1b1cd5eacedb249219c0121c97.
Thus these are evidence-version replacements caused by whole-source binding,
not109 changed problems. No fingerprint algorithm or historical evidence is changed
to reduce the operation count; broader compatibility work is outside this repair.

The36 source resolutions are supported individually:31 previously missing
variants now belong to the complete explicitly matched VERIFY_NO_CHANGE scope;
five former stock-change problems now also have VERIFY_NO_CHANGE and stock=true.
None is resolved merely because it disappeared from a partial or absent feed.
The114 CREATE rows comprise109 replacements and five additional problems:
three stock reviews plus the two canonical conflicts. Each operation and current
review ID/status is listed in the accompanying NOT_FOR_APPLY evidence.

All145 affected existing cards are PENDING with no owner decision, execution ID
or associated request. There are0APPROVED affected cards and0open retailer control
plans in the read-only snapshot. Historical2048EXPIRED/14EXECUTED cards and their
execution requests remain outside the transaction and are retained.

## B. Fresh source and exact local scenario

Native READ ONLY run**44712746385**, main/source SHA
**857847abbed3ab5f05f45274e739b290a4cdf562**, capture20November09:41:31.751Z,
artifact14618895059, digest
701e19026eb36372af4c3b9370633032dd8f020a1244242d6ce742956406ddf3.
The whole CSV completed HTTP200,554products/1977variants, pagination_completed=true,
SOURCE_HEALTH PASS and42 SQL READ ONLY validator batches PASS,0writes/approvals.
950approved =836executable VERIFY_NO_CHANGE +114review; review consists of
34source-missing,78MASS_OOS-classified commercial reviews and2canonical conflicts.
No catalogue expansion: discovery remains report-only, catalogue_creates=0.

Source fingerprint:
`5b4f287a537c5cc61d05fbfbfae615726e6ffa1b1cd5eacedb249219c0121c97`.
New capture time changed while the semantic fingerprint stayed identical to the
previous capture. Regression also proves capture time alone preserves row-problem
fingerprints; a new exact request may still have its own capture/run-bound key.

The final database baseline was read at10:43:01Z in repeatable-read READ ONLY. The local
scenario constructs the full request using existing pure contract/card/planner
functions and recorded provenance; it never fakes GITHUB_ACTIONS or calls protected
bind/reconcile/apply. The reconstructed baseline was not part of the native source
ZIP. Consequently this is diagnostic data, **NOT_FOR_APPLY**, not a production-bound
publication artifact of this proposed revision. No approval token is issued.

Scenario expiry:21November09:41:31.751Z. Idempotency key:
`641924abc89074154915e9ccaba7b700506f46951e9d2755254fbcdd72fa459f`.
Request hash excluding that key:
`01fe880b4d9b6463374afc2ba3a0661f38a2754a0f4659d3cab67082fd3a609a`.
All145 changed review IDs/statuses and all259 operations are in the diagnostic.
These values are not permission to publish, and a new fresh source/baseline after
release must generate its own exact request for a later decision.

Production was not globally frozen during this audit. Independent natural
Whey44716131474 and Fit44719849544 workflows refreshed579/246 offers respectively;
their postflights PASS, with zero price/stock changes and222 daily Fit history
confirmations. History therefore moved57254→57476. The earliest whole-offers
hash discrepancy was not resolved to individual non-10Reps rows (no full global
row baseline was exported then), so this evidence does not assert a byte-identical
global database. The entire10Reps offers/mappings/reviews/requests arrays are
byte-equal across the readbacks; all this task's source/DB operations are READ ONLY.
The external shared run's10Reps job failed at its old-code source-binding step;
that observation is not attributed to this undeployed revision or used as a
successful protected binding of it. No external workflow was dispatched here.

## C–D. Existing reuse and minimal implementation

The existing authorized-artifact-retry already supports initial execution of one
unapplied artifact as well as idempotent retry: exact owner confirmation binds
GitHub run/artifact digests, source metadata, batch/changeset/request fingerprints,
idempotency key, retailer/project, expiry and current baseline. It uses the same
publication RPC. However, it previously could not prevent the same-run automatic
path. Review-only dispatch alone also published the entire profile. Therefore a
small runtime correction is required; a promise to approve only two offers fails.

The central profile registry now configures10Reps as
**OWNER_AUTHORIZED_ARTIFACT_ONLY**; other profiles retain AUTOMATIC. No core code
branches on retailer or offer ID. The source builder exports the typed mode to
the existing composite action. That action still prepares the full immutable
reconciliation evidence, but invokes apply only for explicit AUTOMATIC. A missing
output cannot accidentally authorize publication. The common apply boundary
independently rejects owner-only profiles in same-run mode before credentials
or database access, regardless of a spoofed artifact mode. Only the unchanged
existing authorized-artifact-retry entry point can proceed after its exact checks.
The existing publicationEnabled=false guard still blocks both modes when disabled.

The owner-only source binding additionally requires complete HTTP200 source,
source-health/SQL-validation PASS, exact mapping coverage and the no-write missing
partition. All950 IDs must remain executable or review. The request is never
filtered to two cases or edited to remove inconvenient operations.

## E. Scheduled, delayed and manual execution

New-code scheduled, apply and manual review-only runs all prepare10Reps publication
without applying it. Changing nominal cron, capture time or event type cannot
bypass the consumer's profile policy. Normal commercial refresh, source capture,
existing guards, approved950 scope, postflight and idempotency are unchanged.
The fit-house-offer-refresh.yml file itself is unchanged by this correction.
The common refresh-review-queue can finish preparation successfully and continue
publishing other profiles; canonical publication being withheld is not an error
that skips Fit House/Gladiator/Holland steps. Native monitoring must still report
genuine unpublished reviews; preparation is not proof of published cards.

A workflow already pinned to old code cannot be retroactively changed. Controlled
release therefore requires the existing active/queued/waiting writer inspection,
no conflicting stale writer SHA and exact main/source checks, rather than trusting
nominal cron time. Source and reconciliation code within each run must use one
coherent revision. The existing shared retailer-offer-production-write concurrency
group is also used by authorized retry and is retained. No new scheduler or lock.

## Protection of decisions, requests and history

Before a previously unapplied owner-only request can mutate, the common consumer
rechecks affected review decisions and linked execution requests with its existing
allowed SELECT readers. Any touched APPROVED/non-PENDING expected state, owner
decision/review timestamp, execution ID or QUEUED/DISPATCHED/EXECUTING/FAILED request
blocks the entire request. There is no partial removal or automatic control close.
Failed execution requires its existing separate accounting, not source resolution.
Missing rows and read errors fail closed. An already-applied exact seal returns
ALREADY_APPLIED without rerunning protection or mutating anything.

Existing SQL row locks and expected PENDING status prevent an owner approval racing
the RPC: execution-request creation requires an APPROVED review under row lock;
publication cannot then match its expected PENDING state. No migration is needed.
The production service role intentionally lacks raw parent-plan SELECT. That
restriction is preserved; publisher credentials are not expanded and no owner
database credential is added to the workflow. The existing protected control-plan
preflight must show no unfinished plans immediately before any later initial
authorized publication, in the serialized execution window. This was verified0
for the current scenario. Associated review decisions/requests also remain guarded
inside the consumer; arbitrary unrelated control plans are not claimed to be
discoverable by the service-role reader.

The unchanged RPC retains old rows and audit history when superseding/resolving;
it does not delete history or authorize catalogue mutation. Canonical3399/3545
remain MANUAL_REVIEW_IDENTITY, KEEP_UNCHANGED, automatic_action=false, sourcePrice=null,
no proposed variant. The existing10Reps execution adapter supports UPDATE_STOCK
only. Approving such a manual card grants no canonical identity execution path.

## F–G. Regression and validation

Existing tests now cover the full950/836/114 partition and all259 operations;
same-run schedule/manual/old-source rejection; non-executable canonical cases;
partial/429/unhealthy/SQL-rejected source; whole-request idempotency; exact authorized
request with one RPC; already-applied zero-write retry; approved/racing/linked/
failed execution protection and denied/missing readers. Capture-only and global
source fingerprint changes are distinguished without altering the algorithm.
Fit,Gladiator,Holland,Gym andDiscount retain AUTOMATIC and their existing source
and publication regression cases. Existing wrong identity/fingerprint/expiry tests
remain unchanged. No assertion was removed. Nine new cases live in existing test
files; the371-file inventory and its seal are unchanged.

Final local gates and receipts: verify:project,verify:baseline,verify:quick,verify:full PASS; full safe 4116 tests,4113 PASS,0 fail,3 existing skips. TypeScript,ESLint and build PASS. Protected binding of this revision,
production publication and LIVE VERIFIED are NOT_RUN. Final PR SHA/CI are reported
at handoff; the evidence binds exact implementation file hashes without a circular
self-referential commit hash.

## H–J. Controlled release, rollback and next decision

Branch:fix/shared-canonical-review-publication-20261119; existing Draft PR558.
Main857847ab; original source1e348491 remains in history/remote evidence. This
revision is rebased onto current main. PR559 remains untouched.

After separate approval of the final SHA: recheck main/head/tree/CI,269/pending=[],
durable OFF, data/control readback and no stale active writer; release only this
coherent code revision using the existing guarded squash/Production procedure.
The release itself authorizes **zero Review Queue mutations**. Scheduled10Reps
can continue approved commercial refresh and generate preparation evidence only.
Observe other shared publishers and retain honest monitoring of pending review.

A later, separately authorized single publication must use a successful fresh
protected main review-only preparation (or a successful matching scheduled run),
complete950 source, native baseline/binding and immutable reconciliation artifact.
Read the whole CREATE/REFRESH/SUPERSEDE/RESOLVE_BY_SOURCE request, verify expiry,
owner decisions, execution/control preflight and current baseline, then use the
existing authorized-artifact-retry once with its exact owner confirmation.
Do not copy this local diagnostic into that workflow. A change in source, state,
SHA or request requires a new assessment; no automatic authorization inheritance.

Before any publication, code rollback needs no data rollback because preparation
writes no reviews. A full revert to857847ab restores the prior known limitation
(unsupported canonical binding can block10Reps refresh); it must not be presented
as an impact-free rollback. Never partially deploy action/source/profile/consumer
versions or relax a guard. After an authorized publication, do not delete audit
history or reverse fingerprints; any compensating reconciliation needs a new
explicit decision. On ambiguous RPC transport failure use the existing exact
publication-seal recovery; do not rebuild and submit a different request.

**One next owner decision:** approve or decline controlled **code-only release**
of the final PR558 SHA with OWNER_AUTHORIZED_ARTIFACT_ONLY, explicitly excluding
publication, identity changes, migrations, durable rollout and PR559. Any future
exact publication approval is a later decision after real preparation evidence.
