# eBay fresh Review Queue publication preflight after combined contract — 2026-11-05

## Decision

**B. CONTRACT_STILL_BROKEN — DO NOT PUBLISH.**

The completely new source capture and reconciliation are structurally healthy,
and the retailer-12 adapter now supports `UPDATE_PRICE_AND_STOCK`. The exact
fresh publication manifest is nevertheless unsafe. For offers `2749`, `2769`
and `2774`, the protected source plans bind an out-of-stock to in-stock
transition (`false -> true`), but reconciliation reuses the older active Review
Queue `before_state.in_stock=true`. The protected eBay worker rejects all three
exact fresh rows with `COMBINED_REVIEW_BEFORE_STATE_DRIFT`.

This is a publication-contract failure, not an unsupported-operation failure.
No Review Queue publication, owner decision, execution request, worker
execution or catalogue write was performed. No authorization pack is issued.

## Scope and first gate

- Starting authoritative `main`:
  `68c528aeceb995b6cc9e166fab6c79dbf525eb93`.
- Production project: `aftboxmrdgyhizicfsfu`.
- Audit branch: `audit/ebay-fresh-publication-preflight-v2`, in a clean isolated
  worktree. Unrelated owner changes in the primary worktree were not touched.
- PR `#480` is merged at the starting SHA. Feature head
  `12d3ac8d17225b9024a486225b1d8395fe620b5f` and merge commit have the same
  tree `ac37c260b7d125e600677ec0ae45394a2234a2f4`.
- PR `#480` Project Guardian, Quality Gate, GitGuardian and Vercel passed; it
  has zero unresolved review threads. Final-main Project Guardian run
  `41983969858` and Quality Gate run `41983969821` passed.
- No commit after the starting SHA superseded the eBay Review Queue contract.
- Project Guardian passed before this audit. `SEO-20` remains the sole SEO task
  `IN PROGRESS`. The broad P1 category cleanup remains closed.

The current retailer-12 execution registry supports exactly:

| Operation | Exact allowed reasons |
|---|---|
| `VERIFY_NO_CHANGE` | `FRESHNESS_CONFIRMATION`, `STALE_OFFER`, `NO_CHANGE_CONFIRMATION` |
| `UPDATE_PRICE` | `PRICE_CHANGE`, `HARD_PRICE_ANOMALY` |
| `UPDATE_STOCK` | `STOCK_CHANGE` |
| `UPDATE_PRICE_AND_STOCK` | `PRICE_AND_STOCK_CHANGE` |

Identity promotion, rebind and source-missing rows remain review-only. The
historical offer IDs `2749`, `2769` and `2774` occur in immutable source scope
and regression fixtures, but no worker/runtime branch dispatches on those IDs.

## Latest watchdog

The latest available watchdog is run `41981042608`, generated at
`2026-11-05T06:32:39.982Z`. It is `FAILED_SYSTEM`, with five retailer failures
and exactly zero database writes.

| Retailer | Latest classification | Relevance to this preflight |
|---|---|---|
| Simply Supplements (`7`) | monitored stale/review-scope backlog growth after a complete run | Existing monitored debt; unrelated |
| Fit House (`9`) | unresolved latest ordinary profile attempt plus backlog growth | Existing debt; unrelated |
| eBay UK (`12`) | `MONITORED_BACKLOG_GROWTH`; `READ_ONLY_COMPLETE`, `84` review rows and `82` offers older than 48 hours | Existing no-publication freshness/backlog debt, not a new execution/runtime regression |
| 10 Reps (`14`) | unresolved latest ordinary profile attempt plus backlog growth | Existing debt; unrelated |
| Gladiator Nutrition (`15`) | incomplete historical execution evidence after failed run | Retailer-specific evidence debt; unrelated |

The newer watchdog therefore did not trigger the eBay runtime-regression stop
condition. Its debt was recorded and not changed.

## Safe fresh source capture

The existing `eBay Offer Refresh` workflow was dispatched on `main` with
`operation=dry-run` and `execution_mode=catalogue-refresh`. The workflow ran the
source read and evidence binding only. Apply preparation, database apply
baseline, approval verification, apply, postflight-after-apply, idempotency
after apply and `refresh-review-queue` publication were all skipped.

