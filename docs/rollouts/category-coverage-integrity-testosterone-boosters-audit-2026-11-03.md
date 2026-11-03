# Testosterone Boosters category coverage integrity audit

Date: 2026-11-03
Audit state: complete, read-only; no category fix authorised or implemented
Starting `main`: `9b249dc9266a36f4d0727533914f9d71712f95fc`
Production catalogue capture: `2026-11-03T12:51:58.167Z`
Public HTML capture: `2026-11-03T12:52:15.724Z`

## Scope and safety result

This audit changed no application runtime, database/schema, workflow, production
configuration, Search behaviour, homepage behaviour or SEO-20 file. Database
writes were `0`. The active PER4M SEO-20 experiment and its freeze were not
touched.

Fresh preflight found a clean detached worktree with both `HEAD` and
`origin/main` at the expected starting SHA. `npm run verify:project` passed:
22 SEO tasks were structurally valid, SEO-20 was the sole `IN PROGRESS` task,
and the experiment freeze remained active.

Production catalogue evidence used the same public Supabase client inputs as
`app/lib/supabase.ts`: `NEXT_PUBLIC_SUPABASE_URL` plus
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. No service-role, admin, migration, validator,
approver or executor credential was used. This was not a direct PostgreSQL
connection, so `BEGIN READ ONLY` and `transaction_read_only` do not apply. The
temporary local readback wrapper rejected every method except `GET` and `HEAD`;
the completed capture recorded exactly `3 GET`, no other method, no RPC and no
mutation call. The queried tables have RLS enabled and explicit public `SELECT`
policies in the baseline schema. The source of both temporary readbacks
contained no `INSERT`, `UPDATE`, `DELETE` or `rpc()` call. The live-site capture
also used only six ordinary HTTP `GET` requests. This proves the operations used
for this evidence were read-only even though no direct database credential was
available locally.

The catalogue read returned `1,399` product rows, including `1,357` active,
unmerged canonical products. It captured product identity, category,
description, format, active/merge state and nested offer evidence. A retailer
mapping count was derived as the number of distinct non-null
`offers.retailer_product_id` values. This is valid for the captured product
scope and does not assume that a fresh offer is required for membership.

## Current public architecture

The current flow for a category without a dedicated comparison route is:

1. `fetchHomepageCategories()` pages through active, unmerged production
   products, collects distinct non-null `products.category` values and caches
   the sorted list for one hour.
2. The homepage puts the 15 static `COMPARISON_CATEGORY_LINKS` first, then adds
   production categories not already represented by one of those labels.
3. `HomeCategories` renders the supplied URL unchanged. It hides rows after the
   first seven on mobile until **View all categories** is expanded; this affects
   discovery, not routing or membership.
4. `categoryBrowseHref(category)` returns a dedicated route only for an exact
   label in `COMPARISON_CATEGORY_LINKS`. `Testosterone Boosters` is not in that
   registry, so the fallback is
   `/search?q=${encodeURIComponent(category)}`.
5. Live homepage HTML confirmed the exact link
   `/search?q=Testosterone%20Boosters`.
6. Search builds variants, then ORs `ILIKE %variant%` over `name`, `brand`,
   `category` and `description`. There is no Testosterone-specific correction,
   goal mapping, alias or membership rule. Relevance scoring uses only name,
   brand and category; description can admit a row but contributes no score.
7. Active, unmerged catalogue rows remain results without a fresh offer. Fresh
   in-stock offers determine current prices and some filters, not unfiltered
   catalogue membership. Existing tests explicitly preserve a product whose
   offers are all stale.

Therefore the current category click is a text search, not a category-membership
query. It succeeds when the full phrase appears in one searched field and fails
for strong semantic members expressed as `testo`, `test`, `TestX`, `hormone
support` or singular `testosterone booster` unless another field happens to
contain the literal plural phrase.

## Current public result set

The live result count is `7`. The HTML order and current offer state are:

| Rank | ID | Product | Canonical category | Current offer evidence | Audit outcome |
| ---: | ---: | --- | --- | --- | --- |
| 1 | 1364 | Swole Lifestyle Fadogia Agrestis 60 Capsules | Testosterone Boosters | 1 mapping / 1 offer / 1 fresh in-stock; 10 Reps | review |
| 2 | 1365 | Swole Lifestyle Tongkat Ali 60 Capsules | Testosterone Boosters | 1 / 1 / 1; 10 Reps | review |
| 3 | 1124 | Nordic Labs Fadogia Agrestis 60 Capsules | Testosterone Boosters | 1 / 1 / 1; 6 Pack Supplements | review |
| 4 | 1111 | Ultra Nutrio Mr Test 100 Capsules | Testosterone Boosters | 1 / 1 / 1; 6 Pack Supplements | true positive |
| 5 | 1363 | Chaos Crew Turk 10% Turkesterone 500mg | Testosterone Boosters | 2 / 2 / 0 fresh; 10 Reps; unverified price state | **false positive** |
| 6 | 1366 | USN Anabolic Turk Test 1200 60 Capsules | Testosterone Boosters | 1 / 1 / 0 in-stock; 10 Reps; out of stock | true positive |
| 7 | 184 | 7Nutrition Volcano Testosterone 150 Capsules | Vitamins | 2 / 2 / 2 fresh in-stock; Fit House, Whey Okay | true positive |

Volcano is visible despite its `Vitamins` category only because its description
contains the exact plural phrase `testosterone boosters`. Chaos Crew is visible
despite being a standalone Turkesterone product only because its canonical
category is the exact searched phrase. Neither stale nor out-of-stock state
removes a catalogue result, as ranks 5 and 6 demonstrate.

The additional live readbacks returned:

- `testosterone` — 18, in order: `225, 184, 1364, 1365, 1124, 1111, 1363,
  1366, 596, 499, 413, 1387, 285, 429, 183, 431, 217, 237`.
- `testo` — 18, in order: `225, 184, 285, 429, 1364, 1365, 1124, 1111,
  1363, 1366, 596, 499, 413, 1387, 183, 431, 217, 237`.
- `testosterone booster` — 9, in order: `1364, 1365, 1124, 1111, 1363,
  1366, 184, 183, 499`.
- `testosterone boosters` — the same 7 and order as the homepage link.

These differences are direct evidence that coverage is phrase-dependent rather
than membership-dependent. The broad one-word searches also introduce generic
zinc, ZMB and Ashwagandha rows, demonstrating the precision risk of fixing this
only with more Search synonyms.

## Candidate-generation contract

The broad audit universe included all production products with any of:

- exact canonical category `Testosterone Boosters`;
- strong identity text such as testosterone, testo, TestX/test x, test support,
  hormone support, anabol, tribulus, turkesterone, fadogia or tongkat;
- one of the five mandatory identities;
- relevant reviewed retailer manifests/policies or historical canonical
  mappings found in the repository.

Ingredient-only evidence is deliberately not an automatic inclusion rule.
Ashwagandha, zinc, Tongkat Ali, Fadogia, Tribulus and Turkesterone can generate a
candidate, but need stronger identity or reviewed evidence to become a strong
member. The resulting current canonical candidate universe is 28 products. All
28 are active and unmerged. Historical duplicate product `953` is not a second
candidate: repository evidence and the current universe confirm its canonical
identity is product `184` after a guarded merge.

Captured `product_format` is `null` for legacy IDs `183, 184, 217, 225, 237,
285, 420, 431, 446, 459, 485, 499, 514` and `capsule` for the other 15
candidates. The nulls are catalogue-quality evidence, not a membership or
display exclusion.

Notation below: offer evidence is `mappings/offers/in-stock/fresh-in-stock`.
`Visible` means present in the exact plural public result.

## Complete candidate classification

