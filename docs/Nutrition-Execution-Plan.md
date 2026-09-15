# Nutrition Data Enrichment — Execution Plan

**Status date:** 14 September 2026

## Current checkpoint

- Task: NUT-03 remains `IN PROGRESS`; the bounded early NUT-04A presentation
  step is `LIVE VERIFIED`. NUT-03A, NUT-03B, NUT-03D and NUT-03G are
  `CODE COMPLETE`; NUT-03C, NUT-03E, NUT-03F and NUT-03H are `LIVE VERIFIED`.
  The bounded multi-component citrulline extension is `LIVE VERIFIED`: commit
  `e013facbc3bf708b810a6442e2604deb9c423cb7` is deployed from `main`, and its
  single forward-only migration is applied. The owner-authorized 18-candidate
  package is now `LIVE VERIFIED`: candidates `1019`-`1036` were stored and
  approved, and one guarded plan added only two separately declared citrulline
  components to each of nine exact variant overrides. Independent production
  and public readbacks pass.
  NUT-03I retains its historical exact-variant evidence gap. Further preparation
  now uses one closed organizational package of at most 50 exact variants per
  owner decision instead of a separate checkpoint for every variant. Existing
  collector, file, artifact, request and transaction limits remain binding, so
  one organizational package may contain several controlled technical batches.
  The existing
  candidate/review/plan/apply path now models
  creatine as the mass of its declared ingredient form against an exact serving,
  with the same five information states. Migration C is deployed in production.
  The frozen pilot has twelve completed exact variants: `726`, `760`, `761`,
  `815`, `816`, `1383`, `1384`, `1016`, `1864`, `3676`, `3759` and `3763`.
  This is 12 of 25, not the full pilot.
- Catalogue expansion batch 01 is a separate frozen denominator of 44 exact
  variants across five product families. Sixteen Applied Nutrition variants are
  `LIVE VERIFIED`: 80 candidates were stored, reviewed and applied through three
  guarded variant-only plans. The 28 PER4M variants remain unresolved because the
  current manufacturer terms require express written permission and prohibit
  spider/crawl/scrape. They were not collected or written.
- Catalogue expansion batch 02 is `LIVE VERIFIED` for 15 exact variants across
  products `215` and `957`. Candidates `816`-`890` were stored and approved, and
  two guarded plans applied only the five facts to the 15 exact variant overrides.
  Two of these variants (`1016`, `1864`) also advance the frozen pilot; they are
  counted once in the combined total. Four later 315 g flavours (`1672`-`1675`)
  retain their exact-version gap and were excluded. Across the pilot, Stinger and
  the first two catalogue batches there were 39 distinct applied variants.
- Catalogue expansion batch 03 is now `LIVE VERIFIED` for ten Strom variants
  (`1323`-`1330`, `1332`, `1333`). Candidates `891`-`940` were stored and
  approved through authenticated review. Five zero-blocker plans applied only
  the five approved facts to ten exact variant overrides, with zero product
  updates. Independent and replay readbacks passed, as did all ten public exact-
  variant pages. Variant `1331` and nine Warrior variants retain their recorded
  source/collector gaps. The distinct applied total is now 49.
- Catalogue expansion batch 04 is `LIVE VERIFIED` for six exact variants across
  products `528` and `1248`. Candidates `941`-`970` were stored and approved,
  and two guarded plans applied only the five approved facts to six exact variant
  overrides, with zero product updates. Four Nutrend variants retain creatine as
  `no_information`; two PhD variants have all four tracked ingredient states
  resolved. The distinct applied total is now 55.
- Catalogue expansion batch 05 is `LIVE VERIFIED` for 12 exact variants across
  products `1247`, `1250`, `1254` and `1279`. Candidates `971`-`1015`
  were stored and approved through authenticated review. Four zero-blocker,
  zero-product-update plans applied only the supported facts to the 12 exact
  variant overrides. Independent and replay readbacks passed, as did all 12
  public exact-variant pages and the caffeine-free grouping check. Every target
  retains its recorded unsupported fields rather than fabricated candidates.
  The distinct applied total is now 67.
- Catalogue expansion batch 06 is `LIVE VERIFIED` for the one supported partial
  variant in its closed 50-variant scope. Candidates `1016`-`1018` were stored
  and approved through authenticated review. One zero-blocker, zero-product-
  update plan applied serving 25 g, caffeine `confirmed_absent` and 6000 mg
  free-form L-citrulline only to product `1283` / variant `3763`. Independent
  readback, stale-plan replay protection, its exact public page and the grouped
  caffeine-free result all pass. Beta-alanine and creatine remain unresolved;
  the other 49 scoped variants retain their recorded access or version gaps.
- Catalogue expansion batch 07 is `LIVE VERIFIED` for its two prepared partial
  variants: product `1282`, variants `3762` and `3870`. Candidates `1113`-`1120`
  were stored and approved; one zero-product-update plan applied only serving
  13 g, caffeine 150 mg, beta-alanine 1600 mg and free-form L-citrulline 4000 mg
  to both exact overrides. Creatine remains unresolved. Independent and public
  readbacks and stale-plan replay protection pass. The other 48 scoped variants
  retain their recorded terms or written-permission blocks.
- The separate missing-ingredient completion package is `LIVE VERIFIED` for ten
  facts across six already-counted variants. Candidates `1144`-`1153` were
  stored and approved, and three guarded plans added only the authorized
  `confirmed_absent` beta-alanine and/or creatine facts to product `1247`
  variants `3669`, `3714`, `3715`, product `1282` variants `3762`, `3870`, and
  product `1283` variant `3763`. All six are now complete. The distinct applied
  total remains 89; current-offer coverage is 404 variants: 81 complete, zero
  partial and 323 without applied facts. The frozen pilot is 12 complete, zero
  partial and 13 without applied facts.
- The 14 September owner-image handoff is `LIVE VERIFIED`. Its
  ZIP SHA-256 and all 25 source-file hashes passed; 24 source images are unique
  and one HR Labs Defib image is duplicated byte-for-byte. The closed package
  stored and approved 199 unique facts for 47 current-offer variants across seven
  families. Twenty-three variants resolve all four tracked ingredients and 24
  remain partial. Seven guarded plans changed only the 47 exact
  `nutrition_override` objects; independent readback and seven stale-before
  replay checks pass. All 47 public variant pages show their exact applied facts
  and only caffeine-free variant `3524` qualifies among this package. The
  distinct applied total is 136; current-offer coverage is 404 variants: 104
  complete, 24 partial and 276 without applied facts. Eight other families
  retain explicit gaps. Sources remain private and raw images remain outside
  Git. See `docs/rollouts/nutrition-owner-images-batch-execution-2026-09-14.json`.
- Retailer-source batch 01 is `LIVE VERIFIED` for 19 partial exact variants
  across products `778`, `763` and `903`. Candidates `1037`-`1112` were stored
  and approved through authenticated review. Three zero-product-update plans
  applied only serving, caffeine, beta-alanine and cytrulline to the listed exact
  overrides. Creatine remains unresolved. Independent and public readbacks and
  three stale-plan replay checks pass. The 29 explicit access, version, pack or
  flavour-context gaps remain unchanged.
- The exact GYM HIGH demonstration exception for product `411` / variant `1047`
  is also `LIVE VERIFIED`: candidates `701`-`705` were stored, reviewed and
  applied through the existing guarded path. Its bounded exception now also
  permits NUT-04A to present those applied facts publicly. This remains outside
  the frozen pilot denominator and does not authorize any other GYM HIGH item.
- Owner/session: Codex, owner-authorized NUT-03 preparation and controlled
  execution in organizational packages of at most 50 exact variants. The frozen
  pilot remains 11 complete, one partial (`3763`) and 13 without applied facts.
  The separately completed GYM HIGH demonstration remains outside that
  denominator. Retailer-source batch 01 and Batch 07 added 21 partial exact
  variants without double counting, bringing the distinct applied total to 89.
- Available-catalogue checkpoint at `2026-09-13T15:57:50.729Z`: 404 active
  exact Pre Workout variants have an in-stock offer checked within 24 hours.
  Of these, 56 have complete applied facts, 25 are partial and 323 have no
  applied facts. This current-offer denominator is tracked separately from the
  frozen pilot and the 89 applied variants across all offer states.
- Branch: `main`; the component implementation was fast-forwarded from
  `codex/nut-citrulline-components` at full commit
  `e013facbc3bf708b810a6442e2604deb9c423cb7`. Vercel production deployment
  `6421420844` completed successfully for that exact SHA.
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
- The collector still made no request. All seven archived label bindings retain
  their original NUT-01 disposition. The later owner-approved common-table rule
  supersedes the former applicability gaps for `760`, `761`, `815`, `816`,
  `1383` and `1384`; their exact reassessments and controlled execution evidence
  are recorded below. This preserves the historical NUT-01 finding without
  treating it as the current state.
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
- The owner source-policy decision of 12 September 2026 supersedes the earlier
  exact-flavour-back-label requirement for Applied Nutrition variants `760`,
  `761`, `815` and `816`. A fresh bounded reassessment establishes one common
  manufacturer table for the listed flavours of each matching product page,
  with stable selected-flavour context, version, GB market and serving basis.
  The resulting ignored artifact contains 20 pending offline candidates and 20
  unique fingerprints; `nutrition:candidates:store --dry-run` reports 20 rows,
  zero product updates and zero database writes. NUT-03I's former block and the
  matching three Batch 01 gaps remain in history as superseded decisions.
- The owner-authorized Applied Nutrition execution is now `LIVE VERIFIED` for
  product `481` variants `760`/`761` and product `744` variants `815`/`816`.
  Store created candidates `706`-`725`; authenticated individual review approved
  all 20. The hash-bound zero-blocker plan changed zero products and only the four
  exact `nutrition_override` rows. Independent production readback matches every
  planned `after`, preserves protected catalogue fields and finds one record per
  fingerprint. Exact replay was safely rejected on stale `before` state with zero
  additional writes. Frozen-pilot completion is now 5 of 25; the Stinger
  demonstration remains one separate completed variant outside that denominator.
- The new 20-variant remaining-pilot package confirmed every current ownership
  pair, empty override and zero existing exact-variant candidates in a fresh
  read-only production connection. It reused all earlier source decisions and
  made only three bounded official-page requests for product `881`; no exhausted
  search or blocked source was retried. The preserved 375 g ABE label and stable
  selected-flavour context now qualify as one common manufacturer table for
  variants `1383` and `1384`. Its ignored artifact has 10 unique fingerprints and
  a passing `DRY_RUN_NO_DATABASE`. The subsequently authorized controlled path
  stored them as candidates `726`-`735`, approved them, and applied only the two
  exact variant overrides. The other 18 variants retain explicit permission,
  access, identity, package, version or official-source gaps and were not audited
  again.
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
- One next step: one owner decision on controlled store -> authenticated review
  -> explicit-ID plan -> apply for exactly the 76 candidates of retailer-source
  batch 01. That decision would cover only its 19 listed variants; creatine, its
  29 blocked variants and the separate eight-candidate Batch 07 package remain
  outside it. NUT-03 remains `IN PROGRESS`; 68 distinct variants still have
  applied facts because this preparation made no nutrition-data write.

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
store, review, plan and apply. NUT-04A adds public presentation of the applied
facts for this exact variant only. It does not replace a pilot position, enlarge
the pilot denominator, or change the `owner_deferred` status of any other GYM
HIGH work.

## Batched nutrition preparation mode

The official manufacturer product page is the primary source for declared
composition. Record the basis as `wspólna tabela producenta dla wariantów
produktu` when the page presents the target flavours under the same product,
keeps one common table after each flavour selection, and matches the product
version, market and serving basis without a flavour-specific table, tracked-fact
difference or formulation warning. Preserve the URL, check date, selected-flavour
context and retained table hash. One archived object may support several exact
variants without copying identical bytes. A common table must not be described
as a back-label image for a particular flavour. A declared `caffeine free` claim
may support `confirmed_absent`; an omitted ingredient cannot. Known formulation,
market, serving or tracked-fact differences remain unresolved. This policy
supersedes the earlier blanket requirement for a flavour-specific back label,
while the earlier findings remain recorded as historical decisions.

- Prepare at most 50 exact variants in one closed organizational package. The
  package, rather than each variant or technical sub-batch, is the owner-decision
  and documentation unit. Do not create a separate checkpoint for every variant.
  Split requests, downloads, candidate artifacts and later transactions as
  required by their existing limits; the 10-URL collector limit and 100-row
  candidate-artifact limit are unchanged.
- Select only from the frozen 25-variant scope. Preserve completed variants
  `726`, `760`, `761`, `815` and `816`, keep the separate Stinger demonstration
  outside the denominator, and do not repeat an exhausted search unless a new
  source or specific new lead is supplied.
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
| NUT-03I | `SUPERSEDED` | Owner source-policy decision of 12 September 2026 | Historical bounded review of product 744 / variant 815, Fruit Burst 375 g. | The original review correctly found no flavour-specific back label or explicit manufacturer statement and made no artifact or write. The later owner-approved common-table rule and reassessment now supply the required official product-page context; see `NUT-03-APPLIED-REASSESSMENT`. History is retained rather than rewritten. |
| NUT-03-BATCH-01 | `PARTIALLY SUPERSEDED; AWAITING OWNER EVIDENCE` | NUT-03H + batch authorization | Historical closed batch for variants 760, 761, 816, 714, 1029, 1059, 885, 1974, 887 and 3676. | The common-table reassessment supersedes the applicability gaps for `760`, `761` and `816`. The seven remaining variants still have no qualifying archived source and retain their recorded access/evidence constraints. No substitution or repeat audit occurred. |
| NUT-03-APPLIED-REASSESSMENT | `LIVE VERIFIED` | Owner source-policy decision plus explicit store/review/plan/apply authorization of 12 September 2026 | Reassess and then carry only Applied Nutrition product `481` variants `760`/`761` and product `744` variants `815`/`816` through the guarded path. | The 20-row artifact and common-table context passed hash and duplicate checks. Candidates `706`-`725` each exist once and are approved. The plan SHA-256 `88c45c6f3afad3f2878ffc4b2ec7809af037acccdff39584a3f6f65c595145ec` has fingerprint `0179395d4f7ec10a0efb0795a23dce460e7630adefe21e480f0b3228f61a5484`, zero product updates and four exact variant updates. Controlled apply and independent readback match all four `after` objects; stale-plan replay fails closed with no second write. Public exact-variant pages show the facts, and the caffeine-free search groups the four qualifying variants into two product cards. See `docs/rollouts/nutrition-applied-shared-table-execution-2026-09-12.json`. |
| NUT-03-APPLIED-881 | `LIVE VERIFIED` | Owner authorization of the unchanged 10-candidate artifact for product `881` | Carry only variants `1383` Baddy Berry and `1384` Bubblegum Crush through store/review/plan/apply using their retained shared manufacturer table and exact selected-flavour context. | Candidates `726`-`735` each exist once and are approved. Plan SHA-256 `3f19a7146db2bd9182316319b5bb4a09ac7c16947ac13727d2dcccf627d49ef6`, fingerprint `b1f666d6cf3ec7e726e80dbd6fd4986041720fee29cfac88848fb4734b1e53aa`, has zero product updates and two exact variant updates. Controlled apply and fresh readback match both complete `after` objects; stale-before replay is safely rejected with no second write. Both public exact-variant pages show the five facts and neither caffeinated variant appears in the caffeine-free filter. See `docs/rollouts/nutrition-applied-881-execution-2026-09-12.json`. |
| NUT-03-DEMO-GH-STINGER | `LIVE VERIFIED` | Exact owner demonstration authorization, extended to store/review/plan/apply for the unchanged artifact | Carry one exact-variant package outside the frozen pilot through the existing guarded path for product 411 / variant 1047, Electric Red 425 g. Preserve two supplied images and a separate owner attestation; keep all other GYM HIGH work deferred. | Archive and dry-run evidence remained hash-bound. Production candidates 701-705 each exist once, were approved through authenticated review, and fed one zero-blocker variant-only plan. Controlled apply changed only variant 1047's five nutrition override facts. New read-only connections matched the complete after state, unchanged candidates/product/other variants and protected legacy fields; exact replay was safely rejected by the stale-before guard with no second write. |
| NUT-03-CATALOG-BATCH-01 | `LIVE VERIFIED` | NUT-03 deployed path + catalogue-expansion preparation and exact owner execution authorization | Freeze and prepare at most 50 exact variants as one owner package, then execute only the unchanged approved subset through existing technical store/review/plan/apply batches while retaining access gates. | Separate denominator: 44 assessed variants. Candidates `736`-`815` are 80 unique, approved rows. Three zero-product-update plans applied the five facts only to variants `727`, `728`, `762`, `763`, `3603` and `1385`-`1395`. Independent readback matched all 16 complete `after` objects and preserved all records outside scope; three stale-before replays failed closed. All 16 public exact-variant pages pass, and caffeine-free search groups eligible product 481 variants in one card while excluding caffeinated products 38 and 881. The 28 PER4M variants remain blocked and untouched. See `docs/rollouts/nutrition-catalog-expansion-batch-01-execution-2026-09-12.json`. |
| NUT-03-CATALOG-BATCH-02 | `LIVE VERIFIED` | NUT-03 deployed path + preparation and exact owner execution authorization | Carry only the unchanged 75-candidate ready subset through existing store/review/plan/apply controls for product `215` variants `1016`, `1663`-`1671`, `1676`, `2019` and product `957` variants `1864`-`1866`. | Candidates `816`-`890` each exist once and are approved. Two zero-product-update plans applied the five facts only to 15 exact overrides. Independent and replay readbacks preserve the full catalogue outside scope. All 15 public pages pass and neither caffeinated family appears in the caffeine-free filter. Product `215` variants `1672`-`1675` remain unresolved and untouched. See `docs/rollouts/nutrition-catalog-expansion-batch-02-execution-2026-09-13.json`. |
| NUT-03-CATALOG-BATCH-03 | `LIVE VERIFIED` | NUT-03 deployed path + preparation and exact owner execution authorization | Prepare one closed package of at most 50 next incomplete exact variants, then carry only its unchanged ready subset through existing store/review/plan/apply controls. | Candidates `891`-`940` each exist once and are approved. Five zero-product-update plans applied the facts only to variants `1323`-`1330`, `1332`, `1333`. Independent readback matched all ten complete `after` objects, and five stale-before replays failed closed. All ten public pages pass; no Batch 03 variant enters the caffeine-free filter. Variant `1331` and nine Warrior variants remain unresolved and untouched. See `docs/rollouts/nutrition-catalog-expansion-batch-03-execution-2026-09-13.json`. |
| NUT-03-CATALOG-BATCH-04 | `LIVE VERIFIED` | NUT-03 deployed path + preparation and exact owner execution authorization | Carry only the unchanged 30-candidate ready subset through existing controls for product `528` variants `976`, `977`, `1847`, `1848` and product `1248` variants `3670`, `3716`. | Candidates `941`-`970` each exist once and are approved. Two zero-product-update plans applied only six exact overrides. Independent and replay readbacks and all six public pages passed. Two PhD variants resolve all four ingredients; four Nutrend variants retain creatine as `no_information`. See `docs/rollouts/nutrition-catalog-expansion-batch-04-execution-2026-09-13.json`. |
| NUT-03-CATALOG-BATCH-05 | `LIVE VERIFIED` | NUT-03 deployed path + preparation and exact owner execution authorization | Carry only the unchanged 45 supported candidates for product `1247` variants `3669`, `3714`, `3715`; product `1250` variants `3672`, `3721`, `3722`; product `1254` variants `3676`, `3725`, `3726`; and product `1279` variants `3759`, `3894`, `3895`. | Candidates `971`-`1015` each exist once and are approved. Four zero-blocker, zero-product-update plans changed only the 12 exact overrides. Independent readback matched every complete `after`, and four stale-before replays failed closed. All 12 public pages pass; only the confirmed caffeine-free family qualifies for one grouped filter card. Unsupported facts remain omitted. See `docs/rollouts/nutrition-catalog-expansion-batch-05-execution-2026-09-13.json`. |
| NUT-03-CATALOG-BATCH-06 | `LIVE VERIFIED` | NUT-03 deployed path + preparation and exact owner execution authorization | Carry only the unchanged three-candidate supported subset through existing controls for product `1283` / variant `3763`; leave beta-alanine, creatine and the 49 recorded blockers untouched. | Candidates `1016`-`1018` each exist once and are approved. One zero-blocker, zero-product-update plan applied only serving size, caffeine and L-citrulline to exact variant `3763`. Independent readback matched the whole `after`; exact replay failed closed with no second write. The public exact-variant page and caffeine-free filter pass. See `docs/rollouts/nutrition-catalog-expansion-batch-06-execution-2026-09-13.json`. |
| NUT-03-CATALOG-BATCH-07 | `LIVE VERIFIED` | NUT-03 deployed path + exact owner execution authorization | Carry only the unchanged eight-candidate partial subset for product `1282`, variants `3762` and `3870`, through store/review/plan/apply; keep creatine and all 48 blocked variants outside execution. | Candidates `1113`-`1120` each exist once and are approved. One zero-product-update plan applied four supported facts to both exact overrides. Independent whole-override readback, stale-before replay protection and both public pages pass; creatine remains unresolved. See `docs/rollouts/nutrition-retailer-and-batch-07-execution-2026-09-13.json`. |
| NUT-03-RETAILER-SOURCE-BATCH-01 | `LIVE VERIFIED` | Retailer-source preparation + exact owner execution authorization | Carry only the unchanged 76-candidate subset for products `778`, `763` and `903` through existing controls; retain real retailer provenance and leave creatine plus all 29 blockers outside execution. | Candidates `1037`-`1112` each exist once and are approved. Three zero-product-update plans applied only four supported facts to 19 exact overrides. Independent readback, three stale-before replays and all 19 public pages pass; retailer sources are labelled accurately and all caffeinated targets remain outside the caffeine-free filter. See `docs/rollouts/nutrition-retailer-and-batch-07-execution-2026-09-13.json`. |
| NUT-03-CITRULLINE-COMPONENTS | `LIVE VERIFIED` | Batch 06 design + owner deployment, migration and exact data-write authorization | Preserve separately declared citrulline forms through the existing guarded path without summing them as pure L-citrulline. | Commit `e013facbc3bf708b810a6442e2604deb9c423cb7` and migration `20260913110000` are live. Candidates `1019`-`1036` each exist once and are approved. Plan `45f8c3ae...` added only `citrulline_components` to nine exact overrides. Independent readback matched the whole `after`, all nine public pages show two components, and the caffeine-free grouping still passes. See `docs/rollouts/nutrition-citrulline-components-execution-2026-09-13.json`. |
| NUT-03 | `IN PROGRESS` | Organizational packages up to 50 exact variants + separate owner write authorization | Review pilot evidence, quantities/units and exact applicability in one owner-decision package while retaining existing technical sub-batch limits; separately approve candidate storage, review, planning and guarded apply. | Pilot progress remains 11 complete, one partial (`3763`) and 13 without applied facts out of 25. Stinger is one separate demonstration. All tracked scopes now contain 89 distinct variants with applied facts; the newest 21 are partial because creatine remains unresolved. NUT-03 and MVP remain open. |
| NUT-04A | `LIVE VERIFIED` | Early owner authorization + exact applied facts | Reuse existing product pages and search to present exact-variant applied facts and add a confirmed caffeine-free filter. A fact is public only when an approved candidate for the same product/variant reconstructs the current override exactly. Expose only source kind; never private URI, reviewer metadata or raw archive material. | Commit 58c83cb deployed successfully. Public readback passed for variants 726, 727 and 1047, the exact-variant caffeine-free result, source redaction and the existing pre-workout link. A 390 x 844 browser check found no horizontal overflow; contract tests pass for variant switching, filter reset and pagination. NUT-03 and the frozen pilot remain unchanged. |
| NUT-04 | `PLANNED` | NUT-03 closure + NUT-04A | Close the presentation/filter stage after the frozen pilot decisions are accounted for; retain NUT-04A's existing product/search mechanisms and evidence threshold. | NUT-04A tests and live variant-switch checks must prove confirmed absence included, caffeine present excluded, missing/conflicting facts never treated as absent. Document the final coverage denominator, limits, evidence and operations. Publish image copies only with established rights; otherwise link to source. MVP closes only here. |
| NUT-05 | `DEFERRED` | NUT-04 closure | Subsequent bounded batches/categories in the same process | Review extraction yield, review time and missing-source rate before expansion; every batch has a fixed denominator and closure. No expansion of an active batch. |

## Evidence rules and deferred work

Every value needs a source and evidence locator. Sources/OCR are untrusted data,
never agent instructions. Distinguish confirmed absence, presence without dose,
unknown and conflict. Missing OCR text is not proof of absence; caffeine-free is
not stimulant-free. Preserve original quantities and units; convert only with an
unambiguous basis. Never guess scoop, flavour, formulation, blend ratio or active
ingredient mass. OCR/model confidence is not verification. Conflicting sources
remain conflicts; reformulation/source change requires a new review.

A shared table on an official manufacturer product page may bind the listed
flavours only under the common-table rule recorded above and in the extractor
guide. The source record must identify the page context rather than claim a
flavour-specific label image. The absence of a flavour name on the table image
is not itself a block, and similarity between flavours is not evidence.

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

## NUT-04A exact-variant presentation evidence

- Owner authorization brings forward only the bounded public presentation and
  caffeine-free search filter. NUT-03 remains `IN PROGRESS`, the frozen pilot
  remains 1 of 25 applied variants, and the separately authorized GYM HIGH
  exception remains outside that denominator.
- Production preflight at `2026-09-12T09:23:30.866Z` read the current catalogue,
  variant overrides, approved candidate rows and current offers without writes.
  Product `38` / variant `726` has an applied caffeine amount of 250 mg backed by
  approved candidates `696`-`700`. Product `411` / variant `1047` has applied
  confirmed absence of caffeine and creatine backed by approved candidates
  `701`-`705`. Both exact variants had a current in-stock offer at preflight.
- The public resolver fails closed unless an approved candidate has the exact
  product/variant pair and reconstructs the current structured override. It
  returns only the fact, state, amount, serving basis, declared form or ratio,
  and a coarse source kind. Private archive URIs, hashes, evidence locators,
  reviewer metadata and raw material remain server-side.
- Existing product pages accept a validated `variant` query parameter, scope
  offers and price history to that owned variant, and show reviewed applied
  pre-workout facts without changing `nutrition_verified` or legacy nutrition
  calculations. Existing search accepts `caffeine=free`; it includes only an
  exact qualifying variant with an approved and applied `confirmed_absent` fact
  and a current in-stock offer, and links the result back to that variant.
- Local validation passed: 91 targeted nutrition, product, search and mobile
  contract tests; `verify:quick` with 380 tests; `verify:full`, including the
  production Next.js build; and `verify:project` before and after the roadmap
  update. No migration, candidate write, catalogue write, new public route,
  panel, importer or AI path was added. Live deployment evidence is recorded
  separately in `docs/rollouts/nutrition-nut-04a-presentation-2026-09-12.json`.
