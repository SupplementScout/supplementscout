# Sprint 01 release and Sprint 02 natural search intent

28 November 2026. Sprint 01 is released; Sprint 02 is a separate Draft-only change. No permission to merge or deploy Sprint 02. Evidence is retained in the primary checkout under `tmp/customer-natural-search-intent-2026-11-28`; previous sprint artefacts remain intact.

## Sprint 01 release

Owner-approved PR [573](https://github.com/SupplementScout/supplementscout/pull/573), head `0e5852b0f5625ef946450c535a23102489bcb46f`, was normally squash-merged as `345c9082a58db3e8bdf5284d8d6fdb4f81cf3456`. Both trees equal `11eaa290316b094f9c80d16dd313cc3646aff8a9`. The approved 8-file/+171/−9 scope and green head checks were verified immediately before merge. No admin bypass, force push or auto-merge was used.

Main [Quality Gate 46149576231](https://github.com/SupplementScout/supplementscout/actions/runs/46149576231) and [Guardian 46149576199](https://github.com/SupplementScout/supplementscout/actions/runs/46149576199) passed. The one resulting Git deployment `dpl_5QRxo1vV2EMSYhodhdFztMoVeHdS` is Production READY at `www.supplementscout.co.uk`, with the exact merge SHA and correct aliases. No extra deployment was requested.

Nine public GET checks passed HTTP 200: homepage, Search, Compare, Whey Protein, explicit comparison query, both prefilled queries, partial selection, complete selection and PER4M 310g. They verified the CTA, retained second phrase, exact variant 1003/802 offer links, canonical and noindex on parameter combinations. Chrome observed the working comparison pack search, then Search reached Vercel Code 29. Full live browser PASS is not claimed; the authorised GET fallback and unchanged approved-tree local interaction evidence close that boundary. WAF and browser verification were unchanged. No outbound CTA or analytics conversion was triggered. Sprint 02 started only after main CI and release postflight passed.

## Confirmed parser problems and change

The original shared plan recognised some constraints but retained shopping grammar in `textQuery`, producing empty results in the six representative local desktop/mobile cases. Currency aliases and malformed-value partial matches were also reproduced. `searchIntentParamsFromPlan()` dropped the selected metric's sort, and the £1,000 canonical spelling failed its own budget round-trip.

| Query | Before text / interpretation | After text / interpretation |
| --- | --- | --- |
| Whey protein under £40 including delivery | `Whey protein including delivery`; budget 40 | `Whey protein`; known delivered total ≤ £40 |
| Creatine under 20 pounds | Full query; no budget | `Creatine`; known delivered total ≤ £20 |
| Cheapest whey protein per serving | `whey protein per serving`; delivered-price sort | `whey protein`; verified cost per serving |
| Whey isolate with the lowest cost per 25g of protein | `Whey isolate with the`; protein metric already recognised | `Whey isolate`; same verified cost per 25g protein, not a pack or minimum-protein constraint |
| Creatine under £25 with the lowest cost per 5g | `Creatine with the`; budget and metric already recognised | `Creatine`; both £25 ceiling and verified cost per 5g retained |
| Best value whey protein | Full query; no metric | Known category text `whey protein`; relevance stays neutral; existing Help Me Choose priority clarification remains available |

The same `searchIntent.ts` pipeline serves Search and Help Me Choose. Existing metric definitions gain bounded patterns; delivery wording is consumed only within a valid attached budget clause. Category-only “best value” uses the existing `categoryBrowseHref` registry, without selecting a metric or stripping unknown brand/product names. Existing request constraints, pricing, eligibility and ranking remain responsible for the results. No category constraint or winner is invented.

`canonicalIntentQuery`, `intentUrlStateFromPlan` and `searchIntentParamsFromPlan` remain the shared URL path. Sort is now preserved once in the generated parameters; explicit URL choices continue to win. Canonical money is ungrouped so the existing maximum £1000 round-trips. The existing inclusive `≤` budget boundary, strictly positive amounts up to £1000, legacy terminal bare-number budgets and unavailable-delivery rule are retained. Malformed money is kept as unparsed text, not partially interpreted. Unsupported sugar/suitability clauses, medical boundaries, brands, pack sizes, flavours, format, caffeine and verified nutrition constraints stay intact.

No new product helper, external dependency, engine, public component, UI panel, nutrition metric, catalogue query or data schema. Three existing isolated test loaders now resolve the real category-registry dependency; historical fixtures/assertions are retained. No test file was added, removed or renamed; inventory remains 373, so no manifest reseal was needed. The only Vercel change disables the exact Sprint 02 feature branch through the existing map before push; main and global settings remain unchanged.

## Validation and measurement

- Four grammar/URL/money regressions failed before the fix. The final focused suite passed **282/282**, including pricing, Search, category handoff, decisions, Sprint 01 comparison handoff, metadata/indexability and historical public-render/data-read parity. Quick passed **1452**; full passed **4330**, with zero failures and the same three historical skips (eight new regressions over the released 4322 baseline). Inventory remains **373**; TypeScript, ESLint, Guardian, migration-file validation, production build and diff check passed. Exact-head CI results are recorded on the Draft PR and in local evidence; no initial interrupted run is represented as PASS. Docker/PostgreSQL integration was not required or run.
- New synthetic regressions cover inclusive delivered-price boundary, above-budget rejection, unknown shipping, out-of-stock/stale offers and missing verified servings/protein/creatine. An ambiguous value request uses existing priority clarification, while an explicit priority or sort retains precedence.
- The existing isolated search-pipeline harness compared four corrected natural requests with equivalent released-main requests. Full semantic payloads match except the intentionally preserved original `rawQuery`; all three reads have identical shapes, counts, rows and bytes. Additional runtime catalogue queries: **0**.
- Paired same-process source benchmark, seven alternating rounds: ordinary 31-query corpus **25.49 → 27.78µs/query**; 200 characters **44.08 → 45.89µs**; 10,000-character stress **326.44 → 341.66µs**. This is a small parser CPU increase, measured once per request, not per product. Existing query-length behaviour is preserved. These are lab microbenchmarks, not page-speed, CrUX, traffic or conversion claims.
- Before/after browser QA reuses the existing Chrome DevTools transport and GET/HEAD-only catalogue harness, reusing retained responses and capturing only missing control reads before replay. Search requests carry `page=1` to suppress existing server search telemetry; GA and outbound routes are blocked. No new testing framework or source/feed fetch was added. Results/eligible counts may change with normal offer freshness and are not asserted as fixed catalogue totals.
- Final browser checks passed at 1440px/390px: six formerly empty natural queries now render eligible results (12 paired cases), plus the category-only ambiguous value request (two cases). Help Me Choose displayed its existing priority clarification for that ambiguity and its exact-variant shortlist for combined budget/creatine value (four cases). Canonical/noindex, overflow and runtime exceptions were checked. Total loaded JS was not identical in every sample; the before empty state and after populated state differ, so this is not an identical-output bundle benchmark. No client source, component, script or UI design was added or changed. Page-speed improvement is not claimed.

## One next acquisition task

Prepare the already planned **SEO-17** owner-authored, dated expert decision-note payload for the existing `/whey-protein` hub, with verifiable facts and distinct value beyond Help Me Choose, Quick Comparison and existing copy, for Google and AI answer discovery. The ledger still records SEO-17 as PLANNED, SEO-20 as frozen IN PROGRESS and SEO-21–33 as LIVE VERIFIED. This task does not start that implementation, reopen those completed tasks or create SEO-34. No traffic or AI-citation uplift is promised.

## Safety

Sprint 01 normal merge: 1; resulting Production deployment: 1. Sprint 02 merge/deployment: 0. Production business writes, SQL/migrations, imports, manual business-workflow dispatches, credential/permission/schedule/automation changes, new eBay API calls and membership changes: 0. Production273/pending0, staging120/three prior pending, membership v3/322 (237+85), EPN, Simply authority and prior owner approvals are untouched; those are preserved boundaries, not a repeated database audit. Predators Gear page/source/feed and integration untouched. Original user changes and earlier evidence remain preserved.
