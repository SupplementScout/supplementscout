# Automation Reliability — Owner Decision Pack

## eBay Review Queue reconciliation artifact ready for owner approval - 31 August 2026, 17:10 UTC

GitHub dry-run `33418109981` completed successfully from commit `cf077e01a129775233a3d93a6a177bf502495b45` and produced artifact `9767810569`, `ebay-review-queue-reconciliation-33418109981-1`, ZIP SHA-256 `6293930120f0ab615ab4e7780f2f6ac40183793932e6d8518bfa7e1ddb03d88d`, report SHA-256 `79cd5f93ec0cf895466522aef3572e5d585ed9d56931974fa760a472c5e976e1`. The only successful job was `review-queue-reconciliation`; `refresh` and `review-execution` were skipped. No apply, replay, cron change or catalogue write was run.

The artifact binds source eBay dry-run `33409588643`, source artifact `9764693519`, source commit `57e9ecd5554b82d714d3b563f2ba322841fa1ef7`, source ZIP SHA-256 `0e0f4bb7e6fbd068d1b3dc5aa263632445c8b112328170cd1a8c8d947d14ed88`, source contract SHA-256 `ae3f1e452d899ab2e22e12b990e6c1b96c9e51d5c45263062c43d6a3ed63b75e`, source report SHA-256 `2a23876b94f0e4b2e51ac31a965d2b6f552ae0110bbf3217f16c2a4a994835b1`, source artifact content SHA-256 `a7e47e3fea7938ceebd50e15fcca6813b54ba8865a885489f48a3401092abffc` and source review scope fingerprint `63067cd5432f9fc37898a32c38ce5348353648f262eb801ed6948095a04d2572`.

Fresh baseline and plan are exact: queue rows `516`, audit events `422`, publication seals `0`, active eBay review rows `40`, products `1130`, product variants `2849`, retailer products `2808`, offers `2808`, price history `7113`, catalogue hash `7adab698d33a3a08b9b304b4d0f23e7ebbb7d3df9df3013ab0d90b5112ad6a51`, queue snapshot hash `0c8f3cbfbeb43d4eabca945a08de0c96df96005ddc5683926f50317e6c8c3b0f`, `CREATE 40`, `SUPERSEDE 40`, `REFRESH 0`, `RESOLVE_BY_SOURCE 0`, `EXPIRE 0`, expected audit delta `80`, final active eBay review rows `40`, catalogue writes `0`, publisher batch fingerprint `7fec143c13b159c6ef7c48d7682909d1534dd6ec447a82666c05591ab4f9da48`, changeset fingerprint `9c59149ca5162d69909b1597db5326ccd06116eac3e6c15d063ab3a6a195b3bc`, idempotency key `0766793aa53e88ff15cdd26dde93ab1b7841feb0388d25c679aadb40532b11bc`. The 40 review offer IDs are `2554,2582,2583,2584,2585,2586,2587,2624,2625,2626,2627,2630,2636,2637,2638,2642,2643,2646,2647,2648,2649,2650,2651,2653,2654,2655,2656,2686,2688,2695,2715,2727,2728,2735,2750,2758,2759,2760,2761,2770`; offer `2748` is excluded. Source contract expiry is `2026-09-01T15:38:44.505Z`.

Copy-ready approval line for the next phase, if the owner chooses to execute only this Review Queue lifecycle reconciliation:

```text
Zatwierdzam jeden produkcyjny Review Queue reconciliation apply przez publish_automation_review_queue_changes(jsonb) z commita cf077e01a129775233a3d93a6a177bf502495b45 dla eBay UK run 33418109981, artifact 9767810569, artifact ZIP SHA-256 6293930120f0ab615ab4e7780f2f6ac40183793932e6d8518bfa7e1ddb03d88d, report SHA-256 79cd5f93ec0cf895466522aef3572e5d585ed9d56931974fa760a472c5e976e1, baseline queue hash 0c8f3cbfbeb43d4eabca945a08de0c96df96005ddc5683926f50317e6c8c3b0f, catalogue hash 7adab698d33a3a08b9b304b4d0f23e7ebbb7d3df9df3013ab0d90b5112ad6a51, publisher batch fingerprint 7fec143c13b159c6ef7c48d7682909d1534dd6ec447a82666c05591ab4f9da48, changeset fingerprint 9c59149ca5162d69909b1597db5326ccd06116eac3e6c15d063ab3a6a195b3bc i idempotency key 0766793aa53e88ff15cdd26dde93ab1b7841feb0388d25c679aadb40532b11bc; zatwierdzam dokładnie CREATE 40, SUPERSEDE 40, REFRESH 0, RESOLVE_BY_SOURCE 0, EXPIRE 0, expected audit delta 80, final active eBay review rows 40 i catalogue_writes 0; nie zatwierdzam offer apply, commercial changes, identity/rebind apply, freshness apply, crona, replayu ani prac przy innych retailerach.
```

## eBay Review Queue reconciliation dry-run path; GitHub artifact required - 31 August 2026

A separate, dry-run-only eBay Review Queue reconciliation path now exists in the existing eBay workflow. It reuses the shared publisher request builder and current `product_match_review_queue` lifecycle model; it does not create a second queue, does not call `publish_automation_review_queue_changes(jsonb)`, does not approve/apply offers and has no production apply mode.

The source eBay offer-refresh artifact was verified read-only: run `33409588643`, artifact `9764693519`, name `ebay-offer-refresh-33409588643-1`, commit `57e9ecd5554b82d714d3b563f2ba322841fa1ef7`, ZIP SHA-256 `0e0f4bb7e6fbd068d1b3dc5aa263632445c8b112328170cd1a8c8d947d14ed88`, contract SHA-256 `ae3f1e452d899ab2e22e12b990e6c1b96c9e51d5c45263062c43d6a3ed63b75e`, report SHA-256 `2a23876b94f0e4b2e51ac31a965d2b6f552ae0110bbf3217f16c2a4a994835b1`, artifact content SHA-256 `a7e47e3fea7938ceebd50e15fcca6813b54ba8865a885489f48a3401092abffc`, review scope fingerprint `63067cd5432f9fc37898a32c38ce5348353648f262eb801ed6948095a04d2572`, expiry `2026-09-01T15:38:44.505Z`. It contains `237` approved mappings, `197` executable `VERIFY_NO_CHANGE`, `40` review rows and `0` blocked rows. Offer `2748` is not in this source review scope.

Fresh production baseline was read-only and unchanged by this work: queue rows `516`, audit events `422`, publication seals `0`, products `1130`, product variants `2849`, retailer products `2808`, offers `2808`, price history `7113`; active eBay review rows `40`; queue snapshot hash `0c8f3cbfbeb43d4eabca945a08de0c96df96005ddc5683926f50317e6c8c3b0f`; catalogue hash `7adab698d33a3a08b9b304b4d0f23e7ebbb7d3df9df3013ab0d90b5112ad6a51`.

Local dry-run rehearsal, using that source artifact and the fresh production baseline, produced only review-control-plane lifecycle operations: `CREATE 40`, `SUPERSEDE 40`, `REFRESH 0`, `RESOLVE_BY_SOURCE 0`, `EXPIRE 0`; expected audit delta `80`; final active eBay review rows `40`; catalogue writes `0`; publisher batch fingerprint `7fec143c13b159c6ef7c48d7682909d1534dd6ec447a82666c05591ab4f9da48`; changeset fingerprint `9c59149ca5162d69909b1597db5326ccd06116eac3e6c15d063ab3a6a195b3bc`; idempotency key `0766793aa53e88ff15cdd26dde93ab1b7841feb0388d25c679aadb40532b11bc`; report SHA-256 `8a60ca65f7e1317834f0fe14d3e01d1ed623b100b1baa9dee2f2bcef9a3a99e3`.

This local rehearsal is not an approval contract and must not be used as an apply line. A copy-ready owner approval may only be generated from a fresh manual GitHub Actions dry-run on `main` with `operation=dry-run`, `execution_mode=review-queue-reconciliation` and exact `reconciliation_source_binding` value `33409588643:9764693519:57e9ecd5554b82d714d3b563f2ba322841fa1ef7:0e0f4bb7e6fbd068d1b3dc5aa263632445c8b112328170cd1a8c8d947d14ed88:ae3f1e452d899ab2e22e12b990e6c1b96c9e51d5c45263062c43d6a3ed63b75e:2a23876b94f0e4b2e51ac31a965d2b6f552ae0110bbf3217f16c2a4a994835b1:a7e47e3fea7938ceebd50e15fcca6813b54ba8865a885489f48a3401092abffc:63067cd5432f9fc37898a32c38ce5348353648f262eb801ed6948095a04d2572`. Until that artifact exists, no Review Queue reconciliation apply, offer apply, replay, cron change, commercial change, identity/rebind change or other-retailer work is approved.

