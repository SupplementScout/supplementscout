# RA-004 staging execution coordinator

**Prepared:** 25 September 2026

**Baseline:** `99752d9a941142072bb7dc164254241a30acc92b`

**Owner authorization:** `APPROVED_FOR_PREPARATION_VERIFICATION_MERGE_AND_ONE_EXECUTION`

**Execution status in this PR:** `NOT_STARTED`

**RA-004:** `IN_PROGRESS`

This change closes the operational wiring gap discovered before any staging
mutation. The earlier local helper stopped during the selector readback because
it treated the selector's filename-to-SHA map as an array. No bucket, migration,
credential, metadata RPC or control-state RPC was created or invoked, and the
30-minute window did not start.

The tracked coordinator is bound to staging project
`hxnrsyyqffztlvcrtgbf`, owner-authorized baseline
`247672dcb1d1b4654cc6a091ff10d7dbad42a902`, activation manifest
`ra004-staging-interfaces-2026-09-25-v2`, the two reviewed migration SHA-256
values, and bucket `ra004-staging-preflight-evidence`. It accepts secrets only
from process memory. The database URL and access token are removed from every
inherited Supabase CLI child environment. Linking receives only the exact
management-token environment, so it cannot save the database password. The
subsequent migration push receives the password only in its child-process
environment, preventing creation of a passwordless CLI login role. Neither
secret is accepted on a command line, written to configuration by this
coordinator or included in evidence.

Independent review rejected the initial use of `supabase storage cp --linked`:
the pinned CLI resolves that path by revealing and using the project
service-role key. The corrected coordinator does not invoke any Supabase CLI
storage command or retrieve an API secret. A separate evidence-custodian
process uses a normal authenticated staging session supplied only through
process memory. Two temporary RLS policies bind that subject to the exact
activation prefix and six closed object names: INSERT and SELECT only. There is
no UPDATE, DELETE, list endpoint or `x-upsert`; every upload is followed by an
exact-object byte-hash readback. The policies are dropped and the Auth session
is globally logged out on every exit path.

Migration deployment first runs the merged selector against the live read-only
ledger, materializes its exact selected workdir, checks two filename-bound
SHA-256 values and then invokes `supabase db push --linked` only against that
workdir. `--include-all`, production and direct migration SQL are absent.

The first remote staging mutation establishes a single 30-minute UTC window.
The coordinator then creates or verifies one private 2 MB JSON/text bucket,
pushes the two selected migrations, and starts a separate issuer process. The
issuer creates one direct-RPC preflight login. Only a fully validated preflight
causes creation of a different direct-RPC control-state login. Both are
`NOINHERIT`, non-superuser, non-bypass, connection-limit-one, read-only and
15-second-timeout credentials. Every exit path attempts immediate revoke and
drop. Neither runner receives a general SQL interface.

Evidence writes use one exact activation prefix, reject overwrite, cap each
object at 2 MB and require byte-equivalent readback. A separate verifier also
proves that each dropped PostgreSQL login cannot reconnect. The coordinator has no feed,
shadow, control-plan, approval, import, catalogue apply, offer-write, Model B,
scheduler, production or retry path. A successful execution proves only the
staging preflight and one read-only control-state canary; RA-004 remains
`IN_PROGRESS` and shadow remains `NOT_AUTHORIZED`.
