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
3. Follow `docs/Agent-Operating-Model.md`; keep one active SEO implementation
   and reuse existing mechanisms before creating a new one.
4. Run `npm run verify:project` before and after changing a roadmap, execution
   status or completion evidence; resolve structural failures before continuing.
5. Do not mark work complete without the required local and live evidence.
6. Never give an agent autonomous product-identity or production-write
   authority; retain existing owner approvals and guarded data paths.

## Quality gate

For code or workflow changes, run `npm run verify:quick` after implementation.
Run `npm run verify:full` before declaring the change complete. Tests that use
Docker or a local database remain isolated under `npm run verify:integration`;
quality-gate jobs must never receive production-write credentials. When adding,
removing or renaming a test, review and reseal
`scripts/quality-gate-manifest.json` so no test is silently omitted.
