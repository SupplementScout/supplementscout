# Catalogue visibility and Predators Gear implementation plan

**Status date:** 3 September 2026  
**Status:** PHASE A LIVE VERIFIED — PREDATORS GEAR DEFERRED TO FINAL STEP<br>
**Purpose:** authoritative handoff for the next chat and the bounded implementation that follows.  
**Active work package:** keep canonical products visible independently of offer freshness, then add the missing guarded Predators Gear refresh.  

**3 September 2026 implementation checkpoint:** Phase A is `LIVE VERIFIED` at
commit `f053557`. The shared classifier is the only source of the 24- and
72-hour thresholds, and active eligible products remain public when no offer is
current. Read-only public verification of
`/product/5-nutrition-rich-piana-createn-240g` returned `200`, the expected
canonical, `Availability being rechecked`, no `/go/` link and no schema.org
`Offer` or `AggregateOffer`. The same product remained present for the search
`Rich Piana CreaTen` with no current price or retailer CTA. Testo Pro and CREA-4
were also public and had independently refreshed qualifying checks dated
3 September, so their current prices remained correctly eligible. Local gates
passed: `verify:quick`, `verify:full`, `verify:project`, production build and
`git diff --check`.

The local/read-only Phase B implementation is committed but not activated. Its
manifest is frozen to the exact existing `47` mappings/offers and permits no
catalogue creation. All authorised public Predators Gear transports tested on
3 September returned `403`, so no fresh complete dry-run artifact exists. By
owner decision in this chat, Predators Gear is deferred to the final step of
this work package while the binding Better-value alternatives milestone
resumes. The Predators workflow remains manual, unscheduled and unregistered;
no production apply is authorised. This plan must not be marked complete until
the deferred source proof, fresh artifact, exact owner-approved apply,
postflight, idempotency, watchdog and public verification all pass.

The intervening Better-value alternatives milestone is now `LIVE VERIFIED` at
commit `8532613`, so Predators Gear is the final remaining step under the
owner-approved sequence. This changes only ordering: the next permitted action
is a fresh read-only source capture with the existing exact-47 adapter. A
production apply remains prohibited unless that capture produces a complete,
fresh, bounded artifact and the owner then gives exact approval for it.

## 1. Owner outcome

SupplementScout must remain useful when a retailer refresh is late without presenting an old price as current.

The binding rule is:

> A retailer or offer freshness failure may remove that offer from the current-price ranking, but must not remove an otherwise active canonical product from the catalogue.

The implementation must be small and shared. It must not introduce a second catalogue, a second approval system, retailer-specific UI freshness rules or a parallel automation architecture.

## 2. Confirmed current behaviour

- `app/lib/offerFreshness.ts` defines a current offer as a valid `last_checked_at` no more than 24 hours old.
- Search can retain the product and display `Temporarily unavailable` when no current offer remains.
- `app/lib/categoryComparison.ts` currently returns `null` for a product with zero eligible current offers. Category and comparison surfaces can therefore remove the whole product after its final offer crosses the 24-hour boundary.
- Product offer groups also exclude stale offers, so the customer cannot distinguish confirmed out of stock from temporarily unverified availability.
- Current-price ranking, delivered-price claims and product structured data correctly exclude stale offers. That protection must remain.

This is a presentation/lifecycle coupling problem, not a reason to weaken the current-price guard.

## 3. Read-only production evidence

The 3 September 2026 read-only audit used a read-only transaction and made zero database writes.

### Predators Gear

- retailer ID `13`, slug `predators-gear`;
- `47` offers covering `30` products;
- `47` stored offers currently have `in_stock=true`;
- `0` offers meet the public 24-hour current rule;
- `47` offers are older than 48 hours;
- `7` offers are older than seven days;
- `0` offers are older than 30 days;
- oldest `last_checked_at`: `2026-08-26T20:33:05.744Z`;
- newest `last_checked_at`: `2026-08-29T13:32:36.442Z`;
- `47/47` mappings have both source IDs;
- `47/47` mappings are variant-bound;
- no `price_observation_producers` row exists for retailer `13`;
- `config/automation-reliability-watchdog.json` registers no workflow, capture step, apply step or DB postflight step for Predators Gear.

