# Automation Reliability Roadmap

### Unified Review Queue rollout checkpoint — 30 August 2026, 14:51 UTC

- Existing mechanisms were extended rather than replaced. The legacy `product_match_review_queue`, admin authentication, retailer classifiers, protected approval/apply RPCs, control ledgers, DB postflight and watchdog remain authoritative. The queue is a review and audit surface; it does not write catalogue tables.
- eBay source-failure isolation is live in `b220a99`. Dry-run `33315614452` proved `237 = 197 executable + 40 review`, with `32` identity rows, `7` commercial rows, offer `2686` as the sole isolated `SOURCE_FAILURE`, and zero blocked rows. Apply run `33315914106` completed the protected apply and DB postflight before the workflow timeout cancelled only the final repeat source capture. Exact production effect: `197` `last_checked_at` updates; zero price, stock, shipping, total, URL, mapping, entity-count or `price_history` delta. DB postflight hashes are `accd023c...ac686` and `c7bb683d...cd435`.
- Independent eBay idempotency dry-run `33317674156`, artifact `9733997571`, completed `PASS_WITH_REVIEW`: `237` approved, `197 VERIFY_NO_CHANGE`, `40` review, `0` blocked and `0` writes. Because the apply workflow itself concluded `cancelled`, the strict full-PASS prerequisite for autonomous scheduling is not met. `EBAY_REFRESH_ENABLED` remains absent/disabled; no cron enablement was performed.
- Additive migration `20260830140000_extend_product_match_review_queue_for_automation.sql` was rehearsed and applied unchanged to staging and production. It added nullable automation evidence/lifecycle fields, stable retailer-offer-fingerprint uniqueness and append-only `product_match_review_events`; it changed no catalogue data. Production migration ledger is `166` with fingerprint `a1bb5168...3316`; catalogue counts remained products `1130`, variants `2849`, mappings `2808`, offers `2808`, history `6610`.
- Review Queue implementation commits are `ee763b5` (schema), `76d117d` (migration seal), `904de74` (authenticated shared UI), `058d59f` (idempotent seed), `3926c6e` (fail-closed retailer binding preflight), `3da1897` (two fresh GYM drifts), and `448a785` (Catalog Health queue counts). Vercel reported successful deployment for `448a785`; unauthenticated `https://www.supplementscout.co.uk/admin/automation-review` returns `307` to `/admin/login`.
- Production queue postflight at `2026-08-30T14:45:46.918Z` proves exactly `375` automation rows, all `PENDING`, zero `FAILED`, and exactly `375` immutable `CREATED` events with no other event type. Idempotency reports `375` already present, `0` insert candidates and `0` catalogue writes. Evidence SHA-256 is `a3e1c1abd36a4252d2c423c3608272e4fdd8d0b015fb520a1341005e8accb20b`.
- Queue partition: Whey Okay `284` (`182` identity, `100` source, `2` mapping); Discount `47` (`42` commercial, `3` source, `2` identity); Dolphin `2` identity; eBay `40` (`32` identity, `7` commercial, `1` source); GYM HIGH `2` mapping. These are review records, not owner approvals and not executable plans.
- Fresh Discount read-only run `33317675902`, artifact `9733956096`, supersedes the old 47-row commercial snapshot for execution decisions: all `109` current approved mappings classify `VERIFY_NO_CHANGE`, selected Group A scope is `95/95`, zero review/blocked and zero writes. The 47 queue rows retain historical evidence but must be refreshed or expire before any owner decision; no commercial apply was dispatched.
- Catalog Health now joins queue counts while keeping GitHub workflow/cron evidence in the watchdog. Final read at `2026-08-30T14:45:00.182Z`: global stale `334/322` over 7/30 days, `269` products with stale offers, and `208` products without a valid in-stock offer; Overall remains `Critical` under the unchanged 208-product rule. Per retailer stale >7/>30: Whey `284/284`, Discount `47/36`, Dolphin `2/2`, eBay `1/0`, all others `0/0`.
- The one final read-only watchdog is run `33317928492`, artifact `9734033738`: aggregate `FAIL`, KIOR alone `PASS`, `database_error=null`, `database_writes=0`. It recognizes eBay `197/197` and the current capture but correctly reports `DB_POSTFLIGHT_SUCCESS_MISSING` because the source apply run did not complete successfully; it sees exactly 40 eBay offers older than 48 hours. Other pre-existing retailer evidence gaps remain visible.
- Local evidence passed: targeted Catalog Health tests `19/19`, `verify:quick`, `verify:full`, Next production build and `git diff --check`. The review UI currently records guarded decisions and immutable audit only. A generic consumer that revalidates fresh source and routes approved queue rows into each retailer's existing protected approval/apply RPC is not yet implemented; no direct catalogue execution was added to the UI.
- **Checkpoint outcome: `REVIEW_QUEUE_OPERATIONAL_SAFE_AUTOMATION_EXPANDED_PARTIAL`.** Queue capture, audit, admin review, eBay per-row isolation and eBay freshness execution are operational. Full completion remains blocked on a successful end-to-end eBay apply run for cron enablement and on the protected queue-to-existing-executor handoff; neither gap justifies replaying writes or bypassing guards.

### Unified Review Queue implementation start — 30 August 2026, 13:52 UTC

