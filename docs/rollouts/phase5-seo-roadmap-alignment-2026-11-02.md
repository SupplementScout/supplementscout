# Phase 5 SEO roadmap alignment — 2 November 2026

## Authority and current state

- Owner decision date: 2 November 2026.
- Starting `origin/main`: `4c3e4c47b9df56d846bbd3ec8ffdfa29b19dfcdd`.
- This record authorizes documentation alignment only.
- `SEO-15` remains the sole `IN PROGRESS` SEO task. Its evidence, public Stage
  3 gate, producers, candidates and monitoring are unchanged.
- The future order becomes effective only after formal SEO-15 closeout.

The owner approved changing the post-closeout order from `SEO-15 -> SEO-17` to
`SEO-15 closeout -> SEO-18 -> SEO-19 -> SEO-20`. This decision explicitly
supersedes the former future ordering based on the verified Phase 4 overlap and
Phase 5 readiness evidence. `SEO-17` remains `PLANNED` and returns to owner
review only when an exact, non-duplicative `/whey-protein` owner-reviewed
decision-note payload is supplied. The Roadmap Steward is authorized to align
the authoritative documentation only.

Owner roadmap approval is not feature implementation approval and is not
production merge approval. Every implementation and every production merge
requires a separate explicit owner authorization.

## Approved post-closeout sequence

### SEO-18 — homepage canonical and Help Me Choose sitemap

Status: `PLANNED`. First implementation after formal SEO-15 closeout.

- Add an explicit homepage self-canonical using metadata
  `alternates: { canonical: "/" }`.
- Preserve the Help Me Choose base as `index, follow`, parameter states as
  `noindex, follow` and their canonical as `/help-me-choose`.
- Add exactly one clean `/help-me-choose` base URL to the sitemap.
- Do not change title, description, HMC copy, schema or robots.
- Do not add parameterized HMC URLs, `/search` or a fabricated `lastModified`.

### SEO-19 — reciprocal Vitamins and Multivitamins links

Status: `PLANNED`. Begins only after SEO-18 is `LIVE VERIFIED`.

- `/vitamins` links to `/multivitamins` with anchor `Multivitamins`.
- `/multivitamins` links to `/vitamins` with anchor `Vitamins and minerals`.
- No metadata, schema, loader, pagination or generic internal-link expansion.

### SEO-20 — PER4M title-only experiment

Status: `PLANNED`. Begins only after SEO-19 is `LIVE VERIFIED` and separate
implementation and merge approval.

- Target: `/brands/per4m`.
- Change only the title to
  `Compare PER4M Prices Across UK Retailers | SupplementScout`.
- Do not change meta, H1, body, schema, brand data, direct anchors, coverage
  logic or data presentation.
- Measure at least 28 settled days, 500 page impressions and 300
  brand-navigational query impressions.
- Primary metric: CTR improvement without material ranking deterioration.
- Freeze title, meta, H1, body, schema, direct anchors and data presentation
  during measurement, except for a genuine production regression.

## Preserved gates and non-authorizations

- `SEO-17` remains `PLANNED`. Its payload must be distinct from Help Me Choose,
  CategoryDecisionPanel, Quick Comparison, Better Value Alternatives and the
  existing whey comparison copy. No payload is invented here.
- `SEO-02B` remains `BLOCKED`. This decision does not authorize mass noindex,
  sitemap removal, canonical changes or any offerless-PDP policy change.
- Magnesium title work and legacy category breadcrumb/schema work remain
  `PREPARED_RESEARCH`; Mass Gainer and Applied Nutrition remain
  `FUTURE_REVIEW`. They are not part of the approved immediate sequence.
- No feature code, application test, workflow, runtime configuration, database
  migration, database write or production behavior is authorized or changed.
- No SEO-15 completion, Stage 3 enablement, threshold change, producer change,
  candidate change or evidence rewrite is authorized.
