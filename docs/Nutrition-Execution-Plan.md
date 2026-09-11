# Nutrition Data Enrichment — Execution Plan

**Status date:** 11 September 2026

## Current checkpoint

- Task: NUT-02; status `IN PROGRESS`. The first bounded implementation step,
  NUT-02A, is `CODE COMPLETE`: exact variant identity and durable private source
  provenance now survive the existing candidate/review/plan/apply path. The rest
  of NUT-02 remains open.
- Owner/session: Codex, owner-authorized NUT-02 exact-variant provenance
  session, 11 September 2026.
- Branch: `main`; this session started at
  `4ad0774104ddf4811061ac86ed4fdc09b8eba140`; remote `main` matched before work.
- Production readback at `2026-09-11T12:58:26.063Z`: public `anon` SELECT against
  project `aftboxmrdgyhizicfsfu`; 141 active unmerged Pre Workout products and
  575 active variants. Frozen scope: 25 variants across 21 products.
- Frozen list and exact criteria:
  [nutrition-pre-workout-pilot-scope-2026-09-11.json](rollouts/nutrition-pre-workout-pilot-scope-2026-09-11.json).
- Official-source preparation package:
  [nutrition-pre-workout-source-manifest-2026-09-11](rollouts/nutrition-pre-workout-source-manifest-2026-09-11/README.md).
  It records all 25 variants: 15 have confirmed source bindings and 10 remain
  unresolved. Eleven unique official URLs are split into collector-format batches
  of 7 and 4.
- NUT-01 closeout:
  [nut-01-closeout-2026-09-11.json](rollouts/nutrition-pre-workout-source-manifest-2026-09-11/nut-01-closeout-2026-09-11.json).
  Four archived images cover seven candidate variants. Exact label-to-variant
  applicability is confirmed only for product `38`, variant `726`; six archived
  candidates remain applicability gaps and 18 variants have no archived label.
- Earlier `TypeError: fetch failed` reproduced inside restricted networking.
  The same query passed with Node using the Windows system CA outside the sandbox;
  it was an environment transport/certificate-path issue, not missing database data.
- Source archive: after a fresh administrative duplicate check again returned zero
  buckets, the authorized session created private Supabase Storage bucket
  `nutrition-sources`. Service-role write/read and fresh-process hash readback passed;
  anonymous and unauthenticated reads failed. Objects have no automatic expiration.
  The owner handoff added four JPEG labels and its manifest without overwrite after
  a no-duplicate read. Storage alone is not represented as a backup.
- The collector still made no request. All seven archived label bindings have a
  final NUT-01 disposition. Variant `726` has confirmed name/flavour/package and
  exact label binding; ingredient values remain untranscribed and unapproved.
  Variants `760`, `761`, `815`, `816`, `1383` and `1384` lack evidence that the
  shared flavour-neutral table applies to their exact flavour. For `1383`/`1384`,
  `ABE Ultimate` versus `ABE All Black Everything` is an unresolved alias/version,
  not evidence of either an unchanged or changed formula.
- Existing untracked `docs/SupplementScout-Nutrition-Plan.txt` is owner material;
  preserved unchanged and excluded from this change's staging.
- NUT-02A changed code and a local-only migration; it did not migrate or write
  production. Existing product-scoped records remain compatible and are not
  backfilled. The canary uses product `38`, variant `726`, its recorded private
  object URI and SHA-256; its numeric value is explicitly test-only and is not an
  approved ingredient or catalogue fact.
- One next step, NUT-02B: extend the same candidate, review and guarded plan/apply
  contracts for caffeine, citrulline amount and form, beta-alanine and explicit
  confirmed-absence status, with unknown/conflict states kept distinct. Do not
  collect or apply pilot values in that schema step.

## Authority and scope

The [Operating Plan](SupplementScout-Operating-Plan-2026-07-15.md) owns project
priorities. [AGENTS.md](../AGENTS.md) and the
[Agent Operating Model](Agent-Operating-Model.md) govern execution. This is the
single nutrition stage/status ledger; the [extractor guide](nutrition-candidate-extractor.md)
remains the process manual. Repository searches found no existing general
Nutrition Data Enrichment ledger or colliding NUT-00–NUT-05 IDs. The
[protein variant review](Protein-Exact-Variant-Nutrition-Review-2026-08-23.md)
is a separate five-mismatch evidence scope, not a general nutrition roadmap.

The supplied Nutrition Plan text is historical intake after this incorporation;
do not maintain a second checkpoint there. All operative requirements needed to
resume are retained here, so the untracked intake is not a remote dependency.

MVP: a closed pilot of 20–30 existing pre-workout variants, counted by canonical
variant ID, with serving data, caffeine, citrulline including ingredient form,
beta-alanine, source and verification status. First customer result: verified
facts/source on existing product pages and a caffeine-free search filter. MVP
ends at NUT-04. No catalogue expansion, identity repair, new hub or autonomous
production authority. One nutrition implementation at a time; do not overlap
files, data or releases with another task. SEO-15, its 16 September check and
conditional 24–25 September reviews, SEO-17 dependency and GYM HIGH owner deferral
remain unchanged.

## NUT-00 audit: reuse / extend / unnecessary

