# RA-004 final control-state canary

Status: `OWNER_AUTHORIZED_PREPARED_NOT_EXECUTED`.

The prior staging run applied the provider-identity migration and completed
Q1-Q8. Its single control-state canary failed before an artifact was produced,
but the coordinator reported `RA004_UNCLASSIFIED_FAILURE` because its failure
serializer inspected only the full message and ignored the structured
`error.code` used by the exporter.

This change introduces one shared allowlisted serializer for `RA004_*` and
`CONTROL_EXPORT_*` reason codes. It records only the code, never diagnostic text,
database URLs or credentials. Unknown codes remain fail-closed as
`RA004_UNCLASSIFIED_FAILURE`.

The prepared execution path contains no migration or preflight capability. It
requires the exact 99-row staging ledger, verifies the two already-applied local
migration hashes, proves both migration selectors closed, authenticates the
private evidence store, and then permits exactly one read-only control-state
export. The existing credential issuer, bounded PostgreSQL transport, query-aware
revoke verifier, TLS validation and cleanup paths are reused unchanged.

Production, retry, feed capture, shadow run, control plan, approval, import,
apply, Model B, auto-safe and cutover remain unauthorized.

## Local verification

- shared serializer and final coordinator regressions: PASS;
- PostgreSQL 17 RA-004 integration scenarios: PASS;
- `verify:project`, `verify:quick`, `verify:full`, TypeScript, ESLint,
  baseline migration validation and production build: PASS;
- strict CA launcher validation without a database connection: PASS;
- changed-file secret scan, Markdown-link validation and `git diff --check`: PASS;
- Jon's closeout policy, nutrition variant provenance and shared-parent import
  identity remain identical `PRE_EXISTING_BASELINE_FAILURES`; they were not
  changed, skipped, weakened or represented as passing.
