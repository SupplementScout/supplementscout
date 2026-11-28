# Customer Search to Purchase — Sprint 01

28 November 2026. Draft release scope based on main `e2630121cbb4ca1737495e89e2bc97ed6aed6a79`. No release authority or change to the SEO execution order.

## Customer problem and bounded change

1. A real public GET for **PER4M Whey vs Applied Nutrition Critical Whey** returned **No results found**, with no comparison handoff. Search now offers **Compare side by side** for an explicit, single `vs` / `versus` pair. The existing comparison selectors receive both names as search text. Customers explicitly select each product, inspect the displayed exact pack/flavour, and follow the existing variant-specific offer links. Selecting the first product retains the second search. This does not choose identities automatically or add a ranking engine.
2. On the unchanged catalogue, desktop (1440px) and mobile (390px) comparison selectors showed Per4m Creatine Sherbet 310g for **PER4M**, but no match for **PER4M 310g**. The existing selector now requires every entered word to match the same option, regardless of field order. Wrong flavour/pack and already-selected-product exclusions remain tested. No pack aliases or automatic variant resolution were introduced.

The existing `/compare?left=…&right=…` contract, comparison prices, variant resolver, product links, nutrition/freshness safeguards, outbound redirect and consented analytics remain the sources of truth. One new helper (`comparisonSearchQueries`), no new dependencies, components, data queries, test files or database changes. The new branch alone is disabled in the existing Vercel `git.deploymentEnabled` map before its first push; main stays enabled.

## Evidence and limits

Evidence directory: `tmp/customer-experience-sprint-01-2026-11-28` in the primary checkout (ignored, not shipped).

- Twelve owner-supplied queries were exercised at 1440px and 390px on the local production build. Exact PER4M and Critical Whey searches, the creatine budget search and caffeine-free pre-workout returned products. Several longer value/budget sentences returned no results despite recognising part of the intent. The explicit comparison query now has a useful continuation; the remaining language-parser gap is the single recommended next task.
- Existing homepage search/category/Help Me Choose entries, whey category, two-product comparison, variant-specific product/retailer presentation, and Help Me Choose priority → shortlist → exact variant were inspected locally. Example shortlist: creatine under £20 → lowest delivered price → Per4m capsules, variant 2881. Existing medical-suitability limitations and the magnesium data-gap message remain visible.
- Public Chrome hits Vercel browser verification Code 29. It is not treated as a product regression, and live browser verification is unavailable. Public curl returned the actual comparison-query HTML with HTTP 200. No security setting was changed.
- Local QA reuses the earlier GET/HEAD-only catalogue adapter and Chrome DevTools transport. Before data is captured once and replayed for after checks; non-read methods, unlisted tables and external services are blocked. Image optimisation can therefore produce an existing blocked-CDN fallback in the local harness. No retailer source/feed or outbound redirect is requested, and analytics requests are blocked. Search requests carry `page=1` to skip existing server search telemetry without changing ranking.
- Two new regressions failed before implementation; the focused search/comparison/decision/SEO suite passed **209/209** after implementation. The existing released-main rendering, metadata, client-boundary and data-read parity suite remains intact; unchanged routes pass it. No test inventory reseal is required because no test file was added, removed or renamed.

Final local gates: focused **209 PASS**; released-main compatibility subset **65 PASS**; quick **1,444 PASS / 3 historical SKIP**; full **4,322 PASS / 0 FAIL / 3 historical SKIP** (four added regressions over the 4,318 baseline); inventory **373 unchanged**; TypeScript, ESLint, Project Guardian, migration-file validation, production build and `git diff --check` PASS. PostgreSQL/Docker integration was not required for this presentation-only patch and was not run. CI is reported on the exact Draft PR SHA.

After browser checks passed on desktop/mobile: the combined brand/pack query returns the real 310g product; both comparison names are prefilled; selecting A retains B; keyboard Enter selects B; both exact variant offer links remain intact; the PER4M variant 1003 page exposes only its eligible offer CTA. No CTA was followed. Input labels/status associations, canonical/robots and absence of horizontal overflow were checked. The existing full regression suite preserves metadata/data-read parity for unchanged routes.