| Decision | Existing evidence inspected at audited HEAD | Consequence |
|---|---|---|
| Reuse | `scripts/lib/nutrition-candidates.js`, extractor, manufacturer collector, candidate batch and Windows OCR; extractor guide | Existing bounded collection, hashes, source locators, offline parsing and LOW-confidence OCR proposals; no second collector or OCR service. |
| Reuse | `scripts/store-nutrition-candidates.js`, admin nutrition-candidates helpers/page, migrations `20260802100000`, `20260809120000`, `20260809130000` | Private RLS candidate queue, immutable evidence, approved values, manual missing-fact entry and batch work items already exist in code. Approval remains separate from product verification. |
| Reuse | `scripts/lib/nutrition-approved-updates.js`, `nutrition-approved-plan.js`, `nutrition-approved-apply.js` | Reviewed before/after plan, fingerprints, stale-state checks and transactional apply exist; extend the guarded path, not a second importer. |
| Reuse | `scripts/lib/reviewed-variant-nutrition.js`, migration `20260726210000_add_reviewed_variant_nutrition_apply.sql`, `data/verified/variant-nutrition-reviewed-batch-*-v2.json` | Exact-variant overrides and an older guarded writer already exist. Do not claim variant nutrition is absent. This pilot does not authorize that writer; the August 23 review explicitly requires extending the named candidate plan/apply pathway. |
| Reuse | `app/lib/nutritionMetrics.ts`, `app/pre-workout/page.tsx`, `app/lib/preWorkoutComparison.ts`, SEO-09 evidence in SEO ledger | Shared metrics, exact-variant resolution and existing Pre Workout comparison are established. Preserve verification/freshness gates and existing routes. Historical LIVE VERIFIED is not a new production check. |
| Extend, NUT-02 | Candidate FIELDS and SQL constraints contain seven numeric fields only: protein, creatine, serving g/ml/count, pack g/ml | Caffeine, citrulline/form and beta-alanine are not supported end to end. No structured caffeine-free filter was found in the audited app/schema/helper searches; product-name mentions are not verified facts. |
| Extend, NUT-02 | Store explicitly rejects non-null `product_variant_id`; candidate table lacks that column; planner updates products | Preserve exact variant applicability throughout capture, storage, review and apply, reusing existing overrides. Never silently broaden a variant fact to a product family. |
| Extend, NUT-01 decision / NUT-02 compatibility | Raw sources and OCR stay in ignored `tmp`; SQL snapshot reference requires `tmp/` | Select a durable private archive with hashes and cross-session retrieval before capture. Keep existing working copies; evaluate archive-reference compatibility in NUT-02. Never commit raw snapshots or treat tmp as an archive. |
| Extend, NUT-02 | Candidate and approved-value validation requires positive values | Model confirmed absence separately from unknown, present-without-dose and conflict. Do not encode missing evidence as zero or simply relax all numeric guards. |
| Unnecessary | Existing queue, imports, variant model, reports and project controls | No second admin panel, importer, catalogue, master roadmap, agent system, new public hub or cloud OCR is needed. |

Existing tests include extractor, candidate store/admin/batch, approved updates,
reviewed variant nutrition and nutrition metrics tests. Their presence is code
evidence, not proof of a fresh live run. Existing protein/creatine coverage audits
are reusable patterns; their denominators do not establish pre-workout coverage.

### Pilot candidates and remaining evidence

These are starting candidates from committed catalogue evidence, not an approved
20–30-variant manifest, nutrition evidence or a claim of current availability:

| Candidate | Repository evidence | Required validation |
|---|---|---|
| Product 528, Nutrend Pump Pre-Workout 225g | `data/verified/whey-okay-reviewed-format-q1-q2-2026-07-24.json`; external variants 4165/4166 | Resolve current canonical variant IDs and flavours; external IDs are not canonical IDs. |
| Product 839, Gas Mark 10 Pitbull Pump 25 servings | Migration `20260810240000_create_reviewed_jons_17_explicit_variants.sql`; Cherry Bubblegum entry, existing default 1186 | Resolve current exact Cherry Bubblegum variant; default ID is not proof of this flavour. |
| Product 972, Kilo Labs Supreme 20 servings Peach Rings | Migration `20260826160000_create_fit_house_owner_reviewed_exact_pack_10.sql`; default 1901 | Confirm current canonical pack/flavour identity and manufacturer source. |

These tentative NUT-00 candidates are superseded by the current production scope
below. The public read verified the selected product and variant records, but did
not expose retailer-product mappings or the private nutrition candidate queue;
no claim about current offer coverage or private queue state follows from it.

### Frozen pilot scope — NUT-01 preparation

The 11 September 2026 production readback supersedes the three tentative NUT-00
candidates above. The closed denominator is **25 active canonical variants across
21 active, unmerged products**. Selection required a non-default active variant,
an explicit flavour and package size, `pack_count=1`, `powder` format and a unique
product/flavour/size/unit/pack tuple. It excluded GYM HIGH, bundles, inactive or
merged records and incomplete variant identities. All 25 IDs were returned by the
current production read; no migration was used as evidence.

