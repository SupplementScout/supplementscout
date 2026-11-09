# Owner withdrawal: terminal control preflight — 9 November 2026

Production remains BLOCKED pending a new owner authorization. This task changes review code only: no merge, migration, recovery, retailer dispatch, cache purge or schedule restart. Main at audit: `e56a5b0feeec022d5c22f567d1cc6207415c7f69`; PR510/511 merged; deployment READY. Fit House and Six Pack remain PAUSED.

## Fresh production evidence

Captured 11:04:08–11:18:55 UTC against `PRODUCTION / aftboxmrdgyhizicfsfu / supplementscout-production:aftboxmrdgyhizicfsfu`. Verified TLS, session/current user postgres, REPEATABLE READ READ ONLY; ledger261 and canonical CURRENT fingerprint `755319fa4f9636e50cf8606e7a0b143945aa8bdd92c2183681e5285aecb4660a`. All affected row hashes still match the original withdrawal fixture. The failed selected-migration attempt committed neither schema nor data nor ledger; its authorization is consumed.

Audit includes 68 reviews, 34 requests, 87 execution events, 297 review events, 8 offers and their 163 price-history rows; 9 candidate parents, 66 children, 66 apply runs and 66 consumed batch approvals. The bounded reads also checked atomic/mixed/fixture/recovery approvals and recovery audits: no open matching authority. No active requests, parents, queued Fit review, pending affected approval or write lock. Full raw captures and four job logs are retained locally under `tmp/withdrawal-failed-terminal-audit-20261109` in the rollout worktree; their SHA256 provenance is in the regression fixture.

## All nine classifications

Every row is **A — TERMINAL_ZERO_WRITE_CONFIRMED**. Retailer9, operation UPDATE_STOCK, status FAILED, checkpoint EXECUTION_FAILED, explicit database_writes0. Executed/failed/remaining IDs, actual/expected deltas, price_history_delta, baseline/postflight hashes and idempotency are NULL: these are absent postflight evidence, not a successful postflight and not alone proof of zero writes. Full timestamps, fingerprints, run URLs/commits and all 27 events are preserved in [the minimal read-only regression fixture](../../supabase/test/fixtures/owner-withdrawal-terminal-failures-2026-11-09.json).

