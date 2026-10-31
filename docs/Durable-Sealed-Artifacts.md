# Durable sealed artifacts

## Phase A contract

A sealed artifact is an allowlisted operational artifact whose exact bytes are
bound to an environment, artifact kind, SHA-256 digest, private durable URI and
immutable registry row. An artifact is reported as `DURABLY_SEALED` only after
the object has been written without upsert, downloaded again, hashed, registered
and downloaded and verified a second time. A registry row alone is never proof
that the object is healthy.

Phase A provides the shared core only. It does not require sealing in any
existing approval, reviewed-package, apply, closeout or recovery workflow. It
does not backfill historical artifacts and does not change business data.

## Storage and identity

The target is the private Supabase Storage bucket `sealed-artifacts`, separate
from the raw/source-evidence `nutrition-sources` bucket. Canonical URIs are:

```text
supabase-storage://sealed-artifacts/<environment>/<artifact_kind>/<sha256>/<safe-filename>
```

`environment` is `staging`, `production` or the isolated-test-only value `test`.
Artifact kind and environment are part of the immutable identity. A staging
artifact is never accepted as production. Filenames cannot contain paths;
bounded safe filenames are sanitized before the object path is derived.

The registry identity is unique on `(environment, artifact_kind, sha256)`. This
allows the same exact bytes to exist legitimately in different environments or
artifact classes without making a bare SHA a globally unique semantic key. A
SHA lookup that matches several artifact kinds is rejected as ambiguous unless
the caller supplies the kind.

The bucket setup is in
`supabase/manual/20261030121000_create_private_sealed_artifacts_bucket.sql`.
It is intentionally outside the automatic migration chain because project
quality gates prohibit ordinary migrations from mutating Supabase-managed
schemas. The setup is idempotent only for an exact matching private bucket and
fails closed on any existing-contract mismatch. It creates no public policy.

The registry migration is
`supabase/migrations/20261030120000_create_sealed_artifacts_registry.sql`. The
table grants only `SELECT` and `INSERT` to `service_role`; RLS is enabled and a
trigger rejects every normal `UPDATE` or `DELETE`.

## Shared implementation

The reusable implementation is under `scripts/lib/sealed-artifacts/`:

- `contract.js` owns the allowlists, SHA-256, validation, URI and filename rules;
- `service.js` implements seal, fresh verify/readback, lookup and restore;
- `supabase-adapters.js` is the private Storage and registry adapter;
- `testing.js` is an isolated deterministic adapter for contract tests.

`seal()` accepts exact bytes plus validated context, never an arbitrary remote
destination. It rejects temporary-only kinds, unsupported MIME types, invalid
metadata, empty or oversized content, missing secret declarations and common
credential signatures. Supabase uploads always use `upsert: false`.

`verify()` resolves the immutable registry identity by SHA-256, `run_id` or
durable URI, downloads exact bytes, checks object metadata, size, environment
and SHA-256, and fails closed on any inconsistency or ambiguous reference. An
object without a registry row requires explicit reconciliation and is never
adopted automatically.

`restore()` first performs the same durable verification, then writes a new file
below an explicit temporary root without overwriting or traversing links. The
restored local file is read and hashed again before success is returned.

Same bytes with the same complete immutable metadata are an idempotent success.
Different metadata, an overwrite attempt, a missing object, a missing registry
row, tampering or any cross-environment request is rejected. The core contains
no delete, update, auto-heal or corruption-bypass operation.

## Security and activation boundary

Only server-side privileged credentials may use the Supabase adapters. Do not
expose them through a client component, public route or signed/public URL. Do
not log artifact bytes or credentials. The bucket limit is 10 MiB and its MIME
allowlist matches the shared contract and registry constraints.

Repository merge does not activate the bucket or registry in any Supabase
project. Staging activation requires an exact readback against project
`hxnrsyyqffztlvcrtgbf`. Production activation in project
`aftboxmrdgyhizicfsfu` requires separate explicit owner authorization. Phase B
workflow enforcement remains disabled after activation.

## Phase B shared enforcement bridge

Phase B adds one shared rollout bridge in
`scripts/lib/sealed-artifacts/rollout.js`. It does not replace any producer,
approval system, planner, executor, registry or recovery mechanism. The bridge
owns the durable-required policy, contract binding, environment checks, Phase A
`seal()` plus fresh `verify()` sequence and the dependent-mutation guard.

The single rollout control is
`DURABLE_SEALED_ARTIFACTS_ENFORCEMENT`. Missing, empty and `OFF` all mean OFF;
the only active value is `ON`. Invalid values fail closed. Repository merge does
not set the control. The shared Review Queue action and the eBay queue publisher
read the same repository configuration variable, but an absent variable remains
empty/OFF and needs no new secret.

