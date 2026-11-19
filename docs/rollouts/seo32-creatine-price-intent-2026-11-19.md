# SEO-32: existing Creatine price-comparison intent

**CODE COMPLETE — READY FOR PUBLICATION REVIEW.** One owner-approved Draft PR;
no merge or Production release is authorized. Base main`9c4b527bad099df3370b141b7d9f20a09020d3bf`.
The19November owner SEO-32 instruction supersedes earlier no-SEO-32 boundaries
only for this existing-route Draft. SEO-20 remains the frozen IN PROGRESS
measurement task;SEO-21–31 remain LIVE VERIFIED;Stage3 disabled. No SEO-33.

## Small editorial change and boundary

- Title: “Compare Creatine Supplements & Prices UK” → “Compare Creatine Prices UK”.
  The unchanged global template produces “Compare Creatine Prices UK | SupplementScout”
  (44 characters,previous58). A longer delivery/offers suffix was unnecessary.
- Description: “Compare current creatine prices from UK retailers, including known
  delivery costs. Check exact products, pack sizes and verified unit costs where available.”
  The156-character string is shared by regular,OG,Twitter and CollectionPage metadata.
- H1 remains “Compare Creatine Supplements UK”,exactly once. CollectionPage name
  follows the SEO title; its IDs,URL,date and all ItemList/Product/Offer/Breadcrumb
  data are unchanged. One existing title constant avoids repeated identity strings.
- One shorter opening paragraph explains UK prices,known delivery,exact pack/
  formulation,monohydrate as part of the broader category,format differences and
  verified5g evidence. No new section/widget or duplicated guide. Measured hero
  height and comparison position never increase at the seven widths below.
- Broad price-comparison intent stays on /creatine. SEO-21 owns the delivered£20
  budget;the existing Creatine Pack Size guide owns detailed unit-value explanation.
  Under-20 HTML,selector,ranking,variant links and all surrounding content match
  baseline. PR553 relative/native scroll region and all9 columns remain intact.
- No other route,shared component,loader/cache/query,key/revalidation,API,event,
  CSS,client component,dependency,taxonomy,retailer mapping or nutrition change.
  Runtime changes only app/creatine/page.tsx;existing creatine-page.test.js gains
  exact metadata/social/schema/intro assertions and deterministic fixture clocks.

## Existing GSC baseline,not keyword search volume

Four existing complete UTC reports19Oct–15Nov:450 page impressions,3 clicks,
CTR0.667%,average page position27.49. Latest complete9–15Nov:127 impressions,
1 click,CTR0.787%,average page position35.54. “creatine prices” exact page-query
in that week:9 impressions,0 clicks,position14.11. Page-average position is not a
single keyword rank. Older exact monohydrate comparison evidence has only1
returned impression;it does not establish large demand.

Separate capped projections must not be conflated:topQueries returns24
“creatine prices” impressions across2 weeks,weighted position13.375;the saved
exact-page pageQueryRows returns52 across4 weeks,weighted position12.904.
Neither is an exhaustive28-day query total. Caps are100 pages/queries and250
page-query pairs. Missing rows are UNKNOWN,not zero. Existing newer16Nov report
is incomplete and excluded. No report/workflow rerun,new competitor research,
GSC permission change or Google submission. No readily available local Google
identity;existing authorized artifacts suffice. Exact-page organic landing
sessions and attributed retailer clicks remain UNKNOWN in the saved projections.
[Selected rows,run links and hashes](seo32-creatine-price-intent-2026-11-19/gsc-baseline.json).

After a separately approved future release,review after7 complete settled days
and principally28 complete settled days. Measure exact-page impressions/clicks/
CTR/average position,available page-query evidence and only attributable sessions/
retailer clicks. Preserve SEO-20's independent clock and all analytics schedules.
Expected relevance is a hypothesis:the wording directly expresses purchasing
intent and honest delivery/variant evidence;no traffic,ranking or CTR uplift claim.

## Actual-source local QA and performance

|Viewport|Document/client|Body/client|Columns|Hero height before → after|Lab LCP ms before → after|After CLS|Result|
|---:|---:|---:|---:|---:|---:|---:|---|
|320|320/320|320/320|9|668 → 668|400 → 532|0|PASS|
|360|360/360|360/360|9|604 → 604|296 → 404|0|PASS|
|390|390/390|390/390|9|576 → 576|276 → 376|0|PASS|
|430|430/430|430/430|9|524 → 524|256 → 352|0|PASS|
|768|753/753|753/753|9|512 → 480|308 → 360|0|PASS|
|1024|1009/1009|1009/1009|9|432 → 432|280 → 344|0|PASS|
|1440|1425/1425|1425/1425|9|432 → 432|268 → 388|0|PASS|

Desktop scrollbar accounts for15px where present. Native touch/keyboard scroll,
last-column access,visible focus,both sorts,actual brand/retailer/empty selection,
drawer/Escape and long names pass. Fourteen control cases per build cover existing
categories/home/PER4M;HTTP controls also include protected guides/product pages.
No new runtime exception/HTTP5xx. [320 before](seo32-creatine-price-intent-2026-11-19/before-320.webp)/
[after](seo32-creatine-price-intent-2026-11-19/after-320.webp),
[1440 after](seo32-creatine-price-intent-2026-11-19/after-1440.webp),
[table end](seo32-creatine-price-intent-2026-11-19/after-320-table-right.webp).

Actual source2026-11-19T09:43:20.433Z:all86 rows and budget variants
match identity,prices,known delivery arithmetic,check dates,links,freshness and
verified5g withholding. Live counts/prices are dated evidence,never constants.
Unknown delivery,missing nutrition,OOS/stale,empty/degraded and loader failures
retain existing deterministic tests. Synthetic cases are not production evidence.
Canonical/base index-follow,parameter noindex-follow,sitemap1487
unique URLs,robots,internal links and analytics source remain unchanged.

Warm local TTFB78.4 → 77.8ms
passes unchanged after≤before×1.5+100ms guard. Cold reads2 → 2,
warm0 → 0;no runtime query added. JS/CSS/CLS/LCP observations are retained in
[validation-proof.json](seo32-creatine-price-intent-2026-11-19/validation-proof.json).
These are lab observations,not field CWV or production query-telemetry claims.
Initial single-pass LCP variation is retained above. Three alternating warm-asset
pairs after equally priming both builds give320px medians
412 → 380ms and1440px
264 → 248ms;
no persistent slowdown is demonstrated. One earlier uncached follow-up hit a
browser load-event timeout;it is retained as a lab limitation,not a production
failure. The initial manual control-read allowlist was corrected to permit six
existing GET/HEAD catalogue paths;protected homepage/product controls were
rechecked successfully. Offscreen content-visibility is verified through DOM
text rather than omitted innerText. No application repair was needed.

Quick1341PASS/full4078PASS,0 failures,3 unchanged legacy archive
skips;32 focused cases,TypeScript,ESLint,Next16.2.9 build and Guardian pass.
Inventory369/seal unchanged;no test filename added/removed. Quality gates receive
isolated non-production build credentials;manual actual-source QA separately
permits only GET/HEAD on the existing read paths. No data,importer,migration,
workflow,secret,Google or production deployment change. Public main remains
the existing buildNMdiGDIvjeOR2T5OqO4lw;candidate QA is local only.
Final Draft PR SHA and exact-head CI are recorded on the PR after push.
