# RA-004 corrected staging activation

Status: `OWNER_AUTHORIZED_PREPARED_NOT_EXECUTED`

RA-004 remains `IN_PROGRESS`. This record authorizes exactly one staging
attempt after this activation is independently verified and merged. Production,
shadow, feed capture, control plans, approvals, imports and offer apply remain
`NOT_AUTHORIZED`.

## Closed selection

The activation is bound to baseline
`aad469766b8491ef4eedffa143c33a7f3335d6bb`, staging project
`hxnrsyyqffztlvcrtgbf`, the attested 95-row ledger fingerprint, and exactly:

1. `20260926110000_add_ra004_staging_interface_compatibility.sql`
2. `20260927100000_reissue_transactional_retailer_control_state_interface.sql`
3. `20260927102000_correct_ra004_staging_preflight_ledger_contract.sql`

Their SHA-256 values are sealed in
`RA-004-corrected-staging-migration-activation.json`. The superseded
`20260927101000_reissue_ra004_staging_preflight_metadata_interface.sql` is not
selected. Seven unrelated pending migrations are deferred. `--include-all`,
automatic retry and manual retry are forbidden. The production selector is
unchanged and closed.

The expected successful ledger contains 98 rows, ends at `20260927102000`, and
has fingerprint
`67e4d52a9feb43379b5deb351fd050bc542897bb5ed89998368fbb7c349455db`.

## Guarded execution contract

The coordinator requires an exact clean merged `origin/main` commit. It creates
the private evidence-store session before opening the 30-minute window, applies
the materialized three-file selector once, and records redacted CLI stdout and
stderr on failure. A bounded read-only inventory must find all 30 named schema
dependencies before the single Q1-Q8 preflight. The one read-only control-state
canary is reachable only after full preflight PASS.

Temporary RPC-only credentials are revoked and verified in `finally`; evidence
policies and the Auth session are also closed. The attempt counter cannot exceed
one and any failure is terminal for this activation.

## Preparation evidence

- selector unit tests prove the exact order and hashes;
- manifest mutation, production selection, include-all, superseded migration
  selection and replay fail closed;
- the existing isolated PostgreSQL test proves the exact local sequence,
  95-to-98 ledger transition and Q1-Q8 PASS;
- no staging or production connection is made during preparation.

Live outcome and terminal selector closure belong in the mandatory follow-up
closeout PR, irrespective of success or failure.