OFF does not bind a new durable contract, initialize a sealed-artifact service,
or write Storage/registry data. Existing workflows and artifacts therefore keep
their previous behavior. ON binds only artifacts created at an integrated,
environment-bound producer. The binding is the generic, versioned
`durable_sealed_artifact_contract`; it contains no retailer, product, workflow,
Wave or run-specific exception policy.

An artifact without that field is legacy and remains on its existing path even
while rollout is ON. An artifact that already contains the field is always
guarded, including after the rollout control returns to OFF, so a new-contract
artifact cannot silently downgrade. Turning rollout OFF stops creation of new
bindings; it does not delete sealed data or bypass a binding already written.

The initial shared choke points are:

- the common import-plan writer plus its approval and pilot-apply RPC boundary,
  where an exact target-bound `APPROVED_PLAN` file is sealed and freshly
  verified before either dependent RPC;
- the shared multi-retailer Review Queue reconciliation producer and the eBay
  producer, followed by their single common reconciliation apply boundary,
  where exact `REVIEW_REGISTRATION` file bytes are sealed and freshly verified
  before the queue publication RPC.

The producer writes the contract into the exact JSON file. The consumer reads
the original bytes and never reconstructs or reserializes a bound artifact for
sealing. The Phase A verified durable identity must agree with the contract's
environment and artifact kind before the existing mutation callback is called.
Missing registry/object data, tampering, metadata or SHA drift, wrong kind,
wrong environment, failed seal, or failed fresh verify prevents the mutation.
The guard does not add retries or replay; existing package atomicity, row
isolation, recovery, approval and fingerprint behavior remains authoritative.

`PREPARED_SCOPE`, `AUTOMATION_DIAGNOSTIC` and `HISTORICAL_DOC` remain
durable-recommended and are not made mandatory. `TEMPORARY_DEBUG` remains
unsealable. Phase B does not backfill historical artifacts and does not activate
Phase C.

## Phase B production activation boundary

Production enforcement is intentionally OFF after the Phase B merge. A later
bounded owner authorization is required before setting the one repository
configuration variable from absent/`OFF` to `ON`. That activation can create
new private `sealed-artifacts` objects and immutable `public.sealed_artifacts`
rows only for newly contract-bound artifacts at the choke points above. It does
not authorize business-data migration, historical backfill or any additional
artifact class.

The 31 October read-only activation preflight found a separate protected-reader
parity blocker before any activation: Fit House had `111` current OOS offers,
fully explained by baseline `104`, five applied owner-six offers and four exact
executed Review Queue stock transitions with signed net delta `+2`. The service
role-compatible state passed at `111`; the protected PostgreSQL validator path
omitted that evidence and failed closed at `109`. A generic retailer-scoped,
SELECT-only reader and shared runtime normalization are prepared, but the
migration remains excluded from automatic selectors and unapplied pending a
separate exact production authorization. Enforcement remains OFF/absent. The
bounded proof is recorded in
[`PHASE-B-VALIDATOR-DURABLE-REVIEW-EVIDENCE-PARITY-PREPARATION-2026-10-31.json`](retailer-automation/evidence/PHASE-B-VALIDATOR-DURABLE-REVIEW-EVIDENCE-PARITY-PREPARATION-2026-10-31.json).

The first owner-authorized apply of the reader migration's original SHA
`d6bcf488201737a2206c102297de6ef157c69f51886c8508ae474a23846d9c47`
failed closed before commit because its preflight incorrectly required the live
production validator to be `NOBYPASSRLS`. Production migration
`20260820130000_allow_production_validator_bounded_rls_reads` intentionally
made that role `BYPASSRLS` for its bounded catalogue reads. Fresh read-only
forensics proved the role still needs that capability while it has no raw
Review Queue table privilege. The unapplied reader migration now verifies the
exact live role shape without changing it; its corrected bytes remain excluded
and unapplied. Ledger remains `257` and enforcement remains OFF/absent. See
[`PHASE-B-READER-LIVE-VALIDATOR-ROLE-CONTRACT-RECONCILIATION-2026-10-31.json`](retailer-automation/evidence/PHASE-B-READER-LIVE-VALIDATOR-ROLE-CONTRACT-RECONCILIATION-2026-10-31.json).

The first live verification must use one newly generated Review Queue
registration artifact, confirm its exact object and registry identity by fresh
readback, then observe the already-existing queue RPC. If sealing or readback
fails, the operator sees the Phase A error and the RPC is not called. Rollback is
the single variable returning to `OFF`; existing durable objects and registry
rows are immutable and remain available for recovery and audit.
