# RA-004 forward-reissued interface migrations

Status: `RA-004 CORRECTED PREFLIGHT LEDGER CONTRACT VERIFIED_COMPLETE`

RA-004 remains `IN_PROGRESS`. Staging execution, production, preflight, canary,
feed capture and shadow remain `NOT_AUTHORIZED`.

## Corrected preflight ledger contract

The immutable reissue
`20260927101000_reissue_ra004_staging_preflight_metadata_interface.sql` is
superseded because its Q3 RPC expected the obsolete ledger name
`add_transactional_retailer_control_state_interface`. It remains unchanged and
excluded in both environments.

`20260927102000_correct_ra004_staging_preflight_ledger_contract.sql` is the
current complete forward-only preflight migration. It installs from an absent
interface or replaces only either known repository-owned predecessor function
definition after the complete role, policy, ownership and ACL boundary matches.
Every Q3 branch requires
`reissue_transactional_retailer_control_state_interface`; any other existing
definition fails closed. Its SHA-256 is
`85e7b9ff1d0091dfe24459a8dcd0d8502799102872737616cd9bbd430ae03639`.

## Purpose

The staging ledger ends at
`20260926100000_create_ra004_staging_10reps_retailer`. The two original RA-004
interface migrations have lower timestamps and Supabase CLI therefore correctly
refuses to apply them without `--include-all`. That override remains forbidden.

This history preserves the original files and their approved SHA-256 values.
The control contract remains current at its forward timestamp; the first
preflight reissue is immutable but superseded by the corrected timestamp:

- `20260927100000_reissue_transactional_retailer_control_state_interface.sql`
- `20260927102000_correct_ra004_staging_preflight_ledger_contract.sql`

The machine-readable mapping and hashes are recorded in
[`RA-004-forward-reissued-interface-migrations.json`](RA-004-forward-reissued-interface-migrations.json).

## Fail-closed behavior

Each migration accepts only one of two states:

1. none of its contract objects exists, so the approved interface is installed
   transactionally; or
2. every contract object exists and its function definition, role attributes,
   ownership, grants, policies and RLS contract match exactly.

A partial state or any function, role, grant, policy, table or index drift aborts
the transaction. The preflight reissue recognizes the exact old function and
updates only its ledger target from the superseded control migration timestamp
to the new forward timestamp. A repeated direct application is a verified
no-op; a normal Supabase migration replay remains prevented by the ledger.

## Selector state

All old, superseded and current interface migrations are SHA-bound and excluded from ordinary
STAGING and PRODUCTION selection. The consumed v5 activation is closed with one
failed attempt and zero applied migrations. No new activation manifest exists,
so this PR cannot select or apply either forward migration.

## Local evidence

- pre-change `npm run verify:project`: PASS;
- selector tests: PASS after confirming every original, superseded and current
  interface file is excluded;
- isolated networkless PostgreSQL 17 integration: PASS for a 95-row simulated
  staging ledger, the compatibility/control/corrected-preflight sequence,
  98-row post-ledger, full Q1-Q8 PASS, both RPCs, unchanged
  product/variant/retailer-product/offer/price-history counts, direct replay,
  exact old-contract upgrade and function/role/grant/policy drift rejection;
- no staging or production connection, credential, evidence session or remote
  operation was used.

## Prior reissue verification

- fresh detached worktree at implementation commit `33e2e15`: PASS;
- exact migration hashes and unchanged superseded migration hashes: PASS;
- selector contract (31 tests): PASS;
- isolated PostgreSQL 17 integration (2 tests): PASS;
- baseline migration validation (233 post-baseline migrations): PASS;
- `verify:project`, TypeScript, ESLint and `git diff --check`: PASS;
- `verify:quick`: PASS;
- `verify:full`, including the production build: PASS.

Draft PR #109 contains only the bounded forward migrations, closed selectors,
tests and RA-004 evidence. Staging and production were not contacted.

## Next authorization boundary

After verified merge, the only next task is a separate owner authorization for
exactly one staging attempt using the compatibility, reissued control-state and
corrected preflight migrations. This record does not
provide that authorization.
