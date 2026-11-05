# Production migration-ledger retailer automation regression — 2026-11-05

## Status and boundary

Repository correction prepared on `fix/production-migration-ledger-binding` from
authoritative main `190293acfcbadff856f40f5f7f1e590d1aca5a38`. This incident
permits no migration, catalogue write, Review Queue publication, approval,
execution or eBay worker dispatch. All database checks below used read-only
transactions. Production database writes during this repair are `0`.

## Exact ledger diagnosis

Read-only capture at `2026-11-05T17:06:36.251Z` established:

| Environment | Live count | Live canonical fingerprint | Repository count before fix | Repository fingerprint before fix |
| --- | ---: | --- | ---: | --- |
| PRODUCTION `aftboxmrdgyhizicfsfu` | 260 | `17a00891dff4e0a4f53050a018594fd505aa0aabc02b5281580b42895d7fd61e` | 259 | `d21a4044df80270db476bd264a9a4da19e90fe15310b2b918487ce4c480978af` |
| STAGING `hxnrsyyqffztlvcrtgbf` | 120 | `31dc3e6e90dab56dd00843bef441cfba400e1d9480d2940f41b46cfff6e32277` | 120 | `31dc3e6e90dab56dd00843bef441cfba400e1d9480d2940f41b46cfff6e32277` |

The exact ordered PRODUCTION ledger is the 260-entry canonical sequence ending
with:

1. `20261031120000_add_verified_automation_review_stock_transition_reader`
2. `20261104120000_allow_automation_review_hard_price_anomaly`
3. `20261105100000_refresh_pending_review_execution_binding`

The repository and live ledger had exactly one identifier difference before the
fix:

- live-only:
  `20261105100000_refresh_pending_review_execution_binding`
- repository-only: none

Both November migrations are present in PRODUCTION. Neither is present in
STAGING, where both correctly remain pending. The live count, full sorted
identifier sequence and canonical fingerprint were read directly from
`supabase_migrations.schema_migrations`; the selector reproduced the same
canonical sequence after the correction. A second read-only capture at
`2026-11-05T17:21:37.321Z` returned no `actual_only` or `expected_only`
identifiers for either environment.

PR #482 introduced
`20261105100000_refresh_pending_review_execution_binding.sql` and correctly
marked it pending while it was unapplied. The subsequent authorized production
application advanced the live ledger from 259 to 260, but main retained the
temporary production-pending declaration. There was no rollback. That stale
declaration was the shared regression.

## Cross-retailer evidence

All three retained diagnostics fail at `VALIDATOR`, with
`VALIDATOR_REJECTED / RSBI_SOURCE_HASH_MISMATCH / Actual migration ledger does
not match the approved package`, and record zero attempted or completed
business writes:

| Retailer | Run | Artifact | Artifact digest | Other source or policy finding |
| --- | ---: | ---: | --- | --- |
| Gladiator Nutrition | `42064783629` | `13433920882` | `8a12058e157bd746d3a660dc2f72901af9dd07dd142129fd3050ca92c7a0b8ad` | A separate legitimate `MASS_OOS` review condition exists; it did not cause the validator rejection. |
| KIOR | `42058264330` | `13428434902` | `cc05ccda93bff85028811d167ab328eee7ca46dbdbe196340f571a9de223efb8` | Source and aggregate guards passed. |
| Discount Supplements | `42050076417` | `13427430065` | `1260cc87dbf100676edfcb23b8c615a89fa7bf8768983864cc6d86cc2a71f6a7` | Source and aggregate guards passed. |

The three profiles all call the shared `fit-house-offer-refresh.js` artifact and
validation path. That path obtains `migrationBinding(spec.environment)` once
and seals the same expected versions and fingerprint into every retailer
package. There is no retailer-specific ledger selector.

## Central correction

- `PENDING_MIGRATIONS.PRODUCTION` is now empty because both November migrations
  are applied there.
- `PENDING_MIGRATIONS.STAGING` is unchanged and still contains both migrations.
- The frozen PRODUCTION selector contract now records count `260` and
  fingerprint
  `17a00891dff4e0a4f53050a018594fd505aa0aabc02b5281580b42895d7fd61e`.
- Strict mismatch rejection is unchanged. The existing wrong-count,
  wrong-fingerprint, remote-only and extra-pending tests still prove fail-closed
  behavior.
- No SQL migration and no retailer-specific runtime exception were added.

Focused verification passed `230/230` tests across the selector, canonical
ledger fingerprint, shared refresh path, KIOR, Discount Supplements, Gladiator,
shared validator and reconciliation contracts. The regression explicitly proves
that all three retailer profiles use the corrected shared binding and that the
two environments cannot leak pending state into each other.

## Read-only canaries

The corrected binding itself passed twice against the live PRODUCTION and
STAGING ledgers with exact count, full identifier sequence and fingerprint
equality and zero writes. Local executions of the existing KIOR, Discount and
Gladiator production dry-run entry points were also attempted from the exact
correction commit. Each stopped fail-closed at `SOURCE_FETCH` because its
Shopify endpoint returned HTTP `429`; none reached the validator, none reported
`RSBI_SOURCE_HASH_MISMATCH`, and each diagnostic records zero database,
business, control, approval or execution writes. A fresh GitHub-hosted dry-run
on final main remains the appropriate source-network canary; apply mode is not
authorized.

## Review Queue worker scheduler audit

Read-only repository and GitHub checks found:

- workflow `Automation Review Queue Worker` is `active` on default branch
  `main`;
- cron remains `*/5 * * * *`;
- the job requires `refs/heads/main` and permits scheduled events;
- permissions remain `contents: read` and `actions: read`;
- environment remains `production-readonly`;
- concurrency remains `retailer-offer-production-write` with
  `cancel-in-progress: false`;
- the focused scheduled-worker contract test passes;
- last scheduled worker run `42049714636`, created
  `2026-11-05T14:55:22Z`, completed successfully;
- no later worker run record exists although other scheduled workflows did run.

Because concurrency acts only after a run record exists, it cannot explain the
absence of all later worker run records. No repository syntax, state, branch,
condition, environment, permission or concurrency regression is proven. The
evidence is most consistent with GitHub-delayed or dropped scheduled events.
The later manual dispatch HTTP `500` created no run and is therefore a GitHub
API/server failure at the observed boundary; the available evidence does not
support a more specific repository cause. No scheduler, secret or token change
is warranted.

At `2026-11-05T17:17:09.049Z`, read-only production state still showed exact
eBay request `1759ea2f-e4e3-4e1c-83ba-76ea9c52fc58` for review `1029`, offer
`2774`, operation `UPDATE_PRICE_AND_STOCK`, as `QUEUED`, with no completion,
error or recorded database writes. The review remained `APPROVED`. This task
created no request and triggered no worker.

