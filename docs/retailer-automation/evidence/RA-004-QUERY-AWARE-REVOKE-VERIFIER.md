# RA-004 query-aware revoke verifier

Status: `READY_FOR_INDEPENDENT_VERIFICATION`

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

RA-004 remains `IN_PROGRESS`. A live preflight and canary require the separately
authorized one-shot execution after this verifier has been independently
verified and merged.
