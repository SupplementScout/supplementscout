do $block$
declare
  v_has_rows boolean := false;
begin
  if to_regclass('public.sealed_artifacts') is not null then
    execute 'select exists (select 1 from public.sealed_artifacts)' into v_has_rows;
    if v_has_rows then
      raise exception using
        errcode = '55000',
        message = 'SEALED_ARTIFACT_REGISTRY_NOT_EMPTY';
    end if;
    drop table public.sealed_artifacts;
  end if;
end
$block$;

drop function if exists public.reject_sealed_artifact_mutation();

-- The private bucket is intentionally not deleted here. A bucket rollback is a
-- separate, environment-bound operation and is permitted only before any object
-- exists; retained exact bytes must never be removed by a schema rollback.