| Product ID | Variant ID | Brand | Canonical product | Flavour | Package |
|---:|---:|---|---|---|---:|
| 17 | 714 | Optimum Nutrition | Optimum Nutrition Gold Standard Pre-Workout 330g | Blue Raspberry | 330 g |
| 38 | 726 | Applied Nutrition | Applied Nutrition Pump 3G Pre-Workout 375g | Fruit Burst | 375 g |
| 55 | 1029 | BioTech USA | BioTech USA Nitrox Therapy 340g | Blue Grape | 340 g |
| 58 | 1007 | 5% Nutrition | 5 Nutrition Rich Piana Full As F*ck 387g | Blue Raspberry | 387 g |
| 215 | 1016 | Applied Nutrition | Applied Nutrition ABE Ultimate Pre-Workout 315g | Bubblegum Crush | 315 g |
| 294 | 1059 | BioTech USA | BioTech USA Black Blood CAF+ 300g | Cola | 300 g |
| 295 | 1041 | BioTech USA | BioTech USA Black Blood NOX+ 330g | Blood Orange | 330 g |
| 481 | 760 | Applied Nutrition | Applied Nutrition ABE Pump 500g | Blue Razz | 500 g |
| 481 | 761 | Applied Nutrition | Applied Nutrition ABE Pump 500g | Red Hawaiian | 500 g |
| 744 | 815 | Applied Nutrition | Applied Nutrition Pump 3G Zero Stim 375g | Fruit Burst | 375 g |
| 744 | 816 | Applied Nutrition | Applied Nutrition Pump 3G Zero Stim 375g | Icy Blue Razz | 375 g |
| 756 | 885 | 10X Athletic | 10X Athletic PUMP Non-Stim Pre Workout 50 servings | Apple Attack | 50 servings |
| 756 | 1974 | 10X Athletic | 10X Athletic PUMP Non-Stim Pre Workout 50 servings | Cobra Ki | 50 servings |
| 757 | 887 | 10X Athletic | 10X Extreme Stim Pre Workout 600g | Apple Attack | 600 g |
| 881 | 1383 | ABE All | ABE All Black Everything Pre-Workout 375g | Baddy Berry | 375 g |
| 881 | 1384 | ABE All | ABE All Black Everything Pre-Workout 375g | Bubblegum Crush | 375 g |
| 899 | 1487 | CNP | CNP Professional Full Tilt V2 Stim Pre Workout 570g | Cherry Berry Bomb | 570 g |
| 957 | 1864 | Applied Nutrition | Applied Nutrition ABE 30 servings | Baddy Berry | 30 servings |
| 961 | 1879 | Cellucor | Cellucor C4 Original – Energy, Focus & Performance Pre-Workout 30 servings | Millions Cola | 30 servings |
| 1249 | 3671 | Animal | Animal Fury Pre Workout 491g | Blue Raspberry | 491 g |
| 1252 | 3674 | Adapt Nutrition | Adapt Nutrition PreTRAIN X 350g | Iced Raspberry | 350 g |
| 1254 | 3676 | Bulk | Bulk Dope Max Pre-Workout 563g | Blue Raspberry | 563 g |
| 1275 | 3755 | Dark Stims | Darkstims Pump V2 Stim-Free Pre-Workout 520g | Peach | 520 g |
| 1279 | 3759 | Bulk | Bulk Dope Caffeine Free Pre-Workout 510g | Blue Raspberry | 510 g |
| 1283 | 3763 | Apex Formulas | Apex Formulas Apex Pump 625g | Raspberry Rush | 625 g |

Names containing Pump, Non-Stim, Zero Stim, Stim-Free, Caffeine Free or CAF+
remain identity strings only. No caffeine, stimulant, citrulline, beta-alanine,
serving or formulation fact is inferred from them. Source review may later mark
a variant confirmed, unknown or conflicting; it must not silently replace this
fixed denominator. One source page may cover multiple flavours only when its
current evidence explicitly establishes that applicability.

### Durable source storage decision

The repository still has no durable raw-source archive:

- `tmp/` is ignored, machine-local working storage and explicitly not an archive;
- committed source snapshots are forbidden by the extractor safety contract;
- `nutrition_candidates` and batch items preserve hashes, locators and excerpts,
  but not durable raw snapshot bytes, and variant-scoped storage is currently blocked;
- existing private GitHub Actions artifacts expire after 7–90 days and therefore
  cannot be the source of record.

The selected target is private Supabase Storage bucket `nutrition-sources` in the
existing production project, readable/writable only through the existing service-role/
owner boundary. It was created only after a second administrative read returned
zero existing and zero equivalent buckets. Its 10 MB object limit covers the
existing 5 MB manufacturer HTML and 8 MB image limits; allowed types are HTML,
XHTML, JSON, plain text, JPEG, PNG and WebP. Store an immutable batch manifest
plus raw page/image/OCR files
under content-addressed paths such as
`nutrition-sources/<batch-id>/<sha256>/<filename>`. Keep the `tmp/` copy only as
the bounded extractor workspace. Objects have no configured automatic expiration.
A content-addressed canary, the Batch 01 source manifest, four owner-supplied JPEG
labels and their handoff manifest passed service-role readback from new Node
processes. The four image hashes are recorded in the
[handoff archive report](rollouts/nutrition-pre-workout-source-manifest-2026-09-11/batch-01/owner-handoff-archive-2026-09-11.json);
anonymous SDK and unauthenticated public-URL reads of a new image were blocked.
This is durable primary storage evidence, not proof of backup or disaster recovery.
NUT-02 should add a
separate durable archive reference or compatible URI without weakening the current
`tmp/` path guard. No public policy, browser key, RLS policy, credential or schema
was added or changed.

