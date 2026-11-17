begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Remove only this exact unmodified function. Preserve every business/control row.
do $guard$
declare p pg_proc%rowtype; target jsonb:=public.retailer_catalogue_actual_database_target();
begin
  if current_user<>'postgres' or target->>'target_environment' is distinct from 'PRODUCTION' or target->>'project_ref' is distinct from 'aftboxmrdgyhizicfsfu' or target->>'database_identity' is distinct from 'supplementscout-production:aftboxmrdgyhizicfsfu' then raise exception 'HB_REGISTRATION_PROPOSAL_TARGET_MISMATCH'; end if;
  select * into p from pg_proc where oid='public.register_holland_barrett_offer_sync_control_plan(jsonb)'::regprocedure;
  if encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') is distinct from 'b388ed2f7f4f7302ccd0655c96c410af6d3770b0950ba73ecf2eb439d6fde6e7' or pg_get_userbyid(p.proowner)<>'postgres' or not p.prosecdef or p.provolatile<>'v' or p.proconfig is distinct from array['search_path=pg_catalog, public, pg_temp']::text[] or p.proacl::text is distinct from '{postgres=X/postgres,retailer_catalogue_production_validator=X/postgres}' then raise exception 'HB_REGISTRATION_PROPOSAL_LINEAGE_MISMATCH'; end if;
end
$guard$;
drop function public.register_holland_barrett_offer_sync_control_plan(jsonb);
commit;
