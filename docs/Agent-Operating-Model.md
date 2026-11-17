# SupplementScout Agent Operating Model

**Status date:** 17 November 2026<br>
**Authority:** Supporting operating model. The SupplementScout Operating Plan
remains the project authority and the SEO Execution Plan remains the SEO task
ledger.

## Purpose

Use a small controlled team to make work faster and more repeatable without
creating a second catalogue, second roadmap or autonomous production system.
Agents perform scoped reasoning, implementation and verification. Existing
scripts, adapters, manifests, tests and GitHub Actions perform deterministic
automation.

## Team structure

### 1. Roadmap Steward

The primary coordinating agent.

- Reads the current Operating Plan checkpoint and relevant execution ledger
  before work starts.
- Selects one active implementation from the binding sequence.
- Defines scope, evidence, safety boundary and definition of done.
- Prevents completed work from being restarted and prevents a parallel system
  from being created.
- Updates the authoritative ledger after verification.
- Is the only role that changes roadmap order or completion status.

The Roadmap Steward does not treat another agent's claim as proof. It records
`LIVE VERIFIED` only after the Independent Release Verifier supplies public
evidence.

### 2. Growth Analyst

A read-only evidence role used before choosing or designing growth work.

- Audits catalogue coverage, retailer overlap, search demand, GSC/GA4 evidence,
  internal search data and competitor page types.
- Maintains the monthly WheyWise benchmark inside the existing competitive
  analysis; no separate competitor agent is needed.
- Produces a compact evidence pack: opportunity, current coverage, risks,
  reusable mechanisms and recommended next action.
- Uses `scripts/audit-market-coverage.js`, the Retailer Data Source Registry,
  analytics reports and public evidence where applicable.
- May independently run `scripts/growth-analytics-report.js` or read its
  scheduled private artifact to obtain authenticated GA4 and Search Console
  evidence. The dedicated Google identity is read-only, credentials remain in
  the protected environment, and raw output stays outside the repository.

The Growth Analyst cannot publish, deploy, merge products, change prices or
invent traffic estimates, nutrition facts or health claims. It cannot change
GA4/Search Console settings, users, properties or retention, and it cannot turn
an API failure into estimated or zero-filled evidence.

### 3. SEO and Decision-Page Builder

The implementation role for one approved public page or feature at a time.

- Reuses `app/lib/categoryComparison.ts`, existing category infrastructure and
  the live Whey Protein implementation before adding a new mechanism.
- Reads the relevant versioned Next.js documentation before framework changes.
- Implements the page, focused tests, metadata, internal links, structured data,
  analytics and accessibility required by the SEO page-quality contract.
- Keeps primary content server rendered and uses current canonical catalogue,
  offer, freshness and delivered-price data.

The Builder cannot change product identity, retailer mappings, prices, retailer
automation or production data as part of an SEO task. It cannot mark its own
work `LIVE VERIFIED`.

### 4. Independent Release Verifier

The evidence gate after implementation and deployment.

- Reviews the changed scope independently from the Builder's summary.
- Runs focused tests, lint, type checking and build checks proportional to risk.
- Verifies live HTTP state, canonical/robots behavior, sitemap presence,
  structured data, visible content, internal links and analytics markers.
- Confirms that unrelated catalogue and retailer automation behavior is
  unchanged.
- Returns `PASS`, `BLOCKED` or `REGRESSION` with exact evidence.

The Verifier does not redesign the feature while verifying it and cannot weaken
a guard to turn a failure into a pass.

## Standard flow

```text
Roadmap Steward scopes one task
        |
Growth Analyst supplies evidence and reuse options
        |
SEO/Decision-Page Builder implements one approved unit
        |
Independent Release Verifier checks local and live evidence
        |
Roadmap Steward records status and selects the next task
```

For retailer/catalogue work, the Builder step is replaced by the existing
owner-reviewed snapshot, importer, manifest and guarded apply process. No agent
receives independent production-write authority.

## Automation boundary

Automate only deterministic work:

- tests, lint, type checks and builds;
- sitemap, canonical, robots and structured-data checks;
- scheduled price/stock refresh within an already approved immutable scope;
- read-only coverage, freshness and workflow-health reports;
- authenticated read-only GA4 and Search Console evidence reports;
- reminders when weekly measurement or monthly competitor review is overdue.

Keep human or explicit owner approval for:

- product merge/separate/family identity decisions;
- creation of products or variants from uncertain evidence;
- a new retailer production scope;
- unsupported formulation or expert judgements;
- production recovery, destructive actions and roadmap reordering.

## Automatic Project Guardian

The Project Guardian is a deterministic, read-only control, not a fifth agent
with decision authority. Run it with:

```text
npm run verify:project
```

It checks:

- SEO task IDs and allowed statuses;
- no more than one SEO task is `IN PROGRESS`, except the exact dated pair below;
- the SEO next task, Operating Plan active task, binding growth sequence and
  WheyWise response sequence agree;
- a `LIVE VERIFIED` task has matching execution evidence;
- a `CODE COMPLETE` task has an evidence entry;
- a blocked task names its blocker;
- AGENTS.md and both authoritative plans remain bound to this operating model;
- plan status dates and the monthly WheyWise review are not silently stale;
- missing weekly GSC/GA4 evidence is reported as a reminder while SEO-07 is
  still awaiting authenticated evidence.

Structural contradictions fail closed. Time-based reminders do not fail the
job, because an overdue report must not create a repeated stream of false
automation failures. The GitHub workflow runs on relevant pushes and pull
requests, once each Monday, and on manual request. It has read-only repository
permission, receives no secrets and performs no network, catalogue or
production write.

## Concurrency rule

**17 November 2026 SEO-25 production-release approval:** the owner explicitly
authorizes PR #545's two prepared guide lifecycle transitions to
`launch_approved`, necessary existing tests/docs, quality gates, Ready for
Review, guarded squash merge, automatic Vercel Production and public readback.
Only `/guides/mass-gainer-vs-whey-protein` and
`/guides/creatine-pack-size-value` are in scope. Earlier Sprint5 Draft-only/
no-launch wording below is historical and superseded for this release.
SEO-25 remains CODE COMPLETE until positive production evidence; verified
lifecycle state and LIVE VERIFIED closeout require that readback. Preserve
SEO-20 frozen/binding, SEO-21/22/23/24 LIVE VERIFIED and Stage3 disabled.
No catalogue/nutrition/mapping/history/importer/migration/workflow or schedule
write, Google submission, GYM HIGH hub or Sprint6. If direct Vercel API403
persists, retain protections and use authorized GitHub deployment evidence
plus public readback; never claim deployment without reliable verification.

**Sprint5 checkpoint:** SEO-25 is CODE COMPLETE with local actual-source tests
and1440/390px production-build QA. One Draft PR awaits a separate publication
decision; no next implementation follows. Frozen SEO-20 remains active/binding.

**17 November 2026 Content Growth Sprint 5 owner approval:**
Content Growth exception: SEO-25 beside frozen SEO-20; Draft PR only.
The single bundle is `/guides/mass-gainer-vs-whey-protein` and
`/guides/creatine-pack-size-value`, selected after authenticated settled GSC
and bounded data-readiness checks. Necessary code/tests/docs and minimal
contextual links are authorized. SEO-21/22/23/24 stay LIVE VERIFIED; previous
active-pair exceptions are retired. New routes stay planned/noindex.
No merge, production deployment/indexing, data/nutrition/mapping/history or
importer/workflow change, Google submission or Sprint 6 is authorized.

**17 November 2026 SEO-24 LIVE VERIFIED closeout:** owner-approved PR #544
squash merged release head `b8bfcf7bc167edb7529c02bcda8fe3e61de3e275` as
`cd9a9d312c03db71c07e99f8c2a7b1cbaf4b5636` with identical tree.
Main Quality Gate/Guardian pass. Vercel Production
`dpl_Ch1Hdj63RwBgzVVeQ4xWHyeyjwWx` is READY on the public domain.
Both guides pass public HTTP, actual-source HTML/variant/arithmetic equality,
indexability/sitemap/schema, links and1440/390px QA. Both lifecycle entries
now record `live_verified` with unchanged public indexability. Earlier Draft/
CODE COMPLETE checkpoints below are historical. This closes the bounded
SEO-24 exception; only frozen SEO-20 remains active/binding. SEO-21/22/23
stay LIVE VERIFIED; Stage3 stays disabled. Google inclusion is UNKNOWN;
no GSC action or next sprint was performed.

