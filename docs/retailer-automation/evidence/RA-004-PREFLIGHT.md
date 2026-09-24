# RA-004 — 10 Reps shadow pilot preflight

**Status:** `IN_PROGRESS`

**Gate:** `PREFLIGHT VERIFIED`

**Baseline:** `74b2360a064c16c98fd7fe4291698713cc3e1801`

**Manifest:** [`RA-004-shadow-plan.json`](RA-004-shadow-plan.json)

**LIVE SHADOW RUN NOT AUTHORIZED**

This is a documentation-only preflight. It did not fetch the live feed, run a
shadow replay, query a production database, execute SQL, create or alter a
control plan, create or consume an approval, apply a change, publish a review
row, dispatch a workflow, import data or enable Model B/auto-safe behavior.

## Conclusion and blockers

Independent verification confirms that the active 10 Reps production route,
historical evidence, capture design, matching, parity and stop conditions are
documented correctly. The preflight may be merged as the official blocker
record, but a shadow run is not safe to authorize yet:

1. `buildRun()` always obtains its own source through `readSourceSnapshot()`;
   aggregate-price isolation may fetch a second capture. There is no complete
   legacy replay entry point accepting one immutable local byte snapshot while
   denying DB/control/approval/apply/refetch capabilities.
2. Canonical v1 is a test-only zero-write harness, but no 10 Reps adapter maps
   the CSV projection and the same read-only target state into its fixture
   contract. It must not be improvised during an authorized run.
3. Retained workflow artifacts do not expose a complete current inventory of
   plans, sessions, locks, approvals and recovery state. No approved exporter
   for that inventory was found, and direct SQL is forbidden.

The minimal implementation before a run is a test-only adapter/orchestrator
that (a) accepts captured bytes and a separately authorized read-only state
export, (b) calls the existing CSV projection, legacy classification primitives
and canonical v1 harness, (c) injects fail-closed network/write/approval/apply
capabilities, and (d) emits deterministic local reports. It must have no
production or workflow import. Separately, an owner-approved read-only state
export must cover the conflict checks. Neither change is implemented here.

## Active 10 Reps path

The live entry point is the `ten-reps-offer-refresh` job in
`.github/workflows/fit-house-offer-refresh.yml`, running
`RETAILER_REFRESH_PROFILE=10reps node scripts/fit-house-offer-refresh.js` on
`main`. The v8/v9/v10 onboarding paths are historical catalogue-import
contracts; their higher version numbers do not make them the active refresh
path.

