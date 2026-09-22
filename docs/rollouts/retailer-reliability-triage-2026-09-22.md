# Retailer reliability triage — 22 September 2026

This is a read-only incident assessment and a code/migration preparation record.
No production migration, offer update, approval or review-queue publication was
performed for this package.

## Production readback

The [11:28 UTC watchdog](https://github.com/SupplementScout/supplementscout/actions/runs/35721586157)
checked 12 retailers, reported seven failures and made zero database writes.
The failed rows are Discount Supplements, Dolphin Fitness, KIOR Health, Fit
House, Jon's Supplements, eBay UK and 10 Reps. The failures have different
causes and must not be cleared by widening a shared monitored baseline.

| Retailer | Exact finding | Boundary |
|---|---|---|
| Discount Supplements | 156/156 offers older than 48 hours; latest source/validator passed, registration rejected `RSBI_SOURCE_STALE`. | No apply or postflight. |
| Dolphin Fitness | 3/3 older than 48 hours; fresh one-offer source/validator passed, registration rejected `RSBI_SOURCE_STALE`. | No apply or postflight. |
| KIOR Health | 11/11 older than 48 hours; source/validator passed, registration rejected `RSBI_SOURCE_STALE`. | No apply or postflight. |
| Fit House | 286/286 older than 48 hours; complete 243-product/340-variant source passed health, but seven exact mapped variants are absent. | Classifier stopped before validator, approval or apply; zero writes. |
| Jon's Supplements | Daily apply/postflight passed for 502/506; four offers remain in review, versus one in the approved monitored baseline. | Three additional reviews require exact assessment. |
| eBay UK | 159/237 offers refreshed with postflight; 78 review rows, 75 stale offers. The separate queue build failed because its source-contract SHA-256 was empty. | No new review cards published from this run; review rows remain isolated. |
| 10 Reps | Daily apply/postflight passed for 935/950; 15 offers remain in review, versus zero in the approved monitored baseline. | Review each new exception; do not widen baseline automatically. |

## Prepared fixes

The shared refresh client requests a 44-minute parent expiry. The dedicated
registration functions for Discount, Dolphin and KIOR still enforce 15 minutes;
the existing generic, Fit House, 10 Reps and Simply functions were extended to
45 minutes on 19 September. Forward-only migration
`20260922122000_extend_three_dedicated_refresh_windows.sql` changes only the
three omitted registration functions from the exact 15-minute guard to the
existing 45-minute guard. It checks production identity, takes the existing
global execution lock, verifies the previous definitions and preserves business
table counts. Its normalized SHA-256 is
`1bb146541823a3d36d5b832ea093b1180406f40a892e3b3697a5ccc5f090081b`.
It is **pending**; the production selector is sealed to that one exact file.
Fresh guarded dry-runs and their commercial deltas are required after applying
the migration, before any offer apply.

The eBay workflow now emits the same-run dry-run contract during the scheduled
post-apply verification and requires all source hashes before starting its
Review Queue job. It changes no approval or offer scope. The code is local only
until reviewed and deployed; existing isolated review rows are not approved.

## Fit House owner decision package

Independent source captures on 21 September, 22 September 07:57 UTC and the
[22 September 12:08 UTC read-only rerun](https://github.com/SupplementScout/supplementscout/actions/runs/35725377626)
all returned the same semantic fingerprint
`ebe563f0f620ff4b501c1e8f56adfe51d854ff912e5089149688d5d0a60c43c1`
and the same seven missing IDs. Each exact saved product URL returned HTTP 302
to the Fit House homepage on 22 September. All seven offer checks last date to
14 September. The saved stock states below are historical and must not be
presented as current evidence.

| Mapping / offer | Saved product and exact variant | Saved stock | Decision needed |
|---|---|---|---|
| 742 / 718 | NOW Foods Choline & Inositol 100 Veg Caps, `46667614945520` | In stock | Verify successor or approve OOS for this exact offer. |
| 863 / 749 | NOW Foods 5-HTP Double Strength 200 mg 60 Veg Capsules, `47199795413232` | In stock | Verify successor or approve OOS. |
| 871 / 757 | 7 Nutrition Beta Alanine 250 g Unflavoured, `46620421816560` | In stock | Verify successor or approve OOS. |
| 873 / 759 | 7 Nutrition Berberine Stack 90 Vege Caps, `46969725714672` | In stock | Verify successor or approve OOS. |
| 1099 / 913 | Lenny & Larry's Fitzels Protein Pretzels 85 g, `48123945124080` | In stock | Verify successor or approve OOS. |
| 1125 / 939 | OstroVit Carbo 1000 g, `49719663100144` | OOS | Confirm continued absence or successor; preserve current OOS meanwhile. |
| 1126 / 940 | OstroVit Carbo 1000 g, `49719663067376` | In stock | Verify successor or approve OOS separately from sibling variant. |

No new variant identity, OOS transition, source exception, monitored baseline or
historical price observation is approved by this assessment. The existing
reviewed missing-variant mechanism remains the route for an exact owner decision.

## Local checks

`npm run verify:project`, `npm run verify:inventory`, `npm run verify:quick`
and `npm run verify:full` pass after the code and migration preparation. Full
verification uses isolated build credentials and did not write production.

## Production closeout — 22 September 2026

The owner approved PR #70 and its single production migration. The PR was
squash-merged as `7baef37`; the full main quality gate passed in run
`35729414683`. Migration `20260922122000_extend_three_dedicated_refresh_windows`
passed rehearsal, apply and independent read-only verification. The production
ledger increased from 217 to 218 with no business-table count changes.

Fresh dry-runs for Discount (`35729541988`), Dolphin (`35729545947`) and KIOR
(`35729549609`) passed. Owner-authorised apply runs `35730589993`,
`35730593515` and `35730597686` then stopped before any business write: the
shared sequential parent approval function still allowed only Simply and
10 Reps. A read-only production query found exactly three unapproved PLANNED
parents with five PLANNED children, zero approvals and zero apply runs.

The owner separately approved PR #71 and its two-migration recovery. The PR
was squash-merged as `6ae4006`; the full main quality gate passed in run
`35733790817`. After all three exact plans expired, migrations
`20260922140000_extend_three_sequential_parent_approvals` and
`20260922141000_supersede_three_failed_refresh_plans` passed a rollback-only
rehearsal, atomic apply and independent read-only postflight. The production
ledger increased from 218 to 220. Products, variants, mappings, offers and
price-history row counts stayed at 1,337 / 3,632 / 3,758 / 3,758 / 20,706.

The owner-authorised fresh apply runs then passed their DB postflight and
independent idempotency checks:

| Retailer | Run | Executed scope | Commercial change |
|---|---|---:|---|
| Discount Supplements | `35735652911` | 109 offers | Two exact offers, `793` and `814`, changed from in stock to out of stock; no price change. |
| Dolphin Fitness | `35736074304` | 1 offer | No price or stock change. |
| KIOR Health | `35736370835` | 11 offers | No price or stock change. |

The read-only watchdog run `35736662308` reported zero database writes.
KIOR now has 0/11 offers older than 48 hours. Discount has 47/156 older
offers outside the approved 109-offer execution scope; Dolphin has 2/3 outside
its approved one-offer scope. Both are now `PASS_WITH_MONITORED_BACKLOG`, not
fully fresh. The watchdog still reports four separate failures: Fit House,
Jon's Supplements, eBay UK and 10 Reps. No scope, monitored baseline or
review-row approval was widened by this closeout. The next retailer work is
exact assessment of the residual Discount/Dolphin offers and the independent
Fit House and review-backlog failures; SEO-15 remains the next SEO task.

## Fresh residual audit — later on 22 September 2026

The existing production-readonly [Discount full-catalog run](https://github.com/SupplementScout/supplementscout/actions/runs/35738234329)
captured the complete Shopify source and classified all 47 offers outside the
approved 109-offer refresh. The exact current split is 24 `SAFE_UPDATE`, 17
`OUT_OF_STOCK`, three `MISSING_FROM_SOURCE` (`871`, `873`, `875`), one
`NO_CHANGE` (`865`) and two unmapped identity cases (`10`, `764`). Across the
matched offers, 37 have a current price or stock difference, four are already
out of stock with no new commercial difference, and the other four are the
three source-absent rows plus the one no-change row. The two unmapped offers
still have null source product/variant IDs in the production database. This is
fresh classification, **not** owner approval for any commercial or identity
write. The historical 30 August split has been superseded for decisions.

Dolphin offers `8` and `9` remain outside the approved one-offer refresh.
Read-only production records still have null external product and variant IDs
for both. Their saved generic catalogue variants cannot be assigned to a
specific flavour merely from a retailer page. Preserve both for exact owner
identity review.

Fresh read-only [Jon's run](https://github.com/SupplementScout/supplementscout/actions/runs/35738156128)
found four source-absent review offers (`1209`, `1456`, `1457`, `1458`) and ten
stock differences among its 502 executable rows; it made no offer writes.
The shared [Fit House/10 Reps run](https://github.com/SupplementScout/supplementscout/actions/runs/35739451308)
found the same seven unallowlisted Fit House missing variants and stopped before
registration or writes. Its independent 10 Reps job passed a 935-row no-change
dry-run with 15 source-absent review offers. Missing source variants alone do
not authorise OOS changes or new identities.

The manual [eBay dry-run](https://github.com/SupplementScout/supplementscout/actions/runs/35738147995)
captured 237 offers: 159 `VERIFY_NO_CHANGE` executable rows and 78 review rows.
It made zero catalogue writes. Its workflow also started the separate Review
Queue publication job despite `operation=dry-run`: the queue RPC made 183
control writes, comprising 22 created, 56 refreshed, 10 superseded and three
resolved cards, plus their audit/publication records. Independent read-only
counts after the job remained products/variants/mappings/offers/history
`1337/3632/3758/3758/20706`; queue rows increased from 955 to 977, audit
events from 1673 to 1764 and publications from 15 to 16. No review card was
approved or catalogue offer applied. [PR #73](https://github.com/SupplementScout/supplementscout/pull/73)
merged as `5c2e45c` and now prevents this queue job from starting on manual
dry-runs; its GitHub full gate passed. Future manual diagnostics must verify
the job condition before dispatch.

Next active retailer decision package: review the seven exact Fit House source
absences against fresh direct product/variant evidence, then seek an owner
disposition for each. In parallel, the 37 current Discount commercial changes
and two Dolphin identities need separate exact owner review through existing
guarded paths; do not widen the 109/1 approved refresh scopes or monitored
baselines. Jon's four and 10 Reps fifteen missing variants, and eBay's 78
review rows, remain isolated for their own row-level decisions. No broad
commercial apply or automatic OOS transition is approved by this audit.
