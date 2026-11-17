<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## SupplementScout project control

For SEO, catalogue, retailer, automation or roadmap work:

1. Read the current checkpoint in
   `docs/SupplementScout-Operating-Plan-2026-07-15.md`.
2. Read the relevant execution ledger, especially
   `docs/SEO-Execution-Plan.md` for SEO work.
3. Follow `docs/Agent-Operating-Model.md`; keep one active SEO implementation,
   subject only to the dated owner exception below, and reuse existing mechanisms.
4. Before proposing or starting the next step, verify the current repository
   state, the latest execution evidence and the relevant production readback.
   Treat older plans and conversation summaries as context, not proof that work
   is still outstanding. Do not repeat completed work.
5. Run `npm run verify:project` before and after changing a roadmap, execution
   status or completion evidence; resolve structural failures before continuing.
6. Do not mark work complete without the required local and live evidence.
7. Never give an agent autonomous product-identity or production-write
   authority; retain existing owner approvals and guarded data paths.

**17 November 2026 owner decision:** Content Growth exception: SEO-21 beside frozen SEO-20; Draft PR only.
The exception covers only `/creatine#under-20` and supporting tests/documentation.
Preserve all SEO-20 frozen fields, measurement gates and schedule. No merge,
deployment, production writes, new guide routes or publication is authorized.
Use the existing SEO ledger; no further parallel implementation is implied.

The later 17 November 2026 owner release instruction explicitly authorized
PR #541 at `d8bb5e3c7cad547353de445740b74fe1374f0376`, squash merge,
automatic Vercel production deployment and evidence-based SEO-21 closeout.
That instruction supersedes the earlier Draft-only restriction for this
release. SEO-21 is now live verified; SEO-20 remains frozen and active.
No further implementation, guide publication or data-write authority follows.

**Content Growth Sprint 2 owner approval (17 November 2026):**
Content Growth exception: SEO-22 beside frozen SEO-20; Draft PR only.
SEO-22 is one bundled implementation of only
`/guides/supplement-prices-including-delivery` and
`/guides/cost-per-25g-protein`, including necessary tests and documentation.
SEO-21 stays live verified. The earlier SEO-21 concurrency exception is retired.
No merge, production publication, nutrition/catalogue write, next sprint or
SEO-20 change is authorized. New routes stay planned until owner launch approval.

The subsequent SEO-22 production-launch instruction explicitly authorizes
PR #542's two lifecycle transitions to launch_approved, necessary existing
tests/documentation and read-only Search Console inspection, guarded squash
merge, automatic Vercel production deployment and closeout only after public
verification. This supersedes the earlier Draft-only restriction for SEO-22.
It does not authorize catalogue/nutrition/mapping writes, SEO-20 changes or a
next sprint. Existing Google read-only scopes and report schedules stay fixed.
That release is now production verified and SEO-22 is closed. Its two routes
are live verified; Google indexing is separately pending. The earlier Draft
exception is historical and grants no further implementation authority.

**Content Growth Sprint 3 owner approval (17 November 2026):**
Content Growth exception: SEO-23 beside frozen SEO-20; Draft PR only.
One bundle covers `/guides/protein-powder-under-30` and
`/guides/caffeine-free-pre-workout`, necessary tests/docs and contextual links.
SEO-21 and SEO-22 stay live verified; their active-pair exceptions are retired.
New routes remain planned/noindex. No merge, production publication, data or
nutrition write, Search Console submission or further sprint is authorized.
The owner will submit URLs manually after a separately approved publication.

The subsequent SEO-23 production-release instruction explicitly approves
PR #543's two lifecycle transitions to launch_approved, necessary tests/docs,
guarded squash merge, automatic Vercel production release and closeout only
after successful public verification. It supersedes the Draft-only boundary
for this release. No product/nutrition/mapping write, SEO-20 change, Google
submission or next sprint is authorized.

For nutrition work, also read `docs/Nutrition-Execution-Plan.md` (the canonical
nutrition ledger) and `docs/nutrition-candidate-extractor.md` (the existing
process). Keep one active nutrition task and preserve the Operating Plan's SEO
priorities. The nutrition ledger records its next step; Project Guardian does
not yet validate nutrition statuses or evidence. NUT-00 authorizes documentation
and read-only audit only, not label collection, implementation or database writes.

Before creating or changing a public comparison, category, brand or retailer
hub, follow `docs/SEO-Indexability-Lifecycle.md`: confirm the feature does not
already exist; register the route; reuse the shared cache, robots, canonical,
sitemap and error contracts; and add their contract tests. Never add local
index/noindex logic or deindex a `live_verified` route because coverage dipped.
GYM HIGH remains `owner_deferred` until a separate owner decision.

### Retailer automation consolidation

Before retailer-automation work, read `docs/retailer-automation/AUDIT.md`,
`ARCHITECTURE.md` and `EXECUTION-PLAN.md`; verify the RA task is not already
done and work on only the one designated RA task. Do not create parallel
importers, approval paths or executors, put retailer conditions in shared core,
weaken guardrails, or write directly to the database. Add a regression test for
every fixed incident and update task status/evidence before handoff. Stop when
code, documentation and production evidence conflict.

## Quality gate

For code or workflow changes, run `npm run verify:quick` after implementation.
Run `npm run verify:full` before declaring the change complete. Tests that use
Docker or a local database remain isolated under `npm run verify:integration`;
quality-gate jobs must never receive production-write credentials. When adding,
removing or renaming a test, review and reseal
`scripts/quality-gate-manifest.json` so no test is silently omitted.