| ID | Product / slug | Category | Offer evidence and retailers | Visible | Classification | Confidence | Evidence, reason and visibility cause |
| ---: | --- | --- | --- | :---: | --- | --- | --- |
| 183 | BioTech USA Tribooster 60 Tablets / `biotech-usa-tribooster-60-tablets` | Vitamins | 1/1/0/0; Whey Okay | no | INCLUDE_STRONG | HIGH | Description explicitly says strong testosterone booster. Missing because category is wrong/coarse and Search requires the plural phrase. |
| 184 | 7Nutrition Volcano Testosterone 150 Capsules / `7nutrition-volcano-testosterone-150-capsules` | Vitamins | 2/2/2/2; Fit House, Whey Okay | yes | INCLUDE_STRONG | HIGH | Name plus explicit natural testosterone-booster description. Visible via description only; category remains mismatched. |
| 217 | Mutant Test 90 Capsules / `mutant-test-90-capsules` | Vitamins | 2/2/0/0; Whey Okay, eBay UK | no | INCLUDE_STRONG | HIGH | Product identity and description are explicitly testosterone capsules. Missing through label and phrase/alias mismatch, not offers. |
| 225 | Olimp T-100 Ultimate Testosterone 120 Capsules / `olimp-t-100-ultimate-testosterone-120-capsules` | Health Supplements | 1/1/1/1; Whey Okay | no | INCLUDE_STRONG | HIGH | Explicit Ultimate Testosterone product. Missing through coarse label and phrase/alias mismatch. |
| 237 | TWP PCT Aftermath 2.0 120 Capsules / `twp-pct-aftermath-20-120-capsules` | Vitamins | 1/1/0/0; Whey Okay | no | EXCLUDE_STRONG | HIGH | Explicit post-cycle recovery identity; restoring production after a cycle is not a general testosterone-booster browse identity. |
| 285 | USN 19-Anabol Testo 90 Capsules / `usn-19-anabol-testo-90-capsules` | Health Supplements | 2/2/2/2; Whey Okay, eBay UK | no | INCLUDE_STRONG | HIGH | `Anabol Testo` identity and low-testosterone support description. Missing through coarse label plus `testo` alias mismatch. |
| 413 | GYM HIGH ZMB 60 Capsules / `gym-high-zmb-60-capsules` | Health Supplements | 2/2/1/1; GYM HIGH, Whey Okay | no | EXCLUDE_STRONG | HIGH | ZMB micronutrient product; testosterone support is an incidental benefit claim. Zinc/magnesium alone must not create membership. |
| 420 | Long Jack Tongkat Ali 60 caps / `long-jack-tongkat-ali-60-caps` | Health Supplements | 1/1/0/0; Whey Okay | no | REVIEW_REQUIRED | MEDIUM | Single botanical with no sufficiently strong captured testosterone identity. Candidate evidence only. |
| 429 | GYM HIGH Testo Pro 180 Capsules / `gym-high-testo-pro-180-capsules` | Health Supplements | 3/3/3/3; Fit House, GYM HIGH, Whey Okay | no | INCLUDE_STRONG | HIGH | Explicit Testo Pro identity and natural testosterone/hormone support formula. Missing solely through category/phrase/semantic-alias architecture. |
| 431 | Black Mamba Fadogia Agrestis 60 Capsules / `black-mamba-fadogia-agrestis-60-capsules` | Health Supplements | 1/1/1/0; Whey Okay | no | REVIEW_REQUIRED | MEDIUM | Description claims healthy testosterone levels, but identity is a single Fadogia ingredient. Requires reviewed semantic evidence. |
| 446 | Extreme Labs TT4 Tribulus Terrestris 90 Caps / `extreme-labs-tt4-tribulus-terrestris-90-caps` | Health Supplements | 1/1/1/1; Whey Okay | no | REVIEW_REQUIRED | MEDIUM | Standalone Tribulus identity; no sufficiently explicit captured membership evidence. |
| 459 | Applied Nutrition Turk-X Turkesterone Plus / `applied-nutrituion-turk-x-turkesterone-plus` | Health Supplements | 1/1/0/0; Whey Okay | no | EXCLUDE_STRONG | HIGH | Captured identity is standalone Turkesterone for body recomposition/muscle growth, not testosterone support. |
| 485 | Applied Nutrition Tongkat Ali 600mg 60 Capsules / `tongkat-ali-600mg-60-capsules` | Health Supplements | 1/1/0/0; Whey Okay | no | REVIEW_REQUIRED | MEDIUM | Single Tongkat Ali ingredient; vitality language is insufficient for automatic membership. |
| 499 | Olimp DAA Xtreme Prolact-Block 60 Tablets / `olimp-nutrition-daa-xtreme-prolact-block---60-tablets` | Health Supplements | 2/2/2/2; Whey Okay, eBay UK | no | INCLUDE_STRONG | HIGH | Description explicitly calls it an advanced testosterone booster. Missing because evidence is description-only and singular. |
| 514 | Animal Stak 21 Packs / `animal-stack-21-packs` | Health Supplements | 1/1/1/1; Whey Okay | no | INCLUDE_STRONG | HIGH | Description explicitly identifies complete natural hormone support; repo reviewed policy also recognises Animal M-Stak in this support family. Missing through semantic alias/name/category limitations. |
| 596 | Simply Supplements Super Zinc Plus / `super-zinc-plus` | Vitamins | 1/1/1/1; Simply Supplements | no | EXCLUDE_STRONG | HIGH | Zinc product whose long description mentions normal testosterone synthesis. This is incidental ingredient education, not booster identity. |
| 982 | Nordic Labs Long Jack Tongkat Ali 60 Capsules / `nordic-labs-long-jack-tongkat-ali-60-capsules` | Health Supplements | 2/2/2/1; 6 Pack Supplements, Fit House | no | REVIEW_REQUIRED | MEDIUM | Single Tongkat Ali ingredient and no description; needs reviewed evidence. |
| 983 | Nordic Labs TestX Pro Turkesterone 60 Capsules / `nordic-labs-testx-pro-turkesterone-60-capsules` | Health Supplements | 2/2/2/2; 6 Pack Supplements, Fit House | no | INCLUDE_STRONG | HIGH | `TestX Pro` identity plus reviewed Six Pack policy and retailer source URL explicitly naming testosterone booster. Missing through category and alias limitations. |
| 992 | Osavi Tribulus Terrestris Saponins 200mg 180 Capsules / `osavi-tribulus-terrestris-saponins-200mg-180-capsules` | Health Supplements | 1/1/1/1; Fit House | no | REVIEW_REQUIRED | MEDIUM | Standalone Tribulus with no description; candidate evidence only. |
| 1111 | Ultra Nutrio Mr Test 100 Capsules / `ultra-nutrio-mr-test-100-capsules` | Testosterone Boosters | 1/1/1/1; 6 Pack Supplements | yes | INCLUDE_STRONG | HIGH | Exact category, `Mr Test` identity, reviewed Six Pack policy and source URL explicitly naming testosterone booster. |
| 1124 | Nordic Labs Fadogia Agrestis 60 Capsules / `nordic-labs-fadogia-agrestis-60-capsules` | Testosterone Boosters | 1/1/1/1; 6 Pack Supplements | yes | REVIEW_REQUIRED | MEDIUM | Exact source-derived category and reviewed retailer allowance, but identity remains one ingredient. Needs category-level semantic review before strong inclusion. |
| 1218 | Refined Nutrition Tribulus 60 Capsules / `refined-nutrition-tribulus-60-capsules` | Health Supplements | 1/1/1/1; 10 Reps | no | REVIEW_REQUIRED | MEDIUM | Standalone Tribulus; candidate evidence only. |
| 1363 | Chaos Crew Turk 10% Turkesterone 500mg / `chaos-crew-turk-10-turkesterone-500mg` | Testosterone Boosters | 2/2/2/0; 10 Reps | yes | EXCLUDE_STRONG | HIGH | Standalone Turkesterone identity. Exact retailer-derived category is insufficient and creates the current false positive. |
| 1364 | Swole Lifestyle Fadogia Agrestis 60 Capsules / `swole-lifestyle-fadogia-agrestis-60-capsules` | Testosterone Boosters | 1/1/1/1; 10 Reps | yes | REVIEW_REQUIRED | MEDIUM | Exact source-derived category but single Fadogia ingredient. Needs explicit reviewed semantic evidence. |
| 1365 | Swole Lifestyle Tongkat Ali 60 Capsules / `swole-lifestyle-tongkat-ali-60-capsules` | Testosterone Boosters | 1/1/1/1; 10 Reps | yes | REVIEW_REQUIRED | MEDIUM | Exact source-derived category but single Tongkat ingredient. Needs explicit reviewed semantic evidence. |
| 1366 | USN Anabolic Turk Test 1200 60 Capsules / `usn-anabolic-turk-test-1200-60-capsules` | Testosterone Boosters | 1/1/0/0; 10 Reps | yes | INCLUDE_STRONG | HIGH | `Anabolic ... Test` identity plus reviewed exact category. Out-of-stock state correctly does not erase membership. |
| 1387 | TWP Ashwagandha / `twp-ashwagandha` | Health Supplements | 1/1/1/1; Gladiator Nutrition | no | EXCLUDE_STRONG | HIGH | Single Ashwagandha product; enhanced testosterone is one incidental marketing benefit. |
| 1436 | TWP Tongkat Ali / `twp-tongkat-ali` | Health Supplements | 1/1/1/1; Gladiator Nutrition | no | REVIEW_REQUIRED | LOW | Single ingredient, no description and no current reviewed category evidence. |

