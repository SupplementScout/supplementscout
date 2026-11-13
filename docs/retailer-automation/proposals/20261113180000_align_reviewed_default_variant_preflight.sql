begin;

-- Unregistered proposal: do not add to the active migration inventory or apply
-- without a separately authorized release/ledger plan. Harden the one V2 identity
-- validator shared by READ ONLY preflight and technical approval. Execution,
-- historical legacy-upgrade exceptions, V3, privileges and catalogue rows stay
-- unchanged. A source tuple cannot supply missing historical Default identity.
do $migration$
declare
  v_definition text := pg_get_functiondef('public.validate_reviewed_catalogue_import_identity(jsonb)'::regprocedure);
  v_before_sha text := '799496fe9191ef7d7c8752f81421b78342ca805374eca17dd8df372505a256e3';
  v_anchor text := $anchor$    if exists (
      select 1 from jsonb_each(p_plan#>'{product_variant,evidence}') e$anchor$;
  v_guard text := $guard$    -- Match the existing standard executor's Default identity boundary.
    if v_actual->'is_default' = 'true'::jsonb and (
      p_plan#>>'{product_variant,evidence,flavour}' is not null
      or p_plan#>>'{product_variant,evidence,size_value}' is not null
      or exists (
        select 1 from public.product_variants pv
        where pv.product_id=v_product_id and pv.is_active and not pv.is_default
      )
    ) then
      raise exception 'variant evidence does not match default product variant';
    end if;
$guard$;
begin
  if current_user <> 'postgres' then
    raise exception 'reviewed Default preflight migration requires postgres';
  end if;
  if position(v_guard in v_definition)>0 then
    if encode(sha256(convert_to(replace(v_definition,v_guard,''),'UTF8')),'hex') <> v_before_sha then
      raise exception 'reviewed Default preflight validator definition drift';
    end if;
    return;
  end if;
  if encode(sha256(convert_to(v_definition,'UTF8')),'hex') <> v_before_sha
     or position(v_anchor in v_definition)=0
     or length(v_definition)-length(replace(v_definition,v_anchor,'')) <> length(v_anchor) then
    raise exception 'reviewed Default preflight validator definition drift';
  end if;
  execute replace(v_definition,v_anchor,v_guard||v_anchor);
end
$migration$;

commit;
