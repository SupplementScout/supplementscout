# PR559 — existing global durable rollout impact

**28 November revision note:** the analysis below describes the unmerged
19–20 November proposal and its then-current ledger. Its evidence is preserved.
The current Draft reuses main's existing OWNER_AUTHORIZED_ARTIFACT_ONLY mode
and common rollout semantics instead of that proposal's per-profile OFF guard.
It neither enables automatic publication nor changes global enforcement.
Production remains 273/pending 0. See the dated current revision in
[the Simply integration note](SIMPLY-REVIEW-PUBLICATION-HARDENING-2026-11-19.md).

Status: **BLOCKED for release / NEEDS_OWNER_APPROVAL**. PR557 alone is authorized
for deployment. This analysis does not enable DURABLE_SEALED_ARTIFACTS_ENFORCEMENT,
merge PR559, publish reviews, alter commercial refresh, grant privileges or apply
SQL. No runtime correction is included. PR559 remains Draft.

## Current production read-only evidence

20November08:50:36Z: the repository variable and production-readonly environment
variable are absent; effective existing mode is OFF. The private sealed-artifacts
bucket and immutable registry exist. Bucket:10MiB limit, public=false, JSON in the
MIME allowlist. Registry: RLS enabled, service_role SELECT/INSERT available. There
are8 registry rows and8 bucket objects; counts alone do not prove object integrity
or end-to-end Phase B readiness. Publication RPC remains the same service-only
security-definer function, SHA09dd34b96dec68c88a5c16bf63820f0d39ca02f6eb3329c5f1586b9feacc38ab.
Positive production sealing/fresh-verification rehearsal was NOT_RUN because no
such writes are authorized. Ledger remains CURRENT269, pending=[].

## Actual propagation of the repository variable

Changing a GitHub repository variable does not implicitly populate every Node
process. The following existing producers explicitly pass the variable through
their job/action environment. Each newly bound REVIEW_REGISTRATION then uses
the one common reconciliation-apply guard and RPC.

| Existing workflow | Publishers affected by ON |
|---|---|
|fit-house-offer-refresh.yml|Fit House,10Reps,Gladiator Nutrition,Holland & Barrett|
|gym-high-full-catalogue-apply.yml|GYM HIGH|
|creatine-offer-refresh.yml|Discount Supplements|
|ebay-offer-refresh.yml|eBay's existing reconciliation producer/apply|
|automation-review-publication-retry.yml|Consumer of previously bound exact registrations; no rebinding/backfill|

PR559 would add Simply Supplements as an eighth explicitly integrated retailer.
Whey Okay, Jon's and6Pack are configured in the shared profile registry, but their
current native workflows do not pass this variable to this composite publisher.
Registry membership alone does not make their schedules newly durable-required.
No retailer-specific flag or second rollout mechanism is proposed.

The common import-products.writeDryRunArtifact producer also binds APPROVED_PLAN
when the caller's process env/rolloutEnv is ON and the target is explicitly
production/staging/test. A repository variable alone does not alter unrelated
CLI processes without that environment wiring. The existing approveArtifactPlan
and pilot-only applyArtifactPlan consume exact file bytes through
guardLoadedPlanMutation before approve_product_import_plan or
apply_approved_product_import_plan. Their approval, fingerprint and atomic
execution contracts remain authoritative; ON does not grant execution permission.

## Exact change at the mutation boundary

OFF/absent: existing producers leave legacy artifacts unbound and do not initialize
Storage/registry sealing. ON: integrated producers put the versioned
durable_sealed_artifact_contract inside the exact generated JSON bytes. Only
target-bound APPROVED_PLAN and REVIEW_REGISTRATION are currently integrated at
these choke points; other durable-required classes are policy definitions, not
evidence that every producer is already integrated. No historical backfill occurs.

