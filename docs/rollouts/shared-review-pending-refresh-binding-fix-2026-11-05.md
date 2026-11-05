# Shared Review Queue PENDING refresh execution-binding fix — 2026-11-05

## Decision

**PASS for repository implementation; HARD STOP before production migration.**

The shared Review Queue can now build and publish one internally consistent
fresh execution binding when a still-`PENDING` row has the same stable semantic
problem fingerprint. The implementation deliberately keeps semantic identity
stable and preserves matching `APPROVED` rows without modification. Production
still has the preceding RPC definition, so no eBay publication is safe until a
separate owner authorization applies the migration below and a completely new
eBay capture/reconciliation passes.

## Authority and first gate

- Starting authoritative `main`:
  `ffffe5807fc01fa9577ef5ca5250cb8e197e10cb`.
- Work used clean branch `fix/shared-review-pending-refresh-binding` in an
  isolated worktree; unrelated owner work in the primary worktree was untouched.
- PR `#481` was already merged. Its Project Guardian, full Quality Gate,
  GitGuardian and Vercel checks passed and unresolved review threads were zero.
  Final-main Project Guardian run `41988401846` and Quality Gate run
  `41988401841` also passed.
- No newer shared Review Queue refresh correction existed at the starting SHA.
- `npm run verify:project` passed before implementation. `SEO-20` remains the
  sole SEO task `IN PROGRESS`; the broad P1 category cleanup remains closed.

## Root cause and design

The failure has two layers. First, `buildManifestRows` selected an old active
Review Queue `before_state` ahead of the current database state and protected
plan `expected_state`. That produced `true -> true` for fresh combined changes
whose exact database/plan transition was `false -> true`.

Changing that precedence alone was insufficient. A matching
`retailer_id + offer_id + source_row_fingerprint` is intentionally a
same-problem `REFRESH`, but the old JavaScript/SQL refresh contract updated only
evidence, timestamps and plan metadata. It could therefore pair a new plan
fingerprint with old before/proposed states in the persisted row.

The smallest safe shared model is:

1. Stable problem identity remains exactly retailer, offer and semantic source
   fingerprint; volatile database state, timestamps and plan fingerprints do
   not enter `source_row_fingerprint`.
2. For executable `COMMERCIAL_CHANGE`, reconciliation requires the exact
   current database state to equal the protected plan `expected_state` across
   canonical identity, mapping, price, shipping, total, stock and URLs. It then
   verifies the fresh source state equals the protected proposed state. Any
   mismatch fails closed before publication.
3. A matching `PENDING` row may atomically replace its complete verified
   execution binding. A matching `APPROVED` row remains frozen and receives no
   refresh operation.
4. Non-commercial identity/source review rows keep the existing safe evidence
   refresh behavior and do not acquire an executable binding.

No eBay-, product- or offer-specific runtime branch was added. The active
fingerprint uniqueness contract and index remain unchanged.

## Field classification

| Class | Fields and behavior |
|---|---|
| Immutable problem identity | `retailer_id`, `retailer_product_id`, `offer_id`, `current_product_id`, `current_variant_id`, `proposed_product_id`, `proposed_variant_id`, `review_kind`, `operation_type`, canonical `reason_codes`, `source_row_fingerprint`; every value must match the existing row for a `PENDING` refresh. |
| Refreshable execution binding | `source_price`, `source_url`, `before_state`, `proposed_state`, `impact_summary`, `artifact_fingerprint`, `plan_fingerprint`, `plan_artifact_sha256`, plus same-capture `source_evidence`, `source_captured_at`, `expires_at`, `workflow_run_url` and `artifact_url`. Commercial values are replaced together in one SQL update only after exact validation. |
| Preserved display/history | Snapshot/item/source record identifiers, retailer/title/variant display text, confidence, candidates, SKU/GTIN/weight, suggested action, decisions, status and owner-decision metadata are not rewritten by refresh. Historical bindings remain in `product_match_review_events`. |

## Implementation

- `scripts/automation-review-reconciliation-dry-run.js` now makes current DB
  state authoritative only after exact DB/protected-plan equality and verifies
  source/proposed price, shipping, total, stock and URL equality.
- `scripts/lib/automation-review-publisher.js` verifies immutable identity for
  matching `PENDING` rows and emits an exact complete commercial
  `execution_binding`. Matching `APPROVED` rows are preserved without a refresh.
- The new RPC definition accepts exact REFRESH keys only, requires an exact
  locked `PENDING` row, rejects identity drift and unknown fields, revalidates
  the fresh commercial `before_state` against live `offers` and
  `retailer_products`, validates operation deltas, and updates the binding in
  one atomic statement.
