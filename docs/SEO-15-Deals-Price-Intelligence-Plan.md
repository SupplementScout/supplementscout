# SEO-15 Deals and Price Intelligence — Technical Execution Plan

**Prepared:** 24 August 2026  
**State:** Stage 1 live verified; corrective Indexability Lifecycle P0 is
`CODE COMPLETE`, live evidence pending; Stages 2 and 3 not started
**Authority:** `docs/SEO-Execution-Plan.md` remains the SEO status and ordering
authority. `docs/SupplementScout-Operating-Plan-2026-07-15.md` remains the
project authority. This document records only SEO-15 technical scope, gates,
decisions and evidence.

## 1. User goal

Build one truthful `/deals` decision page that helps a user distinguish:

1. **Best prices today** — the lowest current delivered price among tracked
   retailers for the same exact variant and pack.
2. **Verified price drops** — a current delivered price that is demonstrably
   lower than a sufficiently observed earlier price for the same offer,
   retailer product, canonical product, exact variant and pack fingerprint.
3. **Exceptional market value** — a current delivered price materially below
   a stable, same-pack market reference supported by at least three retailers.

A low current price is not a historical price drop. Unknown delivery, stale
offers, unresolved variants, pack drift and legacy history are hidden rather
than estimated.

The public wording must describe tracked retailers and must not claim every UK
deal or the whole UK market.

## 2. Scope and non-goals

### In scope

- one central price-intelligence module with selectors separate from rendering;
- one central identity-proven observation path built on the existing offers,
  `price_history`, importer plans and atomic RPCs;
- one `/deals` URL with three independently gated sections;
- existing 24-hour freshness, delivered-price, exact-variant, comparison-card,
  analytics, schema and sitemap-readiness mechanisms;
- additive, nullable identity evidence for future history records without a
  legacy backfill;
- fail-closed queries, section gates, indexability and public empty states;
- separate commits and rollback boundaries for each stage.

### Out of scope

- a second offers table, price-history store, importer or deals workflow;
- indexable filters, query-parameter pages, retailer/brand variants or mass
  programmatic pages;
- inferred recommended retail prices, crossed-out prices, `was/now`, savings
  from an unsupported reference price or `lowest ever` claims;
- rewriting legacy history, mutating old identity snapshots or backfilling
  unprovable pack identity;
- expanding retailer manifests without the existing identity review;
- running historical eBay batch/recovery workflows;
- changing product identity, mappings, offers, prices or production data as
  part of page implementation;
- changing the owner-deferred GYM HIGH publication decision or the paused
  outreach decision.

## 3. Existing mechanisms to reuse

The repository already has the following foundations. They must not be rebuilt:

- `offers` is the current commercial state and `price_history` is the existing
  historical store;
- `app/lib/pricing.ts` supplies the fail-closed `getDeliveredPrice` helper;
- `app/lib/offerFreshness.ts` supplies the shared 24-hour current-offer rule;
- `app/lib/categoryComparisonVariants.ts` resolves an offer through its exact
  `retailer_product` to the bound canonical variant and marks unresolved rows;
- `app/lib/categoryComparison.ts` already filters current in-stock offers,
  sorts by delivered price and exposes reusable page/readiness summaries;
- `app/lib/sitemapReadiness.ts`, `app/lib/sitemapIndexability.ts` and
  `app/sitemap.ts` already implement dynamic sitemap eligibility;
- existing category, brand and retailer pages provide canonical, robots,
  CollectionPage, ItemList, BreadcrumbList, cards, affiliate-click analytics
  and visible last-checked patterns;
- product pages already render legacy daily price charts, lowest recorded and
  average recorded prices from `price_history`;
- guarded import plans and `apply_approved_product_import_plan` already apply
  offer changes and price-history writes atomically;
- active retailer refreshers already have source drift, replay, mass-change,
  OOS, price-anomaly and recovery controls.

Current history is change-oriented: a price/delivery change creates a history
row, while a verified no-change refresh keeps `price_history.action = noop`.
That is enough for the existing chart but cannot prove that an unchanged price
remained in force for seven days. SEO-15 must extend this path, not create a
parallel one.

## 4. Anti-spaghetti architecture rules

1. `app/lib/dealsPriceIntelligence.ts` is the proposed single selector and
   threshold module. UI code receives qualified view models; it does not
   reconstruct eligibility.
