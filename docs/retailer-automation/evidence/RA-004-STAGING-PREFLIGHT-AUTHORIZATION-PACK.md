# RA-004 staging preflight authorization pack

**Prepared:** 25 September 2026

**Baseline:** `76e2609a9891c3050289b1edb136877d79c0084e`

**RA-004:** `IN_PROGRESS`

**Pack preparation:** `AUTHORIZED`

**Pack verification:** `NOT_STARTED`

**Owner decision:** `NOT_DECIDED`

**Control-plane read, database read and staging connection:** `NOT_AUTHORIZED`

**Credential issuance/use and preflight execution:** `NOT_AUTHORIZED`

**Staging migration and staging canary:** `NOT_AUTHORIZED`

**Production, live export and shadow:** `NOT_AUTHORIZED`

**Auto-safe classes:** `NONE_APPROVED`

**Owner-decision fingerprint:** `030c9d7cb12b46ab0b2bca2311ffbe1456e1c579e9e3acd570a4c0766ead119c`

**Staging-canary plan fingerprint:** `bd5c259941997daad3755c1cb135f76f6eccaef1fb9e1ce0044939ce08439214`

**Authorization-pack fingerprint:** `732cccf46eb4467460029b411f5138f81f4af69a9ad88235e6ed20d9051f7149`

Machine-readable contract:
[`RA-004-staging-preflight-authorization.json`](RA-004-staging-preflight-authorization.json).

This pack prepares five decisions for Marek. It is not an authorization, an
executable runbook or evidence that staging is ready. No owner decision is
recorded as approved. If Marek gives no answer, every connection, read,
credential and execution status remains `NOT_AUTHORIZED`.

This task made no staging or production connection, control-plane read,
database read, SQL call, Supabase CLI call, secret read, credential, migration,
selector change, feed capture, live export, workflow dispatch, shadow run,
control plan, approval, import or apply.

## Existing-capability audit

The audit treats tracked configuration as repository evidence, not remote
attestation. A name containing `read`, `validator` or `staging` is not itself a
safety boundary.

| ID | Repository finding | Safety conclusion |
|---|---|---|
| A1 | `scripts/supabase-migration-selector.js` contains separate STAGING and PRODUCTION project references, database identities and environment-key names. The staging value is repository-declared but not currently attested. | It may become an allowlist input only after an owner-approved identity check. |
| A2 | The selector binds environment, project reference, database identity, owner and ordered ledger fingerprint independently. | Future preflight must bind all of them and prohibit fallback. |
| A3 | Migrations declare staging validator, approver and executor roles. | Their tracked names do not prove current deployment or suitability. |
| A4 | No deployed-contract role is limited to project/retailer/ledger/schema metadata. | `BLOCKED_INTERFACE_GAP`. |
| A5 | The staging validator can reach validation and control-plan registration interfaces. `production-role-session.js` exposes general `client.query()`. Approver, executor and service-role paths can mutate state. | None is an acceptable preflight credential. |
| A6 | The prepared control-state RPC validates a supplied retailer but does not attest control-plane identity or provide metadata-only retailer resolution. | `BLOCKED_INTERFACE_GAP`. |
| A7 | Current selector/verifier code reads `supabase_migrations.schema_migrations` with an owner URL and general PostgreSQL client. | `BLOCKED_INTERFACE_GAP`; no general-SQL fallback. |
| A8 | Local tests inspect schemas, functions, roles, ACL and RLS, but no bounded deployed staging RPC exposes the required projection. | `BLOCKED_INTERFACE_GAP`. |
| A9 | Selected-migration tools use owner credentials/direct SQL. The control-state provider is intentionally unwired and calls a different RPC. | `BLOCKED_INTERFACE_GAP`; no existing preflight provider or CLI. |
| A10 | Migration apply, refresh, service-role, approver and executor modules contain mutation paths. | Exclude these modules, roles and credentials from the dependency closure. |
| A11 | The smallest missing database capability is one static metadata RPC plus one dedicated caller role/login. | Implementation and deployment need separate review and authorization. |
| A12 | Shared tooling supports both environments and obtains URLs externally. | Production misdirection is material; exact host/project allowlists and database-target attestation are mandatory. |
| A13 | One bounded name-or-slug lookup can safely return only retailer ID, name, slug and match count. | Never guess or copy a production/historical retailer ID. |
| A14 | Retention policy R is approved, but the repository identifies no current private evidence store with encryption, immutability, audit and readback proof. | `BLOCKED_INTERFACE_GAP`. |

