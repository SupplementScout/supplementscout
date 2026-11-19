# SEO-33: exact ABE Pump buying intent

Status: CODE COMPLETE — READY FOR PUBLICATION REVIEW. One owner-authorized Draft;
no merge or Production deployment. Base `f5bf0a99ef2b61fd79b7f840a2398c276cf5c399`.
The final head and exact-head remote checks are recorded on the Draft PR, avoiding
a self-referential commit hash in committed evidence.

## Verified gap and narrow change

Public HTTP200 before implementation confirmed the generic description and no
contextual Pump-to-standard or pair link. Exact identity481 remains active,
unmerged, Applied Nutrition / Pre Workout / `applied-nutrition-abe-pump-500g`.
The root's legacy format/weight are null; known exact flavour variants below are
500g powder. No catalogue correction or product-family assumption is made.

- Title before/after: `Applied Nutrition ABE Pump 500g | SupplementScout`.
- H1 before/after: `Applied Nutrition ABE Pump 500g`.
- Description before: `Applied Nutrition ABE Pump 500g is a pre-workout supplement.`
- Description after: `Compare Applied Nutrition ABE Pump 500g prices in the UK. Check flavours, retailer offers, known delivery costs and reviewed caffeine facts where available.`

The existing productPresentation exact ID/slug/name/brand/category/compatible
format guard supplies description, Open Graph and Twitter through generateMetadata.
One paragraph in Product summary, after retailer offers, distinguishes Pump from
standard ABE, explains selected-flavour evidence and adds the two missing links:
standard215 and existing `/compare?left=215&right=481`. No new heading, comparison,
client component, API, dependency, cache or data read. Neutral Product summary
and JSON-LD description stay intact. No efficacy or blanket stimulant-free claim.

Standard ABE215/1672 keeps its own200mg/10.5g fact and prior SEO-27 copy/links.
Pump retains its exact product intent; the caffeine-free guide and Pre Workout
category retain their broader purposes. No new ABE URL or guide rewrite.

## Current source proof

At `2026-11-19T11:42:49.627Z`, five GET-only source reads all returned200.
Exact retailer-product mappings resolve to481 and their own variants. Nine fresh
in-stock offers across four retailers all have known shipping. These are dated
evidence, never hardcoded runtime prices. Raw candidate/override snapshots remain
outside Git; only bounded reviewed conclusions/public offer proof are committed.

| Active variant | Pack/format | Current offers | Own approved/applied caffeine absence candidate |
| --- | --- | ---: | --- |
| 475 Default | Unknown | 0 | None; missing facts remain explicit |
| 760 Blue Razz | 500g powder | 1 | 707 |
| 761 Red Hawaiian | 500g powder | 2 | 712 |
| 762 Slush Puppie | 500g powder | 2 | 747 |
| 763 Tigers Blood | 500g powder | 4 | 752 |
| 3603 Slush Puppie Twisted Citrus | 500g powder | 0 | 757 |

| Tigers Blood763 retailer | Product + delivery = total | Source checked UTC |
| --- | --- | --- |
| eBay UK | £29.95 + £0 = £29.95 | 18Nov14:37:32.270 |
| 10 Reps | £28.99 + £3.99 = £32.98 | 19Nov10:48:28.614 |
| Gladiator Nutrition | £31.99 + £6.99 = £38.98 | 18Nov17:18:16.197 |
| Whey Okay | £37.81 + £3.99 = £41.80 | 19Nov10:26:35.005 |

Existing reviewedPreWorkoutFacts/server and applied overrides remain unchanged.
All six variant pages were checked against source: identity, nine offer links,
prices, delivery, sums, check dates and their own caffeine fact. Default475 and
3603 show no fabricated price; Default has no reviewed fact. Nine `/go` HEADs
return204; they prove route availability, not external availability. Destinations
and exact mappings were checked from catalogue source; no retailer GET/click or
analytics event was created. Existing canonical catalogue product photo loads;
no variant-specific photography is claimed or changed.

## Validation and paired actual-source QA

