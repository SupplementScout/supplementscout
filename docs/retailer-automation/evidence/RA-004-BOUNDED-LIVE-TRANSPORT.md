# RA-004 bounded live transport

**Status:** `VERIFIED_COMPLETE`

**RA-004:** `IN_PROGRESS`

**Implementation baseline:** `db687ed9ecfd5023b4c17191e9ee95f117105bfa`

**Owner authority:** Marek Kalinka explicitly authorized preparation and merge
of one separate PR for the bounded preflight and control-state live transport
on 25 September 2026.

**Remote execution:** `NOT_PERFORMED`

**Pull request:** `#97`

**Independently verified implementation head:**
`7c321744f229992b3e24a2862d936783f7aaa714`

## Scope

This change closes only the reviewed transport gap between the existing closed
providers and PostgreSQL. It adds one shared transport module and injects its
one-method control-state instance into the existing exporter CLI. It does not
add an importer, executor, workflow, scheduler, retry, service-role path,
credential loader, file-secret loader or general SQL interface.

The preflight transport exposes exactly the five methods already required by
the closed provider: project-identity attestation, evidence-store attestation,
one metadata RPC, separate-issuer revoke and close. The control-state transport
exposes exactly `callReadOnlyRpc`. Neither transport exposes its PostgreSQL
client or a query method.

## Target and credential boundary

Both transports accept their database URL only as an in-memory constructor
argument. They do not read `process.env`, `.env`, files, command-line arguments,
Windows Credential Manager or logs. A later execution wrapper must obtain the
URL through the already approved masked prompt and pass it directly in memory.

The URL validator accepts only port `5432`, database `postgres`, and either:

- the exact direct host `db.<project-ref>.supabase.co` with the exact temporary
  login; or
- a Supabase session-pooler host with username
  `<temporary-login>.<project-ref>`.

Cross-project usernames, transaction-pooler port `6543`, extra query parameters,
fragments and any production-shaped target are rejected before a connection is
constructed. The known production reference remains explicitly denied.

## One-call database behavior

Each transport creates one client, connects once, starts `BEGIN READ ONLY`, and
executes one static parameterized `SELECT` containing only its approved RPC.
The returned row must prove the exact `session_user` and
`transaction_read_only=on`. It rolls back and closes the client in `finally`.
There is no retry, dynamic SQL, DDL, DML, table query or second-call path.

The preflight transport additionally requires an injected revoke callback. A
successful receipt must bind the exact credential ID and runner process ID and
must report a distinct issuer process ID. A revoke claim from the runner process
is rejected. The existing preflight runner still writes only a non-final report
until revoke and close are both proven.

The control-state credential lifecycle remains outside the one-method provider
surface. The later execution coordinator must call the separately reviewed
issuer in `finally`; canary success cannot be recorded without that independent
revoke receipt. This PR does not create that credential or execute the canary.

## Preserved boundaries

- The existing preflight and control-state providers remain retailer-neutral.
- The existing RPC signatures, migrations and SHA-256 values are unchanged.
- Both RA-004 migrations remain excluded from STAGING and PRODUCTION selectors.
- No activation manifest is restored.
- No application code, workflow, scheduler or production entry point imports
  the transport.
- Production remains untouched.
- Feed capture, shadow, control plan, approval, import, apply, Review Queue and
  Model B remain outside this change.

## Verification

Focused tests use fake clients only. They prove the exact SQL and positional
arguments, one connection, one RPC, read-only/session-user evidence, close on
success and failure, cross-project and production rejection, one-call limits,
secret redaction, distinct issuer proof and live exporter dependency injection.
They also prove the transport has no environment, filesystem, workflow,
service-role or general write loader.

No staging or production connection, DNS lookup, credential creation, migration,
bucket operation, metadata RPC or control-state RPC is part of this PR.

Independent verification used a new detached worktree at the exact PR head.
It confirmed the ten-file diff, unchanged package, lockfile, workflows,
migrations and selector, both approved migration SHA-256 values, and the
synthetic-only nature of every connection string in the test diff. The focused
suite passed `118/118`; `git diff --check`, Project Guardian and
`npm run verify:full` all passed. The full gate reported 310 inventoried tests
and completed the production build. No integration test was invoked by the
quality gate, consistent with the isolated integration-test policy.

## Next gate

After green GitHub checks and ordinary squash merge, the previously approved
staging execution may prepare a new SHA-bound selector activation. That later
execution must still satisfy every target, evidence-store, credential,
time-window, no-retry and revoke condition. This transport merge by itself does
not start the 30-minute window.
