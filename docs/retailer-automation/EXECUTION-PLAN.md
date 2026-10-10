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

**10 October shared execution/review partition incident — correction prepared:**
ordinary shared run `38039918378` captured a healthy Fit House source and
correctly produced `275` executable confirmations plus `11` isolated review
rows across the immutable `286`-offer scope. It failed closed before apply at
the Review Queue source-binding step because that shared publisher expected the
isolated rows inside the executable classifier's changed-row evidence even
though the previously corrected shared partition had intentionally removed
them. The correction establishes one complete isolated-review report contract
between those existing components and validates identity, baseline price,
unchanged price and the exact stock transition before publication. It contains
no retailer branch in shared core, new path, limit change or database write.
The exact incident and canonical review-row regressions pass in the `103`-test
focused suite; `verify:quick` and the pre-change Project Guardian also pass.
Merge, CI and one fresh guarded live proof remain required. That proof will not
rewrite the failed scheduled interval or advance the `0/3` ordinary counter.
Evidence:
[`evidence/RA-STAB-01-SHARED-REVIEW-SOURCE-PARTITION-CONTRACT-PREPARATION-2026-10-10.json`](evidence/RA-STAB-01-SHARED-REVIEW-SOURCE-PARTITION-CONTRACT-PREPARATION-2026-10-10.json).

**10 October shared partition live proof — complete; ordinary observation
pending:** PRs `#331` and `#332` merged the common contract correction. Fresh
attempt `38049959238` failed closed before apply and proved that the current
review partition contains ten owner-deferred stock rows plus one independently
isolated `MASS_OOS` row. The second correction validates that distinction and
requires `MASS_OOS` to remain an exact available-to-unavailable stock-only
transition. Run `38050504732` then completed Fit House capture, source binding,
`275` safe executions, DB postflight, fresh idempotency capture and publication
of all `11` review cards. No price, stock, URL or business price-history value
changed; `249` daily confirmation rows record freshness only. Queue publication
created `11`, superseded `7` stale approved cards and made zero catalogue
writes. Fresh KIOR run `38051144358` completed all `11` confirmations with
green postflight, zero commercial changes and zero-write idempotency. Watchdog
`38050909298` was read-only and correlated the current Fit House success, while
correctly preserving the failed scheduled attempt and review-backlog growth; it
preceded the KIOR proof. Manual success is live acceptance, not an ordinary
schedule interval. RA-STAB-01 remains `IN_PROGRESS` at `0/3`. Evidence:
[`evidence/RA-STAB-01-SHARED-REVIEW-PARTITION-LIVE-PROOF-2026-10-10.json`](evidence/RA-STAB-01-SHARED-REVIEW-PARTITION-LIVE-PROOF-2026-10-10.json).

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

**5 October first fresh 10 Reps execution gate after recovery — blocked by the
external source:** manual ordinary-path runs `37305756452` and `37306729009`
both stopped at `SOURCE_FETCH` after the existing three bounded attempts timed
out. The owner later authorized one more immediate run to finish the check
faster. Run `37308914886` produced the same result: three bounded timeouts, zero
bytes and a stop before validation, plan creation, approval or apply. All three
runs report zero attempted/completed database writes, zero business/control
writes and zero approvals. The earlier replay blocker did not recur, so the
shared expired-plan recovery is not implicated. Do not add a retailer-specific
fallback, reuse a stale feed, raise the timeout without source evidence or
launch a fourth manual retry. The next exact gate is evidence that the protected
10 Reps feed is responding again. Only a fresh complete feed may proceed to the
normal 10 Reps execution and fresh Review Queue publication. RA-STAB-01 remains
`IN_PROGRESS`; ordinary observation credit remains `0/3`. Evidence:
[`evidence/RA-STAB-01-10REPS-SOURCE-OUTAGE-2026-10-05.json`](evidence/RA-STAB-01-10REPS-SOURCE-OUTAGE-2026-10-05.json).

**5 October shared owner-decision execution preparation — implementation in
PR #218, not yet production evidence:** the existing Automation Review Queue
worker now has one registry for eBay and Fit House and is the sole workflow
woken by the admin execution action. The former direct eBay Review Queue job is
removed. Fit House reuses the existing full-source classifier, read-only
validator, control-plan registration, separated approver/executor roles,
postflight and fresh idempotency capture. One approved stock decision is bound
to exactly one commercial change plus 19 deterministic `VERIFY_NO_CHANGE`
freshness confirmations; price, shipping, total, URL and identity changes remain
blocked. The fixed 14-row publication contract now shrinks only when exact
source/DB agreement resolves a row. A bounded SELECT-only owner-decision audit
was added for the final readback of every authenticated-admin decision and its
execution history. Independent code review found and the implementation fixed
a stale-baseline no-op check, dynamic count-binding gap, missing behavioural
workflow test and obsolete GitHub-input metadata. Local `verify:quick`,
`verify:full`, TypeScript, zero-warning ESLint and behavioural tests pass. This
checkpoint authorizes no Review Queue decision, catalogue write or 10 Reps
retry. Production capability and decision readback remain required after green
CI and merge; RA-STAB-01 remains `IN_PROGRESS` at `0/3` ordinary intervals.

**5 October shared Review Queue production readback — deployed and verified:**
PR #218 merged as `108a1cab05274dabb93c5dbcab9dc8033f308ce0`; its full
quality gate passed in run `37332898487` and the production deployment passed.
An explicit production worker probe on that exact commit passed in run
`37334575536` with zero active execution requests and zero catalogue writes.
The bounded owner-decision readback found 50 authenticated-admin decision
events across 40 retailer offers. Thirty `EXECUTED` requests have 30 downloaded
result artifacts; every request matched its run, postflight hash, executed offer,
idempotency result and write count. No executed artifact failed verification and
there is no active execution request. At latest-offer level, 28 are `EXECUTED`,
six are safely `EXPIRED` with zero writes, three are `APPROVED` without an
execution request and three have a newer `PENDING` review. Historical audit
signals remain review debt: 25 older-decision/current-evidence differences, six
approvals without a request and two request-binding differences; the latter two
are both expired with zero writes and none affects an executed request. Do not
replay or auto-resolve those rows. Fit House shared execution capability is now
live, but this readback created no owner decision or execution. 10 Reps remains
deferred behind the external-source recovery gate with no new retry. This is
production capability evidence, not an ordinary scheduled observation, so
RA-STAB-01 remains `IN_PROGRESS` at `0/3`. Evidence:
[`evidence/RA-STAB-01-REVIEW-QUEUE-PRODUCTION-READBACK-2026-10-05.json`](evidence/RA-STAB-01-REVIEW-QUEUE-PRODUCTION-READBACK-2026-10-05.json).

**5 October shared safe/review partition and watchdog meaning — locally
verified, deployment pending:** fresh production evidence separated two normal
conditions from a system failure. Fit House run `37318809123` completed source,
classification and publication successfully with `272` safe
`VERIFY_NO_CHANGE` rows and the same `14` owner-deferred stock rows. The old
one-time returned-offer selector then selected zero ordinary rows after its
authorized change had become idempotent, so the safe rows were not refreshed.
Whey Okay read-only run `37312941793` independently proved `579` executable
rows plus `10` missing-source review rows; its earlier scheduled run
`37288125109` stopped before writes on a control conflict that is no longer
present. Watchdog `37336271221` incorrectly promoted Fit House's expected
review-count growth to `FAIL`, although its latest retailer run was complete.

The correction introduces one retailer-neutral partition in the existing
classifier: every quarantined offer is excluded from execution and all other
classified rows remain executable. Fit House consumes that common partition
for ordinary runs while preserving the existing exact one-time `1 + 19`
authorized path when it still has a real stock change. The watchdog now reports
review-only growth as `PASS_WITH_REVIEW`; stale-scope drift, missing evidence,
unknown failure codes and all genuine system failures still return `FAIL`.
There is no new importer, executor, workflow, database function, approval path,
retailer condition in shared core, baseline widening or production write.
Focused regressions pass `119/119`; repository quick/full gates, Project
Guardian and the production build pass. The next gate is green CI/merge, then
the natural Whey Okay and shared Fit House schedule followed by a fresh
read-only watchdog. The exact 14 Fit House rows remain unchanged in Review
Queue and must not be manually forced. RA-STAB-01 remains `IN_PROGRESS` at
`0/3`. Evidence:
[`evidence/RA-STAB-01-SHARED-SAFE-REVIEW-PARTITION-PREPARATION-2026-10-05.json`](evidence/RA-STAB-01-SHARED-SAFE-REVIEW-PARTITION-PREPARATION-2026-10-05.json).

**5 October owner-requested immediate Fit House and Whey Okay execution — Whey
verified, Fit House report correction pending deployment:** after PR `#220`
merged as `0b93f0dbb356f907a6bec9379c553bd5a2b22872`, the owner explicitly
replaced the natural-cycle wait with sequential manual ordinary-path dispatches.
Fit House run `37344883167` fetched a healthy complete source and reproduced the
exact `272 safe + 14 review` partition. It then failed closed before baseline,
registration, approval or execution with `Fit House protected-offer report
scope mismatch`; database, business and control writes are all zero. The cause
is bounded: the consumed one-time `1 + 19` report assertion still ran after the
ordinary selector correctly chose 272 safe confirmations. The correction binds
that assertion to an actually active one-time stock authorization. It changes
no classifier, partition, threshold, writer, workflow or Review Queue scope.
Its incident regression plus the Fit House/shared suites pass `62/62`, and
quick/full gates including the production build pass.

Whey Okay run `37345068386` then used the same shared production lock and
completed successfully. It executed all `579` safe `VERIFY_NO_CHANGE` rows in
12 guarded children and kept the exact 10 missing-source rows in review.
Postflight proves 579 freshness changes and zero price, stock, shipping, total,
URL, mapping, catalogue or price-history change. Fresh-source idempotency passed
with the same `579 + 10` partition. The next gate is green merge of the bounded
Fit House report correction, followed by one fresh Fit House ordinary-path
dispatch and read-only postflight. The 14 Fit House exceptions remain
unchanged. These owner-requested manual runs do not increment the ordinary
schedule counter, which remains `0/3`. Evidence:
[`evidence/RA-STAB-01-MANUAL-FIT-WHEY-OBSERVATION-2026-10-05.json`](evidence/RA-STAB-01-MANUAL-FIT-WHEY-OBSERVATION-2026-10-05.json).

**5 October Fit House ordinary execution and Review Queue source-contract
correction:** PR `#221` merged the bounded report-scope correction as
`6d82993b1042089af1a46aab4fad3d90d1943e47`; main quality gate run
`37347029695` and the production deployment passed. Owner-requested Fit House
run `37347458788` then completed the catalogue path with
`PASS_WITH_REVIEW`: all 272 `VERIFY_NO_CHANGE` rows executed, the exact 14
`UPDATE_STOCK` rows remained deferred, DB postflight passed with 272 freshness
changes and zero price, stock, shipping, total, URL, mapping, catalogue or
price-history change, and idempotency reproduced the same `272 + 14`
partition. The workflow became red only in the subsequent Review Queue source
binding step, before queue reconciliation, because that adapter still required
the superseded zero-execution publication shape. The bounded correction keeps
the same adapter and guarded publisher, accepts either its legacy zero-execution
capture or an ordinary complete safe/review partition, requires all executable
IDs to be `VERIFY_NO_CHANGE`, requires an empty stock-execution scope, binds
every freshness/daily-confirmation count to postflight, and still rejects every
commercial or catalogue delta. The incident regression accepts the exact
`272 + 14` production shape and rejects an injected stock execution. The live
artifact itself passes the corrected contract locally. No classifier, writer,
workflow, retailer threshold or queue lifecycle is added or changed. The next
gate is green CI/merge followed by one fresh Fit House dispatch so the already
safe business path can publish the exact unresolved review subset. Manual runs
do not increment the ordinary counter; RA-STAB-01 remains `IN_PROGRESS` at
`0/3`. Evidence:
[`evidence/RA-STAB-01-FIT-HOUSE-REVIEW-BIND-PREPARATION-2026-10-05.json`](evidence/RA-STAB-01-FIT-HOUSE-REVIEW-BIND-PREPARATION-2026-10-05.json).

**5 October Fit House production closeout and owner-decision worker evidence
repair:** PR `#222` merged the source-contract correction as
`007837d70fe9c94f7742f3ff24e8a5e9bf06efe1`; main quality gate run
`37350767178` and production deployment passed. Fit House run `37351120017`
then completed end to end: 272 freshness-only confirmations executed, the exact
14 stock changes remained in review, postflight and idempotency passed with zero
commercial/catalogue change, source binding passed, and the shared publisher
applied 14 queue operations (`CREATE 3`, `REFRESH 11`) with zero catalogue
writes. This is manual evidence and does not increment the `0/3` ordinary
counter. Read-only watchdog `37351958480` correctly reports Fit House as
`PASS_WITH_REVIEW`; its global red result comes from the prior failed natural
Whey Okay interval plus the recorded Jon's, 6 Pack, eBay and 10 Reps backlog,
not from this Fit House run. The successful manual Whey Okay run
`37345068386` remains the latest complete execution but deliberately does not
replace the failed natural interval.

