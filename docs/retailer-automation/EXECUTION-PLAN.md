# Retailer Automation Consolidation Execution Plan

**Status: RA-004 IN PROGRESS — CONTROL-STATE INTERFACE VERIFIED_COMPLETE**

**Current active task:** RA-004 — `IN_PROGRESS`; its documentation preflight is
verified; the fixture-only exporter is preserved in PR #89, the
transactional interface is owner-approved and locally verified, and the full
repository quality gate passes under the repository LF policy; the shadow run
is not authorized; the corrected test-only single-snapshot adapter is
`VERIFIED_COMPLETE`

**Implementation:** fixture exporter plus locally database-verified forward-only
transactional interface, unwired live-provider contract and fail-closed
migration-selector exclusion; independently verified, with no
credential or production wiring

**LIVE SHADOW RUN NOT AUTHORIZED**

**Allowed statuses:** `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`,
`READY_FOR_VERIFICATION`, `READY_FOR_REVERIFICATION`, `VERIFIED_COMPLETE`

Only one RA task may be active. Task numbering for retailer migrations is an
inventory key, not an approved execution sequence. No task may become
`VERIFIED_COMPLETE` without the listed local and live evidence.

## Common evidence fields

Every task records:

- commit SHA:
- PR:
- GitHub run ID(s):
- artifact ID(s), digest(s) and retained path(s):
- local verification:
- production readback:
- owner approval reference:
- rollback result:

## RA-000 — Baseline and audit

**Status:** `VERIFIED_COMPLETE`

**Goal:** establish an evidence-backed baseline without changing runtime code.

**Scope:** retailer inventory, real flow map, shared/duplicate mechanisms,
exceptions, incident taxonomy, current Actions/readback evidence and this plan.

**Out of scope:** refactor, workflow/migration/database changes, approvals and
production writes.

**Dependencies:** owner verification. The original local/production baseline
mismatch was resolved by rebuilding RA-000 alone on a clean branch from current
`origin/main`; no runtime implementation dependency was opened.

**Existing solutions checked:** Operating Plan, Agent Operating Model,
Automation Reliability Roadmap/Owner Decisions, Data Source Registry, onboarding
runbook, offer-sync core, snapshot core, atomic importer, Review Queue,
postflight, watchdog, migrations/tests and Git history.

**Acceptance:** all 12 active retailers documented; every material claim cites a
file/symbol/run/artifact; unknowns are explicit; documentation-only diff; pre/post
Project Guardian passes; original dirty worktree remains unchanged; closeout
branch starts at exact current `origin/main`.

**Tests:** `npm run verify:project` before and after; documentation link checks;
`git diff --check`.

**Evidence:** this directory and evidence index; original local audit baseline
`1add3449096cbc3f988d0e5f6db8b9baf89f0349`; original and current fetched
production-run SHA `121fc5ce909c925e7234aef3a249661c8e7d0826`; merge-base
`1add3449096cbc3f988d0e5f6db8b9baf89f0349`, ahead/behind `0/104`; current
runs listed in evidence.

**Rollback:** revert only these documentation/AGENTS edits; no runtime rollback.

**Recorded evidence fields:** commit SHA: the Git commit containing this plan;
run IDs: documentation audit uses read-only runs only; artifacts: see evidence
index; local verification: pre-edit Project Guardian PASS, final results are
recorded in the commit/branch handoff; production readback: read-only artifacts
only; owner approval reference: pending verification; rollback result: not
applicable because no runtime change was made.

**Independent verification — 23 September 2026:** verified against
`121fc5ce909c925e7234aef3a249661c8e7d0826` with documentation commit
`8745b8bbc7fd9f7f8b324bcef69b3cac00c8ef75`. Project Guardian, documentation
links, diff whitespace, exact six-file scope, task-status contract and original
dirty-worktree integrity checks passed. The review confirmed that audit claims
remain evidence-backed, unknowns remain explicit, architecture remains a draft,
and all approval/write guardrails are preserved. No SQL, import, approval,
apply, workflow dispatch or staging/production write was performed.

