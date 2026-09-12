# Nutrition Data Enrichment — Execution Plan

**Status date:** 12 September 2026

## Current checkpoint

- Task: NUT-03; status `IN PROGRESS`. NUT-03A, NUT-03B, NUT-03D and NUT-03G are
  `CODE COMPLETE`; NUT-03C, NUT-03E, NUT-03F and NUT-03H are `LIVE VERIFIED`.
  NUT-03I retains its historical exact-variant evidence gap. Further preparation
  now uses one closed batch of at most ten variants per owner decision instead
  of a separate checkpoint for every variant. The existing
  candidate/review/plan/apply path now models
  creatine as the mass of its declared ingredient form against an exact serving,
  with the same five information states. Migration C is deployed in production.
  Exactly five product `38` / variant `726` candidates are stored, approved and
  applied to that exact variant. This completes one of the frozen 25 variants,
  not the full pilot.
- The exact GYM HIGH demonstration exception for product `411` / variant `1047`
  is also `LIVE VERIFIED`: candidates `701`-`705` were stored, reviewed and
  applied through the existing guarded path. This remains outside the frozen
  pilot denominator and does not authorize any other GYM HIGH item.
- Owner/session: Codex, owner-authorized NUT-03 batch preparation, one
  consolidated owner-decision package and store/review/plan/apply for the exact
  GYM HIGH demonstration exception product `411` / variant `1047`,
  12 September 2026.
- Branch: `main`; this session started at
  `52aeb8a8adb99b32c4b5ef22f82eecb667117d1e`; remote `main` matched before work.
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
- NUT-03D preserves the original four-row artifact and adds one new ignored
  five-row version for product `38` / variant `726`. Its fifth pending candidate
  records `3 g` creatine monohydrate as `3000 mg` of the declared monohydrate
  form per `2 Scoops (15 g)`; it does not populate legacy
  `creatine_per_serving_g`. Dry-run reports five rows and zero database writes.
- NUT-03E stored exactly those five candidates in the production private queue
  as IDs `696`-`700`. Each fingerprint occurs once, and the
  product `38` / variant `726` catalogue rows are unchanged.
- NUT-03F matched all five candidates to the preserved label and exact artifact,
  then approved IDs `696`-`700` through the authenticated individual-review path.
  Approved values equal the proposals; source evidence and catalogue rows are
  unchanged.
- NUT-03G prepared that plan with zero blockers, zero product updates and one
  exact variant update. It retains the full existing override, adds only the
  five reviewed facts and records zero database writes.
- NUT-03H applied the exact hash-bound plan to variant `726`. Independent
  readback matched the complete planned after override and found no other data
  change. Exact replay was rejected by the stale-plan guard and a further
  readback proved zero additional writes.
- NUT-03I confirmed current product `744` / variant `815` identity but did not
  find a Fruit Burst-specific back label or an explicit manufacturer statement
  binding the shared nutrition table to that flavour. No artifact or dry-run was
  created and no database write ran.
- NUT-03 Batch 01 now accounts for ten further variants in one package. All ten
  current product/variant pairs and empty overrides were confirmed in production,
  but none has exact-variant label applicability. It contains zero proposals and
  ten actionable source gaps; no candidate artifact or dry-run was fabricated.
- One expressly bounded demonstration exception now covers only GYM HIGH The
  Stinger product `411` / variant `1047`, Electric Red, 425 g. It does not change
  or replace the frozen 25, and it does not release any other GYM HIGH work from
  `owner_deferred`. Fresh read-only catalogue evidence confirmed the exact pair
  and initially zero existing exact-variant candidates. Two owner-supplied images, a
  separately recorded brand-owner attestation and their manifest are preserved
  in the private archive with fresh-process hash readback. The unchanged ignored
  artifact passed `DRY_RUN_NO_DATABASE`; its five unique proposals are now
  production candidates `701`-`705`, approved through the authenticated review
  path and applied only to variant `1047`. Independent readback matches the plan,
  while exact replay fails closed before a second write.
- One next step: obtain one consolidated owner-provided source/permission pack
  for the ten variants in NUT-03 Batch 01, then rerun only that fixed batch using
  newly supplied evidence.

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

The frozen pilot remains exactly 25 variants. The owner has authorized one
additional demonstration exception only for product `411`, variant `1047`, GYM
HIGH The Stinger, Electric Red, 425 g. The initial exception permitted source
archiving, offline candidate preparation and dry-run validation. The subsequent
owner authorization extended only this unchanged, hash-bound set through
store, review, plan and apply. It does not replace a pilot position, enlarge the
pilot denominator, or change the `owner_deferred` status of any other GYM HIGH
work.

## Batched nutrition preparation mode

- Prepare at most ten exact variants in one closed batch. The batch, rather than
  each variant, is the owner-decision and documentation unit. Do not create a
  separate checkpoint for every variant.
- Select only from the frozen 25-variant scope. Preserve completed variant `726`,
  keep variant `815` unresolved, and do not repeat an exhausted search unless a
  new source or specific new lead is supplied.
- A named owner-authorized demonstration outside the frozen scope must remain a
  separate exact-variant package. The only current exception is product `411` /
  variant `1047`; it does not enter a pilot batch or unlock another GYM HIGH item.
- Prefer variants with an existing official source and the fewest unresolved
  identity, package, formulation and access issues. Fix the list before evidence
  work begins; do not substitute easier variants after a gap is found.
