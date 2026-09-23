# Retailer Automation Audit

**Audit date:** 23 September 2026

**Status:** RA-000 `READY_FOR_VERIFICATION`

**Documentation branch:** `docs/retailer-automation-ra-000`

**Current reviewed baseline:** `121fc5ce909c925e7234aef3a249661c8e7d0826` (`origin/main` after fetch on 23 September 2026)

**Original local audit baseline:** `1add3449096cbc3f988d0e5f6db8b9baf89f0349`

**Original production-run baseline:** `121fc5ce909c925e7234aef3a249661c8e7d0826`

**Implementation status:** STOPPED BEFORE IMPLEMENTATION

## 1. Scope, method and limitations

This is a documentation-only audit of catalogue onboarding, offer refresh,
review, approval, execution, price history, postflight and monitoring. It does
not authorize a refactor, migration, approval, import, production write or
guardrail change.

The original local worktree was already dirty before this audit:

- modified: `docs/Nutrition-Execution-Plan.md`;
- modified: `docs/SupplementScout-Operating-Plan-2026-07-15.md`;
- modified: `docs/rollouts/nutrition-nut-04a-presentation-2026-09-12.json`;
- untracked: `docs/SupplementScout-Nutrition-Plan.txt`.

Those changes belong to the user and remain byte-for-byte preserved in the
original worktree. For closeout, a separate clean worktree and documentation
branch were created at the fetched `origin/main` SHA. Only the six allowed
documentation paths were reconstructed there. The Operating Plan change is one
programme link applied to the remote version; none of the user's nutrition
diff was copied.

The original checkout was 104 commits behind the production-run code. The
closeout fetch confirmed that `origin/main` is still exactly
`121fc5ce909c925e7234aef3a249661c8e7d0826`; the previously recorded remote SHA
exists and is identical to the current remote SHA. The merge base with the
original local audit baseline is the original local SHA, with ahead/behind
counts `0/104`. The baseline mismatch is therefore resolved for this
documentation branch without updating, switching, stashing or cleaning the
original worktree.

No direct SQL was executed. No database credentials were used by this audit.
Production state is supported only by committed evidence and downloaded GitHub
Actions artifacts. Exact currently active control-plan/session rows were not
exported by those artifacts and remain unverified.

### 1.1 Closeout re-verification against current `origin/main`

The classification below rechecks every material audit conclusion. `git diff`
from the original local baseline to current `origin/main` shows retailer code
changes only in the already-audited eBay/Simply/Fit House repair surface and
their regression tests, plus the committed reliability triage. There is no
change at all between the earlier remote SHA and current `origin/main`.

