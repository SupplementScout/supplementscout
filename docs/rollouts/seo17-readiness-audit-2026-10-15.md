# SEO-17 research-only readiness audit — 15 October 2026

## Status and authority boundary

This is a read-only preparation record. `SEO-17` remains `PLANNED`; `SEO-15`
remains the single active SEO implementation. Nothing in this audit authorizes
an expert note, route, schema change, public claim, nutrition collection,
database write or deployment.

The acceptance contract remains the one in `docs/SEO-Execution-Plan.md`:
expert judgement must be clearly labelled and dated, verified facts must retain
provenance, and unsupported medical or formulation claims cannot publish.

## Why this is the safe parallel task

The 14 October competitor review found that SupplementScout already has more
public item pages than WheyWise, while WheyWise retains a material lead in
non-product decision surfaces: 249 URLs versus 27. The correct response is not
a bulk page generator. A small owner-reviewed decision layer on existing,
already indexable comparison pages addresses the evidenced gap while preserving
canonical data and route controls.

The latest authenticated weekly report, run `38289200062` for 5–11 October,
is too small to prove growth but is sufficient to avoid selecting a completely
unobserved canary. Its final GSC sample reports:

| Existing route | Impressions | Clicks | Interpretation |
|---|---:|---:|---|
| `/whey-protein` | 273 | 1 | Strongest observed existing comparison surface and already confirmed indexed. |
| `/magnesium` | 219 | 0 | Meaningful visibility, but decision advice can easily cross into health-claim risk. |
| `/mass-gainer` | 184 | 0 | Clear commercial intent, including `best mass gainer` queries, but currently weak positions. |
| `/creatine` | 119 | 0 | Commercial visibility; nutrition and dosage language requires stronger evidence boundaries. |
| `/glucosamine` | 85 | 0 | Health-related intent makes unsupported suitability claims especially risky. |
| `/pre-workout` | 31 | 0 | Existing exact-variant nutrition presentation is useful, but the active nutrition ledger must remain authoritative. |

The report contains one non-final GSC date and GA4 referral contamination. These
figures rank research candidates only; they do not support a traffic or
conversion claim.

## Existing mechanisms to reuse

No dedicated SEO-17 model, table, route or publishing workflow exists. That is
not a missing-infrastructure incident and should not trigger a new content
system before a bounded canary is approved.

The repository already provides the necessary foundation:

- existing lifecycle-registered comparison routes with shared canonical,
  robots and sitemap behavior;
- data selectors in modules such as `app/lib/wheyComparison.ts` and
  `app/lib/preWorkoutComparison.ts`;
- visible inclusion boundaries, methodology, freshness limitations and FAQ
  sections on the existing comparison pages;
- the public `/how-we-compare` provenance and limitation contract;
- existing category-view and outbound-click analytics;
- an existing two-product comparison that exposes verified evidence without
  declaring a winner;
- exact-variant nutrition presentation only where the nutrition ledger and
  approved facts already authorize it.

The current comparison pages contain hand-written explanatory copy. Therefore,
adding separate prose independently to many pages would create the spaghetti
risk the owner wants to avoid. Conversely, introducing a generic CMS, database
table or page generator for one canary would be premature infrastructure.

## Recommended bounded canary after SEO-15

Use the existing `/whey-protein` route for the first SEO-17 canary, subject to a
separate owner decision after the SEO-15 readiness decision. It has the
strongest observed comparison-page visibility, verified indexation and mature
price/pack methodology. It also lets the first note stay inside commercial
choice rather than health or dosage advice.

The canary should be one small decision block, not a new route and not a list of
subjective winners. Its allowed evidence should be limited to fields already
visible and verified by existing selectors, for example:

- current known delivered price;
- exact pack or variant identity;
- recently checked retailer count;
- verified unit-value fields when the current page already allows them;
- explicit missing-evidence and freshness limitations.

The block must not infer taste, formulation quality, effectiveness, suitability,
medical benefit, popularity or dosage. It must not turn missing nutrition into a
negative judgement. Nutrition facts may be mentioned only when the exact
variant's currently applied, owner-reviewed facts already pass the canonical
nutrition presentation gate; SEO-17 must not collect, approve or write them.

## Minimal review contract for a later implementation

Before code starts, the owner-reviewed note package should bind:

1. one existing public route and a stable note identifier;
2. the exact decision question the note answers;
3. a short judgement clearly labelled `Owner-reviewed decision note`;
4. `reviewed_at` and `reviewed_by` display values;
5. the exact product/variant or category scope;
6. a closed list of factual inputs with their existing source mechanism;
7. explicit prohibited claims and an expiry/re-review condition;
8. a fingerprint of the reviewed payload so prose cannot drift after approval.

Implementation should initially live in repository-controlled, typed data and a
single shared renderer used by the one canary. That is the smallest reusable
shape consistent with the current codebase. A database-backed editor, dynamic
route family, content generator and autonomous AI-authored notes remain out of
scope.

## Required gates when SEO-17 is allowed to start

- Re-read current `origin/main`, production behavior, the Operating Plan, SEO
  ledger and this audit; do not assume the canary is still outstanding.
- Confirm SEO-15 has reached its recorded readiness decision or has been
  explicitly narrowed by the owner under its completion contract.
- Obtain the exact owner-reviewed note payload and scope.
- Reuse the existing comparison loader, lifecycle state, analytics and public
  methodology; do not add a parallel selector or route.
- Add contract tests for label/date/provenance, claim exclusions, stale or
  missing evidence, canonical/robots/sitemap stability and analytics.
- Run focused tests, TypeScript, `npm run verify:project`, `npm run
  verify:quick` and `npm run verify:full` before completion.
- Require deployment and public readback before changing SEO-17 from
  `IN PROGRESS` to `LIVE VERIFIED`.

## Next action

Do not implement the canary yet. After the first natural post-GYM HIGH SEO-15
audit and the eventual SEO-15 readiness decision, present one exact
`/whey-protein` decision-note payload for owner review. Until then, continue only
weekly measurement and research that does not modify public behavior.
