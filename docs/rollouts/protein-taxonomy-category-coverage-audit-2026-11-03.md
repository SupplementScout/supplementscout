# Protein taxonomy and category coverage audit — 2026-11-03

## Decision

**PASS — audit only.** Keep the existing live subtype-route architecture and
do **not** add `/protein-powder` now (**architecture Model A**). Production has
enough breadth for a useful conventional-sports-protein umbrella (`138` strong
members), but that umbrella would substantially duplicate the richer Whey,
Whey Isolate and Vegan comparison experiences, introduce an immediate
canonical/semantic mismatch (`125/138` strong members are outside canonical
Protein Powder), and create avoidable SEO and maintenance overlap. The bounded
next unit is to establish one declarative, multi-dimensional protein semantic
authority and migrate the existing subtype predicates to it before considering
another public route.

Current production route truth is:

| Dimension | Strong | Review | Current visible | Visible strong | False | Review visible | Recall | Precision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Whey Protein | 101 | 5 | 94 | 94 | 0 | 0 | 93.1% | 100.0% |
| Whey Isolate | 25 | 6 | 23 | 22 | 0 | 1 | 88.0% | 95.7% |
| Vegan Protein | 15 | 0 | 15 | 15 | 0 | 0 | 100.0% | 100.0% |
| Protein Powder Search | 138 | 5 | 0 | 0 | 0 | 0 | 0.0% | n/a |

This record changes no application code, route, predicate, Search behavior,
homepage, lifecycle, sitemap, database row or schema.

## Scope, preflight and governance

- Starting `origin/main` and audit HEAD:
  `f81925e97db0013c169836ce98e917e3a5ffe17d`, exactly the owner-specified SHA.
- The root checkout contained unrelated owner work, so the audit used the clean
  worktree
  `C:\Projects\supplementscout\.worktrees\protein-taxonomy-audit` on branch
  `audit/protein-taxonomy-category-coverage`; the root changes were untouched.
- Pre-audit `npm run verify:project`: **PASS**, 22 SEO tasks checked; SEO-20 is
  the sole `IN PROGRESS` task and the PER4M title-only freeze remains intact.
- Reviewed the current Operating Plan, SEO execution ledger, Agent Operating
  Model and Indexability Lifecycle before collecting evidence.
- Reviewed `wheyComparison.ts`, `proteinSubtypes.ts`,
  `veganProteinComparison.ts`, `wheyIsolateComparison.ts`,
  `categoryComparison.ts`, `categoryComparisonVariants.ts`,
  `proteinBarsComparison.ts`, `massGainerComparison.ts`,
  `categoryCoverage.ts`, `categoryCoverageLanding.ts`, `categoryRoutes.ts`,
  `products.ts`, `productPresentation.ts`, all six current protein-adjacent
  route adapters and their regression/lifecycle tests.
- Existing public protein routes remain `live_verified`; Collagen remains its
  production-verified semantic owner and the current exact-category Search
  resolver policy is unchanged.

## Production read-only proof

The authoritative capture started at `2026-11-03T20:56:27.281Z` and used only
public production pages plus public Supabase REST under
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and anonymous RLS.

- authoritative capture: `49 GET`, `0 HEAD`, `0 RPC`, `0` mutation-method
  requests and `0` direct database writes;
- endpoints: two paginated `GET /rest/v1/products` reads and 47 public site
  GETs (homepage, complete Search pagination and full route pagination);
- every authoritative response was HTTP 200;
- complete audit session, including parser diagnostics and repeated
  classification checks: `343 GET`, `0 POST`, `0 PUT`, `0 PATCH`, `0 DELETE`,
  `0 RPC`, `0` direct database writes;
- no service-role/admin credential, database client with write authority,
  migration runner or production executor was loaded;
- catalogue closure: `1,357` active, unmerged products; the broad candidate
  union closed at `695` rows.

Offer freshness was evaluated at 24 hours for coverage diagnostics only.
Offer state never determined semantic membership.

## Current public experience

The homepage returned HTTP 200 and exposed **no exact Protein Powder anchor**,
so its current exact href is **none**.

Complete current Search captures:

| Exact query | Result count | Pages |
| --- | ---: | ---: |
| `Protein Powder` | 0 | 1 |
| `Whey Protein` | 133 | 6 (`24/24/24/24/24/13`) |
| `Whey Isolate` | 8 | 1 |
| `Vegan Protein` | 11 | 1 |

The exact Whey Isolate set is `7nutrition-whey-isolate-90-1kg`,
`7nutrition-whey-isolate-90-2kg`, `7nutrition-whey-isolate-90-500g`,
`bulk-pure-whey-isolate-900g`, `cnp-whey-isolate-1-8kg`,
`efectiv-clear-whey-isolate-600g-20-servings`,
`gym-high-whey-pro-synergy-18kg`, and
`reflex-nutrition-clear-whey-isolate-510g-17-servings`.

