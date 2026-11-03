# Homepage mobile navigation overlay fix

Date: 2026-11-03

Implementation state: live and production-verified

Starting `main`: `cc6e84e6e7c54b8ed8f2405b697991b3fccf39b3`

## Owner-reported symptoms and reproduction

The owner screenshot showed the mobile navigation mixed with homepage content:
the Menu and Close row appeared at the top while navigation labels and the hero
heading overlapped below it. The result did not behave like a viewport dialog.

A read-only production browser reproduction at `390 x 844` confirmed the
failure before implementation. The header occupied `390 x 65`, while the
supposedly fixed dialog was constrained to `384 x 64`. Its children visibly
overflowed that short box across the hero. The computed header
`backdrop-filter` was `blur(8px)`, the dialog was still a descendant of that
header, and body scroll locking plus initial Close focus were active. This is
structural containing-block behavior, not an insufficient numeric z-index.

## Root cause and bounded architecture

`HomeHeader` rendered both `fixed` mobile layers inside its
`backdrop-blur` header. A backdrop-filtered ancestor establishes the visual
stacking/containing context that can constrain fixed descendants, including in
mobile WebKit. Increasing the two descendant z-index values would leave that
ancestor relationship intact and would not make viewport positioning reliable.

The menu state, refs, keyboard handling, focus trap, focus restoration,
viewport listener and body-scroll cleanup remain owned by the single existing
`HomeHeader` client component. Its one dialog is now rendered with React
`createPortal()` directly into `document.body`. The portal is guarded by the
existing initially-false `menuOpen` state and `typeof document !== "undefined"`,
so the initial server and client trees remain stable and browser APIs are not
read during server rendering. There is no second menu state or navigation
registry.

## Mobile viewport contract

The portalled dialog is one `fixed inset-0` full-width, `h-dvh` layer with an
opaque white background. It has vertical scrolling, horizontal clipping and
overscroll containment. Top and bottom padding use
`env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` with a usable
baseline, covering notches, Dynamic Island space and the bottom home indicator
without a device-specific height.

The same four navigation destinations remain: `#search`, `#categories`,
`#goals` and `#how-it-works`. The separate mobile Search control remains
`#search`; desktop navigation and Find Deals are unchanged. The single modal
layer temporarily covers the external cookie prompt while navigation is open,
then reveals the untouched consent UI on Close; cookie code and configuration
are not changed.

## Accessibility and preserved boundaries

Opening still focuses Close. Tab and Shift+Tab remain trapped inside the
dialog, Escape closes it, Close and navigation actions restore focus to Menu,
and crossing the desktop breakpoint closes it. Body overflow is saved, locked
and restored on every close path and component cleanup. Existing focus-visible
styles and at-least-44-pixel controls remain.

This task changes no Search behavior or resolver, Category Coverage rules or
routes, product data, database files, migrations, sitemap, lifecycle state,
SEO-20, PER4M experiment fields or production configuration. Nootropics remains
unstarted.

## Verification and production closeout

Focused source/architecture tests protect the `document.body` portal, one
navigation registry, full-screen opaque mobile-only layer, dynamic viewport,
safe-area and overflow contracts, four destinations, Close control,
`aria-modal`, focus behavior, scroll cleanup and unchanged homepage navigation.

The Home Navigation suite passed `13/13`. The combined focused Home Navigation,
Category Search resolver, Category Coverage route architecture and Search suite
passed `103/103`. Typecheck, lint, Project Guardian, `verify:quick` (`435/435`),
`verify:full`, production build, quality-gate inventory and `git diff --check`
all passed. The inventory remains 351 test files: 291 safe, 56 integration, 4
artifact-bound and 49 quick; no manifest inventory entry changed.

Local production-build browser checks passed at `320 x 568` and `390 x 844`.
The latter produced an exact `390 x 844` dialog with opaque white background,
`overflow-y: auto`, `overscroll-behavior: contain`, no horizontal overflow and
all four links plus Close visible. The hero was fully covered. Initial focus,
both focus-trap wraps, Escape close, link close, body-overflow restoration and
the mobile-to-desktop transition passed. Disposable screenshots remain outside
the repository.

## Merge and deployment evidence

- Feature branch: `fix/home-mobile-menu-overlay`
- Feature commit and approved PR head:
  `8c7a753067c4315caca7b9c421b3f72c568257e5`
- Feature PR: `#457`, **Fix homepage mobile menu overlay**
- PR gates: Project Guardian, Quality Gate, GitGuardian and Vercel passed; the
  PR was clean, mergeable and had zero unresolved review threads
- Guarded squash merge:
  `337b5f857583bd62ad0d6165856b13b74cd7e5b6`
- Feature-head and merged-main tree:
  `eba3919f884e043cfda66055906ef4ead646a8fb`
- Post-merge `main` Project Guardian run `41699789739`: passed
- Post-merge `main` Quality Gate run `41699789950`: passed
- Vercel production deployment `7528030481`: successful for the exact merge
  SHA at `2026-11-03T19:05:22Z`

## Read-only production evidence

The homepage returned HTTP `200`. Headless Chrome checks completed at requested
small-iPhone and modern-iPhone dimensions `320 x 568` and `390 x 844`, at
`2026-11-03T19:06:35Z` and `2026-11-03T19:06:42Z`. The modern viewport produced
an exact `390 x 844` dialog whose parent was `BODY`, with `position: fixed`,
opaque `rgb(255, 255, 255)` background, `z-index: 100`, vertical scrolling,
overscroll containment and no horizontal overflow. The narrow screenshot also
showed the complete menu without clipping or overlap.

In both checks the hero point was covered by a dialog child and no hero text or
cookie prompt showed through the opaque menu. All four destinations were
visible and unchanged: `#search`, `#categories`, `#goals` and `#how-it-works`.
Close was visible. Initial focus was Close; Shift+Tab wrapped to How it works;
Tab wrapped to Close. Escape removed the dialog, restored the original body
overflow and focused Menu. Activating Search supplements removed the dialog,
restored body overflow and reached `#search`. Resizing an open menu to desktop
removed the dialog, restored body overflow, exposed the desktop navigation as
`display: flex` and kept the mobile Menu control hidden. Disposable screenshots
were not committed.

The source/deployment binding is exact: GitHub's successful Production
deployment is attached to merge SHA `337b5f857583bd62ad0d6165856b13b74cd7e5b6`,
and the live browser observed the portalled `BODY` architecture introduced by
that tree.

At `2026-11-03T19:07:53Z`, read-only regression smoke confirmed Collagen, Fat
Burners and Testosterone Boosters still returned `307` to `/collagen`,
`/fat-burners` and `/testosterone-boosters`. The semantic routes returned
`200` with unchanged unique counts Testosterone `11`, Fat `21`, Collagen `29`
(`24 + 5`).

Database writes, database-file changes, migrations, production-configuration
changes, Search changes, Category Coverage changes, cookie configuration
changes, SEO-20 changes and PER4M experiment changes were all `0`. SEO-20
remains the sole SEO task `IN PROGRESS`, and its measurement freeze remains
intact. Nootropics remains unstarted by this task.
