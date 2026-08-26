# Jon's Supplements exact-pack evidence audit

Status: `PARTIAL`

This package records the read-only SEO-15 Stage 2A audit and the owner's manual
review of the 88 Jon's offers skipped by the observation producer. It does not
authorise a migration, backfill, workflow run or production write.

## Result

- Audit-start production binding: 88 offers, 88 mappings, 88 canonical products and 88
  canonical variants; there are no duplicates in the audited scope.
- At audit start every audited canonical variant had `pack_count`, `size_value`
  and `size_unit` equal to `NULL` in production.
- Owner input proposed 87 candidate exact packs for evidence processing and
  deferred one row; exact evidence later cleared 85 and exposed two conflicts.
- Deferred row: offer `1459`, mapping `1645`, product `925`, variant `1531`,
  Himalaya Liv.52 DS 60 Tablets. The available instruction is variable (one to
  two tablets twice daily) and does not establish one exact serving count.
- The evidence-backed execution moved coverage from `418/506` to `503/506`.
  The theoretical `505/506` ceiling still requires corrected owner decisions
  for the two conflicting rows; it was not treated as achieved.
- The complete ordered list and candidate fields are in
  `all-88-decisions.json`; the production-bound simulation is in
  `read-only-dry-run.json`.

## Evidence availability and conflicts

Seventy-two approved candidates have no additional special gate recorded after
the source and owner review. Fifteen approved candidates retain a special gate:

- exact variant or label binding: offers `1024`, `1447`, `1448`, `1091`,
  `1195`, `1481`, `1492`;
- current Jon's variant absent, requiring manufacturer or preserved retailer
  evidence: offer `1468`;
- source conflicts requiring explicit reconciliation: offers `1096`, `1069`,
  `1094`, `1434`, `1451`, `1472`;
- source conflict already visually resolved but still requiring the exact image
  reference in the execution package: offer `1449` (Icy Blue Razz, 165g).

No special-gate row is eligible for apply merely because the owner supplied a
value in chat. The later execution package must bind the exact evidence and
expected current database state.

## Canonical sharing audit

Sixty-three audited variants are mapped only to Jon's. Twenty-five are shared
with at least one other retailer; 24 of those are approved candidates and the
remaining shared row is deferred offer `1459`.

The 24 approved shared offers are:

`1024`, `1065`, `1018`, `1023`, `992`, `1066`, `1069`, `1071`, `1074`,
`1075`, `1082`, `1083`, `1085`, `1086`, `1091`, `1099`, `1106`, `1107`,
`1108`, `1109`, `1195`, `1463`, `1469`, `1471`.

A shared canonical variant can be completed in place only if the other mapped
retailer evidence proves the same commercial pack. If it does not, the safe
existing route is to create or reuse an exact canonical variant and atomically
rebind only the Jon's mapping and offer. Updating a shared default variant from
Jon's evidence alone is prohibited.

## Existing approved implementation route

Do not add a new importer, admin form, recorder contract or workflow. Reuse the
existing guarded catalogue-migration patterns:

- `supabase/migrations/20260731120000_correct_jons_two_default_flavour_variants.sql`
  and its contract in `scripts/jons-offer-refresh.test.js` for exact,
  preconditioned variant-only corrections;
- `supabase/migrations/20260810240000_create_reviewed_jons_17_explicit_variants.sql`
  and `scripts/jons-reviewed-17-explicit-variants.test.js` when an exact variant
  must be created and Jon's must be rebound without changing another retailer;
- `scripts/apply-selected-migrations.js` for the existing target-attested
  migration selection path;
- `.github/workflows/jons-offer-refresh.yml` and
  `scripts/jons-offer-refresh.js` only after a separately authorised apply, to
  obtain the first post-change daily confirmations. They are not part of this
  read-only audit.

The generic `scripts/import-products.js` feed path is not the correct tool for
blindly updating these existing shared default variants. It remains useful for
its established evidence and atomic-plan contracts, but no competing write
path should be created for this task.

## Smallest safe later execution batches

1. Canary: five Jon's-only, source-aligned variants with exact before-state
   fingerprints. Validate only `product_variants` changes and zero mapping,
   offer, price-history or observation changes.
2. Remaining Jon's-only candidates: bounded batches of at most ten, grouped by
   evidence type (grams versus servings), with the same preconditions.
3. Shared variants: one evidence-reviewed family at a time. Update in place
   only with cross-retailer exact-pack proof; otherwise use exact-variant
   creation and Jon's-only rebind.
4. Conflict rows: one row at a time after the named evidence gate is closed.
5. Keep offer `1459` blocked. Do not substitute tablet count, daily supply or a
   product-name number for an exact serving count.

One approval may cover the whole reviewed stage, but execution and validation
must retain these bounded atomic partitions. This is one evidence plan, not
multiple implementations.

## Source-of-truth recording

The owner authorized these updates after the first successful Jon's producer
run and the five-row canary confirmation. The same reviewed release now
updates:

1. `docs/SupplementScout-Operating-Plan-2026-07-15.md`: advance the status date
   and add a binding checkpoint recording scheduled run `32812270590`, success,
   `506/506` scope, 418 identity series, 418 identity-proven daily
   confirmations, 88 fail-closed skips for
   `MISSING_OR_CONFLICTING_EXACT_IDENTITY`, Jon's enabled, the other six
   producers disabled, GYM HIGH owner-deferred, and Stage 3/public price-drop
   claims disabled.
2. `docs/SEO-Execution-Plan.md`: update SEO-15's definition/current-task text
   from all producers disabled and zero observations to the same first-run
   evidence, while keeping SEO-15 `IN PROGRESS`, public Stage 2 blocked pending
   accrual, and Stage 3 not started.

`npm run verify:project` passed before and after the ledger edits. SEO-15 stays
`IN PROGRESS`; public Stage 2, Stage 3 and public price-drop claims remain
disabled.

## Execution checkpoint — 26 August 2026

The audit remains `PARTIAL`: 85 of the 88 originally skipped offers now have
explicit or exactly rebound exact-pack variants and identity-proven daily
confirmations, while three remain fail-closed. The existing approved path was
reused; no importer, admin form, recorder contract or parallel pricing store
was added.

- canary run `32883838868`: `418/506` to `423/506`;
- reviewed servings run `32886482475`: `423/506` to `433/506`;
- final evidence-ready run `32888613481`: `433/506` to `439/506`.
- ordinary reviewed run `32892293918`: `439/506` to `490/506`;
- special-evidence run `32915426696`: `490/506` to `503/506`.

The latest successful run covered `506/506`, classified 504 rows as
`VERIFY_NO_CHANGE`, applied two source-proven stock transitions, recorded 503
daily confirmations and passed a fresh zero-write idempotency check.
Independent readback confirmed 503 current exact mappings, 503 matching
identity series, 503 daily confirmations, no duplicate current series and no
series for other retailers. Only Jon's producer is enabled; the other six
remain disabled.

The three remaining blockers are exact and must not be inferred:

- offer `1024`: owner-entered 60 servings conflicts with manufacturer evidence
  for 240 capsules, eight capsules per serving and 30 days;
- offer `1451`: owner-entered `1 x 500g` conflicts with the exact variant image
  showing two 250g pouches;
- offer `1459`: variable one-to-two-tablet directions do not prove one exact
  servings-per-container value.

Any later closure must reuse the same evidence manifest → bounded exact-variant
migration/Jon's-only rebind → selected rehearsal/apply → Jon's workflow →
independent readback path.