The exact Vegan Protein set is `10x-athletic-vegan-protein-540g`,
`barebells-vegan-protein-bar-55g`,
`barebells-vegan-protein-bars-12-x-55g`,
`biotech-usa-vegan-protein-500g`, `efectiv-nutrition-vegan-protein-908g`,
`ghost-vegan-protein-989g`,
`gym-high-vegan-plant-based-protein-blend-600g`,
`lenny-and-larrys-complete-cremes-18x135g`,
`myprotein-myvegan-impact-vegan-protein-powder-1kg`,
`per4m-plant-advanced-vegan-protein-900g`, and
`per4m-vegan-protein-908g`. Four of these eleven are foods; Search is a
candidate generator, not semantic membership.

The complete 133-row `Whey Protein` Search capture is the union below; the
production order was retained in the collector, while this durable record
groups it for readability:

- conventional Whey/Isolate/Clear/Diet and reviewed blends:
  `10x-whey-protein-grass-fed-25-servings`,
  `7nutrition-whey-isolate-90-1kg`, `7nutrition-whey-isolate-90-2kg`,
  `7nutrition-whey-isolate-90-500g`, `7nutrition-whey-protein-80-2kg`,
  `7nutrition-whey-protein-80-500g`,
  `animal-isolate-loaded-whey-protein-2-3kg`,
  `applied-nutrition-clear-whey-protein-875g`,
  `applied-nutrition-critical-whey-227kg`,
  `applied-nutrition-critical-whey-2kg`,
  `applied-nutrition-diet-whey-protein-1-8kg`,
  `applied-nutrition-diet-whey-protein-1kg`,
  `applied-nutrition-iso-xp-18kg`, `applied-nutrition-iso-xp-1kg`,
  `biotech-usa-100-pure-whey-1kg`,
  `biotech-usa-100-pure-whey-2-27kg`,
  `biotech-usa-100-pure-whey-454g`,
  `biotech-usa-iso-whey-zero-1816g`,
  `biotech-usa-iso-whey-zero-2-27kg`,
  `biotech-usa-iso-whey-zero-500g`,
  `biotech-usa-iso-whey-zero-908g`,
  `biotechusa-100-pure-whey-protein-454g`,
  `boditronics-diet-whey-18kg`, `boditronics-diet-whey-900g`,
  `bsn-syntha-6-edge-187kg`, `bulk-pure-whey-isolate-900g`,
  `bulk-pure-whey-protein-powder-450g`,
  `cellucor-c4-whey-protein-powder-1-7kg`,
  `chaos-crew-whey-protein-powder-720g`,
  `cnp-peptide-whey-protein-blend-2-27kg`, `cnp-premium-whey-2kg`,
  `cnp-premium-whey-900g`, `cnp-whey-isolate-1-8kg`,
  `dy-nutrition-shadowhey-concentrate-2kg`, `dymatize-iso-100-227kg`,
  `efectiv-clear-whey-isolate-600g-20-servings`,
  `efectiv-nutrition-grass-fed-whey-protein-isolate-2kg`,
  `efectiv-whey-advanced-protein-complex-900g`,
  `efectiv-whey-protein-2kg`, `efectiv-whey-protein-60-serving-1-8kg`,
  `ghost-100-whey-protein-907g`, `ghost-clear-whey-640g`,
  `ghost-whey-protein`, `grenade-hydra-6-protein-18kg`,
  `gym-high-whey-pro-synergy-18kg`, `gym-high-whey-pro-synergy-600g`,
  `gym-high-whey-pro-synergy-dynamic-600g`,
  `hubba-bubba-clear-whey-protein-405g`,
  `kior-health-whey-probiotics-900g`,
  `mountain-joe-s-shake-a-whey-1-8kg`,
  `muscletech-nitro-tech-100-whey-gold-1kg`,
  `myprotein-impact-whey-protein-2-5kg`,
  `myprotein-impact-whey-protein-milkshake`, `naughty-boy-whey-900g`,
  `naughty-boy-whey-protein-2kg`,
  `nutrisport-h3avyweight-whey-protein-complex-500g`,
  `nutrisport-whey-protein-isolate-300g`,
  `nxt-nutrition-pure-whey-deluxe-2-1kg`,
  `nxt-nutrition-pure-whey-deluxe-510g`,
  `nxt-nutrition-pure-whey-iso-juice-900g`,
  `olimp-whey-protein-complex-100-1800-2270g`,
  `optimum-nutrition-100-gold-standard-whey-454kg`,
  `optimum-nutrition-100-gold-standard-whey-908g`,
  `optimum-nutrition-100-isolate-930g`,
  `optimum-nutrition-gold-standard-100-whey-protein-780g`,
  `optimum-nutrition-gold-standard-whey-2-27kg`,
  `optimum-nutrition-platinum-hydro-whey-1-6kg`,
  `per4m-isolate-zero-2kg`, `per4m-isolate-zero-900g`,
  `per4m-whey-advanced-protein-2010g`,
  `per4m-whey-advanced-protein-900g`, `per4m-whey-hydrate-900g`,
  `per4m-whey-protein-2kg`, `pescience-select-protein-18kg`,
  `pescience-select-protein-905g`, `phd-nutrition-diet-whey-1kg`,
  `phd-nutrition-diet-whey-2kg`, `phd-whey-protein-powder-1kg`,
  `phd-whey-protein-powder-500g`,
  `reflex-nutrition-clear-whey-isolate-510g-17-servings`,
  `rule1-r1-protein-22kg`, `rule1-r1-protein-29-servings`,
  `rule1-r1-whey-blend-23kg`, `rule1-r1-whey-blend-896g`,
  `sis-science-in-sport-rego-whey-protein-powder-1-35kg`,
  `stay-lean-whey-protein-2kg`,
  `strom-sports-velosiwhey-1-2kg`, `strom-sports-velosiwhey-iso-1kg`,
  `time-4-whey-protein-25kg`, `time-4-whey-protein-professional-1-8kg`,
  `trained-by-jp-iso-pro-1-8kg`,
  `trained-by-jp-performance-isolate-tri-blend-2kg`,
  `trained-by-jp-performance-protein-1kg`,
  `trained-by-jp-performance-protein-2kg`,
  `twp-nutrition-whey-protein-900g`, `twp-whey-protein-2-1kg`,
  `twp-whey-protein-isolate-900g`,
  `usn-blue-lab-100-whey-premium-protein-2kg`,
  `warrior-whey-protein-500g`, `xl-nutrition-xtra-whey-2kg`;