The owner-requested queue follow-up exposed five newly queued requests. Worker
run `37352438800` failed closed before usable per-request evidence: it emitted
only aggregate `QUEUE_WORKER_BATCH_FAILED:5`, while the uploaded files were
test fixtures left by the pre-production test step. The bounded correction
keeps the one existing worker and adapters, clears only runner-local test
evidence before production processing, persists one redacted batch report with
request/retailer/review identifiers and stable error codes, and runs the
existing SELECT-only owner-decision audit into the same evidence artifact. It
adds no execution capability, retry, approval path or catalogue writer. The
next gate is green CI/merge, followed by one worker dispatch to classify and
resolve the exact five requests from real production evidence. Evidence:
[`evidence/RA-STAB-01-FIT-WHEY-QUEUE-WORKER-AUDIT-2026-10-05.json`](evidence/RA-STAB-01-FIT-WHEY-QUEUE-WORKER-AUDIT-2026-10-05.json).

**5 October approved Review Queue evidence incident — shared correction
prepared:** PR `#223` merged the worker-evidence repair as
`7f5413d5e365da9c2066e8fec1737d3ad47e3161`; main quality gate run
`37353830120` and production deployment passed. Worker run `37354078264` then
produced usable evidence and failed closed with zero database writes for the two
remaining queued Fit House requests: reviews `1110` / offer `1938` and `1111` /
offer `1982`, both with `APPROVAL_AUDIT_MISSING`. The accompanying SELECT-only
audit proves both exact immutable `PENDING -> APPROVED` owner events still
exist. The cause is the shared queue publisher's `REFRESH`: it retained the
approved status but replaced the denormalized decision actor with
`automation-review-publisher`. This was a control-evidence lifecycle defect,
not a retailer-source or owner-decision failure.

The bounded correction changes the existing shared publisher to preserve an
exact matching `APPROVED` row instead of refreshing it. The existing worker now
requires the exact fingerprint-bound immutable approval event to be authored by
`authenticated-admin`; it no longer requires the mutable queue-row actor to
duplicate that event actor. A mixed pending/approved regression proves pending
evidence is still refreshed, exact approved evidence is untouched, a
non-admin approval event remains blocked, and no new workflow, adapter,
approval path, retry or writer is added. The next gate is green quick/full CI,
merge and deployment, then one worker dispatch for the two already queued
requests followed by a read-only result check. The three earlier requests that
are already terminal are not replayed. Evidence:
[`evidence/RA-STAB-01-APPROVED-REVIEW-EVIDENCE-FREEZE-2026-10-05.json`](evidence/RA-STAB-01-APPROVED-REVIEW-EVIDENCE-FREEZE-2026-10-05.json).

**Production closeout:** PR `#224` merged as
`9a09f32ffdc3743fd00f3cb8614ce3554184f14c`; main quality gate
`37355848287`, Project Guardian `37355848311` and production deployment
`6866800222` passed. The first post-deployment worker run `37356216755`
processed zero rows because the prior failed attempts had already moved the two
remaining requests to their terminal `EXPIRED` state; it made zero database
writes and did not replay them. A fresh Fit House run `37356399740` then passed
the full protected path: `286` approved mappings, `272` freshness-only
executions, `14` review rows, zero commercial/catalogue/history deltas,
postflight and idempotency `PASS`. Its queue publication created seven fresh
pending cards for offers `697`, `735`, `921`, `944`, `1904`, `1938` and `1982`
and refreshed seven already-pending cards, for `14` active review cards and zero
catalogue writes. The seven former approvals cannot be transferred to new
review IDs; those exact cards require a new owner decision. Future exact
approved cards are now preserved by the shared publisher. This owner-requested
manual run does not increment the ordinary observation counter; RA-STAB-01
remains `IN_PROGRESS` at `0/3`.

**5 October 10 Reps source recovery and guarded execution — production
verified:** after the owner confirmed that the external site was responding,
manual shared-workflow run `37357956664` completed in `16m22s` on merged commit
`458756faebb7f60ba43321f9ed2e412a06702455`. It read all 950 approved mappings,
executed 934 safe rows and isolated the same 16 missing-source variants as
review with zero blocked rows. Of the executable rows, 933 were freshness-only
confirmations and offer `3713` received the sole commercial change: price
`7.69 -> 3.99`, with stock unchanged. Postflight passed with 934 freshness
updates, one price-history row and zero product, variant, mapping or offer-row
count deltas. A fresh-source idempotency pass made zero database writes.

The source outage is therefore closed and the earlier expired-plan recovery did
not recur. This workflow has no 10 Reps Review Queue publication stage, so the
16 rows are preserved in the run report but this evidence does not claim that
fresh admin cards were published. The next bounded gate is to reuse the existing
shared Review Queue builder and publisher for exactly those 16 rows, without a
new importer, approval path, executor or catalogue write. Because this was a
manual run, the ordinary observation counter remains `0/3`. Evidence:
[`evidence/RA-STAB-01-10REPS-SOURCE-RECOVERY-EXECUTION-2026-10-05.json`](evidence/RA-STAB-01-10REPS-SOURCE-RECOVERY-EXECUTION-2026-10-05.json).

**5 October 10 Reps Review Queue publication — locally verified, deployment
pending:** commit `ec8bc1a` converts the existing Fit House source binder into
one profile-driven shared retailer adapter and replaces the Fit-only queue job
with one shared job for Fit House and 10 Reps. The implementation still uses the
existing artifact-bound source contract, read-only production baseline, common
publisher planner and single transactional publisher RPC. It adds no importer,
approval path, executor, database function or direct queue writer.

The adapter accepts the real successful run `37357956664` as exactly `950`
approved mappings, `934` executed rows, `16` missing-source review rows and zero
blocked rows. It separately binds the `933` freshness-only confirmations and
the one executed price change, so a commercial row cannot be mistaken for a
no-change row. The exact 16 review offer IDs are `2853`, `2854`, `2855`, `2856`,
`2857`, `2858`, `2859`, `2896`, `2897`, `2898`, `2913`, `2914`, `3384`, `3388`,
`3496` and `3627`. Every resulting card is `MANUAL_REVIEW_IDENTITY` with
`SOURCE_MISSING`, proposes `KEEP_UNCHANGED`, authorizes no automatic catalogue
action and preserves approved-row immutability plus stale-state guards.
Focused publisher/source tests pass `43/43`; the real production artifact
contract, quick/full gates, Project Guardian and the production build pass.
Preparation made zero production writes. The next gate is green merge followed
by one fresh guarded 10 Reps apply and verification of its queue publication
artifact and production readback. Evidence:
[`evidence/RA-STAB-01-10REPS-REVIEW-QUEUE-PUBLICATION-PREPARATION-2026-10-05.json`](evidence/RA-STAB-01-10REPS-REVIEW-QUEUE-PUBLICATION-PREPARATION-2026-10-05.json).

**5 October Review Queue/execution decoupling — locally verified, deployment
pending:** fresh 10 Reps run `37364486648` again produced the exact healthy
`950 = 934 safe no-change + 16 review + 0 blocked` classification, but its apply
timed out during the thirteenth of 19 protected children. Read-only production
comparison proves that the first 12 children changed freshness only for 591
offers and made zero price, stock, URL, mapping, identity, price-history or row
count change. The queue job was nevertheless skipped because publication was
incorrectly conditional on the entire unrelated safe execution completing.

The common correction now seals the fresh classification and full database
baseline before apply. Queue reconciliation may continue after a later apply
failure, but only when every executable row is `VERIFY_NO_CHANGE`, all review
rows form the exact complete partition, no row is blocked, the artifact hashes
match and current production identity and commercial state still match the
sealed baseline. A shared `review-only` operation performs only fresh dry-run,
read-only baseline, binding, reconciliation and the existing transactional
queue publication; it never registers or executes a catalogue control plan.
No importer, approval path, executor, database function, retailer condition in
shared core or direct catalogue writer was added. The focused suite passes
`22/22`, including a regression that overwrites the ordinary reports with a
later partial-execution failure while the sealed review evidence remains valid.
The real incident artifact validates as exactly 934/16/0. Preparation made zero
production writes. Next gate: green CI and merge, followed by one 10 Reps
`review-only` dispatch and read-only proof of exactly 16 queue cards with zero
catalogue/control writes. Evidence:
[`evidence/RA-STAB-01-REVIEW-PUBLICATION-EXECUTION-DECOUPLING-2026-10-05.json`](evidence/RA-STAB-01-REVIEW-PUBLICATION-EXECUTION-DECOUPLING-2026-10-05.json).

**6 October Review Queue/execution decoupling — live verified:** PR `#228`
merged as `7ce7242` after full CI passed. The one bounded 10 Reps
`review-only` run `37370980156` completed from that exact commit. Fresh source
classification remained `950 = 934 VERIFY_NO_CHANGE + 16 review + 0 blocked`.
Catalogue apply, control registration, postflight and idempotency were all
skipped by the reviewed workflow mode. The existing shared publisher created
exactly 16 queue cards with zero refresh, supersede, resolve or catalogue
write. Independent production readback on 6 October found those exact 16 offer
IDs, all `PENDING`, identity-review, source-missing and review-only, all bound
to run `37370980156`. It compared all 950 catalogue rows with the sealed
pre-publication baseline and found every commercial, identity, URL and
freshness field unchanged. Products, variants, mappings, offers and price
history counts remained exactly `1337/3632/3758/3758/27666` before and after.
This closes the queue-publication coupling incident. It does not close the
older partial 10 Reps control plan or advance the natural `0/3` observation
counter; those remain separate stabilization work.

**6 October partial-plan recovery — shared fix, live verified:** the initial
repeatable-read production preflight of parent
`f945e4f1-00d2-462e-9646-5acb878469a8` proves the exact incident state rather
than inferring it from the failed workflow. The parent is `PARTIALLY_APPLIED`;
children `0..11` are `APPLIED` with 12 successful apply runs, 591 consumed row
approvals and 12 ready recovery manifests; child `12` is one expired,
unconsumed `APPROVED` boundary; children `13..18` remain `PLANNED`. There are no
failed/started runs, recovery approvals or recovery audit rows. Catalogue counts
remain `1337/3632/3758/3758/27666`.

The common correction extends the existing
`close_expired_retailer_offer_sync_approval(jsonb)` path. It accepts only a
complete applied prefix followed by exactly one expired approved child and a
planned suffix, verifies the successful run, row-approval and ready-recovery
evidence for every preserved child, then closes the active approval and marks
only the unexecuted suffix plus parent `SUPERSEDED`. It adds no retailer name or
ID condition, importer, approval path, executor or business-table writer. The
exact `12 + 1 + 6` regression preserves all 591 row approvals and expects only
nine control writes with zero catalogue/history writes. Focused tests and both
local quality gates pass. A production-schema rehearsal selected only migration
`20261006120000`, compiled successfully against ledger 224, proved unchanged
catalogue counts and rolled back completely. The earlier ordinary run
`37357956664` already proves all 934 safe operations, so it must not be repeated
merely for evidence. PR `#230` merged as `bba6bf3`; the one common migration was
then applied successfully. The production ledger is now 225 with fingerprint
`4981529d078bc0c4dc5d0597b3a6327f44270e76f4cca1a93483abe4c950cf9f`,
all five catalogue counts remained unchanged. PR `#231` then synchronized the
repository to the exact ledger-225 contract as merge commit `8dca00b`; project,
quick, full and CI gates passed.

One guarded workflow run `37426502233` took its own fresh read-only preflight
and closed the exact suffix once, with no retry. It preserved all 12 applied
children and 591 row approvals, marked only the seven unexecuted children and
the parent `SUPERSEDED`, and reported exactly nine control writes, zero business
writes and zero price-history writes. An independent repeatable-read readback
then found exactly `12 APPLIED + 7 SUPERSEDED`, 12 apply runs, 591 row
approvals, 13 batch approvals and 12 recovery manifests. Catalogue counts were
still exactly `1337/3632/3758/3758/27666`, and the read-only transaction was
rolled back. The partial-plan blocker is therefore closed without replaying the
already-proved 934 operations. The next gate is a fresh exact Review Queue
exception inventory, followed by shared guarded Review Queue execution and
status-monitoring completion.
Evidence:
[`evidence/RA-STAB-01-PARTIAL-PLAN-RECOVERY-PREPARATION-2026-10-06.json`](evidence/RA-STAB-01-PARTIAL-PLAN-RECOVERY-PREPARATION-2026-10-06.json).

**6 October exact Review Queue inventory — live verified:** a fresh independent
production transaction ran at repeatable-read, read-only isolation and rolled
back. It found exactly the current 14 Fit House stock-change cards and 16
10 Reps source-missing identity cards, all `PENDING`, with no active execution
request for either set and no owner decision recorded since midnight UTC. The
Fit House offer IDs are `697, 735, 921, 944, 951, 953, 954, 963, 972, 983,
1859, 1904, 1938, 1982`. The 10 Reps offer IDs are `2853, 2854, 2855, 2856,
2857, 2858, 2859, 2896, 2897, 2898, 2913, 2914, 3384, 3388, 3496, 3627`.
The 10 Reps rows remain intentionally review-only: their source is missing, so
there is no safe commercial operation to execute. This proves the exact
publication scope; it does not authorize or simulate a decision. The next gate
is to extend the one existing guarded Review Queue execution path while keeping
identity conflicts non-executable and avoiding a retailer branch in shared
core. Evidence:
[`evidence/RA-STAB-01-CURRENT-REVIEW-QUEUE-INVENTORY-2026-10-06.json`](evidence/RA-STAB-01-CURRENT-REVIEW-QUEUE-INVENTORY-2026-10-06.json).