2. One database recorder is responsible for every new identity-proven history
   observation. Importers describe source and observation kind but do not
   insert bespoke rows.
3. Thresholds live in one exported immutable contract used by selectors,
   readiness, sitemap and tests.
4. Exact identity resolution happens before price comparison. Presentation
   cannot weaken it.
5. `/deals` is read-only. It never triggers collection, refresh or writes.
6. Missing fields, query errors and conflicting identity produce no claim.
7. Each stage is independently releasable and reversible. Stage 3 cannot be
   enabled merely because Stage 1 is live.

## 5. Current read-only coverage baseline

Production read captured at `2026-08-24T08:18:23.231Z` found:

| Boundary | Products | Offers | Retailers | Products with 2+ retailers |
|---|---:|---:|---:|---:|
| Active canonical catalogue | 1,070 | 2,761 total | 10 | not used as a deals gate |
| Current exact bindings, in stock, known delivery, <=24h | 617 | 1,317 | 8 | 50 |
| Strict active variant with positive `pack_count`, `size_value` and `size_unit` | 216 | 870 | 7 | 18 |
| Strict same-pack products with 2+ current retailers | 18 | 144 | 7 | 18 |

The strict multi-retailer rows span retailer IDs `1`, `3`, `4`, `5`, `9`,
`10` and `12`. The broad fresh count is not permission to publish rows lacking
an exact pack. Coverage is recalculated at request time; these numbers are an
audit baseline, not hard-coded content.

## 6. Stage 1 — Best prices today

### Selection contract

A candidate must have all of the following:

- active, unmerged canonical product and active exact canonical variant;
- offer, mapping, product and variant foreign keys that agree exactly;
- stable external product and external variant identities;
- positive `pack_count`, positive `size_value` and a supported `size_unit` on
  the exact variant;
- current offer in stock and checked no more than 24 hours ago;
- positive product price, known non-negative shipping and calculable delivered
  price through `getDeliveredPrice`;
- valid retailer and destination URL;
- the same exact canonical variant represented by at least two current
  retailers before it can be called the best tracked price.

Group first by canonical product and exact variant. Compare only offers inside
the same group. Choose the lowest delivered offer with stable tie-breakers. If
more than one exact variant group qualifies for a canonical product, choose one
deterministically by retailer depth, offer depth, delivered total and variant
ID. Render at most one best offer per canonical product and state the selected
variant/pack visibly.

### Proposed production readiness gate

The gate is derived from minimum page utility, not selected to match the
current result:

- at least **12** visible exact-pack products;
- at least **30** qualifying fresh offers before best-offer reduction;
- at least **4** retailers across the qualifying comparisons;
- every visible product has at least two retailers for the selected exact
  variant/pack;
- valid structured data and no selector/query error.

The current strict baseline (`18 / 144 / 7`) passed the launch gate. After the
owner-approved launch, this gate remains quality monitoring and does not switch
the `live_verified` base URL between index/noindex or remove it from the
sitemap. Freshness drift still hides unsafe rows and can produce an honest
limited or empty state.

### Public contract

- canonical is exactly `/deals`;
- only one public URL; filter and sort parameters canonicalize to `/deals` and
  are not indexable or emitted in the sitemap;
- CollectionPage, ItemList and BreadcrumbList JSON-LD describe only visible
  rows;
- visible product price, shipping, delivered total, retailer and exact check
  date/time must agree with the selected offer;
- explain that results cover tracked retailers and are current at the shown
  check times;
- do not show `price drop`, prior price, saved amount, crossed-out price or
  lowest-ever wording in Stage 1;
- stale, out-of-stock, unknown-shipping, unresolved and pack-uncertain rows are
  excluded;
- a full or proven-partial query failure aborts rendering as HTTP 5xx rather
  than returning cached or partial claims as a successful empty page.

### Stage 1 implementation boundary

No importer, workflow, table or migration changes. Reuse the existing page
quality and analytics contracts. Expected application files after approval are:

- new `app/lib/dealsPriceIntelligence.ts`;
- new `app/deals/page.tsx`;
- focused selector/page tests under `scripts/`;
- bounded additions to `app/lib/sitemapReadiness.ts`, `app/sitemap.ts` and
  controlled existing navigation/internal-link locations;
- `scripts/quality-gate-manifest.json` only if a new test file requires reseal.