- Clean `main` and `origin/main` start at `e936a6e`; worktree was clean, `verify:project` passed and the final owner pack retained file SHA-256 `db5868c8d78ed67cdf00566421a07d9c5cabd4d0a328fb787542d7e95d42945a`.
- Fresh read-only Catalog Health at `2026-08-30T13:49:43.650Z` confirms no drift from the prior checkpoint: global stale `354/322` over 7/30 days, Whey `284/284`, Discount `47/36`, Dolphin `2/2`, eBay `21/0`, all other retailers `0/0`, and 208 products without a valid in-stock offer. Overall remains `Critical` under the unchanged rule.
- Existing infrastructure will be extended, not duplicated: `/admin/product-matching`, `product_match_review_queue`, signed admin sessions, product-match decisions, immutable source/artifact fingerprints, the protected import-plan approval/apply RPCs, retailer control ledgers, postflights, idempotency and watchdog GitHub evidence already exist.
- The production queue currently contains 141 unconsumed, already-decided 6 Pack identity rows and no pending rows. Its current schema is identity-oriented and lacks offer/mapping IDs, before/after commercial evidence, expiry, workflow links, execution lifecycle and immutable decision events. The validator role correctly has no queue SELECT; the existing admin server connection can read it. No privilege expansion is planned.
- Reuse plan: add only nullable retailer-offer review fields and an immutable audit/event table; retain legacy rows and decisions; make publishing idempotent on retailer + offer + fingerprint; keep UI writes confined to review decisions/audit; route any catalogue execution through existing builders and protected approval/apply RPCs. Direct catalogue SQL from the UI remains forbidden.
- Work sequence: fresh eBay source capture and per-row source-failure isolation; fresh Discount package; additive queue schema plus RLS/RPC guards; shared `/admin/product-matching` filters/actions/impact preview; idempotent queue population for current eBay/Discount/Dolphin/Whey and fresh GYM drifts; Catalog Health/watchdog integration; local/full verification; protected migration deployment and read-only postflight; final evidence checkpoint.

### Remaining-stale reconciliation checkpoint — 30 August 2026, 13:35 UTC

- **Outcome: `RELIABILITY_NO_SAFE_PROGRESS`.** All permitted read-only work completed, but no new production row met every execution guard. No production apply was dispatched in this phase. The complete unresolved-row artifact is `docs/rollouts/automation-reliability-owner-pack-2026-08-30-final.json`, file SHA-256 `db5868c8d78ed67cdf00566421a07d9c5cabd4d0a328fb787542d7e95d42945a` and payload SHA-256 `c3891eacd2427f45bf8866ac4eeaf997a8286ae7351578f3dcb0643083ff5e01`.
- The old `438` versus `439` scope is reconciled: the prior JSON contains 438 unique rows; the documented 439 adds the later independent GYM HIGH mapping `2796` control drift, which was never a row in that JSON. There is no duplicate artifact row.
- eBay implementation `09c49d1` now isolates row-level identity and commercial review while retaining source failure as a global guard. Fresh dry-runs `33313875741` and `33314170314` independently returned the same `197 VERIFY_NO_CHANGE`, `32` identity review, `7` price review and one global `SOURCE_READ_FAILED` for offer `2686`. Both stopped before baseline/apply; executed `0`, database writes `0`. Scheduled apply remains disabled.
- Discount's remaining exact 47-row scope was captured read-only: `20 UPDATE_PRICE`, `2 UPDATE_PRICE_AND_STOCK`, `18 UPDATE_STOCK`, `3 SOURCE_MISSING`, `2 IDENTITY_MISSING` and `2 NO_CHANGE`. The two new no-change candidates remain draft-only and were not added to immutable scope; none of the 47 was executed.
- Dolphin offers `8` and `9` both expose live flavour-specific SKUs, while their current canonical variants are generic. This is not safe same-variant identity promotion; both remain independently in review. Existing daily cron is `27 5 * * *` and its scheduled path is real `mode=apply` for the separately approved one-offer scope.
- Whey Okay's fresh EKM capture (523 products, 1,705 variants, semantic fingerprint `50b6757ea4b891bbc5be7cbd189e2a80d73c6391e24b425052ce71aa566f5da6`) produced an exact disjoint 284-row partition: promotions `0`, same-variant freshness `0`, exact rebind `0`, source missing `2`, commercial change `38`, ambiguous identity `49`, variant conflict `195`, already resolved `0`. Existing SKU/MPN/GTIN requirements were not lowered, stale prior rebind candidates were not reused, and no Whey write was attempted.
- Final read-only Catalog Health at `2026-08-30T13:35:14.126Z` is unchanged from the phase baseline: global stale `354/322` over 7/30 days, 288 products with stale offers and 208 products without a valid in-stock offer. Per retailer stale >7/>30: Whey `284/284`, Discount `47/36`, Dolphin `2/2`, eBay `21/0`, all others `0/0`. Overall remains `Critical` under the unchanged 208-product rule.
- The single final read-only watchdog is run `33314564081`, artifact `9733037263`, generated at `2026-08-30T13:35:22.923Z`: truthful aggregate `FAIL`, KIOR alone `PASS`, `database_error=null`, `database_writes=0`. It reports 10 retailer failures, including the known evidence-contract gaps and offers older than 48 hours; no replay was used to manufacture historical evidence.
- Remaining owner decisions are consolidated into four evidence groups: HIGH-confidence rebinds `0`; verified commercial changes `85`; source-missing/read-failure policy rows `6`; ambiguous identity/manual review `280`. The only future approval text is in the owner-decision document; no Group B/C/D approval is inferred.

### Group A owner-authorized rollout checkpoint — 30 August 2026, 12:55 UTC