## Review Queue baseline hash fix; reconciliation approval pending fresh GitHub artifact - 31 August 2026

The owner-approved Review Queue reconciliation apply for eBay run `33382627453` / artifact `9754436306` was dispatched once and stopped fail-closed before any queue, audit, publication seal or catalogue write. Production RPC returned `AUTOMATION_REVIEW_PUBLICATION_BASELINE_HASH_MISMATCH`; no retry, replay, bypass, manual SQL or offer apply was run.

Root cause was in the publisher request generator, not in the SQL guard. The approved request hashed catalogue counts as strings, for example canonical JSON `{"offers":"2808","price_history":"7113","product_variants":"2849","products":"1130","retailer_products":"2808"}`, producing the stale hash `71961dec9830f74f9ee80996e6e69b670623733f4d6830bfa20cda61db4204bb`. Active production SQL builds the same five-table baseline as JSONB numeric counts, for example canonical JSON `{"offers":2808,"price_history":7113,"product_variants":2849,"products":1130,"retailer_products":2808}`, producing `7adab698d33a3a08b9b304b4d0f23e7ebbb7d3df9df3013ab0d90b5112ad6a51`.

Fix commit `e8bf9f73dd86021c18c7075f97a90aec9bea3ede` aligns `buildPublicationRpcRequest` with the active SQL contract by normalizing catalogue counts to numeric JSONB-equivalent values and hashing the direct five-table object. No production migration is required. The active production function definitions were verified read-only: `publish_automation_review_queue_changes(jsonb)` SHA-256 `4e14d782e86cf3636d1af3900fd94b16c14aadf2398a48324190ddab692fd75a`; `retailer_catalogue_sha256_json(jsonb)` SHA-256 `35d07d9e45fe5c891aa4eedc3336fa70615876c2c85a1ee64ffdb3c20800f4db`; `atomic_import_canonical_json(jsonb)` SHA-256 `f63fc33357e2e542797e8f990b6b18163aec157e566d100a145d1da83b4c44ce`.

Post-fix local read-only eBay offer-refresh dry-run is evidence only, not an approval contract: file SHA-256 `03b5ef6c49009f9ee2ad03a3f8baf95f117be76c0cf85c39245cc50117547f2f`; result `PASS_WITH_REVIEW`; approved mappings `237`; executable plans `197`; review rows `40`; blocked rows `0`; full capture fingerprint `3fe7e069e6556f0f9824becf044f1d86314683dda467ed66cc36a22d85acee4d`; executable source fingerprint `3543bb3687ef544be07c8faf05e82c1c1a6f6987bf00e046c3d7847af560758f`; review scope fingerprint `63067cd5432f9fc37898a32c38ce5348353648f262eb801ed6948095a04d2572`; plan fingerprint `0d6383a7c7a15190597dbff0b0c3303d2a8abfb0bf1168aab12d542309af5cb8`.

No new copy-ready approval line exists from this environment. The GitHub CLI is not installed and no `GH_TOKEN`/`GITHUB_TOKEN` is available, while the local runner correctly refused to emit an approval contract because approval contracts may only come from a manual main-branch GitHub dry-run. Required next step is a fresh authenticated GitHub dry-run from current `main`, then a new artifact-bound reconciliation manifest, report hash, baseline hash, publisher fingerprint, changeset fingerprint, idempotency key and expiry. The historical line below must not be reused.

## Review Queue transactional RPC deployed; reconciliation awaiting approval — 31 August 2026

Production migration `20260831110000_create_automation_review_queue_publication_rpc.sql` was applied from commit `b95bdf8b30465c1be6c799b3a27a56d2a5e208af` with SHA-256 `8680e3303a8b4b22025f85af83a59a8dafbebc91e97719e423af8dff79f28409`. The migration added only the shared Review Queue publication RPC and its idempotency seal table. It did not run live reconciliation, publisher apply, offer apply, replay, cron, approval RPC or catalogue DML.

Production postflight passed. Ledger count is `171`; canonical ledger fingerprint is `f3b5681787c3700883853be28032aea6cdf557f59af2017ef608fc55da540406`. `publish_automation_review_queue_changes(jsonb)` is owned by `postgres`, uses `SECURITY DEFINER`, has `search_path=""`, denies public/anon/authenticated execute, and grants execute only to `service_role`. `automation_review_queue_publications` has forced RLS, idempotency uniqueness, retailer index, and service-role select-only access. Fail-closed tests for invalid schema, unknown retailer, unknown operation, invalid idempotency key, stale expected baseline and disallowed role produced zero queue, audit, publication and catalogue deltas.

Read-only postflight counts remained unchanged: Review Queue `516`, audit events `422`, publication seals `0`, products `1130`, product variants `2849`, retailer products `2808`, offers `2808`, price history `7113`. Queue snapshot hash `46eb066439328e73a801a5a74847a4a638b19adaca835a0ea52a98d749093599`; catalogue hash `7adab698d33a3a08b9b304b4d0f23e7ebbb7d3df9df3013ab0d90b5112ad6a51`.

Prepared but not executed reconciliation dry-run: current production queue plus eBay run `33382627453` / artifact `9754436306` yields one eBay-only shared publisher changeset: `CREATE 41`, `SUPERSEDE 40`, `REFRESH 0`, `RESOLVE_BY_SOURCE 0`, `EXPIRE 0`; expected audit delta `81`; expected final active eBay review rows `41`; expected catalogue writes `0`; changeset fingerprint `8c1f16d8d3875129ded5835a09af1fe9491ec9b24f90e05f5fcb1bc6cdd426b3`; idempotency key `bf59bef527908a6a813c25b84bab63b0429ee31b26180918fe25ed2692eb0141`; expiry `2026-09-01T13:46:55.185Z`. Discount, Dolphin and GYM HIGH have no publisher lifecycle operation in this prepared changeset; Whey Okay is excluded because run `33382624165` failed closed on an active/conflicting session.

eBay offer `2748` remains review-only identity evidence, not an executable catalogue change: mapping `2934`, item `v1|354343324643|623744168324`, semantic fingerprint `32c17043f6c3c1b0181f707f7cdd312d9d69487a42042bfef1a0fe3f4efee86c`, blockers `BRAND_MISMATCH` and `UNIT_COUNT_MISMATCH`, review reason `UK_SHIPPING_UNKNOWN`, returned GTIN `6009544952923`, confidence `LOW`, recommended decision `MANUAL_REVIEW`.

Blocked historical approval line - do not reuse:

```text
Zatwierdzam jeden produkcyjny Review Queue reconciliation apply przez publish_automation_review_queue_changes(jsonb) z commita b95bdf8b30465c1be6c799b3a27a56d2a5e208af dla eBay UK run 33382627453, artifact 9754436306, report SHA-256 dd52ddd79281bd0c83360380200610f3ae1586df19671e409880bd1127122b3a, baseline queue hash 46eb066439328e73a801a5a74847a4a638b19adaca835a0ea52a98d749093599, catalogue hash 71961dec9830f74f9ee80996e6e69b670623733f4d6830bfa20cda61db4204bb, publisher batch fingerprint 7c922e905ec882b8fa412809530818804aad1fb7e95513367428a9653438d304, changeset fingerprint 8c1f16d8d3875129ded5835a09af1fe9491ec9b24f90e05f5fcb1bc6cdd426b3 i idempotency key bf59bef527908a6a813c25b84bab63b0429ee31b26180918fe25ed2692eb0141; zatwierdzam dokładnie CREATE 41, SUPERSEDE 40, REFRESH 0, RESOLVE_BY_SOURCE 0, EXPIRE 0, expected audit delta 81, final active eBay review rows 41 i catalogue_writes 0; nie zatwierdzam offer apply, commercial changes, identity/rebind apply, freshness apply, crona, replayu ani prac przy innych retailerach.
```

## Remaining scope grouped for owner decisions — 31 August 2026, 10:55 UTC

The remaining Automation Reliability scope is grouped but not approved for execution. No production offer apply, commercial change, identity change, rebind, manual SQL, catalogue creation or expanded freshness apply was run in this phase.

Source pack: `docs/rollouts/automation-reliability-remaining-scope-2026-08-31.json`.

Evidence summary:

- eBay first scheduled run after enablement has not yet occurred; next expected schedule is `2026-09-01T05:43:00Z` (`06:43` Europe/London). Fresh eBay dry-run `33382627453` is `PASS_WITH_REVIEW` with `196` executable freshness rows, `41` review rows and `0` blocked. Offer `2748` is a new review-only row versus the completed closeout; offer `2686` remains source-review-only.
- Discount Supplements dry-run `33382625827` is `PASS`: all `109` immutable-scope mappings are `VERIFY_NO_CHANGE`, with zero review, zero blocked and zero catalogue/commercial/history deltas.
- Whey Okay dry-run `33382624165` failed closed before source/apply because an active approval, workflow or conflicting session exists. It attempted/completed `0` database writes and `0` control writes.
- Dolphin local read-only dry-run passed for offer `2490` as `VERIFY_NO_CHANGE`, zero review and zero blocked. Existing Dolphin review rows `8` and `9` remain identity review only; no rebind or new variant was created.
- GYM HIGH validate run `33383167927` produced read-only source and variant-postflight artifacts with `PASS`; active review rows `550` and `551` remain mapping/control review only, with DB/source commercial state matching current evidence.
- Watchdog `33384346978` is aggregate `FAIL`, artifact `9754988581`, JSON SHA-256 `8dddab60cb8d92059ed178de9ea16518c372fac161bea3eb481128ba4fcc4357`. The failure is retained as evidence of remaining non-eBay gaps and fresh eBay review-scope drift, not as permission to replay eBay.

Prepared owner decisions:

1. **Freshness-only** — eligible for a future separate approval only through existing protected workflows. Discount Supplements has `109` `VERIFY_NO_CHANGE` rows; Dolphin has offer `2490` as one `VERIFY_NO_CHANGE`. Expected deltas are only `last_checked_at`; products, variants, mappings, offers, price, stock, shipping, total, URL and `price_history` stay unchanged.
2. **Stock and price** — review-only. Discount historical rows include `13` out-of-stock and `29` safe-update review rows; eBay has `7` price-review rows. These require a separate commercial decision and a refreshed owner-bound manifest before any apply.
3. **Identity** — review-only. Whey Okay retains `47` identity promotions, `3` exact rebind candidates, `132` manual identity rows and `2` mapping drift rows; Dolphin retains offers `8` and `9`; GYM HIGH retains offers `550` and `551`; eBay retains `33` identity/review rows including new offer `2748`; Discount retains offers `10` and `764`. No product, variant or mapping write is approved.
4. **Source problems** — review-only. Whey Okay has `100` source-failure rows, Discount has missing-source offers `871`, `873`, `875`, and eBay offer `2686` remains source-review-only. Missing source is not unavailable approval.

Copy-ready future approval blocks must be generated from a fresh run immediately before execution. Current evidence is a decision pack, not an apply authorization.

## eBay autonomous closeout — 31 August 2026, 10:09 UTC

The owner-approved eBay freshness closeout is complete without another offer apply or replay. Production apply run `33374870684` executed exactly `197/197 VERIFY_NO_CHANGE`; all `40` review rows, including offer `2686`, remained outside execution. DB postflight passed with postflight hash `0281412744d3034b9437cc79e9bb1ecac61019a569a58d2aa6d8adef8a62c40f` and file SHA-256 `35920e013b10518bdd6ee6fa899c3704464508cbf1f0dbf814f4349fc5b8d3e8`.

Independent read-only idempotency run `33378021842` matched the same semantic executable/review scope and returned zero blocked rows, zero executed plans and zero database writes. Watchdog run `33380240188` now reports the eBay row as `PASS` with split-run attestation fingerprint `fd2add2b2b2cf873595ad2f637c87c7edb6bc1aa50a0de5356816fc07bd12969`. The aggregate watchdog still reports other-retailer failures; no authority is inferred for those retailers.

The production effect is exactly `197` `last_checked_at` changes and zero price, stock, shipping, total, URL, mapping, product, variant, offer-count or `price_history` changes. Repository variable `EBAY_REFRESH_ENABLED=true` was read back at `2026-08-31T10:05:44Z`; the eBay workflow schedule remains `43 5 * * *` and gated to the existing autonomous `VERIFY_NO_CHANGE` refresh path.

Final read-only Catalog Health at `2026-08-31T10:09:03.147Z`: status `Critical`; active unmerged products `1088`; products without in-stock offers `208`; products with stale offers `278`; stale >7/>30 `343/322`; hash `4a1bb5df4adcd8e6f3b53ffb2fdbada92733071b42780f67bd27a0b187cf783a`. eBay has `237` offers, `40` older than 48h, `10/0` stale >7/>30 and `0` products without in-stock eBay offer; the stale eBay rows are isolated review rows, not executable confirmations.

## eBay executable-scope approval reset — 30 August 2026

The approval for dry-run `33329160827` is closed and cannot be replayed. Apply run `33330111793` stopped before approval/apply RPC because contract v1 bound volatile and review-only evidence into the manual source/plan comparison. No catalogue data changed. Contract v2 requires a new dry-run and new owner approval containing the full-capture, executable-source, review-scope and plan fingerprints plus manifest/report hashes. No eBay apply or cron enablement is currently authorized.

## eBay artifact-bound approval reset — 30 August 2026

The owner approval tied to dry-run `33327218721` was intentionally not executed. Audit proved that the previous manual workflow accepted only a static broad confirmation and could not verify the approved run ID, artifact ID, commit, semantic source/plan fingerprints, manifest hash or report hash before the approval/executor boundary. That run and every older eBay dry-run are therefore non-reusable for apply.

The replacement contract is fail-closed and requires one fresh artifact produced by the corrected workflow. A future manual apply must supply the exact dry-run ID, artifact ID, commit SHA, semantic source fingerprint, semantic plan fingerprint, contract-manifest SHA-256, report SHA-256 and an owner confirmation derived from the plan fingerprint plus manifest SHA-256. The workflow verifies GitHub repository/workflow/run metadata, artifact ownership and expiry, canonical file inventory, fresh semantic source/plan equality and exact DB before-state before the first approval/apply RPC. Capture timestamp alone is excluded from semantic equality.

No current line in this document authorizes eBay apply. A new exact line will be generated only from the first successful corrected dry-run. Commercial changes, identity changes, rebinds, offer `2686`, cron enablement and `EBAY_REFRESH_ENABLED` remain unapproved in this phase.

## Final eBay freshness apply approval boundary — 30 August 2026, 18:05 UTC

The fresh, read-only run `33326501229` on commit `88ec0a3311ac2197fd43c36a976e14ca81403482` produced the exact permitted partition: 237 approved mappings, 197 executable `VERIFY_NO_CHANGE`, 40 isolated review rows and zero blocked rows. Artifact `9736439158`; source fingerprint `f2710f56b68bf24e6156629d2d8c4bbea9685e993a2c4f09da2033a612ea9f81`; plan fingerprint `5d3f77c92bfd8c1d89ef5b15d1878f7c4aaf2a14341875caf1f965b8e9f59238`. The 40 review rows contain 7 price changes, 32 identity conflicts and source-failure offer `2686`; none is executable.

The production dispatch did not occur because the execution approval boundary required a new direct confirmation for this exact apply. No catalogue row, review status or execution request was changed. Cron remains disabled and `EBAY_REFRESH_ENABLED` remains absent.

Exact approval line required by the execution boundary:

```text
Zatwierdzam jeden produkcyjny eBay apply z runu dry-run 33326501229, artefaktu 9736439158 i commita 88ec0a3311ac2197fd43c36a976e14ca81403482: dokładnie 197 ofert VERIFY_NO_CHANGE z source fingerprint f2710f56b68bf24e6156629d2d8c4bbea9685e993a2c4f09da2033a612ea9f81 i plan fingerprint 5d3f77c92bfd8c1d89ef5b15d1878f7c4aaf2a14341875caf1f965b8e9f59238; nie zatwierdzam 40 review rows ani oferty 2686.
```

This line authorizes only the existing protected workflow, per-row approval/apply RPC, DB postflight and idempotency. It does not authorize commercial changes, identity changes, direct SQL, new entities or replay of historical runs.

## Review execution phase result — 30 August 2026, 15:33 UTC

The queue now separates owner decision from execution and records decision actor/time plus plan/execution evidence. `Approve decision` changes only Review Queue state. `Execute approved` must perform fresh source and DB validation and delegate to a registered existing protected retailer adapter; because no such server adapter is registered yet, the action currently fails closed and performs no catalogue write. This is a technical blocker, not a request for broader owner authority.

The 47 historical Discount rows are no longer actionable: exact reconciliation against owner pack SHA-256 `419c758d55affd2e2bd2a0730a953a25a750c4f62fb53c14a6da3089ee8f1737` and fresh no-change report SHA-256 `636dbb85458dc79f048ccdd966c74938c93405e3fb8da88d13e3c12efd32cc4f` changed them to `EXPIRED`. It created no replacement rows because fresh source reported 109 `VERIFY_NO_CHANGE`, zero review and zero blocked. This was a Review Queue lifecycle update only: all catalogue and commercial deltas are zero.

