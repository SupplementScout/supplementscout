# RA-004 staging 10 Reps retailer fixture

Date: 2026-09-26
Status: `OWNER_AUTHORIZED_PREPARED_NOT_APPLIED`

## Authorization and boundary

Marek explicitly authorized one separate PR that prepares one minimal 10 Reps
retailer record exclusively for staging, independently verifies it and merges
it. The authorization explicitly excludes production, feeds, shadow execution,
plans, approvals, imports, apply and any canary retry.

This PR does not connect to Supabase, apply a migration, issue or use a
credential, or retry the RA-004 coordinator. A separately reviewed activation
and separate owner authorization remain mandatory before any remote staging
mutation.

## Existing state and incident

The authorized read-only staging diagnostic returned zero rows for the unique
10 Reps name-or-slug lookup. The previous coordinator therefore stopped with
`RA004_RETAILER_AMBIGUOUS` before migration application, credential issuance,
preflight or canary. This fixture addresses only that missing staging identity.

## Prepared change

`20260926100000_create_ra004_staging_10reps_retailer.sql` is a forward-only,
transactional migration that:

- requires database owner `postgres`;
- requires the existing trusted target attestation to resolve exactly to the
  persistent staging project `hxnrsyyqffztlvcrtgbf` and its canonical database
  identity;
- explicitly rejects the production project reference;
- takes an exclusive table lock and requires zero rows matching either the
  canonical name or slug;
- obtains the ID from the staging sequence and skips production retailer ID
  `14` if the local sequence reaches it;
- inserts exactly `name = '10 Reps'` and `slug = '10-reps'`, leaving all
  optional commercial fields null and `created_at` at its database default;
- proves one exact postcondition row before commit.

The migration is SHA-bound in both environment selector contracts and remains
excluded from ordinary STAGING and PRODUCTION deployment. It is not part of the
existing two-migration RA-004 activation manifest.

## Verification contract

The regression suite must prove:

1. exact SHA and exclusion from both ordinary selectors;
2. a single minimal row on the exact attested staging target;
3. no product, variant, mapping, offer or price-history writes;
4. a staging-generated ID different from production ID `14`;
5. fail-closed behavior for production, existing or ambiguous identity, rerun,
   target drift and postcondition failure;
6. transactional rollback of the retailer row on failure;
7. repository Project Guardian, quick and full quality gates.

## Activation boundary

Merge made only the reviewed fixture available in source control; it did not
create the remote row. Marek supplied separate authorization on 26 September
2026 for an exact SHA-bound activation PR and one application attempt after
independent verification and merge. The activation is prepared separately in
[`RA-004-STAGING-10REPS-RETAILER-FIXTURE-ACTIVATION.md`](RA-004-STAGING-10REPS-RETAILER-FIXTURE-ACTIVATION.md).
Canary remains a different authorization and is not bundled with fixture
activation.

## Local implementation evidence

- focused static and selector suite: 31/31 passed;
- isolated networkless PostgreSQL 17 integration: 1/1 passed across the exact
  staging target, reserved production ID, production rejection, ambiguity,
  rerun and rollback cases;
- `npm run verify:project`: passed before and after the execution-ledger edit;
- `npm run verify:quick`: passed, 533 passed and 3 artifact-bound skips;
- `npm run verify:full`: passed, including TypeScript, ESLint, 262 safe test
  files, baseline validation and the Next.js production build;
- no Supabase connection, secret use, remote migration, canary or remote write
  occurred.
