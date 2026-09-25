# RA-004 staging preflight authorization pack

**Prepared:** 25 September 2026

**Baseline:** `76e2609a9891c3050289b1edb136877d79c0084e`

**RA-004:** `IN_PROGRESS`

**Pack preparation:** `AUTHORIZED`

**Pack verification:** `VERIFIED_COMPLETE`

**Owner decision:** `OWNER_APPROVED_FOR_FUTURE_PREPARATION`

**Local implementation preparation:** `AUTHORIZED`

**Control-plane read, database read and staging connection:** `NOT_AUTHORIZED`

**Credential issuance/use and preflight execution:** `NOT_AUTHORIZED`

**Staging migration and staging canary:** `NOT_AUTHORIZED`

**Production, live export and shadow:** `NOT_AUTHORIZED`

**Auto-safe classes:** `NONE_APPROVED`

**Owner-decision fingerprint:** `030c9d7cb12b46ab0b2bca2311ffbe1456e1c579e9e3acd570a4c0766ead119c`

**Staging-canary plan fingerprint:** `bd5c259941997daad3755c1cb135f76f6eccaef1fb9e1ce0044939ce08439214`

**Authorization-pack fingerprint:** `b0cb6c6de75eace4e7d4d8705305eb90e6a975203438f23de7b745974e4ffdb8`

Machine-readable contract:
[`RA-004-staging-preflight-authorization.json`](RA-004-staging-preflight-authorization.json).

This pack records Marek's approval of five requirements and future local
preparation decisions. It is not an executable runbook or evidence that staging
is ready. Every connection, read, credential and execution status remains
`NOT_AUTHORIZED`.

This task made no staging or production connection, control-plane read,
database read, SQL call, Supabase CLI call, secret read, credential, migration,
selector change, feed capture, live export, workflow dispatch, shadow run,
control plan, approval, import or apply.

## Owner decision record

- Owner: `Marek Kalinka`.
- Date: `2026-09-25`.
- Source: `EXPLICIT_OWNER_INSTRUCTION`.
- Status: `OWNER_APPROVED_FOR_FUTURE_PREPARATION` for D1-D5.
- Exact instruction: “Zatwierdzam wszystkie pięć rekomendowanych decyzji RA-004 staging preflight. Zatwierdzam wymagania i przygotowanie, ale nie autoryzuję jeszcze połączenia ze stagingiem ani wykonania preflightu.”

The approval covers the requirements for one future control-plane identity
check, one future metadata-only transaction, a future dedicated credential,
operator/issuer separation with a maximum 30-minute window, and evidence-store,
redaction and retention controls. It also authorizes future local preparation
of the missing interfaces, minimal role, provider, CLI and tests in one separate
PR, with no staging connection.

It does not authorize a staging connection; control-plane or database read;
preflight execution; credential creation, issuance or use; staging deployment
of an RPC, role, provider or CLI; migration application; staging or production
selector changes; staging canary; production; live export; feed capture; shadow
run; workflow dispatch; control plan; approval; import; apply; Model B execution;
or cutover.

This policy approval neither expires nor expands automatically. Any change to
the plan, manifest fingerprint, query allowlist, credential design or interface
implementation requires reevaluation. The operator, credential issuer, staging
project reference, staging host, staging 10 Reps retailer ID, execution window
and private evidence store remain unapproved and `UNRESOLVED`. Any later
connection, credential, read, deployment or execution requires separate,
explicit owner authorization.

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

### Non-automatic authorization lifecycle

These stages are separate; no approval, implementation result or completed
value automatically grants authority to a later stage. Authority is never
inherited and every transition requires its own recorded review or decision.

1. `POLICY_APPROVAL` — `OWNER_APPROVED_FOR_FUTURE_PREPARATION`.
2. `LOCAL_IMPLEMENTATION_PREPARATION` — `AUTHORIZED` for one later separate local-only PR.
3. `INDEPENDENT_IMPLEMENTATION_VERIFICATION` — `NOT_STARTED`.
4. `EXECUTION_VALUES_COMPLETED` — `BLOCKED_UNKNOWN_VALUES`.
5. `PREFLIGHT_ACTIVATION` — `NOT_AUTHORIZED`.
6. `PREFLIGHT_EXECUTION` — `NOT_AUTHORIZED`.

## Query allowlist

Every entry is closed. Unknown fields, rows above the cap or a different source
fail the preflight; they do not produce partial success.
For every Q1-Q8 entry, business data is forbidden and general-SQL fallback is
forbidden (`business_data_allowed: false`,
`general_sql_fallback_allowed: false`).

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