No new owner decision is inferred. The remaining 328 `PENDING` rows are Whey Okay 284, Dolphin Fitness 2, eBay UK 40 and GYM HIGH 2. Discount has zero active pending review rows. eBay fresh run `33319490141` still isolates 40 review rows and 197 safe confirmations, but cron remains disabled because independent idempotency evidence cannot be strictly correlated to the prior apply commit and immutable plan/postflight fields. All previous restrictions on commercial changes, identity changes, source-missing policy, offer `2686` and GYM HIGH remain in force.

## Unified Review Queue decision checkpoint — 30 August 2026, 14:51 UTC

The shared authenticated Review Queue is live at `/admin/automation-review`. It contains `375` pending records and zero blocked records: Whey Okay `284`, Discount Supplements `47`, Dolphin Fitness `2`, eBay UK `40`, and GYM HIGH `2`. Every row is fingerprinted, expires, records before/proposed/source evidence and has one immutable `CREATED` audit event. Queue presence is not approval and does not authorize catalogue writes.

Fresh evidence changes two operational conclusions:

- eBay run `33317674156` confirms the same safe partition: `197 VERIFY_NO_CHANGE`, `32` identity reviews, `7` price reviews, offer `2686` as source-failure review, and zero blocked rows. The 197 freshness confirmations were already executed by run `33315914106`; commercial and identity review rows remain unchanged.
- Discount run `33317675902` now classifies all 109 approved mappings as `VERIFY_NO_CHANGE`, including exact `95/95` for the Group A segment, with zero review, zero blocked and zero writes. Therefore the 47 older Discount queue rows must not be approved from their historical commercial snapshot. They require refreshed evidence or expiry; no Discount commercial operation is currently approved.

The UI may record approve/reject/ignore/rebind/unavailable decisions only after auth, exact fingerprint and expiry checks. It does not directly modify catalogue data. Approved rows still require a fresh source recheck and the retailer's existing protected approval/apply workflow; the generic queue-to-executor handoff remains pending implementation. Existing owner restrictions on commercial changes, rebinds, creates and unavailable decisions remain unchanged.

## Końcowy pakiet pozostałych decyzji — 30 sierpnia 2026, 13:35 UTC

**Status: `RELIABILITY_NO_SAFE_PROGRESS`.** W tej fazie nie uruchomiono żadnego produkcyjnego apply. Pełne dane każdego niewykonanego wiersza znajdują się w `docs/rollouts/automation-reliability-owner-pack-2026-08-30-final.json`; plikowy SHA-256 to `db5868c8d78ed67cdf00566421a07d9c5cabd4d0a328fb787542d7e95d42945a`, a wewnętrzny payload SHA-256 to `c3891eacd2427f45bf8866ac4eeaf997a8286ae7351578f3dcb0643083ff5e01`.

- Reconciliation `438` kontra `439`: JSON ma dokładnie 438 unikalnych wierszy. Liczba 439 w dokumencie obejmowała dodatkowy, późniejszy i niezależny drift GYM HIGH mapping `2796`, którego nigdy nie było w tym JSON. Nie ma duplikatu ani brakującego wiersza wewnątrz artefaktu.
- eBay: dwa fresh dry-runy (`33313875741`, `33314170314`) identycznie wykazały 197 `VERIFY_NO_CHANGE`, 32 identity conflicts, 7 zmian ceny i globalny `SOURCE_READ_FAILED` dla offer `2686`. Globalny guard zablokował cały apply; wykonano 0 planów i 0 zapisów. Offer `2582` pozostał jedną z 32 review rows; nie wykonano rebindu. Cron `43 5 * * *` pozostaje gated przez wyłączoną zmienną enablement.
- Discount, pozostałe 47: 20 `UPDATE_PRICE`, 2 `UPDATE_PRICE_AND_STOCK`, 18 `UPDATE_STOCK`, 3 `SOURCE_MISSING`, 2 `IDENTITY_MISSING`, 2 nowe `NO_CHANGE`. Dwa no-change są wyłącznie przyszłym draftem immutable scope; wszystkie 47 pozostały bez zmian.
- Dolphin: offers `8`/mapping `7` i `9`/mapping `9` mają działające strony i flavour-specific SKU, ale generic canonical variants bez zgodnego flavor/size/GTIN. Oba pozostają w manual review; promotions `0`, freshness `0`, writes `0`.
- Whey Okay, pełne 284: `EXACT_IDENTITY_PROMOTION 0`, `EXACT_SAME_VARIANT_FRESHNESS 0`, `EXACT_REBIND_TO_EXISTING_VARIANT 0`, `SOURCE_MISSING 2`, `COMMERCIAL_CHANGE 38`, `AMBIGUOUS_IDENTITY 49`, `VARIANT_CONFLICT 195`, `ALREADY_RESOLVED 0`. Nie obniżono wymagań SKU/MPN/GTIN, nie użyto nieaktualnych rebindów i nie wykonano zapisu.
- Końcowy Catalog Health: stale >7/>30 globalnie `354/322`; Whey `284/284`, Discount `47/36`, Dolphin `2/2`, eBay `21/0`, pozostali `0/0`. Produkty bez valid in-stock offer: `208`; Overall nadal `Critical` według niezmienionej reguły.
- Jedyny końcowy watchdog to run `33314564081`, artifact `9733037263`: oczekiwany zbiorczy `FAIL`, KIOR jako jedyny `PASS`, `database_error=null`, `database_writes=0`. Nie wykonano replay w celu odtworzenia brakujących historycznych dowodów.

### Grupy decyzji

| Grupa | Liczba | Wpływ przed zgodą | Ryzyko | Rekomendacja |
| --- | ---: | --- | --- | --- |
| A. HIGH confidence rebinds | 0 | zero | Żaden fresh candidate nie spełnia exact current-state contract | brak bloku zgody |
| B. Zweryfikowane zmiany handlowe | 85 | zero; wszystkie pozostają bez zmian | cena/stock i ewentualny `price_history` zmienią się po apply | osobna decyzja właściciela |
| C. Source missing/read failure | 6 | zero | brak w źródle nie dowodzi OOS; eBay ma powtarzalny source read failure | zachować stan do decyzji politycznej |
| D. Ambiguous identity | 280 | zero | ryzyko błędnego canonical mapping/variant | manual review, bez zbiorczego approval |

### Maksymalnie trzy bloki zgody

1. **Rebindy:** brak — nie istnieje fresh HIGH-confidence rebind spełniający guardy.
2. **Zmiany handlowe:** `Zatwierdzam wyłącznie zweryfikowane zmiany handlowe z grupy B artefaktu o plikowym SHA-256 db5868c8d78ed67cdf00566421a07d9c5cabd4d0a328fb787542d7e95d42945a, po fresh capture, exact fingerprint, approval per row, stale-state guard, atomowym apply, read-only postflight i idempotency; nie zatwierdzam żadnych rebindów, source-missing ani ambiguous identity.`
3. **Source missing:** `Zatwierdzam wyłącznie politykę source-missing z grupy C artefaktu o plikowym SHA-256 db5868c8d78ed67cdf00566421a07d9c5cabd4d0a328fb787542d7e95d42945a po niezależnym ponownym capture i per-row review; brak w źródle nie może samodzielnie oznaczać OOS; nie zatwierdzam zmian handlowych ani identity.`

## Wynik zatwierdzenia Grupy A — 30 sierpnia 2026, 12:55 UTC

**GROUP_A_PARTIAL.** Zatwierdzenie właściciela i plikowy SHA-256 `419c758d55affd2e2bd2a0730a953a25a750c4f62fb53c14a6da3089ee8f1737` zostały zachowane. Wykonano wyłącznie 95 Discount Supplements freshness confirmations; wszystkie 50 Whey Okay identity rows pozostało bez zmian w review.

