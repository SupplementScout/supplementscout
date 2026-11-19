# Simply through the existing shared review publisher

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
