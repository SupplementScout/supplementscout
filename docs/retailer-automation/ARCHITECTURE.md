# Retailer Automation Target Architecture

**Status: OWNER APPROVED FOR RA-002 PLANNING**

**Owner approval date:** 2026-09-23

**Implementation authority:** none

**Safety rule:** this approval closes RA-001 as a documentation decision. It
does not start RA-002, authorize implementation, define any auto-safe price or
stock class, start 10 Reps shadow mode, alter production permissions, approve a
cutover, or permit removal of any code, workflow or legacy path.

## 1. Approved decision

Converge without creating a third runtime. Use production-proven
`retailer-offer-sync` as the orchestration spine, retain the control ledger,
mixed-batch executor and atomic importer as the only guarded write path, and
adopt the immutable raw/canonical snapshots, reason registry, dependency groups,
schemas and replay fixtures from `retailer-snapshot`.

Marek approved this architecture direction on 2026-09-23 for later RA-002
planning. It is not implementation authority. Until separately authorized
retailer-by-retailer shadow parity and cutover, every current guarded path
remains authoritative for its existing scope. The evaluated alternatives,
evidence, exact decisions and limitations are in
[RA-001-DECISION-PACK.md](RA-001-DECISION-PACK.md).

## 2. Component boundaries

1. **Connector** — fetches one source using bounded retry, records capture
   metadata and produces an immutable raw snapshot. Network/platform logic only.
2. **Parser/normalizer** — converts the source into the canonical input model.
   Retailer/platform quirks stop here or in typed policy configuration.
3. **Identity reconciler** — reads canonical catalogue/mapping state and returns
   exact match, candidates or review. It never writes and never guesses.
4. **Diff engine** — compares canonical source and expected DB state per row.
5. **Validator** — applies row and aggregate safety rules using stable reason
   codes; it is read-only.
6. **Planner** — partitions independent dependency groups, seals immutable row,
   child and parent plans, and emits review rows.
7. **Approval service** — records owner decisions or bounded machine execution
   authorization without conflating the two.
8. **Executor** — the only production business-write interface; applies an
   immutable approved child atomically with expected-state guards.
9. **Postflight/idempotency** — independently verifies expected deltas and a
   fresh no-op/review result.
10. **Observability** — publishes durable outcomes, freshness and evidence to the
    Review Queue/watchdog without changing business data.

## 3. Canonical input model

Every normalized source record must contain:

- schema version, retailer ID/slug and connector version;
- immutable `source_snapshot_fingerprint`, capture time and source record ID;
- external product ID, external variant ID and optional SKU/GTIN;
- direct variant URL and optional affiliate URL;
- normalized title, brand, product family, category and option evidence;
- size value/unit, flavour, pack count and product format when evidenced;
- GBP price, explicit shipping-known state/cost, delivered price and stock;
- source update time when supplied;
- evidence provenance and record fingerprint.

Unknown is distinct from false, zero and absent. Source GTIN is external
evidence and cannot promote canonical verified GTIN. Missing source records are
events requiring policy/review, not implicit OOS or deletion.

## 4. Allowed retailer-specific code

Retailer-specific behavior is allowed only in:

- a connector;
- a parser/normalizer;
- versioned typed configuration/policy;
- immutable reviewed exception data with owner, reason, creation date, test and
  removal condition;
- retailer fixtures.

Shared identity, diff, validation, planning, approval, execution, price history,
postflight and monitoring code must not branch on retailer name/ID. A required
branch means the contract is missing a general policy concept or the behavior
belongs at the edge.

## 5. Record status model

The canonical result is not one status. It is a tuple of source-record status,
proposed-change status, execution status, retailer-run status, alert level and
required next action. Their exact proposed values and current-system mappings
are defined in `RA-001-DECISION-PACK.md` section 6.

Terminal record outcomes:

- `APPLIED` — approved change committed and postflight verified;
- `NO_CHANGE_CONFIRMED` — expected state confirmed and freshness recorded;
- `REVIEW_REQUIRED` — durable review item with reason/evidence;
- `REJECTED` — explicit reviewed rejection with reason;
- `SOURCE_BLOCKED` — row cannot be evaluated because its source evidence failed;
- `SUPERSEDED` — newer immutable evidence replaced the record;
- `FAILED_SYSTEM` — internal failure prevented a durable business outcome.

