# eBay final fresh publication preflight after shared refresh migration — 2026-11-05

## Decision

**B. CONTRACT_STILL_BROKEN — DO NOT PUBLISH.**

The production shared `PENDING` execution-binding migration is live and correct,
and the completely new eBay capture is complete across all 237 approved
mappings. The new reconciliation nevertheless failed closed before producing a
publication artifact. All 14 fresh commercial rows carry an affiliate URL that
is semantically identical to the protected plan URL, but the query parameters
are serialized in a different order. The current exact-string source/proposed
URL assertion therefore rejected offer `2543` first; independent read-only
analysis proved the same exact-string mismatch for all 14 commercial rows and
zero mismatches after URL canonicalization.

This task did not change that contract. No Review Queue publication, owner
decision, execution request, worker execution or catalogue write occurred. No
owner authorization pack, publisher batch fingerprint, changeset fingerprint
or idempotency key is issued.

## Authority, boundary and first gate

- Starting authoritative `origin/main`:
  `0d8960764ef961f373e9fcc83c04be0abbf0452e`.
- Production project: `aftboxmrdgyhizicfsfu`.
- Documentation branch: `audit/ebay-final-fresh-publication-preflight` in an
  isolated clean worktree. Unrelated changes in the primary checkout were not
  touched.
- A fresh fetch confirmed that `origin/main` still equalled the required SHA;
  no newer repository contract superseded this task.
- Project Guardian passed before documentation. `SEO-20` remains the sole SEO
  task `IN PROGRESS` and was not changed.
- Latest watchdog evidence remains scheduled run `41981042608`, classified
  `FAILED_SYSTEM` for the already recorded multi-retailer freshness/backlog
  debt. Its eBay result was a complete read-only observation with monitored
  backlog growth, not a new worker/runtime regression. No watchdog retry was
  started.

Fresh production-owner verification ran in a read-only transaction and proved:

| Production gate | Fresh result |
|---|---|
| Migration ledger | `260` |
| Migration SHA-256 | `015f0de7448c10fcca10174e74dfbf7ca9e3150951f49090d01cd6eee869024c` |
| Ledger fingerprint | `17a00891dff4e0a4f53050a018594fd505aa0aabc02b5281580b42895d7fd61e` |
| `20261105100000_refresh_pending_review_execution_binding` rows | exactly `1` |
| Publication RPC overloads | exactly `1` |
| Shared `PENDING` execution-binding refresh | present |
| Matching `APPROVED` evidence frozen | present |
| `HARD_PRICE_ANOMALY` | present |
| `UPDATE_PRICE_AND_STOCK` | present |
| Security | `SECURITY DEFINER`, `search_path=""`, owner `postgres` |
| Execute ACL | `postgres` and `service_role` only; `anon` and `authenticated` revoked |
| Readback database writes | `0` |

## Completely new eBay source capture

The existing `eBay Offer Refresh` workflow was dispatched on `main` with
`operation=dry-run` and `execution_mode=catalogue-refresh`. Apply preparation,
database apply baseline, approval verification, apply, postflight-after-apply,
idempotency-after-apply, reconciliation and `refresh-review-queue` publication
were all skipped.

| Evidence | Fresh value |
|---|---|
| Source workflow run | `42000205669` |
| Event / head SHA | `workflow_dispatch` / `0d8960764ef961f373e9fcc83c04be0abbf0452e` |
| Capture timestamp | `2026-11-05T09:11:32.832Z` |
| Contract expiry | `2026-11-06T09:11:32.832Z` |
| Source artifact | `13401888113` (`ebay-offer-refresh-42000205669-1`) |
| Artifact digest | `dd739f8124d122cdac622b146de0d19f90804c330341bcc38e796ad3ae7f03f9` |
| Contract SHA-256 | `d5cce1e740cab6a95769b0acf6318148e0a40f242e4b5e8cf0e990020e3b48c8` |
| Report SHA-256 | `5e4e2919cda99ccbb0b1c3a1ab436a43a30f98be806006ac5cb74f6f1d29368b` |
| Artifact-content SHA-256 | `11eb4d34d3ed622a5592ecb75ffd3594ac1e9d96059d7174b163a93d4e2ab2a0` |
| Full-capture fingerprint | `7c1db1c9d9ba21a7485c166edde944ca5ad6d4e329a891f31f81c174102c8edb` |
| Executable-source fingerprint | `6d92c5ca9b747bcfc867317bd94d057c4f98398809d761d47973a4aafb2eb440` |
| Review-scope fingerprint | `8dec230746b74570e4817cbaf70c1243c5c419be75727eee0ac39194a323e447` |
| Plan fingerprint | `b67970db2c244c0a85d3f69a027025ecbcffd29177a1fdde88c56652d24a18b8` |

