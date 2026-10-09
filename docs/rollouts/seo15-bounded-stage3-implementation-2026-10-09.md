# SEO-15 bounded Stage 3 implementation — 2026-10-09

## Approved scope

- Retailer: Jon's Supplements (`retailer_id = 10`).
- Offers: `1337` and `1339` only.
- No new retailers, historical backfill or catalogue/offer writes.
- No public release before the final control.

## Prepared implementation

- `/deals` can read a narrow, service-role-only evidence function and show verified tracked price drops.
- The public section is fail-closed and remains hidden unless `SEO15_STAGE3_ENABLED=true` and every current evidence check passes.
- Migration `20261009140000_add_seo15_bounded_stage3_evidence.sql` is applied and verified on staging and remains pending for production. Its SHA-256 is `f233c07c7f0f4095ead851720bf562910c157bc0dc79e5fe6f5d4ed89ea575bb`.
- The function is read-only, restricted to the two approved offers and executable only by `service_role`.
- A bounded rollback removes only the new evidence function.

## Local evidence

- `npm run verify:project` — pass before implementation.
- Focused Deals tests — 13/13 pass.
- Project Guardian tests — 9/9 pass.
- Migration selector tests — 73/73 pass.
- TypeScript — pass.
- `npm run verify:quick` — pass.
- `npm run verify:full` — pass, including the production Next.js build.
- The disposable PostgreSQL integration was skipped locally because Docker is unavailable. In isolated CI run `37931322821`, the bounded Stage 3 database subtest passed against PostgreSQL: exact two-row output, zero business writes and the restricted permission matrix all passed. The full legacy integration batch remained red on four unrelated pre-existing tests (Predators Gear, nutrition provenance and two expired-approval ledger counters); they are outside this approved scope and were not hidden or weakened.

## Required final control before publication

1. Merge only after all required PR checks are green and the bounded database integration subtest has passed.
2. Apply the exact migration to staging and verify its read-only result with zero writes. Complete: staging has no Jon's fixture data, so the combined automatic inventory correctly returned zero candidates while its schema and ACL contracts passed.
3. Apply the same exact migration to production and repeat the read-only verification.
4. Enable the public flag only after a separate final owner decision based on those controls.

Until step 4, deploying the code does not publish the new section.