Both local Next16.2.9 production builds use the same existing catalogue through
GET/HEAD-only transport. Quality gates separately strip production-write
credentials and use their existing isolated environment. No synthetic input is
presented as actual-source evidence; fixtures are only regression tests.

- Project Guardian before evidence/status edits: PASS; after edits checked again.
- Focused product presentation:43 pass,0 fail,0 skip. Five added cases cover
  exact identity, SSR/social metadata/schema/tracked links/no extra calls,
  approved+applied absence and cross-variant rejection, unknown delivery,
  empty/stale/OOS/error/unresolved states and other product/family isolation.
- `verify:quick`:1,344 scheduled;1,341 pass,3 unchanged historical skips,0 fail.
- `verify:full`:4,086 scheduled;4,083 pass,3 unchanged historical skips,0 fail.
  TypeScript,ESLint,migration baseline and Next production build pass.
- Inventory:369 files;308 safe,57 integration,4 artifact-bound;68 smoke files.
  Existing test file extended only; inventory seal/manifest unchanged and verified.
- 17-route HTTP parity plus existing pair: Pump base/763/475/760/3603,
  standard base/1672, Clear Whey, PER4M product/hub, caffeine-free guide,
  Pre Workout, Creatine, both SEO-22 guides,robots.txt,sitemap.xml. Metadata,
  canonical,robots,JSON-LD,tracked links and source content match baseline except
  Pump's approved description/social and single paragraph/two links. Base has no
  mixed-variant Product schema; exact763 does; offerless Default does not.
- Base and763 at1440/768/390/320px, plus475/760/3603 at390px: PASS. No root/body
  overflow, clipped copy, section overlap, new JS exception or HTTP error.
  Healthy existing image, readable totals/facts and unchanged purchase-block
  coordinates. Contextual-link Tab order and760→763 keyboard Enter navigation
  pass. Correct scrolled context and hero screenshots are attached below.

Six alternating warm HTTP samples/build for763 give upper-middle median TTFB
**756.6→810.7ms**; unchanged guard `after <= before * 1.5 + 100ms` passes.
Cold first-request reads7→7; all six warmed samples/build7→7. Existing two product
reads plus offers,variants,candidates,mappings,history remain; no N+1/cache change.
Document JS543,208 bytes and CSS81,918 bytes remain identical. Existing My
Supplements prefetch differs13,701→13,702 bytes solely in generated numeric module
IDs (normalized content identical). No new client functionality. Browser eight-case
upper-middle median lab LCP1084→896ms; candidate CLS0, baseline0–0.000143. These
bounded lab observations are not field CWV improvement or traffic evidence.

Machine-readable [source/measurement](seo33-abe-pump-evidence/source-and-measurement.json)
and [paired validation](seo33-abe-pump-evidence/validation.json) include dates,
all exact offers, authenticated report links, samples, read tables and gate hashes.
Before/after hero and763 context screenshots at all four widths are in
[the same evidence directory](seo33-abe-pump-evidence/).

## Measurement and release boundary

Four existing authenticated complete weekly reports span19Oct–15Nov2026.
Each is capped at100 pages,100 queries and250 page-query rows; neither exact
product URL occurs. Exact impressions/clicks/query impressions/CTR/position stay
UNKNOWN, not zero. Existing GA4 aggregates cannot attribute organic landing
sessions or retailer clicks to these exact URLs; those remain UNKNOWN too.
Use the existing18November keyword-gap evidence only: Pump volume/KD UNKNOWN;
generic `abe pre workout` ~5400/KD13 is not assigned to Pump. Suggested Pump
queries are hypotheses, not confirmed GSC queries.

Only after a separately approved release: review both product URLs after seven
complete settled days and evaluate after28; monitor movement/cannibalisation
together without changing reporting schedules or the separate SEO-20 clock.

SEO-20 stays frozen IN PROGRESS;SEO-21–32 stay LIVE VERIFIED;SEO-15 Stage3 stays
disabled. No Guardian exceptions, catalogue/price/nutrition/mapping/history writes,
Google submission, new sprint, merge or Production deployment. Normal Draft
branch Preview is CI only. Publication requires the owner's separate release
decision; this task stops at READY FOR PUBLICATION REVIEW.
