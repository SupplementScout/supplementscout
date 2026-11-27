# Reviewed catalogue package workflow

This is the common path for new retailer catalogue onboarding. New retailers
must use this package contract instead of adding another retailer-specific
approval or execution runner.

## Reviewed URL validation

V2/V3 packages keep the direct merchant URL and outbound affiliate URL separate.
The existing `validateManifest()` checks HTTPS, URL encoding, credentials and
the direct URL's retailer hostname. It validates one explicit destination in a
tracking path (`/destination:...`) or query parameter. Supported carrier names
are `destination`, `dest`, `url`, `redirect`, `redirect_url`, `redirect_uri` and
`target`. A destination must equal the reviewed direct URL after standard URL
parsing, including origin, port, product path and query. Tracking parameters on
the outer URL remain unchanged. Duplicate carriers, nested redirects, malformed
encoding and additional decoding layers fail closed; no alternative target is
selected after rejection.

An affiliate URL without an explicit carrier remains allowed by this contract,
including opaque Awin links, eBay tracking parameters and `sca_ref`. These checks
do not establish the final network redirect destination. Validation makes no
network requests and never rewrites either stored URL. The package loader runs
this check before the existing protected approval/apply calls. SQL independently
binds the exact approved plan and both raw URL fields; it does not duplicate the
embedded-carrier parser. The SQL correction passed the existing atomic/URL,
bounded-state and V3 integration tests on disposable PostgreSQL 17 on 11 November
2026. It remains excluded from both shared-environment migration selectors;
deployment requires separate authorization and the existing prerequisite checks.

## Inputs

A package consists of:

- one tracked owner-reviewed manifest under `config/retailers/`;
- one ignored canonical CSV under `tmp/retailer-feeds/`;
- one ignored dry-run artifact under `tmp/retailer-feeds/`;
- exact SHA-256 bindings for the manifest, CSV and artifact;
- one reviewed row and plan fingerprint for every intended mapping.

Source product and variant identifiers are strings. The common package does not
assume Shopify, WooCommerce or numeric identifiers. Source-specific readers may
normalize a feed into the canonical CSV, but they must not add approval or
production-write logic.

## Preparation

Generate the canonical CSV, run `scripts/import-products.js` in `--dry-run`
mode with the reviewed manifest arguments, and seal the resulting artifact in
the manifest. The package validator requires zero blockers and conflicts, exact
row counts and exact product, variant, mapping, offer, price-history and
shipping actions.

Run the shared read-only gate before owner approval:

```text
node scripts/reviewed-catalogue-package-executor.js --target=<staging|production> --mode=preflight --manifest=config/retailers/<manifest>.json --manifest-sha256=<sha256> --profile=<profile> --output=tmp/retailer-feeds/<retailer>/preflight.json
```

Version 1 packages require `--target=production`. Version 2 packages carry an
exact `STAGING` or `PRODUCTION` environment and Supabase project reference;
the CLI target, credential endpoint, login role, transaction marker and
manifest must all agree. Both targets use the shared verify-full PostgreSQL
TLS helper and a trusted private CA path.

## Controlled apply

After the owner approves the exact manifest scope and the reviewed files are on
`origin/main`, run the same command with `--mode=apply` and a new ignored output
path. Apply mode refuses a dirty tracked working tree or a local commit that is
not exactly `origin/main`.

The executor opens one protected direct PostgreSQL connection for each existing
role: validator, approver and executor. It never uses Supabase/PostgREST or a
service-role key. For every row, in manifest order, it:

1. creates a fresh 15-minute approval bound to the manifest, artifact, profile
   and plan fingerprint;
2. atomically applies only that approved plan;
3. verifies exact row-count deltas and reads back the product, variant, mapping,
   offer and initial price-history row;
4. stops immediately on the first mismatch.

Connections are reused across the package. Previously completed rows are not
re-queried after every item, which keeps runtime close to linear as packages
grow. Each plan still has its own transaction, approval and readback.

If any source row is already mapped, the package fails preflight. Generate a
fresh package containing only the remaining rows; do not replay an old
artifact. A package may contain only one product-creation anchor for each source
product family. Create additional sibling variants in a fresh package after the
parent exists.

## V3 canonical identity evidence

A V3 reviewed row may carry the optional, versioned
`canonical_identity_evidence` sub-contract when its canonical physical or count
identity cannot be proved by raw option-role parity alone. Its absence preserves
the original V3 behavior exactly. Its presence is fail-closed and separates:

- raw facts, retained exactly from the retailer source;
- captured and hashed external facts bound to the exact product, variant and
  pack configuration;