**6 October shared Review Queue execution registry — merged and live-idle
verified:** the existing app adapter, queue worker and shared retailer worker now
consume one typed configuration registry instead of maintaining separate
execution allowlists. The existing eBay and Fit House behavior remains
registered, and 10 Reps joins the same shared protected worker for
`UPDATE_STOCK` only: one exact owner-approved stock decision plus 19 unchanged
freshness confirmations. It uses the existing 10 Reps feed profile, validator,
approver, executor, postflight and atomic mixed-batch path. No runtime,
importer, approval path, executor, RPC or catalogue writer was added.

The current 16 10 Reps `MANUAL_REVIEW_IDENTITY/SOURCE_MISSING` rows remain
default-deny and cannot be executed. Price, combined price/stock and identity
operations are not enabled for 10 Reps. A queue run also executes at most one
shared retailer profile, leaving a different profile queued for the next run;
this prevents the existing process-bound engine configuration from crossing
between Fit House and 10 Reps. Focused regressions execute the same guarded
stock-decision contract for both profiles and cover mixed-profile deferral.
Admin tests, TypeScript, quick/full gates and the production build passed.
PR `#233` merged as `907fdbab`; its full Quality Gate, Project Guardian,
GitGuardian and Vercel checks were green. One ordinary guarded worker dispatch,
run `37430887924`, loaded that exact merge, passed its seven focused runtime
tests and completed with `processed=0`, `failed=0` and `database_writes=0`.
Artifact `11396254362` has SHA-256
`31210eeb840c261c3d71fe9ebf749847a6a921c316e097b4c1bd1c1ac53e55c8`.
This proves the shared registry is deployed and safely idle; it does not pretend
that a 10 Reps commercial change occurred. A live 10 Reps write must wait for a
genuine fresh owner-approved `UPDATE_STOCK` row and must not be manufactured for
proof.
Evidence:
[`evidence/RA-STAB-01-SHARED-REVIEW-EXECUTION-REGISTRY-PREPARATION-2026-10-06.json`](evidence/RA-STAB-01-SHARED-REVIEW-EXECUTION-REGISTRY-PREPARATION-2026-10-06.json).

**6 October Review Queue monitoring status — merged and live verified, natural
schedule readback pending:** production run `37430887924` exposed the next common monitoring
defect. The owner-decision audit correctly found 33 items needing attention and
the worker remained healthy with zero writes, but the audit used exit code `2`,
so GitHub displayed a red error annotation for a non-failure. The existing audit
and existing five-minute queue schedule now use three explicit states:
`SUCCESS`, `WAITING_FOR_DECISION` and `FAILED_SYSTEM`. Waiting/review debt exits
normally; only a defined system-integrity failure exits red and prevents the
worker from running. The same workflow publishes the counts in its GitHub
summary. No second monitor, schedule, executor or write path was added. Focused
regressions plus the quick and full Quality Gates passed. PR `#234` merged as
`b52af90b`; Quality Gate, Project Guardian, GitGuardian and Vercel were green.
Live run `37432645097` then reported `WAITING_FOR_DECISION`, 377 pending owner
decisions, 33 review-attention findings, zero system failures, zero processed
requests and zero database writes. The audit step and entire job were green,
with no false error annotation. Artifact `11397791609` has SHA-256
`9c606065f6f978efaa2e81b7673f0ec7ffa4cb3fafd4e39d48015cbc8df61c67`.
This proves the production classification and fail-closed worker handoff. A
later natural scheduled run on the merge remains the final schedule readback;
it does not block work on the next retailer. Evidence:
[`evidence/RA-STAB-01-REVIEW-MONITORING-STATUS-PREPARATION-2026-10-06.json`](evidence/RA-STAB-01-REVIEW-MONITORING-STATUS-PREPARATION-2026-10-06.json).

**6 October Whey Okay guarded Review Queue execution and shared selection
cleanup — merged and live-idle verified:** Whey Okay now joins the same
closed execution registry and the same shared retailer worker for
`UPDATE_STOCK` only. The worker selects the retailer engine from one validated
module path in the registry and requires one common interface; it contains no
Whey Okay, Fit House or 10 Reps name/ID branch. The existing Whey Okay reader,
589-row manifest, validator, partial control registration, approver, executor
and postflight remain authoritative. No importer, approval path, executor, RPC,
schedule or catalogue writer was added.

The formerly Fit House-local selection of one stock-only decision plus 19
unchanged in-stock freshness confirmations is now one shared module used by
both existing engines. Price, combined price/stock, identity and source-missing
Whey Okay rows remain review-only/default-deny. Fresh source, immutable review
fingerprints, exact database before-state, role separation, postflight and
idempotency remain mandatory; stale evidence stops before registration. The
focused registry/selection/worker suite passes `5/5`, and the complete admin
plus Whey Okay suites pass `80/80`. Project Guardian before and after the
documentation change, the quick gate and the full gate all pass with zero
production/control writes during preparation. PR `#236` merged as `c4c680da`
after full Quality Gate, Project Guardian, GitGuardian and Vercel passed.

One production worker dispatch, run `37435625993`, checked that exact merge,
passed all `7/7` focused runtime tests and completed green. Monitoring reported
`WAITING_FOR_DECISION`, 377 pending owner decisions, 33 review-attention items
and zero system failures. The queue processed zero requests and made zero
database writes because no fresh eligible request existed. Artifact
`11398886676` has SHA-256
`0518d42e9a216d544778f67a29956a23056ff04a3288721f01caa17b65be115d`.
This proves deployment and safe idle behavior, not a Whey Okay commercial
write. A genuine fresh owner-approved `UPDATE_STOCK` request remains required
before commercial execution can be claimed; none will be manufactured for
proof. Evidence:
[`evidence/RA-STAB-01-WHEY-OKAY-REVIEW-EXECUTION-PREPARATION-2026-10-06.json`](evidence/RA-STAB-01-WHEY-OKAY-REVIEW-EXECUTION-PREPARATION-2026-10-06.json).

**6 October Whey Okay Review Queue publication and shared-core cleanup — merged
and live verified:** the existing Whey Okay workflow now has the
same `review-only` publication route as the shared Fit House/10 Reps workflow.
It performs a fresh ordinary dry-run, captures the existing read-only database
baseline, seals the classification plus immutable Whey preflight and sends the
result through the existing shared reconciliation and protected publication
RPC. This mode does not register or execute a catalogue plan. The ordinary
schedule uses the same bound publication after its existing guarded apply.

This was not implemented as a third branch in shared core. Retailer source-file,
partition and review-card differences now live in one closed profile module.
The prior Fit House-versus-10 Reps branches were removed from the shared source,
and workflow identity is profile data rather than a Fit House constant. The
Whey profile requires the exact 589-row partition, currently represented by
579 executable `VERIFY_NO_CHANGE` rows plus ten
`SOURCE_VARIANT_MISSING` review rows. Those ten become read-only identity cards;
they cannot become stock, price or identity writes. A changed count above the
current ten-row boundary, an overlap, a missing artifact, hash/commit/source
drift, stale evidence or any preflight write fails before publication.

Focused Fit House, 10 Reps, Whey, router and workflow regressions pass `65/65`,
including immutable-artifact tampering and a source scan proving no retailer
key branch remains in shared core. Project Guardian before the change, the
quick gate (`544` passed, three artifact-bound skips), the full gate, production
build and `git diff --check` all pass. PR `#238` merged as `ea217795` after full
Quality Gate `37448030302`, Project Guardian `37448030593`, GitGuardian and
Vercel passed.

The exact merged `review-only` run `37448387527` then reproduced the fresh
partition `589 = 579 VERIFY_NO_CHANGE + 10 SOURCE_VARIANT_MISSING + 0 blocked`.
Catalogue apply, apply postflight and apply idempotency were all skipped. The
existing protected publisher created exactly ten cards and performed no
refresh, supersede or source resolution. The cards are for offers `16, 1506,
1507, 1508, 1509, 1510, 1511, 1512, 1568, 1584`. Artifact `11403839254` has
SHA-256 `b84953fab528ff12c9b0dd5eeb9b4b5eaa4e625eb7fddee74fd0a1b66f1ef6db`;
queue artifact `11403424148` has SHA-256
`36b86e9fc3e1b508e831bb0fd0f929d80e47e162fa494b8667535352c7d7d586`.

An independent production read at `2026-10-06T10:18:44.674Z` found those exact
ten rows, all `PENDING`, identity/source-missing and `KEEP_UNCHANGED`, with zero
execution requests. Every current commercial and canonical identity field
matched the sealed before-state. Catalogue counts remained exactly
`1337/3632/3758/3758/27666` for products, variants, mappings, offers and price
history. The publisher transaction made 21 Review Queue/audit writes for ten
new cards, but zero catalogue or retailer-control writes. This closes fresh
Whey Okay Review Queue publication; a later commercial execution still requires
a genuine owner-approved executable stock decision and will not be fabricated
for proof. Evidence:
[`evidence/RA-STAB-01-WHEY-OKAY-REVIEW-PUBLICATION-PREPARATION-2026-10-06.json`](evidence/RA-STAB-01-WHEY-OKAY-REVIEW-PUBLICATION-PREPARATION-2026-10-06.json).

**6 October Fit House classifier-coverage correction and Review Queue
publication — merged and live verified:** scheduled run `37442830504` produced
valid fresh evidence for the exact ordinary partition `286 = 272 executable +
14 review + 0 blocked`, but the shared source binder incorrectly required the
classifier itself to contain only the 272 executable rows. Fit House correctly
classifies the complete 286-row scope because its 14 review rows are genuine
stock changes; 10 Reps correctly classifies only its 934 executable rows because
its 16 source-missing rows are quarantined before classification.

The correction does not add a Fit House branch to shared core. Classifier
coverage is now closed retailer-profile data: `full-partition` for Fit House and
`executable-only` for 10 Reps. The validator derives the expected IDs and count
from that contract and, for a full partition, also binds the classifier changed
IDs to the exact review IDs. The incident regression uses the production shape
and proves that omitting even one of the 286 approved IDs fails closed. The
previously failed run artifact now seals successfully without changing its
source bytes.

Focused publication tests pass `26/26`; quick gate passes `544` with the three
expected artifact-bound skips; full gate, production build, Project Guardian
before/after and `git diff --check` pass. PR `#240` merged commit `b1566fd` as
`cc4131a` after Quality Gate `37450521796`, Vercel and GitGuardian passed. The
post-merge Quality Gate `37450827077` also passed.

Exact merged `review-only` run `37450876753` then reproduced 272 safe
confirmations and the same 14 stock-review rows. Catalogue apply, apply
postflight and apply idempotency were skipped. The protected publisher refreshed
13 pending cards and preserved one matching approved card immutably; it made 27
queue/audit transaction writes and zero catalogue writes. Source artifact
`11407072137` has SHA-256
`1ece5f31020be305c8c64754e7677b0d26def3576a2fec1b7b740a172dc95763`;
queue artifact `11406537671` has SHA-256
`324cec2eaeb7d69e23293fc80e03cb6c8f8f4e20ce7614c363537e5618595fea`.

An independent read-only production check at `2026-10-06T10:41:21.525Z`
found the exact 14 active Fit House cards for offers `697, 735, 921, 944, 951,
953, 954, 963, 972, 983, 1859, 1904, 1938, 1982`. Thirteen are pending with
fresh run evidence. Review `1121` / offer `1982` remains approved with its
immutable decision evidence; it has no execution request and was not silently
executed. All current commercial and identity fields still equal the published
before-state. Catalogue counts remain `1337/3632/3758/3758/27666`, proving zero
catalogue change. The separate owner execution confirmation remains required
for offer `1982`; no request will be manufactured for proof. RA-STAB-01 remains
`IN_PROGRESS` pending the next ordinary schedule/watchdog observation. Evidence:
[`evidence/RA-STAB-01-FIT-HOUSE-REVIEW-PUBLICATION-LIVE-READBACK-2026-10-06.json`](evidence/RA-STAB-01-FIT-HOUSE-REVIEW-PUBLICATION-LIVE-READBACK-2026-10-06.json).

**6 October exact Review Queue watchdog baselines — merged and live
verified:** the shared watchdog configuration now binds the owner-approved Fit
House 14-row and 10 Reps 16-row review scopes to their exact offer IDs and the
canonical decision-evidence SHA. This is configuration data consumed by the
existing common monitored-backlog mechanism; no retailer branch, writer,
workflow, approval path or executor was added. A common regression proves the
exact scopes classify within baseline and substitution of even one offer fails
closed with `REVIEW_SCOPE_DRIFT`. Infrastructure, ordinary-run, write and
postflight failures remain unsuppressed.

