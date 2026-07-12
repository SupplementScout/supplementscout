# Database migrations

## Active baseline

`supabase/migrations` is the only active migration directory. It currently contains a verified baseline of the `public` business schema. The baseline is intended only for a database that does not contain any of the SupplementScout business tables.

The migration starts with a preflight guard. If any target business table already exists in `public`, the guard aborts before persistent DDL and reports that migration-history reconciliation is required. Do not remove or bypass this guard.

The final guarded baseline SHA-256, after normalizing CRLF to LF, is:

```text
A604C181255CC49E6DFA527145EAA8B3BA30767B6860A5B09FD43A32A2E08C95
```

Its approved source candidate, before adding the deployment guard, had SHA-256:

```text
CAEB054854D2EF3EA3D01791532DA99CAB2E9E4FA4CD1F588DFB1FAE0A5C0F31
```

## Legacy archive

`supabase/legacy-migrations` is an immutable archive of the migrations that preceded the baseline. Supabase CLI does not execute this directory. Never manually move these files back into `supabase/migrations`; doing so would reintroduce obsolete migration versions and operations that assume historical database state.

Run `npm run verify:baseline` after changing migration-related files. The validator checks the active migration inventory, baseline timestamp and hash, archived file hashes, deployment guard, forbidden data statements, secrets, and managed-schema DDL.

## Existing environments

Do not run `supabase db push` against staging or production until their migration ledger has been explicitly reconciled with the baseline version. Existing environments already contain the baseline objects, so they must not execute the baseline SQL.

Migration-history reconciliation for an existing environment may use `migration repair` only after a complete staging rehearsal has demonstrated the exact procedure and its expected ledger state. It requires a separate reviewed runbook and explicit authorization; it is not part of normal local baseline validation.

## Required validation

Repeat the full local empty-database bootstrap and offline schema diff whenever any executable baseline SQL changes, including its guard, functions, constraints, grants, policies, or object order. Documentation-only, CI-only, or validator-only changes do not require a database reset unless they change the approved hash or validation assumptions.

Future active migrations must use a unique 14-digit UTC-style timestamp prefix in `YYYYMMDDHHMMSS` form. Before committing, run:

```text
npm run verify:baseline
npm run build
npm run lint
git diff --check
```