Planning states may include `SAFE_TO_APPLY` and `PENDING_REVIEW`, but must not be
reported as terminal. Every source row and every approved mapping receives one
durable terminal or pending outcome; silent omission is invalid.

Minimum stable reason families:

- identity: missing, ambiguous, conflicting, stale expected state;
- commercial: price, stock, shipping and delivered-price change;
- source: unavailable, incomplete, collapsed, stale, malformed;
- approval: absent, expired, scope mismatch, superseded;
- execution: dependency, concurrency, replay, transaction, postflight;
- monitoring: freshness debt, review backlog growth, evidence correlation.

## 6. Run status model

Record outcome, retailer run and platform scheduler are separate dimensions.

Retailer run statuses:

- `PASS` — every row applied or confirmed;
- `PASS_WITH_REVIEW` — safe rows completed and one or more rows have durable
  review outcomes;
- `BLOCKED_SOURCE` — retailer-wide source health prevents trustworthy parsing;
- `BLOCKED_GUARDRAIL` — aggregate risk correctly stops the retailer;
- `FAILED_SYSTEM` — orchestration/code failure prevents durable outcomes;
- `NO_AUTHORIZED_SCOPE` — source was read but no write scope is authorized.

Platform run status is derived independently: one retailer's source or review
state cannot block another retailer. Monitoring may be `HEALTHY`,
`MONITORED_DEBT` or `ALERT`, without rewriting the retailer execution result.
`PASS_WITH_REVIEW` is not a system failure.

## 7. Blocking scope

- **Row:** identity conflict, ordinary price/stock change, isolated source 404,
  stale expected state and missing evidence quarantine only the dependency group.
- **Retailer:** source collapse, malformed schema, incomplete pagination,
  aggregate anomaly beyond policy, manifest-wide fingerprint failure or unsafe
  correlated change stops that retailer.
- **Platform:** only shared infrastructure/credential/database integrity failure
  may stop all retailers. GitHub concurrency serializes writes but must not
  couple outcomes.

Independent safe rows may execute while unrelated rows await review. Rows that
share a canonical identity, offer uniqueness constraint or rollback group are
one dependency group and move together.

## 8. Review Queue

One queue accepts immutable review evidence from every connector. Stable problem
identity is retailer + offer/mapping + semantic source fingerprint. Publication
is idempotent; newer evidence supersedes stale active evidence. A queue write is
a control write, never an offer approval. Scheduled diagnostics may publish
review evidence only under an explicitly approved publication policy and may
never manufacture an owner decision.

Queue decisions bind reviewer, timestamp, exact before/proposed state, reason,
source and plan fingerprints, expiry and idempotency key. Execution rechecks all
bindings and expected state.

## 9. Approval and execution

Owner approval and machine execution authorization are distinct records.
Scheduled runs may create the latter only for rows whose policy already grants
autonomous execution; they may not create owner commercial/identity approval.

The recommended authorization model is bounded policy execution: a scheduled
run may apply only change classes explicitly named in a versioned,
fingerprinted, previously owner-approved policy. An unknown class, identity
change, new catalogue identity or exceeded limit goes to review. A scheduled
run may never mint a one-time approval for an unreviewed manifest.

The executor must:

- use the existing separated DB roles and runtime target attestation;
- accept one frozen contract and exact keys only;
- take retailer/dependency advisory locks;
- reject stale state, drift, replay and expired approval;
- write offer and price history atomically;
- checkpoint child/parent/run state;
- return stable per-row results and exact deltas;
- support explicit, ownership-safe recovery without deleting history.

## 10. Monitoring

Each run emits one versioned evidence bundle containing source health, immutable
fingerprints, row outcomes, approval/execution receipts, price-history deltas,
postflight hash, fresh idempotency result, active review counts and correlation
IDs. Watchdog compares current facts with explicit policy, not an ever-widening
historical baseline.

