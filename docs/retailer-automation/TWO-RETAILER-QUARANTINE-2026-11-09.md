# Two-retailer quarantine repair, 9 November 2026

Draft preparation against main `2f669cd6e9aa7a10a7c8f1833fb765792ce112e2`.
No merge, source dispatch/capture, publication, approval, migration, recovery,
commercial write or schedule restart. This is not restoration evidence.

## Existing mechanisms and the gap

- `feed-variant-guards`: `parseSize`, pack/format parsing and
  `assessVariantCompatibility` already distinguish conflicting dimensions from
  incomplete evidence. Six now reuses the compatibility check to admit only
  technically bound uncertainty to the existing quarantine. No new conversion.
- `six-pack-canary-builder`: `commercialIdentity` already normalizes units and
  serving tokens; `liveIdentityDrift` also checks literal conversion/name order.
  That global comparator remains unchanged. Six previously threw its result
  before the classifier could see a missing source row.
- `reviewed-catalogue-v3` and `reviewed-catalogue-canonical-evidence`: existing
  physical/count parsing and canonical evidence require independently bound
  facts, source-row fingerprints and provenance. The legacy Six approved
  manifest seals bindings, not a V3 fact package. A product flag cannot replace
  merchant evidence or create a reviewed identity assertion.
- `nutritionMetrics.ts` and `pricing.ts`: verified serving metrics and price per
  serving already exist. Canonical Reflex product457/variant1050 has verified
  510g,17 servings,30g. Existing functions confirm that canonical relationship;
  they do not independently prove the merchant's current selected variant.
  No duplicate servings-times-serving-size arithmetic or runtime TS loader.
- Existing `SOURCE_VARIANT_MISSING` classifier quarantine emits no executable
  row, price/stock/URL delta, freshness confirmation or approval. Both fixes
  hand uncertainty to this path; classifier, executor and Review Queue unchanged.

The necessary new code is the guarded handoff, not a second normalizer. Six
requires the existing complete HTML document identity, exact parent/variant,
canonical URL, current capture provenance, unique selected offer, valid price,
and matching known SKU/GTIN. Hard dimensional/brand/format/identifier conflicts
remain fatal. Missing merchant identifiers do not establish equivalence.
Canonical brand/GTIN readback is private evidence, outside closed plan objects.
Reviewed apply modes cannot use this uncertainty handoff.

Fit's helper verifies all78 immutable historical bindings against the current
284 ACTIVE+2 HISTORICAL partition (76 active audited+2 withdrawn). Only a
healthy complete feed with `isolateUnsafe` may leave unknown absences for the
existing classifier. It never synthesizes OOS for those rows. The two withdrawn
rows cannot acquire synthetic OOS. Reviewed modes remain strict. Other retailer
profiles retain their generic reconciliation. Both confirmation captures use
the same rules.

## Retained evidence and real replay limits