## RA-001 — Approve architecture and status taxonomy

**Status:** `VERIFIED_COMPLETE`

**Goal:** prepare an evidence-backed owner decision on the common core,
component boundaries, six-dimensional status taxonomy, blocking scope,
automatic execution authority, exceptions and migration order.

**Scope:** compare all current production and harness paths; propose at most
three architectures and authorization models; recommend one target pipeline;
record no more than five plain-language owner decisions in
`RA-001-DECISION-PACK.md`.

**Out of scope:** implementation or guardrail changes.

**Dependencies:** RA-000 `VERIFIED_COMPLETE` and clean current baseline.

**Existing solutions checked:** `retailer-offer-sync`, `retailer-snapshot`,
atomic importer, shared Fit House engine, dedicated eBay/6 Pack/Whey Okay/GYM
HIGH/Jon's and catalogue-onboarding paths, validator/approver/executor, Review
Queue, control ledger, shared and dedicated postflight/watchdog mechanisms,
their tests, workflows, migrations and current RA-000 evidence.

**Acceptance:** owner approval dated 2026-09-23 confirms the pack's traceable
20-dimension comparison, one clear
recommendation, one logical pipeline, explicit connector/core boundary, status
and authorization models, exception governance, event-based migration gates,
retirement conditions, risks, unknowns and five owner decisions. The approval
retains every implementation, shadow, cutover, auto-safe and decommission gate.

**Tests:** pre/post `npm run verify:project`, documentation link check,
`git diff --check`, allowed-scope/status/integrity checks; no runtime or
production test.

**Evidence:** owner decision dated 2026-09-23; `ARCHITECTURE.md` status
`OWNER APPROVED FOR RA-002 PLANNING`; `RA-001-DECISION-PACK.md`; RA-000 evidence
index; exact baseline above; PR #85; final local/GitHub verification and merge
evidence recorded at closeout.

**Rollback:** revert the documentation commit or amend the draft; runtime is
unchanged and no production rollback exists.

## RA-002 — Canonical contract and common test harness

**Status:** `VERIFIED_COMPLETE`

**Goal:** freeze canonical source, classification, plan and outcome contracts and
prove them against existing implementations in zero-write mode.

**Scope:** reuse/merge existing snapshot schemas, reason registry, offer-sync
artifact schemas and fixtures.

**Out of scope:** production routing and retailer migration.

**Dependencies:** RA-001.

**Existing solutions checked:** `scripts/lib/retailer-snapshot/contracts/`,
`scripts/lib/retailer-offer-sync/contracts/`, atomic plan serialization and
quality-gate manifest. RA-002 reuses the snapshot runtime schema walker,
domain-separated snapshot canonical hashing, frozen local-fixture conventions and the
sealed quality-gate inventory. Existing production schemas, classifiers,
importer, approver, executor and entry points remain unchanged and unwired.

**Acceptance:** one retailer-neutral canonical source contract `v1`; exact-key,
minor-unit money, explicit missing/unknown/source-missing states, six-dimensional
taxonomy and complete reason metadata; deterministic local-fixture replay;
fail-closed write/network boundaries; safe-candidate/authorization separation;
no second executor/importer; quality manifest resealed for the new test.

**Tests:** contract/schema, taxonomy/reasons, determinism, mutation, stale-state,
source collapse, per-row isolation, missing-source semantics, safe candidate
without authorization, equivalent active, genuine system failure, denied
write/network attempts and runtime dependency boundary; quick/full gates.

**Evidence:** `evidence/RA-002.md`, contract/harness source, fixture matrix,
focused test output, deterministic report fingerprint, local quality gates and
PR #86 checks. Independent verification reviewed the complete diff and import
closure, corrected five bounded contract/harness gaps, and repeated the local
and GitHub gates. Production readback is intentionally not applicable because
the module is unwired and local-only.

**Rollback:** contract version remains unused; remove only new harness wiring.

## RA-003 — Historical incident regression fixtures

**Status:** `VERIFIED_COMPLETE`