- Casein, Beef, Egg, Vegan, Collagen, food and other diagnostic matches:
  `7nutrition-100-micellar-casein-1kg`, `7nutrition-bodybuilder-7kg`,
  `applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg`,
  `applied-nutrition-critical-plant-protein-1-8kg`,
  `axe--sledge-demoday-powder-930g`,
  `barebells-vegan-protein-bar-55g`,
  `barebells-vegan-protein-bars-12-x-55g`,
  `biotech-usa-micellar-casein-908g`,
  `biotech-usa-vegan-protein-500g`, `cnp-loaded-beef-protein-1-8kg`,
  `cnp-loaded-iso-collagen-protein-2kg`,
  `efectiv-nutrition-100-micellar-casein-908g`,
  `efectiv-nutrition-vegan-protein-908g`, `ghost-vegan-protein-989g`,
  `gym-high-slimming-protein-1000g`,
  `mms--hi-protein-powder-chocolate-875g`,
  `muscle-moose-supreme-protein-1-8kg`,
  `musclemeds-carnivor-beef-isolate-179kg`,
  `muscletech-nitro-tech-1-8kg`, `muscletech-nitrotech-ripped-18kg`,
  `newgrit-ng7-premium-men-s-formula-700g`,
  `nxt-beef-protein-isolate-18kg`,
  `optimum-nutrition-100-plant-protein-684g`,
  `optimum-nutrition-gold-standard-100-casein-182kg`,
  `optimum-nutrition-gold-standard-100-casein-908g`,
  `per4m-egg-white-protein-1-8kg`,
  `per4m-plant-advanced-vegan-protein-900g`,
  `per4m-plant-protein-2kg`, `per4m-vegan-protein-908g`,
  `pescience-vegan-series-select-protein-918g`,
  `strom-sports-nihpro-hydrolysed-protein-isolate-40-servings`, and
  `whey-pro-synergy-bcaa-bundle`.

Diagnostic Search counts (candidate generation only): `protein powder 0`,
`protein 260`, `whey 136`, `isolate 35`, `clear whey 5`, `vegan protein 11`,
`plant protein 6`, `casein 11`, `micellar casein 6`, `beef protein 8`,
`egg protein 0`, `protein blend 5`, `diet whey 6`, and
`performance protein 2`.

## Live route membership and presentation

All comparison routes returned their full membership on one page. Collagen is
the only paginated route in this capture.

| Route | Full members | Pagination |
| --- | ---: | --- |
| `/whey-protein` | 94 | one page |
| `/whey-isolate` | 23 | one page |
| `/vegan-protein` | 15 | one page |
| `/protein-bars` | 11 | one page |
| `/mass-gainer` | 16 | one page |
| `/collagen` | 29 | page 1 = 24, page 2 = 5 |