The repository contains the exact migration
`supabase/migrations/20260924100000_add_transactional_retailer_control_state_interface.sql`
with SHA-256
`cfd7a93cb20845832b696183f5eb8a500f0474b4173829b85f6ac6bc73d4baaa`.
It remains excluded from both STAGING and PRODUCTION selectors. This pack does
not change or authorize either selector or apply the migration.

## Smallest future preflight

The proposed preflight has two independently authorized read boundaries:

1. At most one allowlisted control-plane identity check, returning only Q1.
2. At most one staging database connection, one `REPEATABLE READ READ ONLY`
   transaction and one invocation of a future static metadata RPC returning
   Q2-Q7.

Before either boundary, Q8 must attest the approved private evidence store.
The complete window is at most 30 minutes. Statement timeout is at most 15
seconds and idle-in-transaction timeout at most 30 seconds. Automatic and
manual retry are prohibited. A second connection is prohibited.

The result may establish only:

- the exact staging project and absence of production ambiguity;
- one unique staging retailer identity for 10 Reps;
- the exact RA-004 migration's ledger state;
- prerequisite and target object presence;
- function signatures/ownership and role, ACL and RLS properties;
- `NOT_APPLIED`, `FULLY_APPLIED` or `UNEXPECTED_STATE` for the migration;
- whether the reviewed migration has a conflict-free prerequisite state;
- the approved evidence store and a safe credential lifecycle path.

It may not read offers, prices, stock, customers, orders, feeds, complete
catalogues, secrets, tokens, credential values or unrelated retailers. It has
no DDL, DML, mutation RPC, migration, workflow, live-export, feed, shadow,
control-plan, approval, import or apply capability.

Required local counters are
`control_plane_identity_attempts`, `database_connection_attempts`,
`transaction_attempts`, `metadata_rpc_attempts` and
`prohibited_operation_attempts`. The only allowed terminal results are
`PASS_METADATA_ONLY`, `BLOCKED_INTERFACE_GAP`, `STOPPED_PRE_READ` and
`FAILED_CLOSED`.

## Query allowlist

Every entry is closed. Unknown fields, rows above the cap or a different source
fail the preflight; they do not produce partial success.

### Q1 — staging project identity

- Purpose: attest the exact staging project and exclude production.
- Exact source: future owner-approved control-plane identity endpoint or signed administrative identity record.
- Allowed fields: `project_reference`, `canonical_host`, `environment_label`, `project_identity_fingerprint`, `observed_at`.
- Maximum rows: 1.
- Expected result: one identity matching both owner-approved allowlists and differing from production.
- Redaction: no token, credential, organization payload or unrelated project.
- Stop: missing, duplicate, ambiguous, production-matching or non-allowlisted identity.
- Separate interface: required; `BLOCKED_INTERFACE_GAP`.

### Q2 — unique 10 Reps retailer

- Purpose: resolve one unique staging retailer ID.
- Exact source: future `read_ra004_staging_preflight_v1` static projection of `public.retailers`.
- Allowed fields: `id`, `name`, `slug`, `match_count`.
- Maximum rows: 2, solely to detect ambiguity.
- Expected result: exactly one row matching the approved 10 Reps name or slug.
- Redaction: exclude configuration, credentials, URLs and unrelated retailers.
- Stop: zero, multiple or mismatched rows.
- Separate interface: required; `BLOCKED_INTERFACE_GAP`.

### Q3 — exact migration ledger state

- Purpose: classify the RA-004 migration ledger state.
- Exact source: future RPC aggregate over `supabase_migrations.schema_migrations`.
- Allowed fields: `target_version`, `target_name`, `target_match_count`, `ordered_ledger_count`, `ordered_ledger_fingerprint`.
- Maximum rows: 1.
- Expected result: target absent with attested ledger, or one exact target entry.
- Redaction: no migration body, URL or unrelated ledger rows.
- Stop: unknown fingerprint, duplicate target, unexpected name or partial-state conflict.
- Separate interface: required; `BLOCKED_INTERFACE_GAP`.