PR `#242` merged as `13e9abf` after Quality Gate `37453727301`, Vercel and
GitGuardian passed; post-merge Quality Gate `37454059471` also passed. Full gate,
production build, quick gate (`544` pass and three expected artifact-bound
skips), all 46 catalog-health tests, Project Guardian and `git diff --check`
pass.

Read-only production watchdog `37454182407` on that exact merge made zero
database writes. 10 Reps now reports `PASS_WITH_REVIEW` with exactly 16 review
and 16 stale rows, no failures and `WITHIN_BASELINE`. Fit House retains only the
real `LATEST_ORDINARY_ATTEMPT_INCOMPLETE` from scheduled run `37442830504`; its
exact 14 review/stale rows produce no backlog growth. The global watchdog remains
red for four genuine retailer failures, proving the change did not make real
errors green. Artifact `11409260342` has SHA-256
`9dca3563b2a6e368ba51022c53fe2f541d95aa4de52ebc16c1b6c7a33f6e181e`.
This manual observation does not increment the ordinary counter; RA-STAB-01
remains `IN_PROGRESS` at `0/3` pending the next natural schedule. Evidence:
[`evidence/RA-STAB-01-WATCHDOG-APPROVED-REVIEW-BASELINES-LIVE-READBACK-2026-10-06.json`](evidence/RA-STAB-01-WATCHDOG-APPROVED-REVIEW-BASELINES-LIVE-READBACK-2026-10-06.json).

**6 October shared owner-decision bridge — merged and production migration live
verified:** the failed execution of approved Fit House review `1121` / offer
`1982` was traced to a contract gap, not bad source data. The ordinary generic
limits accepted the proposed one-row stock change, but the legacy Fit House
stable-OOS validator could not see the immutable Review Queue approval and
failed closed with `RSBI_GUARDRAIL_EXCEEDED`; catalogue writes remained zero.

The correction is one retailer-neutral owner-decision contract used by the
existing shared worker, Fit House engine and Whey Okay engine. It binds the
exact request, review, approval audit event, retailer, operation, fingerprints,
actor, timestamps, expiry, one changed stock row and nineteen unchanged
confirmations before delegating to the existing generic database validator.
It adds no importer, approval path, executor, direct database writer, retailer
ID branch or offer exception. Ordinary non-review requests retain their current
validators unchanged.

PR `#248` merged commit `ac4e888` as `6cf64e3` after full Quality Gate,
Project Guardian, baseline, Vercel and GitGuardian checks passed. The separately
owner-authorized migration
`20261006170000_add_automation_review_owner_decision_validation.sql` was first
rehearsed with rollback and then applied alone. Production advanced to ledger
`226`, fingerprint
`28ac0182d477dec9b85ffa3aea4a777d11715a0c52cd9ca9ba2d4fe6d76c030c`.
All catalogue counts remained exactly `1337/3632/3758/3758/28213`.

The read-only postflight confirms the helper exists, the ordinary route remains,
and only `retailer_catalogue_production_validator` has execute permission;
public, anon, authenticated, service role, approver and executor are denied.
Review `1121` remains approved and unexecuted, and its failed request remains at
zero database writes. No queue run, retry, replay or offer change occurred.
RA-STAB-01 remains `IN_PROGRESS` at `0/3`. The remaining sequence is one fresh
approved stock request, exact postflight/idempotency, then ordinary observation.
Evidence:
[`evidence/RA-STAB-01-OWNER-DECISION-BRIDGE-PREPARATION-2026-10-06.json`](evidence/RA-STAB-01-OWNER-DECISION-BRIDGE-PREPARATION-2026-10-06.json).

**6 October owner-decision postflight finalization incident:** exact request
`976f67b4-c06c-4f73-a3c6-48ca63f45dfd` in run `37492690030` executed its
bounded `1 + 19` scope and passed database postflight. Offer `1982` is already
`in_stock=false`; price, shipping, total, URL and mapping are unchanged. The
subsequent idempotency rebuild failed before source fetch because the legacy
Fit House stable-OOS state guard saw the newly approved OOS row without the
applied decision context. This is a finalization/control-status defect, not an
apply failure, and the request must not be retried.

The prepared correction is retailer-neutral: the shared worker seals the exact
applied stock transition into fresh-source idempotency, persists successful
postflight before that check, and retains pessimistic writes in failed batch
reports. The existing queue workflow has a mutually exclusive recovery mode;
it downloads the original artifact, repeats database postflight and
fresh-source idempotency, and only then calls a control-only, non-replay RPC.
It creates no importer, executor, approval path or catalogue writer and adds no
retailer ID branch to shared core. Owner-authorized migration
`20261006190000_add_automation_review_verified_postflight_recovery.sql` was
applied with production ledger `227`, fingerprint
`89b59678999d7d564a5a9a304e0307f8771a82b86afd8a95ce378eb3ea3f461e`
and zero catalogue-count change. Local focused tests, repository quick/full
gates and PR 250 required CI pass. The exact disposable-PostgreSQL
recovery regression passes in run `37497626481` (job `112386140281`); the full
integration suite remains red only on pre-existing Predators Gear, nutrition
and stale expired-close evidence tests.

The single authorized live recovery run `37501471469` then failed closed before
the control RPC on `Fit House protected-offer stable OOS baseline drift`. It
made no catalogue or control write and was not retried. The first stable-OOS
guard had the sealed transition, but a second existing Fit House reconciliation
guard still used the old count. The follow-up correction passes the same bounded
zero-or-one allowance through both existing guards, adds no offer ID exception
and closes migration `20261006190000` in the repository selector at ledger
`227`.

The owner-authorized second and final recovery run `37503672017` on merge
`66639cfd` passed the original artifact binding, repeated database postflight
and fresh-source idempotency. It returned `control_status=EXECUTED`,
`catalogue_writes=0`, exact offer `1982`, 19 freshness confirmations, one
historical stock delta and zero price, shipping, total, URL, mapping or price
history delta. The request and review are now `EXECUTED`; no further recovery
is needed or authorized. The workflow's final read-only audit alone failed on
`EXECUTED_EVIDENCE_INCOMPLETE`: it required ordinary `expected_deltas` and did
not yet recognize the sealed `VERIFIED_POSTFLIGHT_RECOVERY` event. The pending
reporting-only correction accepts that event only when its postflight hash,
executed offer, actual deltas, database-write evidence and idempotency result
match the recovered request. It performs no write. Focused, quick and full
quality gates passed. A fresh production read-only audit at
`2026-10-06T17:35:54.242Z` then returned `PASS_WITH_REVIEW` /
`WAITING_FOR_DECISION`, with `403` pending owner decisions, `33`
review-attention findings and `0` system failures. Review `1121` and request
`976f67b4-c06c-4f73-a3c6-48ca63f45dfd` are `EXECUTED` and have no audit
anomaly. This closes the false reporting failure without another recovery.
RA-STAB-01 remains `IN_PROGRESS` at `0/3` ordinary intervals. Evidence:
[`evidence/RA-STAB-01-REVIEW-POSTFLIGHT-FINALIZATION-PREPARATION-2026-10-06.json`](evidence/RA-STAB-01-REVIEW-POSTFLIGHT-FINALIZATION-PREPARATION-2026-10-06.json).

**7 October natural watchdog and review-backed waiting classification — shared
correction live-verified:** scheduled watchdog `37578070655` ran on merge `cf7cae8`
after the zero-step orphaned read-only run `37510180895` was cancelled to release
the watchdog concurrency group. It made zero database writes and truthfully kept
Fit House red because its latest ordinary shared run `37442830504` is incomplete.
10 Reps is `PASS_WITH_REVIEW` on that same run and Whey Okay retains a complete
ordinary success. The watchdog also exposed three backlog-growth failures:
Jon's `5/5`, 6 Pack `14/14` and eBay `68` stale offers covered by `79` review
rows. Production readback proves eBay has all `79` active Review Queue rows and
its same ordinary run completed the queue-publication job. Jon's and 6 Pack
have no active rows for those scopes, so they remain system failures rather
than being relabelled as owner waiting.

The shared correction adds explicit `SUCCESS`, `WAITING_FOR_DECISION` and
`FAILED_SYSTEM` watchdog status. Backlog outside the frozen baseline becomes
waiting only when stale and review ID evidence is complete and unique, every
stale offer is covered, the same ordinary workflow run successfully published
that retailer's Review Queue rows, and no unexpected failure is present.
Missing publication, incomplete evidence, an uncovered stale offer,
infrastructure failure or write evidence remains red. No ceiling, allowed-ID
list, retailer branch, monitor, schedule, credential or write path was added.
Focused, quick and full tests passed. PR `#253` merged as `14db78b`; its required
CI passed. Read-only watchdog `37581684482` then verified the contract with zero
database writes: eBay became `PASS_WITH_REVIEW` with
`REVIEW_BACKED_BACKLOG_OUTSIDE_BASELINE`, while Fit House, Jon's and 6 Pack
remained red for their real unresolved conditions. The run's overall
`FAILED_SYSTEM` result is therefore expected and fail-closed, not a failed
deployment. This does not advance the `0/3` ordinary interval counter. Evidence:
[`evidence/RA-STAB-01-WATCHDOG-REVIEW-BACKED-WAITING-PREPARATION-2026-10-07.json`](evidence/RA-STAB-01-WATCHDOG-REVIEW-BACKED-WAITING-PREPARATION-2026-10-07.json).

**7 October Jon's and 6 Pack durable Review Queue publication — shared
extension prepared:** production evidence shows Jon's ordinary run `37457004820`
partitioned `506` offers into `501` executable and `5` source-missing review
rows, while 6 Pack run `37448175548` partitioned `506` into `492` executable
and `14` review rows. Neither retailer had active Review Queue rows, so the
watchdog correctly kept both red. The existing shared publisher now accepts
profile-defined source envelopes and card semantics without retailer branches
in shared core. Each workflow seals its pre-execution classification before
apply and publishes only through the existing guarded reconciliation RPC.
Jon's rows are identity-review-only. 6 Pack source-missing rows are identity
review and its price/mass-OOS rows are policy-review-only. Neither retailer is
added to the execution-adapter registry, so these cards cannot execute catalogue
changes. No queue, publisher, executor, credential or direct database path was
added. Focused `77/77`, quick `547` and full quality gates passed. PR `#255`
passed Quality Gate run `37587513945`, Project Guardian run `37587514008`,
Vercel and GitGuardian, then merged as `64c29f6`. Only the next natural schedule
readbacks remain; no retailer workflow was manually dispatched. This does not
advance the `0/3` ordinary interval counter. Evidence:
[`evidence/RA-STAB-01-JONS-SIX-PACK-QUEUE-PUBLICATION-PREPARATION-2026-10-07.json`](evidence/RA-STAB-01-JONS-SIX-PACK-QUEUE-PUBLICATION-PREPARATION-2026-10-07.json).

**7 October Review Queue work dashboard — shared UX preparation:** the existing
authenticated Review Queue now separates exact owner work from technical and
system-owned rows. It adds owner decision, approved-to-execute, processing,
technical and completed counters; per-retailer progress; a completed-today
count; a one-row work mode; and a compact list mode. Search loads the same
bounded complete queue and searches all statuses before pagination. After a
decision, a same-origin allowlisted return path drops pagination and returns to
the first remaining matching row, while external redirects are rejected.
Advanced filters and bulk actions remain available but collapsed.

This is one retailer-neutral UI/read-only classification change. It adds no
queue, publisher, executor, RPC, credential or catalogue write path. Existing
authentication, fingerprint, expiry, stale-state, confirmation, approval and
separate execution guards are unchanged. Focused admin tests pass `57/57`,
TypeScript and changed-file ESLint pass, and quick verification passes `547`
tests (`544` pass, `3` skip); the full production-build gate also passes. PR
`#257` merged as `eb72ca4`; GitHub CI, Vercel production deployment and the
authenticated read-only production dashboard readback all pass. Evidence:
[`evidence/RA-STAB-01-REVIEW-QUEUE-WORK-DASHBOARD-PREPARATION-2026-10-07.json`](evidence/RA-STAB-01-REVIEW-QUEUE-WORK-DASHBOARD-PREPARATION-2026-10-07.json).

**7 October Review Queue remaining-work navigation correction:** owner readback
confirms nine recent recorded decisions, six queued execution requests and three
approvals without an execution request (offers `2689`, `2703`, `2704`). An
`APPROVED` review remains approved while its request waits in `QUEUED`; the old
dashboard therefore returned to already-submitted cards. The shared read model
now reads bounded complete execution state before classification and pagination.
Queued, dispatched and executing requests leave owner work immediately. Changed
request fingerprints are technical attention, and an incomplete read disables
actions. Return redirects and next/previous navigation target the working-card
anchor; sticky counters show today's submissions, completed decisions and
remaining steps. Expired evidence no longer counts as completed owner work.
Focused `59/59`, quick and full verification pass. PR `#259` merged as
`73616f7` after green CI and Vercel production deployment. Authenticated
read-only production check at `12:22:51 UTC` confirms only offers `2703` and
`2704` remain in EXECUTE, while all six queued requests appear in PROCESSING.
Offer `2689`'s previous review expired. Sticky counters and the card anchor are
present. The six requests remain queued, not completed; this UI proof does not
close their execution or the RA-STAB-01 natural intervals.
No queue/executor/RPC, production submission or guard change is added.
Evidence: [remaining-work navigation](evidence/RA-STAB-01-REVIEW-QUEUE-PENDING-NAVIGATION-2026-10-07.json).

