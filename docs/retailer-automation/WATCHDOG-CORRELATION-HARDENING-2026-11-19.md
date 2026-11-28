# Shared watchdog correlation hardening

Status: **NEEDS_OWNER_APPROVAL**. This is a separately reviewed change after
PR556, not another production release of that repair. No migration, business
write, review publication, worker dispatch, merge or deployment is authorized.

## Incident and resulting behaviour

Native watchdog44593875565 correctly retained its worker-schedule failure and
six retailer failures. Two monitoring contracts were inconsistent with the
shared workflow: an08:17 schedule that ran Gladiator/Holland was treated as an
unresolved Fit House/10Reps attempt despite their empty SKIPPED jobs, and their
publication bindings still named internal composite steps rather than the
wrapper names exposed by GitHub Jobs API. Applicable ordinary44508522817 and
later other-profile44576527715 remain distinct. A successful manual READ ONLY
never replaces an ordinary failed attempt or earns ordinary observation credit.

The existing watchdog now binds those shared profiles to exact job names.
Missing/failed/queued jobs remain incomplete; another executor cannot supply
their capture or stages. A skipped job is EXPECTED_SKIP only when the workflow
definition fetched at that run's immutable SHA proves disjoint scheduled and
manual branches, and a job that actually started proves a different cron.
The supported condition is the existing restricted schedule/dispatch shape;
unknown expressions, missing jobs, same-cron skips and ambiguous selection stay
unresolved. Repository expressions are never evaluated as JavaScript. Manual
SKIPPED is recorded as NOT_SELECTED with expectation UNKNOWN, not a proved safe
scheduled skip. No retailer, offer, product or historical run ID is hardcoded
in the new implementation.

Only the exact native publication wrapper names are changed for Fit/10Reps.
Same-run, exact-profile, artifact, fingerprint, postflight and review durability
validation remain in place; whole-job SUCCESS is insufficient.

## Bounded history and safety

The existing25-row/four-page budget is unchanged. Once the latest attempt and
complete success are known, remaining pages use GitHub's event=schedule filter
instead of spending the whole budget on manual activity. Results are deduplicated
and ordered across both streams. Current queued/in-progress runs are included
so they cannot disappear behind a completed-only listing. Exhaustion still sets
WORKFLOW_HISTORY_TRUNCATED; missing contracts and old ordinary failures still
fail. Source definitions are bounded to256KiB and cached per workflow/run SHA
in the existing history cache. Every request uses the existing read-only client;
the existing20-minute workflow timeout remains. No HTTP retry was introduced.

Real API replay confirms44576527715 as an expected other-schedule skip for both
Fit/10Reps while retaining their actual ordinary44508522817. Gym's latest ordinary
44528441465 remains failed and its history remains truncated: raw successful
43589870967 from14November lacks the now-required DB-postflight stage, so it
cannot become a fabricated compatible complete anchor. Filtering does not
manufacture a PASS from an old top-level SUCCESS.

No backlog limits or allowed offer IDs changed. Reviewed identities, execution
RPCs, publisher, SQL, cron definitions, credentials and sealed-artifact controls
are untouched. Older native receipts remain historical FAIL, not rewritten
results of the proposed code.

## Evidence and verification

Production base:3a0ee9a1953b2715053182b8a0ec2e80357de9bd, CURRENT269,
fingerprint f54057cd49ea4422a3b8b849ac15ce38b518496a44a8d4dceb2f480f8f97eb66,
production pending=[]. READ ONLY21:07 confirms the same4580 identities and all
mapping-state hashes. History is now57254: one eBay2735 record was created at
20:24 before this task; the older57253 receipt is preserved, not overwritten.
The extra row is outside the completed Gym65/Discount106 scope.

The old evidence branch retains40bea16f and local archival commit2c6cd421.
No old worktree or its runtime changes were copied into this branch.

Regression tests are added to the existing catalog-health.test.js: disjoint
scheduled skip; same-cron unexpected skip; missing/ambiguous jobs; immutable
definition SHA; unknown conditions; failed/queued selected jobs; unrelated
executor; manual READ ONLY after ordinary FAIL; event-filtered bounded history;
exhaustion/missing artifacts; exact publication names for all four shared
profiles. Existing tests retain old/new fingerprint and same-run negative cases.
The371-file gate inventory is unchanged and its seal verifies; no test file was
added, renamed or omitted. Final test receipts are recorded with this Draft PR.

## Release boundary

Local/API validation is not a deployed native watchdog PASS. Global status stays
BLOCKED until an approved release and actual native monitoring plus a natural
worker schedule prove recovery. Publication gaps for Simply and new10Reps
identity reviews are separate policy/integration changes. Owner approval of the
final PR SHA and a controlled deployment is required; no production execution
is included in this Draft PR.