- Commit `58c83cbe73e71de24da08f4778fe179293ea28b6` deployed successfully
  through Vercel at `2026-09-12T09:40:01Z`. Fresh public HTTP 200 reads show
  variant `726` with its 250 mg caffeine fact and declared compound masses,
  variant `727` without inherited facts, variant `1047` with the two confirmed
  absences and sanitized source kinds, and the caffeine-free search returning
  one result linked to exact variant `1047` while excluding `726`. A 390 x 844
  browser check found no horizontal overflow on the product or search view.
  Existing contract tests cover flavour/variant switching, reset and pagination.

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

## NUT-03 Applied Nutrition shared-table reassessment

12 September 2026, owner-authorized source-policy revision and bounded
reassessment:

- The official manufacturer product page is now the primary declaration source
  under the common-table rule. This replaces the former requirement for a
  flavour-specific back label for Applied Nutrition variants `760`, `761`, `815`
  and `816`; the original NUT-01, NUT-03I and Batch 01 findings remain in this
  ledger and the rollout record as superseded historical decisions.
- Fresh selected-flavour checks used only the two retained official Applied
  Nutrition product pages. Product `481` variants Blue Razz `760` and Red
  Hawaiian `761` retained the same product, 500 g version, GB market, serving
  choices and single nutrition image. Product `744` variants Fruit Burst `815`
  and Icy Blue Razz `816` retained the same product, 375 g version, GB market,
  15 g serving and single nutrition image. The pages exposed no alternative
  nutrition table or tracked-active amount after flavour selection.
- The applicability basis for all four records is `wspólna tabela producenta dla
  wariantów produktu`. It is product-page context, not a claim that the retained
  flavour-neutral image is a back label for a particular flavour. The detailed
  context record preserves official and selected-flavour URLs, check timestamps,
  page hashes and market/serving observations.
- Product `481` uses the retained ABE Pump Zero-Stim image SHA-256
  `77e37094d9f5eb4cb2f4b75a4e55d50cf22d6de8ed065d3a4fc8e565ba542513`.
  The proposal selects the full `2 Scoops (25 g)` column and retains the label's
  alternative `1 Scoop (12.5 g)` declaration in evidence. Each of variants
  `760` and `761` proposes serving 25 g, caffeine `confirmed_absent`, beta-alanine
  3000 mg, citrulline malate 2:1 at 10000 mg of malate and creatine monohydrate
  3000 mg of monohydrate.
- Product `744` uses the retained Pump 3G Zero-Stim image SHA-256
  `047bd5c2266f5de4bb9890fcf52279121ed9c15a1dc60f492679de76e473477c`.
  Each of variants `815` and `816` proposes serving `2 Scoops (15 g)`, caffeine
  `confirmed_absent`, beta-alanine 2000 mg from source `2 g`, citrulline malate
  2:1 at 5000 mg of malate from source `5 g`, and creatine monohydrate 3000 mg of
  monohydrate from source `3 g`. No compound mass is converted to pure
  L-citrulline or pure creatine.
- Fresh read-only production evidence at `2026-09-12T17:14:34.127Z` confirms all
  four string product/variant pairs, active catalogue rows, empty exact-variant
  overrides and zero existing exact-variant candidates. It performed zero writes.
- The ignored context manifest is
  `tmp/nutrition-applied-shared-table-2026-09-12/source-context-manifest.json`,
  SHA-256 `c64e0f9753585113f4be4f7e2ab7faf65b3a68454f5ac3834a6197ebcd988c20`.
  The ignored candidate artifact is
  `tmp/nutrition-applied-shared-table-2026-09-12/candidate-artifact/nutrition-candidates-ncr1-applied-shared-table-481-744-20260912.json`,
  SHA-256 `312c4c8094be99d880c867bf85be9bb588179e4d0589addb540072878e694e30`,
  artifact fingerprint
  `fd9418bf6dfde2b9edb51c9a92056a91e76a1feaf61e28dbe8f175adcc4831d9`.
  It contains 20 pending offline candidates and 20 unique fingerprints.
- `npm run nutrition:candidates:store -- --dry-run --input=<artifact>` passed as
  `DRY_RUN_NO_DATABASE`: 20 candidate rows, zero product updates and zero database
  writes. No candidate was stored, reviewed, planned or applied.
- The committed machine-readable owner-decision package is
  [nutrition-applied-shared-table-reassessment-2026-09-12.json](rollouts/nutrition-applied-shared-table-reassessment-2026-09-12.json).
  One next step is an owner decision on storage of that exact 20-candidate,
  hash-bound artifact. Review and apply require their existing controlled stages.

## NUT-03 Applied Nutrition controlled execution

12 September 2026, explicit owner authorization for the unchanged 20-candidate
set through store, review, plan and apply:

- Production preflight identified project `aftboxmrdgyhizicfsfu`, confirmed all
  four exact active product/variant pairs, empty `nutrition_override` objects,
  zero matching candidates and queue counts 683 approved, 16 pending and 6
  rejected. Artifact SHA-256
  `312c4c8094be99d880c867bf85be9bb588179e4d0589addb540072878e694e30`,
  artifact fingerprint
  `fd9418bf6dfde2b9edb51c9a92056a91e76a1feaf61e28dbe8f175adcc4831d9`
  and all 20 unique candidate fingerprints matched the authorization.
- The two original images were already retained and were not copied again. The
  missing selected-flavour page-context manifest passed a private-bucket duplicate
  scan, then one hash-addressed object was stored with `upsert: false`. A fresh
  process downloaded all 6320 bytes and reproduced SHA-256
  `c64e0f9753585113f4be4f7e2ab7faf65b3a68454f5ac3834a6197ebcd988c20`.
- Guarded candidate storage created IDs `706`-`725`, exactly one per fingerprint,
  with zero product updates. Post-store readback found all 20 pending and the
  queue delta was exactly +20 pending. Authenticated individual review then
  approved only those IDs with matching proposed values and `reviewed_by=admin-panel`.
  The caffeine rows retain null numeric values and the specific manufacturer
  caffeine-free declaration; all review notes retain the common-table basis and
  context-manifest hash.
- The existing planner selected those 20 IDs explicitly and produced
  `tmp/nutrition-approved-plan/NCR1-applied-shared-table-481-744-20260912-0179395d4f7e.json`.
  Plan SHA-256 is
  `88c45c6f3afad3f2878ffc4b2ec7809af037acccdff39584a3f6f65c595145ec`;
  plan fingerprint is
  `0179395d4f7ec10a0efb0795a23dce460e7630adefe21e480f0b3228f61a5484`.
  It has zero blockers, zero product updates, four exact variant updates and
  empty `before` overrides. Each `after` has only serving size, caffeine,
  beta-alanine, citrulline and creatine plus the required source-unit, serving,
  form and compound-mass metadata.
- Controlled transactional apply changed variants `760`, `761`, `815` and `816`
  only. Its audit SHA-256 is
  `4c2c04e405c77871640aa41c7611617e805ad92d007a607119576785fbecd548`.
  A new forced-read-only PostgreSQL connection matched all four complete planned
  `after` objects and preserved the product table, every other variant, target
  variant metadata, non-target candidate queue, `nutrition_verified` and legacy
  `creatine_per_serving_g`. Queue counts settled at 703 approved, 16 pending and
  6 rejected.
- Exact plan replay exited with the stale-before guard at variant `760` rather
  than performing a no-op. A subsequent new read reproduced the complete applied
  state, candidate and preservation digests, proving zero additional writes.
- Fresh public requests used `Cache-Control: no-cache` and received
  `private, no-cache, no-store, max-age=0, must-revalidate`. All four exact-variant
  product pages return HTTP 200 and display the five applied facts with sanitized
  source kinds and no private URI, hash or reviewer metadata. Every target variant
  had current in-stock offers. The caffeine-free search therefore includes both
  Applied Nutrition products but groups their four qualifying variants into two
  cards, currently linked to variants `815` and `760`; the separate Stinger
  demonstration remains a third card. A fresh authenticated panel read returned
  HTTP 200, the approved section, both products, all four variants and all five
  field types without the unavailable-schema notice. The existing approved card
  does not render database candidate IDs; IDs `706`-`725` were instead confirmed
  by the independent production readback.
- The machine-readable closeout is
  [nutrition-applied-shared-table-execution-2026-09-12.json](rollouts/nutrition-applied-shared-table-execution-2026-09-12.json).
  Frozen-pilot applied coverage is now 5/25. The completed Stinger demonstration
  remains one separate case outside the denominator. NUT-03 remains
  `IN PROGRESS`; one next step is the seven unchanged Batch 01 source gaps.

## NUT-03 complete remaining-pilot preparation package

12 September 2026, owner-authorized preparation of all 20 unfinished frozen
pilot variants under the revised organizational batch limit:

- The organizational owner-decision limit is now 50 exact variants. This changes
  documentation and decision packaging only. The collector remains limited to
  10 URLs per technical batch, candidate artifacts remain limited to 100 rows
  and 10 MB, and later guarded writes retain their existing transaction limits
  and separate authorization. No new roadmap stage, importer, parser, panel or
  automation path was created.
- A new forced-read-only production connection confirmed the exact frozen-scope
  ownership of all 20 remaining variants, active canonical rows, empty
  `nutrition_override` objects and zero existing exact-variant candidates. The
  five completed pilot variants `726`, `760`, `761`, `815` and `816` and the
  separate Stinger demonstration `1047` were excluded from processing.
- Prior source and access decisions were reused. Sources requiring written
  permission, returning HTTP 403, or carrying unresolved version, package,
  identity or official-source gaps were not searched again. Only product `881`
  received new context reads: one product JSON request and two selected-flavour
  page requests, all within the existing technical limit. No image was downloaded.
- The official product `881` page identifies the current 375 g / 30-serving item
  as both ABE All Black Everything and ABE Ultimate Pre-Workout, lists Baddy Berry
  and Bubblegum Crush, and serves the same single nutrition-table image for both
  selected-flavour URLs. The page discloses its flavour-specific Breathe Easy
  addition only for Candy Ice Blast, not either target flavour. Together with the
  retained image, this qualifies as one `wspólna tabela producenta dla wariantów
  produktu` for exact variants `1383` and `1384`.
- The retained image SHA-256 is
  `02987e5bfa5716453ea9ef6cb2db8af5582adc005ab0664ab9aef0a2efaeac87`.
  It was not copied again. The new context manifest SHA-256 is
  `fc086ee4e321b109e421a92148c0ef01cb74f028fd0c694c30fccad6aa3a4cbf`;
  a duplicate precheck found no copy, one hash-addressed private object was stored
  with `upsert: false`, and a fresh download reproduced all 3726 bytes and the
  same hash.
- Each of variants `1383` and `1384` has five pending proposals against
  `1 Scoop (12.5 g)`: serving size 12.5 g, caffeine 200 mg, beta-alanine 2000 mg
  from source 2 g, citrulline malate 2:1 at 4000 mg of declared malate mass from
  source 4 g, and creatine monohydrate at 3000 mg of declared monohydrate mass
  from source 3 g. No compound mass is converted to pure L-citrulline or pure
  creatine.
- The ignored artifact is
  `tmp/nutrition-pilot-remaining-2026-09-12/candidate-artifact/nutrition-candidates-ncr1-remaining-pilot-applied-881-20260912.json`.
  Its SHA-256 is
  `d127d1be12e3977d74363e54e79e2a83c23de810f388824b399910138bfaf243`;
  artifact fingerprint is
  `c9e47b1251d808596bbd2202fbdd668c5881804cb23eb268cf532257c7573c49`.
  It contains 10 pending candidates and 10 unique fingerprints. The existing
  `nutrition:candidates:store --dry-run` passed with 10 rows, zero product updates
  and zero database writes.
- Eighteen variants remain unresolved: six require written collection permission
  (`714`, `1029`, `1059`, `885`, `1974`, `887`); two retain HTTP 403 plus terms
  clarification (`3676`, `3759`); and ten retain exact version, package, identity
  or official-source gaps (`1007`, `1016`, `1041`, `1487`, `1864`, `1879`,
  `3671`, `3674`, `3755`, `3763`). Each concrete reason and required evidence is
  carried forward in the machine-readable package; none is converted into an
  ingredient absence or fabricated candidate.
- The complete owner-decision package is
  [nutrition-remaining-pilot-preparation-2026-09-12.json](rollouts/nutrition-remaining-pilot-preparation-2026-09-12.json).
  Its proposed product `881` write has now been executed as recorded below. The
  18 gaps remain outside the completed write scope.

## NUT-03 Applied Nutrition product 881 controlled execution

12 September 2026, owner-authorized store, review, plan and apply of the unchanged
10-candidate artifact for product `881`, variants `1383` and `1384`:

- Fresh production preflight confirmed project `aftboxmrdgyhizicfsfu`, both exact
  active variant bindings, empty starting overrides and zero existing candidates
  for the ten artifact fingerprints. A forced fresh read of the private archive
  reproduced the retained label SHA-256
  `02987e5bfa5716453ea9ef6cb2db8af5582adc005ab0664ab9aef0a2efaeac87`
  and context-manifest SHA-256
  `fc086ee4e321b109e421a92148c0ef01cb74f028fd0c694c30fccad6aa3a4cbf`.
  Neither object was copied again.
- The shared-table basis remains `wspolna tabela producenta dla wariantow
  produktu`: the current official 375 g / 30-serving page uses All Black
  Everything as its title and ABE Ultimate in product information, lists both
  selected flavours, and presents the same table and serving basis for them.
  Candy Ice Blast and every other flavour remain outside this execution.
- The existing store path created candidates `726`-`735`, exactly once per
  fingerprint and initially pending. Authenticated individual review approved all
  ten with matching `approved_value`, exact variant, retained URI and label hash,
  source units, serving basis, forms, ratio and common-table context. No product
  row or variant override changed during store or review.
- The exact-ID planner produced
  `tmp/nutrition-approved-plan/NCR1-remaining-pilot-applied-881-20260912-b1f666d6cf3e.json`.
  Its SHA-256 is
  `3f19a7146db2bd9182316319b5bb4a09ac7c16947ac13727d2dcccf627d49ef6`
  and plan fingerprint is
  `b1f666d6cf3ec7e726e80dbd6fd4986041720fee29cfac88848fb4734b1e53aa`.
  It has zero blockers, zero product updates, two exact variant updates and empty
  `before` overrides. Each `after` contains only serving 12.5 g, caffeine 200 mg,
  beta-alanine 2000 mg from 2 g, citrulline malate 2:1 at 4000 mg declared malate
  mass from 4 g, and creatine monohydrate at 3000 mg declared monohydrate mass
  from 3 g, plus the required per-serving metadata and evidence.
- Controlled apply changed only those five keys in `nutrition_override` for
  variants `1383` and `1384`. A new read-only connection matched both complete
  `after` objects and all approvals. Whole-product-table, all-other-variant,
  target-variant-metadata and non-target-queue hashes stayed unchanged;
  `nutrition_verified` remains false and legacy `creatine_per_serving_g` remains
  null. Exact plan replay was safely rejected by the stale-before guard, and a
  further read found an identical final state and queue counts.
- Fresh no-cache public HTTP 200 reads show the five applied facts for Baddy Berry
  and Bubblegum Crush, preserve the compound/form wording, expose only `Product
  label` as source kind and omit private URIs, hashes and reviewer metadata. Both
  variants currently have one fresh in-stock offer. The caffeine-free search
  contains neither exact variant and continues to group qualifying variants by
  product.
- The machine-readable closeout is
  [nutrition-applied-881-execution-2026-09-12.json](rollouts/nutrition-applied-881-execution-2026-09-12.json).
  Frozen-pilot applied coverage is now 7/25. The completed Stinger remains one
  separate demonstration outside that denominator. The remaining 18 positions
  retain their recorded gaps and must not be audited again without new evidence,
  permission, an identity decision or an exact source. NUT-03 remains
  `IN PROGRESS`.

## NUT-03 catalogue expansion batch 01 preparation

12 September 2026, owner-authorized preparation of one catalogue expansion
package with at most 50 exact variants:

- This is a new, separately counted denominator. It does not change the frozen
  pilot result of 7/25 completed and 18 unresolved, and it does not include the
  separate completed Stinger demonstration. The frozen expansion scope contains
  44 exact active variants from products `38`, `481`, `881`, `789` and `882`.
  Completed variants `726`, `760`, `761`, `815`, `816`, `1383`, `1384` and
  demonstration variant `1047` were excluded. All other GYM HIGH work remains
  owner-deferred.
- The official common-table rule remains the binding source rule: one table is
  read once for one formula version and market and may bind each listed flavour
  separately when the serving basis matches and no separate table or changed
  tracked-active dose is shown. Candy Ice Blast's named Breathe Easy flavour
  addition is not by itself evidence that caffeine, citrulline, beta-alanine or
  creatine doses differ. No already applied value was changed.
- A fresh forced-read-only production snapshot of project
  `aftboxmrdgyhizicfsfu` confirmed 141 active unmerged Pre Workout products, 575
  active variants, all 44 exact selected product/variant bindings, empty target
  `nutrition_override` objects and no existing candidate for those exact targets.
  Snapshot SHA-256 is
  `97988cba55dd7f3ab92814577307bc46cd1c3c682de49b483959d595e4120dd6`.
- Three retained Applied Nutrition tables qualify for 16 variants. Product `38`
  variants `727` and `728` propose 15 g / 2 scoops, caffeine 250 mg,
  beta-alanine 2000 mg from 2 g, citrulline malate 2:1 at 5000 mg declared
  malate mass from 5 g and creatine monohydrate at 3000 mg declared monohydrate
  mass from 3 g. Product `481` variants `762`, `763` and `3603` propose the full
  25 g / 2-scoop column, confirmed caffeine absence, beta-alanine 3000 mg,
  citrulline malate 2:1 at 10000 mg and creatine monohydrate 3000 mg. Product
  `881` variants `1385`-`1395` propose 12.5 g / 1 scoop, caffeine 200 mg,
  beta-alanine 2000 mg from 2 g, citrulline malate 2:1 at 4000 mg from 4 g and
  creatine monohydrate 3000 mg from 3 g. Compound masses are not converted to
  pure L-citrulline or pure creatine.
- Selected-flavour context checks were divided into successful technical batches
  of 7, 10, 1 and 1 requests. Two discarded no-write preflight attempts used five
  requests while resolving exact manufacturer spelling (`Icy Blue Raz` and
  `Tigers Blood`). No raw page snapshot or label image was downloaded or archived.
  The existing manufacturer collector dry-plan also passed for the three explicit
  Applied product URLs with zero requests and zero files written; collection was
  not invoked.
  Product `481` retained one nutrition image across all three targets; product
  `881` retained one across all eleven. The product `38` page lists its three
  flavours, one product-level Nutritional Info section, the common 15 g serving
  and common active amounts.
- Existing archived images were not copied. Fresh private-bucket reads reproduced
  image SHA-256 values
  `1182c1aeab46a72ff38709e349d692ab18d45355d87549574d30bb04f3067842`
  for product `38`,
  `77e37094d9f5eb4cb2f4b75a4e55d50cf22d6de8ed065d3a4fc8e565ba542513`
  for product `481` and
  `02987e5bfa5716453ea9ef6cb2db8af5582adc005ab0664ab9aef0a2efaeac87`
  for product `881`. The new common-table context manifest was stored once with
  `upsert: false` in private `nutrition-sources`; a fresh process read all 15562
  bytes and reproduced SHA-256
  `74d499888be00fdcaa68081b814878d163c2ae761f0abfcc02b6e6d8c37c2aed`.
- The three ignored candidate artifacts contain 10, 15 and 55 pending proposals:
  product `38` artifact SHA-256
  `4a0f39961bc0a3f59cfaf64922e5b861049e88ddbbed23917a8f65f745a00458`
  with fingerprint
  `2a084f3089bf0517b95a3d5663ea5e703450e56753949708186b39584c030418`;
  product `481` artifact SHA-256
  `914ad50e6979b3c8d93904dce6b639de8ba926e6386867bd66493f94a6499ba6`
  with fingerprint
  `1638cf68fa67d580927ae4767d753e89b9d2a63f03fe95e1fc93cc9faee4ebc0`;
  and product `881` artifact SHA-256
  `c01ffb9094aaa916e6bad1804763ee8febf668944f67ebd50f01e57f193af9a4`
  with fingerprint
  `4066d7a087950e240835c6753b66851d8a04efd217c3769026c6ca94c2f1f48f`.
  All 80 candidate fingerprints are unique. Each existing
  `nutrition:candidates:store --dry-run` passed with zero product updates and no
  database access or write.
- The other two identified official tables remain unusable for preparation. The
  current PER4M terms require express written permission to reproduce or copy the
  service and separately prohibit spider/crawl/scrape. Although `robots.txt`
  permits product paths, it does not override those terms. No PER4M collector,
  image download, private archive or transcription was run. Product `789` has 17
  exact selected catalogue variants and product `882` has 11; each needs written
  manufacturer permission followed by exact selector, market/version, serving
  and common-table checks. All 28 remain unresolved rather than receiving
  inferred values.
- The complete machine-readable owner package is
  [nutrition-catalog-expansion-batch-01-preparation-2026-09-12.json](rollouts/nutrition-catalog-expansion-batch-01-preparation-2026-09-12.json).
  Current expansion status is 44 assessed, 16 ready, 28 unresolved, five official
  tables identified, three qualified retained tables supporting 16 variants and
  80 dry-run-valid candidates. NUT-03 remains `IN PROGRESS`; one next step is one
  owner decision on controlled store -> review -> plan -> apply for exactly the
  unchanged 80-candidate Applied Nutrition set. PER4M remains outside that write
  scope until the stated permission and evidence arrive.

## NUT-03 catalogue expansion batch 01 execution evidence

- The authorized preparation report SHA-256
  `5cd9071cffdd7908645b7680810f1a0bd58149906ce7d9f8b2fe1eef0022928e`
  and all three artifact hashes and fingerprints matched before any write. A fresh
  production read-only connection confirmed project `aftboxmrdgyhizicfsfu`, all
  16 active product/variant bindings, no existing target candidate and an empty
  `nutrition_override` on every target. The three existing dry-runs passed again
  for 10, 15 and 55 rows with zero product updates.
- A fresh process read the private `nutrition-sources` bucket, the shared-table
  context manifest and the retained product `38`, `481` and `881` source images.
  The bucket remained private and every downloaded object reproduced its recorded
  SHA-256. No source was downloaded from a manufacturer and no archive object was
  added or replaced during execution.
- The guarded candidate-only store created exactly IDs `736`-`815`: 80 new rows,
  one per authorized fingerprint, all initially pending. Authenticated individual
  review approved the same 80 IDs as `admin-panel`, with `approved_value` equal to
  the proposal and a per-artifact review note bound to the artifact and context
  hashes. A separate read found 80 approved target rows and no duplicate
  fingerprint; the 16 target overrides were still empty before planning.
- Three safe plans had zero blockers and zero product updates. Product `38` plan
  SHA-256 `3cca4407b7be6ff04e79be4606e483ff20d91da1b28f632b2dca482b134c1aae`
  has fingerprint
  `41d31306cde24dbf3a1eee7037d61f6732454502ded56a1232923b3f13a1123e`
  and updates variants `727`/`728`. Product `481` plan SHA-256
  `024948683dc480458baef8bc447dc39c0c1d4ac53835b00194598d1dacd93dd6`
  has fingerprint
  `9d2682e58064a13b805793a6cd040db10cff0ee7006bd59cf6e472529d107551`
  and updates `762`/`763`/`3603`. Product `881` plan SHA-256
  `695dde18e225d5591de9d1c0687753d8ac705c356aef42816e22c085ef22be5c`
  has fingerprint
  `b30609698663e65d5ff0e06e5d79bff044055fa2993c14966ce24a8aaa68d3f2`
  and updates `1385`-`1395`.
- Controlled transactional apply completed all three plans. A new read-only
  connection matched every complete override to the corresponding planned
  `after`. Product rows, all other variants, target metadata, all non-target
  candidates, `nutrition_verified` and legacy `creatine_per_serving_g` retained
  their preflight state. The three exact replays were each safely rejected by the
  stale-before guard, rather than accepted as no-ops; a further read proved the
  final state was unchanged and no extra write occurred.
- Fresh public HTTP 200 reads with no-cache request headers passed for all 16 exact
  variant URLs. Each page selected the requested flavour and displayed its five
  applied facts with compound-form wording while omitting private URI, reviewer
  identity and raw hash. The caffeine-free search returned one grouped product
  `481` card linked to qualifying available variant `760`; qualifying new variants
  `762` and `763` also had current in-stock offers, while `3603` did not. Products
  `38` and `881` did not appear because their applied facts contain caffeine.
- Machine-readable closeout is
  [nutrition-catalog-expansion-batch-01-execution-2026-09-12.json](rollouts/nutrition-catalog-expansion-batch-01-execution-2026-09-12.json),
  SHA-256
  `d06edfba8bcf6f86d27f4f3777c75b540fac0e8482df7893cdb2b5f3b838668a`.
  Catalogue expansion batch 01 is `LIVE VERIFIED` for 16/44 exact variants and
  remains explicitly unresolved for 28 PER4M variants. The historical pilot is
  still 7/25, Stinger remains one separate demonstration, and NUT-03 remains
  `IN PROGRESS`. One next step is to obtain express written PER4M permission
  before resuming those 28 blocked variants; do not repeat their existing audit
  or the 18 frozen-pilot gaps without new evidence.

## NUT-03 catalogue expansion batch 02 preparation

12 September 2026, owner-authorized preparation of the next catalogue package,
without production candidate store, review, plan or apply:

- A fresh forced-read-only production snapshot of project
  `aftboxmrdgyhizicfsfu` found 141 active unmerged Pre Workout products and 575
  active variants. Exactly 24 variants had a non-empty `nutrition_override`; no
  extra completion appeared. Every one of those 24 was excluded. The known 28
  PER4M variants, prior unresolved positions without new evidence and all GYM
  HIGH products other than the already completed Stinger demonstration were not
  rechecked.
- The closed batch contains 19 exact active variants from existing products
  `215` and `957`. Fifteen are ready and four are unresolved. This is below the
  organizational limit of 50 and is split into two technical candidate artifacts
  under the existing 100-row artifact limit. No product, variant or identity was
  created, merged or repaired.
- A newly available official Applied Nutrition page resolves the former version
  conflict for the 315 g ABE formula. It identifies 315 g / 30 servings, one
  scoop (10.5 g), caffeine 200 mg, beta-alanine 2 g, citrulline malate 2:1 at
  4 g and creatine monohydrate at 3.25 g. Its single product table qualifies for
  product `215` variants `1016`, `1663`-`1671`, `1676` and `2019`, which the page
  explicitly represents through its flavour ingredient sections or exact 315 g
  product imagery. The four later flavours `1672`-`1675` are not shown in this
  315 g source and remain unresolved because the current page is a changed 375 g
  / 12.5 g / 3 g-creatine formula.
- New exact retailer-product context for existing product `957` binds its
  Baddy Berry, Cherry Cola and Cool Watermelon records (`1864`-`1866`) to the
  current official 375 g / 30-serving Applied Nutrition presentation. The
  official common table supplies one scoop (12.5 g), caffeine 200 mg,
  beta-alanine 2 g, citrulline malate 2:1 at 4 g and creatine monohydrate at 3 g.
  The existing catalogue records remain separate; this evidence does not merge
  product identities.