- deterministic derived facts recomputed from versioned operands without
  rounding;
- the exact facts selected for canonical identity; and
- mandatory conflict records for every material raw/canonical difference.

Raw facts are not a self-declared subset. Every supplied raw fact must bind to
the exact key and byte-preserved value in the row's validated
`external_options`, and its role must agree with the authoritative
`option_roles`. When a selected canonical physical-size or container-count fact
displaces an authoritative normalized raw role, the contract must contain
exactly one corresponding raw fact and exactly one linked conflict record.
Omitting the raw fact, substituting another option, duplicating the binding or
adding an orphan conflict fails closed. A preserved pack-structure string does
not itself create a false scalar conflict when no authoritative raw pack-count
role exists.

The evidence review decision is a fact-provenance decision. It is distinct from
the owner's business approval and cannot be replaced by an owner override. The
sub-contract is embedded in the immutable manifest row, copied exactly into the
plan evidence and authorization envelope, and therefore covered by the manifest
SHA, artifact SHA and plan fingerprint. The executor never fetches an evidence
URL or chooses canonical values at runtime.

JavaScript validates the contract during package generation and loading. The
database validator independently checks the same closed schema, bindings,
source eligibility, derivations, conflicts, review and target projection before
approval or apply. Raw `external_options` remain unchanged. Deploy the matching
SQL function migration to STAGING and then PRODUCTION, with the usual lineage,
security and rollback rehearsal, before merging or executing evidence-backed
packages. Historical packages and clean raw-role multipacks continue through
the original path.

## Existing-product pack correction

The deployed `reviewed-catalogue-product-pack-correction-v1` canonical-update
extension is generic and deliberately narrow: one existing
`products` row, the `net_weight_g` field, one positive exact-before value and one
different positive reviewed-after value. Extra fields, identity metadata,
`product_variants`, multiple targets and stale before-state all fail closed.

Prepare an immutable local package from an existing evidence artifact with:

```text
npm run catalogue:pack-correction -- --mode=prepare --target=<staging|production> --source-artifact=tmp/<prepared>.json --source-artifact-sha256=<sha256> --source-artifact-fingerprint=<fingerprint> --evidence-sha256=<sha256> --output=tmp/<package>.json
```

After the owner explicitly approves that exact immutable scope, create a new
local seal without editing or overwriting the `PREPARED` package:

```text
npm run catalogue:pack-correction -- --mode=owner-approve --target=<staging|production> --package=tmp/<prepared-package>.json --package-sha256=<exact-prepared-sha256> --authorized-by=<owner-identity> --confirm-owner-approval=true --output=tmp/<new-owner-approved-package>.json
```

The lifecycle is `PREPARED` -> explicit local `OWNER_APPROVED` sealing ->
read-only production `preflight` -> separate explicitly confirmed production
`apply`. Owner approval validates the package fingerprint, target and every
bound evidence file, changes only its approval status and metadata, reseals a
new file, and performs no database connection or database write.

`preflight` uses the protected validator in a read-only transaction. `apply`
additionally requires an `OWNER_APPROVED` sealed package, exact package SHA-256,
`--confirm-reviewed-product-pack-correction=true`, a clean `origin/main`, a
fresh single-use approver receipt and the protected executor. The owner-approval
seal and apply confirmation are independent controls; neither substitutes for
the other.
The atomic RPC conditionally changes exactly one `net_weight_g`, compares every
other product column, verifies zero row-count delta, consumes the approval and
then undergoes a separate validator readback. The CLI writes an immutable audit
artifact under `tmp/`. Preparing or owner-approving a package does not preflight
or apply it. Version 1 supports no other canonical field.

## Phase 14 local contract proposals (2026-11-25)

These changes are local and unregistered. None of the SQL under
`supabase/proposals/20261125*` has been applied to a shared database. Default
import production remains version 2; version 3 remains the historical reviewed
create/rebind/commercial operation. No automation or public route is enabled.

The existing manual importer accepts `--dry-run --mode=manual
--contract-version=4` for existing canonical product/variant/retailer targets.
It rejects safe-create, legacy upgrade and new variants in this version. The
programmatic builder uses the same explicit `contractVersion: "4"` option.
Approval and execution continue to use immutable artifacts and the existing
single-use ledger. They require separately reviewed matching SQL installation.

