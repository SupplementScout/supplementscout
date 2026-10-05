# Retailer Automation Consolidation Execution Plan

**Status: PRODUCTION STABILIZATION ACTIVE — RA-004 LIVE RETRY STOPPED**

**Current active task:** RA-STAB-01 — `IN_PROGRESS`. On 29 September 2026 the
owner stopped further RA-004 live canary retries after the five-day sequence of
staging-interface, credential, ledger, ACL, provider-identity and final SQL
contract failures. The consumed `v3` activation remains terminal and
non-replayable. Its cleanup, credential revocation, closed selectors, unchanged
business data and zero forbidden production operations remain authoritative.

The immediate objective is to restore a trustworthy baseline for the existing
production retailer paths before any consolidation work resumes. This is not a
new runtime, importer, approval path or executor. It reuses the current
workflows, artifacts, control ledger, Review Queue, postflight and watchdog.
Work proceeds read-only until a specific recovery or business write has fresh
bounded evidence and separate owner approval.

RA-004 is now `BLOCKED`. It may reopen only as artifact-first recorded replay:
the same immutable snapshot must be evaluated by the current and candidate
classifiers with zero network, control or business writes. Another staging
credential, migration activation, live control-state export, canary, shadow
run, cutover or retry is not authorized by this reset.

See
[`evidence/RA-STABILIZATION-RESET-2026-09-29.md`](evidence/RA-STABILIZATION-RESET-2026-09-29.md).

**Allowed statuses:** `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`,
`READY_FOR_VERIFICATION`, `READY_FOR_REVERIFICATION`, `VERIFIED_COMPLETE`

Only one RA task may be active. Task numbering for retailer migrations is an
inventory key, not an approved execution sequence. No task may become
`VERIFIED_COMPLETE` without the listed local and live evidence.

## Common evidence fields

Every task records:

- commit SHA:
- PR:
- GitHub run ID(s):
- artifact ID(s), digest(s) and retained path(s):
- local verification:
- production readback:
- owner approval reference:
- rollback result:

## RA-STAB-01 — Existing-path production stabilization

**Status:** `IN_PROGRESS`

**Owner decision:** explicit instruction on 29 September 2026 to stop further
RA-004 live retries, preserve completed evidence, stabilize the existing
production paths without retailer-specific patches, and resume consolidation
only through recorded replay.

**Goal:** establish one current, evidence-backed production state; recover
existing paths through their current guarded mechanisms; and prove ordinary
operation without adding a retailer branch, parallel pipeline or new writer.

**Scope:** the current watchdog inventory and existing workflows; read-only run
and artifact evidence; active-plan/session classification; source-health,
fingerprint and evidence-correlation incidents; already-approved recovery
mechanisms; shared regression fixes only when a repeated incident proves a
general contract defect.

**Out of scope:** another RA-004 activation, staging or production migration,
new credential or role, live shadow, Model B activation, cutover, retailer
migration, catalogue identity decision, commercial approval, baseline widening,
new importer/executor and direct database write.

**Execution order:**

1. Capture one fresh read-only watchdog and the latest ordinary workflow
   artifacts. Record the observation time because later successful runs may
   supersede an earlier watchdog.
2. Classify every non-green retailer as `SOURCE`, `CONTROL_LIFECYCLE`,
   `FINGERPRINT_OR_IDENTITY`, `EVIDENCE_CORRELATION`, `MONITORED_DEBT` or genuine
   `FAILED_SYSTEM`. Do not infer OOS, identity or price from a failure.
3. Resolve one dependency class at a time using an existing recovery mechanism.
   A production/control write, approval or migration requires a separate exact
   owner authorization and is not implied by this task.
4. If code is necessary, first add the incident as a common-harness regression.
   The fix must be retailer-neutral, preserve every guard and avoid a new entry
   point. A retailer-specific condition stops the task for design review.
5. Require three consecutive ordinary schedule intervals with no unexplained
   result, plus event coverage or recorded replay for every affected class.
6. Close with a fresh watchdog, correlated evidence, exact remaining monitored
   debt and zero-unrelated-change proof. Only then decide whether artifact-first
   RA-004 may reopen.

**First checkpoint — complete:** documentation reset and current-state read-only
capture. Watchdog run `36564343116`, generated
`2026-09-29T11:51:54.990Z`, inspected all 12 configured retailers, reported six
failures and made zero database writes. The classified inventory and retained
artifact digest are recorded in
[`evidence/RA-STAB-01-CURRENT-STATE-2026-09-29.md`](evidence/RA-STAB-01-CURRENT-STATE-2026-09-29.md).

**Current bounded step:** observe the recovered ordinary paths; no retailer
refresh, retriever retry, business write or RA-004 replay is authorized. The
shared ambiguous-registration diagnostic fix is verified. The 10 Reps
failure is reproduced: run `36400487268` registered a control plan and then
timed out during parent approval; the next run correctly blocked the duplicate.
The shared engine now retains exact registered parent/child identity before the
next boundary and reports an unknown parent-approval outcome explicitly. Its
focused 39-test suite, repository quick gate and full gate pass. The separately
authorized production readback at `2026-09-29T12:54:55.079Z` proved that one
expired 10 Reps parent is the sole global parent blocker: parent `APPROVED`, one
child `APPROVED`, 18 children `PLANNED`, one expired unconsumed batch approval,
zero apply runs and zero business writes. Whey Okay has no active parent of its
own; its legacy RPC is blocked by that global parent count. The existing expired
approval close RPC was not safe for this multi-child state because it closed only
the approved child and parent, leaving 18 planned children. A retailer-neutral
forward migration now extends that same RPC and approver role to atomically
expire the entire wholly unexecuted sequential tree. It is SHA-bound and
excluded from both normal selectors. Its isolated PostgreSQL regression passes
for 19 children, replay, sibling-state rejection and zero business writes. No
deployment, ledger mutation, approval, replay or expiry is authorized.

Fresh production readback at `2026-09-29T14:15:21.462Z` also resolved a stale
repository selector baseline: the already-applied Fit House parent-approval
migration is ledger row 222. Production reports canonical fingerprint
`c08b5f2e704072a0e4b2590688998e07a781f8699546279b6e81acd9c975c0fe`,
which exactly matches the fingerprint stored by the interrupted 10 Reps
approval. The repository selector is aligned to that readback with no ordinary
pending production migration; the sequential-close migration remains excluded.
A separate activation preparation is `NOT_AUTHORIZED`. A thin operational
coordinator now prepares, but does not grant, the two recovery phases. It
reuses the existing selected-migration helpers and existing
`close_expired_retailer_offer_sync_approval(jsonb)` RPC; it contains no
retailer-specific condition and no business-table writer. `schema-deploy` and
`control-close` each require their own exact, short-lived owner-authorization
artifact and confirmation. There is no combined mode, automatic retry or
automatic transition between phases. Read-only `schema-verify` and
`control-verify` remain independently repeatable. The current preparation
cannot execute either write phase, and no credential is read until the
phase-specific authorization has passed locally.

**Prepared command boundary — not execution authority:**

- `node scripts/ra-stab-01-production-recovery.js --phase=status` validates the
  tracked preparation and migration SHA locally and reports `NOT_AUTHORIZED`;
- a later separately approved schema phase may apply only the exact excluded
  migration against ledger row 222 and must commit ledger row 223 with zero
  business-count delta, followed by an independent read-only verification;
- only after that evidence and another separate owner decision may the control
  phase call the existing approver RPC for the exact 10 Reps parent, 19-child
  manifest and expired unconsumed approval;
- no command here authorizes a retriever retry, retailer refresh, offer apply,
  price-history write, identity change, RA-004 replay or next phase.

**Schema phase — complete:** after PR `#146`
merged as `1e635a6da8565bfeba300b3f5b0d96d30320fb59`, the owner separately
authorized only `SCHEMA_DEPLOYMENT`. The one-shot coordinator applied excluded
migration `20260929133000_extend_expired_sequential_plan_close.sql` at SHA-256
`b0a4cac2d9c30989f00570bf1c63036daf190fffbcc7b08b17c616761bc6a380`.
The transaction moved the production ledger from 222 / `c08b5f2e...c0fe` to
223 / `c891240d...c7b0`. Its committed postflight and a separate read-only
`schema-verify` both passed; products `1337`, variants `3632`, mappings `3758`,
offers `3758` and price history `24583` were unchanged. The deployed ledger
statement bytes match the reviewed migration and the existing close RPC is
present. No control plan, approval, product, variant, mapping, offer or price
history row was changed. The schema authorization is consumed and cannot grant
another phase. Evidence:
[`evidence/RA-STAB-01-PRODUCTION-SCHEMA-DEPLOYMENT.json`](evidence/RA-STAB-01-PRODUCTION-SCHEMA-DEPLOYMENT.json).

**Control recovery — complete; observation pending:** after independent schema
verification, the owner separately authorized exactly one `CONTROL_RECOVERY`
attempt for the bound 10 Reps parent, 19-child manifest and expired unconsumed
approval. The existing close RPC completed at `2026-09-29T15:38:23.742118Z`.
It expired the approval, parent and all 19 children: 21 control writes, zero
business writes, zero price-history writes, zero apply runs, zero row approvals
and zero recovery records. A separate read-only `control-verify` passed with all
19 children `EXPIRED`. Products `1337`, variants `3632`, mappings `3758`, offers
`3758` and price history `24583` remain unchanged. The authorization is consumed
and grants no retailer refresh, retriever retry or RA-004 replay. Evidence:
[`evidence/RA-STAB-01-PRODUCTION-CONTROL-RECOVERY.json`](evidence/RA-STAB-01-PRODUCTION-CONTROL-RECOVERY.json).

The sole global active-parent blocker is therefore closed. RA-STAB-01 remains
`IN_PROGRESS`: next capture a fresh read-only watchdog, then require three
ordinary schedule intervals and correlated evidence before closeout. Do not
manufacture those intervals by manually retrying a retailer.

**Immediate post-recovery watchdog — baseline recorded:** run `36592696720`
executed from `main` commit `07fea3e9bf38a67a1457ef65dfbaf2c8f9277455`
through the existing `production-readonly` workflow. It inspected all 12
retailers at `2026-09-29T15:46:28.977Z`, made zero database writes and reported
no global failure. Its overall result remains `FAIL`: six retailer results are
still based on stale, backlog-growth or unrelated execution evidence that
predates the control close. The run is the honest post-recovery observation
baseline, not proof of three ordinary intervals and not evidence that the close
regressed. No retailer was manually retried and no monitored baseline was
widened. Evidence:
[`evidence/RA-STAB-01-POST-RECOVERY-WATCHDOG-2026-09-29.json`](evidence/RA-STAB-01-POST-RECOVERY-WATCHDOG-2026-09-29.json).

The next bounded step is observation only: correlate the next ordinary daily
retailer schedules and the six-hour watchdog. Count an interval only when its
own capture, apply and postflight artifacts satisfy the existing contract. Do
not count this immediate watchdog as an ordinary retailer interval and do not
substitute a manual dispatch for missing ordinary evidence.

For the affected paths, the three cron targets are Whey Okay at `02:17` UTC and
shared refresh / 10 Reps at `02:47` UTC on 30 September, 1 October and 2 October
2026. These are schedule targets, not assumed start times: on 29 September
GitHub delivered the corresponding runs only at `08:35` and `09:03` UTC. For
each date, correlate the pair with the first ordinary six-hour watchdog that is
generated after both workflows have reached a terminal state. A watchdog that
precedes either delayed workflow does not count. If an ordinary run again
reports an active-plan or control-lifecycle block, stop and classify it as a
regression; otherwise retain its exact run, artifact, postflight and idempotency
evidence.

**Evidence-preservation audit — complete, replay bundle incomplete:** while the
ordinary schedules are pending, a read-only repository audit sealed the current
RA-000–004 evidence inventory. RA-000–003 decisions and local deterministic
fixtures are reconstructable. The terminal RA-004 closeout, selector closure,
two credential revocations, five allowed source-observation evidence writes and
zero business/control-canary mutations are tracked. Four private artifacts are
preserved only by SHA-256 without a retrievable locator, however, and there is
no current immutable 10 Reps raw snapshot, paired legacy/canonical output or
950-row parity bundle. They are explicitly `DIGEST_ONLY_NOT_RETRIEVABLE` or
`MISSING_REQUIRED_FOR_REPLAY`, not claimed as preserved replay inputs. This
audit neither reopens RA-004 nor authorizes a capture. Evidence:
[`evidence/RA-STAB-01-EVIDENCE-PRESERVATION-AUDIT.json`](evidence/RA-STAB-01-EVIDENCE-PRESERVATION-AUDIT.json).

**First ordinary observation - failed safe; shared ledger correction in
progress:** the 30 September scheduled Whey Okay run `36690863083` and shared
refresh run `36693313942` both stopped before apply, postflight and idempotency.
They made zero database writes, zero control writes and created or consumed zero
approvals. The previous active-plan/control-lifecycle blocker did not recur.
Because the required capture/apply/postflight contract was not satisfied, this
observation does not count: RA-STAB-01 remains at `0/3` consecutive ordinary
intervals.

The observation exposed one bounded shared defect caused by the completed
recovery: production correctly contains the verified 223-row ledger, while the
ordinary production selector still expected the pre-recovery 222-row ledger.
The 10 Reps validator therefore stopped with `RSBI_SOURCE_HASH_MISMATCH`. The
central correction binds the selector to the verified row 223 fingerprint and
records the recovery migration as applied but still excluded; ordinary pending
migrations remain empty. It adds no retailer condition, entry point or writer
and weakens no guard. The simultaneous `MASS_OOS` result remains authoritative
and must be evaluated independently after this validator mismatch is removed.

Whey Okay separately stopped on its existing mapped-fingerprint-row invariant,
and Fit House stopped on its six-offer fingerprint invariant. The first
watchdog after both workflows, run `36714749305`, made zero writes and still
selected older successful evidence rather than these failed diagnostics. Those
fingerprint and evidence-correlation classes are preserved as separate debt;
they are not folded into the ledger fix. Evidence:
[`evidence/RA-STAB-01-ORDINARY-INTERVAL-01-2026-09-30.json`](evidence/RA-STAB-01-ORDINARY-INTERVAL-01-2026-09-30.json).

The three-interval sequence restarts only after the shared correction is merged
and an ordinary scheduled run executes that commit. Do not use a manual dispatch
to manufacture an interval and do not weaken `MASS_OOS` or either fingerprint
invariant to make a run green.