- The 315 g official table was read once and is clear. Its SHA-256 is
  `24b73d21da2c833d091c334bb5e696b085c74d8a3a6ac6b50dfb664bf8636728`.
  A full private-bucket duplicate scan found no matching object. The table and
  context manifest were stored once with `upsert: false`; a fresh process read
  reproduced their sizes and hashes. The manifest SHA-256 is
  `fda0d679d334affa186970c8a05f3b714310f9a0219d696cad0c6b6163838371`.
  The current 375 g image was reused without copying; its retained SHA-256 is
  `02987e5bfa5716453ea9ef6cb2db8af5582adc005ab0664ab9aef0a2efaeac87`.
- The ignored product `215` artifact contains 60 pending candidates for 12 exact
  variants. Its SHA-256 is
  `6d7f26a9299d732b6467b48a9c84b55dc30a9f7f279457177909c5686ab58d7b`
  and artifact fingerprint is
  `fdf6dda20459e751e3008a1189004b734168e531934ef28d5ecf565fbde6dab3`.
  The ignored product `957` artifact contains 15 pending candidates for three
  exact variants. Its SHA-256 is
  `da8169e2a67ddd57a064edd5831acb5a320c33901752998e0dcfecc121422240`
  and artifact fingerprint is
  `559a455981674c5bb598613ff94cc41df1b6a048bc22da710983e36a3bce12f4`.
  All 75 candidate fingerprints are unique. Both existing
  `nutrition:candidates:store --dry-run` validations returned
  `DRY_RUN_NO_DATABASE`, the expected 60 and 15 rows, zero product updates and
  zero database writes.
- The complete machine-readable owner package is
  [nutrition-catalog-expansion-batch-02-preparation-2026-09-12.json](rollouts/nutrition-catalog-expansion-batch-02-preparation-2026-09-12.json),
  SHA-256
  `8096195e5d402029fdc67b5fbf339f836ecdf8bca60b5b634c6fd3be1d5a2dd8`.
  One next step is one owner decision on controlled store -> review -> plan ->
  apply for exactly the unchanged 75 candidates across the 15 ready variants.
  The four unresolved 315 g flavours remain outside that future write scope.
  NUT-03 remains `IN PROGRESS`.

## NUT-03 catalogue expansion batch 02 execution evidence

13 September 2026, owner-authorized execution of the unchanged 75-candidate
ready subset:

- The authorized preparation report SHA-256
  `8096195e5d402029fdc67b5fbf339f836ecdf8bca60b5b634c6fd3be1d5a2dd8`
  and both artifact hashes/fingerprints matched. A fresh forced-read-only
  production connection confirmed project `aftboxmrdgyhizicfsfu`, all 15 active
  product/variant bindings, no existing target candidates and `{}` for every
  target `nutrition_override`. Repeated dry-runs returned 60 and 15 rows with
  zero product updates.
- A fresh process downloaded the private context manifest and exactly two
  retained table objects. The bucket remained private and all three SHA-256
  values matched: context
  `fda0d679d334affa186970c8a05f3b714310f9a0219d696cad0c6b6163838371`,
  315 g table
  `24b73d21da2c833d091c334bb5e696b085c74d8a3a6ac6b50dfb664bf8636728`
  and reused 375 g table
  `02987e5bfa5716453ea9ef6cb2db8af5582adc005ab0664ab9aef0a2efaeac87`.
  Execution added or replaced no archive object.
- Candidate-only store created exactly IDs `816`-`890`, one per authorized
  fingerprint. Authenticated individual review approved all 75 as `admin-panel`,
  with `approved_value` equal to the proposal and the note bound to each artifact
  plus the shared context manifest. Post-review readback found no duplicate,
  restored the pending count to its baseline and left all 15 overrides empty.
- Product `215` plan SHA-256
  `80201dc4f170ede17751b3527c114c3ca156c4d4eaeb58faa781e1e28be94d60`
  has fingerprint
  `c6db2ecc173f952e64a7c89fe9e0318470a117386a4dd59b045caec17a6791b8`;
  it contains 60 candidates, zero blockers, zero product updates and 12 variant
  updates. Product `957` plan SHA-256
  `c6b0d22541c4d6ce0f3a6877752ef257b8a1599183bd0db77dd7e30125a4fe66`
  has fingerprint
  `6afc9f216063a03a162f749251e7d120cd7d1fde7b7d7b616d44d1b83e073747`;
  it contains 15 candidates, zero blockers, zero product updates and three
  variant updates. Both plan `before` values were empty overrides.
- Controlled apply completed both plans. Product `215` variants now hold one
  10.5 g scoop, caffeine 200 mg, beta-alanine 2 g / 2000 mg, citrulline malate
  2:1 at 4 g / 4000 mg and creatine monohydrate 3.25 g / 3250 mg. Product `957`
  variants hold one 12.5 g scoop, caffeine 200 mg, beta-alanine 2 g / 2000 mg,
  citrulline malate 2:1 at 4 g / 4000 mg and creatine monohydrate 3 g / 3000 mg.
  A new read-only connection matched every complete override to its planned
  `after` and preserved all products, all other variants, target metadata and
  the non-target candidate queue, including `nutrition_verified` and legacy
  `creatine_per_serving_g`.
- Replaying each exact plan was safely rejected by the stale-before guard; this
  was a protected failure, not a no-op. A further read proved identical final
  state and zero additional writes. Fresh public HTTP 200 reads passed for all
  15 exact variant URLs, including selected flavour, serving and all four
  ingredient facts. Neither caffeinated family appears in the caffeine-free
  search. Private URIs, raw hashes and reviewer metadata were absent publicly.
- Machine-readable closeout is
  [nutrition-catalog-expansion-batch-02-execution-2026-09-13.json](rollouts/nutrition-catalog-expansion-batch-02-execution-2026-09-13.json),
  SHA-256
  `1181af274a0b0f1c51b244047705823fd406f94c990ef60a4a1b3f96d2780681`.
  Batch 02 is `LIVE VERIFIED` for 15 variants. Because `1016` and `1864` also
  belong to the frozen pilot, coverage is pilot 9/25, Stinger 1, Batch 01 16 and
  Batch 02 15, yielding 39 distinct applied variants. The 16 remaining pilot
  gaps, 28 PER4M variants and product `215` variants `1672`-`1675` remain
  untouched and require new evidence or permission before another audit.

## NUT-03 catalogue expansion batch 03 preparation

13 September 2026, owner-authorized preparation of the next closed catalogue
package of at most 50 exact variants:

- A fresh forced-read-only production connection to project
  `aftboxmrdgyhizicfsfu` found 141 active unmerged Pre Workout products, 575
  active variants and exactly 39 distinct variants with a non-empty
  `nutrition_override`. Those 39 were excluded. The retained blocks were not
  re-audited: 16 remaining frozen-pilot variants, 28 PER4M variants, product
  `215` variants `1672`-`1675`, and every other deferred GYM HIGH product.
- The closed scope contains 20 active exact variants across six product families.
  A second fresh read-only preflight confirmed every product/variant binding,
  zero existing candidates for the scope and an empty override for each target.
  Ten Strom variants are ready: product `869` variants `1323`, `1324`; product
  `870` variants `1325`-`1327`; product `871` variant `1328`; product `872`
  variants `1329`, `1330`; and product `873` variants `1332`, `1333`.
- Five official Strom product pages each present one shared current table with
  the qualifying flavour context, market and matching serving basis. The
  existing collector first failed closed when the combined source list included
  a Warrior page larger than its 2,000,000-byte HTML cap, and wrote no file.
  The first bounded five-URL Strom attempt then failed closed on a VascuMAX HTTP
  503. Splitting the same approved Strom URLs into technical groups of four and
  one passed without changing any limit. Robots allowed the public product HTML;
  the reviewed linked storefront policies did not identify a product-page
  collection prohibition. This evidence does not claim manufacturer permission.
- Product `869` and product `871` use `1 scoop (12 g)`: caffeine 250 mg,
  beta-alanine 3200 mg and citrulline malate 6000 mg; its ratio is not disclosed.
  Product `872` uses the same values and serving for the page's explicitly
  reformulated PRO version. Product `870` uses `1 scoop (13 g)`: caffeine 300 mg,
  beta-alanine 3200 mg and citrulline malate 6000 mg, ratio not disclosed.
  Creatine remains `no_information` for these eight variants because omission is
  not confirmed absence.
- Product `873` variants `1332` and `1333` use `1 scoop (15.7 g)`, citrulline
  malate 2:1 at 4000 mg and `confirmed_absent` beta-alanine from the explicit
  beta-alanine-free statement. Caffeine and creatine remain `no_information`;
  the broader stimulant-free wording was not substituted for a caffeine-specific
  declaration.
- Variant `1331` remains unresolved because the current official VascuMAX page
  lists Unicorn Pi55, Strawberry Kiwi and Cherry Cola, while the catalogue pair
  is Acai Berry. It needs an official 470 g / 30-serving source binding Acai Berry
  to the same 15.7 g formula, or an exact Acai Berry label. Product `56` variants
  `1006`, `1601`-`1606`, `3468`, `3469` remain unresolved because the otherwise
  useful official Warrior page exceeds the collector cap. They need a bounded
  official nutrition-table image or manufacturer snapshot within the existing
  limit; the cap was neither raised nor bypassed.
- A full private-bucket duplicate precheck found none of the six intended objects.
  Five official HTML snapshots and one context manifest were then stored once in
  private bucket `nutrition-sources` with overwrite disabled. A fresh-process
  readback reproduced all six hashes; the bucket remains private. The context
  manifest SHA-256 is
  `9fbe9d1c882e26f265532663afce9a9e5052da96c996a07a1fbd0c6e25bbb605`.
  The five snapshot SHA-256 values are
  `47a1cbdfc6327193ccb2fd0e7b9793dab94771664d2a96736bb176ba5cd9e230`,
  `a185591be61aff68b0b7b3a9fc0fa605971398908d10d5c13d3d8c97077c127b`,
  `80ae870c635cd24c15fe1473e568d10c0966266514ab81df075d0afb14b462a7`,
  `ca6ae0c5d7acd9822d94fc5f34df10bb9742710b6bc9d9b68fda11bc1baf5c66`
  and `a9539e3c6e6ee92bb3b67ed9fb90b9e909a6157770341871977267e60caf3f7a`.
  Private storage is retained source evidence, not a represented backup.
- Five ignored candidate artifacts contain 50 pending rows and 50 unique
  fingerprints. Their product, row count, SHA-256 and artifact fingerprint are:
  product `869`, 10 rows,
  `5615bb2b925a7bc86a9fb3bc8efcd41dca625a0c9aaa4c098f18a1ac77747e8f`,
  `a1107ad3f6bfdb208cf40aec2ed1c8a027fea003291cab5724ed6d7165cca2c2`;
  product `870`, 15 rows,
  `6f4ab5f97bb140c90945fcf17075d83b51ff0017ce671c904f52f940b6941a60`,
  `5f1aa2cde39ee2fd0ba051cb8ecfa534ab324c93d55d88b42153fccfebf5cf96`;
  product `871`, 5 rows,
  `c29f5a10c7ee0220eca2b5fa2c9db57609e28d1162c6b3c30672a0d7a443048d`,
  `5bff2336be6b9aafbaf54c2bb38c5b9d3b2de0fc531666d51e7c1cbe978de912`;
  product `872`, 10 rows,
  `04b943d6101267d4d0fda8a0bc5fe2ddb4bb90abf0a9cf689ae78a1a07852d80`,
  `0571eaddf004e9e17bf2988ed54650981effc7ac3a527c68ad8fda345a41843e`;
  product `873`, 10 rows,
  `f195f8368e8c8b9b230b7c3e1ee97055dede61c8b861069efb516e51c46d2ae9`,
  `e77ab02edfb6edf175ccfa7879af334fe60bc3ae5b95c92971454359b8c27b9c`.
  All five `nutrition:candidates:store --dry-run` validations returned
  `DRY_RUN_NO_DATABASE`, the expected row count, zero product updates and zero
  database writes.
- The machine-readable package is
  [nutrition-catalog-expansion-batch-03-preparation-2026-09-13.json](rollouts/nutrition-catalog-expansion-batch-03-preparation-2026-09-13.json),
  SHA-256
  `a44eeeddcd932b2aeea2d80711491622c211f18fe116cf00c16e7eb41a974ac1`.
  One next step is one owner decision on controlled store -> authenticated review
  -> exact-ID plans -> guarded apply for only the unchanged 50 candidates across
  variants `1323`-`1330`, `1332` and `1333`. Variant `1331` and all nine Warrior
  variants remain outside that future write scope. No production candidate or
  catalogue write ran; the applied total remains 39 and NUT-03 remains
  `IN PROGRESS`.

## NUT-03 catalogue expansion batch 03 execution evidence

13 September 2026, owner-authorized execution of the unchanged 50-candidate
ready subset:

- The preparation report SHA-256
  `a44eeeddcd932b2aeea2d80711491622c211f18fe116cf00c16e7eb41a974ac1`,
  all five artifact hashes, all five artifact fingerprints and all 50 unique
  candidate fingerprints matched. A fresh forced-read-only production preflight
  confirmed project `aftboxmrdgyhizicfsfu`, the ten active product/variant
  bindings, zero existing target candidates and `{}` for every target override.
  Repeated dry-runs returned 10, 15, 5, 10 and 10 rows, zero product updates and
  zero database writes.
- A fresh process downloaded the five retained official page snapshots and the
  shared context manifest from private bucket `nutrition-sources`. The bucket
  remained private and all six hashes matched. Execution added or replaced no
  archive object.
- Candidate-only store created exactly IDs `891`-`940`, one per authorized
  fingerprint. Authenticated individual review approved all 50 as `admin-panel`,
  with each `approved_value` equal to the proposal, including null approved
  values for `no_information` and `confirmed_absent`. The review note binds each
  row to its artifact hash and the context manifest. Post-review readback found
  no duplicates, returned the pending count to its baseline and left all ten
  overrides empty.
- Five exact plans contain zero blockers and zero product updates. Their product,
  SHA-256 and plan fingerprint are: `869`,
  `5d9022c214b9acb1de6921a465e321660e0d6f2798ba6b666d0fd1959e4de2c0`,
  `af23f70b74b08cf1a9036a5b92ab622df2ceba6e4295dcc4cb1cb45a9a05388d`;
  `870`, `b8bace38771019d523f33ee8dbf8b7ffcb1efa361afd64fc03f78fc523914f8e`,
  `5bbe896c2d27e12c9d3e325a34e458e856db51d42fab33bc36302466a3a84314`;
  `871`, `c98b8f1ebb1c2e91d25aa4c6d8d550fe26479a5bea84c7c1298e82e9cb184a8a`,
  `7a8a55a774ceba2848d7ac39601cf38c2b48a6f2db304862724be319c50dbccc`;
  `872`, `9820a8b6b0b797e9cb9ce4668842b7578f1e6a42198f340863f890ad3b753412`,
  `7698ac666255969995596791b59d50f56cdabac575189245369d548d72260825`;
  `873`, `99606ef8054ce001a6f8240a3711d523f8c5fb7cd75d6085cc2f188438809e6b`,
  `29120943ae2532aea152d140f60c3d56a646628640be67288321764df1e62158`.
  Together they bind exactly 50 candidate IDs and ten variant updates.
- Controlled apply completed all five plans. Products `869`, `871` and `872`
  now carry the reviewed 12 g facts for their selected exact variants; product
  `870` carries its reviewed 13 g facts; product `873` variants `1332`, `1333`
  carry the 15.7 g serving, beta-alanine confirmed absence, 4000 mg citrulline
  malate 2:1 and unresolved caffeine/creatine states. A new read-only connection
  matched every complete override to its planned `after` and preserved all
  products, all other variants, target metadata and the non-target candidate
  queue, including `nutrition_verified` and legacy `creatine_per_serving_g`.
- Replaying each exact plan was safely rejected by the stale-before guard. This
  was protected rejection, not a no-op. A further new connection proved the same
  final overrides and zero additional writes. Fresh public HTTP 200 reads passed
  for all ten exact-variant pages, including the selected flavour, serving, facts,
  unresolved states, sanitized manufacturer source kind and absence of private
  provenance. None of these variants appears in the caffeine-free filter: eight
  contain caffeine and two retain `no_information` rather than confirmed absence.
- Machine-readable closeout is
  [nutrition-catalog-expansion-batch-03-execution-2026-09-13.json](rollouts/nutrition-catalog-expansion-batch-03-execution-2026-09-13.json),
  SHA-256
  `73e65d57724857ade006824eb349d733d404abe5ebfe4f77cdca9906e05bdce1`.
  Batch 03 is `LIVE VERIFIED` for ten variants. The frozen pilot remains 9/25,
  Stinger remains one separate demonstration, and the distinct applied total is
  now 49. Variant `1331` plus product `56` variants `1006`, `1601`-`1606`,
  `3468`, `3469` remain unresolved and untouched. NUT-03 remains `IN PROGRESS`.
  One next step is the next independent catalogue-family preparation package
  using new qualifying evidence; retained blocks are not re-audited without a
  new premise.

## NUT-03 catalogue expansion batch 04 preparation

13 September 2026, preparation of the next closed catalogue package under the
50-exact-variant organizational ceiling:

- A fresh forced-read-only production catalogue snapshot found 141 active,
  unmerged Pre Workout products, 575 active variants and exactly 49 distinct
  variants with a non-empty `nutrition_override`. All 49 were excluded. A second
  read-only production preflight confirmed six exact active non-default bindings,
  zero existing candidates for them and `{}` for every target override: product
  `528` variants `976`, `977`, `1847`, `1848`, and product `1248` variants `3670`,
  `3716`.
- The official Nutrend Pump 225 g page presents Berry Splash, Tropical Blend,
  Rainbow and Bubble Gum in the same product context, with a flavour table for
  each. Every 15 g column declares L-citrulline malate 5000 mg and beta-alanine
  3000 mg; directions define 15 g as one-half scoop. The product is explicitly
  described as without caffeine, so caffeine is `confirmed_absent`. Creatine is
  omitted and remains `no_information`, not confirmed absence.
- The official PhD Charge 300 g page presents Blue Gummy Bear and manufacturer-
  spelled Sherbert Lemon in the same GB product context. Both flavour tables
  declare per 15 g: caffeine 200 mg, beta-alanine 2000 mg, L-citrulline
  DL-malate 1000 mg and creatine monohydrate 3000 mg. Directions define the
  serving as one scoop / 15 g, and both ingredient lists declare the malate ratio
  as 2:1. Catalogue spelling `Sherbet Lemon` is retained as the same exact
  variant binding; no pure-citrulline or pure-creatine conversion is made.
- The existing collector fetched only the two explicit official product URLs in
  one technical batch, below its ten-URL limit. Reviewed robots rules did not
  disallow the public product paths. Nutrend's linked terms govern sales, and
  PhD's linked terms govern purchases and subscriptions; neither reviewed page
  states a product-page collection prohibition. This is an access result, not a
  claim of manufacturer permission.
- A private-bucket duplicate precheck found no intended path or matching hash.
  The two official HTML snapshots and one context manifest were stored once in
  private bucket `nutrition-sources`, with overwrite disabled. A fresh-process
  readback reproduced all three hashes: Nutrend
  `b646fe51ed86951bbb60b936797dbc483099d3b567a03fdabcda9bf2be0330b6`,
  PhD `5dcfa29066ca5a269eacafcb22c6510ec284ce362c9170cdccbaad6bdaaca4af`
  and context
  `0f7c0d6277b1cb0b399c54a259f51c28220f3cd82f19f738f50823d8aac9e813`.
  Private source retention is not represented as a backup.
- The ignored product `528` artifact contains 20 pending candidates and has
  SHA-256
  `add367babe690803875598093ad53b884dc986739271341ba1f6484a6d94bba4`
  with artifact fingerprint
  `9738c30835ecab8a2289a36e6c1d2e8fe5538bd23e47ed31ebac0ccdccb74eff`.
  The ignored product `1248` artifact contains ten pending candidates and has
  SHA-256
  `dcd14e7d367840a1f96ac96bbd4fa57d65c0c628fd76686072617f257f7132f1`
  with artifact fingerprint
  `7f89bf5ecd26a2369a7fcb6c567154d41d0a4cbca4c6603ec50908b634e67351`.
  All 30 candidate fingerprints are unique. Both existing
  `nutrition:candidates:store --dry-run` runs returned `DRY_RUN_NO_DATABASE`,
  respectively 20 and ten rows, zero product updates and zero database writes.
- Six variants were assessed and are ready for a decision; two PhD variants have
  caffeine, beta-alanine, citrulline and creatine fully resolved without
  `no_information` or conflict. The four Nutrend variants are still valid
  packages with an explicit creatine `no_information` state. Two unique formula
  tables support the six variants and produce 30 candidates.
- The scope stopped at six after a short recognition pass. Further shortlisted
  families had explicit source-use restrictions, unresolved package or formula
  identity, conflicting serving evidence, or mixed citrulline forms that the
  existing single-form field cannot represent faithfully. Known frozen-pilot,
  PER4M, Applied, Strom/Warrior and GYM HIGH blocks were not reopened without new
  evidence. The evidence bar and current model were not weakened to fill the
  organizational ceiling.
- The machine-readable owner package is
  [nutrition-catalog-expansion-batch-04-preparation-2026-09-13.json](rollouts/nutrition-catalog-expansion-batch-04-preparation-2026-09-13.json),
  SHA-256
  `340428ab2732124d44c677ffdc6c596fa1907361850ab3250224f32e0baa8860`.
  One next step is one owner decision on controlled store -> authenticated review
  -> exact-ID plans -> guarded apply for exactly these unchanged 30 candidates
  across variants `976`, `977`, `1847`, `1848`, `3670` and `3716`. No production
  candidate store, review, plan, apply or catalogue write ran. NUT-03 remains
  `IN PROGRESS` and the distinct applied total remains 49.

## NUT-03 catalogue expansion batch 04 execution evidence

13 September 2026, owner-authorized controlled execution of the unchanged Batch
04 package in production project `aftboxmrdgyhizicfsfu`:

- Preflight reproduced the authorized preparation report SHA-256
  `340428ab2732124d44c677ffdc6c596fa1907361850ab3250224f32e0baa8860`,
  product `528` artifact SHA-256
  `add367babe690803875598093ad53b884dc986739271341ba1f6484a6d94bba4`
  and fingerprint
  `9738c30835ecab8a2289a36e6c1d2e8fe5538bd23e47ed31ebac0ccdccb74eff`,
  and product `1248` artifact SHA-256
  `dcd14e7d367840a1f96ac96bbd4fa57d65c0c628fd76686072617f257f7132f1`
  and fingerprint
  `7f89bf5ecd26a2369a7fcb6c567154d41d0a4cbca4c6603ec50908b634e67351`.
  All 30 candidate fingerprints were unique. All six product-variant bindings
  were active, exact and non-default, every target override was `{}`, and no
  matching candidate existed before store.
- A fresh-process readback from private bucket `nutrition-sources` reproduced the
  two official formula-table hashes and context-manifest hash recorded by the
  preparation package. No source object was copied again. Repeated artifact
  dry-runs returned `DRY_RUN_NO_DATABASE`: 20 plus ten candidates, zero product
  updates and zero database writes.
- The controlled store created exactly candidates `941`-`970`; a new connection
  found one record for each fingerprint and no target override change.
  Authenticated review approved exactly those 30 records as `admin-panel`, with
  approved values, exact variants, evidence and fingerprints unchanged. The
  Nutrend half-scoop basis is `1/2 scoop (15 g)`, caffeine absence retains the
  manufacturer's explicit declaration, creatine remains `no_information` with
  a null value, and no citrulline-malate ratio was invented. The two PhD records
  retain their flavour-specific table evidence and one-scoop / 15 g basis.
- The product `528` plan is
  `tmp/nutrition-approved-plan/NCR1-catalog-batch-04-528-20260913-b8421a9a6199.json`,
  SHA-256
  `4a4af466f8ecb8d64f4e88150d3e4eeb039743164d715c40833af635332597a8`,
  fingerprint
  `b8421a9a61994abce58885c13b867cc93ea30862e9576242b40f4a05e18b337d`.
  It contains candidates `941`-`960`, zero product updates and four exact variant
  updates. The product `1248` plan is
  `tmp/nutrition-approved-plan/NCR1-catalog-batch-04-1248-20260913-9284b4423665.json`,
  SHA-256
  `606551467d7fbfd9cab2cdf601e28ad9b38f9058d6316a86ea64fbb3f3f186d1`,
  fingerprint
  `9284b4423665522e57d47142fb67206da5957a29a0523c38569a8a330c24a36b`.
  It contains candidates `961`-`970`, zero product updates and two exact variant
  updates. Both plans had zero blockers and an empty exact `before` override.
- Controlled apply returned `APPLIED_REVIEWED_NUTRITION_FIELDS` for both plans.
  An independent new-connection readback matched every full `after` override for
  variants `976`, `977`, `1847`, `1848`, `3670` and `3716`. Full-product,
  all-other-variant, target non-override metadata and non-target candidate-queue
  digests remained unchanged; this includes `nutrition_verified` and legacy
  `creatine_per_serving_g`. All 30 approvals and source proofs remained intact.
- Replaying each unchanged plan through the guarded apply path was safely rejected
  by the stale-before check. This was a protected rejection rather than a no-op;
  a further independent readback confirmed an identical final state and zero
  additional writes.
- All six exact public variant URLs returned HTTP 200 and showed the correct
  selected variant, serving and reviewed facts with a sanitized manufacturer
  source kind. Private archive URIs and reviewer identity were absent. The
  caffeine-free result contained none of the six: both PhD variants contain
  caffeine, while all four otherwise qualifying Nutrend variants had zero current
  in-stock offers inside the existing freshness window. The filter therefore
  preserved its offer-availability and one-card-per-product grouping rules.
- Six unique variants and 30 candidates were applied. Both PhD variants resolve
  all four tracked ingredients; the four Nutrend variants deliberately retain
  creatine as `no_information`, so the fully resolved count is 2 of 6. Batch 04
  stopped at six because the preparation pass found source-use restrictions,
  unresolved package/formula identities, conflicting serving evidence and mixed
  citrulline forms for the other shortlisted families. Those recorded blocks were
  not re-audited and safeguards were not weakened to fill the 50-variant ceiling.
- Machine-readable execution evidence is
  [nutrition-catalog-expansion-batch-04-execution-2026-09-13.json](rollouts/nutrition-catalog-expansion-batch-04-execution-2026-09-13.json),
  SHA-256
  `b5c14a508d362680ae0717d57dd1b82bf3b1eae8515a4d0167251c463e56afd4`.
  Batch 04 is `LIVE VERIFIED`; the distinct applied total is now 55. The frozen
  pilot remains 9/25, Stinger remains one separate demonstration, and NUT-03
  remains `IN PROGRESS`. One next step is another independent catalogue-family
  preparation package based on new qualifying evidence, without reopening known
  blocks absent a new premise.

## NUT-03 catalogue expansion batch 05 preparation

13 September 2026, preparation of one closed package under the 50-exact-variant
organizational ceiling:

- A fresh forced-read-only production snapshot at
  `2026-09-13T07:52:21.978Z` confirmed project
  `aftboxmrdgyhizicfsfu`, 141 active unmerged Pre Workout products, 575 active
  variants and exactly 55 variants with a non-empty `nutrition_override`. All 55
  were excluded. A second read-only preflight confirmed the 12 selected active,
  non-default product-variant bindings, zero existing candidates for them and an
  empty override for each target. Both reads made zero database writes.
- The existing evidence rules already made the official manufacturer page the
  primary source and permitted one common table for flavours in the same product,
  recipe, market and serving context. The process guide now also states the two
  missing decisions explicitly: a readable official `Supplement Facts`,
  `Nutritional Information` or `Active Ingredients` table is sufficient proof of
  the displayed ingredient amount and serving basis without a second statement;
  and one unsupported fact does not block supported facts for that variant. The
  unresolved evidence and omission reason remain recorded, and an artifact is not
  padded to five candidates.
- Product `1250`, Bulk Dope Pre Workout 510 g, contributes variants `3672`,
  `3721`, `3722`. Each proposes the approximate serving `1 slightly heaped scoop
  (approximately 17 g)`, caffeine 200 mg, beta-alanine 3200 mg from source
  `3.2 g`, and creatine monohydrate 3400 mg from source `3.4 g`. Citrulline is
  omitted because the one serving contains two separately declared forms:
  citrulline malate 2.5 g and L-citrulline 500 mg, which the current single-form
  field cannot preserve faithfully.
- Product `1254`, Bulk Dope Max Pre-Workout 563 g, contributes variants `3676`,
  `3725`, `3726`. Each proposes the approximate serving `1 slightly heaped scoop
  (approximately 22.5 g)`, caffeine 200 mg, beta-alanine 5000 mg from source
  `5.0 g`, and creatine monohydrate 3400 mg from source `3.4 g`. Citrulline is
  omitted because the table separately declares citrulline malate 3.0 g and
  L-citrulline 2.0 g per serving.
- Product `1279`, Bulk Dope Caffeine Free Pre-Workout 510 g, contributes variants
  `3759`, `3894`, `3895`. Each proposes the approximate serving `1 slightly
  heaped scoop (approximately 17 g)`, caffeine `confirmed_absent` with null amount
  from the manufacturer's caffeine-free/stimulant-free declaration,
  beta-alanine 3200 mg from source `3.2 g`, and creatine monohydrate 3400 mg from
  source `3.4 g`. Its citrulline candidate is omitted because the table declares
  citrulline malate 2.5 g plus L-citrulline 500 mg.
- Product `1247`, Muscle Moose Pre-Workout Zero Itch Formula 280 g, contributes
  exact manufacturer flavour pages for variants `3669`, `3714`, `3715`. Every
  page proposes serving 14 g, total caffeine 197 mg and free-form L-citrulline
  3000 mg. Beta-alanine and creatine are absent from the table and full ingredient
  list, but no explicit absence is declared; both fields therefore remain
  unresolved and have no candidate. The product name is not used as absence
  evidence.
- Six official dose-table snapshots support the 12 variants: three common Bulk
  pages each support three flavours, and three exact Muscle Moose flavour pages
  each support one variant. A private-archive duplicate check found no intended
  path. The six HTML snapshots and one source-context manifest were written once
  with overwrite disabled. A fresh readback from private bucket
  `nutrition-sources` reproduced all seven hashes and confirmed no automatic
  expiry. The context manifest SHA-256 is
  `836c7ab8ba849dcf8a4cee41523ee962f6c0551b055206d66452daa98521a39c`.
  Private retention is not represented as a backup.
- Four ignored candidate artifacts contain 45 pending facts and 45 unique
  fingerprints. Product `1247`: nine candidates, SHA-256
  `71938591986ba368271d1e5c7a7619c48fc94d0b05e2a7cd9297e14fff95d194`,
  artifact fingerprint
  `bd4f77cdc64fe76b033d35f8c7f44e0b957f6d4d2725cfa0fc0ae7b9bca79ece`.
  Product `1250`: 12 candidates, SHA-256
  `c793ad012536ef5e31466e1d65753e7a798b4f0ab2b1c9ddcf5db9418ecf8abf`,
  fingerprint
  `e41984e4705299ed488eb73a7d94924bbc3219c2240f5d849a0958202946fac2`.
  Product `1254`: 12 candidates, SHA-256
  `cce35d083edeee0000896a298770145891b70d3bbdbaaaf0121b89e4ab9e677e`,
  fingerprint
  `a59bf8339554a7d3986d2d760d7bc964e4c95ac98443a70a0aa6a4301515f117`.
  Product `1279`: 12 candidates, SHA-256
  `7d6f86ef9a407cce4522841086205f30ceca20900ffb966ce7e42f0780e9cc03`,
  fingerprint
  `05aabee2901e8c4991f2a4741f887b517e09ba448f46ff9d8125f345c75746a2`.
  The four `nutrition:candidates:store --dry-run` checks passed with 9, 12, 12
  and 12 rows respectively, zero product updates and zero database writes.
- The assessment reached its 50-variant ceiling: 12 are ready and 38 retain
  specific recorded blockers. Those are eight Dorian Yates variants, 12 Naughty
  Boy variants, nine Trained By JP variants and six PEScience variants excluded
  by their reviewed source-use conditions, plus three Conteh variants whose
  current official 16 g formula is not bound to the catalogue's 375 g version.
  Known pilot, PER4M, Applied-version, Strom/Warrior and GYM HIGH deferrals were
  not reopened without new evidence. No ready variant resolves all four tracked
  ingredients because Bulk's two-form citrulline blend and Muscle Moose's two
  explicit absence gaps remain outside the candidates.
- The machine-readable owner package is
  [nutrition-catalog-expansion-batch-05-preparation-2026-09-13.json](rollouts/nutrition-catalog-expansion-batch-05-preparation-2026-09-13.json),
  SHA-256
  `2a403d83613073a4708aa9267d821c70892db5b48c81bdcfcca25d0cec8d2f51`.
  One next step is one owner decision on controlled store -> authenticated review
  -> exact-ID plans -> guarded apply for exactly the unchanged 45 fingerprints in
  these four artifacts. The unresolved fields remain excluded. No production
  candidate store, review, plan, apply or catalogue write ran. NUT-03 remains
  `IN PROGRESS` and the distinct applied total remains 55.


## NUT-03 catalogue expansion batch 05 execution

13 September 2026, owner-authorized production execution of the unchanged
45-candidate Batch 05 package:

- Fresh preflight confirmed production project `aftboxmrdgyhizicfsfu`, all 12
  active non-default product-variant bindings, empty target overrides, zero
  existing target candidates and the four artifact hashes/fingerprints recorded
  in preparation. A new private-archive connection reproduced all six source
  snapshot hashes and the context-manifest hash; no source was copied again.
- The four required dry-runs repeated successfully with 9, 12, 12 and 12 rows,
  zero product updates and `DRY_RUN_NO_DATABASE`. Guarded store then created
  exactly candidates `971`-`1015`: product `1247` uses `971`-`979`,
  product `1250` uses `980`-`991`, product `1254` uses `992`-`1003`,
  and product `1279` uses `1004`-`1015`. Each fingerprint occurs once.
- Authenticated individual review approved all 45 unchanged proposals as
  `admin-panel`. Approved values, information states, original units, serving
  bases, exact product/variant IDs, source URIs, source hashes and fingerprints
  match the four artifacts. Queue totals moved from 948 approved / 16 pending /
  6 rejected to 993 approved / 16 pending / 6 rejected.
- Four plans had zero blockers and zero product updates. Product `1247` plan
  SHA-256 `c070c2c1a737cd46142ed93ba2ded77dce749667848d45652a43aa5357df2fd2`,
  fingerprint `85780612b6cfa2faeb3b3e8857b294935fc3b1eb5bef3285313f296226914eb9`;
  product `1250` plan SHA-256
  `9b87b3b5b2c18c53dcb7ba903289686dfbf29d4074180729172c1dc0a41f6434`,
  fingerprint `3e0afe9ad83ab58f14fdf4f29726b23535cfd8ab863e00b2849b59341180c649`;
  product `1254` plan SHA-256
  `e646cfdb524b75ec96537f2005d797bb7550ff8bd053ca14504b2958b57f8426`,
  fingerprint `fd0e5b69868a3ffd18d9d24c738529bb3f6f6a3fe23c3536f39f3003f9f60175`;
  product `1279` plan SHA-256
  `3a74b3e40bfb10baefdeeee659f8c9506896ba72b1e94887c62c159ef844a3f7`,
  fingerprint `c48f319045d63e7c2f1a3c372bd8a8d5c05e0188996bc3bec6079cc3a45b4e15`.
- Controlled apply changed only `product_variants.nutrition_override` for variants
  `3669`, `3714`, `3715`, `3672`, `3721`, `3722`, `3676`, `3725`,
  `3726`, `3759`, `3894` and `3895`. A new read-only connection matched
  every complete planned `after`. Full-product, every non-target variant,
  target non-override metadata and non-target queue digests match preflight, so
  `nutrition_verified`, legacy `creatine_per_serving_g` and all records outside
  scope are unchanged.
- Replaying each exact plan through `nutrition:approved-apply` was safely rejected
  by the stale-before guard. This is a protected rejection, not a no-op. A further
  independent readback matched all 12 final overrides and all preservation
  digests, proving zero additional writes.
- All 12 public exact-variant pages returned HTTP 200 and showed the matching
  selected variant, supported reviewed facts and sanitized manufacturer source
  kind without private archive URIs or reviewer identity. The caffeine-free
  search returned one grouped card linked to current in-stock variant `3759`.
  No target from caffeinated products `1247`, `1250` or `1254` entered the
  filter.
- Batch 05 applies 45 supported facts to 12 unique variants. None resolves all
  four tracked ingredients: Muscle Moose retains beta-alanine and creatine as
  unknown, while each Bulk family retains its two-form citrulline blend as an
  explicit unsupported-field gap. No placeholder candidate or inferred absence
  was introduced. The distinct applied total is now 67; the frozen pilot remains
  9/25 and Stinger remains one separate demonstration.
- Machine-readable execution evidence is
  [nutrition-catalog-expansion-batch-05-execution-2026-09-13.json](rollouts/nutrition-catalog-expansion-batch-05-execution-2026-09-13.json),
  SHA-256
  `14a60171278812af7be80d8b89454aa20c5d106c90fd2943d41ae569aff10bef`.
  Batch 05 is `LIVE VERIFIED`; NUT-03 and MVP remain `IN PROGRESS`. One next
  step is a new independent catalogue-family preparation package based on new
  qualifying evidence, without reopening the 38 recorded Batch 05 blockers or
  other known deferrals absent a new premise.

## NUT-03 catalogue expansion batch 06 preparation

13 September 2026, one closed read-only package under the 50-exact-variant
organizational limit:

- A fresh production read at `2026-09-13T09:11:54.124Z` confirmed project
  `aftboxmrdgyhizicfsfu`, 575 active pre-workout variants and exactly 67 variants
  with non-empty `nutrition_override`. Those 67 were excluded. The closed scope
  contains 50 current-offer variants across eight product families and reaches
  the organizational cap; known blocks were not reopened.
- One exact variant is ready, partially: Apex Formulas product `1283`, variant
  `3763`, Raspberry Rush 625 g. The official page and retained pack/table images
  bind that flavour and show `Serving Size 1 Scoop (25g)`, free-form
  L-citrulline `6000 mg` and a non-stimulant formula. The artifact therefore
  proposes serving size 25 g, caffeine `confirmed_absent` with no numeric value,
  and L-citrulline 6000 mg per that serving. Beta-alanine and creatine remain
  omitted because absence from the table is not confirmed absence.
- Duplicate preflight found no target archive paths. The official HTML, three
  manufacturer images and context manifest were stored once in private
  `nutrition-sources`; a fresh readback reproduced all five SHA-256 values.
  They have no automatic expiry. This source retention is not described as a
  separate backup.
- The candidate artifact is
  `tmp/nutrition-catalog-batch-06-2026-09-13/candidate-artifact/nutrition-candidates-ncr1-catalog-batch-06-1283-20260913-v2.json`,
  SHA-256
  `7def45fbd24c931a25a2ba13afe6e61a37ded013cf74a837a025977bd732ec55`,
  artifact fingerprint
  `31e0d7c9ebb7d58bdc4070f0eec408b94c95df8e0b3a07f90c4f2cc12a516d4e`.
  Its three candidate fingerprints are unique. Existing
  `nutrition:candidates:store --dry-run` passes with three rows, zero product
  updates and zero database writes.
- The remaining 49 scoped variants have explicit current access or
  version/applicability gaps recorded in the machine-readable report. A blocked
  family did not stop evaluation of later families. No model, schema, parser or
  identity was changed, and no production candidate store, review, plan, apply
  or catalogue write ran.
- Serving qualifiers remain evidence: an official `approximately` is preserved
  verbatim in `serving_basis_text` and never promoted to an exact manufacturer
  claim. The Apex source states 25 g without that qualifier. Existing Bulk
  overrides retain `1 slightly heaped scoop (approximately ...)` unchanged.
- Fresh pilot reconciliation is 9 complete variants, 2 partial variants
  (`3676`, `3759`) and 14 variants with no applied facts. Nine applied Bulk
  variants have citrulline omitted solely because the current single-form model
  cannot preserve both separately disclosed masses. All nine have separate
  citrulline-malate and L-citrulline quantities; zero are supported only by one
  aggregate blend mass.
- Machine-readable preparation evidence is
  [nutrition-catalog-expansion-batch-06-preparation-2026-09-13.json](rollouts/nutrition-catalog-expansion-batch-06-preparation-2026-09-13.json),
  SHA-256
  `da54c4e347975b9f1937786e8a2b3fd5dfbf4a694f2c5f4036c796ae4e5a2080`.
  The subsequently authorized controlled path is recorded below. Its two
  unresolved fields remain excluded; NUT-03 and MVP remain `IN PROGRESS`.

## NUT-03 catalogue expansion batch 06 execution

13 September 2026, owner-authorized store, review, plan and apply for exactly
three candidates of product `1283` / variant `3763`:

- Production preflight on project `aftboxmrdgyhizicfsfu` matched the authorized
  artifact SHA-256
  `7def45fbd24c931a25a2ba13afe6e61a37ded013cf74a837a025977bd732ec55`,
  artifact fingerprint
  `31e0d7c9ebb7d58bdc4070f0eec408b94c95df8e0b3a07f90c4f2cc12a516d4e`,
  three unique candidate fingerprints, the exact product/variant relationship,
  empty target override and zero existing target candidates. Fresh private-
  archive readback reproduced the hashes of the official HTML, three retained
  images and context manifest; it made no storage or database write.
- Guarded store created exactly candidates `1016`-`1018`. Authenticated
  individual review approved only those rows with `reviewed_by=admin-panel`:
  serving size 25 g, caffeine `confirmed_absent` with no numeric value, and
  6000 mg free-form L-citrulline per `Serving Size 1 Scoop (25g)`. Fresh reads
  preserved their exact variant ID, source URI, source SHA-256, locators and
  fingerprints. Beta-alanine and creatine were not fabricated.
- The exact-ID plan is
  `tmp/nutrition-approved-plan/NCR1-catalog-batch-06-1283-20260913-v2-a027d2cffb54.json`,
  SHA-256
  `fa82e56c4ef856df046d68a9e479710425ddb8b3881bf37843d308001a287c1b`,
  fingerprint
  `a027d2cffb54efe4fb73103dd55131ffc660a11c6d3f7471b64b25ab7b7210a0`.
  It has zero blockers, zero product updates and one exact variant update from
  `{}`. Controlled apply changed only `serving_size_g`, `caffeine` and
  `citrulline` in variant `3763`'s override.
- A new connection matched the complete planned `after` object and all three
  approvals. Whole products, every other variant, target metadata outside the
  override and the non-target queue retained their preflight digests. Exact plan
  replay was safely rejected because the before-state was stale; another fresh
  read proved zero additional writes and the same final state.
- The exact public page
  `https://www.supplementscout.co.uk/product/apex-formulas-apex-pump-625g?variant=3763`
  returns 200 and displays the applied serving, confirmed caffeine absence and
  L-citrulline while omitting the unresolved beta-alanine and creatine facts.
  It exposes neither private URI nor reviewer metadata. The current in-stock
  exact variant qualifies at
  `https://www.supplementscout.co.uk/search?q=pre%20workout&caffeine=free`,
  under the existing one-card-per-product grouping.
- Fresh production reconciliation finds 68 distinct active pre-workout variants
  with applied facts. The frozen pilot is 9 complete, 3 partial (`3676`, `3759`,
  `3763`) and 13 without applied facts. Batch 06 is `LIVE VERIFIED`; NUT-03 and
  MVP remain `IN PROGRESS`.
- Machine-readable execution and design evidence is
  [nutrition-catalog-expansion-batch-06-execution-2026-09-13.json](rollouts/nutrition-catalog-expansion-batch-06-execution-2026-09-13.json),
  SHA-256
  `462674f21468625f3b73d685f1ffe6a1ec37b58cd771b8bc0e2641a14ebead5e`.

## NUT-03 multi-component citrulline extension design and implementation

13 September 2026, design only; no code, migration or candidate/catalogue write:

- The retained Batch 05 tables identify exactly nine affected variants:
  product `1250`, variants `3672`, `3721`, `3722`; product `1254`, variants
  `3676`, `3725`, `3726`; and product `1279`, variants `3759`, `3894`, `3895`.
  Every table declares separate masses for citrulline malate and L-citrulline
  against one serving. None gives only an aggregate blend mass, and none states
  a malate ratio. These sources must be reused; no collection rerun is needed.
- The smallest forward-compatible model adds one allowed candidate field,
  `citrulline_component_per_serving_mg`, without a new table or column. One
  candidate represents one declared component and reuses the current exact
  variant, durable source, hash, source quantity/unit, serving basis, form,
  optional ratio, fingerprint and approval columns. Component rows require
  `present_with_amount`; the existing singular citrulline field continues to
  represent the five information states, including absence, unknown and
  conflict. New forward-only CHECK changes must remain NULL-safe with `IS TRUE`.
- Review stays individual. The planner groups approved components for one exact
  variant into a deterministically ordered `nutrition_override.citrulline_components`
  array. It must reject duplicate form/ratio entries, different serving bases or
  source revisions, and an unreviewed mix of singular and plural citrulline. It
  never sums compound and free-form masses into pure L-citrulline.
- Apply retains current before-state, exact-variant, evidence, approval and replay
  guards. Existing singular citrulline facts are neither backfilled nor
  reinterpreted. A later plan for these nine variants may add only the component
  array while retaining every current override field.
- Public presentation reconstructs each component against its own approved,
  applied candidate and renders separate lines under the shared serving. It
  continues to hide private URI and reviewer details and remains compatible with
  current singular citrulline records. No filter change is needed.
- Completion requires isolated pre/post-migration SQL tests for NULL and partial
  rows, store/review invalidation tests, deterministic planner conflicts, exact
  apply and replay tests, public evidence reconstruction and existing singular-
  fact regression coverage. Required project gates must pass. Production
  migration and candidate execution for the nine variants each require separate
  authorization.

The implementation authorized on 13 September 2026 completes the bounded code
and isolated-test step:

- Candidate storage, authenticated individual review, deterministic planning,
  controlled apply and the existing product presentation now recognize
  `citrulline_component_per_serving_mg` and
  `nutrition_override.citrulline_components`. No second importer, queue, panel
  or public route was created.
- Each planned component retains its declared mass and source unit, form,
  optional malate ratio, exact variant, durable source evidence and full serving
  wording, including approximation qualifiers. Fingerprints remain component-
  specific. Reviewed evidence is immutable, and apply rechecks approval,
  fingerprint, source, serving and before-state values.
- A component set requires at least two distinct form/ratio identities and one
  serving plus source-recipe context. The planner blocks mismatched contexts,
  duplicates and implicit singular-to-components transitions. Public rendering
  fails closed if singular and component representations coexist, presents each
  component separately and never exposes private archive data.
- Forward-only migration
  `20260913110000_add_nutrition_candidate_citrulline_components.sql`, normalized
  SHA-256
  `76dd8390e19f45dd8ffcc69bafe9721abc6dedff6db280fdc6f75e3938258ac4`,
  changes only the three existing candidate CHECK constraints. Direct PostgreSQL
  tests prove pre-migration component rejection, post-migration NULL-safe shape
  checks, two-component storage, immutable reviewed evidence, duplicate-safe
  retry and the unchanged legacy path. The controlled production selector now
  reports this file as its only pending production migration.
- Focused nutrition, admin and public-presentation tests pass (102/102); the
  isolated PostgreSQL test passes (1/1); selector tests pass (28/28);
  `verify:quick` and the final `verify:full` pass. The first `verify:full` run correctly failed when the
  new migration had not yet been registered as pending; that deployment-contract
  omission was fixed before the final gate rerun.
- No production migration, candidate storage, review, plan, apply, catalogue
  write or `main` deployment occurred. The nine retained variants and their
  source artifacts remain unchanged.
- Machine-readable package:
  [nutrition-citrulline-components-implementation-2026-09-13.json](rollouts/nutrition-citrulline-components-implementation-2026-09-13.json),
  SHA-256
  `374eccadbfea30668ec619094058cff33a8fde51929252bc74d7f31c61f17ad1`.

### Production rollout and 18-candidate preparation

Owner authorization on 13 September 2026 completed the bounded rollout while
retaining a separate data-write gate:

- Full commit `e013facbc3bf708b810a6442e2604deb9c423cb7` was fast-forwarded
  to `main`. The implementation package retained SHA-256
  `374eccadbfea30668ec619094058cff33a8fde51929252bc74d7f31c61f17ad1`.
  `verify:project`, `verify:quick` and final `verify:full` passed; Vercel
  production deployment `6421420844` succeeded for the exact commit.
- Before migration, the existing 1,018-row queue and authenticated review panel
  remained readable. The panel returned HTTP 200 in a real authenticated session,
  showed pending and approved sections and no schema-unavailable notice.
- The production selector identified exactly
  `20260913110000_add_nutrition_candidate_citrulline_components.sql`, normalized
  SHA-256 `76dd8390e19f45dd8ffcc69bafe9721abc6dedff6db280fdc6f75e3938258ac4`,
  as pending. Its CLI dry-run showed one migration; controlled apply executed
  only that file. Fresh readback found history version `20260913110000` and all
  three recreated, validated CHECKs containing the component field and ending
  in `IS TRUE`.
- Pre/post hashes match for all 1,018 queue rows, 170 batch items, products
  `1250`/`1254`/`1279`, their nine target variants and every catalogue count.
  The authenticated panel passed again after migration. These production reads
  prove schema and availability; isolated PostgreSQL tests remain the evidence
  for write behavior. No candidate or catalogue data changed.
- The retained three archived Bulk tables were reused without network or storage
  writes. The ignored artifact at
  `tmp/nutrition-citrulline-components-2026-09-13/candidate-artifact/nutrition-candidates-ncr1-citrulline-components-bulk-1250-1254-1279-20260913.json`
  has SHA-256 `88e70433f68c802f59e48c145b72ac8c8ffdb90f03fb6f4e3400132ad3bb3474`,
  artifact fingerprint `62eaed138ac27509fce9c620f4d142060e5b2a0503b59ea2cf0b86a44f245973`
  and 18 unique component fingerprints. It preserves two components per exact
  variant: products `1250` and `1279` use 2.5 g citrulline malate plus 500 mg
  L-citrulline per approximately 17 g; product `1254` uses 3 g malate plus 2 g
  L-citrulline per approximately 22.5 g. No source states a malate ratio.
- `nutrition:candidates:store --dry-run` returned `DRY_RUN_NO_DATABASE`, 18 rows,
  zero product updates and zero writes. Store, review, plan and apply were not
  authorized or run. Machine-readable evidence is
  [nutrition-citrulline-components-production-rollout-2026-09-13.json](rollouts/nutrition-citrulline-components-production-rollout-2026-09-13.json),
  SHA-256 `a28a69cfb2a95bae1c2f0b2faddde23812bd08af74e50d45dd3b3fce6ddd8e94`.

### Controlled execution of the 18 component candidates

Owner authorization on 13 September 2026 carried the unchanged package through
the existing production path:

- Preflight reconfirmed production project `aftboxmrdgyhizicfsfu`, the deployed
  component migration, all nine product/variant bindings, 18 unique candidate
  fingerprints and zero existing rows for the artifact fingerprint. Fresh
  private-archive reads matched all three retained source hashes; no source was
  downloaded or copied again.
- The existing store inserted candidates `1019`-`1036` and changed zero product
  rows. Authenticated individual review approved those exact rows with their
  original amounts, forms, approximate serving text, private URI, source hash
  and locators unchanged. Each fingerprint exists exactly once.
- The explicit-ID planner produced one zero-blocker plan at
  `tmp/nutrition-approved-plan/NCR1-citrulline-components-bulk-1250-1254-1279-20260913-45f8c3ae73b2.json`,
  SHA-256 `5a7a91ef9b29c5fe0266e2c400525decc7c51d6b071fe702c8d877ef37a21a2f`,
  fingerprint `45f8c3ae73b2a98c930366ee080c73d8a92ec4b0a68714027fdaf45c493d0e03`.
  Its nine updates add only `citrulline_components`; every earlier override fact
  remains in the complete `after` value.
- Controlled apply updated those nine overrides and zero products. Audit SHA-256
  is `a65ffe3ea840a2e1e06227d3bf6efde519bc029edc2dadb7de20e30e4265a735`.
  A separate read-only connection matched every whole override to the sealed
  `after`, retained all 18 approvals and evidence records, and matched preflight
  hashes for the complete products table, all other variants, target metadata
  outside the override and every queue row outside this package.
- All nine public exact-variant pages return 200 and separately display the
  declared malate and free-form L-citrulline amounts with the source's
  approximate serving. They do not show a summed pure-L-citrulline value,
  private URI or reviewer metadata. The caffeine-free search still returns one
  grouped product `1279` card linked to current in-stock variant `3759`; products
  `1250` and `1254` remain excluded.
- The distinct applied pre-workout total remains 68 because these nine variants
  already had other facts. Frozen-pilot variants `3676` and `3759` move from
  partial to complete. The pilot is now 11 complete, one partial (`3763`) and
  13 without applied facts. This completes the component data package, while
  NUT-03 and MVP remain `IN PROGRESS`.
- Machine-readable execution evidence is
  [nutrition-citrulline-components-execution-2026-09-13.json](rollouts/nutrition-citrulline-components-execution-2026-09-13.json),
  SHA-256 `039700542740b1b426678162da6eaa37608ad9bb4b4a25239c32a8cdec112134`.

## NUT-03 catalogue expansion batch 07 preparation

13 September 2026, preparation only; no candidate, review, plan, apply or
catalogue write:

- A fresh read-only production snapshot confirms 575 active Pre Workout
  variants and 404 with at least one in-stock offer checked within 24 hours.
  Current-offer coverage is 56 complete, four partial and 344 without applied
  facts. The all-offer-state applied total remains 68. The frozen pilot remains
  11 complete, one partial (`3763`) and 13 without applied facts.
- The nine variants whose only former blocker was separately quantified
  citrulline components (`3672`, `3721`, `3722`, `3676`, `3725`, `3726`,
  `3759`, `3894`, `3895`) already have those components applied. They were
  excluded; zero further variants remain blocked solely by the retired model
  limitation.
