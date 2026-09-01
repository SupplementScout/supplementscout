# SupplementScout Operating Plan

**Status date:** 1 September 2026<br>
**Purpose:** One authoritative operating document for architecture, current state, priorities, rules, roadmap, and definitions of done.  
**Replaces:** the older fragmented project brief and decisions scattered across chats.  
**Primary goal:** Build the UK's smartest and most trustworthy supplement search and comparison platform.

**Automation reliability status:** The P0 Automation Reliability Sprint is closed with monitored backlog. The [Automation Reliability Roadmap](Automation-Reliability-Roadmap.md) remains the evidence source, but no longer blocks product development. Existing guarded workflows, Review Queue and alerts own ordinary freshness, OOS, source and review backlog.

**1 September 2026, 17:47 UTC final reliability checkpoint:** this checkpoint supersedes older reliability checkpoint statuses below. Final production audit was read-only with database writes `0` and evidence SHA-256 `2520eb28453314ea659238dd59c95aa987ed3a106de08e78f14873b8b3f83f08`. The protected write model is established: validator capture, per-row owner approval, artifact/commit/fingerprint binding, separate approver and executor roles, atomic apply, stale-state guards, idempotency, immutable audit, DB baseline/postflight, Review Queue publication, watchdog and Catalog Health. Whey Okay offer `73` has its exact approved final state; no replay occurred. Catalog Health remains `Critical` because `208` active products have no valid in-stock offer; stale >7/>30 is `343/321`; active Review Queue is `328 PENDING`, fully isolated. Watchdog run `33539129034` remains red from mixed age, missing evidence and evidence-correlation debt, not from a confirmed unisolated write. Verdict: `CLOSE_WITH_MONITORED_BACKLOG`.

**Binding stop rule:** do not reopen reliability work for individual review rows, ordinary OOS, isolated stale offers, source absence or one failed retailer run. Reopen only for a shared-guard regression, an unisolated/cross-retailer write, a public freshness bypass, a mass user-impacting automation failure, or a repeated 48-hour retailer alarm that cannot be isolated by the existing workflow and Review Queue. Any future commercial, identity, rebind or freshness write still requires fresh bounded evidence and explicit owner approval.

**Next product milestone:** Better-value alternatives MVP on existing product pages. Reuse the current 24-hour offer freshness gate, delivered-price normalization, exact-variant resolution, verified unit-price helpers, category comparison presentation and consent-aware analytics. The MVP should show at most three same-category, compatible-format alternatives ranked only on a shared verified value basis; exclude stale, OOS, unresolved-identity and incomparable-unit candidates; add impression/click measurement; and add no new indexable route, personalization or catalogue write. Success is measurable lift in alternative-card and downstream retailer-offer click-through with zero freshness/identity guard violations.

**1 September 2026, 12:35 UTC reliability checkpoint:** production migration `20260901090000_add_reviewed_variant_create_rebind_offer_update.sql` was applied alone at ledger `172` with zero catalogue and control-plane deltas, but the required active-function test correctly blocked the reviewed path before any approval or offer apply: `digest(text,text)` is installed in `extensions` while the validator's pinned `search_path` excludes that schema and its four calls were unqualified. Forward-only migration `20260901100000_fix_reviewed_variant_digest_schema_resolution.sql` (SHA-256 `aaf408391412c3786a2b860b00989e0bad78ab511cbde57b8719a8656a6eea49`) is locally complete and is the only pending production migration. It preserves the exact active function, owner, `SECURITY DEFINER`, pinned search path and ACL while qualifying only those four calls as `extensions.digest(...)`. Isolated PostgreSQL and the full quality gate passed. No production repair migration, approval RPC, offer apply or catalogue write has been run. Next authority gate is migration-only owner approval; a new offer artifact remains prohibited until the repaired active production function passes postflight.

**30 August 2026, 13:35 UTC reliability checkpoint:** the remaining-stale reconciliation completed read-only with status `RELIABILITY_NO_SAFE_PROGRESS`. No production apply was dispatched. eBay's new per-row isolation commit `09c49d1` was proved locally, but two fresh production dry-runs remained globally blocked by the same source read failure. Discount 47, Dolphin 2 and Whey 284 were fully classified and left unchanged. Final Catalog Health remains 354/322 stale offers over 7/30 days and Overall `Critical` from 208 products without a valid in-stock offer. The authoritative detailed checkpoint is in `Automation-Reliability-Roadmap.md`; the complete unresolved-row artifact is `docs/rollouts/automation-reliability-owner-pack-2026-08-30-final.json` with file SHA-256 `db5868c8d78ed67cdf00566421a07d9c5cabd4d0a328fb787542d7e95d42945a`.

**31 August 2026, 10:55 UTC reliability checkpoint:** eBay is closed/autonomous and was not replayed. The remaining scope is grouped for owner decisions in `docs/rollouts/automation-reliability-remaining-scope-2026-08-31.json`; it is evidence, not approval. Fresh read-only evidence: Discount `33382625827` (`109 VERIFY_NO_CHANGE`, zero review/blocked), eBay `33382627453` (`196 VERIFY_NO_CHANGE`, `41` review, zero blocked), Dolphin local dry-run (`1 VERIFY_NO_CHANGE`), GYM HIGH `33383167927` source/postflight `PASS`, and Whey `33382624165` fail-closed on active/conflicting session with zero writes. Catalog Health remains `Critical` from `208` products without valid in-stock offer. Review Queue execution remains default-deny except the existing eBay per-row `VERIFY_NO_CHANGE` adapter; commercial, identity, rebind, unavailable and source-missing actions still require separate fresh owner approval.

---

## 0. Binding audit reset - 19 July 2026

This section records the full-project audit requested before further implementation. It is the binding execution reset. Where an older status, priority or proposed implementation elsewhere in this document conflicts with this section, this section wins. Historical sections remain as evidence, not as authority to restart completed work.

### 0.0.22 SEO-15 remaining-producer audit and GYM HIGH enablement - 26 August 2026

The production read-only readiness audit covered the exact approved scopes of
all six Stage 2A producers other than Jon's: `1,801` mappings and `1,801`
offers. `1,120` rows have complete exact-pack identity, `681` remain
fail-closed, and `558` exact-ready rows had a check within 24 hours. The sealed
evidence is
`docs/rollouts/seo15-retailer-producer-readiness-audit-2026-08-26.json`.

The owner separately approved unlocking GYM HIGH's observation producer. The
existing guarded producer row is now enabled for exactly `66` reviewed
mappings/offers. A subsequent exact-pack evidence audit aligned nine
label-proven supplement identities through the existing guarded migration
path, increasing readiness from `40/66` to `49/66`. The recorder must continue
to reject identities without resolved evidence. The owner subsequently resolved
Shred Mode as one pack, 60 servings and one capsule per serving, increasing
readiness to `50/66`. The remaining `16` are apparel/accessory rows outside the
supplement exact-pack contract. Migration
`20260826090000_enable_gym_high_price_observation_producer` applied with zero
catalogue/history count deltas at production ledger `141`, fingerprint
`aaf93e1e0dd1e18d05a2ff887afba208079f601d1fae7f5c8df326b3b37274e6`.
Migration `20260826100000_create_gym_high_exact_pack_9` then added exactly nine
variants with no product, mapping, offer or history row-count change at ledger
`142`, fingerprint
`1bf9969771b17a4154baef268b6f9816766ec62540fed20e7dad46a871b04ee5`.
Migration `20260826110000_create_gym_high_shred_mode_exact_pack` then added the
single owner-resolved Shred Mode variant at ledger `143`, fingerprint
`27176e91f21f7e7a62d202e6924d4ad97290b453e90c296656704f1b7b84085b`,
again without changing product, mapping, offer or history row counts.

At that checkpoint Fit House remained disabled, but its first guarded exact-pack alignment was
production verified. Migration
`20260826120000_create_fit_house_exact_pack_batch_15` created exactly 12
explicit variants and rebound three rows to existing exact variants, increasing
Fit House readiness from `166/286` to `181/286`. Products, mappings, offers and
price history remained at `1,112`, `2,761`, `2,761` and `4,001`; production
ledger `144` has fingerprint
`698323b6ebe6b201eb3bb7eb719c5290398089a667314ce923a4c5cf1da3bbb6`.
Six conflicting identities remain fail-closed. Evidence is sealed in
`docs/rollouts/fit-house-exact-pack-batch-15-2026-08-26.json`.

The owner then approved 11 additional Fit House identities backed by current
retailer body evidence and the existing approved pack-count config. Migration
`20260826130000_create_fit_house_retailer_evidence_exact_pack_11` created 11
explicit serving variants and increased readiness from `181/286` to `192/286`.
The exact owner clarification for Trec ALA is one capsule per serving, taken
twice daily: 60 capsules are 60 servings and 30 days of use. Products, mappings,
offers and price history remained unchanged; production ledger `145` has
fingerprint
`b3e7624b1ff7ff7ee854f365f47f7fdb3c482e9dab889b7cd83ab515764fd801`.
Seven conflicts remain fail-closed. Evidence is sealed in
`docs/rollouts/fit-house-retailer-evidence-batch-11-2026-08-26.json`.

The owner then reviewed a larger set of 30 Fit House source pages. Twenty-seven
available exact products were approved; three unavailable products were kept
out of scope. Migration
`20260826140000_create_fit_house_retailer_evidence_exact_pack_27` created
exactly 27 serving variants and increased readiness from `192/286` to
`219/286`. The reviewed NOW Turmeric identity is one softgel per serving,
taken twice daily, while EFX Kre-Alkalyn is two capsules per serving before
training and another two-capsule serving after training. Products, mappings,
offers and price history remained unchanged; product variants increased from
`2,758` to `2,785`. Production ledger `146` has fingerprint
`c45d819365befea9ec9b43b99238d8d94cf719d5d714ace05b62c9fed2b6c82f`.
The seven known conflicts and three unavailable products remain incomplete and
fail-closed. Evidence is sealed in
`docs/rollouts/fit-house-retailer-evidence-batch-27-2026-08-26.json`.

The owner then completed review for 26 further Fit House offers and confirmed
one sold pack for each of the 24 safe identities. Mappings `2095` and `2096`
were excluded because their current Shopify variant titles conflict with the
bound canonical flavours. Migration
`20260826150000_create_fit_house_owner_reviewed_exact_pack_24` created 22
serving variants and enriched two existing exact-flavour variants, increasing
readiness from `219/286` to `243/286`. Products, mappings, offers and price
history remained unchanged; product variants increased from `2,785` to
`2,807`. Production ledger `147` has fingerprint
`41388cd2b50bdaf9cb6f27d082d4d08c44ed14d0a24dd17723655ae5c414f945`.
The fresh read-only postflight reproduced the sealed source fingerprint,
confirmed all 24 target rows exact-ready with no identity-series references,
and kept both flavour conflicts blocked. Evidence is sealed in
`docs/rollouts/fit-house-owner-reviewed-exact-pack-24-2026-08-26.json`.

The owner then approved ten more safe Fit House exact-pack identities.
Migration `20260826160000_create_fit_house_owner_reviewed_exact_pack_10`
created nine explicit serving variants and rebound GYM HIGH Testo Pro to its
existing exact 60-serving variant, increasing readiness from `243/286` to
`253/286`. Products, mappings, offers and price history remained unchanged;
product variants increased from `2,807` to `2,816`. Production ledger `148`
has fingerprint
`09fa96604603b9d202dbac2f504fffd136e5797ad3eb08233448e388c235542a`.
The fresh read-only postflight confirmed all ten target rows exact-ready with
no identity-series references. Of the remaining 33 rows, 26 are absent from
the current source and seven remain fail-closed. The owner separately decided
that mapping `869` Sodium Butyrate should represent one sold pack and 100
one-capsule servings; that decision was not included in this sealed migration.
Migration `20260826170000_create_fit_house_sodium_butyrate_exact_pack` then
created exactly that single owner-selected serving identity, increasing Fit
House readiness from `253/286` to `254/286`. The retailer body continues to
describe two capsules daily, which is recorded as use guidance rather than
silently changing the approved per-capsule serving identity. Products,
mappings, offers, price history and identity series remained unchanged;
product variants increased from `2,816` to `2,817`. Production ledger `149`
has fingerprint
`b9a28b720bdceecd2a0d8ca0913e34b5d1e3a21100f63f66cb4b233304e199ea`.
The postflight confirmed the target exact-ready with zero identity-series
references. Evidence is sealed in
`docs/rollouts/fit-house-sodium-butyrate-exact-pack-2026-08-26.json`; the prior
ten-row evidence remains sealed in
`docs/rollouts/fit-house-owner-reviewed-exact-pack-10-2026-08-26.json`.

The owner then resolved all six remaining source-present Fit House identity
conflicts. Migration
`20260826180000_resolve_fit_house_six_exact_pack_conflicts` created four exact
variants and reused the existing HR Labs DEFIB Lemon Fizz Bombs and Fizzy
Bubblegum Bottles 420g V3 variants. The OstroVit mapping is explicitly Orange;
the retailer's Shopify `Mango` variant label is recorded as erroneous and was
not allowed to override the retailer body plus owner decision. Thiquid is
verified as one 1000ml liquid pack with 25 servings, Osavi D3 + K2 as 60
one-softgel servings, and Osavi Liposomal Vitamin C as 1000mg per two-capsule
serving, 60 capsules and 30 servings. Readiness increased from `254/286` to
`260/286`; the remaining 26 rows are all absent from the fresh complete source
and remain fail-closed. Products, mappings, offers, price history, identity
series and outbound-click counts were preserved; product variants increased
from `2,817` to `2,821`. Production ledger `150` has fingerprint
`cfa0fb2f545be226a1b72ebcda8c9adb0296b862402f5a12e4bb11addb9e235f`.
The exact-pack correction evidence is sealed in
`docs/rollouts/fit-house-six-exact-pack-conflicts-2026-08-26.json`.

