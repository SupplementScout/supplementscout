# Gladiator and eBay reliability recovery — 22 November 2026

Latest checkpoint, 23 November: PR565 is synchronized with released main
`ed37821ef6bd69d078e29c95cb255f55b0d165ef`; the original eBay correction is
preserved without additional runtime changes. Local gates and production
READ ONLY evidence are recorded [below](#pr565-safe-sync-and-release-readiness).
Final head-bound CI results belong in the existing Draft PR description.
No release, production apply or publication is authorized by this preparation.

Historical boundary, 22 November: read-only production audit and minimal Draft code correction only.
Main remains `c6955304074dc96ae3dd37d7c2759cb1861f1286`. No production writes,
publication, approval/apply, migration, dispatch, schedule change, merge or
production deployment was performed. The original dirty checkout is preserved.

## Decision and current offer counts

| Evidence at approximately 18:20 UTC | Gladiator Nutrition | eBay UK |
|---|---:|---:|
| Existing approved scope | 603 | 237 |
| Checked within 24 hours | 0 | 156 |
| Checked within 48 hours | 0 | 159 |
| Older than 48 hours | 603 | 78 |
| Latest source partition: executable / review | 187 / 416 | 156 / 81 |
| Latest classifier globally blocked rows | 0 | 0 |
| Active control parents | 0 | 0 |
| Current unexpired pending/approved cards | 0 | 0 |

Freshness, review and blocked counts describe different dimensions and must not
be added together. Gladiator's entire apply is blocked by binding despite zero
classifier-blocked rows. eBay's safe freshness apply works; publication is
blocked. Neither complete retailer recovery is claimed.

Production migration preflight passed READ ONLY: CURRENT270, pending `[]`,
fingerprint `ea11b69343c2100ecf38078a6920eb3b7478fc6ee4633bb65fc7657c39c2ae2a`.
No new migration is needed for either proposed code correction.

## Gladiator: existing Draft #564, no duplicated correction

[Draft PR #564](https://github.com/SupplementScout/supplementscout/pull/564)
remains OPEN/Draft at `39d606df7e21788622add0bcfb32fa74de923d4a`, based on
unchanged main. Quality Gate `45017470407` and Project Guardian `45017470419`
passed; full suite: 4142 PASS, three existing SKIP, zero FAIL. The original
incident, regression and proof are retained in that PR. Its code is unchanged
by this new task and is not copied into a second PR.

New natural run
[45043110953](https://github.com/SupplementScout/supplementscout/actions/runs/45043110953),
Gladiator job `137271716579`, independently reproduces the original failure on
22 November at 16:19:58 UTC. Dry-run and baseline PASS; source binding FAIL:
`Gladiator Nutrition preflight classifier scope drifted`; apply, postflight,
idempotency and Gladiator publication SKIPPED. H&B's separate success is not
Gladiator evidence.

Artifact `14762731452`, `gladiator-nutrition-offer-refresh-45043110953-1`, has
GitHub digest `f439e18a042e8e23f56a6733a99fe245fcd4db827e954afd5cf10658e0c55982`.
The earlier run `44923097560` and its original artifact remain retained.

The latest local legitimate neutral Shopify capture at **18:19:31 UTC** now
returns HTTP200 on its first attempt, complete short-page pagination, **161
products / 881 variants**. Fingerprint remains
`33589932d59c60ab2153e209c9a5fcce6988ada996cb2b7df2a7ad9d812960e5`, matching
today's natural source capture. All 603 approved external identities are
present; 278 unmapped variants remain report-only. Comparison with current
production confirms **416 price differences, zero stock differences and zero
source-identity mismatches**. The morning audit-environment HTTP429 is retained
historical evidence; it is not a current global source-outage claim.

Last actual production apply remains
[44576527715](https://github.com/SupplementScout/supplementscout/actions/runs/44576527715),
19 November 17:42:15 UTC: 603 freshness updates, zero price/stock/shipping/URL
changes, independent postflight and fresh idempotency PASS. All current checks
still carry `2026-11-19T17:37:47.665Z` (over 72 hours old at the evening audit).
Exact canonical identities and variant/affiliate parameters match all 603 rows.

The [official shipping policy](https://gladiatornutrition.co.uk/pages/shipping)
lists 6.99 GBP mainland standard delivery and free delivery **over** 75 GBP.
Existing code uses `>=75`. Public wording does not prove the exact 75.00 GBP
checkout boundary; no checkout, shipping-data correction or policy change is
performed. Exact boundary confirmation remains a separate owner decision.
No approved current or freshly captured Gladiator offer is priced exactly
75.00 GBP, so this wording ambiguity does not change today's observed totals.

Gladiator has 21 EXECUTED, one EXPIRED and one historical FAILED card, all
expired by timestamp. Review 2390's failed request is already closed at
`VERIFIED_ZERO_BUSINESS_WRITE_CLOSEOUT`; it is not an active blocker. No current
PRICE_OBSERVATION_DEFECT card or new stock transition was found. Do not reopen
completed onboarding, change the manifest or approve the 416 price changes.

**CODE READY:** existing #564. **PRODUCTION RECOVERED:** no — BLOCKED until an
owner-approved release and actual guarded natural execution/live closeout.

## eBay: freshness apply succeeds; one delivery-change binding blocks publication

Latest natural run
[45028324611](https://github.com/SupplementScout/supplementscout/actions/runs/45028324611)
started at 13:35:54 UTC on current main. Refresh job `137226125071` completed
actual apply at **13:45:39 UTC**, executed **156 VERIFY_NO_CHANGE** offers,
then independent DB postflight PASS at 13:45:40 and fresh-source idempotency
PASS at **13:48:32 UTC**. Exactly 156 freshness updates; zero price, stock,
shipping, URL, catalogue or price-history changes. Same-run correlated evidence
is sealed. The overall workflow failure does not negate that actual apply.

Latest completed source capture began at **13:45:40 UTC** and finished with
idempotency. All 237 approved listing observations are accounted for: 227
HTTP200 and ten row-scoped HTTP404; no global token/rate-limit/API failure.
The source partition is 156 executable and 81 held: 61 identity/stock-policy
reviews, ten missing-source reviews and ten commercial price reviews. Ordinary
source absence does not change stock automatically.

Source artifact `14757281425`, `ebay-offer-refresh-45028324611-1`, digest
`2034100385447d0a734e7ff892935119c305499d5b02a2318ca7b57bcd2a6f24`;
publication artifact `14757246686`, `automation-review-queue-refresh-45028324611-1`,
digest `454400ad374fe2a407729f1f3d0ed962747773058d20c143fb5706e59485707d`.

Publication job `137229494011` built 79 operations (four CREATE, 74 REFRESH,
one SUPERSEDE), then failed at **13:49:48 UTC** with
`AUTOMATION_REVIEW_PUBLICATION_REFRESH_BINDING_INVALID`. No publication seal
exists for its exact idempotency key. The atomic publication did not partially
publish the other operations. The preceding natural run `44910207519` passed
both refresh and publication on 21 November; publication is not permanently
disabled or absent.
That publication completed at14:01:39 UTC: one CREATE,74 REFRESH,one SUPERSEDE,
zero catalogue writes. These are prior-run results, not this session's actions.

The exact failing row is offer **2739**, review **7584**. Its protected source
plan changes item price **21.95 → 21.90 GBP** and delivery **2.99 → 2.50 GBP**.
The producer calls it UPDATE_PRICE. The existing SQL refresh contract requires
unchanged shipping for that operation. Six other commercial REFRESH bindings
match the contract and current DB; this row alone violates it.

This was proven without invoking the publisher: the actual deployed function's
guard expression was extracted and evaluated as SELECT in a READ ONLY
transaction against all seven commercial bindings. Only review7584 returned
`blocked_by_actual_live_guard=true`. All seven protected before-states match
the current database. The SQL guard is correct and remains unchanged.

All 237 canonical variant bindings are present and active. Affiliate listing
paths, variation IDs and campaign parameters are preserved. Five of the ten
missing-source rows (2637,2638,2681,2708,2770) have external IDs differing from
the historical exact source scope; all remain excluded from apply. No identity
or listing replacement is inferred or authorized. Current held prices, stock
and delivery must not be described as refreshed. The shipping-change row and
the other commercial/identity/source cases require fresh owner review.

Older fixes are merged and ancestors of current main: #480 combined price/stock,
#482 shared pending binding/migration, #487 affiliate URL binding, #488 publication
success closeout, and #490 decimal normalization. Their repaired incidents are
not reimplemented. Ledger270 confirms the relevant migrations are applied.

### Narrow new correction

After normal exact-scope/numeric plan validation, the existing eBay preparer
isolates **any shipping delta**, including a decrease, as SHIPPING_POLICY_DRIFT.
It reuses the existing shared POLICY_REVIEW / MANUAL_REVIEW definition; the
card says KEEP_UNCHANGED and has no execution binding. Source evidence records
the expected and observed offer, and the existing semantic fingerprint includes
the actual policy reason. No historical fingerprint is edited and no global
fingerprint algorithm is changed. Unrelated source identities and ordinary
price/stock paths retain their contracts. The SQL shipping guard is not relaxed.

This prevents one unsupported commercial row from aborting an otherwise valid
publication. It does not approve a delivery, price or stock change. New capture
and new reconciliation are required after release; the failed request must not
be edited or replayed as a newly generated request.

The incident's price/delivery values and 237-row isolation are covered in the
existing eBay suite; the regression fails on main (three commercial reviews
instead of two in the controlled fixture) and passes after correction.
Reconciliation coverage proves a non-executable policy card, source evidence,
supersession of the previous pending problem, repeated-publication idempotency
and rejection of unknown policy classes. Focused cross-retailer suites pass
303/303. Local verify:quick PASS (1369 passed, three existing skips, zero
failures); verify:full PASS (4141 passed, three existing skips, zero failures),
including TypeScript, ESLint, migration-baseline validation and production build.
Four existing unrelated lint warnings remain. Project Guardian passed before
and after evidence updates. The existing371-file test inventory seal was
reviewed and verified unchanged; no test file was added/removed/renamed.
No SQL changed; isolated database integration was not required for this
classification correction. Final CI evidence belongs in the Draft PR description.
Replaying the actual archived offer2739 plan through the corrected preparer
also returns POLICY_REVIEW/SHIPPING_POLICY_DRIFT with no approved executable
plan and preserves2.99/2.50 shipping evidence. This is offline reproduction,
not a new source capture or production execution.

**PRODUCTION RECOVERED:** no — publication remains BLOCKED; safe freshness
refresh is independently PASS_WITH_REVIEW. No new SQL or production config is
needed for this defect.

## Review Queue health and independent monitoring findings

The real deployed application loader and health-counter loader were exercised
through their existing service-role RPC inside READ ONLY. Current queue contains
1221 latest records; list pages1/2 return50 each without duplicates; eBay current
view153 rows, historical view500; Gladiator current view21; REVIEW_ONLY filter694;
pending filter415; technical filter399. Counts and lifecycle summaries agree.
Calls measured73–497ms normally; the historical view was1097ms in this small
audit, including network latency. These are observations, not a load benchmark.
No public browser/admin-session verification is claimed.

Catalog Health correctly reports zero **current** pending/source-unavailable/
blocked tasks for eBay and Gladiator. eBay raw75 PENDING and three APPROVED
cards have expired; the latter are old owner decisions on2695,2704,2744. There
are no active execution requests; two old eBay failures are terminal, not
permission to retry. The failed new publication explains missing current cards;
the main SQL reader is not generally failing. The failed request is not a safe
publication authorization pack.

Latest natural watchdog `44994261610` ran at06:33, before today's eBay apply;
it records eBay PASS_WITH_REVIEW against21 November run44910207519. A later
watchdog has not yet confirmed today's result. Its independent Discount
freshness/backlog and Simply backlog failures are retained, outside these fixes.
Gladiator stale/incomplete evidence is a real additional failure. No watchdog
threshold, policy, capability or guard is changed.

## Small owner-controlled next phase

1. Separately authorize controlled code release of exact reviewed #564 and the
   new narrowly scoped eBay Draft revision, after fresh main/CI/diff/ledger checks.
   These are separate defects; no unified runtime or migration is proposed.
2. Require new complete source evidence and current DB/control/decision readback.
   Respect any 429, expired decision, identity drift or changed SHA. Do not reuse
   today's archived request as fresh authorization.
3. Allow only the existing protected natural refresh/publication paths under
   that separate authorization. Preserve all unsafe rows for review. Any price,
   shipping or external-identity decision needs its own exact fresh owner scope.
4. Require actual apply, independent postflight, fresh idempotency, successful
   queue publication/readback and a subsequent natural watchdog before declaring
   production recovery. Do not change schedules or invoke a write workflow here.

Full two-retailer closeout / First100 sprint readiness is **NO-GO** until this
limited recovery is verified. Audit and Draft readiness do not mean production
has recovered. No further architecture project is proposed.

## PR565 safe sync and release readiness

23 November 2026. Owner scope: update only the existing Draft565 branch after
PR564 release, retain both fixes and their histories, verify release readiness.
No production workflow, source API capture, publication, approval, apply,
migration, production deployment or PR merge was performed.

### Exact synchronization and preserved architecture

Remote main was rechecked as `ed37821ef6bd69d078e29c95cb255f55b0d165ef` and Draft565
as `25f70336a048c5fd708da53268dc130c7b5d5154`. Main was merged into that existing
branch without rebasing or rewriting its original commit. The only content
conflict was the two independent insertions at the top of EXECUTION-PLAN.md;
both dated histories were retained. The shared profiles and reconciliation
tests merged without a code conflict. The original dirty checkout and the
Gladiator verification worktree were not edited.

The diff against new main still contains exactly seven files: three existing
runtime modules, two existing test files and two documentation files. Added
and removed code/test lines are identical to the original565 correction;
only their base now includes released564. There is no new runtime change.

All nine shared publication profile definitions, including their function
bodies, were compared with main after normalizing Windows line endings:
identical. The shared profile module only adds the existing policy export.
Gladiator retains full603 scope, MASS_PRICE/MASS_CHANGE isolation, and the
HARD_PRICE_ANOMALY/CANONICAL_IDENTITY_CONFLICT policies. 10Reps retains
OWNER_AUTHORIZED_ARTIFACT_ONLY. Fit House, H&B, Discount, Whey Okay and Jon's
profiles are unchanged; Simply's separate existing runtime is untouched.
All config, SQL, app, workflows, dependencies, shared engine, publisher RPC,
consumer, eBay worker/source reader, control ledger and sealed-artifact paths
are unchanged relative to main. No new thresholds, cron or product exception.

Earlier eBay fixes were independently checked as merged ancestors of main:
#480 `68c528ae` (combined price/stock), #482 `0d896076` (pending binding),
#487 `fd323ca8` (execution-bound URL), #488 `190293ac` (publication evidence),
#490 `bed7a141` (decimal normalization). They are not reimplemented.
READ ONLY confirms the existing pending-binding migration
`20261105100000_refresh_pending_review_execution_binding.sql` is applied.
CURRENT270/pending=[] and fingerprint `ea11b69343c2100ecf38078a6920eb3b7478fc6ee4633bb65fc7657c39c2ae2a`
remain authoritative; no SQL change is proposed.

### Incident regression and production readback

The exact archived artifact from [run45028324611](https://github.com/SupplementScout/supplementscout/actions/runs/45028324611)
was downloaded and replayed offline through both actual preparers. For offer2739,
review7584, item21.95 to21.90GBP and shipping2.99 to2.50GBP, current main returns
an UPDATE_PRICE candidate; the unchanged565 correction returns POLICY_REVIEW /
SHIPPING_POLICY_DRIFT / MANUAL_REVIEW without an approved executable plan.
Canonical identity and original affiliate parameters are preserved. The archive
is historical, expired evidence, not a new capture or authorization to retry.

Existing reconciliation regression confirms KEEP_UNCHANGED, no execution
binding, safe supersession, fingerprint separation, repeated-publication
idempotency and unknown-policy rejection. Existing price-only, stock-only and
combined price/stock tests still pass with the strict shipping/identity guards.
The correction is generic to a validated delivery delta; offer2739 appears only
as incident evidence/test data, never as a runtime exception.

Fresh READ ONLY readback at10:57:10UTC confirms all237 eBay mappings/offers and
canonical product/variant bindings, with all237 affiliate campaign URLs retained.
Freshness at that timestamp:156 under24h,159 under48h,78 over48h. The five known
external-identity discrepancies2637/2638/2681/2708/2770 are still unresolved and
remain outside automatic apply; no identity was corrected. Review7584 is PENDING
with no owner decision and an expired22November13:56:32UTC proof. All166 eBay
execution-request records are historical; zero are active. No active eBay parent
plan was found. No source/API traffic or affiliate clicks were generated.

### Verification and remaining release gate

- Eight focused existing suites:274 PASS,0 FAIL, including the237-row eBay
  incident, unchanged price/stock contracts, Gladiator603/416 review-only,
  publisher/reconciliation, postflight and durable-artifact boundary.
- verify:quick:1371 PASS,3 pre-existing SKIP,0 FAIL.
- verify:full:4147 PASS,3 pre-existing SKIP,0 FAIL; includes TypeScript, ESLint,
  baseline migrations and isolated-configuration Next.js build.
- The separately requested typecheck/lint/build and inventory results, final
  independent database comparison, head SHA and CI run IDs are retained in the
  local audit evidence and final Draft PR description. Four existing unrelated
  lint warnings remain. No test was weakened or removed.
- The371-file inventory and its existing seal are unchanged. Native isolated
  PostgreSQL execution is NOT_RUN: the existing Docker Desktop Linux engine
  is unavailable. Static SQL contract checks are not called real SQL writes.
  No production credentials or data are passed to any test/build process.
- Project Guardian passed before documentation changes; its final result and
  git diff --check are recorded with the final readiness evidence.

Existing local evidence directory: `tmp/ebay-565-safe-sync-20261123/`, containing
`scope-parity.json`, `profile-parity.json`, `incident-replay.json`, private
READ ONLY snapshots/comparison, focused/gate logs, inventory, CI metadata and
the final readiness report. No raw database snapshot or credential is committed.

Gladiator's separately authorized [review-only run45155656444](https://github.com/SupplementScout/supplementscout/actions/runs/45155656444)
is SUCCESS on released main:187 VERIFY_NO_CHANGE,416 actual REVIEW_ONLY cards,
zero business writes and zero offer applies. Its production apply is still
PENDING_NATURAL_RUN, nominal24November08:17UTC, followed by postflight,
idempotency and a correlated watchdog. This sync does not repeat that test.

After final head-bound Quality Gate and Project Guardian PASS, seek separate
owner approval for controlled release of exact565 SHA. Recheck main/diff/CI,
production ledger, active controls/decisions and schedule write boundary first.
Then require the existing fresh natural eBay source/refresh/publication path,
independent postflight, idempotency, queue visibility and later watchdog.
Never replay expired review7584 or the failed archived publication request.
Shipping/identity changes remain review-only and require their own owner scope.
PR565 stays DRAFT; eBay production is NOT_RECOVERED. No new system is proposed.