Runs `41836635201`, `41905828377`, `41985745121`, artifacts `13328715529`,
`13359999389`, `13395744126`, reconciliations `41906705337` and
`41986437606`, and every earlier timestamp, fingerprint and idempotency key
were reused: **NO**.

## Fresh source classification

The source result is `PASS_WITH_REVIEW`. All 237 approved mappings were
observed and no row was blocked.

| Source classification | Count |
|---|---:|
| `VERIFY_NO_CHANGE` | 135 |
| `UPDATE_PRICE` | 11 |
| `UPDATE_STOCK` | 0 |
| `UPDATE_PRICE_AND_STOCK` | 3 |
| Identity review | 78 |
| Source-failure review | 10 |
| Identity/source review total | 88 |
| Blocked | 0 |

The 14 commercial rows are:

| Offer | Product / variant | Operation / reason | Price | Stock | Source fingerprint |
|---:|---|---|---|---|---|
| 2543 | Nutrend Pump Pre-Workout — Rainbow / 225g | `UPDATE_PRICE` / `PRICE_CHANGE` | `18.10 -> 18.50` | `true -> true` | `b963363234e868b75f495358a3831f301181e28a35ea500c5180ec6552c94ece` |
| 2544 | Applied Nutrition ISO-XP 1.8kg — Cafe Latte / 1.8kg | `UPDATE_PRICE` / `HARD_PRICE_ANOMALY` | `84.81 -> 108.77` | `true -> true` | `94d0c7f5eb1447727b85eb05c6649cbac5f6862370ea969577ef8f3a6b63edac` |
| 2601 | Nutrend Pump Pre-Workout — Bubble Gum / 225g | `UPDATE_PRICE` / `PRICE_CHANGE` | `18.10 -> 18.50` | `true -> true` | `9da0073936c3bea77f6352b697179238dd2b217a650269464441e5b453c6baae` |
| 2603 | JNX Sports The Ripper 150g — Watermelon Candy / 150g | `UPDATE_PRICE` / `PRICE_CHANGE` | `26.80 -> 32.20` | `true -> true` | `351c54500ee0745e98a79908cd0daef2e6a58f335ccc02895b59cc59867a5e20` |
| 2688 | 7Nutrition Cream Crunch 750g — Coconut / 750g | `UPDATE_PRICE` / `PRICE_CHANGE` | `14.99 -> 12.44` | `true -> true` | `8e61bd09d870f8d5d1293eae8ac3866f7befdc5b14e8ff9e7884d9573193e2c3` |
| 2689 | Optimum Nutrition 100% Plant Protein 684g — Chocolate / 684g | `UPDATE_PRICE` / `PRICE_CHANGE` | `34.85 -> 36.68` | `true -> true` | `9ff526e82c130d20f3f6e9354f6b42b936080dc052caa935faa8cb7876f5d18c` |
| 2703 | BioTech USA Nitrox Therapy 340g — Blue Grape / 340g | `UPDATE_PRICE` / `PRICE_CHANGE` | `18.00 -> 15.00` | `true -> true` | `044eb37c1e571d39f06de7bc7dfb0b17f56670c663960eb827a3805057dae3a5` |
| 2704 | Solgar Digestive Enzymes 100 Tablets — Default | `UPDATE_PRICE` / `PRICE_CHANGE` | `18.79 -> 20.29` | `true -> true` | `2bf20b60e2cb54391a5c3c06dbcd96df728091c7da54e8c1a6d4616863a4435c` |
| 2715 | Osavi Potassium 300mg — Default | `UPDATE_PRICE` / `PRICE_CHANGE` | `8.81 -> 8.60` | `true -> true` | `18937ca8d4b51667e75aae55a98fa5fc013df372f32c116ac4b045646efc17ec` |
| 2735 | Reflex Instant Mass Heavyweight 2kg — Chocolate Perfection / 2kg | `UPDATE_PRICE` / `PRICE_CHANGE` | `45.52 -> 45.08` | `true -> true` | `b6482b6713b9cb0cebe3b31c1edaada9d31604fac5fcfc65f2a218692f72b6ec` |
| 2744 | BioTech USA Black Blood CAF+ 300g — Cola / 300g | `UPDATE_PRICE` / `PRICE_CHANGE` | `31.47 -> 32.13` | `true -> true` | `97058b43177260279cdaad91bb59f096b5d679bf7b72c7378e4703413d27dd16` |
| 2749 | Trec Vitargo Electro Energy 1050g — Orange / 1.05kg | `UPDATE_PRICE_AND_STOCK` / `PRICE_AND_STOCK_CHANGE` | `27.99 -> 26.99` | `false -> true` | `16bc353a2d3181d69bb332837bd2236d97cb6a12a5474978af6cf69a5203cd76` |
| 2769 | SmartShake DC Comics SuperGirl 800ml — Default | `UPDATE_PRICE_AND_STOCK` / `PRICE_AND_STOCK_CHANGE` | `9.75 -> 9.92` | `false -> true` | `c824bd5ae8251e36871a872bd31ef9f8849a30b17c7422dc30b9e7e5e1fcbbd8` |
| 2774 | Trec Nutrition Caffeine 200 Plus 60 caps — Default | `UPDATE_PRICE_AND_STOCK` / `PRICE_AND_STOCK_CHANGE` | `9.49 -> 10.99` | `false -> true` | `a3c5ec80b4347436151d1f20cef9636d7dce995ee9fd28e1e6117ad9bd056f2e` |