Version 4 seals current product/variant GTINs, explicit physical unit counts and
optional `manual-identity-owner-resolution-v1` evidence. That evidence requires
an exact owner decision, author/time, seller, brand, canonical family, version,
source evidence SHA, source-row fingerprint and complete expected-state hash.
The source capture timestamp is mandatory, sealed in evidence and reused for
offer freshness. A local replay does not substitute its execution time for a
retained capture time. An unchanged offer retains its existing freshness.
An alias is keyed by the full native variation ID and binds literal source and
canonical flavour. It is used only for comparison; raw options stay unchanged.
There is no global synonym registry or inferred approval. Source hashing clears
only the two derived self-references (source-row hash and decision seal); the
complete decision remains covered by the plan and approval artifact hashes.

Cross-product parent membership additionally seals the exact incoming identity
and the complete current peer set, including mapping IDs and timestamps. Added,
removed or modified peers invalidate the decision. Each sequential import needs
a fresh complete peer preflight and owner-reviewed seal. A larger parent is not
permission to accept unknown children or to reuse approval for another size.

The existing pack-correction module also offers
`buildPreparedFormatPackage`: numeric `schema_version: 2`, one existing product
or variant, only `product_format: NULL -> powder/capsule`, complete parent/variant
state and existing evidence-file seals. Preparation is local and unsigned. Its
existing owner-approve/preflight/apply lifecycle remains separate. For two
Nutrend corrections, execute the variant correction first or refresh/reseal its
parent state after a product correction; do not reuse a stale two-step package.

The existing reviewed rebind module offers
`buildExistingTargetIdentityRebindPlan`: manual version 5, existing target,
exact same physical unit and explicit separately sealed owner resolution. It
preserves native IDs, GTIN, source options, commercial values and freshness, and
only rebinds the mapping and offer variant IDs. No variant, mapping, offer or
history row is created. This initial mode requires the preserved exact GTIN and
rejects managed identity-series history; it does not migrate history lineage.
The proposed outer ledger branch skips price observation recording for version
5 only. Historical version 3 retains its existing behavior.

The new private serializer emits UTF-16 sorted object keys, preserves arrays,
escapes and numeric metadata, and uses existing decimal limits. Versions 2/3
retain the original helper bytes and hashes. New JS inputs reject NUL, unpaired
surrogates and non-JSON values before sealing. Unknown versions fail closed.
No producer silently converts historical artifacts or transfers their approval.

The proposed private GTIN check covers canonical, returned and current mapping
codes, including equivalent finite leading-zero forms. A missing returned code
does not bypass it. Quarantine stays private and fully revoked; the reader
requires its protected owner to retain explicit superuser/BYPASSRLS authority,
so forced RLS cannot silently turn a denied check into an empty result. The executor
rechecks under transaction locks before DML; proposed parent/history table locks
and shared canonical-claim locks are intentionally conservative, with a five
second wait limit per additional lock, not per transaction. Predicate table locks
precede the existing row locks to avoid a row/table lock-upgrade cycle with older
writers. They still require contention/performance rehearsal before registration.
No new public RPC, table or approval ledger is
introduced. The original canonical helper and exact-237 scopes remain unchanged.

Local JavaScript tests do not establish PostgreSQL parity or production readiness.
The component integration suite uses an existing local image (default
`postgres:17.6`, override `SUPPLEMENTSCOUT_PG17_IMAGE`), verifies the actual
17.6 server, UTF8 and libc `en_US.UTF-8` database, and exposes no network,
ports or host mounts. It remains a component test with synthetic tables.
Full consumer-lineage and protected approval/apply evidence must come from the
separate isolated current-schema rehearsal; a component PASS does not replace it.

The quarantine reader guard is SECURITY INVOKER: it verifies the effective
reader of the private table, rather than escalating only its own check. New
manual standard-import approvals require version 4 through the existing
protected approval function. Existing ledger rows, feed contracts, old hashes
and the approver/executor ACLs remain unchanged. A historical artifact is never
silently resealed to cross this boundary.

Future controlled rollout order is core-v4, format-v2, identity-v5. Each proposal
guards current function owner and exact definition SHA before making a narrow
replacement. Rehearse registration on an isolated current-schema fixture first.
A deployment rollback must stop new producers while retaining compatible
consumers and private helpers for valid sealed artifacts already issued.
Restoring old consumers or dropping those helpers is blocked while such
artifacts require their consumer; it is not a safe rollback procedure.
Never close, reseal or reinterpret an owner approval to make a code rollback
possible.
Data corrections and alias/membership/rebind decisions require separate owner
authorization and fresh source/expected-state preflight after code deployment.

## Phase 15 controlled release review (2026-11-26)

This is a local release plan, not deployment or data-write authorization. The
immutable Phase 14B patch remains the starting evidence. Phase 15 evidence is
under `tmp/ebay-commercial-phase15-2026-11-26` in the main workspace. The
reviewed branch base and fresh remote main are
`f7f30e58487ff9d4ef41c6cc63df822f98c1e430`; the separate root checkout remains
`6d40b8d19f9f5a88f5d930e6621352ed86a68eb6`. Recheck these before any release.

