# RA-004 final staging activation

Status: `OWNER_AUTHORIZED_PREPARED_NOT_EXECUTED`

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
