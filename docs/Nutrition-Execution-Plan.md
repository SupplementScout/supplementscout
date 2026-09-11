# Nutrition Data Enrichment — Execution Plan

**Status date:** 11 September 2026

## Current checkpoint

- Task: NUT-00; status `IN PROGRESS`, documentation audit prepared; publication pending.
- Owner/session: Codex, owner-requested NUT-00 session, 11 September 2026.
- Branch: `main`; audited HEAD: `7c553d8be48e19413cb23d9fd55c3b7e7ad982b2`.
- Remote: `git ls-remote origin refs/heads/main` independently matched that HEAD.
- Scope: repository, schemas and existing evidence; documentation only.
- Pre-edit `npm run verify:project`: PASS; 19 SEO tasks, next SEO-15, none in progress.
- Post-edit checks and Git publication evidence: see closeout below.
- Production nutrition/schema readback: not yet verified; local SELECT attempt
  returned `TypeError: fetch failed`. Repository migrations are not live evidence.
- No labels fetched, candidates stored, functions implemented or database writes made.
- Existing untracked `docs/SupplementScout-Nutrition-Plan.txt` is owner material;
  preserved unchanged and excluded from this change's staging.
- One next step: finish NUT-00 checks and publish this bounded documentation change,
  then record its commit and independent remote readback before closing NUT-00.

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

NUT-01 must read the current catalogue, freeze 20–30 exact IDs and denominator,
and include differing flavours/packs and evidence states where available. Names
such as Pump or Zero Caffeine never establish caffeine absence. Do not include
GYM HIGH through this plan or fabricate missing IDs to reach the target count.
Live schema, candidate queue state, current variant IDs and pre-workout coverage
remain unverified until an authenticated read-only readback succeeds. No old
snapshot is substituted for it. This limitation does not prevent documenting NUT-00.

## Stage ledger

Statuses reuse Guardian's vocabulary but are not currently parsed by Guardian.
For documentation-only NUT-00, `CODE COMPLETE` means documentation checked and
committed; `LIVE VERIFIED` means remote repository readback, never feature deployment.
All future stages have no executor assigned and no branch/implementation evidence;
assign these in this ledger when activated. Their dependency is their current gate,
not a newly discovered production blocker. Only NUT-00 is authorized this session.

| ID | Status | Dependency | Closed scope | Completion evidence |
|---|---|---|---|---|
| NUT-00 | `IN PROGRESS` | Owner request | Register stages, inspect existing process/schema/evidence, reuse/gap audit, pilot candidates and links | Consistent committed plan; verify:project PASS before/after; recorded commit and confirmed remote availability; live-data limitations explicit. |
| NUT-01 | `PLANNED` | NUT-00 | Freeze 20–30 existing variants; review exact official URLs and collection permissions; preserve labels privately | Each variant has a readable, correctly bound durable source or explicit missing-source/identity status with reason and action. Record ID, flavour/version, URL, date, hash and archive location; prove retrieval in a new session. Missing entries are not counted as collected labels. |
| NUT-02 | `PLANNED` | NUT-01 | Extend existing candidate/review/apply schema for serving, caffeine, citrulline/form, beta-alanine, variant and provenance/status | Exact applicability survives the full path; ambiguity/conflicts detected; meaningful tests and required quick/full checks pass. Candidates cannot feed public filters. Resolve archive-reference compatibility and confirmed-zero semantics without weakening existing guards. |
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

## NUT-00 closeout evidence

Pending final checks and publication. Do not interpret this draft as NUT-00 closure.
