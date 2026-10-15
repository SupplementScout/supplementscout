# UX Retention Phase 1 Execution Pack

**Status:** PHASE 1 LIVE VERIFIED — MEASUREMENT INSTRUMENTATION IN PROGRESS
**Prepared:** 15 October 2026  
**Owner decision:** On 15 October 2026 the owner explicitly resumed this goal
after completing the separate nutrition work. Phase 1 is classified as a
separately scoped product UX release. It may proceed while SEO-15 remains
blocked, without changing the SEO order or enabling historical price claims.
**Scope:** Existing public category and product UX only. No lifecycle status,
catalogue data or production data is changed by this approval.

**Current concurrency readback:** current `origin/main` now records SEO-15 as
`IN PROGRESS`, but its executable step is the already established read-only
daily monitoring path. Release A remains a separate product release with no
SEO-15 data, route or release-flag change. It may continue beside that
monitoring and must pause before any overlapping SEO implementation begins.

## 1. Outcome

Turn the first SupplementScout visit into a short, explainable decision and
give a returning shopper a private, useful reason to come back.

Phase 1 is complete only when both bounded releases below are live verified:

1. **Decision layer:** existing approved category/comparison pages lead with
   truthful, data-backed answers before the full catalogue list.
2. **My Supplements MVP:** a shopper can save exact products locally, estimate
   when they run out, see recurring cost and recheck the current delivered
   price without creating an account.

This product release does not alter the binding SEO order. The SEO ledger still
names SEO-15 as the active SEO task and keeps SEO-17 behind it. Release A may
run beside SEO-15's current read-only monitoring because it is separately
scoped, but it must pause before overlapping SEO implementation begins and must
preserve every lifecycle, indexability and truthful-price contract.

## 2. Evidence checked before design

### Repository and governance

- `npm run verify:project` passed on 15 October 2026: 19 SEO tasks checked,
  next task SEO-15, and no SEO implementation in progress.
- The worktree already contains unrelated user changes in `AGENTS.md`, the
  Operating Plan, Nutrition ledger/evidence and untracked retailer/nutrition
  material. Phase 1 must not overwrite, stage or reinterpret those changes.
- `docs/SupplementScout-Operating-Plan-2026-07-15.md` section 0.0.7 keeps the
  binding order at SEO-15, then SEO-17, with weekly measurement continuing.
- `docs/SEO-Indexability-Lifecycle.md` requires existing category hubs to keep
  the shared registry, cache, robots, canonical, sitemap, empty-state and 5xx
  contracts. Query-based filters must be `noindex, follow` and canonicalize to
  the approved clean base route unless they are the existing SEO-04 pagination
  exception.

### Current product mechanisms

- Shared category data already exposes fresh offers, known delivered totals,
  retailer/offer coverage, verified price per serving, price per kg and cost
  per 25 g protein through `app/lib/categoryComparison.ts`.
- Creatine has a separate verified cost-per-5-g path and must not be forced
  through a generic protein/value calculation.
- Existing category pages already render one lowest-delivered-price answer,
  followed by the full result list. They do not yet expose three decision
  reasons, category controls or an add-to-comparison action on every card.
- `/compare` is live verified and already supports a valid partial selection:
  `?left=<product-id>` displays a prompt to choose the second product. Reuse it;
  do not build a second comparison store or engine.
- Search already owns shared filter/sort UI and consent-aware analytics. Reuse
  its accessibility and URL-normalization patterns where their semantics fit;
  category logic remains in the shared category comparison system.
- The public analytics contract measures search, category views, retailer
  clicks and better-value alternatives. It does not yet measure category
  decision-card use, compare completion, saving, stack views or return intent.

### Duplication and ownership audit — 15 October 2026

The current repository was searched by behavior and symbol before selecting a
Phase 1 design:

- Amino Acids, Hydration, Mass Gainer, Multivitamins, Pre Workout, Protein
  Bars, Vegan Protein, Whey Isolate and Whey Protein already normalize through
  `app/lib/categoryComparison.ts`. Their route modules add reviewed category
  boundaries and presentation, rather than owning a second general engine.
