# SEO-20 PER4M title-only CTR experiment - 3 November 2026

## Authority and starting state

The owner authorized the bounded SEO-20 implementation, tests, guarded merge,
production verification and experiment-activation documentation. The approved
scope is a title-only CTR experiment on `/brands/per4m`.

- Starting `main`: `461f42257563cd228874087ab05e005ed273ab0d`.
- Starting `origin/main`: `461f42257563cd228874087ab05e005ed273ab0d`.
- Branch: `feat/seo20-per4m-title-experiment`.
- Pre-change Project Guardian: pass; SEO-20 next; zero SEO tasks in progress.
- Starting SEO-20 status: `PLANNED`.
- PR-ready SEO-20 status: `CODE COMPLETE`; production deployment is pending.

SEO-15, SEO-18 and SEO-19 remain `LIVE VERIFIED`; SEO-17 remains `PLANNED`;
SEO-02B remains `BLOCKED`. Public Stage 3 remains disabled and `DEFERRED / NOT
READY` behind the unchanged `12 / 30 / 4` gate.

## Title-only implementation contract

The pre-change page metadata title is `Per4m Products & Prices UK`, which the
root layout template `%s | SupplementScout` renders as `Per4m Products & Prices
UK | SupplementScout`. The implementation changes only the page metadata title
to `Compare PER4M Prices Across UK Retailers`. The same root template therefore
renders the approved final browser title exactly once:

`Compare PER4M Prices Across UK Retailers | SupplementScout`

The focused contract test guards the page title and the layout template so a
second `| SupplementScout` suffix cannot be introduced.

The following `/brands/per4m` fields and behaviours are frozen throughout the
experiment except to repair a genuine production regression:

- meta description, canonical and `index, follow` robots;
- visible H1 and all body content;
- Open Graph title and description;
- Twitter title and description;
- `CollectionPage`, `ItemList` and `BreadcrumbList` structured data, including
  the existing CollectionPage and ItemList names;
- related/direct links, product links and the `per4m_brand` analytics marker;
- brand normalization and casing, loader, cache, coverage and indexability
  gates, sitemap, sorting, retailer coverage and all data presentation.

Production application scope is one metadata-title line in
`app/brands/per4m/page.tsx`. No database migration, database write, production
configuration, runtime flag, secret, schema, threshold, producer approval,
external service or Stage 3 state changes.

## Pre-deployment baseline

The baseline reuses the existing successful scheduled Growth Analytics run
`41532536029`; no workflow was manually dispatched. Artifact `13183205053`,
`growth-analytics-41532536029-1`, has digest
`sha256:5e21b3d7921bb8ae76f32237d88c9cd84fff5094fa180172da6fa1f476665471`.
The report file `weekly-2026-11-01.json` has SHA-256
`c682f1f683b1297e121b5220b78a237e4f5dbf86d15b1747ef6a0f452e8bc5a4`.
Its requested range is 26 October-1 November 2026; the report marks 1 November
as not yet final, so this is a clearly dated pre-deployment baseline rather than
a claim that every included date was settled.

For `/brands/per4m`, the report records:

- 152 page impressions, 0 clicks, 0% CTR and average position
  `9.348684210526315`;
- 99 privacy-visible brand-navigational query impressions, 0 clicks, 0% CTR and
  impression-weighted average position `10.454545454545455`.

The exact privacy-visible brand-navigation grouping is: `pe4rm`, `per 4`, `per
4m`, `per4m`, `per4m isolate`, `per4m magnesium`, `per4m magnesium
bisglycinate`, `per4m pre workout`, `per4m protein`, `per4m supplements`,
`per4m uk`, `per4rm protein` and `perm4m`. It is a bounded pre-deployment query
group, not a claim about privacy-suppressed queries.

## Measurement and exit contract

The measurement clock starts only after the feature reaches production and the
public smoke check passes. At that point SEO-20 becomes `IN PROGRESS`, not `LIVE
VERIFIED`, and remains the next executable task.

Evaluation requires both:

1. at least 28 settled post-deployment days; and
2. at least 500 `/brands/per4m` page impressions and 300 brand-navigational
   query impressions.

If the day threshold passes before both volume thresholds, SEO-20 remains `IN
PROGRESS`. The primary question is whether CTR improves without material
ranking deterioration, comparing pre/post page CTR and average position plus
brand-navigation CTR and average position. No winner may be declared from a
few days of data. No other PER4M SEO experiment or Magnesium title experiment
may start while this measurement is unresolved.

## PR-ready verification and pending activation

- Focused PER4M suite: `9/9` pass.
- `npm run typecheck`: pass.
- `npm run verify:project`: pass; SEO-20 next; no task in progress.
- `npm run verify:quick`: pass.
- `npm run verify:full`: pass, including safe tests, migration validation and
  the Next.js production build.
- `npm run lint`: pass.
- Standalone `npm run build`: pass with the repository's local-only quality-gate
  Supabase placeholders and no production credentials.
- `git diff --check`: pass.
- Freeze audit: pass. Against starting `main`, the production page diff is one
  removed and one added line containing only the approved metadata title; after
  normalizing that title back to its baseline value, the whole file is equal.

## Production merge, smoke and experiment activation

- Feature PR: `#441`.
- Approved head: `0204a9c04a1f927bf359d5b0e63f743128a4fc0a`.
- Production squash-main: `4930dd541629ef06a919abe78992e52db5c8e97e`.
- Tree equivalence: pass; both tree hashes are
  `9243c44cbbfcd30f8e58803c09d620f11f768734`.
- PR Project Guardian, Quality Gate, GitGuardian and Vercel Preview: pass.
- Main Project Guardian `41630798548`: pass.
- Main Quality Gate `41630798504`: pass.
- Vercel production deployment `83TXgMLWzzDnmCayrH6edVY1UUYs`: success at
  `2026-11-03T11:51:34Z`.
- Public smoke and measurement start: `2026-11-03T11:54:34Z`.
- Activation documentation branch: `docs/seo20-experiment-activation`.
- Activation documentation PR: `#442`.

The public route returned HTTP `200` with exact title `Compare PER4M Prices
Across UK Retailers | SupplementScout`, exactly one canonical
`https://www.supplementscout.co.uk/brands/per4m`, and `index, follow`. The meta
description, H1, body, Open Graph title/description, Twitter title/description,
one structured-data block and its CollectionPage, ItemList and BreadcrumbList
names, direct links, analytics marker and 42 product links matched baseline.
The entire `<main>` retained baseline SHA-256
`fbab4e8f93a478bb22d6af532609d5862818c2de165fce10b8839a437da610b5`.
Headless Chrome exited successfully, rendered the exact title and unchanged H1,
and exposed no visible or runtime error.

SEO-20 is now `IN PROGRESS`, remains the next executable task and is the only
SEO task `IN PROGRESS`. It is not `LIVE VERIFIED`. The explicit measurement
freeze and exit contract above are active from the smoke timestamp. SEO-19,
SEO-18 and SEO-15 remain `LIVE VERIFIED`; SEO-17 remains `PLANNED`; SEO-02B
remains `BLOCKED`; Stage 3 remains disabled and `DEFERRED / NOT READY` behind
the unchanged `12 / 30 / 4` gate. No database, migration, manual workflow,
configuration, secret, threshold, producer, external-service or Stage 3 change
occurred. The activation documentation PR is recorded after guarded merge.