**7 October Review Queue current-versus-history search correction:** searching
eBay offer `2703` displayed two visually identical expired cards. Read-only
owner evidence identifies review `1014` from 5 October and its newer generation
`1159` from 7 October. The shared UI now uses one newest, non-superseded review
per retailer offer for ordinary work and search. A clearly labelled checkbox
can include older review generations when history is intentionally needed.
This adds no database query, write path, retailer condition or approval change.
Focused `59/59`, TypeScript, changed-file ESLint, quick/full quality gates and
merged-main CI pass. Authenticated production GET readback on merge `d6ab38c`
returns one result by default and two only with `history=1`; it submitted no
decision or execution. Evidence: [current search](evidence/RA-STAB-01-REVIEW-QUEUE-CURRENT-SEARCH-2026-10-07.json).

**7 October Fit House durable Review Queue state and 6 Pack binding correction —
prepared without threshold widening:** natural shared run `37599546370` stopped
Fit House at `110` OOS because the ordinary path counted the five still-OOS
legacy approved offers but did not read the already verified Review Queue
execution for offer `1982`. Review `1121` and request
`976f67b4-c06c-4f73-a3c6-48ca63f45dfd` prove the exact owner-approved
`true -> false` stock transition, database postflight, one stock delta,
idempotency `PASS` and the current OOS state. The existing Fit House guard now
accepts that durable evidence only when review/request fingerprints, operation,
before/after state, postflight, idempotency, executed IDs, deltas and current
offer all agree. An unproved extra OOS still blocks; the baseline remains `104`
and no offer-ID exception is added. A fresh production read-only build passes
with `273` safe rows plus `13` review rows and zero writes.

The same audit found 6 Pack run `37605681359` completed its catalogue refresh
but failed Review Queue publication because the profile used internal key
`six-pack-supplements` as the retailer slug. Production and the existing 6 Pack
connector use `6-pack-supplements`. The profile now keeps its internal key and
postflight profile unchanged while binding publication to the real retailer
slug. The exact incident regression and the combined focused suite pass
`73/73`; quick verification passes `547` tests and the full quality gate passes.
PR `#263` passed CI and merged as `fb4d211f`; post-merge Quality Gate
`37634547821`, Project Guardian `37634547774` and production deployment
`6912251322` passed. No failed artifact was replayed, no queue row was published
and no retailer workflow was manually dispatched. Natural schedule readbacks remain gates; the
ordinary counter stays `0/3`. Evidence:
[`evidence/RA-STAB-01-FIT-HOUSE-DURABLE-REVIEW-SIX-PACK-BINDING-PREPARATION-2026-10-07.json`](evidence/RA-STAB-01-FIT-HOUSE-DURABLE-REVIEW-SIX-PACK-BINDING-PREPARATION-2026-10-07.json).

**7 October Review Queue dispatch truthfulness — merged, deployed and live
verified:** the panel
already writes one immutable queued request before optional immediate GitHub
dispatch, and the existing scheduled worker is the only fallback. Production
behavior showed that immediate dispatch is not currently dependable, while the
page promised completion within a few minutes and a transient dispatch error
returned HTTP 503 after the request was already safely queued. The shared route
now records one of four delivery outcomes: immediate, scheduled fallback,
transient fallback or already-existing. The page removes the fixed-time promise,
warns against duplicate clicks, displays request time and provides a refresh
link. Dispatch failure remains server-logged but returns the owner to the real
queued state. No executor, queue, credential path, adapter, approval rule or
catalogue write changes. Focused admin tests pass `60/60`; quick and full
quality gates, the production build, Project Guardian, TypeScript and
changed-file ESLint pass. PR `#265` merged as `df9bdb50`; post-merge Quality
Gate `37637486837`, Project Guardian `37637487001` and production deployment
`6912768616` passed. Authenticated production GET readback at
`2026-10-07T14:37:18.117Z` returned HTTP 200 for all four delivery messages,
confirmed the fixed-minute promise absent and submitted zero decisions or
executions. The next evidence gate is a real queued request and natural worker
pickup; immediate dispatch still depends on the existing server-side token
configuration, not a second executor. Evidence:
[`evidence/RA-STAB-01-REVIEW-QUEUE-DISPATCH-STATUS-PREPARATION-2026-10-07.json`](evidence/RA-STAB-01-REVIEW-QUEUE-DISPATCH-STATUS-PREPARATION-2026-10-07.json).

**7 October Review Queue continuous working-set correction — merged, deployed
and live verified:** owner feedback after processing the approved execution bucket found
that the single-card work mode forced a separate `next` navigation for every
offer. Because a submitted offer correctly leaves owner work, the next card was
also labelled `1`, which made real progress look like a restart. The existing
retailer-neutral work view now renders a bounded set of at most ten full cards,
so adjacent offers use ordinary scrolling. Its sticky status says how many
remain, which range is visible and how many execution steps were submitted
today; the view labels and batch navigation no longer describe each card as a
new page-one position. The compact list remains separate.

This changes only presentation and the existing pagination constant. It adds no
queue, executor, scheduler, adapter, approval rule, retailer condition,
credential or catalogue-write path, and it does not weaken authentication,
fingerprint, expiry, stale-state or confirmation checks. A shared regression
proves the work set is capped at ten and a twelfth item remains on the second
bounded page. Focused admin tests pass `60/60`; Project Guardian, quick
verification (`547` tests: `544` pass, `3` skip) and the full production-build
gate pass. A read-only rolled-back
production snapshot at `2026-10-07T14:43:53.758Z` found no approved item waiting
for submission and no active execution request. Today's recorded execution
outcomes were five `EXECUTED` single-offer writes, four fail-closed price-drift
expiries and six fail-closed evidence expiries. None was retried. PR `#267`
merged as `d5d4677`; PR and post-merge Quality Gate and Project Guardian runs
passed, as did production deployment `6915045129` and the production-readonly
deployment `6915081828`. An authenticated GET at
`2026-10-07T16:23:55.489Z` returned HTTP 200 with the remaining count, visible
range, today-progress and non-restart explanation, and rendered exactly ten
bounded work cards. It submitted zero decisions and zero executions. Evidence:
[`evidence/RA-STAB-01-REVIEW-QUEUE-CONTINUOUS-WORKSET-2026-10-07.json`](evidence/RA-STAB-01-REVIEW-QUEUE-CONTINUOUS-WORKSET-2026-10-07.json).

**7 October Whey Okay capability description correction — merged and deployed:**
the shared Review Queue capability matrix still told the owner that Whey Okay's
current dry-run was blocked by an active/conflicting session. Natural scheduled
run `37595708904` contradicts that time-bound text: dry-run, protected apply,
database postflight, fresh-source idempotency and Review Queue publication all
completed successfully. The capability description now states only the durable
contract — approved exact-identity freshness uses the ordinary guarded
schedule — and no longer embeds transient production state in source code. A
regression requires the durable description and rejects the obsolete blocker
claim. This changes no capability, adapter, operation, workflow, queue,
credential, guard or write path. Focused admin tests pass `60/60`, Project
Guardian passes, quick verification passes `547` tests (`544` pass, `3`
skip), and the full production-build gate passes. PR `#269` merged as
`7c736f9b74b71922d84a9ceb89c9960ebd1271bb`; post-merge Quality Gate run
`37653807405` and Project Guardian run `37653807369` passed, and Vercel
deployment `3UGL5DhYurvp898GTmCAAwz9WGbx` completed successfully. The
authenticated production GET returned HTTP 200 and submitted zero decisions or
executions. It had no matching historic Whey Okay freshness row, so the
row-specific description was not renderable; the evidence records this as an
honest non-applicable live-copy check rather than claiming a rendered string.
This correction earns no ordinary interval credit.
Evidence:
[`evidence/RA-STAB-01-WHEY-CAPABILITY-DESCRIPTION-2026-10-07.json`](evidence/RA-STAB-01-WHEY-CAPABILITY-DESCRIPTION-2026-10-07.json).

**8 October KIOR child-approval timeout — shared diagnostic and control-only
recovery live verified:** scheduled run `37639033936` read a healthy complete
Shopify source and classified all `11/11` approved rows as
`VERIFY_NO_CHANGE`, but its child-approval query timed out after control
registration. It completed zero business writes and zero price-history writes.
Read-only control preflight `37739756503` then proved one exact expired,
unexecuted child: the approval was unconsumed, with zero row approvals and zero
apply runs. The shared engine now classifies this boundary as
`CONTROL_CHILD_APPROVAL_OUTCOME_UNKNOWN` and retains only safe parent/child
recovery identity; there is no KIOR branch and no approval, timeout, executor
or write-path change. The regression, quick/full gates and PR `#271` CI passed,
and the correction merged as `a685a63a`.

After exact owner authorization, run `37741754695` made one control-only close
call. Postflight proves the parent and its sole child are `EXPIRED`, the
approval is closed and unconsumed, and accounting is exactly `3` control
writes, `0` retries, `0` apply runs, `0` business writes and `0` price-history
writes. Catalogue counts remained `1337/3632/3758/3758/28784`. This recovery
does not earn ordinary interval credit; RA-STAB-01 remains `IN_PROGRESS` at
`0/3`. The next gate is a later natural KIOR schedule followed by a later
correlating read-only watchdog, not a manual replay. Evidence:
[`evidence/RA-STAB-01-KIOR-CHILD-APPROVAL-RECOVERY-2026-10-08.json`](evidence/RA-STAB-01-KIOR-CHILD-APPROVAL-RECOVERY-2026-10-08.json).

Docker run `37421724769` now proves the existing expired-close regression and
the new exact `12 + 1 + 6` fixture pass against disposable PostgreSQL. The
monolithic integration job remains red only for the same two unrelated
Predators Gear and nutrition failures already present on main run
`37331353245`; neither failure is in the RA-STAB-01 path or changed here.

**8 October owner-requested manual runtime verification and shared stable-OOS
alignment â€” shared correction deployed, fresh run pending:** sequential guarded
ordinary-path runs used the current workflows without replaying an old plan.
KIOR run `37747565164` passed: all `11/11` approved rows were executed as
freshness-only confirmations; postflight records zero price, stock, shipping,
total, URL, mapping and price-history changes and `11` freshness updates.

6 Pack run `37748035569` passed end-to-end. Its `506` offers split into `492`
safe confirmations and `14` Review Queue rows; postflight records zero
commercial or stock changes and `492` freshness updates. The repaired shared
queue-publication job then created exactly `14` cards, with zero catalogue
writes. This proves the previously failing 6 Pack publication path. These are
manual checks and do not increment the ordinary observation counter.

Fit House run `37747849842` stopped before registration or apply, with zero
database, business and control writes. The storefront capture was healthy, but
the old Fit-House-only database route rejected a `46`-row no-change batch with
zero new OOS rows because it still expected an obsolete exact OOS baseline.
The common classifier already handles this correctly: a historical OOS ratio
does not by itself constitute a new stock incident. The prepared migration
`20261008100000_align_shared_stable_oos_validation.sql` moves ordinary Fit
House traffic back to the shared validator and makes the database rule agree:
the total-OOS-ratio guard applies only when a batch introduces a new OOS row.
The new-OOS count, OOS-increase, source, identity, price, approval and all
other guards are unchanged. It adds no importer, executor, approval route,
catalogue writer or new retailer branch; the dormant legacy validator is not
deleted in this stabilization step. The first exact preflight rolled back on a
false post-check and made no persistent change. PR `#275` corrected only that
post-check. After a passing rollback rehearsal, the owner-authorized migration
with SHA-256 `500a02c99919a540e0d34485b94828f255de3e24fc9e78de9f59d94e19d36085`
was applied alone. Production is now ledger `228`, fingerprint
`c8ed22c12cd4b660703080589084fed25a7d2c14038999a65d6793b085ec9037`;
all five catalogue counts remained `1337/3632/3758/3758/28784`. The next gate
is the one authorized fresh Fit House run without retry or replay. Evidence:
[`evidence/RA-STAB-01-MANUAL-RUNTIME-AND-SHARED-OOS-PREPARATION-2026-10-08.json`](evidence/RA-STAB-01-MANUAL-RUNTIME-AND-SHARED-OOS-PREPARATION-2026-10-08.json).

**8 October fresh Fit House post-deployment run — stable-OOS fixed, concurrent
writer gap isolated:** owner-authorized run `37764996832` proved the deployed
shared validator correction: all six read-only batches passed, yielding `273`
safe confirmations and `13` Review Queue rows. The queue reconciliation
refreshed those `13` cards and wrote no catalogue row. The first apply child
then failed closed with `RSBI_EXPECTED_DELTA_MISMATCH`; its transaction rolled
back completely. Production readback found no apply run, no catalogue or
price-history change, one unconsumed expiring batch approval and unchanged
catalogue counts `1337/3632/3758/3758/28784`. No retry or replay was made.