| Earlier conclusion | Closeout classification | Exact current evidence |
|---|---|---|
| Twelve retailers form the active watchdog inventory. | `CONFIRMED` | `config/automation-reliability-watchdog.json` still enumerates IDs 1, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13 and 14; run `35854459443`, artifact `10746529264`. |
| The repository has shared primitives but multiple production pipelines. | `CONFIRMED` | `scripts/lib/retailer-offer-sync/`, `scripts/lib/retailer-snapshot/`, `scripts/import-products.js`, and dedicated eBay, 6 Pack and GYM HIGH workflows remain present at `121fc5c`. |
| Retailer-specific rules leak into shared core. | `CONFIRMED` | `scripts/import-products.js` still contains Simply, Whey Okay and Predators Gear branches; `scripts/fit-house-offer-refresh.js` still contains Fit House stable-OOS, offer-697 and six-offer policy. |
| Current refresh paths demonstrate per-row isolation. | `CONFIRMED` | 23 September artifacts retain 10 Reps 935/15, Jon's 502/4, Simply 119/1, 6 Pack 495/11 and eBay 159/78 safe/review partitions. |
| One retailer failure does not stop later retailer workflows. | `CONFIRMED` | Runs `35833574845`, `35834479612` and `35847919079` were red while runs `35837546779`, `35843668515`, `35845685589`, `35859020829` and `35863935105` completed. |
| Fit House's six exact OOS transitions are owner-approved and live verified. | `CHANGED_ON_ORIGIN_MAIN` | This was not available at the original local SHA. Commits `8d7b00d` through `121fc5c`, the manifest `config/retailers/fit-house-owner-approved-six-absent-2026-09-22.json`, and the final triage section now prove the bounded closeout. Ten unrelated stock differences remain deferred. |
| The manual eBay dry-run queue-publication defect is fixed and tested. | `CHANGED_ON_ORIGIN_MAIN` | PR #73 / commit `5c2e45c`; `.github/workflows/ebay-offer-refresh.yml`, `scripts/ebay-browse-pilot.test.js` and `scripts/automation-review-reconciliation-dry-run.test.js` changed after the original local SHA. |
| Simply aggregate-price confirmation guards are implemented and tested. | `CHANGED_ON_ORIGIN_MAIN` | Commits `2674a9e` through `19805a9` and `scripts/simply-supplements-offer-refresh.test.js` are present on current `origin/main`; the 23 September 119/1 result remains compatible. |
| Discount, Dolphin and KIOR registration/approval-window omissions were repaired. | `CHANGED_ON_ORIGIN_MAIN` | The production closeout in `docs/rollouts/retailer-reliability-triage-2026-09-22.md` records migrations through ledger 220 and bounded applies; current Discount and KIOR artifacts pass. |
| Fit House summary failure represents a workflow/status defect despite passing technical stages. | `CONFIRMED` | Run `35834479612`, artifacts `10737749736` and `10739107735`; no later `origin/main` change addresses that 23 September summary result. |
| eBay post-apply source drift correctly failed closed, but final evidence/status correlation is fragile. | `CONFIRMED` | Run `35847919079`, artifact `10744242887`, changed from 159/78 to 158/79 on fresh capture and did not seal a successful no-op. |
| Whey Okay's missing mapped-source fingerprint row blocks its whole retailer run and its root cause is unresolved. | `CONFIRMED` | Run `35833574845`, artifact `10738356307`; zero writes and no post-audit code change on `origin/main` resolves the row. |
| Static monitored baselines distinguish debt poorly from execution failure. | `CONFIRMED` | Watchdog `35854459443` reports zero writes/no global failure but remains red for Jon's, eBay and 10 Reps baseline growth. |
| Complete live parent/child plan, approval, session and lock inventory is unavailable without forbidden SQL. | `NOT_VERIFIABLE` | No inspected artifact exports the complete control ledger; this closeout performed no SQL and used no production credentials. |
| IDs 2 and 6 and runtime callability of every historical direct-write script are known. | `NOT_VERIFIABLE` | Neither is established by current config, committed evidence or the inspected artifacts. |
| Predators Gear has current source health beyond the last recorded proof. | `NOT_VERIFIABLE` | The workflow remains manual/read-only and watchdog correlation remains incomplete; no newer source artifact was introduced on `origin/main`. |
| The original dirty checkout must be reconciled before any documentation can be closed. | `NO_LONGER_APPLICABLE` | RA-000 is now isolated on a clean worktree at exact current `origin/main`; the original checkout is intentionally left untouched. This does not authorize implementation. |

## 2. Existing sources of truth checked

The audit reuses, rather than replaces:

- operating control: `docs/SupplementScout-Operating-Plan-2026-07-15.md` and
  `docs/Agent-Operating-Model.md`;
- reliability history and decisions: `docs/Automation-Reliability-Roadmap.md`
  and `docs/Automation-Reliability-Owner-Decisions.md`;
- source/onboarding history: `docs/Retailer-Data-Source-Registry.md` and
  `docs/retailer-onboarding-runbook.md`;
- latest remote incident assessment:
  `docs/rollouts/retailer-reliability-triage-2026-09-22.md` at
  `origin/main`;
- shared offer-sync core: `scripts/lib/retailer-offer-sync/`,
  `scripts/retailer-offer-sync.js` and the `retailer_offer_sync_*` migrations;
- newer generic snapshot design: `scripts/lib/retailer-snapshot/`, phases 1–3,
  the control ledger and staging executor;
- review infrastructure: `scripts/lib/automation-review-publisher.js`,
  `scripts/lib/automation-review-execution-coordinator.js`, the queue worker,
  publication RPC and admin capability matrix;
- atomic catalogue writes: `scripts/import-products.js` and
  `supabase/migrations/20260713180000_atomic_product_import_rpc.sql`;
- postflight/watchdog: `scripts/retailer-offer-refresh-postflight.js`,
  `scripts/automation-reliability-watchdog.js` and
  `config/automation-reliability-watchdog.json`.

