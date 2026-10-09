begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

drop function if exists public.get_seo15_bounded_stage3_evidence();

commit;
