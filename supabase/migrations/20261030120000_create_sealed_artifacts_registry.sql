create table public.sealed_artifacts (
  id bigint generated always as identity primary key,
  artifact_kind text not null check (artifact_kind in (
    'SOURCE_EVIDENCE',
    'PREPARED_SCOPE',
    'REVIEW_REGISTRATION',
    'APPROVED_PLAN',
    'APPLY_AUDIT',
    'PRODUCTION_CLOSEOUT',
    'CONTROL_EVIDENCE',
    'RECOVERY_MANIFEST',
    'AUTOMATION_DIAGNOSTIC',
    'HISTORICAL_DOC'
  )),
  schema_version integer not null check (schema_version between 1 and 999),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  durable_uri text not null,
  filename text not null check (filename ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$'),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  content_type text not null check (content_type in (
    'application/json',
    'application/x-ndjson',
    'application/sql',
    'text/csv',
    'text/markdown',
    'text/plain'
  )),
  created_at timestamptz not null default clock_timestamp(),
  producer text not null check (producer ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'),
  environment text not null check (environment in ('staging', 'production', 'test')),
  git_sha text not null check (git_sha ~ '^[0-9a-f]{40}$'),
  retention_class text not null check (retention_class in ('PERMANENT', 'LONG_TERM')),
  artifact_fingerprint text null check (artifact_fingerprint is null or artifact_fingerprint ~ '^[0-9a-f]{64}$'),
  run_id text null check (run_id is null or run_id ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'),
  parent_artifact_sha text null check (parent_artifact_sha is null or parent_artifact_sha ~ '^[0-9a-f]{64}$'),
  target_scope_fingerprint text null check (target_scope_fingerprint is null or target_scope_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint sealed_artifacts_identity_unique unique (environment, artifact_kind, sha256),
  constraint sealed_artifacts_durable_uri_unique unique (durable_uri),
  constraint sealed_artifacts_retention_matches_kind check (
    (artifact_kind in (
      'SOURCE_EVIDENCE',
      'REVIEW_REGISTRATION',
      'APPROVED_PLAN',
      'APPLY_AUDIT',
      'PRODUCTION_CLOSEOUT',
      'CONTROL_EVIDENCE',
      'RECOVERY_MANIFEST'
    ) and retention_class = 'PERMANENT')
    or
    (artifact_kind in (
      'PREPARED_SCOPE',
      'AUTOMATION_DIAGNOSTIC',
      'HISTORICAL_DOC'
    ) and retention_class = 'LONG_TERM')
  ),
  constraint sealed_artifacts_uri_matches_identity check (
    durable_uri = 'supabase-storage://sealed-artifacts/' || environment || '/' || lower(artifact_kind) || '/' || sha256 || '/' || filename
  )
);

comment on table public.sealed_artifacts is
  'Immutable generic registry for exact-byte operational artifacts. A row alone is not proof of DURABLY_SEALED; callers must perform a fresh object readback and SHA-256 verification.';

create index sealed_artifacts_sha_lookup_idx
  on public.sealed_artifacts(environment, sha256);

create index sealed_artifacts_run_kind_lookup_idx
  on public.sealed_artifacts(environment, artifact_kind, run_id)
  where run_id is not null;

create or replace function public.reject_sealed_artifact_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  raise exception using
    errcode = '55000',
    message = 'SEALED_ARTIFACT_WRITE_ONCE_VIOLATION';
end
$function$;

create trigger sealed_artifacts_reject_update_delete
before update or delete on public.sealed_artifacts
for each row execute function public.reject_sealed_artifact_mutation();

alter table public.sealed_artifacts enable row level security;

revoke all on table public.sealed_artifacts from public, anon, authenticated, service_role;
revoke all on sequence public.sealed_artifacts_id_seq from public, anon, authenticated, service_role;

grant select, insert on table public.sealed_artifacts to service_role;
grant usage, select on sequence public.sealed_artifacts_id_seq to service_role;

revoke all on function public.reject_sealed_artifact_mutation() from public, anon, authenticated, service_role;