Diagnosis: Predators Gear was onboarded through reviewed import paths, but no autonomous end-to-end offer-refresh producer/workflow was built and registered. The current absence of public Predators Gear prices is not caused by missing mappings. A generic public HTTP check of the retailer returned `403` on 3 September, so source transport must be proved before the adapter is selected; do not work around access controls with an unsafe scraper.

### Representative public-visibility failures

- Testo Pro remains an active canonical product with three stored in-stock retailer offers, but all three checks are older than 24 hours, so none is public-current.
- CREA-4 remains an active canonical product with four stored in-stock offers, including Predators Gear, but all four checks are older than 24 hours, so none is public-current.

These records support retaining the product while clearly downgrading the offer evidence.

## 4. Target presentation model

Implement one central classifier and reuse it everywhere:

| State | Exact meaning | Public behaviour |
|---|---|---|
| `LIVE` | valid check at most 24 hours old and `in_stock=true` | Show current delivered price, retailer CTA and include in ranking. |
| `RECENT` | last valid in-stock observation is older than 24 hours but no more than 72 hours old | Keep product visible. If a prior price is shown, label it `Last seen`, show its check time, exclude it from current/best-price ranking and structured offer data. |
| `OUT_OF_STOCK` | valid check at most 24 hours old and `in_stock=false` | Keep product visible and label the retailer/product out of stock; do not rank it as purchasable. |
| `UNVERIFIED` | last usable check is older than 72 hours, missing or invalid | Keep product visible, suppress the old price and current CTA, and say that availability is being rechecked. |
| `REVIEW` | source or identity evidence is ambiguous | Keep the catalogue row unchanged and isolate the offer from automatic execution. |

The 24- and 72-hour constants must live in the single shared classifier. No page may invent its own thresholds.

## 5. Required implementation

### Phase A — decouple product visibility from offer freshness

1. Extend the shared offer-freshness module with the presentation classifier and typed states.
2. Preserve `isOfferFresh` and the existing 24-hour eligibility contract for:
   - best-price and delivered-price ranking;
   - current retailer CTA presentation;
   - offer structured data;
   - current deals and price claims;
   - all automation and database guards.
3. Change the shared category comparison normalizer so an active eligible canonical product with zero current offers becomes an unavailable/unverified result instead of `null`.
4. Sort products with `LIVE` offers first and retained unavailable/unverified products afterwards. Do not let missing price win value or price sorting.
5. Align search cards, category/comparison cards and product pages to the same state labels and timestamps.
6. Show retailer count and latest verification state without representing stale stock or price as current.
7. Keep inactive/merged product redirect and canonical lifecycle behaviour unchanged.
8. Keep stale offers out of schema.org `Offer`, `AggregateOffer`, current-price analytics and current deals.

Expected database/schema change: none.

### Phase B — add the missing Predators Gear refresh

1. Audit the live source transport and reuse an existing WooCommerce/source adapter pattern if compatible.
2. Build one Predators Gear capture adapter for exactly the existing `47` reviewed mappings. Do not create products, variants, mappings or offers.
3. Require complete source coverage or isolate per-row source/review failures using the existing guarded model.
4. Reuse the existing protected per-row plan, approval, atomic apply, stale-state, fingerprint, idempotency, price-history, baseline and postflight mechanisms.
5. Safe unambiguous rows may follow existing approved update rules. Ambiguous identity, unexpected shipping, source conflict or mapping drift remains in Review Queue and unchanged.
6. Add one workflow, not multiple retailer-specific rollout workflows.
7. Register that workflow in the existing watchdog and, only after a successful controlled production proof, schedule it several times per day.
8. Alert after 48 hours without a successful verified refresh.
9. Do not bypass a source `403`, anti-bot control or missing feed. Prefer an authorised public WooCommerce API/feed or retailer-provided credentials if the source requires them.

## 6. Tests and evidence

Before implementation, confirm the mechanism does not already exist and run the relevant baseline tests. After implementation require:

- unit tests for all classifier boundaries, including exactly 24 and 72 hours;
- shared contract tests showing search, category/comparison and product detail agree;
- proof that a product with zero `LIVE` offers remains visible;
- proof that stale prices cannot rank, become `best price`, enter current structured data or create current-price analytics;
- proof that fresh out-of-stock and stale/unverified are distinct states;
- proof that merged/inactive lifecycle behaviour is unchanged;
- Predators Gear source fixture and complete-scope tests for exactly 47 mappings;
- per-row review isolation, commercial guard, source-failure, mapping-drift and mass-OOS tests;
- workflow credential separation and read-only dry-run tests;
- `npm run verify:quick`;
- `npm run verify:full`;
- `npm run verify:project`;
- `git diff --check`;
- full diff review before commit;
- production dry-run and artifact review before any separately authorised write;
- controlled apply only after exact owner approval;
- read-only DB postflight, idempotency, watchdog and public-page verification.

