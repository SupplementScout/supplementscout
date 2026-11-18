# SEO-30: existing cost-per-25g guide improvement

Status: **CODE COMPLETE — READY FOR PUBLICATION REVIEW**. One owner-approved
Draft PR; no merge or Production deployment. Base: `77a9472f7eb4ceecd6fad7ee4fc8c043dc09a50a`.
Final HEAD, CI and protected Preview result are recorded on the Draft PR.
Existing URL: https://www.supplementscout.co.uk/guides/cost-per-25g-protein

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
