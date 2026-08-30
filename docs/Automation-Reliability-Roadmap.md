# Automation Reliability Roadmap

**Status date:** 30 August 2026  
**Priority:** P0 — active until every exit criterion below is evidenced  
**Authority:** Source of truth for the Automation Reliability Sprint. The SupplementScout Operating Plan remains the project authority; this ledger controls the reliability sprint and must be updated after each completed phase.

## 1. Goal

Make every active retailer automation scheduled, freshness-complete, per-row safe and operationally observable. A healthy run must confirm unchanged offers, atomically apply safe approved changes, isolate review rows, perform a database postflight and expose failures before data becomes older than 48 hours. The end state must reuse shared control-plane mechanisms rather than add a retailer-specific executor for every store.

## 2. Scope

The sprint covers GYM HIGH, Whey Okay, Discount Supplements, Dolphin Fitness, Simply Supplements, KIOR Health, Fit House, Jon's Supplements, 6 Pack Supplements, eBay UK and Predators Gear. It covers capture, identity validation, classification, guards, per-row approval and execution, postflight, idempotency, checkpointing, retry, scheduling, alerting and `/admin/catalog-health` reporting.

It does not authorize new retailer scope, new catalogue identities, destructive migrations, manual SQL freshness updates, broader database privileges or changes to the existing Overall Critical rule for products without an in-stock offer.

## 3. Current confirmed state

### 6 Pack Supplements

