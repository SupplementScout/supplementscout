# Content Growth Sprint5 - SEO-25

Owner authorizes analysis, two prepared guides, tests, minimal links and one
Draft PR. Both routes remain planned/noindex. No merge/deployment, production
data or nutrition approval, Google submission, importer/mapping/history/
workflow change, GYM HIGH hub or Sprint6.

## Preflight and search demand

Origin/main be42854a0d72de4e4ec481951e1d13bb97c37b14; existing Drafts532/33
do not overlap. Six existing guides remain distinct; SEO-20 is frozen/binding,
SEO-21/22/23/24 LIVE VERIFIED. The existing Growth Analytics mechanism and
read-only scopes are reused with no new keys, scopes, secrets or workflows.

Four existing workflow runs44166511050,44166516255,44166520996,44166526954
provide final non-overlapping windows19-25Oct,26Oct-1Nov,2-8Nov,9-15Nov.
All28 days have final rows, final/all totals agree, no missing dates. One
GA4 concurrency-quota failure and pending-job replacement required serial
reruns/cooldown; no failed result was zero-filled or used as final evidence.
The original report's incomplete16Nov is excluded.

Site28-day totals:9,661 impressions/74 clicks; last7days:2,496/21.
These describe this site's visibility, not search volume, CPC or confirmed
growth. Query100/week and page-query250/week caps limit discovery. Missing
rows are unknown, not zero. Page, query and site aggregates remain separate;
brand/product queries are separated from generic intent. No Google submission.

## Five candidates and data gate

| Candidate | Current demand and readiness | Decision |
|---|---|---|
| Mass gainer vs whey | Mass Gainer page821 impressions/0 clicks, position51.33 over28days;156/0 last7. Page-query mass gainer114/0, position38.68.10 identity/pricing-qualified gainer products/35 exact g powder variants; whey38/235. No approved gainer protein record; five approved whey variants. Selected one source-reviewed gainer and one different-brand whey with its own approved record. | Select: distinct formula/purchase decision; honest/kg and standalone protein cost, no unsupported calorie/protein ranking. |
| Creatine powder vs capsules | Creatine page450/3 over28days;127/1 last7. Powder18 products/44 exact g variants; five capsule-format candidates have servings-based sizes and no own nutrition override. Other non-g powder/null/gummy records are not counted as capsules. | Defer: cannot make a verified equal-creatine-dose/capsule-count price comparison. |
| Vegan protein vs whey | Vegan page absent from capped returned page rows, so demand unknown. Existing vegan semantic query discovers28 candidates, nine qualify/33 exact powder variants; zero approved own protein records. | Defer: weaker observed demand and unresolved protein comparison, rather than inventing zero traffic or protein values. |
| Pre-workout under30 | Page104 impressions/1 click, position29.63 over28days;31/0 last7.27 products/116 exact variants fit delivered30 cap. No verified/kg values in the audited budget selection. | Valid reserve topic; less observed demand and fewer verified unit metrics than the chosen creatine comparison. |
| Creatine pack-size value | Page450/3; page-query creatine prices52/0, position12.90 over all four weeks. Two source-reviewed same-parent/same-flavour powder families with verified weights; four selected exact variants. | Select: concrete larger-pack purchase decision, including a real counterexample where bigger costs slightly more/kg. |

Counts are identity/pricing/stock/freshness-qualified after existing selectors,
not raw catalogue category counts. Formula/size proof applies only to selected
pins. No multiple flavours are used to inflate product diversity. The proposed
"vs" and size-specific intents are editorial inferences from observed category/
shopping demand; exact new-title query volume is not claimed.

## Exact examples and limitations

Mass/whey: BioTech USA Hyper Mass4kg, Strawberry2223,39.99+4.99=44.98,
11.245/kg; Efectiv Grass-Fed Whey Isolate2kg, Strawberry Milkshake1196,
64.99+0=64.99,32.495/kg. The existing approved1196 record is66x27g,
supporting0.911756.../25g. Gainer nutrition/calorie calculations are withheld.
Manufacturer ingredients support the carbohydrate/milk-protein blend versus
whey isolate; source review is not a new nutrition approval.

Creatine: Applied product742 Unflavoured250g/799,14.40+3.49=17.89,
71.56/kg;500g/4559,30+0=30,60/kg. Optimum product231 Unflavoured
317g/783,16.50+3.49=19.99,63.059936.../kg;634g/4614,40+0=40,
63.091482.../kg. Both sizes in each family have manufacturer formula/size
proof and exact catalogue bindings. No cross-brand/formula substitution;
no verified5g-creatine cost is inferred from powder mass or a parent record.
These are dated audit snapshots; public prices will remain dynamic.