- Creatine predates that shared row shape and retains its own
  `CreatineComparisonRow` with the verified `verifiedCostPer5g` metric. Phase 1
  must not create a third comparison engine or perform an opportunistic broad
  Creatine migration.
- All ten reviewed category routes still render their principal product cards
  locally. They share `UnavailableComparisonProductCard` and lower-level
  pricing/presentation helpers, but their facts and copy vary. Extracting all
  cards into one universal component is not a Phase 1 prerequisite and would
  create a high-risk abstraction before the stable common boundary is known.
- `/compare` already accepts a single valid `left` product and asks for the
  second selection. Category actions should link to this behavior rather than
  introduce comparison state elsewhere.
- The product route already resolves the requested exact variant, falls back
  to the cheapest offer's variant and supplies the selected variant to
  analytics and variant-specific facts. The save action must receive this
  resolved server value; it must not repeat variant selection in the browser.
- The only public browser-storage owner found is analytics consent, isolated in
  `app/lib/analyticsConsent.ts`. My Supplements therefore needs one analogous
  versioned module and one distinct key, not storage calls scattered through
  buttons and pages.
- All current public custom events pass through the typed, consent-aware
  `app/lib/analytics.ts` dispatcher. No second event queue is justified.
- Product-detail data retrieval is currently route-local, while search and
  category reads have separate shared loaders. The My Supplements current-data
  endpoint must not paste the product-page Supabase query. Its implementation
  begins by extracting or extending one bounded public product-snapshot loader
  which both the endpoint and any affected product logic can safely reuse.

The stable new shared boundary is therefore a small `DecisionCandidate`
projection, not another catalogue type. Each existing comparison owner maps
its already-normalized safe row to:

- canonical product identity and URL;
- current known delivered total and checked time;
- retailer and offer counts;
- an optional route-approved verified value plus its basis enum.

One pure selector owns winner/tie/deduplication semantics. One shared decision
component renders its output. Route adapters may supply facts but cannot rank
or relabel winners locally. This integrates the older Creatine model without
copying it and avoids forcing all category-specific cards into a premature
universal component.

### Production and behavioural evidence

- The live home page currently presents 1,295 active catalogue products, 12 UK
  retailers and a latest recorded check of 14 October 2026.
- Live category readback shows strong evidence density (for example Creatine
  reports 85 active products, 125 recent offers and eight current retailers),
  but the main interaction remains a long ordered list.
- The latest stored authenticated measurement evidence covers 2–8 September
  2026 and is too small/contaminated to support an uplift claim: 1,276 GSC
  impressions, two clicks and only four conservatively external organic
  sessions after excluding 67 likely operational sessions from one user.
- A fresh local GA4/GSC run is not proven available in the current shell.
  Instrumentation must ship before an uplift threshold is asserted; missing
  baseline evidence must never be converted into zero.

## 3. Release A — category decision layer

### 3.1 Shared selection contract

Add one pure shared selector over the existing normalized comparison rows. It
returns up to three **unique** products and an array of truthful reason badges
for each product. If one product wins more than one reason, show one card with
multiple badges; never label a second-place product as the winner merely to
fill three slots. If evidence supports fewer than three unique answers, render
fewer cards and explain the limitation.

The reasons are:

1. **Lowest delivered total** — minimum positive known delivered total among
   current eligible rows. Unknown delivery can never win.
2. **Best verified value** — minimum of the route's explicitly approved,
   comparable metric. No cross-form or unverified fallback is allowed.
3. **Broadest retailer coverage** — greatest current retailer count, requiring
   at least two retailers. Ties use offer count, then known delivered total,
   then stable product identity.

Every answer includes:

- a short reason in plain English;
- exact metric and comparison basis;
- current retailer/offer coverage;
- freshness label;
- product-detail action;
- `Add to comparison`, linking to the existing `/compare?left=<id>` path;
- `Save to My Supplements` only after Release B is available.

### 3.2 Route-specific value policy