## Stage ledger

Statuses reuse Guardian's vocabulary but are not currently parsed by Guardian.
For documentation-only NUT-00, `CODE COMPLETE` means documentation checked and
committed; `LIVE VERIFIED` means remote repository readback, never feature deployment.
Stages after NUT-01 have no executor assigned and no branch/implementation evidence;
assign these in this ledger when activated. Their dependency is their current gate,
not a newly discovered production blocker. NUT-01 closure does not authorize NUT-02
implementation or any nutrition catalogue write.

| ID | Status | Dependency | Closed scope | Completion evidence |
|---|---|---|---|---|
| NUT-00 | `LIVE VERIFIED` | Owner request | Register stages, inspect existing process/schema/evidence, reuse/gap audit, pilot candidates and links | Consistent committed plan; verify:project PASS before/after; recorded commit and confirmed remote availability; live-data limitations explicit. See closeout. |
| NUT-01 | `LIVE VERIFIED` | NUT-00 | Closed frozen denominator: 25 current variants across 21 products. Fifteen official page bindings confirmed, ten source/identity gaps; 4 archived readable images, 1 confirmed exact label-to-variant binding, 6 archived applicability gaps and 18 variants without an archived label. All 24 unresolved positions have a reason and required action. | Completion criterion is met because every frozen variant has a preserved official source disposition or explicit missing-source/identity/label status with reason and action. Archive hashes/readback, exact seven-label decisions and all 25 records are in the closeout report. No ingredient value is approved; closure is bounded evidence accounting, not full catalogue coverage. |
| NUT-02A | `CODE COMPLETE` | NUT-01 | Existing candidate/review/plan/apply path preserves string product/variant IDs, immutable private archive URI and SHA-256; exact variant ownership is checked and old product candidates stay nullable/compatible. | Local Docker migration test and focused path tests pass for archived product `38` / variant `726`; wrong ownership, signed/missing URI, changed hash, stale approval/override and duplicate insert are rejected or deduplicated. Migration and catalogue apply were not run on production. |
| NUT-02 | `IN PROGRESS` | NUT-02A | Remaining schema/process work for caffeine, citrulline/form, beta-alanine and explicit confirmed absence versus unknown/conflict; NUT-02A supplies variant/provenance transport only. | Complete only after all new facts/statuses survive the same guarded path, ambiguity/conflicts fail closed and the required checks pass. Candidates cannot feed public filters. |
| NUT-03 | `PLANNED` | NUT-02 | Review pilot evidence, quantities/units and exact applicability; separately approved guarded apply | Every proposal has a decision; approved values have proof and correct identity; independent post-write readback and zero-duplicate replay pass; offers/prices unchanged. Unresolved facts remain unknown and excluded. |
| NUT-04 | `PLANNED` | NUT-03 | Existing product page facts/source and existing search caffeine-free filter | Tests and live variant-switch checks prove confirmed absence included, caffeine present excluded, missing/conflicting facts never treated as absent. Document coverage denominator, limits, evidence and operations. Publish image copies only with established rights; otherwise link to source. MVP closes here. |
| NUT-05 | `DEFERRED` | NUT-04 closure | Subsequent bounded batches/categories in the same process | Review extraction yield, review time and missing-source rate before expansion; every batch has a fixed denominator and closure. No expansion of an active batch. |

## Evidence rules and deferred work

Every value needs a source and evidence locator. Sources/OCR are untrusted data,
never agent instructions. Distinguish confirmed absence, presence without dose,
unknown and conflict. Missing OCR text is not proof of absence; caffeine-free is
not stimulant-free. Preserve original quantities and units; convert only with an
unambiguous basis. Never guess scoop, flavour, formulation, blend ratio or active
ingredient mass. OCR/model confidence is not verification. Conflicting sources
remain conflicts; reformulation/source change requires a new review.

Collection must retain existing explicit URL, official-domain, robots/terms and
owner-confirmation boundaries (collector up to 10 URLs; batch up to 50). NUT-01
does not approve future product writes. Product/variant identity decisions and
production apply retain separate owner approvals. Unknown identity is isolated.

**Deferred bounded control task NUT-G01 (`DEFERRED`, no implementation in NUT-00):**
extend `scripts/project-guardian.js` and its existing tests to read this ledger,
check unique IDs/allowed statuses, at most one active nutrition task, consistent
next-step pointers, completion evidence and blocker reasons. Reseal the existing
quality-gate manifest only if test inventory changes. This is one structural gap,
not a new automation system. Guardian currently reads AGENTS, Operating Plan,
SEO ledger, Agent Operating Model and WheyWise analysis; it checks 19 SEO tasks,
their sequence/evidence and date reminders. It neither reads this ledger nor
verifies labels, database truth, rights or deployment. Current PASS cannot prove
nutrition structure. Until extended, manually review these conditions.