| Evidence | Fresh value |
|---|---|
| Source workflow run | `41985745121` |
| Event / head SHA | `workflow_dispatch` / `68c528aeceb995b6cc9e166fab6c79dbf525eb93` |
| Capture timestamp | `2026-11-05T07:14:37.238Z` |
| Contract expiry | `2026-11-06T07:14:37.238Z` |
| Source artifact ID | `13395744126` |
| Artifact name | `ebay-offer-refresh-41985745121-1` |
| Artifact digest | `907a595b573a5a4ebcdb7001810162d8a0243c249ac90e45f65f3d6ce3cecd14` |
| Contract SHA-256 | `9dad1aa38aac06444fa630b56e48b14e79fc81cfe5f8d67ec4f0b27dd0d8fb2d` |
| Report SHA-256 | `a00ba391a48783d161edec7096e2246d1c3381d3b5036ffebcf40680d332f855` |
| Artifact-content SHA-256 | `d7c243cc4b3471377a9d92f5e10caa1313f966704450edda3479f0c55c455923` |
| Full-capture/source fingerprint | `fc1165f4b78daa194a0cfec631a3fa8ab10a4af2a794a3c7845fae3a45343ef8` |
| Executable-source fingerprint | `f1a45608e40b46f8ce0fc5c30542cf92493083e86692c755ade3b7ab0dbd37e7` |
| Review-scope fingerprint | `1973b2450fd050ad52d8caf647e3c87d4faebba85b47d3915eea38103a76c97c` |
| Plan fingerprint | `102624128ea7850fade4b530a6bde2a50242a37e94042c2b92dd24d38e97e4c4` |

Historical source run `41905828377`, artifact `13359999389` and reconciliation
run `41906705337` reused: **NO**. Historical run `41836635201` and artifact
`13328715529` reused: **NO**. No historical fingerprint, timestamp or
idempotency key was reused.

## Fresh source result

The source result is `PASS_WITH_REVIEW`; all `237` approved eBay mappings were
observed and no row was blocked.

| Source classification | Count |
|---|---:|
| `VERIFY_NO_CHANGE` | 151 |
| `UPDATE_PRICE` | 12 |
| `UPDATE_STOCK` | 0 |
| `UPDATE_PRICE_AND_STOCK` | 3 |
| Identity review | 62 |
| Source-failure review | 9 |
| Identity/source review total | 71 |
| Blocked | 0 |

Every fresh commercial row is recorded below. The `before stock` values for
the three combined rows are the protected plan/production baseline; the
publication manifest incorrectly says `true`, which is the blocking mismatch.

