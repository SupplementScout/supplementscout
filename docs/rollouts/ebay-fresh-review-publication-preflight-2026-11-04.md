# eBay fresh Review Queue publication preflight — 2026-11-04

## Decision

**B. CONTRACT_STILL_BROKEN — NO PUBLICATION.**

The fresh source capture and shared reconciliation both passed, and the
`HARD_PRICE_ANOMALY` regression is fixed end to end. Publication of this exact
fresh batch is nevertheless unsafe because three current commercial rows use
`UPDATE_PRICE_AND_STOCK` with `PRICE_AND_STOCK_CHANGE`, while the eBay execution
adapter supports only `VERIFY_NO_CHANGE`, `UPDATE_PRICE` and `UPDATE_STOCK`.
The three affected offers are `2749`, `2769` and `2774`. The publisher accepts
them as Review Queue rows, but the protected worker cannot resolve an adapter
for them. The required zero-unsupported-commercial-operation gate therefore
fails at `3`.

No Review Queue publication, owner decision, execution request, worker
dispatch or catalogue write was performed.

## Scope and repository preflight

- Starting `main`: `2c359bb958280b9cc7c87dbcecc53b4defa50273`.
- Production project: `aftboxmrdgyhizicfsfu`.
- Audit branch: `audit/ebay-fresh-review-publication-preflight` in a clean
  isolated worktree. Unrelated owner work in the primary worktree was not
  touched.
- PR `#478` is merged at the starting `main` SHA. Its final-main Project
  Guardian run `41904405351` and Quality Gate run `41904405293` passed.
- The governed production verifier passed with ledger count `259`, fingerprint
  `d21a4044df80270db476bd264a9a4da19e90fe15310b2b918487ce4c480978af`
  and exactly one applied identifier
  `20261104120000_allow_automation_review_hard_price_anomaly`.
- The live function
  `public.publish_automation_review_queue_changes(p_request jsonb)` has one
  overload, is `SECURITY DEFINER`, retains `search_path=""`, contains
  `HARD_PRICE_ANOMALY`, and retains the fail-closed
  `AUTOMATION_REVIEW_PUBLICATION_ROW_CONTRACT_INVALID` path. Definition SHA-256:
  `54c295ca09cbe948958980f92b918563a364b1a6546a57076202b7af09e90999`.
- Project Guardian passed before the audit. `SEO-20` remains the sole SEO task
  `IN PROGRESS`. The broad P1 category cleanup remains closed.

## Safe dry-run proof

The current workflow and the required producer, reconciliation, publisher,
profile, registry and adapter files were inspected before dispatch.

| Path | Fresh source read | Offer/catalogue apply | Queue publication | Approval or execution request |
|---|---:|---:|---:|---:|
| `operation=dry-run`, `execution_mode=catalogue-refresh` | Yes | No | No | No |
| `operation=dry-run`, `execution_mode=review-queue-reconciliation` | Uses exact fresh artifact | No | No | No |

The catalogue-refresh dry-run invokes `ebay-offer-refresh.js` only with
`--mode=dry-run`. `prepare-apply`, database baseline for apply, approval
verification, `execute-apply`, postflight and idempotency-after-apply are all
guarded by `operation=apply` and were skipped. The `refresh-review-queue` job is
also apply/schedule-only and was skipped. The producer made bounded eBay Browse
API reads and wrote only local evidence files.

The separate reconciliation run required `operation=dry-run`, exact eight-part
source binding and `main`; its catalogue-refresh and queue-publication jobs were
both skipped. `automation-review-reconciliation-dry-run.js` read the production
baseline and built one RPC-shaped request in memory. It did not call the RPC or
use direct REST writes.

## Fresh source evidence

This evidence is new and is not the historical failed batch.