**Goal:** convert every confirmed incident into a common-harness regression.

**Scope:** price drift, missing source row, identity conflict, active plan,
expired approval, partial session, `PASS_WITH_REVIEW` summary, scheduled queue
publication and post-apply source drift.

**Out of scope:** changing production behavior.

**Dependencies:** RA-002.

**Existing solutions checked:** retailer-specific tests, September recovery
migration tests, eBay reconciliation tests and current Actions artifacts.

**Acceptance:** each confirmed incident has fixture, expected reason/status and
link to original evidence; no unexplained missing regression.

**Tests:** full incident matrix through canonical harness; quick/full gates.

**Evidence:** `evidence/RA-003.md`, the 23-entry incident manifest, 16 executable
fixture/golden pairs, the 81-entry legacy compatibility matrix, independent
mutation and emitter-reference checks, fresh local quality gates and PR #87 CI.

**Rollback:** fixtures/harness only; runtime unchanged.

## RA-004 — 10 Reps shadow-mode pilot

**Status:** `IN_PROGRESS`

**Preflight gate:** `PREFLIGHT VERIFIED` — the documentation and blockers were
independently verified; there is still no safe single-snapshot legacy replay
entry point or approved complete read-only control-state export. See
[`evidence/RA-004-PREFLIGHT.md`](evidence/RA-004-PREFLIGHT.md) and the
machine-readable [`evidence/RA-004-shadow-plan.json`](evidence/RA-004-shadow-plan.json).

**Control-state exporter gate:** `READY_FOR_VERIFICATION` — the versioned exporter core,
authorization gate, fixture provider, CLI, pagination, consistency, redaction,
fingerprints and architecture-boundary tests are implemented. The newly
owner-approved transactional interface and unwired live-provider contract passed
their isolated local database tests and the complete repository full gate.
Live provider construction still fails closed without a separately
injected transport and future dedicated credential. See
[`evidence/RA-004-CONTROL-STATE-EXPORTER.md`](evidence/RA-004-CONTROL-STATE-EXPORTER.md).

**Control-state interface:** `VERIFIED_COMPLETE` — Marek
approved one bounded transactional RPC, separate future environment credentials
outside Git, and one minimal shared append-only evidence ledger. The migration
and unwired provider contract passed the fresh-baseline local PostgreSQL,
role/ACL/RLS, ledger, eleven-source and two-connection snapshot tests under both
`REPEATABLE READ` and ordinary `READ COMMITTED`. Status is
`CONTROL-STATE INTERFACE VERIFIED_COMPLETE`; repository LF
policy preserves the exact committed bytes of deterministic artifacts, and the
new migration remains excluded from both deployment selectors. No login,
secret, remote apply or live export was created. See
[`evidence/RA-004-CONTROL-STATE-INTERFACE-DESIGN.md`](evidence/RA-004-CONTROL-STATE-INTERFACE-DESIGN.md).

**Test-only single-snapshot adapter:** `VERIFIED_COMPLETE` — one controlled
local read is split before retailer-specific logic. The legacy copy uses the
active projector/classifier; the canonical copy uses an independent 10 Reps
connector and canonical v1 zero-write harness. Static goldens and a closed
run-level comparator produce 9/9 exact record parity, zero integrity mismatches,
zero unclassified/defect/unexplained rows, and zero prohibited capability
attempts. The explicit static raw SHA is checked before either replay path, and
the comparator regenerates nested record/integrity counts rather than trusting
report summaries. See
[`evidence/RA-004-SINGLE-SNAPSHOT-ADAPTER.md`](evidence/RA-004-SINGLE-SNAPSHOT-ADAPTER.md).