- Within one batch, verify current product/variant ownership and existing
  candidates once, then review every variant's retained evidence. Read and
  transcribe a label only when exact-variant applicability is established.
  An unresolved item receives a concrete reason and required evidence and does
  not stop work on the rest of the batch.
- Candidate artifacts remain in ignored `tmp`, use the existing structured
  pre-workout format and must retain string IDs, durable private URI, source hash,
  exact evidence locator, original quantity/unit, exact serving, ingredient form
  and one of the five information states. No exact source binding means no
  candidate row and no invented `no_information` state.
- Run `nutrition:candidates:store --dry-run` once per generated artifact. If the
  whole batch has zero eligible variants, create no candidate artifact and record
  `NOT_RUN_NO_ELIGIBLE_EXACT_VARIANT_ARTIFACT`; a validator cannot legitimize an
  unsupported source binding.
- Publish one owner-decision package separating ready proposals from gaps and
  listing every source, retained hash, artifact hash and validation result.
  Candidate storage, review, plan and apply remain separate owner-authorized
  steps through the existing guarded path.

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
| NUT-03D | `CODE COMPLETE` | NUT-03C | Revise only the existing product `38` / variant `726` offline artifact to add a fifth pending structured-creatine candidate from its preserved evidence. | The previous artifact and hash remain intact. Its new five-row version preserves the first four candidate objects exactly, carries declared-form creatine with exact source/serving evidence, has five unique fingerprints and passes `DRY_RUN_NO_DATABASE` with zero product updates. |
| NUT-03E | `LIVE VERIFIED` | NUT-03D + owner authorization | Store exactly the hash-bound five-candidate NUT-03D artifact in the existing private nutrition queue, without review, approval, planning or apply. | Preflight found zero existing target fingerprints and no same-evidence conflicts. Guarded storage created IDs 696-700; independent readback matched all values and provenance, found each fingerprint exactly once and confirmed every status pending. Queue delta was exactly +5 and exact product/variant digests were unchanged. The authenticated panel shows all five rows. |
| NUT-03F | `LIVE VERIFIED` | NUT-03E + owner review authorization | Review only candidate IDs 696-700 against the hash-bound artifact and preserved exact-variant label, then approve each matching fact without planning or applying it. | Preflight proved five pending exact matches and one row per fingerprint. Authenticated individual review approved all five with their proposed values. Fresh readback found `reviewed_by=admin-panel`, immutable evidence, unchanged exact product/variant digests and all five approved cards in the panel. |
| NUT-03G | `CODE COMPLETE` | NUT-03F + owner authorization | Use the existing planner to prepare a before/after plan only for approved candidate IDs 696-700. Do not execute apply. | Fresh readback matched all five approvals and immutable evidence. The validated plan has zero blockers, zero product updates, one exact variant update and zero writes. It preserves the whole prior override and is bound to the five fingerprints, current empty override, file hash and plan fingerprint. |
| NUT-03H | `LIVE VERIFIED` | NUT-03G + owner apply authorization | Revalidate and apply only the exact hash-bound NUT-03G plan through the existing guarded path. | Preflight matched the production target, empty before override, five approvals and immutable evidence. Transactional apply changed only variant 726's five planned override fields. Fresh readback matched the whole after object and preserved the queue, all products and every other variant. Exact replay failed closed on the stale before-state; another read proved zero additional writes and identical final state. |
| NUT-03I | `BLOCKED` | NUT-03H + owner authorization | Review only product 744 / variant 815, Fruit Burst 375 g, against its preserved label and a bounded official-source read. Prepare an offline candidate artifact only if the table is explicitly bound to that flavour. | The archived image and current official page confirm product, package and the manufacturer's Fruit Burst variant, but the image is flavour-neutral and the page gives no explicit shared-table statement. Exact SKU/GTIN searches found no official Fruit Burst back label. No artifact, dry-run or database write ran. Unblock with a Fruit Burst-specific official back label or an explicit manufacturer statement identifying this table and flavour. |
| NUT-03-BATCH-01 | `AWAITING OWNER EVIDENCE` | NUT-03H + batch authorization | One closed owner-decision package for variants 760, 761, 816, 714, 1029, 1059, 885, 1974, 887 and 3676. Reuse existing source dispositions; do not revisit 815 or substitute variants. | Fresh production read confirms all ten exact ownership pairs, empty overrides and zero exact-variant candidates. Two retained product-label hashes match, but applicability is unproved for three variants; seven have no archived label and retain their access constraints. Package validation passes with 0 ready proposals, 10 explicit gaps, 0 candidate artifacts and no dry-run or write. |
| NUT-03-DEMO-GH-STINGER | `LIVE VERIFIED` | Exact owner demonstration authorization, extended to store/review/plan/apply for the unchanged artifact | Carry one exact-variant package outside the frozen pilot through the existing guarded path for product 411 / variant 1047, Electric Red 425 g. Preserve two supplied images and a separate owner attestation; keep all other GYM HIGH work deferred. | Archive and dry-run evidence remained hash-bound. Production candidates 701-705 each exist once, were approved through authenticated review, and fed one zero-blocker variant-only plan. Controlled apply changed only variant 1047's five nutrition override facts. New read-only connections matched the complete after state, unchanged candidates/product/other variants and protected legacy fields; exact replay was safely rejected by the stale-before guard with no second write. |
| NUT-03 | `IN PROGRESS` | Iterative closed batches + separate owner write authorization | Review pilot evidence, quantities/units and exact applicability in batches of at most ten; separately approve candidate storage, review, planning and guarded apply. | NUT-03A through NUT-03H complete the first exact pilot variant, product 38 / variant 726, through controlled apply. NUT-03I preserves the unresolved 815 evidence gap. Batch 01 adds one consolidated disposition for ten more variants without lowering evidence requirements. The separately authorized Stinger demonstration is also applied but remains outside the denominator. Pilot progress remains 1 of 25 and does not establish full pilot coverage. Complete only when every in-scope proposal has a decision and separately authorized writes have independent readback and safe replay evidence; unresolved facts remain unknown and excluded. |
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