| Evidence | Value |
|---|---|
| Fresh source run | `41905828377` |
| Source run event / head | `workflow_dispatch` / `2c359bb958280b9cc7c87dbcecc53b4defa50273` |
| Capture timestamp | `2026-11-04T20:22:19.855Z` |
| Contract expiry | `2026-11-05T20:22:19.855Z` |
| Artifact ID | `13359999389` |
| Artifact name | `ebay-offer-refresh-41905828377-1` |
| Artifact digest | `491106ff7e9f222a3c5ec3c86e7a1dd1bccd01e9fe377fb2611fd8bdcc58a8bc` |
| Contract SHA-256 | `f10b80f38543fa95bbcacc3e67e220a51aa3f978db9a585f1752d246b9dc799a` |
| Report SHA-256 | `326b17ba1da51651a4970d4384f2add9cb937896ab7fc27da46597d56d5c2478` |
| Artifact-content SHA-256 | `58afdd5a889533ba23f5bb353936aaaa69f19200dca65c8df8cd4b1f32f93511` |
| Full-capture fingerprint | `efe48c1a22a6dceaba49c609b4a7e7b5987eb251f52d9854e9159575331ac9b6` |
| Executable-source fingerprint | `2d8457827a6f8dc768619d27f9fe7279c77edccc483329c8b4027db84dbe5cd5` |
| Review-scope fingerprint | `2a3d873b10ee11290af61f960e0ec5bbbcdc37db769c9ca606aaa748b73aac00` |

The source result was `PASS_WITH_REVIEW`: all `237` approved mappings were
observed, `153` were `VERIFY_NO_CHANGE`, `84` entered review, and there were
zero blocked rows. The prepared commercial classification was `12`
`UPDATE_PRICE` and `3` `UPDATE_PRICE_AND_STOCK`; the remaining review rows were
identity or source isolation.

Historical run `41836635201` reused: **NO**. Historical artifact
`13328715529` reused: **NO**. Historical 85-row manifest reused: **NO**.

## Production baseline and zero-write readback

The first repeatable-read transaction was captured at
`2026-11-04T20:23:38.773Z`. Independent post-dry-run readbacks through
`2026-11-04T20:35:43.838Z` returned the same values.

| Relation | Before | After | Delta |
|---|---:|---:|---:|
| `product_match_review_queue` | 3,445 | 3,445 | 0 |
| `product_match_review_events` | 9,808 | 9,808 | 0 |
| `automation_review_queue_publications` | 195 | 195 | 0 |
| `automation_review_execution_requests` | 292 | 292 | 0 |
| `offers` | 4,361 | 4,361 | 0 |
| `retailer_products` | 4,361 | 4,361 | 0 |

Current eBay database state is `440` total review rows: `77 PENDING`,
`4 APPROVED`, `0 EXECUTING`, `299 EXPIRED`, `56 EXECUTED`, `3 REJECTED` and
`1 FAILED`. There are `81` status-active `PENDING/APPROVED` rows across `81`
offers, `359` completed/history rows and `145` distinct offer IDs across all
history. All 81 status-active rows have expired evidence, so the exact current
admin summary is `DECIDE 0`, `EXECUTE 0`, `PROCESSING 0`, `TECHNICAL 0`,
`COMPLETED/current 145`.

The 81 active source fingerprints were bound by queue snapshot SHA-256
`beb668ea7c38c280a191957e85d2276246d8371299e97a74f990b2334df83f86`.
Their exact sorted set is:

```text
001419d02dea1e0c22d408215dd14680e0cc5824e70018d20570fae6dfbcffa1
044eb37c1e571d39f06de7bc7dfb0b17f56670c663960eb827a3805057dae3a5
0823306240bffe7d5dda33ef083de9845492bf8f8b5667a235d2d5c900ada80e
089c563dad595aacfaa182486b0f8b2176fe6a0ff5700411e10c44a2bc0b5052
0d33680f92eb90136c286bc296acd0aad438408cd3ccb3f657b1a96c39fbb006
0ef327b2d75824d369ab08518066960eb6cf26fcaf2c8778ea009bb8b35d16de
16bc353a2d3181d69bb332837bd2236d97cb6a12a5474978af6cf69a5203cd76
18937ca8d4b51667e75aae55a98fa5fc013df372f32c116ac4b045646efc17ec
1953b06de6ec08650b8d5642e5f059a9bfe7e20801299e71b4c9427913a5049c
1a11e0ee8f61b4c513e17183e5da2a3ed73571fffc3919300f7f49d734bc849b
1c598ae47c7bc7596498ea48c4911e457a683c8ce4c9bee89724c4535b49a8cb
1e8aec0c55034c85d070a4609a8bfa7b41945b6da9963f4961333f362db21258
23816832e35825aa62066d68842cc5561855826199323b23b8f3b4e15d2bc691
2b50e4b577b2bddaba27085f185a50c80a2b42f4865ad07679404d8a3b304ca8
2bf20b60e2cb54391a5c3c06dbcd96df728091c7da54e8c1a6d4616863a4435c
351c54500ee0745e98a79908cd0daef2e6a58f335ccc02895b59cc59867a5e20
36b2ea19c72fc904ff2c968231a27ce61bac377f93faafbe6fc7afc171a7bcb0
3a9ecf6e25712d2e879ecef0cf7009620d9b6197ff41b2f7ef01522e0139218e
3aaa095344e489f3f08eede8183c18b142e20690a1e1f561b6d34b95a3b3f02f
3b74892471e045bdf8a0b5d4bc6c9b1284978084b0dddf150d500fdb9082af61
44c6a7ac145300e726271107c87685d6bf6af4796f40b996d03b67bf954e79e6
4e8ec41f24792bcbc991a20350673a2fa6efd4263349469f414e715289251670
51a814956062388d82272b6226d0197f077ff623634afe4320e881c124229f11
55b70ff3b3a3c879dff84c76d10083b8233d50f1d1b6debfe8da9ed16ae4a0c3
5896e1709b605f85eb5fa731d57d1be62a5a46c1740b6831df4676fce5145c6f
59784aba21e979465c4d4cb407f157ad2effe4884db8215e219310bc6912566c
5ba5ec372d0372762d16cbb7d973b8f1d8e8da31eef2a945a26a41b08e6fdcac
637a657aedd8c0cea30ea7276b6941141f7328774cd0968f516e8ab1627ed35c
64c3fd8396f1e991983c63358647655e792491fae9e540c7425cf526c17a77a8
670aa894e54ad13c8b74d806a96246ebcc3ad246f2023a1783cec27857399fde
68e5d922838e810d3e39e070d04431323312eb0a0068028c1bdc028e313df580
6cc3b57051e70a3422ed73c0195947c6696f7ce210af69826e77837b1eeeb56b
6dda1ab467751abf5e7a8fa5f46e421841f551bae850ddff3ee424b05b527622
6e0bd5ae9f7f3acefb4557e6ae40f60355eed031f484a68b45b0b5b91ea01077
6f81712051998cd6cef167a2d79925db88ca8d02d9da18c7e0479327095646ad
77a1dc6687b7e05673526af5aaebfc6aa49f6022927ac6e857a7cf49f155158d
7c94ab77087a47e5fdb816ce517b97f1a033873accce9e4ae3f1c1246b140d74
82c58cfaffc20d1a0ace5c3dee1226b62eb332be60f5d65bdda7d2d16cb86c77
84e7e6d1e59a3341ad7b1938d70f9838107bf3b02f13a9192ecc207c5361c31e
8a7a6f1f5081577d4579313aae49234344ace3ddd89f1409fa0e44bde70add61
8be2fa187a4fdd12723aaef74fb003613ecaea6128ab564658d56385cb5182a9
921fbd5aa3ef08bc4e799d6b047ba70930118dbf9c3ce8c4f1545f4d371fa27c
92e225457b304b075577f6ee30b1b1fc96c065d311cba04d401ddd5dd7538532
97058b43177260279cdaad91bb59f096b5d679bf7b72c7378e4703413d27dd16
9749993e2aedda9a6c39fcb88123cfac778aa66b4eb1484ba0bc707574037940
9a3fc6ff7321cffe04427e115f8fa51aea33c10698e964b2b1656667b5d9778d
9aa85dad25a90a7e9ea03a9aa46f7b6ae06b90502df6b279ee9d45ec7708e4f8
9c29659dd0622b2d65a0f2f4c2b12ab0210f6b1a32a6157effa430772f588e47
9c84ab3c65770bdec7d066afb2a8ef20bfafbb5f8800c698c3a4fca2c6f7f166
9da0073936c3bea77f6352b697179238dd2b217a650269464441e5b453c6baae
9ff526e82c130d20f3f6e9354f6b42b936080dc052caa935faa8cb7876f5d18c
a170751ffc1b0ddf885ea560e00cb11ca5e13ae99f9c6542ee58bbb0f4216616
a3635c6ec10588bed25d960f3e6f2f98c86b1930144e77ebb93380eef0fa5c74
a3c5ec80b4347436151d1f20cef9636d7dce995ee9fd28e1e6117ad9bd056f2e
a58f41f7b941ca31021a465d09d10fb888956b2f8f0984ccd4604662859540db
a665b5371a7743b4a522a97bed030ddac83a3989cad5f7970567b49089727f96
ae7aa5d73afd21032255d834488aa25cfd98e865e093c8900f3f6c679eebfdc2
b32379a45823f59fd11fcdb95da5add3d6f45ffdc4701cfcccf88407de7af510
b4f572df5c4a9de4316260d03a082ee2247207e7a1cde02a00cba427f5f38be8
b6f4479564a7a682a665ed5dd1d83bc456059053c4eb6c0f875051355ca54173
b963363234e868b75f495358a3831f301181e28a35ea500c5180ec6552c94ece
b976823758f2756e82391707ffe9acd276f60e8b409bcf2d955ee9e2f299c78e
b9e6aa11814995d75400572ec3c32123b59db0130f888e6635a8be94458ed8d6
ba833619e707df0a9baedd0f57fdd368e8e7f71f919571677406be5cb37075ee
bddbd265b10d441a520e61ce472ddb8d4d0b8b7ae4b651fab62294a57ebebf54
c2abebce94fbc10bc0fd643ebc9fbfbad1c923332ba8f6b2000c4b154cef395a
c824bd5ae8251e36871a872bd31ef9f8849a30b17c7422dc30b9e7e5e1fcbbd8
ca18c8921b11730fd0d69b4b932470f1826c11c4298df308661caa9ba6b5fd90
cb6815e282262335cf9aba9f605f6b298f6d60e4a2f8d952074fcacc0210307f
ce38cb7d5e16a2c38d38adbd6a8a714b1522f7d6d9d3d5943023e6b2fd028c5a
ce3fe41068405ad821accd0669e59a2e3b0bb79bd41aae5330ca8e1498dc9f2d
d17257969fc9a70fc0cbadf2a76c3b6875bfc527e60417ac3f4cd62801cb3fc7
d41d90e33ef2e74bf48f9dc55a8dfe297d2df2fa170a6c0aaab6c5eeef1b4a85
d5a92ede00e614a07f4fb170a4e6acbccd66a610ef8ea9830a3ee1fb90e01baf
d9a84630a72717f03695e7b1242ac2a449e92978fe7eced9d374aadeb59547fa
dc124aecfdd3f470f421ae54dabda30839a56d515245357f21fa579214ec1b74
e07fdabd63e916713d69ef70a6a4aeeea84c4425527f34e308d08ac423570be5
e71fac4b12ff64ff866d21fd45075cfb0d5800c85c99ee787b2712179ef45284
f71471eb0b44d2ede5d1cadc3c284ddcaabe9ce2ec03135f905d366d3429f2f1
f9df1052e353a7566db192fbf4a366e96d833b54e0d66ce04a3b75afb12e085f
fea58a042de1bbfdf6f7b570b27f8380141bde0e17b22725576416741c029d08
```