| Stage | File / symbol or entry point | State | Input → output | Capabilities and side effects | Tests / guards |
|---|---|---|---|---|---|
| Source configuration | `config/retailers/10reps-offer-sync.json` | active | env reference + policy → profile | no execution itself | exact retailer 14, 950 scope, source and guard thresholds |
| Scheduler | `.github/workflows/fit-house-offer-refresh.yml` / `ten-reps-offer-refresh` | active | schedule/dispatch → job | network; in scheduled/apply mode can reach every later write stage | main/repository/event guard; production-readonly environment; serialized write concurrency |
| Fetch | `scripts/fit-house-offer-refresh.js` / `readSourceSnapshot()` | active | `TEN_REPS_FEED_URL` → snapshot | HTTPS GET; may retry three times; aggregate isolation can make a second capture | source-origin, timeout, size, content-type and redirect guards |
| Raw handling | `scripts/lib/csv-product-feed-reader.js` / `readCsvProductFeed()` | active, in-memory | HTTP bytes → hashes + parsed rows | network through injected/default fetch; no DB; active workflow does not retain raw CSV | byte limit, SHA-256, status/content-type checks |
| Parser / normalization | same / `projectCsvRows()` | active | CSV bytes → products and `source_variants` | no network or DB | exact header order; numeric unique IDs; URL/stock/price guards |
| Identity mapping | `scripts/fit-house-offer-refresh.js` / `loadApprovedManifest()`, `readState()`, `targetFor()` | active | 950-row manifest + DB state + source IDs → targets | `readState()` reads production DB; no intended business write | manifest SHA/shape/count, unique external variant and exact scope checks |
| Diff | `scripts/lib/retailer-offer-sync/classifier.js` / `classifyExistingOffers()` | active | targets + normalized source → classified rows | pure local classification | identity, URL, price, stock, freshness, missing-source and aggregate guards |
| Validation | `scripts/fit-house-offer-refresh.js` / `validate()` | active | sealed batches → validator result | read-only DB RPC `validate_retailer_offer_sync_batch_read_only`; no intended write | role/target/migration/policy fingerprints and per-batch limits |
| Control plan | same / `registrationRequest()`, `register()` | active only for apply | validated run → parent/children | writes control ledger through `register_10reps_offer_sync_control_plan` | exact fingerprints, target, expiry and child coverage |
| Approval | same / `prepareSequentialParentApproval()`, `approveAndExecute()` | active only for apply | registered plan → parent/child approvals | creates approvals; consumes them during execution | separated approver role, short expiry, exact plan/execution fingerprints |
| Executor | same / `approveAndExecute()` | active only for apply | approved child → applied offer batch | business DB and price-history writes through shared executor | separated executor role, exact approval, migration and target attestation |
| Postflight | `scripts/retailer-offer-refresh-postflight.js` / `10-reps` profile | active after scheduled/apply | baseline + apply report + readback → postflight | read-only DB access; local JSON output | exact 950 scope, expected deltas, run correlation and idempotency |
| Watchdog | `scripts/automation-reliability-watchdog.js` + `config/automation-reliability-watchdog.json` | active | retained run artifacts → watchdog report | GitHub network reads and local artifact output; reports zero DB writes | run/artifact correlation, backlog, write and postflight guards |
| Onboarding v8/v9/v10 | `scripts/import-products.js`, reviewed manifests, bootstrap approver | historical, not refresh entry point | reviewed CSV/artifact → catalogue plans/approvals/import | can approve/import/write when explicitly invoked | immutable package hashes and artifact-bound tests; forbidden in shadow |

The production `--mode=dry-run` is not a zero-capability shadow entry point: it
still fetches live data, reads production state, invokes the DB validator and
writes local reports. It normally avoids registration/approval/apply, but it
cannot consume one supplied snapshot and can refetch during aggregate-price
confirmation. The production `--mode=apply` proceeds through every write stage.

## Source and CSV schema

- Type: protected CSV product feed on the retailer HTTPS origin.
- Location: the value is referenced only as `TEN_REPS_FEED_URL`; the repository
  secret exists (last metadata update 8 September 2026). Its value was neither
  read nor printed. Validator/approver/executor DB secret names also exist in
  the `production-readonly` environment; they are not authority for this run.
- Configuration SHA-256: `a76b25a5e47ec9739ec806ee71705d6f1e524153f56aa9dd327a3ec7cfcafbd4`.
- Reader SHA-256: `a5f940ccc21d8d71a4f87fe8289664df8a64bf9dfcab5580aa012320fef0164a`.
- Authentication is not expressed in the request headers; the protected URL
  itself may contain access material and must always be redacted.
- The parser uses `csv-parse/sync` with header rows, empty-line skipping and
  BOM support. Defaults mean comma delimiter, double-quote quoting and UTF-8
  bytes. Any delimiter, quoting or encoding drift is a stop condition.
- Required headers, in exact order: `product_id`, `variant_id`, `product_name`,
  `brand`, `category`, `variant_name`, `flavour`, `size`, `sku`, `ean`, `price`,
  `sale_price`, `current_price`, `stock_status`, `product_url`, `image_url`,
  `last_updated`.
- All headers are mandatory. `variant_id` may be empty and then falls back to
  `product_id`; `sku` and `last_updated` may be empty. Descriptive fields,
  `ean`, `price`, `sale_price` and `image_url` are present in the schema but the
  active refresh projection does not use them for identity or price decisions.
- Product and variant IDs must be decimal integers; variant IDs must be unique.
  Product name is never an identity key. URLs must remain on the configured
  HTTPS origin.