- Approved scope: 506 mappings and 506 offers.
- A protected apply completed 492 `VERIFY_NO_CHANGE` plans. Those offers received a newer `last_checked_at`; commercial fields, mappings and `price_history` remained unchanged.
- Fourteen genuine commercial changes remain. All fourteen still had `last_checked_at = 2026-08-20T03:56:59.298Z` in the read-only baseline captured by run `33274526268`.
- The fourteen rows are offers `2006`, `2027`, `2028`, `2029`, `2030`, `2031`, `2032`, `2033`, `2062`, `2063`, `2064`, `2065`, `2066` and `2422`: eight price-only, one stock-only and five price-and-stock changes.
- Expected effect when a valid reviewed batch can execute: 14 plans, 13 new `price_history` rows, six stock changes, zero mapping updates and zero new products, variants, mappings or offers.
- Run `33273675067` (#71) stopped before writes because the validator login had not activated `retailer_catalogue_production_validator`.
- Commit `93a951a1bac9c8c0f81ed1a149a88615d1776b4c` fixed that connection path. Run `33274526268` (#73) then passed fresh source preflight and the read-only database baseline on the intended validator role.
- Run #73 stopped on the first reviewed row before any execution. Checkpoint evidence records `executed_plan_count = 0`; all 14 rows remain. The current blocker is the existing atomic importer invariant `variant evidence does not match default product variant` for offer `2006`, whose mapping points to default variant `1922` while product `982` has an active non-default variant.
- Dry-run `33274294913` (#72) was `PASS_WITH_REVIEW`: 506 mappings, 492 executable confirmations, the exact 14 reviewed commercial changes and zero blocked rows or database writes.

### Catalog Health checkpoint after the 492 confirmations

| Metric | Confirmed value |
| --- | ---: |
| Global stale offers >7 days | 453 |
| Products with stale offers | 291 |
| Global stale offers >30 days | 427 |
| 6 Pack stale offers >7 days | 14 |
| 6 Pack products with stale offers | 3 |
| Products without an in-stock offer | 206 |

The Overall Critical status is currently driven by the 206 products without an in-stock offer. That is a separate post-sprint product/data decision and must not be hidden by reliability reporting.

### Confirmed remaining old-offer starting point

| Retailer | Stale offers recorded at sprint start |
| --- | ---: |
| Whey Okay | 284 |
| Discount Supplements | 142 |
| Dolphin Fitness | 2 |
| KIOR Health | 11 |

After 6 Pack is closed, the recorded starting total is 439 genuinely old offers. These counts must be refreshed by the P1 read-only inventory before any retailer-specific apply.

## 4. Known problems

- 6 Pack: reviewed offer `2006` violates the existing default-variant integrity guard; one row currently stops the reviewed executor checkpoint before the other 13 rows.
- GYM HIGH: latest known feed build failure.
- Whey Okay: latest known dry-run failure and 284 stale offers.
- Simply Supplements: repeated failed runs.
- eBay UK: preflight failures and a cancelled run.
- Source reads: an individual product page can time out without bounded retry.
- Workflow contracts are inconsistent in whether unchanged offers update freshness, whether review rows are isolated and whether every apply has an authoritative DB postflight.
- No single six-hour watchdog currently proves capture/apply/postflight success within 48 hours for every active retailer.
- Catalog Health does not yet separate genuinely stale data, pending review, workflow failure, missing freshness confirmation and no-in-stock coverage.

## 5. Architecture decisions

1. Reuse the existing retailer offer-sync control plane, atomic importer RPCs, approval ledgers, fingerprints and stale-state checks.
2. The execution unit is a row. Safe executable rows proceed; review rows remain unchanged and are reported together. Only global integrity failures block the whole batch.
3. `VERIFY_NO_CHANGE` may update only `offers.last_checked_at` and must create no history row.
4. Price and stock changes use the existing protected atomic path and its existing thresholds. No new arbitrary commercial threshold is introduced.
5. Validator, approver and executor identities stay separate. No role receives new grants merely to compensate for failure to activate its intended role.
6. A shared validator session owns one PostgreSQL client and one transaction: `BEGIN READ ONLY`, `SET LOCAL ROLE`, identity/read-only checks, callback, then `COMMIT` or `ROLLBACK` and close.
7. Postflight is authoritative. A later source timeout cannot invalidate a completed apply plus passing DB postflight and must never trigger replay.
8. Checkpoints list executed, remaining and blocked IDs so interruption recovery never replays completed plans.
9. Monitoring and reports are read-only. Production writes remain bounded by existing owner-approved scope and guarded RPCs.

## 6. Delivery sequence

| Phase | Deliverable | Status | Current next action |
| --- | --- | --- | --- |
| P0 | Close 6 Pack safely | IN PROGRESS | Audit offer `2006` against existing variant/mapping mechanisms; isolate or correct it without weakening the atomic guard, then regenerate a fresh reviewed batch. |
| P1 | One cross-retailer inventory and priority | NOT STARTED | Build one read-only table for all eleven retailers after the P0 execution path is safe. |
| P2 | Shared reliability core | NOT STARTED | Extract only proven common session/contract behavior, starting from the working 6 Pack validator session. |
| P3 | Stabilize Simply, eBay, GYM HIGH, Whey Okay | NOT STARTED | Diagnose and fix in that order, one bounded retailer change at a time. |
| P4 | Classify or refresh genuinely old offers | NOT STARTED | Whey Okay, Discount, Dolphin and KIOR; one grouped review batch per retailer when needed. |
| P5 | Six-hour watchdog, retry and recovery | NOT STARTED | Add bounded source retry, 48-hour failure signal and cross-retailer checkpoint evidence. |
| P6 | Catalog Health reliability view | NOT STARTED | Add per-retailer success, stale, review, failure and cron state without changing Overall Critical. |
| Closeout | Verify every exit criterion and return to Operating Plan | NOT STARTED | Final evidence, commits, run IDs and clean `main`. |

## 7. Exit criteria

- 6 Pack has zero stale offers.
- No false stale offer is caused by skipped `VERIFY_NO_CHANGE` execution.
- Every active automatic retailer has a successful capture, apply and DB postflight less than 48 hours old.
- Every active cron invokes the intended operation rather than a report-only or dry-run path.
- Review rows do not block unrelated safe executable rows.
- The shared validator wrapper is proven against the real production roles.
- Transient source timeouts use bounded retry and produce an accurate terminal status.
- A read-only watchdog runs every six hours and fails with the exact retailer/stage after 48 hours without success.
- Catalog Health reports retailer-level stale, review, workflow, freshness and no-in-stock states separately.
- The 439 recorded genuinely old offers are refreshed or explicitly classified as review/manual.
- This roadmap contains the final commits, workflow run IDs and production evidence.

## 8. Execution register

| Date | Phase | Commit/run | Result | Evidence / remaining work |
| --- | --- | --- | --- | --- |
| 2026-08-29 | P0 | 492-confirmation protected apply | PASS | 492 freshness-only updates; zero commercial, mapping or history delta. |
| 2026-08-29 | P0 | Run `33273675067` (#71) | SAFE BLOCK | Fresh preflight passed; baseline lacked activated validator role; zero writes. |
| 2026-08-29 | P0 | `93a951a1bac9c8c0f81ed1a149a88615d1776b4c` | PASS | Validator uses one read-only session with exact role/identity checks and commit/rollback tests. |
| 2026-08-29 | P0 | Run `33274294913` (#72) | PASS_WITH_REVIEW | Exact 506/492/14 scope, exact approved commercial values, zero blocked and zero writes. |
| 2026-08-29 | P0 | `c8b8286ca871a5c998ee9df838dcf953ee002429` | PASS | Fingerprint-only manifest commit for `3f932dd5aa6ddbe92b79770a4ab0d52f8dcfa0900e21518d9eede0db9962c824`. |
| 2026-08-29 | P0 | Run `33274526268` (#73) | SAFE BLOCK | Preflight and validator baseline passed. Offer `2006` hit default-variant guard; `executed_plan_count = 0`; no commercial writes. |
| 2026-08-30 | Sprint setup | pending documentation commit | IN PROGRESS | Roadmap created and linked; P0 remains the only active reliability implementation. |

## 9. Owner-required blockers

No owner decision is required merely to diagnose and reuse an existing safe variant/mapping mechanism for offer `2006`. Stop for owner input only if the evidence requires a product-identity decision, a new variant or mapping, changed commercial values, new database privileges, a destructive migration or a broader production scope.

All later ambiguous retailer rows must be collected into one bounded review report per retailer rather than individual interruptions.

## 10. Task after the sprint

Return to the existing Operating Plan sequence. The currently recorded next task is SEO-15's mandatory identity-proven accrual audit and readiness decision. The separate policy decision for the 206 products without an in-stock offer follows the reliability sprint and must not be silently folded into it.