The full Whey membership is the 101-row strong set below minus the seven
explicit missing rows. This is also exactly the current 94-row predicate set:

- missing strong: `optimum-nutrition-100-isolate-930g`,
  `per4m-isolate-zero-900g`, `mutant-iso-surge-727g`,
  `dy-nutrition-shadowhey-concentrate-2kg`,
  `strom-sports-velosiwhey-iso-1kg`,
  `strom-sports-velosiwhey-1-2kg`, and
  `nutrisport-h3avyweight-whey-protein-complex-500g`;
- all remaining Whey strong rows are visible; there are no false positives and
  no review rows visible.

The full `/whey-isolate` set is `7nutrition-whey-isolate-90-1kg`,
`7nutrition-whey-isolate-90-2kg`, `7nutrition-whey-isolate-90-500g`,
`animal-isolate-loaded-whey-protein-2-3kg`,
`applied-nutrition-iso-xp-18kg`, `applied-nutrition-iso-xp-1kg`,
`biotech-usa-iso-whey-zero-1816g`,
`biotech-usa-iso-whey-zero-2-27kg`,
`biotech-usa-iso-whey-zero-500g`,
`biotech-usa-iso-whey-zero-908g`, `bulk-pure-whey-isolate-900g`,
`cnp-whey-isolate-1-8kg`, `dymatize-iso-100-227kg`,
`efectiv-clear-whey-isolate-600g-20-servings`,
`efectiv-nutrition-grass-fed-whey-protein-isolate-2kg`,
`nutrisport-whey-protein-isolate-300g`,
`nxt-nutrition-pure-whey-iso-juice-900g`, `per4m-isolate-zero-2kg`,
`reflex-nutrition-clear-whey-isolate-510g-17-servings`,
`strom-sports-nihpro-hydrolysed-protein-isolate-40-servings`,
`strom-sports-velosiwhey-iso-1kg`, `trained-by-jp-iso-pro-1-8kg`, and
`twp-whey-protein-isolate-900g`. NIHpro is the one visible review case.

The full `/vegan-protein` set is
`10x-athletic-vegan-protein-540g`,
`applied-nutrition-critical-plant-protein-1-8kg`,
`biotech-usa-vegan-protein-500g`, `bulk-pea-protein-isolate-1kg`,
`efectiv-nutrition-vegan-protein-908g`, `ghost-vegan-protein-989g`,
`gym-high-vegan-plant-based-protein-blend-600g`,
`myprotein-myvegan-impact-vegan-protein-powder-1kg`,
`nutrisport-pure-plant-protein-500g`,
`nutrisport-pure-plant-protein-908g`,
`optimum-nutrition-100-plant-protein-684g`,
`per4m-plant-advanced-vegan-protein-900g`,
`per4m-plant-protein-2kg`, `per4m-vegan-protein-908g`, and
`pescience-vegan-series-select-protein-918g`.

The complete `/protein-bars` set is `7nutrition-seven-protein-bar-77g`,
`barebells-protein-bar-55g`, `clif-bar-energy-bar-12x68g`,
`cnp-prodough-protein-bars-box-of-12-x-60g`,
`grenade-carb-killa-protein-bar-60g`,
`grenade-soft-core-protein-bar-12-x-50g`,
`optimum-nutrition-protein-crisp-bar-10x65g`, `per4m-protein-bar-62g`,
`per4m-protein-bars-box-of-12-x-62g`, `usn-trust-crunch-protein-bar-60g`,
and `warrior-raw-protein-flapjack-75g`.

The complete `/mass-gainer` set is `7nutrition-bodybuilder-15kg`,
`7nutrition-bodybuilder-mass-gainer-3kg`,
`applied-nutrition-beef-mass-gainer-3-13kg`,
`applied-nutrition-critical-mass-gainer-6kg`,
`applied-nutrition-critical-mass-lean-mass-gainz-24kg`,
`biotech-usa-hyper-mass-4kg`, `cnp-professional-pro-mass-4-8kg`,
`ghost-clear-gains-protein-1230g`, `gym-high-mass-gainer-2100g`,
`medi-evil-nutrition-purely-mass-5-28kg`,
`mutant-mass-mass-gainer-227kg`,
`nxt-nutrition-pure-whey-mass-3-18kg`,
`optimum-nutrition-gold-standard-gainer-162kg`,
`rule1-r1-lbs-mass-gainer-2730g`,
`twp-nutrition-all-the-weight-up-mass-gainer-5kg`, and
`usn-hyperbolic-mass-gh-6kg`.