No generic "best value" score is permitted. Each route must register one
reviewed basis and an eligibility rule:

| Route family | Primary value basis | Eligibility |
|---|---|---|
| Whey Protein, Whey Isolate, Vegan Protein | delivered cost per 25 g protein | exact current offer plus verified package and protein evidence |
| Creatine | delivered cost per 5 g declared creatine | existing creatine-specific verified calculation only |
| Protein Bars, Mass Gainer, Hydration, Pre Workout, Amino Acids, Multivitamins | no basis assumed by this pack | add only after the route's existing data proves a genuinely comparable verified unit; otherwise omit the value winner |

Price per serving is not automatically comparable across formulations or dose
sizes. A route may adopt it only through an explicit reviewed rule and focused
tests. No nutrition quality, effectiveness, popularity or medical winner is in
scope.

### 3.3 Filters and sorting

Release A does not duplicate search filters wholesale. Add controls only when
the normalized category result can support them completely and server-side:

- sort by decision default, delivered total, verified value and retailer
  coverage;
- filter by brand, retailer and product format only where the whole loaded
  comparison set supplies the necessary facts;
- preserve stable product anchors in initial HTML;
- normalize parameters centrally;
- mark every non-pagination parameter state `noindex, follow` with the clean
  base canonical;
- do not create indexable filter combinations or another data loader/cache.

Mobile filters use the established search drawer accessibility pattern. Empty
filtered states must distinguish "no match for these controls" from a loader
failure or zero current coverage.

### 3.4 Release-A analytics

Extend the allowlisted, consent-aware analytics contract with bounded fields:

- `view_category_decision_answers`: category, answer count, available reason
  types;
- `select_category_decision_answer`: category, product ID, reason type,
  position;
- `add_product_to_comparison`: product ID, category, source page;
- `complete_two_product_comparison`: left/right product IDs and source page;
- category filter/sort events using controlled enum values only.

Do not send raw search text, URLs, notes, dosage, health goal or other user
entered content.

### 3.5 Release-A proof

Required local proof:

- pure-selector tests for missing delivery, duplicate winners, ties, fewer than
  three answers, stale/OOS exclusion and stable ordering;
- route tests for every enabled value basis and every deliberate omission;
- robots/canonical tests for all added parameters;
- lifecycle cache, empty-state and error contracts remain green;
- keyboard and accessible-name tests for decision and compare actions;
- analytics allowlist/consent tests;
- `npm run verify:quick`, then `npm run verify:full` before completion.

Required live proof:

- representative protein and creatine pages return HTTP 200 with correct clean
  canonicals, robots and sitemap state;
- decision answers match visible current rows and exact metrics;
- unknown delivery, stale offers and unverified values cannot win;
- compare action opens the correct existing product as the first selection;
- mobile and desktop render without hiding the full crawlable result path;
- consent-granted events appear without affecting navigation; refusal leaves
  them absent.

### 3.6 Release A live verification checkpoint — 15 October 2026

Release A is deployed and live verified.

- One shared decision selector and one shared answer panel now serve all ten
  reviewed category routes. Duplicate winners collapse, unknown delivery
  cannot win and verified-value answers exist only on the four approved route
  families.
- The existing `/compare?left=<id>` flow is reused. Completion and category
  decision actions use the existing consent-aware analytics dispatcher.
- One shared server-side category-controls owner now provides normalized brand,
  retailer and complete-format filters plus route-approved sorts across the
  same ten routes. Filtered URLs retain the existing lifecycle noindex and
  clean-canonical behavior. No second loader, cache, comparison engine or
  analytics queue was added.
- Old repository copies under `.worktrees/` and `tmp/` are excluded from the
  TypeScript and lint input sets. This removed duplicate checking without
  deleting or changing those workspaces.
- The implementation was transferred onto current `origin/main` at
  `a89fe881` without copying the old branch or duplicating mechanisms. The only
  merge conflict was the sealed test inventory; it was reconciled to the
  current complete list.
