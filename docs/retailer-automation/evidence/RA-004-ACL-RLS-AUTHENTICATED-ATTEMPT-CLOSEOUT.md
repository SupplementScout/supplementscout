# RA-004 authenticated ACL/RLS staging attempt closeout

The one-shot activation ran from merged commit
`4ed68892c36e0e157d654e2777535690b6bf8cc2`. Evidence-store authentication
succeeded before the migration. The approved migration
`20260928100000_diagnose_ra004_preflight_acl_rls.sql` was applied once and the
canonical staging ledger advanced from 97 to 98 entries, fingerprint
`b4e72276ba2570d2da9957c53b6c209a3799087570302af92b295467a1d4e307`.

The single preflight captured its metadata but did not reach verified complete.
Its terminal primary failure was `RA004_REVOKED_CREDENTIAL_RECONNECTED`: the
post-revoke connection probe was accepted by the pooler. The canary was
therefore not run. No retry is authorized.

The private evidence session and execution window are closed. A separate
read-only catalogue readback confirmed temporary role `ra004_pf_20260927_a`
and all of its memberships are absent. Cleanup is therefore executively
verified despite the stale reconnect result.

The migration's guarded business-state comparison passed, production had zero
operations, and both selectors are terminally closed. RA-004 remains
`IN_PROGRESS`.
