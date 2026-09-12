# Nutrition Data Enrichment — Execution Plan

**Status date:** 12 September 2026

## Current checkpoint

- Task: NUT-03; status `IN PROGRESS`. NUT-03A and the bounded NUT-03B code step
  are `CODE COMPLETE`; NUT-03C is `LIVE VERIFIED`. The existing
  candidate/review/plan/apply path now models
  creatine as the mass of its declared ingredient form against an exact serving,
  with the same five information states. Migration C is deployed in production;
  no candidate has been stored, reviewed or applied.
- Owner/session: Codex, owner-authorized NUT-03C production migration and
  read-only verification, 12 September 2026.
- Branch: `main`; this session started at
  `9cd8f4bb34dd1792c8dbc2104e6cca3b24c23707`; remote `main` matched before work.
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
- The compatibility correction remains in place for older schemas, but production
  now has the NUT-02A and NUT-02B candidate schema. Product-only records remain
  readable and unchanged; exact-variant operations no longer take the missing-
  migration branch.
- NUT-02B adds caffeine, citrulline amount/form and beta-alanine with five explicit
  information states, exact per-serving source quantities and deterministic g/mg
  normalization. Review approval remains separate from the information state.
  Its deployed migration includes the bounded NUT-02B CHECK correction:
  every recreated fact/unit/review predicate must evaluate `IS TRUE`, so SQL NULL
  cannot satisfy a required condition.
- Scope decision for pre-workouts now also requires creatine for every exact
  variant: presence, declared form and amount against an explicit serving, with
  the same five information states. Existing `creatine_per_serving_g` is a legacy
  positive numeric field without form or information state, so it cannot safely
  hold a declaration such as creatine-monohydrate mass as though it were pure
  creatine mass. NUT-03B extends the existing structured path with the separate
  field `creatine_declared_form_per_serving_mg`; the legacy field and calculations
  remain unchanged.
- The controlled production selector applied exactly
  `20260911120000_add_nutrition_candidate_variant_provenance.sql` and then
  `20260911130000_add_nutrition_candidate_preworkout_facts.sql`. Fresh readback
  verified all 11 columns, eight relevant constraints, three queue triggers and
  both exact migration hashes. The authenticated panel and full new-shape read
  both pass. No candidate, review, approved plan, catalogue fact or source changed.
- NUT-03A used the already-local archived image only; its SHA-256 matched the
  NUT-01 manifest. The single v2 artifact contains four pending candidates:
  serving size, caffeine, beta-alanine and citrulline malate with its declared
  ratio. It also preserves the exact `Creatine Monohydrate | 3 g` row as deferred
  review evidence tied to the same 15 g serving, variant, archive URI and image
  hash; it does not create a `creatine_per_serving_g` candidate. The required
  dry-run reports `DRY_RUN_NO_DATABASE` and four rows.