All five recommendations are
`APPROVE_REQUIREMENTS_AND_FUTURE_PREPARATION_ONLY`; every authorization level is
`POLICY_AND_FUTURE_PREPARATION_ONLY` and every decision status is
`OWNER_APPROVED_FOR_FUTURE_PREPARATION`. The recorded answer for each is
`APPROVE_REQUIREMENTS_AND_FUTURE_PREPARATION_ONLY`. This authorizes future local
preparation in one separate PR; it does not authorize staging deployment,
credential issuance, activation, a connection or execution.

### D1 — one control-plane identity check

- Scope: approve the Q1 policy and future preparation; no lookup is currently authorized.
- Blocking dependencies: exact owner-attested staging project/host; implemented and independently verified bounded Q1 path; named operator/window; separate activation authorization.
- Does not authorize: database connection, secret read, production, migration, canary, live export or shadow.
- Validity: one named attempt in one owner-approved window of at most 30 minutes.
- Future attempt expiry if separately authorized: first attempt, window end, identity mismatch, baseline change or pack-fingerprint change.
- Recorded answer: requirements and future preparation approved; control-plane read and every later step remain `NOT_AUTHORIZED`.

### D2 — one bounded database transaction

- Scope: approve the Q2-Q7 transaction policy and future preparation; no connection, transaction or RPC invocation is currently authorized.
- Blocking dependencies: D1 gates; implemented and independently verified bounded RPC, dedicated role, provider and CLI; all exact execution values; separate activation authorization.
- Does not authorize: general SQL, second connection, retry, DDL, DML, mutation RPC, migration or business-data read.
- Validity: one named attempt in the same window after D1 and every pre-read gate passes.
- Future attempt expiry if separately authorized: first connection attempt, transaction end, window end, interface/allowlist drift or any prohibited attempt.
- Recorded answer: requirements and future preparation approved; database read and preflight execution remain `NOT_AUTHORIZED`.

### D3 — one dedicated staging-preflight credential

- Scope: approve the credential policy and future implementation preparation; no login, membership, password, token or secret issuance/use is currently authorized.
- Blocking dependencies: implemented and independently verified bounded RPC, metadata-only role, provider and CLI; attested project/host; named operator/issuer/window; separate issuance and activation authorization.
- Does not authorize: canary credential, existing operational credential, production, tables, `SET ROLE` or reuse.
- Validity: issuance until first use, expiry or immediate revocation, whichever comes first.
- Future credential expiry if separately authorized: TTL, completion/failure, privilege mismatch, exposure or window end.
- Recorded answer: design and future preparation approved; no login, role membership, password, token or secret may be created or used.

### D4 — people and window

- Scope: approve separation-of-duties and window requirements for future preparation; no person or UTC window is supplied or authorized.
- Blocking dependencies: owner-supplied operator, distinct issuer and exact UTC window; separation review; separate activation authorization.
- Does not authorize: self-issuance, substitutes, extension, scheduling or workflow dispatch.
- Validity: only the named people and exact window.
- Future attempt expiry if separately authorized: window end, substitution, role conflict or repository/authorization change.
- Recorded answer: separation requirements approved; the unknown people/window remain unapproved and issuance/preflight cannot begin.

### D5 — evidence and retention

- Scope: approve evidence, redaction and retention requirements for future preparation; no evidence destination or upload is currently authorized.
- Blocking dependencies: identified private store; independently verified encryption, immutability, access audit and readback; Q8/retention match; redaction validation; separate activation authorization.
- Does not authorize: secrets, raw business data, public artifacts, unrelated metadata or live export.
- Validity: this one bundle and the approved retention periods.
- Future evidence authorization expiry if separately authorized: approval withdrawal, configuration/retention drift, redaction failure or missing readback.
- Recorded answer: evidence requirements approved; the unknown store remains unapproved and preflight remains blocked before connection.

## Stop conditions

Every condition has `override_allowed: false`, `retry_allowed: false`,
`partial_continuation_allowed: false` and `default_success_allowed: false`.
Its required next action is mandatory; none permits continuation of the current
attempt.

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

Required next actions, in the same order, are:

1. obtain fresh owner-attested staging identity and new activation authorization;
2. resolve environment ambiguity and obtain new activation authorization;
3. obtain all five owner decisions bound to the current fingerprint;
4. obtain new matching owner authorization;
5. record and approve one named operator;
6. record and approve one distinct credential issuer;
7. revoke and independently verify corrected least privilege;
8. revoke and require a newly authorized TTL-compliant credential;
9. revoke and remove every forbidden membership edge;
10. obtain exact owner-approved host and project allowlists;
11. restore independent review and authorization of Q1-Q8;
12. implement and independently verify the bounded metadata interface;
13. revoke and independently verify removal of mutation capability;
14. identify and approve a Q8-compliant private evidence store;
15. implement and independently validate closed-field redaction;
16. implement and independently verify all attempt counters;
17. establish and independently test immediate revocation before reauthorization;
18. recompute evidence and authorize the new baseline or migration hash;
19. repeat independent verification and obtain new owner authorization;
20. revoke immediately and open a production-access incident review;
21. revoke and require a newly reviewed and authorized attempt;
22. revoke and investigate the prohibited retry before new authorization;
23. revoke immediately and open a prohibited-read incident review;
24. revoke immediately and open a migration-attempt incident review; and
25. revoke immediately and open an out-of-scope execution incident review.