Classification totals are `11 INCLUDE_STRONG`, `6 EXCLUDE_STRONG` and
`11 REVIEW_REQUIRED`.

## Mandatory product findings

- **GYM HIGH Testo Pro** remains canonical product `429`, active and unmerged,
  category `Health Supplements`, with three current retailer mappings/offers and
  three fresh in-stock offers. It is absent because neither its category nor its
  name/description contains the literal plural query. Root causes:
  `CATEGORY_LABEL_MISMATCH`, `SEARCH_PHRASE_MISMATCH`,
  `SEMANTIC_ALIAS_MISSING`, `PUBLIC_BROWSE_ARCHITECTURE_LIMITATION`.
- **7Nutrition Volcano Testosterone** is canonical product `184`, active and
  unmerged, category `Vitamins`, with two fresh in-stock retailer offers. It is
  visible only because the description contains `testosterone boosters`.
  Category quality is still wrong for this experience. Historical duplicate
  `953` was merged into `184`; it is not a missing second product.
- **Nordic Labs TestX Pro** remains canonical product `983`, active and
  unmerged, category `Health Supplements`, with two fresh in-stock retailer
  offers. It is absent because `TestX`/reviewed semantic evidence has no current
  category alias or membership mapping.
- **Ultra Nutrio Mr Test** is canonical product `1111`, active and unmerged,
  exact category, one fresh in-stock offer, and is visible.