The authorized validator's read-only system-catalog readback matches all nine
proposal input-function definition SHAs and their `postgres` owner. The private
schema is not installed. Production is PostgreSQL 17.6, UTF8, ICU `en-US`,
`en_US.UTF-8`, collation version `153.121`; Phase 14B used libc. A new isolated
ICU rehearsal confirms all 86 historical SQL fingerprints before/after, their
stored fingerprints, and new v4/v5/format-v2 serialization. This is fingerprint
compatibility, not validation/apply of all 86 historical business plans.
The validator cannot read the migration ledger. Its actual count/fingerprint
and the final three-file migration selection remain mandatory release gates;
source history is not a substitute. No approver/executor credentials were used.

| Producer / entry point | Actual final consumer contract | Release action |
| --- | --- | --- |
| Manual importer / programmatic builder | Defaults to manual standard v2; explicit dry-run `contractVersion: "4"` produces v4; existing artifact loader/approval/apply RPCs | Hold new manual approval operations during the SQL boundary; produce fresh explicit v4 only after matching SQL is installed. |
| Existing eBay offer refresh | Intermediate manual dry-run is converted to feed v2 existing-offer update or verified-no-change | Preserve exact-237 scope and scheduler; do not mistake the intermediate plan for a new manual approval. |
| Shared retailer-offer-sync, including Jons, Simply, Fit House, Discount, Gym High and Kior paths | Feed v2 / verified-no-change through existing guarded approval/apply | Preserve feed behavior; fresh code-bound runtime preflight after release. |
| Simply identity recovery and 10Reps bootstrap | Feed plans, including legacy mapping upgrade; reviewed catalogue package v1/v2/v3 envelopes are distinct from inner plan versions | Preserve current package and feed consumers. |
| Historical eBay canary | Feed v2 | Preserve old contract and existing scope. |
| Historical eBay Batch H–S bootstrap executors | Manual standard v2; each execution requests a new approval | Do not invoke them across the boundary. Existing dispatch files are not proof of an active scheduler. Future new operation must use a fresh reviewed common-path v4 artifact; never rewrite old hashes. |
| Whey Okay reviewed dry-run / closed reviewed-artifact orchestrator | Historical reviewed rebind v3 with creation/commercial deltas and source-commit binding | Preserve v3. This closed orchestrator is not a v5 executor. |
| Existing-target identity-only builder | New manual v5 via existing generic artifact loader and approval/apply RPCs | Explicit separately owner-reviewed use only after all three SQL proposals; no scheduled producer is enabled. |
| Existing reviewed pack-correction CLI | Schema v1 net-weight correction, schema v2 format fill via the same protected lifecycle | Preserve v1 semantics; enable v2 only after matching SQL and separate exact data authorization. |

No new scheduled final manual-v2 approval dependency was found in the reviewed
repository paths. Administrative new manual approvals still need the same
transition. Live workflow enablement and environment reviewer protections were
not readable through the available repository connector; an authorized release
operator must confirm them. No workflow was dispatched or changed.

Future release sequence, each step separately authorized and verified:

1. Review the final patch/manifest, current main, nine input definitions, table
   columns, owner/BYPASSRLS capability, private quarantine ACL/RLS and physical
   target. Obtain the real migration-ledger readback. Reuse
   `supabase-migration-selector.js` and `lib/environment-migrations.js` for exact
   target, hashes, ledger and exclusions; their current policy does not already
   authorize these proposals. Prepare only the three reviewed registrations.
   Do not replay historical production-only migrations or run blanket db push.
2. Reconcile in-flight source-commit/artifact-bound operations and arrange a
   controlled quiet window for new manual approvals. Confirm no H–S/manual-v2
   operation is pending. Do not alter feed schedules. Deploy compatible JS
   loaders/consumers first, keeping new producers unused through their existing
   explicit options. A merge/push can trigger full CI and the existing Vercel
   deployment; those operations require separate owner authorization.
3. Apply core v4 (`20261125100000`) first. Its own transaction also activates the
   new-manual-standard-v4 approval requirement: there is no independent runtime
   switch. The quiet window and compatible consumers must already be ready.
4. Apply format v2 (`20261125101000`), then identity v5 (`20261125102000`). Each
   file has its own BEGIN/COMMIT and guarded input lineage; do not represent the
   three files as an atomic deployment. After each step check installed function
   definitions/owners/ACLs, unchanged old canonical helper, private inventory and
   migration ledger using authorized read-only metadata. Stop on any mismatch.
