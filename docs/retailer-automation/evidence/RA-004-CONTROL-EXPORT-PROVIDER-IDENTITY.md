# RA-004 control-export provider identity correction

Status: `READY_FOR_INDEPENDENT_VERIFICATION`

RA-004 remains `IN_PROGRESS`. This evidence authorizes no staging or production
operation, migration, retry, preflight, canary, shadow run, import or apply.

## Reproduced failure

The live exporter compares the canonical `provider_identity` returned by
`public.read_retailer_control_state_v1` with the descriptor authorized for its
database session. The applied RPC returned provider ID
`transactional-rpc-v1` and omitted `session_user`; the coordinator authorized
provider ID `ra004-staging-control-canary-v1` and required the verified temporary
login. The objects were individually safe, but they could not describe the same
authenticated provider. The exporter therefore correctly failed closed with
`CONTROL_EXPORT_RPC_CONTRACT_INVALID` before accepting the canary result.

## Systemic correction

- Forward-only migration:
  `20260928101000_align_ra004_control_export_provider_identity.sql`.
- SHA-256:
  `4454cebd1e462a20d4a612d253025c013b5c8276a4d51aa4e43016a7f248fc91`.
- The migration replaces only the exact known provider-identity expression in
  the exact eight-argument read RPC. It rejects an unexpected owner, function
  mode, security mode, search path, source definition, existing replacement or
  replay.
- The RPC response now retains provider ID `transactional-rpc-v1` and binds
  `session_user` to the actual authenticated database login.
- The coordinator uses the same stable provider ID and continues to require its
  temporary control credential as `expected_session_user`.
- Ownership remains `postgres`; `SECURITY DEFINER`, `STABLE` and
  `search_path=pg_catalog` remain mandatory. `PUBLIC`, platform roles and all
  production runtime roles receive no `EXECUTE`.
- The migration creates no role, membership, grant or business-data write.
- Both STAGING and PRODUCTION selectors exclude the migration by exact SHA.

## Verification

- Regression/static/selector tests: 3/3 PASS.
- RA-002/RA-003/RA-004 local tests: 272/272 PASS.
- Isolated PostgreSQL 17 suites: 8/8 PASS. They reproduce the applied RPC
  mismatch, apply only the local correction, record local ledger 99, pass Q1–Q8,
  execute the real read-only exporter, reject a wrong `session_user`, reject
  source drift and replay, and preserve business-table counts.
- `npm run verify:project`: PASS.
- `npm run verify:quick`: PASS.
- `npm run verify:full`: PASS, including TypeScript, ESLint, baseline migration
  validation and production build.
- The known Jon's, nutrition and shared-parent baseline integration failures are
  outside this change; they are neither modified nor represented as PASS.
- No secret, credential, remote database connection or production operation was
  used.

The only next step is independent review of the Draft PR. A separate owner
authorization would still be required before any staging activation.
