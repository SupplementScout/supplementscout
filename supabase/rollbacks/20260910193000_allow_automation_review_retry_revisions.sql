begin;

do $$
begin
  if exists (
    select 1
      from public.product_match_review_queue
     where retailer_id is not null and offer_id is not null
     group by retailer_id, offer_id, source_row_fingerprint
    having count(*) > 1
  ) then
    raise exception 'AUTOMATION_REVIEW_HISTORICAL_REVISIONS_EXIST';
  end if;
end;
$$;

drop index if exists public.product_match_review_queue_offer_fingerprint_unique;

create unique index product_match_review_queue_offer_fingerprint_unique
  on public.product_match_review_queue (retailer_id, offer_id, source_row_fingerprint)
  where retailer_id is not null and offer_id is not null;

commit;
