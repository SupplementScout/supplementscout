# SEO-30: existing cost-per-25g guide improvement

Status: **LIVE VERIFIED** after owner-approved Production and public readback.
Existing URL: https://www.supplementscout.co.uk/guides/cost-per-25g-protein

## Owner-approved Production closeout — 18 November 2026

PR [#550](https://github.com/SupplementScout/supplementscout/pull/550) merged at
`2026-11-18T16:57:27Z` as `72e0502e1182c7af4a5967a2b0a4c18fb88a9705`.
The complete tree equals approved `baba83569aa467c1be9bf3cd0d55a0d460c21d8f`;
no application release fix was needed. Fresh quick/full gates, TypeScript,
ESLint, Next16.2.9 build,27/27 guide cases and PR/main CI/Guardian pass:
quick1336 PASS, full4073 PASS,3 existing legacy10Reps artifact skips,0 FAIL.
Manifest inventory369/seal2bfb325c… is unchanged; integration remains isolated.

GitHub Production deployment `7890185474`, Vercel
`dpl_46hbtGXN2JkvWjn82yrr4MV1ZubS` SUCCESS at `2026-11-18T16:58:33Z`.
Public custom-domain build changes from `5G92xxzNghw0hh9d8E9nM`
to `fVwqxt_Y5IFtN7dg--vcx`. First proof `2026-11-18T16:58:49.547Z`;
full public readback `2026-11-18T17:00:14.436Z`, source binding `2026-11-18T17:00:32.507Z`.
This uses authorized exact GitHub/Vercel status and actual public build/content
proof, with no private API READY claim, API403 retry or SSO bypass. Final
documentation-only main SHA/CI/deployment confirmation is recorded on merged
PR #550 after that final deployment; its application tree stays identical.

### Independent current data and rendered calculation

Source snapshot `2026-11-18T16:59:23.865Z` uses the existing authorized GET-only
reader. Both live exact-variant overrides match their own unchanged reviewed
manifest after-records, including72×22=1584g and66×27=1782g. Pack, flavour,
active identity and retailer-product bindings remain exact. No new nutrition,
approval, data, mapping or price-history write occurred.

|Product/variant/pack|Current retailer|Product + known delivery = total|Verified protein|Cost25g|Offer checked UTC|
|---|---|---|---|---|---|
|178/735: Vanilla / 1.8kg, 1,800g|Whey Okay|£81.53 + £3.99 = £85.52|72 × 22g = 1584g|£1.35|2026-11-18T10:14:49.194+00:00|
|746/1196: Strawberry Milkshake / 2000g, 2,000g|eBay UK|£64.99 + £0.00 = £64.99|66 × 27g = 1782g|£0.91|2026-11-18T14:37:35.716+00:00|

Current comparison difference £0.44 per25g, calculated from unrounded costs; Efectiv Nutrition Grass-Fed Whey Protein Isolate 2kg is lower on this verified basis.
These are dated live-source observations, never values forced into application
code. Stale/OOS and unknown-delivery offers cannot supply current calculations.
Public initial HTML contains the new two-product section, all eligible amounts,
check dates, exact735/1196 product links and original manufacturer source links.
All internal guide links return public200. No retailer GET/navigation, purchase,
synthetic retailer click, analytics event or Google submission was generated.

The unchanged27-case suite verifies reversed prices, ties/sub-penny differences,
one/no eligible offer, unknown delivery, stale/OOS, missing/mismatched nutrition
and source failures. These deterministic fixtures are separate from the actual
Production-source evidence above; no production data was altered to test them.

### Public SEO, regression and responsive evidence

All16 routes (all10 published guides plus PER4M,creatine,whey-protein,ABE,
Myprotein Clear Whey and homepage) return200 on the exact new public build.
Original title/description/OG/Twitter, oneH1, canonical, robots and schema entity
contracts pass. Target WebPage/BreadcrumbList is identical; unapproved
parameters remain noindex/follow and canonical to base. Public robots and all
1,487 unique sitemap URLs match baseline, with exactly one target canonical.
No lifecycle, URL, incoming-link or existing product tracking change.

PER4M's full text, direct anchors, metadata and schema retain immediate public
baseline parity. Protected sources and SEO-20–29 ledger rows are unchanged;
SEO-20 experiment clock/thresholds stay frozen, SEO-21–29 LIVE VERIFIED and
Stage3 disabled. No other guide, catalogue, nutrition validator, pricing engine,
workflow, migration, importer or analytics schedule changed.

Public1440/768/390/320px:4/4 PASS with both cards and actual amounts, no clipping,
overlap, new horizontal overflow, JS/HTTP errors or keyboard-focus failures.
Analytics collection was blocked; nonessential consent rejected. Viewport
screenshots: [1440](seo30-protein-guide-pair-2026-11-18/production-1440.webp),
[768](seo30-protein-guide-pair-2026-11-18/production-768.webp),
[390](seo30-protein-guide-pair-2026-11-18/production-390.webp),
[320](seo30-protein-guide-pair-2026-11-18/production-320.webp);
[Efectiv mobile](seo30-protein-guide-pair-2026-11-18/production-efectiv-390.webp).

### Public warm responses and query cost

Five warm samples retained after an initial warm-up per route; unchanged
before×1.5+100ms guard. Network/DNS failures recorded separately:0.

|Public route|Baseline median TTFB|Production median TTFB|Guard|
|---|---:|---:|---|
|/guides/cost-per-25g-protein|155.3ms|146.8ms|PASS|
|/brands/per4m|197.3ms|184.3ms|PASS|
|/creatine|236.3ms|291.7ms|PASS|
|/whey-protein|213.3ms|309.9ms|PASS|
|/product/applied-nutrition-abe-ultimate-pre-workout-315g|1351.4ms|1266.8ms|PASS|
|/product/myprotein-clear-whey-protein-isolate|1130.9ms|1175.8ms|PASS|
|/|463.8ms|765.9ms|PASS|

The released application tree matches the instrumented paired actual-source
local builds: cold GETs2→2, warm0→0; local warm TTFB22.3→20.8ms.
One bounded product selection and one shared mapping/variant read supply both
products. Existing cache keys/time buckets/freshness/error rules and batching
tests pass fresh; no per-product query was added. These counts are local
instrumentation, not Production DB telemetry. No field CWV improvement or
guaranteed organic traffic gain is claimed.

The first390px browser run recorded an18.54s LCP outlier. It is retained in
the Production proof. Subsequent390px LCP samples were
416ms, 464ms, 368ms
with document TTFB35–46ms. Diagnostic resource timings also recorded a19s
transfer/queue pause on JS assets already referenced by the pre-release HTML;
independent repeated HTTPS asset reads returned200, with totals
60.7–341.9ms.
The initial LCP's precise cause is not established. No repeatable application
or warm-response regression was found, and no application/network setting was
changed to improve the result. [Retained performance diagnostics](seo30-protein-guide-pair-2026-11-18/performance-diagnostics.json)
separate this observation from the unchanged warm-response guard and field CWV.

[Production validation JSON](seo30-protein-guide-pair-2026-11-18/production-proof.json).
Raw HTML, JSON, source traces and viewport PNGs remain in ignored
`.worktrees/seo30-protein-guide-pair-20261118/tmp/release-seo30/`.
Existing exact-guide GSC/GA4 baseline remains UNKNOWN, not zero; keep7/28 complete
post-release-day follow-up through existing reports only. No new schedule,
automatic Search Console submission or SEO-31 begins.

## Historical Draft evidence

The earlier preparation below is retained as dated review evidence. Its
Draft-only release boundary is superseded by the approval and public proof above.

## Scope and result

Replace the two ISO-XP flavours with ISO-XP Vanilla735/product178/1800g and
Efectiv Strawberry Milkshake1196/product746/2000g. Keep the existing
BuyingGuide, selectors, batch loader, pricing/nutrition validators and layout.
Only the example constants, necessary editorial copy, small SSR comparison and
route payload key v2→v3 change. No global cache policy, query or client addition.

The cards retain retailer, item/delivery/total, exact pack/flavour, check date,
verified servings/protein, total protein, final unit cost and source links.
The comparison uses unrounded unit costs; it can reverse, tie or show a
sub-penny difference without an invented£0.00 advantage. It appears only when
both examples qualify. One eligible example keeps its own calculation without
a winner; neither eligible leaves useful methodology and no stale prices.
No whole-market ranking, health, taste or quality superiority is claimed.

## Actual source evidence

Authorized GET-only capture: `2026-11-18T15:51:26.264Z`; actual-source local
production-build readback: `2026-11-18T16:05:56.216Z`. These are real catalogue observations,
not synthetic fixtures, checkout quotes or a Production deployment of this change.

|Exact product/variant|Retailer|Item + known delivery = delivered|Verified protein|Per25g|Offer checked UTC|
|---|---|---|---|---|---|
|Applied Nutrition ISO-XP 1.8kg; Vanilla / 1.8kg|Whey Okay|£81.53 + £3.99 = £85.52|72 × 22g = 1584g|£1.35|2026-11-18T10:14:49.194+00:00|
|Efectiv Nutrition Grass-Fed Whey Protein Isolate 2kg; Strawberry Milkshake / 2000g|eBay UK|£64.99 + £0.00 = £64.99|66 × 27g = 1782g|£0.91|2026-11-18T14:37:35.716+00:00|

The current unrounded difference is£0.437991021324, displayed£0.44 per25g.
Prices, stock, delivery and dates remain dynamic. ISO-XP's cheaper July
Discount Supplements offer is stale; the Efectiv Jon's offer is OOS. Neither
qualifies. Existing mappings1536→1722→735 and2640→2826→1196 are resolved;
no identity, mapping or data correction was made.

Both live nutrition overrides equal their own reviewed after-record exactly.
Manifest `data/verified/variant-nutrition-reviewed-batch-1-v2.json` SHA256:
`447048be2ca789210ad71f8d144471d8cd3b2ef75b5e81c3b4f6cd6169656fa7`;
reviewed scope `c2198812faa5a2cdaeb26e7ad80c154a3c4c85cdef23c9f579a5b5c3bd4c4844`.
Efectiv uses approved66 servings, not2000÷30 inferred servings; the existing
pack-rounding tolerance handles66×30=1980g against2000g without alteration.
The existing protein evidence path already handles null unrelated creatine.
No validator, approval, nutrition record or production data was changed.
[Actual source/mapping/provenance proof](seo30-protein-guide-pair-2026-11-18/actual-source-proof.json).

## Validation and SEO parity

-27 focused guide cases pass, including exact IDs/pack/flavour/active mapping,
  reviewed records, arithmetic/rounding/reversal/ties, unknown delivery/OOS/stale,
  wrong/missing provenance, partial/empty/error states, SSR, cache and links.
- Quick1339: 1336 PASS/3 existing skips/0 FAIL;
  full4076: 4073 PASS/3 same skips/0 FAIL. TypeScript,
  ESLint, migration baseline and Next16.2.9 production build pass. No new test
  filename: reviewed inventory369/seal2bfb325c… remains valid. Isolated DB/
  integration jobs stay outside this credential-free gate.
- Project Guardian before/after records and negative contracts pass. No new
  active-pair exception is needed for a completed Draft task. Only frozen
  SEO-20 remains IN PROGRESS; SEO-21–29 rows remain byte-identical.
- Title, description/OG/Twitter, one H1, self-canonical, base index/follow,
  parameter noindex/follow, WebPage/BreadcrumbList and all1,487 unique sitemap
  URLs match baseline. Lifecycle and incoming links are unchanged. No new schema.
- Every internal guide link returns public200, including exact735/1196 product
  URLs. Product retailer tracking stays untouched; no outbound retailer GET,
  synthetic click, new analytics event, purchase or production write occurred.
- Delivery guide, frozen PER4M, SEO-29 card and whey comparison retain identical
  rendered metadata/schema/text/links in paired local builds. No other route,
  source, import, workflow, dependency, mapping or history change.

## Responsive and performance evidence

Before/after1440/768/390/320px:8/8 layouts PASS, with no clipping, overlap,
new overflow, JS exceptions, HTTP errors or keyboard-focus failures. Same
BuyingGuide layout; current amounts and source links are readable on mobile.

|Paired actual-source local production builds|Before|After|
|---|---:|---:|
|Warm median TTFB,6 alternating samples|22.3ms|20.8ms|
|Cold batched database GETs|2|2|
|Warm database GETs|0|0|
|Loaded guide JS bytes|542322|542325|

The unchanged before×1.5+100ms warm guard passes. One bounded products query
plus one shared retailer-product/variant resolver query serves both examples;
no per-example read. The3B generated-client difference is consistent with build
identifiers; no client module or dependency changed. Cache hour buckets, expiry
and render-time freshness are unchanged. These are laboratory diagnostics,
not public post-release TTFB, field CWV or organic traffic improvement claims.
[Structured validation proof](seo30-protein-guide-pair-2026-11-18/validation-proof.json).

Screenshots, before/after:
[1440 before](seo30-protein-guide-pair-2026-11-18/before-1440.webp) /
[after](seo30-protein-guide-pair-2026-11-18/after-1440.webp);
[768 before](seo30-protein-guide-pair-2026-11-18/before-768.webp) /
[after](seo30-protein-guide-pair-2026-11-18/after-768.webp);
[390 before](seo30-protein-guide-pair-2026-11-18/before-390.webp) /
[after](seo30-protein-guide-pair-2026-11-18/after-390.webp);
[320 before](seo30-protein-guide-pair-2026-11-18/before-320.webp) /
[after](seo30-protein-guide-pair-2026-11-18/after-320.webp).
Efectiv: [390](seo30-protein-guide-pair-2026-11-18/efectiv-390.webp) /
[320](seo30-protein-guide-pair-2026-11-18/efectiv-320.webp).
Raw HTML, PNGs/read traces remain in ignored worktree tmp. The public guide
still shows the released two-ISO-XP-flavour version pending owner release approval.

## Existing analytics and release boundary

Existing authenticated Growth Analytics runs44166511050/44166516255/
44166520996/44166526954 cover19Oct–15Nov2026 in four complete weeks.
Exact-guide impressions, clicks, CTR, average position and page queries are
UNKNOWN because the URL is absent from capped100-page/100-query/250-pair output,
not zero; these periods precede the guide's17Nov launch. One sitewide query,
"beginner protein supplement with transparent price and serving cost. comparison",
has1 impression/0 clicks/position7 in9–15Nov, with no demonstrated guide
attribution. Exact-guide organic sessions and retailer clicks are UNKNOWN:
the available organic-search projection is sitewide. Later run44186080465
ending16Nov is incomplete and remains separate, not a full-week replacement.

After a separately approved deployment, check7 complete days and assess28
complete days for exact-guide/query metrics, attributable organic landings and
retailer clicks using existing reports. No new job, schedule, integration or
automatic GSC submission. No growth guarantee; SEO-20 clock/thresholds stay
frozen, SEO-21–29 stay LIVE VERIFIED, Stage3 stays disabled and no SEO-31 begins.