| Offer | Product / variant | Operation / reason | Price | Stock | Source row fingerprint | Plan fingerprint |
|---:|---|---|---|---|---|---|
| 2543 | Nutrend Pump Pre-Workout — Rainbow / 225g | `UPDATE_PRICE` / `PRICE_CHANGE` | `18.10 -> 18.50` | `true -> true` | `b963363234e868b75f495358a3831f301181e28a35ea500c5180ec6552c94ece` | `102624128ea7850fade4b530a6bde2a50242a37e94042c2b92dd24d38e97e4c4` |
| 2544 | Applied Nutrition ISO-XP 1.8kg — Cafe Latte / 1.8kg | `UPDATE_PRICE` / `HARD_PRICE_ANOMALY` | `84.81 -> 108.77` | `true -> true` | `94d0c7f5eb1447727b85eb05c6649cbac5f6862370ea969577ef8f3a6b63edac` | `102624128ea7850fade4b530a6bde2a50242a37e94042c2b92dd24d38e97e4c4` |
| 2601 | Nutrend Pump Pre-Workout — Bubble Gum / 225g | `UPDATE_PRICE` / `PRICE_CHANGE` | `18.10 -> 18.50` | `true -> true` | `9da0073936c3bea77f6352b697179238dd2b217a650269464441e5b453c6baae` | `102624128ea7850fade4b530a6bde2a50242a37e94042c2b92dd24d38e97e4c4` |
| 2603 | JNX Sports The Ripper Fat Burner Powder 150g — Watermelon Candy / 150g | `UPDATE_PRICE` / `PRICE_CHANGE` | `26.80 -> 32.20` | `true -> true` | `351c54500ee0745e98a79908cd0daef2e6a58f335ccc02895b59cc59867a5e20` | `102624128ea7850fade4b530a6bde2a50242a37e94042c2b92dd24d38e97e4c4` |
| 2688 | 7Nutrition Cream Crunch 750g — Coconut / 750g | `UPDATE_PRICE` / `PRICE_CHANGE` | `14.99 -> 12.44` | `true -> true` | `8e61bd09d870f8d5d1293eae8ac3866f7befdc5b14e8ff9e7884d9573193e2c3` | `102624128ea7850fade4b530a6bde2a50242a37e94042c2b92dd24d38e97e4c4` |
| 2689 | Optimum Nutrition 100% Plant Protein 684g — Chocolate / 684g | `UPDATE_PRICE` / `PRICE_CHANGE` | `34.85 -> 36.68` | `true -> true` | `9ff526e82c130d20f3f6e9354f6b42b936080dc052caa935faa8cb7876f5d18c` | `102624128ea7850fade4b530a6bde2a50242a37e94042c2b92dd24d38e97e4c4` |
| 2690 | Barebells High Protein Milkshake 330ml — Strawberry / 330ml | `UPDATE_PRICE` / `PRICE_CHANGE` | `27.45 -> 28.80` | `true -> true` | `6e0bd5ae9f7f3acefb4557e6ae40f60355eed031f484a68b45b0b5b91ea01077` | `102624128ea7850fade4b530a6bde2a50242a37e94042c2b92dd24d38e97e4c4` |
| 2703 | BioTech USA Nitrox Therapy 340g — Blue Grape / 340g | `UPDATE_PRICE` / `PRICE_CHANGE` | `18.00 -> 15.00` | `true -> true` | `044eb37c1e571d39f06de7bc7dfb0b17f56670c663960eb827a3805057dae3a5` | `102624128ea7850fade4b530a6bde2a50242a37e94042c2b92dd24d38e97e4c4` |
| 2704 | Solgar Digestive Enzymes 100 Tablets — Default | `UPDATE_PRICE` / `PRICE_CHANGE` | `18.79 -> 20.29` | `true -> true` | `2bf20b60e2cb54391a5c3c06dbcd96df728091c7da54e8c1a6d4616863a4435c` | `102624128ea7850fade4b530a6bde2a50242a37e94042c2b92dd24d38e97e4c4` |
| 2715 | Osavi Potassium 300mg — Default | `UPDATE_PRICE` / `PRICE_CHANGE` | `8.81 -> 8.60` | `true -> true` | `18937ca8d4b51667e75aae55a98fa5fc013df372f32c116ac4b045646efc17ec` | `102624128ea7850fade4b530a6bde2a50242a37e94042c2b92dd24d38e97e4c4` |
| 2735 | Reflex Instant Mass Heavyweight 2kg — Chocolate Perfection / 2kg | `UPDATE_PRICE` / `PRICE_CHANGE` | `45.52 -> 45.08` | `true -> true` | `b6482b6713b9cb0cebe3b31c1edaada9d31604fac5fcfc65f2a218692f72b6ec` | `102624128ea7850fade4b530a6bde2a50242a37e94042c2b92dd24d38e97e4c4` |
| 2744 | BioTech USA Black Blood CAF+ 300g — Cola / 300g | `UPDATE_PRICE` / `PRICE_CHANGE` | `31.47 -> 32.13` | `true -> true` | `97058b43177260279cdaad91bb59f096b5d679bf7b72c7378e4703413d27dd16` | `102624128ea7850fade4b530a6bde2a50242a37e94042c2b92dd24d38e97e4c4` |
| 2749 | Trec Vitargo Electro Energy 1050g — Orange / 1.05kg | `UPDATE_PRICE_AND_STOCK` / `PRICE_AND_STOCK_CHANGE` | `27.99 -> 26.99` | `false -> true` | `16bc353a2d3181d69bb332837bd2236d97cb6a12a5474978af6cf69a5203cd76` | `102624128ea7850fade4b530a6bde2a50242a37e94042c2b92dd24d38e97e4c4` |
| 2769 | SmartShake DC Comics SuperGirl 800ml — Default | `UPDATE_PRICE_AND_STOCK` / `PRICE_AND_STOCK_CHANGE` | `9.75 -> 9.92` | `false -> true` | `c824bd5ae8251e36871a872bd31ef9f8849a30b17c7422dc30b9e7e5e1fcbbd8` | `102624128ea7850fade4b530a6bde2a50242a37e94042c2b92dd24d38e97e4c4` |
| 2774 | Trec Nutrition Caffeine 200 Plus 60 caps — Default | `UPDATE_PRICE_AND_STOCK` / `PRICE_AND_STOCK_CHANGE` | `9.49 -> 10.99` | `false -> true` | `a3c5ec80b4347436151d1f20cef9636d7dce995ee9fd28e1e6117ad9bd056f2e` | `102624128ea7850fade4b530a6bde2a50242a37e94042c2b92dd24d38e97e4c4` |