- `current_price` is the active price, must be a positive decimal with at most
  two fractional digits, and is normalized to two decimals. The active profile
  implies GBP; the CSV has no currency column, so any contrary currency
  evidence blocks the run.
- Stock accepts only `instock`, `outofstock` or `onbackorder`; only `instock`
  maps to available. Source absence remains review evidence and is not itself
  proof of out-of-stock.

## Last confirmed runs and source evidence

GitHub history through 24 September 2026 has no later shared refresh than run
`35834479612`, scheduled at `2026-09-23T07:57:56Z` on
`121fc5ce909c925e7234aef3a249661c8e7d0826`. The overall workflow failed only
because the Fit House summary job failed; the `ten-reps-offer-refresh` job and
all its steps succeeded. Retained artifact `10739107735` is 87,941 bytes with
GitHub digest
`sha256:83fdc78caf6dc0e9bcb4bd57ebf09f9cea9b0b43093b0983b99d88f81d3347ce`
and expires 7 October 2026. It was not downloaded in this preflight.

The retained RA-000 audit records 950 mapped outputs: 935 executed and 15
isolated for review, with postflight/idempotency passing. These are historical
23 September results, not a current feed count. The last trustworthy historical
source baseline in tracked config is 473 products and 1,663 variants; it is a
guard baseline, not a statement about the current live feed. No current raw or
semantic feed fingerprint was obtained.

The latest watchdog run inspected by metadata/log only is `35956446187` at
`2026-09-24T04:37:36Z`: overall `FAIL`, 3 failed retailers and zero DB writes;
artifact `10790393391` has digest
`sha256:17c35a3a09eb2d68816724c280ee9252e8dfea7f14f7ab8577d97c346d851c81`.
Its log does not expose the retailer-specific rows. The last retained
retailer-specific evidence remains run `35854459443`, which reported the
historical 10 Reps review backlog of 15 against a static zero baseline.

## Plans, sessions, locks and approvals

Existing scripts prove the mechanisms and schemas, but no approved command was
found that exports all current 10 Reps parent/child plans, open sessions, locks,
unused/expired approvals, incomplete/recovery plans and last execution without
direct SQL. The workflow artifact records the last postflight, not the complete
current control state. Therefore:

| Check | Preflight result |
|---|---|
| Active/conflicting control plans | unknown — blocking before capture |
| Open sessions and advisory locks | unknown — blocking before capture |
| Unused and expired approvals | unknown — blocking before capture |
| Incomplete and recovery plans | unknown — blocking before capture |
| Last executed plan | historical run `35834479612`; exact current ledger state not exported |
| Last postflight | historical 10 Reps step success in `35834479612` |
| Last watchdog | overall run `35956446187`; current retailer detail unavailable without its artifact |

The required permission is owner approval for an existing or separately
reviewed, field-bounded read-only exporter. It must be unable to mutate or close
anything and must produce a hashable local export. No workaround is authorized.

## Existing artifact inventory

The original ignored directory `tmp/retailer-feeds/10reps/` contains 573 files
(55,004,260 bytes): 69 CSV, 220 JSON, 62 detached SHA files and 222 other local
history/helper files. It was inventoried read-only. It is ignored, untracked,
outside the clean worktree and must not be committed. The active 950-row
manifest and reviewed manifests are tracked.

