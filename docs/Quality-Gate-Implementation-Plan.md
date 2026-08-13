# SupplementScout Quality Gate

**Status:** local implementation verified; GitHub integration evidence pending  
**Scope:** deterministic repository verification only  
**Authority:** this is a technical execution record, not a second product or SEO roadmap. The Operating Plan and SEO Execution Plan remain authoritative.

## Goal

Provide one repeatable local and GitHub Actions quality gate that reuses the
existing Project Guardian, baseline validator, lint, TypeScript, build and test
files. It must fail closed when the test inventory changes and must never
receive production-write credentials.

## Boundaries

- Do not change catalogue, offer, retailer, SEO-page or production behaviour.
- Do not replace existing tests or workflows.
- Do not introduce another agent role or test framework.
- Do not make network or production checks part of the required deterministic gate.
- Record unrelated failures as follow-up work; do not expand this task silently.

## Test classification

The sealed inventory is stored in `scripts/quality-gate-manifest.json`.

- `quick`: small representative smoke suite used during normal implementation.
- `safe`: every inventoried test not classified as integration; runs without production-write credentials.
- `integration`: Docker/local-database or subprocess-heavy tests, run separately.

The manifest stores the exact count and SHA-256 fingerprint of every
`scripts/**/*.test.js` path. Adding, removing or renaming a test without
reviewing the manifest fails before tests run. There is no silent default for a
changed inventory.

## Commands

```text
npm run verify:inventory    # classification only
npm run verify:quick        # Guardian, TypeScript, lint, smoke tests
npm run test:safe           # all non-integration tests
npm run verify:full         # Guardian, TypeScript, lint, safe tests, baseline, build
npm run verify:integration  # isolated Docker/local-database tests
```

## Automation

- Pull requests and pushes to `main`: `verify:full`.
- Manual dispatch: choose `full` or `integration`.
- Weekly schedule: `verify:integration`.
- A push that changes the quality-gate workflow itself also bootstraps the
  integration run, so workflow changes receive live evidence without secrets.
- Workflow permissions are read-only and no production secrets are supplied.

## Definition of done

- [x] Inventory accounts for every test and rejects unreviewed changes.
- [x] Quick gate passes locally.
- [x] Full gate passes locally.
- [ ] Integration gate passes in its isolated supported environment.
- [x] GitHub workflow covers pull request, `main`, manual and scheduled runs.
- [x] Agent instructions require quick verification after code changes and full verification before completion.
- [x] Project Guardian still passes after all documentation changes.
- [ ] Live GitHub Actions evidence is recorded before this document is marked complete.

## Local evidence — 13 August 2026

- Inventory: 260 tests, including 220 safe and 40 integration-classified tests;
  the inventory contract tests passed 5/5.
- `npm run verify:quick`: PASS, including 176 smoke assertions.
- `npm run verify:full`: PASS. All 220 safe test files passed in controlled
  batches, TypeScript passed, ESLint returned zero errors and ten existing
  warnings, baseline validation passed with 116 post-baseline migrations, and
  the Next.js 16.2.9 production build passed.
- The isolated build used loopback Supabase placeholders and no production
  credentials. Expected connection refusals exercised the application's safe
  degraded-data rendering without failing the build.
- Full verification exposed two stale test assumptions: Creatine fixtures still
  encoded the retired short freshness window, and one Fit House migration test
  expected 108 rather than the current sealed 110-entry production ledger.
  Only those expectations were aligned with the already-authoritative current
  policies; application and production-data behaviour were not changed.
- Local integration execution is unavailable because the Docker daemon is not
  installed/running in this workspace. The 40 isolated tests remain assigned to
  the Linux GitHub runner and must pass there before final completion.
