# Automation Reliability Recovery — 27 November 2026

Owner authority: diagnose the four named incidents, implement justified local
repairs and publish one safe Draft PR with CI. No merge, deployment, production
business/control apply, new imports, migrations, membership changes or eBay API.
Baseline main: `df90bc9889f0f22fcf1dc7dfd361eba6316433cf`.
Evidence remains outside Git under
`tmp/automation-reliability-recovery-2026-11-27/` in the original repository.

## Results and release boundaries

| Incident | Finding | Status |
| --- | --- | --- |
| Review Queue Worker | Missing schedule delivery while workflow is active; runtime success does not prove cadence | PLATFORM_BLOCKED |
| Discount Supplements | Missing existing mixed-partition profile configuration; classifier IDs also needed explicit duplicate rejection | ROOT_CAUSE_FIXED_LOCALLY |
| GYM HIGH | Same reader and endpoint in both workflows; historical source unavailability, valid retained recovery and current successful local read | RUNTIME_VERIFICATION_REQUIRED |
| 10 Reps | Configured feed returns HTTP 403 with `Invalid product feed key.` | OWNER_CONFIGURATION_REQUIRED |

These statuses do not assert a production repair. Runtime verification after an
owner-approved release remains separate from local regression and read-only
source evidence. Historical failures are retained.

## Review Queue Worker

Workflow ID 355214106 is active on default branch main; repository Actions are
enabled, the repository is not archived, and cron remains `8,38 * * * *`.
No queued, in-progress or waiting run explained the missing deliveries.
Scheduled runs 45917261969 (00:31:58 UTC) and 45970291682 (09:01:44 UTC)
succeeded. Manual 45976132082 also succeeded but is not schedule evidence.
The gap preceded the later Phase 17 pause. No scheduled run after 09:01 was
listed in this recovery's readback, including after restoration to active.

Watchdog run 45963835503/artifact 15182556368 was verified against ZIP digest
`83823dc647b429a65af7304e95d1c0e7b6ec7cda6d0fac4d2f78cf312f05d5cb`.
The unchanged pure liveness function reproduces BROKEN and age
461.2072166666667 minutes at 08:13:10.433 UTC. Its current result remains BROKEN.
Thresholds 60/120 minutes and expected event `schedule` are correct and unchanged.

The missing upstream events are demonstrated; GitHub's internal delivery/drop
reason is not available through these APIs. Do not label a particular platform
incident or load condition as proven. Owner/operator action: escalate workflow
355214106 to GitHub Support with cron, default branch, active state, run IDs and
the pre-pause/post-restoration gaps. Request investigation of schedule delivery
and registration. No empty commit, preventive cron edit, replacement scheduler,
manual worker dispatch or remote configuration change is part of this repair.

## Discount Supplements

Retained failed run 46038176892/artifact 15217783355 reproduces
`Discount Supplements preflight classifier scope drifted` on baseline code.
The profile blob is identical on f7f30e58, 633a0f10 and df90bc98:
`7d7a8e53bb13b92f7d5f4216c77ce9664cd0ad6a`.
This configuration issue predates the day's migrations; the new mass-price
partition exposed it. Successful run 45867021627 had 106 executable and three
canonical reviews, so its classifier and execution scopes happened to coincide.

Actual failed partition: 109 approved identities, 72 executable, 34 MASS_PRICE
reviews and three canonical conflicts. Classifier coverage is exactly the 72
executable plus the 34 mass-price reviews. Raw classifier action statistics
(33 UPDATE_PRICE and one UPDATE_PRICE_AND_STOCK) are not execution authority;
the executable classification remains 72 VERIFY_NO_CHANGE.

Configure the existing `mixed-partition` contract and its existing MASS_PRICE /
MASS_CHANGE review reasons, as already used by Gladiator and H&B. No separate
Discount validator, count exception or new execution path is added.
The existing shared validator now explicitly rejects duplicate classifier IDs
before the exact comparison; de-duplication must not hide an extra row.

