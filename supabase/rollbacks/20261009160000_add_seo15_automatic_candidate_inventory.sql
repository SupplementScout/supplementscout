begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

drop function if exists public.get_seo15_stage3_candidate_inventory();
drop table if exists public.seo15_stage3_retailer_releases;

commit;