The owner subsequently approved the Fit House producer enablement and one
controlled run. Commit `6e5a3a2` aligned four historical missing-source
manifests only to their already owner-approved exact canonical successors and
prepared the production-only enablement. Migration
`20260826190000_enable_fit_house_price_observation_producer` changed only the
Fit House producer flag at production ledger `151`, fingerprint
`12ece4c71ab77f1488afaeac6dc94049ff65b07c30309fd01bf7e8b0f30db28a`;
products, variants, mappings, offers and legacy price history were unchanged.
Controlled workflow run `32986975109` then passed preflight, apply,
idempotency and artifact upload across `286/286` mappings/offers. It created
exactly `260` immutable identity series and `260` daily confirmations. The
remaining `26` source-absent incomplete identities were skipped fail-closed
with `MISSING_OR_CONFLICTING_EXACT_IDENTITY`. Independent production readback
confirmed zero anomalies, duplicate series, duplicate daily confirmations or
other-retailer series changes. Evidence is sealed in
`docs/rollouts/fit-house-price-observation-producer-preflight-2026-08-26.json`.

Jon's, GYM HIGH and Fit House are the enabled producers; Simply Supplements,
Whey Okay, 6 Pack Supplements and eBay UK remain disabled. GYM HIGH's first
identity series and confirmations still require its next ordinary scheduled
run and postflight verification.

This approval changes only private Stage 2A observation accrual. GYM HIGH brand
and retailer publication remains `owner_deferred`; Stage 3 and public
price-drop claims remain disabled.

### 0.0.4 Current project checkpoint - 28 July 2026

This checkpoint supersedes older counts, retailer states, active tasks and
automation blockers elsewhere in this document.

- The primary goal remains unchanged: build the UK's smartest and most
  trustworthy supplement search and comparison platform. Catalogue size is not
  the primary success measure; accurate multi-retailer comparisons, freshness,
  delivered-price value and decision usefulness are.
- Production has 1,061 active canonical products, 2,021 active public offers
  and nine active retailers. Of those products, 182 have no active retailer,
  772 have one, 107 have at least two, 13 have at least three and two have at
  least four. Multi-retailer depth therefore remains the main commercial data
  constraint.
- Jon's Supplements and the approved Whey Okay exact-manifest scope have active
  guarded refresh automation. Their latest confirmed checks on 28 July were
  current. Older statements that these mechanisms are awaiting first
  production enablement are historical.
- 6 Pack Supplements is the active retailer onboarding. Its reviewed production
  scope has already made it the retailer currently adding the most second and
  third-plus retailer coverage. The admin matching queue contains 141 rows: 58
  decided and 83 awaiting owner review.
- Of the 58 decided 6 Pack rows, 50 are approved for controlled automation:
  25 new products, 17 new variants, four new product-family seeds and four
  mappings to existing variants. V14 is complete: protected bootstrap run
  `30389870288` verified all 35 families, and protected offer run `30391111886`
  added and verified 49 mappings/offers with exact £4.99 shipping. The
  remaining approved decision, source row `5232`, is an audited duplicate page
  for the already automated `4551:4553` vanilla-wafer offer and correctly did
  not create a second offer. Shared refresh run `30391609002` expanded the same
  retailer automation from 391 to 440 offers across 231 product pages; all 440
  were `VERIFY_NO_CHANGE` in both the preflight and fresh post-apply check.
  Seven rows are excluded and one remains deferred.
- The shared Six Pack refresh is safe at 440 offers, but its protected apply is
  intentionally sequential and therefore slow. A later performance task may
  reuse bounded role connections or approved batches only if the same exact
  manifest, per-row approval metadata, rollback and idempotency guarantees are
  preserved.
- The first-party search ledger contains 904 recorded result events through
  28 July. Production tests show good coverage for core category terms but
  deterministic gaps for reversed size wording, punctuation/model names,
  multi-word exact identities and natural-language budgets. Search reliability
  is the current bounded engineering task; unsupported medical or ingredient
  claims remain out of scope.
- The current search work must extend the existing `app/lib/products.ts`
  engine. It must not introduce a second search service or an AI recommendation
  system. Safe first improvements are token-order variants, punctuation/model
  variants, multi-word matching and delivered-price budget parsing. Searches
  such as "without caffeine" or health-treatment wording require verified
  ingredient/claim data before exact filtering can be promised.
- The bounded search improvement is complete. The active task is now the
  protected V14 execution of the 50 sealed 6 Pack decisions, followed by an
  append to the same shared retailer automation. The remaining 83 rows continue
  through owner review independently.

### 0.0.5 SEO traffic growth control - 29 July 2026

SEO traffic growth is now an active permanent workstream. The binding detailed
execution ledger is `docs/SEO-Execution-Plan.md`. This Operating Plan remains
the overall project authority; the SEO ledger records the task-level queue,
status, definition of done, evidence and next active SEO task.

Before any SEO implementation:

1. read this current checkpoint and the complete SEO execution ledger;
2. confirm that the work is the single `IN PROGRESS` SEO implementation;
3. check whether the proposed mechanism already exists;
4. read the relevant current Next.js documentation before changing framework
   code.

After every SEO implementation, update the ledger. An SEO task is complete only
at `LIVE VERIFIED`: local code completion alone is not sufficient.

The 29 July read-only baseline found 1,111 active canonical products, 2,106
positive-price in-stock offers, 920 products with at least one such offer and
112 products with at least two in-stock retailers. The public sitemap contained
11 static URLs and exactly 1,000 product URLs, so 111 active product URLs were
omitted by the unpaginated Supabase response. The execution order starts with
that truncation, then truthful index/last-modified policy, category relevance
and crawlable internal product linking. New high-intent landing pages follow
only after those P0 foundations.

### 0.0.6 Catalogue identity reconciliation - 31 July 2026

Catalogue identity reconciliation is the active bounded data-maintenance task.
It reuses the existing authenticated duplicate review, guarded merge RPCs,
variant model, retailer mappings and merge history; it must not introduce a
second catalogue or importer.

The production audit found that the previous admin detector loaded only the
first 1,000 active products and compared canonical names without the complete
retailer alias set. It also treated flavour, size and colour differences as a
reason to omit a pair, even when the rows could belong to one canonical product
family. The corrected detector pages through the complete catalogue and safety
evidence, uses retailer aliases and retailer GTIN evidence, understands the
approved brand aliases, and labels exact-product, product-family and uncertain
matches separately.

Two exact duplicate families were reconciled through the existing guarded
merge path and verified immediately after execution:

- product `967`, Fit House `Gym High CREA-4 Elite 60 servings`, was merged into
  canonical product `1`; all three retailer mappings/offers now use product `1`
  and merge-history row `2` preserves the audit snapshot;
- product `953`, Fit House `7Nutrition Volcano 150 Capsules`, was merged into
  canonical product `184`; the category label was first aligned from the
  generic `Health Supplements` to canonical `Vitamins`, both offers/mappings
  now use product `184`, and merge-history row `3` preserves the audit snapshot.

The fresh read-only catalogue audit after those merges contains 1,109 active,
unmerged products and 136 detected pair relationships: 88 possible
flavour/size/colour families, 20 uncertain similar-name reviews and 28 pairs
with an older keep-separate decision. These are pair relationships, not 136
merge instructions: overlapping pairs can describe one family and many similar
names are legitimately different formulas. No remaining pair has exact shared
GTIN evidence that is safe for unattended merge. Older keep-separate decisions
that now look like a possible family are explicitly flagged for recheck.

Binding execution rule: exact default-only duplicates may use the existing
guarded merge only after live preconditions and post-merge preservation checks
pass. Product-family consolidation must preserve every reviewed flavour, size,
colour, retailer mapping, offer, price-history row and outbound-click identity.
Until a variant-aware family plan passes those checks, it remains review-only;
ordinary duplicate merge must fail closed rather than flatten variants.

Owner decision on 31 July 2026: in the current catalogue-duplicate review,
`deferred` with a note beginning `MERGE FAMILY` is an approved family outcome:
the rows describe the same product with different flavours, sizes or colours.
`separate` remains binding evidence that the rows are different products despite
a similar name. A family decision authorises planning, not an unsafe bulk write;
each family must still be assigned to exact canonical variants and pass the
transactional preservation checks before it changes the public catalogue.

The first family execution is complete. Product `738`, `7Nutrition
Beta-Alanine Powder 250g Unflavoured`, was consolidated into product `768`,
`7Nutrition Beta-Alanine 250g`, specifically into canonical variant `933`,
`Unflavoured / 250g`. Fit House mapping `871` and offer `757` moved together;
one price-history row and one outbound-click record were preserved. Merge-history
row `5` records the operation. Production verification shows one active public
product family and the Fit House offer under the correct variant.

The remaining owner-reviewed family queue was completed later on 31 July 2026.
Twenty-four canonical families now contain their reviewed flavour, size or
colour variants; 33 redundant active product cards were retired in the guarded
batch, and the post-batch audit found four variants that had been missed during
the original review. Those four cards (Dreadlift Military Green, GASP Thermal
Shorts Asphalt and Tactical Camo, and Critical Cookie Salted Caramel box of 12)
were then added to the correct existing families through the same guarded merge
path. In total this closeout retired 37 redundant cards, created 62 structured
variants and preserved all 83 affected retailer mappings and offers. The global
catalogue totals for products, mappings, offers and price history did not fall;
only active duplicate cards were retired.

The final full-catalogue identity audit reports 1,071 active products, 0 open
family candidates, 0 uncertain duplicate candidates and 92 active reviewed
`separate` relationships. The single-cookie and 12-cookie Critical Cookie
products remain separate commercial packs. Six Pack's immutable automation
manifest was rebound to the five changed canonical targets and its fresh live
506-offer dry-run returned `VERIFY_NO_CHANGE ×506`, 0 blocked rows and 0 database
writes. Jon's fresh production dry-run also returned `VERIFY_NO_CHANGE ×506`
with 0 catalogue deltas. Fit House accepted the complete 286-row canonical
scope after the merge, then correctly failed closed during live-source matching
because unrelated source variant `43583990006000` for `7Nutrition Whey Isolate
90 1kg` was absent from the retailer's current Shopify snapshot; that source
change made 0 database writes and is a separate retailer-source review item.

### 0.0.6A Fit House automation closeout - 11 August 2026

Fit House now uses one shared routine refresh path:
`.github/workflows/fit-house-offer-refresh.yml` calls
`scripts/fit-house-offer-refresh.js` for the exact approved 286-offer scope.
The audited-missing manifest is identity evidence only; reviewed-change
manifests, builders and migrations are one-time approval/audit records and are
not additional scheduled automation engines.

The approved source changes were applied without creating or deleting catalogue
entities. The stable-OOS validator retains the generic 35% guard for every other
retailer and allows Fit House's reviewed 103/286 baseline only when the exact
retailer, scope and runtime policy fingerprint match and total OOS does not
increase. Migration `20260811020000` corrected only that runtime fingerprint;
catalogue counts remained unchanged. The final production dry-run returned
`VERIFY_NO_CHANGE` for all 286 offers across six validated batches, with zero
business or control writes. Do not create another Fit House refresh engine;
future source changes must enter this same guarded path.

### 0.0.6B Simply Supplements offer-refresh closeout - 11 August 2026

The owner-reviewed offer `635` / mapping `627` sale was already consumed in
production through the existing reviewed-commercial-change path. The exact
identity remains product `628`, variant `644`, external product
`15934232691037`, external variant `64643271033181`. The current price is GBP
2.13, shipping GBP 1.99 and delivered total GBP 4.12; stock and both source and
affiliate URLs are unchanged. Price history records the move from GBP 6.41 / GBP
8.40 delivered to the current values. The one-time authorization is `CONSUMED`
and must not be replayed.

A fresh ordinary production dry-run then covered all 120 approved Simply
Supplements offers in three validator batches and returned
`VERIFY_NO_CHANGE` x120, zero missing identities, zero commercial changes and
zero writes. Routine automation remains the only active path; no new mechanism
is required for this closeout.

### 0.0.6C Dolphin automation verification - 11 August 2026

The invalid GitHub Actions YAML mapping-merge syntax was removed in commit
`160c956`; the active workflow now has ordinary explicit environment fields and
retains schedule/manual-only execution. Twenty focused source, refresh,
registration and shared-sync tests pass. A fresh production dry-run fetched the
exact approved product page with HTTP 200 and classified the single approved
mapping/offer as `VERIFY_NO_CHANGE`. Missing identities, commercial changes,
catalogue deltas and writes were all zero. Dolphin's one-offer routine path is
healthy; no replacement workflow or additional engine is required.

### 0.0.7 Competitive growth sequence - 31 July 2026

The refreshed WheyWise comparison shows that SupplementScout's main competitive
gap is no longer raw catalogue size. The priority gaps are search-acquisition
pages, genuine multi-retailer depth, visible decision support and external
authority. SupplementScout's advantages remain known delivered-price treatment,
canonical product/variant identity, auditable retailer mappings and fail-closed
automation. The full evidence is in
`docs/Competitive-Intelligence/WheyWise-Analysis-2026-07.md`.

This is the binding growth sequence. The owner advanced the accrual-safe order
on 26 August 2026;
that decision supersedes older immediate-task and competitive-response ordering
where they conflict:

`SEO-11`, `SEO-13` and `SEO-14` are complete and live verified. The
multi-retailer coverage milestone is also independently verified at `250/250`.

1. return to `SEO-15` for its mandatory 14/30-day evidence audits and any
   separately approved Stage 3 decision; do not infer historical claims;
2. complete `SEO-17`, clearly labelled owner-reviewed expert notes where they
   materially help a buying decision;
3. record Search Console and GA4 evidence weekly throughout the sequence;
4. continue authority research, but keep outbound outreach paused until the
   owner changes the current no-email decision.

Only one SEO implementation may be `IN PROGRESS`. Measurement, read-only
analysis, operational monitoring and a separately scoped retailer coverage task
may continue in parallel, but they must not create overlapping implementations.
Urgent production reliability or data-integrity incidents interrupt the growth
sequence until the safe state is restored. No competitor traffic number may be
stored as fact without a named measurement source and date.