| Category | Location / tracking / availability | Safe fingerprint evidence | Preflight and future-shadow use |
|---|---|---|---|
| Raw/normalized catalogue snapshots | ignored `tmp/retailer-feeds/10reps/`, including `10reps-full-catalog-feed.csv` and canonical snapshots; available | raw feed SHA `c86dac4de1504dd4a44c5542a3791e00d75be33537df914a75489aed50b12bfc` | historical structure only; too old for live baseline or shadow input |
| Active refresh scope | tracked `config/retailers/10reps-approved-offer-manifest.json`; available | bytes SHA `b567567678b6fe663a62c79b14b3f75caec037f24b392ae119668c93ba83e65a`; configured LF-normalized SHA `5b5c4583...c7c4f8` | required scope input; revalidate against read-only state export |
| Reviewed manifests | tracked `config/retailers/10reps-reviewed-*.json`; available | individually hash-bound by tests | historical authority/context only; owner review required for any new use |
| Approval/plan contracts | tracked approver, manifests and migrations plus ignored dry-run plans; available | exact expected hashes in `10reps-bootstrap-artifact-approver.js` | preflight inventory only; approval/import paths forbidden in shadow |
| Execution/postflight reports | ignored local production-result/readback files and retained GitHub artifact metadata; partly available | per-file local SHA or GitHub digest | historical context only; not current baseline |
| Watchdog reports | retained GitHub metadata; current artifact not downloaded | latest digest shown above | metadata supports blocker/status only; retailer detail needs approved evidence access |
| v8 bootstrap 4 | tracked manifest; ignored CSV + dry-run available | CSV `9b03a0bc0773b5de70857aab8035fef0ada0a70d8f46e8a8785928d0afd55284`; dry-run `a5c575586e01067e0596da71d23b75f5a50ad785e477a7aad49a0440ff840442` | artifact-bound regression only; too old for live shadow |
| v8 Time 4 | tracked manifest; ignored CSV + dry-run available | CSV `45ebeafaa283d6d14a83714c7df1af5ddb5a0a5151828239daf033a14725d73a`; dry-run `bcd141d34ceece338f9e67cb11357597ee2bbf8c9418b7a1db8fe8a773fba832` | artifact-bound regression only; too old for live shadow |
| v8 remaining 18 | tracked manifest; ignored CSV + dry-run available | CSV `4843377df92ce50803844f50cd558b8054dc59969ccfe8caca0bc49ecb25d76b`; dry-run `da01fabc4595c12f75dda3de85069daa652d0bbc8ba3964d79b55c36deb06a10` | artifact-bound regression only; too old for live shadow |
| v9 bootstrap 7 / remaining 94 | tracked manifest; ignored pairs available | bootstrap CSV/artifact `9497f360c5f7f1e524d618edea860a193a67b79351ba45147a4a5a3a2bca360a` / `e218eadaae92f6604dce8caee633e5af3383adc76b3cb61f868c477dd9fc3a71`; remaining CSV/artifact `9c8f5990edb9e52627a8f76798e4f88a6e71439a78e27814f3abd22f9685f889` / `c6dce2596114cde50e062be81fc4ec3a7a86976d4aac065359d86ef27366da51` | artifact-bound regression only; too old for live shadow |
| v10 existing 14 / bootstrap 8 / remaining 71 | tracked manifest; ignored pairs available | existing CSV/artifact `d708214ea789b06a3bea8a9c51bc17d4ccc8d20522277d90adc75371751a485b` / `f6f97b84f92e42390ab35008ec4ea33aa1f38913461b7153c2ce468493cd28e5`; bootstrap `8f0650d53f611bd34deabe631d009776b12a3f4168871a408cfa5ab2fd6c7331` / `9aec9dc6574f9e5a6e1ad6ec16c49add116b29ed992d90f75082a2c3dfd100a7`; remaining `45934dc45e7abfb89ac380e8ca62a39edb54f9c2804b9677fa15a0b6718e9f07` / `c8ad02dc1b7cba14b86c6701657146f46f6f93554c314863dce587b236809e40` | artifact-bound regression only; too old for live shadow |
| Historical RA evidence | tracked `AUDIT.md`, RA-000 README, RA-002 and RA-003 evidence | repository history and recorded run/artifact digests | valid historical evidence, never current source/control state |

All eight protected v8/v9/v10 CSV/dry-run pairs above match their expected
SHA-256 values. No missing artifact was created or downloaded. Production-result
files, helper scripts and old raw snapshots may contain operational context and
must remain ignored; their presence is not shadow authorization.

## Proposed immutable capture (not executed)

After blockers and owner decisions are closed, a separately reviewed capture
command should call a capture-only wrapper around `readCsvProductFeed()` once.
It must issue exactly one HTTPS `GET` (`Accept: text/csv`, redirects rejected),
with one attempt, 30-second timeout and 10,000,000-byte ceiling. This is stricter
than the active retry configuration because a shadow comparison needs one
immutable observation, not up to three observations.