The exact cause is cross-retailer concurrency, not Fit House data. Scheduled
6 Pack run `37763759985` was committing approved offer writes during the same
68-second Fit House transaction. 6 Pack calls the common approved import
executor directly, outside the mixed-batch wrapper that owns the existing
global write lock. The migration
`20261008120000_serialize_all_approved_offer_writes.sql` moves that same lock
into the common approved executor. This serializes both direct and mixed-batch
writes without a retailer branch, new executor, importer, approval path or
catalogue write in the migration. Its SHA-256 is
`dc06b5abce598ebca33d1d72544cd87b6bebf21a7c4cf9eb5adf35f55174a3cb`.
PR `#277` passed full CI and merged as `917fa2dfeb9a15e88884820bb4c5ec13fabd27e8`.
The exact migration then passed a rollback rehearsal and was committed alone.
Production is now ledger `229`, fingerprint
`a93a1fcb7a078cc5ce89a1d134696b6a738f3fd2e7e8c92df0a72969f615dfbc`;
catalogue counts remained `1337/3632/3758/3758/28784`. The next gate is merging
the matching production-ledger binding, expiry-safe control-only closure of the
failed Fit House plan if still open, and the one authorized fresh Fit House run
without retry or replay.
RA-STAB-01 remains `IN_PROGRESS` at `0/3` natural intervals.

The production-ledger binding passed full CI in PR `#278` and merged as
`c6a78b99e5697f951327b529edefc8f55ad58ba8`. Control-only run `37770502407`
then closed exact expired Fit House parent
`574512db-c472-42e5-a9ee-15b74364f8a0` and all six unexecuted children with
zero apply runs, retries, business writes or price-history writes. Fresh run
`37770776303` subsequently passed end-to-end: `273/286` rows executed as safe
freshness confirmations, `13` remained review-only, and zero rows were blocked.
Postflight recorded zero price, stock, shipping, delivered-total, URL, mapping
or effective price-history changes and `273` freshness updates; the fresh
idempotency check passed. Queue reconciliation refreshed the same `13` cards
with zero catalogue writes. No retry or replay occurred. This manual run proves
the repaired path but does not increment the `0/3` natural-interval observation
counter; the next gate is three ordinary scheduled intervals with correlating
read-only watchdog evidence.

**8 October sequential manual path validation and shared partition correction:**
read-only watchdog `37779570754` inspected all 12 retailers with zero database
writes and no global failure. The six healthy or intentionally monitored paths
were left alone. One manual KIOR run `37781359538` then passed end-to-end with
`11/11` freshness-only confirmations, zero commercial change and passing
idempotency. 10 Reps run `37781824504` failed closed before the database because
its protected CSV feed timed out; the public storefront being available does
not prove that feed. Whey Okay run `37782235972` stopped at startup on an
existing control/session conflict. Simply Supplements run `37782531399`
completed a healthy `119 safe + 1 review` classification but refused to create
an equivalent active control plan. All three failures made zero new database,
business or control writes, and none was retried.

Exact read-only Simply preflight `37784294670` found parent
`a02c4e0f-97ca-4f08-b3e8-8287351fdb39` with three unexecuted children,
zero apply runs and zero business or price-history writes. It is
`READY_TO_CLOSE`, but no close was performed; that remains a separately
authorized control-only action. Whey Okay still requires read-only discovery of
its exact blocking identity, and 10 Reps waits for its protected feed.

Jon's scheduled run `37771317361` exposed a shared contract defect: a sixth
valid no-write review row made the full `500 safe + 6 review = 506` partition
fail only because the publication profile carried a historical maximum of five.
The prepared correction removes that historical count from runtime decisions
and applies one exact invariant to Standard, Whey and Jon's profiles:
`executable + review = approved mappings`, with zero blocked rows and zero
catalogue writes from review publication. It adds no retailer branch, importer,
approval path, executor or writer. The regression reproduces the observed
`500 + 6` partition; focused tests pass `30/30`, neighboring refresh tests pass
`55/55`, and the quick quality gate passes. The next gate is the full quality
gate, merge, and one fresh Jon's run without retry or replay. Manual checks do
not advance the ordinary counter, which remains `0/3`. Evidence:
[`evidence/RA-STAB-01-MANUAL-PATH-VALIDATION-2026-10-08.json`](evidence/RA-STAB-01-MANUAL-PATH-VALIDATION-2026-10-08.json).

PR `#280` passed full CI and merged the shared correction as `03bbf563`.
Exactly one fresh Jon's run `37785913168` then passed end-to-end without retry
or replay. The full `506`-offer scope partitioned into `500` executable rows and
`6` review-only rows with zero blocked rows. Execution completed `495`
unchanged confirmations and `5` source-proven stock updates; postflight found
zero price, shipping, delivered-total, URL, mapping or effective price-history
change, and fresh idempotency passed. Queue reconciliation created the six
current cards, superseded five older cards and made zero catalogue writes.
This proves the common partition correction in production. Code is now frozen;
manual evidence still does not advance the `0/3` natural counter. The remaining
pre-observation blockers are the exact stale-control recovery for Simply and
Whey and availability of the protected 10 Reps feed.

The separately authorized Simply Supplements control-only recovery then ran
once as `37788944248`. It expired exact parent
`a02c4e0f-97ca-4f08-b3e8-8287351fdb39` and its three unexecuted children with
one close call, zero apply runs, zero retry or replay, zero business writes and
zero price-history writes. Postflight preserved catalogue counts at
`1337/3632/3758/3758/29577`; the Simply stale-control blocker is closed.

One authorized read-only Whey Okay discovery followed as `37790817618`. It
found exactly one blocking parent,
`73d7ef28-04ae-46b9-8ac2-69792f807546`, in `PARTIALLY_APPLIED` state. Eleven
of its twelve children are already `APPLIED`; one is still `APPROVED`, with no
planned or applying children. Discovery used one read transaction and made
zero close calls, control writes, business writes or price-history writes. No
Whey recovery was authorized or performed. The next bounded Whey step requires
separate exact owner authorization and must preserve the eleven applied
children while closing only the unexecuted boundary. 10 Reps remains paused
until its protected CSV feed is healthy. After those blockers are cleared, one
fresh normal Simply and Whey run without retry or replay can verify both paths;
then code remains frozen for three natural intervals. Manual control work does
not advance the counter, so RA-STAB-01 remains `IN_PROGRESS` at `0/3`.
Evidence: [Simply close and Whey discovery](evidence/RA-STAB-01-SIMPLY-CLOSE-WHEY-DISCOVERY-2026-10-08.json).

The separately authorized Whey control-only recovery then ran exactly once as
`37795892851`. Its fresh preflight revalidated the partial plan before the
write. The existing shared close preserved all `11` already applied children
and their `11` apply runs, superseded only the single expired unexecuted child,
and moved parent `73d7ef28-04ae-46b9-8ac2-69792f807546` to `SUPERSEDED`.
Postflight recorded one close call, three control writes, zero automatic
retries, zero business writes and zero price-history writes. Catalogue counts
remained `1337/3632/3758/3758/29577`; the Fit House, 10 Reps and Review Queue
jobs were skipped. The Whey stale-control blocker is therefore cleared without
re-execution or catalogue mutation. The remaining pre-observation work is to
leave 10 Reps alone until its protected feed is healthy and to verify Simply
and Whey through one fresh normal guarded run each without retry or replay.
This manual control action does not advance the natural counter; RA-STAB-01
remains `IN_PROGRESS` at `0/3`. Evidence: [Whey control close](evidence/RA-STAB-01-WHEY-CONTROL-CLOSE-2026-10-08.json).

One owner-authorized fresh normal Simply Supplements run `37797608023` then
passed after its stale-control recovery. It partitioned `120` mappings into
`119` executed rows and one no-write `SOURCE_VARIANT_MISSING` review row.
Postflight passed: `118` unchanged confirmations, one source-proven price and
delivered-total update, `119` freshness updates, zero stock/shipping/URL/mapping
changes and `price_history +1`; fresh idempotency also passed. This proves the
normal Simply path is healthy. The corresponding one-shot Whey Okay run
`37798277043` failed closed at startup before source capture or any write. A
subsequent one-shot read-only control discovery `37798642443` is `CLEAR`: the
old Whey parent plan is gone and no recoverable retailer-3 parent remains. The
remaining Whey block is therefore the older global startup guard: it reports
only that one or more control counters are non-zero, not which record caused
it. No retry occurred. The next gate is one shared read-only diagnostic of that
existing global guard, with no retailer branch, offer change or retry. RA-STAB-01
remains `IN_PROGRESS` at `0/3`. Evidence: [fresh Simply and Whey runs](evidence/RA-STAB-01-SIMPLY-WHEY-FRESH-RUNS-2026-10-08.json).

PR `#286` then added a shared, validator-only `control-diagnostic` operation
without changing the normal startup decision. One owner-authorized diagnostic
run `37804078924` read the existing state once and made zero database, control,
business, price-history or source-capture writes. It proves that all counters
except `parents` are zero: there is exactly one globally counted active parent,
not an active session, run or approval. The former Whey parent remains absent;
the count does not expose the remaining parent's identity or permit inferring
its retailer/status. The next gate is one bounded read-only parent inventory,
using an existing mechanism or separately reviewed shared capability, before
any closure, retry or another ordinary Whey run. This is diagnostic evidence,
not natural-interval credit; RA-STAB-01 remains `IN_PROGRESS` at `0/3`.
Evidence: [Whey control-guard diagnostic](evidence/RA-STAB-01-WHEY-CONTROL-GUARD-DIAGNOSTIC-2026-10-08.json).

The bounded next diagnostic is now prepared as one shared read-only capability,
not a Whey-specific exception. Migration
`20261008140000_add_active_retailer_parent_inventory.sql`, SHA-256
`c3f435135190f97c6be62c562d715f1f3f341629b263fee22848f8f033cda0af`,
returns only active parent identity, retailer, status, timestamps and aggregated
child/apply status counts. It is executable only by the existing staging and
production validator roles, requires a read-only transaction with `SAFE_UPDATE`
unset, and contains no business/control DML. The existing `control-diagnostic`
will compare its exact row count with the old global counter in the same
read-only transaction. Focused tests pass `95/95`; quick/full and Project
Guardian gates pass. Production is unchanged. After green CI, deployment of
the exact migration and one diagnostic read remain separate production gates.
Evidence: [active-parent inventory preparation](evidence/RA-STAB-01-ACTIVE-PARENT-INVENTORY-PREPARATION-2026-10-08.json).

The first production rollback-only rehearsal stopped before commit because its
preflight incorrectly required both staging and production validator roles in
one environment. Production has only the appropriate production role. No
migration, business or control write occurred. The shared migration now grants
and verifies only validator roles present in the target environment while
denying every present approver, executor and service role. Its corrected
SHA-256 is `6499f29df0c33311d6810fd33293d1de72d4de3e92b75b3e9027e67a46e317e6`;
the prior hash is superseded and must not be deployed. A new exact owner
authorization is required before another production rehearsal or apply.
Evidence: [role-scope correction](evidence/RA-STAB-01-ACTIVE-PARENT-INVENTORY-ROLE-CORRECTION-2026-10-08.json).

The corrected migration then passed its rollback-only rehearsal and the exact
owner-authorized production apply. Production advanced from ledger `229` to
`230` with fingerprint
`746ab61dcdb38158f17845af0ce4ceb84c919e85c14d039276652e24ca1a558e`;
all five catalogue counts remained unchanged. The single authorized read-only
diagnostic run `37812312245` used one transaction and two bounded RPCs, made
zero database/control/business writes and started no source capture. It
identified the sole global parent blocker as Discount Supplements plan
`ee32bf39-0e6b-4524-86e8-1d7c787ddecf`, retailer `4`, status `APPROVED`, with
two `PLANNED` children, one `APPROVED` child, no apply runs and an expired
approval. The former Whey parent remains absent. No closure, retry, replay or
offer change was authorized or performed. The next gate is separate exact
authority for the existing shared control-only recovery after it verifies the
three unexecuted child bindings; only then may one fresh ordinary Whey run be
considered. This diagnostic does not advance the natural counter; RA-STAB-01
remains `IN_PROGRESS` at `0/3`. Evidence: [live active-parent inventory](evidence/RA-STAB-01-ACTIVE-PARENT-INVENTORY-LIVE-2026-10-08.json).

The owner then authorized one exact shared control-only close. Run
`37814571515` re-read and verified Discount Supplements parent
`ee32bf39-0e6b-4524-86e8-1d7c787ddecf`, its one expired approved child and
two planned children before making one close call. It expired the parent and
all three children with five control writes, zero apply runs, zero retries and
zero business or price-history writes. Postflight preserved catalogue counts
at `1337/3632/3758/3758/29578`; Fit House, 10 Reps and Review Queue jobs were
skipped. The global blocker is therefore cleared without replay or catalogue
mutation. The next gate is one separately authorized fresh ordinary Whey Okay
run and exact postflight review. This manual recovery gives no natural interval
credit; RA-STAB-01 remains `IN_PROGRESS` at `0/3`. Evidence: [Discount control close](evidence/RA-STAB-01-DISCOUNT-CONTROL-CLOSE-2026-10-08.json).

