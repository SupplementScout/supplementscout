begin;

alter table public.nutrition_candidates
  add column approved_value numeric;

create or replace function public.default_nutrition_candidate_approved_value()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Compatibility for an already-open admin form during the staged rollout.
  -- The transition is still an explicit owner review; this only records the
  -- proposed number when that form does not yet submit a corrected value.
  if old.status = 'pending'
     and new.status = 'approved'
     and new.approved_value is null then
    new.approved_value := new.proposed_value;
  end if;
  return new;
end;
$$;

create trigger nutrition_candidates_approved_value_default
before update on public.nutrition_candidates
for each row execute function public.default_nutrition_candidate_approved_value();

alter table public.nutrition_candidates
  disable trigger nutrition_candidates_review_update_guard;

update public.nutrition_candidates
set approved_value = proposed_value
where status = 'approved';

-- Owner correction recorded during protein candidate review: 400g / 28g is
-- 14 full servings. Exact identity and evidence preconditions prevent this
-- correction from affecting any unrelated row or catalogue table.
update public.nutrition_candidates
set approved_value = 14
where id = 105
  and product_id = 771
  and status = 'approved'
  and proposed_field = 'serving_count_verified'
  and proposed_value = 28
  and proposed_unit = 'count'
  and review_note ilike '%400g%14%serv%28g%';

alter table public.nutrition_candidates
  enable trigger nutrition_candidates_review_update_guard;

alter table public.nutrition_candidates
  add constraint nutrition_candidates_approved_value_positive
    check (approved_value is null or approved_value > 0),
  add constraint nutrition_candidates_approved_value_review_state
    check (
      (status = 'pending' and approved_value is null)
      or (status = 'rejected' and approved_value is null)
      or (status = 'approved' and approved_value is not null)
    );

comment on column public.nutrition_candidates.approved_value is
  'Explicit owner-reviewed numeric value. It may differ from proposed_value, but approval still only authorises planning and never updates catalogue data.';

revoke all on function public.default_nutrition_candidate_approved_value()
  from public, anon, authenticated;

commit;