## NUT-03D five-candidate artifact evidence

12 September 2026, owner-authorized offline artifact revision:

- The preserved official image at
  `tmp/nutrition-batch01-owner-handoff-2026-09-11/labels/38-Applied-Pump-3G-375g.jpg`
  still has SHA-256
  `1182c1ab46a72ff38709e349d692ab18d45355d87549574d30bb04f3067842`.
  Direct visual review reconfirmed `Serving Size: 2 Scoops (15 g)` and the
  `Creatine Monohydrate | 3 g` row under `Per (15 g)`. No source was fetched and
  OCR was not run.
- The original four-row artifact remains unchanged at
  `tmp/nutrition-candidates/nut-03a-product-38-variant-726/nutrition-candidates-ncr1-nut03a-38-726-1182c1aeab46.json`,
  SHA-256
  `0e390c0e372f2b4ef7a4dc9ddb89f6eaa30a8d43b394a28d3b772e051295d866`.
- The new artifact is
  `tmp/nutrition-candidates/nut-03a-product-38-variant-726/nutrition-candidates-ncr1-nut03a-38-726-1182c1aeab46-v3.json`,
  SHA-256
  `c6513b6b0bb5cdca3e62388476186c82c976e5f3e0a48b9ea2681fcf579a54a1`,
  artifact fingerprint
  `a86b28e7376daf7da4f6d431bc4e81dd7ef656d7c227ace9d03f23e6b374729c`.
  Its first four candidate objects are byte-equivalent to the original artifact.
- The fifth candidate is `creatine_declared_form_per_serving_mg` with
  `information_state=present_with_amount`, source quantity `3 g`, normalized
  value `3000 mg`, `ingredient_form=creatine_monohydrate`, exact `15 g` serving,
  image evidence locator, string product `38` / variant `726`, durable private
  archive URI and the original image hash. No pure-creatine equivalent is
  calculated, and no `creatine_per_serving_g` candidate exists.
- All five candidates remain `PENDING`; their fingerprints are unique. The
  existing command
  `npm run nutrition:candidates:store -- --dry-run --input=tmp/nutrition-candidates/nut-03a-product-38-variant-726/nutrition-candidates-ncr1-nut03a-38-726-1182c1aeab46-v3.json`
  returned `DRY_RUN_NO_DATABASE`, five candidate rows, zero product updates and
  zero verified CSV files. Neither artifact is committed.
- `verify:project` passed before and after the checkpoint update, and
  `git diff --check` passed. No tracked code, workflow, migration or test changed,
  so the code quality gates were not required for this documentation-only commit.
- NUT-03 remains `IN PROGRESS`. One next step, NUT-03E, requires separate owner
  authorization to store exactly this hash-bound five-candidate set in the
  existing private queue. That step must leave every row pending and must not
  approve, plan or apply any fact.

## NUT-03 GYM HIGH The Stinger demonstration package evidence

12 September 2026, exact owner-authorized exception outside the frozen pilot:

- A fresh production transaction forced read-only against project
  `aftboxmrdgyhizicfsfu` confirmed canonical product ID `411`, product name
  `GYM HIGH The Stinger Zero Caffeine Pump Pre Workout 425g`, and owned variant
  ID `1047`, `Electric Red / 425g`. Both IDs remain strings in the artifact.
  The variant is active with `nutrition_override={}`. The exact pair has zero
  existing nutrition candidates, so no exact-variant artifact or queue row was
  duplicated. Older ignored GYM HIGH product-level artifacts have no variant ID
  and are not reused as exact-variant evidence.
- This is one limited demonstration exception. It does not replace any of the
  frozen 25 variants, alter the 1-of-25 applied count, revisit variant `815`, or
  release another GYM HIGH product from `owner_deferred`.
- The two actual owner-supplied local files were copied byte-for-byte below
  ignored `tmp/nutrition-gym-high-stinger-2026-09-12/source/` without overwrite.
  The Electric Red front image is a 3000 by 2000 PNG, 713038 bytes, SHA-256
  `96e25662a7abd699a8438ba62339841963c8fd2a4cf6247d95f8cf1d96edab8d`.
  It shows the exact flavour, `25` servings, `17G` and `NET WEIGHT 425G`.
  The nutrition-panel photograph is a 4032 by 3024 JPEG, 2890032 bytes,
  SHA-256
  `74685708dc6cc27d8e588ab4cb642e6f7183267747e7831a65e991b407ca4136`.
  It legibly shows `Serving Size:17g (2 scoops)`, `Servings Per Container:25`,
  `BETA ALANINE 3,200 mg` and `L-CITRULLINE (FREE FORM) 3,000 mg`.