5. Once all consumers are confirmed, end the manual approval quiet window and
   allow explicit fresh manual v4 production. v5 and format v2 remain explicit
   individually authorized data operations. Do not send new versions to old SQL.
   Existing valid ledger approvals keep their old consumers. An unapproved old
   manual-v2 artifact stays immutable; a future operation needs a fresh v4
   technical plan, without repeating an already granted candidacy decision.
6. Verify existing feed/no-change refreshes through their existing readbacks,
   price postflight, watchdog and performance audit. The normal quality workflow
   runs deterministic full checks; integration is weekly/manual/special main
   commit only. The new component test currently requires a local desktop-linux
   Docker context and installed 17.6 image, so do not claim ordinary hosted CI
   ran it. Preserve the recorded local integration evidence.

The v4/v5 predicate locks cover products, variants, quarantine and mappings;
v5 also covers identity series/history. Shared refresh/import executors using
the global execution advisory lock serialize before those locks. Phase 15's
local regression reproduced a legacy weight-correction row/table deadlock; the
format proposal now makes both correction versions acquire the same global
advisory lock after session authorization and before ledger/row locks. Canonical
edits, merge/rebind tools, GTIN work and nutrition writers
can overlap these tables; callers outside the shared advisory protocol remain a
contention risk. A five-second additional lock wait is per lock, not the total
transaction budget. No new index or watchdog is justified by the retained
synthetic EXPLAIN alone.

For future rollout, use existing executor/watchdog/postflight/performance logs
and authorized `pg_locks`/activity metadata to compare lock waits, duration,
timeouts, failed operations and refresh completion with the pre-release
baseline. Stop new producer activation on an attributable deadlock (`40P01`),
lock timeout (`55P03`), unexpected auth/RLS/version/hash failure, readback or
approval-consumption mismatch, existing execution-budget breach, or regression
of the exact-237 refresh scope. Do not automatically retry a partially observed
operation; establish ledger/readback state through the existing guarded path.

Recovery holds new producers/manual approval activity and retains compatible
consumers/private helpers for every valid already-issued v4/v5/format-v2 artifact.
Do not revert SQL to old consumers, drop helpers, mutate artifacts or cancel
valid approvals to facilitate rollback. The existing selected-migration
applicator executes this exact three-file set and its ledger inserts in one
transaction. Failure of the second or third file rolls back earlier files too;
271/272 are uncommitted intermediate states. Rehearsal always rolls back. If an
authorized apply commits successfully, retain the installed consumers and
complete the repository closeout before resuming dependent work. Keep the quiet
window during any unresolved failure/readback and review an exact forward
repair. Public application runtime and feed automation are outside this patch.
Shared-code release never starts data corrections/imports.

The separately sealed `owner-decisions-final.json` retains the exact listing,
variation, seller, GTIN, source-file hashes and evidence fingerprints for all 16
locally unblocked cases. It is not an approval. CNP 407/2015 acceptance and
Whey Okay mapping396/offer411 correction are distinct; correct the legacy claim
before preparing the new binding. BioTech requires current complete peers for
each sequential binding. Nutrend requires variant977 format first, then product528
format and fresh dependent state. Solgar 1438/4584 candidacy remains accepted.
Strom 819/2953 stays blocked on 120 Servings versus 120 capsules; changing only
variant_key would preserve variant IDs/FKs and numeric public variant links,
but invalidate key-bound seals and may affect identity/unit-price comparisons.
External key-based links were not exhaustively proved absent. No Strom change,
ABE claim resolution, alias, GTIN promotion or commercial import is authorized
by shared-code readiness.

## Phase 15B migration preflight (2026-11-26)

The existing production migration selector's intended release-operator
credential and exported `readRemoteState` procedure obtained a real READ ONLY
ledger readback. No role grants, approval/executor credentials, business data
queries or remote writes were needed. The ledger contains 270 migrations with
fingerprint
`ea11b69343c2100ecf38078a6920eb3b7478fc6ee4633bb65fc7657c39c2ae2a`,
matching the unchanged production selector contract. Its current selection
passes with zero pending migrations. The required baseline, Stage2, atomic
import, approval ledger, GTIN quarantine, identity-price foundation, reviewed
rebind and safe pack-correction migrations are present in the actual ledger.

The three proposals remain outside the active migration directory. Their
normalized SHA-256 values and required future order are:

1. `20261125100000_shared_import_contract_v4.sql`:
   `58a18dd55dc8b2e570ae55a23af71795680135d81886e19565d63f88eaba7593`.