## Unresolved information — do not infer

| Unknown | Status | Answer owner | Safe resolution | Required before | Consequence | Separate authorization |
|---|---|---|---|---|---|---|
| `staging_project_reference` | `UNRESOLVED` | staging environment owner | signed Q1 attestation against the repository candidate | sealing D1/allowlist | stop; identity untrusted | yes |
| `staging_host` | `UNRESOLVED` | staging environment owner | signed canonical-host attestation without secret access | any connection authority | stop; production ambiguity | yes |
| `staging_10reps_retailer_id` | `UNRESOLVED` | staging data owner | bounded Q2 lookup | PASS result | stop; retailer ambiguous | yes |
| `operator` | `UNRESOLVED` | RA-004 owner | named-person/separation review | issuance | stop; no accountable operator | yes |
| `credential_issuer` | `UNRESOLVED` | staging security/database owner | distinct named-person assignment | issuance | stop; lifecycle uncontrolled | yes |
| `execution_window` | `UNRESOLVED` | RA-004 and staging owners | exact UTC start/end, at most 30 minutes | authorization validity | stop; no valid window | yes |
| `private_evidence_store` | `UNRESOLVED` | evidence custodian/data owner | Q8 config review without upload | any connection | stop; no compliant destination | yes |
| `available_metadata_only_role` | `UNRESOLVED` | future implementation owner/verifier | reviewed migration and isolated privilege tests | credential implementation | `BLOCKED_INTERFACE_GAP` | yes |
| `exact_control_plane_identity_read_path` | `UNRESOLVED` | staging platform owner | one allowlisted endpoint or signed record | D1 use | `BLOCKED_INTERFACE_GAP` | yes |
| `exact_database_metadata_read_path` | `UNRESOLVED` | implementation/database owners | reviewed RPC/role and staging deployment | D2/D3 use | `BLOCKED_INTERFACE_GAP`; no SQL fallback | yes |

## Current interface gaps and next task

The five exact open gaps are:

- No deployed bounded control-plane identity interface is identified.
- No deployed metadata-only RPC covers Q2 through Q7 in one read-only statement.
- No existing role is limited to the proposed metadata allowlist without control or mutation-adjacent capabilities.
- No preflight provider or CLI has the required one-connection, one-RPC, no-general-SQL contract.
- No current owner-approved private evidence store is identified in the repository.

These gaps block every read and execution attempt. The recorded decision permits
their later local preparation in one separate PR, but it does not authorize
staging deployment, a connection or execution.

Independent verification used the exact initial PR head
`0b2752ac60cd8e38659751a227487f328def574b` in a clean worktree. It confirmed
the initial fingerprint
`732cccf46eb4467460029b411f5138f81f4af69a9ad88235e6ed20d9051f7149`,
rejected all 12 controlled mutations, independently rechecked the repository
facts and corrected only this four-file documentation scope. Project Guardian,
89 focused exporter/selector tests, TypeScript, ESLint, `verify:quick` and
`verify:full` (including the production build) passed. The final canonical
fingerprint is
`9ed7ea2bea9a7fb2c2a521da87314ef6c438c46c46b751be254f7e57e2239b64`.
Integration, SQL/database tests, Supabase CLI and all staging/production access
were skipped by design, not counted as passes.

Final independent verification used a second clean detached worktree at owner
decision commit `20053e88d0a1fc6616189771d421c953bc0118c9`. It independently
confirmed the exact owner instruction, D1-D5, all execution prohibitions, five
open interface gaps, ten `UNRESOLVED` values, migration SHA and both selector
exclusions. All 15 controlled mutations were rejected. Project Guardian, 89
focused exporter/selector tests, TypeScript, ESLint, `verify:quick` and
`verify:full`, including the production build, passed. Integration,
SQL/database tests, Supabase CLI and staging/production access were skipped by
design and were not counted as passes.

The next and only task is to prepare one consolidated local implementation PR
covering the metadata-only RPC, minimal role, closed provider, CLI and tests,
without deploying to staging. Do not issue a credential, connect to staging or
execute the preflight.
