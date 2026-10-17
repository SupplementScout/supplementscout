begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop function if exists public.read_reviewed_catalogue_import_state(jsonb);

commit;