- **Nordic Labs Fadogia Agrestis** is canonical product `1124`, active and
  unmerged, exact category, one fresh in-stock offer, and is visible. It remains
  `REVIEW_REQUIRED` because ingredient identity alone is not enough for an
  automatic strong membership decision.

Other strong missing products are `183, 217, 225, 285, 499, 514, 983` in
addition to Testo Pro `429`.

## Metrics and root causes

- Current public results: `7`.
- Expected strong members: `11`.
- Visible strong true positives: `3` (`184, 1111, 1366`).
- Current false positives: `1` (`1363`).
- Current visible reviews: `3` (`1124, 1364, 1365`).
- Missing strong members: `8`.
- Recall: `3 / 11 = 27.3%`.
- Precision under the requested formula: `3 / 7 = 42.9%`. The three unresolved
  visible reviews remain in the denominator and are not promoted to true
  positives.

Root-cause counts can overlap because one missing row can have several causes:

| Root cause | Missing strong count | Explanation |
| --- | ---: | --- |
| CATEGORY_LABEL_MISMATCH | 8 | Every missing strong row is labelled Vitamins or Health Supplements. Across all strong members the count is 9 because visible Volcano is also mismatched. |
| SEARCH_PHRASE_MISMATCH | 8 | None contains/matches the exact plural phrase in a searched field. |
| SEMANTIC_ALIAS_MISSING | 8 | Singular booster, testo, TestX, test and hormone-support evidence are not category membership aliases. |
| PRODUCT_NAME_INSUFFICIENT | 3 | IDs 183, 499 and 514 require description/reviewed evidence rather than literal product-name matching. |
| DESCRIPTION_ONLY_MATCH | 3 | IDs 183, 499 and 514 have their strongest current catalogue evidence in description. |
| CURRENT_OFFER_PRESENTATION_FILTER | 0 | Search retains catalogue rows without fresh offers. |
| INACTIVE_PRODUCT | 0 | All 28 current candidates are active. |
| MERGED_PRODUCT | 0 | All 28 are canonical; historical 953 is correctly represented by 184. |
| NO_USABLE_OFFER | 0 | Offer state does not explain any missing strong member. |
| DATA_QUALITY_CATEGORY_ERROR | 3 | The three strong rows currently under Vitamins (`183, 184, 217`) are clear label-quality debt. |
| PUBLIC_BROWSE_ARCHITECTURE_LIMITATION | 8 | Fallback Search has no semantic membership layer. |

