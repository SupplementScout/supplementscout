# Simply through the existing shared review publisher

## 28 November 2026 — current Draft revision

The existing PR #559/worktree is reused on main
`06fa1c2db85c5abfb20bb3896e35ed29f3fe58ef`; the original two commits and evidence
below remain historical. This revision preserves the 9 September owner decision:
monitor exactly its original 27 IDs, with no review-row writes. The historical
list contains 593, not 595; neither 596 nor 669 is in it. No later standard
publication approval was found. The profile therefore uses the now-existing
`OWNER_AUTHORIZED_ARTIFACT_ONLY` mode. The common composite prepares evidence
and skips automatic publication; the deployed-profile guard rejects same-run
publication even if an artifact claims AUTOMATIC. A later exact authorized retry
uses the existing owner confirmation, baseline/decision protection and publisher.
The binder exposes its existing profile mode as metadata. The workflow uses a
distinct preparation step name in owner-only mode, so the watchdog's existing
exact publication-step matcher cannot mistake artifact preparation for a write.

Current main already supplies complete-source owner-mode validation, immutable
source binding, publication authorization and durable rollout handling. Reuse
those paths instead of the older Draft's duplicate capture checks and proposed
per-profile durable-availability guard. No production control is removed: that
proposal was never deployed. OFF/absent retains the shared legacy preparation
semantics; ON binds DURABLE_REQUIRED and enforces storage/registry verification.
No rollout control is changed and local ON mocks are not production proof.

Artifact 15207952662 has an overwritten final dry-run (117 VERIFY_NO_CHANGE)
but preflight/apply evidence for 116 VERIFY_NO_CHANGE plus one UPDATE_STOCK.
The original artifact must fail exact classification comparison. Its 120/117/3
case is replayed locally with explicitly derived pre-execution evidence; source
capture timestamps and original ZIP remain unchanged. Future native runs use
the existing binder/sealedFiles before apply/idempotency can overwrite captures.
596/669/670 remain SOURCE_MISSING, KEEP_UNCHANGED, review-only, without execution.
Tests cover dynamic/empty partitions, lifecycle, exact identities/manifest,
bindings/expiry, owner-only admission, protected mock publication/idempotency and
unchanged Discount regressions. No SQL, manifest, executor or source-reader change.

Release and standard publication require a separate owner decision naming the
final reviewed SHA and replacing the historical no-review-row-write policy.
This Draft does not grant that decision, enable AUTOMATIC or publish old evidence.

## Historical 19 November proposal

Status: **NEEDS_OWNER_APPROVAL**. This Draft PR proposes publication policy v1
for the existing120 approved offers. It does not authorize production publication,
commercial writes, migration, merge or deployment. No new publisher or executor.

## Three individual source cases

READ ONLY21:07 confirms the approved manifest/mapping bindings remain unchanged.
The complete fresh Shopify feed21:21:24Z returns HTTP200,264products/457variants,
finishes pagination with an empty page, passes the existing source-health ratio,
and contains none of the following product or variant IDs:

| Offer | Existing product/variant | Finding |
|---|---|---|
|596 Vegan Vitamin D3 400iu|15934273716573 /64643276996957|No exact record or verified replacement in the complete feed.|
|669 Vitamin B6 Tablets50mg|16212558479709 /64756981727581|No exact record. A magnesium/B-complex search candidate is a different product, not a verified rebind.|
|670 Ginkgo Biloba1500mg|15934241440093 /63499230052701|No exact record.6000mg tablets and10000mg capsules are different identities, not replacement proof.|

Direct mapped HTML/product-JSON requests returned429. No bypass or retry loop
was used. Withdrawal, a changed-ID successor and an alternative correct source
URL remain UNKNOWN. Mapping continuity is verified; current commercial identity
cannot be reconfirmed from an absent record. SOURCE_MISSING review is supported
by the complete healthy feed and known mapping, not by invented OOS or a guessed
replacement. None of the three has an active card; the lone old1030/670 is
formally PENDING but expired27September. It is historical evidence, not an
active review that can be counted as publication.

## Where BLOCK/0 applies

The current discovery policy remains byte-for-byte BLOCK, maximum_missing=0,
ratio=0, report_only, catalogue_creates=false. Without explicit isolation, the
existing reconcileMissingMappedVariants rejects missing mapped variants.
With the already deployed --isolate-unsafe=true, it returns reviewOnly=true,
newUnavailableCount=0 and leaves source rows unchanged; the shared classifier
quarantines the missing targets. Global completeness and anomaly guards still
run. The current native dry-run44595008949 already proves117SQL-validated safe
rows plus3review without writes. Adding a publisher cannot authorize missing
variants as executable rows or change this discovery policy.

