# Shared Review Queue authorized publication retry path — 5 November 2026

## Outcome

SupplementScout now has one shared, bounded retry path for an exact previously generated Automation Review Queue reconciliation artifact. The path is repository code only in this change. It was not dispatched, no Review Queue publication was attempted, and production writes are `0`.

The implementation reuses:

- `scripts/automation-review-reconciliation-apply.js`;
- `scripts/lib/automation-review-publisher.js`;
- `public.publish_automation_review_queue_changes(jsonb)`;
- the shared durable sealed-artifact guard;
- the existing Supabase `service_role` publication credential and protected production environment.

No second publisher, RPC, retailer-specific implementation, database migration, owner-decision path or execution path was added.

## Root cause and retained guard

The first owner-authorized retry attempt used a direct PostgreSQL owner connection. The existing production RPC correctly rejected it with:

```text
AUTOMATION_REVIEW_PUBLICATION_SERVICE_ROLE_REQUIRED
```

The RPC intentionally requires `auth.role() = 'service_role'`. Being PostgreSQL owner does not establish the caller identity expected by the Review Queue publication contract. The failed attempt created no publication seal, Review Queue row, review event, execution request or catalogue write.

The retry implementation does not bypass, weaken or replace this guard. It calls the existing apply script with the existing Supabase client created from `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. A successful read of the protected publication-seal table is the pre-mutation service-role compatibility proof; the RPC retains the final authoritative role check.

## Architecture

The dedicated workflow is:

```text
.github/workflows/automation-review-publication-retry.yml
```

It is:

- `workflow_dispatch` only;
- restricted to `refs/heads/main` and the exact repository/workflow identity;
- serialized through `retailer-offer-production-write` with `cancel-in-progress: false`;
- protected by the existing `production-readonly` environment used by Review Queue publication;
- limited to `contents: read` and `actions: read` permissions;
- supplied only the existing Supabase URL and service-role secret;
- unable to capture or regenerate retailer source evidence;
- unable to approve/reject a review, create an execution request or run a worker.

Normal same-run publication remains unchanged. It still requires the reconciliation source run, `GITHUB_RUN_ID` and commit to be identical. The separate `authorized-artifact-retry` context permits an older reconciliation artifact only after all retry-specific bindings pass.

## Exact artifact and owner binding

The workflow requires explicit values for:

- reconciliation run ID, artifact ID and GitHub artifact SHA-256;
- source run ID, artifact ID and GitHub artifact SHA-256;
- publisher batch fingerprint;
- changeset fingerprint;
- idempotency key;
- canonical request hash, excluding only the idempotency key exactly as the production RPC does;
- expected retailer ID;
- expected production Supabase project reference;
- owner confirmation.

The deterministic confirmation is:

```text
OWNER_AUTHORIZED_REVIEW_QUEUE_PUBLICATION_RETRY:<reconciliation_run_id>:<reconciliation_artifact_id>:<reconciliation_artifact_digest>:<batch_fingerprint>:<changeset_fingerprint>:<idempotency_key>:<request_hash>
```

The workflow downloads only the explicit artifact ID from the explicit original run. The apply script independently reads GitHub metadata for both the reconciliation and source artifacts and requires the exact IDs, runs, digests, successful main-branch runs and unexpired artifacts. It then parses the downloaded reconciliation bytes and matches every authorization field against the exact embedded request. It does not rebuild or modify the request.

The failed eBay attempt remains evidence context only. Its run IDs, artifact IDs and fingerprints are not present in generic runtime code.

## Pre-retry fail-closed checks

Before the publication RPC can be reached, the shared apply script requires:

1. the exact GitHub Actions, workflow-dispatch, main, repository and workflow identities;
2. exact owner confirmation;
3. exact reconciliation and source artifact metadata and digests;
4. exact source/run/request/retailer/project bindings;
5. exact batch, changeset, idempotency and request hashes;
6. unexpired reconciliation, source-contract and row evidence;
7. reconciliation result `PASS`, dry-run writes `0` and expected catalogue writes `0`;
8. a successful service-role read of the protected publication-seal table;
9. publication seal count `0`, unless the one exact matching seal already proves the request was applied;
10. exact catalogue counts and catalogue hash;
11. exact active Review Queue count, expected review IDs, statuses, fingerprints and supersession state;
12. no already-active row for a requested `CREATE` problem identity;
13. the existing sealed-artifact dependent-mutation guard.

Any mismatch stops before the publication RPC.

## Idempotency and transport uncertainty

Each workflow invocation can call `public.publish_automation_review_queue_changes(jsonb)` at most once.

If an exact matching publication seal already exists, the workflow makes zero RPC mutation attempts and returns `ALREADY_APPLIED` evidence. A conflicting seal fails closed.

If the single RPC attempt has an uncertain transport result, the script reads the exact seal once. A matching seal is accepted as the authoritative completion record. If no seal exists, the original error is returned. The script never automatically issues a second RPC call.

After an ordinary successful response, the script also requires the exact matching seal before producing `PASS` evidence.

## Focused regression coverage

`scripts/automation-review-publication-retry.test.js` proves:

- normal same-run behavior is unchanged;
- GitHub Actions, workflow-dispatch, main, repository and exact workflow guards;
- reconciliation run, artifact ID and digest bindings;
- source, batch, changeset, idempotency, request-hash and owner-confirmation bindings;
- expiry rejection;
- an existing seal prevents the RPC;
- stale catalogue baseline prevents the RPC;
- service-role credentials are mandatory;
- the exact parsed request is passed unchanged to the existing RPC;
- at most one RPC mutation attempt occurs;
- expected catalogue writes remain `0`;
- no owner-decision, execution, worker or retailer-specific runtime path exists;
- the protected environment, shared concurrency group and existing apply script are reused.

The test inventory was resealed after adding this focused test.

## Change and production boundary

- Database migration: **NO**
- Production RPC change: **NO**
- Production DB writes during implementation: **0**
- Review Queue writes during implementation: **0**
- Publication retry executed: **NO**
- Owner approvals or rejections: **0**
- Execution requests: **0**
- Worker executions: **0**
- Catalogue writes: **0**
- SEO-20: unchanged

The exact stop point is repository merge and final-main verification. Dispatching this workflow requires a new explicit owner authorization for one exact artifact and is outside this implementation scope.