### 0.0.8 GYM HIGH full-catalogue automation checkpoint - 1 August 2026

The owner-reviewed GYM HIGH source scope contains 66 approved sellable variants
across 26 product families. Four gift-card rows remain excluded and source
identity `639:644` remains an explicit reviewed exception. The approval is
bound to fingerprint
`feda6c5cc6f03556dbadfb2e56dc7216150d502a70cee03b1880ec35ec37ad59`.

The canonical bootstrap is complete: 34 missing variants were created and a
fresh postflight now plans zero further variant creates. The controlled legacy
repair is also complete. Protected workflow run `30711898188` updated the exact
21 approved supplement mappings, including nine offer-to-variant identity
moves, without changing price, shipping, stock, URL or price history. Its own
postcondition passed, and an independent production read returned 21 completed
mappings and zero remaining upgrades. The earlier failed runs stopped before
any mapping write.

The reviewed full-catalogue rollout is complete. Read-only validation run
`30712867734` accepted all 66 immutable plans with zero blocked rows. Protected
apply run `30713224002` then executed all 66 plans through separate production
approver and executor roles, creating the 41 missing sibling mappings and 42
missing offers. Its write step passed; the run was marked failed only because
the redundant second source fetch was blocked by GYM HIGH's Imunify360 layer.
Independent production evidence immediately returned 66 mappings, 66 offers,
zero missing mappings and zero missing offers. The corrected no-write postflight
run `30713422729` subsequently passed end to end against the same immutable
source capture. Unknown delivery cost on newly created offers was not inferred
from unrelated historical offers during rollout. On 21 August 2026 the owner
independently confirmed GYM HIGH delivery as GBP 3.99 below GBP 50 and free from
GBP 50 inclusive. A fresh full-scope production-data dry-run planned 43
shipping-only updates and 23 no-ops across the exact 66 approved identities,
with zero price, stock, URL or catalogue changes and zero writes. PR `#31`
merged the guarded implementation as
`cb84b9720700b45d13fc978d2851cdc0c65c71df`. Protected production run
`32481753907` passed the exact contracts, fresh source capture, role-separated
apply, complete live postcondition and evidence upload. An independent
production read at `2026-08-21T12:31:09.680Z` returned 66/66 policy no-ops and
zero remaining shipping updates. The correction is complete and live verified.

The same exact 66-row reviewed scope is scheduled daily at `04:13 UTC`. It may
update existing approved offers only and blocks catalogue creates, mapping or
offer creates, shipping values outside the owner-confirmed threshold formula,
per-row price anomalies, mass price or state changes and unsafe URLs. It first
requests a fresh source capture. If
Imunify360 blocks that request, it may use only the latest successful source-
monitor artefact while that artefact is less than 24 hours old and still has
the exact approved identity fingerprint. Older, missing or drifted evidence
fails before writes. A failed refresh therefore leaves catalogue products
discoverable but does not keep stale prices or retailer calls to action public.

Execution uses the four-role model in `docs/Agent-Operating-Model.md`: Roadmap
Steward, Growth Analyst, SEO/Decision-Page Builder and Independent Release
Verifier. These are controlled responsibilities, not autonomous production
actors. Existing deterministic scripts, manifests, tests and workflows remain
the automation layer; agents must never bypass owner approval or catalogue
safety controls.

### 0.0.8 Automatic Project Guardian - 1 August 2026

The read-only Project Guardian is the durable cross-chat consistency control.
`npm run verify:project` checks the authoritative plan bindings, SEO ledger IDs
and statuses, the single-implementation rule, agreement on the next task and
completion evidence. It fails closed on structural contradictions and returns
time-based GSC/GA4 or WheyWise review reminders without turning those reminders
into repeated workflow failures.

`.github/workflows/project-guardian.yml` runs the same validator for relevant
pushes and pull requests, once each Monday and on manual request. It has only
`contents: read`, receives no secrets and cannot write catalogue, retailer,
price, deployment or production data. The validator and its negative tests are
`scripts/project-guardian.js` and `scripts/project-guardian.test.js`.

Roadmap, status or completion-evidence changes must run the Guardian before and
after editing. A Guardian pass proves document/control consistency only; it
does not replace feature tests, live verification or owner approval.

Implementation commit `5ee8dd6` is live on `main`. The first hosted Project
Guardian run, `30687118501`, completed successfully for that exact commit after
the push; the local validator, seven negative/positive tests and an independent
read-only review also passed.

### 0.0.9 Catalogue visibility during offer-refresh outages - 1 August 2026

The 24-hour rule remains binding for every public price, stock, retailer,
delivery-cost, value metric and price-based ranking claim. It no longer acts as
a product-existence rule in catalogue search, search suggestions or shared
category landing grids. An active canonical product remains discoverable when
all of its offers are stale or absent, while its card shows that the current
price is temporarily unavailable and exposes no stale retailer or price
breakdown.

Products without a fresh offer sort after currently priced products. They are
excluded from explicit retailer and delivered-price budget filters because
those filters cannot be answered truthfully without current commercial data.
Canonical product pages already applied the same safe boundary: the page stays
available, but stale offers, outbound retailer calls to action and offer JSON-LD
are omitted. Current-price comparison tables continue to rank fresh offers
only; they are not an alternative catalogue identity mechanism.

The implementation reuses `app/lib/products.ts`, the shared 24-hour freshness
helper and the existing product card. Local evidence passed 63 focused search
and presentation tests, 1,324 non-integration tests with 19 environment skips,
TypeScript, lint with four pre-existing warnings, the production build and the
Project Guardian. The three additional full-suite failures required a running
Docker/PostgreSQL service and were unrelated migration integration tests; no
production catalogue or offer data was written by this change.

Production commit `8b9dab0` was live verified against active canonical product
`751`, `Applied Nutrition Diet Whey Protein 1.8kg`, which has no offer rows.
Exact public search returned `200`, included the product card and the safe
unavailable-price copy, and contained neither a pound price nor an unknown
retailer label. The public suggestions API returned the canonical product URL.
The canonical product page also returned `200` with `Price unavailable`, no
retailer redirect and no offer structured data.

### 0.0.10 Read-only GA4 and Search Console analyst access - 1 August 2026

The Growth Analyst may independently download authenticated GA4 and Google
Search Console evidence through the single shared
`scripts/growth-analytics-report.js` mechanism. It uses a dedicated Google
service account with only `analytics.readonly` and `webmasters.readonly`, runs
locally on request and each Monday through
`.github/workflows/growth-analytics-report.yml`, and confines raw evidence to an
ignored local directory or a private 35-day workflow artifact.

This authority is read-only. It does not permit the agent to change Google
users or settings, write to the repository, update SEO status automatically,
or infer missing values after an API failure. Full Page indexing, Core Web
Vitals and Links totals remain manual Search Console/export evidence because
the supported APIs do not expose those aggregate reports.

Live authenticated operation is now proved. Read-only workflow run
`30702954910` produced artifact `8819405398` for 25-31 July 2026 and the Growth
Analyst retrieved it through the connected GitHub artifact reader. GSC reported
559 impressions, 0 clicks and average position 58.21; GA4 reported 0 Organic
Search sessions and 0 organic retailer-offer clicks; the submitted sitemap had
0 warnings and 0 errors. The sitemap API's `indexed: 0` is not treated as the
Page indexing baseline because GSC already records impressions. SEO-07 remains
`BLOCKED` only on the Search Console UI/export evidence for Page indexing, Core
Web Vitals, Links and priority URL inspection.

### 0.0.11 Jon's reviewed mass-OOS closeout - 3 August 2026

Jon's scheduled 506-offer refresh correctly blocked a net increase of ten new
out-of-stock offers under the unchanged ordinary `MASS_OOS` limit. Two complete
read-only source captures agreed on 229 products, 855 variants and the same ten
stock-only changes; prices and URLs were unchanged. The owner approved exactly
offer IDs `1061`, `1183`, `1185`, `1256`, `1327`, `1336`, `1338`, `1359`,
`1373` and `1480`.

The existing mapped-scope reviewed-change path was extended only for the sealed
ten-row manifest. Its byte SHA-256 is
`3d3dec8e0087adf547b2c7148f7fb1a6745dd342ee75d87993f4a4e9fdc9849c`;
the ordinary mass-OOS, mass-change, source-health and price guards were not
raised or bypassed. The preflight also exposed a pre-existing identity label
error on offer `1183`. With separate owner approval, canonical variant `1255`
was corrected in place from `Default` to `Lemonade / 460g`; mapping `1369`,
offer `1183`, its URL, price and history identity were preserved.

The protected reviewed executor then applied exactly ten stock changes. It
reported products `0`, variants `0`, mappings `0`, offers `0`, price history
`0`, stock updates `10` and freshness updates `10`. The fresh full-scope
postflight returned `VERIFY_NO_CHANGE ×506`, zero blockers and zero further
price, stock, URL or mapping changes. A separate production read confirmed all
ten approved offers OOS with prices and URLs unchanged and confirmed variant
`1255` as active, non-default `Lemonade / 460g`.

Routine changes inside the approved 506-offer scope remain automatic. A net
increase of four or more new OOS rows must continue to fail closed because a
retailer outage can resemble mass delisting. The evidence preparation is now
reusable through `scripts/jons-reviewed-stock-change-builder.js`: it performs
two matching source captures, verifies the exact owner-approved offer IDs and
seals the manifest. This does not give an agent unattended production-write
authority; future mass-OOS execution still requires explicit owner approval of
the exact IDs and the existing hash-bound reviewed executor.

Current verification on 11 August 2026 supersedes the older source-count
snapshots in historical sections. A fresh production dry-run read 241 Shopify
products and 872 variants, reconciled the exact 506 approved mappings/offers,
and returned `VERIFY_NO_CHANGE` x506 across 11 validator batches. Missing
variants, price changes, stock changes, URL changes, catalogue deltas and writes
were all zero. Jon's routine automation therefore remains complete; no new
reviewed operation or mechanism is pending.

### 0.0.12 Protein pack-transition policy - 9 August 2026

This is the binding rule for manufacturer shrinkflation and other protein pack
size changes. The public catalogue must describe the pack that each retailer is
currently selling, not a newer manufacturer pack that has not yet reached that
retailer's stock. A manufacturer's current product page is authoritative
nutrition evidence and may warn of an upcoming pack transition, but it does not
by itself prove that a retailer has stopped selling the older pack.

- While a retailer still identifies the larger pack by its current title,
  weight, SKU, GTIN or reviewed source identity, its mapping and offer remain on
  the larger canonical variant. Do not copy the manufacturer's newer smaller
  net weight or serving count onto that offer.
- A retailer page or feed may be used as commercial pack-identity evidence, but
  never as nutrition evidence. Nutrition facts continue to require an official
  manufacturer source or other explicitly owner-reviewed first-party label
  evidence.
- `serving_size_g` and `protein_per_serving_g` may remain shared when the exact
  formulation is unchanged and no source contradicts them. `net_weight_g` and
  `serving_count_verified` are pack-specific: a smaller pack normally changes
  both even when serving size and protein per serving stay the same.
- When the first retailer demonstrably changes to the smaller pack, create or
  approve the smaller canonical `product_variants` identity and rebind only
  that retailer's mapping and offer through the existing guarded review/apply
  path. Keep the larger variant active while any retailer still sells it.
- A retailer keeping the same URL does not preserve pack identity. Ambiguous
  same-URL changes without weight, SKU, GTIN or equivalent reviewed evidence
  remain pending and must not be rebound automatically.
- In Admin nutrition review, the owner's structured `approved_value` is the
  authoritative value consumed by the planner, including a correction of an
  extracted proposal. `proposed_value` is only machine output and
  `review_note` explains the decision; free-form notes are not parsed into
  product writes. Approval still authorises planning only, followed by a fresh
  approved plan and explicit apply.
- Arithmetic remains a mandatory fail-closed check. A verified serving count
  must be a whole number and must fit the reviewed pack weight and serving size
  within the documented rounding tolerance. A calculated count may expose a
  conflict, but it is not labelled verified without reviewed evidence.

This policy reuses canonical variants, `product_match_review_queue`, retailer
mappings, nutrition candidates and guarded apply mechanisms. It does not
create a second catalogue and grants no unattended product, variant, mapping or
offer write authority.

### 0.0.13 Protein coverage acceleration policy - 9 August 2026

Protein coverage uses two explicit operational levels so commercially useful
comparison facts can be published before every serving field is complete:

- `COMPARISON_READY` requires a reviewed pack weight or volume, serving size,
  protein per serving, product format and reviewed nutrition evidence. It does
  not claim a verified serving count or price per serving.
- `FULL_SERVING_VERIFIED` additionally requires a positive whole-number
  `serving_count_verified`. Only this level is complete for all serving-based
  comparison facts.

The public calculator remains fail-closed under its existing verification
flags. A coverage label never makes a price or nutrition value verified and
never bypasses `unit_pricing_verified` or `nutrition_verified`.

Candidate collection may process up to 50 exact manifest URLs in one run. The
larger bound does not permit crawling, sitemap scanning, following links,
retailer nutrition evidence, marketplaces, competitor pages or cloud OCR. Each
URL must still name an allowed official manufacturer domain.

Admin review may approve all safe unchanged proposals for one product in one
database statement. Conflict, ambiguity, unclear, mismatch and exceeds flags,
non-integer serving counts, corrected values and cross-product selections stay
in individual review. Bulk review changes only `nutrition_candidates`; a fresh
approved plan and explicit apply remain mandatory before `products` changes.

Missing `product_format` may receive a deterministic report-only suggestion of
`powder` when both the protein-powder category and a gram-based pack support it.
The suggestion is not approval and is never written automatically.

### 0.0.14 eBay UK offer-coverage workstream - 13 August 2026

`eBay UK Offer Coverage` is a durable, separately controlled data-source
workstream whose technical source of truth is
`docs/EBAY-UK-COVERAGE-PLAN.md`. Its purpose is to increase products with at
least two qualified offers by using eBay only as a controlled second-offer
coverage layer for canonical products/variants that already exist. It must not
mass-create the catalogue.

