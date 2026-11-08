# Retailer Automation Consolidation Execution Plan

**Status: SIX PACK SOURCE-BOUNDARY REPAIR IMPLEMENTED FOR REVIEW; NO NEW LIVE RUN OR WRITE**

**Current active task:** the owner's 8 November `SIX PACK SOURCE RELIABILITY
AND GENERIC UNBUYABLE SIMPLE PRODUCT SUPPORT` authorization: one coherent
minimal PR from main `dd94e81d744c5ab2bbd78b94f85531b9b39ca2bb`, using preserved
source evidence and the existing RA-001 runtime. Implementation and isolated
quality/integration tests are authorized. Merge, live catalogue dry-run, apply,
migrations, mapping changes and schedule changes are not authorized. The last
actual source run `42510124005` remains BLOCKED; the verified zero-write
production readback below is historical evidence, not a new refresh. RA-001 and
the existing guarded paths remain controlling; RA-004 is not resumed. No
RESTORED or live source verification is claimed.

The immediate objective is to restore a trustworthy baseline for the existing
production retailer paths before any consolidation work resumes. This is not a
new runtime, importer, approval path or executor. It reuses the current
workflows, artifacts, control ledger, Review Queue, postflight and watchdog.
Work proceeds read-only until a specific recovery or business write has fresh
bounded evidence and separate owner approval.

## 8 November 2026 source reliability and unavailable-simple review repair

**Status:** implementation ready for review after the evidence gates below; one PR only, no merge authority.
Branch: `fix/six-pack-source-reliability-simple`; approved base above.

The preserved complete HTTP 200 capture of 2819 is 215716 bytes, SHA256
`154f803db06443b37cf468e23996891c35b0728bfab4385051750c7434f3e44c`.
It is a simple product with an explicit unavailable-online notice and no
Product/Offer JSON-LD. The previous parser's qualified unavailable template
required variable; ordinary parsing therefore correctly stopped at missing
Product JSON-LD. No new shop request is needed or made for this repair. The
reduced fixture retains the real simple price metatags as consistency evidence.

Component ownership stays in the existing path:

- `parseSixPackProductPage` / `unbuyableParentName` reuse one complete-document
  identity check for a single known simple/variable type. Existing variable
  qualification remains unchanged. Simple may corroborate exactly two GBP
  display-price metatags; neither they nor parent stock become offer proposals.
- `approvedSourceFailureDisposition` requires typed bounded-reader provenance,
  HTTP 200, complete bounded HTML/hash/bytes, fresh timestamp, exact HTTPS
  origin/request/final/canonical/product binding, reproduced parser evidence,
  immutable manifest, exactly one parent=variant mapping, exact current
  mapping/offer/product/variant/retailer/URL bindings and no shared canonical
  dependency. Exact brand/name words and all commercial quantity tokens must
  match. The result is only existing product isolation and
  SOURCE_VARIANT_MISSING/manual identity review, with new typed reason
  `UNBUYABLE_SIMPLE_OFFER_UNRESOLVED`; no price, stock or freshness proposal.
- Existing `commercialIdentity` / `commercialIdentityTokens` normalize 90 Caps,
  Vege Caps and Vegetarian Capsules to the same count while retaining capsule
  qualifiers. Unspecified versus vegetarian still requires identity review.
  Different counts, units, servings, doses and sizes remain conflicts; no
  mapping/title is changed and no fuzzy identity authority is added.
- The single existing source loop can continue after a first-attempt, typed,
  complete HTTP 200 schema error only with intact document/product identity
  and exact approved name/quantity anchors. Such errors remain FATAL. Any
  fatal prevents normalization, classifier, executable plans and sealing.
  Transient, unknown, 429/5xx, timeout and integrity failures stop further
  products. Prior deterministic fatal evidence still yields exit 2, preserving
  existing reader/Bash no-retry behavior. There is no new scanner or retry.
- Existing `writeSourceFailureReport` and workflow upload retain stage,
  manifest/capture binding, exact IDs/reasons/mappings, metadata and disjoint
  PARSED/ISOLATED/FATAL/NOT_REACHED partitions for all 279 products / 506
  mappings. Never-reached products remain explicit. Fatal raw HTML has one
  2,000,000-byte report budget; overflow retains hash/bytes/provenance only.
  Incomplete source has no complete fingerprint/sealed artifact or published
  classifier review rows. Earlier qualified isolation evidence is retained.

Offline full-scope regressions retain existing 499+7 and 496+10 cases and add
495 executable + 11 unchanged review (Warrior 7, unavailable variable 3,
simple 1). These are synthetic complete-source test outcomes, not actual source
results or refreshes. Existing profile, classifier, validator, sealed artifacts,
postflight and idempotency are exercised; review price/stock/freshness changes
are rejected. Full 506-mapping approved scope is unchanged. One classifier,
one isolatedSourceFailures, one approval system and one executor remain.

Local verification: focused 173 PASS / zero FAIL / zero SKIP; quick PASS
(469 tests); full PASS (3668 PASS / zero FAIL / three pre-existing SKIP),
including TypeScript, lint, Guardian, baseline migration validation and build.
Guardian passed before/after this checkpoint. The original complete 2819 HTML
reproduces the new typed review reason offline; no shop GET was performed.
Exact-head GitHub CI/Guardian and actual isolated PostgreSQL integration must
pass before handoff; their run IDs and results are retained in the PR evidence,
never inferred from a skipped job.
The test inventory remains 355 files with its existing seal; no test is added,
removed, renamed or silently excluded. Production credentials are not used by
quality jobs. No source workflow, approval, publication or production write is
invoked in this task.

**Later merge effect:** the unchanged daily `03:17 UTC` workflow already has
an apply path. Merging this repair can let that path progress past qualified
unavailable simple products and execute other already permitted offers if all
existing guards pass; isolated rows stay review-only. This task authorizes no
merge or additional write. No scheduler, lock, approval, fingerprint, shared
executor, source limit, mapping or migration is changed.

## 8 November 2026 PR #507 merge and one complete read-only Six Pack attempt

Exact approved head `8cf93cc2b185aca3b22cb0a45a7d285ca05630bd`, unchanged base/main
`6c99cd7fd1aa13ddcd6e557ff4fb27ddf6f4efc9`, seven approved files and all normal
checks were freshly verified. Full CI `42508019775` passed 3,644 / zero FAIL /
three previous SKIP; Guardian `42508019777` passed; actual isolated PostgreSQL
job `128814858306` in `42508046053`, attempt 1, passed 149 / zero SKIP.
Repository rules are empty and main is not protected; no checks were bypassed.
There were no active workflow runs before the merge.

Standard exact-head squash merge completed `2026-11-08T18:22:22Z` as main
`dd94e81d744c5ab2bbd78b94f85531b9b39ca2bb`, without bypass, auto-merge or force.
Approved and merged tree are identical:
`a21053b9acba0226fae0023f7733ac77e6ff6ca8`. Main Guardian `42509683613` passed;
full CI `42509683620`, actual job `128819810940`, passed 3,644 / zero FAIL /
three previous SKIP before dispatch. The automatic unrelated
GYM HIGH source monitor triggered by push is read-only and was not manually run.

Manual `operation=dry-run` on this unchanged workflow skips executor, approval,
control registration, business/history writes, post-apply source replay and
production Review Queue publication. Existing schedule is daily `03:17 UTC`
and has an apply path; it remains unchanged and is not selected/simulated by
this manual invocation. Existing concurrency is `six-pack-offer-refresh`,
cancel-in-progress false. Fresh collision check at `18:27:07.602Z` found no
active run and no newer successful source refresh before the permitted dispatch.

Independent verified-TLS REPEATABLE READ READ ONLY baseline at
`2026-11-08T18:24:10.418Z`: 506 full offer rows, 506 mapping rows, history
539 / latest ID 10247, Review Queue 709, approved import plans 49,115, zero
parent/child/apply/batch-approval rows and no active writer. Canonical CURRENT
and all 261 live ledger identifiers agree at fingerprint
`755319fa4f9636e50cf8606e7a0b143945aa8bdd92c2183681e5285aecb4660a`.
The first GitHub metadata read exceeded a local output buffer; it performed no
merge/source action and was repeated with bounded larger metadata capacity.
Production baseline succeeded on its first read attempt without timeout or
runtime changes. Local evidence: `tmp/507-main-dryrun-20261108/premerge.json`,
`merge-receipt.json`, `before.json` and `current-binding.json`.

One create-only receipt records dispatch at `18:27:44.984Z`, source run
`42510124005`, attempt 1, `workflow_dispatch`, input only `operation=dry-run`,
exact main SHA above. Actual job `128821170741` failed with exit 2; executor,
approval/control binding, postflight/idempotency and Review Queue publication
were skipped. No second dispatch, Actions rerun or catalogue replay was sent.

Workflow `18:27:46Z` to `18:30:01Z`: **2m15s**. Source step `18:28:43Z` to
`18:29:56Z`: **73s**, including state read, HTTP and inline parsing. CapturedAt
`18:28:44.935Z` to fatal log `18:29:56.853Z`: 71.918s. This is **one incomplete
traversal, zero full catalogue traversals**. The 2m15s versus earlier 20m14s is
not an equivalent-coverage benchmark. Normalization and the new post-capture
aggregation were not reached, so their live repair verification is not claimed.

The only retained fatal conflict is `SOURCE_SCHEMA_MISMATCH` at parent/variation
**2819**, mapping **2241**, offer **2055**, canonical product/variant **123/138**.
Original cause: `Expected one matching Product JSON-LD block, found 0`.
`last_attempt=1`, network code null, timeout false; one fatal log and exit 2
prove no whole-source retry. Total earlier transport attempts are not retained.

Exact approved manifest remains 506 mappings / 279 parents. The fatal parent is
21st in immutable manifest order. Report retains **19 parsed pages**; the source
loop therefore had **one earlier qualified product isolation** among the first
20 parents, but this read-phase failure writer did not retain its ID/reason.
Accounting is **19 parsed + 1 prior isolation + 1 fatal + 258 unreached = 279**.
The first 20 parents cover **83 mappings**, the fatal parent one, and unreached
parents 422: **83 + 1 + 422 = 506**. The split of those 83 into parsed/isolation
rows and the parsed source-variant count are unknown. No IDs, OOS or full-source
success are invented to fill the retention gap. The complete 506-row binding
account is retained in `mapping-accounting.csv` with this uncertainty explicit.

One bounded later GET of only 2819, existing reader / maximumAttempts 1, at
`18:33:36.727Z` reproduced the same parser error and preserved complete HTTP 200
HTML, 215716 bytes, SHA256
`154f803db06443b37cf468e23996891c35b0728bfab4385051750c7434f3e44c`.
This is later diagnosis, not original workflow HTML or another catalogue run.
It has exact postid/canonical, `product-type-simple`, ItemPage/BreadcrumbList,
`Not available to buy online`, no Product/Offer JSON-LD and no variant payload.
Existing unavailable-parent qualification explicitly requires `variable`, so
the unsupported simple template correctly remains retailer BLOCK. Displayed
price/stock was not turned into an offer proposal. Expected name:
`7Nutrition ZMB + GMC 90 Caps`; observed later title:
`Zmb + Gmc 90 Vege Caps 7Nutrition`. Direct offline token comparison also finds
that `90 Vege Caps` is unrecognized (expected `90capsule`, observed empty); this
is a follow-on diagnostic finding, not another executed workflow conflict or
proof of a changed quantity/formulation. The historical approval-builder's
last-count/Number helper is not blindly imported as an identity contract.

No classifier or validator was reached. **Executable plans 0, review rows 0,
blocked rows 506, action counts empty**, no source fingerprint or sealed apply
artifact. This is whole-retailer hold for incomplete source, not 506 proven bad
offers. 3980 is within the prefix but none of its eight identity normalizations
was reached; its precise parsed/isolation status is not retained. Warrior 2769
and Angel 28570 are beyond the prefix, so live 7+3 isolation was not exercised.
All ten DB offers/mappings remain unchanged and have no new commercial proposal.

Artifact `13628363824` contains only `production-preflight-report.json`.
Downloaded ZIP SHA256 matches the GitHub provider digest:
`36a9e81ae43756cec3b610a68ef2f2864a08ffa0bcfcf077cb878b94616e581a`.
That verifies the diagnostic report, not a sealed apply artifact. Retained:
job log, run/jobs/artifact metadata, before/after snapshots and the explicitly
later one-page diagnosis. Not retained from the run: original HTML, per-page
hashes, variant counts or prior isolation ID/disposition. Full post-capture
reporting cannot be evaluated from this interrupted source read.

Independent verified-TLS READ ONLY after-capture at `18:32:29.478Z` matches all
columns of **506 offers + 506 mappings** and every control hash. Shared business
SHA256 `561cd5d9fe96e79ae71031e82e6e85b1e390d6d187a591d835191d6fb0c06d87`.
History remains 539 / latest ID 10247; Review Queue 709; approved import plans
49,115; parent/child/apply/batch approvals zero. Ledger 261 / CURRENT unchanged,
no active writer, no new control plan and no independent change in this retailer
scope. Together with skipped mutation steps this verifies **business writes 0,
control writes 0, approvals 0, price_history writes 0**. Postflight/idempotency
workflow skips are not called PASS; the independent no-mutation readback passed.

No apply package is ready. One general next-change assessment belongs at the
existing source boundary: strict review-only qualification of complete
unbuyable simple templates when immutable identity/provenance guards permit,
plus retaining partial-capture/isolation metadata through the existing failure
report. Unknown identity, including quantity/modifier ambiguity, stays BLOCK;
no display-price inference, broad name match or product-ID exception is proposed.
The 90 Vege Caps count-recognition gap must be assessed in the same existing
identity contract before any further catalogue attempt. No proposal is coded
or a new PR created under this authorization. Full local analysis, every known
conflict and evidence limits: `tmp/507-main-dryrun-20261108/analysis-report.md`,
`analysis.json`, `postrun-verification.json`, `artifact-verification.json` and
`mapping-accounting.csv`.

This release checkpoint is local outside the merged tree. No code, workflow or
new PR is created in this task. RA-001, existing guarded paths and all schedules
remain unchanged. No offer refresh or RESTORED status is claimed.

## 8 November 2026 Six Pack identity normalization and post-capture reliability

Owner instruction: `SIX PACK IDENTITY NORMALIZATION AND POST-CAPTURE RELIABILITY`.
Base/main was freshly read back as
`6c99cd7fd1aa13ddcd6e557ff4fb27ddf6f4efc9`; latest source run is still terminal
`42503046561`, attempt 1. Its production after-capture at `17:27:06.814Z`, ledger
261 / CURRENT and full unchanged offer/mapping/control hashes remain the latest
retained production readback. This implementation replays retained evidence
offline, with no new production/source request. Branch:
`fix/six-pack-identity-postcapture-reliability`.

The existing `commercialIdentityTokens` / `liveIdentityDrift` owner now reuses
`feed-variant-guards.parseSize` and exact decimal normalization for kg/g packaging.
No dose conversion, float tolerance or fuzzy name match is introduced. Newly
admitted equivalence must preserve the rest of the normalized name. Multipacks
retain count and per-unit mass; explicit box/pack counts, real size/count/dose
differences, unknown units and missing live measure evidence remain guarded.
All eight 3980 immutable bindings are regression-tested through sealed artifact
creation and existing executor scope validation.

Explicit post-capture identity/coverage checks create existing typed
`WooCommerceSourceError` instances; only trusted types/codes reach the unchanged
CLI exit-2 contract. Generic `Error.code`, unknown, transport and HTTP 429/5xx
exceptions are not promoted. `SOURCE_COLLAPSE` is a generic typed permanent
contract reason; the common reader gains no retailer conditions. The real Bash
loop from the unchanged workflow is executed offline against the same CLI main:
one 279-page fixture traversal for deterministic post-capture identity failure,
versus bounded five attempts for an untrusted same-code exception.

The existing `writeSourceFailureReport` / `--report` preserves every proven
conflict found in the same in-memory capture, exact stage/code/approved IDs,
manifest SHA, timestamp, parsed page/variant counts, existing HTML hashes/byte
lengths and already-qualified source-failure evidence. It explicitly denies
complete source-snapshot status and emits zero executable/review plans on this
retailer-wide BLOCK. Classifier and sealed apply artifact creation are not
reached. Unknown normalization errors retain safe context without arbitrary
exception messages; an unknown-only failure remains retryable. They cannot hide
independent proved conflicts later in the captured data, and are not themselves
promoted when another row proves a permanent BLOCK. No raw-HTML store is added.

The complete offline name audit joins all 506 mappings to historical evidence,
including the retained 576-record native snapshot and existing sealed CSV
feeds. It identifies eight safe current-retained equivalence pairs, four
box-versus-single commercial-unit conflicts and 105 historical pairs needing
further evidence. These partition evidence pairs, not mappings: 3980 appears
both as a reordered historical title and a later fully corroborated title.
All candidate groups and the physical-unit-versus-full-identity distinction are
recorded in [the identity evidence audit](SIX-PACK-IDENTITY-EVIDENCE-2026-11-08.md).
No current source state is guessed from historical names.

Local validation: final focused 136 PASS / zero SKIP; quick 1,020 PASS / three
existing SKIP; full 3,644 PASS / zero FAIL / three existing SKIP, including
TypeScript, ESLint, baseline validation, production build and Guardian. The
final-head PR CI and isolated PostgreSQL results/run IDs are recorded separately
in the review PR description for this branch; skipped ordinary-CI integration
is never counted as PostgreSQL evidence. Inventory reseal was reviewed:
355 existing test files, SHA256
`7c2d270f8b1bc713d3921bf108f34611a4d4c941bd53e461d18824fe2c6037c4`,
unchanged because cases were added only to existing files. All fixture/manifest
seals remain unchanged. Final-head CI/PostgreSQL evidence is required before
review-ready handoff. Existing Warrior seven / Angel three review-only
semantics, 506 = 496 + 10 partition, fingerprints, approvals, executor scope,
postflight and idempotency are exercised without production writes. No workflow,
approved mapping, migration or shared executor changes are included.

## 8 November 2026 PR #506 merge and one complete read-only Six Pack attempt

Exact approved head `53c3a06c0f557d0599f91e89543a99d179d7b799`, unchanged main/base
`3253699f605ac8b25adc4bc668d66e355f20f8d9`, five approved files, clean worktree and
ordinary checks were reverified. PR full `42500480416` passed 3636 / zero FAIL /
three existing SKIP; actual PostgreSQL integration `42500486867`, attempt 1,
passed 149 / zero SKIP. Normal full CI's skipped integration was not counted.

Standard exact-head squash merge completed at `2026-11-08T16:56:57Z`, without
bypass, force push or removing other changes. Merge/main:
`6c99cd7fd1aa13ddcd6e557ff4fb27ddf6f4efc9`. Approved and merged tree are identical:
`b06c90c7fb82833c75d645c529d94290d3ee6ffd`. Main full `42502458843`, actual job
`128797953227`, passed 3636 / zero FAIL / three existing SKIP. Main Guardian
`42502458804` passed before dispatch.

Manual dry-run code/workflow inspection on this merged tree confirms only
state/source reads and local artifacts: no executor, approval, control
registration, business/history mutation or production Review Queue publication.
No reviewed selector or special apply mode was selected. Natural schedules and
source limits remain unchanged. Separate parsing/classification timings and
total unapproved source-variant counts are not instrumented by the existing
workflow; absent measurements will not be invented.

The first strictly READ ONLY baseline attempt hit the existing 120-second query
read timeout, with no source dispatch or writes. A second READ ONLY capture,
without changing any limits, succeeded at `2026-11-08T17:02:17.943Z`; the full
49,115-row approval transfer took 74.818 seconds. It preserves all 506 offer and
mapping rows, all ten Warrior/Angel offers, history 539 / latest ID 10247, 709
Review Queue rows, empty parent/child/apply/batch-approval tables and full-row
hashes, with no active writer. This was an audit-read retry, not a source run.
At `17:03:16.008Z` a separate READ ONLY CURRENT check confirmed all 261 ledger
identifiers and fingerprint
`755319fa4f9636e50cf8606e7a0b143945aa8bdd92c2183681e5285aecb4660a`,
production identity and no active approver/executor. GitHub collision assessment
also found no potentially conflicting active workflow.

One create-only dispatch receipt records run `42503046561`, attempt 1,
`workflow_dispatch`, exact main SHA above, input only `operation=dry-run`,
created `2026-11-08T17:03:54Z`. Actual job `128799723223` failed; reviewed apply,
executor, DB baseline/postflight/idempotency and Review Queue publication were
skipped. Terminal workflow time is `17:24:08Z`: **20m14s** overall; the fresh
source step ran `17:04:35Z` to `17:24:03Z`, **19m28s**, including state reads,
inline parsing, normalization and internal retry/backoff. Separate pure capture,
parsing and classification timings are not available. No second dispatch,
Actions rerun or alternate full-catalogue invocation was performed.

### Actual blocker and the internal retry gap

The first failure was logged at `17:08:55.6176776Z`:
`SOURCE_IDENTITY_DRIFT: Live commercial identity drift for 3989`.
External parent **3980**, approved variation IDs **3989, 3992, 3995, 5962, 5963,
3988, 3994, 3991**. Mapping 2213 / canonical variant 940 is the first rejected
binding. The failure occurs in `liveSourceFor`, after the complete source-read
loop, before classifier, local plan validation, artifact creation or SQL
validation. The same failure recurs at `17:12:18.0210234Z`, `17:16:30.7090341Z`,
`17:20:27.8046340Z` and `17:24:03.9798748Z`.

Thus **one dispatch contained five internal full 279-product traversals**.
This follows from the merged control flow and the five post-loop failures;
**1,395 product-reader invocations** are inferred, not an HTTP-attempt counter.
The exact count of HTTP 200 parsed pages, transport attempts/redirects and total
source variants is not retained. Each loop completed with parsed products or
existing qualified isolation, but their actual counts and dispositions cannot
be reconstructed from the uploaded evidence. They must not be invented.

A separate bounded single-page diagnosis at `17:26:31.004Z`, using the existing
reader/parser with one attempt, preserved complete HTTP 200 HTML and provenance
for parent 3980. This is later evidence, not the original workflow's HTML. The
live title is `7Nutrition Whey Isolate 90 1000g`; the immutable approved mapping
name is `7Nutrition Whey Isolate 90 1kg`. `liveIdentityDrift` compares literal
tokens `1kg` and `1000g` and reproduces the failure for all eight approved
bindings. All eight IDs are present among nine later live variants; the ninth
is unapproved and remains outside scope. Diagnostic HTML SHA256:
`c1c128c4ce35c2fe7449705ddc0dcb279a962c844e01cd46524a1a9324e37aba`.
This is a generic unit-equivalence false positive, not evidence of a different
commercial size or authority to alter mappings. Existing
`feed-variant-guards.parseSize` normalizes both tokens to mass / 1000 / g.

The reader's typed permanent errors stop retry correctly, but this post-capture
identity failure is a plain `Error`. CLI `isPermanentSourceError` accepts only
`WooCommerceSourceError`, so this failure exits 1 and triggers all five existing
wrapper attempts. Therefore permanent-error retry stopping is **not verified
end to end**. Runtime and retry settings were not changed in this task.

Smallest general next-change assessment: reuse existing exact physical-unit
normalization in the existing identity token comparison, retaining independent
dose/count/multipack constraints and real mismatch rejection. Also route
permanent post-capture source failures through the existing stop/report
contract, rather than retrying the whole catalogue or adding another snapshot
system. This is a proposal only: no code, ID exception, new isolation rule or PR
was created under this release authorization.

### Classification, artifacts and production invariance

Approved manifest remains SHA256
`62f88fabc33e339d1106e597091217eabbbfaa4c5015b5625fb5257eacf0e7ff`,
**506 mappings / 279 product IDs**. **Zero executable plans and zero review rows
were produced**. Classifier, local plan validator and SQL validator were not
reached/run; the whole 506-row scope is held unclassified, rather than 506
individually invalid offers. No source fingerprint, preflight report or sealed
artifact was written. GitHub artifact count is zero; upload succeeded only as a
step with a warning that no JSON files existed. Executor scope acceptance
cannot be tested without an artifact. No apply decision package is ready.

Retained evidence: complete job log and its five error timestamps, run/jobs/
artifact metadata, strictly read-only production snapshots, plus the explicitly
later single-page diagnostic HTML/provenance. Lost/unwritten evidence: original
catalogue HTML/parsed rows, isolated failure documents/dispositions, capture
timestamps, total variants/reader attempts, source fingerprint and sealed
artifact. Failure occurred before report/artifact writers, so the fixture's
496/10 partition and live ten-row isolation cannot be claimed.

Independent verified-TLS READ ONLY after-capture at `17:27:06.814Z` matches
every column of all **506 offers and 506 mappings**, including prices, stock,
URLs and freshness. Shared business-row SHA256:
`561cd5d9fe96e79ae71031e82e6e85b1e390d6d187a591d835191d6fb0c06d87`.
All **7 Warrior + 3 Angel** offers and mapping bindings are unchanged; no new
commercial/freshness proposal was produced. All control row counts/hashes match:
parents/children/apply runs/batch approvals zero; Review Queue 709; approved
import plans 49,115. History remains **539 / latest ID 10247**. Ledger remains
261 with the same CURRENT fingerprint, no active parent or write-role session.
Together with skipped mutation jobs, this verifies **business writes 0,
control writes 0, approvals 0, price_history writes 0**. No new production block
was created. Final GitHub readback confirms unchanged merge/main/tree and no
active Six Pack workflow. Natural schedules and other retailers remain untouched.

Local evidence: `tmp/506-main-dryrun-20261108/merge-receipt.json`,
`pr-premerge.json`, `main-ci-summary.json`, `before.json`, `current-binding.json`,
`dispatch-state.json`, `dispatch-response.txt`, `source-watch.log`,
`source-job.log`, `run.json`, `jobs.json`, `artifacts.json`, `after.json`,
`postrun-verification.json`, `diagnostic-3980.html`, `diagnostic-3980.json`,
`analysis.json` and `final-readback.json`.
This ledger update is local outside the merged #506 tree; no new code or PR is
created in this release task.

## 8 November 2026 generic unbuyable-parent isolation (code complete)

Base/main `3253699f605ac8b25adc4bc668d66e355f20f8d9`, merged #505 and terminal
run `42496198266` / attempt 1 were reverified before code work. Latest production
evidence is the preceding zero-write readback at `15:47:49.877Z`, ledger 261 /
CURRENT fingerprint unchanged. This task performs no new production/source
request: evidence is replayed offline. Branch:
`fix/six-pack-unbuyable-parent-isolation`.

### Class and retained safety boundary

The preserved full 213,605-byte HTTP 200 capture, SHA-256
`d88b55cfa2f9eabb07872b847413fcfe4f412265e4b4af95f1a15ddbda6a1829`,
and reduced fixture both qualify as a complete current-theme variable-parent
page with exact canonical/body/container identity, heading and ItemPage /
BreadcrumbList identity, a scoped unavailable-online notice and no variant
commerce payload or Product/Offer schema. Parent price/stock display and Twitter
metadata must agree internally; neither becomes a child commercial fact.
Unknown/changed structure, malformed or alternative data, purchase controls,
conflicting commercial evidence and incomplete documents remain retailer BLOCK.
The existing approved state must additionally match the parent heading exactly
through every child's external_name and canonical URL, with every immutable
offer/mapping/product/variant binding closed over the current manifest. The
manifest supplies review scope only, never current child price or availability.

One new typed reason, `UNBUYABLE_PARENT_VARIANTS_UNRESOLVED`, passes through the
existing approvedSourceFailureDisposition / isolatedSourceFailures mechanism.
Common transport/document integrity and cause-chain checks are reused; #504's
wildcard-specific qualification remains unchanged. Exact source timestamp,
HTTP 200 completeness, approved request/final origin, SHA/byte count and offline
reproduction are required. Current manifest content, approved children and
parent identity are rechecked. No product ID exception or alternate runtime is
introduced. Shared reader, classifier, executor, approval and schedules are
unchanged. The existing Review Queue profile preserves the distinct reason on
manual source-missing cards with no proposed price/stock/freshness.

### Offline proof and corpus limits

Focused contracts pass **219/219**, including negative source/provenance/name/
manifest cases, generic qualification of a different existing parent, retained
2769/6582/4705/6303 behavior, normal 404, transport and retry contracts. The
original 499+7 scenario remains independently tested. The new hypothetical
complete fixture scenario proves **506 = 496 potential plans + 10 review rows**:
seven Warrior and three Angel Dust, no omissions/overlap or executable reviewed
offer, no proposed commercial facts, unchanged fixture state, valid sealed
artifact/executor scope, review-preserving postflight and idempotency, and
distinct correct Review Queue cards. It is not live source coverage.

The local corpus search found one preserved full unavailable-parent page, 28570;
no second real parent of that shape was found. Existing raw source corpus is six
captures for five products, with 274 of 279 approved products lacking replayable
HTML. The prior 51 pages outside the report's 228 usable-page count are not
declared erroneous. No new crawl or full source run was performed.

### Evidence retention is an existing limitation, not a new snapshot system

Qualified isolated evidence already retains raw HTML, SHA, bytes, request/final
URL, HTTP status, current capture timestamp and manifest child binding in the
existing report's source_failures; compact review rows omit duplicated HTML.
The new class uses that same artifact path. However, the current global
writeSourceFailureReport keeps only sanitized fatal diagnostics: unknown fatal
HTML and earlier partial captures/isolations are lost if a later source fails.
Existing *.json artifact upload therefore cannot make those absent bytes
available offline. **Separate architecture/retention decision required:** how
to retain bounded failed-page and partial evidence in the existing artifacts.
No snapshot system or additional evidence writer is implemented here.

Local focused/quick/inventory and full-HTML replay evidence is under
`tmp/unbuyable-parent-isolation/`. Final local quick passes **1020 PASS / zero
FAIL / three existing SKIP**; final local full passes **3636 PASS / zero FAIL /
three existing SKIP**, including lint, TypeScript, baseline validation,
production build and Guardian. PR CI and actual isolated PostgreSQL integration
on the exact PR head are recorded in its checks/description; a skipped job is
not integration evidence. Existing test filenames and the sealed 355-file inventory are unchanged
(295 safe / 56 isolated integration / four artifact-bound); new cases use the
existing test file. No production commercial/control/history writes, source
dispatch, migration, merge or other retailer operation occurred.

## 8 November 2026 PR #505 merge and one complete read-only Six Pack attempt

Exact approved head `531b1093b12d6ac6652ec96a866fc9308184dd46`, unchanged base
`e150183feef05f4071d55eac1a428ac541a83473`, ordinary PR checks and actual isolated
PostgreSQL integration were reverified. PR full CI `42491679217` passed 3596 /
zero FAIL / three existing SKIP. Integration `42491684489`, attempt 2, passed
149 / zero SKIP; attempt 1's unchanged local PostgreSQL startup failure remains
documented in PR #505. A skipped integration job was not used as evidence.

Standard squash merge, matched to exact approved head, completed at
`2026-11-08T15:36:59Z` without bypass or force push. Merge/main:
`3253699f605ac8b25adc4bc668d66e355f20f8d9`. Approved and merged tree are identical:
`a53dc6316a850d374649aef5477aa60cc59a2f54`. Main full CI `42495714669`, actual job
`128777497199`, passed 3596 / zero FAIL / three existing SKIP; main Guardian
`42495714672` passed before dispatch.

The existing ordinary manual dry-run path was inspected on that merged tree:
source/state reads and local artifact/report generation only. Executor,
approver/validator role sessions, business/history writes, control registration,
Review Queue bind/publication and special reviewed apply are skipped. The source
CLI and four source-only workflow loops retain #505's permanent-error stop;
transient retry limits and schedules are unchanged. The workflow has no separate
phase timing instrumentation: actual job/source timestamps will be reported,
and absent parsing/classification/validation timings will not be estimated.

READ ONLY baseline at `2026-11-08T15:38:55.304Z` preserves all 506 offers and
mappings, all columns of the seven Warrior rows, history count 539 / latest ID
10247, 709 scoped Review Queue rows and 49,115 approved_import_plans rows with
full-row hashes. Scoped parent/child/apply-run/batch-approval tables are empty,
with no active write-role session. A second READ ONLY check at 15:41:47.320Z
asserted production identity and the exact 261 canonical ledger identifiers:
CURRENT/live fingerprint
`755319fa4f9636e50cf8606e7a0b143945aa8bdd92c2183681e5285aecb4660a`.
No active potentially colliding workflow was present before dispatch.

Exactly one create-only local dispatch receipt records run `42496198266`,
attempt 1, `workflow_dispatch`, ref main, exact merge SHA above, input only
`operation=dry-run`, created `2026-11-08T15:42:52Z`, terminal failure at
`2026-11-08T15:46:26Z`. Actual refresh job `128778974371` failed at Fresh
live-source dry-run. No reviewed selector, owner confirmation, apply mode,
additional dispatch or replay was submitted. Executor, DB baseline/postflight,
fresh idempotency and Review Queue bind steps were skipped; special reviewed
apply and publication job `128779864664` were skipped too. Those skipped paths
are not reported as successful execution.

### Actual result and scope

**BLOCK / SOURCE_READ_FAILED / SOURCE_SCHEMA_MISMATCH**, first fatal product
**28570**, Skull Labs Angel Dust PUMP Pre-Workout. Exact final parser message:
`Expected one matching Product JSON-LD block, found 0`. The report records
**228 successfully parsed usable product pages**, **506 approved mappings**,
**zero executable plans**, **zero executed plans**, **zero produced review rows**
and **506 blocked rows**. Source scope remains 279 products. Canonical manifest
ordering puts 28570 at position 235: six earlier product-scoped isolations are
inferred from 234 processed predecessors minus 228 usable pages, and 44 later
products were not visited. Their identities/reasons were not retained in this
failure report and are not invented. A raw total of parsed source variations
was not retained; full source/variant identity coverage is not established.
Classification, local plan validation and database validator were not reached.
No source snapshot fingerprint or sealed apply artifact was produced. The
previous 6582 fatal error did not recur, but no 499/7 live success is claimed.

Artifact `13623616512` contains only the 907-byte failure report. Downloaded ZIP
SHA-256 matches its provider digest:
`0824153b3c4692eef813559f135de826d6fe2d0e724fb4d8af275b550ac645ba`.
Report SHA-256:
`cb5b158eb5d2a2f2aec7ef8cbebec93707da2f3c2b55a2ceedd05d570a7ffb56`.
Failure-report integrity is verified; absent executable artifacts are not
treated as valid sealed plans. No future apply scope can be approved from this
incomplete source attempt.

### Measured duration and retry behavior

Workflow create-to-terminal time: **214 seconds (3m34s)**. Actual refresh job:
**210 seconds (3m30s)**. Fresh source step: **148 seconds (2m28s)**. Recorded
source_captured_at `15:43:56.633Z` to fatal log timestamp
`15:46:23.8258493Z` is **147.192 seconds**, combining source reads and parsing.
Separate parsing duration is not instrumented. Classification/plan validation
were not run; no invented phase durations or parsing benchmark is supplied.
The original source log contains exactly one fatal schema line, last_attempt=1,
timeout=false, network_code=null and exactly one workflow exit 2. There was
one whole-source pass: #505's permanent-error stop worked in both the reader
and the workflow. Existing transient retry limits were not modified.

### Zero-write independent readback

READ ONLY after-capture at `2026-11-08T15:47:49.877Z` matches every column of all
506 offer and mapping rows. Shared before/after business hash:
`561cd5d9fe96e79ae71031e82e6e85b1e390d6d187a591d835191d6fb0c06d87`.
All seven Warrior mappings/offers, including prices, stock and last_checked_at,
are identical. No proposed Warrior facts or executable plans were produced;
their commercial review requirement remains unresolved. This failure produced
zero new review rows, not seven published cards. History remains 539 rows /
latest ID 10247. Full-row control hashes match: zero scoped parent/child/apply/
batch-approval rows, all 709 Review Queue rows and all 49,115 approved plans.
After CURRENT fingerprint remains
`755319fa4f9636e50cf8606e7a0b143945aa8bdd92c2183681e5285aecb4660a` / 261 entries.
No active parent or write-role session exists in the after-snapshot. Combined
with the inspected read-only code and skipped mutation paths, this verifies
**business writes=0, control writes=0, approvals=0, price_history writes=0**.
There is no new database plan or lock from this attempt; source data is the
blocker.

### One real cause and smallest general next step (no patch/PR)

The original workflow retained no raw HTML. One later successful single-page
diagnostic through the existing reader at `/?p=28570`, maximumAttempts=1,
captured complete HTTP 200 at `2026-11-08T15:48:46.945Z`, 213,605 bytes, SHA-256
`d88b55cfa2f9eabb07872b847413fcfe4f412265e4b4af95f1a15ddbda6a1829`.
Canonical URL, body product ID 28570 and heading agree with the approved parent.
The same parser error reproduces offline. The page explicitly says `Out of
stock` and `Not available to buy online`; it has no buy box, theme variation
payload, legacy variation form, Product/ProductGroup JSON-LD or any of the
three approved variant IDs **29091 / 29094 / 29097** (mappings 2613/2614/2615).
Only Organization/Store/WebSite/ItemPage/BreadcrumbList JSON-LD exists. This is
missing variant-level commercial evidence on an unavailable-parent page,
not an omitted dropdown option. The parent stock label cannot safely establish
price or stock for those three variants.

The first local diagnostic stopped at certificate trust before receiving HTML;
using the workflow's existing system-CA option completed the bounded page
read, without disabling TLS checks. Both diagnostic outcomes are preserved.
Neither was another workflow dispatch or full catalogue run; their durations
are excluded from actual workflow timing.

Preferred source repair is restoring exact public variant-level data upstream.
If review-only continuation is separately authorized, the smallest adapter
scope is a generic strict qualifier inside existing
approvedSourceFailureDisposition/product isolation for this unavailable-page
shape: complete approved-origin HTTP 200, exact parent ID/canonical/heading,
explicit scoped unavailability marker, absent purchasable controls and absent
or noncontradictory commercial data, bound to the exact current manifest.
Route every mapping of that qualified parent through existing
SOURCE_VARIANT_MISSING review with proposed_offer=null and no freshness change.
Retain collapse/aggregate checks and retailer-wide BLOCK for all other unknown
schema/identity errors. Do not infer per-variant OOS or prices from the parent,
add a product-ID exception or create a new executor/importer. This proposal
needs owner-approved policy and regression review before implementation;
no code, new PR, migration, apply or additional retailer run was made here.
No RESTORED status or production apply proposal is ready.

Local evidence: `tmp/505-main-dryrun-20261108/merge-receipt.json`,
`main-ci-summary.json`, `before.json`, `current-binding.json`,
`dispatch-state.json`, `dispatch-response.txt`, `source-watch.log`, `run.json`,
`jobs.json`, `source-job.log`, `artifact-integrity.json`, `after.json`,
`postrun-verification.json`, `timing-and-retry.json`, `28570-source.html`,
`28570-capture.json`, `28570-structure.json` and `28570-analysis.json`.
This closeout update is local to the worktree, outside the merged #505 tree;
no additional PR or code change is created.

## 8 November 2026 generic omitted-variation contract repair (code complete)

Base/main `e150183feef05f4071d55eac1a428ac541a83473` and merged PR #504 were
reverified on GitHub before work. Branch: `fix/six-pack-generic-variation-contract`.
The preserved full 6582 HTML reproduces the exact previous schema error before
the change; no source request was made for this task. The existing parser's
selected-default-only fallback was the general defect: complete nondefault
variants can also be absent from the theme's dropdown. Same-page JSON-LD is
source consistency evidence, not an independent external identity authority.

The existing corroborateVariant now requires both a valid unique selection and
a complete unique explicit variant combination, then exact ProductGroup and
Product membership/ID/SKU, parent binding, same-origin canonical/variant/offer
URLs, exact URL attributes, GBP price and matching availability. A second
Product with the same variation SKU but a conflicting ID is rejected too. No
product ID exception, new parser, new source path or identity inference exists.
Wildcard qualification/isolation from #504 and all approved bindings are intact.

Offline corpus audit found five unique full captures covering four products:
6303 (complete declared variants), 4705 (selected 4708 omitted), 6582 (complete
nondefault omissions), and two captures of 2769 (wildcard Any size). Six unique
reduced fixture versions were compared too. Main/new parser replay agrees on
6303/4705 and 2769; only 6582 changes from schema BLOCK to five exact parsed
rows. All 2769 captures still require WILDCARD_COMMERCIAL_UNIT_UNRESOLVED.
Historical native CSV snapshot contains 576 normalized records (July); it and
saved plans/reports do not establish current HTML shape. The local JSON audit
inspected 1,435 candidate files / 749 unique contents without finding another
embedded theme HTML capture. Of the 279 approved products, only four have
preserved page identity coverage in this audit: 275 lack replayable page HTML.
The prior 222 parsed pages are workflow evidence, not 222 replayable fixtures;
the 57 remaining pages in that failed attempt are not assumed defective.
An additional content search across all local worktrees/tmp/fixtures found 27
variation-document paths and no new pre-existing capture after SHA deduplication.
Eighteen saved archives (101 entries) and one text job log named .zip were
inspected too; none contains another theme HTML document.

Run 42485457991 logged five whole-source attempts, each reporting last_attempt=5
for the same final permanent schema failure: 25 bounded read attempts for the
failed product, with four whole-source workflow retries. Intermediate reader
failure codes were not individually logged, so this is not proof of 25 identical
schema failures. Offline replay of the old reader with preserved full HTML
reproduces five schema-failing reads and four sleeps for that deterministic
document; the new permanent-failure regression stops after one read/no sleep.
The existing bounded reader now stops recognized typed schema, identity,
duplicate, redirect, content-type, size and configuration failures immediately,
preserving the original cause/code and actual attempt count. HTTP/transport
retry limits, delays and source policy remain unchanged. Only the Six Pack
source CLI maps those permanent errors to exit 2; all four existing source-only
workflow loops stop that exit instead of restarting the source pass. Executor,
approval, writes, unknown write outcomes and schedules gain no retry path.

Regression fixture 6582 is reduced from the full capture, preserving the exact
heading/buy-box/payload and ProductGroup; full/reduced parser rows match. Tests
cover all five rows, arbitrary renamed IDs, omitted-variant identity/JSON-LD/
URL/price/stock negatives, selected-default compatibility, wildcard isolation,
actual Bash loop outcomes and reader terminal/transient behavior. The complete
offline scope test also combines captured 6582 rows with Warrior isolation,
classifier, sealed artifact and executor scope checks: 506 = 499 plans + seven
review rows, database_writes=0 and unchanged fixture state. This is test evidence,
not live source coverage or an offer refresh. Focused contracts pass **179/179**.
Local quick gate passes **1020 PASS / zero FAIL / three existing SKIP**; local
full passes **3596 PASS / zero FAIL / three existing SKIP**, including Guardian,
TypeScript, ESLint, baseline migration validation and production build. A
targeted lint rerun covers the final test additions; diff whitespace checks
pass. PR CI and isolated PostgreSQL integration evidence belong to the PR head
and are attached to its checks/description; the skipped integration job in
ordinary PR CI is not counted as real integration. Existing test filenames are
unchanged; the sealed 355-file
inventory hash is unchanged and verified (295 safe / 56 integration / four
artifact-bound). No test file was added, removed or renamed.

Local audit evidence: `tmp/generic-variation-repair/html-corpus-comparison.json`,
`json-corpus-index.json`, fixture/full comparison and focused/quick logs;
archival inventory is in the original workspace `tmp/six-pack-archive-audit.json`.
No Fit House, Jon's or Whey operation, production credentials, production write,
merge or new retailer workflow dispatch was used by this repair.
Next release boundary: owner review and a separately authorized merge, followed
only with owner authorization by exactly one new complete ordinary read-only
Six Pack dry-run on then-current main. Recheck 506 mappings / 279 products,
source fingerprint/classification/validator/sealed artifact and all seven
Warrior review rows from that fresh run. No apply scope or RESTORED status is
claimed from this offline repair.

## 8 November 2026 PR #504 merge and one complete read-only Six Pack attempt

The owner approved exact head `3c407e7d853db0fc97dcd0dadfafa68e9f0706de`,
standard squash merge and one `six-pack-offer-refresh.yml` dispatch on main
with only `operation=dry-run`. PR preflight found that exact head, unchanged
base `e5fcaed6722cd6e36c1389c52da934ce7607b932`, clean/mergeable state and all
ordinary checks passing. Full CI `42481865110` had 3564 PASS / three existing
SKIP; the separate actual PostgreSQL integration job `42481860243` had 149 PASS /
zero SKIP. The skipped integration job in ordinary full CI is not evidence.

Standard squash merge completed at `2026-11-08T13:28:06Z`, without admin bypass,
force push or reopening a PR. Merge/main SHA:
`e150183feef05f4071d55eac1a428ac541a83473`. Approved and merged tree SHA are
identical: `79f725bfcd52c3f9cf6fa3b681d496526f85c646`. Main push full CI
`42485098977` (actual full job `128745146108`: 3564 PASS / zero FAIL / three
existing SKIP) and Guardian `42485098909` both passed before dispatch. Final
GitHub API readback still has that exact main SHA.

Workflow/code inspection confirms ordinary manual dry-run only reads production
state and source, builds local plans/reports and uploads evidence. It skips DB
baseline/postflight steps belonging to apply, Review Queue bind/publication,
executor, approvals and special reviewed apply. Source code performs SELECTs;
artifact contract binding is local metadata, not a remote seal/write. The
existing source-step shell loop permits up to five internal read attempts on
failure; it was not changed. This authorization results in one workflow dispatch,
not a manual retry or replay. No apply-mode input or special selector was passed.

The `2026-11-08T13:31:43.784Z` verified-TLS REPEATABLE READ READ ONLY snapshot
preserves all 506 offers/mappings, full row hashes, all seven Warrior rows and
history count 539 / latest history ID 10247. Ledger 261 / production identity
were asserted. Scoped parent/child/apply-run/batch-approval tables have zero
rows; Review Queue has 709 scoped rows, hashed. No active write-role session was
found. A supplementary READ ONLY audit at 13:37:36.544Z while the source job
was still running records 49,115 existing `approved_import_plans` rows, a full
row hash and **zero** approvals created since dispatch. This supplementary
capture is not mislabeled as a pre-dispatch snapshot.

Exactly one dispatch was submitted and recorded locally with create-only
semantics: run `42485457991`, attempt 1, `workflow_dispatch`, main SHA
`e150183feef05f4071d55eac1a428ac541a83473`, created
`2026-11-08T13:32:37Z`, completed with failure at `2026-11-08T14:03:40Z`.
Actual source job `128746215837` failed in Fresh live-source dry-run. All five
built-in shell read attempts reached product `6582` and failed with
`SOURCE_SCHEMA_MISMATCH / Undeclared 6 Pack option is not a unique explicit
selection`; the first logged failure was `2026-11-08T13:43:40.8248471Z`.
The final reader error has last_attempt=5, timeout=false and no network code.
These were existing internal read retries, not another dispatch or workflow
replay. GitHub readback confirms run_attempt=1 and no later manual run.

The final report is **BLOCK / SOURCE_READ_FAILED**. Scope remains **506 approved
mappings / 279 expected products**, with **222 successfully parsed product
pages in the final attempt**, **zero executable plans**, **zero executed plans**,
**zero produced review rows** and **506 blocked rows**. This does not establish
full source coverage or a total live variation count. Classification and the
database validator were not reached; no source snapshot fingerprint or sealed
apply artifact exists. Zero review rows is not a successful 499/7 result:
source parsing stopped before classification. No safe confirmation, price/stock
delta or future apply scope can be asserted from this incomplete attempt.

Artifact `13620660080` contains only the 905-byte preflight report. Downloaded
ZIP SHA-256 matches the provider digest exactly:
`8850aa38d5e5b9738f2ad7e3b0a46f6bb4bcb9ed620361cd26df17a85b83f2bf`.
Report SHA-256:
`e6f2051f194e88f40a12ed4db0c40dcec90f0ef2cf28465cc4c667747e43ca70`.
Integrity of that failure report is verified; no sealed executable artifact
was produced. Apply baseline, Review Queue bind, executor, DB postflight and
fresh idempotency steps were skipped, as were special reviewed apply and the
Review Queue publication job. They are not reported as passed.

Independent READ ONLY after-snapshot at `2026-11-08T14:06:52.173Z` matches every
column of all 506 offer rows and 506 mapping rows. Before/after business hash:
`561cd5d9fe96e79ae71031e82e6e85b1e390d6d187a591d835191d6fb0c06d87`.
All seven Warrior mappings/offers, including price, stock and last_checked_at,
are unchanged; no proposed commercial values or executable plans were produced
for them. Their existing commercial review requirement remains unresolved;
no new Review Queue rows were published. History remains 539 rows / latest ID
10247. Scoped parent/child/apply-run/batch-approval tables remain empty; all 709
Review Queue rows have the same full-row hash. All 49,115 approved_import_plans
rows retain the supplementary snapshot hash
`afdce10c65f6b672ef737843acb36f72d4c194a43ebaf054d6ba0623ca1ed0d0`.
Together with zero approvals since dispatch at the supplementary capture and
the inspected read-only path/skipped mutation jobs, this verifies business
writes=0, price history writes=0, approvals=0 and control writes=0. Ledger
remains 261, with no active parent or write-role session in the after-snapshot.
There is no new database plan/block from this attempt; the source blocker
prevents the next refresh.

### First blocker diagnosis and precise next step (not implemented)

One bounded single-product diagnostic GET, using the existing page reader at
`/?p=6582` with maxAttempts=1, captured HTTP 200 at
`2026-11-08T14:06:16.297Z`. This was not another full dry-run. Canonical source:
`https://6pack-supplements.co.uk/product/cream-of-rice-2kg-nxt/`.
Complete HTML is 333,593 bytes, SHA-256
`db27f0a3e07e72f2c8dbb667bd44b28cad5012eec79e1852ffc8573b6be698bb`.
The current merged parser reproduces the same schema error offline.

The payload has five complete, nonempty, unique flavour combinations:
6583 chocolate coconut, 6584 apple pie, 6585 cinnamon cereal, 6586 gingerbread,
6587 strawberry cheesecake. Dropdown options contain only apple pie and
strawberry cheesecake; selected default is chocolate coconut. All five have
exact same-page ProductGroup/Product JSON-LD corroboration for variant ID/SKU,
parent membership, flavour URL parameters, GBP 15.99 and matching stock
(6583/6584 in stock, others out of stock). JSON-LD names and heading identify
Cream of rice 2kg - NXT. The selected-only fallback admits 6583; the first
unsupported complete unselected row is 6585, followed by 6586. This is a
dropdown omission compatibility gap, distinct from Warrior's wildcard
commercial-unit ambiguity. The diagnostic corroborates this captured page;
it does not prove later unvisited products are error-free.

Smallest proposed code scope: extend the existing corroborateVariant fallback
to complete, unique attribute combinations omitted from dropdowns even when
they are not the selected default, while retaining exact same-page parent,
variant/SKU, URL, currency, price and stock corroboration. Preserve duplicate,
missing, contradictory and wildcard guards; no product-6582 exception or new
isolation category. Use this captured fixture for regression of all five rows,
with negative cases for ambiguous combinations, wrong parent/SKU/URL, missing
JSON-LD, currency/price/stock disagreement and incomplete attributes; retain
existing selected-default and Warrior isolation regressions. This task only
prepares the evidence and proposal: no code change or new PR was made. A
bounded implementation/review and any fresh full source dispatch require new
owner authorization; no apply proposal is ready.

Local evidence: `tmp/504-main-dryrun-20261108/before.json`,
`dispatch-state.json`, `dispatch-response.txt`, `approval-schema.json` and
`approval-baseline.json`, `after.json`, `postrun-verification.json`,
`source-errors.json`, `artifact-integrity.json`, the downloaded failure report,
`6582-source.html`, `6582-diagnostic.json` and `6582-analysis.json`.
No Fit House/Jon's/Whey operation was performed. This closeout ledger update
is local; it is not part of the already-merged PR #504 tree.

## 8 November 2026 owner-confirmed Warrior identity and bounded product isolation (merged assessment)

### Exact owner decision; identity only

Owner authority: the 8 November instruction titled `6 PACK WARRIOR CRUNCH.
OWNER-APPROVED PRODUCT IDENTITY AND SAFE WILDCARD SUPPORT`, source text SHA-256
`b1ecf61cab3ae532a832854a54c94e6e23116277e096a23b3d8a14f02a9d9895`.
All existing identifiers and mappings below remain unchanged. Every canonical
variant represents one box of **12 x 64g = 768g**; existing per-bar size and
pack_count semantics are preserved, without changing product net_weight_g.

| External product / variation | Flavour | Offer / mapping | Canonical product / variant |
|---|---|---|---|
| 2769 / 3290 | Milk Chocolate Coconut | 2306 / 2492 | 1074 / 2286 |
| 2769 / 3291 | Dark Chocolate Peanut | 2307 / 2493 | 1074 / 2287 |
| 2769 / 3292 | Raspberry Lemon Cheesecake | 2308 / 2494 | 1074 / 2288 |
| 2769 / 3293 | Salted Caramel | 2309 / 2495 | 1074 / 2289 |
| 2769 / 3294 | White Chocolate | 2310 / 2496 | 1074 / 2290 |
| 2769 / 3295 | Banoffee Pie | 2311 / 2497 | 1074 / 2291 |
| 2769 / 3297 | Key Lime Pie | 2312 / 2498 | 1074 / 2292 |

This records owner fact review in the existing ledger. No runtime owner
override or unused approval manifest is introduced: the commercial block is
retained, and the current commercial reviewed-batch contract does not authorize
wildcard-to-fixed-unit inference. Any later use of reviewed evidence must use
a supported exact contract, source binding and independent commercial guards.
The decision does not authorize GBP 19.99 for arbitrary units, current stock,
new mappings, rebind, production apply or weaker source identity validation.

### Five independent findings

1. **Flavour:** the seven exact current payload IDs carry the seven exact names
   above and agree with the existing approved manifest.
2. **Canonical physical identity:** the owner confirms the boxes; the READ ONLY
   production capture at `2026-11-08T11:34:31.586Z` already has Pack=12,
   per-bar size 64g and these same canonical bindings. Ledger 261 was verified.
3. **WooCommerce identity:** current page capture at
   `2026-11-08T11:28:29.586Z`, HTML SHA
   `abce1b8bf315507c211b944cfc8cc9d4517caaff50c8caf9f37dc3f2cfe1030f`,
   has empty `attribute_size`. Actual storefront matching accepts empty values
   as Any attributes; 14/14 offline flavour x size selections resolve uniquely
   to the same variation ID for both 1pcs and 12pcs. Official
   [WooCommerce Any-attribute documentation](https://woocommerce.com/document/variable-product/#defining-variations-with-any-attributes)
   supports this interpretation; it does not establish a merchant sales unit.
4. **Live price unit:** the capture reports GBP 19.99 and a 12 x 64g label for
   each variation, but both selector sizes reach that same row. Neither equal
   prices, images, page defaults nor owner canonical identity establish which
   selection the merchant contract prices as a fixed box. This remains unresolved.
5. **Live stock unit:** the same source rows report false for both size
   selections. Box-specific availability remains unresolved; owner identity
   confirmation is not live stock evidence. No cart, checkout or order was used.

Original native WooCommerce CSV SHA
`6b9d131c658077b7f3982ebf94c80f34b6ae31ae4b158750d041adb73e6b1190`
also has blank per-variation sizes; it is historical identity context, never
current price/stock evidence. Latest retained natural full refresh
`42470470122`, artifact `13613319233`, source timestamp
`2026-11-08T10:27:34.758Z`, blocks on 2769 after 134 pages with zero executions
or writes. No new full dry-run is justified merely by owner unit confirmation.

### Existing product isolation extended to one fully proved failure class

The owner explicitly authorizes this narrow assessment and a compatible change
on PR #504; source instruction SHA
`3b2f923e1bc1ae27a0e803772687693f19b181792a99dc2fdb6e9d627d56d2bc`.
The original BLOCK was reproduced first (31 existing adapter tests PASS), then
the new 499/7 test failed on the original wildcard block before implementation.

The parser still returns no priced/stocked wildcard offer. For a completely
consumed HTTP 200 HTML body, the existing reader additionally supplies generic
document provenance to its parser callback: request/response URL, content type,
completion, byte count and SHA. Failed reads never receive completion proof.
Redirect/origin checks now run before HTTP error interpretation; a separately
reproduced regression showed that a foreign 404 could otherwise be mistaken
for product absence. Unchanged legitimate same-origin terminal 404 handling is
retained. No retailer condition is added to the shared reader or its disposition.

The Six Pack adapter refines the existing disposition only when all of these
conditions hold: typed `WILDCARD_COMMERCIAL_UNIT_UNRESOLVED`, the expected product,
clean bounded-reader transport context, complete HTML document, same approved
origin/product URL, exact current capture timestamp, recomputed document SHA
and byte count, and only the recognized `attribute_size` wildcard. Every source
variation must be in the approved manifest and every approved variation of the
product must be present and unresolved; extra, missing or unknown IDs fail
retailer-wide. The manifest SHA is fixed to the existing configured authority.
Cross-product shared canonical-variant dependencies cannot be split. Re-parsing
the retained document must reproduce the entire typed issue exactly. Existing
same-page JSON-LD checks additionally corroborate every wildcard ID/SKU, parent,
heading, URL, currency and reported commercial value; they do not accept that
value as the box's offer. No product or variation number is a runtime condition.

Only then, with ordinary `isolateUnsafe=true` and no special reviewed execution
mode, the same `isolatedSourceFailures` map excludes that product from trusted
commercial source rows. The same classifier produces existing
`SOURCE_VARIANT_MISSING` quarantine rows because no usable commercial variant
exists in the normalized source. This does not claim the raw product vanished:
the failure disposition and Review Queue evidence reason retain the exact
wildcard-unit cause. Existing manual identity/source-review cards have no source
price, KEEP_UNCHANGED state and no executable action. The publisher checks the
product, manifest, variation and document-hash linkage before displaying that
reason; no new approval/reason-code class is introduced.

Full raw HTML and transport/manifest evidence remain once in the existing
report's `source_failures`, covered by the existing report file hash and overall
snapshot fingerprint. Per-row evidence retains its linkage without duplicating
the HTML. Review Queue publication stores the existing bounded references,
not raw HTML or an invented commercial fact. The seven rows have no plan or
proposed offer and cannot advance last_checked_at. The approved 506 mappings
remain intact; successful source rows plus explicitly isolated rows must still
account for all 506. Source-collapse counts remain conservative and thresholds
are unchanged; broad 404/wildcard failures still block the retailer.

No product/variation ID condition, fixed unit, default-size expansion, owner
override, price conversion or stock inference is added to runtime code.
Shared executor, classifier, validator, locks, approvals, fingerprint algorithms,
thresholds, production manifests and schedules are unchanged. Generic reader
provenance and stronger redirect checks do not weaken source safety. The seven
rows remain excluded from commercial execution while independently safe rows
can reach the unchanged planner/validator/approval/executor/postflight paths.

Smallest missing proof: an authoritative current, exact variation/configuration
binding that establishes the unit to which both price and availability apply,
and resolves the 1pcs/12pcs ambiguity. A future adapter acceptance rule must
verify that proof against the unchanged approved box identity and reject
unit-dependent price/stock conflicts; owner identity approval cannot replace it.
No further owner approval alone can turn today's source into an executable box
offer. Once this PR is reviewed, its checks pass and deployment is separately
authorized, one ordinary full read-only preflight of all 506 mappings is a
justified next validation. It must freshly prove the whole source and may find
other review/blockers; 499 is not a live promise. The seven can leave review
only after authoritative commercial-unit proof. Production apply remains a
separate exact-plan decision. No new approval system or executor is proposed.

### Validation and handoff

Focused adapter/reader/publisher/executor tests: **105 PASS, 0 FAIL, 0 SKIP**.
The complete isolated fixture accounts for 279 products and all 506 mappings:
499 safe plans, seven unchanged source-review rows, zero omissions or dry-run
writes. Shared executor scope validation accepts only the 499 plans. Existing
postflight passes the modeled 499-only freshness advance, and rejects a price,
stock or freshness change to a review row. A second isolated source run gives
499 VERIFY_NO_CHANGE plus the same seven review IDs. Publisher guards produce
seven non-executable manual identity cards with null source price and the exact
wildcard reason. These are simulations, not production apply/postflight evidence.

Adversarial cases cover corrupted hashes/bytes/timestamps, wrong manifest/IDs,
unapproved source variants, unknown wildcard attributes, invalid SKU/JSON-LD,
duplicate IDs, partial documents, incomplete HTTP bodies, foreign/invalid
redirects including HTTP 404 and changed ports, missing scope, size-specific
price/stock variants, isolation disabled and source collapse. All remain
retailer-wide BLOCK with no artifact/plans/writes. Existing 6303, 4705/4708,
ordinary complete attributes and legitimate 404 isolation regressions pass.
The retained actual 11:28 single-product HTML also qualifies during an explicit
offline historical replay, with all seven exact IDs and the same document SHA;
this is not a new live fetch or proof of the other 278 products.
Inventory reviewed: unchanged 355
files and seal `7c2d270f8b1bc713d3921bf108f34611a4d4c941bd53e461d18824fe2c6037c4`.
The earlier diagnostic-only iteration's local/CI full gate (3558 PASS, three
existing SKIP) and integration 42477938614 (149 PASS, zero SKIP) are historical
evidence only, not validation of this isolation change. Current local quick:
**469 PASS**; current local full: **3564 PASS / 0 FAIL / 3 existing SKIP**, including
lint, TypeScript, production build and baseline migration checks. Guardian
passed before and after this ledger edit; `git diff --check` passes. Fresh
isolated PostgreSQL integration and exact-head full CI are required before
handoff, with final run links/results recorded in
[existing PR #504](https://github.com/SupplementScout/supplementscout/pull/504).
No additional retailer HTTP request, deployment, merge or production refresh
is performed. Full current-head validation is recorded in the existing PR #504.

Fit House's four unresolved cases remain untouched; no request follows its
11:28 HTTP 429. Whey/Jon's completed 8 November refreshes and all schedules
remain untouched. This task adds no recovery, importer, worker, scheduler,
executor or parallel approval path and preserves RA-001.

## 8 November 2026 approved migration deployment and canonical closeout (historical)

Authority: the owner's `SUPPLEMENTSCOUT. ZATWIERDZONE WDROZENIE #502 ORAZ
DIAGNOZA FIT HOUSE` instruction explicitly approves squash merge #502, exactly
one canonical production migration and its receipt-based technical PR/merge.
It does not approve a control close or business execution.

PR #502 merged at `2026-11-08T06:53:24Z` as
`10996f9d51fd6d8a6908c2132a2d565cf06f965a`, tree
`09a05018141872f8d6f2a12bdab56d8c97bae8de`, identical to the reviewed candidate.
Approved full CI `42455171799`, actual PostgreSQL integration `42455170019`
and Guardian `42455171743` were green for that unchanged tree; no bypass was
used. Pre-deployment Guardian also passed.

Read-only repeatable-read metadata at `2026-11-08T06:57:11.081Z` attested
production project `aftboxmrdgyhizicfsfu`, the canonical database identity,
owner `postgres`, `read_only=on`, ledger 260 / `17a00891...`, no row for
migration `20261107190000`, no active colliding database session and the exact
reviewed original procedure/security metadata. The actual file SHA was
`0c6a7ef27021c0ba2dc5ef38eea3289b8238e4dc3220ede03de6210336263ddf`;
real `unwrapTransaction` passed, and canonical pending contained only that file.

Exactly one `apply-selected-migrations.js --environment=PRODUCTION
--project-ref=aftboxmrdgyhizicfsfu --mode=apply --confirm=e681f06f0409b160`
returned `PASS / committed:true`. No rehearsal, retry, alternate SQL writer,
`db push` or other migration was used. Its committed readback recorded ledger
**261**, fingerprint
`755319fa4f9636e50cf8606e7a0b143945aa8bdd92c2183681e5285aecb4660a`,
and exactly one applied identifier. Products 1399, variants 4070, mappings 4361,
offers 4361 and price_history 48525 were unchanged before, within and after apply.

The applicator generated the actual
[`selected-migration-repository-closeout-v1` receipt](evidence/PLANNED-CONTROL-MIGRATION-CLOSEOUT-2026-11-08.json),
normalized SHA-256 `6955cde7ae114d348d61ab66f60e60955958c2f84e3619b23e19394ed85d478d`.
The existing verifier returned `POST_APPLY_VERIFIED / CLOSEOUT_REQUIRED`.
Only the receipt's three repository transitions are implemented: production
pending becomes empty and the production selector count/fingerprint becomes
its `post_state`. Shared runtime bindings derive from that same inventory.
Staging exclusions/pending/identity are unchanged; no applied-exclusion or
secondary runtime state is added. The SQL and all application/recovery/runtime
logic remain byte-identical to merged #502.

Independent read-only metadata at `2026-11-08T07:00:36.652Z` found one migration
row and the exact PostgreSQL procedure definitions and security metadata from
the reviewed integration artifact. Compiled internal body SHA-256 is
`35977d1adeb271929097dae9056ac15106a10fdf9512cf713959b11f51cb7914`;
the entire public wrapper remains unchanged at
`053dfa3f55a92cf6de8835fa880600d75656f40f536b240e32ee1d4452c84efb`.
Both remain owned by `postgres`; internal is DEFINER, wrapper INVOKER;
`search_path=pg_catalog, public, pg_temp`; EXECUTE belongs only to postgres
and the dedicated production approver, without grant option. Counts and complete
row-content digests for all five business/history relations and seven
control/apply/approval/recovery relations were identical before and after.
No plan was closed, approved, replayed or reset.

Closeout regression tests retain historical 259/260 and prerequisite 256/257
fingerprints while checking current 261 and empty pending; the real applicator
compatibility regression remains. Focused tests: **173 PASS, 0 FAIL, 0 SKIP**.
The unchanged 355-path test inventory needs no reseal. Project Guardian passed
before this evidence update. Final local quick/full, PR checks, independent
receipt/diff review and the canonical `CURRENT / ALREADY_CLOSED` verification
after standard closeout merge are required before proceeding to Jon's
read-only discovery/preflight. That preflight and the official Whey diagnostic
are evidence only; any exact control close requires a new owner decision.

## 8 November 2026 two-blocker repair evidence

This is preparation for review, not a claim of production restoration.

**Migration compatibility.** At `2026-11-08T06:25:49.937Z` / `06:25:50.211Z`,
explicit READ ONLY repeatable-read transactions through the existing verified-TLS
PostgreSQL client and canonical `databaseState` confirmed the migration version
`20261107190000` absent from production and staging. Targets were the canonical
project refs/identities, both sessions reported `read_only=on`. Production remains
ledger **260**, fingerprint
`17a00891dff4e0a4f53050a018594fd505aa0aabc02b5281580b42895d7fd61e`;
staging remains **120**,
`31dc3e6e90dab56dd00843bef441cfba400e1d9480d2940f41b46cfff6e32277`.
No future ledger binding is recorded as current.

The real `unwrapTransaction` reproduced the pre-connection failure on the
original file. Only its two leading comments moved after `begin;`, matching the
existing migration convention. Executed SQL, recovery logic, owners, ACLs and
security clauses are byte-identical. The applicator itself is unchanged.
Old file SHA-256 (historical preparation evidence retained below):
`f6d0bf7724ae6fe2e2f1e4e3df2bcdb89c50a4edf765dc4858f65741915eb69d`.
Current pending SHA-256:
`0c6a7ef27021c0ba2dc5ef38eea3289b8238e4dc3220ede03de6210336263ddf`.
Only the canonical production pending pin, staging exclusion and matching selector
test pin changed. Deterministic production confirmation is now
`e681f06f0409b160`; it is not execution authorization. The existing applicator
regression reconstructs and hashes the original rejected file, accepts the actual
new file and verifies identical transaction body and one outer wrapper. The
existing disposable PostgreSQL harness now prepares all three migration probes
through the real exported `unwrapTransaction`, including incompatible input,
success and replay. Actual final-SHA PostgreSQL execution is required below.

**6 Pack source evidence and decision.** Run `42414877241` stopped at source
product 2769 after 134 of 279 pages. Its 506 blocked rows mean interrupted source
coverage, not 506 invalid offers. No complete source fingerprint or sealed apply
artifact was produced. The existing main-only full-source workflow is preserved;
a feature-branch full live run is not authorized by bypassing that gate.

The read-only corpus audit enumerated all available workspace paths, inspected
HTML, source/snapshot JSON, embedded-source formats and 363 ZIP candidates
(17,880 entries; two candidates were actually text logs). Before the new capture,
the retained 6 Pack HTML comprised two full captures and two reduced fixture
contents (6303 and 4705); duplicate worktree copies and LF/CRLF copies are not
additional source samples. One retained normalized CSV snapshot contains 576
records, SHA-256
`ea5afeaf582a48980b6b471d0fda098481b0b30eb6812dd4be559c2fdf31a34f`;
it contains flavour-only 2769 records but no original theme DOM or size binding.
No retained raw HTML for 2769 existed.

One bounded public GET through the existing reader, `maximumAttempts=1`, captured
2769 at `2026-11-08T06:26:57.434Z` and reproduced the exact schema failure. No
403/429, alternative fetcher, retry loop or database access was involved. Raw
HTML: 345,770 bytes, SHA-256
`a87fb7f7715da3c4ece654cfc09fb0ef6a7efb17a79de11ac66d1acffda31f1d`.
The reduced fixture retains exact attribute declarations, selected values, row
identity/commercial data, price description and same-page JSON-LD. It does not
fill missing values.

| Source structure | Evidence and current outcome |
|---|---|
| Legacy WooCommerce variation form / simple Product | Existing shared-reader and adapter regressions retained; supported without runtime changes. |
| Complete theme row attributes | 6303: five exact flavour variants, options complete; the full capture selects Watermelon within the dropdown, while the reduced fixture uses an empty selection; both supported. |
| Complete explicit selection omitted from dropdown | 4705: six exact variants; selected 4708 requires the existing exact same-page group/variant ID, SKU, option URL, GBP price and availability corroboration; supported. |
| Blank per-row attribute with multiple declared choices | 2769: all seven rows have `attribute_size:''`; dropdown offers `1pcs` and `12pcs`; selected `1pcs` is only a page default. JSON-LD Product/Offer URLs and properties identify flavour only; price HTML says `12 x 64g bars`. Correctly blocked as `SOURCE_SCHEMA_MISMATCH`. |
| Missing keys, invalid identity, duplicates, conflicting selected JSON-LD or missing commercial evidence | Existing typed schema/identity/duplicate guards and regressions retained. |

For 2769 all seven IDs/SKUs agree, prices round to GBP 19.99, stock is explicitly
false and maximum quantity is 20. These facts cannot establish the absent size.
Independent review reached the same conclusion: accepting or filling size would
require guessing. **No parser runtime change is justified by this evidence.**
The new regression preserves the block for blank/missing/null/whitespace row
attributes, even with a default or a single remaining dropdown choice. Its real
reader-to-run downstream case proves no classification actions, executable plan,
Review Queue rows, sealed apply artifact or database writes. Offline replay also accepts both full retained captures (five/six variants) and
reproduces the exact schema block on the full 2769 capture. The shared reader,
other adapters, classifier, approval and executor are unchanged.

Focused local validation: migration/applicator/selector/close contracts **95 PASS,
0 FAIL, 0 SKIP**; 6 Pack plus shared page-reader **41 PASS, 0 FAIL, 0 SKIP**.
Test inventory was reviewed: the existing 355 test paths and seal remain intact;
only cases and one source fixture were added. Project Guardian passed before
this ledger update. Final quick/full gates, actual integration CI and independent
final-SHA review must be recorded in the PR before handoff. Historical skipped
artifact tests must not be reported as executed integration passes.

Architecture remains the approved RA-001 direction with current production
routes preserved: no scheduler, queue, importer, executor, recovery framework,
product allowlist, retry expansion, approval change or new source of truth.
No production/shared-staging writes were performed. The single next release
sequence, after separate approval, remains: review/merge; one full 6 Pack dry-run
(which may correctly remain source-blocked); exact canonical migration and
receipt-based closeout; fresh Jon's preflight; separately approved exact control
close; Jon's and Whey Okay verification. No source or recovery blocker is waived.

## 7 November 2026 final review and deployment decision package

Authority: review, minimal in-scope corrections, safe CI, disposable PostgreSQL,
existing branches/PR updates and deployment preparation only. No merge to main,
shared database migration, control close, approval/apply, schedule/ACL/credential
change or writing automation dispatch is authorized. This entry is one package
for both existing PRs. Final readiness is gated by their final SHA-bound checks,
the compiled-procedure artifact and the isolated combination readback recorded
in the PRs; this documentation is not execution approval.

Architecture review retains one execution path. PR500 changes only the 6 Pack
adapter and its regressions: no product/variant ID exception, source guessing,
shared reader change or second JSON-LD library. The existing generic Product
extractor strips variant query/hash and flattens group relationships, so the
small local traversal is needed for this storefront representation. The same-page
JSON-LD is a consistency check, not an independent external source. Schema,
identity and duplicate errors remain typed through the bounded reader; the
existing systemic run regression now proves all of them BLOCK the whole source
before classification, planning, artifact creation or writes. An exact HTTP404
retains its separate existing product-isolation policy.

PR501 keeps the same public RPC, internal implementation and coordinator. No
runtime correction was found necessary in this final review. The existing
PostgreSQL harness now retains actual complete pg_get_functiondef/prosrc before
and after, their exact diff and owner/ACL/security settings. It proves one
insertion point, unchanged full public wrapper, unchanged legacy internal body
apart from the inserted branch, rejected incompatible source and rejected rerun.
The pinned original normalized internal source SHA-256 is
`84bb206a0e769067f3af4992bfd30875d5812c9a56179fa9a100b0814dc6f8f2`.
The final migration file remains
`20261107190000_extend_never_approved_planned_control_close.sql`, SHA-256
`f6d0bf7724ae6fe2e2f1e4e3df2bcdb89c50a4edf765dc4858f65741915eb69d`.
Hash-gated text edits follow existing migration practice, including
`20261027150000_extend_sequential_parent_approval_to_gladiator.sql`;
this proposal adds no maintained second copy of the procedure. Generated SQL
is a test artifact only. The existing Quality Gate uploads that bounded artifact.

The internal function remains postgres-owned, VOLATILE, SECURITY DEFINER with
search_path pg_catalog,public,pg_temp. The public wrapper remains SECURITY
INVOKER and checks the dedicated production approver. Owner and approver retain
the existing EXECUTE ACL; PUBLIC, anon/authenticated/service_role and executor/
validator receive no new privilege. Actual artifact metadata is authoritative.
The PLANNED case requires null approval/rollback fields and zero dependent
records, an elapsed original deadline, matching target/ledger and a full-state
rehash under execution/retailer and row locks. Statement-level test triggers
abort any INSERT, UPDATE or DELETE on all six business/history tables, including
in-place value changes that unchanged counts alone would miss. Existing expired
and partial-prefix cases are executed in the same disposable harness.

### Fresh bounded control evidence (not close authorization)

At2026-11-07T20:35:03.664Z the existing official read-only preflight, using its
previously authorized owner connection, found Jon's retailer10 parent
`e6cdaae2-108e-47a2-9f0f-88ce51a85ed5`, fingerprint
`313c1fdda3f61264388ac7cddaea86be8c634156089ee48eaf9d798dddc267af`,
10 PLANNED children/491 rows, all approval fields null and all six dependent
counters zero. Original deadline2026-11-06T12:46:49.416Z elapsed. The current
SQL control-state fingerprint is
`5bdae9a53cfcacafb37b4a6e2810735f54571aefd2c8fb440ecb105805ac8fd3`.
The production ledger is still260 /
`17a00891dff4e0a4f53050a018594fd505aa0aabc02b5281580b42895d7fd61e`.
The generated READY_TO_CLOSE classification is preparation only; the new RPC
branch is not deployed and this state is not an owner-approved execution seal.

Official Whey control-diagnostic run
[42411850637](https://github.com/SupplementScout/supplementscout/actions/runs/42411850637)
at20:37:21-26UTC used the existing validator read RPCs. Whey is retailer3.
It returned BLOCKED_CONTROL, exactly that Jon's parent, 10 PLANNED children,
zero active apply runs, import/offer approvals and conflicting sessions. It
started no source capture and reported zero attempted/completed business or
control writes; every writing job was skipped. A subsequent official READ ONLY
discovery for retailer3 returned zero own active parents. The initial incidental
discovery of retailer14 is retained separately and is not Whey evidence. These
are as-of reads; they do not reserve the database state for future execution.

The registered parent proves registration committed. The prior child-approver
client timeout has no matching committed approval/apply evidence; the current
tree is wholly unapproved/unexecuted. Its underlying latency/root cause remains
unknown. Recovery clears an abandoned control tree; it does not fix that timeout
or justify changing timeouts/retries. Fresh Jon's and Whey runs plus postflight
and absence of the same blocker in those observed runs are later acceptance
conditions; one successful run cannot prove permanent stability.

### One decision package; separate operation authorities

| Operation requiring owner authority | Entry conditions and exact scope | Expected effect and stop condition | Confirmation |
| --- | --- | --- | --- |
| Merge500 then501 | Final SHA-bound checks green; reviewed combined tree preserves both ledger entries and separate code scopes | Publish reviewed code only; stop on changed HEAD/base or failed required review/check | Read merge SHA and tree against reviewed candidate; no production dry-run in this preparation phase |
| Deploy the one pending production migration | Fresh target/ledger260 match, exact file SHA above, reviewed compiled procedure/security and explicit migration approval | Existing apply-selected-migrations only, canonical pending confirmation c2ca9299b4ca719a; schema plus one ledger record260-to261, no control close/business DML; stop on any source/ACL/ledger drift | Existing post-commit readback and generated selected-migration-repository-closeout-v1 receipt |
| Canonical repository closeout | Only after committed migration and exact readback | Consume the pending entry and update PRODUCTION ledgerCount/fingerprint from the existing generated closeout, not an ad hoc pasted hash; stop on missing/unknown commit result or drift | Expected derivation261 /755319fa4f9636e50cf8606e7a0b143945aa8bdd92c2183681e5285aecb4660a; verify runtime binding/selector and required checks |
| Exact control close | After schema deployment AND canonical binding closeout: one fresh preflight of current exact parent/tree/ledger, terminal origin workflow/no writer, owner reviews its exact state fingerprint | Existing manual recovery only, explicit OWNER_APPROVED_PLANNED_CONTROL_CLOSE plus owner-supplied state hash; supersede only parent+10 children (11 control writes), no approval/business/history write; stop on state change, activity, guard mismatch or unknown result; no automatic retry | Existing independent read-only postflight checks terminal identities/audit, zero approvals/apply/recovery records, preserved history and zero business deltas |
| Fresh authorized refresh | Close postflight valid, fresh source and fresh plan in existing immutable scopes; no replay of old manifest or review rows | Existing schedules/workflows and guarded approval/executor only; ordinary price/stock/freshness writes may resume; stop on source, identity, anomaly, approval or postflight failure | Complete source classification, actual execution/postflight and idempotency under existing contract; Jon's and Whey specifically rechecked for recurrent block |

The one missing step for a concrete future close decision is a fresh preflight
AFTER migration deployment and canonical binding closeout. The historical or
current pre-deployment hash is not substituted for that later owner decision.
No apparently executable close command is supplied now. Push/merge cannot apply
the SQL automatically: no workflow calls the migration applicator or db push;
the relevant automatic jobs only validate/build/preview. The proposal remains
production-pending and staging-excluded. No dependencies are installed on shared
staging for this test.

Closing the common parent can allow the already enabled Jon's (04:47UTC) and
Whey (02:17UTC) schedules to reach their existing write path again. Other enabled
shared refreshes can also cease encountering that global guard, but retain their
own source/scope guards. This is not a read-only operational consequence; normal
scheduled business writes remain possible. No scheduler is paused or activated
here, GYM HIGH is not reconfigured and Predators stays unactivated.

The two PRs deliberately keep separate code changes. Their common ledger header
and selected-default subsection are reconciled identically before final tests;
501 retains the full prior restoration evidence plus this decision package.
The isolated combination uses500 then501, without a merge to main or a new PR.
Its exact parent SHAs/tree and validation belong in the existing PR evidence.

## 7 November 2026 approved follow-up preparation ? code review only

The owner explicitly approved (A) the selected-default4708/parser-error fix with
regressions and a review PR, and (B) the never-approved PLANNED recovery extension,
isolated tests and a forward-only migration proposal. Both scopes remain within
this one incident task. No merge, schema deployment, close, approval or production
refresh is authorized by these decisions. No live source or database operation
was performed during this preparation. The readback below is retained historical
evidence from the authorized restoration phase, not a fresh production preflight.

### 6 Pack review candidate

PR [#500](https://github.com/SupplementScout/supplementscout/pull/500), head
`0eca6936481722f29a6155d4e0e01795f8c0d34e`, extends only the existing adapter.
A unique complete explicit selected map must agree with exact JSON-LD parent,
variant, SKU, attribute URLs, GBP price and stock. All other unknown options
remain blocked. Typed source errors preserve schema/identity/duplicate codes.
The reduced4705 fixture retains all six source variants. RED reproduced both
failures; focused24/24, local quick/full, independent39/39 and PR full
[42405617340](https://github.com/SupplementScout/supplementscout/actions/runs/42405617340)
pass. Integration evidence belongs to the PR. No merge or live rerun followed.
Status: `CODE_READY_FOR_REVIEW / LIVE_DRY_RUN_BLOCKED / SCHEDULED_APPLY_NOT_YET_VERIFIED`.

### Existing recovery extension review candidate

The same `retailer-control-plan-recovery.js` and
`close_expired_retailer_offer_sync_approval` RPC handle a new explicit v2 kind,
`NEVER_APPROVED_PLANNED_SEQUENTIAL_PLAN`. All parent/child approval fields must
be null, all children PLANNED and six dependent approval/apply/recovery counters
zero. The original registered plan deadline must have elapsed; no expiry or
approval is invented. Current SQL hashes the full parent and ordered child rows
in UTC during read-only preflight and recomputes that hash under the existing
global/retailer locks and row locks immediately before closing. Existing v1
expired/unexecuted and partial-prefix behavior stays byte-for-byte intact.

The forward-only proposal
`20261107190000_extend_never_approved_planned_control_close.sql` verifies the
existing function source SHA-256, owner, security and ACL before adding the new
branch. It changes no grants, adds no RPC/table and closes no plan on deployment.
It is SHA-pinned pending only for production and SHA-pinned excluded from staging, which does not have the prerequisite production RPC. Runtime ledger bindings
stay production260 / staging120. Derived post-deployment261 (production) /122 (existing staging pending set) fingerprints
are proposals, not evidence of deployment. Existing migration-apply confirmation
changes with the pending set; deployment requires its own exact owner approval.

A future planned close requires `OWNER_APPROVED_PLANNED_CONTROL_CLOSE` and a
separately supplied exact `planned_control_fingerprint` from the owner's
reviewed preflight. A generated READY_TO_CLOSE artifact is not owner approval.
The existing manual workflow forwards that exact input; neither schedule nor
default refresh modes invoke close. Fresh readback must still match, the
originating workflow must be terminal and no active writer may be present.
The old Jon's readback/fingerprint alone cannot authorize execution.

Terminal status is SUPERSEDED for the parent and every child; expected control
writes are N+1 (11 for the retained Jon's10-child tree), zero business/history
writes and no approval row. Existing audit logs bind the exact request/state and
result. Exact replay returns zero-write already_closed; the coordinator never
retries, including after failed postflight. Postflight checks all identities,
terminal statuses, audit, zero approvals/dependent records and unchanged ledger
and business counts. Partial APPLIED prefixes retain the prior contract.

Regression coverage uses existing test files: strict never-approved validation,
full mocked CLI/readback/RPC/postflight, wrong owner state, state drift, rollback
and count mismatch. The existing disposable PostgreSQL harness applies the new
migration, checks no state changes and replay rejection, reruns old expired and
partial scenarios and executes a10-child/491-row planned scenario including
valid-shaped wrong state hash, metadata/evidence guards and injected atomic
rollback. Local quick/full and actual isolated CI are required; final results
and exact candidate SHA are attached to the review PR. No Docker is required on
the owner's laptop; CI uses a disposable PostgreSQL container without production
credentials. The reviewed test inventory remains355 paths with unchanged seal
`7c2d270f8b1bc713d3921bf108f34611a4d4c941bd53e461d18824fe2c6037c4`.

Status: `REVIEW_CANDIDATE / MIGRATION_NOT_APPLIED / CONTROL_CLOSE_NOT_EXECUTED`.
Jon's and Whey are not restored. Fit House, Review Queue and other retailer
readbacks below are historical as-of evidence; no repeated full audit or natural
schedule monitoring was performed in this code-preparation scope. Homepage and
issue#497 remain outside scope.

## 7 November 2026 authorized restoration — merged, read back, blocked safely

This entry supersedes the earlier incident's no-merge/no-dispatch boundary only
as expressly authorized by the owner's next instruction: standard merge #499,
one full read-only 6 Pack dry-run on merged main, existing natural 6 Pack
automation, and current Jon's/Whey readback/recovery preparation. It does not
authorize additional application logic, migration, fabricated exact approval,
arbitrary owner/service-role fallback or replay. No new runtime was created.

### 6 Pack — PARSER_DEPLOYED / LIVE_DRY_RUN_BLOCKED

PR [#499](https://github.com/SupplementScout/supplementscout/pull/499) merged
normally at18:40:42UTC as **b253a5c5b54b3bef84777d4862cbb9f2c5ed136f**.
Candidate **d15dc617a83aa122669da2ca87eeb5a77a15223d**, base7d9defd and required
checks remained unchanged; branch protection/rules/review readback imposed no
additional reviewer requirement. No admin bypass. Candidate and merge trees
are equal. Existing full3542 PASS/3 existing SKIP and actual integration148
PASS/0SKIP still apply; automatic main full42402468766 and Guardian42402468771
also passed. No duplicate CI dispatch was made in this restoration phase.

Before dispatch, the current workflow and called source code were rechecked:
manual `operation=dry-run` skips approve/apply, plan registration, source binding,
Review Queue publication, postflight and idempotency. No natural 6 Pack run was
active. Exactly one workflow was dispatched:
[42402480456](https://github.com/SupplementScout/supplementscout/actions/runs/42402480456).
It **FAILED/BLOCKED**, with **0 database writes**. The existing workflow's own
bounded retry policy ran unchanged; no second workflow or manual apply followed.

Artifact **13586546086**, `six-pack-offer-refresh-42402480456-1`, ZIP digest
**1aa2e604fc288e885571dd8a38decf6ba37b532d4058a2d5bc40d66e5c581a0c**:
approved scope506 mappings /279 distinct product IDs; fetched25 pages before
product4705 failed. The report's506 blocked rows denote incomplete source
capture/classification, not506 proven invalid offers. Review/executable counts
are not a completed partition. No complete source fingerprint or sealed apply
artifact was produced. It is not `LIVE_DRY_RUN_PASS`.

One bounded existing-reader GET of product4705 at18:49:57UTC returned200 and
334693bytes, final product `7nutrition-bodybuilder-mass-gainer-7kg`. Offline
replay of that unchanged capture reproduces `SOURCE_SCHEMA_MISMATCH / 6 Pack
variation attributes do not match their declared options`. Variant4708,
`Chocolate caramel hazelnut`, is present in the buy-box variations, explicit
`selected` value, visible selected label and matching JSON-LD Product node, but
absent from the five declared dropdown options. It is approved mapping2255 /
offer2069 /canonical product129 /variant2004. Price£59.99 and in-stock state
are source observations, not approved writes. The existing reader catches the
adapter's plain Error and relabels it `SOURCE_UNAVAILABLE`, hiding the parser
reason. This is not demonstrated network failure.

Smallest proposed further scope, **not implemented**: recognize only a fully
bound, unambiguous explicit selected-default variant with exact parent/variant
and retained JSON-LD price/stock consistency; all other unknown options remain
blocked. Use the existing `WooCommerceSourceError` contract at the adapter edge
to preserve typed failures, without a permissive shared-code allowlist. Add the
retained4705 regression and negative mutations. This is additional logic beyond
#499 and requires owner authorization. **SCHEDULED_APPLY_NOT_YET_VERIFIED**;
do not wait indefinitely for a future schedule or claim production recovery.

### Jon's and Whey — actual blocker identified, no close executed

The approved validator diagnostic
[42402555453](https://github.com/SupplementScout/supplementscout/actions/runs/42402555453)
passed its read-only operation and reported `BLOCKED_CONTROL`: one global
parent,0 active runs/conflicting sessions. It used the existing approved-state
and active-parent-inventory RPCs, with no source fetch or write. Its result
identifies **Jon's retailer10**, not a Whey-owned parent.

Official read-only discovery
[42402605454](https://github.com/SupplementScout/supplementscout/actions/runs/42402605454)
returned exactly one Jon's parent:

- parent: **e6cdaae2-108e-47a2-9f0f-88ce51a85ed5**;
- parent fingerprint: **313c1fdda3f61264388ac7cddaea86be8c634156089ee48eaf9d798dddc267af**;
- created2026-11-06T12:32:50.300928Z, status **PLANNED**;
- 10 children all **PLANNED**,0 APPROVED/APPLYING/APPLIED,0 apply runs;
- production ledger260 /17a00891... matches the existing canonical repository
  binding; no pending/ledger correction was needed.

Official preflight
[42402896836](https://github.com/SupplementScout/supplementscout/actions/runs/42402896836)
correctly **FAILED** at `expected exactly one active batch approval`. It does
not create an approved recovery package. To retain the detailed read results
which this failed CLI does not export, the unchanged official preflight was
run locally with a SELECT-results-only logging preload and its already
configured recovery credential. No SQL/results/validation were changed.
Production identity, **READ ONLY** and **ROLLBACK** were confirmed. Two local
setup attempts before the proper CLI invocation made no database connection;
their diagnostic failure is not production evidence.

Current detailed readback confirms491 rows, null parent approval/expiry/consumed
fields, no batch approvals and zero apply runs, row approvals, recovery
manifests, recovery approvals or recovery audit. Thus the durable current
state after the earlier approval timeout is established; its original latency
cause remains unproved. The10 current children, in batch order, are:

| Index | Child ID | Rows | Status |
|---:|---|---:|---|
|0|76598329-5321-434c-a85c-1638389313af|50|PLANNED|
|1|194658c5-3ebe-4f58-a5c2-7617b88eccb5|50|PLANNED|
|2|16bc89a9-c099-478a-bf63-7ea5882c29f8|49|PLANNED|
|3|aeccde1e-dbeb-4e93-a5ab-4bb154c803f2|49|PLANNED|
|4|034101c9-bf20-4a92-b4c6-cddc1ef41cab|49|PLANNED|
|5|182b9631-790f-48b7-a7f6-a3f7e58c7a57|49|PLANNED|
|6|a13732f3-87ef-4f92-ae38-49d813fc7a3e|49|PLANNED|
|7|1050c797-fd7c-4ed0-b258-c0fa28ee16eb|49|PLANNED|
|8|65db6137-1650-4215-8f2b-ac1ddbb72e88|49|PLANNED|
|9|61e9610f-1b9c-47df-b281-f166a1c6fc8f|48|PLANNED|

Every child approval ID/expiry/consumed field is null; every row/batch approval,
successful/other apply-run and recovery-manifest count is0. Full child
fingerprints are retained in `tmp/incident-evidence/recovery/jons-control-read-capture.json`
and the PR closeout. They were read, not regenerated.

Whey's separate official discovery
[42402899322](https://github.com/SupplementScout/supplementscout/actions/runs/42402899322)
is **CLEAR**, retailer3 with0 own blocking parents. Its current blocker is the
same global Jon's tree. **No Whey close is justified.** Neither retailer had a
fresh business refresh, postflight or idempotency run in this session because
the unresolved parent correctly blocks execution.

The existing recovery admits only an expired APPROVED boundary or an applied
prefix plus expired APPROVED boundary. SQL has the same requirement. Resume,
recalculation and old hardcoded supersede migrations are not valid substitutes
for terminating this never-approved PLANNED tree. **Close calls0; control
writes0; business/history writes0.** No artificial approval was created.

Smallest proposed further scope, **not implemented**: extend this existing
recovery contract/RPC with a separately authorized never-approved PLANNED
case, exact parent/child fingerprints,10-child491-row scope, all approvals and
execution/recovery evidence absent, no active writer, existing locks and atomic
terminal transition, with zero business/history-write postflight. Preparing
that change requires separate code and forward-only migration authority;
applying it and closing the exact current tree require later fresh readback
and explicit execution approval. No new recovery framework is proposed.

### 42501 and the correct existing read interfaces

Metadata-only validator read at18:52:39UTC confirms session
`supplementscout_production_validator_login`, role
`retailer_catalogue_production_validator`, READ ONLY. That role lacks EXECUTE
on `public.retailer_catalogue_actual_database_target()` (the first operation
of the previous failed probe) and lacks `supabase_migrations` schema usage.
Both approved-state/inventory RPCs are executable and the approved diagnostic
worked. The original probe saved only42501, not its server object message;
current ACL proves its first call is unauthorized, not a blanket application
SELECT outage. That denied operation was not repeated. No GRANT, credential,
RLS/TLS change, arbitrary owner/service-role fallback or RA-004 activation.
The owner credential used for richer recovery reads was confined to the
already-configured, previously authorized official recovery preflight.

### Fit House, schedule and unchanged retailers

At18:47:16UTC the existing reader obtained a complete HTTP200 Shopify snapshot:
231 products /326 variants,1 request, source-health PASS, fingerprint
83d16c2713c34230f458686d9f4525806d93f41e83351c947e17f005add77fca.
Existing validator `readState` confirmed the286 approved mappings. The same
four mapped variants remain absent:49744981426416,49764030906608,
49791610257648,49791610290416 (offers698,1856,1858,1859). Their mapping updates
remain July dates, not a newly changed binding. The three exact product JSON
URLs returned404 at18:51:51UTC, without retry. This supports current source
absence, not network/collapse failure; it is not authority to infer permanent
deletion, OOS or replacement identity. No allowlist or stock write.

Latest natural Review Queue run
[42399023517](https://github.com/SupplementScout/supplementscout/actions/runs/42399023517)
was created17:59:53UTC on7d9defd and passed: processed0, database writes0,
active execution count0. At19:00:29UTC it was still newest, aged60.60min:
**DELAYED** under the unchanged30/60/120-minute policy, not the earlier BROKEN
snapshot and not proof of stable half-hour delivery. No scheduler or watcher
was added; no synthetic worker run. Earlier nine10 Reps decisions were not
replayed. Existing same-day execution/postflight evidence for Discount, KIOR,
Dolphin, Simply, eBay,10 Reps, Gladiator and GYM HIGH is retained; none was
manually rerun for this report. Predators remains unactivated.

### Prior restoration handoff (superseded by preparation approval below)

The prior handoff requested two independent, reviewable preparation decisions: (A) the narrow6 Pack selected-default/error-class compatibility fix
with tests; (B) an extension of the existing Jon's/Whey recovery for the exact
never-approved parent above, including a forward-only migration proposal and
isolated tests. Preparing either is outside the current no-new-logic boundary.
Neither decision is a close/apply approval, and no `READY_TO_CLOSE` seal was
manufactured. Fresh exact production execution approval remains a later gate.

This restoration phase merged#499 and dispatched five workflows: one6 Pack
dry-run, one Whey read-only diagnostic, Jon's/Whey discovery and one Jon's
read-only preflight. All business/control/price-history writes and all close
calls by this session are0. Other natural processes can still write; their
changes are not attributed to this session. No application/config/workflow/SQL
file changed after#499. Existing ledger is updated locally for review and PR
description carries the remote closeout; no new implementation PR or result-only
commit was created. Pre/post Project Guardian PASS. No global ALL_PASS or
restored-retailer claim; local raw evidence remains ignored.

## 7 November 2026 existing-path incident — diagnosis and bounded parser fix

### Selected-default follow-up — prepared for review, not deployed

PR #499 merged as `b253a5c5b54b3bef84777d4862cbb9f2c5ed136f`.
The authorized complete dry-run `42402480456` safely stopped on product4705
after 25 source pages: no complete 279-product/506-mapping source snapshot or
sealed apply artifact was produced. Its 506 blocked rows reflect incomplete
classification, not proof of 506 bad offers. No business/control writes were
performed by that dry-run.

Retained public HTML (2026-11-07T18:49:57.608Z, SHA-256
`24c923fc8b35d6721b535125a4644d10c18a6b73805af8c0d8f019050b2e5a1f`)
reproduces an explicit selected variant4708 omitted from dropdown options.
The adapter now requires a unique complete selected map and matching exact
ProductGroup/variant URL, parent, SKU, GBP price and availability before accepting
that row. Other unknown options still fail closed. Adapter exceptions use the
existing typed source error so schema, identity and duplicate codes survive the
bounded reader. Shared readers, executors and approval contracts are unchanged.

The owner separately approved code, regression tests and a review PR, excluding
merge and production runs. RED reproduced the parser failure and error-code
loss; GREEN is 24/24 focused tests. Local `verify:quick`, `verify:full` (including
lint, TypeScript and production build) and independent offline verification
pass. The reduced fixture preserves all six variants from the retained capture.
An additional RED/GREEN malformed-sibling regression keeps a missing attribute
map from escaping as an untyped canonicalization exception during selection.
The invalid row still fails closed with the existing source-schema error.
No test path was added/removed/renamed: the reviewed quality-gate inventory seal
remains 355 files, `7c2d270f8b1bc713d3921bf108f34611a4d4c941bd53e461d18824fe2c6037c4`.
The final review extends the existing whole-run failure regression over all four
source-error codes; each must stop before classification with zero plans and
no apply artifact. JSON-LD corroborates consistency of this page only.
Production remains `LIVE_DRY_RUN_BLOCKED / SCHEDULED_APPLY_NOT_YET_VERIFIED`;
this follow-up is `CODE_FIX_VERIFIED_LOCAL / REVIEW_PENDING`.

**DIAGNOSIS_CONFIRMED / CODE_FIX_VERIFIED locally /
PRODUCTION_RECOVERY_PENDING_APPROVAL.** Owner instruction: repair the existing
automation without a second queue, scheduler, worker, importer, adapter registry
or approval path. Starting main and branch baseline:
`7d9defdac4c8bb80b55beba429f6205bf212b053`; isolated branch
`fix/retailer-automation-incident-20261107`. No related open repair PR existed at
preflight. Homepage and issue #497 are outside this scope. Earlier dated entries
below are historical checkpoints, not claims that their acceptance gates are
still outstanding.

### Existing flow retained

- Schedule/manual inputs remain in the current `.github/workflows/*offer-refresh.yml`.
  Discount, Dolphin, KIOR, Fit House, Simply and Gladiator use the existing
  shared `fit-house-offer-refresh.js` engine and configured source profiles;
  10 Reps uses its CSV profile. `executeRefresh()`, `validate()`, `register()`
  and `approveAndExecute()` retain the shared classifier/plans, canonical
  `environment-migrations.js#migrationBinding`, sealed artifacts and split-role
  offer-sync RPCs. Whey and Jon's retain their supported wrappers and the same
  guarded RPC/control mechanisms; no cutover is implied.
- 6 Pack keeps `six-pack-offer-refresh.js#run` -> bounded Woo page reader ->
  exact approved manifest -> `classifyExistingOffers()` / existing atomic plans
  -> `six-pack-offer-refresh-executor.js#validatePlansReadOnly` /
  `executeApprovedPlansWithCheckpoint` / `executeEntry`. eBay and GYM HIGH keep
  their existing artifact-bound import executors. No new execution path exists.
- Review publication uses `automation-review-source-binding.js`, reconciliation
  and `automation-review-publisher.js#validateRow` / `publishReviewManifestViaRpc`.
  Reasons come from `config/automation-review-reason-codes.json`. The one
  `automation-review-execution-adapters.json` registry is consumed by both
  `app/lib/automationReviewAdapters.ts` and the script adapter registry.
  Owner-approved requests use `automation-review-queue-worker.js#run`, existing
  coordinator/workers and the durable execution-request/event ledger.
- Existing freshness, source-collapse, anomaly, fingerprint, owner approval,
  idempotency and postflight contracts are unchanged. The seven workflows using
  `retailer-offer-production-write` still serialize writes with `queue: max`.
  Existing dedicated concurrency groups are retained. Database evidence remains
  `retailer-offer-refresh-postflight.js#capture` / `verifyPostflight`; reporting
  remains the current watchdog and workflow summaries.

### Bounded current evidence

Read-only Actions inventory covers 4–7 November, 309 runs at capture. All latest
retailer refreshes below are genuine `schedule` events on
`9eeddc65c5c5c1385f441b8877287a305505e749`, before the homepage merge. Thus these
failures do not originate in the homepage release. A successful workflow is
counted only for the relevant job and retained execution/postflight evidence.

| Path | Latest relevant run | Actual stage/outcome and remaining boundary |
|---|---:|---|
| 6 Pack | `42361990356` | First failure: source parsing product6303, `SOURCE_SCHEMA_MISMATCH`, expected one Product JSON-LD block, found5. Apply never reached. Last complete run `42205190703`:464 executed/42 review, postflight PASS. Adapter fix below; production proof pending. |
| Whey Okay | `42357164216` | Preflight blocked by active approval/workflow/conflicting session; no apply. Last good `42195176800`:579/589 executed,10 review,12 children/postflight PASS. `EXPECTED_SAFETY_BLOCK`; exact current control inventory unavailable. |
| Jon's | `42367839015` | Read-only validator PASS, then registration `P0001 / RSBI_REPLAY_BLOCKED`: equivalent control plan active. Approver/executor not run. Last complete `41830579130`:491 rows/10 children. Prior `42218194836` timed out at first-child **APPROVER**, not a proven executor failure:0 completed children,1 recorded control write. Its transactional outcome is not established by timeout; no replay or unlock. |
| Fit House | `42358908309` | Source preflight rejects an unallowlisted absent mapped variant; apply skipped. Last complete correlated job `41810359630`. `EXPECTED_SAFETY_BLOCK`; no source-absence policy widening. |
| 10 Reps | `42358908309` | Relevant job applied812,138 review, postflight PASS despite the other retailer failing in the same workflow. Review backlog alarm is separate. |
| Discount | `42377535941` |109 executed, postflight PASS; today's watchdog had an earlier evidence-fetch error, not proof of a failed refresh. |
| KIOR | `42380959600` |11 executed, postflight PASS. |
| Dolphin | `42369718466` |1 executed, postflight PASS;2 legacy stale offers remain outside automatic scope. |
| Simply | `42369160583` |118 executed/2 review, postflight PASS; backlog growth is separate from execution health. |
| eBay | `42370239655` |161 executed/76 review, postflight PASS; do not replay historical failures. |
| GYM HIGH | `42366250125` | Dedicated catalogue job succeeded with retained execution/variant-postflight artifacts; no route, identity or adapter activation in this task. |
| Gladiator | `42383749419` | Later natural job:603 executed/31 children, postflight/idempotency PASS. Older watchdog history could not resolve a complete relevant profile attempt. Historical preparation-only header must not be used to infer today's activation authority; no activation/configuration write performed here. |
| Predators | no active scheduled refresh | Existing manual/source-gated path,47 stale offers in watchdog. No claim of a broken enabled scheduler; no activation authorized. |

Read-only watchdog `42374361371`, artifact `13575610731`, generated
`2026-11-07T12:55:38Z`:13 retailers,8 failures, global
`MONITORING_INFRASTRUCTURE_ERROR` (Discount evidence fetch failed), plus genuine
failed attempts, backlog growth and Gladiator profile-history truncation.
This is not one common write-engine outage. Its bounded database snapshot has
48h-stale counts: GYM1, Whey291, Discount47, Dolphin2, Simply2, KIOR0, Fit286,
Jon's506, 6 Pack42, eBay73, Predators47, 10 Reps136, Gladiator0. These are
timestamped observations, not fresh current counts or automatic scope sizes.
Later independent schedules advanced some rows; none are attributed to this
repair. A further bounded read using the existing production validator account,
verified TLS and `withPostgresRoleSession(readOnly:true)` stopped on PostgreSQL
`42501`. No owner-role fallback, new credential or privilege change was used.
Complete present parent/child/approval and ledger readback therefore remains an
explicit permission/evidence gap.

### Previous repairs reused

- PR #492 is merged (`2279144e...`). Current canonical repository binding is
  PRODUCTION260 / `17a00891dff4e0a4f53050a018594fd505aa0aabc02b5281580b42895d7fd61e`,
  pending0. Its deterministic closeout lifecycle already exists. Latest KIOR,
  Discount and Gladiator validator/apply/postflight evidence passes. Do not
  recreate lifecycle code or copy a live fingerprint into configuration.
- PRs #491 and #493, plus the existing stagger correction, are present. Actual
  cron is `8,38 * * * *`; liveness is healthy through60min, warning through120,
  broken above120. Watchdog observed genuine scheduled worker `42374411325`
  at12:52:48UTC as healthy; worker processed0 because no eligible queued request
  was selected. This proves an ordinary event, not a30min delivery SLA.
- PR #495 (`8d03526d...`) preserves native pending workflow runs; #496
  (`9eeddc65...`) supplies the already-existing cancelled-dispatch closeout.
  Owner audit artifact of `42374411325` at12:53:54UTC proves original reviews
  3747–3753 EXECUTED,3745/3746 EXPIRED with FAILED requests, and active execution
  count0. New decisions3963/3964 for those latter two offers already executed
  in others' runs `42363813299` / `42363823538`, each one stock update plus19
  freshness confirmations, postflight/idempotency PASS. No recovery of those
  historical nine is outstanding on this evidence; none was dispatched here.
- Jon's current registration blocker and prior first-child approval timeout
  are separate from cancellation, scheduler delivery and the already-corrected
  November migration mismatch. `jons-offer-refresh.js` is unchanged between the
  last good and current run; the workflow only gained `queue:max`. Current
  evidence does not prove a code defect warranting a timeout increase.
- Canonical reason registry and existing publisher/adapter/SQL contracts are
  retained. No new reason list or permissive exception was introduced.

### Proven 6 Pack cause and minimal correction

Last good run `42205190703` used `b3f9af89a7da408444da0c25a7b2c5f2fd1d235b`;
first observed failing daily run `42361990356` used `9eeddc65...`. Their
`woocommerce-product-page-reader.js`, `six-pack-offer-refresh.js` and 6 Pack
workflow have **no diff**. At16:03:19UTC one bounded existing-reader GET of
`https://6pack-supplements.co.uk/?p=6303` returned200,329744bytes and reproduced
the exact five-Product failure. The site now supplies a buy-box-bound
`application/json#product-variations` block and a heading without the old
`product_title` class; no legacy `data-product_variations` exists. Five
variant-specific JSON-LD Product nodes are not one simple product offer.
No precise retailer deployment time or earlier failure between daily runs is
known. The retained source proves format incompatibility, not a repo merge
regression.

`six-pack-offer-refresh.js#parseSixPackProductPage` reads this format only in
the existing refresh adapter. It requires exact body and buy-box product IDs,
one matching heading, unique variant IDs/options, declared attribute values,
finite positive GBP-source prices, explicit stock booleans and cart quantity
limits. It preserves actual variant IDs and the original HTML hash; missing or
ambiguous values fail closed. Legacy source still uses
`parseWooCommerceProductPage`. The shared reader gains only a parser callback
after existing HTTP/content-type/host/path/size guards; its default parser and
all other retailers remain unchanged. No executor or approval behavior changes.

The reduced public-source fixture
`scripts/test-fixtures/six-pack-theme-product-6303.html` reproduces the same
`SOURCE_SCHEMA_MISMATCH` before the fix and passes after. The untouched retained
capture also passes offline after: variants6305–6309 all£24.99, Pineapple OOS,
the other four in stock. No second external source request was made. Source
SHA256: `c6b6d1d106a7dd7c0bd8e56ee99b0f14d8fb1cd97f58ea67852e75d0f1f994f3`.
Negative cases keep malformed/duplicate/unknown/mismatched data blocked; existing
executor tests retain owner/fingerprint/stale-package/idempotency/timeout
guards. GYM HIGH, Predators mapped capture, 6 Pack legacy and catalogue adapter
tests provide representative unaffected-source coverage.

Focused107 PASS/0SKIP/0FAIL; independent credential-free verification53 PASS.
Quick1020 PASS/3 existing SKIP, full3542 PASS/3 existing SKIP/0FAIL including
lint, TypeScript, baseline and isolated production build. Final SHA CI remains
required before code closeout. Test inventory reviewed:355 file paths and
existing quick/integration/artifact classifications unchanged; tests were added
within existing files, so the path-based manifest seal remains unchanged.
Pre-update Guardian PASS; post-update Guardian and final checks recorded in PR.
Large logs and retained source stay ignored under `tmp/incident-evidence/`;
only the reduced public fixture and this existing ledger are committed.

### Exact subsequent production boundary — not executed

After review and separate owner merge/recovery authorization: merge the exact
verified fix, then authorize one existing `six-pack-offer-refresh.yml`
`workflow_dispatch` with `operation=dry-run` on merged `main`. Its existing
conditions skip baseline/source binding, offer apply, postflight, idempotency
and downstream queue publication: it makes zero business/control writes.
The source binder at workflow line116 and queue job at line188 admit only
`schedule` or `operation=apply`. No workflow dispatch is authorized in this
session, even for this read-only mode; prepare it for the owner's next step.
It fetches the full approved source scope, so one local product replay does not
replace it. Stop for any source/identity/price/stock/fingerprint/guard failure.
Inspect the sealed classification and exact selected variant/offer identities
before any further bounded apply authorization; no old artifact or historical
run is replayable. Existing executor, global/dedicated locks, immutable
checkpoints, postflight and fresh no-op capture remain the recovery path. At an
unknown transaction outcome, inspect existing ledger and actual rows before
deciding; never auto-retry. Source rollback is a reviewed code revert; never
reset business/control tables or seals. A real natural scheduled run and its
postflight later establish scheduled operation, without adding a monitor.

Jon's/Whey require a separately resolved current control-state read permission
gap, then exact parent/child/approval/apply inventory through existing
`retailer-control-plan-recovery.js` discover/preflight. Only a subsequent exact
owner approval may authorize its bounded close; no generic lock release or
batch replay. Fit House requires fresh source/mapping evidence and existing
review policy, not an allowlist bypass. Monitoring fetch/history issues and
review backlog remain distinct; no threshold widening is proposed. This session
performed **zero production business/control writes, zero production workflow dispatches,
zero approvals, zero migration/configuration changes and no merge**. CI-only
dispatches, if performed, are isolated and recorded separately in the PR.

**6 November shared production-write pending-run preservation incident —
`CODE_COMPLETE`:** eleven owner-approved 10 Reps Review Queue decisions each
created the intended exact `workflow_dispatch` run. Two completed, while nine
were cancelled before worker execution because GitHub's default concurrency
behavior retains only one pending run per group and replaces the older pending
run when another arrives. The running workflow remained protected by
`cancel-in-progress: false`; the loss occurred only among waiting runs. The
nine execution-request ledger rows remain `QUEUED`, so no owner approval or
commercial write was lost or falsely marked complete.

The bounded correction keeps the existing global
`retailer-offer-production-write` group and adds GitHub's native `queue: max`
policy to all seven workflows that share it: the Review Queue worker,
publication retry, eBay, Fit House, Jon's, Simply Supplements and Whey Okay.
At most one production-writing workflow still runs at a time, while up to 100
waiting runs are preserved instead of replacing one another. One regression
test enumerates the exact seven-workflow set and requires the same group,
`cancel-in-progress: false` and `queue: max` contract everywhere; focused
workflow and Review Queue tests pass `104/104`.

This changes no worker, scheduler, queue, execution-request ledger, adapter,
retailer logic, approval, revalidation, postflight, idempotency, database or
migration. It creates no execution request or workflow dispatch and does not
replay the nine queued decisions. Their recovery remains separately owner
gated after merge and fresh revalidation. Scheduled Jon's run `42218194836`
started normally and failed independently in its apply step with a PostgreSQL
client timeout; it was not cancelled or replaced by this concurrency incident,
and no retry is part of this change. Pre/post Project Guardian, focused tests
and the local quick and full Quality Gates pass. PR CI, merge and fresh
production evidence remain acceptance gates.

**6 November RA-LEDGER-03 deterministic migration repository closeout —
`CODE_COMPLETE`:** the existing selected-migration lifecycle now derives one
exact post-apply binding from the same shared migration inventory, exclusions,
applied exclusions, ordered pending list and canonical fingerprint algorithm as
the existing pre-apply binding. Pending entries must be uniquely and
deterministically ordered, present, filename-valid and byte-for-byte SHA-bound.
The historical production state deterministically reproduces ledger `259` /
`d21a4044...` plus the exact pending refresh migration as ledger `260` /
`17a00891...`; current STAGING independently derives `120` /
`31dc3e6e...` plus two pending migrations as `122` /
`df0638a3...`. Current PRODUCTION remains closed at `260` / `17a00891...`
with zero pending migrations.

The existing apply path freezes this derivation after preflight and before any
mutation. Rehearsal still rolls back and produces no closeout. A successful
apply still executes every migration body and its `schema_migrations` row in
one existing transaction, then requires exact post-commit count, ordered
identities and fingerprint equality. Only after that equality and the existing
schema/catalogue postflight pass does it write ephemeral
`selected-migration-repository-closeout-v1` evidence under
`tmp/selected-migrations/`. The evidence reports `CLOSEOUT_REQUIRED` and names
only the existing repository transitions: consume the environment pending
list, advance `CONTRACTS.<ENV>.ledgerCount`, and advance
`CONTRACTS.<ENV>.ledgerFingerprint`. It contains no SQL body or credential and
does not edit tracked files, call Git, create a branch/PR, or become runtime
configuration. The existing read-only verifier uses the same derivation and
admits exactly `POST_APPLY_VERIFIED / CLOSEOUT_REQUIRED` or
`CURRENT / ALREADY_CLOSED`.

The lifecycle is therefore:

`PRE-APPLY frozen baseline + pending -> atomic apply -> exact post-commit
readback -> CLOSEOUT_REQUIRED evidence -> repository-only closeout PR -> merge
-> CURRENT / ALREADY_CLOSED`.

Ordinary retailer packages and `validateSelection()` retain one repository
binding and remain fail-closed during the short closeout window; no second
runtime state is accepted. No ledger, registry, selector, table, source of
truth, retailer exception, worker path, Review Queue behavior, workflow or
production/staging data changed. Focused lifecycle, selector, canonical
fingerprint and shared-binding tests pass `122/122`; pre-documentation Project
Guardian passes. This code/test/docs task applied no migration and made zero
database or workflow writes. Final local gates, PR CI and merge evidence are
the remaining acceptance gates.

**6 November owner-authorized Review Queue fallback cadence reduction and
stagger correction — `CODE_COMPLETE`:** after the existing server-side
immediate dispatcher was enabled, the owner explicitly selected a 30-minute
fallback because a five-minute recovery window is not operationally required.
The first implementation changed the one existing
`automation-review-queue-worker.yml` schedule from `*/5` to `*/30`. Neither
the `10:30` nor `11:00` UTC target produced a run by `11:22` UTC after merge.
Read-only history also showed that the earlier five-minute schedule was
delivered only intermittently and that ordinary daily workflows can be created
hours after their cron target; for example, 6 Pack run `42205190703` was
created at `10:46` UTC for its `03:17` UTC schedule. GitHub documents scheduled
events as delayable and droppable under load and recommends a different time
of the hour.

The owner therefore authorized the smallest bounded correction: keep exactly
the same 30-minute cadence but stagger it to `8,38 * * * *`. This avoids the
high-contention `:00` and `:30` targets and does not claim a GitHub delivery
SLA. Exact `workflow_dispatch` by `execution_request_id`, the shared worker,
execution-request ledger, adapter registry, revalidation, postflight,
idempotency and concurrency group are unchanged. No second scheduler, worker
or queue is introduced.

The existing read-only watchdog policy now declares the real 30-minute
cadence. A newest scheduled run aged at most 60 minutes is `HEALTHY`, more than
60 through 120 minutes is warning-only `DELAYED`, and more than 120 minutes is
`BROKEN`. Manual dispatches still cannot establish scheduler health. This
prevents the new normal cadence from producing false delay warnings while still
detecting four missed fallback windows. Focused workflow/hash and exact
30/60/61/120/121-minute liveness tests pass `16/16`; pre-change Project
Guardian passes. This repository-only change creates no execution request,
workflow dispatch, Review Queue or database write. Local quick/full Quality
Gates and the production build pass. PR CI, merge and the first ordinary
staggered 30-minute scheduled run remain acceptance evidence; no synthetic
worker dispatch is authorized.

**5 November RA-SCHED-01 Review Queue worker scheduler liveness —
`READY_FOR_NATURAL_VERIFICATION`:** the existing shared Automation Reliability
Watchdog now has one declarative global platform check for
`automation-review-queue-worker.yml`. It queries only the newest GitHub Actions
run whose event is `schedule`; manual `workflow_dispatch` runs never establish
scheduler health. The five-minute cadence is `HEALTHY` through 20 minutes,
`DELAYED` after 20 through 60 minutes and `BROKEN` after 60 minutes or when no
scheduled run/workflow can be resolved. `DELAYED` is warning-only. `BROKEN`
adds global `REVIEW_QUEUE_WORKER_SCHEDULE_BROKEN` and derives the existing
`FAILED_SYSTEM` monitor status without changing any retailer result. GitHub API
or monitoring-infrastructure errors remain separately fail-closed as
`MONITORING_INFRASTRUCTURE_ERROR` and are not relabelled as scheduler failures.
The report and workflow summary expose status, last scheduled run and age.
Focused watchdog tests pass `64/64`, including exact 5/20/21/60/61-minute
boundaries, manual-run exclusion, unavailable workflow, API failure, retailer
isolation and zero-write evidence. Pre/post Project Guardian, TypeScript,
ESLint, the quick and full Quality Gates and the isolated production build all
pass. This bounded incident change adds no
scheduler, worker, queue, service, request path, production credential or
database write and does not alter the active Gladiator adoption scope. Final
acceptance is the first ordinary watchdog schedule after merge; a manual
watchdog dispatch is explicitly excluded.

**5 November shared production migration-ledger regression — repository
correction ready for verification:** production readback proves ledger `260`
with fingerprint
`17a00891dff4e0a4f53050a018594fd505aa0aabc02b5281580b42895d7fd61e`,
including both November Review Queue migrations. Main still treated
`20261105100000_refresh_pending_review_execution_binding.sql` as production
pending and therefore sealed a 259-entry binding into the unrelated KIOR,
Discount Supplements and Gladiator packages. Their retained diagnostics all
failed closed at the shared validator with `RSBI_SOURCE_HASH_MISMATCH` and zero
writes. The bounded correction removes only that stale PRODUCTION pending
state, updates the frozen production count/fingerprint and preserves both
migrations as pending in STAGING. It adds no SQL, retailer exception or
validation bypass. Focused selector, fingerprint and three-retailer tests pass;
live readback now has zero identifier drift. Local retailer dry-runs stopped at
source HTTP `429` before validation and made zero writes, so final-main hosted
dry-runs remain the acceptance canaries. The separate Review Queue scheduler
audit found no repository regression; missing scheduled run records and the
manual HTTP `500` remain an external GitHub scheduling/API incident. Evidence:
[`production-migration-ledger-retailer-automation-regression-2026-11-05.md`](../rollouts/production-migration-ledger-retailer-automation-regression-2026-11-05.md).

**4 November Review Queue hard-price contract incident — repository correction
prepared, production migration pending:** audit PR `#476` confirmed that the
eBay producer and protected worker supported `HARD_PRICE_ANOMALY`, while the
JavaScript publisher, SQL publication function and eBay adapter omitted it.
The bounded correction adds one canonical reason registry, aligns the publisher,
restricts the reason to eBay's existing `UPDATE_PRICE` adapter path and prepares
the hash-bound forward migration
`20261104120000_allow_automation_review_hard_price_anomaly.sql`. Worker hard-price
identity, state, threshold and protected price-history checks remain unchanged.
The exact failed-batch-shaped fixture and JS/SQL drift regressions pass with zero
writes. The migration is pending for both environments and has not been applied;
run `41836635201` and its historical 85 rows were not replayed. This incident
does not change the sole active Gladiator preparation task, reopen RA-004 or
authorize a retailer run. Evidence:
[`automation-review-hard-price-contract-fix-2026-11-04.md`](../rollouts/automation-review-hard-price-contract-fix-2026-11-04.md).

RA-004 is now `BLOCKED`. It may reopen only as artifact-first recorded replay:
the same immutable snapshot must be evaluated by the current and candidate
classifiers with zero network, control or business writes. Another staging
credential, migration activation, live control-state export, canary, shadow
run, cutover or retry is not authorized by this reset.

See
[`evidence/RA-STABILIZATION-RESET-2026-09-29.md`](evidence/RA-STABILIZATION-RESET-2026-09-29.md).

**26 October Gladiator shared-pipeline adoption preparation — local evidence
ready for Draft PR:** the fresh read-only production scope contains exactly
`603` existing mappings and `603` offers for retailer `15`; the deterministic
approved manifest SHA-256 is
`f07122185a4d601e9e4172378d2fcf6636e5ab1833c33c749f69bccd3fcd8078`.
The prepared profile reuses the current Shopify reader, classifier, mixed-batch
executor, atomic importer, Review Queue, postflight and watchdog. It adds no
catalogue identity and excludes all `249` unmapped source variants. The only
shared behavior correction is in the existing Review Queue publication profile:
a correctly quarantined `UPDATE_PRICE_AND_STOCK` row is now normalized by the
same generic commercial-row contract while independent safe siblings remain
executable. The exact 10 Reps mismatch is a regression fixture. The thin
registration migration is pending once from STAGING ledger `118` and PRODUCTION
ledger `253`; local PostgreSQL forward/rollback rehearsal preserves the source
function, exact security properties and zero business writes. The workflow
exposes Gladiator only as manual `dry-run` shadow; schedule/apply remains
disabled. Next gate after review is a separately authorized STAGING migration
and shadow proof. Branch: `automation/gladiator-shared-pipeline-adoption`.

**15 October post-closeout mixed-partition incident — verified complete:**
ordinary shared run `38532219108` captured a healthy 10 Reps source and produced
`917` executable rows plus `33` review rows across the unchanged `950`-offer
scope. The review scope contained `22` source-missing identities isolated before
classification and `11` `MASS_OOS` stock transitions isolated by the classifier.
The existing source binder failed closed before apply because it supported only
classifier coverage of the executable scope or the complete approved scope, not
this exact mixed boundary. Fit House completed normally in the same workflow.
The correction adds the missing common mixed-partition contract, reuses the
existing identity and stock review-card contracts, and removes the unused
`maximumReviewCount` profile fields. It adds no importer, publisher, executor,
retailer branch in shared core, database write or guardrail exception. The exact
retained production artifact now binds locally as `917 + 33`, with zero
catalogue writes. PR `#336` merged as `e30b8859731d81662ba15336d78bc2dbf1968cf7`;
its PR and main full quality gates passed. The next natural scheduled run
`38700695612` on merge commit `94c7f2e12971f292037a49f1b7fd6f0c167eeb01`
then passed the complete 10 Reps path: `917` guarded executions, the exact `22`
`SOURCE_VARIANT_MISSING` plus `11` `MASS_OOS` review partition, zero blocked
rows, green DB postflight, green zero-write idempotency and successful Review
Queue publication. The apply made three bounded stock updates and `917`
freshness updates, with zero price, shipping or URL changes. The queue created
`33` current cards, superseded `22` stale cards and made zero catalogue writes.
Following scheduled watchdog `38726464998` correlated that exact run, returned
10 Reps as `PASS_WITH_REVIEW` with a passing scope partition and no failures,
and made zero database writes. Its aggregate failure is solely the separately
classified Simply Supplements source-feed omission (`REVIEW_SCOPE_DRIFT`). No
manual dispatch, retry, baseline widening, direct database write or new runtime
was used. RA-STAB-02 is `VERIFIED_COMPLETE`.
Evidence:
[`evidence/RA-STAB-02-ORDINARY-CLOSEOUT-2026-10-15.json`](evidence/RA-STAB-02-ORDINARY-CLOSEOUT-2026-10-15.json).

**13 October ordinary observation closeout — verified complete:** the affected
Whey Okay and shared Fit House/10 Reps guarded paths completed three consecutive
ordinary scheduled intervals on 11, 12 and 13 October. Their six source runs
passed capture/dry-run, Review Queue source binding, guarded apply, database
postflight, fresh idempotency capture and queue publication. The three following
scheduled watchdogs inspected all 12 retailers, reported zero failed systems
and made zero database writes. The final result is `PASS_WITH_REVIEW`: current
review work and classified monitored backlog remain visible and do not need to
be cleared to satisfy stabilization. No manual run, retry, replay, baseline
widening, manually initiated production write or runtime change was counted. RA-STAB-01 is
`VERIFIED_COMPLETE` at `3/3`; RA-004 remains `BLOCKED` and is not reopened by
this closeout. Evidence: [three-interval closeout](evidence/RA-STAB-01-THREE-ORDINARY-INTERVAL-CLOSEOUT-2026-10-13.json).

**10 October shared execution/review partition incident — correction prepared:**
ordinary shared run `38039918378` captured a healthy Fit House source and
correctly produced `275` executable confirmations plus `11` isolated review
rows across the immutable `286`-offer scope. It failed closed before apply at
the Review Queue source-binding step because that shared publisher expected the
isolated rows inside the executable classifier's changed-row evidence even
though the previously corrected shared partition had intentionally removed
them. The correction establishes one complete isolated-review report contract
between those existing components and validates identity, baseline price,
unchanged price and the exact stock transition before publication. It contains
no retailer branch in shared core, new path, limit change or database write.
The exact incident and canonical review-row regressions pass in the `103`-test
focused suite; `verify:quick` and the pre-change Project Guardian also pass.
Merge, CI and one fresh guarded live proof remain required. That proof will not
rewrite the failed scheduled interval or advance the `0/3` ordinary counter.
Evidence:
[`evidence/RA-STAB-01-SHARED-REVIEW-SOURCE-PARTITION-CONTRACT-PREPARATION-2026-10-10.json`](evidence/RA-STAB-01-SHARED-REVIEW-SOURCE-PARTITION-CONTRACT-PREPARATION-2026-10-10.json).

**10 October shared partition live proof — complete; ordinary observation
pending:** PRs `#331` and `#332` merged the common contract correction. Fresh
attempt `38049959238` failed closed before apply and proved that the current
review partition contains ten owner-deferred stock rows plus one independently
isolated `MASS_OOS` row. The second correction validates that distinction and
requires `MASS_OOS` to remain an exact available-to-unavailable stock-only
transition. Run `38050504732` then completed Fit House capture, source binding,
`275` safe executions, DB postflight, fresh idempotency capture and publication
of all `11` review cards. No price, stock, URL or business price-history value
changed; `249` daily confirmation rows record freshness only. Queue publication
created `11`, superseded `7` stale approved cards and made zero catalogue
writes. Fresh KIOR run `38051144358` completed all `11` confirmations with
green postflight, zero commercial changes and zero-write idempotency. Watchdog
`38050909298` was read-only and correlated the current Fit House success, while
correctly preserving the failed scheduled attempt and review-backlog growth; it
preceded the KIOR proof. Manual success is live acceptance, not an ordinary
schedule interval. RA-STAB-01 remains `IN_PROGRESS` at `0/3`. Evidence:
[`evidence/RA-STAB-01-SHARED-REVIEW-PARTITION-LIVE-PROOF-2026-10-10.json`](evidence/RA-STAB-01-SHARED-REVIEW-PARTITION-LIVE-PROOF-2026-10-10.json).

**Allowed statuses:** `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`,
`READY_FOR_VERIFICATION`, `READY_FOR_REVERIFICATION`, `VERIFIED_COMPLETE`

Only one RA task may be active. Task numbering for retailer migrations is an
inventory key, not an approved execution sequence. No task may become
`VERIFIED_COMPLETE` without the listed local and live evidence.

## Common evidence fields

Every task records:

- commit SHA:
- PR:
- GitHub run ID(s):
- artifact ID(s), digest(s) and retained path(s):
- local verification:
- production readback:
- owner approval reference:
- rollback result:

## RA-STAB-02 — 10 Reps mixed Review Queue partition incident

**Status:** `VERIFIED_COMPLETE`

**Goal:** restore the existing common Review Queue source binding when one
ordinary run contains both pre-classifier source-missing rows and
classifier-isolated policy rows, without changing the approved execution scope
or adding a second mechanism.

**Scope:** common publication-profile validation, the existing shared source
binder, an exact incident regression, ordinary scheduled verification and the
following watchdog correlation.

**Out of scope:** manual retailer retry, manual apply, baseline widening,
identity decisions, new approval/publisher/executor paths, RA-004 replay,
migration activation and direct database writes.

**Completion evidence:** natural scheduled run `38700695612` completed source
binding, `917` guarded executions, read-only DB postflight, fresh zero-write
idempotency and Review Queue publication for the exact `917 + 22 + 11`
partition. Artifact `11956278531`, digest
`sha256:19e63d55a9ef7ad3d0f415e5f3b8da2d87c24a6eb6e5c39bbd2b90d0f7fc3305`,
records zero blocked rows, three stock updates, `917` freshness updates and no
price, shipping or URL changes. Queue artifact `11957005590`, digest
`sha256:03bb26438088e240eb66e48102a2507a93a5011507fe6c2d53aa3c01c08fb074`,
records `33` created cards, `22` superseded cards and zero catalogue writes.
Following scheduled watchdog `38726464998`, artifact `11968533175`, correlated
the exact run with a passing full-scope partition and no 10 Reps failures. Its
only failed retailer is Simply Supplements for the already classified exact
source-feed omission. The closeout used no manual run, retry, baseline widening,
direct database write or new mechanism. Full evidence:
[`evidence/RA-STAB-02-ORDINARY-CLOSEOUT-2026-10-15.json`](evidence/RA-STAB-02-ORDINARY-CLOSEOUT-2026-10-15.json).

**Next bounded step:** do not reopen RA-STAB-02 for expected review-backed
backlog warnings. RA-004 remains blocked and no retailer-consolidation task is
active. Return to the Operating Plan sequence: prepare the separately
owner-approved GYM HIGH participation in SEO-15 through the existing bounded
source-release mechanism and its own guarded evidence.

## RA-STAB-01 — Existing-path production stabilization

**Status:** `VERIFIED_COMPLETE`

**Owner decision:** explicit instruction on 29 September 2026 to stop further
RA-004 live retries, preserve completed evidence, stabilize the existing
production paths without retailer-specific patches, and resume consolidation
only through recorded replay.

**Goal:** establish one current, evidence-backed production state; recover
existing paths through their current guarded mechanisms; and prove ordinary
operation without adding a retailer branch, parallel pipeline or new writer.

**Scope:** the current watchdog inventory and existing workflows; read-only run
and artifact evidence; active-plan/session classification; source-health,
fingerprint and evidence-correlation incidents; already-approved recovery
mechanisms; shared regression fixes only when a repeated incident proves a
general contract defect.

**Out of scope:** another RA-004 activation, staging or production migration,
new credential or role, live shadow, Model B activation, cutover, retailer
migration, catalogue identity decision, commercial approval, baseline widening,
new importer/executor and direct database write.

**Execution order:**

1. Capture one fresh read-only watchdog and the latest ordinary workflow
   artifacts. Record the observation time because later successful runs may
   supersede an earlier watchdog.
2. Classify every non-green retailer as `SOURCE`, `CONTROL_LIFECYCLE`,
   `FINGERPRINT_OR_IDENTITY`, `EVIDENCE_CORRELATION`, `MONITORED_DEBT` or genuine
   `FAILED_SYSTEM`. Do not infer OOS, identity or price from a failure.
3. Resolve one dependency class at a time using an existing recovery mechanism.
   A production/control write, approval or migration requires a separate exact
   owner authorization and is not implied by this task.
4. If code is necessary, first add the incident as a common-harness regression.
   The fix must be retailer-neutral, preserve every guard and avoid a new entry
   point. A retailer-specific condition stops the task for design review.
5. Require three consecutive ordinary schedule intervals with no unexplained
   result, plus event coverage or recorded replay for every affected class.
6. Close with a fresh watchdog, correlated evidence, exact remaining monitored
   debt and zero-unrelated-change proof. Only then decide whether artifact-first
   RA-004 may reopen.

**First checkpoint — complete:** documentation reset and current-state read-only
capture. Watchdog run `36564343116`, generated
`2026-09-29T11:51:54.990Z`, inspected all 12 configured retailers, reported six
failures and made zero database writes. The classified inventory and retained
artifact digest are recorded in
[`evidence/RA-STAB-01-CURRENT-STATE-2026-09-29.md`](evidence/RA-STAB-01-CURRENT-STATE-2026-09-29.md).

**Current bounded step:** observe the recovered ordinary paths; no retailer
refresh, retriever retry, business write or RA-004 replay is authorized. The
shared ambiguous-registration diagnostic fix is verified. The 10 Reps
failure is reproduced: run `36400487268` registered a control plan and then
timed out during parent approval; the next run correctly blocked the duplicate.
The shared engine now retains exact registered parent/child identity before the
next boundary and reports an unknown parent-approval outcome explicitly. Its
focused 39-test suite, repository quick gate and full gate pass. The separately
authorized production readback at `2026-09-29T12:54:55.079Z` proved that one
expired 10 Reps parent is the sole global parent blocker: parent `APPROVED`, one
child `APPROVED`, 18 children `PLANNED`, one expired unconsumed batch approval,
zero apply runs and zero business writes. Whey Okay has no active parent of its
own; its legacy RPC is blocked by that global parent count. The existing expired
approval close RPC was not safe for this multi-child state because it closed only
the approved child and parent, leaving 18 planned children. A retailer-neutral
forward migration now extends that same RPC and approver role to atomically
expire the entire wholly unexecuted sequential tree. It is SHA-bound and
excluded from both normal selectors. Its isolated PostgreSQL regression passes
for 19 children, replay, sibling-state rejection and zero business writes. No
deployment, ledger mutation, approval, replay or expiry is authorized.

Fresh production readback at `2026-09-29T14:15:21.462Z` also resolved a stale
repository selector baseline: the already-applied Fit House parent-approval
migration is ledger row 222. Production reports canonical fingerprint
`c08b5f2e704072a0e4b2590688998e07a781f8699546279b6e81acd9c975c0fe`,
which exactly matches the fingerprint stored by the interrupted 10 Reps
approval. The repository selector is aligned to that readback with no ordinary
pending production migration; the sequential-close migration remains excluded.
A separate activation preparation is `NOT_AUTHORIZED`. A thin operational
coordinator now prepares, but does not grant, the two recovery phases. It
reuses the existing selected-migration helpers and existing
`close_expired_retailer_offer_sync_approval(jsonb)` RPC; it contains no
retailer-specific condition and no business-table writer. `schema-deploy` and
`control-close` each require their own exact, short-lived owner-authorization
artifact and confirmation. There is no combined mode, automatic retry or
automatic transition between phases. Read-only `schema-verify` and
`control-verify` remain independently repeatable. The current preparation
cannot execute either write phase, and no credential is read until the
phase-specific authorization has passed locally.

**Prepared command boundary — not execution authority:**

- `node scripts/ra-stab-01-production-recovery.js --phase=status` validates the
  tracked preparation and migration SHA locally and reports `NOT_AUTHORIZED`;
- a later separately approved schema phase may apply only the exact excluded
  migration against ledger row 222 and must commit ledger row 223 with zero
  business-count delta, followed by an independent read-only verification;
- only after that evidence and another separate owner decision may the control
  phase call the existing approver RPC for the exact 10 Reps parent, 19-child
  manifest and expired unconsumed approval;
- no command here authorizes a retriever retry, retailer refresh, offer apply,
  price-history write, identity change, RA-004 replay or next phase.

**Schema phase — complete:** after PR `#146`
merged as `1e635a6da8565bfeba300b3f5b0d96d30320fb59`, the owner separately
authorized only `SCHEMA_DEPLOYMENT`. The one-shot coordinator applied excluded
migration `20260929133000_extend_expired_sequential_plan_close.sql` at SHA-256
`b0a4cac2d9c30989f00570bf1c63036daf190fffbcc7b08b17c616761bc6a380`.
The transaction moved the production ledger from 222 / `c08b5f2e...c0fe` to
223 / `c891240d...c7b0`. Its committed postflight and a separate read-only
`schema-verify` both passed; products `1337`, variants `3632`, mappings `3758`,
offers `3758` and price history `24583` were unchanged. The deployed ledger
statement bytes match the reviewed migration and the existing close RPC is
present. No control plan, approval, product, variant, mapping, offer or price
history row was changed. The schema authorization is consumed and cannot grant
another phase. Evidence:
[`evidence/RA-STAB-01-PRODUCTION-SCHEMA-DEPLOYMENT.json`](evidence/RA-STAB-01-PRODUCTION-SCHEMA-DEPLOYMENT.json).

**Control recovery — complete; observation pending:** after independent schema
verification, the owner separately authorized exactly one `CONTROL_RECOVERY`
attempt for the bound 10 Reps parent, 19-child manifest and expired unconsumed
approval. The existing close RPC completed at `2026-09-29T15:38:23.742118Z`.
It expired the approval, parent and all 19 children: 21 control writes, zero
business writes, zero price-history writes, zero apply runs, zero row approvals
and zero recovery records. A separate read-only `control-verify` passed with all
19 children `EXPIRED`. Products `1337`, variants `3632`, mappings `3758`, offers
`3758` and price history `24583` remain unchanged. The authorization is consumed
and grants no retailer refresh, retriever retry or RA-004 replay. Evidence:
[`evidence/RA-STAB-01-PRODUCTION-CONTROL-RECOVERY.json`](evidence/RA-STAB-01-PRODUCTION-CONTROL-RECOVERY.json).

The sole global active-parent blocker is therefore closed. RA-STAB-01 remains
`IN_PROGRESS`: next capture a fresh read-only watchdog, then require three
ordinary schedule intervals and correlated evidence before closeout. Do not
manufacture those intervals by manually retrying a retailer.

**Immediate post-recovery watchdog — baseline recorded:** run `36592696720`
executed from `main` commit `07fea3e9bf38a67a1457ef65dfbaf2c8f9277455`
through the existing `production-readonly` workflow. It inspected all 12
retailers at `2026-09-29T15:46:28.977Z`, made zero database writes and reported
no global failure. Its overall result remains `FAIL`: six retailer results are
still based on stale, backlog-growth or unrelated execution evidence that
predates the control close. The run is the honest post-recovery observation
baseline, not proof of three ordinary intervals and not evidence that the close
regressed. No retailer was manually retried and no monitored baseline was
widened. Evidence:
[`evidence/RA-STAB-01-POST-RECOVERY-WATCHDOG-2026-09-29.json`](evidence/RA-STAB-01-POST-RECOVERY-WATCHDOG-2026-09-29.json).

The next bounded step is observation only: correlate the next ordinary daily
retailer schedules and the six-hour watchdog. Count an interval only when its
own capture, apply and postflight artifacts satisfy the existing contract. Do
not count this immediate watchdog as an ordinary retailer interval and do not
substitute a manual dispatch for missing ordinary evidence.

For the affected paths, the three cron targets are Whey Okay at `02:17` UTC and
shared refresh / 10 Reps at `02:47` UTC on 30 September, 1 October and 2 October
2026. These are schedule targets, not assumed start times: on 29 September
GitHub delivered the corresponding runs only at `08:35` and `09:03` UTC. For
each date, correlate the pair with the first ordinary six-hour watchdog that is
generated after both workflows have reached a terminal state. A watchdog that
precedes either delayed workflow does not count. If an ordinary run again
reports an active-plan or control-lifecycle block, stop and classify it as a
regression; otherwise retain its exact run, artifact, postflight and idempotency
evidence.

**Evidence-preservation audit — complete, replay bundle incomplete:** while the
ordinary schedules are pending, a read-only repository audit sealed the current
RA-000–004 evidence inventory. RA-000–003 decisions and local deterministic
fixtures are reconstructable. The terminal RA-004 closeout, selector closure,
two credential revocations, five allowed source-observation evidence writes and
zero business/control-canary mutations are tracked. Four private artifacts are
preserved only by SHA-256 without a retrievable locator, however, and there is
no current immutable 10 Reps raw snapshot, paired legacy/canonical output or
950-row parity bundle. They are explicitly `DIGEST_ONLY_NOT_RETRIEVABLE` or
`MISSING_REQUIRED_FOR_REPLAY`, not claimed as preserved replay inputs. This
audit neither reopens RA-004 nor authorizes a capture. Evidence:
[`evidence/RA-STAB-01-EVIDENCE-PRESERVATION-AUDIT.json`](evidence/RA-STAB-01-EVIDENCE-PRESERVATION-AUDIT.json).

**First ordinary observation - failed safe; shared ledger correction in
progress:** the 30 September scheduled Whey Okay run `36690863083` and shared
refresh run `36693313942` both stopped before apply, postflight and idempotency.
They made zero database writes, zero control writes and created or consumed zero
approvals. The previous active-plan/control-lifecycle blocker did not recur.
Because the required capture/apply/postflight contract was not satisfied, this
observation does not count: RA-STAB-01 remains at `0/3` consecutive ordinary
intervals.

The observation exposed one bounded shared defect caused by the completed
recovery: production correctly contains the verified 223-row ledger, while the
ordinary production selector still expected the pre-recovery 222-row ledger.
The 10 Reps validator therefore stopped with `RSBI_SOURCE_HASH_MISMATCH`. The
central correction binds the selector to the verified row 223 fingerprint and
records the recovery migration as applied but still excluded; ordinary pending
migrations remain empty. It adds no retailer condition, entry point or writer
and weakens no guard. The simultaneous `MASS_OOS` result remains authoritative
and must be evaluated independently after this validator mismatch is removed.

Whey Okay separately stopped on its existing mapped-fingerprint-row invariant,
and Fit House stopped on its six-offer fingerprint invariant. The first
watchdog after both workflows, run `36714749305`, made zero writes and still
selected older successful evidence rather than these failed diagnostics. Those
fingerprint and evidence-correlation classes are preserved as separate debt;
they are not folded into the ledger fix. Evidence:
[`evidence/RA-STAB-01-ORDINARY-INTERVAL-01-2026-09-30.json`](evidence/RA-STAB-01-ORDINARY-INTERVAL-01-2026-09-30.json).

The three-interval sequence restarts only after the shared correction is merged
and an ordinary scheduled run executes that commit. Do not use a manual dispatch
to manufacture an interval and do not weaken `MASS_OOS` or either fingerprint
invariant to make a run green.

**Fingerprint/identity audit - bounded causes separated:** the Whey Okay source
snapshot from run `36690863083` is healthy and was reproduced read-only with the
same semantic fingerprint. Exactly 10 of 589 approved identities are absent,
all from the old PER4M 2 kg family. The source now exposes a rebuilt 2.01 kg
family under 29 new variant IDs without GTIN evidence, so no automatic rebind is
allowed. Missing-row isolation was already correct; the adapter interaction was
not. When `MASS_OOS` requested a second capture, it fingerprinted all 589 records
and converted the 10 review-only absences into `INTERNAL_ERROR`. The bounded
correction fingerprints the 579 matched records and independently requires the
same exact 10-key missing scope in both captures. Any commercial or scope change
fails closed as `SOURCE_SCOPE_DRIFT`. It changes no threshold, mapping, shared
classifier or write path and has a regression for stable and changing scope.

Fit House is a different identity decision, not the same code defect. Its source
fingerprint has been stable at `8074eefe...e991` since 24 September. Protected
variant `46969725714672`, offer `759` (7Nutrition Vegan Berberine Stack at
`GBP 11.99`), has genuinely returned available with consistent identity; the
other six protected identities remain absent. The prior absence authorization
cannot decide a return to stock. On 1 October the owner authorized exactly offer
`759` to return from OOS to in stock, with price `GBP 11.99`, mapping `873`,
canonical product/variant `740/3021`, source product/variant
`9168824172784/46969725714672` and URL unchanged; the other six protected offers
must remain OOS and any other change must stop before registration. The bounded
edge-coordinator correction records that decision in one immutable SHA-bound
manifest and generalizes the existing protected-stock selector from a hardcoded
OOS direction to the exact authorized transition. It adds no workflow, shared
classifier branch, threshold, mapping, approval path or writer. Local focused,
quick and full gates pass. Production remains unchanged until the change is on
`main` and a fresh protected preflight agrees. Evidence:
[`evidence/RA-STAB-01-FIT-HOUSE-759-RETURN-2026-10-01.json`](evidence/RA-STAB-01-FIT-HOUSE-759-RETURN-2026-10-01.json).

The merged implementation passed CI and reached `main` as `e1178542`. The fresh
production dry-run `36829215331` then failed closed before registration with
`FIT_HOUSE_SIX_SCOPE_MISMATCH`: source health passed at 242 products / 338
variants and the stable fingerprint `8074eefe...e991`; offer `759` matched the
authorized return exactly, but the full 286-offer classification contained 14
additional stock changes outside that authority. Artifact `11146044349`, digest
`sha256:48a7a9c59b860e74e03af1aaf6da40243b16bcbbee2e53146ebd0bc7a87fa962`,
records zero control/business writes and zero approvals. Apply, postflight and
idempotency did not run. No retry or isolation patch is authorized: executing
only `759` while placing the other 14 rows into review is a new owner-scope
decision. This manual preflight does not count toward the `0/3` ordinary
interval requirement.

The owner then explicitly authorized the isolated form: execute only offer
`759`, include 19 commercially unchanged freshness confirmations, leave the
exact 14 observed stock differences without writes and expose them as review.
The decision is byte-bound in
`config/retailers/fit-house-owner-approved-return-isolation-2026-10-01.json`
with SHA-256 `b696f4b0...2153`. The existing edge selector now consumes the raw
`MASS_OOS` only when all 14 offer/mapping/source identities, prices and stock
directions match that manifest. It quarantines those rows as
`OWNER_DEFERRED_STOCK_REVIEW`, proves none entered the execution artifact, and
selects only `759` plus 19 unchanged confirmations. Any extra/missing row,
direction, price, URL, identity or protected-offer drift stops before
registration. Replay after `759` is in stock produces zero artifacts while
retaining the 14 review rows. The shared classifier, thresholds, workflow,
registration, validator, approver and executor are unchanged; focused, quick
and full local gates pass. Production remains unchanged pending merge, CI and a
fresh main-only preflight.

That main-only preflight ran as `36833083890` on commit `5c761327`. The
isolation contract itself passed exactly: the classifier reached
`DRY_RUN_READY_WITH_REVIEW`, selected only offer `759` plus 19 freshness-only
confirmations, and retained precisely the 14 authorized deferred offer IDs.
The read-only database validator then rejected the artifact before registration
with `RSBI_SOURCE_HASH_MISMATCH`; there were zero approvals and zero control or
business writes. Root cause was central contract drift left by the prior ledger
repair: the selector correctly expected production ledger `223` / `c891240d...`,
while runtime artifacts still excluded the already-applied sequential-close
recovery and emitted ledger `222` / `c08b5f2e...`. The correction moves
applied-excluded and pending migration state into one shared policy consumed by
both runtime and selector, with exact production and staging parity regressions.
It adds no Fit House condition, SQL migration, approval path or writer. No
further production retry is allowed until that central correction passes all
gates and reaches `main`.

The central correction passed local full/project gates and CI and reached
`main` as `8d40cd3` in PR `#161`. Fresh dry-run `36835231701` then passed the
read-only validator with the exact 20-row execution scope and 14-row review
scope, making zero writes. The separately authorized apply `36835371096`
completed with `PASS_WITH_REVIEW`: offer `759` alone changed stock from false to
true, 19 other offers changed only `last_checked_at`, and the exact 14 deferred
offers received no writes. Price, shipping, delivered total, offer URL, mapping
URL and mapping timestamp deltas were zero; products, variants, mappings and
offers stayed at `1337/3632/286/286`. Postflight passed with one stock change,
20 freshness confirmations, zero commercial price-history delta and 20 daily
confirmation rows. A fresh-source idempotency pass produced no artifact or
write for `759` and retained only the same 14 review rows. Evidence artifact
`11149245887` has digest `sha256:84baa9cb...f646d`. This owner-authorized manual
operation is closed but does not count toward the ordinary `0/3` interval
requirement. The next implementation is the central read-only watchdog
correlation correction already identified below.

The same audit confirmed that the watchdog currently reports only successful
stage evidence and may combine ordinary stages from older different runs. Direct
failed-run artifacts remain authoritative, but the watchdog cannot be the final
RA-STAB closeout proof until `latest_attempt` is separated from
`last_complete_success` and ordinary cross-run stitching is forbidden. That is
the next shared read-only implementation after the fingerprint class. Evidence:
[`evidence/RA-STAB-01-FINGERPRINT-IDENTITY-AUDIT-2026-10-01.json`](evidence/RA-STAB-01-FINGERPRINT-IDENTITY-AUDIT-2026-10-01.json).

**Watchdog correlation correction - live verified; ordinary debt exposed:**
the shared watchdog now builds one retailer attempt from one exact job and one
workflow run instead of selecting successful steps independently. It reports
`latest_attempt`, `last_complete_success`, `latest_ordinary_attempt` and
`last_complete_ordinary_success`; a newer failure therefore remains visible
while an older complete success remains historical evidence only. Configured
idempotency is part of the same-run success contract. Manual dry-runs remain
visible as read-only completions but cannot become ordinary intervals or replace
the last completed apply. The Fit House and 10 Reps jobs are isolated inside
their shared workflow by exact step and job identity. Generic cross-run
stitching is rejected; only the existing exact eBay `split-run-v1` attestation
remains available. Workflow history now reads up to 100 completed runs and
emits `WORKFLOW_HISTORY_TRUNCATED` rather than silently accepting an incomplete
window. Focused 36/36 tests, quick gate, full gate, Project Guardian and the
production build pass. No workflow, importer, approval path, writer, monitored
baseline or retailer condition was added. The next gate is merge and one fresh
read-only watchdog from `main`; it may expose real historical failures and must
not be made green by widening baselines or manually retrying retailers.
Evidence:
[`evidence/RA-STAB-01-WATCHDOG-CORRELATION-2026-10-01.json`](evidence/RA-STAB-01-WATCHDOG-CORRELATION-2026-10-01.json).

PR `#163` passed CI and merged as `e170977`. The first read-only production
watchdog on that commit, run `36838647202`, made zero database writes, reported
no global infrastructure failure and correctly failed rather than absorbing the
new latest-attempt/idempotency reasons into monitored backlog. Artifact
`11150815207`, digest `sha256:1408e00e...f0a80`, reports 10 failed retailers.
It also exposed one remaining freshness gap in its own GitHub evidence reader:
Fit House resolved `35725377626` instead of the known successful apply
`36835371096`, while 10 Reps resolved ordinary run `35702168708` instead of
known failed scheduled run `36693313942`. Direct readback confirms both newer
runs contain the exact configured profile steps. The result is therefore a
fail-closed diagnostic, not final RA-STAB evidence and not authority for a
retailer retry.

The shared follow-up forces GitHub API cache revalidation, records the newest
listed workflow and scheduled runs, a bounded list of unmatched jobs and the
total scanned run count. If the newest listed schedule does not resolve to the
newest retailer profile attempt, the watchdog now emits
`LATEST_ORDINARY_PROFILE_ATTEMPT_UNRESOLVED` instead of silently using an older
attempt. Focused regressions pass 38/38. This remains read-only and adds no
retailer branch, baseline exception, workflow or writer. Quick/full gates,
merge and a second read-only production watchdog are the next gates; the
ordinary counter remains `0/3`.

PR `#164` merged the freshness diagnostics as `34dff001`. The second read-only
watchdog, run `36840586622`, again made zero writes and had no global failure.
Artifact `11151312806`, digest `sha256:814612f1...a84e2`, proved the transport
issue precisely. The first fetch of the shared workflow resolved Fit House to
latest apply `36835371096` and ordinary run `36693313942`. The later independent
fetch for 10 Reps returned an older listing headed by `35702168708`. Both
profiles were therefore internally consistent with different API snapshots,
which is not acceptable evidence.

The central correction now fetches each workflow history page and its jobs once
per watchdog run, binds every request to the same `GITHUB_RUN_ID` snapshot key
to defeat intermediary stale caches, and reuses the exact immutable page promise
for every profile sharing that workflow. A local read-only replay over that one
snapshot resolves Fit House to latest `36835371096` / ordinary `36693313942`
and 10 Reps to latest and ordinary `36693313942`; both report the same listed
workflow heads and scan 50 identical runs. The shared cache regression and all
39 focused tests pass. No retailer logic, business threshold, baseline or write
path changes. Quick/full gates passed before merge; `0/3` remained unchanged.

PR `#165` merged the immutable shared-history correction as `597a5a26`. The
third read-only watchdog, run `36842276685`, artifact `11152160197`, digest
`sha256:1ffba83e...b4e85`, made zero database writes and reported no global
failure. It returned `FAIL` for 9 retailers and monitored 3, but the correlation
contract itself passed live. Fit House resolved latest/manual complete run
`36835371096` and latest ordinary run `36693313942`; 10 Reps resolved latest and
ordinary run `36693313942` and retained `35466782708` as its last complete
success. Both profiles used the same current 50-run snapshot, listed latest
workflow run `36835371096` and listed ordinary run `36693313942`. The earlier
cross-profile cache drift is therefore closed. Whey Okay independently resolved
new complete ordinary run `36839858227` and is now
`PASS_WITH_MONITORED_BACKLOG`, which further confirms that newer ordinary
evidence is no longer hidden.

The overall red result is now actionable evidence rather than a correlation
defect. The first bounded classification is Fit House's
`APPROVED_SCOPE_PARTITION_MISMATCH`: its successful isolation artifact records
the full 286-row approved manifest, while `20` executable and `14` review rows
describe the selected 34-row changed partition. The owner operation remains
live verified and closed; the 14 rows remain unchanged. The next task is to
define and verify this distinction in the central evidence contract before
touching watchdog logic. Counts must not be rewritten merely to satisfy
`20 + 14 = 286`, no retailer-specific exception is permitted, and no manual
retailer retry or monitored-baseline widening is authorized. After this
contract classification, process the remaining latest-ordinary failures by
shared incident class. The ordinary interval counter remains `0/3`.

The central scope contract is now locally corrected and fully verified. It
retains the complete approved-scope partition and adds a bounded operation
model. The bounded model passes only when a canonical-hash-verified full
database baseline from the same artifact is linked by postflight, every
execution/review offer ID belongs to that baseline, the ID sets are exact,
unique and disjoint, and execution has zero blocked rows plus a successful
same-run/same-commit database postflight. A
read-only replay of the untouched Fit House artifact from run `36835371096`
now classifies `286` approved rows as a `34`-row bounded operation (`20`
executed, `14` review, `252` unselected/no-write) under
`BOUNDED_OPERATION_SCOPE_V1`. The same generic contract accepts the historical
Discount Supplements `109/95/0/14` shape and retains the complete-scope model;
negative regressions cover count, ID, scope and correlation drift. Focused,
quick and full gates pass.

PR `#167` merged the correction as `31469faf`. The main-branch read-only
watchdog run `36849669742`, artifact `11155420859`, digest
`sha256:32305924...fa516`, live verified `BOUNDED_OPERATION_SCOPE_V1` as
`PASS`: `286` approved, `20` executed, `14` review and `252` unselected/no-write.
`APPROVED_SCOPE_PARTITION_MISMATCH` is gone. The run made zero database writes
and reported no global failure. Fit House remains correctly red because a newer
ordinary run `36842642858` is unsuccessful, offers remain stale and monitored
backlog grew; this interval therefore earns no credit. The next bounded task is
read-only classification of that latest shared Fit House/10 Reps ordinary run,
not a retailer retry. No monitored-baseline change or RA-004 retry is
authorized, and the ordinary counter remains `0/3`.

Read-only classification of ordinary shared run `36842642858` separated two
facts. The 10 Reps job was terminally successful: artifact `11153320825`,
digest `sha256:8a58626a...52dbd`, records `950` approved, `934` executed, `16`
review, zero blocked, 43 stock updates, 891 freshness confirmations, passing
postflight and passing zero-write idempotency. Fit House's business path also
passed with zero writes: artifact `11152410704`, digest
`sha256:c33331ff...f42b0`, records `286` approved, zero executable/executed and
the exact 14 owner-deferred review rows. Its job failed only afterward because
the Markdown summary dereferenced absent `discovery` in the legal zero-action
report. The shared run failure then contaminated 10 Reps because the watchdog
used `run.conclusion` instead of the matched `job.conclusion`.

The local central correction gives zero-action reports the same producer
context as executable reports, accepts zero-execution contracts only when
`mode=apply`, and evaluates each shared-workflow retailer from its exact job
conclusion while retaining the run conclusion as context. The untouched Fit
House artifact now replays as a bounded `PASS` with `0` executable, `14`
review and `272` unselected/no-write. Focused tests pass `81/81`; quick and
full gates pass, and independent review found no regression. Merge followed by
one read-only watchdog may verify job-level attribution; producer behavior must
then be observed on the next ordinary schedule, never by a manual retailer
retry. The interval still earns no credit because the historical Fit job is
terminally red and genuine Fit House/10 Reps backlog growth remains. Counter:
`0/3`.

PR `#169` passed all required checks and merged as `bc74bac`. The main-branch
read-only watchdog run `36852261994`, artifact `11156515153`, digest
`sha256:33edc534...b0a63`, made zero database writes and reported no global
failure. It live verified the consumer correction: 10 Reps now resolves its
exact successful job from shared ordinary run `36842642858` as
`COMPLETE_SUCCESS`, with `950` approved, `934` executed, `16` review and zero
blocked. Its false `LATEST_ATTEMPT_NOT_SUCCESSFUL` and
`LATEST_ORDINARY_ATTEMPT_INCOMPLETE` failures are gone; only genuine monitored
backlog growth remains. Fit House correctly retains the terminal failure of its
own summary job, while its bounded scope remains `PASS` at
`286/34/20/14/252`. The completed owner scope is unchanged: only offer `759`
received the approved stock restoration, 19 other offers received freshness-only
confirmation, and the exact 14 deferred offers received no writes and remain in
review. The producer correction must now prove itself on the next natural
ordinary schedule. No manual retailer refresh is authorized and the counter
remains `0/3`.

The successful 10 Reps job also improves, but does not complete, future replay
preservation. Artifact `11153320825` is retrievable until 15 October 2026 and
its archive and seven constituent files are now digest-indexed. It proves an
exact, disjoint `934` execution + `16` review partition over all `950` database
baseline rows, passing postflight and zero-write idempotency. It does not contain
the raw source response bytes, paired legacy/canonical row outputs, six-class
parity or offline repeat-replay evidence, and its expiring GitHub locator is not
durable storage. No production data was copied into Git and RA-004 remains
closed. The preserved index narrows the future artifact-first gap without
authorizing a capture, replay or retailer run. Evidence:
[`evidence/RA-STAB-01-EVIDENCE-PRESERVATION-AUDIT.json`](evidence/RA-STAB-01-EVIDENCE-PRESERVATION-AUDIT.json).

**Current 12-path classification — complete; observation continues:** the
timestamped read-only classification of watchdog `36852261994` assigns every
current result to the RA-STAB vocabulary with no unclassified failure. Two
older ordinary failures (Discount Supplements and KIOR Health) remain in the
pre-recovery ledger-selector class. Natural Jon's run `36853819770`, Simply
Supplements run `36856171813` and Dolphin Fitness run `36856895922`
independently live verified that shared correction on current `main`. Simply passed every
stage with `120` approved, `119` executed, one review and zero blocked; only
offer `673` returned in stock at unchanged `GBP 14.99`, the other 118 executions
were freshness-only, postflight found zero commercial delta, and fresh-source
idempotency made zero writes. Artifact `11158233377` has digest
`sha256:13f54a67...1a9e4`. Jon's remains `506/501/5/0`; its artifact
`11157711039` has digest `sha256:b6cdc18d...e6d3f`. Dolphin passed its exact
single-offer scope as freshness-only with zero commercial delta and zero-write
idempotency; artifact `11158809227` has digest `sha256:1d760a87...1140f`.
6 Pack is separately classified `SOURCE` because exact product `4150` returned
HTTP 404 after five bounded attempts. A subsequent read-only identity audit
confirmed that both the numeric URL and registered slug still return 404 with
no redirect. The retailer's live search contains related Good Guru products,
but none carries registered GTIN `854822007309`; the manufacturer's current
same-name 30 g Pearl product uses barcode `5060571822253`. That establishes an
unresolved identity discrepancy, not continuity, replacement or identity drift,
and gives no authority to mark the offer OOS or rebind it. Mapping `2565` and
offer `2379` remain unchanged. This read-only evidence only classifies the exact
row as requiring owner identity review; production and control state are
unchanged, and no retry or code patch is justified. Evidence:
[`evidence/RA-STAB-01-SIX-PACK-4150-SOURCE-AUDIT-2026-10-01.json`](evidence/RA-STAB-01-SIX-PACK-4150-SOURCE-AUDIT-2026-10-01.json).
That conclusion excludes an identity-specific replacement or stock patch. Later
repeated natural failures and implementation review identified a separate,
retailer-neutral source-failure scoping defect; its bounded correction is
recorded below.
Forensic review of eBay artifact
`11159580892` (digest `sha256:8c60a32c...a6c4c`) proved that its
`production-dry-run.json` was synthetic output from the preceding unit test, not
a live complete capture: every row uses `continuity_tier=test_exact`, has no HTTP
metadata and inherits its price from static scope. The scheduled invocation has
one proven live value for offer `2549`, `GBP 24.99` against database `GBP 26.99`;
the artifact cannot establish its exact API-capture time and does not prove a
second live `GBP 26.99` observation or recurrence. The importer correctly found
a commercial change, but a serialized no-op mapping update caused the strict
edge validator to fail the whole run before DB baseline, approval or writes.
The bounded retailer-neutral repair isolates test output in an injected temporary
directory and rebuilds offer-only deltas with the existing shared existing-offer
plan builder. Commercial rows remain review-only and strict executable validation
is unchanged. No price execution, retry, eBay exception or baseline widening is
authorized. The focused eBay suite passes `107/107`; quick and full quality
gates, Project Guardian and the production build pass. PR `#176` merged the
correction as `5c08e7e6` after CI, security and Vercel passed. The remaining
gate is read-only observation of the next natural schedule; do not dispatch it.
Fit House is the already-fixed
summary `FAILED_SYSTEM` pending natural producer proof; 10 Reps is genuine
`MONITORED_DEBT`. No retailer-specific patch is justified. Three independently
recovered paths still do not constitute a full cross-path interval, so the
counter remains `0/3`. Evidence:
[`evidence/RA-STAB-01-CURRENT-CLASSIFICATION-2026-10-01.json`](evidence/RA-STAB-01-CURRENT-CLASSIFICATION-2026-10-01.json).

**2 October ordinary observation — no interval credit; one bounded contract
repair:** natural schedules on `0bf7ff42` live verified the Fit House zero-action
producer fix and the shared Discount ledger correction. Whey Okay, Jon's,
Simply and Dolphin also completed with guarded postflight/idempotency evidence.
The interval is nevertheless atomic and remains `0/3`: Fit House and 10 Reps
have genuine stale/review backlog growth, 6 Pack failed closed on the already
classified product-4150 HTTP 404, KIOR had not yet produced a 2 October natural
run, and watchdog `37006401766` could not correlate the later Discount run.
eBay run `37000578631` safely applied 150 freshness-only rows, isolated 87
review rows and passed DB postflight with zero commercial/history delta, then
failed because its scheduled post-apply dry-run requested the existing evidence
contract while the writer allowed only `workflow_dispatch`. The bounded repair
accepts `schedule` or `workflow_dispatch` only in GitHub Actions on `main`, adds
a regression proving that the scheduled contract carries no owner confirmation,
and leaves manual apply authority unchanged. No dispatch, baseline widening or
retailer-specific shared-core branch is introduced. PR `#179` merged the repair
as `9af3e7e4`; Project Guardian and the full Quality Gate passed again on merged
`main`. Only a later natural eBay schedule and watchdog correlation can provide
live closure. Evidence:
[`evidence/RA-STAB-01-ORDINARY-OBSERVATION-2026-10-02.json`](evidence/RA-STAB-01-ORDINARY-OBSERVATION-2026-10-02.json).

**2 October recurring-backlog owner decision pack — D1 recorded, no write authority:**
ordinary run `36987322039` confirms one bounded decision scope rather than a
new implementation defect. Fit House again produced the exact 14 deferred stock
rows at source fingerprint `8074eefe...d6e991`: five false-to-true and nine
true-to-false. 10 Reps again produced the exact 16
`SOURCE_VARIANT_MISSING` rows at fingerprint `547a60dd...e0b6`: 12 belong to
source product `8036`, and four are single variants. Fourteen 10 Reps rows are
already OOS; only offers `3388` and `3627` are still in stock. The machine-readable
pack binds the rows to run, job, artifact, file, deferred-scope manifest and
database-baseline hashes. The owner subsequently recorded one bundled D1:
accept the exact observed Fit House stock values as business intent, keep all
16 10 Reps rows unchanged for read-only identity review, and permit only
read-only preparation of the exact 30-row Review Queue changeset. A later Fit
House execution still requires a separate exact manifest, preflight and owner
write authorization. No production wiring is assumed; publication and exact
control writes require separate reviewed, hash-bound decisions. Nothing here
authorizes a catalogue/control write, manual retry, baseline widening, new path
or RA-004 action; the ordinary counter remains `0/3`.
Evidence:
[`evidence/RA-STAB-01-BACKLOG-OWNER-DECISION-PACK-2026-10-02.json`](evidence/RA-STAB-01-BACKLOG-OWNER-DECISION-PACK-2026-10-02.json).

**2 October delayed natural KIOR readback — path pass, no interval credit:**
scheduled run `37017432524` started without manual dispatch on `main` commit
`a6bf579f` and completed all guarded stages. The exact 11 approved mappings and
offers classified `VERIFY_NO_CHANGE`; apply made 11 freshness-only business
writes through the guarded parent/child and per-row approval path, with no
commercial or history change. The diagnostic transaction count, two registered
control rows and 11 row approvals are separate layers and are recorded as such.
Read-only DB postflight found zero price, stock, shipping, total, URL, mapping
or price-history delta and exactly 11 freshness changes. A fresh source capture
repeated fingerprint `a8de1d3b...e602`, classified the same 11 no-change rows
and made zero business/control writes. This supplies the KIOR evidence that was
still pending at the earlier observation timestamp, but it does not change the
atomic `0/3` counter because the interval had already failed on the independent
Fit House/10 Reps backlog, 6 Pack source incident, eBay contract incident and
earlier watchdog boundary. No retry or baseline change is authorized. Evidence:
[`evidence/RA-STAB-01-KIOR-NATURAL-READBACK-2026-10-02.json`](evidence/RA-STAB-01-KIOR-NATURAL-READBACK-2026-10-02.json).

**2 October 10 Reps identity classification — read-only, no patches:** the 16
recurring `SOURCE_VARIANT_MISSING` rows separate into five evidence classes,
not 16 implementations. Twelve CNP identities were already reviewed OOS in
existing hash-bound manifests and remain missing; RYSE offer `3384` is already
OOS and its live product form has zero active variations; AK-47 Watermelon offer
`3496` is already OOS and explicitly labelled OOS on the live page. Those 14
rows need no catalogue write. Bulk offer `3388` has an exact same-product,
Vanilla 1 kg, GBP 13.49, in-stock successor candidate at external variant
`11696` instead of `9239`, but rebind remains a separate owner identity
decision. Cellucor offer `3627` remains ambiguous: Twisted Limeade is visible in
the selector but old ID `8783` is absent from the eight active purchasable
variations, so neither OOS nor replacement is inferred. The existing shared
isolation is correct; automatic actions and writes are zero. A generic terminal
outcome for the 14 already-OOS rows is only a candidate owner disposition; no
verified shared execution mechanism exists, and implementation would require a
separately reviewed common contract, regressions and authority. The remaining
work is one exact reviewed rebind and one unresolved stock/identity decision,
with no retailer-specific shared-core branch. The public-page normalized HTML
hashes are explicitly audit-local non-retained digests, not replay evidence.
Evidence:
[`evidence/RA-STAB-01-10REPS-IDENTITY-AUDIT-2026-10-02.json`](evidence/RA-STAB-01-10REPS-IDENTITY-AUDIT-2026-10-02.json).

**2 October RA-STAB-01-D1 decision and read-only Review Queue changeset:** the
owner accepted the recorded source stock state as the business disposition for
the exact 14 Fit House rows, kept all 16 10 Reps rows unchanged for read-only
identity review, and authorized preparation only of a Review Queue changeset
for those 30 rows. One bounded builder now reuses the existing common publisher
library; it has no apply mode and its production reader exposes only selects and
counts, with no insert, update, delete, upsert or RPC call. Fresh production
readback at `2026-10-02T15:08:41.913Z` matched all 30 offer, mapping, canonical,
external identity, price, stock and URL bindings. Both retailers had zero active
Review Queue rows. The exact preview is therefore `CREATE 14` for Fit House and
`CREATE 16` for 10 Reps, with zero refresh, supersede or resolve operations.
Bundle SHA-256 is `1711e71f...c1c8bd0`; Fit House changeset fingerprint is
`523b6829...61c62d8` and 10 Reps is `e08f0052...4ecd74e`. Preparation performed
zero database and catalogue writes. Queue publication, workflow wiring, stock
execution, identity rebind, retry and every RA-004 action remain unauthorized;
the next gate is independent implementation review followed by a separate exact
owner control-write decision if publication is later wanted. This manual
preparation earns no ordinary interval credit, so the counter remains `0/3`.
Evidence:
[`evidence/RA-STAB-01-D1-REVIEW-QUEUE-CHANGESET-2026-10-02.json`](evidence/RA-STAB-01-D1-REVIEW-QUEUE-CHANGESET-2026-10-02.json).

**2 October RA-STAB-01-D1 post-merge implementation review:** an independent
read-only review of merged PR `#184` recomputed the sealed bundle hash, confirmed
the exact `14 + 16` scope and 30 unique `CREATE` previews, and found no apply
CLI, imported publication executor or production mutation/RPC call in the D1
builder. Its production surface is select/count only and the common Review Queue
lifecycle planner remains the sole changeset mechanism. The focused suite passes
`4/4`; the merged full Quality Gate, Project Guardian, GitGuardian and Vercel
checks are green. There are no blocking implementation findings. The preview is
time-bound: its source manifests expire on 9 October, so it is not evergreen
publication authority. Any later publication requires a fresh exact production
and active-queue readback plus a separate owner control-write authorization.
This review made zero database, catalogue or Review Queue writes and leaves the
ordinary counter at `0/3`. Evidence:
[`evidence/RA-STAB-01-D1-IMPLEMENTATION-REVIEW-2026-10-02.json`](evidence/RA-STAB-01-D1-IMPLEMENTATION-REVIEW-2026-10-02.json).

**3 October natural watchdog readback — stable red partition, no interval
credit:** scheduled watchdog runs `37070747208` and `37098906183` both ran on
merged `main` commit `7470cf4`, inspected all 12 retailers, made zero database
writes and produced the same closeout snapshot and exact five-retailer failure
partition. KIOR is `PASS`; Simply is `PASS_WITH_REVIEW`; five other retailers
remain monitored-only. Fit House's exact 14 and 10 Reps' exact 16 are the known
D1 scopes and remain outside the old baseline because publication and business
writes are not authorized. Jon's now has five exact `SOURCE_VARIANT_MISSING`
rows in two consecutive natural captures: old baseline row `1209`, plus already-
OOS offers `1197`, `1456`, `1457` and `1458`. Its ordinary guarded run isolated
those five, completed 501 freshness-only confirmations and passed DB postflight
with zero commercial/stock writes. 6 Pack again failed closed before baseline or
apply because product `4150` returned HTTP 404 after five attempts; its reported
12-row review scope is the retained last-complete 28 September evidence, adding
offer `2255` to the older 11-row baseline, not a classification produced by the
failed run. eBay still points to pre-fix run `37000578631`; no natural run on the
merged contract correction existed by `06:21Z`. No threshold/baseline change,
retry, Review Queue publication or retailer-specific fix is justified. The
atomic ordinary counter remains `0/3`; next evidence must be the post-fix natural
eBay schedule followed by a later natural watchdog. Evidence:
[`evidence/RA-STAB-01-NATURAL-WATCHDOG-READBACK-2026-10-03.json`](evidence/RA-STAB-01-NATURAL-WATCHDOG-READBACK-2026-10-03.json).

**3 October Jon's five-row identity classification — read-only, no rebind:**
the exact five `SOURCE_VARIANT_MISSING` rows recur across the 1 and 2 October
natural captures. Four are already OOS and stay unchanged. Offer `1197` is old
Fruit Salad; its apparent SKU successor `CNP27003` is already correctly bound by
mapping `1208` / offer `1022` to the distinct Fruit Twist canonical variant, so
it cannot be reused. Offers `1456` and `1458` belong to a removed Efectiv 2 kg
product and their flavours are absent from the current 1.8 kg product. Offer
`1457` has a same-flavour 1.8 kg candidate, but the size, source product, source
variant and price all changed, so it is not a safe rebind to the existing 2 kg
canonical variant. Offer `1209` is the sole unresolved in-stock row: the exact
CNP 2 kg product remains live, but Cherry Bakewell and the old variant ID are
absent; no same-product successor is proven. It stays unchanged pending one
separate owner stock/identity disposition. Public JSON response hashes are
audit-local evidence, not retained replay artifacts. No baseline, queue,
catalogue or control write and no new code path is authorized; the counter stays
`0/3`. Evidence:
[`evidence/RA-STAB-01-JONS-IDENTITY-AUDIT-2026-10-03.json`](evidence/RA-STAB-01-JONS-IDENTITY-AUDIT-2026-10-03.json).

**3 October WooCommerce source-failure scoping correction — locally verified,
awaiting review and natural evidence:** repeated product-`4150` terminal HTTP
404 evidence exposed a general contract mismatch rather than a 6 Pack identity
rule. The existing shared mapped WooCommerce reader continued after every
product-page failure, including ambiguous access and server failures, while the
6 Pack wrapper stopped all `506` offers on the first failed product. The bounded
candidate introduces one shared disposition: only a controlled terminal HTTP
404 bound to the exact requested product can be product-scoped; `403`, `429`,
`5xx`, timeout, network, schema, redirect, identity and uncontrolled failures
remain retailer-scoped and fail closed. The shared mapped reader and 6 Pack now
consume that same contract. There is no product ID, retailer ID or retailer name
in the decision function.

For an isolated product-scoped 404, all approved rows bound to that product are
omitted from the executable artifact, classified through the existing
`SOURCE_VARIANT_MISSING` review path, retain their current catalogue state and
carry structured source-failure evidence; no OOS, price or successor identity
is inferred. The source fingerprint binds both successful rows and failures.
The existing configured `0.9` minimum product-page ratio is now wired into the
6 Pack classifier, so a broad series of individually valid 404s still trips
`SOURCE_COLLAPSE`. Reviewed owner selectors continue to require full source
coverage and cannot consume the new partial-source path.

The exact incident regression proves product `4150` / offer `2379` becomes the
sole review row in an otherwise unchanged `506`-row fixture, with `505`
executable plans, zero blocked rows, no proposed offer and no plan for offer
`2379`. Separate regressions prove a network failure still blocks all `506`, a
broad 404 series trips `SOURCE_COLLAPSE`, and the shared reader refuses `403`,
`503` and identity drift. The focused contract suite passed `83/83`, and both
`npm run verify:quick` and `npm run verify:full` passed, including the production
build. No workflow, executor, approval path, database,
catalogue, Review Queue, baseline or schedule was changed. This is not live
proof and earns no interval credit: after independent review and merge, only
the next natural 6 Pack schedule may verify the production
partition. Do not dispatch it manually and do not pre-authorize a watchdog
baseline change. Evidence:
[`evidence/RA-STAB-01-WOOCOMMERCE-SOURCE-FAILURE-SCOPING-2026-10-03.json`](evidence/RA-STAB-01-WOOCOMMERCE-SOURCE-FAILURE-SCOPING-2026-10-03.json).

**3 October post-fix natural 6 Pack and eBay readback — both production paths
pass, central watchdog correlation correction locally verified:** natural 6 Pack
run `37111838580` on merge `be4a54f` completed the full guarded sequence. Its
fresh partition was `506 = 492 execution + 14 review`, with zero blocked rows.
Exact source product `4150` remained the sole product-scoped 404 and offer
`2379` stayed review-only as `SOURCE_VARIANT_MISSING`; the other current review
debt is the eleven old MASS_OOS rows, offer `2255` MASS_OOS and offer `2378`
HARD_PRICE_ANOMALY. Postflight proved all 492 executions were freshness-only,
with zero price, stock, shipping, total, URL or price-history delta. Fresh-source
idempotency executed zero rows and made zero writes. The shared WooCommerce
source-failure correction is therefore live verified without an inferred OOS,
replacement or rebind.

Natural eBay run `37117068397` on the same merge completed `237 = 145 execution
+ 92 review`, zero blocked. All 145 executions were freshness-only; postflight
and same-run idempotency passed with zero commercial, URL or price-history
delta. The existing reconciliation publisher then created 37 current Review
Queue rows, refreshed 55, superseded 21 and resolved two by source, with zero
catalogue writes. The 92 current review rows — 34 commercial, 50 identity and
eight source failures — are genuine decision debt and are not widened into an
automatic scope.

The later natural watchdog `37120043308` correlated the 6 Pack success but
reported the successful eBay run incomplete. Its immutable artifact proves the
cause: the eBay workflow contains two mutually exclusive legal acquisition
steps. `Fresh read-only preflight` was skipped on the scheduled apply, while
`Prepare exact approved existing-offer refresh` succeeded; the central
correlator accepted only the former exact name. The bounded correction upgrades
the closed watchdog configuration to semantic stage arrays for every retailer.
The shared resolver records exactly one non-skipped alternative and fails closed
if more than one alternative executes. There is no retailer check in shared
code and no workflow, importer, approval or executor change. The focused suite
passes `42/42`; both `verify:quick` and `verify:full` pass, including the
production build; and every configured stage name is present in its bound
workflow. Direct replay of run `37117068397` now yields `COMPLETE_SUCCESS` with
its exact capture, apply, postflight and idempotency steps. PR `#189` passed the
full Quality Gate, Project Guardian, GitGuardian and Vercel checks and merged as
`a9bc49f`. A later natural watchdog on that merge remains required. Genuine Fit
House, Jon's, 6 Pack, eBay and 10 Reps review/stale debt still prevents atomic
interval credit, so the counter remains `0/3`; do not widen the baseline or
dispatch a retailer manually.
Evidence:
[`evidence/RA-STAB-01-NATURAL-SIX-PACK-EBAY-READBACK-2026-10-03.json`](evidence/RA-STAB-01-NATURAL-SIX-PACK-EBAY-READBACK-2026-10-03.json).

**3 October five-retailer review-debt map — read-only grouping, no per-offer
patch programme:** the current Fit House, 10 Reps, Jon's, 6 Pack and eBay
evidence contains 141 review rows, but they reduce to four operational
workstreams: 18 terminal no-catalogue-change candidates, 61 commercial decision
rows, 54 identity decision rows and eight eBay source failures that require a
natural reobservation before any business decision. The eBay 92 split is exact:
34 commercial changes (`24` price, `7` stock and `3` price-plus-stock), 50
identity conflicts (`32` reject and `18` review), and eight source-read
failures. Ten eBay stock changes are returns to stock; none is an inferred OOS.

This classification deliberately rejects a 141-patch approach. Already-OOS
10 Reps and Jon's rows need no catalogue mutation; commercial and identity work
must remain in separate, retailer-bound decision packs using existing guarded
paths; source failures must be recaptured naturally. The audit grants no queue
publication, terminal disposition, catalogue/control write, rebind, baseline
change, manual dispatch or RA-004 action and leaves the counter at `0/3`. The
first natural watchdog on merge `a9bc49f` is still required before another
implementation starts. Evidence:
[`evidence/RA-STAB-01-REVIEW-DEBT-DECISION-MAP-2026-10-03.json`](evidence/RA-STAB-01-REVIEW-DEBT-DECISION-MAP-2026-10-03.json).

**3 October natural watchdog after the alternate-stage merge — eBay verified,
Discount history omission isolated, 10 Reps stopped before business writes:**
scheduled watchdog `37135856072` ran on merged `main`, made zero database writes
and reported no global infrastructure failure. It now recognizes eBay run
`37117068397` as one exact `COMPLETE_SUCCESS`; the alternate-stage correction
is therefore live verified. eBay remains red only for its genuine monitored
backlog.

Discount was a monitoring false negative, not a failed retailer run. The
watchdog's standard completed-run page omitted natural success `37121588423`
and exposed old runs instead. The authoritative run and artifact show `109/109`
executions, a passing postflight, 109 freshness changes, no price or history
delta and one observed stock change. A direct read-only correlator replay picks
that fresh run as `COMPLETE_SUCCESS`. The generic correction retains the normal
history page and adds one official `created >= freshness cutoff` anchor request;
an omitted fresh run is merged by immutable ID and reported. Malformed, multiple
or older anchors fail closed. There is no retailer condition or producer,
approval, executor, workflow or guardrail change.

The same evidence identifies one real incomplete event: the 10 Reps job in
shared natural run `37110115566` prepared `934` freshness-only rows and isolated
`16` source-variant reviews, then hit `Query read timeout` after control
registration. Approver, executor, postflight and idempotency did not run;
business writes, approvals created and approvals consumed are all zero. The
expired parent `06ae81b7-4cc1-42b5-af6a-92bfd17e6dfa` requires a fresh read-only
control-state check. No retry or close action is authorized. Focused regression
passes `44/44`; `verify:quick` and `verify:full`, including the production build,
pass. Green CI remains the merge gate. The observation counter remains `0/3`.
Evidence:
[`evidence/RA-STAB-01-NATURAL-WATCHDOG-HISTORY-ANCHOR-2026-10-03.json`](evidence/RA-STAB-01-NATURAL-WATCHDOG-HISTORY-ANCHOR-2026-10-03.json).

**3 October Review Queue usability checkpoint — one simpler view, not another
approval path:** the admin queue now opens on rows that require a human
decision, states the exact question to answer and keeps status, scope and
technical filters under one optional section. Approval is visibly separate
from execution: the pending-row and bulk controls only record an approval;
execution remains the existing later protected action with the same adapter,
fingerprint, expiry, source-revalidation and zero-write retry guards.

Search now operates over the complete bounded result before 50-row pagination,
so a matching offer is not missed merely because it was on a later page. The
read-only loader uses exact-count batches of 1,000 with a hard 5,000-row limit
and fails closed on count drift, duplicate IDs, truncation or overflow. It adds
no writer, route, retailer condition, capability or database change. Regression
proves a target at position 65 is found before pagination. The focused suite
passes `45/45`; TypeScript, ESLint, `verify:quick` and `verify:full` pass,
including the production build. No test file was added, removed or renamed.
PR `#192` passed Project Guardian, the full Quality Gate, GitGuardian and
Vercel, then merged as `e8590ef`; the full post-merge gate on `main` also
passed. Vercel reports the merge deployed, and an unauthenticated production
readback returns `307` to `/admin/login`, confirming the admin boundary remains
closed. An authenticated read-only UI check still requires a valid admin
session. This checkpoint made zero production decisions or writes and does not
change the stabilization counter (`0/3`). Evidence:
[`evidence/RA-STAB-01-REVIEW-QUEUE-UX-SIMPLIFICATION-2026-10-03.json`](evidence/RA-STAB-01-REVIEW-QUEUE-UX-SIMPLIFICATION-2026-10-03.json).

**4 October two natural watchdogs on the merged history correction — stable
read-only result, no ordinary interval credit:** scheduled runs `37154045897`
and `37180679396` both executed on merged `main` SHA `e741b01`, inspected all
12 retailers, reported no database/global infrastructure error and made zero
database writes. Their artifacts are semantically identical after removing the
generation timestamp. Discount is now correctly recognized from natural run
`37121588423` as `COMPLETE_SUCCESS` and
`PASS_WITH_MONITORED_BACKLOG`; the prior history false negative did not recur.
The fallback anchor was not exercised because the standard listing contained
the fresh run, so anchor recovery itself is not claimed as live-tested.

Five genuine red results remain unchanged: Fit House has 14 review rows and
stale scope, Jon's has five review/stale rows, 6 Pack has 14, eBay has 92 review
rows and 87 stale offers, and 10 Reps still points to incomplete run
`37110115566` with 16 review/stale rows. No new ordinary retailer run occurred
between the watchdogs, so these are two observations of one state rather than
two qualifying intervals. Counter remains `0/3`; no retry, baseline widening,
control action or RA-004 action is authorized. Next perform only the separately
bounded fresh read-only check of the expired 10 Reps parent and 19-child tree,
then await new natural retailer runs and a later natural watchdog. Evidence:
[`evidence/RA-STAB-01-NATURAL-WATCHDOGS-2026-10-04.json`](evidence/RA-STAB-01-NATURAL-WATCHDOGS-2026-10-04.json).

**4 October interrupted 10 Reps registration preservation — exact control
identity retained, current state still unverified:** before GitHub artifact
`11270160626` expires on 17 October, its immutable bundle was downloaded once
and hash-checked. A redacted tracked record now preserves parent
`06ae81b7-4cc1-42b5-af6a-92bfd17e6dfa`, its parent/source/manifest
fingerprints, all 19 child IDs and child fingerprints, mapping count `950`, the
`Query read timeout` classification and exact zero-business-write accounting.
No raw source, database baseline rows, commercial rows, secret or credential
was copied into Git.

This is registration-time evidence, not a current database readback. It does
not prove the present parent/child statuses and contains no approval ID because
the approver never ran. The source archive is still retention-limited and is
not a recorded-replay bundle. The next gate remains one separately authorized,
fresh read-only export of exactly this parent and 19-child tree, failing closed
if it needs a new migration or broader capability. No retry, close, approval,
capture, replay or RA-004 action is authorized. Evidence:
[`evidence/RA-STAB-01-10REPS-INTERRUPTED-CONTROL-REGISTRATION-2026-10-04.json`](evidence/RA-STAB-01-10REPS-INTERRUPTED-CONTROL-REGISTRATION-2026-10-04.json).

**4 October owner-authorized 10 Reps read-only export preflight — stopped
before connection:** the owner authorized exactly one current-state export with
no writes, retry, close or RA-004 replay. The fail-closed preflight found that
the existing transactional control-state RPC and provider-identity correction
remain excluded from the production selector, while the prior temporary
credentials are closed and no dedicated production exporter identity is
available. The broader owner, validator, service-role and raw-SQL paths are not
valid substitutes. The attempt therefore stopped before any production
connection or database read and made zero writes; no export artifact was
created. A later export would require separate authority for production
deployment of the already reviewed narrow interface and for one short-lived
dedicated read-only identity. Evidence:
[`evidence/RA-STAB-01-10REPS-READONLY-EXPORT-PREFLIGHT-2026-10-04.json`](evidence/RA-STAB-01-10REPS-READONLY-EXPORT-PREFLIGHT-2026-10-04.json).

**4 October bounded plan-tree readback — owner authorized and locally
prepared:** deeper review proved the historical RA-004 v1 interface cannot be
deployed to production as-is: it is bound to the staging ledger and requires
five evidence writes before its read. The smaller safe route reuses the already
deployed `public.get_retailer_catalogue_plan_status(uuid)` RPC. One temporary
login, valid for at most ten minutes, receives no table privileges or role
memberships and is confined by one static `REPEATABLE READ READ ONLY` call,
then disabled in its own committed transaction, terminated, revoked and
dropped. The coordinator invokes cleanup by the fixed role name after a lost
credential reply and has a separate cleanup-only mode that is not gated by the
migration ledger, Git state or implementation hashes.
The temporary plaintext password is never interpolated into SQL or written to
an artifact; PostgreSQL receives only its SCRAM verifier. The result is accepted only
if the exact parent fingerprint and all 19 child IDs/fingerprints match the
preserved registration. It reports apply/rollback runs but cannot claim the
full eleven-source RA-004 clearance or authorize close, retry or replay. The
failure paths have local regression coverage, including an isolated PostgreSQL
17 lifecycle test that proves SCRAM login, forced session termination,
committed `NOLOGIN`, revoke-before-drop and a deliberately blocked `DROP ROLE`.
The termination check is bounded to two seconds; a slower shutdown fails closed
and enters rescue cleanup. Live cleanup remains a required production
postcondition rather than a pre-execution claim. Authorization is
bound to exact implementation hashes and execution requires a
freshly fetched, clean merged `main`. The owner authorized this complete
bounded package on 4 October. Preparation:
[`evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-PREPARATION-2026-10-04.json`](evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-PREPARATION-2026-10-04.json).

**4 October one-shot attempt — consumed before database authentication:** PR
`#196` merged at `5f064c8860f7f1d97cdbf0132e89f89dc630b0fc` after green CI. The
clean-`main` execution reached the verified-TLS boundary without the private
Supabase Root 2021 CA and stopped with `self-signed certificate in certificate
chain`. It authenticated no database session, executed no SQL or RPC, created
no role and produced no export. Cleanup-only was then run with the official CA
after verifying its SHA-256 certificate fingerprint
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`;
its authenticated cleanup readback found the fixed role, memberships, backends
and target grants absent, with zero RPC calls. The TLS failure before database
authentication is the separate basis for concluding that the failed execution
created no role. The authorization is consumed and no retry is
authorized. The regression requires and fingerprints the CA before an attempt
marker or credential creation. Evidence:
[`evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-ATTEMPT-2026-10-04.json`](evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-ATTEMPT-2026-10-04.json).

**4 October second one-shot readback authorization — prepared, not yet
executed:** after the first authorization was terminally consumed before
database authentication, the owner explicitly authorized one new read-only
export on the same boundaries: no business or control writes, retry, close,
retailer refresh or RA-004 replay. The new preparation preserves the exact
parent and 19-child identity, uses a distinct fixed temporary role, marker and
result path, and requires the verified Supabase Root 2021 CA before Git or
credential activity. The first attempt and its cleanup evidence remain
immutable. Execution is permitted only once from a clean, freshly fetched
merged `main`; any attempted execution consumes this new authority. Preparation:
[`evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-PREPARATION-V2-2026-10-04.json`](evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-PREPARATION-V2-2026-10-04.json).

**4 October second one-shot attempt — consumed during capability proof, cleanup
verified:** PR `#198` merged the exact preparation at `0cf8f484`. The clean
`main` execution passed the pinned CA, repository, target, ledger and deployed
RPC checks, then PostgreSQL evaluated `has_sequence_privilege` against the
unrelated index `saml_providers_pkey` before the query's relation-kind filter.
The credential-creation transaction rolled back, so the temporary role and its
grants did not become durable; the plan-status RPC was never called and no
result or digest was created. Mandatory cleanup completed, and a separate
cleanup-only readback found the role already absent with no login, membership,
backend or target grant. The authorization is consumed and must not be retried.
The common fix guards privilege functions with `CASE` by relation kind and adds
a PostgreSQL regression containing the formerly triggering primary-key index;
it changes no retailer, catalogue, approval or execution policy. Evidence:
[`evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-ATTEMPT-V2-2026-10-04.json`](evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-ATTEMPT-V2-2026-10-04.json).

**4 October third and final one-shot readback authorization — prepared, not
yet executed:** after the common relation-kind capability fix merged at
`36e4a31`, the owner explicitly authorized one final read-only export of the
same exact parent and 19 children. V3 has its own temporary role, credential
identity, write-once marker, output and digest paths. V1 and V2 remain terminal
and immutable. The unchanged boundary permits no business or control writes,
retry, close, retailer refresh or RA-004 replay; any attempted V3 execution
consumes the authorization. Execution requires the pinned Supabase Root 2021
CA and a clean, freshly fetched merged `main`. Preparation:
[`evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-PREPARATION-V3-2026-10-04.json`](evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-PREPARATION-V3-2026-10-04.json).

**4 October third and final one-shot attempt — consumed at the effective
capability boundary, cleanup verified:** PR `#200` merged the V3 preparation at
`cb93270e`. The clean-`main` execution passed the pinned CA, repository, target,
ledger, deployed RPC and corrected relation-kind checks. Before enabling the
temporary login, the fail-closed post-grant proof found at least one effective
capability broader than the dedicated status RPC contract and stopped with
`RA_STAB_EPHEMERAL_CAPABILITY_TOO_BROAD`. V3 did not persist which proof field
was true, so the ledger does not guess whether the source was an effective
PUBLIC relation privilege, another PUBLIC SECURITY DEFINER function or a
different rejected capability. The creation/grant transaction rolled back; the
plan-status RPC was never called and no result or digest was created. Mandatory
cleanup completed, and a separate cleanup-only readback found the role already
absent with no login, membership, backend or target grant. The third and final
authorization is consumed. No fourth attempt, guard bypass or privilege
widening is authorized; a future solution requires a separately reviewed
readback architecture that can prove least privilege against the real
production ACL surface before execution. Evidence:
[`evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-ATTEMPT-V3-2026-10-04.json`](evidence/RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-ATTEMPT-V3-2026-10-04.json).

**4 October central readback repair - live ACL cause verified, local common fix
prepared, production unchanged:** one new read-only production inventory used a
single `REPEATABLE READ READ ONLY` transaction, no retry, no plan-status call
and no write. It proved that V3 combined actual reachability with global
effective privileges. `public.rls_auto_enable()` was PUBLIC-executable through
inherited `public` schema usage even though the canonical baseline revokes that
grant. Two PUBLIC-readable extension statistics views were also counted by V3,
although the caller could not use their `extensions` schema. The prepared
common migration restores the baseline revoke, creates one private,
retailer-neutral status wrapper and one reusable caller role in `NOLOGIN`
state. It adds no table, sequence, importer, writer, retailer condition or
RA-004 path. The migration is SHA-bound and isolated as production `PENDING`,
so ordinary selection cannot deploy it. Focused tests and the isolated
PostgreSQL 17 capability test pass. Production still has no new schema, role or
function, and the 10 Reps state remains unread. Applying the migration is the
next exact owner gate. Evidence:
[`evidence/RA-STAB-01-CENTRAL-READBACK-ACL-INVENTORY-2026-10-04.json`](evidence/RA-STAB-01-CENTRAL-READBACK-ACL-INVENTORY-2026-10-04.json).

**4 October first central deployment attempt - transaction rolled back before
credential activation or read:** PR `#202` merged the reviewed package at
`209ffbe2` after green CI. Production accepted the target, ledger and migration
preflight, but its managed `postgres` owner could not `SET ROLE` to the newly
created purpose owner during `ALTER FUNCTION OWNER`. The migration transaction
rolled back. A separate read-only verification proved ledger `223`, both roles,
the private schema, wrapper, ledger entry and caller backend were all absent.
The 10 Reps RPC was never called. The forward correction removes the
unnecessary ownership transfer and extra owner role; the private wrapper stays
owned by the existing production `postgres` owner while the reusable caller
remains narrowly granted and `NOLOGIN`. The PostgreSQL 17 regression now drops
`SUPERUSER` from its migration owner before apply so it reproduces the managed
production restriction. No retry is authorized. Evidence:
[`evidence/RA-STAB-01-CENTRAL-READBACK-DEPLOYMENT-ATTEMPT-2026-10-04.json`](evidence/RA-STAB-01-CENTRAL-READBACK-DEPLOYMENT-ATTEMPT-2026-10-04.json).

**4 October central interface production closeout:** PR `#203` merged the
managed-owner correction at `a672e720`. Production now contains migration
`20261004120000` at the reviewed SHA and ledger count `224`. The authorized
caller completed exactly one read-only RPC for the exact 10 Reps parent and 19
children; the existing validator accepted the parent and every child identity
and fingerprint. The first immediate cleanup check raced with the closing
caller connection and stopped report persistence with
`CENTRAL_BACKEND_REMAINS`. Cleanup-only repeated no plan read: it committed
`NOLOGIN`, terminated the residual backend and proved backend count zero. A
separate repeatable-read postflight proved the migration SHA from the ledger,
the caller disabled with no memberships or direct source-RPC permission, and
the private wrapper as its only execute grant. There were no retries, close,
RA-004 or business/control-data writes. Because the validated read result was
held only in process memory and report persistence followed cleanup, the actual
status values and run rows are not recoverable and must not be inferred. Any
future state read is a new owner decision. Evidence:
[`evidence/RA-STAB-01-CENTRAL-READBACK-PRODUCTION-CLOSEOUT-2026-10-04.json`](evidence/RA-STAB-01-CENTRAL-READBACK-PRODUCTION-CLOSEOUT-2026-10-04.json).

**4 October owner-authorized durable readback remediation — prepared:** the
repository contract is reconciled to the already verified production ledger
`224`; migration `20261004120000` moves from pending to applied-excluded without
executing SQL. The new tracked central runner contains no migration/deploy path.
It validates the exact Supabase CA before marker or credential access, permits
one parameterized read-only RPC, writes an immutable validated-result artifact
before cleanup, then requires `NOLOGIN`, bounded backend termination and a
separate immutable cleanup receipt. A cleanup failure preserves the result and
can only be finalized by cleanup-only mode with zero additional RPC calls. The
owner authorized exactly one new read of the same parent plus 19 children as
part of completing all five stated next steps; retry, close, RA-004 and
business/control-data writes remain forbidden. The already deployed Review
Queue simplification is retained; this changeset only removes its hidden legacy
combined approve-and-execute action and adds deterministic complete-read order.
Preparation:
[`evidence/RA-STAB-01-10REPS-CENTRAL-READBACK-PREPARATION-V4-2026-10-04.json`](evidence/RA-STAB-01-10REPS-CENTRAL-READBACK-PREPARATION-V4-2026-10-04.json).

**4 October durable 10 Reps readback and Review Queue verification â€” verified
complete:** PR `#205` merged at `1248d208`. The new runner made exactly one
production status RPC and saved the validated result before cleanup. The exact
parent remains `APPROVED`; child `0` remains `APPROVED` with its approval
expired on 3 October, children `1`â€“`18` remain `PLANNED`, and there are no run
rows. The bounded result is therefore `REGISTRATION_NON_TERMINAL_NO_RUNS`, not
evidence of an apply. The first cleanup proof failed after the result was
already durable; cleanup-only mode made zero status RPCs, restored `NOLOGIN`,
proved zero backends and sealed a separate receipt. Total accounting is one
read, zero retries, zero close/RA-004 calls and zero business/control-data
writes. The one-shot preparation is now consumed, so a fresh checkout cannot
replay it. Authenticated production UI readback also passed for Review Queue:
the simpler decision view, collapsed secondary filters and separate
approval/execution wording are live, while the removed combined action is
absent. Production did not have a second page of offers, so the larger
cross-page search contract remains proven by the 75-row regression fixture.
No decision or execution was submitted. The bounded 10 Reps readback subtask
is `VERIFIED_COMPLETE`; RA-STAB-01 remains `IN_PROGRESS` at ordinary interval
counter `0/3`. Evidence:
[`evidence/RA-STAB-01-10REPS-CENTRAL-READBACK-V4-CLOSEOUT-2026-10-04.json`](evidence/RA-STAB-01-10REPS-CENTRAL-READBACK-V4-CLOSEOUT-2026-10-04.json) and
[`evidence/RA-STAB-01-REVIEW-QUEUE-UX-SIMPLIFICATION-2026-10-03.json`](evidence/RA-STAB-01-REVIEW-QUEUE-UX-SIMPLIFICATION-2026-10-03.json).

**5 October first natural observation after the V4 closeout — no dispatch and
no interval credit:** scheduled watchdog `37235410756` ran on merged commit
`f9445779`, made zero database writes and had no database or global failure.
It still correlated retailer schedules from before that merge. Seven retailer
results were red: Whey Okay and KIOR ended incomplete; Fit House, Jon's,
6 Pack and eBay exceeded their monitored backlog contracts; and 10 Reps had an
incomplete latest attempt plus stale execution evidence and backlog growth.
The separate GYM HIGH source monitor failed closed on a bounded source HTTP
error, while the watchdog still classified the catalogue path as
`PASS_WITH_MONITORED_BACKLOG`; no retailer-specific patch follows from it.
This observation used no retry, RA-004 action, baseline widening, catalogue,
control or Review Queue write. Counter remains `0/3`. The next gate is one
complete natural retailer cycle after `f9445779` and the first later scheduled
watchdog. If that fresh cycle is red only for backlog growth, use the existing
owner-decision Review Queue path; do not change the baseline. Evidence:
[`evidence/RA-STAB-01-POST-V4-NATURAL-OBSERVATION-2026-10-05.json`](evidence/RA-STAB-01-POST-V4-NATURAL-OBSERVATION-2026-10-05.json).

**5 October shared expired-plan recovery consolidation — locally verified,
deployment pending:** the next natural shared refresh, run `37291179712`, read
all 950 approved 10 Reps mappings and classified 933 freshness confirmations,
one price update and 16 review rows. It then failed closed before any write with
`RSBI_REPLAY_BLOCKED` because parent
`06ae81b7-4cc1-42b5-af6a-92bfd17e6dfa` remains the exact expired,
unexecuted 1-approved/18-planned tree proved by the durable readback. The
implementation does not add a 10 Reps exception, migration, database function,
approval RPC or business writer. It replaces the store-specific Simply close
runner with one retailer-neutral coordinator in the existing shared workflow
and reuses `close_expired_retailer_offer_sync_approval(jsonb)`. The coordinator
requires a repeatable-read exact preflight, zero apply/row-approval/recovery
evidence, the live migration ledger and unchanged business counts before one
confirmed close call; postflight requires all children expired and the same
business counts. Focused tests, Project Guardian, inventory, quick/full gates
and the production build pass. Production remains unchanged. The next exact
gate is green merge followed by one bound control-only recovery dispatch and
its read-only postflight; no refresh retry or RA-004 action is bundled into the
close. Evidence:
[`evidence/RA-STAB-01-SHARED-CONTROL-RECOVERY-PREPARATION-2026-10-05.json`](evidence/RA-STAB-01-SHARED-CONTROL-RECOVERY-PREPARATION-2026-10-05.json).

**5 October shared expired-plan recovery — production verified:** PRs `211`,
`212` and `213` merged one retailer-neutral coordinator and two common contract
corrections. Runs `37302927313` and `37304222467` failed closed during read-only
preflight and made no close call or business write. Run `37305276770` then
performed the only close call against the existing RPC. The exact parent and
all 19 children are `EXPIRED`; the approval is closed but unconsumed; apply
runs, row approvals and recovery records remain zero. The result reports 21
control writes, zero business writes, zero price-history writes and zero
automatic retries. Postflight confirmed unchanged catalogue counts. This
control-only subtask is `VERIFIED_COMPLETE`. The next gate is one fresh ordinary
10 Reps cycle through the existing shared workflow, followed by its standard
postflight and fresh Review Queue publication; no old plan is replayed.
Evidence:
[`evidence/RA-STAB-01-SHARED-CONTROL-RECOVERY-CLOSEOUT-2026-10-05.json`](evidence/RA-STAB-01-SHARED-CONTROL-RECOVERY-CLOSEOUT-2026-10-05.json).

**5 October first fresh 10 Reps execution gate after recovery — blocked by the
external source:** manual ordinary-path runs `37305756452` and `37306729009`
both stopped at `SOURCE_FETCH` after the existing three bounded attempts timed
out. The owner later authorized one more immediate run to finish the check
faster. Run `37308914886` produced the same result: three bounded timeouts, zero
bytes and a stop before validation, plan creation, approval or apply. All three
runs report zero attempted/completed database writes, zero business/control
writes and zero approvals. The earlier replay blocker did not recur, so the
shared expired-plan recovery is not implicated. Do not add a retailer-specific
fallback, reuse a stale feed, raise the timeout without source evidence or
launch a fourth manual retry. The next exact gate is evidence that the protected
10 Reps feed is responding again. Only a fresh complete feed may proceed to the
normal 10 Reps execution and fresh Review Queue publication. RA-STAB-01 remains
`IN_PROGRESS`; ordinary observation credit remains `0/3`. Evidence:
[`evidence/RA-STAB-01-10REPS-SOURCE-OUTAGE-2026-10-05.json`](evidence/RA-STAB-01-10REPS-SOURCE-OUTAGE-2026-10-05.json).

**5 October shared owner-decision execution preparation — implementation in
PR #218, not yet production evidence:** the existing Automation Review Queue
worker now has one registry for eBay and Fit House and is the sole workflow
woken by the admin execution action. The former direct eBay Review Queue job is
removed. Fit House reuses the existing full-source classifier, read-only
validator, control-plan registration, separated approver/executor roles,
postflight and fresh idempotency capture. One approved stock decision is bound
to exactly one commercial change plus 19 deterministic `VERIFY_NO_CHANGE`
freshness confirmations; price, shipping, total, URL and identity changes remain
blocked. The fixed 14-row publication contract now shrinks only when exact
source/DB agreement resolves a row. A bounded SELECT-only owner-decision audit
was added for the final readback of every authenticated-admin decision and its
execution history. Independent code review found and the implementation fixed
a stale-baseline no-op check, dynamic count-binding gap, missing behavioural
workflow test and obsolete GitHub-input metadata. Local `verify:quick`,
`verify:full`, TypeScript, zero-warning ESLint and behavioural tests pass. This
checkpoint authorizes no Review Queue decision, catalogue write or 10 Reps
retry. Production capability and decision readback remain required after green
CI and merge; RA-STAB-01 remains `IN_PROGRESS` at `0/3` ordinary intervals.

**5 October shared Review Queue production readback — deployed and verified:**
PR #218 merged as `108a1cab05274dabb93c5dbcab9dc8033f308ce0`; its full
quality gate passed in run `37332898487` and the production deployment passed.
An explicit production worker probe on that exact commit passed in run
`37334575536` with zero active execution requests and zero catalogue writes.
The bounded owner-decision readback found 50 authenticated-admin decision
events across 40 retailer offers. Thirty `EXECUTED` requests have 30 downloaded
result artifacts; every request matched its run, postflight hash, executed offer,
idempotency result and write count. No executed artifact failed verification and
there is no active execution request. At latest-offer level, 28 are `EXECUTED`,
six are safely `EXPIRED` with zero writes, three are `APPROVED` without an
execution request and three have a newer `PENDING` review. Historical audit
signals remain review debt: 25 older-decision/current-evidence differences, six
approvals without a request and two request-binding differences; the latter two
are both expired with zero writes and none affects an executed request. Do not
replay or auto-resolve those rows. Fit House shared execution capability is now
live, but this readback created no owner decision or execution. 10 Reps remains
deferred behind the external-source recovery gate with no new retry. This is
production capability evidence, not an ordinary scheduled observation, so
RA-STAB-01 remains `IN_PROGRESS` at `0/3`. Evidence:
[`evidence/RA-STAB-01-REVIEW-QUEUE-PRODUCTION-READBACK-2026-10-05.json`](evidence/RA-STAB-01-REVIEW-QUEUE-PRODUCTION-READBACK-2026-10-05.json).

**5 October shared safe/review partition and watchdog meaning — locally
verified, deployment pending:** fresh production evidence separated two normal
conditions from a system failure. Fit House run `37318809123` completed source,
classification and publication successfully with `272` safe
`VERIFY_NO_CHANGE` rows and the same `14` owner-deferred stock rows. The old
one-time returned-offer selector then selected zero ordinary rows after its
authorized change had become idempotent, so the safe rows were not refreshed.
Whey Okay read-only run `37312941793` independently proved `579` executable
rows plus `10` missing-source review rows; its earlier scheduled run
`37288125109` stopped before writes on a control conflict that is no longer
present. Watchdog `37336271221` incorrectly promoted Fit House's expected
review-count growth to `FAIL`, although its latest retailer run was complete.

The correction introduces one retailer-neutral partition in the existing
classifier: every quarantined offer is excluded from execution and all other
classified rows remain executable. Fit House consumes that common partition
for ordinary runs while preserving the existing exact one-time `1 + 19`
authorized path when it still has a real stock change. The watchdog now reports
review-only growth as `PASS_WITH_REVIEW`; stale-scope drift, missing evidence,
unknown failure codes and all genuine system failures still return `FAIL`.
There is no new importer, executor, workflow, database function, approval path,
retailer condition in shared core, baseline widening or production write.
Focused regressions pass `119/119`; repository quick/full gates, Project
Guardian and the production build pass. The next gate is green CI/merge, then
the natural Whey Okay and shared Fit House schedule followed by a fresh
read-only watchdog. The exact 14 Fit House rows remain unchanged in Review
Queue and must not be manually forced. RA-STAB-01 remains `IN_PROGRESS` at
`0/3`. Evidence:
[`evidence/RA-STAB-01-SHARED-SAFE-REVIEW-PARTITION-PREPARATION-2026-10-05.json`](evidence/RA-STAB-01-SHARED-SAFE-REVIEW-PARTITION-PREPARATION-2026-10-05.json).

**5 October owner-requested immediate Fit House and Whey Okay execution — Whey
verified, Fit House report correction pending deployment:** after PR `#220`
merged as `0b93f0dbb356f907a6bec9379c553bd5a2b22872`, the owner explicitly
replaced the natural-cycle wait with sequential manual ordinary-path dispatches.
Fit House run `37344883167` fetched a healthy complete source and reproduced the
exact `272 safe + 14 review` partition. It then failed closed before baseline,
registration, approval or execution with `Fit House protected-offer report
scope mismatch`; database, business and control writes are all zero. The cause
is bounded: the consumed one-time `1 + 19` report assertion still ran after the
ordinary selector correctly chose 272 safe confirmations. The correction binds
that assertion to an actually active one-time stock authorization. It changes
no classifier, partition, threshold, writer, workflow or Review Queue scope.
Its incident regression plus the Fit House/shared suites pass `62/62`, and
quick/full gates including the production build pass.

Whey Okay run `37345068386` then used the same shared production lock and
completed successfully. It executed all `579` safe `VERIFY_NO_CHANGE` rows in
12 guarded children and kept the exact 10 missing-source rows in review.
Postflight proves 579 freshness changes and zero price, stock, shipping, total,
URL, mapping, catalogue or price-history change. Fresh-source idempotency passed
with the same `579 + 10` partition. The next gate is green merge of the bounded
Fit House report correction, followed by one fresh Fit House ordinary-path
dispatch and read-only postflight. The 14 Fit House exceptions remain
unchanged. These owner-requested manual runs do not increment the ordinary
schedule counter, which remains `0/3`. Evidence:
[`evidence/RA-STAB-01-MANUAL-FIT-WHEY-OBSERVATION-2026-10-05.json`](evidence/RA-STAB-01-MANUAL-FIT-WHEY-OBSERVATION-2026-10-05.json).

**5 October Fit House ordinary execution and Review Queue source-contract
correction:** PR `#221` merged the bounded report-scope correction as
`6d82993b1042089af1a46aab4fad3d90d1943e47`; main quality gate run
`37347029695` and the production deployment passed. Owner-requested Fit House
run `37347458788` then completed the catalogue path with
`PASS_WITH_REVIEW`: all 272 `VERIFY_NO_CHANGE` rows executed, the exact 14
`UPDATE_STOCK` rows remained deferred, DB postflight passed with 272 freshness
changes and zero price, stock, shipping, total, URL, mapping, catalogue or
price-history change, and idempotency reproduced the same `272 + 14`
partition. The workflow became red only in the subsequent Review Queue source
binding step, before queue reconciliation, because that adapter still required
the superseded zero-execution publication shape. The bounded correction keeps
the same adapter and guarded publisher, accepts either its legacy zero-execution
capture or an ordinary complete safe/review partition, requires all executable
IDs to be `VERIFY_NO_CHANGE`, requires an empty stock-execution scope, binds
every freshness/daily-confirmation count to postflight, and still rejects every
commercial or catalogue delta. The incident regression accepts the exact
`272 + 14` production shape and rejects an injected stock execution. The live
artifact itself passes the corrected contract locally. No classifier, writer,
workflow, retailer threshold or queue lifecycle is added or changed. The next
gate is green CI/merge followed by one fresh Fit House dispatch so the already
safe business path can publish the exact unresolved review subset. Manual runs
do not increment the ordinary counter; RA-STAB-01 remains `IN_PROGRESS` at
`0/3`. Evidence:
[`evidence/RA-STAB-01-FIT-HOUSE-REVIEW-BIND-PREPARATION-2026-10-05.json`](evidence/RA-STAB-01-FIT-HOUSE-REVIEW-BIND-PREPARATION-2026-10-05.json).

**5 October Fit House production closeout and owner-decision worker evidence
repair:** PR `#222` merged the source-contract correction as
`007837d70fe9c94f7742f3ff24e8a5e9bf06efe1`; main quality gate run
`37350767178` and production deployment passed. Fit House run `37351120017`
then completed end to end: 272 freshness-only confirmations executed, the exact
14 stock changes remained in review, postflight and idempotency passed with zero
commercial/catalogue change, source binding passed, and the shared publisher
applied 14 queue operations (`CREATE 3`, `REFRESH 11`) with zero catalogue
writes. This is manual evidence and does not increment the `0/3` ordinary
counter. Read-only watchdog `37351958480` correctly reports Fit House as
`PASS_WITH_REVIEW`; its global red result comes from the prior failed natural
Whey Okay interval plus the recorded Jon's, 6 Pack, eBay and 10 Reps backlog,
not from this Fit House run. The successful manual Whey Okay run
`37345068386` remains the latest complete execution but deliberately does not
replace the failed natural interval.

The owner-requested queue follow-up exposed five newly queued requests. Worker
run `37352438800` failed closed before usable per-request evidence: it emitted
only aggregate `QUEUE_WORKER_BATCH_FAILED:5`, while the uploaded files were
test fixtures left by the pre-production test step. The bounded correction
keeps the one existing worker and adapters, clears only runner-local test
evidence before production processing, persists one redacted batch report with
request/retailer/review identifiers and stable error codes, and runs the
existing SELECT-only owner-decision audit into the same evidence artifact. It
adds no execution capability, retry, approval path or catalogue writer. The
next gate is green CI/merge, followed by one worker dispatch to classify and
resolve the exact five requests from real production evidence. Evidence:
[`evidence/RA-STAB-01-FIT-WHEY-QUEUE-WORKER-AUDIT-2026-10-05.json`](evidence/RA-STAB-01-FIT-WHEY-QUEUE-WORKER-AUDIT-2026-10-05.json).

**5 October approved Review Queue evidence incident — shared correction
prepared:** PR `#223` merged the worker-evidence repair as
`7f5413d5e365da9c2066e8fec1737d3ad47e3161`; main quality gate run
`37353830120` and production deployment passed. Worker run `37354078264` then
produced usable evidence and failed closed with zero database writes for the two
remaining queued Fit House requests: reviews `1110` / offer `1938` and `1111` /
offer `1982`, both with `APPROVAL_AUDIT_MISSING`. The accompanying SELECT-only
audit proves both exact immutable `PENDING -> APPROVED` owner events still
exist. The cause is the shared queue publisher's `REFRESH`: it retained the
approved status but replaced the denormalized decision actor with
`automation-review-publisher`. This was a control-evidence lifecycle defect,
not a retailer-source or owner-decision failure.

The bounded correction changes the existing shared publisher to preserve an
exact matching `APPROVED` row instead of refreshing it. The existing worker now
requires the exact fingerprint-bound immutable approval event to be authored by
`authenticated-admin`; it no longer requires the mutable queue-row actor to
duplicate that event actor. A mixed pending/approved regression proves pending
evidence is still refreshed, exact approved evidence is untouched, a
non-admin approval event remains blocked, and no new workflow, adapter,
approval path, retry or writer is added. The next gate is green quick/full CI,
merge and deployment, then one worker dispatch for the two already queued
requests followed by a read-only result check. The three earlier requests that
are already terminal are not replayed. Evidence:
[`evidence/RA-STAB-01-APPROVED-REVIEW-EVIDENCE-FREEZE-2026-10-05.json`](evidence/RA-STAB-01-APPROVED-REVIEW-EVIDENCE-FREEZE-2026-10-05.json).

**Production closeout:** PR `#224` merged as
`9a09f32ffdc3743fd00f3cb8614ce3554184f14c`; main quality gate
`37355848287`, Project Guardian `37355848311` and production deployment
`6866800222` passed. The first post-deployment worker run `37356216755`
processed zero rows because the prior failed attempts had already moved the two
remaining requests to their terminal `EXPIRED` state; it made zero database
writes and did not replay them. A fresh Fit House run `37356399740` then passed
the full protected path: `286` approved mappings, `272` freshness-only
executions, `14` review rows, zero commercial/catalogue/history deltas,
postflight and idempotency `PASS`. Its queue publication created seven fresh
pending cards for offers `697`, `735`, `921`, `944`, `1904`, `1938` and `1982`
and refreshed seven already-pending cards, for `14` active review cards and zero
catalogue writes. The seven former approvals cannot be transferred to new
review IDs; those exact cards require a new owner decision. Future exact
approved cards are now preserved by the shared publisher. This owner-requested
manual run does not increment the ordinary observation counter; RA-STAB-01
remains `IN_PROGRESS` at `0/3`.

**5 October 10 Reps source recovery and guarded execution — production
verified:** after the owner confirmed that the external site was responding,
manual shared-workflow run `37357956664` completed in `16m22s` on merged commit
`458756faebb7f60ba43321f9ed2e412a06702455`. It read all 950 approved mappings,
executed 934 safe rows and isolated the same 16 missing-source variants as
review with zero blocked rows. Of the executable rows, 933 were freshness-only
confirmations and offer `3713` received the sole commercial change: price
`7.69 -> 3.99`, with stock unchanged. Postflight passed with 934 freshness
updates, one price-history row and zero product, variant, mapping or offer-row
count deltas. A fresh-source idempotency pass made zero database writes.

The source outage is therefore closed and the earlier expired-plan recovery did
not recur. This workflow has no 10 Reps Review Queue publication stage, so the
16 rows are preserved in the run report but this evidence does not claim that
fresh admin cards were published. The next bounded gate is to reuse the existing
shared Review Queue builder and publisher for exactly those 16 rows, without a
new importer, approval path, executor or catalogue write. Because this was a
manual run, the ordinary observation counter remains `0/3`. Evidence:
[`evidence/RA-STAB-01-10REPS-SOURCE-RECOVERY-EXECUTION-2026-10-05.json`](evidence/RA-STAB-01-10REPS-SOURCE-RECOVERY-EXECUTION-2026-10-05.json).

**5 October 10 Reps Review Queue publication — locally verified, deployment
pending:** commit `ec8bc1a` converts the existing Fit House source binder into
one profile-driven shared retailer adapter and replaces the Fit-only queue job
with one shared job for Fit House and 10 Reps. The implementation still uses the
existing artifact-bound source contract, read-only production baseline, common
publisher planner and single transactional publisher RPC. It adds no importer,
approval path, executor, database function or direct queue writer.

The adapter accepts the real successful run `37357956664` as exactly `950`
approved mappings, `934` executed rows, `16` missing-source review rows and zero
blocked rows. It separately binds the `933` freshness-only confirmations and
the one executed price change, so a commercial row cannot be mistaken for a
no-change row. The exact 16 review offer IDs are `2853`, `2854`, `2855`, `2856`,
`2857`, `2858`, `2859`, `2896`, `2897`, `2898`, `2913`, `2914`, `3384`, `3388`,
`3496` and `3627`. Every resulting card is `MANUAL_REVIEW_IDENTITY` with
`SOURCE_MISSING`, proposes `KEEP_UNCHANGED`, authorizes no automatic catalogue
action and preserves approved-row immutability plus stale-state guards.
Focused publisher/source tests pass `43/43`; the real production artifact
contract, quick/full gates, Project Guardian and the production build pass.
Preparation made zero production writes. The next gate is green merge followed
by one fresh guarded 10 Reps apply and verification of its queue publication
artifact and production readback. Evidence:
[`evidence/RA-STAB-01-10REPS-REVIEW-QUEUE-PUBLICATION-PREPARATION-2026-10-05.json`](evidence/RA-STAB-01-10REPS-REVIEW-QUEUE-PUBLICATION-PREPARATION-2026-10-05.json).

**5 October Review Queue/execution decoupling — locally verified, deployment
pending:** fresh 10 Reps run `37364486648` again produced the exact healthy
`950 = 934 safe no-change + 16 review + 0 blocked` classification, but its apply
timed out during the thirteenth of 19 protected children. Read-only production
comparison proves that the first 12 children changed freshness only for 591
offers and made zero price, stock, URL, mapping, identity, price-history or row
count change. The queue job was nevertheless skipped because publication was
incorrectly conditional on the entire unrelated safe execution completing.

The common correction now seals the fresh classification and full database
baseline before apply. Queue reconciliation may continue after a later apply
failure, but only when every executable row is `VERIFY_NO_CHANGE`, all review
rows form the exact complete partition, no row is blocked, the artifact hashes
match and current production identity and commercial state still match the
sealed baseline. A shared `review-only` operation performs only fresh dry-run,
read-only baseline, binding, reconciliation and the existing transactional
queue publication; it never registers or executes a catalogue control plan.
No importer, approval path, executor, database function, retailer condition in
shared core or direct catalogue writer was added. The focused suite passes
`22/22`, including a regression that overwrites the ordinary reports with a
later partial-execution failure while the sealed review evidence remains valid.
The real incident artifact validates as exactly 934/16/0. Preparation made zero
production writes. Next gate: green CI and merge, followed by one 10 Reps
`review-only` dispatch and read-only proof of exactly 16 queue cards with zero
catalogue/control writes. Evidence:
[`evidence/RA-STAB-01-REVIEW-PUBLICATION-EXECUTION-DECOUPLING-2026-10-05.json`](evidence/RA-STAB-01-REVIEW-PUBLICATION-EXECUTION-DECOUPLING-2026-10-05.json).

**6 October Review Queue/execution decoupling — live verified:** PR `#228`
merged as `7ce7242` after full CI passed. The one bounded 10 Reps
`review-only` run `37370980156` completed from that exact commit. Fresh source
classification remained `950 = 934 VERIFY_NO_CHANGE + 16 review + 0 blocked`.
Catalogue apply, control registration, postflight and idempotency were all
skipped by the reviewed workflow mode. The existing shared publisher created
exactly 16 queue cards with zero refresh, supersede, resolve or catalogue
write. Independent production readback on 6 October found those exact 16 offer
IDs, all `PENDING`, identity-review, source-missing and review-only, all bound
to run `37370980156`. It compared all 950 catalogue rows with the sealed
pre-publication baseline and found every commercial, identity, URL and
freshness field unchanged. Products, variants, mappings, offers and price
history counts remained exactly `1337/3632/3758/3758/27666` before and after.
This closes the queue-publication coupling incident. It does not close the
older partial 10 Reps control plan or advance the natural `0/3` observation
counter; those remain separate stabilization work.

**6 October partial-plan recovery — shared fix, live verified:** the initial
repeatable-read production preflight of parent
`f945e4f1-00d2-462e-9646-5acb878469a8` proves the exact incident state rather
than inferring it from the failed workflow. The parent is `PARTIALLY_APPLIED`;
children `0..11` are `APPLIED` with 12 successful apply runs, 591 consumed row
approvals and 12 ready recovery manifests; child `12` is one expired,
unconsumed `APPROVED` boundary; children `13..18` remain `PLANNED`. There are no
failed/started runs, recovery approvals or recovery audit rows. Catalogue counts
remain `1337/3632/3758/3758/27666`.

The common correction extends the existing
`close_expired_retailer_offer_sync_approval(jsonb)` path. It accepts only a
complete applied prefix followed by exactly one expired approved child and a
planned suffix, verifies the successful run, row-approval and ready-recovery
evidence for every preserved child, then closes the active approval and marks
only the unexecuted suffix plus parent `SUPERSEDED`. It adds no retailer name or
ID condition, importer, approval path, executor or business-table writer. The
exact `12 + 1 + 6` regression preserves all 591 row approvals and expects only
nine control writes with zero catalogue/history writes. Focused tests and both
local quality gates pass. A production-schema rehearsal selected only migration
`20261006120000`, compiled successfully against ledger 224, proved unchanged
catalogue counts and rolled back completely. The earlier ordinary run
`37357956664` already proves all 934 safe operations, so it must not be repeated
merely for evidence. PR `#230` merged as `bba6bf3`; the one common migration was
then applied successfully. The production ledger is now 225 with fingerprint
`4981529d078bc0c4dc5d0597b3a6327f44270e76f4cca1a93483abe4c950cf9f`,
all five catalogue counts remained unchanged. PR `#231` then synchronized the
repository to the exact ledger-225 contract as merge commit `8dca00b`; project,
quick, full and CI gates passed.

One guarded workflow run `37426502233` took its own fresh read-only preflight
and closed the exact suffix once, with no retry. It preserved all 12 applied
children and 591 row approvals, marked only the seven unexecuted children and
the parent `SUPERSEDED`, and reported exactly nine control writes, zero business
writes and zero price-history writes. An independent repeatable-read readback
then found exactly `12 APPLIED + 7 SUPERSEDED`, 12 apply runs, 591 row
approvals, 13 batch approvals and 12 recovery manifests. Catalogue counts were
still exactly `1337/3632/3758/3758/27666`, and the read-only transaction was
rolled back. The partial-plan blocker is therefore closed without replaying the
already-proved 934 operations. The next gate is a fresh exact Review Queue
exception inventory, followed by shared guarded Review Queue execution and
status-monitoring completion.
Evidence:
[`evidence/RA-STAB-01-PARTIAL-PLAN-RECOVERY-PREPARATION-2026-10-06.json`](evidence/RA-STAB-01-PARTIAL-PLAN-RECOVERY-PREPARATION-2026-10-06.json).

**6 October exact Review Queue inventory — live verified:** a fresh independent
production transaction ran at repeatable-read, read-only isolation and rolled
back. It found exactly the current 14 Fit House stock-change cards and 16
10 Reps source-missing identity cards, all `PENDING`, with no active execution
request for either set and no owner decision recorded since midnight UTC. The
Fit House offer IDs are `697, 735, 921, 944, 951, 953, 954, 963, 972, 983,
1859, 1904, 1938, 1982`. The 10 Reps offer IDs are `2853, 2854, 2855, 2856,
2857, 2858, 2859, 2896, 2897, 2898, 2913, 2914, 3384, 3388, 3496, 3627`.
The 10 Reps rows remain intentionally review-only: their source is missing, so
there is no safe commercial operation to execute. This proves the exact
publication scope; it does not authorize or simulate a decision. The next gate
is to extend the one existing guarded Review Queue execution path while keeping
identity conflicts non-executable and avoiding a retailer branch in shared
core. Evidence:
[`evidence/RA-STAB-01-CURRENT-REVIEW-QUEUE-INVENTORY-2026-10-06.json`](evidence/RA-STAB-01-CURRENT-REVIEW-QUEUE-INVENTORY-2026-10-06.json).

**6 October shared Review Queue execution registry — merged and live-idle
verified:** the existing app adapter, queue worker and shared retailer worker now
consume one typed configuration registry instead of maintaining separate
execution allowlists. The existing eBay and Fit House behavior remains
registered, and 10 Reps joins the same shared protected worker for
`UPDATE_STOCK` only: one exact owner-approved stock decision plus 19 unchanged
freshness confirmations. It uses the existing 10 Reps feed profile, validator,
approver, executor, postflight and atomic mixed-batch path. No runtime,
importer, approval path, executor, RPC or catalogue writer was added.

The current 16 10 Reps `MANUAL_REVIEW_IDENTITY/SOURCE_MISSING` rows remain
default-deny and cannot be executed. Price, combined price/stock and identity
operations are not enabled for 10 Reps. A queue run also executes at most one
shared retailer profile, leaving a different profile queued for the next run;
this prevents the existing process-bound engine configuration from crossing
between Fit House and 10 Reps. Focused regressions execute the same guarded
stock-decision contract for both profiles and cover mixed-profile deferral.
Admin tests, TypeScript, quick/full gates and the production build passed.
PR `#233` merged as `907fdbab`; its full Quality Gate, Project Guardian,
GitGuardian and Vercel checks were green. One ordinary guarded worker dispatch,
run `37430887924`, loaded that exact merge, passed its seven focused runtime
tests and completed with `processed=0`, `failed=0` and `database_writes=0`.
Artifact `11396254362` has SHA-256
`31210eeb840c261c3d71fe9ebf749847a6a921c316e097b4c1bd1c1ac53e55c8`.
This proves the shared registry is deployed and safely idle; it does not pretend
that a 10 Reps commercial change occurred. A live 10 Reps write must wait for a
genuine fresh owner-approved `UPDATE_STOCK` row and must not be manufactured for
proof.
Evidence:
[`evidence/RA-STAB-01-SHARED-REVIEW-EXECUTION-REGISTRY-PREPARATION-2026-10-06.json`](evidence/RA-STAB-01-SHARED-REVIEW-EXECUTION-REGISTRY-PREPARATION-2026-10-06.json).

**6 October Review Queue monitoring status — merged and live verified, natural
schedule readback pending:** production run `37430887924` exposed the next common monitoring
defect. The owner-decision audit correctly found 33 items needing attention and
the worker remained healthy with zero writes, but the audit used exit code `2`,
so GitHub displayed a red error annotation for a non-failure. The existing audit
and existing five-minute queue schedule now use three explicit states:
`SUCCESS`, `WAITING_FOR_DECISION` and `FAILED_SYSTEM`. Waiting/review debt exits
normally; only a defined system-integrity failure exits red and prevents the
worker from running. The same workflow publishes the counts in its GitHub
summary. No second monitor, schedule, executor or write path was added. Focused
regressions plus the quick and full Quality Gates passed. PR `#234` merged as
`b52af90b`; Quality Gate, Project Guardian, GitGuardian and Vercel were green.
Live run `37432645097` then reported `WAITING_FOR_DECISION`, 377 pending owner
decisions, 33 review-attention findings, zero system failures, zero processed
requests and zero database writes. The audit step and entire job were green,
with no false error annotation. Artifact `11397791609` has SHA-256
`9c606065f6f978efaa2e81b7673f0ec7ffa4cb3fafd4e39d48015cbc8df61c67`.
This proves the production classification and fail-closed worker handoff. A
later natural scheduled run on the merge remains the final schedule readback;
it does not block work on the next retailer. Evidence:
[`evidence/RA-STAB-01-REVIEW-MONITORING-STATUS-PREPARATION-2026-10-06.json`](evidence/RA-STAB-01-REVIEW-MONITORING-STATUS-PREPARATION-2026-10-06.json).

**6 October Whey Okay guarded Review Queue execution and shared selection
cleanup — merged and live-idle verified:** Whey Okay now joins the same
closed execution registry and the same shared retailer worker for
`UPDATE_STOCK` only. The worker selects the retailer engine from one validated
module path in the registry and requires one common interface; it contains no
Whey Okay, Fit House or 10 Reps name/ID branch. The existing Whey Okay reader,
589-row manifest, validator, partial control registration, approver, executor
and postflight remain authoritative. No importer, approval path, executor, RPC,
schedule or catalogue writer was added.

The formerly Fit House-local selection of one stock-only decision plus 19
unchanged in-stock freshness confirmations is now one shared module used by
both existing engines. Price, combined price/stock, identity and source-missing
Whey Okay rows remain review-only/default-deny. Fresh source, immutable review
fingerprints, exact database before-state, role separation, postflight and
idempotency remain mandatory; stale evidence stops before registration. The
focused registry/selection/worker suite passes `5/5`, and the complete admin
plus Whey Okay suites pass `80/80`. Project Guardian before and after the
documentation change, the quick gate and the full gate all pass with zero
production/control writes during preparation. PR `#236` merged as `c4c680da`
after full Quality Gate, Project Guardian, GitGuardian and Vercel passed.

One production worker dispatch, run `37435625993`, checked that exact merge,
passed all `7/7` focused runtime tests and completed green. Monitoring reported
`WAITING_FOR_DECISION`, 377 pending owner decisions, 33 review-attention items
and zero system failures. The queue processed zero requests and made zero
database writes because no fresh eligible request existed. Artifact
`11398886676` has SHA-256
`0518d42e9a216d544778f67a29956a23056ff04a3288721f01caa17b65be115d`.
This proves deployment and safe idle behavior, not a Whey Okay commercial
write. A genuine fresh owner-approved `UPDATE_STOCK` request remains required
before commercial execution can be claimed; none will be manufactured for
proof. Evidence:
[`evidence/RA-STAB-01-WHEY-OKAY-REVIEW-EXECUTION-PREPARATION-2026-10-06.json`](evidence/RA-STAB-01-WHEY-OKAY-REVIEW-EXECUTION-PREPARATION-2026-10-06.json).

**6 October Whey Okay Review Queue publication and shared-core cleanup — merged
and live verified:** the existing Whey Okay workflow now has the
same `review-only` publication route as the shared Fit House/10 Reps workflow.
It performs a fresh ordinary dry-run, captures the existing read-only database
baseline, seals the classification plus immutable Whey preflight and sends the
result through the existing shared reconciliation and protected publication
RPC. This mode does not register or execute a catalogue plan. The ordinary
schedule uses the same bound publication after its existing guarded apply.

This was not implemented as a third branch in shared core. Retailer source-file,
partition and review-card differences now live in one closed profile module.
The prior Fit House-versus-10 Reps branches were removed from the shared source,
and workflow identity is profile data rather than a Fit House constant. The
Whey profile requires the exact 589-row partition, currently represented by
579 executable `VERIFY_NO_CHANGE` rows plus ten
`SOURCE_VARIANT_MISSING` review rows. Those ten become read-only identity cards;
they cannot become stock, price or identity writes. A changed count above the
current ten-row boundary, an overlap, a missing artifact, hash/commit/source
drift, stale evidence or any preflight write fails before publication.

Focused Fit House, 10 Reps, Whey, router and workflow regressions pass `65/65`,
including immutable-artifact tampering and a source scan proving no retailer
key branch remains in shared core. Project Guardian before the change, the
quick gate (`544` passed, three artifact-bound skips), the full gate, production
build and `git diff --check` all pass. PR `#238` merged as `ea217795` after full
Quality Gate `37448030302`, Project Guardian `37448030593`, GitGuardian and
Vercel passed.

The exact merged `review-only` run `37448387527` then reproduced the fresh
partition `589 = 579 VERIFY_NO_CHANGE + 10 SOURCE_VARIANT_MISSING + 0 blocked`.
Catalogue apply, apply postflight and apply idempotency were all skipped. The
existing protected publisher created exactly ten cards and performed no
refresh, supersede or source resolution. The cards are for offers `16, 1506,
1507, 1508, 1509, 1510, 1511, 1512, 1568, 1584`. Artifact `11403839254` has
SHA-256 `b84953fab528ff12c9b0dd5eeb9b4b5eaa4e625eb7fddee74fd0a1b66f1ef6db`;
queue artifact `11403424148` has SHA-256
`36b86e9fc3e1b508e831bb0fd0f929d80e47e162fa494b8667535352c7d7d586`.

An independent production read at `2026-10-06T10:18:44.674Z` found those exact
ten rows, all `PENDING`, identity/source-missing and `KEEP_UNCHANGED`, with zero
execution requests. Every current commercial and canonical identity field
matched the sealed before-state. Catalogue counts remained exactly
`1337/3632/3758/3758/27666` for products, variants, mappings, offers and price
history. The publisher transaction made 21 Review Queue/audit writes for ten
new cards, but zero catalogue or retailer-control writes. This closes fresh
Whey Okay Review Queue publication; a later commercial execution still requires
a genuine owner-approved executable stock decision and will not be fabricated
for proof. Evidence:
[`evidence/RA-STAB-01-WHEY-OKAY-REVIEW-PUBLICATION-PREPARATION-2026-10-06.json`](evidence/RA-STAB-01-WHEY-OKAY-REVIEW-PUBLICATION-PREPARATION-2026-10-06.json).

**6 October Fit House classifier-coverage correction and Review Queue
publication — merged and live verified:** scheduled run `37442830504` produced
valid fresh evidence for the exact ordinary partition `286 = 272 executable +
14 review + 0 blocked`, but the shared source binder incorrectly required the
classifier itself to contain only the 272 executable rows. Fit House correctly
classifies the complete 286-row scope because its 14 review rows are genuine
stock changes; 10 Reps correctly classifies only its 934 executable rows because
its 16 source-missing rows are quarantined before classification.

The correction does not add a Fit House branch to shared core. Classifier
coverage is now closed retailer-profile data: `full-partition` for Fit House and
`executable-only` for 10 Reps. The validator derives the expected IDs and count
from that contract and, for a full partition, also binds the classifier changed
IDs to the exact review IDs. The incident regression uses the production shape
and proves that omitting even one of the 286 approved IDs fails closed. The
previously failed run artifact now seals successfully without changing its
source bytes.

Focused publication tests pass `26/26`; quick gate passes `544` with the three
expected artifact-bound skips; full gate, production build, Project Guardian
before/after and `git diff --check` pass. PR `#240` merged commit `b1566fd` as
`cc4131a` after Quality Gate `37450521796`, Vercel and GitGuardian passed. The
post-merge Quality Gate `37450827077` also passed.

Exact merged `review-only` run `37450876753` then reproduced 272 safe
confirmations and the same 14 stock-review rows. Catalogue apply, apply
postflight and apply idempotency were skipped. The protected publisher refreshed
13 pending cards and preserved one matching approved card immutably; it made 27
queue/audit transaction writes and zero catalogue writes. Source artifact
`11407072137` has SHA-256
`1ece5f31020be305c8c64754e7677b0d26def3576a2fec1b7b740a172dc95763`;
queue artifact `11406537671` has SHA-256
`324cec2eaeb7d69e23293fc80e03cb6c8f8f4e20ce7614c363537e5618595fea`.

An independent read-only production check at `2026-10-06T10:41:21.525Z`
found the exact 14 active Fit House cards for offers `697, 735, 921, 944, 951,
953, 954, 963, 972, 983, 1859, 1904, 1938, 1982`. Thirteen are pending with
fresh run evidence. Review `1121` / offer `1982` remains approved with its
immutable decision evidence; it has no execution request and was not silently
executed. All current commercial and identity fields still equal the published
before-state. Catalogue counts remain `1337/3632/3758/3758/27666`, proving zero
catalogue change. The separate owner execution confirmation remains required
for offer `1982`; no request will be manufactured for proof. RA-STAB-01 remains
`IN_PROGRESS` pending the next ordinary schedule/watchdog observation. Evidence:
[`evidence/RA-STAB-01-FIT-HOUSE-REVIEW-PUBLICATION-LIVE-READBACK-2026-10-06.json`](evidence/RA-STAB-01-FIT-HOUSE-REVIEW-PUBLICATION-LIVE-READBACK-2026-10-06.json).

**6 October exact Review Queue watchdog baselines — merged and live
verified:** the shared watchdog configuration now binds the owner-approved Fit
House 14-row and 10 Reps 16-row review scopes to their exact offer IDs and the
canonical decision-evidence SHA. This is configuration data consumed by the
existing common monitored-backlog mechanism; no retailer branch, writer,
workflow, approval path or executor was added. A common regression proves the
exact scopes classify within baseline and substitution of even one offer fails
closed with `REVIEW_SCOPE_DRIFT`. Infrastructure, ordinary-run, write and
postflight failures remain unsuppressed.

PR `#242` merged as `13e9abf` after Quality Gate `37453727301`, Vercel and
GitGuardian passed; post-merge Quality Gate `37454059471` also passed. Full gate,
production build, quick gate (`544` pass and three expected artifact-bound
skips), all 46 catalog-health tests, Project Guardian and `git diff --check`
pass.

Read-only production watchdog `37454182407` on that exact merge made zero
database writes. 10 Reps now reports `PASS_WITH_REVIEW` with exactly 16 review
and 16 stale rows, no failures and `WITHIN_BASELINE`. Fit House retains only the
real `LATEST_ORDINARY_ATTEMPT_INCOMPLETE` from scheduled run `37442830504`; its
exact 14 review/stale rows produce no backlog growth. The global watchdog remains
red for four genuine retailer failures, proving the change did not make real
errors green. Artifact `11409260342` has SHA-256
`9dca3563b2a6e368ba51022c53fe2f541d95aa4de52ebc16c1b6c7a33f6e181e`.
This manual observation does not increment the ordinary counter; RA-STAB-01
remains `IN_PROGRESS` at `0/3` pending the next natural schedule. Evidence:
[`evidence/RA-STAB-01-WATCHDOG-APPROVED-REVIEW-BASELINES-LIVE-READBACK-2026-10-06.json`](evidence/RA-STAB-01-WATCHDOG-APPROVED-REVIEW-BASELINES-LIVE-READBACK-2026-10-06.json).

**6 October shared owner-decision bridge — merged and production migration live
verified:** the failed execution of approved Fit House review `1121` / offer
`1982` was traced to a contract gap, not bad source data. The ordinary generic
limits accepted the proposed one-row stock change, but the legacy Fit House
stable-OOS validator could not see the immutable Review Queue approval and
failed closed with `RSBI_GUARDRAIL_EXCEEDED`; catalogue writes remained zero.

The correction is one retailer-neutral owner-decision contract used by the
existing shared worker, Fit House engine and Whey Okay engine. It binds the
exact request, review, approval audit event, retailer, operation, fingerprints,
actor, timestamps, expiry, one changed stock row and nineteen unchanged
confirmations before delegating to the existing generic database validator.
It adds no importer, approval path, executor, direct database writer, retailer
ID branch or offer exception. Ordinary non-review requests retain their current
validators unchanged.

PR `#248` merged commit `ac4e888` as `6cf64e3` after full Quality Gate,
Project Guardian, baseline, Vercel and GitGuardian checks passed. The separately
owner-authorized migration
`20261006170000_add_automation_review_owner_decision_validation.sql` was first
rehearsed with rollback and then applied alone. Production advanced to ledger
`226`, fingerprint
`28ac0182d477dec9b85ffa3aea4a777d11715a0c52cd9ca9ba2d4fe6d76c030c`.
All catalogue counts remained exactly `1337/3632/3758/3758/28213`.

The read-only postflight confirms the helper exists, the ordinary route remains,
and only `retailer_catalogue_production_validator` has execute permission;
public, anon, authenticated, service role, approver and executor are denied.
Review `1121` remains approved and unexecuted, and its failed request remains at
zero database writes. No queue run, retry, replay or offer change occurred.
RA-STAB-01 remains `IN_PROGRESS` at `0/3`. The remaining sequence is one fresh
approved stock request, exact postflight/idempotency, then ordinary observation.
Evidence:
[`evidence/RA-STAB-01-OWNER-DECISION-BRIDGE-PREPARATION-2026-10-06.json`](evidence/RA-STAB-01-OWNER-DECISION-BRIDGE-PREPARATION-2026-10-06.json).

**6 October owner-decision postflight finalization incident:** exact request
`976f67b4-c06c-4f73-a3c6-48ca63f45dfd` in run `37492690030` executed its
bounded `1 + 19` scope and passed database postflight. Offer `1982` is already
`in_stock=false`; price, shipping, total, URL and mapping are unchanged. The
subsequent idempotency rebuild failed before source fetch because the legacy
Fit House stable-OOS state guard saw the newly approved OOS row without the
applied decision context. This is a finalization/control-status defect, not an
apply failure, and the request must not be retried.

The prepared correction is retailer-neutral: the shared worker seals the exact
applied stock transition into fresh-source idempotency, persists successful
postflight before that check, and retains pessimistic writes in failed batch
reports. The existing queue workflow has a mutually exclusive recovery mode;
it downloads the original artifact, repeats database postflight and
fresh-source idempotency, and only then calls a control-only, non-replay RPC.
It creates no importer, executor, approval path or catalogue writer and adds no
retailer ID branch to shared core. Owner-authorized migration
`20261006190000_add_automation_review_verified_postflight_recovery.sql` was
applied with production ledger `227`, fingerprint
`89b59678999d7d564a5a9a304e0307f8771a82b86afd8a95ce378eb3ea3f461e`
and zero catalogue-count change. Local focused tests, repository quick/full
gates and PR 250 required CI pass. The exact disposable-PostgreSQL
recovery regression passes in run `37497626481` (job `112386140281`); the full
integration suite remains red only on pre-existing Predators Gear, nutrition
and stale expired-close evidence tests.

The single authorized live recovery run `37501471469` then failed closed before
the control RPC on `Fit House protected-offer stable OOS baseline drift`. It
made no catalogue or control write and was not retried. The first stable-OOS
guard had the sealed transition, but a second existing Fit House reconciliation
guard still used the old count. The follow-up correction passes the same bounded
zero-or-one allowance through both existing guards, adds no offer ID exception
and closes migration `20261006190000` in the repository selector at ledger
`227`.

The owner-authorized second and final recovery run `37503672017` on merge
`66639cfd` passed the original artifact binding, repeated database postflight
and fresh-source idempotency. It returned `control_status=EXECUTED`,
`catalogue_writes=0`, exact offer `1982`, 19 freshness confirmations, one
historical stock delta and zero price, shipping, total, URL, mapping or price
history delta. The request and review are now `EXECUTED`; no further recovery
is needed or authorized. The workflow's final read-only audit alone failed on
`EXECUTED_EVIDENCE_INCOMPLETE`: it required ordinary `expected_deltas` and did
not yet recognize the sealed `VERIFIED_POSTFLIGHT_RECOVERY` event. The pending
reporting-only correction accepts that event only when its postflight hash,
executed offer, actual deltas, database-write evidence and idempotency result
match the recovered request. It performs no write. Focused, quick and full
quality gates passed. A fresh production read-only audit at
`2026-10-06T17:35:54.242Z` then returned `PASS_WITH_REVIEW` /
`WAITING_FOR_DECISION`, with `403` pending owner decisions, `33`
review-attention findings and `0` system failures. Review `1121` and request
`976f67b4-c06c-4f73-a3c6-48ca63f45dfd` are `EXECUTED` and have no audit
anomaly. This closes the false reporting failure without another recovery.
RA-STAB-01 remains `IN_PROGRESS` at `0/3` ordinary intervals. Evidence:
[`evidence/RA-STAB-01-REVIEW-POSTFLIGHT-FINALIZATION-PREPARATION-2026-10-06.json`](evidence/RA-STAB-01-REVIEW-POSTFLIGHT-FINALIZATION-PREPARATION-2026-10-06.json).

**7 October natural watchdog and review-backed waiting classification — shared
correction live-verified:** scheduled watchdog `37578070655` ran on merge `cf7cae8`
after the zero-step orphaned read-only run `37510180895` was cancelled to release
the watchdog concurrency group. It made zero database writes and truthfully kept
Fit House red because its latest ordinary shared run `37442830504` is incomplete.
10 Reps is `PASS_WITH_REVIEW` on that same run and Whey Okay retains a complete
ordinary success. The watchdog also exposed three backlog-growth failures:
Jon's `5/5`, 6 Pack `14/14` and eBay `68` stale offers covered by `79` review
rows. Production readback proves eBay has all `79` active Review Queue rows and
its same ordinary run completed the queue-publication job. Jon's and 6 Pack
have no active rows for those scopes, so they remain system failures rather
than being relabelled as owner waiting.

The shared correction adds explicit `SUCCESS`, `WAITING_FOR_DECISION` and
`FAILED_SYSTEM` watchdog status. Backlog outside the frozen baseline becomes
waiting only when stale and review ID evidence is complete and unique, every
stale offer is covered, the same ordinary workflow run successfully published
that retailer's Review Queue rows, and no unexpected failure is present.
Missing publication, incomplete evidence, an uncovered stale offer,
infrastructure failure or write evidence remains red. No ceiling, allowed-ID
list, retailer branch, monitor, schedule, credential or write path was added.
Focused, quick and full tests passed. PR `#253` merged as `14db78b`; its required
CI passed. Read-only watchdog `37581684482` then verified the contract with zero
database writes: eBay became `PASS_WITH_REVIEW` with
`REVIEW_BACKED_BACKLOG_OUTSIDE_BASELINE`, while Fit House, Jon's and 6 Pack
remained red for their real unresolved conditions. The run's overall
`FAILED_SYSTEM` result is therefore expected and fail-closed, not a failed
deployment. This does not advance the `0/3` ordinary interval counter. Evidence:
[`evidence/RA-STAB-01-WATCHDOG-REVIEW-BACKED-WAITING-PREPARATION-2026-10-07.json`](evidence/RA-STAB-01-WATCHDOG-REVIEW-BACKED-WAITING-PREPARATION-2026-10-07.json).

**7 October Jon's and 6 Pack durable Review Queue publication — shared
extension prepared:** production evidence shows Jon's ordinary run `37457004820`
partitioned `506` offers into `501` executable and `5` source-missing review
rows, while 6 Pack run `37448175548` partitioned `506` into `492` executable
and `14` review rows. Neither retailer had active Review Queue rows, so the
watchdog correctly kept both red. The existing shared publisher now accepts
profile-defined source envelopes and card semantics without retailer branches
in shared core. Each workflow seals its pre-execution classification before
apply and publishes only through the existing guarded reconciliation RPC.
Jon's rows are identity-review-only. 6 Pack source-missing rows are identity
review and its price/mass-OOS rows are policy-review-only. Neither retailer is
added to the execution-adapter registry, so these cards cannot execute catalogue
changes. No queue, publisher, executor, credential or direct database path was
added. Focused `77/77`, quick `547` and full quality gates passed. PR `#255`
passed Quality Gate run `37587513945`, Project Guardian run `37587514008`,
Vercel and GitGuardian, then merged as `64c29f6`. Only the next natural schedule
readbacks remain; no retailer workflow was manually dispatched. This does not
advance the `0/3` ordinary interval counter. Evidence:
[`evidence/RA-STAB-01-JONS-SIX-PACK-QUEUE-PUBLICATION-PREPARATION-2026-10-07.json`](evidence/RA-STAB-01-JONS-SIX-PACK-QUEUE-PUBLICATION-PREPARATION-2026-10-07.json).

**7 October Review Queue work dashboard — shared UX preparation:** the existing
authenticated Review Queue now separates exact owner work from technical and
system-owned rows. It adds owner decision, approved-to-execute, processing,
technical and completed counters; per-retailer progress; a completed-today
count; a one-row work mode; and a compact list mode. Search loads the same
bounded complete queue and searches all statuses before pagination. After a
decision, a same-origin allowlisted return path drops pagination and returns to
the first remaining matching row, while external redirects are rejected.
Advanced filters and bulk actions remain available but collapsed.

This is one retailer-neutral UI/read-only classification change. It adds no
queue, publisher, executor, RPC, credential or catalogue write path. Existing
authentication, fingerprint, expiry, stale-state, confirmation, approval and
separate execution guards are unchanged. Focused admin tests pass `57/57`,
TypeScript and changed-file ESLint pass, and quick verification passes `547`
tests (`544` pass, `3` skip); the full production-build gate also passes. PR
`#257` merged as `eb72ca4`; GitHub CI, Vercel production deployment and the
authenticated read-only production dashboard readback all pass. Evidence:
[`evidence/RA-STAB-01-REVIEW-QUEUE-WORK-DASHBOARD-PREPARATION-2026-10-07.json`](evidence/RA-STAB-01-REVIEW-QUEUE-WORK-DASHBOARD-PREPARATION-2026-10-07.json).

**7 October Review Queue remaining-work navigation correction:** owner readback
confirms nine recent recorded decisions, six queued execution requests and three
approvals without an execution request (offers `2689`, `2703`, `2704`). An
`APPROVED` review remains approved while its request waits in `QUEUED`; the old
dashboard therefore returned to already-submitted cards. The shared read model
now reads bounded complete execution state before classification and pagination.
Queued, dispatched and executing requests leave owner work immediately. Changed
request fingerprints are technical attention, and an incomplete read disables
actions. Return redirects and next/previous navigation target the working-card
anchor; sticky counters show today's submissions, completed decisions and
remaining steps. Expired evidence no longer counts as completed owner work.
Focused `59/59`, quick and full verification pass. PR `#259` merged as
`73616f7` after green CI and Vercel production deployment. Authenticated
read-only production check at `12:22:51 UTC` confirms only offers `2703` and
`2704` remain in EXECUTE, while all six queued requests appear in PROCESSING.
Offer `2689`'s previous review expired. Sticky counters and the card anchor are
present. The six requests remain queued, not completed; this UI proof does not
close their execution or the RA-STAB-01 natural intervals.
No queue/executor/RPC, production submission or guard change is added.
Evidence: [remaining-work navigation](evidence/RA-STAB-01-REVIEW-QUEUE-PENDING-NAVIGATION-2026-10-07.json).

**7 October Review Queue current-versus-history search correction:** searching
eBay offer `2703` displayed two visually identical expired cards. Read-only
owner evidence identifies review `1014` from 5 October and its newer generation
`1159` from 7 October. The shared UI now uses one newest, non-superseded review
per retailer offer for ordinary work and search. A clearly labelled checkbox
can include older review generations when history is intentionally needed.
This adds no database query, write path, retailer condition or approval change.
Focused `59/59`, TypeScript, changed-file ESLint, quick/full quality gates and
merged-main CI pass. Authenticated production GET readback on merge `d6ab38c`
returns one result by default and two only with `history=1`; it submitted no
decision or execution. Evidence: [current search](evidence/RA-STAB-01-REVIEW-QUEUE-CURRENT-SEARCH-2026-10-07.json).

**7 October Fit House durable Review Queue state and 6 Pack binding correction —
prepared without threshold widening:** natural shared run `37599546370` stopped
Fit House at `110` OOS because the ordinary path counted the five still-OOS
legacy approved offers but did not read the already verified Review Queue
execution for offer `1982`. Review `1121` and request
`976f67b4-c06c-4f73-a3c6-48ca63f45dfd` prove the exact owner-approved
`true -> false` stock transition, database postflight, one stock delta,
idempotency `PASS` and the current OOS state. The existing Fit House guard now
accepts that durable evidence only when review/request fingerprints, operation,
before/after state, postflight, idempotency, executed IDs, deltas and current
offer all agree. An unproved extra OOS still blocks; the baseline remains `104`
and no offer-ID exception is added. A fresh production read-only build passes
with `273` safe rows plus `13` review rows and zero writes.

The same audit found 6 Pack run `37605681359` completed its catalogue refresh
but failed Review Queue publication because the profile used internal key
`six-pack-supplements` as the retailer slug. Production and the existing 6 Pack
connector use `6-pack-supplements`. The profile now keeps its internal key and
postflight profile unchanged while binding publication to the real retailer
slug. The exact incident regression and the combined focused suite pass
`73/73`; quick verification passes `547` tests and the full quality gate passes.
PR `#263` passed CI and merged as `fb4d211f`; post-merge Quality Gate
`37634547821`, Project Guardian `37634547774` and production deployment
`6912251322` passed. No failed artifact was replayed, no queue row was published
and no retailer workflow was manually dispatched. Natural schedule readbacks remain gates; the
ordinary counter stays `0/3`. Evidence:
[`evidence/RA-STAB-01-FIT-HOUSE-DURABLE-REVIEW-SIX-PACK-BINDING-PREPARATION-2026-10-07.json`](evidence/RA-STAB-01-FIT-HOUSE-DURABLE-REVIEW-SIX-PACK-BINDING-PREPARATION-2026-10-07.json).

**7 October Review Queue dispatch truthfulness — merged, deployed and live
verified:** the panel
already writes one immutable queued request before optional immediate GitHub
dispatch, and the existing scheduled worker is the only fallback. Production
behavior showed that immediate dispatch is not currently dependable, while the
page promised completion within a few minutes and a transient dispatch error
returned HTTP 503 after the request was already safely queued. The shared route
now records one of four delivery outcomes: immediate, scheduled fallback,
transient fallback or already-existing. The page removes the fixed-time promise,
warns against duplicate clicks, displays request time and provides a refresh
link. Dispatch failure remains server-logged but returns the owner to the real
queued state. No executor, queue, credential path, adapter, approval rule or
catalogue write changes. Focused admin tests pass `60/60`; quick and full
quality gates, the production build, Project Guardian, TypeScript and
changed-file ESLint pass. PR `#265` merged as `df9bdb50`; post-merge Quality
Gate `37637486837`, Project Guardian `37637487001` and production deployment
`6912768616` passed. Authenticated production GET readback at
`2026-10-07T14:37:18.117Z` returned HTTP 200 for all four delivery messages,
confirmed the fixed-minute promise absent and submitted zero decisions or
executions. The next evidence gate is a real queued request and natural worker
pickup; immediate dispatch still depends on the existing server-side token
configuration, not a second executor. Evidence:
[`evidence/RA-STAB-01-REVIEW-QUEUE-DISPATCH-STATUS-PREPARATION-2026-10-07.json`](evidence/RA-STAB-01-REVIEW-QUEUE-DISPATCH-STATUS-PREPARATION-2026-10-07.json).

**7 October Review Queue continuous working-set correction — merged, deployed
and live verified:** owner feedback after processing the approved execution bucket found
that the single-card work mode forced a separate `next` navigation for every
offer. Because a submitted offer correctly leaves owner work, the next card was
also labelled `1`, which made real progress look like a restart. The existing
retailer-neutral work view now renders a bounded set of at most ten full cards,
so adjacent offers use ordinary scrolling. Its sticky status says how many
remain, which range is visible and how many execution steps were submitted
today; the view labels and batch navigation no longer describe each card as a
new page-one position. The compact list remains separate.

This changes only presentation and the existing pagination constant. It adds no
queue, executor, scheduler, adapter, approval rule, retailer condition,
credential or catalogue-write path, and it does not weaken authentication,
fingerprint, expiry, stale-state or confirmation checks. A shared regression
proves the work set is capped at ten and a twelfth item remains on the second
bounded page. Focused admin tests pass `60/60`; Project Guardian, quick
verification (`547` tests: `544` pass, `3` skip) and the full production-build
gate pass. A read-only rolled-back
production snapshot at `2026-10-07T14:43:53.758Z` found no approved item waiting
for submission and no active execution request. Today's recorded execution
outcomes were five `EXECUTED` single-offer writes, four fail-closed price-drift
expiries and six fail-closed evidence expiries. None was retried. PR `#267`
merged as `d5d4677`; PR and post-merge Quality Gate and Project Guardian runs
passed, as did production deployment `6915045129` and the production-readonly
deployment `6915081828`. An authenticated GET at
`2026-10-07T16:23:55.489Z` returned HTTP 200 with the remaining count, visible
range, today-progress and non-restart explanation, and rendered exactly ten
bounded work cards. It submitted zero decisions and zero executions. Evidence:
[`evidence/RA-STAB-01-REVIEW-QUEUE-CONTINUOUS-WORKSET-2026-10-07.json`](evidence/RA-STAB-01-REVIEW-QUEUE-CONTINUOUS-WORKSET-2026-10-07.json).

**7 October Whey Okay capability description correction — merged and deployed:**
the shared Review Queue capability matrix still told the owner that Whey Okay's
current dry-run was blocked by an active/conflicting session. Natural scheduled
run `37595708904` contradicts that time-bound text: dry-run, protected apply,
database postflight, fresh-source idempotency and Review Queue publication all
completed successfully. The capability description now states only the durable
contract — approved exact-identity freshness uses the ordinary guarded
schedule — and no longer embeds transient production state in source code. A
regression requires the durable description and rejects the obsolete blocker
claim. This changes no capability, adapter, operation, workflow, queue,
credential, guard or write path. Focused admin tests pass `60/60`, Project
Guardian passes, quick verification passes `547` tests (`544` pass, `3`
skip), and the full production-build gate passes. PR `#269` merged as
`7c736f9b74b71922d84a9ceb89c9960ebd1271bb`; post-merge Quality Gate run
`37653807405` and Project Guardian run `37653807369` passed, and Vercel
deployment `3UGL5DhYurvp898GTmCAAwz9WGbx` completed successfully. The
authenticated production GET returned HTTP 200 and submitted zero decisions or
executions. It had no matching historic Whey Okay freshness row, so the
row-specific description was not renderable; the evidence records this as an
honest non-applicable live-copy check rather than claiming a rendered string.
This correction earns no ordinary interval credit.
Evidence:
[`evidence/RA-STAB-01-WHEY-CAPABILITY-DESCRIPTION-2026-10-07.json`](evidence/RA-STAB-01-WHEY-CAPABILITY-DESCRIPTION-2026-10-07.json).

**8 October KIOR child-approval timeout — shared diagnostic and control-only
recovery live verified:** scheduled run `37639033936` read a healthy complete
Shopify source and classified all `11/11` approved rows as
`VERIFY_NO_CHANGE`, but its child-approval query timed out after control
registration. It completed zero business writes and zero price-history writes.
Read-only control preflight `37739756503` then proved one exact expired,
unexecuted child: the approval was unconsumed, with zero row approvals and zero
apply runs. The shared engine now classifies this boundary as
`CONTROL_CHILD_APPROVAL_OUTCOME_UNKNOWN` and retains only safe parent/child
recovery identity; there is no KIOR branch and no approval, timeout, executor
or write-path change. The regression, quick/full gates and PR `#271` CI passed,
and the correction merged as `a685a63a`.

After exact owner authorization, run `37741754695` made one control-only close
call. Postflight proves the parent and its sole child are `EXPIRED`, the
approval is closed and unconsumed, and accounting is exactly `3` control
writes, `0` retries, `0` apply runs, `0` business writes and `0` price-history
writes. Catalogue counts remained `1337/3632/3758/3758/28784`. This recovery
does not earn ordinary interval credit; RA-STAB-01 remains `IN_PROGRESS` at
`0/3`. The next gate is a later natural KIOR schedule followed by a later
correlating read-only watchdog, not a manual replay. Evidence:
[`evidence/RA-STAB-01-KIOR-CHILD-APPROVAL-RECOVERY-2026-10-08.json`](evidence/RA-STAB-01-KIOR-CHILD-APPROVAL-RECOVERY-2026-10-08.json).

Docker run `37421724769` now proves the existing expired-close regression and
the new exact `12 + 1 + 6` fixture pass against disposable PostgreSQL. The
monolithic integration job remains red only for the same two unrelated
Predators Gear and nutrition failures already present on main run
`37331353245`; neither failure is in the RA-STAB-01 path or changed here.

**8 October owner-requested manual runtime verification and shared stable-OOS
alignment â€” shared correction deployed, fresh run pending:** sequential guarded
ordinary-path runs used the current workflows without replaying an old plan.
KIOR run `37747565164` passed: all `11/11` approved rows were executed as
freshness-only confirmations; postflight records zero price, stock, shipping,
total, URL, mapping and price-history changes and `11` freshness updates.

6 Pack run `37748035569` passed end-to-end. Its `506` offers split into `492`
safe confirmations and `14` Review Queue rows; postflight records zero
commercial or stock changes and `492` freshness updates. The repaired shared
queue-publication job then created exactly `14` cards, with zero catalogue
writes. This proves the previously failing 6 Pack publication path. These are
manual checks and do not increment the ordinary observation counter.

Fit House run `37747849842` stopped before registration or apply, with zero
database, business and control writes. The storefront capture was healthy, but
the old Fit-House-only database route rejected a `46`-row no-change batch with
zero new OOS rows because it still expected an obsolete exact OOS baseline.
The common classifier already handles this correctly: a historical OOS ratio
does not by itself constitute a new stock incident. The prepared migration
`20261008100000_align_shared_stable_oos_validation.sql` moves ordinary Fit
House traffic back to the shared validator and makes the database rule agree:
the total-OOS-ratio guard applies only when a batch introduces a new OOS row.
The new-OOS count, OOS-increase, source, identity, price, approval and all
other guards are unchanged. It adds no importer, executor, approval route,
catalogue writer or new retailer branch; the dormant legacy validator is not
deleted in this stabilization step. The first exact preflight rolled back on a
false post-check and made no persistent change. PR `#275` corrected only that
post-check. After a passing rollback rehearsal, the owner-authorized migration
with SHA-256 `500a02c99919a540e0d34485b94828f255de3e24fc9e78de9f59d94e19d36085`
was applied alone. Production is now ledger `228`, fingerprint
`c8ed22c12cd4b660703080589084fed25a7d2c14038999a65d6793b085ec9037`;
all five catalogue counts remained `1337/3632/3758/3758/28784`. The next gate
is the one authorized fresh Fit House run without retry or replay. Evidence:
[`evidence/RA-STAB-01-MANUAL-RUNTIME-AND-SHARED-OOS-PREPARATION-2026-10-08.json`](evidence/RA-STAB-01-MANUAL-RUNTIME-AND-SHARED-OOS-PREPARATION-2026-10-08.json).

**8 October fresh Fit House post-deployment run — stable-OOS fixed, concurrent
writer gap isolated:** owner-authorized run `37764996832` proved the deployed
shared validator correction: all six read-only batches passed, yielding `273`
safe confirmations and `13` Review Queue rows. The queue reconciliation
refreshed those `13` cards and wrote no catalogue row. The first apply child
then failed closed with `RSBI_EXPECTED_DELTA_MISMATCH`; its transaction rolled
back completely. Production readback found no apply run, no catalogue or
price-history change, one unconsumed expiring batch approval and unchanged
catalogue counts `1337/3632/3758/3758/28784`. No retry or replay was made.

The exact cause is cross-retailer concurrency, not Fit House data. Scheduled
6 Pack run `37763759985` was committing approved offer writes during the same
68-second Fit House transaction. 6 Pack calls the common approved import
executor directly, outside the mixed-batch wrapper that owns the existing
global write lock. The migration
`20261008120000_serialize_all_approved_offer_writes.sql` moves that same lock
into the common approved executor. This serializes both direct and mixed-batch
writes without a retailer branch, new executor, importer, approval path or
catalogue write in the migration. Its SHA-256 is
`dc06b5abce598ebca33d1d72544cd87b6bebf21a7c4cf9eb5adf35f55174a3cb`.
PR `#277` passed full CI and merged as `917fa2dfeb9a15e88884820bb4c5ec13fabd27e8`.
The exact migration then passed a rollback rehearsal and was committed alone.
Production is now ledger `229`, fingerprint
`a93a1fcb7a078cc5ce89a1d134696b6a738f3fd2e7e8c92df0a72969f615dfbc`;
catalogue counts remained `1337/3632/3758/3758/28784`. The next gate is merging
the matching production-ledger binding, expiry-safe control-only closure of the
failed Fit House plan if still open, and the one authorized fresh Fit House run
without retry or replay.
RA-STAB-01 remains `IN_PROGRESS` at `0/3` natural intervals.

The production-ledger binding passed full CI in PR `#278` and merged as
`c6a78b99e5697f951327b529edefc8f55ad58ba8`. Control-only run `37770502407`
then closed exact expired Fit House parent
`574512db-c472-42e5-a9ee-15b74364f8a0` and all six unexecuted children with
zero apply runs, retries, business writes or price-history writes. Fresh run
`37770776303` subsequently passed end-to-end: `273/286` rows executed as safe
freshness confirmations, `13` remained review-only, and zero rows were blocked.
Postflight recorded zero price, stock, shipping, delivered-total, URL, mapping
or effective price-history changes and `273` freshness updates; the fresh
idempotency check passed. Queue reconciliation refreshed the same `13` cards
with zero catalogue writes. No retry or replay occurred. This manual run proves
the repaired path but does not increment the `0/3` natural-interval observation
counter; the next gate is three ordinary scheduled intervals with correlating
read-only watchdog evidence.

**8 October sequential manual path validation and shared partition correction:**
read-only watchdog `37779570754` inspected all 12 retailers with zero database
writes and no global failure. The six healthy or intentionally monitored paths
were left alone. One manual KIOR run `37781359538` then passed end-to-end with
`11/11` freshness-only confirmations, zero commercial change and passing
idempotency. 10 Reps run `37781824504` failed closed before the database because
its protected CSV feed timed out; the public storefront being available does
not prove that feed. Whey Okay run `37782235972` stopped at startup on an
existing control/session conflict. Simply Supplements run `37782531399`
completed a healthy `119 safe + 1 review` classification but refused to create
an equivalent active control plan. All three failures made zero new database,
business or control writes, and none was retried.

Exact read-only Simply preflight `37784294670` found parent
`a02c4e0f-97ca-4f08-b3e8-8287351fdb39` with three unexecuted children,
zero apply runs and zero business or price-history writes. It is
`READY_TO_CLOSE`, but no close was performed; that remains a separately
authorized control-only action. Whey Okay still requires read-only discovery of
its exact blocking identity, and 10 Reps waits for its protected feed.

Jon's scheduled run `37771317361` exposed a shared contract defect: a sixth
valid no-write review row made the full `500 safe + 6 review = 506` partition
fail only because the publication profile carried a historical maximum of five.
The prepared correction removes that historical count from runtime decisions
and applies one exact invariant to Standard, Whey and Jon's profiles:
`executable + review = approved mappings`, with zero blocked rows and zero
catalogue writes from review publication. It adds no retailer branch, importer,
approval path, executor or writer. The regression reproduces the observed
`500 + 6` partition; focused tests pass `30/30`, neighboring refresh tests pass
`55/55`, and the quick quality gate passes. The next gate is the full quality
gate, merge, and one fresh Jon's run without retry or replay. Manual checks do
not advance the ordinary counter, which remains `0/3`. Evidence:
[`evidence/RA-STAB-01-MANUAL-PATH-VALIDATION-2026-10-08.json`](evidence/RA-STAB-01-MANUAL-PATH-VALIDATION-2026-10-08.json).

PR `#280` passed full CI and merged the shared correction as `03bbf563`.
Exactly one fresh Jon's run `37785913168` then passed end-to-end without retry
or replay. The full `506`-offer scope partitioned into `500` executable rows and
`6` review-only rows with zero blocked rows. Execution completed `495`
unchanged confirmations and `5` source-proven stock updates; postflight found
zero price, shipping, delivered-total, URL, mapping or effective price-history
change, and fresh idempotency passed. Queue reconciliation created the six
current cards, superseded five older cards and made zero catalogue writes.
This proves the common partition correction in production. Code is now frozen;
manual evidence still does not advance the `0/3` natural counter. The remaining
pre-observation blockers are the exact stale-control recovery for Simply and
Whey and availability of the protected 10 Reps feed.

The separately authorized Simply Supplements control-only recovery then ran
once as `37788944248`. It expired exact parent
`a02c4e0f-97ca-4f08-b3e8-8287351fdb39` and its three unexecuted children with
one close call, zero apply runs, zero retry or replay, zero business writes and
zero price-history writes. Postflight preserved catalogue counts at
`1337/3632/3758/3758/29577`; the Simply stale-control blocker is closed.

One authorized read-only Whey Okay discovery followed as `37790817618`. It
found exactly one blocking parent,
`73d7ef28-04ae-46b9-8ac2-69792f807546`, in `PARTIALLY_APPLIED` state. Eleven
of its twelve children are already `APPLIED`; one is still `APPROVED`, with no
planned or applying children. Discovery used one read transaction and made
zero close calls, control writes, business writes or price-history writes. No
Whey recovery was authorized or performed. The next bounded Whey step requires
separate exact owner authorization and must preserve the eleven applied
children while closing only the unexecuted boundary. 10 Reps remains paused
until its protected CSV feed is healthy. After those blockers are cleared, one
fresh normal Simply and Whey run without retry or replay can verify both paths;
then code remains frozen for three natural intervals. Manual control work does
not advance the counter, so RA-STAB-01 remains `IN_PROGRESS` at `0/3`.
Evidence: [Simply close and Whey discovery](evidence/RA-STAB-01-SIMPLY-CLOSE-WHEY-DISCOVERY-2026-10-08.json).

The separately authorized Whey control-only recovery then ran exactly once as
`37795892851`. Its fresh preflight revalidated the partial plan before the
write. The existing shared close preserved all `11` already applied children
and their `11` apply runs, superseded only the single expired unexecuted child,
and moved parent `73d7ef28-04ae-46b9-8ac2-69792f807546` to `SUPERSEDED`.
Postflight recorded one close call, three control writes, zero automatic
retries, zero business writes and zero price-history writes. Catalogue counts
remained `1337/3632/3758/3758/29577`; the Fit House, 10 Reps and Review Queue
jobs were skipped. The Whey stale-control blocker is therefore cleared without
re-execution or catalogue mutation. The remaining pre-observation work is to
leave 10 Reps alone until its protected feed is healthy and to verify Simply
and Whey through one fresh normal guarded run each without retry or replay.
This manual control action does not advance the natural counter; RA-STAB-01
remains `IN_PROGRESS` at `0/3`. Evidence: [Whey control close](evidence/RA-STAB-01-WHEY-CONTROL-CLOSE-2026-10-08.json).

One owner-authorized fresh normal Simply Supplements run `37797608023` then
passed after its stale-control recovery. It partitioned `120` mappings into
`119` executed rows and one no-write `SOURCE_VARIANT_MISSING` review row.
Postflight passed: `118` unchanged confirmations, one source-proven price and
delivered-total update, `119` freshness updates, zero stock/shipping/URL/mapping
changes and `price_history +1`; fresh idempotency also passed. This proves the
normal Simply path is healthy. The corresponding one-shot Whey Okay run
`37798277043` failed closed at startup before source capture or any write. A
subsequent one-shot read-only control discovery `37798642443` is `CLEAR`: the
old Whey parent plan is gone and no recoverable retailer-3 parent remains. The
remaining Whey block is therefore the older global startup guard: it reports
only that one or more control counters are non-zero, not which record caused
it. No retry occurred. The next gate is one shared read-only diagnostic of that
existing global guard, with no retailer branch, offer change or retry. RA-STAB-01
remains `IN_PROGRESS` at `0/3`. Evidence: [fresh Simply and Whey runs](evidence/RA-STAB-01-SIMPLY-WHEY-FRESH-RUNS-2026-10-08.json).

PR `#286` then added a shared, validator-only `control-diagnostic` operation
without changing the normal startup decision. One owner-authorized diagnostic
run `37804078924` read the existing state once and made zero database, control,
business, price-history or source-capture writes. It proves that all counters
except `parents` are zero: there is exactly one globally counted active parent,
not an active session, run or approval. The former Whey parent remains absent;
the count does not expose the remaining parent's identity or permit inferring
its retailer/status. The next gate is one bounded read-only parent inventory,
using an existing mechanism or separately reviewed shared capability, before
any closure, retry or another ordinary Whey run. This is diagnostic evidence,
not natural-interval credit; RA-STAB-01 remains `IN_PROGRESS` at `0/3`.
Evidence: [Whey control-guard diagnostic](evidence/RA-STAB-01-WHEY-CONTROL-GUARD-DIAGNOSTIC-2026-10-08.json).

The bounded next diagnostic is now prepared as one shared read-only capability,
not a Whey-specific exception. Migration
`20261008140000_add_active_retailer_parent_inventory.sql`, SHA-256
`c3f435135190f97c6be62c562d715f1f3f341629b263fee22848f8f033cda0af`,
returns only active parent identity, retailer, status, timestamps and aggregated
child/apply status counts. It is executable only by the existing staging and
production validator roles, requires a read-only transaction with `SAFE_UPDATE`
unset, and contains no business/control DML. The existing `control-diagnostic`
will compare its exact row count with the old global counter in the same
read-only transaction. Focused tests pass `95/95`; quick/full and Project
Guardian gates pass. Production is unchanged. After green CI, deployment of
the exact migration and one diagnostic read remain separate production gates.
Evidence: [active-parent inventory preparation](evidence/RA-STAB-01-ACTIVE-PARENT-INVENTORY-PREPARATION-2026-10-08.json).

The first production rollback-only rehearsal stopped before commit because its
preflight incorrectly required both staging and production validator roles in
one environment. Production has only the appropriate production role. No
migration, business or control write occurred. The shared migration now grants
and verifies only validator roles present in the target environment while
denying every present approver, executor and service role. Its corrected
SHA-256 is `6499f29df0c33311d6810fd33293d1de72d4de3e92b75b3e9027e67a46e317e6`;
the prior hash is superseded and must not be deployed. A new exact owner
authorization is required before another production rehearsal or apply.
Evidence: [role-scope correction](evidence/RA-STAB-01-ACTIVE-PARENT-INVENTORY-ROLE-CORRECTION-2026-10-08.json).

The corrected migration then passed its rollback-only rehearsal and the exact
owner-authorized production apply. Production advanced from ledger `229` to
`230` with fingerprint
`746ab61dcdb38158f17845af0ce4ceb84c919e85c14d039276652e24ca1a558e`;
all five catalogue counts remained unchanged. The single authorized read-only
diagnostic run `37812312245` used one transaction and two bounded RPCs, made
zero database/control/business writes and started no source capture. It
identified the sole global parent blocker as Discount Supplements plan
`ee32bf39-0e6b-4524-86e8-1d7c787ddecf`, retailer `4`, status `APPROVED`, with
two `PLANNED` children, one `APPROVED` child, no apply runs and an expired
approval. The former Whey parent remains absent. No closure, retry, replay or
offer change was authorized or performed. The next gate is separate exact
authority for the existing shared control-only recovery after it verifies the
three unexecuted child bindings; only then may one fresh ordinary Whey run be
considered. This diagnostic does not advance the natural counter; RA-STAB-01
remains `IN_PROGRESS` at `0/3`. Evidence: [live active-parent inventory](evidence/RA-STAB-01-ACTIVE-PARENT-INVENTORY-LIVE-2026-10-08.json).

The owner then authorized one exact shared control-only close. Run
`37814571515` re-read and verified Discount Supplements parent
`ee32bf39-0e6b-4524-86e8-1d7c787ddecf`, its one expired approved child and
two planned children before making one close call. It expired the parent and
all three children with five control writes, zero apply runs, zero retries and
zero business or price-history writes. Postflight preserved catalogue counts
at `1337/3632/3758/3758/29578`; Fit House, 10 Reps and Review Queue jobs were
skipped. The global blocker is therefore cleared without replay or catalogue
mutation. The next gate is one separately authorized fresh ordinary Whey Okay
run and exact postflight review. This manual recovery gives no natural interval
credit; RA-STAB-01 remains `IN_PROGRESS` at `0/3`. Evidence: [Discount control close](evidence/RA-STAB-01-DISCOUNT-CONTROL-CLOSE-2026-10-08.json).

The authorized fresh ordinary Whey Okay run `37816626614` reached the common
guarded executor but did not finish. Source capture passed on its first request;
the complete `589 = 579 safe + 10 review` partition contained zero blocked
rows, and Review Queue publication refreshed all ten no-write review cards.
The first six of twelve sequential children committed `291` freshness-only
confirmations. Child seven then exceeded the executor's `180`-second statement
limit and rolled back; five later children never started. Independent read-only
run `37818124480` and exact expired-plan preflight `37818886595` prove the
parent is `PARTIALLY_APPLIED`, with `6 APPLIED + 1 APPROVED + 5 PLANNED`, six
successful apply runs, 291 consumed row approvals and unchanged catalogue and
business-price-history counts `1337/3632/3758/3758/29578`. No retry, replay or
close occurred. The apply failure report's zero-write counters cover the failed
call only and must not be used as whole-run postflight. The exact plan is now
`READY_TO_CLOSE`; the next gate is separate owner authority to preserve the six
completed children and close only the six expired unexecuted children, followed
by a shared timeout/progress diagnostic and regression rather than a Whey-only
exception. This forced failure gives no natural interval credit; RA-STAB-01
remains `IN_PROGRESS` at `0/3`. Evidence: [Whey partial-timeout readback](evidence/RA-STAB-01-WHEY-FRESH-RUN-PARTIAL-TIMEOUT-2026-10-08.json).

The owner-authorized exact control-only close then passed in run `37821360235`.
It preserved all six applied children, their six successful apply runs, six
ready recovery records and all `291` freshness confirmations. It superseded
only the expired unexecuted suffix: one approved child plus five planned
children. The single close call made eight control writes, zero business or
price-history writes and no retry or replay. Postflight marked the parent
`SUPERSEDED`, closed the unused approval and preserved catalogue and business
price-history counts at `1337/3632/3758/3758/29578`. The next gate is a shared
timeout/progress correction with an incident regression before any further
ordinary Whey run; no retailer-specific exception is authorized. This manual
close gives no natural interval credit, so RA-STAB-01 remains `IN_PROGRESS` at
`0/3`. Evidence: [Whey partial-plan close](evidence/RA-STAB-01-WHEY-PARTIAL-PLAN-CLOSE-2026-10-08.json).

The shared partial-progress reporting correction is now locally complete and
fully verified. One helper records the approved and committed sequential prefix
after every child and is used by the Whey, Fit House shared-profile and Jon's
engines; no retailer name/ID branch, importer, executor, workflow, database
function, approval rule, guard, timeout or business-write behavior was added or
changed. The incident regression reproduces twelve children, `579` safe rows,
six committed children and `291` committed confirmations before child seven
times out, and proves the failure artifact retains those exact facts rather
than reporting a false zero. Focused and neighboring tests pass `114/114`, and
`verify:project`, `verify:quick`, `verify:full` and the production build pass.
This fixes truthful diagnosis only; it does not claim that the underlying
database delay is understood or removed. No production run or write occurred.
The next gate is review, push, green CI and merge, followed only under separate
authority by a fresh diagnostic validation of the common executor. No timeout
increase or retailer-specific workaround is justified. RA-STAB-01 remains
`IN_PROGRESS` at `0/3`. Evidence: [shared partial-progress preparation](evidence/RA-STAB-01-SHARED-PARTIAL-PROGRESS-PREPARATION-2026-10-08.json).

PR `#293` passed all checks and merged as `f08d1871`. The one owner-authorized
fresh Whey validation run `37826090676` then completed the common path without
retry or replay. All twelve children and all `579` safe freshness confirmations
applied; ten missing-source rows remained review-only, zero rows were blocked,
postflight and fresh idempotency passed, and the ten existing Review Queue cards
were refreshed with zero catalogue writes. There were no price, stock,
shipping, total, URL or price-history changes, and catalogue counts remained
`1337/3632/3758/3758/29578`. The shared progress report truthfully records
`12/12` children and `579/579` rows. The former seventh-child timeout did not
recur. However, the apply step took `766` seconds, so correctness is proven but
runtime headroom is not acceptable for stable unattended operation. The next
bounded task is one shared read-only database performance audit of the existing
executor/SQL path using this run as evidence; no additional Whey run, timeout
increase or retailer-specific bypass is justified. This owner-triggered proof
does not increment the natural counter, so RA-STAB-01 remains `IN_PROGRESS` at
`0/3`. Evidence: [Whey shared-progress live proof](evidence/RA-STAB-01-WHEY-SHARED-PROGRESS-LIVE-PROOF-2026-10-08.json).

The bounded shared performance audit is now live verified by read-only run
`37832592271`, artifact `11574162885`, digest
`40ba8d6a99003a137434a9d962a3c994df5f8a55d8e24d58e66774a5bd5c1a87`.
It used only the production validator login in a read-only transaction and made
zero database writes, retries or replays. Production exposes one ordinary
execution chain made of the current dispatcher plus two retained compatibility
layers. Across that common chain the source contains three JSON row loops, one
per-row approval call, one per-row apply call, nine row-state calls and two each
of the business-count, other-retailer-fingerprint and protected-shared
fingerprint checks. Primary lookup indexes are present. PostgreSQL
`track_functions` is `none`, so the audit proves repeated structural work but
does not invent an exact per-function share of the observed `766` seconds. The
next bounded step is an isolated common-executor benchmark and one shared SQL
consolidation proposal that removes redundant reads while retaining every
validation, approval, stale-state, atomicity, rollback, postflight and
idempotency guard. No timeout increase, retailer-specific bypass or production
migration is yet justified. The manual audit gives no natural interval credit;
RA-STAB-01 remains `IN_PROGRESS` at `0/3`. Evidence: [shared executor
performance audit](evidence/RA-STAB-01-SHARED-EXECUTOR-PERFORMANCE-AUDIT-2026-10-08.json).

The bounded local consolidation is now prepared without adding another
executor or retailer branch. Migration
`20261008200000_consolidate_shared_executor_state_reads.sql` changes only the
common unreviewed executor: it keeps the before-state read, caches one
post-apply state and reuses that exact JSON value for all seven existing field
comparisons. Deterministic source instrumentation therefore reduces row-state
function calls from `9` to `2` per offer (`7` fewer, `77.78%`) while retaining
manifest, ledger, approval, replay, stale-state, locking, per-row validation,
apply, aggregate-delta, cross-retailer fingerprint, recovery and idempotency
guards. Focused tests, quick/full gates and the exact PostgreSQL 17 production
sequence pass. GitHub integration run `37836089622` applied the reviewed
dispatcher and candidate migration in a disposable database, then passed the
26-row execution, negative, replay and atomic rollback scenario in `9426` ms.
The wider historical integration gate still has four unrelated failures already
present on scheduled `main` runs; they are not represented as success here.
The migration is SHA-bound and closed in both environment
selectors: it is not deployed and authorizes no retailer run. Exact production
deployment still requires separate owner authority. RA-STAB-01 remains
`IN_PROGRESS` at `0/3`. Evidence: [shared executor state-read
consolidation](evidence/RA-STAB-01-SHARED-EXECUTOR-STATE-READ-CONSOLIDATION-2026-10-08.json).

The owner-authorized staged deployment is complete. PR `#302` isolated the one
approved migration from seven older staging candidates; staging rehearsal,
apply and read-only postflight passed at ledger `100` with unchanged catalogue
counts. PR `#303` admitted the same file to production; rehearsal, apply and
postflight passed at ledger `231`, fingerprint
`d30de0526f773eae1084721517f078e5725803d236556fb2a69fbb5eb1b5e094`,
again with unchanged catalogue counts. The one authorized Whey run
`37840451727` failed closed after `38` seconds before apply because its commit
still carried the pre-deployment `230`-row runtime binding. It wrote no offers
or price history and was not retried or replayed. The common selector/runtime
closeout now records the migration as applied and closed; no retailer branch,
new executor, weaker guard or timeout change was added. A second fresh run is a
separate gate because the one-run authority was consumed. RA-STAB-01 remains
`IN_PROGRESS` at `0/3`. Evidence: [shared executor deployment](evidence/RA-STAB-01-SHARED-EXECUTOR-STATE-READ-DEPLOYMENT-2026-10-08.json).

The separately authorized fresh Whey Okay run `37841687855` then passed on the
closed production binding `3f95c12` without retry or replay. The full
`589 = 579 safe + 10 review` partition contained zero blocked rows; all twelve
children and all `579` freshness-only confirmations completed. Postflight and
fresh idempotency passed with zero price, stock, shipping, total, URL or
price-history changes. The ten missing-source variants remained isolated and
their existing Review Queue cards were refreshed with zero catalogue writes.
The apply step completed in `611` seconds versus `766` seconds in the preceding
successful proof, a measured reduction of `155` seconds (`20.23%`). An
independent read-only production check passed at ledger `231`, preserved
catalogue counts `1337/3632/3758/3758/29578` and made zero writes. This proves
the common consolidation live; it does not guarantee future latency or count as
a natural interval. The path is frozen for three ordinary scheduled
observations, so RA-STAB-01 remains `IN_PROGRESS` at `0/3`. Evidence: [Whey
post-consolidation live proof](evidence/RA-STAB-01-WHEY-POST-CONSOLIDATION-LIVE-PROOF-2026-10-08.json).

The next Review Queue worker exposed one bounded Fit House accounting defect,
not new catalogue drift. Run `37865904014` completed the reviewed stock changes
for offers `983` and `1859` and also applied the reviewed return to stock for
offer `697`; every completed row passed postflight and fresh idempotency. The
worker nevertheless left request `0f058ea0-20b7-43ea-8e69-83acb831a56c`
failed because the stable-OOS guard remembered verified moves into OOS (`+1`)
but did not subtract a verified move back into stock (`-1`). A subsequent exact
control-only recovery `37883359564` failed closed before any additional
business write and reproduced the same cause. The guard is now prepared to
account for both directions as signed, sealed Review Queue transitions and to
require equality with the exact resulting OOS count. The approved baseline is
unchanged, unknown drift still fails closed, and no shared-core branch, new
executor, retry, replay or threshold widening was added. A regression covers
the real `697/983/1859` sequence; focused tests (`106/106`), quick and full
gates pass. PR `#306` merged the repair as
`16abf47e83a9c1c7d4002f66c5616bdd036cad26` after all CI checks passed. The
single exact control-only recovery `37884246127` then passed: request
`0f058ea0-20b7-43ea-8e69-83acb831a56c` and review `1115` are `EXECUTED`, fresh
postflight and idempotency passed, and the recovery made zero catalogue writes.
It reused the original verified `20` writes (`1` stock return plus `19`
freshness-only confirmations) and recorded zero price-history delta. Offers
`735` and `1904` remain untouched. This manual repair does not advance
natural-cycle credit, so RA-STAB-01 remains `IN_PROGRESS` at `0/3`. Evidence:
[Fit House signed stock-delta recovery
preparation](evidence/RA-STAB-01-FIT-HOUSE-SIGNED-STOCK-DELTA-RECOVERY-PREPARATION-2026-10-09.json).

Fresh read-only 10 Reps run `37885704534` proved that the protected CSV source
had recovered: HTTP `200`, `516` products, `1857` variants, no retry, and a
complete `950 = 934 executable + 16 source-missing review` partition. The 934
executable rows comprised `837` confirmations and `97` validator-approved stock
changes. The separately authorized apply run `37886686256` repeated the healthy
capture but failed closed before registration or apply while binding the same-run
Review Queue source. It made zero database, business and control writes. Root
cause is a shared publication-contract defect: the standard source-missing
profile required every executable row to be `VERIFY_NO_CHANGE`, although the
shared validator and planner correctly allow safe commercial changes in that
separate executable scope. The prepared common repair validates the exact union
of confirmations and classifier-proven executable changes, including exact
stock-change IDs, while retaining disjoint review scope, zero blocked rows and
fail-closed count/identity checks. It contains no retailer-name/ID branch, new
executor, retry, replay or guard relaxation. The real `837 + 97 + 16` incident
passes locally along with focused `77/77`, quick and full gates. Merge after
green CI, then use one new fresh ordinary run; never resume or replay the failed
plan. RA-STAB-01 remains `IN_PROGRESS` at `0/3`. Evidence: [10 Reps shared
executable partition preparation](evidence/RA-STAB-01-10REPS-SHARED-EXECUTABLE-PARTITION-PREPARATION-2026-10-09.json).

PR `#308` merged the shared partition repair at
`6fb61872b535cd4c5453d603991609514d2be6a8`. One new fresh ordinary 10 Reps
run `37887683300` then passed source capture, dry-run, baseline, all 22 read-only
child validations and the same-run Review Queue binding. Registration failed
closed before creating any parent, child or approval because the planner's
22 safe children exceeded the older shared registration maximum of 20. The
live shape was `934 = 837 VERIFY_NO_CHANGE + 97 UPDATE_STOCK`; 65 updates were
new OOS and therefore correctly distributed at no more than 3 per child. The
apply diagnostic records zero completed database, business and control writes.
The shared queue publisher separately replaced the prior 16 10 Reps review
records with the same 16 current source-missing records and made zero catalogue
writes. Migration `20261009100000_align_shared_sequential_child_capacity.sql`
is prepared to align the planner and all nine current shared/dedicated
registration functions at a bounded 50-child maximum. It does not change the
50-row child cap, 3-new-OOS child cap, retailer policy, approval or executor.
The migration preserves function owner, security mode, volatility, parallel
mode, configuration and ACL exactly and aborts on definition drift. No deploy
or replacement run is yet recorded. RA-STAB-01 remains `IN_PROGRESS` at `0/3`.
Evidence: [shared sequential child-capacity
preparation](evidence/RA-STAB-01-SHARED-SEQUENTIAL-CHILD-CAPACITY-PREPARATION-2026-10-09.json).

PR `#309` merged the common alignment at
`8ef14ef2e8b8ab7695e78dd6d7d1b5ee65b6674f`. The exact hash-bound migration
subsequently passed rollback-only production rehearsal, apply and independent
read-only postflight. The production ledger advanced from `231` to `232` with
fingerprint
`6d22d965f22c5d281c3b4b4c8a9dfd5f7b7892e853bea185b2a51dd412f06104`;
all catalogue counts remained unchanged (`1337` products, `3632` variants,
`3758` mappings, `3758` offers and `29600` price-history rows). The repository
runtime binding must be sealed and merged at ledger `232` before dispatching
the one authorized fresh 10 Reps run, so the ordinary ledger guard sees the
same verified database state. No retry or replay occurred. Evidence: [shared
sequential child-capacity deployment](evidence/RA-STAB-01-SHARED-SEQUENTIAL-CHILD-CAPACITY-DEPLOYMENT-2026-10-09.json).

PR `#310` then sealed runtime ledger `232` as merge commit
`be09593c2bea16da6a52dadc7674f6bb9e709aae`. The one authorized fresh 10 Reps
run `37892636516` passed source capture, dry-run, baseline, all 22 validators
and Review Queue publication. It registered the parent successfully and safely
completed four children covering 172 rows. The fifth 43-row child exceeded the
unchanged 120-second database query boundary and failed closed. Read-only
production discovery proves exactly four `APPLIED`, one `APPROVED` and 17
`PLANNED` children, with no hidden fifth apply and no retry, replay or recovery.

This is a shared executor-transaction sizing incident, not a 10 Reps identity
or source problem. The prepared common correction changes the operational
child target from 50 to 20 rows while retaining the database hard cap of 50,
the maximum of three new OOS rows, the 50-child parent cap and every existing
approval, stale-state, identity and postflight guard. The same 934-row fixture
now produces 47 bounded children. No timeout is increased, no retailer branch
or second executor is added, and an incident regression covers the exact live
shape. The partial plan must not be resumed: after merge, the next separately
authorized boundary is one control-only close preserving four applied children
and closing only 18 unexecuted children, followed by one new fresh run. Manual
work earns no ordinary observation credit; RA-STAB-01 remains `IN_PROGRESS` at
`0/3`. Evidence: [10 Reps partial timeout and shared correction](evidence/RA-STAB-01-10REPS-PARTIAL-TIMEOUT-2026-10-09.json).

PR `#311` merged the 20-row shared child target as
`20dea68bb4f7ad92c3d364fee12c685efea8a78d`. The owner-authorized control-only
close run `37898666426` then preserved all four applied children of expired 10
Reps parent `ebdc44cb-668b-41ba-8fae-fb3f9b70ed4d` and closed exactly its 18
unexecuted children with zero business or price-history writes. The one new
fresh run `37898775120` used 47 children for the current
`950 = 934 executable + 16 review` partition. It safely committed 25 children
and 500 rows, then its twenty-sixth 20-row child reached the unchanged
120-second query boundary. Read-only run `37914426428` independently proves one
`PARTIALLY_APPLIED` parent `63a57694-c40b-45d6-8a87-90ca7aa22b8d`, exactly 25
applied, one expired approved/unexecuted and 21 planned children, 25 apply runs,
zero hidden write, retry, replay or close, and unchanged catalogue counts
`1337/3632/3758/3758/29600`.

This second partial result disproves child-size reduction as a sufficient
solution: the first 500 rows already consumed about 39 minutes, so all 47
children cannot reliably finish inside the 45-minute parent approval window.
The common executor still computes a full other-retailer fingerprint twice per
child by materialising every unrelated mapping, offer and price-history row.
Migration `20261009120000_add_compact_other_retailer_fingerprint.sql` prepares
one shared, versioned correction: every complete row remains covered by
SHA-256, but fixed-width ordered row digests and relation counts replace the
wide aggregate JSON. Historical recovery manifests remain bound to the legacy
algorithm; only manifests whose immutable ledger includes the new migration use
V2. No retailer branch, executor, approval path, timeout increase, approval
extension or guard relaxation is added. Focused tests, `verify:quick` and
`verify:full` pass locally. GitHub run `37917685369`, job `113777767079`, proves
the exact PostgreSQL 17 migration/executor/recovery scenario as passing test 43.
The wider historical integration batch remains red on four unrelated tests
(`27`, `31`, `67`, `68`), which are not folded into this correction. The current
partial plan must not be resumed or replayed, and merge, deployment, close and
another fresh run each remain separate future gates. Manual work gives no
ordinary interval credit; RA-STAB-01 remains `IN_PROGRESS` at `0/3`. Evidence:
[10 Reps compact fingerprint preparation](evidence/RA-STAB-01-10REPS-COMPACT-FINGERPRINT-PREPARATION-2026-10-09.json).

PR `#312` merged the shared implementation as
`23aa8387da7040214158c2a3078da7c4fcbcd723`; PR `#313` then exposed only the
owner-authorized production migration. Rollback-only rehearsal, apply and an
independent read-only postflight all passed. Production advanced from ledger
`232` to `233` with fingerprint
`65bd715ca8d7012125308e505c6af94b633820498d442d7ee7e84c89800df3cc`.
All catalogue counts stayed unchanged at `1337/3632/3758/3758/29600`, including
zero offer or price-history writes. The runtime binding is being closed at
ledger `233` before the separately authorized control-only close of parent
`63a57694-c40b-45d6-8a87-90ca7aa22b8d`. No retry, replay or fresh run has yet
occurred in this authorized sequence. Evidence: [compact fingerprint production
deployment](evidence/RA-STAB-01-COMPACT-FINGERPRINT-DEPLOYMENT-2026-10-09.json).

PR `#314` sealed the production runtime at ledger `233` as merge commit
`82ea06e00b4311730309e66a32ad2af9fee6d739`. Owner-authorized control-only run
`37920649441` then revalidated partial 10 Reps parent
`63a57694-c40b-45d6-8a87-90ca7aa22b8d`, preserved all 25 applied children and
their 25 apply runs, and superseded only the 22 unexecuted children. It made 24
control writes and zero business or price-history writes, with no retry or
replay.

The one authorized fresh ordinary-path run `37920753417` completed successfully
in `10m50s`. It captured all `516` products and `1857` variants from the
protected CSV with HTTP `200` and zero source retries, reproduced the exact
`950 = 934 executable + 16 review` partition, and applied all `934` safe rows in
all `47` children. Postflight proved `27` stock transitions, `934` freshness
updates, zero catalogue-row delta and zero price-history delta. The fresh
idempotency capture returned `934` no-change rows, the same 16 isolated review
rows and zero writes, approvals or recovery calls. The shared Review Queue
publisher refreshed exactly those 16 cards without catalogue writes. Final
independent read-only discovery run `37922058572` returned `CLEAR`, zero blocking
plans and unchanged counts `1337/3632/3758/3758/29600` at ledger `233`.

This live proof closes the compact-fingerprint incident without a retailer
branch, second executor, timeout increase or weakened guard. The repaired path
is now frozen. Because the successful run was manually dispatched, it provides
live proof but no natural-interval credit; RA-STAB-01 remains `IN_PROGRESS` at
`0/3`. The only next gate is three consecutive ordinary scheduled intervals
with correlated watchdog and database evidence. Evidence: [10 Reps compact
fingerprint live proof](evidence/RA-STAB-01-10REPS-COMPACT-FINGERPRINT-LIVE-PROOF-2026-10-09.json).

A fresh read-only watchdog `37959713036` then distinguished old schedule
evidence from current runtime health. KIOR's failed schedule used an older
commit and stopped on the migration-ledger hash; current-main dry-run
`37959509322` passed all `11` unchanged rows with zero writes. Whey Okay's old
schedule had encountered a control conflict, but current diagnostic
`37960338261` is `CLEAR` and dry-run `37960466540` passed `579` unchanged plus
`10` review rows. The successful 10 Reps proof and clear control readback remain
current. Fit House alone reproduced a present defect in read-only run
`37960409561`: a healthy `242`-product, `338`-variant source produced `275`
unchanged and `11` stock-change rows, but the consumed one-time returned-offer
contract rejected the later ordinary scope before shared isolation.

The prepared correction completes the existing common safe/review partition.
For isolation-enabled profiles, `MASS_OOS` holds new OOS transitions,
`MASS_PRICE` holds price changes and `MASS_CHANGE` holds changed rows in the
existing Review Queue while the remaining safe rows continue. A stale one-time
review contract still cannot authorize a write, but it no longer vetoes a later
isolation-only cycle; existing owner-deferred rows remain deferred. The exact
Fit House regression produces `275` executable confirmations and `11` review
rows. No retailer identity branch, new importer, executor, approval path,
threshold increase, retry or replay was added. Focused tests pass `83/83` and
`verify:quick` passes. The correction is `PREPARED_NOT_DEPLOYED`; it earns no
ordinary interval credit and the counter remains `0/3`. Evidence: [shared
aggregate review partition preparation](evidence/RA-STAB-01-SHARED-AGGREGATE-REVIEW-PARTITION-PREPARATION-2026-10-09.json).

PR `#327` merged the shared aggregate partition as
`773fc3934ad1db7aa00130721636d94911a4d407`. Its first post-merge read-only Fit
House run `37962781276` failed closed with zero writes before classification.
The healthy, unchanged source capture still contained `242` products and `338`
variants, but six protected synthetic source rows recognized by the first
reconciliation step were not passed to the next common reconciliation call;
the same older-array selection was present in the second confirmation capture.
The prepared follow-up introduces one shared source-precedence helper and uses
it in both captures. It adds no offer ID, source exception, approval or write
path. The new incident regression and neighboring focused suite pass `83/83`.
PR `#328` merged that follow-up as
`cb532e4fe2e4df50ab4c73932b6468a26e0ffd6a`. Fresh post-merge read-only Fit
House run `37963946528` passed as `PASS_WITH_REVIEW`: all `286` approved rows
were accounted for as `275` safe freshness confirmations plus `11` review rows
(`10` existing owner-deferred stock rows and one `MASS_OOS` row), with zero
blocked rows. Both source captures agreed at fingerprint
`3334da61c9cdff2f3e9dd9429d8729c4477c3932260ce2fba0691ff2fc704678`;
the source returned HTTP `200`, `242` products and `338` variants with zero
retries. The validator passed all `14` batches and the run attempted and
completed zero database, business, control, approval and recovery writes.

Fresh read-only watchdog `37964214687` then checked all `12` configured
retailers with zero writes. It continues to report Whey Okay, KIOR, Fit House
and 10 Reps as failed because their latest *scheduled* attempts remain older
incomplete runs; the successful manual apply/read-only proofs do not replace
that ordinary-schedule evidence. This is intentional and is not bypassed or
relabelled as success. Current-path evidence is clear for KIOR, Whey Okay,
Fit House and 10 Reps, but RA-STAB-01 remains `IN_PROGRESS` at `0/3`. The only
next gate is three consecutive ordinary scheduled intervals with correlated
watchdog and database evidence; no retry, replay or historical-plan resume is
opened.

The latest scheduled Automation Review Queue worker run `37940227059` exposed
one remaining common monitoring defect. All five selected eBay requests failed
closed before catalogue writes: four carried expired review evidence and one
had binding drift. Their retailer workers moved the requests to `EXPIRED`, but
the outer batch treated every caught request exception as a system failure and
made the workflow red. This contradicted the established three-state monitoring
contract: a safely rejected stale owner decision is review outcome, not system
failure.

The prepared shared correction separates verified safe revalidation from real
batch failure. It accepts only closed drift/expiry/revalidation/binding/evidence/
scope error codes with zero catalogue writes, and then independently reads the
request back as exactly `EXPIRED`. Only that bounded combination becomes
`PASS_WITH_REVIEW`; missing or different disposition, an unknown error, or any
catalogue write remains `FAIL` and exits nonzero. The GitHub summary exposes
queue result, safe rejection count and system failure count separately. The
regression reproduces the exact five production request IDs and error split.
Focused testing and `verify:quick` pass. No retailer condition, retry, replay,
approval, executor, writer, credential or guard change is introduced. This
preparation earns no ordinary interval credit; RA-STAB-01 remains `IN_PROGRESS`
at `0/3`. Evidence: [Review Queue safe-revalidation status
preparation](evidence/RA-STAB-01-REVIEW-WORKER-SAFE-REVALIDATION-PREPARATION-2026-10-09.json).

**Acceptance:**

- one timestamped inventory for all 12 configured retailers;
- every failure has one evidence-backed class, blocking scope and next action;
- no silent row and no normal review reported as `FAILED_SYSTEM`;
- no new retailer-specific shared-core branch, workflow, approval path or writer;
- every code fix has a common regression and passes quick/full gates;
- three consecutive ordinary intervals satisfy the observation contract;
- final read-only watchdog and postflight evidence agree;
- all writes, if later separately approved, have exact before/after evidence and
  independent readback.

**Hard stop conditions:** stop before implementation if current code,
documentation and production evidence conflict; a fix requires a new
retailer-ID/name branch; the same incident cannot be reproduced in a fixture;
the proposed action weakens source, identity, stale-state, approval, atomicity,
postflight or idempotency guards; or required recovery authority is absent.

**Rollback:** documentation-only reset is reverted as one commit. Any later
runtime change must have its own task-local rollback; no task may delete control
history, approvals, price history or review evidence.

## RA-000 — Baseline and audit

**Status:** `VERIFIED_COMPLETE`

**Goal:** establish an evidence-backed baseline without changing runtime code.

**Scope:** retailer inventory, real flow map, shared/duplicate mechanisms,
exceptions, incident taxonomy, current Actions/readback evidence and this plan.

**Out of scope:** refactor, workflow/migration/database changes, approvals and
production writes.

**Dependencies:** owner verification. The original local/production baseline
mismatch was resolved by rebuilding RA-000 alone on a clean branch from current
`origin/main`; no runtime implementation dependency was opened.

**Existing solutions checked:** Operating Plan, Agent Operating Model,
Automation Reliability Roadmap/Owner Decisions, Data Source Registry, onboarding
runbook, offer-sync core, snapshot core, atomic importer, Review Queue,
postflight, watchdog, migrations/tests and Git history.

**Acceptance:** all 12 active retailers documented; every material claim cites a
file/symbol/run/artifact; unknowns are explicit; documentation-only diff; pre/post
Project Guardian passes; original dirty worktree remains unchanged; closeout
branch starts at exact current `origin/main`.

**Tests:** `npm run verify:project` before and after; documentation link checks;
`git diff --check`.

**Evidence:** this directory and evidence index; original local audit baseline
`1add3449096cbc3f988d0e5f6db8b9baf89f0349`; original and current fetched
production-run SHA `121fc5ce909c925e7234aef3a249661c8e7d0826`; merge-base
`1add3449096cbc3f988d0e5f6db8b9baf89f0349`, ahead/behind `0/104`; current
runs listed in evidence.

**Rollback:** revert only these documentation/AGENTS edits; no runtime rollback.

**Recorded evidence fields:** commit SHA: the Git commit containing this plan;
run IDs: documentation audit uses read-only runs only; artifacts: see evidence
index; local verification: pre-edit Project Guardian PASS, final results are
recorded in the commit/branch handoff; production readback: read-only artifacts
only; owner approval reference: pending verification; rollback result: not
applicable because no runtime change was made.

**Independent verification — 23 September 2026:** verified against
`121fc5ce909c925e7234aef3a249661c8e7d0826` with documentation commit
`8745b8bbc7fd9f7f8b324bcef69b3cac00c8ef75`. Project Guardian, documentation
links, diff whitespace, exact six-file scope, task-status contract and original
dirty-worktree integrity checks passed. The review confirmed that audit claims
remain evidence-backed, unknowns remain explicit, architecture remains a draft,
and all approval/write guardrails are preserved. No SQL, import, approval,
apply, workflow dispatch or staging/production write was performed.

## RA-001 — Approve architecture and status taxonomy

**Status:** `VERIFIED_COMPLETE`

**Goal:** prepare an evidence-backed owner decision on the common core,
component boundaries, six-dimensional status taxonomy, blocking scope,
automatic execution authority, exceptions and migration order.

**Scope:** compare all current production and harness paths; propose at most
three architectures and authorization models; recommend one target pipeline;
record no more than five plain-language owner decisions in
`RA-001-DECISION-PACK.md`.

**Out of scope:** implementation or guardrail changes.

**Dependencies:** RA-000 `VERIFIED_COMPLETE` and clean current baseline.

**Existing solutions checked:** `retailer-offer-sync`, `retailer-snapshot`,
atomic importer, shared Fit House engine, dedicated eBay/6 Pack/Whey Okay/GYM
HIGH/Jon's and catalogue-onboarding paths, validator/approver/executor, Review
Queue, control ledger, shared and dedicated postflight/watchdog mechanisms,
their tests, workflows, migrations and current RA-000 evidence.

**Acceptance:** owner approval dated 2026-09-23 confirms the pack's traceable
20-dimension comparison, one clear
recommendation, one logical pipeline, explicit connector/core boundary, status
and authorization models, exception governance, event-based migration gates,
retirement conditions, risks, unknowns and five owner decisions. The approval
retains every implementation, shadow, cutover, auto-safe and decommission gate.

**Tests:** pre/post `npm run verify:project`, documentation link check,
`git diff --check`, allowed-scope/status/integrity checks; no runtime or
production test.

**Evidence:** owner decision dated 2026-09-23; `ARCHITECTURE.md` status
`OWNER APPROVED FOR RA-002 PLANNING`; `RA-001-DECISION-PACK.md`; RA-000 evidence
index; exact baseline above; PR #85; final local/GitHub verification and merge
evidence recorded at closeout.

**Rollback:** revert the documentation commit or amend the draft; runtime is
unchanged and no production rollback exists.

## RA-002 — Canonical contract and common test harness

**Status:** `VERIFIED_COMPLETE`

**Goal:** freeze canonical source, classification, plan and outcome contracts and
prove them against existing implementations in zero-write mode.

**Scope:** reuse/merge existing snapshot schemas, reason registry, offer-sync
artifact schemas and fixtures.

**Out of scope:** production routing and retailer migration.

**Dependencies:** RA-001.

**Existing solutions checked:** `scripts/lib/retailer-snapshot/contracts/`,
`scripts/lib/retailer-offer-sync/contracts/`, atomic plan serialization and
quality-gate manifest. RA-002 reuses the snapshot runtime schema walker,
domain-separated snapshot canonical hashing, frozen local-fixture conventions and the
sealed quality-gate inventory. Existing production schemas, classifiers,
importer, approver, executor and entry points remain unchanged and unwired.

**Acceptance:** one retailer-neutral canonical source contract `v1`; exact-key,
minor-unit money, explicit missing/unknown/source-missing states, six-dimensional
taxonomy and complete reason metadata; deterministic local-fixture replay;
fail-closed write/network boundaries; safe-candidate/authorization separation;
no second executor/importer; quality manifest resealed for the new test.

**Tests:** contract/schema, taxonomy/reasons, determinism, mutation, stale-state,
source collapse, per-row isolation, missing-source semantics, safe candidate
without authorization, equivalent active, genuine system failure, denied
write/network attempts and runtime dependency boundary; quick/full gates.

**Evidence:** `evidence/RA-002.md`, contract/harness source, fixture matrix,
focused test output, deterministic report fingerprint, local quality gates and
PR #86 checks. Independent verification reviewed the complete diff and import
closure, corrected five bounded contract/harness gaps, and repeated the local
and GitHub gates. Production readback is intentionally not applicable because
the module is unwired and local-only.

**Rollback:** contract version remains unused; remove only new harness wiring.

## RA-003 — Historical incident regression fixtures

**Status:** `VERIFIED_COMPLETE`

**Goal:** convert every confirmed incident into a common-harness regression.

**Scope:** price drift, missing source row, identity conflict, active plan,
expired approval, partial session, `PASS_WITH_REVIEW` summary, scheduled queue
publication and post-apply source drift.

**Out of scope:** changing production behavior.

**Dependencies:** RA-002.

**Existing solutions checked:** retailer-specific tests, September recovery
migration tests, eBay reconciliation tests and current Actions artifacts.

**Acceptance:** each confirmed incident has fixture, expected reason/status and
link to original evidence; no unexplained missing regression.

**Tests:** full incident matrix through canonical harness; quick/full gates.

**Evidence:** `evidence/RA-003.md`, the 23-entry incident manifest, 16 executable
fixture/golden pairs, the 81-entry legacy compatibility matrix, independent
mutation and emitter-reference checks, fresh local quality gates and PR #87 CI.

**Rollback:** fixtures/harness only; runtime unchanged.

## RA-004 — 10 Reps shadow-mode pilot

**Status:** `BLOCKED`

**Owner stop/reset — 29 September 2026:** no further live retry is authorized.
All completed RA-000–RA-003 contracts, incident fixtures and RA-004 local replay
evidence are retained. Historical activation and failure records below remain
immutable evidence, not a queue of work to continue. RA-004 can be reconsidered
only after RA-STAB-01 closes and only as artifact-first recorded replay with zero
network, credential, control and business writes. Any later live shadow or
cutover requires a new task and separate owner authorization.

**Preflight gate:** `PREFLIGHT VERIFIED` — the documentation and blockers were
independently verified; there is still no safe single-snapshot legacy replay
entry point or approved complete read-only control-state export. See
[`evidence/RA-004-PREFLIGHT.md`](evidence/RA-004-PREFLIGHT.md) and the
machine-readable [`evidence/RA-004-shadow-plan.json`](evidence/RA-004-shadow-plan.json).

**Control-state exporter gate:** `READY_FOR_VERIFICATION` — the versioned exporter core,
authorization gate, fixture provider, CLI, pagination, consistency, redaction,
fingerprints and architecture-boundary tests are implemented. The newly
owner-approved transactional interface and unwired live-provider contract passed
their isolated local database tests and the complete repository full gate.
Live provider construction still fails closed without a separately
injected transport and future dedicated credential. See
[`evidence/RA-004-CONTROL-STATE-EXPORTER.md`](evidence/RA-004-CONTROL-STATE-EXPORTER.md).

**Control-state interface:** `VERIFIED_COMPLETE` — Marek
approved one bounded transactional RPC, separate future environment credentials
outside Git, and one minimal shared append-only evidence ledger. The migration
and unwired provider contract passed the fresh-baseline local PostgreSQL,
role/ACL/RLS, ledger, eleven-source and two-connection snapshot tests under both
`REPEATABLE READ` and ordinary `READ COMMITTED`. Status is
`CONTROL-STATE INTERFACE VERIFIED_COMPLETE`; repository LF
policy preserves the exact committed bytes of deterministic artifacts, and the
new migration remains excluded from both deployment selectors. No login,
secret, remote apply or live export was created. See
[`evidence/RA-004-CONTROL-STATE-INTERFACE-DESIGN.md`](evidence/RA-004-CONTROL-STATE-INTERFACE-DESIGN.md).

**Test-only single-snapshot adapter:** `VERIFIED_COMPLETE` — one controlled
local read is split before retailer-specific logic. The legacy copy uses the
active projector/classifier; the canonical copy uses an independent 10 Reps
connector and canonical v1 zero-write harness. Static goldens and a closed
run-level comparator produce 9/9 exact record parity, zero integrity mismatches,
zero unclassified/defect/unexplained rows, and zero prohibited capability
attempts. The explicit static raw SHA is checked before either replay path, and
the comparator regenerates nested record/integrity counts rather than trusting
report summaries. See
[`evidence/RA-004-SINGLE-SNAPSHOT-ADAPTER.md`](evidence/RA-004-SINGLE-SNAPSHOT-ADAPTER.md).

RA-004 remains `IN_PROGRESS`; the control-state interface and single-snapshot
adapter are `VERIFIED_COMPLETE`, and the shadow manifest remains
`NOT_AUTHORIZED`. The
[`evidence/RA-004-OWNER-DECISION-PACK.md`](evidence/RA-004-OWNER-DECISION-PACK.md)
is `VERIFIED_COMPLETE`. On 24 September 2026 Marek approved its five recommended
policies and future-preparation parameters. D1–D3 are `OWNER_APPROVED`; D4–D5
are `OWNER_APPROVED_FOR_FUTURE_PREPARATION`. This permits a separate staging
canary implementation plan and credential design only. Staging execution,
migration application, credential issuance/use, production, live capture,
live control-state export, shadow, control plan, approval, import, apply,
Model B and cutover remain `NOT_AUTHORIZED`; auto-safe classes remain
`NONE_APPROVED`.

**Staging-canary implementation plan:** `PREPARATION OWNER_APPROVED` and
independent verification is `VERIFIED_COMPLETE`; neither status indicates
execution readiness. The documentation-only plan and manifest are
[`evidence/RA-004-STAGING-CANARY-IMPLEMENTATION-PLAN.md`](evidence/RA-004-STAGING-CANARY-IMPLEMENTATION-PLAN.md)
and
[`evidence/RA-004-staging-canary-plan.json`](evidence/RA-004-staging-canary-plan.json).
They preserve the migration's staging and production selector exclusions and
define the future one-retailer, one-RPC, no-retry, maximum-60-minute canary and
maximum-30-minute credential. Staging execution, migration application,
credential issuance/use, live export, production and shadow remain
`NOT_AUTHORIZED`. Independent verification used the exact initial PR head in a
clean worktree, rejected all eight controlled authorization/contract mutations,
passed 84/84 focused tests, Project Guardian, TypeScript, ESLint,
`verify:quick` and `verify:full`, including the production build, and made no
staging or production connection. The next task is preparation of a separate
authorization package for a bounded read-only staging preflight; this closeout
does not connect to staging and no execution step may begin.

**Staging-preflight authorization pack:** preparation is `AUTHORIZED`, final
owner-decision verification is `VERIFIED_COMPLETE`, and all five decisions
are `OWNER_APPROVED_FOR_FUTURE_PREPARATION`. On 25 September 2026 Marek Kalinka
approved their requirements and future preparation through
`EXPLICIT_OWNER_INSTRUCTION`. Future local implementation preparation in one
separate PR is `AUTHORIZED`; staging deployment and execution are not.
The documentation-only pack and manifest are
[`evidence/RA-004-STAGING-PREFLIGHT-AUTHORIZATION-PACK.md`](evidence/RA-004-STAGING-PREFLIGHT-AUTHORIZATION-PACK.md)
and
[`evidence/RA-004-staging-preflight-authorization.json`](evidence/RA-004-staging-preflight-authorization.json).
Repository audit found no deployed metadata-only role, bounded project/retailer
identity interface, migration-ledger/schema metadata RPC, closed preflight
provider/CLI or approved private evidence store. These are recorded as
`BLOCKED_INTERFACE_GAP`; general SQL and existing validator, approver, executor
or service-role credentials are not accepted as substitutes. Control-plane and
database reads, staging connection, credential issuance/use, preflight,
migration, canary, production, live export and shadow remain `NOT_AUTHORIZED`.

**Staging-preflight local interface implementation:** `VERIFIED_COMPLETE`.
One consolidated local implementation now provides the metadata-only Q2-Q7
RPC, dedicated `NOLOGIN NOINHERIT` roles, closed Q1/Q8 provider boundaries,
fail-closed runner and CLI, six closed schemas, write-once redacted evidence,
fixtures and isolated PostgreSQL 17 verification. Both the existing
control-state migration and the new preflight migration remain SHA-bound and
excluded from STAGING and PRODUCTION deployment selectors. Q1 and Q8 remain
`BLOCKED_TARGET_CONFIGURATION`; all staging, production and execution actions
remain `NOT_AUTHORIZED`. See
[`evidence/RA-004-STAGING-PREFLIGHT-LOCAL-IMPLEMENTATION.md`](evidence/RA-004-STAGING-PREFLIGHT-LOCAL-IMPLEMENTATION.md).
Independent verification in a clean detached worktree corrected bounded target,
nested-schema, ACL/policy and pre-revoke evidence gaps, then passed the focused
regressions, both fresh networkless PostgreSQL 17 tests and repository quality
gates. This closes only the local implementation; RA-004 remains `IN_PROGRESS`.

**Bounded live transport:** `VERIFIED_COMPLETE`. Marek explicitly
authorized one separate implementation-and-merge PR on 25 September 2026. The
shared follow-up adds only the exact one-call PostgreSQL transports required by
the existing preflight and control-state providers. It accepts database URLs
only through in-memory dependency injection, binds them to the exact staging
project and temporary login, performs one static parameterized RPC in a
read-only transaction, closes the client without retry, and requires a distinct
issuer-process revoke receipt for preflight. It adds no activation manifest,
credential loader, service-role path, workflow, scheduler, importer or executor.
Both migrations remain excluded from STAGING and PRODUCTION, and no remote
execution was performed. Draft PR #97 at implementation head
`7c321744f229992b3e24a2862d936783f7aaa714` passed independent verification in
a new detached worktree: focused tests `118/118`, Project Guardian,
`git diff --check` and `npm run verify:full`, including the production build.
See
[`evidence/RA-004-BOUNDED-LIVE-TRANSPORT.md`](evidence/RA-004-BOUNDED-LIVE-TRANSPORT.md).

**Staging execution coordinator:** `OWNER_AUTHORIZED_PREPARED_NOT_EXECUTED`.
After PR #98 merged the exact staging selector activation, the first local
execution attempt stopped during read-only selector verification because an
untracked helper consumed the selector SHA map incorrectly. No remote mutation
occurred and no authorization window started. Marek then explicitly authorized
a separate preparation, verification and merge PR for the missing tracked
one-shot coordinator. It consumes only the selector-materialized workdir,
delegates migration application to the Supabase CLI, separates credential
issuance into another process, gates one canary on one complete preflight, and
revokes both RPC-only logins in `finally`. Production, feed, shadow, control
plan, approval, import, apply, offer writes, Model B, scheduler and retry remain
absent and unauthorized. See
[`evidence/RA-004-STAGING-EXECUTION-COORDINATOR.md`](evidence/RA-004-STAGING-EXECUTION-COORDINATOR.md).

Independent verification at initial head
`0b2752ac60cd8e38659751a227487f328def574b` confirmed the initial manifest
fingerprint `732cccf46eb4467460029b411f5138f81f4af69a9ad88235e6ed20d9051f7149`,
rejected all 12 controlled mutations and produced final canonical fingerprint
`9ed7ea2bea9a7fb2c2a521da87314ef6c438c46c46b751be254f7e57e2239b64`.
Project Guardian, 89 focused exporter/selector tests, TypeScript, ESLint,
`verify:quick` and `verify:full`, including the production build, passed without
staging, production, control-plane, database, SQL, credential or secret access.
Final independent verification in a second clean detached worktree rejected all
15 controlled mutations and passed Project Guardian, 89 focused tests,
TypeScript, ESLint, `verify:quick` and `verify:full`, including the production
build. The approval does not expire or expand automatically. The operator, issuer,
project reference, host, retailer ID, window and evidence store remain
unapproved and `UNRESOLVED`. Plan, fingerprint, query-allowlist, credential or
interface changes require reevaluation. The historical next task named here was
completed by the verified local implementation. The current next gate is
green GitHub checks and ordinary merge of the independently verified bounded
transport, followed by a separately controlled staging activation; no staging
deployment or preflight occurs in the transport PR.

**Staging 10 Reps retailer fixture:** `STAGING_VERIFIED_COMPLETE`.
The authorized read-only staging inventory found no 10 Reps retailer row, so
the prior coordinator stopped before all mutation and canary steps. Marek then
authorized one separate preparation, independent-verification and merge PR for
one minimal staging-only record. The new transactional migration is bound to
the exact trusted staging target, rejects production, requires an empty
name-or-slug match, derives a staging sequence ID while refusing production ID
`14`, and writes only the retailer name and slug. It remains SHA-bound and
excluded from ordinary STAGING and PRODUCTION selectors. This preparation does
not authorize or perform remote migration application, production, feed,
shadow, plans, approvals, imports, apply or canary retry. Marek subsequently
authorized a separate exact-SHA activation PR and one staging application
attempt after independent verification and merge. The prepared selector binds
the exact 94-row pre-ledger to the expected 95-row post-ledger, selects only the
fixture, defers seven unrelated migrations and exposes no retry, canary or
production action. PR #102 repaired the CLI 2.111.0 Management API transport
failure without weakening the selector: the password-free target URL is passed
to documented direct-database `db push`, while its password remains only in
`PGPASSWORD`; no PAT is accepted. Independent clean-worktree verification and
all GitHub checks passed before squash merge
`1d24497897ecec25c95cd1f3cd32171c0412db23`. The one authorized staging attempt
was then consumed. Fresh read-only verification proved the exact 95-row ledger
fingerprint, one minimal `10 Reps` / `10-reps` retailer row at staging ID `11`,
zero production actions and zero canary actions. Rerun is not authorized and
RA-004 remains `IN_PROGRESS`. See
[`evidence/RA-004-STAGING-10REPS-RETAILER-FIXTURE.md`](evidence/RA-004-STAGING-10REPS-RETAILER-FIXTURE.md)
and
[`evidence/RA-004-STAGING-10REPS-RETAILER-FIXTURE-ACTIVATION.md`](evidence/RA-004-STAGING-10REPS-RETAILER-FIXTURE-ACTIVATION.md).

**Forward-reissued interface migrations:** `VERIFIED_COMPLETE`. The two
original interface migrations remain byte-for-byte unchanged, while equivalent
fail-closed contracts are reissued at `20260927100000` and `20260927101000`,
both later than the verified staging ledger head. A networkless PostgreSQL 17
test proves fresh installation after a simulated 95-row ledger, safe recognition
of the exact old contract, the expected 97-row post-ledger, unchanged catalogue
row counts and rejection of function, role, grant and policy drift. Old and new
migrations remain SHA-bound and excluded from ordinary STAGING and PRODUCTION
selection. The consumed v5 activation is closed; no replacement activation,
credential or remote execution is included. See
[`evidence/RA-004-FORWARD-REISSUED-INTERFACE-MIGRATIONS.md`](evidence/RA-004-FORWARD-REISSUED-INTERFACE-MIGRATIONS.md).

**Staging schema dependency closure:** `VERIFIED_COMPLETE`. The one forward
activation was consumed and closed after the first interface migration found a
missing canonical source table; zero migrations were applied and the staging
ledger remained at 95. One authorized read-only inventory then found the full
gap: three source tables and three production-named contract roles, with no
additional missing or drifted input dependency. The new forward-only
compatibility migration recreates those exact structures without rows,
approvals, executor functions or production wiring. A networkless PostgreSQL 17
test proves the exact three-migration sequence, both RPCs, minimal ACL/RLS,
unchanged business counts, replay rejection and fail-closed drift handling.
Both selectors remain closed; no staging retry is authorized. See
[`evidence/RA-004-STAGING-SCHEMA-DEPENDENCY-CLOSURE.md`](evidence/RA-004-STAGING-SCHEMA-DEPENDENCY-CLOSURE.md)
and
[`evidence/RA-004-FORWARD-STAGING-ACTIVATION.md`](evidence/RA-004-FORWARD-STAGING-ACTIVATION.md).

**Corrected preflight ledger contract:** `VERIFIED_COMPLETE`. The immutable
`20260927101000` migration remains excluded after its Q3 RPC was proven to
expect the obsolete control-migration ledger name. The complete forward-only
`20260927102000_correct_ra004_staging_preflight_ledger_contract.sql` installs
the interface when absent and upgrades only either known repository-owned
predecessor definition after validating the full role, ownership, policy and
ACL boundary. SQL, runtime contract, selector and evidence all require
`reissue_transactional_retailer_control_state_interface`. STAGING and
PRODUCTION selectors remain closed; no remote execution or retry is authorized.

**Corrected staging activation:** `ATTEMPT_CONSUMED_FAILED_TERMINAL`.
The one-shot staging selector is bound to baseline
`aad469766b8491ef4eedffa143c33a7f3335d6bb`, the attested 95-row ledger and
exactly the compatibility, reissued control-state and corrected preflight
migrations. The defective `20260927101000` migration and seven unrelated
pending migrations remain excluded. The expected post-ledger is 98 rows ending
at `20260927102000`. Execution is permitted only from the clean, independently
verified squash-merged activation commit; production and shadow remain closed.
The single attempt from merge commit `276f2761b4b76ab33ce56f6dc4e723ff61990d62`
stopped transactionally on
`RA004_COMPATIBILITY_ROLE_DRIFT: retailer_catalogue_production_approver`.
Ledger readback remained the exact 95-row pre-state and zero migrations were
applied. Preflight and canary did not run. Evidence-session cleanup completed,
no RPC credential was created, and the activation is terminally closed with no
retry authorized.

**PostgreSQL 17 compatibility-role correction:**
`INDEPENDENTLY_VERIFIED_DRAFT`. The compatibility migration now
admits only PostgreSQL 17's exact automatic administrative edge from the
explicitly verified `postgres` migration user to each of the three compatibility
roles: `ADMIN TRUE`, `SET FALSE`, `INHERIT FALSE`, with a superuser grantor.
Every other membership, identity, option, role attribute or direct object ACL
fails closed. Networkless PostgreSQL 17 tests cover the real non-superuser
`CREATEROLE` path and negative drift. STAGING and PRODUCTION selectors remain
closed, and the consumed historical activation cannot select the revised SHA.
See
[`evidence/RA-004-POSTGRESQL-17-COMPATIBILITY-ROLE-CONTRACT.md`](evidence/RA-004-POSTGRESQL-17-COMPATIBILITY-ROLE-CONTRACT.md).

**Consolidated Supabase ownership architecture:** `READY_FOR_VERIFICATION`.
The exact staging-derived local baseline is ledger `96`, ending at the already
applied compatibility migration. One new migration,
`20260927103000_consolidate_ra004_supabase_ownership_interfaces.sql`, creates
both remaining interfaces as objects owned by the verified `postgres`
migration identity. It performs no `SET ROLE`, creates no persistent interface
roles and grants no runtime access. Temporary execution-window roles receive
only direct `EXECUTE` plus schema `USAGE`; cleanup revokes those rights before
dropping the role and its PostgreSQL 17 automatic administrative edge. A
networkless PostgreSQL 17 test proves exact ledger-96 installation, Q1–Q8, one
synthetic read-only canary, unchanged business counts, negative privilege
checks, deterministic cleanup and fail-closed replay and drift. STAGING and
PRODUCTION selectors remain closed; there is no activation or remote execution
in this draft. See
[`evidence/RA-004-CONSOLIDATED-SUPABASE-OWNERSHIP-ARCHITECTURE.md`](evidence/RA-004-CONSOLIDATED-SUPABASE-OWNERSHIP-ARCHITECTURE.md).

**Final consolidated staging activation:**
`ATTEMPT_CONSUMED_FAILED_TERMINAL_PLATFORM_LIMITATION`.
The one-shot activation applied only the reviewed consolidated migration and
advanced the staging ledger from 96 to 97. Q1–Q8 then failed closed on
`RA004_PREFLIGHT_LEDGER_UNKNOWN` because the PostgreSQL RPC ledger fingerprint
did not match the selector/runtime fingerprint for the same 97 rows. Canary was
not run. The evidence session and window are closed; bounded emergency cleanup
verified the temporary role and membership absent. Compatibility and the
consolidated migration are now recorded as already applied; every older RA-004
interface migration and the production selector remain closed. See
[`evidence/RA-004-CONSOLIDATED-OWNERSHIP-ACTIVATION.md`](evidence/RA-004-CONSOLIDATED-OWNERSHIP-ACTIVATION.md)
and
[`evidence/RA-004-CONSOLIDATED-STAGING-ATTEMPT-CLOSEOUT.md`](evidence/RA-004-CONSOLIDATED-STAGING-ATTEMPT-CLOSEOUT.md).

**Canonical ledger fingerprint contract:** `READY_FOR_FINAL_REVERIFICATION`.
The exact 97-row terminal staging ledger is reconstructed locally and frozen as
a neutral `{version,name}` fixture. `RA004_LEDGER_V1` projects only those two
fields, sorts by UTF-8 version then name, assigns logical ordinals and hashes one
canonical UTF-8 JSON document. The same exact ledger now produces
`bbfc25a25826ebfd4901941099903921e1f5adeb9d952eb6aa93c64939e3849c`
in Node.js and the unchanged PostgreSQL 17 RPC. The former selector hash
`1692043d963e98570cd69ea2f46654c35f35a78f26c35b3d96e04751d528331c`
was SHA-256 of the non-canonical raw JavaScript row array. Historical closeout
evidence remains immutable; the failed preflight remains failed, the canary was
not run, both selectors remain closed and no retry is authorized. See
[`evidence/RA-004-CANONICAL-LEDGER-FINGERPRINT-CONTRACT.md`](evidence/RA-004-CANONICAL-LEDGER-FINGERPRINT-CONTRACT.md).
The reviewed GTIN production release now distinguishes an already-applied
historical migration from the current pending authorization set: it verifies
the approved local migration SHA, hashes the 221-row ledger explicitly in the
`PRODUCTION` domain, proves the required schema, returns `ALREADY_PRESENT` with
zero writes and cannot redeploy that migration. An absent GTIN ledger row fails
closed as `NOT_CURRENTLY_AUTHORIZED`; the pending Fit House migration does not
authorize GTIN.

**ACL/RLS diagnostic staging activation:**
`ATTEMPT_CONSUMED_FAILED_TERMINAL`.
One bounded `REPEATABLE READ READ ONLY` staging transaction proved the durable
RPC grants, ownership, forced RLS and four RA-004 policies match their closed
contract. The failure was a false positive in the aggregate check: effective
privilege helpers counted safe managed-platform access inherited through
PostgreSQL `PUBLIC` as a direct grant to the temporary RA-004 login. The
forward-only correction inspects explicit role ACL entries, retains every role,
RPC, RLS and policy guard, and gives every mismatch a distinct fail-closed code.
The subsequent authenticated activation established the private evidence
session and applied the correction once, advancing the staging ledger from 97
to 98. Its single preflight captured metadata but stopped on
`RA004_REVOKED_CREDENTIAL_RECONNECTED`; the canary was not run. A bounded
read-only catalogue readback verified the temporary role and membership
absent. The evidence session and execution window are closed, the activation
is non-replayable, and both selectors are closed. See
[`evidence/RA-004-ACL-RLS-DIAGNOSTIC.md`](evidence/RA-004-ACL-RLS-DIAGNOSTIC.md)
and
[`evidence/RA-004-ACL-RLS-AUTHENTICATED-ATTEMPT-CLOSEOUT.md`](evidence/RA-004-ACL-RLS-AUTHENTICATED-ATTEMPT-CLOSEOUT.md).
The systemic query-aware revoke-verifier correction is documented in
[`evidence/RA-004-QUERY-AWARE-REVOKE-VERIFIER.md`](evidence/RA-004-QUERY-AWARE-REVOKE-VERIFIER.md).

**Control-export provider identity correction:**
`ATTEMPT_CONSUMED_FAILED_TERMINAL`.
The provider-identity migration is present on staging at ledger 99. The bounded
preflight passed Q1–Q8. The one read-only canary failed before producing an
artifact, and the closeout serializer did not preserve its structured error
code. The forward-only
`20260928101000_align_ra004_control_export_provider_identity.sql` migration
accepts only the exact applied function shape, adds the live `session_user` to
the RPC response, preserves `SECURITY DEFINER`, the closed `search_path`, owner
and restrictive ACLs, and fails on replay or source drift. The coordinator now
uses the RPC's stable provider ID. PostgreSQL 17 proves the pre-correction
failure, corrected Q1–Q8 and read-only export, fail-closed identity drift, zero
business changes and closed selectors. See
[`evidence/RA-004-CONTROL-EXPORT-PROVIDER-IDENTITY.md`](evidence/RA-004-CONTROL-EXPORT-PROVIDER-IDENTITY.md).
The terminal staging attempt is recorded in
[`evidence/RA-004-PROVIDER-IDENTITY-STAGING-ATTEMPT-CLOSEOUT.md`](evidence/RA-004-PROVIDER-IDENTITY-STAGING-ATTEMPT-CLOSEOUT.md).
The system-level serializer correction and closed canary-only activation are
documented in
[`evidence/RA-004-FINAL-CONTROL-STATE-CANARY.md`](evidence/RA-004-FINAL-CONTROL-STATE-CANARY.md).

**LIVE SHADOW RUN NOT AUTHORIZED**

**Goal:** compare the candidate canonical pipeline with the existing 10 Reps
path, with zero business/control writes.

**Scope:** all 950 approved mappings; current safe/review partition; source,
identity, diff, guard and status parity.

**Out of scope:** cutover, approval creation, apply, queue publication and
baseline widening.

**Dependencies:** RA-002 and RA-003; owner-approved shadow window.

**Existing solutions checked:** shared Fit House engine profile, protected CSV
reader, 950-row manifest, current 935/15 evidence and onboarding fixtures.

**Acceptance:** deterministic parity or explained owner-approved differences;
zero DB writes; no leaked retailer condition in shared core; source failure does
not affect other retailers.

**Tests:** repeated shadow captures, missing-row, price, stock, identity,
collapse and concurrency fixtures; quick/full gates.

**Evidence:** paired artifact digests, row-level parity report, run IDs and
zero-write attestation.

**Rollback:** disable shadow invocation; existing path untouched.

## Retailer migration task template

Each RA-005–RA-015 task has the same mandatory contract:

- **Goal:** migrate exactly one retailer after shadow parity.
- **Scope:** connector/config/fixtures and routing for that retailer only.
- **Out of scope:** another retailer, shared guard weakening, identity cleanup
  without separate owner approval, historical-data rewriting.
- **Dependencies:** RA-004 and evidence-based owner sequencing decision.
- **Existing solutions:** named current connector, parser, manifest, validator,
  executor, postflight, watchdog and tests from `AUDIT.md`.
- **Acceptance:** shadow parity; owner-approved canary; per-row isolation;
  atomic apply; price-history parity; postflight/idempotency/watchdog pass;
  legacy path remains recoverable during observation.
- **Tests:** common harness plus retailer fixtures and every linked incident;
  quick/full gates and isolated integration where applicable.
- **Evidence:** before/after digests, exact scope, run/artifact IDs, production
  readback and no-unrelated-change proof.
- **Rollback:** route back to preserved legacy path; do not delete plans/history.

The IDs below do not establish order:

| Task | Retailer | Status | Additional required proof |
|---|---|---|---|
| RA-005 | Discount Supplements | `NOT_STARTED` | 109 automatic plus 47 residual offers; rename/ownership clarity for `creatine` workflow. |
| RA-006 | Dolphin Fitness | `NOT_STARTED` | one exact automated offer and two unresolved generic legacy identities. |
| RA-007 | eBay UK | `NOT_STARTED` | 237-scope API parity, Review Queue publication, post-apply source-drift closeout and batch workflow retirement decision. |
| RA-008 | Fit House | `NOT_STARTED` | all approved absence/OOS policies, ten deferred changes and removal of Fit-House logic from shared core. |
| RA-009 | GYM HIGH | `NOT_STARTED` | full catalogue atomic parity, legacy identity cases and recognized DB postflight. |
| RA-010 | Jon's Supplements | `NOT_STARTED` | reconcile dedicated production path with existing retailer-snapshot harness; four current reviews. |
| RA-011 | KIOR Health | `NOT_STARTED` | exact 11-row golden path and historical registration hash repair. |
| RA-012 | Predators Gear | `NOT_STARTED` | source access/readiness and owner decision before any apply; 47 stale offers. |
| RA-013 | Simply Supplements | `NOT_STARTED` | Shopify versus historical Awin policy boundary, threshold shipping and aggregate price confirmations. |
| RA-014 | 6 Pack Supplements | `NOT_STARTED` | 506-row WooCommerce parity and consolidation of extensive family/review machinery. |
| RA-015 | Whey Okay | `NOT_STARTED` | resolve missing mapped-source fingerprint row; EKM parsing and 589 automatic/legacy scope boundary. |

## RA-DECOMMISSION — Remove old paths and exceptions

**Status:** `NOT_STARTED`

**Goal:** remove only fully migrated runtime paths and expired exceptions.

**Scope:** dead workflows/scripts/config branches after every applicable retailer
passes observation.

**Out of scope:** data/history deletion, active plans or owner-deferred scope.

**Dependencies:** RA-005–RA-015 verified and RA-OBSERVE complete.

**Existing solutions checked:** workflow archive pattern, quality manifest,
control ledger and exception inventory.

**Acceptance:** no active reference/session; one importer/approval/executor path;
exception removal condition met; tests/docs updated; owner approval.

**Tests:** repository reference scan, quick/full/integration gates, production
readback and rollback rehearsal.

**Evidence:** removal manifest, commit/run/artifact IDs.

**Rollback:** restore routing/code from tagged pre-decommission commit; preserve
DB history.

## RA-OBSERVE — Production observation period

**Status:** `NOT_STARTED`

**Goal:** prove stable operation across owner-approved time and event coverage.

**Scope:** scheduled runs, review backlog, source failures, commercial changes,
postflight/idempotency, watchdog and cross-retailer isolation.

**Out of scope:** feature additions or threshold widening.

**Dependencies:** migrated retailers active; duration decided in RA-001.

**Existing solutions checked:** Actions artifacts, watchdog, Review Queue and
price-history observation mechanisms.

**Acceptance:** required consecutive runs and event cases pass; no unexplained
status; no silent row; no unrelated retailer blockage.

**Tests:** scheduled live evidence plus read-only production checks.

**Evidence:** observation ledger with every run/artifact digest.

**Rollback:** route affected retailer back independently.

## RA-CLOSEOUT — Programme verification

**Status:** `NOT_STARTED`

**Goal:** verify the entire programme and freeze the final architecture record.

**Scope:** contracts, all retailer routes, safety invariants, legacy removal,
documentation and operational ownership.

**Out of scope:** new catalogue/SEO features.

**Dependencies:** all migration tasks, RA-DECOMMISSION and RA-OBSERVE verified.

**Existing solutions checked:** all evidence ledgers and production readbacks.

**Acceptance:** one canonical pipeline; one diff/validator/approval/executor
contract; no unauthorized retailer branch in shared core; all incidents covered;
full gates and independent live verification pass; owner signs closeout.

**Tests:** `verify:project`, quick/full/integration as applicable, contract and
workflow inventory, live read-only watchdog/postflight.

**Evidence:** final commit, CI/live run IDs, artifact digests and owner approval.

**Rollback:** retained release tag and per-retailer routing rollback until owner
ends the rollback window.

## Owner decisions recorded for RA-001

Marek approved on 2026-09-23:

1. `retailer-offer-sync` as the common spine, retaining the existing guarded
   write/control mechanisms and later incorporating snapshot/replay contracts;
2. Model B in principle, with no current auto-safe class, threshold, automatic
   apply or production permission authorized;
3. the separate source/change/execution/run/alert/action taxonomy, including
   `PASS_WITH_REVIEW`, `SKIPPED_EQUIVALENT_ACTIVE` and narrowly scoped
   `FAILED_SYSTEM`;
4. 10 Reps as the first shadow-only pilot and KIOR as the first small later
   cutover candidate, both behind later tasks and separate execution authority;
5. evidence-based legacy-removal gates, with no removal currently authorized
   and GYM HIGH plus Predators Gear remaining deferred.

The unresolved Whey Okay fingerprint cause, Predators source availability,
active plan/session/lock/approval inventory, exact future auto-safe classes,
future GYM HIGH disposition and eBay/GYM event coverage remain explicit future
dependencies. They do not block RA-001 closeout, but block the affected later
migration or activation until resolved. RA-002 is not started by these decisions.

## 8 November 2026 owner-authorized schedule pause, PR #508 merge and one read-only attempt

**Current authority for this release (supersedes earlier checkpoint permissions):**
the owner authorizes a minimal reversible schedule-protection PR and its normal
merge, then the exact approved PR #508 head
`d46f6c647a3e92140a522c24e14037a8f626cc9e`, then exactly one ordinary manual
main dry-run and independent before/after read-only production evidence. No
apply, mapping change, migration, recovery, replay or second source dispatch is
authorized. PR #508's head must remain unchanged. The previous source run
`42510124005` is historical BLOCKED evidence, not replay authority.

**SIX_PACK_SCHEDULE_PAUSED_PENDING_OWNER_APPROVAL** records an explicit owner
pause, with no automatic expiry. Cron `17 3 * * *` remains registered and
workflow_dispatch remains available. The main `six-pack-offer-refresh` job
and downstream `refresh-review-queue` now require workflow_dispatch at the
job boundary; schedule admits neither. The separate reviewed apply job already
requires workflow_dispatch plus apply-reviewed and remains unchanged. Thus
schedule cannot reach source capture, approvals, executor, control/history or
Review Queue publication, even with nonempty downstream outputs. No entire
workflow is disabled. No permissions, executor, approvals, data or other
retailer workflow is modified.

The existing workflow-retirement regression evaluates every job for scheduled,
manual, non-main and unrelated events; evaluates each write/idempotency step
for manual dry-run; checks downstream needs and all artifact bindings; and
confirms the sole active direct Six Pack executor workflow. No test file is
added/removed/renamed, so the existing 355-file inventory seal remains valid.
The shared Review Queue worker's registered execution adapters are audited
separately; no other retailer or worker is paused.

This checkpoint is appended to preserve a clean merge of the exact approved
PR #508 tree; its earlier release-permission paragraphs are historical.
Protection must be verified on main before #508 merge, and again on final main
before the single dry-run. Exact CI/run/merge receipts and production readbacks
are retained in the release evidence and final report. No RESTORED status is
claimed without an authorized apply, postflight and idempotency.

Restoration requires a separate explicit owner decision, a fresh writer/plan
inventory and a normal reviewed change restoring schedule admission in both
job conditions, with regression and CI evidence. Do not remove this protection
after the dry-run, and do not add an expiry, flag system or scheduler.
