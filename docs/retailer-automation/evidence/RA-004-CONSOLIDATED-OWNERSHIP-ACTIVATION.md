# RA-004 consolidated ownership staging activation

Status: `OWNER_AUTHORIZED_PREPARED_NOT_EXECUTED`.

This one-shot staging-only activation is bound to baseline
`9db85844bccdffc153704230a98c4f5919a55c5f` and selects exactly
`20260927103000_consolidate_ra004_supabase_ownership_interfaces.sql` at SHA-256
`a240a263d7e88084171a73317db9e19f0e2c69c9b71ca84dbe788b624a22c9c4`.

The required pre-state is ledger count `96`, fingerprint
`d85982cd1df704c77c8d61b0d8f56038eecb4fce014ba9aa68e69b617a9efb7e`, and
head `20260926110000_add_ra004_staging_interface_compatibility`. The compatibility
migration is already applied and is not selected again. All historical RA-004
control-state and preflight migrations remain excluded.

The guarded execution permits one migration attempt without `--include-all`,
one Q1-Q8 metadata preflight, and only after its full PASS one read-only
control-state canary for retailer `11` (`10 Reps`, `10-reps`). Credentials are
accepted only through the masked launcher and remain in process memory. Cleanup,
credential revoke, private evidence-store closure and a terminal closeout are
mandatory regardless of outcome.

Production, retry, a second attempt, rebuild, additional migrations, feed
capture, shadow, plans, approval, import, offer apply, Model B, auto-safe and
cutover remain unauthorized. Production selection remains closed.