Paired warm local production-build measurements (median of three, same Chrome, viewport and captured catalogue):

| Route | Desktop LCP before → after | Mobile LCP before → after | CLS before / after | JS change |
| --- | --- | --- | --- | --- |
| Search, explicit comparison | 48 → 44ms | 52 → 44ms | 0 / 0 | 0 bytes |
| Comparison base | 52 → 44ms | 56 → 48ms | 0 / 0 | +142 encoded bytes |

The small comparison script increase preserves the other selector's query. No additional catalogue query or client component was added. These samples show no observed lab regression, not a proven speed improvement. Wall-clock freshness advanced between runs (438 → 431 currently selectable variants); captured source responses were unchanged. Field INP and CrUX are unavailable. New-selector input-to-two-frame measurements were 5.1ms desktop and 11.5ms mobile and are not INP. This document does not claim production verification or conversion improvement.

## Business baseline

Reused existing Growth Analytics run [45260145822](https://github.com/SupplementScout/supplementscout/actions/runs/45260145822), artifact 14860351046, SHA-256 `1cf11d7e01bff855e31c475ccabf5f0451c21d2dae5b7c5a4437c51283cd7927`, generated 23 November. A newer successful run had no retained artifact; no report workflow was dispatched.

- 16–22 November: organic GA4 **7 users, 49 sessions, 208 views, 5 retailer-offer clicks**. These are organic figures, not all-site totals or proof every visit is external.
- GSC final activity covers 16–21 November: **10 clicks, 2,091 impressions**. The requested seven-day window is incomplete: 22 November adds 257 non-final impressions. Do not label this a complete final seven-day baseline.
- Top GSC landing page in the retained report: homepage (5 clicks / 143 impressions); ISO-XP 1kg, Ghost Legend V4 660g, MMS Hi Protein 875g and ON Gold Standard 2.27kg each had one click. This is search landing evidence, not all-channel GA4 landing sessions.
- Historical, fixed 15 October–11 November window: `search` 19; `select_search_result` 5; `view_product` 76; `retailer_offer_click` 20; `add_product_to_comparison` 4; `complete_two_product_comparison` 1. This is not the latest 28 days. `return_to_my_supplements`, `_7d` and `_30d` each recorded zero events in that historical consented sample; that does not mean the site has no returning users.
- Current all-site 7/28-day users/sessions, current search/no-result/product funnels, Help Me Choose usage, returning-user totals, comparable previous period, affiliate sales and revenue: **UNAVAILABLE in the retained report**. No conversion/revenue uplift is claimed.

Existing event contracts include `search` (result_count, has_filters, search_context), `select_search_result` (product_id, position), `view_product` (product/variant/category), `help_me_choose_started`, `decision_priority_selected`, `decision_results_viewed`, `decision_product_opened`, `decision_clarification_shown`, `complete_two_product_comparison` (left/right IDs), and `retailer_offer_click` (product/variant/retailer/price/position/source/is_affiliate). No separate client `no_results` event exists in the typed event map; zero results use the existing search result count and server search evidence. No new event parameters were added.

Expected effect: fewer abandoned explicit comparisons and easier product discovery in the existing selector; any increase in comparison completion or retailer clicks requires measurement after a separately approved release.

## One next product priority

Extend the existing `searchIntent.ts` parsing with bounded regressions for the observed budget/value sentences (for example **Whey protein under £40 including delivery** leaves “including delivery” in the product text). Preserve explicit limits and unavailable nutrition metrics; do not build another search engine or expand catalogue data in this sprint.

## Safety

Production business writes 0; migrations 0; imports 0; manual business workflow dispatches 0; credential changes 0; eBay API calls 0; membership changes 0; merges 0; production deployments 0. Retailer automation, approvals, protected identities and EPN paths are untouched. Predators Gear source/feed untouched. User changes and earlier artefacts remain in the original checkout.