**Fingerprint/identity audit - bounded causes separated:** the Whey Okay source
snapshot from run `36690863083` is healthy and was reproduced read-only with the
same semantic fingerprint. Exactly 10 of 589 approved identities are absent,
all from the old PER4M 2 kg family. The source now exposes a rebuilt 2.01 kg
family under 29 new variant IDs without GTIN evidence, so no automatic rebind is
allowed. Missing-row isolation was already correct; the adapter interaction was
not. When `MASS_OOS` requested a second capture, it fingerprinted all 589 records
and converted the 10 review-only absences into `INTERNAL_ERROR`. The bounded
correction fingerprints the 579 matched records and independently requires the
same exact 10-key missing scope in both captures. Any commercial or scope change
fails closed as `SOURCE_SCOPE_DRIFT`. It changes no threshold, mapping, shared
classifier or write path and has a regression for stable and changing scope.

Fit House is a different identity decision, not the same code defect. Its source
fingerprint has been stable at `8074eefe...e991` since 24 September. Protected
variant `46969725714672`, offer `759` (7Nutrition Vegan Berberine Stack at
`GBP 11.99`), has genuinely returned available with consistent identity; the
other six protected identities remain absent. The prior absence authorization
cannot decide a return to stock. On 1 October the owner authorized exactly offer
`759` to return from OOS to in stock, with price `GBP 11.99`, mapping `873`,
canonical product/variant `740/3021`, source product/variant
`9168824172784/46969725714672` and URL unchanged; the other six protected offers
must remain OOS and any other change must stop before registration. The bounded
edge-coordinator correction records that decision in one immutable SHA-bound
manifest and generalizes the existing protected-stock selector from a hardcoded
OOS direction to the exact authorized transition. It adds no workflow, shared
classifier branch, threshold, mapping, approval path or writer. Local focused,
quick and full gates pass. Production remains unchanged until the change is on
`main` and a fresh protected preflight agrees. Evidence:
[`evidence/RA-STAB-01-FIT-HOUSE-759-RETURN-2026-10-01.json`](evidence/RA-STAB-01-FIT-HOUSE-759-RETURN-2026-10-01.json).

The merged implementation passed CI and reached `main` as `e1178542`. The fresh
production dry-run `36829215331` then failed closed before registration with
`FIT_HOUSE_SIX_SCOPE_MISMATCH`: source health passed at 242 products / 338
variants and the stable fingerprint `8074eefe...e991`; offer `759` matched the
authorized return exactly, but the full 286-offer classification contained 14
additional stock changes outside that authority. Artifact `11146044349`, digest
`sha256:48a7a9c59b860e74e03af1aaf6da40243b16bcbbee2e53146ebd0bc7a87fa962`,
records zero control/business writes and zero approvals. Apply, postflight and
idempotency did not run. No retry or isolation patch is authorized: executing
only `759` while placing the other 14 rows into review is a new owner-scope
decision. This manual preflight does not count toward the `0/3` ordinary
interval requirement.

The owner then explicitly authorized the isolated form: execute only offer
`759`, include 19 commercially unchanged freshness confirmations, leave the
exact 14 observed stock differences without writes and expose them as review.
The decision is byte-bound in
`config/retailers/fit-house-owner-approved-return-isolation-2026-10-01.json`
with SHA-256 `b696f4b0...2153`. The existing edge selector now consumes the raw
`MASS_OOS` only when all 14 offer/mapping/source identities, prices and stock
directions match that manifest. It quarantines those rows as
`OWNER_DEFERRED_STOCK_REVIEW`, proves none entered the execution artifact, and
selects only `759` plus 19 unchanged confirmations. Any extra/missing row,
direction, price, URL, identity or protected-offer drift stops before
registration. Replay after `759` is in stock produces zero artifacts while
retaining the 14 review rows. The shared classifier, thresholds, workflow,
registration, validator, approver and executor are unchanged; focused, quick
and full local gates pass. Production remains unchanged pending merge, CI and a
fresh main-only preflight.

That main-only preflight ran as `36833083890` on commit `5c761327`. The
isolation contract itself passed exactly: the classifier reached
`DRY_RUN_READY_WITH_REVIEW`, selected only offer `759` plus 19 freshness-only
confirmations, and retained precisely the 14 authorized deferred offer IDs.
The read-only database validator then rejected the artifact before registration
with `RSBI_SOURCE_HASH_MISMATCH`; there were zero approvals and zero control or
business writes. Root cause was central contract drift left by the prior ledger
repair: the selector correctly expected production ledger `223` / `c891240d...`,
while runtime artifacts still excluded the already-applied sequential-close
recovery and emitted ledger `222` / `c08b5f2e...`. The correction moves
applied-excluded and pending migration state into one shared policy consumed by
both runtime and selector, with exact production and staging parity regressions.
It adds no Fit House condition, SQL migration, approval path or writer. No
further production retry is allowed until that central correction passes all
gates and reaches `main`.

The central correction passed local full/project gates and CI and reached
`main` as `8d40cd3` in PR `#161`. Fresh dry-run `36835231701` then passed the
read-only validator with the exact 20-row execution scope and 14-row review
scope, making zero writes. The separately authorized apply `36835371096`
completed with `PASS_WITH_REVIEW`: offer `759` alone changed stock from false to
true, 19 other offers changed only `last_checked_at`, and the exact 14 deferred
offers received no writes. Price, shipping, delivered total, offer URL, mapping
URL and mapping timestamp deltas were zero; products, variants, mappings and
offers stayed at `1337/3632/286/286`. Postflight passed with one stock change,
20 freshness confirmations, zero commercial price-history delta and 20 daily
confirmation rows. A fresh-source idempotency pass produced no artifact or
write for `759` and retained only the same 14 review rows. Evidence artifact
`11149245887` has digest `sha256:84baa9cb...f646d`. This owner-authorized manual
operation is closed but does not count toward the ordinary `0/3` interval
requirement. The next implementation is the central read-only watchdog
correlation correction already identified below.

The same audit confirmed that the watchdog currently reports only successful
stage evidence and may combine ordinary stages from older different runs. Direct
failed-run artifacts remain authoritative, but the watchdog cannot be the final
RA-STAB closeout proof until `latest_attempt` is separated from
`last_complete_success` and ordinary cross-run stitching is forbidden. That is
the next shared read-only implementation after the fingerprint class. Evidence:
[`evidence/RA-STAB-01-FINGERPRINT-IDENTITY-AUDIT-2026-10-01.json`](evidence/RA-STAB-01-FINGERPRINT-IDENTITY-AUDIT-2026-10-01.json).

**Watchdog correlation correction - live verified; ordinary debt exposed:**
the shared watchdog now builds one retailer attempt from one exact job and one
workflow run instead of selecting successful steps independently. It reports
`latest_attempt`, `last_complete_success`, `latest_ordinary_attempt` and
`last_complete_ordinary_success`; a newer failure therefore remains visible
while an older complete success remains historical evidence only. Configured
idempotency is part of the same-run success contract. Manual dry-runs remain
visible as read-only completions but cannot become ordinary intervals or replace
the last completed apply. The Fit House and 10 Reps jobs are isolated inside
their shared workflow by exact step and job identity. Generic cross-run
stitching is rejected; only the existing exact eBay `split-run-v1` attestation
remains available. Workflow history now reads up to 100 completed runs and
emits `WORKFLOW_HISTORY_TRUNCATED` rather than silently accepting an incomplete
window. Focused 36/36 tests, quick gate, full gate, Project Guardian and the
production build pass. No workflow, importer, approval path, writer, monitored
baseline or retailer condition was added. The next gate is merge and one fresh
read-only watchdog from `main`; it may expose real historical failures and must
not be made green by widening baselines or manually retrying retailers.
Evidence:
[`evidence/RA-STAB-01-WATCHDOG-CORRELATION-2026-10-01.json`](evidence/RA-STAB-01-WATCHDOG-CORRELATION-2026-10-01.json).

PR `#163` passed CI and merged as `e170977`. The first read-only production
watchdog on that commit, run `36838647202`, made zero database writes, reported
no global infrastructure failure and correctly failed rather than absorbing the
new latest-attempt/idempotency reasons into monitored backlog. Artifact
`11150815207`, digest `sha256:1408e00e...f0a80`, reports 10 failed retailers.
It also exposed one remaining freshness gap in its own GitHub evidence reader:
Fit House resolved `35725377626` instead of the known successful apply
`36835371096`, while 10 Reps resolved ordinary run `35702168708` instead of
known failed scheduled run `36693313942`. Direct readback confirms both newer
runs contain the exact configured profile steps. The result is therefore a
fail-closed diagnostic, not final RA-STAB evidence and not authority for a
retailer retry.

The shared follow-up forces GitHub API cache revalidation, records the newest
listed workflow and scheduled runs, a bounded list of unmatched jobs and the
total scanned run count. If the newest listed schedule does not resolve to the
newest retailer profile attempt, the watchdog now emits
`LATEST_ORDINARY_PROFILE_ATTEMPT_UNRESOLVED` instead of silently using an older
attempt. Focused regressions pass 38/38. This remains read-only and adds no
retailer branch, baseline exception, workflow or writer. Quick/full gates,
merge and a second read-only production watchdog are the next gates; the
ordinary counter remains `0/3`.

PR `#164` merged the freshness diagnostics as `34dff001`. The second read-only
watchdog, run `36840586622`, again made zero writes and had no global failure.
Artifact `11151312806`, digest `sha256:814612f1...a84e2`, proved the transport
issue precisely. The first fetch of the shared workflow resolved Fit House to
latest apply `36835371096` and ordinary run `36693313942`. The later independent
fetch for 10 Reps returned an older listing headed by `35702168708`. Both
profiles were therefore internally consistent with different API snapshots,
which is not acceptable evidence.

The central correction now fetches each workflow history page and its jobs once
per watchdog run, binds every request to the same `GITHUB_RUN_ID` snapshot key
to defeat intermediary stale caches, and reuses the exact immutable page promise
for every profile sharing that workflow. A local read-only replay over that one
snapshot resolves Fit House to latest `36835371096` / ordinary `36693313942`
and 10 Reps to latest and ordinary `36693313942`; both report the same listed
workflow heads and scan 50 identical runs. The shared cache regression and all
39 focused tests pass. No retailer logic, business threshold, baseline or write
path changes. Quick/full gates passed before merge; `0/3` remained unchanged.

PR `#165` merged the immutable shared-history correction as `597a5a26`. The
third read-only watchdog, run `36842276685`, artifact `11152160197`, digest
`sha256:1ffba83e...b4e85`, made zero database writes and reported no global
failure. It returned `FAIL` for 9 retailers and monitored 3, but the correlation
contract itself passed live. Fit House resolved latest/manual complete run
`36835371096` and latest ordinary run `36693313942`; 10 Reps resolved latest and
ordinary run `36693313942` and retained `35466782708` as its last complete
success. Both profiles used the same current 50-run snapshot, listed latest
workflow run `36835371096` and listed ordinary run `36693313942`. The earlier
cross-profile cache drift is therefore closed. Whey Okay independently resolved
new complete ordinary run `36839858227` and is now
`PASS_WITH_MONITORED_BACKLOG`, which further confirms that newer ordinary
evidence is no longer hidden.

The overall red result is now actionable evidence rather than a correlation
defect. The first bounded classification is Fit House's
`APPROVED_SCOPE_PARTITION_MISMATCH`: its successful isolation artifact records
the full 286-row approved manifest, while `20` executable and `14` review rows
describe the selected 34-row changed partition. The owner operation remains
live verified and closed; the 14 rows remain unchanged. The next task is to
define and verify this distinction in the central evidence contract before
touching watchdog logic. Counts must not be rewritten merely to satisfy
`20 + 14 = 286`, no retailer-specific exception is permitted, and no manual
retailer retry or monitored-baseline widening is authorized. After this
contract classification, process the remaining latest-ordinary failures by
shared incident class. The ordinary interval counter remains `0/3`.

The central scope contract is now locally corrected and fully verified. It
retains the complete approved-scope partition and adds a bounded operation
model. The bounded model passes only when a canonical-hash-verified full
database baseline from the same artifact is linked by postflight, every
execution/review offer ID belongs to that baseline, the ID sets are exact,
unique and disjoint, and execution has zero blocked rows plus a successful
same-run/same-commit database postflight. A
read-only replay of the untouched Fit House artifact from run `36835371096`
now classifies `286` approved rows as a `34`-row bounded operation (`20`
executed, `14` review, `252` unselected/no-write) under
`BOUNDED_OPERATION_SCOPE_V1`. The same generic contract accepts the historical
Discount Supplements `109/95/0/14` shape and retains the complete-scope model;
negative regressions cover count, ID, scope and correlation drift. Focused,
quick and full gates pass.

PR `#167` merged the correction as `31469faf`. The main-branch read-only
watchdog run `36849669742`, artifact `11155420859`, digest
`sha256:32305924...fa516`, live verified `BOUNDED_OPERATION_SCOPE_V1` as
`PASS`: `286` approved, `20` executed, `14` review and `252` unselected/no-write.
`APPROVED_SCOPE_PARTITION_MISMATCH` is gone. The run made zero database writes
and reported no global failure. Fit House remains correctly red because a newer
ordinary run `36842642858` is unsuccessful, offers remain stale and monitored
backlog grew; this interval therefore earns no credit. The next bounded task is
read-only classification of that latest shared Fit House/10 Reps ordinary run,
not a retailer retry. No monitored-baseline change or RA-004 retry is
authorized, and the ordinary counter remains `0/3`.

Read-only classification of ordinary shared run `36842642858` separated two
facts. The 10 Reps job was terminally successful: artifact `11153320825`,
digest `sha256:8a58626a...52dbd`, records `950` approved, `934` executed, `16`
review, zero blocked, 43 stock updates, 891 freshness confirmations, passing
postflight and passing zero-write idempotency. Fit House's business path also
passed with zero writes: artifact `11152410704`, digest
`sha256:c33331ff...f42b0`, records `286` approved, zero executable/executed and
the exact 14 owner-deferred review rows. Its job failed only afterward because
the Markdown summary dereferenced absent `discovery` in the legal zero-action
report. The shared run failure then contaminated 10 Reps because the watchdog
used `run.conclusion` instead of the matched `job.conclusion`.

The local central correction gives zero-action reports the same producer
context as executable reports, accepts zero-execution contracts only when
`mode=apply`, and evaluates each shared-workflow retailer from its exact job
conclusion while retaining the run conclusion as context. The untouched Fit
House artifact now replays as a bounded `PASS` with `0` executable, `14`
review and `272` unselected/no-write. Focused tests pass `81/81`; quick and
full gates pass, and independent review found no regression. Merge followed by
one read-only watchdog may verify job-level attribution; producer behavior must
then be observed on the next ordinary schedule, never by a manual retailer
retry. The interval still earns no credit because the historical Fit job is
terminally red and genuine Fit House/10 Reps backlog growth remains. Counter:
`0/3`.