- One next step, NUT-03D: prepare a new version of the existing product `38` /
  variant `726` artifact with a fifth pending candidate for declared-form
  creatine. Validate it by dry-run only; do not store, approve or apply it.

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
beta-alanine, creatine including declared ingredient form, source and verification
status. Every tracked ingredient uses presence with a known amount, presence with
an undisclosed amount, confirmed absence, no information or conflicting information.
First customer result: verified
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
| Extend, NUT-03B | Legacy `creatine_per_serving_g` carries only a positive number in grams; the structured five-state mechanism originally covered caffeine, citrulline and beta-alanine only. | NUT-03B adds `creatine_declared_form_per_serving_mg` as one more target in the same structured candidate/review/plan/apply path. It preserves declared form and source mass per explicit serving; it never equates creatine-monohydrate mass with pure-creatine mass. Migration C remains pending. |
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
remain identity strings only. No caffeine, stimulant, citrulline,
beta-alanine, creatine, serving or formulation fact is inferred from them.
Source review may later mark
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
| NUT-02A | `LIVE VERIFIED` | NUT-01 | Existing candidate/review/plan/apply path preserves string product/variant IDs, immutable private archive URI and SHA-256; exact variant ownership is checked. The compatibility correction still preserves product-only operations on an older schema and blocks variant operations when A is absent. | Isolated tests prove pre/post-migration behavior. Production now has both provenance columns, its FK/checks and ownership trigger; the full queue read passes. No variant-scoped row was created by rollout. |
| NUT-02B | `LIVE VERIFIED` | NUT-02A | Existing path supports caffeine, beta-alanine and citrulline with L-citrulline/citrulline-malate form and optional declared malate ratio. Each fact preserves one of five information states, its exact serving basis, original source amount/unit and deterministic mg value when quantified. All recreated SQL CHECK predicates are hardened with `IS TRUE`. | Isolated PostgreSQL proves writes and rejection behavior across pre-A, post-A/pre-B and post-B schemas. Production readback proves all nine B columns, five hardened checks and the full new query shape are available. No structured fact row was created. |
| NUT-02C | `LIVE VERIFIED` | NUT-02B + owner authorization | Apply exactly A then B through the existing production selector; verify history, schema, queue and authenticated panel without creating candidates or catalogue facts. | Rehearsal rolled back cleanly; apply committed ledger rows 205/206. Fresh owner readback matched both SQL hashes, 11 columns, eight constraints and three triggers. Legacy queue digests and catalogue counts are unchanged; the panel returns 200 without an unavailable notice. |
| NUT-02 | `LIVE VERIFIED` | NUT-02C | Candidate schema and the guarded exact-variant structured-fact path are deployed. Existing product-only records remain compatible. No pilot ingredient value has been entered or approved, and public filters remain outside this stage. | Production read proves schema and read availability; isolated integration tests prove write guards, review invalidation, idempotency and legacy compatibility. This closure does not claim a production write test or pilot coverage. |
| NUT-03A | `CODE COMPLETE` | NUT-02 | Explicitly transcribe only the archived exact-variant label for product `38` / variant `726` into one offline candidate artifact; validate without database access. | Image hash matches the archive manifest; four supported pending candidates preserve exact source quantities, serving evidence, citrulline form/ratio, variant ID, archive URI and image hash. One deferred review record preserves the exact creatine-monohydrate declaration without putting it in the legacy pure-creatine field. Store dry-run passes with zero database writes. |
| NUT-03B | `CODE COMPLETE` | NUT-03A + owner authorization | The existing structured pre-workout target now includes creatine declared-form mass, explicit form or `creatine_form_not_disclosed`, original quantity/unit, exact serving and all five information states. Existing variant/source/fingerprint and approval controls are reused; legacy `creatine_per_serving_g` remains unchanged. | Unit/static tests and isolated PostgreSQL prove pre-C rejection with the legacy queue readable, post-C state/form/unit/serving validation, NULL-safe CHECKs, evidence-change invalidation, protection from unknown/conflict overwrite and idempotent replay. Migration C is prepared and hash-bound but is not applied to production; no candidate or catalogue data was written. |
| NUT-03C | `LIVE VERIFIED` | NUT-03B + owner authorization | Apply only migration C through the controlled production selector, then read back its history and three updated CHECKs and verify the legacy queue and authenticated panel without creating candidates. | Rehearsal rolled back, then the exact hash-bound migration committed as production ledger entry 207. A fresh read-only connection verified history/hash and all three validated, NULL-safe CHECKs; queue, batch, catalogue and exact product/variant digests stayed unchanged. The authenticated panel returned 200 with its expected sections and no unavailable notice. |
| NUT-03D | `PLANNED` | NUT-03C | Revise only the existing product `38` / variant `726` offline artifact to add a fifth pending structured-creatine candidate from its preserved evidence. | Artifact retains the exact variant, archive URI, image hash, declared form, original quantity/unit and 15 g serving; existing store dry-run passes with zero database writes. |
| NUT-03 | `IN PROGRESS` | NUT-03D | Review pilot evidence, quantities/units and exact applicability; separately approved candidate storage, review and guarded apply | NUT-03A prepares only one local unapproved artifact, NUT-03B adds structured creatine and NUT-03C deploys its schema. Complete only when every in-scope proposal, including creatine, has a decision and separately authorized writes have independent readback and zero-duplicate replay; unresolved facts remain unknown and excluded. |
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

## NUT-02A deployment compatibility correction

11 September 2026, owner-authorized bounded correction before NUT-02B:

- A direct production schema read used
  `supplementscout_production_validator_login` with
  `transaction_read_only=on`. `information_schema` confirmed that
  `nutrition_candidates.product_variant_id` and `source_archive_uri` are both
  absent. The validator was denied access to `supabase_migrations`; this result
  is based on the actual columns and application query, not an inferred migration
  state.