The older roadmap remains an incident/evidence ledger. This directory is the
programme-level audit and decision gate for consolidation; it must not be used
as a second runtime configuration.

## 3. Retailer inventory

The current watchdog configuration and 23 September artifact enumerate 12
retailers. IDs 2 and 6 are not present in that active automation inventory; the
audit does not infer their identity.

| ID | Retailer | Current source and connector/parser | Mapping and change path | Workflow / current evidence | Sharedness, exceptions and risk |
|---:|---|---|---|---|---|
| 1 | GYM HIGH | WooCommerce catalogue; `gym-high-catalogue-audit.js`, `gym-high-full-catalogue-feed-builder.js` | Reviewed canonical CSV -> `import-products.js` dry-run artifact -> `gym-high-refresh-artifact.js` -> dedicated executor | `gym-high-source-monitor.yml` twice daily; `gym-high-full-catalogue-apply.yml` daily. Watchdog: 66 offers, `PASS_WITH_MONITORED_BACKLOG` | Separate full-catalogue path. Numerous reviewed legacy/no-SKU/null-option migrations. Missing shared postflight/contract evidence in watchdog. |
| 3 | Whey Okay | EKM Google product feed; `ekm-google-product-feed-reader.js` | Exact immutable manifest; dedicated refresh reusing shared classifier/plans | `whey-okay-offer-refresh.yml` daily. 23 Sep dry-run failed before writes: `mapped Whey Okay source fingerprint is missing a row` | Separate wrapper and EKM parser; reviewed mass-OOS, offer 73 exclusion and three-row rebind exceptions. Source/mapping fault not yet distinguished. |
| 4 | Discount Supplements | Shopify `/products.json`; shared Shopify snapshot reader; separate catalogue adapters also exist | 109-row approved manifest -> shared Fit House engine/profile | `creatine-offer-refresh.yml` daily. Run `35859020829`: 109/109 executed, postflight/idempotency PASS | Shared engine, misleading workflow/script name. Only 109 of 156 offers are automatic; remaining commercial/source/identity cases are separate. |
| 5 | Dolphin Fitness | One HTML product page parsed from JSON-LD by `dolphin-vegan-protein-feed.js` | One exact mapped offer -> shared engine/profile | `dolphin-vegan-protein-offer-refresh.yml` daily; latest watchdog correlates 1 executed and two stale legacy offers | Very narrow exception path. Two generic legacy mappings lack exact external identity. |
| 7 | Simply Supplements | Current config: Shopify; historical Awin/import shipping policy also remains in `import-products.js` | 120-row manifest -> shared Fit House engine/profile; threshold shipping | `simply-supplements-offer-refresh.yml` daily. Run `35845685589`: 119 executed, one review, postflight/idempotency PASS | Shared engine plus retailer-specific shipping, historical identity/bootstrap/apply scripts and aggregate price-confirmation guard. |
| 8 | KIOR Health | Shopify; shared snapshot reader; separate onboarding adapter exists | 11-row manifest -> shared Fit House engine/profile | `kior-offer-refresh.yml` daily. Run `35863935105`: 11/11 PASS with postflight/idempotency | Closest small shared-engine path; prior registration hash repair is retailer-specific. |
| 9 | Fit House | Shopify; shared snapshot reader | 286-row manifest -> shared Fit House engine | Shared workflow daily. Run `35834479612`: dry-run/apply/postflight/idempotency passed but workflow failed in summary | Engine contains Fit-House-only missing-variant, mass-OOS, offer-697, stable-OOS and six-offer policies. Ten deferred stock differences remain. |
| 10 | Jon's Supplements | Shopify JSON; Shopify CSV supplies SKU/GTIN/grams for catalogue work | Dedicated refresh using shared classifier/plans; generic `retailer-snapshot` fixtures/config also target Jon's | `jons-offer-refresh.yml` daily. Run `35843668515`: 502 executed, four review, postflight/idempotency PASS | Parallel implementations: production dedicated refresh versus generic snapshot pilot/harness. Reviewed missing variants, stock-only and price exceptions. |
| 11 | 6 Pack Supplements | Approved WooCommerce product pages; per-page parser | Dedicated refresh builds importer artifacts; dedicated executor and reviewed-batch machinery | `six-pack-offer-refresh.yml` daily. Run `35837546779`: 495 executed, 11 review, postflight/idempotency PASS | Largest retailer-specific surface: many family builders, policies, manifests and archived workflows. |
| 12 | eBay UK | eBay Browse API, OAuth and seller/continuity policy | 237 exact scopes; custom classifier, immutable pending batch, custom apply and Review Queue publication | `ebay-offer-refresh.yml` daily. Run `35847919079`: 159 applied/postflight PASS; fresh no-op changed to 158 executable/79 review and failed closed | Most separate path. Correct source-drift guard, but run/result correlation and final status remain fragile. Historical batch workflows H–S remain in GitHub Actions. |
| 13 | Predators Gear | Approved WooCommerce product pages via shared mapped-page reader | 47-row manifest -> shared Fit House engine/profile, read-only only | Manual `predators-gear-offer-refresh.yml`; watchdog has no active workflow mapping and 47/47 stale | Source-blocked, no scheduled apply; catalogue onboarding uses separate reviewed packages. |
| 14 | 10 Reps | Protected CSV product feed via `csv-product-feed-reader.js` | 950-row manifest -> shared Fit House engine/profile | Second job in shared workflow daily. Run `35834479612`: 935 executed, 15 review, postflight/idempotency PASS | Shared engine; very large accumulation of reviewed onboarding manifests/builders. Current watchdog baseline still expects zero review rows. |

