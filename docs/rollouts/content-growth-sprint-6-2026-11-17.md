# Content Growth Sprint6 — SEO-26

**Status:** CODE COMPLETE; READY FOR PUBLICATION REVIEW in one Draft PR.
**Base main:** `971527c3d6cc6062a823867b083465512ade3bdc`.
No merge, production launch, launch_approved transition or production-data write.

## Bounded preflight and authority

The owner authorizes at most two guides, implementation/tests/docs and one
Draft PR. The dated SEO-26 exception is the only implementation beside frozen
SEO-20; all SEO-21/22/23/24/25 must remain LIVE VERIFIED. Prior Draft532/33
have no overlapping guide scope. Eight published guides and final SEO-25 main
production/readback were checked. The new URLs do not already exist publicly
(404, absent from sitemap). No completed sprint or broad competitor audit was
repeated. Next16.2.9 metadata/sitemap/error documentation was read locally.

## Demand and second-topic decision

[Authenticated demand evidence](content-growth-sprint-6-2026-11-17/search-demand.json)
reuses four latest complete reports (44166511050,44166516255,44166520996,
44166526954), without rerunning them. The28 final days19Oct–15Nov have
9,661 impressions/74 clicks;9–15Nov has2,496/21. A single fresh availability
check through16Nov (run44186080465,22:03UTC) still lacks final16Nov activity
and has final/all differences. Its overlapping partial week is excluded, not
added to either window. Raw authenticated reports remain in ignored tmp.

Pre-Workout has104/1 page impressions/clicks over the complete28 days.
Returned page-query observations include affordable pre workout7 impressions
across3 weeks, cheap pre workout6 across2, and pre workout price comparison4
across3. These support a delivered-budget decision; £30 is an editorial budget,
not a claimed observed exact-title search volume.

Mass Gainer has821/0 page impressions/clicks over28 days and156/0 in the
last complete week. Cheap mass gainer has18/0 across all4 returned weeks;
buy mass gainer has5 observed impressions across3. The £40 budget is an
editorial inference from that purchase intent plus real current pack costs.

| Second-topic candidate | Evidence and decision |
| --- | --- |
| Mass gainer under £40 | Selected: strongest complete observed page/purchase signal; three fresh exact packs/three brands with known delivered totals and verified weights. Budget shortlist differs from formula choice. |
| Whey isolate under £40 | Four fresh exact offer samples exist. Page rows are returned for only two weeks (latest126/1), so no28-day page total is claimed. More overlap with existing protein-budget/formula/pack guides; lower priority this sprint. |
| Vegan protein under £30 | Earlier bounded audit and one refreshed exact sample show real delivered offers. No page/query rows returned within caps; demand remains unknown. Existing protein-budget guide already includes a plant example. Not selected. |
| Protein bars / pack units | No relevant rows returned within caps; unknown demand. Existing Draft33 covers a catalogue recheck. No new bar article or parallel catalogue audit. |
| Multivitamin pack/unit cost |55/0 page impressions/clicks over28 days; price-comparison query4 observed impressions across3 weeks. Weaker budget signal; exact unit evidence would need a separate scoped selection. Not selected; no claim that catalogue data is absent. |

Weekly query/page-query caps remain100/250. Missing rows are unknown, not zero.
Page, query and site totals stay separate. Brand/product observations are
labelled separately. No country filter or global keyword-volume/CPC inference;
no traffic-growth claim for guides published after these dates.

## Prepared routes and distinct purchase decisions

- `/guides/pre-workout-under-30`: what one exact pre-workout pack costs
  within £30 including shipping. The category is the wider catalogue; the
  existing caffeine-free guide answers confirmed absence instead of budget.
- `/guides/mass-gainer-under-40`: already choosing a gainer, what exact pack
  fits £40 and how cash spend differs from verified powder weight value.
  The existing mass-gainer-versus-whey guide answers which formula to choose.

All eight previous guide sources are unchanged. Only one contextual link is
added to each relevant category: Pre-Workout and Mass Gainer. Product links
keep exact variant parameters and lead into existing retailer_offer_click
tracking. No new analytics event or dashboard.

## Actual selected data

Fresh bounded reads of11 preselected candidate slugs use the existing loader
and resolver (two GET batches), not a full category or catalogue census.
Selected cards bind canonical product ID/slug/name/brand/category and exact
active variant ID/owner/flavour/gram size/single-pack format. Unknown, stale,
unavailable, invalid or ambiguously mapped offers cannot supply a price.
Three different products and brands qualify per guide.