The initial read-only audit is complete. On 13 August production had 1,070
active unmerged products, 2,586 active variants and only nine product-level
canonical GTINs (0.84%); no active variant had a canonical GTIN. Positive-price
in-stock product coverage was 197 with zero retailers, 761 with one, 96 with
two and 16 with at least three. No eBay account/API status is assumed.

The binding sequence is: audit, credential-ready read-only pilot implementation,
EPN/Developer access setup, Production keyset notification compliance,
54-identity live read-only run, quality decision, then separately approved
import design. The read-only pilot is built and its immutable input contains
exactly the 54 safe canonical variant GTIN identities. On 14 August the owner confirmed EPN and eBay
Developers approval and created Sandbox and Production keysets. Production is
subject to a fresh activation check after eBay validation of the guarded
marketplace account-deletion endpoint deployed on 14 August. The owner
configured all three Production secrets and eBay accepted the challenge
endpoint. Its first signed
test exposed acknowledgement ordering: eBay requires immediate receipt
acknowledgement and subsequent validity verification. The route now performs
bounded JSON and signature-envelope gates before HTTP 204 and permits deletion
processing only after post-response signature and full deletion-schema
verification succeed. This accommodates eBay's reduced synthetic test payload
without accepting it for processing. eBay then reported
`A test notification was sent successfully!`, completing live notification
compliance evidence. The owner then confirmed the Production keyset's
`Non Compliant` marker disappeared. Account-deletion setup is complete and must
not be rebuilt. The production Browse API run then completed for all 54 safe
identities: 2 `AUTO_ELIGIBLE`, 3 `REVIEW`, 5 `REJECT` and 44 `NOT_FOUND`.
Both safe candidates would add a second retailer and beat the current complete
delivered price; the median price difference across the two was -GBP 6.42.
Input fingerprint was
`9d277525865ebaf7ce33e435db6ce1c9348b576a19e5c05e4168f5b549a1a885`.
The run made 0 database, offer, mapping or public changes, and affiliate
tracking was not configured. The owner accepted the row-level quality review:
both `AUTO_ELIGIBLE` rows passed for a future bounded production-pilot design,
Solgar 60 Tablets was rejected because the selected listing is 120 tablets,
and the Applied Nutrition and Per4m rows remain held because eBay did not
return their GTINs. This is not approval to write or publish an offer. No
retailer row, production offer, public UI or write automation is authorized by
this entry. The architecture is a marketplace-specific adapter around the
existing guarded identity/control plane, not a second importer, and it retains
seller/listing evidence. The same read-only runner was then extended with a
bounded one-retailer discovery mode. It checked 355 new variant identities
across 150 products and a title fallback without weakening automatic identity
gates. Deduplicated eBay listing evidence now covers 144 products, exceeding
the 50-product search target; 46 have an eBay-returned exact GTIN and 36 combine
exact GTIN with an independent seller. Manual review exposed same-retailer
marketplace sellers, so a durable `SELLER_NOT_INDEPENDENT` gate was added.
Current strong independent candidates total 12 including the original two.
Database writes, offer writes, mapping writes and public changes remained zero.
The owner approved the exact 10 new rows on 14 August for a controlled `5 + 5`
rollout design, not for a production write. Revalidation found 10 unique
products, variants and listings, all still exact-GTIN `AUTO_ELIGIBLE` with no
blockers or review reasons. Existing-importer reuse is confirmed: the current
guarded product importer can create the missing eBay retailer and add mappings,
offers and price history to explicit existing variants through its dry-run,
artifact fingerprint, separate approval and atomic single-plan apply. No
second importer, schema or migration is authorized. `EBAY_EPN_CAMPAIGN_ID` is
now locally configured without entering the repository. The exact five Batch A
listings then passed a fresh item-ID refresh: 5/5 exact GTIN, 5/5
`AUTO_ELIGIBLE`, 5/5 eBay-returned affiliate URLs and zero blockers. The final
existing-importer dry-run produced five plans and zero blocked rows, touching
only a missing eBay retailer, five mappings, five offers and five price-history
rows; products and variants remain existing. A minimal importer correction
marks only newly created external-GTIN mappings as `gtin`/`100` while
preserving historical mapping metadata and idempotency. Because every preview
was generated before the retailer exists, the owner separately approved the
first exact bootstrap plan. GitHub run `31816406873` atomically created eBay UK
retailer `12`, mapping `2724`, offer `2539` and price-history row `2734`; the
canonical product and variant remained existing. The apply passed and was not
repeated when only the old postflight wording failed. Commit `ad3747b` changed
the assertion from the obsolete `unchanged`/`none` terms to the importer's
current `noop` contract and added a non-writing postflight mode. Run
`31817084379` passed, production readback matched the exact approved GTIN,
price, shipping, stock and affiliate URL, and the public product page exposed
the eBay offer through `/go/2539`. A fresh remaining-four dry-run then produced
four exact create plans, zero blockers and artifact SHA-256
`2c32c3de960cd52d4691d8fa1db35aa1bf02988205dd3ea2e829e858e0cdc096`.
The owner then separately approved exactly those remaining four. Commit
`63f34eb` sealed fresh artifact SHA-256
`b22cb5ac40dd870aa45cec6b0773bd2cff8344305b14b9120a2ffc7c6e96b393`
and restricted the active executor to only that scope. GitHub run
`31820209540` executed 4/4 and its immediate postflight returned four exact
no-ops with zero blockers. Production now has one eBay retailer, mappings
`2724`-`2728`, offers `2539`-`2543` and price-history rows `2734`-`2738`.
All mappings are unique `gtin`/`100`, all offers are in stock with known free
delivery and affiliate URLs, and the canonical product/variant GTIN fields
remain untouched. Public HTTP readback passed 5/5 with the exact eBay price and
offer route on every product page. Batch A is complete and live-verified;
Batch B was then revalidated through the same unchanged read-only path. The
five exact approved item IDs returned 5/5 expected GTINs, 5/5
`AUTO_ELIGIBLE`, 5/5 affiliate URLs and zero blockers/review reasons. A fresh
existing-importer dry-run produced five plans, zero blocked rows and zero
skipped rows; retailer, products and variants remain existing, while each plan
would create only one `gtin`/`100` mapping, one offer and one price-history
row. Dry-run artifact SHA-256 is
`916c8a8717193491e81e1391438794c634f7c22288b9d1770a71e9145376fdd3`.
At that checkpoint no Batch B write had occurred; its next action was owner
review and exact approval of those five sealed plans.
The owner then explicitly approved those exact five plans. Commit `0b2db32`
reused the existing manual executor with rollout fingerprint
`47532d6b515cdb5d96a42d2ac630d530693b62cc5f7aeaf2f40f84d8dd550a65`.
GitHub run `31824324247` executed 5/5 and its fresh postflight returned five
exact no-ops with zero blockers. Production created mappings `2729`-`2733`,
offers `2544`-`2548` and price-history rows `2739`-`2743`; retailer `12` and
all canonical products/variants remained existing, and canonical GTIN fields
were unchanged. Production has exactly 10 unique eBay mappings and 10 offers,
with no duplicate eBay variant, GTIN or item identity. Public verification
passed 5/5 for Batch B with HTTP 200, exact delivered prices and `/go/2544`-
`/go/2548`. The controlled 10-offer rollout was live-verified 10/10 before the
subsequent Batch C work below.
The owner subsequently rejected Boditronics Mass Attack Vanilla, retained
BioTech Iso Whey behind the canonical-parent drift blocker and approved seven
exact replacements. The current Critical Cookie family was first corrected
from stale 85 g data to manufacturer-confirmed 73 g through guarded migration
`20260814213000_correct_critical_cookie_73g_identity.sql`, preserving its URL,
GTINs and existing retailer/offer records. Fresh eBay item refresh and importer
dry-run returned seven exact create plans and zero blockers. Commit `9736d74`
sealed the existing executor to the seven-row artifact and owner confirmation.
GitHub run `31843061483` executed 7/7, creating mappings `2734`-`2740`, offers
`2549`-`2555` and seven history rows. Apply was not repeated when only the
postflight assertion rejected one metadata-equivalent Critical Cookie mapping;
commit `080f219` corrected that exact check and non-writing postflight run
`31869339692` passed. Independent production and public readback passed 7/7.
Production now has exactly 17 eBay mappings and 17 offers.

The next binding read-only monitor checked all 17 exact live items. All remain
available and affiliate-ready, with zero blockers and zero price, shipping or
delivered-total drift; three retain only their previously owner-accepted lack
of a returned GTIN. A fresh production discovery rebuild found 339 current
eligible one-retailer external-GTIN identities, but every identity had already
been exact searched and all 137 relevant exact-search misses had already been
title searched. The current catalogue therefore contains no unseen candidate
pool. A bounded refresh of the remaining 36 unresolved candidate/listing pairs
found 27 live: 10 same-retailer rejects, 15 without returned GTIN, two exact-
GTIN narrow reviews and nine unavailable. Independent evidence then confirmed
the missing 392 g size for Warrior Rage Blazin Berry and the powder format plus
250 g size for JNX The Curse Pina Colada. The owner approved exactly those two
rows for preparation and dry-run. A fresh exact-item refresh passed both, and
the existing importer produced two create plans with zero blocked rows. The
initial feed-mode preview remained non-writing; the executor test required the
established manual plan kind, so the same exact scope was regenerated as the
binding artifact SHA-256
`b7e3491b8e852e0c0c30bad668b3256bfaa63119cf9e5a51f792941baf1b0779`.
The owner approved production apply of exactly those two plans. Commit
`6e4aabf` sealed them into the existing executor, and manual workflow
`31873994325` executed 2/2 with an immediate two-row no-op postflight.
Independent production readback confirmed mappings `2741`-`2742`, offers
`2556`-`2557`, histories `2751`-`2752`, 19 total unique eBay mappings/offers
and zero duplicate variant or GTIN identities. Public readback passed 2/2.

Future agents must read the eBay plan's `Current status` and `Next action` and
update that plan after every eBay task. The 16 August missing-GTIN audit below
supersedes the earlier monitor-only next action; the existing 19 live eBay
offers still remain under read-only monitoring.

On 16 August 2026 a fresh SELECT-only catalogue audit opened the next safe
source of new identities without repeating eBay searches. It checked 2,641
variant rows and found 904 active identities across 406 products with exactly
one fresh non-eBay retailer, no eBay mapping and no valid product, variant or
retailer-mapping GTIN. A bounded, fingerprinted priority cohort contains 50
distinct products: 13 Creatine, 20 Whey Protein and 17 Vitamins, sourced from
25 Six Pack Supplements, 20 Jon's Supplements and five Discount Supplements
rows. Ten internal weight conflicts were excluded. This is a barcode-recovery
queue only. Its read-only confirmation is now complete: 36 are `CONFIRMED`,
six remain `REVIEW`, eight are `CONFLICT` and none are `NOT_FOUND` (72%
confirmation rate). A production SELECT-only collision check stopped one
same-product variant association and one cross-product GTIN collision. No GTIN
or offer was written and no eBay call occurred. The existing guarded
`GTIN_PROMOTION` mechanism remains the sole future write path. The binding next
action is owner review of exactly the 36 confirmed variant-GTIN candidates;
the six review and eight conflict rows remain blocked. eBay discovery may be
rebuilt only after separately approved promotion.

The owner authorized that exact 36-row review on 16 August. A fresh production
readback and the existing promotion planner returned 36
`APPROVE_CANDIDATE`, 0 `OWNER_CHECK_REQUIRED`, 36
`product_variants.gtin` destinations, 36 future writes and 0 already-present
no-ops. There were no checksum, canonical, duplicate, retailer-mapping,
quarantine or identity-drift anomalies. The review itself made zero writes and
does not authorize apply. The binding next action is a guarded, non-writing
`GTIN_PROMOTION` dry-run for exactly those 36 rows using the existing mechanism;
the six review and eight conflict identities stay excluded.

That exact-36 dry-run is now complete. A code-bound allowlist matching the
documented owner scope returned 36 `READY_TO_PROMOTE`, 0 `ALREADY_PRESENT`, 0
`MANUAL_REVIEW`, 0 `BLOCKED`, 36 empty `product_variants.gtin` destinations
and zero writes. Scope fingerprint:
`415142d4ba069103441a908bba4a15c3de73a828b9b7896a8556e29f32a97c02`;
preview fingerprint:
`141b60e898ec1eb41a5482d1c481f19d4064867091c3917a99ab0934efe141e8`.
The dry-run cannot validate or apply and leaves the completed exact-45 release
contract unchanged. The binding next action is design of a minimal guarded
exact-36 write extension on the existing approval/RPC framework, without
migration deployment or apply; that requires separate authorization.

The existing `gtin:promotion` artifact builder now implements that local
exact-36 contract without a second importer. It produced a 36-row immutable
plan (`b1b8996d1555ed0dbf48f952ef1c75a7cefd4cdfb78e052516eb5ff0042f26c1`)
with plan fingerprint `98af96f0c6d1533495b828781a69a771` and zero writes.
Exact-36 validate/apply remain explicitly blocked until a separately reviewed
database migration is deployed, and the workflow still exposes no exact-36
release branch. The next necessary work is only that narrow migration and
existing-workflow branch, without deployment or apply.

That narrow extension is now built locally on the existing approval/RPC path.
It is closed to the exact 36 owner-reviewed variant GTINs, atomically requires
36/36 writes, retains stale/duplicate/quarantine/canonical checks and audit
consumption, and adds a guarded rollback. The existing workflow exposes only
the non-writing `preflight_exact_36` option; it cannot enter the production job
and no `release_exact_36` option exists. The migration is hash-bound and
explicitly excluded from staging and production selectors, so an unrelated
deployment cannot pick it up. Migration deployed: no. Production writes: 0.
Local focused/static gates passed. Manual GitHub Actions run `31959277752` on
commit `051a5129280c7174fb5f3d70aaa8db872e202677` then completed
`preflight_exact_36`: the full quality gate, exact contracts and disposable
PostgreSQL integration test passed, while the `production` job was skipped.
Migration deployed: no. Production writes: 0. The binding next action is a
separate owner review/authorization of migration deployment; the later atomic
36-row apply remains a different explicit decision.