Identity reconciliation across these paths is not uniform. Existing-offer
refreshes normally bind an immutable approved mapping manifest and match source
external product/variant IDs. Catalogue onboarding additionally uses canonical
product/variant evidence, external URL/SKU/GTIN and guarded family/size/flavour/
pack reconciliation in `import-products.js`. eBay uses fixed offer scopes and
its own continuity tiers. The generic snapshot design has a canonical snapshot,
classification and row-plan contract, but is not the single production entry
point for the inventory above.

### 3.1 Validator, plan, executor and test evidence by retailer

| Retailer | Validator / plan and approval | Executor / price history | Postflight, watchdog and representative tests | Control-plan/session evidence |
|---|---|---|---|---|
| GYM HIGH | `import-products.js` preflight artifact; `approve_product_import_plan` in `gym-high-full-catalogue-executor.js` | `apply_approved_product_import_plan`; atomic import owns offer/history transaction | Full-catalogue postcondition in workflow; watchdog profile; `gym-high-full-catalogue-executor.test.js`, `gym-high-catalogue-audit.test.js` | Current exact active rows unexported. Watchdog evidence is `INCOMPLETE_CORE`. |
| Whey Okay | `validate_retailer_offer_sync_batch_read_only`; `register_whey_okay_offer_sync_control_plan`; `approve_retailer_offer_sync_batch` | `execute_retailer_offer_sync_batch` | Shared postflight/watchdog; `whey-okay-offer-refresh.test.js`, registration and remediation tests | 23 Sep stopped before registration/approval. Older conflicting-session incidents are in `automation-reliability-remaining-scope-2026-08-31.json`. |
| Discount Supplements | Shared read-only validator; `register_discount_supplements_offer_sync_control_plan`; shared batch approval | Shared mixed-batch executor and atomic price-history behavior | Shared postflight/watchdog; adapter, stage-1 and refresh tests | 23 Sep created/consumed three child approvals and passed idempotency; exact residual active plans unexported. |
| Dolphin Fitness | Shared validator; `register_dolphin_vegan_protein_offer_sync_control_plan`; shared approval | Shared mixed-batch executor | Shared postflight/watchdog; `dolphin-vegan-protein-feed.test.js`, offer-refresh and registration tests | Latest correlated run completed; two legacy identities remain outside scope. |
| Simply Supplements | Shared validator; `register_simply_supplements_offer_sync_control_plan`; sequential parent + child approval | Shared mixed-batch executor | Shared postflight/watchdog; `simply-supplements-offer-refresh.test.js` and identity/commercial rehearsal tests | 23 Sep created/consumed three child approvals; one review row remains isolated. |
| KIOR Health | Shared validator; `register_kior_offer_sync_control_plan`; shared approval | Shared mixed-batch executor | Shared postflight/watchdog; `kior-offer-refresh.test.js` | 23 Sep created/consumed one approval and completed; no current review rows. |
| Fit House | Shared validator; `register_fit_house_offer_sync_control_plan`; shared approval with exact reviewed policies | Shared mixed-batch executor | Shared postflight/watchdog; `fit-house-offer-refresh.test.js`, stable-OOS and registration tests | 23 Sep execution scope was zero and no approval was created; earlier failed parent was exactly superseded by migration `20260922170000_allow_fit_house_parent_approval_and_supersede_failed_plan.sql`. |
| Jon's Supplements | Shared validator; `register_jons_offer_sync_control_plan` or reviewed mixed-change registration; shared approval | Shared mixed-batch executor | Shared postflight/watchdog; `jons-offer-refresh.test.js`, interruption/recovery and registration tests | 23 Sep created/consumed 11 child approvals; four review rows exceed the one-row monitored baseline. |
| 6 Pack Supplements | `validate_product_import_plan_read_only`; `approve_product_import_plan` in dedicated executor | `apply_approved_product_import_plan` | Shared DB postflight plus dedicated reviewed postflight; 31 named six-pack tests including executor and workflow retirement | 23 Sep completed 495-row execution; 11 known review rows. Full current ledger export absent. |
| eBay UK | Custom dry-run/pending batch plus atomic-plan validation; artifact-bound manual path and Review Queue approval path | Custom orchestration ultimately applies guarded atomic plans; review worker is separately scoped | Shared postflight with eBay sealer/watchdog; `ebay-browse-pilot.test.js`, reconciliation and admin execution tests | 23 Sep apply/postflight completed, but fresh drift prevented idempotency seal; active queue rows are visible, complete control ledger is not. |
| Predators Gear | Shared read-only validator/registration function exists in config, but active workflow is read-only proof | No scheduled production executor authorized | No watchdog-correlated workflow; `predators-gear-offer-refresh.test.js`, artifact approver test | Source-blocked/owner-deferred; current active plans unverified and no apply evidence. |
| 10 Reps | Shared validator; `register_10reps_offer_sync_control_plan`; sequential parent + child approval | Shared mixed-batch executor | Shared postflight/watchdog; bootstrap approver/artifact and interrupted-cleanup tests | 23 Sep created/consumed 19 child approvals; 15 reviews exceed the zero baseline. |