- The user's statements in this session are preserved separately as a GYM HIGH
  brand-owner attestation: the supplied table applies to Electric Red 425 g,
  and that formulation contains no caffeine or creatine. The attestation is
  explicitly marked as neither label text nor laboratory evidence. Its SHA-256
  is `2d9ac778aed20531616e72467f05bcfe6c73e5b7335f3c26f39c082ffde7b3f1`.
  The absence candidates rely on this attestation, never on the omission of an
  ingredient row from the photographed table.
- Administrative preflight found the existing `nutrition-sources` bucket private
  and found no object with any of the three source hashes or the manifest hash.
  Four objects were then stored with `upsert:false`: the two originals, the
  attestation and manifest. The manifest SHA-256 is
  `cb1005b7aa2a6db9ac68d2894e65070e9852d570346c6571f579ca064076961f`.
  A separate Node process downloaded all four private objects and matched every
  byte count and SHA-256. This is durable primary source storage, not a backup
  claim. No database table was written.
- The ignored candidate artifact is
  `tmp/nutrition-gym-high-stinger-2026-09-12/candidate-artifact/nutrition-candidates-ncr1-demo-gym-high-411-1047-cb1005b7aa2a-v1.json`,
  SHA-256
  `bef4f35930c644c0df1a651fb4e9d8328428f4f7285cbe3699e25b6140f9ce42`,
  artifact fingerprint
  `a41be3efaa2b83cf3381373563bec2fe2634acc06b7ea52b96b86c9c197a97f6`.
  It contains five unique PENDING fingerprints: serving size `17 g` / two
  scoops, beta-alanine `3200 mg`, free-form L-citrulline `3000 mg`, caffeine
  `confirmed_absent` and declared-form creatine `confirmed_absent`. The two
  absence states carry null amounts and units, not invented zeros.
- Supporting evidence for `25` servings and `425 g` is preserved in the artifact
  and source manifest without creating extra candidates. The owner-decision
  record is
  [owner-decision-package.json](rollouts/nutrition-gym-high-stinger-demo-2026-09-12/owner-decision-package.json),
  SHA-256
  `8f740505e8aed0d1da46c63237ff75cce6862d4d6dd7236e9e4930131f87ee8b`.
- `npm run nutrition:candidates:store -- --dry-run --input=tmp/nutrition-gym-high-stinger-2026-09-12/candidate-artifact/nutrition-candidates-ncr1-demo-gym-high-411-1047-cb1005b7aa2a-v1.json`
  returned `DRY_RUN_NO_DATABASE`, five candidate rows, zero product updates and
  zero verified CSV files. A fresh read-only production connection still found
  zero candidates for product `411` / variant `1047`, unchanged empty override,
  product serving size null and `nutrition_verified=false`.
- The later owner authorization covered store, review, plan and apply for this
  unchanged artifact only. A repeat dry-run again returned five rows and zero
  product updates. The guarded candidate-only store then created exactly IDs
  `701`-`705`; each of their five fingerprints occurs once. A new production
  read found the exact source fields and all five rows pending, with the empty
  variant override and protected catalogue rows unchanged.
- Authenticated individual review approved only IDs `701`-`705` with
  `reviewed_by=admin-panel` and the common hash-bound review note. Candidate
  `701` approved `17 g`; `702` approved `3200 mg` beta-alanine; `703` approved
  `3000 mg` free-form L-citrulline. Candidates `704` and `705` approved the
  `confirmed_absent` states for caffeine and creatine while keeping
  `approved_value`, proposed amount and unit null. The authenticated production
  panel returned HTTP 200 and displayed all five approved records for the exact
  product/variant with no unavailable notice.
- The existing planner selected those five IDs explicitly. Its plan has zero
  blockers, zero product updates and one variant update from `{}`. The ignored
  plan is
  `tmp/nutrition-approved-plan/NCR1-demo-gym-high-411-1047-cb1005b7aa2a-0dd1acfa89b2.json`,
  SHA-256
  `a1eb3c61e64d65d7e4f3092f0067479ee8efa44002359abd07962a7270a8cd16`,
  plan fingerprint
  `0dd1acfa89b2393dea57fcd36cd8e74e1e7666ff44c32a98d604bfd2b644944d`.
  The complete `after` adds only serving size, beta-alanine, L-citrulline,
  caffeine and creatine under variant `1047`'s `nutrition_override`; its evidence
  keeps the label and owner attestation separate.
- Controlled `nutrition:approved-apply` returned
  `APPLIED_REVIEWED_NUTRITION_FIELDS` and changed only variant `1047` in those
  five fields. Its audit SHA-256 is
  `88a0f2f1e5a34de8bbd8bb914b03b1f9dec11c55cc1c51472b7697bc9bea1645`.
  A new production connection forced read-only matched the complete plan
  `after`, SHA-256
  `185c8e4e5dbce7b1eb19a8041d00073457b8aadbd380ddaeba989df326553955`.
  The candidate queue, all products, every other variant, target variant metadata,
  `nutrition_verified=false` and legacy `creatine_per_serving_g=null` retained
  their pre-apply values and digests.
