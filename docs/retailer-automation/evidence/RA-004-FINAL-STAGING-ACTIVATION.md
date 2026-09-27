# RA-004 final staging activation

Status: `ATTEMPT_CONSUMED_FAILED_TERMINAL_ARCHITECTURE_REVIEW_REQUIRED`

This one-shot staging activation is bound to baseline
`feac20f1a515ee3fbf55cee94cf6dc8234aafb95`, project
`hxnrsyyqffztlvcrtgbf`, the attested 95-row ledger fingerprint and exactly the
three migrations sealed in `RA-004-final-staging-migration-activation.json`.

The superseded migrations remain excluded. Seven unrelated pending migrations
are deferred. `--include-all`, automatic retry, manual retry and production are
forbidden. The ordinary STAGING and PRODUCTION selectors remain closed; only
the exact independently verified activation manifest can materialize the three
files.

Before the first migration write, the coordinator verifies the merged clean
`origin/main` commit, exact project and host, retailer `11`, ledger count and
fingerprint, migration hashes, private evidence session, and cleanup/revoke
paths. It records redacted CLI stdout and stderr, permits one migration attempt,
then one Q1-Q8 preflight and—only after PASS—one read-only canary.

Regardless of outcome, a separate closeout PR must terminally close this
activation and restore the activation selector to a non-executable state.
RA-004 remains `IN_PROGRESS`; shadow and production remain `NOT_AUTHORIZED`.

## Terminal outcome

Activation `ra004-staging-1790526213056` ran once from merged commit
`bab1a51b5293931b70b600b95264cd9bd2aa8544`. The compatibility migration
completed, advancing the staging ledger from 95 to 96 rows. The transactional
control-state migration then failed with PostgreSQL SQLSTATE `42501`: the
verified Supabase migration user could not `SET ROLE` to
`retailer_control_state_evidence_owner` while transferring object ownership.
That migration rolled back and the corrected preflight migration did not run.

The local PostgreSQL 17 model covered automatic administrative memberships for
the three compatibility roles, but did not reproduce the ownership-transfer
requirements of the four control-state interface roles under Supabase's
non-superuser migration identity. This is an architecture/model parity failure,
not authorization for another patch or retry.

Preflight and canary attempt counts are zero. The private evidence session was
closed, cleanup completed, and no temporary RPC credential was created. All
prohibited-operation counters, including production and business writes, are
zero. This activation is terminal and non-replayable; ordinary STAGING and
PRODUCTION selectors remain closed. RA-004 now requires a review of the full
role/ownership architecture before any new staging authorization.