- Focused category, analytics and control coverage passed 132/132. The sealed
  inventory is 330 tests: 277 safe, 49 integration, four artifact-bound and 37
  quick smoke files. `npm run verify:quick` and `npm run verify:full` passed,
  including Project Guardian, TypeScript, ESLint, all safe tests, baseline
  migration validation and the Next.js production build.
- PR `#351` merged as `7e1a08b9`; its Vercel production deployment completed
  and the post-merge Quality Gate run `38770715414` passed.
- The first live readback correctly found a `/creatine` HTTP `500`. Production
  logs proved that the expanded row shape was reading an old v1 lifecycle-cache
  entry. The route now uses `creatine-comparison-v2`, with a regression test
  that prevents the expanded shape from reusing v1. PR `#352` merged as
  `832401ae`; deployment `dpl_6jR2Noz6wRFCjMVWPQhLd2udQtVu` and main Quality
  Gate run `38773042665` passed. The correction changed no catalogue or
  production data.
- All ten reviewed routes returned HTTP `200` and rendered both `Quick decision`
  and `Recommended order` on the final deployment. Whey Protein and Creatine
  clean routes returned `index, follow` with self-canonicals; their sorted
  states returned `noindex, follow` with the clean canonical.
- The final sitemap returned HTTP `200`, contained 1,322 URLs and contained
  Whey Protein and Creatine exactly once each. The first live Whey decision
  linked to `/compare?left=1231`, and that page rendered product `1231` as the
  selected left product.
- Desktop and 390-pixel browser checks rendered the decision layer and controls.
  The existing wide comparison table retains its explicitly tested horizontal
  scroll container on narrow screens, so the full product-link path remains
  available rather than being removed or truncated.
- Consent refusal remained stored through the existing versioned consent owner,
  suppressed the initial banner after reload and left navigation functional.
  Allowlist and consent behavior passed the focused and full automated tests;
  no personal fields or second analytics queue was introduced.
- Release A is therefore `LIVE VERIFIED`. The next active UX-retention unit is
  Release B, My Supplements MVP, starting with a fresh repository/production
  duplication audit before implementation.

## 4. Release B — My Supplements MVP

### 4.1 Product boundary

Create a user tool, not a medical plan or recommendation engine. The page
should be English-language, accessible without an account and deliberately
`noindex, follow`. It is not a new comparison/category/brand/retailer hub and
must not enter the public lifecycle hub registry or sitemap. Add an explicit
route-policy test so this is intentional rather than an accidental omission.

Entry points:

- product page: `Save to My Supplements` for the exact selected variant;
- eligible category decision card: same action after Release B ships;
- global navigation/home: `My Supplements`, displaying a local saved count.

### 4.2 Local schema and privacy

Use one versioned local-storage document, owned by a single module. Minimum
stored fields:

- schema version;
- canonical product ID and slug;
- exact variant ID when selected;
- display snapshot (name, brand, exact pack label);
- units/grams remaining or a reviewed fraction of the exact pack;
- user-entered daily use in the same compatible unit;
- start/count date;
- optional reorder buffer days;
- optional last price paid and currency;
- created/updated timestamps.

Do not store health conditions, medication, pregnancy status, free-text health
goals or inferred medical advice. Notes are excluded from the MVP. Invalid,
oversized, unknown-version or structurally incomplete imports fail closed with
a useful message and do not overwrite the current stack.

### 4.3 Current-data reconciliation

Local snapshots are never presented as current facts. Reuse canonical public
product/offer rules through one bounded read-only endpoint or server action
that accepts a capped set of product/variant IDs and returns only:

- canonical identity and exact variant/pack match state;
- current presentation state;
- current best known delivered price and its breakdown;
- retailer name/count and last check time;
- verified pack/serving metrics needed for cost calculations.

The endpoint must use the existing loaders/classifiers, enforce an input cap,
reject malformed IDs, expose no private evidence and perform no database
write. Stale, OOS, unresolved or unknown-delivery offers cannot be represented
as a current delivered-price winner.

### 4.4 Calculations and labels

