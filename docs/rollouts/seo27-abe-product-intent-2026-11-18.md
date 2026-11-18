# SEO-27: standard ABE product buying intent

Status: CODE COMPLETE — Draft publication-review package, not LIVE VERIFIED.
Base: `71e29a79b70f728954b954062f890e64522b3202`.
The final PR head is recorded on the Draft PR; no self-referential commit hash
is embedded here.

## Approved scope and implementation

The18November owner instruction authorizes one Draft PR for
`/product/applied-nutrition-abe-ultimate-pre-workout-315g`, its necessary tests
and this minimal record. No merge, production deployment or next task.

- Extend the existing productPresentation mechanism with an exact ID215,
  slug/name/brand/category guard. The canonical product has a legacy null
  product_format; accept that exact identity without writing the catalogue.
  Do not activate the copy for a different identity or explicit liquid format.
- Within the existing server renderer, clarify that standard powder, Pump,
  shot and RTD are separate products. Explain exact pack/flavour, dynamic
  retailer/delivery/check-date information and variant-specific caffeine facts.
- Add two crawlable contextual links: the existing Pump500g card and
  `/compare?left=215&right=481`. The latter remains noindex/follow with the
  existing `/compare` canonical. No new page or duplicate content mechanism.
- Keep the existing H1, title, description, summaries used in JSON-LD,
  canonical/robots/sitemap, exact offer links and retailer_offer_click.
  No price, stock, dose, serving count or saving is hard-coded in the new copy.
- No new client component, package, runtime read, N+1 query or caching change.

## Identity and reviewed facts, rechecked18November09:47UTC

Existing GET-only source readback confirmed:

| Product | Exact variant | Existing approved/applied caffeine proof |
| --- | --- | --- |
| Standard ABE, product215,315g | Baddy Berry1672 | Candidate2706: present_with_amount,200mg per10.5g serving; existing applied-fact resolver agrees. |
| ABE Pump, product481,500g | Tigers Blood763 | Candidate752: confirmed_absent; existing applied-fact resolver agrees. |

The315g source is the manufacturer's existing
[connect page](https://connect.appliednutrition.uk/product/abe-all-black-everything-pre-workout-copy/).
The main manufacturer shop now also lists
[standard375g](https://appliednutrition.uk/products/abe-all-black-everything-375g),
whose12.5g serving is not the315g/10.5g record. No relabelling, nutrition
transfer or catalogue/mapping change is authorized or performed.
[Pump500g](https://appliednutrition.uk/products/abe-pump-pre-workout-500g-caffeine-free)
remains a distinct product. Absence of caffeine is not proof of absence of all
stimulants. Existing approved per-variant facts remain in their existing
renderer; this change adds no new formulation assertion or serving arithmetic.

## Search targeting and baseline

Use the owner's18November Semrush UK snapshot: `abe pre workout`,5,400/month,
KD13, WheyWise position3. The ranking URL is UNKNOWN: the product description
and Pump traffic-share observation do not identify the same exact URL.
This is an estimate, not SupplementScout traffic or a forecast.

The four complete existing Growth Analytics artifacts cover19October–15November:
runs44166511050,44166516255,44166520996,44166526954. No historical rerun.
Both exact product URLs and their ABE query/page pairs are absent from the
capped returned rows: impressions/clicks/CTR/position are UNKNOWN, not zero.
Per-page GA4 organic sessions and retailer_offer_click baseline are UNKNOWN
in these artifacts. Site-wide9,661 impressions/74 clicks are context only.
Latest existing run44186080465 still reports incomplete16November; no newer
complete artifact was available at preflight. Query caps100/week and page-query
caps250/week plus privacy apply; these GSC reports are not UK-market volume.

Consequently this is a clarity intervention, not a claim to own generic ABE
searches. Standard and Pump titles/descriptions are unchanged. After a future
owner-approved deployment, record its exact time/SHA and inspect the first7
and28 complete settled days, excluding the partial deployment day. Compare
page/query impressions, clicks, CTR and position for both cards, existing GA4
organic landing metrics and retailer_offer_click where available, and existing
read-only indexing evidence. Record UNKNOWN when dimensions are unavailable.
No new event, report, schedule or Google submission. SEO-20's clock and minimum
28settled-day/500page/300brand-query thresholds remain untouched.

## Verification and actual-source QA

Existing test inventory remains369 files; reviewed inventory seal is unchanged
because tests were extended inside the existing product-presentation suite.
Focused actual async-page tests exercise changing prices, exact Baddy Berry,
caffeine attribution, unknown shipping, missing facts, stale/OOS/empty/failed
offers, metadata, tracked links and isolation from Pump/PER4M/unrelated cards.
Other existing pricing, offer-group, schema, nutrition, analytics and comparison
regressions remain included in the full gate.

Project Guardian, verify:quick, verify:full, TypeScript, ESLint and Next16.2.9
production build are required for the final Draft head. An initial isolated
build could not fetch Google Fonts; retry uses normal network access and the
system trust store, with production credentials still stripped by quality-gate.
No TLS verification bypass or application/config change was introduced.

Manual QA uses two local production builds, before/after, with the same real
sources and a transport allowing only GET/HEAD to existing Supabase tables.
This is not a preview/production deployment and fixtures are not live evidence.

- HTTP200, metadata/canonical/robots/schema parity and existing offer-link
  parity pass for ABE base/1672. The new comparison link resolves both product
  IDs with noindex/follow and the correct canonical.
- Pump base/763, Myprotein Clear Whey, CNP Creatine, PER4M product and PER4M
  hub retain identical visible text and metadata/schema in paired source reads.
- Chrome1440/390px: ABE base/1672 and control cards pass readable layout,
  no horizontal overflow or clipping/section overlap, no runtime/HTTP errors.
  New links have correct destinations and keyboard order; screenshots reviewed.
- Six alternating warm samples per build: median full HTTP response elapsed
 863.0ms before,695.4ms after; unchanged guard is after<=before*1.5+100ms.
  This is not a production TTFB or field Core Web Vitals improvement claim.
- Each measured exact-variant request made7 GETs in both versions. Existing
  cache/request behaviour is preserved; zero warm reads is not claimed.
- No outbound /go navigation was performed: it can record outbound_clicks.
  Existing tracked href/variant parity and safe analytics tests verify that
  contract without inserting production analytics or catalogue data.

Raw readback/HTTP/Chrome evidence and screenshots remain ignored under
`.worktrees/seo27-abe-product-intent-20261118/tmp/`; no secrets are committed.
The final command results and exact head are recorded in the Draft PR.

## Release boundary

Await separate owner publication approval. No production release/readback of
these changes has occurred. Recheck freshness, required CI and exact head before
any future merge, then verify real production before LIVE VERIFIED closeout.
SEO-20 is frozen; SEO-21–26 remain LIVE VERIFIED; SEO-15 Stage3 stays disabled.
No homepage, Clear Whey, importer, workflow, nutrition, mapping, offer or price
history modification is included.