- The deployed NUT-02A query failed with PostgreSQL code `42703`, specifically
  `column nutrition_candidates.product_variant_id does not exist`. The legacy
  service-side SELECT succeeded with 695 candidates: 16 pending, 673 approved
  and 6 rejected. The batch queue read also succeeded with 170 items.
- GitHub reported commit
  `1004cb1456f7b13558959c40d4ebfa3d5957055a` deployed successfully to Vercel
  Production at `2026-09-11T16:55:58Z`. An authenticated read of the deployed
  panel returned HTTP 200 but showed the unavailable notice and no candidate
  sections, confirming the compatibility defect rather than an empty queue.
- The correction recognizes only `42703` or `PGRST204` naming one of the two
  provenance columns. It retries product-only reads and writes using the legacy
  column shape; every other error remains an error. A requested variant review,
  candidate store or controlled apply fails closed with a migration-required
  result. Approval fingerprint and pending-status guards remain unchanged.
- The isolated Docker test exercises legacy queue read and review before the
  migration, proves a variant insert cannot run there, then applies the migration
  locally and rechecks preserved product rows plus exact variant provenance and
  immutability. It passed both alone and inside the aggregate integration run.
  Focused compatibility tests passed 81/81; `npm run verify:full` passed with
  Project Guardian, TypeScript, ESLint, all 252 safe test files, baseline
  migration validation and the production build. Final `npm run verify:quick`
  passed 379/379 tests; `verify:project` and `git diff --check` also passed. No
  production migration or nutrition/catalogue write occurred.
- The aggregate `npm run verify:integration` result remains non-green: its first
  30-file chunk reported 65 passed, 2 failed and 5 skipped. The unrelated Batch F
  disposable PostgreSQL process exceeded its timeout, and the existing Jon's
  final-closeout fixture again failed the 10 Reps v8 anchor precondition. This
  correction does not change or repair either fixture and does not represent the
  aggregate integration suite as passed.
- Commit `c996268f66aa760e53b234e087a927d38a0b45e9` is published on `main`, and
  GitHub's Vercel context completed successfully at `2026-09-11T17:45:32Z`.
  The final read-only production check again found both provenance columns absent,
  695 legacy candidates (16 pending, 673 approved and 6 rejected) and 170 batch
  items. An authenticated request to the deployed panel returned HTTP 200, showed
  the pending-candidate and latest-batch sections, and did not show the unavailable
  notice. NUT-02B has not started; this compatibility prerequisite no longer
  blocks its bounded implementation, while variant operations remain blocked
  until the separately authorized production migration.

## NUT-02B structured pre-workout facts evidence

11 September 2026, owner-authorized bounded implementation session:

- The existing candidate/review/plan/apply path now carries three structured
  exact-variant targets: `caffeine`, `citrulline` and `beta_alanine`. Their
  candidate fields remain `caffeine_per_serving_mg`,
  `citrulline_per_serving_mg` and `beta_alanine_per_serving_mg`; no product
  column or second importer was added.
- Each candidate records one of `present_with_amount`,
  `present_amount_not_disclosed`, `confirmed_absent`, `no_information` or
  `conflicting_information`. This information state is independent of candidate
  review. Confirmed absence remains pending until explicitly approved, while
  empty data, OCR omission and product-name wording never produce zero.
- Quantified candidates retain a positive original amount and `mg`/`g` unit,
  exact `per_serving` basis and human-readable serving evidence. The normalized
  mg value must equal the deterministic conversion. Per-100-g input, missing or
  guessed scoop mass, zero and contradictory numeric/non-numeric combinations
  fail closed.
- Citrulline retains `l_citrulline` versus `citrulline_malate` and an optional
  positive declared malate ratio. Malate mass is never converted into pure
  L-citrulline. Amount, unit, serving, form, ratio and information-state changes
  are immutable candidate evidence and invalidate a prior approval/fingerprint.
- The exact variant, private credential-free archive URI and SHA-256 remain
  mandatory. Structured facts are written atomically only in the selected
  variant's `nutrition_override`. Unknown or conflicting evidence cannot replace
  an existing determinate approved fact. Replay is fingerprint-idempotent.
- Migration `20260911130000_add_nutrition_candidate_preworkout_facts.sql`
  (SHA-256
  `76db080b347dfffd36a8233c1d8f9725421b9caf2e445d56579833898b6428d5`)
  adds only nullable candidate evidence columns and closed SQL constraints; it
  performs no product or variant data mutation. It is registered after the
  pending NUT-02A migration in both environment selectors and was not applied to
  production.