PR `#169` passed all required checks and merged as `bc74bac`. The main-branch
read-only watchdog run `36852261994`, artifact `11156515153`, digest
`sha256:33edc534...b0a63`, made zero database writes and reported no global
failure. It live verified the consumer correction: 10 Reps now resolves its
exact successful job from shared ordinary run `36842642858` as
`COMPLETE_SUCCESS`, with `950` approved, `934` executed, `16` review and zero
blocked. Its false `LATEST_ATTEMPT_NOT_SUCCESSFUL` and
`LATEST_ORDINARY_ATTEMPT_INCOMPLETE` failures are gone; only genuine monitored
backlog growth remains. Fit House correctly retains the terminal failure of its
own summary job, while its bounded scope remains `PASS` at
`286/34/20/14/252`. The completed owner scope is unchanged: only offer `759`
received the approved stock restoration, 19 other offers received freshness-only
confirmation, and the exact 14 deferred offers received no writes and remain in
review. The producer correction must now prove itself on the next natural
ordinary schedule. No manual retailer refresh is authorized and the counter
remains `0/3`.

The successful 10 Reps job also improves, but does not complete, future replay
preservation. Artifact `11153320825` is retrievable until 15 October 2026 and
its archive and seven constituent files are now digest-indexed. It proves an
exact, disjoint `934` execution + `16` review partition over all `950` database
baseline rows, passing postflight and zero-write idempotency. It does not contain
the raw source response bytes, paired legacy/canonical row outputs, six-class
parity or offline repeat-replay evidence, and its expiring GitHub locator is not
durable storage. No production data was copied into Git and RA-004 remains
closed. The preserved index narrows the future artifact-first gap without
authorizing a capture, replay or retailer run. Evidence:
[`evidence/RA-STAB-01-EVIDENCE-PRESERVATION-AUDIT.json`](evidence/RA-STAB-01-EVIDENCE-PRESERVATION-AUDIT.json).

**Current 12-path classification — complete; observation continues:** the
timestamped read-only classification of watchdog `36852261994` assigns every
current result to the RA-STAB vocabulary with no unclassified failure. Two
older ordinary failures (Discount Supplements and KIOR Health) remain in the
pre-recovery ledger-selector class. Natural Jon's run `36853819770`, Simply
Supplements run `36856171813` and Dolphin Fitness run `36856895922`
independently live verified that shared correction on current `main`. Simply passed every
stage with `120` approved, `119` executed, one review and zero blocked; only
offer `673` returned in stock at unchanged `GBP 14.99`, the other 118 executions
were freshness-only, postflight found zero commercial delta, and fresh-source
idempotency made zero writes. Artifact `11158233377` has digest
`sha256:13f54a67...1a9e4`. Jon's remains `506/501/5/0`; its artifact
`11157711039` has digest `sha256:b6cdc18d...e6d3f`. Dolphin passed its exact
single-offer scope as freshness-only with zero commercial delta and zero-write
idempotency; artifact `11158809227` has digest `sha256:1d760a87...1140f`.
6 Pack is separately classified `SOURCE` because exact product `4150` returned
HTTP 404 after five bounded attempts. A subsequent read-only identity audit
confirmed that both the numeric URL and registered slug still return 404 with
no redirect. The retailer's live search contains related Good Guru products,
but none carries registered GTIN `854822007309`; the manufacturer's current
same-name 30 g Pearl product uses barcode `5060571822253`. That establishes an
unresolved identity discrepancy, not continuity, replacement or identity drift,
and gives no authority to mark the offer OOS or rebind it. Mapping `2565` and
offer `2379` remain unchanged. This read-only evidence only classifies the exact
row as requiring owner identity review; production and control state are
unchanged, and no retry or code patch is justified. Evidence:
[`evidence/RA-STAB-01-SIX-PACK-4150-SOURCE-AUDIT-2026-10-01.json`](evidence/RA-STAB-01-SIX-PACK-4150-SOURCE-AUDIT-2026-10-01.json).
That conclusion excludes an identity-specific replacement or stock patch. Later
repeated natural failures and implementation review identified a separate,
retailer-neutral source-failure scoping defect; its bounded correction is
recorded below.
Forensic review of eBay artifact
`11159580892` (digest `sha256:8c60a32c...a6c4c`) proved that its
`production-dry-run.json` was synthetic output from the preceding unit test, not
a live complete capture: every row uses `continuity_tier=test_exact`, has no HTTP
metadata and inherits its price from static scope. The scheduled invocation has
one proven live value for offer `2549`, `GBP 24.99` against database `GBP 26.99`;
the artifact cannot establish its exact API-capture time and does not prove a
second live `GBP 26.99` observation or recurrence. The importer correctly found
a commercial change, but a serialized no-op mapping update caused the strict
edge validator to fail the whole run before DB baseline, approval or writes.
The bounded retailer-neutral repair isolates test output in an injected temporary
directory and rebuilds offer-only deltas with the existing shared existing-offer
plan builder. Commercial rows remain review-only and strict executable validation
is unchanged. No price execution, retry, eBay exception or baseline widening is
authorized. The focused eBay suite passes `107/107`; quick and full quality
gates, Project Guardian and the production build pass. PR `#176` merged the
correction as `5c08e7e6` after CI, security and Vercel passed. The remaining
gate is read-only observation of the next natural schedule; do not dispatch it.
Fit House is the already-fixed
summary `FAILED_SYSTEM` pending natural producer proof; 10 Reps is genuine
`MONITORED_DEBT`. No retailer-specific patch is justified. Three independently
recovered paths still do not constitute a full cross-path interval, so the
counter remains `0/3`. Evidence:
[`evidence/RA-STAB-01-CURRENT-CLASSIFICATION-2026-10-01.json`](evidence/RA-STAB-01-CURRENT-CLASSIFICATION-2026-10-01.json).

**2 October ordinary observation — no interval credit; one bounded contract
repair:** natural schedules on `0bf7ff42` live verified the Fit House zero-action
producer fix and the shared Discount ledger correction. Whey Okay, Jon's,
Simply and Dolphin also completed with guarded postflight/idempotency evidence.
The interval is nevertheless atomic and remains `0/3`: Fit House and 10 Reps
have genuine stale/review backlog growth, 6 Pack failed closed on the already
classified product-4150 HTTP 404, KIOR had not yet produced a 2 October natural
run, and watchdog `37006401766` could not correlate the later Discount run.
eBay run `37000578631` safely applied 150 freshness-only rows, isolated 87
review rows and passed DB postflight with zero commercial/history delta, then
failed because its scheduled post-apply dry-run requested the existing evidence
contract while the writer allowed only `workflow_dispatch`. The bounded repair
accepts `schedule` or `workflow_dispatch` only in GitHub Actions on `main`, adds
a regression proving that the scheduled contract carries no owner confirmation,
and leaves manual apply authority unchanged. No dispatch, baseline widening or
retailer-specific shared-core branch is introduced. PR `#179` merged the repair
as `9af3e7e4`; Project Guardian and the full Quality Gate passed again on merged
`main`. Only a later natural eBay schedule and watchdog correlation can provide
live closure. Evidence:
[`evidence/RA-STAB-01-ORDINARY-OBSERVATION-2026-10-02.json`](evidence/RA-STAB-01-ORDINARY-OBSERVATION-2026-10-02.json).

**2 October recurring-backlog owner decision pack — D1 recorded, no write authority:**
ordinary run `36987322039` confirms one bounded decision scope rather than a
new implementation defect. Fit House again produced the exact 14 deferred stock
rows at source fingerprint `8074eefe...d6e991`: five false-to-true and nine
true-to-false. 10 Reps again produced the exact 16
`SOURCE_VARIANT_MISSING` rows at fingerprint `547a60dd...e0b6`: 12 belong to
source product `8036`, and four are single variants. Fourteen 10 Reps rows are
already OOS; only offers `3388` and `3627` are still in stock. The machine-readable
pack binds the rows to run, job, artifact, file, deferred-scope manifest and
database-baseline hashes. The owner subsequently recorded one bundled D1:
accept the exact observed Fit House stock values as business intent, keep all
16 10 Reps rows unchanged for read-only identity review, and permit only
read-only preparation of the exact 30-row Review Queue changeset. A later Fit
House execution still requires a separate exact manifest, preflight and owner
write authorization. No production wiring is assumed; publication and exact
control writes require separate reviewed, hash-bound decisions. Nothing here
authorizes a catalogue/control write, manual retry, baseline widening, new path
or RA-004 action; the ordinary counter remains `0/3`.
Evidence:
[`evidence/RA-STAB-01-BACKLOG-OWNER-DECISION-PACK-2026-10-02.json`](evidence/RA-STAB-01-BACKLOG-OWNER-DECISION-PACK-2026-10-02.json).

**2 October delayed natural KIOR readback — path pass, no interval credit:**
scheduled run `37017432524` started without manual dispatch on `main` commit
`a6bf579f` and completed all guarded stages. The exact 11 approved mappings and
offers classified `VERIFY_NO_CHANGE`; apply made 11 freshness-only business
writes through the guarded parent/child and per-row approval path, with no
commercial or history change. The diagnostic transaction count, two registered
control rows and 11 row approvals are separate layers and are recorded as such.
Read-only DB postflight found zero price, stock, shipping, total, URL, mapping
or price-history delta and exactly 11 freshness changes. A fresh source capture
repeated fingerprint `a8de1d3b...e602`, classified the same 11 no-change rows
and made zero business/control writes. This supplies the KIOR evidence that was
still pending at the earlier observation timestamp, but it does not change the
atomic `0/3` counter because the interval had already failed on the independent
Fit House/10 Reps backlog, 6 Pack source incident, eBay contract incident and
earlier watchdog boundary. No retry or baseline change is authorized. Evidence:
[`evidence/RA-STAB-01-KIOR-NATURAL-READBACK-2026-10-02.json`](evidence/RA-STAB-01-KIOR-NATURAL-READBACK-2026-10-02.json).

**2 October 10 Reps identity classification — read-only, no patches:** the 16
recurring `SOURCE_VARIANT_MISSING` rows separate into five evidence classes,
not 16 implementations. Twelve CNP identities were already reviewed OOS in
existing hash-bound manifests and remain missing; RYSE offer `3384` is already
OOS and its live product form has zero active variations; AK-47 Watermelon offer
`3496` is already OOS and explicitly labelled OOS on the live page. Those 14
rows need no catalogue write. Bulk offer `3388` has an exact same-product,
Vanilla 1 kg, GBP 13.49, in-stock successor candidate at external variant
`11696` instead of `9239`, but rebind remains a separate owner identity
decision. Cellucor offer `3627` remains ambiguous: Twisted Limeade is visible in
the selector but old ID `8783` is absent from the eight active purchasable
variations, so neither OOS nor replacement is inferred. The existing shared
isolation is correct; automatic actions and writes are zero. A generic terminal
outcome for the 14 already-OOS rows is only a candidate owner disposition; no
verified shared execution mechanism exists, and implementation would require a
separately reviewed common contract, regressions and authority. The remaining
work is one exact reviewed rebind and one unresolved stock/identity decision,
with no retailer-specific shared-core branch. The public-page normalized HTML
hashes are explicitly audit-local non-retained digests, not replay evidence.
Evidence:
[`evidence/RA-STAB-01-10REPS-IDENTITY-AUDIT-2026-10-02.json`](evidence/RA-STAB-01-10REPS-IDENTITY-AUDIT-2026-10-02.json).

**2 October RA-STAB-01-D1 decision and read-only Review Queue changeset:** the
owner accepted the recorded source stock state as the business disposition for
the exact 14 Fit House rows, kept all 16 10 Reps rows unchanged for read-only
identity review, and authorized preparation only of a Review Queue changeset
for those 30 rows. One bounded builder now reuses the existing common publisher
library; it has no apply mode and its production reader exposes only selects and
counts, with no insert, update, delete, upsert or RPC call. Fresh production
readback at `2026-10-02T15:08:41.913Z` matched all 30 offer, mapping, canonical,
external identity, price, stock and URL bindings. Both retailers had zero active
Review Queue rows. The exact preview is therefore `CREATE 14` for Fit House and
`CREATE 16` for 10 Reps, with zero refresh, supersede or resolve operations.
Bundle SHA-256 is `1711e71f...c1c8bd0`; Fit House changeset fingerprint is
`523b6829...61c62d8` and 10 Reps is `e08f0052...4ecd74e`. Preparation performed
zero database and catalogue writes. Queue publication, workflow wiring, stock
execution, identity rebind, retry and every RA-004 action remain unauthorized;
the next gate is independent implementation review followed by a separate exact
owner control-write decision if publication is later wanted. This manual
preparation earns no ordinary interval credit, so the counter remains `0/3`.
Evidence:
[`evidence/RA-STAB-01-D1-REVIEW-QUEUE-CHANGESET-2026-10-02.json`](evidence/RA-STAB-01-D1-REVIEW-QUEUE-CHANGESET-2026-10-02.json).

**2 October RA-STAB-01-D1 post-merge implementation review:** an independent
read-only review of merged PR `#184` recomputed the sealed bundle hash, confirmed
the exact `14 + 16` scope and 30 unique `CREATE` previews, and found no apply
CLI, imported publication executor or production mutation/RPC call in the D1
builder. Its production surface is select/count only and the common Review Queue
lifecycle planner remains the sole changeset mechanism. The focused suite passes
`4/4`; the merged full Quality Gate, Project Guardian, GitGuardian and Vercel
checks are green. There are no blocking implementation findings. The preview is
time-bound: its source manifests expire on 9 October, so it is not evergreen
publication authority. Any later publication requires a fresh exact production
and active-queue readback plus a separate owner control-write authorization.
This review made zero database, catalogue or Review Queue writes and leaves the
ordinary counter at `0/3`. Evidence:
[`evidence/RA-STAB-01-D1-IMPLEMENTATION-REVIEW-2026-10-02.json`](evidence/RA-STAB-01-D1-IMPLEMENTATION-REVIEW-2026-10-02.json).