Collagen returned its already verified 29 strong members across two pages. CNP
Loaded ISO Collagen is not a current Collagen presentation row and remains
excluded from both Whey routes; its two captured offers do not override the
Collagen identity conflict.

## Candidate closure and seven-dimensional classification

The broad universe contains every active/unmerged row in canonical Protein
Powder, Whey Protein, Protein Bars, Mass Gainer and Health Supplements, plus
all rows matched by the requested names/descriptions. Category distribution:

| Canonical category | Candidates |
| --- | ---: |
| Health Supplements | 442 |
| Whey Protein | 128 |
| Protein Bars | 55 |
| Protein Powder | 21 |
| Mass Gainer | 16 |
| Vitamins | 13 |
| Accessories | 10 |
| Amino Acids | 5 |
| Creatine | 4 |
| Electrolytes | 1 |
| **Total** | **695** |

Every candidate was independently assigned one state in every dimension. The
sets are exhaustive: rows not named as strong or review in a dimension are
`EXCLUDE_STRONG` for that dimension.

| Dimension | INCLUDE_STRONG | REVIEW_REQUIRED | EXCLUDE_STRONG |
| --- | ---: | ---: | ---: |
| Protein Powder umbrella (Model B boundary) | 138 | 5 | 552 |
| Whey Protein | 101 | 5 | 589 |
| Whey Isolate | 25 | 6 | 664 |
| Vegan Protein | 15 | 0 | 680 |
| Casein Protein | 10 | 0 | 685 |
| Beef Protein | 8 | 0 | 687 |
| Egg Protein | 1 | 0 | 694 |

Exhaustive set construction:

- Whey strong = all 94 current Whey route members plus the seven missing rows
  listed above. Whey reviews are `gym-high-slimming-protein-1000g`,
  `mms--hi-protein-powder-chocolate-875g`,
  `muscle-moose-supreme-protein-1-8kg`,
  `muscletech-nitro-tech-1-8kg`, and
  `strom-sports-nihpro-hydrolysed-protein-isolate-40-servings`.
- Isolate strong = the 22 strong current route rows plus
  `optimum-nutrition-100-isolate-930g`, `per4m-isolate-zero-900g`, and
  `mutant-iso-surge-727g`. Reviews are the current NIHpro row plus
  `applied-nutrition-clear-whey-protein-875g`,
  `ghost-clear-whey-640g`, `hubba-bubba-clear-whey-protein-405g`,
  `olimp-sport-nutrition-iso-plus-1505g`, and
  `trained-by-jp-performance-isolate-tri-blend-2kg`.
- Vegan strong is exactly the 15-row live Vegan route set.
- Casein strong is `7nutrition-100-micellar-casein-1kg`,
  `applied-nutrition-casein-900g`, `biotech-usa-micellar-casein-908g`,
  `efectiv-nutrition-100-micellar-casein-908g`,
  `gym-high-whey-pro-synergy-18kg`,
  `gym-high-whey-pro-synergy-dynamic-600g`,
  `optimum-nutrition-gold-standard-100-casein-182kg`,
  `optimum-nutrition-gold-standard-100-casein-908g`,
  `pescience-select-protein-18kg`, and
  `pescience-select-protein-905g`.
- Beef strong is `applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg`,
  `biotechusa-beef-protein-500g`,
  `bulk-beef-protein-isolate-97-hydrobeef-1kg`,
  `cnp-loaded-beef-protein-1-8kg`,
  `musclemeds-carnivor-beef-isolate-179kg`,
  `nxt-beef-protein-isolate-18kg`,
  `nxt-nutrition-beef-protein-isolate-1-8kg`, and
  `nxt-nutrition-beef-protein-isolate-540g`.
- Egg strong is `per4m-egg-white-protein-1-8kg`.
- Umbrella strong is the union of the strong subtype sets plus seven reviewed
  conventional protein-powder identities: `gym-high-slimming-protein-1000g`,
  `mms--hi-protein-powder-chocolate-875g`,
  `muscle-moose-supreme-protein-1-8kg`,
  `strom-sports-nihpro-hydrolysed-protein-isolate-40-servings`,
  `per4m-advanced-protein-800g`, `nutrisport-90-protein-454g`, and
  `bsn-syntha-6-limited-edition-226kg`. Umbrella reviews are
  `muscletech-nitro-tech-1-8kg`, `muscletech-nitrotech-ripped-18kg`,
  `myprotein-pro-x-hyrox-the-recovery-688g`,
  `newgrit-ng7-premium-men-s-formula-700g`, and
  `nutrisport-protein-complex-carbs-700g`.

The umbrella boundary is conventional sports protein powder: it includes Whey,
Vegan, Casein, Beef, Egg and supported multi-protein blends, but excludes
Collagen, Mass Gainer, bars/foods, RTD liquids, shots, waters, meals and meal
replacements. This is the semantic **Model B boundary**, but the route decision
is architecture **Model A**: do not publish that umbrella yet.