Every row is bound to fresh plan fingerprint
`b67970db2c244c0a85d3f69a027025ecbcffd29177a1fdde88c56652d24a18b8`.

## Fresh reconciliation dry-run

The separate workflow was dispatched with `operation=dry-run`,
`execution_mode=review-queue-reconciliation` and the exact new eight-part source
binding. Source refresh and queue-publication jobs were skipped.

| Evidence | Value |
|---|---|
| Reconciliation run | `42001099184` |
| Head SHA | `0d8960764ef961f373e9fcc83c04be0abbf0452e` |
| Contract tests | PASS |
| Build result | fail-closed |
| Exact error | `Source/protected-plan proposed_state mismatch for commercial review offer 2543: stock/url` |
| Reconciliation artifact | **NONE** — build stopped before output and upload |
| Production writes | `0` |

The stock value for offer `2543` is `true` in both source and protected plan.
The mismatch is the affiliate URL only: the source response and plan contain
the same scheme, host, path and query key/value pairs but serialize those query
parameters in different orders. The same condition exists on every commercial
row:

- exact source/protected-plan URL string mismatches: **14**;
- mismatches after deterministic URL query canonicalization: **0**;
- current DB/protected-plan `expected_state` mismatches: **0**;
- source/protected-plan price, shipping, total or stock mismatches: **0**.

The current code compares the raw URL strings. Therefore the zero canonical
differences are diagnostic evidence only, not permission to bypass or weaken
the guard.

## Read-only lifecycle model — not a valid publication request

An independent production-owner transaction re-read the live queue, catalogue
and exact current offer/mapping state with `transaction_read_only=on`. A local
model then changed only URL serialization in memory to its deterministic
canonical form so that the existing lifecycle planner could expose downstream
counts. It did not patch repository code, write an artifact, call the
production RPC or produce usable publication identifiers.

| Lifecycle fact | Counterfactual count after URL canonicalization only |
|---|---:|
| Candidate incoming rows | 102 |
| Existing status-active eBay rows | 81 |
| `CREATE` | 32 |
| `REFRESH` | 66 |
| `SUPERSEDE` | 11 |
| `RESOLVE_BY_SOURCE` | 0 |
| `EXPIRE` | 0 |
| Expected final status-active eBay rows | 102 |
| Duplicate fingerprints | 0 |
| Missing source fingerprints | 0 |
| Missing plan fingerprints | 0 |

These are impact estimates, not an authorization pack. The actual
reconciliation did not emit an RPC request, so actual `CREATE`, `REFRESH`,
`SUPERSEDE`, `RESOLVE_BY_SOURCE` and `EXPIRE` operations are **not issued**.

## Shared PENDING refresh proof

The live SQL migration and focused regressions pass. The independent model
found eight same-semantic `PENDING` commercial refresh candidates:

`2543`, `2601`, `2603`, `2689`, `2715`, `2749`, `2769`, `2774`.

For all eight, current DB state equals the protected plan `expected_state`.
After URL canonicalization only, the fresh source state equals the protected
plan proposed state, the exact same fresh plan fingerprint is bound, source
evidence belongs to run `42000205669`, stable semantic source fingerprints are
preserved and execution-binding inconsistencies are zero. No mixed
old-state/new-plan row was found in the diagnostic model.

The proof cannot authorize publication because the current unmodified
reconciliation contract fails before those manifest rows exist. The migration
fix is live and not the failing layer.

## Previous three combined cases

Offers `2749`, `2769` and `2774` still produce
`UPDATE_PRICE_AND_STOCK / PRICE_AND_STOCK_CHANGE`. Fresh truth remains a price
change plus `false -> true` stock restoration for each.

All three have exact DB/plan before-state equality, exact numeric and stock
proposed-state equality, non-zero price and stock deltas, unchanged shipping and
plan URL, one `price_history: create`, registered adapter support and passing
worker/postflight/idempotency regressions. All three are nevertheless blocked
before a full manifest by the same raw URL parameter-order comparison. No
execution occurred.