- Compatibility remains three-stage and error-specific: product-only operations
  work before NUT-02A; provenance-aware legacy facts work after A but before B;
  structured facts require B. Only `42703`/`PGRST204` naming an exact missing A
  or B column can select the older shape. Structured facts never lose their
  variant or evidence to obtain a write.
- Focused candidate/store/admin/planner/apply/migration/selector tests passed
  93/93. The isolated Docker integration passed 1/1 and exercised the schema
  before A, after A and after B, including all five states, original quantities,
  units, serving basis, citrulline form/ratio, immutable evidence, invalid
  combinations and duplicate retry.
- `npm run verify:full` passed with Project Guardian, TypeScript, ESLint, all 252
  safe test files, baseline migration validation and the Next.js production
  build. No OCR, source collection, pilot candidate, production migration or
  nutrition/catalogue write occurred; all values used by tests are TEST ONLY.
- Code commit `d2db38f4ee6fb76fbdbd35ffc17ad74fcb8e2897` is published on
  `main`; GitHub's Vercel context completed successfully at
  `2026-09-11T18:37:52Z`. A production validator transaction with
  `transaction_read_only=on` confirmed that both NUT-02A columns and all nine
  NUT-02B columns remain absent. The legacy reads still returned 695 candidates
  (16 pending, 673 approved and 6 rejected) and 170 batch items. The validator
  cannot read `supabase_migrations`, so no migration conclusion is inferred from
  that ledger.
- After deployment, an authenticated read of `/admin/nutrition-candidates`
  returned HTTP 200, rendered the pending-candidate and latest-batch sections and
  did not render the unavailable notice. This confirms the existing product-only
  panel still works on the actual pre-A schema; no review form was submitted and
  no data was written.
- The aggregate `npm run verify:integration` remains explicitly non-green from
  the preceding current checkpoint: its first 30-file chunk reported 65 passed,
  2 failed and 5 skipped because the unrelated Batch F disposable PostgreSQL
  process timed out and the existing Jon's final-closeout fixture failed its
  10 Reps v8 anchor precondition. NUT-02B does not change either fixture and does
  not present the aggregate suite as passed.
- NUT-02 remains `IN PROGRESS`. The remaining completion work is NUT-02C: a
  separately authorized A-then-B production migration rollout followed by
  schema, legacy-panel and exact-variant operation readback. It must not enter
  pilot facts or perform a catalogue apply.

## NUT-02B nullable CHECK correction

11 September 2026, owner-authorized bounded correction before NUT-02C:

- A fresh production-validator transaction ran with `transaction_read_only=on`
  and confirmed the actual production table still lacks both NUT-02A columns and
  all nine NUT-02B columns. Access to `supabase_migrations` remains denied, so the
  decision to amend migration B is based on the real schema plus its exact pending
  registration, not an assumption from the migration file. Existing reads still
  returned 695 candidates and 170 batch items. No migration or data write ran.
- Before editing migration B, direct `psql` inserts against isolated PostgreSQL
  reproduced PostgreSQL three-valued CHECK behavior. Ten invalid rows were
  accepted: quantified facts missing proposed value or unit, source amount or
  serving text; present citrulline without form; a structured field without
  information state; a partial serving-value/unit pair; a legacy field missing
  value or unit; and an approved legacy fact without `approved_value`. A missing
  source unit was rejected only because its separate conversion equality became
  false, not because every required predicate was guaranteed true.
- The pending migration now wraps the full predicates for proposed field, fact
  shape, proposed unit, approved-value positivity and approved-value review state
  in `IS TRUE`. Optional columns remain nullable and valid nonquantified states
  retain their explicit `IS NULL` shape. No global NOT NULL, catalogue DML or
  backfill was added.
- The same direct-SQL regression now rejects all 11 incomplete cases. It also
  creates and approves a valid legacy product candidate after migration B,
  preserving the old path and approved-value default. Existing integration
  assertions continue to prove exact variant ownership, durable source URI,
  source hash, immutable evidence/approval and fingerprint idempotency.
