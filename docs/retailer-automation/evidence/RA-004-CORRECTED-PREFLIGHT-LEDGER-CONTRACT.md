# RA-004 corrected preflight ledger contract

Status: `RA-004 CORRECTED PREFLIGHT LEDGER CONTRACT VERIFIED_COMPLETE`

RA-004 remains `IN_PROGRESS`. Staging retry, production, preflight and canary
remain `NOT_AUTHORIZED`.

## Correction

The immutable migration
`20260927101000_reissue_ra004_staging_preflight_metadata_interface.sql` has
SHA-256
`6d1e3512792884cf0696e36d4c54f78d9d85e3e68b32cdd475a885f6138dc2f4`.
It is superseded because Q3 expects the obsolete ledger name
`add_transactional_retailer_control_state_interface`. Its bytes are unchanged,
and both STAGING and PRODUCTION selectors exclude it.

The complete replacement is
`20260927102000_correct_ra004_staging_preflight_ledger_contract.sql`, SHA-256
`25f70527d18113a2282ebcdb1626b8052f7774f3f7f6ee1dbe69e1cd17864b93`.
Every Q3 ledger check uses exactly
`reissue_transactional_retailer_control_state_interface`.

The corrected migration installs the complete interface when absent. In a full
local history it replaces only a repository-known predecessor function after
validating roles, configuration, ownership, ACL and policy boundaries. Any
unknown function or surrounding drift aborts the transaction.

## Local proof

A networkless PostgreSQL 17 simulation starts from the 95-entry staging ledger
and applies only:

1. `20260926110000_add_ra004_staging_interface_compatibility.sql`
2. `20260927100000_reissue_transactional_retailer_control_state_interface.sql`
3. `20260927102000_correct_ra004_staging_preflight_ledger_contract.sql`

The result is 98 ledger entries ending at `20260927102000`, both required RPCs,
and a full local metadata preflight Q1-Q8 PASS. A separate full-history proof
applies the immutable defective migration first and confirms the corrected
migration produces the approved final RPC definition. Mutation of the Q3 name
back to the obsolete value is rejected by the contract test.

No remote connection, activation ID, credential, evidence-store session,
staging migration, remote preflight or canary was used.

## Closed execution boundary

The corrected migration is SHA-bound but excluded from both STAGING and
PRODUCTION. The activation manifest is null and `--include-all` remains
forbidden. This evidence does not authorize a staging attempt.