## 7. Stage 2 — Identity-proven price observations

### Legacy versus proven evidence

- A legacy row has `identity_version IS NULL`. It remains available to current
  product charts but cannot qualify a verified drop or exceptional-value claim.
- An identity-proven row has a supported identity version, complete immutable
  snapshot, valid stable fingerprint and accepted observation kind. Only these
  rows may feed future historical claims.
- No old row is inferred, rewritten or backfilled.

### Recommended minimal schema

Add nullable columns to the existing `price_history` table:

| Column | Type | Purpose |
|---|---|---|
| `identity_version` | `smallint` | `NULL` means legacy; initial proven contract is `1`. |
| `identity_snapshot` | `jsonb` | Immutable IDs, external identities, pack measure and source/importer evidence at observation time. |
| `pack_fingerprint` | `text` | SHA-256 of canonical versioned identity/pack JSON, excluding price and time. |
| `observation_kind` | `text` | `offer_created`, `price_change` or `daily_confirmation`. |
| `source_run_id` | `text` nullable | Add only if the existing approved-plan/run ledgers cannot provide an unambiguous join. |

Keep existing `offer_id`, `price`, `shipping_cost`, `total_price` and
`checked_at` as the delivered-price components and measurement timestamp. Do
not duplicate them inside the identity JSON.

`identity_snapshot` version 1 must contain:

- canonical `product_id`, `product_variant_id`, `retailer_product_id`,
  `offer_id` and `retailer_id`;
- external product and variant IDs used by the importer;
- exact `pack_count`;
- one appropriate pack measure: `net_weight_g`, `net_volume_ml`, or
  `unit_count` plus `unit_type`;
- canonical variant `size_value`, `size_unit` and product format where present;
- source/importer name and the protected run/plan reference when available;
- no secret, credential, authorization header or raw source payload.

The fingerprint is the SHA-256 of canonical JSON containing identity version,
all canonical/external identity keys and pack fields. A rebind, merge target,
variant change, pack-size change or unit change creates a new fingerprint. Old
snapshots are never updated.

### Central recorder

Create one guarded database function, called inside the same transaction as the
existing atomic offer apply. It validates the current offer, mapping, product,
variant and plan identity; builds the immutable snapshot and fingerprint; and
inserts one proven observation when all evidence is complete.

- Offer creation records `offer_created`.
- A delivered-price component change records `price_change`.
- A successful unchanged check may record at most one `daily_confirmation` per
  offer/fingerprint/UTC day.
- A second real price change on the same day may still record a distinct
  `price_change`.
- Incomplete identity either writes a legacy-compatible price row where the
  existing business contract requires it or writes no confirmation; it never
  marks the row identity-proven.
- Offer update and observation insert succeed or roll back together.

All active importer/refresh paths must reach this recorder through the existing
approved plan/RPC path. Historical one-time batch executors are not eligible to
create proven observations. No new scheduler is introduced.

### Observation volume and accrual

At one daily confirmation per offer, the absolute current ceiling is
`2,761 x 30 = 82,830` rows/month. Using the 24 August automation-audit fresh
scope of 1,636 offers gives an indicative `49,080` rows/month; limiting proven
recording to today's 870 strict exact-pack offers would be `26,100` rows/month.
Before migration approval, rerun the exact active-scope count and estimate JSONB
storage/index growth from a sample snapshot.

Three different observation days can accrue in three days, but the minimum
14-day history and seven-day prior-price proof mean a verified drop cannot
qualify earlier than day 14, and only if a real price change occurs. Treat
30 days as the first useful production review and 60 days as the stronger
stability review; neither duration guarantees that a genuine drop will occur.

## 8. Stage 3 — Verified drops and exceptional market value

### Verified price drop contract

Every condition is mandatory:

- same `offer_id`, retailer, retailer product, canonical product, exact product
  variant and pack fingerprint throughout the comparison;
- current offer is in stock, <=24h fresh and has complete delivered price;
- at least 3 identity-proven observations on different UTC dates;
- at least 14 elapsed days between first qualifying observation and now;
- the comparison price is confirmed as continuously applicable for at least
  7 days by daily confirmations, with no conflicting observation;
- current delivered price is at least **GBP 2.00** and **10%** lower;
- latest proven observation equals the current offer state;
- no identity reset, pack change, anomalous value, source drift or quick
  decrease-and-return pattern;