All shared mixed-batch function names above are defined by
`20260718160000_add_retailer_offer_mixed_batch_executor.sql` and production
enablement migration `20260719100000_add_production_retailer_sync_enablement.sql`.
Atomic product-import function names are defined by
`20260713180000_atomic_product_import_rpc.sql`. This evidence shows reuse of
write primitives, but not a single end-to-end pipeline.

## 4. Actual flow map

| Stage | Current mechanism | Duplication or bypass |
|---|---|---|
| Source | Shopify JSON, EKM feed, protected CSV, WooCommerce pages, eBay API, exact HTML/JSON-LD | At least six connector families; this is legitimate retailer-edge variation. Source health and retry logic are duplicated. |
| Connector/raw snapshot | Shared Shopify/WooCommerce/CSV readers plus retailer-specific readers and audits | No universal immutable raw-snapshot envelope. Some raw evidence is only in Actions artifacts or external storage. |
| Parser/normalization | Shared projections plus dedicated eBay, EKM, 6 Pack and GYM HIGH builders | Canonical money/stock/identity shapes are similar but not one frozen contract. |
| Identity reconciliation | Approved manifests + `retailer_products`; importer variant guards; eBay fixed scopes | Catalogue and refresh identity paths differ. Retailer exceptions exist inside `import-products.js` and the shared Fit House engine. |
| Diff/classification | `lib/retailer-offer-sync/classifier.js`; eBay and 6 Pack wrappers; newer `retailer-snapshot/classifier.js` | Two explicit shared classifiers plus retailer-specific classification layers. |
| Validation | DB read-only `retailer_offer_sync` validators; importer preflight; dedicated executor validators | Common safety ideas, not one validator surface. Batch aggregate guards can reject an otherwise valid mixed batch unless the wrapper isolates rows. |
| Approval/control | Parent/child control ledger and batch approvals; atomic import approval ledger; reviewed artifact approvals; Review Queue approvals | Multiple approval contracts are intentional history but operationally parallel. Scheduled shared refreshes prepare bounded sequential parent approval; the generic snapshot flow is not the only path. |
| Execution/write | Atomic import RPC, mixed-batch executor, verified-no-change/confirmed-price functions and dedicated wrappers | No single executor. Historical forward migrations also write exact reviewed rows. The fallback onboarding importer is explicitly non-transactional when run directly without its guarded artifact route. |
| Price history | Atomic import/mixed-batch functions and price-observation foundation | Shared table, multiple writers. Daily confirmation history is intentionally distinct from real price changes after September fixes. |
| Postflight | Shared `retailer-offer-refresh-postflight.js`, dedicated 6 Pack/GYM HIGH/eBay verification | GYM HIGH has no watchdog-recognized DB postflight step; evidence shapes differ. |
| Watchdog | One shared watchdog over 12 configured retailers | Good common read-only monitor, but static monitored baselines can turn expected new review rows into global red runs and can tolerate large stale scopes. |