2. `20261125101000_reviewed_format_correction_v2.sql`:
   `2f39d441159d174e498deb9ed244e5a076b80daeb3241931390b97362bc667f6`.
3. `20261125102000_existing_target_identity_rebind_v5.sql`:
   `0a1cbba9090fe9cab613ec1f3b0198d503d6a29e00880136e2ec06b18df1bab1`.

An ignored local preview uses the existing selector unchanged. It intentionally
rejects these three additional pending files because current production policy
permits zero. A separate owner decision must authorize their registration and
the exact pending-policy update before a future release selection can pass.
No policy or registered migration was changed. The existing
`derivePostApplyMigrationBinding` implementation, using explicit preview inputs,
derives the hypothetical post-release ledger as 273 migrations / fingerprint
`9ca37b4d56ca2815b01eb48bd4d01c37db9e06b46d4cb0c0cec2fa90673bd25b`.
This is a proposal, not a live post-apply result or deployment approval.

Fresh read-only GitHub status shows no in-progress, waiting, pending or requested
runs. Two queued unrelated PR quality checks are not manual-v2 data operations.
The H–S manual workflow definitions, including K recovery, remain active; do not
treat them as disabled. The existing consumer-first sequence and manual
approval quiet window remain mandatory before core v4 activates the boundary.

The weight-correction deadlock proof previously existed only in ignored Phase15
artifacts. The existing `shared-import-contracts.integration.test.js` now retains
a regression using the real legacy correction/approval functions, the guarded
format consumer upgrade, exact v4 predicate-lock statements, protected synthetic
roles and independent local sessions. Its scheduling barrier checks that a new
import waits on the shared advisory lock before taking table locks, and that
the correction and approval consumption roll back intact. No executor SQL was
changed in Phase15B. The existing test-file inventory/classification is retained.
After work resumed, Docker Desktop was unavailable and WslService was Disabled;
the final corrected regression therefore requires an actual local rerun before
claiming release-candidate readiness. Prior Phase15 PASS results are preserved,
not attributed to this modified test.

**27 November 2026 Phase15B closeout:** the existing local Docker/WSL environment
is available again. The unchanged corrected integration file completed with
9 PASS, 0 FAIL and 0 SKIP, including the real legacy correction versus v4 table-
lock regression and intact rollback. The container used PostgreSQL17.6/UTF8/
libc en_US.UTF-8, no network, ports or host mounts, and only synthetic data;
the separate earlier ICU fingerprint proof remains unchanged. A fresh authorized
READ ONLY production ledger readback and existing selector again confirm
270 / `ea11b69343c2100ecf38078a6920eb3b7478fc6ee4633bb65fc7657c39c2ae2a`
and zero pending migrations. No dependent H–S execution is running or waiting;
those manual workflows remain active and must respect the approval quiet window.
The previous environment blocker is closed. The candidate is ready for separate
owner review, not deployment. Consumer/SQL/test bytes are unchanged from the
26 November patch, so its quick1371/full4165 PASS and three existing SKIPs are
reused rather than rerun. The new evidence is retained separately under
`tmp/ebay-commercial-phase15b-2026-11-27`. Exact three-file policy authorization,
consumer-first rollout, data approvals and EPN preflight remain separate gates.

All later eBay data preflight/postflight must retain the correct EPN campaign,
existing itemAffiliateWebUrl, exact item/variation binding, affiliate URLs through
refresh and the existing outbound tracking, and confirm eligibility for EPN
attribution. Phase15B makes no eBay calls or artificial affiliate clicks. The
89 candidacy decisions, 86 complete packages, 170 cases and all separate data
decisions remain unchanged. Shared-code release never starts those data writes.

## Phase 16 local release preparation (2026-11-27)

The owner authorizes local registration/policy preparation and a feature-branch
commit/push/draft PR only after the stated publication and test gates pass.
Merge, remote migrations, data operations and production deployment remain
unauthorized. The existing worktree/branch is reused; no commit, push or PR has
been performed while the following concrete blockers remain.

Patch reconciliation uses the same f7f30e58 baseline and includes new files:
Phase15 to final Phase15B changes only the runbook (+76) and existing integration
file (+139/-2), totaling +215/-2 or net213. On26November the changes were +59
runbook and +139/-2 test lines; on27November the final closeout added17 runbook
lines only. The test gained the durable weight-correction deadlock regression.
The same corrected test bytes passed9/9 on27November. Runtime and SQL did not
change between those two phases; earlier sealed reports were not rewritten.