The unchanged failed artifact now passes with 72 executable / 37 review, and
the preceding successful artifact still passes with 106 executable / three
review. Neither result performs publication, approval or catalogue writes.
Permanent regressions in the existing reconciliation test file cover both the
mixed partition and missing/extra/duplicate/changed IDs, unauthorized review,
canonical or MASS_PRICE execution, action counts and partition drift. The
duplicate rejection is exercised across all five existing mixed consumers.

## GYM HIGH

Monitor 46003981589 and full catalogue 46009964284 use
`gym-high-catalogue-audit.js`, the same Store API reader, endpoint, pagination,
headers and bounds. Full catalogue fails on its initial Store API read at
13:47:24 and its live postcondition at 13:49:29 UTC. The preceding day's
45832940148 also failed; this is not a new migration regression.

The recovered report is byte-identical to monitor artifact 15201035269 and
retains capture time 13:05:24.769 UTC. The existing 24-hour guard validates its
age; recovery does not rewrite its timestamp. The 65-plan apply/DB postflight
passed, but the workflow correctly failed its final live-source check.

Current authorized local read: Store API HTTP 200, JSON, one page, 26 parents.
The full existing read-only audit subsequently returned PASS_WITH_REVIEW with
70 source rows and the same identity fingerprint. Local Windows execution uses
the existing system CA option; TLS verification stays enabled.

Historical error text does not retain HTTP status/content type, so a specific
WAF, cache or hosting rule cannot be proven retrospectively. Current success
does not prove GitHub runner availability. No reader, timeout, retry, recovery
policy or remote security setting is changed. Operator action: inspect hosting /
CDN logs for `/wp-json/wc/store/v1/products?per_page=100&page=1` at the two failed
UTC times and confirm the agreed machine access returns HTTP 200 JSON with
pagination headers. A later natural read-only source-monitor run can supply
runner evidence; no production full catalogue dispatch is authorized here.

## 10 Reps

Successful 45811110288 returned HTTP 200 CSV. Failed 45990501978 stopped in
SOURCE_FETCH with HTTP 403 before approvals/apply, before the day's migrations.
The configured local endpoint now returns HTTP 403, text/plain, nginx, with
the exact body `Invalid product feed key.` Query parameter values are redacted
from evidence. GitHub artifacts redact their URLs, so equality of their secret
key values with the local value is not asserted.

Owner/operator action: obtain the currently valid product-feed key through the
retailer's agreed secure channel, then reconcile `TEN_REPS_FEED_URL` in the
appropriate GitHub production-readonly secret and existing local configuration.
Credential changes require separate authorization. No key was changed and no
access restriction was bypassed. Retry counts and the CSV reader remain intact.

Draft message for the retailer; not sent:

> Our agreed product CSV feed is returning HTTP 403. The current response is
> "Invalid product feed key." Our last successful GitHub read was 26 November;
> the 27 November run failed before any import. Please confirm the authorised
> feed endpoint and supply a valid feed key through our agreed secure channel,
> including any required machine-access configuration. We use GET with
> Accept: text/csv and do not follow redirects.

## Preservation and validation

Production read-only: 273 migrations, pending 0, fingerprint
`9ca37b4d56ca2815b01eb48bd4d01c37db9e06b46d4cb0c0cec2fa90673bd25b`.
STAGING remains 120 with the same three pending and exclusions. eBay stays
version 3/count 322, fingerprint
`a3b46e5618036dd30079173f15fc16c488339fcfaabc60aed9d2e162988e3148`.
All 85 additions and 237 legacy identities/EPN bindings are preserved. No eBay
API call, import, identity correction, approval/apply or membership edit occurs.

Later Simply/6 Pack/Gladiator/H&B artifacts are assessed only for the existing
backlog, with a scoped read-only DB query and unchanged pure watchdog policy.
No global watchdog or Predators integration is run. Successful execution does
not erase unresolved review or stale rows; no baseline is reset.

Release gates: focused regressions, Project Guardian, inventory, quick/full and
actual-head safe GitHub CI. Keep the 373-file inventory and the three historical
10 Reps v8 skips. No SQL change requires Docker/PostgreSQL integration here.
Only this exact branch's Vercel Preview is disabled before first push; main and
global project/environment settings stay unchanged. Merge and deployment remain
outside this owner's current authority.
