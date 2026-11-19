# Creatine mobile overflow repair

## Owner-approved Production closeout — 19 November 2026

**LIVE VERIFIED.** PR[#553](https://github.com/SupplementScout/supplementscout/pull/553)
approved0fcaf1c3b0b3e317deb1857e361b945258f94ccd merged2026-11-19T09:02:13Z as
`5f42239e15131a2676404ca3b73b0cb0421dc531`,with exact tree parity. Local quick1341/full4078PASS,
3 unchanged archive skips,32 focused tests,TypeScript/ESLint/Next16.2.9 build,
Guardian and PR/main CI pass. Latest GitHub Production7908660373
and Verceldpl_DvNYm2bUHYKrk94zK7yNUBSDZDQVSUCCESS at2026-11-19T09:03:18Z;public build
`XvzanNudUjSsz1P5zkpTa` replaces`I_1bORjEemnfWYfRI9h1O`.

|Requested px|Root/client px|Body/client px|Table wrapper client/scroll|Columns|Initial lab CLS|Result|
|---:|---:|---:|---:|---:|---:|---|
|320|320/320|320/320|286/1142|9|0|PASS|
|360|360/360|360/360|326/1142|9|0|PASS|
|375|375/375|375/375|341/1142|9|0|PASS|
|390|390/390|390/390|356/1142|9|0|PASS|
|430|430/430|430/430|396/1142|9|0|PASS|
|768|753/753|753/753|703/1142|9|0|PASS|
|1024|1009/1009|1009/1009|959/1142|9|0|PASS|
|1440|1425/1425|1425/1425|1230/1230|9|0|PASS|

All public touch/keyboard table scrolling,last-column access,visible focus,header/
breadcrumbs,under£20,both sorts,brand/retailer/empty states and drawer/Escape pass.
The accessibility tree retains caption/table name and9 named columnheaders.
Fourteen category/homepage/PER4M control cases show no new overflow/runtime/HTTP5xx
failure. Independent current source2026-11-19T09:04:17.300Z matches86
rows/order/prices,delivery arithmetic,dates,links and unchanged exact budget variants.
Twenty public routes,initial content/metadata,H1,canonical/robots/schema,1487 unique
sitemap URLs and tracking retain parity. No artificial retailer click or data write.

|Public route|Before warm median TTFB ms|After ms|Existing guard|
|---|---:|---:|---|
|/creatine|188.7|194.9|PASS|
|/brands/per4m|146.6|147.1|PASS|
|/whey-isolate|146.8|146.1|PASS|
|/vegan-protein|134.9|143.7|PASS|

Network/DNS failures are recorded separately:0. Existing
actual-source local reads remain cold2→2/warm0→0,cache/key/hour buckets unchanged;
no direct Production DB telemetry or field CWV improvement claim. Source-bound
metrics,AX tree,filters and viewport data:[production-proof.json](creatine-mobile-overflow-repair-2026-11-19/production-proof.json).
Public screenshots for all eight widths are production-*.webp in this folder;
[320](creatine-mobile-overflow-repair-2026-11-19/production-320.webp),
[last column](creatine-mobile-overflow-repair-2026-11-19/production-320-table-right.webp),
[drawer](creatine-mobile-overflow-repair-2026-11-19/production-320-drawer.webp).
SEO-20 stays frozen,SEO-21–31 LIVE VERIFIED,Stage3 disabled. No product/variant/
offer/nutrition/mapping/history/importer/workflow/Google change. Final documentation
SHA/CI/Production proof will be attached to merged PR#553. The separate next-target
selection is read-only and does not authorize implementation or create SEO-32.

19 November 2026. **LIVE VERIFIED; owner-approved Production release.**
Base main`366d0687474392beb1d4fc0cb781cb7b3014eee4`. Existing /creatine only; no new SEO task/URL or SEO-32.

## Confirmed cause, not a device-configuration workaround

Local actual-source production build and public current main reproduce320px root
clientWidth320/scrollWidth1050,body320/320,window.innerWidth1050. Meta viewport is
width=device-width,initial-scale1,deviceScaleFactor1; visualViewport remains320,
scale1. Desktop emulation at320 also leaks1050px (305px client with its scrollbar).
The layout overflow is real; innerWidth reflects the overflow rather than an
incorrectly requested1050px device. The baseline app tree equals main's app tree.

The wide table already scrolls inside a286px wrapper (scrollWidth1142px). Its
screen-reader-only last-column label is absolute,1px wide atx1049.48px and uses
BODY as offsetParent because the scroll wrapper is static. It escapes the
ancestor's clipping/scroll containment and extends the root to1050px. Caption is
also absolute. Merely removing main overflow-x-hidden leaves1050px. Making the
wrapper relative fixes320px,including with main clipping disabled. The table's
width and all nine columns stay identical. [DOM/configuration/controlled experiments](creatine-mobile-overflow-repair-2026-11-19/diagnosis.json).

## Small fix and preserved behavior

Only app/creatine/page.tsx and its existing test change application/test behavior:
relative on the existing scroll wrapper; remove redundant overflow-x-hidden on
main; native tabindex0/role region labelled by the existing comparison heading.
No global hidden overflow,clip-path workaround,scaling,font reduction,column
removal,JS,dependency,API,query or shared-component change. Table caption,9 scoped
headers,1120px minimum,all links,ranking,prices and verification rules stay intact.

Actual-source before/after QA uses identical device configuration and data.
Native touch input moves only the table110px; ArrowRight moves it40px with a
visible1px native focus outline. Root scrollX stays0. The last column remains
reachable at the scroll end;1440px needs no horizontal scroll. AX tree retains
the table's caption name,nine named columnheaders and the labelled scroll region.
Raw gestures use trusted Chrome touch events; no programmatic scrollLeft is used
as evidence of the touch result. Global smooth scrolling is bypassed only in QA
positioning commands,so hit testing occurs inside the physically visible table.

|Requested px|Before document/client|After document/client|After body/client|Wrapper client/scroll|Lab LCP ms|CLS|
|---:|---:|---:|---:|---:|---:|---:|
|320|1050/320|320/320|320/320|286/1142|216→236|0→0|
|360|1050/360|360/360|360/360|326/1142|216→276|0→0|
|375|1050/375|375/375|375/375|341/1142|208→236|0→0|
|390|1050/390|390/390|390/390|356/1142|208→228|0→0|
|430|1050/430|430/430|430/430|396/1142|224→228|0→0|
|768|1058/753|753/753|753/753|703/1142|240→224|0→0|
|1024|1058/1009|1009/1009|1009/1009|959/1142|216→224|0→0|
|1440|1425/1425|1425/1425|1425/1425|1230/1230|232→220|0→0|

Both delivered-total and verified-value sort orders match the existing server
model. Actual brand/retailer facets,empty valid combination,clear link,drawer/
Escape,focus,long names,header/breadcrumbs and under£20 pass at all eight widths.
Fourteen320/1440 cases cover whey,whey-isolate,vegan,pre-workout,mass-gainer,
homepage and PER4M. Eleven paired HTTP controls also cover ABE,ClearWhey,Creatine
Pack Size and Delivery Prices. No new runtime exception/HTTP5xx. Known prior
Whey image handling/homepage behavior is untouched; no unrelated repair.

## SEO-21 and actual-source safety

Independent GET-only read2026-11-19T08:52:11.157Z matches all86 table
rows,order,identity,prices,delivery arithmetic,check dates and product URLs.
Live state counts:64 known-delivery current products,0 current unknown-delivery
products,22 without an eligible offer,46 without verified cost/5g. Unknown delivery,
OOS/stale/missing nutrition and read failures remain covered by existing isolated
tests; fixtures are not presented as production observations.

|Exact product/variant|Retailer|Item+known delivery=total|Verified cost/5g|Checked at UTC|
|---|---|---|---|---|
|767/931: OstroVit Creatine Monohydrate 300g,Unflavored / 300g|Fit House|£9.99+£3.99=£13.98|£0.26|2026-11-18T10:46:25.491+00:00|
|791/2881: Per4m Creatine Capsules / 30 Servings,30 Servings|eBay UK|£13.99+£0.00=£13.99|Not verified|2026-11-18T14:37:27.979+00:00|
|1239/4634: MyProtein Creatine Monohydrate Unflavoured,Unflavoured / 150 g|Holland & Barrett|£12.00+£3.49=£15.49|Not verified|2026-11-18T17:27:34.236+00:00|

These are dated existing catalogue observations,never hardcoded app prices.
Under£20 fragment,exact variant links,£20 delivered limit,freshness/stock and
nutrition gates remain unchanged. Its HTML hash matches before/after and filtered
states. Metadata/oneH1,self-canonical,index/follow base,noindex/follow parameters,
CollectionPage/ItemList/BreadcrumbList,all1487 sitemap URLs,robots and analytics
source retain parity. No retailer test clicks or catalogue/mapping/nutrition writes.

## Gates, performance and release boundary

32 focused cases;quick1341PASS/full4078PASS,0 failures,3 unchanged
legacy10Reps archive skips. TypeScript,ESLint,Next16.2.9 build,Guardian before/after
and15 negative contracts pass. Inventory369/seal unchanged and reviewed; no test
file added/removed. The strengthened existing case prevents the original absolute
label leak and a return to global clipping. Integration remains isolated.

Local warm median TTFB66.0→76.8ms passes existing
after≤before×1.5+100ms guard. Cold DB reads2→2,warm0→0; loaders/cache/revalidation
unchanged. HTML544041→544162B (+121 static accessibility bytes).
Loaded JS535592→535586B mobile,549294→549286B desktop (generated build variation;
no client source/module added);CSS81753B unchanged. Lab metrics are recorded above;
no field CWV improvement claim. Original requested/visual viewport stays the same,
while the buggy baseline layout width is the object of the fix,not a test setting.
[Structured validation](creatine-mobile-overflow-repair-2026-11-19/validation-proof.json).

Before/after screenshots for all eight widths are in this evidence folder:
[320 before](creatine-mobile-overflow-repair-2026-11-19/before-320.webp)/
[after](creatine-mobile-overflow-repair-2026-11-19/after-320.webp),
[last column](creatine-mobile-overflow-repair-2026-11-19/after-320-table-right.webp),
[drawer](creatine-mobile-overflow-repair-2026-11-19/after-320-drawer.webp).
Raw HTML,PNGs,read traces and scripts remain ignored tmp. One separate PR may
release only after exact-head green checks and normal branch protection; public
source-bound responsive readback is mandatory before LIVE VERIFIED closeout.
SEO-20 frozen,SEO-21–31 LIVE VERIFIED,Stage3 off. No importer/history/workflow/
Google change or SEO-32. After successful release,only a short read-only next
priority selection from existing completed research/reports is authorized.

## Read-only next organic priority — no implementation

Reuse the completed18November research (captured08:18UTC), not a new competitor
audit. Existing GSC run[44166526954](https://github.com/SupplementScout/supplementscout/actions/runs/44166526954)
is the latest available complete9–15November week. The newer existing run
[44186080465](https://github.com/SupplementScout/supplementscout/actions/runs/44186080465)
has incomplete16November data and is excluded. No report/workflow is rerun.
Top-pages/queries are capped100 and page-query rows250: absence is UNKNOWN.
All periods precede the18November launches, so they do not prove release impact.
The original matrix scores below are prioritisation heuristics, not search
volumes or a promise of traffic. UK volume/KD are UNKNOWN for these three terms.

|Rank / existing URL|GSC evidence|Smallest next change / readiness|Click path, risk and effort|
|---|---|---|---|
|1. /creatine; “creatine monohydrate price comparison” (82.5)|9–15Nov:127 impressions,1 click,page average position35.54. Exact “creatine prices”:9 impressions,0 clicks,position14.11. Four complete weeks:450 impressions,3 clicks; older exact comparison terms have1 impression each,so weak keyword evidence.|Purchase comparison intent;86 products,126 fresh offers,9 retailers. Refine only opening/title/description where useful for monohydrate comparison and delivered-versus-verified5g decisions; reuse current data/table. Preserve under-20 and existing pack-size guide.|Category → exact product/variant → existing /go → retailer. Low cannibalisation with this boundary;0.5–1 day including gates. **Recommended next priority.**|
|2. /product/applied-nutrition-abe-pump-500g; “abe pump” (80)|Page and exact keyword rows absent from capped complete reports:UNKNOWN, not zero.|Branded buying intent;public9 fresh offers/4 retailers. Generic description; reuse exact product481 presentation for pack/flavour/delivery and only selected-variant confirmed caffeine absence. Standard ABE SEO-27 remains separate.|Exact Pump variant → existing /go → retailer. Low risk with481 identity guard;0.5–1 day including gates. No fixed price or all-flavour claims.|
|3. /product/applied-nutrition-iso-xp-18kg; “applied nutrition iso xp” (80)|Page and exact keyword rows absent from capped complete reports:UNKNOWN.|Branded isolate intent;public7 fresh offers/3 retailers. Legacy1.8kg name currently selects450g and also lists1.8kg packs. Require selected-pack presentation review before copy/metadata; never transfer approved nutrition to other packs/flavours. SEO-30 is a separate guide.|Selected pack/flavour → existing /go → retailer. Medium risk against isolate hub/guide;1–2 days. Conditional,not the next priority; hold if a data correction needs new owner authority.|

Selection is an inference combining remaining research score,observed GSC,
current offer readiness and limited engineering scope. Product/Pump/ISO-XP
readiness was checked by ordinary public GETs at2026-11-19T09:13:16.280Z;prices are dated
observations,not promised or hardcoded. Protein bars ties80 but lacks stronger
current exact-pack/nutrition evidence in the existing research. No new URL is
recommended. No page,metadata,data,workflow or roadmap status changes were made
for these opportunities; no SEO-32/PR was created. The owner can authorize the
bounded /creatine search-intent change next. [Selected source evidence](creatine-mobile-overflow-repair-2026-11-19/next-priority-readonly.json).