## Fresh reconciliation dry-run

The separate workflow was dispatched with `operation=dry-run`,
`execution_mode=review-queue-reconciliation` and the exact eight-part binding
from the new source artifact. Its source-refresh and queue-publication jobs were
skipped. The dry-run read production in a read-only environment and built the
RPC-shaped request only in memory.

| Evidence | Value |
|---|---|
| Reconciliation run | `41986437606` |
| Reconciliation artifact | `13396510847` (`ebay-review-queue-reconciliation-41986437606-1`) |
| Artifact digest | `070982b2dc1138f8081455677947747ece3b783b0ed24d170369709d91269279` |
| Reconciliation file SHA-256 | `3dffe41d1c6001a6b3b686abf374ef62fdac6d77031b8a54e433176a1925c8f5` |

| Reconciliation fact | Count |
|---|---:|
| Incoming review rows | 86 |
| Observed offer IDs | 237 |
| Existing status-active eBay rows | 81 |
| `CREATE` | 7 |
| `REFRESH` | 75 |
| `SUPERSEDE` | 2 |
| `RESOLVE_BY_SOURCE` | 0 |
| `EXPIRE` | 0 |
| Expected final status-active eBay rows | 86 |
| Unknown reasons | 0 |
| Publisher-unsupported operations | 0 |
| Execution-adapter-unsupported operations | 0 |
| Duplicate problem fingerprints | 0 |
| Missing source fingerprints | 0 |
| Missing plan fingerprints | 0 |
| Exact publication-row/protected-plan baseline mismatches | **3** |

The workflow's narrower reconciliation baseline passed and its production
catalogue hash was stable. The extended execution preflight found the three
row-to-plan mismatches only when the exact fresh manifest was checked against
the protected worker contract. That is the decisive failure.

Fresh request identifiers, recorded as rejected evidence only:

- publisher batch fingerprint:
  `e9ad646c7d61231dc6ba3b3f7141fd0ec24519a63f4684902d7ac3fd6bdca84d`;
- changeset fingerprint:
  `077a14d3a4232787c08cb39830daf8d2709b5208f35a0e82fe336b1fee5f905b`;
- idempotency key:
  `e162abc3fad07e0eb1efc774d6b7e248cdc310925f50c03c77f45fcdf257d9a2`.

These identifiers are not an authorization pack and must not be used for
publication.

## HARD_PRICE_ANOMALY live proof

The fresh source contains exactly one hard-price row, offer `2544`, from
`£84.81` to `£108.77`.

| Contract layer | Result |
|---|---|
| Producer normalization | PASS: `UPDATE_PRICE / HARD_PRICE_ANOMALY` |
| Canonical reason registry | PASS |
| JavaScript publisher | PASS |
| Live SQL publication function | PASS: one `SECURITY DEFINER` overload, `search_path=""`, hard-price allowlist and fail-closed unknown-reason branch present |
| eBay execution adapter | PASS |
| Exact protected worker hard-price assertion | PASS |

