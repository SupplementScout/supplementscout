# RA-004 PostgreSQL 17 compatibility-role contract

Status: `INDEPENDENTLY_VERIFIED_DRAFT`

This local-only correction addresses the PostgreSQL 17 role-membership shape
observed for Supabase migrations. It does not authorize or perform staging or
production access, a rebuild, a migration, a retry, preflight or canary.

## Cause

When a non-superuser with `CREATEROLE` creates a role, PostgreSQL 17 records an
administrative membership from that creating user to the new role. The edge is
created by PostgreSQL with these exact options:

- `ADMIN TRUE`
- `SET FALSE`
- `INHERIT FALSE`

The prior compatibility contract rejected every membership, so it rejected
the database state created by its own three `CREATE ROLE` statements on the
Supabase migration path. The transaction failed closed and applied no remote
migration.

## Corrected boundary

The migration first verifies `current_user` and `session_user` are both the
selector-bound migration identity `postgres`, and that this existing role has
`CREATEROLE`. It does not derive, search for or guess another identity.

For each of these roles:

- `retailer_catalogue_production_approver`
- `retailer_catalogue_production_executor`
- `retailer_catalogue_production_validator`

the contract permits exactly one membership involving the role. Its member
must be the verified migration user, its grantor must be a superuser, and its
options must be exactly `ADMIN TRUE`, `SET FALSE`, `INHERIT FALSE`. Missing,
additional or differently configured memberships abort with
`RA004_COMPATIBILITY_ROLE_DRIFT`. A different migration identity aborts before
object creation with `RA004_COMPATIBILITY_MIGRATION_USER_MISMATCH`.

The three roles still require `NOLOGIN`, `NOINHERIT`, `NOSUPERUSER`,
`NOBYPASSRLS`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, default
connection/expiry/configuration state, no direct table or sequence ACL and no
direct function ACL. The migration grants none of those permissions.

## PostgreSQL 17 proof

The networkless integration test starts `postgres:17-alpine` with a separate
bootstrap superuser, then creates `postgres` as a non-superuser migration role
with `CREATEROLE`. The compatibility migration runs as that verified user.
PostgreSQL creates exactly three administrative memberships; their grantor is
the bootstrap superuser and all three option triples match the contract.

Negative tests reject:

- a different migration identity;
- `SET TRUE`;
- removal of `ADMIN TRUE`;
- any additional membership;
- changed role attributes;
- a direct table grant;
- a direct function grant.

The existing isolated full migration sequence still proves unchanged business
row counts, no compatibility rows and fail-closed schema drift. Ordinary
STAGING and PRODUCTION selectors SHA-bind and exclude the revised migration.
The consumed historical activation retains its immutable old SHA and cannot be
made executable against the revised contract.

Current migration SHA-256:
`22b7102641d3aabee86f91d4b07185eb7e6cbed3a017ef8da0499fa2c9dfad7f`.