Selected routes: /guides/mass-gainer-vs-whey-protein and
/guides/creatine-pack-size-value. Reuse BuyingGuide, shared price/freshness/
exact-variant/nutrition/cache/metadata/sitemap/error contracts. Add only a
natural contextual incoming link from each relevant category. Product links
use exact variant pages; retailer exits keep the existing product-page tracking.

## Implementation and quality: CODE COMPLETE

Both distinct Server Component guides now use the existing bounded
getBuyingGuideProducts loader, exact-variant selectors, pricing/nutrition
resolvers and lifecycle cache. One small pure projection and shared server
card support these two pages; no CMS, general generator, parallel pricing/
nutrition engine, dependency, heavy image or client calculator was added.

[Authenticated demand](content-growth-sprint-5-2026-11-17/search-demand.json)
records four fresh complete windows and separate query/page/site metrics.
[Data readiness](content-growth-sprint-5-2026-11-17/data-readiness.json)
separates discovery, identity/pricing qualification, verified weight and selected
example readiness. Raw catalogue, manufacturer snapshots and full private
Google reports remain ignored. The public articles contain the purchase
decision and facts, not internal GSC/implementation details.

[Manufacturer identity proof](content-growth-sprint-5-2026-11-17/manufacturer-identity.json)
records bounded current GETs and source hashes. Formula evidence is scoped to
[Hyper Mass Strawberry4kg](https://shop.biotechusa.com/products/hyper-mass-4000-g),
[Efectiv Strawberry Milkshake2kg](https://efectivnutrition.com/products/efectiv-grass-fed-whey-protein-isolate-2kg),
[Applied unflavoured250/500g](https://appliednutrition.uk/products/creatine-monohydrate)
and [Optimum unflavoured317/634g](https://www.optimumnutrition.com/en-gb/products/micronised-creatine-powder).
These source checks do not approve nutrition or infer retailer mappings.
[Existing1196 approval equality](content-growth-sprint-5-2026-11-17/approved-nutrition-proof.json)
proves the complete live override matches the reviewed batch1-v2 after object.

[Actual-source render](content-growth-sprint-5-2026-11-17/actual-source-readback.json)
confirms the dated real prices above and current in-stock/freshness checks.
[Local production HTTP contracts](content-growth-sprint-5-2026-11-17/local-http-contracts.json)
prove initial main HTML equals that independent source render. Both base and
parameter URLs200/noindex-follow, self-canonical, one H1 and factual WebPage/
BreadcrumbList schema. New sitemap candidates are unique but excluded by the
existing lifecycle adapter. Read errors abort through shared error contracts;
valid empty/stale/partial selections retain useful editorial decisions and no
fabricated price, variant or nutrient value.

One contextual crawlable link is added from Mass Gainer to the formula guide
and one from Creatine to the size guide. Prior guide content is untouched.
New cards link to exact product variants, with no direct merchant exits or
new analytics. Existing product-page RetailerOfferLink/productOfferHref keeps
retailer_offer_click and the selected variant_id; those sources are unchanged.
[Existing public readback](content-growth-sprint-5-2026-11-17/existing-public-readback.json)
passes all six selected variant links, four official sources, PER4M/Creatine
and all six previous guide contracts. Public alias remains Production READY
be42854a; new URLs404/unpublished, zero sitemap occurrences.

[Quality summary](content-growth-sprint-5-2026-11-17/quality-summary.json):
140 focused checks, Project Guardian, verify:project, verify:quick1,315,
verify:full4,039, TypeScript, ESLint, baseline validation and Next16.2.9 build
PASS. Inventory reviewed/resealed368:307 safe,57 integration,4 artifact,
67 quick. The Mass Gainer sitemap assertion now matches the exact category
URL instead of counting the new guide slug as a duplicate. No test was disabled
or omitted; isolated Docker/database tests remain outside the quality gate.
Gates receive no production-write credentials.

[Real-source browser QA](content-growth-sprint-5-2026-11-17/local-browser.json)
passes1440desktop/390touch, no horizontal overflow, clipped article text or
overlapping cards, correct keyboard focus and zero runtime exceptions/HTTP
errors. All four screenshots were visually reviewed:
[mass1440](content-growth-sprint-5-2026-11-17/mass-vs-whey-1440.png),
[mass390](content-growth-sprint-5-2026-11-17/mass-vs-whey-390.png),
[creatine1440](content-growth-sprint-5-2026-11-17/creatine-packs-1440.png),
[creatine390](content-growth-sprint-5-2026-11-17/creatine-packs-390.png).
Existing global My Supplements/cookie controls retain their usual behavior.

[Cache/performance](content-growth-sprint-5-2026-11-17/local-performance.json):
new cold/warm TTFB985.5/19.7ms and307.8/24.1ms. Both routes use two bounded
cold catalogue/resolver batches; five warm requests each cause zero DB reads.
Current existing-guide warm medians13.8/15.2ms (Sprint4) and12.3/14.6ms
(delivery/protein method). Small loopback samples show no material slowdown;
first cold startup/source transport is recorded separately. CLS0; local LCP
52-124ms. No production or field CWV/INP gain is claimed.
[Client artifact graph](content-growth-sprint-5-2026-11-17/client-artifacts.json)
contains shared root components/thin error wrappers; neither new page/card
enters the client graph. No new runtime manufacturer request or N+1.

## Handoff: READY FOR PUBLICATION REVIEW

SEO-25 is CODE COMPLETE with one Draft PR. Readiness supports both materials;
missing nutrition is explicit and does not invent protein/calorie/dose winners.
SEO-20 title, frozen fields, measurement clock/gates and schedule are unchanged.
SEO-21/22/23/24 stay LIVE VERIFIED. Stage3 remains disabled and GYM HIGH hubs
deferred. No importer/mapping/history/catalogue/nutrition or workflow change,
production write/deployment, Google submission or Sprint6.

A future separate owner launch decision needs only these two planned-to-
launch_approved entries in app/lib/indexabilityLifecycle.ts and corresponding
existing lifecycle/metadata/sitemap expectations. Central helpers then provide
index/follow and one clean sitemap URL each; parameters remain noindex/follow.
Guarded release and positive public readback must precede live_verified/LIVE
VERIFIED. No new publishing, canonical, cache or sitemap infrastructure is needed.

## Owner-approved production release: in progress

**17 November 2026 SEO-25 production-release approval:** the owner explicitly
authorizes PR #545's two prepared guide lifecycle transitions to
`launch_approved`, necessary existing tests/docs, quality gates, Ready for
Review, guarded squash merge, automatic Vercel Production and public readback.
Only `/guides/mass-gainer-vs-whey-protein` and
`/guides/creatine-pack-size-value` are in scope. Earlier Sprint5 Draft-only/
no-launch wording below is historical and superseded for this release.
SEO-25 remains CODE COMPLETE until positive production evidence; verified
lifecycle state and LIVE VERIFIED closeout require that readback. Preserve
SEO-20 frozen/binding, SEO-21/22/23/24 LIVE VERIFIED and Stage3 disabled.
No catalogue/nutrition/mapping/history/importer/migration/workflow or schedule
write, Google submission, GYM HIGH hub or Sprint6. If direct Vercel API403
persists, retain protections and use authorized GitHub deployment evidence
plus public readback; never claim deployment without reliable verification.

Preflight confirms reviewed HEAD
`b315a504975ba9c0ce7ab8f89028d7d0142a4481`, unchanged main
`be42854a0d72de4e4ec481951e1d13bb97c37b14`, no conflicts and all
relevant CI checks successful. Isolated integration remains intentionally
skipped by the existing workflow policy. The release amendment changes only
the two central lifecycle entries and existing test/documentation expectations;
the reviewed guide, selector, variant, pricing, nutrition and cache logic stays
unchanged. No GSC audit or manufacturer research is repeated.

Existing direct Vercel API access returned403 at the prior handoff. The
authorized GitHub Production deployment webhook and Vercel commit status are
available; public Next Flight build IDs allow a domain build transition to be
recorded alongside fresh page content/metadata. The generated deployment URL
retains its302 SSO gate. No bypass, new credentials or security change is used.
Production verification must correlate the new exact main deployment,
successful Vercel status, changed public build fingerprint and public content;
missing evidence blocks live closeout.

Release amendment local gates pass: Project Guardian,140 focused regression
checks, verify:quick1,315 and verify:full4,039 safe tests, TypeScript, ESLint
and Next16.2.9 production build. The test inventory is unchanged. Fresh
GET-only source rendering at21:18UTC confirms the same six exact variants,
prices and1196 approved nutrition binding. The public prelaunch baseline
at21:15UTC records main be42854a, build yHBCnoya8-F4MoFfJqS3O, both new
routes404 and absent from sitemap, and successful old-page HTTP/metadata.
No live-completion claim is made before merge, deployment and public readback.

## Production closeout: LIVE VERIFIED

**17 November 2026 SEO-25 LIVE VERIFIED closeout:** owner-approved PR #545
squash merged release head `f6ef6f44759da7546bda22daffac2c0cc4328043` as
`65983f24aadee1ec7e0f5f700800f6a10661ccb7` with identical tree. Main Quality Gate and Guardian pass.
Vercel commit SUCCESS and exact GitHub Production deployment SUCCESS,
a changed public build `9_WVqN0zBGLZhUxucMStg`, and source-bound
public readback prove release on the custom domain. Direct Vercel API403
and generated-URL SSO protections are retained. Both guides pass HTTP200,
index/follow, canonical, sitemap, factual schema, six exact variant links,
delivered/kg arithmetic and1440/390px QA. Only existing1196 approved
nutrition supports a protein metric. Both routes now record live_verified
without changing public indexability. Earlier Draft/CODE COMPLETE checkpoints
are historical. SEO-20 remains frozen/binding; SEO-21/22/23/24 stay live.
Stage3 remains disabled; no production-data write, Google action or Sprint6.
Google inclusion is UNKNOWN; the owner handles submissions. Evidence:
`docs/rollouts/content-growth-sprint-5-2026-11-17.md`.

The owner-approved release has passed all public gates. 4039 safe tests, 1315 quick checks and140 focused checks pass; main CI is green.

| Exact current product / variant | Item + delivery = total | Delivered unit cost | Offer checked UTC |
| --- | --- | --- | --- |
| BioTech USA Hyper Mass / Strawberry / 4kg | £39.99 + £4.99 = £44.98 | £11.24/kg | 2026-11-17T11:45:40.735+00:00 |
| Efectiv Grass-Fed Whey Protein Isolate / Strawberry Milkshake / 2000g | £64.99 + £0.00 = £64.99 | £32.49/kg | 2026-11-17T14:57:33.364+00:00 |
| Applied Nutrition Creatine Monohydrate / Unflavoured / 250g | £14.40 + £3.49 = £17.89 | £71.56/kg | 2026-11-17T17:48:48.656+00:00 |
| Applied Nutrition Creatine Monohydrate / Unflavoured / 500g | £30.00 + £0.00 = £30.00 | £60.00/kg | 2026-11-17T17:48:48.656+00:00 |
| Optimum Nutrition Micronised Creatine / Unflavoured / 317g | £16.50 + £3.49 = £19.99 | £63.06/kg | 2026-11-17T17:48:48.656+00:00 |
| Optimum Nutrition Micronised Creatine / Unflavoured / 634 g | £40.00 + £0.00 = £40.00 | £63.09/kg | 2026-11-17T17:48:48.656+00:00 |

These values are a dated readback, not hardcoded guide prices. The live guides
use current cached catalogue offers and age them out through existing guards.
Efectiv1196 alone shows £0.91 per25g protein (66 ×27g); Hyper Mass and
creatine dose/protein metrics remain withheld. Applied500g wins its pair perkg;
Optimum317g wins its pair using unrounded pence/grams ordering.

[Production readback](content-growth-sprint-5-2026-11-17/production-readback.json),
[deployment proof](content-growth-sprint-5-2026-11-17/production-deployment-proof.json),
[actual source](content-growth-sprint-5-2026-11-17/production-source-readback.json),
[nutrition proof](content-growth-sprint-5-2026-11-17/production-nutrition-proof.json),
[links/arithmetic](content-growth-sprint-5-2026-11-17/production-links.json),
[desktop/mobile](content-growth-sprint-5-2026-11-17/production-browser.json),
[performance](content-growth-sprint-5-2026-11-17/performance-followup.json) and
[release gates](content-growth-sprint-5-2026-11-17/release-quality.json) retain
the exact merge, source dates, fallback authority and baseline comparison.

Rollback: if a real release regression appears, stop closeout and revert the
release commit through existing GitHub safeguards and automatic deployment;
verify the previous public build and prior route/indexability behavior. No
production data, approval, credential or protection change is part of rollback.
No rollback was needed. The final closeout commit/deployment must pass the same
public build/readback and CI gates; its exact result is recorded on PR #545.
