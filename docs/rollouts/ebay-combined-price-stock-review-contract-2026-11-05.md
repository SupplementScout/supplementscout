# eBay atomic combined price-and-stock Review Queue contract — 2026-11-05

## Authorization and boundary

This change starts from authoritative `origin/main`
`576a2c7bc6611b96b2090964413cade85019089d`. PR `#479` was merged with Project
Guardian and Quality Gate passing, and
`docs/rollouts/ebay-fresh-review-publication-preflight-2026-11-04.md` records the
source audit. SEO-20 remains the sole SEO task `IN PROGRESS`; the closed broad P1
category cleanup was not reopened.

The authorized scope is repository code, focused tests and this evidence record.
It does not authorize a Review Queue publication, owner decision, execution
request, worker dispatch, catalogue write, migration or freshness recovery. The
old fresh-preflight run `41905828377`, artifact `13359999389` and reconciliation
run `41906705337` are evidence context only and were not reused for apply.

## Root cause

The source producer and shared publisher already represented an out-of-stock to
in-stock transition plus a price change truthfully as one
`UPDATE_PRICE_AND_STOCK` / `PRICE_AND_STOCK_CHANGE` review. The retailer-12
adapter omitted that operation, the capability matrix consequently kept it
unsupported, and the eBay worker's operation allowlist and operation-specific
result checks did not cover the combined case. Reconciliation also retained the
exact proposed final state only for hard-price rows, rather than for every
commercial review row.

The source fact was not split. A split would introduce an intermediate state,
two decisions and drift between price and stock. The existing protected plan
already carries the one final commercial state, so one atomic reviewed operation
is the safer and smaller extension.

## Watchdog first-gate classification

Read-only inspection of watchdog run `41934834556` confirmed
`FAILED_SYSTEM`, 13 retailers checked, five failed, database writes `0`, with
the workflow contract suite `49/49 PASS`.

| Retailer | Classification | Contract impact |
|---|---|---|
| Simply Supplements (`7`) | monitored backlog growth after a successful ordinary run | Existing stale/review-scope debt; unrelated |
| Fit House (`9`) | unresolved latest ordinary profile attempt plus backlog growth | Existing backlog/freshness/review drift; unrelated |
| eBay UK (`12`) | monitored backlog growth with fresh read-only evidence and a successful prior ordinary run | The known no-publication backlog, not a worker/runtime regression |
| 10 Reps (`14`) | unresolved latest ordinary profile attempt plus backlog growth | Existing backlog/freshness/review drift; unrelated |
| Gladiator Nutrition (`15`) | incomplete capture/apply/postflight/idempotency history after a failed run | Retailer-specific evidence debt; unrelated |

No new code or runtime regression materially affecting the eBay Review Queue
combined contract was found. None of this unrelated debt was changed.

## Existing atomic architecture proof

The implementation audit proved all required prerequisites before editing:

1. `scripts/ebay-offer-refresh.js` already maps a plan with both deltas to
   `UPDATE_PRICE_AND_STOCK`.
2. `buildExistingOfferUpdatePlan` represents price, shipping, total, stock and
   URL together in one resolved offer update with one guarded expected state.
3. `apply_approved_product_import_plan` delegates to the existing atomic
   `apply_product_import_plan` transaction. That transaction locks and
   stale-checks the exact offer, applies all offer fields in one `UPDATE`, and
   records history in the same transaction.
4. A price-changing plan contains one `price_history: create` action, and the
   protected wrapper returns that one reusable `price_history_id`.
5. No new database primitive or migration is needed.

The existing Review Queue, publisher, adapter registry, eBay worker, protected
plan builder, approval/apply RPCs, shared postflight, idempotency rebuild and
execution-request lifecycle remain the only path.

## Changed contract

The eBay adapter now supports exactly:

- `VERIFY_NO_CHANGE`
- `UPDATE_PRICE`
- `UPDATE_STOCK`
- `UPDATE_PRICE_AND_STOCK`

The combined operation is bound only to `PRICE_AND_STOCK_CHANGE`. It does not
accept `HARD_PRICE_ANOMALY`, identity promotion, rebind, source-missing or an
unknown reason. The registered adapter makes the operation
`REVIEW_EXECUTABLE` through the existing capability matrix; there is no UI-only
exception.

Reconciliation now preserves the protected plan's exact final offer state for
all three commercial operations. The eBay worker then requires, for the
combined operation:

- exact retailer, offer, mapping, product and variant identity;
- matching immutable source and plan fingerprints;
- the reviewed before state to equal the protected plan before state;
- the reviewed proposed state to equal the protected plan after state;
- both price and stock to change;
- unchanged identity, mapping, URL and shipping;
- a valid `price + shipping = total` relationship;
- fresh source price, normalized source stock and affiliate URL to match the
  proposed final state;
- one offer update, one price-history create and exact expected deltas of one
  price, one stock, one total, one freshness and one history change.

The generic apply-result invariant is now: no history ID for
`VERIFY_NO_CHANGE` and `UPDATE_STOCK`; one history ID for `UPDATE_PRICE` and
`UPDATE_PRICE_AND_STOCK`. The reused shared postflight must independently prove
the planned price, stock, total, freshness and price-history deltas, with zero
shipping, offer-URL and mapping-URL drift. A fresh same-offer rebuild must be an
exact `VERIFY_NO_CHANGE` with `price_history: noop`.

## Regression evidence

Focused coverage uses the production-audit shapes for offers `2749`, `2769`
and `2774` only inside tests: each is an out-of-stock to in-stock transition
with a price change. Runtime code contains no branch for those IDs or their
products/brands.

Focused tests cover producer semantics, canonical reason binding, adapter
default-deny behavior, capability registration, exact combined acceptance,
price-only and stock-only rejection, identity/before/proposed/URL/shipping/source
drift, history creation, expected deltas, apply result, shared postflight,
idempotency and the existing price, hard-price, stock and no-change paths. The
four focused test files pass `229/229`.

Local verification after implementation:

- focused eBay/Review Queue files: `229/229 PASS`;
- Project Guardian: `PASS`;
- Quality Gate quick: `PASS`;
- Quality Gate full, including baseline migration validation and isolated
  Next.js production build: `PASS`;
- standalone TypeScript: `PASS`;
- standalone ESLint: `PASS`;
- standalone production build with repository-standard loopback placeholders:
  `PASS`;
- `git diff --check`: `PASS`.

Remote PR checks and merge evidence are recorded in the PR and final handoff.

## Side effects and next safe step

- Database migrations created: `0`.
- Production database writes: `0`.
- Review Queue writes: `0`.
- Execution requests queued: `0`.
- Worker executions triggered: `0`.
- Old preflight artifact used for execution: `NO`.
- SEO-20 changed: `NO`.

After merge, stop. The next safe task must produce a completely new eBay source
capture, reconciliation and publication preflight. Publication may only be
considered separately if that new evidence has zero unsupported commercial
operations, unknown reasons, duplicate fingerprints and baseline mismatches.