The missing link is that no Simply publication profile or workflow source binding
exists. This PR proposes the versioned simply-supplements-automation-review-source-v1
contract: only fully accounted source-missing review in the existing120 scope,
KEEP_UNCHANGED, automatic_action=false, low confidence, null source price,
MANUAL_REVIEW_IDENTITY. Approval of this exact PR SHA is approval of that
review-only publication policy; an actual publication still needs separate
owner authorization and fresh protected production evidence. No product IDs
are special-cased in runtime code.

## Integration and guards

The profile is configuration in the existing central registry. Its generic
complete-source validation requires HTTP200, finished pagination, SOURCE_HEALTH
PASS, SQL/read-only VALIDATOR PASS, exact executable/review coverage, no synthetic
unavailable rows and zero catalogue creations. Missing/failed evidence and any
unsupported reason reject binding, rather than generating an empty card.

The existing Simply workflow captures a read-only baseline and binds immutable
pre-execution evidence before apply, exposing exact artifact ID/digest and source
contract/review fingerprints. The existing composite publisher reconciles and
uses the same guarded publication RPC and sealed-artifact enforcement. Its job
is allowed only on protected main with all binding outputs. An artifact upload
failure is no longer masked. A new review-only choice reuses the existing mode
pattern: it can prepare/publish reviews after approval without applying117offers;
the default remains dry-run. Existing cron05:07, application gates, approver,
atomic executor and business policy are unchanged. Watchdog publication names
bind the actual composite wrapper, avoiding the historical name mismatch.

Read-only repository/environment variable lookup found no
DURABLE_SEALED_ARTIFACTS_ENFORCEMENT value; the existing rollout interprets this
as OFF. This task does not set or override it. Because publication here requires
durable registration, the profile opts into a generic guard in the existing
reconciliation builder: OFF/absent rejects publication preparation; ON uses the
existing DURABLE_REQUIRED REVIEW_REGISTRATION contract and common seal/verify
boundary before RPC mutation. Other profiles keep their existing rollout policy.
Production activation is therefore BLOCKED on a separate owner decision about
the existing durable rollout. This Draft PR must not be deployed as if that
prerequisite had already passed. No flag, service, registry or table was added.

The proposed contract intentionally rejects other review classes; it does not
silently extend price/stock/identity authority. The existing central capability
matrix labels Simply's manual identity cards REVIEW_ONLY so the corresponding
panel section can show them; it adds no execution adapter or executable capability.
Discount's identity cards remain UNSUPPORTED and Gym's remain REVIEW_ONLY.
No prices, stock, products, variants, URLs or history are
changed by a review card. Source-missing is never treated as OUT_OF_STOCK.

## Verification and release boundary

Local replay of the real production report/diagnostic and read-only baseline:
old registry rejects unknown profile; proposed code accepts120=117+3, with exactly
596/669/670 as noncommercial manual review. This is LOCAL validation, not a new
protected source binding of the proposed SHA or a production publication.

Tests cover strict BLOCK/0 quarantine, healthy complete source, SQL validation,
all120 rows accounted, unsafe/partial/429/changed scope, source-binding and sealed
files, safe review-only workflow gates, unchanged cron/default, generic composite,
stable requests, idempotency/no duplicates and the other registered profiles.
The unchanged371-file quality inventory seal verifies; final gate receipts
accompany the Draft PR. No SQL or schema change is needed.

Owner decisions: approve exact PR SHA and publication policy v1; separately
resolve the existing durable registration prerequisite without bypassing it; approve controlled
workflow/application release; then approve one fresh bounded review-only run.
Do not approve OOS, deletion, rebind or commercial identity correction by merging
this PR. Global LIVE VERIFIED remains withheld while the natural worker schedule
and deployed native monitoring are BLOCKED.


## 28 November 2026 — AUTOMATIC policy preparation (PR559 remains Draft)

The newly supplied owner decision supersedes the earlier no-review-write
restriction only within approved120 SOURCE_MISSING. Previous dated records
above remain historical evidence. Starting head: 6e60250eeda411e8df4b39f773746da07a60d1f9;
main: 06fa1c2db85c5abfb20bb3896e35ed29f3fe58ef. Inherited PR delta was
15 files, +1211/-5; this task's incremental delta must be reported separately.

One shared requireCompleteSourceValidation property controls the existing
complete-source block, independently of publicationMode. OWNER profiles retain
it unconditionally at profile construction; Simply explicitly requires it in
AUTOMATIC. Other automatic profiles retain their previous validation policy.
There is no second validator. The pre-change local diagnostic-pagination
mutation rejected under OWNER but passed a naive AUTOMATIC flip; the fixed
parameterized matrix rejects all 30 independent mutations under both modes.