The owner separately authorized migration deployment. Manual workflow run
`31960257039` on commit `66a066809d592ba8463afa5a9c53959c1835feca`
passed the full gate and PostgreSQL integration, skipped every artifact,
validate, GTIN apply and post-write step, and deployed only the exact-36 schema
migration. Independent production readback confirmed ledger count 113,
fingerprint
`000c4464c63fbfded955d8ca1a4a29b75e122fe277e34be33b30a5a6ddbaaed4`,
all exact-36/dispatcher functions present, 36/36 target variant GTIN fields
still null, zero approved GTINs assigned and zero exact-36 approval rows. The
one-time deployment option is removed from the current workflow and production
has no pending migration. The binding next action is a fresh exact-36 artifact
and guarded validate-only owner review; apply remains a separate decision.

The owner then authorized the exact 36-row production release. Manual workflow
`31961892019` created a fresh immutable artifact, sealed the pre-write state,
validated the exact scope and atomically applied 36/36 variant GTINs. Approval
`42c92610-1c2b-4c36-9790-fbe72ae43f50` was consumed with 36 audit rows. Its
first post-write step failed only because the read-only preview still enforced
the pre-apply expectation after a successful write. No apply was replayed.
After the verifier was corrected, read-only recovery workflow `31962357242`
reused the original artifact and baseline and passed with 36 verified writes,
36 already-present no-ops and zero anomalies. Products, offers and retailer
mappings matched the pre-write baseline; the 16 quarantined conflicts and
duplicate protections remained unchanged. The temporary release/recovery
workflow options were removed. The binding next action is to reuse and inspect
the existing eBay Browse discovery/import/refresh path for these newly
GTIN-enriched identities, beginning read-only and requiring owner review before
any new offer write.

The existing eBay Browse pilot was then minimally extended to accept the fixed
post-promotion `owner-reviewed-36` scope. Live read-only exact-GTIN discovery
checked all 36 and returned 0 auto-eligible, 1 review, 2 reject and 33 not
found. The existing title fallback checked 30 missing products and returned
one auto-eligible candidate, 13 review, 11 reject and five not found. The sole
safe row is product 1107 / variant 2401, Trec Nutrition Creatine Monohydrate +
Taurine 400 g, GTIN `5902114017811`, eBay item `204137434720`, GBP 19.95
delivered with an affiliate-ready URL. No database write occurred. The binding
next action is owner review of exactly that one listing, followed—only if
approved—by the existing guarded importer. eBay price/stock scheduling must
reuse the existing retailer-offer-sync framework and remains a separate
reviewed production enablement; it must not become a second importer.

The owner subsequently approved the sole exact-36 eBay candidate. Guarded
Batch E run `31963949261` created exactly mapping `2743` and offer `2558` for
product `1107` / variant `2401`; immediate importer postflight was a no-op and
the public product page and affiliate redirect were live verified at GBP 19.95
delivered. A thin exact-one eBay refresh adapter was then built on the existing
importer approval/apply RPCs. It directly reads only the approved REST item ID,
revalidates full identity and seller evidence, blocks automatic OOS on absence,
allows bounded volatile offer fields only, and uses the existing verified
no-change plan to keep `last_checked_at` current without false price history.
Its first live local production dry-run passed with zero writes. GitHub
read-only preflight and one guarded manual apply remain the activation gate
before the daily schedule is treated as enabled.
GitHub run `31964579226` subsequently passed workflow registration, context and
contract tests, then failed closed in the read-only preflight because
`production-readonly` lacks `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` and
`EBAY_UK_DELIVERY_POSTCODE`. Apply and postflight were skipped. Adding those
three existing values as GitHub environment secrets and rerunning dry-run is
the only activation next action; the code must not weaken this gate.
Scheduled apply additionally requires GitHub environment variable
`EBAY_REFRESH_ENABLED=true`, which must remain absent until the first manual
apply and its fresh no-op postflight both pass.

### 0.0.15 Owner growth-order and coverage checkpoint - 20 August 2026

This checkpoint supersedes older counts and next-action text elsewhere in this
document. Production read-only evidence records 1,070 active products, 2,087
public offers and 10 active retailers. Coverage is 200 products with no
retailer, 701 with one retailer, 169 with at least two retailers, 25 with at
least three and three with four retailers. The next commercial checkpoint is
250 products with at least two retailers, leaving 81 at this checkpoint.

The owner's immediate order is documentation reconciliation, `SEO-11`,
`SEO-14`, a fresh `SEO-13` Protein Bars recheck, the 250-product coverage
checkpoint, then `SEO-15`, `SEO-16` and `SEO-17`. `SEO-11` and `SEO-14` are
`LIVE VERIFIED`; `SEO-13` is now the single active SEO implementation. It
retains all completed and deferred evidence, its gate must not be weakened and
its completed pages must not be rebuilt.

The preferred first brand-page candidate after normalization is Applied
Nutrition. Its owner-approved page shipped in production commit `b7fae970` and
is live verified at `/brands/applied-nutrition`: the fresh page gate exposes 44
products, 199 recently checked offers from five retailers and 23 products with
current multi-retailer coverage across ten category groupings. It is the first
completed SEO-14 unit, not completion of SEO-14. GYM HIGH was audited next but
is now explicitly deferred from public brand-page publication to preserve the
independent positioning of SupplementScout and avoid an unwanted brand
association. Every other eligible page must use current canonical products and
offers, visible limitations, internal linking, canonical metadata, suitable
schema, sitemap inclusion and consent-aware analytics.

On 20 August the owner inserted and live verified one bounded page-quality
refinement before the GYM HIGH audit: all current comparison landing pages use
compact product imagery and a shared dated red offer-check badge, while the
public current-offer window returned from 24 days to exactly 24 hours. A
read-only production-data rehearsal retained index eligibility on all ten
audited comparison routes and found images for every rendered product on the
nine card-based routes. Owner-approved PR #19 shipped as production commit
`832e3dfe`; Vercel succeeded, and public HTTP plus desktop visual checks
confirmed the new cards and freshness language. This does not authorise a
second SEO task or a GYM HIGH page.

The subsequent fresh GYM HIGH gate audit is complete and read-only. Exact-brand
production coverage passes the unchanged brand-page contract with `23` visible
products, `88` fresh offers, `14` multi-retailer products, `4` comparison
retailers and `8` categories; every visible product has an image. The current
official-source audit also passed at `26` parent products and `71` variants with
the normalized baseline fingerprint unchanged. Product `185`, `GYM HIGH
Slimming Protein 1000g`, retains the noncanonical `GYMHiGH` spelling but is no
longer present in the official-source catalogue and has zero fresh offers. It
must remain outside any exact-brand selection unless a separate owner-reviewed
identity correction is approved. Despite passing the numerical gate, GYM HIGH
is owner-deferred from publication. Do not build, link, index or otherwise
promote a `/brands/gym-high` landing page; select a different SEO-14 candidate.

### 0.0.16 Owner-approved Protein P0 checkpoint - 23 August 2026

This checkpoint supersedes the immediate next-action wording below without
changing the roadmap order. The owner explicitly approved one bounded P0 safety
stage before the active `SEO-13` Protein Bars recheck. `SEO-13` remains the
single active SEO implementation; Protein Bars resumes only after this P0 is
released and live verified.

The P0 reuses the existing exact-variant model and central nutrition/value
resolver. A selected gram variant whose pack differs from the product base now
fails closed unless its override is complete, verified and bound to manufacturer
evidence. Price per kg may use the exact structural variant weight, while cost
per serving, cost per 25g protein and other serving/nutrition-dependent metrics
remain hidden. The same resolution is used by Whey Protein, Whey Isolate, Vegan
Protein and Mass Gainer comparisons. No production nutrition, price, offer,
mapping, canonical identity or retailer data was changed.

The five known mismatches remain evidence-only and blocked in
`docs/Protein-Exact-Variant-Nutrition-Review-2026-08-23.md`. The existing named
nutrition-approved plan/apply path is product-level today, so no exact-variant
data can be written until a separate owner-approved guarded extension exists.

The sitemap now omits readiness-gated routes that currently declare noindex.
The pre-change production count was seven, not eight: `/hydration`,
`/whey-isolate`, `/mass-gainer`, `/multivitamins`,
`/brands/applied-nutrition`, `/brands/per4m` and `/brands/biotech-usa`.
Reviewed product links prefer `/whey-isolate` or `/vegan-protein` where their
existing subtype boundary applies, using `/whey-protein` only as the broad
fallback. No hub copy or URL inventory changed.

Focused tests passed `55/55`; TypeScript, the quick gate and the full gate with
the production build passed. This is local `CODE COMPLETE` evidence only. No
push, deployment, refresh workflow or production write occurred. GYM HIGH
remains owner-deferred from brand and retailer publication.

### 0.0.17 SEO-13 Protein Bars LIVE VERIFIED checkpoint - 23 August 2026

The owner accepted Protein P0 as completed and production verified, without
authorising any further P0 change. The bounded Protein Bars unit is now
production verified and `SEO-13` is complete.

A fresh production read-only audit at `2026-08-23T13:28:18.905Z` found `52`
active, unmerged canonical products in exact category `Protein Bars`, `183`
active variants and `187` embedded offers. Reviewed product-format,
active-variant and consistent known-pack controls leave `10` eligible products.
Within 24 hours, `4` products have `27` fresh exact-pack offers from `3`
retailers; `3` products have at least two current retailers and there are `2`
comparison retailers. The unchanged `3 / 2 / 20` gate therefore passes at
`3 / 2 / 27`. Every included offer has a known delivered price.

The visible packs are Grenade Carb Killa Protein Bar `1 x 60g`, Optimum
Nutrition Protein Crisp Bar `10 x 65g`, Clif Bar Energy Bar `12 x 68g` and
PER4M Protein Bars Box `12 x 62g`. Mixed or unresolved packs fail closed.
Verified product-level unit-count coverage is `0/4`, so exact pack and delivered
price are visible while price per bar and nutrition-dependent value metrics are
not inferred or rendered.

The `/protein-bars` implementation reuses the existing comparison,
variant-resolution, delivered-price, freshness, analytics, readiness-sitemap,
metadata and schema mechanisms. It adds one reviewed route and no dynamic page
generator, catalogue variant or data importer. Focused regressions, TypeScript,
Project Guardian, the quick/full quality gates, the production build and a
local production-server check passed. Commit
`c1f97bc7cb783bca9d0edf28a7aeed6eb2bdfc2f` was pushed to `main`; production
deployment `6048852742` and the post-push Quality Gate succeeded. Public HTTP,
canonical, `index, follow`, schema, single sitemap entry, exact-pack product
set, known delivered prices, current check date and internal links passed.
Mixed and unresolved packs remained excluded, unverified per-bar and nutrition
metrics remained hidden, and no checked URL returned `5xx`. No refresh workflow
or production-data write occurred. GYM HIGH remains owner-deferred.

One unrelated technical SEO follow-up is recorded but explicitly excluded from
SEO-13: the homepage lacks an explicit self-canonical and emits no JSON-LD.
Either change requires separate owner approval.

The next production read-only SEO-14 opportunity audit reviewed every other
canonical brand through the same 24-hour and `20 / 10 / 3 / 50 / 5` contract.
Only Per4m and BioTech USA passed. Per4m is the stronger first candidate at `33`
visible products, `177` fresh offers, `12` multi-retailer products, `5`
comparison retailers and `7` categories, with images on every visible row. Its
identity is already normalized to exact canonical brand `Per4m`. Official
first-party evidence supports one bounded content treatment: product `328` is
Whey Isolate and product `1010` is Plant Protein, so those two page display
groups override misleading internal category labels without changing the
catalogue. The owner approved one `/brands/per4m` page; production commit
`bc4f4864` is now live verified with successful Vercel and post-merge checks,
public HTTP `200`, canonical/indexable metadata, schema, current coverage,
sitemap and product-link evidence. No dynamic brand generator or catalogue
correction is authorised.

eBay Batches J, K, L and M are complete. Batch M added exactly two
owner-approved whey-isolate offers in protected run `32472639897` (mappings
`2825`-`2826`, offers `2639`-`2640`) after PR `#29` merged as
`3c444c9d3083512102b9168ed192b0c2ae9a0fc8`. The shared refresh is exact 102;
read-only run `32472882697` passed 102/102 `verify_no_change` with zero blocked
rows and zero writes, retaining artifact `9443283850`. Independent readback and
both public product pages passed. Do not recreate Batch M, return to exact 100
or add another eBay batch before the 250-product coverage phase.

The owner subsequently restarted bounded eBay coverage work and approved 19 of
a numbered 20-listing candidate set; original row 5, Applied Nutrition Cream of
Rice 2 kg Apple Crumble, remains excluded. PR `#34` merged the sealed Batch N
release as `7e9ed7dab7bd7a52292db4bddb622dcaf37bff0c`. Protected run
`32515389182` passed 19 fresh direct-item checks, created mappings `2827`-`2845`
and offers `2641`-`2659`, and passed the exact 19-row no-op postflight.
Independent readback verified all identities, prices, known shipping, delivered
totals, stock, affiliate URLs and price history; a second importer dry-run
returned 19 no-ops and zero blockers. All 19 public product pages returned HTTP
200 and exposed the exact new offers. eBay now covers 88 products, including 75
with exactly two current retailers, 12 with three or more and one eBay-only
product. The same shared refresh is exact 121; protected read-only run
`32515999463` passed 121/121 `verify_no_change`, zero blocked rows and zero
executions with automatic-OOS blocking retained. Batch N is live verified and
must not be replayed. A fresh production-wide read-only measurement after the
release found 1,070 active products and 2,133 positive-price in-stock offers:
200 products have no current retailer, 683 have one and 187 have at least two;
27 have at least three and three have at least four. The 250-product checkpoint
therefore has 63 remaining.