### Q4 — prerequisite and target objects

- Purpose: verify schema prerequisites without reading business rows.
- Exact source: future closed `pg_catalog` and `to_regclass`/`to_regprocedure` projection.
- Allowed fields: `object_schema`, `object_name`, `object_kind`, `exists`, `expected_state`.
- Maximum rows: 32.
- Expected result: every prerequisite matches and target objects are wholly absent or wholly present.
- Redaction: only predeclared RA-004 prerequisite and target names.
- Stop: missing prerequisite, partial target state, unknown object or extra row.
- Separate interface: required; `BLOCKED_INTERFACE_GAP`.

### Q5 — function signatures and ownership

- Purpose: verify signatures, ownership and safe properties.
- Exact source: future closed `pg_proc`, `pg_namespace` and `pg_roles` projection.
- Allowed fields: `schema`, `signature`, `owner`, `security_definer`, `volatility`, `search_path`, `definition_sha256`.
- Maximum rows: 8.
- Expected result: only approved signatures with expected owners and properties.
- Redaction: return a definition digest, never unrestricted bodies.
- Stop: signature, owner, security mode, search path or digest mismatch.
- Separate interface: required; `BLOCKED_INTERFACE_GAP`.

### Q6 — role attributes and memberships

- Purpose: prove the closed role set and absence of escalation.
- Exact source: future closed `pg_roles` and `pg_auth_members` projection.
- Allowed fields: `role_name`, `rolsuper`, `rolinherit`, `rolcreaterole`, `rolcreatedb`, `rolcanlogin`, `rolreplication`, `rolbypassrls`, `membership_role`, `set_option`, `admin_option`.
- Maximum rows: 24.
- Expected result: no broad attributes or `SET ROLE` path.
- Redaction: no password hashes, connection strings, unrelated settings or roles.
- Stop: unknown role, broad attribute, login mismatch or forbidden membership edge.
- Separate interface: required; `BLOCKED_INTERFACE_GAP`.

### Q7 — ownership, ACL and RLS

- Purpose: verify only the RA-004 security boundary.
- Exact source: future closed `pg_class`, `pg_namespace`, `pg_policy` and ACL projection.
- Allowed fields: `object_schema`, `object_name`, `owner`, `rls_enabled`, `rls_forced`, `policy_name`, `policy_command`, `policy_roles`, `grantee`, `privilege_type`.
- Maximum rows: 64.
- Expected result: exact grants/policies with no PUBLIC, service-role, validator, approver or executor access to the preflight RPC.
- Redaction: only predeclared RA-004 objects, roles and normalized privileges.
- Stop: broad grant, missing forced RLS, unexpected owner/policy or cap breach.
- Separate interface: required; `BLOCKED_INTERFACE_GAP`.

### Q8 — private evidence store

- Purpose: attest the evidence destination before any database connection.
- Exact source: future owner-approved signed evidence-store configuration record.
- Allowed fields: `store_identifier`, `private`, `encryption`, `write_once`, `access_audit`, `readback_supported`, `raw_retention_days`, `derived_retention_days`, `approved_by`, `approved_at`.
- Maximum rows: 1.
- Expected result: one private store matching retention policy R and supporting redacted write-once evidence/readback.
- Redaction: no endpoint credential, token, object contents or unrelated stores.
- Stop: missing approval, public access, missing controls or retention mismatch.
- Separate interface: required; `BLOCKED_INTERFACE_GAP`.

## Dedicated preflight credential design

The future credential is separate from every canary, validator, approver,
executor, service-role and exporter credential. It is one staging-only login
issued only after a new owner decision. Its TTL is at most 30 minutes.

It is `NOSUPERUSER`, `NOBYPASSRLS`, `NOCREATEROLE`, `NOCREATEDB` and
`NOREPLICATION`. It has no DDL, DML, table, sequence, business-data or mutation
RPC privileges. Its only database capability is `EXECUTE` on the separately
reviewed `public.read_ra004_staging_preflight_v1()` interface. It cannot
`SET ROLE` to staging validator, approver, executor, control-state exporter or
service role.