Before parsing, reject non-200, missing/non-CSV content type, empty/oversized
body, HTML/challenge signatures, invalid UTF-8/BOM behavior and header drift.
Hash the exact bytes first, write once to an ignored run-specific directory,
mark the file read-only where supported, and write separate redacted metadata:
timestamp, byte count, status, media type, request count, config/commit hash and
raw SHA-256. Never retain the URL or authorization material.

Parse only from those sealed bytes, compute the semantic fingerprint and then
remove/deny network capability. Both paths receive the same read-only file
descriptor/buffer and must record the same raw SHA. Any refetch, hash change or
attempt to invoke an importer, DB writer, RPC, approval or workflow is an
immediate stop. Retention and deletion date require the owner's data-handling
decision; no raw feed belongs in Git or a public artifact.

## Legacy and canonical replay design

- Legacy baseline: existing `projectCsvRows()`, source-health/reconciliation,
  `classifyExistingOffers()`, plan/artifact builders and status projection from
  `fit-house-offer-refresh.js`, fed by the sealed snapshot and one sealed
  read-only target-state export. Registration, validator DB call, approval,
  executor, Review Queue publication and postflight DB call are replaced by
  denied capabilities. Current `buildRun()` cannot do this without the minimal
  test-only injection adapter described above.
- Canonical candidate: `runZeroWriteHarness()` in
  `scripts/lib/retailer-offer-sync/canonical-v1/zero-write-harness.js`, with a
  new test-only 10 Reps adapter translating the same `projectCsvRows()` output
  and target export into canonical v1 raw/expected records. The adapter must not
  encode retailer logic in canonical core.
- Replay: after capture, both paths operate offline from immutable inputs.
  Repeat replay starts new processes but reuses the exact same hashes; it never
  reopens the network or production database.

## Record matching

First partition every source row under the shared raw fingerprint. Match the
unique tuple `(external_product_id, external_variant_id)` to the approved
mapping; corroborate with source row ID, mapping ID, canonical product/variant
IDs, then SKU and GTIN when present. Missing identifiers never fall back to a
product-name-only match. Duplicate keys and one-to-many/many-to-one relations
are `AMBIGUOUS`, not silently selected.

Every input and output row must terminate as `MATCHED_EXACTLY`,
`MATCHED_WITH_DOCUMENTED_CONTEXT`, `LEGACY_ONLY`, `CANONICAL_ONLY`, `AMBIGUOUS`
or `INVALID`. Cardinality accounting must prove that no row disappeared.

## Proposed parity contract

Compare all fields listed in the machine manifest, including counts, identity,
product/variant mapping, exact GBP minor units, currency, availability,
`SOURCE_MISSING`, change/review classification, reason, blocking scope, outcome,
alert, next action, fingerprints, isolation and side-effect counters.

| Difference class | Meaning and required evidence | Gate / decision / action |
|---|---|---|
| `EXACT_PARITY` | byte/canonical-equal comparable output | non-blocking; machine accepted; retain proof |
| `SEMANTIC_PARITY` | representation differs but approved normalization yields the same meaning | non-blocking only with registry-backed mapping; verifier confirms; retain mapping proof |
| `EXPECTED_IMPROVEMENT` | canonical output intentionally fixes a documented contract weakness | blocks until owner accepts linked incident/contract evidence; add regression |
| `LEGACY_DEFECT_CONFIRMED` | legacy result contradicts a proved incident/contract while canonical matches it | blocks until owner accepts defect evidence and containment; add regression/issue |
| `CANONICAL_DEFECT` | canonical result violates contract or loses legacy safety | always blocks; engineering fixes and replays from same snapshot |
| `UNEXPLAINED_DIFFERENCE` | no complete evidence-backed explanation | always blocks; owner cannot waive it as an error percentage |

