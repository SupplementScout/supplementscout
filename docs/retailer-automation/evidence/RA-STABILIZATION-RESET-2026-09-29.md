# Retailer automation stabilization reset — 29 September 2026

**Decision:** owner approved; execution started as documentation and read-only
evidence only.

**Active task:** RA-STAB-01.

**RA-004 state:** `BLOCKED`; no retry, replacement activation or live shadow is
authorized.

## Why the programme is being reset

RA-004 accumulated repeated staging-interface work before reaching its intended
same-input shadow comparison. The retained evidence records separate failures in
selector materialization, staging dependencies, role ownership, ledger hashing,
ACL interpretation, revoked-credential verification, provider identity and the
final SQL empty-state contract. Every attempt failed closed and protected
business data, but continuing the same live-activation sequence would spend more
time on control infrastructure without proving retailer classification parity.

The final consumed `v3` attempt is conclusive for its scope:

- all 11 required sources were queried;
- `completeness_status` was `COMPLETE`;
- `postflight_state` and `watchdog_state` were legitimately empty;
- SQL returned `BLOCKED_INCOMPLETE_EXPORT`;
- write and mutation attempts were zero;
- five source-observation rows were committed and read back atomically;
- both temporary credentials were revoked;
- staging and production selectors are closed;
- business data is unchanged;
- the activation is terminal, non-replayable and has no retry authority.

This proves a contract drift, but the owner decision is not to create another
live repair cycle now. The evidence remains available for a later artifact-only
regression.

## Binding stabilization boundary

RA-STAB-01 uses only existing production paths and read-only evidence until a
separate exact owner decision authorizes a recovery or business write. It does
not create a third runtime and does not resume the consolidation migration.

Permitted now:

- read current repository, workflow and retained artifact evidence;
- run the existing read-only watchdog;
- inspect current ordinary workflow results and source diagnostics;
- classify incidents and prepare common regression fixtures;
- run local tests and quality gates;
- propose one retailer-neutral fix after the incident is reproducible.

Not authorized now:

- RA-004 retry, replacement activation, migration or credential;
- live control-state export, shadow, cutover or Model B activation;
- production/control/database write or approval creation;
- price, stock, OOS, mapping, identity or catalogue change;
- new importer, executor, approval route or retailer-specific shared-core branch;
- widening a watchdog baseline to make a failure green.

## Current evidence entering stabilization

The latest complete read-only watchdog available at reset time is run
`36526941566`, generated `2026-09-29T05:36:40.854Z`. It reported six failed
retailers and zero database writes, but it is not the final current-state proof
because later ordinary runs succeeded for GYM HIGH (`36556717990`) and Jon's
Supplements (`36558502917`). A new read-only capture is therefore the first
checkpoint.

Known later run evidence, not yet a consolidated final state:

- Whey Okay `36543685468`: stopped before validation on an active approval,
  workflow or conflicting session; zero writes;
- shared run `36546643195`: 10 Reps dry-run passed with review but apply rejected
  an equivalent active plan; Fit House source capture passed but its protected
  six-offer source fingerprint changed; zero completed writes;
- 6 Pack `36551183019`: one approved WooCommerce product page returned HTTP 404,
  classifying the retailer capture `SOURCE_READ_FAILED`; zero writes;
- GYM HIGH `36556717990`: ordinary full-catalogue run succeeded;
- Jon's `36558502917`: dry-run, apply, DB postflight and fresh-source
  idempotency succeeded.

These facts do not authorize recovery. They define the first read-only
classification package.

## Anti-spaghetti rules

1. Repair an incident class, never a retailer name.
2. Reproduce before implementing.
3. Put source quirks in connector/parser or typed policy, never shared branching.
4. Use the existing control ledger, Review Queue, executor and postflight.
5. Treat missing source as evidence/review, never implicit OOS or deletion.
6. Keep owner commercial/identity decisions separate from machine execution.
7. Require a removal condition for every temporary exception.
8. Do not delete a legacy path until parity, observation and rollback are proven.

## Reopening RA-004

RA-004 may be proposed again only after RA-STAB-01 closes. Its first permitted
form is offline recorded replay: one immutable artifact, two classifiers, one
deterministic parity report and zero network or writes. Live infrastructure is a
later decision, not a prerequisite for proving classification parity.