**3 October natural watchdog readback — stable red partition, no interval
credit:** scheduled watchdog runs `37070747208` and `37098906183` both ran on
merged `main` commit `7470cf4`, inspected all 12 retailers, made zero database
writes and produced the same closeout snapshot and exact five-retailer failure
partition. KIOR is `PASS`; Simply is `PASS_WITH_REVIEW`; five other retailers
remain monitored-only. Fit House's exact 14 and 10 Reps' exact 16 are the known
D1 scopes and remain outside the old baseline because publication and business
writes are not authorized. Jon's now has five exact `SOURCE_VARIANT_MISSING`
rows in two consecutive natural captures: old baseline row `1209`, plus already-
OOS offers `1197`, `1456`, `1457` and `1458`. Its ordinary guarded run isolated
those five, completed 501 freshness-only confirmations and passed DB postflight
with zero commercial/stock writes. 6 Pack again failed closed before baseline or
apply because product `4150` returned HTTP 404 after five attempts; its reported
12-row review scope is the retained last-complete 28 September evidence, adding
offer `2255` to the older 11-row baseline, not a classification produced by the
failed run. eBay still points to pre-fix run `37000578631`; no natural run on the
merged contract correction existed by `06:21Z`. No threshold/baseline change,
retry, Review Queue publication or retailer-specific fix is justified. The
atomic ordinary counter remains `0/3`; next evidence must be the post-fix natural
eBay schedule followed by a later natural watchdog. Evidence:
[`evidence/RA-STAB-01-NATURAL-WATCHDOG-READBACK-2026-10-03.json`](evidence/RA-STAB-01-NATURAL-WATCHDOG-READBACK-2026-10-03.json).

**3 October Jon's five-row identity classification — read-only, no rebind:**
the exact five `SOURCE_VARIANT_MISSING` rows recur across the 1 and 2 October
natural captures. Four are already OOS and stay unchanged. Offer `1197` is old
Fruit Salad; its apparent SKU successor `CNP27003` is already correctly bound by
mapping `1208` / offer `1022` to the distinct Fruit Twist canonical variant, so
it cannot be reused. Offers `1456` and `1458` belong to a removed Efectiv 2 kg
product and their flavours are absent from the current 1.8 kg product. Offer
`1457` has a same-flavour 1.8 kg candidate, but the size, source product, source
variant and price all changed, so it is not a safe rebind to the existing 2 kg
canonical variant. Offer `1209` is the sole unresolved in-stock row: the exact
CNP 2 kg product remains live, but Cherry Bakewell and the old variant ID are
absent; no same-product successor is proven. It stays unchanged pending one
separate owner stock/identity disposition. Public JSON response hashes are
audit-local evidence, not retained replay artifacts. No baseline, queue,
catalogue or control write and no new code path is authorized; the counter stays
`0/3`. Evidence:
[`evidence/RA-STAB-01-JONS-IDENTITY-AUDIT-2026-10-03.json`](evidence/RA-STAB-01-JONS-IDENTITY-AUDIT-2026-10-03.json).

**3 October WooCommerce source-failure scoping correction — locally verified,
awaiting review and natural evidence:** repeated product-`4150` terminal HTTP
404 evidence exposed a general contract mismatch rather than a 6 Pack identity
rule. The existing shared mapped WooCommerce reader continued after every
product-page failure, including ambiguous access and server failures, while the
6 Pack wrapper stopped all `506` offers on the first failed product. The bounded
candidate introduces one shared disposition: only a controlled terminal HTTP
404 bound to the exact requested product can be product-scoped; `403`, `429`,
`5xx`, timeout, network, schema, redirect, identity and uncontrolled failures
remain retailer-scoped and fail closed. The shared mapped reader and 6 Pack now
consume that same contract. There is no product ID, retailer ID or retailer name
in the decision function.

For an isolated product-scoped 404, all approved rows bound to that product are
omitted from the executable artifact, classified through the existing
`SOURCE_VARIANT_MISSING` review path, retain their current catalogue state and
carry structured source-failure evidence; no OOS, price or successor identity
is inferred. The source fingerprint binds both successful rows and failures.
The existing configured `0.9` minimum product-page ratio is now wired into the
6 Pack classifier, so a broad series of individually valid 404s still trips
`SOURCE_COLLAPSE`. Reviewed owner selectors continue to require full source
coverage and cannot consume the new partial-source path.

The exact incident regression proves product `4150` / offer `2379` becomes the
sole review row in an otherwise unchanged `506`-row fixture, with `505`
executable plans, zero blocked rows, no proposed offer and no plan for offer
`2379`. Separate regressions prove a network failure still blocks all `506`, a
broad 404 series trips `SOURCE_COLLAPSE`, and the shared reader refuses `403`,
`503` and identity drift. The focused contract suite passed `83/83`, and both
`npm run verify:quick` and `npm run verify:full` passed, including the production
build. No workflow, executor, approval path, database,
catalogue, Review Queue, baseline or schedule was changed. This is not live
proof and earns no interval credit: after independent review and merge, only
the next natural 6 Pack schedule may verify the production
partition. Do not dispatch it manually and do not pre-authorize a watchdog
baseline change. Evidence:
[`evidence/RA-STAB-01-WOOCOMMERCE-SOURCE-FAILURE-SCOPING-2026-10-03.json`](evidence/RA-STAB-01-WOOCOMMERCE-SOURCE-FAILURE-SCOPING-2026-10-03.json).

**3 October post-fix natural 6 Pack and eBay readback — both production paths
pass, central watchdog correlation correction locally verified:** natural 6 Pack
run `37111838580` on merge `be4a54f` completed the full guarded sequence. Its
fresh partition was `506 = 492 execution + 14 review`, with zero blocked rows.
Exact source product `4150` remained the sole product-scoped 404 and offer
`2379` stayed review-only as `SOURCE_VARIANT_MISSING`; the other current review
debt is the eleven old MASS_OOS rows, offer `2255` MASS_OOS and offer `2378`
HARD_PRICE_ANOMALY. Postflight proved all 492 executions were freshness-only,
with zero price, stock, shipping, total, URL or price-history delta. Fresh-source
idempotency executed zero rows and made zero writes. The shared WooCommerce
source-failure correction is therefore live verified without an inferred OOS,
replacement or rebind.

Natural eBay run `37117068397` on the same merge completed `237 = 145 execution
+ 92 review`, zero blocked. All 145 executions were freshness-only; postflight
and same-run idempotency passed with zero commercial, URL or price-history
delta. The existing reconciliation publisher then created 37 current Review
Queue rows, refreshed 55, superseded 21 and resolved two by source, with zero
catalogue writes. The 92 current review rows — 34 commercial, 50 identity and
eight source failures — are genuine decision debt and are not widened into an
automatic scope.

The later natural watchdog `37120043308` correlated the 6 Pack success but
reported the successful eBay run incomplete. Its immutable artifact proves the
cause: the eBay workflow contains two mutually exclusive legal acquisition
steps. `Fresh read-only preflight` was skipped on the scheduled apply, while
`Prepare exact approved existing-offer refresh` succeeded; the central
correlator accepted only the former exact name. The bounded correction upgrades
the closed watchdog configuration to semantic stage arrays for every retailer.
The shared resolver records exactly one non-skipped alternative and fails closed
if more than one alternative executes. There is no retailer check in shared
code and no workflow, importer, approval or executor change. The focused suite
passes `42/42`; both `verify:quick` and `verify:full` pass, including the
production build; and every configured stage name is present in its bound
workflow. Direct replay of run `37117068397` now yields `COMPLETE_SUCCESS` with
its exact capture, apply, postflight and idempotency steps. PR `#189` passed the
full Quality Gate, Project Guardian, GitGuardian and Vercel checks and merged as
`a9bc49f`. A later natural watchdog on that merge remains required. Genuine Fit
House, Jon's, 6 Pack, eBay and 10 Reps review/stale debt still prevents atomic
interval credit, so the counter remains `0/3`; do not widen the baseline or
dispatch a retailer manually.
Evidence:
[`evidence/RA-STAB-01-NATURAL-SIX-PACK-EBAY-READBACK-2026-10-03.json`](evidence/RA-STAB-01-NATURAL-SIX-PACK-EBAY-READBACK-2026-10-03.json).

**3 October five-retailer review-debt map — read-only grouping, no per-offer
patch programme:** the current Fit House, 10 Reps, Jon's, 6 Pack and eBay
evidence contains 141 review rows, but they reduce to four operational
workstreams: 18 terminal no-catalogue-change candidates, 61 commercial decision
rows, 54 identity decision rows and eight eBay source failures that require a
natural reobservation before any business decision. The eBay 92 split is exact:
34 commercial changes (`24` price, `7` stock and `3` price-plus-stock), 50
identity conflicts (`32` reject and `18` review), and eight source-read
failures. Ten eBay stock changes are returns to stock; none is an inferred OOS.

This classification deliberately rejects a 141-patch approach. Already-OOS
10 Reps and Jon's rows need no catalogue mutation; commercial and identity work
must remain in separate, retailer-bound decision packs using existing guarded
paths; source failures must be recaptured naturally. The audit grants no queue
publication, terminal disposition, catalogue/control write, rebind, baseline
change, manual dispatch or RA-004 action and leaves the counter at `0/3`. The
first natural watchdog on merge `a9bc49f` is still required before another
implementation starts. Evidence:
[`evidence/RA-STAB-01-REVIEW-DEBT-DECISION-MAP-2026-10-03.json`](evidence/RA-STAB-01-REVIEW-DEBT-DECISION-MAP-2026-10-03.json).

**3 October natural watchdog after the alternate-stage merge — eBay verified,
Discount history omission isolated, 10 Reps stopped before business writes:**
scheduled watchdog `37135856072` ran on merged `main`, made zero database writes
and reported no global infrastructure failure. It now recognizes eBay run
`37117068397` as one exact `COMPLETE_SUCCESS`; the alternate-stage correction
is therefore live verified. eBay remains red only for its genuine monitored
backlog.

Discount was a monitoring false negative, not a failed retailer run. The
watchdog's standard completed-run page omitted natural success `37121588423`
and exposed old runs instead. The authoritative run and artifact show `109/109`
executions, a passing postflight, 109 freshness changes, no price or history
delta and one observed stock change. A direct read-only correlator replay picks
that fresh run as `COMPLETE_SUCCESS`. The generic correction retains the normal
history page and adds one official `created >= freshness cutoff` anchor request;
an omitted fresh run is merged by immutable ID and reported. Malformed, multiple
or older anchors fail closed. There is no retailer condition or producer,
approval, executor, workflow or guardrail change.

The same evidence identifies one real incomplete event: the 10 Reps job in
shared natural run `37110115566` prepared `934` freshness-only rows and isolated
`16` source-variant reviews, then hit `Query read timeout` after control
registration. Approver, executor, postflight and idempotency did not run;
business writes, approvals created and approvals consumed are all zero. The
expired parent `06ae81b7-4cc1-42b5-af6a-92bfd17e6dfa` requires a fresh read-only
control-state check. No retry or close action is authorized. Focused regression
passes `44/44`; `verify:quick` and `verify:full`, including the production build,
pass. Green CI remains the merge gate. The observation counter remains `0/3`.
Evidence:
[`evidence/RA-STAB-01-NATURAL-WATCHDOG-HISTORY-ANCHOR-2026-10-03.json`](evidence/RA-STAB-01-NATURAL-WATCHDOG-HISTORY-ANCHOR-2026-10-03.json).

**3 October Review Queue usability checkpoint — one simpler view, not another
approval path:** the admin queue now opens on rows that require a human
decision, states the exact question to answer and keeps status, scope and
technical filters under one optional section. Approval is visibly separate
from execution: the pending-row and bulk controls only record an approval;
execution remains the existing later protected action with the same adapter,
fingerprint, expiry, source-revalidation and zero-write retry guards.

Search now operates over the complete bounded result before 50-row pagination,
so a matching offer is not missed merely because it was on a later page. The
read-only loader uses exact-count batches of 1,000 with a hard 5,000-row limit
and fails closed on count drift, duplicate IDs, truncation or overflow. It adds
no writer, route, retailer condition, capability or database change. Regression
proves a target at position 65 is found before pagination. The focused suite
passes `45/45`; TypeScript, ESLint, `verify:quick` and `verify:full` pass,
including the production build. No test file was added, removed or renamed.
PR `#192` passed Project Guardian, the full Quality Gate, GitGuardian and
Vercel, then merged as `e8590ef`; the full post-merge gate on `main` also
passed. Vercel reports the merge deployed, and an unauthenticated production
readback returns `307` to `/admin/login`, confirming the admin boundary remains
closed. An authenticated read-only UI check still requires a valid admin
session. This checkpoint made zero production decisions or writes and does not
change the stabilization counter (`0/3`). Evidence:
[`evidence/RA-STAB-01-REVIEW-QUEUE-UX-SIMPLIFICATION-2026-10-03.json`](evidence/RA-STAB-01-REVIEW-QUEUE-UX-SIMPLIFICATION-2026-10-03.json).

**4 October two natural watchdogs on the merged history correction — stable
read-only result, no ordinary interval credit:** scheduled runs `37154045897`
and `37180679396` both executed on merged `main` SHA `e741b01`, inspected all
12 retailers, reported no database/global infrastructure error and made zero
database writes. Their artifacts are semantically identical after removing the
generation timestamp. Discount is now correctly recognized from natural run
`37121588423` as `COMPLETE_SUCCESS` and
`PASS_WITH_MONITORED_BACKLOG`; the prior history false negative did not recur.
The fallback anchor was not exercised because the standard listing contained
the fresh run, so anchor recovery itself is not claimed as live-tested.

Five genuine red results remain unchanged: Fit House has 14 review rows and
stale scope, Jon's has five review/stale rows, 6 Pack has 14, eBay has 92 review
rows and 87 stale offers, and 10 Reps still points to incomplete run
`37110115566` with 16 review/stale rows. No new ordinary retailer run occurred
between the watchdogs, so these are two observations of one state rather than
two qualifying intervals. Counter remains `0/3`; no retry, baseline widening,
control action or RA-004 action is authorized. Next perform only the separately
bounded fresh read-only check of the expired 10 Reps parent and 19-child tree,
then await new natural retailer runs and a later natural watchdog. Evidence:
[`evidence/RA-STAB-01-NATURAL-WATCHDOGS-2026-10-04.json`](evidence/RA-STAB-01-NATURAL-WATCHDOGS-2026-10-04.json).

**4 October interrupted 10 Reps registration preservation — exact control
identity retained, current state still unverified:** before GitHub artifact
`11270160626` expires on 17 October, its immutable bundle was downloaded once
and hash-checked. A redacted tracked record now preserves parent
`06ae81b7-4cc1-42b5-af6a-92bfd17e6dfa`, its parent/source/manifest
fingerprints, all 19 child IDs and child fingerprints, mapping count `950`, the
`Query read timeout` classification and exact zero-business-write accounting.
No raw source, database baseline rows, commercial rows, secret or credential
was copied into Git.