- Immutable Discount scope zawiera teraz rozłączne segmenty: wcześniejsze 14 oraz zatwierdzone 95. Dry-run `33311985408` potwierdził dla nowego segmentu dokładnie 95 approved/executable `VERIFY_NO_CHANGE`, zero review, zero blocked i zero zapisów.
- Apply `33312063547` wykonał `95/95` planów istniejącym chronionym per-row workflow w dwóch atomowych batchach `48 + 47`. Zmieniono wyłącznie 95 wartości `offers.last_checked_at`. Cena, stock, shipping, total, URL oferty, URL mappingu, identity, produkty, warianty, mappings, offers i `price_history` mają deltę `0`.
- Pierwszy krok read-only postflight zgłosił false positive: PostgreSQL `Date` był porównywany przez `Date.parse(Date)`, co usuwało milisekundy. Commit `0023f70` poprawia tylko porównanie dowodu. Ponowny read-only postflight na tym samym baseline hash `03e72f24a3e11db1459bd9d8d0ac22eec45614b3585ba2b24f764430b271590b` i immutable apply artefakcie przeszedł: freshness `95`, wszystkie zmiany handlowe `0`, `price_history_delta=0`, postflight hash `2856f3bdff29cf866def22742be075e5e967d7c983901f87d62cab55ca7f08cb`. Apply nie został powtórzony.
- Idempotency dry-run `33312503131`, artifact `9732418393`, ponownie zwrócił dokładnie 95 `VERIFY_NO_CHANGE`, zero review/blocked i `database_writes=0`.
- Whey: identity promotions `0`, rebindy `0`, review `50`, blocked `0`. Wszystkie 47 promotion rows nie mają w świeżym EKM feedzie ani MPN/SKU, ani GTIN. Offer `301` proponuje optioned `Green` → `Default`; offers `302` i `303` prowadzą cross-product do nieaktywnych produktów scalonych do product `297`. Istniejące guardy prawidłowo blokują te operacje; nie utworzono bypassu ani ręcznej aktualizacji.
- Łączny wynik per-row Grupy A: identity promotions `0`, rebindy `0`, freshness confirmations `95`, review rows `50`, blocked rows `0`.
- Read-only Catalog Health z `2026-08-30T12:51:48.862Z`: global stale `354` >7 dni i `322` >30 dni; Whey `284/284`, Discount `47/36`, Dolphin `2/2`, eBay `21/0`, pozostali retailerzy `0/0`. Overall pozostaje `Critical` wyłącznie z powodu dokładnie `208` aktywnych produktów bez valid in-stock offer.
- Jedyny watchdog po rolloutcie: run `33312658549`, artifact `9732468399`, oczekiwany aggregate `FAIL`, `database_error=null`, `database_writes=0`. Dla Discount widzi `95/95`, ale nie modeluje jeszcze jawnie niewykonywanego segmentu wcześniejszych 14, więc raportuje evidence-only `APPROVED_SCOPE_PARTITION_MISMATCH`; nie jest to błąd danych ani apply.

Commity tego przebiegu: `2836d29` (immutable 109 + selector 95), `f6e450d` (production ledger seal), `0023f70` (read-only timestamp precision postflight). Grupy B, C i D oraz każdy inny retailer pozostają poza zgodą i nie zostały rozpoczęte.

**Stan dowodów:** 30 sierpnia 2026, 12:55 UTC

**Źródło prawdy:** [Automation-Reliability-Roadmap.md](./Automation-Reliability-Roadmap.md)

**Zasada wykonania:** ten dokument nie jest artefaktem apply. Zatwierdzenie pozycji nadal wymaga fresh capture, niezmienionego fingerprintu, approval per row, stale-state guardu, chronionego RPC i read-only postflightu.

## Końcowy Owner Decision Pack — 30 sierpnia 2026, 11:34 UTC

Ten checkpoint zastępuje wcześniejsze liczby robocze dla Whey Okay legacy, Discount Supplements i Dolphin Fitness. Pełny rekord każdego z `284 + 142 + 2 + 10` wierszy — nazwa, brand, flavour/size, URL, current product/variant, proposed identity, external IDs, GTIN, source evidence, confidence, current offer i klasyfikacja — znajduje się w [automation-reliability-owner-pack-2026-08-30.json](./rollouts/automation-reliability-owner-pack-2026-08-30.json). Plik ma SHA-256 `419c758d55affd2e2bd2a0730a953a25a750c4f62fb53c14a6da3089ee8f1737` (wewnętrzny canonical payload fingerprint `8b8e00b4106eac3de7fc6060d74db90100d47d2cf258b071f9452c9de5808c2`); produkcyjny snapshot wejściowy ma SHA-256 `d3810acd583cd3dd5e67a3a4ffd46b7c49fc3637d6ffd81aca995db35ab0c351`. Oba odczyty miały `database_writes = 0`.

Świeży Whey Okay feed (`2026-08-30T11:34:15.781Z`) przeszedł: 523 produkty, 1,705 wariantów, 1,009 in-stock, 696 OOS, semantic fingerprint `50b6757ea4b891bbc5be7cbd189e2a80d73c6391e24b425052ce71aa566f5da6`. Świeży Discount capture (`2026-08-30T11:28:29.507Z`) objął 341 produktów i 994 warianty. Obie legacy strony Dolphin zwróciły HTTP 200 i poprawny tytuł produktu.

### Dokładna klasyfikacja zakresów

| Zakres | Dokładny wynik świeżej klasyfikacji | Wniosek |
| --- | --- | --- |
| Whey Okay legacy `284` | 50 exact identity matches; 7 ambiguous; 2 source missing; 98 source unavailable/OOS; 123 variant conflicts; 2 mapping conflicts; 2 insufficient data; 0 URL conflicts; 0 GTIN conflicts | 47 z 50 exact rows to identity promotion bez zmiany canonical variant, 3 to rebind do istniejącego wariantu. Pozostałe 234 nie są freshness-only. |
| Discount stale `142` | 95 `NO_CHANGE`; 29 `SAFE_UPDATE`; 13 `OUT_OF_STOCK`; 3 `MISSING_FROM_SOURCE`; 2 identity conflicts | 42 wiersze handlowe zawierają 40 realnych mutacji: 22 zmiany ceny i 20 zmiany stocku; dwa OOS rows nie mają już field delta. Pełne before/after, GBP i procent ceny oraz guard result są w artefakcie. |
| Dolphin stale `2` | offer `8`/mapping `7`, **Ghost Legend V4 Pre-Workout 660g**, Ghost, Default variant `8`, URL `/440574`, brak external IDs/GTIN; strona HTTP 200, title **Ghost Legend V4 30 Servings**. Offer `9`/mapping `9`, **Optimum Nutrition Gold Standard 100% Whey 2.27kg**, Optimum Nutrition, Default variant `7`, URL `/16825/`, brak external IDs/GTIN; strona HTTP 200, title **Optimum Nutrition Gold Standard 100% Whey 2.2 kg**. | Stabilne page IDs są kandydatami external product identity, ale brak exact variant ID/GTIN; confidence MEDIUM, oba pozostają manual review. |
| Whey Okay `10 SOURCE_VARIANT_MISSING` | Wszystkie dziesięć exact source keys nadal nie istnieje. Parent `24` i URL nadal istnieją, parent nie jest cały OOS, brak alternatywnego wariantu z identycznym GTIN. Offer `1568` jest już OOS; pozostałe dziewięć jest zapisane jako in-stock. | Nie ma dowodu na mapping error ani bezpieczny rebind. Dziesięć pozostaje review; jawne unavailable wymaga osobnej polityki/zgody per row. |

Whey legacy dwa świeże `SOURCE_MISSING` to offer `119`/mapping `111` **Absolute Nutrition Thyroid T3 60 Caps** (`669:669`) oraz offer `428`/mapping `426` **NXT Nutrition Cream Of Rice 2kg** (`3327:3328`). Wszystkie pozostałe pełne listy, w tym 50 exact matches, 123 variant conflicts, 42 Discount commercial classifications i dziesięć brakujących wariantów, są w wersjonowanym artefakcie JSON, a nie w lokalnym `tmp`.

### Nowy, odizolowany drift GYM HIGH

Korekta immutable control dla `3333:3333` z wariantu `572` na `2972` jest poprawna i została wdrożona wyłącznie w konfiguracji w commitach `7c8b683` i `410453b`. Read-only DB potwierdza mapping `385`, offer `551`, product `516` **GYM HIGH Pure L-Arginine powder 500g**, variant `2972` **500g**, external `3333:3333`, GTIN `0691057494654`, URL `https://gymhigh.co.uk/product/gym-high-pure-l-arginine-powder/`, £26.99, in-stock; bez product/variant driftu i bez zapisu produkcyjnego.

Validation run `33308889173` potwierdził source PASS (26 parents/71 rows) i bootstrap PASS, po czym fail-closed zatrzymał się na jednym nowym driftcie `2796:2796`. Mapping `136` i offer `550` dla **GYM HIGH Shred Mode 60 Capsules**, product `508`, URL `https://gymhigh.co.uk/product/gym-high-shred-mode-thermogenic-fat-burner-capsules/`, £39.99, in-stock, są live na existing variant `2975` **60 Servings**; immutable control nadal oczekuje variant `435`. External GTIN brak. Ten wiersz ma confidence HIGH dla obecnego 60-serving bindingu, ale pozostaje w Grupie D; nie wykonano rebindu, zmiany controlu ani freshness apply.