The owner subsequently approved all 20 numbered Batch O eBay listings and
instructed completion without repeated confirmation. PR `#36` merged the exact
guarded package as `abfab8d278c4ad0d5947f910d6cf6ceb162a8730`. Protected run
`32522579829` passed 20 fresh business-seller reads, created mappings
`2846`-`2865` and offers `2660`-`2679`, and passed the 20-row no-op postflight.
Independent production readback verified 141 unique eBay mappings/offers and
all new identities, prices, known shipping, delivered totals, stock,
Campaign-ID URLs and price-history rows. A second importer dry-run returned 20
no-ops and zero blockers; 20 exact offers were visible on 12 HTTP-200 product
pages. Eleven rows have returned GTINs and nine missing-GTIN rows are sealed to
their exact reviewed identity, business seller and evidence set. The five-row
BioTech shared-parent contract remains exact and does not widen the general
identity rule. PR `#37`, merge SHA
`8fd752ccaa3944bf14b8d97e4ec1e9360b9cd33f`, completed the nine refresh
continuity bindings. Final protected read-only run `32524454146` passed 141/141,
zero blocked, zero executions and retained automatic-OOS blocking. Batch O is
live verified and must not be replayed. Current production-wide readback has
188 products with at least two current retailers, leaving 62 to the approved
250-product checkpoint.

The owner then approved all 20 numbered Batch P listings, including the four
disclosed seller-threshold exceptions. PR `#39` merged the exact package as
`eddd2c156235e3409c4693a7322370c344978909`. Protected run `32561910587`
passed its fresh preflight and executed all 20 plans, creating mappings
`2866`-`2885`, offers `2680`-`2699` and 20 initial price-history rows. Its
failure conclusion was confined to a false Critical Cookie postflight conflict
after all writes; no replay occurred. Artifact `9473044920` has digest
`890efa2fff695fc0960556da0aef6aeae96160348299c43414e3ec607e079c7c`.
Independent readback verified all 20 rows, and the corrected importer
postflight returned 20 no-ops, zero blockers and SHA-256
`37b25c7c13057259a00132f50b85afe4a77b76f1cb2213a30e68aa7286985867`.
All 13 distinct public product pages returned HTTP 200 and displayed eBay UK.
PR `#40` merged the exact postflight correction and extension of the same
shared refresh as `e6817538ebf8cc8d1ee9479cf3ae981843b9a84c`. Protected
read-only run `32563234233` passed 161/161 `verify_no_change`, zero blocked
rows, zero executions and retained automatic-OOS blocking; artifact
`9473405068` has digest
`30ae68b07607d18e24d12a00371731f7d98d13b734376e6a98bb6176630d6fcf`.
At the Batch P closeout, the production-wide checkpoint was 191/250 products with at least two
positive-price in-stock retailers, leaving 59. Batch P's earlier nine-row
projection was variant-level; canonical-product deduplication shows a net
three-product KPI increase.

The owner reviewed Batch Q, rejected original rows 3 and 5 with `3, 5 nie.`,
approved their exact replacements with `akcepuje`, and the rejected identities
remained excluded. PR `#42` merged the exact final 20-product package as
`1f7860b5a68010c0d0577082cd7d8dcbd21bf34d`. Protected production run
`32569395781` passed 20 fresh business-seller reads, executed 20/20 and created
mappings `2886`-`2905`, offers `2700`-`2719` and 20 initial price-history rows.
Artifact `9474935669` has digest
`b963935069aec2fc01838c57bfd37690c8b1573168816965fee66da52adf5e60`;
its immediate postflight returned 20 exact no-ops and zero blockers.
Independent production readback verified every identity, price, known shipping,
delivered total, stock state, Campaign-ID URL and history row. All 20 public
product pages returned HTTP 200 and displayed both eBay UK and the exact new
offer link. PR `#43` extended the same shared refresh to exact 181 as
`cdf25c1902bec7ed7f83264c6a448e7f414fa7b8`; protected read-only run
`32571366605` passed 181/181 eligible, zero blocked and zero writes. The live
production-wide checkpoint is now 211/250 products with at least two
positive-price in-stock retailers, leaving 39. Batch Q is **LIVE VERIFIED
20/20** and must not be replayed.

The owner then approved the 11 final replacements and production apply for
Batch R. The exact 39 approved identities resolved to 38 guarded creates plus
one verified existing no-op for Applied Nutrition Critical Greens (mapping
`2888`, offer `2702`), preventing a duplicate. PR `#45` merged the release as
`d60737c4d0e62aaa1e8bb20382bbbf18f2b5812d`; protected production run
`32627418960` created mappings `2906`-`2943`, offers `2720`-`2757` and 38
history rows, then passed its 38-row postflight. Independent production
readback and all 38 public product-page checks passed. PR `#46` extended the
same shared refresh to exact 219 as `8392fd9a0b085d01a452687f686bef32df5b46f9`.
Protected production-readonly run `32628541876` passed 219/219
`verify_no_change`, zero blockers and zero writes; all apply steps were skipped
and automatic-OOS blocking remains active. The authoritative multi-retailer
checkpoint is now 232/250, leaving 18. Batch R is **LIVE VERIFIED 39/39** and
must not be replayed.

The owner then approved all 18 final Batch S listings with `wszystkie sa
dobre`. PR `#48` merged the exact guarded package as
`e76289a2b1fc20dd8b2ecdb14a2e872ae89c125e`. Protected production run
`32632336319` freshly re-read all 18 listings, created mappings `2944`-`2961`,
offers `2758`-`2775` and 18 history rows, then passed its exact 18-row no-op
postflight. An independent production-owner read verified all 18 active
positive-price offers and the deduplicated KPI at **250/250**. PR `#49` merged
the same 18 identities into the one shared guarded refresh, expanding its
sealed scope from 219 to 237. Its first production-readonly run `32632937687`
verified offers `2539`-`2669` (131 rows), then eBay source reads were
rate-blocked for the contiguous remainder `2670`-`2775`; all 106 affected rows
failed closed as `SOURCE_READ_FAILED`, automatic OOS remained blocked and the
run made zero writes. Batch S is **LIVE VERIFIED 18/18**, the 250-product
multi-retailer coverage milestone is complete, and Batch S must not be
replayed. The combined 237-row refresh still requires a later complete
production-readonly pass after the eBay read limit resets; this operational
evidence gap does not change the independently verified 250/250 KPI.

### Binding catalogue exclusion policy - 27 July 2026

This is a global SupplementScout catalogue rule. It applies to every retailer, source, importer, discovery report, approval artifact and automated refresh, regardless of retailer consent or commercial value.

- Never add a product with positive evidence that its expiry or best-before date had already passed at the source-capture time.
- Never add SARMs.
- Never add real peptide or research-peptide products.
- Ordinary collagen, collagen peptides, hydrolysed protein and ordinary protein-peptide wording are not prohibited peptide products and may pass through the normal identity and safety review.
- Owner confirmation on 29 July 2026: sauces, syrups, jams, spreads, protein bars, protein cookies, porridge and oats, pancake mixes, ready-to-drink shakes and liquid egg whites are ordinary allowed catalogue types. They must pass the same identity, variant, pack-size and evidence review as other products, but must not be excluded merely because they belong to one of these food types.
- Missing expiry metadata, out-of-stock status, discontinued status or absence from a later source does not prove that a product is expired. Such rows must be classified using the available evidence and must never be labelled expired by inference.
- Prohibited rows must remain outside products, variants, retailer mappings, offers and routine automation. They must be recorded as explicitly excluded rather than silently dropped.

### 0.0 Latest execution update - 19 July 2026

`/creatine` is launched and indexable. Its current-price ranking, retailer ranking and JSON-LD use fresh offers only; stale/no-source offers remain excluded from current-price claims.

Daily Discount Supplements offer refresh remains on the proven workflow path `.github/workflows/creatine-offer-refresh.yml` and runs at `06:47 UTC`, after the read-only snapshot at `06:17 UTC`. Its exact scope is now 14 owner-approved Shopify variant identities: the earlier 12 creatine offers plus Strom MultiMAX and TBJP The One. The legacy filename is retained to avoid replacing a working workflow, while its displayed name and reports now say Discount Supplements. Fit House and Jon's Supplements remain excluded because their complete automations own those offers. The job may update only price, stock, offer URL, `last_checked_at`, and price history when delivered-price inputs genuinely change. It must not create products, variants, mappings, retailers, merges, deletions or identity repairs.

On 11 August 2026 the overlapping Fit House and Jon's Supplements rows were
removed after their full retailer automations passed fresh production dry-runs.
The shared read-source, classifier and generic safety guards remain unchanged;
only the exact routine scope and non-colliding schedule changed.
The first manual GitHub Actions dry-run from the resulting main commit
`850d6d7` completed successfully as run `31472813466`: all 12 authorised
Discount Supplements offers were verified without production writes.

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
- On 29 July 2026 a later guarded production refresh detected 11 genuine
  stock-only changes across the 506-offer scope. Two identical fresh GB
  captures, complete 228-product/854-variant source coverage and all direct
  URLs passed. The exact reviewed apply changed stock and freshness for 11
  offers (10 to OOS, one to in stock); product, variant, mapping, offer and
  price-history row counts, prices, shipping and URLs changed by 0. The
  consumed authorization cannot be replayed.
- The same review exposed one pre-existing catalogue label error: Jon's
  EssentialMAX source variant `50781369696594` was Berrylicious 450 g but
  canonical variant `1260` was still labelled `Default`. Exact guarded
  migration `20260729210000` corrected that existing variant and mapping
  metadata without creating or deleting any row. No other retailer used the
  variant.
- The fresh ordinary post-apply dry-run then returned 506/506
  `VERIFY_NO_CHANGE`, zero missing mappings, zero blockers and zero price,
  stock or URL actions. Source coverage was 228 products and 854 variants.
- On 31 July 2026 the two following scheduled failures were traced to bounded
  false positives rather than source or database failure. Jon's had added an
  optional SKU to an unchanged Shopify variant; permanent identity remains
  bound to the stable Shopify product and variant IDs. Validation children are
  now risk-balanced so a small final child cannot misrepresent the full
  506-offer OOS ratio. Normal stock turnover is allowed when total OOS falls
  and the unchanged global mass-change, price and total-OOS guards all pass.
- The same live preflight exposed two older default-label catalogue defects.
  Production migration `20260731120000` relabelled only existing variants
  `1188` as Berry 465 g and `1261` as Fizzy Blue Bottles 300 g, and corrected
  only Jon's mappings `1302` and `1375`. Products, variants, mappings, offers
  and price-history row counts all remained unchanged. A fresh production
  dry-run then matched 506/506 offers and validated all 11 children: 485 no
  change and 21 stock-only updates, with zero price, shipping or URL changes.
- Protected GitHub run `30639975807` then completed successfully on commit
  `e3d7fec`: it applied the 21 stock-only changes across the complete 506-offer
  scope and refreshed all 506 offers. Products, variants, mappings, offers and
  price history changed by zero rows. The final fresh idempotency check returned
  `VERIFY_NO_CHANGE` for all 506 offers and zero business-field changes.
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

### 0.0.18 SEO Indexability Lifecycle corrective P0 - 24 August 2026

The owner approved a corrective P0 inside active `SEO-15` after the sitewide
indexability audit found launch state coupled to hourly coverage. The already
live-verified `/protein-bars` and `/vegan-protein` routes had changed to
`noindex` and disappeared from the sitemap when fresh coverage fell; the other
live dynamic comparison, brand and retailer hubs using the same pattern were
exposed to the same flapping risk.

The corrective implementation has one central lifecycle map covering 15
approved public `live_verified` routes and separate non-public
`owner_deferred` decisions for GYM HIGH. Base robots and sitemap eligibility
use the same state. Existing readiness thresholds remain launch evidence and
monitoring; they no longer automatically deindex a live-verified route. Current
freshness, stock, exact-variant, exact-pack, delivered-price and retailer rules
still determine the rows visible to users.

Successful hub data uses one shared Next.js `unstable_cache` loader with a
3,600-second maximum, route-specific and query-versioned keys and a hard hourly
bucket. Valid empty results remain honest successful states. Loader errors and
proven partial results throw and cannot become false empty pages. Fifteen thin
route-level boundaries reuse one neutral component whose retry calls Next.js 16
`unstable_retry()`; no global error behavior was added.

The sitemap reads lifecycle without coverage queries and throws on product
query failure, missing exact count, count drift or incomplete pagination. The
durable implementation contract is `docs/SEO-Indexability-Lifecycle.md`, with
mandatory registration in `AGENTS.md` and focused tests for public registry
routes, fail-closed unknown routes/statuses, robots, sitemap, cache, errors,
parameters and the SEO-04 exception.

Focused lifecycle/cache/error/hub/sitemap/robots/canonical tests passed
`166/166`. TypeScript, Project Guardian, `git diff --check`, quick/full quality
gates, ESLint with zero errors and the production build passed; seven existing
GYM HIGH/Six Pack lint warnings remain unchanged. This checkpoint is `CODE
COMPLETE, live evidence pending`. No commit, push, deployment, refresh workflow
or production-data write has occurred. SEO-15 Stage 1 current deals was already
deployed and live verified before this corrective P0. Stage 2 identity-proven
observations and Stage 3 historical claims have not started. The binding
roadmap remains SEO-15, SEO-16, SEO-17.

### 0.0.19 SEO Indexability Lifecycle corrective P0 LIVE VERIFIED - 24 August 2026

The corrective lifecycle implementation is formally `LIVE VERIFIED`. Commit
`1f7bfc08075899849f22f5bf80b978fe7cb60de3`, `Stabilize and document SEO
indexability lifecycle`, changed `58` files and deployed successfully through
Vercel production deployment `2bmj7eiPXnL3pNmCcy8av3TyCg6f`. Public live
verification passed for all 15 approved routes: `/deals`, `/whey-protein`,
`/vegan-protein`, `/protein-bars`, `/whey-isolate`, `/mass-gainer`,
`/pre-workout`, `/amino-acids`, `/multivitamins`, `/creatine`, `/hydration`,
`/brands/applied-nutrition`, `/brands/per4m`, `/brands/biotech-usa` and
`/retailers/ebay-uk`.