The authorized fresh ordinary Whey Okay run `37816626614` reached the common
guarded executor but did not finish. Source capture passed on its first request;
the complete `589 = 579 safe + 10 review` partition contained zero blocked
rows, and Review Queue publication refreshed all ten no-write review cards.
The first six of twelve sequential children committed `291` freshness-only
confirmations. Child seven then exceeded the executor's `180`-second statement
limit and rolled back; five later children never started. Independent read-only
run `37818124480` and exact expired-plan preflight `37818886595` prove the
parent is `PARTIALLY_APPLIED`, with `6 APPLIED + 1 APPROVED + 5 PLANNED`, six
successful apply runs, 291 consumed row approvals and unchanged catalogue and
business-price-history counts `1337/3632/3758/3758/29578`. No retry, replay or
close occurred. The apply failure report's zero-write counters cover the failed
call only and must not be used as whole-run postflight. The exact plan is now
`READY_TO_CLOSE`; the next gate is separate owner authority to preserve the six
completed children and close only the six expired unexecuted children, followed
by a shared timeout/progress diagnostic and regression rather than a Whey-only
exception. This forced failure gives no natural interval credit; RA-STAB-01
remains `IN_PROGRESS` at `0/3`. Evidence: [Whey partial-timeout readback](evidence/RA-STAB-01-WHEY-FRESH-RUN-PARTIAL-TIMEOUT-2026-10-08.json).

The owner-authorized exact control-only close then passed in run `37821360235`.
It preserved all six applied children, their six successful apply runs, six
ready recovery records and all `291` freshness confirmations. It superseded
only the expired unexecuted suffix: one approved child plus five planned
children. The single close call made eight control writes, zero business or
price-history writes and no retry or replay. Postflight marked the parent
`SUPERSEDED`, closed the unused approval and preserved catalogue and business
price-history counts at `1337/3632/3758/3758/29578`. The next gate is a shared
timeout/progress correction with an incident regression before any further
ordinary Whey run; no retailer-specific exception is authorized. This manual
close gives no natural interval credit, so RA-STAB-01 remains `IN_PROGRESS` at
`0/3`. Evidence: [Whey partial-plan close](evidence/RA-STAB-01-WHEY-PARTIAL-PLAN-CLOSE-2026-10-08.json).

The shared partial-progress reporting correction is now locally complete and
fully verified. One helper records the approved and committed sequential prefix
after every child and is used by the Whey, Fit House shared-profile and Jon's
engines; no retailer name/ID branch, importer, executor, workflow, database
function, approval rule, guard, timeout or business-write behavior was added or
changed. The incident regression reproduces twelve children, `579` safe rows,
six committed children and `291` committed confirmations before child seven
times out, and proves the failure artifact retains those exact facts rather
than reporting a false zero. Focused and neighboring tests pass `114/114`, and
`verify:project`, `verify:quick`, `verify:full` and the production build pass.
This fixes truthful diagnosis only; it does not claim that the underlying
database delay is understood or removed. No production run or write occurred.
The next gate is review, push, green CI and merge, followed only under separate
authority by a fresh diagnostic validation of the common executor. No timeout
increase or retailer-specific workaround is justified. RA-STAB-01 remains
`IN_PROGRESS` at `0/3`. Evidence: [shared partial-progress preparation](evidence/RA-STAB-01-SHARED-PARTIAL-PROGRESS-PREPARATION-2026-10-08.json).

PR `#293` passed all checks and merged as `f08d1871`. The one owner-authorized
fresh Whey validation run `37826090676` then completed the common path without
retry or replay. All twelve children and all `579` safe freshness confirmations
applied; ten missing-source rows remained review-only, zero rows were blocked,
postflight and fresh idempotency passed, and the ten existing Review Queue cards
were refreshed with zero catalogue writes. There were no price, stock,
shipping, total, URL or price-history changes, and catalogue counts remained
`1337/3632/3758/3758/29578`. The shared progress report truthfully records
`12/12` children and `579/579` rows. The former seventh-child timeout did not
recur. However, the apply step took `766` seconds, so correctness is proven but
runtime headroom is not acceptable for stable unattended operation. The next
bounded task is one shared read-only database performance audit of the existing
executor/SQL path using this run as evidence; no additional Whey run, timeout
increase or retailer-specific bypass is justified. This owner-triggered proof
does not increment the natural counter, so RA-STAB-01 remains `IN_PROGRESS` at
`0/3`. Evidence: [Whey shared-progress live proof](evidence/RA-STAB-01-WHEY-SHARED-PROGRESS-LIVE-PROOF-2026-10-08.json).

The bounded shared performance audit is now live verified by read-only run
`37832592271`, artifact `11574162885`, digest
`40ba8d6a99003a137434a9d962a3c994df5f8a55d8e24d58e66774a5bd5c1a87`.
It used only the production validator login in a read-only transaction and made
zero database writes, retries or replays. Production exposes one ordinary
execution chain made of the current dispatcher plus two retained compatibility
layers. Across that common chain the source contains three JSON row loops, one
per-row approval call, one per-row apply call, nine row-state calls and two each
of the business-count, other-retailer-fingerprint and protected-shared
fingerprint checks. Primary lookup indexes are present. PostgreSQL
`track_functions` is `none`, so the audit proves repeated structural work but
does not invent an exact per-function share of the observed `766` seconds. The
next bounded step is an isolated common-executor benchmark and one shared SQL
consolidation proposal that removes redundant reads while retaining every
validation, approval, stale-state, atomicity, rollback, postflight and
idempotency guard. No timeout increase, retailer-specific bypass or production
migration is yet justified. The manual audit gives no natural interval credit;
RA-STAB-01 remains `IN_PROGRESS` at `0/3`. Evidence: [shared executor
performance audit](evidence/RA-STAB-01-SHARED-EXECUTOR-PERFORMANCE-AUDIT-2026-10-08.json).

The bounded local consolidation is now prepared without adding another
executor or retailer branch. Migration
`20261008200000_consolidate_shared_executor_state_reads.sql` changes only the
common unreviewed executor: it keeps the before-state read, caches one
post-apply state and reuses that exact JSON value for all seven existing field
comparisons. Deterministic source instrumentation therefore reduces row-state
function calls from `9` to `2` per offer (`7` fewer, `77.78%`) while retaining
manifest, ledger, approval, replay, stale-state, locking, per-row validation,
apply, aggregate-delta, cross-retailer fingerprint, recovery and idempotency
guards. Focused tests, quick/full gates and the exact PostgreSQL 17 production
sequence pass. GitHub integration run `37836089622` applied the reviewed
dispatcher and candidate migration in a disposable database, then passed the
26-row execution, negative, replay and atomic rollback scenario in `9426` ms.
The wider historical integration gate still has four unrelated failures already
present on scheduled `main` runs; they are not represented as success here.
The migration is SHA-bound and closed in both environment
selectors: it is not deployed and authorizes no retailer run. Exact production
deployment still requires separate owner authority. RA-STAB-01 remains
`IN_PROGRESS` at `0/3`. Evidence: [shared executor state-read
consolidation](evidence/RA-STAB-01-SHARED-EXECUTOR-STATE-READ-CONSOLIDATION-2026-10-08.json).

The owner-authorized staged deployment is complete. PR `#302` isolated the one
approved migration from seven older staging candidates; staging rehearsal,
apply and read-only postflight passed at ledger `100` with unchanged catalogue
counts. PR `#303` admitted the same file to production; rehearsal, apply and
postflight passed at ledger `231`, fingerprint
`d30de0526f773eae1084721517f078e5725803d236556fb2a69fbb5eb1b5e094`,
again with unchanged catalogue counts. The one authorized Whey run
`37840451727` failed closed after `38` seconds before apply because its commit
still carried the pre-deployment `230`-row runtime binding. It wrote no offers
or price history and was not retried or replayed. The common selector/runtime
closeout now records the migration as applied and closed; no retailer branch,
new executor, weaker guard or timeout change was added. A second fresh run is a
separate gate because the one-run authority was consumed. RA-STAB-01 remains
`IN_PROGRESS` at `0/3`. Evidence: [shared executor deployment](evidence/RA-STAB-01-SHARED-EXECUTOR-STATE-READ-DEPLOYMENT-2026-10-08.json).

The separately authorized fresh Whey Okay run `37841687855` then passed on the
closed production binding `3f95c12` without retry or replay. The full
`589 = 579 safe + 10 review` partition contained zero blocked rows; all twelve
children and all `579` freshness-only confirmations completed. Postflight and
fresh idempotency passed with zero price, stock, shipping, total, URL or
price-history changes. The ten missing-source variants remained isolated and
their existing Review Queue cards were refreshed with zero catalogue writes.
The apply step completed in `611` seconds versus `766` seconds in the preceding
successful proof, a measured reduction of `155` seconds (`20.23%`). An
independent read-only production check passed at ledger `231`, preserved
catalogue counts `1337/3632/3758/3758/29578` and made zero writes. This proves
the common consolidation live; it does not guarantee future latency or count as
a natural interval. The path is frozen for three ordinary scheduled
observations, so RA-STAB-01 remains `IN_PROGRESS` at `0/3`. Evidence: [Whey
post-consolidation live proof](evidence/RA-STAB-01-WHEY-POST-CONSOLIDATION-LIVE-PROOF-2026-10-08.json).

The next Review Queue worker exposed one bounded Fit House accounting defect,
not new catalogue drift. Run `37865904014` completed the reviewed stock changes
for offers `983` and `1859` and also applied the reviewed return to stock for
offer `697`; every completed row passed postflight and fresh idempotency. The
worker nevertheless left request `0f058ea0-20b7-43ea-8e69-83acb831a56c`
failed because the stable-OOS guard remembered verified moves into OOS (`+1`)
but did not subtract a verified move back into stock (`-1`). A subsequent exact
control-only recovery `37883359564` failed closed before any additional
business write and reproduced the same cause. The guard is now prepared to
account for both directions as signed, sealed Review Queue transitions and to
require equality with the exact resulting OOS count. The approved baseline is
unchanged, unknown drift still fails closed, and no shared-core branch, new
executor, retry, replay or threshold widening was added. A regression covers
the real `697/983/1859` sequence; focused tests (`106/106`), quick and full
gates pass. PR `#306` merged the repair as
`16abf47e83a9c1c7d4002f66c5616bdd036cad26` after all CI checks passed. The
single exact control-only recovery `37884246127` then passed: request
`0f058ea0-20b7-43ea-8e69-83acb831a56c` and review `1115` are `EXECUTED`, fresh
postflight and idempotency passed, and the recovery made zero catalogue writes.
It reused the original verified `20` writes (`1` stock return plus `19`
freshness-only confirmations) and recorded zero price-history delta. Offers
`735` and `1904` remain untouched. This manual repair does not advance
natural-cycle credit, so RA-STAB-01 remains `IN_PROGRESS` at `0/3`. Evidence:
[Fit House signed stock-delta recovery
preparation](evidence/RA-STAB-01-FIT-HOUSE-SIGNED-STOCK-DELTA-RECOVERY-PREPARATION-2026-10-09.json).

Fresh read-only 10 Reps run `37885704534` proved that the protected CSV source
had recovered: HTTP `200`, `516` products, `1857` variants, no retry, and a
complete `950 = 934 executable + 16 source-missing review` partition. The 934
executable rows comprised `837` confirmations and `97` validator-approved stock
changes. The separately authorized apply run `37886686256` repeated the healthy
capture but failed closed before registration or apply while binding the same-run
Review Queue source. It made zero database, business and control writes. Root
cause is a shared publication-contract defect: the standard source-missing
profile required every executable row to be `VERIFY_NO_CHANGE`, although the
shared validator and planner correctly allow safe commercial changes in that
separate executable scope. The prepared common repair validates the exact union
of confirmations and classifier-proven executable changes, including exact
stock-change IDs, while retaining disjoint review scope, zero blocked rows and
fail-closed count/identity checks. It contains no retailer-name/ID branch, new
executor, retry, replay or guard relaxation. The real `837 + 97 + 16` incident
passes locally along with focused `77/77`, quick and full gates. Merge after
green CI, then use one new fresh ordinary run; never resume or replay the failed
plan. RA-STAB-01 remains `IN_PROGRESS` at `0/3`. Evidence: [10 Reps shared
executable partition preparation](evidence/RA-STAB-01-10REPS-SHARED-EXECUTABLE-PARTITION-PREPARATION-2026-10-09.json).

