# SupplementScout Agent Operating Model

**Status date:** 1 August 2026<br>
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

The Growth Analyst cannot publish, deploy, merge products, change prices or
invent traffic estimates, nutrition facts or health claims.

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
- no more than one SEO task is `IN PROGRESS`;
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

- One SEO implementation may be in progress.
- One separately scoped retailer/data task may run only when it does not touch
  the same files, data or release boundary.
- Analysis and independent verification may run in parallel when read-only.
- A production reliability or data-integrity incident takes priority until the
  safe state is restored.

## Adoption plan

1. Keep the Automatic Project Guardian green while using this role split for
   SEO-09.
2. Repeat it for the first two pages in the high-intent cluster.
3. Record repeated manual steps and failure patterns.
4. Only then create reusable Codex skills for stable procedures. Prefer the
   already proposed Retailer Import Operations and Catalogue Quality skills;
   add an SEO Release Operations skill only when three clean executions prove a
   stable workflow.

Do not create one agent per page or one agent per retailer. New roles require a
demonstrated recurring gap that the four-role model cannot safely cover.