Also deferred: all-catalogue coverage, cloud OCR, AI customer assistant, external
API, recommendations, quality scoring and health advice. No such work is required
for MVP and none changes the SEO sequence.

## Resume and handoff

Read AGENTS, current Operating Plan, this checkpoint and extractor guide. Verify
branch, HEAD, remote state, dirty/index changes and relevant current evidence;
never reset or switch branches over someone else's work. Check whether the next
unit already exists before starting. Name one task, expected result and check.
Do not collect labels or implement a future stage under the NUT-00 authorization.

Keep one active nutrition task, scope and release boundary. Park new ideas above.
After two unsuccessful attempts with one method, record evidence and isolate the
blocker or change method within scope. At handoff record completed/checked/missing
work, blocker and remedy, files, branch/commit, checks, publication/deployment and
one exact next step here. Preserve evidence durably. A later session must read
the same current files, not reconstruct state from chat or the intake prompt.

Run verify:project before and after every roadmap/status/evidence edit. Code or
workflow implementation additionally requires verify:quick and verify:full; keep
integration isolated and production-write credentials out of quality-gate jobs.
No code, migration, test inventory or workflow is changed by this NUT-00 revision.

## NUT-02A exact-variant provenance evidence

11 September 2026, Codex owner-authorized bounded implementation session:

- Migration `20260911120000_add_nutrition_candidate_variant_provenance.sql`
  adds nullable `product_variant_id` and `source_archive_uri` to the existing
  private candidate table. Existing product-scoped rows need no backfill. Exact
  variant rows require a credential-free
  `supabase-storage://nutrition-sources/...` URI, and a database trigger verifies
  that the variant belongs to the candidate product. The existing review guard
  now treats variant ID and archive URI as immutable evidence.
- Extractor manifest v3, candidate storage, admin review, approved-plan v3 and
  explicit apply carry product ID, variant ID, original SHA-256 and private
  archive URI as strings. Review groups are exact product/variant targets;
  single review is bound to the current candidate fingerprint. Apply re-reads
  approval and evidence and writes a variant-scoped value only to that existing
  variant's `nutrition_override`. Product-scoped candidates retain their previous
  product-only behavior.
- The bounded fixture uses the previously archived product `38` / variant `726`
  URI and SHA-256. Its numeric fact is labelled `TEST ONLY` and was used only in
  isolated tests. The original image was not fetched or copied again, no OCR ran,
  and no candidate, nutrition value, migration or catalogue row was written to
  production.
- Focused candidate/store/admin/planner/apply/migration/selector tests passed:
  78 tests.
  The new network-isolated PostgreSQL integration test passed and proved legacy
  compatibility, exact ownership, private URI constraints, immutable approval
  evidence and duplicate-fingerprint idempotency. `npm run verify:quick` passed
  with sealed inventory 300/252 safe/44 integration/4 artifact-bound.
- The full `npm run verify:integration` run executed the new test successfully
  but did not finish green because two unrelated pre-existing Docker migration
  scenarios failed; an isolated retry made the Batch G test pass while the Jon's
  final-closeout fixture still failed its 10 Reps v8 anchor precondition. This
  step does not change either file or contract. The remaining integration chunk
  passed 40/41; its one transient PostgreSQL socket failure passed when rerun in
  isolation.
- `npm run verify:full` passed after registering the migration as pending, without
  applying it, in the exact staging and production migration selectors. It
  included Project Guardian, TypeScript, ESLint, the sealed safe-test inventory,
  baseline migration validation and the Next.js production build. Final
  `verify:project`, `verify:quick` and `git diff --check` also passed after the
  ledger update. Git publication is recorded in the session closeout commit
  history and report.
- NUT-02 remains open. Its only next step is NUT-02B in the current checkpoint;
  do not start pilot collection, OCR or catalogue writes as part of NUT-02A.

## NUT-00 closeout evidence

11 September 2026, Codex NUT-00 session:

- Commit `9eb82cc89847043ebb92f98c72e70fe5d035c553`, branch `main`, contains
  only AGENTS.md, the Operating Plan link/checkpoint and this canonical ledger.
  Push succeeded; a separate `git ls-remote origin refs/heads/main` returned
  that exact SHA. This proves GitHub availability, not application deployment.
- `npm run verify:project`: PASS before editing, after plan incorporation and
  before/after this closeout update; always 19 SEO tasks, next SEO-15, none in progress.
- `git diff --check`: PASS. Manual ledger review: unique stage IDs, no parallel
  active nutrition implementation, all future-stage dependencies and completion
  gates recorded, one next action in the checkpoint and links resolve locally.
- `npm run verify:full`: PASS (exit 0), including inventory, Guardian, TypeScript,
  ESLint, all 252 safe test files, baseline migration validation and production
  build. Inventory: 299 files, 43 isolated integration and 4 artifact-bound files.
  Build logged refused connections to its isolated `127.0.0.1:54321` endpoint;
  it still completed 36/36 pages. This is not a live-data check. No separate quick
  or integration run was needed for this documentation-only change.