PR `#308` merged the shared partition repair at
`6fb61872b535cd4c5453d603991609514d2be6a8`. One new fresh ordinary 10 Reps
run `37887683300` then passed source capture, dry-run, baseline, all 22 read-only
child validations and the same-run Review Queue binding. Registration failed
closed before creating any parent, child or approval because the planner's
22 safe children exceeded the older shared registration maximum of 20. The
live shape was `934 = 837 VERIFY_NO_CHANGE + 97 UPDATE_STOCK`; 65 updates were
new OOS and therefore correctly distributed at no more than 3 per child. The
apply diagnostic records zero completed database, business and control writes.
The shared queue publisher separately replaced the prior 16 10 Reps review
records with the same 16 current source-missing records and made zero catalogue
writes. Migration `20261009100000_align_shared_sequential_child_capacity.sql`
is prepared to align the planner and all nine current shared/dedicated
registration functions at a bounded 50-child maximum. It does not change the
50-row child cap, 3-new-OOS child cap, retailer policy, approval or executor.
The migration preserves function owner, security mode, volatility, parallel
mode, configuration and ACL exactly and aborts on definition drift. No deploy
or replacement run is yet recorded. RA-STAB-01 remains `IN_PROGRESS` at `0/3`.
Evidence: [shared sequential child-capacity
preparation](evidence/RA-STAB-01-SHARED-SEQUENTIAL-CHILD-CAPACITY-PREPARATION-2026-10-09.json).

PR `#309` merged the common alignment at
`8ef14ef2e8b8ab7695e78dd6d7d1b5ee65b6674f`. The exact hash-bound migration
subsequently passed rollback-only production rehearsal, apply and independent
read-only postflight. The production ledger advanced from `231` to `232` with
fingerprint
`6d22d965f22c5d281c3b4b4c8a9dfd5f7b7892e853bea185b2a51dd412f06104`;
all catalogue counts remained unchanged (`1337` products, `3632` variants,
`3758` mappings, `3758` offers and `29600` price-history rows). The repository
runtime binding must be sealed and merged at ledger `232` before dispatching
the one authorized fresh 10 Reps run, so the ordinary ledger guard sees the
same verified database state. No retry or replay occurred. Evidence: [shared
sequential child-capacity deployment](evidence/RA-STAB-01-SHARED-SEQUENTIAL-CHILD-CAPACITY-DEPLOYMENT-2026-10-09.json).

PR `#310` then sealed runtime ledger `232` as merge commit
`be09593c2bea16da6a52dadc7674f6bb9e709aae`. The one authorized fresh 10 Reps
run `37892636516` passed source capture, dry-run, baseline, all 22 validators
and Review Queue publication. It registered the parent successfully and safely
completed four children covering 172 rows. The fifth 43-row child exceeded the
unchanged 120-second database query boundary and failed closed. Read-only
production discovery proves exactly four `APPLIED`, one `APPROVED` and 17
`PLANNED` children, with no hidden fifth apply and no retry, replay or recovery.

This is a shared executor-transaction sizing incident, not a 10 Reps identity
or source problem. The prepared common correction changes the operational
child target from 50 to 20 rows while retaining the database hard cap of 50,
the maximum of three new OOS rows, the 50-child parent cap and every existing
approval, stale-state, identity and postflight guard. The same 934-row fixture
now produces 47 bounded children. No timeout is increased, no retailer branch
or second executor is added, and an incident regression covers the exact live
shape. The partial plan must not be resumed: after merge, the next separately
authorized boundary is one control-only close preserving four applied children
and closing only 18 unexecuted children, followed by one new fresh run. Manual
work earns no ordinary observation credit; RA-STAB-01 remains `IN_PROGRESS` at
`0/3`. Evidence: [10 Reps partial timeout and shared correction](evidence/RA-STAB-01-10REPS-PARTIAL-TIMEOUT-2026-10-09.json).

PR `#311` merged the 20-row shared child target as
`20dea68bb4f7ad92c3d364fee12c685efea8a78d`. The owner-authorized control-only
close run `37898666426` then preserved all four applied children of expired 10
Reps parent `ebdc44cb-668b-41ba-8fae-fb3f9b70ed4d` and closed exactly its 18
unexecuted children with zero business or price-history writes. The one new
fresh run `37898775120` used 47 children for the current
`950 = 934 executable + 16 review` partition. It safely committed 25 children
and 500 rows, then its twenty-sixth 20-row child reached the unchanged
120-second query boundary. Read-only run `37914426428` independently proves one
`PARTIALLY_APPLIED` parent `63a57694-c40b-45d6-8a87-90ca7aa22b8d`, exactly 25
applied, one expired approved/unexecuted and 21 planned children, 25 apply runs,
zero hidden write, retry, replay or close, and unchanged catalogue counts
`1337/3632/3758/3758/29600`.

This second partial result disproves child-size reduction as a sufficient
solution: the first 500 rows already consumed about 39 minutes, so all 47
children cannot reliably finish inside the 45-minute parent approval window.
The common executor still computes a full other-retailer fingerprint twice per
child by materialising every unrelated mapping, offer and price-history row.
Migration `20261009120000_add_compact_other_retailer_fingerprint.sql` prepares
one shared, versioned correction: every complete row remains covered by
SHA-256, but fixed-width ordered row digests and relation counts replace the
wide aggregate JSON. Historical recovery manifests remain bound to the legacy
algorithm; only manifests whose immutable ledger includes the new migration use
V2. No retailer branch, executor, approval path, timeout increase, approval
extension or guard relaxation is added. Focused tests, `verify:quick` and
`verify:full` pass locally. GitHub run `37917685369`, job `113777767079`, proves
the exact PostgreSQL 17 migration/executor/recovery scenario as passing test 43.
The wider historical integration batch remains red on four unrelated tests
(`27`, `31`, `67`, `68`), which are not folded into this correction. The current
partial plan must not be resumed or replayed, and merge, deployment, close and
another fresh run each remain separate future gates. Manual work gives no
ordinary interval credit; RA-STAB-01 remains `IN_PROGRESS` at `0/3`. Evidence:
[10 Reps compact fingerprint preparation](evidence/RA-STAB-01-10REPS-COMPACT-FINGERPRINT-PREPARATION-2026-10-09.json).

PR `#312` merged the shared implementation as
`23aa8387da7040214158c2a3078da7c4fcbcd723`; PR `#313` then exposed only the
owner-authorized production migration. Rollback-only rehearsal, apply and an
independent read-only postflight all passed. Production advanced from ledger
`232` to `233` with fingerprint
`65bd715ca8d7012125308e505c6af94b633820498d442d7ee7e84c89800df3cc`.
All catalogue counts stayed unchanged at `1337/3632/3758/3758/29600`, including
zero offer or price-history writes. The runtime binding is being closed at
ledger `233` before the separately authorized control-only close of parent
`63a57694-c40b-45d6-8a87-90ca7aa22b8d`. No retry, replay or fresh run has yet
occurred in this authorized sequence. Evidence: [compact fingerprint production
deployment](evidence/RA-STAB-01-COMPACT-FINGERPRINT-DEPLOYMENT-2026-10-09.json).

PR `#314` sealed the production runtime at ledger `233` as merge commit
`82ea06e00b4311730309e66a32ad2af9fee6d739`. Owner-authorized control-only run
`37920649441` then revalidated partial 10 Reps parent
`63a57694-c40b-45d6-8a87-90ca7aa22b8d`, preserved all 25 applied children and
their 25 apply runs, and superseded only the 22 unexecuted children. It made 24
control writes and zero business or price-history writes, with no retry or
replay.

The one authorized fresh ordinary-path run `37920753417` completed successfully
in `10m50s`. It captured all `516` products and `1857` variants from the
protected CSV with HTTP `200` and zero source retries, reproduced the exact
`950 = 934 executable + 16 review` partition, and applied all `934` safe rows in
all `47` children. Postflight proved `27` stock transitions, `934` freshness
updates, zero catalogue-row delta and zero price-history delta. The fresh
idempotency capture returned `934` no-change rows, the same 16 isolated review
rows and zero writes, approvals or recovery calls. The shared Review Queue
publisher refreshed exactly those 16 cards without catalogue writes. Final
independent read-only discovery run `37922058572` returned `CLEAR`, zero blocking
plans and unchanged counts `1337/3632/3758/3758/29600` at ledger `233`.

This live proof closes the compact-fingerprint incident without a retailer
branch, second executor, timeout increase or weakened guard. The repaired path
is now frozen. Because the successful run was manually dispatched, it provides
live proof but no natural-interval credit; RA-STAB-01 remains `IN_PROGRESS` at
`0/3`. The only next gate is three consecutive ordinary scheduled intervals
with correlated watchdog and database evidence. Evidence: [10 Reps compact
fingerprint live proof](evidence/RA-STAB-01-10REPS-COMPACT-FINGERPRINT-LIVE-PROOF-2026-10-09.json).

A fresh read-only watchdog `37959713036` then distinguished old schedule
evidence from current runtime health. KIOR's failed schedule used an older
commit and stopped on the migration-ledger hash; current-main dry-run
`37959509322` passed all `11` unchanged rows with zero writes. Whey Okay's old
schedule had encountered a control conflict, but current diagnostic
`37960338261` is `CLEAR` and dry-run `37960466540` passed `579` unchanged plus
`10` review rows. The successful 10 Reps proof and clear control readback remain
current. Fit House alone reproduced a present defect in read-only run
`37960409561`: a healthy `242`-product, `338`-variant source produced `275`
unchanged and `11` stock-change rows, but the consumed one-time returned-offer
contract rejected the later ordinary scope before shared isolation.

The prepared correction completes the existing common safe/review partition.
For isolation-enabled profiles, `MASS_OOS` holds new OOS transitions,
`MASS_PRICE` holds price changes and `MASS_CHANGE` holds changed rows in the
existing Review Queue while the remaining safe rows continue. A stale one-time
review contract still cannot authorize a write, but it no longer vetoes a later
isolation-only cycle; existing owner-deferred rows remain deferred. The exact
Fit House regression produces `275` executable confirmations and `11` review
rows. No retailer identity branch, new importer, executor, approval path,
threshold increase, retry or replay was added. Focused tests pass `83/83` and
`verify:quick` passes. The correction is `PREPARED_NOT_DEPLOYED`; it earns no
ordinary interval credit and the counter remains `0/3`. Evidence: [shared
aggregate review partition preparation](evidence/RA-STAB-01-SHARED-AGGREGATE-REVIEW-PARTITION-PREPARATION-2026-10-09.json).

PR `#327` merged the shared aggregate partition as
`773fc3934ad1db7aa00130721636d94911a4d407`. Its first post-merge read-only Fit
House run `37962781276` failed closed with zero writes before classification.
The healthy, unchanged source capture still contained `242` products and `338`
variants, but six protected synthetic source rows recognized by the first
reconciliation step were not passed to the next common reconciliation call;
the same older-array selection was present in the second confirmation capture.
The prepared follow-up introduces one shared source-precedence helper and uses
it in both captures. It adds no offer ID, source exception, approval or write
path. The new incident regression and neighboring focused suite pass `83/83`.
PR `#328` merged that follow-up as
`cb532e4fe2e4df50ab4c73932b6468a26e0ffd6a`. Fresh post-merge read-only Fit
House run `37963946528` passed as `PASS_WITH_REVIEW`: all `286` approved rows
were accounted for as `275` safe freshness confirmations plus `11` review rows
(`10` existing owner-deferred stock rows and one `MASS_OOS` row), with zero
blocked rows. Both source captures agreed at fingerprint
`3334da61c9cdff2f3e9dd9429d8729c4477c3932260ce2fba0691ff2fc704678`;
the source returned HTTP `200`, `242` products and `338` variants with zero
retries. The validator passed all `14` batches and the run attempted and
completed zero database, business, control, approval and recovery writes.

Fresh read-only watchdog `37964214687` then checked all `12` configured
retailers with zero writes. It continues to report Whey Okay, KIOR, Fit House
and 10 Reps as failed because their latest *scheduled* attempts remain older
incomplete runs; the successful manual apply/read-only proofs do not replace
that ordinary-schedule evidence. This is intentional and is not bypassed or
relabelled as success. Current-path evidence is clear for KIOR, Whey Okay,
Fit House and 10 Reps, but RA-STAB-01 remains `IN_PROGRESS` at `0/3`. The only
next gate is three consecutive ordinary scheduled intervals with correlated
watchdog and database evidence; no retry, replay or historical-plan resume is
opened.

The latest scheduled Automation Review Queue worker run `37940227059` exposed
one remaining common monitoring defect. All five selected eBay requests failed
closed before catalogue writes: four carried expired review evidence and one
had binding drift. Their retailer workers moved the requests to `EXPIRED`, but
the outer batch treated every caught request exception as a system failure and
made the workflow red. This contradicted the established three-state monitoring
contract: a safely rejected stale owner decision is review outcome, not system
failure.

The prepared shared correction separates verified safe revalidation from real
batch failure. It accepts only closed drift/expiry/revalidation/binding/evidence/
scope error codes with zero catalogue writes, and then independently reads the
request back as exactly `EXPIRED`. Only that bounded combination becomes
`PASS_WITH_REVIEW`; missing or different disposition, an unknown error, or any
catalogue write remains `FAIL` and exits nonzero. The GitHub summary exposes
queue result, safe rejection count and system failure count separately. The
regression reproduces the exact five production request IDs and error split.
Focused testing and `verify:quick` pass. No retailer condition, retry, replay,
approval, executor, writer, credential or guard change is introduced. This
preparation earns no ordinary interval credit; RA-STAB-01 remains `IN_PROGRESS`
at `0/3`. Evidence: [Review Queue safe-revalidation status
preparation](evidence/RA-STAB-01-REVIEW-WORKER-SAFE-REVALIDATION-PREPARATION-2026-10-09.json).

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