The consumer preserves original bytes and checks parsed-object equality, artifact
kind and environment. It seals with private Storage upload(upsert=false), reads
and verifies the bytes, registers the immutable identity, and performs fresh
verification again before the existing mutation callback. Missing/corrupt object,
registry failure, wrong metadata/kind/environment, ambiguity or digest mismatch
blocks the dependent RPC. A failed registry insert can leave an unadopted object;
there is no auto-heal/delete/upsert bypass. Existing reconciliation idempotency
and recovery remain authoritative.

Prerequisites include server-side service-role credentials, reachable Supabase
Storage API, private bucket metadata, object info/upload/download permissions,
immutable registry SELECT/INSERT and uniqueness/trigger contracts, correct target
project and full40-character code SHA, allowlisted MIME/kind, artifact<=10MiB,
explicit no-secrets declaration and all required metadata. Mere SQL access or
matching object/row counts is insufficient. Exact new artifacts must be tested
through the real protected environment before global activation.

Returning the variable to OFF stops new bindings. It does not disable guards on
already bound files, delete objects or registry rows, or turn a bound artifact
into legacy. Retrying a previously applied publication can return ALREADY_APPLIED
with zero mutation; an unapplied bound retry must still seal and freshly verify.
Existing unbound historical files keep their legacy path even while ON, so ON
is not a blanket backfill or assertion of all-history durability.

## PR559 merged while OFF: commercial and publication behaviour

The source binding step runs before commercial apply. Its complete-source and
SQL-validation requirements must pass; the durable-required guard is located in
reconciliation buildOutput, not in bindSource. With the currently valid117+3
partition, binding can succeed while OFF. The existing commercial apply,
postflight and fresh-source idempotency steps retain their existing conditions
and do not depend on the later publisher job. They can finish before publication.

The new refresh-review-queue job would then call the common builder. Simply's
requireDurableReviewRegistration guard rejects OFF/absent before publication;
the queue RPC is not called and the job/workflow becomes FAIL. Thus merging this
revision under current OFF unnecessarily adds recurring publication failures to
the existing daily commercial workflow even when commercial refresh succeeds.
A future source failing the newly required binding contract can also stop the
pre-apply path; it must never be described as a guarantee of unaffected refresh
under arbitrary source changes.

**Do not merge the current PR559 while OFF.** Two possible future decisions are:
separately authorize and positively verify the existing global ON rollout across
all affected consumers before activation, or separately review a minimal
publication-job availability policy that leaves commercial refresh operational
while publication is unavailable. The latter must still forbid publication
without required sealing; it cannot bypass the common guard. Neither a policy
revision nor global flag change is authorized or implemented by this task.

## Proposed activation evidence and release boundary

A later approval must name exact code/SHA and the global variable's blast radius,
confirm the existing Storage/registry/ACL contracts in the actual protected
environment, and authorize one bounded positive seal/fresh-verify/publication
proof plus the existing failure-before-RPC tests. Then observe all seven existing
integrated publishers and the intended new Simply path, and explicitly account
for new APPROVED_PLAN consumers when their callers receive ON. Do not reuse
an old capture as fresh source or expand catalogue/discovery/identity authority.

No new migration is proposed; an unexpected prerequisite or schema discrepancy
requires STOP and a new scoped decision. At present the positive production
proof and rollout are NOT_RUN. Source-missing BLOCK/0, manifests, approval RPC,
atomic executor and original cron remain unchanged.

## Compatibility and tests

PR557 main857847abbed3ab5f05f45274e739b290a4cdf562 contains the exact approved
watchdog tree. GitHub reports PR559 MERGEABLE/CLEAN without conflicts. The
original47047426 implementation remains in history; this follow-up adds only
analysis/evidence. Existing publisher, Simply workflow and shared reconciliation
tests repeat82/82 PASS, including OFF/absent rejection, ON durable registration,
storage/registry failure before mutation, stable requests and REVIEW_ONLY without
an executor. Prior standalone project/baseline/quick/full PASS remain valid for
unchanged runtime; final-SHA CI tests the current merge candidate. Positive local
adapters are not a positive production rehearsal.