RA-004 remains `IN_PROGRESS`; the control-state interface and single-snapshot
adapter are `VERIFIED_COMPLETE`, and the shadow manifest remains
`NOT_AUTHORIZED`. The
[`evidence/RA-004-OWNER-DECISION-PACK.md`](evidence/RA-004-OWNER-DECISION-PACK.md)
is `VERIFIED_COMPLETE`. On 24 September 2026 Marek approved its five recommended
policies and future-preparation parameters. D1–D3 are `OWNER_APPROVED`; D4–D5
are `OWNER_APPROVED_FOR_FUTURE_PREPARATION`. This permits a separate staging
canary implementation plan and credential design only. Staging execution,
migration application, credential issuance/use, production, live capture,
live control-state export, shadow, control plan, approval, import, apply,
Model B and cutover remain `NOT_AUTHORIZED`; auto-safe classes remain
`NONE_APPROVED`.

**Staging-canary implementation plan:** `PREPARATION OWNER_APPROVED` and
independent verification is `VERIFIED_COMPLETE`; neither status indicates
execution readiness. The documentation-only plan and manifest are
[`evidence/RA-004-STAGING-CANARY-IMPLEMENTATION-PLAN.md`](evidence/RA-004-STAGING-CANARY-IMPLEMENTATION-PLAN.md)
and
[`evidence/RA-004-staging-canary-plan.json`](evidence/RA-004-staging-canary-plan.json).
They preserve the migration's staging and production selector exclusions and
define the future one-retailer, one-RPC, no-retry, maximum-60-minute canary and
maximum-30-minute credential. Staging execution, migration application,
credential issuance/use, live export, production and shadow remain
`NOT_AUTHORIZED`. Independent verification used the exact initial PR head in a
clean worktree, rejected all eight controlled authorization/contract mutations,
passed 84/84 focused tests, Project Guardian, TypeScript, ESLint,
`verify:quick` and `verify:full`, including the production build, and made no
staging or production connection. The next task is preparation of a separate
authorization package for a bounded read-only staging preflight; this closeout
does not connect to staging and no execution step may begin.

**Staging-preflight authorization pack:** preparation is `AUTHORIZED`, final
owner-decision verification is `VERIFIED_COMPLETE`, and all five decisions
are `OWNER_APPROVED_FOR_FUTURE_PREPARATION`. On 25 September 2026 Marek Kalinka
approved their requirements and future preparation through
`EXPLICIT_OWNER_INSTRUCTION`. Future local implementation preparation in one
separate PR is `AUTHORIZED`; staging deployment and execution are not.
The documentation-only pack and manifest are
[`evidence/RA-004-STAGING-PREFLIGHT-AUTHORIZATION-PACK.md`](evidence/RA-004-STAGING-PREFLIGHT-AUTHORIZATION-PACK.md)
and
[`evidence/RA-004-staging-preflight-authorization.json`](evidence/RA-004-staging-preflight-authorization.json).
Repository audit found no deployed metadata-only role, bounded project/retailer
identity interface, migration-ledger/schema metadata RPC, closed preflight
provider/CLI or approved private evidence store. These are recorded as
`BLOCKED_INTERFACE_GAP`; general SQL and existing validator, approver, executor
or service-role credentials are not accepted as substitutes. Control-plane and
database reads, staging connection, credential issuance/use, preflight,
migration, canary, production, live export and shadow remain `NOT_AUTHORIZED`.

**Staging-preflight local interface implementation:** `VERIFIED_COMPLETE`.
One consolidated local implementation now provides the metadata-only Q2-Q7
RPC, dedicated `NOLOGIN NOINHERIT` roles, closed Q1/Q8 provider boundaries,
fail-closed runner and CLI, six closed schemas, write-once redacted evidence,
fixtures and isolated PostgreSQL 17 verification. Both the existing
control-state migration and the new preflight migration remain SHA-bound and
excluded from STAGING and PRODUCTION deployment selectors. Q1 and Q8 remain
`BLOCKED_TARGET_CONFIGURATION`; all staging, production and execution actions
remain `NOT_AUTHORIZED`. See
[`evidence/RA-004-STAGING-PREFLIGHT-LOCAL-IMPLEMENTATION.md`](evidence/RA-004-STAGING-PREFLIGHT-LOCAL-IMPLEMENTATION.md).
Independent verification in a clean detached worktree corrected bounded target,
nested-schema, ACL/policy and pre-revoke evidence gaps, then passed the focused
regressions, both fresh networkless PostgreSQL 17 tests and repository quality
gates. This closes only the local implementation; RA-004 remains `IN_PROGRESS`.