- missing evidence means not qualified.

The first selector should compare against the most recent stable prior price,
not choose a convenient high outlier. `Lowest ever` remains prohibited unless a
separate future contract can prove complete lifetime coverage.

### Exceptional market value contract

- same exact variant and pack across at least 3 current retailers;
- every compared offer is in stock, <=24h fresh and has known delivery;
- current delivered price is at least 10% below a robust same-pack median or
  separately approved stable trend;
- enough identity-proven observations and elapsed history exist to reject a
  one-off source error;
- no historical `was/now` or saving claim is shown;
- fewer than three valid retailers, a tied/unstable reference or any uncertain
  pack hides the classification.

### Independent section gates

- `Best prices today` may make the page indexable using the Stage 1 gate.
- `Verified price drops` is hidden when zero rows qualify; it does not block a
  truthful Stage 1 page.
- `Exceptional market value` is hidden when its own evidence gate fails.
- Empty states never imply that no deals exist outside tracked retailers.

Run recorded evidence audits at 7, 14, 30 and 60 days after proven recording
starts. Do not enable either historical section before its audit passes.

## 9. Retailer automation dependency baseline

GitHub Actions is the only confirmed scheduler. No Vercel Cron or Supabase Cron
is currently confirmed for retailer refresh. A normal 30–60 minute GitHub cron
delay is not itself a failure.

| Retailer/source | Current state | Existing schedule/path | SEO-15 action |
|---|---|---|---|
| GYM HIGH | HEALTHY; publication remains owner-deferred | source monitor `03:43` and `15:43` UTC; reviewed refresh `04:13` UTC | Reuse only; do not change publication status. |
| Simply Supplements | HEALTHY | `05:07` UTC daily | Route proven observations through the central recorder. |
| Fit House | HEALTHY | `02:47` UTC daily | Reuse the current guarded refresh. |
| Jon's Supplements | HEALTHY | `04:47` UTC daily | Reuse the current guarded refresh. |
| Whey Okay | PARTIAL | `02:17` UTC daily | Keep unresolved/no-source rows excluded. |
| Discount Supplements | PARTIAL | `06:47` UTC daily | Current good checks may accrue; source gaps remain excluded. |
| Dolphin Fitness | PARTIAL | `05:27` UTC daily | Keep bounded vegan scope; no manifest expansion. |
| eBay UK | PARTIAL | central refresh `05:43` UTC daily | Full read-only pass remains pending; do not run historical batch workflows. |
| KIOR Health | MANUAL | no confirmed dedicated scheduled refresh | Does not block Stage 1 if the page gate passes without it. |
| 6 Pack Supplements | PARTIAL; recovery closeout in progress | `03:17` UTC daily | Resolve the reviewed 14-row evidence separately before normal write recovery. |

Automation gaps block broad historical claims for affected offers but do not
block a fail-closed Stage 1 page if its exact fresh gate passes from healthy
current rows. Do not expand any manifest merely to increase `/deals` coverage.

## 10. Six Pack 14-row evidence review

### Source and safety state

- hardened code commit: `0845f01c76ac0587e439c4d1242cc2cacb04eac4`;
- manual dry-run: GitHub Actions run `32703134106`, `PASS_WITH_REVIEW`;
- source coverage: `279/279` pages and `506/506` approved offers;
- classification: 492 no change, 14 review; 13 price changes, 6 stock changes,
  5 newly out of stock;
- MASS_CHANGE and MASS_PRICE passed; MASS_OOS stopped apply;
- `database_writes: 0`; apply and idempotency were skipped;
- production remains at 506 mappings and 506 offers with no binding mismatch.

An independent read at `2026-08-24T08:15:29Z`–`08:15:32Z` fetched the three
affected source pages. Each returned HTTP 200 at the stored canonical URL with
no redirect. Current page hashes were:

- product `16448`: `5fce9d29583b7e523c23ab793bf9ce8cae6e31f411b530956d5464730567e967`;
- product `3980`: `53cf1df817612e128c4d1c13dc0959f28f689005bea2bea7aab4919f7c3a1fe9`;
- product `3870`: `39057be91d8ae661aa590a22e5d39a275ca16ac41913ea243f15bfd74e7f2875`.

