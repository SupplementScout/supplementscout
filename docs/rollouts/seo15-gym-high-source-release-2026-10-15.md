# SEO-15 GYM HIGH source release — 15 October 2026

**State:** production applied and independently verified

**Authority:** `owner-chat-2026-10-14-end-gym-high-owner-deferred`

**Base:** `e8fee0568be87a1a68865f36d2e11ae1a6d53cfc`

## Scope

Release only the already enabled GYM HIGH observation producer into the existing
private SEO-15 automatic-candidate inventory. This does not create a public
route, change the indexability lifecycle, enable `SEO15_STAGE3_ENABLED`, backfill
history or change catalogue, offer, price or identity data.

The implementation reuses `price_observation_producers`,
`seo15_stage3_retailer_releases` and the existing candidate-inventory RPC. It
adds no table, RPC, importer, executor or retailer-specific branch in shared
runtime code.

## Fresh production preflight

The repeatable-read, read-only audit was captured at
`2026-10-15T12:20:26.941548+00:00` with `database_writes=0`. Its local artifact
SHA-256 is
`de982ef2ab10738f4bc903e6740b55070f7cda3f4968392ea029574182581756`.

- Production had `813` identity series, `30,673` identity-linked observations
  and `34,823` total price-history rows.
- GYM HIGH had exactly `50` series and `1,966` proven observations. Every series
  had at least three observation dates and passed both 14- and 30-day age gates;
  none was quarantined.
- `26` series were currently eligible. No GYM HIGH row qualified as a historical
  drop, so releasing the source was expected to add no immediate candidate.
- The producer was exactly retailer `1`, slug `gym-high`, source
  `gym-high-reviewed-full-catalogue-v1`, scope `reviewed-66`, technically capable
  and enabled, with `public_use='owner-deferred'` and
  `terms_mode='standard-single-purchase-only'`.
- Candidate inventory remained exactly two released Jon's candidates, zero
  awaiting approval and one released retailer before the change.

## Guarded migration package

- Migration:
  `20261015130000_release_gym_high_seo15_stage3_source.sql`, SHA-256
  `ccceccaffb4fc725d3d0d00515d5be6f2ede43aa65077d7abd97fc2e3b57b235`.
- Symmetric rollback:
  `20261015130000_release_gym_high_seo15_stage3_source.sql`, SHA-256
  `22a8ea84f5a1e6b35e20f8eac1fbc65c749837d3bdd88c104dff638dc801599e`.
- The production selector admits exactly this one pending migration from ledger
  `236`; staging excludes the same SHA-bound production-only file.
- The migration requires the exact producer state, exactly one pre-existing
  Jon's release, exactly 50 mature non-quarantined GYM HIGH series and unchanged
  business/candidate counts. It changes only GYM HIGH `public_use` and inserts
  the exact GYM HIGH source-release row.

## Verification

- Focused contract tests: `70/70` passed.
- `npm run verify:quick`: passed; Project Guardian retained one active SEO task,
  `SEO-15`.
- `npm run verify:full`: passed, including TypeScript, ESLint, the sealed test
  inventory, migration validation and the Next.js production build.
- The local PostgreSQL integration fixture was unavailable because the Docker
  daemon was not running. This was not counted as a pass. The production-schema
  rollback rehearsal below supplied the stronger state-specific check.

The existing selected-migration runner then rehearsed the exact package against
production in one transaction and rolled it back. Result: `PASS`, confirmation
fingerprint `1ec9a03651428e9f`, `committed=false`. Catalogue counts were unchanged
inside the transaction and after rollback:

| Table | Before | Rehearsed | Expected |
|---|---:|---:|---:|
| products | 1,337 | 1,337 | 1,337 |
| product_variants | 3,632 | 3,632 | 3,632 |
| retailer_products | 3,758 | 3,758 | 3,758 |
| offers | 3,758 | 3,758 | 3,758 |
| price_history | 34,823 | 34,823 | 34,823 |

The existing private Review Queue schema and anon/authenticated denials also
remained intact. No production write was committed.

## Production apply and independent readback

PR `#347` passed all required checks and merged as
`a7ff61e1ab9a8aa110fa9a82ff63318e30c98413`. Main Project Guardian, Baseline
Validation and Quality Gate run `38736396533` passed. A final rollback-only
rehearsal from that exact merge commit passed before apply.

The existing selected-migration runner then committed exactly migration
`20261015130000_release_gym_high_seo15_stage3_source` with confirmation
fingerprint `1ec9a03651428e9f`. Production advanced from ledger `236` to `237`,
fingerprint
`1272bbbbca81609d1278bc31dd9015710d0dffc2fa5c48fa8345bb5e63010747`.
Catalogue counts remained `1337/3632/3758/3758/34823`.

Independent `verify-selected-migrations.js` readback passed in a read-only
transaction with the same ledger, fingerprint, migration identity, counts and
private schema checks. A separate repeatable-read SEO-15 audit captured at
`2026-10-15T12:43:39.479963+00:00` also reported `database_writes=0`; artifact
SHA-256:
`b351f5357f4e436443cc572bff8960d54d1fb4d22b45ab12b9dc018272f87330`.

- GYM HIGH is now `public_use='eligible-after-separate-approval'` with exactly
  `50` series, `1,966` proven observations, `26` currently eligible series and
  zero threshold-qualified drops.
- Released retailer count is exactly `2`, while the inventory remains exactly
  the same two released Jon's candidates (`1337`, `1339`) and zero awaiting
  retailer approvals. No GYM HIGH candidate was invented by the release.
- The public Stage 3 flag remains off. The `12 products / 30 offers / 4
  retailers` gate and its separate owner decision remain binding.

The remaining closeout is repository-only: seal ledger `237` in the selector
and canonical plans so the applied migration cannot be selected or replayed.
