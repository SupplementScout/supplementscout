# Fit House / Six Pack blocker repair — 9 November 2026

Status: CODE PREPARED FOR DRAFT REVIEW. Fit House incident repaired locally;
Six Pack remains BLOCKED. Neither retailer is RESTORED or approved for apply.
This is the single owner-authorized reliability task; RA-004 remains suspended.

## Baseline and scope

Starting main: `1b5d1ad9a6b7dd1ee0797f8d199422006618664d`.
Fresh independent TLS-verified REPEATABLE READ READ ONLY readback at
2026-11-09T15:06:25.241Z confirms production CURRENT262, fingerprint
`209719c865f07c9e77006d01f7ae526aa47461b9a0bd5154071b4f29052c8333`.
Fit House remains 284 active + 2 historical = 286 physical bindings; Six Pack
504 active + 2 historical = 506. There are no active target parents, children
or execution requests. Stable OOS104 is intact. Both schedules remain paused.
Independent readback at 15:13:44.150Z matches all scoped raw rows, historical
rows, price history and control/approval fingerprints from 15:06:25.241Z.
Business, freshness, control, approval, Review Queue and price-history writes
are zero. No retailer workflow was dispatched.

## Fit House: existing reconciliation, both captures

[Run 42637602428](https://github.com/SupplementScout/supplementscout/actions/runs/42637602428)
failed before classification/validators. Its complete Shopify feed contained
231 products / 326 variants, semantic fingerprint
`6026c4a154e31f6b00063a0acbe8499c279ef4c1b055149a1e349654da67fa1a`.
The immutable 78-row audited-missing manifest still contains withdrawn
mapping2082/offer1896 and mapping2151/offer1965. Requiring those rows in the
284-row active collection caused the confirmed error.

`reconcileAuditedMissingVariants` now receives the separate historical records.
It uses the existing `reconcileApprovedCatalogueScope` to validate the complete
physical scope, withdrawal decisions and lifecycle, and rejects a wrongly
supplied active/historical partition. It verifies all 78 audited bindings,
including existing exact-pack canonical-successor and SKU checks. Only the
76 still-active audited rows enter the absent/returned reconciliation sets.
The two historical rows never acquire synthetic OOS facts or active return
authority. The aggregate confirmation capture passes the same historical proof.

No historical manifest, approved tuple, scope, policy, approval, classifier,
executor or database contract changes. Existing owner OOS approval requirements,
stable OOS104 and all four verified stock transitions remain effective:
697 false→true; 983,1859,1982 true→false. Other retailer branches are unchanged.

## Six Pack: evidence requires BLOCK, not a parser exception

[Run 42635372462](https://github.com/SupplementScout/supplementscout/actions/runs/42635372462)
accounts for all 277 active source parents / 504 mappings:
PARSED270/489, ISOLATED5/13, FATAL1/1, NOT_REACHED1/1.
Classification, validators and sealed execution artifacts were not reached.
The two historical mappings remain separate and must not be fetched.

Parent7565/variant7567, mapping2674/offer2488 maps to canonical product216,
variant2527 (Orange / 225g). Retained complete HTTP200 HTML is 213496 bytes,
SHA256 `401990faab22f88e919787547f7d23271d16a25020c41e6c2e18a81f1482eedb`,
canonical URL `https://6pack-supplements.co.uk/product/trec-nutrition-sleep-er/`.
Approved name: Trec Sleep-er 225g. Source title: Trec Nutrition SLEEPer night
regeneration formula. The retained document has no variant commercial data,
no corroborating 225g package quantity and no corroborating GTIN/SKU. Existing
mapping SKU, external GTIN and canonical variant GTIN are null. The historical
July approval CSV preserves Orange/225g but does not independently establish
the current source variant or formula.

The product description explicitly identifies melatonin, and its ingredients
table states `Melatonin 0,6 mg` per 9g serving; the ingredient list also names
it. These facts are read from the saved product content, not inferred from the
sleep-related title. They prevent claiming a policy-compliant REVIEW_ONLY
admission even if the title conflict were waived. Exact applicability to the
approved Orange/225g variant still lacks independent evidence. The previous
[FURTHER_EVIDENCE_REQUIRED decision](SIX-PACK-IDENTITY-EVIDENCE-2026-11-08.md)
therefore remains effective. No automatic alias, new equivalence, ingredient
inference, product-ID runtime exception or mapping change is introduced.

One concrete owner decision remains: confirm or reject the exact
7567/Orange225g ↔ retained SLEEP-ER formula binding using a package label or
manufacturer identifier. If confirmed, the existing all-dose melatonin policy
requires controlled withdrawal, not REVIEW_ONLY or commercial automation.
This PR does not implement or authorize that production withdrawal.

Parent8628/mapping2675/offer2489 was NOT_REACHED. Its approved canonical pair
is product59/variant1612, Green Apple / 375g. Historical CSV/mapping SKU
`850006755387` is not a verified current GTIN. The previous identity decision
is also FURTHER_EVIDENCE_REQUIRED. No fresh source was obtained in this task;
neither current identity nor commercial data is declared verified.

## Validation and release boundary

New offline regressions exercise 78=76+2, the complete Fit284 scope, historical
absence/return isolation, binding/lifecycle drift, unchanged owner OOS approval,
stable OOS104 with four durable transitions, both capture call sites, current
504+2/284+2 manifest SHA/bindings, Six identity fail-closed and melatonin policy.
Existing Six full offline parser/artifact/executor regressions additionally
retain REVIEW_ONLY rows with null commercial proposals and reject their apply.
The new file is explicitly inventoried and included in the quick gate.
The existing Gladiator whole-file runtime SHA assertion is resealed for this
reviewed Fit-only change; its behavior, configuration and workflows are
unchanged, with an additional regression limiting the audited path to Fit.

No DB/SQL/ACL/RPC contract is changed; this repair does not require a migration
or a database integration change. Exact local/PR quality-gate results belong
in the draft PR receipt. No production credentials are supplied to test jobs.

Only a draft PR is authorized. No merge, production write, source fetch,
retailer workflow dispatch, recovery or schedule change occurs in this task.
After review and a separately approved merge, one new Fit House read-only
dry-run can test source/classifier/validator behavior; that is not a PASS claim
now. Six Pack still requires the owner evidence decision above before a new
full diagnostic run would be useful. Neither retailer is apply-ready.