- Three bounded SELECT probes (products 528/839/972, at most eight matching
  variants, candidate variant-column existence) failed with `TypeError: fetch
  failed` in both sandbox and permitted retry. No production readback or access
  failure cause is established. Do not infer current data or schema from that
  failure. Remedy is authenticated read-only access at the start of NUT-01.
- No label capture, candidate staging/review/apply, catalogue writes, code,
  migrations, tests, workflow edits or feature deployment were performed.
- Owner intake preserved unmodified and untracked, SHA-256
  `42399b7a185c2144cc26e0487384893323f026ecda754613fbd48833347a9336`.
- This closeout is a documentation follow-up to the published plan commit;
  its own commit is discoverable with `git log -1 -- docs/Nutrition-Execution-Plan.md`.
  Remote CI/deployment results are not claimed. The next work remains exactly
  the single NUT-01 action in the checkpoint; no further NUT-00 implementation remains.

## NUT-01 preparatory evidence

11 September 2026, Codex preparatory NUT-01 session:

- Starting branch/HEAD: `main` at
  `07321b4b68db2eca6bca04a40a15c24c21c648c4`; independent remote readback
  matched. No earlier NUT-01 edit or task was present. The only pre-existing
  working-tree item was the preserved untracked intake document.
- Restricted-network and permitted retries without the system CA reproduced the
  previous `TypeError: fetch failed`. A public `anon` SELECT with
  `NODE_OPTIONS=--use-system-ca` succeeded without changing a credential,
  permission or database setting. This isolates the earlier failure to the local
  TLS/network trust path used by Node; it was not a database-schema result.
- Readback mode was the application's existing public Supabase endpoint and anon
  key under active-row RLS. The full local readback contained 141 active unmerged
  Pre Workout products and 575 active variants at
  `2026-09-11T12:58:26.063Z`; its SHA-256 is
  `fe928bd4bb3b93178e409316cce3da0866c02c4e778de467ed402170070afe11`.
  The full file remains ignored in `tmp` and is not a durable source artifact.
- The committed frozen-scope evidence SHA-256 is
  `8956ca2dae631d33aa8d29f12bf283a8bd586020881864a0a93c4d95ca507724`.
  Independent local comparison returned PASS for 25 selected/25 found, 25 unique
  variant IDs, 21 unique product IDs, 25 unique semantic keys and zero field or
  active-state mismatches.
- Public `retailer_products` selection returned zero rows under RLS, so offer
  mapping and availability were deliberately not used as selection evidence.
  Public Storage discovery returned zero visible buckets without error; private
  bucket existence remains an administrator readback, not an inferred absence.
- Storage alternatives were checked against current repository contracts. The
  private Supabase Storage target and its prerequisite duplicate check are recorded
  above; no storage or schema change was made.
- `npm run verify:project` passed before and after the ledger/status change:
  19 SEO tasks, next SEO-15, none in progress. `git diff --check` passed and the
  frozen JSON parsed successfully. No code, workflow, migration or test changed,
  so quick/full/integration gates were not required by AGENTS.md.
- Scope commit `ed750cb4d2f5d7feb76276cecb907331336cf89d` was pushed to
  GitHub `main`; independent `git ls-remote origin refs/heads/main` returned that
  exact SHA. This proves remote documentation availability, not source capture,
  storage provisioning or feature deployment. The present closeout update is
  discoverable with `git log -1 -- docs/Nutrition-Execution-Plan.md`.
- This preparation does not complete NUT-01; the exact next action remains the
  source-manifest step in the current checkpoint.

## NUT-01 official-source manifest evidence

11 September 2026, Codex NUT-01 source-manifest session:

- The session started on `main` at
  `15f8ded9f4b4ce2fbc8fa76402d08cea6aa2243e`; local HEAD and `origin/main`
  matched. The existing frozen catalogue audit was reused without rerunning it.
  The owner's untracked intake document was preserved unchanged.
- Public read-only searches and official manufacturer page, collection,
  `robots.txt` and terms reads produced the committed
  [official-source preparation package](rollouts/nutrition-pre-workout-source-manifest-2026-09-11/README.md).
  Its variant record contains all 25 frozen canonical variants and keeps canonical
  product/variant IDs as strings. Fifteen variants have an unambiguous official
  product/flavour/package binding; ten retain explicit `NEEDS_REVIEW` reasons.
- The 15 confirmed bindings use 11 unique official product URLs. Existing-format
  source lists contain 7 and 4 URLs, below the collector limit of 10. A page is
  bound to multiple selected flavours only where that official page explicitly
  lists those flavours. Names such as Pump, Zero, Stim-Free and Caffeine Free were
  not treated as composition evidence.
- The existing manufacturer validator passed both copied `tmp/` inputs in
  `DRY_PLAN_NO_NETWORK` mode: source counts 7 and 4, `network_requests: 0`,
  `files_written: 0`, `ready_to_fetch: false` and stop reason
  `ROBOTS_TERMS_AND_FETCH_APPROVAL_REQUIRED`. No collection, OCR, raw snapshot,
  label download or archive write occurred.