- The existing trigger remains authoritative audit storage. A refresh requires
  newer capture evidence that differs from the stored evidence, so the existing
  `EVIDENCE_REFRESHED` event records full `OLD` and `NEW` row snapshots,
  timestamp and publisher actor. No second audit table was created.
- Catalogue tables are read for baseline/binding validation only. Catalogue
  writes remain zero.

## Regression evidence

The generic production-shaped regression uses a matching semantic fingerprint,
an old `PENDING` before-stock value `true`, exact current DB/protected-plan
before-stock `false`, proposed stock `true`, operation
`UPDATE_PRICE_AND_STOCK` and reason `PRICE_AND_STOCK_CHANGE`. It proves:

- lifecycle result is `REFRESH`, not `CREATE` or a manufactured fingerprint;
- request binding contains exact fresh `false -> true` state, proposed values,
  evidence and new plan fingerprint from one plan;
- the protected eBay worker accepts the refreshed row;
- DB/plan drift, source/proposed drift and immutable identity drift fail closed;
- a matching `APPROVED` row remains unchanged;
- `UPDATE_PRICE`, `UPDATE_STOCK`, `UPDATE_PRICE_AND_STOCK` and
  `HARD_PRICE_ANOMALY` stay registered and worker-bound;
- identity/source review-only rows remain non-executable;
- legacy commercial evidence without a complete protected plan binding now
  fails closed on refresh instead of becoming accidentally executable;
- idempotency, duplicate active-fingerprint prevention, stale execution binding
  rejection and zero catalogue writes remain intact.

Focused publisher, reconciliation, worker and SQL contract suite: **73/73
PASS**. The wider owner-decision set passed **79/79**, migration selector suite
passed **62/62**, admin/capability suite passed **61/61**, `verify:quick`
passed, and `verify:full` passed all quality-gate groups plus the isolated
production build. Standalone typecheck, lint and the production build using the
quality gate's loopback-only Supabase placeholders also passed.

## Production migration decision pack

| Item | Decision evidence |
|---|---|
| Migration | `supabase/migrations/20261105100000_refresh_pending_review_execution_binding.sql` |
| SHA-256 | `015f0de7448c10fcca10174e74dfbf7ca9e3150951f49090d01cd6eee869024c` |
| Affected function | The single overload `public.publish_automation_review_queue_changes(jsonb)` only. |
| Semantic delta | A same-problem `PENDING` commercial REFRESH must carry and atomically replace one exact verified execution binding; non-commercial rows refresh evidence only; `APPROVED` refresh is rejected/preserved. |
| Table/schema/index changes | **NONE**. The active semantic-fingerprint unique index is unchanged. |
| Rows changed by migration itself | Review Queue `0`; events `0`; publications `0`; catalogue `0`. The migration replaces a function definition only. |
| Security and grants | Preserves `SECURITY DEFINER`, empty `search_path`, owner `postgres`, revokes `PUBLIC`/`anon`/`authenticated`/`service_role`, then grants execute only to `service_role`; one overload. |
| Rollback | `supabase/rollbacks/20261105100000_refresh_pending_review_execution_binding_rollback.sql`, restoring the immediately preceding hard-price-aware RPC; SHA-256 `8aa7fd9e8f0d8da9d2394adb84bf822d98692a7a4b4380a31eb2b6d1c60785f1`. |
| Test proof | Exact-key, identity, PENDING-only, live-baseline, operation-delta, audit, security, rollback-equivalence, zero-catalogue-write and selector/hash tests pass. |
| Risk | A producer with stale/incomplete state now fails closed instead of refreshing; after migration, only verified current bindings can replace a pending binding. |
| Benefit | Prevents a new plan fingerprint from being persisted beside old execution states while preserving stable semantic problem identity and frozen owner-approved evidence. |

The production selector is bound to the already-applied 259-row production
ledger fingerprint
`d21a4044df80270db476bd264a9a4da19e90fe15310b2b918487ce4c480978af`
and selects this migration as the only pending production migration. Staging
still correctly selects both unapplied Review Queue contract migrations. A
live read-only production selector run independently confirmed project
`aftboxmrdgyhizicfsfu`, user `postgres`, `transaction_read_only=on`, the exact
259-row fingerprint, no remote/local drift, this one pending filename/hash and
`database_writes=0`.

## Side-effect and stop record

- Production migration applied: **NO**.
- Production database writes during implementation: **0**.
- Review Queue writes: **0**.
- Owner decisions or execution requests: **0**.
- Worker executions: **0**.
- eBay publication: **NO**.
- Rejected source/reconciliation evidence and fingerprints reused: **NO**.
- `SEO-20` changed: **NO**; it remains the sole SEO task `IN PROGRESS`.
- Exact stop: after repository merge and evidence readback, before any
  production migration, Review Queue publication, owner decision, execution
  request or eBay worker call.