## HARD_PRICE_ANOMALY

The fresh source has one hard-price row: offer `2544`, `84.81 -> 108.77`.

Producer normalization, canonical reason registry, JavaScript publisher, live
SQL allowlist, eBay adapter and protected worker tests all pass. The exact
source fingerprint is
`94d0c7f5eb1447727b85eb05c6649cbac5f6862370ea969577ef8f3a6b63edac`.
The row also encounters the common raw URL serialization mismatch, so no review
was published and no execution was requested.

## APPROVED freeze

The counterfactual lifecycle plan preserves four matching approved rows without
refreshing their execution evidence or owner decision:

| Review | Offer | Existing operation |
|---:|---:|---|
| 619 | 2695 | `MANUAL_REVIEW_IDENTITY` |
| 1159 | 2703 | `UPDATE_PRICE` |
| 1160 | 2704 | `UPDATE_PRICE` |
| 1632 | 2744 | `UPDATE_PRICE` |

The live RPC independently enforces the same `PENDING`-only refresh rule. No
approved row was changed in this task.

## Publication safety

| Safety gate | Result |
|---|---:|
| Unknown reasons | 0 |
| Unsupported publisher operations | 0 |
| Unsupported execution operations | 0 |
| DB/protected-plan baseline mismatches | 0 |
| Identity drift | 0 |
| Duplicate fingerprints | 0 |
| Missing required fingerprints | 0 |
| Exact source/protected execution-binding URL inconsistencies | **14** |
| Catalogue writes | 0 |

Because one required gate is non-zero, publication is prohibited.

## Owner impact and coverage

The current application current-row model reports eBay owner work as
`DECIDE 0`, `EXECUTE 0`, `PROCESSING 0`, `TECHNICAL 0`, `COMPLETED/current
145`. The invalid counterfactual after URL canonicalization only would report
`DECIDE 11`, `EXECUTE 0`, `PROCESSING 0`, `TECHNICAL 87`,
`COMPLETED/current 56`. Its `DECIDE` split is `8 UPDATE_PRICE`,
`0 UPDATE_STOCK`, `3 UPDATE_PRICE_AND_STOCK`, `0 VERIFY_NO_CHANGE`.
The fresh source has 88 identity/source review-only rows; the lifecycle model
places 87 in the current technical bucket because one is not a current-row
winner after lifecycle resolution. This simulated state is not published owner
work.

Current 24-hour fresh retailer depth for the 14 commercial rows is:

| Retailer depth | Rows |
|---:|---:|
| 0 | 9 |
| 1 | 4 |
| 2 | 1 |
| 3+ | 0 |

Potential impact after a later valid, separately owner-approved execution is:

| Potential effect | Rows |
|---|---:|
| First-retailer restoration | 3 |
| Second-retailer gain | 0 |
| Third-plus-retailer gain | 0 |
| Price-only change | 11 |
| Coverage reduction | 0 |

Freshness degradation means this differs from the earlier preflight. The fresh
readback is authoritative; no restoration or coverage gain occurred here.

## Hypothetical publication write model

Calculated only after local URL canonicalization:

| Control-plane effect | Counterfactual delta |
|---|---:|
| Queue mutations | 109 (`32` creates, `66` refreshes, `11` supersedes) |
| Review events | 109 |
| Publication seals | 1 |
| Counted queue/control-plane writes | 219 |
| Physical queue row delta | +32 |
| Status-active eBay row delta | +21 (`81 -> 102`) |
| Catalogue/offer/price/stock/history/mapping writes | **0** |

No valid publisher batch fingerprint, changeset fingerprint or idempotency key
is recorded because the unmodified contract did not build a request. Values
computed transiently inside diagnostic modelling are deliberately withheld and
must not be used.

## Verification and stop

- Focused eBay source, reconciliation, publisher, SQL and worker suite:
  `185/185 PASS`.
- Project Guardian before documentation: `PASS`.
- Documentation gates and remote PR evidence are recorded in the PR/final
  handoff.
- Production database writes: `0`.
- Review Queue/control-plane writes: `0`.
- Owner approvals and execution requests: `0`.
- Worker executions: `0`.
- Old evidence reused: `NO`.
- `SEO-20` changed: `NO`; it remains the sole SEO task `IN PROGRESS`.
- Exact stop: after documenting verdict `B. CONTRACT_STILL_BROKEN`, before any
  call to `publish_automation_review_queue_changes(jsonb)`, Review Queue
  mutation, owner decision, execution, catalogue write, migration, freshness
  recovery or unrelated roadmap work.
