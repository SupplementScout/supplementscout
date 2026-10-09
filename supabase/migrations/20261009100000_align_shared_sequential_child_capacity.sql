begin;

set local lock_timeout='5s';
set local statement_timeout='60s';

do $align_shared_sequential_child_capacity$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_before jsonb;
  v_function regprocedure;
  v_definition text;
  v_after text;
  v_properties_before jsonb;
  v_properties_after jsonb;
  v_old_count integer;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'shared sequential child-capacity target mismatch';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('retailer-offer-sync:global-execution',0));
  v_before:=public.retailer_catalogue_business_counts();

  foreach v_function in array array[
    to_regprocedure('public.register_retailer_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_fit_house_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_jons_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_whey_okay_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_discount_supplements_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_dolphin_vegan_protein_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_simply_supplements_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_kior_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_10reps_offer_sync_control_plan(jsonb)')
  ] loop
    if v_function is null then
      raise exception 'required shared sequential registration function missing';
    end if;

    select pg_get_functiondef(v_function),
      jsonb_build_object(
        'owner',proowner::text,
        'security_definer',prosecdef,
        'volatility',provolatile,
        'parallel',proparallel,
        'configuration',to_jsonb(proconfig),
        'acl',to_jsonb(proacl))
    into v_definition,v_properties_before
    from pg_proc where oid=v_function;

    v_old_count:=
      case when strpos(v_definition,
        'v_child_count < 1 or v_child_count > 20')>0 then 1 else 0 end+
      case when strpos(v_definition,
        'v_child_count<1 or v_child_count>20')>0 then 1 else 0 end;
    if v_old_count<>1
       or strpos(v_definition,
         'v_child_count < 1 or v_child_count > 50')>0
       or strpos(v_definition,
         'v_child_count<1 or v_child_count>50')>0 then
      raise exception 'shared sequential child-capacity definition drifted: %',
        v_function;
    end if;

    v_definition:=replace(
      v_definition,
      'v_child_count < 1 or v_child_count > 20',
      'v_child_count < 1 or v_child_count > 50');
    v_definition:=replace(
      v_definition,
      'v_child_count<1 or v_child_count>20',
      'v_child_count<1 or v_child_count>50');
    execute v_definition;

    select pg_get_functiondef(v_function),
      jsonb_build_object(
        'owner',proowner::text,
        'security_definer',prosecdef,
        'volatility',provolatile,
        'parallel',proparallel,
        'configuration',to_jsonb(proconfig),
        'acl',to_jsonb(proacl))
    into v_after,v_properties_after
    from pg_proc where oid=v_function;

    if (strpos(v_after,
          'v_child_count < 1 or v_child_count > 50')=0
        and strpos(v_after,
          'v_child_count<1 or v_child_count>50')=0)
       or strpos(v_after,
         'v_child_count < 1 or v_child_count > 20')>0
       or strpos(v_after,
         'v_child_count<1 or v_child_count>20')>0
       or v_properties_after is distinct from v_properties_before then
      raise exception 'shared sequential child-capacity postcondition failed: %',
        v_function;
    end if;
  end loop;

  if public.retailer_catalogue_business_counts() is distinct from v_before then
    raise exception 'shared sequential child-capacity migration changed business counts';
  end if;
end
$align_shared_sequential_child_capacity$;

commit;