- Run-out date = count date plus complete usable days at the user-entered daily
  use. Round conservatively and label it an estimate.
- Reorder-by date = run-out date minus the user-selected buffer. Default to
  three calendar days and explain that this is not a retailer delivery promise.
- Daily/monthly/yearly cost uses the user's last price paid when supplied;
  otherwise use the current known delivered total and label the source/date.
- Monthly = daily × 30; yearly = daily × 365. Never imply a subscription or
  guaranteed future price.
- Incompatible or missing units produce an incomplete state, not a converted
  guess.
- A current cheaper option is reported only for the same exact variant/pack
  under the existing identity and delivery rules.

### 4.5 Export and sharing

- Export: downloadable versioned JSON containing only the local document,
  after a preview of included fields.
- Import: schema validation, size/count limits, preview and explicit replace or
  merge choice; never silent overwrite.
- Sharing MVP: use the Web Share API for a product or a deliberately generated
  minimal list of canonical product/variant IDs. Do not place price history,
  remaining quantity, daily use, dates or last price paid in a URL.
- A full cross-device account sync is explicitly out of scope until the local
  utility demonstrates value and receives separate privacy/security design.

### 4.6 Release-B analytics

Consent-aware events use counts and controlled enums, not personal stack data:

- `save_supplement`: product ID, category, entry point;
- `remove_saved_supplement`: product ID, source page;
- `view_my_supplements`: item-count band and reconciliation state;
- `update_supply_estimate`: calculation state only;
- `export_my_supplements` / `import_my_supplements`: item-count band and result;
- `select_my_supplements_offer`: product ID, retailer ID, position and freshness
  state using the existing retailer-click boundary.

The events support save-to-return and stack-to-retailer funnels. GA4 returning
user evidence may be used for 7/30-day analysis only after traffic-quality and
consent limitations are stated. No deterministic cross-device identity is
introduced.

### 4.7 Release-B proof

Required local proof:

- storage schema, migration, corruption, quota/failure and no-window tests;
- exact-variant save/dedupe/remove behavior;
- run-out/reorder calculations across dates, fractional remainder and invalid
  units;
- endpoint input cap, malformed IDs, partial data and private-field exclusion;
- current/stale/OOS/unresolved/unknown-delivery reconciliation tests;
- import/export round trip, invalid import and non-destructive preview tests;
- noindex/canonical/sitemap policy test;
- keyboard, focus, live-region and reduced-motion checks;
- analytics privacy/consent tests;
- `npm run verify:quick`, then `npm run verify:full` before completion.

Required live proof:

- save an exact production product/variant, refresh and confirm persistence;
- produce and verify a run-out estimate and current delivered-price readback;
- confirm stale/unavailable evidence remains unavailable rather than reusing a
  saved old price;
- export/import a non-sensitive sample and verify identical safe state;
- confirm route is `noindex, follow`, absent from sitemap and linked from the
  approved entry points;
- verify rejection and acceptance analytics behavior independently.

### 4.8 Release B live verification checkpoint — 15 October 2026

Release B is deployed and `LIVE VERIFIED`.

- A fresh repository search confirmed there was no existing saved-supplement,
  run-out, reorder, export/import or Web Share owner. The existing exact-variant
  selection, pricing, nutrition, freshness and consent-aware analytics
  mechanisms were retained rather than replaced.
- `app/lib/mySupplements.ts` is the single versioned local-storage owner. It
  caps the list at 30 exact product/variant pairs and rejects malformed,
  oversized, duplicate or unknown-version documents without overwriting the
  current list. Health conditions, medication, pregnancy, goals and notes are
  not stored.
- `/api/my-supplements/current` is a bounded, read-only reconciliation route.
  It accepts only numeric product/variant pairs, returns no private evidence,
  sends private/no-store and noindex headers, and has no database mutation
  path. Its shared server owner reuses the existing freshness, delivered-price,
  effective-nutrition and exact-pack helpers. Stale, OOS and unknown-delivery
  offers cannot become the current winner.