For the 28-candidate universe, canonical category distribution is `17 Health
Supplements`, `5 Vitamins` and `6 Testosterone Boosters`. Only 2 of the 6 exact
category rows are strong includes; 1 is a strong exclude and 3 need review.
Conversely, 9 of 11 strong includes are outside the exact category. The primary
cause is therefore a combination: some category values are poor (especially
Vitamins), but a single canonical category also cannot safely represent a
semantic browse taxonomy. Simply relabelling rows would neither solve
multi-membership nor remove the current Turkesterone false positive.

## Existing architecture reuse

Reusable pieces:

- `getLandingProducts()` already pages the complete active catalogue, includes
  offer evidence and keeps membership separate from fresh-price availability.
- `isReviewedLandingProductMatch()` and `reviewedLandingNamePatterns` show a
  bounded reviewed matcher pattern for five existing landing families.
- `proteinSubtypes.ts` demonstrates shared deterministic include/exclude
  predicates, rather than route-local product exceptions.
- `COMPARISON_CATEGORY_LINKS`, `comparisonLinkForCategory()` and
  `comparisonLinkForProduct()` centralise routes and breadcrumb decisions.
- Existing category comparison modules, pagination, cards, offer freshness and
  canonical error handling can render the result.
- Reviewed retailer policies and manifests are valuable audit evidence, but
  must not become retailer-specific runtime membership logic.

Do not reuse raw Search `ILIKE` as membership, and do not keep adding categories
to the current boolean matcher without returning reasons and review state. The
existing landing mechanism is the correct base to generalise, while
`proteinSubtypes` supplies the predicate style.

## Recommended generic architecture

Create one shared, versioned `CategoryCoverageDefinition` registry and a pure
evaluator. A definition should contain a stable category key, public label,
route, canonical category aliases, strong identity include rules, strong
exclude rules, ambiguous candidate signals, and optional declarative reviewed
identity evidence. Evaluation must return one of `INCLUDE_STRONG`,
`EXCLUDE_STRONG`, `REVIEW_REQUIRED` plus deterministic confidence, reason codes
and evidence. Ambiguity fails closed to review.

The three concerns remain separate:

1. **Canonical product category** — existing primary catalogue label; useful
   evidence, never sole semantic truth.
2. **Semantic browse membership** — pure definition/evaluator output; supports
   aliases, multiple memberships, exclusions and reviewed evidence.
3. **Display eligibility** — offer freshness, stock, price and retailer filters
   applied after membership. A member without a current offer remains a member
   and receives the existing truthful unavailable/unverified presentation.

