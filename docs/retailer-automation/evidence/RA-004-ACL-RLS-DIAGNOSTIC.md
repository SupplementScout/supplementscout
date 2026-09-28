# RA-004 ACL/RLS diagnostic

Status: `DIAGNOSED_LOCAL_FIX_PENDING_VERIFICATION`

One bounded staging connection ran in a single `REPEATABLE READ READ ONLY`
transaction with the official Supabase Root 2021 CA and TLS verification enabled.
There was no retry, database write, business-data read or production connection.

The durable staging contract is intact: the three RPCs are owned by `postgres`,
`PUBLIC` and forbidden roles cannot execute them, the evidence table is owner-only
with forced RLS, its three policies match exactly, and the 10 Reps retailer policy
matches exactly. The temporary execution role was already revoked.

The failure was a contract false positive. The applied RPC used
`has_table_privilege` and `has_sequence_privilege` against every non-system object.
Those functions include privileges inherited from PostgreSQL `PUBLIC`, including
managed Supabase platform objects, and therefore did not prove a direct grant to
the temporary RA-004 login. The aggregate branch then hid which predicate fired.

The forward-only correction checks explicit role ACL entries for tables, columns
and sequences, retains the exact RPC, role, RLS and policy checks, and assigns a
separate fail-closed reason code to every branch. It does not grant any privilege,
change business data, or weaken the role and membership contract. The new
migration remains excluded from both STAGING and PRODUCTION selectors.

The machine-readable check list is in
`RA-004-acl-rls-readonly-diagnostic.json`. Raw catalogue output remains in the
private local evidence location and is not committed.
