begin;

drop index if exists public.product_match_review_queue_offer_fingerprint_unique;

create unique index product_match_review_queue_offer_fingerprint_unique
  on public.product_match_review_queue (retailer_id, offer_id, source_row_fingerprint)
  where retailer_id is not null
    and offer_id is not null
    and review_status in ('PENDING', 'APPROVED', 'EXECUTING');

comment on index public.product_match_review_queue_offer_fingerprint_unique is
  'Allows immutable historical attempts while keeping one active review revision per retailer, offer and source fingerprint.';

commit;