**17 November 2026 SEO-24 production-release approval:** the owner explicitly
authorizes PR #544's two prepared guide lifecycle transitions to
`launch_approved`, necessary existing tests/docs, quality gates, Ready for
Review, guarded squash merge, automatic Vercel Production and public readback.
Only `/guides/whey-isolate-vs-concentrate` and
`/guides/protein-powder-pack-size-value` are in scope. The earlier Sprint 4
Draft-only/no-launch wording below is historical and superseded for this
release. SEO-24 remains CODE COMPLETE until positive production evidence;
`live_verified` and LIVE VERIFIED closeout require that readback.
SEO-20 stays frozen/binding; SEO-21/22/23 stay LIVE VERIFIED and SEO-15 Stage 3
stays disabled. No catalogue, nutrition, mapping, history, importer or workflow
write, Google submission or next sprint is authorized.

**17 November 2026 Sprint 4 owner approval:**
Content Growth exception: SEO-24 beside frozen SEO-20; Draft PR only.
Only the isolate/concentrate and matched protein-pack-size guides form this
bundle. SEO-21/22/23 stay live verified and their active-pair exceptions are
retired. Necessary code/tests/docs and one Draft PR are authorized; no merge,
production deployment/indexing, data or nutrition write, workflow change,
Google submission or further implementation follows.

**17 November 2026 SEO-23 release approval:** PR #543's two guide lifecycle
transitions, required tests/docs, guarded squash merge, automatic production
deployment and evidence-based closeout are now owner-authorized. Earlier
Sprint 3 Draft-only wording is historical for this release. SEO-20 stays
frozen; SEO-21/22 stay live. No production data write, GSC submission or next
implementation follows.
SEO-23 is now production verified and closed. Only frozen SEO-20 remains
active/binding; the release approval grants no next implementation.

**17 November 2026 Sprint 3 approval:**
Content Growth exception: SEO-23 beside frozen SEO-20; Draft PR only.
Only the two named budget-protein/caffeine-free guides form this single bundle.
SEO-21 and SEO-22 must remain live verified; previous active-pair permissions
are retired. The current owner decision supersedes the earlier no-next-sprint
restriction only for this bundle. No merge, production write/publication,
Search Console submission or next implementation is authorized.

The subsequent 17 November SEO-22 launch approval authorizes the two prepared
guides' indexability transition, tests/documentation, existing read-only GSC
inspection, squash merge and automatic production deployment. Record live
completion only after public verification. Earlier Draft-only wording below
is historical for this release; SEO-20 and all data-write boundaries remain.
SEO-22 has now passed production verification and is closed; only SEO-20
remains active. Its earlier implementation exception grants no next task.

- One SEO implementation may be in progress.
- **17 November 2026 Sprint 2 approval:**
  Content Growth exception: SEO-22 beside frozen SEO-20; Draft PR only.
  Only the two named delivery/protein guides form this single bundled task.
  SEO-21 must stay live verified; the earlier SEO-21 active-pair exception is
  retired. Guardian permits only SEO-20/SEO-22 with matching authority in all
  four documents and both approved routes in the existing ledger row.
  No production release, data write or next implementation follows.
- **17 November 2026 owner decision:** Content Growth exception: SEO-21 beside frozen SEO-20; Draft PR only.
  This permits one bounded `/creatine#under-20` implementation while SEO-20
  remains frozen and `IN PROGRESS`. The existing SEO ledger records both;
  SEO-20 remains the binding next task. The exception confers no merge,
  deployment, publication or production-write authority and no permission for
  another concurrent implementation. The Guardian accepts only this exact pair
  with matching authorization in AGENTS.md and both authoritative plans.
  The later owner instruction authorized PR #541's exact head, squash merge,
  automatic production deployment and verified SEO-21 closeout. That release
  supersedes its earlier Draft-only restriction; SEO-21 is now live verified.
  The dated exception is historical and grants no next implementation.
- One separately scoped retailer/data task may run only when it does not touch
  the same files, data or release boundary.
- Analysis and independent verification may run in parallel when read-only.
- A production reliability or data-integrity incident takes priority until the
  safe state is restored.

## Adoption plan

1. Keep the Automatic Project Guardian green while using this role split for
   SEO-13 one reviewed page at a time.
2. Repeat it for the first two pages in the high-intent cluster.
3. Record repeated manual steps and failure patterns.
4. Only then create reusable Codex skills for stable procedures. Prefer the
   already proposed Retailer Import Operations and Catalogue Quality skills;
   add an SEO Release Operations skill only when three clean executions prove a
   stable workflow.

Do not create one agent per page or one agent per retailer. New roles require a
demonstrated recurring gap that the four-role model cannot safely cover.