## Semantic findings by subtype

### Whey Protein

- `101` strong, `5` review; current route has `94` strong, no false positive.
- Seven missing strong rows produce `93.1%` recall. Four are outside canonical
  Whey Protein (`3` Health Supplements and `1` Protein Powder); three are inside
  the category but the word-boundary/name rules miss ShadoWhey/VelosiWhey.
- `69/101` strong rows have at least one fresh usable offer; `19` have multiple
  fresh retailers; coverage totals `499` fresh offers across `9` retailers.
- Canonical category is neither sufficient nor necessary: it contains Vegan,
  Casein, Beef, Egg and Collagen identities while missing four strong Whey
  products.

### Whey Isolate

- `25` strong, `6` review; current route has `22` strong plus NIHpro review.
- Three strong Health Supplements rows are blocked by the canonical Whey gate:
  Optimum Nutrition 100% Isolate, Per4m Isolate Zero 900g and Mutant Iso Surge.
- Recall is `88.0%`; conservative precision treating review as unresolved is
  `22/23 = 95.7%`. No confirmed false positive was found.
- `21/25` strong rows have a fresh offer; `8` have multiple fresh retailers;
  `107` fresh offers across `8` retailers.
- Plain Clear Whey does not prove isolate. Only Efectiv and Reflex say Isolate
  explicitly; Applied, Hubba Bubba and Ghost remain isolate reviews.

### Vegan Protein

- `15/15` strong rows are live: `100%` recall and `100%` precision.
- Nine strong rows are canonically mislabeled Whey Protein, five are Protein
  Powder and GYM HIGH Vegan is Health Supplements. This is strong evidence that
  semantic membership cannot be owned by one canonical label.
- `12/15` have a fresh offer; `6` have multiple fresh retailers; `51` fresh
  offers across `9` retailers.

### Casein, Beef and Egg

- Casein: `10` strong, but only `3` have a fresh offer, only `2` have multiple
  fresh retailers and there are `14` fresh offers. It misses the shared
  comparison gate (`3` multi-retailer products and `20` offers), so do not add
  `/casein-protein` yet.
- Beef: `8` strong, `6` with a fresh offer, but only `1` multi-retailer product;
  keep it a subtype/facet, not a route.
- Egg: one strong product with two fresh retailers and six fresh offers; keep it
  subtype-only.

### Clear Whey, blends and Diet Whey

- Five Clear Whey identities are strong Whey members. Two are strong Isolate;
  three require isolate review. A separate Clear Whey route would duplicate
  current Whey/Isolate ownership for only five products; use a future subtype
  filter, not a route.
- PEScience Select 905g/1.8kg are strong Whey + Casein multi-members. GYM HIGH
  Synergy 1.8kg and Dynamic 600g are likewise strong Whey + Casein; the plain
  600g row proves Whey but lacks current explicit Casein evidence and therefore
  does not enter the Casein strong set.
- BSN Syntha-6 Edge, Grenade Hydra 6, Rule1 R1 Protein and TBJP Performance are
  strong reviewed Whey blends. Their exact names currently bridge missing
  structured source evidence; they must not seed more name exceptions.
- Six explicit Diet Whey rows (Boditronics 1.8kg/900g, Applied 1.8kg/1kg and
  PhD 1kg/2kg) are strong Whey and umbrella members. GYM HIGH Slimming Protein
  is a strong umbrella member but Whey-review because the current evidence does
  not explicitly identify its protein source. None belongs to Fat Burners by
  name alone.

### Collagen, Mass Gainer, foods and RTD

- Collagen remains semantically separate. Its 29-member route is already the
  correct owner; no Collagen product enters the generic conventional-sports
  protein umbrella. CNP Loaded ISO Collagen remains excluded from Whey and
  Isolate despite its Whey Protein canonical label and `ISO` token.
- All Mass Gainers remain outside Protein Powder umbrella intent. They contain
  protein but answer calorie/weight-gain intent and already have a live route.
- All Protein Bars, cookies, bites, wafers, flapjacks and snacks remain outside
  the umbrella. So do protein water, shots, liquid shakes, smoothies, meals and
  meal replacements. Raw `protein` text is never sufficient.

## Mandatory product findings

- **CNP Loaded ISO Collagen Protein 2kg:** active, Whey Protein, powder, two
  offers; `EXCLUDE_STRONG` for Whey/Isolate/umbrella; Collagen semantic owner.
- **BioTech USA Vegan Protein 500g:** active, canonically Whey Protein, visible
  Vegan strong; excluded from Whey by the animal/plant conflict guard.
