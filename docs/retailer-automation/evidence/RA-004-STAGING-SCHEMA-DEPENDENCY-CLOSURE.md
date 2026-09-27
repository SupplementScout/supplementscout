# RA-004 staging schema dependency closure

Status: `VERIFIED_COMPLETE`

Baseline: `dbb25b8679fea1b13a8f7238820e739198b21f49`

This evidence closes the consumed activation
`ra004-staging-1790509412479` and prepares, without activating, the complete
staging dependency closure required by the two forward interface migrations.
No migration, preflight or canary was run against staging by this change.

## Read-only staging inventory

The one authorized inventory ran in one `READ ONLY`, `REPEATABLE READ`
transaction and committed no writes. It confirmed:

- ledger count `95`;
- ledger head `20260926100000_create_ra004_staging_10reps_retailer`;
- ledger fingerprint
  `c5bb6405d26def1834522cccaf2937fad60f44156370e5e1f8c4af3ff96d45bd`;
- inventory fingerprint
  `26b7dfa4e4ed4dedc92215fef26b46d52afa60eb9e6b7ca9635a6ac3cf597fd6`;
- 402 redacted catalogue observations: 8 relations, 143 columns, 105
  constraints, 24 indexes, 1 sequence, 1 policy, 88 relation grants, 5
  function records, 4 function grants, 12 role records, 6 membership records,
  4 schema grants and 1 extension record.

No secret, database URL, token, password, key, user row or business row is in
the evidence.

## Complete logical dependency inventory

The closed contract contains 30 named logical dependencies. Subordinate
columns, constraints, indexes, ownership, ACL, RLS, policies and memberships
are evaluated with their owning object rather than counted again here.

### `PRESENT_MATCHING` (14)

Relations:

- `public.approved_import_plans`
- `public.retailer_catalogue_apply_runs`
- `public.retailer_catalogue_child_plans`
- `public.retailer_catalogue_parent_plans`
- `public.retailer_offer_sync_batch_approvals`
- `public.retailer_offer_sync_reviewed_mixed_change_bindings`
- `public.retailers`
- `supabase_migrations.schema_migrations`

Functions and extension:

- `pg_catalog.gen_random_uuid()`
- `pg_catalog.sha256(bytea)`
- extension `pgcrypto`

Platform roles:

- `anon`
- `authenticated`
- `service_role`

The required columns used by the interface migrations are present. The full
captured schemas, ownership, RLS, constraints, indexes and relevant ACLs show
no drift from the repository contract.

### `MISSING_REQUIRED` (6)

These are the complete compatibility gap. Their canonical definition is in
`20260719100000_add_production_retailer_sync_enablement.sql`:

- `public.retailer_catalogue_production_fixture_approvals`
- `public.retailer_catalogue_production_recovery_manifests`
- `public.retailer_catalogue_production_recovery_approvals`
- `retailer_catalogue_production_approver`
- `retailer_catalogue_production_executor`
- `retailer_catalogue_production_validator`

### `NOT_APPLICABLE` before interface installation (10)

These are outputs of the two forward interface migrations, not missing input
dependencies:

- `public.retailer_control_state_evidence_v1`
- `public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)`
- `public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)`
- `public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)`
- `retailer_control_state_evidence_owner`
- `retailer_control_state_evidence_writer`
- `retailer_control_state_exporter`
- `retailer_control_state_read_owner`
- `ra004_staging_preflight_caller`
- `ra004_staging_preflight_owner`

`PRESENT_DRIFTED`: 0. `MISSING_OPTIONAL`: 0. Required views: 0. Required
custom types: 0. Required new sequences: 0. Required new extensions: 0.

The preflight output remains one logical dependency after correction. The
immutable `20260927101000` definition is superseded by the complete
`20260927102000_correct_ra004_staging_preflight_ledger_contract.sql`; the
dependency count and classifications therefore remain unchanged.

## Compatibility migration

`20260926110000_add_ra004_staging_interface_compatibility.sql` is ordered after
the current staging head and before both reissued interface migrations. It
contains exactly:

- three `NOLOGIN NOINHERIT` production-named contract roles, with no
  memberships or elevated attributes;
- three missing source tables with 74 canonical columns and 48 canonical
  constraints, including the three exact foreign keys;
- all canonical primary/unique indexes plus the two named partial active-row
  indexes;
- owner `postgres`, enabled and forced RLS, no policies and no non-owner table
  grants;
- no rows, approvals, target attestations, executor functions or production
  wiring.

It checks existing role attributes, memberships, relation kind, owner, RLS,
policies, ACL, all column names/types/nullability, constraint counts and foreign
keys, defaults and the named partial indexes. Any mismatch aborts the whole
transaction. SHA-256:
`6deb90f6557b2ee72c8b5fca02aed7ce1e9ac9edd75a246689a56560166ea99c`.

## Isolated sequence proof

A networkless PostgreSQL 17 test reproduces the 95-row staging ledger, retailer
`11` / `10 Reps` / `10-reps`, no interface RPCs and all six compatibility
gaps. It applies locally, in this order:

1. `20260926110000_add_ra004_staging_interface_compatibility.sql`
2. `20260927100000_reissue_transactional_retailer_control_state_interface.sql`
3. `20260927102000_correct_ra004_staging_preflight_ledger_contract.sql`

The corrected proof reaches exactly 98 ledger entries ending at `20260927102000`, creates
both read RPCs, preserves all product/variant/mapping/offer/price-history row
counts, creates no compatibility rows, and verifies minimal ownership, ACL,
RLS, policies and memberships. Duplicate ledger insertion is rejected. Injected
column, constraint, role, grant, policy and function drift each fail closed.

## Closed selectors and activation

STAGING and PRODUCTION ordinary selectors SHA-bind and exclude the compatibility
migration and both interface migrations. `--include-all` remains forbidden.
The failed activation records one consumed attempt, zero applied migrations,
the unchanged 95-row ledger, completed cleanup and `replayable: false`.

RA-004 remains `IN_PROGRESS`. Production, preflight, canary, feed capture,
shadow, control plan, approval, import and apply remain unauthorized.
