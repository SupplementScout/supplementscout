# Gladiator Nutrition refresh recovery — 22 November 2026

Status: **local correction prepared; production recovery BLOCKED**. No release,
publication, approval, apply, migration or production data write is authorized
by this evidence. Base main: `c6955304074dc96ae3dd37d7c2759cb1861f1286`.

The owner-authorized minimal E/K closeout below supersedes the earlier
profile-only implementation scope. Historical incident and STOP evidence is
retained; no production recovery or release is claimed.

## Existing implementation and live state

- [PR #400](https://github.com/SupplementScout/supplementscout/pull/400)
  merged on 27 October as `7f903d95f3a3870f9bf4279625937d45d5cd7b2e`.
  Later natural executions prove activation; the preparation PR alone does not.
- The existing shared workflow is active. Its Gladiator job retains the exact
  `17 8 * * *` schedule, protected main context, 603-row manifest, shared Shopify
  reader, classifier, validator, approval/executor, postflight and idempotency.
  Staging retailer 12 and its separate 46-row manifest remain unchanged.
- Last proven complete natural run:
  [44576527715](https://github.com/SupplementScout/supplementscout/actions/runs/44576527715),
  commit `3a0ee9a1953b2715053182b8a0ec2e80357de9bd`. Apply completed
  **19 November 17:42:15 UTC**, refreshing all **603** offers. Postflight passed:
  603 freshness updates, zero price, stock, shipping or URL changes, zero business
  price-history delta. Fresh-source idempotency passed at 17:43:19 UTC.
- Production READ ONLY at **22 November 11:16 UTC**: 603 mappings and 603 offers;
  every `last_checked_at` is `2026-11-19T17:37:47.665Z`. **0 fresh / 603 older
  than 48 hours** (about 65.64 hours). All 603 exact manifest-to-canonical variant
  identities match; all variants are active. All 603 offer URLs preserve the
  same product path, exact Shopify variant and `sca_ref` affiliate parameter.
  Shipping and total-price arithmetic match the existing policy on all rows.
  Values and URLs are unchanged from the failed run's database baseline.
- Existing migration verifier, `--mode=preflight`, passed READ ONLY:
  **CURRENT270**, fingerprint
  `ea11b69343c2100ecf38078a6920eb3b7478fc6ee4633bb65fc7657c39c2ae2a`,
  production pending `[]`, database writes `0`. The existing Gladiator
  registration RPC is present; validator EXECUTE privilege is present. It was
  inspected, never called.
- Active-parent inventory: **0 Gladiator parents**. Latest parents are COMPLETED.
  No active/unconsumed fixture approvals were found. Queue contains 21 EXECUTED,
  one EXPIRED and one FAILED stock card; none has a live expiry. There is no
  current `PRICE_OBSERVATION_DEFECT` card. The sole historical FAILED execution
  is review 2390, request `b1129cb6-57c7-488e-9f69-7cce63e0bfdb`, closed on
  27 October at `VERIFIED_ZERO_BUSINESS_WRITE_CLOSEOUT`; no retry is proposed.

## Incident and cause

[Run 44923097560](https://github.com/SupplementScout/supplementscout/actions/runs/44923097560),
21 November 16:10 UTC, ran on `ab24fc203f89297dce424468b62c0184198ec875`.
Gladiator job `136903177143` captured a complete healthy source (HTTP 200,
161 products, 881 variants, 603 approved matches, zero missing, 278 unmapped
report-only variants). Source semantic fingerprint:
`33589932d59c60ab2153e209c9a5fcce6988ada996cb2b7df2a7ad9d812960e5`.
The historical 155/852 and 249 unmapped counts are not current capture counts.

Dry-run and SQL validation passed. The classifier correctly held **416
MASS_PRICE** price changes (68.99%, beyond the unchanged 20% aggregate guard),
leaving **187 VERIFY_NO_CHANGE** offers executable. No stock transition or
missing approved variant was present. This partition describes the 21 November
capture, not a new source observation.

The diagnostic classifier scope correctly covers all 603 offers. The publication
profile only recognized MASS_OOS as a classifier-held review reason, so it
incorrectly expected that scope to contain only the 187 executable rows. The
existing binder raised `Gladiator Nutrition preflight classifier scope drifted`.
Simply adding the reason to that count would still leave the existing review
normalizer unable to represent price-only review rows.

No source contract was completed. Apply, approvals, DB postflight and fresh-source
idempotency were skipped; Gladiator publication was skipped. This is a local
contract/profile mismatch, not a migration, manifest, freshness, timeout or
registration failure. It reproduces unchanged on current main. The H&B profile
already handles the same aggregate reasons; the correction reuses that shared
capability without changing other retailer profiles.

Incident artifact: `gladiator-nutrition-offer-refresh-44923097560-1`, ID
`14714646325`, GitHub archive digest
`sha256:91e911c442cd983b7f73072c870531536b0411cf6fdfe6cda304496516527118`.
Downloaded report, diagnostic and baseline reproduce the exact failure.

[Run 45011972562](https://github.com/SupplementScout/supplementscout/actions/runs/45011972562)
is green for a different scheduled job selection; Gladiator is SKIPPED. It is
not recovery evidence. The 21 November scheduled Gladiator run started hours
after its nominal cron; no new Gladiator execution was observed by 11:25 UTC.

[Watchdog 44994261610](https://github.com/SupplementScout/supplementscout/actions/runs/44994261610)
correctly reports stale Gladiator offers, incomplete latest attempt and backlog
growth. Its separate Discount/Simply findings are outside this correction.
No watchdog policy or threshold is changed.

## Current source limitation and shipping

On 22 November the existing neutral Shopify reader, using its normal market,
pagination, no-cache and User-Agent settings, received **HTTP 429** from this
audit environment. No protection was bypassed and no archived capture is
treated as fresh. The initial local TLS trust-store issue was resolved by using
Node's system CA store, retaining certificate verification; the subsequent 429
is separate from the proven binder bug.

Therefore today's source completeness, unmapped count, fresh prices and stock
remain **UNVERIFIED**. Historical examples on 21 November: offer 3887 was
29.99 → 32.99 GBP; 3896 was 64.99 → 66.99 GBP, with unchanged stock. These are
dated evidence of the review trigger, not prices safe to publish today.

The official [shipping policy](https://gladiatornutrition.co.uk/pages/shipping)
lists standard mainland delivery at 6.99 GBP and free delivery **over** 75 GBP;
Highlands/offshore have a separate 7.99 GBP rate. The existing code uses
`>= 75.00` for free delivery. The wording alone does not prove the exact
75.00 GBP checkout boundary or promotional exceptions. Neither shipping policy
nor offer values are changed by this correction; exact-boundary live checkout
verification remains outstanding.

## Minimal correction and verification

Only the existing Gladiator publication profile changes: recognize MASS_PRICE
and MASS_CHANGE in classifier coverage and reuse their existing shared
read-only policy definitions. MASS_OOS keeps its existing stock-review path.
Price-review cards remain POLICY_REVIEW / MANUAL_REVIEW, KEEP_UNCHANGED,
non-executable, without commercial proposed values or execution authority.
No offer-specific exception, new runtime, dependency, migration or guard change.

The existing reconciliation test suite adds the incident's 603/187/416 shape,
real binder/contract/card/reconciliation checks, both aggregate reasons and
publication idempotency. Negative cases retain rejection of wrong classifier
scope, source identity, source fingerprint, diagnostic writes and unknown
review reasons. Test inventory was reviewed: no file was added/removed/renamed;
the existing 371-file seal remains valid.

The new incident regression fails on the original profile with the exact live
error and passes after correction. Replaying the downloaded incident artifact
through the actual current loader and contract builder also passes locally,
with 187 executable rows, 416 read-only reviews and zero catalogue writes.
This replay is not publication or fresh-source validation.

Local validation: `verify:quick` PASS (1369 passed, three existing skips, zero
failures); `verify:full` PASS (4142 passed, three existing skips, zero failures).
The full gate includes TypeScript, ESLint, baseline migration validation and the
Next.js production build. ESLint retains four existing unused-variable warnings
in the unrelated queue pagination integration test; the isolated worktree build
also reports its existing workspace-root inference warning. Project Guardian
passed before and after ledger/evidence updates, and `verify:inventory` passed
with its unchanged seal. No SQL changed; database integration tests were not
needed for this profile-only correction. Production recovery/live closeout
remain BLOCKED.

## Safe next step requiring separate owner approval

1. Review the narrowly scoped Draft PR and final CI. Authorize its controlled
   code release separately; no migration or source/guard threshold change is
   needed for this contract correction.
2. After an approved release, require a new complete healthy source capture by
   the existing mechanism. If HTTP 429 persists, STOP this retailer; do not
   substitute archived data, rotate identity or bypass protection.
3. Use only the existing protected schedule and shared approval/executor flow,
   current ledger/fingerprint and active-plan guards. Verify exact current
   partition before any approval. The archived 187/416 split is not authority.
4. Safe independent rows may refresh only within that existing approved path;
   current aggregate price changes remain review-only. Any commercial decision
   on them requires separate exact fresh evidence and owner authorization.
5. Confirm actual production apply, independent postflight, fresh idempotency,
   preserved affiliate URLs/history and subsequent watchdog evidence. Only
   then declare live recovery. No manual apply or workflow dispatch was run
   during this audit.

## Owner-authorized minimal E/K closeout

The 22 November owner instruction permits minimal changes in existing Draft564
and local verification only. Merge, deployment, migration, cron changes,
production approval/apply and Review Queue publication remain prohibited.
Both remote heads were rechecked before editing: main `c6955304`, Draft564
`39d606df`, Draft565 `25f70336`; both PRs were clean, open and Draft. The
architecture audit's production readback at 22:07 UTC remains evidence of
CURRENT270 and no active batch approvals for these retailers, not new apply
authority. No source capture or production write was performed in this closeout.

### Minimal existing-policy wiring

- E: set the existing `guardrails.allow_two_capture_price_confirmation` opt-out
  to `false` in the Gladiator production profile, matching the existing H&B
  mechanism. This changes routing of hard-price anomalies, not any numeric
  guard threshold. The classifier retains HARD_PRICE_ANOMALY in quarantine;
  no automatic price-confirmation proof is emitted and no unsupported
  retailer15 confirmation reaches SQL. This restricts an attempted automatic
  path; it does not grant one. The policy fingerprint changes normally because
  the existing fingerprint includes configuration. Old artifacts are not reused.
- E/K: connect only the existing HARD_PRICE_ANOMALY and
  CANONICAL_IDENTITY_CONFLICT entries from SOURCE_REVIEW_POLICIES to Gladiator's
  `readOnlyReviewPolicies`. Existing normalization, canonical evidence checks,
  source contract, cards and reconciliation are reused without modification.
- Retain MASS_PRICE/MASS_CHANGE binding and their read-only cards from the
  original correction. Classifier coverage is unchanged: canonical and hard
  price quarantines are excluded from executable classifier scope; aggregate
  rows retain the existing mixed-partition accounting.
- No common engine, classifier, reader, publisher implementation, approval,
  executor, SQL, manifest, affiliate URL, numeric guardrail or cron is changed.
  The one opt-out is stored under `guardrails`; claiming that the entire
  configuration object is byte-identical would be incorrect.

E and K are synthetic regression scenarios, not newly observed production
incidents. The last audited real source partition remains dated evidence:
187 VERIFY_NO_CHANGE and 416 MASS_PRICE, with no stock changes. A future
release must obtain its own fresh source and cannot assume that partition.

### Normal cron authority for a separate owner decision

The unchanged `17 8 * * *` cron uses the current main independently of Vercel
deployment readiness. It can create technical parent/child approvals; those
records are not owner Review Queue decisions. This table describes capability,
not authorization to run or release it during this task.

| Class | Existing cron capability | Owner decision and possible writes |
| --- | --- | --- |
| VERIFY_NO_CHANGE | Automatic after validation | No individual queue decision in ordinary cron; offer `last_checked_at`, existing control/audit records and applicable confirmation evidence. No price/stock change. |
| UPDATE_STOCK | Automatic only inside existing guards | Normal-policy authorization must be explicit for this release; offer `in_stock` and freshness, control/audit records. No identity or URL change. |
| UPDATE_PRICE | Automatic only below hard and aggregate limits | Normal-policy authorization must be explicit; offer price/total/freshness, derived delivery if the unchanged threshold policy requires it, exact price history and control/audit evidence. |
| UPDATE_PRICE_AND_STOCK | Automatic only when every guard passes | Same bounded authorization; combined fields above and exact history. |
| HARD_PRICE_ANOMALY, MASS_PRICE, MASS_CHANGE | Isolated, REVIEW_ONLY | No automatic commercial writes; prepared cards preserve KEEP_UNCHANGED and have no execution binding. A card is not authority to apply a price. |
| CANONICAL_IDENTITY_CONFLICT | Isolated, MANUAL_REVIEW_IDENTITY | No product/variant/mapping/offer creation or rebinding; identity resolution needs a separate decision. |
| MASS_OOS | Isolated stock review | Existing supported one-row Review Queue path needs an unexpired exact owner decision, fresh source, matching database and protected executor. Ordinary cron cannot approve the card. |
| Missing mapped variant | Source review | Never infer OOS or a replacement identity. Independent safe rows may continue. |
| Invalid IDs/schema, collapse, stale source, fingerprint/ledger drift, unexpected shipping-only drift | BLOCK | No approval or apply for the blocked path; never relax a guard to continue. |

Existing protections remain: exact603 manifest and Shopify variant IDs,
source health/completeness/freshness, row and global price/stock guards, mapped
source confirmation, source/policy/artifact/expected-state/ledger fingerprints,
dedicated validator/approver/executor roles, serialized writers, expiring
single-use approvals, per-child atomic SQL and exact deltas including history
and other-retailer protection. No arbitrary owner exception is manufactured.

Recovery is per existing contract: retain checkpoints and consumed approvals;
do not replay a failed or unknown write. Read back exact applied children and
business state first. A later child failure does not undo earlier commits.
Control-only closeout or data recovery uses the existing narrowly scoped path
and its required separate approval. No recovery or rollback was executed here.

### Local verification and eBay boundary

The four added cases are in the two existing test files; no file was added to
the371-file test inventory. The existing inventory hash remains valid. The
original39d606 policy replay fails three new checks (hard-price builder,
hard-price publication, canonical publication), while canonical isolation itself
already passes. The corrected focused suite passes242 tests, including both
aggregate reasons, E/K isolation, unchanged safe price/stock siblings, affiliate
URLs, source/policy fingerprints, publication idempotency and malformed
canonical-evidence rejection. These are local simulations with forbidden
database constructors and an injected read-only source, not production writes.

`verify:quick` passes1371 tests, with three existing SKIP and zero FAIL;
TypeScript and ESLint pass (four existing unrelated warnings). `verify:full`
passes4146 tests, three existing SKIP and zero FAIL, including baseline migration
validation and the isolated-configuration Next.js production build. Project
Guardian passes before/after the evidence update; inventory and diff checks pass.
The final pushed SHA must also pass its normal GitHub Quality Gate and Guardian.
The existing targeted SQL suites return1 PASS/2 SKIPPED because the local Docker
daemon is unavailable; actual disposable PostgreSQL execution is NOT_RUN.
No test SQL was sent to production. No SQL change is required by this fix.

Draft565, its branch/worktree and2739/7584 correction remain unchanged. Its two
existing focused suites pass169 tests. Serialized definitions of every other
publication profile are identical to39d606. A non-mutating `git apply --check`
of the complete code/test delta against565 succeeds; no patch/rebase/merge was
performed. Its shared execution-ledger insertion must still be combined with
Gladiator's entry when updating565 after a separately approved564 release.

### Next release gate

The owner must separately approve the final564 SHA and explicitly authorize
the ordinary cron's four bounded classes above for the existing603 scope,
including their exact freshness/history/control writes. E/K and aggregate price
reviews remain non-executable. No manual workflow/apply,416-price decision,
new identity, migration or release of565 follows from this preparation.
Before that release, recheck main/head/CI, live ledger and active plans, cron
timing, and that no other process has already released it. Require fresh natural
capture, actual apply of the allowed partition, independent postflight, fresh
idempotency, correct Review Queue publication and a later correlated watchdog.
PRODUCTION RECOVERED remains NO until those live receipts exist.
