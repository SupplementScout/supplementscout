# RA-004 forward staging activation

Status: `ATTEMPT_CONSUMED_FAILED_TERMINAL`

Baseline: `a651dc61fec43b09e0ee908ec3cac01fbb45e3c8`

Activation manifest fingerprint:
`460ca06556051403fe87c4883179764d4e6530a3ff7abcaaf113b4aedec32e11`

This activation authorizes exactly one staging attempt for project
`hxnrsyyqffztlvcrtgbf`, host `aws-0-eu-west-3.pooler.supabase.com`, retailer
`11` / `10 Reps` / `10-reps`.

The closed selector admits only:

- `20260927100000_reissue_transactional_retailer_control_state_interface.sql`
  (`699c911289e6b1eccd04ca778e8d26a36cbc2caf57b426eaede7b359991b2977`);
- `20260927101000_reissue_ra004_staging_preflight_metadata_interface.sql`
  (`6d1e3512792884cf0696e36d4c54f78d9d85e3e68b32cdd475a885f6138dc2f4`).

The original interface migrations remain SHA-bound and excluded. Production
selection remains unchanged and closed. `--include-all`, every unrelated
migration and every retry path remain forbidden.

The activation binds the verified 95-row ledger fingerprint
`c5bb6405d26def1834522cccaf2937fad60f44156370e5e1f8c4af3ff96d45bd`
to the expected 97-row fingerprint
`330d36f6bcff6a62d46c015cc5c31d32a6bf2c3639a3ba2e9ab856d1e3fbb668`
and final version `20260927101000`.

Before remote execution, the launcher must run from the exact squash-merge SHA
of this activation PR. That SHA will be recorded in the execution evidence and
the closeout PR. The 30-minute window starts only after the private evidence
session and its bounded policies are attested.

The coordinator now writes separate redacted stdout and stderr files whenever
Supabase CLI exits non-zero. The failure report retains their filenames,
SHA-256 values, exit code and primary failure; cleanup cannot replace it.

Runtime activation `ra004-staging-1790509412479` was consumed exactly once and
closed after the first migration failed before any migration was committed.
The staging ledger remained at 95 entries. No preflight or canary ran; cleanup
completed. This activation is terminal and cannot be selected or replayed.
