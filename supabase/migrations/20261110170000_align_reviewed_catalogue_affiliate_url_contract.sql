begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- V1 and V2 already share this validator, approval ledger and atomic executor.
-- Change only URL validation; retain the approved raw URLs and all identity guards.
do $migration$
declare
  v_signature regprocedure := 'public.validate_reviewed_catalogue_import_plan(jsonb)'::regprocedure;
  v_definition text := pg_get_functiondef(v_signature);
  v_updated text;
  v_before_sha constant text := '9459d0032dcd1c9eaafe59e5a5cac2b128cd722e8e977388a497cad0ff1df2c4';
  v_after_sha constant text := '40f59521fbaa2d062225ed1419e5a17ff11bc92feaece20765ab10632daf3a7c';
  v_old text := $old$     or v_mapping->>'external_url' is distinct from v_offer->>'url'$old$;
  v_new text := $new$     or nullif(btrim(v_offer->>'url'),'') is null
     or (v_offer->>'url') !~ '^https://'$new$;
  v_anchor text := $anchor$    raise exception 'stale reviewed catalogue retailer';
  end if;$anchor$;
  v_check text := $check$
  -- reviewed-catalogue separate merchant and outbound URL contract
  -- Reuse the retailer bootstrap origin parser; do not rewrite either URL.
  if exists (
    select 1 from unnest(array[v_mapping->>'external_url',v_offer->>'url']) as destination(url)
    where url !~ '^https://[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?::[0-9]{1,5})?(?:[/?#]|$)'
      or url ~ '[[:space:][:cntrl:]]' or position(chr(92) in url)>0
      or coalesce(substring(public.retailer_identity_website_origin(url) from ':([0-9]+)$'),'443')::integer not between 1 and 65535
  ) then
    raise exception 'invalid reviewed catalogue URL destination';
  end if;
  if regexp_replace(regexp_replace(public.retailer_identity_website_origin(v_mapping->>'external_url'),'^https?://(www\.)?',''),':[0-9]+$','')
     is distinct from
     regexp_replace(regexp_replace(public.retailer_identity_website_origin(v_actual->>'website'),'^https?://(www\.)?',''),':[0-9]+$','') then
    raise exception 'reviewed catalogue direct URL host mismatch';
  end if;$check$;
begin
  if current_user <> 'postgres'
     or to_regprocedure('public.retailer_identity_website_origin(text)') is null then
    raise exception 'reviewed catalogue URL contract prerequisites are missing';
  end if;
  if encode(sha256(convert_to(v_definition,'UTF8')),'hex')=v_after_sha then
    return;
  end if;
  if encode(sha256(convert_to(v_definition,'UTF8')),'hex')<>v_before_sha
     or (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old)<>1
     or (length(v_definition)-length(replace(v_definition,v_anchor,'')))/length(v_anchor)<>1 then
    raise exception 'reviewed catalogue URL validator definition drift';
  end if;
  v_updated := replace(replace(v_definition,v_old,v_new),v_anchor,v_anchor||v_check);
  execute v_updated;
  if encode(sha256(convert_to(pg_get_functiondef(v_signature),'UTF8')),'hex')<>v_after_sha then
    raise exception 'reviewed catalogue URL validator postflight drift';
  end if;
end
$migration$;

commit;
