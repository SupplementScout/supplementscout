# RA-004 consolidated ownership staging activation

Status: `ATTEMPT_CONSUMED_FAILED_TERMINAL_PLATFORM_LIMITATION`.

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

The one authorized attempt ran as activation `ra004-staging-1790580130471`.
The guarded migration applied and advanced the verified staging ledger from 96
to 97 rows, ending at the consolidated migration with selector fingerprint
`1692043d963e98570cd69ea2f46654c35f35a78f26c35b3d96e04751d528331c`.
The migration-time business-row guard passed. Q1-Q8 then stopped on
`RA004_PREFLIGHT_LEDGER_UNKNOWN` because PostgreSQL's metadata RPC calculated a
different ordered-ledger fingerprint for that same 97-row ledger. The canary
did not start.

The private evidence-store session and execution window are closed. The
automatic preflight-role cleanup failed without replacing the primary error;
an exact bounded cleanup then removed the temporary preflight role and verified both
role and membership absence. No canary credential was created. The activation
is non-replayable, and both staging and production selection are closed.
