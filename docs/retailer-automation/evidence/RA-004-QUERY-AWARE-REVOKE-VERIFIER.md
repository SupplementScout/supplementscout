# RA-004 query-aware revoke verifier

Status: `READY_FOR_INDEPENDENT_REVERIFICATION`

The authenticated ACL/RLS staging attempt ended with
`RA004_REVOKED_CREDENTIAL_RECONNECTED` even though the owner-side catalogue
readback proved that the temporary role and its memberships no longer existed.
The old verifier treated a successful Supavisor handshake as proof that the
credential still had database access. Supavisor may accept that handshake from
its pool cache before PostgreSQL rejects the first query.

The shared verifier now executes exactly one allowlisted, non-business query
(`select current_user`) after a successful handshake. Authentication rejection
at connect and authentication rejection of that first query are distinct safe
outcomes. A successful query is the only credential-access failure. A separate
parameterized owner-side catalogue query proves that the role, every membership
edge and every active backend for the role are absent.

All database clients retain certificate verification, TLS 1.2 minimums and
bounded timeouts. Raw connection errors are converted to deterministic codes;
URLs, passwords and connection details are not emitted. No migration, selector,
retailer application path or business-data operation is changed by this fix.

Regression coverage includes cached handshake/query rejection, connect-time
authentication rejection, unexpected transport failure, successful revoked
query, remaining role, remaining membership and remaining backend.

The final read-only staging attempt exposed a second ordering defect. The
revoked-login connection attempt ended with a driver error outside the three
PostgreSQL authentication SQLSTATE values recognized by the probe; its raw
message was intentionally not retained. The probe raised
`RA004_REVOKE_CONNECTION_UNVERIFIED` before the independent owner-side catalogue
readback could run, even though the issuer had already revoked and dropped the
role. The evidence session closed, the ledger remained at 98 and no canary or
migration attempt occurred.

The verifier now records the bounded credential probe outcome first and always
performs the separate catalogue readback before deciding. A non-SQLSTATE
connection or first-query rejection is accepted only when that readback proves
all three facts: the role is absent, every membership edge is absent and no
backend for the role is active. It returns the deterministic codes
`RA004_REVOKE_CONNECTION_REJECTED_CATALOGUE_CONFIRMED` or
`RA004_REVOKE_POOLER_HANDSHAKE_QUERY_REJECTED_CATALOGUE_CONFIRMED`. A successful
query remains `RA004_REVOKED_CREDENTIAL_QUERY_SUCCEEDED`; any remaining role,
membership or backend remains a hard failure; and an unavailable catalogue
readback remains fail-closed as `RA004_REVOKE_CATALOGUE_UNVERIFIED`.

RA-004 remains `IN_PROGRESS`. A live preflight and canary require the separately
authorized one-shot execution after this verifier has been independently
verified and merged.
