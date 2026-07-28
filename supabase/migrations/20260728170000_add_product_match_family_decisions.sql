begin;

alter table public.product_match_review_queue
  add column selected_family_seed_review_item_id bigint
    references public.product_match_review_queue(id) on delete restrict,
  add column proposed_family_name text,
  add column proposed_variant_name text;

alter table public.product_match_review_queue
  add constraint product_match_review_queue_family_name_length_check
    check (
      proposed_family_name is null
      or length(trim(proposed_family_name)) between 1 and 300
    ),
  add constraint product_match_review_queue_variant_name_length_check
    check (
      proposed_variant_name is null
      or length(trim(proposed_variant_name)) between 1 and 200
    );

alter table public.product_match_review_queue
  drop constraint product_match_review_queue_decision_state;

alter table public.product_match_review_queue
  add constraint product_match_review_queue_decision_state check (
    (
      decision = 'PENDING'
      and reviewed_by is null
      and reviewed_at is null
      and selected_canonical_product_id is null
      and selected_canonical_variant_id is null
      and selected_family_seed_review_item_id is null
      and proposed_family_name is null
      and proposed_variant_name is null
    )
    or (
      decision = 'APPROVE_EXISTING_VARIANT'
      and selected_canonical_product_id is not null
      and selected_canonical_variant_id is not null
      and selected_family_seed_review_item_id is null
      and proposed_family_name is null
      and proposed_variant_name is null
      and reviewed_by is not null
      and reviewed_at is not null
    )
    or (
      decision = 'APPROVE_NEW_VARIANT_SEED'
      and selected_canonical_variant_id is null
      and proposed_variant_name is not null
      and (
        (
          selected_canonical_product_id is not null
          and selected_family_seed_review_item_id is null
          and proposed_family_name is null
        )
        or (
          selected_canonical_product_id is null
          and selected_family_seed_review_item_id is not null
          and proposed_family_name is not null
        )
      )
      and reviewed_by is not null
      and reviewed_at is not null
    )
    or (
      decision = 'APPROVE_NEW_FAMILY_SEED'
      and selected_canonical_product_id is null
      and selected_canonical_variant_id is null
      and selected_family_seed_review_item_id = id
      and proposed_family_name is not null
      and proposed_variant_name is not null
      and reviewed_by is not null
      and reviewed_at is not null
    )
    or (
      decision in (
        'APPROVE_NEW_PRODUCT',
        'DEFER_POLICY',
        'MARK_OOS',
        'REJECT_IDENTITY',
        'REQUEST_NEW_SOURCE',
        'SUPERSEDE'
      )
      and selected_canonical_product_id is null
      and selected_canonical_variant_id is null
      and selected_family_seed_review_item_id is null
      and proposed_family_name is null
      and proposed_variant_name is null
      and reviewed_by is not null
      and reviewed_at is not null
    )
  );

create index product_match_review_queue_family_seed_idx
  on public.product_match_review_queue (selected_family_seed_review_item_id)
  where selected_family_seed_review_item_id is not null;

create or replace function public.validate_product_match_review_family()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_seed public.product_match_review_queue%rowtype;
begin
  if old.decision = 'APPROVE_NEW_FAMILY_SEED'
     and new.decision <> 'APPROVE_NEW_FAMILY_SEED'
     and exists (
       select 1
       from public.product_match_review_queue dependent
       where dependent.selected_family_seed_review_item_id = old.id
         and dependent.id <> old.id
         and dependent.decision = 'APPROVE_NEW_VARIANT_SEED'
         and dependent.consumed_at is null
     ) then
    raise exception 'family seed has active dependent variants';
  end if;

  if new.decision = 'APPROVE_NEW_VARIANT_SEED'
     and new.selected_family_seed_review_item_id is not null then
    select *
      into v_seed
      from public.product_match_review_queue seed
     where seed.id = new.selected_family_seed_review_item_id;

    if not found
       or v_seed.id = new.id
       or v_seed.decision <> 'APPROVE_NEW_FAMILY_SEED'
       or v_seed.snapshot_id <> new.snapshot_id
       or v_seed.retailer <> new.retailer
       or v_seed.consumed_at is not null
       or v_seed.proposed_family_name <> new.proposed_family_name then
      raise exception 'invalid product match family seed';
    end if;
  end if;

  return new;
end;
$$;

alter function public.validate_product_match_review_family() owner to postgres;
revoke all on function public.validate_product_match_review_family()
  from public, anon, authenticated;
grant execute on function public.validate_product_match_review_family()
  to service_role;

create trigger product_match_review_queue_family_guard
before update on public.product_match_review_queue
for each row execute function public.validate_product_match_review_family();

comment on column public.product_match_review_queue.selected_family_seed_review_item_id is
  'For a proposed new family, points to the reviewed queue row that seeds the canonical product. It never points directly to catalogue data.';

comment on column public.product_match_review_queue.proposed_family_name is
  'Reviewed canonical family name proposal. It does not create or rename a public product.';

comment on column public.product_match_review_queue.proposed_variant_name is
  'Reviewed canonical variant or flavour proposal. It does not create a public variant.';

commit;
