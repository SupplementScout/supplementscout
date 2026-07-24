# SupplementScout Operating Plan

**Status date:** 24 July 2026<br>
**Purpose:** One authoritative operating document for architecture, current state, priorities, rules, roadmap, and definitions of done.  
**Replaces:** the older fragmented project brief and decisions scattered across chats.  
**Primary goal:** Build the UK's smartest and most trustworthy supplement search and comparison platform.

---

## 0. Binding audit reset - 19 July 2026

This section records the full-project audit requested before further implementation. It is the binding execution reset. Where an older status, priority or proposed implementation elsewhere in this document conflicts with this section, this section wins. Historical sections remain as evidence, not as authority to restart completed work.

### 0.0 Latest execution update - 19 July 2026

`/creatine` is launched and indexable. Its current-price ranking, retailer ranking and JSON-LD use fresh offers only; stale/no-source offers remain excluded from current-price claims.

Daily creatine offer refresh is active via the existing GitHub Actions scheduling method in `.github/workflows/creatine-offer-refresh.yml`. It runs once per day at `03:17 UTC`, which is `03:17 Europe/London` in winter and `04:17 Europe/London` during British Summer Time. The exact automatic scope is 35 existing approved creatine offers only: Fit House 18, Discount Supplements 12 and Jon's Supplements 5. The job may update only price, stock, offer URL, `last_checked_at`, and price history when delivered-price inputs genuinely change. It must not create products, variants, retailer mappings, retailers, merges, deletions or identity repairs.

No-source creatine retailers remain excluded from the automatic refresh: Whey Okay 22, GYM HIGH 3 and Simply Supplements 1. The next product/data step is Jon's catalogue review and one reviewed 25-50 offer catalogue-growth batch using the existing importer; increasing 2+ retailer coverage still requires another authorised overlapping source.

### 0.0.1 Jon's catalogue closeout - 22 July 2026

This update supersedes older Jon's catalogue-growth and production-enablement next actions elsewhere in this document. Historical sections remain evidence only.