- Public robots reads did not prohibit the recorded product paths. This does not
  grant reuse rights. BioTech USA terms prohibit the relevant download/electronic
  storage or processing without consent, and 10X terms prohibit spider/crawl/scrape
  without written permission; batch 02 is therefore blocked. Batch 01 remains at
  the existing owner terms/robots decision gate rather than being self-approved.
- An administrative read-only production `storage.listBuckets()` call, using the
  existing local service-role configuration, returned `bucket_count: 0`. It made
  no write or permission change. The planned private archive does not exist and
  must be provisioned by an authorized owner before collection.
- NUT-01 remains `IN PROGRESS`. No candidate, function, migration, product/variant,
  offer, nutrition value, database row, bucket or permission was created or changed;
  NUT-02 did not start.

## NUT-01 Batch 01 storage and collection-gate evidence

11 September 2026, Codex owner-authorized Batch 01 session:

- The session started on `main` at
  `b5e5b6901517d643b463d135680c3d02d5405dd6`; local HEAD and `origin/main`
  matched. The frozen 25-variant denominator and completed catalogue audit were
  reused. Batch 01 remained exactly 7 URLs covering 10 selected variants; Batch 02
  and the 10 `NEEDS_REVIEW` variants stayed outside collection.
- Before the authorized storage write, a new administrative service-role
  `storage.listBuckets()` read returned zero buckets and zero equivalent
  nutrition/label/source/evidence candidates. Private bucket `nutrition-sources`
  was then created with `public: false`, a 10,000,000-byte object limit, only the
  existing process's HTML/XHTML/JSON/text/JPEG/PNG/WebP types and no configured
  automatic expiration. No browser credential or public policy was added.
- A retained 334-byte canary at
  `storage-canary/2026-09-11/b5a66d9664f2401065eecf455dca650ba8154415960e53f11e6271a2b7330d24/readback.json`
  passed service-role readback with SHA-256
  `b5a66d9664f2401065eecf455dca650ba8154415960e53f11e6271a2b7330d24`.
  Anonymous SDK download and unauthenticated public-URL download both returned
  HTTP 400. A separate new Node process repeated the authenticated read and hash.
- The final 7-source Batch 01 manifest was uploaded without upsert at
  `manifests/nut-01/batch-01/33c1eb1edbf18a44058d91794a915b43b561baca10b0722ea8b14015b44c459c/sources.json`.
  A separate new process downloaded it, reproduced SHA-256
  `33c1eb1edbf18a44058d91794a915b43b561baca10b0722ea8b14015b44c459c`
  and parsed 7 sources. These retained objects prove durable primary storage and
  retrieval, not backup or disaster recovery.
- The corrected official Optimum Nutrition Terms of Use cover
  `www.optimumnutrition.com` and associated sites. Their permitted-use section
  requires prior written consent for the planned commercial copy/private storage;
  the owner's operational authorization was not treated as manufacturer consent.
  The source's 1 URL/1 variant is isolated as `WRITTEN_PERMISSION_REQUIRED`.
- Applied Nutrition and Bulk each link terms of sale. Those documents discuss
  consumer orders and do not decide automated page copying/private storage. This
  is recorded as `NO_DETERMINATIVE_INFORMATION`, distinct from an express written-
  permission requirement; their combined 6 URLs/9 variants are isolated pending
  clarification or an applicable site-use policy.
- No Batch 01 URL met the owner's condition that the terms permit collection.
  Therefore the existing collector was not run: page requests 0, collected pages
  0, readable labels 0, collected coverage 0/10 for Batch 01 and 0/25 for the full
  pilot. No OCR, candidate creation, ingredient extraction, product identity repair,
  catalogue/database write or NUT-02 work occurred. The detailed report
  is [Batch 01 collection gate](rollouts/nutrition-pre-workout-source-manifest-2026-09-11/batch-01/collection-gate-2026-09-11.json).
- `npm run verify:project` passed before and after the ledger edit: 19 SEO tasks,
  next SEO-15 and none in progress. The final Batch 01 source list passed the
  existing `DRY_PLAN_NO_NETWORK` validator with 7 sources, zero requests and zero
  writes. Frozen-scope/count/hash assertions and `git diff --check` passed. No code,
  workflow, migration or test inventory changed, so quick/full/integration gates
  were not required by AGENTS.md.

## NUT-01 Batch 01 owner label-handoff evidence

11 September 2026, Codex owner-authorized archive session:

- The session started on `main` at
  `16588870968e0a26927404aa9d953b2970f56196`; local HEAD and `origin/main`
  matched. The frozen denominator stayed at 25 variants/21 products and Batch 01
  stayed at 7 URLs/10 variants. The completed catalogue audit was not repeated,
  and the owner's untracked nutrition intake was preserved unchanged.
- `tmp/SupplementScout-Etykiety-Batch01.zip` had SHA-256
  `8c124719e8f6c6fea398c1a9b788d021371a9e18c2df1c45d7fc4260722e2f4b`.
  Its paths passed traversal checks and it was expanded to a new, non-existing
  `tmp/nutrition-batch01-owner-handoff-2026-09-11` directory without overwrite.
  `README.txt` and `manifest.json` were read. Raw handoff files remain ignored
  under `tmp/` and are not committed.