- `/my-supplements` is an account-free English user tool with explicit
  `noindex, follow`, a clean canonical and an explicit test proving it is absent
  from the sitemap and lifecycle-hub registry. A global local-count shortcut,
  exact product-page save action and category decision-card entry point use the
  same storage owner.
- The local UI supports remaining amount, same-unit daily use, conservative
  complete-day run-out and reorder estimates, optional last price paid,
  current exact-variant delivered-price readback and verified recurring cost.
  Missing or incompatible evidence stays incomplete rather than being guessed.
- Export has an explicit field preview before downloading versioned JSON.
  Import validates first and requires an explicit merge or replace choice.
  Sharing sends canonical product/variant links only; remaining amounts, use,
  dates and entered prices are excluded.
- Analytics extends the existing typed consent-aware dispatcher. Stack views
  use count bands; estimate, export/import and sharing events use controlled
  states only. No second queue or deterministic cross-device identity was
  added.
- Focused tests, TypeScript and ESLint pass. The resealed quality inventory is
  331 tests: 278 safe, 49 integration, four artifact-bound and 38 quick. Both
  `npm run verify:quick` and the isolated `npm run verify:full` passed,
  including the production build.
- A real local production build using the existing read-only production data
  connection returned HTTP `200` for the product, category, My Supplements,
  current-data API and sitemap paths. A browser saved exact product `1231`,
  variant `3653`, refreshed the page and retained the entry. Run-out, reorder,
  recurring cost, current delivered price and export preview all rendered. The
  API returned an exact match and current price with `private, no-store` and
  `noindex, nofollow, noarchive` headers. At 390 pixels the page had no
  horizontal overflow. `/my-supplements` rendered `noindex, follow`, a clean
  canonical and remained absent from the sitemap.
- PR `#354` merged as `3d68fc4c`. Main Quality Gate run `38778892879` passed,
  and production deployment `dpl_FFfq3Ch9q4jmTEmEtvD6Q9CgEXHV` reached Ready
  and was assigned to `https://www.supplementscout.co.uk`.
- Independent production browser proof repeated the exact product `1231`,
  variant `3653` flow. The saved item and its remaining amount, daily use and
  optional last price survived a reload. Run-out, reorder, monthly cost,
  current exact-variant price and the private export preview all rendered.
- The production reconciliation API returned HTTP `200`, an exact variant
  match and a current price, with `private, no-store` and
  `noindex, nofollow, noarchive` headers. The page rendered without horizontal
  overflow at 390 pixels.
- `/my-supplements` returned HTTP `200`, `noindex, follow` and its clean
  canonical, and remained absent from the sitemap. The live product and Whey
  Protein category entry points both rendered their save actions.
- Analytics was checked independently in both consent states. Rejection stored
  denied consent and emitted no events. Acceptance stored granted consent and
  emitted `view_my_supplements` through the existing dispatcher.
- Release B is therefore `LIVE VERIFIED`. Phase 1 is complete. The next active
  UX-retention unit is the first clean measurement window in section 5. No
  alert implementation starts until a fresh repository, evidence and
  production audit confirms its boundary and any required owner decision.

## 5. UX success and guardrails

Initial success is instrumented utility, not an invented conversion uplift.
For the first clean 28-day window after each release, report:

- category decision impression → product selection rate;
- category decision → add-to-comparison rate;
- started → completed two-product comparison rate;
- product/category view → save rate;
- save → later My Supplements view rate;
- My Supplements view → retailer click rate;
- consent-aware returning users at 7 and 30 days, with traffic-quality caveats;
- error, empty and incomplete-evidence state rates.

Guardrails:

- retailer click-through must remain functional without analytics;
- no increase in stale/unknown-delivery winner exposure;
- no reduction in crawlable product links or lifecycle correctness;
- no new production write path, identity mutation or mandatory account;
- no claim that a price fell until SEO-15 historical evidence permits it;
- no unsupported medical, quality, effectiveness or popularity ranking.

The first report sets a defensible baseline. An uplift target may be approved
only after enough external traffic exists; low or contaminated samples remain
explicitly inconclusive.