- All existing non-Docker nutrition and migration-selector tests passed 215/215;
  the isolated PostgreSQL regression passed 1/1. `npm run verify:full` passed with
  Project Guardian, TypeScript, ESLint, all 252 safe test files, baseline migration
  validation and the Next.js production build. The previously recorded aggregate
  `verify:integration` remains explicitly non-green because of the unrelated
  Batch F timeout and Jon's 10 Reps v8 fixture; neither was changed.
- Migration readiness remains ordered: apply pending migration A first, then the
  corrected migration B with the SHA-256 above. NUT-02 stays `IN PROGRESS`, and
  NUT-02C still requires separate authorization.
- Correction commit `b8415c7d90f78a5eb1c2cdc7497d29af1cc7e262` is published on
  `main`; GitHub's Vercel context completed successfully at
  `2026-09-11T18:57:26Z`. Final read-only production evidence again found all A/B
  columns absent and the unchanged 695-candidate/170-item legacy queue. The
  authenticated panel returned HTTP 200 with pending-candidate and latest-batch
  sections and no unavailable notice. No review was submitted and no data was
  written.

## NUT-02C production migration and readback evidence

11 September 2026, owner-authorized production rollout:

- A fresh owner read-only selector check bound the target to project
  `aftboxmrdgyhizicfsfu`, environment `PRODUCTION`, database identity
  `supplementscout-production:aftboxmrdgyhizicfsfu` and PostgreSQL owner
  `postgres`. The actual migration ledger had 204 rows with fingerprint
  `95b09e5d09814d048e41b6034272a79ef6cca14f5b2712d15bac69d14852e48f`.
  Its complete pending list was exactly A then B; no other migration was selected.
- Repository and selector hashes matched the authorization: A
  `20260911120000_add_nutrition_candidate_variant_provenance.sql` at
  `62a7a5dd812d4559889d7392217095b67841d1d6db37e5519ee6e1593bc207cb`,
  then B `20260911130000_add_nutrition_candidate_preworkout_facts.sql` at
  `76db080b347dfffd36a8233c1d8f9725421b9caf2e445d56579833898b6428d5`.
  A controlled rehearsal executed them in that order and rolled back with PASS.
- The existing selected-migration executor then committed A followed by B under
  its advisory lock and one transaction. Both history rows were inserted; fresh
  post-commit state had 206 rows and fingerprint
  `532359913006127f8b83c549091f0d95714cd052cafec5f1d366a4bfab0f1e45`.
  A failure in either step would have rolled back the complete transaction; no
  repair or migration outside the authorized pair ran.
- A separate read-only owner connection confirmed all 11 new nullable columns,
  the variant FK, both provenance CHECKs, all five hardened B CHECKs and all three
  active queue triggers. Both history entries stored one statement whose
  normalized SHA-256 matched its repository file exactly. The production selector
  contract is advanced to the verified 206-row ledger and now reports no pending
  production migration; staging remains unchanged.
- The service-role full new-shape SELECT returned all 695 existing candidates and
  no missing-schema fallback. There are zero exact-variant candidates and zero
  structured pre-workout fact candidates, as expected because this rollout did
  not create one. No dry plan was generated: there is no approved new candidate
  to plan, and fabricating one was outside scope.
- The authenticated deployed panel login returned 303 with a session cookie, then
  `/admin/nutrition-candidates` returned 200 with the review heading, pending
  section and latest-batch section. It did not show the unavailable notice. No
  form was submitted.
- Before and after snapshots both contain 695 candidates: 16 pending, 673 approved
  and 6 rejected. Their stable legacy projection SHA-256 is
  `27afe848b8dd1d3f91fc34de7b0ba383d530d31f59a8dbbc70ca0b16c6f7305f`.
  Both snapshots contain 170 batch items with SHA-256
  `433f7bbb457aecbe39dbe7592a0cf8a03c05f1286475757bbbeb2e36146cc848`.
  Products, variants, retailer mappings, offers and price history remained
  `1337/3632/3758/3758/13860` throughout the rehearsal and committed rollout.
- These production checks prove deployed schema, history, permissions and read
  availability. The isolated NUT-02A/B PostgreSQL tests remain the evidence for
  candidate writes, invalid-row rejection, immutable review evidence and replay
  idempotency. No production candidate, review, approved plan, catalogue fact,
  OCR job or source collection was created or run.