| Request | Review | Offer | Product / variant | Run | First failure |
|---|---:|---:|---|---|---|
| `5ef026c5-15d1-4b0e-ba39-51a1acb54242` | 1121 | 1982 | 771 / 1975 | [37465148363](https://github.com/SupplementScout/supplementscout/actions/runs/37465148363) | Cannot read properties of undefined (reading 'in_stock') |
| `2844ab11-80ff-4a33-8ea9-1d195fe2bfb9` | 1121 | 1982 | 771 / 1975 | [37472523256](https://github.com/SupplementScout/supplementscout/actions/runs/37472523256) | VALIDATOR_REJECTED |
| `5985d7bd-5e66-43e7-998d-272e5a00f55c` | 1102 | 951 | 403 / 956 | [37840734373](https://github.com/SupplementScout/supplementscout/actions/runs/37840734373) | VALIDATOR_REJECTED |
| `9dc3e2a1-7978-48f6-ac00-e847d0935d46` | 1103 | 953 | 771 / 947 | [37840734373](https://github.com/SupplementScout/supplementscout/actions/runs/37840734373) | VALIDATOR_REJECTED |
| `6c2805cf-6da8-47b6-acfe-3ca97eedef68` | 1105 | 963 | 777 / 969 | [37840734373](https://github.com/SupplementScout/supplementscout/actions/runs/37840734373) | VALIDATOR_REJECTED |
| `85cc0704-d177-4670-a54e-aabc77732da6` | 1106 | 972 | 774 / 958 | [37840734373](https://github.com/SupplementScout/supplementscout/actions/runs/37840734373) | VALIDATOR_REJECTED |
| `421a14bc-b7e9-4ab1-a0a2-2dce372e9065` | 1112 | 954 | 770 / 942 | [37840734373](https://github.com/SupplementScout/supplementscout/actions/runs/37840734373) | VALIDATOR_REJECTED |
| `333f35ba-9dc2-41bb-9c07-9c2a20faf31b` | 1116 | 735 | 716 / 3120 | [37865904014](https://github.com/SupplementScout/supplementscout/actions/runs/37865904014) | STABLE_OOS_BASELINE_EXCEEDED |
| `2331aa1c-e46e-43c9-ac39-d6b798492f8d` | 1119 | 1904 | 995 / 1950 | [37865904014](https://github.com/SupplementScout/supplementscout/actions/runs/37865904014) | STABLE_OOS_BASELINE_EXCEEDED |

Each immutable event chain is exactly REQUEST_CREATED (NULL→QUEUED), WORKFLOW_DISPATCH_CLAIMED (QUEUED→DISPATCHED), EXECUTION_FAILED (DISPATCHED→FAILED), with matching run/commit/error and zero counters; final event timestamp equals completed_at. There is no EXECUTING / REVALIDATION_PASSED checkpoint or later event for any of these requests.

The actual worker at all four run SHAs awaits read-only validation and REVALIDATION_PASSED before registration/approval/execution, then pessimistically assigns the positive nonempty scope to databaseWrites before entering the writer. Retained job logs independently report zero for each of the nine. No request-specific control plan/apply run crossed that boundary. No history row occurs in the relevant failed-request interval. Therefore missing postflight here is expected: the business phase was never reached.

Worker SHAs: `02fce80bb4ac7e5d97203d033f7fbcc16e33356a`, `24b70e7cdde84ab83248f94243b0b13893b52ced`, `5d3f631f26c5e811017ba13d9b2205a98b1bcd56`, `8235527547e24d5785872c0daa0baa65469151c7`. See `scripts/automation-review-shared-retailer-worker.js` at each commit, especially validate → awaited checkpoint → pessimistic counter → register/approveAndExecute.

Seven linked reviews are EXPIRED with no execution_id; 1121 is EXECUTED by separate later request `976f67b4-c06c-4f73-a3c6-48ca63f45dfd`, run37492690030, verified via existing postflight recovery run37503672017. That successor has 20 writes, stock1/freshness20, postflight `ad8b4fcba6020f89639f432801b1e1a3b879a3bae6ce45fddc20fe7b7def1954`, idempotency PASS and checkpoint VERIFIED_POSTFLIGHT_RECOVERY. These are not writes by either prior FAILED request.

Run37865904014 reports 60 writes for three other requests, whose three parents completed before the last two failures were dispatched. Attribution to the nine would be incorrect. All nine candidate parents are COMPLETED; all 66 matching batch approvals consumed. The full history contains no other currently FAILED request on these eight offers. There is no unresolved write outcome or unfinished execution among the nine. No recovery is needed or performed.

Current offer readback (not changes made in this task):

| Offer | Price GBP | In stock | Freshness UTC | History rows |
|---:|---:|---|---|---:|
| 735 | 14.99 | false | 2026-09-14T08:07:22.553+00:00 | 17 |
| 951 | 29.99 | true | 2026-09-14T08:07:22.553+00:00 | 17 |
| 953 | 15.99 | true | 2026-09-14T08:07:22.553+00:00 | 17 |
| 954 | 21.99 | true | 2026-09-14T08:07:22.553+00:00 | 17 |
| 963 | 19.99 | true | 2026-09-14T08:07:22.553+00:00 | 17 |
| 972 | 34.99 | true | 2026-09-14T08:07:22.553+00:00 | 17 |
| 1904 | 54.99 | true | 2026-09-14T08:07:22.553+00:00 | 18 |
| 1982 | 15.99 | false | 2026-11-04T09:53:43.038+00:00 | 43 |

## One correction, one control contract

The old ad-hoc preflight ignored all FAILED statuses, while the actual SQL treated every FAILED as pending. Both were too broad in opposite directions. The replacement admits only the fully bound pre-write failure contract above. A zero or NULL counter without the complete immutable event chain never suffices.

The sealed SQL contains one marked read-only SELECT. Existing `verify-selected-migrations.js --mode=preflight` and `apply-selected-migrations.js` call the same extractor/validator; the migration repeats that exact query inside activation under the existing global execution lock. No permanent function/table, executor, queue or recovery path is added. The optional preflight metadata is included in the pending confirmation hash. Default verifier behavior remains postflight.

Active/unknown/NULL statuses, possible writes, deltas, missing/mismatched events/run/fingerprints/operation, open Review Queue and missing later verified postflight all block. Raw FAILED with write evidence still blocks even if some postflight fields claim success: the existing recovery contract must have already completed its canonical EXECUTED transition. The genuine earlier recovered request in the production fixture remains valid. This change neither performs nor invents recovery.

The worker selects QUEUED only; checkpoint transition SQL does not allow FAILED→DISPATCHED/EXECUTING. No request/review status is changed. Existing approvals, schema guards, owner-only lifecycle and approved-import/executor checks remain intact. Integration proves a live stale target approval blocks activation and an already approved RPC cannot update/reactivate withdrawn products. RA-001 and shared executor are unchanged.

## Versioned pending replacement and exact binding

Applied migrations are immutable. The original merged-but-rolled-back file `20261109100000_add_owner_catalogue_withdrawal_lifecycle.sql` remains byte-for-byte unchanged; canonical LF SHA256 `a9cb6d18c60dda40dbc10322e23971f929e929a4344761e8f97328677b04e29b`. It becomes an explicit production exclusion, still sealed; it must never be selected alongside its replacement. Staging excludes both withdrawal files. No historical applied migration or applied-exclusion set changes.

- Sole PRODUCTION pending: `20261109120000_add_owner_withdrawal_terminal_preflight.sql`.
- New SQL SHA256: `70957859d879e822db0627c671d5a9bd8e0f77f5c0da58fddce7a011e678fe9e`.
- Pending metadata: `preflight_required: true`.
- New confirmation: `79c7b8609789562c` (old confirmation is invalid).
- CURRENT remains261 / `755319fa4f9636e50cf8606e7a0b143945aa8bdd92c2183681e5285aecb4660a`.
- Only after a new authorized commit: ledger262 / `209719c865f07c9e77006d01f7ae526aa47461b9a0bd5154071b4f29052c8333`.

The new post-ledger fingerprint deliberately differs from the old e19d8c… forecast because the ledger migration identity changed. Do not silently reuse the previous SQL, selection seal or confirmation.

## Preserved business scope and tests

Exactly canonical951/999 OWNER_EXCLUDED and1114 OWNER_DEFERRED; four variants deactivated. Physical mappings/offers retained: Six504 active+2 historical of506, Fit284+2 of286. Four mappings, four offers and five history rows retained unchanged, including price/stock/shipping/URLs/freshness. Fit producer approved scope284 and the same five sealed SQL-definition substitutions remain those reviewed in #510. Other retailers, classifier/executor and source parser are unchanged.

- Focused selector/applicator/fingerprint suite: 95 PASS, 0 FAIL, 0 SKIP.
- Native isolated PostgreSQL17.11 on 127.0.0.1:55479: 46 PASS, 0 FAIL, 0 SKIP (50.65s). The suite reproduces the old BLOCK and rollback with all nine actual fixtures, then proves preflight/migration agreement for 22 invalid evidence/status cases and the verified after-write canonical recovery. It tests live/stale approvals, owner-only reactivation guards, atomic ledger261→262, preservation/idempotency/rollback and public consumers. No remote credential enters the test process.
- Quick: 480 PASS, 0 FAIL, 0 SKIP; full: 3692 PASS, 0 FAIL, 3 pre-existing skipped historical 10 Reps artifact fixtures (not counted as passes). TypeScript, ESLint and production build PASS. Project Guardian before/after checkpoint edit PASS. Test inventory unchanged: 356 files (295 safe, 57 integration, 4 artifact-bound); no new or omitted test file.
- Actual production control preflight via the existing verifier: PASS, blockers[], ledger261/CURRENT, database_writes0. This verifies the control predicate, not a production activation/postflight. Expected-state/function seals were independently read in the fresh audit.
- PR checks and the complete 57-file isolated PostgreSQL quality-gate integration will be linked in the final PR validation receipt; production readiness remains subject to those results and separate authorization.

## Required separate deployment authorization

Authorize the exact final PR head and standard merge, then exactly one selected-migration attempt on the above target/file/SHA/confirmation. Recheck main, deployed SHA, CURRENT261, paused Fit/Six and no conflicting writer/plan. Run the new read-only preflight first; any new blocker stops the write. No retailer source capture/apply or replay is included.

The one SQL transaction would install the original three-column lifecycle/constraints/triggers, withdraw only the above three products and four variants, update the Fit producer scope284 and the same five SQL definitions, and insert exactly one schema_migrations row. It does not write commercial fields, history, approvals or request/control statuses. A failure before COMMIT rolls back everything; do not repeat automatically.

After commit, retain the canonical exact readback/closeout receipt; obtain authorization for the existing receipt-based technical repository closeout of pending/CURRENT261→262. Also separately authorize the existing project-scoped Data/CDN cache purge and public readback. These later steps are required for public withdrawal verification, and are not executed in this task. Do not run the old migration, alter/close the nine requests, reactivate products, restart schedules or declare RESTORED.
