# RA-STAB-01 current production state — 29 September 2026

**Checkpoint:** read-only inventory complete; shared diagnostic correction
verified; no production recovery has started.

**Authoritative observation:** Automation Reliability Watchdog run
[`36564343116`](https://github.com/SupplementScout/supplementscout/actions/runs/36564343116),
generated `2026-09-29T11:51:54.990Z`. The retained `watchdog.json` SHA-256 is
`74eff41cae1e0b4a489eab883ebdd146a2ad65597639e08fc23adeb01595f1ea`.
The run inspected 12 configured retailers, reported six `FAIL`, four
`PASS_WITH_MONITORED_BACKLOG`, one `PASS_WITH_REVIEW` and one `PASS`, and made
zero database writes.

The preceding watchdog run `36563575874`, generated
`2026-09-29T11:44:28.408Z`, reported seven failures and selected an old Simply
Supplements success even though ordinary run `36561004224` had completed. A
second capture selected `36561004224` correctly and moved Simply to
`PASS_WITH_REVIEW`. The anomaly is retained as a transient evidence-read
observation. It is not reproducible evidence for a code change or baseline
exception.

## Classification

| Retailer | Current result | Current evidence | Incident class | Blocking scope and next action |
| --- | --- | --- | --- | --- |
| GYM HIGH | `PASS_WITH_MONITORED_BACKLOG` | run `36556717990`; 1/66 older than 48h | `MONITORED_DEBT` | Ordinary path is healthy. Keep the one known row isolated; no repair. |
| Whey Okay | `FAIL` | latest ordinary run `36543685468` stopped before validation on an active approval/workflow/session; watchdog sees 870/870 older than 48h | `CONTROL_LIFECYCLE` | First repair candidate. Read the existing plan/session ledger and identify the exact stale or conflicting state. Do not create, approve, replay or expire anything without separate authority. |
| Discount Supplements | `PASS_WITH_MONITORED_BACKLOG` | run `36436360553`; 109/109 executed, 47/156 isolated older rows | `MONITORED_DEBT` | Ordinary executable scope is correlated. Preserve the existing isolated baseline; no repair. |
| Dolphin Fitness | `PASS_WITH_MONITORED_BACKLOG` | run `36561659250`; 1/1 executed, 2/3 isolated older rows | `MONITORED_DEBT` | Ordinary executable scope is correlated. No repair. |
| Simply Supplements | `PASS_WITH_REVIEW` | run `36561004224`; 119/119 executed, one review row, zero blocked | none | Healthy guarded path. Observe the next ordinary interval; do not patch the transient first-watchdog read. |
| KIOR Health | `PASS` | run `36446858310`; 11/11 executed, zero review, zero older than 48h | none | Healthy guarded path; observation only. |
| Fit House | `FAIL` | shared run `36546643195` rejected changed protected six-offer source fingerprint; watchdog sees 286/286 older than 48h | `FINGERPRINT_OR_IDENTITY` | Compare the new source artifact with the protected fingerprint and classify the change. No baseline refresh or identity decision is implied. |
| Jon's Supplements | watchdog `FAIL`; ordinary path `PASS_WITH_REVIEW` | run `36558502917`; 501/501 executed, five review rows, zero blocked; watchdog failure is only `MONITORED_BACKLOG_GROWTH` | `MONITORED_DEBT` | Not a failed execution. Classify the five isolated review rows and decide whether the monitored baseline contract should represent current review scope; never widen it merely to turn green. |
| 6 Pack Supplements | watchdog `FAIL`; latest ordinary source capture failed | run `36551183019` failed closed because one approved WooCommerce page returned HTTP 404; zero writes; watchdog's last successful contract has 494 executed and 12 review rows | `SOURCE` plus `MONITORED_DEBT` | Reproduce the single-page source failure through the existing connector and determine whether the item was removed, redirected or temporarily unavailable. Missing source is not OOS or deletion authority. |
| eBay UK | `FAIL` | run `36562647774`: apply/postflight passed for 156 rows and 81 review rows, then fresh no-op changed the source fingerprint and scope and failed; zero blocked | `SOURCE` / `EVIDENCE_CORRELATION` | The guard worked. In about ten minutes the capture moved from 236 executable + 1 review to 156 executable + 81 review. Diagnose source-read volatility and preserve both artifacts; no retry or evidence splice. |
| Predators Gear | `PASS_WITH_MONITORED_BACKLOG` | 47/47 older rows; no configured workflow; `INCOMPLETE_CORE` is within the retained baseline | `MONITORED_DEBT` | This is known coverage debt, not an unexplained runtime failure. No new workflow under stabilization. |
| 10 Reps | `FAIL` | shared run `36546643195` produced a valid dry-run with 934 matched + 16 missing, then apply failed closed with `RSBI_REPLAY_BLOCKED` because an equivalent active plan exists; zero completed writes | `CONTROL_LIFECYCLE` plus `EVIDENCE_CORRELATION` | Inspect the existing active plan/session and its terminal-state contract together with Whey Okay. Do not replay, supersede or mutate the ledger without exact authority. |

## What the checkpoint proves

- The first repair should target the shared control-lifecycle incident class,
  not a retailer. It affects Whey Okay and 10 Reps and currently blocks the
  largest stale scopes.
- Fit House, 6 Pack and eBay are separate source/fingerprint investigations.
  Combining them into one generic retry would erase useful failure boundaries.
- Jon's is not a failed execution. Its red status is monitored review-scope
  growth. Simply is healthy after the second independent read.
- The eBay idempotency failure is protective evidence: a materially different
  fresh capture was not accepted as proof of the apply capture.
- No evidence in this checkpoint authorizes a production/control write,
  approval, replay, baseline widening, identity decision or RA-004 retry.

## Next bounded work

Open the shared `CONTROL_LIFECYCLE` investigation for Whey Okay and 10 Reps in
read-only mode. Produce one state-transition table covering plan, session,
approval, expiry and terminal states; reproduce both failure codes against
fixtures; and decide whether the incident is stale state, missing recovery
operation, or correct blocking. Only a demonstrated retailer-neutral contract
defect may proceed to implementation and a common regression test.

## Control-lifecycle investigation checkpoint

The first repeated incident is now reproduced from retained artifacts.

- 10 Reps run `36400487268` passed source and validator checks, then completed
  exactly one control write. The immediately following parent-approval call
  ended with `Query read timeout`: `control_writes_completed=1`, approvals
  created/consumed `0`, business writes `0`. Run `36546643195` then correctly
  failed closed with `RSBI_REPLAY_BLOCKED` because that registered plan remains
  active. This is an ambiguous hand-off after registration, not an unsafe
  replay or classifier failure.
- The existing shared refresh engine recorded only the count of the completed
  control write. It did not retain the registered parent/child IDs and immutable
  fingerprints in its always-uploaded diagnostic before attempting parent
  approval. That omission forces a later operator to rediscover exact state and
  encourages one-off cleanup migrations.
- Whey Okay has failed at the initial state read on seven consecutive ordinary
  runs beginning `35833574845` on 23 September. Its current RPC collapses five
  blocking counters into one message and counts parent plans, approvals, runs
  and matching active sessions globally. Existing evidence therefore does not
  identify which counter is non-zero. Changing its scope without the exact
  readback would be speculation.

A retailer-neutral observability correction is implemented in the existing
shared refresh engine. Immediately after a successful registration it retains
the exact parent/child IDs and fingerprints, retailer, source/manifest
fingerprints, expiry and workflow identity, without plan rows or secrets. A
timeout or transport failure during parent approval is classified as
`CONTROL_PARENT_APPROVAL_OUTCOME_UNKNOWN` at stage
`CONTROL_PARENT_APPROVAL`, preserving the registered identity for exact
readback or separately authorized recovery. No guard, registration RPC,
approval, executor, workflow or database contract is weakened or duplicated.

The regression reproduces the `Query read timeout` boundary and proves that
the diagnostic contains recovery identity but no offer rows or unallowlisted
result fields. The focused shared-engine suite passes 39/39. `npm run
verify:quick` passes with 580 tests (577 passed, 3 skipped, 0 failed). `npm run
verify:full` passes with all full-gate suites, baseline migration validation,
TypeScript and the Next.js production build green. The post-change `npm run
verify:project` remains the final documentation structure check.

The current 10 Reps plan is not mutated by this correction; its older artifact
predates the new evidence field. The subsequent separately authorized readback
is recorded below. Any recovery, supersede or resume decision remains a distinct
production-write authorization boundary.

## Authorized production control readback

The owner authorized an exact read-only production control-state capture for
10 Reps (`14`) and Whey Okay (`3`). It completed at
`2026-09-29T12:54:55.079Z` in a `REPEATABLE READ READ ONLY` transaction with
`default_transaction_read_only=on`, bounded timeouts and an explicit rollback.
Mutation attempts were zero. The ignored local artifact SHA-256 is
`adbd833ac4ae69809aa3fe6f352841928ec84cba0dd7a368be97d301d1b86b5e`.

The exact global counters used by the Whey Okay legacy read RPC were:

| Counter | Value |
| --- | ---: |
| unconsumed, unexpired import approvals | 0 |
| unconsumed, unexpired offer approvals | 0 |
| active parents | 1 |
| active children | 19 |
| started apply runs | 0 |
| matching active sessions | 0 |

The sole active parent is 10 Reps plan
`a3072837-9f0b-4b0e-af15-2584a19980d7`, fingerprint
`8a8ee37ef253a48fc82fc9c66c2288b095a4f89208b26d9ed5a2f76ca21092fe`.
It was created by the failed run `36400487268` from source fingerprint
`e603f1b64cf49c1d941c73a80ac15c4c34719cd9035591bed67fa8b658c680c2`.
The parent is `APPROVED` with an approval that expired at
`2026-09-28T09:43:54.946Z`. Of its 19 children, batch 0 is `APPROVED` and the
remaining 18 are `PLANNED`. Batch 0 has one unconsumed, unclosed approval that
expired at `2026-09-28T09:14:10.155Z`. There are no apply runs for the parent,
no consumed approvals and no recorded business or price-history writes.

This resolves both diagnoses. The 10 Reps block is an interrupted sequential
control lifecycle before execution. Whey Okay has no retailer-scoped active
plan; it is blocked because `read_retailer_offer_sync_approved_state(3)` treats
the unrelated global active-parent count as a retailer-local stop condition.

The existing `close_expired_retailer_offer_sync_approval` contract is not used.
It expires only the linked approved child and parent. On this exact state it
would leave 18 child plans in `PLANNED`, producing a partially closed control
tree. A one-off cleanup migration is also rejected by the stabilization rules.
The next implementation candidate must therefore be one retailer-neutral,
fixture-proven recovery contract that atomically closes an entirely unexecuted
expired sequential tree, requires zero apply runs/row approvals/recovery state,
preserves history, checks business counts and has an exact rollback/readback
contract. Any production invocation remains a separate owner-write decision.

## Shared recovery contract implementation

The candidate is implemented locally as forward migration
`20260929133000_extend_expired_sequential_plan_close.sql`, SHA-256
`b0a4cac2d9c30989f00570bf1c63036daf190fffbcc7b08b17c616761bc6a380`.
It does not add another RPC, role, approver or executor. It replaces only the
existing internal implementation behind
`close_expired_retailer_offer_sync_approval(jsonb)` and retains the existing
production approver boundary.

The extended contract:

- takes the global and retailer advisory locks used by the shared refresh path;
- locks the exact parent, every child and the linked batch approval;
- requires one `APPROVED` child and every sibling to be untouched `PLANNED`;
- requires the parent manifest and all immutable child/parent fingerprints to
  agree;
- rejects any extra batch approval, row approval, apply run or recovery state;
- accepts the intended sequential window where the parent expiry is later than
  the child expiry, while requiring both to be expired;
- closes the approval and expires the parent plus every child in one
  transaction;
- verifies affected-row counts and unchanged business counts;
- preserves history and provides deterministic no-write replay.

The existing disposable production-shaped PostgreSQL suite now seeds the exact
19-child topology. It proves 19/19 children become `EXPIRED`, reports 21 control
writes (approval + parent + 19 children), rejects an unexpected second approved
child and child-manifest drift, preserves zero business/price-history writes and
rolls back atomically.
The production integration suite passes 4/4 and the selector suite passes
56/56.

The migration is explicitly SHA-bound in the shared environment policy and
excluded from ordinary STAGING and PRODUCTION selection. It cannot be deployed
by the normal migration command and has not been applied anywhere. Deployment,
exact invocation and post-write readback remain a separate owner-authorized
operation.