All 14 database product/variant/mapping/offer bindings agreed with the source
external product and variation IDs. `APPROVE_*` below is an evidence
classification, not production-apply authority.

| Offer / mapping | Canonical product and exact variant | Source URL | DB -> source price | Delta | Stock DB -> source | Classification |
|---|---|---|---:|---:|---|---|
| `2006 / 2192` | `982` Nordic Labs Long Jack Tongkat Ali 60 Capsules; variant `1922` Default; external `16448 / 16448` | `https://6pack-supplements.co.uk/product/tongkat-ali-long-jack-60-capsules/` | GBP 20.00 -> GBP 20.00 | GBP 0.00 / 0.00% | in -> out | `APPROVE_STOCK` |
| `2027 / 2213` | `68` 7Nutrition Whey Isolate 90 1kg; `940` White Chocolate / 1000g; external `3980 / 3989` | `https://6pack-supplements.co.uk/product/whey-isolate-90-1000g-7nutrition/` | GBP 41.99 -> GBP 44.99 | +GBP 3.00 / +7.14% | in -> in | `APPROVE_PRICE` |
| `2028 / 2214` | `68`; `939` Vanilla / 1000g; external `3980 / 3992` | same verified product URL `3980` | GBP 41.99 -> GBP 44.99 | +GBP 3.00 / +7.14% | in -> in | `APPROVE_PRICE` |
| `2029 / 2215` | `68`; `1966` Banana / 1000g; external `3980 / 3995` | same verified product URL `3980` | GBP 41.99 -> GBP 44.99 | +GBP 3.00 / +7.14% | out -> in | `APPROVE_PRICE_AND_STOCK` |
| `2030 / 2216` | `68`; `937` Natural / 1000g; external `3980 / 5962` | same verified product URL `3980` | GBP 41.99 -> GBP 44.99 | +GBP 3.00 / +7.14% | out -> out | `APPROVE_PRICE` |
| `2031 / 2217` | `68`; `938` Strawberry / 1000g; external `3980 / 5963` | same verified product URL `3980` | GBP 41.99 -> GBP 44.99 | +GBP 3.00 / +7.14% | out -> out | `APPROVE_PRICE` |
| `2032 / 2218` | `14` BioTech USA Iso Whey Zero 908g; `1727` Cookies & Cream / 908g; external `3870 / 3872` | `https://6pack-supplements.co.uk/product/iso-whey-zero-908g-biotechusa/` | GBP 39.99 -> GBP 44.99 | +GBP 5.00 / +12.50% | in -> out | `APPROVE_PRICE_AND_STOCK` |
| `2033 / 2219` | `14`; `1724` Vanilla / 908g; external `3870 / 3875` | same verified product URL `3870` | GBP 39.99 -> GBP 44.99 | +GBP 5.00 / +12.50% | in -> in | `APPROVE_PRICE` |
| `2062 / 2248` | `68`; `1997` Raspberry / 1kg; external `3980 / 3988` | same verified product URL `3980` | GBP 41.99 -> GBP 44.99 | +GBP 3.00 / +7.14% | in -> in | `APPROVE_PRICE` |
| `2063 / 2249` | `68`; `1998` Cookies & Cream / 1kg; external `3980 / 3994` | same verified product URL `3980` | GBP 41.99 -> GBP 44.99 | +GBP 3.00 / +7.14% | in -> out | `APPROVE_PRICE_AND_STOCK` |
| `2064 / 2250` | `14`; `1999` Chocolate / 908g; external `3870 / 3873` | same verified product URL `3870` | GBP 39.99 -> GBP 44.99 | +GBP 5.00 / +12.50% | in -> out | `APPROVE_PRICE_AND_STOCK` |
| `2065 / 2251` | `14`; `2000` Dark Chocolate / 908g; external `3870 / 28741` | same verified product URL `3870` | GBP 39.99 -> GBP 44.99 | +GBP 5.00 / +12.50% | in -> out | `APPROVE_PRICE_AND_STOCK` |
| `2066 / 2252` | `14`; `2001` Salted Caramel / 908g; external `3870 / 28744` | same verified product URL `3870` | GBP 39.99 -> GBP 44.99 | +GBP 5.00 / +12.50% | in -> in | `APPROVE_PRICE` |
| `2422 / 2608` | `68`; `1967` Belgian Chocolate / 1000g; external `3980 / 3991` | same verified product URL `3980` | GBP 41.99 -> GBP 44.99 | +GBP 3.00 / +7.14% | out -> out | `APPROVE_PRICE` |

