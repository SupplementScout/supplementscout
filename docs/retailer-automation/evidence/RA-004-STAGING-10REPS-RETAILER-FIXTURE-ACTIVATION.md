# RA-004 staging 10 Reps retailer fixture activation

Date: 2026-09-26; executed and verified 2026-09-27
Status: `STAGING_VERIFIED_COMPLETE`

## Exact authorization

Marek authorized one separate PR that activates only
`20260926100000_create_ra004_staging_10reps_retailer.sql` on the persistent
staging project, followed by exactly one application attempt after independent
verification. Production and any canary retry are explicitly not authorized.

The activation is bound to migration SHA-256
`2948af2c348ebf7cca56b2f46966a393ad022bd4cbfef0876ac9bc899a92ba0e`,
project `hxnrsyyqffztlvcrtgbf`, the exact 94-row pre-activation ledger and the
exact expected 95-row post-activation ledger. Seven unrelated pending
migrations remain deferred.

## Prepared mechanism

The machine-readable activation record is
[`RA-004-staging-retailer-fixture-activation.json`](RA-004-staging-retailer-fixture-activation.json).
The selector accepts that record only from the frozen pre-activation ledger and
selects exactly one migration. Ordinary staging selection expects the fixture
to be present only after activation; production selection remains unchanged.

The one-shot executor:

- accepts the owner database URL only from masked process memory;
- rejects the production project, a non-owner database user, target drift,
  ledger drift, a pre-existing or ambiguous retailer and a changed migration;
- materializes only the selector-approved migration set;
- invokes exactly one direct-database Supabase CLI `db push` and has no retry
  loop; the password-free URL is passed as an argument and the password remains
  only in the child process `PGPASSWORD` environment variable;
- performs fresh read-only before/after snapshots;
- requires exactly one minimal `10 Reps` / `10-reps` row, with an ID different
  from production ID `14` and all optional commercial fields null;
- requires a `+1` retailer delta and zero product, variant, mapping, offer and
  price-history deltas;
- contains no canary or production action.

The Windows launcher asks only for the masked staging database URL and then
clears it. A Supabase personal access token, publishable key and Auth test-user
credentials are neither requested nor accepted.

## Management API transport repair

The first operator runs stopped during Supabase CLI `link` because CLI 2.111.0
could not complete the Management API request. The selected worktree had no
link metadata, `db push` was never invoked and no remote write started, so the
one authorized application attempt remains unused.

The repaired path does not weaken target checks or use a direct SQL write. It
keeps the reviewed Supabase migration executor but selects its documented
`--db-url` transport. A local password-protected PostgreSQL 17 dry run proved
that CLI 2.111.0 connects with a password-free argument and `PGPASSWORD`; the
same test failed closed when only `SUPABASE_DB_PASSWORD` was supplied. No PAT or
Management API call is needed.

PR #102 at head `bd7e20783cfc02d0e6dce74a268eaab535dcef73` passed
independent verification in a new detached worktree: focused executor tests
`7/7`, the networkless PostgreSQL fixture integration `1/1`, Project Guardian
and `verify:full`, including the production build. GitHub Quality Gate run
`36295456971`, Project Guardian run `36295456980`, Vercel and GitGuardian all
passed. The PR was squash-merged as
`1d24497897ecec25c95cd1f3cd32171c0412db23` before execution.

## Stop and retry boundary

The executor stops before mutation on every failed precondition. Once the one
`db push` invocation begins, any failure consumes the authorized attempt. It
must not be rerun without a new explicit owner authorization. This activation
does not invoke the prior preflight/canary coordinator and does not authorize a
canary after a successful fixture application.

## Verified staging result

The one authorized application attempt was consumed on 27 September 2026 from
the exact merge commit. A separate fresh read-only transaction then returned
`RA004_READ_ONLY_VERIFICATION_PASS` and proved:

- the migration ledger advanced from the authorized 94-row state to exactly 95
  rows;
- its fingerprint is exactly
  `c5bb6405d26def1834522cccaf2937fad60f44156370e5e1f8c4af3ff96d45bd`;
- exactly one minimal retailer row exists with ID `11`, name `10 Reps`, slug
  `10-reps` and all optional commercial fields null;
- production actions: `0`;
- canary actions: `0`.

The migration is transactional and contains no product, variant, mapping,
offer or price-history write. Its isolated PostgreSQL proof confirms the same
minimal delta and production rejection. The authorization is now consumed;
rerun is not authorized. This closes only the staging fixture activation and
does not authorize the canary, shadow pilot or production.