Pass requires zero writes, approvals, apply, control-plan/queue publication and
post-capture network attempts; zero unclassified rows; zero unexplained price or
currency differences; no source-missing-only automatic OOS; isolation of every
identity conflict; a registered reason for every difference; no canonical
defects/unexplained differences; owner acceptance of each claimed improvement
or legacy defect; and bit-for-bit identical repeat reports. There is no
percentage error budget.

## Stop conditions

Stop before further processing for unexpected content type, HTML/challenge,
empty/oversized body, missing/reordered headers, delimiter/quoting/encoding
drift, duplicate critical IDs, invalid/contrary currency evidence, invalid
price, or record-count change outside a separately evidence-based owner-approved
range. The historical 473/1,663 values do not by themselves set that range.

Also stop for missing/changing fingerprints, a conflicting active plan, open
session/lock, overlapping unexpired approval, any write/approval/apply/control
plan/Review Queue attempt, a second fetch, an unclassified row, nondeterministic
replay or incomplete audit trail. A stop emits local redacted failure evidence
only and performs no cleanup mutation.

## Future single-run runbook (do not execute)

| Step | Input → expected output | Allowed / forbidden | Stop evidence and safe retry |
|---|---|---|---|
| 1. Pre-capture validation | owner decisions, clean exact baseline, config hashes → signed go/no-go | local/GitHub metadata and approved state export only; no feed/network/write | stop on any blocker; retain checklist; retry only after new approval |
| 2. State conflict check | approved read-only exporter → sealed state JSON | exact read-only mechanism; no direct SQL/mutation | stop on conflicts/unknowns; hash export; rerun exporter only under scope |
| 3. Single capture | protected reference → raw bytes + redacted metadata | one GET only; no DB/import | stop on source guard; seal partial failure; a new fetch is a new owner-authorized run |
| 4. Network closure | capture receipt → denied network boundary | local file access only | stop if denial cannot be proved; retain capability attestation |
| 5. Legacy replay | sealed bytes + state → legacy report | pure/injected primitives; no validator/register/approval/apply | stop on side-effect/refetch; retry same process inputs only |
| 6. Canonical replay | same hashes → canonical report | canonical v1 harness + test adapter | stop on contract/side-effect error; retry same inputs only |
| 7. Record matching | two reports → exhaustive match report | local deterministic join | stop on dropped/unclassified row; retry same inputs |
| 8. Parity comparison | match report → classified differences | approved compatibility/incident evidence only | stop on canonical/unexplained difference; no waivers in-run |
| 9. Repeat replay | identical inputs → identical fingerprints | new offline processes only | stop on nondeterminism; no refetch/state reread |
| 10. Zero-write verification | counters/capability logs/state hashes → attestation | read-only comparison only | stop if any counter is nonzero or evidence incomplete |
| 11. Artifact sealing | local reports → evidence index | hash/redact/write-once local storage | stop on missing hash/secret scan failure; regenerate only from same inputs |
| 12. Shadow postflight | index + before/after read-only proof → report | owner-approved read-only proof | stop on any state delta; do not repair or clean up |
| 13. Owner report | sealed bundle → decision packet | report only | mandatory stop before cutover; any next action needs a new task/approval |

## Required evidence

The required fingerprints and filenames are enumerated in the manifest. The
bundle must additionally record commit, tool versions, capability-denial tests,
record-count accounting, difference decisions, owner authorization scope/time,
and proof that production business/control state was unchanged. Raw feed bytes
remain protected and are referenced by digest, never committed.

## Unknowns

- current live raw/semantic fingerprint and row counts;
- current plans, sessions, locks, approvals and recovery state;
- owner-approved record-count thresholds and raw-feed retention;
- exact fields/interface of the future read-only control-state export;
- final reviewed implementation and independent verification of snapshot
  injection and the 10 Reps canonical adapter.

## Independent verification — 24 September 2026

Verification started from unchanged `origin/main`
`74b2360a064c16c98fd7fe4291698713cc3e1801` and exact initial PR head
`035e95eb0c4b7744823b2ff59b2efde0dd828cd4` in a separate clean worktree.