- The focused selector/executor regression passed 40/40. `npm run verify:quick`
  passed 379/379 tests, and `npm run verify:full` passed with Project Guardian,
  TypeScript, ESLint, all 252 sealed safe test files, baseline migration
  validation and the 36-page production build. The build's expected isolated
  `127.0.0.1:54321` cache reads were refused without failing the build. Final
  `verify:project` and `git diff --check` also pass. The previously recorded full
  `verify:integration` result remains non-green because of the unrelated Batch F
  timeout and Jon's fixture; this rollout did not rerun or alter those fixtures.
- NUT-02 is closed only for the deployed candidate schema and guarded path. It is
  not a claim of pilot data coverage, approved ingredient values or public filter
  behavior. NUT-03 retains the separate evidence review and production-write gate.

## NUT-03A exact-variant transcription evidence

11 September 2026, owner-authorized bounded preparation:

- Scope remained exactly product `38`, variant `726`, Applied Nutrition Pump 3G
  Pre-Workout, Fruit Burst, 375 g. Repository and ignored-`tmp` searches found no
  prior candidate artifact for variant `726`; the production readback recorded in
  NUT-02C likewise had zero variant-scoped candidates. No existing artifact or
  database row was duplicated.
- The original local image at
  `tmp/nutrition-batch01-owner-handoff-2026-09-11/labels/38-Applied-Pump-3G-375g.jpg`
  was reused. Its SHA-256 is
  `1182c1aeab46a72ff38709e349d692ab18d45355d87549574d30bb04f3067842`,
  exactly matching the owner handoff manifest and archived-object record. No page,
  image or other source was fetched, and no OCR was run.
- Manual visual transcription reads the exact serving declaration as
  `Serving Size: 2 Scoops (15 g) - Servings Per Container: 25`. The per-15-g
  column states `Caffeine | 250 mg`, `Beta-Alanine | 2 g` and
  `Citrulline Malate 2:1 | 5 g`, plus `Creatine Monohydrate | 3 g`. The artifact
  retains those original quantities and units. Its deterministic normalized
  values for the three currently supported structured ingredients are
  respectively 250, 2000 and 5000 mg; it does not convert citrulline-malate mass
  into pure L-citrulline, convert creatine-monohydrate mass into pure creatine or
  treat one serving as one scoop.
- The one ignored artifact is
  `tmp/nutrition-candidates/nut-03a-product-38-variant-726/nutrition-candidates-ncr1-nut03a-38-726-1182c1aeab46.json`,
  SHA-256
  `0e390c0e372f2b4ef7a4dc9ddb89f6eaa30a8d43b394a28d3b772e051295d866`.
  It contains exactly four rows: `serving_size_g`,
  `caffeine_per_serving_mg`, `beta_alanine_per_serving_mg` and
  `citrulline_per_serving_mg`. All use string IDs `38`/`726`, the stable private
  `supabase-storage://nutrition-sources/...` URI, original image SHA-256, exact
  image/table locators, `PENDING` review status and the explicit manual-transcript
  review flag. The same artifact also has exactly one `deferred_review_evidence`
  record for creatine, with `present_with_amount`, form `creatine_monohydrate`,
  source quantity 3 g, explicit 15 g serving, exact label excerpt and locator,
  and `candidate_created: false`. Its `quantity_subject` is the declared form's
  mass and `pure_creatine_equivalent` remains null. The directory still contains
  one artifact file.
- Required validation command
  `npm run nutrition:candidates:store -- --dry-run --input=tmp/nutrition-candidates/nut-03a-product-38-variant-726/nutrition-candidates-ncr1-nut03a-38-726-1182c1aeab46.json`
  passed with mode `DRY_RUN_NO_DATABASE`, destination `nutrition_candidates`,
  four candidate rows, zero product updates and zero verified CSV files. This
  path did not initialize Supabase or perform a database write.
- The image and candidate artifact remain outside Git under ignored `tmp`. No
  parser, OCR service, candidate row, approval, plan or catalogue value was
  created. NUT-03 remains open; NUT-03B requires separate authorization before
  implementation, migration or candidate-table storage.

### Creatine scope decision and minimum path extension

- Every exact pre-workout variant in the pilot must ultimately carry one of five
  creatine information states: `present_with_amount`,
  `present_amount_not_disclosed`, `confirmed_absent`, `no_information` or
  `conflicting_information`. A present fact also preserves the declared form,
  or an explicit undisclosed-form marker when the label names creatine without a
  form; a quantified fact preserves the original amount/unit and explicit serving.