Normal price changes are `REVIEW_REQUIRED` or `APPLIED`; they are never
`FAILED_SYSTEM`. A red scheduler must identify whether it represents a correct
guardrail, monitored debt or an internal failure.

## 11. Invariants that cannot be weakened

- immutable manifests and fingerprints;
- exact environment/database attestation and least-privilege roles;
- owner approval for identity/commercial exceptions;
- stale-state and source-freshness checks;
- atomic apply and price-history integrity;
- idempotency, replay protection, checkpoints and advisory locks;
- bounded source health and aggregate anomaly guards;
- per-row/dependency isolation without silent drops;
- independent postflight and zero-write watchdog;
- no direct production business writes outside the guarded executor;
- no inferred deletion/OOS from source absence alone.

## 12. Adding a retailer

A new retailer requires only:

1. connector and parser/normalizer;
2. typed policy/configuration;
3. sanitized raw/canonical fixtures including failure cases;
4. identity and commercial golden outcomes in the common harness;
5. source health, review, postflight and watchdog fixtures;
6. shadow parity evidence and owner-approved activation scope.

Changing shared core for one retailer blocks onboarding until the missing general
contract is reviewed.

## 13. Removing a legacy path

A path can be removed only after:

- all its retailer scopes have shadow parity over an owner-approved observation
  period;
- every historical incident has a regression fixture in the common harness;
- approval, execution, price history, postflight, idempotency and watchdog
  evidence match;
- no active plan/session or unconsumed approval depends on it;
- rollback/recovery is proven;
- production readback and owner approval are recorded;
- workflow/config/code removal passes the full quality gate.

No legacy path is approved for removal by this architecture approval.

## 14. Configuration and exceptions

Standard retailer configuration, durable source rules, temporary exceptions,
manual mapping overrides and unresolved conflicts are separate typed records.
Every exception binds exact scope, reason, creation date, authority, regression
test, recheck date or condition, and removal condition. It contributes to the
policy fingerprint and cannot be hidden as a retailer name, domain or ID branch
inside shared core. Unresolved conflicts live in Review Queue, not config.

## 15. Proposed migration shape

Every retailer passes recorded read-only replay, incident fixtures, same-input
shadow comparison, manual review of differences, controlled cutover, atomic
postflight, event-based observation and an explicit legacy-removal decision.
The proposed first shadow pilot is 10 Reps; its direct CSV and current 935 safe
plus 15 review partition provide scale and isolation evidence, but do not grant
cutover authority. Observation is complete only after repeated full schedule
intervals and coverage of every authorized event class, not after an arbitrary
calendar duration. The retailer order and gates are detailed in the decision
pack section 9.

## 16. Owner decisions recorded on 2026-09-23

1. `retailer-offer-sync` is the approved common spine. Preserve the control
   ledger, mixed-batch executor, atomic importer/RPC, separated database roles,
   Review Queue, postflight, watchdog, price history, fingerprints, stale-state
   protection, per-row isolation and idempotency. Later incorporate snapshot,
   schema, reason, dependency, fixture and replay capabilities from
   `retailer-snapshot`. Do not create a third runtime or parallel importer.
2. Model B is approved in principle: a scheduled run may eventually execute
   only classes covered by an explicit, versioned and previously approved
   policy. No class, threshold or production auto-apply is approved now.
3. The six-dimensional taxonomy is approved. `PASS_WITH_REVIEW` is a valid run,
   `SKIPPED_EQUIVALENT_ACTIVE` is a safe skip, and `FAILED_SYSTEM` is reserved
   for genuine code, infrastructure, database or process-integrity failures.
4. 10 Reps is the approved first **shadow-only** pilot and KIOR the first small
   later cutover candidate after all prerequisite stages and separate cutover
   approval. This decision does not start a shadow run or change a workflow.
5. Legacy removal requires proven parity, fixtures, replay, shadow comparison,
   manual verification, tests, controlled cutover, postflight, observation,
   rollback and proof of no unique active consumer. It authorizes no removal.
   GYM HIGH and Predators Gear remain deferred.
