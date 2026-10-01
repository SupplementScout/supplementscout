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
