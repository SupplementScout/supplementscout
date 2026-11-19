# Shared canonical review publication

Status: **NEEDS_OWNER_APPROVAL**. A separate Draft PR after completed PR556;
production publication, catalogue writes, migration, merge and deployment NOT_RUN.

## Individually verified incidents

READ ONLY21:07 preserves all4580 offer identities and mapping states. Neither
offer3399 nor3545 has an active or superseded Review Queue card. Their approved
manifest bindings are unchanged. Fresh protected current-main dry-run44617220470
captures the source at21:18:10Z and returns950=836executable+114review, with
zero write attempts/completions. Counts145 from ordinary44508522817 and147 from
the17:30 dry-run remain historical snapshots, not counts of this fresh source.

* 3399 is Refined Nutrition Ultra Vitamin C1000mg90 Tablets, external product
10999/variant10999, canonical product1213/default variant3635. The canonical
parent also has11 active explicit variants4313–4323. The feed returns its
mapped source record; the problem is unresolved canonical Default identity.
* 3545 is Naughty Boy Creatine Monohydrate, external product3953/variant9368,
direct mapped source URL selecting150g, canonical product1301/default3781.
It has one active explicit sibling4438. This is independently evidenced; the
eleven-sibling case must not be copied as its explanation or proposed correction.

Both are CANONICAL_IDENTITY_CONFLICT/BLOCK_IDENTITY_DRIFT with proposed_offer=null
and price/stock/URL changes false. The existing shared classifier/early quarantine
already isolates them correctly. No alternative canonical binding is approved.
The source reports actual expected and observed offers; review evidence does
not infer a new stock state or resolve a default to an explicit variant.

## Small shared correction

The10Reps publication profile previously accepted missing-source and MASS_OOS
review; its mixed normalizer rejected the canonical reason before a source
contract could be sealed. A READ ONLY/local replay of the real report and DB
baseline reproduces "review reason drifted for offer3399" on current main.
This was a closed publication contract, not lost cards after a successful
publication of those two records.

The profile now opts into only the existing CANONICAL_IDENTITY_CONFLICT read-only
policy used by other profiles. classifierReviewReasons remains [MASS_OOS]: these
canonical rows are quarantined before that classifier scope and must not be
pretended to be executable or classifier-covered commercial rows.

The existing shared normalizer additionally checks canonical evidence against
both offer and mapping product/variant IDs, requires Default=true and a nonempty,
unique explicit-sibling list excluding the Default. It rejects incomplete
evidence, identity substitutions, proposed offers and commercial field changes.
This validation also protects existing profiles using the same canonical policy.
No retailer, offer, product or sibling ID is hardcoded in implementation.

The existing common card policy emits IDENTITY_CONFLICT/MANUAL_REVIEW_IDENTITY,
KEEP_UNCHANGED, automatic_action=false, sourcePrice=null, retaining the actual
canonical evidence. It adds no executor, capability, approval route or write RPC.
Current source files, before-state, fingerprints, protected GitHub binding,
sealed registration, reconciliation RPC and permissions remain authoritative.

## Verification and boundaries

Local validation of real native evidence succeeds under the proposed contract:
950=836+114, including precisely3399/3545 as two noncommercial manual reviews.
The snapshot is not a protected run of the proposed SHA and no publication RPC
is called. Actual future publication requires fresh native validation and
binding after a separately approved release.

Regressions exercise two distinct canonical proofs, missing/wrong/default/sibling
evidence, unknown reasons, commercial proposals, immutable source binding,
stable request/idempotency fingerprints and zero CREATE when matching cards
already exist. Existing publication, quarantine, owner approval, atomic executor,
SQL/RPC security and all-retailer suites remain part of the project gates.
The existing test inventory has no added/removed/renamed file; its seal verifies.
Final local gate receipts accompany this Draft PR.

This change is independent from the watchdog correction and Simply's distinct
source-missing publication policy. No new table or migration is needed. Owner
approval must identify the final PR SHA, release scope and a separate bounded
fresh review-only publication; it does not authorize identity corrections,
catalogue expansion, changed stock/price policy or Predators Gear.