### Grupy decyzyjne A–D

| Grupa | Oferty | Dokładny wpływ po osobnym zatwierdzeniu | Identity promotions | Rebindy | Cena | Stock | `price_history` delta | Nowe encje | Ryzyko / rekomendacja |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| A — HIGH identity/freshness | 145 | Whey: 50 reviewed identity rows; Discount: 95 freshness-only confirmations. Zero commercial, shipping i URL delta. | 47 | 3 | 0 | 0 | 0 | 0 | LOW/MEDIUM. Rekomendowane wyłącznie przez istniejący protected per-row path po fresh capture i exact fingerprint. |
| B — verified commercial | 42 | Discount: 22 price changes, 20 stock changes, 40 rows z realnym field delta i 2 już-OOS confirmations. | 0 | 0 | 22 | 20 | 22 | 0 | MEDIUM. Wymaga osobnego reviewed commercial approval; obecne guardy ceny/stocku pozostają bez zmian. |
| C — source missing/unavailable | 113 | Whey legacy 100, Whey active missing 10, Discount missing 3. Bez owner policy zero zmian. | 0 | 0 | 0 | 0 | 0 | 0 | HIGH. Nie oznaczać automatycznie unavailable i nie odświeżać timestampu. |
| D — identity/variant/manual conflicts | 139 | Whey 134, Discount 2, Dolphin 2, nowy GYM control drift 1. Brak zatwierdzonego wpływu. | 0 zatwierdzonych | 0 zatwierdzonych | 0 | 0 | 0 | 0 | HIGH. Manual decision per row; żadnego apply w tym przebiegu. |

### Jedyny nowy blok zgody — cała Grupa A

```text
Zatwierdzam Grupę A dokładnie z dokumentu docs/Automation-Reliability-Owner-Decisions.md i artefaktu docs/rollouts/automation-reliability-owner-pack-2026-08-30.json o plikowym SHA-256 419c758d55affd2e2bd2a0730a953a25a750c4f62fb53c14a6da3089ee8f1737: dokładnie 145 ofert, w tym 50 Whey Okay exact identity rows (47 identity promotions bez zmiany canonical variant i 3 rebindy do istniejących wariantów) oraz 95 Discount Supplements freshness-only confirmations. Zezwalam wyłącznie na istniejący chroniony per-row workflow po fresh capture, exact fingerprint, approval per row i stale-state guard, z zerową zmianą ceny, stocku, shippingu i URL, zerowym price_history i zerem nowych encji, obowiązkowym read-only postflightem oraz idempotency. Nie zatwierdzam Grup B, C ani D, eBay 2582 ani żadnego innego zakresu.
```

## Status wykonania Grupy A

**GROUP A: COMPLETED for the exact approved identity operations; rollout outcome: PARTIAL.** Owner approval was verified against commit `2b3b466fe95e5e90f0480a94b8ab49d5fecb3f7f`. The exact production migrations were applied under fingerprint `fd915307bf148bd4` and sealed at commit `02be396`.

- **6 Pack — COMPLETED:** mapping `2192` and offer `2006` now use exact variant `3126`. Fresh run `33300176675` reproduced the exact fourteen approved commercial rows. Reviewed run `33300883997` executed `14/14`, produced exactly thirteen price-history rows and six stock changes, and changed no mapping or entity count. Independent read-only verification passed; `ab8c319` corrected the post-write timestamp-representation false positive without replay. Ordinary run `33301481783` executed `506/506` freshness confirmations; row-level readback passed, the final optional-count false positive was fixed in `802c910`, and read-only idempotency run `33302525576` returned 506 no-change rows, zero review and zero writes.
- **eBay UK — COMPLETED for approved rebind:** mapping `2766` and offer `2581` now use exact variant `2920`; commercial fields and history were unchanged. Fresh run `33300177322` confirmed that exact row, then stopped without apply on new unrelated offer `2582` variant drift. Any remediation or ordinary apply now needs separate authority.
- **GYM HIGH — COMPLETED for approved control promotion:** immutable tuple `4623:4623` now expects exact variant `2973`; live mapping/offer and commercial fields were untouched. Fresh run `33300178041` confirmed this control and the 26-parent/71-row source, then stopped without apply on new unrelated mapping `3333` canonical drift.
- **KIOR — COMPLETE:** the exact eleven mappings now have a registered daily, fail-closed refresh using the shared protected importer. Dry-run `33305131273` classified exactly eleven `VERIFY_NO_CHANGE` rows. Owner-authorized apply `33305173344` executed `11/11`; DB postflight proved eleven timestamp-only changes, zero commercial/URL/mapping/history delta, and read-only idempotency returned eleven no-change rows with zero writes. Oldest check is now `2026-08-30T09:54:49.751Z`.

Implementation commits: `b78f4ec` (6 Pack binding), `2d84d36` (eBay binding), `3daa649` (GYM HIGH control), `7d80824` (Group A identity migrations), `02be396` (production ledger seal), `6a2fca3` (exact reviewed 6 Pack manifest), `ab8c319` and `802c910` (evidence-only postflight fixes), plus KIOR commits `61979a6`, `58dfd26`, `0df11e2`, `f2fc780` and migration seals `2a16db1`, `6281527`.

## Aktualne decyzje właściciela

### EBAY_2582 — APPROVE_REBIND

Fresh read-only run `33305286364` zatrzymał się przed apply dokładnie na ofercie `2582`; zero zapisów. Oferta `2582` i mapping `2767` dotyczą **Time 4 Digestive Enzymes 90 Capsules**, product `832`, listing `315370516891`, GTIN `5060420313208`, source option `Number of Pills: 90`. Oba rekordy wskazują dziś variant `1179` **Default**, podczas gdy istniejący aktywny exact variant `2910` to **30 Servings**. Zatwierdzone wcześniej exact-pack evidence dla tego samego produktu wiąże 90 kapsułek z 30 porcjami. Pewność: **HIGH**. Rekomendacja: **APPROVE_REBIND** mappingu `2767` i oferty `2582` z `1179` do istniejącego `2910`; cena, stock, shipping, URL i `price_history` bez zmian. Wykonanie nadal wymaga fresh capture, exact fingerprintu, approval per row, stale-state protection, chronionego atomowego apply i read-only postflightu.

### GYM_HIGH_3333 — KEEP_CURRENT

Fresh read-only run `33305289178` pobrał pełne źródło i zatrzymał się przed apply na canonical drift mappingu `3333`; zero zapisów. Source `3333:3333` to **GYM HIGH Pure L-Arginine Powder**, £26.99, in stock, URL `https://gymhigh.co.uk/product/gym-high-pure-l-arginine-powder/`. Mapping `385` i offer `551` poprawnie wskazują istniejący exact variant `2972` **500g**; GTIN `0691057494654` i dane produktu potwierdzają 500 g. Stary control/bootstrap manifest nadal oczekuje variant `572` **Default**. Pewność: **HIGH**. Rekomendacja: **KEEP_CURRENT** w bazie; osobna późniejsza korekta konfiguracji powinna zmienić oczekiwanie `572` na `2972`, bez rebindu DB i bez zmiany pól handlowych lub historii. Ta pozycja nie wymaga owner approval do zapisu produkcyjnego, ponieważ żaden zapis nie jest rekomendowany.

## Jedyna aktualna linia zatwierdzenia

```text
Zatwierdzam wyłącznie EBAY_2582: rebind eBay UK mapping 2767 i offer 2582 z variant 1179 Default do istniejącego variant 2910 30 Servings, bez zmiany ceny, stocku, shippingu, URL ani price_history, po fresh capture, exact fingerprint, approval per row, stale-state protection, chronionym atomowym apply i read-only postflight. Nie zatwierdzam żadnej innej operacji.
```

## Zatwierdzony zakres historyczny i pozostałe decyzje

