# eBay fresh publication preflight after URL semantic fix — 2026-11-05

## Status, authority and stop boundary

- Verdict: **A. READY_FOR_FRESH_PUBLICATION**.
- This was a read-only preflight. It did not publish the Review Queue and did
  not approve or execute any review.
- Starting authoritative `origin/main`:
  `c55a17488dfc2bbb728d92ec9953d5c024f47732`.
- Production project: `aftboxmrdgyhizicfsfu`.
- Documentation PR: `#485`.
- Production database writes: `0`.
- Review Queue/control-plane writes: `0`.
- Executions: `0`.
- Old source, reconciliation, batch, changeset or idempotency evidence reused:
  **NO**.

The stop point is after fresh capture, fresh reconciliation, read-only
production analysis, verification, this documentation and its authorized
documentation-only merge; it is before
`publish_automation_review_queue_changes`, Review Queue mutation, owner
approval, execution request, worker execution, offer/price/stock/history or
mapping write, migration, freshness recovery, retailer onboarding, nutrition
work, SEO-20 change or category work.

## First gate

PR `#484` is merged as the required starting SHA. Its Project Guardian, full
Quality Gate, GitGuardian and Vercel checks passed, and it has zero unresolved
review threads. The feature tree and merge tree were identical. A fresh fetch
found no newer contract change superseding this task.

Project Guardian passed before the evidence change. `SEO-20` remains the sole
SEO task `IN PROGRESS`.

Fresh production readback used a read-only PostgreSQL transaction:

| Check | Result |
|---|---|
| Migration ledger rows | `260` |
| Ledger fingerprint | `17a00891dff4e0a4f53050a018594fd505aa0aabc02b5281580b42895d7fd61e` |
| `20261105100000_refresh_pending_review_execution_binding` | exactly `1` |
| Publication RPC overloads | exactly `1`: `publish_automation_review_queue_changes(jsonb)` |
| Security | `SECURITY DEFINER`, owner `postgres`, empty `search_path` |
| Execute grants | `anon=false`, `authenticated=false`, `service_role=true` |
| Live contracts | PENDING binding refresh, APPROVED freeze, `HARD_PRICE_ANOMALY` and `UPDATE_PRICE_AND_STOCK` present |
| Readback writes | `0` |

## Completely new source capture

The workflow was dispatched as `dry-run/catalogue-refresh` from exact `main`.
The reconciliation job and every prepare/apply/postflight job were skipped.

| Evidence | Value |
|---|---|
| Source run | `42012062652` |
| Source artifact | `13407363148` (`ebay-offer-refresh-42012062652-1`) |
| Artifact digest | `24f81c1ecc883dde7a0a27b44667b95de88d06f3a4a151ad86c3a03c38e44996` |
| Capture timestamp | `2026-11-05T10:36:55.740Z` |
| Commit | `c55a17488dfc2bbb728d92ec9953d5c024f47732` |
| Contract SHA-256 | `2291fccb294d0ab999a4c0a911603cdddde302c71b495e3e3c88074e77b18977` |
| Report SHA-256 | `fb5b0e09b0e20fc7b88251809685d955f58521e3829d03f9b8cbf109fc028a16` |
| Artifact-content SHA-256 | `0a3c272f12531195dc8eee4b6c2df8f418b0f49110fa0f1c0e6b7c54b8cfffca` |
| Full/source fingerprint | `f17c2a3f7efecd5145db071624a759d5d27b6baf62427eaf9ba52b3204c339cb` |
| Executable-source fingerprint | `3f4005c10d49ab64d5aea9c355c114af132ea20353235b02166535fed93a7626` |
| Review-scope fingerprint | `84359347b6d09e9a957af4f62248746ae57e16708d2d475ca544f8ad860e3a28` |
| Plan fingerprint | `3cd486210d36fc28de923fd8af61ce5e4d2412fb67b4a2e8e20c28aca9e6d822` |
| Approved mappings observed | `237/237` |
| Catalogue writes | `0` |

### Source result

| Classification | Count |
|---|---:|
| `VERIFY_NO_CHANGE` | 152 |
| `UPDATE_PRICE` | 12 |
| `UPDATE_STOCK` | 0 |
| `UPDATE_PRICE_AND_STOCK` | 3 |
| Identity review | 61 |
| Source failure | 9 |
| Blocked | 0 |

The 15 fresh commercial rows are:

| Offer | Product / variant | Operation | Reason | Price before → new | Stock before → new | Source fingerprint |
|---:|---|---|---|---|---|---|
| 2543 | Nutrend Pump Pre-Workout — Rainbow / 225g | `UPDATE_PRICE` | `PRICE_CHANGE` | 18.10 → 18.50 | true → true | `b963363234e868b75f495358a3831f301181e28a35ea500c5180ec6552c94ece` |
| 2544 | Applied Nutrition ISO-XP 1.8kg — Cafe Latte / 1.8kg | `UPDATE_PRICE` | `HARD_PRICE_ANOMALY` | 84.81 → 108.77 | true → true | `94d0c7f5eb1447727b85eb05c6649cbac5f6862370ea969577ef8f3a6b63edac` |
| 2601 | Nutrend Pump Pre-Workout — Bubble Gum / 225g | `UPDATE_PRICE` | `PRICE_CHANGE` | 18.10 → 18.50 | true → true | `9da0073936c3bea77f6352b697179238dd2b217a650269464441e5b453c6baae` |
| 2603 | JNX Sports The Ripper Fat Burner Powder 150g — Watermelon Candy | `UPDATE_PRICE` | `PRICE_CHANGE` | 26.80 → 32.20 | true → true | `351c54500ee0745e98a79908cd0daef2e6a58f335ccc02895b59cc59867a5e20` |
| 2688 | 7Nutrition Cream Crunch 750g — Coconut | `UPDATE_PRICE` | `PRICE_CHANGE` | 14.99 → 12.44 | true → true | `8e61bd09d870f8d5d1293eae8ac3866f7befdc5b14e8ff9e7884d9573193e2c3` |
| 2689 | Optimum Nutrition 100% Plant Protein 684g — Chocolate | `UPDATE_PRICE` | `PRICE_CHANGE` | 34.85 → 36.68 | true → true | `9ff526e82c130d20f3f6e9354f6b42b936080dc052caa935faa8cb7876f5d18c` |
| 2690 | Barebells High Protein Milkshake 330ml — Strawberry | `UPDATE_PRICE` | `PRICE_CHANGE` | 27.45 → 28.80 | true → true | `6e0bd5ae9f7f3acefb4557e6ae40f60355eed031f484a68b45b0b5b91ea01077` |
| 2703 | BioTech USA Nitrox Therapy 340g — Blue Grape | `UPDATE_PRICE` | `PRICE_CHANGE` | 18.00 → 15.00 | true → true | `044eb37c1e571d39f06de7bc7dfb0b17f56670c663960eb827a3805057dae3a5` |
| 2704 | Solgar Digestive Enzymes 100 Tablets — Default | `UPDATE_PRICE` | `PRICE_CHANGE` | 18.79 → 20.29 | true → true | `2bf20b60e2cb54391a5c3c06dbcd96df728091c7da54e8c1a6d4616863a4435c` |
| 2715 | Osavi Potassium 300mg — Default | `UPDATE_PRICE` | `PRICE_CHANGE` | 8.81 → 8.60 | true → true | `18937ca8d4b51667e75aae55a98fa5fc013df372f32c116ac4b045646efc17ec` |
| 2735 | Reflex Instant Mass Heavyweight 2kg — Chocolate Perfection | `UPDATE_PRICE` | `PRICE_CHANGE` | 45.52 → 45.08 | true → true | `b6482b6713b9cb0cebe3b31c1edaada9d31604fac5fcfc65f2a218692f72b6ec` |
| 2744 | BioTech USA Black Blood CAF+ 300g — Cola | `UPDATE_PRICE` | `PRICE_CHANGE` | 31.47 → 32.13 | true → true | `97058b43177260279cdaad91bb59f096b5d679bf7b72c7378e4703413d27dd16` |
| 2749 | Trec Vitargo Electro Energy 1050g — Orange | `UPDATE_PRICE_AND_STOCK` | `PRICE_AND_STOCK_CHANGE` | 27.99 → 26.99 | false → true | `16bc353a2d3181d69bb332837bd2236d97cb6a12a5474978af6cf69a5203cd76` |
| 2769 | SmartShake DC Comics SuperGirl 800ml — Default | `UPDATE_PRICE_AND_STOCK` | `PRICE_AND_STOCK_CHANGE` | 9.75 → 9.92 | false → true | `c824bd5ae8251e36871a872bd31ef9f8849a30b17c7422dc30b9e7e5e1fcbbd8` |
| 2774 | Trec Nutrition Caffeine 200 Plus — Default | `UPDATE_PRICE_AND_STOCK` | `PRICE_AND_STOCK_CHANGE` | 9.49 → 10.99 | false → true | `a3c5ec80b4347436151d1f20cef9636d7dce995ee9fd28e1e6117ad9bd056f2e` |