- Exact replay used the same plan and existing apply mechanism. It was safely
  rejected with `Variant 1047 nutrition override changed after plan generation`;
  this is a stale-before-state rejection, not a successful no-op. A further new
  read matched the same complete override and all preservation digests, proving
  no second write. The committed closeout evidence is
  [execution-closeout.json](rollouts/nutrition-gym-high-stinger-demo-2026-09-12/execution-closeout.json),
  SHA-256
  `55b3ee9d825656aa32d5ae4ff4233a7522980d32a9cc09a8a1f67a02c110f6cc`.
- No migration, OCR, source refetch, UI/code change, product update or other
  variant write ran. This completes the separately authorized demonstration
  variant only; frozen-pilot progress remains one completed variant of 25.

## NUT-03 Batch 01 consolidated owner-decision evidence

12 September 2026, first preparation under the batched operating mode:

- The closed list is variants `760`, `761`, `816`, `714`, `1029`, `1059`,
  `885`, `1974`, `887` and `3676`. All are members of the frozen scope and have
  an existing confirmed official-page binding. Completed variant `726` and the
  exhausted unresolved variant `815` are excluded. Variants with an additional
  identity, package or version conflict were deferred in favour of this lower-
  ambiguity set; no substitution occurred after selection.
- One production transaction forced read-only against project
  `aftboxmrdgyhizicfsfu` confirmed all ten exact product/variant ownership pairs,
  current display names and empty `nutrition_override` objects. It found zero
  exact-variant nutrition candidates for the batch and performed zero writes.
  Existing product-only candidate IDs `6` and `14` remain preserved and are not
  treated as evidence for variant `816`.
- Existing repository and ignored-artifact searches found no candidate artifact
  or approved plan for any selected exact variant. The two unique retained image
  files were reused without download or OCR. Their hashes still match the
  archive register: product `481`
  `77e37094d9f5eb4cb2f4b75a4e55d50cf22d6de8ed065d3a4fc8e565ba542513`
  for variants `760`/`761`, and product `744`
  `047bd5c2266f5de4bb9890fcf52279121ed9c15a1dc60f492679de76e473477c`
  for variant `816`. Both labels are readable and establish their product and
  package, but neither names a flavour or states common-table applicability.
- Variants `714`, `1029`, `1059`, `885`, `1974`, `887` and `3676` retain their
  confirmed official-page bindings but have no archived label. The Optimum
  Nutrition, BioTech USA and 10X sources retain their recorded written-permission
  requirements. Bulk `3676` retains the earlier HTTP 403 and unresolved private-
  retention terms. No request was repeated and no protection was bypassed.
- No selected variant therefore meets the exact-label threshold. The batch has
  zero evidence-backed proposals and ten concrete gaps. No numeric value, serving,
  ingredient form or information state was copied from a product-level label.
  In particular, absence of an exact source does not become `no_information` or
  `confirmed_absent`; those are candidate fact states only after exact evidence
  is bound.
- Because there is no eligible exact-variant candidate artifact,
  `nutrition:candidates:store --dry-run` is
  `NOT_RUN_NO_ELIGIBLE_EXACT_VARIANT_ARTIFACT`. Creating an empty or unsupported
  artifact solely to invoke the validator would lower the source-binding guard.
- The single owner package is
  [batch-01-owner-decision.json](rollouts/nutrition-pre-workout-batches-2026-09-12/batch-01-owner-decision.json),
  SHA-256
  `1a958f04ed3a469cd533bf232b0460c716292d51e2c563ff95f2c309ecbb9025`.
  Its structural validation passed: 10 unique string IDs, 10/10 frozen-scope
  membership and official source bindings, exclusion of `726`/`815`, two verified
  retained-image hashes, 0 proposals, 10 actionable gaps, 0 candidate artifacts
  and 0 dry-runs.
- No source page or image fetch, OCR, migration, candidate storage, review, plan,
  apply or catalogue update ran. This package is a preparation decision, not a
  production nutrition-data change and not additional pilot coverage.
- One next step is one consolidated owner-provided evidence pack for any of these
  ten variants: flavour-specific official back labels or explicit common-table
  statements, plus written download/private-storage permission where the existing
  register requires it. Re-run this same closed list once using only new evidence;
  do not repeat the prior searches.

## NUT-03I exact-variant applicability evidence

12 September 2026, owner-authorized bounded review of product `744`, variant
`815`, Applied Nutrition Pump 3G Zero Stim, Fruit Burst, 375 g:

- The frozen scope and fresh production read agree on string product ID `744`
  and variant ID `815`. Production project `aftboxmrdgyhizicfsfu` returned product
  `Applied Nutrition Pump 3G Zero Stim 375g` and its owned variant
  `Fruit Burst / 375g` through a transaction forced read-only. The variant's
  `nutrition_override` remains `{}` and the read performed zero writes.
- No ignored candidate artifact or approved plan names variant `815`. Production
  has no variant-scoped candidate for it. Existing candidate IDs `6` and `14`
  belong to product `744` only, have no variant ID or archive URI and concern
  `serving_count_verified`; they were preserved and are not evidence for this
  exact variant or this structured-fact task.
- The existing local image remains
  `tmp/nutrition-batch01-owner-handoff-2026-09-11/labels/744-Applied-Pump-3G-Zero-Stim-375g.jpg`.
  It decodes at 2000 by 2000 pixels and matches its handoff and private-archive
  SHA-256
  `047bd5c2266f5de4bb9890fcf52279121ed9c15a1dc60f492679de76e473477c`.
  Its stable private URI is
  `supabase-storage://nutrition-sources/labels/nut-01/batch-01/applied-nutrition/744/047bd5c2266f5de4bb9890fcf52279121ed9c15a1dc60f492679de76e473477c/744-Applied-Pump-3G-Zero-Stim-375g.jpg`.
  The image visibly identifies Pump 3G Zero-Stim, caffeine-free positioning and
  375 g, but it names no flavour.