| Grupa | Decyzja | Pełny kontekst i dowód | Pewność | Rekomendacja | Dokładny wpływ zatwierdzenia |
| --- | --- | --- | --- | --- | --- |
| A | 6 Pack: rebind offer `2006`, mapping `2192` | **Nordic Labs Long Jack Tongkat Ali 60 Capsules**, Nordic Labs, Health Supplements; URL `https://6pack-supplements.co.uk/product/tongkat-ali-long-jack-60-capsules/`; external `16448:16448`, SKU `5060803380070`, GTIN brak, flavour brak, rozmiar źródłowy 60 kapsułek/porcji. Product `982`; obecny variant `1922` **Default**; proponowany istniejący variant `3126` **60 Servings**. Fresh source potwierdza tę samą stronę i rozmiar, a atomowy importer blokuje default przy aktywnym exact variant. | HIGH | APPROVE | Zmiana wyłącznie `retailer_products.product_variant_id` i `offers.product_variant_id` z `1922` na `3126` istniejącą chronioną ścieżką; bez zmiany ceny, stocku, URL lub historii. Dopiero późniejszy nowy reviewed batch może rozpatrzyć stock `true → false`. |
| A | eBay UK: rebind offer `2581`, mapping `2766` | **Time 4 Collagen+ 45 Servings**, Time 4, Health Supplements; URL `https://www.ebay.co.uk/itm/313270204105`; external product `313270204105`, variant `v1\|313270204105\|0`, GTIN brak, flavour brak, source option **45 Servings - 405g Tub**. Product `831`; obecny variant `1178` **Default**; proponowany `2920` **405g**. Exact eBay evidence i istniejący exact canonical variant zgadzają się co do 405 g. | HIGH | APPROVE | Rebind mappingu i oferty do wariantu `2920`; cena £29.99, stock, shipping, URL i `price_history` bez zmian. Odblokowuje zwykły refresh eBay bez osłabienia variant guardu. |
| A | GYM HIGH: promotion immutable binding `4623:4623` | **GYM HIGH Creatine Monohydrate 400g**, GYM HIGH, Creatine; mapping `387`, offer `554`, URL `https://gymhigh.co.uk/product/gym-high-creatine-monohydrate-400g/`; external `4623:4623`, GTIN `0691057494883`, flavour brak, 400 g. Product `529`; stary control variant `507` **Default**; live mapping i offer już wskazują variant `2973` **400g**. Audyt Store API: 26 parents/71 rows, exact 400 g, zero writes. | HIGH | APPROVE | Aktualizuje tylko immutable approval/control evidence z `507` na `2973`; nie przepisuje live mappingu ani oferty i nie zmienia pól handlowych. |
| A | KIOR: 11 identity promotions | Jedenaście pełnych wierszy w tabeli KIOR poniżej. Każdy ma stabilny product/variant, cenę i stock oraz exact Shopify product/variant ID z zatwierdzonej konfiguracji. Read-only capture `fc13a04e-fba0-49ae-9e85-0d80f3263ca5`, scope hash `71e5d7d8dc62e15c1822e86f77d35f68d5e9e2e571aabf8a50e1d7439a9f4afb`, zero commercial drift i zero writes. | HIGH | APPROVE | Uzupełnia wyłącznie external product/variant identity i potwierdza freshness przez istniejący atomic importer; canonical product/variant, ceny, stock i historia pozostają bez zmian. |
| B | Whey Okay: 10 `SOURCE_VARIANT_MISSING` | Wszystkie dotyczą **Per4m Whey Protein 2kg**, Per4m, Whey Protein, URL `https://wheyokay.com/per4m-whey-protein-2kg-24-p.asp`, source product `24`. Szczegóły flavour/GTIN/mapping w tabeli poniżej. Healthy full feed ma 523 produkty/1,705 rows, lecz dokładnie te variant IDs są nieobecne. | MEDIUM | NEEDS_MANUAL_CHECK | Wybrać jedną politykę: potwierdzona trwała delistacja może zatwierdzić OOS per row; błąd/zmiana feedu wymaga korekty source identity. Do decyzji wszystkie 10 ofert pozostaje bez zmian. |
| B | Whey Okay: legacy 284 | 284 oferty poza nowym zakresem 586; wszystkie mappingi nie mają external product i variant ID, ale audyt nie wykazał konfliktu canonical mapping/offer. Pełny kontekst nazw, URL-i, źródłowych kandydatów, flavour/size/GTIN i ryzyk jest w lokalnym audycie `tmp/retailer-feeds/whey-okay/reconciliation/whey-okay-legacy-mappings-audit.csv`; zamknięty scope hash `d44049ef4256164520fc3a777a73dcb0d6db8203b8720851dcebaa8d06a64cd5`. | MEDIUM | NEEDS_MANUAL_CHECK | Najpierw zbudować reviewed identity manifest z jednoznacznymi kandydatami; dopiero potem grouped identity promotion. Nie wolno traktować tych 284 jako freshness-only. |
| B | Discount Supplements: 137 executable + 5 review | Read-only run `33292337530`, exact old scope 142, hash `0827d1041303ddf7daff8ac757625c81e2b6cd86e1d794f9883ca70f5ad40d7a`: 95 no-change, 29 safe update, 13 OOS; trzy missing-from-source i dwa bez source IDs pozostają review. Pełne zmiany są poniżej. | MEDIUM | NEEDS_MANUAL_CHECK | Zgoda na oddzielny protected 137-row manifest potwierdzi 95 freshness rows i zastosuje 42 sklasyfikowane commercial rows (40 realnych field mutations; dwa już-OOS confirmations); pięć anomalii bez zmian. |
| B | Dolphin Fitness: 2 legacy identity promotions | Offer `8`/mapping `7`: **Ghost Legend V4 Pre-Workout 660g**, Ghost, Pre Workout, product `6`, variant `8` **Default**, URL kończy się `/440574`; external IDs i GTIN brak. Offer `9`/mapping `9`: **Optimum Nutrition Gold Standard 100% Whey 2.27kg**, Optimum Nutrition, Whey Protein, product `7`, variant `7` **Default**, URL kończy się `/16825/`; external IDs i GTIN brak. Scope hash `65dbb2164937f56c6c78c80fe7353b4d84807947cc1400065289eff681681a7d`. | MEDIUM | NEEDS_MANUAL_CHECK | Potwierdzić, czy stabilne page IDs `440574` i `16825` są właściwymi source identities i czy wariant ma pozostać Default; dopiero potem uzupełnić mapping metadata bez zmian ceny/stocku/historii. |
| B | KIOR autonomous apply scope | Zakres dokładnie 11 zatwierdzonych mappingów, bez creates, z exact config SHA, kompletnym source snapshotem, per-row approval, globalnymi guardami, stale-state, atomic apply, DB postflight i idempotency. | HIGH | COMPLETE | Daily cron `37 7 * * *` jest zarejestrowany. Apply `33305173344` wykonał wyłącznie 11 freshness confirmations; zero commercial, URL, mapping i history delta. |
| B | Predators Gear autonomous apply scope | Proponowany zakres: istniejące 47 mappings/offers, bez creates i bez nowych identity decisions; source reader musi najpierw produkować kompletny snapshot i exact manifest. Guardy jak wyżej plus istniejące Predators reviewed exclusions, source-page/variation identity, no-SARMs/peptides policy i zero shipping contract. | MEDIUM | NEEDS_MANUAL_CHECK | Po osobnej implementacji i dry-runie pozwala codziennie potwierdzać tylko zatwierdzone 47 rows. Ryzyko: obecnie brak jednego zarejestrowanego end-to-end workflow i dowodu bounded retry, więc approval dotyczy zakresu projektu, nie natychmiastowego apply. |
| B | Dashboard workflow/review/cron | Minimalny projekt: czytać istniejący DB control ledger jako wspólne źródło parent/child planów, statusów, executed/executable/review/blocked i ostatniego DB postflightu; watchdog nadal dopina GitHub run URL. Bez nowej tabeli i bez drugiego checkpoint systemu. | MEDIUM | NEEDS_MANUAL_CHECK | Jedna read-only projekcja/RPC dla `/admin/catalog-health`; żadnych uprawnień zapisu z aplikacji. Wymaga osobnej decyzji o zakresie pól i retencji, potem testów kontraktowych. |
| C | 6 Pack: osobny batch 13 z pominięciem `2006` w obecnym mechanizmie | Obecny reviewed builder bierze wszystkie `review_rows` z zamkniętego fresh reportu; nie ma zatwierdzonego selektora wykluczającego jeden wiersz. | HIGH | REJECT | Nie tworzyć bypassu. Trzynaście zmian pozostaje bez wykonania do czasu rebindu `2006` i nowego pełnego reviewed capture/batchu. |

## Szczegóły pozycji grupy A

### KIOR — 11 exact identity promotions

W każdym wierszu proponowany canonical variant jest taki sam jak obecny; zmieniają się wyłącznie brakujące external IDs. `60 Capsules`/`Powder` jest dowodem źródłowym, nie żądaniem utworzenia nowego wariantu.