The production offer-sync path generally follows:

`source -> snapshot/reader -> source projection -> approved manifest lookup -> shared or dedicated classifier -> quarantine/review partition -> child artifacts -> read-only DB validator -> parent/child registration -> bounded approval -> atomic child execution -> offers + price_history -> DB postflight -> fresh idempotency capture -> watchdog`.

Catalogue onboarding paths add canonical product/variant planning before the
offer step. The generic retailer-snapshot design models that complete flow, but
today's scheduled retailer automation does not consistently enter through it.

## 5. Mechanisms to preserve

- immutable SHA-256 manifests, source/action/policy/plan fingerprints and exact
  artifact sidecars;
- expected-before-state and stale-state checks in atomic RPCs;
- separate production validator, approver and executor roles;
- parent/child control ledger, transition rules, advisory locks, checkpoints,
  replay blocking and explicit recovery decisions;
- bounded approvals and expiries, immutable reviewed scopes and owner identity;
- per-row quarantine already demonstrated by current runs;
- transaction-bound offer and price-history mutation in guarded executor RPCs;
- baseline/postflight comparison, fresh-source idempotency and zero-write
  watchdog evidence;
- Automation Review Queue publication/reconciliation and execution-request
  ledger;
- stable reason codes and redacted diagnostics;
- source-collapse, price/stock ratio and identity-drift guardrails.

## 6. Duplication and retailer-specific leakage

Confirmed duplication:

1. `retailer-offer-sync` and `retailer-snapshot` both define classification,
   status, fingerprint, planning and execution concepts; the latter is a strong
   harness/design but is not the universal production pipeline.
2. `import-products.js`, mixed-batch offer sync, reviewed catalogue packages,
   GYM HIGH, 6 Pack and eBay expose multiple approval/apply orchestration paths.
3. Source health, retry, diagnostics and immutable evidence are implemented in
   the shared Fit House engine, Jon's, Whey Okay, eBay, GYM HIGH and 6 Pack.
4. Postflight evidence contracts differ by shared engine, eBay, 6 Pack and GYM
   HIGH.
5. Review publication is shared for Automation Review Queue, but several
   retailer-specific reviewed manifests and executors remain outside it.

Confirmed retailer-specific code in shared core:

- `scripts/import-products.js` contains Simply shipping inference, Whey reviewed
  format corrections, exact eBay parent exceptions and exact Predators Gear
  parent exceptions;
- `scripts/fit-house-offer-refresh.js` is the shared engine but contains
  Fit-House-only missing-source, stable-OOS, offer-697 and six-offer logic;
- shared migration functions contain allowlists or branches for exact retailer
  IDs and dedicated sequential approvals;
- `creatine-offer-refresh.js` is actually the Discount Supplements wrapper,
  obscuring ownership and observability.

These are refactor candidates, not authorization to remove them. Every exception
must first gain a named policy/config record, regression fixture and removal
condition.

## 7. Isolation and outcome semantics

Per-row isolation exists in current offer refreshes. On 23 September:

- 10 Reps executed 935 safe rows while isolating 15 review rows;
- Jon's executed 502 while isolating four;
- Simply executed 119 while isolating one;
- 6 Pack executed 495 while isolating 11;
- eBay executed 159 while isolating 78;
- Discount and KIOR executed their complete approved scopes.

One retailer's failure also did not block later scheduled retailers: Whey Okay,
Fit House-summary and eBay were red while Simply, Jon's, 6 Pack, Discount and
KIOR completed independently. The shared GitHub concurrency group serializes
production writes but does not create a platform-wide failure domain.