Every route returned HTTP `200`, emitted `index, follow`, used its correct
self-canonical and appeared in the sitemap exactly once. Parameter URLs emitted
`noindex, follow` and canonicalized to their base route. SEO-04 remained
unchanged. The sitemap contained `1,096` unique URLs, including `1,070` product
URLs, with `0` duplicates and no GYM HIGH URL. Normal reads produced no false
empty lists or HTTP 5xx responses; the shared cache shortened subsequent
reads. Homepage, a representative product, About, How we compare, empty search
and `robots.txt` showed no regression.

The deterministic test-fixture correction shipped in commit
`c8a48c484a7fe6c1b32b91e77535ec6a13b916d7`, `Fix Project Guardian negative
evidence fixture`. Project Guardian run `32737495813` and Quality Gate run
`32737495783` succeeded. Full job `97463732331` succeeded, Integration job
`97463733544` was correctly skipped and Vercel deployment
`ZVxadQiAwXhgL4xfC36cw7JKcrF4` succeeded. The release and verification ran zero
refresh workflows and performed zero production-data writes.

SEO-15 remains `IN PROGRESS`. Stage 1 and the corrective lifecycle P0 are live
verified. Stage 2 identity-proven observations and Stage 3 historical claims
remain not started. Stage 2 is the next bounded SEO-15 unit under its existing
separate migration, test, volume and rollback approval gates. The binding order
remains SEO-15, SEO-16, SEO-17. GYM HIGH remains owner-deferred.

### 0.0.20 SEO-16 guarded two-product comparison CODE COMPLETE - 26 August 2026

The bounded SEO-16 implementation is code complete and awaiting an explicit
lifecycle launch decision. `/compare` is one Server Component with `left` and
`right` query selections; it does not create indexable pair routes or a second
comparison engine. It reuses the shared canonical product comparison,
retailer-product variant resolution, current-offer freshness, delivered-price,
verified nutrition, cache, canonical, robots and error contracts.

Eligibility is fail-closed to active unmerged products with a fresh in-stock
offer, known delivery and an active exact canonical variant with explicit
positive `pack_count`, `size_value` and `size_unit`. Base-product fields and
names are not used as exact-pack fallback, pack count is never assumed to be
one and missing metrics remain omitted. The UI shows exact pack, known
delivered total, offer/retailer coverage, check time and only verified metrics;
it makes no winner, effectiveness, quality or suitability claim.

The route is centrally registered as `planned`, so base and parameter states
remain `noindex, follow`; all states canonicalize to `/compare` and the sitemap
adapter filters the planned route from the served sitemap. A homepage link,
scoped lifecycle error boundary and WebPage/BreadcrumbList schema are present.
Read-only local SSR against current production data found `304` eligible
products. The base route and a real pair (`756`, `757`) returned HTTP `200`,
the correct canonical, planned `noindex`, exact pack and known delivered total.

Focused tests passed `22/22`. Project Guardian, `verify:quick`, `verify:full`,
TypeScript, ESLint with zero errors, `git diff --check`, all `236` safe tests,
baseline migration validation and the Next.js 16.2.9 production build passed;
seven pre-existing GYM HIGH/Six Pack warnings remain. Commit
`5d9f48525e2a947fee067a2cf473063eb9bd227e` was pushed to `main` and reached
the connected production site. Public smoke evidence passed for the base route
and pair `756/757`: HTTP `200`, `301` current eligible products, exact
variant/pack, known delivered total, canonical/noindex, homepage discovery and
zero sitemap entries. No workflow, backfill, migration or production-data
write ran. The owner explicitly approved launch on 26 August 2026; the bounded
`planned -> launch_approved` lifecycle change is now authorized, while query
parameters remain `noindex` with the base canonical. SEO-16 remains `IN
PROGRESS` until launch-approved public verification. After SEO-16 completion, the
binding sequence returns mandatorily to blocked SEO-15 accrual audits before
SEO-17. GYM HIGH remains owner-deferred.

### 0.0.21 SEO-16 guarded two-product comparison LIVE VERIFIED - 26 August 2026

The owner-approved lifecycle launch shipped in commit `7eec604`. Public
verification passed for base `/compare`: HTTP `200`, `index, follow`, correct
canonical, `301` currently eligible exact-pack products, homepage discovery
and exactly one sitemap entry. Pair `?left=756&right=757` returned HTTP `200`,
`noindex, follow`, the base canonical, exact variant/pack evidence and a known
delivered total. No pair URL was added to the sitemap. Production trace
`lhr1::iad1::s9bc7-1787719525430-eb1430eecfc9` records the verified response.

The central lifecycle state is now `live_verified`. No workflow, backfill,
migration or production-data write ran. SEO-16 is complete and no SEO
implementation is currently `IN PROGRESS`. The binding next task is SEO-15,
which remains truthfully `BLOCKED` until the earliest 14-day audit on 8
September 2026; the recommended first publication decision remains after 24
September. SEO-17 must not start before that mandatory return. GYM HIGH remains
owner-deferred and public Stage 3 price-drop claims remain disabled.

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

Latest confirmed production counts and public coverage after the 28 July 2026
audit:

- `products`: 1062
- active canonical products: 1061
- `product_variants`: 2370
- `retailer_products`: 2365
- `offers`: 2364
- `price_history`: 2390
- active public offers: 2021
- active retailers: 9

Latest product-level commercial coverage snapshot, counting distinct retailers with an in-stock offer for each active, unmerged canonical product:

- active canonical products: 1061,
- products with at least one active retailer: 879,
- products with at least two active retailers: 107,
- products with at least three active retailers: 13,
- products with at least four active retailers: 2.

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

On 11 August 2026 a fresh double source read and production dry-run identified
exactly 12 stock-only changes in existing Discount Supplements offers: 11
`in_stock -> out_of_stock` transitions and one restock. The owner approved the
exact offer/mapping list. Immutable package validation passed in GitHub run
`31479221584`; protected run `31479348558` then applied all 12 through the
existing approver/importer executor roles in one executor transaction. Prices,
shipping, delivered totals, URLs, catalogue identities and price history were
unchanged. A fresh full Stage 1 postflight returned zero remaining offer or
stock changes. The consumed manual workflow is archived in
`docs/archive/completed-workflows/`; the normal daily Stage 1 remains read-only.

On 11 August 2026 the owner approved two exact existing-product overlaps for
the SEO-13 Multivitamins gate. Production migration
`20260811113000_add_two_reviewed_discount_multivitamin_offers` corrected TBJP
The One from tablet/unknown count to 60 capsules, recorded Strom MultiMAX as
180 tablets and added only their Discount mappings, offers and first history
rows. Exact catalogue deltas were products `0`, variants `0`, mappings `+2`,
offers `+2`, history `+2`. Applied Nutrition Multi-Vitamin Complex remained
deferred. The same existing scheduled Discount refresh was expanded from 12 to
14 immutable Shopify variant identities; no new importer or schedule was
created. Fresh postflight returned 14 `VERIFY_NO_CHANGE`, zero blockers and
zero writes. Both public product pages returned HTTP 200 and displayed the
Discount Supplements offer.

### 8.6 Fit House

Completed:

- working Shopify adapter/source,
- CSV and live Shopify comparison,
- Batch F canonical catalogue work,
- Batch F image work, including 12 verified canonical image backfills,
- Batch F 36 production mappings/offers/history,
- RTD, snack and servings evidence support,
- public UI verification for Batch F.

Fit House has one scheduled guarded offer-refresh workflow at `02:47 UTC`.
Its binding current status and safety boundary are recorded in section 0.0.6A
and `docs/Retailer-Data-Source-Registry.md`.

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

The binding growth priority is section 0.0.7. Sections 0.8 through 0.10 retain
the detailed commercial execution method and historical context. Work proceeds
with one SEO implementation and at most one separately scoped primary
retailer/data implementation at a time.

Current priority order:

`SEO-11` and `SEO-14` are complete and live verified.

1. Resume `SEO-13` for the bounded Protein Bars recheck without repeating its
   completed pages or weakening its gate.
2. Multi-retailer coverage from the current 169 products to 250.
3. `SEO-15` deals and price drops from existing offer/history data.
4. `SEO-16` guarded two-product comparison.
5. `SEO-17` owner-reviewed expert decision notes.
6. Continuous weekly GSC/GA4 measurement; outbound outreach remains paused.

The complete definitions and interruption rules are in section 0.0.7.

## Commercial Data Expansion and Competitive Response

The **Commercial Coverage Sprint** remains the active supporting data workstream
for the 250-product multi-retailer checkpoint. Use [Retailer Data Source Registry](Retailer-Data-Source-Registry.md) as the operational registry for retailer data-source decisions and [WheyWise Competitive Intelligence Analysis](Competitive-Intelligence/WheyWise-Analysis-2026-07.md) as supporting competitive intelligence; this Operating Plan remains the single source of truth for project direction.

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

### Legacy Retailer Snapshot Project Control Board

This board preserves the state of the earlier Retailer Snapshot programme. It
does not override the current checkpoint, section 0.0.7 or section 13.

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

`SEO-15` Deals and Price Intelligence is the binding next task but remains
temporarily `BLOCKED` solely by elapsed accrual. No SEO implementation is
currently `IN PROGRESS`; the mandatory return must occur before SEO-17 or any
Stage 3 decision. `SEO-16` is complete and `LIVE VERIFIED`.
Stage 1 `/deals` and the corrective Indexability Lifecycle P0 are deployed and
live verified. Stage 2A identity foundation is production verified. Jon's
Supplements, the separately owner-approved GYM HIGH scope and Fit House are
enabled producers; the other four remain disabled. Scheduled
run `32812270590` succeeded across `506/506`
mappings and offers, creating `418` immutable identity series and `418`
identity-proven daily confirmations while `88` offers failed closed with
`MISSING_OR_CONFLICTING_EXACT_IDENTITY`. The owner-approved five-row exact-pack
canary then applied at production ledger `128`, fingerprint
`67ad0f35749d7b1ad0c88827d368ff2eacadc431a73688d3888a193a5db04694`.
Manual producer run `32883838868` succeeded on commit `04c9f58`, retained the
`506/506` scope, added exactly five daily confirmations and passed idempotency,
bringing exact-pack coverage and proven accrual to `423/506`. The reviewed
ten-row servings migration then applied at ledger `129`, fingerprint
`5554a3849061b9420528b17ff240bb64d05c9ce8c4a0b7ba9c3aa8b0765be903`,
with exactly ten new variants and zero product, mapping, offer or history
changes. Producer run `32886482475` on commit `5a2f07f` subsequently added
exactly ten identity series and daily confirmations and passed idempotency.
That production readback was `433/506`, with `73` offers still fail-closed. The
final six evidence-ready rows then applied atomically as two
bounded migrations at ledger `131`, fingerprint
`7bc218564d6fe631fa3bfbcf3baaffae123d708f7a8cbfd527d110ad2dc1b781`,
creating six variants without changing product, mapping, offer or history row
counts. Producer run `32888613481` on commit `c15b87b` succeeded across
`506/506`, classified all 506 rows as `VERIFY_NO_CHANGE`, created exactly six
identity series and daily confirmations, and passed a zero-write idempotency
run. Independent production readback was `439/506`.

The next owner-reviewed ordinary package reused the same path for 51 rows: it
created 50 exact variants and rebound one existing exact variant without
changing product, mapping, offer or history counts. Producer run `32892293918`
on commit `d5e7b79` succeeded over `506/506`, created 51 identity series and
daily confirmations, and passed zero-write idempotency, raising verified
coverage to `490/506`.

The final evidence audit proved 13 of the 16 remaining rows from exact retailer
images, exact Shopify variant data, preserved retailer evidence or manufacturer
directions. Two bounded migrations applied at production ledger `140`,
fingerprint
`1364e9db9cb2d55711ceb4407cad4d0d31e2708c4a6051ff253c0b97f632d458`,
creating exactly 13 variants and changing no product, mapping, offer or history
row count. Initial canary run `32895119983` failed safely before validation or
writes because the preserved OOS manifest still named offer `1468`'s previous
default variant. Commit `05a53c1` aligned that existing manifest to exact
variant `2950`; the recorder contract was not changed. Producer run
`32915426696` then succeeded over `506/506`: 504 rows were
`VERIFY_NO_CHANGE`, two current stock transitions were applied, 503
identity-proven daily confirmations were recorded, and the fresh idempotency
pass made zero writes. Independent production readback confirms `503/506`
current exact mappings, 503 matching identity series, 503 daily confirmations
dated 26 August, zero duplicate current series and zero series for other
retailers.

Fit House producer migration `20260826190000` applied at production ledger
`151`, fingerprint
`12ece4c71ab77f1488afaeac6dc94049ff65b07c30309fd01bf7e8b0f30db28a`.
Controlled run `32986975109` on commit `6e5a3a2` passed its `286/286` preflight,
apply and idempotency gates, creating exactly `260` identity series and `260`
daily confirmations. The other `26` plans were recorded as fail-closed skips
with `MISSING_OR_CONFLICTING_EXACT_IDENTITY`. Independent readback confirmed
zero anomalies, duplicate series, duplicate daily confirmations and
other-retailer series changes. Fit House coverage is therefore `260/286`.