| Offer / mapping | Produkt; brand; kategoria | Obecny i proponowany variant | Shopify product / variant; GTIN | URL; flavour/size | Różnica i wpływ |
| --- | --- | --- | --- | --- | --- |
| `678` / `670` | KIOR Health Astragalus+ 60 Caps; KIOR Health; Health Supplements | `422` Default → `422` Default | `6717613539421` / `39821206192221`; `0-754590-525916` | `https://kior.uk/products/astragalus?variant=39821206192221`; 60 capsules | external IDs null → exact IDs; commercial state unchanged |
| `679` / `671` | KIOR Health Green Tea+ 60 Caps; KIOR Health; Health Supplements | `424` Default → `424` Default | `6825718546525` / `40172613533789`; brak | `https://kior.uk/products/green-tea?variant=40172613533789`; 60 capsules | jw. |
| `680` / `672` | KIOR Health Super Beets 60 Caps; KIOR Health; Health Supplements | `418` Default → `418` Default | `6717636903005` / `39821296009309`; brak | `https://kior.uk/products/super-beets?variant=39821296009309`; 60 capsules | jw. |
| `681` / `673` | KIOR Health Clear Mind+ 60 Caps; KIOR Health; Health Supplements | `416` Default → `416` Default | `6717637328989` / `39821296992349`; brak | `https://kior.uk/products/clear-mind-clear-focus?variant=39821296992349`; 60 capsules | jw. |
| `682` / `674` | KIOR Health Brain Wave 60 Caps; KIOR Health; Health Supplements | `415` Default → `415` Default | `6825707929693` / `40172596068445`; brak | `https://kior.uk/products/brain-wave?variant=40172596068445`; 60 capsules | jw. |
| `683` / `675` | KIOR Health Collagen Probio 60 Caps; KIOR Health; Health Supplements | `414` Default → `414` Default | `6758522355805` / `39962446921821`; `0-754590-525954` | `https://kior.uk/products/collagen-probio?variant=39962446921821`; 60 capsules | jw. |
| `684` / `676` | KIOR Health Turmeric & Ginger 60 Caps; KIOR Health; Health Supplements | `413` Default → `413` Default | `6758548078685` / `39962495746141`; brak | `https://kior.uk/products/tumeric-ginger?variant=39962495746141`; 60 capsules | jw. |
| `685` / `677` | KIOR Health KSM-66 Ashwaganda+ 60 Caps; KIOR Health; Health Supplements | `419` Default → `419` Default | `6766403551325` / `39984169058397`; brak | `https://kior.uk/products/ksm-66-ashwaganda?variant=39984169058397`; 60 capsules | jw. |
| `686` / `678` | KIOR Health Collagen Glow; KIOR Health; Health Supplements | `427` Default → `427` Default | `7067692138589` / `40939513741405`; brak | `https://kior.uk/products/collagen-yellow?variant=40939513741405`; Powder | jw. |
| `687` / `679` | KIOR Health Collagen Super; KIOR Health; Health Supplements | `492` Default → `492` Default | `7067692531805` / `40939514232925`; brak | `https://kior.uk/products/collagen-blue?variant=40939514232925`; Powder | jw. |
| `688` / `680` | KIOR Health Digestive Enzyme+; KIOR Health; Health Supplements | `457` Default → `457` Default | `6758526025821` / `39962452426845`; brak | `https://kior.uk/products/digestive-enzyme?variant=39962452426845`; 60 capsules | jw.; zachowuje obecny OOS |

## Szczegóły pozycji wymagających sprawdzenia

### Whey Okay — dziesięć nieobecnych source variants

Każdy wiersz pozostaje na obecnym canonical variant; „proponowany variant” jest celowo `brak`, ponieważ problemem jest nieobecność source identity, a nie znaleziony bezpieczny rebind.

| Offer / mapping | Obecny variant (pełna nazwa) | External variant; GTIN; flavour | Rekomendacja / dokładny wpływ |
| --- | --- | --- | --- |
| `16` / `12` | `1003` Strawberry Cream / 2kg | `25`; `5060660080021`; Strawberry Cream | MANUAL: sprawdzić delistację; bez decyzji zero zmian |
| `1506` / `1692` | `1117` Double Chocolate / 2kg | `27`; `5060660080007`; Double Chocolate | jw. |
| `1507` / `1693` | `1110` Chocolate Peanut Butter / 2kg | `29`; `5060660080069`; Chocolate Peanut Butter | jw. |
| `1508` / `1694` | `1102` Blueberry Muffin / 2kg | `1498`; `5060660080342`; Blueberry Muffin | jw. |
| `1509` / `1695` | `1114` Cinnamon Donut / 2kg | `1499`; `5060660080328`; Cinnamon Donut | jw. |
| `1510` / `1696` | `1121` Lemon Cheesecake / 2kg | `1500`; `5060660080083`; Lemon Cheesecake | jw. |
| `1511` / `1697` | `1126` Salted Caramel / 2kg | `1501`; `5060660080106`; Salted Caramel | jw. |
| `1512` / `1698` | `1129` White Chocolate / 2kg | `1502`; `5060660080366`; White Chocolate | jw. |
| `1568` / `1754` | `1100` Banana Cream / 2kg | `26`; `5060660080144`; Banana Cream | jw.; oferta już OOS |
| `1584` / `1770` | `1578` White Chocolate Raspberry / 2kg | `1503`; `5060660080120`; White Chocolate Raspberry | jw. |

### Discount Supplements — pełne zmiany handlowe

Exact 42 sklasyfikowane commercial rows obejmują 40 realnych zmian pól oraz dwa już-OOS confirmations. Shipping, URL, mapping i identity delta wynoszą zero. Price changes = 22; stock changes = 20.

| Delta | Oferty i pełny kontekst wariantu |
| --- | --- |
| £44.99 → £49.99; stock bez zmian | Applied Nutrition Critical Whey 2kg: `848` Banana, `849` Banana Strawberry, `850` Caramel Latte, `851` Choco Hazelnut, `853` Cookies & Cream, `854` Frappuccino, `855` Salted Caramel, `856` Strawberry, `857` Vanilla, `858` Vanilla Matcha, `859` White Choco Hazelnut, `860` White Chocolate Pistachio — wszystkie 2kg |
| £44.99 → £49.99; stock false → true | `852` Applied Nutrition Critical Whey 2kg — Chocolate / 2kg |
| £69.99 → £74.99; stock bez zmian | Applied Nutrition ISO-XP 1.8kg: `768` Chocolate, `769` Strawberry, `770` Vanilla |
| £69.99 → £74.99; stock true → false | `767` Applied Nutrition ISO-XP 1.8kg — Banana |
| £42.99 → £44.99; stock bez zmian | Applied Nutrition Critical Mass Gainer 6kg: `817` Banana, `818` Chocolate, `819` Strawberry, `820` Vanilla, `821` White Chocolate Bueno |
| stock false → true | `773` Applied Nutrition Pump 375g Rainbow Unicorn; `872` CNP Loaded EAA 300g Pink Lemonade; `878`/`879`/`881`/`886` XL Nutrition XTRA Whey 2kg Chocolate/Chocolate Bueno/Coconut Cream/Vanilla; `891`/`893` DY Nutrition Shadowhey 2kg Cookies & Cream/Vanilla |
| stock true → false | `835` ON Gold Standard BCAA 266g Peach & Passionfruit; `838` BSN NO-Xplode 390g Green Burst; `865` Efectiv Whey Isolate 2kg Chocolate; `870` CNP Loaded EAA 300g Cherry Cola Bottles; `823`–`826` USN Muscle Fuel Anabolic 4kg Chocolate/Cookies & Cream/Strawberry/Vanilla; `899`/`901` Applied Nutrition Beef Mass Gainer 3.13kg Blackcurrant Millions/Frozen Berries |
| już OOS, bez field delta | `822` USN Muscle Fuel Anabolic 4kg Banana; `1502` Trained By JP EAA + Hydration 300g Sour Watermelon |

Anomalie pozostające bez zmian:

| Offer / mapping | Produkt i source identity | Powód |
| --- | --- | --- |
| `871` / `1057` | CNP Loaded EAA 300g; `6080779157700:42327028400324`; URL z tym wariantem | exact external variant absent from complete source snapshot |
| `873` / `1059` | CNP Loaded EAA 300g; `6080779157700:40636760162500` | jw. |
| `875` / `1061` | CNP Loaded EAA 300g; `6080779157700:42327028433092` | jw. |
| `10` / `10` | pełna nazwa/source candidate nieustalone | mapping nie ma external product ani variant ID |
| `764` / `950` | pełna nazwa/source candidate nieustalone | mapping nie ma external product ani variant ID |

## Historyczna zgoda Grupy A

Historyczna zgoda Grupy A została wykonana i nie jest ponownie używalnym approval blockiem. Jedyną aktualną linią zatwierdzenia jest blok `EBAY_2582` powyżej.