## Fresh reconciliation dry-run

The reconciliation-only run `41906705337` passed. Its artifact is
`13361285689` (`ebay-review-queue-reconciliation-41906705337-1`), digest
`b8e2127eaf643fe9c981fedbbe8b04749b110fc80db0a476db889f9ef1d88638`.
The reconciliation file SHA-256 is
`55c3a17b491d08c04863bfbda687a57e22889a628254432b552bae31972b3ccd`.

| Reconciliation fact | Count |
|---|---:|
| Incoming review rows | 84 |
| Observed offer IDs | 237 |
| Existing status-active eBay rows | 81 |
| `CREATE` | 5 |
| `REFRESH` | 75 |
| `SUPERSEDE` | 2 |
| `RESOLVE_BY_SOURCE` | 0 |
| `EXPIRE` | 0 |
| Expected final status-active eBay rows | 84 |
| Expected active-count delta | +3 |
| Duplicate incoming problem fingerprints | 0 |
| Missing source fingerprints | 0 |
| Missing plan fingerprints | 0 |
| Baseline mismatches | 0 |
| Unknown reason codes | 0 |
| Publisher-unsupported operations | 0 |
| Commercial operations unsupported by eBay execution adapter | 3 |

Exact request bindings:

- publisher batch fingerprint:
  `8426eefffb1674ea401c78aabc76a9f8cd41683a00bcf78afc288728b8951e68`;
- changeset fingerprint:
  `0bfbb5e4e1180e10b1c9a6b51fe23835a0392b14e466a904034d655da98e67d0`;
