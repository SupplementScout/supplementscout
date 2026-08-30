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
- GYM HIGH: the source is healthy, but the immutable control binding still expects product `529` default variant `507` while live mapping `387` and offer `554` already point to exact `400g` variant `2973`.
- Whey Okay: ten approved identities from source product `24` are absent from the healthy feed and are now isolated to review; a fresh dry-run has 576 executable plans, including one unapproved stock transition.
- Simply Supplements: the missing source variant is now isolated to review and DB postflight is installed; production apply of 119 executable plans still needs owner approval because two are stock transitions.
- eBay UK: offer `2581` and mapping `2766` point to default variant `1178`, while the existing exact `405g` variant is `2920`.
- Source reads: an individual product page can time out without bounded retry.
- Workflow contracts are inconsistent in whether unchanged offers update freshness, whether review rows are isolated and whether every apply has an authoritative DB postflight.
- The six-hour watchdog is live, but nine retailers do not yet emit authoritative DB-postflight and per-row execution-contract evidence for it to prove.
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
| P0 | Close 6 Pack safely | OWNER BLOCKED | Offer `2006` needs an owner-approved mapping/offer rebind from default variant `1922` to existing exact variant `3126`; do not weaken the guard or apply the remaining batch first. |
| P1 | One cross-retailer inventory and priority | COMPLETE | Snapshot and workflow evidence below; Simply Supplements is the first retailer repair after the shared postflight/session contract. |
| P2 | Shared reliability core | COMPLETE | Shared validator/approver/executor role sessions and reusable manifest-scoped DB postflight are proven by 6 Pack, Simply and Whey Okay contracts. Adoption continues retailer by retailer. |
| P3 | Stabilize Simply, eBay, GYM HIGH, Whey Okay | IN PROGRESS / OWNER BLOCKED | Simply and Whey code paths are repaired and dry-run cleanly with isolated review. eBay and GYM HIGH require owner identity decisions; production applies for Simply and Whey require commercial approval. |
| P4 | Classify or refresh genuinely old offers | COMPLETE / OWNER BLOCKED | All four legacy scopes are classified below. Execution requires grouped owner approval because the scopes include identity promotion or commercial changes. |
| P5 | Six-hour watchdog, retry and recovery | IN PROGRESS | Read-only six-hour watchdog and native 48-hour failure signal are live. Shared DB postflight is installed for seven retailers; five new adoptions await their next scheduled production evidence. GYM HIGH, eBay, KIOR and Predators still need compatible evidence paths. |
| P6 | Catalog Health reliability view | IN PROGRESS | Per-retailer DB freshness and no-in-stock metrics are live without changing Overall Critical. Workflow/review/cron state remains in the watchdog artifact until an approved shared read source exists. |
| Closeout | Verify every exit criterion and return to Operating Plan | NOT STARTED | Final evidence, commits, run IDs and clean `main`. |

### P1 read-only inventory

Database counts were captured at `2026-08-30T03:37:12.598Z`. Workflow evidence is from the latest five runs visible on 30 August. `Apply` means the scheduled workflow actually invokes a protected apply path; `DB PF` means an independent, role-bound database postflight rather than a second source dry-run. `Fresh` means unchanged rows are executable freshness confirmations. A dash means the repository or retained run evidence does not prove the capability.