Only offers `1024`, `1451` and `1459` remain fail-closed. Offer `1024` has an
owner-entered 60-serving value that conflicts with manufacturer evidence for a
240-capsule, eight-capsule, 30-day pack. Offer `1451` has an owner-entered
`1 x 500g` value that conflicts with the exact Shopify variant image showing
two 250g pouches. Offer `1459` has variable directions of one to two tablets
twice daily and no exact servings-per-container evidence. These three require
corrected owner/evidence review and must not be inferred. Public Stage 2
remains blocked pending elapsed accrual, Stage 3 and public price-drop claims
remain disabled. GYM HIGH's exact `66`-offer observation scope is enabled, with
`50` exact-ready rows and `16` accessory/apparel rows retained fail-closed; its first ordinary
scheduled producer postflight is pending. GYM HIGH public brand and retailer
publication remains owner-deferred. `SEO-13` is complete and live verified from commit
`c1f97bc7cb783bca9d0edf28a7aeed6eb2bdfc2f` and production deployment
`6048852742`. SEO-14 is live verified after launching useful,
individually gated brand and retailer pages through the existing catalogue and
page-quality mechanisms. Applied Nutrition is live verified as the first individually gated
page. The shared comparison-card and 24-hour freshness refinement is also live
verified. The fresh read-only GYM HIGH coverage and content audit passed; the
owner then deferred that brand from public publication. The next executable
audit selected Per4m as the strongest alternative candidate. The next
bounded `/brands/per4m` unit is live verified. The subsequent read-only audit
selected `/brands/biotech-usa`, and the owner approved exactly that bounded
implementation. BioTech USA is the only remaining brand passing
the unchanged gate at `40` visible products, `109` offers, `11` multi-retailer
products, `3` comparison retailers and `11` source categories, with `40/40`
images. Its bounded page is live verified from production commit `18f80241` and
uses eight page-local display-group rules for eleven products rather than
repeating misleading internal categories. Public HTTP, canonical, robots,
structured data, sitemap, product-link and desktop/mobile evidence passed; the
mobile capture retained the already-recorded common-layout overflow rather than
introducing a BioTech USA regression. No additional page is authorised merely
by passing the gate, and no dynamic brand-page generator or catalogue correction
is approved. The next executable unit is one bounded, read-only retailer-page
feasibility and user-value audit through the existing contracts. That audit is
complete. A provisional translation of the existing `20 / 10 / 3 / 50 / 5`
gate found five publishable-review candidates after excluding owner-deferred
GYM HIGH. eBay UK is the strongest bounded candidate because `65` of its `69`
visible products have fresh offers from another retailer; its scope contains
`100` guarded eBay offers, `348` fresh offers across the visible products, `5`
retailers in comparisons, `10` categories, `26` brands and images on all `69`
products. The registry independently records that eBay created a second
retailer for `58` products and a third-or-later retailer for `10`. Search
demand and human click evidence remain insufficient, so the recommendation is
based on demonstrable comparison utility rather than a traffic claim.

The owner subsequently approved completing the exact `/retailers/ebay-uk`
unit. Its live page compares only stored, approved
eBay offers with current alternatives from other UK retailers. It discloses
marketplace, affiliate, freshness and tracked-coverage limitations, uses the
existing server-rendered comparison mechanisms and fail-closed gate, and does
not browse arbitrary eBay listings, imply seller endorsement, create a dynamic
retailer generator or change catalogue/production data. Current
production-backed local rendering contains `69` products, `100` eBay offers,
`65` products with another retailer, `348` fresh scoped offers, `5` retailers,
`10` categories, `26` brands and `69/69` images. Focused `8/8`, quick and full
quality gates pass with `274` sealed tests and a production build containing
the route. True 390-pixel mobile emulation has no horizontal overflow.
Owner-approved PR #27 passed all required checks and squash-merged as
`05a76c87157e2cfe98d70ae58e2cafabd6e8903b`; Vercel production deployment
`6008020815` and the post-merge full gate succeeded. Public HTTP `200`, exact
canonical, `index, follow`, schema, current coverage, one sitemap entry,
homepage discovery and eligible product-page linking passed. SEO-14 is `LIVE
VERIFIED`. GYM HIGH remains deferred from both brand- and retailer-page
publication.

### Next task

Return to `SEO-15` for its mandatory identity-proven accrual audit when the
elapsed-time gate opens. The task remains `BLOCKED`: the earliest 14-day audit
is 8 September 2026 and the recommended publication decision is after 24
September. Do not start SEO-17 early or enable Stage 3/public price-drop claims.

In parallel, the existing Jon's, GYM HIGH and Fit House schedules may continue
deterministic accrual. Jon's current verified SEO-15 coverage is `503/506` and
Fit House is `260/286`;
its earliest audit is 8 September 2026 and the recommended publication decision
is after 24 September. Fit House's earliest 14-day audit is 9 September and its
recommended publication decision is after 25 September. The three named Jon's
conflict/deferred identities, 26 Fit House incomplete source-absent identities
and 16 intentionally blocked GYM HIGH accessory/apparel identities remain
fail-closed. GYM HIGH's first
scheduled producer result requires postflight verification, no further
producer may be enabled without separate approval, and Stage 3 historical
claims remain disabled.

Use `docs/SEO-15-Deals-Price-Intelligence-Plan.md` for the bounded technical
design, evidence gates and decision log. It does not replace this Operating Plan
or the SEO Execution Plan and does not change the binding roadmap order.

### Then

1. After the SEO-15 readiness decision, implement it only if its reviewed data
   and quality gates pass; then proceed to `SEO-17`, reusing the existing data
   model. SEO-16 is already live verified.
2. Record GSC/GA4 evidence weekly; keep outbound outreach paused.
3. Monitor scheduled retailer refreshes; keep new discovery report-only until
   reviewed and preserve all drift, replay and recovery controls.
4. Freeze infrastructure and control-plane work unless a real batch exposes a
   specific unsupported requirement.

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

Current 20 August 2026 checkpoint: 1,070 active products, 2,087 public offers,
10 active retailers; 200 products with no retailer, 701 with one, 169 with at
least two, 25 with at least three and three with four. The active commercial
target is 250 products with at least two retailers (81 remaining).

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

### 2026-07-29

- 6 Pack Supplements catalogue closeout is complete for source snapshot
  `3da223519802bf0a786c20936d027fadb3be86b51954fc3fa11416127c3c3ae2`.
  All 141 admin review rows have a decision; the corrected decision artifact
  fingerprint is
  `9acbe77d8c3d837b5b516fa544389357e5e70e7efe7728aa27a7333239d68a93`.
- The final V15 rollout created the reviewed catalogue families and completed
  66 exact offer mappings. Protected production run `30466664627` passed,
  and a fresh idempotency dry-run reported 66 mapping, offer and price-history
  no-ops with zero blocked or failed rows.
- Retailer ID 11 now has exactly 506 mappings and 506 offers. The final database
  audit found zero missing offer bindings, zero external-variant duplicates,
  zero duplicate canonical-variant offers, zero missing URLs and zero delivery
  total errors. Current stock state is 395 in stock and 111 out of stock.
- The whole 576-record normalized source is accounted for: 506 automated
  offers, 43 adapter exclusions, 20 explicit reviewer rejections, four reviewed
  duplicate source offers covered by existing canonical offers and three
  deferred rows. The deferred rows are NMN (`16460`), Vitamin D3 8000 IU
  (`31152`) and the Peach source identity for 7Nutrition Steel Joints Drink
  (`4661`).
- The rejected scope includes all reviewed DMAA, yohimbine and T5 products,
  Melatonin 5 mg and three corrupt Vegan Multivitamin flavour aliases. SARMs,
  peptides, expired/dated products, DMAA, yohimbine and T5 remain excluded.
  Approved collagen/protein peptides and the separately approved Angel Dust
  PUMP product remain valid and must not be confused with those exclusions.
- Sauces, syrups, jams, spreads, bars, cookies, wafers, flapjacks, bites,
  porridge/oats, pancake mixes, ready-to-drink shakes and liquid egg whites are
  allowed under the recorded owner policy. Reviewed accessories are also
  allowed.
- The single shared Six Pack automation manifest now contains 506 offers across
  279 retailer product pages, SHA-256
  `6e0d2efa9589ad9fe8ea191d3a256f521d660afce5d465e630a9a120c974820f`.
  A fresh live read of all 279 pages returned `VERIFY_NO_CHANGE ×506`, zero
  blocked rows, zero price/stock/URL changes and all mass-change guards passed.
- Delivery is enforced as GBP 4.99 below GBP 99.99 and free at or above the
  threshold. The final manifest audit verified the delivered total for all 506
  offers.
- Six Pack new-product discovery remains report-only. Future reviewed additions
  join the same manifest and the same scheduled refresh; they do not create a
  separate automation.
- The complete Six Pack Actions audit on 29 July 2026 covered all 28 workflow
  files and their GitHub run histories. All 27 one-time bootstrap, canary,
  shipping and catalogue-expansion workflows had already recorded a successful
  rollout. They are now fail-closed and preserved outside the active Actions
  directory in `docs/archive/six-pack-workflows/`; they cannot react to future
  pushes. No catalogue, mapping, offer or retailer data was removed.
- `.github/workflows/six-pack-offer-refresh.yml` is the only active Six Pack
  production workflow. Future reviewed products join its existing shared
  manifest and refresh rather than receiving another versioned automation.
- On 31 July 2026 a healthy 506-offer dry-run was followed by a timeout during
  the sequential apply. The executor now reuses one bounded approver connection
  and one bounded executor connection for the complete manifest instead of
  opening two new database connections per offer. Per-row approval, execution,
  ordering and idempotency remain unchanged; the job limit is 90 minutes as a
  secondary operational margin.
- Protected GitHub run `30639957001` completed successfully on commit
  `e3d7fec`. Both live reads covered the exact 506 approved offers across 279
  product pages and returned `VERIFY_NO_CHANGE` for all 506. The optimized
  apply executed all 506 individually approved plans and completed before the
  timeout; the fresh post-apply check also returned 506/506 no-change.
- Direct retailer URLs are complete. Affiliate tracking for 6 Pack remains
  explicitly not configured and is a later commercial task, not a catalogue or
refresh blocker.

On 11 August 2026 the consumed GYM HIGH bootstrap and legacy identity workflows,
and the completed Vegan Protein pilot workflow, were moved from
`.github/workflows/` to `docs/archive/completed-workflows/`. Their exact YAML,
guards, scripts and evidence remain preserved, but GitHub can no longer offer
or execute those one-time production actions. The active GYM HIGH daily source
monitor and 66-offer catalogue refresh remain unchanged; SEO-13 also remains in
progress through its normal page roadmap.
- On 11 August 2026 the owner approved exact stock transitions for Banana
  (offer `2029`, mapping `2215`) and Belgian Chocolate (offer `2422`, mapping
  `2608`) in the existing 7Nutrition Whey Isolate 90 1kg family. Two matching
  source captures and a full 506-offer preflight proved unchanged GBP 41.99
  prices and stock-only `true -> false` changes. The existing split-role
  executor applied exactly those two transitions; the immediate fresh ordinary
  postflight returned `VERIFY_NO_CHANGE` x506, zero further changes and zero
  writes. The generic `MASS_OOS = 2` threshold remains unchanged. The reviewed
  selector is manual-only, cannot be used by push/schedule, and fails closed on
  replay after the two rows are already OOS.
- GitHub Actions run `31464407687` initially stopped before writes because the
  runner could not reach the database. Its guarded rerun (attempt 2) completed
  successfully on 11 August 2026, including the 506-plan apply and fresh
  idempotency check. The workflow no longer runs on ordinary pushes; only its
  daily schedule and explicit manual operations remain.

### 22 August 2026 - eBay Batch Q live closeout

- The final owner-approved scope excluded rejected original rows 3 and 5 and
  contained exactly 20 distinct second-retailer products.
- PR `#42` and production run `32569395781` created mappings `2886`-`2905`,
  offers `2700`-`2719` and 20 initial history rows. The immediate 20-no-op
  postflight, independent database readback and 20 public-page checks passed.
- PR `#43` expanded the one shared guarded refresh to exact 181. Protected
  dry-run `32571366605` passed 181 eligible, zero blocked and zero writes;
  automatic-OOS remains blocked.
- The authoritative live multi-retailer checkpoint is 211/250, leaving 39.

### 23 August 2026 - eBay Batch R live closeout

- The exact owner-approved 39 identities were represented without duplication
  by 38 production creates and one verified existing Critical Greens no-op.
- PR `#45` and production run `32627418960` created mappings `2906`-`2943`,
  offers `2720`-`2757` and 38 history rows. The exact postflight, independent
  database readback and 38 public-page checks passed.
- PR `#46` expanded the one shared guarded refresh to exact 219. Protected
  production-readonly run `32628541876` passed 219/219, zero blocked and zero
  writes; apply steps were skipped and automatic-OOS remains blocked.
- The authoritative live multi-retailer checkpoint is 232/250, leaving 18.

### 23 August 2026 - eBay Batch S and 250/250 milestone closeout

- The owner approved the exact final 18 Batch S listings with `wszystkie sa
  dobre`.
- PR `#48` and protected production run `32632336319` created mappings
  `2944`-`2961`, offers `2758`-`2775` and 18 history rows; the fresh listing
  preflight and exact postflight both passed 18/18.
- An independent production read verified 18 active positive-price offers and
  advanced the deduplicated multi-retailer KPI from 232 to **250/250**.
- PR `#49` registered the exact production IDs in the one shared refresh,
  expanding it from 219 to 237. Read-only run `32632937687` verified 131 rows
  before the eBay read limit blocked the final contiguous 106 as
  `SOURCE_READ_FAILED`; it made zero writes and automatic OOS remained blocked.
- Batch S is live verified and must not be replayed. The commercial coverage
  milestone is complete; only a later complete 237-row read-only refresh pass
  remains as operational evidence after the eBay limit resets.

### 22 August 2026 - eBay Batch P live closeout

- The owner approved all 20 numbered Batch P listings, including the four
  seller-threshold exceptions disclosed in the review list.
- The exact 20 plans executed in production and created mappings `2866`-`2885`,
  offers `2680`-`2699` and 20 history rows. Independent readback and the
  corrected 20-no-op postflight passed with zero blockers; all 13 distinct
  public product pages returned HTTP 200 with eBay UK visible.
- The single shared refresh is now exact 161. Protected run `32563234233`
  passed 161/161, zero blocked rows and zero executions with automatic-OOS
  blocking retained. No second scheduler or autonomous catalogue authority was
  introduced.
- At the Batch P closeout, the live multi-retailer checkpoint was 191/250, leaving 59.
  The prepared nine-row projection was not a product-level count; the exact
  deduplicated KPI uplift is three products.

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
