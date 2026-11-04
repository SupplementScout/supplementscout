# Automation Review Queue HARD_PRICE_ANOMALY contract fix — 2026-11-04

## Status and authority

- Repository starting point: `d62c9e7223f4c869e936b9d41eff05b65fc4062c`.
- Source audit: PR `#476` and `docs/rollouts/automation-review-queue-end-to-end-audit-2026-11-04.md`.
- Repository-side fix: implemented on `fix/automation-review-hard-price-contract`.
- Production migration: **NOT APPLIED**. A separate owner decision is required.
- Database writes: `0`; Review Queue rows changed: `0`; executions triggered: `0`.
- Failed run `41836635201` and its historical 85-row reconciliation were not replayed.
- SEO-20 remains the sole SEO task `IN_PROGRESS`; broad P1 category cleanup remains closed.

## Confirmed root cause

The eBay reconciliation producer intentionally emitted `HARD_PRICE_ANOMALY`, and the protected eBay worker already enforced additional validation for that reason. The JavaScript publisher, the deployed SQL publication function and the eBay execution-adapter reason allowlist independently omitted the same reason. The repository contracts therefore disagreed and production run `41836635201` failed its Review Queue publication step with `Unknown reason code in row 2`.

The producer was not normalized to `PRICE_CHANGE`. Preserving `HARD_PRICE_ANOMALY` keeps the stricter worker safety path active.

## Canonical and application contracts

- `config/automation-review-reason-codes.json` is the canonical machine-readable Review Queue reason registry. It preserves the audited current set and adds only `HARD_PRICE_ANOMALY`.
- `scripts/lib/automation-review-publisher.js` now validates its registry shape and consumes that canonical list instead of maintaining an independent reason allowlist.
- `config/automation-review-execution-adapters.json` adds `HARD_PRICE_ANOMALY` only to eBay's existing `UPDATE_PRICE` reason scope. The supported operations remain exactly `VERIFY_NO_CHANGE`, `UPDATE_PRICE` and `UPDATE_STOCK`.
- `app/lib/automationReviewAdapters.ts` resolves reasons against the selected operation's allowlist. `UPDATE_STOCK`, `UPDATE_PRICE_AND_STOCK`, identity and rebind paths remain closed to `HARD_PRICE_ANOMALY`.
- `scripts/lib/automation-review-adapter-registry.js` validates the operation/reason partition and requires every adapter reason to exist in the canonical registry.
- `scripts/automation-review-ebay-worker.js` was not weakened or changed. Its exact operation, fingerprints, identity, reviewed before/proposed state, hard-price threshold, source-price and protected price-history checks remain authoritative.

## Forward migration and recovery

- Forward migration: `supabase/migrations/20261104120000_allow_automation_review_hard_price_anomaly.sql`.
- SHA-256: `26a7aa2155bebc49313e8827fe0377b4676af455b7aa964c293db0f30d5fce6d`.
- Function replaced: `public.publish_automation_review_queue_changes(jsonb)`.
- Exact semantic delta: add `HARD_PRICE_ANOMALY` to the function's existing Review Queue reason-code validation list.
- Tables modified by migration execution: none.
- Expected catalogue rows modified: `0`.
- Expected Review Queue rows modified during migration: `0`; replacing the function does not invoke it.
- Security is unchanged: `SECURITY DEFINER`, empty `search_path`, service-role runtime assertion, owner `postgres`, revoke from `public`, `anon`, `authenticated` and `service_role`, then grant execute only to `service_role`.
- Idempotency, baseline, duplicate-active-row and catalogue-write detection logic is byte-equivalent except for the added reason literal.
- The migration is registered, by exact hash, as pending in both STAGING and PRODUCTION. It was not selected or applied.
- Rollback: `supabase/rollbacks/20261104120000_allow_automation_review_hard_price_anomaly_rollback.sql` restores the prior function body and the same owner/grant posture. It does not mutate tables.

Repository merge does not automatically apply Supabase migrations: normal pull-request workflows run validation only, no Vercel repository configuration invokes a migration command, and database changes require the explicit guarded migration selector/apply tooling. The migration file can therefore merge while production remains unchanged.

## Regression evidence

Tests prove:

- the existing producer emits `HARD_PRICE_ANOMALY` for a hard-price `UPDATE_PRICE` review;
- the canonical registry contains the reason and the publisher accepts it while unknown reasons remain rejected;
- the new SQL contract matches the canonical reason set exactly, accepts the hard-price reason and omits unknown reasons;
- the historical migration remains at its sealed SHA-256 and the forward/rollback function bodies differ only by the new reason literal;
- the eBay adapter accepts the reason only for `UPDATE_PRICE`; ordinary `PRICE_CHANGE` and `UPDATE_STOCK` remain supported; combined and identity/rebind operations remain unsupported;
- worker validation still requires exact operation, identity, before/proposed states, hard-price threshold and the protected price-history create path;
- Review Queue publication remains control-plane-only with zero catalogue writes and unchanged idempotency safeguards;
- a credential-free fixture shaped like the failed publication row crosses producer normalization, publisher validation, adapter resolution and worker contract validation without a write.

Current local evidence:

- focused Review Queue/eBay/migration suite: `238/238 PASS` (`176/176` contract/reconciliation tests plus `62/62` migration-selector tests);
- TypeScript typecheck: `PASS`;
- ESLint: `PASS`;
- standalone production build: `PASS` with the repository-documented local-only Supabase placeholders and no production credentials;
- `npm run verify:quick`: `PASS`;
- `npm run verify:full`: `PASS` (`QUALITY GATE FULL: PASS`);
- `git diff --check`: `PASS`;
- Project Guardian after pending-migration registration: `PASS` (`SEO-20` unchanged).

No new test file was added, removed or renamed, so the quality-gate manifest did not require resealing.

## Delivery record

- Feature branch: `fix/automation-review-hard-price-contract`.
- Feature PR: `#477`.
- Implementation commit: `06feb39628ea19e790844d1930d303f70b7b900a`.
- Final feature head: recorded in PR metadata and the final delivery report because this document is part of that head.
- Merge SHA: pending successful CI and squash merge.
- Tree equivalence: pending post-merge verification.
- Feature CI: pending GitHub execution; all required local gates above are green.
- Production migration applied: **NO**.

## Required later production verification — not authorized here

1. Obtain an explicit owner decision for the exact migration filename and SHA-256 above.
2. Apply only that approved migration through the guarded production migration path.
3. Verify the installed function definition, owner, `SECURITY DEFINER`, empty `search_path`, revokes and service-role grant.
4. Wait for or separately authorize a fresh eBay source capture; do not replay the historical 85-row artifact.
5. Confirm fresh Review Queue publication succeeds and can publish `HARD_PRICE_ANOMALY`.
6. Confirm normal refresh/supersede/resolve lifecycle behavior and zero catalogue writes from publication.
7. Confirm eBay `DECIDE` state is based on fresh evidence before resuming owner review work.

## Stop point

Repository implementation, tests and migration preparation only. Stop before production or staging migration execution, SQL, Review Queue publication, old-batch replay, review mutation, owner decision, execution request, workflow dispatch, eBay retry, freshness recovery or catalogue write.