- idempotency key:
  `62d501b6e4ddcf48b3d59e53887b36c26472a54f1eed24618c9ac003d3f351d9`.

If this exact request were otherwise authorized and still fresh, it would make
`82` queue mutations (`5` inserts, `75` refresh updates, `2` supersede
updates), append `82` review events and one publication seal. That is `165`
counted database writes, with physical relation deltas of `+5` queue rows,
`+82` events and `+1` publication row. Catalogue writes remain exactly `0`.

## Lifecycle and recurrence analysis

The five creates classify as follows:

| Classification | Offer | Problem |
|---|---:|---|
| `NEW_EVIDENCE_SUPERSESSION` | 2544 | `UPDATE_PRICE / HARD_PRICE_ANOMALY`; replaces review `2217` |
| `NEW_EVIDENCE_SUPERSESSION` | 2688 | `UPDATE_PRICE / PRICE_CHANGE`; replaces review `2814` |
| `NEW_PROBLEM` | 2625 | `MANUAL_REVIEW_IDENTITY / IDENTITY_CONFLICT` |
| `NEW_PROBLEM` | 2629 | `MANUAL_REVIEW_IDENTITY / IDENTITY_CONFLICT` |
| `NEW_PROBLEM` | 2735 | `UPDATE_PRICE / PRICE_CHANGE` |

The 75 refreshes are `SAME_PROBLEM_REFRESH`: 57 identity conflicts, 9 source
failures, 6 price changes and 3 combined price/stock changes. Exact offer IDs:

```text
2539,2543,2551,2552,2557,2560,2563,2564,2572,2589,2590,2591,2592,
2593,2594,2595,2596,2597,2598,2601,2603,2606,2607,2608,2609,2610,
2613,2614,2616,2637,2638,2642,2649,2651,2655,2659,2660,2661,2667,
2675,2680,2681,2686,2689,2690,2697,2698,2705,2708,2709,2715,2716,
2719,2721,2724,2725,2729,2733,2736,2737,2741,2742,2748,2749,2750,
2755,2758,2759,2760,2761,2769,2770,2771,2772,2774
```

Four same-fingerprint approved rows are deliberately frozen and produce no
operation: offers `2695`, `2703`, `2704` and `2744`. Their evidence is already
expired, so publication would not silently revive or execute the approvals.

Thirteen incoming offers have authenticated owner-decision history. Six
owner-decided problems would become fresh `DECIDE` rows with the same latest
fingerprint (`2543`, `2601`, `2603`, `2690`, `2715`, `2735`): this is a
same-problem recurrence caused by a new capture timestamp, not new semantic
evidence. Offer `2689` would return to `DECIDE` with a different fingerprint
after an earlier execution, representing a new commercial change. Offers
`2544` and `2688` are new-evidence supersessions without a matching latest
owner decision. The other historical recurrences (`2560`, `2661`, `2716`) are
review-only technical identity rows, while the four approved rows listed above
remain completed. No row is autonomous owner work.

## HARD_PRICE_ANOMALY regression proof

Fresh source produced exactly one hard-price row:

| Field | Value |
|---|---|
| Offer | `2544` |
| Product | Applied Nutrition ISO-XP 1.8kg — Cafe Latte / 1.8kg |
| Old price | `£84.81` |
| Proposed price | `£108.77` |
| Absolute / ratio delta | `£23.96` / `0.2825138544982902` |
| Reason | `HARD_PRICE_ANOMALY` |
| Source fingerprint | `94d0c7f5eb1447727b85eb05c6649cbac5f6862370ea969577ef8f3a6b63edac` |
| Plan fingerprint | `8806d1d6da4b32cf94145241cb7f229a298337585c8d0052ff445be1a57c0eb8` |
| Producer normalization | PASS |
| Canonical reason registry | PASS |
| JavaScript publisher | PASS |
| Live SQL contract | PASS |
| eBay `UPDATE_PRICE` adapter | PASS |
| Worker hard-price guard | `ACCEPT` |

The worker assertion was executed locally against the exact fresh row and its
exact downloaded resolved plan. No approval, request or worker execution was
performed.

A synthetic `SYNTHETIC_UNKNOWN_REASON` was passed only to local JavaScript
manifest validation and was rejected with `Unknown reason code`. The live SQL
definition also retains the exact allowlist/failure branch. The synthetic value
was never submitted to the production RPC.

## Publication safety and owner impact