### 5.1 Measurement implementation checkpoint — 15 October 2026

The existing authenticated, read-only Growth Analytics report is being extended
for the first clean UX window; no second reporting system is being created.

- The exact first window is 15 October through 11 November 2026, 28 calendar
  days. Reports state `COLLECTING` until all 28 days exist and never turn
  missing or immature data into zero-performance claims.
- The existing consent-aware dispatcher adds an explicit search-result
  selection event without raw search text. My Supplements adds bounded return
  events after six hours, seven days and 30 days, using only the existing item
  count band and no saved product, usage, price or health data.
- The existing report reads event and same-GA4-user funnel evidence for category
  decision selection, comparison completion, search to product, product to
  retailer, My Supplements to retailer and save to return. It makes no
  cross-device or account-identity claim.
- Seven- and 30-day return results remain explicitly right-censored until each
  save has had the full observation opportunity. Threshold return events are
  reported separately, and no uplift claim is allowed from an immature or
  contaminated sample.
- The implementation changes no catalogue, price, SEO route, GA4 setting or
  production data. Local focused tests, TypeScript, ESLint and
  `npm run verify:quick` pass. Deployment and authenticated production-readonly
  API proof remain required before this measurement instrumentation is closed.

## 6. Approved implementation sequence

Only one bounded implementation is active at a time:

1. owner approved a separate product UX release on 15 October 2026;
2. `npm run verify:project` passed before the status edit: 19 SEO tasks, SEO-15
   next and no SEO implementation in progress;
3. record this product-work classification without weakening SEO-15 or
   reopening completed work;
4. implement and live-verify Release A;
5. record evidence and close Release A;
6. implement and live-verify Release B;
7. run the first clean measurement window and record limitations;
8. return to the binding sequence or request the next explicit owner decision.

### Mandatory reuse and anti-spaghetti gate

Before starting every numbered implementation step, perform and record a
current-state audit covering the repository, relevant execution evidence and
the production readback. Search for the capability by behavior as well as by
the proposed name. A conversation summary, an old plan or an assumed missing
feature is never proof that it still needs to be built.

The implementation must extend the established owner of each concern:

- category selection and metrics: `app/lib/categoryComparison.ts` and the
  existing route-specific comparison modules;
- offer freshness and presentation: the shared offer classifier and pricing
  helpers;
- two-product selection: the existing `/compare` route and
  `app/lib/twoProductComparison.ts`;
- lifecycle, cache, robots, canonical, sitemap and failure behavior: the
  existing lifecycle registry/helpers and route contracts;
- analytics: the existing consent-aware typed allowlist;
- saved-stack state: one new versioned storage module only, reused by every
  entry point and the My Supplements page.

Do not create a parallel comparison engine, second price/freshness classifier,
route-local indexability rule, duplicate cache, second analytics dispatcher,
multiple local-storage documents for the same stack, or another product
identity model. Route components may compose shared behavior but must not own
business rules that another route will need.

If an existing mechanism cannot safely support a required behavior, stop that
part of implementation and document: the exact missing contract, why extending
the current owner is unsafe or impossible, the smallest proposed shared change,
and its regression surface. A new abstraction is allowed only after that gap
is evidenced and must replace duplication rather than sit alongside it.

Every handoff includes a duplication check showing the searched paths/symbols,
the reused owners, any removed duplication and focused regression coverage.
Passing tests without this audit is not sufficient evidence of maintainability.

Later goal phases — evidence-backed alerts, basket optimization and the finder
— remain outside Phase 1. They must reuse the shipped mechanisms and receive
their own current-state audit. Nothing in this pack authorizes production data
writes, price-history claims, email delivery or health recommendations.

## 7. Owner decision — resolved

The owner selected **separately scoped product UX release** by explicitly asking
to continue this goal after the separate nutrition work completed. Release A
may proceed while SEO-15 is blocked. It is not a new SEO task, does not change
the SEO-15 → SEO-17 order and cannot run beside a later active SEO
implementation. Category work still receives lifecycle and SEO contract tests.