**Bounded live transport:** `VERIFIED_COMPLETE`. Marek explicitly
authorized one separate implementation-and-merge PR on 25 September 2026. The
shared follow-up adds only the exact one-call PostgreSQL transports required by
the existing preflight and control-state providers. It accepts database URLs
only through in-memory dependency injection, binds them to the exact staging
project and temporary login, performs one static parameterized RPC in a
read-only transaction, closes the client without retry, and requires a distinct
issuer-process revoke receipt for preflight. It adds no activation manifest,
credential loader, service-role path, workflow, scheduler, importer or executor.
Both migrations remain excluded from STAGING and PRODUCTION, and no remote
execution was performed. Draft PR #97 at implementation head
`7c321744f229992b3e24a2862d936783f7aaa714` passed independent verification in
a new detached worktree: focused tests `118/118`, Project Guardian,
`git diff --check` and `npm run verify:full`, including the production build.
See
[`evidence/RA-004-BOUNDED-LIVE-TRANSPORT.md`](evidence/RA-004-BOUNDED-LIVE-TRANSPORT.md).

**Staging execution coordinator:** `OWNER_AUTHORIZED_PREPARED_NOT_EXECUTED`.
After PR #98 merged the exact staging selector activation, the first local
execution attempt stopped during read-only selector verification because an
untracked helper consumed the selector SHA map incorrectly. No remote mutation
occurred and no authorization window started. Marek then explicitly authorized
a separate preparation, verification and merge PR for the missing tracked
one-shot coordinator. It consumes only the selector-materialized workdir,
delegates migration application to the Supabase CLI, separates credential
issuance into another process, gates one canary on one complete preflight, and
revokes both RPC-only logins in `finally`. Production, feed, shadow, control
plan, approval, import, apply, offer writes, Model B, scheduler and retry remain
absent and unauthorized. See
[`evidence/RA-004-STAGING-EXECUTION-COORDINATOR.md`](evidence/RA-004-STAGING-EXECUTION-COORDINATOR.md).

Independent verification at initial head
`0b2752ac60cd8e38659751a227487f328def574b` confirmed the initial manifest
fingerprint `732cccf46eb4467460029b411f5138f81f4af69a9ad88235e6ed20d9051f7149`,
rejected all 12 controlled mutations and produced final canonical fingerprint
`9ed7ea2bea9a7fb2c2a521da87314ef6c438c46c46b751be254f7e57e2239b64`.
Project Guardian, 89 focused exporter/selector tests, TypeScript, ESLint,
`verify:quick` and `verify:full`, including the production build, passed without
staging, production, control-plane, database, SQL, credential or secret access.
Final independent verification in a second clean detached worktree rejected all
15 controlled mutations and passed Project Guardian, 89 focused tests,
TypeScript, ESLint, `verify:quick` and `verify:full`, including the production
build. The approval does not expire or expand automatically. The operator, issuer,
project reference, host, retailer ID, window and evidence store remain
unapproved and `UNRESOLVED`. Plan, fingerprint, query-allowlist, credential or
interface changes require reevaluation. The historical next task named here was
completed by the verified local implementation. The current next gate is
green GitHub checks and ordinary merge of the independently verified bounded
transport, followed by a separately controlled staging activation; no staging
deployment or preflight occurs in the transport PR.

**Staging 10 Reps retailer fixture:** `OWNER_AUTHORIZED_PREPARED_NOT_APPLIED`.
The authorized read-only staging inventory found no 10 Reps retailer row, so
the prior coordinator stopped before all mutation and canary steps. Marek then
authorized one separate preparation, independent-verification and merge PR for
one minimal staging-only record. The new transactional migration is bound to
the exact trusted staging target, rejects production, requires an empty
name-or-slug match, derives a staging sequence ID while refusing production ID
`14`, and writes only the retailer name and slug. It remains SHA-bound and
excluded from ordinary STAGING and PRODUCTION selectors. This preparation does
not authorize or perform remote migration application, production, feed,
shadow, plans, approvals, imports, apply or canary retry. See
[`evidence/RA-004-STAGING-10REPS-RETAILER-FIXTURE.md`](evidence/RA-004-STAGING-10REPS-RETAILER-FIXTURE.md).

