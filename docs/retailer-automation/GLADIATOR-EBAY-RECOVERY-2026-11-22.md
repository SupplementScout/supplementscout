# Gladiator and eBay reliability recovery — 22 November 2026

Boundary: read-only production audit and minimal Draft code correction only.
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