- the active workflow/job, `RETAILER_REFRESH_PROFILE=10reps`, protected CSV
  reader, `buildRun()`, optional second fetch, classifier, validator,
  registration, sequential approvals, executor, postflight and watchdog were
  traced to their current entry points. v8/v9/v10 remain onboarding/import
  contracts and have no reference from the active 10 Reps refresh workflow;
- `REQUIRED_COLUMNS` was independently recounted as 17. A local in-memory
  parser check confirmed BOM/comma/UTF-8 parsing, `current_price`,
  `stock_status`, numeric identity, and fail-closed missing-header behavior.
  A representative HTML body was rejected by header drift; the future capture
  still requires the explicit HTML/challenge signature guard in this plan;
- GitHub run `35834479612` was checked through run, job, step, log and artifact
  metadata without downloading the protected artifact. The 10 Reps job and all
  its steps passed on `121fc5ce909c925e7234aef3a249661c8e7d0826`; the overall
  workflow failure came from the Fit House summary step. Its 23 September log
  records 950 approved mappings, 935 executable rows and 15 review rows;
- the ignored inventory was independently counted as 573 files and 55,004,260
  bytes. All 16 files in the eight v8/v9/v10 CSV/dry-run pairs were hashed and
  matched their manifest/approver expectations. They remain historical local
  regression inputs, not a current live baseline;
- repository search found retailer-specific read-only state readers and
  postflight/watchdog projections, but no one approved stable-schema exporter
  covering plans, sessions, locks, approvals, recovery and incomplete work.
  The control-state blocker therefore remains valid;
- `buildRun()` always calls `readSourceSnapshot()` and may call it again for
  aggregate confirmation. Canonical v1 accepts fixtures, not the protected CSV
  plus the same complete target state. No current entry point denies all
  refetch/DB/control/approval/apply capabilities while producing both reports;
  the single-snapshot adapter/orchestrator blocker therefore remains valid;
- capture, exhaustive matching, six difference classes, zero-tolerance parity
  and all required stop conditions were checked against the machine manifest.
  No percentage error budget or owner-invented record-count threshold exists;
- a controlled local mutation from `NOT_AUTHORIZED` to
  `AUTHORIZED_TEST_MUTATION` was rejected with exit code 42. Restoring the
  exact value restored the original blob hash before documentation edits;
- two documentation gaps were corrected: all protected-pair SHA-256 values are
  now complete rather than abbreviated, and the machine-readable blocker list
  now includes record-count thresholds, snapshot retention and owner
  authorization in addition to the two technical blockers.

This verification grants no capture or execution authority. RA-004 remains
`IN_PROGRESS`, all five blockers remain open, and the manifest remains
`NOT_AUTHORIZED`.

## Owner decisions required before any run

1. **One capture:** Approve exactly one protected CSV GET in a named time window
   and protected local retention. Recommended: one attempt, 30 seconds, 10 MB,
   no retry. Alternative: do not run. Risk: source/privacy drift. Safe default:
   no capture.
2. **Control-state read:** Approve one exact existing or separately reviewed
   read-only exporter for plans, sessions, locks, approvals and recovery state.
   Alternative: keep blocked. Risk: incomplete conflict detection or excess
   access. Safe default: no DB access and no run.
3. **Parity:** Approve the field list, six difference classes and zero-tolerance
   safety gates in this document/manifest. Alternative: request amendments.
   Risk: accepting semantic drift. Safe default: all non-exact differences block.
4. **Stops:** Approve every stop condition plus evidence-based record-count
   bounds; do not infer bounds from historical counts alone. Alternative: no
   run. Risk: suspect source or overlapping execution. Safe default: stop.
5. **Single-run scope:** After both blockers are independently closed, approve
   one run for retailer 14, exact commit/config/manifest hashes, exact operator,
   start/end time and local output location. Alternative: remain blocked. Risk:
   scope expansion or accidental production authority. Safe default: expired/
   absent authorization means `NOT_AUTHORIZED`.

No owner decision here authorizes Model B, auto-safe policy, cutover, KIOR work,
legacy removal or a second run.