- A bounded live read of the existing official URL
  `https://appliednutrition.uk/products/pump-3g-zero-stimulant-375g` and its
  public Shopify product JSON returned HTTP 200. The current manufacturer record
  identifies Fruit Burst as Shopify variant `39338227531943`, SKU `P3GFBZERO`
  and GTIN `5056555204986`, with a flavour-specific front image. The page also
  lists a Fruit Burst ingredient list and a single product-level Nutritional
  Information image: the same flavour-neutral archived image above. The page
  does not state that this numeric table applies to Fruit Burst or every flavour.
- The live HTML response observed during the bounded read had SHA-256
  `f687e24e8a4c8b45a5dadf0e73148ecc712870d761773abae56ca7e0e6a61ef2`;
  the public product JSON had SHA-256
  `f80632c2cca04abc65967bbe7ad22c8330032a3ed04b0ca591ac320f95976e85`.
  These transient response hashes document what was inspected; they do not
  replace the retained source-image hash or create a new archive object.
- Exact official-domain searches for the SKU, GTIN and Fruit Burst label returned
  only the same product page or its localized forms. They found no official
  Fruit Burst back-label image and no explicit common-table statement. The
  flavour option, front image, ingredient list and the words Zero Stim or
  Caffeine Free establish neither the flavour-specific numeric table nor a
  confirmed zero for any tracked fact.
- Applicability decision:
  `UNKNOWN_SHARED_TABLE_ACROSS_FLAVOURS`. The evidence required to unblock it is
  either an official Fruit Burst 375 g back label visibly tied to SKU
  `P3GFBZERO` / GTIN `5056555204986`, or an explicit Applied Nutrition statement
  identifying this archived table and Fruit Burst as covered. No value from
  product `38` / variant `726` was reused.
- Because exact applicability was not established, no five-candidate artifact
  was created and `nutrition:candidates:store --dry-run` was not run against a
  fabricated input. No candidate, review, plan, apply, migration, OCR, source
  archive write or catalogue write ran.
- No panel check was needed or performed in NUT-03I. A public HTTP redirect to
  `/admin/login` confirms only route reachability; it is not evidence that the
  nutrition panel works in an authenticated active session. Earlier ledger
  entries that say the authenticated panel returned HTTP 200 retain their
  separate session-backed evidence.
- `verify:project` passed before this ledger update. Only the canonical ledger
  and Operating Plan change; the post-update project and diff checks are recorded
  with the published commit. NUT-03 remains `IN PROGRESS`, with 1 of 25 frozen
  variants applied and variant `815` still unresolved.

## NUT-03H controlled apply evidence

12 September 2026, owner-authorized apply of the exact NUT-03G plan:

- The authorized file remained
  `tmp/nutrition-approved-plan/NCR1-nut03a-38-726-1182c1aeab46-e51e5d869191.json`,
  SHA-256
  `124880966f5cf83c05fcd425f581996244f2cd7177bb6bfdf79bb59d8b33cb7a`,
  plan fingerprint
  `e51e5d86919184e6863a1f004e4c6cd7d6b28b9db894cdecd3fa73c27ded318d`.
  Local validation again found only source candidate IDs `696`-`700`, zero
  product updates and one product `38` / variant `726` update.
- A fresh read-only connection resolved to production project
  `aftboxmrdgyhizicfsfu` and classified the target `READY_FOR_APPLY` rather than
  already applied or drifted. The whole before override was `{}` with digest
  `44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a`.
  All five candidates remained approved with their planned values, fingerprints,
  archive URI, image SHA-256, original quantities/units, serving text, forms and
  citrulline ratio.
- The existing `nutrition:approved-apply` command used only that plan and
  `--confirm-reviewed-nutrition-update=true`. It returned
  `APPLIED_REVIEWED_NUTRITION_FIELDS`, no changed products and one changed
  variant: `726`, fields `beta_alanine`, `caffeine`, `citrulline`,
  `serving_size_g` and `creatine`. No manual SQL or substitute update ran.
- The immutable local audit is
  `tmp/nutrition-approved-plan/NCR1-nut03a-38-726-1182c1aeab46-e51e5d869191-audit.json`,
  SHA-256
  `08c7a97f942ad950c1dbf7abe5467c2af8baf37f4c29137ac3ae1d6a5a76e184`.
  It binds the applied timestamp, plan fingerprint, five candidate fingerprints,
  exact product/variant, image hash and private source URI.
- An independent new read-only connection classified the result
  `ALREADY_APPLIED_EXACTLY`. The complete override matched the plan after object
  with digest
  `70f0d5e160bcf578856fe5c3eeabc4876f3fc0ca987eae2404906cee8088be1c`:
  beta-alanine `2000 mg`, caffeine `250 mg`, citrulline-malate mass `5000 mg`
  with ratio `2:1`, serving size `15 g`, and creatine-monohydrate declared-form
  mass `3000 mg`, all against `Serving Size: 2 Scoops (15 g)` where applicable.
