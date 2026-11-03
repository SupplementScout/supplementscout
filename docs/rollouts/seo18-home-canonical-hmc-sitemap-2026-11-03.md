# SEO-18 homepage canonical and Help Me Choose sitemap - 3 November 2026

## Authority and baseline

The owner authorized only the bounded SEO-18 implementation and PR preparation.
Production merge and production writes remain outside this authority.

- Starting `main`: `b806a4ea53fd1a151a930eb938949ea87b2bbdfa`.
- Starting `origin/main`: `b806a4ea53fd1a151a930eb938949ea87b2bbdfa`.
- Branch: `feat/seo18-home-canonical-hmc-sitemap`.
- Pre-change Project Guardian: pass; 22 SEO tasks; SEO-18 next; none in progress.
- SEO-18 pre-change status: `PLANNED`.

The mandatory audit confirmed:

- the homepage had no explicit canonical;
- root `metadataBase` resolves `/` to
  `https://www.supplementscout.co.uk/`;
- the homepage inherited the existing layout title and description;
- Help Me Choose already canonicalized to `/help-me-choose`, with the clean base
  indexable and parameterized decision states `noindex, follow`;
- `/help-me-choose` was absent from the sitemap and had no duplicate
  implementation elsewhere;
- the static entry does not require an indexability-lifecycle registration.

## Bounded implementation

- `app/page.tsx` imports the Next.js `Metadata` type and exports only
  `alternates: { canonical: "/" }`.
- `app/sitemap.ts` adds exactly one `${siteUrl}/help-me-choose` entry with
  `changeFrequency: "weekly"` and `priority: 0.8`.
- The entry has no `lastModified`, query parameters or `/search` URL.
- Contract tests cover the isolated homepage metadata export, exactly one clean
  Help Me Choose sitemap entry and preservation of the existing Help Me Choose
  canonical/robots behavior.

No Help Me Choose runtime/page behavior, copy, schema, robots, metadata logic,
analytics or lifecycle registry changed. No database schema, migration, write,
manual workflow, production configuration, GitHub variable or external service
changed.

## Local verification

- Focused tests: `18/18` pass.
- `npm run typecheck`: pass.
- `npm run verify:project`: pass after roadmap closeout.
- `npm run verify:quick`: pass.
- `npm run verify:full`: pass, including lint, safe tests, baseline migration
  validation and the Next.js production build.
- `npm run lint`: pass.
- `npm run build`: pass.
- Final diff/scope check: only the two implementation files, two existing test
  files and four authorized documentation files changed.

## Release state and next gate

SEO-18 is `CODE COMPLETE`, not `LIVE VERIFIED`. It remains the next executable
task with zero SEO tasks `IN PROGRESS`. SEO-19, SEO-20 and SEO-17 remain
`PLANNED`; SEO-02B remains `BLOCKED`; SEO-15 remains `LIVE VERIFIED`; public
Stage 3 remains disabled and `DEFERRED / NOT READY`.

The PR must remain open until the owner provides a fresh explicit merge
authorization. After an authorized merge, production readback must verify the
homepage canonical and unchanged title/description, Help Me Choose base and
parameter canonical/robots behavior, and exactly one clean sitemap URL before
SEO-18 may become `LIVE VERIFIED` or SEO-19 may begin.