- **Outcome: `GROUP_A_PARTIAL`.** The approved owner-pack file hash remained exactly `419c758d55affd2e2bd2a0730a953a25a750c4f62fb53c14a6da3089ee8f1737`. Discount completed `95/95` freshness confirmations; Whey's 50 identity rows remained isolated in review. Final per-row outcome: identity promotions `0`, rebinds `0`, freshness confirmations `95`, review rows `50`, blocked rows `0`.
- Discount's immutable control scope is now the disjoint union of the unchanged existing 14 and owner-approved 95 rows. Implementation `2836d29`, ledger seal `f6e450d` and read-only postflight precision fix `0023f70` retain the existing validator/approver/executor RPCs, per-row approval, stale-state protection and atomic execution. Control-plane migration `20260830120000` committed at production ledger count `165`; catalogue counts remained products `1130`, variants `2849`, mappings `2808`, offers `2808`, history `6610`.
- Dry-run `33311985408` proved the selected segment exactly: 95 approved/executable `VERIFY_NO_CHANGE`, zero review/blocked and zero writes. Apply run `33312063547` executed `95/95` in two atomic children (`48 + 47`), with 95 timestamp changes and zero price, stock, shipping, total, URL, mapping, entity-count or `price_history` delta. The workflow postflight hit a read-only `Date.parse(Date)` millisecond-loss false positive; the corrected read-only replay on the immutable baseline/apply artifacts passed with postflight hash `2856f3bdff29cf866def22742be075e5e967d7c983901f87d62cab55ca7f08cb`. Apply was not replayed.
- Fresh idempotency dry-run `33312503131`, artifact `9732418393`, returned the same exact 95 no-change rows, zero review/blocked and zero database writes.
- Whey's fresh EKM evidence remains 523 products, 1,705 variants, 1,009 in-stock and semantic fingerprint `50b6757ea4b891bbc5be7cbd189e2a80d73c6391e24b425052ce71aa566f5da6`. All 47 proposed identity promotions lack both MPN/SKU and GTIN. Rebind `301` is optioned `Green` to `Default`; rebinds `302` and `303` are cross-product targets in inactive products merged into product `297`. Existing guards therefore keep all 50 rows unchanged; no exception or bypass was added.
- Read-only Catalog Health at `2026-08-30T12:51:48.862Z` reports global stale `354/322` over 7/30 days and Overall `Critical` from 208 products without a valid in-stock offer. Per retailer stale >7/>30: GYM `0/0`, Whey `284/284`, Discount `47/36`, Dolphin `2/2`, Simply `0/0`, KIOR `0/0`, Fit House `0/0`, Jon's `0/0`, 6 Pack `0/0`, eBay `21/0`, Predators `0/0`.
- The single post-rollout watchdog is run `33312658549`, artifact `9732468399`: expected aggregate `FAIL`, `database_error = null`, `database_writes = 0`. Discount evidence shows `executed=95/executable=95` and 47 database offers older than 48 hours; its remaining `APPROVED_SCOPE_PARTITION_MISMATCH` is an evidence-model gap because the watchdog does not yet represent the explicitly unselected 14-row segment, not an apply or commercial-data failure.

**Status date:** 30 August 2026  
**Priority:** P0 — active until every exit criterion below is evidenced  
**Authority:** Source of truth for the Automation Reliability Sprint. The SupplementScout Operating Plan remains the project authority; this ledger controls the reliability sprint and must be updated after each completed phase.

## 1. Goal

Make every active retailer automation scheduled, freshness-complete, per-row safe and operationally observable. A healthy run must confirm unchanged offers, atomically apply safe approved changes, isolate review rows, perform a database postflight and expose failures before data becomes older than 48 hours. The end state must reuse shared control-plane mechanisms rather than add a retailer-specific executor for every store.

## 2. Scope

The sprint covers GYM HIGH, Whey Okay, Discount Supplements, Dolphin Fitness, Simply Supplements, KIOR Health, Fit House, Jon's Supplements, 6 Pack Supplements, eBay UK and Predators Gear. It covers capture, identity validation, classification, guards, per-row approval and execution, postflight, idempotency, checkpointing, retry, scheduling, alerting and `/admin/catalog-health` reporting.

It does not authorize new retailer scope, new catalogue identities, destructive migrations, manual SQL freshness updates, broader database privileges or changes to the existing Overall Critical rule for products without an in-stock offer.

### Reliability sprint checkpoint — 30 August 2026, 11:34 UTC

- **eBay remains blocked, with zero writes.** Fresh run `33308019628` reproduced offer `2582`/mapping `2767` on variant `1179` and exact source listing `315370516891`, but the protected identity preflight classified the requested `1179 -> 2910` rebind as `conflicting variant evidence`. The independently enforced approval condition therefore did not permit migration rehearsal or apply. The temporary pending migration was removed in `410453b`; full eBay freshness dry-run/apply was not attempted because the required rebind did not complete.
- **GYM `3333` control correction is complete in code, not in production data.** Commits `7c8b683` and `410453b` change only the immutable expectation `572 -> 2972` and its tests. Run `33308889173` proved the 26-parent/71-row source and bootstrap, then isolated a different control drift `2796:2796` (live variant `2975`, expected `435`) before any feed/import/apply stage. Cron remains fail-closed until that row receives a separate decision.
- **The final old-scope classification is complete and read-only.** The versioned evidence is `docs/rollouts/automation-reliability-owner-pack-2026-08-30.json`, file SHA-256 `419c758d55affd2e2bd2a0730a953a25a750c4f62fb53c14a6da3089ee8f1737`. New decision groups are A `145`, B `42`, C `113`, D `139`; none was applied. Full row evidence and the sole Group A approval block are in `Automation-Reliability-Owner-Decisions.md`.
- **Fresh workflow evidence:** Discount dry-run `33308891990` PASS with 14/14 current approved rows as `VERIFY_NO_CHANGE`; Dolphin dry-run `33308893393` PASS with 1/1 `VERIFY_NO_CHANGE`; Whey run `33308890621` stopped fail-closed at startup because an active/conflicting control session exists. All three reported zero database writes.
- **Read-only Catalog Health snapshot:** at `2026-08-30T11:42:44.683Z`, global stale is `505` over seven days and `416` over thirty days; products without a valid in-stock offer remain exactly `208`, so the unchanged Overall rule remains `Critical`. Per old scope: Whey `284/284`, Discount `142/130`, Dolphin `2/2` stale over 7/30 days. eBay has `77/0`, while every other automatic retailer has `0/0`; the incomplete eBay freshness explains the material difference from the previously expected approximately `428` global stale rows.
- **One final watchdog only:** run `33309408881`, artifact `9731514566`, generated `2026-08-30T11:38:13.012Z`, completed read-only with `database_writes = 0`. Aggregate result is `FAIL` for 10/11 retailers; KIOR alone is full PASS. The actionable data-age failures are GYM 66 older than 48h, Whey 284, Discount 142, Dolphin 2, Simply 1, eBay 237 and Predators 24. Separate evidence-contract gaps remain visible for the workflows that still lack authoritative DB postflight/execution-stage evidence; no replay or apply was performed to manufacture it.