- All four JPEG files matched the manifest byte counts and SHA-256 values, decoded
  at 1500x1310, 935x1024, 2000x2000 and 2000x2000, and passed manual readability
  review. Their four product IDs and seven candidate variant IDs are members of
  the frozen pilot and their official page URLs match the published Batch 01 list.
- All images visibly establish the recorded product family and package. Product
  `38` also visibly establishes Fruit Burst, so variant `726` has the sole exact
  visible flavour binding in this handoff. Images for products `481`, `744` and
  `881` do not show a selected flavour, leaving variants `760`, `761`, `815`,
  `816`, `1383` and `1384` under applicability review. Product `881` additionally
  requires reconciliation of the image wording `ABE Ultimate` with the frozen
  product/formulation. No formulation or ingredient value was approved.
- Before writing, a service-role traversal of private bucket `nutrition-sources`
  found two existing retained objects and zero matching hashes or exact target
  paths. Four images and the handoff manifest were then uploaded with
  `upsert: false` under product- and hash-addressed paths. A fresh Node process downloaded
  all five objects, reproduced every hash and byte count, and parsed four image
  records from the archived manifest. Anonymous SDK access returned HTTP 404 and
  the unauthenticated public URL returned HTTP 400 for a new image.
- The detailed source URLs, canonical string IDs, hashes, archive paths and review
  states are in the committed
  [owner handoff archive report](rollouts/nutrition-pre-workout-source-manifest-2026-09-11/batch-01/owner-handoff-archive-2026-09-11.json).
  Preserved/readable images: 4; product/source/package bindings: 4; variants with
  a product label image: 7/10; exact visible flavour bindings: 1/10; flavour
  applicability pending: 6/10; no archived label image: variants `714`, `3676`
  and `3759`. This storage is not described as a backup.
- The existing collector was not run and no image was downloaded again. OCR,
  candidate storage, nutrition catalogue/database writes, function work and
  NUT-02 remained at zero. NUT-01 remains `IN PROGRESS`.

## NUT-01 exact applicability and closeout evidence

11 September 2026, Codex owner-authorized closeout session:

- The session started on `main` at
  `ff53e2d6a238d17c48e0d56cc9156ccddbbb524f`; local HEAD and `origin/main`
  matched. It reused the frozen scope, source manifests, archived-image hashes,
  manual readability results and successful private-storage readback. It did not
  rerun the catalogue audit, fetch a page or download an image.
- All seven archived label-to-variant candidates received a disposition. Product
  `38` / variant `726` is confirmed: the image itself establishes Pump 3G,
  Fruit Burst and 375 g, so the label is bound to that exact variant for later
  review. This does not approve or transcribe any ingredient value.
- Variants `760`, `761`, `815` and `816` remain unresolved because a flavour's
  presence on the official page does not prove that the single flavour-neutral
  table applies to it. Required evidence is a flavour-specific official label or
  an explicit manufacturer statement that identifies the common table and covered
  flavours for the captured formulation.
- Variants `1383` and `1384` have the same shared-table gap. The image says
  `ABE Ultimate`, while the source page and frozen product say
  `ABE All Black Everything`. The difference is recorded as an unresolved
  alias/version relationship; it proves neither formula equality nor reformulation.
  Resolution requires flavour-specific labels or manufacturer evidence covering
  both the name/version relationship and table applicability.
- The complete
  [NUT-01 closeout](rollouts/nutrition-pre-workout-source-manifest-2026-09-11/nut-01-closeout-2026-09-11.json)
  accounts for all 25 frozen variants with canonical IDs as strings. Fifteen retain
  confirmed official page bindings and ten retain source/identity gaps. Four images
  are archived; one exact label-to-variant binding is confirmed, six archived
  applications are unresolved and 18 variants have no archived label. Every one
  of the 24 unresolved positions names a concrete reason and required action.
- This satisfies the recorded NUT-01 completion rule: every frozen variant has a
  correctly bounded source disposition or explicit missing-source/identity/label
  status with reason and action. NUT-01 is therefore closed `LIVE VERIFIED` with
  explicit gaps. This is pilot evidence accounting, not full catalogue coverage,
  not approved nutrition coverage and not a representation of the archive as a
  backup. Existing Batch 01/02 rights constraints and the ten unresolved source
  entries remain unchanged.
- No OCR, candidate generation, function/schema implementation, product-identity
  repair, nutrition catalogue/database write or NUT-02 implementation occurred.
  The owner's untracked nutrition intake remained unchanged and outside staging.
- `npm run verify:project` passed before and after the documentation/status change:
  19 SEO tasks, next SEO-15 and none in progress. The 25-row closeout assertion
  passed with 25 unique string variant IDs, unchanged official URLs, one confirmed
  label binding and 24 reason/action gaps. `git diff --check` passed. No code,
  workflow, migration or test inventory changed, so quick/full/integration gates
  were not required by AGENTS.md.
- One next step is NUT-02: extend the existing candidate/review/apply path so exact
  variant ID and durable source URI/hash survive end to end, using archived product
  `38` / variant `726` as the first bounded compatibility canary and making no
  nutrition catalogue write during that step.
