# SEO-15 automatic candidate inventory — 2026-10-09

## Owner-approved outcome

Stage 3 must maintain itself without a per-product offer allowlist. Jon's is the
only source-level release. A future Jon's offer may appear automatically only
when the same fail-closed historical and current-state rules pass. Candidates
from other already enabled eligible producers are visible only in the read-only
monitor until the owner approves that retailer source separately.

This decision does not authorize a new producer, retailer automation change,
history backfill, product identity decision, catalogue/offer write, schema
deployment or public activation.

## Reused architecture

- The existing identity-proven `price_history`, `price_identity_series` and
  `price_observation_producers` remain the only evidence system.
- One source-level table records explicit Stage 3 retailer releases. It starts
  with Jon's only and is inaccessible to public application roles.
- One read-only service-role RPC calculates all currently qualified candidates,
  separates released rows from retailer-approval candidates and reports zero
  writes.
- `/deals` independently revalidates every returned row and uses the existing
  one-hour lifecycle cache. No candidate result controls robots or sitemap.
- `/admin/deals-monitor` is read-only and has its own default-off flag.
- The existing SEO-15 audit workflow gains a daily schedule behind a repository
  variable and continues to use a production-readonly environment.

## Release controls

- Existing bounded migration:
  `20261009140000_add_seo15_bounded_stage3_evidence.sql`, SHA-256
  `f233c07c7f0f4095ead851720bf562910c157bc0dc79e5fe6f5d4ed89ea575bb`.
- Automatic inventory migration:
  `20261009160000_add_seo15_automatic_candidate_inventory.sql`, SHA-256
  `337b795f923fa90f77124196f75294a6281d88006c8287d1c5f2118eac2eccad`.
- `SEO15_STAGE3_MONITOR_ENABLED`, repository variable
  `SEO15_CANDIDATE_MONITOR_ENABLED` and `SEO15_STAGE3_ENABLED` remain off.
- Staging must apply both migrations in order and prove exact read-only output,
  ACLs and zero business writes before production is considered.
- Production schema/readback and public activation remain separately controlled.

## Local verification

- `npm run verify:project`: PASS.
- `npm run verify:quick`: PASS, including automatic-candidate, release-gate,
  admin-monitor, scheduled-audit and migration-selector regressions.
- `npm run verify:full`: PASS, including the Next.js production build and the
  new authenticated `/admin/deals-monitor` route.
- `git diff --check`: PASS.
- The PostgreSQL integration fixture covers automatic admission of a future
  Jon's offer, discovery-only treatment of an equally qualified Fit House
  offer, exact ACLs and zero business-row changes. The local Docker daemon is
  unavailable, so that database fixture remains a required CI result before
  any schema deployment.