- **GYM HIGH Vegan Plant-Based Protein Blend 600g:** active Health Supplements,
  visible Vegan strong; proof that Vegan membership must remain category-agnostic.
- **GYM HIGH Whey Pro Synergy:** 600g, 1.8kg and Dynamic 600g are visible Whey
  strong. The 1.8kg and Dynamic descriptions explicitly prove 50/50 whey
  isolate + micellar casein; plain 600g lacks equivalent current Casein proof.
- **TBJP Performance Protein 1kg/2kg:** active, visible Whey strong only through
  reviewed-name debt; no current description supports a generic predicate.
- **PEScience Select 905g/1.8kg:** active, visible Whey strong and Casein strong;
  descriptions explicitly prove whey + casein.
- **Rule1 R1:** R1 Protein 2.2kg and 29 Servings are reviewed-name Whey; R1 Whey
  Blend 2.3kg/896g pass generic Whey evidence. All four are visible.
- **BSN Syntha-6 Edge 1.87kg:** active, visible reviewed-name Whey; current copy
  proves a multi-protein complex but does not provide a declarative subtype
  record.
- **Grenade Hydra 6 Protein 1.8kg:** active, visible reviewed-name Whey; current
  copy proves a protein blend but not a reusable machine-readable source.
- **Clear Whey:** five current identities; all Whey strong, two Isolate strong,
  three Isolate review; no separate route.
- **Casein / Beef / Egg / Diet Whey:** counts and decisions are `10 / 8 / 1 /
  6 strong Whey + 1 Whey review` as detailed above.

## Protein Powder Search and canonical category quality

Exact public `/search?q=Protein%20Powder` returned zero product cards:

- current results `0`;
- strong umbrella true positives `0`;
- false positives `0`;
- visible reviews `0`;
- missing strong `138`;
- recall `0.0%`;
- precision `n/a` because there is no denominator.

The canonical Protein Powder category has `21` rows: `13` strong umbrella,
`6` strong false category members and `2` reviews.

- false: BioTech Protein Pancake, Applied Critical Oats Protein Porridge,
  Applied High Protein Shake 500ml, Applied Complete Breakfast Protein
  Smoothie, NXT Protein Water and Applied Protein Shot;
- review: NutriSport Protein & Complex Carbs and MyProtein HYROX Recovery;
- `125/138` strong umbrella products are outside canonical Protein Powder.

Canonical debt is separate from semantic membership. Relabeling alone cannot
represent legitimate multi-membership and is not authorized by this audit.

## Hard-coded reviewed-identity debt

`REVIEWED_WHEY_BLEND_NAMES` contains exactly eight entries, and all eight are
current active products:

1. BSN Syntha-6 Edge 1.87kg
2. Grenade Hydra 6 Protein 1.8kg
3. PEScience Select Protein 1.8kg
4. PEScience Select Protein 905g
5. Rule1 R1 Protein 2.2kg
6. Rule1 R1 Protein 29 Servings
7. Trained By JP Performance Protein 1kg
8. Trained By JP Performance Protein 2kg

None is stale. Generic rules miss them because the names contain neither
standalone `whey` nor the supported isolate/ISO aliases. The set is legitimate
legacy reviewed evidence, but it is product-name identity debt. Migrate it to
one structured, reviewed protein-source/semantic-evidence authority with
provenance (for example Whey, Casein, blend and confidence attributes), consumed
by every subtype. Do not replace it with IDs, more names, brands, retailer
labels or route-specific exceptions.

## Root causes

Counts can overlap because one product can have multiple causes.

