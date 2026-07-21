begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $policy$
declare
  v_definition text;
  v_updated text;
  v_old text := 'v_product_values->>''product_format'' <> ''powder''';
  v_new text := 'v_product_values->>''product_format'' not in (''powder'',''bar'')';
begin
  if to_regprocedure('public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text)') is null
     or to_regprocedure('public.validate_product_import_plan_read_only(jsonb)') is null
     or to_regprocedure('public.apply_product_import_plan(jsonb)') is null then
    raise exception 'reviewed parent explicit-variant importer RPCs are missing';
  end if;

  if not public.atomic_import_reviewed_parent_variant_allowed(
    'PER4M Protein Bars Box of 12 x 62g','PER4M','Protein Bars','bar','62','g'
  ) then
    raise exception 'exact reviewed protein-bar family is not allowlisted';
  end if;

  select pg_get_functiondef('public.validate_product_import_plan_read_only(jsonb)'::regprocedure)
  into v_definition;
  if strpos(v_definition, v_old) = 0 then
    raise exception 'reviewed parent validator powder-only guard not found';
  end if;
  if (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'reviewed parent validator powder-only guard is ambiguous';
  end if;

  v_updated := replace(v_definition, v_old, v_new);
  execute v_updated;

  if strpos(pg_get_functiondef('public.validate_product_import_plan_read_only(jsonb)'::regprocedure), v_new) = 0 then
    raise exception 'reviewed parent validator bar-format guard was not installed';
  end if;
end
$policy$;

commit;
