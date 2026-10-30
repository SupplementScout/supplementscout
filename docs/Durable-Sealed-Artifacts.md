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