## 3. Current confirmed state

### 6 Pack Supplements — initial incident snapshot (historical)

- Approved scope: 506 mappings and 506 offers.
- A protected apply completed 492 `VERIFY_NO_CHANGE` plans. Those offers received a newer `last_checked_at`; commercial fields, mappings and `price_history` remained unchanged.
- Fourteen genuine commercial changes remain. All fourteen still had `last_checked_at = 2026-08-20T03:56:59.298Z` in the read-only baseline captured by run `33274526268`.
- The fourteen rows are offers `2006`, `2027`, `2028`, `2029`, `2030`, `2031`, `2032`, `2033`, `2062`, `2063`, `2064`, `2065`, `2066` and `2422`: eight price-only, one stock-only and five price-and-stock changes.
- Expected effect when a valid reviewed batch can execute: 14 plans, 13 new `price_history` rows, six stock changes, zero mapping updates and zero new products, variants, mappings or offers.
- Run `33273675067` (#71) stopped before writes because the validator login had not activated `retailer_catalogue_production_validator`.
- Commit `93a951a1bac9c8c0f81ed1a149a88615d1776b4c` fixed that connection path. Run `33274526268` (#73) then passed fresh source preflight and the read-only database baseline on the intended validator role.
- Run #73 stopped on the first reviewed row before any execution. Checkpoint evidence records `executed_plan_count = 0`; all 14 rows remain. The current blocker is the existing atomic importer invariant `variant evidence does not match default product variant` for offer `2006`, whose mapping points to default variant `1922` while product `982` has an active non-default variant.
- Dry-run `33274294913` (#72) was `PASS_WITH_REVIEW`: 506 mappings, 492 executable confirmations, the exact 14 reviewed commercial changes and zero blocked rows or database writes.

### Catalog Health checkpoint after the Simply and Whey applies

| Metric | Confirmed value |
| --- | ---: |
| Global stale offers >7 days | 454 |
| Products with stale offers | 291 |
| Global stale offers >30 days | 427 |
| 6 Pack stale offers >7 days | 14 |
| 6 Pack products with stale offers | 3 |
| Products without an in-stock offer | 208 |

The Overall Critical status is currently driven by the 208 products without an in-stock offer. Brand and category missing counts are both zero. That is a separate post-sprint product/data decision and must not be hidden by reliability reporting.

### Group A production checkpoint

The owner-approved Group A identity release is complete. Production-only migrations rebound 6 Pack offer `2006` and mapping `2192` to exact variant `3126`, rebound eBay offer `2581` and mapping `2766` to exact variant `2920`, promoted the GYM HIGH immutable control binding `4623:4623` to exact variant `2973`, and populated the exact external identities for the approved eleven KIOR mappings. Migration apply fingerprint `fd915307bf148bd4` committed at ledger count `162`; products, retailer products, offers and price history stayed at `1130`, `2808`, `2808` and `6094`, while only the already-approved identity fields changed. Implementation commits are `b78f4ec`, `2d84d36`, `3daa649`, `7d80824` and ledger seal `02be396`.

The fresh 6 Pack capture in run `33300176675` reproduced exactly `492 VERIFY_NO_CHANGE`, eight `UPDATE_PRICE`, one `UPDATE_STOCK`, five `UPDATE_PRICE_AND_STOCK`, fourteen review rows and zero blocked rows. Reviewed apply run `33300883997` executed `14/14`: thirteen price changes, six stock changes and exactly thirteen new `price_history` rows, with zero product, variant, mapping or offer creates and no mapping changes. Its postflight reached an equivalent PostgreSQL Date/ISO-string comparison false positive after the writes; independent read-only database verification proved every approved commercial value, history IDs `8367` through `8379`, no history for stock-only offer `2006`, and unchanged entity counts. Commit `ab8c319` fixes only that timestamp normalization; the apply was not replayed.

Ordinary 6 Pack run `33301481783` then executed `506/506` freshness confirmations. Its row-level postflight proved that all 506 timestamps advanced and no commercial field changed, before a final optional-report count treated an omitted field as zero. Commit `802c910` makes the authoritative comparison use `executed_plan_count`; no replay was performed. Fresh read-only idempotency run `33302525576` is `PASS` with 506 `VERIFY_NO_CHANGE`, zero review, zero blocked and zero writes.

The remaining outcomes were deliberately isolated at this checkpoint. eBay run `33300177322` proved offer `2581` exact on variant `2920`, then stopped without apply on unrelated offer `2582` (`conflicting variant evidence`). GYM HIGH run `33300178041` proved the new `4623:4623 -> 2973` control and the complete 26-parent/71-row source, then stopped without apply on unrelated mapping `3333` canonical drift. KIOR read-only capture `98f311e9-61ac-4633-bbbe-3e1b44971508` proved all eleven promoted identities with zero commercial drift and zero writes. The later final checkpoint below supersedes this pre-automation KIOR state.

The final read-only Catalog Health capture at `2026-08-30T08:54:27.627Z` and watchdog run `33302526439` report:

| Retailer | Offers | Stale >7 / >30 | Pending review | Latest capture | Latest apply | DB postflight | Executed / executable |
| --- | ---: | ---: | ---: | --- | --- | --- | ---: |
| 6 Pack Supplements | 506 | 0 / 0 | 0 | `33302525576` PASS | `33301481783` | row-level DB verification passed; final evidence false positive fixed in `802c910` | 506 / 506 |
| eBay UK | 237 | 1 / 0 | at least 1 (`2582`) | `33300177322` blocked after exact `2581` proof | `32697125213` | missing for a current apply | n/a |
| GYM HIGH | 66 | 0 / 0 | at least 1 (`3333`) | `33300178041` blocked after exact control proof | `32931853881` | missing for a current apply | n/a |
| KIOR Health | 11 | 0 / 0 | 0 | `33305131273` PASS | `33305173344` | PASS; 11 timestamp-only, zero history/commercial delta | 11 / 11 |
| Simply Supplements | 120 | 0 / 0 | 1 | `33295723920` | `33295723920` | equivalent-state artifact false positive; fixed, no replay | 119 / 119 |
| Whey Okay | 870 | 284 / 284 | 10 in current scope, plus 284 legacy identity gaps | `33301348255` | `33301348255` | equivalent-state artifact false positive; fixed, no replay | 576 / 576 |

That historical Catalog Health read is superseded by the final read-only checkpoint below.

### Final Group A/KIOR closeout checkpoint

- **6 Pack data is healthy, but formal evidence is incomplete:** reconstructed read-only verification proves 506 current mappings/offers, 506 idempotent no-change rows, zero stale offers, zero commercial/URL/mapping/history drift, and the exact reviewed 14-row outcome. The original apply artifact lacks the generic DB-postflight stage required by the current watchdog. Status is therefore `DATA_HEALTHY_EVIDENCE_INCOMPLETE`; no replay is allowed merely to manufacture evidence.
- **KIOR is complete and autonomous for the exact eleven-row scope:** implementation commits `61979a6`, `58dfd26`, `0df11e2`, `f2fc780`; migration seals `2a16db1`, `6281527`; daily cron `37 7 * * *`. Final dry-run `33305131273` produced exactly eleven `VERIFY_NO_CHANGE`, zero review, zero blocked and zero writes. Owner-authorized apply `33305173344` executed `11/11`; DB postflight proved eleven freshness-only updates and zero product, variant, mapping, commercial, URL or `price_history` delta. Idempotency returned eleven no-change rows and zero writes.
- **Fresh identity audits remained read-only:** eBay run `33305286364` isolated offer `2582`/mapping `2767`; GYM HIGH run `33305289178` isolated stale control expectation for mapping `3333`. Neither workflow reached apply.
- **Final watchdog:** run `33305571284`, artifact `9730349176`, completed read-only with `database_writes = 0`. KIOR is `PASS`. 6 Pack fails only `DB_POSTFLIGHT_SUCCESS_MISSING`, consistent with the formal closeout status. Aggregate failure remains truthful because other retailer evidence gaps are outside this Group A closeout.

Final Catalog Health read at `2026-08-30T10:04:20.684Z` (`database_writes = 0`):

| Retailer | Offers | Stale >7 | Stale >30 | Oldest check | Products without in-stock offer |
| --- | ---: | ---: | ---: | --- | ---: |
| GYM HIGH | 66 | 0 | 0 | `2026-08-26T04:52:57.290Z` | 3 |
| Whey Okay | 870 | 284 | 284 | `2026-06-28T14:32:45.625Z` | 150 |
| Discount Supplements | 156 | 142 | 130 | `2026-06-28T14:32:45.398Z` | 1 |
| Dolphin Fitness | 3 | 2 | 2 | `2026-06-28T12:23:52Z` | 0 |
| Simply Supplements | 120 | 0 | 0 | `2026-08-24T05:50:16.642Z` | 7 |
| KIOR Health | 11 | 0 | 0 | `2026-08-30T09:54:49.751Z` | 1 |
| Fit House | 286 | 0 | 0 | `2026-08-29T09:23:27.544Z` | 39 |
| Jon's Supplements | 506 | 0 | 0 | `2026-08-29T11:22:44.675Z` | 9 |
| 6 Pack Supplements | 506 | 0 | 0 | `2026-08-30T08:24:17.484Z` | 28 |
| eBay UK | 237 | 77 | 0 | `2026-08-21T19:55:44.933Z` | 0 |
| Predators Gear | 47 | 0 | 0 | `2026-08-26T20:33:05.744Z` | 0 |

Global counts are 505 stale offers over seven days, 416 over thirty days, 344 products with stale offers and 208 products without a valid in-stock offer. Missing brand/category counts are zero. Overall remains `Critical` solely under the existing 208-products-without-in-stock-offer rule.

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
- Whey Okay: ten approved identities from source product `24` are absent from the healthy feed and remain isolated to review. Owner-approved run `33296119370` executed all 576 safe plans, including offer `221` stock `true` to `false`; its DB postflight hit a timestamp-representation false positive after apply.
- Simply Supplements: offer `670` remains isolated to review. Owner-approved run `33295723920` executed all 119 safe plans, including offers `578` and `649` stock `true` to `false`; its DB postflight hit an evidence-hash serialization false positive after apply.
- eBay UK: offer `2581` and mapping `2766` point to default variant `1178`, while the existing exact `405g` variant is `2920`.
- Source reads: the previously missing KIOR, GYM HIGH Store API and eBay retry paths now use bounded retry; production retry evidence is still incomplete.
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
8. The existing control ledger is the durable child-batch checkpoint: applied child ordinals are immutable and replay-blocked, and `resume_retailer_catalogue_parent_plan` exposes pending dependencies. Reviewed 6 Pack also writes executed, remaining and blocked offer IDs. Renewing an expired production parent remains an explicit owner operation; a local file is not treated as resumable authority.
9. Monitoring and reports are read-only. Production writes remain bounded by existing owner-approved scope and guarded RPCs.

## 6. Delivery sequence

| Phase | Deliverable | Status | Current next action |
| --- | --- | --- | --- |
| P0 | Close 6 Pack safely | COMPLETE | Exact rebind, reviewed `14/14`, ordinary freshness `506/506` and read-only idempotency are complete; evidence is recorded in the Group A checkpoint. |
| P1 | One cross-retailer inventory and priority | COMPLETE | Snapshot and workflow evidence below; Simply Supplements is the first retailer repair after the shared postflight/session contract. |
| P2 | Shared reliability core | COMPLETE | Shared validator/approver/executor role sessions and reusable manifest-scoped DB postflight are proven by 6 Pack, Simply and Whey Okay contracts. Adoption continues retailer by retailer. |
| P3 | Stabilize Simply, eBay, GYM HIGH, Whey Okay | PARTIAL COMPLETE / NEW DRIFT BLOCKED | Simply 119 and Whey 576 safe plans executed exactly. Approved eBay and GYM HIGH identity corrections completed; fresh validation isolated new unrelated drift at eBay offer `2582` and GYM HIGH mapping `3333` without apply. |
| P4 | Classify or refresh genuinely old offers | PARTIAL COMPLETE / OWNER BLOCKED | KIOR's exact eleven-row scope is refreshed and autonomous. Other legacy scopes remain grouped owner decisions. |
| P5 | Six-hour watchdog, retry and recovery | IN PROGRESS | Read-only watchdog `33305571284` recognizes KIOR end to end. 6 Pack is data-healthy but retains an evidence-only missing-stage signal; unrelated retailer gaps remain truthful. |
| P6 | Catalog Health reliability view | IN PROGRESS | Per-retailer DB freshness and no-in-stock metrics are live without changing Overall Critical. Workflow/review/cron state remains in the watchdog artifact until an approved shared read source exists. |
| Closeout | Verify every exit criterion and return to Operating Plan | NOT STARTED | Final evidence, commits, run IDs and clean `main`. |

### P1 read-only inventory

Database counts were captured at `2026-08-30T03:37:12.598Z`. Workflow evidence is from the latest five runs visible on 30 August. `Apply` means the scheduled workflow actually invokes a protected apply path; `DB PF` means an independent, role-bound database postflight rather than a second source dry-run. `Fresh` means unchanged rows are executable freshness confirmations. A dash means the repository or retained run evidence does not prove the capability.

| Retailer | Mappings / offers | Latest successful capture / apply | Latest DB PF | Oldest check | Stale >7 / >30 | Fresh | Safe updates | Review isolation | Retry | Idempotency | Cron apply | Current blocker |
| --- | ---: | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| GYM HIGH | 66 / 66 | source monitor `33269272837`; apply `32931853881` | source dry-run only | 2026-08-26 04:52Z | 0 / 0 | yes | yes | reviewed fixed scope | bounded Store API and product-page retry | source postcondition | yes | Run `33249118555`: live 71-row source passed, then the immutable feed binding/build failed. |
| Whey Okay | 870 / 870 | apply `33179855717` | source dry-run only | 2026-06-28 14:32Z | 284 / 284 | yes in protected plan | yes | classifier isolation, globally blocked on identity | source helper has retry contract; last used 0 | yes | yes | Run `33244661630`: healthy 1,705-row feed, `IDENTITY_DRIFT` for offer `16` with zero matches. |
| Discount Supplements | 156 / 156 | apply `33253485439` | source dry-run only | 2026-06-28 14:32Z | 142 / 130 | bounded approved subset | yes | yes in subset | source adapter only | yes | yes | Cron refreshes only its authorised subset; 142 offers remain outside effective freshness scope. |
| Dolphin Fitness | 3 / 3 | apply `33250721247` | source dry-run only | 2026-06-28 12:23Z | 2 / 2 | one approved row | yes for one row | fixed one-row scope | source helper | yes | yes | Two offers are outside the one-offer approved automation. |
| Simply Supplements | 120 / 120 | last DB freshness 2026-08-24 05:50Z; no success in latest five runs | none | 2026-08-24 05:50Z | 0 / 0 | intended | yes | no at missing-variant gate | source helper, last used 0 | intended | yes | Run `33250567937`: healthy source (269 products/468 variants), global `missing mapped variant safety limit exceeded`. |
| KIOR Health | 11 / 11 | dry-run `33305131273`; apply `33305173344` | `33305173344` PASS | 2026-08-30 09:54Z | 0 / 0 | yes | yes | per-row, zero review | bounded Shopify retry | yes | daily `37 7 * * *` | Complete for immutable exact eleven-row scope. |
| Fit House | 286 / 286 | apply `33245349979` | source dry-run only | 2026-08-29 09:23Z | 0 / 0 | yes | yes | yes | source helper | yes | yes | Healthy, but independent DB postflight is absent. |
| Jon's Supplements | 506 / 506 | apply `33249957540` | source dry-run only | 2026-08-29 11:22Z | 0 / 0 | yes | yes | yes | source helper | yes | yes | Healthy, but independent DB postflight is absent. |
| 6 Pack Supplements | 506 / 506 | confirmations `33272680452`; reviewed preflight `33274526268` | reviewed baseline passed in `33274526268`; apply PF not reached | 2026-08-20 03:56Z | 14 / 0 | yes | yes | executor checkpoints rows, but default-variant global invariant stopped at row 1 | bounded source retry | yes | yes | Owner decision required for offer `2006` mapping/variant drift. |
| eBay UK | 237 / 237 | last DB freshness 2026-08-25 06:12Z; no success in latest five runs | none | 2026-08-21 19:55Z | 21 / 0 | intended | yes | preflight currently global | bounded OAuth/Browse/item retry | intended | gated by `EBAY_REFRESH_ENABLED` | Run `33250919353`: offer `2581` has conflicting retailer-product variant evidence. |
| Predators Gear | 47 / 47 | last DB freshness 2026-08-29 13:32Z | no active scheduled refresh PF identified | 2026-08-26 20:33Z | 0 / 0 | not proven | reviewed artifact paths exist | reviewed batches | not proven | batch postflights | no active refresh cron identified | Fresh today, but no single active autonomous refresh workflow is registered. |

Inventory also found zero `never_checked` offers. Products without an in-stock offer by retailer were: GYM HIGH 3, Whey Okay 149, Discount 1, Dolphin 0, Simply 5, KIOR 1, Fit House 39, Jon's 9, 6 Pack 27, eBay 0 and Predators 0. These are coverage facts, not freshness failures.

**Single repair priority:** establish the shared role-bound DB postflight/session wrapper, then repair Simply Supplements first. Its source and coverage guards pass, while one global missing-variant threshold currently prevents every safe row from confirming freshness.

### Progress after the P1 snapshot

- KIOR adopted the shared protected executor without a retailer-specific database path. Commits `61979a6`, `58dfd26`, `0df11e2` and `f2fc780`, with migration seals `2a16db1` and `6281527`, register an immutable eleven-row manifest and daily schedule. Exact dry-run `33305131273`, apply `33305173344`, authoritative DB postflight and idempotency all passed.
- Formal read-only 6 Pack reconstruction proves the production data healthy with 506 no-change rows and no drift, but the current watchdog correctly cannot infer an original generic DB-postflight artifact. The closeout is `DATA_HEALTHY_EVIDENCE_INCOMPLETE`; no replay was performed.
- Fresh eBay run `33305286364` and GYM HIGH run `33305289178` isolated only the new identity rows described in the owner decision pack and performed zero writes.
- Shared protected-role session commit `0caa0af78d83584d8741105ac5f9352f956392d1` completed P2's connection foundation. Shared DB postflight commit `8a0d9033df08dba7f7b67b05a9dfadec9939ad56` added authoritative baseline/postflight verification for Simply.
- Simply dry-runs `33291309650` and `33291579003` are `PASS_WITH_REVIEW`: 120 approved, 119 executable, one `SOURCE_VARIANT_MISSING` review row (offer `670`), zero blocked and zero writes. The executable scope is 117 `VERIFY_NO_CHANGE` plus two `UPDATE_STOCK` rows (offers `578` and `649`, `true` to `false`). No apply was dispatched.
- eBay run `33250919353` is a real mapping/variant drift blocker for offer `2581`; no guard was weakened and no write was attempted.
- GYM HIGH run `33249118555` passed the 71-row live source audit and then exposed stale immutable control binding `4623:4623`; no write was attempted.
- Whey commit `dfe4a2c3a7742800975aa4da2c073c6ece09c882` reuses the shared per-row classifier and DB postflight. Dry-run `33292109660` is `PASS_WITH_REVIEW`: 586 approved, 576 executable, 575 `VERIFY_NO_CHANGE`, one `UPDATE_STOCK` (offer `221`, `true` to `false`), ten `SOURCE_VARIANT_MISSING` review rows, zero blocked and zero writes. Apply, baseline, postflight and idempotency steps were correctly skipped for the dry-run dispatch.
- Simply run `33295723920` executed `119/119` approved executable plans: 117 freshness confirmations and two exact stock changes. Three child executions are `APPLIED`, `price_history_delta = 0`, all entity/mapping deltas are zero and offer `670` stayed outside the executable scope. The read-only postflight stopped on a baseline hash computed before PostgreSQL `Date` serialization; this false positive is fixed by `0e8da89d288c6271c0051d7465b88184beb28c1c` and the apply must not be replayed.
- Whey run `33296119370` executed `576/576` approved executable plans: 575 freshness confirmations and offer `221` stock `true` to `false`. Twelve child executions are `APPLIED`, `price_history_delta = 0`, all entity/mapping deltas are zero and the ten review rows remained outside execution. Postflight stopped at offer `16` because it compared a PostgreSQL `Date` with its equivalent persisted ISO string; `5f32934a4e016fb5cc9f6fc59cc45e8610b0ee66` fixes that false positive. Do not replay this apply.

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
- At the initial snapshot KIOR and Predators had no registered autonomous refresh workflow. KIOR is now registered and proven; Predators remains outside this completed Group A scope.

Post-apply watchdog run `33296506999` (artifact `9727579813`) also completed read-only with `database_writes = 0` and accurately returned aggregate `FAIL`. It sees Simply `119/119` and Whey `576/576` execution contracts and their successful apply stages, but no authoritative DB-postflight artifacts because both original runs ended on the representation defects above. Database freshness now leaves only one Simply review row older than 48 hours and 284 Whey legacy rows older than 48 hours. No apply was replayed to manufacture a passing postflight.

Final read-only watchdog run `33305571284` (artifact `9730349176`) recognizes the KIOR capture/apply/DB-postflight/execution contract as `PASS`, with all eleven rows current. Its aggregate result remains `FAIL` for truthful unrelated evidence gaps. For 6 Pack it reports only `DB_POSTFLIGHT_SUCCESS_MISSING`: current DB data and the 506-row execution contract are healthy, but the original run did not retain the newer generic postflight artifact. `database_error` is null and `database_writes = 0`.

### P6 Catalog Health evidence

Commit `2fbe908` extends the existing authenticated `/admin/catalog-health` loader and page without a new data source. The dashboard now reports, per retailer, all active-catalogue offers, exact offers older than 48 hours, the existing >7-day and >30-day measures, never-checked offers, oldest/newest database check and products for which that retailer has no valid in-stock offer. Overall status and its existing Critical rule are unchanged.

The page explicitly does not infer workflow success, pending review or cron state from timestamps. Those remain authoritative in the six-hour watchdog artifact. Rendering them live in the web application needs an approved shared read source for GitHub workflow evidence; none currently exists in the application environment, so no token, migration or persistence layer was invented.

### P5 shared postflight adoption

Commit `0957dd0` extends the existing validator-only DB baseline/postflight to Discount Supplements (exact 14), Dolphin Fitness (exact one), Fit House (full 286), Jon's Supplements (full 506) and the ordinary 6 Pack 506-row workflow. Together with Simply Supplements and Whey Okay, seven retailer workflows now have the shared authoritative DB contract installed.

Each adopted workflow captures the read-only baseline after a passing source preflight, applies through the unchanged approver/executor path, verifies DB state before source idempotency and uploads the evidence in its existing artifact. Jon's one-row reviewed-price path and 6 Pack's reviewed MASS_OOS path remain explicitly outside the full-scope generic postflight. No commercial guard, permission, secret value or schedule changed.

Local targeted tests, `verify:quick` and `verify:full` passed. A local production baseline attempt stopped before connecting because the developer `.env.local` intentionally has no validator URL; no secret was copied and no DB operation occurred. Production proof for the five new profiles therefore remains pending their next existing scheduled runs, and the watchdog must continue to report missing DB-postflight evidence until those runs pass.

### P5 bounded source retry

Commit `9a67b33080b41b6d504e0d06ec5d11fdaebc9092` added one bounded transport helper to the three source paths that lacked retry: KIOR Shopify JSON, the GYM HIGH WooCommerce Store API catalogue and eBay OAuth/Browse/exact-item reads. It retries only transient network failures and HTTP `408`, `425`, `429`, `500`, `502`, `503` and `504`, with at most three attempts by default, per-attempt timeout and bounded backoff. Existing schema, identity, size and commercial guards remain outside the transport retry and therefore still fail closed without replay.

Targeted tests passed `117/117`; `verify:quick`, `verify:full` and `git diff --check` passed. The post-commit KIOR read-only capture `fc13a04e-fba0-49ae-9e85-0d80f3263ca5` read all 11 approved rows on its first attempt, reported zero price/stock/URL/identity drift, zero blocked rows and `database_writes = 0`. Its adapter report SHA-256 is `debe80262f3764ed96c948d2ed404672b568bac2b733a944c51676626487a170`.

The post-commit GYM HIGH full-catalogue read-only audit captured at `2026-08-30T05:14:46.230Z` also passed on its first Store API attempt: 26 parent products, 71 source rows, one approved existing mapping, zero production writes and report SHA-256 `bd3626dcd82338333094ddf5f5d701c3d7e4a993a024055ef7783dd5e1e15c93`. eBay production retry evidence remains pending its existing scheduled path; all retailer identity blockers are unchanged.

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
| 2026-08-30 | P5 | `9a67b33080b41b6d504e0d06ec5d11fdaebc9092`; KIOR capture `fc13a04e-fba0-49ae-9e85-0d80f3263ca5`; GYM HIGH audit `2026-08-30T05:14:46.230Z` | PASS / PARTIAL LIVE EVIDENCE | Missing KIOR, GYM HIGH Store API and eBay HTTP transports now use bounded retry. KIOR proved 11/11 and GYM HIGH 26 parents/71 rows read-only with zero writes; eBay scheduled evidence remains pending. |
| 2026-08-30 | P3 / Simply | Run `33295723920`; `0e8da89d288c6271c0051d7465b88184beb28c1c` | APPLY COMPLETE / PF EVIDENCE INCOMPLETE | Exact 119 executable plans applied, zero history/entity/mapping delta; postflight false-positive hash serialization fixed afterward. No replay. |
| 2026-08-30 | P3 / Whey | Run `33296119370`; `5f32934a4e016fb5cc9f6fc59cc45e8610b0ee66` | APPLY COMPLETE / PF EVIDENCE INCOMPLETE | Exact 576 executable plans applied, zero history/entity/mapping delta; equivalent review timestamp representation fixed afterward. No replay. |
| 2026-08-30 | P5 / P6 | Watchdog `33296506999`, artifact `9727579813`; Catalog Health read `2026-08-30T06:19:38.438Z` | READ-ONLY FAIL / CRITICAL | Zero writes. Watchdog truthfully reports missing PF evidence; dashboard is Critical because 208 active products lack a valid in-stock offer. |
| 2026-08-30 | P0 / 6 Pack | Reconstructed formal closeout and current DB postflight | DATA HEALTHY / EVIDENCE INCOMPLETE | 506 mappings/offers and 506 no-change rows; zero commercial, URL, mapping or history drift. Original generic DB-postflight artifact is absent; no replay. |
| 2026-08-30 | P4 / KIOR | `61979a6`, `58dfd26`, `0df11e2`, `f2fc780`; seals `2a16db1`, `6281527`; dry-run `33305131273`; apply `33305173344` | COMPLETE | Exact 11-row immutable scope; 11 freshness-only executions, authoritative DB postflight, zero history/commercial delta, idempotency PASS, daily cron active. |
| 2026-08-30 | P3 / identity | eBay `33305286364`; GYM HIGH `33305289178` | READ-ONLY / DECISIONS READY | eBay `2582` is a HIGH-confidence rebind candidate. GYM mapping `3333` is already correctly bound to exact `500g`; stale control config should later be corrected. Zero writes. |
| 2026-08-30 | P5 / P6 final | Watchdog `33305571284`, artifact `9730349176`; Catalog Health read `2026-08-30T10:04:20.684Z` | READ-ONLY FAIL / CRITICAL | KIOR PASS; 6 Pack evidence-only PF signal; aggregate gaps remain truthful. Dashboard Critical solely because 208 products lack a valid in-stock offer. Zero writes. |

## 9. Owner-required blockers

The detailed consolidated owner decisions and commercial deltas are in [Automation-Reliability-Owner-Decisions.md](./Automation-Reliability-Owner-Decisions.md). Group A is executed. The remaining decisions are:

1. **EBAY_2582 — HIGH / APPROVE_REBIND:** fresh evidence supports rebinding mapping `2767` and offer `2582` from Default variant `1179` to existing exact `30 Servings` variant `2910`, with no commercial, URL or history change. This is the only current approval block.
2. **GYM_HIGH_3333 — HIGH / KEEP_CURRENT:** live mapping `385` and offer `551` already point to exact `500g` variant `2972`. Keep DB state; later correct the stale control/bootstrap expectation `572 -> 2972` without production rebind.
3. **Legacy/review scopes:** decide grouped remediation for Whey ten source-missing rows and 284 identity gaps, Discount 137 executable plus five review rows, and Dolphin two identity gaps.
4. **Future automation authority:** decide the exact autonomous Predators scope and the read-only control-ledger projection for Catalog Health. KIOR authority is already bounded to and proven for its immutable eleven-row manifest.

No production apply is implied by these entries. Each approved operation must still use its existing protected workflow, fresh source capture, stale-state guards and DB postflight. Later ambiguous rows remain grouped into one bounded review report per retailer rather than individual interruptions.

## 10. Task after the sprint

Return to the existing Operating Plan sequence. The currently recorded next task is SEO-15's mandatory identity-proven accrual audit and readiness decision. The separate policy decision for the 208 products without an in-stock offer follows the reliability sprint and must not be silently folded into it.
