# RA-004 forward-reissued interface migrations

Status: `RA-004 FORWARD REISSUED INTERFACE MIGRATIONS VERIFIED_COMPLETE`

RA-004 remains `IN_PROGRESS`. Staging execution, production, preflight, canary,
feed capture and shadow remain `NOT_AUTHORIZED`.

## Purpose

The staging ledger ends at
`20260926100000_create_ra004_staging_10reps_retailer`. The two original RA-004
interface migrations have lower timestamps and Supabase CLI therefore correctly
refuses to apply them without `--include-all`. That override remains forbidden.

This change preserves the original files and their approved SHA-256 values, and
reissues their contracts at the following forward-only timestamps:

- `20260927100000_reissue_transactional_retailer_control_state_interface.sql`
- `20260927101000_reissue_ra004_staging_preflight_metadata_interface.sql`

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

Both old and new interface migrations are SHA-bound and excluded from ordinary
STAGING and PRODUCTION selection. The consumed v5 activation is closed with one
failed attempt and zero applied migrations. No new activation manifest exists,
so this PR cannot select or apply either forward migration.

## Local evidence

- pre-change `npm run verify:project`: PASS;
- selector tests: PASS after confirming all four interface files are excluded;
- isolated networkless PostgreSQL 17 integration: PASS for a 95-row simulated
  staging ledger, fresh install, 97-row post-ledger, both RPCs, unchanged
  product/variant/retailer-product/offer/price-history counts, direct replay,
  exact old-contract upgrade and function/role/grant/policy drift rejection;
- no staging or production connection, credential, evidence session or remote
  operation was used.

## Independent verification

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
exactly one staging attempt using the two new timestamps. This record does not
provide that authorization.