The exact fresh source-row fingerprint is
`94d0c7f5eb1447727b85eb05c6649cbac5f6862370ea969577ef8f3a6b63edac`.
No review row was published and no execution was requested.

## UPDATE_PRICE_AND_STOCK live proof

All three source plans correctly express one atomic price-and-stock change:
exact identity, price and stock both change, shipping and URL stay unchanged,
source price/stock match the proposed state, `price + shipping = total`,
`price_history.action=create`, and expected deltas are one price, one stock, one
total, one freshness and one price-history change. The adapter and live SQL
publication contract accept the operation/reason pair, and the shared
postflight/idempotency contracts predict the required exact deltas and a later
fresh `VERIFY_NO_CHANGE`.

The publication manifest fails before execution, however:

| Offer | Protected plan stock | Manifest stock | Worker result |
|---:|---|---|---|
| 2749 | `false -> true` | `true -> true` | `COMBINED_REVIEW_BEFORE_STATE_DRIFT` |
| 2769 | `false -> true` | `true -> true` | `COMBINED_REVIEW_BEFORE_STATE_DRIFT` |
| 2774 | `false -> true` | `true -> true` | `COMBINED_REVIEW_BEFORE_STATE_DRIFT` |

The cause is ordering inside `buildManifestRows`: it takes an older active
Review Queue `before_state` before the exact current DB/protected-plan state.
The PR `#480` change correctly preserved the exact proposed final state but did
not change that before-state precedence. The production rows demonstrate the
missing regression case. No runtime branch or special case for the three offer
IDs is appropriate.

## Current production baseline and admin state

An independent production transaction was opened as `postgres` with
`transaction_read_only=on` and rolled back. Its final capture was
`2026-11-05T07:26:06.666Z`.

| Relation | Count |
|---|---:|
| `product_match_review_queue` | 3,445 |
| `product_match_review_events` | 9,808 |
| `automation_review_queue_publications` | 195 |
| `automation_review_execution_requests` | 292 |
| `offers` | 4,361 |
| `retailer_products` | 4,361 |

Current eBay Review Queue status counts:

| Status | Count |
|---|---:|
| `PENDING` | 77 |
| `APPROVED` | 4 |
| `EXECUTING` | 0 |
| `EXECUTED` | 56 |
| `EXPIRED` | 299 |
| `REJECTED` | 3 |
| `FAILED` | 1 |

There are `440` eBay review-history rows, `81` status-active rows and `145`
distinct offer IDs. Application lifecycle, expiry, capability and execution
request logic produces the current admin state:

| Bucket | Current | After hypothetical publication |
|---|---:|---:|
| `DECIDE` | 0 | 12 |
| `EXECUTE` | 0 | 0 |
| `PROCESSING` | 0 | 0 |
| `TECHNICAL` | 0 | 70 |
| `COMPLETED/current` | 145 | 63 |

The hypothetical 12 owner decisions would be `9 UPDATE_PRICE`,
`0 UPDATE_STOCK`, `3 UPDATE_PRICE_AND_STOCK` and `0 VERIFY_NO_CHANGE`.
Identity/source rows remain outside owner execution work.

## Recurrence analysis

Lifecycle classification against the current queue is:

| Classification | Count | Exact scope |
|---|---:|---|
| `NEW_PROBLEM` | 5 | offers `2625`, `2629`, `2682`, `2735`, `2745` |
| `SAME_PROBLEM_REFRESH` | 75 | same active semantic fingerprint, new capture/evidence expiry |
| `NEW_EVIDENCE_SUPERSESSION` | 2 | offers `2544` and `2688`, replacing reviews `2217` and `2814` |
| `RESOLVED_BY_SOURCE` | 0 | none |
| `EXPIRED` | 0 | none |

The 75 refresh offers are:

```text
2539,2543,2551,2552,2557,2560,2563,2564,2572,2589,2590,2591,2592,
2593,2594,2595,2596,2597,2598,2601,2603,2606,2607,2608,2609,2610,
2613,2614,2616,2637,2638,2642,2649,2651,2655,2659,2660,2661,2667,
2675,2680,2681,2686,2689,2690,2697,2698,2705,2708,2709,2715,2716,
2719,2721,2724,2725,2729,2733,2736,2737,2741,2742,2748,2749,2750,
2755,2758,2759,2760,2761,2769,2770,2771,2772,2774
```

