# RA-004 consolidated Supabase ownership architecture

Status: `BLOCKED`

This local-only change replaces both unapplied interface paths with one
forward-only migration:

- `20260927103000_consolidate_ra004_supabase_ownership_interfaces.sql`
- SHA-256: `a240a263d7e88084171a73317db9e19f0e2c69c9b71ca84dbe788b624a22c9c4`
- required pre-ledger: 96 rows, head
  `20260926110000_add_ra004_staging_interface_compatibility`
- expected post-ledger after a separately authorized future activation: 97
  rows, head `20260927103000_consolidate_ra004_supabase_ownership_interfaces`

No activation is included. Ordinary STAGING and PRODUCTION selection excludes
the new migration and every historical RA-004 interface migration.

## Ownership and runtime model

The migration verifies `current_user = session_user = postgres`, PostgreSQL 17,
`NOSUPERUSER` and `CREATEROLE`. The verified migration identity owns the
evidence table and all three `SECURITY DEFINER` functions. Every function has
`search_path=pg_catalog`, fully qualified application objects and static SQL.
`PUBLIC`, `anon`, `authenticated`, `service_role` and compatibility roles have
no interface-table or interface-function access.

No persistent control-state or preflight owner/caller role is created. During
a future authorized window, the issuer creates one bounded login and grants
only schema `USAGE` plus `EXECUTE` on its single allowlisted RPC. PostgreSQL 17
creates one administrative membership from `postgres` to that login with
`ADMIN TRUE / SET FALSE / INHERIT FALSE`; SQL and runtime validation bind that
edge to the exact session login and reject every additional scoped edge.
Cleanup revokes the exact function and schema grants and drops the login,
which removes the automatic membership. There is no executable `SET ROLE`
path.

The already-applied compatibility migration and its three roles remain
immutable. Their exact automatic administrative edges are accepted as existing
state and remain unusable by the runtime login. Supabase platform membership
edges are outside this interface scope and confer no access because the
temporary login receives no membership in a platform role.

## Interface boundary

- `read_retailer_control_state_v1` is stable and read-only.
- `write_retailer_control_state_evidence_v1` is append-only, fingerprint-bound
  and idempotent; it can write only the closed operational evidence contract.
- `read_ra004_staging_preflight_v1` returns the bounded Q2–Q7 metadata snapshot;
  the runner seals Q1 and Q8.
- The evidence table has forced RLS and owner-only policies. Runtime logins have
  no table or sequence privileges.
- No service-role credential, dynamic SQL, production wiring, workflow,
  scheduler, feed, shadow, plan, approval, import or apply path is introduced.

## Local proof

The isolated PostgreSQL 17 test uses a real `NOSUPERUSER CREATEROLE` login
named `postgres`, reconstructs the exact ledger-96 state and applies only the
new migration. It proves:

- compatibility is not replayed;
- the ledger becomes 97 and both RPCs plus the append-only writer exist;
- Q1–Q8 pass;
- one synthetic read-only canary returns
  `CLEAR_FOR_SEPARATE_SHADOW_AUTHORIZATION` with counters `1/0/0`;
- catalogue business counts do not change;
- direct DDL, DML, table access and `SET ROLE` fail;
- all three temporary logins and their membership edges disappear on cleanup;
- replay, altered ledger and partial schema all fail closed.

## Quality-gate result

- `verify:project`: PASS
- `verify:quick`: PASS (`567` pass, `3` explicit skips, `0` fail)
- `verify:full`: PASS, including TypeScript, ESLint, baseline migration
  validation and the production build
- RA-002/RA-003/RA-004 static tests: PASS (`260/260`)
- PostgreSQL 17 RA-004 integration tests: PASS (`6/6`)
- diff secret scan: PASS
- `git diff --check`: PASS
- dependency audit: completed; the unchanged baseline dependency graph reports
  two moderate, three high and one critical advisory
- independent clean-worktree verification of implementation commit
  `ec521d0d422456698f210a0ac1323c0dc4cea41d`: PASS (`117/117` focused
  contract/selector tests and the isolated PostgreSQL 17 consolidated scenario)
- full integration gate: BLOCKED (`72/74` pass). The two failures are
  `jons-final-closeout-policy-migration.integration.test.js` (10 Reps v8 anchor
  mismatch) and `nutrition-variant-provenance.integration.test.js` (duplicate
  synthetic candidate fingerprint). Each fails identically in a fresh worktree
  at baseline `c153145d2d82410a3160837c43ce14923a54d2d8`; neither file nor its
  dependencies are changed by this implementation.

The owner required all tests to pass before Draft PR creation. Therefore this
work remains local and no Draft PR is created until the two baseline quality
gate failures are resolved in their own authorized scope.

This evidence is local only. RA-004 remains `IN_PROGRESS`; staging execution,
production and shadow remain unauthorized.
