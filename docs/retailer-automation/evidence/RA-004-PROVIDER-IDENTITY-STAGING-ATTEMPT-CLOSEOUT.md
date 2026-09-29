# RA-004 provider-identity staging attempt closeout

## Terminal result

The single owner-authorized attempt ran from merged commit
`ee162cc3fd4cdc1dee42faafa7b5030d00c39dcd` under activation
`ra004-staging-1790659905439`. It is consumed, closed and not replayable.

- The evidence-store authentication succeeded once.
- `20260928101000_align_ra004_control_export_provider_identity.sql` was applied
  once at SHA-256
  `4454cebd1e462a20d4a612d253025c013b5c8276a4d51aa4e43016a7f248fc91`.
- The staging ledger advanced from 98 to 99. Its canonical fingerprint is
  `a6e7693f964925554e807602752e4630d14f537a1d9de4fe82f8433d30c307cc`.
- Q1–Q8 completed successfully. The report fingerprint is
  `b1719dbbaad328e7bc0f0dc7b24307f3b5c828fe1af43d7cad5e98aa9599f40c`.
- The one read-only canary was attempted once and failed before an export
  artifact was produced. It is not a PASS.
- Cleanup completed. Both temporary credentials were revoked; catalogue
  readback proved their roles and memberships absent and no active backend.
- Production operations, feed capture, shadow run, control plan, approval,
  import, apply and offer writes all remained zero.

## Exact diagnostic limitation

The stored failure code is `RA004_UNCLASSIFIED_FAILURE`. The common failure
serializer accepts only an `error.message` consisting solely of an RA-004 code.
The canary stack uses structured `error.code` values and messages formatted as
`CODE: detail`. The serializer ignored `error.code`, so it discarded the exact
canary code. No retry is authorized, and this closeout does not guess it.

The shortest safe correction is to make the common closeout serializer prefer a
validated, redacted `error.code`, with regression tests for every canary failure
family, before any separately owner-authorized read-only canary attempt.

## Repository state

The staging selector records the provider-identity migration as applied but
excluded, using ledger 99. The activation manifest is terminal. The production
selector remains unchanged and closed. RA-004 remains `IN_PROGRESS`; shadow run
is not authorized.