No row is classified `REJECT_SOURCE_ANOMALY`, `BLOCK_IDENTITY_DRIFT` or
`NEEDS_OWNER_REVIEW` on the captured evidence. Price increases remain below the
existing per-row hard anomaly thresholds. Shipping remains GBP 4.99, so the
delivered totals move from GBP 46.98 to GBP 49.98 for 7Nutrition and from
GBP 44.98 to GBP 49.98 for BioTech USA. Tongkat Ali remains GBP 24.99 delivered.

### Exact effect of current apply selectors

- `operation=apply` runs the ordinary isolated preflight. For run `32703134106`
  MASS_OOS quarantined all 14 changed rows, leaving 492 no-change plans in the
  artifact. The executor filters those verification plans, so this exact
  artifact would execute zero business changes. It does not approve the 14.
- `operation=reviewed-mass-oos-apply` is bound to selector
  `2026-08-11-whey-isolate-stock` and a sealed two-row historical scope expecting
  offers `2029` and `2422` at GBP 41.99 with stock `true -> false`. The current
  14-row source/state does not match that contract. The reviewed source/scope
  checks would stop before apply; it cannot authorise today's rows.
- Any future apply of the reviewed 14 needs a new explicit owner decision and
  an existing guarded plan that exactly represents the approved rows. SEO-15
  planning grants no such permission.

## 11. Migration and rollback plan

Stage 2 requires separate owner approval before any migration.

1. Add nullable columns, narrow check constraints and supporting partial
   indexes in one new forward migration. Do not edit historical migrations.
2. Add the central recorder and update the current atomic approved-plan path to
   call it for create, price change and bounded daily confirmation.
3. Rehearse on an isolated database with legacy rows, proven rows, replay,
   rollback and expected row-volume fixtures.
4. Deploy schema first with producers disabled; verify existing charts and
   import plans unchanged.
5. Enable proven recording through existing active refresh paths only after
   exact postflight evidence.

Before the first proven production row, rollback may drop the new function,
indexes, constraints and nullable columns. After accrual begins, the safe
rollback is to disable the producer and Stage 3 selectors while preserving the
additive columns and evidence; do not destroy accrued identity snapshots merely
to revert application behavior. Existing offer and legacy chart data remain
authoritative throughout.

## 12. Required tests and gates

### Stage 1

- exact offer/mapping/product/variant binding and pack resolution;
- same-variant retailer grouping and one deterministic best row per product;
- unknown shipping, stale, out-of-stock, invalid URL and unresolved pack
  exclusions;
- delivered-price ordering and stable ties;
- readiness pass/fail, query-error fail-closed, canonical, robots, sitemap,
  JSON-LD, parameter noindex and internal links;
- zero price-drop or unsupported savings wording.

### Stage 2

- identity snapshot contract and secret rejection;
- stable fingerprint for identical identity and a changed fingerprint for every
  product, variant, retailer-product, external identity, pack or unit change;
- legacy rows remain unproven without backfill;
- offer update plus observation are atomic and roll back together;
- one daily confirmation per offer/fingerprint/day, with a real same-day price
  change still recorded;
- no-change checks update `last_checked_at` and can prove continuity;
- merge/rebind never mutates an old snapshot;
- incomplete identity fails closed;
- every active importer reaches the same recorder; historical batch executors
  cannot create identity-proven rows;
- existing product charts and current guarded apply/idempotency behavior remain
  compatible.

### Stage 3

- same-fingerprint-only comparisons;
- 3 different days, 14 elapsed days and 7-day prior-price continuity;
- combined GBP 2 and 10% drop threshold;
- latest-observation equality, identity reset, anomaly and quick-return blocks;
- exceptional-value three-retailer, median and 10% rules;
- independent section gates and empty states.

For every code/workflow stage run focused tests, TypeScript, Project Guardian,
`npm run verify:quick`, `npm run verify:full` and a production build. Review and
reseal `scripts/quality-gate-manifest.json` whenever test inventory changes.
Migration integration tests remain isolated and receive no production-write
credentials.

## 13. Decision register