The login defaults to read-only, has statement timeout at most 15 seconds and
idle transaction timeout at most 30 seconds, cannot retry or be reused, and is
revoked immediately after success or failure. Revocation removes `LOGIN`, RPC
`EXECUTE` and role membership. Receipts record issuer, operator, issuance,
first use, expiry, revocation and negative post-revocation verification without
recording the credential value. The value may never enter Git, a PR, logs,
public artifacts or evidence payloads.

## Five decisions for Marek

All five recommendations are `APPROVE_WITH_GATES`; all decision statuses are
`NOT_DECIDED`.

### D1 — one control-plane identity check

- Scope: one allowlisted lookup for one staging project returning only Q1.
- Does not authorize: database connection, secret read, production, migration, canary, live export or shadow.
- Validity: one named attempt in one owner-approved window of at most 30 minutes.
- Automatic expiry: first attempt, window end, identity mismatch, baseline change or pack-fingerprint change.
- No answer: control-plane read and every later step remain `NOT_AUTHORIZED`.

### D2 — one bounded database transaction

- Scope: one staging connection, one `REPEATABLE READ READ ONLY` transaction and one future metadata RPC invocation covering Q2-Q7.
- Does not authorize: general SQL, second connection, retry, DDL, DML, mutation RPC, migration or business-data read.
- Validity: one named attempt in the same window after D1 and every pre-read gate passes.
- Automatic expiry: first connection attempt, transaction end, window end, interface/allowlist drift or any prohibited attempt.
- No answer: database read and preflight execution remain `NOT_AUTHORIZED`.

### D3 — one dedicated staging-preflight credential

- Scope: future issuance/use of one staging-only login, TTL at most 30 minutes, EXECUTE only on the metadata RPC.
- Does not authorize: canary credential, existing operational credential, production, tables, `SET ROLE` or reuse.
- Validity: issuance until first use, expiry or immediate revocation, whichever comes first.
- Automatic expiry: TTL, completion/failure, privilege mismatch, exposure or window end.
- No answer: no login, role membership, password, token or secret may be created or used.

### D4 — people and window

- Scope: one named operator, one distinct named issuer and one explicit UTC window no longer than 30 minutes.
- Does not authorize: self-issuance, substitutes, extension, scheduling or workflow dispatch.
- Validity: only the named people and exact window.
- Automatic expiry: window end, substitution, role conflict or repository/authorization change.
- No answer: issuance and preflight cannot begin.

### D5 — evidence and retention

- Scope: one redacted bundle of identities, summaries, counters, fingerprints and lifecycle receipts in one approved private store under retention policy R.
- Does not authorize: secrets, raw business data, public artifacts, unrelated metadata or live export.
- Validity: this one bundle and the approved retention periods.
- Automatic expiry: approval withdrawal, configuration/retention drift, redaction failure or missing readback.
- No answer: preflight remains blocked before connection.

## Stop conditions

Every condition is non-overridable and prevents default or partial success.