- The closed scope reaches the 50-variant organizational cap across eight
  product families. Two exact variants are ready as partial packages: TWP
  Hustle 520 g product `1282`, Bubblegum Grape variant `3762` and Pink Lemonade
  variant `3870`. The official page lists both under the 40 Servings selector
  and embeds one common `Hustle V2 2025` Supplement Facts table. The 13 g column
  is used; the 26 g / 20-serving column is not mixed into these variants.
- Each ready variant has four pending proposals: `serving_size_g=13`, caffeine
  150 mg, beta-alanine 1600 mg sourced as 1.60 g, and free-form L-citrulline
  4000 mg sourced as 4.00 g, all per the 13 g serving. The official material
  does not explicitly confirm creatine absence, so creatine remains unresolved
  and no zero or absence candidate was fabricated. Thus two variants are ready
  partially and zero resolve all four tracked ingredient states.
- Official TWP Terms & Conditions contain no decisive prohibition on the
  retained use, and `robots.txt` allows the public product and page paths used.
  Duplicate preflight found no existing content-addressed object. The current
  page, current V2 table, terms, robots and source-context manifest were stored
  once in private `nutrition-sources`; fresh readback reproduced all five hashes.
  Retention has no automatic expiry and is not described as an independent
  backup.
- The ignored candidate artifact is
  `tmp/nutrition-catalog-batch-07-2026-09-13/candidate-artifact/nutrition-candidates-ncr1-catalog-batch-07-twp-1282-20260913.json`,
  SHA-256 `3b92426c5158d24d56038867daf0cbc5b3b594e041e39891270a8b49367e82de`,
  artifact fingerprint
  `d013169f03a7bb50d22624c15d866411c8e79877cc424bd8617b1d28213b4219`.
  Its eight candidate fingerprints are unique. Existing
  `nutrition:candidates:store --dry-run` returns `DRY_RUN_NO_DATABASE`, eight
  candidate rows, zero product updates and zero database writes.
- The other 48 variants are isolated by their manufacturers' current terms:
  23 Naughty Boy variants prohibit copying and automated extraction, nine
  Redcon1 variants prohibit commercial copying, six PEScience variants prohibit
  automated extraction and commercial use, four Time4 Nutrition variants
  prohibit reproduction, four Animal variants require written permission for
  copying or scraping, and two Skill Nutrition variants require written
  permission for copying. No blocked source was downloaded or archived.
- Complete machine-readable evidence is
  [nutrition-catalog-expansion-batch-07-preparation-2026-09-13.json](rollouts/nutrition-catalog-expansion-batch-07-preparation-2026-09-13.json),
  SHA-256 `febacd4f4ffb3a410e5235d589c0056b75211bfa2452b97b46fc9b5be51bbc44`.
  NUT-03 and the MVP remain `IN PROGRESS`.

One next step is one owner decision on controlled store -> authenticated review
-> explicit-ID plan -> apply for exactly the unchanged eight TWP candidates of
variants `3762` and `3870`; creatine and all 48 blocked variants remain outside
that decision.

## NUT-03 retailer-source batch 01 preparation

13 September 2026, preparation and private source retention only; no candidate,
review, plan, apply or catalogue write:

- A fresh read-only production snapshot confirms project
  `aftboxmrdgyhizicfsfu`, 575 active Pre Workout variants, 404 with a current
  in-stock offer and 68 variants with any applied override. Current-offer
  coverage is 56 complete, four partial and 344 without applied facts. Batch 07
  variants `3762` and `3870` still have empty overrides; that prepared TWP
  package remains separate and was excluded.
- Retailer evidence is now an allowed fallback under the process rules. A
  readable manufacturer label hosted by a retailer is recorded separately from
  a retailer-authored active table. Each source must bind the product version,
  market, pack, serving and exact variant context. A second retailer is used for
  comparison when accessible, but copied content is not independent evidence and
  its absence does not block a readable exact-version table. Each retailer's
  terms and robots rules apply independently; catalogue or affiliate presence is
  not blanket copying permission.
- The closed review assessed 48 current-offer, previously unapplied variants in
  seven families. Three qualifying retailer tables support 19 partial variants:
  product `778` variants `972`, `1978`, `4082`, `4084`, `4088`, `4089`;
  product `763` variants `920`, `921`, `4100`, `4102`-`4106`, `4108`; and
  product `903` variants `1499`-`1502`. These exact IDs remain strings.
- Product `778` uses one Ambiactive 390 g / 30-serving table: 13 g serving,
  200 mg caffeine, 3200 mg beta-alanine and 4000 mg free-form L-citrulline.
  Product `763` uses the one-scoop column of one Ambiactive Menace V2 420 g
  table: 7 g serving, 200 mg caffeine, 1600 mg beta-alanine and 3000 mg
  citrulline malate 2:1. Product `903` uses one Matrix Nutrition 300 g table:
  one level 12 g scoop, 350 mg caffeine, beta-alanine sourced as 3.2 g and
  citrulline malate sourced as 3.5 g; the malate ratio is not stated. No source
  explicitly confirms creatine absence, so creatine remains `no_information`
  for all 19 and no fifth candidate was fabricated.
- The two Ambiactive product pages and the Matrix Nutrition page, their reviewed
  terms and robots files, and one source-context manifest were content-addressed
  after a zero-duplicate precheck. Eight objects were written once to private
  `nutrition-sources`. Fresh readback reproduced every SHA-256, confirmed the
  bucket is private and found no automatic expiry. This retention is evidence
  storage, not a separate backup.
- Three ignored artifacts contain 24, 36 and 16 candidates respectively, 76
  unique candidate fingerprints in total. Each preserves the exact variant,
  retailer source type, original quantity/unit, serving basis, ingredient form,
  optional malate ratio, durable private URI and source hash. All remain
  `PENDING`. Three existing `nutrition:candidates:store --dry-run` executions
  returned `DRY_RUN_NO_DATABASE`, the expected row counts, zero product updates
  and zero database writes.
- The other 29 assessed variants retain concrete gaps: six Energy and two
  Menace flavours are absent from the qualifying retained flavour context; six
  PEScience sources have restrictive reuse terms; nine Redcon1 variants have a
  250 mg versus 320 mg formula-generation conflict; four Animal variants have
  conflicting pack and serving versions; and two Skill variants lack an exact
  flavour-table binding. Confirmed facts for the ready variants proceed without
  converting these omissions or conflicts into zeros.
- Complete evidence is
  [nutrition-retailer-source-batch-01-preparation-2026-09-13.json](rollouts/nutrition-retailer-source-batch-01-preparation-2026-09-13.json),
  SHA-256
  `144d7fa54accdd59236708e792465485cdbd3d87b2165b730f75e49bb9af90c4`.
  NUT-03 and the MVP remain `IN PROGRESS`.

## NUT-03 retailer-source batch 01 and Batch 07 controlled execution

13 September 2026, production store, authenticated review, explicit-ID planning,
guarded apply and independent readback:

- A fresh preflight reconfirmed production project `aftboxmrdgyhizicfsfu`, 68
  previously applied variants, 84 unique authorized fingerprints, zero existing
  target candidates and empty override objects for all 21 exact targets. Seven
  retained source objects were read from private `nutrition-sources`; every
  content hash matched and no source was collected again.
- Four existing dry-runs returned 24, 36, 16 and eight valid rows with zero
  product updates and zero writes. Controlled store created candidates
  `1037`-`1120`. Authenticated review approved all 84 with their exact original
  quantities, forms, ratios, servings, source types, archive references and
  hashes unchanged. Each fingerprint exists once.
- The explicit-ID planner produced four zero-blocker, zero-product-update plans:
  product `778` plan SHA-256
  `3ac15500c8f3cf08d015d864db1fa4731fe9698c16903e70e4de15242889295c`,
  fingerprint
  `e29d150c5841a1e44b21edaeaf13d70c51434a84171cd3bcf72a1fad76fe627b`;
  product `763` SHA-256
  `400a54c95d591373e5a56181048f685b47cf8258c4ff45d9981e1c8b2f48c196`,
  fingerprint
  `ffd4689893ee0210af5c3760ac7f03eaee68480e3952c1e5fc76f05de1b071d3`;
  product `903` SHA-256
  `5b8309f40f080a85661a9880111b4ff7701b4a554410230c07e5bb81eef5a57f`,
  fingerprint
  `ab36d7811bd39ce91f8730f809ddcf8e1f0721c842031792f83f3732060e141`;
  and product `1282` SHA-256
  `346f856053da519cdb5cad8e1fbde2dcf04f2ad5c085def8409ae8d691402c98`,
  fingerprint
  `c6fbf86c32d91cc400f616918dcf5c3fb4ccb388265d6f85c6f177d2e677888e`.
- Controlled apply changed only the 21 listed `nutrition_override` objects and
  zero products. A new read-only connection matched every complete override to
  its sealed `after`, retained all approval and source evidence, preserved the
  whole product table, every other variant, target metadata outside the override
  and every non-target queue record. The distinct applied total is now 89.
- Replaying each exact plan was safely rejected because the first target no
  longer matched its sealed empty `before`. A subsequent read proved zero extra
  writes and the same final state. All 21 public exact-variant pages and variant
  selection checks pass. Retailer facts show `Retailer source`, TWP facts show
  `Product label`, private archive URIs and reviewer metadata are absent, and
  none of these caffeine-containing variants enters the caffeine-free filter.
- Current-offer coverage at `2026-09-13T15:57:50.729Z` is 404 exact variants:
  56 complete, 25 partial and 323 without applied facts. All 21 new targets are
  partial because creatine remains unresolved; they are not described as fully
  covered. The frozen pilot and Stinger denominators do not change.
- The public provenance correction needed for the retailer package is deployed
  as commit `deddb189b2ce2c916b12dadd4aae4e17d0c1567c`; Vercel production
  deployment `6422622639` is successful. Focused nutrition tests and
  `verify:quick` pass. `verify:full` remains explicitly non-green because the
  existing unrelated Whey Okay evidence hash and OstroVit line-ending fixture
  tests fail; neither fixture was changed here.
- Complete machine-readable evidence is
  [nutrition-retailer-and-batch-07-execution-2026-09-13.json](rollouts/nutrition-retailer-and-batch-07-execution-2026-09-13.json).

One next step is to answer the grouped owner questions in
[nutrition-owner-manual-verification-questions-2026-09-13.md](rollouts/nutrition-owner-manual-verification-questions-2026-09-13.md),
starting with exact families where one creatine answer can complete the most
current-offer variants. Do not repeat the recorded blocked-source audits without
new evidence or permission.

## NUT-03 creatine-absence completion package for 23 applied variants

13 September 2026, evidence preparation complete; production candidate store
blocked before execution by the automatic approval control:

- The owner answered the first four grouped composition questions after checking
  complete declared compositions. This is a project-owner review statement, not
  a statement by Naughty Boy, Nutrend or Time 4 Nutrition and not a laboratory
  result. The evidence rule now permits `confirmed_absent` from a complete
  exact-formula declaration that names neither creatine nor any form and contains
  no undisclosed blend; a partial-table omission still cannot prove absence.
- Fresh production preflight confirmed project `aftboxmrdgyhizicfsfu`, 89
  applied variants and all 23 exact active bindings: product `763` variants
  `920`, `921`, `4100`, `4102`-`4106`, `4108`; product `778` variants `972`,
  `1978`, `4082`, `4084`, `4088`, `4089`; product `528` variants `976`, `977`,
  `1847`, `1848`; and product `903` variants `1499`-`1502`. No new fingerprint
  existed and no target had a conflicting approved creatine-presence fact.
- Existing archived full compositions qualify for products `763`, `778` and
  `528`. The official Time 4 300 g page was read once and confirmed separate
  Candyfloss, Bubble Gum, Tropical and Raspberryade lists, a shared 12 g serving
  context and no creatine form. Because the prior access review records a site
  reproduction restriction, the raw page remains local only; a bounded factual
  review record was archived instead of copying the full page.
- Three new evidence records were written once to private `nutrition-sources`
  after a zero-duplicate precheck: project-owner attestation SHA-256
  `d9fd76614f2cbf90e937d925922b8185296e3ff019127e45fea090fcff003d5b`,
  Time 4 review SHA-256
  `b5d5e3a96083f635990104e5aa3b507d08d67c0949ae186c351b38c6c506b049`
  and context manifest SHA-256
  `71c9ca4865eae5760b69b9efa0164b072fc00afb1d0a7656e86a5006e3a818c6`.
  Upload readback matched all three hashes and the previously archived source
  hashes; the bucket is private.
- Four ignored artifacts contain exactly 23 unique pending fingerprints, one
  `creatine_declared_form_per_serving_mg` proposal per exact variant. Every fact
  is `confirmed_absent` with null numeric value, unit, serving quantity and form.
  Their SHA-256 values are `6785d6d3a8280c26b70432e4fe7a3a584743f39bb09a6898efa138f661aa02a5`
  (product `528`), `c093ca26df1fcf0eca94496fd02fcb4d49a166fdeff7d4b35bab73f32f04995b`
  (`763`), `7a6dfa557f9b5ad4d5491cfe38f244665542219f10814983dcb6660900017a7f`
  (`778`) and `a8f02c729aae97d64e8cef0e2297f16c116affe42bc41d03fafbbb1c4c710aa3`
  (`903`). All four store dry-runs passed with zero product updates and zero
  database writes.
- The first production store command, starting with product `528`, was rejected
  before execution by automatic approval review. It treated product `528` as
  outside the previous 84-candidate/21-variant authorization and required an
  explicit reauthorization after disclosure. The rejection must not be bypassed.
  Production remains unchanged: none of the 23 candidates was stored, reviewed,
  planned or applied; applied coverage remains 89.
- Machine-readable evidence is
  [nutrition-creatine-absence-23-preparation-2026-09-13.json](rollouts/nutrition-creatine-absence-23-preparation-2026-09-13.json).
  NUT-03 remains `IN PROGRESS`. One next step is explicit owner reauthorization
  after the rejection, followed by resumption at store without repeating source
  collection or package preparation.

## NUT-03 creatine-absence controlled execution for 23 existing variants

13 September 2026, new and separate owner authorization after the recorded
automatic-approval rejection:

- Fresh resume preflight reconfirmed production project
  `aftboxmrdgyhizicfsfu`, all 23 exact product-variant bindings, the four
  authorized artifact hashes, 23 unique fingerprints, zero existing matching
  candidates and no conflicting creatine-presence fact. Sources were not
  collected again. The malformed characters previously shown in two summary
  fingerprints were absent from the artifacts; direct artifact validation
  returned the complete hexadecimal fingerprints already recorded above.
- Controlled store created candidates `1121`-`1143`: product `528` IDs
  `1121`-`1124`, product `763` IDs `1125`-`1133`, product `778` IDs
  `1134`-`1139` and product `903` IDs `1140`-`1143`. Authenticated review
  approved all 23 with `approved_value=null`, `information_state` equal to
  `confirmed_absent`, and unchanged exact-variant, source, archive, hash and
  fingerprint evidence. The older four approved Nutrend `no_information`
  candidates remain in history.
- Four explicit-ID plans contain zero product updates and 23 variant updates,
  each changing only `nutrition_override.creatine`. Their SHA-256 / plan
  fingerprint pairs are: product `528`
  `ad9ccedbdffc4ce0fb870f74afc720712171494c00c5edbbe8dc6cd303a584a0` /
  `35242a0646ee0812aa793723b67a7393c6f72e01302c1a85cd87415d18e292aa`;
  product `763`
  `e47cee1d399054ebc9f5b9683da01e86e8acb7709921351892b45a20ae2459d0` /
  `fe19e8e607e54b35d000ee3b944c2a9e32fb8ec12aee712fd24ca8812499da42`;
  product `778`
  `87c37eb1f3ac80d7873f150d929bd4585f7846cf21a13a135c10525e497e75cc` /
  `94aed10160f81541b8d9df1010163cd4e93a67faff2610ac96da16ce022f21d5`;
  product `903`
  `f52c4102efaac713dd595b239d32c084087c582fca7a3e62f5b224d95cfa2b2f` /
  `cc7b4a8c984768a2e383cdd8ac73499b94e682e967e703e0775ba3f8dd2155bb`.
- Guarded apply succeeded for all four plans. It changed zero products and only
  the 23 authorized overrides. A new read-only connection matched every whole
  override to the sealed `after`, retained all approvals and evidence, and
  matched the preservation hashes for products, other variants, target metadata
  and non-target queue rows. Replaying each plan was safely rejected because its
  sealed `before` no longer matched; a subsequent read proved no additional
  write and an identical final state.
- All 23 public exact-variant pages return 200, select the requested variant and
  display creatine as `Confirmed absent`. Existing portion, caffeine,
  beta-alanine and citrulline facts remain visible. Retailer-backed facts keep
  the `Retailer source` label; the Nutrend and Time 4 facts use
  `Manufacturer source`. No private URI or reviewer metadata is exposed. The
  caffeine-free search still groups Nutrend as one product card and links to a
  qualifying current-offer variant; caffeine-containing targets remain absent.
- The distinct applied-variant counter remains 89 because all 23 variants were
  already counted. Current-offer coverage is 404 exact variants: 75 complete,
  six partial and 323 without applied facts. Frozen-pilot counts remain 11
  complete, one partial and 13 without applied facts. Owner questions 1-4 are
  closed; questions 5-19 remain available for later evidence-led work.
- Complete machine-readable evidence is
  [nutrition-creatine-absence-23-execution-2026-09-13.json](rollouts/nutrition-creatine-absence-23-execution-2026-09-13.json),
  SHA-256
  `14a5cbd5b1077af7a5337cacf69ecab655d4c8f9fc2ef6693b9278a4adb3cc9e`.
  `verify:project` passes. The latest `verify:full` remains explicitly non-green
  on the unchanged unrelated Whey Okay evidence-hash and OstroVit line-ending
  fixtures; it is not reported as passed.

NUT-03 remains `IN PROGRESS`. One next step is to use a new answer or retained
exact-formula proof for questions 5-19; do not repeat the completed questions
1-4 or the earlier blocked-source audits without new evidence.

## NUT-03 missing-ingredient completion for six existing variants

13 September 2026, new and separate owner authorization for ten facts:

- Fresh production preflight confirmed project `aftboxmrdgyhizicfsfu`, the six
  exact active product-variant bindings and the existing partial overrides. None
  of the ten new fingerprints existed. The distinct applied total was 89 before
  the operation and remains 89 because these variants were already counted.
- Retained complete declarations resolve the bounded questions. The Hustle V2
  2025 label contains no creatine form; each exact Muscle Moose flavour page
  contains neither beta-alanine nor a creatine form (`Tri-Methyl Glycine` is
  betaine); and the Apex label contains neither beta-alanine nor a creatine form
  (`Acetyl-L-Carnitine` is not creatine). No source contains an undisclosed blend
  that blocks these conclusions. The results are review inferences from declared
  compositions, not laboratory measurements or numeric zero claims.
- Five retained source objects were read back from private `nutrition-sources`
  with matching hashes. A bounded source-context manifest and the project-owner
  session review record were written once, then read back with SHA-256
  `5fb5ce88a4fcfe0b754bd63dc2bc9cd717e61db1efc46dea4b269c7d2d027146`
  and `3e690593d005836a386762ecaa11ab9edc15dec3e2acefa3984c16ca38c547b2`.
  The bucket remains private.
- Three ignored artifacts contain six, two and two candidates. Their SHA-256 /
  artifact fingerprint pairs are product `1247`
  `4c3941cc40c9261acade2c8ce2b0e566a0cfb8c94fd45e25399bdd92b021a4df` /
  `8e4a22cc8af35aedc66f918de7ef3df6a9d8bbd1cadc9caccb6ca814da7d8720`;
  product `1282`
  `3fac4cc319d6fcb8928751dfcadcd864cf0e228d87cd6c771cf9cbcf537db6e3` /
  `a2d69ec1b7d81ef3c64417d5c29f8a5fbd70dfb18205418ca9508f0ccdb906cb`;
  and product `1283`
  `a45803550fab3d24ad24f5820d325ba0c50e711956a44a207752456cc11664f9` /
  `6dce4ef3e2fd77a602dcec67c7ee2437b85a10c7792eb81894db50e371006c23`.
  All three dry-runs passed with ten rows total, zero product updates and zero
  database writes.
- Controlled store created candidates `1144`-`1153`. Authenticated review
  approved all ten as `confirmed_absent` with `approved_value=null`, preserving
  exact variant, source URI, hash and fingerprint evidence. Three explicit-ID,
  zero-product-update plans were sealed before apply: product `1247` SHA-256 /
  fingerprint `7a608b5dc532b738c2e4dc6780cc7105d4e235d817fa91467e622aaa36f56980` /
  `823b01f838ecf91717ae5956237f2f8b15f74ddf9e7101c6023cb1a7e7d1c1af`;
  product `1282`
  `a44000e3feb7fe728bd3a01aa5e348cb09092cf6be6aef99de0292725bc9ad07` /
  `b87ac661defc1a2f90ac65213f0d47869d42e8ca4397e3f480cdb46958abe8dc`;
  and product `1283`
  `6a224ea82dc05055d07aa938ac5dc133ea19e59c527f5ee504429724fe2b51c7` /
  `27b0cb7ad6d5539c20eec50a2f6250f57ff4782d75196ccd7aef75f4412bad4f`.
- Guarded apply changed zero products and exactly ten facts in six target
  `nutrition_override` objects. A new read-only connection matched every whole
  override to the sealed `after`, preserved all approvals, evidence,
  `nutrition_verified`, legacy creatine fields, all other variants and non-target
  queue records. Replaying each plan was safely rejected because its sealed
  `before` no longer matched; the final state remained unchanged.
- All six public exact-variant pages show the new confirmed absences and preserve
  their existing serving, caffeine and citrulline facts. TWP also preserves its
  beta-alanine fact. Private archive URIs and reviewer metadata are absent. Only
  caffeine-free Apex variant `3763` qualifies among these targets; TWP and
  Muscle Moose remain excluded. All six have current offers.
- Current-offer coverage is 404 exact variants: 81 complete, zero partial and
  323 without applied facts. The frozen pilot is 12 complete, zero partial and
  13 without applied facts. Questions 6, 9 and 11 in the grouped owner list are
  now closed.
- Complete machine-readable evidence is
  [nutrition-missing-ingredients-10-execution-2026-09-13.json](rollouts/nutrition-missing-ingredients-10-execution-2026-09-13.json),
  SHA-256 `641840e1afa3080067bc9ef978da4c72402159af8bcddb04e008994602f04003`.
  `verify:project` passes before and after the documentation update. The latest
  `verify:full` remains explicitly non-green on the unchanged unrelated Whey
  Okay evidence-hash and OstroVit line-ending fixtures; it was not rerun or
  reported as passed.

NUT-03 remains `IN PROGRESS`. One next step is a new evidence-backed unresolved
owner question or another bounded nutrition package; do not recount these six
variants or repeat their completed evidence review.

## NUT-03 owner-image handoff batch preparation

14 September 2026, preparation and private archival only:

- `C:/Users/gogym/Downloads/SupplementScout-nutrition-25-images-2026-09-14.zip`
  matched the owner-supplied SHA-256
  `94bb145533696ec19042d3a0596385f77d7e58a3164629ca08b5cccab3366956`.
  Safe extraction created `tmp/nutrition-25-images-2026-09-14` without replacing
  any existing file. `README.md`, `manifest.json` and every original were read;
  all 25 declared file hashes and sizes match. Manual image review treated the
  preliminary transcription only as an index. There are 24 unique images: the
  two Defib files share SHA-256
  `58ce9cab462e18d5007d0619d12c2b693f0909f8f0d04cdfd73c4bf5cb788449`.
- Fresh read-only production preflight at `2026-09-14T06:22:14.195Z` confirmed
  project `aftboxmrdgyhizicfsfu`, 89 previously applied pre-workout variants,
  exact catalogue bindings for the assessed scope, zero existing candidates and
  empty overrides for all 114 checked variants from the 15 requested product
  IDs. The production snapshot SHA-256 is
  `e25ae925aab2490dcf3d1c14035d0cf3f451612b06aa4d788f3f4ef2656324f1`;
  the read made zero writes.
- Private archive duplicate checking found none of the 24 source hashes in the
  earlier 56 objects. The first upload stopped at the unsupported Markdown MIME
  after writing the images. The no-overwrite resume reused those 24 objects,
  added the handoff documents, and then added the reviewed source context.
  A fresh process read 27 objects with matching hashes and confirmed the bucket
  remains private. The source-context manifest is
  `tmp/nutrition-25-images-2026-09-14/source-context-manifest.json`, SHA-256
  `7c35a028450698a8a827791bf1f19326cd475def8f0ba7a052a4ceb87bfe5144`,
  archived at its content-addressed `nutrition-sources` URI. Archive storage is
  not represented as a backup.
- The closed organizational scope contains 47 current-offer exact variants and
  199 candidate facts across seven product families. Product `789` contributes
  variants `1084`, `1085`, `1087`-`1092`, `1137`, `3594`; product `882`
  variants `1396`-`1398`, `1400`, `1401`, `1403`-`1406`; product `1280`
  variants `3760`, `3856`, `3996`-`4009`; product `761` variants `907`, `909`;
  product `24` variants `1004`, `1581`-`1585`; product `1061` variants `2235`-
  `2237`; and product `1178` exact Ice Burst variant `3524`. All IDs remain
  strings and each candidate retains its exact variant, immutable source hash
  and private archive URI.
- Twenty-three variants are complete for caffeine, beta-alanine, citrulline and
  creatine: the ten product `789` variants, nine product `882` variants, three
  product `1061` variants and exact product `1178` variant `3524`. The remaining
  24 are deliberately partial: 16 Yeti variants omit unresolved total caffeine,
  two Proven variants omit caffeine because coffee-fruit extract prevents an
  absence inference, and six PEScience variants retain only serving and the
  retailer's explicit beta-alanine-free declaration because active amounts are
  not visible. Compound values remain the masses declared for citrulline malate
  or creatine monohydrate; no conversion to pure ingredients was made.
- Seven artifacts contain 12, 8, 50, 45, 15, 5 and 64 rows. Their SHA-256 /
  artifact fingerprint pairs are: product `24`
  `4c31a314ce379e3cef476acf6a77723bc5619b09757940937b13235a0904dc1e` /
  `feab539533515676225ac8378a27d3a8c6b7c6d80c043a020fa7e5028e1fc277`;
  product `761`
  `a5d1dcd4130352ebe5a50d35fb661fe4c16c0e6ded751a92c93b8acf3f1a3ca6` /
  `5320f67deb39052cb9bf70a7b43f1ad9e9c117d0a25351d1e5cfcfea00e408de`;
  product `789`
  `6a0277055e678296ad972dc9b736628b1d085aa50e60fbf1ece729acd67e5a18` /
  `0c753592dfcd71a83dc96c746fce15ccdd6dc5333dd3493a44280631dbc963e2`;
  product `882`
  `bd6101fc385fa2fdd8afb5c291d8d127e2ca41dd957bb027096187a64ab874e9` /
  `a678860194db2668b078c8e159d4540e2a682d85923c6684a562292239cf498d`;
  product `1061`
  `642144ac7c028980c8fecacc5a2c1b6a639516cfcb98967973149a7f36e7faa3` /
  `eb8b5146a0fe0414b3c4ada57ff967f18b1bfa7b06f889206352d8b2f99ae3d4`;
  product `1178`
  `3c68e99d0d8bbcd58f71f0494c23d8be232a08a18151df3e25f833ca37dd1ecc` /
  `d411c6835777e2239e6a0a46eb4ed6630d5a58e2f5f02d1a047c80b4344d5cc9`;
  and product `1280`
  `26a9537a6f1b4cc29ca5267e4f44d9e58fbdfbbefb1fb1c56a593ea62f36acd3` /
  `7f2b2c38fdd41dda8760d47c2d08f5e1774e3562ec0a9c03f59cf2132cbc9868`.
  Every candidate fingerprint is unique across the package.