Every price-changing plan creates one price-history row if it is later
separately approved and executed. No row was executed in this task.

## Fresh artifact-bound reconciliation

The second dispatch used only the new source through the exact eight-part
source binding. It ran as `dry-run/review-queue-reconciliation`; the source
refresh and publication jobs were skipped.

| Evidence | Value |
|---|---|
| Reconciliation run | `42012826338` |
| Reconciliation artifact | `13408475449` (`ebay-review-queue-reconciliation-42012826338-1`) |
| Reconciliation artifact digest | `488096fe45b710f52d13edf8301ee09b2fe24d6a2b763476a28137a427c389d7` |
| Reconciliation result | `PASS`, dry-run |
| Incoming rows | 85 |
| Existing active rows | 81 |
| `CREATE` | 6 |
| `REFRESH` | 75 |
| `SUPERSEDE` | 2 |
| `RESOLVE_BY_SOURCE` | 0 |
| `EXPIRE` | 0 |
| Expected final active rows | 85 |
| Production/direct REST writes | `0 / 0` |

### Safety gate

| Failure class | Count |
|---|---:|
| Unknown reasons | 0 |
| Unsupported publisher operations | 0 |
| Unsupported execution operations | 0 |
| Duplicate problem fingerprints | 0 |
| Missing source fingerprints | 0 |
| Missing plan fingerprints | 0 |
| DB/protected-plan baseline mismatches | 0 |
| Identity drift | 0 |
| Execution-binding inconsistencies | 0 |
| Semantic affiliate URL mismatches | 0 |
| Catalogue writes | 0 |

Manifest distributions were 15 `COMMERCIAL_CHANGE`, 61
`IDENTITY_CONFLICT` and 9 `SOURCE_FAILURE`; all operations and reasons are in
the publisher contract. The only executable commercial operations are 12
`UPDATE_PRICE` and 3 `UPDATE_PRICE_AND_STOCK`, both supported by the eBay
worker. Identity and source-failure rows remain review-only.

## URL regression proof

- Raw source affiliate URL versus protected proposed URL mismatches: `15`.
- `stableAffiliateUrl(source) == stableAffiliateUrl(protected proposed)`
  mismatches: `0`.
- Exact DB/protected-plan expected-state URL mismatches: `0`.
- Exact mapping `external_url` identity mismatches: `0`.
- Protected plan before URL equals the unchanged authoritative proposed URL on
  all 15 commercial rows.
- The shared helper still fails closed for changed host, path, scheme, port,
  meaningful query key/value, missing/extra meaningful query data and changed
  repeated values. It ignores only deterministic parameter order and the
  existing technical `amdata` exception.

The source comparison is semantic only. DB-to-plan, review-to-plan,
mapping-identity and postflight comparisons remain exact.

## Shared PENDING refresh and APPROVED freeze

Nine same-semantic PENDING commercial rows refresh atomically: offers `2543`,
`2601`, `2603`, `2689`, `2690`, `2715`, `2749`, `2769` and `2774`.
Read-only comparison proved for every one that current DB state equals the
protected expected state and manifest `before_state`, while fresh source state
equals protected proposed state and manifest `proposed_state`. Source evidence,
plan fingerprint, before state and proposed state form one consistent binding;
execution-binding inconsistencies are `0`.

Four matching APPROVED rows remain frozen: review IDs `619`, `1159`, `1160`
and `1632` (offers `2695`, `2703`, `2704`, `2744`). They are not REFRESH
operations. Their before/proposed evidence, plan fingerprint, decision,
decision actor and decision timestamp remain untouched.

## Commercial contract proof

The focused source, reconciliation, publisher, live-SQL and protected-worker
suite passed `189/189`.

- Ordinary price rows retain exact identity and DB baseline, the exact
  protected proposed state, unchanged shipping/stock/URL, one future
  price-history create, postflight validation and idempotent no-op recheck.
- The one `HARD_PRICE_ANOMALY` row is offer `2544`. The producer classification,
  canonical reason registry, publisher allowlist, live SQL allowlist, eBay
  adapter plan and protected worker all accept the same bounded
  `UPDATE_PRICE` contract.