| # | Code | Phase | Required evidence / effect |
|---|---|---|---|
| 1 | `STAGING_PROJECT_UNRECOGNIZED` | before connection | Owner-attested Q1 identity; otherwise `STOP_NO_OVERRIDE_NO_RETRY_NO_SUCCESS`. |
| 2 | `STAGING_PRODUCTION_AMBIGUITY` | before connection | Distinct project/host proof; otherwise same fail-closed effect. |
| 3 | `OWNER_AUTHORIZATION_MISSING` | before connection | Five decisions bound to this fingerprint. |
| 4 | `OWNER_AUTHORIZATION_EXPIRED_OR_MISMATCHED` | before connection | Current exact scope, people, window and identity receipt. |
| 5 | `OPERATOR_MISSING` | before connection | Named operator receipt. |
| 6 | `CREDENTIAL_ISSUER_MISSING` | before connection | Named distinct issuer. |
| 7 | `CREDENTIAL_PRIVILEGES_TOO_BROAD` | before connection | Closed effective-privilege proof; stop and revoke. |
| 8 | `CREDENTIAL_TTL_OVER_30_MINUTES` | before connection | Issued/expires calculation; stop and revoke. |
| 9 | `CREDENTIAL_SET_ROLE_CAPABILITY` | before connection | Negative SET ROLE proof; stop and revoke. |
| 10 | `HOST_OR_PROJECT_ALLOWLIST_MISSING` | before connection | Exact owner-approved host/project allowlists. |
| 11 | `QUERY_ALLOWLIST_MISSING` | before connection | Reviewed Q1-Q8 contract. |
| 12 | `GENERAL_SQL_REQUIRED` | before connection | Closed interface proof; otherwise `STOP_BLOCKED_INTERFACE_GAP_NO_SUCCESS`. |
| 13 | `DDL_DML_OR_MUTATION_RPC_CAPABLE` | before connection | Negative privilege/dependency proof; stop and revoke. |
| 14 | `PRIVATE_EVIDENCE_STORE_MISSING` | before connection | Approved Q8 receipt. |
| 15 | `REDACTION_UNAVAILABLE` | before connection | Closed-field redaction validation. |
| 16 | `ATTEMPT_COUNTERS_MISSING` | before connection | All counters initialized to zero. |
| 17 | `IMMEDIATE_REVOKE_UNAVAILABLE` | before connection | Operational revoke procedure and named issuer. |
| 18 | `BASELINE_OR_MIGRATION_SHA_MISMATCH` | before connection | Fresh refs and independent SHA-256. |
| 19 | `REPOSITORY_OR_PLAN_CHANGED_AFTER_AUTHORIZATION` | before connection | Current baseline/fingerprint match; otherwise reauthorize. |
| 20 | `PRODUCTION_ACCESS_ATTEMPT` | before first read | Destination audit and counter; stop, revoke and treat as incident. |
| 21 | `SECOND_CONNECTION_ATTEMPT` | before first read | Connection counter at most one; stop/revoke with no retry. |
| 22 | `RETRY_ATTEMPT` | before first read | No-retry configuration and counter; stop/revoke. |
| 23 | `OUT_OF_ALLOWLIST_BUSINESS_READ_ATTEMPT` | before first read | Closed RPC projection/counter; stop, revoke and treat as incident. |
| 24 | `MIGRATION_APPLICATION_ATTEMPT` | before first read | Migration/apply counter zero; stop, revoke and treat as incident. |
| 25 | `LIVE_EXPORT_FEED_OR_SHADOW_ATTEMPT` | before first read | All three counters zero; stop, revoke and treat as incident. |

## Unresolved information — do not infer

| Unknown | Answer owner | Safe resolution | Required before | Consequence | Separate authorization |
|---|---|---|---|---|---|
| `staging_project_reference` | staging environment owner | signed Q1 attestation against the repository candidate | sealing D1/allowlist | stop; identity untrusted | yes |
| `staging_host` | staging environment owner | signed canonical-host attestation without secret access | any connection authority | stop; production ambiguity | yes |
| `staging_10reps_retailer_id` | staging data owner | bounded Q2 lookup | PASS result | stop; retailer ambiguous | yes |
| `operator` | RA-004 owner | named-person/separation review | issuance | stop; no accountable operator | yes |
| `credential_issuer` | staging security/database owner | distinct named-person assignment | issuance | stop; lifecycle uncontrolled | yes |
| `execution_window` | RA-004 and staging owners | exact UTC start/end, at most 30 minutes | authorization validity | stop; no valid window | yes |
| `private_evidence_store` | evidence custodian/data owner | Q8 config review without upload | any connection | stop; no compliant destination | yes |
| `available_metadata_only_role` | future implementation owner/verifier | reviewed migration and isolated privilege tests | credential implementation | `BLOCKED_INTERFACE_GAP` | yes |
| `exact_control_plane_identity_read_path` | staging platform owner | one allowlisted endpoint or signed record | D1 use | `BLOCKED_INTERFACE_GAP` | yes |
| `exact_database_metadata_read_path` | implementation/database owners | reviewed RPC/role and staging deployment | D2/D3 use | `BLOCKED_INTERFACE_GAP`; no SQL fallback | yes |

## Current interface gaps and next task

There is no identified deployed control-plane identity interface, metadata-only
database RPC, suitable role, closed preflight provider/CLI or approved evidence
store. These gaps do not block preparation of this decision pack; they do block
every read and execution attempt. This pack does not authorize their
implementation.

The next and only task is independent verification of the Draft PR. Do not
connect to staging, implement an interface, issue a credential or execute the
preflight during that verification.
