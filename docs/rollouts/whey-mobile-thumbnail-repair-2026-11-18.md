# Whey mobile controls and failed-thumbnail repair

18 November 2026. **CODE COMPLETE; separately owner-authorized conditional release.**
Base main`dfd0049b24531a118f9506fa18ca12a17c4892eb`. SEO-31 was already LIVE VERIFIED before this work.
Only two confirmed technical defects are in scope; no SEO-32 or data-write approval.

## Confirmed causes and minimal fixes

At public320px,document/body are364px. The filter/sort row is a nowrap flex item
with automatic minimum width331.25px (right364.25px),inside254px available content.
Its select alone is211px; the surrounding button,label and gaps cannot fit together.
Only that existing row gains max-w-full and flex-wrap. The native select/labels,
filter logic,sort values,drawer,keyboard behavior and ranking stay unchanged.
No global clipping,scaling,font reduction or hidden content.

The actual broken image belongs to **product133,Applied Nutrition Critical Whey
2.27kg**,2270g. Its existing products.image is
https://files.ekmcdn.com/2ab763/images/applied-nutrition-critical-whey-2.27kg-738-dv-p.jpg
and returns404. Product743/Critical Whey2kg has a different valid200 image; it is
not used for133. Existing approved-resource checks did not establish a replacement
for exact133. [Diagnosis and fresh two-ID GET-only proof](whey-mobile-thumbnail-repair-2026-11-18/diagnosis.json).

CSS background images had no load-error fallback. Existing ComparisonProductThumbnail
now renders a small original-source ComparisonThumbnailImage client child. Native
onError shows **Image unavailable** with exact product identity; a complete/naturalWidth
ref check catches cached failures before hydration. A source key resets failed state
when the actual source changes. Valid images remain visible. Same fixed frame and
HTTP/HTTPS validation; no alternate product image,retry,per-image API/HEAD/database
read,library,CSP/SSRF/TLS weakening or source-specific exception. The upstream133
URL still returns404; this fix handles the real failure in the app and does not claim
to repair external hosting. Missing/unsafe sources retain existing No image handling.

## Tests and actual-source QA

38 focused cases; quick1341PASS/full4078PASS,0 failures and3
unchanged legacy10Reps archive skips. TypeScript,ESLint,Next16.2.9 production build,
Guardian and15 negative contracts pass. Manifest369/seal unchanged; no test file
added/removed. Integration remains isolated; gates receive no production-write keys.
Tests cover source-width contract,actual onError/cached failures,healthy/pending
images,source-key identity reset,unsafe schemes and exact product links.

|Requested viewport|Before document/client px|After document/client px|After body/client px|Initial lab LCP ms|CLS|
|---:|---:|---:|---:|---:|---:|
|320|364/320|320/320|320/320|640→780|0→0|
|360|364/360|360/360|360/360|624→880|0→0|
|375|375/375|375/375|375/375|392→816|0→0|
|390|390/390|390/390|390/390|580→920|0→0|
|430|430/430|430/430|430/430|1044→712|0→0|
|768|753/753|753/753|753/753|1132→740|0→0|
|1024|1009/1009|1009/1009|1009/1009|464→700|0→0|
|1440|1425/1425|1425/1425|1425/1425|404→1052|0→0|

Eight widths preserve all104 real product cards,known/unknown delivery,prices,
check times,nutrition limits,links,filters,sorting,drawer/Escape,keyboard focus,
empty results and long names. Real133404 shows the message in every case; real743
image naturalWidth1100 remains visible. No new clipping,overlap,runtime exception
or HTTP5xx. Fourteen representative cases cover320/1440 on isolate,vegan,creatine,
pre-workout,Applied Nutrition,BioTechUSA and homepage. Paired HTTP readbacks also
cover PER4M,ABE,ClearWhey and the protein-cost guide with exact metadata/schema,
initial text,card-order and link parity. Canonical/index/follow base,param noindex/
follow,robots and all1487 unique sitemap URLs stay unchanged. Tracking code is
unchanged and no retailer test click was generated.

## Performance and evidence

Paired warm median TTFB **212.7→213.3ms**
passes existing after≤before×1.5+100ms guard. Cold catalogue reads **2→2**,warm
**0→0**; no loader/cache/freshness change. HTML **648309→641728B**;
loaded JS **+627B**,CSS **81753B unchanged**. No new dependency. Initial LCP samples
are retained,including1440px404→1052ms. To assess that single variation,three
alternating observations per build at1440/390/320 pass the declared median guard:
1440:820→572ms; 390:932→788ms; 320:952→740ms.
All raw samples/element/resource diagnostics are preserved. These are local lab
diagnostics,not field CWV or traffic improvement claims. Public baseline network/DNS
failures are tracked separately from application response times.

[Validation](whey-mobile-thumbnail-repair-2026-11-18/validation-proof.json) /
[Repeated LCP](whey-mobile-thumbnail-repair-2026-11-18/performance-repeat.json).
Screenshots for all eight widths: before/after files in this same evidence folder;
[320 before](whey-mobile-thumbnail-repair-2026-11-18/before-320.webp) /
[after](whey-mobile-thumbnail-repair-2026-11-18/after-320.webp),
[image before](whey-mobile-thumbnail-repair-2026-11-18/before-critical-whey-320.webp) /
[after](whey-mobile-thumbnail-repair-2026-11-18/after-critical-whey-320.webp),
[drawer](whey-mobile-thumbnail-repair-2026-11-18/after-drawer-320.webp).
Raw HTML,PNGs,read traces and QA scripts remain in ignored worktree tmp.

Only this separate repair PR may release after exact-head green CI and normal
branch protection. Public readback is required before production closeout. SEO-20
stays frozen,SEO-21–31 LIVE VERIFIED,Stage3 off. No production catalogue,product,
variant,offer,mapping,nutrition,history,importer,workflow or Google change.
