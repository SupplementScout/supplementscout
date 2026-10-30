-- Apply only through an environment-bound operator after confirming the exact
-- Supabase project ref. This file is intentionally outside migrations because
-- the repository forbids automatic changes to Supabase-managed schemas.
do $block$
declare
  v_bucket storage.buckets%rowtype;
begin
  select * into v_bucket
  from storage.buckets
  where id = 'sealed-artifacts';

  if found then
    if v_bucket.name is distinct from 'sealed-artifacts'
       or v_bucket.public is distinct from false
       or v_bucket.file_size_limit is distinct from 10485760::bigint
       or v_bucket.allowed_mime_types is distinct from array[
         'application/json',
         'application/x-ndjson',
         'application/sql',
         'text/csv',
         'text/markdown',
         'text/plain'
       ]::text[] then
      raise exception using
        errcode = '55000',
        message = 'SEALED_ARTIFACT_BUCKET_CONTRACT_MISMATCH';
    end if;
    return;
  end if;

  insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
  ) values (
    'sealed-artifacts',
    'sealed-artifacts',
    false,
    10485760,
    array[
      'application/json',
      'application/x-ndjson',
      'application/sql',
      'text/csv',
      'text/markdown',
      'text/plain'
    ]::text[]
  );
end
$block$;

-- No public storage.objects policy is created. Access remains private and is
-- limited to privileged server-side credentials under existing Supabase rules.