The three exact SQL files now have one local executable copy under
`supabase/migrations`, moved unchanged from proposals. Their original bytes are
retained in sealed evidence. `environment-migrations.js` pins exactly their
three SHA-256 values as PRODUCTION pending against ledger270. Staging excludes
these three files by exact identifier/hash; its three existing pending Review
Queue migrations and ledger120 remain unchanged. No production data producer
is activated by a local file move. A fresh READ ONLY ledger/selector readback
before preparation still confirmed270 and zero deployed pending migrations.

The existing selector and closeout derivation cover exact three-file order,
271/272/273 fingerprints, missing/modified/extra files, wrong environment and
baseline, wrong policy/readback order and fingerprint, and repeat attempts.
At273 the unchanged pre-apply selector rejects replay. The existing post-apply
verifier derives the exact closeout; a separately reviewed repository closeout
must then record273 and consume the pending list. Do not widen the pre-apply
selector to accept an intermediate or already-applied ledger.

**Publication blocker:** Vercel metadata exposes the same sensitive Supabase
URL/service-role and administrative environment entries to preview and
production. No secret values were decrypted. Existing feature-branch deployment
history is present, while the available project metadata does not establish an
isolated preview data target or complete Git/build trigger configuration. Owner
instruction section8 requires withholding push/PR when that isolation cannot be
confirmed. Remote configuration/protections are unchanged; no CI-skip workaround
or automatic deployment was attempted. The existing GitHub PR jobs are baseline
validation, deterministic full quality gate and Project Guardian, with no database
credentials; scheduled/manual production workflows are not dispatched by them.

**Migration blocker:** the existing applicator's `unwrapTransaction` requires
BEGIN as the first non-whitespace token. All three sealed files contain header
comments before BEGIN and fail that existing contract. The applicator guard and
SQL bytes remain unchanged: the owner forbids modifying SQL merely to register
it or weakening guards to force PASS. The failing pending-file regression stays
enabled and prevents claiming a complete quality-gate PASS. SQL parsing via local
psql is not proof of compatibility with the guarded release applicator.

Phase16 evidence, the complete file-by-file reconciliation, local policy preview,
actual test logs and an unpublished English PR description are retained under
`tmp/ebay-commercial-phase16-2026-11-27`. Both blockers must be resolved under
explicitly appropriate authority before commit/push/PR. Existing consumer-first
activation, quiet window, lock monitoring, artifact-preserving recovery and all
separate commercial/EPN/data approvals remain binding. No commercial status,
exact-237 automation, public runtime or Predators Gear path is changed.

## Phase 16B blocker resolution and future repository closeout (2026-11-27)

The Phase16 sections above preserve the historical blocked result. The owner
subsequently authorized moving each existing leading SQL comment block after
the unchanged BEGIN line. All comments remain intact; removing only that moved
block gives byte-identical before/after payloads for all three files. Function
definitions, ACL/RLS/ownership/search_path, locks, algorithms and versions are
unchanged. The strict applicator and its failing regression were not weakened.
The new exact hashes are:

| Migration | Current SHA-256 |
| --- | --- |
| `20261125100000_shared_import_contract_v4.sql` | `a763b5dea4c79540e8ec1d189147e66f42af1d252dd1b3837d5fcf9a98b8c27d` |
| `20261125101000_reviewed_format_correction_v2.sql` | `a144b66e910ec0fe129a9f3851359587602aba36c911563622f49adf71390e10` |
| `20261125102000_existing_target_identity_rebind_v5.sql` | `4b96590a67a5ca5e3268a54ba514159d4d9e5b25e02642077ed7713e01d2df0e` |

Only these new pending/exclusion/test bindings were resealed. Historical
migration hashes and earlier sealed artifacts are unchanged. A fresh authorized
READ ONLY production readback still gives270 /
`ea11b69343c2100ecf38078a6920eb3b7478fc6ee4633bb65fc7657c39c2ae2a`.
The actual selector chooses exactly the three files above, in that order.
`derivePostApplyMigrationBinding()` recalculates273 /
`9ca37b4d56ca2815b01eb48bd4d01c37db9e06b46d4cb0c0cec2fa90673bd25b`.
This projected fingerprint is unchanged because ledger hashing binds ordered
identifiers/names/environment, while file SHA checking is a separate guard.
STAGING stays120 with its original three Review Queue pending migrations;
these three PRODUCTION files remain exact exclusions there.