- Existing `creatine_per_serving_g` is already supported across the legacy
  product candidate path, but it is a positive numeric field with unit `g`. It
  has no information-state or ingredient-form semantics. The NUT-02B structured
  state mechanism currently applies only to caffeine, citrulline and beta-alanine.
- The minimum complete change is one additional creatine target in that same
  structured mechanism: extend its field allowlists and SQL CHECKs, allow a
  creatine form such as `creatine_monohydrate` plus an explicit undisclosed-form
  value, reuse the existing source quantity,
  serving, exact-variant, archive URI, hash, fingerprint, review-invalidation and
  guarded plan/apply fields, and write a structured creatine fact into the exact
  variant override. The amount must mean mass of the declared ingredient form;
  any pure-creatine equivalent remains separate and absent unless the source
  explicitly declares it. This requires a forward-only migration plus the
  existing isolated tests; it does not require another importer, queue or panel.

## NUT-03B structured creatine implementation evidence

12 September 2026, owner-authorized bounded implementation:

- The existing structured candidate contract now accepts
  `creatine_declared_form_per_serving_mg`. It uses the same five information
  states as the other pre-workout facts. Present states require a normalized
  declared form such as `creatine_monohydrate`, or the explicit
  `creatine_form_not_disclosed` marker when the source names creatine but omits
  its form. Non-present states carry neither form nor amount.
- A quantified creatine candidate preserves the source quantity and `mg`/`g`
  unit, the exact `per_serving` description and optional numeric serving basis,
  while deterministically normalizing the declared-form mass to mg. Its stored
  structured fact is explicitly marked `amount_subject:
  declared_ingredient_form`. A `3 g Creatine Monohydrate` declaration therefore
  remains 3 g of creatine monohydrate; it is not written to or interpreted as
  the legacy pure-creatine-oriented `creatine_per_serving_g` field.
- Candidate storage, review fingerprinting, planning and guarded apply reuse the
  existing exact string product/variant IDs, durable private archive URI,
  original-image SHA-256 and immutable evidence checks. Quantity, unit, serving,
  form, information-state or evidence changes create a different fingerprint
  and invalidate an earlier approval. Unknown and conflicting facts cannot
  replace an existing determinate approved fact.
- The smallest forward-only migration is
  `20260911150000_add_nutrition_candidate_structured_creatine.sql`, normalized
  SHA-256
  `dc9a411d19cb3547b508744c6dab21fb0df741e30f896cb186de6b38639ce28c`.
  It adds no column and performs no data DML. It only recreates the three existing
  candidate field/fact/unit CHECK constraints to admit the new field. Each whole
  predicate uses `IS TRUE`, so a nullable comparison cannot admit an incomplete
  record. Executed migrations A and B are unchanged.
- The migration selector binds C as the only production-pending nutrition
  migration after deployed A and B. Before C, a creatine store/apply request
  returns a specific NUT-03B migration-required error while the existing queue
  remains readable. Unrelated PostgreSQL errors are not converted to this state.
- Code commit `29479ff880f8b5e05e8718d8e521cb9f60dac54b` is published on
  `origin/main`. GitHub reported the matching Vercel production deployment
  `6405283357` successful at `2026-09-12T03:05:51Z`. An authenticated read after
  that deployment returned HTTP 200 with the review heading, pending section and
  latest-batch section present and no unavailable notice.
- A fresh owner PostgreSQL connection with `transaction_read_only=on` confirmed
  project `aftboxmrdgyhizicfsfu` / `PRODUCTION`: migration C has zero history
  rows and none of the three current field/fact/unit CHECK definitions names the
  structured-creatine field. The existing queue remains readable with 695 rows,
  zero variant-scoped rows and zero structured rows. This is availability and
  schema evidence only; no production write was attempted.
- Focused unit/static validation passed 99/99. The isolated Docker PostgreSQL
  integration passed and proves: the existing path before C; all five states;
  explicit and undisclosed forms; original g/mg quantities and exact serving;
  rejection of incomplete and NULL-shaped records; source/fingerprint approval
  invalidation; protected-fact overwrite blocking; and replay without duplicates.
- `verify:project`, `verify:quick` and `verify:full` pass. The aggregate
  `verify:integration` remains explicitly non-green: its first 30-file chunk
  completed 71/72 tests and stopped on the unrelated existing Jon's/Predators
  Gear fixture at `20260906150000_allow_10reps_v8_short_source_ids.sql` with
  `10 Reps v8 short source ID anchor/state mismatch`. The NUT-03B isolated test
  passed within that same aggregate run. The unrelated fixture was not changed.