Core code must not contain retailer, product-ID, slug or brand-specific `if`
chains. Product IDs may appear in audit artifacts and tests. If an exceptional
identity needs a human decision, store a declarative reviewed evidence record
bound to normalized identity evidence (for example brand/name plus GTIN or a
review fingerprint), with provenance and expiry/review status; do not express
it as runtime control flow.

The first implementation should generalise the existing reviewed landing
matcher rather than create a parallel engine. It should add contract fixtures
for every row in this audit, including exact category false positives and
ingredient-only review cases. It must use the shared cache, canonical, robots,
sitemap, error and route registration lifecycle before any public route is made
indexable.

## User-facing model decision

| Model | Correctness and risk | Reuse / complexity | SEO, breadcrumbs and scale | Decision |
| --- | --- | --- | --- | --- |
| A — keep `/search?q=Testosterone Boosters`, make Search category-aware | Can work, but mixes intent search with browse membership and risks broad synonym false positives such as zinc/Ashwagandha. Search regressions have large blast radius. | Reuses Search UI; category semantics and query semantics become coupled. | Search is currently noindex with canonical `/search`; weak category SEO and awkward breadcrumb ownership. | Not recommended. |
| B — dedicated browse route using shared semantic membership | Clean separation, deterministic review state and lowest semantic blast radius. | Reuses landing retrieval/rendering and route registry; moderate bounded implementation. | Supports lifecycle-controlled canonical/indexability, shared product breadcrumbs and future categories. | **Recommended.** |
| C — shared membership resolver behind a category parameter on Search | Better than free text but still places browse state inside a noindex Search route. | Lowest initial UI work; creates two modes and long-term routing ambiguity. | Poorer canonical/breadcrumb model than B and likely a later migration. | Acceptable internal prototype only. |

Model B should initially be non-indexable until the route is registered and its
coverage, canonical, robots, sitemap, error and contract evidence satisfy
`docs/SEO-Indexability-Lifecycle.md`. This audit does not authorise that route or
any production change.

## Quick future category screening

This is triage, not a completed audit. It combines live category counts, route
type and repository evidence of identities assigned to adjacent categories.

- **P0:** `Fat Burners` and `Weight Management` (7 versus 13 rows; repository
  evidence already places explicit Fat Burner products under Weight
  Management); `Collagen` (only 1 exact category row while many explicit
  collagen identities exist under protein/health categories). Both use fallback
  Search and have high likelihood of the same recall/precision defect.
- **P1:** `Nootropics` (2 exact rows versus multiple explicit nootropic
  identities in other categories); `Protein Powder` and `Whey Protein`/Vegan/
  Isolate (21 generic rows and multiple existing semantic subtype mechanisms);
  `Energy Supplements` and `Energy Drinks`/Pre Workout; `Hydration` and
  `Electrolytes` (the dedicated Hydration route reduces risk but taxonomy still
  spans two labels).
- **P2:** `Carbohydrates`, `Workout Supplements`, `Accessories`, and the broad
  `Health Supplements` catch-all. They need screening after higher-value,
  clearer semantic families; the broad catch-all should not itself become a
  semantic landing definition.

## Risks and exact next unit

Main risks are treating retailer source categories as reviewed semantic truth,
letting ingredient mentions auto-include products, allowing descriptions to
overrule explicit exclusions, coupling membership to fresh offers, and making a
new route indexable before lifecycle evidence exists. Another risk is silently
changing product breadcrumbs for review-required products.

Recommended next implementation unit, requiring separate owner authorisation:

> Implement the shared reason-bearing `CategoryCoverageDefinition` evaluator by
> generalising the existing reviewed landing matcher; add a Testosterone
> Boosters definition and 28-product contract fixtures; add a non-indexable
> dedicated browse route through the existing category route/cache/error
> contracts; keep Search unchanged; keep offer/display eligibility downstream;
> do not add product-ID/slug/retailer exceptions; do not change production data
> or SEO-20.

The exact stop point for this audit is the architecture recommendation and
durable evidence above. No category fix, data relabel, route, Search change,
migration, production write or SEO-20 change was performed.