This is registration-time evidence, not a current database readback. It does
not prove the present parent/child statuses and contains no approval ID because
the approver never ran. The source archive is still retention-limited and is
not a recorded-replay bundle. The next gate remains one separately authorized,
fresh read-only export of exactly this parent and 19-child tree, failing closed
if it needs a new migration or broader capability. No retry, close, approval,
capture, replay or RA-004 action is authorized. Evidence:
[`evidence/RA-STAB-01-10REPS-INTERRUPTED-CONTROL-REGISTRATION-2026-10-04.json`](evidence/RA-STAB-01-10REPS-INTERRUPTED-CONTROL-REGISTRATION-2026-10-04.json).

**4 October owner-authorized 10 Reps read-only export preflight — stopped
before connection:** the owner authorized exactly one current-state export with
no writes, retry, close or RA-004 replay. The fail-closed preflight found that
the existing transactional control-state RPC and provider-identity correction
remain excluded from the production selector, while the prior temporary
credentials are closed and no dedicated production exporter identity is
available. The broader owner, validator, service-role and raw-SQL paths are not
valid substitutes. The attempt therefore stopped before any production
connection or database read and made zero writes; no export artifact was
created. A later export would require separate authority for production
deployment of the already reviewed narrow interface and for one short-lived
dedicated read-only identity. Evidence:
[`evidence/RA-STAB-01-10REPS-READONLY-EXPORT-PREFLIGHT-2026-10-04.json`](evidence/RA-STAB-01-10REPS-READONLY-EXPORT-PREFLIGHT-2026-10-04.json).

**4 October bounded plan-tree readback — owner authorized and locally
prepared:** deeper review proved the historical RA-004 v1 interface cannot be
deployed to production as-is: it is bound to the staging ledger and requires
five evidence writes before its read. The smaller safe route reuses the already
deployed `public.get_retailer_catalogue_plan_status(uuid)` RPC. One temporary
login, valid for at most ten minutes, receives no table privileges or role
memberships and is confined by one static `REPEATABLE READ READ ONLY` call,
then disabled in its own committed transaction, terminated, revoked and
dropped. The coordinator invokes cleanup by the fixed role name after a lost
credential reply and has a separate cleanup-only mode that is not gated by the
migration ledger, Git state or implementation hashes.
The temporary plaintext password is never interpolated into SQL or written to
an artifact; PostgreSQL receives only its SCRAM verifier. The result is accepted only
if the exact parent fingerprint and all 19 child IDs/fingerprints match the
preserved registration. It reports apply/rollback runs but cannot claim the
full eleven-source RA-004 clearance or authorize close, retry or replay. The
failure paths have local regression coverage, including an isolated PostgreSQL
17 lifecycle test that proves SCRAM login, forced session termination,
committed `NOLOGIN`, revoke-before-drop and a deliberately blocked `DROP ROLE`.
The termination check is bounded to two seconds; a slower shutdown fails closed
and enters rescue cleanup. Live cleanup remains a required production
postcondition rather than a pre-execution claim. Authorization is
bound to exact implementation hashes and execution requires a
freshly fetched, clean merged `main`. The owner authorized this complete
bounded package on 4 October. Preparation:
[`evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-PREPARATION-2026-10-04.json`](evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-PREPARATION-2026-10-04.json).

**4 October one-shot attempt — consumed before database authentication:** PR
`#196` merged at `5f064c8860f7f1d97cdbf0132e89f89dc630b0fc` after green CI. The
clean-`main` execution reached the verified-TLS boundary without the private
Supabase Root 2021 CA and stopped with `self-signed certificate in certificate
chain`. It authenticated no database session, executed no SQL or RPC, created
no role and produced no export. Cleanup-only was then run with the official CA
after verifying its SHA-256 certificate fingerprint
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`;
its authenticated cleanup readback found the fixed role, memberships, backends
and target grants absent, with zero RPC calls. The TLS failure before database
authentication is the separate basis for concluding that the failed execution
created no role. The authorization is consumed and no retry is
authorized. The regression requires and fingerprints the CA before an attempt
marker or credential creation. Evidence:
[`evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-ATTEMPT-2026-10-04.json`](evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-ATTEMPT-2026-10-04.json).

**4 October second one-shot readback authorization — prepared, not yet
executed:** after the first authorization was terminally consumed before
database authentication, the owner explicitly authorized one new read-only
export on the same boundaries: no business or control writes, retry, close,
retailer refresh or RA-004 replay. The new preparation preserves the exact
parent and 19-child identity, uses a distinct fixed temporary role, marker and
result path, and requires the verified Supabase Root 2021 CA before Git or
credential activity. The first attempt and its cleanup evidence remain
immutable. Execution is permitted only once from a clean, freshly fetched
merged `main`; any attempted execution consumes this new authority. Preparation:
[`evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-PREPARATION-V2-2026-10-04.json`](evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-PREPARATION-V2-2026-10-04.json).

**4 October second one-shot attempt — consumed during capability proof, cleanup
verified:** PR `#198` merged the exact preparation at `0cf8f484`. The clean
`main` execution passed the pinned CA, repository, target, ledger and deployed
RPC checks, then PostgreSQL evaluated `has_sequence_privilege` against the
unrelated index `saml_providers_pkey` before the query's relation-kind filter.
The credential-creation transaction rolled back, so the temporary role and its
grants did not become durable; the plan-status RPC was never called and no
result or digest was created. Mandatory cleanup completed, and a separate
cleanup-only readback found the role already absent with no login, membership,
backend or target grant. The authorization is consumed and must not be retried.
The common fix guards privilege functions with `CASE` by relation kind and adds
a PostgreSQL regression containing the formerly triggering primary-key index;
it changes no retailer, catalogue, approval or execution policy. Evidence:
[`evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-ATTEMPT-V2-2026-10-04.json`](evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-ATTEMPT-V2-2026-10-04.json).

**4 October third and final one-shot readback authorization — prepared, not
yet executed:** after the common relation-kind capability fix merged at
`36e4a31`, the owner explicitly authorized one final read-only export of the
same exact parent and 19 children. V3 has its own temporary role, credential
identity, write-once marker, output and digest paths. V1 and V2 remain terminal
and immutable. The unchanged boundary permits no business or control writes,
retry, close, retailer refresh or RA-004 replay; any attempted V3 execution
consumes the authorization. Execution requires the pinned Supabase Root 2021
CA and a clean, freshly fetched merged `main`. Preparation:
[`evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-PREPARATION-V3-2026-10-04.json`](evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-PREPARATION-V3-2026-10-04.json).

**4 October third and final one-shot attempt — consumed at the effective
capability boundary, cleanup verified:** PR `#200` merged the V3 preparation at
`cb93270e`. The clean-`main` execution passed the pinned CA, repository, target,
ledger, deployed RPC and corrected relation-kind checks. Before enabling the
temporary login, the fail-closed post-grant proof found at least one effective
capability broader than the dedicated status RPC contract and stopped with
`RA_STAB_EPHEMERAL_CAPABILITY_TOO_BROAD`. V3 did not persist which proof field
was true, so the ledger does not guess whether the source was an effective
PUBLIC relation privilege, another PUBLIC SECURITY DEFINER function or a
different rejected capability. The creation/grant transaction rolled back; the
plan-status RPC was never called and no result or digest was created. Mandatory
cleanup completed, and a separate cleanup-only readback found the role already
absent with no login, membership, backend or target grant. The third and final
authorization is consumed. No fourth attempt, guard bypass or privilege
widening is authorized; a future solution requires a separately reviewed
readback architecture that can prove least privilege against the real
production ACL surface before execution. Evidence:
[`evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-ATTEMPT-V3-2026-10-04.json`](evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-ATTEMPT-V3-2026-10-04.json).

**4 October central readback repair - live ACL cause verified, local common fix
prepared, production unchanged:** one new read-only production inventory used a
single `REPEATABLE READ READ ONLY` transaction, no retry, no plan-status call
and no write. It proved that V3 combined actual reachability with global
effective privileges. `public.rls_auto_enable()` was PUBLIC-executable through
inherited `public` schema usage even though the canonical baseline revokes that
grant. Two PUBLIC-readable extension statistics views were also counted by V3,
although the caller could not use their `extensions` schema. The prepared
common migration restores the baseline revoke, creates one private,
retailer-neutral status wrapper and one reusable caller role in `NOLOGIN`
state. It adds no table, sequence, importer, writer, retailer condition or
RA-004 path. The migration is SHA-bound and isolated as production `PENDING`,
so ordinary selection cannot deploy it. Focused tests and the isolated
PostgreSQL 17 capability test pass. Production still has no new schema, role or
function, and the 10 Reps state remains unread. Applying the migration is the
next exact owner gate. Evidence:
[`evidence/RA-STAB-01-CENTRAL-READBACK-ACL-INVENTORY-2026-10-04.json`](evidence/RA-STAB-01-CENTRAL-READBACK-ACL-INVENTORY-2026-10-04.json).

**4 October first central deployment attempt - transaction rolled back before
credential activation or read:** PR `#202` merged the reviewed package at
`209ffbe2` after green CI. Production accepted the target, ledger and migration
preflight, but its managed `postgres` owner could not `SET ROLE` to the newly
created purpose owner during `ALTER FUNCTION OWNER`. The migration transaction
rolled back. A separate read-only verification proved ledger `223`, both roles,
the private schema, wrapper, ledger entry and caller backend were all absent.
The 10 Reps RPC was never called. The forward correction removes the
unnecessary ownership transfer and extra owner role; the private wrapper stays
owned by the existing production `postgres` owner while the reusable caller
remains narrowly granted and `NOLOGIN`. The PostgreSQL 17 regression now drops
`SUPERUSER` from its migration owner before apply so it reproduces the managed
production restriction. No retry is authorized. Evidence:
[`evidence/RA-STAB-01-CENTRAL-READBACK-DEPLOYMENT-ATTEMPT-2026-10-04.json`](evidence/RA-STAB-01-CENTRAL-READBACK-DEPLOYMENT-ATTEMPT-2026-10-04.json).

**4 October central interface production closeout:** PR `#203` merged the
managed-owner correction at `a672e720`. Production now contains migration
`20261004120000` at the reviewed SHA and ledger count `224`. The authorized
caller completed exactly one read-only RPC for the exact 10 Reps parent and 19
children; the existing validator accepted the parent and every child identity
and fingerprint. The first immediate cleanup check raced with the closing
caller connection and stopped report persistence with
`CENTRAL_BACKEND_REMAINS`. Cleanup-only repeated no plan read: it committed
`NOLOGIN`, terminated the residual backend and proved backend count zero. A
separate repeatable-read postflight proved the migration SHA from the ledger,
the caller disabled with no memberships or direct source-RPC permission, and
the private wrapper as its only execute grant. There were no retries, close,
RA-004 or business/control-data writes. Because the validated read result was
held only in process memory and report persistence followed cleanup, the actual
status values and run rows are not recoverable and must not be inferred. Any
future state read is a new owner decision. Evidence:
[`evidence/RA-STAB-01-CENTRAL-READBACK-PRODUCTION-CLOSEOUT-2026-10-04.json`](evidence/RA-STAB-01-CENTRAL-READBACK-PRODUCTION-CLOSEOUT-2026-10-04.json).

**4 October owner-authorized durable readback remediation — prepared:** the
repository contract is reconciled to the already verified production ledger
`224`; migration `20261004120000` moves from pending to applied-excluded without
executing SQL. The new tracked central runner contains no migration/deploy path.
It validates the exact Supabase CA before marker or credential access, permits
one parameterized read-only RPC, writes an immutable validated-result artifact
before cleanup, then requires `NOLOGIN`, bounded backend termination and a
separate immutable cleanup receipt. A cleanup failure preserves the result and
can only be finalized by cleanup-only mode with zero additional RPC calls. The
owner authorized exactly one new read of the same parent plus 19 children as
part of completing all five stated next steps; retry, close, RA-004 and
business/control-data writes remain forbidden. The already deployed Review
Queue simplification is retained; this changeset only removes its hidden legacy
combined approve-and-execute action and adds deterministic complete-read order.
Preparation:
[`evidence/RA-STAB-01-10REPS-CENTRAL-READBACK-PREPARATION-V4-2026-10-04.json`](evidence/RA-STAB-01-10REPS-CENTRAL-READBACK-PREPARATION-V4-2026-10-04.json).

**4 October durable 10 Reps readback and Review Queue verification â€” verified
complete:** PR `#205` merged at `1248d208`. The new runner made exactly one
production status RPC and saved the validated result before cleanup. The exact
parent remains `APPROVED`; child `0` remains `APPROVED` with its approval
expired on 3 October, children `1`â€“`18` remain `PLANNED`, and there are no run
rows. The bounded result is therefore `REGISTRATION_NON_TERMINAL_NO_RUNS`, not
evidence of an apply. The first cleanup proof failed after the result was
already durable; cleanup-only mode made zero status RPCs, restored `NOLOGIN`,
proved zero backends and sealed a separate receipt. Total accounting is one
read, zero retries, zero close/RA-004 calls and zero business/control-data
writes. The one-shot preparation is now consumed, so a fresh checkout cannot
replay it. Authenticated production UI readback also passed for Review Queue:
the simpler decision view, collapsed secondary filters and separate
approval/execution wording are live, while the removed combined action is
absent. Production did not have a second page of offers, so the larger
cross-page search contract remains proven by the 75-row regression fixture.
No decision or execution was submitted. The bounded 10 Reps readback subtask
is `VERIFIED_COMPLETE`; RA-STAB-01 remains `IN_PROGRESS` at ordinary interval
counter `0/3`. Evidence:
[`evidence/RA-STAB-01-10REPS-CENTRAL-READBACK-V4-CLOSEOUT-2026-10-04.json`](evidence/RA-STAB-01-10REPS-CENTRAL-READBACK-V4-CLOSEOUT-2026-10-04.json) and
[`evidence/RA-STAB-01-REVIEW-QUEUE-UX-SIMPLIFICATION-2026-10-03.json`](evidence/RA-STAB-01-REVIEW-QUEUE-UX-SIMPLIFICATION-2026-10-03.json).