**LIVE SHADOW RUN NOT AUTHORIZED**

**Goal:** compare the candidate canonical pipeline with the existing 10 Reps
path, with zero business/control writes.

**Scope:** all 950 approved mappings; current safe/review partition; source,
identity, diff, guard and status parity.

**Out of scope:** cutover, approval creation, apply, queue publication and
baseline widening.

**Dependencies:** RA-002 and RA-003; owner-approved shadow window.

**Existing solutions checked:** shared Fit House engine profile, protected CSV
reader, 950-row manifest, current 935/15 evidence and onboarding fixtures.

**Acceptance:** deterministic parity or explained owner-approved differences;
zero DB writes; no leaked retailer condition in shared core; source failure does
not affect other retailers.

**Tests:** repeated shadow captures, missing-row, price, stock, identity,
collapse and concurrency fixtures; quick/full gates.

**Evidence:** paired artifact digests, row-level parity report, run IDs and
zero-write attestation.

**Rollback:** disable shadow invocation; existing path untouched.

## Retailer migration task template

Each RA-005–RA-015 task has the same mandatory contract:

- **Goal:** migrate exactly one retailer after shadow parity.
- **Scope:** connector/config/fixtures and routing for that retailer only.
- **Out of scope:** another retailer, shared guard weakening, identity cleanup
  without separate owner approval, historical-data rewriting.
- **Dependencies:** RA-004 and evidence-based owner sequencing decision.
- **Existing solutions:** named current connector, parser, manifest, validator,
  executor, postflight, watchdog and tests from `AUDIT.md`.
- **Acceptance:** shadow parity; owner-approved canary; per-row isolation;
  atomic apply; price-history parity; postflight/idempotency/watchdog pass;
  legacy path remains recoverable during observation.
- **Tests:** common harness plus retailer fixtures and every linked incident;
  quick/full gates and isolated integration where applicable.
- **Evidence:** before/after digests, exact scope, run/artifact IDs, production
  readback and no-unrelated-change proof.
- **Rollback:** route back to preserved legacy path; do not delete plans/history.

The IDs below do not establish order:

| Task | Retailer | Status | Additional required proof |
|---|---|---|---|
| RA-005 | Discount Supplements | `NOT_STARTED` | 109 automatic plus 47 residual offers; rename/ownership clarity for `creatine` workflow. |
| RA-006 | Dolphin Fitness | `NOT_STARTED` | one exact automated offer and two unresolved generic legacy identities. |
| RA-007 | eBay UK | `NOT_STARTED` | 237-scope API parity, Review Queue publication, post-apply source-drift closeout and batch workflow retirement decision. |
| RA-008 | Fit House | `NOT_STARTED` | all approved absence/OOS policies, ten deferred changes and removal of Fit-House logic from shared core. |
| RA-009 | GYM HIGH | `NOT_STARTED` | full catalogue atomic parity, legacy identity cases and recognized DB postflight. |
| RA-010 | Jon's Supplements | `NOT_STARTED` | reconcile dedicated production path with existing retailer-snapshot harness; four current reviews. |
| RA-011 | KIOR Health | `NOT_STARTED` | exact 11-row golden path and historical registration hash repair. |
| RA-012 | Predators Gear | `NOT_STARTED` | source access/readiness and owner decision before any apply; 47 stale offers. |
| RA-013 | Simply Supplements | `NOT_STARTED` | Shopify versus historical Awin policy boundary, threshold shipping and aggregate price confirmations. |
| RA-014 | 6 Pack Supplements | `NOT_STARTED` | 506-row WooCommerce parity and consolidation of extensive family/review machinery. |
| RA-015 | Whey Okay | `NOT_STARTED` | resolve missing mapped-source fingerprint row; EKM parsing and 589 automatic/legacy scope boundary. |