The binder seals publication_mode in the immutable source contract and emits
the same value. Simply's v2 contract domain invalidates old v1 review-scope
fingerprints; explicit OWNER authority also rejects. Legacy v1 contracts for
unchanged consumers remain readable. Reconciliation carries verified authority;
the publisher checks deployed authority independently. Only actual schedule
can use Simply's same-run publisher, checked against both runtime event and
GitHub source-run metadata. Unreleased manual review-only is removed. Existing
manual apply business requirements are unchanged and manual dry-run publishes
nothing, including when diagnostics emulate schedule.

The source-missing lifecycle filters active cards by the existing profile
matcher before planning operations, preserving the RPC's global active-count
baseline. Unrelated cards sharing an offer remain untouched. Same-run shared
publication reuses the existing retry seal reader/validator for one read-only
postflight after RPC; missing/conflicting/non-APPLIED seals produce no receipt.
The existing receipt includes source/contract/scope, authority, request hash
and idempotency binding. CLI/composite outputs carry status and the exact file
SHA only after success. The watchdog's unchanged generic step matcher targets
the receipt verification step: accepted APPLIED/ALREADY_APPLIED, exact file
hash and successful refresh job (including postflight/idempotency) are required.
Outer composite success alone cannot satisfy it. No new production helper,
publisher, executor, workflow, dependency, table, RPC or migration is added.

The retained raw ZIP still rejects classifier actions drift. A separate local
reconstruction retains 120/117/3 and original timestamp, then uses synthetic
GitHub context, mocked RPC/publication seals and a historical validation clock.
Cards596/669/670 remain SOURCE_MISSING, KEEP_UNCHANGED, automatic_action=false,
execution binding none; mock mutation occurs once across two identical calls.
The actual configured receipt shell passes APPLIED/ALREADY_APPLIED and rejects
skipped/failed publication, incomplete refresh, wrong hash and missing receipt.
These are local regressions, not fresh GitHub evidence or production proof.

Evidence location (ignored, no raw artifacts committed):
tmp/simply-automatic-review-publication-2026-11-28. Current durable rollout is
absent/effectively OFF; OFF and ON regressions reuse the existing sealed system.
New focused, Guardian, inventory, quick/full and actual-head CI evidence must
be retained before final handoff. Production273/pending0, STAGING120, eBayv3/322,
322 EPN bindings and historical89/86/170 remain protected. No actual production
publication, business mutation, manual dispatch, merge or deployment is part
of this task. Global watchdog freshness/backlog status is not claimed PASS.


## 28 November 2026 — legacy publication compatibility closeout

The owner authorizes a minimal correction, regression gates, commit/push and
Draft PR559 update after the release STOP at8eacdec1; no new-SHA merge or
deployment is authorized. The unconditional authority equality rejected the
existing schema1 authorized-retry format. Adding metadata to the old259-op
fixture hid that regression. Its original test body is now restored exactly:
FAIL before the correction and PASS after it, without publication_mode.

The existing run() recognizes only schema1 reconciliation reports with both
authority properties truly absent, only on authorized-artifact-retry, and only
when the profile does not require bound authority. Existing retry checks still
authorize the exact execution: workflow/event/repository/main, owner confirmation,
run/artifact/digest/SHA, expiry, service-role target, request hash, expected state,
execution/decision protection and publication seals. No current authority is
inferred, assigned or written into historical bytes. Explicit report/source
authority is checked independently; null, empty, unknown and contradictory
values reject. Missing authority never admits a legacy same-run publication.

Simply uses the declarative requireBoundPublicationAuthority profile setting:
both report and source metadata, plus immutable contract authority, are mandatory
for AUTOMATIC/v2. Complete-source validation, scope120, actual-schedule admission,
SOURCE_MISSING isolation and no execution binding stay unchanged. Other profiles
keep their modes; 10 Reps remains OWNER_AUTHORIZED_ARTIFACT_ONLY. No new production
helper/parser/publisher/retry system, SQL, migration, dependency or workflow.

Regressions retain the original259-op idempotency case, legacy authorization
failures, existing consumers' old/current formats, strict new authority, Simply
missing/tampered authority and seal failures without automatic RPC retry.
Reuse the sealed73-file release-preflight evidence:19 real seals,8 exact stored
request/JS/SQL hashes, service-role SELECT and3 zero-operation seals. The expired
10 Reps artifact is not replayed or rewritten. New local gates and actual-head CI
are recorded separately under tmp/simply-legacy-publication-compatibility-2026-11-28.
All production writes/publications, manual dispatches, imports, migrations, eBay
API calls, merge and deployment remain zero. Historical evidence is preserved;
Predators Gear untouched.