The remaining defect is status semantics. A row can have a durable outcome
(`executed`, `review`) while the enclosing GitHub run is red for summary,
idempotency drift or watchdog baseline growth. That is sometimes a correct
guardrail and sometimes an orchestration/status bug; the run model does not
make the distinction consistently visible.

## 8. Recent incident classification

| Incident/evidence | Classification | Finding |
|---|---|---|
| 23 Sep Fit House shared run `35834479612` | **Code/workflow status bug** | Dry-run, apply, DB postflight and idempotency all passed with zero execution rows; only `Publish workflow summary` failed. A normal `PASS_WITH_REVIEW`/deferred outcome became a red workflow. |
| 23 Sep eBay run `35847919079` | **Correct guardrail**, plus **status/evidence gap** | 159 safe rows applied and postflight passed. Fresh capture moved one row from executable to review (158/79), so no-op verification failed closed. Missing final sealed hashes made watchdog correlation fail. |
| 23 Sep Whey Okay run `35833574845` | **Data/mapping or retailer-source problem; unresolved** | `mapped Whey Okay source fingerprint is missing a row`; zero writes/approvals. Artifact does not prove whether manifest drift, parser omission or source loss is primary. |
| 23 Sep watchdog `35854459443` | **Mostly correct monitoring**, with **taxonomy pressure** | Zero writes and no global failures. Jon's (4 vs 1 review), 10 Reps (15 vs 0) and eBay (78/77 stale) exceeded immutable monitored baselines. This should remain visible, but not be described as a platform execution failure. |
| Price changes previously stopping a batch | **Correct aggregate guardrail when unapproved; design limitation when safe rows are coupled** | Current classifier supports quarantine and confirmed-price proofs, and September history added isolated confirmed price validation. Normal price change is review/business state, not automatically a system failure. |
| Batch price-change ratio drift | **Correct guardrail** | `buildGuardEvidence` and DB validators enforce soft/hard aggregate limits. Exact owner-confirmed price waves exist, so widening the global threshold is not justified. |
| Mapped product absent from source | **Correct guardrail by default** | Fit House, Jon's, 10 Reps and Discount evidence shows source absence isolated for review; exact owner-approved absence manifests may authorize bounded OOS. Absence alone is not OOS proof. |
| Variant conflict | **Correct identity guardrail** | Importer variant guards, eBay identity review and dedicated rebind paths prevent silent remapping. Historical fixes show accumulated exceptions and regression tests. |
| Active equivalent control plan / interrupted session | **Correct concurrency guardrail; orchestration bug exposed** | September migrations safely superseded exact expired/empty/partial plans and unified the production-write concurrency group. The guard was right; expiry windows, role identity and recovery orchestration were wrong. |
| Scheduled `PASS_WITH_REVIEW` ending red | **Confirmed status bug in some paths** | Fit House summary failure is current proof. Watchdog red on baseline growth is instead an intentional monitoring signal. These must have different run statuses/reason codes. |
| Scheduled run creating approval contract | **Not fully verified** | Shared scheduled refreshes register plans and create/consume bounded batch approvals after DB validation. This conflicts with the owner's target rule if “approval contract” means owner authorization; current code treats it as machine execution authorization. Taxonomy/authority decision required before refactor. |
| One bad row blocking valid records | **Historically true; materially improved** | Current artifacts prove row isolation for six retailers. Whey Okay still fails during whole-scope fingerprint construction, before partitioning, so one missing source row can block that retailer's entire run. |
| Manual eBay dry-run publishing queue rows, 22 Sep | **Workflow bug, regression test added** | The remote triage records 183 control writes from a dry-run. PR #73 narrowed the job condition; tests now assert dry-run exclusion and required artifact hashes. No catalogue write occurred. |

## 9. Test and observability gaps

- No single end-to-end contract matrix runs every retailer fixture through one
  canonical source-to-outcome interface.
- `retailer-snapshot` tests do not prove production adoption by all retailers.
- Today's Fit House summary failure is not prevented by an end-to-end workflow
  outcome test.
- Whey Okay lacks a fixture for “approved mapping missing from mapped source
  fingerprint” with a required isolated review outcome.
- eBay has extensive tests, but same-run source drift still prevents a durable
  successful-with-review closeout after a successful apply/postflight.