- `nutrition:candidates:store --dry-run` passed separately for all seven
  artifacts: 199 candidate rows total, zero product updates and zero database
  writes. The result file SHA-256 is
  `55752488b8b6a3dc725bc87c0b4e617aa42aba54506c2b6217f9870d0315b4b3`.
  `verify:project` passed before this status change. No code changed, so the
  code-only quick/full suites were not repeated.
- Eight families remain outside the ready package. Total War has conflicting
  400/441/447 g version evidence and unresolved caffeine yield; Ibiza has an
  incoherent serving header and flavour mismatch; Defib lacks exact V3/catalogue
  flavour-pack binding; Animal's 16.1 g × 30 declaration does not establish the
  catalogue 491 g version; Skill supplies 412 g Strawberry Pineapple rather than
  the two 400 g catalogue flavours; Liberty conflicts on approximately 15 g
  versus 16 g and does not bind Grape; Presidential does not bind its table to
  Orange Creamsicle; and no image for product `1245` occurs in this handoff.

Complete evidence is
[nutrition-owner-images-batch-preparation-2026-09-14.json](rollouts/nutrition-owner-images-batch-preparation-2026-09-14.json),
SHA-256 `5203fd0f412ca1e54af1895c4b98e089a5fa33b69d30e612b0a070527551c680`.
At this preparation checkpoint no candidate store, review, plan or apply had
been performed and applied coverage remained 89. The controlled execution below
supersedes that pending-decision status while retaining every partial-field
exclusion.

## NUT-03 owner-image handoff controlled execution

14 September 2026, production project `aftboxmrdgyhizicfsfu`:

- Fresh pre-store readback reconfirmed 89 applied pre-workout variants, all 47
  exact active product-variant bindings, empty target overrides and zero target
  candidates. All seven authorized artifact hashes, artifact fingerprints and
  199 unique candidate fingerprints matched the preparation report.
- Controlled store created exactly candidates `1154`-`1352`. Authenticated
  review approved all 199 through the existing admin route with the expected
  numeric value or null absence value, review identity `admin-panel`, and
  unchanged state, form, ratio, serving, source hash, archive URI and candidate
  fingerprint. Each fingerprint exists once.
- Seven explicit-ID plans had zero blockers and zero product updates. Their
  SHA-256 / plan fingerprint pairs are product `24`
  `3b121e97df48f2220593398e676b27b4dca95ff3f10c8e3bd2b4d2c4f8e84207` /
  `2aa0bf5d1e7a9322dc0dffa2c0c4a6aea36ef40ccbb4be6db0a088e32c917a30`;
  product `761`
  `268e44ff0500a434b7b2e1fd277e159d7564f1133a6b902e8042997d0513a908` /
  `3416c73a8ccab8a1350df7ff1951c1e15892329949ff0f3a1106b0e86b018b68`;
  product `789`
  `a53883d49d40d86bedb84143e194e69cbbd51703ead3b181daa15dc895c6179d` /
  `d5c4ae4cae011e60a24d2a57692b60e9bb19db3fd5c20d24fd90c22b02809d2a`;
  product `882`
  `fb012aa58ae1bdd179bec37f86022762d30b4be8f05abe882c0a3d66e6c5abd6` /
  `b489cb8b5ad106f124c270093bce5e34bb4035e471a92e5d34aab586f8f0c185`;
  product `1061`
  `dcbab3ef7fd103a8d4981187262738f8ac75129d8b27ee956db203ed91494647` /
  `7cb6ccb7cf9ca01920f45562553eb9403508888870ae4a7a1d696dabbe878a90`;
  product `1178`
  `16c3fb18f5c7ebe9b1336c47b16c67a4bfff754ca8ab0634eb5bce7e202186ff` /
  `cd35181fd14710498569f734545e07840387f95ad6355a954652331cd0f75fdc`;
  and product `1280`
  `46146bbf8263e2044f6c5780439e1808bddfe4519c15d0b177e863cb9953d546` /
  `d90e14d461dd356e62c5709c681fb733c1410c19f62a2cdbb5032b6b0161b42a`.
- The automatic approval control rejected the first apply attempt before command
  execution because the earlier authorization did not enumerate these exact
  plans and variants. After the owner explicitly authorized all seven listed
  plan hashes, fingerprints and 47 variants, a new pre-apply read confirmed the
  same sealed `before` state and all approvals. No rejected apply changed data.
- Guarded apply then changed zero products and only the 47 authorized
  `product_variants.nutrition_override` objects. A new read-only connection
  matched every complete override to its plan `after`, retained all 199
  approvals and their evidence, and matched preservation hashes for the whole
  product table, every non-target variant, target metadata including
  `nutrition_verified` and legacy creatine fields, and the non-target candidate
  queue.
- Replaying all seven exact plans was safely rejected because each target no
  longer matched its sealed empty `before`. A subsequent independent read
  matched the same final state and confirmed zero additional writes.
- All 47 public exact-variant pages return 200, select the requested variant and
  display exactly the applied supported facts. Unresolved fields remain absent.
  Public source labels distinguish `Manufacturer source` and `Retailer source`;
  private archive URIs and reviewer metadata are absent. Every target retains a
  current offer. In the caffeine-free result, the only qualifying target is
  exact NXT variant `3524`; repeated anchors inside its single grouped product
  card resolve to that same variant ID.
- The distinct applied pre-workout total is now 136. Current-offer coverage at
  `2026-09-14T07:21:04.038Z` is 404 exact variants: 104 complete, 24 partial and
  276 without applied facts. The frozen pilot remains 12 complete, zero partial
  and 13 without applied facts; Stinger remains a separate demonstration.

Complete machine-readable evidence is
[nutrition-owner-images-batch-execution-2026-09-14.json](rollouts/nutrition-owner-images-batch-execution-2026-09-14.json),
SHA-256 `01bcb47cc46fac726bab30e549214edb350b1e224b34f9ab1bb198de6248f7ae`.
NUT-03 remains `IN PROGRESS`. One next step is to resolve one of the retained
recipe, serving, pack, flavour-binding or caffeine-yield gaps with new evidence;
do not repeat this completed 47-variant execution.

## NUT-03 targeted public-source gap completion preparation

14 September 2026, public-source collection, private evidence retention and
candidate dry-run only:

- Fresh read-only production preflight reconfirmed project
  `aftboxmrdgyhizicfsfu`, 136 applied pre-workout variants and all 13 selected
  exact product-variant bindings with current offers. Existing applied facts
  were excluded. The 43 new candidate fingerprints collide with none of the 20
  earlier target candidates; the read made zero database writes.
- The bounded package completes the remaining supported fields for six
  PEScience Prolific variants (`1004`, `1581`-`1585`), two HR Labs Proven
  variants (`907`, `909`) and three Animal Fury variants (`3671`, `3717`,
  `3720`). Two current Defib V3 variants (`2646`, `2649`) receive supported
  serving, caffeine, beta-alanine and creatine-absence proposals while
  citrulline remains explicitly unresolved.
- Prolific uses the current Dolphin 280 g common product page: 2 scoops / 14 g,
  caffeine 320 mg from the declared two forms, free-form L-citrulline 6 g and
  creatine `confirmed_absent` from the complete active plus Other Ingredients
  declaration. The already applied serving and beta-alanine absence are not
  repeated. Proven adds only caffeine `confirmed_absent`, based on the
  manufacturer's explicit stim-free/no-caffeine declaration; its four earlier
  facts are unchanged.
- Defib V3 proposes 2 scoops / 21 g, caffeine 400 mg, beta-alanine 3.2 g and
  creatine `confirmed_absent` from each target flavour's complete declaration.
  The page's “8 g Citrulline” wording does not identify whether that value is
  malate mass or L-citrulline yield, so no citrulline candidate was fabricated.
- The current Animal manufacturer page presents Blue Raspberry, Green Apple
  and Watermelon together with one formula. Combined with the retained literal
  16.1 g label serving, it supports caffeine 350 mg, beta-alanine 2 g,
  citrulline malate 6 g with no declared ratio and the manufacturer's explicit
  creatine-free state. Kiwi Lime remains excluded because it is absent from the
  current manufacturer flavour context.
- Access checks were enforced per source. Dolphin and HR Labs prohibit raw-page
  copying, so their pages were not archived; only project-authored bounded
  factual review records with source URLs and check dates were retained. The
  Animal product route is allowed by `robots.txt`, and its reviewed sales terms
  contain no separate copying or automated-extraction prohibition. The Animal
  page, product JSON, one manufacturer graphic, terms and robots file were
  retained once. Duplicate precheck found no matching object. Fresh readback
  reproduced all ten new object hashes and confirmed private
  `nutrition-sources` storage without automatic expiry.
- Four ignored artifacts contain 18, eight, two and 15 rows. Their SHA-256 /
  artifact fingerprint pairs are product `24`
  `7ced4a0643defe8589d717d26e23ed52c1d3d9098945231c25c3cff547ca54bf` /
  `17d1303a158032808828ad069d5ab7f8863f32956f2b62743a2d540afe54a2e9`;
  product `62`
  `a11fdf93915f52561c3d6817a4c3ba837e06924aecb98e20cb1b48dc70558891` /
  `752780727bdc2c8b3a70744de05ebf73f989122220c10d055f443dd094301af6`;
  product `761`
  `9e89ee845613ad076c44cd6114920fcab0cd69a281314a3ebfbcfa999448b7ef` /
  `f256d00a36acae26ad704848d8d9d1ce2a323f34296729c925024bc712991b03`;
  and product `1249`
  `553a45fc9f223633e90b35d3058e25ee96af57a39876984f44b97df3fdf2c976` /
  `b70359597b0f81b4bb77fd1a5a3ca7a3be85b05afc0b0d7a19e2d070734ae82a`.
  All 43 candidate fingerprints are unique.
- Four existing `nutrition:candidates:store --dry-run` validations pass with 43
  rows, zero product updates and zero database writes. No candidate was stored,
  reviewed, planned or applied. Applied coverage remains 136.
- Complete machine-readable evidence is
  [nutrition-gap-completion-preparation-2026-09-14.json](rollouts/nutrition-gap-completion-preparation-2026-09-14.json),
  SHA-256 `5c139e49da41be08d4815b694f88d6f09abc3f3bd721d9454b859acd9f754cba`.

NUT-03 remains `IN PROGRESS`. One next step is one explicit owner decision on
controlled store -> authenticated review -> explicit-ID plan -> apply for
exactly these four unchanged artifacts and 43 candidates. The unresolved Defib
citrulline, Animal Kiwi Lime, Yeti caffeine yield and the earlier recipe/pack/
flavour-binding gaps remain outside that decision.

## NUT-03 targeted public-source gap completion execution

14 September 2026, owner-authorized production store, review, plan and apply of
the unchanged 43-candidate preparation package:

- A fresh read-only production preflight confirmed project
  `aftboxmrdgyhizicfsfu`, the expected 136 applied variants, all 13 active exact
  product-variant bindings and zero matches for the 43 candidate fingerprints.
  The target overrides still matched the preparation state: six Prolific and
  two Proven variants retained their earlier partial facts, while both Defib V3
  and three Animal Fury targets remained empty.
- Controlled store created candidates `1353`-`1395` only in
  `nutrition_candidates`. A new read found exactly one row for every fingerprint
  and no catalogue change. Authenticated review through the existing admin route
  approved all 43 rows as `admin-panel`; a separate read matched every proposed
  and approved value, exact variant, durable archive URI, source hash,
  fingerprint and review timestamp.
- Explicit-ID planning produced four blocker-free plans with zero product
  updates. Product `24` plan SHA-256 / fingerprint is
  `b4592297905d8bb3dcf9d39cbb493befc503a053f0f05068dda08b9ea7ac73c3` /
  `c9aee8e4a25272eb1c4792c554dd57fa77604c74c83b13364aff8aaea3f8f354`;
  product `62` is
  `dc16e460321ff21331e29e93341075f10ce70e9b7eb5d81477cd8197c92a5b4c` /
  `8d4073b970dbd936ac74ee926205796902dd2dc9265dccbc681f450dadf98ff5`;
  product `761` is
  `f2101a18bf797dd003bc9ea529da3173e7dc6a26a1ebd351b836d9a22ed6d5a5` /
  `e155bd84b7a3a25a4ea56821d6c89454b68b362cebf980af8755aa2d96728ef0`;
  and product `1249` is
  `7628e71975d14e48dd8ef8c79a63ded50759ac80ddbe6499b19566a1b29a16c1` /
  `5c668518ff1af39640c5857216e71cdd8c49358e378bc9be2fd897af96daaa8e`.
- Guarded transactional apply changed zero products and only the planned 13
  `product_variants.nutrition_override` objects. A new forced-read-only
  connection matched every whole override to the corresponding plan `after`,
  retained all approvals and evidence, and matched preservation hashes for
  products, every other variant, target metadata and legacy fields, pre-existing
  target candidates and the non-target queue.
- Eleven targets are now complete for the four tracked ingredients plus serving:
  Prolific `1004`, `1581`-`1585`; Proven `907`, `909`; and Animal Fury `3671`,
  `3717`, `3720`. Defib V3 `2646` and `2649` are partial: their serving,
  caffeine, beta-alanine and creatine absence are applied, while citrulline stays
  unresolved because the source does not say whether 8 g is malate compound mass
  or L-citrulline yield.
- Replaying each exact plan was safely rejected on its changed sealed `before`.
  A subsequent independent read reproduced the complete final state, proving no
  second write. All 13 public exact-variant pages return 200, select the requested
  variant, show only the applied facts and expose neither private URI nor reviewer
  metadata. Source labels distinguish manufacturer and retailer evidence.
  Proven variants `907` and `909` qualify for caffeine-free search; existing
  product grouping renders one card linked to exact qualifying variant `907`.
- The distinct all-offer-state applied total is now 141. Current-offer coverage
  is 404 exact variants: 115 complete, 18 partial and 271 without applied facts.
  Frozen-pilot variant `3671` moves to complete, making the pilot 13 complete,
  zero partial and 12 without applied facts. Stinger remains one separate case.

Complete machine-readable evidence is
[nutrition-gap-completion-execution-2026-09-14.json](rollouts/nutrition-gap-completion-execution-2026-09-14.json).
NUT-03 remains `IN PROGRESS`. One next step is to resolve Defib V3 citrulline only
after obtaining an exact compound-mass-versus-yield statement, or continue with
another family supported by new exact evidence; do not repeat the exhausted gap
searches.

## NUT-03 catalogue next-50 public-source preparation

14 September 2026, owner-directed public collection, private evidence retention
and candidate dry-run only:

- A fresh read-only production preflight confirmed 141 applied pre-workout
  variants, all 34 selected active exact product-variant bindings, a current
  offer for every selected variant, empty target overrides and no existing
  target candidates. No catalogue or candidate row was written.
- The closed organizational scope assessed 50 exact variants. Thirty-four are
  ready: 26 complete variants and eight partial Darkstims PRE V4 variants. Five
  artifacts contain 162 unique candidate fingerprints. The remaining 16 exact
  variants retain concrete flavour-formula, version, permission or pack gaps.
- Nine Warrior Rage variants use the current common 392 g / 45-serving
  manufacturer presentation: 1.5 scoops / 8.7 g, caffeine 300 mg,
  beta-alanine 1500 mg, citrulline malate 2:1 500 mg and creatine gluconate
  2560 mg. The quantities remain masses of the declared ingredient forms.
- Five DNFM new-flavour variants use the table that the manufacturer explicitly
  limits to Cherry Sweets, Rocket Lolly, Sherbet Razz, Strawberry Bubblegum and
  Orange & Mango Crush: 2 scoops / 16 g, caffeine 400 mg, beta-alanine 3500 mg,
  free-form L-citrulline 6000 mg and creatine `confirmed_absent`. Four older
  flavours remain outside the assignment.
- Three Pumpage variants use 1 scoop / 10 g, free-form L-citrulline 3000 mg and
  the complete stim-free declaration supporting `confirmed_absent` caffeine,
  beta-alanine and creatine. The source image was inspected manually; no OCR or
  new parser was used.
- Nine Cellucor C4 Original 30-serving variants use the current exact retailer
  offer and its published active table plus complete ingredients list: 1 level
  scoop / 6.8 g, caffeine 150 mg, beta-alanine 1600 mg, citrulline
  `confirmed_absent` and creatine monohydrate 1500 mg. The source remains
  labelled as retailer evidence rather than manufacturer evidence.
- Eight Darkstims PRE V4 variants have supported serving 20 g, beta-alanine
  3500 mg, free-form L-citrulline 8000 mg and creatine `confirmed_absent`.
  Caffeine is intentionally omitted: the current pages conflict between a
  400 mg dual-source matrix and 362.5 mg total caffeine, while 150 mg
  di-caffeine-malate compound mass cannot be counted as 150 mg pure caffeine.
- Terms and robots rules were reviewed per domain. The bounded Warrior snapshot
  and six project-authored evidence/manifest records were stored once in the
  existing private `nutrition-sources` archive. TBJP and Darkstims raw pages and
  images were not designated for private archive because their terms prohibit
  scraping/copying. Independent archive readback reproduced all seven SHA-256
  hashes; the bucket remains private and objects do not expire automatically.
- All five `nutrition:candidates:store --dry-run` validations pass: 45, 25, 15,
  45 and 32 rows, respectively, with zero product updates and zero database
  writes. No production store, review, plan or apply occurred.

Artifact SHA-256 / fingerprint pairs are product `56`
`7463cc1faee0e7d4a5a9af1fe440bdcb35f9c9ff8ddf0d1aa0d3150b35b5fd04` /
`dc73e4c36795da8143b22c0bff760cb812b9854165ecff152221a4dc88dd2cfa`;
product `878`
`e6a366d73a45b63d07a260ffa3ef0251672687573fd0988767f1387c59ba7796` /
`1d76f6a8be4612236103e12aa7874648f1455ab868c8ea0a2cd71f52df58dec7`;
product `880`
`62968ac4e846cd9f5ec86c97148c6217344084379b8e8abedc003d2851997398` /
`f36f538c72ae3b3fdd9989795c8405b5e060f91dad3bcc01b17580652aa406e4`;
product `1169`
`3b1938d60c87d8f3d47bae16caa7d8b68f4d234254fc10a40d638e2b00a2d656` /
`44af97835da0f4c83778110caaf3a05cd6a47d7fb244ad9dc920c7d6f4610414`;
and product `1181`
`183d5b2e103b4c48b0f1d2dcc10c46074e5df49680e3a77e3276a6da68ceea23` /
`420eb821035295dc90180ea7c07d80bdcf95699a3f293068a666877d869a5a27`.

Complete machine-readable evidence is
[nutrition-catalog-next-50-preparation-2026-09-14.json](rollouts/nutrition-catalog-next-50-preparation-2026-09-14.json),
SHA-256 `04a74dafac5db8716040f8832da039f4ef6562f5b984caa93c2578d4174d94b6`.
NUT-03 remains `IN PROGRESS`. One next step is one owner decision on controlled
store -> authenticated review -> explicit-ID plan -> apply for exactly these
five unchanged artifacts and 162 candidates. Resolving the eight Darkstims
caffeine facts requires an unambiguous manufacturer total-caffeine-yield
statement; the other 16 scoped gaps remain outside that decision.

## NUT-03 catalogue next-50 execution checkpoint

14 September 2026, production store and authenticated review completed; apply
not run:

- Fresh production preflight reconfirmed project `aftboxmrdgyhizicfsfu`, 141
  applied variants, 34 active exact targets with unchanged empty overrides and
  zero matches for the 162 authorized candidate fingerprints.
- Controlled store created candidates `1396`-`1557`. Independent readback found
  exactly one row for every fingerprint, all initially `PENDING`, and no
  catalogue change. Authenticated review then approved all 162 rows through the
  existing admin route. A further read matched their values, exact variants,
  durable evidence, fingerprints and review metadata; the target overrides
  remained unchanged.
- Explicit-ID planning produced five blocker-free plans covering exactly 162
  approved candidates, 34 variants and zero products. Product `56` plan SHA-256
  / fingerprint is
  `1a175788e46189a1b33a292837db326871dd69bbf77ff4cbfa0ae3174e1be7ae` /
  `1c32943d73d60b78452ea108c770f87a1da765d36034434f468ead01288b9702`;
  product `878` is
  `44ceab8995cceba71f27a2abfc975d9d3bfa2df72892dcfe0daa0165e72327ba` /
  `a33b2545217895f94759d7a1830cd754dcc482d783e574a53146cec53fac7855`;
  product `880` is
  `55e7fa1e6db08e2b8a4578380202772084f2137ae2699f5a6883740f26682267` /
  `84d95d623e2b056a4b78acb9aa468bd8aade0743e7641b4799f6d461499852ea`;
  product `1169` is
  `f3483915235f1f4c1f388bb8f02272559687b38bb5320ec6f3fa70a476491e8f` /
  `083c947fc63640d4f8e7aa958f1789e5bd449b510770a23d7c5eb3e1e0063adf`;
  and product `1181` is
  `45c1381b84bfb43c7fa300aa608a1bd801de64d929a1b77f10465a7c12b725bc` /
  `ea9006e25e526ad73734d4ea264a6bbbb67096b0a9791471ff8c733c9b7b1141`.
- The automatic approval review rejected the first apply before the command ran.
  It found the short follow-up authorization insufficiently explicit about the
  concrete product `56` plan and its values. No workaround was attempted. A new
  read confirmed all 34 target overrides still match `before`, the applied total
  remains 141 and all 162 candidates remain approved.

Complete evidence is
[nutrition-catalog-next-50-execution-checkpoint-2026-09-14.json](rollouts/nutrition-catalog-next-50-execution-checkpoint-2026-09-14.json).
NUT-03 remains `IN PROGRESS`. One next step is explicit owner authorization of
the five exact plans, their hashes, fingerprints and listed values, followed by
guarded apply, independent readback, replay protection and public verification.

## NUT-03 catalogue next-50 execution completion

14 September 2026, resumed after renewed explicit owner authorization:

- Guarded apply completed all five sealed plans without changing their content
  or bypassing an application safeguard. It changed zero products and exactly
  34 target `product_variants.nutrition_override` objects: nine Warrior Rage,
  five DNFM, three Pumpage, nine C4 Original and eight Darkstims PRE V4 exact
  variants. Candidate IDs `1396`-`1557` remain approved with their original
  source evidence.
- A new forced-read-only connection matched every whole override to its plan
  `after`. Preservation hashes confirm no change to products, non-target
  variants, `nutrition_verified`, legacy `creatine_per_serving_g`, pre-existing
  target candidates or the non-target queue. The applied pre-workout total rose
  from 141 to 175.
- Replaying each of the five plans was safely rejected because its sealed
  variant `before` had changed. A subsequent read matched the same final state,
  confirming zero additional writes.
- All 34 public exact-variant pages return 200, select the requested variant and
  show the supported applied facts with manufacturer or retailer source labels.
  They expose neither private archive URIs nor reviewer metadata. Twenty-nine
  targets currently have an in-stock offer inside the application's 24-hour
  freshness window. Pumpage variants `1374`, `1375`, `1376` have applied
  caffeine `confirmed_absent`, but currently lack a fresh offer, so the
  availability-aware caffeine-free filter correctly omits that family.
- Of 404 current-offer catalogue variants, 141 are now complete, 26 partial and
  237 have no applied facts. This batch contributed 26 complete and eight
  partial variants; Darkstims caffeine remains deliberately unresolved.

Complete machine-readable evidence is
[nutrition-catalog-next-50-execution-2026-09-14.json](rollouts/nutrition-catalog-next-50-execution-2026-09-14.json),
SHA-256 `a65dcc5f54619bbbeb4f2b8be8741e05793ad25552937fd073b398fda73be02e`.
NUT-03 remains `IN PROGRESS`. One next step is to resolve the eight Darkstims
caffeine facts only after an unambiguous total-caffeine-yield source, or prepare
another evidence-backed family without repeating retained blockers.

## NUT-03 emergency catalogue batch preparation

14 September 2026, preparation only:

- A fresh read-only production preflight reconfirmed project
  `aftboxmrdgyhizicfsfu`, 18 active exact targets with empty overrides and zero
  existing candidates for the generated fingerprints. No catalogue or
  candidate write occurred.
- The bounded pass assessed 31 variants across five families. It prepared 90
  unique pending candidates for 18 variants: seven Cellucor C4 Original 390 g,
  four exact GHOST Legend V4 flavours and seven DY Nutrition Blood & Guts 380 g
  flavours. Eleven variants have all five tracked facts. The seven Blood & Guts
  variants retain `conflicting_information` for total caffeine while their
  serving, beta-alanine, citrulline-malate and creatine-absence facts remain
  independently usable.
- Three dry-runs pass for 35, 20 and 35 rows with zero product updates and zero
  database writes. All five project-authored evidence/context records were
  stored once in private `nutrition-sources`; independent downloads reproduced
  their hashes. Raw GHOST and WheyOkay images remain local because the reviewed
  terms do not permit treating them as reusable commercial archive material.
- C4 195 g remains blocked by conflicting 6 g/creatine-nitrate and 6.5
  g/creatine-monohydrate evidence. GHOST variant `1741` needs an exact identity
  binding to the WARHEADS flavour. The NXT TNT Nuclear 240 g retailer page says
  its table covers one unspecified flavour and warns that flavours may differ,
  so variants `3667`, `3710`, `3711`, `3712` remain unassigned.

The artifacts and their SHA-256 / fingerprint pairs are: product `175`
`7ed925af17b7a124c4172bb08eb2a473aca74a35bf0aa07f9b0c8ba3bfc70e71` /
`650d3553b627698c72779f9dac37a59d0b0d569973100b275dbb6529f4850f77`;
product `6`
`8165b4e05ea5865e812f1007d7eb3bc1f74f45af05e409b6f0a359e9f60856db` /
`b0f8b3c3f8b8d78c4de014439765890c415d2d8692c6a8b87ddc03d69bccabbc`;
and product `19`
`334500330c578f083ea617389159f884c75d76449e58ffa914b2ef024e3e77c8` /
`cd3f0172a4d20f11e0c5d2878ddc5edad9f45230a672d876ce89f4fb2641b1a4`.
Complete machine-readable evidence is
[nutrition-emergency-catalog-batch-preparation-2026-09-14.json](rollouts/nutrition-emergency-catalog-batch-preparation-2026-09-14.json),
SHA-256 `f95e00222fc2bba4651012e821e5e2a106763d6914aa088c4be04e815c1ad673`.
NUT-03 remains `IN PROGRESS`. One next step is one owner decision authorizing
store -> authenticated review -> explicit-ID plan -> guarded apply for exactly
these three unchanged artifacts and 90 candidate fingerprints.