- The three combined rows are offers `2749`, `2769` and `2774`. Each changes
  both price and stock, has reason `PRICE_AND_STOCK_CHANGE`, exact identity,
  exact before and protected proposed states, semantic source URL equality,
  one future price-history create, and passing adapter, worker, postflight and
  idempotency contracts.

No execution request or worker execution occurred.

## Owner impact and coverage simulation

The current eBay admin projection is `DECIDE 0 / EXECUTE 0 / PROCESSING 0 /
TECHNICAL 0 / COMPLETED 145`.

Hypothetical post-publication projection is `DECIDE 12 / EXECUTE 0 /
PROCESSING 0 / TECHNICAL 69 / COMPLETED 64`. `DECIDE` contains 9
`UPDATE_PRICE`, 0 `UPDATE_STOCK`, 3 `UPDATE_PRICE_AND_STOCK` and 0
`VERIFY_NO_CHANGE`. Identity and source-failure rows remain separate in the
technical/review-only path.

For the 15 executable commercial rows, current fresh-retailer depth is:

| Depth | Rows |
|---|---:|
| 0 | 12 |
| 1 | 2 |
| 2 | 1 |
| 3+ | 0 |

Potential effect if separately approved and executed: 3 first-retailer
restorations, 0 second-retailer gains, 0 third-plus gains, 12 price-only
updates and 0 coverage reductions.

## Hypothetical publication write model

| Control-plane effect | Delta |
|---|---:|
| Queue lifecycle mutations | 83 |
| Review events | 83 |
| Publication seals | 1 |
| Physical queue-row delta | +6 |
| Active-row delta | +4 |
| Catalogue writes | 0 |

Production counters were unchanged across fresh capture, reconciliation and
the final read-only analysis: queue `3445`, review events `9808`, publication
seals `195`; catalogue counts remained products `1399`, variants `4070`,
retailer products `4361`, offers `4361`, price history `48366`.

## Verdict and exact owner authorization pack

All safety-gate failures are zero, the fresh reconciliation is valid and there
is actionable owner-review work. The exact verdict is:

**A. READY_FOR_FRESH_PUBLICATION**

This is not publication authority. If the owner chooses to publish this exact
fresh changeset, the separate authorization must bind all of the following:

| Authorization field | Exact value |
|---|---|
| Source run | `42012062652` |
| Source artifact | `13407363148` |
| Source artifact digest | `24f81c1ecc883dde7a0a27b44667b95de88d06f3a4a151ad86c3a03c38e44996` |
| Capture timestamp | `2026-11-05T10:36:55.740Z` |
| Reconciliation run | `42012826338` |
| Reconciliation artifact | `13408475449` |
| Incoming | 85 |
| `CREATE / REFRESH / SUPERSEDE / RESOLVE_BY_SOURCE / EXPIRE` | `6 / 75 / 2 / 0 / 0` |
| `HARD_PRICE_ANOMALY` | 1 |
| `UPDATE_PRICE / UPDATE_STOCK / UPDATE_PRICE_AND_STOCK` | `12 / 0 / 3` |
| Expected owner `DECIDE` | 12 |
| Expected queue mutations | 83 |
| Expected review-event delta | 83 |
| Expected publication-seal delta | 1 |
| Expected catalogue writes | 0 |
| Publisher batch fingerprint | `48c5c23e8ebaad72913c3f45a0575a94c2f37030116b8a6d0e39a0630517deaa` |
| Changeset fingerprint | `8e148c81de44996c35a40fc6ba58a682ce9e913e1c7ec6eae6b6aa396507a9b6` |
| Idempotency key | `f27f5e91a17ae4ae27ab5548bed074fc8e71443a11446bb6f6e03576fa21e749` |
| Expected final active | 85 |

Post-publication verification must, in one bounded readback, verify the exact
RPC echo and three identifiers, `6/75/2/0/0` lifecycle counts, final active
count 85, queue/event/publication deltas `83/83/1`, physical/active deltas
`+6/+4`, unchanged catalogue counts and catalogue hash, preserved APPROVED
rows, no execution-request delta and zero catalogue writes. It must not execute
reviews or trigger eBay refresh.

## Verification

- New source workflow: `PASS`.
- New reconciliation workflow: `PASS`.
- Focused contract tests: `189/189 PASS`.
- Project Guardian before documentation: `PASS`.
- Project Guardian after documentation: `PASS`.
- Quality Gate quick/full: `PASS / PASS`.
- Documentation PR GitGuardian and Vercel: `PASS`; unresolved review threads:
  `0` before merge.