| Retailer | Mappings / offers | Latest successful capture / apply | Latest DB PF | Oldest check | Stale >7 / >30 | Fresh | Safe updates | Review isolation | Retry | Idempotency | Cron apply | Current blocker |
| --- | ---: | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| GYM HIGH | 66 / 66 | source monitor `33269272837`; apply `32931853881` | source dry-run only | 2026-08-26 04:52Z | 0 / 0 | yes | yes | reviewed fixed scope | source artifact fallback | source postcondition | yes | Run `33249118555`: live 71-row source passed, then the immutable feed binding/build failed. |
| Whey Okay | 870 / 870 | apply `33179855717` | source dry-run only | 2026-06-28 14:32Z | 284 / 284 | yes in protected plan | yes | classifier isolation, globally blocked on identity | source helper has retry contract; last used 0 | yes | yes | Run `33244661630`: healthy 1,705-row feed, `IDENTITY_DRIFT` for offer `16` with zero matches. |
| Discount Supplements | 156 / 156 | apply `33253485439` | source dry-run only | 2026-06-28 14:32Z | 142 / 130 | bounded approved subset | yes | yes in subset | source adapter only | yes | yes | Cron refreshes only its authorised subset; 142 offers remain outside effective freshness scope. |
| Dolphin Fitness | 3 / 3 | apply `33250721247` | source dry-run only | 2026-06-28 12:23Z | 2 / 2 | one approved row | yes for one row | fixed one-row scope | source helper | yes | yes | Two offers are outside the one-offer approved automation. |
| Simply Supplements | 120 / 120 | last DB freshness 2026-08-24 05:50Z; no success in latest five runs | none | 2026-08-24 05:50Z | 0 / 0 | intended | yes | no at missing-variant gate | source helper, last used 0 | intended | yes | Run `33250567937`: healthy source (269 products/468 variants), global `missing mapped variant safety limit exceeded`. |
| KIOR Health | 11 / 11 | shared dry-run does not capture KIOR | none | 2026-07-10 21:59Z | 11 / 11 | no active path | no | no | no | no | no | No scheduled KIOR apply; all 11 are genuinely stale. |
| Fit House | 286 / 286 | apply `33245349979` | source dry-run only | 2026-08-29 09:23Z | 0 / 0 | yes | yes | yes | source helper | yes | yes | Healthy, but independent DB postflight is absent. |
| Jon's Supplements | 506 / 506 | apply `33249957540` | source dry-run only | 2026-08-29 11:22Z | 0 / 0 | yes | yes | yes | source helper | yes | yes | Healthy, but independent DB postflight is absent. |
| 6 Pack Supplements | 506 / 506 | confirmations `33272680452`; reviewed preflight `33274526268` | reviewed baseline passed in `33274526268`; apply PF not reached | 2026-08-20 03:56Z | 14 / 0 | yes | yes | executor checkpoints rows, but default-variant global invariant stopped at row 1 | bounded source retry | yes | yes | Owner decision required for offer `2006` mapping/variant drift. |
| eBay UK | 237 / 237 | last DB freshness 2026-08-25 06:12Z; no success in latest five runs | none | 2026-08-21 19:55Z | 21 / 0 | intended | yes | preflight currently global | API client retry | intended | gated by `EBAY_REFRESH_ENABLED` | Run `33250919353`: offer `2581` has conflicting retailer-product variant evidence. |
| Predators Gear | 47 / 47 | last DB freshness 2026-08-29 13:32Z | no active scheduled refresh PF identified | 2026-08-26 20:33Z | 0 / 0 | not proven | reviewed artifact paths exist | reviewed batches | not proven | batch postflights | no active refresh cron identified | Fresh today, but no single active autonomous refresh workflow is registered. |

Inventory also found zero `never_checked` offers. Products without an in-stock offer by retailer were: GYM HIGH 3, Whey Okay 149, Discount 1, Dolphin 0, Simply 5, KIOR 1, Fit House 39, Jon's 9, 6 Pack 27, eBay 0 and Predators 0. These are coverage facts, not freshness failures.

**Single repair priority:** establish the shared role-bound DB postflight/session wrapper, then repair Simply Supplements first. Its source and coverage guards pass, while one global missing-variant threshold currently prevents every safe row from confirming freshness.

### Progress after the P1 snapshot

- Shared protected-role session commit `0caa0af78d83584d8741105ac5f9352f956392d1` completed P2's connection foundation. Shared DB postflight commit `8a0d9033df08dba7f7b67b05a9dfadec9939ad56` added authoritative baseline/postflight verification for Simply.
- Simply dry-runs `33291309650` and `33291579003` are `PASS_WITH_REVIEW`: 120 approved, 119 executable, one `SOURCE_VARIANT_MISSING` review row (offer `670`), zero blocked and zero writes. The executable scope is 117 `VERIFY_NO_CHANGE` plus two `UPDATE_STOCK` rows (offers `578` and `649`, `true` to `false`). No apply was dispatched.
- eBay run `33250919353` is a real mapping/variant drift blocker for offer `2581`; no guard was weakened and no write was attempted.
- GYM HIGH run `33249118555` passed the 71-row live source audit and then exposed stale immutable control binding `4623:4623`; no write was attempted.
- Whey commit `dfe4a2c3a7742800975aa4da2c073c6ece09c882` reuses the shared per-row classifier and DB postflight. Dry-run `33292109660` is `PASS_WITH_REVIEW`: 586 approved, 576 executable, 575 `VERIFY_NO_CHANGE`, one `UPDATE_STOCK` (offer `221`, `true` to `false`), ten `SOURCE_VARIANT_MISSING` review rows, zero blocked and zero writes. Apply, baseline, postflight and idempotency steps were correctly skipped for the dry-run dispatch.

### P4 legacy-scope classification

The four recorded legacy scopes were re-read without writes. None is a safe blanket freshness-only batch:

| Retailer | Exact old scope | Classification | Safe next action |
| --- | ---: | --- | --- |
| Whey Okay | 284 | All 284 mappings lack external product and variant identity; no canonical mapping/offer conflict was found. Scope hash `d44049ef4256164520fc3a777a73dcb0d6db8203b8720851dcebaa8d06a64cd5`. | Grouped owner review for identity promotion; do not treat as no-change freshness. |
| Discount Supplements | 142 | 95 `NO_CHANGE`, 29 `SAFE_UPDATE`, 13 `OUT_OF_STOCK`, three `MISSING_FROM_SOURCE`, plus two mappings without external IDs. Read-only run `33292337530`; scope hash `0827d1041303ddf7daff8ac757625c81e2b6cd86e1d794f9883ca70f5ad40d7a`. | Owner-review one bounded 137-row executable scope, explicitly including 42 commercial changes; leave five rows in review. |
| Dolphin Fitness | 2 | Both mappings lack external identity; offers `8` and `9` remain canonically consistent. Scope hash `65dbb2164937f56c6c78c80fe7353b4d84807947cc1400065289eff681681a7d`. | Grouped owner review for identity promotion. |
| KIOR Health | 11 | Healthy public source and no commercial/source drift, but all 11 mappings lack external IDs and therefore plan mapping updates rather than freshness-only. Scope hash `71e5d7d8dc62e15c1822e86f77d35f68d5e9e2e571aabf8a50e1d7439a9f4afb`. | Grouped owner review for identity promotion; no apply before approval. |

KIOR's local adapter dry-run saw 11 configured/mapped rows, zero price, stock, shipping, URL or identity-content drift and zero writes. The classifications above separate genuine commercial/source changes from legacy identity gaps; no manual timestamp update was used.

### P5 watchdog evidence

Commit `5c6d8ada9fec01dd842dc0389493010b052efcd2` added one read-only watchdog for all 11 retailers on cron `11 */6 * * *`. It uses only the production validator connection, reads GitHub Actions evidence, requires fresh capture/apply/DB-postflight plus exact per-row execution counts, emits a retained JSON report, and fails the workflow as the native alert. It has no approver, executor or service-role credential.

Initial run `33292889053` intentionally failed closed and still uploaded artifact `9726516784`. The DB read succeeded, `database_error` was null and `database_writes = 0`. It found:

- Fit House and Jon's have no offers older than 48 hours, but still lack authoritative DB-postflight and execution-contract evidence.
- 6 Pack has a valid `506 = 492 executable + 14 review` contract with `492` executed and zero blocked; exactly the 14 owner-blocked reviewed offers are older than 48 hours.
- GYM HIGH has 66 old offers; Whey Okay 284; Discount 142; Dolphin 2; Simply 120; KIOR 11; eBay 237; Predators 20.
- KIOR and Predators have no registered autonomous refresh workflow. All retailers currently fail at least one required reliability signal, so the watchdog's aggregate `FAIL` is accurate rather than a false positive.

### P6 Catalog Health evidence

Commit `2fbe908` extends the existing authenticated `/admin/catalog-health` loader and page without a new data source. The dashboard now reports, per retailer, all active-catalogue offers, exact offers older than 48 hours, the existing >7-day and >30-day measures, never-checked offers, oldest/newest database check and products for which that retailer has no valid in-stock offer. Overall status and its existing Critical rule are unchanged.

The page explicitly does not infer workflow success, pending review or cron state from timestamps. Those remain authoritative in the six-hour watchdog artifact. Rendering them live in the web application needs an approved shared read source for GitHub workflow evidence; none currently exists in the application environment, so no token, migration or persistence layer was invented.

### P5 shared postflight adoption

Commit `0957dd0` extends the existing validator-only DB baseline/postflight to Discount Supplements (exact 14), Dolphin Fitness (exact one), Fit House (full 286), Jon's Supplements (full 506) and the ordinary 6 Pack 506-row workflow. Together with Simply Supplements and Whey Okay, seven retailer workflows now have the shared authoritative DB contract installed.

Each adopted workflow captures the read-only baseline after a passing source preflight, applies through the unchanged approver/executor path, verifies DB state before source idempotency and uploads the evidence in its existing artifact. Jon's one-row reviewed-price path and 6 Pack's reviewed MASS_OOS path remain explicitly outside the full-scope generic postflight. No commercial guard, permission, secret value or schedule changed.