- Before/after comparison kept the full candidate-queue digest
  `30ab9473205716c3fbc1b8a29bce9433cd7eb992cb8d1468388d7136ed73cbee`,
  full products digest
  `54ca4527908c69a05a19affcb7ad12a99613054de5058797f599c29e265e2392`,
  all-other-variants digest
  `8350973f56782c6e83a3704906f3875d742cec832715dcd1b13b34e5e8f011ba`,
  exact product `38` digest and target variant non-override metadata digest
  unchanged. Counts remained 700 candidates, 1,337 products and 3,631 other
  variants. The five candidates remained approved and their evidence unchanged.
  Neither `nutrition_verified` nor legacy `creatine_per_serving_g` appears in the
  resulting override.
- Replaying the exact command did not report a successful no-op. The unchanged
  stale-state guard rejected it with
  `Variant 726 nutrition override changed after plan generation`, because the
  current state now equals the plan after rather than its original before.
  A third new read-only connection matched every postflight digest and the exact
  after override, proving the rejected replay made zero additional writes. The
  guard was not weakened.
- `verify:project` passed before the ledger update. No tracked code, migration,
  workflow or test changes in NUT-03H, so code quality gates are not required.
  The post-update project and diff checks are recorded with the published commit.
- NUT-03 remains `IN PROGRESS`. This is the first completed exact variant out of
  the frozen 25, not full pilot coverage. One next step, NUT-03I, requires a
  separate bounded authorization for one next exact-variant source/applicability
  disposition before any further write.

## NUT-03G bounded before/after plan evidence

12 September 2026, owner-authorized plan-only preparation for IDs `696`-`700`:

- No existing file below `tmp/nutrition-approved-plan` selected exactly these
  five candidate IDs. Fresh production readback from project
  `aftboxmrdgyhizicfsfu` found each fingerprint exactly once, with all five rows
  still approved and their `approved_value`, exact product `38` / variant `726`,
  source URI, image SHA-256, quantities, units, serving, forms and ratio unchanged.
  Product and variant digests matched the NUT-03F postflight values.
- The first existing-planner attempt failed closed before writing a plan because
  its variant loader selected nonexistent production column
  `product_variants.name`. The canonical schema uses `display_name`. The same
  loader now selects `display_name`, uses it only for the descriptive plan label,
  and has a focused regression test. No planner or apply scope was widened.
- The existing command used run
  `NCR1-nut03a-38-726-1182c1aeab46` and the explicit list
  `--candidate-ids=696,697,698,699,700`. It returned
  `DRY_RUN_NO_DATABASE_WRITE`, `READY_FOR_EXPLICIT_APPLY`, five approved
  candidates, zero exclusions, zero blockers, zero product updates, one variant
  update and zero database writes.
- Plan file:
  `tmp/nutrition-approved-plan/NCR1-nut03a-38-726-1182c1aeab46-e51e5d869191.json`.
  Its SHA-256 is
  `124880966f5cf83c05fcd425f581996244f2cd7177bb6bfdf79bb59d8b33cb7a`;
  its apply-bound plan fingerprint is
  `e51e5d86919184e6863a1f004e4c6cd7d6b28b9db894cdecd3fa73c27ded318d`.
  The plan stays in ignored `tmp` and is not committed.
- The sole target is `product_variants.nutrition_override` for string product
  `38` / variant `726`, display name `Fruit Burst / 375g`. The actual before
  override is `{}`. The after override adds only `serving_size_g=15` and
  structured `beta_alanine`, `caffeine`, `citrulline` and `creatine` objects.
  Every amount has information state `present_with_amount`, exact original
  quantity/unit and `Serving Size: 2 Scoops (15 g)` basis. Citrulline remains
  `5000 mg` of `citrulline_malate` with ratio `2:1`; creatine remains `3000 mg`
  of `creatine_monohydrate` with
  `amount_subject=declared_ingredient_form`.
- Every planned change retains its candidate fingerprint, private archive URI,
  image hash, evidence snippet and locator, `LOW` confidence,
  `owner_corrected=false` and warning
  `OWNER_TRANSCRIBED_OFFICIAL_LABEL_REQUIRES_REVIEW`. These are preserved source
  metadata, not additional proposed catalogue changes. The plan does not add
  `nutrition_verified`, does not touch legacy `creatine_per_serving_g`, and does
  not convert compound mass to pure L-citrulline or pure creatine.
- Local plan validation passed. The focused nutrition planner suite passed 35/35;
  `verify:quick` and `verify:full` passed. A fresh post-plan production read found
  the same 700 queue rows, candidate state, product digest and variant digest,
  proving plan generation made no production database write.
- NUT-03 remains `IN PROGRESS`. One next step, NUT-03H, requires separate owner
  approval of this exact file SHA-256 and plan fingerprint before controlled
  apply. Any current-state drift must block that later apply.

## NUT-03F production review evidence

12 September 2026, owner-authorized review of candidate IDs `696`-`700`:

- The target resolved to production project `aftboxmrdgyhizicfsfu`. The local
  artifact SHA-256 remained
  `c6513b6b0bb5cdca3e62388476186c82c976e5f3e0a48b9ea2681fcf579a54a1`,
  its artifact fingerprint remained
  `a86b28e7376daf7da4f6d431bc4e81dd7ef656d7c227ace9d03f23e6b374729c`,
  and the preserved image SHA-256 remained
  `1182c1aeab46a72ff38709e349d692ab18d45355d87549574d30bb04f3067842`.
  Visual inspection confirmed `Serving Size: 2 Scoops (15 g)` and the exact
  label rows: beta-alanine `2 g`, caffeine `250 mg`, citrulline malate `2:1`
  `5 g`, and creatine monohydrate `3 g`, all in the `Per (15 g)` column.
