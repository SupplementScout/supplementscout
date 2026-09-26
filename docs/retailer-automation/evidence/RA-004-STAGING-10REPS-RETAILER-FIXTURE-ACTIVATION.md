# RA-004 staging 10 Reps retailer fixture activation

Date: 2026-09-26
Status: `OWNER_AUTHORIZED_PREPARED_NOT_EXECUTED`

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

- accepts the owner database URL and Supabase PAT only from process memory;
- rejects the production project, a non-owner database user, target drift,
  ledger drift, a pre-existing or ambiguous retailer and a changed migration;
- materializes only the selector-approved migration set;
- invokes exactly one Supabase CLI `db push` and has no retry loop;
- performs fresh read-only before/after snapshots;
- requires exactly one minimal `10 Reps` / `10-reps` row, with an ID different
  from production ID `14` and all optional commercial fields null;
- requires a `+1` retailer delta and zero product, variant, mapping, offer and
  price-history deltas;
- contains no canary or production action.

The Windows launcher asks only for the masked staging database URL and masked
personal access token, then clears both process variables. The publishable key
and Auth test-user credentials used by the older coordinator are neither
requested nor accepted.

## Stop and retry boundary

The executor stops before mutation on every failed precondition. Once the one
`db push` invocation begins, any failure consumes the authorized attempt. It
must not be rerun without a new explicit owner authorization. This activation
does not invoke the prior preflight/canary coordinator and does not authorize a
canary after a successful fixture application.

## Verification and execution state

The PR must pass focused selector/executor mutation tests, the isolated fixture
migration integration, Project Guardian, quick/full gates and clean detached
worktree verification before merge. Remote execution remains
`NOT_STARTED` until that independent verification and merge are complete.
