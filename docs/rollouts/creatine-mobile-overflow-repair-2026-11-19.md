# Creatine mobile overflow repair

19 November 2026. **CODE COMPLETE; conditional owner-approved Production release.**
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
|791/2881: Per4m Creatine Capsules | 30 Servings,30 Servings|eBay UK|£13.99+£0.00=£13.99|Not verified|2026-11-18T14:37:27.979+00:00|
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
