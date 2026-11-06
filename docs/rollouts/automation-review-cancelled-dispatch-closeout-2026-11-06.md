# Automation Review Queue cancelled-dispatch closeout

**Status:** CODE COMPLETE — awaiting merge and a separate exact production closeout authorization<br>
**Date:** 6 November 2026<br>
**Scope:** shared control-plane closeout only; no retailer execution or business-data write

## Current evidence

- PR #495 is on `main` at `8d03526d930f8e2ab3254fd58cc35744253ec85e` and preserves pending shared production-write runs in one serialized GitHub queue.
- The owner authorized exactly nine 10 Reps `UPDATE_STOCK` execution requests for review IDs `3745`–`3753`.
- Run `42230810233` failed before any business write with `SOURCE_UNAVAILABLE`; its request is terminal `FAILED` with `database_writes = 0`.
- Run `42230815776`, bound to request `00272c7c-4ec5-4a6f-8bc3-52ee9291ebb0` and review `3746`, was cancelled while the shared worker was still in its pre-execution source/revalidation step. Its durable request remains `DISPATCHED` at `WORKFLOW_DISPATCH_CLAIMED`, with `database_writes = 0` and no `EXECUTING` event.
- The other seven exact runs were cancelled before execution. No automatic retry was performed.
- Fresh production readback after cancellation found all nine offers equal to their approved before-state, zero proposed stock transitions, zero price-history rows from the attempted scope, and no price, stock, mapping or catalogue change.
- The ordinary shared retailer run `42198473108` fetched and validated the 10 Reps source successfully in both its preflight and idempotency steps between 09:54 and 10:08 UTC. The later `SOURCE_UNAVAILABLE` result is therefore a bounded transient source failure, not evidence of a missing 10 Reps secret or permanent disconnection.

## Bounded implementation

The existing `.github/workflows/automation-review-queue-worker.yml` gains one mutually exclusive manual control input. It invokes a retailer-neutral verifier in the same workflow, environment and global production-write concurrency group.

Before the existing checkpoint RPC may close a request, the verifier requires all of the following:

- exact `DISPATCHED` request at `WORKFLOW_DISPATCH_CLAIMED`;
- exactly the immutable `REQUEST_CREATED` and `WORKFLOW_DISPATCH_CLAIMED` events, with no `EXECUTING` event;
- the request's exact GitHub run is completed and cancelled, is the shared queue-worker workflow on `main`, and matches the bound commit;
- the shared execution step is itself cancelled after its tests and read-only owner audit passed;
- request and approved review fingerprints and scope still match;
- zero recorded database writes, execution deltas, results or later checkpoints;
- zero run-bound parent plans, child plans, apply runs, batch approvals and approved import plans;
- zero price-history rows after the claim;
- the exact offer and mapping still match the immutable review before-state;
- a fresh post-checkpoint read proves the offer and mapping hashes are unchanged and the review remains `APPROVED`.

Only then may the existing service-role checkpoint RPC transition the technical request from `DISPATCHED` to `FAILED` with `WORKFLOW_CANCELLED_BEFORE_EXECUTION`. This releases the active-request lock without consuming, changing or executing the owner-approved review. It performs one control-ledger transition and zero business writes.

## Architecture boundary

- same Review Queue workflow: YES
- same execution-request ledger and checkpoint RPC: YES
- new worker, queue, scheduler, migration or retailer-specific branch: NO
- retry, source refresh, offer execution or Review Queue publication: NO
- direct database business write: NO
- cron change: NO

## Local verification

- Project Guardian: PASS
- focused `admin-auth.test.js`: 63/63 PASS
- cancelled-dispatch regression: PASS
- Gladiator shared-publisher hash and no-auto-approval contract: PASS with the reviewed new workflow hash
- Quality Gate Quick: PASS
- Quality Gate Full, including production build: PASS
- production writes during implementation and verification: 0
- workflow dispatches during implementation and verification: 0

## Next authorized step

After merge and green final-main checks, obtain a separate exact owner authorization before dispatching the closeout input for request `00272c7c-4ec5-4a6f-8bc3-52ee9291ebb0`. The closeout must stop if any verified fact has changed. It does not authorize retrying review `3746` or any of reviews `3745`–`3753`.