## RA-DECOMMISSION — Remove old paths and exceptions

**Status:** `NOT_STARTED`

**Goal:** remove only fully migrated runtime paths and expired exceptions.

**Scope:** dead workflows/scripts/config branches after every applicable retailer
passes observation.

**Out of scope:** data/history deletion, active plans or owner-deferred scope.

**Dependencies:** RA-005–RA-015 verified and RA-OBSERVE complete.

**Existing solutions checked:** workflow archive pattern, quality manifest,
control ledger and exception inventory.

**Acceptance:** no active reference/session; one importer/approval/executor path;
exception removal condition met; tests/docs updated; owner approval.

**Tests:** repository reference scan, quick/full/integration gates, production
readback and rollback rehearsal.

**Evidence:** removal manifest, commit/run/artifact IDs.

**Rollback:** restore routing/code from tagged pre-decommission commit; preserve
DB history.

## RA-OBSERVE — Production observation period

**Status:** `NOT_STARTED`

**Goal:** prove stable operation across owner-approved time and event coverage.

**Scope:** scheduled runs, review backlog, source failures, commercial changes,
postflight/idempotency, watchdog and cross-retailer isolation.

**Out of scope:** feature additions or threshold widening.

**Dependencies:** migrated retailers active; duration decided in RA-001.

**Existing solutions checked:** Actions artifacts, watchdog, Review Queue and
price-history observation mechanisms.

**Acceptance:** required consecutive runs and event cases pass; no unexplained
status; no silent row; no unrelated retailer blockage.

**Tests:** scheduled live evidence plus read-only production checks.

**Evidence:** observation ledger with every run/artifact digest.

**Rollback:** route affected retailer back independently.

## RA-CLOSEOUT — Programme verification

**Status:** `NOT_STARTED`

**Goal:** verify the entire programme and freeze the final architecture record.

**Scope:** contracts, all retailer routes, safety invariants, legacy removal,
documentation and operational ownership.

**Out of scope:** new catalogue/SEO features.

**Dependencies:** all migration tasks, RA-DECOMMISSION and RA-OBSERVE verified.

**Existing solutions checked:** all evidence ledgers and production readbacks.

**Acceptance:** one canonical pipeline; one diff/validator/approval/executor
contract; no unauthorized retailer branch in shared core; all incidents covered;
full gates and independent live verification pass; owner signs closeout.

**Tests:** `verify:project`, quick/full/integration as applicable, contract and
workflow inventory, live read-only watchdog/postflight.

**Evidence:** final commit, CI/live run IDs, artifact digests and owner approval.

**Rollback:** retained release tag and per-retailer routing rollback until owner
ends the rollback window.

## Owner decisions recorded for RA-001

Marek approved on 2026-09-23:

1. `retailer-offer-sync` as the common spine, retaining the existing guarded
   write/control mechanisms and later incorporating snapshot/replay contracts;
2. Model B in principle, with no current auto-safe class, threshold, automatic
   apply or production permission authorized;
3. the separate source/change/execution/run/alert/action taxonomy, including
   `PASS_WITH_REVIEW`, `SKIPPED_EQUIVALENT_ACTIVE` and narrowly scoped
   `FAILED_SYSTEM`;
4. 10 Reps as the first shadow-only pilot and KIOR as the first small later
   cutover candidate, both behind later tasks and separate execution authority;
5. evidence-based legacy-removal gates, with no removal currently authorized
   and GYM HIGH plus Predators Gear remaining deferred.

The unresolved Whey Okay fingerprint cause, Predators source availability,
active plan/session/lock/approval inventory, exact future auto-safe classes,
future GYM HIGH disposition and eBay/GYM event coverage remain explicit future
dependencies. They do not block RA-001 closeout, but block the affected later
migration or activation until resolved. RA-002 is not started by these decisions.