Local targeted tests, `verify:quick` and `verify:full` passed. A local production baseline attempt stopped before connecting because the developer `.env.local` intentionally has no validator URL; no secret was copied and no DB operation occurred. Production proof for the five new profiles therefore remains pending their next existing scheduled runs, and the watchdog must continue to report missing DB-postflight evidence until those runs pass.

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
| 2026-08-30 | Sprint setup | `789b6d834a63439999b8ec8e72e1bb73d57845c3` | PASS | Roadmap created and linked; no production writes. |
| 2026-08-30 | P1 | DB snapshot plus GitHub run/artifact inventory | PASS | All 11 retailers inventoried once. Exact current blockers and cron behaviour recorded; P2 selected as active implementation. |
| 2026-08-30 | P2 | `0caa0af78d83584d8741105ac5f9352f956392d1` | PASS | Shared one-client protected role sessions preserve read-only validator, approver and executor separation. |
| 2026-08-30 | P3 / Simply | `df269849b68b6b472ac6a81c576805db25a4d9d1`, `29bb4ed5fa6a929a3e9eef055d713ae832f1c4e5`, `8a0d9033df08dba7f7b67b05a9dfadec9939ad56`; runs `33291309650`, `33291579003` | PASS_WITH_REVIEW | One missing source row isolated; 119 plans executable; shared DB postflight installed; zero production writes. Apply awaits owner approval for two stock changes. |
| 2026-08-30 | P3 / eBay | Run `33250919353` plus DB identity check | OWNER BLOCKED | Offer `2581` has real default-versus-exact variant drift (`1178` versus `2920`); zero writes. |
| 2026-08-30 | P3 / GYM HIGH | Run `33249118555` plus DB/control check | OWNER BLOCKED | Live mapping is exact variant `2973`, immutable approval still binds variant `507`; zero writes. |
| 2026-08-30 | P3 / Whey Okay | `dfe4a2c3a7742800975aa4da2c073c6ece09c882`; run `33292109660` | PASS_WITH_REVIEW | Healthy 523-product/1,705-row source; 586 approved, 576 executable, ten isolated review rows, zero blocked and zero writes. One stock transition awaits approval. |
| 2026-08-30 | P4 | KIOR adapter, DB inventory and run `33292337530` | CLASSIFIED / OWNER BLOCKED | Exact 439-row legacy starting scope classified without writes; identity promotion or commercial-change approval is required per retailer. |
| 2026-08-30 | P5 | `5c6d8ada9fec01dd842dc0389493010b052efcd2`; run `33292889053`; artifact `9726516784` | FAIL-CLOSED AS DESIGNED | Six-hour read-only watchdog is live for all 11 retailers. Validator DB read passed, zero writes; all 11 currently lack at least one required reliability signal. |
| 2026-08-30 | P6 | `2fbe908` | PARTIAL PASS | Catalog Health now exposes truthful per-retailer DB freshness and coverage metrics. Live workflow/review/cron fields remain blocked on a shared read source rather than being inferred. |
| 2026-08-30 | P5 | `0957dd0` | IMPLEMENTED / EVIDENCE PENDING | Shared read-only DB baseline/postflight adopted by Discount, Dolphin, Fit House, Jon's and ordinary 6 Pack; seven retailer profiles total. No apply was dispatched. |

## 9. Owner-required blockers

The current consolidated owner decisions are:

1. **6 Pack:** approve or reject rebinding mapping `2192` and offer `2006` from default variant `1922` to existing exact `60-servings` variant `3126`. Until then, the reviewed 14-row batch remains safely blocked.
2. **Simply Supplements:** approve or reject the protected 119-plan apply: 117 freshness confirmations and stock `true` to `false` for offers `578` and `649`; offer `670` remains unchanged in review.
3. **eBay UK:** approve or reject rebinding mapping `2766` and offer `2581` from default variant `1178` to existing exact `405g` variant `2920`.
4. **GYM HIGH:** approve or reject refreshing the immutable control binding for source tuple `4623:4623` from old variant `507` to the already-live exact `400g` variant `2973`; this is approval/control evidence, not a request to rewrite the live mapping.
5. **Whey Okay:** approve or reject the protected 576-plan apply: 575 freshness confirmations and stock `true` to `false` for offer `221`; the ten absent source-product-`24` rows remain unchanged in review.
6. **Legacy old scopes:** approve or reject bounded grouped remediation separately for Whey Okay 284 identity promotions, Discount 137 executable rows including 42 commercial changes, Dolphin two identity promotions and KIOR 11 identity promotions. Discount's remaining five rows stay in review.

No production apply is implied by these entries. Each approved operation must still use its existing protected workflow, fresh source capture, stale-state guards and DB postflight. Later ambiguous rows remain grouped into one bounded review report per retailer rather than individual interruptions.

## 10. Task after the sprint

Return to the existing Operating Plan sequence. The currently recorded next task is SEO-15's mandatory identity-proven accrual audit and readiness decision. The separate policy decision for the 206 products without an in-stock offer follows the reliability sprint and must not be silently folded into it.