| Gate | Result |
|---|---|
| Retailer binding `12:ebay-uk` | PASS |
| Source and plan fingerprints | PASS, 0 missing |
| Canonical reasons / publisher schema | PASS |
| Duplicate active problem fingerprints | PASS, 0 |
| Expected baseline and catalogue hash | PASS, 0 mismatches |
| Idempotency key / changeset / batch fingerprints | PASS |
| Catalogue writes | PASS, 0 |
| Supported commercial execution operations | **FAIL, 3 unsupported combined operations** |

The blocked rows are:

| Offer | Product | Before → proposed stock | Potential coverage effect |
|---:|---|---|---|
| 2749 | Trec Vitargo Electro Energy 1050g | OOS → in stock | Could create second retailer |
| 2769 | SmartShake DC Comics SuperGirl 800ml | OOS → in stock | Could create second retailer |
| 2774 | Trec Nutrition Caffeine 200 Plus 60 caps | OOS → in stock | Could create second retailer |

The exact simulated admin state after publication, using the current admin
dedupe/lifecycle/capability rules, would be:

| eBay admin bucket | Current | After hypothetical publication |
|---|---:|---:|
| `DECIDE` | 0 | 9 |
| `EXECUTE` | 0 | 0 |
| `PROCESSING` | 0 | 0 |
| `TECHNICAL` | 0 | 71 |
| `COMPLETED/current` | 145 | 65 |

The nine new owner decisions are all `UPDATE_PRICE` rows: offers `2543`,
`2544`, `2601`, `2603`, `2688`, `2689`, `2690`, `2715` and `2735`.
`UPDATE_STOCK` owner rows are `0`; `VERIFY_NO_CHANGE` owner rows are `0`.
There are 69 identity/source rows in the manifest; these remain review-only
technical evidence, not owner execution work. The three combined rows are also
technical because their execution adapter is unsupported. The exact batch must
not be published.

## Coverage relevance

Coverage was read at `2026-11-04T20:34:23.900Z` using the existing public
24-hour freshness contract: active unmerged product, in stock, positive price,
identified retailer, mapping, HTTP(S) URL and distinct retailer IDs. The 84
review rows affect 65 products.

| Fresh retailer depth | Distinct products | Review rows |
|---:|---:|---:|
| 0 | 3 | 4 |
| 1 | 39 | 47 |
| 2 | 19 | 29 |
| 3+ | 4 | 4 |

Twelve price rows can change price only. Sixty-nine identity/source rows have
no executable coverage effect. All three combined rows could restore eBay from
OOS and create a second retailer; none would restore a first retailer, create a
third-plus retailer or reduce coverage. Those gains are potential only and are
not executable under the current adapter.

