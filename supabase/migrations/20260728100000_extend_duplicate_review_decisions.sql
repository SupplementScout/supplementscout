begin;

alter table public.ignored_duplicate_product_pairs
  add column decision text not null default 'separate',
  add column note text,
  add column updated_at timestamptz not null default now();

alter table public.ignored_duplicate_product_pairs
  add constraint ignored_duplicate_product_pairs_decision_check
    check (decision in ('separate', 'deferred')),
  add constraint ignored_duplicate_product_pairs_note_length_check
    check (note is null or length(note) <= 500);

create index ignored_duplicate_product_pairs_decision_updated_idx
  on public.ignored_duplicate_product_pairs (decision, updated_at desc);

revoke all on table public.ignored_duplicate_product_pairs
  from public, anon, authenticated;
revoke all on sequence public.ignored_duplicate_product_pairs_id_seq
  from public, anon, authenticated;
grant all on table public.ignored_duplicate_product_pairs to service_role;
grant all on sequence public.ignored_duplicate_product_pairs_id_seq
  to service_role;

comment on column public.ignored_duplicate_product_pairs.decision is
  'Review decision for a detected product pair: separate hides a confirmed non-duplicate; deferred keeps it in the decision backlog.';

comment on column public.ignored_duplicate_product_pairs.note is
  'Optional administrator evidence or follow-up note. Never used as merge authority.';

commit;