Six run [42656307444](https://github.com/SupplementScout/supplementscout/actions/runs/42656307444),
artifact13691844225, ZIP SHA256
`f1823d2a4f8c7f2ad0a5a4f89bc3cf46dd2900fafce889e3dd5a63140412cbd4`.
Capture:2026-11-09T16:36:29.075Z. Scope504 ACTIVE+2 HISTORICAL/277 active parents.
Parsed271 parents/490 mappings; isolated6/14; fatal capture0; not reached0.
The115 original errors are retained verbatim in the regression fixture, SHA256
of their JSON serialization:
`4ef2e73677a57ed88c131dbd9ede29cb215d76b680216cd1c3709bb5e1500c19`.

| Existing-parser grouping | Rows | Authority from saved evidence |
| --- | ---: | --- |
| Same normalized measure and name words; order differs |24| Dimensional agreement only |
| Same measure; spelling/brand/name ambiguity |18| No commercial equivalence |
| No measure tokens in merchant title, other name differences |66| Incomplete identity evidence |
| Missing supplementary serving count (Reflex31593) |3|510g does not prove merchant17 servings |
| Selling-unit conflict (parent4566,12x75g versus75g) |4| FATAL; no uncertainty bypass |

The saved report contains page hashes/provenance and error names, but not parsed
selected offers/attributes, price, stock, SKU/GTIN or original HTML for those
parsed pages. Another375 parsed mapping rows have no retained normalized input.
Consequently a full classifier/SQL validator replay is NOT_REPLAYABLE:

| Six active accounting | Rows |
| --- | ---: |
| Commercial VERIFIED from retained input |0|
| Previously source-isolated REVIEW_ONLY |14|
| Proved hard unit conflict |4|
| Insufficient complete source input (111 incident candidates+375 others) |486|
| Total |504|
| Safe executable plans reconstructed |0|

Those111 candidates are not111 confirmed new review rows. The existing14
isolations include Warrior7; no commercial proposals are reconstructed.8628
was reached in this run (HTTP200/PARSED), but its commercial identity remains
unverified. No ingredient/withdrawal decision is reopened.

Fit run [42647242017](https://github.com/SupplementScout/supplementscout/actions/runs/42647242017),
artifact13688062486, ZIP SHA256
`1abf7a57f5f3147315652cae2f88f8d94e6a7824f17d20317d5f0c73c135b299`.
Complete diagnostic envelope:231 products/326 variants, stable OOS104 PASS.
Confirmed absences: mapping690/offer698,2042/1856,2044/1858,2045/1859.
The other280 active raw source rows were not retained. Full classifier replay
is NOT_REPLAYABLE; no executable plans are claimed from the diagnostic alone.

The regression fixture preserves actual286 Fit bindings,115 Six incident
bindings, all115 error objects,62 page records and the actual missing-row and
1859 receipt evidence. It labels itself partial; it contains no invented source
offers. Tests emit `tmp/quarantine-repair/real-offline-replay.json` without a DB
client or production writer credentials. Separate, explicitly synthetic contract
tests exercise the entire active scopes and cannot establish live VERIFIED rows.

To avoid repeating this evidence gap, a future failed Six normalization retains
the existing parsed reader output in its diagnostic, bounded to2MB. It reports
an explicit budget/serialization omission and never masks the original error.
This adds no reader, capture, cache, fetch, or retry.

## Verification and release boundary

Regression tests cover all115 retained cases, existing nutrition/pricing,
504+2 and284+2 accounting, strict incomplete capture, wrong parent, real units,
brand/SKU/GTIN, stale provenance, invalid price, collapse/MASS_OOS, no commercial
apply/freshness for review rows, aggregate fatal failure and retained inputs.
Fit full-scope contract:280 normal rows+4 SOURCE_VARIANT_MISSING; no synthetic
OOS and no repeat of1859. Its existing EXECUTED1114 receipt/idempotency PASS,
stock=false, OOS104 and durable transitions697/983/1859/1982 are preserved.
Six synthetic contracts demonstrate variant-only and whole-parent quarantine;
their503/501 plan counts are test results, not a forecast for the saved source.
Local focused371 PASS/0 SKIP; quick1061 PASS/3 existing SKIP; full3712 PASS/3
existing SKIP. Both quality gates PASS, including TypeScript, ESLint and the
isolated production build; Project Guardian before/after documentation PASS.
The three pre-existing skips are the historical10 Reps v8 closed-bootstrap,
Time4 and remaining-profile cases, not passes. Exact-head CI/Guardian results
belong in the draft PR checks.
No SQL/RPC/schema contract changed; PostgreSQL integration is not required by
this change. No SKIP is counted as PASS.

Production baseline is the prior read-only16:52:09Z receipt:CURRENT262,
fingerprint `209719c865f07c9e77006d01f7ae526aa47461b9a0bd5154071b4f29052c8333`,
business/control/approval/history state unchanged, no active target plans.
Fresh TLS-verified REPEATABLE READ READ ONLY readback at17:38:04.979Z reconfirms
CURRENT262/canonical binding, Six504+2, Fit284+2, OOS104, the four current stock
states and inactive951/999/1114. This preparation performs no production write.
Products951/999/1114,
approved manifest bytes/bindings and shared executor remain unchanged.
Both schedule pause guards remain in current main; no workflow file changed.

After separate merge approval, one separately authorized read-only dry-run per
retailer can collect missing source evidence and test the whole current path.
Fit's known absence blocker is addressed by the contract; no guarantee that a
fresh feed has no new blocker. Six may still BLOCK on the four genuine selling
unit conflicts or new source evidence. Do not authorize apply from this draft
or call normalization PASS from partial replay. No repeat dispatch is implied.