**5 October first natural observation after the V4 closeout — no dispatch and
no interval credit:** scheduled watchdog `37235410756` ran on merged commit
`f9445779`, made zero database writes and had no database or global failure.
It still correlated retailer schedules from before that merge. Seven retailer
results were red: Whey Okay and KIOR ended incomplete; Fit House, Jon's,
6 Pack and eBay exceeded their monitored backlog contracts; and 10 Reps had an
incomplete latest attempt plus stale execution evidence and backlog growth.
The separate GYM HIGH source monitor failed closed on a bounded source HTTP
error, while the watchdog still classified the catalogue path as
`PASS_WITH_MONITORED_BACKLOG`; no retailer-specific patch follows from it.
This observation used no retry, RA-004 action, baseline widening, catalogue,
control or Review Queue write. Counter remains `0/3`. The next gate is one
complete natural retailer cycle after `f9445779` and the first later scheduled
watchdog. If that fresh cycle is red only for backlog growth, use the existing
owner-decision Review Queue path; do not change the baseline. Evidence:
[`evidence/RA-STAB-01-POST-V4-NATURAL-OBSERVATION-2026-10-05.json`](evidence/RA-STAB-01-POST-V4-NATURAL-OBSERVATION-2026-10-05.json).

**5 October shared expired-plan recovery consolidation — locally verified,
deployment pending:** the next natural shared refresh, run `37291179712`, read
all 950 approved 10 Reps mappings and classified 933 freshness confirmations,
one price update and 16 review rows. It then failed closed before any write with
`RSBI_REPLAY_BLOCKED` because parent
`06ae81b7-4cc1-42b5-af6a-92bfd17e6dfa` remains the exact expired,
unexecuted 1-approved/18-planned tree proved by the durable readback. The
implementation does not add a 10 Reps exception, migration, database function,
approval RPC or business writer. It replaces the store-specific Simply close
runner with one retailer-neutral coordinator in the existing shared workflow
and reuses `close_expired_retailer_offer_sync_approval(jsonb)`. The coordinator
requires a repeatable-read exact preflight, zero apply/row-approval/recovery
evidence, the live migration ledger and unchanged business counts before one
confirmed close call; postflight requires all children expired and the same
business counts. Focused tests, Project Guardian, inventory, quick/full gates
and the production build pass. Production remains unchanged. The next exact
gate is green merge followed by one bound control-only recovery dispatch and
its read-only postflight; no refresh retry or RA-004 action is bundled into the
close. Evidence:
[`evidence/RA-STAB-01-SHARED-CONTROL-RECOVERY-PREPARATION-2026-10-05.json`](evidence/RA-STAB-01-SHARED-CONTROL-RECOVERY-PREPARATION-2026-10-05.json).

**5 October shared expired-plan recovery — production verified:** PRs `211`,
`212` and `213` merged one retailer-neutral coordinator and two common contract
corrections. Runs `37302927313` and `37304222467` failed closed during read-only
preflight and made no close call or business write. Run `37305276770` then
performed the only close call against the existing RPC. The exact parent and
all 19 children are `EXPIRED`; the approval is closed but unconsumed; apply
runs, row approvals and recovery records remain zero. The result reports 21
control writes, zero business writes, zero price-history writes and zero
automatic retries. Postflight confirmed unchanged catalogue counts. This
control-only subtask is `VERIFIED_COMPLETE`. The next gate is one fresh ordinary
10 Reps cycle through the existing shared workflow, followed by its standard
postflight and fresh Review Queue publication; no old plan is replayed.
Evidence:
[`evidence/RA-STAB-01-SHARED-CONTROL-RECOVERY-CLOSEOUT-2026-10-05.json`](evidence/RA-STAB-01-SHARED-CONTROL-RECOVERY-CLOSEOUT-2026-10-05.json).

**5 October first fresh 10 Reps execution gate after recovery — waiting on the
external source:** manual ordinary-path runs `37305756452` and `37306729009`
both stopped at `SOURCE_FETCH` after the existing three bounded attempts timed
out. Each received zero bytes and stopped before validation, plan creation,
approval or apply. Both report zero attempted/completed database writes, zero
business/control writes and zero approvals. The earlier replay blocker did not
recur, so the shared expired-plan recovery is not implicated. Do not add a
retailer-specific fallback, reuse a stale feed, raise the timeout without source
evidence or launch another manual retry. The next exact gate is the next
ordinary scheduled shared-retailer cycle. Only a fresh complete feed may proceed
to the normal 10 Reps execution and fresh Review Queue publication. RA-STAB-01
remains `IN_PROGRESS`; ordinary observation credit remains `0/3`. Evidence:
[`evidence/RA-STAB-01-10REPS-SOURCE-OUTAGE-2026-10-05.json`](evidence/RA-STAB-01-10REPS-SOURCE-OUTAGE-2026-10-05.json).

**Acceptance:**

- one timestamped inventory for all 12 configured retailers;
- every failure has one evidence-backed class, blocking scope and next action;
- no silent row and no normal review reported as `FAILED_SYSTEM`;
- no new retailer-specific shared-core branch, workflow, approval path or writer;
- every code fix has a common regression and passes quick/full gates;
- three consecutive ordinary intervals satisfy the observation contract;
- final read-only watchdog and postflight evidence agree;
- all writes, if later separately approved, have exact before/after evidence and
  independent readback.

**Hard stop conditions:** stop before implementation if current code,
documentation and production evidence conflict; a fix requires a new
retailer-ID/name branch; the same incident cannot be reproduced in a fixture;
the proposed action weakens source, identity, stale-state, approval, atomicity,
postflight or idempotency guards; or required recovery authority is absent.

**Rollback:** documentation-only reset is reverted as one commit. Any later
runtime change must have its own task-local rollback; no task may delete control
history, approvals, price history or review evidence.

## RA-000 — Baseline and audit

**Status:** `VERIFIED_COMPLETE`

**Goal:** establish an evidence-backed baseline without changing runtime code.

**Scope:** retailer inventory, real flow map, shared/duplicate mechanisms,
exceptions, incident taxonomy, current Actions/readback evidence and this plan.

**Out of scope:** refactor, workflow/migration/database changes, approvals and
production writes.

**Dependencies:** owner verification. The original local/production baseline
mismatch was resolved by rebuilding RA-000 alone on a clean branch from current
`origin/main`; no runtime implementation dependency was opened.

**Existing solutions checked:** Operating Plan, Agent Operating Model,
Automation Reliability Roadmap/Owner Decisions, Data Source Registry, onboarding
runbook, offer-sync core, snapshot core, atomic importer, Review Queue,
postflight, watchdog, migrations/tests and Git history.

**Acceptance:** all 12 active retailers documented; every material claim cites a
file/symbol/run/artifact; unknowns are explicit; documentation-only diff; pre/post
Project Guardian passes; original dirty worktree remains unchanged; closeout
branch starts at exact current `origin/main`.

**Tests:** `npm run verify:project` before and after; documentation link checks;
`git diff --check`.

**Evidence:** this directory and evidence index; original local audit baseline
`1add3449096cbc3f988d0e5f6db8b9baf89f0349`; original and current fetched
production-run SHA `121fc5ce909c925e7234aef3a249661c8e7d0826`; merge-base
`1add3449096cbc3f988d0e5f6db8b9baf89f0349`, ahead/behind `0/104`; current
runs listed in evidence.

**Rollback:** revert only these documentation/AGENTS edits; no runtime rollback.

**Recorded evidence fields:** commit SHA: the Git commit containing this plan;
run IDs: documentation audit uses read-only runs only; artifacts: see evidence
index; local verification: pre-edit Project Guardian PASS, final results are
recorded in the commit/branch handoff; production readback: read-only artifacts
only; owner approval reference: pending verification; rollback result: not
applicable because no runtime change was made.

**Independent verification — 23 September 2026:** verified against
`121fc5ce909c925e7234aef3a249661c8e7d0826` with documentation commit
`8745b8bbc7fd9f7f8b324bcef69b3cac00c8ef75`. Project Guardian, documentation
links, diff whitespace, exact six-file scope, task-status contract and original
dirty-worktree integrity checks passed. The review confirmed that audit claims
remain evidence-backed, unknowns remain explicit, architecture remains a draft,
and all approval/write guardrails are preserved. No SQL, import, approval,
apply, workflow dispatch or staging/production write was performed.

## RA-001 — Approve architecture and status taxonomy

**Status:** `VERIFIED_COMPLETE`

**Goal:** prepare an evidence-backed owner decision on the common core,
component boundaries, six-dimensional status taxonomy, blocking scope,
automatic execution authority, exceptions and migration order.

**Scope:** compare all current production and harness paths; propose at most
three architectures and authorization models; recommend one target pipeline;
record no more than five plain-language owner decisions in
`RA-001-DECISION-PACK.md`.

**Out of scope:** implementation or guardrail changes.

**Dependencies:** RA-000 `VERIFIED_COMPLETE` and clean current baseline.

**Existing solutions checked:** `retailer-offer-sync`, `retailer-snapshot`,
atomic importer, shared Fit House engine, dedicated eBay/6 Pack/Whey Okay/GYM
HIGH/Jon's and catalogue-onboarding paths, validator/approver/executor, Review
Queue, control ledger, shared and dedicated postflight/watchdog mechanisms,
their tests, workflows, migrations and current RA-000 evidence.

**Acceptance:** owner approval dated 2026-09-23 confirms the pack's traceable
20-dimension comparison, one clear
recommendation, one logical pipeline, explicit connector/core boundary, status
and authorization models, exception governance, event-based migration gates,
retirement conditions, risks, unknowns and five owner decisions. The approval
retains every implementation, shadow, cutover, auto-safe and decommission gate.

**Tests:** pre/post `npm run verify:project`, documentation link check,
`git diff --check`, allowed-scope/status/integrity checks; no runtime or
production test.

**Evidence:** owner decision dated 2026-09-23; `ARCHITECTURE.md` status
`OWNER APPROVED FOR RA-002 PLANNING`; `RA-001-DECISION-PACK.md`; RA-000 evidence
index; exact baseline above; PR #85; final local/GitHub verification and merge
evidence recorded at closeout.

**Rollback:** revert the documentation commit or amend the draft; runtime is
unchanged and no production rollback exists.

## RA-002 — Canonical contract and common test harness

**Status:** `VERIFIED_COMPLETE`

**Goal:** freeze canonical source, classification, plan and outcome contracts and
prove them against existing implementations in zero-write mode.

**Scope:** reuse/merge existing snapshot schemas, reason registry, offer-sync
artifact schemas and fixtures.

**Out of scope:** production routing and retailer migration.

**Dependencies:** RA-001.

**Existing solutions checked:** `scripts/lib/retailer-snapshot/contracts/`,
`scripts/lib/retailer-offer-sync/contracts/`, atomic plan serialization and
quality-gate manifest. RA-002 reuses the snapshot runtime schema walker,
domain-separated snapshot canonical hashing, frozen local-fixture conventions and the
sealed quality-gate inventory. Existing production schemas, classifiers,
importer, approver, executor and entry points remain unchanged and unwired.

**Acceptance:** one retailer-neutral canonical source contract `v1`; exact-key,
minor-unit money, explicit missing/unknown/source-missing states, six-dimensional
taxonomy and complete reason metadata; deterministic local-fixture replay;
fail-closed write/network boundaries; safe-candidate/authorization separation;
no second executor/importer; quality manifest resealed for the new test.

**Tests:** contract/schema, taxonomy/reasons, determinism, mutation, stale-state,
source collapse, per-row isolation, missing-source semantics, safe candidate
without authorization, equivalent active, genuine system failure, denied
write/network attempts and runtime dependency boundary; quick/full gates.

**Evidence:** `evidence/RA-002.md`, contract/harness source, fixture matrix,
focused test output, deterministic report fingerprint, local quality gates and
PR #86 checks. Independent verification reviewed the complete diff and import
closure, corrected five bounded contract/harness gaps, and repeated the local
and GitHub gates. Production readback is intentionally not applicable because
the module is unwired and local-only.

**Rollback:** contract version remains unused; remove only new harness wiring.

## RA-003 — Historical incident regression fixtures

**Status:** `VERIFIED_COMPLETE`

**Goal:** convert every confirmed incident into a common-harness regression.

**Scope:** price drift, missing source row, identity conflict, active plan,
expired approval, partial session, `PASS_WITH_REVIEW` summary, scheduled queue
publication and post-apply source drift.

**Out of scope:** changing production behavior.

**Dependencies:** RA-002.

**Existing solutions checked:** retailer-specific tests, September recovery
migration tests, eBay reconciliation tests and current Actions artifacts.

**Acceptance:** each confirmed incident has fixture, expected reason/status and
link to original evidence; no unexplained missing regression.

**Tests:** full incident matrix through canonical harness; quick/full gates.

**Evidence:** `evidence/RA-003.md`, the 23-entry incident manifest, 16 executable
fixture/golden pairs, the 81-entry legacy compatibility matrix, independent
mutation and emitter-reference checks, fresh local quality gates and PR #87 CI.

**Rollback:** fixtures/harness only; runtime unchanged.

## RA-004 — 10 Reps shadow-mode pilot

**Status:** `BLOCKED`

**Owner stop/reset — 29 September 2026:** no further live retry is authorized.
All completed RA-000–RA-003 contracts, incident fixtures and RA-004 local replay
evidence are retained. Historical activation and failure records below remain
immutable evidence, not a queue of work to continue. RA-004 can be reconsidered
only after RA-STAB-01 closes and only as artifact-first recorded replay with zero
network, credential, control and business writes. Any later live shadow or
cutover requires a new task and separate owner authorization.

**Preflight gate:** `PREFLIGHT VERIFIED` — the documentation and blockers were
independently verified; there is still no safe single-snapshot legacy replay
entry point or approved complete read-only control-state export. See
[`evidence/RA-004-PREFLIGHT.md`](evidence/RA-004-PREFLIGHT.md) and the
machine-readable [`evidence/RA-004-shadow-plan.json`](evidence/RA-004-shadow-plan.json).

**Control-state exporter gate:** `READY_FOR_VERIFICATION` — the versioned exporter core,
authorization gate, fixture provider, CLI, pagination, consistency, redaction,
fingerprints and architecture-boundary tests are implemented. The newly
owner-approved transactional interface and unwired live-provider contract passed
their isolated local database tests and the complete repository full gate.
Live provider construction still fails closed without a separately
injected transport and future dedicated credential. See
[`evidence/RA-004-CONTROL-STATE-EXPORTER.md`](evidence/RA-004-CONTROL-STATE-EXPORTER.md).

**Control-state interface:** `VERIFIED_COMPLETE` — Marek
approved one bounded transactional RPC, separate future environment credentials
outside Git, and one minimal shared append-only evidence ledger. The migration
and unwired provider contract passed the fresh-baseline local PostgreSQL,
role/ACL/RLS, ledger, eleven-source and two-connection snapshot tests under both
`REPEATABLE READ` and ordinary `READ COMMITTED`. Status is
`CONTROL-STATE INTERFACE VERIFIED_COMPLETE`; repository LF
policy preserves the exact committed bytes of deterministic artifacts, and the
new migration remains excluded from both deployment selectors. No login,
secret, remote apply or live export was created. See
[`evidence/RA-004-CONTROL-STATE-INTERFACE-DESIGN.md`](evidence/RA-004-CONTROL-STATE-INTERFACE-DESIGN.md).