Four same-fingerprint approved rows remain deliberately frozen with no
operation: `2695`, `2703`, `2704` and `2744`. Publication would not silently
revive or execute them.

Owner-decision recurrence is distinguishable as follows:

- same offer, same fingerprint, new capture: commercial offers `2543`, `2601`,
  `2603`, `2690` and `2715` would return to `DECIDE`; approved offers `2703`,
  `2704` and `2744` remain frozen;
- same offer, new fingerprint/new commercial change: `2689` follows a prior
  execution and `2735` is a fresh price problem;
- new evidence supersession: `2544` and `2688` replace exact older active
  evidence;
- different/new identity evidence: `2560`, `2661`, `2682`, `2716` and `2745`
  remain technical review-only rows;
- different variant classification: none of the 15 commercial rows changes
  canonical identity or variant.

The three combined rows have no owner decision in this preflight and must not
become owner work while their exact before-state binding is invalid.

## Coverage relevance

Coverage was read in the same production read-only transaction with the current
24-hour freshness contract: active unmerged product, in stock, positive price,
identified retailer, mapping and HTTP(S) URL.

| Current fresh retailer depth for 15 commercial rows | Rows |
|---:|---:|
| 0 | 0 |
| 1 | 9 |
| 2 | 6 |
| 3+ | 0 |

| Potential effect after a later valid execution | Rows |
|---|---:|
| First retailer restored | 0 |
| Second retailer created | 3 |
| Third+ retailer created | 0 |
| Price-only | 12 |
| Coverage removed due OOS | 0 |
| No depth effect | 0 |

All three current singleton products are the blocked combined rows: Trec
Vitargo Electro Energy 1050g, SmartShake DC Comics SuperGirl 800ml and Trec
Nutrition Caffeine 200 Plus 60 caps. Each currently has only Whey Okay as a
fresh retailer and could gain eBay as a second retailer after a future valid,
owner-approved execution. No such gain occurred here.

## Hypothetical publication write model

If the contract were valid and an unexpired exact request were separately
authorized, the current request shape would produce:

| Control-plane effect | Delta |
|---|---:|
| Queue mutations | 84 (`7` inserts, `75` refresh updates, `2` supersede updates) |
| Review events | 84 |
| Publication seals | 1 |
| Counted queue/control-plane database writes | 169 |
| Physical queue row delta | +7 |
| Status-active eBay row delta | +5 (`81 -> 86`) |
| Catalogue/offer/price/stock/history/mapping writes | **0** |

Review Queue publication is control-plane only. The model was calculated; it
was not executed.

## Verdict and stop

Verdict: **B. CONTRACT_STILL_BROKEN**.

The safe gates for unknown reasons, publisher operations, adapter operations,
duplicate fingerprints and required fingerprints are all zero. The exact
publication-row/protected-plan baseline mismatch is `3`, and all three fresh
combined rows fail the worker's exact before-state guard. Therefore verdict A
is unavailable and no owner authorization pack is prepared.

A later bounded correction must make a commercial manifest row bind the exact
current protected-plan/DB before state rather than an older active review's
before state, add this production-shaped recurrence as a regression, and then
produce another completely new source capture and reconciliation. This task
does not implement that fix.

Final side-effect record:

- production database writes: `0`;
- Review Queue writes: `0`;
- catalogue, offer, price, stock, price-history or mapping writes: `0`;
- owner approvals or execution requests: `0`;
- worker executions: `0`;
- old artifacts or identifiers replayed: `NO`;
- SEO-20 changed: `NO` — it remains the sole SEO task `IN PROGRESS`;
- exact stop point: after documentation-only delivery of verdict
  `B. CONTRACT_STILL_BROKEN`, before any call to
  `publish_automation_review_queue_changes(jsonb)` or any Review Queue,
  approval, execution or catalogue mutation.
