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
- Staging applied both migrations in order after rollback rehearsal and proved
  the exact read-only output, ACLs and zero business writes.
- Production schema/readback passed. Monitor, schedule and public activation
  remain separately controlled.

## Local verification

- `npm run verify:project`: PASS.
- `npm run verify:quick`: PASS, including automatic-candidate, release-gate,
  admin-monitor, scheduled-audit and migration-selector regressions.
- `npm run verify:full`: PASS, including the Next.js production build and the
  new authenticated `/admin/deals-monitor` route.
- `git diff --check`: PASS.
- The PostgreSQL integration fixture covers automatic admission of a future
  Jon's offer, discovery-only treatment of an equally qualified Fit House
  offer, exact ACLs and zero business-row changes. The local Docker daemon was
  unavailable. In manual integration run `37936072454`, the exact combined
  Stage 3 database subtest passed (`ok 34`, 3.52 seconds). The wider historical
  integration suite still reported four unrelated pre-existing fixture
  failures, so this is not recorded as a whole-suite pass and does not
  authorize schema deployment.

## Staging verification

- Rollback rehearsal: PASS for both exact migrations; catalogue counts stayed
  `974/1981/1974/1973/1984`.
- Apply: PASS; staging ledger advanced from `100` to `102` with fingerprint
  `39f6e622120b0002a0019eb6f535eb303e7b58269705d0ae9ec2e89de5176a14`.
- Independent postflight: PASS with the same counts and zero writes.
- Separate repeatable-read inventory readback: PASS. Staging has no Jon's
  producer fixture, so zero candidates and zero released retailers are the
  expected result. The service role can execute only the RPC; public roles
  cannot execute it or read the release table.
- At that staging checkpoint, no production migration or flag activation had
  occurred.

## Production verification

- Rollback rehearsal: PASS for both exact migrations; catalogue counts stayed
  `1337/3632/3758/3758/30146`.
- Apply and independent postflight: PASS; production ledger advanced from
  `233` to `235` with fingerprint
  `396018525843a13082b1db09377e1469f2efc8f41bb2adfe252d0818634bcbe3`.
- Separate repeatable-read inventory readback: PASS. It returned exactly two
  released Jon's candidates, offers `1337` and `1339`, one exact Jon's release
  registry row, no awaiting retailer approvals and zero writes.
- The service role can execute the two evidence RPCs. Anonymous and
  authenticated roles cannot execute them, and no application role can read
  the private release table directly.
- Catalogue and price-history counts were identical before and after readback.
- Monitor, daily schedule and public-release flags remain off.