## NUT-03 emergency catalogue batch execution

14 September 2026, production execution after exact owner authorization:

- A fresh preflight reconfirmed production project `aftboxmrdgyhizicfsfu`, 18
  active exact targets with empty overrides and no existing copy of any of the
  90 candidate fingerprints. Controlled store created candidates `1558`-`1647`
  exactly once, with zero product or variant updates.
- Authenticated review compared every stored field, information state, exact
  variant, source URI, source hash and fingerprint with the immutable artifacts,
  then approved all 90 candidates. No differing or pre-approved record was
  encountered.
- Three explicit-ID plans contained zero product updates, no blockers and 18
  variant updates. Product `175` plan SHA-256 / fingerprint is
  `b986e9a7a710bf3c8617635e3a5f1decbe490b5b489a1d1ba8fc3d2b99f7fcc7` /
  `f51d61ffe678b951d1b2dc065bed76aeb31648f31d1431f104805e3c3dea6a62`;
  product `6` is
  `00a2d345ff02182cce6b30bf7fc6ba55d91360114da7333fe3aad837fbf2d38c` /
  `059b1517e9d92bee82ce2b19adfb426c781592307a7c6afdc34c8feaa2408564`;
  and product `19` is
  `ccab3ec1422424878984e51522b922aaa13c636ebfaf4652e1ca276973b77f1b` /
  `116813f400f23bfc19d1c8044027eac8881d4193b718efded71f0c2b8282243c`.
- Guarded apply changed exactly the 18 planned `nutrition_override` objects and
  zero products. A new read-only connection matched every whole override to the
  corresponding plan `after`, retained all 90 approved evidence records and
  confirmed unchanged `nutrition_verified` and legacy
  `creatine_per_serving_g`. Applied exact-variant coverage rose from 175 to 193.
- Replaying each unchanged plan was safely rejected on its stale sealed
  `before`; a subsequent read proved zero additional writes. All 18 public URLs
  return 200, select the requested variant, show the expected facts and source
  type, and expose neither private URIs nor reviewer metadata. None qualifies
  for the caffeine-free filter: C4 and GHOST contain caffeine, while Blood &
  Guts preserves `conflicting_information`.
- The catalogue now has 167 variants containing all five applied state keys, 26
  partial variants and 382 with no applied facts. Seven of the 167 retain an
  explicit Blood & Guts total-caffeine conflict, so owner-facing fully resolved
  coverage is 160 rather than treating that conflict as a known dose.

Complete evidence is
[nutrition-emergency-catalog-batch-execution-2026-09-14.json](rollouts/nutrition-emergency-catalog-batch-execution-2026-09-14.json),
SHA-256 `9e1f91e558f5543426510a4471a34003f7c8c054363b91de0cdf7aae1b006651`.
NUT-03 remains `IN PROGRESS`. One next step is to prepare another exact-version
family with a provable serving and shared-table context, while retaining the
known C4 195 g, GHOST `1741`, NXT 240 g and Blood & Guts caffeine gaps until new
evidence appears.

## NUT-03 catalogue continuation preparation

14 September 2026, preparation only:

- A fresh read-only production preflight reconfirmed project
  `aftboxmrdgyhizicfsfu`, 19 active exact targets with empty overrides and no
  existing nutrition candidates. The baseline remains 193 applied unique
  variants: 167 with all five applied state keys, 26 partial and 382 without
  applied facts. Seven applied Blood & Guts variants retain an explicit
  caffeine conflict, so 160 variants have all four ingredient outcomes
  resolved for owner-facing coverage.
- The bounded pass assessed 27 variants and prepared 90 unique pending
  candidates for 19 variants across five families. Four Optimum Nutrition Gold
  Standard Pre-Workout 330 g, four GHOST PUMP, three BioTechUSA Nitrox Therapy
  340 g and three BioTechUSA Black Blood CAF+ 300 g variants have all five
  tracked facts. Five Olimp Redweiler 480 g variants have serving, caffeine,
  beta-alanine and citrulline-malate candidates; creatine is intentionally
  omitted because the source separately quantifies monohydrate and creatine
  malate and the current single-form creatine field cannot represent both.
- All five artifacts pass the existing offline store dry-run: 20, 20, 15, 15
  and 20 rows, with 90 unique fingerprints, zero product updates and zero
  database writes. Five project-authored factual reviews plus the context
  manifest were stored once in private `nutrition-sources`; independent
  downloads reproduced every SHA-256. Locally inspected source pages and GHOST
  panels remain outside Git.
- Eight inspected variants remain excluded: four BioTechUSA NOX+ catalogue
  variants have an unresolved 330 g versus current 340 g formula difference;
  four CNP Full Tilt V2 catalogue flavours do not match the current official
  Loaded Pre 570 g flavour identities. Reflex Muscle Bomb 600 g remains outside
  the ready scope because the current official page is a different 40-serving
  presentation and separately presents a caffeine-free Lemon Sherbet version.

Artifact SHA-256 / fingerprint pairs are: product `17`
`347496fce5b2aa493e3dbb5d6a375a9f91c47d1986dcc6cab0c9da2464bc411b` /
`07437de750a2a44cabba6de6a0ebabbb43a229edb17d3ad340c272330b46be3b`;
product `49`
`fcb91f10cf750290be5d87c9aede77ae58b8bb70640e6f6aa095423de6fffc69` /
`a805509f97e288c17b2822c6bbedd34cd395747eda55c8ba9cd697388c7b06d3`;
product `55`
`8ba3e72725d59b9cfbbd89b9d76c948c5f3aeedc03e85523bbcde61f3a3fe522` /
`25796fde98a6538e9a0e665de70310349a05100561edde49b180ef4d3a0b2fa6`;
product `294`
`ea7ab6546094a5fa10e9490d07e953629c7dbb24e2023eca953a2a8341344335` /
`748b72f967ad1f1ca534f53a46023c4a4ed166fe02edec2ff37732de699f4ce4`;
and product `520`
`3db05816f98f44d756e691e5445d3c76804d79f7fae88e187e8b913bc63a714a` /
`1ff9b7cd767cc73a845999c988a4a7a4fbb5397f324bad024b463517828311ca`.
Complete evidence is
[nutrition-catalog-continuation-preparation-2026-09-14.json](rollouts/nutrition-catalog-continuation-preparation-2026-09-14.json),
SHA-256 `5468cbd15300903f7bf3a2e775dbf23e668a46f2bf5051d99082fe65b7d35ca4`.
NUT-03 remains `IN PROGRESS`. One next step is one owner decision authorizing
controlled store -> authenticated review -> explicit-ID plan -> guarded apply
for exactly these five unchanged artifacts and 90 candidate fingerprints;
Redweiler creatine remains excluded.

## NUT-03 catalogue continuation execution

14 September 2026, production execution after exact owner authorization:

- A fresh production preflight reconfirmed project `aftboxmrdgyhizicfsfu`, all
  19 exact product-variant bindings, 90 unique candidate fingerprints, empty
  target overrides and no existing matching candidates. The controlled store
  created candidates `1648`-`1737`; authenticated review approved exactly those
  90 records with their evidence unchanged.
- Five explicit-ID plans contained zero product updates and exactly 19 variant
  updates. Guarded apply completed all five: products `17`, `49`, `55` and
  `294` received the five approved facts, while product `520` received four.
  Redweiler creatine remains deliberately unresolved because its source
  separately declares creatine monohydrate and creatine malate.
- A new read-only connection matched all 19 complete overrides to their sealed
  plan `after`, retained all 90 approvals and evidence records, and found no
  change to products, `nutrition_verified` or legacy
  `creatine_per_serving_g`. Applied coverage rose from 193 to 212 variants:
  181 now contain all five state keys, 31 are partial and 363 have no applied
  facts. Excluding the seven retained Blood & Guts caffeine conflicts, 174
  variants have fully resolved owner-facing ingredient outcomes.
- Replaying every unchanged plan was safely rejected because its sealed
  `before` was stale after the successful apply. A second independent read
  confirmed zero additional writes and the identical final state.
- All 19 public exact-variant pages return 200, select the requested variant,
  show the expected facts and source type, and expose neither private archive
  URIs nor reviewer metadata. The availability-aware caffeine-free filter shows
  GHOST PUMP and excludes all target variants with declared caffeine.

Complete machine-readable evidence is
[nutrition-catalog-continuation-execution-2026-09-14.json](rollouts/nutrition-catalog-continuation-execution-2026-09-14.json),
SHA-256 `ee64c72cf9f26ee7247fc4c01a35d1c313f10418d1f925cddf2194fb3fbc515a`.
NUT-03 remains `IN PROGRESS`. One next step is to prepare the next exact-version
family with an evidence-backed serving and shared-table context, without
repeating retained blockers.

## NUT-03 next catalogue family preparation

14 September 2026, preparation only:

- The read-only production scan started from 212 applied variants and assessed
  12 active current-offer variants across two families. It did not repeat the
  retained C4 195 g, Ibiza or other recorded blocker audits.
- Redcon1 Total War 400 g remains excluded: accessible current and historical
  evidence shows incompatible pack sizes, serving masses and caffeine totals,
  so it does not establish the catalogue formula without guessing.
- Product `482`, JNX Sports The Curse 250 g, is ready for variants `1022`,
  `1697` and `1698`. The manufacturer groups Blue Raspberry, Fruit Punch and
  Pina Colada in the same 250 g / 50-serving product, and matching
  retailer-hosted manufacturer labels establish one 5 g scoop, caffeine 155 mg,
  beta-alanine 1600 mg, L-citrulline 700 mg and creatine monohydrate 1000 mg.
  Compound masses retain their declared forms.
- The single artifact contains 15 unique PENDING fingerprints and passes the
  existing store dry-run with zero product updates and zero database writes. A
  fresh production preflight found all three target overrides empty and no
  matching candidates. The project-authored factual review and context manifest
  were stored once in private `nutrition-sources`; fresh downloads reproduced
  both hashes.

The artifact is
`tmp/nutrition-catalog-next-preparation-2026-09-14/candidate-artifact/nutrition-candidates-ncr1-catalog-next-20260914-482.json`,
SHA-256 `89d96dff9a31bf1b761271245b5276423f90c5d2fd4f3fd84968a98aa420ad4b`,
fingerprint `c082a64382f4ab4a1f6acf199bf188c5279b26e5f5f81a204f28a7449e02e613`.
Complete evidence is
[nutrition-catalog-next-preparation-2026-09-14.json](rollouts/nutrition-catalog-next-preparation-2026-09-14.json),
SHA-256 `09568e510f493090b1a34d32e99aa410e566d70aed8f2a3ed9503705e2b17394`.
NUT-03 remains `IN PROGRESS`. One next step is one owner decision authorizing
controlled store -> authenticated review -> explicit-ID plan -> guarded apply
for exactly this unchanged artifact and its 15 fingerprints.

## NUT-03 JNX The Curse execution

14 September 2026, production execution after explicit owner authorization:

- A fresh preflight reconfirmed production project `aftboxmrdgyhizicfsfu`, the
  unchanged artifact hash and fingerprint, three empty target overrides and no
  existing candidate fingerprint. Controlled store created candidates
  `1738`-`1752`; authenticated review approved exactly those 15 records.
- The sealed plan SHA-256 / fingerprint is
  `9c990e7e21ad9e7914b96872cf8154706fd4d25c67bb4229bb5efc2ca363149b` /
  `26fc6f401106e39ec087e38464e4dc3f3e1718ab001a07ad0dc631e88ca557fb`.
  It contained zero product updates, three empty `before` overrides and exactly
  the five authorized facts for variants `1022`, `1697` and `1698`.
- Guarded apply updated only those three `nutrition_override` objects. A new
  read-only connection matched every whole override to the plan `after`, found
  all 15 candidates approved with unchanged evidence and advanced applied
  coverage from 212 to 215 variants: 184 complete, 31 partial and 360 without
  applied facts. Products, `nutrition_verified` and legacy
  `creatine_per_serving_g` remained unchanged.
- Replaying the same plan was safely rejected on its stale sealed `before`, with
  zero additional writes. All three exact public pages return the expected
  serving, caffeine, beta-alanine, L-citrulline and creatine-monohydrate facts;
  the caffeine-free filter correctly excludes all three.

Complete evidence is
[nutrition-catalog-next-execution-2026-09-14.json](rollouts/nutrition-catalog-next-execution-2026-09-14.json),
SHA-256 `ee7a07010a22772b726c2f89031f3a17dc8592229272bd331c9b0c4b07938ac0`.
NUT-03 remains `IN PROGRESS`. One next step is to prepare another exact-version
family while retaining known blockers until new evidence appears.

## NUT-03 larger catalogue batch preparation

14 September 2026, preparation only:

- A fresh read-only production preflight started from 215 applied variants and
  confirmed 25 exact active targets with current offers, empty overrides, 106
  unique candidate fingerprints and no matching candidate records. The target
  remains production project `aftboxmrdgyhizicfsfu`; the preflight made no
  database writes.
- One closed package covers five families and 25 variants: Mutant Madness 225 g
  (`1023`, `1792`-`1797`), Full As F*ck 387 g (`1007`, `1607`-`1611`), 5150
  375 g (`1030`, `1612`-`1614`), Pitbull Pump (`1217`-`1220`, `2767`) and Mega
  Pump Elite (`1221`, `1251`, `2769`). Thirteen variants have all five tracked
  facts; twelve retain explicit gaps while keeping their supported facts.
- Five artifacts contain 106 PENDING candidates. Every artifact passes the
  existing offline store dry-run, totalling zero product updates and zero
  database writes. Five factual reviews were archived once in private
  `nutrition-sources`; independent downloads reproduced all hashes.
- Mutant Madness retains unresolved citrulline because its table gives one
  combined citrulline-malate/arginine mass, and retains unresolved creatine.
  Pitbull Pump retains unresolved creatine because the accessible page is not a
  complete legal ingredient declaration. Known version conflicts for Total
  War 400 g, Conviction Elite 375 g, Pharma Grade PRE and Darkstims Pump V2
  remain excluded rather than being guessed. This is why the evidence-qualified
  package stops at 25 variants instead of padding the organizational limit of 50.

Artifact SHA-256 / fingerprint pairs are: product `489`
`adafa27a691aa4ba24b70c8860635d3a78aacf99426b170b13297c83ef507598` /
`9dc872e66726004bb580950f6cae867cb20429d6aa6fa1f33d09224e02e21a71`;
product `58`
`30ae13d687e528abdb51f4a70dbc316edd69abfaa735603df2e920c829f631f3` /
`cdc2648f4c94d5ff6118d732d7e9b1d702d9241d8f292677526175ec72ffe103`;
product `59`
`82865bc3533aa98595b0fda05d1c3277a2c1c756bb67b190b7a137c0394e29f1` /
`d6f0453e3b22cac272c7741d4065b974b12eeb74c98d0aa38b412e7d75048b6c`;
product `839`
`fd4c7cfeb6afe6c7de01427327230682132cddd225c5fc8b45bfa69d5c849f4d` /
`6ad1c50cc9e0fa8ce740ea847b12299ed9e98a073ef46c1f3192332fce118f0b`;
and product `842`
`aa0aefef62e1a2d44a173fc0010e7ae063e29b04e79161011eea95584958b472` /
`1a0474ba019a0f9d7763d2ebe1bc5eb8d3ea78eab1dfc2a1cfa226f89b63fa53`.
Complete evidence is
[nutrition-catalog-large-next-preparation-2026-09-14.json](rollouts/nutrition-catalog-large-next-preparation-2026-09-14.json),
SHA-256 `e983dad72215a32e7708e9d7d71c6a6519300059cfe3ca2fea99a62c72e7f38d`.
NUT-03 remains `IN PROGRESS`. One next step is one owner decision authorizing
controlled store -> authenticated review -> explicit-ID plans -> guarded apply
for exactly these five unchanged artifacts and 106 fingerprints.

## NUT-03 larger catalogue batch execution

14 September 2026, production execution after the owner continued with the
immutable package and confirmed the Mutant caffeine interpretation:

- The fresh preflight reconfirmed production project `aftboxmrdgyhizicfsfu`,
  25 empty exact target overrides, 106 unique fingerprints and no matching
  candidates. Controlled store created candidates `1753`-`1858`; authenticated
  review approved all 106 with unchanged values and evidence.
- Five explicit-ID plans contained zero product updates and exactly 25 variant
  updates. Plan SHA-256 / fingerprint pairs are: product `489`
  `ed1a1149c87bf0ab9686908ff883f3c8550a4d3ac67662a74867bcf0b88932ee` /
  `88bf920d951baab3026ce0e235a8d8cbc19452b347f9519d4bb34dbe1d285789`;
  product `58`
  `30db48b4345b13be5fd235c917e330308978a8cabb2b6957c2ed789be399a34c` /
  `f0c226e42b7dda287759cd23a23fbef745e0b250f99eb0af7671069027abbec3`;
  product `59`
  `87d9872d74a4c44ef10f12c6ccba1956a60e0462f00a23c5aa2744df00b3df51` /
  `80714a04bb006b1793a98c1361df2a7f9b87e732c5431e685bc581321aff71d5`;
  product `839`
  `e06cd71a6e4f5d72176cd117340e694051b587ead13be90ed652767c16adf8fb` /
  `84785e29ff5d7d7a4b0b7f0ef8ee4e6dad0fab24fabcf0d20a1995083043c359`;
  and product `842`
  `5a8f3225dd77b026c49cb82aa030610a544c0a1d7cbcfe5cd5662411935e2cfb` /
  `224db5460c0949d5f4c1a47a7af04295f4d3c9d3a5095a5a74c1455e3ce35146`.
- Guarded apply changed only the planned 25 `nutrition_override` objects. A new
  read-only connection matched every whole override to its plan `after`, found
  all 106 candidates still approved with unchanged evidence, and confirmed no
  product, `nutrition_verified` or legacy `creatine_per_serving_g` change.
  Applied coverage rose from 215 to 240 variants: 197 complete, 43 partial and
  335 with no applied facts.
- Replaying all five unchanged plans was safely rejected on stale sealed
  `before`, with zero additional writes. All 25 exact public pages returned 200,
  selected the correct variant, displayed the expected facts and source type,
  and exposed no private URI or reviewer metadata. The caffeine-free filter
  includes available qualifying variants and excludes Mutant Madness and 5150.
- The seven Mutant variants retain unresolved citrulline and creatine; five
  Pitbull Pump variants retain unresolved creatine. These explicit gaps account
  for the twelve partial variants and were not converted to zeros or absence.

Complete evidence is
[nutrition-catalog-large-next-execution-2026-09-14.json](rollouts/nutrition-catalog-large-next-execution-2026-09-14.json),
SHA-256 `8d1e717285ba67bb7bb98851a7cb873a9a6f6e182f5428781f16bf795b921198`.
NUT-03 remains `IN PROGRESS`. One next step is another multi-family preparation
batch, retaining recorded version and evidence blockers until new evidence
appears.

## NUT-03 next exact-version catalogue batch preparation

14 September 2026, preparation only:

- A fresh read-only production preflight started from 240 applied variants and
  confirmed 16 exact targets with current offers, empty overrides, 80 unique
  candidate fingerprints and no matching candidate records. The target is
  production project `aftboxmrdgyhizicfsfu`; the preflight made no database
  writes.
- The closed package covers five families and 16 variants: C4 Original 60
  Servings (`3277`, `3444`, `3445`, `3447`), QHUSH Black 220 g (`1021`,
  `1787`, `1788`), AK-47 Labs 240 g (`3233`, `3263`, `3267`), Jack3d Advanced
  315 g (`3758`, `3875`, `3877`) and HyperMax'D Out 480 g (`1232`, `1233`,
  `2774`). All 16 have all five tracked facts.
- Five artifacts contain 80 PENDING candidates. Each artifact passes the
  existing offline store dry-run, totalling zero product updates and zero
  database writes. Five factual source reviews were archived once in private
  `nutrition-sources`; independent downloads reproduced all hashes.
- The package stops at 16 rather than padding the organizational limit of 50.
  Short recognition retained exact-version or evidence blockers including
  Total War 400 g, products whose manufacturer states flavour contents vary,
  NXT access/identity cases and the catalogue 520 g versus current 550 g
  formula. None was converted into guessed data.

Artifact SHA-256 / fingerprint pairs are: product `1171`
`fa5c80c8c99e86c8e54d04dbc730798d3645fd3e549384b0d956f0690b5d80c9` /
`446065f57e89f925e40e1cb450d9d99ac06107db9a87814cf90683a54d44a776`;
product `449`
`f93a836e9aae25b524dc67d6b9111cb58c3c412dcf113b40d19922929b5ca75c` /
`2877b14b463e8fa48af0e4a12b570e722e5d432e306b6bde7b2d799655b62172`;
product `1162`
`fbbc4c41f8fe0f72e82c62cef65e203c271ce099a02ee6a0fee9e34b1cc4f8d4` /
`30954d42a061ce5fba624bf0f9384222f85a943f14c1cb6080487688a986a0b4`;
product `1278`
`301782160101a92941e0661a5e5d9bd468aa4654cdf81ad3a0c3e68aa84ceda1` /
`f63160aed438071aeecc7aac09e0154a6b081cfa32dbb257f43f871bcf62731d`;
and product `847`
`3dad6942d892d8048fecb30c3cbd1429daa382f41b6306401cab24f04b52dceb` /
`ebc1ce033d3ef6c18cdd390dd4855eefca0195e7b13084835dfe4e421571ed32`.
Complete evidence is
[nutrition-catalog-large-next-02-preparation-2026-09-14.json](rollouts/nutrition-catalog-large-next-02-preparation-2026-09-14.json),
SHA-256 `4cf55c03312f7a2861a374315bf28c8c6fa12f9f764db04c945a160e0c64cb5d`.
NUT-03 remains `IN PROGRESS`. One next step is one owner decision authorizing
controlled store -> authenticated review -> explicit-ID plans -> guarded apply
for exactly these five unchanged artifacts and 80 fingerprints.

## NUT-03 next exact-version catalogue batch execution

14 September 2026, production execution after explicit owner authorization:

- Controlled store created exactly 80 candidates, IDs `1859`-`1938`, for the
  five unchanged artifacts and 16 exact variants. Authenticated review approved
  all 80 after comparing every stored field and evidence fingerprint with its
  artifact.
- Five explicit-ID plans contained zero product updates and exactly 16 variant
  updates. Plan SHA-256 / fingerprint pairs are: product `1162`
  `c041057ff6ec1268b3e7a735ac90759f4913f0a2cc216ea296749338f6305079` /
  `e7081dd499cc69ca9c473a99da475890992f9500fbbb0bde477c076859412871`;
  product `1171`
  `bea4509c4979cbf7fc3bc5a67b2615e6892346f2058e12ea3201a43634ad2f3a` /
  `1c96c7a86043bb3845fc4e3f41b50acbc2a9f7fbbb95d357cc8ee2cf53ff5f44`;
  product `1278`
  `07a333d69a62814b167acc8ada888da250399a3cb3b3820090593ae23c982d58` /
  `0afab219723d540cac292b463f3cf5f395e6b908bed06083b22c57061981fc97`;
  product `449`
  `f2b47353cd5a243605170d113937417445ffc2f6e0ec2fb2dec8dc2aeecb57c6` /
  `0f04133acd53eee3787613eca8a3da6fbbd67bd3a2236875dd1c956379fe69dc`;
  and product `847`
  `06b9c311db100567a0429e9ecdda14c9278e04c5cf3ede09973ff62f4bb30141` /
  `427e7f8934c643f5915a0c5e1fcf0b70b47e0c64fac018e07de6fa0e271dbf37`.
- Guarded apply changed only the planned 16 `nutrition_override` objects. A new
  read-only connection matched every whole override to its plan `after`, found
  all 80 candidates approved with unchanged evidence, and confirmed no product,
  `nutrition_verified` or legacy `creatine_per_serving_g` change. Applied
  coverage rose from 240 to 256 variants: 213 complete, 43 partial and 319 with
  no applied facts.
- Replaying every unchanged plan was safely rejected on stale sealed `before`,
  with zero additional writes. All 16 exact public pages returned 200, selected
  the intended variants, displayed their expected facts and source type, and
  exposed no private evidence URI or reviewer metadata. The caffeine-free
  search excluded all stimulant targets; qualifying results remain governed by
  available offers and existing card grouping.

Complete evidence is
[nutrition-catalog-large-next-02-execution-2026-09-14.json](rollouts/nutrition-catalog-large-next-02-execution-2026-09-14.json),
SHA-256 `297c55c81e36b67bac30ad7d4e16d916a3b65394426d2c79396741402305824a`.
NUT-03 remains `IN PROGRESS`. One next step is another evidence-qualified
multi-family preparation batch without repeating retained blockers.

## NUT-03 next large catalogue preparation after 294 applied variants

14 September 2026, preparation only:

- A fresh production read confirmed 575 active pre-workout variants and 294
  variants with applied nutrition facts. Of 406 variants with a current
  available offer, 234 are complete, 52 partial and 120 have no applied facts.
- The evidence-qualified pass prepared the two exact 10X Athletic PUMP
  variants: product `756`, Apple Attack variant `885` and Cobra Ki variant
  `1974`. The common manufacturer table gives one scoop / 12 g, caffeine
  `confirmed_absent`, beta-alanine 3200 mg, citrulline malate 2:1 8000 mg and
  creatine monohydrate 3000 mg.
- The immutable artifact contains 10 PENDING candidates with 10 unique
  fingerprints. The existing store dry-run passed with zero database writes,
  and production preflight found correct bindings, empty target overrides and
  no matching candidates. The factual review was archived once in the private
  `nutrition-sources` bucket and its independent download matched SHA-256.
- The batch stopped below the 50-variant ceiling because the remaining assessed
  families retain concrete serving, pack, flavour-applicability or formula
  generation conflicts. In particular, Darkstims V4 currently exposes
  conflicting 400 mg and 362.5 mg caffeine declarations, so no value was
  selected by guesswork.

Artifact SHA-256 / fingerprint: product `756`
`f51f13405ab2856e2217ddd4233ef99f3ba250c26c4f44eb48af57e1b5a96250` /
`d83046ab504444c6a1a0a4f1077e04736ba5e79195e955e140a11e7623fa7aa5`.
Complete evidence is
[nutrition-catalog-large-next-04-preparation-2026-09-14.json](rollouts/nutrition-catalog-large-next-04-preparation-2026-09-14.json),
SHA-256 `b2a2dc7e5b7a6ce36e8b96d5dcd3ec09e7d8c15a0749b94e73a828e813c64a25`.
NUT-03 remains `IN PROGRESS`. One next step is one owner decision for controlled
store -> authenticated review -> explicit-ID plan -> guarded apply of exactly
these 10 unchanged candidates for variants `885` and `1974`.

## NUT-03 next large catalogue execution after 294 applied variants

14 September 2026, production execution after explicit owner authorization:

- Controlled store created candidates `2112`-`2121` for product `756`, variants
  `885` and `1974`. Authenticated review approved the unchanged ten-record set.