| Exact product / flavour / pack / variant | Retailer | Item + delivery = total | Verified powder unit cost | Offer checked UTC |
| --- | --- | --- | --- | --- |
| Warrior Rage Unleash Hell / Blazin Berry / 392g (`1006`) | eBay UK | £13.99 + £0.00 = **£13.99** | Not verified | 2026-11-17T14:56:56.868+00:00 |
| Applied Nutrition ABE Ultimate Pre-Workout / Baddy Berry / 315g (`1672`) | eBay UK | £21.95 + £0.00 = **£21.95** | Not verified | 2026-11-17T14:57:48.215+00:00 |
| Cellucor C4 Sport Pre-Workout / Icy Blue Raspberry / 270 g (`4610`) | Holland & Barrett | £19.99 + £3.49 = **£23.48** | Not verified | 2026-11-17T17:48:48.656+00:00 |
| 7Nutrition Bodybuilder / Cookies & Cream / 1.5kg (`2009`) | 6 Pack Supplements | £19.99 + £4.99 = **£24.98** | £16.65/kg | 2026-11-17T11:45:40.735+00:00 |
| Mutant Mass / Vanilla Ice Cream / 2270g (`1973`) | Fit House | £31.99 + £3.99 = **£35.98** | £15.85/kg | 2026-11-17T11:11:52.1+00:00 |
| Applied Nutrition Critical Mass Lean Mass Gainz / Chocolate / 2400g (`1803`) | Whey Okay | £33.57 + £3.99 = **£37.56** | £15.65/kg | 2026-11-17T10:48:03.114+00:00 |

These are dated audit values; live-guide code contains no fixed current price.
The existing delivered-price engine adds pence. Both thresholds are inclusive:
exactly£30/£40 qualifies, one penny over does not. C4 Sport's lower item
price becomes a higher delivered total than ABE in this current selection;
the dynamic explanation disappears if that relationship changes.

No selected exact variant has the own reviewed serving-count/nutrition
evidence required by the guide. Pre-workout portion counts and serving costs
are therefore withheld. Applied ingredient facts on1006/1672 remain available
on their existing product pages; their serving-basis text does not approve a
pack serving count. The new guide displays no caffeine quantities, absence
claim or efficacy ranking. Unknown caffeine is explicitly not confirmed absence.
Mass-gainer unit prices compare powder weight; no protein/calorie/dose cost
or cross-formula nutrient winner is invented. Nutrition and production data
are never written or newly approved.

## Implementation and local evidence

BuyingGuide, GuidePriceBreakdown, getBuyingGuideProducts, selectGuideExample,
categoryComparison, pricing, exact resolver, freshness and lifecycle cache are
reused. One small six-pin selector and one server-rendered card support these
two pages. No new engine, CMS, generator, library, image or client-side page.
Distinct cache versions pre-workout-budget-examples-v1 and
mass-gainer-budget-examples-v1 retain the shared hour-bucket contract.

[Actual source](content-growth-sprint-6-2026-11-17/actual-source-readback.json),
[actual Next HTTP](content-growth-sprint-6-2026-11-17/local-http-contracts.json)
and [public links/arithmetic](content-growth-sprint-6-2026-11-17/public-links-arithmetic.json)
pass: initial main HTML equals independent current-source rendering; prices,
check times and exact links appear without client hydration. Both base and
parameter URLs have noindex/follow and clean self-canonical. Factual
WebPage/BreadcrumbList schema, one H1, headings and crawlable links pass.
New sitemap candidates are centrally filtered out; old protected URLs stay
once each. Thin existing error boundaries and fail-closed source contracts
are preserved. Empty/partial/stale/OOS/unknown-shipping cases retain useful
buying steps and cannot invent a replacement offer.

[Local browser QA](content-growth-sprint-6-2026-11-17/local-browser.json)
passes1440/390px, card layout, readable text, horizontal overflow, keyboard
focus, runtime and HTTP checks; four screenshots were visually reviewed.
[Performance](content-growth-sprint-6-2026-11-17/local-performance.json):
new cold/warm TTFB688.6/19.1ms and289.8/14.8ms. Each route has two bounded
cold DB reads and zero across five warm requests. Seven existing guides have
warm medians12.5–23.2ms; earlier Sprint5 local medians were19.7/24.1ms.
No material slowdown appears in these small loopback samples. CLS0, local
LCP48–176ms; network/cold source costs stay distinct. No field CWV/INP gain
is claimed. [Client graph](content-growth-sprint-6-2026-11-17/client-artifacts.json)
keeps new pages/card outside the client graph and adds no dependency.

[Quality summary](content-growth-sprint-6-2026-11-17/quality-summary.json):
166 focused tests; quick1,330/full4,054 safe tests; Project Guardian, inventory,
TypeScript, ESLint and Next production build PASS. Inventory resealed369
(308 safe,57 integration,4 artifact,68 quick); no existing test omitted or
reordered. Guardian negatives reject changed/extra guide routes, missing owner
authority, a third implementation and reopening any SEO-21–25.

## Handoff: READY FOR PUBLICATION REVIEW

SEO-26 is CODE COMPLETE for one Draft PR, with local actual-source evidence
and public existing-destination checks. This is not production publication.
Both routes remain planned/noindex and absent from the public sitemap.
The owner's later launch decision would need only these two lifecycle entries
to become launch_approved, aligned existing tests/docs, guarded release and
a positive public readback before LIVE VERIFIED. No new publishing mechanism
is needed. SEO-20 stays frozen/binding; SEO-21–25 stay LIVE VERIFIED.
Stage3 remains disabled; GYM HIGH hubs remain deferred. No production data,
importer/mapping/history/nutrition/workflow/schedule or Google write, merge,
production deployment or Sprint7.