- Watchdog tests are embedded under other names; there is no simple fixture set
  covering each retailer's latest artifact and expected run taxonomy.
- Current Actions artifacts do not export a complete read-only snapshot of
  active parent/child plans, approvals, runs and locks, so cross-session state
  cannot be fully audited without direct SQL (forbidden in this task).
- The static monitored backlog permits very large stale scopes (for example
  Whey Okay and Fit House) and conflates “within accepted debt” with fresh.
- GYM HIGH and Predators Gear remain `INCOMPLETE_CORE` in watchdog correlation.
- Historical exact migrations and manifests have many targeted tests, but there
  is no enforced exception registry containing owner, reason, date, test and
  removal condition for every exception.

## 10. Confirmed facts and evidence

1. The active watchdog inventory has 12 retailers —
   `config/automation-reliability-watchdog.json` and artifact
   `10746529264` from run `35854459443`.
2. Current per-row isolation is operational — artifacts from runs
   `35834479612`, `35843668515`, `35845685589`, `35837546779` and
   `35847919079`.
3. Current shared-engine complete-scope success exists for Discount and KIOR —
   artifacts `10748876392` and `10752050475`.
4. The common control ledger has immutable parent/child/apply transitions,
   fingerprints, advisory locks and replay guards — migration
   `20260717120000_create_retailer_catalogue_control_ledger.sql`.
5. Atomic import performs expected-state checks and price-history writes in one
   RPC transaction — migration `20260713180000_atomic_product_import_rpc.sql`.
6. The latest watchdog made zero DB writes and reported no global failures —
   artifact `10746529264`.
7. The remote production-run commit passed its main Quality Gate and Project
   Guardian on 22 September — runs `35755773324` and `35755773389`.
8. Fit House's six exact OOS changes were separately owner-approved and live
   verified before today's run — remote triage and commits `8d7b00d` through
   `121fc5c`.
9. The local pre-edit Project Guardian passed — local command
   `npm run verify:project` on 23 September.

Artifact names, IDs, digests and compact outcomes are indexed in
`docs/retailer-automation/evidence/README.md`.

## 11. Unverified or blocked facts

- Exact current active/conflicting production control plans and sessions after
  the 23 September runs: **BLOCKED**, because no complete control-ledger artifact
  was emitted and direct SQL is prohibited.
- Root cause of the Whey Okay missing fingerprint row: **UNRESOLVED**.
- Whether IDs 2 and 6 represent historical retailers: **UNVERIFIED**.
- Whether every historical direct-write script is still operationally callable:
  **UNVERIFIED**; repository presence alone is not runtime enablement.
- Current source health for Predators Gear beyond the last read-only proof:
  **BLOCKED/source-limited**.
- Semantic definition of “scheduled run must not create an approval contract”
  versus current machine child approvals: **OWNER DECISION REQUIRED**.
- The original local/production SHA mismatch no longer blocks documentation
  closeout: this branch starts at current `origin/main`. Any future
  implementation must independently refresh and re-verify its own clean
  baseline; RA-000 grants no implementation authority.

## 12. Recommendations — no implementation

1. Approve one status taxonomy separating record outcome, retailer outcome,
   orchestration outcome and monitoring debt before moving code.
2. Select one existing core as the convergence target only after a shadow
   harness compares `retailer-offer-sync` and `retailer-snapshot` outcomes. Do
   not build a third core.
3. Move retailer conditions out of shared files into typed connector/policy
   configuration with explicit exception metadata and fixtures.
4. Retain the current DB roles, ledgers, fingerprints, stale guards, atomic RPC,
   postflight and idempotency contracts unchanged during consolidation.
5. Define scheduled machine execution authorization separately from owner
   commercial/identity approval; scheduled jobs must never mint owner intent.
6. Make `SAFE`, `REVIEW`, `BLOCKED_SOURCE` and `FAILED_SYSTEM` durable per-row
   outcomes, then derive retailer/run status without turning review into system
   failure.
7. Pilot 10 Reps in shadow mode because it already uses the shared engine, has a
   large fixed manifest and currently demonstrates 935 safe + 15 review rows.
   Shadow mode must make zero writes.
8. Do not sequence the remaining retailer migrations until shadow evidence
   measures connector complexity, exception count, review rate and parity.

No refactor was started.
