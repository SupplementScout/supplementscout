# eBay commercial execution-bound `source_url` alignment — 2026-11-05

## Status and bounded authority

- Starting authoritative `origin/main`:
  `258384d548b38f27965b044f6b88748dd84dcd60`.
- Failed owner-authorized retry run: `42030297419`.
- Production project: `aftboxmrdgyhizicfsfu`.
- Scope: eBay reconciliation-producer alignment and regression evidence only.
- Migration count: `0`.
- Production database writes: `0`.
- Review Queue writes: `0`.
- Publication retries in this implementation task: `0`.
- Owner decisions, execution requests and worker executions: `0 / 0 / 0`.
- SEO-20: unchanged.

The failed reconciliation artifact `13414493426`, failed run `42030297419`
and its owner authorization are permanently rejected for mutation. They are
incident evidence only. This task does not capture a new eBay source, build a
new reconciliation request or publish the Review Queue.

## Zero-write rollback proof

The single authorized retry reached the real service-role RPC and failed
atomically with
`AUTOMATION_REVIEW_PUBLICATION_REFRESH_BINDING_INVALID`. Independent
repeatable-read production evidence after the failure showed:

| State | Before | After |
|---|---:|---:|
| Review Queue rows | 3487 | 3487 |
| Review events | 9896 | 9896 |
| Publication seals | 196 | 196 |
| Execution requests | 292 | 292 |
| Active eBay rows | 81 | 81 |
| Products | 1399 | 1399 |
| Product variants | 4070 | 4070 |
| Retailer products | 4361 | 4361 |
| Offers | 4361 | 4361 |
| Price history | 48415 | 48415 |

The exact idempotency-key seal count remained `0`. Catalogue hash
`6a0af71360fc18af842d047cae44c6f9c697cbf2421cca21229f1e407b0536b1`
was unchanged, and APPROVED reviews `619`, `1159`, `1160` and `1632` retained
their exact snapshots.

## Root cause

Nine existing commercial PENDING refreshes had semantically equal affiliate
destinations but different deterministic query serialization:

`3315/2543`, `3316/2601`, `3317/2603`, `3318/2689`, `3319/2690`,
`3320/2715`, `1027/2749`, `1088/2769` and `1029/2774`.

For all nine,
`stableAffiliateUrl(source_url) == stableAffiliateUrl(proposed_state.offer.url)`
was true while raw string equality was false. The shared production RPC
correctly rejected the internally inconsistent execution binding because it
requires exact `execution_binding.source_url` equality with the protected
`proposed_state.offer.url`.

## `source_url` semantic audit

The field has two related consumers:

1. The admin Review Queue reads `source_url` as the safe source link shown to
   the owner.
2. The shared publisher carries it unchanged into the commercial execution
   binding, where the strict RPC and worker require the review evidence to
   match the protected plan exactly.

The authoritative executable URL is `proposed_state.offer.url`, originating
from the sealed protected plan. Fresh eBay source truth is still checked first:
`assertCommercialProposedState()` compares the raw returned affiliate
destination with that protected URL through the existing
`stableAffiliateUrl()` contract. That comparison ignores only established
technical serialization differences while rejecting changed scheme, host,
port, path and meaningful query data.

After this semantic proof, retaining the raw serialization in the
execution-bound `source_url` adds no identity information and conflicts with
the strict downstream contract. Raw evidence remains recoverable and
cryptographically bound through the immutable source artifact, run/artifact
IDs, artifact digest, contract/report/content hashes, review-scope fingerprint
and per-row source fingerprint in `source_evidence`. No schema duplication is
needed.

The shared SQL exact-equality guard remains desirable: it is retailer-neutral,
prevents internally inconsistent bindings and keeps URL semantics out of the
database. The shared publisher must not guess retailer URL equivalence.
Retailer-specific normalization therefore belongs in the eBay reconciliation
producer, after source equivalence has been proved.

## Implementation

Only `scripts/automation-review-reconciliation-dry-run.js` changes runtime
behavior. For `COMMERCIAL_CHANGE` rows it now:

1. builds `proposedState` from the protected plan;
2. runs the unchanged `assertCommercialProposedState()` semantic proof; and
3. binds manifest `source_url` to exact `proposedState.offer.url`.

Non-commercial identity and source-failure rows retain their existing raw
source URL behavior. The source-row fingerprint is supplied by the sealed
source evidence and is not recalculated or changed by this alignment.

No URL helper was added. The shared publisher, production SQL, migrations,
worker and admin UI are unchanged. In particular, the SQL guard comparing
`execution_binding.source_url` and `proposed_state.offer.url` remains exact,
and worker review/plan plus database/plan comparisons remain strict.

## Regression evidence

Production-shaped generic tests prove:

- reordered query parameters and technical `amdata` pass semantic equality;
- the produced commercial `source_url` equals both the protected proposed URL
  and plan `offer.values.url` exactly;
- ordinary `UPDATE_PRICE`, `HARD_PRICE_ANOMALY` and atomic
  `UPDATE_PRICE_AND_STOCK` contracts pass;
- changed host, path, meaningful query value, missing meaningful query data
  and extra meaningful query data fail before manifest normalization;
- non-commercial `source_url` behavior is unchanged;
- source-row fingerprints remain unchanged;
- the shared publisher does not normalize retailer URLs;
- the SQL exact-equality guard and strict eBay worker checks remain present;
- runtime code contains no affected production review or offer ID branch.

Focused reconciliation, publisher, RPC, eBay worker and retry-path suite:
`212/212 PASS`.

## Local verification

- Project Guardian before implementation: `PASS`.
- Project Guardian after implementation: `PASS`.
- `npm run verify:quick`: `PASS`.
- `npm run verify:full`: `PASS`.
- `npm run typecheck`: `PASS`.
- `npm run lint`: `PASS`.
- `npm run build` with the Quality Gate loopback placeholders: `PASS`.
- `git diff --check`: `PASS`.

## Stop boundary and next step

This implementation stops after code, documentation, verification and the
authorized documentation/code PR merge. It stops before publication retry,
publication RPC, Review Queue mutation, owner decision, execution request,
worker execution, catalogue/business write, migration, source capture,
freshness recovery, retailer onboarding, nutrition work or SEO-20 change.

After merge, the next safe operation is a completely new reconciliation
against the then-current production baseline only if source artifact
`13407363148` and its contract remain unexpired. That reconciliation must mint
new exact evidence and requires a new explicit owner authorization. If the
source contract has expired, the process stops and requires a separately
authorized new source capture instead.