**Test-only single-snapshot adapter:** `VERIFIED_COMPLETE` — one controlled
local read is split before retailer-specific logic. The legacy copy uses the
active projector/classifier; the canonical copy uses an independent 10 Reps
connector and canonical v1 zero-write harness. Static goldens and a closed
run-level comparator produce 9/9 exact record parity, zero integrity mismatches,
zero unclassified/defect/unexplained rows, and zero prohibited capability
attempts. The explicit static raw SHA is checked before either replay path, and
the comparator regenerates nested record/integrity counts rather than trusting
report summaries. See
[`evidence/RA-004-SINGLE-SNAPSHOT-ADAPTER.md`](evidence/RA-004-SINGLE-SNAPSHOT-ADAPTER.md).

RA-004 remains `IN_PROGRESS`; the control-state interface and single-snapshot
adapter are `VERIFIED_COMPLETE`, and the shadow manifest remains
`NOT_AUTHORIZED`. The
[`evidence/RA-004-OWNER-DECISION-PACK.md`](evidence/RA-004-OWNER-DECISION-PACK.md)
is `VERIFIED_COMPLETE`. On 24 September 2026 Marek approved its five recommended
policies and future-preparation parameters. D1–D3 are `OWNER_APPROVED`; D4–D5
are `OWNER_APPROVED_FOR_FUTURE_PREPARATION`. This permits a separate staging
canary implementation plan and credential design only. Staging execution,
migration application, credential issuance/use, production, live capture,
live control-state export, shadow, control plan, approval, import, apply,
Model B and cutover remain `NOT_AUTHORIZED`; auto-safe classes remain
`NONE_APPROVED`.

**Staging-canary implementation plan:** `PREPARATION OWNER_APPROVED` and
independent verification is `VERIFIED_COMPLETE`; neither status indicates
execution readiness. The documentation-only plan and manifest are
[`evidence/RA-004-STAGING-CANARY-IMPLEMENTATION-PLAN.md`](evidence/RA-004-STAGING-CANARY-IMPLEMENTATION-PLAN.md)
and
[`evidence/RA-004-staging-canary-plan.json`](evidence/RA-004-staging-canary-plan.json).
They preserve the migration's staging and production selector exclusions and
define the future one-retailer, one-RPC, no-retry, maximum-60-minute canary and
maximum-30-minute credential. Staging execution, migration application,
credential issuance/use, live export, production and shadow remain
`NOT_AUTHORIZED`. Independent verification used the exact initial PR head in a
clean worktree, rejected all eight controlled authorization/contract mutations,
passed 84/84 focused tests, Project Guardian, TypeScript, ESLint,
`verify:quick` and `verify:full`, including the production build, and made no
staging or production connection. The next task is preparation of a separate
authorization package for a bounded read-only staging preflight; this closeout
does not connect to staging and no execution step may begin.

**Staging-preflight authorization pack:** preparation is `AUTHORIZED`, final
owner-decision verification is `VERIFIED_COMPLETE`, and all five decisions
are `OWNER_APPROVED_FOR_FUTURE_PREPARATION`. On 25 September 2026 Marek Kalinka
approved their requirements and future preparation through
`EXPLICIT_OWNER_INSTRUCTION`. Future local implementation preparation in one
separate PR is `AUTHORIZED`; staging deployment and execution are not.
The documentation-only pack and manifest are
[`evidence/RA-004-STAGING-PREFLIGHT-AUTHORIZATION-PACK.md`](evidence/RA-004-STAGING-PREFLIGHT-AUTHORIZATION-PACK.md)
and
[`evidence/RA-004-staging-preflight-authorization.json`](evidence/RA-004-staging-preflight-authorization.json).
Repository audit found no deployed metadata-only role, bounded project/retailer
identity interface, migration-ledger/schema metadata RPC, closed preflight
provider/CLI or approved private evidence store. These are recorded as
`BLOCKED_INTERFACE_GAP`; general SQL and existing validator, approver, executor
or service-role credentials are not accepted as substitutes. Control-plane and
database reads, staging connection, credential issuance/use, preflight,
migration, canary, production, live export and shadow remain `NOT_AUTHORIZED`.

**Staging-preflight local interface implementation:** `VERIFIED_COMPLETE`.
One consolidated local implementation now provides the metadata-only Q2-Q7
RPC, dedicated `NOLOGIN NOINHERIT` roles, closed Q1/Q8 provider boundaries,
fail-closed runner and CLI, six closed schemas, write-once redacted evidence,
fixtures and isolated PostgreSQL 17 verification. Both the existing
control-state migration and the new preflight migration remain SHA-bound and
excluded from STAGING and PRODUCTION deployment selectors. Q1 and Q8 remain
`BLOCKED_TARGET_CONFIGURATION`; all staging, production and execution actions
remain `NOT_AUTHORIZED`. See
[`evidence/RA-004-STAGING-PREFLIGHT-LOCAL-IMPLEMENTATION.md`](evidence/RA-004-STAGING-PREFLIGHT-LOCAL-IMPLEMENTATION.md).
Independent verification in a clean detached worktree corrected bounded target,
nested-schema, ACL/policy and pre-revoke evidence gaps, then passed the focused
regressions, both fresh networkless PostgreSQL 17 tests and repository quality
gates. This closes only the local implementation; RA-004 remains `IN_PROGRESS`.

**Bounded live transport:** `VERIFIED_COMPLETE`. Marek explicitly
authorized one separate implementation-and-merge PR on 25 September 2026. The
shared follow-up adds only the exact one-call PostgreSQL transports required by
the existing preflight and control-state providers. It accepts database URLs
only through in-memory dependency injection, binds them to the exact staging
project and temporary login, performs one static parameterized RPC in a
read-only transaction, closes the client without retry, and requires a distinct
issuer-process revoke receipt for preflight. It adds no activation manifest,
credential loader, service-role path, workflow, scheduler, importer or executor.
Both migrations remain excluded from STAGING and PRODUCTION, and no remote
execution was performed. Draft PR #97 at implementation head
`7c321744f229992b3e24a2862d936783f7aaa714` passed independent verification in
a new detached worktree: focused tests `118/118`, Project Guardian,
`git diff --check` and `npm run verify:full`, including the production build.
See
[`evidence/RA-004-BOUNDED-LIVE-TRANSPORT.md`](evidence/RA-004-BOUNDED-LIVE-TRANSPORT.md).

**Staging execution coordinator:** `OWNER_AUTHORIZED_PREPARED_NOT_EXECUTED`.
After PR #98 merged the exact staging selector activation, the first local
execution attempt stopped during read-only selector verification because an
untracked helper consumed the selector SHA map incorrectly. No remote mutation
occurred and no authorization window started. Marek then explicitly authorized
a separate preparation, verification and merge PR for the missing tracked
one-shot coordinator. It consumes only the selector-materialized workdir,
delegates migration application to the Supabase CLI, separates credential
issuance into another process, gates one canary on one complete preflight, and
revokes both RPC-only logins in `finally`. Production, feed, shadow, control
plan, approval, import, apply, offer writes, Model B, scheduler and retry remain
absent and unauthorized. See
[`evidence/RA-004-STAGING-EXECUTION-COORDINATOR.md`](evidence/RA-004-STAGING-EXECUTION-COORDINATOR.md).

Independent verification at initial head
`0b2752ac60cd8e38659751a227487f328def574b` confirmed the initial manifest
fingerprint `732cccf46eb4467460029b411f5138f81f4af69a9ad88235e6ed20d9051f7149`,
rejected all 12 controlled mutations and produced final canonical fingerprint
`9ed7ea2bea9a7fb2c2a521da87314ef6c438c46c46b751be254f7e57e2239b64`.
Project Guardian, 89 focused exporter/selector tests, TypeScript, ESLint,
`verify:quick` and `verify:full`, including the production build, passed without
staging, production, control-plane, database, SQL, credential or secret access.
Final independent verification in a second clean detached worktree rejected all
15 controlled mutations and passed Project Guardian, 89 focused tests,
TypeScript, ESLint, `verify:quick` and `verify:full`, including the production
build. The approval does not expire or expand automatically. The operator, issuer,
project reference, host, retailer ID, window and evidence store remain
unapproved and `UNRESOLVED`. Plan, fingerprint, query-allowlist, credential or
interface changes require reevaluation. The historical next task named here was
completed by the verified local implementation. The current next gate is
green GitHub checks and ordinary merge of the independently verified bounded
transport, followed by a separately controlled staging activation; no staging
deployment or preflight occurs in the transport PR.

**Staging 10 Reps retailer fixture:** `STAGING_VERIFIED_COMPLETE`.
The authorized read-only staging inventory found no 10 Reps retailer row, so
the prior coordinator stopped before all mutation and canary steps. Marek then
authorized one separate preparation, independent-verification and merge PR for
one minimal staging-only record. The new transactional migration is bound to
the exact trusted staging target, rejects production, requires an empty
name-or-slug match, derives a staging sequence ID while refusing production ID
`14`, and writes only the retailer name and slug. It remains SHA-bound and
excluded from ordinary STAGING and PRODUCTION selectors. This preparation does
not authorize or perform remote migration application, production, feed,
shadow, plans, approvals, imports, apply or canary retry. Marek subsequently
authorized a separate exact-SHA activation PR and one staging application
attempt after independent verification and merge. The prepared selector binds
the exact 94-row pre-ledger to the expected 95-row post-ledger, selects only the
fixture, defers seven unrelated migrations and exposes no retry, canary or
production action. PR #102 repaired the CLI 2.111.0 Management API transport
failure without weakening the selector: the password-free target URL is passed
to documented direct-database `db push`, while its password remains only in
`PGPASSWORD`; no PAT is accepted. Independent clean-worktree verification and
all GitHub checks passed before squash merge
`1d24497897ecec25c95cd1f3cd32171c0412db23`. The one authorized staging attempt
was then consumed. Fresh read-only verification proved the exact 95-row ledger
fingerprint, one minimal `10 Reps` / `10-reps` retailer row at staging ID `11`,
zero production actions and zero canary actions. Rerun is not authorized and
RA-004 remains `IN_PROGRESS`. See
[`evidence/RA-004-STAGING-10REPS-RETAILER-FIXTURE.md`](evidence/RA-004-STAGING-10REPS-RETAILER-FIXTURE.md)
and
[`evidence/RA-004-STAGING-10REPS-RETAILER-FIXTURE-ACTIVATION.md`](evidence/RA-004-STAGING-10REPS-RETAILER-FIXTURE-ACTIVATION.md).

**Forward-reissued interface migrations:** `VERIFIED_COMPLETE`. The two
original interface migrations remain byte-for-byte unchanged, while equivalent
fail-closed contracts are reissued at `20260927100000` and `20260927101000`,
both later than the verified staging ledger head. A networkless PostgreSQL 17
test proves fresh installation after a simulated 95-row ledger, safe recognition
of the exact old contract, the expected 97-row post-ledger, unchanged catalogue
row counts and rejection of function, role, grant and policy drift. Old and new
migrations remain SHA-bound and excluded from ordinary STAGING and PRODUCTION
selection. The consumed v5 activation is closed; no replacement activation,
credential or remote execution is included. See
[`evidence/RA-004-FORWARD-REISSUED-INTERFACE-MIGRATIONS.md`](evidence/RA-004-FORWARD-REISSUED-INTERFACE-MIGRATIONS.md).

**Staging schema dependency closure:** `VERIFIED_COMPLETE`. The one forward
activation was consumed and closed after the first interface migration found a
missing canonical source table; zero migrations were applied and the staging
ledger remained at 95. One authorized read-only inventory then found the full
gap: three source tables and three production-named contract roles, with no
additional missing or drifted input dependency. The new forward-only
compatibility migration recreates those exact structures without rows,
approvals, executor functions or production wiring. A networkless PostgreSQL 17
test proves the exact three-migration sequence, both RPCs, minimal ACL/RLS,
unchanged business counts, replay rejection and fail-closed drift handling.
Both selectors remain closed; no staging retry is authorized. See
[`evidence/RA-004-STAGING-SCHEMA-DEPENDENCY-CLOSURE.md`](evidence/RA-004-STAGING-SCHEMA-DEPENDENCY-CLOSURE.md)
and
[`evidence/RA-004-FORWARD-STAGING-ACTIVATION.md`](evidence/RA-004-FORWARD-STAGING-ACTIVATION.md).

**Corrected preflight ledger contract:** `VERIFIED_COMPLETE`. The immutable
`20260927101000` migration remains excluded after its Q3 RPC was proven to
expect the obsolete control-migration ledger name. The complete forward-only
`20260927102000_correct_ra004_staging_preflight_ledger_contract.sql` installs
the interface when absent and upgrades only either known repository-owned
predecessor definition after validating the full role, ownership, policy and
ACL boundary. SQL, runtime contract, selector and evidence all require
`reissue_transactional_retailer_control_state_interface`. STAGING and
PRODUCTION selectors remain closed; no remote execution or retry is authorized.

**Corrected staging activation:** `ATTEMPT_CONSUMED_FAILED_TERMINAL`.
The one-shot staging selector is bound to baseline
`aad469766b8491ef4eedffa143c33a7f3335d6bb`, the attested 95-row ledger and
exactly the compatibility, reissued control-state and corrected preflight
migrations. The defective `20260927101000` migration and seven unrelated
pending migrations remain excluded. The expected post-ledger is 98 rows ending
at `20260927102000`. Execution is permitted only from the clean, independently
verified squash-merged activation commit; production and shadow remain closed.
The single attempt from merge commit `276f2761b4b76ab33ce56f6dc4e723ff61990d62`
stopped transactionally on
`RA004_COMPATIBILITY_ROLE_DRIFT: retailer_catalogue_production_approver`.
Ledger readback remained the exact 95-row pre-state and zero migrations were
applied. Preflight and canary did not run. Evidence-session cleanup completed,
no RPC credential was created, and the activation is terminally closed with no
retry authorized.

**PostgreSQL 17 compatibility-role correction:**
`INDEPENDENTLY_VERIFIED_DRAFT`. The compatibility migration now
admits only PostgreSQL 17's exact automatic administrative edge from the
explicitly verified `postgres` migration user to each of the three compatibility
roles: `ADMIN TRUE`, `SET FALSE`, `INHERIT FALSE`, with a superuser grantor.
Every other membership, identity, option, role attribute or direct object ACL
fails closed. Networkless PostgreSQL 17 tests cover the real non-superuser
`CREATEROLE` path and negative drift. STAGING and PRODUCTION selectors remain
closed, and the consumed historical activation cannot select the revised SHA.
See
[`evidence/RA-004-POSTGRESQL-17-COMPATIBILITY-ROLE-CONTRACT.md`](evidence/RA-004-POSTGRESQL-17-COMPATIBILITY-ROLE-CONTRACT.md).