- The authoritative Jon's source remains the public Shopify snapshot captured with explicit `GB` market context. The closeout source contains 224 products and 844 variants.
- The final reviewed batch passed staging and production with exact deltas: products `+34`, active products `+34`, product variants `+51`, retailer mappings `+51`, offers `+51`, price history `+51`, retailers `0`, recovery calls `0`.
- Production and staging now both have 918 products, 917 active products, 1,569 variants, 1,488 mappings, 1,487 offers and 1,496 price-history rows. Jon's has 506 mappings and 506 offers, up from 455.
- The real post-apply importer dry-run returned 51/51 current/unchanged, 0 blocked, 0 skipped, 0 failed and all new deltas 0. Active import, offer-sync and catalogue approvals/runs are 0.
- The final 844-row ledger reconciles exactly: 506 `MAPPED_APPROVED`, 8 `EXCLUDE_PROHIBITED`, 318 `EXCLUDE_OOS_BUNDLE_BBE_OR_NONPRODUCT`, 10 `EXCEPTION_UNRESOLVED`, 2 `DEFER_LOW_VALUE`, and 0 unclassified.
- SARMs and real peptide products remain permanently excluded. Ordinary collagen, hydrolysed protein and normal protein-peptide wording remain allowed when ordinary identity safeguards pass.
- Jon's catalogue closeout is complete for the reviewed safe scope: all rows are mapped or deliberately classified. Operational automation is also complete as described below.
- The reviewed stock-only closeout passed on staging and production for the exact eight authorised offers: stock changed from `true` to `false` for 8, freshness changed for 8, and price, URL, mappings, products, variants and price history changed by 0. Approvals were consumed and recovery calls were 0.
- A fresh full-catalogue dry-run then matched all 506 Jon's mappings and classified all 506 as `VERIFY_NO_CHANGE`, with 0 missing mappings, identity changes, duplicate source identities, source errors or blockers. The same GB source contained 224 products, 844 variants and 575 available variants; the other 338 source variants remain discovery-only and reconcile exactly with the 506 mappings.
- Jon's operational automation is complete. The protected GitHub Environment `production-readonly` contains the three existing, separate least-privilege production connection URLs for `retailer_catalogue_production_validator`, `retailer_catalogue_production_approver` and `retailer_catalogue_production_executor`; no new login, role or broad grant was created. The narrow registration RPC creates an immutable parent and 11 ordered children, and sequential approval permits only the next legal unchanged child.
- Manual GitHub run [`29931897205`](https://github.com/SupplementScout/supplementscout/actions/runs/29931897205) passed on commit `f28d462a45e11f01437365a579c5ad7fa696ad86`. Environment access, 59 contract tests, source capture, discovery, dry-run, registration, validator, all 11 sequential approvals/applies, fresh idempotency and artifact upload passed. Scope was 506 mappings/offers; all classified `VERIFY_NO_CHANGE`, freshness changed for 506, price/stock/URL/history and catalogue row counts changed by 0, discovery reported 338, blockers were 0, the parent finished `COMPLETED`, children finished 11/11 `APPLIED`, active plans/approvals/runs were 0 and recovery was 0.
- `.github/workflows/jons-offer-refresh.yml` is active on `main` through both `workflow_dispatch` and the daily `04:47 UTC` schedule (`05:47 Europe/London` during British Summer Time). The next scheduled run after the validated 22 July run is 23 July 2026 at `04:47 UTC` / `05:47 Europe/London`. Tests and a dry-run remain hard gates; explicit `GB` market context, exact source identity, source-collapse and mass-change guards remain unchanged; routine execution cannot create products, variants or mappings. No routine manual Jon's refresh is required.

### 0.0.2 Whey Okay exact-manifest automation - 24 July 2026

This update supersedes older statements that Whey Okay lacks an authorised repeatable source or that all legacy reconciliation must finish before exact-mapping automation.

- The authorised source is the public EKM Google Product Feed at `https://wheyokay.com/ekmps/shops/2ab763/data/ekm_p_2ab763.txt`, classified `FULL_AUTOMATIC_SOURCE`. The reusable reader requires HTTP success, safe same-host HTTPS redirects, UTF-8 tab-delimited data, the exact 48-column schema, exact EKM parent and variant IDs, valid Whey Okay URLs, parseable price and availability, and `Last-Modified` freshness within 24 hours. It does not depend on the feed's blank GTIN, MPN or size fields.
- The immutable automatic scope is exactly 586 existing mappings and 586 existing offers in `config/retailers/whey-okay-approved-offer-manifest.json`, SHA-256 `54D828AF0E3C20F548708832E0A7AD9DCAF74B1CBC6AB043ED7696D6F7C4D731`. The frozen evidence state was 527 active and 59 monitored-OOS rows. Duplicate source identities, duplicate canonical semantic targets and missing feed identities were all 0.
- All 284 remaining legacy mappings are outside automation. Mapping IDs `11`, `150`, `191` and `249` are explicit reviewed rebind exceptions and remain untouched. The permanent Q3/Q4 fail-closed exceptions, apparel and every unapproved discovery row are also excluded. Routine refresh cannot create, remap, merge, delete or recover products, variants, mappings or offers.
- The first controlled staging and production refresh both passed. Each processed 586 rows through 12 guarded children: 580 verified no-change, five stock changes and one price change. Products, active products, variants, mappings, offers and retailers had row-count delta 0. Offer URL, mapping URL and shipping mutations were 0. All 586 offers received a fresh `last_checked_at`; one real price change created one price-history row and established its delivered total.
- Exact first-refresh changes were: source `2418:2419`, mapping `371`, offer `342`, price `£39.87 -> £47.18`, preserved shipping `£3.99`, delivered total `£51.17`; sources `3070:3070`, `3665:3665` and `3904:3904` changed in stock to out of stock; sources `531:531` and `3304:3304` returned to stock. Staging and production idempotency then returned 586/586 `VERIFY_NO_CHANGE`, history delta 0, approvals fully consumed and recovery 0.
- The feed audit found 31 current feed-versus-stored shipping differences, compared with the earlier expectation of 28. They are reported separately and remain deferred; first-rollout stored shipping was preserved for all 586 rows.
- Guard baselines are 520 source products and 1,678 source rows. Counts below 90% block as degraded and below 75% block as genuine collapse. Further guards enforce complete manifest coverage, unique identities, no more than three new OOS rows, total OOS at most 20%, OOS increase at most five percentage points, changed rows at most 20%, price-changed rows below 10%, per-row price movement below both the 60% and £20 hard limits, and URL host `wheyokay.com`. Child packaging distributes OOS rows deterministically without weakening these thresholds. Missing approved rows, source failure, stale or malformed feeds block before writes; new rows are discovery-only.
- The workflow `.github/workflows/whey-okay-offer-refresh.yml` is active on `main`, defaults `workflow_dispatch` to dry-run and runs daily at `02:17 UTC` (`03:17 Europe/London` during British Summer Time), after the observed approximately `01:01 UTC` feed generation. It uses the existing separate least-privilege validator, approver and executor credentials in the protected `production-readonly` Environment, never a service-role bypass, and keeps `SAFE_UPDATE` unset.
- Manual GitHub dry-runs [`30074666550`](https://github.com/SupplementScout/supplementscout/actions/runs/30074666550) and [`30074733707`](https://github.com/SupplementScout/supplementscout/actions/runs/30074733707), plus scheduled-context dry-run [`30074802757`](https://github.com/SupplementScout/supplementscout/actions/runs/30074802757), passed on commit `c5eae74bf072d1b93b206fd2853075c0485a3b7a`. Each passed 120/120 tests, the full 586-row production validation and evidence upload while apply remained skipped.
- Operational status is **TECHNICALLY COMPLETE — AWAITING SCHEDULED PROOF**. It becomes **WHEY OKAY OPERATIONALLY COMPLETE** only after real cron runs at `2026-07-25 02:17 UTC` and `2026-07-26 02:17 UTC` both pass with complete artifacts, 586/586 manifest coverage and no unexplained warning or unsafe write.

### 0.0.3 Consent-aware public analytics - 22 July 2026

- GA4 is integrated through `NEXT_PUBLIC_GA_MEASUREMENT_ID` and is disabled safely when the variable is absent. Google Tag Manager and advertising tracking are not used.
- UK visitors receive equal Accept all and Reject non-essential choices, a separate analytics preference and a persistent way to reopen settings. Consent Mode v2 defaults analytics and all advertising signals to denied; accepting grants analytics only, while rejecting or withdrawing keeps every advertising signal denied.
- Manual route tracking avoids duplicate `page_view` events. Privacy-safe custom events cover product/category views, search result metadata, filters, sorting, zero results and retailer-offer clicks. Raw search text and personal identifiers are excluded.
- Existing first-party search-event storage and `/go/[offerId]` retailer redirect/click recording remain authoritative and unchanged. GA failures are best-effort and cannot block retailer navigation.
- Public privacy and cookie pages document purpose, measured data categories and withdrawal. GA property retention, key-event configuration, internal-traffic filtering, unwanted referrals, Search Console linkage and Realtime verification remain Google-account administration tasks.

### 0.1 Executive decision

The repository has delivered a real public comparison product and a substantial data/control foundation. The current constraint is not the absence of another update framework. It is obtaining commercially useful overlapping retailer sources, configuring the mappings already approved, enabling the existing sync path in production, and removing unnecessary approval friction.

**Fast Lane verdict: FAST LANE WOULD DUPLICATE EXISTING WORK.**

The existing mixed-batch retailer offer-sync path already reads a retailer snapshot, normalises and matches existing identities, classifies all supported changes, blocks drift and source anomalies, produces sealed dry-run and execution artefacts, locks and applies atomically, updates `last_checked`, writes price history only for delivered-price changes, prohibits new catalogue rows, prevents replay and emits a recovery manifest. It has been deployed to staging and used successfully for a 26-offer Jon's Supplements no-change run. Production enablement is prepared but not deployed. The next move is therefore to simplify and operate this path, not build a competing path.

Audit scope and evidence:

- audited Git history from 28 June to 19 July 2026: 224 commits, 288 touched files, 83,047 insertions and 5,256 deletions;
- commit-subject triage grouped 83 commits around retailer/data work, 49 around public/growth work, 18 around duplicate/merge work, 6 around infrastructure, 6 around maintenance and 62 mixed/other; these are audit heuristics, not delivery-time estimates;
- inspected the public application, catalogue model, adapters/importers, migrations, tests, deployment configuration, approval ledgers and recovery tooling;
- queried production and staging read-only, with transaction-level read-only protection for direct database checks;
- checked the live public site, `robots.txt`, sitemap, search, product, creatine and outbound-click routes;
- made no production or staging writes during this audit.

### 0.2 Exact environment inventory

Counts are point-in-time audit counts from 19 July 2026. "Local" is code and artefact state, not a third business database, so business-row counts are intentionally not invented.

| Measure | Production | Staging | Local/repository |
|---|---:|---:|---|
| Products | 760 | 760 | no authoritative local business database |
| Active canonical products | 759 | 759 | n/a |
| Product variants | 1,098 | 1,098 | n/a |
| Retailers | 8 | 8 | adapter/config support described below |
| Retailer-product mappings | 1,008 | 1,008 | n/a |
| Offers | 1,007 | 1,007 | n/a |
| Price-history rows | 1,016 | 1,016 | n/a |
| Public in-stock delivered offers | 849 | same cloned business state | n/a |
| Products with no live offer | 154 | 154 | n/a |
| Products with exactly one retailer | 542 | 542 | n/a |
| Products with exactly two retailers | 60 | 60 | n/a |
| Products with three or more retailers | 3 | 3 | n/a |
| Approved import plans | 392 | 425 | artefacts and test fixtures only |
| Applied schema migrations | 25 | 31 | 33 migrations added during audit window; latest production package remains repository-only |
| Outbound clicks | 1,448, including 29 in the last 7 days | not treated as public usage | route/tests present |
| Search events | 691 | not treated as public usage | report/tests present |

Production retailer state:

| Retailer | Mappings | All offers | Public in-stock offers | Covered products | Out of stock | Latest checked |
|---|---:|---:|---:|---:|---:|---|
| GYM HIGH | 25 | 24 | 23 | 23 | 1 | 2026-06-30 20:10 UTC |
| Whey Okay | 520 | 520 | 365 | 365 | 155 | 2026-06-29 15:53 UTC |
| Discount Supplements | 146 | 146 | 145 | 34 | 1 | 2026-07-15 12:00 UTC |
| Dolphin Fitness | 2 | 2 | 2 | 2 | 0 | 2026-06-28 14:32 UTC |
| Simply Supplements | 120 | 120 | 120 | 120 | 0 | 2026-07-08 06:18 UTC |
| KIOR | 11 | 11 | 10 | 10 | 1 | 2026-07-11 07:27 UTC |
| Fit House | 158 | 158 | 158 | 112 | 0 | 2026-07-15 18:45 UTC |
| Jon's Supplements | 26 | 26 | 26 | 5 | 0 | 2026-07-17 07:24 UTC |

Additional factual state:

- production contains one completed product merge, one merge-history record and 32 ignored duplicate pairs;
- no retailer has an `affiliate_id` or `affiliate_network` configured, so clicks are tracked but affiliate monetisation is not yet evidenced;
- production has the base import approval ledger but not the mixed-sync control objects, restricted roles or `20260719100000` production enablement migration; `SAFE_UPDATE` is not enabled;
- staging has the generic mixed-sync stack and recorded the successful 26-offer Jon's run: 26 `last_checked` changes, zero price, shipping, stock, URL, mapping, identity or price-history deltas, replay blocked, recovery manifest ready and unused;
- no separate public staging web deployment was evidenced. "Staging" in this audit means the staging database and controlled execution workflow;
- local-only work includes the original Phase 1 snapshot classifier, the disposable-local Phase 3 executor and its recovery proofs. Phase 2's control concepts were subsequently deployed to staging. The selective `20260719100000` production enablement package is also repository-only. These local capabilities are evidence and reusable tooling, not deployed product behaviour;
- the Jon's source snapshot contains 224 products and roughly 843 variants. Phase-one classification found 70 safe-new candidates, 90 ambiguous, 21 duplicate-identity, 31 policy-deferred and 335 multi-variant-deferred rows. Those safe-new rows grow the catalogue but do not automatically improve multi-retailer coverage;
- Whey Okay has 137 reconciled mappings and 383 legacy mappings remaining. The full export evidence contains 538 products and 1,706 sellable variants, but there is no committed authorised EKM adapter/feed and direct HTML acquisition was blocked;
- the current Fit House adapter covers 85 configured entries and its latest audit proposed one mapping/offer create and 72 unchanged rows, with no new product creates;
- KIOR has 11 approved configured products from a much larger export. Expansion is a review/config task, not a new importer;
- Discount Supplements has a daily read-only Stage 1 workflow. It classifies and produces artefacts but performs no scheduled production write.

### 0.3 Completed subsystem inventory

| Subsystem | What exists and completion | Deployment and actual use | Direct growth/value assessment |
|---|---|---|---|
| Public product | Search, suggestions, filters, sorting, canonical product pages, retailer grouping, delivered-price display, price history, conditional verified unit metrics, category landing pages and click redirects. Core comparison journey is substantially complete; AI decision assistant is deferred. | Live in production. Search has 691 recorded events and outbound redirects 1,448 clicks. | Directly valuable now. Improve data freshness and traffic before adding a new product framework. |
| Catalogue/data model | Canonical products, variants, retailer mappings, offers, history, merge state and import approvals. | Deployed in production and staging; 760 products, 1,098 variants and 1,007 offers. | Necessary foundation and already supporting the public product. |
| Retailer imports | Generic CSV/feed importer plus Shopify adapters for Discount Supplements, Fit House, KIOR and Jon's; committed feed evidence for Simply Supplements. Whey Okay still lacks an authorised repeatable source. | Used to populate all eight production retailers. Discount Stage 1 is scheduled read-only. | Valuable, but the active constraint is source/config coverage rather than importer code. |
| Mapping and variants | External IDs, GTIN/SKU/slug evidence, canonical variant matching, variant-aware mappings and mapping-only plans. | Deployed and used across 1,008 mappings. | Necessary foundation. Reuse it; do not create a second matching model. |
| Duplicate/merge | Authenticated duplicate review, merge preview/decision, ignore/restore, merge history and supporting RPCs. | Live; one merge and 32 ignored pairs prove use. | Useful maintenance capability. Freeze feature expansion unless duplicate rate becomes a measured blocker. |
| Offer refresh | Standard atomic importer; narrow verified no-change refresh; generic mixed price/stock/URL refresh with source, identity, mass-change and target guards. | Standard importer is production-used. Narrow and mixed refresh are staging-deployed; mixed path passed the Jon's staging run. Mixed production package is prepared, not applied. | High value once operated. The narrow and mixed paths overlap; standardise operationally on mixed sync for approved existing mappings. |
| Price history | History is written on price/shipping/delivered-total changes and suppressed for unchanged timestamps. | 1,016 rows in both environments; public chart is live. | Direct user value and trust signal. Keep. |
| Unit pricing | Verified per-serving, per-unit, per-kg, per-litre, protein and creatine comparison metrics. | Live conditionally where verified inputs exist. | Valuable differentiator; expand verified inputs through normal data work, not a separate feature project. |
| Staging/deploy | Staging database branch, migration ledgers, target attestation, sealed artefacts, controlled executor and verification. | Used for the Jon's 26-offer run. No separate public staging UI was evidenced. | Sufficient for the next operating phase. No new environment framework is required. |
| Approval/control plane | Row-plan approvals in production plus staging parent/child batches, validators, roles, expiry, target/source/code/state fingerprints and replay protection. | Base ledger is heavily populated; advanced stack has one proved staging use and is not in production. | Safety foundation, but over-engineered relative to current throughput. Retain and freeze; require one business approval per environment stage. |
| Recovery | Pre-write manifests, exact expected deltas, transaction rollback, replay guards and disposable/local recovery tests. | Manifest generated in staging; recovery was ready but not needed. | Keep as insurance. Do not extend without a real failure mode. |
| SEO | Robots/sitemap, canonical metadata, five indexed category pages and prelaunch creatine decision page. | Live sitemap has 768 URLs: 9 static and 759 products. `/creatine` is canonical and structured but intentionally `noindex` and omitted from the sitemap. | High growth potential. Fresh overlapping offers and indexing are the remaining work, not a new SEO framework. |
| Analytics/affiliate | Search-event reports, server-side outbound click recording, bot filtering and redirect route. | Live and used. No affiliate retailer identifiers/networks are configured. | Analytics is valuable now; affiliate revenue readiness is incomplete for commercial/process reasons. |

### 0.4 Existing read, classify and update mechanisms

The standard importer in `scripts/import-products.js` normalises CSV/feed rows, matches retailer products and variants using external IDs and reviewed identity evidence, and classifies creates, updates and unchanged rows. Its atomic plan updates price, shipping, delivered total, stock, URL and `last_checked`; it writes history only when delivered-price inputs change. Production writes cannot be driven directly from CSV: an immutable dry run must enter the approval ledger and the database apply function validates it.

The narrow `scripts/verified-no-change-offer-refresh.js` path proves exact existing mappings and unchanged price, stock and URL, binds source age/hash and target, changes only `last_checked`, creates no history and rejects drift. It is deployed to staging, not production.

The generic `scripts/retailer-offer-sync.js` path and `scripts/lib/retailer-offer-sync/` classifier support `VERIFY_NO_CHANGE`, `UPDATE_PRICE`, `UPDATE_STOCK`, `UPDATE_PRICE_AND_STOCK`, `UPDATE_URL` and `UPDATE_PRICE_STOCK_URL`. They block stale/collapsed/incomplete source snapshots, ambiguous external IDs, product/SKU/domain drift, unsupported shipping-only drift, hard price anomalies, mass out-of-stock, mass-change and mass-price events. The action contract requires zero product, variant, mapping and offer row-count deltas; only existing rows are updated. The executor locks the complete batch before writes, applies all rows in one transaction, verifies exact deltas, records one batch approval, prevents replay and preserves a recovery manifest.

The reuse decision is anchored in exact implementation points: `buildOfferPlan` and `buildAtomicImportPlan` in `scripts/import-products.js`; `buildDryRun` in `scripts/retailer-offer-sync.js`; `classifyExistingOffers` in `scripts/lib/retailer-offer-sync/classifier.js`; and the staging RPCs `validate_retailer_offer_sync_batch_read_only`, `approve_retailer_offer_sync_batch`, `execute_retailer_offer_sync_batch` and `recover_retailer_offer_sync_batch`. `scripts/retailer-offer-sync.test.js`, `scripts/retailer-offer-sync-matrix.test.js`, `scripts/retailer-offer-sync.integration.test.js`, `scripts/retailer-offer-mixed-batch-migration.integration.test.js`, `scripts/retailer-offer-sync-recovery.integration.test.js` and the verified-no-change tests exercise the relevant contracts.

The Discount Supplements Stage 1 workflow is intentionally read-only: it acquires and classifies source data and emits a dry-run artefact. It is not an automatic production updater.

Supported tests cover action classification, source and identity drift, guardrails, sealed artefacts, all six executable actions, lock-before-write, exact delta caps, negative ledger cases, replay prevention, no-change refresh and recovery. This is enough evidence to operate the current path manually; further framework work is frozen.

### 0.5 Three-week value assessment

The last three weeks produced about 88,303 changed lines. That is evidence of a large delivery burst, not a productivity KPI. The following percentages are rough audit estimates by capability surface, not measured developer time:

- **Directly valuable now - roughly 45%:** public comparison/search UX, SEO pages, retailer/catalogue additions, verified metrics, price history and live analytics.
- **Necessary foundation - roughly 35-40%:** variants and mappings, atomic import planning, approval ledger, duplicate/merge safety and staging verification.
- **Useful but premature or over-engineered - roughly 15-20%:** advanced parent/child control lifecycle, dedicated roles, multiple fingerprints/attestations, validator, expiry and recovery orchestration beyond the first proved staging use. Retain it, but freeze expansion.
- **Duplicated or overlapping - roughly 5-10%:** narrow no-change refresh versus the generic mixed path, plus numerous one-off batch scripts and artefacts that should no longer be treated as architecture. Do not delete them during the growth sprint; archive/consolidate later.
- **Incomplete but valuable:** production enablement of approved-mapping sync, fresh prices at scale, affiliate deep links, creatine indexing, real retailer source-registry entries and commercially prioritised Whey Okay reconciliation.
- **No longer needed:** a new Fast Lane framework, another scheduler/control plane, or another matching/import architecture.

### 0.6 Ranked bottlenecks

| Rank | Bottleneck | Type | Why it blocks growth | Immediate response |
|---:|---|---|---|---|
| 1 | No secured broad, overlapping, affiliate-capable retailer source | Source/commercial/process | New catalogue-only rows do not improve comparison depth or revenue. | Secure one authorised feed/API/export and prioritise products already in the catalogue. |
| 2 | Existing mapped offers are not being refreshed through the proved path in production | Deployment/process | Prices age while usable code remains staging-only. | Close the Jon's production decision, then reuse mixed sync retailer by retailer. |
| 3 | Too many technical approval stages and control-plane concepts | Unnecessary governance/process | Human attention is spent proving the machinery rather than approving a business batch. | One explicit approval for the whole staging stage and one for the whole production stage; keep internal checks automatic. |
| 4 | Whey Okay and large-catalogue identity debt | Data/source | 383 legacy mappings remain and no repeatable authorised source exists. | Reconcile only commercially overlapping priority rows after the source contract is solved. |
| 5 | Creatine freshness evidence is incomplete | Source/data | The page is built but launch logic remains prelaunch: 30 of 61 offers had fresh source evidence and 31 lacked an approved fresh source at the last review. | Refresh approved Discount/Fit/Jon's rows, make a factual launch decision, then change the two central launch flags. |
| 6 | No affiliate IDs/networks or proved deep links | Commercial/process | Redirect analytics do not prove commissionable traffic. | Complete retailer programmes and update links through the existing import path. |
| 7 | Retailer registry is a template rather than an operational portfolio | Process | Source ownership, overlap and next action are not visible in one place. | Populate it with all eight retailers, source status, overlap, owner and commercial status. |

The answer to each common execution question follows directly: adding a retailer is blocked first by an authorised source and overlap selection; adding 25-50 useful offers is blocked by a broad overlapping source, not importer code; approved mappings can already be automated after production enablement; the next SEO page can reuse current templates and is mainly a content/data task; affiliate clicks require programme/deep-link configuration and traffic, not another redirect service.

### 0.7 Public-product readiness

The live site is a credible search and price-comparison product today. It has indexable canonical product/category pages, search suggestions and filters, retailer/variant offer groups, delivered prices, price history, conditional verified unit economics, sitemap/robots coverage and measured outbound use. Product pages do not yet emit Product JSON-LD, and AI decision assistance remains deferred; neither is the current growth blocker.

The creatine page is implemented as a deterministic decision page with canonical metadata and structured data, but it is deliberately `noindex, follow` and absent from the sitemap. Its launch contract requires at least 10 products, 8 offers, 2 retailers, 3 multi-retailer products and acceptable freshness. Historical build evidence exceeded the coverage thresholds at 41 products, 61 offers and 6 retailers, but freshness/source evidence was incomplete. Launch only after re-running that evidence; do not weaken the threshold merely to index it.

### 0.8 Plan A - next 48 hours

| Task and visible result | Estimate | Dependency | Reuse versus new code |
|---|---:|---|---|
| Revalidate and, with one explicit production-stage approval, execute the existing Jon's 26-offer production package. Result: 26 current timestamps with exact verified deltas. | 2-3 operator hours | Package/source/production state still match; explicit production approval | Reuse existing code entirely; regenerate artefacts if expired. |
| Run the mixed/no-change path against every currently approved fresh Discount, Fit House and Jon's creatine mapping. Result: an updated freshness report and the maximum defensible share of the 61 offers refreshed. | 4-8 hours | Approved source snapshots and one approval per environment stage | Existing path plus reviewed config/data; no new framework. |
| Re-run the creatine launch contract and, only if it passes, switch the central indexing and sitemap flags and deploy. Result: `/creatine` becomes an indexable sitemap URL. | 1-2 hours | Freshness contract passes | Two small existing launch-state edits are the only expected product code. |
| Populate the source registry for all eight retailers and choose the next source by overlap and affiliate readiness. Result: one owned, dated acquisition decision. | 2 hours | Commercial/source information | Documentation/process only. |
| If an authorised overlapping source is already available, process 25-50 high-confidence existing-product offers. Otherwise process the next 25-50 Jon's safe catalogue candidates but record that this grows breadth, not 2+ coverage. | 6-12 hours | Source availability and business approval | Existing adapters/importer; reviewed config/data only. |
| Validate the first approved affiliate deep links through the live redirect path. Result: commission-capable tracked links for at least one retailer. | 2-4 hours | Affiliate credentials/programme approval | Existing redirect/analytics; data/config change only. |

No 48-hour task may create a new sync framework, migration family, approval layer or scheduler.

### 0.9 Plan B - next 7 days

| Task and visible result | Estimate | Dependency | Reuse versus new code |
|---|---:|---|---|
| Import 25-50 high-confidence second-retailer offers. Result: a visible increase from 63 products at 2+ retailers. | 8-16 hours | One authorised broad-overlap source and reviewed matches | Reuse importer/matching/approval code; adapter configuration first, small source adapter only if the platform is unsupported. |
| Refresh every configured Discount Supplements, Fit House and Jon's mapping. Result: current timestamps and an exact changed/unchanged report. | 8-12 hours | Two clean manual stages and fresh approved snapshots | Reuse mixed sync entirely; configuration only. |
| Launch `/creatine`, or publish the precise missing-source list with owners if blocked. Result: an indexable sitemap page or a finite acquisition queue. | 2-4 hours | Existing launch contract and freshness evidence | Reuse page/audit; at most the existing central launch-state edit. |
| Put at least one retailer on verified affiliate deep links. Result: commission-capable tracked outbound clicks in the weekly report. | 4-8 hours | Affiliate programme approval and IDs | Reuse redirect/analytics and importer; no new service. |
| Expand KIOR or Jon's through reviewed configuration. Result: 25-50 additional catalogue offers, reported separately from overlap growth. | 8-12 hours | Fresh source and identity review | Reuse adapters/importer; configuration/data only. |
| Draft and ship one next high-intent landing page. Result: one canonical, measured search entry point. | 6-10 hours | Query/content choice and adequate offer coverage | Reuse creatine/category patterns; one page/config entry plus content is the only expected new code. |

Expected focused effort is roughly 36-62 hours plus external source/affiliate lead time.

### 0.10 Plan C - next 30 days

| Task and visible result | Estimate | Dependency | Reuse versus new code |
|---|---:|---|---|
| Onboard three commercially useful retailers. Result: at least 100 additional products with a second retailer and 25 with a third. | 40-70 hours | Authorised sources, commercial priority and match review | Reuse the source/adaptor/import playbook; only genuinely unsupported source formats justify a small adapter. |
| Enable approved-existing-mapping refresh retailer by retailer. Result: a repeatable freshness cadence with exact reports. | 12-20 hours | Two clean manual runs for each retailer and separate production approval | Reuse mixed sync. A simple schedule is considered only if manual operation becomes the measured blocker. |
| Reconcile the highest-overlap 50-100 Whey Okay legacy rows. Result: a measured coverage gain, not merely a smaller backlog. | 20-35 hours | Authorised repeatable Whey source | Reuse identity/mapping tools; no bulk-reconciliation framework. |
| Publish three to four additional decision/category pages. Result: new indexed entry points measured by impressions, search events and outbound clicks. | 24-40 hours | Query demand, adequate offer coverage and reviewed content | Reuse established templates; page/content code only. |
| Complete priority-retailer affiliate coverage and weekly commercial reporting. Result: tracked affiliate-capable clicks and revenue/commission outcomes. | 12-24 hours | External programme approvals and reporting access | Reuse redirects/admin analytics; small reporting fields only if an outcome cannot be recorded today. |
| Review decision-query evidence and keep AI deferred unless a unique gap is proved. Result: a written go/no-go backed by traffic and query data. | 3-5 hours | Four weeks of usable analytics | Analysis only; no AI implementation by default. |

### 0.11 Binding freeze and operating rules

Freeze immediately:

- all new import, matching, sync, scheduler, migration-orchestration, control-plane and recovery frameworks;
- approval/control-plane feature expansion, dedicated-role expansion and new fingerprints/attestations unless a real failed batch proves a gap;
- duplicate/merge feature expansion;
- indiscriminate Whey Okay reconciliation and catalogue growth that does not serve coverage, freshness, SEO or affiliate value;
- AI assistant implementation.

Minimal infrastructure work remains justified only to apply the already-reviewed production enablement package, correct a defect exposed by a real batch, add a genuinely required source configuration/adapter, or switch the existing central page-launch state. Each exception must be smaller than the business batch it unblocks and must reuse the existing contracts.

Operating rules:

1. One retailer/data implementation is primary at a time. SEO/content may run alongside it only when it does not change the data architecture.
2. Use one explicit business approval for the complete staging stage and one for the complete production stage. Internal validations remain automatic checks, not separate human approval projects.
3. No new products or variants are permitted in an approved-existing-mapping refresh. The enforced row-count deltas remain zero for products, variants, mappings and offers.
4. History is created only for a real delivered-price input change. `last_checked` advances for every successfully verified row.
5. Every batch remains source-, code-, config-, target- and state-bound; drift or anomaly blocks the entire atomic batch.
6. Prefer configuration and reviewed data over code. Add code only when a real source batch cannot be represented by an existing path.
7. Check before build: search the repository, migration ledger, deployed environment and relevant tests before proposing any new path; record why reuse or a small extension is insufficient.
8. Measure weekly: fresh public offers, products at 2+ and 3+ retailers, indexable decision pages, search events, outbound clicks, affiliate-capable clicks and revenue.
9. This section must be updated after each weekly checkpoint with evidence, not aspiration.

### 0.12 Audit read/write proof

Production and staging access during the audit was read-only. The production market-coverage audit and the guarded production supplemental query read counts and usage state only. Direct staging and production supplemental sessions explicitly reported transaction read-only mode; the staging audit reported zero writes. Live-site checks were HTTP GET requests. Local generated audit artefacts are ignored files and are not part of this plan change. No migration was applied, no approval was created, no offer/product row was changed and no production or staging deployment occurred.

## 1. Product identity

**Name:** SupplementScout  
**Positioning:** The UK's Smart Supplement Search Engine  
**Mission:** Help people find the best supplements at the best prices.

SupplementScout is not merely a product catalogue or another supplement shop. It is intended to become a structured search, comparison, data and recommendation platform for the UK supplement market.

A successful user journey should answer three questions quickly:

1. What should I buy?
2. Where should I buy it?
3. Why is this the best option for me?

The user should leave thinking:

> This site helped me make a decision.

---

## 2. Long-term product vision

A user should be able to search by:

- exact product,
- brand,
- category,
- ingredient,
- format,
- budget,
- training goal,
- health goal,
- desired outcome.

Examples:

- cheapest whey protein 2 kg,
- best creatine under £20,
- magnesium for cramps,
- supplement for sleep,
- pre-workout without caffeine,
- compare two specific products.

The platform should eventually provide:

- one clean canonical product,
- exact flavour, size and format variants,
- offers from multiple UK retailers,
- product price,
- shipping cost,
- total delivered price,
- stock status,
- price per kilogram,
- price per serving,
- price per gram of protein,
- cost per 25 g protein,
- cost per 5 g creatine,
- historical prices,
- lowest recorded price,
- ingredient and dosage comparison,
- product pros and cons,
- similar products,
- better-value alternatives,
- AI-assisted recommendations,
- a simple “Help me choose” flow based on two or three questions.

### Agreed public UX direction

SupplementScout should use a search-first homepage. The first screen should contain one main search field and no more than two primary actions:

1. Search
2. Help Me Choose

Users should be able to describe their goals in natural language. Help Me Choose should ask no more than two or three questions, then return a ranked recommendation with:

- reasons for the recommendation,
- total delivered price,
- key value metrics,
- alternative options.

Advanced filters should remain available below the main experience, but must not dominate the first screen.

---

## 3. Business model

Planned revenue streams:

- affiliate links,
- clearly labelled sponsored placements,
- paid retailer accounts,
- API access for other websites,
- price and market reports for brands and manufacturers,
- future mobile application.

The first commercial engine is affiliate traffic. The first data advantage is a clean, variant-aware, multi-retailer catalogue with reliable delivered prices.

---

## 4. Core strategic principle

Do not optimise for the number of products alone.

A more valuable catalogue has:

- accurate identity,
- current prices,
- current stock,
- exact variants,
- multiple retailers,
- useful images,
- measurable user interest.

Prefer:

> 100 products with three active retailers

rather than:

> 300 products with one retailer and weak identity.

The milestone of 200 new variants/offers is a technical and operational confidence milestone, not the final business objective.

---

## 5. System architecture

### 5.1 Retailer source layer

Retailer feeds, APIs, exports and storefront sources provide external data such as:

- source product name,
- source variant name,
- external product ID,
- external variant ID,
- SKU,
- GTIN,
- options,
- stock,
- price,
- shipping,
- image,
- product URL.

Current important sources:

- Discount Supplements,
- Fit House,
- Whey Okay.

Future sources may include additional UK retailers. eBay is explicitly postponed.

External data is untrusted until it passes identity and integrity checks.

### 5.2 Canonical catalogue layer

The canonical catalogue is the platform’s own clean product model.

Main tables:

- `products`
- `product_variants`

A canonical product represents one exact product family and pack identity. A canonical variant represents the exact flavour, size, count or format beneath that product.

Examples:

- product: Optimum Nutrition Serious Mass 5.4 kg
- variants: Banana / 5.4 kg, Chocolate / 5.4 kg, Vanilla / 5.4 kg

Canonical identity must not be changed automatically by routine price updates.

### 5.3 Retailer mapping layer

Main table:

- `retailer_products`

This layer states:

> This exact retailer variant corresponds to this exact canonical variant.

Important identity fields include:

- retailer ID,
- product ID,
- product variant ID,
- external product ID,
- external variant ID,
- SKU,
- external options,
- source URL.

### 5.4 Offer and history layer

Main tables:

- `offers`
- `price_history`

These store volatile commercial data:

- price,
- shipping,
- delivered total,
- stock,
- offer URL,
- price history.

Offer data may change frequently. Canonical identity should not.

### 5.5 Import safety layer

The approved pipeline is:

```text
snapshot
→ integrity validation
→ classification
→ dry-run
→ immutable artifact + SHA
→ read-only validation
→ approval ledger
→ staging apply
→ staging verification
→ production freshness check
→ production approval
→ production apply
→ production verification
→ public UI smoke test
```

Core principles:

- fail closed,
- no guessing,
- one exact artifact per approval,
- separate staging and production approvals,
- consumed approvals cannot be replayed,
- no direct mapping or offer inserts outside the approved pipeline,
- new products and variants remain review-only,
- routine automation may update only safe volatile fields.

### 5.6 Public application layer

The production site currently supports:

- canonical product pages,
- slug and ID routing,
- one retailer card per retailer,
- multiple variant chips within one retailer card,
- correct offer selection after changing variant,
- Best UK Price,
- delivered price,
- retailer and offer counts,
- mobile layout,
- outbound click tracking through `/go/<offer-id>`.

---

## 6. Technology stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase
- PostgreSQL
- Vercel
- GitHub
- Docker for PostgreSQL integration tests
- OpenAI API planned for future AI functionality

### Production

- Domain: `supplementscout.co.uk`
- Branch: `main`
- Supabase production ref: `aftboxmrdgyhizicfsfu`

### Staging

- Supabase persistent database branch ref: `hxnrsyyqffztlvcrtgbf`
- Name: SupplementScout Staging
- Region: `eu-west-3`

Old staging refs must not be reused:

- `dlsbwshkzdsvzubjftbv` was removed
- `tyyxhnoyelvarwdymvss` was outdated and incompatible

---

## 7. Current production state

Latest confirmed production counts after the Jon's Supplements rollout:

- `products`: 760
- `product_variants`: 1098
- `retailer_products`: 1008
- `offers`: 1007
- `price_history`: 1016

Latest product-level commercial coverage snapshot, counting distinct retailers with an in-stock offer for each active, unmerged canonical product:

- active canonical products: 759,
- products with at least one active retailer: 605,
- products with at least two active retailers: 63,
- products with at least three active retailers: 3,
- products with at least four active retailers: 0.

Current catalogue expansion milestone:

- progress: **200 / 200**
- remaining: **0**

Production `SAFE_UPDATE` automation remains disabled.

---

## 8. What has been completed

### 8.1 Infrastructure and deployment

Completed:

- production Next.js deployment,
- Supabase production database,
- active staging clone/branch,
- GitHub repository and `main` workflow,
- Vercel deployment,
- versioned migrations,
- baseline verification,
- Docker/PostgreSQL migration tests.

### 8.2 Canonical data model

Completed:

- products,
- product variants,
- retailers,
- retailer mappings,
- offers,
- price history,
- duplicate/merge foundations,
- default and non-default variant model,
- variant-aware identity handling.

### 8.3 Safe import pipeline

Completed:

- atomic import RPC,
- approval ledger,
- immutable artifacts and sidecar SHA,
- source and plan fingerprints,
- staging and production approvals,
- consumed approval replay protection,
- standard import operation type,
- legacy mapping upgrade RPC,
- read-only validators,
- format, flavour, size, servings and count evidence handling,
- parser and approval normalization for:
  - `ready_to_drink` / `liquid`,
  - `snack`,
  - servings and count evidence.

### 8.4 Retailer UI

Completed:

- one card per retailer,
- multiple variants inside a retailer card,
- correct CTA per selected offer,
- Best UK Price using real offers,
- correct retailer and offer counts,
- mobile-safe variant chips,
- single-variant products without unnecessary controls.

### 8.5 Discount Supplements

Completed:

- full Shopify snapshot,
- pagination and integrity validation,
- Stage 1 scheduled dry-run,
- classification of existing, new and conflicting records,
- Batch A–E imports,
- exact external variant IDs,
- price, shipping, stock, URL and source option preservation.

Stage 1 currently performs:

- snapshot,
- classification,
- read-only production lookup,
- importer dry-run,
- reporting.

It does not perform production writes.

### 8.6 Fit House

Completed:

- working Shopify adapter/source,
- CSV and live Shopify comparison,
- Batch F canonical catalogue work,
- Batch F image work, including 12 verified canonical image backfills,
- Batch F 36 production mappings/offers/history,
- RTD, snack and servings evidence support,
- public UI verification for Batch F.

Fit House is not yet in a scheduled update workflow.

### 8.7 Whey Okay

Current authority is section 0.0.2. The reconciliation history below is retained as historical evidence and must not be read as disabling the approved 586-row exact-manifest automation.

Completed:

- authoritative full CSV analysis,
- catalogue structure audit,
- stable EKM key discovery,
- identification of legacy mapping problem,
- standalone legacy mapping upgrade tooling,
- optioned legacy mapping upgrade tooling for Flavour-only plus parent-size evidence,
- historical `total_price = null` support for optioned identity-only offer updates,
- 10-row standalone legacy mapping pilot using one-row approvals.

Authoritative export findings:

- 538 products,
- 1,706 sellable variants,
- 1,009 in stock,
- 697 out of stock,
- all 1,706 variants have images.

Current problem:

- 383 legacy mappings still require reconciliation,
- many legacy mappings still have no external product IDs,
- many legacy mappings still have no external variant IDs,
- many legacy mappings still have no external options,
- many legacy mappings point to default variants.

The first controlled Whey Okay reconciliation pilot, Batch 2.1, Batch 3, reduced Batch 4, the reduced optioned pilot, the final Easy optioned cleanup and reduced Medium Batches 1-3 have completed for 137 total legacy mappings. The remaining 383 legacy mappings must be reconciled before automated updates or EKM-based automation.

---

## 9. Completed catalogue batches

### Batch A

- 25 canonical variants
- 25 Discount Supplements mappings/offers/history

### Batch B

- 25 canonical variants
- 25 Discount Supplements mappings/offers/history

### Batch C

- 31 canonical variants
- 31 Discount Supplements mappings/offers/history

### Batch D

- 6 new canonical products
- 40 source flavour variants
- 46 `product_variants` including six technical defaults
- 40 Discount Supplements mappings/offers/history

### Batch E

- 19 approved production mappings/offers/history
- 17 ambiguous records excluded fail-closed

### Batch F

- canonical catalogue and image preparation completed
- 12 canonical `products.image` backfills verified for products 742-750 and 753-755
- products 751 and 752 remain manual image review with `image = null`
- 36 Fit House mappings/offers/history applied successfully
- public UI smoke test passed
- final production counts confirmed

Milestone arithmetic:

- previous milestone progress: 115 / 200
- Batch F added: 36
- current progress: **151 / 200**

Technical default variants created for new products do not count toward the 200 source-variant milestone.

### Batch G

- canonical catalogue deployed:
  - 18 new canonical products
  - 67 `product_variants`
  - 18 technical default variants
  - 49 reviewed source variants
- reduced production offer apply completed:
  - 47 Fit House mappings
  - 47 Fit House offers
  - 47 price history rows
- replacement production apply completed:
  - 2 additional Fit House mappings
  - 2 additional Fit House offers
  - 2 additional price history rows
  - GYM HIGH Whey Pro Synergy 600g Banana and Strawberry variants
- 2 reviewed records remain `MANUAL_REVIEW` and were excluded from apply:
  - 7Nutrition Beta-Alanine 250g
  - Applied Nutrition L-Glutamine Powder 250g
- exclusion reason:
  - Shopify source variant was `Default Title`,
  - no explicit flavour evidence,
  - mapping to non-default canonical variant `Unflavoured / 250g` did not satisfy the fail-closed identity contract.
- public UI smoke test passed for Batch G product families and the final replacement product page.

Milestone arithmetic:

- previous milestone progress: 151 / 200
- Batch G applied source offers: 47
- Batch G replacement source offers: 2
- current progress: **200 / 200**

Technical default variants and unapplied manual-review variants do not count toward the 200 source-variant/offer milestone.

---

## 10. Current known issues and gaps

### 10.1 200 milestone complete

The 200 source-variant/offer milestone is complete. Do not enable `SAFE_UPDATE` automatically as a result; it still requires separate review and explicit approval.

Immediate post-milestone priority is the **Commercial Coverage Sprint**: add high-confidence offers from additional retailers to increase multi-retailer coverage, public usefulness and affiliate readiness. The remaining Whey Okay reconciliation and its existing review queues are preserved but paused until the sprint checkpoint.

### 10.2 Whey Okay reconciliation

This remains the largest open reconciliation project, but it is currently **PAUSED** during the Commercial Coverage Sprint. Existing classifications and review queues must be preserved unchanged. Resume after the sprint checkpoint, or earlier only if a documented commercial or data-safety reason justifies it.

Completed:

- standalone legacy mapping upgrade RPC/tooling,
- 10 standalone legacy mappings upgraded with stable EKM identity,
- Whey Okay reconciliation Batch 2.1 with 25 additional standalone mappings enriched,
- Whey Okay reconciliation Batch 3 with 25 additional standalone mappings enriched,
- Whey Okay reconciliation reduced Batch 4 with 10 additional standalone mappings enriched,
- product_format evidence fix for optioned Whey Okay artifacts,
- reduced optioned Whey Okay pilot with 8 additional mappings enriched,
- final Easy optioned cleanup with 1 additional mapping enriched,
- Whey Okay Medium Batch 1 canonical seed with 25 active non-default canonical variants,
- reduced Whey Okay Medium Batch 1 reconciliation with 24 additional mappings enriched,
- Whey Okay Medium Batch 2 canonical seed with 25 active non-default canonical variants,
- reduced Whey Okay Medium Batch 2 reconciliation with 24 additional mappings enriched,
- Whey Okay Medium Batch 3 canonical seed with 19 active non-default canonical variants,
- reduced Whey Okay Medium Batch 3 reconciliation with 10 additional mappings enriched,
- one-row approval/apply pattern verified on staging and production,
- approval replay protection verified.

Remaining:

- 383 legacy mappings still require reconciliation.
- The final Medium audit covers all 75 original mappings exactly once: 58 `RECONCILED`, 2 `PACK_COUNT_REVIEW`, 5 `FORMAT_REVIEW`, 1 `IDENTITY_CONFLICT`, 9 `MANUAL_REVIEW`, and 0 `DUPLICATE`/`EXCLUDE`.
- The 17 unresolved Medium mappings are fully classified:
  - `PACK_COUNT_REVIEW`: `retailer_product_id` 179 (Clif Bar Energy Bar 12x68g) and 172 (Optimum Nutrition Protein Crisp Bar 10x65g),
  - `FORMAT_REVIEW`: `retailer_product_id` 358 (Love Vegan Protein Bite), 367 (Grenade Carb Killa Protein Spread), 499 (Medi-Evil Creatine Monohydrate Shots Powder), 472 (High5 Energy Drink with Protein), and 323 (High5 Energy Gel),
  - `IDENTITY_CONFLICT`: `retailer_product_id` 483 (Applied Nutrition Creatine Gummies; unresolved count/servings identity),
  - `MANUAL_REVIEW` for incomplete external identity evidence: `retailer_product_id` 178, 183, 535, 455, 450, 484, 421, 230, and 129.
- Eleven Medium mappings have seeded canonical variants but remain unresolved: `retailer_product_id` 179, 358, 178, 183, 535, 455, 450, 484, 421, 230, and 129.
- Six mappings still require a specialised or reviewed canonical seed: `retailer_product_id` 172, 367, 499, 472, 323, and 483. Each is explicitly blocked in a named review queue; no ordinary seed candidate remains unclassified.

Batch 2.1 excluded these records because dry-run required complete external identity evidence:

- `retailer_product_id` 368, EKM 2184, Natures Aid Iron Bisglycinate 14mg 90 Tablets,
- `retailer_product_id` 102, EKM 518, Time 4 Creatine Blend 240 caps,
- `retailer_product_id` 406, EKM 3105, Solgar Omega 3-6-9 Fish, Flax, Borage 60 Softgels.

Batch 4 excluded these records because dry-run required complete external identity evidence:

- `retailer_product_id` 418, EKM 3083, Reflex Nutrition Creapure Creatine 90 Capsules,
- `retailer_product_id` 444, EKM 3428, KIOR Health KSM-66 Ashwagandha+ 60 Caps.

Further Batch 4 candidate records after the first 10 were not processed.

Reduced optioned pilot exclusions:

- `retailer_product_id` 191 remains in canonical variant review because the required target canonical variant is missing,
- `retailer_product_id` 150 remains in flavour manual review because source flavour `Orange Cooler` is not the same as canonical `Orange`.

Final Easy optioned cleanup:

- `retailer_product_id` 482, EKM 3908, Lenny & Larry Fitzels Pretzels 85g `Everything Bagel`, was applied on staging and production,
- `retailer_product_id` 409 remains in flavour manual review because source flavour `Apple` is not the same as canonical `Apple & Cherry`.

Known problem cases include:

- Gold Standard Whey legacy 2.26/2.27 kg versus current 2 kg,
- Critical Whey legacy 2.27 kg versus current 2 kg,
- duplicate NXT Cream of Rice listings,
- existing mappings without external variant identity.

### 10.3 Images

A prior audit found 14 active canonical products without images:

- 12 had exact packshots suitable for automated backfill,
- 2 Diet Whey products required manual image selection.

Batch F image backfill has been verified:

- products 742-750 and 753-755 have exact approved canonical image URLs,
- migration `20260715230000_seed_fit_house_batch_f_catalog_and_backfill_images.sql` performed the backfill,
- commit `49ca31c` introduced the migration,
- staging and production both contain the migration once in the ledger.

Open image work:

- product 751, Applied Nutrition Diet Whey Protein 1.8kg, remains `MANUAL_IMAGE_REVIEW`,
- product 752, Applied Nutrition Diet Whey Protein 1kg, remains `MANUAL_IMAGE_REVIEW`.

Root architectural issue:

- canonical UI reads `products.image`,
- retailer mappings do not provide a persistent image fallback,
- some new-product migrations historically omitted `products.image`.

### 10.4 Analytics

Currently tracked with confidence:

- outbound retailer clicks through `/go/<offer-id>`.

Not yet fully confirmed or implemented:

- visits,
- page views,
- traffic sources,
- search queries,
- zero-result searches,
- product views,
- variant selections,
- filter use,
- Search Console performance,
- Vercel Analytics status.

### 10.5 Automation

Discount Supplements Stage 1 is read-only and successful.

Not yet enabled:

- automatic production `SAFE_UPDATE`,
- Fit House scheduled Stage 1,
- Whey Okay automated source.

### 10.6 Temporary scripts and process repetition

Many batch generators and reports live in `tmp/`.

Repeated logic should gradually move into:

- stable adapters,
- shared helpers,
- tested orchestrators,
- custom Codex skills,
- a documented standard batch command.

### 10.7 Retailer Import Control Plane

The read-only architecture audit confirmed that the current importer, normalized feed contract, matching guards, dry-run artifacts, validator, row-level approval ledger and atomic apply RPC are the approved reusable core. The parent/child Retailer Import Control Plane is now implemented as the orchestration layer above that reusable core; it is not a second importer, validator, row-level approval ledger or business apply mechanism.

Status: **PHASES 1, 2 AND 3 COMPLETE; STAGING MIGRATIONS AND POST-MIGRATION READINESS COMPLETE; CANARY DRY-RUN DESIGN AND FRESH SOURCE REFRESH NEXT**.

Retailer Snapshot Bulk Import Phase 1 completed the read-only framework: 10 JSON contracts, 64 reason codes, 20 stable `RSBI_*` errors, `RSBI-CJ1` fingerprints, deterministic classification, parent/child plan builders, deterministic 50/100 partitioning, validators and review queue JSON/CSV. The full Jon's snapshot reproduced the frozen baseline without differences and made no Supabase writes. Commit: `53446ce6ed755f484e25551a757d4d0161e8a290`.

Phase 2 completed the control-ledger migration with three control tables, 11 public lifecycle RPCs and six internal functions. Parent/child lifecycle, locking, approval expiry, approval consumption, replay protection, resume and rollback metadata were first validated behind a local-only runtime guard. The implementation task made no business-table, staging or production writes. Commit: `94d1bf56991485a682a6eda4bce628229e614579`. The reviewed control-ledger schema was later deployed to staging by Task 6 Migration A.

### Retailer Snapshot Phase 3 — COMPLETE

Phase 3 completed the local bounded child-batch business executor. It reuses Phase 1 row plans, the Phase 2 parent/child lifecycle, the existing read-only validator, the existing row-level approval ledger and the existing atomic apply RPC. It performs no direct business-table DML. Child execution is transactional: a failed row plan or exact expected-delta mismatch rolls back the entire child, including generated and consumed row approvals. Replay protection and concurrency locking are tested.

Hard environment guards restrict execution to explicitly authorised disposable local PostgreSQL databases. The executor intentionally rejects staging, production, Supabase hosts and protected database identities; its local-only boundary must not be weakened. The 10-row local canary, 50-row child, mid-child rollback, delta-mismatch rollback, replay and concurrency tests passed. Full regression passed 600/600. Staging writes and production writes remained zero. Commit: `6a754f0e7c942dde550e029056e15f940aa56b3a`.

The separate stale product presentation test cleanup passed 64/64 presentation tests and is recorded in commit `2bc6a8c82c191b1bf935fdcf61fc5cd3296638b7`. It is not part of the Phase 3 implementation.

### Staging Migration Task 6 — COMPLETE

- Migration A was applied and validated on staging.
- Migration B was applied and validated on staging.
- Runner V2 used the whole-query path; the defective replacement-string path was not reused.
- Source, executed and migration-ledger text SHA-256 equality was confirmed for both migrations.
- Final staging migration count: 27.
- Final staging migration fingerprint: `2c36d09244f4c81f0727ad50dd62fad21c9c8037aee66342eed0662037d3081a`.
- Eight control/staging tables, the required functions and the staging roles were created.
- RLS, forced RLS, grants, indexes, constraints, owners, function security boundaries and `search_path` were validated.
- Business-table deltas were zero.
- No approval, parent plan, child plan, dry-run, apply run or recovery was created.
- Production connections, reads and writes were zero.

The first Task 6 attempt is historical only: it failed before `COMMIT`, rolled back safely and changed no persistent staging state. Its runner root cause was fixed, its package was superseded and a fresh immutable package authorised the successful retry.

### Post-Migration Readiness Review — COMPLETE

Result: **READY FOR CANARY DRY-RUN DESIGN**.

- Schema readiness: **PASS**.
- Migration readiness: **PASS**.
- Role/grants readiness: **PASS**.
- Empty control-plane readiness: **PASS**.
- Fixture identity readiness: **PASS WITH CONDITIONS**.
- Expected delta readiness: **PASS**.
- Stale approval readiness: **PASS WITH CONDITIONS**.
- Recovery readiness: **PASS**.

The 10-record fixture still matches staging: seven existing mapping/offer no-ops are unchanged and three proposed mappings remain absent. Expected deltas remain retailers 0, products +2, product variants +2, retailer products +3, offers +3 and price history +3. The conditions are a fresh live source refresh before dry-run artifacts, continued alternate-identity review for the Conteh record without GTIN and non-reuse of the eight expired approvals.

The next bounded task is **Canary Dry-Run Design and Fresh Source Refresh**. It may refresh and freeze source evidence and design dry-run artifacts, but it must stop without executing a dry-run, creating an approval or applying any plan.

---

## 11. Operating rules

These rules are mandatory unless explicitly changed by the owner.

### 11.1 Before any new task

Always check whether the feature, rule, migration or helper already exists.

Do not duplicate previous work.

### 11.2 Data safety

- Staging before production.
- Fail closed on mismatch.
- No `migration repair` unless separately reviewed and explicitly approved.
- No force push.
- No direct production writes outside approved mechanisms.
- No reuse of staging approval IDs in production.
- No reuse of consumed approvals.
- No automatic creation of canonical products by routine update automation.
- No weakening identity guards to make a batch pass.

### 11.3 Identity safety

Identity must consider:

- exact product family,
- brand,
- generation/version,
- formula,
- flavour,
- size,
- weight,
- servings,
- count,
- format,
- bundle status,
- sample status,
- multipack status,
- external product and variant IDs.

### 11.4 Automation boundaries

Future `SAFE_UPDATE` may update only approved existing mappings and volatile fields such as:

- price,
- shipping,
- total price,
- stock,
- URL,
- SKU,
- GTIN,
- external options,
- source timestamps,
- image only under a separately approved image contract.

It may not automatically change:

- canonical product,
- canonical variant,
- product ID,
- product variant ID,
- retailer identity,
- external variant identity,
- product family,
- formula,
- format.

### 11.5 Production approval wording

A production write must have an explicit scope. Approval for one batch or artifact does not authorise another.

---

## 12. Priority roadmap

The binding priority order is now section 0.8 through section 0.10. Work proceeds sequentially, with one primary retailer/data implementation at a time.

Current priority order:

1. Close the existing Jon's production-package decision; do not design another update path.
2. Refresh approved mapped offers through the existing mixed-sync path and make the evidence-based `/creatine` launch decision.
3. Secure and import one broad, overlapping, affiliate-capable retailer source, targeting products already represented by one retailer.
4. Configure affiliate deep links for the existing tracked redirect path.
5. Expand catalogue breadth through existing reviewed adapter configurations only where it serves search demand or commercial coverage.
6. Resume only the commercially prioritised Whey Okay legacy rows after an authorised repeatable source exists.
7. Keep automatic writes and a scheduler deferred until two clean manual runs per retailer and a separate measured-need decision.

## Commercial Data Expansion and Competitive Response

The **Commercial Coverage Sprint** remains the current priority. Use [Retailer Data Source Registry](Retailer-Data-Source-Registry.md) as the operational registry for retailer data-source decisions and [WheyWise Competitive Intelligence Analysis](Competitive-Intelligence/WheyWise-Analysis-2026-07.md) as supporting competitive intelligence; this Operating Plan remains the single source of truth for project direction.

The primary metric is the number of canonical products with offers from at least two active retailers. Expand coverage in this order: (1) existing CSV files and feeds, (2) affiliate feeds, (3) existing or shared platform adapters, and (4) a retailer-specific scraper only when none of the earlier options exists. Before building anything new, verify whether the required integration, adapter, parser, helper or rule already exists and reuse it where safe.

Every import must preserve the approved separation of canonical products, variants, retailer mappings and offers, including offer-specific price history. Do not pursue an artificial product count at the expense of identity, variant accuracy, offer quality or auditability. Do not start AI product or assistant implementation, new admin panels or large automation implementation during this sprint; bounded SEO and AI citation-readiness work remains required.

The first retailer selected from the existing CSV files was Jon's Supplements. Its pilot and initial production rollout are complete, the exact 26-existing-offer staging automation apply passed, and the production-specific enablement bundle plus immutable rollout package are now prepared in repo. The current production boundary is **READY FOR ONE EXPLICIT JON'S PRODUCTION ENABLEMENT AND ROLLOUT APPROVAL**. Production remains untouched until that approval is given; do not run any production migration, login provisioning, attestation, validator, approval, apply or recovery step automatically.

## Jon's Supplements current state

**Status:** PILOT AND INITIAL PRODUCTION ROLLOUT COMPLETE; 26-OFFER STAGING AUTOMATION PASS; READY FOR ONE EXPLICIT JON'S PRODUCTION ENABLEMENT AND ROLLOUT APPROVAL

- The Shopify CSV and public Shopify JSON were audited with an exact source join.
- The Jon's adapter is complete and pushed.
- Retailer ID 10 exists on staging and production as `Jon's Supplements` / `jon-s-supplements` / `https://jonssupplements.co.uk`.
- Shipping is GBP 3.99 below GBP 90 and free from GBP 90.
- Per4m Mult Vita+Min and TBJP Oh Mega Pharma Pro production rollouts are complete.
- Canonical family seeds are complete for PER4M EAA Xtra 420g, PER4M Pre-Workout Stim 570g and PER4M Creatine Sherbet 310g.
- The three seeded families have 24 Jon's flavour mappings, offers and price-history rows on staging and production: EAA 10, Pre-Workout 9 and Creatine Sherbet 5.
- The current production retailer total is 5 canonical products, 24 flavour variants, 26 mappings, 26 offers and 26 price-history rows. All 26 offers are in stock.
- The exact 26-existing-offer staging apply passed: 26 `last_checked_at` updates at source capture `2026-07-19T09:33:56.316Z`; price, shipping, stock, URL, mapping and price-history deltas were all zero; the approval was consumed and the recovery manifest is ready.
- The production readiness review found ledger 25 with fingerprint `ba5d4c8581b185d5412fa4f41a3cbeacf40547f507e124962f922d4aa71772b0`; the six repo-parity migrations after it remain staging-bound and must not be applied or marked on production.
- A single production-specific enablement migration is prepared: `20260719100000_add_production_retailer_sync_enablement`, SHA-256 `ef45a78b0285d73cbc72cedf127d34ef08a8ad2b9c40076fa84e2051d3b85bd1`. It binds to production ref `aftboxmrdgyhizicfsfu`, ledger 25, database identity `supplementscout-production:aftboxmrdgyhizicfsfu` and system identifier `7642734024280108049`; staging ref `hxnrsyyqffztlvcrtgbf` and ledger 31 are fail-closed before DDL.
- Expected post-enable production ledger is count 26 with fingerprint `a0015032fc8b3b4fbf829ea0d0f1eb1dfdcaf1893d68dc875f21558c6a587152`. The migration creates the production control/recovery/validator/expiry-close surface, dedicated restricted roles and grants, and does not insert attestation rows.
- Repository retailer slug drift is resolved to production slug `jon-s-supplements`; adapter/module file names may remain `jons-supplements`, but persisted retailer contracts use the canonical production slug.
- Immutable rollout package `3989396e-748b-4d23-84e1-ac0170548079` is sealed at `docs/rollouts/jons-production-retailer-sync-rollout-package.json`, fingerprint `d4637bf98249207af01001e3fd5b70c76b4f616010089c287354237905493e06`, sidecar SHA `ddbddaffe9eb9bdae47339aba016e6cf642ed2fb5a2782cc2857533aede22a61`, expiry `2026-07-20T09:58:27.691Z`.
- The five Jon's product families each moved from zero to one active retailer. The rollout did not yet increase the primary two-retailer coverage metric.
- Excluded or deferred: Strawberry Lime because of a shared SKU; five out-of-stock variants; Project AD unresolved; Protein Bars deferred; PER4M Whey deferred for later bulk processing.
- `SAFE_UPDATE` remains disabled.

## Retailer Snapshot Bulk Import Strategy

Do not continue importing large retailer catalogues one product at a time.

For large Shopify retailers:

1. Freeze one complete source snapshot.
2. Calculate immutable source hashes.
3. Classify every record as `safe existing match`, `safe new product`, `safe new variant`, `ambiguous`, `blocked` or `out of stock`.
4. Import only safe records.
5. Quarantine ambiguous and blocked records.
6. Use family- or catalogue-level canonical seeds where necessary.
7. Use large mapping, offer and price-history batches.
8. Validate on staging.
9. Roll out to production in controlled bulk operations.
10. Add scheduled Shopify synchronization after the initial bulk import and a separate automation review.

The Jon's pilot proved the adapter workflow, immutable artifacts, approval ledger, atomic apply, rollback, idempotency, retailer reuse, family-level canonical seeds and multi-row offer rollout. Further Jon's work must use this bulk snapshot strategy. This changes batch scope, not the safety contract: canonical products and variants remain reviewed, ambiguous data remains quarantined, and staging and production approvals remain separate.

Implementation status:

- **Phase 1 — COMPLETE:** read-only snapshot, classification, deterministic plans, validators and review artifacts; commit `53446ce6ed755f484e25551a757d4d0161e8a290`.
- **Phase 2 — COMPLETE:** parent/child control ledger, lifecycle RPCs, concurrency controls, resume and rollback metadata were validated locally in commit `94d1bf56991485a682a6eda4bce628229e614579`; the reviewed control schema is now deployed on staging through Migration A.
- **Phase 3 — COMPLETE:** local bounded child-batch executor reusing the existing row plans, Phase 2 lifecycle, read-only validator, row-level approval ledger and atomic apply RPC. It has no direct business-table DML; transactional rollback, exact deltas, replay, concurrency and local-only environment guards passed. Full regression: 600/600. Staging and production writes: zero. Commit `6a754f0e7c942dde550e029056e15f940aa56b3a`.
- **Staging executor framework — COMPLETE:** Migration B deployed the staging-only roles, target and migration-ledger guards, approval wrappers, bounded executor and recovery framework. Task 6 validated the schema without invoking an executor RPC.
- **Post-migration readiness review — COMPLETE:** schema, migration, role/grant, empty-state, expected-delta and recovery readiness passed; fixture and stale-approval readiness passed with the fresh-source and non-reuse conditions recorded below.
- **Exact 26-offer staging apply — COMPLETE:** one whole-stage approval covered the exact 26 existing offers; apply succeeded with 26 timestamp-only refreshes, zero commercial/identity/history deltas, consumed approval and ready recovery manifest.
- **Production enablement and rollout package - READY FOR ONE EXPLICIT APPROVAL:** the previous NOT READY findings are resolved in repo by the single production-specific enablement migration, canonical `jon-s-supplements` slug contract and sealed immutable 26-offer package. Production remains untouched until one explicit Jon's production enablement and rollout approval is given.
- **Presentation test cleanup — COMPLETE, separate from Phase 3:** stale product presentation expectation fixed; presentation tests 64/64. Commit `2bc6a8c82c191b1bf935fdcf61fc5cd3296638b7`.

Before any write-bearing Jon's rollout, GTIN enrichment and canonical-creation proposals require separate review. Staging and production remain separate approval boundaries. Within each boundary, use one approval for the whole reviewed stage rather than fragmented per-step approvals.

### Blockers before canary dry-run execution

The earlier staging migration and readiness blockers are resolved: a real 10-record fixture is sealed, the staging executor framework is deployed, Migration A and B are validated, the control plane is empty and bounded recovery objects are present. Those completed reviews do not authorise dry-run execution or approval creation.

Every condition below is mandatory before a separately authorised canary dry-run execution:

- acquire a fresh Shopify source,
- acquire fresh CSV/GTIN enrichment,
- freeze fresh source hashes,
- capture a fresh staging canonical snapshot,
- revalidate prices and stock,
- confirm all 10 records are still in stock,
- confirm no external identity collisions,
- confirm no canonical collisions,
- confirm the staging migration fingerprint remains `2c36d09244f4c81f0727ad50dd62fad21c9c8037aee66342eed0662037d3081a`,
- confirm the code commit is unchanged or explicitly rebind every generated artifact to the reviewed replacement commit,
- regenerate the fixture fingerprint if any source field changes,
- recalculate exact expected deltas,
- preserve the eight expired approvals as non-reusable,
- keep `SAFE_UPDATE=false` or unset.

The design task must freshly confirm GTIN evidence for nine records and the documented alternate identity for the Conteh record without GTIN. It must compare source drift and canonical drift, design immutable dry-run artifacts and stop. No dry-run execution, approval, parent/child plan creation or apply is permitted in that task.

Any later approval must remain fingerprint-bound, exact-target-specific, short-lived, single-use and replay-protected. Staging canary apply, production canary and production bulk rollout remain separate approval boundaries.

## SEO and AI Search Visibility

SEO and AI-search visibility are a permanent parallel growth workstream. Every working day should include:

1. one primary product, data, retailer or engineering task,
2. one completed SEO or AI-search visibility task.

The visibility goal covers Google Search, Google AI Overviews and AI Mode, Bing and Copilot, ChatGPT Search, Gemini and other AI answer engines.

Evaluate every major page or feature against three questions:

1. Does it help the user make a decision?
2. Can it rank in traditional search?
3. Can an AI system understand and cite it accurately?

This workstream improves the discoverability and citation quality of the existing product; it does not authorise building the deferred AI decision assistant.

## AI Citation Readiness

Important pages require:

- a direct answer near the top,
- clear headings matching real user questions,
- factual comparison tables,
- visible calculation methodology,
- a last-updated date,
- source provenance,
- explicit uncertainty and limitations,
- stable canonical URLs,
- valid structured data,
- strong internal linking,
- server-rendered HTML,
- no unsupported marketing claims,
- no thin mass-generated content.

Priority page types are category pages, brand pages, product pages with multiple retailer offers, price and value comparisons, ingredient and dosage comparisons, methodology pages and best-for-goal pages.

## Parallel growth rule

Do not postpone SEO until catalogue coverage is complete. Coverage, SEO and AI citation readiness must grow together, while only one primary product, data, retailer or engineering task is active at a time.

## Commercial Coverage Sprint

**Status:** ACTIVE

**Business objective:** Increase multi-retailer coverage, useful price comparisons, affiliate readiness and catalogue authority as quickly as the existing safety pipeline permits.

Operating method:

1. Accept retailer CSV files and complete retailer snapshots already received.
2. Before processing a source, check for an existing adapter, parser or helper that can be reused.
3. Work on exactly one retailer at a time, using catalogue-level classification and safe bulk batches rather than a product-by-product catalogue process.
4. Prioritise existing canonical products, especially products with one active retailer that can gain a second or third.
5. Prefer popular products and categories, in-stock rows, exact flavour/size/count/format identity and working affiliate URLs.
6. Apply high-confidence rows first through the existing approved pipeline.
7. Give every isolated conflict a final, specific review status.
8. Allow a safe reduced batch when isolated conflicts do not affect the remaining records.
9. Never weaken identity guards to increase batch size.
10. Apply on staging before production and complete public and affiliate QA before closing a retailer.

Definition of done for each retailer:

- source file and SHA recorded,
- adapter/reuse audit completed,
- complete inventory classified,
- safe records applied through the existing dry-run, validator, approval and atomic apply pipeline,
- every conflict has a final status,
- staging and production verified,
- public product pages smoke-tested,
- delivered prices and retailer URLs verified,
- affiliate tracking verified or its absence explicitly recorded,
- coverage metrics and deltas recorded,
- this Operating Plan updated before the next retailer starts.

Commercial coverage baseline to record before the first new retailer:

- products with one active retailer,
- products with two active retailers,
- products with three or more active retailers,
- active offers,
- in-stock offers,
- products with valid affiliate links,
- outbound clicks,
- affiliate revenue, if available.

At the first checkpoint, assess coverage growth, import speed, conflict volume, public usefulness, affiliate readiness and the evidence from the implemented control ledger and completed Phase 3 local executor tests.

One active stage rule:

- exactly one retailer may be active at a time,
- do not start a staging/production bulk executor rollout, EKM automation, `SAFE_UPDATE` or another large Whey Okay reconciliation batch in parallel,
- update this Operating Plan after every retailer,
- start the next retailer only after the current retailer meets its definition of done.

Out of scope during the sprint:

- a new importer or separate application,
- `/admin/imports`,
- replacement approval ledgers, validators or atomic apply mechanisms,
- canary dry-run execution, approval creation and staging or production apply,
- EKM automation,
- scheduled production updates,
- `SAFE_UPDATE`.

### Project Control Board

| Workstream | Status | Current state | Resume trigger | Next action |
|---|---|---|---|---|
| Commercial Coverage Sprint | ACTIVE | Jon's initial rollout, Retailer Snapshot Phases 1-3, staging apply and production enablement design/package are complete | Ends or is reassessed at the first sprint checkpoint | Await one explicit Jon's production enablement and rollout approval |
| Whey Okay reconciliation | PAUSED | 137/520 reconciled; 383 remain; Medium 75/75 classified | Sprint completion or earlier justified checkpoint | Preserve current classifications and review queues |
| Retailer Snapshot Phase 1 | COMPLETE | Read-only framework, deterministic classification/plans and review artifacts reproduce the Jon's baseline | Complete | Reuse unchanged |
| Retailer Snapshot Phase 2 | COMPLETE | Three-table parent/child ledger and lifecycle runtime passed local validation and the schema is deployed on staging | Complete | Reuse as the control layer |
| Retailer Snapshot Phase 3 | COMPLETE | Local bounded executor passes transactional, delta, replay, concurrency and local-environment tests; staging and production writes remain zero | Complete | Preserve its intentional local-only boundary |
| Task 6 staging migrations | COMPLETE | Migration A and B applied through runner V2; final ledger count 27 and fingerprint sealed | Complete | Do not rerun or reuse the migration package |
| Post-migration readiness | COMPLETE | Readiness verdict is READY FOR CANARY DRY-RUN DESIGN | Complete | Preserve the zero-row control-plane baseline |
| Canary Dry-Run Design and Fresh Source Refresh | NEXT | Real 10-record fixture is sealed; live source evidence now requires refresh | Post-migration readiness complete | Refresh source evidence and design artifacts; stop before dry-run execution |
| Canary Dry-Run Execution | BLOCKED | Not authorised and fresh design artifacts do not yet exist | Fresh-source design review complete and separate explicit authorisation | No execution in the design task |
| Approval Creation | BLOCKED | No canary approval package is authorised | Successful separately authorised dry-run and a further reviewed approval task | Create nothing now |
| Staging Canary Apply | BLOCKED | Not authorised | Successful reviewed dry-run, fresh approval package and separate explicit approval | No apply in the design or dry-run task |
| Production Canary | SUPERSEDED FOR 26-OFFER REFRESH | The exact 26-offer staging apply and production readiness package replace the old canary boundary for this timestamp-only refresh | One explicit Jon's production enablement and rollout approval before package expiry | Do not execute without that approval |
| Scheduled Sync | DEFERRED | No bulk scheduled apply is authorised | Successful canaries, repeated clean runs and separate automation approval | Keep disabled |
| Jon's canary source and GTIN refresh | REQUIRED | Frozen fixture has nine exact GTINs and one reviewed alternate identity; live evidence is not fresh | Before dry-run execution | Refresh Shopify, CSV/GTIN, price, stock and identity evidence |
| Real Jon's 10-record fixture | COMPLETE WITH REFRESH CONDITION | Exact fixture is sealed and still matches staging | Regenerate if any source field changes | Rebind only after fresh source comparison |
| Bounded recovery framework | COMPLETE FOR READINESS | Recovery tables and target/expiry/replay/shared-state guards exist; no recovery was invoked | Before apply, bind an exact manifest and approval in a separate task | Do not invoke recovery now |
| `/creatine` SEO page | PRIORITY QUEUED | First priority SEO page; content/data contract is prepared, but no route is implemented | Separate reviewed SEO implementation task | Preserve as the first priority page; do not implement in this task |
| EKM automation | DEFERRED | No production EKM adapter; current normalized/import pipeline is reusable | Whey Okay reconciliation resumes and source/API contract is approved | Later build acquisition only, reusing the current pipeline |
| `SAFE_UPDATE` | DISABLED | Classification exists; automatic production apply remains off | Separate reviewed phase after repeated clean runs and explicit approval | No action during the sprint |
| Analytics | QUEUED | Outbound clicks exist; broader baseline is incomplete | Commercial sprint checkpoint or a dedicated analytics phase | Record available coverage and affiliate baseline metrics |
| Images/catalogue quality | QUEUED | 12 backfills verified; products 751 and 752 remain manual review | After the active retailer closes or at a prioritised quality checkpoint | Preserve the two manual image tasks |
| Comparison value features | QUEUED | Product and delivered-price foundations exist | Stable retailer coverage and analytics | Do not implement during the sprint |

The numbered programme roadmap below predates the Retailer Snapshot Bulk Import phase sequence. Its labels are retained for historical continuity; references to completed **Retailer Snapshot Phase 3** do not mean the paused legacy Whey Okay roadmap phase.

## Legacy roadmap Phase 0: operating control

**Status:** in progress and maintained through this document.

Actions:

1. Keep this document current.
2. Use it as the first reference in new chats and Codex sessions.
3. Maintain one active priority and a short queued list.
4. Update counts, refs, completed batches and decisions after every major milestone.

Definition of done:

- one current source of truth,
- no conflicting roadmap across chats,
- clear current task, next task and deferred list.

## Legacy roadmap Phase 1: finish the 200 milestone with value

**Current:** 200 / 200
**Remaining:** 0

Selection priority:

1. cross-retailer coverage,
2. existing canonical products,
3. in-stock products,
4. popular categories,
5. multiple flavours in one family,
6. new products only with high-confidence identity.

Do not lower identity quality merely to reach 200.

Definition of done:

- approximately 200 high-quality source variants/offers added,
- all production mappings verified,
- all public pages smoke-tested,
- no unresolved import blockers,
- final catalogue quality report.

## Legacy roadmap Phase 2: catalogue quality and images

Actions:

1. Resolve the two manual Diet Whey images.
2. Enforce image handling for every future new canonical product.
3. Define image priority:
   - existing canonical image,
   - verified manufacturer packshot,
   - approved exact retailer packshot,
   - placeholder.
4. Never overwrite an approved canonical image automatically.

Done:

- 12 approved Batch F image backfills are present and verified on staging and production.
- Public product pages and search/card rendering passed smoke checks for those 12 products.

Definition of done:

- no unexplained blank product images,
- image provenance known,
- future new-product pipeline requires an image decision,
- automated backfill limited to null/empty canonical images and exact identity.

## Legacy roadmap Phase 3: Whey Okay reconciliation

**Status:** PAUSED during the Commercial Coverage Sprint.

This remains a defined data project after the 200 milestone. All existing classifications and review queues remain authoritative; no large reconciliation batch should run in parallel with the active retailer.

### Step A: parent-product reconciliation

For the remaining legacy mappings:

- map current EKM product ID,
- verify parent URL,
- classify exact, drifted, duplicate, ambiguous, removed.

### Step B: variant reconciliation

- assign EKM variant ID,
- capture flavour, size, count and format,
- map to exact canonical variant,
- create missing canonical variants only after review.

### Step C: controlled legacy mapping upgrades

Use the existing legacy mapping upgrade RPC and approval model.

Pilot status:

- 70 standalone legacy mappings have been upgraded successfully,
- continue with larger but still reviewable sequential one-row approval batches,
- do not use a multi-row artifact unless separately reviewed and approved.

### Step D: automatic source

Preferred source order:

1. EKM Partner API v2 with merchant OAuth,
2. merchant-authorised scheduled Google Shopping/feed URL,
3. storefront scraping only as a last fallback.

Definition of done:

- all safe legacy mappings have stable EKM identity,
- all ambiguous mappings are separated for review,
- automatic full snapshot works,
- no manual CSV upload is required for routine updates.

## Legacy roadmap Phase 4: retailer automation

### Discount Supplements

- observe Stage 1 reports,
- review false positives and missing cases,
- enable production `SAFE_UPDATE` only after explicit approval.

### Fit House

- build scheduled full snapshot and Stage 1 dry-run,
- use Shopify product/variant IDs,
- maintain independent security boundary.

### Whey Okay

- automate only after reconciliation.

Definition of done:

- daily source snapshots,
- source integrity checks,
- safe updates for existing approved mappings,
- new products and variants remain review-only,
- clear alerting for missing-from-source and identity drift.

## Legacy roadmap Phase 5: analytics foundation

Minimal stack:

1. Vercel Web Analytics for visits and page views,
2. Google Search Console for organic visibility,
3. anonymous first-party business events for:
   - search performed,
   - zero-results search,
   - product viewed,
   - variant selected,
   - retailer offer clicked,
   - Best UK Price clicked.

GA4 is optional later and should not be added before privacy/consent is reviewed.

Definition of done:

- know whether real users are visiting,
- know what they search for,
- know which products and offers attract attention,
- know which searches return no results,
- use evidence to prioritise catalogue and UX work.

## Legacy roadmap Phase 6: comparison value features

After catalogue freshness and analytics are stable:

1. price per kilogram,
2. price per serving,
3. cost per 25 g protein,
4. cost per 5 g creatine,
5. price history charts,
6. lowest recorded price,
7. better filtering and sorting,
8. similar products,
9. better-value alternatives.

Before implementing each feature, verify whether it already exists anywhere in the codebase.

## Legacy roadmap Phase 7: AI decision assistant

Build only when product data is sufficiently structured.

Target experience:

- one “Help me choose” button,
- two or three simple questions,
- ranked recommendations,
- clear reasoning,
- dosage and value explanation,
- no unsupported medical claims.

---

## 13. Immediate active plan

### Current active task

Execute Plan A in section 0.8: close the reviewed Jon's production decision, refresh currently approved creatine mappings through the existing path, and make the factual `/creatine` launch decision. No production write occurs without the explicit approval required for that complete production stage.

### Next task

Secure one authorised broad-overlap retailer source and process 25-50 high-confidence existing-product offers through the standard importer. If no such source is available, use a reviewed Jon's or KIOR configuration batch for catalogue breadth and state clearly that it does not improve multi-retailer depth.

### Then

1. Preserve the production package and existing safety guards; refresh artefacts if any source, state, ledger, expiry or commit binding changes.
2. Use one approval for each complete environment stage, with all existing drift, identity, exact-delta, replay and recovery checks retained internally.
3. Populate the retailer source registry and select future sources by overlap, freshness and affiliate readiness.
4. Launch `/creatine` only when its existing freshness contract passes.
5. Freeze infrastructure and control-plane work unless a real batch exposes a specific unsupported requirement.
6. Review the measured growth indicators weekly and update section 0 with evidence.

### Deferred near-term

Create two custom Codex skills:

1. `SupplementScout Retailer Import Operations`
2. `SupplementScout Images & Catalog Quality`

These should encode stable operating rules and reduce repeated long prompts, but must not run in parallel with the active retailer.

---

## 14. Explicitly deferred

Do not start these now:

- canary dry-run execution,
- approval creation,
- staging canary apply,
- production canary apply,
- production bulk rollout for the remaining Jon's catalogue,
- scheduled retailer synchronization,
- committed-batch rollback automation,
- cleanup of the eight expired approvals,
- admin review UI and `/admin/imports`,
- automated canonical merge,
- automatic deletion or deactivation,
- affiliate automation,
- shipping discovery,
- full catalogue family rollout,
- eBay integration,
- mobile app,
- retailer self-service portal,
- paid listings,
- public API,
- advanced GA4 implementation,
- broad AI assistant,
- autonomous creation of new canonical products,
- unprioritised retailers outside the controlled Commercial Coverage Sprint,
- large frontend redesign.

---

## 15. Key project metrics

### Catalogue quality

Track:

- active products,
- canonical variants,
- products without images,
- default-only products with variant evidence,
- duplicates,
- identity conflicts,
- inactive and merged products.

### Retailer coverage

Track:

- products with one active retailer,
- products with two active retailers,
- products with three or more active retailers,
- active offers,
- in-stock offers,
- stale offers.

### Data freshness

Track:

- last successful snapshot per retailer,
- source row counts,
- source errors,
- price changes,
- stock changes,
- missing-from-source findings,
- blocked identity cases.

### User value

Track:

- visits,
- product views,
- searches,
- zero-result searches,
- variant selections,
- outbound clicks,
- Best UK Price clicks,
- click-through rate to retailers.

### Business progress

Track:

- indexed pages,
- organic impressions,
- organic clicks,
- affiliate clicks,
- affiliate revenue,
- retailer coverage growth.

---

## 16. Definition of a healthy production system

SupplementScout is healthy when:

- canonical identity is clean,
- multiple retailers are represented accurately,
- prices and stock are fresh,
- broken sources fail closed,
- new identity never appears automatically without review,
- user-visible images are present and trustworthy,
- UI links to the exact selected offer,
- approvals are auditable and non-replayable,
- staging matches production architecture,
- user behaviour can be measured without unnecessary personal data,
- roadmap work is chosen by value rather than novelty.

---

## 17. Decision log snapshot

Current binding decisions:

- Finish 200 high-quality variants/offers before production `SAFE_UPDATE`.
- Current progress is 200 / 200.
- eBay is postponed.
- Commercial Coverage Sprint is the primary active product/data workstream and processes one retailer at a time; SEO and AI-search visibility run alongside it as a bounded daily growth workstream.
- Large retailer catalogues must use the Retailer Snapshot Bulk Import strategy rather than continuing product by product.
- Jon's initial rollout is complete: 5 products, 24 flavour variants, 26 mappings, 26 offers and 26 price-history rows on production; the remaining catalogue is deferred to the bulk snapshot workflow.
- Whey Okay reconciliation is paused at 137/520 with all 383 remaining mappings and current review queues preserved.
- Whey Okay automation comes after reconciliation resumes; EKM acquisition must reuse the current normalized/import pipeline.
- Whey Okay standalone pilot, Batch 2.1, Batch 3, reduced Batch 4, reduced optioned pilot, final Easy optioned cleanup and reduced Medium Batches 1-3 upgraded 137 total legacy mappings; 383 remain.
- Retailer Snapshot Phases 1, 2 and 3 are complete locally; the framework, control plane and bounded local business executor are no longer deferred.
- Phase 3 completed in commit `6a754f0e7c942dde550e029056e15f940aa56b3a`; its local-only boundary remains intentional and must not be weakened.
- The stale product presentation test cleanup is separate from Phase 3 and completed in commit `2bc6a8c82c191b1bf935fdcf61fc5cd3296638b7`.
- Task 6 staging migrations are complete: Migration A and B are applied and validated, with final ledger count 27 and fingerprint `2c36d09244f4c81f0727ad50dd62fad21c9c8037aee66342eed0662037d3081a`.
- The post-migration readiness review is complete with verdict **READY FOR CANARY DRY-RUN DESIGN**.
- Historical state before the 26-offer staging pass: the immediate next task was **Canary Dry-Run Design and Fresh Source Refresh**. This was completed and superseded on 2026-07-19.
- The exact 26-offer staging apply passed, and the later production enablement design/package superseded the earlier **NOT READY** review by adding the single production-targeted migration, role/grant contract, validator/recovery/expiry framework and canonical production slug binding in repo.
- The next authorised boundary is one explicit Jon's production enablement and rollout approval only. No production migration, login, attestation, validator, approval, apply or recovery is authorised without that explicit approval.
- Use one approval per whole reviewed stage. After Jon's production closure, freeze infrastructure unless a real blocker exists, then move to the next retailer, multi-retailer coverage and `/creatine` indexing readiness.
- The Phase 3 local executor cannot be redirected to staging; the deployed staging framework retains separate target-specific roles, guards and approval boundaries.
- The real 10-record fixture is sealed and matches staging, subject to a fresh live-source, price, stock, GTIN and alternate-identity refresh before dry-run execution.
- The bounded recovery framework is deployed and readiness-audited; an exact canary recovery manifest and approval remain later apply-stage boundaries.
- The eight expired approvals are non-reusable and cleanup remains a separate deferred maintenance task.
- No canary dry-run, approval or apply may occur without fresh source hashes, a fresh staging canonical snapshot, recalculated deltas and a reviewed fixture fingerprint.
- Staging canary, production canary and production bulk rollout each require later, separate review and explicit approval.
- No staging apply is allowed without a real 10-record fixture, GTIN and canonical identity review, exact approved deltas and an approved recovery decision.
- Fit House and Discount Supplements should become automated through staged, fail-closed workflows.
- New products and variants remain review-only.
- Scheduled price/stock updates remain deferred.
- `SAFE_UPDATE` remains disabled until a separate phase, repeated clean runs and explicit approval.
- Do not duplicate already completed work.
- Build the two custom SupplementScout skills later, not in parallel with the active retailer.
- Do not run many major initiatives in parallel.
- Do not postpone SEO until catalogue coverage is complete; coverage, SEO and AI citation readiness grow together.

---

## 18. Changelog

### 2026-07-15

- Batch F production PASS.
- Progress is 151 / 200.
- 36 Fit House mappings/offers/history added.
- 12 canonical images verified.
- 2 Diet Whey images remain manual.
- `SAFE_UPDATE` still disabled.
- Batch G canonical catalog deployed: 18 products and 67 product variants.
- Reduced Batch G production offer apply PASS: 47 Fit House mappings/offers/history added.
- Progress is 198 / 200.
- 2 Batch G records remain manual review due to missing explicit source flavour evidence.
- Next step is to find two safe replacement records, then begin Whey Okay reconciliation.
- `SAFE_UPDATE` still disabled.
- Batch G replacement production PASS: 2 additional Fit House mappings/offers/history added for GYM HIGH Whey Pro Synergy 600g.
- Progress is 200 / 200.
- 200 source-variant/offer milestone complete.
- Next priority is Whey Okay reconciliation.
- `SAFE_UPDATE` still disabled.
- Whey Okay standalone legacy mapping pilot PASS: 10 one-row upgrades applied on staging and production.
- Whey Okay reconciliation Batch 2.1 PASS: 25 additional one-row upgrades applied on staging and production.
- Total Whey Okay legacy mappings reconciled: 35.
- Remaining Whey Okay legacy mappings: 485.
- Batch 2.1 excluded retailer_products 368, 102 and 406 due to incomplete external identity evidence.
- Whey Okay reconciliation Batch 3 PASS: 25 additional one-row upgrades applied on staging and production.
- Total Whey Okay legacy mappings reconciled: 60.
- Remaining Whey Okay legacy mappings: 460.
- Batch 3 had no new incomplete-evidence exclusions; higher-risk candidates were left out fail-closed.
- Whey Okay reconciliation reduced Batch 4 PASS: 10 additional one-row upgrades applied on staging and production.
- Total Whey Okay legacy mappings reconciled: 70.
- Remaining Whey Okay legacy mappings: 450.
- Batch 4 excluded retailer_products 418 and 444 due to incomplete external identity evidence.
- Further Batch 4 candidate records were not processed after the reduced 10-row PASS set.
- Optioned Whey Okay tooling PASS: Flavour-only plus parent-size evidence, identity-only mapping/offer variant movement, and historical null total support are deployed.
- Product format evidence fix for optioned artifacts PASS: all 8 final records had source `product_format = powder` evidence.
- Reduced optioned Whey Okay pilot PASS: 8 additional mappings applied on staging and production.
- Total Whey Okay legacy mappings reconciled: 78.
- Remaining Whey Okay legacy mappings: 442.
- `retailer_product_id` 191 remains canonical variant review; `retailer_product_id` 150 remains flavour manual review.
- Final Easy optioned cleanup PASS: `retailer_product_id` 482 applied on staging and production.
- Total Whey Okay legacy mappings reconciled: 79.
- Remaining Whey Okay legacy mappings: 441.
- `retailer_product_id` 409 remains flavour manual review because source flavour `Apple` does not exactly match canonical `Apple & Cherry`.
- Continue reconciliation in larger sequential one-row approval batches; do not enable Whey Okay automation yet.
- `SAFE_UPDATE` still disabled.

### 2026-07-16

- Whey Okay Medium Batch 1 canonical seed DONE: 25 active non-default canonical variants deployed on staging and production.
- Reduced Whey Okay Medium Batch 1 reconciliation PASS: 24 mappings and their offers moved from the expected default variants to matching canonical variants on staging and production.
- `retailer_product_id` 179, EKM variant 1007, was excluded after `conflicting variant evidence: size` and moved to `PACK_COUNT_REVIEW`; its canonical `Blueberry Crisp / 12x68g` variant remains active.
- Total Whey Okay legacy mappings reconciled: 103.
- Remaining Whey Okay legacy mappings: 417.
- Medium remaining legacy mappings: 51; 50 require canonical variant seeds and 1 requires pack-count reconciliation.
- Prices, shipping, totals, stock, URLs, clicks and price history remained unchanged.
- `SAFE_UPDATE` still disabled.
- Whey Okay Medium Batch 2 canonical seed DONE: 25 active non-default canonical variants deployed on staging and production.
- Reduced Whey Okay Medium Batch 2 reconciliation PASS: 24 mappings and their offers moved from the expected default variants to matching canonical variants on staging and production.
- `retailer_product_id` 358, EKM variant 1897, was excluded after `format conflict` and moved to `FORMAT_REVIEW`; its canonical `Cookies and Cream / 45g` variant remains active.
- `retailer_product_id` 483 remains excluded with unresolved count/servings identity and was not included in the canonical seed.
- Total Whey Okay legacy mappings reconciled: 127.
- Remaining Whey Okay legacy mappings: 393.
- Medium remaining legacy mappings: 27; 25 require canonical variant seeds and 2 have seeded-but-unresolved canonical variants (`rp179` pack-count review and `rp358` format review).
- Prices, shipping, totals, stock, URLs, clicks and price history remained unchanged.
- `SAFE_UPDATE` still disabled.
- Whey Okay Medium Batch 3 canonical seed DONE: 19 active non-default canonical variants deployed on staging and production.
- Reduced Whey Okay Medium Batch 3 reconciliation PASS: 10 mappings and their offers moved from the expected default variants to matching canonical variants on staging and production.
- Nine seeded mappings (`rp178`, `rp183`, `rp535`, `rp455`, `rp450`, `rp484`, `rp421`, `rp230`, `rp129`) remain `MANUAL_REVIEW` because dry-run correctly required complete external identity evidence; no approval was created for them.
- Final Medium audit: 75/75 classified, comprising 58 `RECONCILED`, 2 `PACK_COUNT_REVIEW`, 5 `FORMAT_REVIEW`, 1 `IDENTITY_CONFLICT`, 9 `MANUAL_REVIEW`, and 0 `DUPLICATE`/`EXCLUDE`.
- Total Whey Okay legacy mappings reconciled: 137.
- Remaining Whey Okay legacy mappings: 383.
- Prices, shipping, totals, stock, URLs, last-checked timestamps, clicks and price history remained unchanged during Batch 3 reconciliation.
- `SAFE_UPDATE` still disabled.
- Historical decision, superseded later on 2026-07-17: at this point the Retailer Import Control Plane remained the approved long-term direction and its implementation was still deferred.
- Commercial Coverage Sprint is now the active business priority to increase multi-retailer coverage, public usefulness, affiliate traffic readiness and commercial potential.
- Remaining Whey Okay reconciliation is paused at 137/520 with 383 mappings and all current review queues preserved.
- The sprint will process one retailer at a time through the existing importer, validator, approval ledger, staging and production apply pipeline.
- First checkpoint is after two or three new retailers or five to eight working days, whichever occurs first.
- EKM automation, scheduled price/stock updates and `SAFE_UPDATE` remain deferred; `SAFE_UPDATE` remains disabled.

### 2026-07-17

- Jon's Supplements adapter, staging pilot and initial production rollout completed.
- Retailer ID 10 now has 5 products, 24 flavour variants, 26 mappings, 26 offers and 26 price-history rows; all 26 offers are in stock.
- Per4m Mult Vita+Min and TBJP Oh Mega Pharma Pro production rollouts completed.
- Canonical family seeds and 24-row staging/production offer rollouts completed for PER4M EAA Xtra 420g, PER4M Pre-Workout Stim 570g and PER4M Creatine Sherbet 310g.
- Strawberry Lime, five OOS variants, unresolved Project AD, Protein Bars and PER4M Whey remain explicitly excluded or deferred.
- Post-rollout product coverage is 605 products at one or more active retailers, 63 at two or more, 3 at three or more and 0 at four or more, across 759 active canonical products.
- The five Jon's product families each moved from zero to one active retailer; none moved into multi-retailer coverage.
- Retailer Snapshot Bulk Import is now the required strategy for the remaining Jon's catalogue.
- SEO and AI-search visibility became a permanent daily parallel growth workstream; the AI decision assistant remains deferred.
- Historical context: at the start of 2026-07-17, the immediate next task was to design, but not implement, the reusable Retailer Snapshot Bulk Import workflow; that earlier instruction was superseded by the completed Phase 1, Phase 2 and Phase 3 work recorded below.
- Retailer Snapshot Bulk Import Phase 1 completed in commit `53446ce6ed755f484e25551a757d4d0161e8a290`: read-only framework, 10 JSON contracts, 64 reason codes, 20 stable errors, deterministic classification/plans, validators and review artifacts reproduced the Jon's baseline with no Supabase writes.
- Retailer Snapshot Bulk Import Phase 2 completed in commit `94d1bf56991485a682a6eda4bce628229e614579`: three control tables, 11 public lifecycle RPCs, six internal functions, locking, expiry, replay protection, resume and rollback metadata passed disposable-PostgreSQL tests with no business-table, staging or production writes.
- Retailer Snapshot Bulk Import Phase 3 completed in commit `6a754f0e7c942dde550e029056e15f940aa56b3a`: the bounded local child-batch executor reuses Phase 1 plans, Phase 2 lifecycle, the read-only validator, row-level approvals and atomic apply without direct business-table DML.
- Phase 3 local tests passed for a synthetic 10-row canary, 50-row child, mid-child rollback, delta-mismatch rollback, replay and concurrency; full regression passed 600/600, with zero staging and production writes.
- The separate presentation test cleanup completed in commit `2bc6a8c82c191b1bf935fdcf61fc5cd3296638b7`; presentation tests passed 64/64. This cleanup is not part of Phase 3.
- The Phase 3 executor remains intentionally local-only. Its synthetic canary does not authorise or sufficiently prove staging readiness.
- Historical state at the close of 2026-07-17: committed-batch business rollback remained unresolved and only failed-child transactional rollback was proven. This was superseded on 2026-07-18 by the deployed, readiness-audited bounded recovery framework; an exact recovery manifest and approval are still required before apply.
- Historical next task at the close of 2026-07-17: the Staging Canary Readiness and Design Review. This was completed and superseded on 2026-07-18.
- No staging apply may occur without an approved real 10-record Jon's fixture, GTIN and canonical identity review, exact expected deltas, target-specific approvals, migration readiness and a committed-batch recovery decision.
- `SAFE_UPDATE` remains disabled.

### 2026-07-18

- The first Task 6 attempt failed before `COMMIT` and rolled back safely; staging migration count, schema and business state remained unchanged.
- Root cause was JavaScript replacement-string handling in the migration runner. Runner V2 fixed the boundary with whole-query execution, callback replacement and parameterised ledger text.
- The failed package was marked `SUPERSEDED_AFTER_FAILED_ATTEMPT`; a fresh immutable package was issued and separately authorised.
- Task 6 retry passed: Migration A and Migration B were applied and validated on staging.
- Source, executed and ledger migration text SHA-256 values matched for both migrations.
- Final staging migration count is 27 and fingerprint is `2c36d09244f4c81f0727ad50dd62fad21c9c8037aee66342eed0662037d3081a`.
- Eight control/staging tables, required functions and staging roles are deployed; RLS, forced RLS, grants, constraints, indexes, owners and security boundaries passed.
- Business-table deltas were zero; no approvals, plans, dry-runs, apply runs or recoveries were created; production was untouched.
- The read-only post-migration readiness review passed with verdict **READY FOR CANARY DRY-RUN DESIGN**.
- The next task is **Canary Dry-Run Design and Fresh Source Refresh**. No dry-run execution, approval creation or apply is allowed without a fresh live source, CSV/GTIN enrichment, source hashes, staging canonical snapshot, price/stock validation, drift comparison, recalculated deltas and regenerated fixture binding when required.
- `SAFE_UPDATE` remains disabled.

### 2026-07-19

- Jon's exact 26-existing-offer staging apply PASS: 26 `last_checked_at` updates using source capture `2026-07-19T09:33:56.316Z`; price, shipping, stock, offer URL, mapping URL and price-history deltas were zero.
- The staging apply succeeded, its one whole-stage approval was consumed, recovery manifest state is ready, and production was untouched.
- Fresh production/source audit confirmed retailer ID 10, 26 mappings, 26 offers, no duplicate or incomplete identity, Shopify coverage 26/26 and `VERIFY_NO_CHANGE ×26`.
- Production readiness verdict updated after implementation and local verification: **READY FOR ONE EXPLICIT JON'S PRODUCTION ENABLEMENT AND ROLLOUT APPROVAL**.
- One production-specific migration is prepared: `20260719100000_add_production_retailer_sync_enablement`, SHA-256 `ef45a78b0285d73cbc72cedf127d34ef08a8ad2b9c40076fa84e2051d3b85bd1`. It preflights production ledger 25/fingerprint `ba5d4c8581b185d5412fa4f41a3cbeacf40547f507e124962f922d4aa71772b0`, binds to ref `aftboxmrdgyhizicfsfu` and expected post-ledger 26/fingerprint `a0015032fc8b3b4fbf829ea0d0f1eb1dfdcaf1893d68dc875f21558c6a587152`, and rejects staging ledger 31 before DDL.
- Repository slug drift is resolved to `jon-s-supplements`; the rollout package is `3989396e-748b-4d23-84e1-ac0170548079`, fingerprint `d4637bf98249207af01001e3fd5b70c76b4f616010089c287354237905493e06`, expiry `2026-07-20T09:58:27.691Z`.
- Next authorised boundary: one explicit Jon's production enablement and rollout approval. No production migration, login, attestation, validator, approval, apply or recovery is authorised without it.
- Use one approval per whole stage. After Jon's is closed, freeze infrastructure unless a real blocker exists; then continue with the next retailer, multi-retailer coverage and `/creatine` indexing readiness.
- `SAFE_UPDATE` remains disabled.

---

## 19. How to use this document

At the start of every new project chat or Codex session:

1. Read this Operating Plan.
2. Confirm current production and staging refs.
3. Check whether the planned work already exists.
4. State the one active task.
5. State what is explicitly out of scope.
6. Work through staging before production.
7. Update this document after a major milestone.

This document should remain concise enough to operate from, but complete enough to prevent the project from fragmenting across conversations.