The unmodified actual CLI passed local verifier preflight and rehearsed all
three files on synthetic PostgreSQL17.6/UTF8/ICU en-US/en_US.UTF-8. It used verified
TLS, a dedicated disposable Docker network, a single127.0.0.1-only port and no
host mounts. Catalogue counts, public function hashes, private schema and270-row
ledger were unchanged after rollback. Independently forced lineage failures in
files2 and3 each rolled the entire set back. The pure existing closeout API
accepted synthetic273-row readback and required consuming exactly three pending
entries; no production apply/receipt or local apply-mode COMMIT was performed.
The retained nine PostgreSQL component tests also pass, including the durable
legacy weight-correction deadlock/rollback test. Current full logs and exact
old/new payload evidence are separately retained in
`tmp/ebay-commercial-phase16b-2026-11-27`.

The only Vercel configuration added is repository-root `vercel.json`, with
`git.deploymentEnabled["feat/shared-import-contract-integrity"] = false`.
Unspecified branches, including main, retain their defaults; there is no
matching true rule or competing local vercel.ts. Official Git configuration
supports this branch-specific setting. One accessible team has one repository-
filtered project, `supplementscout`. Available project/deployment API metadata
omits effective Root Directory and Git/build settings. The current production
build reports entrypoint `.`. On27November the owner supplied a current Dashboard
readback for team SupplementScout, project supplementscout: Root Directory is
`./`, with no settings change. This confirms that the repository-root config is
in the effective project root. The exact branch rule is included in the first
feature push; the same rule covers its later PR-triggered Git deployment path.
No other local deploymentEnabled rule enables that branch. Together with the
official branch-specific Git configuration contract, this closes the missing
configuration proof. After integrity/prepublication checks, the owner authorizes
the feature commit/push and one draft PR, followed by actual GitHub CI and Vercel
deployment-history readback. Earlier blocked checkpoints remain historical.
Shared preview/production environment entries remain unchanged and no secret
values were read. Remote settings, merge, deployments, migrations and data
operations remain outside this authorization.

For a separately authorized future release, prepare and review the exact central
repository closeout before applying SQL, but retain today's270 baseline and
pending list until real successful apply/readback. Use the existing consumer-
first sequence and owner-controlled quiet window; immediately before release
check active/queued/waiting runs and their source commits. Current readback
shows none in progress, queued, waiting, pending or requested; manual H-S paths
remain active and must not race the boundary. This phase dispatches/stops none.

The actual applicator commits the complete set once (270 to273). Obtain its
real post-apply ledger readback/closeout evidence and use the existing verifier
to establish exact273 and the derived fingerprint. Only then update
`CONTRACTS.PRODUCTION.ledgerCount` and `.ledgerFingerprint` in the selector and
consume exactly `PENDING_MIGRATIONS.PRODUCTION` in environment-migrations.
Preserve all environment/project/physical bindings, historical hashes and
STAGING policy. Verify inventory, exact derivation, selector/verifier/closeout,
quality gates and actual ledger again; release that central closeout before
resuming dependent workflows. A stale270 source commit or sealed execution
artifact must fail closed, not accept arbitrary fingerprints. Minimize the
database/repository mismatch window with the already reviewed closeout and
quiet window; neither272 nor273 is accepted by the old pre-apply selector.

Fit House,10Reps,Gladiator,Holland & Barrett and the Simply,Discount,Dolphin,KIOR
wrappers share the Fit House engine's central migrationBinding. Jon's imports
the same binding directly; Whey Okay imports it through Jon's. One central
closeout updates these ten retailer paths without editing their workflows.
eBay exact237 and6Pack use distinct artifact/feed contracts and shared protected
import RPCs, with no static JS dependency on the central migrationBinding;
their exact manifests/approvals cannot be silently resealed or transferred.
Central control readback/ACL checks also use the selector. Historical one-off
tools and separate STAGING RA004 contracts are not assumed active. Retain old
evidence; refresh only current technical source-commit/binding-dependent
dry-run/validation artifacts after closeout, preserving all owner identity and
scope decisions. No automation definition or commercial status changed.

All37 workflow hashes match Phase16. Feature push can run Baseline Validation;
PR can run Baseline Validation, Quality Gate and Project Guardian through the
existing supabase/docs filters. No required checks are disabled. The available
remote protection API does not expose a required-status list, so no external
Vercel check requirement or bypass is assumed. Scheduled/manual production,
staging-write and Predators jobs are not dispatched by these branch/PR events.
Publication requires positive Vercel proof and all final local gates first.

## Permanent boundaries

- Owner review remains mandatory for product identity and production writes.
- SKU is never treated as GTIN.
- Canonical updates and category changes remain forbidden except for the exact
  reviewed product-pack correction contract above.
- The runner performs no direct business-table DML. It calls only the existing
  approval and atomic apply RPCs.
- Price and stock automation starts only after catalogue onboarding is complete
  and uses a separate guarded refresh workflow.