**Consolidated Supabase ownership architecture:** `READY_FOR_VERIFICATION`.
The exact staging-derived local baseline is ledger `96`, ending at the already
applied compatibility migration. One new migration,
`20260927103000_consolidate_ra004_supabase_ownership_interfaces.sql`, creates
both remaining interfaces as objects owned by the verified `postgres`
migration identity. It performs no `SET ROLE`, creates no persistent interface
roles and grants no runtime access. Temporary execution-window roles receive
only direct `EXECUTE` plus schema `USAGE`; cleanup revokes those rights before
dropping the role and its PostgreSQL 17 automatic administrative edge. A
networkless PostgreSQL 17 test proves exact ledger-96 installation, Q1–Q8, one
synthetic read-only canary, unchanged business counts, negative privilege
checks, deterministic cleanup and fail-closed replay and drift. STAGING and
PRODUCTION selectors remain closed; there is no activation or remote execution
in this draft. See
[`evidence/RA-004-CONSOLIDATED-SUPABASE-OWNERSHIP-ARCHITECTURE.md`](evidence/RA-004-CONSOLIDATED-SUPABASE-OWNERSHIP-ARCHITECTURE.md).

**Final consolidated staging activation:**
`ATTEMPT_CONSUMED_FAILED_TERMINAL_PLATFORM_LIMITATION`.
The one-shot activation applied only the reviewed consolidated migration and
advanced the staging ledger from 96 to 97. Q1–Q8 then failed closed on
`RA004_PREFLIGHT_LEDGER_UNKNOWN` because the PostgreSQL RPC ledger fingerprint
did not match the selector/runtime fingerprint for the same 97 rows. Canary was
not run. The evidence session and window are closed; bounded emergency cleanup
verified the temporary role and membership absent. Compatibility and the
consolidated migration are now recorded as already applied; every older RA-004
interface migration and the production selector remain closed. See
[`evidence/RA-004-CONSOLIDATED-OWNERSHIP-ACTIVATION.md`](evidence/RA-004-CONSOLIDATED-OWNERSHIP-ACTIVATION.md)
and
[`evidence/RA-004-CONSOLIDATED-STAGING-ATTEMPT-CLOSEOUT.md`](evidence/RA-004-CONSOLIDATED-STAGING-ATTEMPT-CLOSEOUT.md).

**Canonical ledger fingerprint contract:** `READY_FOR_FINAL_REVERIFICATION`.
The exact 97-row terminal staging ledger is reconstructed locally and frozen as
a neutral `{version,name}` fixture. `RA004_LEDGER_V1` projects only those two
fields, sorts by UTF-8 version then name, assigns logical ordinals and hashes one
canonical UTF-8 JSON document. The same exact ledger now produces
`bbfc25a25826ebfd4901941099903921e1f5adeb9d952eb6aa93c64939e3849c`
in Node.js and the unchanged PostgreSQL 17 RPC. The former selector hash
`1692043d963e98570cd69ea2f46654c35f35a78f26c35b3d96e04751d528331c`
was SHA-256 of the non-canonical raw JavaScript row array. Historical closeout
evidence remains immutable; the failed preflight remains failed, the canary was
not run, both selectors remain closed and no retry is authorized. See
[`evidence/RA-004-CANONICAL-LEDGER-FINGERPRINT-CONTRACT.md`](evidence/RA-004-CANONICAL-LEDGER-FINGERPRINT-CONTRACT.md).
The reviewed GTIN production release now distinguishes an already-applied
historical migration from the current pending authorization set: it verifies
the approved local migration SHA, hashes the 221-row ledger explicitly in the
`PRODUCTION` domain, proves the required schema, returns `ALREADY_PRESENT` with
zero writes and cannot redeploy that migration. An absent GTIN ledger row fails
closed as `NOT_CURRENTLY_AUTHORIZED`; the pending Fit House migration does not
authorize GTIN.

**ACL/RLS diagnostic staging activation:**
`ATTEMPT_CONSUMED_FAILED_TERMINAL`.
One bounded `REPEATABLE READ READ ONLY` staging transaction proved the durable
RPC grants, ownership, forced RLS and four RA-004 policies match their closed
contract. The failure was a false positive in the aggregate check: effective
privilege helpers counted safe managed-platform access inherited through
PostgreSQL `PUBLIC` as a direct grant to the temporary RA-004 login. The
forward-only correction inspects explicit role ACL entries, retains every role,
RPC, RLS and policy guard, and gives every mismatch a distinct fail-closed code.
The subsequent authenticated activation established the private evidence
session and applied the correction once, advancing the staging ledger from 97
to 98. Its single preflight captured metadata but stopped on
`RA004_REVOKED_CREDENTIAL_RECONNECTED`; the canary was not run. A bounded
read-only catalogue readback verified the temporary role and membership
absent. The evidence session and execution window are closed, the activation
is non-replayable, and both selectors are closed. See
[`evidence/RA-004-ACL-RLS-DIAGNOSTIC.md`](evidence/RA-004-ACL-RLS-DIAGNOSTIC.md)
and
[`evidence/RA-004-ACL-RLS-AUTHENTICATED-ATTEMPT-CLOSEOUT.md`](evidence/RA-004-ACL-RLS-AUTHENTICATED-ATTEMPT-CLOSEOUT.md).
The systemic query-aware revoke-verifier correction is documented in
[`evidence/RA-004-QUERY-AWARE-REVOKE-VERIFIER.md`](evidence/RA-004-QUERY-AWARE-REVOKE-VERIFIER.md).

**Control-export provider identity correction:**
`ATTEMPT_CONSUMED_FAILED_TERMINAL`.
The provider-identity migration is present on staging at ledger 99. The bounded
preflight passed Q1–Q8. The one read-only canary failed before producing an
artifact, and the closeout serializer did not preserve its structured error
code. The forward-only
`20260928101000_align_ra004_control_export_provider_identity.sql` migration
accepts only the exact applied function shape, adds the live `session_user` to
the RPC response, preserves `SECURITY DEFINER`, the closed `search_path`, owner
and restrictive ACLs, and fails on replay or source drift. The coordinator now
uses the RPC's stable provider ID. PostgreSQL 17 proves the pre-correction
failure, corrected Q1–Q8 and read-only export, fail-closed identity drift, zero
business changes and closed selectors. See
[`evidence/RA-004-CONTROL-EXPORT-PROVIDER-IDENTITY.md`](evidence/RA-004-CONTROL-EXPORT-PROVIDER-IDENTITY.md).
The terminal staging attempt is recorded in
[`evidence/RA-004-PROVIDER-IDENTITY-STAGING-ATTEMPT-CLOSEOUT.md`](evidence/RA-004-PROVIDER-IDENTITY-STAGING-ATTEMPT-CLOSEOUT.md).
The system-level serializer correction and closed canary-only activation are
documented in
[`evidence/RA-004-FINAL-CONTROL-STATE-CANARY.md`](evidence/RA-004-FINAL-CONTROL-STATE-CANARY.md).

**LIVE SHADOW RUN NOT AUTHORIZED**

**Goal:** compare the candidate canonical pipeline with the existing 10 Reps
path, with zero business/control writes.

**Scope:** all 950 approved mappings; current safe/review partition; source,
identity, diff, guard and status parity.

**Out of scope:** cutover, approval creation, apply, queue publication and
baseline widening.

**Dependencies:** RA-002 and RA-003; owner-approved shadow window.

**Existing solutions checked:** shared Fit House engine profile, protected CSV
reader, 950-row manifest, current 935/15 evidence and onboarding fixtures.

**Acceptance:** deterministic parity or explained owner-approved differences;
zero DB writes; no leaked retailer condition in shared core; source failure does
not affect other retailers.

**Tests:** repeated shadow captures, missing-row, price, stock, identity,
collapse and concurrency fixtures; quick/full gates.

**Evidence:** paired artifact digests, row-level parity report, run IDs and
zero-write attestation.

**Rollback:** disable shadow invocation; existing path untouched.

## Retailer migration task template

Each RA-005–RA-015 task has the same mandatory contract:

- **Goal:** migrate exactly one retailer after shadow parity.
- **Scope:** connector/config/fixtures and routing for that retailer only.
- **Out of scope:** another retailer, shared guard weakening, identity cleanup
  without separate owner approval, historical-data rewriting.
- **Dependencies:** RA-004 and evidence-based owner sequencing decision.
- **Existing solutions:** named current connector, parser, manifest, validator,
  executor, postflight, watchdog and tests from `AUDIT.md`.
- **Acceptance:** shadow parity; owner-approved canary; per-row isolation;
  atomic apply; price-history parity; postflight/idempotency/watchdog pass;
  legacy path remains recoverable during observation.
- **Tests:** common harness plus retailer fixtures and every linked incident;
  quick/full gates and isolated integration where applicable.
- **Evidence:** before/after digests, exact scope, run/artifact IDs, production
  readback and no-unrelated-change proof.
- **Rollback:** route back to preserved legacy path; do not delete plans/history.

The IDs below do not establish order:

| Task | Retailer | Status | Additional required proof |
|---|---|---|---|
| RA-005 | Discount Supplements | `NOT_STARTED` | 109 automatic plus 47 residual offers; rename/ownership clarity for `creatine` workflow. |
| RA-006 | Dolphin Fitness | `NOT_STARTED` | one exact automated offer and two unresolved generic legacy identities. |
| RA-007 | eBay UK | `NOT_STARTED` | 237-scope API parity, Review Queue publication, post-apply source-drift closeout and batch workflow retirement decision. |
| RA-008 | Fit House | `NOT_STARTED` | all approved absence/OOS policies, ten deferred changes and removal of Fit-House logic from shared core. |
| RA-009 | GYM HIGH | `NOT_STARTED` | full catalogue atomic parity, legacy identity cases and recognized DB postflight. |
| RA-010 | Jon's Supplements | `NOT_STARTED` | reconcile dedicated production path with existing retailer-snapshot harness; four current reviews. |
| RA-011 | KIOR Health | `NOT_STARTED` | exact 11-row golden path and historical registration hash repair. |
| RA-012 | Predators Gear | `NOT_STARTED` | source access/readiness and owner decision before any apply; 47 stale offers. |
| RA-013 | Simply Supplements | `NOT_STARTED` | Shopify versus historical Awin policy boundary, threshold shipping and aggregate price confirmations. |
| RA-014 | 6 Pack Supplements | `NOT_STARTED` | 506-row WooCommerce parity and consolidation of extensive family/review machinery. |
| RA-015 | Whey Okay | `NOT_STARTED` | resolve missing mapped-source fingerprint row; EKM parsing and 589 automatic/legacy scope boundary. |

## RA-DECOMMISSION — Remove old paths and exceptions

**Status:** `NOT_STARTED`

**Goal:** remove only fully migrated runtime paths and expired exceptions.

**Scope:** dead workflows/scripts/config branches after every applicable retailer
passes observation.

**Out of scope:** data/history deletion, active plans or owner-deferred scope.

**Dependencies:** RA-005–RA-015 verified and RA-OBSERVE complete.

**Existing solutions checked:** workflow archive pattern, quality manifest,
control ledger and exception inventory.

**Acceptance:** no active reference/session; one importer/approval/executor path;
exception removal condition met; tests/docs updated; owner approval.

**Tests:** repository reference scan, quick/full/integration gates, production
readback and rollback rehearsal.

**Evidence:** removal manifest, commit/run/artifact IDs.

**Rollback:** restore routing/code from tagged pre-decommission commit; preserve
DB history.

## RA-OBSERVE — Production observation period

**Status:** `NOT_STARTED`

**Goal:** prove stable operation across owner-approved time and event coverage.

**Scope:** scheduled runs, review backlog, source failures, commercial changes,
postflight/idempotency, watchdog and cross-retailer isolation.

**Out of scope:** feature additions or threshold widening.

**Dependencies:** migrated retailers active; duration decided in RA-001.

**Existing solutions checked:** Actions artifacts, watchdog, Review Queue and
price-history observation mechanisms.

**Acceptance:** required consecutive runs and event cases pass; no unexplained
status; no silent row; no unrelated retailer blockage.

**Tests:** scheduled live evidence plus read-only production checks.

**Evidence:** observation ledger with every run/artifact digest.

**Rollback:** route affected retailer back independently.

## RA-CLOSEOUT — Programme verification

**Status:** `NOT_STARTED`

**Goal:** verify the entire programme and freeze the final architecture record.

**Scope:** contracts, all retailer routes, safety invariants, legacy removal,
documentation and operational ownership.

**Out of scope:** new catalogue/SEO features.

**Dependencies:** all migration tasks, RA-DECOMMISSION and RA-OBSERVE verified.

**Existing solutions checked:** all evidence ledgers and production readbacks.

**Acceptance:** one canonical pipeline; one diff/validator/approval/executor
contract; no unauthorized retailer branch in shared core; all incidents covered;
full gates and independent live verification pass; owner signs closeout.

**Tests:** `verify:project`, quick/full/integration as applicable, contract and
workflow inventory, live read-only watchdog/postflight.

**Evidence:** final commit, CI/live run IDs, artifact digests and owner approval.

**Rollback:** retained release tag and per-retailer routing rollback until owner
ends the rollback window.

## Owner decisions recorded for RA-001

Marek approved on 2026-09-23:

1. `retailer-offer-sync` as the common spine, retaining the existing guarded
   write/control mechanisms and later incorporating snapshot/replay contracts;
2. Model B in principle, with no current auto-safe class, threshold, automatic
   apply or production permission authorized;
3. the separate source/change/execution/run/alert/action taxonomy, including
   `PASS_WITH_REVIEW`, `SKIPPED_EQUIVALENT_ACTIVE` and narrowly scoped
   `FAILED_SYSTEM`;
4. 10 Reps as the first shadow-only pilot and KIOR as the first small later
   cutover candidate, both behind later tasks and separate execution authority;
5. evidence-based legacy-removal gates, with no removal currently authorized
   and GYM HIGH plus Predators Gear remaining deferred.

The unresolved Whey Okay fingerprint cause, Predators source availability,
active plan/session/lock/approval inventory, exact future auto-safe classes,
future GYM HIGH disposition and eBay/GYM event coverage remain explicit future
dependencies. They do not block RA-001 closeout, but block the affected later
migration or activation until resolved. RA-002 is not started by these decisions.