- The explicit-ID plan contained zero product updates and two exact variant
  updates. Its SHA-256 is
  `5c8443f8cae4e0e1bb981580243abfddc54bfbe01d9aacb6411b9d2cac2c0ba2`
  and fingerprint is
  `ef6c0f3f19d7cf14e84b2fc667ec7d8f7218b072d04d283aa5089acfcb7b5298`.
- Guarded apply wrote only serving size, caffeine, beta-alanine, citrulline and
  creatine facts to both planned `nutrition_override` objects. Independent
  readback matched both whole overrides to the sealed `after`, confirmed all
  approvals and unchanged evidence, and found no product, verification-flag or
  legacy-creatine change.
- Applied coverage is now 296 variants: 244 complete, 52 partial and 279 without
  facts. Both exact public pages passed and the common product is visible in the
  caffeine-free filter. Replaying the plan was safely rejected because the
  sealed `before` no longer matched, with zero additional writes.

Complete evidence is
[nutrition-catalog-large-next-04-execution-2026-09-14.json](rollouts/nutrition-catalog-large-next-04-execution-2026-09-14.json),
SHA-256 `25bb8f05ed37466d20425b5b6815eb8ddb2a4545d5afa63c50e030768a535c3c`.
NUT-03 remains `IN PROGRESS`. One next step is another evidence-qualified
multi-family preparation batch without repeating retained conflicts.

## NUT-03 large catalogue preparation after 296 applied variants

15 September 2026, preparation only:

- Fresh production readback confirmed 575 active pre-workout variants and 296
  with applied facts. Among 406 variants with a current available offer, 236
  are complete, 52 partial and 118 have no applied facts.
- The next package contains 41 PENDING candidates for nine exact variants in
  four families: Gas Mark 10 No Games product `884` variants `1414`, `1416`,
  `1417`, `1418`; Murdered Out SHOOK product `1281` variants `3761`, `3916`;
  Dorian Yates Blood & Guts product `19` variant `1579`; and Conteh Sports The
  Pump product `893` variants `1473`, `1474`.
- Seven variants have five proposed facts and would become complete. The two
  Conteh variants have only the independently supported absence facts for
  caffeine, beta-alanine and creatine. Their serving size and quantified
  citrulline remain excluded because exact-pack sources conflict between 13.8 g
  and 16 g serving bases.
- All four existing store dry-runs passed: 41 rows, zero product updates and
  zero database writes. Production preflight confirmed nine exact bindings, 41
  unique fingerprints, empty target overrides and no matching candidates. Four
  factual reviews were archived privately and downloaded with matching hashes.
- The batch stopped below 50 variants because further current-offer families
  retain documented formula-generation, pack, serving or flavour-context
  conflicts. Those values were not guessed.

Artifact SHA-256 / fingerprint pairs are: product `884`
`2da1d522a59724ecee9ca8795fb718cac6a3cc0a3d072f18ddf38e5c83794706` /
`092453178a8dd91332d19b107e23f8568062877a63608621ce8f29a5dc2c3003`;
product `1281`
`67ce0cdfbb070c4b1dd32704a6e2acd3be0bb7f18e2cb245dae4e6da4bbd6d98` /
`e6c1130d2e489a8981f02773f933e713ea41429e618aeec1c2872bd6ecec7dbe`;
product `19`
`7a95b810d7ca98928d4b4ceb25e71d7681e671725377023756c3873b388ee4f6` /
`0d496c099d477928e58fbc0756417e14b880903a257b331978933028e611c466`;
and product `893`
`a99ad5377f9139c667e165a672ab2a354d72d6a7acf31e23600e8e0ff18a4ac0` /
`771f77a93c7c1e17b4ec3ade3c9c89925feecaaf84409c204b2d32a5852458dd`.
Complete evidence is
[nutrition-catalog-large-next-05-preparation-2026-09-15.json](rollouts/nutrition-catalog-large-next-05-preparation-2026-09-15.json),
SHA-256 `b5d25035fa6cc8c427444d83aea048e02252866d040a23cf1edcb996f60545ea`.
NUT-03 remains `IN PROGRESS`. One next step is one owner decision for controlled
store -> authenticated review -> explicit-ID plans -> guarded apply of exactly
these 41 unchanged candidates for the nine listed variants.

## NUT-03 large catalogue batch 03 execution

14 September 2026, production execution after explicit owner authorization:

- Controlled store created 38 candidates, IDs `2074`-`2111`, for ten exact
  variants across products `1251`, `1252`, `1275` and `763`. Authenticated
  review approved the unchanged set.
- Four explicit-ID plans contained zero product updates and ten exact variant
  updates. Guarded apply changed only the planned `nutrition_override` objects.
  Independent readback matched all ten complete overrides to their sealed
  `after`, confirmed all approvals and unchanged evidence, and found no change
  to products, `nutrition_verified` or legacy creatine.
- Applied coverage is now 294 variants: 242 complete, 52 partial and 281 without
  applied facts. All ten exact public pages passed. Darkstims is visible in the
  caffeine-free filter; Adapt, Bloom and Menace are excluded. Replaying all four
  plans was safely rejected on stale sealed `before`, with zero extra writes.

Complete evidence is
[nutrition-catalog-large-next-03-execution-2026-09-14.json](rollouts/nutrition-catalog-large-next-03-execution-2026-09-14.json).
Its SHA-256 is
`99899c7bd531ebdfd413f6815dc29b46db5095b16ac96a0ccf9a55a778e647b8`.
NUT-03 remains `IN PROGRESS`. One next step is another evidence-qualified
multi-family preparation batch without repeating retained blockers.

## NUT-03 large catalogue preparation after 284 applied variants

14 September 2026, preparation only:

- Production readback confirmed 575 active pre-workout variants and 284 with
  applied facts. Among 406 variants with a current available offer, 228 are
  complete, 48 partial and 130 have no applied facts.
- Four families qualified: Adapt product `1252` variants `3674`, `3724`; Bloom
  product `1251` variants `3673`, `3723`; Naughty Boy product `763` variants
  `4101`, `4107`; and Darkstims product `1275` variants `3755`, `3913`-`3915`.
  This is ten exact variants and 38 PENDING facts. Six variants have all five
  tracked facts; four Darkstims variants have supported caffeine and creatine
  absence only.
- All four store dry-runs passed with 38 unique fingerprints, zero product
  updates and zero database writes. Read-only production preflight confirmed
  exact bindings, empty target overrides and no matching candidates. Four
  factual reviews were stored once in private `nutrition-sources`; independent
  downloads matched their SHA-256 values.
- The batch stopped below 50 because the next large families retain concrete
  formula-generation, pack, serving, common-table applicability or source
  retention conflicts. Darkstims still lacks a gram-defined serving, and its
  citrulline-nitrate component is outside the deployed form set.

Artifact SHA-256 / fingerprint pairs are: product `1252`
`bd7d9beb52ef1fa71006d04b9e48421f398de64489acb203055a820b6d58b383` /
`2abf347808d2fda6951597bcf52c0dcaada336a33bd5572d1a8596cb2872e8d0`;
product `1251`
`e7916e8b08edccacf9aef4fcaaa08621d226feee0b6c7ef1d7c329567b9ee866` /
`48058b7aeaabe213579e1b5d84989b1b381e89dff4f6a9c9106842121c218471`;
product `763`
`d09c23e75a0ceeb586c06b98ab6ee5762e2f58d170195ddebf3b47cc4c127dfb` /
`cff018fc00ee78856287f27b4b20368cf103a734c56f9cf168349ecffb9486b8`;
and product `1275`
`4f623abb3293c33a0b4de6c5c64814f98a383d4739ba2067e5e8d622bcf330bd` /
`fc24a18863024237b99853405645434ee32dcd9792c6187292db85578aa8303d`.
Complete evidence is
[nutrition-catalog-large-next-03-preparation-2026-09-14.json](rollouts/nutrition-catalog-large-next-03-preparation-2026-09-14.json).
Its SHA-256 is
`62e74d6996c7cb5b785f5b24764713fc1ab51eb391766a3ac6176fa426e28cf3`.
NUT-03 remains `IN PROGRESS`. One next step is one owner decision for controlled
store -> authenticated review -> explicit-ID plans -> guarded apply of exactly
these four unchanged artifacts and 38 fingerprints.

## NUT-03 catalogue continuation after mega batch execution

14 September 2026, production execution after explicit owner authorization:

- Controlled store created 41 candidates, IDs `2033`-`2073`, for NXT Nutrition
  product `1178` variants `3476`, `3525`-`3528` and BioTech USA product `295`
  variants `1041`, `1776`-`1778`. Authenticated review approved the unchanged
  set.
- Two explicit-ID plans contained zero product updates and nine exact
  `nutrition_override` updates. Plan SHA-256 / fingerprint pairs are product
  `1178` `91c36acfadc0c8d0cd1546ae2bef4670acfd8475fd970011345d4d599410f1da` /
  `359ca4828acc7e9edc2b8b1502c50a7d92eda6973bed69102fad981bb354e11e`;
  and product `295`
  `6efc78ae16d5dc603906e9014441a791fb8206f3d17a74c5434ceefd947965ee` /
  `fbb0dc8c846a50cb87926d8ac80ef20fa604c627e396eff74ac492474f7908be`.
- Guarded apply changed only the nine planned variant overrides. Independent
  readback matched every whole override to its sealed `after`, confirmed all 41
  approvals and unchanged evidence, and found no product, verification-flag or
  legacy-creatine change. Applied coverage is now 284 variants: 236 complete,
  48 partial and 291 without applied facts.
- All nine exact public variant pages passed. Product `1178` is visible in the
  caffeine-free filter using existing grouping, while caffeinated product `295`
  is absent. Replaying both plans was safely rejected on stale sealed `before`,
  with zero extra writes.

Complete evidence is
[nutrition-catalog-next-after-mega-execution-2026-09-14.json](rollouts/nutrition-catalog-next-after-mega-execution-2026-09-14.json).
Its SHA-256 is
`aee39990bcdea375a21601e794f00feb8222dd4e73eda50115e8aea70927a4a2`.
NUT-03 remains `IN PROGRESS`. One next step is another evidence-qualified
multi-family preparation batch without repeating retained blockers.

## NUT-03 mega catalogue preparation after 268 applied variants

14 September 2026, preparation only:

- A continuous pass assessed 50 unprocessed variants and qualified seven exact
  variants across five families: Naughty Boy Pump product `779` variants `974`,
  `975`; N1 Pro product `777` variants `968`, `969`; Efectiv Project Pump
  product `853` variant `2777`; NXT TNT Nuclear Pump product `1178` variant
  `3523`; and The Formula NOVA product `1284` variant `3764`.
- Five immutable artifacts contain 34 PENDING candidates. Six variants have all
  five tracked facts. NOVA has four supported facts; caffeine remains excluded
  because the table gives caffeine-ingredient masses that cannot safely be
  treated as total active caffeine without a declared yield.
- All five store dry-runs passed with zero product updates and zero database
  writes. Production preflight confirmed seven empty exact target overrides,
  34 unique fingerprints and no matching candidates. Five reviews were stored
  once in the private `nutrition-sources` archive and passed SHA-256 readback.
- The package stopped below the 50-variant ceiling because 43 assessed targets
  retained exact formula-generation, package/serving, flavour-applicability or
  source conflicts. Known blocked families were not forced into the batch.

Artifact SHA-256 / fingerprint pairs are: product `779`
`f9e20091bd7666615c2ebbb88ee79f7d37bbcb2ca485a2139576c97f1ea4d708` /
`fe56a8cd2f040128ab321475163af1e1e15c5e09aac8e70f534b72dabb5e9508`;
product `777`
`fb79e35d4cf66dbdc7ee251ce778d95bb6a8b17ad8fa6c7d72a89944a231368a` /
`e7003ca820b6001279181f36a5fc966297942984751f124e815ded2bba0e3285`;
product `853`
`5000878f0f2b18e03e535a79990ad125360e2e88abbf4baa49f6bdd11e4c737a` /
`0f8c27fd37d2d643622cc757f00ba2e659386f5354bc6bac5c64bed1380f74ff`;
product `1178`
`24a4af71a3f907faa7ca3de5f16d75033a60029db3d5d31ee61f662f85316bbb` /
`d863a6eb3b765659a404dea0e57a95605663ec517f958b92003c39032f975c02`;
and product `1284`
`2d560afe2f118cb1ace120ff1cb10d34d273b3013c72032859c65fc762a07670` /
`7da752f86a490b4c899cba98c3fb78273bdda946ef65f616af925f78207731af`.
Complete evidence is
[nutrition-catalog-mega-next-preparation-2026-09-14.json](rollouts/nutrition-catalog-mega-next-preparation-2026-09-14.json),
SHA-256 `39225f624813ce61c771b6517d0930de90f9deb95c175ebb71d6dbbe955d11be`.
NUT-03 remains `IN PROGRESS`. One next step is one owner decision for controlled
store -> authenticated review -> explicit-ID plans -> guarded apply of exactly
these five unchanged artifacts and 34 fingerprints.

## NUT-03 mega catalogue execution after 268 applied variants

14 September 2026, production execution after explicit owner authorization:

- Controlled store created 34 candidates, IDs `1999`-`2032`, for seven exact
  variants. Authenticated review approved the unchanged set. Five explicit-ID
  plans contained zero product updates and seven variant updates.
- Plan SHA-256 / fingerprint pairs are: product `779`
  `3e18a0afb01f538a8b1cc48497124d19d311caebcd59abdf68db1afb1bf12759` /
  `e5ebc9c637764c5379684d4893941973148bad6d87355f01b4958004769d364d`;
  product `777` `bbc1820cefa6dcc02a28a9e6b1e44c9bae5e1e5e15679a36effc1983efa71f22` /
  `b57792fc55c3111c8cec01fe65351da35a029a4f0505df89d0e26587b8c8f15e`;
  product `853` `7364930ad82e195c0786f82fa05ff6a16c4a0e5d845a36a0926ac9f8931b4637` /
  `9324e1d9b42a42161287bfa5ed8f5334496aa39aaef41554a43f95b77afe5fd9`;
  product `1178` `82a9fa8b97edd8f827babdaddb74ae397a84b1f6cda86d1e2b79bf9ece537f03` /
  `4a6e0b0ba6c7d0efbe43c45fc11837eb026aefb2e872866e20cc24e208f0f619`;
  and product `1284`
  `eae5cccb412cac915192fd19f3746ed456f505bd2d5b816032160f58d09357f7` /
  `22020456a98e9d09e41cbf7fc85aff3e9b826f5066395d6abe49fbe3c264cd79`.
- Guarded apply changed only the planned overrides. Independent readback matched
  every whole override to `after`, confirmed all 34 approvals and unchanged
  evidence, and found no product, verification-flag or legacy-creatine change.
  Coverage is now 275 applied variants: 231 complete, 44 partial and 300 without
  applied facts. NOVA remains partial because total caffeine was intentionally
  excluded rather than derived from compound mass.
- All seven exact public pages passed. Three caffeine-free families appear in
  the existing filter, N1 Pro is excluded, and NOVA with unresolved caffeine is
  not treated as caffeine-free. Replaying all five plans was safely rejected on
  stale sealed `before`, with zero extra writes.

Complete evidence is
[nutrition-catalog-mega-next-execution-2026-09-14.json](rollouts/nutrition-catalog-mega-next-execution-2026-09-14.json),
SHA-256 `5de562c6f9b5c0166090e2c4a1be594a0e247b31b2f9e822c88bfa0919fdce6f`.
NUT-03 remains `IN PROGRESS`. One next step is another evidence-qualified
multi-family preparation batch without repeating retained blockers.

## NUT-03 catalogue preparation after 275 applied variants

14 September 2026, preparation only:

- A fresh read-only production snapshot confirmed 575 active pre-workout
  variants and 275 with applied facts. Of 406 variants with a current available
  offer, 223 are complete, 44 partial and 139 have no applied facts.
- The next closed pass assessed 50 unprocessed variants and qualified nine exact
  variants across two manufacturer families. NXT Nuclear Pump product `1178`
  contributes variants `3476`, `3525`, `3526`, `3527` and `3528`; BioTech USA
  Black Blood NOX+ product `295` contributes variants `1041`, `1776`, `1777`
  and `1778`.
- Two immutable artifacts contain 41 PENDING candidates. All five facts are
  supported for the five NXT variants. The four BioTech variants contain the
  supported serving, caffeine, beta-alanine and citrulline-malate facts; their
  creatine fact is intentionally omitted because the source declares only the
  combined mass of buffered creatine and creatine citrate, without individual
  component masses that the current single-form model could preserve.
- Both existing store dry-runs passed with 41 rows, zero product updates and
  zero database writes. Production preflight confirmed nine empty exact target
  overrides, 41 unique fingerprints and no matching existing candidates. Two
  bounded factual reviews were stored once in private `nutrition-sources` and
  passed SHA-256 readback.
- The package stopped below the 50-variant ceiling because the other 41 assessed
  variants retain recorded formula-generation, exact-pack, serving,
  flavour-applicability, access or source-retention gaps. No blocked value was
  inferred or joined across incompatible versions.

Artifact SHA-256 / fingerprint pairs are: product `1178`
`d3b19b2e209ce51f840e2666e18f3c8342d46a1e88a196942c36e8b4b56bcc03` /
`6046db30a36ac74859dbcf28100fc32f6d4beac04150a041b89f2602af3152f0`;
and product `295`
`a8dc66aac4c82a1f9ebe3fe01f52af35c4f6c36af88b62f33cbea2cda242a2d2` /
`44ceec62d5d12415daba53e29047eb0be81c414b590db25d65dd00cd6cd09938`.
Complete evidence is
[nutrition-catalog-next-after-mega-preparation-2026-09-14.json](rollouts/nutrition-catalog-next-after-mega-preparation-2026-09-14.json),
SHA-256 `8183dbfdd4c4ae8699dd5384565b605ee597739b1466b237445973e44e2624cb`.
NUT-03 remains `IN PROGRESS`. One next step is one owner decision for controlled
store -> authenticated review -> explicit-ID plans -> guarded apply of exactly
these two unchanged artifacts and 41 fingerprints.

## NUT-03 high-volume continuation preparation

14 September 2026, preparation only:

- A continuous pass assessed the next 50 unprocessed catalogue variants after
  coverage reached 256. Exact version, serving or retained-access conflicts
  were skipped without stopping the remaining work. Seven variants qualified:
  C4 Original 30 servings (`1879`, `1880`), C4 Ultimate (`3927`, `3939`),
  Optimum Nutrition Gold Standard 330 g (`1731`) and 10X Extreme Stim 600 g
  (`887`, `888`). All seven have all five tracked facts.
- Four immutable artifacts contain 35 PENDING candidates. All store dry-runs
  pass with zero product updates and zero database writes. Production preflight
  confirmed seven empty exact target overrides, 35 unique fingerprints and no
  matching candidates. Four factual reviews were archived privately and their
  hashes passed independent readback.
- The evidence-qualified package stopped below the 50-variant ceiling because
  43 assessed targets retained concrete formula-generation, pack/serving,
  flavour-applicability or source-retention conflicts. Older C4 195 g and C4
  Ripped 180 g catalogue packs were not joined to different current official
  pack formulas; retained Total War, NXT and other recorded blockers were not
  guessed or re-audited.

Artifact SHA-256 / fingerprint pairs are: product `961`
`c832a06c0e53f80d3a2861aacc4b9d1bdea3f942e112bf35cbe11a82703af2cf` /
`3471dc9fe3558dd9170b3d2a777762084d0d9a3dbe499cbfd6fcf7a17b65a745`;
product `1332`
`79a9afa9899c74ed0291cb860573bd0e2934975d2f7523cae1a2979bb98ee627` /
`16ed8c1c3b1fe51aa932133b0a9623fa868c3771577be6a28f141a43dda442e4`;
product `17`
`4e8e5cdb4d18593a248219aca5c50c08e1d5c3a83cce0a8df878933febaab4f7` /
`d78150e3d97be7e639ca93569140c3cf8f767a3a4fcc0975db164325646235f6`;
and product `757`
`c46cde88ff4adf753db31cd673be8e9c4fdf58d1a62cb775b00b0f5e3b43ae5a` /
`864e50f34229adf74e4d5077c01ba30fd0591fa185ec9b887c3878b2189af8f6`.
Complete evidence is
[nutrition-catalog-huge-next-preparation-2026-09-14.json](rollouts/nutrition-catalog-huge-next-preparation-2026-09-14.json),
SHA-256 `3ae2fdf6e9fb7b145eb2851e7a68869e513b30367d347588b4c6ea89e59b4e3a`.
NUT-03 remains `IN PROGRESS`. One next step is one owner decision for controlled
store -> authenticated review -> explicit-ID plans -> guarded apply of exactly
these four unchanged artifacts and 35 fingerprints.

## NUT-03 high-volume continuation execution

14 September 2026, production execution after explicit owner authorization:

- Controlled store created 35 candidates, IDs `1939`-`1973`, for seven exact
  variants. Authenticated review approved the unchanged set. Four explicit-ID
  plans contained zero product updates and seven variant updates.
- Plan SHA-256 / fingerprint pairs are: product `1332`
  `a0b5761810bfc21dae8198b0afc49acd78a2f8c33786bd135ce552fe08b54e63` /
  `dde2bd2c09f20c2bcb1c47ea4133bb263b53ebdd1baebd4318b42c499b2bc579`;
  product `17` `4a8b3cb254b2bf2ac58683138e5620b9091caed43f1cf19d0c57c036e15d6eba` /
  `a18e946df79e18a0eff0d00c9a11367c0862ac9aa31bc54cc6d07877ffe5a702`;
  product `757` `ea35a5b62123812fc109eac208806f89f06dff068d71e5f131fc99f7189ae3fe` /
  `8354f3ea59e99834fe928255ca114cb2c662f36099e305307e79adfb5e69ff14`;
  and product `961` `3285a4526af11bf1cd0de68431d87f4565ae6922e85cba32553a488d02a02bb2` /
  `4a1fa4c665ce7d41ac46ed3aac814873580deecca33d1a15886a7fcef24b8959`.
- Guarded apply changed only the seven planned `nutrition_override` objects.
  Independent readback matched every whole override to `after`, confirmed all
  35 approvals and unchanged evidence, and found no product, verification-flag
  or legacy-creatine change. Coverage is now 263 applied: 220 complete, 43
  partial and 312 without facts.
- All seven public pages passed exact-variant and fact checks. No target appeared
  in the caffeine-free filter. Replaying all four plans was safely rejected on
  stale sealed `before`, with zero extra writes.

Complete evidence is
[nutrition-catalog-huge-next-execution-2026-09-14.json](rollouts/nutrition-catalog-huge-next-execution-2026-09-14.json),
SHA-256 `834b536e5ce9890c5c861691dcfd19c4d94c6a5f930a9f10d5a2fd1e029adf9d`.
NUT-03 remains `IN PROGRESS`. One next step is continuous evidence-qualified
family preparation without repeating retained blockers.

## NUT-03 continuous catalogue preparation after 263 applied variants

14 September 2026, preparation only:

- The next continuous pass assessed 50 unprocessed catalogue variants and
  qualified five exact variants across three families: Innovapharm MVPRE 365
  product `845` variants `1229`, `2772`; Ghost Legend V4 product `6` variant
  `1741`; and NMP Liberty Swell product `979` variants `1915`, `1917`.
- Three immutable artifacts contain 25 PENDING candidates. All three existing
  store dry-runs passed with 25 candidate rows, zero product updates and zero
  database writes. Production preflight confirmed five correct product-variant
  bindings, empty target overrides, 25 unique fingerprints and no matching
  existing candidates.
- Three factual reviews were written once to the private `nutrition-sources`
  archive. Independent downloads matched SHA-256. No candidate, review or
  catalogue record was written in production.
- The package stopped below the 50-variant organizational ceiling because the
  other 45 assessed targets retained specific generation, pack/serving,
  flavour-applicability, current-offer or source-retention conflicts. Those
  facts were not guessed or joined across incompatible versions.

Artifact SHA-256 / fingerprint pairs are: product `845`
`6978057ad9c40956f70d7eea5ba43b8ebf32a1006112ce959e32f13b4cddf82e` /
`681b4fc5fac9c2256ea0966390a5288f90a1c3d2a2e7b38d98913811e98654fb`;
product `6`
`2dbb66758a836a468d69b305821b9bbff578a7a7207f85d21de37bd78fc4bbcf` /
`2539988a2f7ded38d3b55c345b2f00209629fc85f1beb2af157b60f520c27b25`;
and product `979`
`b10a0ca6abea92338cf5df18ee77d52188244e3f4729071e61890b947c46eb66` /
`3fa6d357d5a5a9e4744e22a4c47086155cb99cc1184193ce3437547290f05313`.
Complete evidence is
[nutrition-catalog-next-continuous-preparation-2026-09-14.json](rollouts/nutrition-catalog-next-continuous-preparation-2026-09-14.json),
SHA-256 `b8017f9813d955a9034e63216b20634ec555334e77e33c8c3d36dd602cbb4f62`.
NUT-03 remains `IN PROGRESS`. One next step is one owner decision for controlled
store -> authenticated review -> explicit-ID plans -> guarded apply of exactly
these three unchanged artifacts and 25 fingerprints.

## NUT-03 continuous catalogue execution after 263 applied variants

14 September 2026, production execution after explicit owner authorization:

- Controlled store created 25 candidates, IDs `1974`-`1998`, for product `845`
  variants `1229`, `2772`; product `6` variant `1741`; and product `979`
  variants `1915`, `1917`. Authenticated review approved the unchanged set.
- Three explicit-ID plans contained zero product updates and five exact
  `nutrition_override` updates. Plan SHA-256 / fingerprint pairs are: product
  `845` `ccae846cd919b2cfc74a3a3bc3217a095ec286168efcd2a6d6bc80307aed6672` /
  `81257be480e4b37a120aa9aaed32217a82d31b5225150c392eb5d11916f7ff1e`;
  product `6` `c06482d87efc3d175c23ec7a4c341ba962cbd3aac41a087a892dc4368c63a707` /
  `3f6e6e8be3b54dc28f4f9639e3a271c10cb141a7e8a6dfcbe357d3358f563f3f`;
  and product `979`
  `d478f2aea7a7547b37ce9366fe6f523831012f038cdaeda894e3ed2ec663e778` /
  `e855b63b0b40010557c1a0a9a22b646e0db2f737655ea31ba949c029a4574413`.
- Guarded apply changed only the five planned variant overrides. Independent
  readback matched every whole override to its sealed `after`, confirmed all 25
  approvals and unchanged evidence, and found no product, verification-flag or
  legacy-creatine change. Applied coverage is now 268 variants: 225 complete,
  43 partial and 307 without applied facts.
- All five exact public variant pages passed. Liberty Swell is visible under
  the caffeine-free filter using existing product-card grouping; the three
  stimulant variants are excluded. Replaying all three plans was safely
  rejected on stale sealed `before`, with zero extra writes.

Complete evidence is
[nutrition-catalog-next-continuous-execution-2026-09-14.json](rollouts/nutrition-catalog-next-continuous-execution-2026-09-14.json),
SHA-256 `d3183bbdcfabad256fcfb4a41378ed28222a26ff68a3716f80e9e2f2820998d3`.
NUT-03 remains `IN PROGRESS`. One next step is another evidence-qualified
multi-family preparation batch without repeating retained blockers.
