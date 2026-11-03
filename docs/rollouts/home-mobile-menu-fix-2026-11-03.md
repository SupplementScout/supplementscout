# Homepage mobile navigation overlay fix

Date: 2026-11-03

Implementation state: local implementation verified; production closeout pending

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

Feature PR evidence, merge/tree equivalence, deployment, live navigation and
category regression smoke will be recorded here after production deployment.
