# RA-004 final control-state canary

Current activation: `OWNER_AUTHORIZED_PREPARED_NOT_EXECUTED`.

The previous `v1` activation remains `ATTEMPT_CONSUMED_FAILED_TERMINAL` and is
not reusable. Owner authorization on 29 September 2026 created a distinct `v2`
activation pinned to baseline
`10f8fbf1e040704a74460c0988da8ff00d092c78`. It permits exactly one read-only
control-state canary, zero migrations, zero preflight attempts and zero retry.
The STAGING and PRODUCTION migration selectors remain closed.

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
