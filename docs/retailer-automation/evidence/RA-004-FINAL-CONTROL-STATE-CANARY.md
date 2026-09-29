# RA-004 final control-state canary

Current activation: `ATTEMPT_CONSUMED_FAILED_TERMINAL`.

Activation `v3` ran once on execution commit
`c57c6abbb2e0e01842dd279613b4bbc1d9344966`. The private evidence-store session
was authenticated first. The existing observer then wrote exactly five fresh
`SOURCE_OBSERVED` evidence rows in one transaction and read back exact 5/5
coverage. The minimal writer was revoked before the sole read-only canary began
inside the fixed 20-minute observation lifetime. Migration, preflight and retry
attempts were zero. Both migration selectors remained closed.

The canary produced a complete read-only artifact: all 11 sources were queried,
`sources_unavailable` was empty, `completeness_status` was `COMPLETE`, and read,
write and mutation attempt counts were 1, 0 and 0. Nevertheless, the applied SQL
RPC returned `BLOCKED_INCOMPLETE_EXPORT`. Its assessment expression treats an
empty `postflight_state` or empty `watchdog_state` collection as an incomplete
export. For a retailer with no prior apply this is a valid empty state, not an
unavailable source. The shared JavaScript exporter already implements the
intended contract: only an unavailable required source makes an export
incomplete. The exact blocker is
`RA004_SQL_EMPTY_QUERIED_STATE_MISCLASSIFIED_INCOMPLETE`.

The attempt is consumed, terminal and non-replayable. Cleanup completed, the
evidence-store session closed, both temporary credentials were revoked, and
catalogue readback confirmed both roles, memberships and active backends were
absent. Ledger 99 and business data were unchanged. Production operation count
was zero. The terminal machine-readable closeout is
[`RA-004-atomic-source-observation-canary-closeout-v3.json`](RA-004-atomic-source-observation-canary-closeout-v3.json).

Both `v1` and `v2` activations are consumed, terminal and not reusable. The
`v2` activation ran once at execution commit
`7689eb4d7cb9619b9bc0fe10ae068599debd97bd`. It attempted zero migrations,
zero preflights and one read-only control-state canary. The STAGING and
PRODUCTION migration selectors remained closed.

The canary stopped with `CONTROL_EXPORT_SOURCE_UNAVAILABLE`. The applied RPC
requires five current `SOURCE_OBSERVED` rows and its only runtime branch for
this code rejects coverage other than 5/5. The bounded observer created those
rows at `2026-09-28T19:38:46.042Z` with the contract's 20-minute lifetime; the
canary began at `2026-09-29T08:38:03.395Z`, after all five had expired. No
source refresh was authorized in the canary activation.

The failure closeout proves ledger 99 remained unchanged, migration and
preflight attempt counts were zero, the evidence-store session closed, cleanup
completed, and the temporary role, membership and active backend were absent.
The redacted local failure artifact SHA-256 is
`c351a3a22dfac1754f53d095ddd0da07aee0e66b04b5c09fad75e7c02cf1a8ef`.

The prior staging run applied the provider-identity migration and completed
Q1-Q8. Its single control-state canary failed before an artifact was produced,
but the coordinator reported `RA004_UNCLASSIFIED_FAILURE` because its failure
serializer inspected only the full message and ignored the structured
`error.code` used by the exporter.

The authorized attempt was consumed at execution commit
`9baf02b43e3ae44eefed6a28d9e96a211fa11b3f`. The ledger remained at 99,
the temporary role, membership and backend were absent after revoke, and no
migration or preflight was attempted. The activation is terminal and is checked
before any credential prompt or remote connection.

The systemic defect was at the bounded transport boundary. PostgreSQL errors
were passed through with raw SQLSTATE values such as `42501` or `P0001`.
The outer serializer intentionally accepts only reviewed `RA004_*` and
`CONTROL_EXPORT_*` codes, so it replaced the real failure with
`RA004_UNCLASSIFIED_FAILURE`. The bounded transport now maps every phase and
reviewed SQLSTATE/RA-004 RPC error into a stable redacted code before it reaches
the coordinator. Diagnostic evidence contains only phase, SQLSTATE, reason code
and a fingerprint; it never contains the database message, URL or credential.

The execution evidence is now two-phase. A private-store execution report is
written before the authenticated store session is closed. The terminal local
closeout is sealed only after credential revoke, policy removal and evidence
session cleanup are complete. A report can no longer claim terminal cleanup
while cleanup is still pending.

The PostgreSQL 17 integration now exercises the actual Node `pg` bounded
transport, transaction proof, RPC, exporter validation and cleanup against the
same migrated schema. Earlier tests called the RPC through `psql` and then fed
its JSON directly to the exporter, leaving the failing network boundary untested.

Production, retry, feed capture, shadow run, control plan, approval, import,
apply, Model B, auto-safe and cutover remain unauthorized.

## Local verification

- transport classification, terminal activation and two-phase closeout
  regressions: PASS;
- PostgreSQL 17 RA-004 integration scenarios: PASS;
- `verify:project`, `verify:quick`, `verify:full`, TypeScript, ESLint,
  baseline migration validation and production build: PASS;
- strict CA launcher validation without a database connection: PASS;
- changed-file secret scan, Markdown-link validation and `git diff --check`: PASS;
- Jon's closeout policy, nutrition variant provenance and shared-parent import
  identity remain identical `PRE_EXISTING_BASELINE_FAILURES`; they were not
  changed, skipped, weakened or represented as passing.