If a test is added, removed or renamed, review and reseal `scripts/quality-gate-manifest.json` as required by the repository contract.

## 7. Definition of done

The work is complete only when all of the following are proved:

- Testo Pro, CREA-4 and every other active eligible canonical product no longer disappear solely because all offers are older than 24 hours;
- no stale price is presented or encoded as a current/best price;
- `LIVE`, `RECENT`, `OUT_OF_STOCK` and `UNVERIFIED` are visibly and semantically distinct;
- search, product detail, categories and comparisons use the same classifier;
- Predators Gear has one registered guarded workflow for exactly 47 existing mappings;
- a fresh Predators Gear dry-run has complete deterministic evidence;
- any production apply changes only the exact approved per-row fields;
- postflight and idempotency pass;
- watchdog sees the registered workflow and can raise the 48-hour alarm;
- public pages are checked after deployment;
- unrelated retailers, product identity, mappings, SEO lifecycle, deals and structured-data freshness contracts remain unchanged.

## 8. Scope exclusions

This work does not authorise:

- displaying an old price as current;
- globally increasing the existing 24-hour current-price threshold;
- product, variant, mapping or offer creation for Predators Gear;
- identity or rebind decisions;
- production writes without a fresh exact artifact and separate owner approval;
- grants, secret changes or bypasses;
- changes to other retailer automation;
- a second approval system, comparison engine or catalogue;
- work on Better-value alternatives, SEO-15 publication or GYM HIGH publication inside this work package.

## 9. Delivery estimate

Target: **five working days / approximately 32–40 engineering hours**.

- Day 1: shared classifier and boundary tests.
- Day 2: search, category/comparison, product detail and structured-data integration.
- Day 3: Predators Gear source proof and adapter for the exact 47-row scope.
- Day 4: protected workflow, contracts, dry-run, postflight, idempotency and watchdog integration.
- Day 5: complete verification, controlled rollout evidence and public UI closeout.

Contingency: add one to two working days only if Predators Gear requires a retailer-provided feed/API credential or continues to block all authorised machine-readable source access.

## 10. Long-run execution protocol for the next chat

1. Read `AGENTS.md`, the current Operating Plan, Agent Operating Model and this document.
2. State this file as the one active bounded catalogue/retailer work package.
3. Inspect the current repository and confirm none of the target functionality has already landed.
4. Complete Phase A in one implementation-and-verification sequence. Do not repeatedly redesign it after the tests pass.
5. Complete the read-only source proof and local Phase B implementation in the same long sequence where safe.
6. Commit and push only clean, reviewed, verified changes.
7. Continue through read-only dry-run preparation without pausing for choices already resolved by this plan.
8. Stop only at a genuine external blocker or before a production write requiring an exact fresh owner approval.
9. Never treat broad permission to continue as authority for an unbounded catalogue write.
10. Update this document and the applicable operating evidence after each live-verified milestone.

## 11. Copy/paste starter for the next chat

```text
Kontynuuj dokładnie plan z docs/rollouts/catalog-visibility-and-predators-gear-implementation-plan-2026-09-03.md. Pracuj długimi ciągami, bez ponownego projektowania i bez tworzenia równoległych mechanizmów. Najpierw potwierdź aktualny stan repozytorium i brak istniejącej implementacji, następnie wykonaj Phase A oraz lokalną/read-only część Phase B, wszystkie wymagane testy i pełny przegląd diffu. Zachowaj ścisłą 24-godzinną regułę dla bieżących cen, ale nie pozwól, aby aktywny produkt znikał tylko z powodu starej oferty. Predators Gear obejmuje wyłącznie 47 istniejących mappingów i nie wolno tworzyć nowych rekordów katalogowych. Nie wykonuj produkcyjnego apply bez świeżego artefaktu i mojej dokładnej zgody. Zatrzymuj się tylko przy rzeczywistym blockerze albo granicy wymagającej nowej produkcyjnej autoryzacji.
```