| Decision | State | Required owner action |
|---|---|---|
| Use one existing offers/history system and one central recorder | Proposed | Approve technical plan. |
| Stage 1 gate `12 products / 30 offers / 4 retailers`, with 2+ retailers per exact variant | Approved launch evidence; monitoring remains active | Do not reuse as an hourly robots/sitemap switch. |
| Classify the 14 Six Pack rows as 1 stock, 8 price and 5 price+stock approvals | Evidence ready; not applied | Approve/reject as a separate production-data action. |
| Add identity-proven nullable history fields with no backfill | Proposed | Separate migration approval after schema diff and rehearsal plan. |
| Record at most one unchanged confirmation/day/offer/fingerprint | Proposed | Approve row volume and retention impact. |
| Enable Stage 3 only after 7/14/30/60-day audits | Proposed | Separate enablement decision after evidence. |
| Roadmap handling during accrual | Undecided | Keep SEO-15 `IN PROGRESS`, or mark it `BLOCKED` with the exact accrual blocker and temporarily advance to SEO-16. Do not introduce a `DATA ACCRUAL` status. |

If SEO-16 is temporarily selected, the ledger must preserve a mandatory return
to SEO-15 Stage 3. No ordering change is made by this plan.

## 14. Blockers register

| Blocker | Affects | Safe response |
|---|---|---|
| Legacy history has no exact identity snapshot | Verified drops/value | Never qualify legacy rows; accrue new proven evidence. |
| Current refresh records changes but not daily unchanged confirmation | 7-day continuity | Stage 2 central recorder; no inferred continuity. |
| Partial/manual retailer automation | Historical breadth | Exclude affected rows; Stage 1 may proceed only if its gate independently passes. |
| Six Pack 14-row recovery is not owner-applied | Six Pack freshness | Keep current DB state and handle through a separate approval. |
| Full eBay read-only pass remains pending | eBay confidence | Do not run it here; exclude stale/unproven rows. |
| Stage 2 schema and write volume are not approved | Proven accrual | Present exact migration, tests, volume and rollback before approval. |
| No elapsed proven history exists yet | Stage 3 | Hide historical sections until audits pass. |

## 15. Evidence and release log

| Stage | Commit | Deployment/migration ID | Local evidence | Live evidence | State |
|---|---|---|---|---|---|
| Plan | pending owner-approved docs commit | n/a | Project Guardian and diff checks pending | n/a | local review |
| Stage 1 | `3492e48b70817ea52535a21c2a5499151968010d` | production release verified; deployment ID not recorded in this plan | focused tests, TypeScript, Guardian, quality gates, ESLint and build passed | owner-confirmed HTTP, canonical, robots, sitemap, schema, current data, delivered-price and internal-link checks passed | live verified |
| Corrective Indexability Lifecycle P0 | pending | pending | focused contract/hub tests `166/166`; TypeScript, Guardian, diff check, quick/full gates, ESLint and production build passed | pending | `CODE COMPLETE`, live evidence pending |
| Stage 2 schema/recorder | pending separate approval | pending | pending isolated rehearsal | pending readback | not started |
| 7-day audit | n/a | n/a | pending | pending | not due |
| 14-day audit | n/a | n/a | pending | pending | not due |
| 30-day audit | n/a | n/a | pending | pending | not due |
| 60-day audit | n/a | n/a | pending | pending | not due |
| Stage 3 | pending separate approval | pending | pending | pending | not started |

## 16. Complete conditions

SEO-15 can be marked `LIVE VERIFIED` only when:

1. Stage 1 is deployed and publicly verified; its approved readiness gate
   remains launch evidence and monitoring while the live-verified base route
   follows the central lifecycle contract;
2. exact variant/pack, delivered price, freshness, canonical, robots, sitemap,
   schema, internal links and analytics checks pass without regression;
3. no public historical claim is powered by legacy or incomplete evidence;
4. Stage 2 migration and recorder, if approved, have isolated rollback and live
   readback evidence across every active importer path;
5. Stage 3 either passes its independently approved accrual gates and is live
   verified, or the owner explicitly narrows SEO-15 completion to Stage 1 while
   retaining Stage 3 as a named blocked follow-up in the authoritative ledger;
6. exact commits, deployment/migration IDs and live checks are recorded in the
   authoritative SEO and Operating plans.

This document cannot mark SEO-15 complete or reorder SEO-16. Those decisions
remain in the existing source-of-truth ledgers.