- Read-only preflight found IDs `696`-`700` pending, owned by string product
  `38` / variant `726`, with exactly one row per fingerprint. Every database
  value matched the artifact: ID `696` beta-alanine `2 g` / `2000 mg`; ID `697`
  caffeine `250 mg`; ID `698` citrulline-malate mass `5 g` / `5000 mg`, form
  `citrulline_malate`, ratio `2:1`; ID `699` serving size `15 g`; and ID `700`
  creatine-monohydrate mass `3 g` / `3000 mg`, form
  `creatine_monohydrate`. No pure L-citrulline or pure-creatine conversion was
  made.
- The review used the existing authenticated individual route because the
  existing bulk route excludes structured pre-workout fields. All five guarded
  requests returned HTTP 303. The route set `reviewed_by=admin-panel`; no
  alternate user identity was supplied. It stored each exact proposed amount as
  `approved_value` and a note binding the decision to the preserved image hash.
- A new process read all five as approved: ID/value pairs `696/2000`, `697/250`,
  `698/5000`, `699/15` and `700/3000`. Each has a valid `reviewed_at`, the
  expected approved value and `reviewed_by=admin-panel`. The private archive
  URI, original image hash, original quantities and units, serving evidence,
  form, ratio, evidence locators and fingerprints still match the artifact.
- Queue totals remain 700. The review changed pending from 21 to 16 and approved
  from 673 to 678; rejected remains 6. Product `38` digest remains
  `ba2c45634c302cb8eb3f403a64ffc3ea12355d09606c35757ae8c2478e1add04`
  and variant `726` digest remains
  `3aeb701ea750531434beb01c3320699f324a47e69cc6e17a7993b13e71fe1101`.
  No product or variant fact changed.
- Authenticated panel readback returned HTTP 200, showed the exact target and
  run in the approved section, displayed all five fields with their evidence
  locators, and showed no pending review button for this filtered set.
- `verify:project` passed before and after this ledger update, and
  `git diff --check` passed. Only documentation changed in Git, so the code and
  workflow quality gates were not required.
- No plan, apply, migration, OCR, source fetch or catalogue write ran. NUT-03
  remains `IN PROGRESS`. One next step, NUT-03G, is a separately authorized
  before/after plan for only these five approved candidates, with no apply.

## NUT-03E production candidate-storage evidence

12 September 2026, owner-authorized five-row queue write:

- The target resolved through existing server credentials to production project
  `aftboxmrdgyhizicfsfu`. Preflight revalidated artifact SHA-256
  `c6513b6b0bb5cdca3e62388476186c82c976e5f3e0a48b9ea2681fcf579a54a1`,
  artifact fingerprint
  `a86b28e7376daf7da4f6d431bc4e81dd7ef656d7c227ace9d03f23e6b374729c`,
  five unique candidate fingerprints and variant `726` ownership by product
  `38`. The artifact was not changed.
- A production read before storage found zero of the five fingerprints and no
  different fingerprint for the same source image and target fields. The queue
  contained 695 rows: 16 pending, 673 approved and 6 rejected. Product `38` had
  digest `ba2c45634c302cb8eb3f403a64ffc3ea12355d09606c35757ae8c2478e1add04`;
  variant `726` had digest
  `3aeb701ea750531434beb01c3320699f324a47e69cc6e17a7993b13e71fe1101`.
- The required dry-run returned `DRY_RUN_NO_DATABASE`, five candidate rows and
  zero product updates. The existing guarded command then used
  `--store-candidates --confirm-candidate-table-only=true` with the exact
  hash-bound artifact and reported `CANDIDATE_TABLE_WRITE_ONLY`, five rows and
  zero product updates.
- A new read connection found exactly one row per artifact fingerprint. Five
  rows were new and zero were pre-existing: ID `696` beta-alanine `2000 mg`, ID
  `697` caffeine `250 mg`, ID `698` citrulline malate `5000 mg` with ratio `2:1`,
  ID `699` serving size `15 g`, and ID `700` creatine monohydrate `3000 mg`.
  All five have status `pending`, string product `38` / variant `726`, original
  source quantities and units, the exact serving evidence, private archive URI,
  image SHA-256 and artifact candidate fingerprint. No mismatch or conflict was
  found.
- The queue became exactly 700 rows: 21 pending, 673 approved and 6 rejected.
  The product and variant digests remained byte-stable at their pre-write values,
  confirming no catalogue-row change. No candidate was approved or rejected;
  no migration, plan, apply, OCR or source fetch ran.
- Authenticated panel readback returned HTTP 200 without an unavailable notice.
  The product `38` / variant `726` group, run ID, all five database IDs, fields
  and fingerprints were present in their corresponding candidate cards.
- `verify:project` passed before and after the ledger update, and
  `git diff --check` passed. No tracked code, workflow, migration or test changed,
  so quick/full/integration gates were not required for this evidence-only commit.
- NUT-03 remains `IN PROGRESS`. One next step, NUT-03F, requires separate owner
  review authorization for exactly IDs `696`-`700`. Review decisions remain
  separate from any later plan or apply.

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