| Root cause | Count / scope | Finding |
| --- | ---: | --- |
| `WHEY_CATEGORY_GATE_MISS` | 4 strong | Three Health Supplements isolates plus one Protein Powder Whey product are blocked by the exact category gate. |
| `SEMANTIC_ALIAS_MISSING` | 3 strong Whey | ShadoWhey and two VelosiWhey names fail current word-boundary/ISO evidence. |
| `ISOLATE_CATEGORY_GATE_MISS` | 3 strong | Optimum 100% Isolate, Per4m Isolate Zero 900g and Mutant Iso Surge are Health Supplements. |
| `VEGAN_CATEGORY_MISLABEL` | 9 strong | Nine Vegan products carry canonical Whey Protein. |
| `CATEGORY_LABEL_MISMATCH` | 125 umbrella | Strong umbrella membership overwhelmingly sits outside Protein Powder. |
| `SOURCE_CATEGORY_TOO_BROAD` | 8 canonical Protein Powder | Six excludes and two reviews show that the label alone is not safe. |
| `SEARCH_PHRASE_MISMATCH` | 138 missing strong | Exact Protein Powder currently returns zero cards. |
| `HARDCODED_REVIEWED_IDENTITY` | 8 | Current reviewed Whey blends need structured semantic evidence. |
| `COLLAGEN_WHEY_CONFLICT` | 1 mandatory | CNP ISO Collagen is correctly rejected despite label/token conflict. |
| `CLEAR_WHEY_SUBTYPE` | 5 | All are Whey; two strong Isolate and three review. |
| `BLEND_IDENTITY_AMBIGUITY` | 8 hardcoded plus review cases | Product names do not safely encode sources/components. |
| `MASS_GAINER_PROTEIN_CONFLATION` | 16 live plus mislabel candidates | Mass-gain intent remains separate from protein-powder intent. |
| `PROTEIN_FOOD_FORMAT_CONFLATION` | 55 canonical bars + 6 Protein Powder false rows | Text-only protein matching is not taxonomy. |
| `MEAL_REPLACEMENT_CONFLATION` | boundary-wide | Meals, breakfast smoothies and recovery/carb blends fail closed. |
| `CASEIN_IDENTITY` | 10 strong | Coverage misses the current route gate. |
| `BEEF_IDENTITY` | 8 strong | Only one multi-retailer product; subtype only. |
| `EGG_IDENTITY` | 1 strong | Subtype only. |
| `CURRENT_OFFER_PRESENTATION_FILTER` | 44 umbrella strong without a fresh usable offer | Presentation state is separate from membership. |
| `NO_USABLE_OFFER` | captured by coverage metrics | Never used to reclassify a product. |
| `INACTIVE_PRODUCT` / `MERGED_PRODUCT` | 0 in universe | Candidate closure was active and unmerged. |

## Architecture model decision

| Model | User/SEO effect | Engineering effect | Decision |
| --- | --- | --- | --- |
| A — keep live subtype routes; no `/protein-powder`; fix gaps | Clearest intent, no new cannibalisation, preserves rich comparison UX | Smallest surface; first fix one semantic authority and the seven/three gaps | **Recommended** |
| B — add umbrella plus subtypes | Broad discovery, but 138-member duplicate surface and unclear ownership | New lifecycle/cache/route/controls plus overlapping truth | Not now |
| C — make umbrella primary and reduce subtypes | Loses high-intent subtype clarity and current value comparisons | Reverses proven live architecture | Reject |
| D — add only Casein or another subtype | Potentially clear later | Casein, Beef and Egg all fail current route-worthiness evidence | Defer |
| E — Search-only broad umbrella | Avoids route SEO but current exact Search returns zero and is text/format driven | Would mix Search repair with taxonomy ownership | Not the taxonomy solution |

Recommendation: **Model A**. Reconsider an umbrella or Casein route only after
the shared semantic authority is live, gap fixes are production-read back and
the route has independently sufficient demand/coverage evidence.

## Semantic authority decision

Protein membership should use **another shared declarative protein layer**,
not remain split across specialized predicates and not use
`CategoryCoverageDefinition` as the primary truth.

- Preserve `CategoryComparison` for public protein route loading,
  delivered-price normalization, verified nutrition/value metrics, decision
  controls, structured data and presentation.
- Add one pure, multi-dimensional protein evaluator that returns independent
  states for umbrella, Whey, Isolate, Vegan, Casein, Beef and Egg plus evidence
  codes. All existing comparison loaders consume it.
- `CategoryCoverageDefinition` is reusable for future simple browse routes, but
  its one-definition/one-classification model is not the clean authority for
  overlapping protein dimensions and richer comparison contracts.
- The evaluator can reuse the existing classification vocabulary and fixture
  style; no generic CategoryCoverage engine extension is required now.
- Do not create parallel route predicates, new runtime ID/name sets,
  retailer-specific membership or canonical-category-only truth.
- Migrate the current eight-name debt only after reviewed structured source
  evidence exists; preserve current behavior until then.

## Exact next implementation unit and stop point

Recommended next owner-authorized implementation unit:

> Introduce one pure declarative `proteinTaxonomy` evaluator with fixtures for
> the audited strong/review/conflict cases; migrate Whey, Whey Isolate and Vegan
> predicates to consume it while preserving `CategoryComparison`; broaden their
> candidate loaders so semantic evaluation is not pre-blocked by canonical
> category; close the seven Whey and three Isolate strong misses; keep NIHpro
> and the three plain Clear Whey isolate cases fail-closed; preserve the eight
> legacy reviewed names until structured evidence replaces them; add no
> `/protein-powder`, Casein/Beef/Egg/Clear route, Search/homepage/lifecycle/
> sitemap change, ID/name exception, canonical data write or SEO-20/PER4M
> change.

The exact stop point is this audit, boundary and implementation contract. No
runtime behavior or production data was changed.
