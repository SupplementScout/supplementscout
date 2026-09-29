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
predates the new evidence field. Exact live control-state readback and any
supersede/resume decision remain a separate authorization boundary. Whey Okay
also remains blocked pending exact readback; no global count was reinterpreted
or ignored.