| Product ID | Product | Fresh retailer depth |
|---:|---|---:|
| 7 | Optimum Nutrition Gold Standard 100% Whey 2.27kg | 2 |
| 10 | BioTech USA Iso Whey Zero 1816g | 2 |
| 14 | BioTech USA Iso Whey Zero 908g | 3 |
| 24 | PEScience Prolific 280g | 2 |
| 27 | Cellucor C4 Original 195g | 2 |
| 31 | Per4m Vegan Protein 908g | 1 |
| 55 | BioTech USA Nitrox Therapy 340g | 1 |
| 59 | 5% Nutrition Rich Piana 5150 375g | 2 |
| 70 | Optimum Nutrition 100% Plant Protein 684g | 2 |
| 89 | PEScience TruCreatine+ Powder 161g | 1 |
| 90 | Nutrex Lipo 6 Black Ultra Concentrate 60 Caps | 1 |
| 93 | JNX Sports The Ripper Fat Burner Powder 150g | 1 |
| 108 | Grenade Defend BCAA 390g | 1 |
| 112 | 5% Nutrition Rich Piana All Day You May 465g | 2 |
| 125 | Reflex Instant Mass Heavyweight 2kg | 1 |
| 134 | Dymatize Iso 100 2.27kg | 1 |
| 157 | Optimum Nutrition Serious Mass 2.7kg | 1 |
| 158 | Optimum Nutrition Serious Mass 5.4kg | 1 |
| 166 | Clif Bar Energy Bar 12x68g | 2 |
| 178 | Applied Nutrition ISO-XP 1.8kg | 1 |
| 215 | Applied Nutrition ABE Ultimate Pre-Workout 315g | 4 |
| 217 | Mutant Test 90 Capsules | 0 |
| 219 | Solgar Digestive Enzymes 100 Tablets | 1 |
| 222 | Mutant Mass 6.8kg | 0 |
| 224 | Barebells High Protein Milkshake 330ml | 2 |
| 232 | Ghost Vegan Protein 989g | 1 |
| 249 | Solgar Vitamin D3 2200 IU 50 Vegetable Capsules | 1 |
| 294 | BioTech USA Black Blood CAF+ 300g | 2 |
| 324 | Muscle Moose Protein Pancakes Mix 500g | 1 |
| 338 | Applied Nutrition Clear Whey Protein 875g | 3 |
| 348 | Ghost Greens 330g | 1 |
| 360 | Olimp TCM 1100 Mega Caps 120 Capsules | 1 |
| 385 | SmartShake DC Comics SuperGirl 800ml | 1 |
| 386 | SmartShake DC Comics Batman 800ml | 1 |
| 423 | Applied Nutrition Cream Of Rice 2kg | 2 |
| 428 | Trec L-Carnitine 3000 Liquid Apricot 500ml | 1 |
| 449 | USN QHUSH Black Pre-workout 220g | 1 |
| 450 | Trec Vitargo Electro Energy 1050g | 1 |
| 468 | Critical Cookie 12 x 73g | 2 |
| 482 | JNX Sports The Curse 250g | 1 |
| 488 | Massage Gun | 1 |
| 489 | Mutant Madness Pre Workout 225g | 2 |
| 513 | Trec Nutrition Caffeine 200 Plus 60 caps | 1 |
| 518 | Osavi Potassium 300mg | 1 |
| 520 | Olimp Redweiler Preworkout 480g | 2 |
| 528 | Nutrend Pump Pre-Workout | 2 |
| 673 | Now Foods Chaste Berry Vitex Extract 300mg 90 Capsules | 1 |
| 696 | Now Foods MSM 1500mg 200 Tablets | 1 |
| 707 | Swanson Triphala 500mg 100 Capsules | 1 |
| 741 | Swanson Full Spectrum Passion Flower 500mg 60 Capsules | 1 |
| 748 | Applied Nutrition Beef Mass Gainer 3.13kg | 2 |
| 755 | Optimum Nutrition Platinum Creatine Plus 350g | 0 |
| 796 | Per4m Advanced Curcumin 60 Capsules | 2 |
| 810 | Trained By JP Iron 60 Capsules | 1 |
| 863 | CNP Loaded Beef Protein 1.8kg | 1 |
| 868 | CNP Whey Isolate 1.8kg | 1 |
| 875 | Trained By JP Performance Isolate Tri Blend 2kg | 1 |
| 885 | Innovapharm MVPRE 3.0 Pre Workout 437g | 2 |
| 887 | PER4M Hydrate Electrolyte Mix 210g | 3 |
| 1077 | 7Nutrition Cream Crunch 750g | 2 |
| 1104 | Animal Pak 44 Packs | 1 |
| 1116 | ALLNUTRITION Vitamin D3 4000 + K2 Drops 30ml | 1 |
| 1117 | ALLNUTRITION Vitamin C Drops 30ml | 1 |
| 1128 | ALLNUTRITION Vitamin B12 Methyl Drops 30ml | 1 |
| 1139 | Trec Nutrition Clenburexin 90 Capsules | 1 |

## Required next decision and hard stop

No publication authorization should be issued for this batch. A separate,
bounded contract decision is required for the three combined rows: either add
an owner-authorized protected `UPDATE_PRICE_AND_STOCK` eBay execution contract,
or define a reviewed producer partition that represents each safe operation
without changing its semantic truth. This audit authorizes neither option.
After any such fix, a new source capture and new reconciliation are required;
this expiring artifact must not be replayed.

Final side-effect record:

- database writes in this task: `0`;
- Review Queue writes: `0`;
- catalogue, offer, stock, price, price-history or mapping writes: `0`;
- approvals or execution requests: `0`;
- worker dispatches: `0`;
- historical replay: `NO`;
- SEO-20 change: `NO` — it remains the sole SEO task `IN PROGRESS`;
- exact stop point: after documentation-only delivery of verdict
  `B. CONTRACT_STILL_BROKEN`, before any call to
  `publish_automation_review_queue_changes(jsonb)` or any review lifecycle
  mutation.