- The NUT-03A artifact remains unchanged at
  `tmp/nutrition-candidates/nut-03a-product-38-variant-726/nutrition-candidates-ncr1-nut03a-38-726-1182c1aeab46.json`,
  SHA-256
  `0e390c0e372f2b4ef7a4dc9ddb89f6eaa30a8d43b394a28d3b772e051295d866`.
  Its deferred creatine evidence remains deferred. No source was fetched, no OCR
  ran and no production migration, candidate, approval, plan, apply or catalogue
  write occurred.
- NUT-03B is `CODE COMPLETE`, not production-enabled. One next step is NUT-03C:
  separately authorize migration C alone, deploy it through the existing
  selector and perform read-only production schema, queue and panel checks. Do
  not store the pilot artifact in that migration-only step.

## NUT-03C production migration and readback evidence

12 September 2026, owner-authorized migration-only production rollout:

- The target was project `aftboxmrdgyhizicfsfu`, environment `PRODUCTION`,
  database identity `supplementscout-production:aftboxmrdgyhizicfsfu`. A fresh
  preflight found A and B in production history at their expected normalized
  hashes and C absent. The selector exposed exactly one pending file:
  `20260911150000_add_nutrition_candidate_structured_creatine.sql`, SHA-256
  `dc9a411d19cb3547b508744c6dab21fb0df741e30f896cb186de6b38639ce28c`.
- A controlled rehearsal passed and rolled back with no commit. The separately
  confirmed apply then committed exactly C. The migration ledger advanced from
  206 to 207 rows and its fingerprint became
  `13cd90548a2ee62b5ba065258a48ac123798c41141c1680dd051161fa356791b`.
  No other pending migration was selected.
- A new connection with `default_transaction_read_only=on` found the C history
  row with the exact expected hash. The validated constraints
  `nutrition_candidates_fact_shape_check`,
  `nutrition_candidates_proposed_field_check` and
  `nutrition_candidates_proposed_unit_check` all name
  `creatine_declared_form_per_serving_mg`; every whole predicate requires
  `IS TRUE`. This production read proves schema presence and read availability.
  The isolated NUT-03B PostgreSQL tests remain the evidence for write behavior.
- Before and after snapshots are ignored local evidence at
  `tmp/nut03c-production-pre-2026-09-12.json` and
  `tmp/nut03c-production-post-2026-09-12.json`. The queue remained 695 rows
  (`16` pending, `673` approved, `6` rejected), with zero variant-scoped and zero
  structured rows; its full-row digest remained
  `474e8cc76911eba4c44566cca6c7d7d364a7db648f1ae334285e02ce0b9b3e86`.
  All 170 batch items retained digest
  `be4d10c5bcdf730a2629400f114dbf03533e9e7803e414d26756cab071e9a20e`.
  Catalogue counts remained products `1337`, product variants `3632`, retailer
  products `3758`, offers `3758` and price history `13860`. Exact product `38`
  and variant `726` row digests also remained unchanged.
- The authenticated production panel returned HTTP 200 with its review heading,
  pending section and latest-batch section visible and without the migration-
  unavailable notice. No candidate, approval, test datum, plan, apply, OCR,
  source fetch or catalogue write was performed.
- Focused migration-selector tests passed 35/35. `verify:project`,
  `verify:quick` and `verify:full` passed after the selector and ledger update.
  The aggregate `verify:integration` was not repeated for this contract/evidence
  change; its previously recorded non-green result remains the unrelated Jon's /
  Predators Gear fixture failure, while the isolated NUT-03B PostgreSQL test is
  green.
- The NUT-03A artifact is unchanged at
  `tmp/nutrition-candidates/nut-03a-product-38-variant-726/nutrition-candidates-ncr1-nut03a-38-726-1182c1aeab46.json`,
  SHA-256
  `0e390c0e372f2b4ef7a4dc9ddb89f6eaa30a8d43b394a28d3b772e051295d866`.
  NUT-03 remains `IN PROGRESS`. One next step, NUT-03D, is to prepare a new
  version of that artifact with a fifth pending structured-creatine candidate
  and validate it by dry-run without storing it in the database.

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
