# 6 Pack reviewed owner approval

This runbook covers only 6 Pack offer changes isolated by the existing `MASS_OOS` guard. It does not weaken the scheduled refresh or authorize any other guard.

## Release model

1. Commit and push the implementation after all local gates pass (code commit A).
2. Run a fresh ordinary dry-run from commit A. It must be `PASS_WITH_REVIEW`, with only `MASS_OOS` review rows and no blocked rows.
3. Download the report and build a draft under `tmp/`:

   `node scripts/six-pack-reviewed-batch-builder.js --report=tmp/six-pack-offer-refresh/production-preflight-report.json --manifest=config/retailers/six-pack-approved-offer-manifest.json --implementation-commit-sha=<code-commit-A> --output=tmp/six-pack-offer-refresh/reviewed-batch-draft.json`

4. Review every identity and before/after value. The capture expires within 24 hours. Copy the approved draft, without modification, to `config/retailers/six-pack-reviewed-batches/<reviewed_batch_fingerprint>.json` and commit only that file (manifest commit B).
5. A reviewer with `maintain` or `admin` permission manually dispatches `operation=apply-reviewed` at exact `origin/main`, with the fingerprint and exact confirmation below. No static secret is an approval proof.

The batch fingerprint canonically binds every batch field, including capture/expiry evidence and status, independent of JSON key order. The separate source semantic fingerprint excludes capture time and binds source identities, URLs, prices and stock. The batch stores `implementation_commit_sha` for commit A and never stores the unknown future runtime SHA. At runtime, HEAD must equal `origin/main`, A must be its ancestor, exactly one commit must exist in A..HEAD, and its only changed file must be the exact fingerprint-named batch manifest. Any later commit requires a regenerated batch. This avoids a self-referential commit hash while proving that execution code did not change.

## workflow_dispatch contract

- `operation`: `apply-reviewed`
- `reviewed_batch_fingerprint`: exact lowercase 64-character batch fingerprint
- `owner_confirmation`: `APPLY_REVIEWED:<reviewed_batch_fingerprint>`
- ref: `main`

Both jobs reuse the existing `production-readonly` environment and its existing credential bindings. The environment name is historical and no longer precisely describes the guarded apply paths; renaming and separating it is a later housekeeping task, not a rollout prerequisite. `apply-reviewed` remains a separate manual-only job. It checks the actor permission and immutable commit context before source capture, and the executor repeats the same fail-closed actor and commit check before database connections are opened. No environment audit token, new secret, required reviewer, or new environment is required.

## GO conditions

GO requires manual dispatch on main; exact HEAD/origin/main; exactly one manifest-only commit after the implementation commit; maintain/admin actor; exact confirmation; unexpired capture; approved-manifest hash; exact offer, product, variant, mapping, external identity, URL, operation, before state, after state and semantic source fingerprint; only `MASS_OOS`; all other source, identity, hard-price, stale-state and fingerprint guards passing; exact per-row RPC execution; and a passing read-only DB postflight.

Any mismatch is BLOCK before approval RPC. An interruption leaves already completed rows atomic and writes a checkpoint with executed, remaining and blocked IDs. A rerun needs a new capture; changed current state makes the old batch fail before writes.

DB postflight is authoritative for apply success. If it passes and the bounded live-source idempotency check later times out, the terminal result is `APPLY_SUCCEEDED_POSTFLIGHT_PASSED_IDEMPOTENCY_DEFERRED`. Perform a new read-only idempotency check; never reapply the batch.

## Expected current 14-row effect

After a new capture proves the reviewed values are still identical: 14 executed offer plans, 13 new `price_history` rows, 6 stock changes, no mapping changes, and no new products, variants, mappings, or offers. Offer `2006` is stock-only and must not create price history.
